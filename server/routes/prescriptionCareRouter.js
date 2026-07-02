import express from 'express';
import mongoose from 'mongoose';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import multerS3 from 'multer-s3';
import securePdf from '../utils/securePdf.js'; 
import { protect, authorize }         from '../middleware/authMiddleware.js';
import s3                              from '../config/s3.js';
import EPrescription                   from '../models/EPrescription.js';
import OutPatientRecord                from '../models/OutPatientRecord.js';
import PatientCareRecord               from '../models/PatientCareRecord.js';
import Booking                         from '../models/Booking.js';
import DoctorProfile                   from '../models/DoctorProfile.js';
import CareAssistantProfile            from '../models/CareAssistantProfile.js';
import Hospital                        from '../models/Hospital.js';
import User                            from '../models/User.js';
import CustomerProfile                 from '../models/CustomerProfile.js';
import generateEPrescriptionPdf        from '../utils/generateEPrescriptionPdf.js';
import sendEmail                       from '../utils/sendEmail.js';
import { buildEPrescriptionEmail }     from '../utils/ePrescriptionEmailTemplate.js';
import Ride from '../models/Ride.js';
import RideTracking from '../models/RideTracking.js';
import { calculateCanonicalRoute,
         createNotification,
         RIDE_STATUSES_ACTIVE }           from './bookingRouterShared.js';
import { getBookingSocketService }        from '../services/bookingSocketService.js';

const router = express.Router();

// ─── AUTH SHORTHANDS ──────────────────────────────────────────────────────────

const isDoctor        = [protect, authorize('doctor')];
const isHospital      = [protect, authorize('hospital')];
const isCareAssistant = [protect, authorize('care_assistant')];
const isAdmin         = [protect, authorize('admin', 'superadmin')];
const isDoctorOrAdmin = [protect, authorize('doctor', 'admin', 'superadmin')];
const isAnyStaff      = [protect, authorize('doctor', 'hospital', 'care_assistant', 'admin', 'superadmin')];

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ─── MULTER-S3 UPLOAD ─────────────────────────────────────────────────────────

const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
      const ext      = path.extname(file.originalname);
      const folder   = req.body.logType || 'clinical';
      cb(null, `care-records/${folder}/${Date.now()}-${uuidv4()}${ext}`);
    },
  }),
  limits:     { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) return cb(new Error('Invalid file type'));
    cb(null, true);
  },
});

// ─── UPLOAD HELPERS ───────────────────────────────────────────────────────────

/**
 * Maps logType → { arrayField, imageField, selectOverride? }
 * selectOverride needed for hospitalInstructions (select:false on schema).
 */
const LOG_CONFIG = {
  vitals:      { arrayField: 'vitalsLog',            imageField: 'evidenceImages'    },
  food:        { arrayField: 'foodLog',               imageField: 'images'            },
  medicine:    { arrayField: 'medicineLog',           imageField: 'pillImages'        },
  care_note:   { arrayField: 'careNotes',             imageField: 'observationImages' },
  instruction: { arrayField: 'hospitalInstructions', imageField: 'attachments', selectOverride: '+hospitalInstructions' },
};

const buildImageDoc = (file, caption = '') => ({
  url:        file.location,          // S3 URL
  publicId:   file.key,               // S3 key (for deletion)
  caption:    caption || file.originalname,
  uploadedAt: new Date(),
});

/**
 * Positional $push — no full-doc load needed.
 */
const pushImageToEntry = async (recordId, logType, entryId, imageDoc) => {
  const { arrayField, imageField } = LOG_CONFIG[logType];
  const result = await PatientCareRecord.updateOne(
    { _id: recordId, [`${arrayField}._id`]: new mongoose.Types.ObjectId(entryId) },
    { $push: { [`${arrayField}.$.${imageField}`]: imageDoc } },
  );
  return result.modifiedCount > 0;
};

// ─── CARE RECORD OWNERSHIP CHECK ──────────────────────────────────────────────

