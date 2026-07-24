import mongoose           from 'mongoose';
import bcrypt             from 'bcryptjs';

import { protect, authorize }               from '../middleware/authMiddleware.js';
import SoloDriverPartner                    from '../models/SoloDriverPartner.js';
import Vehicle                              from '../models/Vehicle.js';
import User                                 from '../models/User.js';
import Notification                         from '../models/Notification.js';
import SystemLog                            from '../models/SystemLog.js';
import PartnerWallet                        from '../models/PartnerWallet.js';
import cache                                from '../middleware/cache.js';
import { invalidateKey, invalidatePattern } from '../utils/cacheInvalidation.js';
import sendEmail                            from '../utils/sendEmail.js';
import { transactionalTemplate }            from '../utils/emailTemplates.js';
import PlatformPricingConfig                from '../models/PlatformPricingConfig.js';


// ── §1  Logger ────────────────────────────────────────────────────────────────

const log = {
  info:  (...a) => console.log ('[SoloDriver]', ...a),
  warn:  (...a) => console.warn ('[SoloDriver]', ...a),
  error: (...a) => console.error('[SoloDriver]', ...a),
};

// ── §2  Validators ────────────────────────────────────────────────────────────

const isValidPhone   = (p) => /^[6-9]\d{9}$/.test(String(p || '').replace(/\D/g, '').slice(-10));
const isValidIFSC    = (c) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(String(c || '').toUpperCase());
const isValidPAN     = (p) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(String(p || '').toUpperCase());
const isValidAadhaar = (a) => /^\d{12}$/.test(String(a || ''));
const isValidRegNum  = (r) => String(r || '').replace(/\s/g, '').length >= 6;

const pick = (obj, keys) =>
  keys.reduce((acc, k) => { if (k in obj) acc[k] = obj[k]; return acc; }, {});

const getPagination = (query) => {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  return { page, limit, skip: (page - 1) * limit };
};

const paginate = (data, total, page, limit) => ({
  success: true, data,
  pagination: {
    total, page, limit,
    totalPages: Math.ceil(total / limit),
    hasNext:    page * limit < total,
    hasPrev:    page > 1,
  },
});

// ── §3  Async Wrapper ─────────────────────────────────────────────────────────

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    log.error(err.message, { stack: err.stack });
    next(err);
  });
};

// ── §4  Guards ────────────────────────────────────────────────────────────────

const attachSoloPartner = asyncHandler(async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required' });
  if (req.user.role !== 'solodriverpartner') {
    return res.status(403).json({ success: false, message: 'Solo driver-partner role required', userRole: req.user.role });
  }
  const partner = await SoloDriverPartner.findOne({ user: req.user._id });
  if (!partner) {
    return res.status(404).json({ success: false, message: 'Solo driver-partner profile not found.' });
  }
  if (partner.partnershipStatus === 'suspended') {
    return res.status(403).json({ success: false, message: 'Account suspended. Contact support.', rejectionReason: partner.rejectionReason });
  }
  req.soloPartner = partner;
  next();
});

const requireActive = (req, res, next) => {
  if (req.soloPartner?.partnershipStatus !== 'active') {
    return res.status(403).json({ success: false, message: `Partner account not active (status: ${req.soloPartner?.partnershipStatus})` });
  }
  next();
};

// requireKyc — gate for actions that shouldn't run before KYC clears.
// Was previously defined but never wired to any route; now applied on
// the vehicle and bank-details write routes (§9/§10), which are the
// actions that actually need a KYC-cleared partner behind them.
const requireKyc = (req, res, next) => {
  if (!req.soloPartner?.kyc?.isVerified) {
    return res.status(403).json({ success: false, message: 'KYC verification required.', kycStatus: req.soloPartner?.kyc?.verificationStatus });
  }
  next();
};

const partnerGuard = [protect, authorize('solodriverpartner'), attachSoloPartner];
const adminGuard   = [protect, authorize('admin', 'superadmin')];

// ── §5  Cache Keys ────────────────────────────────────────────────────────────

const CK = {
  profile:     (id) => `sdp:${id}:profile`,
  list:        ()   => 'sdp:list:*',
  stats:       (id) => `sdp:${id}:stats`,
  zones:       (id) => `sdp:${id}:zones`,
  vehicle:     (id) => `sdp:${id}:vehicle`,
  kyc:         (id) => `sdp:${id}:kyc`,
  bankDetails: (id) => `sdp:${id}:bank`,
};

const invalidateSdpCache = async (partnerId) => {
  await Promise.all([
    invalidatePattern(`sdp:${partnerId}:*`),
    invalidatePattern('sdp:list:*'),
  ]);
};

// ── §6  Audit ─────────────────────────────────────────────────────────────────

const createAuditLog = (payload) => {
  SystemLog.createLog(payload).catch((err) => log.error('[AuditLog] failed:', err.message));
};

const buildActor = (req) => ({
  userId:    req.user?._id,
  name:      req.user?.name,
  email:     req.user?.email,
  role:      req.user?.role,
  ip:        req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown',
  userAgent: req.headers['user-agent'] || null,
  platform:  req.deviceInfo?.platform || 'unknown',
});

// ── §6b  PII Masking Helpers ──────────────────────────────────────────────────
// Sensitive numbers (aadhaarNumber, kyc.panNumber, bankDetails.accountNumber)
// are `select:false` in the schema, so plain finds already omit them by
// default — no explicit `.select('-...')` or `delete` is needed for that.
// The bug across the old handlers was the *opposite* direction: masking
// code that tried to read `partner.bankDetails.accountNumber.slice(-4)` or
// `partner.kyc.aadhaarNumber` to build a masked display value — but since
// those fields are never present on a plain find, that code was dead and
// silently produced NO masked value at all (not even last-4). Build masks
// from the *last4 fields instead*, which are normal (selected) fields.

const maskAadhaar = (partner) =>
  partner?.kyc?.aadhaarLast4 ? `XXXX XXXX ${partner.kyc.aadhaarLast4}` : null;

const maskAccount = (bankDetails) =>
  bankDetails?.accountLast4 ? `XXXX XXXX XXXX ${bankDetails.accountLast4}` : null;

// ════════════════════════════════════════════════════════════════════════════
// §7  PROFILE ROUTES
// ════════════════════════════════════════════════════════════════════════════


// GET '/me'
export const getMe = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .populate('user', 'name email phone avatar role referralCode coins isEmailVerified isPhoneVerified')
      .lean();
    if (!partner) return res.status(404).json({ success: false, message: 'Profile not found' });

    // aadhaarNumber / kyc.panNumber / bankDetails.accountNumber are
    // select:false, so they're already absent here — these deletes are
    // just defense-in-depth in case a future query adds `+field`.
    if (partner.kyc) {
      delete partner.kyc.aadhaarNumber;
      delete partner.kyc.panNumber;
      partner.kyc.maskedAadhaar = maskAadhaar(partner);
    }
    if (partner.bankDetails) {
      delete partner.bankDetails.accountNumber;
      partner.bankDetails.maskedAccount = maskAccount(partner.bankDetails);
    }
    res.json({ success: true, data: partner });
  });

// PATCH '/me'
export const patchMe = asyncHandler(async (req, res) => {
    const allowed = ['displayName', 'dateOfBirth', 'gender', 'bio', 'languagesSpoken',
      'yearsOfExperience', 'hasMedicalTransportExp', 'hasAmbulanceExp', 'profilePhotoUrl'];
    const updates = pick(req.body, allowed);

    if (updates.bio?.length > 500)
      return res.status(422).json({ success: false, message: 'Bio must be ≤ 500 characters' });
    if (updates.yearsOfExperience !== undefined) {
      const y = Number(updates.yearsOfExperience);
      if (isNaN(y) || y < 0 || y > 60)
        return res.status(422).json({ success: false, message: 'yearsOfExperience must be 0–60' });
      updates.yearsOfExperience = y;
    }

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { ...updates, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);
    createAuditLog({ level: 'info', category: 'user', message: 'Solo partner updated basic profile', actor: buildActor(req), relatedEntity: { model: 'User', entityId: req.user._id } });
    res.json({ success: true, message: 'Profile updated', data: partner });
  });

