// services/AssignmentService.js
//
// Governs "which partner is assigned to which customer" — the source of
// truth PermissionService relies on for customer<->partner direct
// messaging eligibility. Reuses whatever assignment data already exists
// on booking/order-style collections is out of scope here (those are
// domain-specific); this service persists the CONVERSATION-level
// assignment used for complaint routing and dashboards.

import Conversation from '../models/Conversation.js';
import ConversationAssignment from '../models/ConversationAssignment.js';
import ComplaintTimeline from '../models/ComplaintTimeline.js';
import AuditService from './AuditService.js';
import NotificationService from './NotificationService.js';
import PermissionService from './PermissionService.js';
import { ApiError } from '../utils/apiResponse.js';

class AssignmentService {
  async assign(actorUser, conversationId, assigneeId) {
    PermissionService.assertCanManageComplaint(actorUser);

    const conversation = await Conversation.findActiveById(conversationId);
    if (!conversation) throw new ApiError(404, 'Conversation not found.');

    const previousAssignee = conversation.complaint?.assignedTo || null;

    await ConversationAssignment.updateMany(
      { conversation: conversationId, isActive: true },
      { $set: { isActive: false, unassignedAt: new Date() } }
    );

    await ConversationAssignment.create({
      conversation: conversationId,
      assignedTo: assigneeId,
      assignedBy: actorUser._id,
      previousAssignee,
    });

    conversation.complaint.assignedTo = assigneeId;
    if (conversation.complaint.status === 'Open') conversation.complaint.status = 'Assigned';
    await conversation.save();

    await ComplaintTimeline.create({
      conversation: conversationId,
      event: previousAssignee ? 'transferred' : 'assigned',
      actor: actorUser._id,
      toStatus: conversation.complaint.status,
    });

    await AuditService.log({
      action: previousAssignee ? 'conversation_transferred' : 'conversation_assigned',
      actor: actorUser._id,
      targetType: 'Conversation',
      targetId: conversationId,
      conversation: conversationId,
      metadata: { assigneeId, previousAssignee },
    });

    await NotificationService.notifyComplaintAssigned({
      recipientId: assigneeId,
      conversationId,
      actorId: actorUser._id,
    });

    return conversation;
  }

  async isPartnerAssignedToCustomer(partnerId, customerId) {
    // Delegates to conversation-level assignment: a partner is "assigned" to
    // a customer if there is an active complaint/private conversation
    // linking them. Domain-specific booking assignment lives outside this
    // module and should be checked by the caller if stricter rules apply.
    const active = await ConversationAssignment.findOne({
      assignedTo: partnerId,
      isActive: true,
    }).populate({ path: 'conversation', match: { 'complaint.raisedBy': customerId } });
    return !!active?.conversation;
  }
}

export default new AssignmentService();
