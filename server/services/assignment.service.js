// services/assignment.service.js

import mongoose from 'mongoose';
import SupportTicket from '../models/SupportTicket.js';
import SupportAssignmentHistory from '../models/SupportAssignmentHistory.js';
import SupportParticipant from '../models/SupportParticipant.js';
import { assertCanAssignTicket } from '../utils/supportPermissions.util.js';
import { recordTimelineEvent } from './timeline.service.js';
import { recordAudit } from '../utils/auditIntegration.util.js';
import { notifySupportEvent } from '../utils/notificationIntegration.util.js';
import { acquireLock, releaseLock } from '../utils/supportRedis.util.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { MAX_PARTICIPANTS_PER_TICKET } from '../constants/support.constants.js';

/**
 * Assigns (or reassigns) a ticket to one or more users/departments/partners.
 * Never overwrites — every call appends a new SupportAssignmentHistory row;
 * SupportTicket.currentAssignees is then REBUILT (not merged) from the
 * union of the new assignees, matching "assign multiple users, multiple
 * departments, multiple partners" without silently dropping a prior
 * assignee unless explicitly removed by the caller.
 *
 * A short Redis lock guards against two admins assigning the same ticket
 * in the same instant producing two conflicting "current" states.
 */
export async function assignTicket({ ticketId, actor, deviceInfo, assignees, note, io }) {
  assertCanAssignTicket(actor.role);

  const lockKey = `assign:${ticketId}`;
  const lockToken = await acquireLock(lockKey, 5000);
  if (!lockToken) {
    throw new ConflictError('Another assignment is in progress for this ticket. Please retry.');
  }

  try {
    const session = await mongoose.startSession();
    let ticket;

    try {
      await session.withTransaction(async () => {
        ticket = await SupportTicket.findById(ticketId).session(session);
        if (!ticket) throw new NotFoundError('Ticket');

        const previousAssignees = ticket.currentAssignees.map((a) => ({
          userId: a.userId,
          role: a.role,
          department: a.department,
        }));

        const action = previousAssignees.length === 0 ? 'assigned' : 'reassigned';

        await SupportAssignmentHistory.create(
          [
            {
              ticket: ticketId,
              action,
              assignees,
              previousAssignees,
              performedBy: actor._id,
              performedByRole: actor.role,
              note,
            },
          ],
          { session }
        );

        ticket.currentAssignees = assignees.map((a) => ({
          userId: a.userId,
          role: a.role,
          department: a.department,
          assignedAt: new Date(),
        }));

        if (!ticket.firstAssignedAt) ticket.firstAssignedAt = new Date();
        if (ticket.status === 'open') ticket.status = 'assigned';
        ticket.updatedBy = actor._id;
        await ticket.save({ session });

        // Grant visibility to every newly assigned userId (partners were
        // NOT in visibleTo before — spec: "Partners do NOT see tickets
        // automatically. Admin decides when to assign partner.")
        const newIds = assignees.map((a) => String(a.userId));
        const alreadyVisible = new Set(ticket.visibleTo.map(String));
        const toAdd = newIds.filter((id) => !alreadyVisible.has(id));
        if (toAdd.length > 0) {
          await SupportTicket.updateOne(
            { _id: ticketId },
            { $addToSet: { visibleTo: { $each: toAdd } } },
            { session }
          );
        }

        // Ensure each assignee has an active SupportParticipant row so they
        // appear in the chat room immediately (cap enforced).
        const existingCount = await SupportParticipant.countDocuments({ ticket: ticketId, active: true }).session(session);
        if (existingCount + assignees.length > MAX_PARTICIPANTS_PER_TICKET) {
          throw new ConflictError('Maximum participant limit reached for this ticket.');
        }

        for (const a of assignees) {
          await SupportParticipant.findOneAndUpdate(
            { ticket: ticketId, userId: a.userId },
            {
              $setOnInsert: { role: a.role, joinedBy: actor._id, joinedAt: new Date() },
              $set: { active: true, leftAt: null },
            },
            { upsert: true, session }
          );
        }

        await recordTimelineEvent({
          ticketId,
          event: action === 'assigned' ? 'assigned' : 'transferred',
          actor: actor._id,
          actorRole: actor.role,
          summary: note || `${action === 'assigned' ? 'Assigned' : 'Reassigned'} to ${assignees.length} user(s)`,
          metadata: { assignees, previousAssignees },
          session,
        });

        await recordAudit({
          action: action === 'assigned' ? 'ticket_assigned' : 'ticket_reassigned',
          actorId: actor._id,
          targetType: 'SupportTicket',
          targetId: ticketId,
          ticketId,
          before: { assignees: previousAssignees },
          after: { assignees },
          deviceInfo,
        });
      });
    } finally {
      await session.endSession();
    }

    await notifySupportEvent(
      'assignment',
      assignees.map((a) => a.userId),
      ticket,
      { io }
    );

    if (io) {
      io.to(`ticket:${ticketId}`).emit('support:assignment', { ticketId, assignees });
    }

    return ticket;
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}

export async function getAssignmentHistory(ticketId, { limit = 50 } = {}) {
  return SupportAssignmentHistory.find({ ticket: ticketId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('performedBy', 'name role')
    .populate('assignees.userId', 'name role avatar')
    .lean();
}
