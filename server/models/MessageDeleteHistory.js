// models/MessageDeleteHistory.js
//
// "Delete for me" is per-user and must NOT mutate the shared Message
// document (other participants still see it normally). Each row hides the
// message from exactly one user's view.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const messageDeleteHistorySchema = new Schema(
  {
    message: { type: Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
    user:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scope:   { type: String, enum: ['me'], default: 'me' }, // 'everyone' scope is handled on Message itself
    deletedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

messageDeleteHistorySchema.index({ message: 1, user: 1 }, { unique: true });

const MessageDeleteHistory = mongoose.model('MessageDeleteHistory', messageDeleteHistorySchema);
export default MessageDeleteHistory;
