import mongoose from "mongoose";

const { Schema } = mongoose;

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

/**
 * platformFeeOverrideSchema — CONFIG, not balance. Determines the fee rate
 * applied when computing BookingPartnerAllocation for this partner's rides.
 * Not a duplicate of wallet/ledger data — keep.
 */
const platformFeeOverrideSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["fixed", "percentage"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const bankAccountSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true, required: true },
    accountNumber: { type: String, trim: true, required: true, select: false },
    accountLast4: { type: String, maxlength: 4 },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
      match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"],
    },
    bankName: { type: String, trim: true },
    branchName: { type: String, trim: true },
    accountType: {
      type: String,
      enum: ["Savings", "Current", "OD"],
      default: "Current",
    },
    isPrimary: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    cancelledChequeUrl: { type: String },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: true },
);

const upiSchema = new Schema(
  {
    upiId: { type: String, trim: true },
    upiName: { type: String, trim: true },
    isVerified: { type: Boolean, default: false },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true },
);

const gatewayAccountSchema = new Schema(
  {
    provider: {
      type: String,
      enum: ["Razorpay", "Cashfree", "PayU", "Stripe", "PhonePe Business"],
      required: true,
    },
    accountId: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    linkedAt: { type: Date, default: Date.now },
    webhookSecret: { type: String, select: false },
  },
  { _id: true },
);

