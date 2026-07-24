/**
 * walletRouter.js — Likeson.in
 *
 * Enterprise-grade wallet router.
 * Razorpay-only payout flow. P2P / UPI features removed.
 * All bugs from wallet.model.js audit applied here consistently.
 *
 * Architecture:
 *   Utilities → Middleware → Validators → Route Handlers → Error Handler
 */

import Razorpay from 'razorpay';
import crypto   from 'crypto';
import axios    from 'axios';

import { protect, authorize } from '../middleware/authMiddleware.js';
import cache                  from '../middleware/cache.js';
import {
  invalidateKey,
  invalidatePattern,
}                             from '../utils/cacheInvalidation.js';

import Wallet, {
  WITHDRAWAL_LIMITS,
  WITHDRAWABLE_PURPOSES,
}                             from '../models/Wallet.js';
import User                   from '../models/User.js';
import Notification            from '../models/Notification.js';
import SystemLog               from '../models/SystemLog.js';
import sendEmail               from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';


// ─────────────────────────────────────────────────────────────────────────────
// Environment / Config
// ─────────────────────────────────────────────────────────────────────────────

const {
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  RAZORPAY_X_KEY_ID,
  RAZORPAY_X_KEY_SECRET,
  RAZORPAY_X_ACCOUNT_NUMBER,
  NODE_ENV,
} = process.env;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error('[BOOT] FATAL: Razorpay standard credentials not set');
}
if (!RAZORPAY_X_KEY_ID || !RAZORPAY_X_KEY_SECRET) {
  console.error('[BOOT] WARN:  Razorpay X credentials not set — payouts will fail');
}
if (!RAZORPAY_X_ACCOUNT_NUMBER) {
  console.error('[BOOT] WARN:  RAZORPAY_X_ACCOUNT_NUMBER not set — payouts will fail');
}

