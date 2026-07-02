import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import ImageKit from 'imagekit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Hospital from '../models/Hospital.js';
import DoctorProfile from '../models/DoctorProfile.js';
import User from '../models/User.js';
import SystemLog from '../models/SystemLog.js';
import Booking from '../models/Booking.js';
import OutPatientRecord from '../models/OutPatientRecord.js';
import Consultation from '../models/Consultation.js';
import sendEmail from '../utils/sendEmail.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import {
  invalidateUserCache,
  invalidatePattern,
} from '../utils/cacheInvalidation.js';

const router = express.Router();

// ── ESM __dirname shim ────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ── ImageKit Instance ─────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ── Multer — memory storage (no disk writes) ──────────────────────────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
});

const hospitalUpload = upload.fields([
  { name: 'logo',   maxCount: 1  },
  { name: 'images', maxCount: 20 },
]);
const doctorUpload = upload.single('photo');
const signatureUpload = upload.single('signature'); 

const handleMulterError = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    return res.status(400).json({ success: false, message: err.message || 'File upload failed' });
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

const uploadToImageKit = (bufferOrFile, fileName, folder) => {
  let buffer;
  if (Buffer.isBuffer(bufferOrFile)) {
    buffer = bufferOrFile;
  } else if (bufferOrFile?.buffer && Buffer.isBuffer(bufferOrFile.buffer)) {
    buffer = bufferOrFile.buffer;
  } else if (bufferOrFile?.data && Buffer.isBuffer(bufferOrFile.data)) {
    buffer = bufferOrFile.data;
  } else {
    return Promise.reject(new Error('uploadToImageKit: invalid file input.'));
  }
  return new Promise((resolve, reject) => {
    imagekit.upload(
      { file: buffer, fileName, folder, useUniqueFileName: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });
};

const buildGeoFilter = (query) => {
  const lat      = parseFloat(query.lat);
  const lng      = parseFloat(query.lng);
  const distance = Math.min(100, Math.max(0, parseFloat(query.distance) || 10));
  if (isNaN(lat) || isNaN(lng)) return { filter: null, distance };
  const filter = {
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: distance * 1000,
      },
    },
  };
  return { filter, distance };
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch((err) => {
    // Mongoose ValidationError (e.g. "honorarium cannot exceed fee",
    // scheduledPricing overlap) is a client input problem → 400, not 500.
    const status = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    res.status(status).json({ success: false, message: err.message });
  });

// Single source of truth for "how is this hospital priced" — used by the
// dedicated pricing endpoint AND attached to detail views so front-end
// doesn't need two calls to know whether to show hospital or per-doctor fees.
const buildHospitalPricingInfo = (hospital) => {
  const isManaged = hospital.managementModel === 'hospital-manager';
  return {
    managementModel: hospital.managementModel,
    note: isManaged
      ? 'Pricing is set at hospital level. All linked doctors use this pricing.'
      : 'Doctor-owner hospital. Each doctor controls their own pricing.',
    consultationPricing: isManaged ? (hospital.consultationPricing || null) : null,
  };
};

/**
 * sanitizeDoctorPricing
 * -----------------------
 * ARCHITECTURE FIX: doctor.fees is only meaningful when the doctor's
 * primaryHospital is 'doctor-owner' (see DoctorProfile.resolveEffectivePricing).
 * Public doctor payloads used to leak doctor.fees unconditionally, which is
 * actively misleading for hospital-managed doctors — their real price lives
 * on Hospital.consultationPricing, not their own profile. This strips fees
 * in that case and tells the client where to look instead.
 * Expects doctor.primaryHospital to be populated with at least `managementModel`.
 */
const sanitizeDoctorPricing = (doctor) => {
  const isHospitalManaged = doctor?.primaryHospital?.managementModel === 'hospital-manager';
  if (isHospitalManaged) {
    delete doctor.fees;
    doctor.pricingNote = 'Priced by the hospital, not this doctor — see the hospital\'s consultationPricing.';
  } else {
    doctor.pricingNote = 'Doctor-owned consultation pricing.';
  }
  return doctor;
};

const DOCTOR_PUBLIC_EXCLUDE =
  '-kyc.aadhaarNumber -kyc.panNumber -adminNotes -bankDetails.accountNumber -contractUrl -platformFee -stats';

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL HELPER: Credentials Email
// ─────────────────────────────────────────────────────────────────────────────

const sendCredentialsEmail = async ({
  recipientEmail,
  recipientName,
  role,
  plainPassword,
  entityName,
  managementModel,
  loginUrl,
}) => {
  const isDoctor   = role === 'doctor';
  const roleLabel  = isDoctor ? 'Doctor' : 'Hospital Manager';
  const themeColor = isDoctor ? '#134e30' : '#0f3460';
  const accentColor= isDoctor ? '#f0a500' : '#e94560';

  const modelNote = (() => {
    if (isDoctor && managementModel === 'doctor-owner') {
      return `You are registered as a <strong>Doctor-Owner</strong>. You will manage your own 
              Clinic / Nursing Home and control your own consultation pricing.`;
    }
    if (isDoctor && managementModel === 'hospital-manager') {
      return `You are a <strong>Hospital-Manager Affiliated Doctor</strong>. 
              Your consultation fees are set by the hospital manager.`;
    }
    if (!isDoctor && managementModel === 'hospital-manager') {
      return `You are registered as a <strong>Hospital Manager</strong> for 
              <strong>${entityName}</strong> (Managed Hospital Type). 
              You control consultation pricing for all linked doctors.`;
    }
    return `You are registered under <strong>${entityName}</strong>.`;
  })();

  const portalPath = isDoctor ? '/doctor/login' : '/hospital/login';
  const frontendBase = process.env.FRONTEND_URL || 'https://likeson.in';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:36px 12px;">
      <table width="620" cellpadding="0" cellspacing="0"
             style="max-width:620px;background:#fff;border-radius:14px;
                    box-shadow:0 8px 30px rgba(0,0,0,.08);overflow:hidden;
                    border:1px solid #e2e8f0;">

        <tr>
          <td style="background:linear-gradient(135deg,${themeColor} 0%,#1a1a2e 100%);
                     padding:36px 32px 28px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:2px;
                        color:${accentColor};text-transform:uppercase;margin-bottom:8px;">
              🏥 Likeson Healthcare
            </div>
            <div style="font-size:22px;font-weight:800;color:#fff;line-height:1.3;">
              Welcome to the Platform,<br/>${recipientName}!
            </div>
            <div style="margin-top:8px;display:inline-block;background:${accentColor};
                        color:#fff;font-size:11px;font-weight:700;padding:3px 10px;
                        border-radius:20px;letter-spacing:.5px;">
              ${roleLabel} Account
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">

            <div style="background:#f8fafc;border-left:4px solid ${accentColor};
                        border-radius:0 8px 8px 0;padding:12px 16px;
                        margin-bottom:24px;font-size:13px;color:#334155;line-height:1.6;">
              ${modelNote}
            </div>

            <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 24px;">
              Your Likeson Healthcare partner account has been created. 
              Use the credentials below to log in and complete your profile setup.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f8fafc;border:1px solid #e2e8f0;
                          border-radius:12px;margin-bottom:24px;">
              <tr>
                <td style="padding:24px;">

                  <div style="margin-bottom:16px;">
                    <div style="font-size:10px;font-weight:700;color:#94a3b8;
                                text-transform:uppercase;letter-spacing:1.2px;margin-bottom:4px;">
                      Login URL
                    </div>
                    <a href="${frontendBase}${portalPath}"
                       style="color:#3b82f6;font-size:13px;text-decoration:none;">
                      ${frontendBase}${portalPath}
                    </a>
                  </div>

                  <div style="margin-bottom:16px;">
                    <div style="font-size:10px;font-weight:700;color:#94a3b8;
                                text-transform:uppercase;letter-spacing:1.2px;margin-bottom:4px;">
                      Email Address
                    </div>
                    <div style="font-size:15px;font-weight:700;color:#1e293b;
                                font-family:'Courier New',monospace;">
                      ${recipientEmail}
                    </div>
                  </div>

                  <div>
                    <div style="font-size:10px;font-weight:700;color:#94a3b8;
                                text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;">
                      Temporary Password
                    </div>
                    <div style="background:#1e293b;border-radius:10px;padding:16px 20px;
                                display:flex;align-items:center;justify-content:space-between;">
                      <span style="font-family:'Courier New',monospace;font-size:24px;
                                   font-weight:700;letter-spacing:6px;color:#fff;">
                        ${plainPassword}
                      </span>
                    </div>
                  </div>
                </td>
              </tr>
            </table>

            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;
                        padding:14px 18px;margin-bottom:28px;">
              <div style="font-size:12px;color:#92400e;line-height:1.6;">
                ⚠️ <strong>Security Notice:</strong> This is a one-time temporary password. 
                Please change it immediately after your first login. 
                Never share your credentials with anyone, including Likeson staff.
              </div>
            </div>

            <div style="margin-bottom:28px;">
              <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:10px;">
                📋 Next Steps After Login
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  '1. Change your temporary password immediately',
                  isDoctor ? '2. Complete your doctor profile and upload your photo' : '2. Complete your hospital profile and upload your logo',
                  isDoctor ? '3. Submit KYC documents (Aadhaar + PAN)' : '3. Submit registration documents for verification',
                  isDoctor ? '4. Set your weekly availability and consultation slots' : '4. Configure operating hours and consultation pricing',
                  '5. Add your bank details for settlement payouts',
                ].map(step => `
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;">
                    ${step}
                  </td>
                </tr>`).join('')}
              </table>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${frontendBase}${portalPath}"
                     style="display:inline-block;background:linear-gradient(135deg,${themeColor},#1a1a2e);
                            color:#fff;padding:14px 44px;border-radius:50px;font-size:14px;
                            font-weight:700;text-decoration:none;letter-spacing:.5px;">
                    🔐 Login to ${roleLabel} Portal
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center"
              style="background:#f8fafc;border-top:1px solid #f1f5f9;padding:18px 32px;">
            <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
              Need help? Email us at
              <a href="mailto:support@likeson.in" style="color:#3b82f6;">support@likeson.in</a>
              &nbsp;·&nbsp;
              <a href="${frontendBase}/terms" style="color:#3b82f6;">Terms</a>
              &nbsp;·&nbsp;
              <a href="${frontendBase}/privacy" style="color:#3b82f6;">Privacy</a>
            </div>
            <div style="font-size:10px;color:#cbd5e1;margin-top:6px;letter-spacing:.5px;">
              © ${new Date().getFullYear()} LIKESON.IN · ADVANCED HEALTHCARE LOGISTICS
            </div>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail({
    email:   recipientEmail,
    subject: `🏥 Likeson Healthcare — Your ${roleLabel} Account Credentials`,
    html,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
//  A. PUBLIC HOSPITAL CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET hospitals sorted by distance from {lat,lng}, with type/specialty/facility filters.
const getNearbyHospitals = asyncHandler(async (req, res) => {
  const lat      = parseFloat(req.query.lat);
  const lng      = parseFloat(req.query.lng);
  const distance = Math.min(100, Math.max(0, parseFloat(req.query.distance) || 100));

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide lat and lng query parameters (e.g., ?lat=16.506&lng=80.648)',
    });
  }

  const { page, limit, skip } = parsePagination(req.query);

  const matchQuery = { isActive: true };
  if (req.query.type)                    matchQuery.hospitalType      = req.query.type;
  if (req.query.specialty)               matchQuery.specialties       = { $in: [req.query.specialty] };
  if (req.query.is24x7 === 'true')       matchQuery.is24x7            = true;
  if (req.query.hasICU  === 'true')      matchQuery.hasICU            = true;
  if (req.query.hasEmergency === 'true') matchQuery.isEmergencyReady = true;
  if (req.query.scheme)                  matchQuery.acceptedSchemes  = { $in: [req.query.scheme] };

  const pipeline = [
    {
      $geoNear: {
        near:          { type: 'Point', coordinates: [lng, lat] },
        distanceField: 'distanceMetres',
        maxDistance:   distance * 1000,
        spherical:     true,
        key:           'location',
        query:         matchQuery,
      },
    },
    {
      $addFields: {
        distance: {
          $concat: [
            { $toString: { $round: [{ $divide: ['$distanceMetres', 1000] }, 1] } },
            ' km',
          ],
        },
      },
    },
    {
      $project: {
        internalNotes:   0,
        createdBy:       0,
        updatedBy:       0,
        settlementCycle: 0,
      },
    },
  ];

  const [results, countResult] = await Promise.all([
    Hospital.aggregate([...pipeline, { $skip: skip }, { $limit: limit }]),
    Hospital.aggregate([...pipeline, { $count: 'total' }]),
  ]);

  await Hospital.populate(results, {
    path:   'linkedDoctors',
    select: 'user specialization rating isVerified',
  });

  const total = countResult[0]?.total ?? 0;

  res.json({
    success:  true,
    count:    results.length,
    total,
    page,
    pages:    Math.ceil(total / limit),
    distance: `${distance} km`,
    data:     results,
  });
});

