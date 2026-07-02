import mongoose from 'mongoose';
const { Schema } = mongoose;

// ─────────────────────────────────────────────────────────────────────────────
// COMMON: Platform Fee Schema
// ─────────────────────────────────────────────────────────────────────────────
const platformFeeSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT: Duration-Based Pricing Tier
// ─────────────────────────────────────────────────────────────────────────────
const careAssistantPricingTierSchema = new Schema(
  {
    label:             { type: String, trim: true, required: true },
    minHours:          { type: Number, required: true, min: 0 },
    maxHours:          { type: Number, default: null },
    chargeToUser:      { type: Number, required: true, min: 0 },
    payoutToAssistant: { type: Number, required: true, min: 0 },
    isActive:          { type: Boolean, default: true },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT PRICING
// ─────────────────────────────────────────────────────────────────────────────
const careAssistantPricingSchema = new Schema(
  {
    pricingTiers: {
      type: [careAssistantPricingTierSchema],
      default: () => [],
    },
    platformFee:              { type: platformFeeSchema, required: true },
    dedicatedMonthlyPayout:   { type: Number, default: 8000 },
    dedicatedMonthlyCharge:   { type: Number, default: 10000 },
    punctualityBonusPerVisit: { type: Number, default: 25 },
    noShowPenalty:            { type: Number, default: 100 },
    overtimeRatePerHour:      { type: Number, default: 120 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// VERSION HISTORY
// ─────────────────────────────────────────────────────────────────────────────
const versionHistorySchema = new Schema(
  {
    changedBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedByRole: { type: String, enum: ['admin', 'superadmin'], required: true },
    section:       { type: String, default: null },
    changeSource:  { type: String, default: 'manual' },
    changeNote:    { type: String },
    snapshot:      { type: Schema.Types.Mixed },
    changedAt:     { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// CAPS
// ─────────────────────────────────────────────────────────────────────────────
const capsSchema = new Schema(
  {
    pharmacyDiscountMax:            { type: Number, default: 25, min: 0, max: 100 },
    diagnosticsDiscountMax:         { type: Number, default: 25, min: 0, max: 100 },
    careAssistantMaxVisitsPerMonth: { type: Number, default: 30 },
    consultationsMaxPerMonth:       { type: Number, default: 30 },
    transportMaxRidesPerMonth:      { type: Number, default: 20 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────
const transportPricingSchema = new Schema(
  {
    baseFare:         { type: Number, default: 50 },
    defaultRatePerKm: { type: Number, default: 21 },

    planRateOverrides: {
      type: Map,
      of: Number,
      default: {
        'basic-care':           20,
        'standard-care':        19,
        'premium-care':         18,
        'family-care':          18,
        'pregnant-women-care':  18,
        'nris-care':            null,
      },
    },

    platformFee: { type: platformFeeSchema, required: true },

    nightSurchargeMultiplier: { type: Number, default: 1.2 },
    nightStartHour:           { type: Number, default: 22 },
    nightEndHour:             { type: Number, default: 6 },

    waitingFreeMinutes:       { type: Number, default: 5 },
    waitingChargePerMinute:   { type: Number, default: 2 },

    cancellationFeePercent:   { type: Number, default: 50 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR
// ─────────────────────────────────────────────────────────────────────────────
const doctorPricingSchema = new Schema(
  {
    honorariumPerConsultation: { type: Number, default: 400 },
    chargeToUser:              { type: Number, default: 600 },

    platformFee: { type: platformFeeSchema, required: true },

    teleConsultationChargeToUser: { type: Number, default: 500 },
    teleConsultationHonorarium:   { type: Number, default: 350 },

    homeVisitChargeToUser: { type: Number, default: 1000 },
    homeVisitHonorarium:   { type: Number, default: 700 },

    followUpDiscountPercent: { type: Number, default: 20 },
    followUpValidDays:       { type: Number, default: 7 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL
// ─────────────────────────────────────────────────────────────────────────────
const hospitalSchema = new Schema(
  {
    platformFee:       { type: platformFeeSchema, required: true },
    hospitalOverrides: { type: Map, of: platformFeeSchema, default: {} },
    settlementCycle:   { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────
const diagnosticsSchema = new Schema(
  {
    platformFee: { type: platformFeeSchema, required: true },
    labOverrides: {
      type: Map,
      of:   platformFeeSchema,
      default: {},
    },
    homeSampleCollectionCharge: { type: Number, default: 75 },
    homeSamplePlatformFee:      { type: platformFeeSchema, required: true },
    physicalReportFee:          { type: Number, default: 50 },
    settlementCycle:            { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY
// ─────────────────────────────────────────────────────────────────────────────
const pharmacySchema = new Schema(
  {
    platformFee:               { type: platformFeeSchema, required: true },
    ownStoreMarginPercent:     { type: Number, default: 30 },
    expressDeliveryCharge:     { type: Number, default: 49 },
    deliveryAgentPayout:       { type: Number, default: 30 },
    freeDeliveryMinOrderValue: { type: Number, default: 200 },
    settlementCycle:           { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM PLAN OPTIONS
//
// CHANGE 1: kmSlabs — dropped `km` field entirely.
//           Each slab stores only:
//             pricePerKm   = rate charged per km for this slab option
//             packagePrice = flat plan add-on price when user selects this slab
//           Service layer computes trip cost as: actualKm * pricePerKm
// ─────────────────────────────────────────────────────────────────────────────
const customPlanOptionPricingSchema = new Schema(
  {
   consultation: {
  pricePerConsultation: { type: Number, required: true },
},

    transport: {
      kmSlabs: [
        {
          // CHANGE: removed `km` — no distance band / radius stored.
          // pricePerKm   = per-km rate for this slab option.
          // packagePrice = flat price of this slab in a custom plan.
          pricePerKm:   { type: Number, required: true, min: 0 },
          packagePrice: { type: Number, required: true, min: 0 },
        },
      ],
    },

    diagnosticsDiscount: {
      slabs: [
        {
          percent: { type: Number, required: true },
          price:   { type: Number, required: true },
        },
      ],
    },

    pharmacyDiscount: {
      slabs: [
        {
          percent: { type: Number, required: true },
          price:   { type: Number, required: true },
        },
      ],
    },

    careAssistant: {
      pricingTiers: {
        type: [careAssistantPricingTierSchema],
        default: () => [],
      },
    },

    addOns: {
      homeSampleCollection: { type: Number, default: 199 },
      prioritySupport:      { type: Number, default: 99 },
    },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// ADS
// ─────────────────────────────────────────────────────────────────────────────
const adsSchema = new Schema(
  {
    sponsoredListingMonthly: { type: Number, default: 5000 },
    homePageBannerMonthly:   { type: Number, default: 15000 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// TAX
// ─────────────────────────────────────────────────────────────────────────────
const taxSchema = new Schema(
  {
    defaultGstPercent:       { type: Number, default: 18 },
    pharmacyGstPercent:      { type: Number, default: 12 },
    transportGstPercent:     { type: Number, default: 5 },
    consultationGstPercent:  { type: Number, default: 0 },
    diagnosticsGstPercent:   { type: Number, default: 5 },
    careAssistantGstPercent: { type: Number, default: 18 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// REFUND POLICY
// ─────────────────────────────────────────────────────────────────────────────
const refundPolicySchema = new Schema(
  {
    rideFullRefundHoursThreshold: { type: Number, default: 24 },
    ridePartialRefundPercent:     { type: Number, default: 50 },
    refundProcessingDaysMin:      { type: Number, default: 5 },
    refundProcessingDaysMax:      { type: Number, default: 12 },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────
const platformPricingConfigSchema = new Schema(
  {
    configName: { type: String, default: 'global', unique: true },
    isActive:   { type: Boolean, default: true },

    caps:              { type: capsSchema,                     default: () => ({}) },
    transport:         { type: transportPricingSchema,         required: true },
    careAssistant:     { type: careAssistantPricingSchema,     required: true },
    doctor:            { type: doctorPricingSchema,            required: true },
    hospital:          { type: hospitalSchema,                 required: true },
    diagnostics:       { type: diagnosticsSchema,              required: true },
    pharmacy:          { type: pharmacySchema,                 required: true },
    customPlanOptions: { type: customPlanOptionPricingSchema,  required: true },

    ads:          { type: adsSchema,          default: () => ({}) },
    tax:          { type: taxSchema,          default: () => ({}) },
    refundPolicy: { type: refundPolicySchema, default: () => ({}) },

    lastUpdatedBy:     { type: Schema.Types.ObjectId, ref: 'User' },
    lastUpdatedByRole: { type: String, enum: ['admin', 'superadmin'] },

    versionHistory: { type: [versionHistorySchema], default: [] },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// PRE-SAVE: Validate care assistant pricing tiers (no gaps / overlaps)
// ─────────────────────────────────────────────────────────────────────────────
platformPricingConfigSchema.pre('save', function () {
  const tiers = this.careAssistant?.pricingTiers;
  if (tiers?.length) {
    const active = tiers.filter((t) => t.isActive);
    active.sort((a, b) => a.minHours - b.minHours);

    for (let i = 0; i < active.length - 1; i++) {
      const curr = active[i];
      const next = active[i + 1];
      if (curr.maxHours === null) {
        throw new Error(
          `Pricing tier "${curr.label}" has maxHours: null but is not the last active tier.`
        );
      }
      if (next.minHours !== curr.maxHours) {
        throw new Error(
          `Gap or overlap between care assistant pricing tiers ` +
          `"${curr.label}" (maxHours: ${curr.maxHours}) and ` +
          `"${next.label}" (minHours: ${next.minHours}).`
        );
      }
      if (curr.payoutToAssistant > curr.chargeToUser) {
        throw new Error(
          `Tier "${curr.label}": payoutToAssistant (${curr.payoutToAssistant}) ` +
          `cannot exceed chargeToUser (${curr.chargeToUser}).`
        );
      }
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PRE-SAVE: CAPS enforcement
  //
  // CHANGE 2: Block save if any discount slab percent exceeds cap value.
  //           Correct flow: raise cap first → then set higher slab percent.
  //           Guarded fields:
  //             caps.pharmacyDiscountMax    → customPlanOptions.pharmacyDiscount.slabs[].percent
  //             caps.diagnosticsDiscountMax → customPlanOptions.diagnosticsDiscount.slabs[].percent
  // ───────────────────────────────────────────────────────────────────────────
  const pharmacyCap    = this.caps?.pharmacyDiscountMax;
  const diagnosticsCap = this.caps?.diagnosticsDiscountMax;

  if (pharmacyCap != null) {
    const slabs = this.customPlanOptions?.pharmacyDiscount?.slabs ?? [];
    for (const slab of slabs) {
      if (slab.percent > pharmacyCap) {
        throw new Error(
          `Pharmacy discount slab ${slab.percent}% exceeds cap ${pharmacyCap}%. ` +
          `Raise caps.pharmacyDiscountMax first, then update the slab.`
        );
      }
    }
  }

  if (diagnosticsCap != null) {
    const slabs = this.customPlanOptions?.diagnosticsDiscount?.slabs ?? [];
    for (const slab of slabs) {
      if (slab.percent > diagnosticsCap) {
        throw new Error(
          `Diagnostics discount slab ${slab.percent}% exceeds cap ${diagnosticsCap}%. ` +
          `Raise caps.diagnosticsDiscountMax first, then update the slab.`
        );
      }
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────────────────────────────────────
// NEW — provide required platformFee defaults so create() doesn't fail validation
platformPricingConfigSchema.statics.getGlobal = async function () {
  let config = await this.findOne({ configName: 'global', isActive: true });
  if (!config) {
    const defaultFee = { type: 'percentage', value: 10 };
    config = await this.create({
      configName: 'global',
      transport: {
        platformFee: defaultFee,
      },
      careAssistant: {
        platformFee: defaultFee,
      },
      doctor: {
        platformFee: defaultFee,
      },
      hospital: {
        platformFee: defaultFee,
      },
      diagnostics: {
        platformFee: defaultFee,
        homeSamplePlatformFee: defaultFee,
      },
      pharmacy: {
        platformFee: defaultFee,
      },
      customPlanOptions: {
        consultation: { pricePerConsultation: 0 },
      },
    });
  }
  return config;
};

platformPricingConfigSchema.statics.resolveCareAssistantTier = function (config, durationHours) {
  const tiers = config?.careAssistant?.pricingTiers ?? [];
  return (
    tiers.find(
      (t) =>
        t.isActive &&
        durationHours >= t.minHours &&
        (t.maxHours === null || durationHours < t.maxHours)
    ) || null
  );
};

platformPricingConfigSchema.statics.resolveLabPlatformFee = function (config, lab) {
  if (lab?.platformFee?.type && lab.platformFee.value != null) {
    return lab.platformFee;
  }
  const overrides = config?.diagnostics?.labOverrides;
  const labId     = lab?._id?.toString();
  if (overrides && labId && overrides.has(labId)) {
    return overrides.get(labId);
  }
  return config?.diagnostics?.platformFee ?? null;
};

// Priority chain (matches the comment on Hospital.consultationPricing.platformFeeOverride):
//   1. Hospital.consultationPricing.platformFeeOverride  — hospital's own override
//   2. PlatformPricingConfig.hospital.hospitalOverrides[hospitalId] — admin-set per-hospital override
//   3. PlatformPricingConfig.hospital.platformFee — global default
// Doctor-level override sits above all of this and is applied by the caller
// (DoctorProfile.resolveEffectivePricing), not here.
platformPricingConfigSchema.statics.resolveHospitalPlatformFee = function (config, hospital) {
  const ownOverride = hospital?.consultationPricing?.platformFeeOverride;
  if (ownOverride?.type && ownOverride?.value != null) {
    return ownOverride;
  }

  const overrides  = config?.hospital?.hospitalOverrides;
  const hospitalId = hospital?._id?.toString();
  if (overrides && hospitalId && overrides.has(hospitalId)) {
    return overrides.get(hospitalId);
  }

  return config?.hospital?.platformFee ?? null;
};

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────
platformPricingConfigSchema.methods.saveWithAudit = async function ({
  adminUserId,
  adminRole,
  section      = null,
  note         = '',
  changeSource = 'manual',
} = {}) {
  if (!['admin', 'superadmin'].includes(adminRole)) {
    throw new Error('Unauthorized');
  }

  this.versionHistory.push({
    changedBy:     adminUserId,
    changedByRole: adminRole,
    section,
    changeSource,
    changeNote:    note,
    snapshot:      this.toObject(),
    changedAt:     new Date(),
  });

  this.lastUpdatedBy     = adminUserId;
  this.lastUpdatedByRole = adminRole;

  return this.save();
};

const PlatformPricingConfig = mongoose.model(
  'PlatformPricingConfig',
  platformPricingConfigSchema
);

export default PlatformPricingConfig;