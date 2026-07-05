import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const { Schema } = mongoose;

const generateRideCode = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  8,
);

// ─────────────────────────────────────────────────────────────────────────────
// RIDE MODEL — Likeson.in
//
// CHANGE SUMMARY (architecture redesign pass):
//   - REMOVED embedded `stops[]` and `waypoints[]` — they modeled the same
//     concept twice with overlapping enums. Replaced by the standalone
//     RideStop collection, referenced here via `currentStopId`.
//   - REMOVED `activeNavigationTarget` enum — exact "enum-based navigation"
//     pattern the workflow spec says to eliminate. Replaced by
//     `currentStopId` pointing at a real RideStop document.
//   - REMOVED `pickupOtp` / `pickupOtpVerifiedAt` — OTP now lives per-stop on
//     RideStop.otp, since multi-stop rides (pharmacy/lab/blood bank/hospital)
//     each need their own OTP, not just the initial pickup.
//   - `rideStage` is now a derived projection of `status` (+ currentStop's
//     type), synced in pre-save. Previously it was a second, independently
//     settable state machine that nothing ever actually synced — a live
//     drift bug. Kept as a field (backward-compatible for existing readers)
//     but no longer independently writable from outside this hook.
//   - Driver/CA replacement does NOT spawn a new Ride document. Same Ride,
//     `driver` field reassigned, history captured in AssignmentHistory.
// ─────────────────────────────────────────────────────────────────────────────

export const RIDE_TYPES = [
  "patient",
  "care_assistant",
  "diagnostic_tech",
  "pharmacy_delivery",
  "blood_bank",
];

export const RIDE_STATUSES = [
  "requested",
  "searching",
  "driver_assigned",
  "driver_accepted",
  "driver_en_route",
  "driver_arrived",
  "otp_verified",
  "in_progress",
  "at_stop",
  "completed",
  "cancelled",
  "no_driver_found",
];

export const RIDE_STAGES = [
  "searching_driver",
  "driver_to_care_assistant",
  "driver_to_patient",
  "patient_onboard",
  "care_assistant_joined",
  "enroute_hospital",
  "hospital_reached",
  "return_trip",
  "completed",
  "cancelled",
];

export const RIDE_VEHICLE_CLASSES = [
  "two_wheeler",
  "four_wheeler",
  "ambulance",
];

export const RIDE_CANCEL_ACTORS = ["customer", "driver", "admin", "system"];

// Max declined drivers stored per ride — prevents unbounded array growth.
const MAX_DECLINED_DRIVERS = 50;

// status → rideStage derivation map. Single source of truth = `status`;
// `rideStage` is a read-friendly projection, never independently set.
const STATUS_TO_STAGE = {
  requested: "searching_driver",
  searching: "searching_driver",
  driver_assigned: "searching_driver",
  driver_accepted: "driver_to_patient",
  driver_en_route: "driver_to_patient",
  driver_arrived: "driver_to_patient",
  otp_verified: "patient_onboard",
  in_progress: "enroute_hospital",
  at_stop: "enroute_hospital",
  completed: "completed",
  cancelled: "cancelled",
  no_driver_found: "cancelled",
};

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const rideGeoPointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
    label: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
    arrivedAt: { type: Date },
    departedAt: { type: Date },
  },
  { _id: false },
);

// REMOVED: stopSchema (was embedded stops[] — overlapped with waypoints[]).
// REMOVED: inline waypoints[] embedded array definition.
// Both responsibilities now live in the standalone RideStop collection.

const vehicleSnapshotSchema = new Schema(
  {
    vehicleCode: { type: String },
    registrationNumber: { type: String },
    make: { type: String },
    model: { type: String },
    color: { type: String },
    vehicleType: { type: String },
    vehicleClass: { type: String, enum: RIDE_VEHICLE_CLASSES },
    seatingCapacity: { type: Number },
    isWheelchairAccessible: { type: Boolean },
    hasStretcherSupport: { type: Boolean },
    hasOxygenSupport: { type: Boolean },
    hasAC: { type: Boolean },
  },
  { _id: false },
);

