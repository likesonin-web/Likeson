'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Check } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useSupportNotifications } from '../../../hooks/support/useSupportNotifications';
import { EmptyState } from '../shared/StateViews';

dayjs.extend(relativeTime);

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const { notifications, unreadCount, markRead, markAllRead } = useSupportNotifications();

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="btn btn-ghost btn-circle relative"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-error text-error-content text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto card bg-base-100 shadow-depth-lg z-50"
            role="menu"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 sticky top-0 bg-base-100">
              <h3 className="text-sm font-bold">Notifications</h3>
              {unreadCount > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs font-semibold text-primary hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <EmptyState icon="inbox" title="You're all caught up" description="New ticket activity will show up here." />
            ) : (
              <ul>
                {notifications.slice(0, 20).map((n) => (
                  <li key={n._id}>
                    <Link
                      href={n.deepLink?.referenceId ? `/admin/support/${n.deepLink.referenceId}` : '#'}
                      onClick={() => !n.isRead && markRead(n._id)}
                      className={`flex items-start gap-2 px-4 py-3 hover:bg-base-200 transition-colors ${
                        !n.isRead ? 'bg-primary/5' : ''
                      }`}
                    >
                      {!n.isRead && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                      <div className={`flex-1 min-w-0 ${n.isRead ? 'ml-3.5' : ''}`}>
                        <p className="text-sm font-semibold truncate">{n.title}</p>
                        <p className="text-xs text-base-content/60 truncate">{n.body}</p>
                        <p className="text-[11px] text-base-content/40 mt-0.5">{dayjs(n.createdAt).fromNow()}</p>
                      </div>
                      {n.isRead && <Check className="w-3.5 h-3.5 text-base-content/30 shrink-0 mt-1" />}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
