// models/MessageReaction.js
// One document per (message, user) — a user's reaction can be swapped
// (heart -> laugh) via update rather than push/pull on an embedded array,
// avoiding array-growth and race conditions under concurrent reacts.

import mongoose from 'mongoose';
import { REACTION_EMOJIS } from '../constants/messageConstants.js';

const { Schema } = mongoose;

const messageReactionSchema = new Schema(
  {
    message: { type: Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
    user:    { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    emoji:   { type: String, enum: REACTION_EMOJIS, required: true },
  },
  { timestamps: true }
);

messageReactionSchema.index({ message: 1, user: 1 }, { unique: true });
messageReactionSchema.index({ message: 1, emoji: 1 });

messageReactionSchema.statics.getCountsForMessage = async function (messageId) {
  return this.aggregate([
    { $match: { message: new mongoose.Types.ObjectId(messageId) } },
    { $group: { _id: '$emoji', count: { $sum: 1 }, users: { $push: '$user' } } },
  ]);
};

const MessageReaction = mongoose.model('MessageReaction', messageReactionSchema);
export default MessageReaction;
