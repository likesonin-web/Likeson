/**
 * accountingRouter.js
 *
 * Full accounting, settlement, wallet, payout, withdrawal, recovery,
 * and reconciliation router for Likeson.in healthcare marketplace.
 *
 * All logic inline — no separate controller files.
 *
 * Route groups:
 *   /api/accounting/settlement        → booking settlement trigger
 *   /api/accounting/wallets           → partner wallet read/admin ops
 *   /api/accounting/transactions      → ledger read
 *   /api/accounting/settlements       → settlement records
 *   /api/accounting/allocations       → booking allocations
 *   /api/accounting/withdrawals       → partner withdrawal flow
 *   /api/accounting/liabilities       → cash collection liabilities
 *   /api/accounting/reconciliation    → daily reconciliation
 *   /api/accounting/finance           → admin finance controls
 *   /api/accounting/reports           → dashboard + reporting
 */

import mongoose from 'mongoose';

import { protect, authorize } from '../middleware/authMiddleware.js';

// ── Models ─────────────────────────────────────────────────────────────────
import Booking                  from '../models/Booking.js';
import PartnerWallet            from '../models/PartnerWallet.js';
import PartnerWalletTransaction from '../models/PartnerWalletTransaction.js';
import PartnerSettlement        from '../models/PartnerSettlement.js';
import BookingPartnerAllocation from '../models/BookingPartnerAllocation.js';
import PartnerCollectionLiability from '../models/PartnerCollectionLiability.js';
import PartnerWithdrawal        from '../models/PartnerWithdrawal.js';
import User                     from '../models/User.js';
import DoctorProfile            from '../models/DoctorProfile.js';
import Driver                   from '../models/Driver.js';
import CareAssistantProfile     from '../models/CareAssistantProfile.js';
import TransportPartner         from '../models/TransportPartner.js';
import SoloDriverPartner        from '../models/SoloDriverPartner.js';
import LabPartnerProfile        from '../models/LabPartnerProfile.js';
import Hospital                 from '../models/Hospital.js';

// ── Services ───────────────────────────────────────────────────────────────
import { processBookingSettlement }          from '../services/settlementEngineService.js';
import { waiveLiability, getPartnerOutstandingLiability } from '../services/recoveryEngineService.js';
import {
  requestWithdrawal,
  approveWithdrawal,
  handlePayoutWebhook,
  retryWithdrawal,
} from '../services/withdrawalService.js';
import {
  runDailyReconciliation,
  reconcilePartnerWalletById,
  reconcilePlatformRevenue,
} from '../services/reconciliationService.js';
 


// ── Role groups ────────────────────────────────────────────────────────────
const ADMIN_ROLES   = ['admin', 'superadmin'];
const FINANCE_ROLES = ['admin', 'superadmin', 'finance'];
const PARTNER_ROLES = ['doctor', 'hospital', 'care_assistant', 'driver', 'solodriverpartner', 'transportpartner', 'lab_partner'];
// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * resolvePartnerUserId
 * Given req.user (any partner role), returns the User._id.
 */
function resolvePartnerUserId(user) {
  return user._id;
}

/**
 * resolvePartnerWallet
 * Loads wallet for authenticated partner. Throws 404 if missing.
 */
async function resolvePartnerWallet(userId) {
  const wallet = await PartnerWallet.findOne({ partner: userId });
  if (!wallet) throw Object.assign(new Error('Wallet not found for this partner'), { status: 404 });
  return wallet;
}

/**
 * resolveBookingByIdOrCode
 * Accepts either a Mongo ObjectId (booking._id) or a human bookingCode
 * (e.g. "BK-7F3K9QZP") and returns the matching booking document/query.
 * Throws 404-style error if not found.
 */
function buildBookingLookupFilter(idOrCode) {
  if (mongoose.isValidObjectId(idOrCode)) {
    return { _id: idOrCode };
  }
  // Not a valid ObjectId — treat as bookingCode (case-insensitive, matches schema's uppercase: true)
  return { bookingCode: idOrCode.trim().toUpperCase() };
}

/**
 * getPaginationParams
 */
