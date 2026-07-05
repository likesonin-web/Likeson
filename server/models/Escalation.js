import mongoose from 'mongoose';
import softDeletePlugin from '../utils/softDeletePlugin.js';
import { ESCALATION_LEVELS } from '../utils/supportConstants.js';

const { Schema } = mongoose;

const escalationSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    fromLevel: { type: String, enum: [...ESCALATION_LEVELS, null], default: null },
    toLevel: { type: String, enum: ESCALATION_LEVELS, required: true },
    reason: {
      type: String,
      enum: ['SLA_BREACH', 'MANUAL', 'CUSTOMER_REQUEST', 'SEVERITY_UPGRADE', 'AGENT_REQUEST'],
      required: true,
    },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null = automatic/system
    isAutomatic: { type: Boolean, default: false },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

escalationSchema.plugin(softDeletePlugin);
escalationSchema.index({ ticket: 1, createdAt: -1 });
escalationSchema.index({ toLevel: 1, resolvedAt: 1 });

export default mongoose.models.Escalation || mongoose.model('Escalation', escalationSchema);