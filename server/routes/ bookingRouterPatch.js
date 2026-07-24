/**
 * bookingRouterPatch.js — Likeson.in
 * Business logic lives in controllers/bookingRouterPatch.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/bookingRouterPatch.controller.js';

const router = express.Router();

router.get('/doctor/assigned', protect, restrictTo('doctor'), ctrl.getDoctorAssigned);
router.post('/payment/confirm', ctrl.postPaymentConfirm);
router.get('/tp/:id', protect, restrictTo('transportpartner'), ctrl.getTpById);

export default router;
