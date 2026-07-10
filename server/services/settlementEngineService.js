/**
 * settlementEngine.service.js
 *
 * CORE ACCOUNTING ENGINE
 *
 * Entry point: processBookingSettlement(bookingId, session?)
 *
 * Flow:
 *   1. Load booking + validate completion
 *   2. Idempotency check (settlementProcessed flag)
 *   3. Generate partner allocations (BookingPartnerAllocation) — profile-id based
 *   4. Resolve cash-collector entity ONCE (handles agency driver -> TP mapping)
 *   5. Per allocation:
 *      a. Resolve profile id -> User id (canonical id for Wallet/Settlement/Ledger)
 *      b. Load/create PartnerWallet (keyed by User id)
 *      c. Check outstanding liability (PartnerCollectionLiability, keyed by User id)
 *      d. Compute recoveryDeduction
 *      e. Compute netPayable
 *      f. Create PartnerSettlement record
 *      g. Write PartnerWalletTransaction (ledger entry)
 *      h. Update PartnerWallet balance projection
 *      i. If transportpartner allocation: sync display-only earnings onto the
 *         Driver doc(s) that actually drove the leg (Driver has NO wallet)
 *   6. Mark booking settlementProcessed
 *   7. Handle PAY_AT_SERVICE cash collector liability (correct entity, not raw role match)
 *
 * NON-NEGOTIABLE RULES:
 *   - All writes inside MongoDB transaction
 *   - Idempotency key prevents duplicate processing
 *   - Wallet balances NEVER modified directly; always via ledger
 *   - Subscription discounts absorbed by platform; partner payout unchanged
 *   - partnerId is ALWAYS a User._id once it reaches Wallet/Settlement/Ledger/
 *     Liability. Allocation additionally stores partnerProfileId for traceability.
 */

import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import PartnerWallet from '../models/PartnerWallet.js';
import PartnerWalletTransaction from '../models/PartnerWalletTransaction.js';
import PartnerSettlement from '../models/PartnerSettlement.js';
import BookingPartnerAllocation from '../models/BookingPartnerAllocation.js';
import PartnerCollectionLiability from '../models/PartnerCollectionLiability.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';
import { computePartnerAllocations } from './allocationEngineService.js';
import { applyRecovery } from './recoveryEngineService.js';
import User from '../models/User.js';

import DoctorProfile         from '../models/DoctorProfile.js';
import CareAssistantProfile  from '../models/CareAssistantProfile.js';
import Driver                from '../models/Driver.js';
import SoloDriverPartner     from '../models/SoloDriverPartner.js';
import TransportPartner      from '../models/TransportPartner.js';
import LabPartnerProfile     from '../models/LabPartnerProfile.js';

/**
 * resolveUserIdFromProfile — single source of truth for profile id -> User id.
 * Every collection downstream of this (Wallet/Settlement/Ledger/Liability)
 * is keyed by the User id this returns. Never the profile id directly.
 *
 * 'hospital' uses Hospital.managedBy (ObjectId ref 'User') — Hospital has
 * NO `user` field, unlike every other partner profile. Confirmed against
 * Hospital.js schema.
 */
