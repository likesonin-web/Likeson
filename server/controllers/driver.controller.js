 

import mongoose  from 'mongoose';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';

import Driver      from '../models/Driver.js';
import SystemLog   from '../models/SystemLog.js';

import { protect, authorize } from '../middleware/authMiddleware.js';


// ═══════════════════════════════════════════════════════════════════════════════
// ── CONSTANTS ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_PAGE_SIZE     = 50;
const DEFAULT_PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════════════════════
// ── UTILITIES ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const parsePagination = (q) => {
  const page  = Math.max(1, parseInt(q.page  ?? 1,  10));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(q.limit ?? DEFAULT_PAGE_SIZE, 10)));
  return { page, limit, skip: (page - 1) * limit };
};

const paginate = (data, total, page, limit) => ({
  success: true,
  data,
  pagination: {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hasNext:    page * limit < total,
    hasPrev:    page > 1,
  },
});

/** Fire-and-forget audit log */
const audit = (payload) => {
  SystemLog.createLog(payload).catch((e) =>
    console.error('[audit] write failed:', e.message)
  );
};

/** Extract actor info from req */
const actor = (req) => ({
  userId:    req.user?._id  ?? null,
  name:      req.user?.name ?? 'system',
  email:     req.user?.email ?? null,
  role:      req.user?.role  ?? 'driver',
  ip:        req.ip          ?? 'unknown',
  userAgent: req.headers['user-agent'] ?? null,
  platform:  req.deviceInfo?.platform  ?? 'unknown',
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── RATE LIMITERS ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Slow down.' },
});

const locationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max:      60,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Location update rate exceeded.' },
});

import asyncHandler from '../utils/asyncHandler.js';

// GET '/profile'
export const getProfile = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .populate('ownerAgency', 'businessName slug partnershipStatus')
      .lean({ virtuals: true });

    if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

    return res.status(200).json({ success: true, data: driver });
  } catch (err) {
    console.error('[GET /profile]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load profile.' });
  }
});

// PATCH '/profile'
export const patchProfile = asyncHandler(async (req, res) => {
    try {
      const ALLOWED = [
        'legalName', 'dateOfBirth', 'gender', 'photoUrl',
        'phone', 'altPhone', 'whatsappNumber',
        'yearsOfExperience', 'languagesSpoken',
        'hasMedicalTransportExp', 'hasAmbulanceExp',
        'emergencyContact',
      ];

      const updates = {};
      for (const key of ALLOWED) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, message: 'No updatable fields provided.' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: updates },
        { new: true, runValidators: true }
      ).lean({ virtuals: true });

      if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

      return res.status(200).json({ success: true, message: 'Profile updated.', data: driver });
    } catch (err) {
      console.error('[PATCH /profile]', err.message);
      if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Phone number already in use.' });
      }
      return res.status(500).json({ success: false, message: 'Profile update failed.' });
    }
  });

// PATCH '/status'
export const patchStatus = asyncHandler(async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id }).select(
        'status isActive isVerified isBlocked isPaused ' +
        'kyc.verificationStatus assignedVehicleSnapshot'
      );

      if (!driver) return res.status(404).json({ success: false, message: 'Driver profile not found.' });

      if (req.body.status === 'Available') {
        if (driver.kyc?.verificationStatus !== 'Verified')
          return res.status(403).json({ success: false, message: 'KYC not verified. Cannot go online.' });
        if (!driver.isActive)
          return res.status(403).json({ success: false, message: 'Account inactive. Contact support.' });
        if (driver.isBlocked)
          return res.status(403).json({ success: false, message: 'Account blocked. Contact support.' });
        if (driver.isPaused)
          return res.status(403).json({ success: false, message: 'Account paused. Contact your agency.' });
        if (!driver.assignedVehicleSnapshot?.registrationNumber)
          return res.status(422).json({ success: false, message: 'No vehicle assigned. Contact your agency.' });
      }

      driver.status = req.body.status;
      await driver.save();

      return res.status(200).json({
        success: true,
        message: `Status set to ${req.body.status}.`,
        data:    { status: driver.status },
      });
    } catch (err) {
      console.error('[PATCH /status]', err.message);
      return res.status(500).json({ success: false, message: 'Status update failed.' });
    }
  });

