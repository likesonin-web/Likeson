import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const { Schema } = mongoose;

const generateBookingCode = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  8,
);

// ── Constants ──────────────────────────────────────────────────────────────────

export const BOOKING_TYPES = [
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

export const BOOKING_STATUSES = [
  "draft",
  "payment_pending",
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
  "refund_pending",
  "refunded",
];

export const PAYMENT_STATUSES = [
  "unpaid",
  "pending",
  "payment_pending",
  "paid",
  "partially_paid",
  "failed",
  "refunded",
  "pending_cash",
  "partially_refunded",
  "waived",
  "pay_at_service_pending",
  "pay_at_service_paid",
];

export const CANCELLATION_ACTORS = [
  "customer",
  "doctor",
  "hospital",
  "care_assistant",
  "driver",
  "lab_partner",
  "admin",
  "system",
];

// Cap on inline statusLog — full history lives in event-sourced log (future),
// this stays bounded so a high-churn booking never bloats the hot document.
const MAX_INLINE_STATUS_LOG = 20;

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const geoPointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: { type: [Number], required: true },
    label: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    pincode: { type: String, trim: true },
  },
  { _id: false },
);

const fareBreakdownSchema = new Schema(
  {
    consultationFee: { type: Number, default: 0, min: 0 },
    doctorShare: { type: Number, default: 0, min: 0 },
    hospitalShare: { type: Number, default: 0, min: 0 },
    careAssistantFee: { type: Number, default: 0, min: 0 },
    transportFee: { type: Number, default: 0, min: 0 },
    diagnosticFee: { type: Number, default: 0, min: 0 },
    homeCollectionFee: { type: Number, default: 0, min: 0 },
    platformFee: { type: Number, default: 0, min: 0 },
    taxes: { type: Number, default: 0, min: 0 },
    taxBreakdown: {
      consultationGst: { type: Number, default: 0 },
      transportGst: { type: Number, default: 0 },
      careAssistantGst: { type: Number, default: 0 },
      diagnosticGst: { type: Number, default: 0 },
      homeCollectionGst: { type: Number, default: 0 },
    },
    discount: { type: Number, default: 0, min: 0 },
    couponDiscount: { type: Number, default: 0, min: 0 },
    walletApplied: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    refundAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR" },
  },
  { _id: false },
);

const paymentSchema = new Schema(
  {
    gateway: {
      type: String,
      enum: [
        "Razorpay",
        "Cashfree",
        "PayU",
        "PhonePe",
        "Wallet",
        "Cash",
        "Manual",
      ],
    },
    transactionId: { type: String, trim: true },
    orderId: { type: String, trim: true },
    paymentMode: {
      type: String,
      enum: ["UPI", "Card", "NetBanking", "Wallet", "Cash", "EMI", "Other"],
    },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["initiated", "success", "failed", "refunded"],
      default: "initiated",
    },
    paidAt: { type: Date },
    refundedAt: { type: Date },
    refundId: { type: String },
    notes: { type: String },
  },
  { _id: true, timestamps: true },
);

const patientInfoSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, min: 0, max: 150 },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "Prefer Not to Say"],
    },
    phone: { type: String },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"],
    },
    weight: { type: Number, min: 0 },
    isSelf: { type: Boolean, default: true },
  },
  { _id: false },
);

