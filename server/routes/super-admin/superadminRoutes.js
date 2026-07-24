/**
 * super-admin/superadminRoutes.js — Likeson.in
 * Business logic lives in controllers/super-admin/superadmin.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { param, validationResult } from 'express-validator';
import { protect, authorize } from '../../middleware/authMiddleware.js';
import * as ctrl from '../../controllers/super-admin/superadmin.controller.js';

const router = express.Router();

// 1. Core validation result checker
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 2. Helper function to validate MongoDB Object IDs dynamically
const validateObjectId = (paramName) => {
  return [
    param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
    validate
  ];
};

router.get('/pharmacy-orders', protect, authorize('superadmin'), ctrl.getPharmacyOrders);
router.get('/pharmacy-orders/:orderId', protect, authorize('superadmin'), ctrl.getPharmacyOrdersByOrderId);
router.get('/bookings', protect, authorize('superadmin'), ctrl.getBookings);
router.get('/bookings/:bookingCode', protect, authorize('superadmin'), ctrl.getBookingsByBookingCode);
router.get('/financial-ledger', protect, authorize('superadmin'), ctrl.getFinancialLedger);
router.get('/subscriptions/billing-summary', protect, authorize('superadmin'), ctrl.getSubscriptionsBillingSummary);
router.post('/refunds/pharmacy/:orderId', protect, authorize('superadmin'), ctrl.postRefundsPharmacyByOrderId);
router.post('/refunds/booking/:bookingId', protect, authorize('superadmin'), ctrl.postRefundsBookingByBookingId);

router.get('/wallet/:userId', protect, authorize('superadmin'), validateObjectId('userId'), ctrl.getWalletByUserId);
router.post('/wallet/:userId/adjust', protect, authorize('superadmin'), validateObjectId('userId'), ctrl.postWalletByUserIdAdjust);

router.get('/system/audit-logs', protect, authorize('superadmin'), ctrl.getSystemAuditLogs);
router.get('/medicines', protect, authorize('superadmin'), ctrl.getMedicines);
router.get('/analytics/revenue', protect, authorize('superadmin'), ctrl.getAnalyticsRevenue);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;