// GET all verified hospitals, filterable by city/state/type/specialty/rating/etc.
const getAllHospitals = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = { isActive: true };
  if (req.query.verified !== 'false') filter.isVerified = true;
  if (req.query.city)          filter['address.city']  = new RegExp(req.query.city, 'i');
  if (req.query.state)         filter['address.state'] = new RegExp(req.query.state, 'i');
  if (req.query.type)          filter.hospitalType     = req.query.type;
  if (req.query.specialty)     filter.specialties      = { $in: [req.query.specialty] };
  if (req.query.accreditation) filter.accreditations   = { $in: [req.query.accreditation] };
  if (req.query.is24x7 === 'true')       filter.is24x7          = true;
  if (req.query.hasICU === 'true')       filter.hasICU            = true;
  if (req.query.hasBloodBank === 'true') filter.hasBloodBank    = true;
  if (req.query.hasPharmacy === 'true')  filter.hasPharmacy      = true;
  if (req.query.hasAmbulance === 'true') filter.hasAmbulance    = true;
  if (req.query.scheme)        filter.acceptedSchemes  = { $in: [req.query.scheme] };
  if (req.query.rating)        filter['rating.averageRating'] = { $gte: parseFloat(req.query.rating) };
  if (req.query.managementModel) filter.managementModel = req.query.managementModel;

  if (req.query.search) {
    filter.$or = [
      { name:        new RegExp(req.query.search, 'i') },
      { description: new RegExp(req.query.search, 'i') },
      { specialties: new RegExp(req.query.search, 'i') },
    ];
  }

  const sortMap = {
    rating:   { 'rating.averageRating': -1 },
    newest:   { createdAt: -1 },
    name:     { name: 1 },
    beds:     { 'bedCount.total': -1 },
  };
  const sort = sortMap[req.query.sort] || { 'rating.averageRating': -1 };

  const [hospitals, total] = await Promise.all([
    Hospital.find(filter)
      .select('-internalNotes -createdBy -updatedBy -settlementCycle')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Hospital.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count:   hospitals.length,
    total,
    page,
    pages:   Math.ceil(total / limit),
    data:    hospitals,
  });
});

// GET a single hospital by ObjectId, with linked doctors + resolved pricingInfo attached.
const getHospitalById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findOne({ _id: req.params.id, isActive: true })
    .select('-internalNotes -settlementCycle')
    .populate({
      path:   'linkedDoctors',
      select: 'user specialization qualifications experienceYears fees consultationTypes rating isVerified isOnline',
      populate: { path: 'user', select: 'name avatar' },
    })
    .lean();

if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  hospital.pricingInfo = buildHospitalPricingInfo(hospital);
  // Linked doctors' raw `fees` is only meaningful for doctor-owner hospitals —
  // for a hospital-manager hospital, strip it so the client doesn't display
  // stale/irrelevant per-doctor numbers instead of hospital.consultationPricing.
  if (hospital.managementModel === 'hospital-manager') {
    hospital.linkedDoctors = (hospital.linkedDoctors || []).map((d) => {
      delete d.fees;
      return d;
    });
  }
  res.json({ success: true, data: hospital });
});

// GET a single hospital by its SEO-friendly slug — same shape as getHospitalById.
const getHospitalBySlug = asyncHandler(async (req, res) => {
  const hospital = await Hospital.findOne({ slug: req.params.slug, isActive: true })
    .select('-internalNotes -settlementCycle')
    .populate({
      path:   'linkedDoctors',
      select: 'user specialization qualifications experienceYears fees consultationTypes rating isVerified isOnline',
      populate: { path: 'user', select: 'name avatar' },
    })
    .lean();

if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  hospital.pricingInfo = buildHospitalPricingInfo(hospital);
  if (hospital.managementModel === 'hospital-manager') {
    hospital.linkedDoctors = (hospital.linkedDoctors || []).map((d) => {
      delete d.fees;
      return d;
    });
  }
  res.json({ success: true, data: hospital });
});