const serviceZoneSchema = new Schema(
  {
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pinCodes: [{ type: String }],
    radiusKm: { type: Number, default: 15 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

const pricingSchema = new Schema(
  {
    baseFare: { type: Number, default: 0 },
    baseFarePerKm: { type: Number, default: 0 },
    minimumFare: { type: Number, default: 500 },
    waitingChargePerMin: { type: Number, default: 2 },
    freeWaitingMinutes: { type: Number, default: 10 },
    nightSurchargePercent: { type: Number, default: 20 },
    wheelchairSurcharge: { type: Number, default: 100 },
    currency: { type: String, default: "INR" },
  },
  { _id: false },
);

/**
 * fleetInfo — read-optimized cache, kept in sync by Vehicle.post('save')
 * (totalVehicles/activeVehicles) and Driver.post('save') (totalDrivers/
 * activeDrivers). Never write these fields directly from this model.
 */
const fleetInfoSchema = new Schema(
  {
    totalVehicles: { type: Number, default: 0 },
    activeVehicles: { type: Number, default: 0 },
    totalDrivers: { type: Number, default: 0 },
    activeDrivers: { type: Number, default: 0 },
  },
  { _id: false },
);

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings: { type: Number, default: 0 },
    totalRides: { type: Number, default: 0 },
  },
  { _id: false },
);

const ownerKycSchema = new Schema(
  {
    fullName: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["male", "female", "other", "prefer-not-to-say"],
    },
    profilePhotoUrl: { type: String },

    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: "India" },
    },

    aadhaarNumber: { type: String, select: false },
    aadhaarLast4: { type: String, maxlength: 4 },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl: { type: String },
    aadhaarVerified: { type: Boolean, default: false },

    panNumber: { type: String, uppercase: true, select: false },
    panCardUrl: { type: String },
    panVerified: { type: Boolean, default: false },

    drivingLicenseNumber: { type: String, sparse: true },
    drivingLicenseUrl: { type: String },
    drivingLicenseExpiry: { type: Date },

    kycStatus: {
      type: String,
      enum: [
        "not-submitted",
        "pending",
        "under-review",
        "verified",
        "rejected",
      ],
      default: "not-submitted",
    },
    kycVerifiedAt: { type: Date },
    kycVerifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    kycRejectionReason: { type: String },

    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String },
      relationship: { type: String, trim: true },
    },

    yearsOfExperience: { type: Number, default: 0 },
    languagesSpoken: [{ type: String, trim: true }],
    bio: { type: String, maxlength: 500 },
  },
  { _id: false },
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const transportPartnerSchema = new Schema(
  {
    // ── Business Details ──────────────────────────────────────────────────
    businessName: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    businessType: {
      type: String,
      enum: [
        "individual",
        "proprietorship",
        "partnership",
        "pvt-ltd",
        "ltd",
        "llp",
      ],
      default: "proprietorship",
    },
    ownerName: { type: String, required: true, trim: true },
    ownerPhone: { type: String, required: true },
    ownerEmail: { type: String, lowercase: true, trim: true },

    /**
     * user — links to the User account. PartnerWallet.partner uses THIS
     * id (partnerRole: 'transportpartner') — wallet/settlement/withdrawal
     * lookups all key off this.user, not off this._id.
     */
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    ownerKyc: { type: ownerKycSchema, default: () => ({}) },

    registeredAddress: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: "India" },
    },

    // ── Legal / Tax ───────────────────────────────────────────────────────
    gstNumber: { type: String, uppercase: true, sparse: true },
    panNumber: { type: String, uppercase: true, select: false },
    msmeUdyamNumber: { type: String, sparse: true },

    // ── Business Documents ────────────────────────────────────────────────
    tradeLicenseUrl: { type: String },
    tradeLicenseExpiry: { type: Date },
    gstCertificateUrl: { type: String },
    panCardUrl: { type: String, select: false },

    // ── Fleet ─────────────────────────────────────────────────────────────
    // Vehicles live in standalone `Vehicle` collection now
    // (ownerType:'TransportPartner', ownerId: this._id). No embedded array.
    // Query via: Vehicle.findByOwner('TransportPartner', partner._id)

    drivers: [{ type: Schema.Types.ObjectId, ref: "Driver" }],

    fleetInfo: { type: fleetInfoSchema, default: () => ({}) },

    // ── Service Zones & Pricing ───────────────────────────────────────────
    serviceZones: { type: [serviceZoneSchema], default: [] },
    pricing: { type: pricingSchema, default: () => ({}) },

    // ── Platform Fee Override (config — see note on schema above) ─────────
    platformFeeOverride: {
      type: platformFeeOverrideSchema,
      default: null,
    },

    settlementCycle: {
      type: String,
      enum: ["Daily", "Weekly", "Bi-Weekly", "Monthly"],
      default: "Weekly",
    },

    // ── Bank Details (KYC / payment-method data, NOT settlement state) ────
    // Settlement balances live in PartnerWallet, keyed off `user` above.
    bankDetails: {
      bankAccounts: { type: [bankAccountSchema], default: [] },
      upiHandles: { type: [upiSchema], default: [] },
      gatewayAccounts: { type: [gatewayAccountSchema], default: [] },
      preferredSettlementMethod: {
        type: String,
        enum: ["Bank Transfer", "UPI", "Cheque"],
        default: "Bank Transfer",
      },
    },

    razorpayContactId: { type: String, select: false },
    razorpayFundAccountId: { type: String, select: false },

    // ── Availability ──────────────────────────────────────────────────────
    isAvailable: { type: Boolean, default: true },
    availabilityHours: {
      start: { type: String, default: "06:00" },
      end: { type: String, default: "22:00" },
    },

    // ── Rating & Performance ──────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

