/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OP (OUTPATIENT) ROUTER — Likeson.in
 * routes/opRouter.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Every doctor_consultation booking generates an OP (Outpatient) record.
 *
 * OP Number format:  OP-<YYYYMMDD>-<HOSPCODE>-<4-digit-seq>
 * Example:           OP-20260427-VIJAYA-0023
 *
 * ROLES & ACCESS:
 *   customer    → view own OPs, check follow-up eligibility
 *   doctor      → view OPs for their consultations, add notes/prescription
 *   hospital    → view OPs for their hospital
 *   admin/super → full CRUD, daily register, stats, reprint slip
 *
 * FOLLOW-UP LOGIC:
 *   Each OP stores followUpExpiry (scheduledAt + followUpValidDays).
 *   Within that window → patient can book next consultation at followUpFee (often 0).
 *   After expiry → full consultation fee applies.
 *
 * SUBSCRIPTION LOGIC:
 *   If isCoveredBySubscription = true → consultation deducted from monthly limit.
 *   If subscription expires before follow-up → full fee at next booking.
 *
 * OP SLIP / PRINT:
 *   GET /ops/:id/slip → returns JSON formatted for PDF/print.
 *   Admin can reprint any slip. Customer/doctor see own.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import mongoose       from 'mongoose';
import crypto         from 'crypto';

// ── Models ────────────────────────────────────────────────────────────────────
import OutPatientRecord    from '../models/OutPatientRecord.js';
import Booking             from '../models/Booking.js';
import DoctorProfile       from '../models/DoctorProfile.js';
import Hospital            from '../models/Hospital.js';
import User                from '../models/User.js';
import Notification        from '../models/Notification.js';
import SystemLog           from '../models/SystemLog.js';
import UserSubscription    from '../models/UserSubscription.js';

// ── Utils ─────────────────────────────────────────────────────────────────────
import sendEmail    from '../utils/sendEmail.js';
import sendSms      from '../utils/sendSms.js';
import { transactionalTemplate } from '../templates/emailTemplates.js';

// ── Auth ──────────────────────────────────────────────────────────────────────
import { protect, authorize } from '../middleware/authMiddleware.js';


// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** In-app + push notification */
const createNotification = async ({ recipient, title, body, type, entityId, priority = 'Medium' }) => {
  try {
    await Notification.create({
      recipient,
      title,
      body,
      type,
      priority,
      relatedEntityType: 'OutPatientRecord',
      relatedEntityId:   entityId,
      channels: [{ channel: 'InApp' }, { channel: 'Push' }],
    });
  } catch (e) {
    console.error('[createNotification]', e.message);
  }
};

/**
 * Generate OP number.
 * Format: OP-<YYYYMMDD>-<HOSPCODE>-<4-digit-seq>
 * Seq = total OPs for that hospital on that date + 1
 * Thread-safe enough for single-server; for multi-server use a counter collection.
 *
 * @param {string|null} hospitalId
 * @returns {Promise<string>}
 */
const generateOpNumber = async (hospitalId) => {
  const now  = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, ''); // "20260427"

  let hospCode = 'GEN';
  if (hospitalId) {
    const hosp = await Hospital.findById(hospitalId).select('slug name').lean();
    if (hosp) {
      hospCode = (hosp.slug || hosp.name || 'GEN')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 6);
    }
  }

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const count = await OutPatientRecord.countDocuments({
    createdAt: { $gte: startOfDay },
    ...(hospitalId ? { hospital: hospitalId } : { hospital: null }),
  });

  const seq = String(count + 1).padStart(4, '0');
  return `OP-${date}-${hospCode}-${seq}`;
};

/**
 * Build OP slip payload — structured for PDF/print rendering.
 * @param {object} op  — populated OutPatientRecord
 * @returns {object}
 */
