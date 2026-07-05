// services/MessageService.js
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import MessageEditHistory from '../models/MessageEditHistory.js';
import MessageDeleteHistory from '../models/MessageDeleteHistory.js';
import MessageRead from '../models/MessageRead.js';
import Conversation from '../models/Conversation.js';
import ConversationMember from '../models/ConversationMember.js';
import PermissionService from './PermissionService.js';
import AuditService from './AuditService.js';
import NotificationService from './NotificationService.js';
import { ApiError, buildPagination } from '../utils/apiResponse.js';

class MessageService {
  async sendMessage(actorUser, conversationId, { type = 'text', body, attachmentId, replyTo, mentions = [], clientMessageId }) {
    await PermissionService.assertIsActiveMember(conversationId, actorUser._id);

    const [conversation, member] = await Promise.all([
      Conversation.findActiveById(conversationId),
      ConversationMember.findOne({ conversation: conversationId, user: actorUser._id }),
    ]);
    if (!conversation) throw new ApiError(404, 'Conversation not found.');

    if (conversation.type === 'group') {
      await PermissionService.assertGroupPostingAllowed(conversation, member);
    }

    // Idempotency: if clientMessageId already exists for this conversation, return the existing message.
    if (clientMessageId) {
      const dup = await Message.findOne({ conversation: conversationId, clientMessageId });
      if (dup) return dup;
    }

    let message;
    try {
      message = await Message.create({
        conversation: conversationId,
        sender: actorUser._id,
        type,
        body,
        attachment: attachmentId || null,
        replyTo: replyTo || null,
        mentions,
        clientMessageId: clientMessageId || null,
      });
    } catch (err) {
      if (err.code === 11000) {
        // Race: another request with the same clientMessageId won.
        return Message.findOne({ conversation: conversationId, clientMessageId });
      }
      throw err;
    }

    await conversation.touchLastMessage({
      messageId: message._id,
      preview: type === 'text' ? body.slice(0, 120) : `[${type}]`,
      senderId: actorUser._id,
      messageType: type,
    });

    // Increment unread count for every other active member.
    await ConversationMember.updateMany(
      { conversation: conversationId, user: { $ne: actorUser._id }, isActive: true },
      { $inc: { unreadCount: 1 } }
    );

    await AuditService.log({
      action: 'message_sent',
      actor: actorUser._id,
      targetType: 'Message',
      targetId: message._id,
      conversation: conversationId,
    });

    // Notify other non-muted members (mentions get priority notification separately).
    const otherMembers = await ConversationMember.find({
      conversation: conversationId,
      user: { $ne: actorUser._id },
      isActive: true,
    }).lean();

    for (const m of otherMembers) {
      if (m.isMuted && (!m.mutedUntil || m.mutedUntil > new Date())) continue;
      await NotificationService.notifyNewMessage({
        recipientId: m.user,
        senderName: actorUser.name,
        conversationId,
        preview: type === 'text' ? body : `sent a ${type}`,
        actorId: actorUser._id,
      });
    }

    for (const mention of mentions) {
      await NotificationService.notifyMention({
        recipientId: mention.user,
        senderName: actorUser.name,
        conversationId,
        actorId: actorUser._id,
      });
    }

    return message;
  }

  async listMessages(conversationId, userId, { page = 1, limit = 30, before } = {}) {
    await PermissionService.assertIsActiveMember(conversationId, userId);

    const filter = { conversation: conversationId };
    if (before) filter.createdAt = { $lt: new Date(before) };

    const hiddenIds = (await MessageDeleteHistory.find({ user: userId }).select('message').lean())
      .map((d) => d.message);
    if (hiddenIds.length) filter._id = { $nin: hiddenIds };

    const [messages, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).limit(limit).populate('replyTo').lean(),
      Message.countDocuments({ conversation: conversationId }),
    ]);

    return { items: messages.reverse(), pagination: buildPagination({ page, limit, total }) };
  }

  async editMessage(actorUser, messageId, newBody) {
    const message = await Message.findById(messageId);
    if (!message) throw new ApiError(404, 'Message not found.');

    PermissionService.assertCanEditMessage(message, actorUser._id);

    await MessageEditHistory.create({
      message: message._id,
      previousBody: message.body,
      editedBy: actorUser._id,
    });

    message.body = newBody;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    await AuditService.log({
      action: 'message_edited',
      actor: actorUser._id,
      targetType: 'Message',
      targetId: message._id,
      conversation: message.conversation,
    });

    return message;
  }

  async deleteForMe(userId, messageId) {
    const message = await Message.findById(messageId);
    if (!message) throw new ApiError(404, 'Message not found.');

    await MessageDeleteHistory.findOneAndUpdate(
      { message: messageId, user: userId },
      { $setOnInsert: { deletedAt: new Date() } },
      { upsert: true }
    );
    return { messageId, scope: 'me' };
  }

  async deleteForEveryone(actorUser, messageId) {
    const message = await Message.findById(messageId);
    if (!message) throw new ApiError(404, 'Message not found.');

    PermissionService.assertCanDeleteForEveryone(message, actorUser);
    await message.softDeleteForEveryone(actorUser._id);

    await AuditService.log({
      action: 'message_deleted',
      actor: actorUser._id,
      targetType: 'Message',
      targetId: message._id,
      conversation: message.conversation,
    });

    return message;
  }

  async forwardMessage(actorUser, originalMessageId, targetConversationId) {
    const original = await Message.findById(originalMessageId);
    if (!original || original.isDeletedForEveryone) throw new ApiError(404, 'Message not found.');

    return this.sendMessage(actorUser, targetConversationId, {
      type: original.type,
      body: original.body,
      attachmentId: original.attachment,
      forwardedFrom: original._id,
    });
  }

  async markDelivered(messageId, userId) {
    return Message.findByIdAndUpdate(messageId, { $addToSet: { deliveredTo: userId } });
  }

  async markRead(conversationId, userId, upToMessageId) {
    await PermissionService.assertIsActiveMember(conversationId, userId);

    const message = await Message.findOne({ _id: upToMessageId, conversation: conversationId }).select('createdAt');
    if (!message) throw new ApiError(404, 'Message not found in this conversation.');

    const unreadMessages = await Message.find({
      conversation: conversationId,
      createdAt: { $lte: message.createdAt },
      sender: { $ne: userId },
    }).select('_id').lean();

    await Promise.all(
      unreadMessages.map((m) => MessageRead.markRead(m._id, conversationId, userId))
    );

    const member = await ConversationMember.findOne({ conversation: conversationId, user: userId });
    if (member) await member.markRead(upToMessageId);

    return { readCount: unreadMessages.length };
  }

  async searchMessages(conversationId, userId, query, { page = 1, limit = 20 } = {}) {
    await PermissionService.assertIsActiveMember(conversationId, userId);

    const filter = { conversation: conversationId, $text: { $search: query } };
    const [items, total] = await Promise.all([
      Message.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Message.countDocuments(filter),
    ]);
    return { items, pagination: buildPagination({ page, limit, total }) };
  }
}

export default new MessageService();
