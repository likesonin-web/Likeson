// services/ticket.service.js

import mongoose from 'mongoose';
import { emitToTicket } from '../utils/socketEmit.util.js';
import SupportTicket from '../models/SupportTicket.js';
import SupportParticipant from '../models/SupportParticipant.js';
import SupportRating from '../models/SupportRating.js';
import User from '../models/User.js'; // existing shared model
import {
  TICKET_STATUS_TRANSITIONS,
  STAFF_ROLES,
  DEFAULT_PAGE_SIZE,
} from '../constants/support.constants.js';
import { recordTimelineEvent } from './timeline.service.js';
import { initializeSLA, recordResolution, rebaselineOnPriorityChange } from './sla.service.js';
import { recordAudit } from '../utils/auditIntegration.util.js';
import { notifySupportEvent } from '../utils/notificationIntegration.util.js';
import { checkTicketCreateRateLimit } from '../utils/supportRedis.util.js';
import {
  NotFoundError,
  ForbiddenError,
  InvalidStatusTransitionError,
  RateLimitError,
} from '../utils/errors.js';
import {
  assertCanViewTicket,
  assertCanChangeStatus,
  canChangePriority,
  canCustomerCloseOwnTicket,
} from '../utils/supportPermissions.util.js';
import { buildCursorFilter, buildPageResult } from '../utils/cursorPagination.js';
import { TICKET_CREATE_RATE_LIMIT } from '../constants/support.constants.js';

/**
 * Creates a ticket end-to-end inside a single Mongo transaction:
 * ticket doc + creator participant row + SLA record + timeline 'created'
 * event + audit record. Notification is fired AFTER commit (never inside
 * the transaction — a Notification write failure must not roll back a
 * successful ticket creation).
 */
export async function createTicket({ actor, deviceInfo, payload }) {
  const rateCheck = await checkTicketCreateRateLimit(actor._id, TICKET_CREATE_RATE_LIMIT);
  if (!rateCheck.allowed) {
    throw new RateLimitError('Too many tickets created recently. Please try again later.');
  }

  const session = await mongoose.startSession();
  let ticket;

  try {
    await session.withTransaction(async () => {
      // Visibility: creator + all current STAFF_ROLES holders (spec —
      // "Initially visible ONLY to Admin, Superadmin"; Finance is staff but
      // NOT part of default ticket visibility per spec's explicit list, so
      // excluded here even though it's in STAFF_ROLES for other purposes).
      const initialStaff = await User.find({ role: { $in: ['admin', 'superadmin'] } })
        .select('_id')
        .session(session)
        .lean();

      const visibleTo = [actor._id, ...initialStaff.map((u) => u._id)];

      const [created] = await SupportTicket.create(
        [
          {
            ticketType: payload.ticketType,
            subject: payload.subject,
            description: payload.description,
            priority: payload.priority,
            booking: payload.booking,
            metadata: payload.metadata,
            createdBy: actor._id,
            createdByRole: actor.role,
            visibleTo,
            contactSnapshot: { phone: actor.phone, email: actor.email, name: actor.name },
            attachments: (payload.attachments || []).map((a) => ({
              url: a.url,
              fileType: a.fileType,
              uploadedAt: new Date(),
            })),
          },
        ],
        { session }
      );
      ticket = created;

      await SupportParticipant.create(
        [
          {
            ticket: ticket._id,
            userId: actor._id,
            role: 'customer',
            joinedBy: actor._id,
          },
        ],
        { session }
      );

      // Staff participants are NOT auto-added as SupportParticipant rows —
      // staff see the ticket via the STAFF_ROLES visibility rule, and only
      // become participants once they actually engage (join_ticket socket
      // event adds the row). Keeps the participants collection reflecting
      // "who is actually in the conversation", not "who theoretically can see it".

      await initializeSLA({ ticketId: ticket._id, priority: ticket.priority, createdAt: ticket.createdAt, session });

      await recordTimelineEvent({
        ticketId: ticket._id,
        event: 'created',
        actor: actor._id,
        actorRole: actor.role,
        summary: `Ticket created by ${actor.name}`,
        session,
      });

      await recordAudit({
        action: 'ticket_created',
        actorId: actor._id,
        targetType: 'SupportTicket',
        targetId: ticket._id,
        ticketId: ticket._id,
        after: { ticketType: ticket.ticketType, priority: ticket.priority, status: ticket.status },
        deviceInfo,
      });
    });
  } finally {
    await session.endSession();
  }

  // Post-commit notification to staff.
  const staffRecipients = (await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id').lean()).map(
    (u) => u._id
  );
  await notifySupportEvent('new_message', staffRecipients, ticket, {
    title: `New ${ticket.ticketType.replace(/_/g, ' ')} ticket: ${ticket.ticketNumber}`,
  });

  return ticket;
}

