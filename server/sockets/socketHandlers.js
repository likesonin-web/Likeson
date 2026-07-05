// sockets/socketHandlers.js
//
// All Socket.IO event wiring for the module. Rooms used:
//   conversation:<id>  — one room per conversation (also covers group/complaint rooms)
//   user:<id>          — personal room for direct-to-user pushes (presence, cross-device sync)

import { SOCKET_EVENTS, socketRoomForConversation, socketRoomForUser } from '../constants/socketEvents.js';
import PermissionService from '../services/PermissionService.js';
import MessageService from '../services/MessageService.js';
import ReactionService from '../services/ReactionService.js';
import TypingService from '../services/TypingService.js';
import PresenceService from '../services/PresenceService.js';
import Message from '../models/Message.js';

const ackOrNoop = (ack) => (typeof ack === 'function' ? ack : () => {});

export const registerSocketHandlers = (io, socket, serverInstanceId) => {
  const user = socket.user;

  // ── Connect: join personal room, register presence, broadcast online ──────
  socket.join(socketRoomForUser(user._id.toString()));

  PresenceService.registerConnection({
    userId: user._id,
    socketId: socket.id,
    serverInstanceId,
    platform: socket.handshake.auth?.platform || 'web',
  }).catch((err) => console.error('[socket] registerConnection failed:', err.message));

  io.emit(SOCKET_EVENTS.USER_ONLINE, { userId: user._id.toString() });

  // ── joinConversation / leaveConversation ───────────────────────────────
  socket.on(SOCKET_EVENTS.JOIN_CONVERSATION, async (conversationId, ack) => {
    const respond = ackOrNoop(ack);
    try {
      await PermissionService.assertIsActiveMember(conversationId, user._id);
      socket.join(socketRoomForConversation(conversationId));
      respond({ success: true });
    } catch (err) {
      respond({ success: false, message: err.message });
    }
  });

  socket.on(SOCKET_EVENTS.LEAVE_CONVERSATION, (conversationId, ack) => {
    socket.leave(socketRoomForConversation(conversationId));
    ackOrNoop(ack)({ success: true });
  });

  // ── typing / stopTyping ─────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.TYPING, async ({ conversationId }) => {
    try {
      await PermissionService.assertIsActiveMember(conversationId, user._id);
      await TypingService.startTyping(conversationId, user._id);
      socket.to(socketRoomForConversation(conversationId)).emit(SOCKET_EVENTS.TYPING, {
        conversationId, userId: user._id.toString(),
      });
    } catch (err) {
      // Silently ignore — typing is best-effort, never surfaces an error to client.
    }
  });

  socket.on(SOCKET_EVENTS.STOP_TYPING, async ({ conversationId }) => {
    await TypingService.stopTyping(conversationId, user._id).catch(() => {});
    socket.to(socketRoomForConversation(conversationId)).emit(SOCKET_EVENTS.STOP_TYPING, {
      conversationId, userId: user._id.toString(),
    });
  });

  // ── newMessage ──────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.NEW_MESSAGE, async (payload, ack) => {
    const respond = ackOrNoop(ack);
    try {
      const message = await MessageService.sendMessage(user, payload.conversationId, payload);
      io.to(socketRoomForConversation(payload.conversationId)).emit(SOCKET_EVENTS.NEW_MESSAGE, message);
      respond({ success: true, message });
    } catch (err) {
      respond({ success: false, message: err.message });
    }
  });

  // ── editMessage / deleteMessage ─────────────────────────────────────────
  socket.on(SOCKET_EVENTS.EDIT_MESSAGE, async ({ messageId, body }, ack) => {
    const respond = ackOrNoop(ack);
    try {
      const message = await MessageService.editMessage(user, messageId, body);
      io.to(socketRoomForConversation(message.conversation.toString())).emit(SOCKET_EVENTS.EDIT_MESSAGE, message);
      respond({ success: true, message });
    } catch (err) {
      respond({ success: false, message: err.message });
    }
  });

  socket.on(SOCKET_EVENTS.DELETE_MESSAGE, async ({ messageId, scope }, ack) => {
    const respond = ackOrNoop(ack);
    try {
      const message = scope === 'everyone'
        ? await MessageService.deleteForEveryone(user, messageId)
        : await MessageService.deleteForMe(user._id, messageId);

      if (scope === 'everyone') {
        io.to(socketRoomForConversation(message.conversation.toString())).emit(SOCKET_EVENTS.DELETE_MESSAGE, {
          messageId, scope,
        });
      }
      respond({ success: true });
    } catch (err) {
      respond({ success: false, message: err.message });
    }
  });

  // ── reactionAdded / reactionRemoved ─────────────────────────────────────
  socket.on(SOCKET_EVENTS.REACTION_ADDED, async ({ messageId, emoji }, ack) => {
    const respond = ackOrNoop(ack);
    try {
      const reaction = await ReactionService.react(user, messageId, emoji);
      const msg = await Message.findById(messageId).select('conversation').lean();
      io.to(socketRoomForConversation(msg.conversation.toString())).emit(SOCKET_EVENTS.REACTION_ADDED, {
        messageId, emoji, userId: user._id.toString(),
      });
      respond({ success: true, reaction });
    } catch (err) {
      respond({ success: false, message: err.message });
    }
  });

  socket.on(SOCKET_EVENTS.REACTION_REMOVED, async ({ messageId }, ack) => {
    const respond = ackOrNoop(ack);
    try {
      await ReactionService.removeReaction(user, messageId);
      const msg = await Message.findById(messageId).select('conversation').lean();
      if (msg) {
        io.to(socketRoomForConversation(msg.conversation.toString())).emit(SOCKET_EVENTS.REACTION_REMOVED, {
          messageId, userId: user._id.toString(),
        });
      }
      respond({ success: true });
    } catch (err) {
      respond({ success: false, message: err.message });
    }
  });

  // ── messageSeen / messageDelivered ──────────────────────────────────────
  socket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, async ({ messageId }) => {
    await MessageService.markDelivered(messageId, user._id).catch(() => {});
  });

  socket.on(SOCKET_EVENTS.MESSAGE_SEEN, async ({ conversationId, upToMessageId }, ack) => {
    const respond = ackOrNoop(ack);
    try {
      const result = await MessageService.markRead(conversationId, user._id, upToMessageId);
      socket.to(socketRoomForConversation(conversationId)).emit(SOCKET_EVENTS.MESSAGE_SEEN, {
        conversationId, userId: user._id.toString(), upToMessageId,
      });
      respond({ success: true, ...result });
    } catch (err) {
      respond({ success: false, message: err.message });
    }
  });

  // ── Heartbeat for presence sweep ─────────────────────────────────────────
  socket.on('ping-presence', () => {
    PresenceService.heartbeat(socket.id).catch(() => {});
  });

  // ── disconnect ────────────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
    await TypingService.stopTyping(null, user._id).catch(() => {}); // best-effort; per-conversation cleared by TTL anyway
    await PresenceService.registerDisconnection({ userId: user._id, socketId: socket.id }).catch(() => {});

    const stillOnline = await PresenceService.isOnline(user._id);
    if (!stillOnline) {
      io.emit(SOCKET_EVENTS.USER_OFFLINE, { userId: user._id.toString() });
    }
  });
};
