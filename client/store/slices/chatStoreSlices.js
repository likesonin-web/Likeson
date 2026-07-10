import conversations from './slices/conversationSlice';
import messages from './slices/messageSlice';
import socket from './slices/socketSlice';
import presence from './slices/presenceSlice';
import attachments from './slices/attachmentSlice';
import groups from '@/store/slices/groupSlice'; // NEW

export const chatReducers = { conversations, messages, socket, presence, attachments, groups };