/** Standard Razorpay SDK instance (orders, payments). */
const razorpay = new Razorpay({
  key_id:     RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// Logging utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured console audit log.
 * Replace with Winston transport in production.
 */
const logAudit = (action, meta = {}) =>
  console.log(
    JSON.stringify({
      ts:     new Date().toISOString(),
      type:   'AUDIT',
      action,
      ...meta,
    })
  );

/**
 * Persists a SystemLog entry non-blocking.
 * Never propagates errors to callers.
 */
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
    await SystemLog.createLog({
      level,
      category,
      message,
      actor,
      metadata,
      request,
      relatedEntity,
    });
  } catch (err) {
    console.error('[SystemLog] persist failed:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Async handler
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

const parsePagination = (query, maxLimit = 50) => ({
  page:  Math.max(1, parseInt(query.page,  10) || 1),
  limit: Math.min(maxLimit, parseInt(query.limit, 10) || 20),
});

// ─────────────────────────────────────────────────────────────────────────────
// Wallet helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns existing wallet or creates one.
 * No UPI ID generated — Razorpay handles UPI.
 */
const findOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({
      user:         userId,
      balance:      0,
      transactions: [],
    });

    logAudit('WALLET_CREATED', { userId });

    await persistLog({
      level:   'success',
      message: 'Wallet auto-created',
      actor:   { userId, role: 'customer' },
      relatedEntity: { model: 'User', entityId: userId },
    });
  }
  return wallet;
};

/**
 * Invalidates all cached wallet data for a user.
 * Fire-and-forget — allSettled swallows partial failures.
 */
const invalidateWalletCache = (userId) =>
  Promise.allSettled([
    invalidateKey(`wallet:${userId}`),
    invalidateKey(`GET:/api/wallet/me`),
    invalidatePattern(`wallet:${userId}:*`),
  ]);

/**
 * Dispatches in-app notification + email.
 * Non-blocking; swallows all errors.
 */
const dispatchNotification = async (userId, { title, body, type, emailSubject }) => {
  try {
    await Notification.create({ recipient: userId, title, body, type, priority: 'High' });
    const user = await User.findById(userId).select('email').lean();
    if (user?.email) {
      const html = transactionalTemplate({
        header:     'LIKESON HEALTHCARE',
        title:      emailSubject || title,
        body,
        buttonText: 'View Wallet',
        buttonLink: 'https://likeson.in/wallet',
      });
      await sendEmail({
        email:   user.email,
        subject: `[Likeson] ${emailSubject || title}`,
        html,
      });
    }
  } catch (err) {
    logAudit('NOTIFICATION_FAILURE', { userId, error: err.message });
  }
};

/**
 * Returns a client-safe masked bank account object.
 * Strips raw accountNumber; exposes only last-4.
 */
const maskBankAccount = (acc) => ({
  _id:                  acc._id,
  accountHolderName:    acc.accountHolderName,
  maskedAccount:        `XXXX${acc.accountNumber.slice(-4)}`,
  ifscCode:             acc.ifscCode,
  bankName:             acc.bankName,
  branchName:           acc.branchName,
  accountType:          acc.accountType,
  isPrimary:            acc.isPrimary,
  isVerified:           acc.isVerified,
  verifiedAt:           acc.verifiedAt,
  razorpayFundAccountId: acc.razorpayFundAccountId,
  addedAt:              acc.addedAt,
});

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay X — Payout API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initiates a bank payout via Razorpay X REST API.
 *
 * @param {object} opts
 * @param {string} opts.razorpayFundAccountId - fa_... ID stored on bank account
 * @param {number} opts.amountPaise           - amount in paise (integer)
 * @param {string} opts.requestId             - WDR-... used as reference_id
 * @param {string} [opts.narration]
 * @returns {Promise<object>} Razorpay payout object
 * @throws  Axios error with response.data.error on Razorpay failure
 */
const initiateRazorpayXPayout = async ({
  razorpayFundAccountId,
  amountPaise,
  requestId,
  narration,
}) => {
  const response = await axios.post(
    'https://api.razorpay.com/v1/payouts',
    {
      account_number:       RAZORPAY_X_ACCOUNT_NUMBER,
      fund_account_id:      razorpayFundAccountId,
      amount:               amountPaise,
      currency:             'INR',
      mode:                 'IMPS',
      purpose:              'payout',
      queue_if_low_balance: true,
      reference_id:         requestId,
      narration:            narration || 'Likeson Wallet Withdrawal',
      notes: {
        source:    'likeson_wallet',
        requestId,
      },
    },
    {
      auth: {
        username: RAZORPAY_X_KEY_ID,
        password: RAZORPAY_X_KEY_SECRET,
      },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15_000,
    }
  );
  return response.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline validators (return error string or null)
// ─────────────────────────────────────────────────────────────────────────────

const validateAmount = (value, { min, max, label = 'Amount' } = {}) => {
  const n = Number(value);
  if (!value || isNaN(n) || n <= 0) return `${label} must be a positive number`;
  if (min !== undefined && n < min)  return `Minimum ${label.toLowerCase()} is ₹${min}`;
  if (max !== undefined && n > max)  return `Maximum ${label.toLowerCase()} per request is ₹${max.toLocaleString('en-IN')}`;
  return null;
};

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

// ─────────────────────────────────────────────────────────────────────────────
// Routes — User
// ─────────────────────────────────────────────────────────────────────────────

// ── GET /api/wallet/me ────────────────────────────────────────────────────────
/**
 * Returns the authenticated user's wallet.
 * Cached 30 s per user.
 */

import asyncHandler from '../utils/asyncHandler.js';

// wallet.controller.js — Likeson.in
// Moved verbatim from routes/walletRoutes.js. Logic unchanged; only wrapped as named exports.

// GET '/me'
export const getMe = asyncHandler(async (req, res) => {
    const wallet = await findOrCreateWallet(req.user._id);
    res.status(200).json({ success: true, wallet });
  });

// POST '/add-money'
export const postAddMoney = asyncHandler(async (req, res) => {
    const { amount } = req.body;
    const err = validateAmount(amount, { min: 100, label: 'Top-up amount' });
    if (err) return res.status(400).json({ success: false, message: err });

    await findOrCreateWallet(req.user._id);

    const rzpOrder = await razorpay.orders.create({
      amount:   Math.round(Number(amount) * 100), // paise
      currency: 'INR',
      receipt:  `WALLET_${req.user._id.toString().slice(-6)}_${Date.now()}`,
      notes:    { userId: req.user._id.toString(), type: 'wallet_topup' },
    });

    logAudit('WALLET_TOPUP_INIT', {
      userId:     req.user._id,
      amount,
      rzpOrderId: rzpOrder.id,
    });

    await persistLog({
      level:   'info',
      message: 'Wallet top-up order created',
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { amount, rzpOrderId: rzpOrder.id },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    res.status(200).json({ success: true, rzpOrder, razorpayKey: RAZORPAY_KEY_ID });
  });

// POST '/verify-topup'
export const postVerifyTopup = asyncHandler(async (req, res) => {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
      });
    }

    // 1. Verify HMAC-SHA256 signature
    const expectedSig = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSig !== razorpay_signature) {
      logAudit('WALLET_TOPUP_SECURITY_ALERT', {
        userId: req.user._id,
        razorpay_order_id,
        ip:     req.ip,
      });
      await persistLog({
        level:    'warning',
        category: 'security',
        message:  'Invalid Razorpay signature on wallet top-up',
        actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
        request:  { method: 'POST', path: req.originalUrl, statusCode: 400 },
        metadata: { razorpay_order_id, razorpay_payment_id },
        relatedEntity: { model: 'User', entityId: req.user._id },
      });
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    // 2. Fetch authoritative amount from Razorpay (never trust client)
    let verifiedAmountINR;
    try {
      const payment    = await razorpay.payments.fetch(razorpay_payment_id);
      verifiedAmountINR = payment.amount / 100; // paise → INR
      if (payment.status !== 'captured' && payment.status !== 'authorized') {
        return res.status(400).json({
          success: false,
          message: `Payment not captured. Status: ${payment.status}`,
        });
      }
    } catch (rzpErr) {
      logAudit('RAZORPAY_PAYMENT_FETCH_FAILED', {
        razorpay_payment_id,
        error: rzpErr.message,
      });
      return res.status(502).json({
        success: false,
        message: 'Failed to verify payment with Razorpay. Please contact support.',
      });
    }

    // 3. Idempotency guard — prevent double credit
    const wallet = await findOrCreateWallet(req.user._id);
    const alreadyCredited = wallet.transactions.some(
      (t) => t.transactionId === razorpay_payment_id
    );
    if (alreadyCredited) {
      return res.status(409).json({
        success: false,
        message: 'Payment already credited to wallet',
      });
    }

    // 4. Credit wallet (Add_Money → withdrawable per model pre-save hook)
    await wallet.credit(verifiedAmountINR, 'Add_Money', {
      transactionId: razorpay_payment_id,
      description:   `Wallet top-up via Razorpay (Order: ${razorpay_order_id})`,
    });

    await invalidateWalletCache(req.user._id);

    logAudit('WALLET_TOPUP_SUCCESS', {
      userId:     req.user._id,
      amount:     verifiedAmountINR,
    });

    await persistLog({
      level:   'success',
      message: `Wallet credited ₹${verifiedAmountINR} via Razorpay`,
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { verifiedAmountINR, razorpay_payment_id, razorpay_order_id },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    dispatchNotification(req.user._id, {
      title:        'Wallet Top-Up Successful',
      body:         `₹${verifiedAmountINR.toLocaleString('en-IN')} has been added to your Likeson Wallet.`,
      type:         'Payment_Success',
      emailSubject: 'Wallet Credited — Likeson Healthcare',
    });

    const updatedWallet = await Wallet.findOne({ user: req.user._id });
    res.status(200).json({ success: true, wallet: updatedWallet });
  });

// GET '/withdrawable-balance'
export const getWithdrawableBalance = asyncHandler(async (req, res) => {
    const wallet = await findOrCreateWallet(req.user._id);

    res.status(200).json({
      success:               true,
      balance:               wallet.balance,
      withdrawableBalance:   wallet.withdrawableBalance,
      lockedBalance:         wallet.lockedBalance,
      withdrawableAvailable: wallet.withdrawableAvailable,
      nonWithdrawable:       +(wallet.balance - wallet.withdrawableBalance).toFixed(2),
      withdrawableSources:   Array.from(WITHDRAWABLE_PURPOSES),
      note:                  'Only funds from top-up and referral bonus can be withdrawn to a bank account.',
      withdrawalLimits: {
        minAmount:  WITHDRAWAL_LIMITS.MIN_AMOUNT,
        maxAmount:  WITHDRAWAL_LIMITS.MAX_AMOUNT,
        dailyLimit: WITHDRAWAL_LIMITS.DAILY_LIMIT,
        usedToday:  wallet.getDailyWithdrawalTotal(),
      },
    });
  });

// GET '/bank-accounts'
export const getBankAccounts = asyncHandler(async (req, res) => {
    const wallet = await findOrCreateWallet(req.user._id);
    res.status(200).json({
      success:      true,
      bankAccounts: wallet.bankAccounts.map(maskBankAccount),
    });
  });

// POST '/bank-accounts'
export const postBankAccounts = asyncHandler(async (req, res) => {
    const {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      branchName,
      accountType,
      isPrimary,
    } = req.body;

    // ── 1. Input validation ──────────────────────────────────────────────────
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
      return res.status(400).json({
        success: false,
        message: 'Account number must be between 9 and 18 digits',
      });
    }

    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!IFSC_RE.test(cleanIfsc)) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC code format' });
    }

    // ── 2. Razorpay X credential guard ───────────────────────────────────────
    // Block early — avoids a guaranteed 401 from Razorpay and surfaces a
    // clear ops error instead of a confusing "Authentication failed" to the user.
    if (!RAZORPAY_X_KEY_ID || !RAZORPAY_X_KEY_SECRET) {
      logAudit('BANK_ACCOUNT_ADD_BLOCKED', {
        userId: req.user._id,
        reason: 'RAZORPAY_X credentials not configured',
      });
      return res.status(503).json({
        success: false,
        message:
          'Bank account verification is temporarily unavailable. ' +
          'Razorpay X credentials are not configured on this server. ' +
          'Please contact support.',
      });
    }

    // ── 3. Max account guard ─────────────────────────────────────────────────
    const wallet = await findOrCreateWallet(req.user._id);
    if (wallet.bankAccounts.length >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 3 bank accounts allowed. Remove one to add another.',
      });
    }

    const rzpAuth = {
      auth: {
        username: RAZORPAY_X_KEY_ID,
        password: RAZORPAY_X_KEY_SECRET,
      },
    };

    // ── 4a. Create Razorpay Contact ──────────────────────────────────────────
    let contactId;
    try {
      const contactRes = await axios.post(
        'https://api.razorpay.com/v1/contacts',
        {
          name:         accountHolderName.trim(),
          email:        req.user.email,
          contact:      req.user.phone?.replace(/\D/g, '') || '9999999999',
          type:         'customer',
          reference_id: req.user._id.toString(),
        },
        { ...rzpAuth, timeout: 10_000 }
      );
      contactId = contactRes.data.id;
    } catch (rzpErr) {
      const httpStatus = rzpErr.response?.status;
      const errMsg =
        rzpErr.response?.data?.error?.description ||
        rzpErr.response?.data?.error?.reason ||
        rzpErr.message ||
        'Unknown error';

      logAudit('RAZORPAY_CONTACT_CREATE_ERROR', {
        userId:     req.user._id,
        httpStatus,
        error:      errMsg,
        ifsc:       cleanIfsc,
      });

      // 401 = bad credentials — ops problem, not user problem
      if (httpStatus === 401) {
        return res.status(503).json({
          success: false,
          message:
            'Bank verification service is misconfigured (authentication error). ' +
            'Please contact support — do not retry.',
        });
      }

      return res.status(422).json({
        success: false,
        message: `Bank contact creation failed: ${errMsg}. Please check your details and try again.`,
      });
    }

    // ── 4b. Create Razorpay Fund Account ─────────────────────────────────────
    let razorpayFundAccountId;
    try {
      const fundRes = await axios.post(
        'https://api.razorpay.com/v1/fund_accounts',
        {
          contact_id:   contactId,
          account_type: 'bank_account',
          bank_account: {
            name:           accountHolderName.trim(),
            ifsc:           cleanIfsc,
            account_number: cleanAccountNumber,
          },
        },
        { ...rzpAuth, timeout: 10_000 }
      );
      razorpayFundAccountId = fundRes.data.id;
    } catch (rzpErr) {
      const httpStatus = rzpErr.response?.status;
      const errMsg =
        rzpErr.response?.data?.error?.description ||
        rzpErr.response?.data?.error?.reason ||
        rzpErr.message ||
        'Unknown error';

      logAudit('RAZORPAY_FUND_ACCOUNT_ERROR', {
        userId:     req.user._id,
        httpStatus,
        error:      errMsg,
        ifsc:       cleanIfsc,
        contactId,
      });

      if (httpStatus === 401) {
        return res.status(503).json({
          success: false,
          message:
            'Bank verification service is misconfigured (authentication error). ' +
            'Please contact support — do not retry.',
        });
      }

      // 400 from Razorpay = bad bank details (wrong account number, IFSC mismatch, etc.)
      return res.status(422).json({
        success: false,
        message: `Bank account verification failed: ${errMsg}. Please check your account number and IFSC code.`,
      });
    }

    // ── 5. Save to wallet ────────────────────────────────────────────────────
    const updatedWallet = await wallet.addBankAccount({
      accountHolderName:    accountHolderName.trim(),
      accountNumber:        cleanAccountNumber,
      ifscCode:             cleanIfsc,
      bankName:             bankName?.trim(),
      branchName:           branchName?.trim(),
      accountType:          accountType || 'Savings',
      isPrimary:            isPrimary === true,
      razorpayFundAccountId,
      isVerified:           true,
      verifiedAt:           new Date(),
    });

    logAudit('BANK_ACCOUNT_ADDED', {
      userId:               req.user._id,
      razorpayFundAccountId,
      maskedAccount:        `XXXX${cleanAccountNumber.slice(-4)}`,
    });

    await persistLog({
      level:    'success',
      category: 'payment',
      message:  'Bank account added and verified via Razorpay X',
      actor:    { userId: req.user._id, role: req.user.role },
      metadata: { razorpayFundAccountId, ifscCode: cleanIfsc },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    res.status(201).json({
      success:      true,
      message:      'Bank account verified and added successfully.',
      bankAccounts: updatedWallet.bankAccounts.map(maskBankAccount),
    });
  });

