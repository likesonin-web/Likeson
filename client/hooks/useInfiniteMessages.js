// hooks/support/useInfiniteMessages.js

import { useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ensureThread,
  fetchMessages,
  makeSelectMessagesForTicket,
  selectThreadLoading,
  selectThreadHasMore,
  selectThreadNextCursor,
} from '../../store/slices/chatSlice';

export function useInfiniteMessages(ticketId) {
  const dispatch = useDispatch();
  const selectMessages = useRef(makeSelectMessagesForTicket(ticketId));
  // Rebuild the memoized selector if the ticketId changes between renders.
  if (selectMessages.current._ticketId !== ticketId) {
    selectMessages.current = makeSelectMessagesForTicket(ticketId);
    selectMessages.current._ticketId = ticketId;
  }

  const messages = useSelector(selectMessages.current);
  const loading = useSelector(selectThreadLoading(ticketId));
  const hasMore = useSelector(selectThreadHasMore(ticketId));
  const nextCursor = useSelector(selectThreadNextCursor(ticketId));

  useEffect(() => {
    if (!ticketId) return;
    dispatch(ensureThread(ticketId));
    dispatch(fetchMessages({ ticketId }));
  }, [ticketId, dispatch]);

  const loadOlder = useCallback(() => {
    if (loading || !hasMore || !nextCursor) return;
    dispatch(fetchMessages({ ticketId, cursor: nextCursor, direction: 'before' }));
  }, [dispatch, ticketId, loading, hasMore, nextCursor]);

  return { messages, loading, hasMore, loadOlder };
}

export default useInfiniteMessages;
