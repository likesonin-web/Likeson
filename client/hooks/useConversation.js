// src/hooks/useConversation.js
'use client';
import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchConversationById, setActiveConversation,
  selectConversationById, selectActiveConversationId,
} from '@/store/slices/conversationSlice';
import { useSocket } from './useSocket';

/**
 * Loads (and keeps active) a single conversation, joining/leaving its
 * Socket.IO room as the component mounts/unmounts.
 */
export function useConversation(conversationId) {
  const dispatch = useDispatch();
  const { joinConversation, leaveConversation, isReady } = useSocket();
  const conversation = useSelector(selectConversationById(conversationId));
  const activeConversationId = useSelector(selectActiveConversationId);

  useEffect(() => {
    if (!conversationId) return undefined;

    dispatch(setActiveConversation(conversationId));
    if (!conversation) dispatch(fetchConversationById(conversationId));

    if (isReady) joinConversation(conversationId);

    return () => {
      if (isReady) leaveConversation(conversationId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, isReady]);

  const refresh = useCallback(() => {
    if (conversationId) dispatch(fetchConversationById(conversationId));
  }, [dispatch, conversationId]);

  return {
    conversation,
    isActive: activeConversationId === conversationId,
    refresh,
  };
}
