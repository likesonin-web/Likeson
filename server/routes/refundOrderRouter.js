/**
 * refundOrderRouter.js — Likeson.in
 * Business logic lives in controllers/refundOrder.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize }   from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/refundOrder.controller.js';

const router = express.Router();

router.get('/:orderId/preview', protect, authorize('admin', 'superadmin', 'finance'), ctrl.getByOrderIdPreview);
router.post('/:orderId/initiate', protect, authorize('admin', 'superadmin', 'finance'), ctrl.postByOrderIdInitiate);
router.patch('/:orderId/status', protect, authorize('admin', 'superadmin', 'finance'), ctrl.patchByOrderIdStatus);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;
