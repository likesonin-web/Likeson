// services/ConversationService.js
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import ConversationMember from '../models/ConversationMember.js';
import PermissionService from './PermissionService.js';
import AuditService from './AuditService.js';
import { ApiError, buildPagination } from '../utils/apiResponse.js';
import { isAdminRole } from '../constants/roles.js';

class ConversationService {
  /**
   * Get or create a 1:1 private conversation between two users.
   * `isAssigned` must be pre-verified by AssignmentService for customer<->partner pairs.
   */
  async getOrCreateDirectConversation(actorUser, targetUserId, { isAssigned = false } = {}) {
    if (actorUser._id.toString() === targetUserId.toString()) {
      throw new ApiError(400, 'Cannot start a conversation with yourself.');
    }

    const targetUser = await mongoose.model('User').findById(targetUserId).select('role').lean();
    if (!targetUser) throw new ApiError(404, 'Target user not found.');

    if (!PermissionService.canInitiateDirectConversation(actorUser, targetUser, { isAssigned })) {
      throw new ApiError(403, 'You are not permitted to message this user.');
    }

    // Deterministic lookup: find an existing direct conversation containing exactly these two active members.
    const existing = await ConversationMember.aggregate([
      { $match: { user: { $in: [actorUser._id, new mongoose.Types.ObjectId(targetUserId)] }, isActive: true } },
      { $group: { _id: '$conversation', users: { $addToSet: '$user' }, count: { $sum: 1 } } },
      { $match: { count: 2 } },
      { $lookup: { from: 'conversations', localField: '_id', foreignField: '_id', as: 'conv' } },
      { $unwind: '$conv' },
      { $match: { 'conv.type': 'private', 'conv.isDirect': true, 'conv.isDeleted': false } },
      { $limit: 1 },
    ]);

    if (existing.length) {
      return Conversation.findById(existing[0]._id);
    }

    const conversation = await Conversation.create({
      type: 'private',
      isDirect: true,
      createdBy: actorUser._id,
    });

    await ConversationMember.insertMany([
      { conversation: conversation._id, user: actorUser._id, role: 'owner' },
      { conversation: conversation._id, user: targetUserId, role: 'member' },
    ]);

    await AuditService.log({
      action: 'conversation_created',
      actor: actorUser._id,
      targetType: 'Conversation',
      targetId: conversation._id,
      conversation: conversation._id,
      metadata: { type: 'private' },
    });

    return conversation;
  }

  async listForUser(userId, { page = 1, limit = 20, archived = false, search } = {}) {
    const memberFilter = { user: userId, isActive: true, isArchived: archived };

    let conversationIds = null;
    if (search) {
      const matched = await Conversation.find(
        { $text: { $search: search }, isDeleted: false },
        { _id: 1 }
      ).lean();
      conversationIds = matched.map((c) => c._id);
      memberFilter.conversation = { $in: conversationIds };
    }

    const [members, total] = await Promise.all([
      ConversationMember.find(memberFilter)
        .sort({ isPinned: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate({
          path: 'conversation',
          match: { isDeleted: false },
        })
        .lean(),
      ConversationMember.countDocuments(memberFilter),
    ]);

    return {
      items: members.filter((m) => m.conversation).map((m) => ({
        conversation: m.conversation,
        unreadCount: m.unreadCount,
        isPinned: m.isPinned,
        isMuted: m.isMuted,
        lastReadAt: m.lastReadAt,
      })),
      pagination: buildPagination({ page, limit, total }),
    };
  }

  async getByIdForUser(conversationId, userId) {
    await PermissionService.assertIsActiveMember(conversationId, userId);
    const conversation = await Conversation.findActiveById(conversationId);
    if (!conversation) throw new ApiError(404, 'Conversation not found.');
    return conversation;
  }

  async archiveForUser(conversationId, userId, archived = true) {
    await PermissionService.assertIsActiveMember(conversationId, userId);
    const member = await ConversationMember.findOneAndUpdate(
      { conversation: conversationId, user: userId },
      { $set: { isArchived: archived } },
      { new: true }
    );
    return member;
  }

  async pinForUser(conversationId, userId, pinned = true) {
    await PermissionService.assertIsActiveMember(conversationId, userId);
    return ConversationMember.findOneAndUpdate(
      { conversation: conversationId, user: userId },
      { $set: { isPinned: pinned } },
      { new: true }
    );
  }

  async muteForUser(conversationId, userId, { muted = true, mutedUntil = null } = {}) {
    await PermissionService.assertIsActiveMember(conversationId, userId);
    return ConversationMember.findOneAndUpdate(
      { conversation: conversationId, user: userId },
      { $set: { isMuted: muted, mutedUntil } },
      { new: true }
    );
  }

  async deleteConversation(conversationId, actorUser) {
    const conversation = await Conversation.findActiveById(conversationId);
    if (!conversation) throw new ApiError(404, 'Conversation not found.');

    if (!isAdminRole(actorUser.role) && conversation.createdBy.toString() !== actorUser._id.toString()) {
      throw new ApiError(403, 'Only the creator or an admin can delete this conversation.');
    }

    await conversation.softDelete(actorUser._id);
    await AuditService.log({
      action: 'conversation_deleted',
      actor: actorUser._id,
      targetType: 'Conversation',
      targetId: conversation._id,
      conversation: conversation._id,
    });
    return conversation;
  }
}

export default new ConversationService();