// PATCH '/me/contact'
export const patchMeContact = asyncHandler(async (req, res) => {
    const { phone, altPhone, whatsappNumber, email } = req.body;
    if (phone && !isValidPhone(phone))
      return res.status(422).json({ success: false, message: 'Invalid primary phone number' });
    if (altPhone && !isValidPhone(altPhone))
      return res.status(422).json({ success: false, message: 'Invalid alternate phone number' });

    const updates = {};
    if (phone)          updates.phone          = phone.replace(/\D/g, '').slice(-10);
    if (altPhone)       updates.altPhone       = altPhone;
    if (whatsappNumber) updates.whatsappNumber = whatsappNumber;
    if (email)          updates.email          = email.toLowerCase().trim();
    updates.updatedBy = req.user._id;

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id, { $set: updates }, { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Contact info updated', data: { phone: partner.phone, altPhone: partner.altPhone, whatsappNumber: partner.whatsappNumber } });
  });

// PATCH '/me/address'
export const patchMeAddress = asyncHandler(async (req, res) => {
    const address = pick(req.body, ['street', 'city', 'state', 'pinCode', 'country']);
    if (!address.city || !address.state)
      return res.status(422).json({ success: false, message: 'City and state are required' });

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { address, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Address updated', data: partner.address });
  });

// PATCH '/me/professional'
export const patchMeProfessional = asyncHandler(async (req, res) => {
    const allowed = ['languagesSpoken', 'hasMedicalTransportExp', 'hasAmbulanceExp', 'yearsOfExperience'];
    const updates = pick(req.body, allowed);

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { ...updates, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Professional info updated', data: pick(partner, allowed) });
  });

// POST '/me/training-certificates'
export const postMeTrainingCertificates = asyncHandler(async (req, res) => {
    const { name, issuedBy, issuedAt, expiresAt, documentUrl } = req.body;
    if (!name) return res.status(422).json({ success: false, message: 'Certificate name is required' });

    const cert = { name, issuedBy, issuedAt, expiresAt, documentUrl };

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $push: { trainingCertificates: cert }, $set: { updatedBy: req.user._id } },
      { new: true, runValidators: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);
    res.status(201).json({ success: true, message: 'Certificate added', data: partner.trainingCertificates });
  });

// DELETE '/me/training-certificates/:certId'
export const deleteMeTrainingCertificatesByCertId = asyncHandler(async (req, res) => {
    const { certId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(certId))
      return res.status(400).json({ success: false, message: 'Invalid certificate ID' });

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, {
      $pull: { trainingCertificates: { _id: new mongoose.Types.ObjectId(certId) } },
    });

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Certificate removed' });
  });

// PATCH '/me/emergency'
export const patchMeEmergency = asyncHandler(async (req, res) => {
    const { name, relationship, phone } = req.body;
    if (!name || !phone) return res.status(422).json({ success: false, message: 'Name and phone required' });
    if (!isValidPhone(phone)) return res.status(422).json({ success: false, message: 'Invalid phone number' });

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { emergencyContact: { name, relationship, phone }, updatedBy: req.user._id } },
      { new: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Emergency contact updated', data: partner.emergencyContact });
  });

// GET '/me/settings'
export const getMeSettings = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('notifications settlementCycle availabilityHours')
      .lean();
    res.json({ success: true, data: partner });
  });

// PATCH '/me/settings'
export const patchMeSettings = asyncHandler(async (req, res) => {
    const prefs   = pick(req.body.notifications || {}, ['sms', 'email', 'push', 'whatsapp']);
    const updates = { updatedBy: req.user._id };
    if (Object.keys(prefs).length) updates['notifications'] = prefs;
    if (req.body.settlementCycle) {
      const valid = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'];
      if (!valid.includes(req.body.settlementCycle))
        return res.status(422).json({ success: false, message: `settlementCycle must be one of: ${valid.join(', ')}` });
      updates.settlementCycle = req.body.settlementCycle;
    }
    if (req.body.availabilityHours) {
      updates.availabilityHours = pick(req.body.availabilityHours, ['start', 'end']);
    }
    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, { $set: updates });
    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Settings updated' });
  });

// DELETE '/me'
export const deleteMe = asyncHandler(async (req, res) => {
    const { reason, password } = req.body;
    if (!password) return res.status(422).json({ success: false, message: 'Password required to delete account' });
    const user = await User.findById(req.user._id).select('+password');
    if (!await bcrypt.compare(password, user.password || ''))
      return res.status(401).json({ success: false, message: 'Incorrect password' });

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, {
      $set: {
        tags:              [...(req.soloPartner.tags || []), 'deletion-requested'],
        internalNotes:     `Deletion requested at ${new Date().toISOString()}. Reason: ${reason || 'Not provided'}`,
        partnershipStatus: 'suspended',
        updatedBy:         req.user._id,
      },
    });

    createAuditLog({ level: 'warning', category: 'user', message: `Solo partner requested deletion: ${req.user.email}`, actor: buildActor(req), metadata: { reason } });
    res.json({ success: true, message: 'Deletion request submitted. Will be reviewed within 7 business days.' });
  });

// GET '/kyc'
export const getKyc = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('kyc medicalFitness profileCompletionPercent isOnboardingComplete partnershipStatus')
      .lean();
    // aadhaarNumber / panNumber are select:false and already absent; build
    // the masked value from aadhaarLast4 unconditionally instead of
    // gating on the (never-present) full number.
    if (partner.kyc) {
      delete partner.kyc.aadhaarNumber;
      delete partner.kyc.panNumber;
      partner.kyc.maskedAadhaar = maskAadhaar(partner);
    }
    res.json({ success: true, data: partner });
  });

// POST '/kyc'
export const postKyc = asyncHandler(async (req, res) => {
    const {
      aadhaarNumber, aadhaarFrontUrl, aadhaarBackUrl,
      drivingLicenceNumber, drivingLicenceExpiry, drivingLicenceDocUrl,
      licenceClass, panNumber, panCardUrl,
    } = req.body;

    const errors = [];
    if (aadhaarNumber && !isValidAadhaar(aadhaarNumber)) errors.push('Invalid Aadhaar (must be 12 digits)');
    if (!drivingLicenceNumber) errors.push('Driving licence number required');
    if (!drivingLicenceExpiry) errors.push('Driving licence expiry required');
    if (panNumber && !isValidPAN(panNumber)) errors.push('Invalid PAN format');
    if (drivingLicenceExpiry && new Date(drivingLicenceExpiry) <= new Date())
      errors.push('Driving licence is expired');
    if (errors.length) return res.status(422).json({ success: false, message: 'Validation failed', errors });

    const dlExpiry = new Date(drivingLicenceExpiry);

    const kycUpdate = {
      'kyc.drivingLicenceNumber':  drivingLicenceNumber?.toUpperCase().trim(),
      'kyc.drivingLicenceExpiry':  dlExpiry,
      'kyc.drivingLicenceDocUrl':  drivingLicenceDocUrl,
      'kyc.licenceClass':          licenceClass || [],
      'kyc.verificationStatus':    'pending',
      'kyc.submittedAt':           new Date(),
    };
    // aadhaarFrontUrl/aadhaarBackUrl only set once each, was duplicated before.
    if (aadhaarNumber)   kycUpdate['kyc.aadhaarNumber']   = aadhaarNumber;
    if (aadhaarFrontUrl) kycUpdate['kyc.aadhaarFrontUrl'] = aadhaarFrontUrl;
    if (aadhaarBackUrl)  kycUpdate['kyc.aadhaarBackUrl']  = aadhaarBackUrl;
    if (panNumber)       kycUpdate['kyc.panNumber']       = panNumber.toUpperCase();
    if (panCardUrl)      kycUpdate['kyc.panCardUrl']      = panCardUrl;

    const partner = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $set: { ...kycUpdate, updatedBy: req.user._id } },
      { new: true, runValidators: true }
    );

    await invalidateSdpCache(req.soloPartner._id);
    createAuditLog({ level: 'info', category: 'kyc', message: `Solo partner submitted KYC: ${req.user.email}`, actor: buildActor(req) });

    res.json({
      success: true,
      message: 'KYC submitted. Verification within 24–48 hours.',
      data: { kycStatus: partner.kyc.verificationStatus, submittedAt: partner.kyc.submittedAt },
    });
  });

// POST '/kyc/medical'
export const postKycMedical = asyncHandler(async (req, res) => {
    const { certificateNumber, issuedBy, issuedAt, expiryDate, documentUrl, bloodGroup } = req.body;
    if (!expiryDate || new Date(expiryDate) <= new Date())
      return res.status(422).json({ success: false, message: 'Valid non-expired medical certificate required' });

    const validBG = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];
    if (bloodGroup && !validBG.includes(bloodGroup))
      return res.status(422).json({ success: false, message: 'Invalid blood group' });

    const medicalFitness = {
      certificateNumber, issuedBy,
      issuedAt:   issuedAt ? new Date(issuedAt) : undefined,
      expiryDate: new Date(expiryDate),
      documentUrl,
      bloodGroup: bloodGroup || 'Unknown',
      isValid:    new Date(expiryDate) > new Date(),
    };

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, {
      $set: { medicalFitness, updatedBy: req.user._id },
    });

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Medical fitness certificate submitted' });
  });