function getPaginationParams(query) {
  const page  = Math.max(1, parseInt(query.page  ?? '1',  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * asyncRoute — wraps async handler, passes errors to next()
 */
const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/**
 * resolveProfileRef
 * Returns the profile document _id for a partner user.
 */
async function resolveProfileRef(userId, role) {
  switch (role) {
    case 'doctor':           return (await DoctorProfile.findOne({ user: userId }).select('_id').lean())?._id;
    case 'hospital':         return (await Hospital.findOne({ user: userId }).select('_id').lean())?._id; // add if model exists
    case 'care_assistant':   return (await CareAssistantProfile.findOne({ user: userId }).select('_id').lean())?._id;
    case 'driver':           return (await Driver.findOne({ user: userId }).select('_id').lean())?._id;
    case 'solodriverpartner':return (await SoloDriverPartner.findOne({ user: userId }).select('_id').lean())?._id;
    case 'transportpartner': return (await TransportPartner.findOne({ user: userId }).select('_id').lean())?._id;
    case 'lab_partner':      return (await LabPartnerProfile.findOne({ user: userId }).select('_id').lean())?._id;
    default:                 return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// §1  SETTLEMENT — trigger booking settlement
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/accounting/settlement/process/:bookingId
 *
 * Trigger settlement for a completed booking.
 * Idempotent — safe to call multiple times.
 *
 * Access: admin | superadmin | system (called internally on booking completion)
 */

import asyncHandler from '../utils/asyncHandler.js';

// POST '/settlement/process/:bookingId'
export const postSettlementProcessByBookingId = asyncHandler(asyncRoute(async (req, res) => {
    const { bookingId } = req.params;

    const filter = buildBookingLookupFilter(bookingId);

    const booking = await Booking.findOne(filter).select('status settlementProcessed bookingCode');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'completed') {
      return res.status(422).json({
        success: false,
        message: `Booking must be completed. Current status: ${booking.status}`,
      });
    }

    // processBookingSettlement expects the real ObjectId internally —
    // always pass booking._id, never the raw param (which may be a code)
    const result = await processBookingSettlement(booking._id);

    return res.status(200).json({
      success: true,
      message: result.alreadyProcessed
        ? 'Booking already settled — no action taken'
        : 'Settlement processed successfully',
      data: result,
    });
  }));

// GET '/settlement/status/:bookingId'
export const getSettlementStatusByBookingId = asyncHandler(asyncRoute(async (req, res) => {
    const { bookingId } = req.params;

    const filter = buildBookingLookupFilter(bookingId);

    const booking = await Booking.findOne(filter)
      .select('bookingCode status settlementProcessed settlementProcessedAt settlementVersion settlementIdempotencyKey paymentStatus fareBreakdown')
      .lean();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Now that we have the real _id, use it for the downstream lookups
    const [allocations, settlements] = await Promise.all([
      BookingPartnerAllocation.find({ bookingId: booking._id })
        .populate('partnerId', 'name role')
        .lean(),
      PartnerSettlement.find({ bookingId: booking._id })
        .populate('partnerId', 'name role')
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: { booking, allocations, settlements },
    });
  }));

// GET '/wallets/me'
export const getWalletsMe = asyncHandler(asyncRoute(async (req, res) => {
    const userId = resolvePartnerUserId(req.user);

    let wallet = await PartnerWallet.findOne({ partner: userId });

    if (!wallet) {
      // Lazy wallet creation on first access
      const profileRef = await resolveProfileRef(userId, req.user.role);
      wallet = await PartnerWallet.create({
        partner:     userId,
        partnerRole: req.user.role,
        profileRef,
      });
    }

    // Outstanding liability
    const outstandingLiability = await getPartnerOutstandingLiability(userId);

    return res.status(200).json({
      success: true,
      data: {
        wallet: {
          walletId:          wallet._id,
          partnerRole:       wallet.partnerRole,
          currency:          wallet.currency,
          availableBalance:  wallet.availableBalance,
          pendingBalance:    wallet.pendingBalance,
          withdrawalBalance: wallet.withdrawalBalance,
          recoveryBalance:   wallet.recoveryBalance,
          lifetimeEarned:    wallet.lifetimeEarned,
          lifetimeRecovered: wallet.lifetimeRecovered,
          lifetimeWithdrawn: wallet.lifetimeWithdrawn,
          walletStatus:      wallet.walletStatus,
          kycVerified:       wallet.kycVerified,
          bankVerified:      wallet.bankVerified,
          complianceHold:    wallet.complianceHold,
          isWithdrawable:    wallet.isWithdrawable,
          lastSettlementAt:  wallet.lastSettlementAt,
        },
        outstandingLiability,
      },
    });
  }));

// GET '/wallets/:partnerId'
export const getWalletsByPartnerId = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId } = req.params;

    if (!mongoose.isValidObjectId(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partnerId' });
    }

    const [wallet, user, outstandingLiability] = await Promise.all([
      PartnerWallet.findOne({ partner: partnerId }).lean(),
      User.findById(partnerId).select('name email role phone').lean(),
      getPartnerOutstandingLiability(partnerId),
    ]);

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    return res.status(200).json({
      success: true,
      data: { wallet, user, outstandingLiability },
    });
  }));

// GET '/wallets'
export const getWallets = asyncHandler(asyncRoute(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = {};
    if (req.query.role)   filter.partnerRole  = req.query.role;
    if (req.query.status) filter.walletStatus = req.query.status;
    if (req.query.hasLiability === 'true') filter.recoveryBalance = { $gt: 0 };
    if (req.query.minBalance) filter.availableBalance = { $gte: parseFloat(req.query.minBalance) };

    const [wallets, total] = await Promise.all([
      PartnerWallet.find(filter)
        .populate('partner', 'name email role phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerWallet.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    wallets,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// PATCH '/wallets/:partnerId/freeze'
export const patchWalletsByPartnerIdFreeze = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId } = req.params;
    const { reason }    = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    const wallet = await PartnerWallet.findOneAndUpdate(
      { partner: partnerId },
      {
        $set: {
          walletStatus: 'frozen',
          complianceHold: true,
          holdReason:   reason.trim(),
          holdAt:       new Date(),
          updatedBy:    req.user._id,
        },
      },
      { new: true }
    );

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    // Ledger entry for audit trail
    await PartnerWalletTransaction.create({
      type:          'ADJUSTMENT',
      direction:     'neutral',
      partnerId,
      walletId:      wallet._id,
      amount:        0,
      beforeBalance: wallet.availableBalance,
      afterBalance:  wallet.availableBalance,
      actor:         req.user._id,
      actorRole:     req.user.role,
      idempotencyKey: `FREEZE:${wallet._id}:${Date.now()}`,
      remarks:       `Wallet frozen by ${req.user.role}. Reason: ${reason}`,
    });

    return res.status(200).json({
      success: true,
      message: 'Wallet frozen',
      data:    { walletId: wallet._id, walletStatus: wallet.walletStatus },
    });
  }));

// POST '/wallets/me/bank'
export const postWalletsMeBank = asyncHandler(asyncRoute(async (req, res) => {
    const userId = resolvePartnerUserId(req.user);
    const {
      accountHolderName,
      accountNumberLast4,
      ifscCode,
      bankName,
      branchName,
      upiId,
      isPrimary,
    } = req.body;
 
    if (!accountHolderName?.trim()) {
      return res.status(400).json({ success: false, message: 'accountHolderName required' });
    }
    if (!accountNumberLast4 || !/^\d{4}$/.test(accountNumberLast4)) {
      return res.status(400).json({ success: false, message: 'accountNumberLast4 must be exactly 4 digits' });
    }
    if (!ifscCode?.trim()) {
      return res.status(400).json({ success: false, message: 'ifscCode required' });
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifscCode.trim())) {
      return res.status(400).json({ success: false, message: 'Invalid IFSC format' });
    }
 
    let wallet = await PartnerWallet.findOne({ partner: userId });
    if (!wallet) {
      const profileRef = await resolveProfileRef(userId, req.user.role);
      wallet = await PartnerWallet.create({
        partner:     userId,
        partnerRole: req.user.role,
        profileRef,
      });
    }
 
    if (wallet.bankDetails.length >= 3) {
      return res.status(422).json({ success: false, message: 'Maximum 3 bank accounts allowed' });
    }
 
    const hasPrimary = wallet.bankDetails.some(b => b.isPrimary);
 
    wallet.bankDetails.push({
      accountHolderName: accountHolderName.trim(),
      accountNumberLast4,
      ifscCode:          ifscCode.trim().toUpperCase(),
      bankName:          bankName?.trim() ?? null,
      branchName:        branchName?.trim() ?? null,
      upiId:             upiId?.trim() ?? null,
      isPrimary:         isPrimary === true || !hasPrimary, // auto-primary if first
      isVerified:        false,
      source:            'manual',
    });
 
    await wallet.save();
 
    const added = wallet.bankDetails[wallet.bankDetails.length - 1];
 
    return res.status(201).json({
      success: true,
      message: 'Bank account added',
      data: {
        bankId:            added._id,
        accountHolderName: added.accountHolderName,
        accountNumberLast4:added.accountNumberLast4,
        ifscCode:          added.ifscCode,
        bankName:          added.bankName,
        isPrimary:         added.isPrimary,
        isVerified:        added.isVerified,
      },
    });
  }));

// PATCH '/wallets/me/bank/:bankId'
export const patchWalletsMeBankByBankId = asyncHandler(asyncRoute(async (req, res) => {
    const userId = resolvePartnerUserId(req.user);
    const { bankId } = req.params;
    const { bankName, branchName, upiId, accountHolderName } = req.body;
 
    const wallet = await PartnerWallet.findOne({ partner: userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
 
    const bank = wallet.bankDetails.id(bankId);
    if (!bank) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }
 
    // Once verified, only admin can change core fields
    if (bank.isVerified) {
      // Allow only soft fields
      if (bankName)   bank.bankName  = bankName.trim();
      if (branchName) bank.branchName = branchName.trim();
      if (upiId !== undefined) bank.upiId = upiId?.trim() ?? null;
    } else {
      // Unverified: allow all editable fields
      if (accountHolderName) bank.accountHolderName = accountHolderName.trim();
      if (bankName)          bank.bankName          = bankName.trim();
      if (branchName)        bank.branchName        = branchName.trim();
      if (upiId !== undefined) bank.upiId           = upiId?.trim() ?? null;
    }
 
    bank.updatedAt = new Date();
    await wallet.save();
 
    return res.status(200).json({
      success: true,
      message: 'Bank account updated',
      data: {
        bankId:            bank._id,
        accountHolderName: bank.accountHolderName,
        accountNumberLast4:bank.accountNumberLast4,
        bankName:          bank.bankName,
        isPrimary:         bank.isPrimary,
        isVerified:        bank.isVerified,
      },
    });
  }));

// DELETE '/wallets/me/bank/:bankId'
export const deleteWalletsMeBankByBankId = asyncHandler(asyncRoute(async (req, res) => {
    const userId = resolvePartnerUserId(req.user);
    const { bankId } = req.params;
 
    const wallet = await PartnerWallet.findOne({ partner: userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
 
    const bank = wallet.bankDetails.id(bankId);
    if (!bank) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }
 
    // Block delete if pending withdrawal uses this snapshot
    // (Check by accountNumberLast4 + ifscCode match)
    const pendingWithdrawal = await PartnerWithdrawal.findOne({
      partnerId: userId,
      status: { $in: ['REQUESTED', 'APPROVED', 'queued', 'pending', 'processing'] },
      'bankAccountSnapshot.accountNumberLast4': bank.accountNumberLast4,
      'bankAccountSnapshot.ifscCode':           bank.ifscCode,
    });
    if (pendingWithdrawal) {
      return res.status(422).json({
        success: false,
        message: `Cannot delete — pending withdrawal ${pendingWithdrawal.withdrawalId} uses this account`,
      });
    }
 
    // Block delete primary when other accounts exist
    if (bank.isPrimary && wallet.bankDetails.length > 1) {
      return res.status(422).json({
        success: false,
        message: 'Cannot delete primary account. Set another account as primary first.',
      });
    }
 
    wallet.bankDetails.pull({ _id: bankId });
    await wallet.save();
 
    return res.status(200).json({
      success: true,
      message: 'Bank account removed',
    });
  }));

// PATCH '/wallets/me/bank/:bankId/set-primary'
export const patchWalletsMeBankByBankIdSetPrimary = asyncHandler(asyncRoute(async (req, res) => {
    const userId = resolvePartnerUserId(req.user);
    const { bankId } = req.params;
 
    const wallet = await PartnerWallet.findOne({ partner: userId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
 
    const bank = wallet.bankDetails.id(bankId);
    if (!bank) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }
 
    // Clear existing primary, set new one
    wallet.bankDetails.forEach(b => { b.isPrimary = false; });
    bank.isPrimary = true;
 
    await wallet.save(); // pre-save hook syncs bankVerified from new primary
 
    return res.status(200).json({
      success: true,
      message: 'Primary bank account updated',
      data: {
        bankId:     bank._id,
        isPrimary:  true,
        isVerified: bank.isVerified,
        bankVerified: wallet.bankVerified,
      },
    });
  }));

// PATCH '/wallets/:partnerId/bank/:bankId/verify'
export const patchWalletsByPartnerIdBankByBankIdVerify = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId, bankId } = req.params;
 
    if (!mongoose.isValidObjectId(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partnerId' });
    }
 
    const wallet = await PartnerWallet.findOne({ partner: partnerId });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
 
    const bank = wallet.bankDetails.id(bankId);
    if (!bank) {
      return res.status(404).json({ success: false, message: 'Bank account not found' });
    }
 
    bank.isVerified = true;
    bank.verifiedAt = new Date();
    wallet.updatedBy = req.user._id;
 
    await wallet.save(); // pre-save hook auto-sets bankVerified if this is primary
 
    return res.status(200).json({
      success: true,
      message: 'Bank account verified',
      data: {
        bankId:      bank._id,
        isVerified:  bank.isVerified,
        bankVerified: wallet.bankVerified,
      },
    });
  }));

// PATCH '/wallets/:partnerId/release'
export const patchWalletsByPartnerIdRelease = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId } = req.params;
    const { reason }    = req.body;

    const wallet = await PartnerWallet.findOneAndUpdate(
      { partner: partnerId },
      {
        $set: {
          walletStatus:    'active',
          complianceHold:  false,
          holdReason:      null,
          holdReleasedAt:  new Date(),
          updatedBy:       req.user._id,
        },
      },
      { new: true }
    );

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    await PartnerWalletTransaction.create({
      type:          'ADJUSTMENT',
      direction:     'neutral',
      partnerId,
      walletId:      wallet._id,
      amount:        0,
      beforeBalance: wallet.availableBalance,
      afterBalance:  wallet.availableBalance,
      actor:         req.user._id,
      actorRole:     req.user.role,
      idempotencyKey: `RELEASE:${wallet._id}:${Date.now()}`,
      remarks:       `Wallet released by ${req.user.role}. Reason: ${reason ?? 'N/A'}`,
    });

    return res.status(200).json({
      success: true,
      message: 'Wallet released',
      data:    { walletId: wallet._id, walletStatus: wallet.walletStatus },
    });
  }));

