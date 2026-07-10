'use client';

import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { selectUser } from '../../../store/slices/userSlice';
import { selectSocketConnected, selectSocketReconnecting } from '../../../store/slices/socketSlice';
import Sidebar from './Sidebar';
import Header from './Header';
import { OfflineBanner } from '../shared/StateViews';

/**
 * @param {{ children: React.ReactNode, breadcrumbs?: Array<{label: string, href?: string}> }} props
 */
export default function SupportShell({ children, breadcrumbs = [] }) {
  const user = useSelector(selectUser);
  const connected = useSelector(selectSocketConnected);
  const reconnecting = useSelector(selectSocketReconnecting);

  // NOTE: the socket connection itself is owned by <SupportSocketProvider>,
  // mounted once at the app root (see context/SupportSocketProvider.jsx and
  // AuthSocketBridge.jsx). SupportShell used to call useSupportSocket() here
  // to establish the connection, but SupportShell remounts on every route
  // change — that was reconnecting the socket on every navigation. Nothing
  // to mount here anymore; this component only reads connection state.

  if (!user) return null;

  return (
    <div className="min-h-screen bg-base-200 flex">
      <Sidebar role={user.role} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} breadcrumbs={breadcrumbs} />

        {!connected && !reconnecting && (
          <div className="px-4 pt-3">
            <OfflineBanner />
          </div>
        )}

        <motion.main
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="flex-1 min-w-0 p-4 sm:p-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}
