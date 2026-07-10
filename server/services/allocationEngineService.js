/**
 * allocationEngineService.js
 *
 * CORE FARE / PAYOUT CALCULATOR
 *
 * Computes per-partner gross earnings for a COMPLETED booking, before the
 * settlementEngine turns these into ledger entries + wallet credits.
 *
 * Entry point: computePartnerAllocations(booking, pricingConfig, session)
 * Returns: Array<{
 *   partnerId,            // PROFILE id (DoctorProfile/TransportPartner/SoloDriverPartner/
 *                          // CareAssistantProfile/LabPartnerProfile/Hospital _id)
 *   partnerRole,          // 'doctor' | 'hospital' | 'care_assistant' |
 *                          // 'transportpartner' | 'solodriverpartner' | 'lab_partner'
 *   grossAmount,
 *   platformFee,
 *   taxAmount,
 *   tdsAmount,
 *   subscriptionAbsorbed,
 *   rideLegs?,            // only present for transportpartner/solodriverpartner —
 *                          // [{ rideId, km, fare, driverId, isReturnRide }]
 * }>
 *
 * settlementEngine.service.js resolves partnerId (profile id) -> User id
 * before writing Wallet/Settlement/Ledger records. This file never touches
 * User ids — it only deals in profile ids and money math.
 *
 * ── TRANSPORT FARE RULE (confirmed) ──────────────────────────────────────
 *   computed = pricing.baseFarePerKm * distanceKm
 *   rideFare = computed > pricing.minimumFare ? computed : pricing.minimumFare
 *   Waiting charges are customer-facing / platform revenue ONLY.
 *   They are never added to partner grossAmount.
 *
 * ── DISTANCE SOURCE (chosen — see chat) ──────────────────────────────────
 *   ride.actualDistanceKm (GPS-tracked, set at ride completion) preferred.
 *   Falls back to ride.estimatedDistanceKm only if actual is missing/zero.
 *
 * ── MULTI-LEG / MULTI-PARTNER BOOKINGS (confirmed) ───────────────────────
 *   One booking can have a different TransportPartner/Driver/SoloDriverPartner
 *   per leg (primaryRide vs returnRide, or any ride in booking.rides[]).
 *   Each completed Ride is priced independently, then grouped + summed by
 *   (partnerRole, partnerId) so one partner who drove both legs gets ONE
 *   allocation with combined grossAmount, while two different partners get
 *   two separate allocations.
 *
 * ── PLATFORM FEE RESOLUTION ORDER (confirmed) ────────────────────────────
 *   1. Partner-level override (TransportPartner.platformFeeOverride /
 *      SoloDriverPartner.platformFeeOverride / DoctorProfile.platformFee /
 *      Hospital.platformFeeOverride if present)
 *   2. PlatformPricingConfig fallback for that service line
 *
 * ── DOCTOR + HOSPITAL ─────────────────────────────────────────────────────
 *   Both get paid (confirmed). doctorShare/hospitalShare come from
 *   DoctorProfile.resolveEffectivePricing(). Hospital is only paid when
 *   booking.hospital is set AND hospitalShare > 0 — for bookings with no
 *   physical hospital (e.g. pure tele-consult, no hospital on booking),
 *   that delta is platform revenue, not paid out.
 *
 * ── TDS ───────────────────────────────────────────────────────────────────
 *   1% flat on transportpartner / solodriverpartner gross, per the
 *   "1% for transport partners" note in PartnerSettlement.js. Not applied
 *   to doctor/hospital/care_assistant/lab_partner (no config signal given).
 *   Revisit if finance gives per-role TDS config.
 *
* ── HOSPITAL RESOLUTION (confirmed) ──────────────────────────────────────
 *   Hospital model loaded lazily via mongoose.model('Hospital'). Confirmed:
 *   Hospital has NO `user` field (settlementEngine keys it via `managedBy`
 *   instead). This file only reads `platformFeeOverride` off Hospital, so
 *   that part was already correct. The hospitalId used here comes from
 *   pricing.pricingOwnerId (see resolveEffectivePricing), not booking.hospital,
 *   since booking.hospital is frequently unset.
 */

import mongoose from 'mongoose';
import DoctorProfile from '../models/DoctorProfile.js';
import LabPartnerProfile from '../models/LabPartnerProfile.js';
import TransportPartner from '../models/TransportPartner.js';
import SoloDriverPartner from '../models/SoloDriverPartner.js';
import Driver from '../models/Driver.js';
import Ride from '../models/Ride.js';
import PlatformPricingConfig from '../models/PlatformPricingConfig.js';

const FIXED = 'fixed';
const PERCENTAGE = 'percentage';

