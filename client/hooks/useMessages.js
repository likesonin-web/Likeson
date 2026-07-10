// src/hooks/useMessages.js
'use client';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import {
  sendMessage, editMessage, deleteMessageForMe, deleteMessageForEveryone,
  forwardMessage, generateClientMessageId, insertOptimisticMessage, markOptimisticFailed,
} from '@/store/slices/messageSlice';
import { useSocket } from './useSocket';
import { SOCKET_EVENTS } from '../constants/socketEvents';

/**
 * Message actions. Sends go through Socket.IO when connected (for lowest
 * latency + server-side broadcast to the room — the REST endpoint alone
 * does not push to other participants in real time); falls back to the
 * REST thunk (which has its own optimistic-update path) when the socket
 * isn't ready, so sending never blocks on reconnect.
 */
export function useMessages(conversationId) {
  const dispatch = useDispatch();
  const { emit, isReady } = useSocket();

  const send = useCallback((payload) => {
    const clientMessageId = generateClientMessageId();
    const body = { conversationId, clientMessageId, ...payload };

    if (isReady) {
      dispatch(insertOptimisticMessage({ conversationId, clientMessageId, ...payload }));
      emit(SOCKET_EVENTS.NEW_MESSAGE, body, (ack) => {
        if (!ack?.success) {
          dispatch(markOptimisticFailed({ conversationId, clientMessageId }));
        }
      });
    } else {
      dispatch(sendMessage(body));
    }
    return clientMessageId;
  }, [dispatch, emit, isReady, conversationId]);

  const edit = useCallback((messageId, body) => {
    dispatch(editMessage({ messageId, body, conversationId }));
  }, [dispatch, conversationId]);

  const removeForMe = useCallback((messageId) => {
    dispatch(deleteMessageForMe({ messageId, conversationId }));
  }, [dispatch, conversationId]);

  const removeForEveryone = useCallback((messageId) => {
    dispatch(deleteMessageForEveryone({ messageId, conversationId }));
  }, [dispatch, conversationId]);

  const forward = useCallback((messageId, targetConversationId) => {
    dispatch(forwardMessage({ messageId, targetConversationId }));
  }, [dispatch]);

  return { send, edit, removeForMe, removeForEveryone, forward };
}
