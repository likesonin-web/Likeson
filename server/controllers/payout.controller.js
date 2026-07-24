/**
 * payoutRouter.js — Likeson.in Partner Payout System
 *
 * Flow:
 *  1. Admin selects partner → GET /payouts/preview/:partnerUserId
 *     → shows unpaid completed bookings, per-booking breakdown, totals
 *
 *  2. Admin reviews → POST /payouts/initiate
 *     → creates Payout doc (status=pending), credits earnings ledger
 *
 *  3. Admin confirms → POST /payouts/:payoutId/transfer
 *     → creates RazorpayX contact + fund account (or reuses stored),
 *       fires payout, updates status=processing
 *
 *  4. Webhook → POST /payouts/webhook/razorpayx
 *     → marks paid/failed, updates partner earnings.totalPaid
 *
 *  5. Admin can cancel pending payout → POST /payouts/:payoutId/cancel
 *
 *  GET /payouts                  → list all payouts (filterable)
 *  GET /payouts/:payoutId        → single payout detail
 *  GET /payouts/partner/:userId  → all payouts for one partner
 */

import Razorpay from 'razorpay';
import axios from 'axios';
import crypto from 'crypto';
import mongoose from 'mongoose';

import Payout from '../models/Payout.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import SoloDriverPartner from '../models/SoloDriverPartner.js';

// Lazy-load other profiles to avoid circular import issues
const getProfileModel = (partnerType) => {
  const map = {
    doctor:            () => mongoose.model('DoctorProfile'),
    driver:            () => mongoose.model('Driver'),
    solodriverpartner: () => mongoose.model('SoloDriverPartner'),
    lab_partner:       () => mongoose.model('LabPartnerProfile'),
    care_assistant:    () => mongoose.model('CareAssistantProfile'),
    physiotherapist:   () => mongoose.model('DoctorProfile'),  // physio uses DoctorProfile
    pharmacy:          () => mongoose.model('PharmacyProfile'),
  };
  const fn = map[partnerType];
  if (!fn) throw new Error(`Unknown partnerType: ${partnerType}`);
  return fn();
};


// ── RazorpayX client (Fund Accounts / Payouts API) ────────────────────────────
// Standard Razorpay SDK is used for collections; RazorpayX uses direct axios
// because the SDK doesn't fully support payouts/fund-accounts endpoints.

const RAZORPAYX_KEY_ID     = process.env.RAZORPAYX_KEY_ID;
const RAZORPAYX_KEY_SECRET = process.env.RAZORPAYX_KEY_SECRET;
const RAZORPAYX_ACCOUNT    = process.env.RAZORPAYX_ACCOUNT_NUMBER; // source account

const razorpayxAuth = Buffer.from(`${RAZORPAYX_KEY_ID}:${RAZORPAYX_KEY_SECRET}`).toString('base64');

const razorpayx = axios.create({
  baseURL: 'https://api.razorpay.com/v1',
  headers: {
    Authorization: `Basic ${razorpayxAuth}`,
    'Content-Type': 'application/json',
  },
});

// Standard Razorpay (for webhook signature verification)
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve which fareBreakdown fields belong to which partner type.
 * Returns: { partnerEarning, platformMargin, earningBreakdown }
 *
 * Platform margin = totalAmount - partner's component(s).
 * Taxes, platform fee, discounts already factored into totalAmount.
 */
