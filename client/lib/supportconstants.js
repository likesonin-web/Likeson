// ==========================================
// --- SOCKET.IO CONSTANTS
// ==========================================

// The specific namespace your backend uses for support-related socket events
export const SOCKET_NAMESPACE = '/support';

// Ping the server every 30 seconds to keep the connection alive
export const HEARTBEAT_INTERVAL_MS = 30000;


// ==========================================
// --- TICKET CONSTANTS (Optional / Helpful)
// ==========================================

export const TICKET_STATUSES = {
  OPEN: 'OPEN',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_ON_CUSTOMER: 'WAITING_ON_CUSTOMER',
  ESCALATED: 'ESCALATED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
};

export const TICKET_PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
};

export const MESSAGE_TYPES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
  INTERNAL_NOTE: 'INTERNAL_NOTE',
};

export const SUPPORT_ROLES = {
  USER: 'USER',
  AGENT: 'AGENT',
  ADMIN: 'ADMIN',
};

// You can also export your notification types here to keep them centralized!
export const SUPPORT_NOTIFICATION_TYPES = {
  CREATED: 'Support_Ticket_Created',
  NEW_MESSAGE: 'Support_New_Message',
  ASSIGNMENT: 'Support_Assignment',
  MENTION: 'Support_Mention',
  STATUS_CHANGE: 'Support_Status_Change',
  PARTICIPANT_ADDED: 'Support_Participant_Added',
  CLOSED: 'Support_Ticket_Closed',
  REOPENED: 'Support_Ticket_Reopened',
};