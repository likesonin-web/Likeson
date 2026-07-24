 

import crypto  from 'crypto';
import QRCode from 'qrcode';
import Booking  from '../models/Booking.js';
import User     from '../models/User.js';
import sendSms  from '../services/Sendsms.js';
import sendEmail from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';
import { getBookingSocketService } from '../services/bookingSocketService.js';
import { protect, authorize }      from '../middleware/authMiddleware.js';
import {
  razorpay,
  createNotification,
  generatePayAtServiceLink,
  flushAndRecord,
  recoverSubscriptionUsageOnCancel,
} from '../routes/bookingRouterShared.js';


// ── Roles that can generate QR / mark complete ────────────────────────────────
const SERVICE_PARTNER_ROLES = [
  'driver', 'solodriverpartner', 'care_assistant',
  'doctor', 'hospital', 'transportpartner',
  'lab_partner', 'admin', 'superadmin',
];

// ── Booking types that support pay-at-service (all except doctor_online) ──────
const PAY_AT_SERVICE_TYPES = [
  'full_care_ride',
  'doctor_consultation',
  'physiotherapist',
  'care_assistant',
  'diagnostic_center',
  'diagnostic_home',
  'patient_transport',
  'follow_up',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: notify customer (SMS + email + push)
// ─────────────────────────────────────────────────────────────────────────────
const notifyCustomerPaymentLink = async ({ booking, customer, shortUrl, amount, expiresAt }) => {
  const fmt      = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const expireStr = expiresAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  // SMS
  if (customer?.phone) {
    sendSms({
      to:      customer.phone,
      message: `Likeson Healthcare: Pay ${fmt(amount)} for Booking #${booking.bookingCode}. Link: ${shortUrl} (valid till ${expireStr}). Or scan QR shown by your service provider.`,
    }).catch(e => console.error('[payAtService] SMS:', e.message));
  }

  // Email
  if (customer?.email) {
    sendEmail({
      email:   customer.email,
      subject: `Payment Request — Booking #${booking.bookingCode} | Likeson Healthcare`,
      html:    transactionalTemplate({
        header:     'PAYMENT REQUEST',
        title:      `Pay ${fmt(amount)} for your service`,
        body: `
          Your service provider has requested payment for Booking <strong>#${booking.bookingCode}</strong>.<br/><br/>
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
            <tr><td style="padding:6px 0;color:#6b7280;">Amount Due</td>
                <td style="text-align:right;font-weight:800;font-size:16px;color:#4f46e5;">${fmt(amount)}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Booking</td>
                <td style="text-align:right;font-weight:600;">#${booking.bookingCode}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;">Link Expires</td>
                <td style="text-align:right;font-weight:600;color:#dc2626;">${expireStr}</td></tr>
          </table>
          <br/>
          <p style="font-size:13px;color:#374151;">
            You can pay by:<br/>
            1. Scanning the <strong>QR code</strong> shown by your service provider<br/>
            2. Clicking the button below on your phone
          </p>
          <div style="margin:16px 0;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:12px;color:#92400e;">
            ⏱ Link expires in <strong>2 hours</strong>. Pay before ${expireStr} to complete your service.
          </div>
        `,
        buttonLink: shortUrl,
        buttonText: 'Pay Now',
      }),
    }).catch(e => console.error('[payAtService] email:', e.message));
  }

  // Push notification
  await createNotification({
    recipient: booking.customer,
    title:     'Payment Required',
    body:      `Pay ${fmt(amount)} for booking #${booking.bookingCode}. Tap or scan QR to pay.`,
    type:      'Payment_Request',
    bookingId: booking._id,
    actionUrl: shortUrl,
  });

  // Socket — push to customer room so frontend can show QR immediately
  getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'pay_at_service_link_generated', {
    bookingId:  booking._id,
    shortUrl,
    amount,
    expiresAt,
    message:    'Scan QR or tap link to pay',
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /:id/pay-at-service/generate-link
// Partner generates Razorpay Payment Link → QR
// ─────────────────────────────────────────────────────────────────────────────

import asyncHandler from '../utils/asyncHandler.js';

// POST '/:id/pay-at-service/generate-link'
export const postByIdPayAtServiceGenerateLink = asyncHandler(async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id)
        .select('+internalNotes')
        .lean();

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      if (!PAY_AT_SERVICE_TYPES.includes(booking.bookingType)) {
        return res.status(400).json({
          success: false,
          message: `Pay-at-service not supported for bookingType: ${booking.bookingType}`,
        });
      }

      if (['paid', 'pay_at_service_paid', 'refunded'].includes(booking.paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: `Booking already paid. Status: ${booking.paymentStatus}`,
        });
      }

      const amount = booking.fareBreakdown?.totalAmount ?? 0;
      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Nothing to pay — amount is ₹0',
        });
      }

      // Check if existing non-expired link
      const existing = booking.payAtService;
      if (
        existing?.razorpayPaymentLinkId &&
        existing?.expiresAt &&
        new Date(existing.expiresAt) > new Date() &&
        booking.paymentStatus === 'pay_at_service_pending'
      ) {
        // Return existing — no double charge
        const qrCodeDataUrl = await QRCode.toDataURL(existing.shortUrl, { width: 300, margin: 1 });

        return res.json({
          success:  true,
          message:  'Existing active link returned',
          data: {
            shortUrl:     existing.shortUrl,
            qrCodeDataUrl,
            amount,
            expiresAt:    existing.expiresAt,
            alreadySent:  true,
          },
        });
      }

      const customer = await User.findById(booking.customer).select('name email phone').lean();

      const linkResult = await generatePayAtServiceLink({
        booking,
        customer,
        generatedByUserId: req.user._id,
      });

      // Generate QR code image as base64 data URL
      const qrCodeDataUrl = await QRCode.toDataURL(linkResult.shortUrl, { width: 300, margin: 1 });

      // Save to booking
      await Booking.findByIdAndUpdate(booking._id, {
        $set: {
          paymentStatus:                     'pay_at_service_pending',
          'payAtService.enabled':            true,
          'payAtService.razorpayPaymentLinkId':  linkResult.paymentLinkId,
          'payAtService.razorpayPaymentLinkUrl': linkResult.paymentLinkUrl,
          'payAtService.shortUrl':           linkResult.shortUrl,
          'payAtService.qrCodeUrl':          qrCodeDataUrl,
          'payAtService.amount':             amount,
          'payAtService.generatedAt':        linkResult.generatedAt,
          'payAtService.expiresAt':          linkResult.expiresAt,
          'payAtService.paidByCustomer':     false,
          'payAtService.generatedBy':        req.user._id,
          'payAtService.notificationSentAt': new Date(),
        },
      });

      // Notify customer (SMS + email + push + socket)
      await notifyCustomerPaymentLink({
        booking,
        customer,
        shortUrl:  linkResult.shortUrl,
        amount,
        expiresAt: linkResult.expiresAt,
      });

      return res.json({
        success: true,
        message: 'Payment link generated. Customer notified via SMS + email. Show QR to customer.',
        data: {
          shortUrl:    linkResult.shortUrl,
          qrCodeDataUrl,
          amount,
          expiresAt:   linkResult.expiresAt,
        },
      });
    } catch (err) {
      console.error('[pay-at-service/generate-link]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

// GET '/:id/pay-at-service/status'
export const getByIdPayAtServiceStatus = asyncHandler(async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id)
        .select('payAtService paymentStatus bookingCode fareBreakdown customer')
        .lean();

      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      // Customer access check
      if (req.user.role === 'customer' && String(booking.customer) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }

      const pas     = booking.payAtService ?? {};
      const expired = pas.expiresAt ? new Date(pas.expiresAt) < new Date() : false;

      // If pending — cross-check with Razorpay live
      let razorpayStatus = null;
      if (pas.razorpayPaymentLinkId && booking.paymentStatus === 'pay_at_service_pending') {
        try {
          const liveLink  = await razorpay.paymentLink.fetch(pas.razorpayPaymentLinkId);
          razorpayStatus  = liveLink.status; // 'created' | 'paid' | 'expired' | 'cancelled'

          if (liveLink.status === 'paid' && booking.paymentStatus !== 'pay_at_service_paid') {
            // Auto-confirm if Razorpay says paid but DB not updated yet
            await Booking.findByIdAndUpdate(booking._id, {
              $set: {
                paymentStatus:                  'pay_at_service_paid',
                'payAtService.paidByCustomer':  true,
                'payAtService.paidAt':          new Date(),
              },
              $push: {
                payments: {
                  gateway:     'Razorpay',
                  transactionId: liveLink.payments?.items?.[0]?.payment_id ?? null,
                  orderId:      pas.razorpayPaymentLinkId,
                  paymentMode:  'Other',
                  amount:       pas.amount,
                  status:       'success',
                  paidAt:       new Date(),
                  notes:        'Pay-at-service QR payment',
                },
              },
            });

            // Flush subscription usage
            const freshBooking = await Booking.findById(booking._id).lean();
            await flushAndRecord(freshBooking).catch(() => {});

            await createNotification({
              recipient: booking.customer,
              title:     'Payment Received!',
              body:      `Payment of ₹${pas.amount} for booking #${booking.bookingCode} confirmed.`,
              type:      'Payment_Success',
              bookingId: booking._id,
            });

            getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'pay_at_service_paid', {
              bookingId:    booking._id,
              amount:       pas.amount,
              paidAt:       new Date(),
              paidByCustomer: true,
            });

            return res.json({
              success: true,
              data: {
                paid:          true,
                paymentStatus: 'pay_at_service_paid',
                amount:        pas.amount,
                paidAt:        new Date(),
                canMarkComplete: true,
              },
            });
          }
        } catch (rzpErr) {
          console.error('[pay-at-service/status] Razorpay fetch:', rzpErr.message);
        }
      }

      const paid = ['pay_at_service_paid', 'paid'].includes(booking.paymentStatus);

      return res.json({
        success: true,
        data: {
          paid,
          paymentStatus:   booking.paymentStatus,
          amount:          pas.amount ?? booking.fareBreakdown?.totalAmount,
          shortUrl:        pas.shortUrl ?? null,
          expiresAt:       pas.expiresAt ?? null,
          expired,
          paidAt:          pas.paidAt ?? null,
          paidByCustomer:  pas.paidByCustomer ?? false,
          razorpayStatus,
          canMarkComplete: paid,
          canRegenerateLink: expired && !paid,
        },
      });
    } catch (err) {
      console.error('[pay-at-service/status]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

// POST '/:id/pay-at-service/webhook'
export const postByIdPayAtServiceWebhook = asyncHandler(// raw body for signature verify
  async (req, res) => {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const secret    = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (secret) {
        const digest = crypto
          .createHmac('sha256', secret)
          .update(req.body)
          .digest('hex');
        if (digest !== signature) {
          return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
        }
      }

      const payload = JSON.parse(req.body.toString());
      const event   = payload.event; // 'payment_link.paid' or 'payment.captured'

      if (!['payment_link.paid', 'payment.captured'].includes(event)) {
        return res.json({ success: true, message: 'Event ignored' });
      }

      const paymentLinkId  = payload.payload?.payment_link?.entity?.id
        ?? payload.payload?.payment?.entity?.invoice_id
        ?? null;

      const booking = paymentLinkId
        ? await Booking.findOne({ 'payAtService.razorpayPaymentLinkId': paymentLinkId })
        : await Booking.findById(req.params.id);

      if (!booking) return res.json({ success: true, message: 'Booking not found — skip' });

      if (['pay_at_service_paid', 'paid'].includes(booking.paymentStatus)) {
        return res.json({ success: true, message: 'Already marked paid' });
      }

      const paymentId  = payload.payload?.payment?.entity?.id ?? null;
      const paidAmount = (payload.payload?.payment?.entity?.amount ?? 0) / 100;

      booking.paymentStatus                = 'pay_at_service_paid';
      booking.payAtService.paidByCustomer  = true;
      booking.payAtService.paidAt          = new Date();
      booking.fareBreakdown.amountPaid     = paidAmount || booking.payAtService.amount;
      booking.payments.push({
        gateway:      'Razorpay',
        transactionId: paymentId,
        orderId:       paymentLinkId,
        paymentMode:   'Other',
        amount:        paidAmount || booking.payAtService.amount,
        status:        'success',
        paidAt:        new Date(),
        notes:         'Pay-at-service QR/link payment via webhook',
      });

      await booking.save();
      await flushAndRecord(booking).catch(() => {});

      const customer = await User.findById(booking.customer).select('name email phone').lean();
      const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
      const amount = booking.payAtService.amount;

      // SMS
      if (customer?.phone) {
        sendSms({
          to:      customer.phone,
          message: `Likeson Healthcare: Payment of ${fmt(amount)} received for Booking #${booking.bookingCode}. Thank you!`,
        }).catch(() => {});
      }

      // Email
      if (customer?.email) {
        sendEmail({
          email:   customer.email,
          subject: `Payment Confirmed — #${booking.bookingCode} | Likeson Healthcare`,
          html:    transactionalTemplate({
            header:     'PAYMENT CONFIRMED',
            title:      `Payment of ${fmt(amount)} received`,
            body: `
              Your payment for Booking <strong>#${booking.bookingCode}</strong> has been confirmed.<br/><br/>
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
                <tr><td style="padding:6px 0;color:#6b7280;">Amount Paid</td>
                    <td style="text-align:right;font-weight:800;font-size:16px;color:#4f46e5;">${fmt(amount)}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Booking</td>
                    <td style="text-align:right;font-weight:600;">#${booking.bookingCode}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">Method</td>
                    <td style="text-align:right;font-weight:600;">Razorpay (QR / Link)</td></tr>
              </table>
              <div style="margin-top:12px;padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#15803d;">
                ✅ Payment confirmed. Your service provider will now mark your service complete.
              </div>
            `,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
            buttonText: 'View Booking',
          }),
        }).catch(() => {});
      }

      await createNotification({
        recipient: booking.customer,
        title:     'Payment Confirmed!',
        body:      `${fmt(amount)} received for booking #${booking.bookingCode}.`,
        type:      'Payment_Success',
        bookingId: booking._id,
      });

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'pay_at_service_paid', {
        bookingId:      booking._id,
        amount,
        paidAt:         new Date(),
        paidByCustomer: true,
        canMarkComplete: true,
      });

      // Notify partner room too
      getBookingSocketService()?.emitToAdminOps('pay_at_service_payment_received', {
        bookingId:   booking._id,
        bookingCode: booking.bookingCode,
        amount,
        paidAt:      new Date(),
      });

      return res.json({ success: true });
    } catch (err) {
      console.error('[pay-at-service/webhook]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

// POST '/:id/pay-at-service/mark-collected'
export const postByIdPayAtServiceMarkCollected = asyncHandler(async (req, res) => {
    try {
      const { amount, method = 'cash', note } = req.body;
      if (!amount || amount <= 0)
        return res.status(400).json({ success: false, message: 'amount required' });

      const booking = await Booking.findById(req.params.id);
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      if (['pay_at_service_paid', 'paid'].includes(booking.paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: 'Already paid via QR. Use /complete to finish service.',
        });
      }

      booking.collectedByPartner = {
        amount,
        collectedAt: new Date(),
        collectedBy: req.user._id,
        method,
        note: note || null,
      };
      booking.paymentStatus = 'paid';
      booking.payments.push({
        gateway:      method === 'cash' ? 'Cash' : 'Manual',
        transactionId: `MANUAL-${Date.now()}`,
        paymentMode:   method === 'cash' ? 'Cash' : 'Other',
        amount,
        status:        'success',
        paidAt:        new Date(),
        notes:         `Collected by partner. Method: ${method}. ${note || ''}`,
      });
      booking.fareBreakdown.amountPaid = amount;
      booking.updatedBy = req.user._id;
      await booking.save();

      await flushAndRecord(booking).catch(() => {});

      const customer = await User.findById(booking.customer).select('name email phone').lean();
      const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

      if (customer?.phone) {
        sendSms({
          to:      customer.phone,
          message: `Likeson: ${fmt(amount)} collected by your service provider for Booking #${booking.bookingCode}.`,
        }).catch(() => {});
      }

      if (customer?.email) {
        sendEmail({
          email:   customer.email,
          subject: `Payment Collected — #${booking.bookingCode} | Likeson Healthcare`,
          html:    transactionalTemplate({
            header: 'PAYMENT COLLECTED',
            title:  `${fmt(amount)} collected by service provider`,
            body: `
              Your payment of <strong>${fmt(amount)}</strong> for Booking <strong>#${booking.bookingCode}</strong>
              has been recorded by your service provider via <strong>${method}</strong>.
            `,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
            buttonText: 'View Booking',
          }),
        }).catch(() => {});
      }

      await createNotification({
        recipient: booking.customer,
        title:     'Payment Recorded',
        body:      `${fmt(amount)} collected by service provider for booking #${booking.bookingCode}.`,
        type:      'Payment_Success',
        bookingId: booking._id,
      });

      return res.json({
        success: true,
        message: 'Collection recorded. You can now mark service complete.',
        data: { collected: true, amount, method, canMarkComplete: true },
      });
    } catch (err) {
      console.error('[pay-at-service/mark-collected]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });

// POST '/:id/pay-at-service/complete'
export const postByIdPayAtServiceComplete = asyncHandler(async (req, res) => {
    try {
      const booking = await Booking.findById(req.params.id);
      if (!booking)
        return res.status(404).json({ success: false, message: 'Booking not found' });

      const isPaid = ['pay_at_service_paid', 'paid'].includes(booking.paymentStatus);
      if (!isPaid) {
        return res.status(400).json({
          success: false,
          message: `Cannot complete — payment not confirmed. Current status: ${booking.paymentStatus}`,
        });
      }

      if (booking.status === 'completed') {
        return res.status(400).json({ success: false, message: 'Already completed' });
      }

      booking.status      = 'completed';
      booking.completedAt = new Date();
      booking.statusLog.push({
        fromStatus: booking.status,
        toStatus:   'completed',
        changedBy:  req.user._id,
        reason:     'Service completed by partner after payment confirmed',
      });
      booking.updatedBy = req.user._id;
      await booking.save();

      const customer = await User.findById(booking.customer).select('name email phone').lean();

      await createNotification({
        recipient: booking.customer,
        title:     'Service Completed',
        body:      `Your service for booking #${booking.bookingCode} is complete. Please rate your experience.`,
        type:      'Booking_Completed',
        bookingId: booking._id,
      });

      if (customer?.phone) {
        sendSms({
          to:      customer.phone,
          message: `Likeson: Service for Booking #${booking.bookingCode} completed. Thank you! Rate: ${process.env.FRONTEND_URL}/bookings/${booking._id}/rate`,
        }).catch(() => {});
      }

      if (customer?.email) {
        sendEmail({
          email:   customer.email,
          subject: `Service Completed — #${booking.bookingCode} | Likeson Healthcare`,
          html:    transactionalTemplate({
            header:     'SERVICE COMPLETED',
            title:      'Your service is complete',
            body: `
              Booking <strong>#${booking.bookingCode}</strong> has been completed by your service provider.<br/><br/>
              Thank you for choosing Likeson Healthcare. Please take a moment to rate your experience.
            `,
            buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}/rate`,
            buttonText: 'Rate Your Experience',
          }),
        }).catch(() => {});
      }

      getBookingSocketService()?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
        bookingId: booking._id,
        status:    'completed',
        timestamp: new Date(),
      });

      return res.json({
        success: true,
        message: 'Service marked complete.',
        data: { status: 'completed', completedAt: booking.completedAt },
      });
    } catch (err) {
      console.error('[pay-at-service/complete]', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  });