function resolvePartnerEarning(fareBreakdown, partnerType) {
  const fb = fareBreakdown || {};

  const consultationFee   = fb.consultationFee   || 0;
  const transportFee      = fb.transportFee      || 0;
  const diagnosticFee     = fb.diagnosticFee     || 0;
  const careAssistantFee  = fb.careAssistantFee  || 0;
  const homeCollectionFee = fb.homeCollectionFee || 0;
  const platformFee       = fb.platformFee       || 0;
  const totalAmount       = fb.amountPaid        || fb.totalAmount || 0;

  let partnerEarning = 0;
  const earningBreakdown = {
    consultationFee:  0,
    transportFee:     0,
    diagnosticFee:    0,
    careAssistantFee: 0,
    homeCollectionFee:0,
  };

  switch (partnerType) {
    case 'doctor':
    case 'physiotherapist':
      partnerEarning = consultationFee;
      earningBreakdown.consultationFee = consultationFee;
      break;

    case 'driver':
    case 'solodriverpartner':
      partnerEarning = transportFee;
      earningBreakdown.transportFee = transportFee;
      break;

    case 'lab_partner':
      partnerEarning = diagnosticFee + homeCollectionFee;
      earningBreakdown.diagnosticFee     = diagnosticFee;
      earningBreakdown.homeCollectionFee = homeCollectionFee;
      break;

    case 'care_assistant':
      partnerEarning = careAssistantFee;
      earningBreakdown.careAssistantFee = careAssistantFee;
      break;

    case 'pharmacy':
      // Pharmacy takes full amount minus platform fee
      partnerEarning = totalAmount - platformFee;
      break;

    default:
      partnerEarning = 0;
  }

  const platformMargin = totalAmount - partnerEarning;

  return {
    partnerEarning: Math.max(0, partnerEarning),
    platformMargin: Math.max(0, platformMargin),
    customerPaidAmount: totalAmount,
    earningBreakdown,
  };
}

/**
 * Fetch partner profile doc. Returns { profile, bankDetails, partnerName, fundAccountId }.
 * fundAccountId stored on profile as razorpayFundAccountId (we'll upsert this field).
 */
async function resolvePartnerProfile(partnerUserId, partnerType) {
  const ProfileModel = getProfileModel(partnerType);

  const profile = await ProfileModel.findOne({ user: partnerUserId })
    .select('fullName legalName name bankDetails razorpayFundAccountId razorpayContactId earnings')
    .lean();

  if (!profile) throw new Error(`Profile not found for partnerType=${partnerType}`);

  // Different models store name differently
  const partnerName = profile.fullName || profile.legalName || profile.name || 'Unknown';
  const bankDetails = profile.bankDetails;

  if (!bankDetails?.accountNumber && !bankDetails?.ifscCode) {
    throw new Error('Partner has no bank details. Add bank account before payout.');
  }

  return {
    profile,
    profileId:      profile._id,
    bankDetails,
    partnerName,
    fundAccountId:  profile.razorpayFundAccountId || null,
    contactId:      profile.razorpayContactId     || null,
  };
}

/**
 * Get unpaid completed bookings for a partner.
 * "Unpaid" = booking completed, not yet included in a paid/processing payout.
 *
 * We track this via a Set of booking _ids from existing paid/processing payouts.
 */
async function getUnpaidBookings(partnerUserId, partnerType, periodStart, periodEnd) {
  // 1. Find all booking IDs already paid/processing for this partner
  const existingPayouts = await Payout.find({
    partnerUserId,
    status: { $in: ['paid', 'processing', 'pending'] },
  }).select('bookingEarnings.booking').lean();

  const alreadyIncludedIds = new Set(
    existingPayouts.flatMap(p => p.bookingEarnings.map(be => be.booking.toString()))
  );

  // 2. Build query for bookings involving this partner
  const partnerField = {
    doctor:            'doctor',
    physiotherapist:   'doctor',
    driver:            'driver',
    solodriverpartner: 'solodriverpartner',
    lab_partner:       'labPartner',
    care_assistant:    'careAssistant',
    pharmacy:          'customer', // pharmacy: use different approach if needed
  }[partnerType];

  // Get profile _id (bookings store profile refs, not user refs for most)
  const ProfileModel = getProfileModel(partnerType);
  const profile = await ProfileModel.findOne({ user: partnerUserId }).select('_id').lean();
  if (!profile) throw new Error('Partner profile not found');

  const query = {
    status:        'completed',
    paymentStatus: { $in: ['paid', 'partially_paid'] },
    [partnerField]: profile._id,
  };

  if (periodStart) query.completedAt = { $gte: new Date(periodStart) };
  if (periodEnd)   query.completedAt = { ...query.completedAt, $lte: new Date(periodEnd) };

  const bookings = await Booking.find(query)
    .select('bookingCode bookingType scheduledAt completedAt fareBreakdown')
    .lean();

  // 3. Filter out already-included
  return bookings.filter(b => !alreadyIncludedIds.has(b._id.toString()));
}

