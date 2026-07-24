/**
 * referralRoutes.js — Likeson.in
 * Business logic lives in controllers/referral.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/referral.controller.js';

const router = express.Router();

// 1. Define the validate middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 2. Define the minimum redemption points (Change this number to match your platform's rules)
const MIN_REDEEM_POINTS = 50; 

router.get('/my-code', protect, ctrl.getMyCode);

router.get('/my-referrals', protect, [
    query('status').optional().isIn(['pending', 'completed']),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ], ctrl.getMyReferrals);

router.post('/redeem-coins', protect, [
    body('points').isInt({ min: MIN_REDEEM_POINTS })
      .withMessage(`Minimum ${MIN_REDEEM_POINTS} coins required for redemption.`),
    validate,
  ], ctrl.postRedeemCoins);

router.get('/validate/:code', [
    param('code').isAlphanumeric().isLength({ min: 6, max: 10 }), 
    validate
  ], ctrl.getValidateByCode);

router.get('/admin/overview', protect, authorize('superadmin', 'admin'), ctrl.getAdminOverview);

router.get('/admin/leaderboard', protect, authorize('superadmin', 'admin'), ctrl.getAdminLeaderboard);

router.get('/admin/user/:userId', protect, authorize('superadmin', 'admin'), [
    param('userId').isMongoId(), 
    validate
  ], ctrl.getAdminUserByUserId);

router.get('/admin/transactions', protect, authorize('superadmin'), ctrl.getAdminTransactions);

router.post('/admin/manual-award', protect, authorize('superadmin'), [
    body('userId').isMongoId(), 
    body('coins').isInt({ min: 1 }), 
    body('reason').notEmpty().trim(), 
    validate
  ], ctrl.postAdminManualAward);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;