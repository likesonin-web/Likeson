import express        from 'express';
import mongoose       from 'mongoose';
import multer         from 'multer';
import ImageKit       from 'imagekit';
import bcrypt         from 'bcryptjs';
import crypto         from 'crypto';

import { protect, authorize } from '../middleware/authMiddleware.js';
import Hospital              from '../models/Hospital.js';
import DoctorProfile         from '../models/DoctorProfile.js';
import User                  from '../models/User.js';
import Notification          from '../models/Notification.js';
import SystemLog             from '../models/SystemLog.js';
import Booking                from '../models/Booking.js';
import OutPatientRecord       from '../models/OutPatientRecord.js';
import PlatformPricingConfig  from '../models/PlatformPricingConfig.js';
import sendEmail             from '../utils/sendEmail.js';
import {
  transactionalTemplate,
  welcomeTemplate,
} from '../utils/emailTemplates.js';

const router = express.Router();

// ── ImageKit Client ───────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ── Multer (memory storage — files piped to ImageKit) ─────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB max per file
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  },
});

// ── Middleware stack applied to every route in this router ────────────────────
router.use(protect);
router.use(authorize('hospital'));

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * resolveHospital
 * Finds the MANAGED hospital where Hospital.managedBy === req.user._id.
 * Throws 404 if not found or if it is an owner-operated type.
 */
const resolveHospital = async (userId, projection = '') => {
  const hospital = await Hospital.findOne({
    managedBy:       userId,
    managementModel: 'hospital-manager',
    isActive:        true,
  }).select(projection || undefined);

  if (!hospital) {
    const err = new Error('No active managed hospital found for this account.');
    err.statusCode = 404;
    throw err;
  }
  return hospital;
};

/**
 * uploadToImageKit
 * Uploads a buffer to ImageKit and returns the file object.
 */
const uploadToImageKit = (buffer, originalName, folder) =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      {
        file:     buffer,
        fileName: `${Date.now()}-${originalName}`,
        folder,
        useUniqueFileName: true,
      },
      (error, result) => {
        if (error) return reject(new Error(`ImageKit upload failed: ${error.message}`));
        resolve(result);
      }
    );
  });

/**
 * deleteFromImageKit
 * Deletes a file from ImageKit by fileId (best-effort, won't throw).
 */
const deleteFromImageKit = async (fileId) => {
  if (!fileId) return;
  try {
    await imagekit.deleteFile(fileId);
  } catch (err) {
    console.warn(`[ImageKit] Could not delete file ${fileId}:`, err.message);
  }
};

