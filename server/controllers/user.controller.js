import bcrypt from 'bcryptjs';
import passport from 'passport';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { body, param, query, validationResult } from 'express-validator';
import axios from 'axios';

// ── Models ────────────────────────────────────────────────────────────────────
import User, {
  REFERRAL_INVITER_COINS,
  REFERRAL_INVITEE_COINS,
  COINS_PER_RUPEE,
} from '../models/User.js';
import Wallet from '../models/Wallet.js';
import CustomerProfile from '../models/CustomerProfile.js';
import DoctorProfile from '../models/DoctorProfile.js';
import DriverProfile from '../models/Driver.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import PharmacyProfile from '../models/PharmacyProfile.js';
import TransportPartner from '../models/TransportPartner.js';
import CookieConsent from '../models/CookieConsent.js'; // Added missing import

// ── Middleware / Utils ────────────────────────────────────────────────────────
import { protect, authorize, getDeviceInfo } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateToken } from '../utils/generateToken.js';
import { finaliseLogin } from '../utils/finaliseLogin.js';

// ── Caching ───────────────────────────────────────────────────────────────────
import cache from '../middleware/cache.js';
import {
  invalidateUserCache,
  invalidatePattern,
} from '../utils/cacheInvalidation.js';

// ── Notifications ─────────────────────────────────────────────────────────────
import sendEmail from '../utils/sendEmail.js';
import sendSms from '../services/Sendsms.js';
import log from '../utils/logger.js';

import {
  otpTemplate,
  welcomeTemplate,
  passwordResetTemplate,
  passwordChangedTemplate,
} from '../utils/emailTemplates.js';

import {
  otpSms,
  welcomeSms,
  newLoginAlertSms,
  passwordResetOtpSms,
  passwordChangedSms,
  accountBlockedSms,
  accountUnblockedSms,
} from '../utils/Smstemplates.js';


// ── Local Helpers (FIXES FOR MISSING DEFINITIONS) ─────────────────────────────

const buildLoginFilter = (identifier) => {
  if (!identifier) return null;
  const idStr = identifier.trim().toLowerCase();
  // If the identifier contains an '@', treat it as an email; otherwise, a phone number.
  if (idStr.includes('@')) return { email: idStr };
  return { phone: identifier.trim() };
};