async function resolveUserIdFromProfile(profileId, partnerRole) {
  switch (partnerRole) {
    case 'doctor':            return (await DoctorProfile.findById(profileId).select('user').lean())?.user;
    case 'care_assistant':    return (await CareAssistantProfile.findById(profileId).select('user').lean())?.user;
    case 'driver':            return (await Driver.findById(profileId).select('user').lean())?.user;
    case 'solodriverpartner': return (await SoloDriverPartner.findById(profileId).select('user').lean())?.user;
    case 'transportpartner':  return (await TransportPartner.findById(profileId).select('user').lean())?.user;
    case 'lab_partner':       return (await LabPartnerProfile.findById(profileId).select('user').lean())?.user;
 case 'hospital': {
      const Hospital = mongoose.model('Hospital');
      return (await Hospital.findById(profileId).select('managedBy').lean())?.managedBy;
    }
    default: return null;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SETTLEMENT_VERSION = 1;

// ── Main Entry Point ──────────────────────────────────────────────────────────

/**
 * processBookingSettlement
 *
 * Idempotent. Safe to call multiple times for same booking.
 * Returns existing settlement if already processed.
 *
 * @param {string|ObjectId} bookingId
 * @param {ClientSession}   [externalSession] - pass existing session or we create one
 */
export async function processBookingSettlement(bookingId, externalSession = null) {
  const session = externalSession ?? await mongoose.startSession();
  const ownSession = !externalSession;

  try {
    if (ownSession) session.startTransaction();

    // ── 1. Load Booking ──────────────────────────────────────────────────────
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new Error(`Booking ${bookingId} not found`);
    if (booking.status !== 'completed') {
      throw new Error(`Booking ${bookingId} is not completed (status: ${booking.status})`);
    }

    // ── 2. Idempotency Check ─────────────────────────────────────────────────
    if (booking.settlementProcessed) {
      console.log(`[settlementEngine] Booking ${bookingId} already settled — skipping`);
      if (ownSession) await session.commitTransaction();
      return { alreadyProcessed: true, bookingId };
    }

    const idempotencyKey = `settlement:${bookingId}:v${SETTLEMENT_VERSION}`;

    // ── 3. Load Pricing Config ────────────────────────────────────────────────
    const pricingConfig = await PlatformPricingConfig.getGlobal();

    // ── 4. Compute Allocations (profile-id based) ─────────────────────────────
    const allocations = await computePartnerAllocations(booking, pricingConfig, session);
    // allocations = [{ partnerId(profileId), partnerRole, grossAmount, platformFee, taxAmount, tdsAmount, rideLegs? }]

    const paymentSource = resolvePaymentSource(booking);

    // ── 5. Resolve Cash Collector Entity ONCE (handles agency driver -> TP) ──
    const cashCollectorUserId = booking.collectedByPartner?.collectedBy?.toString() ?? null;
    const collectorEntity = (paymentSource === 'PAY_AT_SERVICE' && cashCollectorUserId)
      ? await resolveCashCollectorEntity(cashCollectorUserId, session)
      : null;

    // ── 6. Process Each Partner Allocation ─────────────────────────────────────
    const settlementResults = [];

    for (const alloc of allocations) {
      const result = await processPartnerAllocation({
        alloc,
        booking,
        paymentSource,
        collectorUserId: collectorEntity?.userId ?? null,
        pricingConfig,
        session,
      });
      settlementResults.push(result);
    }

    // ── 7. Handle Cash Collector Liability ─────────────────────────────────────
    if (paymentSource === 'PAY_AT_SERVICE' && collectorEntity) {
      await createCashCollectorLiability({
        booking,
        settlementResults,
        collectorEntity,
        session,
      });
    }

    // ── 8. Mark Booking as Settled ───────────────────────────────────────────
    await Booking.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          settlementProcessed:        true,
          settlementProcessedAt:      new Date(),
          settlementVersion:          SETTLEMENT_VERSION,
          settlementIdempotencyKey:   idempotencyKey,
          updatedBy:                  null, // system action
        },
      },
      { session, new: true }
    );

    if (ownSession) await session.commitTransaction();

    return {
      alreadyProcessed: false,
      bookingId,
      settlements: settlementResults,
      paymentSource,
      cashCollectorUserId: collectorEntity?.userId ?? null,
    };

  } catch (err) {
    if (ownSession) await session.abortTransaction();
    throw err;
  } finally {
    if (ownSession) session.endSession();
  }
}

// ── Process Single Partner Allocation ─────────────────────────────────────────

