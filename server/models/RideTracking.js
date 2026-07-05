import mongoose from "mongoose";

const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// RIDETRACKING MODEL — Likeson.in
//
// Write-heavy GPS time-series + milestone events for a single ride.
// ONE RideTracking document per Ride (1:1, enforced by unique index).
//
// CHANGE SUMMARY (architecture redesign pass):
//   - FIXED: the original schema declared `careAssistant`,
//     `careAssistantJoinedAt`, `careAssistantStatus`,
//     `careAssistantLiveLocation`, `careAssistantBreadcrumbs`,
//     `careAssistantBreadcrumbCount` TWICE as separate field blocks in the
//     same schema object literal. In a JS object literal the second
//     declaration silently wins — the first block was dead, unreachable
//     code. This was a live bug, not a style issue.
//   - REMOVED all `careAssistant*` top-level fields entirely. Replaced by a
//     generic `participants[]` array, one entry per active RideParticipant
//     (role-tagged: CARE_ASSISTANT, NURSE, ESCORT, FAMILY, etc.) — new roles
//     slot in with zero schema change, per the extensibility requirement.
//   - REMOVED `activeTarget` enum — same "enum-based navigation" problem
//     that was fixed on Ride.activeNavigationTarget. Replaced with
//     `currentStopId`, denormalized from Ride for fast tracking-doc-only
//     reads without an extra join.
//   - REMOVED embedded `sosEvents[]` + `triggerSos`/`resolveSos` statics.
//     SOS is now a standalone, immutable `SosEvent` collection — emergency
//     data must never share a retention/archival policy with routine GPS
//     breadcrumbs, and embedding meant it would. `hasActiveSos` stays here
//     as a synced read cache only (see `syncSosFlag` static).
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_BREADCRUMBS = 2000;
const MAX_ETA_UPDATES = 100;

// ── Milestone Names ───────────────────────────────────────────────────────────

export const MILESTONE_NAMES = [
  "ride_created",
  "driver_search_started",
  "driver_assigned",
  "driver_accepted",
  "driver_en_route",
  "driver_arrived",
  "otp_verified",
  "ride_started",
  "stop_reached",
  "stop_departed",
  "hospital_arrived",
  "patient_handed_over",
  "care_assistant_joined",
  "consultation_started",
  "consultation_completed",
  "pharmacy_collected",
  "break_taken",
  "diagnosis_completed",
  "return_ride_started",
  "patient_home_reached",
  "pickup_collected",
  "delivery_attempted",
  "delivered",
  "delivery_otp_verified",
  "vehicle_breakdown",
  "driver_replaced",
  "route_deviated",
  "sos_triggered",
  "ride_paused",
  "ride_resumed",
  "ride_completed",
  "ride_cancelled",
];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const breadcrumbSchema = new Schema(
  {
    coordinates: { type: [Number], required: true },
    heading: { type: Number, min: 0, max: 360 },
    speedKmh: { type: Number, min: 0 },
    accuracyM: { type: Number, min: 0 },
    timestamp: { type: Date, required: true, default: Date.now },
    source: {
      type: String,
      enum: ["gps", "network", "fused"],
      default: "fused",
    },
  },
  { _id: false },
);

const milestoneSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      enum: MILESTONE_NAMES,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    coordinates: { type: [Number], default: null },
    stopSequence: { type: Number, default: null },
    meta: { type: Schema.Types.Mixed, default: null },
    recordedBy: {
      type: String,
      enum: ["driver", "system", "admin", "customer"],
      default: "system",
    },
    recordedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: true },
);

const etaUpdateSchema = new Schema(
  {
    toWaypoint: { type: String },
    etaMinutes: { type: Number },
    distanceRemainingKm: { type: Number },
    calculatedAt: { type: Date, default: Date.now },
    source: {
      type: String,
      enum: ["google_maps", "osrm", "estimate"],
      default: "estimate",
    },
  },
  { _id: false },
);

const routeDeviationSchema = new Schema(
  {
    detectedAt: { type: Date, default: Date.now },
    coordinates: { type: [Number] },
    deviationKm: { type: Number },
    wasAcknowledged: { type: Boolean, default: false },
    acknowledgedAt: { type: Date },
    driverReason: { type: String },
  },
  { _id: true },
);

