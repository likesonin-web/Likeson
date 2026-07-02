import mongoose from 'mongoose';
const { Schema } = mongoose;

// ── Sub-Schemas ───────────────────────────────────────────────────────────────

const qualificationSchema = new Schema(
  {
    degree:  { type: String, trim: true },
    college: { type: String, trim: true },
    year:    { type: Number },
  },
  { _id: false }
);

const slotSchema = new Schema(
  {
    startTime: { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'startTime must be HH:MM (24-hour)'] },
    endTime:   { type: String, required: true, match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'endTime must be HH:MM (24-hour)'] },
    maxPatients: { type: Number, default: 10, min: [1, 'maxPatients must be at least 1'] },
    consultationType: { type: String, enum: ['inPerson', 'video', 'homeVisit', 'any'], default: 'any' },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const weeklyAvailabilitySchema = new Schema(
  {
    day: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    isAvailable: { type: Boolean, default: true },
    slots: { type: [slotSchema], default: [] },
  },
  { _id: true }
);

const kycSchema = new Schema(
  {
    aadhaarNumber:   { type: String, trim: true, select: false },
    aadhaarFrontUrl: { type: String },
    aadhaarBackUrl:  { type: String },
    aadhaarVerified: { type: Boolean, default: false },
    panNumber:   { type: String, uppercase: true, trim: true, select: false },
    panCardUrl:  { type: String },
    panVerified: { type: Boolean, default: false },
  },
  { _id: false }
);

const ratingSummarySchema = new Schema(
  {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalRatings:  { type: Number, default: 0 },
    totalReviews:  { type: Number, default: 0 },
  },
  { _id: false }
);