// POST '/kyc/psv'
export const postKycPsv = asyncHandler(async (req, res) => {
    const { psvBadgeNumber, psvBadgeExpiry, psvBadgeDocUrl } = req.body;
    if (!psvBadgeNumber) return res.status(422).json({ success: false, message: 'PSV badge number required' });
    if (!psvBadgeExpiry || new Date(psvBadgeExpiry) <= new Date())
      return res.status(422).json({ success: false, message: 'Valid non-expired PSV badge required' });

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, {
      $set: {
        'kyc.psvBadgeNumber': psvBadgeNumber.toUpperCase().trim(),
        'kyc.psvBadgeExpiry': new Date(psvBadgeExpiry),
        'kyc.psvBadgeDocUrl': psvBadgeDocUrl,
        updatedBy:            req.user._id,
      },
    });

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'PSV badge submitted' });
  });

// GET '/vehicle'
export const getVehicle = asyncHandler(async (req, res) => {
    const vehicle = await Vehicle.findOne({ ownerType: 'SoloDriverPartner', ownerId: req.soloPartner._id }).lean();
    res.json({ success: true, data: vehicle || null });
  });

// PUT '/vehicle'
export const putVehicle = asyncHandler(async (req, res) => {
    const { registrationNumber, make, model, year, color, vehicleType, seatingCapacity } = req.body;
    const errors = [];
    if (!registrationNumber || !isValidRegNum(registrationNumber)) errors.push('Valid registration number required');
    if (!make)        errors.push('Vehicle make required');
    if (!model)       errors.push('Vehicle model required');
    if (!vehicleType) errors.push('Vehicle type required');

    // Matches Vehicle.vehicleType's shared platform-wide enum (§ Vehicle
    // model) instead of a narrower local list that would reject valid
    // types like 'Bike', 'E-Rickshaw', 'Mortuary-Van', etc.
    const validTypes = [
      'Bike', 'Scooter', 'Auto', 'E-Rickshaw',
      'Hatchback', 'Sedan', 'SUV', 'MUV', 'Crossover',
      'Van', 'Minivan', 'Tempo-Traveller', 'Minibus',
      'Wheelchair-Van', 'Mortuary-Van',
      'Bus', 'Truck', 'Pickup',
    ];
    if (vehicleType && !validTypes.includes(vehicleType))
      errors.push(`vehicleType must be one of: ${validTypes.join(', ')}`);
    if (errors.length) return res.status(422).json({ success: false, message: 'Validation failed', errors });

    const vehicleData = {
      registrationNumber: registrationNumber.toUpperCase().replace(/\s/g, ''),
      make, model, color, vehicleType,
      year:            year ? Number(year) : undefined,
      seatingCapacity: seatingCapacity ? Number(seatingCapacity) : 4,
      verificationStatus: 'pending',
      updatedBy:       req.user._id,
    };
    Object.keys(vehicleData).forEach(k => vehicleData[k] === undefined && delete vehicleData[k]);

    // Upsert vehicle doc. SoloDriverPartner keeps no vehicle cache field —
    // this is the single source of truth, read live via GET /vehicle or
    // SoloDriverPartner.populate('vehicle').
    const vehicle = await Vehicle.findOneAndUpdate(
      { ownerType: 'SoloDriverPartner', ownerId: req.soloPartner._id },
      { $set: vehicleData, $setOnInsert: { ownerType: 'SoloDriverPartner', ownerId: req.soloPartner._id } },
      { new: true, upsert: true, runValidators: true }
    );
    await vehicle.save(); // re-triggers post-save (verificationHistory append, etc.)

    await invalidateSdpCache(req.soloPartner._id);
    createAuditLog({ level: 'info', category: 'user', message: `Solo partner updated vehicle: ${registrationNumber}`, actor: buildActor(req) });
    res.json({ success: true, message: 'Vehicle submitted for verification', data: vehicle });
  });

// PATCH '/vehicle/documents'
export const patchVehicleDocuments = asyncHandler(async (req, res) => {
    const allowed = [
      'rcBookUrl', 'insurancePolicyUrl', 'insuranceExpiry',
      'pollutionCertUrl', 'pollutionCertExpiry',
      'fitnessCertUrl', 'fitnessCertExpiry',
      'permitType', 'permitExpiry', 'photos',
    ];
    const docs = pick(req.body, allowed);
    if (!Object.keys(docs).length) return res.status(422).json({ success: false, message: 'No document fields provided' });

    const vehicle = await Vehicle.findOneAndUpdate(
      { ownerType: 'SoloDriverPartner', ownerId: req.soloPartner._id },
      { $set: { ...docs, updatedBy: req.user._id } },
      { new: true }
    );
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    await vehicle.save();

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Vehicle documents updated' });
  });

// PATCH '/vehicle/features'
export const patchVehicleFeatures = asyncHandler(async (req, res) => {
    const allowed = ['isWheelchairAccessible', 'hasStretcherSupport', 'hasOxygenSupport', 'hasMedicalKit', 'hasAC'];
    const features = pick(req.body, allowed);
    if (!Object.keys(features).length) return res.status(422).json({ success: false, message: 'No feature fields provided' });

    const update = { updatedBy: req.user._id };
    for (const [k, v] of Object.entries(features)) update[k] = Boolean(v);

    const vehicle = await Vehicle.findOneAndUpdate(
      { ownerType: 'SoloDriverPartner', ownerId: req.soloPartner._id },
      { $set: update }, { new: true }
    );
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    await vehicle.save();

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Vehicle features updated', data: features });
  });

// PATCH '/vehicle/location'
export const patchVehicleLocation = asyncHandler(async (req, res) => {
    const { lng, lat, gpsDeviceId } = req.body;
    const longitude = parseFloat(lng);
    const latitude  = parseFloat(lat);

    if (isNaN(longitude) || isNaN(latitude))
      return res.status(422).json({ success: false, message: 'Valid lng and lat required' });
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)
      return res.status(422).json({ success: false, message: 'Coordinates out of valid range' });

    const now = new Date();
    const vehicleUpdate = {
      location: { type: 'Point', coordinates: [longitude, latitude] },
      locationUpdatedAt: now,
      updatedBy: req.user._id,
    };
    if (gpsDeviceId) vehicleUpdate.gpsDeviceId = gpsDeviceId;

    const vehicle = await Vehicle.findOneAndUpdate(
      { ownerType: 'SoloDriverPartner', ownerId: req.soloPartner._id },
      { $set: vehicleUpdate },
      { new: true }
    );
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found. Add a vehicle before sending location pings.' });

    res.json({ success: true, message: 'Location updated', data: { lng: longitude, lat: latitude, updatedAt: now } });
  });

// GET '/bank'
export const getBank = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner.findById(req.soloPartner._id).select('bankDetails').lean();
    // accountNumber is select:false and already absent from `partner` here —
    // the old code tried `.accountNumber.slice(-4)`, which is always
    // undefined, so maskedAccount was silently never set. Build it from
    // accountLast4 (a normal, selected field) instead.
    if (partner.bankDetails) {
      delete partner.bankDetails.accountNumber;
      partner.bankDetails.maskedAccount = maskAccount(partner.bankDetails);
    }
    res.json({ success: true, data: partner });
  });

// POST '/bank'
export const postBank = asyncHandler(async (req, res) => {
    const { accountHolderName, accountNumber, ifscCode, bankName, upiId, upiName, accountType, cancelledChequeUrl } = req.body;
    const errors = [];
    if (!accountHolderName) errors.push('Account holder name required');
    if (!accountNumber || accountNumber.length < 8) errors.push('Valid account number required');
    if (!ifscCode || !isValidIFSC(ifscCode)) errors.push('Valid IFSC code required');
    if (!bankName) errors.push('Bank name required');
    if (accountType && !['Savings', 'Current'].includes(accountType)) errors.push('accountType must be Savings or Current');
    if (errors.length) return res.status(422).json({ success: false, message: 'Validation failed', errors });

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, {
      $set: {
        'bankDetails.accountHolderName':  accountHolderName.trim(),
        'bankDetails.accountNumber':      accountNumber.trim(),
        'bankDetails.ifscCode':           ifscCode.toUpperCase().trim(),
        'bankDetails.bankName':           bankName.trim(),
        'bankDetails.upiId':              upiId?.trim() || undefined,
        'bankDetails.upiName':            upiName?.trim() || undefined,
        'bankDetails.accountType':        accountType || 'Savings',
        'bankDetails.cancelledChequeUrl': cancelledChequeUrl,
        'bankDetails.isVerified':         false,
        updatedBy:                        req.user._id,
      },
    });

    await invalidateSdpCache(req.soloPartner._id);
    createAuditLog({ level: 'info', category: 'user', message: 'Solo partner updated bank details', actor: buildActor(req) });
    res.json({ success: true, message: 'Bank details submitted. Allow 1–2 business days for verification.' });
  });