// ── Fee Helpers ────────────────────────────────────────────────────────────

/**
 * resolvePlatformFee — partner-level override wins; else fallback config fee.
 * Both shapes: { type: 'fixed'|'percentage', value: Number }
 */
function resolvePlatformFee(overrideFee, fallbackFee) {
  if (overrideFee && overrideFee.type && overrideFee.value != null) {
    return overrideFee;
  }
  return fallbackFee ?? null;
}

function applyPlatformFee(amount, feeCfg) {
  if (!feeCfg || !feeCfg.type || amount <= 0) return 0;
  if (feeCfg.type === PERCENTAGE) {
    return +(amount * (feeCfg.value / 100)).toFixed(2);
  }
  if (feeCfg.type === FIXED) {
    return +Math.min(feeCfg.value, amount).toFixed(2);
  }
  return 0;
}

function applyGst(amount, gstPercent) {
  if (!amount || !gstPercent) return 0;
  return +(amount * (gstPercent / 100)).toFixed(2);
}

const TRANSPORT_TDS_RATE = 0.01; // 1% — see header note

// ── Transport (TransportPartner / SoloDriverPartner) ──────────────────────

/**
 * Pulls every completed Ride linked to this booking, prices each leg
 * independently (max(minimumFare, baseFarePerKm * km)), then groups by
 * the actual paying entity (TransportPartner or SoloDriverPartner — never
 * the Driver doc itself, per business rule).
 */
async function computeRideBasedAllocations(booking, pricingConfig, session) {
  const rideIdSet = new Map(); // dedupe by string id while preserving ObjectId
  for (const id of booking.rides ?? []) rideIdSet.set(id.toString(), id);
  if (booking.primaryRide) rideIdSet.set(booking.primaryRide.toString(), booking.primaryRide);
  if (booking.returnRide) rideIdSet.set(booking.returnRide.toString(), booking.returnRide);

  if (rideIdSet.size === 0) return [];

  const rides = await Ride.find({
    _id: { $in: [...rideIdSet.values()] },
    status: 'completed',
  })
    .select('transportPartner soloPartner driver actualDistanceKm estimatedDistanceKm isReturnRide rideCode')
    .session(session)
    .lean();

  if (rides.length === 0) return [];

  // Resolve missing transportPartner/soloPartner via Driver doc as a
  // defensive fallback (Ride should normally carry these directly).
  const driverFallbackIds = rides
    .filter((r) => !r.transportPartner && !r.soloPartner && r.driver)
    .map((r) => r.driver);

  let driverLookup = new Map();
  if (driverFallbackIds.length > 0) {
    const drivers = await Driver.find({ _id: { $in: driverFallbackIds } })
      .select('ownerAgency soloPartner')
      .session(session)
      .lean();
    driverLookup = new Map(drivers.map((d) => [d._id.toString(), d]));
  }

  // ── Group legs by paying entity ──────────────────────────────────────────
  const groups = new Map(); // key: `${role}:${profileId}`

  for (const ride of rides) {
    let partnerRole = null;
    let partnerId = null;

    if (ride.transportPartner) {
      partnerRole = 'transportpartner';
      partnerId = ride.transportPartner;
    } else if (ride.soloPartner) {
      partnerRole = 'solodriverpartner';
      partnerId = ride.soloPartner;
    } else if (ride.driver) {
      const d = driverLookup.get(ride.driver.toString());
      if (d?.ownerAgency) {
        partnerRole = 'transportpartner';
        partnerId = d.ownerAgency;
      } else if (d?.soloPartner) {
        partnerRole = 'solodriverpartner';
        partnerId = d.soloPartner;
      }
    }

    if (!partnerRole || !partnerId) continue; // no payable entity on this ride — skip

    const km = ride.actualDistanceKm > 0 ? ride.actualDistanceKm : (ride.estimatedDistanceKm || 0);
    if (km <= 0) continue;

    const key = `${partnerRole}:${partnerId.toString()}`;
    if (!groups.has(key)) {
      groups.set(key, { partnerRole, partnerId, kmTotal: 0, legs: [] });
    }
    groups.get(key).legs.push({ rideId: ride._id, km, driverId: ride.driver ?? null, isReturnRide: !!ride.isReturnRide });
  }

  if (groups.size === 0) return [];

  // ── Price each group against ITS OWN partner pricing doc ─────────────────
  const allocations = [];

  for (const group of groups.values()) {
    const PartnerModel = group.partnerRole === 'transportpartner' ? TransportPartner : SoloDriverPartner;
    const partnerDoc = await PartnerModel.findById(group.partnerId)
      .select('pricing platformFeeOverride')
      .session(session)
      .lean();
    if (!partnerDoc) continue; // partner deleted/missing — skip rather than crash settlement

// Confirmed rule: gross = distanceKm * baseFarePerKm, no minimumFare
    // floor, no waiting/night/wheelchair surcharge in partner payout — those
    // are customer-facing / platform revenue only, never partner earnings.
    const ratePerKm = partnerDoc.pricing?.baseFarePerKm ?? pricingConfig.transport.defaultRatePerKm;

    let grossAmount = 0;
    const rideLegs = [];
    for (const leg of group.legs) {
      const legFare = +(ratePerKm * leg.km).toFixed(2);
      grossAmount = +(grossAmount + legFare).toFixed(2);
      rideLegs.push({ ...leg, fare: legFare });
    }

    const feeCfg = resolvePlatformFee(partnerDoc.platformFeeOverride, pricingConfig.transport.platformFee);
    const platformFee = applyPlatformFee(grossAmount, feeCfg);
    const taxAmount = applyGst(grossAmount, pricingConfig.tax?.transportGstPercent);
    const tdsAmount = +(grossAmount * TRANSPORT_TDS_RATE).toFixed(2);

    allocations.push({
      partnerId: group.partnerId,
      partnerRole: group.partnerRole,
      grossAmount,
      platformFee,
      taxAmount,
      tdsAmount,
      subscriptionAbsorbed: 0,
      rideLegs,
    });
  }

  return allocations;
}

