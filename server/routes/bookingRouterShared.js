import crypto from "crypto";
import axios from "axios";
import Razorpay from "razorpay";

import sendEmailUtil from "../utils/sendEmail.js";
import {
  transactionalTemplate as _transactionalTemplate,
  otpTemplate as _otpTemplate,
} from "../utils/emailTemplates.js";

// ── Model imports ─────────────────────────────────────────────────────────────
import Booking from "../models/Booking.js";
import Ride from "../models/Ride.js";
import RideTracking from "../models/RideTracking.js";
import User from "../models/User.js";
import Driver from "../models/Driver.js";
import SoloDriverPartner from "../models/SoloDriverPartner.js";
import TransportPartner from "../models/TransportPartner.js";
import CareAssistantProfile from "../models/CareAssistantProfile.js";
import DoctorProfile from "../models/DoctorProfile.js";
import Hospital from "../models/Hospital.js";
import LabPartnerProfile from "../models/LabPartnerProfile.js";
import Notification from "../models/Notification.js";
import SystemLog from "../models/SystemLog.js";
import OutPatientRecord from "../models/OutPatientRecord.js";
import UserSubscription from "../models/UserSubscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import Wallet from "../models/Wallet.js";
import PlatformPricingConfig from "../models/PlatformPricingConfig.js";

// ── Re-exports ────────────────────────────────────────────────────────────────
export {
  Booking,
  Ride,
  RideTracking,
  User,
  Driver,
  SoloDriverPartner,
  TransportPartner,
  CareAssistantProfile,
  DoctorProfile,
  Hospital,
  LabPartnerProfile,
  Notification,
  SystemLog,
  OutPatientRecord,
  UserSubscription,
  SubscriptionPlan,
  Wallet,
  PlatformPricingConfig,
};

export { default as sendEmail } from "../utils/sendEmail.js";
export { default as sendSms } from "../services/Sendsms.js";
export { generateBookingInvoicePdf } from "../utils/bookingInvoiceGenerator.js";
export { getBookingSocketService } from "../services/bookingSocketService.js";
export { transactionalTemplate, otpTemplate } from "../utils/emailTemplates.js";
export {
  rideBookedSms,
  driverAssignedSms,
  rideStartedSms,
  rideCompletedSms,
  rideCancelledSms,
  careAssistantAssignedSms,
  appointmentConfirmedSms,
  otpSms,
  paymentSuccessfulSms,
  newCareRequestToAssistantSms,
} from "../utils/Smstemplates.js";
export { protect, authorize } from "../middleware/authMiddleware.js";

// ── Razorpay ──────────────────────────────────────────────────────────────────
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_KM_RATE = 21;

export const RIDE_STATUSES_ACTIVE = [
  "driver_assigned",
  "driver_accepted",
  "driver_en_route",
  "driver_arrived",
  "otp_verified",
  "in_progress",
  "at_stop",
];

export const RADIUS_METERS = 100_000;
export const CARE_RIDE_RADIUS_M = 30_000;
export const TRANSPORT_RADIUS_M = 100_000;

export const CUSTOMER_BOOKING_TYPES = [
  "full_care_ride",
  "doctor_consultation",
  "doctor_online",
  "physiotherapist",
  "care_assistant",
  "diagnostic_center",
  "diagnostic_home",
  "patient_transport",
  "follow_up",
];

// ─────────────────────────────────────────────────────────────────────────────
// FIX D — FAMILY-AWARE SUBSCRIPTION LOOKUP
// Single module-level helper used by all subscription check functions.
// First checks if userId is a primary holder; falls back to memberEmail lookup
// so family plan members get full subscription benefits.
// ─────────────────────────────────────────────────────────────────────────────

const findActiveSub = async (userId) => {
  // 1. Primary holder check
  const primarySub = await UserSubscription.findOne({
    user: userId,
    status: { $in: ["Active", "Trial"] },
    expiryDate: { $gt: new Date() },
  }).lean();
  if (primarySub) return primarySub;

  // 2. Family member fallback — look up user's email then query members array
  const user = await User.findById(userId).select("email").lean();
  if (!user?.email) return null;

  const email = user.email.toLowerCase().trim();
  const localStripped =
    email.split("@")[0].replace(/\./g, "") + "@" + email.split("@")[1];

  return UserSubscription.findOne({
    "members.memberEmail": { $in: [email, localStripped] },
    status: { $in: ["Active", "Trial"] },
    expiryDate: { $gt: new Date() },
  }).lean();
};

// ─────────────────────────────────────────────────────────────────────────────
// sendBookingConfirmationEmail
// ─────────────────────────────────────────────────────────────────────────────

