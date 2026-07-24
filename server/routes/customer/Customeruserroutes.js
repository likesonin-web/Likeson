/**
 * customer/Customeruserroutes.js — Likeson.in
 * Business logic lives in controllers/customer/customeruser.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize }    from '../../middleware/authMiddleware.js';
import upload            from '../../middleware/upload.js';
import * as ctrl from '../../controllers/customer/customeruser.controller.js';

const router = express.Router();

router.use(protect)
router.use(authorize('customer'))
router.get('/me', ctrl.getMe);
router.put('/me', ctrl.putMe);
router.put('/me/profile', ctrl.putMeProfile);
router.post('/me/kyc', upload.fields([{ name: 'documentFile', maxCount: 1 }, { name: 'backSideFile', maxCount: 1 }]), ctrl.postMeKyc);
router.get('/me/kyc', ctrl.getMeKyc);
router.delete('/me/kyc/:type', ctrl.deleteMeKycByType);
router.post('/me/government-schemes', upload.single('documentFile'), ctrl.postMeGovernmentSchemes);
router.delete('/me/government-schemes/:schemeId', ctrl.deleteMeGovernmentSchemesBySchemeId);
router.post('/me/private-insurance', upload.single('cardFile'), ctrl.postMePrivateInsurance);
router.delete('/me/private-insurance/:insuranceId', ctrl.deleteMePrivateInsuranceByInsuranceId);
router.post('/me/medical-timeline', upload.array('reportFiles', 5), ctrl.postMeMedicalTimeline);
router.put('/me/medical-timeline/:eventId', ctrl.putMeMedicalTimelineByEventId);
router.delete('/me/medical-timeline/:eventId', ctrl.deleteMeMedicalTimelineByEventId);
router.post('/me/medicine-history', ctrl.postMeMedicineHistory);
router.put('/me/medicine-history/:medId', ctrl.putMeMedicineHistoryByMedId);
router.delete('/me/medicine-history/:medId', ctrl.deleteMeMedicineHistoryByMedId);
router.put('/me/consent', ctrl.putMeConsent);
router.get('/me/snapshot', ctrl.getMeSnapshot);
router.put('/me/snapshot', ctrl.putMeSnapshot);
router.get('/me/audit-sessions', ctrl.getMeAuditSessions);
router.delete('/me/audit-sessions/:sessionId', ctrl.deleteMeAuditSessionsBySessionId);
router.delete('/me/audit-sessions', ctrl.deleteMeAuditSessions);
router.delete('/me/device-tokens/:tokenId', ctrl.deleteMeDeviceTokensByTokenId);
router.post('/me/request-unblock', ctrl.postMeRequestUnblock);
router.get('/me/notifications', ctrl.getMeNotifications);
router.patch('/me/notifications/:id/read', ctrl.patchMeNotificationsByIdRead);
router.patch('/me/notifications/read-all', ctrl.patchMeNotificationsReadAll);
router.get('/me/prescriptions', ctrl.getMePrescriptions);
router.get('/me/prescriptions/:rxNumber', ctrl.getMePrescriptionsByRxNumber);
router.get('/me/reports', ctrl.getMeReports);
router.post('/me/reports/:eventId/upload', upload.array('reportFiles', 5), ctrl.postMeReportsByEventIdUpload);
router.delete('/me/reports/:eventId/file', ctrl.deleteMeReportsByEventIdFile);
router.get('/me/care-records', ctrl.getMeCareRecords);
router.get('/me/care-records/:id', ctrl.getMeCareRecordsById);
router.get('/me/care-records/booking/:bookingId', ctrl.getMeCareRecordsBookingByBookingId);
router.get('/me/care-records/:id/booking-documents', ctrl.getMeCareRecordsByIdBookingDocuments);

export default router;
