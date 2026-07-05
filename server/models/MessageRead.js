// models/MessageRead.js
// Per-user, per-message read receipt. Separate collection so a busy group
// message's read-by-list doesn't bloat the Message document.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const messageReadSchema = new Schema(
  {
    message:      { type: Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    readAt:       { type: Date, default: Date.now },
  },
  { timestamps: true }
);

messageReadSchema.index({ message: 1, user: 1 }, { unique: true });
messageReadSchema.index({ conversation: 1, user: 1, readAt: -1 });

messageReadSchema.statics.markRead = function (messageId, conversationId, userId) {
  return this.findOneAndUpdate(
    { message: messageId, user: userId },
    { $setOnInsert: { conversation: conversationId }, $set: { readAt: new Date() } },
    { upsert: true, new: true }
  );
};

const MessageRead = mongoose.model('MessageRead', messageReadSchema);
export default MessageRead;