async function processPartnerAllocation({
  alloc,
  booking,
  paymentSource,
  collectorUserId,
  pricingConfig,
  session,
}) {
  const { partnerId: profileId, partnerRole, grossAmount, platformFee, taxAmount, tdsAmount } = alloc;

  // ── A. Resolve canonical User id ─────────────────────────────────────────
  const userId = await resolveUserIdFromProfile(profileId, partnerRole);
  if (!userId) {
    console.error(`[settlementEngine] Could not resolve User for ${partnerRole} profile ${profileId} — skipping allocation`);
    return { partnerId: profileId, partnerRole, skipped: true, reason: 'user_not_resolved' };
  }

  // ── B. Get/Create Wallet (keyed by User id) ──────────────────────────────
  let wallet = await PartnerWallet.findOne({ partner: userId }).session(session);
  if (!wallet) {
    const created = await PartnerWallet.create(
      [{ partner: userId, partnerRole, profileRef: profileId }],
      { session }
    );
    wallet = created[0];
  }

  // ── C. Skip if wallet is frozen/suspended ────────────────────────────────
  if (['frozen', 'suspended', 'closed'].includes(wallet.walletStatus)) {
    console.warn(`[settlementEngine] Wallet ${wallet._id} is ${wallet.walletStatus} — skipping partner ${userId}`);
    return { partnerId: userId, partnerRole, skipped: true, reason: `wallet_${wallet.walletStatus}` };
  }

  // ── D. Subscription Absorption ──────────────────────────────────────────
  const subscriptionAbsorbed = alloc.subscriptionAbsorbed ?? 0;

  // ── E. Recovery Check (keyed by User id) ─────────────────────────────────
  const { recoveryDeduction, updatedLiability } = await applyRecovery({
    partnerId: userId,
    wallet,
    bookingEarning: grossAmount,
    bookingId:      booking._id,
    allocationId:   null,
    session,
  });

  const netPayable = Math.max(
    0,
    +(grossAmount - platformFee - taxAmount - (tdsAmount ?? 0) - recoveryDeduction).toFixed(2)
  );

  // ── F. Create Allocation Record ──────────────────────────────────────────
  const isCashCollector = paymentSource === 'PAY_AT_SERVICE'
    && collectorUserId
    && collectorUserId.toString() === userId.toString();
  const cashCollected = isCashCollector ? (booking.collectedByPartner?.amount ?? 0) : 0;

  const rideLegIds = Array.isArray(alloc.rideLegs) ? alloc.rideLegs.map((l) => l.rideId) : undefined;

  const [allocation] = await BookingPartnerAllocation.create(
    [{
      bookingId:            booking._id,
      partnerId:            userId,
      partnerProfileId:     profileId,
      partnerRole,
      bookingType:          booking.bookingType,
      walletId:             wallet._id,
      grossAmount,
      platformFee,
      taxAmount,
      tdsAmount:            tdsAmount ?? 0,
      recoveryDeduction,
      netPayable,
      subscriptionAbsorbed,
      paymentSource,
      isCashCollector,
      cashCollected,
      status:               'pending',
      idempotencyKey:       `alloc:${booking._id}:${userId}:${partnerRole}`,
      remarks:              rideLegIds ? `rides: ${rideLegIds.join(',')}` : undefined,
    }],
    { session }
  );

  // ── G. Create Settlement Record ──────────────────────────────────────────
  const [settlement] = await PartnerSettlement.create(
    [{
      bookingId:            booking._id,
      partnerId:            userId,
      partnerRole,
      allocationId:         allocation._id,
      walletId:             wallet._id,
      grossAmount,
      platformFee,
      taxAmount,
      tdsAmount:            tdsAmount ?? 0,
      recoveryDeduction,
      netSettlement:        netPayable,
      subscriptionAbsorbed,
      paymentSource,
      settlementStatus:     'PENDING',
      idempotencyKey:       `settlement:${booking._id}:${userId}:${partnerRole}`,
    }],
    { session }
  );

  // ── H. Write Ledger Entry (BOOKING_EARNING) ──────────────────────────────
  const beforeBalance = wallet.availableBalance;
  const afterBalance  = +(beforeBalance + netPayable).toFixed(2);

  const [txn] = await PartnerWalletTransaction.create(
    [{
      type:         'BOOKING_EARNING',
      direction:    'credit',
      partnerId:    userId,
      walletId:     wallet._id,
      amount:       netPayable,
      grossAmount,
      taxAmount:    taxAmount + (tdsAmount ?? 0),
      netAmount:    netPayable,
      beforeBalance,
      afterBalance,
balanceSnapshot: {
        availableBalance:  afterBalance,
        pendingBalance:    wallet.pendingBalance,
        withdrawalBalance: wallet.withdrawalBalance,
        recoveryBalance:   Math.max(0, wallet.recoveryBalance - recoveryDeduction),
      },
      bookingId:    booking._id,
      settlementId: settlement._id,
      allocationId: allocation._id,
      liabilityId:  updatedLiability?._id ?? null,
      actorRole:    'system',
      idempotencyKey: `BOOKING_EARNING:${booking._id}:${userId}`,
      remarks:      `Booking ${booking.bookingCode} — ${partnerRole} earning`,
    }],
    { session }
  );

// ── I. Update Wallet Balances ────────────────────────────────────────────
  // FIX: `wallet` was fetched BEFORE applyRecovery() ran. When recovery
  // actually deducts something, it bumps this same wallet's __v_balance in
  // the DB — but the local `wallet` var here still holds the stale value.
  // The old optimistic-lock filter `{ __v_balance: wallet.__v_balance }`
  // then matched 0 docs and silently no-op'd, while settlement/allocation/
  // ledger below still got written as SETTLED — success with no money moved.
  // We're already inside one session/transaction here, which gives native
  // write-conflict protection (a real concurrent writer aborts the whole
  // txn, it doesn't silently no-op) — the manual version filter was both
  // redundant and unsafe. Update by _id, keep bumping __v_balance for
  // telemetry, and hard-fail if the wallet is somehow gone mid-transaction.
  // NOTE: lifetimeRecovered removed from here — applyRecovery() already
  // increments it once; incrementing it again here was double-counting
  // every recovery, which would also throw off daily reconciliation.
  const walletAfterCredit = await PartnerWallet.findByIdAndUpdate(
    wallet._id,
    {
      $inc: {
        availableBalance: netPayable,
        lifetimeEarned:   grossAmount,
        __v_balance:      1,
      },
      $set: {
        lastSettlementAt: new Date(),
        updatedBy:        null,
      },
    },
    { session, new: true }
  );

  if (!walletAfterCredit) {
    throw new Error(
      `[settlementEngine] Wallet ${wallet._id} vanished mid-settlement for partner ${userId} — aborting, no funds moved`
    );
  }

  // ── J. Mark Settlement + Allocation as SETTLED ───────────────────────────
  await PartnerSettlement.findByIdAndUpdate(
    settlement._id,
    {
      $set: {
        settlementStatus: 'SETTLED',
        settledAt:        new Date(),
        ledgerTxnId:      txn._id,
        processedAt:      new Date(),
      },
    },
    { session }
  );

  await BookingPartnerAllocation.findByIdAndUpdate(
    allocation._id,
    {
      $set: {
        status:       'settled',
        settlementId: settlement._id,
        liabilityId:  updatedLiability?._id ?? null,
        settledAt:    new Date(),
      },
    },
    { session }
  );

  // ── K. Driver Earnings Display Sync (TransportPartner legs only) ────────
  // Driver has NO PartnerWallet. This is informational only — TP already
  // got the real wallet credit above. Solo drivers are NOT synced here —
  // they ARE the partner and already received the real wallet credit.
  if (partnerRole === 'transportpartner' && Array.isArray(alloc.rideLegs)) {
    await syncDriverEarningsDisplay({ rideLegs: alloc.rideLegs, bookingId: booking._id, session });
  }

  return {
    partnerId: userId,
    partnerProfileId: profileId,
    partnerRole,
    grossAmount,
    platformFee,
    recoveryDeduction,
    netPayable,
    settlementId:  settlement.settlementId,
    txnId:         txn.txnId,
    walletBalance: afterBalance,
  };
}

