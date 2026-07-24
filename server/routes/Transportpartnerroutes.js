/**
 * Transportpartnerroutes.js — Likeson.in
 * Business logic lives in controllers/transportpartner.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import {
  protect,
  authorize,
  getDeviceInfo,
  attachTransportPartnerAgency,
  transportPartnerRoutes,   // [protect, getDeviceInfo, authorize('transportpartner'), attachTP]
} from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import * as ctrl from '../controllers/transportpartner.controller.js';

const router = express.Router();

// Define the missing admin and superadmin middlewares
const adminOnly = [protect, authorize('admin', 'superadmin')];
const superOnly = [protect, authorize('superadmin')];

router.get('/profile', transportPartnerRoutes, cache(60, (req) => `tp:${req.transportPartner.agency._id}`), ctrl.getProfile);
router.patch('/profile', transportPartnerRoutes, ctrl.patchProfile);
router.put('/kyc', transportPartnerRoutes, ctrl.putKyc);
router.get('/kyc/status', transportPartnerRoutes, ctrl.getKycStatus);
router.patch('/settings/notifications', transportPartnerRoutes, ctrl.patchSettingsNotifications);
router.patch('/settings/availability', transportPartnerRoutes, ctrl.patchSettingsAvailability);
router.patch('/settings/settlement-cycle', transportPartnerRoutes, ctrl.patchSettingsSettlementCycle);
router.get('/security/sessions', transportPartnerRoutes, ctrl.getSecuritySessions);
router.delete('/security/sessions/:sessionId', transportPartnerRoutes, ctrl.deleteSecuritySessionsBySessionId);
router.delete('/security/sessions', transportPartnerRoutes, ctrl.deleteSecuritySessions);
router.delete('/security/device-tokens/:tokenId', transportPartnerRoutes, ctrl.deleteSecurityDeviceTokensByTokenId);
router.get('/vehicles', transportPartnerRoutes, cache(60, (req) => `tp:${req.transportPartner.agency._id}:vehicles`), ctrl.getVehicles);
router.get('/vehicles/:vehicleId', transportPartnerRoutes, ctrl.getVehiclesByVehicleId);
router.post('/vehicles', transportPartnerRoutes, ctrl.postVehicles);
router.patch('/vehicles/:vehicleId', transportPartnerRoutes, ctrl.patchVehiclesByVehicleId);
router.delete('/vehicles/:vehicleId', transportPartnerRoutes, ctrl.deleteVehiclesByVehicleId);
router.patch('/vehicles/:vehicleId/assign-driver', transportPartnerRoutes, ctrl.patchVehiclesByVehicleIdAssignDriver);
router.patch('/vehicles/:vehicleId/unassign-driver', transportPartnerRoutes, ctrl.patchVehiclesByVehicleIdUnassignDriver);
router.post('/vehicles/:vehicleId/photos', transportPartnerRoutes, ctrl.postVehiclesByVehicleIdPhotos);
router.get('/drivers', transportPartnerRoutes, cache(60, (req) => `tp:${req.transportPartner.agency._id}:drivers:${req.query.status || 'all'}`), ctrl.getDrivers);
router.get('/drivers/:driverId', transportPartnerRoutes, cache(30, (req) => `tp:${req.transportPartner.agency._id}:driver:${req.params.driverId}`), ctrl.getDriversByDriverId);
router.post('/drivers', transportPartnerRoutes, ctrl.postDrivers);
router.patch('/drivers/:driverId', transportPartnerRoutes, ctrl.patchDriversByDriverId);
router.patch('/drivers/:driverId/toggle-active', transportPartnerRoutes, ctrl.patchDriversByDriverIdToggleActive);
router.patch('/drivers/:driverId/pause', transportPartnerRoutes, ctrl.patchDriversByDriverIdPause);
router.patch('/drivers/:driverId/unpause', transportPartnerRoutes, ctrl.patchDriversByDriverIdUnpause);
router.delete('/drivers/:driverId', transportPartnerRoutes, ctrl.deleteDriversByDriverId);
router.get('/drivers/:driverId/performance', transportPartnerRoutes, cache(120, (req) => `tp:${req.transportPartner.agency._id}:driver:${req.params.driverId}:perf`), ctrl.getDriversByDriverIdPerformance);
router.get('/bank', transportPartnerRoutes, ctrl.getBank);
router.post('/bank/accounts', transportPartnerRoutes, ctrl.postBankAccounts);
router.patch('/bank/accounts/:accountId/set-primary', transportPartnerRoutes, ctrl.patchBankAccountsByAccountIdSetPrimary);
router.delete('/bank/accounts/:accountId', transportPartnerRoutes, ctrl.deleteBankAccountsByAccountId);
router.post('/bank/upi', transportPartnerRoutes, ctrl.postBankUpi);
router.delete('/bank/upi/:upiId', transportPartnerRoutes, ctrl.deleteBankUpiByUpiId);
router.patch('/bank/preferred-method', transportPartnerRoutes, ctrl.patchBankPreferredMethod);
router.get('/zones', transportPartnerRoutes, cache(120, (req) => `tp:${req.transportPartner.agency._id}:zones`), ctrl.getZones);
router.post('/zones', transportPartnerRoutes, ctrl.postZones);
router.patch('/zones/:zoneId', transportPartnerRoutes, ctrl.patchZonesByZoneId);
router.delete('/zones/:zoneId', transportPartnerRoutes, ctrl.deleteZonesByZoneId);
router.get('/pricing', transportPartnerRoutes, ctrl.getPricing);
router.patch('/pricing', transportPartnerRoutes, ctrl.patchPricing);
router.get('/dashboard', transportPartnerRoutes, cache(120, (req) => `tp:${req.transportPartner.agency._id}:stats`), ctrl.getDashboard);
router.get('/logs', transportPartnerRoutes, ctrl.getLogs);
router.get('/drivers/:driverId/logs', transportPartnerRoutes, ctrl.getDriversByDriverIdLogs);

router.get('/driver/me', protect, getDeviceInfo, authorize('driver'), ctrl.getDriverMe);
router.patch('/driver/me', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverMe);
router.put('/driver/kyc', protect, getDeviceInfo, authorize('driver'), ctrl.putDriverKyc);
router.patch('/driver/shift', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverShift);
router.patch('/driver/status', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverStatus);
router.patch('/driver/location', protect, authorize('driver'), ctrl.patchDriverLocation);
router.get('/driver/rewards', protect, authorize('driver'), ctrl.getDriverRewards);
router.put('/driver/bank', protect, getDeviceInfo, authorize('driver'), ctrl.putDriverBank);
router.get('/driver/logs', protect, authorize('driver'), ctrl.getDriverLogs);
router.patch('/driver/me/photo', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverMePhoto);
router.delete('/driver/me/photo', protect, getDeviceInfo, authorize('driver'), ctrl.deleteDriverMePhoto);
router.patch('/driver/me/emergency', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverMeEmergency);
router.patch('/driver/me/notifs', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverMeNotifs);
router.get('/driver/me/performance', protect, authorize('driver'), cache(120, (req) => `driver:${req.user._id}:performance`), ctrl.getDriverMePerformance);
router.get('/driver/me/coins', protect, authorize('driver'), ctrl.getDriverMeCoins);
router.post('/driver/me/certs', protect, getDeviceInfo, authorize('driver'), ctrl.postDriverMeCerts);
router.delete('/driver/me/certs/:certId', protect, getDeviceInfo, authorize('driver'), ctrl.deleteDriverMeCertsByCertId);
router.patch('/driver/kyc/document', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverKycDocument);
router.patch('/driver/kyc/licence-numbers', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverKycLicenceNumbers);
router.put('/driver/medical-fitness', protect, getDeviceInfo, authorize('driver'), ctrl.putDriverMedicalFitness);
router.get('/driver/me/compliance', protect, authorize('driver'), ctrl.getDriverMeCompliance);
router.patch('/driver/onboarding', protect, getDeviceInfo, authorize('driver'), ctrl.patchDriverOnboarding);
router.post('/driver/onboarding/complete', protect, getDeviceInfo, authorize('driver'), ctrl.postDriverOnboardingComplete);

router.get('/admin/partners', adminOnly, cache(60, (req) => `admin:tp:list:${JSON.stringify(req.query)}`), ctrl.getAdminPartners);
router.get('/admin/partners/:partnerId', adminOnly, cache(30, (req) => `admin:tp:${req.params.partnerId}`), ctrl.getAdminPartnersByPartnerId);
router.post('/admin/partners', adminOnly, ctrl.postAdminPartners);
router.patch('/admin/partners/:partnerId', adminOnly, ctrl.patchAdminPartnersByPartnerId);
router.patch('/admin/partners/:partnerId/status', adminOnly, ctrl.patchAdminPartnersByPartnerIdStatus);
router.patch('/admin/partners/:partnerId/kyc', adminOnly, ctrl.patchAdminPartnersByPartnerIdKyc);
router.patch('/admin/partners/:partnerId/internal-notes', adminOnly, ctrl.patchAdminPartnersByPartnerIdInternalNotes);
router.delete('/admin/partners/:partnerId', superOnly, ctrl.deleteAdminPartnersByPartnerId);
router.get('/admin/vehicles/pending', adminOnly, cache(60, () => 'admin:vehicles:pending'), ctrl.getAdminVehiclesPending);
router.patch('/admin/vehicles/:vehicleId/verify', adminOnly, ctrl.patchAdminVehiclesByVehicleIdVerify);
router.get('/admin/drivers', adminOnly, cache(60, (req) => `admin:drivers:list:${JSON.stringify(req.query)}`), ctrl.getAdminDrivers);
router.get('/admin/drivers/:driverId', adminOnly, cache(30, (req) => `admin:driver:${req.params.driverId}`), ctrl.getAdminDriversByDriverId);
router.patch('/admin/drivers/:driverId/kyc', adminOnly, ctrl.patchAdminDriversByDriverIdKyc);
router.patch('/admin/drivers/:driverId/block', adminOnly, ctrl.patchAdminDriversByDriverIdBlock);
router.patch('/admin/drivers/:driverId/unblock', adminOnly, ctrl.patchAdminDriversByDriverIdUnblock);
router.patch('/admin/drivers/:driverId/admin-notes', adminOnly, ctrl.patchAdminDriversByDriverIdAdminNotes);
router.post('/admin/drivers/:driverId/coins', adminOnly, ctrl.postAdminDriversByDriverIdCoins);
router.get('/admin/drivers/available', adminOnly, ctrl.getAdminDriversAvailable);
router.get('/admin/pricing/global', adminOnly, cache(120, () => 'admin:pricing:global'), ctrl.getAdminPricingGlobal);
router.patch('/admin/pricing/global', superOnly, ctrl.patchAdminPricingGlobal);
router.patch('/admin/partners/:partnerId/platform-fee', adminOnly, ctrl.patchAdminPartnersByPartnerIdPlatformFee);
router.patch('/admin/partners/:partnerId/settlement', adminOnly, ctrl.patchAdminPartnersByPartnerIdSettlement);
router.get('/admin/logs', adminOnly, ctrl.getAdminLogs);
router.get('/admin/partners/:partnerId/logs', adminOnly, ctrl.getAdminPartnersByPartnerIdLogs);
router.get('/admin/drivers/:driverId/logs', adminOnly, ctrl.getAdminDriversByDriverIdLogs);
router.get('/admin/stats', adminOnly, cache(300, () => 'admin:transport:stats'), ctrl.getAdminStats);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;