// PATCH '/bank-accounts/:bankAccountId/set-primary'
export const patchBankAccountsByBankAccountIdSetPrimary = asyncHandler(async (req, res) => {
    const { bankAccountId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const updatedWallet = await wallet.setPrimaryBankAccount(bankAccountId);

    logAudit('BANK_ACCOUNT_SET_PRIMARY', { userId: req.user._id, bankAccountId });

    res.status(200).json({
      success:            true,
      message:            'Primary bank account updated',
      primaryBankAccount: updatedWallet.primaryBankAccount,
    });
  });

// DELETE '/bank-accounts/:bankAccountId'
export const deleteBankAccountsByBankAccountId = asyncHandler(async (req, res) => {
    const { bankAccountId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const hasPendingWithdrawal = wallet.withdrawalRequests.some(
      (r) =>
        r.bankAccountId?.toString() === bankAccountId &&
        ['Pending', 'Approved'].includes(r.status)
    );
    if (hasPendingWithdrawal) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove this bank account while a withdrawal request is pending.',
      });
    }

    await wallet.removeBankAccount(bankAccountId);

    logAudit('BANK_ACCOUNT_REMOVED', { userId: req.user._id, bankAccountId });

    res.status(200).json({ success: true, message: 'Bank account removed successfully' });
  });