const driverSnapshotSchema = new Schema(
  {
    driverCode: { type: String },
    legalName: { type: String },
    phone: { type: String },
    photoUrl: { type: String },
    rating: { type: Number },
    licenceClass: [{ type: String }],
  },
  { _id: false },
);

const rideFareBreakdownSchema = new Schema(
  {
    baseFare: { type: Number, default: 0, min: 0 },
    distanceFare: { type: Number, default: 0, min: 0 },
    waitingCharge: { type: Number, default: 0, min: 0 },
    nightSurcharge: { type: Number, default: 0, min: 0 },
    wheelchairSurcharge: { type: Number, default: 0, min: 0 },
    stopCharges: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    taxes: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalFare: { type: Number, default: 0, min: 0 },
    // NOTE: driverEarnings/agencyEarnings are a DISPLAY CACHE only.
    // Settlement source of truth is PartnerWallet/PartnerSettlement, computed
    // from PlatformPricingConfig + actual route data. Never wire payout logic
    // directly off these two fields.
    driverEarnings: { type: Number, default: 0, min: 0 },
    agencyEarnings: { type: Number, default: 0, min: 0 },
    ratePerKm: { type: Number, default: 0 },
    minimumFare: { type: Number, default: 0 },
    waitingRatePerMin: { type: Number, default: 0 },
    currency: { type: String, default: "INR" },
    platformFeeType: { type: String, enum: ["fixed", "percentage"] },
    platformFeeValue: { type: Number },
  },
  { _id: false },
);

const liveLocationSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], default: [80.648, 16.506] },
    heading: { type: Number, min: 0, max: 360 },
    speedKmh: { type: Number, min: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const rideCancellationSchema = new Schema(
  {
    cancelledBy: { type: String, enum: RIDE_CANCEL_ACTORS },
    cancelledByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true },
    cancellationFee: { type: Number, default: 0, min: 0 },
    cancelledAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const rideRatingSchema = new Schema(
  {
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true },
    ratedAt: { type: Date },
    isVisible: { type: Boolean, default: true },
  },
  { _id: false },
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const rideSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    rideCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    rideType: {
      type: String,
      required: true,
      enum: RIDE_TYPES,
      index: true,
    },

    vehicleClass: {
      type: String,
      enum: RIDE_VEHICLE_CLASSES,
      // required intentionally omitted — pre-save derives it from
      // vehicleSnapshot when not provided at creation.
    },

    // ── Booking Link ──────────────────────────────────────────────────────────
    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },

    isReturnRide: { type: Boolean, default: false },

    // CHANGE: currentStopId replaces activeNavigationTarget. Points at a real
    // RideStop document instead of a fixed enum string — adding a new stop
    // type (e.g. a future BLOOD_BANK variant) no longer requires a schema
    // migration here.
    currentStopId: {
      type: Schema.Types.ObjectId,
      ref: "RideStop",
      default: null,
      index: true,
    },

    // CHANGE: tracks which RouteVersion is currently active for this ride.
    // Every recalculation (destination change, missed join point, admin
    // recalc) creates a new RouteVersion rather than mutating route data in
    // place — full version history preserved.
    activeRouteVersionId: {
      type: Schema.Types.ObjectId,
      ref: "RouteVersion",
      default: null,
      index: true,
    },

    // CHANGE: rideStage is now a derived projection of `status` (+ current
    // stop type where relevant), synced in pre-save below. Kept as a field
    // for backward API compatibility but should not be $set directly from
    // application code — write `status` instead and let this follow.
    rideStage: {
      type: String,
      enum: RIDE_STAGES,
      default: "searching_driver",
      index: true,
    },

    // ── Driver & Vehicle ──────────────────────────────────────────────────────
    driver: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },

    transportPartner: {
      type: Schema.Types.ObjectId,
      ref: "TransportPartner",
      default: null,
      index: true,
    },

    soloPartner: {
      type: Schema.Types.ObjectId,
      ref: "SoloDriverPartner",
      default: null,
    },

    assignedVehicleId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    vehicleSnapshot: { type: vehicleSnapshotSchema, default: null },
    driverSnapshot: { type: driverSnapshotSchema, default: null },

    // ── Route ─────────────────────────────────────────────────────────────────
    pickup: {
      type: rideGeoPointSchema,
      required: true,
    },

    dropoff: {
      type: rideGeoPointSchema,
      required: true,
    },

    // REMOVED: stops[], waypoints[] — see RideStop collection.

    // ── Live Position ─────────────────────────────────────────────────────────
    liveLocation: {
      type: liveLocationSchema,
      default: () => ({}),
    },

    currentEtaMinutes: { type: Number, default: null },

    // ── Timing ────────────────────────────────────────────────────────────────
    scheduledPickupAt: { type: Date, required: true, index: true },
    driverAssignedAt: { type: Date },
    driverAcceptedAt: { type: Date },
    driverArrivedAt: { type: Date },
    rideStartedAt: { type: Date },
    rideCompletedAt: { type: Date },
    driverEnRouteAt: { type: Date },

    // ── Distance & Duration ───────────────────────────────────────────────────
    estimatedDistanceKm: { type: Number, default: 0 },
    estimatedDurationMin: { type: Number, default: 0 },
    actualDistanceKm: { type: Number, default: 0 },
    actualDurationMin: { type: Number, default: 0 },

    // REMOVED: pickupOtp, pickupOtpVerifiedAt — OTP now lives per-stop on
    // RideStop.otp (each stop type — patient pickup, pharmacy, lab, hospital —
    // needs its own independent verification, a single ride-level field
    // could not represent that).

    // ── Fare ─────────────────────────────────────────────────────────────────
    fare: {
      type: rideFareBreakdownSchema,
      default: () => ({}),
    },

    hospitalEtaMinutes: { type: Number, default: 0 },
    hospitalDistanceKm: { type: Number, default: 0 },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: RIDE_STATUSES,
      default: "requested",
      index: true,
    },

    driverSearchAttempts: { type: Number, default: 0 },

    declinedDrivers: [{ type: Schema.Types.ObjectId, ref: "Driver" }],

    cancellation: {
      type: rideCancellationSchema,
      default: null,
    },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating: { type: rideRatingSchema, default: null },
    isRated: { type: Boolean, default: false },

    // ── RideTracking Link ─────────────────────────────────────────────────────
    trackingId: {
      type: Schema.Types.ObjectId,
      ref: "RideTracking",
      default: null,
      index: true,
    },

    // ── Internal ──────────────────────────────────────────────────────────────
    internalNotes: { type: String, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

rideSchema.virtual("isActive").get(function () {
  return [
    "driver_assigned",
    "driver_accepted",
    "driver_en_route",
    "driver_arrived",
    "otp_verified",
    "in_progress",
    "at_stop",
  ].includes(this.status);
});

rideSchema.virtual("isCompleted").get(function () {
  return this.status === "completed";
});

rideSchema.virtual("isCancelled").get(function () {
  return this.status === "cancelled";
});

rideSchema.virtual("isPendingDriver").get(function () {
  return ["requested", "searching"].includes(this.status);
});

rideSchema.virtual("driverType").get(function () {
  if (this.transportPartner) return "agency";
  if (this.soloPartner) return "solo";
  return null;
});

rideSchema.virtual("waitingTimeMinutes").get(function () {
  if (!this.driverArrivedAt || !this.rideStartedAt) return 0;
  return Math.round((this.rideStartedAt - this.driverArrivedAt) / 60000);
});

rideSchema.virtual("actualDurationFromTimestamps").get(function () {
  if (!this.rideStartedAt || !this.rideCompletedAt) return null;
  return Math.round((this.rideCompletedAt - this.rideStartedAt) / 60000);
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

rideSchema.pre("validate", function () {
  // pickup and dropoff cannot be same coordinates
  if (this.pickup?.coordinates && this.dropoff?.coordinates) {
    const [pLng, pLat] = this.pickup.coordinates;
    const [dLng, dLat] = this.dropoff.coordinates;
    if (pLng === dLng && pLat === dLat) {
      throw new Error("Ride pickup and dropoff cannot be the same location");
    }
  }

  // REMOVED: stops[] unique-sequence validation — sequence uniqueness is now
  // enforced at the database level by RideStop's compound unique index
  // {ride, routeVersion, sequence}.

  // Cannot have both transportPartner and soloPartner
  if (this.transportPartner && this.soloPartner) {
    throw new Error(
      "Ride cannot reference both a transportPartner and a soloPartner",
    );
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

rideSchema.pre("save", async function () {
  // Auto-generate rideCode
  if (this.isNew && !this.rideCode) {
    let code, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error("rideCode generation failed");
      code = `RD-${generateRideCode()}`;
      exists = await mongoose.model("Ride").exists({ rideCode: code });
    } while (exists);
    this.rideCode = code;
  }

  // Auto-set timing fields on status transitions
  const now = new Date();
  if (this.isModified("status")) {
    switch (this.status) {
      case "driver_assigned":
        this.driverAssignedAt = this.driverAssignedAt ?? now;
        break;
      case "driver_accepted":
        this.driverAcceptedAt = this.driverAcceptedAt ?? now;
        break;
      case "driver_en_route":
        this.driverEnRouteAt = this.driverEnRouteAt ?? now;
        break;
      case "driver_arrived":
        this.driverArrivedAt = this.driverArrivedAt ?? now;
        break;
      case "otp_verified":
        this.rideStartedAt = this.rideStartedAt ?? now;
        break;
      case "completed":
        this.rideCompletedAt = this.rideCompletedAt ?? now;
        break;
    }
  }

  // CHANGE: rideStage derivation. `status` is the single source of truth;
  // rideStage is recomputed here every time status or currentStopId changes,
  // closing the drift gap that existed when rideStage was independently
  // settable and nothing ever actually synced it.
  if (this.isModified("status") || this.isModified("currentStopId")) {
    let stage = STATUS_TO_STAGE[this.status] ?? this.rideStage;

    if (
      this.currentStopId &&
      ["driver_accepted", "driver_en_route", "driver_arrived"].includes(
        this.status,
      )
    ) {
      const RideStop = mongoose.model("RideStop");
      const stop = await RideStop.findById(this.currentStopId)
        .select("stopType")
        .lean();
      if (stop?.stopType === "CARE_ASSISTANT_JOIN") {
        stage = "driver_to_care_assistant";
      }
    }

    this.rideStage = stage;
  }

  // Sync isRated
  if (this.isModified("rating") && this.rating?.rating) {
    this.isRated = true;
    this.rating.ratedAt = this.rating.ratedAt ?? now;
  }

  // Derive vehicleClass from vehicleSnapshot if not already set.
  if (!this.vehicleClass && this.vehicleSnapshot?.vehicleType) {
    const twoWheelerTypes = ["Bike", "Scooter", "Motorcycle"];
    this.vehicleClass = twoWheelerTypes.includes(
      this.vehicleSnapshot.vehicleType,
    )
      ? "two_wheeler"
      : "four_wheeler";
  }

  if (!this.vehicleClass && this.vehicleSnapshot?.vehicleClass) {
    this.vehicleClass = this.vehicleSnapshot.vehicleClass;
  }

// CHANGE (fix): Booking.driver/transportPartner/solodriverpartner are
  // documented as "denormalized cache of current active leg, kept in sync
  // by a post-save hook" — that hook never actually existed. Booking.driver
  // was permanently stale. This closes the gap: only writes through when
  // THIS ride is the booking's primaryRide (the active leg), matching the
  // documented contract exactly.
  if (
    (this.isModified("driver") ||
      this.isModified("transportPartner") ||
      this.isModified("soloPartner")) &&
    this.booking
  ) {
    try {
      const Booking = mongoose.model("Booking");
      const b = await Booking.findById(this.booking).select("primaryRide").lean();
      if (b && String(b.primaryRide) === String(this._id)) {
        await Booking.findByIdAndUpdate(this.booking, {
          $set: {
            driver: this.driver || null,
            transportPartner: this.transportPartner || null,
            solodriverpartner: this.soloPartner || null,
          },
        });
      }
    } catch (err) {
      console.error("[Ride.pre-save] booking driver-cache sync failed:", err.message);
    }
  }

  // Driver snapshot on first assignment
  if (
    this.isModified("driver") &&
    this.driver &&
    !this.driverSnapshot?.driverCode
  ) {
    const Driver = mongoose.model("Driver");
    const drv = await Driver.findById(this.driver)
      .select(
        "driverCode legalName phone photoUrl performance.rating kyc.licenceClass",
      )
      .lean();
    if (drv) {
      this.driverSnapshot = {
        driverCode: drv.driverCode,
        legalName: drv.legalName,
        phone: drv.phone,
        photoUrl: drv.photoUrl,
        rating: drv.performance?.rating,
        licenceClass: drv.kyc?.licenceClass,
      };
    }
  }

  // Cap declinedDrivers array to prevent unbounded growth
  if (
    this.isModified("declinedDrivers") &&
    this.declinedDrivers.length > MAX_DECLINED_DRIVERS
  ) {
    this.declinedDrivers = this.declinedDrivers.slice(-MAX_DECLINED_DRIVERS);
  }
});

// ── Post-save — update Driver status when ride starts/ends ───────────────────

rideSchema.post("save", async function () {
  if (!this.driver) return;

  try {
    if (["otp_verified", "in_progress", "at_stop"].includes(this.status)) {
      await mongoose.model("Driver").findByIdAndUpdate(this.driver, {
        status: "On-Trip",
        currentRide: this._id,
      });
    } else if (["completed", "cancelled"].includes(this.status)) {
      await mongoose.model("Driver").findByIdAndUpdate(this.driver, {
        status: "Available",
        currentRide: null,
      });
    }
  } catch (err) {
    console.error("[Ride.post-save] driver status sync failed:", err.message);
  }
});

// ── Static Helpers ────────────────────────────────────────────────────────────

rideSchema.statics.findActiveByDriver = function (driverId) {
  return this.find({
    driver: driverId,
    status: {
      $in: [
        "driver_assigned",
        "driver_accepted",
        "driver_en_route",
        "driver_arrived",
        "otp_verified",
        "in_progress",
        "at_stop",
      ],
    },
  });
};

rideSchema.statics.findByBooking = function (bookingId) {
  return this.find({ booking: bookingId }).sort({ createdAt: 1 });
};

/**
 * replaceDriver — swap the driver on an in-flight ride WITHOUT spawning a new
 * Ride document. Caller is responsible for wrapping this together with the
 * matching AssignmentHistory insert in the same DB transaction.
 */
rideSchema.statics.replaceDriver = async function (
  rideId,
  newDriverId,
  { reason, performedBy } = {},
) {
  const ride = await this.findById(rideId);
  if (!ride) throw new Error("Ride not found");

  ride.driver = newDriverId;
  ride.driverSnapshot = null; // force re-snapshot on next save
  ride.updatedBy = performedBy ?? null;
  await ride.save();

  return ride;
};

// ── Indexes ───────────────────────────────────────────────────────────────────

// CHANGE: dropped 2dsphere indexes on `pickup` / `dropoff` — these are
// terminal points queried once at creation, then essentially static. Paying
// geo-index maintenance cost on every write for two rarely-requeried fields
// is wasted cost at million-ride scale. `liveLocation` keeps its 2dsphere
// index since that one genuinely is hot-queried for the live map.
rideSchema.index({ liveLocation: "2dsphere" });
rideSchema.index({ driver: 1, status: 1 });
rideSchema.index({ booking: 1, rideType: 1 });
rideSchema.index({ status: 1, scheduledPickupAt: 1 });
rideSchema.index({ status: 1, rideStage: 1 });
rideSchema.index({ transportPartner: 1, status: 1 });
rideSchema.index({ soloPartner: 1, status: 1 });
rideSchema.index({ scheduledPickupAt: 1 });
rideSchema.index({ currentStopId: 1 });
rideSchema.index({ activeRouteVersionId: 1 });
rideSchema.index({ createdAt: -1 });

const Ride = mongoose.model("Ride", rideSchema);
export default Ride;