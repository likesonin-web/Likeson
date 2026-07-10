// src/hooks/useChatNotifications.js
'use client';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useSocket } from './useSocket';
import { SOCKET_EVENTS } from '../constants/socketEvents';
import { selectCurrentUser } from '@/store/slices/userSlice';
import { selectActiveConversationId } from '@/store/slices/conversationSlice';
import { truncatePreview } from '../utils/chatFormatters';

/** Mount once near the app root. Shows a toast for messages in conversations
 * the user isn't currently viewing (the open thread already renders the
 * message inline, so toasting it too would be redundant). */
export function useChatNotifications() {
  const { socket } = useSocket();
  const currentUser = useSelector(selectCurrentUser);
  const activeConversationId = useSelector(selectActiveConversationId);

  useEffect(() => {
    if (!socket) return undefined;

    const handleNewMessage = (message) => {
      if (message.sender === currentUser?._id) return;
      if (message.conversation === activeConversationId) return;

      toast(truncatePreview(message.body || `Sent a ${message.type}`, 80), {
        icon: '💬',
      });

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
        new Notification('New message', { body: truncatePreview(message.body, 100) });
      }
    };

    socket.on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
    return () => socket.off(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
  }, [socket, currentUser?._id, activeConversationId]);
}