// GET hospitals matching a free-text query across name/description/specialties/facilities.
const searchHospitals = asyncHandler(async (req, res) => {
  const q = req.query.q?.trim();
  if (!q || q.length < 2) {
    return res.status(400).json({ success: false, message: 'Query must be at least 2 characters' });
  }

  const { page, limit, skip } = parsePagination(req.query);
  const regex  = new RegExp(q, 'i');
  const filter = {
    isActive: true,
    $or: [
      { name:            regex },
      { description:     regex },
      { specialties:     regex },
      { facilities:      regex },
      { hospitalType:    regex },
      { 'address.city':  regex },
    ],
  };
  if (req.query.city) filter['address.city'] = new RegExp(req.query.city, 'i');

  const [hospitals, total] = await Promise.all([
    Hospital.find(filter)
      .select('name slug hospitalType managementModel address contact logo rating specialties isVerified')
      .skip(skip)
      .limit(limit)
      .lean(),
    Hospital.countDocuments(filter),
  ]);

  res.json({
    success: true,
    query:   q,
    count:   hospitals.length,
    total,
    page,
    pages:   Math.ceil(total / limit),
    data:    hospitals,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  B. PUBLIC DOCTOR CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET verified, active doctors near {lat,lng} (via nearby hospitals), pricing sanitized.
const getNearbyDoctors = asyncHandler(async (req, res) => {
  const { filter: geoFilter, distance } = buildGeoFilter(req.query);

  if (!geoFilter) {
    return res.status(400).json({
      success: false,
      message: 'Please provide lat and lng query parameters',
    });
  }

  const { page, limit, skip } = parsePagination(req.query);

  const nearbyHospitals = await Hospital.find({
    ...geoFilter,
    isActive: true,
  }).select('_id').lean();

  const hospitalIds  = nearbyHospitals.map((h) => h._id);
  const doctorFilter = {
    isActive:          true,
    isVerified:        true,
    partnershipStatus: 'Active',
    $or: [
      { primaryHospital: { $in: hospitalIds } },
      { otherHospitals:  { $in: hospitalIds } },
    ],
  };

  if (req.query.specialization)   doctorFilter.specialization = req.query.specialization;
  if (req.query.consultationType) doctorFilter[`consultationTypes.${req.query.consultationType}`] = true;
  if (req.query.rating)           doctorFilter['rating.averageRating'] = { $gte: parseFloat(req.query.rating) };
  if (req.query.language)         doctorFilter.languagesSpoken = { $in: [req.query.language] };

  const [doctors, total] = await Promise.all([
    DoctorProfile.find(doctorFilter)
      .select(DOCTOR_PUBLIC_EXCLUDE)
      .populate('user', 'name avatar email phone')
      .populate('primaryHospital', 'name address location slug managementModel')
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorProfile.countDocuments(doctorFilter),
  ]);

  const sanitized = doctors.map(sanitizeDoctorPricing);

  res.json({
    success:  true,
    count:    sanitized.length,
    total,
    page,
    pages:    Math.ceil(total / limit),
    distance: `${distance} km`,
    data:     sanitized,
  });
});

// GET all verified, active doctors with specialization/rating/hospital/search filters.
const getAllDoctors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);

  const filter = {
    isActive:          true,
    isVerified:        true,
    partnershipStatus: 'Active',
  };

  if (req.query.specialization)   filter.specialization = req.query.specialization;
  if (req.query.language)         filter.languagesSpoken = { $in: [req.query.language] };
  if (req.query.rating)           filter['rating.averageRating'] = { $gte: parseFloat(req.query.rating) };
  if (req.query.consultationType) filter[`consultationTypes.${req.query.consultationType}`] = true;
  if (req.query.hospital) {
    if (!mongoose.isValidObjectId(req.query.hospital)) {
      return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
    }
    filter.$or = [
      { primaryHospital: req.query.hospital },
      { otherHospitals:  req.query.hospital },
    ];
  }
  if (req.query.search) {
    const regex = new RegExp(req.query.search, 'i');
    filter.$or = [{ biography: regex }, { achievements: regex }];
  }

  const sortMap = {
    rating:     { 'rating.averageRating': -1 },
    experience: { experienceYears: -1 },
    newest:     { createdAt: -1 },
  };
  const sort = sortMap[req.query.sort] || { 'rating.averageRating': -1 };

  const [doctors, total] = await Promise.all([
    DoctorProfile.find(filter)
      .select(DOCTOR_PUBLIC_EXCLUDE)
      .populate('user', 'name avatar')
      .populate('primaryHospital', 'name address slug logo managementModel')
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorProfile.countDocuments(filter),
  ]);

  const sanitized = doctors.map(sanitizeDoctorPricing);

  res.json({
    success: true,
    count:   sanitized.length,
    total,
    page,
    pages:   Math.ceil(total / limit),
    data:    sanitized,
  });
});

// GET doctors filtered by a validated specialization enum value, optionally by city.
const getDoctorsBySpecialization = asyncHandler(async (req, res) => {
  const validSpecs = [
    'General Physician', 'Cardiologist', 'Neurologist', 'Pediatrician',
    'Oncologist', 'Orthopedic Surgeon', 'Gastroenterologist', 'Gynecologist',
    'Dermatologist', 'Urologist', 'Psychiatry', 'Physiotherapist',
  ];

  const normalizedSpec = validSpecs.find(
    (s) => s.toLowerCase() === req.params.spec.toLowerCase()
  );

  if (!normalizedSpec) {
    return res.status(400).json({
      success:     false,
      message:     'Invalid specialization',
      validValues: validSpecs,
    });
  }

  const { page, limit, skip } = parsePagination(req.query);

  const filter = {
    specialization:    normalizedSpec,
    isActive:          true,
    isVerified:        true,
    partnershipStatus: 'Active',
  };

  if (req.query.rating)           filter['rating.averageRating'] = { $gte: parseFloat(req.query.rating) };
  if (req.query.consultationType) filter[`consultationTypes.${req.query.consultationType}`] = true;

  let hospitalFilter = {};
  if (req.query.city) {
    const hospitals = await Hospital.find({
      'address.city': new RegExp(req.query.city, 'i'),
      isActive: true,
    }).select('_id').lean();
    const ids = hospitals.map((h) => h._id);
    hospitalFilter = {
      $or: [
        { primaryHospital: { $in: ids } },
        { otherHospitals:  { $in: ids } },
      ],
    };
  }

  const finalFilter = { ...filter, ...hospitalFilter };

  const [doctors, total] = await Promise.all([
    DoctorProfile.find(finalFilter)
      .select(DOCTOR_PUBLIC_EXCLUDE)
      .populate('user', 'name avatar')
      .populate('primaryHospital', 'name address slug logo managementModel')
      .sort({ 'rating.averageRating': -1, experienceYears: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorProfile.countDocuments(finalFilter),
  ]);

  const sanitized = doctors.map(sanitizeDoctorPricing);

  res.json({
    success:        true,
    specialization: normalizedSpec,
    count:          sanitized.length,
    total,
    page,
    pages:          Math.ceil(total / limit),
    data:           sanitized,
  });
});

// GET a single doctor's public profile, including the resolved effective
// pricing (Problem 2 fix, surfaced end-to-end): calls
// DoctorProfile.resolveEffectivePricing() so the client always sees the
// CORRECT price source (doctor vs hospital), never a stale/irrelevant one.
const getDoctorById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findOne({ _id: req.params.id, isActive: true })
    .select(DOCTOR_PUBLIC_EXCLUDE)
    .populate('user', 'name avatar email')
    .populate('primaryHospital', 'name address slug logo contact managementModel')
    .populate('otherHospitals',  'name address slug')
    .lean();

  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  // Best-effort — a doctor with no primaryHospital or misconfigured hospital
  // shouldn't 500 the whole profile page, just omit effectivePricing.
  let effectivePricing = null;
  try {
    effectivePricing = await DoctorProfile.resolveEffectivePricing(doctor._id, 'inPerson');
  } catch (err) {
    effectivePricing = { error: err.message };
  }

  sanitizeDoctorPricing(doctor);
  doctor.effectivePricing = effectivePricing;

  res.json({ success: true, data: doctor });
});

// GET doctors matching a free-text query against the linked User's name or bio/achievements.
const searchDoctors = asyncHandler(async (req, res) => {
  const q = req.query.q?.trim();
  if (!q || q.length < 2) {
    return res.status(400).json({ success: false, message: 'Query must be at least 2 characters' });
  }

  const { page, limit, skip } = parsePagination(req.query);
  const regex = new RegExp(q, 'i');

  const matchingUsers = await User.find({ role: 'doctor', name: regex })
    .select('_id').lean();
  const userIds = matchingUsers.map((u) => u._id);

  const filter = {
    isActive:          true,
    isVerified:        true,
    partnershipStatus: 'Active',
    $or: [
      { user:         { $in: userIds } },
      { biography:    regex },
      { achievements: regex },
    ],
  };
  if (req.query.specialization) filter.specialization = req.query.specialization;

  const [doctors, total] = await Promise.all([
    DoctorProfile.find(filter)
      .select(DOCTOR_PUBLIC_EXCLUDE)
      .populate('user', 'name avatar')
      .populate('primaryHospital', 'name address slug managementModel')
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorProfile.countDocuments(filter),
  ]);

  const sanitized = doctors.map(sanitizeDoctorPricing);

  res.json({
    success: true,
    query:   q,
    count:   sanitized.length,
    total,
    page,
    pages:   Math.ceil(total / limit),
    data:    sanitized,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  C. HOSPITAL ADMIN/MANAGEMENT CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

// POST admin-only: create a hospital + its manager/owner User account in one call,
// derives managementModel from hospitalType, emails temp credentials.
const createHospital = asyncHandler(async (req, res) => {
  const {
    name, hospitalType, description,
    contact, address, registrationDetails,
    specialties, facilities, acceptedSchemes,
    bedCount, accreditations,
    isEmergencyReady, hasICU, hasBloodBank,
    hasPharmacy, hasDiagnostics, hasAmbulance,
    hasWheelchairAccess, is24x7, nabledLabAvailable,
    operatingHours, googleMapsUrl,
    managerName, managerEmail, managerPhone,
  } = req.body;

  if (!name || !hospitalType || !contact?.phone ||
      !address?.line1 || !address?.pincode || !registrationDetails?.licenseNumber) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: name, hospitalType, contact.phone, address.line1, address.pincode, registrationDetails.licenseNumber',
    });
  }

  if (!managerName || !managerEmail) {
    return res.status(400).json({
      success: false,
      message: 'managerName and managerEmail are required to create the manager account',
    });
  }

  const existing = await Hospital.findOne({
    'registrationDetails.licenseNumber': registrationDetails.licenseNumber,
  });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'A hospital with this license number already exists',
    });
  }

  const existingUser = await User.findOne({ email: managerEmail.toLowerCase().trim() });
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: 'A user with this email already exists',
    });
  }

  const { MANAGED_HOSPITAL_TYPES } = await import('../models/Hospital.js');
  const managementModel = MANAGED_HOSPITAL_TYPES.includes(hospitalType)
    ? 'hospital-manager'
    : 'doctor-owner';
  const managerRole = managementModel === 'hospital-manager' ? 'hospital' : 'doctor';

  const generatePassword = () => {
    const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower   = 'abcdefghjkmnpqrstuvwxyz';
    const digits  = '23456789';
    const special = '@#$!%*?&';
    const all     = upper + lower + digits + special;
    const mandatory =
      upper[Math.floor(Math.random() * upper.length)] +
      lower[Math.floor(Math.random() * lower.length)] +
      digits[Math.floor(Math.random() * digits.length)] +
      special[Math.floor(Math.random() * special.length)];
    const remaining = Array.from({ length: 8 }, () =>
      all[Math.floor(Math.random() * all.length)]
    ).join('');
    return (mandatory + remaining).split('').sort(() => Math.random() - 0.5).join('');
  };

  const plainPassword  = generatePassword();
  const bcrypt         = await import('bcryptjs');
  const hashedPassword = await bcrypt.default.hash(plainPassword, 12);

  const managerUser = await User.create({
    name:      managerName.trim(),
    email:     managerEmail.toLowerCase().trim(),
    phone:     managerPhone || undefined,
    password:  hashedPassword,
    role:      managerRole,
    createdBy: req.user._id,
  });

  const hospital = await Hospital.create({
    name, hospitalType, description,
    contact, address, registrationDetails,
    specialties, facilities, acceptedSchemes,
    bedCount, accreditations,
    isEmergencyReady, hasICU, hasBloodBank,
    hasPharmacy, hasDiagnostics, hasAmbulance,
    hasWheelchairAccess, is24x7, nabledLabAvailable,
    operatingHours, googleMapsUrl,
    managedBy:  managerUser._id,
    createdBy:  req.user._id,
  });

  let doctorProfile = null;
  if (managerRole === 'doctor') {
    doctorProfile = await DoctorProfile.create({
      user:            managerUser._id,
      specialization:  req.body.specialization || 'General Physician',
      experienceYears: req.body.experienceYears || 0,
      primaryHospital: hospital._id,
      createdBy:       req.user._id,
    });
    await Hospital.findByIdAndUpdate(hospital._id, {
      $addToSet: { linkedDoctors: doctorProfile._id },
    });
  }

  try {
    await sendCredentialsEmail({
      recipientEmail:  managerUser.email,
      recipientName:   managerUser.name,
      role:            managerRole,
      plainPassword,
      entityName:      hospital.name,
      managementModel,
      loginUrl:        process.env.FRONTEND_URL || 'https://likeson.in',
    });
  } catch (emailErr) {
    console.error('[createHospital] Credentials email failed:', emailErr.message);
  }

  await SystemLog.createLog({
    level:    'success',
    category: 'system',
    message:  `Hospital created: ${hospital.name} (${managementModel}) | Manager: ${managerUser.email}`,
    actor: {
      userId: req.user._id,
      name:   req.user.name,
      role:   req.user.role,
    },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
    request: { method: 'POST', path: '/api/hospitals', statusCode: 201 },
    metadata: {
      hospitalType:    hospital.hospitalType,
      managementModel,
      licenseNumber:   registrationDetails.licenseNumber,
      managerUserId:   managerUser._id,
      managerRole,
    },
  });

  await invalidatePattern('hospitals:*');

  res.status(201).json({
    success: true,
    message: `Hospital created. Login credentials sent to ${managerUser.email}.`,
    data: {
      hospital: {
        _id:             hospital._id,
        name:            hospital.name,
        hospitalType:    hospital.hospitalType,
        managementModel: hospital.managementModel,
        slug:            hospital.slug,
      },
      manager: {
        _id:   managerUser._id,
        name:  managerUser.name,
        email: managerUser.email,
        role:  managerUser.role,
      },
      ...(doctorProfile ? { doctorProfile: { _id: doctorProfile._id } } : {}),
    },
  });
});

