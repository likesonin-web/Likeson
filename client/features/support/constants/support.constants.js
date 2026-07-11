// features/support/constants/support.constants.js
//
// Mirrors backend constants/support.constants.js 1:1. Keep these two files
// in sync manually whenever the backend enum changes — there is no shared
// package between the two repos, so a mismatch here means a dropdown that
// silently can't produce a value the backend accepts.

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

export const TICKET_TYPE_LABELS = {
  complaint: 'Complaint',
  support_request: 'Support Request',
  refund_request: 'Refund Request',
  technical_bug: 'Technical Bug',
  feature_request: 'Feature Request',
  booking_issue: 'Booking Issue',
  payment_issue: 'Payment Issue',
  subscription_issue: 'Subscription Issue',
  doctor_issue: 'Doctor Issue',
  hospital_issue: 'Hospital Issue',
  lab_issue: 'Lab Issue',
  pharmacy_issue: 'Pharmacy Issue',
  transport_issue: 'Transport Issue',
  care_assistant_issue: 'Care Assistant Issue',
  general_support: 'General Support',
  other: 'Other',
};

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

export const TICKET_STATUS_LABELS = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  waiting_customer: 'Waiting on You',
  waiting_partner: 'Waiting on Partner',
  escalated: 'Escalated',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
};

// Semantic color key per status — maps to badge-* classes in globals.css
export const TICKET_STATUS_COLOR = {
  open: 'info',
  assigned: 'primary',
  in_progress: 'primary',
  waiting_customer: 'warning',
  waiting_partner: 'warning',
  escalated: 'error',
  resolved: 'success',
  closed: 'secondary',
  rejected: 'error',
};

export const TICKET_TERMINAL_STATUSES = ['resolved', 'closed', 'rejected'];

export const TICKET_STATUS_TRANSITIONS = {
  open: ['assigned', 'in_progress', 'escalated', 'rejected', 'closed'],
  assigned: ['in_progress', 'waiting_partner', 'escalated', 'closed'],
  in_progress: ['waiting_customer', 'waiting_partner', 'escalated', 'resolved', 'closed'],
  waiting_customer: ['in_progress', 'escalated', 'closed', 'resolved'],
  waiting_partner: ['in_progress', 'escalated', 'closed'],
  escalated: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: ['in_progress'],
  rejected: [],
};

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'];

export const TICKET_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const TICKET_PRIORITY_COLOR = {
  low: 'info',
  medium: 'primary',
  high: 'warning',
  critical: 'error',
};

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

export const MESSAGE_TYPES = [
  'text',
  'image',
  'video',
  'pdf',
  'document',
  'audio',
  'system',
  'assignment',
  'status',
  'timeline',
];

export const MEDIA_MESSAGE_TYPES = ['image', 'video', 'pdf', 'document', 'audio'];

export const MESSAGE_STATUSES = ['sending', 'sent', 'delivered', 'read', 'failed'];

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

export const TIMELINE_EVENT_LABELS = {
  created: 'Ticket created',
  assigned: 'Assigned',
  transferred: 'Transferred',
  message: 'New message',
  edited: 'Message edited',
  status_changed: 'Status changed',
  priority_changed: 'Priority changed',
  participant_joined: 'Participant joined',
  participant_left: 'Participant left',
  closed: 'Closed',
  reopened: 'Reopened',
  resolved: 'Resolved',
  escalated: 'Escalated',
};

// ── Roles who can create tickets (mirrors backend TICKET_CREATOR_ROLES) ────
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

export const STAFF_ROLES = ['superadmin', 'admin', 'finance'];

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

// ── Per-role support route (drives sidebar links + role-guarded routing) ──
export const ROLE_SUPPORT_ROUTE = {
  customer: '/support',
  doctor: '/doctor/support',
  hospital: '/hospital/support',
  pharmacy: '/pharmacy/support',
  lab_partner: '/lab/support',
  driver: '/driver/support',
  transportpartner: '/driver/support',
  solodriverpartner: '/driver/support',
  care_assistant: '/care-assistant/support',
  blood_bank: '/lab/support',
  finance: '/admin/support',
  admin: '/admin/support',
  superadmin: '/admin/support',
};

// ── Socket event names — mirrors backend SOCKET_EVENTS exactly ─────────────
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
  MESSAGE_EDIT: 'support:message_edit',
  MESSAGE_DELETE: 'support:message_delete',
  MESSAGE_REACT: 'support:message_react',
  PARTICIPANT_JOINED: 'support:participant_joined',
  PARTICIPANT_LEFT: 'support:participant_left',
  ASSIGNMENT: 'support:assignment',
  STATUS_CHANGED: 'support:status_changed',
  PRESENCE_UPDATE: 'support:presence_update',
  RECONNECT: 'support:reconnect',
  DISCONNECT: 'support:disconnect',
  HEARTBEAT: 'support:heartbeat',
  ERROR: 'support:error',
  NOTIFICATION_NEW: 'notification:new',
};

export const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/webm'],
  pdf: ['application/pdf'],
  document: [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
  ],
  audio: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm'],
};

export const MAX_FILE_SIZE_BYTES = {
  image: 8 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  pdf: 20 * 1024 * 1024,
  document: 20 * 1024 * 1024,
  audio: 25 * 1024 * 1024,
};

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_MESSAGE_PAGE_SIZE = 30;

// ── UI-only constants ───────────────────────────────────────────────────────
export const TYPING_DEBOUNCE_MS = 400;
export const TYPING_STOP_DELAY_MS = 2500;
export const HEARTBEAT_INTERVAL_MS = 25_000;
export const RECONNECT_BASE_DELAY_MS = 1000;
export const RECONNECT_MAX_DELAY_MS = 15_000;
export const MESSAGE_SEARCH_DEBOUNCE_MS = 300;
export const GLOBAL_SEARCH_DEBOUNCE_MS = 350;
export const DRAFT_AUTOSAVE_DEBOUNCE_MS = 800;

export const KEYBOARD_SHORTCUTS = {
  FOCUS_SEARCH: 'mod+k',
  NEW_TICKET: 'mod+n',
  SEND_MESSAGE: 'mod+enter',
  CLOSE_MODAL: 'escape',
  NEXT_TICKET: 'j',
  PREV_TICKET: 'k',
};