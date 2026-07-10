// src/hooks/useDeliveredReceipt.js
'use client';
import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { SOCKET_EVENTS } from '../constants/socketEvents';

/** Fires messageDelivered for any newly-arrived message not sent by the current user. */
export function useDeliveredReceipt(messages, currentUserId) {
  const { emit } = useSocket();
  const deliveredIds = useRef(new Set());

  useEffect(() => {
    messages.forEach((m) => {
      if (m.sender === currentUserId || m.isOptimistic) return;
      if (deliveredIds.current.has(m._id)) return;
      deliveredIds.current.add(m._id);
      emit(SOCKET_EVENTS.MESSAGE_DELIVERED, { messageId: m._id });
    });
  }, [messages, currentUserId, emit]);
}