// GET '/settlement'
export const getSettlement = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('partnerCode stats.totalEarnings')
      .lean();
    res.json({ success: true, data: { summary: { totalEarnings: partner.stats?.totalEarnings || 0 } } });
  });

// GET '/availability'
export const getAvailability = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('isAvailable availabilityHours partnershipStatus isOnboardingComplete kyc.isVerified dispatch')
      .lean();
    res.json({
      success: true,
      data: {
        isAvailable:          partner.isAvailable,
        availabilityHours:    partner.availabilityHours,
        partnershipStatus:    partner.partnershipStatus,
        isOnboardingComplete: partner.isOnboardingComplete,
        dispatchStatus:       partner.dispatch?.status || 'Offline',
        isDispatchReady: (
          partner.partnershipStatus === 'active' &&
          partner.isAvailable &&
          partner.isOnboardingComplete &&
          partner.kyc?.isVerified === true
        ),
      },
    });
  });

// PATCH '/availability'
export const patchAvailability = asyncHandler(async (req, res) => {
    const { isAvailable } = req.body;
    if (typeof isAvailable !== 'boolean')
      return res.status(422).json({ success: false, message: '`isAvailable` must be boolean' });

    if (isAvailable) {
      const p = req.soloPartner;
      if (!p.isOnboardingComplete) return res.status(403).json({ success: false, message: 'Complete onboarding first' });
      if (!p.kyc?.isVerified)      return res.status(403).json({ success: false, message: 'KYC verification required' });
    }

    const dispatchStatus = isAvailable ? 'Available' : 'Offline';

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, {
      $set: {
        isAvailable,
        'dispatch.status':      dispatchStatus,
        'dispatch.lastStatusAt': new Date(),
        updatedBy: req.user._id,
      },
    });

    res.json({ success: true, message: isAvailable ? "You're now online" : "You're now offline", data: { isAvailable } });
  });

// GET '/service-zones'
export const getServiceZones = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner.findById(req.soloPartner._id).select('serviceZones').lean();
    res.json({ success: true, data: partner?.serviceZones || [] });
  });

// POST '/service-zones'
export const postServiceZones = asyncHandler(async (req, res) => {
    const { city, state, pinCodes, radiusKm } = req.body;
    if (!city || !state) return res.status(422).json({ success: false, message: 'City and state required' });

    const partner = await SoloDriverPartner.findById(req.soloPartner._id).select('serviceZones');
    if (partner.serviceZones.length >= 10)
      return res.status(422).json({ success: false, message: 'Maximum 10 service zones allowed' });

    const exists = partner.serviceZones.some(
      z => z.city.toLowerCase() === city.toLowerCase() && z.state.toLowerCase() === state.toLowerCase()
    );
    if (exists) return res.status(409).json({ success: false, message: `Zone for ${city}, ${state} already exists` });

    const updated = await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      {
        $push: { serviceZones: { city: city.trim(), state: state.trim(), pinCodes: Array.isArray(pinCodes) ? pinCodes : [], radiusKm: Number(radiusKm) || 15, isActive: true } },
        $set:  { updatedBy: req.user._id },
      },
      { new: true }
    ).lean();

    await invalidateSdpCache(req.soloPartner._id);
    res.status(201).json({ success: true, message: 'Service zone added', data: updated.serviceZones });
  });

// PATCH '/service-zones/:zoneId'
export const patchServiceZonesByZoneId = asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(zoneId))
      return res.status(400).json({ success: false, message: 'Invalid zone ID' });

    const partner    = await SoloDriverPartner.findById(req.soloPartner._id).select('serviceZones');
    const targetZone = partner.serviceZones.id(zoneId);
    if (!targetZone) return res.status(404).json({ success: false, message: 'Service zone not found' });

    const { city, state, pinCodes, radiusKm, isActive } = req.body;
    const newCity  = city  !== undefined ? city.trim()  : targetZone.city;
    const newState = state !== undefined ? state.trim() : targetZone.state;

    if (city !== undefined || state !== undefined) {
      const dup = partner.serviceZones.some(
        z => String(z._id) !== String(zoneId) &&
             z.city.toLowerCase()  === newCity.toLowerCase() &&
             z.state.toLowerCase() === newState.toLowerCase()
      );
      if (dup) return res.status(409).json({ success: false, message: `Zone for ${newCity}, ${newState} already exists` });
    }

    const updateFields = { updatedBy: req.user._id };
    if (city     !== undefined) updateFields['serviceZones.$.city']     = newCity;
    if (state    !== undefined) updateFields['serviceZones.$.state']    = newState;
    if (pinCodes !== undefined) updateFields['serviceZones.$.pinCodes'] = Array.isArray(pinCodes) ? pinCodes : [];
    if (radiusKm !== undefined) updateFields['serviceZones.$.radiusKm'] = Number(radiusKm) || 15;
    if (isActive !== undefined) updateFields['serviceZones.$.isActive'] = Boolean(isActive);

    const updated = await SoloDriverPartner.findOneAndUpdate(
      { _id: req.soloPartner._id, 'serviceZones._id': zoneId },
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ success: false, message: 'Failed to update zone' });

    try { await invalidateSdpCache(req.soloPartner._id); } catch (_) {}

    const updatedZone = updated.serviceZones?.find(z => z?._id?.toString() === String(zoneId));
    res.json({ success: true, message: 'Service zone updated', data: updatedZone || targetZone });
  });

// DELETE '/service-zones/:zoneId'
export const deleteServiceZonesByZoneId = asyncHandler(async (req, res) => {
    const { zoneId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(zoneId))
      return res.status(400).json({ success: false, message: 'Invalid zone ID' });

    await SoloDriverPartner.findByIdAndUpdate(
      req.soloPartner._id,
      { $pull: { serviceZones: { _id: new mongoose.Types.ObjectId(zoneId) } } }
    );
    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Service zone removed' });
  });

// GET '/pricing'
export const getPricing = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('pricing platformFeeOverride settlementCycle')
      .lean();
    let effectivePlatformFee = partner.platformFeeOverride ?? null;
    if (!effectivePlatformFee) {
      const globalConfig   = await PlatformPricingConfig.getGlobal();
      effectivePlatformFee = globalConfig.transport.platformFee;
    }
    res.json({
      success: true,
      data: { pricing: partner.pricing, platformFeeOverride: partner.platformFeeOverride ?? null, effectivePlatformFee, settlementCycle: partner.settlementCycle, isUsingGlobalFee: !partner.platformFeeOverride },
    });
  });

// PUT '/pricing'
export const putPricing = asyncHandler(async (req, res) => {
    const allowed = ['baseFare', 'baseFarePerKm', 'minimumFare', 'waitingChargePerMin',
      'freeWaitingMinutes', 'nightSurchargePercent', 'wheelchairSurcharge'];
    const pricing = pick(req.body, allowed);
    for (const [k, v] of Object.entries(pricing)) {
      const n = Number(v);
      if (isNaN(n) || n < 0) return res.status(422).json({ success: false, message: `${k} must be non-negative number` });
      pricing[k] = n;
    }
    if (pricing.minimumFare !== undefined && pricing.minimumFare < 50)
      return res.status(422).json({ success: false, message: 'Minimum fare cannot be less than ₹50' });

    const update = { updatedBy: req.user._id };
    for (const [k, v] of Object.entries(pricing)) update[`pricing.${k}`] = v;
    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, { $set: update });
    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Pricing updated', data: pricing });
  });

// GET '/stats'
export const getStats = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('stats rating partnerSince profileCompletionPercent rewards.tier rewards.badges')
      .lean();
    res.json({ success: true, data: partner });
  });

// GET '/rating'
export const getRating = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('rating stats.totalRidesCompleted')
      .lean();
    res.json({ success: true, data: partner?.rating || { averageRating: 0, totalRatings: 0, totalRides: 0 } });
  });

