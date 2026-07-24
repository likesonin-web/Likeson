/**
 * opRouter.js — Likeson.in
 * Business logic lives in controllers/op.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/op.controller.js';

const router = express.Router();

router.get('/my', protect, authorize('customer'), ctrl.getMy);
router.get('/:id', protect, ctrl.getById);
router.get('/:id/slip', protect, ctrl.getByIdSlip);
router.get('/:id/followup-eligibility', protect, authorize('customer'), ctrl.getByIdFollowupEligibility);
router.get('/doctor/my', protect, authorize('doctor'), ctrl.getDoctorMy);
router.get('/doctor/today', protect, authorize('doctor'), ctrl.getDoctorToday);
router.patch('/:id/start', protect, authorize('doctor'), ctrl.patchByIdStart);
router.patch('/:id/complete', protect, authorize('doctor'), ctrl.patchByIdComplete);
router.patch('/:id/no-show', protect, authorize('doctor'), ctrl.patchByIdNoShow);
router.patch('/:id/notes', protect, authorize('doctor'), ctrl.patchByIdNotes);
router.get('/hospital/register', protect, authorize('hospital'), ctrl.getHospitalRegister);
router.get('/hospital/upcoming', protect, authorize('hospital'), ctrl.getHospitalUpcoming);
router.post('/admin/create', protect, authorize('admin', 'superadmin'), ctrl.postAdminCreate);
router.get('/admin/list', protect, authorize('admin', 'superadmin'), ctrl.getAdminList);
router.get('/admin/stats', protect, authorize('admin', 'superadmin'), ctrl.getAdminStats);
router.get('/admin/daily-register', protect, authorize('admin', 'superadmin'), ctrl.getAdminDailyRegister);
router.get('/admin/:id', protect, authorize('admin', 'superadmin'), ctrl.getAdminById);
router.patch('/admin/:id/status', protect, authorize('admin', 'superadmin'), ctrl.patchAdminByIdStatus);
router.patch('/admin/:id/followup', protect, authorize('admin', 'superadmin'), ctrl.patchAdminByIdFollowup);
router.get('/admin/:id/slip', protect, authorize('admin', 'superadmin'), ctrl.getAdminByIdSlip);
router.get('/admin/export', protect, authorize('admin', 'superadmin'), ctrl.getAdminExport);

export default router;