// CHANGE: generic participant tracking sub-document. One of these per active
// RideParticipant (CA, nurse, escort, family, equipment handler, doctor —
// any future role). Replaces every hardcoded `careAssistant*` field that
// used to live at the top level of this schema (in duplicate, no less).
const participantTrackingSchema = new Schema(
  {
    participantId: {
      type: Schema.Types.ObjectId,
      ref: "RideParticipant",
      required: true,
    },
    role: { type: String, required: true }, // validated against PARTICIPANT_ROLES at the RideParticipant level, not re-enforced here
    status: { type: String, default: "not_joined" },
    joinedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true }, // false once this participant is replaced

    liveLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [80.648, 16.506] },
      heading: { type: Number, min: 0, max: 360 },
      speedKmh: { type: Number, min: 0 },
      updatedAt: { type: Date, default: Date.now },
    },

    breadcrumbs: { type: [breadcrumbSchema], default: [] }, // same ring-buffer pattern as driver breadcrumbs, capped at MAX_BREADCRUMBS
    breadcrumbCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const rideTrackingSchema = new Schema(
  {
    ride: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
      unique: true,
      index: true,
    },

    booking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    driver: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },

    // CHANGE: replaces `activeTarget` enum (same enum-explosion issue fixed
    // on Ride.activeNavigationTarget). Denormalized copy of Ride.currentStopId
    // so live-tracking reads don't need an extra join to the Ride document.
    // Kept in sync by the service layer whenever Ride.currentStopId changes.
    currentStopId: {
      type: Schema.Types.ObjectId,
      ref: "RideStop",
      default: null,
      index: true,
    },

    liveRouteContext: {
      currentLegDistanceKm: { type: Number, default: 0 },
      currentLegEtaMinutes: { type: Number, default: 0 },
      hospitalEtaMinutes: { type: Number, default: 0 },
      hospitalDistanceKm: { type: Number, default: 0 },
      nearestHospitalDistanceKm: { type: Number, default: 0 },
      nearestHospitalCalculatedAt: { type: Date },
      patientPickupReachedAt: { type: Date },
      careAssistantPickupReachedAt: { type: Date },
      hospitalReachedAt: { type: Date },
      patientDroppedAt: { type: Date },
      careAssistantJoinedAt: { type: Date },
      patientPickedUpAt: { type: Date },
    },

    // ── GPS Breadcrumbs (driver) ──────────────────────────────────────────────
    breadcrumbs: {
      type: [breadcrumbSchema],
      default: [],
    },

    breadcrumbCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Milestones ────────────────────────────────────────────────────────────
    milestones: {
      type: [milestoneSchema],
      default: [],
    },

    // ── ETA ───────────────────────────────────────────────────────────────────
    currentEtaMinutes: { type: Number, default: null },
    currentEtaTarget: { type: String, default: null },

    etaUpdates: {
      type: [etaUpdateSchema],
      default: [],
    },

    // CHANGE: generic participant tracking — replaces every duplicated
    // `careAssistant*` top-level field (see static methods below for the
    // participant-keyed read/write API that replaces attachCareAssistant /
    // updateCareAssistantLocation / updateCareAssistantStatus).
    participants: {
      type: [participantTrackingSchema],
      default: [],
    },

    // ── Route Summary ─────────────────────────────────────────────────────────
    totalDistanceKm: { type: Number, default: 0, min: 0 },
    expectedRoutePolyline: { type: String, default: null },
    actualRoutePolyline: { type: String, default: null },

    // CHANGE: SOS is now tracked in the standalone SosEvent collection.
    // hasActiveSos stays here as a synced read cache only — updated via
    // `syncSosFlag` (called from the SosEvent post-save/resolve hooks), never
    // computed from a local array anymore.
    hasActiveSos: { type: Boolean, default: false, index: true },

    // ── Route Deviations ──────────────────────────────────────────────────────
    routeDeviations: { type: [routeDeviationSchema], default: [] },
    hasUnacknowledgedDeviation: { type: Boolean, default: false, index: true },

    // ── Summary (populated at ride completion) ────────────────────────────────
    summary: {
      totalDistanceKm: { type: Number },
      totalDurationMin: { type: Number },
      avgSpeedKmh: { type: Number },
      maxSpeedKmh: { type: Number },
      pickupWaitMin: { type: Number },
      totalStopWaitMin: { type: Number },
      totalPingsReceived: { type: Number },
      isCompleted: { type: Boolean, default: false },
      completedAt: { type: Date },
    },

    isArchived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

