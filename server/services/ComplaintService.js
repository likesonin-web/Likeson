// services/ComplaintService.js
//
// A complaint is exactly a Conversation{type:'complaint'} plus its
// ComplaintTimeline — no separate messaging system.

import Conversation from '../models/Conversation.js';
import ConversationMember from '../models/ConversationMember.js';
import ComplaintTimeline from '../models/ComplaintTimeline.js';
import PermissionService from './PermissionService.js';
import AuditService from './AuditService.js';
import NotificationService from './NotificationService.js';
import MessageService from './MessageService.js';
import { ApiError, buildPagination } from '../utils/apiResponse.js';
import { isValidStatusTransition } from '../constants/complaintConstants.js';
import { isAdminRole } from '../constants/roles.js';

class ComplaintService {
  async create(actorUser, { category, priority, description, adminRecipientId }) {
    const conversation = await Conversation.create({
      type: 'complaint',
      title: `${category} — ${actorUser.name}`,
      createdBy: actorUser._id,
      complaint: {
        status: 'Open',
        category,
        priority,
        raisedBy: actorUser._id,
      },
    });

    await ConversationMember.create({
      conversation: conversation._id,
      user: actorUser._id,
      role: 'owner',
    });

    if (description) {
      await MessageService.sendMessage(actorUser, conversation._id, { type: 'text', body: description });
    }

    await ComplaintTimeline.create({
      conversation: conversation._id,
      event: 'created',
      actor: actorUser._id,
      toStatus: 'Open',
    });

    await AuditService.log({
      action: 'complaint_created',
      actor: actorUser._id,
      targetType: 'Conversation',
      targetId: conversation._id,
      conversation: conversation._id,
      metadata: { category, priority },
    });

    if (adminRecipientId) {
      await NotificationService.notifyComplaintCreated({
        recipientId: adminRecipientId,
        conversationId: conversation._id,
        category,
        actorId: actorUser._id,
      });
    }

    return conversation;
  }

  async updateStatus(actorUser, conversationId, newStatus, note) {
    PermissionService.assertCanManageComplaint(actorUser);

    const conversation = await Conversation.findOne({ _id: conversationId, type: 'complaint', isDeleted: false });
    if (!conversation) throw new ApiError(404, 'Complaint not found.');

    const currentStatus = conversation.complaint.status;
    if (!isValidStatusTransition(currentStatus, newStatus)) {
      throw new ApiError(400, `Cannot transition complaint from "${currentStatus}" to "${newStatus}".`);
    }

    conversation.complaint.status = newStatus;
    if (newStatus === 'Resolved') conversation.complaint.resolvedAt = new Date();
    if (newStatus === 'Closed') conversation.complaint.closedAt = new Date();
    await conversation.save();

    await ComplaintTimeline.create({
      conversation: conversationId,
      event: newStatus === 'Closed' ? 'closed' : 'status_changed',
      fromStatus: currentStatus,
      toStatus: newStatus,
      actor: actorUser._id,
      note,
    });

    await AuditService.log({
      action: newStatus === 'Closed' ? 'complaint_closed' : 'complaint_status_changed',
      actor: actorUser._id,
      targetType: 'Conversation',
      targetId: conversationId,
      conversation: conversationId,
      metadata: { from: currentStatus, to: newStatus },
    });

    if (newStatus === 'Closed') {
      await NotificationService.notifyComplaintClosed({
        recipientId: conversation.complaint.raisedBy,
        conversationId,
        actorId: actorUser._id,
      });
    }

    return conversation;
  }

  async listForDashboard(actorUser, { status, priority, category, assignedTo, page = 1, limit = 20 } = {}) {
    if (!isAdminRole(actorUser.role) && actorUser.role !== 'finance') {
      throw new ApiError(403, 'Only admins can view the complaint dashboard.');
    }

    const filter = { type: 'complaint', isDeleted: false };
    if (status) filter['complaint.status'] = status;
    if (priority) filter['complaint.priority'] = priority;
    if (category) filter['complaint.category'] = category;
    if (assignedTo) filter['complaint.assignedTo'] = assignedTo;

    const [items, total] = await Promise.all([
      Conversation.find(filter).sort({ 'complaint.priority': 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Conversation.countDocuments(filter),
    ]);

    return { items, pagination: buildPagination({ page, limit, total }) };
  }

  async getTimeline(conversationId, userId) {
    await PermissionService.assertIsActiveMember(conversationId, userId);
    return ComplaintTimeline.find({ conversation: conversationId }).sort({ createdAt: 1 }).populate('actor', 'name role').lean();
  }

  /**
   * Analytics: average first-response and resolution time in minutes.
   */
  async getResponseMetrics({ from, to } = {}) {
    const match = { type: 'complaint', isDeleted: false };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }

    const [result] = await Conversation.aggregate([
      { $match: match },
      {
        $project: {
          firstResponseMinutes: {
            $cond: [
              { $ifNull: ['$complaint.firstResponseAt', false] },
              { $divide: [{ $subtract: ['$complaint.firstResponseAt', '$createdAt'] }, 60000] },
              null,
            ],
          },
          resolutionMinutes: {
            $cond: [
              { $ifNull: ['$complaint.resolvedAt', false] },
              { $divide: [{ $subtract: ['$complaint.resolvedAt', '$createdAt'] }, 60000] },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgFirstResponseMinutes: { $avg: '$firstResponseMinutes' },
          avgResolutionMinutes: { $avg: '$resolutionMinutes' },
          totalComplaints: { $sum: 1 },
        },
      },
    ]);

    return result || { avgFirstResponseMinutes: null, avgResolutionMinutes: null, totalComplaints: 0 };
  }
}

export default new ComplaintService();
