/**
 * lib/permissions.js
 * BUG FIX: was importing from './constants' — file is named 'supportconstants.js'
 */

import { ADMIN_ROLES, PARTNER_ROLES, CUSTOMER_ROLE } from './supportconstants';

export const isCustomer   = (role) => role === CUSTOMER_ROLE;
export const isPartner    = (role) => PARTNER_ROLES.includes(role);
export const isAdmin      = (role) => ADMIN_ROLES.includes(role);
export const isStaffAdmin = (role) => role === 'admin' || role === 'superadmin';
export const isFinance    = (role) => role === 'finance';
export const isSuperAdmin = (role) => role === 'superadmin';

export const SUPPORT_PERMISSIONS = {
  createTicket:         (role) => isCustomer(role) || isPartner(role) || isAdmin(role),
  viewOwnTickets:       () => true,
  viewAllTickets:       (role) => isAdmin(role),
  replyToTicket:        () => true,
  uploadAttachment:     () => true,
  rateTicket:           (role) => isCustomer(role) || isPartner(role),
  reopenTicket:         (role) => isCustomer(role) || isPartner(role) || isAdmin(role),
  assignTicket:         (role) => isStaffAdmin(role),
  unassignTicket:       (role) => isStaffAdmin(role),
  bulkTicketActions:    (role) => isStaffAdmin(role),
  mergeTickets:         (role) => isStaffAdmin(role),
  changePriority:       (role) => isStaffAdmin(role),
  changeDepartment:     (role) => isStaffAdmin(role),
  escalateTicket:       (role) => isStaffAdmin(role),
  deleteTicket:         (role) => isSuperAdmin(role),
  addWatcher:           (role) => isStaffAdmin(role),
  viewInternalNotes:    (role) => isAdmin(role),
  createInternalNote:   (role) => isAdmin(role),
  viewAnalytics:        (role) => isAdmin(role),
  viewAdminPerformance: (role) => isStaffAdmin(role),
  viewAuditLogs:        (role) => isSuperAdmin(role),
  viewFinanceQueue:     (role) => isFinance(role) || isStaffAdmin(role),
  createMention:        (role) => isAdmin(role),
  beMentioned:          (role) => isAdmin(role),
  deleteAnyMessage:     (role) => isSuperAdmin(role),
};

export function can(role, permissionKey) {
  const predicate = SUPPORT_PERMISSIONS[permissionKey];
  return typeof predicate === 'function' ? predicate(role) : false;
}

export function buildPermissionMap(role) {
  return Object.keys(SUPPORT_PERMISSIONS).reduce((acc, key) => {
    acc[key] = can(role, key);
    return acc;
  }, {});
}

export function getVisibleNavItems(role) {
  const items = [
    { key: 'dashboard', label: 'Dashboard',          href: '/support',                     show: true },
    { key: 'all',       label: 'All Tickets',         href: '/support/tickets?scope=all',   show: isAdmin(role) },
    { key: 'mine',      label: 'My Tickets',          href: '/support/tickets?scope=mine',  show: true },
    { key: 'assigned',  label: 'Assigned to Me',      href: '/support/tickets?scope=assigned', show: isStaffAdmin(role) },
    { key: 'finance',   label: 'Finance Queue',       href: '/support/finance',             show: can(role, 'viewFinanceQueue') },
    { key: 'analytics', label: 'Analytics',           href: '/support/analytics',           show: can(role, 'viewAnalytics') },
    { key: 'admin',     label: 'Admin Management',    href: '/support/admin',               show: isStaffAdmin(role) },
    { key: 'settings',  label: 'Settings',            href: '/support/settings',            show: true },
  ];
  return items.filter((i) => i.show);
}

export function canAccessTicket(ticket, user) {
  if (!ticket || !user) return false;
  if (isAdmin(user.role)) return true;
  const ownerId = ticket.customer?._id || ticket.customer;
  const partnerId = ticket.partner?._id || ticket.partner;
  return String(ownerId) === String(user._id) || String(partnerId) === String(user._id);
}