// PUT admin-only: update a hospital's descriptive/profile fields (not pricing, not security).
const updateHospitalProfile = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  const allowedFields = [
    'name', 'description', 'hospitalType',
    'contact', 'address', 'googleMapsUrl',
    'specialties', 'facilities', 'acceptedSchemes',
    'accreditations', 'nabledLabAvailable',
    'bedCount', 'operatingHours',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) hospital[field] = req.body[field];
  });

  if (req.body.logo !== undefined) {
    if (req.body.logo === null || req.body.logo === '') {
      hospital.logo = undefined;
    } else if (typeof req.body.logo === 'string') {
      hospital.logo = req.body.logo;
    }
  }

  if (req.body.images !== undefined) {
    if (!req.body.images || (Array.isArray(req.body.images) && req.body.images.length === 0)) {
      hospital.images = [];
    } else if (Array.isArray(req.body.images)) {
      const validUrls = req.body.images.filter(
        (item) => typeof item === 'string' && item.trim().length > 0
      );
      if (validUrls.length > 20) {
        return res.status(400).json({ success: false, message: 'Maximum 20 gallery images allowed' });
      }
      hospital.images = validUrls;
    }
  }

  hospital.updatedBy = req.user._id;
  await hospital.save();

  await SystemLog.createLog({
    level:    'info',
    category: 'system',
    message:  `Hospital profile updated: ${hospital.name}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
    request:  { method: 'PUT', path: `/api/hospitals/${req.params.id}/profile`, statusCode: 200 },
  });

  await invalidatePattern(`hospitals:${req.params.id}*`);

  res.json({ success: true, message: 'Hospital profile updated', data: hospital });
});

// PUT admin-only: toggle facility flags, bed count, operating hours, accepted schemes.
const updateHospitalSettings = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  const settingsFields = [
    'isEmergencyReady', 'hasICU', 'hasBloodBank',
    'hasPharmacy', 'hasDiagnostics', 'hasAmbulance',
    'hasWheelchairAccess', 'is24x7', 'nabledLabAvailable',
    'bedCount', 'operatingHours', 'acceptedSchemes',
  ];

  settingsFields.forEach((field) => {
    if (req.body[field] !== undefined) hospital[field] = req.body[field];
  });

  hospital.updatedBy = req.user._id;
  await hospital.save();

  await invalidatePattern(`hospitals:${req.params.id}*`);

  res.json({
    success: true,
    message: 'Hospital settings updated',
    data: {
      isEmergencyReady:    hospital.isEmergencyReady,
      hasICU:              hospital.hasICU,
      hasBloodBank:        hospital.hasBloodBank,
      hasPharmacy:         hospital.hasPharmacy,
      hasDiagnostics:      hospital.hasDiagnostics,
      hasAmbulance:        hospital.hasAmbulance,
      hasWheelchairAccess: hospital.hasWheelchairAccess,
      is24x7:              hospital.is24x7,
      nabledLabAvailable:  hospital.nabledLabAvailable,
      bedCount:            hospital.bedCount,
      operatingHours:      hospital.operatingHours,
      acceptedSchemes:     hospital.acceptedSchemes,
    },
  });
});

// PUT admin-only: update license/GST/PAN registration fields, enforcing license-number uniqueness.
const updateHospitalSecurity = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  const { licenseNumber, gstNumber, panNumber, documentUrl, licenseExpiry } = req.body;

  if (licenseNumber) {
    const duplicate = await Hospital.findOne({
      'registrationDetails.licenseNumber': licenseNumber,
      _id: { $ne: req.params.id },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Another hospital already uses this license number',
      });
    }
    hospital.registrationDetails.licenseNumber = licenseNumber;
  }

  if (gstNumber     !== undefined) hospital.registrationDetails.gstNumber    = gstNumber;
  if (panNumber     !== undefined) hospital.registrationDetails.panNumber    = panNumber;
  if (documentUrl   !== undefined) hospital.registrationDetails.documentUrl  = documentUrl;
  if (licenseExpiry !== undefined) hospital.registrationDetails.licenseExpiry = new Date(licenseExpiry);

  hospital.updatedBy = req.user._id;
  await hospital.save();

  await SystemLog.createLog({
    level:    'warning',
    category: 'security',
    message:  `Hospital registration details updated: ${hospital.name}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
    request:  { method: 'PUT', path: `/api/hospitals/${req.params.id}/security`, statusCode: 200 },
  });

  res.json({
    success: true,
    message: 'Hospital security/registration details updated',
    data:    hospital.registrationDetails,
  });
});

// PUT hospital-manager (own hospital) or admin: update hospital-wide consultation pricing.
// Rejects with 400 for doctor-owner hospitals — those price at the DoctorProfile level
// instead (Problem 2's core distinction, enforced here at the write path too, not just reads).
const updateHospitalConsultationPricing = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  if (hospital.managementModel !== 'hospital-manager') {
    return res.status(400).json({
      success: false,
      message: 'Consultation pricing at hospital level is only for hospital-manager type hospitals. '
             + 'Doctor-owner hospitals set pricing at the doctor profile level.',
    });
  }

  if (req.user.role === 'hospital') {
    const isOwner = hospital.managedBy?.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
  }

  const cp = req.body.consultationPricing || req.body;

  const allowedByHospitalManager = [
    'inPersonFee', 'videoFee', 'homeVisitFee',
    'inPersonHonorarium', 'videoHonorarium', 'homeVisitHonorarium',
    'followUpFee', 'followUpDiscountPercent', 'followUpValidDays',
    'consultationTypes',
  ];

  if (!hospital.consultationPricing) {
    hospital.consultationPricing = {};
  }

  allowedByHospitalManager.forEach((field) => {
    if (cp[field] !== undefined) {
      hospital.consultationPricing[field] = cp[field];
    }
  });

  // Version bump on every write, mirroring the hospital-manager router's
  // /pricing endpoint — bookings always know which pricing version priced them.
  const prevVersion = hospital.consultationPricing.pricingVersion || 1;
  hospital.consultationPricing.pricingVersion   = prevVersion + 1;
  hospital.consultationPricing.lastUpdatedBy    = req.user._id;
  hospital.consultationPricing.lastUpdatedByRole = req.user.role;
  hospital.updatedBy = req.user._id;
  await hospital.save();

  await invalidatePattern(`hospitals:${req.params.id}*`);

  res.json({
    success: true,
    message: 'Consultation pricing updated',
    data:    hospital.consultationPricing,
  });
});

// PUT admin-only: set/clear this hospital's platform-fee override inside the
// GLOBAL PlatformPricingConfig.hospital.hospitalOverrides map. This is distinct
// from Hospital.consultationPricing.platformFeeOverride (which the hospital
// itself can theoretically hold) — this route is the admin-controlled layer,
// second in the priority chain. Sending platformFee: null removes the entry
// and the hospital falls back to config.hospital.platformFee (global default).
const updateHospitalPlatformFeeOverride = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id).select('name').lean();
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  const { default: PlatformPricingConfig } = await import('../models/PlatformPricingConfig.js');
  const config = await PlatformPricingConfig.getGlobal();

  if (!config.hospital.hospitalOverrides) config.hospital.hospitalOverrides = new Map();

  if (req.body.platformFee === null) {
    config.hospital.hospitalOverrides.delete(req.params.id);
  } else {
    const { type, value } = req.body.platformFee || {};
    if (!['fixed', 'percentage'].includes(type)) {
      return res.status(400).json({ success: false, message: "platformFee.type must be 'fixed' or 'percentage'" });
    }
    if (typeof value !== 'number' || value < 0) {
      return res.status(400).json({ success: false, message: 'platformFee.value must be a non-negative number' });
    }
    if (type === 'percentage' && value > 100) {
      return res.status(400).json({ success: false, message: 'platformFee.value cannot exceed 100 for percentage' });
    }
    config.hospital.hospitalOverrides.set(req.params.id, { type, value });
  }

  await config.saveWithAudit({
    adminUserId:  req.user._id,
    adminRole:    req.user.role,
    section:      'hospital.hospitalOverrides',
    note:         req.body.platformFee === null
      ? `Cleared platform-fee override for hospital ${hospital.name}`
      : `Set platform-fee override for hospital ${hospital.name}: ${req.body.platformFee.type} = ${req.body.platformFee.value}`,
    changeSource: 'manual',
  });

  await SystemLog.createLog({
    level:    'warning',
    category: 'payment',
    message:  `Hospital platform-fee override ${req.body.platformFee === null ? 'cleared' : 'set'}: ${hospital.name}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
    request:  { method: 'PUT', path: `/api/hospitals/${req.params.id}/platform-fee`, statusCode: 200 },
    metadata: { platformFee: req.body.platformFee },
  });

  await invalidatePattern(`hospitals:${req.params.id}*`);
  await invalidatePattern('hospitals:*');

  res.json({
    success: true,
    message: req.body.platformFee === null
      ? 'Platform fee override cleared — hospital now uses global default (or its own consultationPricing override if set).'
      : `Platform fee override set: ${req.body.platformFee.type} = ${req.body.platformFee.value}`,
    data: {
      hospitalId:  hospital._id,
      platformFee: req.body.platformFee,
    },
  });
});

// POST admin-only: reset the hospital manager's password and re-email credentials.
const resendHospitalManagerCredentials = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id).lean();
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  const manager = await User.findById(hospital.managedBy).select('+password').lean();
  if (!manager) {
    return res.status(404).json({ success: false, message: 'Hospital manager account not found' });
  }

  const plainPassword  = Math.random().toString(36).slice(-8).toUpperCase() + 'Hx@1';
  const bcrypt         = await import('bcryptjs');
  const hashedPassword = await bcrypt.default.hash(plainPassword, 12);

  await User.findByIdAndUpdate(manager._id, {
    password:          hashedPassword,
    passwordChangedAt: new Date(),
  });

  try {
    await sendCredentialsEmail({
      recipientEmail:  manager.email,
      recipientName:   manager.name,
      role:            manager.role,
      plainPassword,
      entityName:      hospital.name,
      managementModel: hospital.managementModel,
      loginUrl:        process.env.FRONTEND_URL || 'https://likeson.in',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Password reset but email delivery failed',
      error:   err.message,
    });
  }

  await SystemLog.createLog({
    level:    'warning',
    category: 'security',
    message:  `Credentials resent for hospital manager: ${manager.email} (${hospital.name})`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
    request:  { method: 'POST', path: `/api/hospitals/${req.params.id}/resend-credentials`, statusCode: 200 },
  });

  res.json({
    success: true,
    message: `New credentials sent to ${manager.email}`,
  });
});

// POST admin-only: upload/replace hospital logo and/or add gallery images.
const uploadHospitalImages = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  const logoFiles  = req.files?.logo   || [];
  const imageFiles = req.files?.images || [];

  if (logoFiles.length === 0 && imageFiles.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded. Send `logo` and/or `images` as multipart/form-data fields.',
    });
  }

  const folder   = `Likeson/hospitals/${req.params.id}`;
  const uploaded = {};

  if (logoFiles.length > 0) {
    const result  = await uploadToImageKit(logoFiles[0], `logo_${Date.now()}`, folder);
    hospital.logo = result.url;
    uploaded.logo = result.url;
  }

  if (imageFiles.length > 0) {
    if (hospital.images.length + imageFiles.length > 20) {
      return res.status(400).json({
        success: false,
        message: `Maximum 20 gallery images. Current: ${hospital.images.length}, trying to add: ${imageFiles.length}.`,
      });
    }
    const results = await Promise.all(
      imageFiles.map((f) =>
        uploadToImageKit(f, `img_${Date.now()}_${Math.random().toString(36).slice(2)}`, folder)
      )
    );
    const urls = results.map((r) => r.url);
    hospital.images.push(...urls);
    uploaded.images = urls;
  }

  hospital.updatedBy = req.user._id;
  await hospital.save();

  await invalidatePattern(`hospitals:${req.params.id}*`);

  res.json({
    success:  true,
    message:  'Images uploaded successfully',
    uploaded,
    data:     { logo: hospital.logo, images: hospital.images },
  });
});

// DELETE admin-only: remove one gallery image by its array index.
const deleteHospitalImage = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  const idx = parseInt(req.params.imageIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= hospital.images.length) {
    return res.status(400).json({ success: false, message: 'Invalid image index' });
  }

  hospital.images.splice(idx, 1);
  hospital.updatedBy = req.user._id;
  await hospital.save();

  await invalidatePattern(`hospitals:${req.params.id}*`);

  res.json({ success: true, message: 'Image removed', images: hospital.images });
});

// PUT admin-only: set/replace the hospital's map coordinates.
const updateHospitalLocation = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  let lng, lat;
  if (req.body.lat !== undefined && req.body.lng !== undefined) {
    lat = parseFloat(req.body.lat);
    lng = parseFloat(req.body.lng);
  } else if (Array.isArray(req.body.coordinates) && req.body.coordinates.length === 2) {
    [lng, lat] = req.body.coordinates;
  } else {
    return res.status(400).json({
      success: false,
      message: 'Provide { lat, lng } or { coordinates: [lng, lat] }',
    });
  }

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ success: false, message: 'Invalid coordinates' });
  }

  hospital.location = { type: 'Point', coordinates: [lng, lat] };
  if (req.body.googleMapsUrl) hospital.googleMapsUrl = req.body.googleMapsUrl;
  hospital.updatedBy = req.user._id;
  await hospital.save();

  await invalidatePattern(`hospitals:${req.params.id}*`);

  res.json({ success: true, message: 'Hospital location updated', location: hospital.location });
});

// POST admin-only: link an existing doctor to an existing hospital (sets primaryHospital
// if the doctor has none, otherwise adds to otherHospitals).
const linkDoctorToHospital = asyncHandler(async (req, res) => {
  const { id: hospitalId, doctorId } = req.params;

  if (!mongoose.isValidObjectId(hospitalId) || !mongoose.isValidObjectId(doctorId)) {
    return res.status(400).json({ success: false, message: 'Invalid ID(s)' });
  }

  const [hospital, doctor] = await Promise.all([
    Hospital.findById(hospitalId),
    DoctorProfile.findById(doctorId),
  ]);

  if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
  if (!doctor)   return res.status(404).json({ success: false, message: 'Doctor not found' });

  if (hospital.linkedDoctors.includes(doctorId)) {
    return res.status(409).json({ success: false, message: 'Doctor already linked to this hospital' });
  }

  hospital.linkedDoctors.push(doctorId);
  hospital.updatedBy = req.user._id;

  if (!doctor.primaryHospital) {
    doctor.primaryHospital = hospitalId;
  } else if (!doctor.otherHospitals.includes(hospitalId)) {
    doctor.otherHospitals.push(hospitalId);
  }

  await Promise.all([hospital.save(), doctor.save()]);

  await SystemLog.createLog({
    level:    'info',
    category: 'user',
    message:  `Doctor linked to hospital: ${hospital.name}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
    metadata: { doctorId },
  });

  await invalidatePattern(`hospitals:${hospitalId}*`);

  res.json({
    success: true,
    message: 'Doctor linked to hospital',
    data:    { linkedDoctors: hospital.linkedDoctors },
  });
});