// GET '/compliance'
export const getCompliance = asyncHandler(async (req, res) => {
    const [partner, vehicle] = await Promise.all([
      SoloDriverPartner.findById(req.soloPartner._id).select('kyc medicalFitness').lean(),
      Vehicle.findOne({ ownerType: 'SoloDriverPartner', ownerId: req.soloPartner._id }).lean(),
    ]);

    const now  = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const flagDoc = (label, expiry) => {
      if (!expiry) return { label, status: 'missing', expiry: null };
      const d = new Date(expiry);
      if (d < now)  return { label, status: 'expired',  expiry: d, daysLeft: 0 };
      if (d < soon) return { label, status: 'expiring', expiry: d, daysLeft: Math.ceil((d - now) / 86_400_000) };
      return           { label, status: 'valid',    expiry: d, daysLeft: Math.ceil((d - now) / 86_400_000) };
    };

    const docs = [
      flagDoc('Driving Licence',       partner.kyc?.drivingLicenceExpiry),
      flagDoc('PSV Badge',             partner.kyc?.psvBadgeExpiry),
      flagDoc('Medical Fitness',       partner.medicalFitness?.expiryDate),
      flagDoc('Vehicle Insurance',     vehicle?.insuranceExpiry),
      flagDoc('Pollution Certificate', vehicle?.pollutionCertExpiry),
      flagDoc('Fitness Certificate',   vehicle?.fitnessCertExpiry),
      flagDoc('Vehicle Permit',        vehicle?.permitExpiry),
    ];

    const hasExpired  = docs.some(d => d.status === 'expired');
    const hasExpiring = docs.some(d => d.status === 'expiring');

    res.json({
      success: true,
      data: { documents: docs, overallStatus: hasExpired ? 'critical' : hasExpiring ? 'warning' : 'good', hasExpired, hasExpiring },
    });
  });

// GET '/security/sessions'
export const getSecuritySessions = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('auditSessions lastLoginAt lastLoginIp').lean();
    res.json({ success: true, data: { sessions: user.auditSessions || [], lastLoginAt: user.lastLoginAt, lastLoginIp: user.lastLoginIp } });
  });

// DELETE '/security/sessions/:sessionId'
export const deleteSecuritySessionsBySessionId = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) return res.status(400).json({ success: false, message: 'Invalid session ID' });
    await User.findByIdAndUpdate(req.user._id, { $pull: { auditSessions: { _id: new mongoose.Types.ObjectId(sessionId) } } });
    res.json({ success: true, message: 'Session revoked' });
  });

// GET '/security/devices'
export const getSecurityDevices = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('deviceTokens').lean();
    const safe = (user.deviceTokens || []).map(({ _id, platform, deviceName, lastUsedAt }) => ({ _id, platform, deviceName, lastUsedAt }));
    res.json({ success: true, data: safe });
  });

// DELETE '/security/devices/:deviceId'
export const deleteSecurityDevicesByDeviceId = asyncHandler(async (req, res) => {
    const { deviceId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(deviceId)) return res.status(400).json({ success: false, message: 'Invalid device ID' });
    await User.findByIdAndUpdate(req.user._id, { $pull: { deviceTokens: { _id: new mongoose.Types.ObjectId(deviceId) } } });
    res.json({ success: true, message: 'Device removed' });
  });

// POST '/security/change-password'
export const postSecurityChangePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(422).json({ success: false, message: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(422).json({ success: false, message: 'New password must be ≥ 8 characters' });
    if (currentPassword === newPassword) return res.status(422).json({ success: false, message: 'New password must differ from current' });

    const user = await User.findById(req.user._id).select('+password');
    if (!await bcrypt.compare(currentPassword, user.password || '')) {
      createAuditLog({ level: 'warning', category: 'security', message: `Failed password change: ${req.user.email}`, actor: buildActor(req) });
      return res.status(401).json({ success: false, message: 'Current password incorrect' });
    }

    user.password          = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    await user.save();

    createAuditLog({ level: 'success', category: 'security', message: `Password changed: ${req.user.email}`, actor: buildActor(req) });

    sendEmail({
      email: req.user.email, subject: 'Your Likeson password was changed',
      html:  transactionalTemplate({ header: 'SECURITY ALERT', title: 'Password Changed', body: 'If this was not you, contact support immediately.', buttonLink: `${process.env.FRONTEND_URL}/support`, buttonText: 'Contact Support' }),
    }).catch(e => log.error('[PasswordChange] email error:', e.message));

    res.json({ success: true, message: 'Password changed successfully' });
  });

// GET '/notifications'
export const getNotifications = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { recipient: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;
    if (req.query.type) filter.type = req.query.type;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipient: req.user._id, isRead: false }),
    ]);

    res.json({ ...paginate(notifications, total, page, limit), unreadCount });
  });

// PATCH '/notifications/:id/read'
export const patchNotificationsByIdRead = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    await Notification.findOneAndUpdate({ _id: id, recipient: req.user._id }, { $set: { isRead: true, readAt: new Date() } });
    res.json({ success: true, message: 'Notification marked as read' });
  });

// PATCH '/notifications/read-all'
export const patchNotificationsReadAll = asyncHandler(async (req, res) => {
    const result = await Notification.updateMany({ recipient: req.user._id, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
    res.json({ success: true, message: `${result.modifiedCount} notifications marked as read` });
  });

// GET '/dispatch/status'
export const getDispatchStatus = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('isAvailable availabilityHours partnershipStatus isOnboardingComplete kyc.isVerified dispatch partnerCode')
      .lean();

    res.json({
      success: true,
      data: {
        status:               partner.dispatch?.status || (partner.isAvailable ? 'Available' : 'Offline'),
        isDispatchable: (
          partner.partnershipStatus === 'active' &&
          partner.isAvailable &&
          partner.isOnboardingComplete &&
          partner.kyc?.isVerified === true
        ),
        partnerCode:          partner.partnerCode,
        shift: {
          type:          partner.dispatch?.shiftType,
          start:         partner.dispatch?.shiftStart,
          end:           partner.dispatch?.shiftEnd,
          daysAvailable: partner.dispatch?.daysAvailable,
        },
        partnershipStatus:    partner.partnershipStatus,
        isOnboardingComplete: partner.isOnboardingComplete,
        kycVerified:          partner.kyc?.isVerified || false,
      },
    });
  });

// PATCH '/dispatch/status'
export const patchDispatchStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const valid = ['Available', 'Offline', 'On-Break'];
    if (!valid.includes(status))
      return res.status(422).json({ success: false, message: `status must be one of: ${valid.join(', ')}` });

    if (status === 'Available') {
      const p = req.soloPartner;
      if (!p.isOnboardingComplete) return res.status(403).json({ success: false, message: 'Complete onboarding first' });
      if (!p.kyc?.isVerified)      return res.status(403).json({ success: false, message: 'KYC verification required' });
    }

    const isAvailable = status === 'Available';

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, {
      $set: {
        isAvailable,
        'dispatch.status':       status,
        'dispatch.lastStatusAt': new Date(),
        updatedBy:               req.user._id,
      },
    });

    res.json({ success: true, message: `Status: ${status}`, data: { status } });
  });

// PATCH '/dispatch/shift'
export const patchDispatchShift = asyncHandler(async (req, res) => {
    const allowed = ['shiftType', 'shiftStart', 'shiftEnd', 'daysAvailable'];
    const updates = pick(req.body, allowed);
    if (!Object.keys(updates).length) return res.status(422).json({ success: false, message: 'No shift fields provided' });

    const dispatchUpdate = {};
    for (const [k, v] of Object.entries(updates)) dispatchUpdate[`dispatch.${k}`] = v;

    // Mirror to availabilityHours for backward compat
    const sdpExtra = {};
    if (updates.shiftStart) sdpExtra['availabilityHours.start'] = updates.shiftStart;
    if (updates.shiftEnd)   sdpExtra['availabilityHours.end']   = updates.shiftEnd;

    await SoloDriverPartner.findByIdAndUpdate(req.soloPartner._id, {
      $set: { ...dispatchUpdate, ...sdpExtra, updatedBy: req.user._id },
    });

    await invalidateSdpCache(req.soloPartner._id);
    res.json({ success: true, message: 'Shift updated', data: updates });
  });

