// services/GroupService.js
import Conversation from '../models/Conversation.js';
import ConversationMember from '../models/ConversationMember.js';
import ConversationSettings from '../models/ConversationSettings.js';
import PermissionService from './PermissionService.js';
import AuditService from './AuditService.js';
import NotificationService from './NotificationService.js';
import { ApiError } from '../utils/apiResponse.js';
import { MAX_GROUP_MEMBERS } from '../constants/conversationConstants.js';

class GroupService {
  async createGroup(actorUser, { title, memberIds = [] }) {
    await PermissionService.assertCanManageGroup(actorUser);

    if (memberIds.length + 1 > MAX_GROUP_MEMBERS) {
      throw new ApiError(400, `Group cannot exceed ${MAX_GROUP_MEMBERS} members.`);
    }

    const conversation = await Conversation.create({
      type: 'group',
      title,
      createdBy: actorUser._id,
      group: { createdBy: actorUser._id, memberCount: memberIds.length + 1 },
    });

    await ConversationSettings.create({ conversation: conversation._id });

    const members = [
      { conversation: conversation._id, user: actorUser._id, role: 'owner' },
      ...memberIds.map((id) => ({ conversation: conversation._id, user: id, role: 'member', invitedBy: actorUser._id })),
    ];
    await ConversationMember.insertMany(members);

    await AuditService.log({
      action: 'group_created',
      actor: actorUser._id,
      targetType: 'Conversation',
      targetId: conversation._id,
      conversation: conversation._id,
      metadata: { memberCount: members.length },
    });

    for (const id of memberIds) {
      await NotificationService.notifyGroupInvitation({
        recipientId: id, groupName: title, conversationId: conversation._id, actorId: actorUser._id,
      });
    }

    return conversation;
  }

  async renameGroup(actorUser, conversationId, newTitle) {
    await PermissionService.assertCanManageGroup(actorUser);
    const conversation = await Conversation.findOne({ _id: conversationId, type: 'group', isDeleted: false });
    if (!conversation) throw new ApiError(404, 'Group not found.');

    conversation.title = newTitle;
    conversation.updatedBy = actorUser._id;
    await conversation.save();

    await AuditService.log({
      action: 'group_renamed', actor: actorUser._id, targetType: 'Conversation',
      targetId: conversationId, conversation: conversationId, metadata: { newTitle },
    });
    return conversation;
  }

  async archiveGroup(actorUser, conversationId, archived = true) {
    await PermissionService.assertCanManageGroup(actorUser);
    const conversation = await Conversation.findOne({ _id: conversationId, type: 'group', isDeleted: false });
    if (!conversation) throw new ApiError(404, 'Group not found.');

    conversation.group.isArchived = archived;
    await conversation.save();
    return conversation;
  }

  async deleteGroup(actorUser, conversationId) {
    await PermissionService.assertCanManageGroup(actorUser);
    const conversation = await Conversation.findOne({ _id: conversationId, type: 'group', isDeleted: false });
    if (!conversation) throw new ApiError(404, 'Group not found.');

    await conversation.softDelete(actorUser._id);
    await AuditService.log({
      action: 'group_deleted', actor: actorUser._id, targetType: 'Conversation',
      targetId: conversationId, conversation: conversationId,
    });
    return conversation;
  }

  async lockGroup(actorUser, conversationId, locked = true) {
    await PermissionService.assertCanManageGroup(actorUser);
    const conversation = await Conversation.findOne({ _id: conversationId, type: 'group', isDeleted: false });
    if (!conversation) throw new ApiError(404, 'Group not found.');

    conversation.group.isLocked = locked;
    await conversation.save();

    await AuditService.log({
      action: locked ? 'group_locked' : 'group_unlocked',
      actor: actorUser._id, targetType: 'Conversation', targetId: conversationId, conversation: conversationId,
    });
    return conversation;
  }

  async addMembers(actorUser, conversationId, memberIds) {
    await PermissionService.assertCanManageGroup(actorUser);
    const conversation = await Conversation.findOne({ _id: conversationId, type: 'group', isDeleted: false });
    if (!conversation) throw new ApiError(404, 'Group not found.');

    const currentCount = await ConversationMember.countDocuments({ conversation: conversationId, isActive: true });
    if (currentCount + memberIds.length > MAX_GROUP_MEMBERS) {
      throw new ApiError(400, `Group cannot exceed ${MAX_GROUP_MEMBERS} members.`);
    }

    const ops = memberIds.map((userId) => ({
      updateOne: {
        filter: { conversation: conversationId, user: userId },
        update: {
          $set: { isActive: true, role: 'member', invitedBy: actorUser._id, joinedAt: new Date(), leftAt: null },
        },
        upsert: true,
      },
    }));
    await ConversationMember.bulkWrite(ops);

    conversation.group.memberCount = await ConversationMember.countDocuments({ conversation: conversationId, isActive: true });
    await conversation.save();

    await AuditService.log({
      action: 'member_added', actor: actorUser._id, targetType: 'Conversation',
      targetId: conversationId, conversation: conversationId, metadata: { memberIds },
    });

    for (const id of memberIds) {
      await NotificationService.notifyGroupInvitation({
        recipientId: id, groupName: conversation.title, conversationId, actorId: actorUser._id,
      });
    }

    return conversation;
  }

  async removeMember(actorUser, conversationId, targetUserId) {
    await PermissionService.assertCanManageGroup(actorUser);

    const member = await ConversationMember.findOneAndUpdate(
      { conversation: conversationId, user: targetUserId, isActive: true },
      { $set: { isActive: false, leftAt: new Date(), removedBy: actorUser._id } },
      { new: true }
    );
    if (!member) throw new ApiError(404, 'Member not found in this group.');

    await Conversation.findByIdAndUpdate(conversationId, {
      $inc: { 'group.memberCount': -1 },
    });

    await AuditService.log({
      action: 'member_removed', actor: actorUser._id, targetType: 'Conversation',
      targetId: conversationId, conversation: conversationId, metadata: { targetUserId },
    });

    return member;
  }

  async assignModerator(actorUser, conversationId, targetUserId) {
    await PermissionService.assertCanManageGroup(actorUser);

    const member = await ConversationMember.findOneAndUpdate(
      { conversation: conversationId, user: targetUserId, isActive: true },
      { $set: { role: 'moderator' } },
      { new: true }
    );
    if (!member) throw new ApiError(404, 'Member not found in this group.');

    await AuditService.log({
      action: 'moderator_assigned', actor: actorUser._id, targetType: 'Conversation',
      targetId: conversationId, conversation: conversationId, metadata: { targetUserId },
    });

    return member;
  }

  async muteMember(actorUser, conversationId, targetUserId, { muted = true, mutedUntil = null } = {}) {
    await PermissionService.assertCanManageGroup(actorUser);

    const member = await ConversationMember.findOneAndUpdate(
      { conversation: conversationId, user: targetUserId, isActive: true },
      { $set: { isMuted: muted, mutedUntil } },
      { new: true }
    );
    if (!member) throw new ApiError(404, 'Member not found in this group.');

    await AuditService.log({
      action: 'member_muted', actor: actorUser._id, targetType: 'Conversation',
      targetId: conversationId, conversation: conversationId, metadata: { targetUserId, muted },
    });

    return member;
  }
}

export default new GroupService();
