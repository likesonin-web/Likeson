import express from 'express';
import Booking              from '../models/Booking.js';
import Consultation         from '../models/Consultation.js';
import Ride                 from '../models/Ride.js';
import RideTracking         from '../models/RideTracking.js';
import User                 from '../models/User.js';
import Driver               from '../models/Driver.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import TransportPartner     from '../models/TransportPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import DoctorProfile        from '../models/DoctorProfile.js';
import Hospital             from '../models/Hospital.js';
import OutPatientRecord     from '../models/OutPatientRecord.js';
import SystemLog            from '../models/SystemLog.js';
import Wallet               from '../models/Wallet.js';
import Vehicle              from '../models/Vehicle.js';
import RouteVersion         from '../models/RouteVersion.js';
import RideParticipant      from '../models/RideParticipant.js';
import RideStop             from '../models/RideStop.js';
import JoinPoint            from '../models/JoinPoint.js';
import AssignmentHistory    from '../models/AssignmentHistory.js';
import SosEvent             from '../models/SosEvent.js';
import DestinationChangeAudit from '../models/DestinationChangeAudit.js';

import sendEmail                     from '../utils/sendEmail.js';
import sendSms                       from '../services/Sendsms.js';
import { generateBookingInvoicePdf } from '../utils/bookingInvoiceGenerator.js';
import { getBookingSocketService }   from '../services/bookingSocketService.js';
import {
  transactionalTemplate,
  buildStatusUpdateEmail,
  buildRefundEmail,
} from '../utils/emailTemplates.js';
import {
  driverAssignedSms, careAssistantAssignedSms,
  appointmentConfirmedSms, newCareRequestToAssistantSms,
} from '../utils/Smstemplates.js';
import { generateOpHtml, buildOpZipBuffer } from '../utils/opDocumentGenerator.js';
import { opConfirmationEmailTemplate }       from '../utils/opEmailTemplates.js';

import { protect, authorize } from '../middleware/authMiddleware.js';
import { createAllocationsForBooking } from '../services/allocationEngine.service.js'; // ADJUST PATH if services/ sits elsewhere relative to this router
import {
  genOtp,
  hashOtp,
  razorpay,
  haversineKm,
  createNotification,
  buildRidePayload,
  calculateCanonicalRoute,
  recoverSubscriptionUsageOnCancel,
  RADIUS_METERS,
  CARE_RIDE_RADIUS_M,
  TRANSPORT_RADIUS_M,
} from './bookingRouterShared.js';
import {
  resolveCaJoinPoint,
  buildCaJoinWaypoint,
} from '../utils/careJoinPointUtils.js';

import cache       from '../middleware/cache.js';
import redisClient from '../config/redis.js';

const router = express.Router();

const transportRadiusRad = TRANSPORT_RADIUS_M / 1000 / 6378.1;
const careRideRadiusRad  = CARE_RIDE_RADIUS_M  / 1000 / 6378.1;

// ─────────────────────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL = {
  adminBookings: 30,
  adminStats:    60,
  nearby:        30,
  ops:           45,
  opRecord:      60,
  consultations: 30,
};