const generateOtp = () => {
  // Generates a random 6-digit OTP
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getProfileModel = (role) => {
  const models = {
    customer: CustomerProfile,
    doctor: DoctorProfile,
    driver: DriverProfile,
    careassistant: CareAssistantProfile,
    pharmacy: PharmacyProfile,
    transportpartner: TransportPartner,
  };
  return models[role] || null;
};

const getOrCreateWallet = async (userId, session) => {
  const options = session ? { session } : {};
  let wallet = await Wallet.findOne({ user: userId }, null, options);
  if (!wallet) {
    const [newWallet] = await Wallet.create([{ user: userId, balance: 0 }], options);
    wallet = newWallet;
  }
  return wallet;
};

const upsertDeviceToken = (user, { token, platform, deviceName, ipAddress }) => {
  user.deviceTokens = user.deviceTokens || [];
  const existingIndex = user.deviceTokens.findIndex((t) => t.token === token);
  
  if (existingIndex > -1) {
    user.deviceTokens[existingIndex].platform = platform;
    user.deviceTokens[existingIndex].deviceName = deviceName;
    user.deviceTokens[existingIndex].ipAddress = ipAddress;
    user.deviceTokens[existingIndex].lastUsedAt = new Date();
  } else {
    user.deviceTokens.push({ token, platform, deviceName, ipAddress, lastUsedAt: new Date() });
  }
};

// Notification Dispatchers
const dispatchWelcome = async ({ user }) => {
  try {
    if (user.email) await sendEmail({ email: user.email, subject: 'Welcome to Likeson!', html: welcomeTemplate({ name: user.name }) });
    if (user.phone) await sendSms({ to: user.phone, message: welcomeSms({ name: user.name }) });
  } catch (err) { log.error('Dispatch Welcome Error', { err: err.message }); }
};

const dispatchOtp = async ({ user, otpCode, purpose, subject = 'Your Verification OTP' }) => {
  try {
    if (user.email) await sendEmail({ email: user.email, subject, html: otpTemplate({ header: 'OTP Verification', title: subject, body: `Your verification code is ${otpCode}`, otpCode }) });
    if (user.phone) await sendSms({ to: user.phone, message: otpSms({ otpCode, purpose }) });
  } catch (err) { log.error('Dispatch OTP Error', { err: err.message }); }
};

const dispatchPasswordResetOtp = async ({ user, otpCode }) => {
  try {
    if (user.email) await sendEmail({ email: user.email, subject: 'Likeson Password Reset', html: passwordResetTemplate({ name: user.name, otpCode }) });
    if (user.phone) await sendSms({ to: user.phone, message: passwordResetOtpSms({ otpCode }) });
  } catch (err) { log.error('Dispatch Password Reset Error', { err: err.message }); }
};

const dispatchPasswordChanged = async ({ user }) => {
  try {
    if (user.email) await sendEmail({ email: user.email, subject: 'Password Changed Successfully', html: passwordChangedTemplate({ header: 'PASSWORD UPDATED', title: 'Security Alert', body: 'Your password was successfully updated.', buttonText: 'Login Now', buttonLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login` }) });
    if (user.phone) await sendSms({ to: user.phone, message: passwordChangedSms({ name: user.name }) });
  } catch (err) { log.error('Dispatch Password Changed Error', { err: err.message }); }
};


// ─────────────────────────────────────────────────────────────────────────────


// POST '/signup'
export const postSignup = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, referralCode } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const conflict = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        ...(phone ? [{ phone }] : []),
      ],
    }).session(session);

    if (conflict) {
      await session.abortTransaction();
      return res.status(409).json({ message: 'Account with this email or phone already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [newUser] = await User.create(
      [{
        name,
        email,
        phone: phone || undefined,
        role: role || 'customer',
        password: hashedPassword,
      }],
      { session }
    );

    const ProfileModel = getProfileModel(newUser.role);
    if (ProfileModel) {
      await ProfileModel.create([{ user: newUser._id }], { session });
    }

    await Wallet.create([{ user: newUser._id, balance: 0 }], { session });

    let inviterRewarded = false;
    let inviterId = null;

    if (referralCode) {
      const code = referralCode.trim().toUpperCase();
      const inviter = await User.findOne({ referralCode: code }).session(session);

      if (inviter && !inviter._id.equals(newUser._id)) {
        inviter.coins += REFERRAL_INVITER_COINS;
        inviter.coinsEarned += REFERRAL_INVITER_COINS;
        inviter.referralHistory.push({
          referredUser: newUser._id,
          coinsAwarded: REFERRAL_INVITER_COINS,
        });
        await inviter.save({ session });

        newUser.referredBy = inviter._id;
        newUser.coins += REFERRAL_INVITEE_COINS;
        newUser.coinsEarned += REFERRAL_INVITEE_COINS;
        await newUser.save({ session });

        inviterRewarded = true;
        inviterId = inviter._id;
      }
    }

    await session.commitTransaction();

    if (inviterRewarded && inviterId) {
      await invalidateUserCache(inviterId);
    }

    log.info('User signed up', { userId: newUser._id, role: newUser.role, referralApplied: inviterRewarded });
    dispatchWelcome({ user: newUser }).catch(() => {});

    return res.status(201).json({
      status: 'success',
      token: generateToken(newUser._id),
      user: newUser,
      ...(inviterRewarded && {
        referral: {
          message: `Referral applied! You received ${REFERRAL_INVITEE_COINS} coins (₹${(REFERRAL_INVITEE_COINS / COINS_PER_RUPEE).toFixed(2)}).`,
          coinsReceived: REFERRAL_INVITEE_COINS,
          coinsInRupees: +(REFERRAL_INVITEE_COINS / COINS_PER_RUPEE).toFixed(2),
        },
      }),
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// POST '/login'
export const postLogin = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;

  const filter = buildLoginFilter(identifier);
  if (!filter) return res.status(400).json({ message: 'Invalid identifier.' });

  const user = await User.findOne(filter).select('+password +otp +otpExpires +auditSessions');
  if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    log.warn('Failed login', { filter, ip: req.deviceInfo?.ipAddress });
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  if (user.isCurrentlyBlocked) {
    return res.status(403).json({
      message: 'Account suspended.',
      reason: user.blockReason,
      unblockAt: user.unblockAt,
    });
  }

  const { token, sessionId } = await finaliseLogin(user, req);

  log.info('Login success', { userId: user._id });

  return res.json({
    status: 'success',
    token,
    sessionId,
    user,
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  });
});

// POST '/logout'
export const postLogout = asyncHandler(async (req, res) => {
  const ipAddress = req.deviceInfo?.ipAddress ?? 'Unknown';
  const userAgent = req.deviceInfo?.userAgent ?? 'Unknown';
  const sessionId = req.user.sessionId;

  const userDoc = await User.findById(req.user._id).select('auditSessions');
  const remaining = (userDoc?.auditSessions ?? []).filter((s) => {
    if (sessionId) return s._id.toString() !== sessionId;
    return !(s.ipAddress === ipAddress && s.userAgent === userAgent);
  });
  const goOffline = remaining.length === 0;

  const pullFilter = sessionId
    ? { auditSessions: { _id: new mongoose.Types.ObjectId(sessionId) } }
    : { auditSessions: { ipAddress, userAgent } };

  await User.findByIdAndUpdate(req.user._id, {
    ...(goOffline && { $set: { isOnline: false, lastseen: new Date() } }),
    lastActiveAt: new Date(),
    $pull: {
      ...pullFilter,
      deviceTokens: { ipAddress },
    },
  });

  await invalidateUserCache(req.user._id);

  log.info('Logout', { userId: req.user._id, sessionId });
  return res.json({ status: 'success', message: 'Logged out successfully.' });
});

// POST '/otp-request'
export const postOtpRequest = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase() });
  if (user) {
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60_000);
    await user.save();
    await dispatchOtp({ user, otpCode: otp, purpose: 'verification' });
  }
  return res.json({ message: 'If that account exists, an OTP has been sent.' });
});

// POST '/verify-email'
export const postVerifyEmail = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'email and otp are required.' });

  const user = await User.findOne({
    email: email.toLowerCase(), otp, otpExpires: { $gt: Date.now() },
  }).select('+otp +otpExpires');

  if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });

  user.isEmailVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();
  await invalidateUserCache(user._id);

  return res.json({ message: 'Email verified successfully.' });
});

// POST '/request-otp-login'
export const postRequestOtpLogin = asyncHandler(async (req, res) => {
  const filter = buildLoginFilter(req.body.identifier);
  const user = filter ? await User.findOne(filter) : null;
  if (user) {
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60_000);
    await user.save();
    await dispatchOtp({ user, otpCode: otp, purpose: 'login', subject: 'Your Likeson Login OTP' });
  }
  return res.json({ message: 'If that account exists, an OTP has been sent.' });
});

// POST '/otp-login'
export const postOtpLogin = asyncHandler(async (req, res) => {
  const { identifier, otp } = req.body;
  const filter = buildLoginFilter(identifier);
  if (!filter) return res.status(400).json({ message: 'Invalid identifier.' });

  const user = await User.findOne({
    ...filter, otp, otpExpires: { $gt: Date.now() },
  }).select('+otp +otpExpires +auditSessions');

  if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });
  if (user.isCurrentlyBlocked)
    return res.status(403).json({ message: 'Account suspended.', reason: user.blockReason });

  user.isEmailVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;

  const { token, sessionId } = await finaliseLogin(user, req);

  log.info('OTP login', { userId: user._id });

  return res.json({
    status: 'success',
    token,
    sessionId,
    user: {
      _id: user._id, name: user.name, email: user.email, phone: user.phone,
      role: user.role, avatar: user.avatar, isEmailVerified: user.isEmailVerified,
      isOnline: true, coins: user.coins,
      coinsInRupees: +(user.coins / COINS_PER_RUPEE).toFixed(2),
    },
  });
});

// POST '/forgot-password'
export const postForgotPassword = asyncHandler(async (req, res) => {
  const filter = buildLoginFilter(req.body.identifier ?? req.body.email);
  const user = filter ? await User.findOne(filter) : null;
  if (user) {
    const otp = generateOtp();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60_000);
    await user.save();
    await dispatchPasswordResetOtp({ user, otpCode: otp });
  }
  return res.json({ message: 'If that account exists, a reset code has been sent.' });
});

// POST '/reset-password'
export const postResetPassword = asyncHandler(async (req, res) => {
  const { email, identifier, otp, newPassword } = req.body;
  const id = identifier ?? email;
  if (!id || !otp || !newPassword)
    return res.status(400).json({ message: 'identifier, otp, and newPassword required.' });
  if (newPassword.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters.' });

  const filter = buildLoginFilter(id);
  const user = filter
    ? await User.findOne({ ...filter, otp, otpExpires: { $gt: Date.now() } })
                .select('+otp +otpExpires')
    : null;

  if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });

  user.password = await bcrypt.hash(newPassword, 12);
  user.otp = undefined;
  user.otpExpires = undefined;
  user.passwordChangedAt = new Date();
  user.isOnline = false;
  user.auditSessions = [];
  user.deviceTokens = [];
  await user.save();
  await invalidateUserCache(user._id);

  log.info('Password reset', { userId: user._id });
  dispatchPasswordChanged({ user }).catch(() => {});
  return res.json({ message: 'Password reset. Please log in again.' });
});

// GET '/profile'
export const getProfile = asyncHandler(async (req, res) => {
  User.findByIdAndUpdate(req.user._id, { lastActiveAt: new Date() }).exec().catch(() => {});
  const user = await User.findById(req.user._id).populate('profile').lean({ virtuals: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
  return res.json({ success: true, data: user });
});

// PUT '/profile'
export const putProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar, roleProfileData } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (avatar !== undefined) user.avatar = avatar;
  user.lastActiveAt = new Date();
  await user.save();

  let updatedProfile = null;
  if (roleProfileData) {
    const M = getProfileModel(user.role);
    if (M) {
      updatedProfile = await M.findOneAndUpdate(
        { user: user._id }, { $set: roleProfileData },
        { new: true, runValidators: true, upsert: true }
      );
    }
  }

  await invalidateUserCache(user._id);
  return res.json({ success: true, message: 'Profile updated.', data: { user, profile: updatedProfile } });
});

// PUT '/change-password'
export const putChangePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    return res.status(400).json({ message: 'oldPassword and newPassword required.' });
  if (newPassword.length < 8)
    return res.status(400).json({ message: 'Min 8 characters.' });

  const user = await User.findById(req.user._id).select('+password');
  if (!(await bcrypt.compare(oldPassword, user.password)))
    return res.status(401).json({ message: 'Current password incorrect.' });

  user.password = await bcrypt.hash(newPassword, 12);
  user.passwordChangedAt = new Date();
  await user.save();
  await invalidateUserCache(user._id);

  log.info('Password changed', { userId: user._id });
  dispatchPasswordChanged({ user }).catch(() => {});
  return res.json({ message: 'Password updated.' });
});

// DELETE '/delete-account'
export const deleteDeleteAccount = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const M = getProfileModel(req.user.role);
    if (M) await M.findOneAndDelete({ user: req.user._id }).session(session);
    await Wallet.findOneAndDelete({ user: req.user._id }).session(session);
    await User.findByIdAndDelete(req.user._id).session(session);
    await session.commitTransaction();
    await invalidateUserCache(req.user._id);
    await invalidatePattern('GET:/api/users/admin/users*');
    log.info('Account deleted', { userId: req.user._id });
    return res.json({ message: 'Account permanently deleted.' });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// GET '/sessions'
export const getSessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('auditSessions deviceTokens').lean();
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const sessions = (user.auditSessions ?? [])
    .slice()
    .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt));

  const deviceTokenIPs = new Set((user.deviceTokens ?? []).map(t => t.ipAddress));
  const enriched = sessions.map((s) => ({
    ...s,
    hasPushToken: deviceTokenIPs.has(s.ipAddress),
  }));

  return res.json({ status: 'success', count: enriched.length, data: enriched });
});

// DELETE '/sessions/:sessionId'
export const deleteSessionsBySessionId = asyncHandler(async (req, res) => {
  const sessionId = new mongoose.Types.ObjectId(req.params.sessionId);

  const userDoc = await User.findById(req.user._id).select('auditSessions deviceTokens');
  if (!userDoc) return res.status(404).json({ message: 'User not found.' });

  const targetSession = (userDoc.auditSessions ?? []).find(
    (s) => s._id.equals(sessionId)
  );

  if (!targetSession) {
    return res.status(404).json({ message: 'Session not found.' });
  }

  const sessionIp = targetSession.ipAddress;
  const remainingSessions = (userDoc.auditSessions ?? []).filter(
    (s) => !s._id.equals(sessionId)
  );
  const goOffline = remainingSessions.length === 0;

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $pull: {
        auditSessions: { _id: sessionId },
        deviceTokens: { ipAddress: sessionIp },
      },
      ...(goOffline && { $set: { isOnline: false, lastseen: new Date() } }),
    },
    { new: true }
  ).select('auditSessions');

  await invalidateUserCache(req.user._id);

  log.info('Session + device tokens revoked', {
    userId: req.user._id,
    sessionId: req.params.sessionId,
    ip: sessionIp,
  });

  return res.json({
    message: 'Session revoked. Device has been signed out.',
    sessionId: req.params.sessionId,
    deviceSignedOut: true,
  });
});

// DELETE '/sessions'
export const deleteSessions = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $set: {
      auditSessions: [],
      deviceTokens: [],
      isOnline: false,
      lastseen: new Date(),
    },
  });

  await invalidateUserCache(req.user._id);

  return res.json({
    message: 'All sessions revoked. You are signed out on all devices.',
    devicesSignedOut: true,
  });
});

// POST '/device-tokens'
export const postDeviceTokens = asyncHandler(async (req, res) => {
  const { token, platform, deviceName } = req.body;
  if (!token || !platform)
    return res.status(400).json({ message: 'token and platform required.' });
  if (!['android', 'ios', 'web', 'desktop'].includes(platform))
    return res.status(400).json({ message: 'platform must be android | ios | web | desktop.' });

  const user = await User.findById(req.user._id).select('deviceTokens');
  if (!user) return res.status(404).json({ message: 'User not found.' });

  upsertDeviceToken(user, {
    token,
    platform,
    deviceName: deviceName ?? req.deviceInfo?.deviceName ?? 'Unknown',
    ipAddress: req.deviceInfo?.ipAddress,
  });

  await user.save();
  await invalidateUserCache(req.user._id);

  return res.json({ message: 'Device token registered.' });
});

// GET '/device-tokens'
export const getDeviceTokens = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('deviceTokens').lean();
  if (!user) return res.status(404).json({ message: 'User not found.' });

  return res.json({
    status: 'success',
    count: (user.deviceTokens ?? []).length,
    data: user.deviceTokens ?? [],
  });
});

// DELETE '/device-tokens/:token'
export const deleteDeviceTokensByToken = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { deviceTokens: { token: req.params.token } } }
  );
  await invalidateUserCache(req.user._id);
  return res.json({ message: 'Device token removed.' });
});

// POST '/heartbeat'
export const postHeartbeat = asyncHandler(async (req, res) => {
  const sessionId = req.user.sessionId;
  const update = { isOnline: true, lastActiveAt: new Date() };

  if (sessionId) {
    await User.findOneAndUpdate(
      { _id: req.user._id, 'auditSessions._id': new mongoose.Types.ObjectId(sessionId) },
      { $set: { ...update, 'auditSessions.$.lastActiveAt': new Date() } }
    );
  } else {
    await User.findByIdAndUpdate(req.user._id, update);
  }

  return res.json({ ok: true });
});

// GET '/google'
export const getGoogle = asyncHandler(passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

// GET '/google/callback'
export const getGoogleCallback = asyncHandler(async (req, res) => {
  const user = req.user;
  const frontendBaseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (!user) {
    return res.redirect(`${frontendBaseUrl}/auth-error?reason=no_user`);
  }

  const fullUser = await User.findById(user._id).select('+auditSessions +deviceTokens');
  if (!fullUser) {
    return res.redirect(`${frontendBaseUrl}/auth-error?reason=no_user`);
  }

  const { token, sessionId } = await finaliseLogin(fullUser, req);
  log.info('Google OAuth login', { userId: fullUser._id });

  try {
    const url = new URL(`${frontendBaseUrl}/auth-success`);
    url.searchParams.set('token', token);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('role', fullUser.role);

    return res.redirect(url.toString());
  } catch (error) {
    log.error('Invalid FRONTEND_URL environment variable', { error: error.message });
    return res.status(500).json({ message: 'Server configuration error regarding frontend URL.' });
  }
});

// PATCH '/update-location-by-address'
export const patchUpdateLocationByAddress = asyncHandler(async (req, res) => {
  const { address } = req.body;
  if (!address?.trim()) return res.status(400).json({ message: 'Address required.' });

  const key = process.env.GOOGLE_MAPS_KEY;
  if (!key) return res.status(500).json({ message: 'Geocoding not configured.' });

  const geoRes = await axios.get(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  );

  if (geoRes.data.status !== 'OK' || !geoRes.data.results?.length)
    return res.status(400).json({ message: 'Location not found.', geocodeStatus: geoRes.data.status });

  const { lat, lng } = geoRes.data.results[0].geometry.location;
  const formattedAddress = geoRes.data.results[0].formatted_address;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { 'location.type': 'Point', 'location.coordinates': [lng, lat], lastKnownAddress: formattedAddress, lastActiveAt: new Date() } },
    { new: true, runValidators: true }
  );

  await invalidateUserCache(req.user._id);
  return res.json({ status: 'success', data: { address: formattedAddress, coordinates: { lat, lng }, user } });
});

// PATCH '/update-location'
export const patchUpdateLocation = asyncHandler(async (req, res) => {
  const { lat, lng, address } = req.body;
  const upd = { 'location.type': 'Point', 'location.coordinates': [parseFloat(lng), parseFloat(lat)], lastActiveAt: new Date() };
  if (address) upd.lastKnownAddress = address;

  const user = await User.findByIdAndUpdate(req.user._id, { $set: upd }, { new: true });
  await invalidateUserCache(req.user._id);
  return res.json({ success: true, data: { coordinates: { lat, lng }, user } });
});

// GET '/wallet'
export const getWallet = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip = (page - 1) * limit;

  const wallet = await getOrCreateWallet(req.user._id);
  const sorted = [...wallet.transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const total = sorted.length;
  const paginated = sorted.slice(skip, skip + limit);

  return res.json({
    status: 'success',
    data: {
      balance: wallet.balance, currency: wallet.currency, isActive: wallet.isActive,
      withdrawableBalance: wallet.withdrawableBalance, lockedBalance: wallet.lockedBalance,
      availableBalance: wallet.availableBalance,
      transactions: paginated,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    },
  });
});

// POST '/wallet/redeem-coins'
export const postWalletRedeemCoins = asyncHandler(async (req, res) => {
  const coinsToRedeem = parseInt(req.body.coins, 10);
  const rupeesEarned = +(coinsToRedeem / COINS_PER_RUPEE).toFixed(2);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(req.user._id).session(session);
    if (!user) { await session.abortTransaction(); return res.status(404).json({ message: 'User not found.' }); }

    if ((user.coins ?? 0) < coinsToRedeem) {
      await session.abortTransaction();
      return res.status(400).json({ message: `Insufficient coins. You have ${user.coins ?? 0} coins.` });
    }

    user.coins -= coinsToRedeem;
    user.coinsRedeemed += coinsToRedeem;
    await user.save({ session });

    const wallet = await getOrCreateWallet(user._id, session);
    const balanceBefore = wallet.balance;
    const balanceAfter = +(balanceBefore + rupeesEarned).toFixed(2);

    wallet.balance = balanceAfter;
    wallet.transactions.push({
      type: 'Credit', amount: rupeesEarned, purpose: 'Coin_Conversion',
      description: `${coinsToRedeem} coins redeemed → ₹${rupeesEarned}`,
      balanceBefore, balanceAfter, status: 'Success',
    });
    await wallet.save({ session });
    await session.commitTransaction();
    await invalidateUserCache(user._id);

    return res.json({
      status: 'success',
      message: `${coinsToRedeem} coins redeemed successfully. ₹${rupeesEarned} added to your wallet.`,
      data: {
        coinsRedeemed: coinsToRedeem,
        rupeesEarned,
        walletBalance: balanceAfter,
        remainingCoins: user.coins,
        remainingRupees: +(user.coins / COINS_PER_RUPEE).toFixed(2),
        totalCoinsRedeemed: user.coinsRedeemed,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// GET '/referral/my-code'
export const getReferralMyCode = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('referralCode coins coinsEarned coinsRedeemed referralHistory referredBy')
    .populate('referralHistory.referredUser', 'name email avatar')
    .populate('referredBy', 'name email avatar');

  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  return res.json({
    success: true,
    data: {
      referralCode: user.referralCode,
      totalReferrals: user.referralHistory.length,
      coins: user.coins,
      coinsInRupees: +(user.coins / COINS_PER_RUPEE).toFixed(2),
      coinsEarned: user.coinsEarned,
      coinsRedeemed: user.coinsRedeemed,
      referredBy: user.referredBy ?? null,
      referralHistory: user.referralHistory,
    },
  });
});

// GET '/referral/validate'
export const getReferralValidate = asyncHandler(async (req, res) => {
  const code = (req.query.code ?? '').toString().toUpperCase().trim();
  if (!code || code.length < 6 || code.length > 12)
    return res.status(400).json({ success: false, data: { valid: false }, message: 'Code must be between 6 and 12 characters.' });

  const inviter = await User.findOne({ referralCode: code }).select('name referralCode').lean();
  if (!inviter)
    return res.status(404).json({ success: false, data: { valid: false }, message: 'Referral code not found.' });

  const parts = (inviter.name ?? '').trim().split(/\s+/);
  const displayName = parts.length > 1
    ? `${parts[0]} ${parts.at(-1).charAt(0).toUpperCase()}.`
    : (parts[0] ?? 'A friend');

  return res.status(200).json({
    success: true,
    data: {
      valid: true,
      referrerName: displayName,
      bonusCoins: REFERRAL_INVITEE_COINS,
      bonusRupees: `₹${(REFERRAL_INVITEE_COINS / COINS_PER_RUPEE).toFixed(2)}`,
    },
  });
});

// POST '/referral/apply'
export const postReferralApply = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const newUser = await User.findById(req.user._id).session(session);
    if (!newUser) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'User not found.' }); }
    if (newUser.referredBy) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'Referral code already applied.' }); }

    const code = req.body.referralCode.trim().toUpperCase();
    const inviter = await User.findOne({ referralCode: code }).session(session);
    if (!inviter) { await session.abortTransaction(); return res.status(404).json({ success: false, message: 'Invalid referral code.' }); }
    if (inviter._id.equals(newUser._id)) { await session.abortTransaction(); return res.status(400).json({ success: false, message: 'You cannot use your own referral code.' }); }

    inviter.coins += REFERRAL_INVITER_COINS;
    inviter.coinsEarned += REFERRAL_INVITER_COINS;
    inviter.referralHistory.push({ referredUser: newUser._id, coinsAwarded: REFERRAL_INVITER_COINS });
    await inviter.save({ session });

    newUser.referredBy = inviter._id;
    newUser.coins += REFERRAL_INVITEE_COINS;
    newUser.coinsEarned += REFERRAL_INVITEE_COINS;
    await newUser.save({ session });
    await session.commitTransaction();

    await invalidateUserCache(inviter._id);
    await invalidateUserCache(newUser._id);

    return res.status(200).json({
      success: true,
      message: `Referral applied! You received ${REFERRAL_INVITEE_COINS} coins (₹${+(REFERRAL_INVITEE_COINS / COINS_PER_RUPEE).toFixed(2)}).`,
      data: {
        yourCoins: newUser.coins,
        yourCoinsRupees: +(newUser.coins / COINS_PER_RUPEE).toFixed(2),
        inviterRewarded: REFERRAL_INVITER_COINS,
      },
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// GET '/settings'
export const getSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('name email phone avatar role isEmailVerified isPhoneVerified googleAuth.googleId googleAuth.isVerified referralCode coins coinsEarned coinsRedeemed coinsInRupees lastLoginAt lastLoginIp loginCount lastActiveAt termsAcceptedAt privacyPolicyAcceptedAt createdAt')
    .lean({ virtuals: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

  return res.json({
    success: true,
    data: {
      profile: { name: user.name, email: user.email, phone: user.phone ?? null, avatar: user.avatar, role: user.role },
      verification: { isEmailVerified: user.isEmailVerified, isPhoneVerified: user.isPhoneVerified, isGoogleLinked: !!(user.googleAuth?.googleId), googleVerified: user.googleAuth?.isVerified ?? false },
      coins: { balance: user.coins, balanceRupees: user.coinsInRupees, earned: user.coinsEarned, redeemed: user.coinsRedeemed },
      referralCode: user.referralCode,
      activity: { lastLoginAt: user.lastLoginAt, lastLoginIp: user.lastLoginIp, loginCount: user.loginCount, lastActiveAt: user.lastActiveAt, memberSince: user.createdAt },
      legal: { termsAcceptedAt: user.termsAcceptedAt ?? null, privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt ?? null },
    },
  });
});

// POST '/settings/verify-phone'
export const postSettingsVerifyPhone = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+otp +otpExpires');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!user.phone) return res.status(400).json({ message: 'No phone number on account.' });
  if (user.isPhoneVerified) return res.status(400).json({ message: 'Phone is already verified.' });

  const otp = generateOtp();
  user.otp = otp;
  user.otpExpires = new Date(Date.now() + 10 * 60_000);
  await user.save();
  await sendSms({ to: user.phone, message: otpSms({ otpCode: otp, purpose: 'phone verification' }) })
    .catch((e) => log.warn('Phone verify SMS failed', { err: e.message }));
  return res.json({ message: 'OTP sent to your registered phone number.' });
});

// POST '/settings/verify-phone/confirm'
export const postSettingsVerifyPhoneConfirm = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.user._id, otp: req.body.otp, otpExpires: { $gt: Date.now() },
  }).select('+otp +otpExpires');
  if (!user) return res.status(400).json({ message: 'Invalid or expired OTP.' });

  user.isPhoneVerified = true;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();
  await invalidateUserCache(user._id);
  return res.json({ success: true, message: 'Phone number verified successfully.' });
});

// POST '/settings/request-email-change'
export const postSettingsRequestEmailChange = asyncHandler(async (req, res) => {
  const { newEmail } = req.body;
  if (newEmail === req.user.email) return res.status(400).json({ message: 'New email is the same as your current email.' });

  const conflict = await User.findOne({ email: newEmail });
  if (conflict) return res.status(409).json({ message: 'That email address is already in use.' });

  const user = await User.findById(req.user._id).select('+otp +otpExpires');
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const otp = generateOtp();
  user.otp = `${otp}|${newEmail}`;
  user.otpExpires = new Date(Date.now() + 15 * 60_000);
  await user.save();

  await sendEmail({
    email: user.email,
    subject: 'Confirm Your Email Change — Likeson',
    html: otpTemplate({
      header: 'EMAIL CHANGE',
      title: 'Confirm your email change request',
      body: `Enter this code to change your email to ${newEmail}. It expires in 15 minutes.`,
      otpCode: otp,
    }),
  }).catch((e) => log.warn('Email change OTP send failed', { err: e.message }));

  return res.json({ message: 'OTP sent to your current email address.' });
});

// POST '/settings/confirm-email-change'
export const postSettingsConfirmEmailChange = asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id: req.user._id, otpExpires: { $gt: Date.now() },
  }).select('+otp +otpExpires');

  if (!user || !user.otp) return res.status(400).json({ message: 'No pending email change request.' });

  const [storedOtp, newEmail] = (user.otp ?? '').split('|');
  if (storedOtp !== req.body.otp || !newEmail)
    return res.status(400).json({ message: 'Invalid or expired OTP.' });

  const conflict = await User.findOne({ email: newEmail, _id: { $ne: user._id } });
  if (conflict) {
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    return res.status(409).json({ message: 'That email address is already in use.' });
  }

  const oldEmail = user.email;
  user.email = newEmail;
  user.isEmailVerified = false;
  user.otp = undefined;
  user.otpExpires = undefined;
  await user.save();
  await invalidateUserCache(user._id);

  sendEmail({
    email: oldEmail,
    subject: 'Your Likeson Email Address Was Changed',
    html: passwordChangedTemplate({
      header: 'EMAIL CHANGED',
      title: 'Your email address has been updated',
      body: `Your account email was changed to ${newEmail}. If this wasn't you, contact support immediately.`,
      buttonText: 'Contact Support',
      buttonLink: `${process.env.FRONTEND_URL}/support`,
    }),
  }).catch(() => {});

  log.info('Email changed', { userId: user._id, from: oldEmail, to: newEmail });
  return res.json({ success: true, message: 'Email changed successfully. Please verify your new email address.', newEmail });
});

// DELETE '/settings/google-unlink'
export const deleteSettingsGoogleUnlink = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!user.googleAuth?.googleId) return res.status(400).json({ message: 'No Google account is linked.' });
  if (!user.password) return res.status(400).json({ message: 'Cannot unlink Google — set a password first.' });

  user.googleAuth = { googleId: undefined, isVerified: false };
  await user.save();
  await invalidateUserCache(user._id);

  log.info('Google unlinked', { userId: user._id });
  return res.json({ success: true, message: 'Google account unlinked successfully.' });
});

