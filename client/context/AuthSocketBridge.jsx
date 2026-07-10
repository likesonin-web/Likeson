'use client';

 

import { useSelector } from 'react-redux';
import SocketProvider from '@/context/SocketProvider';
import SupportSocketProvider from '@/context/SupportSocketProvider';

import { selectToken } from '@/store/slices/userSlice';

export default function AuthSocketBridge({ children }) {
  const token = useSelector(selectToken);

  return (
    <SocketProvider token={token}>
      <SupportSocketProvider token={token}>
        {children}
      </SupportSocketProvider>
    </SocketProvider>
  );
}
