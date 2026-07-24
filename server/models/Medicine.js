/**
 * Medicine.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Global product catalogue. Immutable medical metadata only.
 * NO stock, NO price, NO batch, NO store data.
 * Inventory lives in MedicineInventory collection.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const saltCompositionSchema = new Schema(
  {
    ingredient: { type: String, required: true, trim: true },
    strength:   { type: String, required: true, trim: true }, // "500mg", "10mg/5ml"
    unit:       { type: String, trim: true },                  // "mg", "mcg", "IU"
  },
  { _id: false }
);

const storageConditionsSchema = new Schema(
  {
    temperature: {
      min:   { type: Number },
      max:   { type: Number },
      label: { type: String, trim: true }, // "Store below 25°C", "Refrigerate (2–8°C)"
    },
    lightSensitive:    { type: Boolean, default: false },
    moistureSensitive: { type: Boolean, default: false },
    requiresColdChain: { type: Boolean, default: false },
  },
  { _id: false }
);

const regulatoryInfoSchema = new Schema(
  {
    cdscoDrugLicenceNo: { type: String, trim: true },
    stateLicenceNo:     { type: String, trim: true },
    importLicenceNo:    { type: String, trim: true },
    fdaApprovalNo:      { type: String, trim: true },
  },
  { _id: false }
);

const medicineImageSchema = new Schema(
  {
    url:       { type: String, required: true },
    altText:   { type: String, trim: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: true }
);

// ── Main Schema ───────────────────────────────────────────────────────────────

const medicineSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
    brandName: {
      type:     String,
      required: true,
      trim:     true,
    },
    genericName: {
      type:     String,
      required: true,
      trim:     true,
    },
    slug: {
      type:      String,
      unique:    true,
      lowercase: true,
      trim:      true,
    },
    description: { type: String, trim: true },

    // ── Classification ────────────────────────────────────────────────────────
    category: {
      type:     String,
      required: true,
      enum: [
        'Tablet', 'Capsule', 'Syrup', 'Suspension', 'Solution',
        'Injection', 'Infusion', 'Ointment', 'Cream', 'Gel',
        'Lotion', 'Drops', 'Inhaler', 'Nasal Spray', 'Patch',
        'Suppository', 'Powder', 'Granules', 'Lozenge', 'Implant', 'Others',
      ],
    },
    drugForm:             { type: String, trim: true },  // Dispersible Tablet, Chewable, etc.
    therapeuticClass:     { type: String, trim: true },  // Antibiotics, NSAIDs
    pharmacologicalClass: { type: String, trim: true },  // Beta-lactam, PPI
    atcCode:              { type: String, trim: true },  // WHO ATC classification

    // ── Dosage & Route ────────────────────────────────────────────────────────
    dosage: {
      type:     String,
      required: true,
      trim:     true, // "500mg", "5mg/ml"
    },
    routeOfAdministration: {
      type: String,
      enum: [
        'Oral', 'Intravenous', 'Intramuscular', 'Subcutaneous', 'Topical',
        'Inhalation', 'Rectal', 'Vaginal', 'Ophthalmic', 'Otic',
        'Nasal', 'Sublingual', 'Transdermal', 'Others',
      ],
    },

    // ── Clinical Information ──────────────────────────────────────────────────
    indications:       [String],
    contraindications: [String],
    sideEffects:       [String],
    interactions:      [String], // Drug-drug / drug-food
    warnings:          [String], // Black-box / special warnings
    saltComposition:   [saltCompositionSchema],

    // ── Regulatory & Safety ───────────────────────────────────────────────────
    isPrescriptionRequired: { type: Boolean, default: true },

    /**
     * India Drugs & Cosmetics Act Schedules:
     *  H   – Prescription-only
     *  H1  – Prescription + special recording
     *  X   – Narcotic / psychotropic
     *  G   – Caution label required
     *  J   – No advertising to public
     *  C   – Biological, refrigeration required
     *  C1  – Biological, stricter conditions
     *  None – OTC
     */
    schedule: {
      type:    String,
      enum:    ['H', 'H1', 'X', 'G', 'J', 'C', 'C1', 'None'],
      default: 'None',
    },
    narcoticLicenceRequired: { type: Boolean, default: false },

    // ── Packaging (catalogue info, NOT pricing) ───────────────────────────────
    packaging: {
      type:     String,
      required: true,
      trim:     true, // "Strip of 10 Tablets", "Bottle of 200ml"
    },
    packSize: { type: Number },         // numeric pack size
    packUnit: { type: String, trim: true }, // "Tablets", "ml", "g"

    // ── HSN / GST (catalogue-level snapshot) ─────────────────────────────────
    hsnCode: {
      type: Schema.Types.ObjectId,
      ref:  'HsnCode',
    },
    gstPercentage: {
      type:    Number,
      enum:    [0, 5, 12, 18, 28],
      default: 5,
    },
    cgstPercentage: { type: Number },
    sgstPercentage: { type: Number },
    igstPercentage: { type: Number },

    // ── Reference MRP (suggested — actual MRP lives in MedicineInventory) ─────
    // Kept for catalogue display / price comparison only.
    referenceMrp: {
      type:    Number,
      min:     0,
      comment: 'Suggested MRP from manufacturer. Actual selling MRP is in MedicineInventory.',
    },
    ptr: { type: Number, min: 0 }, // Price to Retailer (catalogue reference)
    pts: { type: Number, min: 0 }, // Price to Stockist

    // ── Storage ───────────────────────────────────────────────────────────────
    storageConditions: { type: storageConditionsSchema, default: () => ({}) },

    // ── Regulatory IDs ────────────────────────────────────────────────────────
    regulatoryInfo: { type: regulatoryInfoSchema, default: () => ({}) },

    // ── Manufacturer ─────────────────────────────────────────────────────────
    manufacturer:        { type: String, required: true, trim: true },
    manufacturerAddress: { type: String, trim: true },
    countryOfOrigin:     { type: String, trim: true, default: 'India' },

    // ── Media ─────────────────────────────────────────────────────────────────
    images:         [medicineImageSchema],
    searchKeywords: [String],

    // ── Status / Approval ─────────────────────────────────────────────────────
    isDiscontinued:    { type: Boolean, default: false },
    discontinuedReason:{ type: String, trim: true },
    isApproved:        { type: Boolean, default: false },
    approvedBy:        { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt:        { type: Date },

    // ── Soft Delete ───────────────────────────────────────────────────────────
    isDeleted:  { type: Boolean, default: false, index: true },
    deletedAt:  { type: Date },
    deletedBy:  { type: Schema.Types.ObjectId, ref: 'User' },

    // ── Audit ─────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Pre-save hooks ────────────────────────────────────────────────────────────

medicineSchema.pre('save', async function () {
  // Sync GST breakdown
  if (this.isModified('gstPercentage')) {
    const half = this.gstPercentage / 2;
    this.cgstPercentage = half;
    this.sgstPercentage = half;
    this.igstPercentage = this.gstPercentage;
  }

  // Auto-generate slug
  if (!this.slug && this.name) {
    const base = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.slug = `${base}-${Date.now()}`;
  }
});

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Search catalogue by keyword. Returns active, approved, non-deleted medicines.
 * Used in step-1 of medicine search flow (no inventory data here).
 */
medicineSchema.statics.searchCatalogue = function (keyword, limit = 20, skip = 0) {
  return this.find(
    {
      $text:         { $search: keyword },
      isApproved:    true,
      isDiscontinued:false,
      isDeleted:     false,
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } })
    .skip(skip)
    .limit(limit)
    .lean();
};

