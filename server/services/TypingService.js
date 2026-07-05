// services/TypingService.js
import TypingStatus from '../models/TypingStatus.js';

const TYPING_TTL_MS = 8 * 1000;

class TypingService {
  async startTyping(conversationId, userId) {
    return TypingStatus.findOneAndUpdate(
      { conversation: conversationId, user: userId },
      { $set: { startedAt: new Date(), expiresAt: new Date(Date.now() + TYPING_TTL_MS) } },
      { upsert: true, new: true }
    );
  }

  async stopTyping(conversationId, userId) {
    return TypingStatus.deleteOne({ conversation: conversationId, user: userId });
  }

  async getTypingUsers(conversationId) {
    const active = await TypingStatus.find({
      conversation: conversationId,
      expiresAt: { $gt: new Date() },
    }).select('user').lean();
    return active.map((t) => t.user);
  }
}

export default new TypingService();