// PATCH '/location'
export const patchLocation = asyncHandler(async (req, res) => {
    try {
      const { coordinates, heading, speedKmh } = req.body;
      const [lng, lat] = coordinates;

      if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
        return res.status(422).json({
          success: false,
          message: 'Coordinates outside India bounding box.',
        });
      }

      const update = {
        'location.coordinates': [lng, lat],
        'location.updatedAt':   new Date(),
      };
      if (heading  !== undefined) update['location.heading']  = heading;
      if (speedKmh !== undefined) update['location.speedKmh'] = speedKmh;

      // Only update active drivers — silent accept if offline
      await Driver.findOneAndUpdate(
        { user: req.user._id, status: { $in: ['Available', 'On-Trip'] } },
        { $set: update }
      ).select('_id').lean();

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('[PATCH /location]', err.message);
      return res.status(500).json({ success: false, message: 'Location update failed.' });
    }
  });

// GET '/kyc'
export const getKyc = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select(
        'kyc.verificationStatus kyc.aadhaarLast4 kyc.aadhaarDocUrl ' +
        'kyc.drivingLicenceNumber kyc.drivingLicenceExpiry kyc.drivingLicenceDocUrl ' +
        'kyc.licenceClass kyc.psvBadgeNumber kyc.psvBadgeExpiry kyc.psvBadgeDocUrl ' +
        'kyc.panNumber kyc.panDocUrl kyc.rejectionReason kyc.submittedAt kyc.verifiedAt kyc.isVerified'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver.kyc });
  } catch (err) {
    console.error('[GET /kyc]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load KYC.' });
  }
});

// PATCH '/kyc'
export const patchKyc = asyncHandler(async (req, res) => {
    try {
      const driver = await Driver.findOne({ user: req.user._id }).select('kyc');
      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      if (['Verified', 'Under-Review'].includes(driver.kyc.verificationStatus)) {
        return res.status(422).json({
          success: false,
          message: `KYC update blocked — current status: ${driver.kyc.verificationStatus}.`,
        });
      }

      const ALLOWED_KYC = [
        'aadhaarNumber', 'aadhaarDocUrl',
        'drivingLicenceNumber', 'drivingLicenceExpiry', 'drivingLicenceDocUrl', 'licenceClass',
        'psvBadgeNumber', 'psvBadgeExpiry', 'psvBadgeDocUrl',
        'panNumber', 'panDocUrl',
      ];

      const kycUpdate = {};
      for (const key of ALLOWED_KYC) {
        if (req.body.kyc?.[key] !== undefined) {
          kycUpdate[`kyc.${key}`] = req.body.kyc[key];
        }
      }

      if (Object.keys(kycUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No KYC fields provided.' });
      }

      // Reset to Pending for admin re-review
      kycUpdate['kyc.verificationStatus'] = 'Pending';
      kycUpdate['kyc.rejectionReason']    = null;
      kycUpdate['kyc.submittedAt']        = new Date();
      kycUpdate['kyc.isVerified']         = false;

      await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: kycUpdate },
        { runValidators: true }
      );

      audit({
        level: 'info', category: 'kyc',
        message: 'Driver submitted KYC documents',
        actor: actor(req),
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      });

      return res.status(200).json({
        success: true,
        message: 'KYC documents submitted. Pending admin review.',
        data:    { kycStatus: 'Pending' },
      });
    } catch (err) {
      console.error('[PATCH /kyc]', err.message);
      return res.status(500).json({ success: false, message: 'KYC submission failed.' });
    }
  });

// GET '/medical'
export const getMedical = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('medicalFitness')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver.medicalFitness });
  } catch (err) {
    console.error('[GET /medical]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load medical fitness.' });
  }
});

