/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CARE ASSISTANT ROUTER — LIKESON HEALTHCARE
 * File: routes/careAssistantRoutes.js
 *
 * All logic is inline (no external controllers).
 * Covers: Profile CRUD · Onboarding · KYC · Availability/Location ·
 *         Weekly Schedule · Bank Details · Settings · Security ·
 *         Admin Management · Performance · ImageKit Upload URLs
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import mongoose         from 'mongoose';
import bcrypt           from 'bcryptjs';
import jwt              from 'jsonwebtoken';
import ImageKit         from 'imagekit';
import multer           from 'multer';

import { protect, authorize } from '../middleware/authMiddleware.js';
import CareAssistantProfile   from '../models/CareAssistantProfile.js';
import User                   from '../models/User.js';
import SystemLog              from '../models/SystemLog.js';
import sendEmail              from '../utils/sendEmail.js';
import { otpTemplate, transactionalTemplate } from '../utils/emailTemplates.js';


// ─────────────────────────────────────────────────────────────────────────────
// IMAGEKIT CLIENT
// ─────────────────────────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ─────────────────────────────────────────────────────────────────────────────
// MULTER — memory storage (used for ImageKit direct upload via server)
// ─────────────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, WEBP images and PDF documents are allowed'));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────
const isCareAssistant = [protect, authorize('care_assistant')];
const isAdmin         = [protect, authorize('admin', 'superadmin')];
const isAny           = [protect, authorize('care_assistant', 'admin', 'superadmin')];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a 6-digit numeric OTP */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

/** Build an actor object for SystemLog from req.user */
const buildActor = (req) => ({
  userId:    req.user._id,
  name:      req.user.name,
  email:     req.user.email,
  role:      req.user.role,
  ip:        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown',
  userAgent: req.headers['user-agent'] || null,
  platform:  req.deviceInfo?.platform || 'unknown',
});

/** Compute profile completion percentage (mirrors pre-save logic for GET responses) */
const computeCompletion = (p) => {
  const checks = [
    !!p.fullName,
    !!p.dateOfBirth,
    !!p.photoUrl,
    p.experienceYears >= 0,
    !!p.phone,
    !!p.kyc?.aadhaarNumber,
    p.kyc?.aadhaarVerified === true,
    !!p.kyc?.panNumber,
    p.verification?.policeVerificationStatus === 'Completed',
    p.training?.isFirstAidCertified === true,
    !!p.bankDetails?.accountNumber,
    !!p.emergencyContact?.phone,
    !!p.weeklySchedule,
    p.healthDeclaration?.isMedicallyFit === true,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

// ─────────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — ONBOARDING & PROFILE SETUP
// ═══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/care-assistant/admin/create
// Admin / SuperAdmin creates a new care_assistant: User account + CareAssistantProfile in one shot.
// A welcome email with auto-generated credentials is dispatched automatically.
// Required body: fullName, email
// Optional body: phone, alternatePhone, dateOfBirth, gender, address, bio,
//                experienceYears, specializations, languagesKnown, workType

import asyncHandler from '../utils/asyncHandler.js';

// POST '/admin/create'
export const postAdminCreate = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      fullName, email, phone, alternatePhone, dateOfBirth, gender,
      address, bio, experienceYears, specializations, languagesKnown, workType,
    } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    if (!fullName || !email) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'fullName and email are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    // ── Duplicate checks ─────────────────────────────────────────────────────
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ success: false, message: 'A user with this email already exists' });
    }

    if (phone) {
      const existingPhone = await User.findOne({ phone }).session(session);
      if (existingPhone) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({ success: false, message: 'A user with this phone number already exists' });
      }
    }

    // ── Generate temporary password ──────────────────────────────────────────
    // Format: CA + first 4 chars of name (uppercase) + 4 random digits  e.g. CARaju7381
    const namePart      = fullName.replace(/\s+/g, '').slice(0, 4).toUpperCase();
    const randomDigits  = Math.floor(1000 + Math.random() * 9000).toString();
    const tempPassword  = `CA${namePart}${randomDigits}`;

    const salt          = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    // ── Create User ──────────────────────────────────────────────────────────
    const [newUser] = await User.create(
      [{
        name:            fullName,
        email:           email.toLowerCase().trim(),
        password:        hashedPassword,
        phone:           phone || undefined,
        role:            'care_assistant',
        isEmailVerified: false,
        isPhoneVerified: false,
        createdBy:       req.user._id,
        updatedBy:       req.user._id,
      }],
      { session }
    );

    // ── Create CareAssistantProfile ──────────────────────────────────────────
    const [profile] = await CareAssistantProfile.create(
      [{
        user:            newUser._id,
        fullName,
        email:           email.toLowerCase().trim(),
        phone:           phone           || undefined,
        alternatePhone:  alternatePhone  || undefined,
        dateOfBirth:     dateOfBirth     || undefined,
        gender:          gender          || undefined,
        address:         address         || undefined,
        bio:             bio             || undefined,
        experienceYears: experienceYears ?? 0,
        specializations: specializations || [],
        languagesKnown:  languagesKnown  || [],
        workType:        workType        || 'Part-Time',
        onboarding:      { step: 1, isComplete: false },
        createdBy:       req.user._id,
        updatedBy:       req.user._id,
      }],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // ── Send welcome email with credentials ──────────────────────────────────
    // Fires after transaction commits so a DB failure doesn't block the email
    // but an email failure also doesn't roll back the already-created records.
    try {
      const loginUrl = `${process.env.FRONTEND_URL || 'https://likeson.in'}/care-assistant/login`;
      await sendEmail({
        email:   newUser.email,
        subject: '🏥 Welcome to Likeson Healthcare — Your Care Assistant Account',
        html:    transactionalTemplate({
          header:     'Account Created',
          title:      `Welcome aboard, ${fullName}!`,
          body:       `Your care_assistant account on <strong>Likeson.in</strong> has been created by our admin team.<br><br>
                       <strong>Login Email:</strong> ${newUser.email}<br>
                       <strong>Temporary Password:</strong> <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-family:monospace;font-size:15px;">${tempPassword}</code><br><br>
                       Please log in and <strong>change your password immediately</strong> from your account security settings.<br><br>
                       Complete your profile, upload KYC documents, and wait for admin verification before you can start accepting care bookings.`,
          buttonText: 'Log In Now',
          buttonLink: loginUrl,
        }),
      });
    } catch (emailErr) {
      // Email failure is non-fatal — log it but do not error the response
      console.error('[CA Admin Create] Welcome email failed:', emailErr.message);
    }

    // ── System Log ───────────────────────────────────────────────────────────
    await SystemLog.createLog({
      level:    'success',
      category: 'user',
      message:  `Admin created care_assistant account: ${fullName} (${newUser.email})`,
      actor:    buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id, label: fullName },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 201 },
      metadata: { createdUserId: newUser._id, createdProfileId: profile._id },
    });

    // Strip password from response
    const safeUser = {
      _id:   newUser._id,
      name:  newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      role:  newUser.role,
      createdAt: newUser.createdAt,
    };

    res.status(201).json({
      success: true,
      message: `Care assistant account created. Welcome email sent to ${newUser.email}.`,
      data:    { user: safeUser, profile },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[CA Admin Create] error:', err);

    // Friendly duplicate-key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ success: false, message: `Duplicate value for ${field}` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/profile'
export const getProfile = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id })
      // Explicitly remove sensitive IDs and internal notes
      .select('-kyc.aadhaarNumber -kyc.panNumber -bankDetails.accountNumber -adminNotes')
      // Populate the base User model with specific fields
      .populate({
        path: 'user',
        select: 'name email phone avatar role isEmailVerified isPhoneVerified coins coinsEarned isOnline location'
      });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Profile not found. Please complete onboarding.' });
    }

    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/profile'
