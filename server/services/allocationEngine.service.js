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

export async function createAllocationsForBooking(bookingId, session = null) {
  const Booking                   = mongoose.model('Booking');
  const BookingPartnerAllocation  = mongoose.model('BookingPartnerAllocation');
  const Hospital                  = mongoose.model('Hospital');

  let bookingQuery = Booking.findById(bookingId)
    .select('bookingType doctor hospital careAssistant transportPartner solodriverpartner labPartner fareBreakdown status')
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
  const hasAnyShare = (fb.doctorShare || fb.hospitalShare || fb.careAssistantFee || fb.transportFee || fb.diagnosticFee) > 0;
  if (!hasAnyShare && fb.totalAmount > 0) {
    const primaryRole = CASH_COLLECTOR_BY_TYPE[booking.bookingType];
    if (primaryRole === 'doctor') fb.doctorShare = fb.totalAmount;
    else if (primaryRole === 'driver') fb.transportFee = fb.totalAmount;
    else if (primaryRole === 'care_assistant') fb.careAssistantFee = fb.totalAmount;
    else if (primaryRole === 'lab_partner') fb.diagnosticFee = fb.totalAmount;
  }

  // ── Resolve candidate partner legs: {partnerRole, partnerId(User), partnerProfileId, grossAmount} ──
  const candidates = [];

  if (booking.doctor && fb.doctorShare > 0) {
    candidates.push({ partnerRole: 'doctor', profileModel: 'DoctorProfile', profileId: booking.doctor, grossAmount: fb.doctorShare });
  }

  if (booking.hospital && fb.hospitalShare > 0) {
    let hospitalQuery = Hospital.findById(booking.hospital).select('managedBy').lean();
    if (session) hospitalQuery = hospitalQuery.session(session);
    const hospital = await hospitalQuery;
    if (hospital?.managedBy) {
      candidates.push({ partnerRole: 'hospital', partnerId: hospital.managedBy, profileId: booking.hospital, grossAmount: fb.hospitalShare });
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
      platformFee: 0,   // per-partner platform fee split — wire in once PricingEngine finalized
      taxAmount: 0,
      tdsAmount: 0,
      recoveryDeduction: 0,
      netPayable: r.grossAmount, // no deductions applied yet — settlement job recalculates at settle time
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