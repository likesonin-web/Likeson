import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Driver Model — Likeson.in
 *
 * AGENCY DRIVERS ONLY (ownerAgency = TransportPartner).
 * SoloDriverPartner is a completely separate entity — no Driver doc needed.
 *
 * MONEY — Driver holds NO payout/wallet fields.
 *   Platform credits PartnerWallet(partner=TransportPartner.user, partnerRole='transportpartner').
 *   Agency pays its drivers off-platform. Do NOT create PartnerWallet /
 *   PartnerCollectionLiability records against a Driver — attach to ownerAgency instead.
 *
 * VEHICLE — lives in standalone `Vehicle` collection (ownerType='TransportPartner',
 * ownerId=ownerAgency._id). assignedVehicleId points to Vehicle._id.
 *
 * SECTIONS
 *  §1  Sub-schemas
 *  §2  Badges & coins system
 *  §3  Main schema
 *  §4  Indexes
 *  §5  Virtuals
 *  §6  Pre-save middleware
 *  §7  Post-save hook — sync agency driver counters
 *  §8  Instance methods
 *  §9  Statics
 */

// ── §1  Sub-Schemas ───────────────────────────────────────────────────────────

const driverKycSchema = new Schema(
  {
    aadhaarNumber: {
      type:     String,
      required: [true, 'Aadhaar number is required'],
      trim:     true,
      match:    [/^\d{12}$/, 'Aadhaar must be 12 digits'],
      select:   false,
    },
    aadhaarLast4:  { type: String, maxlength: 4 },
    aadhaarDocUrl: { type: String },

    drivingLicenceNumber: {
      type:      String,
      required:  [true, 'Driving licence is required'],
      uppercase: true,
      trim:      true,
    },
    drivingLicenceExpiry: { type: Date, required: [true, 'DL expiry is required'] },
    drivingLicenceDocUrl: { type: String },
    licenceClass:         [{ type: String, trim: true }],

    psvBadgeNumber: { type: String, uppercase: true, trim: true },
    psvBadgeExpiry: { type: Date },
    psvBadgeDocUrl: { type: String },

    panNumber: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN'],
    },
    panDocUrl: { type: String },

    verificationStatus: {
      type:    String,
      enum:    ['Pending', 'Under-Review', 'Verified', 'Rejected'],
      default: 'Pending',
    },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt:      { type: Date },
    rejectionReason: { type: String },
    submittedAt:     { type: Date },
    isVerified:      { type: Boolean, default: false },
  },
  { _id: false }
);

const medicalFitnessSchema = new Schema(
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

/**
 * driverBankSchema — KYC display only (driver's personal account on file
 * for agency record-keeping). NOT used for platform payout.
 */
const driverBankSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true },
    accountNumber:     { type: String, trim: true, select: false },
    accountLast4:      { type: String, maxlength: 4 },
    ifscCode: {
      type:      String,
      uppercase: true,
      trim:      true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'],
    },
    bankName:       { type: String, trim: true },
    upiId:          { type: String, trim: true },
    isBankVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

// ── §2  Badges & Coins System ─────────────────────────────────────────────────