// GET '/settings/activity'
export const getSettingsActivity = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('auditSessions deviceTokens lastLoginAt lastLoginIp loginCount lastActiveAt isOnline passwordChangedAt')
    .lean();
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const sessions = (user.auditSessions ?? [])
    .slice()
    .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt))
    .slice(0, 10);

  const devices = (user.deviceTokens ?? []).map((t) => ({
    _id: t._id,
    platform: t.platform,
    deviceName: t.deviceName,
    ipAddress: t.ipAddress,
    lastUsedAt: t.lastUsedAt,
  }));

  return res.json({
    success: true,
    data: {
      isOnline: user.isOnline,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      loginCount: user.loginCount,
      lastActiveAt: user.lastActiveAt,
      passwordChangedAt: user.passwordChangedAt ?? null,
      activeSessions: sessions,
      registeredDevices: devices,
    },
  });
});

// PATCH '/settings/legal'
export const patchSettingsLegal = asyncHandler(async (req, res) => {
  const { acceptTerms, acceptPrivacy } = req.body;
  if (!acceptTerms && !acceptPrivacy)
    return res.status(400).json({ message: 'Provide acceptTerms and/or acceptPrivacy.' });

  const $set = {};
  if (acceptTerms === true) $set.termsAcceptedAt = new Date();
  if (acceptPrivacy === true) $set.privacyPolicyAcceptedAt = new Date();

  await User.findByIdAndUpdate(req.user._id, { $set });
  await invalidateUserCache(req.user._id);
  return res.json({ success: true, message: 'Legal acceptance recorded.', updated: $set });
});