stats: {
      totalRidesCompleted:      { type: Number, default: 0 },
      totalRidesCancelled:      { type: Number, default: 0 },
      totalRidesDisputed:       { type: Number, default: 0 },
      // NEW (Point 7): fleet-wide rollup of distance/hours across ALL of this
      // agency's drivers' completed rides. Incremented alongside the
      // individual Driver.performance fields in
      // recordPartnerTripCompletion() — never independently recomputed.
      totalDistanceKm:          { type: Number, default: 0, min: 0 },
      totalHoursWorked:         { type: Number, default: 0, min: 0 },
      // Analytics cache — re-derive from PartnerWalletTransaction /
      // BookingPartnerAllocation. Never hand-incremented; PartnerWallet/
      // PartnerSettlement are the real source of truth.
      totalEarnings:            { type: Number, default: 0 },
      totalPlatformFeePaid:     { type: Number, default: 0 },
      averagePickupTimeMinutes: { type: Number, default: 0 },
      onTimeArrivalRate:        { type: Number, default: 100, min: 0, max: 100 },
      lastRideAt:               { type: Date },
    },

    // ── Partnership & Onboarding ──────────────────────────────────────────
    partnershipStatus: {
      type: String,
      enum: ["pending", "under-review", "active", "suspended", "rejected"],
      default: "pending",
      index: true,
    },
    isOnboardingComplete: { type: Boolean, default: false },
    partnerSince: { type: Date },
    contractUrl: { type: String },

    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String },

    // ── Notification Preferences ──────────────────────────────────────────
    notifications: {
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Internal ─────────────────────────────────────────────────────────
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

// Both read from fleetInfo cache (synced by Vehicle.post-save) — no live
// query needed, no embedded array to count.
transportPartnerSchema.virtual("totalVehicles").get(function () {
  return this.fleetInfo?.totalVehicles ?? 0;
});

transportPartnerSchema.virtual("activeVehicles").get(function () {
  return this.fleetInfo?.activeVehicles ?? 0;
});

transportPartnerSchema.virtual("isDispatchReady").get(function () {
  return (
    this.partnershipStatus === "active" &&
    this.isAvailable &&
    this.isOnboardingComplete &&
    (this.fleetInfo?.activeVehicles ?? 0) > 0
  );
});

transportPartnerSchema.virtual("isOwnerKycComplete").get(function () {
  return this.ownerKyc?.kycStatus === "verified";
});

transportPartnerSchema.virtual("ownerAge").get(function () {
  if (!this.ownerKyc?.dateOfBirth) return null;
  const diff = Date.now() - new Date(this.ownerKyc.dateOfBirth).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

transportPartnerSchema.virtual("effectivePlatformFee").get(function () {
  return this.platformFeeOverride ?? null;
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

transportPartnerSchema.pre("save", function () {
  if (this.isNew && !this.slug && this.businessName) {
    this.slug = this.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Mask bank account numbers — store only last 4 digits
  if (this.isModified("bankDetails.bankAccounts")) {
    this.bankDetails.bankAccounts.forEach((acc) => {
      if (acc.accountNumber && !acc.accountLast4) {
        acc.accountLast4 = acc.accountNumber.slice(-4);
      }
    });
  }

  // Mask owner Aadhaar
  if (
    this.isModified("ownerKyc.aadhaarNumber") &&
    this.ownerKyc?.aadhaarNumber
  ) {
    this.ownerKyc.aadhaarLast4 = this.ownerKyc.aadhaarNumber.slice(-4);
  }

  // Onboarding complete check — fleetInfo.activeVehicles is the synced
  // cache (kept current by Vehicle.post-save), safe to read here directly.
  if (
    this.businessName &&
    this.ownerPhone &&
    (this.fleetInfo?.activeVehicles ?? 0) > 0 &&
    this.bankDetails?.bankAccounts?.some((a) => a.isPrimary) &&
    this.serviceZones?.length > 0
  ) {
    this.isOnboardingComplete = true;
  }
});

// ── Instance Methods ─────────────────────────────────────────────────────────

/** All vehicles owned by this partner — replaces old `this.vehicles[]`. */
transportPartnerSchema.methods.getVehicles = function () {
  return mongoose.model("Vehicle").findByOwner("TransportPartner", this._id);
};

/** This partner's settlement wallet (source of truth for balances). */
transportPartnerSchema.methods.getWallet = function () {
  if (!this.user) return null;
  return mongoose
    .model("PartnerWallet")
    .findOne({ partner: this.user, partnerRole: "transportpartner" });
};

transportPartnerSchema.methods.getPendingSettlements = function () {
  if (!this.user) return [];
  return mongoose
    .model("PartnerSettlement")
    .find({ partnerId: this.user, settlementStatus: "PENDING" });
};

transportPartnerSchema.methods.getOpenLiabilities = function () {
  if (!this.user) return [];
  return mongoose.model("PartnerCollectionLiability").find({
    partner: this.user,
    status: { $in: ["OPEN", "PARTIALLY_RECOVERED"] },
  });
};

// ── Indexes ───────────────────────────────────────────────────────────────────

transportPartnerSchema.index({ partnershipStatus: 1, isAvailable: 1 });
transportPartnerSchema.index({
  "serviceZones.city": 1,
  "serviceZones.state": 1,
});

const TransportPartner = mongoose.model(
  "TransportPartner",
  transportPartnerSchema,
);
export default TransportPartner;