// GET '/performance'
export const getPerformance = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('stats rating partnerSince profileCompletionPercent rewards')
      .lean();
    res.json({
      success: true,
      data: {
        stats:             partner.stats,
        rating:            partner.rating,
        partnerSince:      partner.partnerSince,
        profileCompletion: partner.profileCompletionPercent,
        tier:              partner.rewards?.tier || 'Bronze',
      },
    });
  });

// GET '/rewards'
export const getRewards = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner
      .findById(req.soloPartner._id)
      .select('rewards')
      .lean();
    res.json({
      success: true,
      data: {
        coinBalance:   partner.rewards?.coinBalance || 0,
        coinsEarned:   partner.rewards?.totalCoinsEarned || 0,
        coinsRedeemed: partner.rewards?.totalCoinsRedeem || 0,
        tier:          partner.rewards?.tier || 'Bronze',
        badges:        partner.rewards?.badges || [],
      },
    });
  });

// GET '/rewards/badges'
export const getRewardsBadges = asyncHandler(async (req, res) => {
    const partner = await SoloDriverPartner.findById(req.soloPartner._id).select('rewards.badges').lean();
    res.json({ success: true, data: partner?.rewards?.badges || [] });
  });

// GET '/admin/list'
export const getAdminList = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const { status, kycStatus, vehicleStatus, city, state, search, sortBy, sortOrder } = req.query;

    const filter = {};
    if (status)    filter.partnershipStatus         = status;
    if (kycStatus) filter['kyc.verificationStatus'] = kycStatus;
    if (city)      filter['serviceZones.city']      = new RegExp(city, 'i');
    if (state)     filter['serviceZones.state']     = new RegExp(state, 'i');
    if (search) {
      filter.$or = [
        { legalName:   new RegExp(search, 'i') },
        { displayName: new RegExp(search, 'i') },
        { partnerCode: new RegExp(search, 'i') },
        { phone:       new RegExp(search, 'i') },
        { email:       new RegExp(search, 'i') },
      ];
    }

    // Vehicle verification status lives on the standalone Vehicle
    // collection, not on SoloDriverPartner — query it directly, then
    // constrain by owner _id.
    if (vehicleStatus) {
      const matchingVehicles = await Vehicle.find({
        ownerType:          'SoloDriverPartner',
        verificationStatus: vehicleStatus,
      }).select('ownerId').lean();
      const ownerIds = matchingVehicles.map(v => v.ownerId);
      filter._id = { $in: ownerIds };
    }

    const sort = { [sortBy || 'createdAt']: sortOrder === 'asc' ? 1 : -1 };
    const [partners, total] = await Promise.all([
      SoloDriverPartner.find(filter).sort(sort).skip(skip).limit(limit)
        // kyc.aadhaarNumber / kyc.panNumber / bankDetails.accountNumber are
        // select:false already; panNumber no longer exists at top level
        // (moved into kyc — see model), so excluding it there was a no-op.
        .select('-kyc.aadhaarNumber -kyc.panNumber -bankDetails.accountNumber -adminNotes -internalNotes')
        .populate('user', 'name email phone avatar isEmailVerified isPhoneVerified isBlocked')
        .lean(),
      SoloDriverPartner.countDocuments(filter),
    ]);
    res.json(paginate(partners, total, page, limit));
  });

// POST '/admin/create'
export const postAdminCreate = asyncHandler(async (req, res) => {
    const {
      name, email, phone, legalName, displayName, dateOfBirth, gender, address,
      drivingLicenceNumber, drivingLicenceExpiry, aadhaarNumber,
      registrationNumber, vehicleType, make, vehicleModel,
      businessType, tradeName, settlementCycle, platformFeeOverride, internalNotes, adminNotes: adminNotesInput,
    } = req.body;

    const errors = [];
    if (!name?.trim())         errors.push('Full name required');
    if (!email?.trim())        errors.push('Email required');
    if (!phone)                errors.push('Phone required');
    if (!legalName?.trim())    errors.push('Legal name required');
    if (!address?.city)        errors.push('City required');
    if (!address?.state)       errors.push('State required');
    if (!drivingLicenceNumber) errors.push('Driving licence number required');
    if (platformFeeOverride) {
      if (!['fixed', 'percentage'].includes(platformFeeOverride.type)) errors.push('platformFeeOverride.type must be fixed or percentage');
      if (typeof platformFeeOverride.value !== 'number' || platformFeeOverride.value < 0) errors.push('platformFeeOverride.value must be ≥ 0');
    }
    if (errors.length) return res.status(422).json({ success: false, message: 'Validation failed', errors });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.replace(/\D/g, '').slice(-10);

    const [emailExists, phoneExists] = await Promise.all([
      User.exists({ email: normalizedEmail }),
      User.exists({ phone: { $regex: normalizedPhone + '$' } }),
    ]);
    if (emailExists) return res.status(409).json({ success: false, message: 'Email already registered' });
    if (phoneExists) return res.status(409).json({ success: false, message: 'Phone already registered' });

    const globalConfig   = await PlatformPricingConfig.getGlobal();
    const effectiveFee   = platformFeeOverride || globalConfig.transport.platformFee;
    const rawPassword    = `Lks@${Math.random().toString(36).slice(-4).toUpperCase()}${Math.floor(1000 + Math.random() * 9000)}`;
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const newUser = await User.create({
      name: name.trim(), email: normalizedEmail, phone: normalizedPhone,
      password: hashedPassword, role: 'solodriverpartner',
      isEmailVerified: true, isPhoneVerified: true, createdBy: req.user._id,
    });

    const partnerPayload = {
      user:        newUser._id,
      legalName:   legalName.trim(),
      displayName: displayName?.trim() || legalName.trim(),
      phone:       normalizedPhone,
      email:       normalizedEmail,
      address:     { street: address.street || '', city: address.city.trim(), state: address.state.trim(), pinCode: address.pinCode || '', country: address.country || 'India' },
      businessType:    businessType || 'individual',
      tradeName:       tradeName?.trim(),
      settlementCycle: settlementCycle || 'Weekly',
      platformFeeOverride: platformFeeOverride || null,
      partnershipStatus:   'pending',
      createdBy: req.user._id, internalNotes, adminNotes: adminNotesInput,
      kyc: {
        drivingLicenceNumber: drivingLicenceNumber.toUpperCase().trim(),
        drivingLicenceExpiry: drivingLicenceExpiry ? new Date(drivingLicenceExpiry) : undefined,
        aadhaarNumber:        aadhaarNumber || undefined,
        verificationStatus:   'not-submitted',
      },
    };
    if (dateOfBirth) partnerPayload.dateOfBirth = new Date(dateOfBirth);
    if (gender)      partnerPayload.gender      = gender;

    const newPartner = await SoloDriverPartner.create(partnerPayload);

    // Vehicle — standalone Vehicle doc. No cache field to sync on
    // SoloDriverPartner anymore; read it back live via GET /vehicle or
    // SoloDriverPartner.populate('vehicle').
    let newVehicle = null;
    if (registrationNumber) {
      newVehicle = await Vehicle.create({
        ownerType:          'SoloDriverPartner',
        ownerId:            newPartner._id,
        registrationNumber: registrationNumber.toUpperCase().replace(/\s/g, ''),
        make:               make || 'Unknown',
        model:              vehicleModel || 'Unknown',
        vehicleType:        vehicleType || 'Sedan',
        verificationStatus: 'pending',
        createdBy:          req.user._id,
      });
    }

    // PartnerWallet, not the generic Wallet model — SoloDriverPartner
    // .getWallet() (model §5) looks up PartnerWallet keyed on
    // { partner: user, partnerRole: 'solodriverpartner' }. Creating in
    // `Wallet` instead put money in a collection the partner's own
    // getWallet() would never find.
    await PartnerWallet.create({
      partner: newUser._id, partnerRole: 'solodriverpartner', balance: 0, createdBy: req.user._id,
    });

    // Welcome email
    sendEmail({
      email: normalizedEmail,
      subject: '🏥 Welcome to Likeson Healthcare — Your Driver Partner Account',
      html: transactionalTemplate({
        header: 'WELCOME TO LIKESON',
        title:  `Hi ${name.trim()}, your partner account is ready!`,
        body: `<p>You have been registered as a <strong>Solo Driver Partner</strong>.</p>
               <p><strong>Login:</strong> ${normalizedEmail}</p>
               <p><strong>Temp Password:</strong> ${rawPassword}</p>
               <p><strong>Partner Code:</strong> ${newPartner.partnerCode}</p>
               <p>⚠️ Change your password after first login.</p>`,
        buttonLink: `${process.env.FRONTEND_URL}/login`,
        buttonText: 'Login to Your Account →',
      }),
    }).catch(e => log.error('[AdminCreate] email failed:', e.message));

    Notification.create({
      recipient: newUser._id, title: 'Welcome to Likeson! 🎉',
      body: 'Your solo driver partner account has been created. Complete KYC and vehicle details to get started.',
      type: 'Account_Status', priority: 'High', triggeredBy: 'admin',
    }).catch(e => log.error('[AdminCreate] notification failed:', e.message));

    createAuditLog({
      level: 'success', category: 'user',
      message: `Admin created solo driver partner: ${normalizedEmail}`, actor: buildActor(req),
      metadata: { partnerCode: newPartner.partnerCode, partnerId: newPartner._id, hasVehicle: !!newVehicle },
    });

    await invalidatePattern('sdp:list:*');

    res.status(201).json({
      success: true, message: 'Solo Driver Partner created successfully',
      data: { userId: newUser._id, partnerId: newPartner._id, partnerCode: newPartner.partnerCode, effectivePlatformFee: effectiveFee },
    });
  });