// GET '/withdrawals'
export const getWithdrawals = asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query);
    const { status }      = req.query;

    const wallet = await Wallet.findOne({ user: req.user._id }).lean();
    if (!wallet) {
      return res.status(200).json({ success: true, withdrawals: [], total: 0 });
    }

    let requests = [...wallet.withdrawalRequests].sort(
      (a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)
    );
    if (status) requests = requests.filter((r) => r.status === status);

    const total     = requests.length;
    const paginated = requests.slice((page - 1) * limit, page * limit);

    res.status(200).json({ success: true, total, page, limit, withdrawals: paginated });
  });

// POST '/withdrawals'
export const postWithdrawals = asyncHandler(async (req, res) => {
    const { amount, bankAccountId } = req.body;

    if (!bankAccountId) {
      return res.status(400).json({ success: false, message: 'bankAccountId is required' });
    }

    const amtErr = validateAmount(amount, {
      min:   WITHDRAWAL_LIMITS.MIN_AMOUNT,
      max:   WITHDRAWAL_LIMITS.MAX_AMOUNT,
      label: 'Withdrawal amount',
    });
    if (amtErr) return res.status(400).json({ success: false, message: amtErr });

    const withdrawAmount = Number(amount);
    const wallet         = await findOrCreateWallet(req.user._id);

    if (!wallet.isActive) {
      return res.status(403).json({ success: false, message: 'Your wallet is currently inactive' });
    }

    // Withdrawable balance check (model.withdrawableAvailable = withdrawableBalance − lockedBalance)
    if (wallet.withdrawableAvailable < withdrawAmount) {
      const isLocked = wallet.withdrawableBalance >= withdrawAmount;
      return res.status(400).json({
        success: false,
        message: isLocked
          ? `Amount is locked by a pending withdrawal. Available: ₹${wallet.withdrawableAvailable.toLocaleString('en-IN')}`
          : `Insufficient withdrawable balance. Only top-up and referral bonus money (₹${wallet.withdrawableBalance.toLocaleString('en-IN')}) can be withdrawn. Available: ₹${wallet.withdrawableAvailable.toLocaleString('en-IN')}`,
        withdrawableAvailable: wallet.withdrawableAvailable,
        withdrawableBalance:   wallet.withdrawableBalance,
        lockedBalance:         wallet.lockedBalance,
        withdrawableSources:   Array.from(WITHDRAWABLE_PURPOSES),
      });
    }

    // Daily limit check
    const dailyUsed = wallet.getDailyWithdrawalTotal();
    if (dailyUsed + withdrawAmount > WITHDRAWAL_LIMITS.DAILY_LIMIT) {
      const remaining = +(WITHDRAWAL_LIMITS.DAILY_LIMIT - dailyUsed).toFixed(2);
      return res.status(400).json({
        success: false,
        message: `Daily withdrawal limit exceeded. Remaining today: ₹${remaining.toLocaleString('en-IN')}`,
      });
    }

    // Delegate to model method (handles bank account existence, verification, locking)
    const { request } = await wallet.requestWithdrawal({
      amount:      withdrawAmount,
      bankAccountId,
      initiatedBy: req.user._id,
    });

    await invalidateWalletCache(req.user._id);

    logAudit('WITHDRAWAL_REQUESTED', {
      userId:       req.user._id,
      requestId:    request.requestId,
      amount:       withdrawAmount,
      bankAccountId,
    });

    await persistLog({
      level:   'info',
      message: `Withdrawal request submitted: ₹${withdrawAmount}`,
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 201 },
      metadata: { withdrawAmount, bankAccountId, requestId: request.requestId },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    dispatchNotification(req.user._id, {
      title:        'Withdrawal Request Submitted',
      body:         `Your withdrawal of ₹${withdrawAmount.toLocaleString('en-IN')} is pending admin approval.`,
      type:         'Payment_Pending',
      emailSubject: 'Withdrawal Request Received — Likeson Wallet',
    });

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted. Awaiting admin approval.',
      request: {
        requestId:         request.requestId,
        amount:            request.amount,
        status:            request.status,
        accountHolderName: request.accountHolderName,
        maskedAccount:     `XXXX${request.accountNumber}`, // already last-4 from model
        bankName:          request.bankName,
        requestedAt:       request.requestedAt,
      },
      withdrawableAvailable: wallet.withdrawableAvailable,
    });
  });

