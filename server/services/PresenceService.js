// services/PresenceService.js
//
// Updates the EXISTING User.isOnline/lastseen/lastActiveAt fields (never
// duplicated) while tracking individual socket connections in the Presence
// collection to correctly support multi-device sessions.

import mongoose from 'mongoose';
import Presence from '../models/Presence.js';

class PresenceService {
  async registerConnection({ userId, socketId, serverInstanceId, platform }) {
    await Presence.create({ user: userId, socketId, serverInstanceId, platform });

    const User = mongoose.model('User');
    await User.findByIdAndUpdate(userId, {
      $set: { isOnline: true, lastActiveAt: new Date() },
    });
  }

  async registerDisconnection({ userId, socketId }) {
    await Presence.deleteOne({ socketId });

    const remaining = await Presence.countDocuments({ user: userId });
    if (remaining === 0) {
      const User = mongoose.model('User');
      await User.findByIdAndUpdate(userId, {
        $set: { isOnline: false, lastseen: new Date(), lastActiveAt: new Date() },
      });
    }
  }

  async heartbeat(socketId) {
    await Presence.updateOne({ socketId }, { $set: { lastPingAt: new Date() } });
  }

  async isOnline(userId) {
    return Presence.isUserOnline(userId);
  }

  /** Sweep sockets that never received a clean disconnect (e.g. crashed client). */
  async sweepStaleConnections(staleThresholdMs = 2 * 60 * 1000) {
    const cutoff = new Date(Date.now() - staleThresholdMs);
    const stale = await Presence.find({ lastPingAt: { $lt: cutoff } }).lean();
    for (const p of stale) {
      await this.registerDisconnection({ userId: p.user, socketId: p.socketId });
    }
    return stale.length;
  }
}

export default new PresenceService();
