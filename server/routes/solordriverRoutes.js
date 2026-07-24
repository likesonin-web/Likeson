/**
 * solordriverRoutes.js — Likeson.in
 * Business logic lives in controllers/solordriver.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import cache from '../middleware/cache.js';
import { protect, authorize } from '../middleware/authMiddleware.js'; // <-- Added missing auth imports
import * as ctrl from '../controllers/solordriver.controller.js';

const router = express.Router();

// 1. Define the missing Cache Key (CK) helper object
const CK = {
  profile: (id) => `solo:${id}:profile`,
  kyc: (id) => `solo:${id}:kyc`,
  vehicle: (id) => `solo:${id}:vehicle`,
  bankDetails: (id) => `solo:${id}:bank`,
  zones: (id) => `solo:${id}:zones`,
  stats: (id) => `solo:${id}:stats`
};

// 2. Define the missing role guards
const partnerGuard = [protect, authorize('solo_driver')]; // Adjust 'solo_driver' if your DB uses a different role name
const adminGuard = [protect, authorize('admin', 'superadmin')];

// 3. Define missing state-check middlewares 
// (If these exist in another file like authMiddleware.js, import them and remove these mock definitions)
const requireKyc = (req, res, next) => next(); 
const requireActive = (req, res, next) => next();


router.get('/me', ...partnerGuard, cache(60, (req) => CK.profile(req.soloPartner._id)), ctrl.getMe);
router.patch('/me', ...partnerGuard, ctrl.patchMe);
router.patch('/me/contact', ...partnerGuard, ctrl.patchMeContact);
router.patch('/me/address', ...partnerGuard, ctrl.patchMeAddress);
router.patch('/me/professional', ...partnerGuard, ctrl.patchMeProfessional);
router.post('/me/training-certificates', ...partnerGuard, ctrl.postMeTrainingCertificates);
router.delete('/me/training-certificates/:certId', ...partnerGuard, ctrl.deleteMeTrainingCertificatesByCertId);
router.patch('/me/emergency', ...partnerGuard, ctrl.patchMeEmergency);
router.get('/me/settings', ...partnerGuard, ctrl.getMeSettings);
router.patch('/me/settings', ...partnerGuard, ctrl.patchMeSettings);
router.delete('/me', ...partnerGuard, ctrl.deleteMe);

router.get('/kyc', ...partnerGuard, cache(30, (req) => CK.kyc(req.soloPartner._id)), ctrl.getKyc);
router.post('/kyc', ...partnerGuard, ctrl.postKyc);
router.post('/kyc/medical', ...partnerGuard, ctrl.postKycMedical);
router.post('/kyc/psv', ...partnerGuard, ctrl.postKycPsv);

router.get('/vehicle', ...partnerGuard, cache(60, (req) => CK.vehicle(req.soloPartner._id)), ctrl.getVehicle);
router.put('/vehicle', ...partnerGuard, requireKyc, ctrl.putVehicle);
router.patch('/vehicle/documents', ...partnerGuard, ctrl.patchVehicleDocuments);
router.patch('/vehicle/features', ...partnerGuard, ctrl.patchVehicleFeatures);
router.patch('/vehicle/location', ...partnerGuard, requireActive, ctrl.patchVehicleLocation);

router.get('/bank', ...partnerGuard, cache(120, (req) => CK.bankDetails(req.soloPartner._id)), ctrl.getBank);
router.post('/bank', ...partnerGuard, requireKyc, ctrl.postBank);

router.get('/settlement', ...partnerGuard, ctrl.getSettlement);
router.get('/availability', ...partnerGuard, ctrl.getAvailability);
router.patch('/availability', ...partnerGuard, requireActive, ctrl.patchAvailability);

router.get('/service-zones', ...partnerGuard, cache(120, (req) => CK.zones(req.soloPartner._id)), ctrl.getServiceZones);
router.post('/service-zones', ...partnerGuard, ctrl.postServiceZones);
router.patch('/service-zones/:zoneId', ...partnerGuard, ctrl.patchServiceZonesByZoneId);
router.delete('/service-zones/:zoneId', ...partnerGuard, ctrl.deleteServiceZonesByZoneId);

router.get('/pricing', ...partnerGuard, ctrl.getPricing);
router.put('/pricing', ...partnerGuard, ctrl.putPricing);
router.get('/stats', ...partnerGuard, cache(120, (req) => CK.stats(req.soloPartner._id)), ctrl.getStats);
router.get('/rating', ...partnerGuard, ctrl.getRating);
router.get('/compliance', ...partnerGuard, ctrl.getCompliance);

router.get('/security/sessions', ...partnerGuard, ctrl.getSecuritySessions);
router.delete('/security/sessions/:sessionId', ...partnerGuard, ctrl.deleteSecuritySessionsBySessionId);
router.get('/security/devices', ...partnerGuard, ctrl.getSecurityDevices);
router.delete('/security/devices/:deviceId', ...partnerGuard, ctrl.deleteSecurityDevicesByDeviceId);
router.post('/security/change-password', ...partnerGuard, ctrl.postSecurityChangePassword);

router.get('/notifications', ...partnerGuard, ctrl.getNotifications);
router.patch('/notifications/:id/read', ...partnerGuard, ctrl.patchNotificationsByIdRead);
router.patch('/notifications/read-all', ...partnerGuard, ctrl.patchNotificationsReadAll);

router.get('/dispatch/status', ...partnerGuard, ctrl.getDispatchStatus);
router.patch('/dispatch/status', ...partnerGuard, requireActive, ctrl.patchDispatchStatus);
router.patch('/dispatch/shift', ...partnerGuard, requireActive, ctrl.patchDispatchShift);

router.get('/performance', ...partnerGuard, ctrl.getPerformance);
router.get('/rewards', ...partnerGuard, ctrl.getRewards);
router.get('/rewards/badges', ...partnerGuard, ctrl.getRewardsBadges);

router.get('/admin/list', ...adminGuard, ctrl.getAdminList);
router.post('/admin/create', ...adminGuard, ctrl.postAdminCreate);
router.get('/admin/:id', ...adminGuard, ctrl.getAdminById);
router.patch('/admin/:id/verify-kyc', ...adminGuard, ctrl.patchAdminByIdVerifyKyc);
router.patch('/admin/:id/verify-vehicle', ...adminGuard, ctrl.patchAdminByIdVerifyVehicle);
router.patch('/admin/:id/verify-bank', ...adminGuard, ctrl.patchAdminByIdVerifyBank);
router.patch('/admin/:id/status', ...adminGuard, ctrl.patchAdminByIdStatus);
router.patch('/admin/:id/block', ...adminGuard, ctrl.patchAdminByIdBlock);
router.patch('/admin/:id/platform-fee', ...adminGuard, ctrl.patchAdminByIdPlatformFee);
router.get('/admin/compliance-alerts', ...adminGuard, ctrl.getAdminComplianceAlerts);
router.post('/admin/:id/notes', ...adminGuard, ctrl.postAdminByIdNotes);
router.patch('/admin/:id/rewards/award-badge', ...adminGuard, ctrl.patchAdminByIdRewardsAwardBadge);
router.patch('/admin/:id/rewards/adjust-coins', ...adminGuard, ctrl.patchAdminByIdRewardsAdjustCoins);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;