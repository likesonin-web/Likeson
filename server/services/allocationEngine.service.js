import mongoose from 'mongoose';

/**
 * allocationEngineService — creates BookingPartnerAllocation docs the moment
 * a booking hits 'completed'. Display-only earning (pending/settled totals),
 * NOT wallet credit. Wallet credit still happens on the batch settlement
 * cron per settlementCycle — that part is unchanged.
 *
 * Payment routing rule (per business decision):
 *   bookingType === 'doctor_online'  -> paymentSource 'ONLINE'
 *   everything else                  -> paymentSource 'PAY_AT_SERVICE'
 *
 * Called from THREE places (belt-and-braces — don't rely on a single hook):
 *   1. Booking.js post-save hook (fires when .save() transitions to 'completed')
 *   2. bookingRouter.js explicit calls after every route that flips status
 *      to 'completed' — REQUIRED for routes using findByIdAndUpdate, since
 *      that bypasses Mongoose document middleware entirely.
 *   3. Idempotent either way — idempotencyKey + existing-check below means
 *      duplicate calls are always safe no-ops.
 */

// Which partner role is the cash collector per bookingType (PAY_AT_SERVICE only).
// Adjust freely — this is the one place that encodes "who physically holds the cash."
const CASH_COLLECTOR_BY_TYPE = {
  full_care_ride:      'driver',
  patient_transport:   'driver',
  doctor_consultation: 'doctor',
  physiotherapist:     'doctor',
  follow_up:           'doctor',
  care_assistant:      'care_assistant',
  diagnostic_center:   'lab_partner',
  diagnostic_home:     'lab_partner',
};

import { computeDoctorHospitalAllocations } from './allocationEngineService.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';

