import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * BookingStatusEvent — append-only, uncapped, permanent event log.
 * Booking.statusLog stays as a bounded "recent activity" UI cache (last 20);
 * THIS collection is the actual source of truth for "every important
 * business event must be traceable" / "historical data must never be lost."
 * Never updated, never deleted.
 */
const bookingStatusEventSchema = new Schema(
  {
    booking:    { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    fromStatus: { type: String, default: null },
    toStatus:   { type: String, required: true },
    changedBy:  { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reason:     { type: String, default: null },
    changedAt:  { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

bookingStatusEventSchema.index({ booking: 1, changedAt: 1 });

export default mongoose.model('BookingStatusEvent', bookingStatusEventSchema);