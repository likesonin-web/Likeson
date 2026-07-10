import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * SoloDriverPartner Model — Likeson.in
 *
 * Self-employed driver: owns their own vehicle, NO parent agency.
 * This model IS the complete entity — no companion Driver doc needed.
 * Driver model is for TransportPartner agency drivers ONLY.
 *
 * VEHICLE — lives in standalone `Vehicle` collection (ownerType=
 * 'SoloDriverPartner', ownerId=this._id). `vehicleStatus` below is a
 * small read cache synced by Vehicle.post-save — NOT source of truth.
 * Use getVehicle() for the live doc.
 *
 * MONEY — no embedded earnings/settlement block. PartnerWallet (keyed off
 * `user`, partnerRole='solodriverpartner') is the only source of truth.
 *
 * DISPATCH — geo queries run on Vehicle collection (top-level 2dsphere).
 * No Driver doc involved. isDispatchReady virtual checks partner-level
 * fields only.
 *
 * §1 Sub-schemas  §2 Main schema  §3 Virtuals  §4 Pre-save  §5 Methods  §6 Indexes
 */

// ── §1  Sub-Schemas ───────────────────────────────────────────────────────────

const partnerPlatformFeeSchema = new Schema(
  {
    type: {
      type:     String,
      enum:     ['fixed', 'percentage'],
      required: true,
    },
    value: {
      type:     Number,
      required: true,
      min:      0,
    },
  },
  { _id: false }
);

const soloKycSchema = new Schema(
  {
    aadhaarNumber: {
      type:   String,
      trim:   true,
      match:  [/^\d{12}$/, 'Aadhaar must be 12 digits'],
      select: false,
    },
    aadhaarLast4:    { type: String, maxlength: 4 },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl:  { type: String },
    aadhaarVerified: { type: Boolean, default: false },

    drivingLicenceNumber: {
      type:      String,
      required:  [true, 'Driving licence number is required'],
      uppercase: true,
      trim:      true,
    },
    drivingLicenceExpiry: {
      type:     Date,
      required: [true, 'DL expiry date is required'],
    },
    drivingLicenceDocUrl: { type: String },
    licenceClass:         [{ type: String, trim: true }],

    psvBadgeNumber: { type: String, uppercase: true, trim: true },
    psvBadgeExpiry: { type: Date },
    psvBadgeDocUrl: { type: String },

    panNumber: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'],
      select:    false,
    },
    panCardUrl:  { type: String },
    panVerified: { type: Boolean, default: false },

    verificationStatus: {
      type:    String,
      enum:    ['not-submitted', 'pending', 'under-review', 'verified', 'rejected'],
      default: 'not-submitted',
    },
    isVerified:      { type: Boolean, default: false },
    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    submittedAt:     { type: Date },
  },
  { _id: false }
);

const soloBankSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber:     { type: String, trim: true, select: false },
    accountLast4:      { type: String, maxlength: 4 },
    ifscCode: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'],
    },
    bankName:    { type: String, trim: true },
    upiId:       { type: String, trim: true },
    upiName:     { type: String, trim: true },
    accountType: {
      type:    String,
      enum:    ['Savings', 'Current'],
      default: 'Savings',
    },
    isVerified:         { type: Boolean, default: false },
    cancelledChequeUrl: { type: String },
    verifiedAt:         { type: Date },
    verifiedBy:         { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const soloMedicalFitnessSchema = new Schema(
  {
    certificateNumber: { type: String, trim: true },
    issuedBy:          { type: String, trim: true },
    issuedAt:          { type: Date },
    expiryDate:        { type: Date },
    documentUrl:       { type: String },
    bloodGroup: {
      type:    String,
      enum:    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'],
      default: 'Unknown',
    },
    isValid: { type: Boolean, default: false },
  },
  { _id: false }
);

const pricingSchema = new Schema(
  {
    baseFare:              { type: Number, default: 0   },
    baseFarePerKm:         { type: Number, default: 0   },
    minimumFare:           { type: Number, default: 500 },
    waitingChargePerMin:   { type: Number, default: 2   },
    freeWaitingMinutes:    { type: Number, default: 10  },
    nightSurchargePercent: { type: Number, default: 20  },
    wheelchairSurcharge:   { type: Number, default: 100 },
    currency:              { type: String, default: 'INR' },
  },
  { _id: false }
);

const serviceZoneSchema = new Schema(
  {
    city:     { type: String, required: true, trim: true },
    state:    { type: String, required: true, trim: true },
    pinCodes: [{ type: String }],
    radiusKm: { type: Number, default: 15 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings:  { type: Number, default: 0 },
    totalRides:    { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * vehicleStatus — read cache only, synced by Vehicle.post-save hook.
 * For full vehicle data (docs, photos, GPS) always query Vehicle collection.
 */
const vehicleStatusSchema = new Schema(
  {
    hasVehicle:         { type: Boolean, default: false },
    registrationNumber: { type: String },
    verificationStatus: {
      type:    String,
      enum:    ['pending', 'under-review', 'verified', 'rejected'],
      default: 'pending',
    },
    isActive:  { type: Boolean, default: false },
    syncedAt:  { type: Date },
  },
  { _id: false }
);

/**
 * dispatchStateSchema — replaces Driver doc for dispatch purposes.
 * Tracks online/offline and current ride directly on SoloDriverPartner.
 */
const dispatchStateSchema = new Schema(
  {
    status: {
      type:    String,
      enum:    ['Available', 'On-Trip', 'Offline', 'On-Break'],
      default: 'Offline',
    },
    currentRide:     { type: Schema.Types.ObjectId, ref: 'Ride', default: null },
    lastStatusAt:    { type: Date },
    shiftType: {
      type:    String,
      enum:    ['Morning', 'Afternoon', 'Evening', 'Night', 'Full-Day', 'On-Call'],
      default: 'Full-Day',
    },
    shiftStart:      { type: String, default: '06:00' },
    shiftEnd:        { type: String, default: '22:00' },
    daysAvailable:   [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
  },
  { _id: false }
);

/**
 * rewardsSchema — gamification layer, NOT money.
 * Coins separate from PartnerWallet (real-money ledger).
 */
const badgeSchema = new Schema(
  {
    badgeId: {
      type: String,
      enum: [
        'FIRST_RIDE', 'RIDES_10', 'RIDES_50', 'RIDES_100', 'RIDES_500',
        'RIDES_1000', 'TOP_RATED', 'PERFECT_WEEK', 'ZERO_CANCEL_MONTH',
        'SAFE_DRIVER', 'NIGHT_OWL', 'LONG_HAUL', 'VERIFIED_DRIVER',
        'LOYAL_DRIVER_1Y', 'LOYAL_DRIVER_2Y', 'EARLY_ADOPTER', 'SOLO_PARTNER',
      ],
      required: true,
    },
    name:        { type: String, required: true },
    description: { type: String },
    iconUrl:     { type: String },
    earnedAt:    { type: Date, default: Date.now },
    isActive:    { type: Boolean, default: true },
  },
  { _id: true }
);

const coinTxnSchema = new Schema(
  {
    type: {
      type:     String,
      enum:     ['EARN', 'REDEEM', 'EXPIRE', 'BONUS', 'ADMIN_CREDIT', 'ADMIN_DEBIT'],
      required: true,
    },
    amount:      { type: Number, required: true, min: 0 },
    balance:     { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    referenceId: { type: Schema.Types.ObjectId },
    referenceModel: {
      type:    String,
      enum:    ['Ride', 'Redemption', null],
      default: null,
    },
    expiresAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const rewardsSchema = new Schema(
  {
    coinBalance:      { type: Number, default: 0, min: 0 },
    totalCoinsEarned: { type: Number, default: 0, min: 0 },
    totalCoinsRedeem: { type: Number, default: 0, min: 0 },
    coinTransactions: [coinTxnSchema],
    badges:           [badgeSchema],
    tier: {
      type:    String,
      enum:    ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      default: 'Bronze',
    },
    tierUpdatedAt: { type: Date },
  },
  { _id: false }
);

// ── §2  Main Schema ───────────────────────────────────────────────────────────

const soloDriverPartnerSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User reference is required'],
      unique:   true,
      index:    true,
    },

    // ── Personal Details ──────────────────────────────────────────────────────
    partnerCode: {
      type:      String,
      unique:    true,
      sparse:    true,
      uppercase: true,
      trim:      true,
      index:     true,
    },

    legalName:       { type: String, required: true, trim: true },
    displayName:     { type: String, trim: true },
    dateOfBirth:     { type: Date },
    gender:          { type: String, enum: ['Male', 'Female', 'Other', 'Prefer Not to Say'] },
    profilePhotoUrl: { type: String },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone: {
      type:     String,
      required: [true, 'Phone number is required'],
      match:    [/^[6-9]\d{9}$/, 'Invalid mobile number'],
    },
    altPhone:       { type: String },
    whatsappNumber: { type: String },
    email:          { type: String, lowercase: true, trim: true },

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      street:  { type: String, trim: true },
      city:    { type: String, required: true, trim: true },
      state:   { type: String, required: true, trim: true },
      pinCode: { type: String, trim: true },
      country: { type: String, default: 'India' },
    },

    // ── Business / Tax Details ────────────────────────────────────────────────
    businessType: {
      type:    String,
      enum:    ['individual', 'proprietorship'],
      default: 'individual',
    },
    tradeName:       { type: String, trim: true },
    gstNumber:       { type: String, uppercase: true, sparse: true },
    panNumber:       { type: String, uppercase: true, select: false },
    msmeUdyamNumber: { type: String, sparse: true },

    // ── KYC ───────────────────────────────────────────────────────────────────
    kyc: {
      type:     soloKycSchema,
      required: true,
      default:  () => ({}),
    },

    // ── Medical Fitness ───────────────────────────────────────────────────────
    medicalFitness: { type: soloMedicalFitnessSchema, default: () => ({}) },

    // ── Professional ──────────────────────────────────────────────────────────
    yearsOfExperience:      { type: Number, default: 0, min: 0, max: 60 },
    hasMedicalTransportExp: { type: Boolean, default: false },
    hasAmbulanceExp:        { type: Boolean, default: false },
    languagesSpoken: [
      {
        type: String,
        enum: ['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Other'],
      },
    ],
    trainingCertificates: [
      {
        name:        { type: String, trim: true, required: true },
        issuedBy:    { type: String, trim: true },
        issuedAt:    { type: Date },
        expiresAt:   { type: Date },
        documentUrl: { type: String },
      },
    ],
    bio: { type: String, maxlength: 500 },

    // ── Vehicle ───────────────────────────────────────────────────────────────
    // Live data in standalone `Vehicle` collection (ownerType='SoloDriverPartner').
    // vehicleStatus is a synced read cache only — see vehicleStatusSchema above.
    vehicleStatus: { type: vehicleStatusSchema, default: () => ({}) },

    // ── Service Zones & Pricing ───────────────────────────────────────────────
    serviceZones: { type: [serviceZoneSchema], default: [] },
    pricing:      { type: pricingSchema, default: () => ({}) },

    // ── Platform Fee Override (config — NOT money state) ──────────────────────
    platformFeeOverride: {
      type:    partnerPlatformFeeSchema,
      default: null,
    },

    // ── Settlement ────────────────────────────────────────────────────────────
    settlementCycle: {
      type:    String,
      enum:    ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'],
      default: 'Weekly',
    },

    // ── Bank Details (KYC / payment-method data, NOT settlement state) ────────
    bankDetails: { type: soloBankSchema, default: () => ({}) },

    razorpayContactId:     { type: String, select: false },
    razorpayFundAccountId: { type: String, select: false },

    // ── Availability / Dispatch State ─────────────────────────────────────────
    // isAvailable = master toggle. dispatch = fine-grained state machine.
    isAvailable:       { type: Boolean, default: false },
    availabilityHours: {
      start: { type: String, default: '06:00' },
      end:   { type: String, default: '22:00' },
    },
    dispatch: { type: dispatchStateSchema, default: () => ({}) },

    // ── Emergency Contact ─────────────────────────────────────────────────────
    emergencyContact: {
      name:         { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone:        { type: String },
    },

    // ── Rating & Performance ──────────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

stats: {
      totalRidesCompleted:      { type: Number, default: 0 },
      totalRidesCancelled:      { type: Number, default: 0 },
      totalRidesDisputed:       { type: Number, default: 0 },
      // NEW (Point 7): cumulative distance/hours across completed rides,
      // written by partnerAssignmentEngine.service.js#recordPartnerTripCompletion.
      totalDistanceKm:          { type: Number, default: 0, min: 0 },
      totalHoursWorked:         { type: Number, default: 0, min: 0 },
      // Analytics cache — re-derive from PartnerWalletTransaction /
      // BookingPartnerAllocation. PartnerWallet/PartnerSettlement are
      // the real source of truth, never hand-incremented here.
      totalEarnings:            { type: Number, default: 0 },
      totalPlatformFeePaid:     { type: Number, default: 0 },
      averagePickupTimeMinutes: { type: Number, default: 0 },
      onTimeArrivalRate:        { type: Number, default: 100, min: 0, max: 100 },
      lastRideAt:               { type: Date },
    },

// ── Rewards (gamification — NOT money) ───────────────────────────────────
    rewards: { type: rewardsSchema, default: () => ({}) },

    // NEW (Point 7): bounded per-trip distance/hours log, same shape and
    // purpose as Driver.tripLog — see that patch note for details.
    tripLog: {
      type: [
        {
          rideId:      { type: Schema.Types.ObjectId, ref: 'Ride' },
          bookingId:   { type: Schema.Types.ObjectId, ref: 'Booking' },
          distanceKm:  { type: Number, default: 0 },
          hoursWorked: { type: Number, default: 0 },
          completedAt: { type: Date },
        },
      ],
      default: [],
    },

    // ── Partnership Status ────────────────────────────────────────────────────
    partnershipStatus: {
      type:    String,
      enum:    ['pending', 'under-review', 'active', 'suspended', 'rejected'],
      default: 'pending',
      index:   true,
    },
    isOnboardingComplete: { type: Boolean, default: false },
    partnerSince:         { type: Date },
    contractUrl:          { type: String },

    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },

    profileCompletionPercent: { type: Number, default: 0, min: 0, max: 100 },

    // ── Notification Preferences ──────────────────────────────────────────────
    notifications: {
      sms:      { type: Boolean, default: true },
      email:    { type: Boolean, default: true },
      push:     { type: Boolean, default: true },
      whatsapp: { type: Boolean, default: true },
    },

    // ── Internal ──────────────────────────────────────────────────────────────
    internalNotes: { type: String, select: false },
    adminNotes:    { type: String, maxlength: 1000, select: false },
    tags:          [{ type: String, trim: true, lowercase: true }],
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── §3  Virtuals ──────────────────────────────────────────────────────────────

soloDriverPartnerSchema.virtual('hasActiveVehicle').get(function () {
  return (
    this.vehicleStatus?.verificationStatus === 'verified' &&
    this.vehicleStatus?.isActive === true
  );
});

/**
 * isDispatchReady — no Driver doc check. Vehicle geo query is the dispatch mechanism.
 */
soloDriverPartnerSchema.virtual('isDispatchReady').get(function () {
  return (
    this.partnershipStatus === 'active' &&
    this.isAvailable &&
    this.isOnboardingComplete &&
    this.hasActiveVehicle &&
    this.kyc?.isVerified === true
  );
});

soloDriverPartnerSchema.virtual('isKycComplete').get(function () {
  return this.kyc?.verificationStatus === 'verified';
});

soloDriverPartnerSchema.virtual('hasExpiringCompliance').get(function () {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return (
    (this.kyc?.drivingLicenceExpiry  && this.kyc.drivingLicenceExpiry  < soon) ||
    (this.kyc?.psvBadgeExpiry        && this.kyc.psvBadgeExpiry        < soon) ||
    (this.medicalFitness?.expiryDate && this.medicalFitness.expiryDate < soon)
    // Vehicle doc expiries: check via getVehicle().hasExpiringDocs
  );
});

soloDriverPartnerSchema.virtual('aadhaarMasked').get(function () {
  const last4 = this.kyc?.aadhaarLast4 || '';
  return last4 ? `XXXX XXXX ${last4}` : null;
});

soloDriverPartnerSchema.virtual('effectivePlatformFee').get(function () {
  return this.platformFeeOverride ?? null;
});

// ── §4  Pre-save Middleware ───────────────────────────────────────────────────

soloDriverPartnerSchema.pre('save', async function () {
  if (!this.partnerCode) {
    const ts   = Date.now().toString(36).slice(-6).toUpperCase();
    const rand = Math.random().toString(36).slice(-2).toUpperCase();
    this.partnerCode = `LKS-SDP-${ts}${rand}`;
  }

  if (this.isModified('kyc.aadhaarNumber') && this.kyc?.aadhaarNumber) {
    this.kyc.aadhaarLast4 = this.kyc.aadhaarNumber.slice(-4);
  }

  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  if (this.isModified('kyc.verificationStatus')) {
    this.kyc.isVerified = this.kyc.verificationStatus === 'verified';
    if (this.kyc.isVerified && !this.kyc.submittedAt) {
      this.kyc.submittedAt = new Date();
    }
  }

  if (
    this.isModified('kyc.drivingLicenceNumber') &&
    this.kyc?.drivingLicenceNumber &&
    !this.kyc.submittedAt
  ) {
    this.kyc.submittedAt = new Date();
  }

  if (this.isModified('platformFeeOverride') && this.platformFeeOverride) {
    const { type, value } = this.platformFeeOverride;
    if (type === 'percentage' && (value < 0 || value > 100)) {
      throw new Error('platformFeeOverride.value must be 0–100 for percentage type');
    }
    if (type === 'fixed' && value < 0) {
      throw new Error('platformFeeOverride.value must be ≥ 0 for fixed type');
    }
  }

  // Onboarding complete check — vehicleStatus is the synced cache
  if (
    this.legalName &&
    this.phone &&
    this.vehicleStatus?.hasVehicle &&
    this.vehicleStatus?.verificationStatus === 'verified' &&
    this.bankDetails?.accountNumber &&
    this.serviceZones?.length > 0 &&
    this.kyc?.drivingLicenceNumber
  ) {
    this.isOnboardingComplete = true;
  }

  if (this.isModified()) {
    const checks = [
      this.legalName,
      this.dateOfBirth,
      this.phone,
      this.profilePhotoUrl,
      this.address?.city,
      this.kyc?.aadhaarNumber,
      this.kyc?.drivingLicenceNumber,
      this.kyc?.drivingLicenceDocUrl,
      this.kyc?.isVerified,
      this.medicalFitness?.certificateNumber,
      this.vehicleStatus?.hasVehicle,
      this.bankDetails?.accountNumber,
      this.emergencyContact?.phone,
    ];
    this.profileCompletionPercent = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }

  // Tier update based on rides
  if (this.isModified('stats.totalRidesCompleted')) {
    const rides = this.stats.totalRidesCompleted;
    let tier = 'Bronze';
    if      (rides >= 1000) tier = 'Diamond';
    else if (rides >= 500)  tier = 'Platinum';
    else if (rides >= 200)  tier = 'Gold';
    else if (rides >= 50)   tier = 'Silver';
    if (this.rewards.tier !== tier) {
      this.rewards.tier          = tier;
      this.rewards.tierUpdatedAt = new Date();
    }
  }
});

// ── §5  Instance Methods ──────────────────────────────────────────────────────

/** Live Vehicle doc (source of truth — vehicleStatus is just a cache). */
soloDriverPartnerSchema.methods.getVehicle = function () {
  return mongoose.model('Vehicle').findOne({ ownerType: 'SoloDriverPartner', ownerId: this._id });
};

soloDriverPartnerSchema.methods.getWallet = function () {
  if (!this.user) return null;
  return mongoose.model('PartnerWallet').findOne({ partner: this.user, partnerRole: 'solodriverpartner' });
};

soloDriverPartnerSchema.methods.getPendingSettlements = function () {
  if (!this.user) return [];
  return mongoose.model('PartnerSettlement').find({ partnerId: this.user, settlementStatus: 'PENDING' });
};

soloDriverPartnerSchema.methods.getOpenLiabilities = function () {
  if (!this.user) return [];
  return mongoose.model('PartnerCollectionLiability').find({
    partner: this.user,
    status: { $in: ['OPEN', 'PARTIALLY_RECOVERED'] },
  });
};

soloDriverPartnerSchema.methods.earnCoins = async function (amount, description, referenceId, referenceModel) {
  this.rewards.coinBalance      += amount;
  this.rewards.totalCoinsEarned += amount;
  this.rewards.coinTransactions.push({
    type: 'EARN', amount,
    balance:        this.rewards.coinBalance,
    description, referenceId, referenceModel,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });
  return this.save();
};

soloDriverPartnerSchema.methods.redeemCoins = async function (amount, description, referenceId) {
  if (this.rewards.coinBalance < amount) {
    throw new Error(`Insufficient coins. Balance: ${this.rewards.coinBalance}, Requested: ${amount}`);
  }
  this.rewards.coinBalance      -= amount;
  this.rewards.totalCoinsRedeem += amount;
  this.rewards.coinTransactions.push({
    type: 'REDEEM', amount,
    balance:        this.rewards.coinBalance,
    description, referenceId,
    referenceModel: 'Redemption',
  });
  return this.save();
};

soloDriverPartnerSchema.methods.awardBadge = async function (badgeId, name, description, iconUrl) {
  const already = this.rewards.badges.some(b => b.badgeId === badgeId);
  if (already) return this;
  this.rewards.badges.push({ badgeId, name, description, iconUrl });
  return this.save();
};

// ── §6  Indexes ───────────────────────────────────────────────────────────────

soloDriverPartnerSchema.index({ partnershipStatus: 1, isAvailable: 1 });
soloDriverPartnerSchema.index({ 'serviceZones.city': 1, 'serviceZones.state': 1 });
soloDriverPartnerSchema.index({ 'kyc.verificationStatus': 1 });
soloDriverPartnerSchema.index({ 'kyc.drivingLicenceExpiry': 1 });
soloDriverPartnerSchema.index({ 'medicalFitness.expiryDate': 1 });
soloDriverPartnerSchema.index({ 'dispatch.status': 1 });

const SoloDriverPartner = mongoose.model('SoloDriverPartner', soloDriverPartnerSchema);
export default SoloDriverPartner;