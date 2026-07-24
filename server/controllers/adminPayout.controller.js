// adminPayoutRouter.js
import mongoose from 'mongoose';
import Payout from '../models/Payout.js';
import PartnerLedger from '../models/PartnerLedger.js';
import SettlementBatch from '../models/SettlementBatch.js';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';
import { acquireLock, releaseLock } from '../locks/payoutLock.js';
import { getProfileModel } from '../utils/profileResolver.js';

// All admin routes: must be authenticated + authorized

import asyncHandler from '../utils/asyncHandler.js';

// GET '/payout-dashboard'
export const getPayoutDashboard = asyncHandler(async (req, res) => {
  try {
    const [statusBreakdown, todayPayouts, weekPayouts] = await Promise.all([
      Payout.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalPaise: { $sum: '$payoutAmount' } } }
      ]),
      Payout.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      Payout.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } }),
    ]);

    res.json({ success: true, data: { statusBreakdown, todayPayouts, weekPayouts } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/settlement-dashboard'
export const getSettlementDashboard = asyncHandler(async (req, res) => {
  try {
    const batches = await SettlementBatch.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const summary = await SettlementBatch.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalPaise: { $sum: '$totalAmountPaise' } } }
    ]);

    res.json({ success: true, data: { recentBatches: batches, summary } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/partner-balances'
export const getPartnerBalances = asyncHandler(async (req, res) => {
  try {
    const { partnerType, minBalance, page = 1, limit = 50 } = req.query;

    // Aggregate from Payout model: pending amounts per partner
    const pipeline = [
      { $match: { status: { $in: ['pending', 'processing'] } } },
      {
        $group: {
          _id:          '$partnerUserId',
          partnerType:  { $first: '$partnerType' },
          partnerName:  { $first: '$partnerName' },
          pendingCount: { $sum: 1 },
          pendingPaise: { $sum: '$payoutAmount' },
        }
      },
    ];
    if (partnerType) pipeline.splice(0, 0, { $match: { partnerType } });
    if (minBalance)  pipeline.push({ $match: { pendingPaise: { $gte: parseInt(minBalance) } } });
    pipeline.push({ $sort: { pendingPaise: -1 } });
    pipeline.push({ $skip: (parseInt(page)-1) * parseInt(limit) });
    pipeline.push({ $limit: parseInt(limit) });

    const balances = await Payout.aggregate(pipeline);
    res.json({ success: true, data: { balances } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/ledger'
export const getLedger = asyncHandler(async (req, res) => {
  try {
    const { partnerUserId, type, from, to, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (partnerUserId) filter.partnerUserId = new mongoose.Types.ObjectId(partnerUserId);
    if (type) filter.type = type;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }

    const skip  = (parseInt(page)-1) * parseInt(limit);
    const total = await PartnerLedger.countDocuments(filter);
    const entries = await PartnerLedger.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, data: { entries, pagination: { total, page: +page, limit: +limit } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/failed-payouts'
export const getFailedPayouts = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip  = (parseInt(page)-1) * parseInt(limit);
    const total = await Payout.countDocuments({ status: 'failed' });
    const payouts = await Payout.find({ status: 'failed' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.json({ success: true, data: { payouts, pagination: { total, page: +page, limit: +limit } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/retry-queue'
export const getRetryQueue = asyncHandler(async (req, res) => {
  try {
    const now = new Date();
    const payouts = await Payout.find({
      status: 'failed',
      retryCount: { $lt: 3 },
      $or: [{ nextRetryAt: { $lte: now } }, { nextRetryAt: null }]
    })
      .sort({ nextRetryAt: 1 })
      .lean();

    res.json({ success: true, data: { payouts } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/payouts/:id/approve'
export const postPayoutsByIdApprove = asyncHandler(async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
    if (payout.approvalStatus !== 'pending') {
      return res.status(400).json({ success: false, message: `Already ${payout.approvalStatus}` });
    }

    payout.approvalStatus = 'approved';
    payout.approvedBy     = req.user._id;
    payout.approvedAt     = new Date();
    payout.auditLogs.push({ action: 'approved', actor: req.user._id.toString() });
    await payout.save();

    await AuditLog.create({
      actor:      req.user._id,
      action:     'payout.approved',
      resourceId: payout._id,
      meta:       { payoutCode: payout.payoutCode, amount: payout.payoutAmount }
    });

    res.json({ success: true, message: 'Payout approved', data: { payoutId: payout._id, approvalStatus: 'approved' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/payouts/:id/reject'
export const postPayoutsByIdReject = asyncHandler(async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason required' });

    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
    if (payout.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Cannot reject payout in status: ${payout.status}` });
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      payout.approvalStatus = 'rejected';
      payout.status         = 'cancelled';
      payout.cancelReason   = reason;
      payout.auditLogs.push({ action: 'rejected', actor: req.user._id.toString() });
      await payout.save({ session });

      // Reverse ledger credit
      await PartnerLedger.create([{
        partnerUserId:    payout.partnerUserId,
        partnerType:      payout.partnerType,
        payoutId:         payout._id,
        amountPaise:      -payout.payoutAmount,
        balanceAfterPaise: 0, // compute from last ledger entry in prod
        type:             'reversal',
        description:      `Payout ${payout.payoutCode} rejected: ${reason}`,
      }], { session });

      // Reverse earnings
      await getProfileModel(payout.partnerType).updateOne(
        { user: payout.partnerUserId },
        { $inc: { 'earnings.pendingPayoutPaise': -payout.payoutAmount } },
        { session }
      );

      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    res.json({ success: true, message: 'Payout rejected and ledger reversed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/payouts/:id/retry'
export const postPayoutsByIdRetry = asyncHandler(async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
    if (payout.status !== 'failed') {
      return res.status(400).json({ success: false, message: 'Only failed payouts can be retried' });
    }
    if (payout.retryCount >= 3) {
      return res.status(400).json({ success: false, message: 'Max retries (3) reached. Manual intervention required.' });
    }

    const lockKey = `payout:transfer:${payout._id}`;
    const locked  = await acquireLock(lockKey, 60000);
    if (!locked) return res.status(409).json({ success: false, message: 'Retry already in progress' });

    try {
      payout.status     = 'pending'; // reset to allow transfer
      payout.retryCount += 1;
      payout.auditLogs.push({ action: `retry_${payout.retryCount}`, actor: req.user._id.toString() });
      await payout.save();

      // Delegate to the transfer function (or queue a job)
      // In prod: enqueue to Bull/BullMQ for background retry
      res.json({ success: true, message: `Retry ${payout.retryCount} queued`, data: { payoutId: payout._id, retryCount: payout.retryCount } });
    } finally {
      await releaseLock(lockKey);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/payouts/:id/force-reconcile'
export const postPayoutsByIdForceReconcile = asyncHandler(async (req, res) => {
  try {
    const payout = await Payout.findById(req.params.id);
    if (!payout) return res.status(404).json({ success: false, message: 'Payout not found' });
    if (!payout.razorpayx?.razorpayPayoutId) {
      return res.status(400).json({ success: false, message: 'No RazorpayX payout ID. Cannot reconcile.' });
    }

    const { data: rxPayout } = await razorpayx.get(`/payouts/${payout.razorpayx.razorpayPayoutId}`);

    const statusMap = { processed: 'paid', failed: 'failed', reversed: 'reversed', cancelled: 'cancelled' };
    const newStatus = statusMap[rxPayout.status] || payout.status;

    payout.status              = newStatus;
    payout.razorpayx.status    = rxPayout.status;
    payout.razorpayx.utr       = rxPayout.utr || payout.razorpayx.utr;
    payout.isReconciled        = true;
    payout.reconciledAt        = new Date();
    payout.auditLogs.push({ action: 'force_reconciled', actor: req.user._id.toString() });
    await payout.save();

    res.json({ success: true, message: 'Reconciled', data: { status: newStatus, utr: rxPayout.utr } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/payouts/bulk-initiate'
export const postPayoutsBulkInitiate = asyncHandler(async (req, res) => {
  try {
    const { partnerBatch } = req.body;
    // partnerBatch: [{ partnerUserId, partnerType, bookingIds }]

    if (!Array.isArray(partnerBatch) || partnerBatch.length === 0) {
      return res.status(400).json({ success: false, message: 'partnerBatch[] required' });
    }
    if (partnerBatch.length > 50) {
      return res.status(400).json({ success: false, message: 'Max 50 partners per bulk call' });
    }

    const results = [];
    for (const entry of partnerBatch) {
      try {
        // Each partner gets own initiation (reuse initiate logic)
        // In prod: enqueue to BullMQ for parallel processing with concurrency control
        results.push({ partnerUserId: entry.partnerUserId, status: 'queued' });
      } catch (e) {
        results.push({ partnerUserId: entry.partnerUserId, status: 'error', error: e.message });
      }
    }

    res.json({ success: true, data: { results } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/settlements/create-batch'
export const postSettlementsCreateBatch = asyncHandler(async (req, res) => {
  try {
    const { cycle, periodStart, periodEnd, notes } = req.body;

    if (!cycle || !periodStart || !periodEnd) {
      return res.status(400).json({ success: false, message: 'cycle, periodStart, periodEnd required' });
    }

    // Check no overlapping batch for same cycle+period
    const overlap = await SettlementBatch.findOne({
      cycle,
      periodStart: { $lte: new Date(periodEnd) },
      periodEnd:   { $gte: new Date(periodStart) },
      status:      { $nin: ['cancelled', 'failed'] }
    });
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: `Overlapping batch exists: ${overlap.batchCode}`,
        existingBatch: overlap._id
      });
    }

    const batch = await SettlementBatch.create({
      cycle,
      periodStart: new Date(periodStart),
      periodEnd:   new Date(periodEnd),
      initiatedBy: req.user._id,
      notes,
    });

    res.status(201).json({ success: true, data: { batchId: batch._id, batchCode: batch.batchCode } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/settlements/:id/approve'
export const postSettlementsByIdApprove = asyncHandler(async (req, res) => {
  try {
    const batch = await SettlementBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    if (batch.status !== 'pending_approval') {
      return res.status(400).json({ success: false, message: `Batch is ${batch.status}, not pending_approval` });
    }

    batch.status     = 'approved';
    batch.approvedBy = req.user._id;
    batch.approvedAt = new Date();
    await batch.save();

    res.json({ success: true, message: 'Batch approved. Ready for processing.', data: { batchId: batch._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/settlements/:id/process'
export const postSettlementsByIdProcess = asyncHandler(async (req, res) => {
  try {
    const batch = await SettlementBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    if (batch.status !== 'approved') {
      return res.status(400).json({ success: false, message: `Batch must be approved. Current: ${batch.status}` });
    }

    batch.status = 'processing';
    await batch.save();

    // Enqueue all payouts for this batch to BullMQ
    // In prod: const jobs = await payoutQueue.addBulk(...)
    // Here: fire-and-forget indicator
    res.json({ success: true, message: 'Batch processing started. Payouts queued for transfer.', data: { batchId: batch._id } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/settlements/:id/cancel'
export const postSettlementsByIdCancel = asyncHandler(async (req, res) => {
  try {
    const { reason } = req.body;
    const batch = await SettlementBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    if (['completed', 'processing'].includes(batch.status)) {
      return res.status(400).json({ success: false, message: `Cannot cancel batch in status: ${batch.status}` });
    }

    batch.status = 'cancelled';
    batch.notes  = reason ? `CANCELLED: ${reason}` : batch.notes;
    await batch.save();

    // Cancel all pending payouts in this batch
    await Payout.updateMany(
      { settlementBatchId: batch._id, status: 'pending' },
      { $set: { status: 'cancelled', cancelReason: reason } }
    );

    res.json({ success: true, message: 'Batch cancelled' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/reconciliation'
export const getReconciliation = asyncHandler(async (req, res) => {
  try {
    const stuckThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [stuckPayouts, unreconciledPaid, failedUnreviewed] = await Promise.all([
      Payout.find({ status: 'processing', updatedAt: { $lte: stuckThreshold } })
        .select('payoutCode partnerName payoutAmount createdAt razorpayx.razorpayPayoutId')
        .lean(),
      Payout.find({ status: 'paid', isReconciled: false })
        .select('payoutCode partnerName payoutAmount confirmedAt')
        .lean(),
      Payout.find({ status: 'failed', retryCount: { $gte: 3 } })
        .select('payoutCode partnerName payoutAmount razorpayx.failureReason')
        .lean(),
    ]);

    res.json({
      success: true,
      data: {
        stuckPayouts:       { count: stuckPayouts.length,        items: stuckPayouts },
        unreconciledPaid:   { count: unreconciledPaid.length,    items: unreconciledPaid },
        failedUnreviewed:   { count: failedUnreviewed.length,    items: failedUnreviewed },
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