export const sendBookingConfirmationEmail = async ({
  user,
  booking,
  consultationFee,
  isCoveredBySubscription,
  opNumber,
  doctorName,
  hospitalName,
  scheduledAt,
}) => {
  try {
    const u = await User.findById(user).select("email name").lean();
    if (!u) {
      console.warn("[sendBookingConfirmationEmail] User not found:", user);
      return;
    }
    if (!u.email) {
      console.warn("[sendBookingConfirmationEmail] No email for user:", u._id);
      return;
    }

    const fmtDate = (d) =>
      new Date(d).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    const fmtRs = (n) =>
      `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

    const html = _transactionalTemplate({
      header: "BOOKING CONFIRMED",
      title: `Appointment Confirmed — ${opNumber || booking.bookingCode}`,
      body: `
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#374151;">
          <tr><td style="padding:6px 0;color:#6b7280;">Booking Code</td>
              <td style="text-align:right;font-weight:700;font-family:monospace;">#${booking.bookingCode}</td></tr>
          ${
            opNumber
              ? `<tr><td style="padding:6px 0;color:#6b7280;">OP Number</td>
              <td style="text-align:right;font-weight:700;font-family:monospace;">${opNumber}</td></tr>`
              : ""
          }
          ${
            doctorName
              ? `<tr><td style="padding:6px 0;color:#6b7280;">Doctor</td>
              <td style="text-align:right;font-weight:600;">${doctorName}</td></tr>`
              : ""
          }
          ${
            hospitalName
              ? `<tr><td style="padding:6px 0;color:#6b7280;">Hospital</td>
              <td style="text-align:right;font-weight:600;">${hospitalName}</td></tr>`
              : ""
          }
          <tr><td style="padding:6px 0;color:#6b7280;">Scheduled At</td>
              <td style="text-align:right;font-weight:600;">${fmtDate(scheduledAt)}</td></tr>
          <tr><td style="padding:6px 0;border-top:1px solid #f1f5f9;color:#6b7280;">Consultation Fee</td>
              <td style="text-align:right;font-weight:800;color:${isCoveredBySubscription ? "#15803d" : "#0f3460"};">
                ${isCoveredBySubscription ? "FREE (Subscription)" : fmtRs(consultationFee)}
              </td></tr>
        </table>
        ${
          isCoveredBySubscription
            ? `
        <div style="margin-top:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 14px;">
          <p style="margin:0;font-size:12px;color:#15803d;font-weight:600;">
            ✓ This consultation is covered by your subscription plan.
          </p>
        </div>`
            : ""
        }
      `,
      buttonLink: `${process.env.FRONTEND_URL || "https://likeson.in"}/my-bookings/${booking._id}`,
      buttonText: "View Booking",
    });

    await sendEmailUtil({
      email: u.email,
      subject: `Booking Confirmed — ${booking.bookingCode}`,
      html,
    });
  } catch (err) {
    console.error("[sendBookingConfirmationEmail] ❌ failed:", err.message);
  }
};

export const calculateEtaMinutes = (distanceKm, avgSpeed = 28) => {
  if (!distanceKm || distanceKm <= 0) return 0;
  return Math.ceil((distanceKm / avgSpeed) * 60);
};

export const findNearestHospital = async (coordinates) => {
  try {
    const hospitals = await Hospital.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates },
          $maxDistance: 30000,
        },
      },
    })
      .limit(1)
      .lean();

    if (!hospitals.length) return null;

    const hospital = hospitals[0];
    const distanceKm = haversineKm(coordinates, hospital.location.coordinates);

    return {
      hospital,
      distanceKm,
      etaMinutes: calculateEtaMinutes(distanceKm),
    };
  } catch (err) {
    console.error("[findNearestHospital]", err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BASIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const genOtp = () => crypto.randomInt(100_000, 999_999).toString();

export const hashOtp = (otp) =>
  crypto
    .createHmac("sha256", process.env.OTP_SECRET || "likeson-otp-secret")
    .update(String(otp).trim())
    .digest("hex");

export const haversineKm = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const createNotification = async ({
  recipient,
  title,
  body,
  type,
  bookingId,
  priority = "Medium",
  otp = undefined,
  actionUrl = undefined,
  deepLink = undefined,
}) => {
  try {
    await Notification.create({
      recipient,
      title,
      body,
      type,
      priority,
      ...(otp ? { otp } : {}),
      ...(actionUrl ? { actionUrl } : {}),
      ...(deepLink ? { deepLink } : {}),
      relatedEntityType: "Booking",
      relatedEntityId: bookingId,
      channels: [{ channel: "InApp" }, { channel: "Push" }],
    });
  } catch (e) {
    console.error("[createNotification]", e.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING STATUS SYNC
// ─────────────────────────────────────────────────────────────────────────────

export const syncBookingStatusFromRide = async (
  bookingId,
  rideStatus,
  updatedBy,
) => {
  const MAP = {
    driver_assigned: "confirmed",
    driver_accepted: "confirmed",
    driver_en_route: "confirmed",
    driver_arrived: "confirmed",
    otp_verified: "in_progress",
    in_progress: "in_progress",
    at_stop: "in_progress",
    completed: "completed",
  };
  const newStatus = MAP[rideStatus];
  if (!newStatus) return null;
  return Booking.findByIdAndUpdate(
    bookingId,
    { $set: { status: newStatus, updatedBy } },
    { new: true },
  )
    .select("_id status bookingCode")
    .lean();
};

// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL ROUTE CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────

const GMAPS_KEY = process.env.GOOGLE_MAPS_KEY;

export const calculateCanonicalRoute = async (pickupCoords, dropoffCoords) => {
  const safePickup = pickupCoords || [80.648, 16.506];
  const safeDropoff = dropoffCoords || [80.648, 16.506];

  if (!GMAPS_KEY) {
    const dist = haversineKm(safePickup, safeDropoff);
    return {
      distanceKm: +dist.toFixed(2),
      durationMin: Math.round(dist * 3),
      polyline: null,
    };
  }

  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/directions/json",
      {
        params: {
          origin: `${safePickup[1]},${safePickup[0]}`,
          destination: `${safeDropoff[1]},${safeDropoff[0]}`,
          mode: "driving",
          key: GMAPS_KEY,
        },
        timeout: 8000,
      },
    );
    const route = res.data?.routes?.[0];
    if (!route) throw new Error("No route returned");
    const leg = route.legs[0];
    return {
      distanceKm: +(leg.distance.value / 1000).toFixed(2),
      durationMin: Math.round(leg.duration.value / 60),
      polyline: route.overview_polyline.points,
    };
  } catch (err) {
    console.error(
      "[calculateCanonicalRoute] GMaps fail → haversine fallback:",
      err.message,
    );
    const dist = haversineKm(safePickup, safeDropoff);
    return {
      distanceKm: +dist.toFixed(2),
      durationMin: Math.round(dist * 3),
      polyline: null,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RIDE PAYLOAD BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export const buildRidePayload = ({
  bookingId,
  rideType,
  vehicleClass,
  pickupCoords,
  pickupAddress = "",
  pickupCity = "",
  dropoffCoords,
  dropoffAddress = "",
  dropoffCity = "",
  scheduledPickupAt,
  isReturnRide = false,
  createdBy,
  rideStage = "searching_driver",
}) => ({
  booking: bookingId,
  rideType,
  vehicleClass,
  isReturnRide,
  pickup: {
    type: "Point",
    coordinates: pickupCoords,
    address: pickupAddress,
    city: pickupCity,
  },
  dropoff: {
    type: "Point",
    coordinates: dropoffCoords,
    address: dropoffAddress,
    city: dropoffCity,
  },
  scheduledPickupAt,
  status: "requested",
  createdBy,
  rideStage,
  // NOTE: no waypoints / activeNavigationTarget — both removed from Ride
  // schema in the architecture redesign. currentStopId + activeRouteVersionId
  // are set by the caller AFTER RouteVersion/RideStop docs are created
  // (see every assign-driver / request-ride route for the pattern).
});

// ─────────────────────────────────────────────────────────────────────────────
// createAndLinkRide
//
// FIX: was pre-redesign leftover — wrote `pickupOtp` (field removed from
// Ride schema; OTP now lives per-stop on RideStop.otp) and never created
// RouteVersion / RideStop docs, so any ride made through this helper had no
// currentStopId — the driver app would have nothing to navigate to. Rebuilt
// to match the pattern used everywhere else (tp/assign-driver,
// assign/solo-driver, request-ride): RouteVersion → 2 RideStops →
// currentStopId + activeRouteVersionId set on the Ride.
// ─────────────────────────────────────────────────────────────────────────────

export const createAndLinkRide = async (booking, overrides = {}) => {
  const coords = {
    pickupCoords: booking.patientLocation?.coordinates || [80.648, 16.506],
    pickupAddress: booking.patientLocation?.address || "",
    pickupCity: booking.patientLocation?.city || "",
    dropoffCoords: booking.destinationLocation?.coordinates || [80.648, 16.506],
    dropoffAddress: booking.destinationLocation?.address || "",
    dropoffCity: booking.destinationLocation?.city || "",
  };

  const otp = genOtp();

  const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(
    coords.pickupCoords,
    coords.dropoffCoords,
  );

  const ride = await Ride.create({
    ...buildRidePayload({
      bookingId: booking._id,
      rideType: "patient",
      vehicleClass: "four_wheeler",
      scheduledPickupAt: booking.scheduledAt,
      ...coords,
    }),
    estimatedDistanceKm: distanceKm,
    estimatedDurationMin: durationMin,
    ...overrides,
  });

  const RouteVersion = (await import("../models/RouteVersion.js")).default;
  const RideStop = (await import("../models/RideStop.js")).default;

  const rv = await RouteVersion.create({
    ride: ride._id,
    versionNumber: 1,
    polyline,
    totalDistanceKm: distanceKm,
    totalDurationMin: durationMin,
    generatedReason: "INITIAL",
    isActive: true,
  });

  const patientStop = await RideStop.create({
    ride: ride._id,
    booking: booking._id,
    routeVersion: 1,
    sequence: 1,
    stopType: "PATIENT_PICKUP",
    location: {
      type: "Point",
      coordinates: coords.pickupCoords,
      address: coords.pickupAddress,
    },
    status: "PENDING",
    otp: { code: hashOtp(otp), generatedAt: new Date() },
  });

  const hospitalStop = await RideStop.create({
    ride: ride._id,
    booking: booking._id,
    routeVersion: 1,
    sequence: 2,
    stopType: "HOSPITAL",
    location: {
      type: "Point",
      coordinates: coords.dropoffCoords,
      address: coords.dropoffAddress,
    },
    status: "PENDING",
  });

  await RouteVersion.findByIdAndUpdate(rv._id, {
    $set: { stops: [patientStop._id, hospitalStop._id] },
  });

  const tracking = await RideTracking.create({
    ride: ride._id,
    booking: booking._id,
    expectedRoutePolyline: polyline,
    currentStopId: patientStop._id,
  });

  await Ride.findByIdAndUpdate(ride._id, {
    $set: {
      trackingId: tracking._id,
      currentStopId: patientStop._id,
      activeRouteVersionId: rv._id,
    },
  });

  await Booking.findByIdAndUpdate(booking._id, {
    $push: { rides: ride._id },
    $set: { primaryRide: ride._id, status: "confirmed" },
  });

  return { ride, otp, distanceKm, durationMin, polyline };
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT / FARE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const resolveKmRate = async (userId) => {
  const config = await PlatformPricingConfig.getGlobal();
  const configRate = config?.transport?.defaultRatePerKm ?? DEFAULT_KM_RATE;

  // FIX D: use family-aware lookup
  const sub = await findActiveSub(userId);

  if (!sub) return { ratePerKm: configRate, source: "default" };

  const planRate = sub.limits?.transportRatePerKm;

  // FIX: no more re-digging into SubscriptionPlan doc as a fallback.
  // sub.limits was snapshotted at subscribe time (snapshotLimits) and IS
  // the source of truth for whether transport is a benefit on THIS sub.
  // null = no transport benefit at all (fixed plan w/o transport, or
  // custom plan w/o transport option chosen) → ALWAYS platform default,
  // regardless of plan type (fixed or custom).
  if (planRate == null) return { ratePerKm: configRate, source: "default" };

  // Fixed-plan flat rate, snapshotted >0 → benefit applies.
  if (planRate > 0) return { ratePerKm: planRate, source: "subscription" };

  // Custom-plan sentinel -1 → resolve slab live from config using
  // ridesPerMonth quantity chosen at plan-creation time.
  if (planRate === -1) {
    const slabs = config?.customPlanOptions?.transport?.kmSlabs ?? [];
    const qty = sub.limits?.transportRidesPerMonth ?? 0;
    const slabIdx = Math.max(0, Math.min(Math.floor(qty), slabs.length - 1));
    const slab = slabs[slabIdx];
    if (slab?.pricePerKm > 0)
      return { ratePerKm: slab.pricePerKm, source: "subscription" };
  }

  return { ratePerKm: configRate, source: "default" };
};

export const resolveCareRideKmRate = async (userId) => {
  const { ratePerKm, source } = await resolveKmRate(userId);
  if (source === "subscription") return { ratePerKm, source };
  const config = await PlatformPricingConfig.getGlobal();
  const careRate = config?.transport?.careRideRatePerKm ?? 21;
  return { ratePerKm: careRate, source: "care_ride_config" };
};

export const computeLegFare = ({
  distanceKm,
  ratePerKm,
  waitingMinutes = 0,
  freeWaitingMinutes = 5,
  waitingRatePerMin = 2,
  baseFare = 0,
  isNight = false,
  nightSurchargeMultiplier = 1.2,
  isWheelchair = false,
  wheelchairSurchargeAmount = 0,
}) => {
  const distanceFare = +(distanceKm * ratePerKm).toFixed(2);
  const billableWait = Math.max(0, waitingMinutes - freeWaitingMinutes);
  const waitingCharge = +(billableWait * waitingRatePerMin).toFixed(2);
  const subtotal = baseFare + distanceFare + waitingCharge;
  const nightSurcharge = isNight
    ? +(subtotal * (nightSurchargeMultiplier - 1)).toFixed(2)
    : 0;
  const wheelchairFee = isWheelchair ? wheelchairSurchargeAmount : 0;
  const totalFare = +(subtotal + nightSurcharge + wheelchairFee).toFixed(2);
  return {
    distanceFare,
    waitingCharge,
    nightSurcharge,
    wheelchairSurcharge: wheelchairFee,
    totalFare,
  };
};

export const resolveTransportFare = ({
  bookingType,
  pickupCoords,
  dropoffCoords,
  ratePerKm,
  includeReturn = false,
  waitingMinutes = 0,
  freeWaitingMinutes = 5,
  waitingRatePerMin = 2,
  isNight = false,
  isWheelchair = false,
  wheelchairSurchargeAmount = 0,
}) => {
  const distanceKm = haversineKm(pickupCoords, dropoffCoords);
  const legParams = {
    distanceKm,
    ratePerKm,
    isNight,
    isWheelchair,
    wheelchairSurchargeAmount,
    freeWaitingMinutes,
    waitingRatePerMin,
  };
  const outbound = computeLegFare({
    ...legParams,
    waitingMinutes: bookingType === "patient_transport" ? waitingMinutes : 0,
  });
  const returnLeg = includeReturn
    ? computeLegFare({ ...legParams, waitingMinutes: 0 })
    : null;
  return {
    distanceKm: +distanceKm.toFixed(2),
    ratePerKm,
    outbound,
    returnLeg,
    includeReturn,
    totalTransportFee: +(
      outbound.totalFare + (returnLeg?.totalFare ?? 0)
    ).toFixed(2),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const autoAssignCareAssistant = async ({
  patientCoords,
  maxRadiusKm = 20,
}) => {
  const [lng, lat] = patientCoords;
  const candidates = await CareAssistantProfile.find({
    isActive: true,
    isBlocked: false,
    status: "Available",
    "kyc.verificationStatus": "Verified",
    "verification.isVerified": true,
    "availability.isOnline": true,
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [lng, lat] },
        $maxDistance: maxRadiusKm * 1000,
      },
    },
  })
    .select(
      "user fullName photoUrl phone performance.averageRating location specializations",
    )
    .limit(5)
    .lean();

  if (!candidates.length) return null;
  candidates.sort(
    (a, b) =>
      (b.performance?.averageRating ?? 0) - (a.performance?.averageRating ?? 0),
  );
  return candidates[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UP HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const checkFollowUpEligibility = async ({
  customerId,
  doctorId,
  hospitalId,
}) => {
  const doctor = await DoctorProfile.findById(doctorId)
    .select("primaryHospital partnershipStatus isActive")
    .lean();
  if (!doctor || doctor.partnershipStatus !== "Active" || !doctor.isActive)
    return { isEligible: false, reason: "Doctor not active" };

  if (doctor.primaryHospital) {
    const hospital = await Hospital.findById(doctor.primaryHospital)
      .select("managementModel isActive isVerified")
      .lean();
    if (hospital?.managementModel === "hospital-manager") {
      if (!hospitalId)
        return {
          isEligible: false,
          reason: "Hospital ID required for this doctor",
        };
      if (hospitalId.toString() !== doctor.primaryHospital.toString())
        return {
          isEligible: false,
          reason: "Follow-up must be at same hospital",
        };
    }
  }

  const query = {
    patient: customerId,
    doctor: doctorId,
    isFollowUp: false,
    status: { $in: ["scheduled", "in_progress", "completed"] },
    followUpExpiry: { $gt: new Date() },
  };
  if (hospitalId) query.hospital = hospitalId;

  const recentOp = await OutPatientRecord.findOne(query)
    .sort({ createdAt: -1 })
    .lean();
  if (!recentOp)
    return {
      isEligible: false,
      reason: "No valid original consultation found for follow-up",
    };

  return {
    isEligible: true,
    parentOp: recentOp._id,
    followUpFee: recentOp.followUpFee || 0,
    parentOpNumber: recentOp.opNumber,
    followUpExpiry: recentOp.followUpExpiry,
    daysRemaining: Math.ceil(
      (new Date(recentOp.followUpExpiry) - new Date()) / (1000 * 60 * 60 * 24),
    ),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getHospitals = async (filters = {}) => {
  const query = { isActive: true, isVerified: true };
  if (filters.city)
    query["address.city"] = { $regex: filters.city, $options: "i" };
  if (filters.hospitalType) query.hospitalType = filters.hospitalType;
  if (filters.managementModel) query.managementModel = filters.managementModel;
  return Hospital.find(query)
    .select(
      "name slug hospitalType managementModel address location contact " +
        "specialties facilities accreditations operatingHours rating " +
        "isEmergencyReady hasICU hasBloodBank hasPharmacy hasDiagnostics " +
        "hasAmbulance hasWheelchairAccess is24x7 bedCount linkedDoctors",
    )
    .lean();
};

const checkHospitalHours = (hospital, scheduledAt) => {
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const baseUTC = parseFrontendDateTime(scheduledAt);
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(baseUTC.getTime() + IST_OFFSET_MS);
  const dayName = dayNames[istDate.getUTCDay()];
  const reqMins = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();

  if (hospital.is24x7) return { available: true };
  const opDay = hospital.operatingHours?.find((h) => h.day === dayName);
  if (!opDay) return { available: false, reason: `No schedule for ${dayName}` };
  if (opDay.isClosed)
    return { available: false, reason: `Closed on ${dayName}` };
  if (opDay.is24Hours) return { available: true };

  const [oh, om] = (opDay.openTime || "00:00").split(":").map(Number);
  const [ch, cm] = (opDay.closeTime || "23:59").split(":").map(Number);
  if (reqMins < oh * 60 + om || reqMins >= ch * 60 + cm)
    return {
      available: false,
      reason: `Open ${opDay.openTime}–${opDay.closeTime} on ${dayName}`,
    };
  return { available: true };
};

export const parseFrontendDateTime = (dateInput) => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  let rawStr = String(dateInput).trim();

  // Fix 1: Frontend sending IST local time as UTC (ending in 'Z')
  // Converts e.g., '2026-06-09T15:30:00.000Z' to '2026-06-09T15:30:00.000+05:30'
  if (/T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(rawStr)) {
    rawStr = rawStr.replace("Z", "+05:30");
  }
  // Fix 2: Frontend sending just the date 'YYYY-MM-DD'
  else if (/^\d{4}-\d{2}-\d{2}$/.test(rawStr)) {
    rawStr = `${rawStr}T00:00:00+05:30`;
  }

  const parsed = new Date(rawStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

// Replace your existing checkDoctorAvailability with this optimized version:
export const checkDoctorAvailability = async (doctorProfileId, scheduledAt) => {
  const doctor = await DoctorProfile.findById(doctorProfileId)
    .select("weeklyAvailability primaryHospital partnershipStatus isActive")
    .lean();

  if (!doctor) return { available: false, reason: "Doctor not found" };
  if (doctor.partnershipStatus !== "Active" || !doctor.isActive)
    return { available: false, reason: "Doctor not active" };

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  // Use the safe parser to neutralize frontend timezone strings
  const baseUTC = parseFrontendDateTime(scheduledAt);
  const istDate = new Date(baseUTC.getTime() + IST_OFFSET_MS);
  const dayName = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ][istDate.getUTCDay()];
  const reqMins = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();

  const dayEntry = doctor.weeklyAvailability?.find((d) => d.day === dayName);
  if (!dayEntry?.isAvailable)
    return { available: false, reason: `Unavailable on ${dayName}` };

  const matchedSlot = dayEntry.slots?.find((s) => {
    if (!s.isActive) return false;
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    return reqMins >= sh * 60 + sm && reqMins < eh * 60 + em;
  });

  if (!matchedSlot)
    return { available: false, reason: `No slot at that time on ${dayName}` };

  const [slotSh, slotSm] = matchedSlot.startTime.split(":").map(Number);
  const [slotEh, slotEm] = matchedSlot.endTime.split(":").map(Number);

  // FIX 2: Dynamic consultation duration based on capacity to prevent artificial blocks
  const slotTotalMins = slotEh * 60 + slotEm - (slotSh * 60 + slotSm);
  const dynamicConsultMins = Math.floor(
    slotTotalMins / (matchedSlot.maxPatients || 1),
  );
  const CONSULT_DURATION_MIN = Math.min(20, Math.max(5, dynamicConsultMins)); // Caps dynamically between 5 and 20 mins

  const slotStart = new Date(
    Date.UTC(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
      slotSh,
      slotSm,
      0,
      0,
    ) - IST_OFFSET_MS,
  );

  const slotEnd = new Date(
    Date.UTC(
      istDate.getUTCFullYear(),
      istDate.getUTCMonth(),
      istDate.getUTCDate(),
      slotEh,
      slotEm,
      0,
      0,
    ) - IST_OFFSET_MS,
  );

  const existingInSlot = await OutPatientRecord.find({
    doctor: doctorProfileId,
    status: { $in: ["scheduled", "in_progress"] },
    scheduledAt: { $gte: slotStart, $lt: slotEnd },
  })
    .select("scheduledAt")
    .lean();

  if (existingInSlot.length >= matchedSlot.maxPatients) {
    const times = existingInSlot
      .map((r) => new Date(r.scheduledAt).getTime())
      .sort((a, b) => b - a);
    const next = new Date(times[0] + CONSULT_DURATION_MIN * 60 * 1000);
    const fmt = next.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return { available: false, reason: `Slot full. Next available: ${fmt}` };
  }

  const overlap = existingInSlot.find(
    (r) =>
      Math.abs(new Date(r.scheduledAt).getTime() - baseUTC.getTime()) <
      CONSULT_DURATION_MIN * 60 * 1000,
  );

  if (overlap) {
    const next = new Date(
      new Date(overlap.scheduledAt).getTime() +
        CONSULT_DURATION_MIN * 60 * 1000,
    );
    const fmt = next.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return { available: false, reason: `Already booked. Next slot: ${fmt}` };
  }

  if (doctor.primaryHospital) {
    const hospital = await Hospital.findById(doctor.primaryHospital)
      .select("managementModel operatingHours is24x7 isActive isVerified")
      .lean();
    if (hospital?.managementModel === "hospital-manager") {
      if (!hospital.isActive || !hospital.isVerified)
        return { available: false, reason: "Hospital not operational" };
      const hospCheck = checkHospitalHours(hospital, baseUTC);
      if (!hospCheck.available) return hospCheck;
    }
  }

  return { available: true };
};

export const checkHospitalOrDoctorAvailability = async ({
  hospitalId,
  doctorId,
  scheduledAt,
}) => {
  if (hospitalId) {
    const hospital = await Hospital.findById(hospitalId)
      .select("isActive isVerified operatingHours is24x7 managementModel")
      .lean();
    if (!hospital) return { available: false, reason: "Hospital not found" };
    if (!hospital.isActive || !hospital.isVerified)
      return { available: false, reason: "Hospital not operational" };
    const check = checkHospitalHours(hospital, scheduledAt);
    if (!check.available) return check;
  }
  if (doctorId) return checkDoctorAvailability(doctorId, scheduledAt);
  return { available: true };
};

export const getDoctorsByHospital = async (hospitalId) => {
const hospital = await Hospital.findById(hospitalId)
    .select("managementModel linkedDoctors isActive isVerified consultationPricing")
    .lean();
  if (!hospital) throw new Error("Hospital not found");
  if (!hospital.isActive || !hospital.isVerified)
    throw new Error("Hospital not operational");

  const doctors = await DoctorProfile.find({
    _id: { $in: hospital.linkedDoctors },
    partnershipStatus: "Active",
    isActive: true,
  })
    .populate("user", "name avatar")
    .select(
      "user specialization qualifications experienceYears consultationTypes fees " +
        "profilePhotoUrl biography languagesSpoken weeklyAvailability rating isOnline",
    )
    .lean();

const isHospitalManaged = hospital.managementModel === "hospital-manager";
  const hp = isHospitalManaged ? hospital.consultationPricing : null;

  // Fix: hospital-manager → hospital's own consultationPricing shown, with
  // honorarium fields kept as-is (null = doctor gets 0 on that type, per rule).
  // doctor-owner → doctor's own fees, unchanged.
  return doctors.map((doc) => {
    const effectiveFees = isHospitalManaged && hp
      ? {
          inPersonFee: hp.inPersonFee ?? 0,
          videoFee: hp.videoFee ?? 0,
          homeVisitFee: hp.homeVisitFee ?? 0,
          inPersonHonorarium: hp.inPersonHonorarium ?? null,
          videoHonorarium: hp.videoHonorarium ?? null,
          homeVisitHonorarium: hp.homeVisitHonorarium ?? null,
          followUpFee: hp.followUpFee ?? 0,
          followUpDiscountPercent: hp.followUpDiscountPercent ?? 0,
          followUpValidDays: hp.followUpValidDays ?? 7,
          source: "hospital",
        }
      : {
          inPersonFee: doc.fees?.inPersonFee ?? doc.fees?.consultationFee ?? 0,
          videoFee: doc.fees?.videoFee ?? doc.fees?.consultationFee ?? 0,
          homeVisitFee: doc.fees?.homeVisitFee ?? doc.fees?.consultationFee ?? 0,
          followUpFee: doc.fees?.followUpFee ?? 0,
          followUpDiscountPercent: doc.fees?.followUpDiscountPercent ?? 0,
          followUpValidDays: doc.fees?.followUpValidDays ?? 7,
          source: "doctor",
        };
    return { ...doc, effectiveFees, hospitalManaged: isHospitalManaged };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION HELPERS — CORE
// ─────────────────────────────────────────────────────────────────────────────

export const snapshotLimits = async (plan, pricingConfig = null) => {
  let consultationsPerMonth = plan.consultations?.freePerMonth ?? 0;
  // CA quota exists ONLY for custom plans (customer explicitly added the
  // careAssistant option block). Fixed plans get null here, always —
  // SubscriptionPlan.careAssistant.* fields are display/reference only and
  // must never seed a subscription benefit.
  let careAssistantVisitsPerMonth = null;
  let transportRatePerKm = plan.transport?.ratePerKm ?? null;
  let transportRidesPerMonth = plan.transport?.ridesPerMonth ?? null;
  let pharmacyDiscountPercent =
    plan.pharmacy?.discountMin ?? plan.pharmacy?.discountMax ?? 0;
  let diagnosticsDiscountPercent = plan.diagnostics?.discountPercent ?? 0;
  let homeSampleCollection = plan.diagnostics?.homeSampleCollection ?? false;

  let careAssistantTierIndex = null;
  let careAssistantTierLabel = null;
  let careAssistantChargePerVisit = null;

  // Fixed plans: no tier snapshot either — CA is platform-rate-only, always.

  if (plan.planType === "custom" && Array.isArray(plan.customOptions)) {
    const consultOpt = plan.customOptions.find(
      (o) => o.optionKey === "consultations",
    );
    if (consultOpt?.quantity > 0) {
      consultationsPerMonth = consultOpt.quantity;
    }

    const caOpt = plan.customOptions.find(
      (o) => o.optionKey === "careAssistant",
    );
    if (caOpt?.quantity > 0) {
      careAssistantVisitsPerMonth = caOpt.quantity;

      const config = pricingConfig ?? (await PlatformPricingConfig.getGlobal());
      const tiers =
        config?.customPlanOptions?.careAssistant?.pricingTiers ?? [];
      const idx = Number(caOpt.careAssistantTierIndex ?? 0);
      const tier = tiers[idx] ?? tiers[0] ?? null;

      careAssistantTierIndex = idx;
      careAssistantTierLabel = tier?.label ?? null;
      careAssistantChargePerVisit =
        tier?.chargeToUser ?? caOpt.unitPrice ?? null;
    }

    const tOpt = plan.customOptions.find((o) => o.optionKey === "transport");
    if (tOpt?.unitPrice > 0) {
      transportRatePerKm = -1;
      transportRidesPerMonth = tOpt.quantity ?? null;
    }

    const diagOpt = plan.customOptions.find(
      (o) => o.optionKey === "diagnostics",
    );
    if (diagOpt?.quantity > 0) {
      diagnosticsDiscountPercent = diagOpt.quantity;
    }

    const pharmOpt = plan.customOptions.find((o) => o.optionKey === "pharmacy");
    if (pharmOpt?.quantity > 0) {
      pharmacyDiscountPercent = pharmOpt.quantity;
    }

    const homeOpt = plan.customOptions.find(
      (o) => o.optionKey === "homeSampleCollection",
    );
    if (homeOpt?.quantity > 0) {
      homeSampleCollection = true;
    }
  }

  return {
    consultationsPerMonth,
    transportRidesPerMonth,
    careAssistantVisitsPerMonth,
    labTestsPerMonth: 0,
    pharmacyDiscountPercent,
    diagnosticsDiscountPercent,
    transportRatePerKm,
    homeSampleCollection,
    careAssistantTierIndex,
    careAssistantTierLabel,
    careAssistantChargePerVisit,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION MODE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const resolvePlanModes = (plan) => {
  if (!plan || plan.planType === "custom") {
    return { inPerson: true, video: true, home: true };
  }
  const modes = plan.consultations?.modes || {};
  return {
    inPerson: modes.inPerson !== false,
    video: modes.video === true,
    home: modes.home === true,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// checkSubscriptionConsultation — FIX A + FIX D
// ─────────────────────────────────────────────────────────────────────────────

export const checkSubscriptionConsultation = async (
  userId,
  consultationType = null,
) => {
  const isHomeVisit = consultationType === "homeVisit";
  const isVideo = consultationType === "video";

  // FIX D: family-aware lookup
  const sub = await findActiveSub(userId);

  if (!sub) {
    return {
      allowed: false,
      sub: null,
      remaining: 0,
      isFree: false,
      reason: "No active subscription",
      videoBlocked: false,
      homeBlocked: false,
    };
  }

  let plan = null;
  if (sub.plan) {
    plan = await SubscriptionPlan.findById(sub.plan)
      .select(
        "planType fixedTier consultations customOptions onlineModeAllowed",
      )
      .lean();
  }

  const planType = sub.planType || plan?.planType || "fixed";
  const fixedTier = sub.fixedTier || plan?.fixedTier || null;

  const modes = resolvePlanModes(plan);

  const modeKey = isHomeVisit ? "home" : isVideo ? "video" : "inPerson";
  const modeCoveredByPlan = modes[modeKey];

  const videoBlocked = isVideo && !modes.video;
  const homeBlocked = isHomeVisit && !modes.home;

  let limit = sub.limits?.consultationsPerMonth ?? null;

  if ((limit == null || limit === 0) && plan) {
    if (plan.planType === "custom" && Array.isArray(plan.customOptions)) {
      const co = plan.customOptions.find(
        (o) => o.optionKey === "consultations",
      );
      if (co?.quantity > 0) limit = co.quantity;
    } else if (plan.consultations?.freePerMonth != null) {
      limit = plan.consultations.freePerMonth;
    }
  }

  if (!limit || limit === 0) {
    return {
      allowed: true,
      sub,
      remaining: 0,
      isFree: false,
      videoBlocked,
      homeBlocked,
      reason: "No consultation quota in plan",
    };
  }

  if (!modeCoveredByPlan) {
    return {
      allowed: true,
      sub,
      remaining: 0,
      isFree: false,
      videoBlocked,
      homeBlocked,
      reason: isVideo
        ? `Your ${fixedTier || "current"} plan covers in-person consultations only. Video fee applies.`
        : isHomeVisit
          ? `Your ${fixedTier || "current"} plan does not cover home visits via quota. Home visit fee applies.`
          : "Mode not covered by plan",
    };
  }

  const now = new Date();
  const usage = sub.usageHistory?.find(
    (u) => u.month === now.getMonth() + 1 && u.year === now.getFullYear(),
  );
  const used = usage?.consultationsUsed ?? 0;

  if (limit === -1) {
    return {
      allowed: true,
      sub,
      remaining: Infinity,
      isFree: true,
      videoBlocked: false,
      homeBlocked: false,
      reason: "Unlimited consultations",
    };
  }

  if (used >= limit) {
    return {
      allowed: true,
      sub,
      remaining: 0,
      isFree: false,
      videoBlocked,
      homeBlocked,
      reason: `Monthly quota exhausted (${used}/${limit} used)`,
    };
  }

  const remaining = limit - used;
  return {
    allowed: true,
    sub,
    remaining,
    isFree: true,
    videoBlocked: false,
    homeBlocked: false,
    reason: `${remaining} of ${limit} consultations remaining this month`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// checkSubscriptionCareAssistant — FIX D
// ─────────────────────────────────────────────────────────────────────────────

export const checkSubscriptionCareAssistant = async (userId) => {
  // FIX D: family-aware lookup
  const sub = await findActiveSub(userId);

  if (!sub) {
    return {
      allowed: false,
      sub: null,
      remaining: 0,
      isFree: false,
      planType: null,
      tierSnapshot: null,
      reason: "No active subscription",
    };
  }

  let limit = sub.limits?.careAssistantVisitsPerMonth ?? null;
  let planType = sub.planType ?? "fixed";

  if ((limit == null || limit === 0) && sub.plan) {
    const plan = await SubscriptionPlan.findById(sub.plan)
      .select("planType customOptions")
      .lean();
    planType = plan?.planType ?? "fixed";
    // CA quota ONLY for custom plans where the option was explicitly added.
    // Fixed plans NEVER get a fallback quota — plan.careAssistant.* is
    // display-only reference data.
    if (plan?.planType === "custom" && Array.isArray(plan.customOptions)) {
      const caOpt = plan.customOptions.find(
        (o) => o.optionKey === "careAssistant",
      );
      if (caOpt?.quantity > 0) limit = caOpt.quantity;
    }
  }

  const tierSnapshot =
    sub.limits?.careAssistantTierIndex != null ||
    sub.limits?.careAssistantTierLabel
      ? {
          tierIndex: sub.limits.careAssistantTierIndex ?? null,
          tierLabel: sub.limits.careAssistantTierLabel ?? null,
          chargePerVisit: sub.limits.careAssistantChargePerVisit ?? null,
        }
      : null;

  if (!limit || limit === 0) {
    return {
      allowed: false,
      sub,
      remaining: 0,
      isFree: false,
      planType,
      tierSnapshot,
      reason: "No care assistant quota in plan",
    };
  }

  const now = new Date();
  const usage = sub.usageHistory?.find(
    (u) => u.month === now.getMonth() + 1 && u.year === now.getFullYear(),
  );
  const used = usage?.careAssistantVisitsUsed ?? 0;

  if (limit === -1) {
    return {
      allowed: true,
      sub,
      remaining: Infinity,
      isFree: planType !== "custom",
      planType,
      tierSnapshot,
      reason: "Unlimited care assistant visits",
    };
  }

  if (used >= limit) {
    return {
      allowed: false,
      sub,
      remaining: 0,
      isFree: false,
      planType,
      tierSnapshot,
      reason: `Care assistant quota exhausted (${used}/${limit} used this month)`,
    };
  }

  return {
    allowed: true,
    sub,
    remaining: limit - used,
    isFree: planType !== "custom",
    planType,
    tierSnapshot,
    reason: `${limit - used} of ${limit} care assistant visits remaining this month`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// checkConsultationModeAllowed — soft gate, no change needed
// ─────────────────────────────────────────────────────────────────────────────

export const checkConsultationModeAllowed = async (
  userId,
  consultationType,
) => {
  return { allowed: true, blockedByPlan: false };
};

// ─────────────────────────────────────────────────────────────────────────────
// checkSubscriptionDiagnostics — FIX B + FIX D
// ─────────────────────────────────────────────────────────────────────────────

export const checkSubscriptionDiagnostics = async (userId) => {
  // FIX D: family-aware lookup
  const sub = await findActiveSub(userId);

  if (!sub) {
    return {
      discountPercent: 0,
      homeSampleCollection: false,
      homeCollectionFreeNow: false,
      homeCollectionUsedOnce: false,
      homeVisitsUsed: 0,
      homeVisitLimit: null,
      sub: null,
    };
  }

  let discountPercent = sub.limits?.diagnosticsDiscountPercent ?? null;
  let homeSampleCollection = sub.limits?.homeSampleCollection ?? null;

  const needsFallback = discountPercent == null || homeSampleCollection == null;

  if (needsFallback && sub.plan) {
    const plan = await SubscriptionPlan.findById(sub.plan)
      .select("planType customOptions diagnostics")
      .lean();

    if (plan?.planType === "custom" && Array.isArray(plan.customOptions)) {
      if (discountPercent == null) {
        const diagOpt = plan.customOptions.find(
          (o) => o.optionKey === "diagnostics",
        );
        discountPercent = diagOpt?.quantity ?? 0;
      }
      if (homeSampleCollection == null) {
        const hscOpt = plan.customOptions.find(
          (o) => o.optionKey === "homeSampleCollection",
        );
        homeSampleCollection = hscOpt ? hscOpt.quantity >= 1 : false;
      }
    } else if (plan) {
      if (discountPercent == null)
        discountPercent = plan.diagnostics?.discountPercent ?? 0;
      if (homeSampleCollection == null)
        homeSampleCollection = plan.diagnostics?.homeSampleCollection ?? false;
    }
  }

  discountPercent = discountPercent ?? 0;
  homeSampleCollection = homeSampleCollection ?? false;

  const now = new Date();
  const usage = sub.usageHistory?.find(
    (u) => u.month === now.getMonth() + 1 && u.year === now.getFullYear(),
  );
  const homeVisitsUsed = usage?.diagnosticBookingsMade ?? 0;

  let homeVisitLimit = null;
  if (homeSampleCollection) {
    const limitsHome = sub.limits?.homeSampleCollection;
    if (limitsHome) {
      homeVisitLimit = 1;
    }
    if (homeVisitLimit == null) homeVisitLimit = 1;
  }

  const homeCollectionUsedOnce = sub.limits?.homeCollectionUsedOnce ?? false;
  const homeCollectionFreeNow = homeSampleCollection && !homeCollectionUsedOnce;

  return {
    discountPercent,
    homeSampleCollection,
    homeCollectionFreeNow,
    homeCollectionUsedOnce,
    homeVisitsUsed,
    homeVisitLimit,
    sub,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// markHomeCollectionUsed
// ─────────────────────────────────────────────────────────────────────────────

export const markHomeCollectionUsed = async (subscriptionId) => {
  if (!subscriptionId) return;
  try {
    await UserSubscription.findByIdAndUpdate(subscriptionId, {
      $set: { "limits.homeCollectionUsedOnce": true },
    });
    console.log(`[markHomeCollectionUsed] ✅ marked for sub:${subscriptionId}`);
  } catch (e) {
    console.error("[markHomeCollectionUsed] ❌ failed:", e.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION USAGE TRACKING
// ─────────────────────────────────────────────────────────────────────────────

export const applySubscriptionUsage = async (subscriptionId, field, delta) => {
  const ALLOWED = [
    "consultationsUsed",
    "transportRidesUsed",
    "careAssistantVisitsUsed",
    "diagnosticBookingsMade",
  ];
  if (!ALLOWED.includes(field)) {
    console.error(
      `[applySubscriptionUsage] INVALID field: "${field}". Allowed: ${ALLOWED.join(", ")}`,
    );
    return;
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const result = await UserSubscription.findOneAndUpdate(
    {
      _id: subscriptionId,
      "usageHistory.month": month,
      "usageHistory.year": year,
      ...(delta < 0 ? { [`usageHistory.$.${field}`]: { $gt: 0 } } : {}),
    },
    { $inc: { [`usageHistory.$.${field}`]: delta } },
    { new: true },
  );

  if (!result) {
    if (delta > 0) {
      await UserSubscription.findByIdAndUpdate(subscriptionId, {
        $push: {
          usageHistory: {
            month,
            year,
            consultationsUsed: 0,
            transportRidesUsed: 0,
            careAssistantVisitsUsed: 0,
            diagnosticBookingsMade: 0,
            [field]: delta,
          },
        },
      });
      console.log(
        `[applySubscriptionUsage] ✅ Created month entry & set ${field}+=${delta} for sub:${subscriptionId}`,
      );
    } else {
      console.warn(
        `[applySubscriptionUsage] ⚠️ Nothing to decrement for sub:${subscriptionId} field:${field}`,
      );
    }
    return;
  }

  console.log(
    `[applySubscriptionUsage] ✅ ${field} delta=${delta} for sub:${subscriptionId}`,
  );
};

export const incrementSubscriptionUsage = async (subId, field) => {
  console.log(`[incrementSubscriptionUsage] subId:${subId} field:${field}`);
  await applySubscriptionUsage(subId, field, 1);
};

export const decrementSubscriptionUsage = async (subId, field) => {
  console.log(`[decrementSubscriptionUsage] subId:${subId} field:${field}`);
  await applySubscriptionUsage(subId, field, -1);
};

export const queueSubscriptionUsage = async (bookingId, subId, field) => {
  const ALLOWED = [
    "consultationsUsed",
    "transportRidesUsed",
    "careAssistantVisitsUsed",
    "diagnosticBookingsMade",
  ];
  if (!bookingId || !subId || !field) {
    console.error("[queueSubscriptionUsage] missing params", {
      bookingId,
      subId,
      field,
    });
    return;
  }
  if (!ALLOWED.includes(field)) {
    console.error(`[queueSubscriptionUsage] invalid field: "${field}"`);
    return;
  }
  try {
    await Booking.findByIdAndUpdate(bookingId, {
      $push: { subscriptionUsagePending: { subId: subId.toString(), field } },
    });
    console.log(
      `[queueSubscriptionUsage] ✅ queued ${field} for booking:${bookingId} sub:${subId}`,
    );
  } catch (e) {
    console.error("[queueSubscriptionUsage] failed:", e.message);
  }
};

const flushSubscriptionUsage = async (booking) => {
  const fresh = await Booking.findById(booking._id)
    .select("subscriptionUsagePending confirmedSubscriptionUsage")
    .lean();

  const pending = fresh?.subscriptionUsagePending ?? [];

  if (!pending.length) {
    console.log(
      `[flushSubscriptionUsage] skip — no pending for booking:${booking._id}`,
    );
    return [];
  }

  console.log(
    `[flushSubscriptionUsage] flushing ${pending.length} items for booking:${booking._id}`,
  );

  for (const { subId, field } of pending) {
    if (!subId || !field) continue;
    try {
      await applySubscriptionUsage(subId, field, 1);
      console.log(`[flushSubscriptionUsage] ✅ flushed ${field} sub:${subId}`);
    } catch (e) {
      console.error(
        `[flushSubscriptionUsage] ❌ failed ${field} sub:${subId}:`,
        e.message,
      );
    }
  }

  return pending;
};

export const flushAndRecord = async (booking) => {
  console.log(`[flushAndRecord] booking:${booking._id}`);

  const flushed = await flushSubscriptionUsage(booking);

  if (!flushed.length) {
    console.log(`[flushAndRecord] skip record — nothing flushed`);
    return;
  }

  await Booking.findByIdAndUpdate(booking._id, {
    $push: { confirmedSubscriptionUsage: { $each: flushed } },
    $set: { subscriptionUsagePending: [] },
  });

  console.log(
    `[flushAndRecord] ✅ recorded ${flushed.length} items for booking:${booking._id}`,
  );
};

export const recoverSubscriptionUsageOnCancel = async (booking) => {
  const fresh = await Booking.findById(booking._id)
    .select("subscriptionUsagePending confirmedSubscriptionUsage")
    .lean();

  const pending = fresh?.subscriptionUsagePending ?? [];
  const confirmed = fresh?.confirmedSubscriptionUsage ?? [];

  console.log(
    `[recoverSubscriptionUsageOnCancel] booking:${booking._id} pending:${pending.length} confirmed:${confirmed.length}`,
  );

  if (pending.length > 0) {
    await Booking.findByIdAndUpdate(booking._id, {
      $set: { subscriptionUsagePending: [] },
    });
    console.log(
      `[recoverSubscriptionUsageOnCancel] ✅ cleared ${pending.length} pending items — quota never consumed`,
    );
    return {
      recovered: false,
      reason: "pending cleared — quota was never consumed",
    };
  }

  if (confirmed.length > 0) {
    for (const { subId, field } of confirmed) {
      if (!subId || !field) continue;
      await decrementSubscriptionUsage(subId, field);
      console.log(
        `[recoverSubscriptionUsageOnCancel] ✅ restored ${field} sub:${subId}`,
      );
    }
    await Booking.findByIdAndUpdate(booking._id, {
      $set: { confirmedSubscriptionUsage: [] },
    });
    console.log(
      `[recoverSubscriptionUsageOnCancel] ✅ recovered ${confirmed.length} quota items`,
    );
    return { recovered: true, decremented: confirmed.length };
  }

  console.log(
    `[recoverSubscriptionUsageOnCancel] no usage recorded — nothing to recover`,
  );
  return { recovered: false, reason: "no subscription usage on this booking" };
};

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION FEE RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export const resolveConsultationFee = async ({
  isFollowUp,
  followUpFee,
  isCoveredBySubscription,
  doctorId,
  hospitalId,
  consultationType,
}) => {
  const gstRateMap = {
    inPerson: 0.0,
    video: 0.05,
    homeVisit: 0.05,
  };
  let gstRate = gstRateMap[consultationType] ?? 0.0;

let baseFee = 600;
  let doctorShare = 600;
  let hospitalShare = 0;
  let source = "default";

  // Pricing source rule (fix — matches DoctorProfile.resolveEffectivePricing):
  //   hospital-manager → Hospital.consultationPricing is authoritative. Doctor
  //   gets a share ONLY if hospital set an explicit per-type honorarium; null
  //   means doctor gets 0, hospital keeps full baseFee.
  //   doctor-owner (or no hospital linked) → doctor's own `fees` is authoritative,
  //   hospital NEVER gets a share.
  let hospital = null;
  if (hospitalId) {
    hospital = await Hospital.findById(hospitalId)
      .select("managementModel consultationPricing")
      .lean();
  } else if (doctorId) {
    const docForHosp = await DoctorProfile.findById(doctorId)
      .select("primaryHospital")
      .lean();
    if (docForHosp?.primaryHospital) {
      hospital = await Hospital.findById(docForHosp.primaryHospital)
        .select("managementModel consultationPricing")
        .lean();
    }
  }

  const isHospitalManaged = hospital?.managementModel === "hospital-manager";

  if (isHospitalManaged && hospital?.consultationPricing) {
    source = "hospital";
    const hp = hospital.consultationPricing;
    const feeMap = {
      inPerson: hp.inPersonFee,
      video: hp.videoFee,
      homeVisit: hp.homeVisitFee,
    };
    const honMap = {
      inPerson: hp.inPersonHonorarium,
      video: hp.videoHonorarium,
      homeVisit: hp.homeVisitHonorarium,
    };

    if (isFollowUp) {
      baseFee = followUpFee || hp.followUpFee || 0;
      const stdFee = feeMap[consultationType] ?? hp.inPersonFee ?? 1;
      const stdHon = honMap[consultationType]; // explicit only, no default
      doctorShare = stdHon != null ? Math.round(baseFee * (stdHon / stdFee)) : 0;
    } else {
      baseFee = feeMap[consultationType] ?? 600;
      doctorShare = honMap[consultationType] ?? 0; // null → doctor gets nothing
    }
    hospitalShare = Math.max(0, baseFee - doctorShare);
  } else if (doctorId) {
    const doc = await DoctorProfile.findById(doctorId).select("fees").lean();
    if (doc?.fees) {
      source = "doctor";

      if (isFollowUp) {
        baseFee = followUpFee || 0;
        const stdFee = doc.fees.inPersonFee ?? doc.fees.consultationFee ?? 1;
        const stdHon =
          doc.fees.inPersonHonorarium ?? doc.fees.consultationHonorarium ?? 0;
        doctorShare = Math.round(baseFee * (stdHon / stdFee));
      } else {
        const feeMap = {
          inPerson: doc.fees.inPersonFee,
          video: doc.fees.videoFee,
          homeVisit: doc.fees.homeVisitFee,
        };
        const honMap = {
          inPerson: doc.fees.inPersonHonorarium,
          video: doc.fees.videoHonorarium,
          homeVisit: doc.fees.homeVisitHonorarium,
        };

        baseFee = feeMap[consultationType] ?? doc.fees.consultationFee ?? 0;
        doctorShare =
          honMap[consultationType] ??
          doc.fees.consultationHonorarium ??
          baseFee;
      }

      // doctor-owner → hospital NEVER gets a cut, doctor keeps everything left.
      hospitalShare = 0;
      doctorShare = baseFee; // doctor-owner: doctor takes full fee, no honorarium split
    }
  }

  // SUBSCRIPTION LOGIC
  const feeChargedToCustomer = isCoveredBySubscription ? 0 : baseFee;
  if (isCoveredBySubscription) {
    source = "subscription";
    gstRate = 0; // No GST on a free charge
  }

  return {
    fee: feeChargedToCustomer,
    doctorShare,
    hospitalShare,
    source,
    gstRate,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT FEE RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT FEE RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export const resolveCareAssistantFee = async ({
  userId,
  durationHours,
  config,
}) => {
  const resolvedConfig = config || (await PlatformPricingConfig.getGlobal());
  const parsedDuration = parseInt(durationHours, 10) || 4;
  const subCheck = await checkSubscriptionCareAssistant(userId);

  // Tier-matching helper: inclusive on both bounds so a duration exactly
  // equal to a tier's upper bound still matches THAT tier (not the next
  // one or a fallback-to-index-0).
  const matchTier = (tiers, duration) => {
    let idx = tiers.findIndex(
      (t) =>
        duration >= (t.minHours ?? 0) &&
        (t.maxHours == null || duration <= t.maxHours),
    );
    if (idx < 0) {
      // exact minHours match fallback
      idx = tiers.findIndex((t) => t.minHours === duration);
    }
    if (idx < 0 && tiers.length > 0) {
      // duration exceeds all tiers — use the last (highest) tier
      idx = tiers.length - 1;
    }
    return idx < 0 ? 0 : idx;
  };

  // 1. FIXED plan — always charge platform rate, no quota/subscription tracking
  if (subCheck.allowed && subCheck.planType !== "custom") {
    const sub = subCheck.sub;
    const platformTiers = resolvedConfig?.careAssistant?.pricingTiers ?? [];
    const activeTiers = platformTiers
      .filter((t) => t.isActive !== false)
      .sort((a, b) => (a.minHours ?? 0) - (b.minHours ?? 0));
    const requestedTier =
      activeTiers[matchTier(activeTiers, parsedDuration)] ?? null;

    return {
      fee: requestedTier?.chargeToUser ?? 0,
      source: "platform",
      isCoveredBySubscription: false,
      quotaTracked: false,
      sub,
      subQuotaInfo: subCheck,
      tier: requestedTier,
    };
  }

  // 2. CUSTOM plan
  if (subCheck.planType === "custom") {
    const sub = subCheck.sub;
    const remaining = subCheck.remaining ?? 0;

    if (subCheck.allowed && (remaining > 0 || remaining === Infinity)) {
      const planTierIdx = sub.limits?.careAssistantTierIndex ?? 0;
      const customTiers =
        resolvedConfig?.customPlanOptions?.careAssistant?.pricingTiers ?? [];

      let selectedTierIdx = matchTier(customTiers, parsedDuration);

      // ── MATCH BY SNAPSHOTTED CHARGE, NOT STALE INDEX ─────────────────────
      // sub.limits.careAssistantTierIndex/chargePerVisit/Label were snapshotted
      // at subscribe time. If PlatformPricingConfig tiers were reordered/edited
      // since, planTierIdx no longer maps to the same tier in current customTiers.
      // Primary check: does the SELECTED tier's chargeToUser match the
      // snapshotted free charge?
      const snapshotCharge = sub.limits?.careAssistantChargePerVisit;
      const snapshotLabel = sub.limits?.careAssistantTierLabel;
      const selectedTierForMatch = customTiers[selectedTierIdx];

      const isPlanTierBySnapshot =
        snapshotCharge != null &&
        selectedTierForMatch &&
        Number(selectedTierForMatch.chargeToUser) === Number(snapshotCharge);

      const isPlanTierByLabel =
        snapshotCharge == null && // only if charge match unavailable
        snapshotLabel &&
        selectedTierForMatch?.label === snapshotLabel;

      const isPlanTier =
        isPlanTierBySnapshot ||
        isPlanTierByLabel ||
        selectedTierIdx === planTierIdx; // fallback: original index match

      // 2a. PLAN TIER selected → FREE
      if (isPlanTier) {
        const snapshotTierIndex = sub.limits?.careAssistantTierIndex;
        const snapshotCharge2 = sub.limits?.careAssistantChargePerVisit;
        const snapshotLabel2 = sub.limits?.careAssistantTierLabel;

        let tier = null;

        if (snapshotCharge2 != null) {
          tier = {
            label: snapshotLabel2 ?? `Tier ${snapshotTierIndex}`,
            chargeToUser: snapshotCharge2,
            tierIndex: snapshotTierIndex,
          };
        } else if (customTiers[selectedTierIdx]) {
          const ct = customTiers[selectedTierIdx];
          tier = {
            label: ct.label,
            minHours: ct.minHours,
            maxHours: ct.maxHours ?? null,
            chargeToUser: ct.chargeToUser,
            payoutToAssistant: ct.payoutToAssistant,
            tierIndex: selectedTierIdx,
          };
        } else {
          try {
            const plan = await SubscriptionPlan.findById(sub.plan)
              .select("planType customOptions")
              .lean();
            if (
              plan?.planType === "custom" &&
              Array.isArray(plan.customOptions)
            ) {
              const caOpt = plan.customOptions.find(
                (o) => o.optionKey === "careAssistant",
              );
              if (caOpt) {
                const idx = Number(caOpt.careAssistantTierIndex ?? 0);
                const customTier = customTiers[idx] ?? customTiers[0] ?? null;
                if (customTier) {
                  tier = {
                    label: customTier.label,
                    minHours: customTier.minHours,
                    maxHours: customTier.maxHours ?? null,
                    chargeToUser: customTier.chargeToUser,
                    payoutToAssistant: customTier.payoutToAssistant,
                    tierIndex: idx,
                  };
                } else if (caOpt.unitPrice != null) {
                  tier = {
                    label: caOpt.label ?? `Tier ${idx}`,
                    chargeToUser: caOpt.unitPrice,
                    tierIndex: idx,
                  };
                }
              }
            }
          } catch (e) {
            console.error(
              "[resolveCareAssistantFee] plan lookup failed:",
              e.message,
            );
          }
        }

        return {
          fee: 0,
          source: "custom_plan_quota",
          isCoveredBySubscription: true,
          quotaTracked: true,
          sub,
          subQuotaInfo: subCheck,
          tier,
        };
      }

      // 2b. DIFFERENT tier → charge platform rate, no quota
      const chargeTier = customTiers[selectedTierIdx] ?? null;
      console.log(
        `[resolveCareAssistantFee] custom plan: selected tier ${selectedTierIdx} ` +
          `(charge ${chargeTier?.chargeToUser}) does not match plan's free tier ` +
          `(snapshot charge ${snapshotCharge}, label "${snapshotLabel}", index ${planTierIdx})` +
          ` — charging platform rate ${chargeTier?.chargeToUser ?? 0}`,
      );

      return {
        fee: chargeTier?.chargeToUser ?? 0,
        source: "platform",
        isCoveredBySubscription: false,
        quotaTracked: false,
        sub,
        subQuotaInfo: subCheck,
        tier: chargeTier ? { ...chargeTier, tierIndex: selectedTierIdx } : null,
      };
    }

    // 2c. Quota exhausted
    const platformTier =
      PlatformPricingConfig.resolveCareAssistantTier?.(
        resolvedConfig,
        parsedDuration,
      ) ?? null;
    return {
      fee: platformTier?.chargeToUser ?? 0,
      source: "platform",
      isCoveredBySubscription: false,
      quotaTracked: false,
      sub,
      subQuotaInfo: subCheck,
      tier: platformTier,
    };
  }

  // 3. No sub / exhausted
  const platformTier =
    PlatformPricingConfig.resolveCareAssistantTier?.(
      resolvedConfig,
      parsedDuration,
    ) ?? null;
  return {
    fee: platformTier?.chargeToUser ?? 0,
    source: "platform",
    isCoveredBySubscription: false,
    quotaTracked: false,
    sub: subCheck.sub,
    subQuotaInfo: subCheck,
    tier: platformTier,
  };
};

