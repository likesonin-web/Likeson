// constants/support.constants.js
//
// Single source of truth for every enum used across the Support Ticket
// module. Mirrors the existing codebase convention (USER_ROLES in User.js,
// BOOKING_TYPES/BOOKING_STATUSES in Booking.js) — exported UPPER_SNAKE arrays
// consumed directly by schema `enum:` fields and by validators, so schema
// and request-body validation can never drift out of sync.

// ── Reused from existing platform RBAC (models/User.js) ─────────────────────
// NOT redefined here — imported wherever role checks are needed:
//   import { USER_ROLES } from '../models/User.js';
// Support module never creates a new role. Listed here only as documentation
// of which of the existing roles this module cares about.
export const SUPPORT_ELIGIBLE_ROLES = [
  'superadmin',
  'admin',
  'doctor',
  'hospital',
  'transportpartner',
  'driver',
  'solodriverpartner',
  'customer',
  'pharmacy',
  'care_assistant',
  'finance',
  'lab_partner',
  'blood_bank',
];

// Roles allowed to CREATE a ticket.
export const TICKET_CREATOR_ROLES = [
  'customer',
  'doctor',
  'hospital',
  'pharmacy',
  'driver',
  'transportpartner',
  'solodriverpartner',
  'lab_partner',
  'blood_bank',
  'care_assistant',
  'admin',
  'superadmin',
];

// Roles with staff-level visibility (see EVERY ticket by default, subject to
// permission checks in rbac.middleware.js — this list is NOT itself the
// authorization check, just the ceiling of who is eligible for staff scope).
export const STAFF_ROLES = ['superadmin', 'admin', 'finance'];

// Roles that only ever see tickets they are explicitly assigned/participant to.
export const PARTNER_ROLES = [
  'doctor',
  'hospital',
  'pharmacy',
  'driver',
  'transportpartner',
  'solodriverpartner',
  'lab_partner',
  'blood_bank',
  'care_assistant',
];

// ── Ticket Type ───────────────────────────────────────────────────────────
export const TICKET_TYPES = [
  'complaint',
  'support_request',
  'refund_request',
  'technical_bug',
  'feature_request',
  'booking_issue',
  'payment_issue',
  'subscription_issue',
  'doctor_issue',
  'hospital_issue',
  'lab_issue',
  'pharmacy_issue',
  'transport_issue',
  'care_assistant_issue',
  'general_support',
  'other',
];

// ── Ticket Status ─────────────────────────────────────────────────────────
export const TICKET_STATUSES = [
  'open',
  'assigned',
  'in_progress',
  'waiting_customer',
  'waiting_partner',
  'escalated',
  'resolved',
  'closed',
  'rejected',
];

// Terminal states — closing these transitions is restricted (see
// ticket.service.js transition guard) and SLA clocks stop here.
export const TICKET_TERMINAL_STATUSES = ['resolved', 'closed', 'rejected'];

// Legal forward transitions. Used by ticket.service.js to reject invalid
// status jumps (e.g. cannot go straight from 'open' to 'closed').
export const TICKET_STATUS_TRANSITIONS = {
  open: ['assigned', 'in_progress', 'escalated', 'rejected', 'closed'],
  assigned: ['in_progress', 'waiting_partner', 'escalated', 'closed'],
  in_progress: ['waiting_customer', 'waiting_partner', 'escalated', 'resolved', 'closed'],
  waiting_customer: ['in_progress', 'escalated', 'closed', 'resolved'],
  waiting_partner: ['in_progress', 'escalated', 'closed'],
  escalated: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'in_progress'], // reopen path
  closed: ['in_progress'],             // reopen path (staff only)
  rejected: [],                        // terminal, no reopen
};

// ── Priority ──────────────────────────────────────────────────────────────
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// SLA targets in minutes, keyed by priority. Consumed by sla.service.js to
// compute dueAt / firstResponseDueAt at ticket-creation time.
export const SLA_FIRST_RESPONSE_MINUTES = {
  low: 24 * 60,
  medium: 8 * 60,
  high: 2 * 60,
  critical: 30,
};

export const SLA_RESOLUTION_MINUTES = {
  low: 5 * 24 * 60,
  medium: 3 * 24 * 60,
  high: 24 * 60,
  critical: 4 * 60,
};