// POST '/settings/deactivate'
export const postSettingsDeactivate = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (!(await bcrypt.compare(req.body.password, user.password)))
    return res.status(401).json({ message: 'Incorrect password.' });

  user.isBlocked = true;
  user.blockReason = 'User requested deactivation.';
  user.unblockAt = new Date('2099-01-01T00:00:00.000Z');
  user.isOnline = false;
  user.lastseen = new Date();
  user.auditSessions = [];
  user.deviceTokens = [];
  await user.save();
  await invalidateUserCache(user._id);

  log.info('Account self-deactivated', { userId: user._id });
  if (user.phone) {
    sendSms({
      to: user.phone,
      message: accountBlockedSms({
        name: user.name,
        reason: 'Self-requested deactivation',
        unblockAt: 'Contact support to reactivate',
      }),
    }).catch(() => {});
  }
  return res.json({ success: true, message: 'Account deactivated. Contact support to reactivate your account.' });
});

// GET '/admin/users'
export const getAdminUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip = (page - 1) * limit;
  const filter = {};

  const isPrivileged = ['superadmin', 'admin'].includes(req.user.role);

  if (isPrivileged) {
    if (req.query.role) filter.role = req.query.role;
  } else {
    const allowedRoles = ['superadmin', 'admin'];
    
    if (req.query.role) {
      if (allowedRoles.includes(req.query.role)) {
        filter.role = req.query.role;
      } else {
        return res.json({ data: [], total: 0, pages: 0, currentPage: page });
      }
    } else {
      filter.role = { $in: allowedRoles };
    }
  }

  if (req.query.isBlocked !== undefined) filter.isBlocked = req.query.isBlocked === 'true';
  
  if (req.query.search) {
    filter.$or = [
      { name: { $regex: req.query.search, $options: 'i' } },
      { email: { $regex: req.query.search, $options: 'i' } },
      { phone: { $regex: req.query.search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password -otp -otpExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  return res.json({ data: users, total, pages: Math.ceil(total / limit), currentPage: page });
});

// PATCH '/admin/update-role/:id'
export const patchAdminUpdateRoleById = asyncHandler(async (req, res) => {
  const { role: newRole } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(req.params.id).session(session);
    if (!user) { await session.abortTransaction(); return res.status(404).json({ message: 'User not found.' }); }

    const oldRole = user.role;
    if (oldRole === newRole) { await session.abortTransaction(); return res.status(400).json({ message: 'User already has this role.' }); }

    user.role = newRole;
    await user.save({ session });

    const OldM = getProfileModel(oldRole);
    if (OldM) await OldM.findOneAndDelete({ user: user._id }).session(session);

    const NewM = getProfileModel(newRole);
    let newProfile = null;
    if (NewM) [newProfile] = await NewM.create([{ user: user._id }], { session });

    await session.commitTransaction();
    await invalidateUserCache(user._id);
    await invalidatePattern('GET:/api/users/admin/users*');

    log.info('Role changed', { userId: user._id, from: oldRole, to: newRole, by: req.user._id });
    return res.json({ success: true, message: `Role changed: ${oldRole} → ${newRole}.`, user, newProfile });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// PATCH '/admin/suspend/:id'
export const patchAdminSuspendById = asyncHandler(async (req, res) => {
  const { reason, durationDays } = req.body;
  const unblockAt = new Date();
  unblockAt.setDate(unblockAt.getDate() + (parseInt(durationDays) || 30));

  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      isBlocked: true,
      blockReason: reason || 'Violation of terms of service',
      unblockAt,
      isOnline: false,
      lastseen: new Date(),
      auditSessions: [],
      deviceTokens: [],
    },
    { new: true }
  );

  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (user.phone) {
    sendSms({
      to: user.phone,
      message: accountBlockedSms({
        name: user.name,
        reason: user.blockReason,
        unblockAt: unblockAt.toLocaleDateString('en-IN'),
      }),
    }).catch(() => {});
  }

  await invalidateUserCache(user._id);
  await invalidatePattern('GET:/api/users/admin/users*');

  log.warn('User suspended', { userId: user._id, by: req.user._id });
  return res.json({ message: `Suspended until ${unblockAt.toISOString()}.`, user });
});

// PATCH '/admin/unblock/:id'
export const patchAdminUnblockById = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBlocked: false, blockReason: undefined, unblockAt: undefined },
    { new: true }
  );

  if (!user) return res.status(404).json({ message: 'User not found.' });

  if (user.phone) {
    sendSms({ to: user.phone, message: accountUnblockedSms({ name: user.name }) }).catch(() => {});
  }

  await invalidateUserCache(user._id);
  await invalidatePattern('GET:/api/users/admin/users*');

  log.info('User unblocked', { userId: user._id, by: req.user._id });
  return res.json({ message: 'User unblocked.', user });
});

