// services/support/supportSocket.js
//
// Module-level singleton, same pattern as the app's existing socket
// provider — one connection per browser tab, shared across every component
// via the useSupportSocket hook. Not a React hook itself so it can be
// imported and used from non-component code (e.g. a service worker) too.

import { io } from 'socket.io-client';
import { SOCKET_EVENTS, HEARTBEAT_INTERVAL_MS } from '../../features/support/constants/support.constants';

let socket = null;
let heartbeatTimer = null;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';

/**
 * @param {() => string|null} getToken  returns the current JWT (read fresh
 *   on every (re)connect attempt, not captured once at module-load time,
 *   so a token refresh mid-session is picked up automatically).
 */
export function getSupportSocket(getToken) {
  if (socket) return socket;

  socket = io(`${SOCKET_URL}/support`, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
    randomizationFactor: 0.5,
    transports: ['websocket', 'polling'],
    auth: (cb) => cb({ token: getToken?.() }),
  });

  socket.on('connect', () => {
    startHeartbeat();
  });

  socket.on('disconnect', () => {
    stopHeartbeat();
  });

  return socket;
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    socket?.emit(SOCKET_EVENTS.HEARTBEAT);
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function connectSupportSocket() {
  if (socket && !socket.connected) socket.connect();
}

export function disconnectSupportSocket() {
  stopHeartbeat();
  socket?.disconnect();
}

export function destroySupportSocket() {
  stopHeartbeat();
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

// ── Emit helpers (thin, typed-by-convention wrappers over socket.emit) ────

export const emitJoinTicket = (ticketId, ack) => socket?.emit(SOCKET_EVENTS.JOIN_TICKET, { ticketId }, ack);
export const emitLeaveTicket = (ticketId) => socket?.emit(SOCKET_EVENTS.LEAVE_TICKET, { ticketId });
export const emitTyping = (ticketId) => socket?.emit(SOCKET_EVENTS.TYPING, { ticketId });
export const emitStopTyping = (ticketId) => socket?.emit(SOCKET_EVENTS.STOP_TYPING, { ticketId });

export const emitSendMessage = (ticketId, payload, ack) =>
  socket?.emit(SOCKET_EVENTS.MESSAGE_SEND, { ticketId, ...payload }, ack);

/**
 * Promise wrapper around emitSendMessage with a hard timeout. Used by
 * chatSlice#sendMessage as the PRIMARY send path — the socket already
 * auto-reconnects and buffers emits made while briefly disconnected
 * (e.g. backend restarting under nodemon), which a fresh axios POST does
 * not. Falls through to REST only if this times out or the socket was
 * never connected in the first place.
 *
 * @returns {Promise<object>} the created message doc from the ack
 */
export function sendMessageOverSocket(ticketId, payload, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('Socket not initialized'));
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('Socket send timed out'));
      }
    }, timeoutMs);

    emitSendMessage(ticketId, payload, (ack) => {
      if (settled) return; // timeout already fired, ignore late ack
      settled = true;
      clearTimeout(timer);
      if (ack?.success) resolve(ack.data);
      else reject(new Error(ack?.message || 'Message send failed'));
    });
  });
}

export const emitMarkDelivered = (ticketId, messageIds) =>
  socket?.emit(SOCKET_EVENTS.MESSAGE_DELIVERED, { ticketId, messageIds });

export const emitMarkRead = (ticketId, upToMessageId) =>
  socket?.emit(SOCKET_EVENTS.MESSAGE_READ, { ticketId, upToMessageId });

export const emitMarkSeen = (ticketId) => socket?.emit(SOCKET_EVENTS.MESSAGE_SEEN, { ticketId });

export const emitReconnectResync = (ticketId, sinceMessageId, ack) =>
  socket?.emit(SOCKET_EVENTS.RECONNECT, { ticketId, sinceMessageId }, ack);

export function isSupportSocketConnected() {
  return !!socket?.connected;
}

export default {
  getSupportSocket,
  connectSupportSocket,
  disconnectSupportSocket,
  destroySupportSocket,
  emitJoinTicket,
  emitLeaveTicket,
  emitTyping,
  emitStopTyping,
  emitSendMessage,
  sendMessageOverSocket,
  isSupportSocketConnected,
  emitMarkDelivered,
  emitMarkRead,
  emitMarkSeen,
  emitReconnectResync,
};