const loadOwnCareRecord = async (recordId, capId) => {
  const record = await PatientCareRecord.findById(recordId);
  if (!record) return { error: 'Care record not found.' };
  if (record.careAssistant.toString() !== capId.toString()) {
    return { error: 'Access denied.', forbidden: true };
  }
  return { record };
};


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION A — PRESCRIPTIONS (DOCTOR)
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/prescriptions', ...isDoctor, wrap(async (req, res) => {

  const doctorProfile = await DoctorProfile.findOne({ user: req.user._id })
    .select('_id registrationNumber registrationCouncil specialization qualifications doctorSignature')
    .populate('user', 'name phone email')
    .lean();

  if (!doctorProfile) {
    return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
  }

  const {
    booking, outPatientRecord, patientCareRecord,
    patient, hospital,
    diagnosis, diagnosisCode, chiefComplaints, clinicalFindings,
    advice, referralNote, vitals,
    medicines, labTests,
    followUpDate, followUpInstructions,
  } = req.body;

  if (!patient?.name) {
    return res.status(400).json({ success: false, message: 'patient.name is required.' });
  }
  if (!medicines?.length && !labTests?.length) {
    return res.status(400).json({ success: false, message: 'Prescription must have at least one medicine or lab test.' });
  }
  if (hospital && typeof hospital === 'string' && /^[a-f\d]{24}$/i.test(hospital)) {
    return res.status(400).json({ success: false, message: 'hospital must be a snapshot object, not a raw ObjectId string.' });
  }

  const doctorSnap = {
    userId:              req.user._id,
    doctorProfileId:     doctorProfile._id,
    name:                doctorProfile.user.name,
    registrationNumber:  doctorProfile.registrationNumber,
    registrationCouncil: doctorProfile.registrationCouncil,
    specialization:      doctorProfile.specialization,
    qualifications:      doctorProfile.qualifications?.map(q => q.degree).filter(Boolean).join(', ') || '',
    phone:               doctorProfile.user.phone,
    email:               doctorProfile.user.email,
    signatureUrl:        doctorProfile.doctorSignature, // FIXED: Matches ePrescriptionSchema
  };

  const rx = await EPrescription.create({
    booking, outPatientRecord, patientCareRecord,
    doctor:            doctorSnap,
    hospital:          hospital || null,
    isDigitallySigned: !!doctorProfile.doctorSignature,
    patient,
    diagnosis, diagnosisCode,
    chiefComplaints:   chiefComplaints || [],
    clinicalFindings, advice, referralNote,
    vitals:    vitals    || {},
    medicines: medicines || [],
    labTests:  labTests  || [],
    followUpDate, followUpInstructions,
    createdBy: req.user._id,
  });

  res.status(201).json({ success: true, data: rx });

  // ── Post-response async work ──────────────────────────────────────────────
  setImmediate(async () => {
    try {
      // 1. Update Customer Profile (Stats + Timeline + Medicine History)
      if (patient?.userId) {
        
        // Map new medicines to the schema structure in CustomerProfile
        const mappedMedicines = (rx.medicines || []).map(med => ({
          medicineName:      med.medicineName,
          dosage:            med.dosage,
          frequency:         med.frequency,
          startDate:         rx.issuedAt || new Date(),
          isOngoing:         true,
          prescribingDoctor: doctorSnap.name,
          instructions:      med.instructions,
          prescriptionId:    rx._id
        }));

        // Create a chronological timeline event
        const timelineEntry = {
          date:           rx.issuedAt || new Date(),
          eventTitle:     `Prescription Issued (${rx.rxNumber})`,
          hospitalName:   hospital?.name || '',
          description:    `Diagnosis: ${diagnosis || 'Not specified'}. Prescribed ${rx.medicines?.length || 0} medicines and ${rx.labTests?.length || 0} lab tests.`,
          doctorName:     doctorSnap.name,
          prescriptionId: rx._id
        };

        // Execute atomic update
        await CustomerProfile.findOneAndUpdate(
          { user: patient.userId },
          {
            $inc: { 'stats.totalConsultations': 1, 'stats.totalBookings': 1 },
            $set: { 'stats.lastBookingAt': new Date(), 'stats.lastActiveAt': new Date() },
            $push: { 
              medicineHistory: { $each: mappedMedicines },
              medicalTimeline: timelineEntry
            }
          }
        );
      }

      // 2. Resolve Patient Email & Send PDF
      let patientEmail = patient.email || null;

      if (!patientEmail && patient.userId) {
        const patUser = await User.findById(patient.userId).select('email').lean();
        patientEmail  = patUser?.email || null;
      }
      if (!patientEmail && booking) {
        const bk = await Booking.findById(booking).select('customer').populate('customer', 'email').lean();
        patientEmail = bk?.customer?.email || null;
      }
      if (!patientEmail) {
        console.warn(`[ePrescription] No patient email for RX ${rx.rxNumber} — skipping email delivery.`);
        return;
      }

      const rxData = rx.toObject();

      const rawPdf    = await generateEPrescriptionPdf(rxData);
      const pdfBuffer = await securePdf(rawPdf);
      const verifyUrl   = `${process.env.FRONTEND_URL || 'https://likeson.in'}/rx/verify/${rx.rxNumber}`;
      const downloadUrl = `${process.env.BACKEND_URL  || 'https://api.likeson.in'}/api/clinical/prescriptions/${rx._id}/pdf`;

      const fmtD = (d) => d
        ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

      const emailHtml = buildEPrescriptionEmail({
        patientName:    patient.name,
        doctorName:     doctorSnap.name,
        specialization: doctorSnap.specialization,
        rxNumber:       rx.rxNumber,
        issuedAt:       fmtD(rx.issuedAt),
        expiresAt:      fmtD(rx.expiresAt),
        medicines:      rx.medicines || [],
        verifyUrl,
        downloadUrl,
      });

      await sendEmail({
        email:   patientEmail,
        subject: `Your Prescription from Dr. ${doctorSnap.name} — ${rx.rxNumber}`,
        html:    emailHtml,
        attachments: [{
          filename:    `Prescription-${rx.rxNumber}.pdf`,
          content:     pdfBuffer,
          contentType: 'application/pdf',
        }],
      });

      console.log(`[ePrescription] Email + PDF sent → ${patientEmail} | RX: ${rx.rxNumber}`);
    } catch (err) {
      console.error(`[ePrescription] Post-create failed for RX ${rx.rxNumber}:`, err.message);
    }
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/prescriptions/:id/pdf', ...isAnyStaff, wrap(async (req, res) => {
  const rx = await EPrescription.findById(req.params.id).lean();
  if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found.' });

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (rx.doctor?.doctorProfileId?.toString() !== dp?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

    const rawPdf    = await generateEPrescriptionPdf(rx);
   const pdfBuffer = await securePdf(rawPdf);

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `inline; filename="${rx.rxNumber}.pdf"`,
    'Content-Length':      pdfBuffer.length,
    'Cache-Control':       'no-cache',
  });
  res.send(pdfBuffer);
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/prescriptions', ...isAnyStaff, wrap(async (req, res) => {
  const { status, patientId, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
    filter['doctor.doctorProfileId'] = dp._id;
  }
  if (req.user.role === 'hospital') {
    const hosp = await Hospital.findOne({ managedBy: req.user._id }).select('_id name').lean();
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospital not found.' });
    filter['hospital.hospitalId'] = hosp._id;
  }

  if (status)    filter.status            = status;
  if (patientId) filter['patient.userId'] = patientId;
  if (from || to) {
    filter.issuedAt = {};
    if (from) filter.issuedAt.$gte = new Date(from);
    if (to)   filter.issuedAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    EPrescription.find(filter).sort({ issuedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    EPrescription.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: specific routes before :id wildcard

router.get('/prescriptions/verify/:rxNumber', wrap(async (req, res) => {
  const rx = await EPrescription.findOne({ rxNumber: req.params.rxNumber })
    .select('rxNumber doctor patient issuedAt expiresAt status isDigitallySigned')
    .lean();

  if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found.' });

  res.json({
    success: true,
    data: {
      rxNumber:          rx.rxNumber,
      doctorName:        rx.doctor?.name,
      registrationNo:    rx.doctor?.registrationNumber,
      patientName:       rx.patient?.name,
      issuedAt:          rx.issuedAt,
      expiresAt:         rx.expiresAt,
      status:            rx.status,
      isDigitallySigned: rx.isDigitallySigned,
    },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/prescriptions/:id', ...isAnyStaff, wrap(async (req, res) => {
  const rx = await EPrescription.findById(req.params.id).lean();
  if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found.' });

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (rx.doctor?.doctorProfileId?.toString() !== dp?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }
  if (req.user.role === 'care_assistant') {
    const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const pcr = await PatientCareRecord.findById(rx.patientCareRecord).select('careAssistant').lean();
    if (!pcr || pcr.careAssistant?.toString() !== cap?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  res.json({ success: true, data: rx });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.patch('/prescriptions/:id/cancel', ...isDoctorOrAdmin, wrap(async (req, res) => {
  const rx = await EPrescription.findById(req.params.id);
  if (!rx) return res.status(404).json({ success: false, message: 'Prescription not found.' });

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (rx.doctor?.doctorProfileId?.toString() !== dp?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }
  if (['cancelled', 'expired', 'dispensed'].includes(rx.status)) {
    return res.status(400).json({ success: false, message: `Cannot cancel a ${rx.status} prescription.` });
  }

  rx.status       = 'cancelled';
  rx.cancelledAt  = new Date();
  rx.cancelReason = req.body.reason || 'Cancelled by doctor';
  rx.updatedBy    = req.user._id;
  await rx.save();

  res.json({ success: true, message: 'Prescription cancelled.', data: rx });
}));


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION B — OUT-PATIENT RECORDS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/op-records', ...isAnyStaff, wrap(async (req, res) => {
  const { status, patientId, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
    filter.doctor = dp._id;
  }
  if (req.user.role === 'hospital') {
    const hosp = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospital not found.' });
    filter.hospital = hosp._id;
  }

  if (status)    filter.status  = status;
  if (patientId) filter.patient = patientId;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    OutPatientRecord.find(filter)
      .sort({ scheduledAt: -1 }).skip(skip).limit(Number(limit))
      .populate('patient', 'name phone').lean(),
    OutPatientRecord.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/op-records/:id', ...isAnyStaff, wrap(async (req, res) => {
  const op = await OutPatientRecord.findById(req.params.id)
    .populate('patient', 'name phone email')
    .populate('doctor')
    .lean();

  if (!op) return res.status(404).json({ success: false, message: 'OP Record not found.' });

  if (req.user.role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (op.doctor?._id?.toString() !== dp?._id?.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
  }

  const prescriptions = await EPrescription.find({ outPatientRecord: op._id })
    .select('rxNumber status issuedAt medicines.medicineName expiresAt')
    .lean();

  res.json({ success: true, data: { ...op, prescriptions } });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.patch('/op-records/:id/complete', ...isDoctor, wrap(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  const op = await OutPatientRecord.findById(req.params.id);
  if (!op) return res.status(404).json({ success: false, message: 'OP Record not found.' });

  if (op.doctor.toString() !== dp._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  if (op.status === 'completed') {
    return res.status(400).json({ success: false, message: 'Already completed.' });
  }

  const { doctorNotes, diagnosisCode, reasonForVisit } = req.body;
  op.status      = 'completed';
  op.completedAt = new Date();
  if (doctorNotes)    op.doctorNotes    = doctorNotes;
  if (diagnosisCode)  op.diagnosisCode  = diagnosisCode;
  if (reasonForVisit) op.reasonForVisit = reasonForVisit;
  op.startedAt = op.startedAt || new Date();
  op.updatedBy = req.user._id;
  await op.save();

  res.json({ success: true, message: 'Consultation completed.', data: op });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.patch('/op-records/:id/status',
  protect, authorize('hospital', 'admin', 'superadmin'),
  wrap(async (req, res) => {
    const { status, reason } = req.body;
    const ALLOWED = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];
    if (!ALLOWED.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${ALLOWED.join(', ')}` });
    }

    const op = await OutPatientRecord.findById(req.params.id);
    if (!op) return res.status(404).json({ success: false, message: 'OP Record not found.' });

    if (req.user.role === 'hospital') {
      const hosp = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
      if (op.hospital?.toString() !== hosp?._id?.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    op.status    = status;
    op.updatedBy = req.user._id;
    if (reason) op.doctorNotes = (op.doctorNotes ? op.doctorNotes + '\n' : '') + `[${status}] ${reason}`;
    await op.save();

    res.json({ success: true, message: `OP status updated to ${status}.`, data: op });
  })
);


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION C — CARE ASSISTANT: BOOKINGS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/care/bookings', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant profile not found.' });

  const { status, bookingType, from, to, page = 1, limit = 20 } = req.query;
  const filter = { careAssistant: cap._id };
  if (status)      filter.status      = status;
  if (bookingType) filter.bookingType = bookingType;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    Booking.find(filter)
      .sort({ scheduledAt: -1 }).skip(skip).limit(Number(limit))
      .populate('customer', 'name phone')
      .select('-internalNotes -statusLog').lean(),
    Booking.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/care/bookings/pending', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant profile not found.' });

  const assignedBookings = await Booking.find({
    careAssistant: cap._id,
    status: { $in: ['confirmed', 'pending'] },
  }).select('_id').lean();

  const bookingIds     = assignedBookings.map(b => b._id);
  const existingRecords= await PatientCareRecord.find({ booking: { $in: bookingIds } }).select('booking').lean();
  const alreadyAccepted= new Set(existingRecords.map(r => r.booking.toString()));
  const pendingIds     = bookingIds.filter(id => !alreadyAccepted.has(id.toString()));

  const data = await Booking.find({ _id: { $in: pendingIds } })
    .sort({ scheduledAt: 1 })
    .populate('customer', 'name phone')
    .select('-internalNotes -statusLog').lean();

  res.json({ success: true, count: data.length, data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/care/bookings/:bookingId', ...isAnyStaff, wrap(async (req, res) => {
  const { role } = req.user;
  const query = { _id: req.params.bookingId };

  if (role === 'care_assistant') {
    const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!cap) return res.status(404).json({ success: false, message: 'Care assistant profile not found.' });
    query.careAssistant = cap._id;
  } else if (role === 'doctor') {
    const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
    if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });
    query.doctor = dp._id;
  } else if (role === 'hospital') {
    const hosp = await Hospital.findOne({ managedBy: req.user._id }).select('_id').lean();
    if (!hosp) return res.status(404).json({ success: false, message: 'Hospital not found.' });
    query.hospital = hosp._id;
  }

  const booking = await Booking.findOne(query)
    .populate('customer',      'name phone email')
    .populate('doctor',        'specialization registrationNumber profilePhotoUrl')
    .populate('careAssistant', 'fullName phone photoUrl')
    .populate('hospital',      'name address phone')
    .lean();

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found or you do not have access to it.' });
  }

  const careRecord = await PatientCareRecord.findOne({ booking: booking._id })
    .select('status assignedAt latestVitals openAlerts todaysMissedMeds').lean();

  const opRecord = await OutPatientRecord.findOne({ booking: booking._id })
    .select('opNumber prescriptionUrl diagnosisCode doctorNotes followUpExpiry').lean();

  return res.json({ success: true, data: { ...booking, careRecord: careRecord || null, opRecord: opRecord || null } });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.post('/care/bookings/:bookingId/accept', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id })
    .select('_id isActive verification location fullName phone')
    .lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant profile not found.' });

  const booking = await Booking.findOne({
    _id:           req.params.bookingId,
    careAssistant: cap._id,
    status:        { $in: ['confirmed', 'pending'] },
  });
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found, not assigned to you, or not in acceptable state.' });
  }

  const existing = await PatientCareRecord.findOne({ booking: booking._id });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Care record already exists for this booking.', data: existing });
  }

  // ── Ride: CA current location → patient pickup ──────────────────────────
  const caCoords      = cap.location?.coordinates;
  const patientCoords = booking.patientLocation?.coordinates;

  let createdRide    = null;
  let distanceKm     = null;
  let durationMin    = null;
  let routePolyline  = null;

  if (caCoords?.length && patientCoords?.length) {
    // No active ride already
    const existingRide = await Ride.findOne({
      booking: booking._id,
      status:  { $in: ['requested','searching','driver_assigned','driver_accepted','driver_en_route','driver_arrived','otp_verified','in_progress','at_stop'] },
    });

    if (!existingRide) {
      ({ distanceKm, durationMin, polyline: routePolyline } =
        await calculateCanonicalRoute(caCoords, patientCoords));

      createdRide = await Ride.create({
        booking:              booking._id,
        rideType:             'care_assistant',
        vehicleClass:         'two_wheeler',
        pickup: {
          type:        'Point',
          coordinates: caCoords,
          address:     'Care assistant current location',
          city:        cap.location?.city || '',
        },
        dropoff: {
          type:        'Point',
          coordinates: patientCoords,
          address:     booking.patientLocation?.address || '',
          city:        booking.patientLocation?.city    || '',
        },
        scheduledPickupAt:    booking.scheduledAt || new Date(),
        status:               'driver_assigned',
        driverAssignedAt:     new Date(),
        estimatedDistanceKm:  distanceKm,
        estimatedDurationMin: durationMin,
        createdBy:            req.user._id,
      });

      const tracking = await RideTracking.create({
        ride:                  createdRide._id,
        booking:               booking._id,
        expectedRoutePolyline: routePolyline,
      });
      await Ride.findByIdAndUpdate(createdRide._id, { $set: { trackingId: tracking._id } });

      await Booking.findByIdAndUpdate(booking._id, {
        $push: { rides: createdRide._id },
        $set:  { primaryRide: createdRide._id },
      });
    }
  } else {
    console.warn(`[CA accept] ride skipped — caCoords:${!!caCoords} patientCoords:${!!patientCoords}`);
  }

  // ── Care record ──────────────────────────────────────────────────────────
  const pi = booking.patientInfo || {};
  const patientSnapshot = req.body.patientSnapshot || {
    bloodGroup:        pi.bloodGroup || null,
    allergies:         [],
    chronicConditions: [],
    primaryLanguage:   'English',
    emergencyContact:  {},
  };

  const opRecord   = await OutPatientRecord.findOne({ booking: booking._id }).select('_id').lean();
  const careRecord = await PatientCareRecord.create({
    booking:          booking._id,
    patient:          booking.customer,
    patientName:      pi.name,
    careAssistant:    cap._id,
    outPatientRecord: opRecord?._id || null,
    status:           'active',
    assignedAt:       new Date(),
    patientSnapshot,
    createdBy:        req.user._id,
  });

  booking.status    = 'in_progress';
  booking.updatedBy = req.user._id;
  await booking.save();

  await CareAssistantProfile.findByIdAndUpdate(cap._id, {
    status:            'On-Task',
    currentActiveTask: booking._id,
  });

  // ── Notify customer ──────────────────────────────────────────────────────
  createNotification({
    recipient: booking.customer,
    title:     'Care Assistant On the Way',
    body:      `${cap.fullName || 'Your care assistant'} accepted and is heading to you${durationMin ? ` (~${durationMin} min)` : ''}.`,
    type:      'Driver_Assigned',
    bookingId: booking._id,
  }).catch(e => console.error('[CA accept] notification:', e.message));

  getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'care_assistant_assigned', {
    bookingId:        booking._id,
    careAssistantId:  cap._id,
    name:             cap.fullName,
    phone:            cap.phone,
    rideId:           createdRide?._id || null,
    estimatedDistKm:  distanceKm,
    estimatedMinutes: durationMin,
    mapRoute: createdRide ? {
      polyline:      routePolyline,
      pickupCoords:  caCoords,
      dropoffCoords: patientCoords,
      currentTarget: 'pickup_patient',
    } : null,
  });

  res.status(201).json({
    success: true,
    message: 'Booking accepted. Care record created.' + (createdRide ? ' Ride dispatched to patient.' : ' Ride skipped — location unavailable.'),
    data: {
      careRecord,
      ride: createdRide ? {
        rideId:      createdRide._id,
        rideCode:    createdRide.rideCode,
        distanceKm,
        durationMin,
        polyline:    routePolyline,
      } : null,
    },
  });

  setImmediate(async () => {
    try {
      await CustomerProfile.findOneAndUpdate(
        { user: booking.customer },
        {
          $inc: { 'stats.totalCareAssistUses': 1, 'stats.totalBookings': 1 },
          $set: { 'stats.lastBookingAt': new Date(), 'stats.lastActiveAt': new Date() },
        }
      );
    } catch (err) {
      console.error('[CustomerProfile] accept stat update failed:', err.message);
    }
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.post('/care/bookings/:bookingId/reject', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();

  const booking = await Booking.findOne({
    _id:           req.params.bookingId,
    careAssistant: cap._id,
    status:        { $in: ['confirmed', 'pending'] },
  });
  if (!booking) {
    return res.status(404).json({ success: false, message: 'Booking not found or cannot be rejected.' });
  }

  booking.careAssistant         = null;
  booking.careAssistantSnapshot = null;
  booking.status                = 'confirmed';
  booking.updatedBy             = req.user._id;
  await booking.save();

  res.json({ success: true, message: 'Booking rejected. Admin will reassign.', reason: req.body.reason || null });
}));


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION D — CARE ASSISTANT: PATIENT CARE RECORD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /care/records/active
 * Resolve active PatientCareRecord for CA app on mount.
 * Query: ?bookingId=xxx  OR  ?patientId=xxx
 */
router.get('/care/records/active', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant profile not found.' });

  const { bookingId, patientId } = req.query;
  if (!bookingId && !patientId) {
    return res.status(400).json({ success: false, message: 'bookingId or patientId required.' });
  }

  const filter = { careAssistant: cap._id, status: 'active' };
  if (bookingId) filter.booking = bookingId;
  if (patientId) filter.patient = patientId;

  const record = await PatientCareRecord.findOne(filter)
    .select('-hospitalInstructions')
    .populate('patient', 'name phone email')
    .lean({ virtuals: true });

  if (!record) {
    return res.status(404).json({ success: false, message: 'No active care record found.' });
  }

  res.json({ success: true, record });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/care/records', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { status, page = 1, limit = 20 } = req.query;

  const filter = { careAssistant: cap._id };
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    PatientCareRecord.find(filter)
      .sort({ assignedAt: -1 }).skip(skip).limit(Number(limit))
      .populate('patient', 'name phone')
      .select('-hospitalInstructions -vitalsLog -foodLog -medicineLog -careNotes').lean(),
    PatientCareRecord.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/care/records/:id', ...isCareAssistant, wrap(async (req, res) => {
  const cap  = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const full = await PatientCareRecord.findById(req.params.id).select('+hospitalInstructions').lean();

  if (!full) return res.status(404).json({ success: false, message: 'Care record not found.' });
  if (full.careAssistant.toString() !== cap._id.toString()) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  const prescriptions = await EPrescription.find({ patientCareRecord: full._id })
    .select('rxNumber medicines labTests status issuedAt expiresAt advice').lean();

  const opRecord = full.outPatientRecord
    ? await OutPatientRecord.findById(full.outPatientRecord)
        .select('opNumber prescriptionUrl diagnosisCode doctorNotes followUpExpiry').lean()
    : null;

  res.json({ success: true, data: { ...full, prescriptions, opRecord } });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  VITALS — text fields OR file upload
//  Accepts multipart/form-data (files[]) or application/json (evidenceImages URLs).
// ─────────────────────────────────────────────────────────────────────────────

router.post('/care/records/:id/vitals',
  ...isCareAssistant,
  upload.array('files', 5),
  wrap(async (req, res) => {
    const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
    if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

    if (record.status !== 'active') {
      return res.status(400).json({ success: false, message: 'Care record is not active.' });
    }

    const {
      bloodPressure, pulseRate, temperature, spO2,
      bloodSugar, weightKg, heightCm, respiratoryRate,
      notes, caption,
    } = req.body;

    // Merge uploaded files + any pre-hosted URLs passed in body
    const uploadedImages = (req.files || []).map(f => buildImageDoc(f, caption));
    let bodyImages = [];
    try { bodyImages = req.body.evidenceImages ? JSON.parse(req.body.evidenceImages) : []; } catch { bodyImages = []; }
    const evidenceImages = [...uploadedImages, ...bodyImages];

    record.vitalsLog.push({
      recordedAt: new Date(),
      recordedBy: req.user._id,
      bloodPressure, pulseRate: pulseRate ? Number(pulseRate) : undefined,
      temperature:   temperature ? Number(temperature) : undefined,
      spO2:          spO2        ? Number(spO2)        : undefined,
      bloodSugar:    bloodSugar  ? Number(bloodSugar)  : undefined,
      weightKg:      weightKg    ? Number(weightKg)    : undefined,
      heightCm:      heightCm    ? Number(heightCm)    : undefined,
      respiratoryRate: respiratoryRate ? Number(respiratoryRate) : undefined,
      notes,
      evidenceImages,
    });
    record.updatedBy = req.user._id;
    await record.save();

    const latest = record.vitalsLog[record.vitalsLog.length - 1];
    res.status(201).json({ success: true, message: 'Vitals recorded.', latest });

    setImmediate(async () => {
      try {
        const patch = { 'vitalsBaseline.lastUpdated': new Date() };
        if (bloodPressure !== undefined) patch['vitalsBaseline.bloodPressure'] = bloodPressure;
        if (pulseRate      !== undefined) patch['vitalsBaseline.pulseRate']     = Number(pulseRate);
        if (temperature    !== undefined) patch['vitalsBaseline.temperature']   = Number(temperature);
        if (spO2           !== undefined) patch['vitalsBaseline.spO2']          = Number(spO2);
        if (bloodSugar     !== undefined) patch['vitalsBaseline.bloodSugar']    = Number(bloodSugar);
        if (weightKg       !== undefined) patch['vitalsBaseline.weightKg']      = Number(weightKg);
        if (heightCm       !== undefined) patch['vitalsBaseline.heightCm']      = Number(heightCm);
        await CustomerProfile.findOneAndUpdate({ user: record.patient }, { $set: patch });
      } catch (err) {
        console.error('[CustomerProfile] vitalsBaseline sync failed:', err.message);
      }
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  FOOD LOG — accepts file uploads for meal photos
// ─────────────────────────────────────────────────────────────────────────────

router.post('/care/records/:id/food',
  ...isCareAssistant,
  upload.array('files', 5),
  wrap(async (req, res) => {
    const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
    if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

    const { mealType, description, quantityMl, status, refusalReason, notes, caption } = req.body;
    if (!mealType) return res.status(400).json({ success: false, message: 'mealType is required.' });

    const uploadedImages = (req.files || []).map(f => buildImageDoc(f, caption));
    let bodyImages = [];
    try { bodyImages = req.body.images ? JSON.parse(req.body.images) : []; } catch { bodyImages = []; }

    record.foodLog.push({
      mealTime:  new Date(),
      mealType,
      description,
      quantityMl: quantityMl ? Number(quantityMl) : undefined,
      status:        status || 'consumed',
      refusalReason,
      recordedBy:    req.user._id,
      notes,
      images: [...uploadedImages, ...bodyImages],
    });
    record.updatedBy = req.user._id;
    await record.save();

    res.status(201).json({
      success: true,
      message: 'Food entry logged.',
      entry:   record.foodLog[record.foodLog.length - 1],
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  MEDICINE LOG — accepts file uploads for pill/strip photos
// ─────────────────────────────────────────────────────────────────────────────

router.post('/care/records/:id/medicine-log',
  ...isCareAssistant,
  upload.array('files', 5),
  wrap(async (req, res) => {
    const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
    if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

    const {
      medicine, medicineName, dosage, route,
      status, scheduledAt, administeredAt,
      missedReason, notes, caption,
    } = req.body;

    if (!medicineName) return res.status(400).json({ success: false, message: 'medicineName is required.' });
    if (!scheduledAt)  return res.status(400).json({ success: false, message: 'scheduledAt is required.' });

    const uploadedImages = (req.files || []).map(f => buildImageDoc(f, caption));
    let bodyImages = [];
    try { bodyImages = req.body.pillImages ? JSON.parse(req.body.pillImages) : []; } catch { bodyImages = []; }

    record.medicineLog.push({
      scheduledAt:    new Date(scheduledAt),
      administeredAt: administeredAt
        ? new Date(administeredAt)
        : (status === 'given' ? new Date() : undefined),
      medicine:       medicine || null,
      medicineName,
      dosage,
      route:          route || 'oral',
      status:         status || 'given',
      missedReason,
      administeredBy: req.user._id,
      notes,
      pillImages: [...uploadedImages, ...bodyImages],
    });
    record.updatedBy = req.user._id;
    await record.save();

    res.status(201).json({
      success: true,
      message: 'Medicine log entry recorded.',
      entry:   record.medicineLog[record.medicineLog.length - 1],
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  CARE NOTES — accepts file uploads for wound/observation photos
// ─────────────────────────────────────────────────────────────────────────────

router.post('/care/records/:id/notes',
  ...isCareAssistant,
  upload.array('files', 5),
  wrap(async (req, res) => {
    const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
    const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
    if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

    const { note, category, severity, caption } = req.body;
    if (!note) return res.status(400).json({ success: false, message: 'note text is required.' });

    const uploadedImages = (req.files || []).map(f => buildImageDoc(f, caption));
    let bodyImages = [];
    try { bodyImages = req.body.observationImages ? JSON.parse(req.body.observationImages) : []; } catch { bodyImages = []; }

    record.careNotes.push({
      note,
      category:          category || 'general',
      severity:          severity || 'low',
      recordedBy:        req.user._id,
      recordedAt:        new Date(),
      observationImages: [...uploadedImages, ...bodyImages],
    });
    record.updatedBy = req.user._id;
    await record.save();

    res.status(201).json({
      success: true,
      message: 'Care note added.',
      note:    record.careNotes[record.careNotes.length - 1],
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────

router.patch('/care/records/:id/notes/:noteId/resolve', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  const noteEntry = record.careNotes.id(req.params.noteId);
  if (!noteEntry) return res.status(404).json({ success: false, message: 'Note not found.' });
  if (noteEntry.isResolved) return res.status(400).json({ success: false, message: 'Already resolved.' });

  noteEntry.isResolved = true;
  noteEntry.resolvedAt = new Date();
  noteEntry.resolvedBy = req.user._id;
  record.updatedBy     = req.user._id;
  await record.save();

  res.json({ success: true, message: 'Note resolved.', note: noteEntry });
}));

// ─────────────────────────────────────────────────────────────────────────────
//  INSTRUCTIONS — accepts file uploads for prescription scan attachments
//  doctor/admin/CA can issue; CA restricted to own record
// ─────────────────────────────────────────────────────────────────────────────

router.post('/care/records/:id/instructions',
  protect, authorize('care_assistant', 'doctor', 'admin', 'superadmin'),
  upload.array('files', 5),
  wrap(async (req, res) => {
    const { instruction, category, caption } = req.body;
    if (!instruction) return res.status(400).json({ success: false, message: 'instruction text is required.' });

    const fullRecord = await PatientCareRecord.findById(req.params.id).select('+hospitalInstructions');
    if (!fullRecord) return res.status(404).json({ success: false, message: 'Care record not found.' });

    if (req.user.role === 'care_assistant') {
      const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (fullRecord.careAssistant.toString() !== cap._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const uploadedImages = (req.files || []).map(f => buildImageDoc(f, caption));
    let bodyAttachments = [];
    try { bodyAttachments = req.body.attachments ? JSON.parse(req.body.attachments) : []; } catch { bodyAttachments = []; }

    fullRecord.hospitalInstructions.push({
      instruction,
      issuedByName: req.user.name,
      issuedBy:     req.user._id,
      issuedAt:     new Date(),
      category:     category || 'general',
      attachments:  [...uploadedImages, ...bodyAttachments],
    });
    fullRecord.updatedBy = req.user._id;
    await fullRecord.save();

    const added = fullRecord.hospitalInstructions[fullRecord.hospitalInstructions.length - 1];
    res.status(201).json({ success: true, message: 'Instruction appended.', instruction: added });
  })
);

// ─────────────────────────────────────────────────────────────────────────────

router.get('/care/records/:id/instructions',
  protect, authorize('care_assistant', 'doctor', 'admin', 'superadmin'),
  wrap(async (req, res) => {
    const full = await PatientCareRecord.findById(req.params.id).select('+hospitalInstructions').lean();
    if (!full) return res.status(404).json({ success: false, message: 'Care record not found.' });

    if (req.user.role === 'care_assistant') {
      const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (full.careAssistant.toString() !== cap._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    res.json({ success: true, data: full.hospitalInstructions || [] });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
//  STANDALONE UPLOAD — attach image(s) to an existing log entry by entryId
//  or push a standalone doc to Booking.documents (KYC, prescription scans, etc.)
//
//  Body (multipart/form-data):
//    files[]     — up to 5
//    recordId    — PatientCareRecord _id  (required unless bookingId given)
//    bookingId   — alt lookup, resolves to active record
//    logType     — vitals | food | medicine | care_note | instruction
//    entryId     — _id of existing subdoc entry to attach to
//    standalone  — "true" → push to Booking.documents instead
//    docType     — prescription | lab_report | discharge_summary | kyc | other
//    caption     — optional
// ─────────────────────────────────────────────────────────────────────────────

router.post('/care/records/upload',
  protect, authorize('care_assistant', 'doctor', 'admin', 'superadmin'),
  upload.array('files', 5),
  wrap(async (req, res) => {
    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    const {
      recordId, bookingId,
      logType, entryId,
      caption    = '',
      standalone = 'false',
      docType    = 'other',
    } = req.body;

    // ── resolve record ──
    let record;
    if (recordId) {
      record = await PatientCareRecord.findById(recordId);
    } else if (bookingId) {
      record = await PatientCareRecord.findOne({ booking: bookingId, status: 'active' });
    }
    if (!record) {
      return res.status(404).json({ success: false, message: 'Active PatientCareRecord not found.' });
    }

    // CA ownership check
    if (req.user.role === 'care_assistant') {
      const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
      if (record.careAssistant.toString() !== cap._id.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
    }

    const imageDocs = files.map(f => buildImageDoc(f, caption));

    // ── standalone: push to Booking.documents ──
    if (standalone === 'true') {
      const bid = bookingId || record.booking;
      await Booking.updateOne(
        { _id: bid },
        {
          $push: {
            documents: {
              $each: imageDocs.map(img => ({
                docType:      docType,
                url:          img.url,
                originalName: img.caption,
                uploadedAt:   img.uploadedAt,
              })),
            },
          },
        },
      );

      // Best-effort mirror to CustomerProfile.medicalTimeline
      // Append reportUrl to most recent timeline entry if exists
      await CustomerProfile.findOneAndUpdate(
        { user: record.patient, 'medicalTimeline.0': { $exists: true } },
        { $push: { 'medicalTimeline.$[].reportUrls': { $each: imageDocs.map(i => i.url) } } },
      ).catch(() => null);

      return res.status(200).json({
        success:  true,
        message:  'Documents uploaded and synced to booking.',
        uploaded: imageDocs,
      });
    }

    // ── log-entry upload ──
    if (!logType || !LOG_CONFIG[logType]) {
      return res.status(400).json({
        success: false,
        message: `Invalid logType. Must be: ${Object.keys(LOG_CONFIG).join(' | ')}`,
      });
    }
    if (!entryId) {
      return res.status(400).json({ success: false, message: 'entryId required for log-entry upload.' });
    }

    const { selectOverride } = LOG_CONFIG[logType];
    let pushSuccess = false;

    if (selectOverride) {
      // hospitalInstructions — select:false, load explicitly then save
      const rec   = await PatientCareRecord.findById(record._id).select(selectOverride);
      const entry = rec?.hospitalInstructions?.id(entryId);
      if (!entry) {
        return res.status(404).json({ success: false, message: 'Instruction entry not found.' });
      }
      entry.attachments.push(...imageDocs);
      await rec.save();
      pushSuccess = true;
    } else {
      for (const img of imageDocs) {
        const ok = await pushImageToEntry(record._id, logType, entryId, img);
        if (ok) pushSuccess = true;
      }
    }

    if (!pushSuccess) {
      return res.status(404).json({
        success: false,
        message: `Entry ${entryId} not found in ${logType}.`,
      });
    }

    res.status(200).json({
      success:  true,
      message:  `Images pushed to ${logType} entry.`,
      uploaded: imageDocs,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────

router.patch('/care/records/:id/discharge', ...isCareAssistant, wrap(async (req, res) => {
  const cap = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { record, error, forbidden } = await loadOwnCareRecord(req.params.id, cap._id);
  if (error) return res.status(forbidden ? 403 : 404).json({ success: false, message: error });

  if (record.status === 'discharged') {
    return res.status(400).json({ success: false, message: 'Already discharged.' });
  }

  record.status         = 'discharged';
  record.dischargeNotes = req.body.dischargeNotes || '';
  record.updatedBy      = req.user._id;
  await record.save();

  await Booking.findByIdAndUpdate(record.booking, {
    status:      'completed',
    completedAt: new Date(),
    updatedBy:   req.user._id,
  });

  await CareAssistantProfile.findByIdAndUpdate(cap._id, {
    status:            'Available',
    currentActiveTask: null,
  });

  res.json({ success: true, message: 'Patient discharged.', data: record });

  setImmediate(async () => {
    try {
      await CustomerProfile.findOneAndUpdate(
        { user: record.patient },
        { $set: { 'stats.lastActiveAt': new Date() } }
      );
    } catch (err) {
      console.error('[CustomerProfile] discharge lastActiveAt failed:', err.message);
    }
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.patch('/care/records/:id/status', ...isAdmin, wrap(async (req, res) => {
  const { status, dischargeNotes } = req.body;
  const ALLOWED = ['active', 'discharged', 'transferred', 'on_hold'];
  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ success: false, message: `status must be one of: ${ALLOWED.join(', ')}` });
  }

  const record = await PatientCareRecord.findById(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: 'Care record not found.' });

  record.status    = status;
  record.updatedBy = req.user._id;
  if (dischargeNotes) record.dischargeNotes = dischargeNotes;
  await record.save();

  res.json({ success: true, message: `Care record status set to ${status}.`, data: record });
}));


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION E — ADMIN OVERRIDES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/admin/prescriptions', ...isAdmin, wrap(async (req, res) => {
  const { status, doctorId, patientId, hospitalId, from, to, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status)     filter.status                    = status;
  if (doctorId)   filter['doctor.doctorProfileId'] = doctorId;
  if (patientId)  filter['patient.userId']         = patientId;
  if (hospitalId) filter['hospital.hospitalId']    = hospitalId;
  if (from || to) {
    filter.issuedAt = {};
    if (from) filter.issuedAt.$gte = new Date(from);
    if (to)   filter.issuedAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    EPrescription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    EPrescription.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/op-records', ...isAdmin, wrap(async (req, res) => {
  const { status, doctorId, hospitalId, patientId, from, to, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status)     filter.status   = status;
  if (doctorId)   filter.doctor   = doctorId;
  if (hospitalId) filter.hospital = hospitalId;
  if (patientId)  filter.patient  = patientId;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    OutPatientRecord.find(filter).sort({ scheduledAt: -1 }).skip(skip).limit(Number(limit))
      .populate('patient', 'name phone').lean(),
    OutPatientRecord.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/care-records', ...isAdmin, wrap(async (req, res) => {
  const { status, careAssistantId, patientId, page = 1, limit = 30 } = req.query;
  const filter = {};
  if (status)          filter.status        = status;
  if (careAssistantId) filter.careAssistant = careAssistantId;
  if (patientId)       filter.patient       = patientId;

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    PatientCareRecord.find(filter)
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit))
      .populate('patient',       'name phone')
      .populate('careAssistant', 'fullName phone').lean(),
    PatientCareRecord.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.patch('/admin/bookings/:bookingId/assign-ca', ...isAdmin, wrap(async (req, res) => {
  const { careAssistantProfileId } = req.body;
  if (!careAssistantProfileId) {
    return res.status(400).json({ success: false, message: 'careAssistantProfileId is required.' });
  }

  const cap = await CareAssistantProfile.findById(careAssistantProfileId)
    .select('_id fullName phone user').lean();
  if (!cap) return res.status(404).json({ success: false, message: 'Care assistant not found.' });

  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });

  booking.careAssistant         = cap._id;
  booking.careAssistantSnapshot = { name: cap.fullName, phone: cap.phone, photoUrl: null };
  booking.updatedBy             = req.user._id;
  await booking.save();

  res.json({ success: true, message: 'Care assistant reassigned.', data: booking });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/admin/care-records/:id', ...isAdmin, wrap(async (req, res) => {
  const record = await PatientCareRecord.findById(req.params.id)
    .select('+hospitalInstructions')
    .populate('patient',       'name phone email')
    .populate('careAssistant', 'fullName phone')
    .lean();
  if (!record) return res.status(404).json({ success: false, message: 'Care record not found.' });

  const prescriptions = await EPrescription.find({ patientCareRecord: record._id }).lean();
  res.json({ success: true, data: { ...record, prescriptions } });
}));


// ═══════════════════════════════════════════════════════════════════════════════
//  SECTION F — DOCTOR DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/doctor/appointments', ...isDoctor, wrap(async (req, res) => {
  const { status, from, to, page = 1, limit = 20 } = req.query;

  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!dp) return res.status(404).json({ success: false, message: 'Doctor profile not found.' });

  const filter = { doctor: dp._id };
  if (status) filter.status = status;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [data, total] = await Promise.all([
    Booking.find(filter)
      .sort({ scheduledAt: -1 }).skip(skip).limit(Number(limit))
      .populate('customer',      'name phone profilePhotoUrl')
      .populate('hospital',      'name address phone')
      .populate('careAssistant', 'fullName phone photoUrl')
      .populate({
        path:   'consultationSessionId',
        select: 'consultationId status consultationType consultationStage roomId meetingLink providerMeetingId actualStartTime scheduledStartTime',
      })
      .lean(),
    Booking.countDocuments(filter),
  ]);

  res.json({ success: true, total, page: Number(page), data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/doctor/availability', ...isDoctor, wrap(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id })
    .select('weeklyAvailability consultationTypes').lean();
  res.json({ success: true, data: dp });
}));

router.patch('/doctor/availability', ...isDoctor, wrap(async (req, res) => {
  const { weeklyAvailability, consultationTypes } = req.body;
  const dp = await DoctorProfile.findOne({ user: req.user._id });
  if (weeklyAvailability) dp.weeklyAvailability = weeklyAvailability;
  if (consultationTypes)  dp.consultationTypes  = consultationTypes;
  dp.updatedBy = req.user._id;
  await dp.save();
  res.json({ success: true, message: 'Availability updated successfully.', data: dp.weeklyAvailability });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/doctor/earnings', ...isDoctor, wrap(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id })
    .select('stats bankDetails settlementCycle').lean();
  res.json({
    success: true,
    data: {
      summary:    dp.stats,
      settlement: {
        cycle:      dp.settlementCycle,
        bankLast4:  dp.bankDetails?.accountLast4,
        isVerified: dp.bankDetails?.isBankVerified,
      },
    },
  });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/doctor/transactions', ...isDoctor, wrap(async (req, res) => {
  let Transaction;
  try {
    Transaction = mongoose.model('Transaction');
  } catch {
    return res.status(500).json({
      success: false,
      message: 'Transaction model not registered. Ensure it is imported at app startup.',
    });
  }

  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [data, total] = await Promise.all([
    Transaction.find({ doctorProfile: dp._id }).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Transaction.countDocuments({ doctorProfile: dp._id }),
  ]);

  res.json({ success: true, total, data });
}));

// ─────────────────────────────────────────────────────────────────────────────

router.get('/doctor/invoices/:bookingId', ...isDoctor, wrap(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();

  const booking = await Booking.findOne({
    _id:    req.params.bookingId,
    doctor: dp._id,
    status: 'completed',
  }).populate('customer', 'name email phone address');

  if (!booking) {
    return res.status(404).json({ success: false, message: 'Completed booking not found.' });
  }

  res.json({
    success: true,
    data: {
      invoiceNumber: `INV-${booking.bookingCode}`,
      date:          booking.completedAt,
      customer:      booking.customer,
      items: [{
        description: `${booking.bookingType.replace(/_/g, ' ')} Fee`,
        amount:      booking.fareBreakdown.consultationFee,
      }],
      totals: booking.fareBreakdown,
    },
  });
}));


// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────

router.use((err, req, res, _next) => {
  console.error('[ClinicalRouter Error]', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default router;