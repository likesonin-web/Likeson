// support-module/utils/auditLogger.js
import AuditLog from '../models/AuditLog.js';
import TicketTimeline from '../models/TicketTimeline.js';

/**
 * recordAudit — writes an immutable AuditLog row. Never throws to caller;
 * a logging failure must not roll back the primary business transaction,
 * but IS logged loudly to stderr for ops alerting.
 */
export const recordAudit = async ({
  action, entityType, entityId, ticket = null, performedBy = null,
  performedByRole = 'system', before = null, after = null, req = null, note = '',
}) => {
  try {
    await AuditLog.create({
      action, entityType, entityId, ticket, performedBy, performedByRole,
      before, after, note,
      ipAddress: req?.deviceInfo?.ipAddress || req?.ip || null,
      userAgent: req?.deviceInfo?.userAgent || req?.headers?.['user-agent'] || null,
    });
  } catch (err) {
    console.error('[AUDIT WRITE FAILED]', action, entityType, String(entityId), err.message);
  }
};

/**
 * recordTimeline — customer/agent-facing event feed entry. `visibility:
 * 'internal'` hides it from customer-facing GET /tickets/:id/timeline.
 */
export const recordTimeline = async ({
  ticket, event, eventType, actor = null, visibility = 'public', meta = {},
}) => {
  try {
    return await TicketTimeline.create({ ticket, event, eventType, actor, visibility, meta });
  } catch (err) {
    console.error('[TIMELINE WRITE FAILED]', ticket, eventType, err.message);
    return null;
  }
};

/** Convenience: write both audit + timeline in one call for the common case. */
export const recordAuditAndTimeline = async ({
  action, eventType, event, entityType = 'Ticket', entityId, ticket, actor, actorRole,
  before = null, after = null, visibility = 'public', meta = {}, req = null, note = '',
}) => {
  await Promise.all([
    recordAudit({ action, entityType, entityId, ticket, performedBy: actor, performedByRole: actorRole, before, after, req, note }),
    recordTimeline({ ticket, event, eventType, actor, visibility, meta }),
  ]);
};