export async function getTicketById({ ticketId, actor }) {
  const ticket = await SupportTicket.findById(ticketId).lean();
  if (!ticket) throw new NotFoundError('Ticket');

  const isActiveParticipant = await SupportParticipant.exists({
    ticket: ticketId,
    userId: actor._id,
    active: true,
  });

  assertCanViewTicket({
    userRole: actor.role,
    userId: actor._id,
    ticket,
    isActiveParticipant: !!isActiveParticipant,
  });

  return ticket;
}

/**
 * Cursor-paginated, filterable, searchable ticket listing. Query shape is
 * pre-validated by listTicketsQuerySchema (Joi) before this ever runs.
 */
export async function listTickets({ actor, query }) {
  const filter = {};

  // Scope: staff see everything they're permitted to (visibleTo already
  // includes them); non-staff only see tickets they created or participate in.
  if (!STAFF_ROLES.includes(actor.role) || actor.role === 'finance') {
    filter.visibleTo = actor._id;
  }

  if (query.status) filter.status = Array.isArray(query.status) ? { $in: query.status } : query.status;
  if (query.priority) filter.priority = Array.isArray(query.priority) ? { $in: query.priority } : query.priority;
  if (query.ticketType) filter.ticketType = query.ticketType;
  if (query.ticketNumber) filter.ticketNumber = query.ticketNumber;
  if (query.booking) filter.booking = query.booking;
  if (query.customer) filter.createdBy = query.customer;
  if (query.assignee) filter['currentAssignees.userId'] = query.assignee;
  if (query.department) filter['currentAssignees.department'] = query.department;

  if (query.dateFrom || query.dateTo) {
    filter.createdAt = {};
    if (query.dateFrom) filter.createdAt.$gte = new Date(query.dateFrom);
    if (query.dateTo) filter.createdAt.$lte = new Date(query.dateTo);
  }

  if (query.search) {
    filter.$or = [
      { $text: { $search: query.search } },
      { ticketNumber: query.search },
      { 'contactSnapshot.phone': query.search },
      { 'contactSnapshot.email': query.search.toLowerCase() },
      { 'metadata.transactionId': query.search },
    ];
  }

  const limit = query.limit || DEFAULT_PAGE_SIZE;

  if (query.cursor) {
    Object.assign(filter, buildCursorFilter(query.cursor, 'before'));
  }

  const docs = await SupportTicket.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .select('-description') // list view doesn't need the full body
    .lean();

  return buildPageResult(docs, limit);
}