const buildSlipPayload = (op) => ({
  slipType:         'OUTPATIENT_REGISTRATION',
  opNumber:         op.opNumber,
  generatedAt:      new Date().toISOString(),

  patient: {
    name:   op.patientName,
    id:     op.patient?._id || op.patient,
    phone:  op.patient?.phone || null,
    email:  op.patient?.email || null,
  },

  doctor: {
    name:           op.doctor?.user?.name || 'Doctor',
    specialization: op.doctor?.specialization || '',
    id:             op.doctor?._id || op.doctor,
  },

  hospital: op.hospital
    ? {
        name:    op.hospital?.name || '',
        address: op.hospital?.address
          ? `${op.hospital.address.line1 || ''}, ${op.hospital.address.city || ''}`
          : '',
        phone:   op.hospital?.contact?.phone || '',
      }
    : null,

  consultation: {
    type:        op.consultationType,
    scheduledAt: op.scheduledAt,
    isFollowUp:  op.isFollowUp,
    status:      op.status,
  },

  billing: {
    consultationFee:         op.consultationFee,
    feeSource:               op.feeSource,
    isCoveredBySubscription: op.isCoveredBySubscription,
    followUpFee:             op.followUpFee,
  },

  followUp: op.followUpExpiry
    ? {
        eligibleUntil:  op.followUpExpiry,
        followUpFee:    op.followUpFee,
        isEligible:     new Date() < op.followUpExpiry,
        daysRemaining:  Math.max(
          Math.ceil((new Date(op.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24)),
          0
        ),
      }
    : null,

  bookingNumber: op.bookingNumber,
});

/**
 * Check if requesting user can access this OP record.
 * Returns true if allowed.
 */
const canAccessOp = async (op, userId, role) => {
  if (['admin', 'superadmin'].includes(role)) return true;
  if (op.patient?.toString() === userId)       return true;

  // Doctor linked to this OP
  if (role === 'doctor') {
    const docProfile = await DoctorProfile.findOne({ user: userId }).select('_id').lean();
    if (docProfile && op.doctor?.toString() === docProfile._id.toString()) return true;
  }

  // Hospital manager
  if (role === 'hospital') {
    const hosp = await Hospital.findOne({ managedBy: userId }).select('_id').lean();
    if (hosp && op.hospital?.toString() === hosp._id.toString()) return true;
  }

  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// CUSTOMER ROUTES
// ══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /ops/my
 * Customer's own OP history — paginated, filterable.
 */

import asyncHandler from '../utils/asyncHandler.js';

// GET '/my'
export const getMy = asyncHandler(async (req, res) => {
  try {
    const { status, doctorId, hospitalId, from, to, page = 1, limit = 10 } = req.query;
    const filter = { patient: req.user._id };

    if (status)     filter.status   = status;
    if (doctorId)   filter.doctor   = doctorId;
    if (hospitalId) filter.hospital = hospitalId;
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to)   filter.scheduledAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [ops, total] = await Promise.all([
      OutPatientRecord.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('doctor',   'user specialization')
        .populate('hospital', 'name address contact')
        .lean(),
      OutPatientRecord.countDocuments(filter),
    ]);

    // Attach follow-up eligibility flag to each op
    const now      = new Date();
    const enriched = ops.map(op => ({
      ...op,
      followUpEligible: op.followUpExpiry ? now < new Date(op.followUpExpiry) : false,
      daysUntilExpiry:  op.followUpExpiry
        ? Math.max(Math.ceil((new Date(op.followUpExpiry) - now) / (1000 * 60 * 60 * 24)), 0)
        : 0,
    }));

    return res.json({
      success: true,
      data:    { ops: enriched, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error('[GET /ops/my]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id'
export const getById = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const op = await OutPatientRecord.findById(req.params.id)
      .populate('patient',  'name phone email')
      .populate('doctor',   'user specialization fees')
      .populate('hospital', 'name address contact consultationPricing')
      .populate('parentOp', 'opNumber scheduledAt consultationType')
      .lean();

    if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

    const allowed = await canAccessOp(op, req.user._id.toString(), req.user.role);
    if (!allowed) return res.status(403).json({ success: false, message: 'Access denied' });

    const now = new Date();
    return res.json({
      success: true,
      data: {
        op: {
          ...op,
          followUpEligible: op.followUpExpiry ? now < new Date(op.followUpExpiry) : false,
          daysUntilFollowUpExpiry: op.followUpExpiry
            ? Math.max(Math.ceil((new Date(op.followUpExpiry) - now) / (1000 * 60 * 60 * 24)), 0)
            : 0,
        },
      },
    });
  } catch (err) {
    console.error('[GET /ops/:id]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/slip'
export const getByIdSlip = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const op = await OutPatientRecord.findById(req.params.id)
      .populate('patient',  'name phone email')
      .populate('doctor',   'user specialization')
      .populate('hospital', 'name address contact')
      .lean();

    if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

    const allowed = await canAccessOp(op, req.user._id.toString(), req.user.role);
    if (!allowed) return res.status(403).json({ success: false, message: 'Access denied' });

    const slip = buildSlipPayload(op);

    return res.json({ success: true, data: { slip } });
  } catch (err) {
    console.error('[GET /ops/:id/slip]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:id/followup-eligibility'
export const getByIdFollowupEligibility = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const op = await OutPatientRecord.findOne({
      _id:     req.params.id,
      patient: req.user._id, // customer can only check own OPs
    }).lean();

    if (!op) return res.status(404).json({ success: false, message: 'OP record not found' });

    const now             = new Date();
    const isWithinWindow  = op.followUpExpiry && now < new Date(op.followUpExpiry);
    const daysRemaining   = op.followUpExpiry
      ? Math.max(Math.ceil((new Date(op.followUpExpiry) - now) / (1000 * 60 * 60 * 24)), 0)
      : 0;

    // Check if subscription still active
    const sub = await UserSubscription.findOne({
      user:   req.user._id,
      status: { $in: ['Active', 'Trial'] },
      expiryDate: { $gt: now },
    }).select('limits.consultationsPerMonth status expiryDate').lean();

    const subActive      = !!sub;
    const subConsultsLeft = sub
      ? (sub.limits?.consultationsPerMonth === -1 ? Infinity : sub.limits?.consultationsPerMonth ?? 0)
      : 0;

    return res.json({
      success: true,
      data: {
        opNumber:         op.opNumber,
        isEligible:       isWithinWindow,
        daysRemaining,
        followUpFee:      isWithinWindow ? op.followUpFee : null,
        followUpExpiry:   op.followUpExpiry,
        subscriptionActive: subActive,
        subscriptionConsultationsLeft: subConsultsLeft,
        message: isWithinWindow
          ? `Follow-up eligible. Fee: ₹${op.followUpFee}. ${daysRemaining} day(s) remaining.`
          : 'Follow-up window expired. Full consultation fee applies.',
      },
    });
  } catch (err) {
    console.error('[GET /ops/:id/followup-eligibility]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/doctor/my'
export const getDoctorMy = asyncHandler(async (req, res) => {
  try {
    const docProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!docProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const { status, date, from, to, page = 1, limit = 20 } = req.query;
    const filter = { doctor: docProfile._id };

    if (status) filter.status = status;
    if (date) {
      const d       = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.scheduledAt = { $gte: d, $lt: nextDay };
    } else if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to)   filter.scheduledAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [ops, total] = await Promise.all([
      OutPatientRecord.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('patient',  'name phone email')
        .populate('hospital', 'name address')
        .lean(),
      OutPatientRecord.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { ops, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error('[GET /ops/doctor/my]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/doctor/today'
export const getDoctorToday = asyncHandler(async (req, res) => {
  try {
    const docProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!docProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const ops = await OutPatientRecord.find({
      doctor:      docProfile._id,
      scheduledAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ scheduledAt: 1 })
      .populate('patient', 'name phone email')
      .lean();

    const stats = {
      total:      ops.length,
      scheduled:  ops.filter(o => o.status === 'scheduled').length,
      inProgress: ops.filter(o => o.status === 'in_progress').length,
      completed:  ops.filter(o => o.status === 'completed').length,
      noShow:     ops.filter(o => o.status === 'no_show').length,
      cancelled:  ops.filter(o => o.status === 'cancelled').length,
      followUps:  ops.filter(o => o.isFollowUp).length,
    };

    return res.json({ success: true, data: { ops, stats } });
  } catch (err) {
    console.error('[GET /ops/doctor/today]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/start'
export const patchByIdStart = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const docProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!docProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const op = await OutPatientRecord.findOne({
      _id:    req.params.id,
      doctor: docProfile._id,
    });
    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    if (!['scheduled'].includes(op.status))
      return res.status(400).json({ success: false, message: `Cannot start OP in status: ${op.status}` });

    op.status    = 'in_progress';
    op.startedAt = new Date();
    await op.save();

    // Notify patient
    await createNotification({
      recipient: op.patient,
      title:     'Consultation Started',
      body:      `Your consultation (OP: ${op.opNumber}) has started.`,
      type:      'Consultation_Started',
      entityId:  op._id,
    });

    return res.json({ success: true, message: 'Consultation started', data: { op } });
  } catch (err) {
    console.error('[PATCH /ops/:id/start]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/complete'
export const patchByIdComplete = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const docProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!docProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const op = await OutPatientRecord.findOne({
      _id:    req.params.id,
      doctor: docProfile._id,
    });
    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    if (!['scheduled', 'in_progress'].includes(op.status))
      return res.status(400).json({ success: false, message: `Cannot complete OP in status: ${op.status}` });

    const { doctorNotes, prescriptionUrl, diagnosisCode } = req.body;

    op.status          = 'completed';
    op.completedAt     = new Date();
    if (doctorNotes)    op.doctorNotes    = doctorNotes;
    if (prescriptionUrl) op.prescriptionUrl = prescriptionUrl;
    if (diagnosisCode)  op.diagnosisCode  = diagnosisCode;
    if (!op.startedAt)  op.startedAt      = new Date(); // in case start was skipped
    await op.save();

    // Update booking consultation sub-doc
    await Booking.findByIdAndUpdate(op.booking, {
      'consultation.endedAt':         new Date(),
      'consultation.doctorNotes':     doctorNotes || '',
      'consultation.prescriptionUrl': prescriptionUrl || '',
    });

    const patient = await User.findById(op.patient).select('email phone name').lean();

    // Notify patient
    await createNotification({
      recipient: op.patient,
      title:     'Consultation Completed',
      body:      `Your consultation (OP: ${op.opNumber}) is complete. ${op.followUpExpiry ? `Follow-up available until ${new Date(op.followUpExpiry).toLocaleDateString('en-IN')}.` : ''}`,
      type:      'Consultation_Completed',
      entityId:  op._id,
    });

    // Send email with follow-up info
    try {
      await sendEmail({
        email:   patient.email,
        subject: `Consultation Complete — OP: ${op.opNumber}`,
        html: transactionalTemplate({
          header: 'CONSULTATION COMPLETED',
          title:  `Consultation ${op.opNumber} completed`,
          body: `
            <b>Doctor Notes:</b> ${doctorNotes || 'N/A'}<br/>
            ${prescriptionUrl ? `<b>Prescription:</b> <a href="${prescriptionUrl}">Download</a><br/>` : ''}
            ${op.followUpExpiry
              ? `<b>Follow-up:</b> Available until ${new Date(op.followUpExpiry).toLocaleDateString('en-IN')} at ₹${op.followUpFee || 0}<br/>`
              : ''}
          `,
          buttonLink: `${process.env.FRONTEND_URL}/ops/${op._id}`,
          buttonText: 'View OP Details',
        }),
      });
    } catch (e) { console.error('[OP complete] Email:', e.message); }

    return res.json({
      success: true,
      message: 'Consultation completed',
      data:    { op },
    });
  } catch (err) {
    console.error('[PATCH /ops/:id/complete]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/no-show'
export const patchByIdNoShow = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const docProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!docProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const op = await OutPatientRecord.findOne({ _id: req.params.id, doctor: docProfile._id });
    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    if (!['scheduled', 'in_progress'].includes(op.status))
      return res.status(400).json({ success: false, message: `Cannot mark no-show in status: ${op.status}` });

    op.status = 'no_show';
    await op.save();

    await createNotification({
      recipient: op.patient,
      title:     'Missed Consultation',
      body:      `You missed your consultation (OP: ${op.opNumber}). Please rebook.`,
      type:      'Consultation_NoShow',
      entityId:  op._id,
      priority:  'High',
    });

    // Update booking status
    await Booking.findByIdAndUpdate(op.booking, { status: 'no_show' });

    return res.json({ success: true, message: 'Marked as no-show', data: { op } });
  } catch (err) {
    console.error('[PATCH /ops/:id/no-show]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/:id/notes'
export const patchByIdNotes = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const docProfile = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!docProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const op = await OutPatientRecord.findOne({ _id: req.params.id, doctor: docProfile._id });
    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    // Allow edit within 24h of completion
    if (op.status === 'completed' && op.completedAt) {
      const hoursElapsed = (Date.now() - new Date(op.completedAt).getTime()) / (1000 * 60 * 60);
      if (hoursElapsed > 24)
        return res.status(400).json({ success: false, message: 'Notes can only be edited within 24h of completion' });
    }

    const { doctorNotes, prescriptionUrl, diagnosisCode } = req.body;
    if (!doctorNotes && !prescriptionUrl && !diagnosisCode)
      return res.status(400).json({ success: false, message: 'At least one field required' });

    if (doctorNotes)    op.doctorNotes    = doctorNotes;
    if (prescriptionUrl) op.prescriptionUrl = prescriptionUrl;
    if (diagnosisCode)  op.diagnosisCode  = diagnosisCode;
    await op.save();

    // Sync to booking
    await Booking.findByIdAndUpdate(op.booking, {
      'consultation.doctorNotes':     op.doctorNotes,
      'consultation.prescriptionUrl': op.prescriptionUrl,
    });

    return res.json({ success: true, message: 'Notes updated', data: { op } });
  } catch (err) {
    console.error('[PATCH /ops/:id/notes]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/hospital/register'
export const getHospitalRegister = asyncHandler(async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).select('_id name').lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const ops = await OutPatientRecord.find({
      hospital:    hospital._id,
      scheduledAt: { $gte: startOfDay, $lte: endOfDay },
    })
      .sort({ scheduledAt: 1 })
      .populate('patient', 'name phone email')
      .populate('doctor',  'user specialization')
      .lean();

    const stats = {
      total:      ops.length,
      scheduled:  ops.filter(o => o.status === 'scheduled').length,
      inProgress: ops.filter(o => o.status === 'in_progress').length,
      completed:  ops.filter(o => o.status === 'completed').length,
      cancelled:  ops.filter(o => o.status === 'cancelled').length,
      noShow:     ops.filter(o => o.status === 'no_show').length,
      followUps:  ops.filter(o => o.isFollowUp).length,
      revenue:    ops
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.consultationFee || 0), 0),
    };

    return res.json({
      success: true,
      data: {
        date:         targetDate.toISOString().slice(0, 10),
        hospitalName: hospital.name,
        ops,
        stats,
      },
    });
  } catch (err) {
    console.error('[GET /ops/hospital/register]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/hospital/upcoming'
export const getHospitalUpcoming = asyncHandler(async (req, res) => {
  try {
    const hospital = await Hospital.findOne({ managedBy: req.user._id }).select('_id name').lean();
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const now     = new Date();
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    const ops = await OutPatientRecord.find({
      hospital:    hospital._id,
      scheduledAt: { $gte: now, $lte: in7Days },
      status:      { $in: ['scheduled', 'in_progress'] },
    })
      .sort({ scheduledAt: 1 })
      .populate('patient', 'name phone')
      .populate('doctor',  'user specialization')
      .lean();

    return res.json({ success: true, data: { ops, total: ops.length } });
  } catch (err) {
    console.error('[GET /ops/hospital/upcoming]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/admin/create'
export const postAdminCreate = asyncHandler(async (req, res) => {
  try {
    const {
      patientId,
      patientName,
      doctorId,
      hospitalId,
      consultationType,
      scheduledAt,
      reasonForVisit,
      consultationFee,
      isFollowUp,
      parentOpId,
      followUpValidDays,
      followUpFee,
    } = req.body;

    if (!patientId || !doctorId || !consultationType || !scheduledAt)
      return res.status(400).json({
        success: false,
        message: 'patientId, doctorId, consultationType, scheduledAt required',
      });

    if (!mongoose.Types.ObjectId.isValid(doctorId))
      return res.status(400).json({ success: false, message: 'Invalid doctorId' });

    // Compute follow-up expiry
    let followUpExpiry = null;
    if (!isFollowUp) {
      const days = followUpValidDays || 7;
      followUpExpiry = new Date(scheduledAt);
      followUpExpiry.setDate(followUpExpiry.getDate() + days);
    }

    // Validate parent OP if follow-up
    let resolvedParentOpId = null;
    if (isFollowUp && parentOpId) {
      const parentOp = await OutPatientRecord.findById(parentOpId).lean();
      if (!parentOp)
        return res.status(404).json({ success: false, message: 'Parent OP not found' });
      resolvedParentOpId = parentOpId;
    }

    const opNumber = await generateOpNumber(hospitalId || null);

    const op = await OutPatientRecord.create({
      opNumber,
      booking:      null,  // walk-in — no booking
      bookingNumber: null,
      patient:      patientId,
      patientName:  patientName || 'Walk-in Patient',
      doctor:       doctorId,
      hospital:     hospitalId || null,
      consultationType,
      scheduledAt:  new Date(scheduledAt),
      isFollowUp:   isFollowUp || false,
      parentOp:     resolvedParentOpId,
      followUpExpiry,
      followUpFee:  followUpFee || 0,
      consultationFee: consultationFee || 0,
      feeSource:    'default',
      isCoveredBySubscription: false,
      reasonForVisit: reasonForVisit || '',
      status:       'scheduled',
      createdBy:    req.user._id,
    });

    await SystemLog.createLog({
      level:    'success',
      category: 'api',
      message:  `Admin created OP ${opNumber}`,
      actor:    { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'OutPatientRecord', entityId: op._id },
    });

    return res.status(201).json({
      success: true,
      message: 'OP created',
      data:    { op },
    });
  } catch (err) {
    console.error('[POST /ops/admin/create]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/list'
export const getAdminList = asyncHandler(async (req, res) => {
  try {
    const {
      status, doctorId, hospitalId, patientId,
      date, from, to,
      isFollowUp,
      search,
      page = 1, limit = 20,
    } = req.query;

    const filter = {};
    if (status)             filter.status     = status;
    if (doctorId)           filter.doctor     = doctorId;
    if (hospitalId)         filter.hospital   = hospitalId;
    if (patientId)          filter.patient    = patientId;
    if (isFollowUp !== undefined) filter.isFollowUp = isFollowUp === 'true';
    if (date) {
      const d       = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.scheduledAt = { $gte: d, $lt: nextDay };
    } else if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to)   filter.scheduledAt.$lte = new Date(to);
    }
    if (search) {
      filter.$or = [
        { opNumber:    { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
        { bookingNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [ops, total] = await Promise.all([
      OutPatientRecord.find(filter)
        .sort({ scheduledAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('patient',  'name phone email')
        .populate('doctor',   'user specialization')
        .populate('hospital', 'name')
        .lean(),
      OutPatientRecord.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { ops, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (err) {
    console.error('[GET /ops/admin/list]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/stats'
export const getAdminStats = asyncHandler(async (req, res) => {
  try {
    const { from, to, hospitalId, doctorId } = req.query;

    const matchStage = {};
    if (from || to) {
      matchStage.scheduledAt = {};
      if (from) matchStage.scheduledAt.$gte = new Date(from);
      if (to)   matchStage.scheduledAt.$lte = new Date(to);
    }
    if (hospitalId) matchStage.hospital = new mongoose.Types.ObjectId(hospitalId);
    if (doctorId)   matchStage.doctor   = new mongoose.Types.ObjectId(doctorId);

    const [
      byStatus,
      byType,
      byFollowUp,
      revenueAgg,
      dailyTrend,
    ] = await Promise.all([
      OutPatientRecord.aggregate([
        { $match: matchStage },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      OutPatientRecord.aggregate([
        { $match: matchStage },
        { $group: { _id: '$consultationType', count: { $sum: 1 } } },
      ]),
      OutPatientRecord.aggregate([
        { $match: matchStage },
        { $group: {
            _id:      '$isFollowUp',
            count:    { $sum: 1 },
            revenue:  { $sum: '$consultationFee' },
          },
        },
      ]),
      OutPatientRecord.aggregate([
        { $match: { ...matchStage, status: 'completed' } },
        { $group: {
            _id:      null,
            totalRevenue: { $sum: '$consultationFee' },
            totalOps:     { $sum: 1 },
            avgFee:       { $avg: '$consultationFee' },
          },
        },
      ]),
      OutPatientRecord.aggregate([
        { $match: matchStage },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledAt' } },
            count:   { $sum: 1 },
            revenue: { $sum: '$consultationFee' },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ]),
    ]);

    return res.json({
      success: true,
      data: {
        byStatus:  Object.fromEntries(byStatus.map(s => [s._id, s.count])),
        byType:    Object.fromEntries(byType.map(s => [s._id, s.count])),
        followUp: {
          regular:  byFollowUp.find(f => !f._id) || { count: 0, revenue: 0 },
          followUp: byFollowUp.find(f =>  f._id) || { count: 0, revenue: 0 },
        },
        revenue:   revenueAgg[0] || { totalRevenue: 0, totalOps: 0, avgFee: 0 },
        dailyTrend,
      },
    });
  } catch (err) {
    console.error('[GET /ops/admin/stats]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/daily-register'
export const getAdminDailyRegister = asyncHandler(async (req, res) => {
  try {
    const { hospitalId, date, doctorId } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const filter = {
      scheduledAt: { $gte: startOfDay, $lte: endOfDay },
    };
    if (hospitalId) filter.hospital = hospitalId;
    if (doctorId)   filter.doctor   = doctorId;

    const ops = await OutPatientRecord.find(filter)
      .sort({ scheduledAt: 1 })
      .populate('patient',  'name phone email')
      .populate('doctor',   'user specialization')
      .populate('hospital', 'name address')
      .lean();

    const stats = {
      total:      ops.length,
      scheduled:  ops.filter(o => o.status === 'scheduled').length,
      inProgress: ops.filter(o => o.status === 'in_progress').length,
      completed:  ops.filter(o => o.status === 'completed').length,
      cancelled:  ops.filter(o => o.status === 'cancelled').length,
      noShow:     ops.filter(o => o.status === 'no_show').length,
      followUps:  ops.filter(o => o.isFollowUp).length,
      subscriptionCovered: ops.filter(o => o.isCoveredBySubscription).length,
      totalRevenue: ops
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.consultationFee || 0), 0),
    };

    return res.json({
      success: true,
      data: {
        date: targetDate.toISOString().slice(0, 10),
        ops,
        stats,
      },
    });
  } catch (err) {
    console.error('[GET /ops/admin/daily-register]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id'
export const getAdminById = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const op = await OutPatientRecord.findById(req.params.id)
      .populate('patient',  'name phone email avatar')
      .populate('doctor',   'user specialization fees weeklyAvailability')
      .populate('hospital', 'name address contact consultationPricing')
      .populate('booking',  'bookingNumber serviceType status billing payment')
      .populate('parentOp', 'opNumber scheduledAt consultationType status')
      .lean();

    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    // Find child follow-up OPs
    const followUps = await OutPatientRecord.find({ parentOp: op._id })
      .select('opNumber scheduledAt consultationType status consultationFee isFollowUp')
      .lean();

    return res.json({
      success: true,
      data:    { op, followUps },
    });
  } catch (err) {
    console.error('[GET /ops/admin/:id]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/status'
export const patchAdminByIdStatus = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const VALID_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];
    const { status, doctorNotes, reason } = req.body;

    if (!VALID_STATUSES.includes(status))
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid: ${VALID_STATUSES.join(', ')}`,
      });

    const updateData = {
      status,
      ...(doctorNotes ? { doctorNotes } : {}),
      ...(status === 'completed' ? { completedAt: new Date() } : {}),
      ...(status === 'in_progress' && !((await OutPatientRecord.findById(req.params.id).select('startedAt').lean())?.startedAt)
        ? { startedAt: new Date() }
        : {}),
      updatedBy: req.user._id,
    };

    const op = await OutPatientRecord.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    // Sync booking if needed
    if (['completed', 'no_show', 'cancelled'].includes(status) && op.booking) {
      const bookingStatusMap = {
        completed: 'completed',
        no_show:   'no_show',
        cancelled: 'cancelled',
      };
      await Booking.findByIdAndUpdate(op.booking, {
        status: bookingStatusMap[status] || undefined,
      });
    }

    await SystemLog.createLog({
      level:    'info',
      category: 'api',
      message:  `Admin updated OP ${op.opNumber} status → ${status}. Reason: ${reason || 'N/A'}`,
      actor:    { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'OutPatientRecord', entityId: op._id },
    });

    return res.json({ success: true, message: 'OP status updated', data: { op } });
  } catch (err) {
    console.error('[PATCH /ops/admin/:id/status]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/followup'
export const patchAdminByIdFollowup = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const { followUpExpiry, followUpFee } = req.body;
    if (!followUpExpiry)
      return res.status(400).json({ success: false, message: 'followUpExpiry required' });

    const expiry = new Date(followUpExpiry);
    if (isNaN(expiry.getTime()))
      return res.status(400).json({ success: false, message: 'Invalid followUpExpiry date' });

    const op = await OutPatientRecord.findByIdAndUpdate(
      req.params.id,
      {
        followUpExpiry: expiry,
        ...(followUpFee !== undefined ? { followUpFee } : {}),
        updatedBy: req.user._id,
      },
      { new: true }
    );

    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    return res.json({ success: true, message: 'Follow-up window updated', data: { op } });
  } catch (err) {
    console.error('[PATCH /ops/admin/:id/followup]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id/slip'
export const getAdminByIdSlip = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ success: false, message: 'Invalid OP ID' });

    const op = await OutPatientRecord.findById(req.params.id)
      .populate('patient',  'name phone email')
      .populate('doctor',   'user specialization')
      .populate('hospital', 'name address contact')
      .lean();

    if (!op) return res.status(404).json({ success: false, message: 'OP not found' });

    const slip = buildSlipPayload(op);
    return res.json({ success: true, data: { slip } });
  } catch (err) {
    console.error('[GET /ops/admin/:id/slip]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/export'
export const getAdminExport = asyncHandler(async (req, res) => {
  try {
    const { from, to, status, hospitalId, doctorId } = req.query;
    const filter = {};
    if (status)     filter.status   = status;
    if (hospitalId) filter.hospital = hospitalId;
    if (doctorId)   filter.doctor   = doctorId;
    if (from || to) {
      filter.scheduledAt = {};
      if (from) filter.scheduledAt.$gte = new Date(from);
      if (to)   filter.scheduledAt.$lte = new Date(to);
    }

    const ops = await OutPatientRecord.find(filter)
      .select('opNumber bookingNumber patientName consultationType consultationFee feeSource isCoveredBySubscription isFollowUp status scheduledAt completedAt createdAt')
      .populate('doctor',   'user specialization')
      .populate('hospital', 'name')
      .sort({ scheduledAt: -1 })
      .limit(5000)
      .lean();

    const header = 'OP#,Booking#,Patient,ConsultType,Fee(INR),FeeSource,SubCovered,FollowUp,Status,Scheduled,Completed,Doctor,Hospital,CreatedAt\n';
    const rows   = ops.map(o =>
      [
        o.opNumber,
        o.bookingNumber || '',
        o.patientName,
        o.consultationType,
        o.consultationFee || 0,
        o.feeSource,
        o.isCoveredBySubscription ? 'Yes' : 'No',
        o.isFollowUp ? 'Yes' : 'No',
        o.status,
        o.scheduledAt ? new Date(o.scheduledAt).toLocaleString('en-IN') : '',
        o.completedAt ? new Date(o.completedAt).toLocaleString('en-IN') : '',
        o.doctor?.user?.name || '',
        o.hospital?.name || '',
        o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN') : '',
      ].join(',')
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=op-register-${Date.now()}.csv`);
    return res.send(header + rows.join('\n'));
  } catch (err) {
    console.error('[GET /ops/admin/export]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});
