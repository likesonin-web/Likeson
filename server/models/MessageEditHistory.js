// models/MessageEditHistory.js
// Immutable log of every prior body version, written before a Message is mutated.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const messageEditHistorySchema = new Schema(
  {
    message:      { type: Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
    previousBody: { type: String, required: true },
    editedBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    editedAt:     { type: Date, default: Date.now },
  },
  { timestamps: true }
);

messageEditHistorySchema.index({ message: 1, editedAt: -1 });

const MessageEditHistory = mongoose.model('MessageEditHistory', messageEditHistorySchema);
export default MessageEditHistory;
