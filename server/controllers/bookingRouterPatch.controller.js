/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BOOKING ROUTER — PATCH FILE
 * bookingRouterPatch.js
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PROBLEMS FOUND IN bookingRouter.js + FIXES:
 *
 * ── CRITICAL: Route Order Conflicts ──────────────────────────────────────────
 *
 * Express matches routes TOP → BOTTOM, first match wins.
 * In the original router, GET /:id sits at line 561.
 * Every specific route BELOW it that starts with a static segment gets
 * swallowed — Express treats the static segment as the :id param value.
 *
 * BROKEN ROUTES (specific path after /:id):
 *   GET  /driver/assigned   → "driver" treated as :id
 *   GET  /solo/available    → "solo"   treated as :id
 *   GET  /care/assigned     → "care"   treated as :id
 *   GET  /tp/assigned       → "tp"     treated as :id
 *   GET  /tp/drivers/available
 *   GET  /hospital/upcoming
 *   PATCH /driver/location  → "driver" treated as :id
 *   PATCH /solo/location    → "solo"   treated as :id
 *   PATCH /care/location    → "care"   treated as :id
 *   GET  /admin/bookings/export  → "export" treated as /admin/bookings/:id
 *
 * FIX: Move ALL static-segment routes ABOVE /:id routes.
 *      This patch file gives you the correct order to use in your final router.
 *
 * ── MISSING ROUTES ───────────────────────────────────────────────────────────
 *   GET  /doctor/assigned          → doctor sees their consultation bookings
 *   GET  /tp/:id                   → TP sees detail of one booking
 *   POST /payment/confirm          → payment gateway callback (Razorpay/Cashfree)
 *
 * ── SCHEMA GAP ───────────────────────────────────────────────────────────────
 *   Booking.transport.assignedTP is used in the router but NOT in the Booking
 *   schema. Add this field to the transportInfoSchema in Booking.js:
 *
 *     assignedTP: { type: Schema.Types.ObjectId, ref: 'TransportPartner', default: null },
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * HOW TO APPLY:
 *   Replace bookingRouter.js route order with the ORDER GUIDE below,
 *   then ADD the three missing routes from this file.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from 'crypto';
import mongoose from 'mongoose';

import Booking from '../models/Booking.js';
import Ride from '../models/Ride.js';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import TransportPartner from '../models/TransportPartner.js';
import Notification from '../models/Notification.js';
import SystemLog from '../models/SystemLog.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import { getBookingSocketService } from '../services/bookingSocketService.js';
import { transactionalTemplate } from '../templates/emailTemplates.js';
import sendEmail from '../utils/sendEmail.js';
import sendSms from '../utils/sendSms.js';
import {
  paymentSuccessfulSms,
  appointmentConfirmedSms,
} from '../templates/smsTemplates.js';


