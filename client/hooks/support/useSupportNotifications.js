// hooks/support/useSupportNotifications.js
//
// Does NOT introduce a new notification store — reuses the existing
// notificationSlice (which already has listNotifications/markNotificationRead
// /markAllNotificationsRead thunks hitting /support/notifications). This
// hook just filters that shared list down to support-related types for
// components that only care about the support bell/panel.

import { useMemo, useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteSupportNotification,
  selectAllNotifications,
  selectUnreadCount,
  selectNotificationLoaders,
} from '../../store/slices/notificationSlice';

const SUPPORT_NOTIFICATION_TYPES = [
  'Support_Ticket_Created',
  'Support_New_Message',
  'Support_Assignment',
  'Support_Mention',
  'Support_Status_Change',
  'Support_Participant_Added',
  'Support_Ticket_Closed',
  'Support_Ticket_Reopened',
];

export function useSupportNotifications({ autoFetch = true } = {}) {
  const dispatch = useDispatch();
  const allNotifications = useSelector(selectAllNotifications);
  const unreadCount = useSelector(selectUnreadCount);
  const loaders = useSelector(selectNotificationLoaders);

  const supportNotifications = useMemo(
    () => allNotifications.filter((n) => SUPPORT_NOTIFICATION_TYPES.includes(n.type)),
    [allNotifications]
  );

  const supportUnreadCount = useMemo(
    () => supportNotifications.filter((n) => !n.isRead).length,
    [supportNotifications]
  );

  useEffect(() => {
    if (autoFetch) dispatch(listNotifications({ types: SUPPORT_NOTIFICATION_TYPES }));
  }, [autoFetch, dispatch]);

  const markRead = useCallback((id) => dispatch(markNotificationRead(id)), [dispatch]);
  const markAllRead = useCallback(() => dispatch(markAllNotificationsRead()), [dispatch]);
  const remove = useCallback((id) => dispatch(deleteSupportNotification(id)), [dispatch]);

  return {
    notifications: supportNotifications,
    unreadCount: supportUnreadCount,
    totalUnreadCount: unreadCount,
    loading: loaders.list,
    markRead,
    markAllRead,
    remove,
  };
}

export default useSupportNotifications;
