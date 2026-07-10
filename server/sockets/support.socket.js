// sockets/support.socket.js
//
// Registers the `/support` Socket.IO namespace. Call `registerSupportSockets(io)`
// once at server startup, after the base `io` server has its Redis adapter
// attached (required for room authorization and presence to work correctly
// across multiple Node instances at 10k-concurrent scale).

import { SOCKET_EVENTS } from '../constants/support.constants.js';
import { supportSocketAuthMiddleware } from './supportSocket.auth.js';
import * as messageService from '../services/message.service.js';
import * as participantService from '../services/participant.service.js';
import { assertCanViewTicket } from '../utils/supportPermissions.util.js';
import SupportTicket from '../models/SupportTicket.js';
import mongoose from 'mongoose';
import {
  setUserOnline,
  setUserOffline,
  refreshPresence,
  setTyping,
  clearTyping,
} from '../utils/supportRedis.util.js';
import { SocketAuthError } from '../utils/errors.js';

const ticketRoom = (ticketId) => `ticket:${ticketId}`;
const userRoom = (userId) => `user:${userId}`;

/**
 * Room authorization guard — re-checks visibility on EVERY socket event
 * that targets a specific ticket, not just at join_ticket time. A user's
 * access can change mid-session (e.g. removed as participant), and sockets
 * bypass the Express middleware chain entirely, so this is the only
 * enforcement point for the socket transport.
 */
async function assertSocketCanAccessTicket(socket, ticketId) {
  const ticket = await SupportTicket.findById(ticketId).lean();
  if (!ticket) throw new SocketAuthError('Ticket not found.');

  const isActiveParticipant = socket.rooms.has(ticketRoom(ticketId));
  assertCanViewTicket({
    userRole: socket.user.role,
    userId: socket.user._id,
    ticket,
    isActiveParticipant,
  });
  return ticket;
}