// GET '/admin/:id'
export const getAdminById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const partner = await SoloDriverPartner.findById(id)
      .populate('user', 'name email phone avatar role isEmailVerified isPhoneVerified isBlocked blockReason loginCount lastLoginAt coins referralCode')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('verifiedBy', 'name email')
      .lean();

    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    // accountNumber is select:false and already absent; build the masked
    // display value from accountLast4 instead of the (never-present) full
    // number, same fix as GET /me and GET /bank.
    if (partner.bankDetails) {
      delete partner.bankDetails.accountNumber;
      partner.bankDetails.maskedAccount = maskAccount(partner.bankDetails);
    }
    if (partner.kyc) {
      delete partner.kyc.aadhaarNumber;
      delete partner.kyc.panNumber;
      partner.kyc.maskedAadhaar = maskAadhaar(partner);
    }
    res.json({ success: true, data: partner });
  });

// PATCH '/admin/:id/verify-kyc'
export const patchAdminByIdVerifyKyc = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(422).json({ success: false, message: 'action must be "approve" or "reject"' });
    if (action === 'reject' && !rejectionReason) return res.status(422).json({ success: false, message: 'Rejection reason required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const approved  = action === 'approve';
    const kycStatus = approved ? 'verified' : 'rejected';

    const update = {
      'kyc.verificationStatus': kycStatus,
      'kyc.isVerified':         approved,
      'kyc.verifiedAt':         approved ? new Date() : undefined,
      'kyc.verifiedBy':         req.user._id,
      'kyc.rejectionReason':    !approved ? rejectionReason : undefined,
      updatedBy:                req.user._id,
    };
    Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

    const partner = await SoloDriverPartner.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('user', 'name email');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    await Notification.create({
      recipient:   partner.user._id,
      title:       approved ? 'KYC Verified ✅' : 'KYC Rejected ❌',
      body:        approved ? 'KYC verified. Proceed to activate your account.' : `KYC rejected: ${rejectionReason}`,
      type:        'KYC_Approved', priority: 'High', triggeredBy: 'admin',
    });

    createAuditLog({ level: approved ? 'success' : 'warning', category: 'kyc', message: `Admin ${action}d KYC: ${partner.user.email}`, actor: buildActor(req), metadata: { action, rejectionReason } });
    await invalidateSdpCache(id);
    res.json({ success: true, message: `KYC ${action}d`, data: { kycStatus: partner.kyc.verificationStatus } });
  });

// PATCH '/admin/:id/verify-vehicle'
export const patchAdminByIdVerifyVehicle = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(422).json({ success: false, message: 'action must be "approve" or "reject"' });
    if (action === 'reject' && !rejectionReason) return res.status(422).json({ success: false, message: 'Rejection reason required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const vehicle = await Vehicle.findOne({ ownerType: 'SoloDriverPartner', ownerId: id });
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });

    const approved = action === 'approve';
    vehicle.verificationStatus = approved ? 'verified' : 'rejected';
    vehicle.status             = approved ? 'active'   : 'inactive';
    if (approved) vehicle.verifiedAt = new Date();
    vehicle.verifiedBy = req.user._id;
    if (!approved) vehicle.rejectionReason = rejectionReason;
    await vehicle.save();

    const partner = await SoloDriverPartner.findById(id).populate('user', 'name email');
    if (partner) {
      await Notification.create({
        recipient:   partner.user._id,
        title:       approved ? 'Vehicle Verified ✅' : 'Vehicle Rejected ❌',
        body:        approved ? 'Vehicle verified and activated.' : `Vehicle rejected: ${rejectionReason}`,
        type:        'Account_Status', priority: 'High', triggeredBy: 'admin',
      });
      createAuditLog({ level: approved ? 'success' : 'warning', category: 'kyc', message: `Admin ${action}d vehicle: ${partner.user.email}`, actor: buildActor(req) });
    }

    await invalidateSdpCache(id);
    res.json({ success: true, message: `Vehicle ${action}d`, data: { vehicleStatus: vehicle.verificationStatus } });
  });

// PATCH '/admin/:id/verify-bank'
export const patchAdminByIdVerifyBank = asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const partner = await SoloDriverPartner.findByIdAndUpdate(id, {
      $set: { 'bankDetails.isVerified': true, 'bankDetails.verifiedAt': new Date(), 'bankDetails.verifiedBy': req.user._id, updatedBy: req.user._id },
    }, { new: true }).populate('user', 'name email');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    await invalidateSdpCache(id);
    createAuditLog({ level: 'success', category: 'user', message: `Admin verified bank: ${partner.user.email}`, actor: buildActor(req) });
    res.json({ success: true, message: 'Bank account verified' });
  });

// PATCH '/admin/:id/status'
export const patchAdminByIdStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const validStatuses = ['pending', 'under-review', 'active', 'suspended', 'rejected'];
    if (!validStatuses.includes(status)) return res.status(422).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });
    if (['suspended', 'rejected'].includes(status) && !rejectionReason) return res.status(422).json({ success: false, message: 'Reason required when suspending or rejecting' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const update = { partnershipStatus: status, updatedBy: req.user._id };
    if (status === 'active')   { update.partnerSince = update.partnerSince || new Date(); update.verifiedBy = req.user._id; update.verifiedAt = new Date(); update.isAvailable = false; }
    if (rejectionReason)       { update.rejectionReason = rejectionReason; }

    // If suspended/rejected — force offline
    if (['suspended', 'rejected'].includes(status)) {
      update.isAvailable         = false;
      update['dispatch.status']  = 'Offline';
    }

    const partner = await SoloDriverPartner.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('user', 'name email');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    const notifTitle = { active: 'Account Activated 🎉', suspended: 'Account Suspended ⚠️', rejected: 'Application Rejected', 'under-review': 'Under Review' }[status] || 'Status Updated';
    await Notification.create({
      recipient:   partner.user._id, title: notifTitle,
      body:        status === 'active' ? 'Account is now active. Start accepting rides.' : `Status updated to ${status}. ${rejectionReason || ''}`,
      type:        'Account_Status', priority: ['suspended', 'rejected'].includes(status) ? 'High' : 'Medium', triggeredBy: 'admin',
    });

    createAuditLog({ level: status === 'active' ? 'success' : 'warning', category: 'user', message: `Admin set partner status to "${status}": ${partner.user.email}`, actor: buildActor(req), metadata: { status, rejectionReason } });
    await invalidateSdpCache(id);
    res.json({ success: true, message: `Partner status updated to ${status}`, data: { partnershipStatus: status } });
  });

// PATCH '/admin/:id/block'
export const patchAdminByIdBlock = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { action, blockReason, unblockAt } = req.body;
    if (!['block', 'unblock'].includes(action)) return res.status(422).json({ success: false, message: 'action must be "block" or "unblock"' });
    if (action === 'block' && !blockReason) return res.status(422).json({ success: false, message: 'Block reason required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const partner = await SoloDriverPartner.findById(id).populate('user', 'name email');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    const blocking = action === 'block';

    const sdpUpdate = {};
    if (blocking) {
      sdpUpdate.isAvailable         = false;
      sdpUpdate['dispatch.status']  = 'Offline';
    }

    await Promise.all([
      User.findByIdAndUpdate(partner.user._id, {
        $set: { isBlocked: blocking, blockReason: blocking ? blockReason : undefined, unblockAt: blocking && unblockAt ? new Date(unblockAt) : undefined },
      }),
      Object.keys(sdpUpdate).length
        ? SoloDriverPartner.findByIdAndUpdate(id, { $set: sdpUpdate })
        : Promise.resolve(),
    ]);

    createAuditLog({ level: blocking ? 'warning' : 'info', category: 'security', message: `Admin ${action}ed partner: ${partner.user.email}`, actor: buildActor(req), metadata: { action, blockReason, unblockAt } });
    await invalidateSdpCache(id);
    res.json({ success: true, message: `User account ${action}ed` });
  });

