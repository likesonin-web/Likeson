// models/AuditLog.js
// Immutable, append-only record of every sensitive action in the module.
// Never updated or deleted after write.

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const AUDIT_ACTIONS = [
  'conversation_created', 'conversation_deleted', 'conversation_archived',
  'conversation_assigned', 'conversation_transferred',
  'message_sent', 'message_edited', 'message_deleted',
  'reaction_added', 'reaction_removed',
  'complaint_created', 'complaint_assigned', 'complaint_status_changed', 'complaint_closed',
  'group_created', 'group_deleted', 'group_renamed', 'group_locked', 'group_unlocked',
  'member_added', 'member_removed', 'member_muted', 'moderator_assigned',
  'admin_action',
];

const auditLogSchema = new Schema(
  {
    action:       { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    actor:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    enum: ['Conversation', 'Message', 'User', 'Attachment', 'SupportTicket', 'SupportMessage', 'SupportAttachment'],
    targetId:     { type: Schema.Types.ObjectId, default: null },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null, index: true },
    metadata:     { type: Schema.Types.Mixed, default: {} },
    ipAddress:    { type: String, default: null },
  },
  { timestamps: true }
);

auditLogSchema.index({ conversation: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

// Guard against accidental mutation of audit history.
auditLogSchema.pre(['updateOne', 'findOneAndUpdate', 'updateMany'], function (next) {
  next(new Error('AuditLog records are immutable and cannot be updated.'));
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
