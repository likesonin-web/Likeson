/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LAB PARTNER BOOKING MANAGEMENT — ROUTES + INLINE CONTROLLER
 * Likeson Healthcare Platform
 *
 * All logic lives here (no separate controller file, per request).
 * Auth middleware sets:  req.user._id, req.user.labPartnerId
 *
 * Mount example:
 *   app.use('/api/lab-partner/bookings', protect, authorize('lab_partner'), labPartnerRoutes);
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import mongoose           from 'mongoose';
import axios              from 'axios';
import https              from 'https';

import Booking            from '../models/Booking.js';
import LabPartnerProfile  from '../models/LabPartnerProfile.js';
import upload             from '../middleware/upload.js';
import sendEmail          from '../utils/sendEmail.js';
import sendSms            from '../services/Sendsms.js';
import asyncHandler       from '../utils/asyncHandler.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';


// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the LabPartnerProfile._id from the logged-in user.
 * Throws a 404-style error if no profile found.
 */
const resolveLabId = async (userId) => {
  const profile = await LabPartnerProfile
    .findOne({ user: userId })
    .select('_id labName')
    .lean();

  if (!profile) {
    const err = new Error('Lab partner profile not found for this user.');
    err.status = 404;
    throw err;
  }
  return profile;
};

/**
 * Fetch a single booking and verify it belongs to the requesting lab.
 * Throws 404 if not found / not owned.
 *
 * @param {string} bookingId
 * @param {ObjectId} labId  — LabPartnerProfile._id
 * @param {object}  [selectOpts]   — extra .select() string
 * @param {Array}   [populateOpts] — array of populate configs
 */
const getOwnedBooking = async (bookingId, labId, selectOpts = '', populateOpts = []) => {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('Invalid booking ID format.');
    err.status = 400;
    throw err;
  }

  let q = Booking.findOne({
    _id:                        bookingId,
    'diagnosticDetails.labPartner': labId,
  });

  if (selectOpts) q = q.select(selectOpts);
  for (const p of populateOpts) q = q.populate(p);

  const booking = await q;
  if (!booking) {
    const err = new Error('Booking not found or does not belong to this lab.');
    err.status = 404;
    throw err;
  }
  return booking;
};

/**
 * Push a status-log entry onto a booking document (in-memory, caller must save).
 */
const pushStatusLog = (booking, toStatus, userId, reason = '') => {
  const fromStatus = booking.statusLog?.at(-1)?.toStatus ?? booking.status;
  booking.statusLog.push({
    fromStatus,
    toStatus,
    changedBy: userId,
    reason,
    changedAt: new Date(),
  });
  booking.status = toStatus;
};

/**
 * Build a standard success envelope.
 */
const ok = (res, data = {}, message = 'Success', status = 200) =>
  res.status(status).json({ success: true, message, ...data });

/**
 * Central error responder used by asyncHandler catch paths.
 * Not exported — asyncHandler in asyncHandler.js handles uncaught throws.
 */
// (asyncHandler wrapper already forwards errors to next(); Express error handler takes over.)


// ─────────────────────────────────────────────────────────────────────────────
// 1. GET /  — List Bookings (paginated + filtered)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET /api/lab-partner/bookings
 * @access  Lab Partner
 * @query   page, limit, status, date (today|week|month), collectionMode
 *
 * Returns paginated booking list for the authenticated lab.
 * Each booking exposes: bookingCode, status, scheduledAt, patientInfo,
 * diagnosticDetails (tests + packages + technician), fareBreakdown.totalAmount,
 * paymentStatus, createdAt.
 */