// GET '/withdrawals/:requestId'
export const getWithdrawalsByRequestId = asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id }).lean();
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    // Destructure raw accountNumber out; expose only masked version
    const { accountNumber, ...safeRequest } = request;
    res.status(200).json({
      success: true,
      request: { ...safeRequest, maskedAccount: `XXXX${accountNumber}` },
    });
  });

// POST '/withdrawals/:requestId/cancel'
export const postWithdrawalsByRequestIdCancel = asyncHandler(async (req, res) => {
    const { requestId } = req.params;

    const wallet = await Wallet.findOne({ user: req.user._id });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a withdrawal in status: ${request.status}. Only Pending requests can be cancelled.`,
      });
    }

    await wallet.rejectWithdrawal({
      requestId,
      reviewedBy: req.user._id,
      adminNote:  'Cancelled by user',
    });

    await invalidateWalletCache(req.user._id);

    logAudit('WITHDRAWAL_CANCELLED_BY_USER', {
      userId:    req.user._id,
      requestId,
      amount:    request.amount,
    });

    await persistLog({
      level:   'info',
      message: `User cancelled withdrawal ${requestId}`,
      actor:   { userId: req.user._id, role: req.user.role, ip: req.ip },
      request: { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { requestId, amount: request.amount },
      relatedEntity: { model: 'User', entityId: req.user._id },
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal cancelled. Funds have been unlocked.',
    });
  });

// GET '/transactions'
export const getTransactions = asyncHandler(async (req, res) => {
    const { page, limit }    = parsePagination(req.query);
    const { type, purpose }  = req.query;

    const wallet = await Wallet.findOne({ user: req.user._id }).lean();
    if (!wallet) {
      return res.status(200).json({ success: true, transactions: [], total: 0 });
    }

    let txns = [...wallet.transactions].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    if (type)    txns = txns.filter((t) => t.type    === type);
    if (purpose) txns = txns.filter((t) => t.purpose === purpose);

    const total     = txns.length;
    const paginated = txns.slice((page - 1) * limit, page * limit);

    res.status(200).json({ success: true, total, page, limit, transactions: paginated });
  });

// GET '/admin/withdrawals'
export const getAdminWithdrawals = asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query, 100);
    const status          = req.query.status || 'Pending';

    const [results, countResult] = await Promise.all([
      Wallet.aggregate([
        { $unwind: '$withdrawalRequests' },
        { $match:  { 'withdrawalRequests.status': status } },
        { $sort:   { 'withdrawalRequests.requestedAt': -1 } },
        { $skip:   (page - 1) * limit },
        { $limit:  limit },
        {
          $lookup: {
            from:         'users',
            localField:   'user',
            foreignField: '_id',
            as:           '_userArr',
            pipeline:     [{ $project: { name: 1, email: 1, phone: 1 } }],
          },
        },
        {
          $project: {
            _id:      0,
            walletId: '$_id',
            userId:   '$user',
            user:     { $arrayElemAt: ['$_userArr', 0] },
            request:  '$withdrawalRequests',
          },
        },
      ]),
      Wallet.aggregate([
        { $unwind: '$withdrawalRequests' },
        { $match:  { 'withdrawalRequests.status': status } },
        { $count:  'total' },
      ]),
    ]);

    res.status(200).json({
      success:     true,
      total:       countResult[0]?.total || 0,
      page,
      limit,
      withdrawals: results,
    });
  });

// POST '/admin/withdrawals/:requestId/approve'
export const postAdminWithdrawalsByRequestIdApprove = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { walletId }  = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }
    if (request.status !== 'Pending') {
      return res.status(400).json({
        success: false,
        message: `Request is already in status: ${request.status}`,
      });
    }

    request.status     = 'Approved';
    request.reviewedBy = req.user._id;
    request.reviewedAt = new Date();
    await wallet.save();

    await invalidateWalletCache(wallet.user);

    logAudit('WITHDRAWAL_APPROVED', {
      adminId:   req.user._id,
      requestId,
      userId:    wallet.user,
      amount:    request.amount,
    });

    await persistLog({
      level:    'success',
      category: 'payment',
      message:  `Withdrawal ${requestId} approved by admin`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { requestId, amount: request.amount, userId: wallet.user },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    dispatchNotification(wallet.user, {
      title:        'Withdrawal Approved',
      body:         `Your withdrawal of ₹${request.amount.toLocaleString('en-IN')} has been approved and will be credited shortly.`,
      type:         'Payment_Success',
      emailSubject: 'Withdrawal Approved — Likeson Wallet',
    });

    res.status(200).json({ success: true, message: 'Withdrawal request approved', request });
  });

// POST '/admin/withdrawals/:requestId/complete'
export const postAdminWithdrawalsByRequestIdComplete = asyncHandler(async (req, res) => {
    const { requestId } = req.params;
    const { walletId }  = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }

    if (!RAZORPAY_X_ACCOUNT_NUMBER) {
      logAudit('PAYOUT_CONFIG_MISSING', { adminId: req.user._id });
      return res.status(500).json({
        success: false,
        message: 'Platform error: RAZORPAY_X_ACCOUNT_NUMBER not configured.',
      });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    if (!['Pending', 'Approved'].includes(request.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete withdrawal in status: ${request.status}`,
      });
    }

    // Idempotency — payout already triggered
    if (request.razorpayPayoutId) {
      return res.status(409).json({
        success: false,
        message: `Payout already exists for this request: ${request.razorpayPayoutId}`,
      });
    }

    // Resolve bank account sub-document (may have been removed since request was made)
    const bankAccount = wallet.bankAccounts.id(request.bankAccountId);
    if (!bankAccount) {
      return res.status(400).json({
        success: false,
        message: 'The bank account for this request has been removed from the wallet.',
      });
    }

    if (!bankAccount.razorpayFundAccountId) {
      return res.status(400).json({
        success: false,
        message: `Bank account XXXX${bankAccount.accountNumber.slice(-4)} is not linked to Razorpay. Please verify it via admin panel first.`,
      });
    }

    // Initiate Razorpay X Payout
    let payoutResult;
    try {
      payoutResult = await initiateRazorpayXPayout({
        razorpayFundAccountId: bankAccount.razorpayFundAccountId,
        amountPaise:           Math.round(request.amount * 100),
        requestId:             request.requestId,
        narration:             `Likeson Wdr ${request.requestId.slice(-6)}`,
      });
    } catch (payoutErr) {
      const errDetail =
        payoutErr?.response?.data?.error?.description || payoutErr.message;

      logAudit('RAZORPAY_PAYOUT_FAILED', {
        adminId:   req.user._id,
        requestId,
        error:     errDetail,
      });

      await persistLog({
        level:    'error',
        category: 'payment',
        message:  `Razorpay X Payout API error: ${errDetail}`,
        actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
        metadata: { requestId, error: errDetail },
        relatedEntity: { model: 'User', entityId: wallet.user },
      });

      return res.status(502).json({
        success: false,
        message: `Razorpay X error: ${errDetail}`,
      });
    }

    // BUG 2 FIX: debit wallet FIRST inside completeWithdrawal, THEN status = Completed
    // If debit throws, the payout ID is not yet stored — admin can retry safely.
    const updatedWallet = await wallet.completeWithdrawal({
      requestId,
      razorpayPayoutId: payoutResult.id,
      reviewedBy:       req.user._id,
    });

    // Sync Razorpay's live payout status (e.g. 'processing', 'processed')
    const finalReq = updatedWallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (finalReq) {
      finalReq.razorpayPayoutStatus = payoutResult.status;
      await updatedWallet.save();
    }

    await invalidateWalletCache(wallet.user);

    logAudit('WITHDRAWAL_COMPLETED', {
      adminId:         req.user._id,
      requestId,
      userId:          wallet.user,
      amount:          request.amount,
      razorpayPayoutId: payoutResult.id,
    });

    await persistLog({
      level:    'success',
      category: 'payment',
      message:  `Payout ${payoutResult.id} initiated for withdrawal ${requestId}`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: {
        requestId,
        amount:           request.amount,
        razorpayPayoutId: payoutResult.id,
        payoutStatus:     payoutResult.status,
      },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    dispatchNotification(wallet.user, {
      title:        'Withdrawal Processed',
      body:         `₹${request.amount.toLocaleString('en-IN')} is being transferred to your bank account. Payout ID: ${payoutResult.id}`,
      type:         'Payment_Success',
      emailSubject: 'Withdrawal Processed — Likeson Wallet',
    });

    res.status(200).json({
      success:    true,
      message:    'Payout initiated successfully',
      payoutId:   payoutResult.id,
      status:     payoutResult.status,
      newBalance: updatedWallet.balance,
    });
  });