// ── Driver Earnings Display (informational, NOT a wallet) ────────────────────

async function syncDriverEarningsDisplay({ rideLegs, bookingId, session }) {
  for (const leg of rideLegs) {
    if (!leg.driverId || !leg.fare) continue;
    await Driver.findByIdAndUpdate(
      leg.driverId,
      {
        $push: {
          earningsLog: {
            $each: [{
              bookingId,
              rideId:    leg.rideId,
              amount:    leg.fare,
              status:    'pending',
              createdAt: new Date(),
            }],
            $slice: -100, // cap log length
          },
        },
        $inc: { 'earningsSummary.pendingTotal': leg.fare },
      },
      { session }
    );
  }
}

// ── Cash Collector Resolution ─────────────────────────────────────────────────

/**
 * resolveCashCollectorEntity — maps the User who physically collected cash
 * to the entity that actually OWES the liability.
 *
 * Critical case: an agency driver collects cash. The driver has no wallet —
 * the liability belongs to the driver's ownerAgency (TransportPartner).
 * A solo driver IS the payable entity — liability belongs to them directly.
 */
async function resolveCashCollectorEntity(cashCollectorUserId, session) {
  if (!cashCollectorUserId) return null;
  const collector = await User.findById(cashCollectorUserId).select('role').session(session).lean();
  if (!collector) return null;

  switch (collector.role) {
    case 'driver': {
      const driver = await Driver.findOne({ user: cashCollectorUserId })
        .select('ownerAgency soloPartner')
        .session(session)
        .lean();
      if (!driver) return null;

      if (driver.ownerAgency) {
        const tp = await TransportPartner.findById(driver.ownerAgency).select('user').session(session).lean();
        return tp?.user ? { userId: tp.user, partnerRole: 'transportpartner', profileId: driver.ownerAgency } : null;
      }
      if (driver.soloPartner) {
        const sp = await SoloDriverPartner.findById(driver.soloPartner).select('user').session(session).lean();
        return sp?.user ? { userId: sp.user, partnerRole: 'solodriverpartner', profileId: driver.soloPartner } : null;
      }
      return null;
    }

    case 'transportpartner': {
      const tp = await TransportPartner.findOne({ user: cashCollectorUserId }).select('_id').session(session).lean();
      return tp ? { userId: cashCollectorUserId, partnerRole: 'transportpartner', profileId: tp._id } : null;
    }

    case 'solodriverpartner': {
      const sp = await SoloDriverPartner.findOne({ user: cashCollectorUserId }).select('_id').session(session).lean();
      return sp ? { userId: cashCollectorUserId, partnerRole: 'solodriverpartner', profileId: sp._id } : null;
    }

    case 'care_assistant': {
      const ca = await CareAssistantProfile.findOne({ user: cashCollectorUserId }).select('_id').session(session).lean();
      return ca ? { userId: cashCollectorUserId, partnerRole: 'care_assistant', profileId: ca._id } : null;
    }

    case 'doctor': {
      const doc = await DoctorProfile.findOne({ user: cashCollectorUserId }).select('_id').session(session).lean();
      return doc ? { userId: cashCollectorUserId, partnerRole: 'doctor', profileId: doc._id } : null;
    }
case 'lab_partner': {
      const lab = await LabPartnerProfile.findOne({ user: cashCollectorUserId }).select('_id').session(session).lean();
      return lab ? { userId: cashCollectorUserId, partnerRole: 'lab_partner', profileId: lab._id } : null;
    }

    case 'hospital': {
      const Hospital = mongoose.model('Hospital');
      const hosp = await Hospital.findOne({ managedBy: cashCollectorUserId }).select('_id').session(session).lean();
      return hosp ? { userId: cashCollectorUserId, partnerRole: 'hospital', profileId: hosp._id } : null;
    }

    default:
      return null;
  }
}