// GET '/'
export const get = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;

    // ── Resolve lab profile ─────────────────────────────────────────────────
    const { _id: labId } = await resolveLabId(userId);

    // ── Pagination ──────────────────────────────────────────────────────────
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    // ── Build filter ────────────────────────────────────────────────────────
    const filter = { 'diagnosticDetails.labPartner': labId };

    // status filter
    if (req.query.status) {
      const allowed = ['pending','confirmed','in_progress','completed','cancelled','no_show'];
      if (allowed.includes(req.query.status)) {
        filter.status = req.query.status;
      }
    }

    // date filter
    if (req.query.date) {
      const now   = new Date();
      const start = new Date();

      if (req.query.date === 'today') {
        start.setHours(0, 0, 0, 0);
        filter.createdAt = { $gte: start, $lte: now };

      } else if (req.query.date === 'week') {
        const day = start.getDay();               // 0 = Sun
        start.setDate(start.getDate() - day);
        start.setHours(0, 0, 0, 0);
        filter.createdAt = { $gte: start, $lte: now };

      } else if (req.query.date === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        filter.createdAt = { $gte: start, $lte: now };
      }
    }

    // collection mode filter (Walk-in | Home Collection)
    if (req.query.collectionMode) {
      // Home Collection bookings use bookingType 'diagnostic_home'
      if (req.query.collectionMode === 'Home Collection') {
        filter.bookingType = 'diagnostic_home';
      } else if (req.query.collectionMode === 'Walk-in') {
        filter.bookingType = 'diagnostic_center';
      }
    }

    // ── Query ───────────────────────────────────────────────────────────────
    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'bookingCode bookingType status scheduledAt createdAt ' +
          'patientInfo paymentStatus fareBreakdown.totalAmount ' +
          'diagnosticDetails.testNames diagnosticDetails.packageNames ' +
          'diagnosticDetails.technicianName diagnosticDetails.sampleCollectedAt ' +
          'diagnosticDetails.reportReadyAt diagnosticDetails.reportDeliveryMode'
        )
        .lean(),

      Booking.countDocuments(filter),
    ]);

    return ok(res, {
      data: {
        bookings,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  });

// GET '/:bookingId'
export const getByBookingId = asyncHandler(async (req, res) => {
    const { _id: userId }  = req.user;
    const { bookingId }    = req.params;

    const { _id: labId }   = await resolveLabId(userId);

    const booking = await getOwnedBooking(
      bookingId,
      labId,
      // Select every field we want to expose
      `bookingCode bookingType status statusLog scheduledAt completedAt createdAt updatedAt
       patientInfo fareBreakdown paymentStatus payments
       diagnosticDetails documents rating
       patientLocation destinationLocation cancellation
       customer followUpParentBooking couponCode coinsRedeemed`,
      [
        // Populate customer (basic identity for lab)
        {
          path:   'customer',
          select: 'name email phone avatar',
        },
        // Populate lab profile inside diagnosticDetails
        {
          path:   'diagnosticDetails.labPartner',
          model:  'LabPartnerProfile',
          select: 'labName labCode contactPersons registeredAddress reportDeliveryModes',
        },
      ]
    );

    return ok(res, { data: { booking } });
  });

// PATCH '/:bookingId/accept'
export const patchByBookingIdAccept = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;
    const { bookingId }   = req.params;

    const { _id: labId, labName } = await resolveLabId(userId);

    const booking = await getOwnedBooking(bookingId, labId,
      'bookingCode status statusLog patientInfo customer',
      [{ path: 'customer', select: 'phone name' }]
    );

    // Guard: only accept pending bookings
    if (!['pending', 'payment_pending'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot accept booking in '${booking.status}' status. Expected 'pending'.`,
      });
    }

    // Status transition
    pushStatusLog(booking, 'confirmed', userId, 'Accepted by lab partner');
    await booking.save();

    // ── SMS notification (non-blocking — don't fail the API on SMS error) ──
    const customerPhone = booking.customer?.phone;
    if (customerPhone) {
      sendSms({
        to:      customerPhone,
        message: `Your lab booking ${booking.bookingCode} has been accepted by ${labName}. ` +
                 `We will contact you shortly regarding sample collection. – Likeson Healthcare`,
      }).catch((err) =>
        console.error(`[labPartner/accept] SMS failed for ${booking.bookingCode}:`, err.message)
      );
    }

    return ok(res, {
      data: {
        bookingCode: booking.bookingCode,
        status:      booking.status,
        updatedAt:   booking.updatedAt,
      },
      message: 'Booking accepted successfully.',
    });
  });

// PATCH '/:bookingId/assign-technician'
export const patchByBookingIdAssignTechnician = asyncHandler(async (req, res) => {
    const { _id: userId }    = req.user;
    const { bookingId }      = req.params;
    const { technicianName } = req.body;

    if (!technicianName || typeof technicianName !== 'string' || !technicianName.trim()) {
      return res.status(400).json({ success: false, message: '`technicianName` is required.' });
    }

    const { _id: labId } = await resolveLabId(userId);

    const booking = await getOwnedBooking(
      bookingId, labId,
      'bookingCode bookingType status diagnosticDetails customer',
      [{ path: 'customer', select: 'phone name' }]
    );

    // Prevent assignment on terminal states
    if (['completed', 'cancelled', 'no_show'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot assign technician to a '${booking.status}' booking.`,
      });
    }

    booking.diagnosticDetails.technicianName = technicianName.trim();
    booking.updatedBy = userId;
    await booking.save();

    // SMS for home-collection bookings so customer knows who's coming
    const isHome = booking.bookingType === 'diagnostic_home';
    const phone  = booking.customer?.phone;
    if (isHome && phone) {
      sendSms({
        to:      phone,
        message: `Hi ${booking.customer?.name || 'there'}, your home sample collection for booking ` +
                 `${booking.bookingCode} will be handled by technician ${technicianName.trim()}. ` +
                 `– Likeson Healthcare`,
      }).catch((e) =>
        console.error('[labPartner/assign-technician] SMS error:', e.message)
      );
    }

    return ok(res, {
      data: {
        bookingCode:     booking.bookingCode,
        technicianName:  booking.diagnosticDetails.technicianName,
      },
      message: 'Technician assigned successfully.',
    });
  });

