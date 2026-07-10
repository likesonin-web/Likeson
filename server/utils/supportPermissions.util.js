// utils/supportPermissions.util.js
//
// Permission-based access control layered ON TOP of the existing platform
// RBAC (req.user.role from the existing `protect` middleware). No new role
// is introduced — every check here is a function of the existing role enum
// plus ticket-specific relationship (creator / participant / assignee).

import { STAFF_ROLES, PARTNER_ROLES } from '../constants/support.constants.js';
import { ForbiddenError } from './errors.js';

export function isStaff(role) {
  return STAFF_ROLES.includes(role);
}

export function isPartnerRole(role) {
  return PARTNER_ROLES.includes(role);
}

/**
 * Can this user see the ticket at all?
 * Staff: always (subject to the ticket.visibleTo allow-list already scoping
 *   queries — staff are added to visibleTo at creation).
 * Everyone else: only if they are the creator or an active participant.
 */
export function canViewTicket({ userRole, userId, ticket, isActiveParticipant }) {
  if (isStaff(userRole)) return true;
  if (String(ticket.createdBy) === String(userId)) return true;
  if (isActiveParticipant) return true;
  return false;
}

export function assertCanViewTicket(ctx) {
  if (!canViewTicket(ctx)) {
    throw new ForbiddenError('You do not have access to this ticket.');
  }
}

/**
 * Only Admin/Superadmin can assign — spec: "Admin decides when to assign
 * partner." Finance and other staff cannot assign.
 */
export function canAssignTicket(userRole) {
  return ['admin', 'superadmin'].includes(userRole);
}

export function assertCanAssignTicket(userRole) {
  if (!canAssignTicket(userRole)) {
    throw new ForbiddenError('Only Admin or Superadmin can assign tickets.');
  }
}

/**
 * Message edit — spec: "Admin/Superadmin can edit messages. Customers
 * cannot edit messages." Everyone else (partners, doctors, etc.) also
 * cannot edit — only the two named roles can, and only staff, never even
 * the original sender if sender is a customer.
 */
export function canEditMessage(userRole) {
  return ['admin', 'superadmin'].includes(userRole);
}

export function assertCanEditMessage(userRole) {
  if (!canEditMessage(userRole)) {
    throw new ForbiddenError('Only Admin or Superadmin can edit messages.');
  }
}

/**
 * Internal notes — visible only to staff. Never visible to customer or
 * partner roles, even if they are a ticket participant.
 */
export function canViewInternalNotes(userRole) {
  return isStaff(userRole);
}

export function canCreateInternalNote(userRole) {
  return isStaff(userRole);
}

export function assertCanCreateInternalNote(userRole) {
  if (!canCreateInternalNote(userRole)) {
    throw new ForbiddenError('Only staff can add internal notes.');
  }
}

/**
 * Status/priority changes — staff only. Partners influence status via
 * dedicated "waiting_partner"/"in_progress" transitions triggered by their
 * own actions (e.g. replying), never a raw status-change endpoint.
 */
export function canChangeStatus(userRole) {
  return isStaff(userRole);
}

export function assertCanChangeStatus(userRole) {
  if (!canChangeStatus(userRole)) {
    throw new ForbiddenError('Only staff can change ticket status.');
  }
}

export function canChangePriority(userRole) {
  return isStaff(userRole);
}

/**
 * Ticket close/reopen from the CUSTOMER side is allowed only via the rating
 * flow (resolved -> closed) or a direct "reopen" action on their own ticket.
 */
export function canCustomerCloseOwnTicket({ userRole, userId, ticket }) {
  return userRole === 'customer' && String(ticket.createdBy) === String(userId) && ticket.status === 'resolved';
}
