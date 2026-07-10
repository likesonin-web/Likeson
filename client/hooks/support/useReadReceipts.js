// hooks/support/useReadReceipts.js
//
// Pairs with react-intersection-observer in MessageBubble: each bubble
// reports itself visible, this hook batches those into a single
// mark-delivered / mark-read call rather than firing per-message.

import { useEffect, useRef, useCallback } from 'react';
import { useSupportSocket } from './useSupportSocket';

const BATCH_WINDOW_MS = 600;

export function useReadReceipts(ticketId) {
  const { markDelivered, markRead } = useSupportSocket();
  const pendingDeliveredRef = useRef(new Set());
  const batchTimerRef = useRef(null);

  const flush = useCallback(() => {
    if (pendingDeliveredRef.current.size === 0) return;
    markDelivered(ticketId, Array.from(pendingDeliveredRef.current));
    pendingDeliveredRef.current.clear();
  }, [ticketId, markDelivered]);

  const reportVisible = useCallback(
    (messageId) => {
      pendingDeliveredRef.current.add(messageId);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(flush, BATCH_WINDOW_MS);
    },
    [flush]
  );

  const markReadUpTo = useCallback(
    (messageId) => {
      markRead(ticketId, messageId);
    },
    [ticketId, markRead]
  );

  useEffect(() => {
    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      flush();
    };
  }, [flush]);

  return { reportVisible, markReadUpTo };
}

export default useReadReceipts;
