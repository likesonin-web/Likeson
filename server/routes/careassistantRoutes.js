/**
 * careassistantRoutes.js — Likeson.in
 * Business logic lives in controllers/careassistant.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // Added for file uploads
import { protect, authorize } from '../middleware/authMiddleware.js'; // Added for auth
import * as ctrl from '../controllers/careassistant.controller.js';

const router = express.Router();

// 1. Define Multer upload middleware (Change 'uploads/' to your actual config/storage if needed)
const upload = multer({ dest: 'uploads/' });

// 2. Define the missing role-based middlewares using your existing protect/authorize functions
const isAdmin = [protect, authorize('admin', 'superadmin')];
const isCareAssistant = [protect, authorize('careassistant')]; // (Adjust 'careassistant' if your role is named differently, e.g., 'careAssistant')

router.post('/admin/create', isAdmin, ctrl.postAdminCreate);
router.get('/profile', isCareAssistant, ctrl.getProfile);
router.put('/profile', isCareAssistant, ctrl.putProfile);
router.get('/upload/auth', isCareAssistant, ctrl.getUploadAuth);
router.post('/upload/photo', isCareAssistant, upload.single('photo'), ctrl.postUploadPhoto);
router.post('/upload/document', isCareAssistant, upload.single('document'), ctrl.postUploadDocument);
router.put('/kyc/submit', isCareAssistant, ctrl.putKycSubmit);
router.get('/kyc/status', isCareAssistant, ctrl.getKycStatus);
router.put('/training', isCareAssistant, ctrl.putTraining);
router.post('/training/certificates', isCareAssistant, ctrl.postTrainingCertificates);
router.delete('/training/certificates/:certId', isCareAssistant, ctrl.deleteTrainingCertificatesByCertId);
router.get('/schedule', isCareAssistant, ctrl.getSchedule);
router.put('/schedule', isCareAssistant, ctrl.putSchedule);
router.patch('/availability', isCareAssistant, ctrl.patchAvailability);
router.patch('/location', isCareAssistant, ctrl.patchLocation);
router.patch('/status', isCareAssistant, ctrl.patchStatus);
router.get('/bank', isCareAssistant, ctrl.getBank);
router.put('/bank', isCareAssistant, ctrl.putBank);
router.put('/health-declaration', isCareAssistant, ctrl.putHealthDeclaration);
router.patch('/onboarding/step', isCareAssistant, ctrl.patchOnboardingStep);
router.patch('/onboarding/complete', isCareAssistant, ctrl.patchOnboardingComplete);
router.get('/settings', isCareAssistant, ctrl.getSettings);
router.put('/settings/notifications', isCareAssistant, ctrl.putSettingsNotifications);
router.put('/settings/service-area', isCareAssistant, ctrl.putSettingsServiceArea);
router.post('/settings/device-token', isCareAssistant, ctrl.postSettingsDeviceToken);
router.delete('/settings/device-token', isCareAssistant, ctrl.deleteSettingsDeviceToken);
router.put('/security/change-password', isCareAssistant, ctrl.putSecurityChangePassword);
router.post('/security/send-email-otp', isCareAssistant, ctrl.postSecuritySendEmailOtp);
router.post('/security/verify-email-otp', isCareAssistant, ctrl.postSecurityVerifyEmailOtp);
router.get('/security/sessions', isCareAssistant, ctrl.getSecuritySessions);
router.delete('/security/sessions/:sessionId', isCareAssistant, ctrl.deleteSecuritySessionsBySessionId);
router.delete('/security/sessions', isCareAssistant, ctrl.deleteSecuritySessions);
router.post('/security/request-account-deletion', isCareAssistant, ctrl.postSecurityRequestAccountDeletion);
router.delete('/security/confirm-account-deletion', isCareAssistant, ctrl.deleteSecurityConfirmAccountDeletion);
router.get('/performance', isCareAssistant, ctrl.getPerformance);
router.get('/admin/all', isAdmin, ctrl.getAdminAll);
router.get('/admin/:id', isAdmin, ctrl.getAdminById);
router.patch('/admin/:id/kyc', isAdmin, ctrl.patchAdminByIdKyc);
router.patch('/admin/:id/police-verification', isAdmin, ctrl.patchAdminByIdPoliceVerification);
router.patch('/admin/:id/block', isAdmin, ctrl.patchAdminByIdBlock);
router.patch('/admin/:id/unblock', isAdmin, ctrl.patchAdminByIdUnblock);
router.patch('/admin/:id/verify-certificate/:certId', isAdmin, ctrl.patchAdminByIdVerifyCertificateByCertId);
router.patch('/admin/:id/performance', isAdmin, ctrl.patchAdminByIdPerformance);
router.patch('/admin/:id/notes', isAdmin, ctrl.patchAdminByIdNotes);
router.patch('/admin/:id/bank/verify', isAdmin, ctrl.patchAdminByIdBankVerify);
router.get('/admin/stats/overview', isAdmin, ctrl.getAdminStatsOverview);
router.get('/admin/nearby', isAdmin, ctrl.getAdminNearby);

// Added your central error handler here to stay consistent with your other files
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;