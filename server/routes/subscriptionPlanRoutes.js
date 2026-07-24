/**
 * subscriptionPlanRoutes.js — Likeson.in
 * Business logic lives in controllers/subscriptionPlan.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/subscriptionPlan.controller.js';

const router = express.Router();

router.get('/', ctrl.get);
router.get('/:id', ctrl.getById);
router.get('/me/subscription', protect, ctrl.getMeSubscription);
router.post('/', protect, authorize('superadmin', 'admin'), ctrl.post);
router.delete('/:id', protect, authorize('superadmin', 'admin'), ctrl.deleteById);
router.get('/admin/subscribers', protect, authorize('superadmin', 'admin'), ctrl.getAdminSubscribers);
router.get('/admin/active-subscriptions', protect, authorize('superadmin', 'admin'), ctrl.getAdminActiveSubscriptions);
router.get('/admin/revenue/summary', protect, authorize('superadmin', 'admin'), ctrl.getAdminRevenueSummary);
router.get('/admin/revenue/by-plan', protect, authorize('superadmin', 'admin'), ctrl.getAdminRevenueByPlan);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;