// POST '/admin/reset-otp/:email'
export const postAdminResetOtpByEmail = asyncHandler(async (req, res) => {
  const user = await User.findOneAndUpdate(
    { email: req.params.email.toLowerCase() },
    { $unset: { otp: 1, otpExpires: 1 } }
  );
  if (user) await invalidateUserCache(user._id);
  return res.json({ message: 'OTP state cleared.' });
});

// GET '/admin/user/:id/coins'
export const getAdminUserByIdCoins = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('name email coins coinsEarned coinsRedeemed referralCode referralHistory referredBy')
    .populate('referralHistory.referredUser', 'name email')
    .populate('referredBy', 'name email');

  if (!user) return res.status(404).json({ message: 'User not found.' });

  return res.json({
    success: true,
    data: {
      name: user.name,
      email: user.email,
      referralCode: user.referralCode,
      referredBy: user.referredBy ?? null,
      totalReferrals: user.referralHistory.length,
      coins: user.coins,
      coinsInRupees: +(user.coins / COINS_PER_RUPEE).toFixed(2),
      coinsEarned: user.coinsEarned,
      coinsRedeemed: user.coinsRedeemed,
      referralHistory: user.referralHistory,
    },
  });
});

// POST '/admin/credit-coins/:id'
export const postAdminCreditCoinsById = asyncHandler(async (req, res) => {
  const { coins, reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found.' });

  user.coins += coins;
  user.coinsEarned += coins;
  await user.save();
  await invalidateUserCache(user._id);

  log.info('Admin credited coins', { userId: user._id, coins, reason, by: req.user._id });
  return res.json({
    success: true,
    message: `${coins} coins credited to ${user.name}.`,
    data: { userId: user._id, newBalance: user.coins, reason },
  });
});

// GET '/admin/user/:id/sessions'
export const getAdminUserByIdSessions = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('auditSessions deviceTokens isOnline lastLoginAt lastLoginIp')
    .lean();
  if (!user) return res.status(404).json({ message: 'User not found.' });

  const sessions = (user.auditSessions ?? [])
    .slice()
    .sort((a, b) => new Date(b.lastActiveAt) - new Date(a.lastActiveAt));

  return res.json({
    success: true,
    isOnline: user.isOnline,
    lastLoginAt: user.lastLoginAt,
    lastLoginIp: user.lastLoginIp,
    activeSessions: sessions,
    registeredDevices: user.deviceTokens ?? [],
  });
});

