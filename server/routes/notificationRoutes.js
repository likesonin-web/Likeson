/**
 * notificationRoutes.js — Likeson.in
 * Business logic lives in controllers/notification.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/notification.controller.js';

const router = express.Router();

router.use(protect, getDeviceInfo)
router.get('/', ctrl.get);
router.patch('/:id/read', ctrl.patchByIdRead);
router.patch('/read-all', ctrl.patchReadAll);
router.delete('/:id', ctrl.deleteById);

export default router;
