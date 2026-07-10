// src/constants/chatConstants.js
// Mirrors support-module/constants on the backend — keep literal values identical.

export const CONVERSATION_TYPES = ['private', 'group', 'complaint', 'announcement'];

export const MESSAGE_TYPES = [
  'text', 'image', 'video', 'audio', 'document',
  'system', 'deleted', 'forwarded', 'reply', 'mention', 'location',
];

export const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000;

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🙏'];

export const COMPLAINT_STATUSES = [
  'Open', 'Assigned', 'In Progress', 'Waiting Customer', 'Resolved', 'Closed',
];

export const COMPLAINT_CATEGORIES = [
  'Payment', 'Settlement', 'Booking', 'Technical Issue', 'Verification',
  'KYC', 'Customer Abuse', 'Partner Abuse', 'Feature Request',
  'Bug Report', 'Emergency', 'Other',
];

export const COMPLAINT_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent', 'Critical'];

export const COMPLAINT_STATUS_COLOR = {
  Open: 'info',
  Assigned: 'primary',
  'In Progress': 'warning',
  'Waiting Customer': 'accent',
  Resolved: 'success',
  Closed: 'neutral',
};

export const COMPLAINT_PRIORITY_COLOR = {
  Low: 'success',
  Medium: 'info',
  High: 'warning',
  Urgent: 'error',
  Critical: 'error',
};

export const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip', 'application/x-zip-compressed',
];

export const MAX_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024;

export const ADMIN_ROLES = ['admin', 'superadmin'];

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);

export const MESSAGE_PAGE_SIZE = 30;
export const CONVERSATION_PAGE_SIZE = 20;
export const TYPING_DEBOUNCE_MS = 2500;
