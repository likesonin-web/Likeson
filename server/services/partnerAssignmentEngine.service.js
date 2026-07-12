/**
 * partnerAssignmentEngine.service.js — Likeson.in
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIX LOG (this pass) — cross-checked against every real call site in
 * bookingRouterDriver.js, rideRequestRouter.js, bookingRouterMisc.js:
 *
 * FIX 1 — validateMinimumLeadTime(): callers pass the RAW req.body value
 * (string), but this required `instanceof Date` and threw on every
 * single call. It also never returned the parsed date, so every
 * `scheduledDate = validateMinimumLeadTime(scheduledAt)` assignment
 * produced `undefined`. Now accepts string|number|Date and returns the
 * parsed Date.
 *
 * FIX 2 — activateReturnRide(): only assigned a driver — never computed
 * the route or created RouteVersion/RideStop/RideTracking for the
 * return leg, yet the caller destructures `distanceKm`/`durationMin`/
 * `polyline` from its result. Return rides had no stops, no tracking
 * doc, and no polyline. Now builds the full route + stop graph exactly
 * like every other ride-creation path, and returns those fields flat.
 *
 * FIX 3 — cancelBookingFully(): used Ride.updateMany() to cancel linked
 * rides, which bypasses Ride's post('save') hook that frees the
 * assigned Driver/SoloDriverPartner — they were left stuck "On-Trip"
 * forever. Also hardcoded subscriptionRecovery:null instead of calling
 * recoverSubscriptionUsageOnCancel(). Both fixed; also now frees the
 * assigned care assistant and cancels the linked OutPatientRecord.
 *
 * FIX 4 — findNearbyDrivers(): TP zone-match (tier A) didn't check
 * isOnboardingComplete; tier C's "show everyone" fallback for TP didn't
 * check activeDrivers>0 (tier B did). Now consistent across all 3
 * tiers.
 *
 * FIX 5 — autoAssignNearestDriver(): removed dead/unreachable "TP-only
 * match" branch inside the retry loop — nearestCandidate can never
 * return partnerType 'tp' (only solo/agency), so that branch never ran.
 *
 * FIX 6 — findNearbyDrivers(): UPDATED FOR NEW SOLO DRIVER SCHEMA. 
 * Live GPS (`location`) and distance calculations are now executed directly 
 * against the `SoloDriverPartner` collection. The removed `vehicleStatus` 
 * cache is bypassed, and the live `Vehicle` doc is fetched manually by 
 * `ownerId` to construct the result object.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. Nearby TP / Solo driver matching — pickup city/pincode match first;
 * falls back to 30km radius; if STILL zero matches, returns ALL
 * active/onboarded partners system-wide, uncapped, sorted by distance
 * (never an empty result to the caller).
 * 2. Automatic reassignment on partner rejection — tries the next nearest
 * eligible candidate automatically. If none found after exhausting
 * candidates, ride is marked `no_driver_found` and flagged for MANUAL
 * admin assignment.
 * 3. Cancellation refund resolution — doctor-cancelled bookings are ALWAYS
 * refunded 100%. Customer-cancelled bookings follow the 12-hour rule.
 * 4. Minimum lead time enforcement — bookings must be >=12h from now.
 * 5/6. accept->confirm and completion->status sync are enforced at call
 * sites (see the routers) — nothing to do in this file.
 * 7. Partner trip stats — every completed ride adds to the assigned
 * partner's cumulative distanceKm + hoursWorked + trip count.
 * 8. Return-ride chaining flows through the same nearby-match +
 * auto-reassign pipeline instead of hard-forcing the outbound driver.
 */

import mongoose from 'mongoose';

import Ride                 from '../models/Ride.js';
import Booking               from '../models/Booking.js';
import RideTracking          from '../models/RideTracking.js';
import RideStop              from '../models/RideStop.js';
import RouteVersion          from '../models/RouteVersion.js';
import Driver                from '../models/Driver.js';
import SoloDriverPartner     from '../models/SoloDriverPartner.js';
import TransportPartner      from '../models/TransportPartner.js';
import Vehicle                from '../models/Vehicle.js';
import User                   from '../models/User.js';
import AssignmentHistory      from '../models/AssignmentHistory.js';
import Consultation           from '../models/Consultation.js';
import CareAssistantProfile   from '../models/CareAssistantProfile.js';
import Hospital                from '../models/Hospital.js';
import OutPatientRecord        from '../models/OutPatientRecord.js';

