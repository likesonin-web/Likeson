/**
 * partnerWalletRouter.js — Likeson.in
 *
 * Wallet router for PARTNERS ONLY (doctor, hospital, care_assistant, driver,
 * solodriverpartner, transportpartner, lab_partner). Customers never touch
 * this router — they use walletRouter.js / Wallet model instead.
 *
 * NOTE: PartnerWallet is a CACHED PROJECTION — the source of truth is the
 * PartnerWalletTransaction ledger (per model comment). This router only
 * implements what PartnerWallet.js actually exposes (balances, bankDetails,
 * KYC flags). Payout / withdrawal-request endpoints need a PartnerWithdrawal
 * model + PartnerWalletTransaction ledger service, neither of which were
 * provided — wire those in the same pattern as walletRouter.js's
 * /admin/withdrawals/:requestId/complete once those models exist.
 *
 * Architecture mirrors walletRouter.js:
 *   Utilities → Middleware → Validators → Route Handlers → Error Handler
 */

import express from 'express';

import { protect, authorize } from '../middleware/authMiddleware.js';
import cache                  from '../middleware/cache.js';
import {
  invalidateKey,
  invalidatePattern,
}                             from '../utils/cacheInvalidation.js';

import PartnerWallet, { PARTNER_TYPES, WALLET_STATUSES } from '../models/PartnerWallet.js';
import Notification  from '../models/Notification.js';
import SystemLog      from '../models/SystemLog.js';

const router = express.Router();

const { NODE_ENV } = process.env;

// ─────────────────────────────────────────────────────────────────────────────
// Logging utilities (same shape as walletRouter.js)
// ─────────────────────────────────────────────────────────────────────────────

const logAudit = (action, meta = {}) =>
  console.log(
    JSON.stringify({
      ts:   new Date().toISOString(),
      type: 'AUDIT',
      action,
      ...meta,
    })
  );

const persistLog = async ({
  level    = 'info',
  category = 'payment',
  message,
  actor    = {},
  metadata = null,
  request  = {},
  relatedEntity = {},
}) => {
  try {
    await SystemLog.createLog({ level, category, message, actor, metadata, request, relatedEntity });
  } catch (err) {
    console.error('[SystemLog] persist failed:', err.message);
  }
};

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const parsePagination = (query, maxLimit = 50) => ({
  page:  Math.max(1, parseInt(query.page, 10) || 1),
  limit: Math.min(maxLimit, parseInt(query.limit, 10) || 20),
});

// ─────────────────────────────────────────────────────────────────────────────
// Role guards
// ─────────────────────────────────────────────────────────────────────────────
// PARTNER SECTION = any role in PARTNER_TYPES. customer explicitly excluded —
// PARTNER_TYPES already doesn't include 'customer', so this can't leak.
// ADMIN SECTION = admin | superadmin ONLY.

// hardcoded, decoupled from PARTNER_TYPES shared reference —
// prevents downstream mutation elsewhere in app from silently
// dropping 'hospital' (or any role) from this guard
const onlyPartner = authorize(
  'doctor',
  'hospital',
  'care_assistant',
  'driver',
  'solodriverpartner',
  'transportpartner',
  'lab_partner'
);
const onlyAdmin = authorize('admin', 'superadmin');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const findOrCreatePartnerWallet = async (partnerId, partnerRole) => {
  let wallet = await PartnerWallet.findOne({ partner: partnerId });
  if (!wallet) {
    wallet = await PartnerWallet.create({ partner: partnerId, partnerRole });
    logAudit('PARTNER_WALLET_CREATED', { partnerId, partnerRole });
    await persistLog({
      level:   'success',
      message: 'Partner wallet auto-created',
      actor:   { userId: partnerId, role: partnerRole },
      relatedEntity: { model: 'User', entityId: partnerId },
    });
  }
  return wallet;
};

const invalidatePartnerWalletCache = (partnerId) =>
  Promise.allSettled([
    invalidateKey(`partnerWallet:${partnerId}`),
    invalidateKey(`GET:/api/partner-wallet/me`),
    invalidatePattern(`partnerWallet:${partnerId}:*`),
  ]);

const maskPartnerBank = (acc) => ({
  _id:                acc._id,
  accountHolderName:  acc.accountHolderName,
  maskedAccount:      `XXXX${acc.accountNumberLast4}`,
  ifscCode:           acc.ifscCode,
  bankName:           acc.bankName,
  branchName:         acc.branchName,
  upiId:              acc.upiId,
  isPrimary:          acc.isPrimary,
  isVerified:         acc.isVerified,
  verifiedAt:         acc.verifiedAt,
  source:             acc.source,
  addedAt:            acc.addedAt,
});

