// features/support/utils/permissions.js
//
// Mirrors backend utils/supportPermissions.util.js exactly. UI-side checks
// only control what's *shown* — the backend re-enforces every one of these
// server-side regardless of what the client sends.

import { STAFF_ROLES, PARTNER_ROLES } from '../constants/support.constants';

export function isStaff(role) {
  return STAFF_ROLES.includes(role);
}

export function isPartnerRole(role) {
  return PARTNER_ROLES.includes(role);
}

export function canAssignTicket(role) {
  return ['admin', 'superadmin'].includes(role);
}

export function canEditMessage(role) {
  return ['admin', 'superadmin'].includes(role);
}

export function canViewInternalNotes(role) {
  return isStaff(role);
}

export function canCreateInternalNote(role) {
  return isStaff(role);
}

export function canChangeStatus(role) {
  return isStaff(role);
}

export function canChangePriority(role) {
  return isStaff(role);
}

export function canCustomerCloseOwnTicket({ userRole, userId, ticket }) {
  return userRole === 'customer' && String(ticket.createdBy) === String(userId) && ticket.status === 'resolved';
}
