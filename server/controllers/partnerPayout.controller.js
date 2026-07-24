/**
 * Payout Routes — Likeson.in
 *
 * Mount at: /api/payouts
 *
 * ENDPOINTS:
 *
 *  POST   /bank-account               → partner adds/updates bank account
 *  POST   /upi                        → partner adds/updates UPI
 *  GET    /fund-accounts              → list partner's fund accounts
 *
 *  POST   /admin/settle/:partnerType/:profileId  → admin triggers manual settlement
 *  POST   /admin/settle/batch         → admin runs settlement cycle
 *  GET    /admin/settlements          → list all settlements (admin)
 *  GET    /admin/payouts              → list all payouts (admin)
 *  POST   /admin/retry-failed         → manually trigger retry of failed payouts
 *
 *  POST   /refund                     → dispatch customer refund
 *
 *  POST   /webhook/razorpayx          → RazorpayX webhook receiver
 *
 *  GET    /my/settlements             → partner views their own settlements
 *  GET    /my/payouts                 → partner views their own payouts
 *  GET    /my/earnings                → partner views pending + total earnings
 */

import { body, param, query, validationResult } from 'express-validator';
import mongoose       from 'mongoose';

import {
  createOrSyncContact,
  createFundAccount,
  handleBankUpdate,
  dispatchPayout,
  handleWebhook,
  runSettlementCycle,
  triggerManualSettlement,
  dispatchCustomerRefund,
  retryFailedPayouts,
} from '../services/payoutService.js';

import Payout      from '../models/Payout.js';
import Settlement  from '../models/Settlement.js';
import FundAccount from '../models/FundAccount.js';


// ── Middleware placeholders ───────────────────────────────────────────────────
// Replace with your actual auth middleware

const requireAuth      = (req, res, next) => next();  // attach req.user
const requireAdmin     = (req, res, next) => next();  // check admin/superadmin role
const requireSuperAdmin= (req, res, next) => next();  // check superadmin role

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
  next();
}

// ── IFSC regex ────────────────────────────────────────────────────────────────
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ══════════════════════════════════════════════════════════════════════════════
// PARTNER — BANK / UPI MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/payouts/bank-account
 *
 * Partner adds or UPDATES their bank account.
 * If they already have a fund account → safe rotation (old deactivated, new created).
 *
 * Body: { partnerType, partnerProfileId, accountHolderName, accountNumber, ifscCode, bankName }
 */

import asyncHandler from '../utils/asyncHandler.js';

