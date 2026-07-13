import express from "express";
import mongoose from "mongoose";

import Ride from "../models/Ride.js";
import Driver from "../models/Driver.js";
import SoloDriverPartner from "../models/SoloDriverPartner.js";
import TransportPartner from "../models/TransportPartner.js";
import CareAssistantProfile from "../models/CareAssistantProfile.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import RideTracking from "../models/RideTracking.js";

import { protect, authorize } from "../middleware/authMiddleware.js";
import { getBookingSocketService } from "../services/bookingSocketService.js";
import sendSms from "../services/Sendsms.js";
import { otpSms } from "../utils/Smstemplates.js";
import {
  genOtp,
  haversineKm,
  createNotification,
  buildRidePayload,
  resolveCareRideKmRate,
  calculateCanonicalRoute,
  findNearestHospital,
  calculateEtaMinutes,
  CARE_RIDE_RADIUS_M,
  RIDE_STATUSES_ACTIVE,
} from "./bookingRouterShared.js";
import RidePaymentIntent from "../models/RidePaymentIntent.js";
import Wallet from "../models/Wallet.js";
import { razorpay, resolveKmRate, verifyRazorpaySignature, createRazorpayOrder } from "./bookingRouterShared.js";

const INTENT_TTL_MIN = 20;
import { hashOtp } from "./bookingRouterShared.js";
import { autoAssignNearestDriver, recordPartnerTripCompletion } from "../services/partnerAssignmentEngine.service.js";
const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CARE_RIDE_RADIUS_RAD = CARE_RIDE_RADIUS_M / 1000 / 6378.1;

const CANCELLABLE_STATUSES = [
  "searching",
  "driver_assigned",
  "driver_accepted",
  "driver_en_route",
  "driver_arrived",
];
const DRIVER_CANCELLABLE_STATUSES = [
  "searching",
  "driver_assigned",
  "driver_accepted",
  "driver_en_route",
];

const STATUS_SOCKET_EVENT = {
  driver_accepted: "driver_accepted",
  driver_en_route: "driver_en_route",
  driver_arrived: "driver_arrived",
  otp_verified: "otp_verified",
  in_progress: "ride_started",
  at_stop: "at_stop",
  completed: "ride_completed",
  cancelled: "ride_cancelled",
};

const STATUS_MILESTONE = {
  driver_accepted: "driver_accepted",
  driver_en_route: "driver_en_route",
  driver_arrived: "driver_arrived",
  otp_verified: "otp_verified",
  in_progress: "ride_started",
  at_stop: "stop_reached",
  completed: "ride_completed",
  cancelled: "ride_cancelled",
};

