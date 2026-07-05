// constants/messageConstants.js

export const MESSAGE_TYPES = [
  'text', 'image', 'video', 'audio', 'document',
  'system', 'deleted', 'forwarded', 'reply', 'mention', 'location',
];

export const MESSAGE_EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🙏'];

export const SUPPORTED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
];

export const MAX_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

export const isValidMessageType = (type) => MESSAGE_TYPES.includes(type);