// POST '/admin/withdrawals/:requestId/reject'
export const postAdminWithdrawalsByRequestIdReject = asyncHandler(async (req, res) => {
    const { requestId }           = req.params;
    const { walletId, adminNote } = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    // rejectWithdrawal internally calls getDailyWithdrawalTotal() before decrement (BUG 4 fix)
    await wallet.rejectWithdrawal({ requestId, reviewedBy: req.user._id, adminNote });

    await invalidateWalletCache(wallet.user);

    logAudit('WITHDRAWAL_REJECTED', {
      adminId:   req.user._id,
      requestId,
      userId:    wallet.user,
      amount:    request.amount,
      adminNote,
    });

    await persistLog({
      level:    'warning',
      category: 'payment',
      message:  `Withdrawal ${requestId} rejected by admin`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { requestId, amount: request.amount, adminNote },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    dispatchNotification(wallet.user, {
      title:        'Withdrawal Rejected',
      body:         `Your withdrawal of ₹${request.amount.toLocaleString('en-IN')} was rejected. Funds unlocked.${adminNote ? ` Reason: ${adminNote}` : ''}`,
      type:         'Payment_Failed',
      emailSubject: 'Withdrawal Rejected — Likeson Wallet',
    });

    res.status(200).json({ success: true, message: 'Withdrawal rejected and funds unlocked' });
  });

// POST '/admin/withdrawals/:requestId/fail'
export const postAdminWithdrawalsByRequestIdFail = asyncHandler(async (req, res) => {
    const { requestId }               = req.params;
    const { walletId, failureReason } = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const request = wallet.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    // failWithdrawal: releases lock, decrements daily total safely, credits reversal
    const updatedWallet = await wallet.failWithdrawal({
      requestId,
      failureReason,
      reviewedBy: req.user._id,
    });

    await invalidateWalletCache(wallet.user);

    logAudit('WITHDRAWAL_FAILED', {
      adminId:       req.user._id,
      requestId,
      userId:        updatedWallet.user,
      amount:        request.amount,
      failureReason,
    });

    await persistLog({
      level:    'error',
      category: 'payment',
      message:  `Withdrawal ${requestId} failed — amount reversed to wallet`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { requestId, amount: request.amount, failureReason },
      relatedEntity: { model: 'User', entityId: updatedWallet.user },
    });

    dispatchNotification(updatedWallet.user, {
      title:        'Withdrawal Failed — Funds Returned',
      body:         `Your withdrawal of ₹${request.amount.toLocaleString('en-IN')} could not be processed. The amount has been returned to your wallet.${failureReason ? ` Reason: ${failureReason}` : ''}`,
      type:         'Payment_Failed',
      emailSubject: 'Withdrawal Failed — Funds Returned — Likeson Wallet',
    });

    res.status(200).json({
      success:             true,
      message:             'Withdrawal marked failed. Amount reversed to wallet.',
      newBalance:          updatedWallet.balance,
      withdrawableBalance: updatedWallet.withdrawableBalance,
    });
  });

// PATCH '/admin/bank-accounts/:walletId/:bankAccountId/verify'
export const patchAdminBankAccountsByWalletIdByBankAccountIdVerify = asyncHandler(async (req, res) => {
    const { walletId, bankAccountId }   = req.params;
    const { razorpayFundAccountId }     = req.body;

    if (!razorpayFundAccountId) {
      return res.status(400).json({
        success: false,
        message: 'razorpayFundAccountId is required to enable payouts for this account.',
      });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const account = wallet.bankAccounts.id(bankAccountId);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    account.isVerified             = true;
    account.verifiedAt             = new Date();
    account.razorpayFundAccountId  = razorpayFundAccountId;
    account.updatedAt              = new Date();

    await wallet.save();
    await invalidateWalletCache(wallet.user);

    logAudit('BANK_ACCOUNT_VERIFIED_BY_ADMIN', {
      adminId:              req.user._id,
      walletId,
      bankAccountId,
      razorpayFundAccountId,
      maskedAccount:        `XXXX${account.accountNumber.slice(-4)}`,
    });

    await persistLog({
      level:    'success',
      category: 'kyc',
      message:  `Bank account XXXX${account.accountNumber.slice(-4)} verified and Fund Account linked`,
      actor:    { userId: req.user._id, role: req.user.role },
      metadata: { walletId, bankAccountId, razorpayFundAccountId },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    dispatchNotification(wallet.user, {
      title: 'Bank Account Verified',
      body:  `Your bank account ending in ${account.accountNumber.slice(-4)} is verified and ready for withdrawals.`,
      type:  'KYC_Approved',
    });

    res.status(200).json({
      success: true,
      message: 'Bank account verified and Razorpay Fund Account linked.',
      account: maskBankAccount(account),
    });
  });

// GET '/admin/wallets'
export const getAdminWallets = asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query, 100);
    const isActiveFilter  = req.query.isActive !== undefined
      ? { isActive: req.query.isActive === 'true' }
      : {};

    const [results, countResult] = await Promise.all([
      Wallet.aggregate([
        { $match: isActiveFilter },
        { $sort:  { createdAt: -1 } },
        { $skip:  (page - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from:         'users',
            localField:   'user',
            foreignField: '_id',
            as:           '_userArr',
            pipeline:     [{ $project: { name: 1, email: 1, phone: 1, role: 1 } }],
          },
        },
        {
          $project: {
            user:                { $arrayElemAt: ['$_userArr', 0] },
            balance:             1,
            withdrawableBalance: 1,
            lockedBalance:       1,
            totalCredited:       1,
            totalDebited:        1,
            totalWithdrawn:      1,
            isActive:            1,
            lastTransactionAt:   1,
            createdAt:           1,
          },
        },
      ]),
      Wallet.countDocuments(isActiveFilter),
    ]);

    res.status(200).json({ success: true, total: countResult, page, limit, wallets: results });
  });

// PATCH '/admin/wallets/:walletId/toggle-active'
export const patchAdminWalletsByWalletIdToggleActive = asyncHandler(async (req, res) => {
    const { walletId } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
    }

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    wallet.isActive  = isActive;
    wallet.updatedBy = req.user._id;
    await wallet.save();

    await invalidateWalletCache(wallet.user);

    logAudit('WALLET_ACTIVE_TOGGLED', {
      adminId:  req.user._id,
      walletId,
      isActive,
      userId:   wallet.user,
    });

    await persistLog({
      level:    isActive ? 'success' : 'warning',
      category: 'system',
      message:  `Wallet ${walletId} ${isActive ? 'activated' : 'deactivated'} by admin`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'PATCH', path: req.originalUrl, statusCode: 200 },
      metadata: { walletId, isActive },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    res.status(200).json({
      success:  true,
      message:  `Wallet ${isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: wallet.isActive,
    });
  });

// POST '/admin/credit'
export const postAdminCredit = asyncHandler(async (req, res) => {
    const { walletId, amount, description, note } = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }
    const amtErr = validateAmount(amount, { min: 1, label: 'Credit amount' });
    if (amtErr) return res.status(400).json({ success: false, message: amtErr });

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const creditAmount = Number(amount);
    await wallet.credit(creditAmount, 'Admin_Credit', {
      description: description || 'Admin manual credit',
      initiatedBy: req.user._id,
      note,
    });

    await invalidateWalletCache(wallet.user);

    logAudit('ADMIN_WALLET_CREDIT', {
      adminId:  req.user._id,
      walletId,
      userId:   wallet.user,
      amount:   creditAmount,
    });

    await persistLog({
      level:    'success',
      category: 'payment',
      message:  `Admin credited ₹${creditAmount} to wallet ${walletId}`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { walletId, creditAmount, description },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    dispatchNotification(wallet.user, {
      title:        'Wallet Credited',
      body:         `₹${creditAmount.toLocaleString('en-IN')} has been added to your Likeson Wallet by admin.`,
      type:         'Payment_Success',
      emailSubject: 'Wallet Credited — Likeson Healthcare',
    });

    const updatedWallet = await Wallet.findById(walletId);
    res.status(200).json({
      success:    true,
      message:    `₹${creditAmount} credited successfully`,
      newBalance: updatedWallet.balance,
    });
  });

// POST '/admin/debit'
export const postAdminDebit = asyncHandler(async (req, res) => {
    const { walletId, amount, description, note } = req.body;

    if (!walletId) {
      return res.status(400).json({ success: false, message: 'walletId is required' });
    }
    const amtErr = validateAmount(amount, { min: 1, label: 'Debit amount' });
    if (amtErr) return res.status(400).json({ success: false, message: amtErr });

    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const debitAmount = Number(amount);

    if (wallet.availableBalance < debitAmount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${wallet.availableBalance}`,
      });
    }

    await wallet.debit(debitAmount, 'Admin_Debit', {
      description: description || 'Admin manual debit',
      initiatedBy: req.user._id,
      note,
    });

    await invalidateWalletCache(wallet.user);

    logAudit('ADMIN_WALLET_DEBIT', {
      adminId:  req.user._id,
      walletId,
      userId:   wallet.user,
      amount:   debitAmount,
    });

    await persistLog({
      level:    'warning',
      category: 'payment',
      message:  `Admin debited ₹${debitAmount} from wallet ${walletId}`,
      actor:    { userId: req.user._id, role: req.user.role, ip: req.ip },
      request:  { method: 'POST', path: req.originalUrl, statusCode: 200 },
      metadata: { walletId, debitAmount, description },
      relatedEntity: { model: 'User', entityId: wallet.user },
    });

    const updatedWallet = await Wallet.findById(walletId);
    res.status(200).json({
      success:    true,
      message:    `₹${debitAmount} debited successfully`,
      newBalance: updatedWallet.balance,
    });
  });

// GET '/admin/wallets/:walletId'
export const getAdminWalletsByWalletId = asyncHandler(async (req, res) => {
    const { walletId } = req.params;

    const wallet = await Wallet.findById(walletId)
      .populate('user', 'name email phone role')
      .lean();

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Mask all bank account numbers before returning to admin
    wallet.bankAccounts = wallet.bankAccounts.map(maskBankAccount);

    res.status(200).json({ success: true, wallet });
  });

// Centralised error handler (register last on the router)
export const errorHandler = async (err, req, res, _next) => {
  const status  = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logAudit('WALLET_ROUTER_ERROR', {
    message,
    userId: req.user?._id,
    path:   req.originalUrl,
    stack:  NODE_ENV !== 'production' ? err.stack : undefined,
  });

  await persistLog({
    level:    'error',
    category: 'system',
    message:  `Wallet router error: ${message}`,
    actor:    { userId: req.user?._id, ip: req.ip },
    request:  { method: req.method, path: req.originalUrl, statusCode: status },
    metadata: { stack: NODE_ENV !== 'production' ? err.stack : undefined },
  }).catch(() => {});

  res.status(status).json({
    success: false,
    message: status === 500 ? 'A system error occurred. Please try again later.' : message,
  });
};
