import mongoose from 'mongoose';
import softDeletePlugin from '../utils/softDeletePlugin.js';
import { DEPARTMENTS } from '../utils/supportConstants.js';

const { Schema } = mongoose;

const supportAgentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    departments: { type: [String], enum: DEPARTMENTS, default: ['General'] },
    level: { type: String, enum: ['L1', 'L2', 'Medical', 'Finance', 'Admin', 'SuperAdmin'], default: 'L1' },
    isOnDuty: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    maxConcurrentTickets: { type: Number, default: 25, min: 1 },
    activeTicketCount: { type: Number, default: 0, min: 0 }, // denormalized, kept in sync on assign/close
    skills: { type: [String], default: [] }, // e.g. ['Refunds', 'KYC', 'Emergency']

    // Rolling performance metrics — updated by analyticsRoutes aggregation jobs (BullMQ)
    metrics: {
      totalResolved: { type: Number, default: 0 },
      avgResponseMins: { type: Number, default: 0 },
      avgResolutionMins: { type: Number, default: 0 },
      avgRating: { type: Number, default: 0, min: 0, max: 5 },
      slaBreaches: { type: Number, default: 0 },
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

supportAgentSchema.plugin(softDeletePlugin);
supportAgentSchema.index({ departments: 1, isOnDuty: 1, activeTicketCount: 1 });
supportAgentSchema.index({ level: 1 });

supportAgentSchema.virtual('hasCapacity').get(function () {
  return this.activeTicketCount < this.maxConcurrentTickets;
});
supportAgentSchema.set('toJSON', { virtuals: true });
supportAgentSchema.set('toObject', { virtuals: true });

export default mongoose.models.SupportAgent ||
  mongoose.model('SupportAgent', supportAgentSchema);