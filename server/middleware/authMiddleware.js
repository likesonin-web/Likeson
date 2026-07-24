// middleware/authMiddleware.js
import jwt            from 'jsonwebtoken';
import DeviceDetector from 'device-detector-js';

import User              from '../models/User.js';
import PharmacyProfile   from '../models/PharmacyProfile.js';
import TransportPartner  from '../models/TransportPartner.js';
import LabPartnerProfile from '../models/LabPartnerProfile.js'; // <-- Added missing import
import CookieConsent     from '../models/CookieConsent.js';     // <-- Added missing import
import asyncHandler      from '../utils/asyncHandler.js';

const detector = new DeviceDetector();

export const requireCookieConsent = (category) => asyncHandler(async (req, res, next) => {
  const consent = await CookieConsent.findOne({ user: req.user._id }).lean();
  if (!consent?.preferences?.[category]) {
    return res.status(403).json({
      message: `${category} cookies not accepted. Update preferences to use this feature.`,
      code: 'COOKIE_CONSENT_REQUIRED',
    });
  }
  next();
});

// ── getDeviceInfo middleware ──────────────────────────────────────────────────
export const getDeviceInfo = (req, _res, next) => {
  const ua     = req.headers['user-agent'] ?? '';
  const parsed = detector.parse(ua);

  req.deviceInfo = {
    userAgent:  ua,
    ipAddress:  (
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ??
      req.socket?.remoteAddress ??
      'Unknown'
    ),
    deviceName: [
      parsed.device?.brand,
      parsed.device?.model,
      parsed.os?.name,
    ].filter(Boolean).join(' ') || 'Unknown Device',
    platform: (() => {
      const os = (parsed.os?.name ?? '').toLowerCase();
      if (os.includes('android'))                         return 'android';
      if (os.includes('ios') || os.includes('mac'))       return 'ios';
      if (os.includes('windows') || os.includes('linux')) return 'desktop';
      return 'web';
    })(),
    _raw: parsed,
  };
  next();
};

// ── protect middleware ────────────────────────────────────────────────────────
/**
 * protect
 *
 * Verifies the JWT, validates the embedded sessionId against the user's
 * auditSessions array, and guards against blocked accounts.
 *
 * Error codes returned in JSON (used by api.js interceptor for auto-logout):
 *   TOKEN_EXPIRED       — JWT signature verified but past expiry (TokenExpiredError)
 *   TOKEN_INVALID       — JWT malformed / wrong secret (JsonWebTokenError)
 *   SESSION_REVOKED     — sessionId not found in auditSessions (remote sign-out)
 *   USER_NOT_FOUND      — user deleted while token was still valid
 *   ACCOUNT_BLOCKED     — account suspended server-side
 *
 * req.user is augmented with:
 *   req.user.sessionId  — the auditSession _id string from the JWT (or null)
 */
export const protect = asyncHandler(async (req, res, next) => {
  // ── 1. Extract token ───────────────────────────────────────────────────────
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      message: 'Not authenticated. Please log in.',
      code:    'TOKEN_INVALID',
    });
  }

  // ── 2. Verify JWT ──────────────────────────────────────────────────────────
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // TokenExpiredError  → token was valid but has expired
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Your session has expired. Please log in again.',
        code:    'TOKEN_EXPIRED',
      });
    }
    // JsonWebTokenError, NotBeforeError, etc. → token is malformed / tampered
    return res.status(401).json({
      message: 'Invalid token. Please log in again.',
      code:    'TOKEN_INVALID',
    });
  }

  // ── 3. Load user ───────────────────────────────────────────────────────────
  const user = await User.findById(decoded.id).select('+auditSessions');
  if (!user) {
    return res.status(401).json({
      message: 'Account no longer exists.',
      code:    'USER_NOT_FOUND',
    });
  }

  // ── 4. Validate sessionId (new tokens only) ────────────────────────────────
  //    Tokens generated before the sessionId feature was added won't have this
  //    field — skip the check so old tokens keep working until they expire.
  const sessionId = decoded.sessionId ?? null;
  if (sessionId) {
    const sessionExists = (user.auditSessions ?? []).some(
      (s) => s._id.toString() === sessionId
    );
    if (!sessionExists) {
      return res.status(401).json({
        message: 'Session has been revoked. Please log in again.',
        code:    'SESSION_REVOKED',
      });
    }
  }

  console.log('[SocketAuth] decoded.sessionId:', decoded.sessionId);
  console.log('[SocketAuth] user.auditSessions:', user.auditSessions?.map(s => s._id.toString()));
  
  // ── 5. Check block status ──────────────────────────────────────────────────
  if (user.isCurrentlyBlocked) {
    return res.status(401).json({
      message:   'Your account has been suspended.',
      code:      'ACCOUNT_BLOCKED',
      reason:    user.blockReason   ?? null,
      unblockAt: user.unblockAt     ?? null,
    });
  }

  // ── 6. Attach to request ───────────────────────────────────────────────────
  req.user           = user;
  req.user.sessionId = sessionId;

  next();
});