// PATCH '/wallets/:partnerId/kyc-status'
export const patchWalletsByPartnerIdKycStatus = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId }  = req.params;
    const { kycVerified, bankVerified } = req.body;

    const updateFields = { updatedBy: req.user._id };
    if (typeof kycVerified  === 'boolean') updateFields.kycVerified  = kycVerified;
    if (typeof bankVerified === 'boolean') updateFields.bankVerified = bankVerified;

    const wallet = await PartnerWallet.findOneAndUpdate(
      { partner: partnerId },
      { $set: updateFields },
      { new: true, upsert: false }
    );

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet KYC status updated',
      data:    { kycVerified: wallet.kycVerified, bankVerified: wallet.bankVerified },
    });
  }));

// GET '/transactions/me'
export const getTransactionsMe = asyncHandler(asyncRoute(async (req, res) => {
    const userId            = resolvePartnerUserId(req.user);
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = { partnerId: userId };
    if (req.query.type)     filter.type = req.query.type;
    if (req.query.fromDate) filter.createdAt = { $gte: new Date(req.query.fromDate) };
    if (req.query.toDate)   filter.createdAt = { ...filter.createdAt, $lte: new Date(req.query.toDate) };
    if (req.query.bookingId && mongoose.isValidObjectId(req.query.bookingId)) {
      filter.bookingId = req.query.bookingId;
    }

    const [transactions, total] = await Promise.all([
      PartnerWalletTransaction.find(filter)
        .select('-balanceSnapshot -idempotencyKey')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerWalletTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// GET '/transactions/:partnerId'
export const getTransactionsByPartnerId = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId }     = req.params;
    const { page, limit, skip } = getPaginationParams(req.query);

    if (!mongoose.isValidObjectId(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partnerId' });
    }

    const filter = { partnerId };
    if (req.query.type)     filter.type = req.query.type;
    if (req.query.fromDate) filter.createdAt = { $gte: new Date(req.query.fromDate) };
    if (req.query.toDate)   filter.createdAt = { ...filter.createdAt, $lte: new Date(req.query.toDate) };

    const [transactions, total] = await Promise.all([
      PartnerWalletTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerWalletTransaction.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// GET '/transactions/txn/:txnId'
export const getTransactionsTxnByTxnId = asyncHandler(asyncRoute(async (req, res) => {
    const txn = await PartnerWalletTransaction.findOne({ txnId: req.params.txnId })
      .populate('partnerId', 'name email role')
      .lean();

    if (!txn) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    return res.status(200).json({ success: true, data: txn });
  }));

// GET '/settlements/me'
export const getSettlementsMe = asyncHandler(asyncRoute(async (req, res) => {
    const userId            = resolvePartnerUserId(req.user);
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = { partnerId: userId };
    if (req.query.status)   filter.settlementStatus = req.query.status;
    if (req.query.fromDate) filter.createdAt = { $gte: new Date(req.query.fromDate) };
    if (req.query.toDate)   filter.createdAt = { ...filter.createdAt, $lte: new Date(req.query.toDate) };

    const [settlements, total] = await Promise.all([
      PartnerSettlement.find(filter)
        .populate('bookingId', 'bookingCode bookingType scheduledAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerSettlement.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    settlements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// GET '/settlements/:settlementId'
export const getSettlementsBySettlementId = asyncHandler(asyncRoute(async (req, res) => {
    const settlement = await PartnerSettlement.findOne({ settlementId: req.params.settlementId })
      .populate('partnerId', 'name email role')
      .populate('bookingId', 'bookingCode bookingType scheduledAt fareBreakdown')
      .lean();

    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }

    // Partner can only view their own
    const isPartner = PARTNER_ROLES.includes(req.user.role);
    if (isPartner && settlement.partnerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({ success: true, data: settlement });
  }));

// GET '/settlements'
export const getSettlements = asyncHandler(asyncRoute(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = {};
    if (req.query.partnerId  && mongoose.isValidObjectId(req.query.partnerId))  filter.partnerId  = req.query.partnerId;
    if (req.query.bookingId  && mongoose.isValidObjectId(req.query.bookingId))  filter.bookingId  = req.query.bookingId;
    if (req.query.partnerRole) filter.partnerRole       = req.query.partnerRole;
    if (req.query.status)      filter.settlementStatus  = req.query.status;
    if (req.query.fromDate)    filter.createdAt          = { $gte: new Date(req.query.fromDate) };
    if (req.query.toDate)      filter.createdAt          = { ...filter.createdAt, $lte: new Date(req.query.toDate) };

    const [settlements, total] = await Promise.all([
      PartnerSettlement.find(filter)
        .populate('partnerId', 'name email role')
        .populate('bookingId', 'bookingCode bookingType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerSettlement.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    settlements,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// POST '/settlements/:settlementId/reverse'
export const postSettlementsBySettlementIdReverse = asyncHandler(asyncRoute(async (req, res) => {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    const settlement = await PartnerSettlement.findOne({ settlementId: req.params.settlementId });
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement not found' });
    }
    if (settlement.settlementStatus !== 'SETTLED') {
      return res.status(422).json({
        success: false,
        message: `Cannot reverse settlement in status: ${settlement.settlementStatus}`,
      });
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const wallet = await PartnerWallet.findById(settlement.walletId).session(session);
      if (!wallet) throw new Error('Partner wallet not found');

      // Clamp reversal to available balance (prevent negative)
      const reversalAmount = Math.min(settlement.netSettlement, wallet.availableBalance);
      const beforeBalance  = wallet.availableBalance;
      const afterBalance   = +(beforeBalance - reversalAmount).toFixed(2);

      // Write BOOKING_REVERSAL ledger entry
      const [txn] = await PartnerWalletTransaction.create(
        [{
          type:          'BOOKING_REVERSAL',
          direction:     'debit',
          partnerId:     settlement.partnerId,
          walletId:      wallet._id,
          amount:        reversalAmount,
          grossAmount:   settlement.grossAmount,
          netAmount:     reversalAmount,
          beforeBalance,
          afterBalance,
          balanceSnapshot: {
            availableBalance:  afterBalance,
            pendingBalance:    wallet.pendingBalance,
            withdrawalBalance: wallet.withdrawalBalance,
            recoveryBalance:   wallet.recoveryBalance,
          },
          bookingId:     settlement.bookingId,
          settlementId:  settlement._id,
          actor:         req.user._id,
          actorRole:     req.user.role,
          idempotencyKey: `BOOKING_REVERSAL:${settlement._id}:${Date.now()}`,
          remarks:       `Settlement reversal. Reason: ${reason}`,
        }],
        { session }
      );

      // Debit wallet
      await PartnerWallet.findOneAndUpdate(
        { _id: wallet._id, __v_balance: wallet.__v_balance },
        {
          $inc: { availableBalance: -reversalAmount, __v_balance: 1 },
          $set: { updatedBy: req.user._id },
        },
        { session }
      );

      // Mark settlement as REVERSED
      await PartnerSettlement.findByIdAndUpdate(
        settlement._id,
        {
          $set: {
            settlementStatus: 'REVERSED',
            reversedAt:       new Date(),
            reversalReason:   reason,
            reversedByTxnId:  txn.txnId,
          },
        },
        { session }
      );

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: 'Settlement reversed',
        data:    { settlementId: settlement.settlementId, reversalAmount, txnId: txn.txnId },
      });

    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }));

// GET '/allocations/booking/:bookingId'
export const getAllocationsBookingByBookingId = asyncHandler(asyncRoute(async (req, res) => {
    const { bookingId } = req.params;

    if (!mongoose.isValidObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid bookingId' });
    }

    const allocations = await BookingPartnerAllocation.find({ bookingId })
      .populate('partnerId', 'name email role')
      .lean();

    return res.status(200).json({ success: true, data: allocations });
  }));

// GET '/allocations/me'
export const getAllocationsMe = asyncHandler(asyncRoute(async (req, res) => {
    const userId            = resolvePartnerUserId(req.user);
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = { partnerId: userId };
    if (req.query.status) filter.status = req.query.status;

    const [allocations, total] = await Promise.all([
      BookingPartnerAllocation.find(filter)
        .populate('bookingId', 'bookingCode bookingType scheduledAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BookingPartnerAllocation.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    allocations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// POST '/withdrawals/request'
export const postWithdrawalsRequest = asyncHandler(asyncRoute(async (req, res) => {
    const { amount, bankId } = req.body; // bankId optional
 
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount required' });
    }
 
    const result = await requestWithdrawal({
      partnerId: req.user._id,
      amount,
      bankId:    bankId ?? null,
      actorId:   req.user._id,
    });
 
    return res.status(201).json({
      success: true,
      message: 'Withdrawal requested',
      data:    result,
    });
  }));

// GET '/wallets/me/bank'
export const getWalletsMeBank = asyncHandler(asyncRoute(async (req, res) => {
    const userId = resolvePartnerUserId(req.user);

    const wallet = await PartnerWallet.findOne({ partner: userId })
      .select('bankDetails bankVerified').lean();

    if (!wallet) {
      return res.status(200).json({ success: true, data: { bankDetails: [], bankVerified: false } });
    }

    // ✅ FIX: Add (wallet.bankDetails || []) to handle old wallets missing the array
    const banks = (wallet.bankDetails || []).map(({ razorpayFundAccountId, ...safe }) => safe);

    return res.status(200).json({
      success: true,
      data: {
        bankDetails:  banks,
        bankVerified: wallet.bankVerified || false, // Also safe-guard this just in case
      },
    });
  }));

// GET '/withdrawals/me'
export const getWithdrawalsMe = asyncHandler(asyncRoute(async (req, res) => {
    const userId            = resolvePartnerUserId(req.user);
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = { partnerId: userId };
    if (req.query.status) filter.status = req.query.status;

    const [withdrawals, total] = await Promise.all([
      PartnerWithdrawal.find(filter)
        .select('-razorpayContactId -razorpayFundAccountId -complianceChecksLog')
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerWithdrawal.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    withdrawals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// GET '/withdrawals'
export const getWithdrawals = asyncHandler(asyncRoute(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = {};
    if (req.query.partnerId && mongoose.isValidObjectId(req.query.partnerId)) filter.partnerId = req.query.partnerId;
    if (req.query.status)    filter.status = req.query.status;
    if (req.query.fromDate)  filter.requestedAt = { $gte: new Date(req.query.fromDate) };
    if (req.query.toDate)    filter.requestedAt = { ...filter.requestedAt, $lte: new Date(req.query.toDate) };

    const [withdrawals, total] = await Promise.all([
      PartnerWithdrawal.find(filter)
        .populate('partnerId', 'name email role phone')
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerWithdrawal.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data:    withdrawals,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// GET '/withdrawals/:withdrawalId'
export const getWithdrawalsByWithdrawalId = asyncHandler(asyncRoute(async (req, res) => {
    const withdrawal = await PartnerWithdrawal.findOne({ withdrawalId: req.params.withdrawalId })
      .populate('partnerId', 'name email role')
      .lean();

    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }

    // Partner can only view own
    const isPartner = PARTNER_ROLES.includes(req.user.role);
    if (isPartner && withdrawal.partnerId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({ success: true, data: withdrawal });
  }));

// POST '/withdrawals/:withdrawalId/approve'
export const postWithdrawalsByWithdrawalIdApprove = asyncHandler(asyncRoute(async (req, res) => {
    const result = await approveWithdrawal({
      withdrawalId: req.params.withdrawalId,
      adminUserId:  req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Withdrawal approved and payout initiated',
      data:    result,
    });
  }));

// POST '/withdrawals/:withdrawalId/reject'
export const postWithdrawalsByWithdrawalIdReject = asyncHandler(asyncRoute(async (req, res) => {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    const withdrawal = await PartnerWithdrawal.findOne({ withdrawalId: req.params.withdrawalId });
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }
    if (withdrawal.status !== 'REQUESTED') {
      return res.status(422).json({
        success: false,
        message: `Can only reject REQUESTED withdrawals. Current: ${withdrawal.status}`,
      });
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const wallet = await PartnerWallet.findById(withdrawal.walletId).session(session);

      // Restore locked amount back to available
      const beforeBalance = wallet.availableBalance;
      const afterBalance  = +(beforeBalance + withdrawal.amount).toFixed(2);

      await PartnerWalletTransaction.create(
        [{
          type:          'WITHDRAWAL_REVERSED',
          direction:     'credit',
          partnerId:     withdrawal.partnerId,
          walletId:      withdrawal.walletId,
          amount:        withdrawal.amount,
          beforeBalance,
          afterBalance,
          balanceSnapshot: {
            availableBalance:  afterBalance,
            pendingBalance:    wallet.pendingBalance,
            withdrawalBalance: Math.max(0, wallet.withdrawalBalance - withdrawal.amount),
            recoveryBalance:   wallet.recoveryBalance,
          },
          withdrawalId:  withdrawal._id,
          actor:         req.user._id,
          actorRole:     req.user.role,
          idempotencyKey: `WD_REJECT:${withdrawal._id}`,
          remarks:       `Withdrawal rejected. Reason: ${reason}`,
        }],
        { session }
      );

      await PartnerWallet.findOneAndUpdate(
        { _id: withdrawal.walletId, __v_balance: wallet.__v_balance },
        {
          $inc: {
            availableBalance:  withdrawal.amount,
            withdrawalBalance: -withdrawal.amount,
            __v_balance:       1,
          },
          $set: { updatedBy: req.user._id },
        },
        { session }
      );

      await PartnerWithdrawal.findByIdAndUpdate(
        withdrawal._id,
        {
          $set: {
            status:      'REJECTED',
            rejectedAt:  new Date(),
            reviewedBy:  req.user._id,
            reviewedAt:  new Date(),
            reviewNote:  reason,
          },
        },
        { session }
      );

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: 'Withdrawal rejected. Balance restored.',
        data:    { withdrawalId: withdrawal.withdrawalId, restoredAmount: withdrawal.amount },
      });

    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }));

// POST '/withdrawals/:withdrawalId/retry'
export const postWithdrawalsByWithdrawalIdRetry = asyncHandler(asyncRoute(async (req, res) => {
    const result = await retryWithdrawal({
      withdrawalId: req.params.withdrawalId,
      adminUserId:  req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Withdrawal retry initiated',
      data:    result,
    });
  }));

// POST '/withdrawals/webhook'
export const postWithdrawalsWebhook = asyncHandler(asyncRoute(async (req, res) => {
    // ── Signature Validation ─────────────────────────────────────────────────
    const razorpaySignature = req.headers['x-razorpay-signature'];
    const webhookSecret     = process.env.RAZORPAYX_WEBHOOK_SECRET;

    if (!razorpaySignature || !webhookSecret) {
      return res.status(400).json({ success: false, message: 'Missing signature' });
    }

    const crypto = await import('crypto');
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (expectedSig !== razorpaySignature) {
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    // ── Process Event ─────────────────────────────────────────────────────────
    const { event, payload } = req.body;

    const HANDLED_EVENTS = ['payout.processed', 'payout.failed', 'payout.reversed', 'payout.updated'];
    if (HANDLED_EVENTS.includes(event)) {
      await handlePayoutWebhook({ event, payload });
    }

    // Always acknowledge — Razorpay retries on non-200
    return res.status(200).json({ success: true });
  }));

// GET '/liabilities/me'
export const getLiabilitiesMe = asyncHandler(asyncRoute(async (req, res) => {
    const userId            = resolvePartnerUserId(req.user);
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = { partner: userId };
    if (req.query.status) filter.status = req.query.status;

    const [liabilities, total] = await Promise.all([
      PartnerCollectionLiability.find(filter)
        .populate('booking', 'bookingCode bookingType scheduledAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerCollectionLiability.countDocuments(filter),
    ]);

    const outstandingTotal = liabilities
      .filter(l => ['OPEN', 'PARTIALLY_RECOVERED'].includes(l.status))
      .reduce((sum, l) => sum + l.outstandingLiability, 0);

    return res.status(200).json({
      success: true,
      data:    liabilities,
      outstandingTotal,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// GET '/liabilities'
export const getLiabilities = asyncHandler(asyncRoute(async (req, res) => {
    const { page, limit, skip } = getPaginationParams(req.query);

    const filter = {};
    if (req.query.partnerId && mongoose.isValidObjectId(req.query.partnerId)) filter.partner = req.query.partnerId;
    if (req.query.status)  filter.status = req.query.status;
    if (req.query.bookingId && mongoose.isValidObjectId(req.query.bookingId)) filter.booking = req.query.bookingId;

    const [liabilities, total] = await Promise.all([
      PartnerCollectionLiability.find(filter)
        .populate('partner', 'name email role phone')
        .populate('booking', 'bookingCode bookingType')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PartnerCollectionLiability.countDocuments(filter),
    ]);

    // Summary
    const summary = await PartnerCollectionLiability.aggregate([
      { $match: filter },
      {
        $group: {
          _id:              null,
          totalLiability:   { $sum: '$totalLiability' },
          totalRecovered:   { $sum: '$amountRecovered' },
          totalOutstanding: { $sum: '$outstandingLiability' },
          openCount:        { $sum: { $cond: [{ $eq: ['$status', 'OPEN'] }, 1, 0] } },
          partialCount:     { $sum: { $cond: [{ $eq: ['$status', 'PARTIALLY_RECOVERED'] }, 1, 0] } },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data:    liabilities,
      summary: summary[0] ?? {},
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }));

// POST '/liabilities/:liabilityId/waive'
export const postLiabilitiesByLiabilityIdWaive = asyncHandler(asyncRoute(async (req, res) => {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    const result = await waiveLiability({
      liabilityId: req.params.liabilityId,
      adminUserId: req.user._id,
      reason:      reason.trim(),
    });

    return res.status(200).json({
      success: true,
      message: 'Liability waived',
      data:    result,
    });
  }));

// GET '/liabilities/:liabilityId'
export const getLiabilitiesByLiabilityId = asyncHandler(asyncRoute(async (req, res) => {
    const liability = await PartnerCollectionLiability.findById(req.params.liabilityId)
      .populate('partner', 'name email role phone')
      .populate('booking', 'bookingCode bookingType fareBreakdown')
      .lean();

    if (!liability) {
      return res.status(404).json({ success: false, message: 'Liability not found' });
    }

    return res.status(200).json({ success: true, data: liability });
  }));

// POST '/reconciliation/run'
export const postReconciliationRun = asyncHandler(asyncRoute(async (req, res) => {
    const results = await runDailyReconciliation({ adminUserId: req.user._id });

    return res.status(200).json({
      success: true,
      message: `Reconciliation complete. ${results.mismatches} mismatch(es) found.`,
      data:    {
        checkedAt:  results.checkedAt,
        checked:    results.checked,
        matched:    results.matched,
        mismatches: results.mismatches,
        alerts:     results.alerts,
      },
    });
  }));

// POST '/reconciliation/wallet/:walletId'
export const postReconciliationWalletByWalletId = asyncHandler(asyncRoute(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.walletId)) {
      return res.status(400).json({ success: false, message: 'Invalid walletId' });
    }

    const result = await reconcilePartnerWalletById(req.params.walletId);

    return res.status(200).json({
      success: true,
      data:    result,
      mismatch: result.mismatch,
    });
  }));

// GET '/reconciliation/platform-revenue'
export const getReconciliationPlatformRevenue = asyncHandler(asyncRoute(async (req, res) => {
    const result = await reconcilePlatformRevenue({
      fromDate: req.query.fromDate,
      toDate:   req.query.toDate,
    });

    return res.status(200).json({ success: true, data: result });
  }));

// POST '/finance/manual-credit'
export const postFinanceManualCredit = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId, amount, reason, referenceId } = req.body;

    if (!mongoose.isValidObjectId(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partnerId' });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount required' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const wallet = await PartnerWallet.findOne({ partner: partnerId }).session(session);
      if (!wallet) {
        return res.status(404).json({ success: false, message: 'Partner wallet not found' });
      }
      if (wallet.walletStatus === 'closed') {
        return res.status(422).json({ success: false, message: 'Cannot credit a closed wallet' });
      }

      const beforeBalance = wallet.availableBalance;
      const afterBalance  = +(beforeBalance + amount).toFixed(2);

      const [txn] = await PartnerWalletTransaction.create(
        [{
          type:          'MANUAL_CREDIT',
          direction:     'credit',
          partnerId,
          walletId:      wallet._id,
          amount,
          grossAmount:   amount,
          netAmount:     amount,
          beforeBalance,
          afterBalance,
          balanceSnapshot: {
            availableBalance:  afterBalance,
            pendingBalance:    wallet.pendingBalance,
            withdrawalBalance: wallet.withdrawalBalance,
            recoveryBalance:   wallet.recoveryBalance,
          },
          referenceId:   referenceId ?? null,
          actor:         req.user._id,
          actorRole:     req.user.role,
          idempotencyKey: `MANUAL_CREDIT:${partnerId}:${Date.now()}:${req.user._id}`,
          remarks:       `Manual credit by ${req.user.role}. Reason: ${reason}`,
        }],
        { session }
      );

      await PartnerWallet.findOneAndUpdate(
        { _id: wallet._id, __v_balance: wallet.__v_balance },
        {
          $inc: {
            availableBalance:    amount,
            lifetimeAdjustments: amount,
            __v_balance:         1,
          },
          $set: { updatedBy: req.user._id },
        },
        { session }
      );

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: `₹${amount} manually credited`,
        data:    { txnId: txn.txnId, afterBalance },
      });

    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }));

// POST '/finance/manual-debit'
export const postFinanceManualDebit = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId, amount, reason, referenceId } = req.body;

    if (!mongoose.isValidObjectId(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partnerId' });
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount required' });
    }
    if (!reason?.trim()) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const wallet = await PartnerWallet.findOne({ partner: partnerId }).session(session);
      if (!wallet) {
        return res.status(404).json({ success: false, message: 'Partner wallet not found' });
      }
      if (wallet.availableBalance < amount) {
        return res.status(422).json({
          success: false,
          message: `Insufficient balance. Available: ₹${wallet.availableBalance}`,
        });
      }

      const beforeBalance = wallet.availableBalance;
      const afterBalance  = +(beforeBalance - amount).toFixed(2);

      const [txn] = await PartnerWalletTransaction.create(
        [{
          type:          'MANUAL_DEBIT',
          direction:     'debit',
          partnerId,
          walletId:      wallet._id,
          amount,
          grossAmount:   amount,
          netAmount:     amount,
          beforeBalance,
          afterBalance,
          balanceSnapshot: {
            availableBalance:  afterBalance,
            pendingBalance:    wallet.pendingBalance,
            withdrawalBalance: wallet.withdrawalBalance,
            recoveryBalance:   wallet.recoveryBalance,
          },
          referenceId:   referenceId ?? null,
          actor:         req.user._id,
          actorRole:     req.user.role,
          idempotencyKey: `MANUAL_DEBIT:${partnerId}:${Date.now()}:${req.user._id}`,
          remarks:       `Manual debit by ${req.user.role}. Reason: ${reason}`,
        }],
        { session }
      );

      await PartnerWallet.findOneAndUpdate(
        { _id: wallet._id, __v_balance: wallet.__v_balance },
        {
          $inc: {
            availableBalance:    -amount,
            lifetimeAdjustments: -amount,
            __v_balance:         1,
          },
          $set: { updatedBy: req.user._id },
        },
        { session }
      );

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: `₹${amount} manually debited`,
        data:    { txnId: txn.txnId, afterBalance },
      });

    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }));

// POST '/finance/force-settle/:bookingId'
export const postFinanceForceSettleByBookingId = asyncHandler(asyncRoute(async (req, res) => {
    const { bookingId } = req.params;

    const filter = buildBookingLookupFilter(bookingId);
    const booking = await Booking.findOne(filter);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status !== 'completed') {
      return res.status(422).json({
        success: false,
        message: `Booking must be completed. Status: ${booking.status}`,
      });
    }

    if (booking.settlementProcessed) {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: {
          settlementProcessed:      false,
          settlementProcessedAt:    null,
          settlementIdempotencyKey: null,
        },
      });
    }

    const result = await processBookingSettlement(booking._id);

    return res.status(200).json({
      success: true,
      message: 'Force settlement completed',
      data:    result,
    });
  }));

// GET '/reports/partner-dashboard'
export const getReportsPartnerDashboard = asyncHandler(asyncRoute(async (req, res) => {
    const userId = resolvePartnerUserId(req.user);

    const [
      wallet,
      recentTxns,
      pendingSettlements,
      liabilities,
      recentWithdrawals,
    ] = await Promise.all([
      PartnerWallet.findOne({ partner: userId }).lean(),

      PartnerWalletTransaction.find({ partnerId: userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('txnId type direction amount beforeBalance afterBalance createdAt remarks bookingId')
        .lean(),

      PartnerSettlement.find({ partnerId: userId, settlementStatus: 'PENDING' })
        .populate('bookingId', 'bookingCode bookingType scheduledAt')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      PartnerCollectionLiability.find({
        partner: userId,
        status:  { $in: ['OPEN', 'PARTIALLY_RECOVERED'] },
      })
        .populate('booking', 'bookingCode')
        .lean(),

      PartnerWithdrawal.find({ partnerId: userId })
        .sort({ requestedAt: -1 })
        .limit(5)
        .select('withdrawalId amount status requestedAt completedAt utr bankAccountSnapshot')
        .lean(),
    ]);

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const outstandingLiability = liabilities.reduce(
      (sum, l) => sum + l.outstandingLiability, 0
    );

    // Lifetime earning summary from ledger
    const earningSummary = await PartnerWalletTransaction.aggregate([
      { $match: { partnerId: userId } },
      {
        $group: {
          _id:               null,
          totalEarned:       { $sum: { $cond: [{ $eq: ['$type', 'BOOKING_EARNING'] }, '$grossAmount', 0] } },
          totalRecovered:    { $sum: { $cond: [{ $eq: ['$type', 'RECOVERY_DEDUCTION'] }, '$amount', 0] } },
          totalWithdrawn:    { $sum: { $cond: [{ $eq: ['$type', 'WITHDRAWAL_SUCCESS'] }, '$amount', 0] } },
          totalManualCredit: { $sum: { $cond: [{ $eq: ['$type', 'MANUAL_CREDIT'] }, '$amount', 0] } },
          totalManualDebit:  { $sum: { $cond: [{ $eq: ['$type', 'MANUAL_DEBIT'] }, '$amount', 0] } },
          bookingCount:      { $sum: { $cond: [{ $eq: ['$type', 'BOOKING_EARNING'] }, 1, 0] } },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        wallet: {
          availableBalance:  wallet.availableBalance,
          pendingBalance:    wallet.pendingBalance,
          withdrawalBalance: wallet.withdrawalBalance,
          recoveryBalance:   wallet.recoveryBalance,
          walletStatus:      wallet.walletStatus,
          isWithdrawable:    wallet.isWithdrawable,
          lastSettlementAt:  wallet.lastSettlementAt,
        },
        outstandingLiability,
        liabilities,
        earningSummary:     earningSummary[0] ?? {},
        recentTransactions: recentTxns,
        pendingSettlements,
        recentWithdrawals,
      },
    });
  }));

// GET '/reports/partner-earnings/:partnerId'
export const getReportsPartnerEarningsByPartnerId = asyncHandler(asyncRoute(async (req, res) => {
    const { partnerId } = req.params;

    if (!mongoose.isValidObjectId(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partnerId' });
    }

    const matchStage = {
      // --- FIXED LINE BELOW (Added 'new') ---
      partnerId: new mongoose.Types.ObjectId(partnerId),
      type:      { $in: ['BOOKING_EARNING', 'RECOVERY_DEDUCTION', 'MANUAL_CREDIT', 'MANUAL_DEBIT', 'WITHDRAWAL_SUCCESS'] },
    };
    if (req.query.fromDate) matchStage.createdAt = { $gte: new Date(req.query.fromDate) };
    if (req.query.toDate)   matchStage.createdAt = { ...matchStage.createdAt, $lte: new Date(req.query.toDate) };

    const groupByFormat = {
      day:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      week:  { $week: '$createdAt' },
      month: { $dateToString: { format: '%Y-%m',    date: '$createdAt' } },
    };
    const groupKey = groupByFormat[req.query.groupBy] ?? groupByFormat.month;

    const [summary, timeSeries, roleBreakdown] = await Promise.all([
      PartnerWalletTransaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id:             null,
            totalEarned:     { $sum: { $cond: [{ $eq: ['$type', 'BOOKING_EARNING']    }, '$grossAmount', 0] } },
            totalNet:        { $sum: { $cond: [{ $eq: ['$type', 'BOOKING_EARNING']    }, '$netAmount',   0] } },
            totalRecovered:  { $sum: { $cond: [{ $eq: ['$type', 'RECOVERY_DEDUCTION'] }, '$amount',      0] } },
            totalWithdrawn:  { $sum: { $cond: [{ $eq: ['$type', 'WITHDRAWAL_SUCCESS'] }, '$amount',      0] } },
            bookingCount:    { $sum: { $cond: [{ $eq: ['$type', 'BOOKING_EARNING']    }, 1,              0] } },
          },
        },
      ]),

      PartnerWalletTransaction.aggregate([
        { $match: { ...matchStage, type: 'BOOKING_EARNING' } },
        {
          $group: {
            _id:         groupKey,
            earned:      { $sum: '$grossAmount' },
            net:         { $sum: '$netAmount' },
            bookings:    { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      PartnerSettlement.aggregate([
        // --- FIXED LINE BELOW (Added 'new') ---
        { $match: { partnerId: new mongoose.Types.ObjectId(partnerId), settlementStatus: 'SETTLED' } },
        {
          $group: {
            _id:          '$partnerRole',
            totalGross:   { $sum: '$grossAmount' },
            totalNet:     { $sum: '$netSettlement' },
            totalPlatFee: { $sum: '$platformFee' },
            count:        { $sum: 1 },
          },
        },
      ]),
    ]);

    const partner = await User.findById(partnerId).select('name email role').lean();
    const wallet  = await PartnerWallet.findOne({ partner: partnerId }).lean();

    return res.status(200).json({
      success: true,
      data: {
        partner,
        wallet:       wallet ? {
          availableBalance:  wallet.availableBalance,
          lifetimeEarned:    wallet.lifetimeEarned,
          lifetimeWithdrawn: wallet.lifetimeWithdrawn,
          lifetimeRecovered: wallet.lifetimeRecovered,
        } : null,
        summary:      summary[0] ?? {},
        timeSeries,
        roleBreakdown,
      },
    });
  }));

// GET '/reports/platform-revenue-summary'
export const getReportsPlatformRevenueSummary = asyncHandler(asyncRoute(async (req, res) => {
    const data = await reconcilePlatformRevenue({
      fromDate: req.query.fromDate,
      toDate:   req.query.toDate,
    });

    return res.status(200).json({ success: true, data });
  }));

// GET '/reports/settlement-summary'
export const getReportsSettlementSummary = asyncHandler(asyncRoute(async (req, res) => {
    const matchStage = {};
    if (req.query.fromDate) matchStage.createdAt = { $gte: new Date(req.query.fromDate) };
    if (req.query.toDate)   matchStage.createdAt = { ...matchStage.createdAt, $lte: new Date(req.query.toDate) };

    const [byStatus, byRole, pendingTotal] = await Promise.all([
      PartnerSettlement.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id:       '$settlementStatus',
            count:     { $sum: 1 },
            totalNet:  { $sum: '$netSettlement' },
            totalGross:{ $sum: '$grossAmount' },
          },
        },
      ]),

      PartnerSettlement.aggregate([
        { $match: { ...matchStage, settlementStatus: 'SETTLED' } },
        {
          $group: {
            _id:          '$partnerRole',
            totalSettled: { $sum: '$netSettlement' },
            count:        { $sum: 1 },
          },
        },
      ]),

      PartnerSettlement.aggregate([
        { $match: { settlementStatus: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$grossAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        byStatus,
        byRole,
        pendingTotal: pendingTotal[0] ?? { total: 0, count: 0 },
      },
    });
  }));

// GET '/reports/liability-summary'
export const getReportsLiabilitySummary = asyncHandler(asyncRoute(async (req, res) => {
    const [summary, byRole, topOffenders] = await Promise.all([
      PartnerCollectionLiability.aggregate([
        {
          $group: {
            _id:              '$status',
            count:            { $sum: 1 },
            totalLiability:   { $sum: '$totalLiability' },
            totalRecovered:   { $sum: '$amountRecovered' },
            totalOutstanding: { $sum: '$outstandingLiability' },
          },
        },
      ]),

      PartnerCollectionLiability.aggregate([
        { $match: { status: { $in: ['OPEN', 'PARTIALLY_RECOVERED'] } } },
        {
          $group: {
            _id:         '$partnerRole',
            outstanding: { $sum: '$outstandingLiability' },
            count:       { $sum: 1 },
          },
        },
        { $sort: { outstanding: -1 } },
      ]),

     PartnerCollectionLiability.aggregate([
        { $match: { status: { $in: ['OPEN', 'PARTIALLY_RECOVERED'] } } },
        { $sort: { outstandingLiability: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from:         'users',
            localField:   'partner',
            foreignField: '_id',
            as:           'partnerUser',
            pipeline:     [{ $project: { name: 1, email: 1, role: 1 } }],
          },
        },
        // --- FIXED LINE BELOW ---
        { $unwind: { path: '$partnerUser', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            partner:             '$partnerUser',
            partnerRole:         1,
            outstandingLiability:1,
            totalLiability:      1,
            amountRecovered:     1,
            createdAt:           1,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data:    { summary, byRole, topOffenders },
    });
  }));

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, _next) => {
  console.error('[accounting.router] Error:', err);

  const status  = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? 'Internal accounting error';

  // Mongoose duplicate key — idempotency collision
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate transaction detected — this operation was already processed',
      code:    'DUPLICATE_TRANSACTION',
    });
  }

  // Mongoose validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors:  Object.values(err.errors).map(e => e.message),
    });
  }

  return res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
};
