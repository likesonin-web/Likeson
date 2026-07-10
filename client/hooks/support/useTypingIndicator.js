// hooks/support/useTypingIndicator.js

import { useRef, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useSupportSocket } from './useSupportSocket';
import { selectTypingUsers } from '../../store/slices/chatSlice';
import { TYPING_DEBOUNCE_MS, TYPING_STOP_DELAY_MS } from '../../features/support/constants/support.constants';

/**
 * @param {string} ticketId
 * @param {string} currentUserId  excluded from the returned "who's typing" list
 */
export function useTypingIndicator(ticketId, currentUserId) {
  const { sendTyping, sendStopTyping } = useSupportSocket();
  const typingUserIds = useSelector(selectTypingUsers(ticketId));

  const lastEmitRef = useRef(0);
  const stopTimerRef = useRef(null);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastEmitRef.current > TYPING_DEBOUNCE_MS) {
      sendTyping(ticketId);
      lastEmitRef.current = now;
    }

    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    stopTimerRef.current = setTimeout(() => {
      sendStopTyping(ticketId);
    }, TYPING_STOP_DELAY_MS);
  }, [ticketId, sendTyping, sendStopTyping]);

  const notifyStopTyping = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    sendStopTyping(ticketId);
  }, [ticketId, sendStopTyping]);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  const othersTyping = typingUserIds.filter((id) => id !== currentUserId);

  return { othersTyping, isAnyoneTyping: othersTyping.length > 0, notifyTyping, notifyStopTyping };
}

export default useTypingIndicator;