// PATCH '/medical'
export const patchMedical = asyncHandler(async (req, res) => {
    try {
      const ALLOWED_MED = ['certificateNumber', 'issuedBy', 'issuedAt', 'expiryDate', 'documentUrl', 'bloodGroup'];
      const medUpdate = {};
      for (const key of ALLOWED_MED) {
        if (req.body[key] !== undefined) medUpdate[`medicalFitness.${key}`] = req.body[key];
      }

      if (Object.keys(medUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No medical fields provided.' });
      }

      // Auto-derive isValid from expiryDate
      if (medUpdate['medicalFitness.expiryDate']) {
        medUpdate['medicalFitness.isValid'] = new Date(medUpdate['medicalFitness.expiryDate']) > new Date();
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: medUpdate },
        { new: true, runValidators: true }
      ).select('medicalFitness').lean();

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      return res.status(200).json({
        success: true,
        message: 'Medical fitness updated.',
        data:    driver.medicalFitness,
      });
    } catch (err) {
      console.error('[PATCH /medical]', err.message);
      return res.status(500).json({ success: false, message: 'Medical update failed.' });
    }
  });

// GET '/bank'
export const getBank = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('bankDetails.accountLast4 bankDetails.accountHolderName bankDetails.ifscCode bankDetails.bankName bankDetails.upiId bankDetails.isBankVerified')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver.bankDetails });
  } catch (err) {
    console.error('[GET /bank]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load bank details.' });
  }
});

// PATCH '/bank'
export const patchBank = asyncHandler(async (req, res) => {
    try {
      const ALLOWED_BANK = ['accountHolderName', 'accountNumber', 'ifscCode', 'bankName', 'upiId'];
      const bankUpdate = {};

      for (const key of ALLOWED_BANK) {
        if (req.body.bankDetails?.[key] !== undefined) {
          bankUpdate[`bankDetails.${key}`] = req.body.bankDetails[key];
        }
      }

      if (Object.keys(bankUpdate).length === 0) {
        return res.status(400).json({ success: false, message: 'No bank fields provided.' });
      }

      // Account number change → re-verification required
      if (bankUpdate['bankDetails.accountNumber']) {
        bankUpdate['bankDetails.isBankVerified'] = false;
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: bankUpdate },
        { new: true, runValidators: true }
      ).select('bankDetails.accountLast4 bankDetails.bankName bankDetails.isBankVerified').lean();

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      audit({
        level: 'info', category: 'payment',
        message: 'Driver updated bank details',
        actor: actor(req),
        request: { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      });

      return res.status(200).json({
        success: true,
        message: 'Bank details updated. Verification pending.',
        data: {
          accountLast4:   driver.bankDetails.accountLast4,
          bankName:       driver.bankDetails.bankName,
          isBankVerified: driver.bankDetails.isBankVerified,
        },
      });
    } catch (err) {
      console.error('[PATCH /bank]', err.message);
      return res.status(500).json({ success: false, message: 'Bank update failed.' });
    }
  });

// GET '/earnings'
export const getEarnings = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select(
        'performance.totalEarnings performance.totalRidesCompleted ' +
        'performance.monthlyRides performance.totalRidesCancelled ' +
        'performance.avgPickupTimeMinutes performance.totalDistanceKm ' +
        'rewards.coinBalance rewards.totalCoinsEarned rewards.totalCoinsRedeem rewards.tier'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver });
  } catch (err) {
    console.error('[GET /earnings]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load earnings.' });
  }
});

// GET '/coin-transactions'
export const getCoinTransactions = asyncHandler(async (req, res) => {
    try {
      const { page, limit, skip } = parsePagination(req.query);
      const typeFilter = req.query.type;

      const driver = await Driver.findOne({ user: req.user._id })
        .select('rewards.coinBalance rewards.tier rewards.coinTransactions')
        .lean();

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      let txns = (driver.rewards?.coinTransactions ?? []).reverse(); // newest first
      if (typeFilter) txns = txns.filter((t) => t.type === typeFilter);

      const total = txns.length;
      const page_ = txns.slice(skip, skip + limit);

      return res.status(200).json({
        success: true,
        data: {
          coinBalance:  driver.rewards.coinBalance,
          tier:         driver.rewards.tier,
          transactions: page_,
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext:    skip + limit < total,
          hasPrev:    page > 1,
        },
      });
    } catch (err) {
      console.error('[GET /coin-transactions]', err.message);
      return res.status(500).json({ success: false, message: 'Failed to load transactions.' });
    }
  });

