/**
 * refundController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Express routes for admin-facing refund operations.
 *
 * Mount at: /api/v1/orders/refund
 *
 * Routes:
 *   POST   /:orderId/initiate    — manual trigger (admin) or retry Failed
 *   GET    /:orderId/preview     — dry-run: show amounts without processing
 *   PATCH  /:orderId/status      — admin update refundStatus (mark Processed manually)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import PharmacyOrder            from '../models/PharmacyOrder.js';
import { initiateRefund, computeRefundAmount, REFUND_ERRORS } from '../services/refundService.js';
import { protect, authorize }   from '../middleware/authMiddleware.js';

const router = express.Router({ mergeParams: true });

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── GET /api/v1/orders/refund/:orderId/preview ────────────────────────────────
// Dry-run: returns exact amounts that would be refunded. No DB write.


// GET '/:orderId/preview'
export const getByOrderIdPreview = asyncHandler(async (req, res) => {
    const order = await PharmacyOrder
      .findOne({ orderId: req.params.orderId })
      .select('billing payment cancellation orderId')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const { cashRefundAmount, walletRefundAmount } = computeRefundAmount(order.billing);

    return res.status(200).json({
      success: true,
      data: {
        orderId:            order.orderId,
        paymentMethod:      order.payment.method,
        selectedMethod:     order.cancellation.selectedRefundMethod,
        currentStatus:      order.cancellation.refundStatus,
        billing: {
          totalPayable:     order.billing.totalPayable,
          discountAmount:   order.billing.discountAmount,
          walletAmountUsed: order.billing.walletAmountUsed,
          platformFee:      order.billing.platformFee,
        },
        refundPreview: {
          cashRefundAmount,       // sent back via Razorpay / bank
          walletRefundAmount,     // credited to wallet
          totalRefundValue:       cashRefundAmount + walletRefundAmount,
          note: 'discountAmount excluded — customer never paid it. platformFee included.',
        },
      },
    });
  });

// POST '/:orderId/initiate'
export const postByOrderIdInitiate = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const {
      overrideMethod, // 'Wallet' | 'Online' | 'Bank_Transfer' | 'Custom_Bank'
      adminNote,
    } = req.body;

    // Fetch _id from human-readable orderId
    const order = await PharmacyOrder
      .findOne({ orderId })
      .select('_id cancellation payment')
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Guard: don't re-process already Processed refunds
    if (order.cancellation?.refundStatus === 'Processed') {
      return res.status(409).json({
        success: false,
        message: 'Refund already processed for this order',
        refundId: order.cancellation?.refundId,
      });
    }

    // Guard: order must be in Accepted state (or admin is forcing)
    if (
      order.cancellation?.returnDecision !== 'Accepted' &&
      !overrideMethod
    ) {
      return res.status(400).json({
        success: false,
        message: 'Return not yet accepted. Pass overrideMethod to force.',
      });
    }

    const result = await initiateRefund(order._id.toString(), {
      adminNote:      adminNote || `Manual refund initiated by ${req.user.email}`,
      overrideMethod,
    });

    return res.status(200).json({ success: true, data: result });
  });

// PATCH '/:orderId/status'
export const patchByOrderIdStatus = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const { refundStatus, adminRefundNote, refundId } = req.body;

    const ALLOWED_STATUS = ['Processed', 'Failed', 'In-Progress'];
    if (!ALLOWED_STATUS.includes(refundStatus)) {
      return res.status(400).json({
        success: false,
        message: `refundStatus must be one of: ${ALLOWED_STATUS.join(', ')}`,
      });
    }

    const update = {
      'cancellation.refundStatus':   refundStatus,
      'cancellation.adminRefundNote': adminRefundNote,
      ...(refundId && { 'cancellation.refundId': refundId }),
      ...(refundStatus === 'Processed' && {
        'cancellation.refundedAt': new Date(),
        'payment.status':          'Refunded',
      }),
    };

    const order = await PharmacyOrder.findOneAndUpdate(
      { orderId },
      {
        $set: update,
        $push: {
          'payment.transactionLog': {
            action:    'REFUND_STATUS_UPDATED',
            status:    refundStatus.toLowerCase(),
            note:      adminRefundNote || `Status updated by ${req.user.email}`,
            metadata:  { refundId, updatedBy: req.user._id },
            timestamp: new Date(),
          },
          adminNotes: {
            text:    `Refund status manually set to ${refundStatus}. ${adminRefundNote || ''}`.trim(),
            addedBy: req.user._id,
            addedAt: new Date(),
          },
        },
      },
      { new: true, runValidators: true },
    ).select('orderId cancellation payment');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, data: order });
  });

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, _next) => {
  const STATUS_MAP = {
    [REFUND_ERRORS.ORDER_NOT_FOUND]:        404,
    [REFUND_ERRORS.ALREADY_REFUNDED]:       409,
    [REFUND_ERRORS.INVALID_METHOD]:         400,
    [REFUND_ERRORS.COD_ONLINE_NOT_ALLOWED]: 400,
    [REFUND_ERRORS.NO_RAZORPAY_PAYMENT]:    422,
    [REFUND_ERRORS.RAZORPAY_FAILED]:        502,
    [REFUND_ERRORS.WALLET_CREDIT_FAILED]:   500,
    [REFUND_ERRORS.ZERO_AMOUNT]:            400,
  };

  const statusCode = STATUS_MAP[err.code] || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message,
    code:    err.code,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