// ── Indexes ───────────────────────────────────────────────────────────────────

// Text search — primary medicine discovery
medicineSchema.index(
  { name: 'text', brandName: 'text', genericName: 'text', searchKeywords: 'text' },
  { weights: { name: 10, brandName: 8, genericName: 6, searchKeywords: 4 } }
);

medicineSchema.index({ hsnCode: 1 });
medicineSchema.index({ isDiscontinued: 1, isApproved: 1, isDeleted: 1 });
medicineSchema.index({ category: 1, isApproved: 1 });
medicineSchema.index({ therapeuticClass: 1 });
medicineSchema.index({ manufacturer: 1 });
medicineSchema.index({ slug: 1 });
medicineSchema.index({ createdAt: -1 });

// Medicine.js (Replace the Indexes section at the bottom of your file)

// ── Indexes ───────────────────────────────────────────────────────────────────

// COMPREHENSIVE TEXT SEARCH INDEX
// This powers the global search across all critical medical properties
medicineSchema.index(
  { 
    name: 'text', 
    brandName: 'text', 
    genericName: 'text', 
    'saltComposition.ingredient': 'text', // Targets nested salt arrays
    category: 'text', 
    drugForm: 'text', 
    manufacturer: 'text',
    searchKeywords: 'text' 
  },
  { 
    weights: { 
      brandName: 10, 
      name: 10, 
      genericName: 8, 
      'saltComposition.ingredient': 8, // High priority for salt searches
      searchKeywords: 6,
      category: 4,
      drugForm: 4,
      manufacturer: 3
    },
    name: "Medicine_Comprehensive_TextSearch"
  }
);

medicineSchema.index({ hsnCode: 1 });
medicineSchema.index({ isDiscontinued: 1, isApproved: 1, isDeleted: 1 });
medicineSchema.index({ category: 1, isApproved: 1 });
medicineSchema.index({ therapeuticClass: 1 });
medicineSchema.index({ manufacturer: 1 });
medicineSchema.index({ slug: 1 });
medicineSchema.index({ createdAt: -1 });

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Search catalogue by keyword. Returns active, approved, non-deleted medicines.
 */
medicineSchema.statics.searchCatalogue = function (keyword, limit = 50, skip = 0) {
  return this.find(
    {
      $text: { $search: keyword },
      isApproved: true,
      isDiscontinued: false,
      isDeleted: false,
    },
    { score: { $meta: 'textScore' } }
  )
    .sort({ score: { $meta: 'textScore' } }) // Sorts by best match relevance
    .skip(skip)
    .limit(limit)
    .lean();
};
 

// ── Export ────────────────────────────────────────────────────────────────────

const Medicine = mongoose.model('Medicine', medicineSchema);
export default Medicine;