// GET '/badges'
export const getBadges = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('rewards.badges rewards.tier rewards.tierUpdatedAt')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver.rewards });
  } catch (err) {
    console.error('[GET /badges]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load badges.' });
  }
});

// GET '/performance'
export const getPerformance = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('performance rewards.tier rewards.badges driverCode')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    return res.status(200).json({ success: true, data: driver });
  } catch (err) {
    console.error('[GET /performance]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load performance.' });
  }
});

// GET '/onboarding'
export const getOnboarding = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select(
        'onboarding kyc.verificationStatus medicalFitness.isValid ' +
        'bankDetails.isBankVerified assignedVehicleSnapshot profileCompletionPercent'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    const checklist = {
      profileComplete:  driver.profileCompletionPercent >= 80,
      kycVerified:      driver.kyc?.verificationStatus === 'Verified',
      medicalValid:     driver.medicalFitness?.isValid === true,
      bankLinked:       !!driver.bankDetails?.isBankVerified,
      vehicleAssigned:  !!driver.assignedVehicleSnapshot?.registrationNumber,
      agreedToTerms:    !!driver.onboarding?.agreedToTermsAt,
    };

    const isOnboardingComplete = Object.values(checklist).every(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        onboarding:               driver.onboarding,
        checklist,
        profileCompletionPercent: driver.profileCompletionPercent,
        isOnboardingComplete,
      },
    });
  } catch (err) {
    console.error('[GET /onboarding]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load onboarding.' });
  }
});

// POST '/onboarding/accept-terms'
export const postOnboardingAcceptTerms = asyncHandler(async (req, res) => {
    try {
      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id, 'onboarding.agreedToTermsAt': null },
        {
          $set: {
            'onboarding.agreedToTermsAt': new Date(),
            'onboarding.agreedToTermsIp': req.ip,
          },
        },
        { new: true }
      ).select('onboarding');

      if (!driver) {
        // Already accepted — idempotent OK
        return res.status(200).json({ success: true, message: 'Terms already accepted.' });
      }

      audit({
        level: 'info', category: 'user',
        message: 'Driver accepted terms and conditions',
        actor: actor(req),
        request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
        metadata: { ip: req.ip, at: driver.onboarding.agreedToTermsAt },
      });

      return res.status(200).json({
        success: true,
        message: 'Terms accepted.',
        data:    { acceptedAt: driver.onboarding.agreedToTermsAt },
      });
    } catch (err) {
      console.error('[POST /onboarding/accept-terms]', err.message);
      return res.status(500).json({ success: false, message: 'Failed to record terms acceptance.' });
    }
  });

// PATCH '/notification-preferences'
export const patchNotificationPreferences = asyncHandler(async (req, res) => {
    try {
      const { smsAlerts, whatsappAlerts, pushNotifications } = req.body;
      const update = {};
      if (smsAlerts        !== undefined) update['notifPrefs.smsAlerts']        = smsAlerts;
      if (whatsappAlerts   !== undefined) update['notifPrefs.whatsappAlerts']   = whatsappAlerts;
      if (pushNotifications !== undefined) update['notifPrefs.pushNotifications'] = pushNotifications;

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ success: false, message: 'No preferences provided.' });
      }

      const driver = await Driver.findOneAndUpdate(
        { user: req.user._id },
        { $set: update },
        { new: true }
      ).select('notifPrefs').lean();

      if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

      return res.status(200).json({
        success: true,
        message: 'Notification preferences updated.',
        data:    driver.notifPrefs,
      });
    } catch (err) {
      console.error('[PATCH /notification-preferences]', err.message);
      return res.status(500).json({ success: false, message: 'Update failed.' });
    }
  });

