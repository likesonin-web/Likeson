/**
 * super-admin/adminUserRoutes.js — Likeson.in
 * Business logic lives in controllers/super-admin/adminUser.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../../middleware/authMiddleware.js';
import * as ctrl from '../../controllers/super-admin/adminUser.controller.js';

const router = express.Router();

router.use(protect, authorize('admin', 'superadmin'))
router.get('/ref/hospitals', ctrl.getRefHospitals);
router.get('/ref/hospitals/lab-partners', ctrl.getRefHospitalsLabPartners);
router.get('/ref/pharmacy-stores', ctrl.getRefPharmacyStores);
router.get('/ref/transport-partners', ctrl.getRefTransportPartners);
router.post('/create/customer', ctrl.postCreateCustomer);
router.post('/create/doctor', ctrl.postCreateDoctor);
router.post('/create/lab-partner', ctrl.postCreateLabPartner);
router.post('/create/transport-partner', ctrl.postCreateTransportPartner);
router.post('/create/pharmacy', ctrl.postCreatePharmacy);
router.post('/create/finance', authorize('superadmin'), ctrl.postCreateFinance);
router.post('/create/care-assistant', ctrl.postCreateCareAssistant);
router.get('/', ctrl.get);
router.get('/analytics/overview', ctrl.getAnalyticsOverview);
router.post('/logs', ctrl.postLogs);
router.get('/logs', ctrl.getLogs);
router.get('/logs/analytics', ctrl.getLogsAnalytics);
router.get('/logs/export', authorize('superadmin'), ctrl.getLogsExport);
router.get('/logs/user/:userId', ctrl.getLogsUserByUserId);
router.get('/logs/:logId', ctrl.getLogsByLogId);
router.patch('/logs/:logId', authorize('superadmin'), ctrl.patchLogsByLogId);
router.delete('/logs/:logId', authorize('superadmin'), ctrl.deleteLogsByLogId);
router.delete('/logs', authorize('superadmin'), ctrl.deleteLogs);
router.get('/:id', ctrl.getById);
router.patch('/:id/block', ctrl.patchByIdBlock);
router.patch('/:id/reset-password', ctrl.patchByIdResetPassword);
router.patch('/:id/verify-email', ctrl.patchByIdVerifyEmail);
router.patch('/:id', ctrl.patchById);
router.delete('/:id', authorize('superadmin'), ctrl.deleteById);
router.get('/:id/sessions', ctrl.getByIdSessions);
router.delete('/:id/sessions/:sessionId', ctrl.deleteByIdSessionsBySessionId);
router.delete('/:id/sessions', ctrl.deleteByIdSessions);
router.get('/:id/settings', ctrl.getByIdSettings);
router.patch('/:id/settings', ctrl.patchByIdSettings);
router.delete('/:id/devices', ctrl.deleteByIdDevices);
router.delete('/:id/devices/:deviceId', ctrl.deleteByIdDevicesByDeviceId);
router.get('/:id/security', ctrl.getByIdSecurity);
router.post('/:id/security/send-notification', ctrl.postByIdSecuritySendNotification);
router.post('/:id/security/adjust-coins', authorize('superadmin'), ctrl.postByIdSecurityAdjustCoins);
router.patch('/:id/security/kyc', ctrl.patchByIdSecurityKyc);
router.get('/:id/notifications', ctrl.getByIdNotifications);
router.delete('/:id/notifications', authorize('superadmin'), ctrl.deleteByIdNotifications);

export default router;