const bankDetailsSchema = new Schema(
  {
    accountHolderName:  { type: String, trim: true },
    accountNumber:      { type: String, trim: true, select: false },
    accountLast4:       { type: String, maxlength: 4 },
    ifscCode: { type: String, uppercase: true, trim: true, match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'] },
    bankName:           { type: String, trim: true },
    branchName:         { type: String, trim: true },
    upiId:              { type: String, trim: true },
    gstNumber:          { type: String, trim: true },
    isBankVerified:     { type: Boolean, default: false },
    verifiedAt:         { type: Date },
    cancelledChequeUrl: { type: String },
  },
  { _id: false }
);

const platformFeeSchema = new Schema(
  {
    type: { type: String, enum: ['fixed', 'percentage'], required: true },
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

/**
 * doctorFeesSchema
 * -----------------
 * Only authoritative when the doctor's PRIMARY hospital has
 * managementModel === 'doctor-owner'. When managementModel is
 * 'hospital-manager', these fields are stored (a doctor may float between
 * a doctor-owner clinic and a hospital-manager hospital in otherHospitals)
 * but MUST be ignored by the pricing engine in favor of
 * Hospital.consultationPricing. See resolveEffectivePricing below —
 * that is the one and only place this rule is enforced.
 */
const doctorFeesSchema = new Schema(
  {
    consultationFee:         { type: Number, default: 600, min: 0 }, // fallback when a per-type fee is unset
    consultationHonorarium:  { type: Number, default: 600, min: 0 },

    // Per-type fee overrides (optional — falls back to consultationFee if unset)
    inPersonFee:   { type: Number, default: null, min: 0 },
    videoFee:      { type: Number, default: null, min: 0 },
    homeVisitFee:  { type: Number, default: null, min: 0 },

    inPersonHonorarium:  { type: Number, default: null, min: 0 },
    videoHonorarium:     { type: Number, default: null, min: 0 },
    homeVisitHonorarium: { type: Number, default: null, min: 0 },

    followUpFee:             { type: Number, default: 0,  min: 0  },
    followUpDiscountPercent: { type: Number, default: 20, min: 0, max: 100 },
    followUpValidDays: { type: Number, default: 7, min: [1, 'Min 1'], max: [90, 'Max 90'] },

    // Effective dating + versioning — mirrors Hospital.consultationPricing
    // so both pricing sources support Problem 9 / Problem 3 symmetrically.
    effectiveFrom:  { type: Date, default: Date.now },
    effectiveUntil: { type: Date, default: null },
    pricingVersion: { type: Number, default: 1, min: 1 },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const doctorProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },

    specialization: {
      type: String, required: true,
      enum: [
        'General Physician', 'Cardiologist', 'Neurologist', 'Pediatrician',
        'Oncologist', 'Orthopedic Surgeon', 'Gastroenterologist', 'Gynecologist',
        'Dermatologist', 'Urologist', 'Psychiatry', 'Physiotherapist',
      ],
    },
    qualifications: { type: [qualificationSchema], default: [] },
    experienceYears: { type: Number, required: true, min: 0, max: 70 },
    registrationNumber: { type: String, unique: true, sparse: true, trim: true },
    registrationCouncil: { type: String, trim: true },
    doctorSignature: { type: String },

    kyc: { type: kycSchema, default: () => ({}) },
    kycStatus: { type: String, enum: ['not-submitted', 'pending', 'under-review', 'verified', 'rejected'], default: 'not-submitted', index: true },
    kycVerifiedAt: { type: Date },
    kycVerifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    kycRejectionReason: { type: String },

    primaryHospital: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null },
    otherHospitals:  [{ type: Schema.Types.ObjectId, ref: 'Hospital' }],
    managedHospitals: [{ type: Schema.Types.ObjectId, ref: 'Hospital' }],

    consultationTypes: {
      inPerson:  { type: Boolean, default: true  },
      video:     { type: Boolean, default: false },
      homeVisit: { type: Boolean, default: false },
    },

    fees: { type: doctorFeesSchema, default: () => ({}) },
    // Doctor-level platform fee override — top of the priority chain
    // (Problem 5): Doctor override → Hospital override → Global config → Default.
    platformFee: { type: platformFeeSchema, default: null },

    partnershipStatus: { type: String, enum: ['Pending', 'Active', 'Inactive', 'Suspended'], default: 'Pending', index: true },
    partnerSince: { type: Date },
    contractUrl:  { type: String },

    settlementCycle: { type: String, enum: ['weekly', 'biweekly', 'monthly'], default: 'monthly' },
    bankDetails: { type: bankDetailsSchema, default: () => ({}) },
    razorpayContactId: { type: String, select: false },
    razorpayFundAccountId: { type: String, select: false },

    contactPerson: {
      name: { type: String, trim: true },
      designation: { type: String, trim: true },
      phone: { type: String },
      email: { type: String, lowercase: true, trim: true },
    },

    earnings: {
      pendingPayout: { type: Number, default: 0, min: 0 },
      totalPaid: { type: Number, default: 0, min: 0 },
      lifetimeEarnings: { type: Number, default: 0, min: 0 },
      lastPayoutAt: { type: Date }
    },

    weeklyAvailability: { type: [weeklyAvailabilitySchema], default: [] },
    biography: { type: String, maxlength: [1000, 'Biography cannot exceed 1000 characters'] },
    languagesSpoken: [{ type: String, trim: true }],
    achievements: [{ type: String, trim: true }],
    profilePhotoUrl: { type: String },

    stats: {
      totalConsultations: { type: Number, default: 0 },
      totalHomeVisits: { type: Number, default: 0 },
      totalVideoConsultations: { type: Number, default: 0 },
      lastConsultationAt: { type: Date },
      totalReferrals: { type: Number, default: 0 },
      monthlyReferrals: { type: Number, default: 0 },
      lastReferralAt: { type: Date },
      totalEarnings: { type: Number, default: 0 },
      totalCommissionEarned: { type: Number, default: 0 },
      pendingSettlement: { type: Number, default: 0 },
      totalSettled: { type: Number, default: 0 },
      lastSettledAt: { type: Date },
    },

    rating: { type: ratingSummarySchema, default: () => ({}) },
    isVerified: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true },
    isOnline: { type: Boolean, default: false },

    onboarding: { step: { type: Number, default: 1 }, isComplete: { type: Boolean, default: false }, completedAt: { type: Date }, agreedToTermsAt: { type: Date } },
    profileCompletionPercent: { type: Number, default: 0, min: 0, max: 100 },

    notifPrefs: { sms: { type: Boolean, default: true }, email: { type: Boolean, default: true }, push: { type: Boolean, default: true }, whatsapp: { type: Boolean, default: true } },

    adminNotes: { type: String, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

doctorProfileSchema.virtual('isKycComplete').get(function () { return this.kycStatus === 'verified'; });
doctorProfileSchema.virtual('isPartnerActive').get(function () { return this.partnershipStatus === 'Active' && this.isActive && this.isVerified; });
doctorProfileSchema.virtual('hasCustomPlatformFee').get(function () { return this.platformFee !== null && this.platformFee !== undefined; });
doctorProfileSchema.virtual('ownedHospitals', { ref: 'Hospital', localField: 'user', foreignField: 'managedBy', justOne: false, match: { managementModel: 'doctor-owner' } });
doctorProfileSchema.virtual('isProfileComplete').get(function () { return !!this.primaryHospital && this.isVerified; });

// ── Pre-validate Middleware ───────────────────────────────────────────────────

doctorProfileSchema.pre('validate', function () {
  if (this.isModified('weeklyAvailability') && this.weeklyAvailability?.length) {
    const days = this.weeklyAvailability.map(d => d.day);
    if (new Set(days).size !== days.length) throw new Error('weeklyAvailability contains duplicate day entries');

    for (const dayEntry of this.weeklyAvailability) {
      if (!dayEntry.isAvailable) continue;

      for (const slot of dayEntry.slots) {
        if (!slot.isActive || !slot.startTime || !slot.endTime) continue;
        const [sh, sm] = slot.startTime.split(':').map(Number);
        const [eh, em] = slot.endTime.split(':').map(Number);
        if (sh * 60 + sm >= eh * 60 + em) {
          throw new Error(`Slot on ${dayEntry.day}: startTime (${slot.startTime}) must be before endTime (${slot.endTime})`);
        }
      }

      const activeSlots = dayEntry.slots.filter(s => s.isActive).map(s => {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        return { start: sh * 60 + sm, end: eh * 60 + em, label: `${s.startTime}–${s.endTime}` };
      }).sort((a, b) => a.start - b.start);

      for (let i = 0; i < activeSlots.length - 1; i++) {
        if (activeSlots[i].end > activeSlots[i + 1].start) {
          throw new Error(`Slot overlap on ${dayEntry.day}: ${activeSlots[i].label} overlaps with ${activeSlots[i + 1].label}`);
        }
      }
    }
  }

  if (this.isModified('fees') && this.fees) {
    if (this.fees.consultationHonorarium > this.fees.consultationFee) {
      throw new Error('consultationHonorarium cannot exceed consultationFee');
    }

    // Per-type: honorarium must not exceed fee
    const types = ['inPerson', 'video', 'homeVisit'];
    for (const t of types) {
      const fee = this.fees[`${t}Fee`];
      const hon = this.fees[`${t}Honorarium`];
      if (fee != null && hon != null && hon > fee) {
        throw new Error(`${t}Honorarium cannot exceed ${t}Fee`);
      }
    }

    if (this.fees.followUpValidDays < 1 || this.fees.followUpValidDays > 90) throw new Error('followUpValidDays must be between 1 and 90');
    if (this.fees.followUpDiscountPercent < 0 || this.fees.followUpDiscountPercent > 100) throw new Error('followUpDiscountPercent must be between 0 and 100');
    if (this.fees.effectiveUntil && this.fees.effectiveFrom && this.fees.effectiveUntil <= this.fees.effectiveFrom) {
      throw new Error('fees.effectiveUntil must be after fees.effectiveFrom');
    }
  }
});

// ── Pre-save Middleware ───────────────────────────────────────────────────────

doctorProfileSchema.pre('save', function () {
  if (this.isModified('kycStatus')) this.isVerified = this.kycStatus === 'verified';
  if (this.isModified('bankDetails.accountNumber') && this.bankDetails?.accountNumber) {
    this.bankDetails.accountLast4 = this.bankDetails.accountNumber.slice(-4);
  }

  if (this.isModified()) {
    const hasAvailability = this.weeklyAvailability?.some(d => d.isAvailable && d.slots?.length > 0);
    const checks = [
      this.specialization,
      this.registrationNumber,
      this.experienceYears,
      this.qualifications?.length > 0,
      this.primaryHospital,
      this.kyc?.aadhaarVerified,
      this.kyc?.panVerified,
      hasAvailability,
      this.fees?.consultationFee > 0,
      this.profilePhotoUrl,
      this.bankDetails?.isBankVerified,
      this.partnershipStatus === 'Active',
    ];
    this.profileCompletionPercent = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }
});

// ── Static Helpers ────────────────────────────────────────────────────────────

/**
 * resolveEffectivePricing
 * ------------------------
 * THE FIX (Problem 2): this used to unconditionally return doctor pricing,
 * never checking who actually owns pricing for this doctor's hospital.
 * It now walks the required flow:
 *
 *   Booking → Doctor → Hospital → managementModel
 *     'doctor-owner'     → Doctor.fees is the pricing source
 *     'hospital-manager' → Hospital.consultationPricing is the pricing source
 *
 * This function is a resolver, not the full engine — for a real system,
 * PricingEngine.resolve() should be the only caller of this (and of the
 * equivalent Hospital-side resolver), and it alone is responsible for
 * applying discounts/tax/GST/settlement math and freezing the immutable
 * pricingSnapshot on the Booking. Kept here as a static so DoctorProfile
 * remains a valid, correct pricing SOURCE even before the full engine
 * lands — it must never again silently ignore the hospital.
 *
 * @param {ObjectId|string} doctorProfileId
 * @param {string} consultationType - 'inPerson' | 'video' | 'homeVisit'
 * @param {boolean} isFollowUp
 * @param {number} followUpFeeOverride
 * @param {ClientSession|null} session - mongoose session for transactional reads
 * @returns {Promise<{
 *   source: 'doctor'|'hospital',
 *   pricingOwnerId: ObjectId,
 *   pricingVersion: number,
 *   fees: object,
 *   calculated: { baseFee: number, doctorShare: number, grossHospitalShare: number },
 *   platformFee: { type: string, value: number } | null,
 *   platformFeeSource: 'doctor-override'|'hospital-override'|'global-config'|'unset',
 *   note: string,
 * }>}
 */
doctorProfileSchema.statics.resolveEffectivePricing = async function (
  doctorProfileId,
  consultationType = 'inPerson',
  isFollowUp = false,
  followUpFeeOverride = 0,
  session = null
) {
  const Hospital = mongoose.model('Hospital');

  let doctorQuery = this.findById(doctorProfileId)
    .select('fees platformFee consultationTypes primaryHospital')
    .lean();
  if (session) doctorQuery = doctorQuery.session(session);
  const doctor = await doctorQuery;
  if (!doctor) throw new Error('DoctorProfile not found');
  if (!doctor.primaryHospital) {
    throw new Error(`DoctorProfile ${doctorProfileId} has no primaryHospital — cannot resolve pricing source`);
  }

  let hospitalQuery = Hospital.findById(doctor.primaryHospital)
    .select('managementModel consultationPricing hospitalType')
    .lean();
  if (session) hospitalQuery = hospitalQuery.session(session);
  const hospital = await hospitalQuery;
  if (!hospital) throw new Error(`Primary hospital ${doctor.primaryHospital} not found for doctor ${doctorProfileId}`);
  if (!hospital.managementModel) {
    throw new Error(`Hospital ${hospital._id} has no managementModel set — cannot resolve pricing source`);
  }

  const feeKey = `${consultationType}Fee`;        // e.g. inPersonFee
  const honKey = `${consultationType}Honorarium`; // e.g. inPersonHonorarium

  const isHospitalManaged = hospital.managementModel === 'hospital-manager';
  const pricingSource = isHospitalManaged ? hospital.consultationPricing : doctor.fees;
  const source = isHospitalManaged ? 'hospital' : 'doctor';
  const pricingOwnerId = isHospitalManaged ? hospital._id : doctor._id;

  if (!pricingSource) {
    throw new Error(`No consultationPricing/fees configured for ${source} (owner ${pricingOwnerId})`);
  }

  let baseFee = pricingSource[feeKey] ?? pricingSource.consultationFee ?? 600;
  let doctorShare = pricingSource[honKey] ?? pricingSource.consultationHonorarium ?? baseFee;
  let grossHospitalShare = 0;

  if (isFollowUp) {
    baseFee = followUpFeeOverride || pricingSource.followUpFee || 0;
    const stdFee = pricingSource[feeKey] ?? pricingSource.consultationFee ?? 1;
    const stdHon = pricingSource[honKey] ?? pricingSource.consultationHonorarium ?? 0;
    doctorShare = Math.round(baseFee * (stdHon / stdFee));
    grossHospitalShare = Math.max(0, baseFee - doctorShare);
  } else {
    grossHospitalShare = Math.max(0, baseFee - doctorShare);
  }

  // ── Platform fee priority chain (Problem 5) ──────────────────────────────
  // Doctor override → Hospital override → (global config resolved by caller,
  // since DoctorProfile has no business reaching into PlatformPricingConfig)
  let platformFee = null;
  let platformFeeSource = 'unset';
  if (doctor.platformFee?.value != null) {
    platformFee = doctor.platformFee;
    platformFeeSource = 'doctor-override';
  } else if (isHospitalManaged && hospital.consultationPricing?.platformFeeOverride?.value != null) {
    platformFee = hospital.consultationPricing.platformFeeOverride;
    platformFeeSource = 'hospital-override';
  }
  // If still null, caller (PricingEngine) must fall back to
  // PlatformPricingConfig.getGlobal() → hospital/doctor default fee.

  return {
    source,
    pricingOwnerId,
    pricingVersion: pricingSource.pricingVersion ?? 1,
    fees: pricingSource,
    calculated: { baseFee, doctorShare, grossHospitalShare },
    platformFee,
    platformFeeSource,
    note: isHospitalManaged
      ? 'Hospital manages consultation pricing; doctor.fees ignored per managementModel.'
      : 'Doctor owns consultation pricing (doctor-owner hospital type).',
  };
};

// ── Indexes ───────────────────────────────────────────────────────────────────

doctorProfileSchema.index({ specialization: 1 });
doctorProfileSchema.index({ primaryHospital: 1 });
doctorProfileSchema.index({ otherHospitals: 1 });
doctorProfileSchema.index({ partnershipStatus: 1, isActive: 1 });
doctorProfileSchema.index({ 'rating.averageRating': -1 });
doctorProfileSchema.index({ createdAt: -1 });

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);
export default DoctorProfile;