const invalidateBookingCache = async () => {
  try {
    const patterns = [
      'GET:/admin/bookings*', 'GET:/op/*', 'GET:/hospital/*',
      'GET:/doctor/ops*', 'GET:/consultations*', 'GET:/tp/*',
    ];
    for (const pattern of patterns) {
      let cursor = 0;
      do {
        const reply = await redisClient.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = reply.cursor;
        if (reply.keys.length) await redisClient.del(reply.keys);
      } while (cursor !== 0);
    }
  } catch (e) { console.error('[Cache] invalidation error:', e.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const getBookingCoords = (booking) => ({
  pickupCoords:   booking.patientLocation?.coordinates     || [80.648, 16.506],
  pickupAddress:  booking.patientLocation?.address         || '',
  pickupCity:     booking.patientLocation?.city            || '',
  dropoffCoords:  booking.destinationLocation?.coordinates || [80.648, 16.506],
  dropoffAddress: booking.destinationLocation?.address     || '',
  dropoffCity:    booking.destinationLocation?.city        || '',
});

const joinBookingRoom = (userId, bookingId) => {
  try { getBookingSocketService()?.emitJoinRoom(String(userId), `booking:${bookingId}`); }
  catch (e) { console.error('[joinBookingRoom]', e.message); }
};

const joinTpRoom = (userId, tpId) => {
  try { getBookingSocketService()?.emitJoinRoom(String(userId), `tp:${tpId}`); }
  catch (e) { console.error('[joinTpRoom]', e.message); }
};

const sendOpZipEmail = async ({ op, booking, patient, followUps = [] }) => {
  try {
    const doctor   = op.doctor   ? await DoctorProfile.findById(op.doctor).populate('user', 'name email phone').lean() : null;
    const hospital = op.hospital ? await Hospital.findById(op.hospital).lean() : null;
    const html     = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zip      = await buildOpZipBuffer(html, op.opNumber);
    await sendEmail({
      email:   patient.email,
      subject: `Your OP Card — ${op.opNumber} | Likeson Healthcare`,
      html:    opConfirmationEmailTemplate({
        patientName:      patient.name,
        doctorName:       doctor?.user?.name || booking?.doctorSnapshot?.name || 'Your Doctor',
        hospitalName:     hospital?.name || null,
        opNumber:         op.opNumber,
        bookingCode:      booking.bookingCode,
        scheduledAt:      op.scheduledAt || booking.scheduledAt,
        consultationType: op.consultationType,
        isFollowUp:       op.isFollowUp,
        followUpExpiry:   op.followUpExpiry,
        followUpFee:      op.followUpFee,
      }),
      attachments: [{
        content:     zip.toString('base64'),
        filename:    `${(op.opNumber || 'OP-RECORD').replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`,
        type:        'application/zip',
        disposition: 'attachment',
      }],
    });
  } catch (e) { console.error('[OP ZIP Email] failed:', e.message); }
};

const createOrSendOpOnConfirmation = async ({ booking, triggeredBy = 'system' }) => {
  try {
    if (!booking.doctor) return;
    let op = await OutPatientRecord.findOne({ booking: booking._id }).lean();
    if (!op) {
      // FIX: booking.hospital is very often unset (doctor picked directly, no hospital
      // step). Falling back to doctor.primaryHospital means OP records — and every
      // hospital-scoped query reading OutPatientRecord.hospital — actually surface
      // this consultation instead of silently dropping it.
      let opHospital = booking.hospital || null;
      if (!opHospital) {
        const doctorProfile = await DoctorProfile.findById(booking.doctor).select('primaryHospital').lean();
        opHospital = doctorProfile?.primaryHospital || null;
      }
      const opDoc = await OutPatientRecord.create({
        booking:          booking._id,
        doctor:           booking.doctor,
        hospital:         opHospital,
        patient:          booking.customer,
        consultationType: booking.consultationType || 'inPerson',
        scheduledAt:      booking.scheduledAt,
        status:           'scheduled',
        isFollowUp:       !!booking.followUpParentBooking,
        createdBy:        null,
      });
      op = opDoc.toObject();
    }
    const patient   = await User.findById(booking.customer).select('email name phone').lean();
    const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();
    if (patient?.email) await sendOpZipEmail({ op, booking, patient, followUps });
    await createNotification({
      recipient: booking.customer,
      title:     'Booking Confirmed',
      body:      `Your appointment OP ${op.opNumber} is ready. Check your email.`,
      type:      'Booking_Confirmed',
      bookingId: booking._id,
    });
  } catch (e) { console.error('[createOrSendOpOnConfirmation] failed:', e.message); }
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const emailCustomerStatusUpdate = async ({ booking, newStatus, customer }) => {
  try {
    if (!customer?.email) return;
    await sendEmail({
      email:   customer.email,
      subject: `Booking #${booking.bookingCode} — Status Update: ${newStatus} | Likeson Healthcare`,
      html:    buildStatusUpdateEmail({
        userName:   customer.name,
        order:      { orderId: booking.bookingCode },
        orderItems: [],
        billing:    booking.fareBreakdown ? {
          subTotal:       booking.fareBreakdown.totalAmount || 0,
          gstAmount:      booking.fareBreakdown.taxes       || 0,
          totalPayable:   booking.fareBreakdown.totalAmount || 0,
          discountAmount: booking.fareBreakdown.discount    || 0,
        } : null,
        actionLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`,
        newStatus,
      }),
    });
  } catch (e) { console.error('[emailCustomerStatusUpdate]', e.message); }
};

const emailDriverAssigned = async ({ driverUser, booking, verb = 'assigned' }) => {
  try {
    if (!driverUser?.email) return;
    await sendEmail({
      email:   driverUser.email,
      subject: `Ride ${verb} — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'RIDE ASSIGNMENT',
        title:      `Booking #${booking.bookingCode} has been ${verb} to you`,
        body:       `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                     <b>Pickup:</b> ${booking.patientLocation?.address || 'N/A'}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/driver/rides`,
        buttonText: 'View Ride',
      }),
    });
  } catch (e) { console.error('[emailDriverAssigned]', e.message); }
};

const emailCareAssistantAssigned = async ({ caUser, caName, booking, verb = 'assigned' }) => {
  try {
    if (!caUser?.email) return;
    await sendEmail({
      email:   caUser.email,
      subject: `Care Request ${verb} — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'CARE ASSIGNMENT',
        title:      `Booking #${booking.bookingCode} has been ${verb} to you`,
        body:       `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/>
                     <b>Location:</b> ${booking.patientLocation?.address || 'N/A'}<br/>
                     <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/care/bookings`,
        buttonText: 'View Booking',
      }),
    });
  } catch (e) { console.error('[emailCareAssistantAssigned]', e.message); }
};

const emailHospitalBookingUpdate = async ({ hospitalUser, booking, subject, body }) => {
  try {
    if (!hospitalUser?.email) return;
    await sendEmail({
      email:   hospitalUser.email,
      subject: subject || `Booking #${booking.bookingCode} Update | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'HOSPITAL NOTIFICATION',
        title:      subject || `Booking #${booking.bookingCode} Update`,
        body,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/hospital/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    });
  } catch (e) { console.error('[emailHospitalBookingUpdate]', e.message); }
};

const emailDoctorBookingUpdate = async ({ doctorUser, booking, subject, body }) => {
  try {
    if (!doctorUser?.email) return;
    await sendEmail({
      email:   doctorUser.email,
      subject: subject || `Booking #${booking.bookingCode} Update | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'DOCTOR NOTIFICATION',
        title:      subject || `Booking #${booking.bookingCode} Update`,
        body,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/doctor/ops`,
        buttonText: 'View OP Records',
      }),
    });
  } catch (e) { console.error('[emailDoctorBookingUpdate]', e.message); }
};

// ═════════════════════════════════════════════════════════════════════════════
// CONSULTATION ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/consultations/:bookingId',
  protect,
  cache(CACHE_TTL.consultations, req => `GET:/consultations/${req.params.bookingId}:${req.user._id}`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.bookingId)
        .select('customer doctor consultationSessionId bookingCode').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      const role = req.user.role;
      if (role === 'customer' && String(booking.customer) !== String(req.user._id))
        return res.status(403).json({ success: false, message: 'Access denied' });
      if (role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || String(booking.doctor) !== String(dp._id))
          return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (!booking.consultationSessionId)
        return res.status(404).json({ success: false, message: 'No consultation session linked' });

      const consultation = await Consultation.findById(booking.consultationSessionId)
        .populate('patient', 'name phone email')
        .populate({ path: 'doctor', populate: { path: 'user', select: 'name phone email' } })
        .populate('hospital', 'name address contact').lean();
      if (!consultation)
        return res.status(404).json({ success: false, message: 'Consultation not found' });

      return res.json({ success: true, data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/consultations/:consultationId/confirm',
  protect, authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { consentAccepted = false } = req.body;
      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });

      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || String(consultation.doctor) !== String(dp._id))
          return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (['completed', 'cancelled', 'failed'].includes(consultation.status))
        return res.status(400).json({ success: false, message: `Cannot confirm in status: ${consultation.status}` });

      if (consentAccepted) {
        const existing = consultation.consents?.find(c => c.consentType === 'telemedicine');
        if (!existing) consultation.consents.push({ consentType: 'telemedicine', accepted: true, acceptedAt: new Date(), consentVersion: '1.0' });
        consultation.telemedicineConsentAccepted = true;
      }
      consultation.status            = 'scheduled';
      consultation.consultationStage = 'pre_consultation';
      consultation.updatedBy         = req.user._id;
      await consultation.save();

      const booking = await Booking.findById(consultation.bookingId).lean();
      if (booking && booking.status === 'pending')
        await Booking.findByIdAndUpdate(booking._id, { $set: { status: 'confirmed', updatedBy: req.user._id } });

      if (booking) createOrSendOpOnConfirmation({ booking: { ...booking, status: 'confirmed' }, triggeredBy: req.user.role }).catch(() => {});

      await createNotification({ recipient: consultation.patient, title: 'Consultation Confirmed', body: 'Your consultation is confirmed. Check email for OP card.', type: 'Booking_Confirmed', bookingId: consultation.bookingId });

      const patient = await User.findById(consultation.patient).select('email name phone').lean();
      if (patient?.email) {
        sendEmail({
          email:   patient.email,
          subject: 'Consultation Confirmed | Likeson Healthcare',
          html:    transactionalTemplate({
            header: 'CONSULTATION CONFIRMED', title: 'Your consultation has been confirmed',
            body:   `<b>Booking:</b> #${booking?.bookingCode || 'N/A'}<br/><b>Doctor:</b> ${booking?.doctorSnapshot?.name || 'Your Doctor'}<br/><b>Scheduled:</b> ${new Date(consultation.scheduledStartTime).toLocaleString('en-IN')}<br/><b>Type:</b> ${consultation.consultationType}<br/>OP card is in a separate email.`,
            buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${consultation.bookingId}`,
            buttonText: 'View Booking',
          }),
        }).catch(() => {});
      }

      const doctorProfile = await DoctorProfile.findById(consultation.doctor).populate('user', 'name email').lean();
      if (doctorProfile?.user?.email) {
        emailDoctorBookingUpdate({
          doctorUser: doctorProfile.user,
          booking:    booking || { bookingCode: 'N/A', _id: consultation.bookingId, scheduledAt: consultation.scheduledStartTime, patientInfo: {} },
          subject:    'Consultation Confirmed | Likeson Healthcare',
          body:       `<b>Patient:</b> ${patient?.name || 'N/A'}<br/><b>Scheduled:</b> ${new Date(consultation.scheduledStartTime).toLocaleString('en-IN')}<br/><b>Type:</b> ${consultation.consultationType}`,
        }).catch(() => {});
      }

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'consultation_confirmed', { consultationId: consultation._id, status: 'scheduled', timestamp: new Date() });
      await invalidateBookingCache();
      return res.json({ success: true, message: 'Consultation confirmed and OP sent', data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/consultations/:consultationId/accept',
  protect, authorize('doctor'),
  async (req, res) => {
    try {
      const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

      const consultation = await Consultation.findOne({ _id: req.params.consultationId, doctor: dp._id });
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found or not assigned to you' });
      if (!['created', 'scheduled'].includes(consultation.status))
        return res.status(400).json({ success: false, message: `Cannot accept in status: ${consultation.status}` });

      consultation.status            = 'waiting';
      consultation.consultationStage = 'waiting_room';
      consultation.updatedBy         = req.user._id;
      await consultation.save();

      const booking = await Booking.findById(consultation.bookingId);
      if (booking && booking.status === 'pending') {
        booking.status    = 'confirmed';
        booking.updatedBy = req.user._id;
        await booking.save();
      }
      if (booking) createOrSendOpOnConfirmation({ booking: booking.toObject ? booking.toObject() : booking, triggeredBy: 'doctor' }).catch(() => {});

      const patient = await User.findById(consultation.patient).select('email name phone').lean();
      await createNotification({ recipient: consultation.patient, title: 'Doctor Accepted', body: 'Your doctor accepted. OP card sent to email.', type: 'Booking_Confirmed', bookingId: consultation.bookingId });
      if (patient?.email) {
        sendEmail({
          email: patient.email, subject: 'Doctor Accepted Your Consultation | Likeson Healthcare',
          html: transactionalTemplate({
            header: 'DOCTOR ACCEPTED', title: 'Your doctor accepted your consultation request',
            body: `<b>Booking:</b> #${booking?.bookingCode || 'N/A'}<br/><b>Scheduled:</b> ${new Date(consultation.scheduledStartTime).toLocaleString('en-IN')}`,
            buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${consultation.bookingId}`, buttonText: 'Join Waiting Room',
          }),
        }).catch(() => {});
      }

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'consultation_accepted', { consultationId: consultation._id, status: 'waiting', timestamp: new Date() });
      await invalidateBookingCache();
      return res.json({ success: true, message: 'Consultation accepted. Patient notified.', data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/consultations/:consultationId/start',
  protect, authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });
      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || String(consultation.doctor) !== String(dp._id))
          return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (consultation.status !== 'waiting')
        return res.status(400).json({ success: false, message: `Must be in waiting status. Current: ${consultation.status}` });
      if (!consultation.telemedicineConsentAccepted)
        return res.status(400).json({ success: false, message: 'Telemedicine consent required before starting' });

      consultation.status            = 'active';
      consultation.consultationStage = 'in_progress';
      consultation.actualStartTime   = new Date();
      consultation.roomStarted       = true;
      consultation.doctorJoinedAt    = new Date();
      consultation.updatedBy         = req.user._id;
      await consultation.save();

      await Booking.findByIdAndUpdate(consultation.bookingId, { $set: { status: 'in_progress', updatedBy: req.user._id } });
      await createNotification({ recipient: consultation.patient, title: 'Consultation Started', body: 'Your consultation started. Join now.', type: 'Care_Task_Started', bookingId: consultation.bookingId });

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'consultation_started', { consultationId: consultation._id, meetingId: consultation.meetingId, roomId: consultation.roomId, consultationType: consultation.consultationType, timestamp: new Date() });
      await invalidateBookingCache();
      return res.json({ success: true, message: 'Consultation started', data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/consultations/:consultationId/end',
  protect, authorize('doctor', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { reason, prescriptionUploaded = false } = req.body;
      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });
      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp || String(consultation.doctor) !== String(dp._id))
          return res.status(403).json({ success: false, message: 'Access denied' });
      }
      if (!['active', 'paused'].includes(consultation.status))
        return res.status(400).json({ success: false, message: `Can only end active/paused. Current: ${consultation.status}` });

      consultation.status               = 'completed';
      consultation.actualEndTime        = new Date();
      consultation.roomEnded            = true;
      consultation.patientLeftAt        = new Date();
      consultation.doctorLeftAt         = new Date();
      consultation.prescriptionUploaded = prescriptionUploaded;
      consultation.endedBy              = req.user.role === 'doctor' ? 'doctor' : 'admin';
      consultation.endedByUserId        = req.user._id;
      consultation.endedReason          = reason || null;
      consultation.updatedBy            = req.user._id;
      if (consultation.actualStartTime) {
        const diffMs = consultation.actualEndTime - consultation.actualStartTime;
        consultation.actualDurationMinutes = Math.round(diffMs / 60000);
      }
await consultation.save();
      await Booking.findByIdAndUpdate(consultation.bookingId, { $set: { status: 'completed', updatedBy: req.user._id } });

      // findByIdAndUpdate bypasses Booking.js post-save hook — allocation
      // creation never fires from that hook here. Call explicitly.
      try {
        const created = await createAllocationsForBooking(consultation.bookingId);
        console.log(`[consultations/end] allocations created: ${created.length} for booking ${consultation.bookingId}`);
      } catch (allocErr) {
        console.error('[consultations/end] allocation creation failed:', allocErr.message);
      }

      const booking   = await Booking.findById(consultation.bookingId).lean();
      const patient   = await User.findById(consultation.patient).select('email name phone').lean();
      if (booking) {
        const op      = await OutPatientRecord.findOne({ booking: booking._id }).lean();
        const followUps = op ? await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean() : [];
        if (op && patient?.email) sendOpZipEmail({ op, booking, patient, followUps });
      }

      await createNotification({ recipient: consultation.patient, title: 'Consultation Completed', body: 'Consultation ended. Check email for prescription and OP card.', type: 'Care_Task_Completed', bookingId: consultation.bookingId });
      if (patient?.email) {
        sendEmail({
          email: patient.email, subject: 'Consultation Completed | Likeson Healthcare',
          html: transactionalTemplate({
            header: 'CONSULTATION COMPLETE', title: 'Your consultation ended',
            body: `<b>Duration:</b> ${consultation.actualDurationMinutes || 0} mins<br/><b>Prescription:</b> ${prescriptionUploaded ? 'Uploaded — check email' : 'Pending'}`,
            buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${consultation.bookingId}/rate`, buttonText: 'Rate Experience',
          }),
        }).catch(() => {});
      }

      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'consultation_ended', { consultationId: consultation._id, status: 'completed', actualDurationMinutes: consultation.actualDurationMinutes, timestamp: new Date() });
      await invalidateBookingCache();
      return res.json({ success: true, message: 'Consultation ended', data: { consultation } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/consultations/:consultationId/consent',
  protect,
  async (req, res) => {
    try {
      const { consentType = 'telemedicine', accepted = true } = req.body;
      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });
      if (req.user.role === 'customer' && String(consultation.patient) !== String(req.user._id))
        return res.status(403).json({ success: false, message: 'Access denied' });

      const existing = consultation.consents?.findIndex(c => c.consentType === consentType);
      const entry = { consentType, accepted, acceptedAt: accepted ? new Date() : undefined, consentVersion: '1.0' };
      if (existing >= 0) consultation.consents[existing] = { ...consultation.consents[existing], ...entry };
      else consultation.consents.push(entry);

      if (consentType === 'telemedicine') consultation.telemedicineConsentAccepted = accepted;
      if (consentType === 'recording')    consultation.recordingConsentAccepted    = accepted;
      consultation.updatedBy = req.user._id;
      await consultation.save();

      return res.json({ success: true, message: `Consent '${consentType}' recorded`, data: { consentType, accepted } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.post('/consultations/:consultationId/chat',
  protect,
  async (req, res) => {
    try {
      const { message, messageType = 'text' } = req.body;
      if (!message?.trim()) return res.status(400).json({ success: false, message: 'message required' });

      const consultation = await Consultation.findById(req.params.consultationId);
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });
      if (!consultation.chatEnabled) return res.status(400).json({ success: false, message: 'Chat disabled' });

      let senderRole = 'patient';
      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (dp && String(consultation.doctor) === String(dp._id)) senderRole = 'doctor';
      } else if (['admin', 'superadmin'].includes(req.user.role)) senderRole = 'admin';
      else if (req.user.role === 'care_assistant') senderRole = 'care_assistant';

      consultation.chatMessages.push({ sender: req.user._id, senderRole, messageType, message: message.trim(), attachments: [] });
      consultation.updatedBy = req.user._id;
      await consultation.save();

      const saved = consultation.chatMessages[consultation.chatMessages.length - 1];
      getBookingSocketService()?.emitToRoom(`booking:${consultation.bookingId}`, 'chat_message', { consultationId: consultation._id, message: saved });
      return res.json({ success: true, data: { message: saved } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/consultations/:consultationId/join-token',
  protect,
  async (req, res) => {
    try {
      const consultation = await Consultation.findById(req.params.consultationId)
        .select('roomId meetingId provider status patient doctor').lean();
      if (!consultation) return res.status(404).json({ success: false, message: 'Consultation not found' });
      if (!['scheduled', 'waiting', 'active'].includes(consultation.status))
        return res.status(400).json({ success: false, message: `Cannot join in status: ${consultation.status}` });
      if (!consultation.roomId)
        return res.status(400).json({ success: false, message: 'Room not configured yet' });

      const { generateAgoraToken } = await import('../services/agoraService.js');
      let role = 'patient';
      if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (dp && String(consultation.doctor) === String(dp._id)) role = 'doctor';
      }
      const token = generateAgoraToken(consultation.roomId, role === 'doctor' ? 'host' : 'participant', 0, 7200);
      return res.json({ success: true, data: { token, role, uid: 0, channelName: consultation.roomId, roomId: consultation.roomId, meetingId: consultation.meetingId, consultationType: consultation.consultationType, provider: consultation.provider ?? 'Agora', appId: process.env.AGORAIO_APP_ID, expiresInSeconds: 7200 } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// TRANSPORT PARTNER ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/tp/assigned',
  protect, authorize('transportpartner'),
  cache(CACHE_TTL.ops, req => `GET:/tp/assigned:${req.user._id}`),
  async (req, res) => {
    try {
      const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
      if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });
      const bookings = await Booking.find({ transportPartner: tp._id })
        .select('bookingCode bookingType scheduledAt patientInfo status fareBreakdown primaryRide patientLocation destinationLocation doctor hospital')
        .populate('customer', 'name phone email')
        .populate({ path: 'doctor', select: 'specialization registrationNumber', populate: { path: 'user', select: 'name phone' } })
        .populate('hospital', 'name address contact')
        .populate('primaryRide', 'status driver driverSnapshot vehicleSnapshot estimatedDistanceKm estimatedDurationMin')
        .sort({ scheduledAt: -1 }).lean();
      return res.json({ success: true, data: { bookings } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/tp/drivers/available', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });
    const drivers = await Driver.find({ ownerAgency: tp._id, status: 'Available', isActive: true, isVerified: true, isBlocked: false })
      .select('legalName phone driverCode assignedVehicleSnapshot performance.rating status location kyc.licenceClass')
      .populate('user', 'name phone email')
      .sort({ 'performance.rating': -1, legalName: 1 }).lean();
    return res.json({ success: true, data: { drivers } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/tp/assign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ success: false, message: 'driverId required' });

    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id businessName').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });

    const driver = await Driver.findOne({ _id: driverId, ownerAgency: tp._id }).lean();
    if (!driver) return res.status(403).json({ success: false, message: 'Driver not in your fleet' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.transportPartner || String(booking.transportPartner) !== String(tp._id))
      return res.status(403).json({ success: false, message: 'Booking not assigned to your fleet' });

    await Ride.updateMany(
      { booking: booking._id, status: { $in: ['requested', 'searching'] } },
      { status: 'cancelled', 'cancellation.cancelledBy': 'system', 'cancellation.cancelledAt': new Date() }
    );

    const coords = getBookingCoords(booking);
    const otp    = genOtp();
    const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(coords.pickupCoords, coords.dropoffCoords);

    // Create initial RouteVersion
    const ride = await Ride.create({
      ...buildRidePayload({ bookingId: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler', scheduledPickupAt: booking.scheduledAt, ...coords, createdBy: req.user._id }),
      driver:               driverId,
      transportPartner:     tp._id,
      status:               'driver_assigned',
      estimatedDistanceKm:  distanceKm,
      estimatedDurationMin: durationMin,
    });

    const rv = await RouteVersion.create({ ride: ride._id, versionNumber: 1, polyline, totalDistanceKm: distanceKm, totalDurationMin: durationMin, generatedReason: 'INITIAL', isActive: true });

    // Create initial stops
    const patientStop = await RideStop.create({ ride: ride._id, booking: booking._id, routeVersion: 1, sequence: 1, stopType: 'PATIENT_PICKUP', location: { type: 'Point', coordinates: coords.pickupCoords, address: coords.pickupAddress }, status: 'PENDING', otp: { code: hashOtp(otp) } });
    const hospitalStop = await RideStop.create({ ride: ride._id, booking: booking._id, routeVersion: 1, sequence: 2, stopType: 'HOSPITAL', location: { type: 'Point', coordinates: coords.dropoffCoords, address: coords.dropoffAddress }, status: 'PENDING' });

    await Ride.findByIdAndUpdate(ride._id, { $set: { currentStopId: patientStop._id, activeRouteVersionId: rv._id } });
    await RouteVersion.findByIdAndUpdate(rv._id, { $set: { stops: [patientStop._id, hospitalStop._id] } });

    const tracking = await RideTracking.create({ ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline, currentStopId: patientStop._id });
    await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });

    await Booking.findByIdAndUpdate(booking._id, { $push: { rides: ride._id }, $set: { primaryRide: ride._id, transportPartner: tp._id, status: 'confirmed', updatedBy: req.user._id } });

    // AssignmentHistory
    await AssignmentHistory.create({ ride: ride._id, booking: booking._id, assignmentType: 'DRIVER', entityRefModel: 'Driver', entityRefId: driverId, action: 'ASSIGNED', performedBy: req.user._id, effectiveAt: new Date() });

    const driverUser = await User.findById(driver.user).select('email phone name').lean();
    const customer   = await User.findById(booking.customer).select('email phone name').lean();

    await createNotification({ recipient: driver.user, title: 'New Ride Assigned', body: `Booking #${booking.bookingCode} assigned.`, type: 'Ride_Request', bookingId: booking._id, priority: 'High' });
    emailDriverAssigned({ driverUser, booking }).catch(() => {});

    sendEmail({
      email: customer?.email,
      subject: `Driver Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header: 'DRIVER ASSIGNED', title: `Driver confirmed for #${booking.bookingCode}`,
        body: `<b>Driver:</b> ${driverUser?.name || 'N/A'}<br/><b>Phone:</b> ${driverUser?.phone || 'N/A'}<br/><b>Vehicle:</b> ${driver.assignedVehicleSnapshot?.registrationNumber || 'N/A'}<br/><b>Est. Distance:</b> ${distanceKm} km`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'Track Booking',
      }),
    }).catch(() => {});

    sendSms({ to: driverUser.phone, message: `Hi ${driverUser.name}, new ride: Booking #${booking.bookingCode}. Check Likeson Driver app.` }).catch(() => {});
    joinBookingRoom(driver.user, booking._id);

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'driver_assigned', {
      bookingId: booking._id, driverName: driverUser.name, driverPhone: driverUser.phone, vehicle: driver.assignedVehicleSnapshot,
      mapRoute: { polyline, pickupCoords: coords.pickupCoords, pickupAddress: coords.pickupAddress, dropoffCoords: coords.dropoffCoords, dropoffAddress: coords.dropoffAddress, estimatedDistKm: distanceKm, estimatedMinutes: durationMin, currentTarget: 'pickup' },
    });

    await SystemLog.createLog({ level: 'success', category: 'api', message: `TP ${tp.businessName || tp._id} assigned driver to #${booking.bookingCode}`, actor: { userId: req.user._id, role: req.user.role }, relatedEntity: { model: 'Booking', entityId: booking._id }, metadata: { driverId } }).catch(() => {});
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Driver assigned', data: { ride, driverInfo: { name: driverUser.name, phone: driverUser.phone, vehicleNumber: driver.assignedVehicleSnapshot?.registrationNumber }, mapRoute: { estimatedDistKm: distanceKm, estimatedMinutes: durationMin } } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/tp/reassign-driver', protect, authorize('transportpartner'), async (req, res) => {
  try {
    const { newDriverId } = req.body;
    if (!newDriverId) return res.status(400).json({ success: false, message: 'newDriverId required' });

    const tp = await TransportPartner.findOne({ user: req.user._id }).select('_id').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'Transport partner not found' });
    const driver = await Driver.findOne({ _id: newDriverId, ownerAgency: tp._id }).lean();
    if (!driver) return res.status(403).json({ success: false, message: 'Driver not in your fleet' });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!booking.transportPartner || String(booking.transportPartner) !== String(tp._id))
      return res.status(403).json({ success: false, message: 'Booking not assigned to your fleet' });

    // Find active ride, use replaceDriver static
    const activeRide = await Ride.findOne({ booking: booking._id, status: { $in: ['driver_assigned', 'driver_accepted'] } });
    if (activeRide) {
      const prevDriverId = activeRide.driver;
      await Ride.replaceDriver(activeRide._id, newDriverId, { reason: 'TP reassignment', performedBy: req.user._id });
      await AssignmentHistory.create({
        ride: activeRide._id, booking: booking._id, assignmentType: 'DRIVER',
        entityRefModel: 'Driver', entityRefId: newDriverId, action: 'REPLACED',
        previousAssignmentId: null, performedBy: req.user._id, reason: 'TP reassigned driver', effectiveAt: new Date(),
      });
    } else {
      // No active ride — create new
      await Ride.updateMany({ booking: booking._id, status: { $in: ['driver_assigned', 'driver_accepted'] } }, { status: 'cancelled', 'cancellation.cancelledBy': 'system', 'cancellation.cancelledAt': new Date() });
      const coords = getBookingCoords(booking);
      const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(coords.pickupCoords, coords.dropoffCoords);
      const ride = await Ride.create({
        ...buildRidePayload({ bookingId: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler', scheduledPickupAt: booking.scheduledAt, ...coords, createdBy: req.user._id }),
        driver: newDriverId, transportPartner: tp._id, status: 'driver_assigned', estimatedDistanceKm: distanceKm, estimatedDurationMin: durationMin,
      });
      const rv = await RouteVersion.create({ ride: ride._id, versionNumber: 1, polyline, totalDistanceKm: distanceKm, totalDurationMin: durationMin, generatedReason: 'INITIAL', isActive: true });
      const patStop = await RideStop.create({ ride: ride._id, booking: booking._id, routeVersion: 1, sequence: 1, stopType: 'PATIENT_PICKUP', location: { type: 'Point', coordinates: coords.pickupCoords, address: coords.pickupAddress }, status: 'PENDING' });
      const hospStop = await RideStop.create({ ride: ride._id, booking: booking._id, routeVersion: 1, sequence: 2, stopType: 'HOSPITAL', location: { type: 'Point', coordinates: coords.dropoffCoords, address: coords.dropoffAddress }, status: 'PENDING' });
      await Ride.findByIdAndUpdate(ride._id, { $set: { currentStopId: patStop._id, activeRouteVersionId: rv._id } });
      await RouteVersion.findByIdAndUpdate(rv._id, { $set: { stops: [patStop._id, hospStop._id] } });
      const tracking = await RideTracking.create({ ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline, currentStopId: patStop._id });
      await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
      await Booking.findByIdAndUpdate(booking._id, { $push: { rides: ride._id }, $set: { primaryRide: ride._id, updatedBy: req.user._id } });
      await AssignmentHistory.create({ ride: ride._id, booking: booking._id, assignmentType: 'DRIVER', entityRefModel: 'Driver', entityRefId: newDriverId, action: 'ASSIGNED', performedBy: req.user._id, effectiveAt: new Date() });
    }

    const driverUser = await User.findById(driver.user).select('email phone name').lean();
    const customer   = await User.findById(booking.customer).select('email phone name').lean();
    await createNotification({ recipient: driver.user, title: 'Ride Assigned', body: `Booking #${booking.bookingCode} assigned.`, type: 'Ride_Request', bookingId: booking._id });
    emailDriverAssigned({ driverUser, booking, verb: 'reassigned' }).catch(() => {});
    sendEmail({
      email: customer?.email,
      subject: `Driver Updated — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header: 'DRIVER UPDATED', title: `Driver updated for #${booking.bookingCode}`,
        body: `<b>New Driver:</b> ${driverUser?.name || 'N/A'}<br/><b>Phone:</b> ${driverUser?.phone || 'N/A'}<br/><b>Vehicle:</b> ${driver.assignedVehicleSnapshot?.registrationNumber || 'N/A'}`,
        buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'Track Booking',
      }),
    }).catch(() => {});
    joinBookingRoom(driver.user, booking._id);
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Driver reassigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// CARE ASSISTANT ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/care/assigned',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });
      const bookings = await Booking.find({ careAssistant: profile._id })
        .select('bookingCode bookingType scheduledAt patientInfo status patientLocation careAssistantSnapshot fareBreakdown doctor hospital primaryRide')
        .populate('customer', 'name phone email')
        .populate({ path: 'doctor', select: 'specialization registrationNumber', populate: { path: 'user', select: 'name phone' } })
        .populate('hospital', 'name address contact')
        .sort({ scheduledAt: -1 }).lean();
      return res.json({ success: true, data: { bookings } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/arrived',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });
      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });

      booking.statusLog.push({ fromStatus: booking.status, toStatus: booking.status, changedBy: req.user._id, reason: 'Care assistant arrived at pickup' });
      booking.updatedBy = req.user._id;
      await booking.save();

      const customer = await User.findById(booking.customer).select('email phone name').lean();
      await createNotification({ recipient: booking.customer, title: 'Care Assistant Arrived', body: 'Your care assistant arrived at pickup.', type: 'Care_Assistant_Arriving', bookingId: booking._id });
      sendEmail({ email: customer?.email, subject: `Care Assistant Arrived — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'CARE ASSISTANT UPDATE', title: 'Your care assistant arrived', body: `Care assistant is at your pickup for Booking <b>#${booking.bookingCode}</b>.`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'View Booking' }) }).catch(() => {});
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_arrived', { bookingId: booking._id });
      return res.json({ success: true, message: 'Arrival marked' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/start',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });
      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (booking.status !== 'confirmed') return res.status(400).json({ success: false, message: `Cannot start in status: ${booking.status}` });

      booking.status = 'in_progress';
      booking.statusLog.push({ fromStatus: 'confirmed', toStatus: 'in_progress', changedBy: req.user._id, reason: 'Care assistant started task' });
      booking.updatedBy = req.user._id;
      await booking.save();

      const customer = await User.findById(booking.customer).select('email phone name').lean();
      await createNotification({ recipient: booking.customer, title: 'Care Task Started', body: 'Your care assistant started the task.', type: 'Care_Task_Started', bookingId: booking._id });
      sendEmail({ email: customer?.email, subject: `Care Task Started — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'CARE UPDATE', title: 'Care task started', body: `Care assistant began task for Booking <b>#${booking.bookingCode}</b>.`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'View Booking' }) }).catch(() => {});
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', { bookingId: booking._id, status: 'in_progress', timestamp: new Date() });
      await invalidateBookingCache();
      return res.json({ success: true, message: 'Task started' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/complete',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });
      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id });
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (booking.status !== 'in_progress') return res.status(400).json({ success: false, message: `Cannot complete in status: ${booking.status}` });

booking.status = 'completed';
      booking.statusLog.push({ fromStatus: 'in_progress', toStatus: 'completed', changedBy: req.user._id, reason: 'Care assistant completed task' });
      booking.updatedBy = req.user._id;
      await booking.save();

      // Explicit call — don't rely solely on the model hook.
      try {
        const created = await createAllocationsForBooking(booking._id);
        console.log(`[care/complete] allocations created: ${created.length} for booking ${booking._id}`);
      } catch (allocErr) {
        console.error('[care/complete] allocation creation failed:', allocErr.message);
      }

      const customer = await User.findById(booking.customer).select('email phone name').lean();
      await createNotification({ recipient: booking.customer, title: 'Care Task Completed', body: 'Care assistant completed the task.', type: 'Care_Task_Completed', bookingId: booking._id });
      sendEmail({ email: customer?.email, subject: `Care Task Completed — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'CARE COMPLETED', title: 'Care task complete', body: `Care assistant completed task for Booking <b>#${booking.bookingCode}</b>.`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}/rate`, buttonText: 'Rate Experience' }) }).catch(() => {});
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_completed', { bookingId: booking._id });
      await invalidateBookingCache();
      return res.json({ success: true, message: 'Task completed' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/care/location',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { lat, lng, heading, speed, bookingId, status } = req.body;
      if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat, lng required' });

      const profile = await CareAssistantProfile.findOneAndUpdate(
        { user: req.user._id },
        { 'location.coordinates': [lng, lat], 'location.updatedAt': new Date() },
        { new: true }
      ).select('_id').lean();

      let activeRide = null;
      if (bookingId) {
        activeRide = await Ride.findOne({ booking: bookingId, status: { $in: ['driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived', 'otp_verified', 'in_progress', 'at_stop'] } }).select('_id').lean();

        if (activeRide) {
          // Find active RideParticipant for this CA
          const caPart = await RideParticipant.findOne({ ride: activeRide._id, role: 'CARE_ASSISTANT', isActive: true, refId: profile._id }).select('_id').lean();
          if (caPart) {
            await RideTracking.updateParticipantLocation(activeRide._id, caPart._id, { coordinates: [lng, lat], heading, speedKmh: speed, source: 'gps' }).catch(() => {});
            if (status) await RideTracking.updateParticipantStatus(activeRide._id, caPart._id, status).catch(() => {});
          }
        }

        getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'care_assistant_location_update', { lat, lng, heading, speed: speed ?? 0, role: 'care_assistant', careAssistantId: profile?._id, status: status ?? null, updatedAt: new Date(), rideId: activeRide?._id ?? null });
      }

      return res.json({ success: true });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT — RIDE SESSION PARTICIPATION
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:id/care/join-ride',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { currentLat, currentLng } = req.body;
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id fullName').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id }).select('_id bookingCode customer primaryRide status').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not assigned to you' });
      if (!booking.primaryRide) return res.status(400).json({ success: false, message: 'No active ride on this booking yet' });

      const ride = await Ride.findById(booking.primaryRide).select('_id status trackingId currentStopId').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

      const activeMidwayStatuses = ['driver_assigned', 'driver_accepted', 'driver_en_route', 'driver_arrived', 'otp_verified', 'in_progress', 'at_stop'];
      if (!activeMidwayStatuses.includes(ride.status))
        return res.status(400).json({ success: false, message: `Cannot join ride in status: ${ride.status}` });

      // Mark CARE_ASSISTANT_JOIN RideStop completed
      await RideStop.findOneAndUpdate(
        { ride: booking.primaryRide, stopType: 'CARE_ASSISTANT_JOIN', status: { $in: ['PENDING', 'ARRIVED'] }, isActive: true },
        { $set: { status: 'COMPLETED', 'departure.actualAt': new Date() } }
      );

      // Update RideParticipant
      const caPart = await RideParticipant.findOne({ ride: booking.primaryRide, role: 'CARE_ASSISTANT', isActive: true }).select('_id').lean();
      if (caPart) {
        await RideParticipant.findByIdAndUpdate(caPart._id, { $set: { status: 'IN_VEHICLE', joinedAt: new Date(), joinMode: 'IN_VEHICLE_AFTER_PATIENT' } });

        // Update JoinPoint
        await JoinPoint.findOneAndUpdate(
          { ride: booking.primaryRide, participant: caPart._id, status: 'LOCKED', isActive: true },
          { $set: { status: 'COMPLETED', completedAt: new Date(), joinMode: 'IN_VEHICLE_AFTER_PATIENT' } }
        );

        // Update RideTracking participant
        await RideTracking.updateParticipantStatus(booking.primaryRide, caPart._id, 'IN_VEHICLE').catch(() => {});
        await RideTracking.findOneAndUpdate({ ride: booking.primaryRide }, { $set: { 'liveRouteContext.careAssistantJoinedAt': new Date() } });

        if (currentLat && currentLng) {
          await RideTracking.updateParticipantLocation(booking.primaryRide, caPart._id, { coordinates: [currentLng, currentLat], source: 'gps' }).catch(() => {});
        }
      }

      // Advance currentStopId to next pending stop
      const nextStop = await RideStop.findOne({ ride: booking.primaryRide, isActive: true, status: 'PENDING' }).sort({ sequence: 1 }).lean();
      if (nextStop) {
        await Ride.findByIdAndUpdate(booking.primaryRide, { $set: { currentStopId: nextStop._id } });
        await RideTracking.findOneAndUpdate({ ride: booking.primaryRide }, { $set: { currentStopId: nextStop._id } });
      }

      if (currentLat && currentLng) {
        await CareAssistantProfile.findByIdAndUpdate(profile._id, { 'location.coordinates': [currentLng, currentLat], 'location.updatedAt': new Date() });
      }

      getBookingSocketService()?.emitJoinRoom(String(req.user._id), `booking:${booking._id}`);
      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_joined_ride', { bookingId: booking._id, rideId: ride._id, careAssistantId: profile._id, careAssistantName: profile.fullName, joinedAt: new Date(), currentLocation: (currentLat && currentLng) ? { lat: currentLat, lng: currentLng } : null, rideStatus: ride.status });

      await createNotification({ recipient: booking.customer, title: 'Care Assistant Joined', body: `${profile.fullName} joined your ride.`, type: 'Care_Assistant_Assigned', bookingId: booking._id });

      RideTracking.addMilestone(booking.primaryRide, 'care_assistant_joined', { coordinates: currentLat && currentLng ? [currentLng, currentLat] : null, meta: { careAssistantId: profile._id }, recordedBy: 'driver', recordedByUserId: req.user._id }).catch(() => {});

      return res.json({ success: true, message: 'Joined ride successfully', data: { rideId: ride._id, bookingId: booking._id, careAssistantStatus: 'in_ride', socketRoom: `booking:${booking._id}`, socketEvents: ['care_assistant_location_update', 'care_assistant_status_change'] } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/reached-jp',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id fullName').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });

      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id }).select('_id customer primaryRide').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (!booking.primaryRide) return res.status(400).json({ success: false, message: 'No active ride' });

      const caPart = await RideParticipant.findOne({ ride: booking.primaryRide, role: 'CARE_ASSISTANT', isActive: true }).select('_id').lean();
      if (caPart) {
        await RideTracking.updateParticipantStatus(booking.primaryRide, caPart._id, 'AT_JOIN_POINT').catch(() => {});
        if (lat && lng) await RideTracking.updateParticipantLocation(booking.primaryRide, caPart._id, { coordinates: [lng, lat], source: 'gps' }).catch(() => {});

        await JoinPoint.findOneAndUpdate(
          { ride: booking.primaryRide, participant: caPart._id, status: 'LOCKED', isActive: true },
          { $set: { status: 'ARRIVED', arrivedAt: new Date() } }
        );
        await RideStop.findOneAndUpdate(
          { ride: booking.primaryRide, stopType: 'CARE_ASSISTANT_JOIN', status: 'PENDING', isActive: true },
          { $set: { status: 'ARRIVED', 'arrival.actualAt': new Date() } }
        );
        await RideParticipant.findByIdAndUpdate(caPart._id, { $set: { status: 'AT_JOIN_POINT' } });
      }

      RideTracking.addMilestone(booking.primaryRide, 'care_assistant_joined', { coordinates: lat && lng ? [lng, lat] : null, meta: { careAssistantId: profile._id, status: 'at_join_point' }, recordedBy: 'driver', recordedByUserId: req.user._id }).catch(() => {});

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_status_change', { bookingId: booking._id, rideId: booking.primaryRide, careAssistantId: profile._id, careAssistantName: profile.fullName, careAssistantStatus: 'AT_JOIN_POINT', location: (lat && lng) ? { lat, lng } : null, timestamp: new Date() });

      await createNotification({ recipient: booking.customer, title: 'Care Assistant Arrived', body: `${profile.fullName} arrived at join point.`, type: 'Care_Assistant_Arriving', bookingId: booking._id });
      return res.json({ success: true, message: 'Status updated to AT_JOIN_POINT', data: { status: 'AT_JOIN_POINT' } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/care/ride-status',
  protect, authorize('care_assistant'),
  async (req, res) => {
    try {
      const { status, lat, lng } = req.body;
      const validStatuses = ['en_route_to_pickup', 'at_pickup', 'in_ride', 'departed'];
      if (!status || !validStatuses.includes(status))
        return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });

      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id fullName').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Care assistant profile not found' });
      const booking = await Booking.findOne({ _id: req.params.id, careAssistant: profile._id }).select('_id customer primaryRide').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (!booking.primaryRide) return res.status(400).json({ success: false, message: 'No active ride' });

      const caPart = await RideParticipant.findOne({ ride: booking.primaryRide, role: 'CARE_ASSISTANT', isActive: true }).select('_id').lean();
      if (caPart) {
        await RideTracking.updateParticipantStatus(booking.primaryRide, caPart._id, status);
        if (lat && lng) await RideTracking.updateParticipantLocation(booking.primaryRide, caPart._id, { coordinates: [lng, lat], source: 'gps' }).catch(() => {});
      }

      const milestoneMap = { at_pickup: 'care_assistant_joined', in_ride: 'care_assistant_joined' };
      if (milestoneMap[status]) {
        RideTracking.addMilestone(booking.primaryRide, milestoneMap[status], { coordinates: lat && lng ? [lng, lat] : null, meta: { careAssistantId: profile._id, status }, recordedBy: 'driver', recordedByUserId: req.user._id }).catch(() => {});
      }

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_status_change', { bookingId: booking._id, rideId: booking.primaryRide, careAssistantId: profile._id, careAssistantName: profile.fullName, careAssistantStatus: status, location: (lat && lng) ? { lat, lng } : null, timestamp: new Date() });

      if (status === 'at_pickup') {
        await createNotification({ recipient: booking.customer, title: 'Care Assistant Arrived', body: `${profile.fullName} arrived at pickup.`, type: 'Care_Assistant_Arriving', bookingId: booking._id });
      }

      return res.json({ success: true, message: `Status updated to ${status}`, data: { status } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/:id/care/tracking-snapshot',
  protect, authorize('customer', 'admin', 'superadmin', 'care_assistant'),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('customer primaryRide careAssistant status bookingType').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (req.user.role === 'customer' && String(booking.customer) !== String(req.user._id))
        return res.status(403).json({ success: false, message: 'Access denied' });

      const isCareAssistantOnly = booking.bookingType === 'care_assistant';
      const isFullCareRide      = booking.bookingType === 'full_care_ride';

      if (!booking.primaryRide)
        return res.status(200).json({ success: true, data: { message: 'No active ride yet', hasRide: false } });

      const [ride, tracking] = await Promise.all([
        Ride.findById(booking.primaryRide)
          .select('status liveLocation driverSnapshot vehicleSnapshot pickup dropoff estimatedDistanceKm estimatedDurationMin rideStartedAt scheduledPickupAt rideStage currentStopId activeRouteVersionId').lean(),
        RideTracking.findOne({ ride: booking.primaryRide })
          .select('currentEtaMinutes currentEtaTarget hasActiveSos expectedRoutePolyline participants liveRouteContext currentStopId milestones').lean(),
      ]);
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

      // Get CA tracking from generic participants array
      const caTrackingEntry = tracking?.participants?.find(p => p.role === 'CARE_ASSISTANT' && p.isActive) ?? null;
      const careAssistantStatus = caTrackingEntry?.status ?? 'not_joined';
      const caLiveLocationRaw   = caTrackingEntry?.liveLocation ?? null;
      const caBreadcrumbCount   = caTrackingEntry?.breadcrumbCount ?? 0;
      const caJoinedAt          = caTrackingEntry?.joinedAt ?? null;

      // Get CA join stop from RideStop collection
      const caJoinStop = await RideStop.findOne({ ride: booking.primaryRide, stopType: 'CARE_ASSISTANT_JOIN', isActive: true }).lean();
      const caJoinWaypoint = caJoinStop ? {
        location: { coordinates: caJoinStop.location?.coordinates, address: caJoinStop.location?.address, label: caJoinStop.location?.label },
        isCompleted: caJoinStop.status === 'COMPLETED',
        completedAt: caJoinStop.departure?.actualAt || null,
        meta: caJoinStop.meta || {},
      } : null;

      let caSnapshot = null;
      if (booking.careAssistant) {
        const ca = await CareAssistantProfile.findById(booking.careAssistant).select('fullName phone photoUrl specializations performance.averageRating location').lean();
        if (ca) caSnapshot = { profileId: ca._id, name: ca.fullName, phone: ca.phone, photoUrl: ca.photoUrl, specializations: ca.specializations, rating: ca.performance?.averageRating, isLinkedToRide: !!caTrackingEntry, status: careAssistantStatus, joinedAt: caJoinedAt };
      }

      const fmtLoc = (loc) => {
        if (!loc?.coordinates || loc.coordinates.length !== 2) return null;
        return { lat: loc.coordinates[1], lng: loc.coordinates[0], heading: loc.heading ?? 0, speedKmh: loc.speedKmh ?? 0, updatedAt: loc.updatedAt };
      };

      if (isCareAssistantOnly) {
        return res.json({ success: true, data: {
          bookingId: booking._id, rideId: ride._id, rideStatus: ride.status, bookingType: 'care_assistant',
          careAssistant: caSnapshot ? { ...caSnapshot, liveLocation: fmtLoc(caLiveLocationRaw), breadcrumbCount: caBreadcrumbCount, destination: { coordinates: ride.dropoff?.coordinates, address: ride.dropoff?.address } } : null,
          route: { caStart: ride.pickup, patientLocation: ride.dropoff, expectedPolyline: tracking?.expectedRoutePolyline ?? null, estimatedDistanceKm: ride.estimatedDistanceKm, estimatedDurationMin: ride.estimatedDurationMin, currentEtaMinutes: tracking?.currentEtaMinutes ?? null, currentEtaTarget: tracking?.currentEtaTarget ?? null },
          driver: null, hasActiveSos: tracking?.hasActiveSos ?? false, milestones: tracking?.milestones ?? [],
          socketHint: { room: `booking:${booking._id}`, events: ['care_assistant_location_update', 'care_assistant_status_change', 'care_assistant_joined_ride', 'booking_status_change'] },
          _serverTime: new Date().toISOString(),
        }});
      }

      if (isFullCareRide) {
        return res.json({ success: true, data: {
          bookingId: booking._id, rideId: ride._id, rideStatus: ride.status, rideStage: ride.rideStage, bookingType: 'full_care_ride',
          driver: { liveLocation: fmtLoc(ride.liveLocation), snapshot: ride.driverSnapshot, vehicleSnapshot: ride.vehicleSnapshot },
          route: {
            pickup: ride.pickup, dropoff: ride.dropoff, expectedPolyline: tracking?.expectedRoutePolyline ?? null,
            estimatedDistanceKm: ride.estimatedDistanceKm, estimatedDurationMin: ride.estimatedDurationMin,
            currentEtaMinutes: tracking?.currentEtaMinutes ?? null, currentEtaTarget: tracking?.currentEtaTarget ?? null,
            activeNavigationTarget: ride.currentStopId,
            caJoinWaypoint: caJoinWaypoint ? {
              coordinates: caJoinWaypoint.location?.coordinates, address: caJoinWaypoint.location?.address, label: caJoinWaypoint.location?.label,
              isCompleted: caJoinWaypoint.isCompleted, completedAt: caJoinWaypoint.completedAt,
              zone: caJoinWaypoint.meta?.zone, distCaToJoinKm: caJoinWaypoint.meta?.distCaToJoinKm, caRouteFrom: caJoinWaypoint.meta?.caFrom,
            } : null,
          },
          careAssistant: caSnapshot ? {
            ...caSnapshot, liveLocation: fmtLoc(caLiveLocationRaw), breadcrumbCount: caBreadcrumbCount,
            joinPointRoute: caJoinWaypoint && caJoinWaypoint.meta?.caFrom ? {
              from: caJoinWaypoint.meta.caFrom, to: caJoinWaypoint.location?.coordinates, distKm: caJoinWaypoint.meta?.distCaToJoinKm,
              isCompleted: caJoinWaypoint.isCompleted, note: 'CA travels to join point independently',
            } : null,
          } : null,
          hasActiveSos: tracking?.hasActiveSos ?? false, milestones: tracking?.milestones ?? [],
          socketHint: { room: `booking:${booking._id}`, events: ['location_update', 'care_assistant_location_update', 'care_assistant_status_change', 'care_assistant_joined_ride', 'eta_update', 'ride_status_changed'] },
          _serverTime: new Date().toISOString(),
        }});
      }

      return res.json({ success: true, data: {
        bookingId: booking._id, rideId: ride._id, rideStatus: ride.status,
        driver: { liveLocation: fmtLoc(ride.liveLocation), snapshot: ride.driverSnapshot, vehicleSnapshot: ride.vehicleSnapshot },
        route: { pickup: ride.pickup, dropoff: ride.dropoff, expectedPolyline: tracking?.expectedRoutePolyline ?? null, estimatedDistanceKm: ride.estimatedDistanceKm, estimatedDurationMin: ride.estimatedDurationMin, currentEtaMinutes: tracking?.currentEtaMinutes ?? null, currentEtaTarget: tracking?.currentEtaTarget ?? null },
        careAssistant: null, hasActiveSos: tracking?.hasActiveSos ?? false, milestones: tracking?.milestones ?? [],
        socketHint: { room: `booking:${booking._id}`, events: ['location_update', 'eta_update', 'ride_status_changed'] },
        _serverTime: new Date().toISOString(),
      }});
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// HOSPITAL ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/hospital/upcoming', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id, managementModel: 'hospital-manager', isActive: true })
      .select('_id linkedDoctors').lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    // FIX: booking.hospital often unset even for this hospital's own linked doctors —
    // match on hospital field OR doctor-in-hospital so nothing gets silently dropped.
    const bookings = await Booking.find({
      status: { $in: ['pending', 'confirmed', 'in_progress'] },
      scheduledAt: { $gte: new Date() },
      bookingType: { $in: ['full_care_ride', 'doctor_consultation', 'doctor_online', 'physiotherapist', 'follow_up'] },
      $or: [{ hospital: hospital._id }, { doctor: { $in: hospital.linkedDoctors } }],
    })
      .select('bookingCode patientInfo scheduledAt bookingType status consultationType doctorSnapshot careAssistantSnapshot fareBreakdown primaryRide consultationSessionId hospital doctor')
      .populate({ path: 'doctor', select: 'specialization registrationNumber profilePhotoUrl', populate: { path: 'user', select: 'name phone email' } })
      .populate('careAssistant', 'fullName phone photoUrl experienceYears')
      .populate('customer', 'name phone email')
      .populate('primaryRide', 'status driverSnapshot vehicleSnapshot estimatedDistanceKm estimatedDurationMin')
      .sort({ scheduledAt: 1 }).lean();

    // FIX: OP + follow-up window was never attached here — hospital had no visibility
    // into which upcoming bookings are follow-ups or have an active follow-up window.
    const bookingIds = bookings.map(b => b._id);
    const ops = bookingIds.length
      ? await OutPatientRecord.find({ booking: { $in: bookingIds } })
          .select('booking opNumber status followUpExpiry followUpFee isFollowUp').lean()
      : [];
    const opByBooking = new Map(ops.map(op => [String(op.booking), op]));
    const now = new Date();
    const enrichedBookings = bookings.map(b => {
      const op = opByBooking.get(String(b._id));
      return {
        ...b,
        op: op ? {
          opNumber:           op.opNumber,
          status:              op.status,
          isFollowUp:          op.isFollowUp,
          followUpExpiry:      op.followUpExpiry,
          followUpFee:         op.followUpFee,
          isFollowUpEligible:  op.followUpExpiry ? now < new Date(op.followUpExpiry) : false,
          daysRemaining:       op.followUpExpiry ? Math.max(0, Math.ceil((new Date(op.followUpExpiry) - now) / 86400000)) : 0,
        } : null,
      };
    });

    return res.json({ success: true, data: { bookings: enrichedBookings } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/hospital/confirm', protect, authorize('hospital'), async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id, managementModel: 'hospital-manager', isActive: true }).select('_id linkedDoctors').lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    // FIX: booking.hospital may be unset even though booking.doctor is linked to this hospital —
    // widen lookup so the hospital manager can confirm their own doctors' bookings.
    const booking = await Booking.findOne({
      _id: req.params.id,
      $or: [{ hospital: hospital._id }, { doctor: { $in: hospital.linkedDoctors } }],
    });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found or not your hospital' });

    // Backfill hospital link so downstream queries (ops list, dashboard revenue, valid-ops) find it by hospital too.
    if (!booking.hospital) booking.hospital = hospital._id;

    booking.statusLog.push({ fromStatus: booking.status, toStatus: booking.status, changedBy: req.user._id, reason: 'Hospital confirmed appointment slot' });
    booking.notificationsSent.bookingConfirmation = true;
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer).select('phone name email').lean();
    sendSms({ to: customer.phone, message: appointmentConfirmedSms({ userName: customer.name, appointmentId: booking.bookingCode, doctorName: booking.doctorSnapshot?.name || 'Your Doctor', scheduledAt: new Date(booking.scheduledAt).toLocaleString('en-IN'), mode: booking.consultationType || 'inPerson' }) }).catch(() => {});
    createOrSendOpOnConfirmation({ booking: booking.toObject(), triggeredBy: 'hospital' }).catch(() => {});
    sendEmail({ email: customer?.email, subject: `Appointment Confirmed — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'APPOINTMENT CONFIRMED', title: 'Your appointment is confirmed', body: `<b>Booking:</b> #${booking.bookingCode}<br/><b>Doctor:</b> ${booking.doctorSnapshot?.name || 'Your Doctor'}<br/><b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'View Appointment' }) }).catch(() => {});
    return res.json({ success: true, message: 'Appointment confirmed and OP sent' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/hospital/:hospitalId/ops',
  protect, authorize('hospital', 'admin', 'superadmin'),
  cache(CACHE_TTL.ops, req => `GET:/hospital/${req.params.hospitalId}/ops:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { hospitalId } = req.params;

      // Add MongoDB ObjectId validation
      if (!hospitalId || !hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ success: false, message: 'Invalid Hospital ID format.' });
      }

      let hospitalDoc = null;
      if (!['admin', 'superadmin'].includes(req.user.role)) {
        hospitalDoc = await Hospital.findOne({ _id: hospitalId, managedBy: req.user._id, managementModel: 'hospital-manager', isActive: true }).select('linkedDoctors').lean();
        if (!hospitalDoc) return res.status(403).json({ success: false, message: 'Access denied: not your hospital' });
      } else {
        hospitalDoc = await Hospital.findById(hospitalId).select('linkedDoctors').lean();
      }

      const { status, doctorId, date, page = 1, limit = 20 } = req.query;
      // FIX: op.hospital can be null even for this hospital's own doctor — widen so
      // ops aren't silently dropped just because the hospital link was never set.
      const filter = { $or: [{ hospital: hospitalId }, { doctor: { $in: hospitalDoc?.linkedDoctors || [] } }] };
      if (status)   filter.status  = status;
      if (doctorId) filter.doctor  = doctorId;
      if (date) { const d = new Date(date), n = new Date(d); n.setDate(n.getDate() + 1); filter.scheduledAt = { $gte: d, $lt: n }; }
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter).populate({ path: 'doctor', select: 'user specialization registrationNumber profilePhotoUrl', populate: { path: 'user', select: 'name phone email' } }).populate('patient', 'name phone email').populate('booking', 'bookingCode bookingType fareBreakdown paymentStatus').sort({ scheduledAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        OutPatientRecord.countDocuments(filter),
      ]);

      // FIX: follow-up window was only ever surfaced on /valid-ops and /op/:opNumber —
      // this general ops list gave no follow-up visibility at all.
      const now = new Date();
      const enrichedOps = ops.map(op => ({
        ...op,
        isFollowUpEligible: op.followUpExpiry ? now < new Date(op.followUpExpiry) : false,
        daysRemaining:      op.followUpExpiry ? Math.max(0, Math.ceil((new Date(op.followUpExpiry) - now) / 86400000)) : 0,
      }));

      return res.json({ success: true, data: { ops: enrichedOps, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
router.get('/hospital/:hospitalId/valid-ops',
  protect, authorize('hospital', 'doctor', 'admin', 'superadmin'),
  cache(CACHE_TTL.ops, req => `GET:/hospital/${req.params.hospitalId}/valid-ops:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { hospitalId } = req.params;
      
      // Update validation to check for a valid ObjectId format
      if (!hospitalId || hospitalId === 'undefined' || hospitalId === 'null' || !hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ success: false, message: 'Valid Hospital ID required.' });
      }

      // FIX: no ownership check existed for the 'hospital' role — any hospital manager
      // FIX: no ownership check existed for the 'hospital' role — any hospital manager
      // could pass an arbitrary hospitalId and read another hospital's follow-up OPs.
      let linkedDoctorIds = [];
      if (req.user.role === 'hospital') {
        const hospitalDoc = await Hospital.findOne({ _id: hospitalId, managedBy: req.user._id, managementModel: 'hospital-manager', isActive: true }).select('linkedDoctors').lean();
        if (!hospitalDoc) return res.status(403).json({ success: false, message: 'Access denied: not your hospital' });
        linkedDoctorIds = hospitalDoc.linkedDoctors;
      } else {
        const hospitalDoc = await Hospital.findById(hospitalId).select('linkedDoctors').lean();
        linkedDoctorIds = hospitalDoc?.linkedDoctors || [];
      }

      const { doctorId, patientId, page = 1, limit = 20 } = req.query;
      // FIX: widen to doctor-in-hospital — op.hospital being unset previously hid these entirely.
      const filter = {
        $or: [{ hospital: hospitalId }, { doctor: { $in: linkedDoctorIds } }],
        isFollowUp: false, followUpExpiry: { $gt: new Date() }, status: { $in: ['scheduled', 'completed'] },
      };
      if (doctorId)  filter.doctor  = doctorId;
      if (patientId) filter.patient = patientId;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter).populate('doctor', 'user specialization registrationNumber').populate('patient', 'name phone email').populate('booking', 'bookingCode bookingType fareBreakdown paymentStatus').sort({ scheduledAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        OutPatientRecord.countDocuments(filter),
      ]);
      const now = new Date();
      const enriched = ops.map(op => ({ ...op, daysRemaining: Math.ceil((new Date(op.followUpExpiry) - now) / (1000 * 60 * 60 * 24)) }));
      return res.json({ success: true, data: { ops: enriched, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// DOCTOR ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/doctor/ops',
  protect, authorize('doctor'),
  cache(CACHE_TTL.ops, req => `GET:/doctor/ops:${req.user._id}:${req.originalUrl}`),
  async (req, res) => {
    try {
      const doctorProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      const { status, hospitalId, patientId, date, page = 1, limit = 20 } = req.query;
      const filter = { doctor: doctorProfile._id };
      if (status)     filter.status   = status;
      if (hospitalId) filter.hospital = hospitalId;
      if (patientId)  filter.patient  = patientId;
      if (date) { const d = new Date(date), n = new Date(d); n.setDate(n.getDate() + 1); filter.scheduledAt = { $gte: d, $lt: n }; }
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter).populate('patient', 'name phone email').populate('hospital', 'name address contact').populate('booking', 'bookingCode bookingType fareBreakdown patientInfo consultationSessionId').populate('parentOp', 'opNumber consultationType scheduledAt status').sort({ scheduledAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
        OutPatientRecord.countDocuments(filter),
      ]);
      return res.json({ success: true, data: { ops, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/doctor/ops/:opNumber',
  protect, authorize('doctor'),
  cache(CACHE_TTL.opRecord, req => `GET:/doctor/ops/${req.params.opNumber}`),
  async (req, res) => {
    try {
      const doctorProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      const op = await OutPatientRecord.findOne({ opNumber: req.params.opNumber, doctor: doctorProfile._id })
        .populate('patient', 'name phone email avatar').populate('hospital', 'name address contact consultationPricing').populate('booking', 'bookingCode bookingType fareBreakdown patientInfo status documents consultationSessionId').populate('parentOp', 'opNumber consultationType scheduledAt status').lean();
      if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });
      const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).populate('patient', 'name phone').lean();
      const isFollowUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);
      const daysRemaining = isFollowUpEligible ? Math.ceil((new Date(op.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
      return res.json({ success: true, data: { op, followUps, isFollowUpEligible, daysRemaining } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/:id/op/complete', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    const { doctorNotes, prescriptionUrl, diagnosisCode, reasonForVisit } = req.body;
    const op = await OutPatientRecord.findOne({ booking: req.params.id, doctor: doctorProfile._id });
    if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });
    if (op.status === 'completed') return res.status(400).json({ success: false, message: 'OP already completed' });

    op.status      = 'completed';
    op.completedAt = new Date();
    if (doctorNotes)     op.doctorNotes     = doctorNotes;
    if (prescriptionUrl) op.prescriptionUrl = prescriptionUrl;
    if (diagnosisCode)   op.diagnosisCode   = diagnosisCode;
    if (reasonForVisit)  op.reasonForVisit  = reasonForVisit;
    op.updatedBy = req.user._id;
    await op.save();

    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.consultationSessionId) {
      const activeConsultation = await Consultation.findOne({ _id: booking.consultationSessionId, status: { $in: ['active', 'paused', 'waiting'] } });
      if (activeConsultation) {
        activeConsultation.status = 'completed'; activeConsultation.actualEndTime = new Date(); activeConsultation.roomEnded = true;
        activeConsultation.prescriptionUploaded = !!prescriptionUrl; activeConsultation.endedBy = 'doctor'; activeConsultation.endedByUserId = req.user._id; activeConsultation.updatedBy = req.user._id;
        if (activeConsultation.actualStartTime) activeConsultation.actualDurationMinutes = Math.round((activeConsultation.actualEndTime - activeConsultation.actualStartTime) / 60000);
        await activeConsultation.save();
      }
    }

    const customer  = await User.findById(booking.customer).select('email phone name').lean();
    const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();
    await createNotification({ recipient: booking.customer, title: 'Consultation Complete', body: `Consultation OP ${op.opNumber} completed.`, type: 'Ride_Update', bookingId: booking._id });
    sendOpZipEmail({ op: op.toObject ? op.toObject() : op, booking, patient: customer, followUps });

    if (op.hospital) {
      const hospital = await Hospital.findById(op.hospital).populate('managedBy', 'name email').lean();
      if (hospital?.managedBy?.email) emailHospitalBookingUpdate({ hospitalUser: hospital.managedBy, booking, subject: `Consultation Completed — OP ${op.opNumber} | Likeson Healthcare`, body: `Dr. ${booking.doctorSnapshot?.name || 'Doctor'} completed consultation.<br/><b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/><b>OP:</b> ${op.opNumber}` }).catch(() => {});
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'OP completed and sent to patient', data: { op } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// OP CARD PUBLIC ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/op/:opNumber',
  protect,
  cache(CACHE_TTL.opRecord, req => `GET:/op/${req.params.opNumber}:${req.user._id}`),
  async (req, res) => {
    try {
      const filter = { opNumber: req.params.opNumber };
      if (req.user.role === 'customer') filter.patient = req.user._id;
      else if (req.user.role === 'doctor') {
        const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
        filter.doctor = dp._id;
      }
      const op = await OutPatientRecord.findOne(filter)
        .populate({ path: 'doctor', select: 'user specialization registrationNumber profilePhotoUrl', populate: { path: 'user', select: 'name phone email' } })
        .populate('hospital', 'name address contact operatingHours is24x7').populate('patient', 'name phone email')
        .populate('booking', 'bookingCode bookingType fareBreakdown status patientInfo consultationType documents consultationSessionId')
        .populate('parentOp', 'opNumber scheduledAt consultationType status').lean();
      if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });
      const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).populate('doctor', 'user specialization').lean();
      const isFollowUpEligible = op.followUpExpiry && new Date() < new Date(op.followUpExpiry);
      const daysRemaining = isFollowUpEligible ? Math.ceil((new Date(op.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
      return res.json({ success: true, data: { op, followUps, isFollowUpEligible, daysRemaining } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/op/:opNumber/follow-ups', protect, async (req, res) => {
  try {
    const baseFilter = { opNumber: req.params.opNumber };
    if (req.user.role === 'customer') baseFilter.patient = req.user._id;
    const parentOp = await OutPatientRecord.findOne(baseFilter).select('_id').lean();
    if (!parentOp) return res.status(404).json({ success: false, message: 'OP not found' });
    const followUps = await OutPatientRecord.find({ parentOp: parentOp._id }).sort({ scheduledAt: -1 })
      .populate({ path: 'doctor', select: 'user specialization', populate: { path: 'user', select: 'name phone email' } })
      .populate('hospital', 'name address').populate('booking', 'bookingCode status').lean();
    return res.json({ success: true, data: { followUps, total: followUps.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/op/:opNumber/download', protect, async (req, res) => {
  try {
    const filter = { opNumber: req.params.opNumber };
    if (req.user.role === 'customer') filter.patient = req.user._id;
    const op = await OutPatientRecord.findOne(filter).lean();
    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });
    const booking   = await Booking.findById(op.booking).lean();
    const patient   = await User.findById(op.patient).select('name email phone').lean();
    const doctor    = op.doctor   ? await DoctorProfile.findById(op.doctor).populate('user', 'name').lean() : null;
    const hospital  = op.hospital ? await Hospital.findById(op.hospital).lean() : null;
    const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();
    const html = generateOpHtml({ op, booking, doctor, hospital, patient, followUps });
    const zip  = await buildOpZipBuffer(html, op.opNumber);
    const safeFilename = `${(op.opNumber || 'OP').replace(/[^a-zA-Z0-9\-_]/g, '_')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    return res.send(zip);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═════════════════════════════════════════════════════════════════════════════

router.get('/admin/bookings',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.adminBookings, req => `GET:/admin/bookings:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { status, bookingType, city, date, page = 1, limit = 20, search, from, to } = req.query;
      const filter = {};
      if (status)      filter.status                  = status;
      if (bookingType) filter.bookingType             = bookingType;
      if (city)        filter['patientLocation.city'] = { $regex: city, $options: 'i' };
      if (from || to) { filter.scheduledAt = {}; if (from) filter.scheduledAt.$gte = new Date(from); if (to) filter.scheduledAt.$lte = new Date(to); }
      if (date) { const d = new Date(date), n = new Date(d); n.setDate(n.getDate() + 1); filter.scheduledAt = { $gte: d, $lt: n }; }
      if (search) filter.$or = [{ bookingCode: { $regex: search, $options: 'i' } }, { 'patientInfo.name': { $regex: search, $options: 'i' } }];
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [bookings, total] = await Promise.all([
        Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
          .populate('customer', 'name phone email')
          .populate({ path: 'doctor', select: 'specialization registrationNumber', populate: { path: 'user', select: 'name phone' } })
          .populate('hospital', 'name address contact').populate('careAssistant', 'fullName phone photoUrl').populate('transportPartner', 'businessName ownerPhone').lean(),
        Booking.countDocuments(filter),
      ]);
      return res.json({ success: true, data: { bookings, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/stats',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.adminStats, req => `GET:/admin/bookings/stats:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { from, to } = req.query;
      const dateFilter = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to)   dateFilter.$lte = new Date(to);
      const matchStage = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};
      const [statusStats, typeStats, revenueAgg] = await Promise.all([
        Booking.aggregate([{ $match: matchStage }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
        Booking.aggregate([{ $match: matchStage }, { $group: { _id: '$bookingType', count: { $sum: 1 } } }]),
        Booking.aggregate([{ $match: { ...matchStage, status: 'completed' } }, { $group: { _id: null, totalRevenue: { $sum: '$fareBreakdown.totalAmount' }, count: { $sum: 1 } } }]),
      ]);
      return res.json({ success: true, data: { byStatus: Object.fromEntries(statusStats.map(s => [s._id, s.count])), byBookingType: Object.fromEntries(typeStats.map(s => [s._id, s.count])), revenue: revenueAgg[0] || { totalRevenue: 0, count: 0 } } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/export', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { from, to, status, bookingType } = req.query;
    const filter = {};
    if (status)      filter.status      = status;
    if (bookingType) filter.bookingType  = bookingType;
    if (from || to) { filter.scheduledAt = {}; if (from) filter.scheduledAt.$gte = new Date(from); if (to) filter.scheduledAt.$lte = new Date(to); }
    const bookings = await Booking.find(filter).select('bookingCode bookingType status scheduledAt patientInfo fareBreakdown paymentStatus createdAt consultationSessionId').populate('customer', 'name email phone').sort({ createdAt: -1 }).limit(5000).lean();
    const csvHeader = 'BookingCode,Type,Status,Scheduled,Patient,Customer,Phone,Total(INR),AmountPaid(INR),PaymentStatus,HasConsultation,CreatedAt\n';
    const csvRows = bookings.map(b => [b.bookingCode, b.bookingType, b.status, new Date(b.scheduledAt).toLocaleString('en-IN'), b.patientInfo?.name, b.customer?.name, b.customer?.phone, b.fareBreakdown?.totalAmount, b.fareBreakdown?.amountPaid, b.paymentStatus, b.consultationSessionId ? 'Yes' : 'No', new Date(b.createdAt).toLocaleString('en-IN')].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings-${Date.now()}.csv`);
    return res.send(csvHeader + csvRows.join('\n'));
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/bookings/:id',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.adminBookings, req => `GET:/admin/bookings/${req.params.id}`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id)
        .populate('customer', 'name phone email')
        .populate({ path: 'doctor', select: 'user specialization profilePhotoUrl registrationNumber', populate: { path: 'user', select: 'name phone email' } })
        .populate('hospital', 'name address contact consultationPricing').populate('careAssistant', 'fullName phone photoUrl specializations performance.averageRating')
        .populate('transportPartner', 'businessName ownerName ownerPhone fleetInfo').populate('primaryRide', 'status liveLocation driverSnapshot vehicleSnapshot scheduledPickupAt pickup dropoff estimatedDistanceKm estimatedDurationMin trackingId driver currentStopId activeRouteVersionId')
        .populate('rides', 'status rideType driverSnapshot vehicleSnapshot estimatedDistanceKm').populate('diagnosticDetails.labPartner', 'labName contact').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      let mapRoute = null;
      if (booking.primaryRide?.trackingId) {
        const trackingDoc = await RideTracking.findById(booking.primaryRide.trackingId).select('expectedRoutePolyline currentEtaMinutes totalDistanceKm hasActiveSos').lean();
        if (trackingDoc) mapRoute = { polyline: trackingDoc.expectedRoutePolyline, currentEtaMinutes: trackingDoc.currentEtaMinutes, totalDistanceKm: trackingDoc.totalDistanceKm, hasActiveSos: trackingDoc.hasActiveSos, pickupCoords: booking.primaryRide.pickup?.coordinates, pickupAddress: booking.primaryRide.pickup?.address, dropoffCoords: booking.primaryRide.dropoff?.coordinates, dropoffAddress: booking.primaryRide.dropoff?.address };
      }

      let driverDetail = null;
      if (booking.primaryRide?.driver) {
        const driverDoc = await Driver.findById(booking.primaryRide.driver).select('legalName phone driverCode assignedVehicleSnapshot ownerAgency soloPartner performance.rating').lean();
        if (driverDoc) driverDetail = { ...driverDoc, assignmentType: driverDoc.ownerAgency ? 'transport_partner_fleet' : (driverDoc.soloPartner ? 'solo_driver_partner' : 'unknown') };
      }

      const opRecord  = booking.doctor ? await OutPatientRecord.findOne({ booking: booking._id }).populate('doctor', 'user specialization').populate('hospital', 'name address').lean() : null;
      const followUps = opRecord ? await OutPatientRecord.find({ parentOp: opRecord._id }).sort({ scheduledAt: -1 }).lean() : [];
      let consultation = null;
      if (booking.consultationSessionId) {
        consultation = await Consultation.findById(booking.consultationSessionId).select('-hostToken -participantToken -webhookSecret -doctorInternalNotes -internalAdminNotes').lean();
      }

      // Fetch active RideStops and JoinPoints for full_care_ride
      let rideStops = [];
      let joinPoints = [];
      let participants = [];
      if (booking.primaryRide?._id) {
        const rideId = booking.primaryRide._id;
        [rideStops, joinPoints, participants] = await Promise.all([
          RideStop.find({ ride: rideId, isActive: true }).sort({ sequence: 1 }).lean(),
          JoinPoint.find({ ride: rideId, isActive: true }).lean(),
          RideParticipant.find({ ride: rideId, isActive: true }).lean(),
        ]);
      }

      return res.json({ success: true, data: { booking, opRecord, followUps, mapRoute, consultation, driverDetail, rideStops, joinPoints, participants } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/admin/bookings/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const BOOKING_STATUSES = ['draft', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'refund_pending', 'refunded'];
    if (!BOOKING_STATUSES.includes(status)) return res.status(400).json({ success: false, message: `Invalid status. Valid: ${BOOKING_STATUSES.join(', ')}` });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

const prevStatus  = booking.status;
    booking.status    = status;
    booking.statusLog.push({ fromStatus: prevStatus, toStatus: status, changedBy: req.user._id, reason: note || 'Admin status update' });
    booking.updatedBy = req.user._id;
    await booking.save();

    if (status === 'cancelled') {
      await recoverSubscriptionUsageOnCancel(booking).catch(e => console.error('[admin/status] recovery failed:', e.message));
    }

    if (status === 'completed') {
      try {
        const created = await createAllocationsForBooking(booking._id);
        console.log(`[admin/status] allocations created: ${created.length} for booking ${booking._id}`);
      } catch (allocErr) {
        console.error('[admin/status] allocation creation failed:', allocErr.message);
      }
    }

    // Auto-create Consultation for doctor_online on confirm
    if (status === 'confirmed' && ['doctor_online'].includes(booking.bookingType) && booking.doctor && !booking.consultationSessionId) {
      try {
        const { createAgoraRoom, generateAgoraToken } = await import('../services/agoraService.js');
        const scheduledStartTime = booking.scheduledAt;
        const { roomId, meetingId } = createAgoraRoom(booking.bookingCode, booking._id.toString());
        const hostToken        = generateAgoraToken(roomId, 'host', 0);
        const participantToken = generateAgoraToken(roomId, 'participant', 0);
        const consultation = new Consultation({ bookingId: booking._id, patient: booking.customer, doctor: booking.doctor, hospital: booking.hospital || null, consultationType: booking.consultationType || 'video', consultationMode: 'scheduled', language: 'English', priority: 'routine', scheduledStartTime, estimatedDurationMinutes: 30, waitingRoomEnabled: true, recordingSupported: false, provider: 'Agora', roomId, meetingId, hostToken, participantToken, status: 'scheduled', createdBy: req.user._id });
        await consultation.save();
        await Booking.findByIdAndUpdate(booking._id, { $set: { consultationSessionId: consultation._id } });
        booking.consultationSessionId = consultation._id;
      } catch (consultErr) { console.error('[admin/status] Agora room creation failed:', consultErr.message); }
    }

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    if (status === 'confirmed' && booking.doctor) createOrSendOpOnConfirmation({ booking: booking.toObject(), triggeredBy: 'admin' }).catch(() => {});
    emailCustomerStatusUpdate({ booking, newStatus: status, customer }).catch(() => {});

    if (booking.doctor && ['confirmed', 'cancelled', 'completed'].includes(status)) {
      const doctorProfile = await DoctorProfile.findById(booking.doctor).populate('user', 'name email').lean();
      if (doctorProfile?.user?.email) emailDoctorBookingUpdate({ doctorUser: doctorProfile.user, booking, subject: `Booking #${booking.bookingCode} — Status: ${status} | Likeson Healthcare`, body: `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/><b>Status:</b> ${status}<br/><b>Note:</b> ${note || 'Admin update'}` }).catch(() => {});
    }
    if (booking.hospital && ['confirmed', 'cancelled', 'completed'].includes(status)) {
      const hospital = await Hospital.findById(booking.hospital).populate('managedBy', 'name email').lean();
      if (hospital?.managedBy?.email) emailHospitalBookingUpdate({ hospitalUser: hospital.managedBy, booking, subject: `Booking #${booking.bookingCode} — Status: ${status} | Likeson Healthcare`, body: `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/><b>Status:</b> ${status}<br/><b>Note:</b> ${note || 'Admin update'}` }).catch(() => {});
    }

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', { bookingId: booking._id, status, timestamp: new Date() });
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Status updated', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /admin/bookings/:id/destination
 * Admin changes destination after driver acceptance.
 * Writes DestinationChangeAudit + creates new RouteVersion.
 */
router.patch('/admin/bookings/:id/destination', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newDestination, reason } = req.body;
    if (!newDestination?.coordinates?.length)
      return res.status(400).json({ success: false, message: 'newDestination.coordinates required' });
    if (!reason)
      return res.status(400).json({ success: false, message: 'reason required for destination change' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const oldDestination = booking.destinationLocation ? {
      type:        booking.destinationLocation.type,
      coordinates: booking.destinationLocation.coordinates,
      address:     booking.destinationLocation.address,
    } : null;

    // Allow admin override
    booking._isAdminOverride = true;
    booking.destinationLocation = {
      type:        'Point',
      coordinates: newDestination.coordinates,
      address:     newDestination.address || '',
      city:        newDestination.city    || '',
    };
    booking.updatedBy = req.user._id;
    await booking.save();

    // Write immutable audit record
    const activeRide = booking.primaryRide ? await Ride.findById(booking.primaryRide).select('_id activeRouteVersionId').lean() : null;
    await DestinationChangeAudit.create({
      booking:        booking._id,
      ride:           activeRide?._id || null,
      oldDestination: oldDestination || { type: 'Point', coordinates: [0, 0] },
      newDestination: { type: 'Point', coordinates: newDestination.coordinates, address: newDestination.address || '' },
      changedBy:      req.user._id,
      reason,
      routeVersion:   null, // set below after route recalc
    });

    // Recalculate route + new RouteVersion if ride active
    if (activeRide) {
      const pickupCoords  = booking.patientLocation?.coordinates || [80.648, 16.506];
      const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(pickupCoords, newDestination.coordinates);

      // Deactivate old version
      const prevRv = await RouteVersion.findOne({ ride: activeRide._id, isActive: true }).lean();
      if (prevRv) await RouteVersion.findByIdAndUpdate(prevRv._id, { $set: { isActive: false, supersededAt: new Date() } });

      const newVersionNumber = (prevRv?.versionNumber || 0) + 1;
      const newRv = await RouteVersion.create({
        ride:              activeRide._id,
        versionNumber:     newVersionNumber,
        polyline,
        totalDistanceKm:   distanceKm,
        totalDurationMin:  durationMin,
        generatedReason:   'DESTINATION_CHANGE',
        generatedBy:       req.user._id,
        isActive:          true,
      });

      // Deactivate old hospital stop, create new one
      await RideStop.updateMany({ ride: activeRide._id, stopType: 'HOSPITAL', isActive: true }, { $set: { isActive: false } });
      const patStop = await RideStop.findOne({ ride: activeRide._id, stopType: 'PATIENT_PICKUP', isActive: true }).lean();
      const newHospSeq = patStop ? patStop.sequence + 1 : 2;

      // Copy over any existing active stops (CA join etc.) to new version
      const existingStops = await RideStop.find({ ride: activeRide._id, isActive: true, stopType: { $ne: 'HOSPITAL' } }).sort({ sequence: 1 }).lean();
      const newStopIds = [];
      for (const stop of existingStops) {
        const ns = await RideStop.create({ ...stop, _id: undefined, routeVersion: newVersionNumber });
        newStopIds.push(ns._id);
        // deactivate old copy
        await RideStop.findByIdAndUpdate(stop._id, { $set: { isActive: false } });
      }

      const hospStop = await RideStop.create({
        ride:         activeRide._id,
        booking:      booking._id,
        routeVersion: newVersionNumber,
        sequence:     newHospSeq,
        stopType:     'HOSPITAL',
        location:     { type: 'Point', coordinates: newDestination.coordinates, address: newDestination.address || 'Destination' },
        status:       'PENDING',
      });
      newStopIds.push(hospStop._id);

      await RouteVersion.findByIdAndUpdate(newRv._id, { $set: { stops: newStopIds } });
      await Ride.findByIdAndUpdate(activeRide._id, { $set: { activeRouteVersionId: newRv._id, 'dropoff.coordinates': newDestination.coordinates, 'dropoff.address': newDestination.address || '' } });
      await RideTracking.findOneAndUpdate({ ride: activeRide._id }, { $set: { expectedRoutePolyline: polyline } });

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'destination_changed', {
        bookingId:      booking._id,
        newDestination: newDestination.coordinates,
        reason,
        polyline,
        estimatedDistKm:  distanceKm,
        estimatedMinutes: durationMin,
        changedBy:        'admin',
        timestamp:        new Date(),
      });
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'Destination updated. Route recalculated.', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin nearby lookup routes ─────────────────────────────────────────────

router.get('/admin/bookings/:id/nearby/care-assistants',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/care-assistants`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation scheduledAt').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;

      const careAssistants = await CareAssistantProfile.find({
        isActive: true, isBlocked: false, status: 'Available', 'kyc.verificationStatus': 'Verified', 'verification.isVerified': true,
        location: { $geoWithin: { $centerSphere: [[lng, lat], careRideRadiusRad] } },
      }).select('fullName phone specializations performance maxServiceRadiusKm availability location workType user').populate('user', 'name phone email').limit(20).lean();

      const results = careAssistants.map(ca => {
        const distKm = haversineKm(coords, ca.location?.coordinates || [0, 0]);
        if (distKm > (ca.maxServiceRadiusKm || 10)) return null;
        return { careAssistantId: ca._id, userId: ca.user, name: ca.fullName, phone: ca.phone, specializations: ca.specializations, rating: ca.performance?.averageRating, distanceKm: +distKm.toFixed(1), maxServiceRadiusKm: ca.maxServiceRadiusKm, workType: ca.workType, currentCity: ca.availability?.currentCity, isDispatchable: true };
      }).filter(Boolean);

      return res.json({ success: true, data: { results, total: results.length } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── Zone helpers ──────────────────────────────────────────────────────────────

function buildZoneClauses(city, pincode) {
  const clauses = [];
  if (city)    clauses.push({ 'serviceZones.city': { $regex: `^${city}$`, $options: 'i' } });
  if (pincode) clauses.push({ 'serviceZones.pinCodes': pincode });
  return clauses;
}

function matchZone(serviceZones, city, pincode) {
  return serviceZones?.find(z => (city && z.city?.match(new RegExp(`^${city}$`, 'i'))) || (pincode && z.pinCodes?.includes(pincode)));
}

async function enrichSoloPartnersFromVehicles(vehicles, city, pincode) {
  const results = await Promise.all(vehicles.map(async vehicle => {
    const sp = await SoloDriverPartner.findOne({ _id: vehicle.ownerId, partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true })
      .select('legalName partnerCode phone serviceZones rating dispatch isAvailable isOnboardingComplete partnershipStatus').lean();
    if (!sp) return null;
    const matchedZone = matchZone(sp.serviceZones, city, pincode);
    return buildSoloResult(sp, vehicle, matchedZone, matchedZone?.radiusKm ?? 15, vehicle.location?.coordinates || [0, 0]);
  }));
  return results.filter(Boolean).sort((a, b) => a.distanceKm - b.distanceKm);
}

function buildSoloResult(sp, vehicle, matchedZone, radiusKm, pickupCoords) {
  return {
    soloPartnerId: sp._id, name: sp.legalName, partnerCode: sp.partnerCode, phone: sp.phone,
    dispatchStatus: sp.dispatch?.status, isAvailable: sp.isAvailable, rating: sp.rating?.averageRating ?? 0, totalRides: sp.rating?.totalRides ?? 0,
    vehicle: vehicle ? { vehicleId: vehicle._id, vehicleCode: vehicle.vehicleCode, registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model, color: vehicle.color, vehicleType: vehicle.vehicleType, seatingCapacity: vehicle.seatingCapacity, isWheelchairAccessible: vehicle.isWheelchairAccessible, hasStretcherSupport: vehicle.hasStretcherSupport, hasOxygenSupport: vehicle.hasOxygenSupport, hasAC: vehicle.hasAC } : null,
    distanceKm: +haversineKm(pickupCoords, vehicle?.location?.coordinates || [0, 0]).toFixed(1),
    matchedZone: matchedZone ? { city: matchedZone.city, state: matchedZone.state, radiusKm } : null,
    serviceZones: sp.serviceZones?.filter(z => z.isActive).map(z => ({ city: z.city, state: z.state, radiusKm: z.radiusKm })),
    isDispatchReady: sp.partnershipStatus === 'active' && sp.isAvailable && sp.isOnboardingComplete && sp.dispatch?.status === 'Available' && vehicle?.verificationStatus === 'verified' && vehicle?.status === 'active',
  };
}

async function resolveSoloDrivers({ coords, city, pincode, destCity, destPincode }) {
  const [lng, lat] = coords;
  const baseVehicleFilter = { ownerType: 'SoloDriverPartner', status: 'active', verificationStatus: 'verified' };

  if (city || pincode) {
    const pickupClauses = buildZoneClauses(city, pincode);
    const dropClauses   = (destCity || destPincode) ? buildZoneClauses(destCity, destPincode) : [];
    if (pickupClauses.length && dropClauses.length) {
      const matched = await SoloDriverPartner.find({ partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, $and: [{ $or: pickupClauses }, { $or: dropClauses }] }).select('_id').lean();
      if (matched.length) {
        const vehicles = await Vehicle.find({ ...baseVehicleFilter, ownerId: { $in: matched.map(p => p._id) }, location: { $geoWithin: { $centerSphere: [[lng, lat], 15 / 6378.1] } } }).select('_id vehicleCode registrationNumber make model color vehicleType seatingCapacity isWheelchairAccessible hasStretcherSupport hasOxygenSupport hasAC location ownerId verificationStatus status').limit(30).lean();
        const results = await enrichSoloPartnersFromVehicles(vehicles, city, pincode);
        if (results.length) return { results, strategy: 'pickup_and_dropoff_zone' };
      }
    }
  }
  if (city || pincode) {
    const pickupClauses = buildZoneClauses(city, pincode);
    if (pickupClauses.length) {
      const matched = await SoloDriverPartner.find({ partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, $or: pickupClauses }).select('_id').lean();
      if (matched.length) {
        const vehicles = await Vehicle.find({ ...baseVehicleFilter, ownerId: { $in: matched.map(p => p._id) }, location: { $geoWithin: { $centerSphere: [[lng, lat], 15 / 6378.1] } } }).select('_id vehicleCode registrationNumber make model color vehicleType seatingCapacity isWheelchairAccessible hasStretcherSupport hasOxygenSupport hasAC location ownerId verificationStatus status').limit(30).lean();
        const results = await enrichSoloPartnersFromVehicles(vehicles, city, pincode);
        if (results.length) return { results, strategy: 'pickup_zone_only' };
      }
    }
  }
  if (destCity || destPincode) {
    const dropClauses = buildZoneClauses(destCity, destPincode);
    if (dropClauses.length) {
      const matched = await SoloDriverPartner.find({ partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, $or: dropClauses }).select('_id').lean();
      if (matched.length) {
        const vehicles = await Vehicle.find({ ...baseVehicleFilter, ownerId: { $in: matched.map(p => p._id) }, location: { $geoWithin: { $centerSphere: [[lng, lat], 15 / 6378.1] } } }).select('_id vehicleCode registrationNumber make model color vehicleType seatingCapacity isWheelchairAccessible hasStretcherSupport hasOxygenSupport hasAC location ownerId verificationStatus status').limit(30).lean();
        const results = await enrichSoloPartnersFromVehicles(vehicles, destCity, destPincode);
        if (results.length) return { results, strategy: 'dropoff_zone_only' };
      }
    }
  }
  const vehicles = await Vehicle.find({ ...baseVehicleFilter, location: { $geoWithin: { $centerSphere: [[lng, lat], 50 / 6378.1] } } }).select('_id vehicleCode registrationNumber make model color vehicleType seatingCapacity isWheelchairAccessible hasStretcherSupport hasOxygenSupport hasAC location ownerId verificationStatus status').limit(50).lean();
  const results = await enrichSoloPartnersFromVehicles(vehicles, null, null);
  return { results, strategy: 'all_no_zone_filter' };
}

function buildTPResult(tp, matchedZone, radiusKm, availDriverCount, activeVehicles, pickupCoords, nearestDriver = null) {
  const isDispatchReady = tp.isOnboardingComplete && availDriverCount > 0 && activeVehicles > 0;
  const driverCoords    = nearestDriver?.location?.coordinates;
  const distanceKm      = driverCoords ? +haversineKm(pickupCoords, driverCoords).toFixed(1) : null;
  return { tpId: tp._id, businessName: tp.businessName, ownerName: tp.ownerName, ownerPhone: tp.ownerPhone, totalVehicles: tp.fleetInfo?.totalVehicles ?? 0, activeVehicles, totalDrivers: tp.fleetInfo?.totalDrivers ?? 0, availableDriversNearby: availDriverCount, averageRating: tp.rating?.averageRating ?? 0, serviceZones: tp.serviceZones?.filter(z => z.isActive).map(z => ({ city: z.city, state: z.state, radiusKm: z.radiusKm })), matchedZone: matchedZone ? { city: matchedZone.city, state: matchedZone.state, radiusKm } : null, distanceKm, isDispatchReady };
}

async function resolveTransportPartners({ coords, city, pincode, destCity, destPincode }) {
  const [lng, lat] = coords;
  const queryTPs = (zoneFilter) => TransportPartner.find({ partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, ...zoneFilter }).select('businessName ownerName ownerPhone fleetInfo rating serviceZones isOnboardingComplete').populate('user', 'name phone email').limit(30).lean();
  const enrichTPs = async (tps, zCity, zPincode) => {
    const results = await Promise.all(tps.map(async tp => {
      const matchedZone = matchZone(tp.serviceZones, zCity, zPincode);
      const radiusKm    = matchedZone?.radiusKm ?? 15;
      const radiusRad   = radiusKm / 6378.1;
      const [availDriverCount, activeVehicles] = await Promise.all([
        Driver.countDocuments({ ownerAgency: tp._id, isActive: true, isVerified: true, status: 'Available', location: { $geoWithin: { $centerSphere: [[lng, lat], radiusRad] } } }),
        Vehicle.countDocuments({ ownerType: 'TransportPartner', ownerId: tp._id, status: 'active', verificationStatus: 'verified' }),
      ]);
      return buildTPResult(tp, matchedZone, radiusKm, availDriverCount, activeVehicles, [lng, lat]);
    }));
    return results.filter(Boolean);
  };
  if (destCity || destPincode) {
    const p = buildZoneClauses(city, pincode); const d = buildZoneClauses(destCity, destPincode);
    if (p.length && d.length) { const tps = await queryTPs({ $and: [{ $or: p }, { $or: d }] }); const r = await enrichTPs(tps, city, pincode); if (r.length) return { results: r, strategy: 'pickup_and_dropoff_zone' }; }
  }
  if (city || pincode) { const p = buildZoneClauses(city, pincode); if (p.length) { const tps = await queryTPs({ $or: p }); const r = await enrichTPs(tps, city, pincode); if (r.length) return { results: r, strategy: 'pickup_zone_only' }; } }
  if (destCity || destPincode) { const d = buildZoneClauses(destCity, destPincode); if (d.length) { const tps = await queryTPs({ $or: d }); const r = await enrichTPs(tps, destCity, destPincode); if (r.length) return { results: r, strategy: 'dropoff_zone_only' }; } }
  const tps = await queryTPs({});
  const results = await Promise.all(tps.map(async tp => {
    const [availDriverCount, activeVehicles] = await Promise.all([Driver.countDocuments({ ownerAgency: tp._id, isActive: true, isVerified: true, status: 'Available' }), Vehicle.countDocuments({ ownerType: 'TransportPartner', ownerId: tp._id, status: 'active', verificationStatus: 'verified' })]);
    const nearestDriver = await Driver.findOne({ ownerAgency: tp._id, isActive: true, isVerified: true, status: 'Available' }).select('location').lean();
    return buildTPResult(tp, null, null, availDriverCount, activeVehicles, [lng, lat], nearestDriver);
  }));
  return { results: results.filter(Boolean), strategy: 'all_no_zone_filter' };
}

router.get('/admin/bookings/:id/nearby/solo-drivers',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/solo-drivers`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation destinationLocation').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const city = booking.patientLocation?.city?.trim(); const pincode = booking.patientLocation?.pincode?.trim();
      const destCity = booking.destinationLocation?.city?.trim(); const destPincode = booking.destinationLocation?.pincode?.trim();
      const { results, strategy } = await resolveSoloDrivers({ coords, city, pincode, destCity, destPincode });
      return res.json({ success: true, data: { pickupCity: city ?? null, pickupPincode: pincode ?? null, dropCity: destCity ?? null, dropPincode: destPincode ?? null, strategy, total: results.length, results, assignRoute: 'POST /admin/bookings/:id/assign/solo-driver  body: { soloDriverPartnerId }' } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/:id/nearby/transport-partners',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/transport-partners`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation destinationLocation').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const city = booking.patientLocation?.city?.trim(); const pincode = booking.patientLocation?.pincode?.trim();
      const destCity = booking.destinationLocation?.city?.trim(); const destPincode = booking.destinationLocation?.pincode?.trim();
      const { results, strategy } = await resolveTransportPartners({ coords, city, pincode, destCity, destPincode });
      const ready = results.filter(r => r.isDispatchReady); const notReady = results.filter(r => !r.isDispatchReady);
      return res.json({ success: true, data: { pickupCity: city ?? null, pickupPincode: pincode ?? null, dropCity: destCity ?? null, dropPincode: destPincode ?? null, strategy, total: results.length, dispatchReady: ready.length, results: [...ready, ...notReady] } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.get('/admin/bookings/:id/nearby/hospitals',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/hospitals`),
  async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id).select('patientLocation').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      const coords = booking.patientLocation?.coordinates;
      if (!coords?.length) return res.status(400).json({ success: false, message: 'No pickup coordinates' });
      const [lng, lat] = coords;
      const hospitals = await Hospital.find({ isActive: true, isVerified: true, location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: RADIUS_METERS } } }).select('name hospitalType managementModel address contact specialties is24x7 rating operatingHours isEmergencyReady location linkedDoctors').limit(20).lean();
      const results = hospitals.map(h => ({ hospitalId: h._id, name: h.name, hospitalType: h.hospitalType, managementModel: h.managementModel, address: `${h.address?.line1 || ''}, ${h.address?.city || ''}`, phone: h.contact?.phone, specialties: h.specialties, is24x7: h.is24x7, isEmergencyReady: h.isEmergencyReady, linkedDoctors: h.linkedDoctors?.length || 0, distanceKm: +haversineKm(coords, h.location?.coordinates || [0, 0]).toFixed(1), averageRating: h.rating?.averageRating, isOperational: true }));
      return res.json({ success: true, data: { results, total: results.length } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── Admin assignment routes ────────────────────────────────────────────────

router.post('/admin/bookings/:id/assign/solo-driver', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { soloDriverPartnerId } = req.body;
    if (!soloDriverPartnerId) return res.status(400).json({ success: false, message: 'soloDriverPartnerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (!['pending', 'confirmed'].includes(booking.status)) return res.status(400).json({ success: false, message: `Cannot assign in status: ${booking.status}` });

    const soloPartner = await SoloDriverPartner.findById(soloDriverPartnerId).populate('user', 'name phone email').lean();
    if (!soloPartner) return res.status(404).json({ success: false, message: 'SoloDriverPartner not found' });
    if (soloPartner.partnershipStatus !== 'active') return res.status(400).json({ success: false, message: 'Solo partner not active' });
    if (!soloPartner.isOnboardingComplete) return res.status(400).json({ success: false, message: 'Solo partner onboarding incomplete' });
    if (soloPartner.dispatch?.status === 'On-Trip') return res.status(400).json({ success: false, message: 'Solo partner already on a trip' });

    const vehicle = await Vehicle.findOne({ ownerType: 'SoloDriverPartner', ownerId: soloPartner._id, status: 'active', verificationStatus: 'verified' }).select('_id registrationNumber make model color vehicleType vehicleCode seatingCapacity isWheelchairAccessible hasStretcherSupport hasOxygenSupport hasAC location').lean();
    if (!vehicle) return res.status(400).json({ success: false, message: 'Solo partner has no active verified vehicle' });

    await Ride.updateMany({ booking: booking._id, status: { $in: ['requested', 'searching'] } }, { $set: { status: 'cancelled', cancellation: { cancelledBy: 'admin', cancelledAt: new Date(), reason: 'Admin reassignment' } } });

    const coords = getBookingCoords(booking);
    const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(coords.pickupCoords, coords.dropoffCoords);

    const ride = await Ride.create({
      ...buildRidePayload({ bookingId: booking._id, rideType: 'patient', vehicleClass: 'four_wheeler', scheduledPickupAt: booking.scheduledAt, ...coords, createdBy: req.user._id }),
      soloPartner:          soloPartner._id,
      driver:               null,
      status:               'driver_assigned',
      estimatedDistanceKm:  distanceKm,
      estimatedDurationMin: durationMin,
      vehicleSnapshot: { vehicleCode: vehicle.vehicleCode, registrationNumber: vehicle.registrationNumber, make: vehicle.make, model: vehicle.model, vehicleType: vehicle.vehicleType, color: vehicle.color },
      driverSnapshot: { name: soloPartner.legalName, phone: soloPartner.phone, code: soloPartner.partnerCode, type: 'solo' },
    });

    const rv = await RouteVersion.create({ ride: ride._id, versionNumber: 1, polyline, totalDistanceKm: distanceKm, totalDurationMin: durationMin, generatedReason: 'INITIAL', isActive: true });
    const patStop  = await RideStop.create({ ride: ride._id, booking: booking._id, routeVersion: 1, sequence: 1, stopType: 'PATIENT_PICKUP', location: { type: 'Point', coordinates: coords.pickupCoords, address: coords.pickupAddress }, status: 'PENDING' });
    const hospStop = await RideStop.create({ ride: ride._id, booking: booking._id, routeVersion: 1, sequence: 2, stopType: 'HOSPITAL', location: { type: 'Point', coordinates: coords.dropoffCoords, address: coords.dropoffAddress }, status: 'PENDING' });
    await Ride.findByIdAndUpdate(ride._id, { $set: { currentStopId: patStop._id, activeRouteVersionId: rv._id } });
    await RouteVersion.findByIdAndUpdate(rv._id, { $set: { stops: [patStop._id, hospStop._id] } });

    const tracking = await RideTracking.create({ ride: ride._id, booking: booking._id, expectedRoutePolyline: polyline, currentStopId: patStop._id });
    await Ride.findByIdAndUpdate(ride._id, { $set: { trackingId: tracking._id } });
    await Booking.findByIdAndUpdate(booking._id, { $push: { rides: ride._id }, $set: { primaryRide: ride._id, status: 'confirmed', updatedBy: req.user._id, solodriverpartner: soloPartner._id } });

    await AssignmentHistory.create({ ride: ride._id, booking: booking._id, assignmentType: 'DRIVER', entityRefModel: 'SoloDriverPartner', entityRefId: soloPartner._id, action: 'ASSIGNED', performedBy: req.user._id, effectiveAt: new Date() });
    await SoloDriverPartner.findByIdAndUpdate(soloPartner._id, { 'dispatch.status': 'On-Trip', 'dispatch.currentRide': ride._id, 'dispatch.lastStatusAt': new Date() });

    await createNotification({ recipient: soloPartner.user._id, title: 'New Booking Assigned', body: `Admin assigned booking #${booking.bookingCode}.`, type: 'Ride_Request', bookingId: booking._id, priority: 'High' });
    const customer = await User.findById(booking.customer).select('email phone name').lean();

    sendEmail({ email: soloPartner.user?.email, subject: `Ride Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'RIDE ASSIGNMENT', title: `Booking #${booking.bookingCode} assigned to you`, body: `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/><b>Pickup:</b> ${booking.patientLocation?.address || 'N/A'}<br/><b>Est. Distance:</b> ${distanceKm} km`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/driver/rides`, buttonText: 'View Ride' }) }).catch(() => {});
    sendEmail({ email: customer?.email, subject: `Driver Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'DRIVER ASSIGNED', title: `Driver assigned for Booking #${booking.bookingCode}`, body: `<b>Driver:</b> ${soloPartner.legalName}<br/><b>Phone:</b> ${soloPartner.phone}<br/><b>Vehicle:</b> ${vehicle.registrationNumber} ${vehicle.make} ${vehicle.model}<br/><b>Est. Distance:</b> ${distanceKm} km`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'Track Booking' }) }).catch(() => {});
    sendSms({ to: soloPartner.user.phone, message: `Hi ${soloPartner.legalName}, booking #${booking.bookingCode} assigned by admin. Check Likeson app.` }).catch(() => {});
    joinBookingRoom(soloPartner.user._id, booking._id);

    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', { bookingId: booking._id, status: 'confirmed', timestamp: new Date(), driverInfo: { name: soloPartner.legalName, phone: soloPartner.phone, driverType: 'solo', vehicleNumber: vehicle.registrationNumber }, mapRoute: { polyline, pickupCoords: coords.pickupCoords, pickupAddress: coords.pickupAddress, dropoffCoords: coords.dropoffCoords, dropoffAddress: coords.dropoffAddress, estimatedDistKm: distanceKm, estimatedMinutes: durationMin, currentTarget: 'pickup' } });

    await SystemLog.createLog({ level: 'success', category: 'api', message: `Admin assigned solo driver to #${booking.bookingCode}`, actor: { userId: req.user._id, role: req.user.role }, relatedEntity: { model: 'Booking', entityId: booking._id }, metadata: { soloDriverPartnerId, vehicleId: vehicle._id } });
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Solo driver assigned', data: { booking, ride, soloPartnerInfo: { soloPartnerId: soloPartner._id, name: soloPartner.legalName, phone: soloPartner.phone, vehicleNumber: vehicle.registrationNumber }, mapRoute: { estimatedDistKm: distanceKm, estimatedMinutes: durationMin } } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/bookings/:id/assign/transport-partner', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { transportPartnerId } = req.body;
    if (!transportPartnerId) return res.status(400).json({ success: false, message: 'transportPartnerId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const tp = await TransportPartner.findById(transportPartnerId).populate('user', 'name email phone').lean();
    if (!tp) return res.status(404).json({ success: false, message: 'TransportPartner not found' });
    if (tp.partnershipStatus !== 'active') return res.status(400).json({ success: false, message: 'TP not active' });

    await Booking.findByIdAndUpdate(booking._id, { $set: { transportPartner: transportPartnerId, status: 'confirmed', updatedBy: req.user._id } });

    await createNotification({ recipient: tp.user._id, title: 'New Booking Assigned to Fleet', body: `Booking #${booking.bookingCode} assigned. Please assign a driver.`, type: 'Ride_Request', bookingId: booking._id, priority: 'High' });
    sendEmail({ email: tp.user.email, subject: `New Booking #${booking.bookingCode} — Assign Driver | Likeson Healthcare`, html: transactionalTemplate({ header: 'BOOKING ASSIGNED TO YOUR FLEET', title: `Booking #${booking.bookingCode} needs a driver`, body: `<b>Type:</b> ${booking.bookingType}<br/><b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/><b>Patient:</b> ${booking.patientInfo?.name}`, buttonLink: `${process.env.FRONTEND_URL}/tp/bookings/${booking._id}`, buttonText: 'Assign Driver Now' }) }).catch(() => {});

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    sendEmail({ email: customer?.email, subject: `Transport Arranged — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'TRANSPORT UPDATE', title: `Transport arranged for Booking #${booking.bookingCode}`, body: `Transport partner <b>${tp.businessName || tp.ownerName}</b> assigned. Driver assigned shortly.`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'View Booking' }) }).catch(() => {});
    sendSms({ to: tp.user.phone, message: `Hi ${tp.user.name}, booking #${booking.bookingCode} assigned. Assign driver in Likeson dashboard.` }).catch(() => {});
    joinTpRoom(tp.user._id, tp._id);
    joinBookingRoom(tp.user._id, booking._id);
    getBookingSocketService()?.emitToRoom(`tp:${tp._id}`, 'booking_assigned', { bookingId: booking._id, bookingCode: booking.bookingCode, bookingType: booking.bookingType, scheduledAt: booking.scheduledAt });
    await SystemLog.createLog({ level: 'success', category: 'api', message: `Admin assigned TP to #${booking.bookingCode}`, actor: { userId: req.user._id, role: req.user.role }, relatedEntity: { model: 'Booking', entityId: booking._id }, metadata: { transportPartnerId } });
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Transport partner assigned. Awaiting driver assignment by TP.', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/bookings/:id/assign/care-assistant', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { careAssistantId } = req.body;
    if (!careAssistantId) return res.status(400).json({ success: false, message: 'careAssistantId required' });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    const ca = await CareAssistantProfile.findById(careAssistantId).populate('user', 'name phone email').lean();
    if (!ca) return res.status(404).json({ success: false, message: 'Care assistant not found' });
    if (!ca.isActive || !ca.verification?.isVerified) return res.status(400).json({ success: false, message: 'Care assistant not available or not verified' });

    let caJoinResult = null;

    if (booking.bookingType === 'full_care_ride' && booking.primaryRide) {
      const existingRide = await Ride.findById(booking.primaryRide).select('pickup dropoff liveLocation trackingId status activeRouteVersionId').lean();
      const tracking = existingRide?.trackingId ? await RideTracking.findById(existingRide.trackingId).select('expectedRoutePolyline').lean() : null;
      const caCoords = ca.location?.coordinates;
      const driverCurrentCoords = existingRide?.liveLocation?.coordinates || existingRide?.pickup?.coordinates || [80.648, 16.506];
      const pickupCoords  = existingRide?.pickup?.coordinates;
      const dropoffCoords = existingRide?.dropoff?.coordinates;

      if (caCoords && pickupCoords && dropoffCoords) {
        caJoinResult = resolveCaJoinPoint({ caCoords, driverCoords: driverCurrentCoords, pickupCoords, dropoffCoords, encodedPolyline: tracking?.expectedRoutePolyline ?? null });

        // Deactivate old CA participant
        let oldCaPart = await RideParticipant.findOneAndUpdate({ ride: booking.primaryRide, role: 'CARE_ASSISTANT', isActive: true }, { $set: { isActive: false } }, { new: true }).lean();

        const newCaParticipant = await RideParticipant.create({
          ride: booking.primaryRide, booking: booking._id, role: 'CARE_ASSISTANT', refModel: 'CareAssistantProfile', refId: careAssistantId,
          isReplacement: !!oldCaPart, replacesParticipant: oldCaPart?._id || null,
          snapshot: { name: ca.fullName, phone: ca.user?.phone, photoUrl: ca.photoUrl }, assignedBy: req.user._id,
        });

        await AssignmentHistory.create({ ride: booking.primaryRide, booking: booking._id, assignmentType: 'PARTICIPANT', entityRefModel: 'CareAssistantProfile', entityRefId: careAssistantId, action: oldCaPart ? 'REPLACED' : 'ASSIGNED', previousAssignmentId: oldCaPart?._id || null, performedBy: req.user._id, effectiveAt: new Date() });

        // Supersede old JoinPoints
        await JoinPoint.updateMany({ ride: booking.primaryRide, participant: newCaParticipant._id, isActive: true }, { $set: { isActive: false } });
        const lastJp = await JoinPoint.findOne({ ride: booking.primaryRide }, {}, { sort: { attemptNumber: -1 } }).lean();

        const jp = await JoinPoint.create({
          ride: booking.primaryRide, booking: booking._id, participant: newCaParticipant._id,
          location: { type: 'Point', coordinates: caJoinResult.joinPoint },
          calculatedBy: 'routing_engine', calculationMeta: { distanceFromParticipantKm: caJoinResult.distCaToJoinKm },
          status: 'LOCKED', attemptNumber: (lastJp?.attemptNumber || 0) + 1, lockedAt: new Date(), createdBy: req.user._id,
        });

        // Create RideStop for CA join
        const activeRv = existingRide?.activeRouteVersionId ? await RouteVersion.findById(existingRide.activeRouteVersionId).select('versionNumber').lean() : null;
        if (activeRv) {
          await RideStop.updateMany({ ride: booking.primaryRide, stopType: 'CARE_ASSISTANT_JOIN', isActive: true }, { $set: { isActive: false } });
          const caStopSeq = caJoinResult.zone === 'before_pickup' ? 1 : 2;
          await RideStop.updateMany({ ride: booking.primaryRide, routeVersion: activeRv.versionNumber, sequence: { $gte: caStopSeq }, isActive: true }, { $inc: { sequence: 1 } });
          await RideStop.create({
            ride: booking.primaryRide, booking: booking._id, routeVersion: activeRv.versionNumber, sequence: caStopSeq,
            stopType: 'CARE_ASSISTANT_JOIN',
            location: { type: 'Point', coordinates: caJoinResult.joinPoint, address: caJoinResult.joinPointAddress || 'CA Join Point', label: `CA Join — ${caJoinResult.zone}` },
            participant: newCaParticipant._id, status: 'PENDING',
            meta: { zone: caJoinResult.zone, distCaToJoinKm: caJoinResult.distCaToJoinKm, caFrom: ca.location?.coordinates },
          });
        }

        // Attach to RideTracking
        RideTracking.attachParticipant(booking.primaryRide, { participantId: newCaParticipant._id, role: 'CARE_ASSISTANT' }).then(() => {
          if (ca.location?.coordinates) RideTracking.updateParticipantLocation(booking.primaryRide, newCaParticipant._id, { coordinates: ca.location.coordinates, source: 'gps' }).catch(() => {});
        }).catch(() => {});

        getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_attached_to_ride', {
          bookingId: booking._id, rideId: booking.primaryRide, careAssistantId, careAssistantName: ca.fullName, timestamp: new Date(),
          caJoinPoint: { coordinates: caJoinResult.joinPoint, zone: caJoinResult.zone, distCaToJoinKm: caJoinResult.distCaToJoinKm, caRoute: { from: caJoinResult.caRoute.from, to: caJoinResult.caRoute.to, distKm: caJoinResult.caRoute.distKm, note: 'CA travels independently to join point' } },
        });
      }
    } else if (booking.primaryRide) {
      // Non-full_care_ride — still create participant + tracking link
      const oldPart = await RideParticipant.findOneAndUpdate({ ride: booking.primaryRide, role: 'CARE_ASSISTANT', isActive: true }, { $set: { isActive: false } }).lean();
      const newPart = await RideParticipant.create({
        ride: booking.primaryRide, booking: booking._id, role: 'CARE_ASSISTANT', refModel: 'CareAssistantProfile', refId: careAssistantId,
        isReplacement: !!oldPart, replacesParticipant: oldPart?._id || null,
        snapshot: { name: ca.fullName, phone: ca.user?.phone, photoUrl: ca.photoUrl }, assignedBy: req.user._id,
      });
      await AssignmentHistory.create({ ride: booking.primaryRide, booking: booking._id, assignmentType: 'PARTICIPANT', entityRefModel: 'CareAssistantProfile', entityRefId: careAssistantId, action: oldPart ? 'REPLACED' : 'ASSIGNED', performedBy: req.user._id, effectiveAt: new Date() });
      RideTracking.attachParticipant(booking.primaryRide, { participantId: newPart._id, role: 'CARE_ASSISTANT' }).catch(() => {});
    }

    await Booking.findByIdAndUpdate(booking._id, { $set: { careAssistant: careAssistantId, updatedBy: req.user._id } });

    await createNotification({ recipient: ca.user._id, title: 'New Care Request', body: `Assigned to booking #${booking.bookingCode}`, type: 'Care_Assistant_Assigned', bookingId: booking._id, priority: 'High' });
    const customer = await User.findById(booking.customer).select('phone name email').lean();

    sendSms({ to: ca.user.phone, message: newCareRequestToAssistantSms({ assistantName: ca.fullName, requestId: booking.bookingCode, patientName: booking.patientInfo?.name, location: booking.patientLocation?.address || '', scheduledAt: new Date(booking.scheduledAt).toLocaleString('en-IN') }) }).catch(() => {});
    sendSms({ to: customer?.phone, message: careAssistantAssignedSms({ userName: customer?.name, requestId: booking.bookingCode, assistantName: ca.fullName, assistantPhone: ca.user.phone }) }).catch(() => {});

    sendEmail({ email: ca.user.email, subject: `Care Request Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({
      header: 'CARE ASSIGNMENT', title: `Booking #${booking.bookingCode} assigned to you`,
      body: booking.bookingType === 'full_care_ride' && caJoinResult
        ? `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/><b>Location:</b> ${booking.patientLocation?.address || 'N/A'}<br/><b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/><br/><b>Your Join Point:</b> ${caJoinResult.zone.replace(/_/g, ' ')}<br/><b>Distance to join:</b> ${caJoinResult.distCaToJoinKm} km<br/><b>Action:</b> Travel to join point and wait for driver.`
        : `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/><b>Location:</b> ${booking.patientLocation?.address || 'N/A'}<br/><b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`,
      buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/care/bookings`, buttonText: 'View Booking',
    }) }).catch(() => {});

    sendEmail({ email: customer?.email, subject: `Care Assistant Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'CARE ASSISTANT ASSIGNED', title: `Care assistant for Booking #${booking.bookingCode}`, body: `<b>Care Assistant:</b> ${ca.fullName}<br/><b>Phone:</b> ${ca.user.phone}`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'View Booking' }) }).catch(() => {});

    try { getBookingSocketService()?.emitJoinRoom(String(ca.user._id), `booking:${booking._id}`); } catch (e) {}
    getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_assigned', { bookingId: booking._id, careAssistantName: ca.fullName });

    await SystemLog.createLog({ level: 'success', category: 'api', message: `Admin assigned care assistant to #${booking.bookingCode}`, actor: { userId: req.user._id, role: req.user.role }, relatedEntity: { model: 'Booking', entityId: booking._id }, metadata: { careAssistantId, caJoinZone: caJoinResult?.zone ?? null, distCaToJoinKm: caJoinResult?.distCaToJoinKm ?? null } });

    return res.json({ success: true, message: 'Care assistant assigned', data: { booking, caJoinPoint: caJoinResult ? { coordinates: caJoinResult.joinPoint, zone: caJoinResult.zone, distCaToJoinKm: caJoinResult.distCaToJoinKm, caRoute: { from: caJoinResult.caRoute.from, to: caJoinResult.caRoute.to, distKm: caJoinResult.caRoute.distKm, note: 'CA navigates to this point independently' } } : null } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/bookings/:id/assign/hospital', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { hospitalId } = req.body;
    
    // Add MongoDB ObjectId validation
    if (!hospitalId || !hospitalId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Valid hospitalId required in proper format' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    const hospital = await Hospital.findById(hospitalId).populate('managedBy', 'name email phone').select('name isActive isVerified managedBy address contact').lean();
    if (!hospital?.isActive || !hospital?.isVerified) return res.status(400).json({ success: false, message: 'Hospital not operational' });

    await Booking.findByIdAndUpdate(booking._id, { $set: { hospital: hospitalId, updatedBy: req.user._id } });

    if (hospital.managedBy?.email) emailHospitalBookingUpdate({ hospitalUser: hospital.managedBy, booking, subject: `New Booking Assigned — #${booking.bookingCode} | Likeson Healthcare`, body: `<b>Patient:</b> ${booking.patientInfo?.name || 'N/A'}<br/><b>Type:</b> ${booking.bookingType}<br/><b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>Please confirm appointment in dashboard.` }).catch(() => {});

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    sendEmail({ email: customer?.email, subject: `Hospital Assigned — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'HOSPITAL ASSIGNED', title: `${hospital.name} assigned for Booking #${booking.bookingCode}`, body: `Appointment at <b>${hospital.name}</b>.<br/><b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'View Booking' }) }).catch(() => {});
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Hospital linked', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/admin/bookings/:id/reassign/care', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newCareAssistantId } = req.body;
    if (!newCareAssistantId) return res.status(400).json({ success: false, message: 'newCareAssistantId required' });
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    await Booking.findByIdAndUpdate(booking._id, { $set: { careAssistant: newCareAssistantId, updatedBy: req.user._id } });

    const ca = await CareAssistantProfile.findById(newCareAssistantId).populate('user', 'phone name email').lean();
    const customer = await User.findById(booking.customer).select('email phone name').lean();

    if (ca) {
      await createNotification({ recipient: ca.user._id, title: 'Care Booking Reassigned', body: `Booking #${booking.bookingCode} reassigned to you.`, type: 'Care_Assistant_Assigned', bookingId: booking._id });
      emailCareAssistantAssigned({ caUser: ca.user, caName: ca.fullName, booking, verb: 'reassigned' }).catch(() => {});
      joinBookingRoom(ca.user._id, booking._id);

      // Update participant if ride active
      if (booking.primaryRide) {
        const oldPart = await RideParticipant.findOneAndUpdate({ ride: booking.primaryRide, role: 'CARE_ASSISTANT', isActive: true }, { $set: { isActive: false } }).lean();
        const newPart = await RideParticipant.create({ ride: booking.primaryRide, booking: booking._id, role: 'CARE_ASSISTANT', refModel: 'CareAssistantProfile', refId: newCareAssistantId, isReplacement: !!oldPart, replacesParticipant: oldPart?._id || null, snapshot: { name: ca.fullName, phone: ca.user?.phone, photoUrl: ca.photoUrl }, assignedBy: req.user._id });
        await AssignmentHistory.create({ ride: booking.primaryRide, booking: booking._id, assignmentType: 'PARTICIPANT', entityRefModel: 'CareAssistantProfile', entityRefId: newCareAssistantId, action: 'REPLACED', performedBy: req.user._id, reason: 'Admin reassignment', effectiveAt: new Date() });
        RideTracking.attachParticipant(booking.primaryRide, { participantId: newPart._id, role: 'CARE_ASSISTANT' }).catch(() => {});
      }
    }

    sendEmail({ email: customer?.email, subject: `Care Assistant Updated — Booking #${booking.bookingCode} | Likeson Healthcare`, html: transactionalTemplate({ header: 'CARE ASSISTANT UPDATED', title: `Care assistant updated for Booking #${booking.bookingCode}`, body: `<b>New Care Assistant:</b> ${ca?.fullName || 'N/A'}<br/><b>Phone:</b> ${ca?.user?.phone || 'N/A'}`, buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}`, buttonText: 'View Booking' }) }).catch(() => {});
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Care assistant reassigned' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/admin/bookings/:id/refund', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { refundAmount, reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const amount     = refundAmount ?? booking.fareBreakdown?.amountPaid ?? 0;
    const prevStatus = booking.status;

    const rzpPayment = booking.payments?.find(p => p.gateway === 'Razorpay' && p.status === 'success');
    if (rzpPayment?.transactionId && amount > 0) {
      try { await razorpay.payments.refund(rzpPayment.transactionId, { amount: Math.round(amount * 100), notes: { reason: reason || 'Admin initiated refund', bookingCode: booking.bookingCode } }); rzpPayment.status = 'refunded'; rzpPayment.refundedAt = new Date(); }
      catch (rzpErr) { console.error('[Refund] Razorpay refund failed:', rzpErr.message); }
    }

    const walletPayment = booking.payments?.find(p => p.gateway === 'Wallet' && p.status === 'success');
    if (walletPayment && amount > 0) {
      try { const wallet = await Wallet.findOne({ user: booking.customer }); if (wallet) await wallet.credit(amount, 'Refund', { referenceId: booking._id, onModel: 'Booking', description: `Refund for booking ${booking.bookingCode}`, initiatedBy: req.user._id }); }
      catch (wErr) { console.error('[Refund] Wallet refund failed:', wErr.message); }
    }

    booking.fareBreakdown.refundAmount = amount;
    booking.paymentStatus              = 'refunded';
    booking.status                     = 'refunded';
    await recoverSubscriptionUsageOnCancel(booking).catch(e => console.error('[admin/refund] recovery failed:', e.message));
    booking.statusLog.push({ fromStatus: prevStatus, toStatus: 'refunded', changedBy: req.user._id, reason: reason || 'Admin initiated refund' });
    booking.updatedBy = req.user._id;
    await booking.save();

    const customer = await User.findById(booking.customer).select('email phone name').lean();
    await createNotification({ recipient: booking.customer, title: 'Refund Processed', body: `Refund of ₹${amount} for booking #${booking.bookingCode} processed.`, type: 'Refund_Processed', bookingId: booking._id });
    const refundMethod = rzpPayment ? 'Original_Source' : walletPayment ? 'Wallet' : 'Original_Source';
    sendEmail({ email: customer?.email, subject: `Refund Processed — Booking #${booking.bookingCode} | Likeson Healthcare`, html: buildRefundEmail({ userName: customer?.name || 'Valued Customer', order: { orderId: booking.bookingCode }, refundAmount: amount, refundMethod, actionLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/bookings/${booking._id}` }) }).catch(() => {});
    await invalidateBookingCache();
    return res.json({ success: true, message: 'Refund initiated', data: { booking } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin OP management ────────────────────────────────────────────────────

router.get('/admin/ops',
  protect, authorize('admin', 'superadmin'),
  cache(CACHE_TTL.ops, req => `GET:/admin/ops:${req.originalUrl}`),
  async (req, res) => {
    try {
      const { doctorId, hospitalId, date, page = 1, limit = 20, status, patientId } = req.query;
      const filter = {};
      if (doctorId)   filter.doctor   = doctorId;
      if (hospitalId) filter.hospital = hospitalId;
      if (patientId)  filter.patient  = patientId;
      if (status)     filter.status   = status;
      if (date) { const d = new Date(date), n = new Date(d); n.setDate(n.getDate() + 1); filter.scheduledAt = { $gte: d, $lt: n }; }
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [ops, total] = await Promise.all([
        OutPatientRecord.find(filter).sort({ scheduledAt: -1 }).skip(skip).limit(parseInt(limit)).populate('doctor', 'user specialization registrationNumber').populate('hospital', 'name address contact').populate('patient', 'name phone email').lean(),
        OutPatientRecord.countDocuments(filter),
      ]);
      return res.json({ success: true, data: { ops, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

router.patch('/admin/ops/:id/status', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { status, doctorNotes } = req.body;
    const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: `Invalid status. Valid: ${validStatuses.join(', ')}` });

    const op = await OutPatientRecord.findByIdAndUpdate(req.params.id, { status, ...(doctorNotes ? { doctorNotes } : {}), ...(status === 'completed' ? { completedAt: new Date() } : {}) }, { new: true })
      .populate({ path: 'doctor', populate: { path: 'user', select: 'name email' } }).populate('hospital', 'name managedBy').populate('patient', 'name email phone');
    if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

    if (status === 'completed') {
      const booking   = await Booking.findById(op.booking).lean();
      const patient   = await User.findById(op.patient._id || op.patient).select('email name phone').lean();
      const followUps = await OutPatientRecord.find({ parentOp: op._id }).sort({ scheduledAt: -1 }).lean();
      const opPlain   = op.toObject ? op.toObject() : op;
      if (patient?.email) sendOpZipEmail({ op: opPlain, booking, patient, followUps });
      if (booking?.consultationSessionId) {
        Consultation.findOneAndUpdate({ _id: booking.consultationSessionId, status: { $in: ['active', 'paused', 'waiting'] } }, { status: 'completed', actualEndTime: new Date(), roomEnded: true, endedBy: 'admin', updatedBy: req.user._id }, { new: true }).catch(() => {});
      }
    }

    if (op.doctor?.user) {
      const doctorUser = await User.findById(op.doctor.user._id || op.doctor.user).select('email name').lean();
      if (doctorUser?.email) emailDoctorBookingUpdate({ doctorUser, booking: { bookingCode: op.bookingNumber || 'N/A', _id: op.booking, patientInfo: { name: op.patientName }, scheduledAt: op.scheduledAt }, subject: `OP Record Updated — ${op.opNumber} | Likeson Healthcare`, body: `<b>OP:</b> ${op.opNumber}<br/><b>Patient:</b> ${op.patientName || 'N/A'}<br/><b>Status:</b> ${status}` }).catch(() => {});
    }
    if (op.hospital?.managedBy) {
      const hospitalUser = await User.findById(op.hospital.managedBy).select('email name').lean();
      if (hospitalUser?.email) emailHospitalBookingUpdate({ hospitalUser, booking: { bookingCode: op.bookingNumber || 'N/A', _id: op.booking, patientInfo: { name: op.patientName }, scheduledAt: op.scheduledAt }, subject: `OP Record Updated — ${op.opNumber} | Likeson Healthcare`, body: `<b>OP:</b> ${op.opNumber}<br/><b>Patient:</b> ${op.patientName || 'N/A'}<br/><b>Status:</b> ${status}` }).catch(() => {});
    }

    await invalidateBookingCache();
    return res.json({ success: true, message: 'OP status updated', data: { op } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN SOS ROUTES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/sos/active
 * List all unresolved SOS events.
 */
router.get('/admin/sos/active', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const events = await SosEvent.find({ isResolved: false })
      .populate('ride', 'status rideCode driverSnapshot vehicleSnapshot liveLocation')
      .populate('booking', 'bookingCode bookingType patientInfo')
      .populate('triggeredByUserId', 'name phone role')
      .sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: { events, total: events.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /admin/sos/:sosEventId/resolve
 * Admin resolves a SOS event.
 */
router.patch('/admin/sos/:sosEventId/resolve', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { resolutionNotes } = req.body;
    const sosEvent = await SosEvent.findById(req.params.sosEventId);
    if (!sosEvent) return res.status(404).json({ success: false, message: 'SOS event not found' });
    if (sosEvent.isResolved) return res.status(400).json({ success: false, message: 'SOS already resolved' });

    sosEvent.isResolved     = true;
    sosEvent.resolvedAt     = new Date();
    sosEvent.resolvedBy     = req.user._id;
    sosEvent.resolutionNotes = resolutionNotes || '';
    await sosEvent.save();

    // Sync hasActiveSos flag on RideTracking
    const stillActive = await SosEvent.exists({ ride: sosEvent.ride, isResolved: false });
    await RideTracking.syncSosFlag(sosEvent.ride, !!stillActive);

    getBookingSocketService()?.emitToRoom(`booking:${sosEvent.booking}`, 'sos_resolved', { sosEventId: sosEvent._id, resolvedBy: req.user._id, resolutionNotes, timestamp: new Date() });
    getBookingSocketService()?.emitToAdminOps('sos_resolved', { sosEventId: sosEvent._id, bookingId: sosEvent.booking, rideId: sosEvent.ride });

    return res.json({ success: true, message: 'SOS resolved', data: { sosEvent } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /admin/destination-audit/:bookingId
 * Admin fetches all destination changes for a booking.
 */
router.get('/admin/destination-audit/:bookingId', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const audits = await DestinationChangeAudit.find({ booking: req.params.bookingId })
      .populate('changedBy', 'name email role').sort({ changedAt: -1 }).lean();
    return res.json({ success: true, data: { audits, total: audits.length } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;