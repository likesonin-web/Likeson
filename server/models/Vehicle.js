import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Vehicle Model — Likeson.in
 *
 * Standalone collection. Replaces:
 *   - TransportPartner.vehicles[]      (embedded array)
 *   - SoloDriverPartner.vehicle        (embedded single doc)
 *
 * WHY this exists instead of embedding (top-company pattern):
 *   1. Cross-fleet geo queries — "nearest available vehicle within 5km"
 *      needs a single top-level 2dsphere index across ALL partners.
 *      An index on an embedded array field only helps queries already
 *      scoped to one parent doc; finding nearest vehicle platform-wide
 *      from an embedded array requires $unwind aggregation across every
 *      TransportPartner doc — doesn't scale.
 *   2. Document size — large fleets (50+ vehicles, each with photos[],
 *      doc URLs, location history) risk hitting the 16MB doc cap on
 *      TransportPartner.
 *   3. Independent write path — vehicle location pings happen far more
 *      often than partner profile writes. Embedding means every GPS
 *      ping re-writes part of a large parent doc and contends with
 *      partner-level writes (KYC updates, bank detail edits, etc).
 *   4. registrationNumber can now be a TRUE unique index platform-wide
 *      (was only sparse/non-unique on the embedded array before).
 *
 * Ownership — polymorphic ref (refPath pattern):
 *   ownerType: 'TransportPartner' | 'SoloDriverPartner'
 *   ownerId:   ObjectId → resolves against whichever collection ownerType names
 *
 * Vehicle ↔ Driver assignment is owned HERE (assignedDriver), not on Driver.
 * Driver.assignedVehicleId still exists for fast reverse lookup but is a
 * denormalized cache — this collection is the source of truth. Keep them
 * in sync via the service layer (assignDriverToVehicle / unassign), not
 * via independent writes from both sides.
 */

