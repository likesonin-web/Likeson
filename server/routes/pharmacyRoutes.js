/**
 * pharmacyRoutes.js — Likeson.in
 * Business logic lives in controllers/pharmacy.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/pharmacy.controller.js';

const router = express.Router();

router.get('/stores', protect, authorize('admin', 'superadmin'), ctrl.getStores);
router.post('/stores', protect, authorize('admin', 'superadmin'), ctrl.postStores);
router.patch('/my-store', protect, authorize('pharmacy'), ctrl.patchMyStore);
router.get('/nearby', ctrl.getNearby);
router.get('/nearby-owned', ctrl.getNearbyOwned);
router.patch('/:id/verify', protect, authorize('admin', 'superadmin'), ctrl.patchByIdVerify);
router.post('/staff/invite', protect, authorize('pharmacy', 'admin', 'superadmin'), ctrl.postStaffInvite);
router.get('/me', protect, authorize('pharmacy'), ctrl.getMe);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;