// PATCH '/:bookingId/collect-sample'
export const patchByBookingIdCollectSample = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;
    const { bookingId }   = req.params;

    const { _id: labId, labName } = await resolveLabId(userId);

    const booking = await getOwnedBooking(
      bookingId, labId,
      'bookingCode status statusLog diagnosticDetails customer',
      [{ path: 'customer', select: 'phone name' }]
    );

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: `Sample can only be collected on 'confirmed' bookings. Current: '${booking.status}'.`,
      });
    }

    const now = new Date();
    booking.diagnosticDetails.sampleCollectedAt = now;
    booking.updatedBy = userId;
    pushStatusLog(booking, 'in_progress', userId, 'Sample collected by lab');
    await booking.save();

    // SMS confirmation
    const phone = booking.customer?.phone;
    if (phone) {
      sendSms({
        to:      phone,
        message: `Your sample for booking ${booking.bookingCode} has been collected by ${labName}. ` +
                 `Reports will be ready as per the estimated turnaround time. – Likeson Healthcare`,
      }).catch((e) =>
        console.error('[labPartner/collect-sample] SMS error:', e.message)
      );
    }

    return ok(res, {
      data: {
        bookingCode:        booking.bookingCode,
        status:             booking.status,
        sampleCollectedAt:  now,
      },
      message: 'Sample collected. Booking is now in progress.',
    });
  });