// ─────────────────────────────────────────────────────────────────────────────
// ██████████████████████████████████████████████████████████████████████████████
//  CORRECT ROUTE ORDER — PASTE THIS INTO bookingRouter.js
//  (static-segment routes MUST come before /:id routes)
// ██████████████████████████████████████████████████████████████████████████████
// ─────────────────────────────────────────────────────────────────────────────
//
//  ── CUSTOMER ──────────────────────────────────────────────────────────────
//  POST   /                              create booking
//  GET    /my                            my bookings
//  GET    /availability/check            pre-booking slot check
//
//  ── DRIVER (agency) ───────────────────────────────────────────────────────
//  GET    /driver/assigned               ← MUST be before /:id
//  PATCH  /driver/location               ← MUST be before /:id
//
//  ── SOLO DRIVER ───────────────────────────────────────────────────────────
//  GET    /solo/available                ← MUST be before /:id
//  PATCH  /solo/location                 ← MUST be before /:id
//
//  ── TRANSPORT PARTNER ─────────────────────────────────────────────────────
//  GET    /tp/assigned                   ← MUST be before /:id
//  GET    /tp/drivers/available          ← MUST be before /:id
//
//  ── CARE ASSISTANT ────────────────────────────────────────────────────────
//  GET    /care/assigned                 ← MUST be before /:id
//  PATCH  /care/location                 ← MUST be before /:id
//
//  ── HOSPITAL ──────────────────────────────────────────────────────────────
//  GET    /hospital/upcoming             ← MUST be before /:id
//
//  ── DOCTOR ────────────────────────────────────────────────────────────────
//  GET    /doctor/assigned               ← MUST be before /:id  [NEW — see below]
//
//  ── PAYMENT ───────────────────────────────────────────────────────────────
//  POST   /payment/confirm               ← MUST be before /:id  [NEW — see below]
//
//  ── ADMIN ─────────────────────────────────────────────────────────────────
//  GET    /admin/bookings/stats          ← MUST be before /admin/bookings/:id
//  GET    /admin/bookings/export         ← MUST be before /admin/bookings/:id
//  GET    /admin/bookings                list
//  GET    /admin/bookings/:id            detail
//  PATCH  /admin/bookings/:id/status
//  GET    /admin/bookings/:id/nearby/solo-drivers
//  GET    /admin/bookings/:id/nearby/transport-partners
//  GET    /admin/bookings/:id/nearby/care-assistants
//  GET    /admin/bookings/:id/nearby/hospitals
//  POST   /admin/bookings/:id/assign/solo-driver
//  POST   /admin/bookings/:id/assign/transport-partner
//  POST   /admin/bookings/:id/assign/care-assistant
//  POST   /admin/bookings/:id/assign/hospital
//  PATCH  /admin/bookings/:id/reassign/driver
//  PATCH  /admin/bookings/:id/reassign/care
//  POST   /admin/bookings/:id/refund
//
//  ── GENERIC (LAST — catches :id) ──────────────────────────────────────────
//  GET    /:id                           booking detail
//  DELETE /:id/cancel
//  POST   /:id/rate
//  GET    /:id/track
//  GET    /:id/invoice
//  PATCH  /:id/ride/accept
//  PATCH  /:id/ride/reject
//  PATCH  /:id/ride/arrived
//  POST   /:id/ride/start
//  POST   /:id/ride/end
//  PATCH  /:id/solo/accept
//  PATCH  /:id/solo/reject
//  PATCH  /:id/solo/arrived
//  POST   /:id/solo/start
//  POST   /:id/solo/end
//  PATCH  /:id/tp/assign-driver
//  PATCH  /:id/tp/reassign-driver
//  PATCH  /:id/care/arrived
//  PATCH  /:id/care/start
//  PATCH  /:id/care/complete
//  PATCH  /:id/hospital/confirm
//  GET    /tp/:id                        ← TP booking detail [NEW — see below]
//
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 1. MISSING ROUTE: GET /doctor/assigned
//    Doctor sees their upcoming consultation bookings.
//    Mount ABOVE /:id in bookingRouter.js.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /bookings/doctor/assigned
 * Returns all bookings that have a consultation linked to this doctor.
 * Filtered by status (default: upcoming — confirmed/assigned/in_progress).
 * Sorted by scheduledAt ASC.
 *
 * Query params:
 *   status  — filter by booking status (optional)
 *   page    — default 1
 *   limit   — default 10
 */

import asyncHandler from '../utils/asyncHandler.js';

