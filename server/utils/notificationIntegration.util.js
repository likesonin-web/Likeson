// utils/notificationIntegration.util.js
//
// Bridges support-module events onto the EXISTING Notification model
// (models/Notification.js). That schema's `type` enum does not currently
// include support-ticket event types — REQUIRED PATCH before this file can
// write successfully (same class of bug documented in Notification.js's own
// 'Normal' priority fix): add to Notification.js's `type` enum:
//
//   'Support_Ticket_Created', 'Support_New_Message', 'Support_Assignment',
//   'Support_Mention', 'Support_Status_Change', 'Support_Participant_Added',
//   'Support_Ticket_Closed', 'Support_Ticket_Reopened'
//
// and to `relatedEntityType` enum: 'SupportTicket'.
//
// This file is the ONLY place that constructs a Notification.create() call
// for support events — services never call Notification directly.

import Notification from '../models/Notification.js'; // existing shared model
import { SUPPORT_NOTIFICATION_EVENTS } from '../constants/support.constants.js';

const EVENT_TO_NOTIFICATION_TYPE = {
  new_message: 'Support_New_Message',
  assignment: 'Support_Assignment',
  mention: 'Support_Mention',
  status_change: 'Support_Status_Change',
  participant_added: 'Support_Participant_Added',
  ticket_closed: 'Support_Ticket_Closed',
  ticket_reopened: 'Support_Ticket_Reopened',
};

const EVENT_PRIORITY = {
  new_message: 'Medium',
  assignment: 'High',
  mention: 'High',
  status_change: 'Medium',
  participant_added: 'Low',
  ticket_closed: 'Medium',
  ticket_reopened: 'High',
};

/**
 * @param {string} event            one of SUPPORT_NOTIFICATION_EVENTS
 * @param {string[]} recipientIds   userIds to notify (excluding the actor)
 * @param {Object} ticket           lean ticket doc (needs _id, ticketNumber, subject)
 * @param {Object} [opts]
 * @param {string} [opts.title]
 * @param {string} [opts.body]
 * @param {import('socket.io').Server} [opts.io]  socket server for realtime push
 */
export async function notifySupportEvent(event, recipientIds, ticket, opts = {}) {
  if (!SUPPORT_NOTIFICATION_EVENTS.includes(event)) {
    throw new Error(`Unknown support notification event: ${event}`);
  }
  const uniqueRecipients = [...new Set((recipientIds || []).map(String))].filter(Boolean);
  if (uniqueRecipients.length === 0) return;

  const type = EVENT_TO_NOTIFICATION_TYPE[event];
  const priority = EVENT_PRIORITY[event] ?? 'Medium';
  const title = opts.title ?? defaultTitle(event, ticket);
  const body = opts.body ?? defaultBody(event, ticket);

  const docs = uniqueRecipients.map((recipient) => ({
    recipient,
    title,
    body,
    type,
    priority,
    relatedEntityType: 'SupportTicket',
    relatedEntityId: ticket._id,
    deepLink: { screen: 'SupportTicketDetail', referenceId: ticket._id },
    channels: [{ channel: 'InApp' }, { channel: 'Push' }],
  }));

  const created = await Notification.insertMany(docs, { ordered: false });

  // Realtime push over existing socket infra, if an io instance was supplied.
  if (opts.io) {
    for (const doc of created) {
      opts.io.to(`user:${doc.recipient}`).emit('notification:new', {
        id: doc._id,
        type: doc.type,
        title: doc.title,
        body: doc.body,
        ticketId: ticket._id,
        ticketNumber: ticket.ticketNumber,
        createdAt: doc.createdAt,
      });
    }
  }

  return created;
}

function defaultTitle(event, ticket) {
  const map = {
    new_message: `New message on ${ticket.ticketNumber}`,
    assignment: `Ticket ${ticket.ticketNumber} assigned to you`,
    mention: `You were mentioned on ${ticket.ticketNumber}`,
    status_change: `${ticket.ticketNumber} status updated`,
    participant_added: `Added to ticket ${ticket.ticketNumber}`,
    ticket_closed: `Ticket ${ticket.ticketNumber} closed`,
    ticket_reopened: `Ticket ${ticket.ticketNumber} reopened`,
  };
  return map[event];
}

function defaultBody(event, ticket) {
  return ticket.subject ? `"${ticket.subject}"` : `Ticket ${ticket.ticketNumber}`;
}
