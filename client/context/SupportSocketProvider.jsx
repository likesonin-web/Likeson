'use client';

/**
 * SupportSocketProvider.jsx — Likeson.in
 *
 * FIX: Previously, the entire socket connection lifecycle (connect,
 * event-listener binding, heartbeat, disconnect) lived inside the
 * useSupportSocket() hook, and that hook was called directly from
 * SupportShell — which remounts on every navigation between
 * /support, /support/[ticketId], /admin/support/dashboard, etc.
 * (different route = different page component tree in the App Router,
 * so SupportShell unmounts and remounts each time).
 *
 * That meant: every single navigation inside the Support Center
 * disconnected the socket and reconnected it from scratch — dropping
 * in-flight typing indicators, occasionally missing the odd realtime
 * event fired in the gap, and adding needless reconnect churn at scale
 * (10,000 concurrent users reconnecting on every click is exactly the
 * kind of thing that overloads a Socket.IO/Redis-adapter cluster).
 *
 * FIX: the connection lifecycle now lives HERE, mounted exactly once,
 * near the root of the tree (inside AuthSocketBridge, next to the
 * existing SocketProvider) and never unmounts for the lifetime of the
 * session. useSupportSocket() (hooks/support/useSupportSocket.js) no
 * longer owns the connection — it's now a thin hook that just returns
 * the emit-helper functions, safe to call from any component without
 * triggering a new connect/disconnect cycle.
 */

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
import { receiveMessage, setTypingUsers, applyDeliveredReceipt, applyReadReceipt } from '@/store/slices/chatSlice';
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

    const onConnect = () => dispatch(scConnected());
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

    // Edit/delete/react all just upsert the (already fully-populated)
    // message by _id — receiveMessage is a generic upsert reducer, exactly
    // what's needed here too so every participant's screen updates without
    // a refresh, not just the actor who made the change.
    const onMessageEdit = (message) => dispatch(receiveMessage(message));
    const onMessageDelete = (message) => dispatch(receiveMessage(message));
    const onMessageReact = (message) => dispatch(receiveMessage(message));

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
    socket.on(SOCKET_EVENTS.MESSAGE_EDIT, onMessageEdit);
    socket.on(SOCKET_EVENTS.MESSAGE_DELETE, onMessageDelete);
    socket.on(SOCKET_EVENTS.MESSAGE_REACT, onMessageReact);
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
      socket.off(SOCKET_EVENTS.MESSAGE_EDIT, onMessageEdit);
      socket.off(SOCKET_EVENTS.MESSAGE_DELETE, onMessageDelete);
      socket.off(SOCKET_EVENTS.MESSAGE_REACT, onMessageReact);
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
          // Without this timeout, a silently-no-op'd emit (e.g. the socket
          // singleton not created yet — see emitJoinTicket's `socket?.emit`)
          // never invokes the ack callback at all, so this Promise would
          // hang forever: neither resolving nor rejecting, silently, with
          // no error for any caller to catch or retry on.
          const timer = setTimeout(() => reject(new Error('Timed out waiting to join ticket room.')), 5000);
          emitJoinTicket(ticketId, (ack) => {
            clearTimeout(timer);
            if (ack?.success) resolve(ack);
            else reject(new Error(ack?.message || 'Join ticket failed.'));
          });
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