import { getBookingSocketService } from './bookingSocketService.js';
import sendEmail                   from '../utils/sendEmail.js';
import { transactionalTemplate }   from '../utils/emailTemplates.js';

// ── Constants ─────────────────────────────────────────────────────────────────

export const MIN_BOOKING_LEAD_HOURS = 12;
export const CANCEL_FULL_REFUND_THRESHOLD_HOURS = 12; // >= this => 100%, else 50%
export const NEARBY_DEFAULT_RADIUS_M = 30_000; // existing CARE_RIDE_RADIUS_M
export const MAX_AUTO_REASSIGN_ATTEMPTS = 5;   // safety cap before forcing manual

const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ═════════════════════════════════════════════════════════════════════════════
// (4) MINIMUM LEAD TIME
// ═════════════════════════════════════════════════════════════════════════════

export const validateMinimumLeadTime = (scheduledAtInput, minHours = MIN_BOOKING_LEAD_HOURS) => {
  const scheduledDate = scheduledAtInput instanceof Date ? scheduledAtInput : new Date(scheduledAtInput);

  if (isNaN(scheduledDate.getTime())) {
    const err = new Error('Invalid scheduledAt date');
    err.statusCode = 400;
    err.code = 'INVALID_SCHEDULED_AT';
    throw err;
  }

  const minAllowed = new Date(Date.now() + minHours * 60 * 60 * 1000);
  if (scheduledDate < minAllowed) {
    const err = new Error(
      `Bookings must be made at least ${minHours} hours in advance. Earliest allowed slot: ${minAllowed.toLocaleString('en-IN')}`,
    );
    err.statusCode = 400;
    err.code = 'MIN_LEAD_TIME_VIOLATION';
    throw err;
  }

  return scheduledDate;
};

// ═════════════════════════════════════════════════════════════════════════════
// (3) CANCELLATION REFUND RESOLUTION
// ═════════════════════════════════════════════════════════════════════════════