export function registerSupportSockets(io) {
  const nsp = io.of('/support');
  nsp.use(supportSocketAuthMiddleware());

  nsp.on('connection', (socket) => {
    const userId = String(socket.user._id);

    socket.join(userRoom(userId));
    setUserOnline(userId).catch((err) => console.error('[support.socket] setUserOnline failed:', err.message));

    // ── JOIN TICKET ─────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.JOIN_TICKET, async ({ ticketId }, ack) => {
      try {
        const ticket = await SupportTicket.findById(ticketId).lean();
        if (!ticket) throw new SocketAuthError('Ticket not found.');

        const isActiveParticipant = await participantService.isActiveParticipant(ticketId, userId);
        assertCanViewTicket({ userRole: socket.user.role, userId, ticket, isActiveParticipant });

        socket.join(ticketRoom(ticketId));

        // Staff/partners become an actual participant row the first time
        // they join the room (see createTicket's note — visibility != participation).
        if (!isActiveParticipant) {
          await participantService.addParticipant({
            ticketId,
            actor: socket.user,
            deviceInfo: { platform: 'socket' },
            userId,
            role: socket.user.role,
            io: nsp,
          });
        } else {
          await participantService.touchLastSeen({ ticketId, userId });
        }

        ack?.({ success: true });
      } catch (err) {
        ack?.({ success: false, message: err.message, code: err.code ?? 'SOCKET_ERROR' });
      }
    });

    // ── LEAVE TICKET (leaves the socket room only — does not remove
    // the user as a participant; use the REST DELETE /participants/:userId
    // for actually removing someone from the conversation) ────────────────
    socket.on(SOCKET_EVENTS.LEAVE_TICKET, ({ ticketId }) => {
      socket.leave(ticketRoom(ticketId));
    });

    // ── TYPING ──────────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.TYPING, async ({ ticketId }) => {
      try {
        if (!socket.rooms.has(ticketRoom(ticketId))) return;
        await setTyping(ticketId, userId);
        await participantService.setTypingState({ ticketId, userId, isTyping: true });
        socket.to(ticketRoom(ticketId)).emit(SOCKET_EVENTS.TYPING, { ticketId, userId });
      } catch (err) {
        console.error('[support.socket] typing failed:', err.message);
      }
    });

    socket.on(SOCKET_EVENTS.STOP_TYPING, async ({ ticketId }) => {
      try {
        if (!socket.rooms.has(ticketRoom(ticketId))) return;
        await clearTyping(ticketId, userId);
        await participantService.setTypingState({ ticketId, userId, isTyping: false });
        socket.to(ticketRoom(ticketId)).emit(SOCKET_EVENTS.STOP_TYPING, { ticketId, userId });
      } catch (err) {
        console.error('[support.socket] stop_typing failed:', err.message);
      }
    });

    // ── MESSAGE SEND ────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.MESSAGE_SEND, async (payload, ack) => {
      try {
        const { ticketId, ...messagePayload } = payload;
        await assertSocketCanAccessTicket(socket, ticketId);

        const message = await messageService.sendMessage({
          ticketId,
          actor: socket.user,
          deviceInfo: { platform: 'socket' },
          payload: messagePayload,
          io: nsp,
        });

        ack?.({ success: true, data: messageService.serializeMessage(message) });
      } catch (err) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message, code: err.code ?? 'SOCKET_ERROR' });
        ack?.({ success: false, message: err.message, code: err.code ?? 'SOCKET_ERROR' });
      }
    });

    // ── DELIVERED ───────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, async ({ ticketId, messageIds }) => {
      try {
        if (!socket.rooms.has(ticketRoom(ticketId))) return;
        const validIds = (messageIds || []).filter((id) => mongoose.isValidObjectId(id));
        if (!validIds.length) return;
        await messageService.markDelivered({ ticketId, userId, messageIds: validIds });
        socket.to(ticketRoom(ticketId)).emit(SOCKET_EVENTS.MESSAGE_DELIVERED, { ticketId, userId, messageIds: validIds });
      } catch (err) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message, code: err.code ?? 'SOCKET_ERROR' });
      }
    });

    // ── READ / SEEN ─────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.MESSAGE_READ, async ({ ticketId, upToMessageId }) => {
      try {
        if (!socket.rooms.has(ticketRoom(ticketId))) return;
        // upToMessageId can be a client-side temp id (nanoid) if the caller
        // is racing an optimistic message that hasn't been ack'd by the
        // server yet — silently skip instead of letting Mongoose CastError
        // bubble up and crash the whole process.
        if (!mongoose.isValidObjectId(upToMessageId)) return;
        await messageService.markRead({ ticketId, userId, upToMessageId });
        await participantService.markRead({ ticketId, userId, upToMessageId });
        socket.to(ticketRoom(ticketId)).emit(SOCKET_EVENTS.MESSAGE_READ, { ticketId, userId, upToMessageId });
      } catch (err) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message, code: err.code ?? 'SOCKET_ERROR' });
      }
    });

    socket.on(SOCKET_EVENTS.MESSAGE_SEEN, async ({ ticketId }) => {
      try {
        if (!socket.rooms.has(ticketRoom(ticketId))) return;
        await participantService.touchLastSeen({ ticketId, userId });
        socket.to(ticketRoom(ticketId)).emit(SOCKET_EVENTS.MESSAGE_SEEN, { ticketId, userId, at: new Date() });
      } catch (err) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: err.message, code: err.code ?? 'SOCKET_ERROR' });
      }
    });

    // ── PRESENCE / HEARTBEAT ────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.HEARTBEAT, async () => {
      try {
        await refreshPresence(userId);
      } catch (err) {
        console.error('[support.socket] heartbeat failed:', err.message);
      }
    });

    // ── RECONNECT (explicit resync request, distinct from transport-level
    // reconnect — client calls this after regaining connectivity to fetch
    // anything it may have missed while offline) ──────────────────────────
    socket.on(SOCKET_EVENTS.RECONNECT, async ({ ticketId, sinceMessageId }, ack) => {
      try {
        await assertSocketCanAccessTicket(socket, ticketId);
        const result = await messageService.listMessages({
          ticketId,
          actor: socket.user,
          query: { cursor: sinceMessageId ? undefined : undefined, direction: 'after', limit: 100 },
        });
        ack?.({ success: true, data: result });
      } catch (err) {
        ack?.({ success: false, message: err.message });
      }
    });

    // ── DISCONNECT ──────────────────────────────────────────────────────
    socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
      try {
        // With the Redis adapter, fetchSockets() reflects sockets across
        // ALL instances for this room, so presence stays correct even when
        // the same user has tabs open against different app servers.
        const remaining = await nsp.in(userRoom(userId)).fetchSockets();
        const stillConnected = remaining.some((s) => s.id !== socket.id);
        if (!stillConnected) {
          await setUserOffline(userId);
          nsp.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, isOnline: false, at: new Date() });
        }
      } catch (err) {
        console.error('[support.socket] disconnect cleanup failed:', err.message);
      }
    });

    nsp.emit(SOCKET_EVENTS.PRESENCE_UPDATE, { userId, isOnline: true, at: new Date() });
  });

  return nsp;
}