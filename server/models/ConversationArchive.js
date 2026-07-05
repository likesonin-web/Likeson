// models/ConversationArchive.js
//
// NOTE: per-member archive/mute/pin flags are ALSO available directly on
// ConversationMember (isArchived/isMuted/isPinned) for the fast common
// path. This collection exists for archives that need their own audit
// trail — e.g. "auto-archived by system after 30 days inactivity" —
// distinct from a simple boolean flip. Kept intentionally thin.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const conversationArchiveSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    archivedAt:   { type: Date, default: Date.now },
    reason:       { type: String, enum: ['manual', 'system_inactivity', 'complaint_closed'], default: 'manual' },
    unarchivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

conversationArchiveSchema.index({ conversation: 1, user: 1 }, { unique: true });

const ConversationArchive = mongoose.model('ConversationArchive', conversationArchiveSchema);
export default ConversationArchive;