// DELETE admin-only: unlink a doctor from a hospital, reassigning primaryHospital if needed.
const unlinkDoctorFromHospital = asyncHandler(async (req, res) => {
  const { id: hospitalId, doctorId } = req.params;

  if (!mongoose.isValidObjectId(hospitalId) || !mongoose.isValidObjectId(doctorId)) {
    return res.status(400).json({ success: false, message: 'Invalid ID(s)' });
  }

  const [hospital, doctor] = await Promise.all([
    Hospital.findById(hospitalId),
    DoctorProfile.findById(doctorId),
  ]);

  if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
  if (!doctor)   return res.status(404).json({ success: false, message: 'Doctor not found' });

  hospital.linkedDoctors = hospital.linkedDoctors.filter(
    (id) => id.toString() !== doctorId
  );
  hospital.updatedBy = req.user._id;

  if (doctor.primaryHospital?.toString() === hospitalId) {
    doctor.primaryHospital = doctor.otherHospitals[0] || null;
    doctor.otherHospitals  = doctor.otherHospitals.slice(1);
  } else {
    doctor.otherHospitals = doctor.otherHospitals.filter(
      (id) => id.toString() !== hospitalId
    );
  }

  await Promise.all([hospital.save(), doctor.save()]);
  await invalidatePattern(`hospitals:${hospitalId}*`);

  res.json({
    success: true,
    message: 'Doctor unlinked from hospital',
    data:    { linkedDoctors: hospital.linkedDoctors },
  });
});

// PUT admin-only: mark a hospital verified/unverified.
const verifyHospital = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  hospital.isVerified = req.body.isVerified !== false;
  hospital.verifiedAt = hospital.isVerified ? new Date() : undefined;
  hospital.verifiedBy = hospital.isVerified ? req.user._id : undefined;
  hospital.updatedBy  = req.user._id;
  await hospital.save();

  await SystemLog.createLog({
    level:    hospital.isVerified ? 'success' : 'warning',
    category: 'kyc',
    message:  `Hospital ${hospital.isVerified ? 'verified' : 'unverified'}: ${hospital.name}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
    request:  { method: 'PUT', path: `/api/hospitals/${req.params.id}/verify`, statusCode: 200 },
  });

  await invalidatePattern('hospitals:*');

  res.json({
    success:    true,
    message:    `Hospital ${hospital.isVerified ? 'verified' : 'unverified'} successfully`,
    isVerified: hospital.isVerified,
    verifiedAt: hospital.verifiedAt,
  });
});

// PUT admin-only: flip isActive (soft enable/disable, does not delete data).
const toggleHospitalActive = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  hospital.isActive  = !hospital.isActive;
  hospital.updatedBy = req.user._id;
  await hospital.save();

  await SystemLog.createLog({
    level:    hospital.isActive ? 'success' : 'warning',
    category: 'system',
    message:  `Hospital ${hospital.isActive ? 'activated' : 'deactivated'}: ${hospital.name}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
  });

  await invalidatePattern('hospitals:*');

  res.json({
    success:  true,
    message:  `Hospital ${hospital.isActive ? 'activated' : 'deactivated'}`,
    isActive: hospital.isActive,
  });
});

// DELETE superadmin-only: hard-delete a hospital and detach any linked doctors.
const deleteHospital = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id);
  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  if (hospital.linkedDoctors?.length) {
    await DoctorProfile.updateMany(
      { _id: { $in: hospital.linkedDoctors } },
      {
        $unset: { primaryHospital: '' },
        $pull:  { otherHospitals: hospital._id },
      }
    );
  }

  await SystemLog.createLog({
    level:    'error',
    category: 'system',
    message:  `Hospital permanently deleted: ${hospital.name}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'Hospital', entityId: hospital._id, label: hospital.name },
    metadata: { linkedDoctorsCount: hospital.linkedDoctors?.length || 0 },
  });

  await hospital.deleteOne();
  await invalidatePattern('hospitals:*');

  res.json({ success: true, message: 'Hospital deleted permanently' });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  D. DOCTOR SELF-SERVICE CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

// GET the logged-in doctor's own full profile (includes hospital consultationPricing
// for hospital-managed doctors, so the doctor can see what they're actually paid at).
const getMyDoctorProfile = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findOne({ user: req.user._id })
    .populate('user', 'name avatar email phone')
    .populate('primaryHospital', 'name address slug logo consultationPricing managementModel')
    .populate('otherHospitals',  'name address slug')
    .populate({
      path: 'ownedHospitals',
      select: 'name address slug isVerified'
    });

  if (!profile) {
    return res.status(404).json({
      success: false,
      message: 'Doctor profile not found. Please complete onboarding.',
    });
  }

  res.json({ success: true, data: profile });
});

// GET the caller's managed/owned/linked hospitals — branches on role (hospital manager vs doctor).
export const getMyManagedHospitals = asyncHandler(async (req, res) => {
  // ── 1. Handle Hospital Manager Role ─────────────────────────────────────────
  if (req.user.role === 'hospital') {
const managedHospitals = await Hospital.find({ managedBy: req.user._id })
      .select('name address slug logo isVerified isActive bedCount rating managementModel consultationPricing')
      .lean();

    return res.json({
      success: true,
      data: {
        primaryHospital: managedHospitals[0] || null, // Treat their first managed hospital as primary for UI compatibility
        otherHospitals: [],
        managedHospitals: managedHospitals,
        ownedHospitals: [],
        setupStatus: {
          isPrimarySet: managedHospitals.length > 0,
          hasLinkedHospitals: managedHospitals.length > 0,
          needsAction: managedHospitals.length === 0
        }
      },
    });
  }

const profile = await DoctorProfile.findOne({ user: req.user._id })
    .select('managedHospitals primaryHospital otherHospitals ownedHospitals')
    .populate('managedHospitals', 'name address slug logo isVerified isActive bedCount rating managementModel consultationPricing')
    .populate('primaryHospital',  'name address slug logo isVerified isActive managementModel consultationPricing')
    .populate('otherHospitals',   'name address slug logo isVerified isActive managementModel')
    .populate('ownedHospitals',   'name address slug logo isVerified isActive managementModel');
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Doctor profile not found' });
  }

  const hasPrimary = !!profile.primaryHospital;
  const hospitalsFound = 
    (profile.managedHospitals?.length > 0) || 
    (profile.ownedHospitals?.length > 0);

  res.json({
    success: true,
    data: {
      primaryHospital:  profile.primaryHospital,
      otherHospitals:   profile.otherHospitals,
      managedHospitals: profile.managedHospitals,
      ownedHospitals:   profile.ownedHospitals || [], 
      setupStatus: {
        isPrimarySet: hasPrimary,
        hasLinkedHospitals: hospitalsFound,
        needsAction: !hasPrimary
      }
    },
  });
});

// GET a doctor's live-computed stats (bookings/earnings/OP records/consultations),
// self-access or admin-access only.
const getDoctorStats = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id)
    .select('user stats rating profileCompletionPercent partnershipStatus kycStatus')
    .lean();

  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const doctorId = doctor._id;

  // Group-by-status counts + revenue + OP/follow-up + recent activity —
  // computed live so stats never drift from what DoctorProfile.stats cache holds.
  const [
    bookingStatusRows,
    revenueRows,
    opStatusRows,
    followUpEligibleCount,
    consultationStatusRows,
    recentBookings,
    recentConsultations,
  ] = await Promise.all([
    Booking.aggregate([
      { $match: { doctor: doctorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.aggregate([
      { $match: { doctor: doctorId, status: 'completed' } },
      {
        $group: {
          _id:            null,
          completedCount: { $sum: 1 },
          doctorShare:    { $sum: '$fareBreakdown.doctorShare' },
          amountPaid:     { $sum: '$fareBreakdown.amountPaid' },
        },
      },
    ]),
    OutPatientRecord.aggregate([
      { $match: { doctor: doctorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    OutPatientRecord.countDocuments({
      doctor: doctorId,
      followUpExpiry: { $gt: new Date() },
    }),
    Consultation.aggregate([
      { $match: { doctor: doctorId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Booking.find({ doctor: doctorId })
      .select('bookingCode bookingType status scheduledAt patientInfo.name fareBreakdown.totalAmount paymentStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Consultation.find({ doctor: doctorId })
      .select('consultationCode consultationType status scheduledAt patientSnapshot.name sessionMetrics createdAt')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const toCountMap = (rows) =>
    rows.reduce((acc, r) => {
      acc[r._id ?? 'unknown'] = r.count;
      return acc;
    }, {});

  const bookingCounts      = toCountMap(bookingStatusRows);
  const opCounts           = toCountMap(opStatusRows);
  const consultationCounts = toCountMap(consultationStatusRows);
  const revenue = revenueRows[0] || { completedCount: 0, doctorShare: 0, amountPaid: 0 };

  res.json({
    success: true,
    data: {
      profile: doctor,
      liveStats: {
        bookings: {
          total:    Object.values(bookingCounts).reduce((a, b) => a + b, 0),
          byStatus: bookingCounts,
        },
        earnings: {
          completedBookings: revenue.completedCount,
          totalDoctorShare:  revenue.doctorShare,
          totalCollected:    revenue.amountPaid,
        },
        outPatientRecords: {
          total:               Object.values(opCounts).reduce((a, b) => a + b, 0),
          byStatus:            opCounts,
          followUpEligibleNow: followUpEligibleCount,
        },
        consultations: {
          total:    Object.values(consultationCounts).reduce((a, b) => a + b, 0),
          byStatus: consultationCounts,
        },
      },
      recentActivity: {
        recentBookings,
        recentConsultations,
      },
    },
  });
});

// GET the logged-in doctor's own resolved effective pricing — thin wrapper around
// the model's resolveEffectivePricing static, which now correctly checks
// Hospital.managementModel (Problem 2 fix) instead of always returning doctor.fees.
const getMyEffectivePricing = asyncHandler(async (req, res) => {
  const profile = await DoctorProfile.findOne({ user: req.user._id }).lean();
  if (!profile) {
    return res.status(404).json({ success: false, message: 'Doctor profile not found' });
  }

  const consultationType = ['inPerson', 'video', 'homeVisit'].includes(req.query.consultationType)
    ? req.query.consultationType
    : 'inPerson';

  const pricing = await DoctorProfile.resolveEffectivePricing(profile._id, consultationType);
  res.json({ success: true, data: pricing });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  E. DOCTOR ADMIN CONTROLLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * assertFeesAllowed
 * -------------------
 * ARCHITECTURE FIX: a doctor's `fees` field is only writable when their
 * primaryHospital is 'doctor-owner'. If it's 'hospital-manager', writing
 * fees here would recreate exactly the bug that was fixed in
 * DoctorProfile.resolveEffectivePricing — data getting written to a
 * pricing source the resolver will then correctly ignore, silently
 * confusing whoever set it. We reject the write instead of silently
 * accepting-and-ignoring it.
 */
const assertFeesAllowed = async (primaryHospitalId) => {
  if (!primaryHospitalId) return; // no hospital yet — allow, resolver requires one before pricing is used anyway
  const hosp = await Hospital.findById(primaryHospitalId).select('managementModel name').lean();
  if (hosp?.managementModel === 'hospital-manager') {
    const err = new Error(
      `Cannot set doctor-level fees: "${hosp.name}" is a hospital-managed hospital — ` +
      `pricing is controlled centrally via that hospital's consultationPricing.`
    );
    err.statusCode = 400;
    throw err;
  }
};

