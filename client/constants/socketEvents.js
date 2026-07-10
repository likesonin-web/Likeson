// src/constants/socketEvents.js
// Must stay byte-identical to support-module/constants/socketEvents.js on the backend.

export const SOCKET_EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',

  JOIN_CONVERSATION: 'joinConversation',
  LEAVE_CONVERSATION: 'leaveConversation',

  TYPING: 'typing',
  STOP_TYPING: 'stopTyping',

  NEW_MESSAGE: 'newMessage',
  EDIT_MESSAGE: 'editMessage',
  DELETE_MESSAGE: 'deleteMessage',

  REACTION_ADDED: 'reactionAdded',
  REACTION_REMOVED: 'reactionRemoved',

  MESSAGE_SEEN: 'messageSeen',
  MESSAGE_DELIVERED: 'messageDelivered',

  CONVERSATION_CREATED: 'conversationCreated',
  CONVERSATION_UPDATED: 'conversationUpdated',
  GROUP_UPDATED: 'groupUpdated',

  COMPLAINT_CREATED: 'complaintCreated',
  COMPLAINT_STATUS_CHANGED: 'complaintStatusChanged',

  USER_ONLINE: 'userOnline',
  USER_OFFLINE: 'userOffline',

  ATTACHMENT_UPLOADED: 'attachmentUploaded',
};

export const socketRoomForConversation = (conversationId) => `conversation:${conversationId}`;
