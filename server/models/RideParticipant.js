import mongoose from 'mongoose';
const { Schema } = mongoose;

// RideParticipant.js
const PARTICIPANT_ROLES = ['CARE_ASSISTANT', 'NURSE', 'TECHNICIAN', 'ESCORT', 'FAMILY', 'EQUIPMENT_HANDLER'];
const PARTICIPANT_STATUSES = ['PENDING', 'EN_ROUTE', 'AT_JOIN_POINT', 'IN_VEHICLE', 'AT_HOSPITAL', 'DEPARTED', 'REPLACED'];
const JOIN_MODES = ['IN_VEHICLE_BEFORE_PATIENT', 'IN_VEHICLE_AFTER_PATIENT', 'DIRECT_HOSPITAL', 'REPLACED', 'NOT_JOINED'];

const rideParticipantSchema = new Schema(
  {
    ride:    { type: Schema.Types.ObjectId, ref: 'Ride', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },

    role: { type: String, enum: PARTICIPANT_ROLES, required: true, index: true },
    // Spec: "Family member ... No tracking. No Join Point. No OTP. No
    // independent routing." isTrackable is derived, never hand-set — see
    // pre-validate below.

    // polymorphic — CareAssistantProfile today, anything tomorrow, zero schema change
    refModel: { type: String, enum: ['CareAssistantProfile', 'User', null], default: null },
    refId:    { type: Schema.Types.ObjectId, refPath: 'refModel', default: null },

    joinMode: { type: String, enum: JOIN_MODES, default: 'NOT_JOINED' },
    status:   { type: String, enum: PARTICIPANT_STATUSES, default: 'PENDING', index: true },

    joinedAt: Date,
    departedAt: Date,

    isReplacement: { type: Boolean, default: false },
    replacesParticipant: { type: Schema.Types.ObjectId, ref: 'RideParticipant', default: null },
    replacementReason: String,

    // immutable snapshot at assignment time — survives if the underlying profile changes later
    snapshot: { name: String, phone: String, photoUrl: String },

    isActive: { type: Boolean, default: true, index: true }, // false once replaced

    assignedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// RideParticipant.js pre-validate
rideParticipantSchema.pre('validate', function () {
  if (this.role === 'FAMILY' && this.joinMode && this.joinMode !== 'NOT_JOINED') {
    throw new Error('FAMILY participants cannot have a join mode — boards only at patient pickup');
  }
});
// FAMILY guard: no join mode, no join-point involvement, ever.
rideParticipantSchema.pre('validate', function () {
  if (this.role === 'FAMILY') {
    if (this.joinMode && this.joinMode !== 'NOT_JOINED') {
      throw new Error('FAMILY participants cannot have a joinMode — they board only at patient pickup, no independent routing');
    }
  }
});

rideParticipantSchema.virtual('isTrackable').get(function () {
  return this.role !== 'FAMILY';
});

rideParticipantSchema.index({ ride: 1, role: 1, isActive: 1 });
rideParticipantSchema.index({ booking: 1 });
rideParticipantSchema.index({ refId: 1, status: 1 });

export default mongoose.model('RideParticipant', rideParticipantSchema);