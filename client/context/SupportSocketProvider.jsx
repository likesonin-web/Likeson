'use client';
 

import { createContext, useContext, useEffect, useRef, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';

import {
  getSupportSocket,
  connectSupportSocket,
  disconnectSupportSocket,
  destroySupportSocket,
  emitJoinTicket,
  emitLeaveTicket,
  emitTyping,
  emitStopTyping,
  emitSendMessage,
  emitMarkDelivered,
  emitMarkRead,
  emitMarkSeen,
} from '@/services/support/supportSocket';
import { SOCKET_EVENTS } from '@/features/support/constants/support.constants';
import {
  connecting as scConnecting,
  connected as scConnected,
  disconnected as scDisconnected,
  reconnecting as scReconnecting,
  connectionError as scConnectionError,
  setUserOnline,
  setUserOffline,
} from '@/store/slices/socketSlice';
import { receiveMessage, setTypingUsers, applyDeliveredReceipt, applyReadReceipt, resendStuckMessages } from '@/store/slices/chatSlice';
import { patchTicketFromSocket, touchTicketLastMessage } from '@/store/slices/ticketSlice';
import { addIncomingNotification } from '@/store/slices/notificationSlice';

const SupportSocketContext = createContext(null);

/**
 * @param {{ token: string|null, children: React.ReactNode }} props
 */
export default function SupportSocketProvider({ token, children }) {
  const dispatch = useDispatch();
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    // No token yet (still loading auth, or logged out) — nothing to connect.
    // Also tears the socket down if a previously-logged-in user logs out,
    // rather than leaving a stale authenticated connection hanging around.
    if (!token) {
      destroySupportSocket();
      return undefined;
    }

    const socket = getSupportSocket(() => tokenRef.current);

    dispatch(scConnecting());
    connectSupportSocket();

    const onConnect = () => {
      dispatch(scConnected());
      // Auto-retry anything that got stuck 'sending'/'failed' while we
      // were disconnected — the whole point of this fix. Small delay so
      // join_ticket rooms (re-joined by each open ChatWindow's own effect)
      // have a moment to re-establish before we replay sends into them.
      setTimeout(() => dispatch(resendStuckMessages()), 300);
    };
    const onDisconnect = (reason) => dispatch(scDisconnected({ reason }));
    const onReconnectAttempt = (attempt) => dispatch(scReconnecting({ attempt }));
    const onConnectError = (err) => dispatch(scConnectionError(err?.message));

    const onMessageReceive = (message) => {
      dispatch(receiveMessage(message));
      dispatch(
        touchTicketLastMessage({
          ticketId: message.ticket,
          preview: message.text?.slice(0, 200) || `[${message.messageType}]`,
          at: message.createdAt,
        })
      );
    };

    const onTyping = ({ ticketId, userId }) => dispatch(setTypingUsers({ ticketId, userId, isTyping: true }));
    const onStopTyping = ({ ticketId, userId }) => dispatch(setTypingUsers({ ticketId, userId, isTyping: false }));

    const onDelivered = ({ ticketId, userId, messageIds }) =>
      dispatch(applyDeliveredReceipt({ ticketId, userId, messageIds }));
    const onRead = ({ ticketId, userId, upToMessageId }) =>
      dispatch(applyReadReceipt({ ticketId, userId, upToMessageId }));

    const onPresence = ({ userId, isOnline }) =>
      dispatch(isOnline ? setUserOnline({ userId }) : setUserOffline({ userId }));

    const onStatusChanged = ({ ticketId, status }) => dispatch(patchTicketFromSocket({ ticketId, changes: { status } }));

    const onAssignment = ({ ticketId, assignees }) =>
      dispatch(patchTicketFromSocket({ ticketId, changes: { currentAssignees: assignees } }));

    const onNotification = (notification) => {
      dispatch(addIncomingNotification(notification));
      toast(notification.title, { icon: '🔔' });
    };

    const onSocketError = (err) => {
      toast.error(err?.message || 'Connection error.');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('connect_error', onConnectError);

    socket.on(SOCKET_EVENTS.MESSAGE_RECEIVE, onMessageReceive);
    socket.on(SOCKET_EVENTS.TYPING, onTyping);
    socket.on(SOCKET_EVENTS.STOP_TYPING, onStopTyping);
    socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, onDelivered);
    socket.on(SOCKET_EVENTS.MESSAGE_READ, onRead);
    socket.on(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
    socket.on(SOCKET_EVENTS.STATUS_CHANGED, onStatusChanged);
    socket.on(SOCKET_EVENTS.ASSIGNMENT, onAssignment);
    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNotification);
    socket.on(SOCKET_EVENTS.ERROR, onSocketError);

    // Cleanup only fires when SupportSocketProvider itself unmounts — i.e.
    // once, when AuthSocketBridge unmounts (app teardown / full logout),
    // NOT on every route change, since this provider is mounted once at
    // the root and route pages render as its children.
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('connect_error', onConnectError);
      socket.off(SOCKET_EVENTS.MESSAGE_RECEIVE, onMessageReceive);
      socket.off(SOCKET_EVENTS.TYPING, onTyping);
      socket.off(SOCKET_EVENTS.STOP_TYPING, onStopTyping);
      socket.off(SOCKET_EVENTS.MESSAGE_DELIVERED, onDelivered);
      socket.off(SOCKET_EVENTS.MESSAGE_READ, onRead);
      socket.off(SOCKET_EVENTS.PRESENCE_UPDATE, onPresence);
      socket.off(SOCKET_EVENTS.STATUS_CHANGED, onStatusChanged);
      socket.off(SOCKET_EVENTS.ASSIGNMENT, onAssignment);
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNotification);
      socket.off(SOCKET_EVENTS.ERROR, onSocketError);
      disconnectSupportSocket();
    };
    // Reconnecting on every token *value* change (e.g. token refresh) is
    // intentional — reconnecting on every re-render is not, which is why
    // tokenRef exists above (auth() callback reads the ref, not this closure).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dispatch]);

  const value = useMemo(
    () => ({
      joinTicket: (ticketId) =>
        new Promise((resolve, reject) => {
          emitJoinTicket(ticketId, (ack) => (ack?.success ? resolve(ack) : reject(new Error(ack?.message))));
        }),
      leaveTicket: (ticketId) => emitLeaveTicket(ticketId),
      sendTyping: (ticketId) => emitTyping(ticketId),
      sendStopTyping: (ticketId) => emitStopTyping(ticketId),
      sendSocketMessage: (ticketId, payload) =>
        new Promise((resolve, reject) => {
          emitSendMessage(ticketId, payload, (ack) => (ack?.success ? resolve(ack.data) : reject(new Error(ack?.message))));
        }),
      markDelivered: (ticketId, messageIds) => emitMarkDelivered(ticketId, messageIds),
      markRead: (ticketId, upToMessageId) => emitMarkRead(ticketId, upToMessageId),
      markSeen: (ticketId) => emitMarkSeen(ticketId),
    }),
    []
  );

  return <SupportSocketContext.Provider value={value}>{children}</SupportSocketContext.Provider>;
}

/**
 * Consumed by hooks/support/useSupportSocket.js. Throws loudly if a
 * component tries to use support-socket features outside
 * <SupportSocketProvider> — better than silently no-op-ing emit calls.
 */
export function useSupportSocketContext() {
  const ctx = useContext(SupportSocketContext);
  if (!ctx) {
    throw new Error(
      'useSupportSocket() was called outside <SupportSocketProvider>. Make sure SupportSocketProvider wraps your app root (see AuthSocketBridge.jsx).'
    );
  }
  return ctx;
}