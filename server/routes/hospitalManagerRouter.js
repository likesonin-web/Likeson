/**
 * hospitalManagerRouter.js — Likeson.in
 * Business logic lives in controllers/hospitalManager.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/hospitalManager.controller.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.use(protect)
router.use(authorize('hospital'))
router.get('/profile', ctrl.getProfile);
router.patch('/profile/basic', ctrl.patchProfileBasic);
router.patch('/profile/location', ctrl.patchProfileLocation);
router.post('/upload/logo', upload.single('logo'), ctrl.postUploadLogo);
router.post('/upload/images', upload.array('images', 5), ctrl.postUploadImages);
router.delete('/upload/images', ctrl.deleteUploadImages);
router.post('/upload/license-document', upload.single('document'), ctrl.postUploadLicenseDocument);
router.get('/operating-hours', ctrl.getOperatingHours);
router.put('/operating-hours', ctrl.putOperatingHours);
router.get('/pricing', ctrl.getPricing);
router.patch('/pricing', ctrl.patchPricing);
router.get('/doctors/:doctorProfileId/pricing', ctrl.getDoctorsByDoctorProfileIdPricing);
router.patch('/doctors/:doctorProfileId/pricing', ctrl.patchDoctorsByDoctorProfileIdPricing);
router.get('/platform-fee', ctrl.getPlatformFee);
router.get('/doctors/search', ctrl.getDoctorsSearch);
router.get('/doctors/stats', ctrl.getDoctorsStats);
router.post('/doctors/create-and-link', ctrl.postDoctorsCreateAndLink);
router.get('/doctors', ctrl.getDoctors);
router.get('/doctors/:doctorProfileId', ctrl.getDoctorsByDoctorProfileId);
router.delete('/doctors/:doctorProfileId/unlink', ctrl.deleteDoctorsByDoctorProfileIdUnlink);
router.get('/doctors/:doctorProfileId/availability', ctrl.getDoctorsByDoctorProfileIdAvailability);
router.patch('/registration', ctrl.patchRegistration);
router.get('/onboarding', ctrl.getOnboarding);
router.get('/notifications', ctrl.getNotifications);
router.patch('/notifications/mark-read', ctrl.patchNotificationsMarkRead);
router.get('/security/sessions', ctrl.getSecuritySessions);
router.delete('/security/sessions/:sessionId', ctrl.deleteSecuritySessionsBySessionId);
router.delete('/security/sessions', ctrl.deleteSecuritySessions);
router.get('/security/device-tokens', ctrl.getSecurityDeviceTokens);
router.delete('/security/device-tokens/:tokenId', ctrl.deleteSecurityDeviceTokensByTokenId);
router.patch('/security/change-password', ctrl.patchSecurityChangePassword);
router.patch('/security/notification-preferences', ctrl.patchSecurityNotificationPreferences);
router.get('/dashboard', ctrl.getDashboard);
router.get('/settings/account', ctrl.getSettingsAccount);
router.patch('/settings/account', ctrl.patchSettingsAccount);
router.post('/settings/avatar', upload.single('avatar'), ctrl.postSettingsAvatar);
router.get('/imagekit-auth', ctrl.getImagekitAuth);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;