/**
 * Create or reuse RazorpayX Contact for a partner.
 */
async function ensureRazorpayXContact(partnerUserId, partnerName, partnerEmail, contactId) {
  if (contactId) return contactId;

  const res = await razorpayx.post('/contacts', {
    name:         partnerName,
    email:        partnerEmail || undefined,
    type:         'vendor',
    reference_id: partnerUserId.toString(),
  });

  return res.data.id; // cont_xxx
}

/**
 * Create or reuse RazorpayX Fund Account (bank account) for a partner.
 */
async function ensureRazorpayXFundAccount(contactId, bankDetails, fundAccountId) {
  if (fundAccountId) return fundAccountId;

  const res = await razorpayx.post('/fund_accounts', {
    contact_id:   contactId,
    account_type: 'bank_account',
    bank_account: {
      name:           bankDetails.accountHolderName,
      ifsc:           bankDetails.ifscCode,
      account_number: bankDetails.accountNumber,
    },
  });

  return res.data.id; // fa_xxx
}

/**
 * Persist contact + fund account IDs back to partner profile (avoid re-creating).
 */
async function saveRazorpayXIdsToProfile(partnerUserId, partnerType, contactId, fundAccountId) {
  const ProfileModel = getProfileModel(partnerType);
  await ProfileModel.updateOne(
    { user: partnerUserId },
    {
      $set: {
        razorpayContactId:     contactId,
        razorpayFundAccountId: fundAccountId,
      },
    }
  );
}

/**
 * Credit partner earnings.pendingPayout for each booking (earnings ledger).
 */
async function creditPartnerEarningsLedger(partnerUserId, partnerType, totalEarning) {
  const ProfileModel = getProfileModel(partnerType);
  await ProfileModel.updateOne(
    { user: partnerUserId },
    {
      $inc: {
        'earnings.pendingPayout':    totalEarning,
        'earnings.lifetimeBookings': 1, // approximate; actual count from bookingCount
      },
    }
  );
}

/**
 * Sweep pendingPayout → totalPaid on payout success.
 */
