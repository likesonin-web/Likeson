/**
 * medicineRoutes.js — Likeson.in
 * Business logic lives in controllers/medicine.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // <-- Added multer for file uploads
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js'; // <-- Added missing cache import
import * as ctrl from '../controllers/medicine.controller.js';

const router = express.Router();

// Define Multer upload middleware (Adjust 'uploads/' to your actual storage config if needed)
const upload = multer({ dest: 'uploads/' });

router.get('/hsn', cache(120), ctrl.getHsn);
router.get('/hsn/stats', protect, authorize('superadmin', 'admin'), cache(300, () => 'GET:medicines:hsn:stats'), ctrl.getHsnStats);
router.post('/hsn/bulk-delete', protect, authorize('superadmin'), ctrl.postHsnBulkDelete);

// Now upload is defined and won't crash
router.post('/hsn/upload', protect, authorize('superadmin', 'admin'), upload.single('file'), ctrl.postHsnUpload);

router.get('/hsn/:code', cache(300, (req) => `hsn:code:${req.params.code.toUpperCase().trim()}`), ctrl.getHsnByCode);
router.post('/hsn', protect, authorize('superadmin', 'admin'), ctrl.postHsn);
router.patch('/hsn/:code', protect, authorize('superadmin', 'admin'), ctrl.patchHsnByCode);
router.delete('/hsn/:code', protect, authorize('superadmin'), ctrl.deleteHsnByCode);
router.get('/', ctrl.get);
router.get('/stores/nearby', ctrl.getStoresNearby);

// --- MOVED SLUG ROUTES HERE (Public access, no user needed) ---
router.get('/stores/slug/:slug', ctrl.getStoresSlugBySlug);
router.get('/:slug', ctrl.getBySlug);
// --------------------------------------------------------------

 

router.get('/admin/stats', authorize('superadmin', 'admin', 'pharmacy'), ctrl.getAdminStats);
router.post('/restock-request', authorize('pharmacy'), ctrl.postRestockRequest);
router.post('/sync-inventory/all', authorize('superadmin'), ctrl.postSyncInventoryAll);
router.get('/orders/:orderId/pricing-breakdown', authorize('admin', 'superadmin'), ctrl.getOrdersByOrderIdPricingBreakdown);
router.get('/inventory/low-stock', authorize('superadmin', 'admin', 'pharmacy'), ctrl.getInventoryLowStock);
router.get('/inventory/expiry-alerts', authorize('superadmin', 'admin', 'pharmacy'), ctrl.getInventoryExpiryAlerts);
router.delete('/stores/:storeId', authorize('superadmin'), ctrl.deleteStoresByStoreId);
router.patch('/stores/:storeId/suspend', authorize('superadmin', 'admin'), ctrl.patchStoresByStoreIdSuspend);
router.patch('/stores/:storeId/unsuspend', authorize('superadmin', 'admin'), ctrl.patchStoresByStoreIdUnsuspend);
router.post('/stores/low-stock/trigger', authorize('superadmin'), ctrl.postStoresLowStockTrigger);
router.get('/stores', authorize('admin', 'superadmin'), ctrl.getStores);
router.get('/stores/my/store', authorize('pharmacy'), ctrl.getStoresMyStore);
router.get('/stores/:id', ctrl.getStoresById); // Note: Already protected by router.use(protect) above
router.get('/stores/:storeId/inventory-summary', authorize('superadmin', 'admin', 'pharmacy'), ctrl.getStoresByStoreIdInventorySummary);
router.post('/', authorize('superadmin', 'admin', 'pharmacy'), ctrl.post);
router.patch('/:id', authorize('superadmin', 'admin', 'pharmacy'), ctrl.patchById);
router.delete('/:id', authorize('superadmin', 'admin'), ctrl.deleteById);
router.get('/:id/inventory', authorize('superadmin', 'admin', 'pharmacy'), ctrl.getByIdInventory);
router.get('/inventory/store/:storeId', authorize('superadmin', 'admin', 'pharmacy'), ctrl.getInventoryStoreByStoreId);
router.get('/:id/inventory/:storeId', authorize('superadmin', 'admin', 'pharmacy'), ctrl.getByIdInventoryByStoreId);
router.post('/:id/inventory', authorize('superadmin', 'admin'), ctrl.postByIdInventory);
router.post('/:id/inventory/:storeId/add-stock', authorize('superadmin', 'admin', 'pharmacy'), ctrl.postByIdInventoryByStoreIdAddStock);
router.patch('/:id/inventory/:storeId', authorize('superadmin', 'admin', 'pharmacy'), ctrl.patchByIdInventoryByStoreId);
router.patch('/:id/inventory/:storeId/deduct-stock', authorize('superadmin', 'admin', 'pharmacy'), ctrl.patchByIdInventoryByStoreIdDeductStock);
router.delete('/:id/inventory/:storeId', authorize('superadmin', 'admin'), ctrl.deleteByIdInventoryByStoreId);
router.post('/:id/sync-inventory', authorize('superadmin', 'admin'), ctrl.postByIdSyncInventory);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;