// ── Cash Collector Liability ──────────────────────────────────────────────────

async function createCashCollectorLiability({ booking, settlementResults, collectorEntity, session }) {
  const totalCash = booking.collectedByPartner?.amount ?? 0;
  if (!totalCash || !collectorEntity) return null;

  const validResults = settlementResults.filter((r) => !r.skipped);

  const collectorResult = validResults.find(
    (r) => r.partnerId.toString() === collectorEntity.userId.toString()
  );
  if (!collectorResult) {
    console.warn(`[settlementEngine] Cash collector ${collectorEntity.userId} has no settled allocation on booking ${booking._id} — no liability created`);
    return null;
  }

  const ownEarning = collectorResult.grossAmount;
  const totalPartnerEarnings = validResults.reduce((sum, r) => sum + r.grossAmount, 0);
  const othersEarning = +(totalPartnerEarnings - ownEarning).toFixed(2);
  const platformShare = Math.max(0, +(totalCash - totalPartnerEarnings).toFixed(2));
  const totalLiability = +(totalCash - ownEarning).toFixed(2);
  if (totalLiability <= 0) return null; // collector kept exactly their own share or less

  const wallet = await PartnerWallet.findOne({ partner: collectorEntity.userId }).session(session);
  if (!wallet) {
    console.error(`[settlementEngine] No wallet found for cash collector ${collectorEntity.userId} — cannot record liability`);
    return null;
  }

  const [liability] = await PartnerCollectionLiability.create(
    [{
      partner:         collectorEntity.userId,
      partnerRole:     collectorEntity.partnerRole,
      walletId:        wallet._id,
      booking:         booking._id,
      bookingType:     booking.bookingType,
      amountCollected: totalCash,
      ownEarning,
      othersEarning,
      platformShare,
      totalLiability,
      amountRecovered: 0,
      status:          'OPEN',
    }],
    { session }
  );

  // Write LIABILITY_CREATED ledger entry
  await PartnerWalletTransaction.create(
    [{
      type:         'LIABILITY_CREATED',
      direction:    'neutral',
      partnerId:    collectorEntity.userId,
      walletId:     wallet._id,
      amount:       totalLiability,
      beforeBalance: wallet.availableBalance,
      afterBalance:  wallet.availableBalance, // neutral — no balance change
      balanceSnapshot: {
        availableBalance:  wallet.availableBalance,
        pendingBalance:    wallet.pendingBalance,
        withdrawalBalance: wallet.withdrawalBalance,
        recoveryBalance:   wallet.recoveryBalance + totalLiability,
      },
      bookingId:    booking._id,
      liabilityId:  liability._id,
      actorRole:    'system',
      idempotencyKey: `LIABILITY_CREATED:${booking._id}:${collectorEntity.userId}`,
      remarks:      `Cash collection liability: ₹${totalLiability} from booking ${booking.bookingCode}`,
    }],
    { session }
  );

  // Update wallet recoveryBalance
  await PartnerWallet.findByIdAndUpdate(
    wallet._id,
    { $inc: { recoveryBalance: totalLiability, __v_balance: 1 } },
    { session }
  );

  return liability;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolvePaymentSource(booking) {
  if (booking.payAtService?.paidByCustomer) return 'PAY_AT_SERVICE';
  if (booking.paymentStatus === 'paid') return 'ONLINE';
  if (booking.paymentStatus === 'partially_paid') return 'PARTIAL';
  if (booking.paymentStatus === 'pending_cash') return 'PAY_AT_SERVICE';
  return 'ONLINE';
}