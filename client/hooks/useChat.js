// src/hooks/useChat.js
'use client';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/store/slices/userSlice';
import { useConversation } from './useConversation';
import { useInfiniteMessages } from './useInfiniteMessages';
import { useMessages } from './useMessages';
import { useTyping } from './useTyping';
import { useDeliveredReceipt } from './useDeliveredReceipt';
import { useReadReceipt } from './useReadReceipt';

/**
 * Single hook a chat screen needs: conversation detail, message list +
 * pagination, send/edit/delete actions, typing, delivered/read receipts.
 * Composes the smaller hooks above rather than duplicating their logic.
 */
export function useChat(conversationId) {
  const currentUser = useSelector(selectCurrentUser);
  const { conversation, isActive, refresh } = useConversation(conversationId);
  const { messages, hasMore, isLoading, loadMore } = useInfiniteMessages(conversationId);
  const actions = useMessages(conversationId);
  const { typingUserIds, notifyTyping, stopTyping } = useTyping(conversationId);

  useDeliveredReceipt(messages, currentUser?._id);
  const latestMessage = messages[messages.length - 1];
  const { sentinelRef } = useReadReceipt(conversationId, latestMessage?._id);

  return {
    currentUser,
    conversation,
    isActive,
    refresh,
    messages,
    hasMore,
    isLoading,
    loadMore,
    typingUserIds,
    notifyTyping,
    stopTyping,
    sentinelRef,
    ...actions, // send, edit, removeForMe, removeForEveryone, forward
  };
}