const ADMIN_ALERT_MILESTONES = [
  "sos_triggered",
  "vehicle_breakdown",
  "route_deviated",
  "driver_replaced",
  "ride_cancelled",
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const isValidObjId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateLocations = (pickup, destination) => {
  if (!pickup?.coordinates?.length)
    return "pickupLocation.coordinates required";
  if (!destination?.coordinates?.length)
    return "destinationLocation.coordinates required";
  const [pLng, pLat] = pickup.coordinates;
  const [dLng, dLat] = destination.coordinates;
  if (pLng === dLng && pLat === dLat)
    return "Pickup and destination cannot be the same location";
  return null;
};

const buildGeo = (loc) => ({
  type: "Point",
  coordinates: loc.coordinates,
  label: loc.label || "",
  address: loc.address || "",
  city: loc.city || "",
});

/**
 * getRideDriverType — derive driver type from ride fields.
 * Returns 'agency' | 'solo' | null
 */
const getRideDriverType = (ride) => {
  if (ride.transportPartner && ride.driver) return "agency";
  if (ride.soloPartner) return "solo";
  return null;
};

/**
 * getDriverUserId — resolve User._id from ride.
 * Agency: Driver.user
 * Solo:   SoloDriverPartner.user
 */
const getDriverUserId = async (ride) => {
  const type = getRideDriverType(ride);
  if (type === "agency" && ride.driver) {
    const dr = await Driver.findById(ride.driver).select("user").lean();
    return dr?.user || null;
  }
  if (type === "solo" && ride.soloPartner) {
    const sp = await SoloDriverPartner.findById(ride.soloPartner)
      .select("user")
      .lean();
    return sp?.user || null;
  }
  return null;
};

/**
 * canUserMutateRideAsDriver — checks if requesting user is the assigned driver.
 * Works for both agency (Driver model) and solo (SoloDriverPartner model).
 */
const canUserMutateRideAsDriver = async (userId, role, ride) => {
  if (["admin", "superadmin"].includes(role)) return { allowed: true };
  if (!["driver", "solodriverpartner"].includes(role))
    return { allowed: false, reason: "Driver only action" };

  if (role === "driver") {
    // Agency driver — ride.driver = Driver._id
    if (!ride.driver)
      return { allowed: false, reason: "No agency driver assigned" };
    const dr = await Driver.findOne({ _id: ride.driver, user: userId })
      .select("_id")
      .lean();
    if (dr) return { allowed: true };
  }

  if (role === "solodriverpartner") {
    // Solo driver — ride.soloPartner = SoloDriverPartner._id
    if (!ride.soloPartner)
      return { allowed: false, reason: "No solo driver assigned" };
    const sp = await SoloDriverPartner.findOne({
      _id: ride.soloPartner,
      user: userId,
    })
      .select("_id")
      .lean();
    if (sp) return { allowed: true };
  }

  return {
    allowed: false,
    reason: "You are not the assigned driver for this ride",
  };
};

/**
 * canAccessRide — read access check for all roles.
 */
const canAccessRide = async (userId, role, ride) => {
  if (["admin", "superadmin"].includes(role)) return { allowed: true };

  if (role === "customer" && ride.booking) {
    const booking = await Booking.findById(ride.booking)
      .select("customer")
      .lean();
    if (booking?.customer?.toString() === userId) return { allowed: true };
  }

  if (role === "driver") {
    if (!ride.driver) return { allowed: false, reason: "Not authorised" };
    const dr = await Driver.findOne({ _id: ride.driver, user: userId })
      .select("_id")
      .lean();
    if (dr) return { allowed: true };
  }

  if (role === "solodriverpartner") {
    if (!ride.soloPartner) return { allowed: false, reason: "Not authorised" };
    const sp = await SoloDriverPartner.findOne({
      _id: ride.soloPartner,
      user: userId,
    })
      .select("_id")
      .lean();
    if (sp) return { allowed: true };
  }

  if (role === "care_assistant" && ride.booking) {
    const ca = await CareAssistantProfile.findOne({ user: userId })
      .select("_id")
      .lean();
    if (ca) {
      const booking = await Booking.findById(ride.booking)
        .select("careAssistant")
        .lean();
      if (booking?.careAssistant?.toString() === ca._id.toString())
        return { allowed: true };
    }
  }

  if (role === "transportpartner" && ride.transportPartner) {
    const tp = await TransportPartner.findOne({ user: userId })
      .select("_id")
      .lean();
    if (tp && ride.transportPartner.toString() === tp._id.toString())
      return { allowed: true };
  }

  return { allowed: false, reason: "Not authorised to access this ride" };
};

/**
 * markDriverAvailable — works for both agency and solo drivers.
 * Agency: updates Driver.status
 * Solo:   updates SoloDriverPartner.dispatch.status
 */
const markDriverAvailable = async (ride) => {
  const type = getRideDriverType(ride);
  if (type === "agency" && ride.driver) {
    await Driver.findByIdAndUpdate(ride.driver, {
      $set: { status: "Available", currentRide: null },
    });
  } else if (type === "solo" && ride.soloPartner) {
    await SoloDriverPartner.findByIdAndUpdate(ride.soloPartner, {
      $set: { "dispatch.status": "Available", "dispatch.currentRide": null },
    });
  }
};

const getCustomerFromRide = async (ride) => {
  if (!ride.booking) return null;
  const booking = await Booking.findById(ride.booking)
    .select("customer")
    .lean();
  return booking?.customer || null;
};

const resolveRideWaypoints = async ({
  pickupGeo,
  dropoffGeo,
  careAssistantProfile,
}) => {
  const waypoints = [];
  if (careAssistantProfile?.currentLocation?.coordinates?.length) {
    const caCoords = careAssistantProfile.currentLocation.coordinates;
    const patientDistance = haversineKm(caCoords, pickupGeo.coordinates);
    const hospitalDistance = haversineKm(caCoords, dropoffGeo.coordinates);
    waypoints.push({
      type: "care_assistant_join",
      pickupFirst: patientDistance < hospitalDistance,
      location: {
        type: "Point",
        coordinates: caCoords,
        address: careAssistantProfile.currentLocation.address || "",
      },
    });
  }
  return waypoints;
};

const createRideRequest = async ({
  pickupGeo,
  dropoffGeo,
  scheduledAt,
  bookingId,
  createdBy,
  careAssistantId = null,
}) => {
  const careAssistantProfileDoc = careAssistantId
    ? await CareAssistantProfile.findById(careAssistantId).lean()
    : null;

  const dynamicWaypoints = await resolveRideWaypoints({
    pickupGeo,
    dropoffGeo,
    careAssistantProfile: careAssistantProfileDoc,
  });

  let activeNavigationTarget = "pickup_patient";
  let rideStage = "driver_to_patient";
  if (dynamicWaypoints.length) {
    const caWaypoint = dynamicWaypoints.find(
      (wp) => wp.type === "care_assistant_join",
    );
    if (caWaypoint?.pickupFirst) {
      activeNavigationTarget = "pickup_care_assistant";
      rideStage = "driver_to_care_assistant";
    }
  }

  let nearestHospitalData = null;
  try {
    nearestHospitalData = await findNearestHospital(dropoffGeo.coordinates);
  } catch (e) {
    console.error("[nearestHospital]", e.message);
  }

  const ride = await Ride.create({
    ...buildRidePayload({
      bookingId,
      rideType: "patient",
      vehicleClass: "four_wheeler",
      pickupCoords: pickupGeo.coordinates,
      pickupAddress: pickupGeo.address || "",
      pickupCity: pickupGeo.city || "",
      dropoffCoords: dropoffGeo.coordinates,
      dropoffAddress: dropoffGeo.address || "",
      dropoffCity: dropoffGeo.city || "",
      scheduledPickupAt: scheduledAt || null,
      createdBy,
      waypoints: dynamicWaypoints,
      activeNavigationTarget,
      rideStage,
    }),
    status: "searching",
  });

  await RideTracking.findOneAndUpdate(
    { ride: ride._id },
    {
      $setOnInsert: {
        ride: ride._id,
        booking: bookingId,
        careAssistant: careAssistantId || null,
        hospital: nearestHospitalData?.hospital?._id || null,
        activeTarget: activeNavigationTarget,
        "liveRouteContext.nearestHospitalDistanceKm":
          nearestHospitalData?.distanceKm || 0,
        "liveRouteContext.currentLegEtaMinutes":
          nearestHospitalData?.etaMinutes || 0,
        "liveRouteContext.nearestHospitalCalculatedAt": new Date(),
      },
    },
    { upsert: true, new: true },
  );

  return { ride, nearestHospitalData };
};

const ensureRideTracking = async (ride) => {
  return RideTracking.findOneAndUpdate(
    { ride: ride._id },
    {
      $setOnInsert: {
        ride: ride._id,
        booking: ride.booking || null,
        // NOTE: no 'driver' field here — RideTracking should not store Driver._id
        // because solo rides have no Driver doc. Store soloPartner or omit.
        breadcrumbs: [],
        breadcrumbCount: 0,
        milestones: [],
        hasActiveSos: false,
        totalDistanceKm: ride.estimatedDistanceKm || 0,
        currentEtaMinutes: ride.estimatedDurationMin || null,
      },
    },
    { upsert: true, new: true },
  );
};

const lockCanonicalRouteAsync = (ride, trackingId) => {
  if (!ride.pickup?.coordinates || !ride.dropoff?.coordinates) return;
  calculateCanonicalRoute(ride.pickup.coordinates, ride.dropoff.coordinates)
    .then(async ({ distanceKm, durationMin, polyline }) => {
      await Promise.all([
        Ride.findByIdAndUpdate(ride._id, {
          $set: {
            estimatedDistanceKm: distanceKm,
            estimatedDurationMin: durationMin,
          },
        }),
        RideTracking.findByIdAndUpdate(trackingId, {
          $set: {
            totalDistanceKm: distanceKm,
            currentEtaMinutes: durationMin,
            expectedRoutePolyline: polyline,
          },
        }),
      ]);
    })
    .catch((e) => console.error("[lockCanonicalRoute]", e.message));
};

/**
 * broadcastRideStatus — milestone recorded by userId, not Driver._id.
 * Use ride.createdBy or resolved driver user ID for recordedByUserId.
 */
const broadcastRideStatus = async ({
  ride,
  newStatus,
  extraPayload = {},
  socketService,
  driverUserId = null,
}) => {
  if (!socketService) return;
  const event = STATUS_SOCKET_EVENT[newStatus];
  if (!event) return;

  const basePayload = {
    rideId: String(ride._id),
    bookingId: ride.booking ? String(ride.booking) : null,
    status: newStatus,
    timestamp: new Date().toISOString(),
    ...extraPayload,
  };

  if (ride.booking)
    socketService.emitToRoom(`booking:${ride.booking}`, event, basePayload);
  socketService.emitToAdminOps("ride_status_changed", {
    ...basePayload,
    event,
  });

  const milestoneName = STATUS_MILESTONE[newStatus];
  if (milestoneName) {
    const coords = ride.liveLocation?.coordinates || null;
    try {
      await RideTracking.addMilestone(String(ride._id), milestoneName, {
        coordinates: coords,
        recordedBy: "driver",
        recordedByUserId: driverUserId || ride.createdBy, // User._id, not Driver._id
      });
    } catch (e) {
      console.error("[broadcastRideStatus] milestone:", e.message);
    }
  }
};



// ═══════════════════════════════════════════════════════════════
// POST /ride-requests/quote  (customer OR care_assistant)
// Validates booking, computes fare off booking.customer's subscription,
// creates a pending intent + (if fee>0) a Razorpay order. NO ride yet.
// ═══════════════════════════════════════════════════════════════
router.post("/quote", protect, authorize("customer", "care_assistant"), async (req, res) => {
  try {
    const { bookingId, bookingCode, pickupLocation, destinationLocation, scheduledAt, notes } = req.body;

    // FIX: accept EITHER bookingId (Mongo _id) OR bookingCode (human code).
    if (!bookingId && !bookingCode)
      return res.status(400).json({ success: false, message: "bookingId or bookingCode required" });

    const locErr = validateLocations(pickupLocation, destinationLocation);
    if (locErr) return res.status(400).json({ success: false, message: locErr });

    // Prefer valid ObjectId match; else fall back to bookingCode lookup.
    const bookingFilter =
      bookingId && isValidObjId(bookingId) ? { _id: bookingId } : { bookingCode };

    let booking, requesterRole;
    if (req.user.role === "customer") {
      booking = await Booking.findOne({ ...bookingFilter, customer: req.user._id }).select("_id customer bookingCode scheduledAt").lean();
      if (!booking) return res.status(404).json({ success: false, message: "Booking not found or not yours" });
      requesterRole = "customer";
    } else {
      const profile = await CareAssistantProfile.findOne({ user: req.user._id }).select("_id").lean();
      if (!profile) return res.status(404).json({ success: false, message: "Care assistant profile not found" });
      booking = await Booking.findOne({ ...bookingFilter, careAssistant: profile._id, status: { $in: ["confirmed", "in_progress"] } })
        .select("_id customer bookingCode scheduledAt").lean();
      if (!booking) return res.status(404).json({ success: false, message: "Booking not found or not assigned to you" });
      requesterRole = "care_assistant";
    }

    const activeRide = await Ride.findOne({ booking: booking._id, status: { $in: RIDE_STATUSES_ACTIVE } }).select("_id").lean();
    if (activeRide) return res.status(400).json({ success: false, message: "Active ride already exists on this booking" });

    // FARE — always keyed off booking.customer's own subscription, regardless of who's requesting.
    const { ratePerKm, source: rateSource } = await resolveKmRate(booking.customer);
    const distKm = haversineKm(pickupLocation.coordinates, destinationLocation.coordinates);
    const transportFee = +(distKm * ratePerKm).toFixed(2);

    await RidePaymentIntent.deleteMany({ booking: booking._id, requestedBy: req.user._id, status: "pending" }); // clear stale intents

    const intent = await RidePaymentIntent.create({
      booking: booking._id, bookingCode: booking.bookingCode, requestedBy: req.user._id, requesterRole,
      pickup: buildGeo(pickupLocation), dropoff: buildGeo(destinationLocation),
      scheduledAt: scheduledAt || booking.scheduledAt || null, notes: notes || null,
      distKm: +distKm.toFixed(2), ratePerKm, rateSource, transportFee,
      expiresAt: new Date(Date.now() + INTENT_TTL_MIN * 60 * 1000),
    });

    const requiresPayment = transportFee > 0;
    let razorpayOrder = null;
    if (requiresPayment) {
      razorpayOrder = await createRazorpayOrder(transportFee, `${booking.bookingCode}-RIDE`, { intentId: String(intent._id) });
      intent.razorpayOrderId = razorpayOrder.orderId;
      await intent.save();
    }

    const wallet = await Wallet.findOne({ user: req.user._id }).select("balance lockedBalance").lean();
    const walletAvailable = wallet ? Math.max(0, +(wallet.balance - (wallet.lockedBalance || 0)).toFixed(2)) : 0;

    return res.status(201).json({
      success: true,
      data: {
        intentId: intent._id, distKm: intent.distKm, ratePerKm, rateSource, transportFee, requiresPayment,
        razorpay: razorpayOrder ? { orderId: razorpayOrder.orderId, amount: transportFee, keyId: process.env.RAZORPAY_KEY_ID } : null,
        walletAvailable, walletSufficient: walletAvailable >= transportFee,
        expiresAt: intent.expiresAt,
      },
    });
  } catch (err) {
    console.error("[POST /quote]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /ride-requests/confirm — pay, THEN create ride.
// paymentMethod: 'razorpay' | 'wallet'
// ═══════════════════════════════════════════════════════════════
router.post("/confirm", protect, authorize("customer", "care_assistant"), async (req, res) => {
  try {
    const { intentId, paymentMethod, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!intentId || !isValidObjId(intentId))
      return res.status(400).json({ success: false, message: "Valid intentId required" });

    const intent = await RidePaymentIntent.findOne({ _id: intentId, requestedBy: req.user._id, status: "pending" });
    if (!intent) return res.status(404).json({ success: false, message: "Intent not found, already used, or expired" });
    if (intent.expiresAt < new Date()) {
      intent.status = "expired"; await intent.save();
      return res.status(400).json({ success: false, message: "Quote expired — request a new one" });
    }

    const activeRide = await Ride.findOne({ booking: intent.booking, status: { $in: RIDE_STATUSES_ACTIVE } }).select("_id").lean();
    if (activeRide) return res.status(400).json({ success: false, message: "Active ride already exists on this booking" });

    let paymentRecord = null;

    if (intent.transportFee > 0) {
      if (paymentMethod === "razorpay") {
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
          return res.status(400).json({ success: false, message: "Razorpay payment fields required" });
        if (razorpay_order_id !== intent.razorpayOrderId)
          return res.status(400).json({ success: false, message: "Order mismatch" });
        const ok = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (!ok) return res.status(400).json({ success: false, message: "Payment signature verification failed" });

        paymentRecord = { gateway: "Razorpay", transactionId: razorpay_payment_id, orderId: razorpay_order_id, paymentMode: "UPI", amount: intent.transportFee, status: "success", paidAt: new Date() };
      } else if (paymentMethod === "wallet") {
        const wallet = await Wallet.findOne({ user: req.user._id });
        if (!wallet) return res.status(404).json({ success: false, message: "Wallet not found" });
        if (wallet.availableBalance < intent.transportFee)
          return res.status(400).json({ success: false, message: `Insufficient wallet balance. Available: ₹${wallet.availableBalance}` });
        await wallet.debit(intent.transportFee, "Booking_Payment", { referenceId: intent.booking, onModel: "Booking", description: `Ride transport fee — ${intent.bookingCode}`, initiatedBy: req.user._id });

        paymentRecord = { gateway: "Wallet", transactionId: `WALLET-${Date.now()}`, paymentMode: "Wallet", amount: intent.transportFee, status: "success", paidAt: new Date() };
      } else {
        return res.status(400).json({ success: false, message: "paymentMethod must be 'razorpay' or 'wallet'" });
      }
    }

    // Payment done (or free) — now create the ride.
    const { ride } = await createRideRequest({
      pickupGeo: intent.pickup, dropoffGeo: intent.dropoff, scheduledAt: intent.scheduledAt,
      bookingId: intent.booking, createdBy: req.user._id,
      careAssistantId: intent.requesterRole === "care_assistant"
        ? (await CareAssistantProfile.findOne({ user: req.user._id }).select("_id").lean())?._id : null,
    });

    const bookingUpdate = {
      $push: { rides: ride._id, ...(paymentRecord ? { payments: paymentRecord } : {}) },
      $set: { primaryRide: ride._id, patientLocation: intent.pickup, destinationLocation: intent.dropoff, "fareBreakdown.transportFee": intent.transportFee },
      $inc: paymentRecord ? { "fareBreakdown.amountPaid": paymentRecord.amount, "fareBreakdown.totalAmount": paymentRecord.amount } : {},
    };
    const updatedBooking = await Booking.findByIdAndUpdate(intent.booking, bookingUpdate, { new: true }).select("customer fareBreakdown").lean();
    if (paymentRecord) {
      const isFull = (updatedBooking.fareBreakdown?.amountPaid || 0) >= (updatedBooking.fareBreakdown?.totalAmount || 0);
      await Booking.findByIdAndUpdate(intent.booking, { $set: { paymentStatus: isFull ? "paid" : "partially_paid" } });
    }

    intent.status = "paid"; intent.paymentMethod = paymentMethod || null; intent.createdRideId = ride._id;
    await intent.save();

    getBookingSocketService()?.emitJoinRoom(String(updatedBooking.customer), `booking:${intent.booking}`);
    getBookingSocketService()?.emitToAdminOps("ride_requested", {
      rideId: ride._id, bookingId: intent.booking, bookingCode: intent.bookingCode, requesterType: intent.requesterRole,
      distKm: intent.distKm, ratePerKm: intent.ratePerKm, rateSource: intent.rateSource, transportFee: intent.transportFee,
      paymentMethod, timestamp: new Date(),
    });

    return res.status(201).json({
      success: true, message: "Payment confirmed. Ride requested — waiting for driver assignment.",
      data: { rideId: ride._id, bookingId: intent.booking, transportFee: intent.transportFee, status: "searching" },
    });
  } catch (err) {
    console.error("[POST /confirm]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// GET /:rideId
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  "/:rideId",
  protect,
  authorize(
    "customer",
    "care_assistant",
    "driver",
    "solodriverpartner",
    "transportpartner",
    "admin",
    "superadmin",
  ),
  async (req, res) => {
    try {
      if (!isValidObjId(req.params.rideId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid rideId" });

      const ride = await Ride.findById(req.params.rideId)
        .select("-pickupOtp")
        .populate("booking", "bookingCode bookingType status")
        .lean();
      if (!ride)
        return res
          .status(404)
          .json({ success: false, message: "Ride not found" });

      const { allowed, reason } = await canAccessRide(
        String(req.user._id),
        req.user.role,
        ride,
      );
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      return res.json({ success: true, data: { ride } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — GET /admin/all
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  "/admin/all",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    try {
      const { status = "searching", page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const [rides, total] = await Promise.all([
        Ride.find({ status })
          .select("-pickupOtp")
          .populate(
            "booking",
            "bookingCode bookingType customer patientInfo status",
          )
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        Ride.countDocuments({ status }),
      ]);
      return res.json({
        success: true,
        data: {
          rides,
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — GET /admin/:rideId/nearby
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  "/admin/:rideId/nearby",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    try {
      if (!isValidObjId(req.params.rideId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid rideId" });

      const ride = await Ride.findById(req.params.rideId)
        .select("pickup dropoff booking")
        .lean();
      if (!ride)
        return res
          .status(404)
          .json({ success: false, message: "Ride not found" });

      const coords = ride.pickup?.coordinates;
      if (!coords?.length)
        return res
          .status(400)
          .json({ success: false, message: "Ride has no pickup coordinates" });

      const [lng, lat] = coords;

      const [soloDrivers, agencyDrivers, tps] = await Promise.all([
        // Solo drivers — query SoloDriverPartner directly (no Driver doc)
        // Vehicle geo query via Vehicle collection for dispatch-ready solos
        SoloDriverPartner.find({
          partnershipStatus: "active",
          isOnboardingComplete: true,
          isAvailable: true,
          "dispatch.status": "Available",
        })
          .select(
            "_id partnerCode legalName phone vehicleStatus dispatch rating user",
          )
          .limit(15)
          .lean(),

        // Agency drivers — query Driver model (requires ownerAgency)
        Driver.find({
          ownerAgency: { $ne: null },
          isActive: true,
          isVerified: true,
          isBlocked: false,
          status: "Available",
          location: {
            $geoWithin: { $centerSphere: [[lng, lat], CARE_RIDE_RADIUS_RAD] },
          },
        })
          .populate("ownerAgency", "businessName partnershipStatus")
          .select(
            "_id driverCode legalName phone location performance assignedVehicleSnapshot ownerAgency user",
          )
          .limit(15)
          .lean(),

        TransportPartner.find({
          partnershipStatus: "active",
          isAvailable: true,
        })
          .select(
            "_id businessName ownerPhone fleetInfo serviceZones isOnboardingComplete",
          )
          .limit(10)
          .lean(),
      ]);

      const booking = ride.booking
        ? await Booking.findById(ride.booking).select("customer").lean()
        : null;
      const { ratePerKm, source: rateSource } = booking
        ? await resolveCareRideKmRate(booking.customer)
        : { ratePerKm: 21, source: "care_ride_default" };

      const distKm = ride.dropoff?.coordinates
        ? haversineKm(coords, ride.dropoff.coordinates)
        : 0;

      return res.json({
        success: true,
        data: {
          rideId: ride._id,
          searchRadiusKm: 30,
          ratePerKm,
          rateSource,
          distKm: +distKm.toFixed(2),
          estimatedFare: +(distKm * ratePerKm).toFixed(2),

          // Solo drivers — assignId in /assign body = SoloDriverPartner._id
          soloDrivers: soloDrivers.map((sp) => ({
            soloPartnerId: sp._id, // use this as assignId for solo assign
            partnerCode: sp.partnerCode,
            name: sp.legalName,
            phone: sp.phone,
            vehicle: sp.vehicleStatus,
            rating: sp.rating?.averageRating,
            dispatchStatus: sp.dispatch?.status,
          })),

          // Agency drivers — assignId in /assign body = Driver._id
          agencyDrivers: agencyDrivers
            .filter((d) => d.ownerAgency?.partnershipStatus === "active")
            .map((d) => ({
              driverId: d._id, // use this as assignId for agency assign
              agencyId: d.ownerAgency?._id,
              agencyName: d.ownerAgency?.businessName,
              name: d.legalName,
              phone: d.phone,
              vehicle: d.assignedVehicleSnapshot,
              rating: d.performance?.rating,
              distanceKm: +haversineKm(
                coords,
                d.location?.coordinates || [0, 0],
              ).toFixed(1),
            })),

          transportPartners: tps
            .filter((tp) => tp.isOnboardingComplete)
            .map((tp) => ({
              tpId: tp._id,
              businessName: tp.businessName,
              ownerPhone: tp.ownerPhone,
              totalDrivers: tp.fleetInfo?.totalDrivers || 0,
              activeDrivers: tp.fleetInfo?.activeDrivers || 0,
            })),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// ADMIN — POST /admin/:rideId/assign
// Body: { assignType: 'tp' | 'solo' | 'agency_driver', assignId }
//   tp:           assignId = TransportPartner._id
//   solo:         assignId = SoloDriverPartner._id
//   agency_driver: assignId = Driver._id (direct agency driver assign without TP step)
// ═════════════════════════════════════════════════════════════════════════════

router.post(
  "/admin/:rideId/assign",
  protect,
  authorize("admin", "superadmin"),
  async (req, res) => {
    try {
      const { assignType, assignId } = req.body;

      if (!["tp", "solo", "agency_driver"].includes(assignType))
        return res
          .status(400)
          .json({
            success: false,
            message: "assignType must be tp | solo | agency_driver",
          });
      if (!assignId || !isValidObjId(assignId))
        return res
          .status(400)
          .json({
            success: false,
            message: "assignId (valid ObjectId) required",
          });
      if (!isValidObjId(req.params.rideId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid rideId" });

      const ride = await Ride.findById(req.params.rideId);
      if (!ride)
        return res
          .status(404)
          .json({ success: false, message: "Ride not found" });
      if (!["searching", "requested"].includes(ride.status))
        return res
          .status(400)
          .json({
            success: false,
            message: `Cannot assign from status: ${ride.status}`,
          });

      const socketService = getBookingSocketService();

      // ── Assign Transport Partner ──────────────────────────────────────────
      if (assignType === "tp") {
        const tp = await TransportPartner.findOne({
          _id: assignId,
          partnershipStatus: "active",
          isAvailable: true,
        })
          .populate("user", "name phone email")
          .lean();
        if (!tp)
          return res
            .status(404)
            .json({
              success: false,
              message: "Transport partner not found or not active",
            });

        ride.transportPartner = tp._id;
        ride.status = "searching"; // TP still needs to assign driver
        await ride.save();

        await createNotification({
          recipient: tp.user._id,
          title: "New Ride Request",
          body: "New ride assigned to your fleet. Please assign a driver.",
          type: "Ride_Request",
          bookingId: ride.booking,
        });

        socketService?.emitToRoom(`tp:${tp._id}`, "ride_request_assigned", {
          rideId: ride._id,
          pickup: ride.pickup,
          destination: ride.dropoff,
          scheduledAt: ride.scheduledPickupAt,
          timestamp: new Date(),
        });
        socketService?.emitToAdminOps("ride_driver_assigned", {
          rideId: ride._id,
          type: "tp_pending_driver",
          tpId: tp._id,
          tpName: tp.businessName,
          timestamp: new Date(),
        });

        return res.json({
          success: true,
          message:
            "Transport partner assigned. Waiting for driver assignment from TP.",
          data: { rideId: ride._id, assignedTo: "tp", tpId: tp._id },
        });
      }

      // ── Assign Solo Driver ────────────────────────────────────────────────
      // assignId = SoloDriverPartner._id
      // Ride.driver stays null — solo driver identified via ride.soloPartner
      if (assignType === "solo") {
        const soloPartner = await SoloDriverPartner.findOne({
          _id: assignId,
          partnershipStatus: "active",
          isOnboardingComplete: true,
        })
          .populate("user", "name phone")
          .lean();
        if (!soloPartner)
          return res
            .status(404)
            .json({
              success: false,
              message: "Solo driver not found or not active",
            });

        // ride.driver = null for solo (no Driver doc)
        ride.driver = null;
        ride.soloPartner = soloPartner._id;
        ride.transportPartner = null;
        ride.status = "driver_assigned";
        ride.driverAssignedAt = new Date();
        await ride.save();

        // Update solo dispatch state
        await SoloDriverPartner.findByIdAndUpdate(soloPartner._id, {
          $set: {
            "dispatch.status": "On-Trip",
            "dispatch.currentRide": ride._id,
            "dispatch.lastStatusAt": new Date(),
          },
        });

        const tracking = await ensureRideTracking(ride);
        lockCanonicalRouteAsync(ride, tracking._id);

        await createNotification({
          recipient: soloPartner.user._id,
          title: "New Ride Assigned",
          body: "New ride request assigned to you.",
          type: "Ride_Request",
          bookingId: ride.booking,
        });

        if (ride.booking) {
          socketService?.emitJoinRoom(
            String(soloPartner.user._id),
            `booking:${ride.booking}`,
          );
          socketService?.emitToRoom(
            `booking:${ride.booking}`,
            "ride_assigned",
            {
              rideId: ride._id,
              bookingId: String(ride.booking),
              status: "driver_assigned",
              driverSnapshot: {
                name: soloPartner.user.name,
                phone: soloPartner.user.phone,
              },
              timestamp: new Date().toISOString(),
            },
          );
        }

        socketService?.emitToAdminOps("ride_driver_assigned", {
          rideId: ride._id,
          driverName: soloPartner.user.name,
          type: "solo",
          timestamp: new Date(),
        });

        return res.json({
          success: true,
          message: "Solo driver assigned.",
          data: {
            rideId: ride._id,
            assignedTo: "solo",
            soloPartnerId: soloPartner._id,
          },
        });
      }

      // ── Assign Agency Driver directly (admin bypasses TP step) ───────────
      // assignId = Driver._id
      if (assignType === "agency_driver") {
        const driver = await Driver.findOne({
          _id: assignId,
          isActive: true,
          isVerified: true,
          isBlocked: false,
          status: "Available",
        })
          .select("_id user assignedVehicleSnapshot performance ownerAgency")
          .populate("user", "name phone")
          .lean();
        if (!driver)
          return res
            .status(404)
            .json({
              success: false,
              message: "Driver not found or not available",
            });

        ride.driver = driver._id; // Driver._id
        ride.transportPartner = driver.ownerAgency; // auto-set agency
        ride.soloPartner = null;
        ride.status = "driver_assigned";
        ride.driverAssignedAt = new Date();
        await ride.save();

        const tracking = await ensureRideTracking(ride);
        lockCanonicalRouteAsync(ride, tracking._id);

        await createNotification({
          recipient: driver.user._id,
          title: "New Ride Assigned",
          body: "New ride request assigned to you.",
          type: "Ride_Request",
          bookingId: ride.booking,
        });

        if (ride.booking) {
          socketService?.emitJoinRoom(
            String(driver.user._id),
            `booking:${ride.booking}`,
          );
          socketService?.emitToRoom(
            `booking:${ride.booking}`,
            "ride_assigned",
            {
              rideId: ride._id,
              bookingId: String(ride.booking),
              status: "driver_assigned",
              driverSnapshot: {
                name: driver.user.name,
                phone: driver.user.phone,
                rating: driver.performance?.rating,
                vehicleNumber:
                  driver.assignedVehicleSnapshot?.registrationNumber,
              },
              timestamp: new Date().toISOString(),
            },
          );
        }

        socketService?.emitToAdminOps("ride_driver_assigned", {
          rideId: ride._id,
          driverName: driver.user.name,
          type: "agency",
          timestamp: new Date(),
        });

        return res.json({
          success: true,
          message: "Agency driver assigned.",
          data: {
            rideId: ride._id,
            assignedTo: "agency_driver",
            driverId: driver._id,
          },
        });
      }
    } catch (err) {
      console.error("[POST /admin/:rideId/assign]", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// TP — PATCH /tp/:rideId/assign-driver
// Body: { driverId }  ← Driver._id (agency driver under this TP)
// ═════════════════════════════════════════════════════════════════════════════

router.patch(
  "/tp/:rideId/assign-driver",
  protect,
  authorize("transportpartner"),
  async (req, res) => {
    try {
      const { driverId } = req.body; // Driver._id
      if (!driverId || !isValidObjId(driverId))
        return res
          .status(400)
          .json({ success: false, message: "driverId (Driver._id) required" });
      if (!isValidObjId(req.params.rideId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid rideId" });

      const tp = await TransportPartner.findOne({ user: req.user._id })
        .select("_id")
        .lean();
      if (!tp)
        return res
          .status(404)
          .json({ success: false, message: "Transport partner not found" });

      const ride = await Ride.findOne({
        _id: req.params.rideId,
        transportPartner: tp._id,
        status: "searching",
      });
      if (!ride)
        return res
          .status(404)
          .json({
            success: false,
            message: "Ride not found or not assigned to your fleet",
          });

      const driver = await Driver.findOne({
        _id: driverId,
        ownerAgency: tp._id, // must belong to this TP's agency
        isActive: true,
        isVerified: true,
        isBlocked: false,
        status: "Available",
      })
        .select("_id user assignedVehicleSnapshot performance")
        .populate("user", "name phone")
        .lean();
      if (!driver)
        return res
          .status(404)
          .json({
            success: false,
            message: "Driver not found or not available in your fleet",
          });

      ride.driver = driver._id; // Driver._id
      ride.soloPartner = null; // ensure clean
      ride.status = "driver_assigned";
      ride.driverAssignedAt = new Date();
      await ride.save();

      const tracking = await ensureRideTracking(ride);
      lockCanonicalRouteAsync(ride, tracking._id);

      await createNotification({
        recipient: driver.user._id,
        title: "Ride Assigned",
        body: "New ride assigned by your transport partner.",
        type: "Ride_Request",
        bookingId: ride.booking,
      });

      const socketService = getBookingSocketService();
      if (ride.booking) {
        socketService?.emitJoinRoom(
          String(driver.user._id),
          `booking:${ride.booking}`,
        );
        socketService?.emitToRoom(`booking:${ride.booking}`, "ride_assigned", {
          rideId: ride._id,
          bookingId: String(ride.booking),
          status: "driver_assigned",
          driverSnapshot: {
            name: driver.user.name,
            phone: driver.user.phone,
            rating: driver.performance?.rating,
            vehicleNumber: driver.assignedVehicleSnapshot?.registrationNumber,
          },
          timestamp: new Date().toISOString(),
        });
      }

      socketService?.emitToAdminOps("ride_driver_assigned", {
        rideId: ride._id,
        driverName: driver.user.name,
        type: "agency",
        tpId: tp._id,
        timestamp: new Date(),
      });

      return res.json({
        success: true,
        message: "Driver assigned to ride.",
        data: { rideId: ride._id, driverId: driver._id, status: ride.status },
      });
    } catch (err) {
      console.error("[PATCH /tp/:rideId/assign-driver]", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// DRIVER STATE MACHINE — PATCH /:rideId/status
// Accepts both agency drivers (role=driver) and solo drivers (role=solodriverpartner)
// ═════════════════════════════════════════════════════════════════════════════

router.patch(
  "/:rideId/status",
  protect,
  authorize("driver", "solodriverpartner", "admin", "superadmin"),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const { action, otp, stopIndex, cancelReason, eta } = req.body;

      if (!isValidObjId(rideId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid rideId" });
      if (!action)
        return res
          .status(400)
          .json({ success: false, message: "action required" });

      const ride = await Ride.findById(rideId);
      if (!ride)
        return res
          .status(404)
          .json({ success: false, message: "Ride not found" });

      const isAdmin = ["admin", "superadmin"].includes(req.user.role);
      const { allowed, reason } = isAdmin
        ? { allowed: true }
        : await canUserMutateRideAsDriver(
            String(req.user._id),
            req.user.role,
            ride,
          );
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      const socketService = getBookingSocketService();
      const currentStatus = ride.status;

      // Resolve driver's User._id once for milestone recording
      const driverUserId = isAdmin ? null : req.user._id;

      switch (action) {
        // ── ACCEPT ─────────────────────────────────────────────────────────
        case "accept": {
          if (currentStatus !== "driver_assigned")
            return res
              .status(400)
              .json({
                success: false,
                message: `Cannot accept from: ${currentStatus}`,
              });

          ride.status = "driver_accepted";
          ride.driverAcceptedAt = new Date();
          await ride.save();

          await broadcastRideStatus({
            ride,
            newStatus: "driver_accepted",
            socketService,
            driverUserId,
          });

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId,
            title: "Driver Accepted",
            body: "Your driver has accepted the ride.",
            type: "Ride_Update",
            bookingId: ride.booking,
          });

          return res.json({
            success: true,
            message: "Ride accepted.",
            data: { status: "driver_accepted" },
          });
        }

        // ── START_ROUTE ────────────────────────────────────────────────────
        case "start_route": {
          if (currentStatus !== "driver_accepted")
            return res
              .status(400)
              .json({
                success: false,
                message: `Cannot start_route from: ${currentStatus}`,
              });

          ride.status = "driver_en_route";
          ride.driverEnRouteAt = new Date();
          await ride.save();

          const trackingEta = await RideTracking.findOne({ ride: rideId })
            .select("currentEtaMinutes expectedRoutePolyline")
            .lean();

          await broadcastRideStatus({
            ride,
            newStatus: "driver_en_route",
            socketService,
            driverUserId,
            extraPayload: {
              currentEtaMinutes: trackingEta?.currentEtaMinutes ?? null,
              expectedRoutePolyline: trackingEta?.expectedRoutePolyline ?? null,
              currentTarget: "pickup",
              driverSnapshot: ride.driverSnapshot,
              vehicleSnapshot: ride.vehicleSnapshot,
            },
          });

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId,
            title: "Driver On The Way",
            body: "Your driver is heading to your pickup location.",
            type: "Ride_Update",
            bookingId: ride.booking,
          });

          return res.json({
            success: true,
            message: "Driver en route.",
            data: { status: "driver_en_route" },
          });
        }

        // ── ARRIVED ────────────────────────────────────────────────────────
        case "arrived": {
          if (currentStatus !== "driver_en_route")
            return res
              .status(400)
              .json({
                success: false,
                message: `Cannot arrive from: ${currentStatus}`,
              });

          const otpCode = genOtp();
          ride.status = "driver_arrived";
          ride.driverArrivedAt = new Date();
          ride.pickupOtp = hashOtp(otpCode);
          await ride.save();

          await broadcastRideStatus({
            ride,
            newStatus: "driver_arrived",
            socketService,
            driverUserId,
            extraPayload: { currentTarget: "pickup", otp: otpCode },
          });

          const custId = await getCustomerFromRide(ride);
          const custUser = custId
            ? await User.findById(custId).select("email phone name").lean()
            : null;

          await createNotification({
            recipient: custId,
            title: "Driver Arrived",
            body: `Your driver has arrived. Share OTP ${otpCode} to start the ride.`,
            type: "Driver_Arrived",
            bookingId: ride.booking,
            priority: "High",
            otp: otpCode,
          });

          if (custUser?.phone) {
            sendSms({
              to: custUser.phone,
              message: otpSms({ otpCode, purpose: "ride start" }),
            }).catch((e) => console.error("[arrived] OTP SMS:", e.message));
          }

          if (custUser?.email) {
            import("../services/emailQueueService.js")
              .then(({ sendOtpEmail }) =>
                sendOtpEmail(custUser.email, {
                  rideId: String(ride._id),
                  otpCode,
                  title: "Your driver has arrived!",
                  body: "Share this OTP with your driver to start the ride.",
                }),
              )
              .catch((e) =>
                console.error("[arrived] queue OTP email:", e.message),
              );
          }

          const booking = ride.booking
            ? await Booking.findById(ride.booking).select("bookingCode").lean()
            : null;

          socketService?.emitOtpToAdmin({
            bookingId: ride.booking,
            bookingCode: booking?.bookingCode,
            rideId: ride._id,
            otp: otpCode,
            customerName: custUser?.name,
            customerPhone: custUser?.phone,
          });

          if (ride.booking) {
            socketService?.emitToRoom(
              `booking:${ride.booking}`,
              "otp_required",
              {
                bookingId: String(ride.booking),
                rideId: String(ride._id),
                currentTarget: "pickup",
                otp: otpCode,
                timestamp: new Date().toISOString(),
              },
            );
          }

          return res.json({
            success: true,
            message: "Driver arrived. OTP sent to customer.",
            data: { status: "driver_arrived" },
          });
        }

        // ── VERIFY_OTP ─────────────────────────────────────────────────────
        case "verify_otp": {
          if (currentStatus !== "driver_arrived")
            return res
              .status(400)
              .json({
                success: false,
                message: "OTP verify only when driver_arrived",
              });
          if (!otp)
            return res
              .status(400)
              .json({ success: false, message: "otp required" });

          const rideWithOtp = await Ride.findById(rideId)
            .select("+pickupOtp")
            .lean();
          if (!rideWithOtp?.pickupOtp)
            return res
              .status(400)
              .json({ success: false, message: "OTP not set for this ride" });

          if (
            hashOtp(String(otp).trim()) !== String(rideWithOtp.pickupOtp).trim()
          ) {
            socketService?.emitToAdminOps("otp_failed_attempt", {
              rideId,
              bookingId: ride.booking ? String(ride.booking) : null,
              timestamp: new Date().toISOString(),
            });
            if (ride.booking) {
              socketService?.emitToRoom(
                `booking:${ride.booking}`,
                "otp_wrong_attempt",
                {
                  bookingId: String(ride.booking),
                  timestamp: new Date().toISOString(),
                },
              );
            }
            return res
              .status(400)
              .json({ success: false, message: "Invalid OTP" });
          }

          ride.status = "otp_verified";
          ride.pickupOtpVerifiedAt = new Date();
          await ride.save();

          await broadcastRideStatus({
            ride,
            newStatus: "otp_verified",
            socketService,
            driverUserId,
          });

          socketService?.emitToAdminOps("otp_verified_success", {
            rideId: String(ride._id),
            bookingId: ride.booking ? String(ride.booking) : null,
            timestamp: new Date().toISOString(),
          });

          return res.json({
            success: true,
            message: "OTP verified.",
            data: { status: "otp_verified" },
          });
        }

        // ── START_RIDE ─────────────────────────────────────────────────────
        case "start_ride": {
          if (currentStatus !== "otp_verified")
            return res
              .status(400)
              .json({
                success: false,
                message: `Cannot start ride from: ${currentStatus}`,
              });

          ride.status = "in_progress";
          ride.rideStartedAt = new Date();
          await ride.save();

          await broadcastRideStatus({
            ride,
            newStatus: "in_progress",
            socketService,
            driverUserId,
            extraPayload: { rideStartedAt: ride.rideStartedAt.toISOString() },
          });

          const trackingDoc = await RideTracking.findOne({ ride: rideId })
            .select("expectedRoutePolyline")
            .lean();

          if (ride.booking) {
            socketService?.emitToRoom(
              `booking:${ride.booking}`,
              "navigation_target_changed",
              {
                bookingId: String(ride.booking),
                rideId: String(ride._id),
                currentTarget: "dropoff",
                coords: ride.dropoff?.coordinates,
                address: ride.dropoff?.address,
                polyline: trackingDoc?.expectedRoutePolyline || null,
                _serverTime: new Date().toISOString(),
              },
            );
          }

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId,
            title: "Ride Started",
            body: "Your ride has started. Have a safe journey!",
            type: "Ride_Update",
            bookingId: ride.booking,
          });

          return res.json({
            success: true,
            message: "Ride started.",
            data: { status: "in_progress" },
          });
        }

        // ── AT_STOP ────────────────────────────────────────────────────────
        case "at_stop": {
          if (currentStatus !== "in_progress")
            return res
              .status(400)
              .json({
                success: false,
                message: `Cannot mark stop from: ${currentStatus}`,
              });

          ride.status = "at_stop";
          await ride.save();

          const stopCoords = ride.liveLocation?.coordinates || null;
          await broadcastRideStatus({
            ride,
            newStatus: "at_stop",
            socketService,
            driverUserId,
            extraPayload: {
              stopIndex: stopIndex ?? null,
              coordinates: stopCoords,
            },
          });

          return res.json({
            success: true,
            message: "At stop.",
            data: { status: "at_stop", stopIndex },
          });
        }

        // ── RESUME ─────────────────────────────────────────────────────────
        case "resume": {
          if (currentStatus !== "at_stop")
            return res
              .status(400)
              .json({
                success: false,
                message: `Cannot resume from: ${currentStatus}`,
              });

          ride.status = "in_progress";
          await ride.save();

          if (ride.booking) {
            socketService?.emitToRoom(
              `booking:${ride.booking}`,
              "ride_resumed",
              {
                rideId: String(ride._id),
                bookingId: String(ride.booking),
                timestamp: new Date().toISOString(),
              },
            );
          }

          await RideTracking.addMilestone(String(ride._id), "stop_departed", {
            coordinates: ride.liveLocation?.coordinates || null,
            meta: { stopIndex: stopIndex ?? null },
            recordedBy: "driver",
            recordedByUserId: driverUserId,
          }).catch(() => {});

          return res.json({
            success: true,
            message: "Ride resumed.",
            data: { status: "in_progress" },
          });
        }

        // ── COMPLETE ───────────────────────────────────────────────────────
        case "complete": {
          if (!["in_progress", "at_stop"].includes(currentStatus))
            return res
              .status(400)
              .json({
                success: false,
                message: `Cannot complete from: ${currentStatus}`,
              });

          ride.status = "completed";
          ride.rideCompletedAt = new Date();

          const tracking = await RideTracking.findOne({ ride: rideId })
            .select("breadcrumbs totalDistanceKm breadcrumbCount")
            .lean();

          let actualDistanceKm = ride.estimatedDistanceKm || 0;
          if (tracking?.breadcrumbs?.length > 1) {
            const crumbs = tracking.breadcrumbs;
            let total = 0;
            for (let i = 1; i < crumbs.length; i++) {
              total += haversineKm(
                crumbs[i - 1].coordinates,
                crumbs[i].coordinates,
              );
            }
            actualDistanceKm = +total.toFixed(2);
          }

          ride.actualDistanceKm = actualDistanceKm;
          await ride.save();

          // NEW (Point 7): same stats accumulation as bookingRouterDriver.js.
          recordPartnerTripCompletion(ride).catch((e) =>
            console.error(
              "[ride status complete] recordPartnerTripCompletion failed:",
              e.message,
            ),
          );

          // Mark driver available — works for both agency and solo
          await markDriverAvailable(ride);

          const durationMin = ride.rideStartedAt
            ? Math.round(
                (ride.rideCompletedAt - new Date(ride.rideStartedAt)) / 60000,
              )
            : null;

          await RideTracking.findOneAndUpdate(
            { ride: rideId },
            {
              $set: {
                "summary.totalDistanceKm": actualDistanceKm,
                "summary.totalDurationMin": durationMin,
                "summary.isCompleted": true,
                "summary.completedAt": new Date(),
              },
            },
          );

          await broadcastRideStatus({
            ride,
            newStatus: "completed",
            socketService,
            driverUserId,
            extraPayload: { actualDistanceKm, durationMin },
          });

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId,
            title: "Ride Completed",
            body: `Your ride has ended. Distance: ${actualDistanceKm} km.`,
            type: "Ride_Update",
            bookingId: ride.booking,
          });

          return res.json({
            success: true,
            message: "Ride completed.",
            data: { status: "completed", actualDistanceKm, durationMin },
          });
        }

        // ── CANCEL ─────────────────────────────────────────────────────────
        case "cancel": {
          if (!CANCELLABLE_STATUSES.includes(currentStatus))
            return res
              .status(400)
              .json({
                success: false,
                message: `Cannot cancel from: ${currentStatus}`,
              });

          if (!isAdmin && !DRIVER_CANCELLABLE_STATUSES.includes(currentStatus))
            return res
              .status(403)
              .json({
                success: false,
                message: "Cannot cancel after driver arrived. Contact admin.",
              });

          // CHANGE (Point 2): a DRIVER cancelling is treated as a rejection —
          // auto-reassign to the next candidate instead of killing the ride.
          // An ADMIN explicitly cancelling still terminally cancels the ride
          // (admin intent is "stop this ride", not "find someone else").
          const isDriverCancel = !isAdmin;

          if (isDriverCancel) {
            ride.status = "searching";
            ride.cancellation = null;
            await ride.save();
            if (getRideDriverType(ride) === "agency" && ride.driver) {
              await Ride.findByIdAndUpdate(ride._id, {
                $addToSet: { declinedDrivers: ride.driver },
              });
            }
            await markDriverAvailable(ride);

            const reassignResult = await autoAssignNearestDriver(ride._id, {
              performedBy: req.user._id,
            }).catch((e) => {
              console.error(
                "[ride status cancel] auto-reassign failed:",
                e.message,
              );
              return { assigned: false, reason: e.message };
            });

            socketService?.emitToAdminOps("driver_cancelled_ride", {
              rideId: ride._id,
              bookingId: ride.booking ? String(ride.booking) : null,
              reason: cancelReason || "driver_cancel",
              autoReassigned: reassignResult.assigned,
              timestamp: new Date().toISOString(),
            });

            return res.json({
              success: true,
              message: reassignResult.assigned
                ? "Ride cancelled by driver. Automatically reassigned."
                : "Ride cancelled by driver. No other candidate available — admin must assign manually.",
              data: {
                status: reassignResult.assigned
                  ? "driver_assigned"
                  : "no_driver_found",
                autoReassigned: reassignResult.assigned,
              },
            });
          }

          // Admin cancel — terminal, as before.
          ride.status = "cancelled";
          ride.cancelledAt = new Date();
          ride.cancellation = {
            cancelledBy: "admin",
            cancelledByUserId: req.user._id,
            reason: cancelReason || "admin_cancel",
            cancelledAt: new Date(),
          };
          await ride.save();
          await markDriverAvailable(ride);

          await broadcastRideStatus({
            ride,
            newStatus: "cancelled",
            socketService,
            driverUserId,
            extraPayload: {
              cancelReason: cancelReason || null,
              cancelledBy: req.user.role,
            },
          });

          const custId = await getCustomerFromRide(ride);
          await createNotification({
            recipient: custId,
            title: "Ride Cancelled",
            body: `Your ride has been cancelled. Reason: ${ride.cancellation.reason}.`,
            type: "Ride_Update",
            bookingId: ride.booking,
          });

          return res.json({
            success: true,
            message: "Ride cancelled.",
            data: { status: "cancelled" },
          });
        }

        // ── COMPLETE_WAYPOINT ──────────────────────────────────────────────
        case "complete_waypoint": {
          const { waypointType } = req.body;
          if (!waypointType)
            return res
              .status(400)
              .json({ success: false, message: "waypointType required" });

          const rideWithWps = await Ride.findById(rideId)
            .select("waypoints booking")
            .lean();
          if (!rideWithWps)
            return res
              .status(404)
              .json({ success: false, message: "Ride not found" });

          const updatedWaypoints = (rideWithWps.waypoints || []).map((wp) => {
            if (wp.type === waypointType && !wp.isCompleted)
              return { ...wp, isCompleted: true, completedAt: new Date() };
            return wp;
          });

          await Ride.findByIdAndUpdate(rideId, {
            $set: { waypoints: updatedWaypoints },
          });

          await RideTracking.addMilestone(rideId, "care_assistant_joined", {
            meta: { event: "driver_picked_up_ca", waypointType },
            recordedBy: "driver",
            recordedByUserId: driverUserId,
          }).catch(() => {});

          if (ride.booking) {
            socketService?.emitToRoom(
              `booking:${ride.booking}`,
              "ca_join_waypoint_completed",
              {
                rideId: String(rideId),
                bookingId: String(ride.booking),
                waypointType,
                updatedWaypoints,
                timestamp: new Date().toISOString(),
                jpCompleted: true,
              },
            );
          }

          return res.json({
            success: true,
            message: `Waypoint '${waypointType}' marked completed.`,
            data: { waypointType, jpCompleted: true, updatedWaypoints },
          });
        }

        default:
          return res
            .status(400)
            .json({ success: false, message: `Unknown action: ${action}` });
      }
    } catch (err) {
      console.error("[PATCH /:rideId/status]", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /:rideId/tracking
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  "/:rideId/tracking",
  protect,
  authorize(
    "customer",
    "care_assistant",
    "driver",
    "solodriverpartner",
    "transportpartner",
    "admin",
    "superadmin",
  ),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const breadcrumbLimit = Math.min(
        parseInt(req.query.breadcrumbs) || 100,
        500,
      );

      if (!isValidObjId(rideId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid rideId" });

      const ride = await Ride.findById(rideId).select("-pickupOtp").lean();
      if (!ride)
        return res
          .status(404)
          .json({ success: false, message: "Ride not found" });

      const { allowed, reason } = await canAccessRide(
        String(req.user._id),
        req.user.role,
        ride,
      );
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      const tracking = await RideTracking.findOne({ ride: rideId })
        .select(
          "milestones breadcrumbs breadcrumbCount currentEtaMinutes currentEtaTarget " +
            "totalDistanceKm hasActiveSos hasUnacknowledgedDeviation sosEvents " +
            "routeDeviations summary expectedRoutePolyline actualRoutePolyline " +
            "etaUpdates createdAt updatedAt",
        )
        .lean();

      let breadcrumbs = [];
      let breadcrumbCount = 0;
      if (tracking) {
        breadcrumbs = (tracking.breadcrumbs || []).slice(-breadcrumbLimit);
        breadcrumbCount = tracking.breadcrumbCount || 0;
        delete tracking.breadcrumbs;
      }

      let sosEvents = tracking?.sosEvents || [];
      if (req.user.role === "customer") {
        sosEvents = sosEvents.map((e) => ({
          sosType: e.sosType,
          triggeredAt: e.triggeredAt,
          isResolved: e.isResolved,
          resolvedAt: e.resolvedAt,
        }));
      }

      return res.json({
        success: true,
        data: {
          ride: {
            _id: ride._id,
            rideCode: ride.rideCode,
            status: ride.status,
            rideType: ride.rideType,
            pickup: ride.pickup,
            dropoff: ride.dropoff,
            stops: ride.stops,
            liveLocation: ride.liveLocation,
            currentEtaMinutes: ride.currentEtaMinutes,
            driverSnapshot: ride.driverSnapshot,
            vehicleSnapshot: ride.vehicleSnapshot,
            scheduledPickupAt: ride.scheduledPickupAt,
            driverAssignedAt: ride.driverAssignedAt,
            driverArrivedAt: ride.driverArrivedAt,
            rideStartedAt: ride.rideStartedAt,
            rideCompletedAt: ride.rideCompletedAt,
            estimatedDistanceKm: ride.estimatedDistanceKm,
            estimatedDurationMin: ride.estimatedDurationMin,
            actualDistanceKm: ride.actualDistanceKm,
          },
          tracking: tracking
            ? {
                currentEtaMinutes: tracking.currentEtaMinutes,
                currentEtaTarget: tracking.currentEtaTarget,
                totalDistanceKm: tracking.totalDistanceKm,
                hasActiveSos: tracking.hasActiveSos,
                hasUnacknowledgedDeviation: tracking.hasUnacknowledgedDeviation,
                milestones: tracking.milestones || [],
                breadcrumbs,
                breadcrumbCount,
                totalBreadcrumbsInWindow: breadcrumbs.length,
                sosEvents,
                routeDeviations: tracking.routeDeviations || [],
                expectedRoutePolyline: tracking.expectedRoutePolyline,
                actualRoutePolyline: tracking.actualRoutePolyline,
                summary: tracking.summary,
                lastUpdatedAt: tracking.updatedAt,
              }
            : null,
          socketHint: ride.booking
            ? {
                room: `booking:${ride.booking}`,
                events: [
                  "location_update",
                  "eta_update",
                  "ride_status_changed",
                ],
              }
            : null,
          _serverTime: new Date().toISOString(),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /:rideId/live
// ═════════════════════════════════════════════════════════════════════════════

router.get(
  "/:rideId/live",
  protect,
  authorize(
    "customer",
    "care_assistant",
    "driver",
    "solodriverpartner",
    "transportpartner",
    "admin",
    "superadmin",
  ),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      if (!isValidObjId(rideId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid rideId" });

      const ride = await Ride.findById(rideId)
        .select(
          "status liveLocation currentEtaMinutes booking driver soloPartner driverSnapshot vehicleSnapshot pickup dropoff transportPartner",
        )
        .lean();
      if (!ride)
        return res
          .status(404)
          .json({ success: false, message: "Ride not found" });

      const { allowed, reason } = await canAccessRide(
        String(req.user._id),
        req.user.role,
        ride,
      );
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      const trackingEta = await RideTracking.findOne({ ride: rideId })
        .select("currentEtaMinutes currentEtaTarget hasActiveSos")
        .lean();

      const live = ride.liveLocation;
      const hasPosition = live?.coordinates?.length === 2;

      const socketService = getBookingSocketService();

      // Resolve driver online status — works for both agency and solo
      const driverUserIdForSocket = await getDriverUserId(ride);
      const isDriverOnline = driverUserIdForSocket
        ? (socketService?.isUserOnline(String(driverUserIdForSocket)) ?? false)
        : false;

      const isDriver = ["driver", "solodriverpartner"].includes(req.user.role);

      return res.json({
        success: true,
        data: {
          rideId: ride._id,
          status: ride.status,
          liveLocation: hasPosition
            ? {
                lat: live.coordinates[1],
                lng: live.coordinates[0],
                heading: live.heading ?? 0,
                speedKmh: live.speedKmh ?? 0,
                updatedAt: live.updatedAt,
              }
            : null,
          currentEtaMinutes:
            trackingEta?.currentEtaMinutes ?? ride.currentEtaMinutes ?? null,
          currentEtaTarget: trackingEta?.currentEtaTarget ?? null,
          hasActiveSos: trackingEta?.hasActiveSos ?? false,
          driverSnapshot: !isDriver
            ? {
                name: ride.driverSnapshot?.legalName,
                rating: ride.driverSnapshot?.rating,
                phone: ride.driverSnapshot?.phone,
                photoUrl: ride.driverSnapshot?.photoUrl,
              }
            : undefined,
          vehicleSnapshot: !isDriver
            ? {
                make: ride.vehicleSnapshot?.make,
                model: ride.vehicleSnapshot?.model,
                color: ride.vehicleSnapshot?.color,
                registrationNumber: ride.vehicleSnapshot?.registrationNumber,
                vehicleType: ride.vehicleSnapshot?.vehicleType,
              }
            : undefined,
          pickup: {
            lat: ride.pickup?.coordinates?.[1],
            lng: ride.pickup?.coordinates?.[0],
            label: ride.pickup?.label,
          },
          dropoff: {
            lat: ride.dropoff?.coordinates?.[1],
            lng: ride.dropoff?.coordinates?.[0],
            label: ride.dropoff?.label,
          },
          socketHint: {
            room: ride.booking ? `booking:${ride.booking}` : null,
            events: [
              "location_update",
              "eta_update",
              "driver_en_route",
              "driver_arrived",
              "ride_started",
              "ride_completed",
            ],
            isDriverOnline,
            pollingFallbackMs: isDriverOnline ? null : 5000,
          },
          _serverTime: new Date().toISOString(),
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// POST /:rideId/tracking/milestone
// ═════════════════════════════════════════════════════════════════════════════

router.post(
  "/:rideId/tracking/milestone",
  protect,
  authorize(
    "driver",
    "solodriverpartner",
    "care_assistant",
    "admin",
    "superadmin",
  ),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const {
        name,
        coordinates = null,
        stopSequence = null,
        meta = null,
      } = req.body;

      if (!isValidObjId(rideId))
        return res
          .status(400)
          .json({ success: false, message: "Invalid rideId" });
      if (!name)
        return res
          .status(400)
          .json({ success: false, message: "Milestone name required" });

      if (coordinates !== null) {
        if (!Array.isArray(coordinates) || coordinates.length !== 2)
          return res
            .status(400)
            .json({
              success: false,
              message: "coordinates must be [lng, lat]",
            });
        const [mLng, mLat] = coordinates;
        if (
          typeof mLng !== "number" ||
          typeof mLat !== "number" ||
          mLat < -90 ||
          mLat > 90 ||
          mLng < -180 ||
          mLng > 180
        )
          return res
            .status(400)
            .json({ success: false, message: "Invalid coordinates" });
      }

      const ride = await Ride.findById(rideId)
        .select("booking driver soloPartner status transportPartner")
        .lean();
      if (!ride)
        return res
          .status(404)
          .json({ success: false, message: "Ride not found" });

      const { allowed, reason } = await canAccessRide(
        String(req.user._id),
        req.user.role,
        ride,
      );
      if (!allowed)
        return res.status(403).json({ success: false, message: reason });

      const trackingExists = await RideTracking.exists({ ride: rideId });
      if (!trackingExists)
        return res
          .status(404)
          .json({ success: false, message: "RideTracking not found." });

      let recordedBy = "system";
      if (["driver", "solodriverpartner"].includes(req.user.role))
        recordedBy = "driver";
      else if (req.user.role === "care_assistant") recordedBy = "driver";
      else if (["admin", "superadmin"].includes(req.user.role))
        recordedBy = "admin";

      const updated = await RideTracking.addMilestone(rideId, name, {
        coordinates,
        stopSequence,
        meta,
        recordedBy,
        recordedByUserId: req.user._id, // User._id always
      });
      const newMilestone = updated?.milestones?.[updated.milestones.length - 1];

      const socketService = getBookingSocketService();
      if (ride.booking) {
        socketService?.emitToRoom(
          `booking:${ride.booking}`,
          "milestone_recorded",
          {
            rideId,
            bookingId: String(ride.booking),
            milestone: {
              name,
              occurredAt: newMilestone?.occurredAt ?? new Date().toISOString(),
              coordinates,
              stopSequence,
              meta,
              recordedBy,
            },
            _serverTime: new Date().toISOString(),
          },
        );
      }

      if (ADMIN_ALERT_MILESTONES.includes(name)) {
        socketService?.emitToAdminOps("milestone_alert", {
          rideId,
          bookingId: ride.booking ? String(ride.booking) : null,
          milestone: name,
          meta,
          coordinates,
          recordedBy: req.user.role,
          userId: String(req.user._id),
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(201).json({
        success: true,
        message: `Milestone '${name}' recorded.`,
        data: {
          rideId,
          milestone: {
            name,
            occurredAt: newMilestone?.occurredAt,
            coordinates,
            stopSequence,
            meta,
            recordedBy,
          },
          bookingRoom: ride.booking ? `booking:${ride.booking}` : null,
        },
      });
    } catch (err) {
      if (err.message?.startsWith("Unknown milestone name"))
        return res.status(400).json({ success: false, message: err.message });
      return res.status(500).json({ success: false, message: err.message });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// GET /:rideId/care-assistant-live
// ═════════════════════════════════════════════════════════════════════════════

router.get("/:rideId/care-assistant-live", protect, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.rideId)
      .select(
        "status liveLocation pickup dropoff waypoints booking driverSnapshot vehicleSnapshot trackingId",
      )
      .lean();
    if (!ride)
      return res
        .status(404)
        .json({ success: false, message: "Ride not found" });

    const tracking = await RideTracking.findOne({ ride: ride._id })
      .populate("hospital")
      .lean();

    const caJoinWaypoint =
      (ride.waypoints || []).find((w) => w.type === "care_assistant_join") ??
      null;
    const careAssistantStatus = tracking?.careAssistantStatus ?? "not_joined";
    const caHasJoined = careAssistantStatus === "in_ride";
    const caLiveLocation = tracking?.careAssistantLiveLocation ?? null;

    const fmtLoc = (loc) => {
      if (!loc?.coordinates || loc.coordinates.length !== 2) return null;
      return {
        lat: loc.coordinates[1],
        lng: loc.coordinates[0],
        heading: loc.heading ?? 0,
        speedKmh: loc.speedKmh ?? 0,
        updatedAt: loc.updatedAt,
      };
    };

    const role = req.user?.role ?? "unknown";

    if (role === "care_assistant") {
      if (caHasJoined) {
        return res.json({
          success: true,
          data: {
            caViewMode: "driver_tracking_only",
            careAssistantStatus,
            driverLiveLocation: fmtLoc(ride.liveLocation),
            driverSnapshot: ride.driverSnapshot,
            vehicleSnapshot: ride.vehicleSnapshot,
            dropoff: ride.dropoff,
            activeTarget: tracking?.activeTarget ?? "dropoff_destination",
            socketHint: {
              room: ride.booking ? `booking:${ride.booking}` : null,
              events: ["location_update"],
            },
            _serverTime: new Date().toISOString(),
          },
        });
      }
      return res.json({
        success: true,
        data: {
          caViewMode: "navigate_to_jp",
          careAssistantStatus,
          navigateTo: caJoinWaypoint
            ? {
                coordinates: caJoinWaypoint.location?.coordinates,
                address: caJoinWaypoint.location?.address,
                label: caJoinWaypoint.location?.label,
                isCompleted: caJoinWaypoint.isCompleted,
              }
            : null,
          driverLiveLocation: fmtLoc(ride.liveLocation),
          driverSnapshot: ride.driverSnapshot,
          pickup: ride.pickup,
          dropoff: ride.dropoff,
          activeTarget: tracking?.activeTarget,
          socketHint: {
            room: ride.booking ? `booking:${ride.booking}` : null,
            events: [
              "care_assistant_location_update",
              "location_update",
              "care_assistant_at_jp",
              "care_assistant_joined_ride",
            ],
          },
          _serverTime: new Date().toISOString(),
        },
      });
    }

    if (role === "driver" || role === "solodriverpartner") {
      return res.json({
        success: true,
        data: {
          activeTarget: tracking?.activeTarget ?? "pickup_patient",
          pickup: ride.pickup,
          dropoff: ride.dropoff,
          caJoinPoint: caJoinWaypoint
            ? {
                coordinates: caJoinWaypoint.location?.coordinates,
                address: caJoinWaypoint.location?.address,
                label: caJoinWaypoint.location?.label,
                isCompleted: caJoinWaypoint.isCompleted,
                completedAt: caJoinWaypoint.completedAt,
                zone: caJoinWaypoint.meta?.zone,
              }
            : null,
          caLiveLocation: !caHasJoined ? fmtLoc(caLiveLocation) : null,
          careAssistantStatus,
          caHasJoined,
          hospital: tracking?.hospital ?? null,
          liveRouteContext: tracking?.liveRouteContext ?? null,
          socketHint: {
            room: ride.booking ? `booking:${ride.booking}` : null,
            events: [
              "location_update",
              "care_assistant_location_update",
              "care_assistant_at_jp",
              "care_assistant_joined_ride",
              "ca_join_waypoint_completed",
              "eta_update",
            ],
          },
          _serverTime: new Date().toISOString(),
        },
      });
    }

    // Customer view
    return res.json({
      success: true,
      data: {
        driverLiveLocation: fmtLoc(ride.liveLocation),
        driverSnapshot: ride.driverSnapshot,
        vehicleSnapshot: ride.vehicleSnapshot,
        caLiveLocation: fmtLoc(caLiveLocation),
        careAssistantStatus,
        caHasJoined,
        caJoinPoint: caJoinWaypoint
          ? {
              coordinates: caJoinWaypoint.location?.coordinates,
              address: caJoinWaypoint.location?.address,
              label: caJoinWaypoint.location?.label,
              isCompleted: caJoinWaypoint.isCompleted,
              completedAt: caJoinWaypoint.completedAt,
            }
          : null,
        pickup: ride.pickup,
        dropoff: ride.dropoff,
        activeTarget: tracking?.activeTarget,
        currentEtaMinutes: tracking?.currentEtaMinutes ?? null,
        hasActiveSos: tracking?.hasActiveSos ?? false,
        hospital: tracking?.hospital ?? null,
        liveRouteContext: tracking?.liveRouteContext ?? null,
        socketHint: {
          room: ride.booking ? `booking:${ride.booking}` : null,
          events: [
            "location_update",
            "care_assistant_location_update",
            "care_assistant_at_jp",
            "care_assistant_joined_ride",
            "ca_join_waypoint_completed",
            "eta_update",
            "ride_status_changed",
          ],
        },
        _serverTime: new Date().toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
