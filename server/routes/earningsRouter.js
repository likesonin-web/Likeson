/**
 * earningsRouter.js — Likeson.in
 * Business logic lives in controllers/earnings.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/earnings.controller.js';

const router = express.Router();

router.get('/', protect, ctrl.get);
router.get('/:allocationId', protect, ctrl.getByAllocationId);

export default router;