// PATCH '/admin/:id/platform-fee'
export const patchAdminByIdPlatformFee = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { platformFeeOverride, settlementCycle } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const updates = { updatedBy: req.user._id };
    if (platformFeeOverride !== undefined) {
      if (platformFeeOverride === null) {
        updates.platformFeeOverride = null;
      } else {
        if (!['fixed', 'percentage'].includes(platformFeeOverride.type)) return res.status(422).json({ success: false, message: 'platformFeeOverride.type must be fixed or percentage' });
        const val = Number(platformFeeOverride.value);
        if (isNaN(val) || val < 0) return res.status(422).json({ success: false, message: 'platformFeeOverride.value must be ≥ 0' });
        if (platformFeeOverride.type === 'percentage' && val > 100) return res.status(422).json({ success: false, message: 'percentage value must be ≤ 100' });
        updates.platformFeeOverride = { type: platformFeeOverride.type, value: val };
      }
    }
    if (settlementCycle !== undefined) {
      const valid = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'];
      if (!valid.includes(settlementCycle)) return res.status(422).json({ success: false, message: `settlementCycle must be one of: ${valid.join(', ')}` });
      updates.settlementCycle = settlementCycle;
    }
    if (Object.keys(updates).length === 1) return res.status(422).json({ success: false, message: 'Provide at least one of: platformFeeOverride, settlementCycle' });

    await SoloDriverPartner.findByIdAndUpdate(id, { $set: updates });
    const globalConfig = await PlatformPricingConfig.getGlobal();
    const effectiveFee = updates.platformFeeOverride ?? globalConfig.transport.platformFee;

    createAuditLog({ level: 'info', category: 'user', message: `Admin updated platform fee for partner ${id}`, actor: buildActor(req), metadata: { platformFeeOverride: updates.platformFeeOverride, settlementCycle: updates.settlementCycle, effectiveFee } });
    await invalidateSdpCache(id);

    res.json({ success: true, message: 'Platform fee settings updated', data: { platformFeeOverride: updates.platformFeeOverride, effectivePlatformFee: effectiveFee, settlementCycle: updates.settlementCycle, isUsingGlobalFee: !updates.platformFeeOverride } });
  });

// GET '/admin/compliance-alerts'
export const getAdminComplianceAlerts = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const cutoff = new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000);
    const now    = new Date();

    const [partners, vehicles] = await Promise.all([
      SoloDriverPartner.find({
        partnershipStatus: 'active',
        $or: [
          { 'kyc.drivingLicenceExpiry':  { $lte: cutoff } },
          { 'kyc.psvBadgeExpiry':        { $lte: cutoff } },
          { 'medicalFitness.expiryDate': { $lte: cutoff } },
        ],
      }).select('legalName partnerCode phone email kyc.drivingLicenceExpiry kyc.psvBadgeExpiry medicalFitness.expiryDate')
        .populate('user', 'name email phone').lean(),

      Vehicle.find({
        ownerType: 'SoloDriverPartner', status: 'active',
        $or: [{ insuranceExpiry: { $lte: cutoff } }, { pollutionCertExpiry: { $lte: cutoff } }, { fitnessCertExpiry: { $lte: cutoff } }, { permitExpiry: { $lte: cutoff } }],
      }).populate({ path: 'ownerId', select: 'legalName partnerCode phone email', populate: { path: 'user', select: 'name email phone' } }).lean(),
    ]);

    const alertMap = new Map();
    partners.forEach(p => alertMap.set(p._id.toString(), { ...p, vehicle: null }));
    vehicles.forEach(v => {
      const pId = v.ownerId?._id?.toString();
      if (!pId) return;
      if (!alertMap.has(pId)) alertMap.set(pId, { ...v.ownerId, vehicle: v });
      else alertMap.get(pId).vehicle = v;
    });

    const annotated = Array.from(alertMap.values()).map(p => {
      const checks = [
        { label: 'DL Expiry',       date: p.kyc?.drivingLicenceExpiry },
        { label: 'PSV Badge',       date: p.kyc?.psvBadgeExpiry },
        { label: 'Medical Fitness', date: p.medicalFitness?.expiryDate },
        { label: 'Insurance',       date: p.vehicle?.insuranceExpiry },
        { label: 'Pollution Cert',  date: p.vehicle?.pollutionCertExpiry },
        { label: 'Fitness Cert',    date: p.vehicle?.fitnessCertExpiry },
        { label: 'Permit',          date: p.vehicle?.permitExpiry },
      ].filter(c => c.date && new Date(c.date) <= cutoff)
       .map(c => ({ ...c, daysLeft: Math.max(0, Math.ceil((new Date(c.date) - now) / 86_400_000)), isExpired: new Date(c.date) < now }));
      return { ...p, expiringDocs: checks };
    }).filter(p => p.expiringDocs.length > 0);

    res.json({ success: true, total: annotated.length, data: annotated });
  });

// POST '/admin/:id/notes'
export const postAdminByIdNotes = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { notes } = req.body;
    if (!notes?.trim()) return res.status(422).json({ success: false, message: 'Notes content required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });
    await SoloDriverPartner.findByIdAndUpdate(id, { $set: { adminNotes: String(notes).trim().slice(0, 1000), updatedBy: req.user._id } });
    res.json({ success: true, message: 'Admin notes updated' });
  });

// PATCH '/admin/:id/rewards/award-badge'
export const patchAdminByIdRewardsAwardBadge = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { badgeId, name, description, iconUrl } = req.body;
    if (!badgeId || !name) return res.status(422).json({ success: false, message: 'badgeId and name required' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const partner = await SoloDriverPartner.findById(id).populate('user', 'name email');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    await SoloDriverPartner.findByIdAndUpdate(id, {
      $push: { 'rewards.badges': { badgeId, name, description, iconUrl, earnedAt: new Date(), isActive: true } },
    });

    createAuditLog({ level: 'info', category: 'user', message: `Admin awarded badge "${name}" to: ${partner.user.email}`, actor: buildActor(req), metadata: { badgeId, name } });
    res.json({ success: true, message: `Badge "${name}" awarded` });
  });

// PATCH '/admin/:id/rewards/adjust-coins'
export const patchAdminByIdRewardsAdjustCoins = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type, amount, description } = req.body;
    if (!['ADMIN_CREDIT', 'ADMIN_DEBIT'].includes(type)) return res.status(422).json({ success: false, message: 'type must be ADMIN_CREDIT or ADMIN_DEBIT' });
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return res.status(422).json({ success: false, message: 'amount must be positive' });
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid partner ID' });

    const partner = await SoloDriverPartner.findById(id).populate('user', 'name email');
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    if (type === 'ADMIN_DEBIT' && partner.rewards.coinBalance < amt) {
      return res.status(422).json({ success: false, message: `Insufficient coins. Balance: ${partner.rewards.coinBalance}, Requested: ${amt}` });
    }

    partner.rewards.coinBalance += type === 'ADMIN_CREDIT' ? amt : -amt;
    if (type === 'ADMIN_CREDIT') partner.rewards.totalCoinsEarned += amt;
    else                         partner.rewards.totalCoinsRedeem += amt;
    partner.rewards.coinTransactions.push({
      type, amount: amt, balance: partner.rewards.coinBalance,
      description: description || `Admin ${type === 'ADMIN_CREDIT' ? 'credit' : 'debit'}`,
      createdBy: req.user._id,
    });
    await partner.save();

    createAuditLog({ level: 'info', category: 'user', message: `Admin ${type} ${amt} coins for: ${partner.user.email}`, actor: buildActor(req), metadata: { type, amount: amt, description, newBalance: partner.rewards.coinBalance } });
    res.json({ success: true, message: 'Coins adjusted', data: { newBalance: partner.rewards.coinBalance } });
  });

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, next) => {
  log.error('Unhandled route error:', err.message, { path: req.path, method: req.method });

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(422).json({ success: false, message: 'Validation failed', errors });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(409).json({ success: false, message: `Duplicate value for ${field}` });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid value for field: ${err.path}` });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({
    success: false, message: 'An unexpected error occurred.',
    ...(isDev ? { error: err.message, stack: err.stack } : {}),
  });
};
