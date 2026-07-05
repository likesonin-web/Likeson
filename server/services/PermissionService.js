// services/PermissionService.js
//
// Single source of truth for "can user X do Y" checks. Every other service
// calls into this rather than re-implementing role checks, so the
// permission matrix lives in exactly one place.

import { ApiError } from '../utils/apiResponse.js';
import { isAdminRole } from '../constants/roles.js';
import ConversationMember from '../models/ConversationMember.js';

class PermissionService {
  isAdmin(user) {
    return isAdminRole(user.role);
  }

  /**
   * Can `actorUser` open a DIRECT conversation with `targetUser`?
   * Rule: customer <-> assigned partner, or anyone <-> admin/superadmin.
   * Admin/superadmin can message anyone. Assignment is verified by the
   * caller (AssignmentService) before this is invoked for customer<->partner.
   */
  canInitiateDirectConversation(actorUser, targetUser, { isAssigned = false } = {}) {
    if (this.isAdmin(actorUser) || this.isAdmin(targetUser)) return true;
    if (isAssigned) return true;
    return false;
  }

  async assertIsActiveMember(conversationId, userId) {
    const isMember = await ConversationMember.isActiveMember(conversationId, userId);
    if (!isMember) {
      throw new ApiError(403, 'You are not a participant in this conversation.');
    }
  }

  async assertCanManageGroup(user) {
    if (!this.isAdmin(user)) {
      throw new ApiError(403, 'Only administrators can manage groups.');
    }
  }

  async assertGroupPostingAllowed(conversation, member) {
    if (conversation.group?.isLocked && !['owner', 'admin', 'moderator'].includes(member.role)) {
      throw new ApiError(403, 'This group is locked. Only admins/moderators can post.');
    }
  }

  assertCanEditMessage(message, userId) {
    if (message.sender.toString() !== userId.toString()) {
      throw new ApiError(403, 'You can only edit your own messages.');
    }
    if (!message.isEditable) {
      throw new ApiError(400, 'Edit window (5 minutes) has expired.');
    }
  }

  assertCanDeleteForEveryone(message, user) {
    const isOwner = message.sender.toString() === user._id.toString();
    if (!isOwner && !this.isAdmin(user)) {
      throw new ApiError(403, 'You can only delete your own messages for everyone.');
    }
  }

  assertCanManageComplaint(user) {
    if (!this.isAdmin(user) && user.role !== 'finance') {
      throw new ApiError(403, 'Only admins can manage complaint assignment/status.');
    }
  }
}

export default new PermissionService();