// GET '/doctor/assigned'
export const getDoctorAssigned = asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    // Resolve DoctorProfile from User
    const doctorProfile = await DoctorProfile.findOne({ user: req.user._id })
      .select('_id partnershipStatus')
      .lean();

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found for this user',
      });
    }

    if (doctorProfile.partnershipStatus !== 'Active') {
      return res.status(403).json({
        success: false,
        message: 'Doctor partnership is not active',
      });
    }

    const filter = { 'consultation.doctor': doctorProfile._id };

    if (status) {
      filter.status = status;
    } else {
      // Default: upcoming active bookings
      filter.status = { $in: ['confirmed', 'assigned', 'in_progress'] };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .select(
          'bookingNumber serviceType status scheduledAt patientName customerNotes ' +
          'consultation transport.pickupAddress billing.netAmount customer'
        )
        .populate('customer', 'name phone email')
        .populate('consultation.hospital', 'name address.line1 address.city contact.phone')
        .sort({ scheduledAt: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        bookings,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('[GET /doctor/assigned]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/payment/confirm'
export const postPaymentConfirm = asyncHandler(async (req, res) => {
  try {
    const body = req.body;

    // ── Detect gateway ──────────────────────────────────────────────────────
    const isRazorpay  = !!(body.razorpay_order_id && body.razorpay_signature);
    const isCashfree  = !!(body.orderId && body.txStatus);

    let gatewayOrderId, gatewayPaymentId, isSuccess, signatureValid;

    // ── Razorpay signature verification ────────────────────────────────────
    if (isRazorpay) {
      gatewayOrderId  = body.razorpay_order_id;
      gatewayPaymentId = body.razorpay_payment_id;

      const expectedSig = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(`${gatewayOrderId}|${gatewayPaymentId}`)
        .digest('hex');

      signatureValid = expectedSig === body.razorpay_signature;
      isSuccess      = signatureValid; // Razorpay only sends success events via this endpoint

      if (!signatureValid) {
        console.warn('[payment/confirm] Razorpay signature mismatch:', {
          orderId: gatewayOrderId,
        });
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }
    }

    // ── Cashfree signature verification ────────────────────────────────────
    else if (isCashfree) {
      gatewayOrderId  = body.orderId;
      gatewayPaymentId = body.referenceId;

      const sigData = `${body.orderId}${body.orderAmount}${body.referenceId}${body.txStatus}`;
      const expectedSig = crypto
        .createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
        .update(sigData)
        .digest('base64');

      signatureValid = expectedSig === body.signature;
      isSuccess      = signatureValid && body.txStatus === 'SUCCESS';

      if (!signatureValid) {
        console.warn('[payment/confirm] Cashfree signature mismatch:', {
          orderId: gatewayOrderId,
        });
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }
    } else {
      return res.status(400).json({ success: false, message: 'Unknown payment gateway payload' });
    }

    // ── Find booking ────────────────────────────────────────────────────────
    const booking = await Booking.findOne({
      'payment.gatewayOrderId': gatewayOrderId,
    });

    if (!booking) {
      // Acknowledge to gateway — don't let it retry forever
      console.error('[payment/confirm] Booking not found for gatewayOrderId:', gatewayOrderId);
      return res.status(200).json({ success: false, message: 'Booking not found' });
    }

    // ── Idempotency — already processed ────────────────────────────────────
    if (booking.payment.status === 'paid') {
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    const customer = await User.findById(booking.customer)
      .select('name email phone')
      .lean();

    // ── SUCCESS ─────────────────────────────────────────────────────────────
    if (isSuccess) {
      booking.payment.status        = 'paid';
      booking.payment.gatewayPaymentId = gatewayPaymentId;
      booking.payment.paidAt        = new Date();
      booking.payment.paidAmount    = booking.billing.netAmount;
      booking.status                = 'confirmed';
      booking.timeline.push({
        status:    'confirmed',
        note:      `Payment confirmed via ${isRazorpay ? 'Razorpay' : 'Cashfree'}. TxnID: ${gatewayPaymentId}`,
        actorType: 'system',
      });
      await booking.save();

      // In-app notification
      await Notification.create({
        recipient:         booking.customer,
        title:             'Payment Successful',
        body:              `Payment of ₹${booking.billing.netAmount} confirmed for booking #${booking.bookingNumber}.`,
        type:              'Payment_Success',
        priority:          'High',
        relatedEntityType: 'Booking',
        relatedEntityId:   booking._id,
        channels:          [{ channel: 'InApp' }, { channel: 'Push' }],
      });

      // Email
      try {
        await sendEmail({
          email:   customer.email,
          subject: `Payment Confirmed — Booking #${booking.bookingNumber}`,
          html:    transactionalTemplate({
            header:     'PAYMENT CONFIRMED',
            title:      `Payment of ₹${booking.billing.netAmount} received`,
            body:       `
              Your booking <b>#${booking.bookingNumber}</b> is now confirmed.<br/>
              <b>Service:</b> ${booking.serviceType.replace(/_/g, ' ')}<br/>
              <b>Scheduled:</b> ${new Date(booking.scheduledAt).toLocaleString('en-IN')}<br/>
              <b>Transaction ID:</b> ${gatewayPaymentId}
            `,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
            buttonText: 'View Booking',
          }),
        });
      } catch (e) {
        console.error('[payment/confirm] Email failed:', e.message);
      }

      // SMS
      if (customer.phone) {
        try {
          await sendSms({
            to:      customer.phone,
            message: paymentSuccessfulSms({
              userName:    customer.name,
              amount:      booking.billing.netAmount,
              referenceId: gatewayPaymentId,
              serviceType: booking.serviceType.replace(/_/g, ' '),
            }),
          });
        } catch (e) {
          console.error('[payment/confirm] SMS failed:', e.message);
        }
      }

      // Socket: notify booking room
      const socketService = getBookingSocketService();
      socketService?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
        bookingId: booking._id,
        status:    'confirmed',
        timestamp: new Date(),
      });

      // Notify admin:ops
      socketService?.emitToRoom('admin:ops', 'payment_confirmed', {
        bookingId:     booking._id,
        bookingNumber: booking.bookingNumber,
        amount:        booking.billing.netAmount,
        gateway:       isRazorpay ? 'razorpay' : 'cashfree',
        timestamp:     new Date(),
      });

      await SystemLog.createLog({
        level:    'success',
        category: 'payment',
        message:  `Payment confirmed for booking #${booking.bookingNumber}`,
        actor:    { userId: null, name: 'system', role: 'system' },
        relatedEntity: { model: 'Booking', entityId: booking._id },
        metadata: {
          gateway:        isRazorpay ? 'razorpay' : 'cashfree',
          gatewayOrderId,
          gatewayPaymentId,
          amount:         booking.billing.netAmount,
        },
      });

      return res.status(200).json({ success: true, message: 'Payment processed' });
    }

    // ── FAILURE ─────────────────────────────────────────────────────────────
    else {
      booking.payment.status = 'failed';
      booking.timeline.push({
        status:    booking.status,
        note:      `Payment failed via ${isRazorpay ? 'Razorpay' : 'Cashfree'}. Status: ${body.txStatus || 'failed'}`,
        actorType: 'system',
      });
      await booking.save();

      await Notification.create({
        recipient:         booking.customer,
        title:             'Payment Failed',
        body:              `Your payment for booking #${booking.bookingNumber} could not be processed. Please retry.`,
        type:              'Payment_Failed',
        priority:          'High',
        relatedEntityType: 'Booking',
        relatedEntityId:   booking._id,
        channels:          [{ channel: 'InApp' }, { channel: 'Push' }],
      });

      try {
        await sendEmail({
          email:   customer.email,
          subject: `Payment Failed — Booking #${booking.bookingNumber}`,
          html:    transactionalTemplate({
            header:     'PAYMENT FAILED',
            title:      'Your payment could not be processed',
            body:       `
              Payment for booking <b>#${booking.bookingNumber}</b> failed.<br/>
              Please retry using a different payment method.
            `,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}/pay`,
            buttonText: 'Retry Payment',
          }),
        });
      } catch (e) {
        console.error('[payment/confirm] Failure email failed:', e.message);
      }

      await SystemLog.createLog({
        level:    'warning',
        category: 'payment',
        message:  `Payment FAILED for booking #${booking.bookingNumber}`,
        actor:    { userId: null, name: 'system', role: 'system' },
        relatedEntity: { model: 'Booking', entityId: booking._id },
        metadata: { gateway: isRazorpay ? 'razorpay' : 'cashfree', gatewayOrderId, txStatus: body.txStatus },
      });

      return res.status(200).json({ success: true, message: 'Failure recorded' });
    }
  } catch (err) {
    console.error('[POST /payment/confirm]', err);
    // Always return 200 to gateway — prevent infinite retries
    return res.status(200).json({ success: false, message: 'Internal error recorded' });
  }
});

// GET '/tp/:id'
export const getTpById = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }

    const tp = await TransportPartner.findOne({ user: req.user._id })
      .select('_id businessName')
      .lean();

    if (!tp) {
      return res.status(404).json({ success: false, message: 'Transport partner not found' });
    }

    const booking = await Booking.findOne({
      _id:                   req.params.id,
      'transport.assignedTP': tp._id,
    })
      .populate('customer', 'name phone email avatar')
      .populate('transport.driver', 'legalName driverCode phone assignedVehicleSnapshot')
      .populate('consultation.hospital', 'name address contact')
      .select('-adminNotes -billing.platformFee -billing.partnerPayout')
      .lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not assigned to your fleet',
      });
    }

    // Attach active ride info
    const activeRide = await Ride.findOne({
      booking: booking._id,
      status:  { $in: ['Assigned', 'Accepted', 'En-Route', 'Arrived', 'Started'] },
    })
      .select('status liveLocation startTime legType legSequence driver')
      .lean();

    return res.status(200).json({
      success: true,
      data:    { booking, activeRide: activeRide || null },
    });
  } catch (err) {
    console.error('[GET /tp/:id]', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});
