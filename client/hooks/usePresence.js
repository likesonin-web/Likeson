// src/hooks/usePresence.js
'use client';
import { useSelector } from 'react-redux';
import { selectIsUserOnline, selectLastSeen } from '@/store/slices/presenceSlice';
import { formatLastSeen } from '../utils/chatFormatters';

export function usePresence(userId) {
  const isOnline = useSelector(selectIsUserOnline(userId));
  const lastSeenRaw = useSelector(selectLastSeen(userId));
  return { isOnline, lastSeenRaw, lastSeenText: isOnline ? 'Online' : formatLastSeen(lastSeenRaw) };
}
