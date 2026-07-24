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

import asyncHandler from '../utils/asyncHandler.js';

// GET '/profile'
export const getProfile = asyncHandler(async (req, res) => {
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
  });

// PATCH '/profile/basic'
export const patchProfileBasic = asyncHandler(async (req, res) => {
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
  });

// PATCH '/profile/location'
export const patchProfileLocation = asyncHandler(async (req, res) => {
    const { lat, lng, address } = req.body;

    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng are required.' });
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return res.status(400).json({ success: false, message: 'Invalid coordinates.' });

    const hospital = await resolveHospital(req.user._id);

    hospital.location.coordinates = [parseFloat(lng), parseFloat(lat)];
    if (address) hospital.address = { ...hospital.address.toObject(), ...address };
    hospital.updatedBy = req.user._id;

    await hospital.save();
    res.json({ success: true, message: 'Location updated.', data: { location: hospital.location, address: hospital.address } });
  });

// POST '/upload/logo'
export const postUploadLogo = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const hospital = await resolveHospital(req.user._id);
    const result = await uploadToImageKit(req.file.buffer, req.file.originalname, `/hospitals/${hospital._id}/logo`);
    hospital.logo = result.url;
    hospital.updatedBy = req.user._id;
    await hospital.save();
    res.json({ success: true, message: 'Logo uploaded.', url: result.url });
  });

// POST '/upload/images'
export const postUploadImages = asyncHandler(async (req, res) => {
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
  });

// DELETE '/upload/images'
export const deleteUploadImages = asyncHandler(async (req, res) => {
    const { imageUrl } = req.body;
    if (!imageUrl) return res.status(400).json({ success: false, message: 'imageUrl required.' });
    
    const hospital = await resolveHospital(req.user._id);
    if (!hospital.images.includes(imageUrl)) return res.status(404).json({ success: false, message: 'Image not found.' });

    hospital.images = hospital.images.filter((u) => u !== imageUrl);
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Image removed.', remaining: hospital.images.length });
  });

// POST '/upload/license-document'
export const postUploadLicenseDocument = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
    const hospital = await resolveHospital(req.user._id);
    const result = await uploadToImageKit(req.file.buffer, req.file.originalname, `/hospitals/${hospital._id}/documents`);
    
    hospital.registrationDetails.documentUrl = result.url;
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'License uploaded.', url: result.url });
  });

// GET '/operating-hours'
export const getOperatingHours = asyncHandler(async (req, res) => {
    const hospital = await resolveHospital(req.user._id, 'operatingHours is24x7');
    res.json({ success: true, data: { operatingHours: hospital.operatingHours, is24x7: hospital.is24x7 } });
  });

// PUT '/operating-hours'
export const putOperatingHours = asyncHandler(async (req, res) => {
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
  });

// GET '/pricing'
export const getPricing = asyncHandler(async (req, res) => {
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
  });

// PATCH '/pricing'
export const patchPricing = asyncHandler(async (req, res) => {
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
  });

// GET '/doctors/:doctorProfileId/pricing'
export const getDoctorsByDoctorProfileIdPricing = asyncHandler(async (_req, res) => {
    res.status(410).json({
      success: false,
      message: 'Per-doctor pricing was removed for hospital-managed hospitals. Use GET /hospital-manager/pricing instead — it applies to every linked doctor.',
    });
  });

// PATCH '/doctors/:doctorProfileId/pricing'
export const patchDoctorsByDoctorProfileIdPricing = asyncHandler(async (_req, res) => {
    res.status(410).json({
      success: false,
      message: 'Per-doctor pricing was removed for hospital-managed hospitals. Use PATCH /hospital-manager/pricing instead — it applies to every linked doctor.',
    });
  });

// GET '/platform-fee'
export const getPlatformFee = asyncHandler(async (req, res) => {
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
  });

// GET '/doctors/search'
export const getDoctorsSearch = asyncHandler(async (req, res) => {
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
  });

// GET '/doctors/stats'
export const getDoctorsStats = asyncHandler(async (req, res) => {
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
  });

// POST '/doctors/create-and-link'
export const postDoctorsCreateAndLink = asyncHandler(async (req, res) => {
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
  });

// GET '/doctors'
export const getDoctors = asyncHandler(async (req, res) => {
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
  });

// GET '/doctors/:doctorProfileId'
export const getDoctorsByDoctorProfileId = asyncHandler(async (req, res) => {
    const { doctorProfileId } = req.params;
    if (!mongoose.isValidObjectId(doctorProfileId)) return res.status(400).json({ success: false, message: 'Invalid ID.' });

    const hospital = await resolveHospital(req.user._id, 'linkedDoctors');
    if (!hospital.linkedDoctors.map(String).includes(doctorProfileId)) return res.status(404).json({ success: false, message: 'Doctor not linked.' });

    const doctor = await DoctorProfile.findById(doctorProfileId).populate('user', 'name email phone avatar isActive lastActiveAt').populate('primaryHospital', 'name hospitalType');
    res.json({ success: true, data: doctor });
  });

// DELETE '/doctors/:doctorProfileId/unlink'
export const deleteDoctorsByDoctorProfileIdUnlink = asyncHandler(async (req, res) => {
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
  });

