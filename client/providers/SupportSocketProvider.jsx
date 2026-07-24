'use client';

/**
 * BUG FIX 1: message:deleted / message:delivered / message:read used
 *   `socket.__activeTicketId` hack — ticketId not always set correctly.
 *   Fix: track active ticket via joinedRoomsRef + pass ticketId in payloads.
 *   Server should include ticketId in these events; we fall back to activeTicketId.
 *
 * BUG FIX 2: Images/files sent via socket didn't show immediately because
 *   messageReceivedRealtime only ran when OTHER users sent messages.
 *   sendMessage thunk now optimistically adds to state (see supportSlice fix).
 *   Socket still handles it for other users correctly.
 *
 * BUG FIX 3: Import paths — SOCKET_NAMESPACE / HEARTBEAT_INTERVAL_MS now
 *   come from supportconstants (the correct file).
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useDispatch, useSelector } from 'react-redux';

import { selectCurrentUser } from '../store/slices/userSlice';
import {
  setSocketConnected,
  setSocketReconnecting,
  ticketCreatedRealtime,
  ticketPatchedRealtime,
  messageReceivedRealtime,
  messageDeletedRealtime,
  messageDeliveredRealtime,
  messageReadRealtime,
  internalNoteCreatedRealtime,
  attachmentUploadedRealtime,
  setActiveUsers,
  setTypingUser,
  clearTypingUser,
} from '@/store/slices/supportSlice';
import { addIncomingNotification } from '@/store/slices/notificationSlice'; // ✅ Standard ES6 Import
import { SOCKET_NAMESPACE, HEARTBEAT_INTERVAL_MS } from '@/lib/supportconstants';

const SocketContext = createContext(null);

export function useSupportSocketContext() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSupportSocketContext must be used within <SocketProvider>');
  return ctx;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || '';

export default function SocketProvider({ children }) {
  const dispatch = useDispatch();
  const user = useSelector(selectCurrentUser);
  const socketRef = useRef(null);
  const heartbeatRef = useRef(null);
  const joinedRoomsRef = useRef(new Set());
  
  // Track the most recently joined ticketId for events that omit it
  const activeTicketIdRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user?._id) return undefined;

    const socket = io(`${SOCKET_URL}${SOCKET_NAMESPACE}`, {
      auth: { user },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    // ── Connection lifecycle ──────────────────────────────────────────────
    socket.on('connect', () => {
      setConnected(true);
      dispatch(setSocketConnected(true));
      // Re-join rooms after reconnect
      joinedRoomsRef.current.forEach((id) => socket.emit('ticket:join', { ticketId: id }));
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      dispatch(setSocketConnected(false));
      if (reason !== 'io client disconnect') {
        dispatch(setSocketReconnecting(true));
        toast.error('Connection lost. Reconnecting…', { id: 'support-socket-status' });
      }
    });

    socket.io.on('reconnect_attempt', () => dispatch(setSocketReconnecting(true)));
    socket.io.on('reconnect', () => {
      dispatch(setSocketReconnecting(false));
      toast.success('Back online.', { id: 'support-socket-status' });
    });

    socket.on('error', (err) => console.error('[SupportSocket]', err?.message));

    // ── Ticket events ─────────────────────────────────────────────────────
    socket.on('ticket:activeUsers', ({ ticketId, userIds }) => {
      dispatch(setActiveUsers({ ticketId, userIds }));
    });

    socket.on('ticket:new', (payload) => {
      dispatch(ticketCreatedRealtime(payload));
      toast(`New ticket: ${payload.ticketNumber}`, { icon: '🎫' });
    });

    socket.on('ticket:assigned', ({ ticketId, assignedAdmins }) => {
      dispatch(ticketPatchedRealtime({ ticketId, patch: { assignedAdmins, status: 'ASSIGNED' } }));
    });

    socket.on('ticket:statusChanged', ({ ticketId, status }) => {
      dispatch(ticketPatchedRealtime({ ticketId, patch: { status } }));
    });

    socket.on('ticket:priorityChanged', ({ ticketId, priority }) => {
      dispatch(ticketPatchedRealtime({ ticketId, patch: { priority } }));
    });

    socket.on('ticket:departmentChanged', ({ ticketId, department }) => {
      dispatch(ticketPatchedRealtime({ ticketId, patch: { department } }));
    });

    socket.on('ticket:escalated', ({ ticketId, ticketNumber }) => {
      dispatch(ticketPatchedRealtime({
        ticketId,
        patch: { isEscalated: true, status: 'ESCALATED', priority: 'CRITICAL' },
      }));
      toast.error(`Ticket ${ticketNumber ?? ''} escalated!`, { icon: '🚨' });
    });

    // ── Message events ────────────────────────────────────────────────────
    socket.on('message:received', ({ message }) => {
      // ticketId can be populated object or plain string
      const ticketId = message.ticket?._id ?? message.ticket ?? activeTicketIdRef.current;
      if (ticketId) dispatch(messageReceivedRealtime({ ticketId, message }));
    });

    socket.on('message:deleted', ({ ticketId, msgId }) => {
      const tid = ticketId ?? activeTicketIdRef.current;
      if (tid) dispatch(messageDeletedRealtime({ ticketId: tid, msgId }));
    });

    socket.on('message:delivered', ({ ticketId, messageId, deliveredTo }) => {
      const tid = ticketId ?? activeTicketIdRef.current;
      if (tid) dispatch(messageDeliveredRealtime({ ticketId: tid, messageId, deliveredTo }));
    });

    socket.on('message:read', ({ ticketId, messageId, msgId, userId, readBy }) => {
      const tid = ticketId ?? activeTicketIdRef.current;
      if (tid) dispatch(messageReadRealtime({
        ticketId: tid,
        messageId: messageId ?? msgId,
        readBy: readBy ?? userId,
      }));
    });

    socket.on('attachment:uploaded', ({ ticketId, attachment }) => {
      dispatch(attachmentUploadedRealtime({ ticketId, attachment }));
    });

    socket.on('internalNote:created', (payload) => {
      dispatch(internalNoteCreatedRealtime(payload));
    });

    // ── Typing ────────────────────────────────────────────────────────────
    socket.on('typing:start', ({ ticketId, userId, userName }) => {
      dispatch(setTypingUser({ ticketId, userId, userName }));
    });
    socket.on('typing:stop', ({ ticketId, userId }) => {
      dispatch(clearTypingUser({ ticketId, userId }));
    });

    // ── Notifications ─────────────────────────────────────────────────────
    socket.on('notification', (notification) => {
      dispatch(addIncomingNotification(notification)); // ✅ Now safely imported
      toast(notification.title || notification.body || 'New notification', { icon: '🔔' });
    });

    // ── SLA breach ────────────────────────────────────────────────────────
    socket.on('sla:breach', ({ ticketId, ticketNumber }) => {
      dispatch(ticketPatchedRealtime({ ticketId, patch: { isSlaBreached: true } }));
      toast.error(`SLA breached: ${ticketNumber ?? ticketId}`, { icon: '⏰' });
    });

    // ── Heartbeat ─────────────────────────────────────────────────────────
    heartbeatRef.current = setInterval(() => {
      if (socket.connected) socket.emit('ping');
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatRef.current);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?._id, dispatch]);

  // ── Public API ────────────────────────────────────────────────────────────
  const joinTicket = useCallback((ticketId) => {
    if (!ticketId) return;
    joinedRoomsRef.current.add(ticketId);
    activeTicketIdRef.current = ticketId;
    socketRef.current?.emit('ticket:join', { ticketId });
  }, []);

  const leaveTicket = useCallback((ticketId) => {
    if (!ticketId) return;
    joinedRoomsRef.current.delete(ticketId);
    if (activeTicketIdRef.current === ticketId) activeTicketIdRef.current = null;
    socketRef.current?.emit('ticket:leave', { ticketId });
  }, []);

  const startTyping = useCallback((ticketId) => {
    socketRef.current?.emit('typing:start', { ticketId });
  }, []);

  const stopTyping = useCallback((ticketId) => {
    socketRef.current?.emit('typing:stop', { ticketId });
  }, []);

  const emitDelivered = useCallback((ticketId, messageId) => {
    socketRef.current?.emit('message:delivered', { ticketId, messageId });
  }, []);

  const emitRead = useCallback((ticketId, messageId) => {
    socketRef.current?.emit('message:read', { ticketId, messageId });
  }, []);

  const value = {
    socket: socketRef.current,
    connected,
    joinTicket,
    leaveTicket,
    startTyping,
    stopTyping,
    emitDelivered,
    emitRead,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}