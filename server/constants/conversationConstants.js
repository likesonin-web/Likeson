// constants/conversationConstants.js

export const CONVERSATION_TYPES = ['private', 'group', 'complaint', 'announcement'];

export const CONVERSATION_MEMBER_ROLES = ['owner', 'admin', 'moderator', 'member'];

export const CONVERSATION_LABEL_COLORS = [
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray',
];

export const MAX_GROUP_MEMBERS = 500;

export const isValidConversationType = (type) => CONVERSATION_TYPES.includes(type);
