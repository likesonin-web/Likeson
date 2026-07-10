// src/hooks/useOnlineStatus.js
'use client';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { selectSocketStatus } from '@/store/slices/socketSlice';

/** Combines browser network status + socket connection status into one flag,
 * used to drive the "You're offline" / "Reconnecting…" banner. */
export function useOnlineStatus() {
  const socketStatus = useSelector(selectSocketStatus);
  const [isBrowserOnline, setIsBrowserOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const goOnline = () => setIsBrowserOnline(true);
    const goOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const isFullyConnected = isBrowserOnline && socketStatus === 'connected';

  return {
    isBrowserOnline,
    socketStatus,
    isFullyConnected,
    isReconnecting: socketStatus === 'reconnecting' || socketStatus === 'connecting',
  };
}
