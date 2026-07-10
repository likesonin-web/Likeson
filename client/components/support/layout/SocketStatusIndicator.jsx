'use client';

import { useSelector } from 'react-redux';
import { Wifi, WifiOff, RotateCw } from 'lucide-react';
import {
  selectSocketConnected,
  selectSocketReconnecting,
  selectSocketConnecting,
} from '../../../store/slices/socketSlice';

export default function SocketStatusIndicator() {
  const connected = useSelector(selectSocketConnected);
  const connecting = useSelector(selectSocketConnecting);
  const reconnecting = useSelector(selectSocketReconnecting);

  if (connected) {
    return (
      <span
        className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-success"
        title="Realtime connected"
      >
        <Wifi className="w-3.5 h-3.5" />
        Live
      </span>
    );
  }

  if (connecting || reconnecting) {
    return (
      <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-warning" title="Reconnecting…">
        <RotateCw className="w-3.5 h-3.5 animate-spin" />
        Reconnecting
      </span>
    );
  }

  return (
    <span className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-error" title="Disconnected">
      <WifiOff className="w-3.5 h-3.5" />
      Offline
    </span>
  );
}