const documentSchema = new Schema(
  {
    docType: {
      type: String,
      enum: [
        "prescription",
        "lab_report",
        "discharge_summary",
        "id_proof",
        "insurance",
        "other",
      ],
    },
    url: { type: String, required: true },
    originalName: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const diagnosticDetailsSchema = new Schema(
  {
    labPartner: { type: Schema.Types.ObjectId, ref: "LabPartnerProfile" },
    tests: [{ type: Schema.Types.Mixed }],
    packages: [{ type: Schema.Types.Mixed }],
    testNames: [{ type: String, trim: true }],
    packageNames: [{ type: String, trim: true }],
    sampleCollectedAt: { type: Date },
    reportDeliveryMode: {
      type: String,
      enum: ["Digital (App)", "Email", "WhatsApp", "Physical Copy"],
    },
    reportUrl: { type: String },
    reportReadyAt: { type: Date },
    technicianName: { type: String },
  },
  { _id: false },
);

const cancellationSchema = new Schema(
  {
    cancelledBy: { type: String, enum: CANCELLATION_ACTORS },
    cancelledByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, trim: true },
    refundEligible: { type: Boolean, default: false },
    refundPercent: { type: Number, min: 0, max: 100 },
    cancelledAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const statusLogSchema = new Schema(
  {
    fromStatus: { type: String },
    toStatus: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const ratingSchema = new Schema(
  {
    doctorRating: { type: Number, min: 1, max: 5 },
    doctorComment: { type: String, trim: true },
    careAssistantRating: { type: Number, min: 1, max: 5 },
    careAssistantComment: { type: String, trim: true },
    driverRating: { type: Number, min: 1, max: 5 },
    driverComment: { type: String, trim: true },
    labRating: { type: Number, min: 1, max: 5 },
    labComment: { type: String, trim: true },
    overallRating: { type: Number, min: 1, max: 5 },
    overallComment: { type: String, trim: true },
    ratedAt: { type: Date },
    isPublic: { type: Boolean, default: true },
  },
  { _id: false },
);

// Shared shape — reused for BOTH pending and confirmed subscription usage.
// CHANGE: previously confirmedSubscriptionUsage re-declared this exact shape
// inline as a second, near-duplicate sub-schema. Now reused directly.
const subscriptionUsagePendingSchema = new Schema(
  {
    subId: { type: String, required: true },
    field: { type: String, required: true },
  },
  { _id: false },
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const bookingSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    bookingCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    bookingType: {
      type: String,
      required: true,
      enum: BOOKING_TYPES,
      index: true,
    },

    // ── Parties ───────────────────────────────────────────────────────────────
    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    patientInfo: {
      type: patientInfoSchema,
      required: true,
    },

    // ── Medical Service Providers ─────────────────────────────────────────────
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "DoctorProfile",
      default: null,
      index: true,
    },

    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
      index: true,
    },

    careAssistant: {
      type: Schema.Types.ObjectId,
      ref: "CareAssistantProfile",
      default: null,
      index: true,
    },

    // ── Active-leg caches ─────────────────────────────────────────────────────
    // NOTE (CHANGE): transportPartner / driver / solodriverpartner below are no
    // longer the source of truth for "who is driving." A booking can span
    // multiple Ride docs (return legs) and a driver can be REPLACED mid-ride.
    // Source of truth = Ride.driver / Ride.transportPartner / Ride.soloPartner
    // + AssignmentHistory. These fields are a denormalized cache of the
    // *current active leg*, kept in sync by a post-save hook on Ride /
    // RideParticipant whenever the active ride's driver changes. Never
    // hand-write these directly from application code — write through the
    // ride/assignment service instead.
    transportPartner: {
      type: Schema.Types.ObjectId,
      ref: "TransportPartner",
      default: null,
      index: true,
    },

    driver: {
      type: Schema.Types.ObjectId,
      ref: "DriverProfile",
      default: null,
      index: true,
    },

    solodriverpartner: {
      type: Schema.Types.ObjectId,
      ref: "SoloDriverPartner",
      default: null,
      index: true,
    },

    labPartner: {
      type: Schema.Types.ObjectId,
      ref: "LabPartnerProfile",
      default: null,
      index: true,
    },

    // ── Consultation Details ──────────────────────────────────────────────────
    consultationType: {
      type: String,
      enum: ["inPerson", "video", "homeVisit", null],
      default: null,
    },

    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },

    slotId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    consultationSessionId: {
      type: Schema.Types.ObjectId,
      ref: "Consultation",
      default: null,
      index: true,
    },

    // ── Location ──────────────────────────────────────────────────────────────
    patientLocation: {
      type: geoPointSchema,
      default: null,
    },

    destinationLocation: {
      type: geoPointSchema,
      default: null,
    },

    // CHANGE: destinationLockedAt — set when the linked Ride hits
    // 'driver_accepted'. Once set, destinationLocation becomes write-protected
    // (see pre-validate below) except via an explicit admin-override context
    // flag set by the service layer. Implements the spec rule: "Customer
    // cannot change destination after driver accepts. Exception: Admin may
    // change destination. Every destination change must be audited" — the
    // actual audit trail lives in the standalone DestinationChangeAudit
    // collection, this field only enforces the *timing* half of the rule.
    destinationLockedAt: {
      type: Date,
      default: null,
    },

    // REMOVED: careAssistantPickupLocation
    // Reason: this field stored what was, in practice, the Care Assistant's
    // location, which directly violates the spec rule "Join Point is NOT the
    // Care Assistant's live GPS. It is a calculated rendezvous point." That
    // responsibility now belongs entirely to the standalone JoinPoint
    // collection (immutable once locked, with its own lifecycle). See
    // migration notes in architecture review doc for backfill procedure.

    nearestHospitalSnapshot: {
      hospital: {
        type: Schema.Types.ObjectId,
        ref: "Hospital",
        default: null,
      },
      hospitalName: String,
      coordinates: {
        type: [Number],
        default: [],
      },
      address: String,
      etaMinutes: Number,
      distanceKm: Number,
      calculatedAt: Date,
    },

    // ── Diagnostic Details ────────────────────────────────────────────────────
    diagnosticDetails: {
      type: diagnosticDetailsSchema,
      default: null,
    },

    // ── Follow-up Chain ───────────────────────────────────────────────────────
    followUpParentBooking: {
      type: Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },

    followUpDiscountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // CHANGE: now reuses subscriptionUsagePendingSchema directly instead of
    // re-declaring an identical {subId, field} shape inline.
    confirmedSubscriptionUsage: {
      type: [subscriptionUsagePendingSchema],
      default: [],
    },

    // ── Ride Linkage ──────────────────────────────────────────────────────────
    rides: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ride",
      },
    ],

    primaryRide: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
      index: true,
    },

    returnRide: {
      type: Schema.Types.ObjectId,
      ref: "Ride",
      default: null,
    },

    // ── Patient Documents ─────────────────────────────────────────────────────
    documents: {
      type: [documentSchema],
      default: [],
    },

    // ── Pricing & Payment ─────────────────────────────────────────────────────
    fareBreakdown: {
      type: fareBreakdownSchema,
      default: () => ({}),
    },

    pricingSource: {
      type: String,
      enum: ["hospital", "doctor", "platform", "subscription"],
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "unpaid",
      index: true,
    },

    payments: {
      type: [paymentSchema],
      default: [],
    },

    couponCode: { type: String, uppercase: true, trim: true },
    coinsRedeemed: { type: Number, default: 0, min: 0 },

    // ── Status & Lifecycle ────────────────────────────────────────────────────
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "pending",
      index: true,
    },

    // CHANGE: capped to MAX_INLINE_STATUS_LOG entries in pre-save (see below).
    // Full immutable history is intended to move to an event-sourced
    // BookingStatusEvent collection in a future pass — this array stays as a
    // bounded "recent activity" cache for UI, not the audit source of truth.
    statusLog: {
      type: [statusLogSchema],
      default: [],
    },

    cancellation: {
      type: cancellationSchema,
      default: null,
    },

    completedAt: { type: Date },

    // ── Rating ────────────────────────────────────────────────────────────────
    rating: { type: ratingSchema, default: null },
    isRated: { type: Boolean, default: false, index: true },

    // ── Staff Snapshots ───────────────────────────────────────────────────────
    doctorSnapshot: {
      name: { type: String },
      specialization: { type: String },
      registrationNumber: { type: String },
      profilePhotoUrl: { type: String },
    },

    careAssistantSnapshot: {
      name: { type: String },
      photoUrl: { type: String },
      phone: { type: String },
    },

    // ── Notifications ─────────────────────────────────────────────────────────
    notificationsSent: {
      bookingConfirmation: { type: Boolean, default: false },
      reminderSent: { type: Boolean, default: false },
      rideStarted: { type: Boolean, default: false },
      completionSummary: { type: Boolean, default: false },
    },

    // ── Deferred subscription usage increments ────────────────────────────────
    subscriptionUsagePending: {
      type: [subscriptionUsagePendingSchema],
      default: [],
    },

    // ── Admin / Internal ──────────────────────────────────────────────────────
    assignedAdminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    internalNotes: { type: String, trim: true, select: false },

    // ── Pay-at-Service / QR Payment ───────────────────────────────────────────
    payAtService: {
      enabled: { type: Boolean, default: false },
      razorpayPaymentLinkId: { type: String, default: null },
      razorpayPaymentLinkUrl: { type: String, default: null },
      qrCodeUrl: { type: String, default: null },
      shortUrl: { type: String, default: null },
      amount: { type: Number, default: 0 },
      generatedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      paidAt: { type: Date, default: null },
      paidByCustomer: { type: Boolean, default: false },
      generatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      notificationSentAt: { type: Date, default: null },
    },

    // ── Collected by Partner (cash/manual) ───────────────────────────────────
    collectedByPartner: {
      amount: { type: Number, default: 0 },
      collectedAt: { type: Date, default: null },
      collectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      method: {
        type: String,
        enum: ["cash", "qr_razorpay", "other"],
        default: null,
      },
      note: { type: String, default: null },
    },

    isTestBooking: { type: Boolean, default: false },

    // ── Settlement Tracking ───────────────────────────────────────────────────
    settlementProcessed: { type: Boolean, default: false, index: true },
    settlementProcessedAt: { type: Date, default: null },
    settlementVersion: { type: Number, default: null },
    settlementIdempotencyKey: { type: String, default: null },

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