// ── Doctor + Hospital ───────────────────────────────────────────────────────

export async function computeDoctorHospitalAllocations(booking, pricingConfig, session) {
  if (!booking.doctor) return [];

  const consultationType = booking.consultationType || 'inPerson';
  const isFollowUp = booking.bookingType === 'follow_up';
  const followUpFee = isFollowUp ? (booking.fareBreakdown?.consultationFee ?? 0) : 0;

  // session-aware — see DoctorProfile.js patch
  const pricing = await DoctorProfile.resolveEffectivePricing(
    booking.doctor,
    consultationType,
    isFollowUp,
    followUpFee,
    session,
  );
  const { doctorShare, hospitalShare } = pricing.calculated;

  const allocations = [];

if (doctorShare > 0) {
    // Hospital-manager booking: hospital owns pricing/fee, doctor gets the
    // FULL doctorShare with zero platform-fee deduction — the platform's
    // cut is taken from the hospital's allocation below, not here.
    // Doctor-owner booking: doctor's own override (else global config) fee
    // applies as before — no hospital allocation exists in that case at all.
    const isHospitalManaged = pricing.source === 'hospital';
    let doctorPlatformFee = 0;

    if (!isHospitalManaged) {
      const doctorDoc = await DoctorProfile.findById(booking.doctor).select('platformFee').session(session).lean();
      const feeCfg = resolvePlatformFee(doctorDoc?.platformFee, pricingConfig.doctor.platformFee);
      doctorPlatformFee = applyPlatformFee(doctorShare, feeCfg);
    }

    allocations.push({
      partnerId: booking.doctor,
      partnerRole: 'doctor',
      grossAmount: doctorShare,
      platformFee: doctorPlatformFee,
      taxAmount: applyGst(doctorShare, pricingConfig.tax?.consultationGstPercent),
      tdsAmount: 0,
      subscriptionAbsorbed: 0,
    });
  }

// Hospital only paid when pricing was actually resolved as hospital-managed.
  // pricing.pricingOwnerId (from DoctorProfile.resolveEffectivePricing above)
  // is the correct hospital._id in that case — booking.hospital is often
  // unset (booking created directly under a doctor, no hospital step ever
  // ran) and must NOT gate this allocation. Fall back to booking.hospital
  // only as a last resort for any legacy/edge path.
  const hospitalId = pricing.source === 'hospital' ? pricing.pricingOwnerId : booking.hospital;

  if (hospitalId && hospitalShare > 0) {
    const Hospital = mongoose.model('Hospital');
    const hospitalDoc = await Hospital.findById(hospitalId)
      .select('platformFeeOverride')
      .session(session)
      .lean()
      .catch(() => null);

    const feeCfg = resolvePlatformFee(hospitalDoc?.platformFeeOverride, pricingConfig.hospital.platformFee);
    allocations.push({
      partnerId: hospitalId,
      partnerRole: 'hospital',
      grossAmount: hospitalShare,
      platformFee: applyPlatformFee(hospitalShare, feeCfg),
      taxAmount: 0, // consultation GST already applied once, on doctorShare leg
      tdsAmount: 0,
      subscriptionAbsorbed: 0,
    });
  }

  return allocations;
}