// DELETE '/admin/user/:id/sessions'
export const deleteAdminUserByIdSessions = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        auditSessions: [],
        deviceTokens: [],
        isOnline: false,
        lastseen: new Date(),
      },
    },
    { new: true }
  ).select('name email');

  if (!user) return res.status(404).json({ message: 'User not found.' });

  await invalidateUserCache(req.params.id);

  log.warn('Admin force sign-out', { targetUserId: req.params.id, by: req.user._id });
  return res.json({
    success: true,
    message: `All sessions cleared for ${user.name}. User has been signed out everywhere.`,
  });
});

// GET '/cookie-consent'
export const getCookieConsent = asyncHandler(async (req, res) => {
  const consent = await CookieConsent.findOne({ user: req.user._id }).lean();
  return res.json({
    success: true,
    data: consent ?? {
      consentGiven: false,
      preferences: {
        necessary: true,
        analytics: false,
        marketing: false,
        functional: false,
      },
    },
  });
});

// POST '/cookie-consent'
export const postCookieConsent = asyncHandler(async (req, res) => {
  const { acceptAll, preferences } = req.body;

  const prefs = acceptAll
    ? { necessary: true, analytics: true, marketing: true, functional: true }
    : {
        necessary: true, // always true
        analytics: preferences?.analytics ?? false,
        marketing: preferences?.marketing ?? false,
        functional: preferences?.functional ?? false,
      };

  const consent = await CookieConsent.findOneAndUpdate(
    { user: req.user._id },
    {
      user: req.user._id,
      preferences: prefs,
      consentGiven: true,
      consentAt: new Date(),
      updatedAt: new Date(),
      ipAddress: req.deviceInfo?.ipAddress,
      userAgent: req.deviceInfo?.userAgent,
      version: '1.0',
    },
    { upsert: true, new: true, runValidators: true }
  );

  log.info('Cookie consent saved', { userId: req.user._id, acceptAll: !!acceptAll });
  return res.json({ success: true, message: 'Cookie preferences saved.', data: consent });
});

