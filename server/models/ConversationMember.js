// models/ConversationMember.js
//
// Membership join table. Kept separate from Conversation (never an embedded
// array) so group membership scales to thousands of members without
// growing the parent document, and so per-member state (unread count,
// muted, role) can be updated atomically without touching the conversation.

import mongoose from 'mongoose';
import { CONVERSATION_MEMBER_ROLES } from '../constants/conversationConstants.js';

const { Schema } = mongoose;

const conversationMemberSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    role: { type: String, enum: CONVERSATION_MEMBER_ROLES, default: 'member' },

    // Denormalized per-member counter — avoids a MessageRead aggregation on
    // every conversation-list render.
    unreadCount: { type: Number, default: 0, min: 0 },
    lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    lastReadAt: { type: Date, default: null },

    isMuted: { type: Boolean, default: false },
    mutedUntil: { type: Date, default: null }, // null + isMuted=true => muted indefinitely

    isPinned: { type: Boolean, default: false },  // conversation pinned in THIS member's list
    isArchived: { type: Boolean, default: false }, // conversation archived in THIS member's list

    labels: { type: [Schema.Types.ObjectId], ref: 'ConversationLabel', default: [] },

    joinedAt: { type: Date, default: Date.now },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    leftAt: { type: Date, default: null },      // set when member leaves/removed — kept for history
    removedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    isActive: { type: Boolean, default: true, index: true }, // false once left/removed
  },
  { timestamps: true }
);

conversationMemberSchema.index({ conversation: 1, user: 1 }, { unique: true });
conversationMemberSchema.index({ user: 1, isActive: 1, isPinned: -1, updatedAt: -1 }); // conversation listing
conversationMemberSchema.index({ user: 1, unreadCount: 1 });                            // unread badge

conversationMemberSchema.statics.isActiveMember = async function (conversationId, userId) {
  const doc = await this.findOne({ conversation: conversationId, user: userId, isActive: true }).lean();
  return !!doc;
};

conversationMemberSchema.methods.markRead = function (messageId) {
  this.lastReadMessageId = messageId;
  this.lastReadAt = new Date();
  this.unreadCount = 0;
  return this.save();
};

conversationMemberSchema.virtual('isEffectivelyMuted').get(function () {
  if (!this.isMuted) return false;
  if (this.mutedUntil && this.mutedUntil < new Date()) return false;
  return true;
});
conversationMemberSchema.set('toJSON', { virtuals: true });

const ConversationMember = mongoose.model('ConversationMember', conversationMemberSchema);
export default ConversationMember;
