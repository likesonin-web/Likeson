/**
 * bloodbankRouter.js — Likeson.in
 * Business logic lives in controllers/bloodbank.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // <-- Added multer for file uploads
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/bloodbank.controller.js';

const router = express.Router();

// Define Multer upload middlewares (Adjust paths to your actual storage config if needed)
const upload = multer({ dest: 'uploads/' });
const prescriptionUpload = multer({ dest: 'uploads/prescriptions/' });

router.get('/', ctrl.get);
router.get('/nearby', ctrl.getNearby);
router.get('/slug/:slug', ctrl.getSlugBySlug);
router.get('/linked', protect, authorize('hospital'), ctrl.getLinked);
router.get('/me', protect, authorize('blood_bank'), ctrl.getMe);
router.get('/me/inventory', protect, authorize('blood_bank'), ctrl.getMeInventory);
router.get('/me/inventory/:invId', protect, authorize('blood_bank'), ctrl.getMeInventoryByInvId);
router.get('/me/requests', protect, authorize('blood_bank'), ctrl.getMeRequests);
router.get('/me/stats', protect, authorize('blood_bank'), ctrl.getMeStats);
router.get('/me/status-log', protect, authorize('blood_bank'), ctrl.getMeStatusLog);
router.get('/admin/all', protect, authorize('admin', 'superadmin'), ctrl.getAdminAll);
router.get('/admin/:id', protect, authorize('admin', 'superadmin'), ctrl.getAdminById);
router.get('/admin/:id/stats', protect, authorize('admin', 'superadmin'), ctrl.getAdminByIdStats);
router.put('/admin/:id/status', protect, authorize('admin', 'superadmin'), ctrl.putAdminByIdStatus);
router.put('/admin/:id/verify', protect, authorize('admin', 'superadmin'), ctrl.putAdminByIdVerify);
router.put('/admin/:id/featured', protect, authorize('admin', 'superadmin'), ctrl.putAdminByIdFeatured);
router.put('/admin/:id/licenses/:licId/verify', protect, authorize('admin', 'superadmin'), ctrl.putAdminByIdLicensesByLicIdVerify);
router.delete('/admin/:id', protect, authorize('superadmin'), ctrl.deleteAdminById);

// Now prescriptionUpload is defined and won't crash
router.post('/prescription/upload', protect, authorize('customer'), prescriptionUpload.single('prescription'), ctrl.postPrescriptionUpload);
router.post('/request/verify-payment', protect, authorize('customer'), ctrl.postRequestVerifyPayment);
router.get('/:id', ctrl.getById);
router.get('/:id/inventory', ctrl.getByIdInventory);
router.get('/:id/inventory/search', ctrl.getByIdInventorySearch);
router.get('/:id/reviews', ctrl.getByIdReviews);
router.post('/:id/reviews', protect, authorize('customer'), ctrl.postByIdReviews);

// Now prescriptionUpload is defined and won't crash
router.post('/:id/request', protect, authorize('customer'), prescriptionUpload.single('prescription'), ctrl.postByIdRequest);
router.post('/:id/link', protect, authorize('hospital'), ctrl.postByIdLink);
router.delete('/:id/link', protect, authorize('hospital'), ctrl.deleteByIdLink);
router.post('/', protect, authorize('blood_bank'), ctrl.post);
router.put('/me', protect, authorize('blood_bank'), ctrl.putMe);

// Now upload is defined and won't crash
router.put('/me/logo', protect, authorize('blood_bank'), upload.single('logo'), ctrl.putMeLogo);
router.put('/me/licenses', protect, authorize('blood_bank'), upload.single('document'), ctrl.putMeLicenses);
router.put('/me/accreditations', protect, authorize('blood_bank'), upload.single('document'), ctrl.putMeAccreditations);

router.put('/me/bank-details', protect, authorize('blood_bank'), ctrl.putMeBankDetails);
router.put('/me/stock-alerts', protect, authorize('blood_bank'), ctrl.putMeStockAlerts);
router.put('/me/pricing', protect, authorize('blood_bank'), ctrl.putMePricing);
router.post('/me/inventory', protect, authorize('blood_bank'), ctrl.postMeInventory);
router.post('/me/inventory/:invId/units', protect, authorize('blood_bank'), ctrl.postMeInventoryByInvIdUnits);
router.put('/me/inventory/:invId/units/:unitId', protect, authorize('blood_bank'), ctrl.putMeInventoryByInvIdUnitsByUnitId);
router.post('/me/inventory/:invId/expiry-check', protect, authorize('blood_bank'), ctrl.postMeInventoryByInvIdExpiryCheck);
router.put('/me/requests/:reqId/respond', protect, authorize('blood_bank'), ctrl.putMeRequestsByReqIdRespond);
router.put('/me/requests/:reqId/issue', protect, authorize('blood_bank'), ctrl.putMeRequestsByReqIdIssue);

// Added your standard error handler to prevent further crashes
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;