// POST '/:bookingId/upload-report'
export const postByBookingIdUploadReport = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;
    const { bookingId }   = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file received. Send field `report`.' });
    }

    const { _id: labId } = await resolveLabId(userId);

    const booking = await getOwnedBooking(
      bookingId, labId,
      'bookingCode status diagnosticDetails'
    );

    // Only allow upload while booking is active (not cancelled or already completed without report)
    if (['cancelled', 'no_show'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot upload report for a '${booking.status}' booking.`,
      });
    }

    // req.file.location is the public S3 URL injected by multer-s3
    const reportUrl = req.file.location;

    booking.diagnosticDetails.reportUrl  = reportUrl;
    booking.updatedBy = userId;
    await booking.save();

    return ok(res, {
      data: {
        bookingCode: booking.bookingCode,
        reportUrl,
        fileSize:    req.file.size,
        mimeType:    req.file.mimetype,
      },
      message: 'Report uploaded successfully.',
    }, 'Report uploaded successfully.', 201);
  });

// POST '/:bookingId/dispatch-report'
export const postByBookingIdDispatchReport = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;
    const { bookingId }   = req.params;

    const { _id: labId, labName } = await resolveLabId(userId);

    // 1. Direct Mongoose query to guarantee the User model is populated
    const booking = await mongoose.model('Booking').findOne({
      _id: bookingId,
      'diagnosticDetails.labPartner': labId
    }).populate({
      path: 'customer',
      select: 'name email _id' // Explicitly pulling the email from the User model
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or you do not have permission to access it.',
      });
    }

    const { reportUrl, reportDeliveryMode } = booking.diagnosticDetails || {};

    // 2. Guard: report must exist before dispatch
    if (!reportUrl) {
      return res.status(400).json({
        success: false,
        message: 'No report uploaded yet. Upload report first via POST /:bookingId/upload-report.',
      });
    }

    const customerName  = booking.customer?.name  || booking.patientInfo?.name || 'Patient';
    const customerEmail = booking.customer?.email; 
    const code          = booking.bookingCode;

    // ── Channel dispatch functions ──────────────────────────────────────────

    /**
     * EMAIL CHANNEL
     */
    const dispatchEmail = async () => {
      if (!customerEmail) {
        console.warn(`[dispatchReport/email] No email found in User model for booking ${code}. Skipped.`);
        return { skipped: true, reason: 'no_email' };
      }

      const html = transactionalTemplate({
        header:     'DIAGNOSTIC REPORT READY',
        title:      `Your Lab Report is Ready, ${customerName}!`,
        body: `
          <p style="margin:0 0 12px;">Your diagnostic report for booking
            <strong style="color:#0f3460;">${code}</strong>
            processed by <strong>${labName}</strong> is now available.</p>
          <p style="margin:0 0 16px;color:#64748b;font-size:13px;">
            Click the button below to download your report directly to your device.
            The file is a secure PDF — no login required.
          </p>
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td align="center" style="padding:20px 0;">
                <a href="${reportUrl}"
                   download
                   target="_blank"
                   rel="noopener noreferrer"
                   style="
                     display:inline-block;
                     background:linear-gradient(135deg,#0f3460,#1a1a2e);
                     color:#ffffff;
                     text-decoration:none;
                     padding:16px 40px;
                     border-radius:50px;
                     font-size:15px;
                     font-weight:700;
                     letter-spacing:0.5px;
                     box-shadow:0 4px 14px rgba(15,52,96,0.35);
                   ">
                  ⬇️ Download Report
                </a>
              </td>
            </tr>
          </table>
          <p style="color:#94a3b8;font-size:11px;text-align:center;margin:8px 0 0;">
            Link expires in 7 days. Keep this email for your records.
          </p>
        `,
        buttonLink: reportUrl,
        buttonText: 'View in Browser',
      });

      await sendEmail({
        email:   customerEmail,
        subject: `[Likeson] Your Lab Report is Ready — ${code}`,
        html,
      });

      return { initiated: true, channel: 'email' };
    };

    /**
     * DIGITAL (APP) NOTIFICATION CHANNEL
     */
    const dispatchNotification = async () => {
      console.log(`[dispatchReport/notification] Firing app notification for ${code}.`);
      
      // Implement push notification here
      // await sendPushNotification({...});

      return { initiated: true, channel: 'notification' };
    };

    // ── Execute Delivery ─────────────────────────────────────────────────────
    
    const dispatched = [];

    try {
      // Execute both Email and Notification in parallel to enforce the "Email + App only" rule
      // regardless of legacy delivery modes stored in the database.
      const results = await Promise.allSettled([
        dispatchEmail(),
        dispatchNotification(),
      ]);

      ['Email', 'Notification (App)'].forEach((ch, i) => {
        if (results[i].status === 'fulfilled') {
          if (!results[i].value?.skipped) dispatched.push(ch);
        } else {
          console.error(`[dispatchReport] ${ch} failed:`, results[i].reason?.message);
        }
      });

    } catch (deliveryErr) {
      console.error(`[dispatchReport] Delivery error for ${code}:`, deliveryErr.message);
      return res.status(502).json({
        success: false,
        message: `Report dispatch failed: ${deliveryErr.message}`,
        code:    'DELIVERY_ERROR',
      });
    }

    return ok(res, {
      data: {
        bookingCode:      code,
        reportDeliveryMode,
        channelsDispatched: dispatched,
        reportUrl,
      },
      message: `Report dispatched via: ${dispatched.join(', ') || 'none'}.`,
    });
  });

// PATCH '/:bookingId/complete'
export const patchByBookingIdComplete = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;
    const { bookingId }   = req.params;

    const { _id: labId, labName } = await resolveLabId(userId);

    const booking = await getOwnedBooking(
      bookingId, labId,
      'bookingCode status statusLog completedAt diagnosticDetails customer',
      [{ path: 'customer', select: 'phone name' }]
    );

    if (booking.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: `Cannot complete booking in '${booking.status}' status. Expected 'in_progress'.`,
      });
    }

    const now = new Date();
    booking.completedAt                      = now;
    booking.diagnosticDetails.reportReadyAt  = now;
    booking.updatedBy                        = userId;
    pushStatusLog(booking, 'completed', userId, 'Marked complete by lab partner');
    await booking.save();

    // SMS
    const phone = booking.customer?.phone;
    if (phone) {
      sendSms({
        to:      phone,
        message: `Hi ${booking.customer?.name || 'there'}, your diagnostic booking ${booking.bookingCode} ` +
                 `with ${labName} is now complete. Your report is ready. ` +
                 `Use the Likeson app or check your email to download it. – Likeson Healthcare`,
      }).catch((e) =>
        console.error('[labPartner/complete] SMS error:', e.message)
      );
    }

    return ok(res, {
      data: {
        bookingCode:    booking.bookingCode,
        status:         booking.status,
        completedAt:    now,
        reportReadyAt:  now,
      },
      message: 'Booking marked as completed.',
    });
  });

// GET '/reports/all'
export const getReportsAll = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;

    const { _id: labId } = await resolveLabId(userId);

    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const filter = {
      'diagnosticDetails.labPartner': labId,
      'diagnosticDetails.reportUrl':  { $exists: true, $ne: null, $ne: '' },
    };

    // Date range filter
    if (req.query.date) {
      const now = new Date(), start = new Date();
      if      (req.query.date === 'today') { start.setHours(0,0,0,0); }
      else if (req.query.date === 'week')  { start.setDate(start.getDate() - start.getDay()); start.setHours(0,0,0,0); }
      else if (req.query.date === 'month') { start.setDate(1); start.setHours(0,0,0,0); }
      filter.completedAt = { $gte: start, $lte: now };
    }

    // Patient name search (case-insensitive partial match)
    if (req.query.search && req.query.search.trim()) {
      filter['patientInfo.name'] = { $regex: req.query.search.trim(), $options: 'i' };
    }

    const [reports, total] = await Promise.all([
      Booking.find(filter)
        .sort({ 'diagnosticDetails.reportReadyAt': -1 })
        .skip(skip)
        .limit(limit)
        .select(
          'bookingCode status completedAt patientInfo ' +
          'diagnosticDetails.testNames diagnosticDetails.packageNames ' +
          'diagnosticDetails.reportUrl diagnosticDetails.reportReadyAt ' +
          'diagnosticDetails.reportDeliveryMode diagnosticDetails.technicianName ' +
          'diagnosticDetails.sampleCollectedAt customer fareBreakdown.totalAmount paymentStatus'
        )
        .populate('customer', 'name email phone')
        .lean(),

      Booking.countDocuments(filter),
    ]);

    return ok(res, {
      data: {
        reports,
        pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      },
    });
  });

// GET '/reports/:bookingId/download'
export const getReportsByBookingIdDownload = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;
    const { bookingId }   = req.params;

    const { _id: labId } = await resolveLabId(userId);

    const booking = await getOwnedBooking(
      bookingId, labId,
      'bookingCode diagnosticDetails.reportUrl'
    );

    const reportUrl = booking.diagnosticDetails?.reportUrl;
    if (!reportUrl) {
      return res.status(404).json({ success: false, message: 'No report available for this booking.' });
    }

    // Determine filename
    const filename = `report-${booking.bookingCode}.pdf`;

    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');

    // Stream from S3 URL → client (avoids loading full file into memory)
    const protocol = reportUrl.startsWith('https') ? https : await import('http').then(m => m.default);

    protocol.get(reportUrl, (s3Stream) => {
      if (s3Stream.statusCode !== 200) {
        res.status(502).json({ success: false, message: 'Failed to fetch report from storage.' });
        return;
      }
      // Pipe S3 response directly to Express response
      s3Stream.pipe(res);
      s3Stream.on('error', (streamErr) => {
        console.error('[download] Stream error:', streamErr.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Report download stream failed.' });
        }
      });
    }).on('error', (reqErr) => {
      console.error('[download] Request error:', reqErr.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Could not connect to report storage.' });
      }
    });
  });

// POST '/reports/:bookingId/send'
export const postReportsByBookingIdSend = asyncHandler(async (req, res) => {
    const { _id: userId }       = req.user;
    const { bookingId }         = req.params;
    const { channels: reqChans } = req.body;    // optional override array

    const { _id: labId, labName } = await resolveLabId(userId);

    const booking = await getOwnedBooking(
      bookingId, labId,
      'bookingCode diagnosticDetails patientInfo customer',
      [{ path: 'customer', select: 'name email phone' }]
    );

    const { reportUrl, reportDeliveryMode } = booking.diagnosticDetails;

    if (!reportUrl) {
      return res.status(400).json({
        success: false,
        message: 'No report uploaded. Upload first via POST /:bookingId/upload-report.',
      });
    }

    const customerName  = booking.customer?.name  || booking.patientInfo?.name || 'Patient';
    const customerEmail = booking.customer?.email;
    const customerPhone = booking.customer?.phone;
    const code          = booking.bookingCode;

    // Determine which channels to use
    const VALID_CHANNELS = ['Email', 'WhatsApp', 'SMS'];
    let targetChannels = [];

    if (Array.isArray(reqChans) && reqChans.length) {
      targetChannels = reqChans.filter(c => VALID_CHANNELS.includes(c));
    } else {
      // Map stored reportDeliveryMode → channel list
      const modeMap = {
        'Email':          ['Email'],
        'Digital (App)':  ['SMS'],
        'WhatsApp':       ['WhatsApp'],
        'Physical Copy':  ['SMS'],
        'All':            ['Email', 'WhatsApp', 'SMS'],
      };
      targetChannels = modeMap[reportDeliveryMode] || ['SMS'];
    }

    const results = {};

    // ── Email ────────────────────────────────────────────────────────────────
    if (targetChannels.includes('Email')) {
      if (!customerEmail) {
        results.Email = { success: false, reason: 'no_email_on_record' };
      } else {
        try {
          const html = transactionalTemplate({
            header:     'DIAGNOSTIC REPORT — RESENT',
            title:      `Lab Report for Booking ${code}`,
            body: `
              <p>Hi <strong>${customerName}</strong>,</p>
              <p>Your lab report from <strong>${labName}</strong> has been resent at your request.</p>
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:24px 0;">
                    <a href="${reportUrl}"
                       download
                       target="_blank"
                       rel="noopener noreferrer"
                       style="
                         display:inline-block;
                         background:linear-gradient(135deg,#0f3460,#1a1a2e);
                         color:#ffffff;
                         text-decoration:none;
                         padding:16px 44px;
                         border-radius:50px;
                         font-size:15px;
                         font-weight:700;
                         letter-spacing:0.5px;
                         box-shadow:0 4px 14px rgba(15,52,96,0.35);
                       ">
                      ⬇️ Download Report
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#94a3b8;font-size:11px;text-align:center;">
                If the button doesn't work, copy and paste this link:<br/>
                <a href="${reportUrl}" style="color:#0f3460;word-break:break-all;">${reportUrl}</a>
              </p>
            `,
            buttonLink: reportUrl,
            buttonText: 'Open Report',
          });

          await sendEmail({
            email:   customerEmail,
            subject: `[Likeson] Lab Report — ${code}`,
            html,
          });
          results.Email = { success: true };
        } catch (e) {
          results.Email = { success: false, reason: e.message };
        }
      }
    }

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    if (targetChannels.includes('WhatsApp')) {
      if (!customerPhone) {
        results.WhatsApp = { success: false, reason: 'no_phone_on_record' };
      } else {
        try {
          const rawPhone  = customerPhone.replace(/[^\d+]/g, '');
          const e164Phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+|^91/, '')}`;
          const { default: twilio } = await import('twilio');
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to:   `whatsapp:${e164Phone}`,
            body: `*Likeson Healthcare* 🏥\nYour lab report for booking *${code}* is ready.\n\n` +
                  `📥 Download: ${reportUrl}\n\n_– ${labName}_`,
          });
          results.WhatsApp = { success: true };
        } catch (e) {
          results.WhatsApp = { success: false, reason: e.message };
        }
      }
    }

    // ── SMS ──────────────────────────────────────────────────────────────────
    if (targetChannels.includes('SMS')) {
      if (!customerPhone) {
        results.SMS = { success: false, reason: 'no_phone_on_record' };
      } else {
        try {
          await sendSms({
            to:      customerPhone,
            message: `Hi ${customerName}, your lab report for booking ${code} from ${labName} is ready. ` +
                     `Download: ${reportUrl} – Likeson Healthcare`,
          });
          results.SMS = { success: true };
        } catch (e) {
          results.SMS = { success: false, reason: e.message };
        }
      }
    }

    const anySuccess = Object.values(results).some(r => r.success);

    return res.status(anySuccess ? 200 : 502).json({
      success: anySuccess,
      message: anySuccess ? 'Report dispatched.' : 'All delivery channels failed.',
      data: { bookingCode: code, channels: results },
    });
  });