export const resolveCancellationRefund = (booking, cancelledBy) => {
  const totalAmount = booking.fareBreakdown?.totalAmount ?? 0;

  if (['doctor', 'hospital', 'admin', 'system'].includes(cancelledBy)) {
    return {
      refundPercent: 100,
      refundAmount: +totalAmount.toFixed(2),
      reason: `${cancelledBy}-initiated cancellation — full refund per policy`,
    };
  }

  // customer
  let refundPercent = 100;
  if (booking.scheduledAt) {
    const hoursUntil = (new Date(booking.scheduledAt) - new Date()) / (1000 * 60 * 60);
    refundPercent = hoursUntil >= CANCEL_FULL_REFUND_THRESHOLD_HOURS ? 100 : 50;
  }
  const refundAmount = +((totalAmount * refundPercent) / 100).toFixed(2);
  return {
    refundPercent,
    refundAmount,
    reason:
      refundPercent === 100
        ? `Cancelled >= ${CANCEL_FULL_REFUND_THRESHOLD_HOURS}h before scheduled time — full refund`
        : `Cancelled < ${CANCEL_FULL_REFUND_THRESHOLD_HOURS}h before scheduled time — 50% refund per policy`,
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// (1) NEARBY PARTNER MATCHING
// ═════════════════════════════════════════════════════════════════════════════

const buildZoneOrClauses = (city, pincode) => {
  const clauses = [];
  if (city) clauses.push({ 'serviceZones.city': { $regex: `^${city}$`, $options: 'i' } });
  if (pincode) clauses.push({ 'serviceZones.pinCodes': pincode });
  return clauses;
};

const tpHasActiveDrivers = (tp) => (tp.fleetInfo?.activeDrivers ?? 0) > 0;

export const findNearbyDrivers = async ({
  pickupCoords,
  pickupCity,
  pickupPincode,
  partnerType = 'all',
  excludeDriverIds = [],
  excludeSoloIds = [],
  excludeTpIds = [],
}) => {
  if (!pickupCoords?.length) throw new Error('pickupCoords required');
  const [lng, lat] = pickupCoords;
  const radiusRad = NEARBY_DEFAULT_RADIUS_M / 1000 / 6378.1;

  const wantSolo   = partnerType === 'all' || partnerType === 'solo';
  const wantAgency = partnerType === 'all' || partnerType === 'agency';
  const wantTp     = partnerType === 'all' || partnerType === 'tp';

  const zoneClauses = buildZoneOrClauses(pickupCity, pickupPincode);

  // Directly shapes Solo Partners based on the updated schema
  const shapeSolo = async (partners) => {
    if (!partners || partners.length === 0) return [];
    
    // Fetch all associated vehicles in one batch
    const partnerIds = partners.map(p => p._id);
    const vehicles = await Vehicle.find({ ownerType: 'SoloDriverPartner', ownerId: { $in: partnerIds } }).lean();

    const results = partners.map((sp) => {
      if (excludeSoloIds.includes(String(sp._id))) return null;
      
      const vehicle = vehicles.find(v => String(v.ownerId) === String(sp._id));

      return {
        partnerType: 'solo',
        soloPartnerId: sp._id,
        name: sp.legalName,
        phone: sp.phone,
        rating: sp.rating?.averageRating ?? 0,
        vehicle: vehicle ? {
          vehicleId: vehicle._id,
          registrationNumber: vehicle.registrationNumber,
          make: vehicle.make,
          model: vehicle.model,
        } : {
          vehicleId: null,
          registrationNumber: 'N/A',
          make: 'Unknown', model: 'Unknown'
        },
        // Calculate distance from the SoloDriverPartner's location field, not the vehicle
        distanceKm: sp.location?.coordinates?.length === 2
          ? +haversineKm(pickupCoords, sp.location.coordinates).toFixed(2)
          : 0,
      };
    });
    return results.filter(Boolean);
  };

  const shapeAgency = async (drivers) => {
    return drivers
      .filter((d) => !excludeDriverIds.includes(String(d._id)))
      .map((d) => ({
        partnerType: 'agency',
        driverId: d._id,
        agencyId: d.ownerAgency?._id || d.ownerAgency,
        agencyName: d.ownerAgency?.businessName,
        name: d.legalName,
        phone: d.phone,
        rating: d.performance?.rating ?? 0,
        vehicle: d.assignedVehicleSnapshot,
        distanceKm: d.location?.coordinates?.length === 2 
          ? +haversineKm(pickupCoords, d.location.coordinates).toFixed(2)
          : 0,
      }));
  };

  let soloResults = [], agencyResults = [], tpResults = [];
  let strategy = null;

  // STRATEGY A: Zone Match
  if (zoneClauses.length) {
    if (wantSolo) {
      const activeSolos = await SoloDriverPartner.find({
        partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, 'dispatch.status': 'Available',
        $or: zoneClauses,
      }).select('legalName partnerCode phone serviceZones rating dispatch user location').populate('user', 'name phone').lean();
      
      if (activeSolos.length) {
        soloResults = await shapeSolo(activeSolos);
      }
    }
    if (wantAgency) {
      const agencyIdsInZone = await TransportPartner.find({
        partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, $or: zoneClauses,
      }).select('_id').lean();
      if (agencyIdsInZone.length) {
        const drivers = await Driver.find({
          ownerAgency: { $in: agencyIdsInZone.map((a) => a._id) },
          isActive: true, isVerified: true, isBlocked: false, status: 'Available',
        }).populate('ownerAgency', 'businessName').select('legalName phone location performance assignedVehicleSnapshot ownerAgency').lean();
        agencyResults = await shapeAgency(drivers);
      }
    }
    if (wantTp) {
      const zoneTps = await TransportPartner.find({
        partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, $or: zoneClauses,
      })
        .select('_id businessName ownerPhone fleetInfo')
        .lean();
      tpResults = zoneTps
        .filter((t) => !excludeTpIds.includes(String(t._id)) && tpHasActiveDrivers(t))
        .map((t) => ({ partnerType: 'tp', tpId: t._id, businessName: t.businessName, ownerPhone: t.ownerPhone, activeDrivers: t.fleetInfo?.activeDrivers ?? 0 }));
    }
    if (soloResults.length || agencyResults.length || tpResults.length) {
      strategy = 'pickup_zone_match';
    }
  }

  // STRATEGY B: 30km Radius Match
  if (!strategy) {
    if (wantSolo) {
      // Geo-query directly on SoloDriverPartner.location per new schema
      const activeSolos = await SoloDriverPartner.find({
        partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, 'dispatch.status': 'Available',
        location: { $geoWithin: { $centerSphere: [[lng, lat], radiusRad] } },
      }).select('legalName partnerCode phone serviceZones rating dispatch user location').populate('user', 'name phone').lean();
      
      if (activeSolos.length) {
        soloResults = await shapeSolo(activeSolos);
      }
    }
    if (wantAgency) {
      const drivers = await Driver.find({
        isActive: true, isVerified: true, isBlocked: false, status: 'Available',
        location: { $geoWithin: { $centerSphere: [[lng, lat], radiusRad] } },
      }).populate('ownerAgency', 'businessName').select('legalName phone location performance assignedVehicleSnapshot ownerAgency').lean();
      agencyResults = await shapeAgency(drivers);
    }
    if (wantTp) {
      const tps = await TransportPartner.find({ partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true })
        .select('_id businessName ownerPhone fleetInfo').lean();
      tpResults = tps
        .filter((t) => !excludeTpIds.includes(String(t._id)) && tpHasActiveDrivers(t))
        .map((t) => ({ partnerType: 'tp', tpId: t._id, businessName: t.businessName, ownerPhone: t.ownerPhone, activeDrivers: t.fleetInfo?.activeDrivers ?? 0 }));
    }
    if (soloResults.length || agencyResults.length || tpResults.length) {
      strategy = `radius_${NEARBY_DEFAULT_RADIUS_M / 1000}km`;
    }
  }

  // STRATEGY C: All Partners Fallback
  if (!strategy) {
    if (wantSolo) {
      const activeSolos = await SoloDriverPartner.find({
        partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true, 'dispatch.status': 'Available',
      }).select('legalName partnerCode phone serviceZones rating dispatch user location').populate('user', 'name phone').lean();
      
      if (activeSolos.length) {
        soloResults = await shapeSolo(activeSolos);
      }
    }
    if (wantAgency) {
      const drivers = await Driver.find({ isActive: true, isVerified: true, isBlocked: false, status: 'Available' })
        .populate('ownerAgency', 'businessName').select('legalName phone location performance assignedVehicleSnapshot ownerAgency').lean();
      agencyResults = await shapeAgency(drivers);
    }
    if (wantTp) {
      const tps = await TransportPartner.find({ partnershipStatus: 'active', isAvailable: true, isOnboardingComplete: true })
        .select('_id businessName ownerPhone fleetInfo').lean();
      tpResults = tps
        .filter((t) => !excludeTpIds.includes(String(t._id)) && tpHasActiveDrivers(t))
        .map((t) => ({ partnerType: 'tp', tpId: t._id, businessName: t.businessName, ownerPhone: t.ownerPhone, activeDrivers: t.fleetInfo?.activeDrivers ?? 0 }));
    }
    strategy = 'all_partners_no_match_fallback';
  }

  soloResults.sort((a, b) => a.distanceKm - b.distanceKm);
  agencyResults.sort((a, b) => a.distanceKm - b.distanceKm);

  return {
    strategy,
    solo: soloResults,
    agency: agencyResults,
    tp: tpResults,
    nearestCandidate:
      [...soloResults, ...agencyResults].sort((a, b) => a.distanceKm - b.distanceKm)[0] || null,
  };
};

export const findNearbySoloDrivers = async (params) => {
  return findNearbyDrivers({ ...params, partnerType: 'solo' });
};

export const findNearbyAgencyDrivers = async (params) => {
  return findNearbyDrivers({ ...params, partnerType: 'agency' });
};

// ═════════════════════════════════════════════════════════════════════════════
// (2) AUTOMATIC REASSIGNMENT ON REJECTION  +  (8) RETURN-RIDE CHAINING
// ═════════════════════════════════════════════════════════════════════════════

export const autoAssignNearestDriver = async (
  rideId,
  { excludeSoloIds = [], excludeTpIds = [], reason = 'Automatic reassignment after rejection', performedBy = null } = {},
) => {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new Error('Ride not found');
  if (['completed', 'cancelled'].includes(ride.status)) {
    return { assigned: false, type: null, candidate: null, attempts: 0, reason: `Ride already ${ride.status}` };
  }

  const pickupCoords = ride.pickup?.coordinates;
  const pickupCity   = ride.pickup?.city;
  if (!pickupCoords?.length) throw new Error('Ride has no pickup coordinates');

  const declinedDriverIds = (ride.declinedDrivers || []).map(String);
  let attempts = 0;

  while (attempts < MAX_AUTO_REASSIGN_ATTEMPTS) {
    attempts += 1;
    const candidatePool = await findNearbyDrivers({
      pickupCoords,
      pickupCity,
      partnerType: 'all',
      excludeDriverIds: declinedDriverIds,
      excludeSoloIds,
      excludeTpIds,
    });

    const candidate = candidatePool.nearestCandidate;
    if (!candidate) break; 

    if (candidate.partnerType === 'agency') {
      const driver = await Driver.findOne({
        _id: candidate.driverId, isActive: true, isVerified: true, isBlocked: false, status: 'Available',
      }).lean();
      if (!driver) {
        declinedDriverIds.push(String(candidate.driverId));
        continue;
      }
      ride.driver = driver._id;
      ride.transportPartner = driver.ownerAgency || null;
      ride.soloPartner = null;
      ride.status = 'driver_assigned';
      ride.driverAssignedAt = new Date();
      await ride.save();

      await AssignmentHistory.create({
        ride: ride._id, booking: ride.booking, assignmentType: 'DRIVER',
        entityRefModel: 'Driver', entityRefId: driver._id, action: 'ASSIGNED',
        performedBy: performedBy || null, reason, effectiveAt: new Date(),
      });

      await notifyAutoAssignedDriver({ ride, driverUserId: driver.user, driverName: candidate.name });
      return { assigned: true, type: 'agency', candidate, attempts };
    }

    if (candidate.partnerType === 'solo') {
      const soloPartner = await SoloDriverPartner.findOne({
        _id: candidate.soloPartnerId, partnershipStatus: 'active', isAvailable: true, 'dispatch.status': 'Available',
      }).populate('user', 'name phone').lean();
      if (!soloPartner) {
        excludeSoloIds.push(String(candidate.soloPartnerId));
        continue;
      }
      ride.soloPartner = soloPartner._id;
      ride.driver = null;
      ride.transportPartner = null;
      ride.status = 'driver_assigned';
      ride.driverAssignedAt = new Date();
      await ride.save();

      await SoloDriverPartner.findByIdAndUpdate(soloPartner._id, {
        $set: { 'dispatch.status': 'On-Trip', 'dispatch.currentRide': ride._id, 'dispatch.lastStatusAt': new Date() },
      });

      await AssignmentHistory.create({
        ride: ride._id, booking: ride.booking, assignmentType: 'DRIVER',
        entityRefModel: 'SoloDriverPartner', entityRefId: soloPartner._id, action: 'ASSIGNED',
        performedBy: performedBy || null, reason, effectiveAt: new Date(),
      });

      await notifyAutoAssignedDriver({ ride, driverUserId: soloPartner.user?._id, driverName: soloPartner.legalName });
      return { assigned: true, type: 'solo', candidate, attempts };
    }
  }

  ride.status = 'no_driver_found';
  await ride.save();

  if (ride.booking) {
    getBookingSocketService()?.emitToAdminOps('auto_assign_failed', {
      rideId: String(ride._id), bookingId: String(ride.booking),
      attempts, timestamp: new Date().toISOString(),
      note: 'No available driver/solo partner found after automatic retries — manual admin assignment required.',
    });
  }

  return { assigned: false, type: null, candidate: null, attempts, reason: 'No candidates available after retries' };
};

const notifyAutoAssignedDriver = async ({ ride, driverUserId, driverName }) => {
  try {
    const socketService = getBookingSocketService();
    if (ride.booking) {
      const booking = await Booking.findById(ride.booking).select('customer bookingCode').lean();
      if (driverUserId) socketService?.emitJoinRoom(String(driverUserId), `booking:${ride.booking}`);
      socketService?.emitToRoom(`booking:${ride.booking}`, 'driver_auto_reassigned', {
        bookingId: String(ride.booking), rideId: String(ride._id), driverName, timestamp: new Date().toISOString(),
      });
      if (booking?.customer) {
        const { createNotification } = await import('../routes/bookingRouterShared.js');
        await createNotification({
          recipient: booking.customer, title: 'New Driver Assigned',
          body: `${driverName} has been automatically assigned to your ride.`,
          type: 'Driver_Assigned', bookingId: ride.booking,
        });
      }
    }
  } catch (e) {
    console.error('[notifyAutoAssignedDriver]', e.message);
  }
};

export const handleRideRejection = async (rideId, opts = {}) => {
  const excludeSoloIds = opts.rejectedSoloPartnerId ? [String(opts.rejectedSoloPartnerId)] : [];
  const excludeTpIds   = opts.rejectedTpId ? [String(opts.rejectedTpId)] : [];
  return autoAssignNearestDriver(rideId, {
    excludeSoloIds,
    excludeTpIds,
    reason: opts.reason || 'Automatic reassignment — previous partner rejected',
    performedBy: opts.performedBy || null,
  });
};

export const activateReturnRide = async (returnRideId) => {
  const returnRide = await Ride.findById(returnRideId);
  if (!returnRide) throw new Error('Return ride not found');
  if (returnRide.status !== 'requested') {
    return {
      activated: false, assigned: false, type: null, candidate: null, attempts: 0,
      distanceKm: null, durationMin: null, polyline: null,
      reason: `Return ride already in status ${returnRide.status}`,
    };
  }
  if (!returnRide.pickup?.coordinates?.length || !returnRide.dropoff?.coordinates?.length) {
    throw new Error('Return ride is missing pickup/dropoff coordinates');
  }

  const { calculateCanonicalRoute } = await import('../routes/bookingRouterShared.js');

  const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(
    returnRide.pickup.coordinates,
    returnRide.dropoff.coordinates,
  );
  returnRide.estimatedDistanceKm = distanceKm;
  returnRide.estimatedDurationMin = durationMin;
  await returnRide.save();

  const assignResult = await autoAssignNearestDriver(returnRideId, {
    reason: 'Return-leg dispatch after outbound ride completed',
  });

  const rv = await RouteVersion.create({
    ride: returnRideId,
    versionNumber: 1,
    polyline,
    totalDistanceKm: distanceKm,
    totalDurationMin: durationMin,
    generatedReason: 'INITIAL',
    isActive: true,
  });
  const patStop = await RideStop.create({
    ride: returnRideId,
    booking: returnRide.booking,
    routeVersion: 1,
    sequence: 1,
    stopType: 'PATIENT_PICKUP',
    location: returnRide.pickup,
    status: 'PENDING',
  });
  const hospStop = await RideStop.create({
    ride: returnRideId,
    booking: returnRide.booking,
    routeVersion: 1,
    sequence: 2,
    stopType: 'HOSPITAL',
    location: returnRide.dropoff,
    status: 'PENDING',
  });
  await RouteVersion.findByIdAndUpdate(rv._id, {
    $set: { stops: [patStop._id, hospStop._id] },
  });

  const tracking = await RideTracking.create({
    ride: returnRideId,
    booking: returnRide.booking,
    expectedRoutePolyline: polyline,
    currentStopId: patStop._id,
  });

  await Ride.findByIdAndUpdate(returnRideId, {
    $set: {
      currentStopId: patStop._id,
      activeRouteVersionId: rv._id,
      trackingId: tracking._id,
    },
  });

  return {
    activated: assignResult.assigned,
    assigned: assignResult.assigned,
    type: assignResult.type,
    candidate: assignResult.candidate,
    attempts: assignResult.attempts,
    distanceKm,
    durationMin,
    polyline,
  };
};

// ═════════════════════════════════════════════════════════════════════════════
// (7) PARTNER TRIP / HOURS STATS
// ═════════════════════════════════════════════════════════════════════════════

export const recordPartnerTripCompletion = async (ride) => {
  try {
    const distanceKm = ride.actualDistanceKm || ride.estimatedDistanceKm || 0;
    const startedAt  = ride.rideStartedAt || ride.driverAcceptedAt || ride.driverAssignedAt;
    const endedAt    = ride.rideCompletedAt || new Date();
    const hoursWorked = startedAt
      ? Math.max(0, +((new Date(endedAt) - new Date(startedAt)) / (1000 * 60 * 60)).toFixed(3))
      : 0;

    if (ride.driver) {
      const driver = await Driver.findByIdAndUpdate(
        ride.driver,
        {
          $inc: {
            'performance.totalDistanceKm': distanceKm,
            'performance.totalHoursWorked': hoursWorked,
            'performance.totalRidesCompleted': 1,
          },
          $set: { 'performance.lastRideAt': new Date() },
        },
        { new: true },
      ).select('ownerAgency').lean();

      if (driver?.ownerAgency) {
        await TransportPartner.findByIdAndUpdate(driver.ownerAgency, {
          $inc: {
            'stats.totalDistanceKm': distanceKm,
            'stats.totalHoursWorked': hoursWorked,
            'stats.totalRidesCompleted': 1,
          },
          $set: { 'stats.lastRideAt': new Date() },
        });
      }
    } else if (ride.soloPartner) {
      await SoloDriverPartner.findByIdAndUpdate(ride.soloPartner, {
        $inc: {
          'stats.totalDistanceKm': distanceKm,
          'stats.totalHoursWorked': hoursWorked,
          'stats.totalRidesCompleted': 1,
        },
        $set: { 'stats.lastRideAt': new Date() },
      });
    }

    return { distanceKm, hoursWorked };
  } catch (err) {
    console.error('[recordPartnerTripCompletion] failed:', err.message);
    return { distanceKm: 0, hoursWorked: 0, error: err.message };
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// (3) FULL BOOKING CANCELLATION
// ═════════════════════════════════════════════════════════════════════════════

export const cancelBookingFully = async (bookingId, { cancelledBy, cancelledByUserId, reason }) => {
  const booking = await Booking.findById(bookingId).select('+internalNotes');
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }
  if (['cancelled', 'completed', 'refunded'].includes(booking.status)) {
    const err = new Error(`Cannot cancel booking in status: ${booking.status}`);
    err.statusCode = 400;
    throw err;
  }

  const { createNotification, recoverSubscriptionUsageOnCancel, razorpay } =
    await import('../routes/bookingRouterShared.js');

  const { refundPercent, refundAmount } = resolveCancellationRefund(booking, cancelledBy);
  const prevStatus = booking.status;

  const subscriptionRecovery = await recoverSubscriptionUsageOnCancel(booking).catch((e) => {
    console.error('[cancelBookingFully] subscription recovery failed:', e.message);
    return { recovered: false, reason: e.message };
  });

  booking.status = 'cancelled';
  booking.cancellation = {
    cancelledBy,
    cancelledByUserId,
    reason,
    refundEligible: refundAmount > 0,
    refundPercent,
    cancelledAt: new Date(),
  };
  booking.fareBreakdown.refundAmount = refundAmount;
  booking.statusLog.push({ fromStatus: prevStatus, toStatus: 'cancelled', changedBy: cancelledByUserId, reason });
  booking.updatedBy = cancelledByUserId;
  await booking.save();

  if (booking.rides?.length) {
    const ridesToCancel = await Ride.find({
      _id: { $in: booking.rides },
      status: { $nin: ['completed', 'cancelled'] },
    }).select('_id driver soloPartner').lean();

    if (ridesToCancel.length) {
      await Ride.updateMany(
        { _id: { $in: ridesToCancel.map((r) => r._id) } },
        {
          $set: {
            status: 'cancelled',
            cancellation: { cancelledBy: 'system', reason: `Booking cancelled by ${cancelledBy}`, cancelledAt: new Date() },
          },
        },
      );

      const driverIds = ridesToCancel.filter((r) => r.driver).map((r) => r.driver);
      const soloIds = ridesToCancel.filter((r) => r.soloPartner).map((r) => r.soloPartner);
      if (driverIds.length) {
        await Driver.updateMany({ _id: { $in: driverIds } }, { $set: { status: 'Available', currentRide: null } });
      }
      if (soloIds.length) {
        await SoloDriverPartner.updateMany(
          { _id: { $in: soloIds } },
          { $set: { 'dispatch.status': 'Available', 'dispatch.currentRide': null } },
        );
      }
    }

    await RideStop.updateMany({ ride: { $in: booking.rides }, isActive: true }, { $set: { status: 'SKIPPED', isActive: false } });
  }

  if (booking.consultationSessionId) {
    await Consultation.findByIdAndUpdate(booking.consultationSessionId, { $set: { status: 'cancelled' } }).catch(() => {});
  }

  await OutPatientRecord.findOneAndUpdate({ booking: booking._id }, { $set: { status: 'cancelled' } }).catch(() => {});

  if (booking.careAssistant) {
    await CareAssistantProfile.findOneAndUpdate(
      { _id: booking.careAssistant, currentActiveTask: booking._id },
      { $set: { status: 'Available', currentActiveTask: null } },
    ).catch(() => {});
  }

  try {
    if (refundAmount > 0) {
      const rzpPayment = booking.payments?.find((p) => p.gateway === 'Razorpay' && p.status === 'success');
      if (rzpPayment?.transactionId) {
        await razorpay.payments.refund(rzpPayment.transactionId, {
          amount: Math.round(refundAmount * 100),
          notes: { reason: `Cancelled by ${cancelledBy}`, bookingCode: booking.bookingCode },
        });
        rzpPayment.status = 'refunded';
        rzpPayment.refundedAt = new Date();
      }
      const walletPayment = booking.payments?.find((p) => p.gateway === 'Wallet' && p.status === 'success');
      if (walletPayment) {
        const { default: Wallet } = await import('../models/Wallet.js');
        const wallet = await Wallet.findOne({ user: booking.customer });
        if (wallet) {
          await wallet.credit(refundAmount, 'Refund', {
            referenceId: booking._id, onModel: 'Booking',
            description: `Refund — booking ${booking.bookingCode} cancelled by ${cancelledBy}`,
            initiatedBy: cancelledByUserId,
          });
        }
      }
      booking.paymentStatus = 'refunded';
      await booking.save();
    }
  } catch (refundErr) {
    console.error('[cancelBookingFully] refund execution failed:', refundErr.message);
  }

  await notifyAllPartiesOfCancellation(booking, { cancelledBy, refundAmount, refundPercent, reason }, { createNotification });

  return { booking, refundAmount, refundPercent, subscriptionRecovery };
};

const notifyAllPartiesOfCancellation = async (booking, { cancelledBy, refundAmount, refundPercent, reason }, { createNotification }) => {
  const socketService = getBookingSocketService();

  socketService?.emitToRoom(`booking:${booking._id}`, 'booking_status_change', {
    bookingId: String(booking._id), status: 'cancelled', cancelledBy, refundAmount, refundPercent, timestamp: new Date(),
  });

  await createNotification({
    recipient: booking.customer,
    title: 'Booking Cancelled',
    body: `Booking ${booking.bookingCode} was cancelled by ${cancelledBy}. Refund of ₹${refundAmount} (${refundPercent}%) has been initiated.`,
    type: 'Refund_Processed',
    bookingId: booking._id,
    priority: 'High',
  });

  const customer = await User.findById(booking.customer).select('email name').lean();
  if (customer?.email) {
    sendEmail({
      email: customer.email,
      subject: `Booking Cancelled — #${booking.bookingCode} | Likeson Healthcare`,
      html: transactionalTemplate({
        header: 'BOOKING CANCELLED',
        title: `Your booking was cancelled by ${cancelledBy}`,
        body: `Booking <strong>#${booking.bookingCode}</strong> was cancelled. Reason: ${reason}.<br/>Refund of <strong>₹${refundAmount}</strong> (${refundPercent}%) has been initiated.`,
        buttonLink: `${process.env.FRONTEND_URL}/bookings/${booking._id}`,
        buttonText: 'View Booking',
      }),
    }).catch(() => {});
  }

  if (booking.hospital) {
    const hospital = await Hospital.findById(booking.hospital).populate('managedBy', 'email name').lean();
    if (hospital?.managedBy?.email) {
      sendEmail({
        email: hospital.managedBy.email,
        subject: `Booking Cancelled — #${booking.bookingCode} | Likeson Healthcare`,
        html: transactionalTemplate({
          header: 'BOOKING CANCELLED',
          title: `Booking #${booking.bookingCode} cancelled by ${cancelledBy}`,
          body: `This booking has been cancelled. No further action required.`,
          buttonLink: `${process.env.FRONTEND_URL}/hospital/bookings`,
          buttonText: 'View Bookings',
        }),
      }).catch(() => {});
    }
  }

  if (booking.careAssistant) {
    const ca = await CareAssistantProfile.findById(booking.careAssistant).populate('user', 'email name').lean();
    if (ca?.user) {
      await createNotification({
        recipient: ca.user._id, title: 'Booking Cancelled',
        body: `Booking ${booking.bookingCode} you were assigned to has been cancelled.`,
        type: 'Care_Task_Completed', bookingId: booking._id,
      });
    }
  }

  if (booking.primaryRide) {
    const ride = await Ride.findById(booking.primaryRide).select('driver soloPartner').lean();
    if (ride?.driver) {
      const driver = await Driver.findById(ride.driver).select('user').lean();
      if (driver?.user) {
        await createNotification({
          recipient: driver.user, title: 'Ride Cancelled',
          body: `Booking ${booking.bookingCode} has been cancelled. This ride is no longer active.`,
          type: 'Ride_Update', bookingId: booking._id,
        });
      }
    }
    if (ride?.soloPartner) {
      const sp = await SoloDriverPartner.findById(ride.soloPartner).select('user').lean();
      if (sp?.user) {
        await createNotification({
          recipient: sp.user, title: 'Ride Cancelled',
          body: `Booking ${booking.bookingCode} has been cancelled. This ride is no longer active.`,
          type: 'Ride_Update', bookingId: booking._id,
        });
      }
    }
  }
};

export default {
  MIN_BOOKING_LEAD_HOURS,
  CANCEL_FULL_REFUND_THRESHOLD_HOURS,
  validateMinimumLeadTime,
  resolveCancellationRefund,
  findNearbyDrivers,
  findNearbySoloDrivers, 
  findNearbyAgencyDrivers,
  autoAssignNearestDriver,
  handleRideRejection,
  activateReturnRide,
  recordPartnerTripCompletion,
  cancelBookingFully,
};