const vehicleSchema = new Schema(
  {
    // ── Ownership (polymorphic) ───────────────────────────────────────────
    ownerType: {
      type:     String,
      enum:     ['TransportPartner', 'SoloDriverPartner'],
      required: true,
      index:    true,
    },
    ownerId: {
      type:     Schema.Types.ObjectId,
      required: true,
      refPath:  'ownerType',
      index:    true,
    },

    vehicleCode: { type: String, uppercase: true, trim: true, unique: true, sparse: true },

    registrationNumber: {
      type:      String,
      required:  [true, 'Vehicle registration number is required'],
      uppercase: true,
      trim:      true,
      unique:    true, // platform-wide uniqueness — was only sparse/non-unique before
    },

    make:  { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year:  { type: Number },
    color: { type: String, trim: true },

    // Single shared enum — was duplicated+diverging between TransportPartner's
    // vehicleSchema (17 types) and SoloDriverPartner's soloVehicleSchema (8 types).
    vehicleType: {
      type:     String,
      required: true,
      enum: [
        'Bike', 'Scooter',
        'Auto', 'E-Rickshaw',
        'Hatchback', 'Sedan', 'SUV', 'MUV', 'Crossover',
        'Van', 'Minivan', 'Tempo-Traveller', 'Minibus',
        'Wheelchair-Van', 'Mortuary-Van',
        'Bus', 'Truck', 'Pickup',
      ],
    },

    seatingCapacity: { type: Number, default: 4, min: 1 },

    // ── Medical / Accessibility ───────────────────────────────────────────
    isWheelchairAccessible: { type: Boolean, default: false },
    hasStretcherSupport:    { type: Boolean, default: false },
    hasOxygenSupport:       { type: Boolean, default: false },
    hasMedicalKit:          { type: Boolean, default: false },
    hasAC:                  { type: Boolean, default: true  },

    // ── Documents ─────────────────────────────────────────────────────────
    rcBookUrl:           { type: String },
    insurancePolicyUrl:  { type: String },
    insuranceExpiry:     { type: Date },
    pollutionCertUrl:    { type: String },
    pollutionCertExpiry: { type: Date },
    fitnessCertUrl:      { type: String },
    fitnessCertExpiry:   { type: Date },
    permitType: {
      type: String,
      enum: ['Commercial', 'Tourist', 'Private', 'Contract Carriage'],
    },
    permitExpiry: { type: Date },

    photos: [{ type: String }],

    // ── GPS / Live Location (top-level — own write path, own index) ──────
    // No default coordinates: a vehicle with no GPS fix yet should not
    // resolve to a real place. A hardcoded real-world default here would
    // make every freshly-added, not-yet-pinged vehicle appear physically
    // located there for any nearby-vehicle query.
    gpsDeviceId: { type: String },
    location: {
      type:        { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] }, // [lng, lat]
    },
    locationUpdatedAt: { type: Date },
    heading:           { type: Number, min: 0, max: 360 },
    speedKmh:          { type: Number, min: 0 },

    // ── Assignment (source of truth — Driver.assignedVehicleId is a cache) ─
    assignedDriver: {
      type:    Schema.Types.ObjectId,
      ref:     'Driver',
      default: null,
      index:   true,
    },
    assignedAt: { type: Date },

    // ── Operational status (separate from document verification) ─────────
    status: {
      type:    String,
      enum:    ['active', 'inactive', 'maintenance', 'suspended'],
      default: 'inactive',
      index:   true,
    },

    // ── Verification ───────────────────────────────────────────────────────
    verificationStatus: {
      type:    String,
      enum:    ['pending', 'under-review', 'verified', 'rejected'],
      default: 'pending',
      index:   true,
    },
    verifiedAt:      { type: Date },
    verifiedBy:      { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },

    /**
     * Verification history — append-only audit trail.
     * The 3 source models only kept a single verifiedAt/verifiedBy snapshot,
     * overwritten each time. No record of prior rejections/resubmissions.
     */
    verificationHistory: [
      {
        status:    { type: String, enum: ['pending', 'under-review', 'verified', 'rejected'] },
        reason:    { type: String },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

vehicleSchema.index({ location: '2dsphere' }); // top-level — enables platform-wide nearest-vehicle queries
vehicleSchema.index({ ownerType: 1, ownerId: 1 });
vehicleSchema.index({ status: 1, verificationStatus: 1 });
vehicleSchema.index({ 'insuranceExpiry': 1 });
vehicleSchema.index({ 'pollutionCertExpiry': 1 });
vehicleSchema.index({ 'fitnessCertExpiry': 1 });
vehicleSchema.index({ 'permitExpiry': 1 });

// ── Virtuals ──────────────────────────────────────────────────────────────────

vehicleSchema.virtual('isDispatchReady').get(function () {
  return this.status === 'active' && this.verificationStatus === 'verified' && !!this.assignedDriver;
});

vehicleSchema.virtual('hasExpiringDocs').get(function () {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return (
    (this.insuranceExpiry     && this.insuranceExpiry     < soon) ||
    (this.pollutionCertExpiry && this.pollutionCertExpiry < soon) ||
    (this.fitnessCertExpiry   && this.fitnessCertExpiry   < soon) ||
    (this.permitExpiry        && this.permitExpiry        < soon)
  );
});

// ── Pre-save ──────────────────────────────────────────────────────────────────

vehicleSchema.pre('save', function () {
  if (!this.vehicleCode && this.registrationNumber) {
    this.vehicleCode = `VH-${this.registrationNumber}`;
  }

  // Append to verification history whenever status changes
  if (this.isModified('verificationStatus')) {
    this.verificationHistory.push({
      status:    this.verificationStatus,
      reason:    this.rejectionReason,
      changedBy: this.verifiedBy,
      changedAt: new Date(),
    });
  }
});

// ── Post-save: sync owner cache ────────────────────────────────────────────────
// TransportPartner still keeps a small read-optimized fleetInfo count cache
// (cheap to derive, doesn't drift meaningfully since it's just a count).
//
// SoloDriverPartner does NOT — its `vehicleStatus` embedded cache was
// removed (see SoloDriverPartner model notes): it went stale and duplicated
// this collection. The write below used to still push into that
// nonexistent `vehicleStatus` path on every vehicle save; with the field
// gone from the schema, Mongoose's default strict mode silently drops it,
// so it was a dead write doing nothing but wasting a query. Removed —
// SoloDriverPartner.vehicle (virtual populate) / getVehicle() read this
// collection live instead.

vehicleSchema.post('save', async function () {
  try {
    if (this.ownerType === 'TransportPartner') {
      const [totals] = await mongoose.model('Vehicle').aggregate([
        { $match: { ownerType: 'TransportPartner', ownerId: this.ownerId } },
        {
          $group: {
            _id:    null,
            total:  { $sum: 1 },
            active: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'active'] }, { $eq: ['$verificationStatus', 'verified'] }] }, 1, 0] } },
          },
        },
      ]);
      await mongoose.model('TransportPartner').findByIdAndUpdate(this.ownerId, {
        'fleetInfo.totalVehicles':  totals?.total  ?? 0,
        'fleetInfo.activeVehicles': totals?.active ?? 0,
      });
    }
  } catch (err) {
    console.error('[Vehicle.post-save] owner cache sync failed:', err.message);
  }
});

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Find nearest active, verified, available vehicles — across ALL owners,
 * or scoped to one owner (agency or solo).
 */
vehicleSchema.statics.findNearestAvailable = function (
  lng, lat, maxDistanceMeters = 10_000, { ownerType, ownerId, vehicleType } = {}
) {
  const filter = {
    status:              'active',
    verificationStatus:  'verified',
    assignedDriver:      { $ne: null },
    location: {
      $near: {
        $geometry:    { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistanceMeters,
      },
    },
  };
  if (ownerType)   filter.ownerType   = ownerType;
  if (ownerId)     filter.ownerId     = ownerId;
  if (vehicleType) filter.vehicleType = vehicleType;

  return this.find(filter).limit(10);
};

vehicleSchema.statics.findByOwner = function (ownerType, ownerId) {
  return this.find({ ownerType, ownerId }).sort({ createdAt: -1 });
};

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;