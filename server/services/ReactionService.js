// services/ReactionService.js
import MessageReaction from '../models/MessageReaction.js';
import Message from '../models/Message.js';
import PermissionService from './PermissionService.js';
import AuditService from './AuditService.js';
import { ApiError } from '../utils/apiResponse.js';
import { REACTION_EMOJIS } from '../constants/messageConstants.js';

class ReactionService {
  async react(actorUser, messageId, emoji) {
    if (!REACTION_EMOJIS.includes(emoji)) throw new ApiError(400, 'Unsupported reaction emoji.');

    const message = await Message.findById(messageId);
    if (!message || message.isDeletedForEveryone) throw new ApiError(404, 'Message not found.');

    await PermissionService.assertIsActiveMember(message.conversation, actorUser._id);

    const reaction = await MessageReaction.findOneAndUpdate(
      { message: messageId, user: actorUser._id },
      { $set: { emoji } },
      { upsert: true, new: true }
    );

    await AuditService.log({
      action: 'reaction_added',
      actor: actorUser._id,
      targetType: 'Message',
      targetId: messageId,
      conversation: message.conversation,
      metadata: { emoji },
    });

    return reaction;
  }

  async removeReaction(actorUser, messageId) {
    const message = await Message.findById(messageId);
    if (!message) throw new ApiError(404, 'Message not found.');

    const removed = await MessageReaction.findOneAndDelete({ message: messageId, user: actorUser._id });
    if (removed) {
      await AuditService.log({
        action: 'reaction_removed',
        actor: actorUser._id,
        targetType: 'Message',
        targetId: messageId,
        conversation: message.conversation,
      });
    }
    return removed;
  }

  async getReactionsForMessage(messageId) {
    return MessageReaction.getCountsForMessage(messageId);
  }
}

export default new ReactionService();