async function sweepEarningsOnSuccess(partnerUserId, partnerType, payoutAmount) {
  const ProfileModel = getProfileModel(partnerType);
  await ProfileModel.updateOne(
    { user: partnerUserId },
    {
      $inc: {
        'earnings.totalPaid':     payoutAmount,
        'earnings.pendingPayout': -payoutAmount,
      },
      $set: { 'earnings.lastPayoutAt': new Date() },
    }
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// GET /payouts/preview/:partnerUserId
// Query: ?partnerType=doctor&periodStart=2026-06-01&periodEnd=2026-06-30
//
// Returns unpaid bookings with per-booking breakdown and totals.
// Admin reviews this before initiating payout.
// ─────────────────────────────────────────────────────────────────────────────

import asyncHandler from '../utils/asyncHandler.js';

// GET '/preview/:partnerUserId'
export const getPreviewByPartnerUserId = asyncHandler(async (req, res) => {
  try {
    const { partnerUserId } = req.params;
    const { partnerType, periodStart, periodEnd } = req.query;

    if (!partnerType) {
      return res.status(400).json({ success: false, message: 'partnerType required' });
    }

    const user = await User.findById(partnerUserId).select('name email role').lean();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const bookings = await getUnpaidBookings(partnerUserId, partnerType, periodStart, periodEnd);

    // Build per-booking preview
    const bookingBreakdowns = bookings.map(b => {
      const { partnerEarning, platformMargin, customerPaidAmount, earningBreakdown } =
        resolvePartnerEarning(b.fareBreakdown, partnerType);

      return {
        bookingId:          b._id,
        bookingCode:        b.bookingCode,
        bookingType:        b.bookingType,
        scheduledAt:        b.scheduledAt,
        completedAt:        b.completedAt,
        customerPaidAmount,
        partnerEarning,
        platformMargin,
        earningBreakdown,
        fareBreakdown:      b.fareBreakdown, // full breakdown for reference
      };
    });

    // Totals
    const totals = bookingBreakdowns.reduce(
      (acc, b) => {
        acc.totalCustomerPaid   += b.customerPaidAmount;
        acc.totalPartnerEarning += b.partnerEarning;
        acc.totalPlatformMargin += b.platformMargin;
        return acc;
      },
      { totalCustomerPaid: 0, totalPartnerEarning: 0, totalPlatformMargin: 0 }
    );

    // Partner bank snapshot
    const { bankDetails, partnerName, fundAccountId } =
      await resolvePartnerProfile(partnerUserId, partnerType).catch(() => ({
        bankDetails: null, partnerName: user.name, fundAccountId: null,
      }));

    res.json({
      success: true,
      data: {
        partner: {
          userId:        partnerUserId,
          name:          partnerName || user.name,
          email:         user.email,
          partnerType,
          fundAccountId: fundAccountId || null,
          bankDetails:   bankDetails
            ? {
                accountHolderName: bankDetails.accountHolderName,
                accountLast4:      bankDetails.accountLast4 || bankDetails.accountNumber?.slice(-4),
                ifscCode:          bankDetails.ifscCode,
                bankName:          bankDetails.bankName,
              }
            : null,
        },
        period: { periodStart: periodStart || null, periodEnd: periodEnd || null },
        bookingCount:   bookings.length,
        bookings:       bookingBreakdowns,
        totals,
        currency: 'INR',
      },
    });
  } catch (err) {
    console.error('[PAYOUT PREVIEW]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/initiate'
export const postInitiate = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      partnerUserId,
      partnerType,
      bookingIds,
      periodStart,
      periodEnd,
      notes,
    } = req.body;

    const adminId = req.user?._id; // assume auth middleware sets req.user

    if (!partnerUserId || !partnerType || !bookingIds?.length) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'partnerUserId, partnerType, bookingIds[] required',
      });
    }

    // Validate partner exists
    const { profile, profileId, bankDetails, partnerName } =
      await resolvePartnerProfile(partnerUserId, partnerType);

    // Fetch selected bookings
    const ProfileModel = getProfileModel(partnerType);
    const partnerProfileDoc = await ProfileModel.findOne({ user: partnerUserId }).select('_id').lean();

    const partnerField = {
      doctor:            'doctor',
      physiotherapist:   'doctor',
      driver:            'driver',
      solodriverpartner: 'solodriverpartner',
      lab_partner:       'labPartner',
      care_assistant:    'careAssistant',
      pharmacy:          'customer',
    }[partnerType];

    const bookings = await Booking.find({
      _id:           { $in: bookingIds },
      status:        'completed',
      paymentStatus: { $in: ['paid', 'partially_paid'] },
      [partnerField]: partnerProfileDoc._id,
    })
      .select('bookingCode bookingType scheduledAt completedAt fareBreakdown')
      .lean();

    if (!bookings.length) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'No valid completed bookings found' });
    }

    // Check none already in a pending/processing/paid payout
    const existingPayouts = await Payout.find({
      partnerUserId,
      status:                    { $in: ['pending', 'processing', 'paid'] },
      'bookingEarnings.booking': { $in: bookingIds },
    }).select('payoutCode').lean();

    if (existingPayouts.length) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: `Some bookings already in payout: ${existingPayouts.map(p => p.payoutCode).join(', ')}`,
      });
    }

    // Build booking earning records
    let totalCustomerPaid   = 0;
    let totalPartnerEarning = 0;
    let totalPlatformMargin = 0;

    const bookingEarnings = bookings.map(b => {
      const { partnerEarning, platformMargin, customerPaidAmount, earningBreakdown } =
        resolvePartnerEarning(b.fareBreakdown, partnerType);

      totalCustomerPaid   += customerPaidAmount;
      totalPartnerEarning += partnerEarning;
      totalPlatformMargin += platformMargin;

      return {
        booking:            b._id,
        bookingCode:        b.bookingCode,
        bookingType:        b.bookingType,
        scheduledAt:        b.scheduledAt,
        completedAt:        b.completedAt,
        customerPaidAmount,
        partnerEarning,
        platformMargin,
        earningBreakdown,
        isCredited:         true,
      };
    });

    // Create payout document
    const [payout] = await Payout.create(
      [
        {
          partnerType,
          partnerUserId,
          partnerProfileId: partnerProfileDoc._id,
          partnerName,
          cycle:            'manual',
          periodStart:      periodStart ? new Date(periodStart) : undefined,
          periodEnd:        periodEnd   ? new Date(periodEnd)   : undefined,
          bookingEarnings,
          bookingCount:     bookings.length,
          totalCustomerPaid,
          totalPlatformMargin,
          totalPartnerEarning,
          payoutAmount:     totalPartnerEarning, // may be adjusted by admin before transfer
          status:           'pending',
          notes,
          createdBy:        adminId,
          updatedBy:        adminId,
        },
      ],
      { session }
    );

    // Credit partner earnings ledger
    await getProfileModel(partnerType).updateOne(
      { user: partnerUserId },
      { $inc: { 'earnings.pendingPayout': totalPartnerEarning } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Payout initiated. Review and call /transfer to send money.',
      data: {
        payoutId:           payout._id,
        payoutCode:         payout.payoutCode,
        status:             payout.status,
        bookingCount:       payout.bookingCount,
        totalCustomerPaid,
        totalPlatformMargin,
        totalPartnerEarning,
        payoutAmount:       payout.payoutAmount,
        currency:           'INR',
      },
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('[PAYOUT INITIATE]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/:payoutId/transfer'
export const postByPayoutIdTransfer = asyncHandler(async (req, res) => {
  try {
    const { payoutId } = req.params;
    const { mode = 'IMPS' } = req.body;
    const adminId = req.user?._id;

    const payout = await Payout.findById(payoutId);
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });

    if (payout.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot transfer payout in status: ${payout.status}`,
      });
    }

    if (payout.payoutAmount <= 0) {
      return res.status(400).json({ success: false, message: 'payoutAmount must be > 0' });
    }

    // Fetch partner bank details (fresh, not from payout snapshot)
    const user = await User.findById(payout.partnerUserId).select('name email').lean();
    const { bankDetails, fundAccountId: storedFa, contactId: storedContact } =
      await resolvePartnerProfile(payout.partnerUserId, payout.partnerType);

    // Step 1: Ensure RazorpayX Contact
    let contactId = storedContact;
    if (!contactId) {
      contactId = await ensureRazorpayXContact(
        payout.partnerUserId,
        payout.partnerName,
        user.email,
        null
      );
    }

    // Step 2: Ensure RazorpayX Fund Account
    let fundAccountId = storedFa;
    if (!fundAccountId) {
      fundAccountId = await ensureRazorpayXFundAccount(contactId, bankDetails, null);
    }

    // Save IDs back to profile (idempotent)
    await saveRazorpayXIdsToProfile(
      payout.partnerUserId,
      payout.partnerType,
      contactId,
      fundAccountId
    );

    // Step 3: Fire RazorpayX Payout
    const payoutRes = await razorpayx.post('/payouts', {
      account_number:  RAZORPAYX_ACCOUNT,
      fund_account_id: fundAccountId,
      amount:          Math.round(payout.payoutAmount * 100), // paise
      currency:        'INR',
      mode,
      purpose:         'payout',
      queue_if_low_balance: true,
      reference_id:    payout.payoutCode,
      narration:       `Likeson payout ${payout.payoutCode}`,
    });

    const rxPayout = payoutRes.data;

    // Update payout doc
    payout.status      = 'processing';
    payout.initiatedBy = adminId;
    payout.initiatedAt = new Date();
    payout.updatedBy   = adminId;
    payout.razorpayx   = {
      fundAccountId,
      contactId,
      razorpayPayoutId: rxPayout.id,
      mode,
      status:           rxPayout.status,
      initiatedAt:      new Date(),
      bankSnapshot: {
        accountHolderName: bankDetails.accountHolderName,
        accountLast4:      bankDetails.accountLast4 || bankDetails.accountNumber?.slice(-4),
        ifscCode:          bankDetails.ifscCode,
        bankName:          bankDetails.bankName,
      },
    };

    await payout.save();

    res.json({
      success: true,
      message: 'Transfer initiated via RazorpayX. Status will update via webhook.',
      data: {
        payoutId:         payout._id,
        payoutCode:       payout.payoutCode,
        status:           payout.status,
        razorpayPayoutId: rxPayout.id,
        mode,
        payoutAmount:     payout.payoutAmount,
        currency:         'INR',
      },
    });
  } catch (err) {
    console.error('[PAYOUT TRANSFER]', err?.response?.data || err);
    const razorpayErr = err?.response?.data;
    res.status(500).json({
      success: false,
      message: razorpayErr?.error?.description || err.message,
      razorpayError: razorpayErr || null,
    });
  }
});

// POST '/webhook/razorpayx'
export const postWebhookRazorpayx = asyncHandler(async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAYX_WEBHOOK_SECRET;
    const signature     = req.headers['x-razorpay-signature'];
    const rawBody       = req.body; // Buffer because of express.raw

    // Verify webhook signature
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSig) {
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody.toString());
    const event   = payload.event;
    const rxPayout = payload.payload?.payout?.entity;

    if (!rxPayout) return res.status(200).json({ success: true }); // ack unknown events

    // Find our Payout by razorpayPayoutId
    const payout = await Payout.findOne({ 'razorpayx.razorpayPayoutId': rxPayout.id });
    if (!payout) {
      console.warn('[WEBHOOK] Payout not found for', rxPayout.id);
      return res.status(200).json({ success: true }); // ack so Razorpay doesn't retry
    }

    // Store raw payload (useful for disputes/audits)
    payout.razorpayx.lastWebhookPayload = payload;
    payout.razorpayx.status             = rxPayout.status;
    payout.updatedBy                    = null;

    if (event === 'payout.processed') {
      payout.status          = 'paid';
      payout.confirmedAt     = new Date();
      payout.razorpayx.utr         = rxPayout.utr;
      payout.razorpayx.settledAt   = new Date();

      // Sweep pendingPayout → totalPaid on partner earnings ledger
      await sweepEarningsOnSuccess(
        payout.partnerUserId,
        payout.partnerType,
        payout.payoutAmount
      );

    } else if (event === 'payout.failed') {
      payout.status                       = 'failed';
      payout.razorpayx.failureReason      = rxPayout.failure_reason;

      // Reverse the pendingPayout credit we gave at initiation
      await getProfileModel(payout.partnerType).updateOne(
        { user: payout.partnerUserId },
        { $inc: { 'earnings.pendingPayout': -payout.payoutAmount } }
      );

    } else if (event === 'payout.reversed') {
      payout.status = 'reversed';

      // Reverse the sweep (totalPaid was already incremented on processed event)
      await getProfileModel(payout.partnerType).updateOne(
        { user: payout.partnerUserId },
        {
          $inc: {
            'earnings.totalPaid':     -payout.payoutAmount,
            'earnings.pendingPayout':  payout.payoutAmount,
          },
        }
      );
    }

    await payout.save();
    res.status(200).json({ success: true });

  } catch (err) {
    console.error('[PAYOUT WEBHOOK]', err);
    // Always 200 to prevent Razorpay retry storm on our bug
    res.status(200).json({ success: true });
  }
});

// POST '/:payoutId/cancel'
export const postByPayoutIdCancel = asyncHandler(async (req, res) => {
  try {
    const { payoutId }  = req.params;
    const { reason }    = req.body;
    const adminId       = req.user?._id;

    const payout = await Payout.findById(payoutId);
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });

    if (payout.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel payout in status: ${payout.status}. Only pending payouts can be cancelled.`,
      });
    }

    payout.status       = 'cancelled';
    payout.cancelledBy  = adminId;
    payout.cancelReason = reason;
    payout.updatedBy    = adminId;

    // Reverse pendingPayout credit
    await getProfileModel(payout.partnerType).updateOne(
      { user: payout.partnerUserId },
      { $inc: { 'earnings.pendingPayout': -payout.payoutAmount } }
    );

    await payout.save();

    res.json({
      success: true,
      message: 'Payout cancelled. Earnings ledger reversed.',
      data:    { payoutId: payout._id, payoutCode: payout.payoutCode, status: payout.status },
    });
  } catch (err) {
    console.error('[PAYOUT CANCEL]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/'
export const get = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      partnerType,
      partnerUserId,
      cycle,
      page  = 1,
      limit = 20,
      from,
      to,
    } = req.query;

    const filter = {};
    if (status)        filter.status        = status;
    if (partnerType)   filter.partnerType   = partnerType;
    if (partnerUserId) filter.partnerUserId = partnerUserId;
    if (cycle)         filter.cycle         = cycle;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Payout.countDocuments(filter);

    const payouts = await Payout.find(filter)
      .select('-bookingEarnings -razorpayx.lastWebhookPayload')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({
      success: true,
      data: {
        payouts,
        pagination: {
          total,
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error('[PAYOUT LIST]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/:payoutId'
export const getByPayoutId = asyncHandler(async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.payoutId)
      .populate('bookingEarnings.booking', 'bookingCode bookingType scheduledAt completedAt fareBreakdown status paymentStatus')
      .populate('initiatedBy', 'name email')
      .populate('cancelledBy', 'name email')
      .lean();

    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });

    // Remove raw webhook payload from response (sensitive / large)
    if (payout.razorpayx) delete payout.razorpayx.lastWebhookPayload;

    res.json({ success: true, data: payout });
  } catch (err) {
    console.error('[PAYOUT GET]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/partner/:partnerUserId'
export const getPartnerByPartnerUserId = asyncHandler(async (req, res) => {
  try {
    const { partnerUserId } = req.params;
    const { partnerType, status, page = 1, limit = 20 } = req.query;

    const filter = { partnerUserId };
    if (partnerType) filter.partnerType = partnerType;
    if (status)      filter.status      = status;

    const skip  = (parseInt(page) - 1) * parseInt(limit);
    const total = await Payout.countDocuments(filter);

    const payouts = await Payout.find(filter)
      .select('-bookingEarnings -razorpayx.lastWebhookPayload')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Aggregate earnings summary
    const summary = await Payout.aggregate([
      { $match: { partnerUserId: new mongoose.Types.ObjectId(partnerUserId), ...( partnerType ? { partnerType } : {} ) } },
      {
        $group: {
          _id:                  '$status',
          totalPartnerEarning:  { $sum: '$totalPartnerEarning' },
          totalCustomerPaid:    { $sum: '$totalCustomerPaid' },
          totalPlatformMargin:  { $sum: '$totalPlatformMargin' },
          count:                { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        payouts,
        summary,
        pagination: {
          total,
          page:       parseInt(page),
          limit:      parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    console.error('[PAYOUT PARTNER HISTORY]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