// POST admin/hospital-manager: create a new doctor User + DoctorProfile, emails temp credentials.
// `fees` in the body is only applied when the target hospital is doctor-owner.
const createDoctorProfile = asyncHandler(async (req, res) => {
  const {
    name, email, phone,
    specialization, experienceYears,
    qualifications, registrationNumber, registrationCouncil,
    biography, languagesSpoken, fees, consultationTypes,
    primaryHospital,
  } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'name and email are required to create a doctor account',
    });
  }
  if (!specialization || experienceYears === undefined) {
    return res.status(400).json({
      success: false,
      message: 'specialization and experienceYears are required',
    });
  }

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    return res.status(409).json({ success: false, message: 'A user with this email already exists' });
  }

  let managementModel = 'doctor-owner';
  let hospitalName    = 'Likeson.in';
  if (primaryHospital && mongoose.isValidObjectId(primaryHospital)) {
    const hosp = await Hospital.findById(primaryHospital).select('managementModel name').lean();
    if (hosp) {
      managementModel = hosp.managementModel;
      hospitalName    = hosp.name;
    }
  }

  // Only apply custom fees when the doctor actually owns pricing.
  if (fees !== undefined && managementModel === 'hospital-manager') {
    return res.status(400).json({
      success: false,
      message: `Cannot set fees: "${hospitalName}" is hospital-managed. Configure pricing via that hospital's consultationPricing instead.`,
    });
  }

  const generatePassword = () => {
    const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower   = 'abcdefghjkmnpqrstuvwxyz';
    const digits  = '23456789';
    const special = '@#$!%*?&';
    const all     = upper + lower + digits + special;
    const mandatory =
      upper[Math.floor(Math.random() * upper.length)] +
      lower[Math.floor(Math.random() * lower.length)] +
      digits[Math.floor(Math.random() * digits.length)] +
      special[Math.floor(Math.random() * special.length)];
    const remaining = Array.from({ length: 8 }, () =>
      all[Math.floor(Math.random() * all.length)]
    ).join('');
    return (mandatory + remaining).split('').sort(() => Math.random() - 0.5).join('');
  };

  const plainPassword  = generatePassword();
  const bcrypt         = await import('bcryptjs');
  const hashedPassword = await bcrypt.default.hash(plainPassword, 12);

  const newUser = await User.create({
    name:      name.trim(),
    email:     email.toLowerCase().trim(),
    phone:     phone || undefined,
    password:  hashedPassword,
    role:      'doctor',
    createdBy: req.user._id,
  });

  const profile = await DoctorProfile.create({
    user:                newUser._id,
    specialization,
    experienceYears,
    qualifications:      qualifications      || [],
    registrationNumber:  registrationNumber  || undefined,
    registrationCouncil: registrationCouncil || undefined,
    biography:           biography           || undefined,
    languagesSpoken:     languagesSpoken     || [],
    fees:                managementModel === 'doctor-owner' ? (fees || {}) : undefined,
    consultationTypes:   consultationTypes   || { inPerson: true, video: false, homeVisit: false },
    primaryHospital:     primaryHospital     || null,
    createdBy:           req.user._id,
  });

  if (primaryHospital && mongoose.isValidObjectId(primaryHospital)) {
    await Hospital.findByIdAndUpdate(
      primaryHospital,
      { $addToSet: { linkedDoctors: profile._id } }
    );
  }

  try {
    await sendCredentialsEmail({
      recipientEmail:  newUser.email,
      recipientName:   newUser.name,
      role:            'doctor',
      plainPassword,
      entityName:      hospitalName,
      managementModel,
      loginUrl:        process.env.FRONTEND_URL || 'https://likeson.in',
    });
  } catch (emailError) {
    console.error('[createDoctorProfile] Credentials email failed:', emailError.message);
  }

  await SystemLog.createLog({
    level:    'success',
    category: 'user',
    message:  `Doctor account created: ${newUser.email} (${managementModel})`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: profile._id, label: newUser.email },
    request:  { method: 'POST', path: '/api/hospitals/doctors', statusCode: 201 },
    metadata: { specialization, primaryHospital, managementModel },
  });

  res.status(201).json({
    success: true,
    message: `Doctor account created. Credentials sent to ${newUser.email}.`,
    data: {
      user: {
        _id:   newUser._id,
        name:  newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role:  newUser.role,
      },
      profile: {
        _id:                profile._id,
        specialization:     profile.specialization,
        experienceYears:    profile.experienceYears,
        partnershipStatus:  profile.partnershipStatus,
        kycStatus:          profile.kycStatus,
        primaryHospital:    profile.primaryHospital,
        managementModel,
      },
    },
  });
});

// POST admin-only: reset a doctor's password and re-email credentials.
const resendDoctorCredentials = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const profile = await DoctorProfile.findById(req.params.id)
    .populate('user', 'name email role')
    .populate('primaryHospital', 'name managementModel')
    .lean();

  if (!profile) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  const plainPassword  = Math.random().toString(36).slice(-8).toUpperCase() + 'Dr@1';
  const bcrypt         = await import('bcryptjs');
  const hashedPassword = await bcrypt.default.hash(plainPassword, 12);

  await User.findByIdAndUpdate(profile.user._id, {
    password:          hashedPassword,
    passwordChangedAt: new Date(),
  });

  const managementModel = profile.primaryHospital?.managementModel || 'doctor-owner';
  const entityName      = profile.primaryHospital?.name             || 'Likeson.in';

  try {
    await sendCredentialsEmail({
      recipientEmail:  profile.user.email,
      recipientName:   profile.user.name,
      role:            'doctor',
      plainPassword,
      entityName,
      managementModel,
      loginUrl:        process.env.FRONTEND_URL || 'https://likeson.in',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Password reset but email delivery failed',
      error:   err.message,
    });
  }

  await SystemLog.createLog({
    level:    'warning',
    category: 'security',
    message:  `Credentials resent for doctor: ${profile.user.email}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: profile._id, label: profile.user.email },
    request:  { method: 'POST', path: `/api/hospitals/doctors/${req.params.id}/resend-credentials`, statusCode: 200 },
  });

  res.json({
    success: true,
    message: `New credentials sent to ${profile.user.email}`,
  });
});

// PUT doctor (self) or admin: update profile fields. `fees` is stripped/rejected
// unless the doctor's (possibly newly-set) primaryHospital is doctor-owner.
const updateDoctorProfile = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // Gate fees BEFORE assignment — check against the hospital that will be
  // effective after this update (new primaryHospital if provided, else current).
  if (req.body.fees !== undefined) {
    const effectiveHospitalId = req.body.primaryHospital !== undefined
      ? req.body.primaryHospital
      : doctor.primaryHospital;
    await assertFeesAllowed(effectiveHospitalId); // throws 400 if hospital-managed
  }

  const allowedFields = [
    'specialization', 'qualifications', 'experienceYears',
    'registrationNumber', 'registrationCouncil',
    'biography', 'languagesSpoken', 'achievements',
    'fees', 'consultationTypes',
    'primaryHospital', 'otherHospitals',
    'notifPrefs',
    'doctorSignature', 
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) doctor[field] = req.body[field];
  });

  if (req.body.primaryHospital !== undefined) {
    const newHospId = req.body.primaryHospital;
    if (newHospId && mongoose.isValidObjectId(newHospId)) {
      await Hospital.findByIdAndUpdate(newHospId, { $addToSet: { linkedDoctors: doctor._id } });
    }
  }

  doctor.updatedBy = req.user._id;
  await doctor.save();
  await invalidateUserCache(req.user._id);

  res.json({ success: true, message: 'Doctor profile updated', data: doctor });
});

// PUT doctor (self) or admin: update notification prefs / onboarding step / online flag.
// settlementCycle is admin/superadmin-only.
const updateDoctorSettings = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  ['notifPrefs', 'onboarding', 'isOnline'].forEach((field) => {
    if (req.body[field] !== undefined) doctor[field] = req.body[field];
  });

  if (req.body.settlementCycle !== undefined) {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only admins can update settlementCycle' });
    }
    if (!['weekly', 'biweekly', 'monthly'].includes(req.body.settlementCycle)) {
      return res.status(400).json({
        success: false,
        message: "settlementCycle must be 'weekly', 'biweekly', or 'monthly'",
      });
    }
    doctor.settlementCycle = req.body.settlementCycle;
  }

  doctor.updatedBy = req.user._id;
  await doctor.save();

  res.json({
    success: true,
    message: 'Doctor settings updated',
    data: {
      notifPrefs:      doctor.notifPrefs,
      onboarding:      doctor.onboarding,
      isOnline:        doctor.isOnline,
      settlementCycle: doctor.settlementCycle,
    },
  });
});

// PUT admin-only: update registration number/council, contract URL, admin notes.
const updateDoctorSecurity = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (req.body.registrationNumber !== undefined) {
    const duplicate = await DoctorProfile.findOne({
      registrationNumber: req.body.registrationNumber,
      _id: { $ne: req.params.id },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: 'Another doctor already has this registration number',
      });
    }
    doctor.registrationNumber = req.body.registrationNumber;
  }

  if (req.body.registrationCouncil !== undefined) doctor.registrationCouncil = req.body.registrationCouncil;
  if (req.body.contractUrl         !== undefined) doctor.contractUrl         = req.body.contractUrl;
  if (req.body.adminNotes          !== undefined) doctor.adminNotes          = req.body.adminNotes;

  doctor.updatedBy = req.user._id;
  await doctor.save();

  await SystemLog.createLog({
    level:    'warning',
    category: 'security',
    message:  `Doctor security fields updated: ${req.params.id}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: doctor._id, label: doctor.registrationNumber },
    request:  { method: 'PUT', path: `/api/hospitals/doctors/${req.params.id}/security`, statusCode: 200 },
    metadata: { registrationNumber: doctor.registrationNumber, registrationCouncil: doctor.registrationCouncil },
  });

  res.json({
    success: true,
    message: 'Doctor security details updated',
    data: {
      registrationNumber:  doctor.registrationNumber,
      registrationCouncil: doctor.registrationCouncil,
      contractUrl:         doctor.contractUrl,
    },
  });
});