bookingSchema.virtual("isActive").get(function () {
  return ["pending", "confirmed", "in_progress"].includes(this.status);
});

bookingSchema.virtual("isCompleted").get(function () {
  return this.status === "completed";
});

bookingSchema.virtual("isCancelled").get(function () {
  return ["cancelled", "no_show"].includes(this.status);
});

bookingSchema.virtual("requiresTransport").get(function () {
  return ["full_care_ride", "patient_transport", "diagnostic_home"].includes(
    this.bookingType,
  );
});

bookingSchema.virtual("requiresDoctor").get(function () {
  return [
    "full_care_ride",
    "doctor_consultation",
    "doctor_online",
    "physiotherapist",
    "follow_up",
  ].includes(this.bookingType);
});

bookingSchema.virtual("requiresCareAssistant").get(function () {
  return ["full_care_ride", "care_assistant"].includes(this.bookingType);
});

bookingSchema.virtual("amountDue").get(function () {
  const total = this.fareBreakdown?.totalAmount ?? 0;
  const paid = this.fareBreakdown?.amountPaid ?? 0;
  return Math.max(0, total - paid);
});

bookingSchema.virtual("hasSubscriptionUsagePending").get(function () {
  return (
    Array.isArray(this.subscriptionUsagePending) &&
    this.subscriptionUsagePending.length > 0
  );
});

