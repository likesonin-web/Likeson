// models/ConversationMute.js
// Audit trail for mute events with an explicit expiry, distinct from the
// fast-path boolean on ConversationMember used for the actual notification check.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const conversationMuteSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    mutedAt:      { type: Date, default: Date.now },
    mutedUntil:   { type: Date, default: null }, // null = indefinite
    mutedBy:      { type: Schema.Types.ObjectId, ref: 'User', required: true }, // self, or admin muting a member
  },
  { timestamps: true }
);

conversationMuteSchema.index({ conversation: 1, user: 1 });
conversationMuteSchema.index({ mutedUntil: 1 }); // for scheduled un-mute sweep

const ConversationMute = mongoose.model('ConversationMute', conversationMuteSchema);
export default ConversationMute;
