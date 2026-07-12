import mongoose from 'mongoose';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';

/**
 * allocationEngineService.js
 *
 * Two entry points:
 *   computeDoctorHospitalAllocations() — doctor/hospital leg only, used by BOTH
 *     createAllocationsForBooking() (display-only, instant) and
 *     computePartnerAllocations() (real settlement, via settlementEngine.service.js).
 *     Single source of truth: DoctorProfile.resolveEffectivePricing().
 *
 *   computePartnerAllocations() — FULL allocation set (doctor/hospital/CA/
 *     transport/lab) for a completed booking. Returns partnerId as the
 *     PROFILE id (DoctorProfile._id / Hospital._id / etc), never a User id —
 *     settlementEngine.service.js resolves User id itself via
 *     resolveUserIdFromProfile(). This is what processBookingSettlement()
 *     calls at step 4.
 *
 *   createAllocationsForBooking() — display-only BookingPartnerAllocation
 *     rows created the instant a booking completes (NOT wallet credit).
 */

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

// ── Platform fee resolution helper ───────────────────────────────────────────
function resolvePlatformFeeAmount(baseAmount, feeObj) {
  if (!feeObj || baseAmount <= 0) return 0;
  if (feeObj.type === 'percentage') return +(baseAmount * (feeObj.value / 100)).toFixed(2);
  return Math.min(feeObj.value, baseAmount); // never let fee exceed the base
}

// ── Doctor / Hospital leg — SINGLE SOURCE OF TRUTH ───────────────────────────
/**
 * computeDoctorHospitalAllocations
 *
 * Reads DoctorProfile.resolveEffectivePricing() (which already resolves
 * doctor-owner vs hospital-manager via the doctor's primaryHospital).
 *
 * CRITICAL FIX: previously, when hospital-manager pricing gave doctorShare=0
 * (no explicit honorarium set), NOTHING was allocated — not even the
 * hospital's share — because the caller only ever looked at doctorShare.
 * Now: hospital gets grossHospitalShare whenever it's > 0, independent of
 * whether doctor also gets something. This fixes bookings exactly like
 * yours: doctorShare=0, hospitalShare=700 → hospital allocation of 700 now
 * gets created; doctor allocation is correctly skipped (they earned 0).
 */
export async function computeDoctorHospitalAllocations(booking, pricingConfig, session = null) {
  if (!booking.doctor) return [];

  const DoctorProfile = mongoose.model('DoctorProfile');

  const consultationType = booking.consultationType || 'inPerson';
  const isFollowUp = booking.bookingType === 'follow_up';

  let pricing;
  try {
    pricing = await DoctorProfile.resolveEffectivePricing(
      booking.doctor,
      consultationType,
      isFollowUp,
      0, // followUpFeeOverride — falls back to pricingSource.followUpFee
      session
    );
  } catch (err) {
    console.error(`[allocationEngine] resolveEffectivePricing failed for doctor ${booking.doctor}: ${err.message}`);
    return [];
  }

  const { source, pricingOwnerId, calculated, platformFee: overrideFee } = pricing;
  const { doctorShare, grossHospitalShare } = calculated;

  const allocations = [];

  if (source === 'doctor') {
    // doctor-owner hospital type — doctor owns pricing, hospital never paid.
    if (doctorShare > 0) {
      const fee = overrideFee ?? pricingConfig?.doctor?.platformFee ?? null;
      allocations.push({
        partnerId:   booking.doctor,      // DoctorProfile._id
        partnerRole: 'doctor',
        grossAmount: doctorShare,
        platformFee: resolvePlatformFeeAmount(doctorShare, fee),
        taxAmount:   0,
        tdsAmount:   0,
      });
    }
  } else {
    // hospital-manager — hospital gets its share regardless of doctorShare.
    if (grossHospitalShare > 0) {
      const fee = overrideFee ?? pricingConfig?.hospital?.platformFee ?? null;
      allocations.push({
        partnerId:   pricingOwnerId,      // Hospital._id
        partnerRole: 'hospital',
        grossAmount: grossHospitalShare,
        platformFee: resolvePlatformFeeAmount(grossHospitalShare, fee),
        taxAmount:   0,
        tdsAmount:   0,
      });
    }
    if (doctorShare > 0) {
      allocations.push({
        partnerId:   booking.doctor,
        partnerRole: 'doctor',
        grossAmount: doctorShare,
        platformFee: 0, // platform fee already taken on hospital side under hospital-manager
        taxAmount:   0,
        tdsAmount:   0,
      });
    }
  }

  return allocations;
}