bookingSchema.virtual("hasActiveConsultation").get(function () {
  return !!this.consultationSessionId;
});

bookingSchema.virtual("isDestinationLocked").get(function () {
  return !!this.destinationLockedAt;
});

// ── Pre-validate ──────────────────────────────────────────────────────────────

bookingSchema.pre("validate", function () {
  const t = this.bookingType;

  if (t === "full_care_ride") {
    if (!this.doctor) throw new Error("full_care_ride requires doctor");
    if (!this.patientLocation)
      throw new Error("full_care_ride requires patientLocation");
  }

  if (t === "doctor_consultation" && !this.doctor) {
    throw new Error("doctor_consultation requires doctor");
  }

  if (t === "doctor_online" && !this.doctor) {
    throw new Error("doctor_online requires doctor");
  }

  if (t === "physiotherapist" && !this.doctor) {
    throw new Error(
      "physiotherapist requires doctor (physiotherapist profile)",
    );
  }

  if (t === "follow_up") {
    if (!this.followUpParentBooking)
      throw new Error("follow_up requires followUpParentBooking");
    if (!this.doctor) throw new Error("follow_up requires doctor");
  }

  if (t === "diagnostic_home" && !this.patientLocation) {
    throw new Error("diagnostic_home requires patientLocation");
  }

  if (t === "patient_transport") {
    if (!this.patientLocation)
      throw new Error("patient_transport requires patientLocation (pickup)");
    if (!this.destinationLocation)
      throw new Error(
        "patient_transport requires destinationLocation (dropoff)",
      );
  }

  if (this.returnRide && !this.primaryRide) {
    throw new Error("returnRide requires primaryRide to be set first");
  }

  // CHANGE: destination immutability guard. Once destinationLockedAt is set
  // (driver has accepted), destinationLocation can only change through an
  // explicit admin-override path. The service layer sets `this._isAdminOverride
  // = true` transiently before calling .save() when an authorized admin is
  // making the change; it must also write a DestinationChangeAudit record in
  // the same transaction. Schema enforces *timing only* — role authorization
  // is the service layer's responsibility.
  if (
    this.isModified("destinationLocation") &&
    !this.isNew &&
    this.destinationLockedAt &&
    !this._isAdminOverride
  ) {
    throw new Error(
      "destinationLocation is locked after driver acceptance — admin override required",
    );
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

bookingSchema.pre("save", async function () {
  // Auto-generate bookingCode
  if (this.isNew && !this.bookingCode) {
    let code, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error("bookingCode generation failed");
      code = `BK-${generateBookingCode()}`;
      exists = await mongoose.model("Booking").exists({ bookingCode: code });
    } while (exists);
    this.bookingCode = code;
  }

// statusLog fromStatus + cap (bounded UI cache — see BookingStatusEvent
  // for the permanent, uncapped record of the same transition)
  if (this.isModified("status") && !this.isNew) {
    const lastLog = this.statusLog?.[this.statusLog.length - 1];
    const fromStatus = lastLog?.toStatus ?? null;
    this.statusLog.push({
      fromStatus,
      toStatus: this.status,
      changedBy: this.updatedBy || null,
      changedAt: new Date(),
    });

    // CHANGE (fix): statusLog is capped at MAX_INLINE_STATUS_LOG — every
    // transition beyond that was silently lost, contradicting the spec's
    // "Historical data must never be lost." Mirror every transition into
    // the uncapped BookingStatusEvent collection too. Fire-and-forget via
    // queueMicrotask-style post-save would be cleaner, but this schema's
    // other pre-save hooks are already async/await, so a direct await here
    // keeps ordering guarantees simple and matches the existing pattern.
    this._pendingStatusEvent = { fromStatus, toStatus: this.status, changedBy: this.updatedBy || null };
  }

  // CHANGE: cap inline statusLog — keeps the hot document bounded regardless
  // of how many transitions/retries a booking goes through.
  if (this.statusLog?.length > MAX_INLINE_STATUS_LOG) {
    this.statusLog = this.statusLog.slice(-MAX_INLINE_STATUS_LOG);
  }

  // Sync isRated
  if (this.isModified("rating") && this.rating?.overallRating) {
    this.isRated = true;
    this.rating.ratedAt = this.rating.ratedAt ?? new Date();
  }

  // Auto-set completedAt
  if (
    this.isModified("status") &&
    this.status === "completed" &&
    !this.completedAt
  ) {
    this.completedAt = new Date();
  }

  // On cancellation, clear pending subscription usage
  if (this.isModified("status") && this.status === "cancelled") {
    if (this.subscriptionUsagePending?.length > 0) {
      this.subscriptionUsagePending = [];
    }
  }

  // Doctor snapshot on first assignment
  if (this.isModified("doctor") && this.doctor && !this.doctorSnapshot?.name) {
    const DoctorProfile = mongoose.model("DoctorProfile");
    const doc = await DoctorProfile.findById(this.doctor)
      .populate("user", "name")
      .select("specialization registrationNumber profilePhotoUrl")
      .lean();
    if (doc) {
      this.doctorSnapshot = {
        name: doc.user?.name,
        specialization: doc.specialization,
        registrationNumber: doc.registrationNumber,
        profilePhotoUrl: doc.profilePhotoUrl,
      };
    }
  }

// Care assistant snapshot on first assignment
  if (
    this.isModified("careAssistant") &&
    this.careAssistant &&
    !this.careAssistantSnapshot?.name
  ) {
    const CareAssistantProfile = mongoose.model("CareAssistantProfile");
    const ca = await CareAssistantProfile.findById(this.careAssistant)
      .select("fullName photoUrl phone")
      .lean();
    if (ca) {
      this.careAssistantSnapshot = {
        name: ca.fullName,
        photoUrl: ca.photoUrl,
        phone: ca.phone,
      };
    }
  }
});

// CHANGE (fix): write the permanent, uncapped audit record. Post-save
// (not pre-save) so it only fires once the document is actually persisted —
// no orphaned event if the save itself fails validation later in the chain.
bookingSchema.post("save", async function () {
  if (!this._pendingStatusEvent) return;
  const pending = this._pendingStatusEvent;
  try {
    const BookingStatusEvent = mongoose.model("BookingStatusEvent");
    await BookingStatusEvent.create({
      booking: this._id,
      ...pending,
      changedAt: new Date(),
    });
  } catch (err) {
    console.error("[Booking.post-save] BookingStatusEvent write failed:", err.message);
  } finally {
    this._pendingStatusEvent = null;
  }

  // Instant earning display — create BookingPartnerAllocation the moment
  // booking completes. NOT a wallet credit; settlement cron still gates
  // actual withdrawable money. See allocationEngine.service.js.
if (pending.toStatus === "completed") {
    try {
      const { createAllocationsForBooking } = await import("../services/allocationEngine.service.js");
      await createAllocationsForBooking(this._id);
    } catch (err) {
      console.error("[Booking.post-save] allocation creation failed:", err.message);
    }
    try {
      const { incrementCompletionStats } = await import("../services/partnerStatsService.js");
      await incrementCompletionStats(this);
    } catch (err) {
      console.error("[Booking.post-save] partner stats increment failed:", err.message);
    }
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ customer: 1, bookingType: 1 });
bookingSchema.index({ doctor: 1, scheduledAt: 1 });
bookingSchema.index({ doctor: 1, status: 1 });
bookingSchema.index({ hospital: 1, scheduledAt: 1 });
bookingSchema.index({ careAssistant: 1, status: 1 });
bookingSchema.index({ status: 1, scheduledAt: 1 });
bookingSchema.index({ paymentStatus: 1 });
bookingSchema.index({ scheduledAt: 1 });
bookingSchema.index({ followUpParentBooking: 1 });
bookingSchema.index({ rides: 1 });
bookingSchema.index({ "diagnosticDetails.labPartner": 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ bookingType: 1, status: 1, scheduledAt: 1 });
bookingSchema.index({ "subscriptionUsagePending.0": 1, paymentStatus: 1 });
bookingSchema.index({ consultationSessionId: 1 });

// CHANGE: new sparse index — payment-gateway webhooks look up bookings by
// transactionId. This was previously unindexed (a real lookup-path gap).
bookingSchema.index({ "payments.transactionId": 1 }, { sparse: true });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;