/**
 * asyncHandler — wraps async route handlers to forward errors to Express.
 * Mongoose ValidationError (thrown by our pre-validate hooks, e.g.
 * "honorarium cannot exceed fee") is treated as a 400, not a 500 — those
 * are client input problems, not server failures.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    const status = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    res.status(status).json({ success: false, message: err.message });
  });

// ═════════════════════════════════════════════════════════════════════════════
// §1  HOSPITAL PROFILE
// ═════════════════════════════════════════════════════════════════════════════

// GET current manager's hospital profile, populated with owner user + linked doctors.
router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const hospital = await Hospital.findOne({
      managedBy:       req.user._id,
      managementModel: 'hospital-manager',
    })
      .populate('managedBy', 'name email phone avatar')
      .populate('linkedDoctors', 'user specialization experienceYears rating isVerified isActive');

    if (!hospital) {
      return res.status(404).json({ success: false, message: 'Hospital profile not found for this account.' });
    }

    res.json({ success: true, data: hospital });
  })
);

// PATCH non-pricing, non-location basic profile fields (name, contact, facility flags, etc.).
router.patch(
  '/profile/basic',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id);

    const allowed = [
      'name', 'description', 'contact', 'address', 'specialties', 
      'facilities', 'acceptedSchemes', 'accreditations', 'nabledLabAvailable',
      'bedCount', 'isEmergencyReady', 'hasBloodBank', 'hasPharmacy',
      'hasDiagnostics', 'hasAmbulance', 'hasWheelchairAccess',
      'is24x7', 'googleMapsUrl',
    ];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        hospital[key] = req.body[key];
      }
    });

    hospital.updatedBy = req.user._id;
    await hospital.save();

    await SystemLog.createLog({
      level:    'info',
      category: 'user',
      message:  `Hospital profile updated by manager`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
      request:  { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: 'Hospital profile updated.', data: hospital });
  })
);

// PATCH geo-coordinates + optional address merge for the map pin.
router.patch(
  '/profile/location',
  asyncHandler(async (req, res) => {
    const { lat, lng, address } = req.body;

    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng are required.' });
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ success: false, message: 'Invalid coordinates.' });

    const hospital = await resolveHospital(req.user._id);

    hospital.location.coordinates = [parseFloat(lng), parseFloat(lat)];
    if (address) hospital.address = { ...hospital.address.toObject(), ...address };
    hospital.updatedBy = req.user._id;

    await hospital.save();
    res.json({ success: true, message: 'Location updated.', data: { location: hospital.location, address: hospital.address } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §2  IMAGE & DOCUMENT UPLOADS
// ═════════════════════════════════════════════════════════════════════════════

// POST single logo file → ImageKit → hospital.logo.
router.post(
  '/upload/logo',
  upload.single('logo'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const hospital = await resolveHospital(req.user._id);
    const result = await uploadToImageKit(req.file.buffer, req.file.originalname, `/hospitals/${hospital._id}/logo`);
    hospital.logo = result.url;
    hospital.updatedBy = req.user._id;
    await hospital.save();
    res.json({ success: true, message: 'Logo uploaded.', url: result.url });
  })
);

// POST up to 5 gallery images per call, capped at 20 total.
router.post(
  '/upload/images',
  upload.array('images', 5),
  asyncHandler(async (req, res) => {
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files uploaded.' });
    const hospital = await resolveHospital(req.user._id);

    const remaining = 20 - (hospital.images?.length || 0);
    if (remaining <= 0) return res.status(400).json({ success: false, message: 'Maximum 20 images reached.' });

    const toUpload = req.files.slice(0, remaining);
    const uploaded = await Promise.all(toUpload.map((f) => uploadToImageKit(f.buffer, f.originalname, `/hospitals/${hospital._id}/gallery`)));
    
    const newUrls = uploaded.map((r) => r.url);
    hospital.images = [...(hospital.images || []), ...newUrls];
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: `${newUrls.length} image(s) uploaded.`, uploaded: newUrls, totalImages: hospital.images.length });
  })
);

// DELETE a single gallery image by its stored URL.
router.delete(
  '/upload/images',
  asyncHandler(async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ success: false, message: 'imageUrl required.' });
    
    const hospital = await resolveHospital(req.user._id);
    if (!hospital.images.includes(imageUrl)) return res.status(404).json({ success: false, message: 'Image not found.' });

    hospital.images = hospital.images.filter((u) => u !== imageUrl);
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Image removed.', remaining: hospital.images.length });
  })
);

// POST license/registration document (PDF or image) → ImageKit → registrationDetails.documentUrl.
router.post(
  '/upload/license-document',
  upload.single('document'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const hospital = await resolveHospital(req.user._id);
    const result = await uploadToImageKit(req.file.buffer, req.file.originalname, `/hospitals/${hospital._id}/documents`);
    
    hospital.registrationDetails.documentUrl = result.url;
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'License uploaded.', url: result.url });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §3  OPERATING HOURS
// ═════════════════════════════════════════════════════════════════════════════

// GET the weekly operating-hours table + 24x7 flag.
router.get(
  '/operating-hours',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'operatingHours is24x7');
    res.json({ success: true, data: { operatingHours: hospital.operatingHours, is24x7: hospital.is24x7 } });
  })
);

// PUT (replace) the entire weekly operating-hours table, with time-format + ordering validation.
router.put(
  '/operating-hours',
  asyncHandler(async (req, res) => {
    const { operatingHours, is24x7 } = req.body;
    if (!Array.isArray(operatingHours)) return res.status(400).json({ success: false, message: 'operatingHours must be an array.' });

    const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const entry of operatingHours) {
      if (!entry.is24Hours && !entry.isClosed) {
        if (!TIME_RE.test(entry.openTime) || !TIME_RE.test(entry.closeTime)) return res.status(400).json({ success: false, message: 'Invalid time format.' });
        if (entry.openTime >= entry.closeTime) return res.status(400).json({ success: false, message: 'openTime must be before closeTime.' });
      }
    }

    const hospital = await resolveHospital(req.user._id);
    hospital.operatingHours = operatingHours;
    if (is24x7 !== undefined) hospital.is24x7 = Boolean(is24x7);
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Operating hours updated.', data: hospital.operatingHours });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §4  HOSPITAL-WIDE CONSULTATION PRICING
// ─────────────────────────────────────────────────────────────────────────────
// ARCHITECTURE FIX: this used to be a PER-DOCTOR endpoint that wrote into
// DoctorProfile.fees — the exact bug DoctorProfile.resolveEffectivePricing()
// had (Problem 2): for a hospital-manager hospital, pricing is NOT per
// doctor, it lives on Hospital.consultationPricing and applies to every
// linked doctor uniformly. The old /doctors/:doctorProfileId/pricing routes
// are kept below as deprecated stubs (410) that point callers here, so any
// existing client integration fails loudly instead of silently writing to
// the wrong pricing source.
// ═════════════════════════════════════════════════════════════════════════════

// GET the hospital's current consultation pricing (source of truth for ALL linked doctors)
// plus the read-only platform fee Likeson charges this hospital.
router.get(
  '/pricing',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'consultationPricing name settlementCycle');
    const pricingConfig = await PlatformPricingConfig.getGlobal();
    const platformFee = PlatformPricingConfig.resolveHospitalPlatformFee(pricingConfig, hospital);

    res.json({
      success: true,
      data: {
        consultationPricing: hospital.consultationPricing,
        platformFee,          // read-only — set by Likeson admin unless hospital has its own override
        settlementCycle: hospital.settlementCycle || pricingConfig.hospital.settlementCycle,
        note: 'This pricing applies to every doctor linked to this hospital. Per-doctor pricing is not available for hospital-managed hospitals.',
      },
    });
  })
);

// PATCH the hospital's consultation pricing. Archives the previous version into
// pricingHistory (handled by the Hospital model's pre-save hook) and bumps
// pricingVersion so bookings can always trace which version priced them.
router.patch(
  '/pricing',
  asyncHandler(async (req, res) => {
   const hospital = await resolveHospital(req.user._id, 'consultationPricing name pricingHistory');

    const editableFields = [
      'inPersonFee', 'videoFee', 'homeVisitFee',
      'inPersonHonorarium', 'videoHonorarium', 'homeVisitHonorarium',
      'followUpFee', 'followUpDiscountPercent', 'followUpValidDays',
      'consultationTypes',
    ];

    if (!hospital.consultationPricing) hospital.consultationPricing = {};

    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        hospital.consultationPricing[field] = req.body[field];
      }
    });

    // Version bump — model's pre-save archives the pre-image into
    // pricingHistory; we own bumping the forward-looking version number here
    // so it's explicit at the call site that made the change.
    const prevVersion = hospital.consultationPricing.pricingVersion || 1;
    hospital.consultationPricing.pricingVersion = prevVersion + 1;
    hospital.consultationPricing.lastUpdatedBy     = req.user._id;
    hospital.consultationPricing.lastUpdatedByRole = req.user.role;
    hospital.updatedBy = req.user._id;

    await hospital.save(); // throws ValidationError (→ 400 via asyncHandler) if honorarium > fee, etc.

    await SystemLog.createLog({
      level:    'info',
      category: 'payment',
      message:  `Hospital consultation pricing updated to v${hospital.consultationPricing.pricingVersion} by manager`,
      actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
      relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
      request:  { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      metadata: { pricingVersion: hospital.consultationPricing.pricingVersion },
    });

    res.json({ success: true, message: 'Consultation pricing updated.', data: hospital.consultationPricing });
  })
);

// ── Deprecated per-doctor pricing routes — kept as loud 410s, not silent no-ops ──

// DEPRECATED: per-doctor pricing read. Hospital-managed pricing is hospital-wide now.
router.get(
  '/doctors/:doctorProfileId/pricing',
  asyncHandler(async (_req, res) => {
    res.status(410).json({
      success: false,
      message: 'Per-doctor pricing was removed for hospital-managed hospitals. Use GET /hospital-manager/pricing instead — it applies to every linked doctor.',
    });
  })
);

// DEPRECATED: per-doctor pricing write. Hospital-managed pricing is hospital-wide now.
router.patch(
  '/doctors/:doctorProfileId/pricing',
  asyncHandler(async (_req, res) => {
    res.status(410).json({
      success: false,
      message: 'Per-doctor pricing was removed for hospital-managed hospitals. Use PATCH /hospital-manager/pricing instead — it applies to every linked doctor.',
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §4b  PLATFORM FEE (READ-ONLY)
// ═════════════════════════════════════════════════════════════════════════════

// GET the effective platform fee Likeson charges this hospital (hospital override → global default).
// Read-only: only superadmin/admin can change it, mirrors the priority chain in
// DoctorProfile.resolveEffectivePricing's platformFeeSource logic.
router.get(
  '/platform-fee',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'name settlementCycle consultationPricing');
    const pricingConfig = await PlatformPricingConfig.getGlobal();
    const effectiveFee = PlatformPricingConfig.resolveHospitalPlatformFee(pricingConfig, hospital);

    res.json({
      success: true,
      data: {
        platformFee: effectiveFee, // { type: 'fixed'|'percentage', value }
        settlementCycle: hospital.settlementCycle || pricingConfig.hospital.settlementCycle,
        note: 'Set by Likeson admin (or this hospital\'s override). Applied to completed bookings during settlement.',
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §5  DOCTOR MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

// GET doctors NOT yet linked to this hospital, searchable by name/email/specialization —
// used for the "link an existing doctor" picker.
router.get(
  '/doctors/search',
  asyncHandler(async (req, res) => {
    const { q = '', specialization = '', page = 1, limit = 10 } = req.query;
    const hospital = await resolveHospital(req.user._id, 'linkedDoctors _id');

    const createdUserIds = await User.find({ createdBy: req.user._id, role: 'doctor' }, '_id').lean();
    const createdUserIdSet = createdUserIds.map(u => u._id);

    const filter = {
      _id: { $nin: hospital.linkedDoctors },
      isActive: true,
      $or: [
        { primaryHospital: hospital._id },
        { user: { $in: createdUserIdSet } },
      ],
    };

    if (specialization) filter.specialization = specialization;

    const skip = (Number(page) - 1) * Number(limit);
    const doctors = await DoctorProfile.find(filter)
      .populate({
        path: 'user',
        select: 'name email phone avatar',
        match: q ? { $or: [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }] } : {},
      })
      .select('user specialization experienceYears rating consultationTypes profilePhotoUrl primaryHospital isVerified isActive partnershipStatus')
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const filtered = doctors.filter(d => d.user !== null);
    res.json({ success: true, data: filtered, count: filtered.length });
  })
);

// GET headline doctor counts (total/verified/active/online) + specialization breakdown.
router.get(
  '/doctors/stats',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'linkedDoctors name');

    const [total, verified, active, online] = await Promise.all([
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors } }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isVerified: true }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isActive: true }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isOnline: true }),
    ]);

    const bySpec = await DoctorProfile.aggregate([
      { $match: { _id: { $in: hospital.linkedDoctors } } },
      { $group: { _id: '$specialization', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    res.json({ success: true, data: { total, verified, active, online, unverified: total - verified, bySpecialization: bySpec } });
  })
);

// POST create a brand-new doctor User + DoctorProfile and link it to this hospital
// in one transaction. Note: doctor.fees is intentionally left at schema defaults —
// this hospital is 'hospital-manager', so pricing comes from /pricing, not the doctor.
router.post(
  '/doctors/create-and-link',
  asyncHandler(async (req, res) => {
    const { name, email, phone, specialization, experienceYears, registrationNumber } = req.body;
    if (!name || !email || !specialization) return res.status(400).json({ success: false, message: 'Name, email, and specialization required.' });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const hospital = await Hospital.findOne({ managedBy: req.user._id });
      if (!hospital) throw new Error('Hospital not found.');

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) throw new Error('A user with this email already exists.');

      const temporaryPassword = crypto.randomBytes(6).toString('hex');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(temporaryPassword, salt);

      const newUser = await User.create([{
        name, email: email.toLowerCase(), phone, password: hashedPassword, role: 'doctor', isEmailVerified: true, createdBy: req.user._id
      }], { session });

      const profileId = (await DoctorProfile.create([{
        user: newUser[0]._id, specialization, experienceYears: experienceYears || 0, registrationNumber, primaryHospital: hospital._id, partnershipStatus: 'Active', isActive: true, onboarding: { step: 2, isComplete: false }
      }], { session }))[0]._id;

      hospital.linkedDoctors.push(profileId);
      hospital.updatedBy = req.user._id;
      await hospital.save({ session });

      try {
        await sendEmail({
          email: email.toLowerCase(),
          subject: `Welcome to the Medical Team at ${hospital.name}`,
          html: transactionalTemplate({
            header: 'STAFF ONBOARDING',
            title: `Welcome, Dr. ${name}`,
            body: `You have been registered at <strong>${hospital.name}</strong>.<br/>Email: ${email.toLowerCase()}<br/>Temp Password: <code>${temporaryPassword}</code>`,
            buttonLink: `${process.env.FRONTEND_URL}/login`,
            buttonText: 'Login',
          }),
        });
      } catch (e) { console.error('Email failed', e); }

      await session.commitTransaction();
      res.status(201).json({ success: true, message: `Dr. ${name} created and linked.` });
    } catch (error) {
      await session.abortTransaction();
      res.status(error.message.includes('exists') ? 409 : 500).json({ success: false, message: error.message });
    } finally {
      session.endSession();
    }
  })
);

// GET paginated, filterable list of doctors already linked to this hospital.
router.get(
  '/doctors',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'linkedDoctors');
    const { page = 1, limit = 20, search = '', specialization = '', isVerified = '' } = req.query;

    const filter = { _id: { $in: hospital.linkedDoctors } };
    if (specialization) filter.specialization = specialization;
    if (isVerified !== '') filter.isVerified = isVerified === 'true';

    const allDoctors = await DoctorProfile.find(filter)
      .populate({
        path: 'user', select: 'name email phone avatar isActive isBlocked',
        match: search ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] } : undefined,
      })
      .select('user specialization experienceYears qualifications consultationTypes rating isVerified isActive isOnline weeklyAvailability partnershipStatus profilePhotoUrl')
      .sort({ createdAt: -1 }).lean();

    const matched = allDoctors.filter(d => d.user !== null);
    const total = matched.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paged = matched.slice(skip, skip + Number(limit));

    res.json({ success: true, data: paged, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } });
  })
);

// GET full detail for one linked doctor (must belong to this hospital).
router.get(
  '/doctors/:doctorProfileId',
  asyncHandler(async (req, res) => {
    const { doctorProfileId } = req.params;
    if (!mongoose.isValidObjectId(doctorProfileId)) return res.status(400).json({ success: false, message: 'Invalid ID.' });

    const hospital = await resolveHospital(req.user._id, 'linkedDoctors');
    if (!hospital.linkedDoctors.map(String).includes(doctorProfileId)) return res.status(404).json({ success: false, message: 'Doctor not linked.' });

    const doctor = await DoctorProfile.findById(doctorProfileId).populate('user', 'name email phone avatar isActive lastActiveAt').populate('primaryHospital', 'name hospitalType');
    res.json({ success: true, data: doctor });
  })
);

// DELETE the hospital↔doctor link (does not delete the doctor account).
router.delete(
  '/doctors/:doctorProfileId/unlink',
  asyncHandler(async (req, res) => {
    const { doctorProfileId } = req.params;
    const [hospital, doctor] = await Promise.all([ resolveHospital(req.user._id), DoctorProfile.findById(doctorProfileId).populate('user', 'name email') ]);

    if (!hospital.linkedDoctors.map(String).includes(doctorProfileId)) return res.status(404).json({ success: false, message: 'Doctor not linked.' });

    hospital.linkedDoctors = hospital.linkedDoctors.filter((id) => id.toString() !== doctorProfileId);
    hospital.updatedBy = req.user._id;
    await hospital.save();

    if (doctor) {
      if (doctor.primaryHospital?.toString() === hospital._id.toString()) doctor.primaryHospital = null;
      doctor.otherHospitals = (doctor.otherHospitals || []).filter((id) => id.toString() !== hospital._id.toString());
      await doctor.save();
    }
    res.json({ success: true, message: 'Doctor unlinked.' });
  })
);

// GET a linked doctor's weekly availability schedule.
router.get(
  '/doctors/:doctorProfileId/availability',
  asyncHandler(async (req, res) => {
    const { doctorProfileId } = req.params;
    const hospital = await resolveHospital(req.user._id, 'linkedDoctors');
    if (!hospital.linkedDoctors.map(String).includes(doctorProfileId)) return res.status(404).json({ success: false, message: 'Not linked.' });

    const doctor = await DoctorProfile.findById(doctorProfileId).select('weeklyAvailability').populate('user', 'name');
    res.json({ success: true, data: doctor.weeklyAvailability, doctor: doctor.user?.name });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §6  REGISTRATION / LEGAL
// ═════════════════════════════════════════════════════════════════════════════

// PATCH license/GST/PAN registration fields for the hospital.
router.patch(
  '/registration',
  asyncHandler(async (req, res) => {
    const allowed = ['licenseNumber', 'gstNumber', 'panNumber', 'licenseExpiry'];
    const hospital = await resolveHospital(req.user._id);

    allowed.forEach((field) => { if (req.body[field] !== undefined) hospital.registrationDetails[field] = req.body[field]; });
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Registration details updated.', data: hospital.registrationDetails });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §7  ONBOARDING STATUS
// ═════════════════════════════════════════════════════════════════════════════

// GET a checklist-style onboarding progress summary for the hospital dashboard.
router.get(
  '/onboarding',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'onboarding name isVerified linkedDoctors operatingHours logo registrationDetails');

    const checklist = {
      basicProfile:         !!(hospital.name),
      logoUploaded:         !!(hospital.logo),
      licenseDocument:      !!(hospital.registrationDetails?.documentUrl),
      operatingHoursSet:    hospital.operatingHours?.length > 0,
      doctorsLinked:        hospital.linkedDoctors?.length > 0,
      verified:             hospital.isVerified,
    };

    const completedSteps = Object.values(checklist).filter(Boolean).length;
    const totalSteps     = Object.keys(checklist).length;
    const percentComplete = Math.round((completedSteps / totalSteps) * 100);

    res.json({ success: true, data: { onboarding: hospital.onboarding, checklist, percentComplete, completedSteps, totalSteps } });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §8  NOTIFICATIONS
// ═════════════════════════════════════════════════════════════════════════════

// GET paginated in-app notifications for the manager's user account.
router.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = { recipient: req.user._id };
    if (unreadOnly === 'true') filter.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({ success: true, data: notifications, unreadCount, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } });
  })
);

// PATCH mark one/many/all notifications as read.
router.patch(
  '/notifications/mark-read',
  asyncHandler(async (req, res) => {
    const { notificationIds } = req.body;
    const filter = { recipient: req.user._id, isRead: false };
    if (Array.isArray(notificationIds) && notificationIds.length) filter._id = { $in: notificationIds };

    const result = await Notification.updateMany(filter, { $set: { isRead: true, readAt: new Date() } });
    res.json({ success: true, message: `${result.modifiedCount} notification(s) marked as read.` });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §9  SECURITY — SESSION & ACCOUNT MANAGEMENT
// ═════════════════════════════════════════════════════════════════════════════

// GET all active login sessions for this account.
router.get('/security/sessions', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('auditSessions');
  const sessions = (user.auditSessions || []).map((s) => ({
    id: s._id, userAgent: s.userAgent, ipAddress: s.ipAddress, deviceName: s.deviceName, platform: s.platform, createdAt: s.createdAt, lastActiveAt: s.lastActiveAt, isCurrent: s._id.toString() === req.user.sessionId,
  }));
  res.json({ success: true, data: sessions, total: sessions.length });
}));

// DELETE (revoke) one specific session by id — cannot revoke the current one.
router.delete('/security/sessions/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  if (sessionId === req.user.sessionId) return res.status(400).json({ success: false, message: 'Cannot revoke current session.' });

  const user = await User.findById(req.user._id).select('auditSessions deviceTokens');
  const session = user.auditSessions.id(sessionId);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  if (session.deviceTokenId) user.deviceTokens = user.deviceTokens.filter((t) => t._id.toString() !== session.deviceTokenId.toString());
  user.auditSessions = user.auditSessions.filter((s) => s._id.toString() !== sessionId);
  await user.save();
  res.json({ success: true, message: 'Session revoked.' });
}));

// DELETE (revoke) every session except the current one — "log out everywhere else".
router.delete('/security/sessions', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('auditSessions deviceTokens');
  const otherSessions = user.auditSessions.filter((s) => s._id.toString() !== req.user.sessionId);
  const otherTokenIds = otherSessions.filter((s) => s.deviceTokenId).map((s) => s.deviceTokenId.toString());

  user.deviceTokens = user.deviceTokens.filter((t) => !otherTokenIds.includes(t._id.toString()));
  user.auditSessions = user.auditSessions.filter((s) => s._id.toString() === req.user.sessionId);
  await user.save();
  res.json({ success: true, message: `${otherSessions.length} session(s) revoked.` });
}));

// GET registered push/device tokens for this account.
router.get('/security/device-tokens', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('deviceTokens');
  res.json({ success: true, data: user.deviceTokens });
}));

// DELETE one device token (e.g. sign out a specific phone from push notifications).
router.delete('/security/device-tokens/:tokenId', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('deviceTokens');
  user.deviceTokens = user.deviceTokens.filter((t) => t._id.toString() !== req.params.tokenId);
  await user.save();
  res.json({ success: true, message: 'Token removed.' });
}));

// PATCH change password (requires current password confirmation).
router.patch('/security/change-password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: 'Missing fields.' });
  if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  
  const user = await User.findById(req.user._id).select('+password');
  const isMatch = await bcrypt.compare(currentPassword, user.password || '');
  if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect current password.' });

  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  res.json({ success: true, message: 'Password changed.' });
}));

// PATCH notification channel preferences (sms/email/push/whatsapp) — echoes input back.
router.patch('/security/notification-preferences', asyncHandler(async (req, res) => {
  const { sms, email, push, whatsapp } = req.body;
  res.json({ success: true, message: 'Preferences saved.', data: { sms, email, push, whatsapp } });
}));

// ═════════════════════════════════════════════════════════════════════════════
// §10  DASHBOARD SUMMARY
// ═════════════════════════════════════════════════════════════════════════════

// GET the hospital-manager landing-page summary: doctor counts, booking counts,
// this-month revenue split, recent bookings, and effective platform fee — all
// in one round trip via Promise.all.
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(
      req.user._id,
      'name slug hospitalType isVerified isActive onboarding rating linkedDoctors address contact logo settlementCycle'
    );

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      doctorCount,
      verifiedDoctors,
      onlineDoctors,
      unreadNotifications,
      totalBookings,
      todayBookings,
      pendingBookings,
      monthAgg,
      recentBookings,
      totalConsultations,
      pricingConfig,
    ] = await Promise.all([
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors } }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isVerified: true }),
      DoctorProfile.countDocuments({ _id: { $in: hospital.linkedDoctors }, isOnline: true }),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
      Booking.countDocuments({ hospital: hospital._id }),
      Booking.countDocuments({ hospital: hospital._id, createdAt: { $gte: startOfToday } }),
      Booking.countDocuments({ hospital: hospital._id, status: { $in: ['pending', 'confirmed'] } }),
      Booking.aggregate([
        { $match: { hospital: hospital._id, status: 'completed', completedAt: { $gte: startOfMonth } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$fareBreakdown.totalAmount' },
            hospitalShare: { $sum: '$fareBreakdown.hospitalShare' },
            platformFee: { $sum: '$fareBreakdown.platformFee' },
            count: { $sum: 1 },
          },
        },
      ]),
      Booking.find({ hospital: hospital._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('bookingCode bookingType status scheduledAt fareBreakdown.totalAmount patientInfo.name doctorSnapshot.name')
        .lean(),
      OutPatientRecord.countDocuments({ hospital: hospital._id }),
      PlatformPricingConfig.getGlobal(),
    ]);

    const monthStats = monthAgg[0] || { revenue: 0, hospitalShare: 0, platformFee: 0, count: 0 };
    const effectivePlatformFee = PlatformPricingConfig.resolveHospitalPlatformFee(pricingConfig, hospital);

    res.json({
      success: true,
      data: {
        hospital: {
          id:              hospital._id,
          name:            hospital.name,
          slug:            hospital.slug,
          hospitalType:    hospital.hospitalType,
          isVerified:      hospital.isVerified,
          isActive:        hospital.isActive,
          logo:            hospital.logo,
          address:         hospital.address,
          contact:         hospital.contact,
          rating:          hospital.rating,
          onboarding:      hospital.onboarding,
          settlementCycle: hospital.settlementCycle,
        },
        doctors: { total: doctorCount, verified: verifiedDoctors, online: onlineDoctors },
        bookings: {
          total:             totalBookings,
          today:              todayBookings,
          pending:            pendingBookings,
          totalConsultations,
          recent:             recentBookings,
        },
        revenue: {
          thisMonth:                  monthStats.revenue,
          hospitalShareThisMonth:     monthStats.hospitalShare,
          platformFeeThisMonth:       monthStats.platformFee,
          completedBookingsThisMonth: monthStats.count,
        },
        platformFee: effectivePlatformFee, // read-only, from PlatformPricingConfig
        unreadNotifications,
      },
    });
  })
);

// ═════════════════════════════════════════════════════════════════════════════
// §11  ACCOUNT SETTINGS
// ═════════════════════════════════════════════════════════════════════════════

// GET the manager's own user-account fields (name/email/phone/avatar).
router.get('/settings/account', asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('name email phone avatar role isEmailVerified createdAt');
  res.json({ success: true, data: user });
}));

// PATCH the manager's own name/phone.
router.patch('/settings/account', asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = await User.findById(req.user._id);
  if (name?.trim()) user.name = name.trim();
  if (phone?.trim()) user.phone = phone.trim();
  await user.save();
  res.json({ success: true, message: 'Account updated.', data: { name: user.name, phone: user.phone, email: user.email } });
}));

// POST replace the manager's own avatar image.
router.post('/settings/avatar', upload.single('avatar'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const result = await uploadToImageKit(req.file.buffer, req.file.originalname, `/hospital-managers/${req.user._id}/avatar`);
  await User.findByIdAndUpdate(req.user._id, { avatar: result.url });
  res.json({ success: true, message: 'Avatar updated.', url: result.url });
}));

// ═════════════════════════════════════════════════════════════════════════════
// §12  IMAGEKIT AUTH ENDPOINT
// ═════════════════════════════════════════════════════════════════════════════

// GET short-lived ImageKit client-upload auth params (for direct browser → ImageKit uploads).
router.get('/imagekit-auth', asyncHandler(async (_req, res) => {
  res.json({ success: true, data: imagekit.getAuthenticationParameters() });
}));

// ═════════════════════════════════════════════════════════════════════════════
// §13  ERROR HANDLER (router-level)
// ═════════════════════════════════════════════════════════════════════════════

router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10 MB.' });
  if (err instanceof multer.MulterError) return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Internal server error' });
});

export default router;