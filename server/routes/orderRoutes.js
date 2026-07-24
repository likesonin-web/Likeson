/**
 * orderRoutes.js — Likeson.in
 * Business logic lives in controllers/order.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // <-- Added multer for file uploads
import { protect }    from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import * as ctrl from '../controllers/order.controller.js';

const router = express.Router();

// Define Multer upload middleware (Adjust 'uploads/' to your actual storage config if needed)
const upload = multer({ dest: 'uploads/' });

// Now upload is defined and won't throw a ReferenceError
router.post('/upload/prescription', protect, upload.single('prescription'), ctrl.postUploadPrescription);
router.get('/upload/auth', protect, ctrl.getUploadAuth);
router.get('/medicines', cache(120), ctrl.getMedicines);
router.get('/medicines/:id/stores', ctrl.getMedicinesByIdStores);
router.get('/cart', protect, ctrl.getCart);
router.post('/cart/add', ctrl.postCartAdd);
router.post('/cart/update', protect, ctrl.postCartUpdate);
router.delete('/cart', protect, ctrl.deleteCart);
router.post('/cart/prescription', protect, ctrl.postCartPrescription);

// Here as well
router.post('/cart/prescription/upload', protect, upload.single('prescription'), ctrl.postCartPrescriptionUpload);

router.post('/coupon/validate', protect, ctrl.postCouponValidate);
router.get('/coupon/eligibility', protect, ctrl.getCouponEligibility);
router.get('/checkout/preview', protect, ctrl.getCheckoutPreview);
router.post('/order/checkout', protect, ctrl.postOrderCheckout);
router.post('/order/verify', protect, ctrl.postOrderVerify);
router.post('/wallet/pay', protect, ctrl.postWalletPay);
router.get('/orders/my-orders', protect, ctrl.getOrdersMyOrders);
router.get('/orders/:id', protect, ctrl.getOrdersById);
router.post('/order/upload-prescription', protect, ctrl.postOrderUploadPrescription);

// And here
router.post('/order/upload-prescription/file', protect, upload.single('prescription'), ctrl.postOrderUploadPrescriptionFile);

router.get('/medicines/:id/similar', cache(120), ctrl.getMedicinesByIdSimilar);
router.get('/orders/:id/invoice', protect, ctrl.getOrdersByIdInvoice);
router.get('/orders/:id/invoice/download', protect, ctrl.getOrdersByIdInvoiceDownload);
router.post('/order/cancel', protect, ctrl.postOrderCancel);
router.post('/order/request-return', protect, ctrl.postOrderRequestReturn);
router.post('/order/submit-feedback', protect, ctrl.postOrderSubmitFeedback);
router.post('/wallet/add-money', protect, ctrl.postWalletAddMoney);
router.post('/wallet/verify-topup', protect, ctrl.postWalletVerifyTopup);
router.post('/order/direct', protect, ctrl.postOrderDirect);
router.post('/order/direct/verify', protect, ctrl.postOrderDirectVerify);
router.post('/order/verify-delivery-otp', protect, ctrl.postOrderVerifyDeliveryOtp);
router.get('/delivery/pricing', protect, ctrl.getDeliveryPricing);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;