// GET '/doctors/:doctorProfileId/availability'
export const getDoctorsByDoctorProfileIdAvailability = asyncHandler(async (req, res) => {
    const { doctorProfileId } = req.params;
    const hospital = await resolveHospital(req.user._id, 'linkedDoctors');
    if (!hospital.linkedDoctors.map(String).includes(doctorProfileId)) return res.status(404).json({ success: false, message: 'Not linked.' });

    const doctor = await DoctorProfile.findById(doctorProfileId).select('weeklyAvailability').populate('user', 'name');
    res.json({ success: true, data: doctor.weeklyAvailability, doctor: doctor.user?.name });
  });

// PATCH '/registration'
export const patchRegistration = asyncHandler(async (req, res) => {
    const allowed = ['licenseNumber', 'gstNumber', 'panNumber', 'licenseExpiry'];
    const hospital = await resolveHospital(req.user._id);

    allowed.forEach((field) => { if (req.body[field] !== undefined) hospital.registrationDetails[field] = req.body[field]; });
    hospital.updatedBy = req.user._id;
    await hospital.save();

    res.json({ success: true, message: 'Registration details updated.', data: hospital.registrationDetails });
  });

// GET '/onboarding'
export const getOnboarding = asyncHandler(async (req, res) => {
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
  });

// GET '/notifications'
export const getNotifications = asyncHandler(async (req, res) => {
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
  });

// PATCH '/notifications/mark-read'
export const patchNotificationsMarkRead = asyncHandler(async (req, res) => {
    const { notificationIds } = req.body;
    const filter = { recipient: req.user._id, isRead: false };
    if (Array.isArray(notificationIds) && notificationIds.length) filter._id = { $in: notificationIds };

    const result = await Notification.updateMany(filter, { $set: { isRead: true, readAt: new Date() } });
    res.json({ success: true, message: `${result.modifiedCount} notification(s) marked as read.` });
  });

// GET '/security/sessions'
export const getSecuritySessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('auditSessions');
  const sessions = (user.auditSessions || []).map((s) => ({
    id: s._id, userAgent: s.userAgent, ipAddress: s.ipAddress, deviceName: s.deviceName, platform: s.platform, createdAt: s.createdAt, lastActiveAt: s.lastActiveAt, isCurrent: s._id.toString() === req.user.sessionId,
  }));
  res.json({ success: true, data: sessions, total: sessions.length });
});

// DELETE '/security/sessions/:sessionId'
export const deleteSecuritySessionsBySessionId = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  if (sessionId === req.user.sessionId) return res.status(400).json({ success: false, message: 'Cannot revoke current session.' });

  const user = await User.findById(req.user._id).select('auditSessions deviceTokens');
  const session = user.auditSessions.id(sessionId);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found.' });

  if (session.deviceTokenId) user.deviceTokens = user.deviceTokens.filter((t) => t._id.toString() !== session.deviceTokenId.toString());
  user.auditSessions = user.auditSessions.filter((s) => s._id.toString() !== sessionId);
  await user.save();
  res.json({ success: true, message: 'Session revoked.' });
});

// DELETE '/security/sessions'
export const deleteSecuritySessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('auditSessions deviceTokens');
  const otherSessions = user.auditSessions.filter((s) => s._id.toString() !== req.user.sessionId);
  const otherTokenIds = otherSessions.filter((s) => s.deviceTokenId).map((s) => s.deviceTokenId.toString());

  user.deviceTokens = user.deviceTokens.filter((t) => !otherTokenIds.includes(t._id.toString()));
  user.auditSessions = user.auditSessions.filter((s) => s._id.toString() === req.user.sessionId);
  await user.save();
  res.json({ success: true, message: `${otherSessions.length} session(s) revoked.` });
});

// GET '/security/device-tokens'
export const getSecurityDeviceTokens = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('deviceTokens');
  res.json({ success: true, data: user.deviceTokens });
});

// DELETE '/security/device-tokens/:tokenId'
export const deleteSecurityDeviceTokensByTokenId = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('deviceTokens');
  user.deviceTokens = user.deviceTokens.filter((t) => t._id.toString() !== req.params.tokenId);
  await user.save();
  res.json({ success: true, message: 'Token removed.' });
});

// PATCH '/security/change-password'
export const patchSecurityChangePassword = asyncHandler(async (req, res) => {
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
});

// PATCH '/security/notification-preferences'
export const patchSecurityNotificationPreferences = asyncHandler(async (req, res) => {
  const { sms, email, push, whatsapp } = req.body;
  res.json({ success: true, message: 'Preferences saved.', data: { sms, email, push, whatsapp } });
});

// GET '/dashboard'
export const getDashboard = asyncHandler(async (req, res) => {
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
  });

// GET '/settings/account'
export const getSettingsAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('name email phone avatar role isEmailVerified createdAt');
  res.json({ success: true, data: user });
});

// PATCH '/settings/account'
export const patchSettingsAccount = asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const user = await User.findById(req.user._id);
  if (name?.trim()) user.name = name.trim();
  if (phone?.trim()) user.phone = phone.trim();
  await user.save();
  res.json({ success: true, message: 'Account updated.', data: { name: user.name, phone: user.phone, email: user.email } });
});

// POST '/settings/avatar'
export const postSettingsAvatar = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' });
  const result = await uploadToImageKit(req.file.buffer, req.file.originalname, `/hospital-managers/${req.user._id}/avatar`);
  await User.findByIdAndUpdate(req.user._id, { avatar: result.url });
  res.json({ success: true, message: 'Avatar updated.', url: result.url });
});

// GET '/imagekit-auth'
export const getImagekitAuth = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: imagekit.getAuthenticationParameters() });
});

// Centralised error handler (register last on the router)
export const errorHandler = (err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10 MB.' });
  if (err instanceof multer.MulterError) return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Internal server error' });
};
