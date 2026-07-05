// models/Presence.js
//
// Multi-device online presence. The existing User.isOnline/lastseen fields
// remain the single "is this user online at all" source of truth (derived
// from this collection); this collection tracks each individual socket
// connection so presence survives multi-device usage (isOnline should stay
// true if ANY device is connected) and horizontal scaling (any node can
// look up which server/room a user's socket lives on).

import mongoose from 'mongoose';
const { Schema } = mongoose;

const presenceSchema = new Schema(
  {
    user:       { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    socketId:   { type: String, required: true, unique: true },
    serverInstanceId: { type: String, required: true }, // which app-server node owns this socket
    platform:   { type: String, enum: ['android', 'ios', 'web', 'desktop'], default: 'web' },
    connectedAt: { type: Date, default: Date.now },
    lastPingAt:  { type: Date, default: Date.now },
  },
  { timestamps: true }
);

presenceSchema.index({ user: 1 });
presenceSchema.index({ lastPingAt: 1 }); // sweep stale connections that never got a clean disconnect

presenceSchema.statics.isUserOnline = async function (userId) {
  const count = await this.countDocuments({ user: userId });
  return count > 0;
};

const Presence = mongoose.model('Presence', presenceSchema);
export default Presence;