rideTrackingSchema.virtual("latestPosition").get(function () {
  if (!this.breadcrumbs?.length) return null;
  return this.breadcrumbs[this.breadcrumbs.length - 1];
});

rideTrackingSchema.virtual("lastMilestone").get(function () {
  if (!this.milestones?.length) return null;
  return this.milestones[this.milestones.length - 1];
});

rideTrackingSchema.virtual("milestoneCount").get(function () {
  return this.milestones?.length ?? 0;
});

rideTrackingSchema.virtual("activeParticipants").get(function () {
  return (this.participants ?? []).filter((p) => p.isActive);
});

// ── Static Methods — GPS / Milestones / ETA (driver) ─────────────────────────

/**
 * addBreadcrumb — push driver GPS ping, maintain ring buffer cap.
 *
 * Single atomic op — $push with $slice keeps ring buffer, $inc bumps counter.
 * For production scale: pipe raw pings to a durable, TTL'd RideGpsLog
 * collection (or external time-series store) for full trip replay/audit;
 * this ring buffer is for live map display only and may drop data under
 * pressure without correctness impact.
 *
 * @param {ObjectId|string} rideId  - Ride._id (NOT booking ID)
 * @param {{ coordinates, heading?, speedKmh?, accuracyM?, source? }} pingData
 */
rideTrackingSchema.statics.addBreadcrumb = async function (rideId, pingData) {
  const { coordinates, heading, speedKmh, accuracyM, source } = pingData;

  if (!coordinates || coordinates.length !== 2) {
    throw new Error("addBreadcrumb: coordinates [lng, lat] required");
  }

  const breadcrumb = {
    coordinates,
    heading: heading ?? 0,
    speedKmh: speedKmh ?? 0,
    accuracyM: accuracyM ?? null,
    source: source ?? "fused",
    timestamp: new Date(),
  };

  return this.findOneAndUpdate(
    { ride: rideId },
    {
      $push: {
        breadcrumbs: {
          $each: [breadcrumb],
          $slice: -MAX_BREADCRUMBS,
        },
      },
      $inc: { breadcrumbCount: 1 },
    },
    { new: true },
  ).select("breadcrumbCount currentEtaMinutes totalDistanceKm");
};

/**
 * addMilestone — record a named lifecycle event.
 */
rideTrackingSchema.statics.addMilestone = async function (
  rideId,
  name,
  {
    coordinates = null,
    stopSequence = null,
    meta = null,
    recordedBy = "system",
    recordedByUserId = null,
  } = {},
) {
  if (!MILESTONE_NAMES.includes(name)) {
    throw new Error(`Unknown milestone name: ${name}`);
  }

  const milestone = {
    name,
    occurredAt: new Date(),
    coordinates,
    stopSequence,
    meta,
    recordedBy,
    recordedByUserId,
  };

  return this.findOneAndUpdate(
    { ride: rideId },
    { $push: { milestones: milestone } },
    { new: true },
  ).select("milestones");
};

/**
 * addEtaUpdate — push ETA recalculation, capped at MAX_ETA_UPDATES.
 * $slice in $push enforces cap at DB level.
 */
rideTrackingSchema.statics.addEtaUpdate = async function (rideId, etaData) {
  const { toWaypoint, etaMinutes, distanceRemainingKm, source } = etaData;

  const entry = {
    toWaypoint,
    etaMinutes,
    distanceRemainingKm,
    source: source ?? "estimate",
    calculatedAt: new Date(),
  };

  return this.findOneAndUpdate(
    { ride: rideId },
    {
      $push: {
        etaUpdates: {
          $each: [entry],
          $slice: -MAX_ETA_UPDATES,
        },
      },
      $set: {
        currentEtaMinutes: etaMinutes,
        currentEtaTarget: toWaypoint,
      },
    },
    { new: true },
  ).select("currentEtaMinutes currentEtaTarget");
};

// ── Static Methods — Generic Participant Tracking ────────────────────────────
// Replaces: attachCareAssistant, updateCareAssistantLocation,
// updateCareAssistantStatus. Works for CA, nurse, escort, family, equipment
// handler, doctor — any role — with zero schema change per new role.

