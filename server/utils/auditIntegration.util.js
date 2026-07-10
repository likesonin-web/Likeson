// utils/auditIntegration.util.js
//
// Single write path into the EXISTING shared AuditLog collection (see
// models/SupportAudit.js for the required one-time enum patch note). No
// other file in this module imports AuditLog directly — everything goes
// through recordAudit() so the "who/when/device/ip/before/after, never
// delete" guarantee is enforced in exactly one place.

import AuditLog from '../models/AuditLog.js'; // existing shared model — adjust relative path at real integration time

/**
 * @param {Object} params
 * @param {string} params.action        one of SUPPORT_AUDIT_ACTIONS
 * @param {string} params.actorId       ObjectId of the user performing the action
 * @param {string} [params.targetType]  'SupportTicket' | 'SupportMessage' | 'User' | 'SupportAttachment'
 * @param {string} [params.targetId]
 * @param {string} [params.ticketId]    always attached when the action is ticket-scoped
 * @param {Object} [params.before]      pre-change state snapshot (only changed fields)
 * @param {Object} [params.after]       post-change state snapshot
 * @param {Object} [params.deviceInfo]  from req.deviceInfo (getDeviceInfo middleware)
 */
export async function recordAudit({
  action,
  actorId,
  targetType = null,
  targetId = null,
  ticketId = null,
  before = null,
  after = null,
  deviceInfo = null,
}) {
  try {
    await AuditLog.create({
      action,
      actor: actorId,
      targetType,
      targetId,
      conversation: ticketId, // AuditLog's existing field name is `conversation`; support tickets map onto it
      metadata: {
        before,
        after,
        device: deviceInfo?.deviceName ?? null,
        platform: deviceInfo?.platform ?? null,
      },
      ipAddress: deviceInfo?.ipAddress ?? null,
    });
  } catch (err) {
    // Audit failures must NEVER block the primary business transaction, but
    // must never be silent either — surfaced to ops via structured log so
    // an alert can be wired on this specific line.
    console.error('[auditIntegration] FAILED to write audit record:', {
      action,
      actorId,
      ticketId,
      error: err.message,
    });
  }
}