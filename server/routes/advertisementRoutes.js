/**
 * advertisementRoutes.js — Likeson.in
 * Business logic lives in controllers/advertisement.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/advertisement.controller.js';

const router = express.Router();

router.get('/', protect, authorize('admin', 'superadmin'), ctrl.get);
router.get('/analytics', protect, authorize('admin', 'superadmin'), ctrl.getAnalytics);
router.post('/', protect, authorize('admin', 'superadmin'), ctrl.post);
router.get('/serve', protect, ctrl.getServe);
router.patch('/:id/track', protect, ctrl.patchByIdTrack);
router.put('/:id', protect, authorize('admin', 'superadmin'), ctrl.putById);
router.delete('/:id', protect, authorize('admin', 'superadmin'), ctrl.deleteById);

export default router;
