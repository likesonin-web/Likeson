import mongoose from 'mongoose';
import Notification from '../models/Notification.js'; // adjust path
import { TicketActivity, TicketAuditLog, ADMIN_ROLES, PARTNER_ROLES, CUSTOMER_ROLE } from '../models/ticket.model.js';

 

export const isPartner  = (role) => PARTNER_ROLES.includes(role);
export const isCustomer = (role) => role === CUSTOMER_ROLE;
export const isFinance  = (role) => role === 'finance';

// ─── Communication Allowed Check ─────────────────────────────────────────────
// Rules: Customer↔Admin/SuperAdmin, Partner↔Admin/SuperAdmin/Finance, Admin↔Admin/Finance

export function communicationAllowed(roleA, roleB) {
  const adminSet   = new Set(ADMIN_ROLES);
  const partnerSet = new Set(PARTNER_ROLES);

  if (roleA === 'customer' && adminSet.has(roleB)) return true;
  if (roleB === 'customer' && adminSet.has(roleA)) return true;
  if (partnerSet.has(roleA) && adminSet.has(roleB)) return true;
  if (partnerSet.has(roleB) && adminSet.has(roleA)) return true;
  if (adminSet.has(roleA) && adminSet.has(roleB)) return true;

  return false;
}

// ─── Ticket Access Check ──────────────────────────────────────────────────────

export function canAccessTicket(ticket, user) {
  const uid = user._id.toString();
  const role = user.role;

  if (ADMIN_ROLES.includes(role)) return true; // admin / superadmin / finance
  if (ticket.customer?.toString() === uid) return true;
  if (ticket.partner?.toString() === uid) return true;
  return false;
}

export function canViewInternalNote(role) {
  return ADMIN_ROLES.includes(role);
}

// ─── Activity Logger ──────────────────────────────────────────────────────────

export async function logActivity(ticketId, actor, action, metadata = {}) {
  try {
    await TicketActivity.create({
      ticket: ticketId,
      actor: actor._id,
      actorRole: actor.role,
      action,
      metadata,
    });
  } catch (err) {
    console.error('[logActivity]', err.message);
  }
}

// ─── Audit Logger ─────────────────────────────────────────────────────────────

export async function logAudit({ ticketId, actor, action, req, oldValue, newValue }) {
  try {
    await TicketAuditLog.create({
      ticket: ticketId,
      actor: actor._id,
      actorRole: actor.role,
      action,
      ip: req?.ip || req?.headers?.['x-forwarded-for'] || 'unknown',
      userAgent: req?.headers?.['user-agent'] || 'unknown',
      oldValue,
      newValue,
    });
  } catch (err) {
    console.error('[logAudit]', err.message);
  }
}

// ─── Notification Creator ─────────────────────────────────────────────────────

const TICKET_NOTIFICATION_TYPES = {
  Ticket_Created:       'Ticket_Created',
  Ticket_Assigned:      'Ticket_Assigned',
  Ticket_Reassigned:    'Ticket_Reassigned',
  Ticket_Resolved:      'Ticket_Resolved',
  Ticket_Closed:        'Ticket_Closed',
  Ticket_Reopened:      'Ticket_Reopened',
  Ticket_Escalated:     'Ticket_Escalated',
  New_Ticket_Message:   'New_Ticket_Message',
  Ticket_Mention:       'Ticket_Mention',
  Ticket_Rated:         'Ticket_Rated',
  SLA_Breach:           'SLA_Breach',
  Assignment_Changed:   'Assignment_Changed',
  Department_Changed:   'Department_Changed',
  Priority_Changed:     'Priority_Changed',
};

export async function createTicketNotification({ recipients, type, title, body, ticketId, senderId }) {
  if (!recipients?.length) return;
  const notifType = TICKET_NOTIFICATION_TYPES[type] || 'Admin_Announcement';

  const docs = recipients.map((recipientId) => ({
    recipient: recipientId,
    title,
    body,
    type: notifType,
    priority: 'Medium',
    triggeredBy: 'system',
    createdBy: senderId || null,
    relatedEntityType: null,
    relatedEntityId: ticketId || null,
    deepLink: { screen: 'SupportTicket', referenceId: ticketId },
    channels: [{ channel: 'InApp', status: 'Queued' }],
  }));

  try {
    await Notification.insertMany(docs, { ordered: false });
  } catch (err) {
    console.error('[createTicketNotification]', err.message);
  }
}

// ─── Pagination Helper ────────────────────────────────────────────────────────

export function paginationOptions(query) {
  const page  = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, parseInt(query.limit) || 20);
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}

// ─── ObjectId Validator ───────────────────────────────────────────────────────

export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ─── SLA Deadline Calculator ──────────────────────────────────────────────────

import { SLA_HOURS } from '../models/ticket.model.js';

export function calcSlaDeadline(priority) {
  const hours = SLA_HOURS[priority] || 24;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ─── HTML Sanitizer (basic, no external dep) ──────────────────────────────────

export function sanitizeText(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
