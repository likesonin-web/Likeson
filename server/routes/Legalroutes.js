/**
 * Legalroutes.js — Likeson.in
 * Business logic lives in controllers/legal.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/legal.controller.js';

const router = express.Router();

router.get('/active', ctrl.getActive);
router.get('/:type', ctrl.getByType);
router.get('/consent/status', protect, ctrl.getConsentStatus);
router.get('/consent/me', protect, ctrl.getConsentMe);
router.post('/consent', protect, ctrl.postConsent);
router.patch('/consent/withdraw', protect, ctrl.patchConsentWithdraw);
router.get('/admin/all', protect, authorize('superadmin', 'admin'), ctrl.getAdminAll);
router.get('/admin/:id', protect, authorize('superadmin', 'admin'), ctrl.getAdminById);
router.post('/admin', protect, authorize('superadmin', 'admin'), ctrl.postAdmin);
router.patch('/admin/:id', protect, authorize('superadmin', 'admin'), ctrl.patchAdminById);
router.patch('/admin/:id/submit-review', protect, authorize('superadmin', 'admin'), ctrl.patchAdminByIdSubmitReview);
router.patch('/admin/:id/approve', protect, authorize('superadmin'), ctrl.patchAdminByIdApprove);
router.patch('/admin/:id/publish', protect, authorize('superadmin'), ctrl.patchAdminByIdPublish);
router.patch('/admin/:id/new-version', protect, authorize('superadmin', 'admin'), ctrl.patchAdminByIdNewVersion);
router.get('/admin/:id/version-history', protect, authorize('superadmin', 'admin'), ctrl.getAdminByIdVersionHistory);
router.get('/admin/:id/consents', protect, authorize('superadmin', 'admin'), ctrl.getAdminByIdConsents);
router.get('/admin/consents/users', protect, authorize('superadmin', 'admin'), ctrl.getAdminConsentsUsers);
router.delete('/admin/:id', protect, authorize('superadmin'), ctrl.deleteAdminById);
router.patch('/admin/:id/archive', protect, authorize('superadmin'), ctrl.patchAdminByIdArchive);
router.get('/admin/:id/verify-checksum', protect, authorize('superadmin'), ctrl.getAdminByIdVerifyChecksum);

export default router;
