/**
 * userRoutes.js — Likeson.in
 * Business logic lives in controllers/user.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import passport  from 'passport';
import { body, param, query, validationResult } from 'express-validator';
import { protect, authorize, getDeviceInfo } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import * as ctrl from '../controllers/user.controller.js';

const router = express.Router();

// 1. Define the missing validate middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 2. Define the missing minimum redemption coins limit
const MIN_REDEEM_COINS = 100; // Adjust this number based on your platform's rules

router.use(getDeviceInfo)

router.post('/signup', [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Min 8 chars'),
    body('name').notEmpty().trim().withMessage('Name required'),
    validate,
  ], ctrl.postSignup);

router.post('/login', [
    body('identifier').notEmpty().trim().withMessage('Email, phone, or name required'),
    body('password').exists().withMessage('Password required'),
    validate,
  ], ctrl.postLogin);

router.post('/logout', protect, ctrl.postLogout);
router.post('/otp-request', ctrl.postOtpRequest);
router.post('/verify-email', ctrl.postVerifyEmail);

router.post('/request-otp-login', [
    body('identifier').notEmpty().trim().withMessage('Identifier required'), 
    validate
  ], ctrl.postRequestOtpLogin);

router.post('/otp-login', [
    body('identifier').notEmpty().trim().withMessage('Identifier required'),
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
    validate,
  ], ctrl.postOtpLogin);

router.post('/forgot-password', ctrl.postForgotPassword);
router.post('/reset-password', ctrl.postResetPassword);

router.get('/profile', protect, cache(60, (req) => `user:${req.user._id}:profile`), ctrl.getProfile);

router.put('/profile', protect, [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone').optional().trim(),
    body('avatar').optional().trim().isURL().withMessage('Avatar must be a valid URL'),
    validate,
  ], ctrl.putProfile);

router.put('/change-password', protect, ctrl.putChangePassword);
router.delete('/delete-account', protect, ctrl.deleteDeleteAccount);

router.get('/sessions', protect, cache(60, (req) => `user:${req.user._id}:sessions`), ctrl.getSessions);

router.delete('/sessions/:sessionId', protect, [
    param('sessionId').isMongoId().withMessage('Invalid session ID'), 
    validate
  ], ctrl.deleteSessionsBySessionId);

router.delete('/sessions', protect, ctrl.deleteSessions);
router.post('/device-tokens', protect, ctrl.postDeviceTokens);
router.get('/device-tokens', protect, cache(60, (req) => `user:${req.user._id}:device-tokens`), ctrl.getDeviceTokens);
router.delete('/device-tokens/:token', protect, ctrl.deleteDeviceTokensByToken);
router.post('/heartbeat', protect, ctrl.postHeartbeat);
router.get('/google', ctrl.getGoogle);

router.get('/google/callback', passport.authenticate('google', {
    session:         false,
    // Add a fallback just in case the env variable fails
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth-error?reason=google_denied`,
  }), ctrl.getGoogleCallback);

router.patch('/update-location-by-address', protect, ctrl.patchUpdateLocationByAddress);
router.patch('/update-location', protect, [
    body('lat').isFloat({ min: -90,  max: 90  }).withMessage('lat must be between -90 and 90'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng must be between -180 and 180'),
    validate,
  ], ctrl.patchUpdateLocation);

router.get('/wallet', protect, cache(60, (req) => `user:${req.user._id}:wallet:p${req.query.page || 1}:l${req.query.limit || 20}`), ctrl.getWallet);

router.post('/wallet/redeem-coins', protect, [
    body('coins').isInt({ min: MIN_REDEEM_COINS }).withMessage(`Minimum ${MIN_REDEEM_COINS} coins required to redeem.`), 
    validate
  ], ctrl.postWalletRedeemCoins);

router.get('/referral/my-code', protect, cache(60, (req) => `user:${req.user._id}:referral`), ctrl.getReferralMyCode);

router.get('/referral/validate', [
    query('code').notEmpty().trim().withMessage('code query param required'), 
    validate
  ], cache(300, (req) => `referral:validate:${(req.query.code || '').toUpperCase().trim()}`), ctrl.getReferralValidate);

router.post('/referral/apply', protect, [
    body('referralCode').notEmpty().trim().withMessage('referralCode is required.'), 
    validate
  ], ctrl.postReferralApply);

router.get('/settings', protect, cache(30, (req) => `user:${req.user._id}:settings`), ctrl.getSettings);
router.post('/settings/verify-phone', protect, ctrl.postSettingsVerifyPhone);
router.post('/settings/verify-phone/confirm', protect, [body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'), validate], ctrl.postSettingsVerifyPhoneConfirm);
router.post('/settings/request-email-change', protect, [body('newEmail').isEmail().normalizeEmail().withMessage('Valid new email required'), validate], ctrl.postSettingsRequestEmailChange);
router.post('/settings/confirm-email-change', protect, [body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'), validate], ctrl.postSettingsConfirmEmailChange);
router.delete('/settings/google-unlink', protect, ctrl.deleteSettingsGoogleUnlink);
router.get('/settings/activity', protect, cache(30, (req) => `user:${req.user._id}:activity`), ctrl.getSettingsActivity);

router.patch('/settings/legal', protect, [
    body('acceptTerms').optional().isBoolean(),
    body('acceptPrivacy').optional().isBoolean(),
    validate,
  ], ctrl.patchSettingsLegal);

router.post('/settings/deactivate', protect, [
    body('password').exists().withMessage('Password confirmation required'), 
    validate
  ], ctrl.postSettingsDeactivate);

router.get('/admin/users', protect, // 1. Removed authorize() so all authenticated users can hit this endpoint.
  // 2. Updated the cache key to factor in the user's role, preventing cross-role cache leaks.
  cache(60, (req) => `admin:users:${req.user.role}:${req.originalUrl}`), ctrl.getAdminUsers);

router.patch('/admin/update-role/:id', protect, authorize('superadmin'), [param('id').isMongoId().withMessage('Invalid user ID'), validate], ctrl.patchAdminUpdateRoleById);
router.patch('/admin/suspend/:id', protect, authorize('superadmin', 'admin'), [param('id').isMongoId().withMessage('Invalid user ID'), validate], ctrl.patchAdminSuspendById);
router.patch('/admin/unblock/:id', protect, authorize('superadmin', 'admin'), [param('id').isMongoId().withMessage('Invalid user ID'), validate], ctrl.patchAdminUnblockById);
router.post('/admin/reset-otp/:email', protect, authorize('admin', 'superadmin'), ctrl.postAdminResetOtpByEmail);

router.get('/admin/user/:id/coins', protect, authorize('superadmin', 'admin'), [param('id').isMongoId().withMessage('Invalid user ID'), validate], cache(60, (req) => `admin:user:${req.params.id}:coins`), ctrl.getAdminUserByIdCoins);

router.post('/admin/credit-coins/:id', protect, authorize('superadmin'), [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('coins').isInt({ min: 1 }).withMessage('coins must be a positive integer'),
    body('reason').notEmpty().trim().withMessage('reason is required'),
    validate,
  ], ctrl.postAdminCreditCoinsById);

router.get('/admin/user/:id/sessions', protect, authorize('superadmin', 'admin'), [param('id').isMongoId().withMessage('Invalid user ID'), validate], ctrl.getAdminUserByIdSessions);
router.delete('/admin/user/:id/sessions', protect, authorize('superadmin', 'admin'), [param('id').isMongoId().withMessage('Invalid user ID'), validate], ctrl.deleteAdminUserByIdSessions);

router.get('/cookie-consent', protect, ctrl.getCookieConsent);

router.post('/cookie-consent', protect, [
    body('acceptAll').optional().isBoolean(),
    body('preferences.analytics').optional().isBoolean(),
    body('preferences.marketing').optional().isBoolean(),
    body('preferences.functional').optional().isBoolean(),
    validate,
  ], ctrl.postCookieConsent);

router.patch('/cookie-consent', protect, [
    body('preferences').isObject().withMessage('preferences object required'),
    validate,
  ], ctrl.patchCookieConsent);

router.delete('/cookie-consent', protect, ctrl.deleteCookieConsent);
router.get('/admin/user/:id/cookie-consent', protect, authorize('superadmin', 'admin'), [param('id').isMongoId(), validate], ctrl.getAdminUserByIdCookieConsent);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;