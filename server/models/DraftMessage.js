// models/DraftMessage.js
// One unsent draft per (user, conversation), synced across devices.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const draftMessageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body:         { type: String, default: '', maxlength: 8000 },
    replyTo:      { type: Schema.Types.ObjectId, ref: 'Message', default: null },
    updatedAt:    { type: Date, default: Date.now },
  }
);

draftMessageSchema.index({ conversation: 1, user: 1 }, { unique: true });

draftMessageSchema.statics.upsertDraft = function (conversationId, userId, body, replyTo = null) {
  return this.findOneAndUpdate(
    { conversation: conversationId, user: userId },
    { $set: { body, replyTo, updatedAt: new Date() } },
    { upsert: true, new: true }
  );
};

const DraftMessage = mongoose.model('DraftMessage', draftMessageSchema);
export default DraftMessage;
