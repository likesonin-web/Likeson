/**
 * meetingRoutes.js — Likeson.in
 * Business logic lives in controllers/meeting.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/meeting.controller.js';

const router = express.Router();

router.get('/employees', protect, ctrl.getEmployees);
router.post('/create', protect, authorize('superadmin', 'admin', 'doctor', 'lab partner'), ctrl.postCreate);
router.get('/my-meetings', protect, ctrl.getMyMeetings);
router.patch('/:meetingId/cancel', protect, ctrl.patchByMeetingIdCancel);

export default router;