// ── Participant Roles (chat-room membership, distinct from platform role) ──
export const PARTICIPANT_ROLES = [
  'customer',
  'admin',
  'superadmin',
  'finance',
  'assigned_partner',
  'assigned_doctor',
  'assigned_hospital',
  'assigned_pharmacy',
  'assigned_driver',
  'assigned_lab',
  'assigned_blood_bank',
  'assigned_care_assistant',
  'assigned_transport_partner',
];

// ── Message Types ─────────────────────────────────────────────────────────
export const MESSAGE_TYPES = [
  'text',
  'image',
  'video',
  'pdf',
  'audio',
  'system',
  'assignment',
  'status',
  'timeline',
];

export const MEDIA_MESSAGE_TYPES = ['image', 'video', 'pdf', 'audio'];

// ── Message Status ────────────────────────────────────────────────────────
export const MESSAGE_STATUSES = ['sending', 'sent', 'delivered', 'read', 'failed'];

// ── Timeline Event Types ──────────────────────────────────────────────────
export const TIMELINE_EVENTS = [
  'created',
  'assigned',
  'transferred',
  'message',
  'edited',
  'status_changed',
  'priority_changed',
  'participant_joined',
  'participant_left',
  'closed',
  'reopened',
  'resolved',
  'escalated',
];

// ── Audit Actions (support-scoped; feeds existing shared AuditLog model) ───
export const SUPPORT_AUDIT_ACTIONS = [
  'ticket_created',
  'ticket_assigned',
  'ticket_reassigned',
  'ticket_status_changed',
  'ticket_priority_changed',
  'ticket_closed',
  'ticket_reopened',
  'ticket_escalated',
  'ticket_rejected',
  'message_sent',
  'message_edited',
  'message_deleted',
  'participant_added',
  'participant_removed',
  'internal_note_added',
  'attachment_uploaded',
  'attachment_removed',
  'rating_submitted',
];

// ── Notification Event Types (mapped to existing Notification.type enum — ─
// see notification.integration.js for the mapping table; these are the
// support-module-internal event names BEFORE mapping)
export const SUPPORT_NOTIFICATION_EVENTS = [
  'new_message',
  'assignment',
  'mention',
  'status_change',
  'participant_added',
  'ticket_closed',
  'ticket_reopened',
];

// ── Socket Events ─────────────────────────────────────────────────────────
export const SOCKET_EVENTS = {
  JOIN_TICKET: 'support:join_ticket',
  LEAVE_TICKET: 'support:leave_ticket',
  TYPING: 'support:typing',
  STOP_TYPING: 'support:stop_typing',
  MESSAGE_SEND: 'support:message_send',
  MESSAGE_RECEIVE: 'support:message_receive',
  MESSAGE_READ: 'support:message_read',
  MESSAGE_DELIVERED: 'support:message_delivered',
  MESSAGE_SEEN: 'support:message_seen',
  PARTICIPANT_JOINED: 'support:participant_joined',
  PARTICIPANT_LEFT: 'support:participant_left',
  ASSIGNMENT: 'support:assignment',
  STATUS_CHANGED: 'support:status_changed',
  PRESENCE_UPDATE: 'support:presence_update',
  RECONNECT: 'support:reconnect',
  DISCONNECT: 'support:disconnect',
  HEARTBEAT: 'support:heartbeat',
  ERROR: 'support:error',
};

// ── File Upload ───────────────────────────────────────────────────────────
export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  pdf: ['application/pdf'],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm'],
};

export const MAX_FILE_SIZE_BYTES = {
  image: 8 * 1024 * 1024,   // 8 MB
  video: 100 * 1024 * 1024, // 100 MB
  pdf: 20 * 1024 * 1024,    // 20 MB
  audio: 25 * 1024 * 1024,  // 25 MB
};

// ── Rate limiting / anti-flood ─────────────────────────────────────────────
export const MESSAGE_RATE_LIMIT = {
  windowMs: 10_000,   // 10s window
  maxMessages: 15,    // per window per user per ticket
};

export const TICKET_CREATE_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxTickets: 10,
};

// ── Pagination ────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_MESSAGE_PAGE_SIZE = 30;

// ── Misc caps (mirrors MAX_INLINE_STATUS_LOG pattern in Booking.js) ────────
export const MAX_INLINE_TIMELINE_ENTRIES = 50;
export const MAX_PARTICIPANTS_PER_TICKET = 200;
export const MAX_ASSIGNMENT_HISTORY_INLINE = 50;