// GET '/vehicle'
export const getVehicle = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('assignedVehicleId assignedVehicleSnapshot ownerAgency')
      .populate('ownerAgency', 'businessName slug ownerPhone')
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    if (!driver.assignedVehicleSnapshot?.registrationNumber) {
      return res.status(200).json({
        success: true,
        data:    null,
        message: 'No vehicle assigned.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        vehicleId:       driver.assignedVehicleId,
        snapshot:        driver.assignedVehicleSnapshot,
        agency:          driver.ownerAgency,
      },
    });
  } catch (err) {
    console.error('[GET /vehicle]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load vehicle.' });
  }
});

// GET '/agency'
export const getAgency = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select('ownerAgency')
      .populate(
        'ownerAgency',
        'businessName slug ownerName ownerPhone ownerEmail partnershipStatus ' +
        'registeredAddress.city registeredAddress.state availabilityHours notifications'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    if (!driver.ownerAgency) {
      return res.status(200).json({ success: true, data: null, message: 'No agency linked.' });
    }

    return res.status(200).json({ success: true, data: driver.ownerAgency });
  } catch (err) {
    console.error('[GET /agency]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load agency info.' });
  }
});

// GET '/compliance'
export const getCompliance = asyncHandler(async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id })
      .select(
        'kyc.drivingLicenceNumber kyc.drivingLicenceExpiry kyc.verificationStatus ' +
        'kyc.psvBadgeNumber kyc.psvBadgeExpiry ' +
        'medicalFitness.expiryDate medicalFitness.isValid medicalFitness.bloodGroup'
      )
      .lean();

    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found.' });

    const now  = new Date();
    const soon = new Date(Date.now() + 30 * 86400000);

    const expiry = (date) => {
      if (!date) return { status: 'not-set', daysLeft: null };
      const d = new Date(date);
      if (d < now)  return { status: 'expired',  daysLeft: 0 };
      if (d < soon) return { status: 'expiring', daysLeft: Math.ceil((d - now) / 86400000) };
      return         { status: 'valid',   daysLeft: Math.ceil((d - now) / 86400000) };
    };

    return res.status(200).json({
      success: true,
      data: {
        kycStatus:         driver.kyc.verificationStatus,
        drivingLicence: {
          number:  driver.kyc.drivingLicenceNumber,
          expiry:  driver.kyc.drivingLicenceExpiry,
          ...expiry(driver.kyc.drivingLicenceExpiry),
        },
        psvBadge: {
          number:  driver.kyc.psvBadgeNumber,
          expiry:  driver.kyc.psvBadgeExpiry,
          ...expiry(driver.kyc.psvBadgeExpiry),
        },
        medicalFitness: {
          expiry:     driver.medicalFitness?.expiryDate,
          isValid:    driver.medicalFitness?.isValid,
          bloodGroup: driver.medicalFitness?.bloodGroup,
          ...expiry(driver.medicalFitness?.expiryDate),
        },
        hasExpiringCompliance: (
          expiry(driver.kyc.drivingLicenceExpiry).status === 'expiring' ||
          expiry(driver.kyc.psvBadgeExpiry).status       === 'expiring' ||
          expiry(driver.medicalFitness?.expiryDate).status === 'expiring'
        ),
      },
    });
  } catch (err) {
    console.error('[GET /compliance]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to load compliance.' });
  }
});

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, _next) => {
  console.error('[driverSelfRouter error]', {
    message: err.message,
    stack:   err.stack,
    path:    req.originalUrl,
    method:  req.method,
  });

  audit({
    level: 'error', category: 'api',
    message: `Unhandled error in driverSelfRouter: ${err.message}`,
    actor: actor(req),
    request: { method: req.method, path: req.originalUrl, statusCode: 500 },
    details: err.stack,
  });

  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred.',
    ...(process.env.NODE_ENV === 'development' ? { error: err.message } : {}),
  });
};