const dispatchNotification = async (userId, { title, body, type }) => {
  try {
    await Notification.create({ recipient: userId, title, body, type, priority: 'High' });
  } catch (err) {
    logAudit('NOTIFICATION_FAILURE', { userId, error: err.message });
  }
};

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ─────────────────────────────────────────────────────────────────────────────
// Routes — Partner (any PARTNER_TYPES role, never customer)
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/partner-wallet/me ────────────────────────────────────────────────
router.get(
  '/me',
  protect,
  onlyPartner,
  cache(30, (req) => `partnerWallet:${req.user._id}`),
  asyncHandler(async (req, res) => {
    const wallet = await findOrCreatePartnerWallet(req.user._id, req.user.role);
    res.status(200).json({
      success: true,
      wallet: {
        ...wallet.toObject(),
        bankDetails: wallet.bankDetails.map(maskPartnerBank),
      },
    });
  })
);

// ── GET /api/partner-wallet/bank-accounts ─────────────────────────────────────
router.get(
  '/bank-accounts',
  protect,
  onlyPartner,
  asyncHandler(async (req, res) => {
    const wallet = await findOrCreatePartnerWallet(req.user._id, req.user.role);
    res.status(200).json({
      success:     true,
      bankAccounts: wallet.bankDetails.map(maskPartnerBank),
    });
  })
);

// ── POST /api/partner-wallet/bank-accounts ────────────────────────────────────
/**
 * Adds a bank account for the partner wallet. Manual add — isVerified false
 * until admin verifies (mirrors bankVerified gate on isWithdrawable virtual).
 * Full account number is never persisted — only last 4 digits, per schema.
 */