// PATCH '/cookie-consent'
export const patchCookieConsent = asyncHandler(async (req, res) => {
  const { preferences } = req.body;

  const allowed = ['analytics', 'marketing', 'functional'];
  const updates = {};
  for (const key of allowed) {
    if (typeof preferences[key] === 'boolean') {
      updates[`preferences.${key}`] = preferences[key];
    }
  }

  if (!Object.keys(updates).length)
    return res.status(400).json({ message: 'No valid preferences provided.' });

  const consent = await CookieConsent.findOneAndUpdate(
    { user: req.user._id },
    { $set: { ...updates, updatedAt: new Date(), ipAddress: req.deviceInfo?.ipAddress } },
    { new: true, upsert: true }
  );

  return res.json({ success: true, message: 'Preferences updated.', data: consent });
});

// DELETE '/cookie-consent'
export const deleteCookieConsent = asyncHandler(async (req, res) => {
  await CookieConsent.findOneAndUpdate(
    { user: req.user._id },
    {
      $set: {
        consentGiven: false,
        preferences: { necessary: true, analytics: false, marketing: false, functional: false },
        updatedAt: new Date(),
      },
    }
  );
  log.info('Cookie consent withdrawn', { userId: req.user._id });
  return res.json({ success: true, message: 'Cookie consent withdrawn.' });
});

// GET '/admin/user/:id/cookie-consent'
export const getAdminUserByIdCookieConsent = asyncHandler(async (req, res) => {
  const consent = await CookieConsent.findOne({ user: req.params.id }).lean();
  if (!consent) return res.status(404).json({ message: 'No consent record found.' });
  return res.json({ success: true, data: consent });
});

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, _next) => {
  log.error('Unhandled error', { message: err.message, stack: err.stack });
  return res.status(err.statusCode || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};