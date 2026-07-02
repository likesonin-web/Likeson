import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL TYPE CLASSIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export const MANAGED_HOSPITAL_TYPES = ['Multi-Specialty', 'Super-Specialty', 'Trust', 'Government'];
export const OWNER_OPERATED_TYPES   = ['Clinic', 'Nursing Home'];
export const ALL_HOSPITAL_TYPES     = [...MANAGED_HOSPITAL_TYPES, ...OWNER_OPERATED_TYPES];

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const operatingHoursSchema = new Schema(
  {
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    },
    openTime:  { type: String }, // "08:00"
    closeTime: { type: String }, // "20:00"
    is24Hours: { type: Boolean, default: false },
    isClosed:  { type: Boolean, default: false },
  },
  { _id: true }
);

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings:  { type: Number, default: 0 },
    totalReviews:  { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * hospitalConsultationPricingSchema
 * ----------------------------------
 * Consultation pricing owned by the HOSPITAL — only meaningful when
 * managementModel === 'hospital-manager'. This is the pricing source
 * that PricingEngine.resolve() must read when the hospital controls fees.
 *
 * NOTE on naming (Problem 4 fix):
 *   "hospitalShare" was ambiguous. We do NOT store a derived share here —
 *   shares are always *computed* by the pricing engine at booking time and
 *   frozen into the booking's pricingSnapshot as:
 *     grossHospitalShare   = baseFee - doctorHonorarium (pre-deduction)
 *     netHospitalSettlement = grossHospitalShare - platformFeeDeduction - taxDeduction
 *   This schema only stores the hospital's *inputs* (fee, honorarium),
 *   never a derived/settlement number — derived numbers must never be
 *   persisted outside an immutable snapshot or settlement record.
 */
const hospitalConsultationPricingSchema = new Schema(
  {
    inPersonFee:   { type: Number, default: null, min: 0 },
    videoFee:      { type: Number, default: null, min: 0 },
    homeVisitFee:  { type: Number, default: null, min: 0 },

    inPersonHonorarium:  { type: Number, default: null, min: 0 },
    videoHonorarium:     { type: Number, default: null, min: 0 },
    homeVisitHonorarium: { type: Number, default: null, min: 0 },

    followUpFee:             { type: Number, default: 0,  min: 0 },
    followUpDiscountPercent: { type: Number, default: 20, min: 0, max: 100 },
    followUpValidDays:       { type: Number, default: 7,  min: 1, max: 90 },

    consultationTypes: {
      inPerson:  { type: Boolean, default: true  },
      video:     { type: Boolean, default: false },
      homeVisit: { type: Boolean, default: false },
    },

    // ── Platform fee override (Problem 5: priority chain) ─────────────────
    // Priority resolved by PricingEngine as:
    //   Doctor.platformFee override  →  Hospital.consultationPricing.platformFeeOverride
    //   →  PlatformPricingConfig.hospital.hospitalOverrides[hospitalId]
    //   →  PlatformPricingConfig.hospital.platformFee (default)
    platformFeeOverride: {
      type: new Schema({ type: { type: String, enum: ['fixed', 'percentage'] }, value: { type: Number, min: 0 } }, { _id: false }),
      default: null,
    },

    // ── Effective dating (Problem 9) ────────────────────────────────────────
    effectiveFrom:  { type: Date, default: Date.now },
    effectiveUntil: { type: Date, default: null }, // null = open-ended / current

    // ── Versioning (bookings reference this, never recompute historically) ──
    pricingVersion: { type: Number, default: 1, min: 1 },

    lastUpdatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedByRole: { type: String, enum: ['admin', 'superadmin', 'hospital'] },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────
const hospitalSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, unique: true, lowercase: true, trim: true, index: true },
    hospitalType: { type: String, required: true, enum: ALL_HOSPITAL_TYPES },
    managementModel: { type: String, enum: ['hospital-manager', 'doctor-owner'], index: true },
    managedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // ── Blood Bank References ─────────────────────────────────────────────────
    bloodBanks: [{ type: Schema.Types.ObjectId, ref: 'BloodBank' }],
    primaryBloodBank: { type: Schema.Types.ObjectId, ref: 'BloodBank', default: null },
    acceptsBloodRequests: { type: Boolean, default: true },

    description: { type: String, maxlength: 1000 },
    logo:        { type: String },
    images: { type: [String], default: [], validate: [v => v.length <= 20, 'Max 20 images allowed'] },

    // ── Accreditations ────────────────────────────────────────────────────────
    accreditations:     [{ type: String, enum: ['NABH', 'NABL', 'JCI', 'ISO', 'AHPI', 'Other'] }],
    nabledLabAvailable: { type: Boolean, default: false },

    // ── Contact ───────────────────────────────────────────────────────────────
    contact: {
      email:          { type: String, lowercase: true, trim: true },
      phone:          { type: String, required: true },
      emergencyPhone: { type: String },
      alternatePhone: { type: String },
      website:        { type: String },
      whatsapp:       { type: String },
    },

    // ── Address ───────────────────────────────────────────────────────────────
    address: {
      line1:    { type: String, required: true, trim: true },
      line2:    { type: String, trim: true },
      landmark: { type: String, trim: true },
      city:     { type: String, default: 'Vijayawada', trim: true },
      state:    { type: String, default: 'Andhra Pradesh', trim: true },
      pincode:  { type: String, required: true, trim: true, match: [/^[1-9][0-9]{5}$/, 'Invalid Indian PIN code'] },
    },

    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
      address: String,
    },
    googleMapsUrl: { type: String },

    // ── Services & Specialties ────────────────────────────────────────────────
    specialties:     [{ type: String, trim: true }],
    facilities:      [{ type: String, trim: true }],
    acceptedSchemes: [{ type: String, trim: true }],
    bedCount: { total: { type: Number, default: 0, min: 0 }, icu: { type: Number, default: 0, min: 0 } },

    // ── Facility Flags ────────────────────────────────────────────────────────
    isEmergencyReady:    { type: Boolean, default: false },
    hasICU:              { type: Boolean, default: false },
    hasBloodBank:        { type: Boolean, default: false },
    hasPharmacy:         { type: Boolean, default: false },
    hasDiagnostics:      { type: Boolean, default: false },
    hasAmbulance:        { type: Boolean, default: false },
    hasWheelchairAccess: { type: Boolean, default: false },
    is24x7:              { type: Boolean, default: false },

    // ── Operating Hours ───────────────────────────────────────────────────────
    operatingHours: { type: [operatingHoursSchema], default: [] },

    // ── Registration / Legal ──────────────────────────────────────────────────
    registrationDetails: {
      licenseNumber: { type: String, required: true, trim: true },
      gstNumber:     { type: String, trim: true },
      panNumber:     { type: String, trim: true, uppercase: true, match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN'] },
      documentUrl:   { type: String },
      licenseExpiry: { type: Date },
    },

    // ── Settlement ────────────────────────────────────────────────────────────
    settlementCycle: { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: null },

    // ── Consultation Pricing — CURRENT (hospital-manager type only) ───────────
    consultationPricing: { type: hospitalConsultationPricingSchema, default: () => ({}) },

    // ── Pricing History (Problem 3 + 9) ────────────────────────────────────────
    // Every time consultationPricing changes, the PREVIOUS version is pushed
    // here before overwrite — never mutated, never deleted. Bookings store a
    // pricingVersion + pricingRuleId in their own immutable pricingSnapshot
    // (owned by the Booking model), so this array exists purely so the
    // pricing engine can resolve "what was hospital pricing on date X" and
    // so future-dated pricing (effectiveFrom in the future) can be queued
    // without touching the currently-active version.
    pricingHistory: { type: [hospitalConsultationPricingSchema], default: [] },

    // Scheduled future pricing versions (effectiveFrom > now). PricingEngine
    // promotes the matching entry into `consultationPricing` (and archives
    // the old one into pricingHistory) once effectiveFrom is reached — this
    // schema does not do that promotion itself, it only stores the queue.
    scheduledPricing: { type: [hospitalConsultationPricingSchema], default: [] },

    // ── Linked Doctors ────────────────────────────────────────────────────────
    linkedDoctors: [{ type: Schema.Types.ObjectId, ref: 'DoctorProfile' }],

    // ── Rating ────────────────────────────────────────────────────────────────
    rating: { type: ratingSummarySchema, default: () => ({}) },

    // ── Verification & Status ─────────────────────────────────────────────────
    isVerified: { type: Boolean, default: false, index: true },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isActive:   { type: Boolean, default: true, index: true },

    // ── Onboarding ────────────────────────────────────────────────────────────
    onboarding: { step: { type: Number, default: 1 }, isComplete: { type: Boolean, default: false }, completedAt: { type: Date } },

    // ── Internal ──────────────────────────────────────────────────────────────
    internalNotes: { type: String, select: false },
    createdBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

hospitalSchema.virtual('isOperational').get(function () { return this.isActive && this.isVerified; });
hospitalSchema.virtual('isManagedHospital').get(function () { return this.managementModel === 'hospital-manager'; });
hospitalSchema.virtual('isOwnerOperated').get(function () { return this.managementModel === 'doctor-owner'; });
hospitalSchema.virtual('hasCustomSettlementCycle').get(function () { return this.settlementCycle !== null && this.settlementCycle !== undefined; });

// ── Pre-validate ──────────────────────────────────────────────────────────────

hospitalSchema.pre('validate', async function () {
  if (this.isModified('hospitalType') || this.isNew) {
    if (MANAGED_HOSPITAL_TYPES.includes(this.hospitalType)) {
      this.managementModel = 'hospital-manager';
    } else if (OWNER_OPERATED_TYPES.includes(this.hospitalType)) {
      this.managementModel = 'doctor-owner';
    }
  }

  if (this.isModified('consultationPricing') && this.consultationPricing) {
    const types = ['inPerson', 'video', 'homeVisit'];
    for (const t of types) {
      const fee = this.consultationPricing[`${t}Fee`];
      const hon = this.consultationPricing[`${t}Honorarium`];
      if (fee != null && hon != null && hon > fee) {
        throw new Error(`${t}Honorarium cannot exceed ${t}Fee`);
      }
    }
    if (this.consultationPricing.effectiveUntil && this.consultationPricing.effectiveFrom &&
        this.consultationPricing.effectiveUntil <= this.consultationPricing.effectiveFrom) {
      throw new Error('consultationPricing.effectiveUntil must be after effectiveFrom');
    }
  }

  // Prohibit overlapping effective windows in scheduledPricing (Problem 9 + validation reqs)
  if (this.isModified('scheduledPricing') && this.scheduledPricing?.length) {
    const windows = [...this.scheduledPricing]
      .filter(p => p.effectiveFrom)
      .sort((a, b) => a.effectiveFrom - b.effectiveFrom);
    for (let i = 0; i < windows.length - 1; i++) {
      const curr = windows[i];
      const next = windows[i + 1];
      const currEnd = curr.effectiveUntil ?? Infinity;
      if (currEnd > next.effectiveFrom) {
        throw new Error(
          `Scheduled pricing overlap: version ${curr.pricingVersion} (until ${curr.effectiveUntil ?? 'open-ended'}) ` +
          `overlaps version ${next.pricingVersion} (from ${next.effectiveFrom})`
        );
      }
    }
    const versions = this.scheduledPricing.map(p => p.pricingVersion);
    if (new Set(versions).size !== versions.length) {
      throw new Error('Duplicate pricingVersion values in scheduledPricing');
    }
  }

  if ((this.isModified('managedBy') || this.isModified('managementModel') || this.isNew) && this.managedBy) {
    const User    = mongoose.model('User');
    const manager = await User.findById(this.managedBy).select('role').lean();

    if (!manager) throw new Error('managedBy references a non-existent User');
    if (this.managementModel === 'hospital-manager' && manager.role !== 'hospital') {
      throw new Error(`${this.hospitalType} hospitals require managedBy to be a User with role "hospital" — got "${manager.role}"`);
    }
    if (this.managementModel === 'doctor-owner' && manager.role !== 'doctor') {
      throw new Error(`${this.hospitalType} hospitals require managedBy to be a User with role "doctor" — got "${manager.role}"`);
    }
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

hospitalSchema.pre('save', function () {
  if ((this.isNew || this.isModified('name')) && !this.slug) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }
  if (this.isModified('bedCount.icu')) {
    this.hasICU = (this.bedCount?.icu ?? 0) > 0;
  }

  // Archive previous consultationPricing into pricingHistory instead of
  // silently overwriting it (Problem 3 + Problem 8: nothing pricing-related
  // disappears silently). Audit fields (changedBy/reason/IP) belong on the
  // PricingAuditService side — this just guarantees the old value survives.
if (!this.isNew && this.isModified('consultationPricing')) {
    const prev = this.get('consultationPricing', null, { getters: false, virtuals: false });
    if (prev && this._original?.consultationPricing) {
      if (!Array.isArray(this.pricingHistory)) this.pricingHistory = [];
      this.pricingHistory.push(this._original.consultationPricing);
    }
  }
});

// Capture pre-change snapshot on init so pre('save') can diff against it.
hospitalSchema.post('init', function () {
  this._original = { consultationPricing: this.toObject().consultationPricing };
});

// ── Indexes ───────────────────────────────────────────────────────────────────

hospitalSchema.index({ location: '2dsphere' });
hospitalSchema.index({ 'address.city': 1, isActive: 1 });
hospitalSchema.index({ hospitalType: 1, isActive: 1 });
hospitalSchema.index({ managementModel: 1, isActive: 1 });
hospitalSchema.index({ 'rating.averageRating': -1 });
hospitalSchema.index({ 'registrationDetails.licenseNumber': 1 }, { unique: true, sparse: true });
hospitalSchema.index({ linkedDoctors: 1 });
hospitalSchema.index({ isVerified: 1, isActive: 1 });
hospitalSchema.index({ bloodBanks: 1 });
hospitalSchema.index({ primaryBloodBank: 1 });

const Hospital = mongoose.model('Hospital', hospitalSchema);
export default Hospital;