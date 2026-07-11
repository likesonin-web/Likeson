// services/message.service.js

import sanitizeHtml from 'sanitize-html';
import { emitToTicket } from '../utils/socketEmit.util.js';
import SupportMessage from '../models/SupportMessage.js';
import SupportTicket from '../models/SupportTicket.js';
import SupportParticipant from '../models/SupportParticipant.js';
 
import { recordTimelineEvent } from './timeline.service.js';
import { recordFirstResponse } from './sla.service.js';
import { recordAudit } from '../utils/auditIntegration.util.js';
import { notifySupportEvent } from '../utils/notificationIntegration.util.js';
import { checkMessageRateLimit } from '../utils/supportRedis.util.js';
import { canEditMessage, canCreateInternalNote, isStaff } from '../utils/supportPermissions.util.js';
import { NotFoundError, ForbiddenError, RateLimitError } from '../utils/errors.js';
import { buildCursorFilter, buildPageResult } from '../utils/cursorPagination.js';
import { MESSAGE_RATE_LIMIT } from '../constants/support.constants.js';

// Strip ALL HTML/script content from message text — chat text is rendered
// as plain text client-side, never as HTML, so the safe default is to allow
// nothing at all rather than trying to allow-list "safe" tags.
function sanitizeText(text) {
  return sanitizeHtml(text ?? '', { allowedTags: [], allowedAttributes: {} }).trim();
}

/**
 * Resolves @role mentions (e.g. "finance", "admin") to the actual userIds
 * of currently ACTIVE participants holding that platform role on this
 * ticket. Mentioning a role with no matching active participant is not an
 * error — it simply resolves to zero recipients for that token.
 */
/**
 * Resolves @tokens to actual userIds of currently ACTIVE participants on
 * this ticket. A token matches either:
 *   - a platform role (e.g. "finance", "admin") — mentions everyone active
 *     in that role, or
 *   - a specific participant's display name with spaces stripped (e.g.
 *     "@JohnSmith" for "John Smith") — the token inserted by the frontend's
 *     mention-autocomplete dropdown when a person is selected by name.
 * A token with no match (role or name) simply resolves to zero recipients
 * for that token — not an error.
 */
async function resolveMentions(ticketId, mentionTokens) {
  if (!mentionTokens?.length) return { userIds: [], roles: [] };

  const participants = await SupportParticipant.find({ ticket: ticketId, active: true })
    .populate('userId', 'role name')
    .lean();

  const lowerTokens = mentionTokens.map((t) => t.toLowerCase());
  const nameTokenOf = (name) => (name || '').replace(/\s+/g, '').toLowerCase();

  const roleMatches = participants.filter((p) => p.userId?.role && lowerTokens.includes(p.userId.role.toLowerCase()));
  const nameMatches = participants.filter((p) => lowerTokens.includes(nameTokenOf(p.userId?.name)));

  const matched = [...roleMatches, ...nameMatches];
  const uniqueUserIds = [...new Map(matched.map((p) => [String(p.userId._id), p.userId._id])).values()];

  return {
    userIds: uniqueUserIds,
    roles: [...new Set(roleMatches.map((p) => p.userId.role))],
  };
}

/**
 * Populates the fields the frontend needs to render a message immediately
 * (sender name/avatar for the bubble header, and a nested populate on
 * replyTo.sender so the WhatsApp-style quoted-reply preview has both the
 * quoted text AND the original sender's name without a refetch).
 * Used before every socket emit and every direct API response involving a
 * message — send, edit, delete, react — so no path can leak a bare
 * unpopulated ObjectId to the client.
 */
async function populateMessage(message) {
  return message.populate([
    { path: 'sender', select: 'name role avatar' },
    {
      path: 'replyTo',
      select: 'text messageType sender isDeleted',
      populate: { path: 'sender', select: 'name role avatar' },
    },
  ]);
}