export const isPointNearRoute = ({ point, polyline, thresholdKm = 3 }) => {
  if (!polyline?.length) return false;
  for (const coord of polyline) {
    const dist = haversineKm(point, coord);
    if (dist <= thresholdKm) return true;
  }
  return false;
};

// ──────────────────────────────────────a───────────────────────────────────────
// FARE BREAKDOWN BUILDER
// ─────────────────────────────────────────────────────────────────────────────

export const buildFareBreakdown = ({
  consultationFee = 0,
  doctorShare = 0,
  hospitalShare = 0,
  careAssistantFee = 0,
  transportFee = 0,
  diagnosticFee = 0,
  pharmacyFee = 0,
  bloodBankFee = 0,
  homeCollectionFee = 0,
  platformFee = 0,
  taxPercent = 0,
  discount = 0,
  couponDiscount = 0,
  walletApplied = 0,
} = {}) => {
  const subtotal = +(
    consultationFee +
    careAssistantFee +
    transportFee +
    diagnosticFee +
    pharmacyFee +
    bloodBankFee +
    homeCollectionFee +
    platformFee
  ).toFixed(2);
  const discountTotal = +((discount || 0) + (couponDiscount || 0)).toFixed(2);
  const taxableBase = +Math.max(0, subtotal - discountTotal).toFixed(2);
  const taxes = taxPercent ? +(taxableBase * (taxPercent / 100)).toFixed(2) : 0;
  const totalAmount = +(taxableBase + taxes).toFixed(2);
  const amountPaid = totalAmount;

  return {
    consultationFee,
    doctorShare,
    hospitalShare,
    careAssistantFee,
    transportFee,
    diagnosticFee,
    pharmacyFee,
    bloodBankFee,
    homeCollectionFee,
    platformFee,
    taxes,
    discount,
    couponDiscount,
    walletApplied,
    totalAmount,
    amountPaid,
    refundAmount: 0,
    currency: "INR",
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// OP NUMBER GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export const generateOpNumber = async (hospitalId) => {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const now = new Date();

  // IST date string for OP code (e.g. "20260624")
  const istNow = new Date(now.getTime() + IST_OFFSET_MS);
  const date = istNow.toISOString().slice(0, 10).replace(/-/g, "");

  let hospCode = "GEN";
  if (hospitalId) {
    const hosp = await Hospital.findById(hospitalId).select("slug name").lean();
    if (hosp)
      hospCode = (hosp.slug || hosp.name || "GEN")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .slice(0, 5);
  }

  // IST midnight as UTC — consistent with parseFrontendDateTime pattern used elsewhere
  const istMidnight = new Date(
    Date.UTC(
      istNow.getUTCFullYear(),
      istNow.getUTCMonth(),
      istNow.getUTCDate(),
      0,
      0,
      0,
      0,
    ) - IST_OFFSET_MS,
  );

  const count = await OutPatientRecord.countDocuments({
    createdAt: { $gte: istMidnight },
    ...(hospitalId ? { hospital: hospitalId } : {}),
  });

  return `OP-${date}-${hospCode}-${String(count + 1).padStart(4, "0")}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const createRazorpayOrder = async (
  amountInRupees,
  bookingCode,
  notes = {},
) => {
  if (amountInRupees <= 0) return null;
  const order = await razorpay.orders.create({
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    receipt: bookingCode,
    notes: { bookingCode, ...notes },
  });
  return { orderId: order.id, amount: amountInRupees, currency: "INR" };
};

export const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const digest = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return digest === signature;
};

// ─────────────────────────────────────────────────────────────────────────────
// WALLET PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

export const processWalletPayment = async ({
  userId,
  amount,
  bookingId,
  bookingCode,
}) => {
  const wallet = await Wallet.findOne({ user: userId });
  if (!wallet) throw new Error("Wallet not found");
  if (wallet.availableBalance < amount)
    throw new Error(
      `Insufficient wallet balance. Available: ₹${wallet.availableBalance}`,
    );
  await wallet.debit(amount, "Booking_Payment", {
    referenceId: bookingId,
    onModel: "Booking",
    description: `Payment for booking ${bookingCode}`,
    initiatedBy: userId,
  });
  return {
    gateway: "Wallet",
    transactionId: `WALLET-${Date.now()}`,
    paymentMode: "Wallet",
    amount,
    status: "success",
    paidAt: new Date(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// REFUND COMPUTER
// ─────────────────────────────────────────────────────────────────────────────

export const computeRefundAmount = async (booking) => {
  const config = await PlatformPricingConfig.getGlobal();
  const policy = config?.refundPolicy || {};
  const thresholdHours = policy.rideFullRefundHoursThreshold ?? 24;
  const partialPercent = policy.ridePartialRefundPercent ?? 50;

  let refundPercent = 100; // default full refund when no scheduledAt
  if (booking.scheduledAt) {
    const hoursUntil =
      (new Date(booking.scheduledAt) - new Date()) / (1000 * 60 * 60);
    refundPercent = hoursUntil >= thresholdHours ? 100 : partialPercent;
  }

  const refundAmount = +(
    ((booking.fareBreakdown?.totalAmount ?? 0) * refundPercent) /
    100
  ).toFixed(2);
  return { refundPercent, refundAmount };
};

// ─────────────────────────────────────────────────────────────────────────────
// LAB HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getLabs = async (filters = {}) => {
  const query = { status: "approved", isActive: true };
  if (filters.city)
    query["registeredAddress.city"] = { $regex: filters.city, $options: "i" };
  if (filters.labType) query.labType = filters.labType;
  if (filters.homeCollection)
    query.sampleCollectionMode = { $in: ["Home Collection", "Both"] };
  return LabPartnerProfile.find(query)
    .select(
      "labName labCode labType ownershipType registeredAddress timing " +
        "sampleCollectionMode homeCollectionRadius homeCollectionFee " +
        "reportDeliveryModes avgTurnaroundHours averageRating totalReviews " +
        "accreditations isFeatured logoUrl",
    )
    .lean();
};

export const getLabWithTests = async (labId) => {
  const lab = await LabPartnerProfile.findOne({
    _id: labId,
    status: "approved",
    isActive: true,
  })
    .select(
      "labName labCode labType registeredAddress timing branches " +
        "sampleCollectionMode homeCollectionRadius homeCollectionFee " +
        "reportDeliveryModes avgTurnaroundHours averageRating accreditations " +
        "labTests labPackages contactPersons logoUrl",
    )
    .lean();
  if (!lab) throw new Error("Lab not found or not operational");
  lab.labTests = (lab.labTests || []).filter((t) => t.isActive && t.slug);
  lab.labPackages = (lab.labPackages || []).filter((p) => p.isActive && p.slug);
  return lab;
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE COMPONENT RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

export const resolveServiceComponents = (bookingType) => ({
  needsTransport: [
    "full_care_ride",
    "patient_transport",
    "diagnostic_home",
  ].includes(bookingType),
  needsCareAssistant: ["full_care_ride", "care_assistant"].includes(
    bookingType,
  ),
  needsDoctor: [
    "full_care_ride",
    "doctor_consultation",
    "doctor_online",
    "physiotherapist",
    "follow_up",
  ].includes(bookingType),
  needsDiagnostic: ["diagnostic_center", "diagnostic_home"].includes(
    bookingType,
  ),
  needsPharmacy: false,
  needsBloodBank: false,
  isOnline: bookingType === "doctor_online",
  isFollowUpType: bookingType === "follow_up",
  needsReturnOption: ["full_care_ride", "patient_transport"].includes(
    bookingType,
  ),
  needsWaitingOption: bookingType === "patient_transport",
  canAddDoctor: bookingType === "patient_transport",
});

// ─────────────────────────────────────────────────────────────────────────────
// PAY-AT-SERVICE: Generate Razorpay Payment Link (QR-safe, production)
// ─────────────────────────────────────────────────────────────────────────────

export const generatePayAtServiceLink = async ({
  booking,
  customer,
  generatedByUserId,
}) => {
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + TWO_HOURS_MS);
  const expireUnix = Math.floor(expiresAt.getTime() / 1000);

  const amount = booking.fareBreakdown?.totalAmount ?? 0;
  if (amount <= 0)
    throw new Error("Amount must be > 0 for pay-at-service link");

  // Razorpay Payment Links API — works on all accounts, QR-renderable
  const linkPayload = {
    amount: Math.round(amount * 100), // paise
    currency: "INR",
    accept_partial: false,
    description: `Payment for Booking #${booking.bookingCode}`,
    customer: {
      name: customer.name || booking.patientInfo?.name || "Customer",
      email: customer.email || "",
      contact: customer.phone || "",
    },
    notify: {
      sms: !!customer.phone,
      email: !!customer.email,
    },
    reminder_enable: false,
    notes: {
      bookingCode: booking.bookingCode,
      bookingId: booking._id.toString(),
      generatedBy: generatedByUserId?.toString() ?? "system",
      source: "pay_at_service",
    },
    callback_url: `${process.env.FRONTEND_URL}/bookings/${booking._id}/payment-complete`,
    callback_method: "get",
    expire_by: expireUnix,
  };

  const link = await razorpay.paymentLink.create(linkPayload);

  return {
    paymentLinkId: link.id,
    paymentLinkUrl: link.short_url, // this IS the short URL — also renders as QR
    shortUrl: link.short_url,
    qrCodeUrl: null, // frontend renders QR from shortUrl using qrcode lib
    amount,
    expiresAt,
    generatedAt: new Date(),
  };
};

export { resolvePlanModes };
