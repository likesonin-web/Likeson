// services/participant.service.js

import SupportParticipant from '../models/SupportParticipant.js';
import { emitToTicket } from '../utils/socketEmit.util.js';
import SupportTicket from '../models/SupportTicket.js';
import { recordTimelineEvent } from './timeline.service.js';
import { recordAudit } from '../utils/auditIntegration.util.js';
import { notifySupportEvent } from '../utils/notificationIntegration.util.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { MAX_PARTICIPANTS_PER_TICKET } from '../constants/support.constants.js';

export async function addParticipant({ ticketId, actor, deviceInfo, userId, role, io }) {
  const ticket = await SupportTicket.findById(ticketId).lean();
  if (!ticket) throw new NotFoundError('Ticket');

  const existingCount = await SupportParticipant.countDocuments({ ticket: ticketId, active: true });
  if (existingCount >= MAX_PARTICIPANTS_PER_TICKET) {
    throw new ConflictError(`Ticket has reached the maximum of ${MAX_PARTICIPANTS_PER_TICKET} participants.`);
  }

  const participant = await SupportParticipant.findOneAndUpdate(
    { ticket: ticketId, userId },
    { $setOnInsert: { role, joinedBy: actor._id, joinedAt: new Date() }, $set: { active: true, leftAt: null } },
    { upsert: true, new: true }
  );

  await SupportTicket.updateOne({ _id: ticketId }, { $addToSet: { visibleTo: userId } });

  await recordTimelineEvent({
    ticketId,
    event: 'participant_joined',
    actor: actor._id,
    actorRole: actor.role,
    summary: `${role} added to conversation`,
    metadata: { userId, role },
  });

  await recordAudit({
    action: 'participant_added',
    actorId: actor._id,
    targetType: 'SupportTicket',
    targetId: ticketId,
    ticketId,
    after: { userId, role },
    deviceInfo,
  });

  await notifySupportEvent('participant_added', [userId], ticket, { io });

  if (io) {
    emitToTicket(io, ticketId, 'support:participant_joined', { ticketId, userId, role });
  }

  return participant;
}

export async function removeParticipant({ ticketId, actor, deviceInfo, userId, reason, io }) {
  const participant = await SupportParticipant.findOneAndUpdate(
    { ticket: ticketId, userId, active: true },
    { $set: { active: false, leftAt: new Date() } },
    { new: true }
  );
  if (!participant) throw new NotFoundError('Active participant');

  await recordTimelineEvent({
    ticketId,
    event: 'participant_left',
    actor: actor._id,
    actorRole: actor.role,
    summary: reason || `${participant.role} removed from conversation`,
    metadata: { userId, reason: reason || null },
  });

  await recordAudit({
    action: 'participant_removed',
    actorId: actor._id,
    targetType: 'SupportTicket',
    targetId: ticketId,
    ticketId,
    before: { userId, role: participant.role },
    deviceInfo,
  });

  if (io) {
    emitToTicket(io, ticketId, 'support:participant_left', { ticketId, userId });
  }

  return participant;
}

export async function listParticipants(ticketId) {
  return SupportParticipant.find({ ticket: ticketId, active: true })
    .populate('userId', 'name role avatar isOnline lastseen')
    .sort({ joinedAt: 1 })
    .lean();
}

export async function isActiveParticipant(ticketId, userId) {
  return !!(await SupportParticipant.exists({ ticket: ticketId, userId, active: true }));
}

/**
 * Marks all messages up to and including `upToMessageId` as read for this
 * participant. Called from the socket 'read' event handler.
 */
export async function markRead({ ticketId, userId, upToMessageId }) {
  await SupportParticipant.updateOne(
    { ticket: ticketId, userId },
    { $set: { lastReadMessage: upToMessageId, lastReadAt: new Date() } }
  );
}

export async function touchLastSeen({ ticketId, userId }) {
  await SupportParticipant.updateOne({ ticket: ticketId, userId }, { $set: { lastSeen: new Date() } });
}

export async function setTypingState({ ticketId, userId, isTyping }) {
  await SupportParticipant.updateOne(
    { ticket: ticketId, userId },
    { $set: { isTyping, typingUpdatedAt: new Date() } }
  );
}