// ── authorize middleware ──────────────────────────────────────────────────────
export const authorize = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
        code:    'FORBIDDEN',
      });
    }
    next();
  };

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY
// ─────────────────────────────────────────────────────────────────────────────

export const attachPharmacyStore = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (req.user.role !== 'pharmacy') {
      return res.status(403).json({
        success:  false,
        message:  'Pharmacy profile required.',
        userRole: req.user.role,
      });
    }

    const profile = await PharmacyProfile.findOne({ user: req.user._id })
      .populate('assignedStore');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Pharmacy profile not found for this user.',
      });
    }
    if (!profile.assignedStore) {
      return res.status(404).json({
        success:   false,
        message:   'No pharmacy store assigned to this profile.',
        profileId: profile._id,
      });
    }

    req.pharmacy = { profile, store: profile.assignedStore };
    next();
  } catch (error) {
    console.error('[attachPharmacyStore] error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading pharmacy store details.',
      error:   process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const pharmacyRoutes = [protect, authorize('pharmacy'), attachPharmacyStore];

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT PARTNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * attachTransportPartnerAgency
 *
 * Queries TransportPartner directly using { user: req.user._id }.
 * Sets req.transportPartner = { agency, agencyUnverified, onboardingIncomplete }
 */
export const attachTransportPartnerAgency = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (req.user.role !== 'transportpartner') {
      return res.status(403).json({
        success:  false,
        message:  'Transport partner role required.',
        userRole: req.user.role,
      });
    }

    const agency = await TransportPartner.findOne({ user: req.user._id })
      .select(
        'partnershipStatus isOnboardingComplete isAvailable ' +
        'businessName rejectionReason drivers ' +
        'vehicles fleetInfo ownerKyc.kycStatus'
      );

    if (!agency) {
      return res.status(404).json({
        success: false,
        message: 'Transport partner business entity not found. Please contact support or complete onboarding.',
      });
    }

    if (agency.partnershipStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your transport agency has been suspended. Please contact support.',
        reason:  agency.rejectionReason || 'Administrative action',
      });
    }

    req.transportPartner = {
      agency,
      agencyUnverified:     agency.partnershipStatus !== 'active',
      onboardingIncomplete: !agency.isOnboardingComplete,
    };

    next();
  } catch (error) {
    console.error('[attachTransportPartnerAgency] error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading transport partner details.',
      error:   process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const transportPartnerRoutes = [
  protect,
  getDeviceInfo,
  authorize('transportpartner'),
  attachTransportPartnerAgency,
];

// ─────────────────────────────────────────────────────────────────────────────
// LAB PARTNER 
// ─────────────────────────────────────────────────────────────────────────────

/**
 * attachLabProfile
 * 
 * Sets req.lab to the LabPartnerProfile document corresponding to the authenticated user.
 * Required for labRoutes.js caching mechanisms to function correctly.
 */
export const attachLabProfile = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    
    if (req.user.role !== 'lab_partner') {
      return res.status(403).json({
        success:  false,
        message:  'Lab partner profile required.',
        userRole: req.user.role,
      });
    }

    const profile = await LabPartnerProfile.findOne({ user: req.user._id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Lab partner profile not found for this user.',
      });
    }

    // Bind the profile to req.lab so your labRoutes.js cache helpers (e.g. `req.lab._id`) work seamlessly
    req.lab = profile;
    next();
  } catch (error) {
    console.error('[attachLabProfile] error:', error);
    res.status(500).json({
      success: false,
      message: 'Error loading lab partner details.',
      error:   process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};