export async function sendMessage({ ticketId, actor, deviceInfo, payload, io }) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new NotFoundError('Ticket');

  const isParticipant = await SupportParticipant.exists({ ticket: ticketId, userId: actor._id, active: true });
  const isOwner = String(ticket.createdBy) === String(actor._id);
  if (!isParticipant && !isOwner && !isStaff(actor.role)) {
    throw new ForbiddenError('You are not a participant on this ticket.');
  }

  const rateCheck = await checkMessageRateLimit(actor._id, ticketId, MESSAGE_RATE_LIMIT);
  if (!rateCheck.allowed) {
    throw new RateLimitError('You are sending messages too quickly. Please slow down.');
  }

  const isInternalNote = payload.isInternalNote === true;
  if (isInternalNote && !canCreateInternalNote(actor.role)) {
    throw new ForbiddenError('Only staff can add internal notes.');
  }

  const cleanText = payload.messageType === 'text' || payload.text ? sanitizeText(payload.text) : '';

  const { userIds: mentionIds, roles: mentionRoles } = await resolveMentions(ticketId, payload.mentions);

  // Snapshot active participants NOW for receipt tracking — a participant
  // who joins later gets their own receipt row created lazily on first
  // read rather than backfilling every historical message.
  const activeParticipants = await SupportParticipant.find({ ticket: ticketId, active: true }).select('userId').lean();
  const receipts = activeParticipants
    .filter((p) => String(p.userId) !== String(actor._id))
    .map((p) => ({ userId: p.userId, deliveredAt: null, readAt: null }));

  const [message] = await SupportMessage.create([
    {
      ticket: ticketId,
      sender: actor._id,
      senderRole: actor.role,
      messageType: payload.messageType,
      text: cleanText,
      attachment: payload.attachment ?? null,
      replyTo: payload.replyTo ?? null,
      mentions: mentionIds,
      mentionRoles,
      isInternalNote,
      status: 'sent',
      receipts,
      clientMessageId: payload.clientMessageId ?? null,
    },
  ]);

  await SupportTicket.updateOne(
    { _id: ticketId },
    {
      $set: {
        lastMessageAt: message.createdAt,
        lastMessagePreview: cleanText.slice(0, 200) || `[${payload.messageType}]`,
      },
    }
  );

  // First staff reply stops the first-response SLA clock.
  if (isStaff(actor.role) && !isInternalNote) {
    await recordFirstResponse(ticketId, message.createdAt);
  }

  // Waiting-state auto-transition: customer message while ticket is
  // waiting_customer -> in_progress; staff message while waiting_partner
  // stays as-is (partners reply drives that transition, not staff).
  if (ticket.status === 'waiting_customer' && String(actor._id) === String(ticket.createdBy)) {
    ticket.status = 'in_progress';
    ticket.updatedBy = actor._id;
    await ticket.save();
    await recordTimelineEvent({
      ticketId,
      event: 'status_changed',
      actor: actor._id,
      actorRole: actor.role,
      summary: 'Customer replied — status moved to In Progress',
      metadata: { from: 'waiting_customer', to: 'in_progress' },
    });
  }

  await recordAudit({
    action: 'message_sent',
    actorId: actor._id,
    targetType: 'SupportMessage',
    targetId: message._id,
    ticketId,
    after: { messageType: message.messageType, isInternalNote },
    deviceInfo,
  });

  await populateMessage(message);

  if (io) {
    emitToTicket(io, ticketId, 'support:message_receive', serializeMessage(message));
  }

  if (mentionIds.length > 0) {
    await notifySupportEvent('mention', mentionIds, ticket, { io, body: cleanText.slice(0, 200) });
  }
  const notifyRecipients = activeParticipants
    .map((p) => p.userId)
    .filter((id) => String(id) !== String(actor._id) && !mentionIds.some((m) => String(m) === String(id)));
  if (!isInternalNote && notifyRecipients.length > 0) {
    await notifySupportEvent('new_message', notifyRecipients, ticket, { io, body: cleanText.slice(0, 200) });
  }

  return message;
}

export async function editMessage({ ticketId, messageId, actor, deviceInfo, text, io }) {
  if (!canEditMessage(actor.role)) {
    throw new ForbiddenError('Only Admin or Superadmin can edit messages.');
  }

  const message = await SupportMessage.findOne({ _id: messageId, ticket: ticketId });
  if (!message || message.isDeleted) throw new NotFoundError('Message');

  const cleanText = sanitizeText(text);

  message.editHistory.push({ previousText: message.text, editedBy: actor._id });
  message.text = cleanText;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  await recordAudit({
    action: 'message_edited',
    actorId: actor._id,
    targetType: 'SupportMessage',
    targetId: message._id,
    ticketId,
    before: { text: message.editHistory[message.editHistory.length - 1].previousText },
    after: { text: cleanText },
    deviceInfo,
  });

  await populateMessage(message);

  if (io) {
    emitToTicket(io, ticketId, 'support:message_edit', serializeMessage(message));
  }

  return message;
}

