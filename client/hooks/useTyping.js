// src/hooks/useTyping.js
'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useSocket } from './useSocket';
import { SOCKET_EVENTS } from '../constants/socketEvents';
import { selectTypingUsersForConversation } from '@/store/slices/socketSlice';
import { TYPING_DEBOUNCE_MS } from '../constants/chatConstants';

export function useTyping(conversationId) {
  const { emit } = useSocket();
  const typingUserIds = useSelector(selectTypingUsersForConversation(conversationId));
  const stopTimerRef = useRef(null);
  const isTypingRef = useRef(false);

  const notifyTyping = useCallback(() => {
    if (!conversationId) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emit(SOCKET_EVENTS.TYPING, { conversationId });
    }
    clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      emit(SOCKET_EVENTS.STOP_TYPING, { conversationId });
    }, TYPING_DEBOUNCE_MS);
  }, [emit, conversationId]);

  const stopTyping = useCallback(() => {
    clearTimeout(stopTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      emit(SOCKET_EVENTS.STOP_TYPING, { conversationId });
    }
  }, [emit, conversationId]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  return { typingUserIds, notifyTyping, stopTyping };
}