// POST '/bank-account'
export const postBankAccount = asyncHandler(async (req, res) => {
    try {
      const {
        partnerType, partnerProfileId,
        accountHolderName, accountNumber, ifscCode, bankName, branchName, accountType,
      } = req.body;

      const result = await handleBankUpdate({
        partnerType,
        partnerUserId:    req.user._id,
        partnerProfileId: new mongoose.Types.ObjectId(partnerProfileId),
        accountType:      'bank_account',
        bankDetails: {
          accountHolderName,
          accountNumber,
          ifscCode:    ifscCode.toUpperCase(),
          bankName,
          branchName:  branchName || '',
          accountType: accountType || 'savings',
        },
        updatedByUserId: req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Bank account updated. Payouts will use this account from next cycle.',
        data: {
          newFundAccountId: result.newFundAccount.razorpayFundAccountId,
          display:          result.newFundAccount.displayAccount,
        },
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

// POST '/upi'
export const postUpi = asyncHandler(async (req, res) => {
    try {
      const { partnerType, partnerProfileId, upiAddress } = req.body;

      const result = await handleBankUpdate({
        partnerType,
        partnerUserId:    req.user._id,
        partnerProfileId: new mongoose.Types.ObjectId(partnerProfileId),
        accountType:      'vpa',
        vpaDetails:       { address: upiAddress },
        updatedByUserId:  req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'UPI updated. Payouts will use this UPI from next cycle.',
        data: {
          newFundAccountId: result.newFundAccount.razorpayFundAccountId,
          display:          result.newFundAccount.displayAccount,
        },
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

// GET '/fund-accounts'
export const getFundAccounts = asyncHandler(async (req, res) => {
    try {
      const { partnerProfileId } = req.query;

      const accounts = await FundAccount.find({
        partnerUserId: req.user._id,
        partnerProfileId: new mongoose.Types.ObjectId(partnerProfileId),
      })
        .select('-bank.accountNumber -razorpayRawResponse')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        data: accounts.map(a => ({
          ...a,
          displayAccount: a.accountType === 'bank_account'
            ? `${a.bank?.bankName} ••••${a.bank?.accountNumberLast4}`
            : `UPI: ${a.vpa?.address}`,
        })),
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

// GET '/my/settlements'
export const getMySettlements = asyncHandler(async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const filter = { partnerUserId: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const [settlements, total] = await Promise.all([
      Settlement.find(filter)
        .select('-settledBookings -statusLog')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Settlement.countDocuments(filter),
    ]);

    res.json({ success: true, data: settlements, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/my/settlements/:id'
export const getMySettlementsById = asyncHandler(async (req, res) => {
  try {
    const s = await Settlement.findOne({
      _id:            req.params.id,
      partnerUserId:  req.user._id,
    }).populate('payoutId', 'payoutCode status processedAt fundAccountSnapshot').lean();

    if (!s) return res.status(404).json({ success: false, message: 'Settlement not found' });
    res.json({ success: true, data: s });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/my/payouts'
export const getMyPayouts = asyncHandler(async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const filter = { recipientUserId: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .select('-earningLines -webhookRaw -statusLog')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payout.countDocuments(filter),
    ]);

    res.json({ success: true, data: payouts, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/my/earnings'
export const getMyEarnings = asyncHandler(async (req, res) => {
  try {
    const { partnerType, partnerProfileId } = req.query;
    if (!partnerType || !partnerProfileId) {
      return res.status(400).json({ success: false, message: 'partnerType + partnerProfileId required' });
    }

    const MODELS = {
      doctor: 'DoctorProfile', hospital: 'Hospital',
      transportpartner: 'TransportPartner', driver: 'Driver',
      solodriverpartner: 'SoloDriverPartner', pharmacy: 'PharmacyStore',
      lab_partner: 'LabPartnerProfile',
    };
    const ModelName = MODELS[partnerType];
    if (!ModelName) return res.status(400).json({ success: false, message: 'Invalid partnerType' });

    const profile = await mongoose.model(ModelName)
      .findById(partnerProfileId)
      .select('earnings')
      .lean();

    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });

    const e = profile.earnings || {};
    res.json({
      success: true,
      data: {
        pendingPayoutPaise:    e.pendingPayoutPaise    || 0,
        pendingPayoutRupees:   +((e.pendingPayoutPaise || 0) / 100).toFixed(2),
        totalPaidPaise:        e.totalPaidPaise        || 0,
        totalPaidRupees:       +((e.totalPaidPaise     || 0) / 100).toFixed(2),
        lifetimeEarningsPaise: e.lifetimeEarningsPaise || 0,
        lifetimeEarningsRupees: +((e.lifetimeEarningsPaise || 0) / 100).toFixed(2),
        lastPayoutAt:          e.lastPayoutAt          || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/admin/settle/:partnerType/:profileId'
export const postAdminSettleByPartnerTypeByProfileId = asyncHandler(async (req, res) => {
    try {
      const { partnerType, profileId } = req.params;

      const periodEnd   = req.body.periodEnd   ? new Date(req.body.periodEnd)   : new Date();
      const periodStart = req.body.periodStart
        ? new Date(req.body.periodStart)
        : new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch userId from profile
      const MODELS = {
        doctor: 'DoctorProfile', hospital: 'Hospital',
        transportpartner: 'TransportPartner', driver: 'Driver',
        solodriverpartner: 'SoloDriverPartner', pharmacy: 'PharmacyStore',
        care_assistant: 'CareAssistantProfile', lab_partner: 'LabPartnerProfile',
      };
      const profile = await mongoose.model(MODELS[partnerType])
        .findById(profileId).select('user').lean();
      if (!profile) return res.status(404).json({ success: false, message: 'Partner not found' });

      const settlement = await triggerManualSettlement({
        partnerType,
        partnerUserId:    profile.user,
        partnerProfileId: new mongoose.Types.ObjectId(profileId),
        periodStart,
        periodEnd,
        cycle:            'Manual',
        trigger:          'manual',
        adminUserId:      req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Settlement triggered',
        data: {
          settlementCode:         settlement.settlementCode,
          finalPayableRupees:     settlement.finalPayableRupees,
          status:                 settlement.status,
        },
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

// POST '/admin/settle/batch'
export const postAdminSettleBatch = asyncHandler(async (req, res) => {
    try {
      const results = await runSettlementCycle(req.body.cycle, req.user._id);
      res.json({ success: true, data: results });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

// GET '/admin/settlements'
export const getAdminSettlements = asyncHandler(async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 30);
    const filter = {};
    if (req.query.partnerType)   filter.partnerType   = req.query.partnerType;
    if (req.query.partnerUserId) filter.partnerUserId = req.query.partnerUserId;
    if (req.query.status)        filter.status        = req.query.status;

    const [settlements, total] = await Promise.all([
      Settlement.find(filter)
        .select('-settledBookings')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('payoutId', 'payoutCode status razorpayPayoutId')
        .lean(),
      Settlement.countDocuments(filter),
    ]);

    res.json({ success: true, data: settlements, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/payouts'
export const getAdminPayouts = asyncHandler(async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 30);
    const filter = {};
    if (req.query.payoutFor) filter.payoutFor = req.query.payoutFor;
    if (req.query.status)    filter.status    = req.query.status;

    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .select('-earningLines -webhookRaw')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Payout.countDocuments(filter),
    ]);

    res.json({ success: true, data: payouts, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/admin/retry-failed'
export const postAdminRetryFailed = asyncHandler(async (req, res) => {
  try {
    const results = await retryFailedPayouts(req.user._id);
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/refund'
export const postRefund = asyncHandler(async (req, res) => {
    try {
      const payout = await dispatchCustomerRefund({
        customerUserId: new mongoose.Types.ObjectId(req.body.customerUserId),
        amountPaise:    req.body.amountPaise,
        narration:      req.body.narration,
        bookingId:      req.body.bookingId ? new mongoose.Types.ObjectId(req.body.bookingId) : undefined,
        adminUserId:    req.user._id,
      });

      res.status(201).json({
        success: true,
        message: 'Refund dispatched',
        data: { payoutCode: payout.payoutCode, status: payout.status },
      });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

// POST '/webhook/razorpayx'
export const postWebhookRazorpayx = asyncHandler(async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing signature header' });
    }

    // rawBody must be the raw Buffer/string — ensure your middleware attaches it
    const rawBody = req.rawBody || req.body;
    const payload = typeof rawBody === 'string'
      ? JSON.parse(rawBody)
      : (Buffer.isBuffer(rawBody) ? JSON.parse(rawBody.toString()) : rawBody);

    const result = await handleWebhook(
      typeof rawBody === 'string' ? rawBody : rawBody.toString(),
      signature,
      payload
    );

    res.json({ received: true, ...result });
  } catch (err) {
    // Always return 200 to Razorpay (avoid retries on logic errors)
    // Log the actual error internally
    console.error('[RazorpayX Webhook Error]', err.message, err.stack);
    res.json({ received: true, error: err.message });
  }
});