// ── Full allocation set — used by settlementEngine.service.js ───────────────
export async function computePartnerAllocations(booking, pricingConfig, session = null) {
  const allocations = [];

  const dhAllocs = await computeDoctorHospitalAllocations(booking, pricingConfig, session);
  allocations.push(...dhAllocs);

  const fb = booking.fareBreakdown || {};

  if (booking.careAssistant && fb.careAssistantFee > 0) {
    allocations.push({
      partnerId:   booking.careAssistant,
      partnerRole: 'care_assistant',
      grossAmount: fb.careAssistantFee,
      platformFee: 0,
      taxAmount:   0,
      tdsAmount:   0,
    });
  }

  if (fb.transportFee > 0) {
    if (booking.solodriverpartner) {
      allocations.push({
        partnerId:   booking.solodriverpartner,
        partnerRole: 'solodriverpartner',
        grossAmount: fb.transportFee,
        platformFee: 0,
        taxAmount:   0,
        tdsAmount:   0,
      });
    } else if (booking.transportPartner) {
      allocations.push({
        partnerId:   booking.transportPartner,
        partnerRole: 'transportpartner',
        grossAmount: fb.transportFee,
        platformFee: 0,
        taxAmount:   0,
        tdsAmount:   0,
      });
    }
  }

  if (booking.labPartner && ((fb.diagnosticFee || 0) + (fb.homeCollectionFee || 0)) > 0) {
    allocations.push({
      partnerId:   booking.labPartner,
      partnerRole: 'lab_partner',
      grossAmount: (fb.diagnosticFee || 0) + (fb.homeCollectionFee || 0),
      platformFee: 0,
      taxAmount:   0,
      tdsAmount:   0,
    });
  }

  return allocations;
}

// ── Display-only allocation rows on booking completion (unchanged logic, fixed import) ──
export async function createAllocationsForBooking(bookingId, session = null) {
  const Booking                  = mongoose.model('Booking');
  const BookingPartnerAllocation = mongoose.model('BookingPartnerAllocation');
  const Hospital                 = mongoose.model('Hospital');

  let bookingQuery = Booking.findById(bookingId)
    .select('bookingType consultationType doctor hospital careAssistant transportPartner solodriverpartner labPartner fareBreakdown status')
    .lean();
  if (session) bookingQuery = bookingQuery.session(session);
  const booking = await bookingQuery;
  if (!booking) {
    console.error(`[allocationEngine] booking ${bookingId} not found`);
    return [];
  }

  if (booking.status !== 'completed') {
    console.warn(`[allocationEngine] booking ${bookingId} status is '${booking.status}', not 'completed' — skipping`);
    return [];
  }

  const fb = { ...(booking.fareBreakdown || {}) };
  const paymentSource = booking.bookingType === 'doctor_online' ? 'ONLINE' : 'PAY_AT_SERVICE';
  const collectorRole = CASH_COLLECTOR_BY_TYPE[booking.bookingType] || null;

  const hasAnyShare = (fb.careAssistantFee || fb.transportFee || fb.diagnosticFee) > 0;
  if (!hasAnyShare && fb.totalAmount > 0) {
    const primaryRole = CASH_COLLECTOR_BY_TYPE[booking.bookingType];
    if (primaryRole === 'driver') fb.transportFee = fb.totalAmount;
    else if (primaryRole === 'care_assistant') fb.careAssistantFee = fb.totalAmount;
    else if (primaryRole === 'lab_partner') fb.diagnosticFee = fb.totalAmount;
  }

  const candidates = [];

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
    console.warn(`[allocationEngine] booking ${bookingId} completed but no candidates found`, {
      bookingType: booking.bookingType, fareBreakdown: fb,
      hasDoctor: !!booking.doctor, hasHospital: !!booking.hospital,
      hasCareAssistant: !!booking.careAssistant, hasTransport: !!(booking.solodriverpartner || booking.transportPartner),
      hasLabPartner: !!booking.labPartner,
    });
    return [];
  }

  const resolved = [];
  for (const c of candidates) {
    let partnerId = c.partnerId;
    if (!partnerId && c.profileModel) {
      const Model = mongoose.model(c.profileModel);
      let q = Model.findById(c.profileId).select('user').lean();
      if (session) q = q.session(session);
      const doc = await q;
      if (!doc?.user) {
        console.warn(`[allocationEngine] ${c.profileModel} ${c.profileId} has no linked User — skipping this leg`);
        continue;
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
      netPayable: Math.max(0, +(r.grossAmount - (r.platformFee ?? 0) - (r.taxAmount ?? 0)).toFixed(2)),
      subscriptionAbsorbed: 0,
      paymentSource,
      isCashCollector: isCollector,
      cashCollected: isCollector ? totalAmount : 0,
      status: 'pending',
      idempotencyKey,
    };
  });

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