// GET '/stats/summary'
export const getStatsSummary = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;

    const { _id: labId }  = await resolveLabId(userId);

    // ── Date boundaries ─────────────────────────────────────────────────────
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const base = { 'diagnosticDetails.labPartner': labId };

    // Run all aggregations in parallel
    const [statusCounts, reportsUploaded, todayCount, weekRevenue, labProfile] =
      await Promise.all([
        // Status breakdown
        Booking.aggregate([
          { $match: base },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        // Reports uploaded (reportUrl set)
        Booking.countDocuments({
          ...base,
          'diagnosticDetails.reportUrl': { $exists: true, $ne: null },
        }),

        // Today's bookings
        Booking.countDocuments({
          ...base,
          createdAt: { $gte: todayStart },
        }),

        // This week's revenue (completed + paid)
        Booking.aggregate([
          {
            $match: {
              ...base,
              status:        'completed',
              paymentStatus: 'paid',
              completedAt:   { $gte: weekStart },
            },
          },
          {
            $group: {
              _id:     null,
              revenue: { $sum: '$fareBreakdown.totalAmount' },
            },
          },
        ]),

        // Lab's own average rating
        LabPartnerProfile
          .findById(labId)
          .select('averageRating totalReviews')
          .lean(),
      ]);

    // Shape statusCounts array → object
    const statusMap = statusCounts.reduce((acc, { _id, count }) => {
      acc[_id] = count;
      return acc;
    }, {});

    return ok(res, {
      data: {
        total:           Object.values(statusMap).reduce((a, b) => a + b, 0),
        pending:         statusMap.pending          || 0,
        confirmed:       statusMap.confirmed        || 0,
        inProgress:      statusMap.in_progress      || 0,
        completed:       statusMap.completed        || 0,
        cancelled:       (statusMap.cancelled || 0) + (statusMap.no_show || 0),
        reportsUploaded,
        todayBookings:   todayCount,
        weekRevenue:     weekRevenue[0]?.revenue   ?? 0,
        averageRating:   labProfile?.averageRating  ?? 0,
        totalReviews:    labProfile?.totalReviews   ?? 0,
      },
    });
  });