/**
 * attachParticipant — add a tracking entry for a newly assigned
 * RideParticipant (admin assigns CA, or any future role joins the ride).
 */
rideTrackingSchema.statics.attachParticipant = async function (
  rideId,
  { participantId, role },
) {
  // Spec: family members are never tracked. Refuse at the write boundary,
  // not just at the UI — prevents any caller (admin panel, future script,
  // API client) from silently violating the rule.
  if (role === "FAMILY") {
    throw new Error("FAMILY participants are not trackable per spec — no GPS, no live location");
  }
  return this.findOneAndUpdate(
    { ride: rideId },
    {
      $push: {
        participants: {
          participantId,
          role,
          status: "en_route_to_pickup",
          joinedAt: new Date(),
          isActive: true,
        },
      },
    },
    { new: true },
  ).select("participants");
};

/**
 * deactivateParticipant — mark a participant's tracking entry inactive
 * (called when that participant is replaced — the RideParticipant doc itself
 * is never deleted, this just stops live-tracking it).
 */
rideTrackingSchema.statics.deactivateParticipant = async function (
  rideId,
  participantId,
) {
  return this.findOneAndUpdate(
    { ride: rideId, "participants.participantId": participantId },
    { $set: { "participants.$.isActive": false } },
    { new: true },
  ).select("participants");
};

/**
 * updateParticipantLocation — push GPS ping for a specific participant +
 * update their live location. Returns a lightweight select for socket
 * broadcast.
 */
rideTrackingSchema.statics.updateParticipantLocation = async function (
  rideId,
  participantId,
  pingData,
) {
  const { coordinates, heading, speedKmh, accuracyM, source } = pingData;
  if (!coordinates || coordinates.length !== 2) {
    throw new Error("updateParticipantLocation: coordinates [lng, lat] required");
  }
  const existing = await this.findOne(
    { ride: rideId, "participants.participantId": participantId },
    { "participants.$": 1 },
  ).lean();
  if (existing?.participants?.[0]?.role === "FAMILY") {
    throw new Error("FAMILY participants are not trackable per spec");
  }

  const breadcrumb = {
    coordinates,
    heading: heading ?? 0,
    speedKmh: speedKmh ?? 0,
    accuracyM: accuracyM ?? null,
    source: source ?? "gps",
    timestamp: new Date(),
  };

  return this.findOneAndUpdate(
    { ride: rideId, "participants.participantId": participantId },
    {
      $set: {
        "participants.$.liveLocation": {
          type: "Point",
          coordinates,
          heading: heading ?? 0,
          speedKmh: speedKmh ?? 0,
          updatedAt: new Date(),
        },
      },
      $push: {
        "participants.$.breadcrumbs": {
          $each: [breadcrumb],
          $slice: -MAX_BREADCRUMBS,
        },
      },
      $inc: { "participants.$.breadcrumbCount": 1 },
    },
    { new: true },
  ).select("participants");
};

/**
 * updateParticipantStatus — transition a participant's status
 * (en_route_to_pickup → at_pickup → in_ride → departed, etc).
 */
rideTrackingSchema.statics.updateParticipantStatus = async function (
  rideId,
  participantId,
  status,
) {
  return this.findOneAndUpdate(
    { ride: rideId, "participants.participantId": participantId },
    { $set: { "participants.$.status": status } },
    { new: true },
  ).select("participants");
};

// ── Static Methods — SOS sync (data lives in standalone SosEvent now) ────────

/**
 * syncSosFlag — called by SosEvent's post-save / resolution hooks to keep
 * this synced read cache accurate. This model no longer owns SOS data.
 */
rideTrackingSchema.statics.syncSosFlag = async function (rideId, hasActiveSos) {
  return this.findOneAndUpdate(
    { ride: rideId },
    { $set: { hasActiveSos } },
    { new: true },
  ).select("hasActiveSos");
};

// ── Static Methods — Summary ──────────────────────────────────────────────────

/**
 * computeSummary — called when ride completes. totalDurationMin computed
 * from Ride.rideStartedAt / rideCompletedAt fetched directly inside this
 * static.
 */