export async function createAllocationsForBooking(bookingId, session = null) {
  const Booking                   = mongoose.model('Booking');
  const BookingPartnerAllocation  = mongoose.model('BookingPartnerAllocation');
  const Hospital                  = mongoose.model('Hospital');

  let bookingQuery = Booking.findById(bookingId)
    .select('bookingType consultationType doctor hospital careAssistant transportPartner solodriverpartner labPartner fareBreakdown status')
    .lean();
  if (session) bookingQuery = bookingQuery.session(session);
  const booking = await bookingQuery;
  if (!booking) {
    console.error(`[allocationEngine] booking ${bookingId} not found`);
    return [];
  }

  // Guard: only allocate for bookings actually completed. Prevents accidental
  // early allocation if this is ever called from a non-completion path.
  if (booking.status !== 'completed') {
    console.warn(`[allocationEngine] booking ${bookingId} status is '${booking.status}', not 'completed' — skipping`);
    return [];
  }

  const fb = { ...(booking.fareBreakdown || {}) };
  const paymentSource = booking.bookingType === 'doctor_online' ? 'ONLINE' : 'PAY_AT_SERVICE';
  const collectorRole = CASH_COLLECTOR_BY_TYPE[booking.bookingType] || null;

  // Fallback: if pricing engine hasn't filled per-role shares yet but totalAmount
  // exists, don't silently produce zero earning — attribute totalAmount to the
  // single primary partner for that bookingType. Prevents "no allocation created"
  // when fareBreakdown is only partially populated at completion time.
// Doctor/hospital shares NO LONGER read from fb here — resolveEffectivePricing()
  // is now the single source of truth (see candidates block below). Fallback stays
  // only for roles that still rely on fareBreakdown.
  const hasAnyShare = (fb.careAssistantFee || fb.transportFee || fb.diagnosticFee) > 0;
  if (!hasAnyShare && fb.totalAmount > 0) {
    const primaryRole = CASH_COLLECTOR_BY_TYPE[booking.bookingType];
    if (primaryRole === 'driver') fb.transportFee = fb.totalAmount;
    else if (primaryRole === 'care_assistant') fb.careAssistantFee = fb.totalAmount;
    else if (primaryRole === 'lab_partner') fb.diagnosticFee = fb.totalAmount;
  }

 // ── Resolve candidate partner legs: {partnerRole, partnerId(User), partnerProfileId, grossAmount} ──
  const candidates = [];

  // Doctor + Hospital legs — ONE source of truth now: DoctorProfile.resolveEffectivePricing()
  // via computeDoctorHospitalAllocations, same function settlementEngineService uses.
  // platformFee/taxAmount computed here too (Q4) — pending earning already shows net, not gross.
  if (booking.doctor) {
    const pricingConfig = await PlatformPricingConfig.getGlobal();
    const dhAllocs = await computeDoctorHospitalAllocations(booking, pricingConfig, session);

    for (const alloc of dhAllocs) {
      if (alloc.partnerRole === 'doctor') {
        candidates.push({
          partnerRole:  'doctor',
          profileModel: 'DoctorProfile',
          profileId:    alloc.partnerId,
          grossAmount:  alloc.grossAmount,
          platformFee:  alloc.platformFee ?? 0,
          taxAmount:    alloc.taxAmount ?? 0,
        });
      } else if (alloc.partnerRole === 'hospital') {
        let hospitalQuery = Hospital.findById(alloc.partnerId).select('managedBy').lean();
        if (session) hospitalQuery = hospitalQuery.session(session);
        const hospital = await hospitalQuery;
        if (hospital?.managedBy) {
          candidates.push({
            partnerRole: 'hospital',
            partnerId:   hospital.managedBy,
            profileId:   alloc.partnerId,
            grossAmount: alloc.grossAmount,
            platformFee: alloc.platformFee ?? 0,
            taxAmount:   alloc.taxAmount ?? 0,
          });
        }
      }
    }
  }

  if (booking.careAssistant && fb.careAssistantFee > 0) {
    candidates.push({ partnerRole: 'care_assistant', profileModel: 'CareAssistantProfile', profileId: booking.careAssistant, grossAmount: fb.careAssistantFee });
  }

  // Transport leg — solo partner takes priority over agency (mirrors Driver.js note:
  // agency driver has NO wallet, money always goes to TransportPartner.user).
  if (fb.transportFee > 0) {
    if (booking.solodriverpartner) {
      candidates.push({ partnerRole: 'solodriverpartner', profileModel: 'SoloDriverPartner', profileId: booking.solodriverpartner, grossAmount: fb.transportFee });
    } else if (booking.transportPartner) {
      candidates.push({ partnerRole: 'transportpartner', profileModel: 'TransportPartner', profileId: booking.transportPartner, grossAmount: fb.transportFee });
    }
  }

  if (booking.labPartner && (fb.diagnosticFee > 0 || fb.homeCollectionFee > 0)) {
    candidates.push({
      partnerRole: 'lab_partner',
      profileModel: 'LabPartnerProfile',
      profileId: booking.labPartner,
      grossAmount: (fb.diagnosticFee || 0) + (fb.homeCollectionFee || 0),
    });
  }

  if (candidates.length === 0) {
    console.warn(`[allocationEngine] booking ${bookingId} completed but no candidates found — check fareBreakdown/partner refs`, {
      bookingType: booking.bookingType, fareBreakdown: fb,
      hasDoctor: !!booking.doctor, hasHospital: !!booking.hospital,
      hasCareAssistant: !!booking.careAssistant, hasTransport: !!(booking.solodriverpartner || booking.transportPartner),
      hasLabPartner: !!booking.labPartner,
    });
    return [];
  }

  // ── Resolve profileId -> User._id (partnerId) for roles that need a profile lookup ──
  const resolved = [];
  for (const c of candidates) {
    let partnerId = c.partnerId; // hospital already resolved above
    if (!partnerId && c.profileModel) {
      const Model = mongoose.model(c.profileModel);
      let q = Model.findById(c.profileId).select('user').lean();
      if (session) q = q.session(session);
      const doc = await q;
      if (!doc?.user) {
        console.warn(`[allocationEngine] ${c.profileModel} ${c.profileId} has no linked User — skipping this leg`);
        continue; // no linked User account — skip, can't wallet-credit
      }
      partnerId = doc.user;
    }
    resolved.push({ ...c, partnerId });
  }

  if (resolved.length === 0) {
    console.warn(`[allocationEngine] booking ${bookingId} — all candidates dropped (missing linked User accounts)`);
    return [];
  }

  const totalAmount = fb.totalAmount || 0;

  const docsToInsert = resolved.map((r) => {
    const isCollector = paymentSource === 'PAY_AT_SERVICE' && r.partnerRole === collectorRole;
    const idempotencyKey = `alloc:${bookingId}:${r.partnerId}:${r.partnerRole}`;

    return {
      bookingId,
      partnerId: r.partnerId,
      partnerProfileId: r.profileId,
      partnerRole: r.partnerRole,
      bookingType: booking.bookingType,
grossAmount: r.grossAmount,
      platformFee: r.platformFee ?? 0,
      taxAmount: r.taxAmount ?? 0,
      tdsAmount: 0,
      recoveryDeduction: 0,
      // Fix (Q4): doctor/hospital legs now carry real platformFee/taxAmount from
      // resolveEffectivePricing at creation time — pending earning shown to partner
      // already reflects the cut, not gross. Other roles unchanged (fee=0 until settle).
      netPayable: Math.max(0, +(r.grossAmount - (r.platformFee ?? 0) - (r.taxAmount ?? 0)).toFixed(2)), // no deductions applied yet — settlement job recalculates at settle time
      subscriptionAbsorbed: 0,
      paymentSource,
      isCashCollector: isCollector,
      cashCollected: isCollector ? totalAmount : 0,
      status: 'pending',
      idempotencyKey,
    };
  });

  // Idempotent insert — skip any that already exist (e.g. hook + explicit call both firing).
  const existing = await BookingPartnerAllocation.find({
    idempotencyKey: { $in: docsToInsert.map(d => d.idempotencyKey) },
  }).select('idempotencyKey').lean();
  const existingKeys = new Set(existing.map(e => e.idempotencyKey));
  const toInsert = docsToInsert.filter(d => !existingKeys.has(d.idempotencyKey));

  if (toInsert.length === 0) {
    console.log(`[allocationEngine] booking ${bookingId} — all allocations already exist, nothing to insert`);
    return [];
  }

  const opts = session ? { session, ordered: false } : { ordered: false };
  const inserted = await BookingPartnerAllocation.insertMany(toInsert, opts);
  console.log(`[allocationEngine] booking ${bookingId} — inserted ${inserted.length} allocation(s)`);
  return inserted;
}