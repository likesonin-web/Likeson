// models/Message.js
//
// Messages always live in their own collection, never embedded in
// Conversation. Edit/delete are soft — history is preserved in
// MessageEditHistory / MessageDeleteHistory.

import mongoose from 'mongoose';
import { MESSAGE_TYPES, MESSAGE_EDIT_WINDOW_MS } from '../constants/messageConstants.js';

const { Schema } = mongoose;

const mentionSchema = new Schema(
  { user: { type: Schema.Types.ObjectId, ref: 'User', required: true }, offset: Number, length: Number },
  { _id: false }
);

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: MESSAGE_TYPES, required: true, default: 'text' },

    body: { type: String, trim: true, maxlength: 8000 }, // required for text/system, optional otherwise

    // Attachment metadata reference only — the binary lives in ImageKit.
    attachment: { type: Schema.Types.ObjectId, ref: 'Attachment', default: null },

    replyTo:    { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    forwardedFrom: { type: Schema.Types.ObjectId, ref: 'Message', default: null },

    mentions: { type: [mentionSchema], default: [] },

    // Client-generated idempotency key — prevents duplicate sends on retry/replay.
    clientMessageId: { type: String, default: null },

    isEdited:  { type: Boolean, default: false },
    editedAt:  { type: Date, default: null },

    // Soft-delete is per-scope: "for everyone" is a single flag; "for me" is
    // tracked per-user in MessageDeleteHistory to avoid mutating this doc
    // once many users interact with it.
    isDeletedForEveryone: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    isPinned: { type: Boolean, default: false },

    deliveredTo: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },

    systemMeta: { type: Schema.Types.Mixed, default: null }, // e.g. { action: 'member_added', targetUser } for type='system'
  },
  { timestamps: true }
);

// ── Validation ──────────────────────────────────────────────────────────────

messageSchema.pre('validate', function (next) {
  if (['text', 'reply', 'mention'].includes(this.type) && !this.body) {
    return next(new Error(`body is required for message type "${this.type}"`));
  }
  if (['image', 'video', 'audio', 'document'].includes(this.type) && !this.attachment) {
    return next(new Error(`attachment is required for message type "${this.type}"`));
  }
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────

messageSchema.index({ conversation: 1, createdAt: -1 });                 // latest messages (pagination)
messageSchema.index({ conversation: 1, isPinned: 1 });                    // pinned messages
messageSchema.index({ conversation: 1, clientMessageId: 1 }, { unique: true, sparse: true }); // dedupe/replay guard
messageSchema.index({ body: 'text' });                                   // message search
messageSchema.index({ sender: 1, createdAt: -1 });

// ── Virtuals ─────────────────────────────────────────────────────────────

messageSchema.virtual('isEditable').get(function () {
  if (this.isDeletedForEveryone) return false;
  return Date.now() - this.createdAt.getTime() <= MESSAGE_EDIT_WINDOW_MS;
});
messageSchema.set('toJSON', { virtuals: true });

// ── Methods ───────────────────────────────────────────────────────────────

messageSchema.methods.softDeleteForEveryone = function (userId) {
  this.isDeletedForEveryone = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.body = null;
  this.type = 'deleted';
  return this.save();
};

const Message = mongoose.model('Message', messageSchema);
export default Message;
