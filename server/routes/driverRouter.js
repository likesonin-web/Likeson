/**
 * driverRouter.js — Likeson.in
 * Business logic lives in controllers/driver.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit'; // <-- Added this import
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/driver.controller.js';

const router = express.Router();

// 1. Define the missing Rate Limiters (adjust limits/windowMs as needed)
const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
const mutationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });
const locationLimiter = rateLimit({ windowMs: 1 * 60 * 1000, limit: 60 });

// 2. Define the missing validate middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 3. Define the missing validation rule arrays 
// (Note: Adjust the fields inside these arrays if your database schema expects different ones)
const personalRules = [
  body('firstName').optional().isString().trim(),
  body('lastName').optional().isString().trim(),
];
const locationRules = [
  body('latitude').optional().isFloat(),
  body('longitude').optional().isFloat(),
];
const kycRules = [
  body('documentType').optional().isString().trim(),
  body('documentNumber').optional().isString().trim(),
];
const bankRules = [
  body('accountNumber').optional().isString().trim(),
  body('ifscCode').optional().isString().trim(),
];


router.use(generalLimiter);
router.use(protect, authorize('driver'));

router.get('/profile', ctrl.getProfile);

router.patch('/profile', mutationLimiter, [...personalRules, validate], ctrl.patchProfile);

router.patch('/status', mutationLimiter, [
    body('status')
      .isIn(['Available', 'Offline', 'On-Break'])
      .withMessage('Allowed values: Available | Offline | On-Break'),
    validate,
  ], ctrl.patchStatus);

router.patch('/location', locationLimiter, [...locationRules, validate], ctrl.patchLocation);

router.get('/kyc', ctrl.getKyc);

router.patch('/kyc', mutationLimiter, [...kycRules, validate], ctrl.patchKyc);

router.get('/medical', ctrl.getMedical);

router.patch('/medical', mutationLimiter, [
    body('certificateNumber').optional().isString().trim(),
    body('issuedBy').optional().isString().trim(),
    body('issuedAt').optional().isISO8601().withMessage('issuedAt must be valid ISO date'),
    body('expiryDate').optional().isISO8601().withMessage('expiryDate must be valid ISO date'),
    body('documentUrl').optional().isURL().withMessage('documentUrl must be a valid URL'),
    body('bloodGroup')
      .optional()
      .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'])
      .withMessage('Invalid blood group'),
    validate,
  ], ctrl.patchMedical);

router.get('/bank', ctrl.getBank);

router.patch('/bank', mutationLimiter, [...bankRules, validate], ctrl.patchBank);

router.get('/earnings', ctrl.getEarnings);

router.get('/coin-transactions', [
    query('page').optional().isInt({ min: 1 }).withMessage('page >= 1'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit 1-50'),
    query('type')
      .optional()
      .isIn(['EARN', 'REDEEM', 'EXPIRE', 'BONUS', 'ADMIN_CREDIT', 'ADMIN_DEBIT'])
      .withMessage('Invalid transaction type'),
    validate,
  ], ctrl.getCoinTransactions);

router.get('/badges', ctrl.getBadges);

router.get('/performance', ctrl.getPerformance);

router.get('/onboarding', ctrl.getOnboarding);

router.post('/onboarding/accept-terms', mutationLimiter, ctrl.postOnboardingAcceptTerms);

router.patch('/notification-preferences', [
    body('smsAlerts').optional().isBoolean().withMessage('smsAlerts must be boolean'),
    body('whatsappAlerts').optional().isBoolean().withMessage('whatsappAlerts must be boolean'),
    body('pushNotifications').optional().isBoolean().withMessage('pushNotifications must be boolean'),
    validate,
  ], ctrl.patchNotificationPreferences);

router.get('/vehicle', ctrl.getVehicle);

router.get('/agency', ctrl.getAgency);

router.get('/compliance', ctrl.getCompliance);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;