export async function deleteMessage({ ticketId, messageId, actor, deviceInfo, reason, io }) {
  const message = await SupportMessage.findOne({ _id: messageId, ticket: ticketId });
  if (!message) throw new NotFoundError('Message');

  const isOwnMessage = String(message.sender) === String(actor._id);
  if (!isOwnMessage && !isStaff(actor.role)) {
    throw new ForbiddenError('You can only delete your own messages.');
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  message.deletedBy = actor._id;
  await message.save();

  await recordAudit({
    action: 'message_deleted',
    actorId: actor._id,
    targetType: 'SupportMessage',
    targetId: message._id,
    ticketId,
    before: { reason: reason ?? null },
    deviceInfo,
  });

  await populateMessage(message);

  if (io) {
    emitToTicket(io, ticketId, 'support:message_delete', serializeMessage(message));
  }

  return message;
}

export async function reactToMessage({ ticketId, messageId, actor, emoji, io }) {
  const message = await SupportMessage.findOne({ _id: messageId, ticket: ticketId });
  if (!message) throw new NotFoundError('Message');

  const existingIdx = message.reactions.findIndex((r) => String(r.userId) === String(actor._id) && r.emoji === emoji);
  if (existingIdx >= 0) {
    message.reactions.splice(existingIdx, 1); // toggle off
  } else {
    message.reactions.push({ userId: actor._id, emoji });
  }
  await message.save();

  await populateMessage(message);

  if (io) {
    emitToTicket(io, ticketId, 'support:message_react', serializeMessage(message));
  }

  return message;
}

export async function markDelivered({ ticketId, userId, messageIds }) {
  await SupportMessage.updateMany(
    { ticket: ticketId, _id: { $in: messageIds }, 'receipts.userId': userId, 'receipts.deliveredAt': null },
    { $set: { 'receipts.$.deliveredAt': new Date() } }
  );
  // Advance the single-tick -> double-tick(grey) status too. Never touches
  // a message that's already 'read' — read is a superset of delivered.
  await SupportMessage.updateMany(
    { ticket: ticketId, _id: { $in: messageIds }, status: 'sent' },
    { $set: { status: 'delivered' } }
  );
}

export async function markRead({ ticketId, userId, upToMessageId }) {
  const upToMessage = await SupportMessage.findById(upToMessageId).select('createdAt').lean();
  if (!upToMessage) throw new NotFoundError('Message');

  await SupportMessage.updateMany(
    {
      ticket: ticketId,
      createdAt: { $lte: upToMessage.createdAt },
      'receipts.userId': userId,
      'receipts.readAt': null,
    },
    { $set: { 'receipts.$.readAt': new Date(), status: 'read' } }
  );
}

export async function listMessages({ ticketId, actor, query }) {
  const filter = { ticket: ticketId, isDeleted: false };

  if (!isStaff(actor.role)) {
    filter.isInternalNote = false;
  }

  if (query.cursor) {
    Object.assign(filter, buildCursorFilter(query.cursor, query.direction || 'before'));
  }

  const limit = query.limit || 30;
  const sortDir = query.direction === 'after' ? 1 : -1;

  const docs = await SupportMessage.find(filter)
    .sort({ createdAt: sortDir, _id: sortDir })
    .limit(limit + 1)
    .populate('sender', 'name role avatar')
    .populate('replyTo', 'text messageType sender')
    .lean();

  return buildPageResult(docs, limit);
}

export function serializeMessage(message) {
  const obj = message.toObject ? message.toObject() : message;
  return {
    _id: obj._id,
    ticket: obj.ticket,
    sender: obj.sender,
    senderRole: obj.senderRole,
    messageType: obj.messageType,
    text: obj.text,
    attachment: obj.attachment,
    replyTo: obj.replyTo,
    mentions: obj.mentions,
    isInternalNote: obj.isInternalNote,
    status: obj.status,
    isEdited: obj.isEdited,
    isDeleted: obj.isDeleted,
    reactions: obj.reactions,
    receipts: obj.receipts,
    createdAt: obj.createdAt,
    // Required for sender-side optimistic-UI dedupe (chatSlice.receiveMessage
    // matches on this). Without it, the socket echo can't find and remove
    // the temp bubble, producing a duplicate message on the sender's own screen.
    clientMessageId: obj.clientMessageId ?? null,
  };
}