const driverBadgeSchema = new Schema(
  {
    badgeId: {
      type: String,
      enum: [
        'FIRST_RIDE', 'RIDES_10', 'RIDES_50', 'RIDES_100', 'RIDES_500',
        'RIDES_1000', 'TOP_RATED', 'PERFECT_WEEK', 'SPEED_KING',
        'ZERO_CANCEL_MONTH', 'SAFE_DRIVER', 'NIGHT_OWL', 'LONG_HAUL',
        'VERIFIED_DRIVER', 'LOYAL_DRIVER_1Y', 'LOYAL_DRIVER_2Y', 'EARLY_ADOPTER',
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

/**
 * driverCoinTxnSchema — REWARDS coins, NOT money. Separate from
 * PartnerWalletTransaction (real-money ledger on TransportPartner).
 */
const driverCoinTxnSchema = new Schema(
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

const driverRewardSchema = new Schema(
  {
    coinBalance:      { type: Number, default: 0, min: 0 },
    totalCoinsEarned: { type: Number, default: 0, min: 0 },
    totalCoinsRedeem: { type: Number, default: 0, min: 0 },
    coinTransactions: [driverCoinTxnSchema],
    badges:           [driverBadgeSchema],
    tier: {
      type:    String,
      enum:    ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'],
      default: 'Bronze',
    },
    tierUpdatedAt:       { type: Date },
    coinsPerRide:        { type: Number, default: 5 },
    bonusCoinsThisMonth: { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * driverEarningLogSchema — DISPLAY ONLY. NOT a wallet.
 * Agency driver money settles into ownerAgency's (TransportPartner) PartnerWallet.
 * This log shows the driver app what rides contributed — agency pays off-platform.
 */
const driverEarningLogSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    rideId:    { type: Schema.Types.ObjectId, ref: 'Ride', required: true },
    amount:    { type: Number, required: true, min: 0 },
    status: {
      type:    String,
      enum:    ['pending', 'received'],
      default: 'pending',
    },
    markedReceivedAt: { type: Date, default: null },
    markedBy:         { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdAt:        { type: Date, default: Date.now },
  },
  { _id: true }
);

// ── §3  Main Schema ───────────────────────────────────────────────────────────

const driverSchema = new Schema(
  {
    // ── Identity / Ownership ──────────────────────────────────────────────────
    user: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User reference is required'],
      unique:   true,
      index:    true,
    },

    /**
     * ownerAgency — required. Driver belongs to a TransportPartner agency.
     * SoloDriverPartner does NOT create Driver docs.
     */
    ownerAgency: {
      type:     Schema.Types.ObjectId,
      ref:      'TransportPartner',
      required: [true, 'Agency (ownerAgency) is required for all drivers'],
      index:    true,
    },

    /**
     * assignedVehicleId — points to Vehicle._id in the standalone Vehicle
     * collection (ownerType='TransportPartner').
     */
    assignedVehicleId: {
      type:    Schema.Types.ObjectId,
      ref:     'Vehicle',
      default: null,
      index:   true,
    },

    /**
     * Denormalised vehicle snapshot, synced from Vehicle on assignment.
     * Display/dispatch only — never source of truth for verification.
     */
    assignedVehicleSnapshot: {
      vehicleCode:        { type: String },
      registrationNumber: { type: String },
      make:               { type: String },
      model:              { type: String },
      vehicleType:        { type: String },
      color:              { type: String },
    },

    // ── Personal ──────────────────────────────────────────────────────────────
    driverCode: {
      type:      String,
      unique:    true,
      sparse:    true,
      uppercase: true,
      trim:      true,
      index:     true,
    },
    legalName:   { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender:      { type: String, enum: ['Male', 'Female', 'Other', 'Prefer Not to Say'] },
    photoUrl:    { type: String },

    // ── Contact ───────────────────────────────────────────────────────────────
    phone:          { type: String, match: [/^[6-9]\d{9}$/, 'Invalid mobile'] },
    altPhone:       { type: String },
    whatsappNumber: { type: String },
    email:          { type: String, lowercase: true, trim: true },

    // ── Professional ──────────────────────────────────────────────────────────
    yearsOfExperience:      { type: Number, default: 0, min: 0, max: 60 },
    languagesSpoken: [
      {
        type: String,
        enum: ['Telugu', 'Hindi', 'English', 'Tamil', 'Kannada', 'Other'],
      },
    ],
    hasMedicalTransportExp: { type: Boolean, default: false },
    hasAmbulanceExp:        { type: Boolean, default: false },
    trainingCertificates: [
      {
        name:        { type: String, trim: true, required: true },
        issuedBy:    { type: String, trim: true },
        issuedAt:    { type: Date },
        expiresAt:   { type: Date },
        documentUrl: { type: String },
      },
    ],

    // ── KYC ───────────────────────────────────────────────────────────────────
    kyc: { type: driverKycSchema, required: true },

    // ── Medical Fitness ───────────────────────────────────────────────────────
    medicalFitness: { type: medicalFitnessSchema, default: () => ({}) },

    // ── Bank (record-keeping only — NOT payout source) ────────────────────────
    bankDetails: { type: driverBankSchema, default: () => ({}) },

    // ── Emergency Contact ─────────────────────────────────────────────────────
    emergencyContact: {
      name:         { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone:        { type: String, match: [/^[6-9]\d{9}$/, 'Invalid mobile'] },
    },

    // ── Shift / Availability ──────────────────────────────────────────────────
    shift: {
      shiftType: {
        type:    String,
        enum:    ['Morning', 'Afternoon', 'Evening', 'Night', 'Full-Day', 'On-Call'],
        default: 'Full-Day',
      },
      startTime:       { type: String, default: '08:00' },
      endTime:         { type: String, default: '20:00' },
      daysAvailable:   [{ type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] }],
      isAvailableNow:  { type: Boolean, default: false },
      nextAvailableAt: { type: Date },
    },

    // ── Live Location ─────────────────────────────────────────────────────────
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [80.648, 16.506] },
      heading:     { type: Number, min: 0, max: 360 },
      speedKmh:    { type: Number, min: 0 },
      updatedAt:   { type: Date, default: Date.now },
    },

    // ── Performance ───────────────────────────────────────────────────────────
performance: {
      rating:               { type: Number, default: 0, min: 0, max: 5 },
      ratingCount:          { type: Number, default: 0 },
      totalRidesCompleted:  { type: Number, default: 0 },
      totalRidesCancelled:  { type: Number, default: 0 },
      cancellationRate:     { type: Number, default: 0 },
      avgPickupTimeMinutes: { type: Number, default: 0 },
      totalDistanceKm:      { type: Number, default: 0 },
      // NEW (Point 7): cumulative hours actually worked across all completed
      // rides = sum(rideCompletedAt - rideStartedAt). Written by
      // partnerAssignmentEngine.service.js#recordPartnerTripCompletion.
      totalHoursWorked:     { type: Number, default: 0, min: 0 },
      totalEarnings:        { type: Number, default: 0 }, // analytics cache — re-derive from BookingPartnerAllocation
      monthlyRides:         { type: Number, default: 0 },
      lastRideAt:           { type: Date },
      performanceTier: {
        type:    String,
        enum:    ['Platinum', 'Gold', 'Silver', 'Bronze', 'Probation'],
        default: 'Bronze',
      },
      warningCount:     { type: Number, default: 0 },
      complaintsCount:  { type: Number, default: 0 },
      complimentsCount: { type: Number, default: 0 },
    },

    // ── Status ────────────────────────────────────────────────────────────────
    status: {
      type:    String,
      enum:    ['Available', 'On-Trip', 'Offline', 'On-Break', 'Suspended'],
      default: 'Offline',
      index:   true,
    },
    isActive:    { type: Boolean, default: false },
    isVerified:  { type: Boolean, default: false },
    isBlocked:   { type: Boolean, default: false },
    blockReason: { type: String },
    isPaused:    { type: Boolean, default: false },
    pauseReason: { type: String },
    pausedUntil: { type: Date },

    currentRide: { type: Schema.Types.ObjectId, ref: 'Ride', default: null },

    rewards: { type: driverRewardSchema, default: () => ({}) },

    // NEW (Point 7): bounded log of completed-ride distance/hours, written by
    // recordPartnerTripCompletion(). Capped at 500 most-recent entries via
    // $slice — performance.totalDistanceKm / totalHoursWorked are the
    // authoritative running totals; this array is for per-trip drill-down.
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

    // ── Earnings Display (informational only — Driver has NO wallet) ─────────
    // Real money → TransportPartner.PartnerWallet.
    earningsSummary: {
      pendingTotal:  { type: Number, default: 0, min: 0 },
      receivedTotal: { type: Number, default: 0, min: 0 },
    },
    earningsLog: { type: [driverEarningLogSchema], default: [] },

    // ── Onboarding ────────────────────────────────────────────────────────────
    onboarding: {
      step:            { type: Number,  default: 1 },
      isComplete:      { type: Boolean, default: false },
      completedAt:     { type: Date },
      agreedToTermsAt: { type: Date },
      agreedToTermsIp: { type: String },
    },

    profileCompletionPercent: { type: Number, default: 0, min: 0, max: 100 },

    // ── Notification Preferences ──────────────────────────────────────────────
    notifPrefs: {
      smsAlerts:         { type: Boolean, default: true },
      whatsappAlerts:    { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
    },

    adminNotes: { type: String, maxlength: 1000 },
    tags:       [{ type: String, trim: true, lowercase: true }],
    createdBy:  { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:  { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── §4  Indexes ───────────────────────────────────────────────────────────────

driverSchema.index({ location: '2dsphere' });
driverSchema.index({ ownerAgency: 1, status: 1 });
driverSchema.index({ ownerAgency: 1, isActive: 1 });
driverSchema.index({ 'kyc.verificationStatus': 1 });
driverSchema.index({ 'kyc.drivingLicenceExpiry': 1 });
driverSchema.index({ 'medicalFitness.expiryDate': 1 });
driverSchema.index({ 'performance.rating': -1 });
driverSchema.index({ createdAt: -1 });

// ── §5  Virtuals ──────────────────────────────────────────────────────────────

driverSchema.virtual('aadhaarMasked').get(function () {
  const last4 = this.kyc?.aadhaarLast4 || '';
  return last4 ? `XXXX XXXX ${last4}` : null;
});

driverSchema.virtual('isDispatchable').get(function () {
  return (
    this.isActive &&
    this.isVerified &&
    !this.isBlocked &&
    !this.isPaused &&
    this.status === 'Available' &&
    this.kyc?.verificationStatus === 'Verified'
  );
});

driverSchema.virtual('hasExpiringCompliance').get(function () {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return (
    (this.kyc?.drivingLicenceExpiry  && this.kyc.drivingLicenceExpiry  < soon) ||
    (this.kyc?.psvBadgeExpiry        && this.kyc.psvBadgeExpiry        < soon) ||
    (this.medicalFitness?.expiryDate && this.medicalFitness.expiryDate < soon)
  );
});

// ── §6  Pre-save Middleware ───────────────────────────────────────────────────

driverSchema.pre('save', async function () {
  // ownerAgency is required — enforced by schema but guard here too
  if (!this.ownerAgency) {
    throw new Error('A Driver must be linked to an agency (ownerAgency). Use SoloDriverPartner for self-employed drivers.');
  }

  if (!this.driverCode) {
    const ts   = Date.now().toString(36).slice(-6).toUpperCase();
    const rand = Math.random().toString(36).slice(-2).toUpperCase();
    this.driverCode = `LKS-DRV-${ts}${rand}`;
  }

  if (this.isModified('kyc.aadhaarNumber') && this.kyc?.aadhaarNumber) {
    this.kyc.aadhaarLast4 = this.kyc.aadhaarNumber.slice(-4);
  }

  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  if (this.isModified('kyc.verificationStatus')) {
    this.isVerified = this.kyc.verificationStatus === 'Verified';
    if (this.isVerified && !this.isActive) this.isActive = true;
    if (this.isVerified) this.kyc.isVerified = true;
  }

  if (
    this.isModified('kyc.drivingLicenceNumber') &&
    this.kyc?.drivingLicenceNumber &&
    !this.kyc.submittedAt
  ) {
    this.kyc.submittedAt = new Date();
  }

  if (this.isModified('isBlocked') && !this.isBlocked) this.blockReason = undefined;

  if (this.isPaused && this.pausedUntil && this.pausedUntil < new Date()) {
    this.isPaused    = false;
    this.pausedUntil = undefined;
    this.pauseReason = undefined;
  }

  if (this.isModified()) {
    const checks = [
      this.legalName,
      this.dateOfBirth,
      this.phone,
      this.kyc?.aadhaarNumber,
      this.kyc?.drivingLicenceNumber,
      this.kyc?.drivingLicenceDocUrl,
      this.kyc?.isVerified,
      this.medicalFitness?.certificateNumber,
      this.bankDetails?.accountNumber,
      this.emergencyContact?.phone,
    ];
    this.profileCompletionPercent = Math.round(
      (checks.filter(Boolean).length / checks.length) * 100
    );
  }

  if (this.isModified('performance.totalRidesCompleted')) {
    const rides = this.performance.totalRidesCompleted;
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

// ── §7  Post-save — sync agency driver counters ───────────────────────────────

driverSchema.post('save', async function () {
  try {
    const [totals] = await mongoose.model('Driver').aggregate([
      { $match: { ownerAgency: this.ownerAgency } },
      {
        $group: {
          _id:           null,
          totalDrivers:  { $sum: 1 },
          activeDrivers: {
            $sum: { $cond: [{ $in: ['$status', ['Available', 'On-Trip']] }, 1, 0] },
          },
        },
      },
    ]);

    if (totals) {
      await mongoose.model('TransportPartner').findByIdAndUpdate(
        this.ownerAgency,
        {
          'fleetInfo.totalDrivers':  totals.totalDrivers,
          'fleetInfo.activeDrivers': totals.activeDrivers,
        }
      );
    }
  } catch (err) {
    console.error('[Driver.post-save] fleet counter sync failed:', err.message);
  }
});

// ── §8  Instance Methods ──────────────────────────────────────────────────────

driverSchema.methods.earnCoins = async function (amount, description, referenceId, referenceModel) {
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

driverSchema.methods.redeemCoins = async function (amount, description, referenceId) {
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

driverSchema.methods.awardBadge = async function (badgeId, name, description, iconUrl) {
  const already = this.rewards.badges.some(b => b.badgeId === badgeId);
  if (already) return this;
  this.rewards.badges.push({ badgeId, name, description, iconUrl });
  return this.save();
};

/**
 * markEarningsReceived — agency admin confirms driver paid off-platform.
 * Display only — touches no wallet/ledger. entryIds=[] marks all pending.
 */
driverSchema.methods.markEarningsReceived = async function (entryIds = [], markedByUserId = null) {
  let receivedNow = 0;
  this.earningsLog.forEach((entry) => {
    if (entry.status !== 'pending') return;
    if (entryIds.length > 0 && !entryIds.some((id) => id.toString() === entry._id.toString())) return;
    entry.status = 'received';
    entry.markedReceivedAt = new Date();
    entry.markedBy = markedByUserId;
    receivedNow += entry.amount;
  });
  this.earningsSummary.pendingTotal  = Math.max(0, +(this.earningsSummary.pendingTotal - receivedNow).toFixed(2));
  this.earningsSummary.receivedTotal = +(this.earningsSummary.receivedTotal + receivedNow).toFixed(2);
  return this.save();
};

driverSchema.methods.getAssignedVehicle = function () {
  if (!this.assignedVehicleId) return null;
  return mongoose.model('Vehicle').findById(this.assignedVehicleId);
};

/**
 * Assign a vehicle — updates Vehicle.assignedDriver (source of truth) AND
 * this.assignedVehicleId + snapshot (cache).
 */
driverSchema.methods.assignVehicle = async function (vehicleId) {
  const Vehicle = mongoose.model('Vehicle');
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle) throw new Error('Vehicle not found');

  if (this.assignedVehicleId) {
    await Vehicle.findByIdAndUpdate(this.assignedVehicleId, { assignedDriver: null, assignedAt: null });
  }

  vehicle.assignedDriver = this._id;
  vehicle.assignedAt     = new Date();
  await vehicle.save();

  this.assignedVehicleId = vehicle._id;
  this.assignedVehicleSnapshot = {
    vehicleCode:        vehicle.vehicleCode,
    registrationNumber: vehicle.registrationNumber,
    make:               vehicle.make,
    model:              vehicle.model,
    vehicleType:        vehicle.vehicleType,
    color:              vehicle.color,
  };
  return this.save();
};

// ── §9  Statics ───────────────────────────────────────────────────────────────

driverSchema.statics.findNearestAvailable = function (
  lng, lat, maxDistanceMeters = 10_000, agencyId
) {
  const filter = {
    isActive:   true,
    isVerified: true,
    isBlocked:  false,
    isPaused:   false,
    status:     'Available',
    'kyc.verificationStatus': 'Verified',
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistanceMeters,
      },
    },
  };
  if (agencyId) filter.ownerAgency = agencyId;

  return this.find(filter)
    .populate('user', 'name phone avatar')
    .limit(10);
};

driverSchema.statics.findByAgency = function (agencyId, status) {
  const filter = { ownerAgency: agencyId };
  if (status) filter.status = status;
  return this.find(filter).sort({ createdAt: -1 });
};

const Driver = mongoose.model('Driver', driverSchema);
export default Driver;