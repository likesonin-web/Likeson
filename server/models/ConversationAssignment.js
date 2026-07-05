// models/ConversationAssignment.js
//
// Full assignment/transfer history for a conversation (mainly complaints).
// The CURRENT assignee is also denormalized onto Conversation.complaint.assignedTo
// for fast dashboard queries; this collection is the audit trail of every
// assignment/transfer/unassignment event.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const conversationAssignmentSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    assignedTo:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedBy:   { type: Schema.Types.ObjectId, ref: 'User', required: true },

    previousAssignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reason:           { type: String, default: null }, // required for transfers, per AssignmentService

    isActive: { type: Boolean, default: true }, // false once reassigned/unassigned
    unassignedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationAssignmentSchema.index({ conversation: 1, isActive: 1 });
conversationAssignmentSchema.index({ assignedTo: 1, isActive: 1, createdAt: -1 }); // partner dashboard

const ConversationAssignment = mongoose.model('ConversationAssignment', conversationAssignmentSchema);
export default ConversationAssignment;
