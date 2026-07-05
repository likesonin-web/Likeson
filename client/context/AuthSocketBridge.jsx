'use client';

/**
 * AuthSocketBridge.jsx — Likeson.in
 *
 * Root-level wrapper around SocketProvider and SupportSocketProvider.
 * Mounted once, near the top of the tree (inside StoreProvider).
 */

import { useSelector } from 'react-redux';
import SocketProvider from '@/context/SocketProvider';

import { selectToken } from '@/store/slices/userSlice';

export default function AuthSocketBridge({ children }) {
  const token = useSelector(selectToken);

  return (
    <SocketProvider token={token}>
      {/* Add SupportSocketProvider inside or alongside the main SocketProvider */}
   
        {children}
  
    </SocketProvider>
  );
}