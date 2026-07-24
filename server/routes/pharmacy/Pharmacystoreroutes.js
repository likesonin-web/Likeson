/**
 * pharmacy/Pharmacystoreroutes.js — Likeson.in
 * Business logic lives in controllers/pharmacy/pharmacystore.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // <-- Added multer for file uploads
import { protect, authorize, attachPharmacyStore } from '../../middleware/authMiddleware.js';
import cache from '../../middleware/cache.js'; // <-- Added missing cache import
import * as ctrl from '../../controllers/pharmacy/pharmacystore.controller.js';

const router = express.Router();

// Define Multer upload middleware (Adjust 'uploads/' to your actual storage config if needed)
const upload = multer({ dest: 'uploads/' });

router.get('/hsn', protect, authorize('pharmacy', 'admin', 'superadmin'), cache(120), ctrl.getHsn);
router.get('/hsn/stats', protect, authorize('superadmin', 'admin'), cache(300, () => 'GET:pharmacy:hsn:stats'), ctrl.getHsnStats);
router.post('/hsn/bulk-delete', protect, authorize('superadmin'), ctrl.postHsnBulkDelete);

// Now upload is defined and won't crash
router.post('/hsn/upload', protect, authorize('superadmin', 'admin'), upload.single('file'), ctrl.postHsnUpload);

router.get('/hsn/:code', protect, authorize('pharmacy', 'admin', 'superadmin'), cache(300, (req) => `hsn:code:${req.params.code.toUpperCase().trim()}`), ctrl.getHsnByCode);
router.post('/hsn', protect, authorize('superadmin', 'admin'), ctrl.postHsn);
router.patch('/hsn/:code', protect, authorize('superadmin', 'admin'), ctrl.patchHsnByCode);
router.delete('/hsn/:code', protect, authorize('superadmin'), ctrl.deleteHsnByCode);
router.get('/orders', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getOrders);
router.get('/orders/:orderId', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getOrdersByOrderId);
router.get('/orders/:orderId/pricing-breakdown', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getOrdersByOrderIdPricingBreakdown);
router.post('/orders/:orderId/verify-prescription', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postOrdersByOrderIdVerifyPrescription);
router.post('/orders/:orderId/confirm', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postOrdersByOrderIdConfirm);
router.patch('/orders/:orderId/status', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.patchOrdersByOrderIdStatus);
router.post('/orders/:orderId/return-accept', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postOrdersByOrderIdReturnAccept);
router.post('/orders/:orderId/process-refund', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postOrdersByOrderIdProcessRefund);
router.post('/orders/:orderId/add-admin-note', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postOrdersByOrderIdAddAdminNote);
router.post('/orders/:orderId/assign-delivery-partner', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postOrdersByOrderIdAssignDeliveryPartner);
router.get('/orders/:orderId/export', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getOrdersByOrderIdExport);
router.post('/orders/:orderId/pickup-verify', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postOrdersByOrderIdPickupVerify);
router.get('/orders/:orderId/invoice', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getOrdersByOrderIdInvoice);
router.get('/orders/:orderId/label', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getOrdersByOrderIdLabel);
router.get('/medicines', protect, authorize('pharmacy'), attachPharmacyStore, cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:medicines:${JSON.stringify(req.query)}`), ctrl.getMedicines);
router.get('/medicines/:medicineId/inventory', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getMedicinesByMedicineIdInventory);
router.post('/medicines/:medicineId/add-stock', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postMedicinesByMedicineIdAddStock);
router.patch('/medicines/:medicineId/deduct-stock', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.patchMedicinesByMedicineIdDeductStock);
router.get('/medicines/:medicineId/stock', protect, authorize('pharmacy'), attachPharmacyStore, cache(30, (req) => `pharmacy:${req.pharmacy?.store?._id}:med-stock:${req.params.medicineId}`), ctrl.getMedicinesByMedicineIdStock);
router.patch('/medicines/:medicineId/inventory', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.patchMedicinesByMedicineIdInventory);
router.get('/inventory/batches', protect, authorize('pharmacy'), attachPharmacyStore, cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:batches:${JSON.stringify(req.query)}`), ctrl.getInventoryBatches);
router.patch('/inventory/batches/:batchId', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.patchInventoryBatchesByBatchId);
router.get('/inventory/expiry-alerts', protect, authorize('pharmacy'), attachPharmacyStore, cache(120, (req) => `pharmacy:${req.pharmacy?.store?._id}:expiry-alerts`), ctrl.getInventoryExpiryAlerts);
router.get('/inventory/low-stock', protect, authorize('pharmacy'), attachPharmacyStore, cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:low-stock`), ctrl.getInventoryLowStock);
router.post('/medicines/:medicineId/request-stock', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postMedicinesByMedicineIdRequestStock);
router.get('/inventory/movements', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getInventoryMovements);
router.get('/suppliers', protect, authorize('pharmacy', 'admin', 'superadmin'), ctrl.getSuppliers);
router.post('/suppliers', protect, authorize('admin', 'superadmin'), ctrl.postSuppliers);
router.get('/suppliers/:id', protect, authorize('pharmacy', 'admin', 'superadmin'), ctrl.getSuppliersById);
router.patch('/suppliers/:id', protect, authorize('admin', 'superadmin'), ctrl.patchSuppliersById);
router.delete('/suppliers/:id', protect, authorize('admin', 'superadmin'), ctrl.deleteSuppliersById);
router.get('/purchase-orders', protect, authorize('pharmacy', 'admin', 'superadmin'), attachPharmacyStore, ctrl.getPurchaseOrders);
router.post('/purchase-orders', protect, authorize('pharmacy', 'admin', 'superadmin'), attachPharmacyStore, ctrl.postPurchaseOrders);
router.get('/purchase-orders/:id', protect, authorize('pharmacy', 'admin', 'superadmin'), attachPharmacyStore, ctrl.getPurchaseOrdersById);
router.patch('/purchase-orders/:id/status', protect, authorize('pharmacy', 'admin', 'superadmin'), attachPharmacyStore, ctrl.patchPurchaseOrdersByIdStatus);
router.post('/purchase-orders/:id/receive', protect, authorize('pharmacy', 'admin', 'superadmin'), attachPharmacyStore, ctrl.postPurchaseOrdersByIdReceive);
router.get('/financials/daily', protect, authorize('pharmacy'), attachPharmacyStore, cache(120, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:daily:${req.query.date || 'today'}`), ctrl.getFinancialsDaily);
router.get('/financials/monthly', protect, authorize('pharmacy'), attachPharmacyStore, cache(300, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:monthly:${req.query.month || 'current'}`), ctrl.getFinancialsMonthly);
router.get('/financials/total', protect, authorize('pharmacy'), attachPharmacyStore, cache(600, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:total`), ctrl.getFinancialsTotal);
router.get('/financials/history', protect, authorize('pharmacy'), attachPharmacyStore, cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:history:${JSON.stringify(req.query)}`), ctrl.getFinancialsHistory);
router.get('/financials/cod-pending', protect, authorize('pharmacy', 'admin', 'superadmin'), attachPharmacyStore, cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:financial:cod-pending`), ctrl.getFinancialsCodPending);
router.get('/financials/store-invoice', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getFinancialsStoreInvoice);
router.post('/financials/store-invoice/send', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postFinancialsStoreInvoiceSend);
router.get('/financials/payment-account', protect, authorize('pharmacy'), ctrl.getFinancialsPaymentAccount);
router.post('/financials/payment-account/bank', protect, authorize('pharmacy'), ctrl.postFinancialsPaymentAccountBank);
router.patch('/financials/payment-account/bank/:bankId', protect, authorize('pharmacy'), ctrl.patchFinancialsPaymentAccountBankByBankId);
router.delete('/financials/payment-account/bank/:bankId', protect, authorize('pharmacy'), ctrl.deleteFinancialsPaymentAccountBankByBankId);
router.post('/financials/payment-account/upi', protect, authorize('pharmacy'), ctrl.postFinancialsPaymentAccountUpi);
router.delete('/financials/payment-account/upi/:upiId', protect, authorize('pharmacy'), ctrl.deleteFinancialsPaymentAccountUpiByUpiId);
router.get('/financials/settlements', protect, authorize('pharmacy'), attachPharmacyStore, cache(120, (req) => `pharmacy:${req.pharmacy?.store?._id}:settlements`), ctrl.getFinancialsSettlements);
router.post('/financials/settlements/request', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.postFinancialsSettlementsRequest);
router.get('/financials/settlements/history', protect, authorize('pharmacy'), ctrl.getFinancialsSettlementsHistory);
router.get('/analytics/overview', protect, authorize('pharmacy'), attachPharmacyStore, cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:overview:${req.query.dateFilter}`), ctrl.getAnalyticsOverview);
router.get('/analytics/revenue', protect, authorize('pharmacy'), attachPharmacyStore, cache(180, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:revenue:${req.query.dateFilter}`), ctrl.getAnalyticsRevenue);
router.get('/analytics/returns', protect, authorize('pharmacy'), attachPharmacyStore, cache(180, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:returns:${req.query.dateFilter}`), ctrl.getAnalyticsReturns);
router.get('/analytics/top-medicines', protect, authorize('pharmacy'), attachPharmacyStore, cache(300, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:top-medicines:${req.query.dateFilter}`), ctrl.getAnalyticsTopMedicines);
router.get('/analytics/inventory-value', protect, authorize('pharmacy'), attachPharmacyStore, cache(300, (req) => `pharmacy:${req.pharmacy?.store?._id}:analytics:inv-value`), ctrl.getAnalyticsInventoryValue);
router.get('/profile', protect, authorize('pharmacy'), ctrl.getProfile);
router.put('/profile', protect, authorize('pharmacy'), ctrl.putProfile);
router.put('/profile/password', protect, authorize('pharmacy'), ctrl.putProfilePassword);
router.get('/profile/pharmacy', protect, authorize('pharmacy'), ctrl.getProfilePharmacy);
router.put('/profile/pharmacy', protect, authorize('pharmacy'), ctrl.putProfilePharmacy);
router.get('/store', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.getStore);
router.put('/store', protect, authorize('pharmacy'), attachPharmacyStore, ctrl.putStore);
router.get('/store/inventory-summary', protect, authorize('pharmacy'), attachPharmacyStore, cache(60, (req) => `pharmacy:${req.pharmacy?.store?._id}:inv-summary`), ctrl.getStoreInventorySummary);
router.get('/audit/sessions', protect, authorize('pharmacy'), ctrl.getAuditSessions);
router.delete('/audit/sessions/:sessionId', protect, authorize('pharmacy'), ctrl.deleteAuditSessionsBySessionId);
router.delete('/audit/all-sessions', protect, authorize('pharmacy'), ctrl.deleteAuditAllSessions);
router.get('/audit/devices', protect, authorize('pharmacy'), ctrl.getAuditDevices);
router.delete('/audit/devices/:deviceId', protect, authorize('pharmacy'), ctrl.deleteAuditDevicesByDeviceId);
router.delete('/audit/devices', protect, authorize('pharmacy'), ctrl.deleteAuditDevices);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;