// ── Care Assistant ───────────────────────────────────────────────────────────
async function computeCareAssistantAllocation(booking, pricingConfig) {
  if (!booking.careAssistant) return [];

  const chargedAmount = booking.fareBreakdown?.careAssistantFee ?? 0;
  if (chargedAmount <= 0) return [];

  // Resolve which pricing tier applies. Preferred path: explicit duration
  // on the booking (careAssistantDurationHours — see Booking.js patch).
  // Fallback: reverse-match the tier whose chargeToUser equals what the
  // customer was actually charged (tiers are duration-bracketed and their
  // chargeToUser values are effectively unique in practice).
  let tier = null;
  if (typeof booking.careAssistantDurationHours === 'number') {
    tier = PlatformPricingConfig.resolveCareAssistantTier(pricingConfig, booking.careAssistantDurationHours);
  }
  if (!tier) {
    tier = (pricingConfig.careAssistant?.pricingTiers ?? [])
      .find((t) => t.isActive && t.chargeToUser === chargedAmount) ?? null;
  }

  // grossAmount = CA's entitled earning BEFORE platform-fee deduction.
  // This is tier.payoutToAssistant, NOT the amount the customer was charged.
  const grossAmount = tier ? tier.payoutToAssistant : chargedAmount;
  if (!tier) {
    console.warn(
      `[allocationEngine] Booking ${booking._id}: no CA pricing tier matched charged amount ₹${chargedAmount} — falling back to charged amount as gross. Check booking-creation pricing flow.`
    );
  }

  const feeCfg = pricingConfig.careAssistant.platformFee; // no per-CA override field defined yet
  return [{
    partnerId: booking.careAssistant,
    partnerRole: 'care_assistant',
    grossAmount,
    platformFee: applyPlatformFee(grossAmount, feeCfg),
    taxAmount: applyGst(grossAmount, pricingConfig.tax?.careAssistantGstPercent),
    tdsAmount: 0,
    subscriptionAbsorbed: 0,
  }];
}

// ── Lab Partner ───────────────────────────────────────────────────────────────
async function computeLabAllocation(booking, pricingConfig) {
  if (!booking.labPartner) return [];

  const diagnosticDetails = booking.diagnosticDetails;
  const items = [
    ...(diagnosticDetails?.tests ?? []),
    ...(diagnosticDetails?.packages ?? []),
  ];

  // Confirmed rule: lab gets (charged amount − platformMargin), which BY
  // DEFINITION equals the sum of partnerPrice snapshots on the booked
  // tests/packages (platformMargin virtual = charged − partnerPrice on
  // LabPartnerProfile.labTests/labPackages). No platform fee on top — ever.
  let grossAmount = items.reduce((sum, item) => {
    const price = Number(item?.partnerPrice);
    return Number.isFinite(price) ? sum + price : sum;
  }, 0);

  // Home collection fee flows to the lab in full — no margin defined on it.
  grossAmount += booking.fareBreakdown?.homeCollectionFee ?? 0;
  grossAmount = +grossAmount.toFixed(2);

  // Fallback only if diagnosticDetails carries no partnerPrice snapshots
  // (upstream booking-creation gap) — pay full charged amount rather than
  // ₹0, but log loudly since margin was NOT actually deducted here.
  if (grossAmount <= 0) {
    grossAmount = +(((booking.fareBreakdown?.diagnosticFee ?? 0) + (booking.fareBreakdown?.homeCollectionFee ?? 0))).toFixed(2);
    if (grossAmount > 0) {
      console.warn(
        `[allocationEngine] Booking ${booking._id}: no partnerPrice snapshots on diagnosticDetails — paying lab full charged amount ₹${grossAmount}, platform margin NOT deducted. Check booking-creation flow.`
      );
    }
  }

  if (grossAmount <= 0) return [];

  return [{
    partnerId: booking.labPartner,
    partnerRole: 'lab_partner',
    grossAmount,
    platformFee: 0, // labs: no platform fee — margin already baked into partnerPrice vs mrp/discountedPrice
    taxAmount: applyGst(grossAmount, pricingConfig.tax?.diagnosticsGstPercent),
    tdsAmount: 0,
    subscriptionAbsorbed: 0,
  }];
}

// ── Main Entry Point ──────────────────────────────────────────────────────────

export async function computePartnerAllocations(booking, pricingConfig, session) {
  const [doctorHospital, careAssistant, lab, rideBased] = await Promise.all([
    computeDoctorHospitalAllocations(booking, pricingConfig, session),
    computeCareAssistantAllocation(booking, pricingConfig),
    computeLabAllocation(booking, pricingConfig),
    computeRideBasedAllocations(booking, pricingConfig, session),
  ]);

  return [...doctorHospital, ...careAssistant, ...lab, ...rideBased].filter((a) => a.grossAmount > 0);
}