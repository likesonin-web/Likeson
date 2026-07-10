// src/hooks/useReadReceipt.js
'use client';
import { useCallback, useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { markConversationRead } from '@/store/slices/messageSlice';
import { resetUnreadCount } from '@/store/slices/conversationSlice';
import { useSocket } from './useSocket';
import { SOCKET_EVENTS } from '../constants/socketEvents';
import { useIntersectionObserver } from './useIntersectionObserver';

/**
 * Marks a conversation read once the latest message actually scrolls into
 * view (not just on open) — avoids falsely marking read while a user has
 * scrolled up to older history.
 */
export function useReadReceipt(conversationId, latestMessageId) {
  const dispatch = useDispatch();
  const { emit } = useSocket();
  const { targetRef, isIntersecting } = useIntersectionObserver({ threshold: 0.9 });
  const lastMarkedId = useRef(null);

  useEffect(() => {
    if (!isIntersecting || !conversationId || !latestMessageId) return;
    if (lastMarkedId.current === latestMessageId) return;
    lastMarkedId.current = latestMessageId;

    dispatch(markConversationRead({ conversationId, upToMessageId: latestMessageId }));
    dispatch(resetUnreadCount(conversationId));
    emit(SOCKET_EVENTS.MESSAGE_SEEN, { conversationId, upToMessageId: latestMessageId });
  }, [isIntersecting, conversationId, latestMessageId, dispatch, emit]);

  return { sentinelRef: targetRef };
}