// PUT doctor (self) or admin: replace the doctor's weekly availability schedule.
const updateDoctorAvailability = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const { weeklyAvailability, availability } = req.body;
  const availData = weeklyAvailability || availability;

  if (!Array.isArray(availData)) {
    return res.status(400).json({
      success: false,
      message: 'weeklyAvailability must be an array of { day, isAvailable, slots[] } objects',
    });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  doctor.weeklyAvailability = availData;
  doctor.updatedBy          = req.user._id;
  await doctor.save();

  res.json({
    success:              true,
    message:              'Availability updated',
    weeklyAvailability:   doctor.weeklyAvailability,
  });
});

// PUT doctor (self) or admin: update bank details; always resets isBankVerified,
// forcing a fresh admin verification pass after any change.
const updateDoctorBankDetails = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const bankFields = [
    'accountHolderName', 'accountNumber', 'ifscCode',
    'bankName', 'branchName', 'upiId', 'gstNumber',
    'cancelledChequeUrl',
  ];

  bankFields.forEach((field) => {
    if (req.body[field] !== undefined) doctor.bankDetails[field] = req.body[field];
  });

  doctor.bankDetails.isBankVerified = false;
  doctor.bankDetails.verifiedAt     = undefined;
  doctor.updatedBy                  = req.user._id;
  await doctor.save();

  await SystemLog.createLog({
    level:    'warning',
    category: 'payment',
    message:  `Doctor bank details updated: ${req.params.id}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: doctor._id },
    request:  { method: 'PUT', path: `/api/hospitals/doctors/${req.params.id}/bank`, statusCode: 200 },
  });

  res.json({
    success: true,
    message: 'Bank details updated. Awaiting admin verification.',
    data: {
      accountHolderName: doctor.bankDetails.accountHolderName,
      accountLast4:      doctor.bankDetails.accountLast4,
      ifscCode:          doctor.bankDetails.ifscCode,
      bankName:          doctor.bankDetails.bankName,
      upiId:             doctor.bankDetails.upiId,
      isBankVerified:    doctor.bankDetails.isBankVerified,
    },
  });
});

// PUT doctor (self) or admin: submit/update KYC document fields; flips kycStatus to 'pending'.
const updateDoctorKyc = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const kycFields = [
    'aadhaarNumber', 'aadhaarFrontUrl', 'aadhaarBackUrl',
    'panNumber', 'panCardUrl',
  ];

  kycFields.forEach((field) => {
    if (req.body[field] !== undefined) doctor.kyc[field] = req.body[field];
  });

  if (doctor.kycStatus === 'not-submitted' || doctor.kycStatus === 'rejected') {
    doctor.kycStatus = 'pending';
  }

  doctor.updatedBy = req.user._id;
  await doctor.save();

  await SystemLog.createLog({
    level:    'info',
    category: 'kyc',
    message:  `Doctor KYC documents submitted: ${req.params.id}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: doctor._id },
    request:  { method: 'PUT', path: `/api/hospitals/doctors/${req.params.id}/kyc`, statusCode: 200 },
    metadata: { kycStatus: doctor.kycStatus },
  });

  res.json({
    success:   true,
    message:   'KYC documents submitted. Awaiting admin review.',
    kycStatus: doctor.kycStatus,
  });
});

// POST doctor (self) or admin: upload profile photo, syncs to linked User.avatar too.
const uploadDoctorPhoto = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No photo uploaded. Send a `photo` field as multipart/form-data.',
    });
  }

  const folder = `Likeson/doctors/${req.params.id}`;
  const result = await uploadToImageKit(req.file, `profile_${Date.now()}`, folder);

  doctor.profilePhotoUrl = result.url;
  doctor.updatedBy       = req.user._id;
  await doctor.save();

  await User.findByIdAndUpdate(doctor.user, { avatar: result.url });
  await invalidateUserCache(doctor.user);

  res.json({
    success:         true,
    message:         'Profile photo uploaded',
    profilePhotoUrl: result.url,
  });
});

// POST doctor (self) or admin: upload signature image used on prescriptions.
const uploadDoctorSignature = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (
    req.user.role === 'doctor' &&
    doctor.user.toString() !== req.user._id.toString()
  ) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No signature uploaded. Send a `signature` field as multipart/form-data.',
    });
  }

  const folder = `Likeson/doctors/${req.params.id}/signatures`;
  const result = await uploadToImageKit(req.file, `signature_${Date.now()}`, folder);

  doctor.doctorSignature = result.url;
  doctor.updatedBy       = req.user._id;
  await doctor.save();

  await invalidateUserCache(doctor.user);

  res.json({
    success:         true,
    message:         'Doctor signature uploaded successfully',
    doctorSignature: result.url,
  });
});

// PUT admin-only: set/clear a doctor's individual platform-fee override — top of the
// priority chain in DoctorProfile.resolveEffectivePricing (doctor override → hospital
// override → global config).
const updateDoctorPlatformFee = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  if (req.body.platformFee === null) {
    doctor.platformFee = null;
  } else if (req.body.platformFee !== undefined) {
    const { type, value } = req.body.platformFee;
    if (!['fixed', 'percentage'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "platformFee.type must be 'fixed' or 'percentage'",
      });
    }
    if (typeof value !== 'number' || value < 0) {
      return res.status(400).json({ success: false, message: 'platformFee.value must be a non-negative number' });
    }
    if (type === 'percentage' && value > 100) {
      return res.status(400).json({ success: false, message: 'platformFee.value cannot exceed 100 for percentage' });
    }
    doctor.platformFee = { type, value };
  }

  doctor.updatedBy = req.user._id;
  await doctor.save();

  await SystemLog.createLog({
    level:    'warning',
    category: 'payment',
    message:  `Doctor platform fee override updated: ${req.params.id}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: doctor._id },
    request:  { method: 'PUT', path: `/api/hospitals/doctors/${req.params.id}/platform-fee`, statusCode: 200 },
    metadata: { platformFee: doctor.platformFee },
  });

  res.json({
    success: true,
    message: doctor.platformFee
      ? `Platform fee override set: ${doctor.platformFee.type} = ${doctor.platformFee.value}`
      : 'Platform fee override cleared — using global default',
    data: {
      platformFee:          doctor.platformFee,
      hasCustomPlatformFee: doctor.hasCustomPlatformFee,
      settlementCycle:      doctor.settlementCycle,
    },
  });
});

// PUT admin-only: update partnershipStatus / partnerSince / contractUrl / adminNotes.
const updateDoctorPartnership = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  ['partnershipStatus', 'partnerSince', 'contractUrl'].forEach((field) => {
    if (req.body[field] !== undefined) doctor[field] = req.body[field];
  });

  if (req.body.partnershipStatus === 'Active' && !doctor.partnerSince) {
    doctor.partnerSince = new Date();
  }

  if (req.body.adminNotes !== undefined) doctor.adminNotes = req.body.adminNotes;

  doctor.updatedBy = req.user._id;
  await doctor.save();

  await SystemLog.createLog({
    level:    'info',
    category: 'user',
    message:  `Doctor partnership updated: ${req.params.id} → ${doctor.partnershipStatus}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: doctor._id },
    request:  { method: 'PUT', path: `/api/hospitals/doctors/${req.params.id}/partnership`, statusCode: 200 },
    metadata: { partnershipStatus: doctor.partnershipStatus },
  });

  res.json({
    success: true,
    message: 'Doctor partnership updated',
    data: {
      partnershipStatus: doctor.partnershipStatus,
      partnerSince:      doctor.partnerSince,
      contractUrl:       doctor.contractUrl,
    },
  });
});

// PUT admin-only: approve or reject a doctor's KYC submission.
const verifyDoctorKyc = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const { action, rejectionReason } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: "action must be 'approve' or 'reject'",
    });
  }

  if (action === 'reject' && !rejectionReason?.trim()) {
    return res.status(400).json({
      success: false,
      message: 'rejectionReason is required when rejecting KYC',
    });
  }

  let $set, $unset;

  if (action === 'approve') {
    $set = {
      kycStatus:             'verified',
      kycVerifiedAt:         new Date(),
      kycVerifiedBy:         req.user._id,
      isVerified:            true,
      updatedBy:             req.user._id,
      'kyc.aadhaarVerified': true,
      'kyc.panVerified':     true,
    };
    $unset = { kycRejectionReason: '' };
  } else {
    $set = {
      kycStatus:          'rejected',
      kycRejectionReason: rejectionReason.trim(),
      isVerified:         false,
      updatedBy:          req.user._id,
    };
    $unset = { kycVerifiedAt: '', kycVerifiedBy: '' };
  }

  const updatedDoctor = await DoctorProfile.findByIdAndUpdate(
    req.params.id,
    { $set, $unset },
    { new: true, runValidators: false }
  );

  if (!updatedDoctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  await SystemLog.createLog({
    level:    action === 'approve' ? 'success' : 'warning',
    category: 'kyc',
    message:  `Doctor KYC ${action === 'approve' ? 'approved' : 'rejected'}: ${req.params.id}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: updatedDoctor._id },
    request:  { method: 'PUT', path: `/api/hospitals/doctors/${req.params.id}/kyc/verify`, statusCode: 200 },
    metadata: { kycStatus: updatedDoctor.kycStatus, rejectionReason: rejectionReason ?? null },
  });

  await invalidateUserCache(updatedDoctor.user);

  return res.status(200).json({
    success: true,
    message: `KYC ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
    data: {
      _id:                      updatedDoctor._id,
      kycStatus:                updatedDoctor.kycStatus,
      isVerified:               updatedDoctor.isVerified,
      kycVerifiedAt:            updatedDoctor.kycVerifiedAt      ?? null,
      kycVerifiedBy:            updatedDoctor.kycVerifiedBy      ?? null,
      kycRejectionReason:       updatedDoctor.kycRejectionReason   ?? null,
      partnershipStatus:        updatedDoctor.partnershipStatus,
      profileCompletionPercent: updatedDoctor.profileCompletionPercent,
      kyc: {
        aadhaarVerified: updatedDoctor.kyc?.aadhaarVerified ?? false,
        panVerified:     updatedDoctor.kyc?.panVerified     ?? false,
      },
    },
  });
});