router.post(
  '/bank-accounts',
  protect,
  onlyPartner,
  asyncHandler(async (req, res) => {
    const { accountHolderName, accountNumber, ifscCode, bankName, branchName, upiId, isPrimary } = req.body;

    if (!accountHolderName?.trim()) {
      return res.status(400).json({ success: false, message: 'accountHolderName is required' });
    }
    if (!accountNumber) {
      return res.status(400).json({ success: false, message: 'accountNumber is required' });
    }
    if (!ifscCode) {
      return res.status(400).json({ success: false, message: 'ifscCode is required' });
    }

    const cleanAccountNumber = accountNumber.replace(/\D/g, '');
    if (cleanAccountNumber.length < 9 || cleanAccountNumber.length > 18) {
      return res.status(400).json({ success: false, message: 'Account number must be between 9 and 18 digits' });
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!IFSC_RE.test(cleanIfsc)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC code format' });
    }

    const wallet = await findOrCreatePartnerWallet(req.user._id, req.user.role);
    if (wallet.bankDetails.length >= 3) {
      return res.status(400).json({ success: false, message: 'Maximum 3 bank accounts allowed. Remove one to add another.' });
    }

    wallet.bankDetails.push({
      accountHolderName:  accountHolderName.trim(),
      accountNumberLast4: cleanAccountNumber.slice(-4),
      ifscCode:           cleanIfsc,
      bankName:           bankName?.trim(),
      branchName:         branchName?.trim(),
      upiId:              upiId?.trim() || null,
      isPrimary:          isPrimary === true,
      isVerified:         false,
      source:             'manual',
      addedAt:            new Date(),
      updatedAt:          new Date(),
    });

    await wallet.save();
    await invalidatePartnerWalletCache(req.user._id);

    logAudit('PARTNER_BANK_ACCOUNT_ADDED', {
      partnerId:     req.user._id,
      maskedAccount: `XXXX${cleanAccountNumber.slice(-4)}`,
    });

    await persistLog({
      level:    'success',
      category: 'payment',
      message:  'Partner bank account added — pending admin verification',
      actor:    { userId: req.user._id, role: req.user.role },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    res.status(201).json({
      success:      true,
      message:      'Bank account added. Awaiting admin verification.',
      bankAccounts: wallet.bankDetails.map(maskPartnerBank),
    });
  })
);

// ── PATCH /api/partner-wallet/bank-accounts/:bankId/set-primary ───────────────
router.patch(
  '/bank-accounts/:bankId/set-primary',
  protect,
  onlyPartner,
  asyncHandler(async (req, res) => {
    const { bankId } = req.params;

    const wallet = await PartnerWallet.findOne({ partner: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const target = wallet.bankDetails.id(bankId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    wallet.bankDetails.forEach((b) => { b.isPrimary = false; });
    target.isPrimary = true;
    target.updatedAt = new Date();

    await wallet.save();
    await invalidatePartnerWalletCache(req.user._id);

    logAudit('PARTNER_BANK_ACCOUNT_SET_PRIMARY', { partnerId: req.user._id, bankId });

    res.status(200).json({ success: true, message: 'Primary bank account updated', primaryBank: maskPartnerBank(target) });
  })
);

// ── DELETE /api/partner-wallet/bank-accounts/:bankId ──────────────────────────
router.delete(
  '/bank-accounts/:bankId',
  protect,
  onlyPartner,
  asyncHandler(async (req, res) => {
    const { bankId } = req.params;

    const wallet = await PartnerWallet.findOne({ partner: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const target = wallet.bankDetails.id(bankId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    if (target.isPrimary && wallet.bankDetails.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove the primary account while others exist. Set a new primary first.',
      });
    }

    target.deleteOne();
    await wallet.save();
    await invalidatePartnerWalletCache(req.user._id);

    logAudit('PARTNER_BANK_ACCOUNT_REMOVED', { partnerId: req.user._id, bankId });

    res.status(200).json({ success: true, message: 'Bank account removed successfully' });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Admin — Partner Wallet Management (admin | superadmin ONLY)
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/partner-wallet/admin/wallets ─────────────────────────────────────
router.get(
  '/admin/wallets',
  protect,
  onlyAdmin,
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query, 100);
    const { partnerRole, walletStatus } = req.query;

    const filter = {};
    if (partnerRole && PARTNER_TYPES.includes(partnerRole)) filter.partnerRole = partnerRole;
    if (walletStatus && WALLET_STATUSES.includes(walletStatus)) filter.walletStatus = walletStatus;

    const [results, total] = await Promise.all([
      PartnerWallet.find(filter)
        .populate('partner', 'name email phone role')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PartnerWallet.countDocuments(filter),
    ]);

    results.forEach((w) => { w.bankDetails = (w.bankDetails || []).map(maskPartnerBank); });

    res.status(200).json({ success: true, total, page, limit, wallets: results });
  })
);

// ── GET /api/partner-wallet/admin/wallets/:walletId ───────────────────────────
router.get(
  '/admin/wallets/:walletId',
  protect,
  onlyAdmin,
  asyncHandler(async (req, res) => {
    const wallet = await PartnerWallet.findById(req.params.walletId)
      .populate('partner', 'name email phone role')
      .lean();

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    wallet.bankDetails = (wallet.bankDetails || []).map(maskPartnerBank);
    res.status(200).json({ success: true, wallet });
  })
);

// ── PATCH /api/partner-wallet/admin/wallets/:walletId/status ─────────────────
/**
 * [Admin] Sets walletStatus: active | frozen | suspended | closed.
 */
router.patch(
  '/admin/wallets/:walletId/status',
  protect,
  onlyAdmin,
  asyncHandler(async (req, res) => {
    const { walletStatus } = req.body;

    if (!WALLET_STATUSES.includes(walletStatus)) {
      return res.status(400).json({
        success: false,
        message: `walletStatus must be one of: ${WALLET_STATUSES.join(', ')}`,
      });
    }

    const wallet = await PartnerWallet.findById(req.params.walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    wallet.walletStatus = walletStatus;
    wallet.updatedBy     = req.user._id;
    await wallet.save();
    await invalidatePartnerWalletCache(wallet.partner);

    logAudit('PARTNER_WALLET_STATUS_CHANGED', {
      adminId:  req.user._id,
      walletId: wallet._id,
      walletStatus,
    });

    await persistLog({
      level:    'warning',
      category: 'system',
      message:  `Partner wallet ${wallet._id} status set to ${walletStatus}`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      relatedEntity: { model: 'User', entityId: wallet.partner },
    });

    res.status(200).json({ success: true, message: 'Wallet status updated', walletStatus: wallet.walletStatus });
  })
);

// ── PATCH /api/partner-wallet/admin/wallets/:walletId/kyc-status ─────────────
/**
 * [Admin] Sets kycVerified / bankVerified flags directly (per model docstring).
 * Body: { kycVerified?: boolean, bankVerified?: boolean }
 */
router.patch(
  '/admin/wallets/:walletId/kyc-status',
  protect,
  onlyAdmin,
  asyncHandler(async (req, res) => {
    const { kycVerified, bankVerified } = req.body;

    if (typeof kycVerified !== 'boolean' && typeof bankVerified !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one of kycVerified or bankVerified as a boolean',
      });
    }

    const wallet = await PartnerWallet.findById(req.params.walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    if (typeof kycVerified === 'boolean')  wallet.kycVerified  = kycVerified;
    if (typeof bankVerified === 'boolean') wallet.bankVerified = bankVerified;
    wallet.updatedBy = req.user._id;

    await wallet.save();
    await invalidatePartnerWalletCache(wallet.partner);

    logAudit('PARTNER_WALLET_KYC_UPDATED', {
      adminId:  req.user._id,
      walletId: wallet._id,
      kycVerified:  wallet.kycVerified,
      bankVerified: wallet.bankVerified,
    });

    dispatchNotification(wallet.partner, {
      title: 'Wallet KYC Status Updated',
      body:  `Your wallet KYC verification status has been updated by admin.`,
      type:  'KYC_Approved',
    });

    res.status(200).json({
      success:      true,
      message:      'KYC status updated',
      kycVerified:  wallet.kycVerified,
      bankVerified: wallet.bankVerified,
    });
  })
);

// ── PATCH /api/partner-wallet/admin/wallets/:walletId/hold ───────────────────
/**
 * [Admin] Places or releases a compliance hold. Body: { hold: boolean, reason? }
 */
router.patch(
  '/admin/wallets/:walletId/hold',
  protect,
  onlyAdmin,
  asyncHandler(async (req, res) => {
    const { hold, reason } = req.body;

    if (typeof hold !== 'boolean') {
      return res.status(400).json({ success: false, message: 'hold must be a boolean' });
    }

    const wallet = await PartnerWallet.findById(req.params.walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    wallet.complianceHold = hold;
    wallet.holdReason     = hold ? (reason || null) : null;
    wallet.holdAt         = hold ? new Date() : wallet.holdAt;
    wallet.holdReleasedAt = hold ? null : new Date();
    wallet.updatedBy      = req.user._id;

    await wallet.save();
    await invalidatePartnerWalletCache(wallet.partner);

    logAudit('PARTNER_WALLET_HOLD_TOGGLED', {
      adminId:  req.user._id,
      walletId: wallet._id,
      hold,
      reason,
    });

    dispatchNotification(wallet.partner, {
      title: hold ? 'Wallet On Hold' : 'Wallet Hold Released',
      body:  hold
        ? `Your wallet has been placed on compliance hold.${reason ? ` Reason: ${reason}` : ''}`
        : 'Your wallet compliance hold has been released.',
      type: hold ? 'Payment_Failed' : 'Payment_Success',
    });

    res.status(200).json({ success: true, message: hold ? 'Hold applied' : 'Hold released', complianceHold: wallet.complianceHold });
  })
);

// ── PATCH /api/partner-wallet/admin/bank-accounts/:walletId/:bankId/verify ───
router.patch(
  '/admin/bank-accounts/:walletId/:bankId/verify',
  protect,
  onlyAdmin,
  asyncHandler(async (req, res) => {
    const { walletId, bankId } = req.params;

    const wallet = await PartnerWallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const account = wallet.bankDetails.id(bankId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    account.isVerified = true;
    account.verifiedAt = new Date();
    account.updatedAt  = new Date();

    await wallet.save(); // pre-save hook syncs wallet.bankVerified from primary
    await invalidatePartnerWalletCache(wallet.partner);

    logAudit('PARTNER_BANK_ACCOUNT_VERIFIED_BY_ADMIN', {
      adminId: req.user._id,
      walletId,
      bankId,
    });

    dispatchNotification(wallet.partner, {
      title: 'Bank Account Verified',
      body:  `Your bank account ending in ${account.accountNumberLast4} is verified.`,
      type:  'KYC_Approved',
    });

    res.status(200).json({
      success: true,
      message: 'Bank account verified.',
      account: maskPartnerBank(account),
      bankVerified: wallet.bankVerified,
    });
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// Centralised Error Handler
// Must be the last use() registered on this router.
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
router.use(async (err, req, res, _next) => {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logAudit('PARTNER_WALLET_ROUTER_ERROR', {
    message,
    userId: req.user?._id,
    path:   req.originalUrl,
    stack:  NODE_ENV !== 'production' ? err.stack : undefined,
  });

  await persistLog({
    level:    'error',
    category: 'system',
    message:  `Partner wallet router error: ${message}`,
    actor:    { userId: req.user?._id, ip: req.ip },
    request:  { method: req.method, path: req.originalUrl, statusCode: status },
    metadata: { stack: NODE_ENV !== 'production' ? err.stack : undefined },
  }).catch(() => {});

  res.status(status).json({
    success: false,
    message: status === 500 ? 'A system error occurred. Please try again later.' : message,
  });
});

export default router;