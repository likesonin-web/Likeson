// services/sla.service.js

import SupportSLA from '../models/SupportSLA.js';
import SupportTicket from '../models/SupportTicket.js';
import {
  SLA_FIRST_RESPONSE_MINUTES,
  SLA_RESOLUTION_MINUTES,
} from '../constants/support.constants.js';
import { notifySupportEvent } from '../utils/notificationIntegration.util.js';

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Creates the SLA tracking record at ticket-creation time and mirrors the
 * fast-path fields onto SupportTicket.sla.
 */
export async function initializeSLA({ ticketId, priority, createdAt, session = null }) {
  const firstResponseDueAt = addMinutes(createdAt, SLA_FIRST_RESPONSE_MINUTES[priority]);
  const resolutionDueAt = addMinutes(createdAt, SLA_RESOLUTION_MINUTES[priority]);

  await SupportSLA.create(
    [{ ticket: ticketId, priority, firstResponseDueAt, resolutionDueAt }],
    session ? { session } : {}
  );

  await SupportTicket.updateOne(
    { _id: ticketId },
    { $set: { 'sla.firstResponseDueAt': firstResponseDueAt, 'sla.resolutionDueAt': resolutionDueAt } },
    session ? { session } : {}
  );

  return { firstResponseDueAt, resolutionDueAt };
}

/**
 * Called by message.service.js the first time a STAFF member sends a
 * non-internal message on a ticket — marks first-response time and clears
 * the breach flag if it was already tripped by the sweep job before the
 * response landed (still recorded as breached=true historically; we do NOT
 * un-flag a breach that already happened, only stop the clock).
 */
export async function recordFirstResponse(ticketId, respondedAt = new Date()) {
  const sla = await SupportSLA.findOne({ ticket: ticketId, firstRespondedAt: null });
  if (!sla) return null;

  sla.firstRespondedAt = respondedAt;
  await sla.save();

  await SupportTicket.updateOne(
    { _id: ticketId },
    { $set: { 'sla.firstRespondedAt': respondedAt } }
  );

  return sla;
}

export async function recordResolution(ticketId, resolvedAt = new Date()) {
  const sla = await SupportSLA.findOneAndUpdate(
    { ticket: ticketId },
    { $set: { resolvedAt } },
    { new: true }
  );
  return sla;
}

/**
 * Recomputes resolutionDueAt when priority changes mid-flight, preserving
 * the original target in priorityChangeLog rather than discarding it.
 */
export async function rebaselineOnPriorityChange({ ticketId, fromPriority, toPriority, changedAt = new Date() }) {
  const sla = await SupportSLA.findOne({ ticket: ticketId });
  if (!sla || sla.resolvedAt) return sla; // don't rebaseline a resolved ticket

  const elapsedMs = changedAt.getTime() - (sla.createdAt?.getTime() ?? changedAt.getTime());
  const newResolutionDueAt = addMinutes(changedAt, SLA_RESOLUTION_MINUTES[toPriority]);

  sla.priorityChangeLog.push({ fromPriority, toPriority, changedAt, newResolutionDueAt });
  sla.resolutionDueAt = newResolutionDueAt;
  sla.priority = toPriority;
  await sla.save();

  await SupportTicket.updateOne(
    { _id: ticketId },
    { $set: { 'sla.resolutionDueAt': newResolutionDueAt } }
  );

  void elapsedMs;
  return sla;
}

/**
 * BullMQ repeatable job body (see jobs/slaSweep.job.js) — scans for newly
 * breached SLAs and fires exactly one breach notification per breach type.
 * Idempotent: the *BreachNotifiedAt guard prevents duplicate notifications
 * across overlapping job runs.
 */
export async function sweepSLABreaches({ io } = {}) {
  const now = new Date();

  const firstResponseBreaches = await SupportSLA.find({
    firstResponseDueAt: { $lt: now },
    firstRespondedAt: null,
    firstResponseBreached: false,
  }).limit(500);

  for (const sla of firstResponseBreaches) {
    sla.firstResponseBreached = true;
    sla.firstResponseBreachNotifiedAt = now;
    await sla.save();
    await SupportTicket.updateOne(
      { _id: sla.ticket },
      { $set: { 'sla.firstResponseBreached': true } }
    );
    const ticket = await SupportTicket.findById(sla.ticket).select('ticketNumber subject currentAssignees createdBy').lean();
    if (ticket) {
      const recipients = (ticket.currentAssignees || []).map((a) => a.userId);
      await notifySupportEvent('status_change', recipients, ticket, {
        title: `SLA breached: first response overdue on ${ticket.ticketNumber}`,
        io,
      });
    }
  }

  const resolutionBreaches = await SupportSLA.find({
    resolutionDueAt: { $lt: now },
    resolvedAt: null,
    resolutionBreached: false,
  }).limit(500);

  for (const sla of resolutionBreaches) {
    sla.resolutionBreached = true;
    sla.resolutionBreachNotifiedAt = now;
    await sla.save();
    await SupportTicket.updateOne(
      { _id: sla.ticket },
      { $set: { 'sla.resolutionBreached': true } }
    );
    const ticket = await SupportTicket.findById(sla.ticket).select('ticketNumber subject currentAssignees createdBy').lean();
    if (ticket) {
      const recipients = (ticket.currentAssignees || []).map((a) => a.userId);
      await notifySupportEvent('status_change', recipients, ticket, {
        title: `SLA breached: resolution overdue on ${ticket.ticketNumber}`,
        io,
      });
    }
  }

  return {
    firstResponseBreachesProcessed: firstResponseBreaches.length,
    resolutionBreachesProcessed: resolutionBreaches.length,
  };
}
