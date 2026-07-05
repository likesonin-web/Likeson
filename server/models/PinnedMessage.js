// models/PinnedMessage.js
// Separate collection (rather than an array on Conversation) so pin/unpin
// is a single-document write with no risk of concurrent array corruption,
// and so "list pinned messages" is an indexed query, not a doc-field scan.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const pinnedMessageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    message:      { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    pinnedBy:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
    pinnedAt:     { type: Date, default: Date.now },
  },
  { timestamps: true }
);

pinnedMessageSchema.index({ conversation: 1, message: 1 }, { unique: true });

const PinnedMessage = mongoose.model('PinnedMessage', pinnedMessageSchema);
export default PinnedMessage;
