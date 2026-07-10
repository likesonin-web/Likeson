// models/SupportAudit.js
//
// IMPORTANT: spec requires reusing the EXISTING AuditLog system, not forking
// a parallel collection. This file is intentionally NOT a new Mongoose
// model/collection — "SupportAudit" in the requirements doc maps to the
// existing shared `AuditLog` (models/AuditLog.js) used with support-scoped
// action names.
//
// REQUIRED ONE-TIME PATCH to the existing AuditLog.js before this module can
// write to it: its AUDIT_ACTIONS enum must be extended with the values in
// SUPPORT_AUDIT_ACTIONS (constants/support.constants.js). AuditLog.action is
// a strict `enum:` field, so any support action name not already present in
// AUDIT_ACTIONS will throw a ValidationError on write — same class of bug
// documented in Notification.js's priority-enum fix. Patch:
//
//   // models/AuditLog.js
//   import { SUPPORT_AUDIT_ACTIONS } from '../constants/support.constants.js';
//   export const AUDIT_ACTIONS = [
//     ...existingActions,
//     ...SUPPORT_AUDIT_ACTIONS,
//   ];
//
// targetType enum on AuditLog also needs 'SupportTicket' and 'SupportMessage'
// added alongside the existing 'Conversation' | 'Message' | 'User' | 'Attachment'.
//
// All actual writes happen through utils/auditIntegration.util.js#recordAudit,
// which imports the real AuditLog model — nothing in the support module
// talks to Mongo directly for audit trail.

export const SUPPORT_AUDIT_TARGET_TYPES = ['SupportTicket', 'SupportMessage', 'User', 'SupportAttachment'];