// models/TypingStatus.js
//
// Typing state is ephemeral and extremely high-write-volume. It is kept in
// Mongo (rather than only in-memory on the socket server) so typing state
// survives a socket-server restart during horizontal scaling / rolling
// deploys, and so any app-server node can answer "who's typing" via a
// short-lived TTL document instead of only the node holding the socket.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const typingStatusSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    user:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt:    { type: Date, default: Date.now },
    expiresAt:    { type: Date, required: true, index: { expires: 0 } }, // TTL index — auto-cleans stale typing state
  },
  { timestamps: true }
);

typingStatusSchema.index({ conversation: 1, user: 1 }, { unique: true });

const TypingStatus = mongoose.model('TypingStatus', typingStatusSchema);
export default TypingStatus;
