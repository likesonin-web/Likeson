import mongoose from 'mongoose';
import softDeletePlugin from '../utils/softDeletePlugin.js';
import { DEPARTMENTS } from '../utils/supportConstants.js';

const { Schema } = mongoose;

const supportDepartmentSchema = new Schema(
  {
    name: { type: String, required: true, enum: DEPARTMENTS, unique: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    escalationChain: {
      // ordered list of levels this dept routes through; default full chain
      type: [String],
      default: ['L1', 'L2', 'Admin', 'SuperAdmin'],
    },
    headAgent: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    autoAssignEnabled: { type: Boolean, default: true },
    ticketCount: { type: Number, default: 0 }, // denormalized counter, updated on ticket create/close
  },
  { timestamps: true }
);

supportDepartmentSchema.plugin(softDeletePlugin);
supportDepartmentSchema.index({ name: 1, isActive: 1 });

export default mongoose.models.SupportDepartment ||
  mongoose.model('SupportDepartment', supportDepartmentSchema);