// PATCH '/:bookingId/reject'
export const patchByBookingIdReject = asyncHandler(async (req, res) => {
    const { _id: userId } = req.user;
    const { bookingId }   = req.params;
    const { reason }      = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: '`reason` is required when rejecting a booking.' });
    }

    const { _id: labId, labName } = await resolveLabId(userId);

    const booking = await getOwnedBooking(
      bookingId, labId,
      'bookingCode status statusLog customer patientInfo',
      [{ path: 'customer', select: 'phone name' }]
    );

    if (!['pending', 'payment_pending'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Can only reject 'pending' bookings. Current: '${booking.status}'.`,
      });
    }

    booking.cancellation = {
      cancelledBy:    'lab_partner',
      cancelledByUserId: userId,
      reason:         reason.trim(),
      refundEligible: true,
      refundPercent:  100,
      cancelledAt:    new Date(),
    };
    booking.updatedBy = userId;
    pushStatusLog(booking, 'cancelled', userId, `Rejected by lab: ${reason.trim()}`);
    await booking.save();

    const phone = booking.customer?.phone;
    if (phone) {
      sendSms({
        to:      phone,
        message: `We're sorry, your lab booking ${booking.bookingCode} could not be accepted by ` +
                 `${labName}. Reason: ${reason.trim()}. A full refund will be initiated. ` +
                 `Please rebook at your convenience. – Likeson Healthcare`,
      }).catch((e) =>
        console.error('[labPartner/reject] SMS error:', e.message)
      );
    }

    return ok(res, {
      data: {
        bookingCode: booking.bookingCode,
        status:      booking.status,
        reason:      reason.trim(),
      },
      message: 'Booking rejected. Customer notified.',
    });
  });
