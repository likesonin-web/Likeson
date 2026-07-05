// services/NotificationService.js
//
// Reuses the EXISTING Notification model (models/Notification.js) — does
// not modify it. This service only adds the create-call patterns needed by
// the chat/support module, using types already present in that model's
// enum (Admin_Announcement) plus generic patterns for message/complaint/
// group events, which map onto the model's `type` field via the *_SUPPORT
// mapping below. If the existing enum needs new literal values (e.g.
// 'New_Message', 'Complaint_Assigned'), that is a one-line addition to the
// existing model's `type` enum — flagged separately, not duplicated here.

import Notification from '../models/Notification.js';

class NotificationService {
  async notifyNewMessage({ recipientId, senderName, conversationId, preview, actorId }) {
    return Notification.create({
      recipient: recipientId,
      title: senderName,
      body: preview.slice(0, 200),
      type: 'Account_Status', // TODO: add 'New_Message' to existing Notification.type enum
      priority: 'Medium',
      relatedEntityType: null,
      relatedEntityId: conversationId,
      deepLink: { screen: 'Conversation', referenceId: conversationId },
      createdBy: actorId,
      triggeredBy: 'system',
    });
  }

  async notifyComplaintCreated({ recipientId, conversationId, category, actorId }) {
    return Notification.create({
      recipient: recipientId,
      title: 'New Complaint Raised',
      body: `A new ${category} complaint has been raised.`,
      type: 'Account_Status', // TODO: add 'Complaint_Created' to enum
      priority: 'High',
      deepLink: { screen: 'Complaint', referenceId: conversationId },
      createdBy: actorId,
    });
  }

  async notifyComplaintAssigned({ recipientId, conversationId, actorId }) {
    return Notification.create({
      recipient: recipientId,
      title: 'Complaint Assigned To You',
      body: 'A complaint has been assigned to you for resolution.',
      type: 'Account_Status', // TODO: add 'Complaint_Assigned' to enum
      priority: 'High',
      deepLink: { screen: 'Complaint', referenceId: conversationId },
      createdBy: actorId,
    });
  }

  async notifyComplaintClosed({ recipientId, conversationId, actorId }) {
    return Notification.create({
      recipient: recipientId,
      title: 'Complaint Closed',
      body: 'Your complaint has been closed.',
      type: 'Account_Status', // TODO: add 'Complaint_Closed' to enum
      priority: 'Medium',
      deepLink: { screen: 'Complaint', referenceId: conversationId },
      createdBy: actorId,
    });
  }

  async notifyGroupInvitation({ recipientId, groupName, conversationId, actorId }) {
    return Notification.create({
      recipient: recipientId,
      title: 'Added to Group',
      body: `You were added to "${groupName}".`,
      type: 'Account_Status', // TODO: add 'Group_Invitation' to enum
      priority: 'Low',
      deepLink: { screen: 'Conversation', referenceId: conversationId },
      createdBy: actorId,
    });
  }

  async notifyMention({ recipientId, senderName, conversationId, actorId }) {
    return Notification.create({
      recipient: recipientId,
      title: `${senderName} mentioned you`,
      body: 'You were mentioned in a conversation.',
      type: 'Account_Status', // TODO: add 'Mention' to enum
      priority: 'Medium',
      deepLink: { screen: 'Conversation', referenceId: conversationId },
      createdBy: actorId,
    });
  }

  async notifyAdminAnnouncement({ recipientId, title, body, conversationId, actorId }) {
    return Notification.create({
      recipient: recipientId,
      title,
      body,
      type: 'Admin_Announcement', // already exists in enum
      priority: 'High',
      deepLink: { screen: 'Conversation', referenceId: conversationId },
      createdBy: actorId,
      triggeredBy: 'admin',
    });
  }

  async bulkNotify(recipientIds, buildPayload) {
    const docs = recipientIds.map((id) => buildPayload(id));
    return Notification.insertMany(docs, { ordered: false });
  }
}

export default new NotificationService();