rideTrackingSchema.statics.computeSummary = async function (rideId) {
  const [tracking, ride] = await Promise.all([
    this.findOne({ ride: rideId }).lean(),
    mongoose
      .model("Ride")
      .findById(rideId)
      .select("rideStartedAt rideCompletedAt")
      .lean(),
  ]);

  if (!tracking) return null;

  const crumbs = tracking.breadcrumbs ?? [];
  const speeds = crumbs
    .map((c) => c.speedKmh)
    .filter((s) => s != null && s >= 0);

  const avgSpeed = speeds.length
    ? +(speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1)
    : 0;
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;

  let totalDurationMin = null;
  if (ride?.rideStartedAt && ride?.rideCompletedAt) {
    totalDurationMin = Math.round(
      (new Date(ride.rideCompletedAt) - new Date(ride.rideStartedAt)) / 60000,
    );
  }

  const arrivedMs = tracking.milestones?.find(
    (m) => m.name === "driver_arrived",
  )?.occurredAt;
  const otpMs = tracking.milestones?.find(
    (m) => m.name === "otp_verified",
  )?.occurredAt;
  const pickupWaitMin =
    arrivedMs && otpMs
      ? Math.round((new Date(otpMs) - new Date(arrivedMs)) / 60000)
      : 0;

  const stopArrived =
    tracking.milestones?.filter((m) => m.name === "stop_reached") ?? [];
  const stopDeparted =
    tracking.milestones?.filter((m) => m.name === "stop_departed") ?? [];
  let totalStopWaitMin = 0;
  for (let i = 0; i < Math.min(stopArrived.length, stopDeparted.length); i++) {
    totalStopWaitMin += Math.round(
      (new Date(stopDeparted[i].occurredAt) -
        new Date(stopArrived[i].occurredAt)) /
        60000,
    );
  }

  let totalDistanceKm = 0;
  for (let i = 1; i < crumbs.length; i++) {
    totalDistanceKm += haversineKm(
      crumbs[i - 1].coordinates,
      crumbs[i].coordinates,
    );
  }
  totalDistanceKm = +totalDistanceKm.toFixed(2);

  const summary = {
    totalDistanceKm,
    totalDurationMin,
    avgSpeedKmh: avgSpeed,
    maxSpeedKmh: maxSpeed,
    pickupWaitMin,
    totalStopWaitMin,
    totalPingsReceived: tracking.breadcrumbCount,
    isCompleted: true,
    completedAt: new Date(),
  };

  return this.findOneAndUpdate(
    { ride: rideId },
    { $set: { summary, totalDistanceKm } },
    { new: true },
  ).select("summary");
};

// ── Pre-save ──────────────────────────────────────────────────────────────────

rideTrackingSchema.pre("save", function () {
  // Safety net cap for etaUpdates (primary cap is $slice in addEtaUpdate)
  if (
    this.isModified("etaUpdates") &&
    this.etaUpdates.length > MAX_ETA_UPDATES
  ) {
    this.etaUpdates = this.etaUpdates.slice(-MAX_ETA_UPDATES);
  }

  // Sync hasUnacknowledgedDeviation
  if (this.isModified("routeDeviations")) {
    this.hasUnacknowledgedDeviation = this.routeDeviations.some(
      (d) => !d.wasAcknowledged,
    );
  }

  // NOTE: hasActiveSos is no longer synced from a local array — see
  // syncSosFlag static, called externally by SosEvent hooks.
});

// ── Indexes ───────────────────────────────────────────────────────────────────

rideTrackingSchema.index({ ride: 1 }, { unique: true });
rideTrackingSchema.index({ booking: 1 });
rideTrackingSchema.index({ driver: 1, createdAt: -1 });
rideTrackingSchema.index({ currentStopId: 1 });
rideTrackingSchema.index({ hasActiveSos: 1 });
rideTrackingSchema.index({ hasUnacknowledgedDeviation: 1 });
rideTrackingSchema.index({ isArchived: 1, createdAt: -1 });
rideTrackingSchema.index({ "participants.participantId": 1 });
rideTrackingSchema.index({ createdAt: -1 });

// ── Utility — Haversine distance ──────────────────────────────────────────────

function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

const RideTracking = mongoose.model("RideTracking", rideTrackingSchema);
export default RideTracking;