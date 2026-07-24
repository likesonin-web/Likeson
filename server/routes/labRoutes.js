/**
 * labRoutes.js — Likeson.in
 * Business logic lives in controllers/lab.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // <-- Added multer for file uploads
import { protect, authorize, attachLabProfile } from '../middleware/authMiddleware.js'; // <-- Added missing attachLabProfile import
import cache              from '../middleware/cache.js';
import * as ctrl from '../controllers/lab.controller.js';

const router = express.Router();

// Define Multer upload middleware (Adjust 'uploads/' to your actual storage config if needed)
const upload = multer({ dest: 'uploads/' });

router.get('/public', cache(120), ctrl.getPublic);
router.get('/public/search', ctrl.getPublicSearch);
router.get('/public/featured', cache(300), ctrl.getPublicFeatured);
router.get('/public/:id', cache(60, (req) => `lab:${req.params.id}:public`), ctrl.getPublicById);
router.get('/public/:id/tests', cache(60, (req) => `lab:${req.params.id}:tests:public`), ctrl.getPublicByIdTests);
router.get('/public/:id/packages', cache(60, (req) => `lab:${req.params.id}:packages:public`), ctrl.getPublicByIdPackages);
router.get('/public/:id/reviews', ctrl.getPublicByIdReviews);
router.get('/partner/me', protect, authorize('lab_partner'), attachLabProfile, ctrl.getPartnerMe);
router.patch('/partner/me', protect, authorize('lab_partner'), attachLabProfile, upload.fields([
    { name: 'logo',       maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]), ctrl.patchPartnerMe);
router.patch('/partner/me/bank-details', protect, authorize('lab_partner'), attachLabProfile, ctrl.patchPartnerMeBankDetails);
router.get('/partner/me/tests', protect, authorize('lab_partner'), attachLabProfile, ctrl.getPartnerMeTests);
router.post('/partner/me/tests', protect, authorize('lab_partner'), attachLabProfile, upload.single('reportTemplate'), ctrl.postPartnerMeTests);
router.patch('/partner/me/tests/:testId', protect, authorize('lab_partner'), attachLabProfile, upload.single('reportTemplate'), ctrl.patchPartnerMeTestsByTestId);
router.delete('/partner/me/tests/:testId', protect, authorize('lab_partner'), attachLabProfile, ctrl.deletePartnerMeTestsByTestId);
router.get('/partner/me/packages', protect, authorize('lab_partner'), attachLabProfile, ctrl.getPartnerMePackages);
router.post('/partner/me/packages', protect, authorize('lab_partner'), attachLabProfile, ctrl.postPartnerMePackages);
router.patch('/partner/me/packages/:pkgId', protect, authorize('lab_partner'), attachLabProfile, ctrl.patchPartnerMePackagesByPkgId);
router.delete('/partner/me/packages/:pkgId', protect, authorize('lab_partner'), attachLabProfile, ctrl.deletePartnerMePackagesByPkgId);
router.get('/partner/me/accreditations', protect, authorize('lab_partner'), attachLabProfile, ctrl.getPartnerMeAccreditations);
router.post('/partner/me/accreditations', protect, authorize('lab_partner'), attachLabProfile, upload.single('certificate'), ctrl.postPartnerMeAccreditations);
router.post('/partner/me/compliance-docs', protect, authorize('lab_partner'), attachLabProfile, upload.single('document'), ctrl.postPartnerMeComplianceDocs);
router.get('/partner/me/status-log', protect, authorize('lab_partner'), attachLabProfile, ctrl.getPartnerMeStatusLog);
router.get('/partner/me/reviews', protect, authorize('lab_partner'), attachLabProfile, ctrl.getPartnerMeReviews);
router.get('/partner/me/settings', protect, authorize('lab_partner'), attachLabProfile, ctrl.getPartnerMeSettings);
router.patch('/partner/me/settings/operational', protect, authorize('lab_partner'), attachLabProfile, ctrl.patchPartnerMeSettingsOperational);
router.patch('/partner/me/settings/display', protect, authorize('lab_partner'), attachLabProfile, ctrl.patchPartnerMeSettingsDisplay);
router.patch('/partner/me/settings/notifications', protect, authorize('lab_partner'), attachLabProfile, ctrl.patchPartnerMeSettingsNotifications);
router.patch('/partner/me/settings/contact-persons', protect, authorize('lab_partner'), attachLabProfile, ctrl.patchPartnerMeSettingsContactPersons);
router.patch('/partner/me/settings/timing', protect, authorize('lab_partner'), attachLabProfile, ctrl.patchPartnerMeSettingsTiming);
router.patch('/partner/me/settings/images', protect, authorize('lab_partner'), attachLabProfile, upload.fields([
    { name: 'logo',       maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]), ctrl.patchPartnerMeSettingsImages);
router.patch('/partner/me/change-password', protect, authorize('lab_partner'), ctrl.patchPartnerMeChangePassword);
router.post('/partner/me/security/request-email-change', protect, authorize('lab_partner'), ctrl.postPartnerMeSecurityRequestEmailChange);
router.patch('/partner/me/security/confirm-email-change', protect, authorize('lab_partner'), ctrl.patchPartnerMeSecurityConfirmEmailChange);
router.get('/partner/me/security/sessions', protect, authorize('lab_partner'), ctrl.getPartnerMeSecuritySessions);
router.delete('/partner/me/security/sessions/:sessionId', protect, authorize('lab_partner'), ctrl.deletePartnerMeSecuritySessionsBySessionId);
router.delete('/partner/me/security/sessions', protect, authorize('lab_partner'), ctrl.deletePartnerMeSecuritySessions);
router.get('/partner/me/security/login-history', protect, authorize('lab_partner'), ctrl.getPartnerMeSecurityLoginHistory);
router.post('/partner/me/security/send-verification-otp', protect, authorize('lab_partner'), ctrl.postPartnerMeSecuritySendVerificationOtp);
router.post('/partner/me/security/verify-email', protect, authorize('lab_partner'), ctrl.postPartnerMeSecurityVerifyEmail);
router.get('/partner/me/notifications', protect, authorize('lab_partner'), ctrl.getPartnerMeNotifications);
router.patch('/partner/me/notifications/:notificationId/read', protect, authorize('lab_partner'), ctrl.patchPartnerMeNotificationsByNotificationIdRead);
router.patch('/partner/me/notifications/read-all', protect, authorize('lab_partner'), ctrl.patchPartnerMeNotificationsReadAll);
router.delete('/partner/me/notifications/:notificationId', protect, authorize('lab_partner'), ctrl.deletePartnerMeNotificationsByNotificationId);
router.delete('/partner/me/notifications', protect, authorize('lab_partner'), ctrl.deletePartnerMeNotifications);
router.get('/partner/me/dashboard', protect, authorize('lab_partner'), attachLabProfile, cache(30, (req) => `lab:${req.lab._id}:dashboard`), ctrl.getPartnerMeDashboard);
router.get('/partner/me/analytics/reviews', protect, authorize('lab_partner'), attachLabProfile, ctrl.getPartnerMeAnalyticsReviews);
router.post('/admin', protect, authorize('admin', 'superadmin'), upload.fields([
    { name: 'logo',       maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]), ctrl.postAdmin);
router.get('/admin', protect, authorize('admin', 'superadmin'), ctrl.getAdmin);
router.get('/admin/:id', protect, authorize('admin', 'superadmin'), ctrl.getAdminById);
router.patch('/admin/:id', protect, authorize('admin', 'superadmin'), upload.fields([
    { name: 'logo',       maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
  ]), ctrl.patchAdminById);
router.patch('/admin/:id/status', protect, authorize('admin', 'superadmin'), ctrl.patchAdminByIdStatus);
router.patch('/admin/:id/platform-fee', protect, authorize('admin', 'superadmin'), ctrl.patchAdminByIdPlatformFee);
router.delete('/admin/:id/platform-fee', protect, authorize('admin', 'superadmin'), ctrl.deleteAdminByIdPlatformFee);
router.post('/admin/:id/tests', protect, authorize('admin', 'superadmin'), upload.single('reportTemplate'), ctrl.postAdminByIdTests);
router.patch('/admin/:id/tests/:testId', protect, authorize('admin', 'superadmin'), upload.single('reportTemplate'), ctrl.patchAdminByIdTestsByTestId);
router.delete('/admin/:id/tests/:testId', protect, authorize('admin', 'superadmin'), ctrl.deleteAdminByIdTestsByTestId);
router.post('/admin/:id/packages', protect, authorize('admin', 'superadmin'), ctrl.postAdminByIdPackages);
router.patch('/admin/:id/packages/:pkgId', protect, authorize('admin', 'superadmin'), ctrl.patchAdminByIdPackagesByPkgId);
router.delete('/admin/:id/packages/:pkgId', protect, authorize('admin', 'superadmin'), ctrl.deleteAdminByIdPackagesByPkgId);
router.post('/admin/:id/accreditations', protect, authorize('admin', 'superadmin'), upload.single('certificate'), ctrl.postAdminByIdAccreditations);
router.post('/admin/:id/compliance-docs', protect, authorize('admin', 'superadmin'), upload.single('document'), ctrl.postAdminByIdComplianceDocs);
router.post('/admin/:id/verify-doc/:docId', protect, authorize('admin', 'superadmin'), ctrl.postAdminByIdVerifyDocByDocId);
router.patch('/admin/:id/verify-bank', protect, authorize('admin', 'superadmin'), ctrl.patchAdminByIdVerifyBank);
router.get('/admin/:id/reviews', protect, authorize('admin', 'superadmin'), ctrl.getAdminByIdReviews);
router.patch('/admin/:id/reviews/:reviewId', protect, authorize('admin', 'superadmin'), ctrl.patchAdminByIdReviewsByReviewId);
router.delete('/admin/:id/reviews/:reviewId', protect, authorize('admin', 'superadmin'), ctrl.deleteAdminByIdReviewsByReviewId);
router.patch('/admin/:id/resend-credentials', protect, authorize('superadmin'), ctrl.patchAdminByIdResendCredentials);
router.post('/admin/:id/send-notification', protect, authorize('admin', 'superadmin'), ctrl.postAdminByIdSendNotification);
router.get('/admin/stats/overview', protect, authorize('admin', 'superadmin'), cache(60), ctrl.getAdminStatsOverview);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;