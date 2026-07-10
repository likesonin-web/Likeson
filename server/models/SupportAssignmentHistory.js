// models/SupportAssignmentHistory.js
//
// Append-only. "Never overwrite assignments" (spec) — every assignment or
// reassignment event creates a NEW document here. SupportTicket.currentAssignees
// is a denormalized read cache rebuilt from the latest entries in this
// collection; this collection is the source of truth.

import mongoose from 'mongoose';

const { Schema } = mongoose;

const assigneeEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true },
    department: { type: String, default: null },
  },
  { _id: false }
);

const supportAssignmentHistorySchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },

    action: {
      type: String,
      enum: ['assigned', 'reassigned', 'unassigned', 'transferred'],
      required: true,
    },

    assignees: { type: [assigneeEntrySchema], default: [] },

    // Previous assignee set, snapshotted for diff/audit readability —
    // never mutated after write.
    previousAssignees: { type: [assigneeEntrySchema], default: [] },

    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByRole: { type: String, required: true },

    note: { type: String, trim: true, maxlength: 1000, default: null },
  },
  { timestamps: true }
);

supportAssignmentHistorySchema.index({ ticket: 1, createdAt: -1 });
supportAssignmentHistorySchema.index({ 'assignees.userId': 1, createdAt: -1 });
supportAssignmentHistorySchema.index({ performedBy: 1, createdAt: -1 });

// Hard immutability guard — history rows are never edited or deleted.
supportAssignmentHistorySchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany', 'deleteOne', 'deleteMany'], function (next) {
  next(new Error('SupportAssignmentHistory records are immutable and cannot be modified or deleted.'));
});

const SupportAssignmentHistory = mongoose.model('SupportAssignmentHistory', supportAssignmentHistorySchema);
export default SupportAssignmentHistory;