// PUT admin-only: flip a doctor's isActive flag.
const toggleDoctorActive = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  doctor.isActive  = !doctor.isActive;
  doctor.updatedBy = req.user._id;
  await doctor.save();

  await SystemLog.createLog({
    level:    doctor.isActive ? 'success' : 'warning',
    category: 'user',
    message:  `Doctor profile ${doctor.isActive ? 'activated' : 'deactivated'}: ${req.params.id}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: doctor._id },
  });

  res.json({
    success:  true,
    message:  `Doctor profile ${doctor.isActive ? 'activated' : 'deactivated'}`,
    isActive: doctor.isActive,
  });
});

// DELETE superadmin-only: hard-delete a doctor profile and detach from all hospitals.
const deleteDoctorProfile = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid doctor ID' });
  }

  const doctor = await DoctorProfile.findById(req.params.id);
  if (!doctor) {
    return res.status(404).json({ success: false, message: 'Doctor not found' });
  }

  await Hospital.updateMany(
    { linkedDoctors: doctor._id },
    { $pull: { linkedDoctors: doctor._id } }
  );

  await SystemLog.createLog({
    level:    'error',
    category: 'user',
    message:  `Doctor profile permanently deleted: ${req.params.id}`,
    actor:    { userId: req.user._id, name: req.user.name, role: req.user.role },
    relatedEntity: { model: 'DoctorProfile', entityId: doctor._id },
  });

  await doctor.deleteOne();

  res.json({ success: true, message: 'Doctor profile deleted permanently' });
});

// GET verified, active doctors linked to a specific hospital (primary or other).
const getDoctorsByHospital = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.hospitalId)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const { page, limit, skip } = parsePagination(req.query);

  const filter = {
    isActive:          true,
    partnershipStatus: 'Active',
    $or: [
      { primaryHospital: req.params.hospitalId },
      { otherHospitals:  req.params.hospitalId },
    ],
  };

  if (req.query.specialization)   filter.specialization = req.query.specialization;
  if (req.query.consultationType) filter[`consultationTypes.${req.query.consultationType}`] = true;

  const [doctors, total] = await Promise.all([
    DoctorProfile.find(filter)
      .select(DOCTOR_PUBLIC_EXCLUDE)
      .populate('user', 'name avatar')
      .sort({ 'rating.averageRating': -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorProfile.countDocuments(filter),
  ]);

  res.json({
    success: true,
    count:   doctors.length,
    total,
    page,
    pages:   Math.ceil(total / limit),
    data:    doctors,
  });
});

// GET a hospital's resolved pricing info by id (public, cached) — thin wrapper around
// buildHospitalPricingInfo, mirrors the shape attached to getHospitalById/BySlug.
const getHospitalEffectivePricing = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
  }

  const hospital = await Hospital.findById(req.params.id)
    .select('name managementModel consultationPricing settlementCycle')
    .lean();

  if (!hospital) {
    return res.status(404).json({ success: false, message: 'Hospital not found' });
  }

  res.json({
    success: true,
    data: {
      hospitalId: hospital._id,
      name:       hospital.name,
      ...buildHospitalPricingInfo(hospital),
      settlementCycle: hospital.settlementCycle,
    },
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  F. ROUTE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ── A. PUBLIC HOSPITAL ROUTES ─────────────────────────────────────────────────
router.get('/nearby', cache(120, () => 'hospitals:nearby'), getNearbyHospitals);
router.get('/search', cache(60,  (req) => `hospitals:search:${req.query.q || ''}:${req.query.city || ''}:${req.query.page || 1}`), searchHospitals);
router.get('/',       cache(180, (req) => `hospitals:all:${req.query.city || ''}:${req.query.type || ''}:${req.query.page || 1}:${req.query.sort || ''}`), getAllHospitals);
router.get('/slug/:slug', cache(300, (req) => `hospitals:slug:${req.params.slug}`), getHospitalBySlug);

// ── B. PUBLIC DOCTOR ROUTES ───────────────────────────────────────────────────
router.get('/doctors/nearby',                   cache(120, () => 'doctors:nearby'), getNearbyDoctors);
router.get('/doctors/search',                   cache(60,  (req) => `doctors:search:${req.query.q || ''}:${req.query.specialization || ''}:${req.query.page || 1}`), searchDoctors);
router.get('/doctors',                          cache(180, (req) => `doctors:all:${req.query.specialization || ''}:${req.query.page || 1}:${req.query.sort || ''}`), getAllDoctors);
router.get('/doctors/specialization/:spec',     cache(180, (req) => `doctors:spec:${req.params.spec}:${req.query.city || ''}:${req.query.page || 1}`), getDoctorsBySpecialization);
router.get('/doctors/by-hospital/:hospitalId',  cache(120, (req) => `doctors:hospital:${req.params.hospitalId}:${req.query.page || 1}`), getDoctorsByHospital);

// ── C. AUTHENTICATED DOCTOR / HOSPITAL SELF-SERVICE ROUTES ────────────────────
router.get('/doctors/me',                protect, authorize('doctor'), getMyDoctorProfile);
// 'hospital' included so managers can view their own hospitals through the same endpoint
router.get('/doctors/me/hospitals',      protect, authorize('doctor', 'hospital'), getMyManagedHospitals);
// 'hospital' included so managers can view the effective platform-fee/pricing context
router.get('/doctors/me/pricing',        protect, authorize('doctor', 'hospital'), getMyEffectivePricing);

// ── D. DOCTOR CREATE (Admin & Hospital Managers) ──────────────────────────────
router.post('/doctors', protect, authorize('admin', 'superadmin', 'hospital'), createDoctorProfile);

// ── E. DOCTOR PROFILE UPDATES (Doctor own + Admin) ───────────────────────────
router.put('/doctors/:id/profile',      protect, authorize('doctor', 'admin', 'superadmin'), updateDoctorProfile);
router.put('/doctors/:id/settings',     protect, authorize('doctor', 'admin', 'superadmin'), updateDoctorSettings);
router.put('/doctors/:id/availability', protect, authorize('doctor', 'admin', 'superadmin'), updateDoctorAvailability);
router.put('/doctors/:id/bank',         protect, authorize('doctor', 'admin', 'superadmin'), updateDoctorBankDetails);
router.put('/doctors/:id/kyc',          protect, authorize('doctor', 'admin', 'superadmin'), updateDoctorKyc);
router.get('/doctors/:id/stats',        protect, authorize('doctor', 'admin', 'superadmin'), getDoctorStats);

router.post(
  '/doctors/:id/photo',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  handleMulterError(doctorUpload),
  uploadDoctorPhoto
);

router.post(
  '/doctors/:id/signature',
  protect,
  authorize('doctor', 'admin', 'superadmin'),
  handleMulterError(signatureUpload),
  uploadDoctorSignature
);

// ── F. ADMIN-ONLY DOCTOR ROUTES ───────────────────────────────────────────────
router.put('/doctors/:id/security',           protect, authorize('admin', 'superadmin'), updateDoctorSecurity);
router.put('/doctors/:id/platform-fee',       protect, authorize('admin', 'superadmin'), updateDoctorPlatformFee);
router.put('/doctors/:id/partnership',        protect, authorize('admin', 'superadmin'), updateDoctorPartnership);
router.put('/doctors/:id/kyc/verify',         protect, authorize('admin', 'superadmin'), verifyDoctorKyc);
router.put('/doctors/:id/toggle',             protect, authorize('admin', 'superadmin'), toggleDoctorActive);
router.post('/doctors/:id/resend-credentials',protect, authorize('admin', 'superadmin'), resendDoctorCredentials);
router.delete('/doctors/:id',                 protect, authorize('superadmin'),          deleteDoctorProfile);

// ── G. DYNAMIC DOCTOR PUBLIC ROUTE (MUST be last in /doctors group) ───────────
router.get('/doctors/:id', cache(300, (req) => `doctors:single:${req.params.id}`), getDoctorById);

// ── H. HOSPITAL ADMIN ROUTES ──────────────────────────────────────────────────
router.post('/',         protect, authorize('admin', 'superadmin'), createHospital);
router.put('/:id/profile',              protect, authorize('admin', 'superadmin'), updateHospitalProfile);
router.put('/:id/settings',             protect, authorize('admin', 'superadmin'), updateHospitalSettings);
router.put('/:id/security',             protect, authorize('admin', 'superadmin'), updateHospitalSecurity);
router.put('/:id/consultation-pricing', protect, authorize('hospital', 'admin', 'superadmin'), updateHospitalConsultationPricing);
router.put('/:id/platform-fee',         protect, authorize('admin', 'superadmin'), updateHospitalPlatformFeeOverride);
router.post('/:id/resend-credentials',  protect, authorize('admin', 'superadmin'), resendHospitalManagerCredentials);

router.post(
  '/:id/images',
  protect,
  authorize('admin', 'superadmin'),
  handleMulterError(hospitalUpload),
  uploadHospitalImages
);

router.delete('/:id/images/:imageIndex', protect, authorize('admin', 'superadmin'), deleteHospitalImage);
router.put('/:id/location',              protect, authorize('admin', 'superadmin'), updateHospitalLocation);
router.post('/:id/doctors/:doctorId',    protect, authorize('admin', 'superadmin'), linkDoctorToHospital);
router.delete('/:id/doctors/:doctorId',  protect, authorize('admin', 'superadmin'), unlinkDoctorFromHospital);
router.put('/:id/verify',                protect, authorize('admin', 'superadmin'), verifyHospital);
router.put('/:id/toggle',                protect, authorize('admin', 'superadmin'), toggleHospitalActive);
router.delete('/:id',                    protect, authorize('superadmin'),          deleteHospital);

// ── I. HOSPITAL PRICING (public read) ─────────────────────────────────────────
router.get('/:id/pricing', cache(300, (req) => `hospitals:pricing:${req.params.id}`), getHospitalEffectivePricing);

// ── J. DYNAMIC HOSPITAL PUBLIC ROUTE (MUST be last) ──────────────────────────
router.get('/:id', cache(300, (req) => `hospitals:single:${req.params.id}`), getHospitalById);

export default router;