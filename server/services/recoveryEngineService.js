/**
 * recoveryEngine.service.js
 *
 * Automatic cash collection liability recovery.
 *
 * Called from settlementEngine on every partner earning.
 * If partner has outstanding liability, deducts from new earning.
 *
 * Logic:
 *   earning = ₹500, liability = ₹1600
 *   → recoveryDeduction = ₹500, walletCredit = ₹0, remaining = ₹1100
 *
 *   earning = ₹1000, liability = ₹400
 *   → recoveryDeduction = ₹400, walletCredit = ₹600, remaining = ₹0
 */

import mongoose from 'mongoose';
import PartnerCollectionLiability from '../models/PartnerCollectionLiability.js';
import PartnerWalletTransaction from '../models/PartnerWalletTransaction.js';
import PartnerWallet from '../models/PartnerWallet.js';

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * applyRecovery
 *
 * Finds oldest OPEN/PARTIALLY_RECOVERED liability for partner.
 * Deducts as much as possible from current booking earning.
 * Writes RECOVERY_DEDUCTION ledger entry.
 * Updates PartnerCollectionLiability.
 *
 * Returns: { recoveryDeduction, updatedLiability }
 */
export async function applyRecovery({ partnerId, wallet, bookingEarning, bookingId, allocationId, session }) {
  if (bookingEarning <= 0) return { recoveryDeduction: 0, updatedLiability: null };

  // Find oldest open liability (FIFO recovery)
  const liability = await PartnerCollectionLiability.findOne({
    partner: partnerId,
    status:  { $in: ['OPEN', 'PARTIALLY_RECOVERED'] },
    outstandingLiability: { $gt: 0 },
  })
    .sort({ createdAt: 1 })
    .session(session);

  if (!liability) return { recoveryDeduction: 0, updatedLiability: null };

  // Deduct min(earning, outstanding)
  const recoveryDeduction = +Math.min(bookingEarning, liability.outstandingLiability).toFixed(2);
  if (recoveryDeduction <= 0) return { recoveryDeduction: 0, updatedLiability: null };

  // Write RECOVERY_DEDUCTION ledger entry
  const beforeBalance = wallet.availableBalance;
  const afterBalance  = beforeBalance; // recovery deduction = earning reduced before wallet credit

  await PartnerWalletTransaction.create(
    [{
      type:         'RECOVERY_DEDUCTION',
      direction:    'debit',
      partnerId,
      walletId:     wallet._id,
      amount:       recoveryDeduction,
      grossAmount:  recoveryDeduction,
      netAmount:    recoveryDeduction,
      beforeBalance,
      afterBalance,
      balanceSnapshot: {
        availableBalance:  wallet.availableBalance,
        pendingBalance:    wallet.pendingBalance,
        withdrawalBalance: wallet.withdrawalBalance,
        recoveryBalance:   Math.max(0, wallet.recoveryBalance - recoveryDeduction),
      },
      bookingId,
      allocationId,
      liabilityId:  liability._id,
      actorRole:    'system',
      idempotencyKey: `RECOVERY_DEDUCTION:${bookingId}:${partnerId}:${liability._id}`,
      remarks:      `Recovery from liability ${liability._id} — ₹${recoveryDeduction} deducted`,
    }],
    { session }
  );

  // Append recovery event to liability
  liability.amountRecovered = +(liability.amountRecovered + recoveryDeduction).toFixed(2);
  liability.recoveryEvents.push({
    amount:      recoveryDeduction,
    bookingId,
    allocationId,
    recoveredAt: new Date(),
    remarks:     `Auto-recovery from booking ${bookingId}`,
  });
  await liability.save({ session }); // pre-save hook auto-updates outstandingLiability + status

// Update wallet recoveryBalance
  const walletAfterRecovery = await PartnerWallet.findByIdAndUpdate(
    wallet._id,
    {
      $inc: {
        recoveryBalance:   -recoveryDeduction,
        lifetimeRecovered: recoveryDeduction,
        __v_balance:       1,
      },
    },
    { session, new: true }
  );

  if (!walletAfterRecovery) {
    throw new Error(`[recoveryEngine] Wallet ${wallet._id} vanished mid-recovery for partner ${partnerId} — aborting`);
  }

  return { recoveryDeduction, updatedLiability: liability };
}

// ── Admin: Manual Waiver ──────────────────────────────────────────────────────

/**
 * waivedLiability
 *
 * Finance admin waives remaining outstanding.
 * Writes ADJUSTMENT ledger entry.
 * Closes liability as WAIVED.
 */
export async function waiveLiability({ liabilityId, adminUserId, reason, session: externalSession }) {
  const session = externalSession ?? await mongoose.startSession();
  const ownSession = !externalSession;

  try {
    if (ownSession) session.startTransaction();

    const liability = await PartnerCollectionLiability.findById(liabilityId).session(session);
    if (!liability) throw new Error(`Liability ${liabilityId} not found`);
    if (liability.status === 'RECOVERED') throw new Error('Liability already fully recovered');
    if (liability.status === 'WAIVED')    throw new Error('Liability already waived');

    const waivedAmount = liability.outstandingLiability;
    const wallet = await PartnerWallet.findById(liability.walletId).session(session);

    // Write ADJUSTMENT ledger (credit partner — waiver = removes liability)
    await PartnerWalletTransaction.create(
      [{
        type:         'ADJUSTMENT',
        direction:    'credit',
        partnerId:    liability.partner,
        walletId:     liability.walletId,
        amount:       waivedAmount,
        grossAmount:  waivedAmount,
        netAmount:    waivedAmount,
        beforeBalance: wallet.availableBalance,
        afterBalance:  wallet.availableBalance, // waiver doesn't add cash; clears liability only
        balanceSnapshot: {
          availableBalance:  wallet.availableBalance,
          pendingBalance:    wallet.pendingBalance,
          withdrawalBalance: wallet.withdrawalBalance,
          recoveryBalance:   Math.max(0, wallet.recoveryBalance - waivedAmount),
        },
        liabilityId:  liability._id,
        actor:        adminUserId,
        actorRole:    'finance',
        idempotencyKey: `WAIVER:${liability._id}:${adminUserId}`,
        remarks:      `Liability waived by admin. Reason: ${reason}`,
      }],
      { session }
    );

    // Update liability
    liability.status       = 'WAIVED';
    liability.waivedAt     = new Date();
    liability.waivedBy     = adminUserId;
    liability.waivedAmount = waivedAmount;
    liability.waiverReason = reason;
    await liability.save({ session });

    // Update wallet
    await PartnerWallet.findByIdAndUpdate(
      liability.walletId,
      {
        $inc: { recoveryBalance: -waivedAmount, __v_balance: 1 },
        $set: { updatedBy: adminUserId },
      },
      { session }
    );

    if (ownSession) await session.commitTransaction();

    return { liabilityId, waivedAmount, status: 'WAIVED' };

  } catch (err) {
    if (ownSession) await session.abortTransaction();
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
}

// ── Query: Partner Outstanding Liability ──────────────────────────────────────

export async function getPartnerOutstandingLiability(partnerId) {
  const result = await PartnerCollectionLiability.aggregate([
    // --- FIXED LINE BELOW (Added 'new') ---
    { $match: { partner: new mongoose.Types.ObjectId(partnerId), status: { $in: ['OPEN', 'PARTIALLY_RECOVERED'] } } },
    { $group: { _id: null, total: { $sum: '$outstandingLiability' } } },
  ]);
  return result[0]?.total ?? 0; 
}