export async function updateTicket({ ticketId, actor, deviceInfo, updates }) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new NotFoundError('Ticket');

  const isOwner = String(ticket.createdBy) === String(actor._id);
  if (!STAFF_ROLES.includes(actor.role) && !isOwner) {
    throw new ForbiddenError('Only the ticket creator or staff can edit this ticket.');
  }

  const before = { subject: ticket.subject, description: ticket.description, priority: ticket.priority };

  if (updates.subject !== undefined) ticket.subject = updates.subject;
  if (updates.description !== undefined) ticket.description = updates.description;
  if (updates.metadata !== undefined) ticket.metadata = { ...ticket.metadata, ...updates.metadata };

  if (updates.priority !== undefined && updates.priority !== ticket.priority) {
    if (!canChangePriority(actor.role)) throw new ForbiddenError('Only staff can change priority.');
    const fromPriority = ticket.priority;
    ticket.priority = updates.priority;
    await rebaselineOnPriorityChange({ ticketId, fromPriority, toPriority: updates.priority });
    await recordTimelineEvent({
      ticketId,
      event: 'priority_changed',
      actor: actor._id,
      actorRole: actor.role,
      summary: `Priority changed from ${fromPriority} to ${updates.priority}`,
      metadata: { from: fromPriority, to: updates.priority },
    });
  }

  ticket.updatedBy = actor._id;
  await ticket.save();

  await recordAudit({
    action: 'ticket_status_changed', // reused generic action for field edits; see SUPPORT_AUDIT_ACTIONS
    actorId: actor._id,
    targetType: 'SupportTicket',
    targetId: ticket._id,
    ticketId: ticket._id,
    before,
    after: { subject: ticket.subject, description: ticket.description, priority: ticket.priority },
    deviceInfo,
  });

  return ticket;
}

export async function changeStatus({ ticketId, actor, deviceInfo, status, reason, io }) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new NotFoundError('Ticket');

  const isCustomerClosing = status === 'closed' && canCustomerCloseOwnTicket({ userRole: actor.role, userId: actor._id, ticket });
  if (!isCustomerClosing) {
    assertCanChangeStatus(actor.role);
  }

  const from = ticket.status;
  const allowedNext = TICKET_STATUS_TRANSITIONS[from] || [];
  if (!allowedNext.includes(status)) {
    throw new InvalidStatusTransitionError(from, status);
  }

  ticket.status = status;
  ticket.updatedBy = actor._id;
  await ticket.save();

  if (status === 'resolved') {
    await recordResolution(ticketId);
  }

  await recordTimelineEvent({
    ticketId,
    event: status === 'closed' ? 'closed' : status === 'resolved' ? 'resolved' : status === 'escalated' ? 'escalated' : 'status_changed',
    actor: actor._id,
    actorRole: actor.role,
    summary: reason || `Status changed from ${from} to ${status}`,
    metadata: { from, to: status, reason: reason || null },
  });

  await recordAudit({
    action: 'ticket_status_changed',
    actorId: actor._id,
    targetType: 'SupportTicket',
    targetId: ticket._id,
    ticketId: ticket._id,
    before: { status: from },
    after: { status },
    deviceInfo,
  });

  const recipients = [ticket.createdBy, ...(ticket.currentAssignees || []).map((a) => a.userId)].filter(
    (id) => String(id) !== String(actor._id)
  );
  await notifySupportEvent(status === 'closed' ? 'ticket_closed' : 'status_change', recipients, ticket, { io });

  if (io) {
    emitToTicket(io, ticketId, 'support:status_changed', { ticketId, status, from, changedBy: actor._id });
  }

  return ticket;
}

export async function rateTicket({ ticketId, actor, rating, comment }) {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new NotFoundError('Ticket');
  if (String(ticket.createdBy) !== String(actor._id)) {
    throw new ForbiddenError('Only the ticket creator can rate this ticket.');
  }
  if (ticket.status !== 'resolved') {
    throw new ForbiddenError('Ticket must be resolved before it can be rated.');
  }

  const [ratingDoc] = await SupportRating.create([
    {
      ticket: ticketId,
      ratedBy: actor._id,
      rating,
      comment,
      resolvedByAtRatingTime: (ticket.currentAssignees || []).map((a) => ({ userId: a.userId, role: a.role })),
    },
  ]);

  ticket.rating = ratingDoc._id;
  ticket.status = 'closed';
  ticket.closedAt = new Date();
  await ticket.save();

  await recordTimelineEvent({
    ticketId,
    event: 'closed',
    actor: actor._id,
    actorRole: actor.role,
    summary: `Customer rated ${rating}/5 and closed the ticket`,
  });

  return ratingDoc;
}