export const putProfile = asyncHandler(async (req, res) => {
  try {
    const ALLOWED = [
      'fullName', 'dateOfBirth', 'gender', 'phone', 'alternatePhone', 'email',
      'address', 'bio', 'experienceYears', 'specializations', 'languagesKnown',
      'workType', 'emergencyContact', 'preferredServiceAreas', 'maxServiceRadiusKm',
      'notifPrefs',
    ];

    const updates = {};
    ALLOWED.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided' });
    }

    updates.updatedBy = req.user._id;

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-kyc.aadhaarNumber -kyc.panNumber -bankDetails.accountNumber -adminNotes');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    await SystemLog.createLog({
      level: 'info', category: 'user',
      message: `Care assistant updated personal profile`,
      actor: buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id, label: profile.fullName },
      request: { method: 'PUT', path: req.originalUrl, statusCode: 200 },
      metadata: { updatedFields: Object.keys(updates) },
    });

    res.json({ success: true, message: 'Profile updated', data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/upload/auth'
export const getUploadAuth = asyncHandler((_req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    res.json({ success: true, data: authParams });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate upload auth' });
  }
});

// POST '/upload/photo'
export const postUploadPhoto = asyncHandler(async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const fileName = `ca_photo_${req.user._id}_${Date.now()}`;
    const result   = await imagekit.upload({
      file:   req.file.buffer,
      fileName,
      folder: '/likeson/care-assistants/photos',
      tags:   ['care-assistant', 'profile-photo'],
    });

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { photoUrl: result.url, updatedBy: req.user._id } },
      { new: true }
    ).select('photoUrl profileCompletionPercent');

    res.json({
      success: true,
      message: 'Photo uploaded',
      data: { url: result.url, fileId: result.fileId, profile },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/upload/document'
export const postUploadDocument = asyncHandler(async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const { docType } = req.body;
    const validTypes  = ['aadhaar_front', 'aadhaar_back', 'pan_card', 'police_verification', 'certificate'];
    if (!validTypes.includes(docType)) {
      return res.status(400).json({ success: false, message: `docType must be one of: ${validTypes.join(', ')}` });
    }

    const fileName = `ca_${docType}_${req.user._id}_${Date.now()}`;
    const result   = await imagekit.upload({
      file:   req.file.buffer,
      fileName,
      folder: `/likeson/care-assistants/documents/${docType}`,
      tags:   ['care-assistant', 'kyc', docType],
    });

    // Map docType → profile field
    const fieldMap = {
      aadhaar_front:       'kyc.aadhaarFrontUrl',
      aadhaar_back:        'kyc.aadhaarBackUrl',
      pan_card:            'kyc.panCardUrl',
      police_verification: 'verification.backgroundCheckUrl',
    };

    let updateObj = { updatedBy: req.user._id };
    if (fieldMap[docType]) {
      updateObj[fieldMap[docType]] = result.url;
      if (docType === 'aadhaar_front') updateObj['kyc.submittedAt'] = new Date();
    }

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updateObj },
      { new: true }
    ).select('kyc.verificationStatus verification.policeVerificationStatus profileCompletionPercent');

    res.json({
      success: true,
      message: `${docType} uploaded successfully`,
      data: { url: result.url, fileId: result.fileId, profile },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/kyc/submit'
export const putKycSubmit = asyncHandler(async (req, res) => {
  try {
    const { aadhaarNumber, panNumber } = req.body;

    if (!aadhaarNumber && !panNumber) {
      return res.status(400).json({ success: false, message: 'Provide at least Aadhaar or PAN number' });
    }

    const profile = await CareAssistantProfile.findOne({ user: req.user._id });
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    if (profile.kyc?.verificationStatus === 'Verified') {
      return res.status(400).json({ success: false, message: 'KYC is already verified' });
    }

    const kycUpdates = {
      'kyc.verificationStatus': 'Under-Review',
      'kyc.submittedAt':        new Date(),
      updatedBy:                req.user._id,
    };

    if (aadhaarNumber) {
      if (!/^\d{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({ success: false, message: 'Aadhaar must be 12 digits' });
      }
      kycUpdates['kyc.aadhaarNumber'] = aadhaarNumber;
    }

    if (panNumber) {
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
        return res.status(400).json({ success: false, message: 'Invalid PAN format (e.g. ABCDE1234F)' });
      }
      kycUpdates['kyc.panNumber'] = panNumber.toUpperCase();
    }

    const updated = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: kycUpdates },
      { new: true, runValidators: true }
    ).select('kyc.verificationStatus kyc.submittedAt kyc.aadhaarLast4 profileCompletionPercent');

    await SystemLog.createLog({
      level: 'info', category: 'kyc',
      message: `KYC submitted for review: ${profile.fullName}`,
      actor: buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id, label: profile.fullName },
      request: { method: 'PUT', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: 'KYC submitted for review', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/kyc/status'
export const getKycStatus = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id })
      .select('kyc.verificationStatus kyc.aadhaarVerified kyc.panVerified kyc.aadhaarLast4 kyc.aadhaarFrontUrl kyc.aadhaarBackUrl kyc.panCardUrl kyc.submittedAt kyc.verifiedAt kyc.rejectionReason verification profileCompletionPercent');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/training'
export const putTraining = asyncHandler(async (req, res) => {
  try {
    const TRAINING_FIELDS = [
      'isFirstAidCertified', 'patientEtiquetteTrained', 'mobilitySupportTrained',
      'medicationManagement', 'woundCare',
    ];

    const updates = {};
    TRAINING_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) updates[`training.${f}`] = req.body[f];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid training fields provided' });
    }

    updates.updatedBy = req.user._id;

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('training profileCompletionPercent');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: 'Training details updated', data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/training/certificates'
export const postTrainingCertificates = asyncHandler(async (req, res) => {
  try {
    const { name, issuedBy, issuedAt, expiresAt, documentUrl } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Certificate name is required' });

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        $push: { 'training.certificates': { name, issuedBy, issuedAt, expiresAt, documentUrl, isVerified: false } },
        $set:  { updatedBy: req.user._id },
      },
      { new: true }
    ).select('training.certificates');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.status(201).json({ success: true, message: 'Certificate added', data: profile.training.certificates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/training/certificates/:certId'
export const deleteTrainingCertificatesByCertId = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        $pull: { 'training.certificates': { _id: new mongoose.Types.ObjectId(req.params.certId) } },
        $set:  { updatedBy: req.user._id },
      },
      { new: true }
    ).select('training.certificates');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: 'Certificate removed', data: profile.training.certificates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/schedule'
export const getSchedule = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id })
      .select('weeklySchedule workType');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: { weeklySchedule: profile.weeklySchedule, workType: profile.workType } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/schedule'
export const putSchedule = asyncHandler(async (req, res) => {
  try {
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const updates = { updatedBy: req.user._id };

    DAYS.forEach((day) => {
      if (req.body[day] !== undefined) {
        const d = req.body[day];
        // Validate HH:MM format
        if (d.startTime && !/^\d{2}:\d{2}$/.test(d.startTime)) {
          throw new Error(`${day}.startTime must be in HH:MM format`);
        }
        if (d.endTime && !/^\d{2}:\d{2}$/.test(d.endTime)) {
          throw new Error(`${day}.endTime must be in HH:MM format`);
        }
        updates[`weeklySchedule.${day}`] = d;
      }
    });

    if (req.body.workType) updates.workType = req.body.workType;

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('weeklySchedule workType profileCompletionPercent');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: 'Schedule updated', data: profile });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH '/availability'
export const patchAvailability = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('isActive isBlocked kyc.verificationStatus status');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    if (profile.isBlocked) {
      return res.status(403).json({ success: false, message: 'Account is suspended' });
    }

    const updates = { updatedBy: req.user._id };

    if (req.body.isOnline !== undefined) {
      updates['availability.isOnline'] = req.body.isOnline;

      // If going online, only allow if profile is active & KYC verified
      if (req.body.isOnline && !profile.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Your profile is not yet activated. Complete KYC and wait for admin approval.',
        });
      }

      // Auto-update status
      if (req.body.isOnline) {
        updates.status = profile.status === 'On-Task' ? 'On-Task' : 'Available';
      } else {
        updates.status = 'Offline';
      }
    }

    if (req.body.currentCity)    updates['availability.currentCity']      = req.body.currentCity;
    if (req.body.minNoticeMinutes !== undefined) updates['availability.minNoticeMinutes'] = req.body.minNoticeMinutes;

    const updated = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true }
    ).select('availability status isDispatchable');

    res.json({ success: true, message: 'Availability updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/location'
export const patchLocation = asyncHandler(async (req, res) => {
  try {
    const { longitude, latitude } = req.body;

    if (longitude === undefined || latitude === undefined) {
      return res.status(400).json({ success: false, message: 'longitude and latitude are required' });
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return res.status(400).json({ success: false, message: 'Invalid coordinate values' });
    }

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        $set: {
          'location.coordinates': [longitude, latitude],
          'location.updatedAt':   new Date(),
          updatedBy: req.user._id,
        },
      },
      { new: true }
    ).select('location availability.isOnline status');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: 'Location updated', data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/status'
export const patchStatus = asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;
    const SELF_SETTABLE = ['Available', 'On-Break', 'Offline'];

    if (!SELF_SETTABLE.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${SELF_SETTABLE.join(', ')}`,
      });
    }

    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('isBlocked currentActiveTask');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    if (profile.isBlocked) return res.status(403).json({ success: false, message: 'Account suspended' });
    if (profile.currentActiveTask && status === 'Offline') {
      return res.status(400).json({ success: false, message: 'Cannot go offline while a task is active' });
    }

    const updated = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { status, 'availability.isOnline': status !== 'Offline', updatedBy: req.user._id } },
      { new: true }
    ).select('status availability.isOnline');

    res.json({ success: true, message: 'Status updated', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/bank'
export const getBank = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id })
      .select('bankDetails.accountHolderName bankDetails.accountLast4 bankDetails.ifscCode bankDetails.bankName bankDetails.upiId bankDetails.isBankVerified');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile.bankDetails });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/bank'
export const putBank = asyncHandler(async (req, res) => {
  try {
    const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body;

    const updates = { updatedBy: req.user._id };

    if (accountHolderName) updates['bankDetails.accountHolderName'] = accountHolderName;
    if (bankName)          updates['bankDetails.bankName']           = bankName;
    if (upiId)             updates['bankDetails.upiId']              = upiId;

    if (accountNumber) {
      if (accountNumber.length < 9 || accountNumber.length > 18) {
        return res.status(400).json({ success: false, message: 'Account number must be between 9 and 18 digits' });
      }
      updates['bankDetails.accountNumber']  = accountNumber;
      updates['bankDetails.accountLast4']   = accountNumber.slice(-4);
      updates['bankDetails.isBankVerified'] = false; // reset verification on change
    }

    if (ifscCode) {
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
        return res.status(400).json({ success: false, message: 'Invalid IFSC code format (e.g. SBIN0001234)' });
      }
      updates['bankDetails.ifscCode'] = ifscCode.toUpperCase();
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ success: false, message: 'No valid bank details provided' });
    }

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select('bankDetails.accountHolderName bankDetails.accountLast4 bankDetails.ifscCode bankDetails.bankName bankDetails.upiId bankDetails.isBankVerified profileCompletionPercent');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    await SystemLog.createLog({
      level: 'warning', category: 'user',
      message: 'Care assistant updated bank details',
      actor: buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id },
      request: { method: 'PUT', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: 'Bank details saved', data: profile.bankDetails });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/health-declaration'
export const putHealthDeclaration = asyncHandler(async (req, res) => {
  try {
    const { isMedicallyFit, anyKnownConditions } = req.body;

    if (isMedicallyFit === undefined) {
      return res.status(400).json({ success: false, message: 'isMedicallyFit (boolean) is required' });
    }

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        $set: {
          'healthDeclaration.isMedicallyFit':     isMedicallyFit,
          'healthDeclaration.declaredAt':         new Date(),
          'healthDeclaration.anyKnownConditions': anyKnownConditions || null,
          updatedBy: req.user._id,
        },
      },
      { new: true }
    ).select('healthDeclaration.isMedicallyFit healthDeclaration.declaredAt profileCompletionPercent');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: 'Health declaration saved', data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/onboarding/step'
export const patchOnboardingStep = asyncHandler(async (req, res) => {
  try {
    const { step } = req.body;
    if (!step || typeof step !== 'number') {
      return res.status(400).json({ success: false, message: 'step (number) is required' });
    }

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: { 'onboarding.step': step, updatedBy: req.user._id } },
      { new: true }
    ).select('onboarding profileCompletionPercent');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: `Onboarding step updated to ${step}`, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/onboarding/complete'
export const patchOnboardingComplete = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('profileCompletionPercent onboarding');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    const completion = computeCompletion(profile);
    if (completion < 60) {
      return res.status(400).json({
        success: false,
        message: `Profile must be at least 60% complete before onboarding can be finalized. Current: ${completion}%`,
        completionPercent: completion,
      });
    }

    const updated = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        $set: {
          'onboarding.isComplete':      true,
          'onboarding.completedAt':     new Date(),
          'onboarding.agreedToTermsAt': new Date(),
          updatedBy: req.user._id,
        },
      },
      { new: true }
    ).select('onboarding profileCompletionPercent');

    await SystemLog.createLog({
      level: 'success', category: 'user',
      message: `Care assistant completed onboarding`,
      actor: buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id },
      request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: 'Onboarding completed', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/settings'
export const getSettings = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id })
      .select('notifPrefs preferredServiceAreas maxServiceRadiusKm availability.currentCity availability.minNoticeMinutes workType');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/settings/notifications'
export const putSettingsNotifications = asyncHandler(async (req, res) => {
  try {
    const { sms, email, push, whatsapp } = req.body;
    const updates = { updatedBy: req.user._id };
    if (sms      !== undefined) updates['notifPrefs.sms']      = sms;
    if (email    !== undefined) updates['notifPrefs.email']     = email;
    if (push     !== undefined) updates['notifPrefs.push']      = push;
    if (whatsapp !== undefined) updates['notifPrefs.whatsapp']  = whatsapp;

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true }
    ).select('notifPrefs');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, message: 'Notification preferences updated', data: profile.notifPrefs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/settings/service-area'
export const putSettingsServiceArea = asyncHandler(async (req, res) => {
  try {
    const { preferredServiceAreas, maxServiceRadiusKm } = req.body;
    const updates = { updatedBy: req.user._id };

    if (preferredServiceAreas !== undefined) {
      if (!Array.isArray(preferredServiceAreas)) {
        return res.status(400).json({ success: false, message: 'preferredServiceAreas must be an array' });
      }
      updates.preferredServiceAreas = preferredServiceAreas;
    }

    if (maxServiceRadiusKm !== undefined) {
      if (maxServiceRadiusKm < 1) {
        return res.status(400).json({ success: false, message: 'maxServiceRadiusKm must be at least 1' });
      }
      updates.maxServiceRadiusKm = maxServiceRadiusKm;
    }

    const profile = await CareAssistantProfile.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true }
    ).select('preferredServiceAreas maxServiceRadiusKm');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, message: 'Service area updated', data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/settings/device-token'
export const postSettingsDeviceToken = asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    // Add token to both User.deviceTokens and CareAssistantProfile.deviceTokens
    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $addToSet: { deviceTokens: token } }),
      CareAssistantProfile.findOneAndUpdate(
        { user: req.user._id },
        { $addToSet: { deviceTokens: token } }
      ),
    ]);

    res.json({ success: true, message: 'Device token registered' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/settings/device-token'
export const deleteSettingsDeviceToken = asyncHandler(async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: 'token is required' });

    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $pull: { deviceTokens: token } }),
      CareAssistantProfile.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { deviceTokens: token } }
      ),
    ]);

    res.json({ success: true, message: 'Device token removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT '/security/change-password'
export const putSecurityChangePassword = asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ success: false, message: 'All password fields are required' });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ success: false, message: 'New passwords do not match' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(12);
    user.password          = await bcrypt.hash(newPassword, salt);
    user.passwordChangedAt = new Date();
    await user.save();

    // Send security confirmation email
    try {
      const { passwordChangedTemplate } = await import('../utils/emailTemplates.js');
      await sendEmail({
        email:   user.email,
        subject: 'Your Likeson Password Was Changed',
        html:    passwordChangedTemplate({
          title:      'Password Changed Successfully',
          body:       'Your account password has been updated. If you did not make this change, contact support immediately.',
          buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/care-assistant/dashboard`,
          buttonText: 'Go to Dashboard',
        }),
      });
    } catch (emailErr) {
      console.error('[CA] password change email failed:', emailErr.message);
    }

    await SystemLog.createLog({
      level: 'warning', category: 'security',
      message: `Care assistant changed password`,
      actor: buildActor(req),
      request: { method: 'PUT', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/security/send-email-otp'
export const postSecuritySendEmailOtp = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const otp        = generateOTP();
    const salt       = await bcrypt.genSalt(10);
    user.otp         = await bcrypt.hash(otp, salt);
    user.otpExpires  = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    await sendEmail({
      email:   user.email,
      subject: 'Your Likeson Verification Code',
      html:    otpTemplate({
        title:   'Email Verification Code',
        body:    'Use the code below to verify your identity. Do not share it with anyone.',
        otpCode: otp,
      }),
    });

    res.json({ success: true, message: `OTP sent to ${user.email}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/security/verify-email-otp'
export const postSecurityVerifyEmailOtp = asyncHandler(async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

    const user = await User.findById(req.user._id).select('+otp +otpExpires');
    if (!user || !user.otp || !user.otpExpires) {
      return res.status(400).json({ success: false, message: 'OTP not found. Please request a new one.' });
    }

    if (user.otpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    const isValid = await bcrypt.compare(otp, user.otp);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Clear OTP after successful verification
    user.otp        = undefined;
    user.otpExpires = undefined;
    if (!user.isEmailVerified) user.isEmailVerified = true;
    await user.save();

    res.json({ success: true, message: 'OTP verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/security/sessions'
export const getSecuritySessions = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('auditSessions lastLoginAt lastLoginIp loginCount');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({
      success: true,
      data: {
        sessions:       user.auditSessions,
        lastLoginAt:    user.lastLoginAt,
        lastLoginIp:    user.lastLoginIp,
        loginCount:     user.loginCount,
        sessionCount:   user.auditSessions.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/security/sessions/:sessionId'
export const deleteSecuritySessionsBySessionId = asyncHandler(async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { auditSessions: { _id: new mongoose.Types.ObjectId(req.params.sessionId) } } },
      { new: true }
    ).select('auditSessions');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'Session revoked', data: { sessions: user.auditSessions } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/security/sessions'
export const deleteSecuritySessions = asyncHandler(async (req, res) => {
  try {
    // Keep only the most recent session (current)
    const user  = await User.findById(req.user._id).select('auditSessions');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const latest = user.auditSessions.sort((a, b) => b.createdAt - a.createdAt)[0];
    user.auditSessions = latest ? [latest] : [];
    await user.save();

    await SystemLog.createLog({
      level: 'warning', category: 'security',
      message: 'Care assistant revoked all sessions',
      actor: buildActor(req),
      request: { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: 'All other sessions revoked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/security/request-account-deletion'
export const postSecurityRequestAccountDeletion = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select('currentActiveTask fullName');
    if (profile?.currentActiveTask) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request account deletion while a task is active',
      });
    }

    const otp        = generateOTP();
    const salt       = await bcrypt.genSalt(10);
    user.otp         = await bcrypt.hash(otp, salt);
    user.otpExpires  = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.save();

    await sendEmail({
      email:   user.email,
      subject: 'Confirm Account Deletion — Likeson Healthcare',
      html:    otpTemplate({
        title:   'Account Deletion Request',
        body:    'We received a request to permanently delete your Likeson care_assistant account. If this was you, use the code below to confirm. This action cannot be undone.',
        otpCode: otp,
      }),
    });

    await SystemLog.createLog({
      level: 'warning', category: 'security',
      message: `Care assistant requested account deletion: ${profile?.fullName || user.email}`,
      actor: buildActor(req),
      request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: 'Deletion confirmation OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE '/security/confirm-account-deletion'
export const deleteSecurityConfirmAccountDeletion = asyncHandler(async (req, res) => {
  try {
    const { otp, reason } = req.body;
    if (!otp) return res.status(400).json({ success: false, message: 'OTP is required to confirm deletion' });

    const user = await User.findById(req.user._id).select('+otp +otpExpires');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.otp || !user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });
    }

    const isValid = await bcrypt.compare(otp, user.otp);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    // Soft-delete: block + mark inactive rather than hard delete (preserve booking records)
    await Promise.all([
      CareAssistantProfile.findOneAndUpdate(
        { user: req.user._id },
        { $set: { isActive: false, isBlocked: true, blockReason: reason || 'Account deleted by user', status: 'Suspended', 'availability.isOnline': false } }
      ),
      User.findByIdAndUpdate(req.user._id, {
        $set:   { isBlocked: true, blockReason: 'Account deleted by user request', email: `deleted_${Date.now()}_${user.email}` },
        $unset: { otp: '', otpExpires: '' },
      }),
    ]);

    await SystemLog.createLog({
      level: 'warning', category: 'user',
      message: `Care assistant account soft-deleted`,
      actor: buildActor(req),
      request: { method: 'DELETE', path: req.originalUrl, statusCode: 200 },
      metadata: { reason },
    });

    res.json({ success: true, message: 'Account has been deleted. We are sorry to see you go.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/performance'
export const getPerformance = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOne({ user: req.user._id })
      .select('performance earnings');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json({ success: true, data: { performance: profile.performance, earnings: profile.earnings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/all'
export const getAdminAll = asyncHandler(async (req, res) => {
  try {
    const {
      page       = 1,
      limit      = 20,
      status,
      workType,
      city,
      kycStatus,
      isActive,
      isBlocked,
      search,
      sortBy     = 'createdAt',
      sortOrder  = 'desc',
    } = req.query;

    const query = {};

    if (status)    query.status                      = status;
    if (workType)  query.workType                    = workType;
    if (city)      query['availability.currentCity'] = new RegExp(city, 'i');
    if (kycStatus) query['kyc.verificationStatus']   = kycStatus;
    if (isActive  !== undefined) query.isActive  = isActive  === 'true';
    if (isBlocked !== undefined) query.isBlocked = isBlocked === 'true';

    if (search) {
      query.$or = [
        { fullName: new RegExp(search, 'i') },
        { phone:    new RegExp(search, 'i') },
        { email:    new RegExp(search, 'i') },
      ];
    }

    const skip    = (parseInt(page) - 1) * parseInt(limit);
    const sort    = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
    const total   = await CareAssistantProfile.countDocuments(query);

    const profiles = await CareAssistantProfile.find(query)
      .select('-kyc.aadhaarNumber -kyc.panNumber -bankDetails.accountNumber -adminNotes -healthDeclaration.anyKnownConditions')
      .populate('user', 'name email phone role createdAt lastLoginAt')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: profiles,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/:id'
export const getAdminById = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid profile ID' });
    }

    const profile = await CareAssistantProfile.findById(req.params.id)
      .select('-kyc.aadhaarNumber -kyc.panNumber -bankDetails.accountNumber -healthDeclaration.anyKnownConditions')
      .populate('user', 'name email phone role isBlocked isEmailVerified createdAt lastLoginAt loginCount')
      .populate('kyc.verifiedBy',           'name email role')
      .populate('verification.verifiedBy',  'name email role')
      .populate('currentActiveTask');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/kyc'
export const patchAdminByIdKyc = asyncHandler(async (req, res) => {
  try {
    const { action, rejectionReason } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be "approve" or "reject"' });
    }

    const profile = await CareAssistantProfile.findById(req.params.id);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    const kycUpdates = {
      'kyc.verifiedBy':   req.user._id,
      'kyc.verifiedAt':   new Date(),
    };

    if (action === 'approve') {
      kycUpdates['kyc.verificationStatus'] = 'Verified';
      kycUpdates['kyc.aadhaarVerified']    = true;
      kycUpdates['kyc.panVerified']        = true;
      // Pre-save hook will auto-set isActive = true & verification.isVerified = true
    } else {
      kycUpdates['kyc.verificationStatus'] = 'Rejected';
      kycUpdates['kyc.rejectionReason']    = rejectionReason || 'Documents did not meet requirements';
    }

    const updated = await CareAssistantProfile.findByIdAndUpdate(
      req.params.id,
      { $set: { ...kycUpdates, updatedBy: req.user._id } },
      { new: true }
    ).select('kyc.verificationStatus kyc.aadhaarVerified kyc.panVerified isActive verification.isVerified fullName');

    // Notify care_assistant by email
    try {
      const caUser = await User.findById(profile.user).select('email name');
      if (caUser) {
        await sendEmail({
          email:   caUser.email,
          subject: action === 'approve' ? '✅ KYC Verified — Likeson Healthcare' : '❌ KYC Update Required — Likeson Healthcare',
          html:    transactionalTemplate({
            header:     'KYC Verification',
            title:      action === 'approve' ? 'Your KYC has been verified!' : 'Action Required: KYC Rejected',
            body:       action === 'approve'
              ? 'Congratulations! Your KYC documents have been successfully verified. You can now go online and start accepting care bookings.'
              : `Your KYC submission was not approved. Reason: <strong>${rejectionReason || 'Documents did not meet requirements'}</strong>. Please re-upload correct documents.`,
            buttonText: action === 'approve' ? 'Go Online Now' : 'Re-Submit KYC',
            buttonLink: `${process.env.FRONTEND_URL || 'https://likeson.in'}/care-assistant/kyc`,
          }),
        });
      }
    } catch (emailErr) {
      console.error('[CA Admin] KYC notification email failed:', emailErr.message);
    }

    await SystemLog.createLog({
      level: action === 'approve' ? 'success' : 'warning',
      category: 'kyc',
      message: `Care assistant KYC ${action === 'approve' ? 'approved' : 'rejected'}: ${profile.fullName}`,
      actor: buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id, label: profile.fullName },
      request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      metadata: { action, rejectionReason },
    });

    res.json({ success: true, message: `KYC ${action === 'approve' ? 'approved' : 'rejected'}`, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/police-verification'
export const patchAdminByIdPoliceVerification = asyncHandler(async (req, res) => {
  try {
    const { status, backgroundCheckUrl, backgroundCheckDate } = req.body;
    const VALID = ['Pending', 'Completed', 'Rejected'];

    if (!VALID.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${VALID.join(', ')}` });
    }

    const updates = {
      'verification.policeVerificationStatus': status,
      'verification.verifiedBy':               req.user._id,
      updatedBy: req.user._id,
    };
    if (backgroundCheckUrl)  updates['verification.backgroundCheckUrl']  = backgroundCheckUrl;
    if (backgroundCheckDate) updates['verification.backgroundCheckDate'] = backgroundCheckDate;
    if (status === 'Completed') updates['verification.verifiedAt'] = new Date();

    const profile = await CareAssistantProfile.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('verification profileCompletionPercent fullName');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    await SystemLog.createLog({
      level: 'info', category: 'kyc',
      message: `Police verification updated to "${status}" for ${profile.fullName}`,
      actor: buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id, label: profile.fullName },
      request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: 'Police verification status updated', data: profile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/block'
export const patchAdminByIdBlock = asyncHandler(async (req, res) => {
  try {
    const { blockReason, unblockAt } = req.body;
    if (!blockReason) {
      return res.status(400).json({ success: false, message: 'blockReason is required' });
    }

    const profile = await CareAssistantProfile.findById(req.params.id).select('user fullName');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    await Promise.all([
      CareAssistantProfile.findByIdAndUpdate(req.params.id, {
        $set: { isBlocked: true, blockReason, status: 'Suspended', 'availability.isOnline': false, updatedBy: req.user._id },
      }),
      User.findByIdAndUpdate(profile.user, {
        $set: { isBlocked: true, blockReason, ...(unblockAt && { unblockAt }) },
      }),
    ]);

    // Notify
    try {
      const caUser = await User.findById(profile.user).select('email');
      if (caUser) {
        await sendEmail({
          email:   caUser.email,
          subject: '⚠️ Your Likeson Account Has Been Suspended',
          html:    transactionalTemplate({
            header:     'Account Suspended',
            title:      'Your account has been suspended',
            body:       `Your care_assistant account has been suspended.<br><br><strong>Reason:</strong> ${blockReason}${unblockAt ? `<br><strong>Auto-unblock:</strong> ${new Date(unblockAt).toLocaleString('en-IN')}` : ''}<br><br>Please contact support at <a href="mailto:support@likeson.in">support@likeson.in</a> if you believe this is a mistake.`,
            buttonText: 'Contact Support',
            buttonLink: 'mailto:support@likeson.in',
          }),
        });
      }
    } catch (emailErr) {
      console.error('[CA Admin] block email failed:', emailErr.message);
    }

    await SystemLog.createLog({
      level: 'warning', category: 'security',
      message: `Care assistant blocked: ${profile.fullName}`,
      actor: buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id, label: profile.fullName },
      request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      metadata: { blockReason, unblockAt },
    });

    res.json({ success: true, message: `Care assistant ${profile.fullName} has been suspended` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/unblock'
export const patchAdminByIdUnblock = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findById(req.params.id).select('user fullName');
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    await Promise.all([
      CareAssistantProfile.findByIdAndUpdate(req.params.id, {
        $set:   { isBlocked: false, status: 'Offline', 'availability.isOnline': false, updatedBy: req.user._id },
        $unset: { blockReason: '' },
      }),
      User.findByIdAndUpdate(profile.user, {
        $set:   { isBlocked: false },
        $unset: { blockReason: '', unblockAt: '' },
      }),
    ]);

    await SystemLog.createLog({
      level: 'info', category: 'security',
      message: `Care assistant unblocked: ${profile.fullName}`,
      actor: buildActor(req),
      relatedEntity: { model: 'CareAssistantProfile', entityId: profile._id, label: profile.fullName },
      request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
    });

    res.json({ success: true, message: `Care assistant ${profile.fullName} has been unblocked` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/verify-certificate/:certId'
export const patchAdminByIdVerifyCertificateByCertId = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findOneAndUpdate(
      {
        _id: req.params.id,
        'training.certificates._id': new mongoose.Types.ObjectId(req.params.certId),
      },
      { $set: { 'training.certificates.$.isVerified': true } },
      { new: true }
    ).select('training.certificates');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile or certificate not found' });

    res.json({ success: true, message: 'Certificate verified', data: profile.training.certificates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/performance'
export const patchAdminByIdPerformance = asyncHandler(async (req, res) => {
  try {
    const PERF_FIELDS = [
      'averageRating', 'totalRatings', 'totalTasksCompleted', 'totalTasksCancelled',
      'cancellationRate', 'totalEarnings', 'monthlyTasks', 'lastTaskAt',
      'complaintsCount', 'complimentsCount', 'onTimeArrivalRate', 'repeatClientRate',
    ];

    const updates = { updatedBy: req.user._id };
    PERF_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) updates[`performance.${f}`] = req.body[f];
    });

    const EARN_FIELDS = ['totalPaid', 'pendingPayout', 'lastPayoutAt', 'lifetimeBookings'];
    EARN_FIELDS.forEach((f) => {
      if (req.body[f] !== undefined) updates[`earnings.${f}`] = req.body[f];
    });

    const profile = await CareAssistantProfile.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('performance earnings fullName');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: 'Performance updated', data: { performance: profile.performance, earnings: profile.earnings } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/notes'
export const patchAdminByIdNotes = asyncHandler(async (req, res) => {
  try {
    const { adminNotes, tags } = req.body;
    const updates = { updatedBy: req.user._id };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (tags       !== undefined) updates.tags       = tags;

    const profile = await CareAssistantProfile.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    ).select('adminNotes tags fullName');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: 'Admin notes updated', data: { adminNotes: profile.adminNotes, tags: profile.tags } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH '/admin/:id/bank/verify'
export const patchAdminByIdBankVerify = asyncHandler(async (req, res) => {
  try {
    const profile = await CareAssistantProfile.findByIdAndUpdate(
      req.params.id,
      { $set: { 'bankDetails.isBankVerified': true, updatedBy: req.user._id } },
      { new: true }
    ).select('bankDetails.isBankVerified bankDetails.accountLast4 fullName');

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    res.json({ success: true, message: `Bank account verified for ${profile.fullName}`, data: profile.bankDetails });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/stats/overview'
export const getAdminStatsOverview = asyncHandler(async (req, res) => {
  try {
    const [
      total, active, online, suspended, kycVerified, kycPending,
      kycUnderReview, dispatchableCount,
    ] = await Promise.all([
      CareAssistantProfile.countDocuments(),
      CareAssistantProfile.countDocuments({ isActive: true }),
      CareAssistantProfile.countDocuments({ 'availability.isOnline': true }),
      CareAssistantProfile.countDocuments({ isBlocked: true }),
      CareAssistantProfile.countDocuments({ 'kyc.verificationStatus': 'Verified' }),
      CareAssistantProfile.countDocuments({ 'kyc.verificationStatus': 'Pending' }),
      CareAssistantProfile.countDocuments({ 'kyc.verificationStatus': 'Under-Review' }),
      CareAssistantProfile.countDocuments({
        isActive: true,
        isBlocked: false,
        status: 'Available',
        'kyc.verificationStatus': 'Verified',
        'verification.isVerified': true,
      }),
    ]);

    const workTypeBreakdown = await CareAssistantProfile.aggregate([
      { $group: { _id: '$workType', count: { $sum: 1 } } },
    ]);

    const cityBreakdown = await CareAssistantProfile.aggregate([
      { $match: { 'availability.isOnline': true } },
      { $group: { _id: '$availability.currentCity', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      success: true,
      data: {
        total, active, online, suspended,
        kyc: { verified: kycVerified, pending: kycPending, underReview: kycUnderReview },
        dispatchableNow: dispatchableCount,
        workTypeBreakdown,
        topOnlineCities: cityBreakdown,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/nearby'
export const getAdminNearby = asyncHandler(async (req, res) => {
  try {
    const { lng, lat, radiusKm = 10, status = 'Available' } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({ success: false, message: 'lng and lat query params are required' });
    }

    const profiles = await CareAssistantProfile.find({
      location: {
        $near: {
          $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseFloat(radiusKm) * 1000,
        },
      },
      status,
      isActive:  true,
      isBlocked: false,
      'kyc.verificationStatus': 'Verified',
    })
      .select('fullName photoUrl phone status availability location performance.averageRating specializations')
      .limit(20);

    res.json({ success: true, count: profiles.length, data: profiles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
