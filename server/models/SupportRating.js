// models/SupportRating.js

import mongoose from 'mongoose';

const { Schema } = mongoose;

const supportRatingSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, unique: true, index: true },
    ratedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: '' },

    // Snapshot of who resolved it at rating time, for reporting without a
    // join back through assignment history.
    resolvedByAtRatingTime: {
      type: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, role: String }],
      default: [],
    },
  },
  { timestamps: true }
);

supportRatingSchema.index({ rating: 1, createdAt: -1 });
supportRatingSchema.index({ 'resolvedByAtRatingTime.userId': 1, rating: 1 });

const SupportRating = mongoose.model('SupportRating', supportRatingSchema);
export default SupportRating;
