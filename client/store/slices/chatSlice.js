// store/slices/chatSlice.js
//
// Messages are keyed by ticketId, each holding its own normalized
// {byId, allIds} pair plus pagination cursor — this is the "chatSlice" from
// the spec, deliberately separate from ticketSlice since message volume and
// update frequency (every keystroke's typing event, every receipt) is an
// order of magnitude higher than ticket-level changes.

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import supportApi from '../../services/support/supportApi';

const extractError = (err, fallback = 'Something went wrong.') => {
  const serverMsg = err?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection.';
  return fallback;
};

const emptyThread = () => ({
  byId: {},
  allIds: [],
  hasMore: true,
  nextCursor: null,
  loading: false,
  error: null,
  typingUserIds: [],
});

// ── Thunks ────────────────────────────────────────────────────────────────

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ ticketId, cursor, direction = 'before' }, { rejectWithValue }) => {
    try {
      const data = await supportApi.listMessages(ticketId, { cursor, direction });
      return { ticketId, ...data, isLoadMore: !!cursor };
    } catch (err) {
      return rejectWithValue({ ticketId, message: extractError(err, 'Failed to load messages.') });
    }
  }
);

/**
 * Optimistic send: the reducer adds a 'sending' placeholder immediately
 * (see chatSlice.reducers.optimisticSendMessage, dispatched by the caller
 * BEFORE this thunk fires), and this thunk replaces it with the server
 * copy on success or flips it to 'failed' with a retry affordance on error.
 */
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ ticketId, clientMessageId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.sendMessage(ticketId, { ...payload, clientMessageId });
      return { ticketId, clientMessageId, message: data };
    } catch (err) {
      return rejectWithValue({ ticketId, clientMessageId, message: extractError(err, 'Message failed to send.') });
    }
  }
);

export const sendMediaMessage = createAsyncThunk(
  'chat/sendMediaMessage',
  async ({ ticketId, clientMessageId, formData, onUploadProgress }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.sendMediaMessage(ticketId, formData, onUploadProgress);
      return { ticketId, clientMessageId, message: data };
    } catch (err) {
      return rejectWithValue({ ticketId, clientMessageId, message: extractError(err, 'Upload failed.') });
    }
  }
);

export const editMessage = createAsyncThunk(
  'chat/editMessage',
  async ({ ticketId, messageId, text }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.editMessage(ticketId, messageId, text);
      return { ticketId, message: data };
    } catch (err) {
      const msg = extractError(err, 'Could not edit message.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deleteMessage = createAsyncThunk(
  'chat/deleteMessage',
  async ({ ticketId, messageId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.deleteMessage(ticketId, messageId, reason);
      return { ticketId, message: data };
    } catch (err) {
      const msg = extractError(err, 'Could not delete message.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const reactToMessage = createAsyncThunk(
  'chat/reactToMessage',
  async ({ ticketId, messageId, emoji }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.reactToMessage(ticketId, messageId, emoji);
      return { ticketId, message: data };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Reaction failed.'));
    }
  }
);

export const markMessagesRead = createAsyncThunk(
  'chat/markRead',
  async ({ ticketId, upToMessageId }, { rejectWithValue }) => {
    try {
      await supportApi.markRead(ticketId, upToMessageId);
      return { ticketId, upToMessageId };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Could not mark read.'));
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: 'chat',
  initialState: {
    threads: {}, // { [ticketId]: thread }
    activeReplyTo: {}, // { [ticketId]: messageId | null }
    draftText: {}, // { [ticketId]: string } — autosaved composer draft
  },
  reducers: {
    ensureThread(state, action) {
      const ticketId = action.payload;
      if (!state.threads[ticketId]) state.threads[ticketId] = emptyThread();
    },
    /** Dispatched immediately on submit, before the sendMessage thunk fires */
    optimisticSendMessage(state, action) {
      const { ticketId, clientMessageId, tempMessage } = action.payload;
      const thread = state.threads[ticketId] || (state.threads[ticketId] = emptyThread());
      thread.byId[clientMessageId] = { ...tempMessage, _id: clientMessageId, status: 'sending' };
      thread.allIds.push(clientMessageId);
    },
    /** Manual retry — resets a failed message back to 'sending' before re-dispatching sendMessage */
    retryMessage(state, action) {
      const { ticketId, clientMessageId } = action.payload;
      const thread = state.threads[ticketId];
      if (thread?.byId[clientMessageId]) {
        thread.byId[clientMessageId].status = 'sending';
      }
    },
    receiveMessage(state, action) {
      const message = action.payload;
      const ticketId = message.ticket;
      const thread = state.threads[ticketId] || (state.threads[ticketId] = emptyThread());
      // De-dupe: if this is the server echo of our own optimistic message
      // (matched by clientMessageId), replace the temp entry in place.
      if (message.clientMessageId && thread.byId[message.clientMessageId]) {
        delete thread.byId[message.clientMessageId];
        thread.allIds = thread.allIds.filter((id) => id !== message.clientMessageId);
      }
      if (!thread.byId[message._id]) {
        thread.allIds.push(message._id);
      }
      thread.byId[message._id] = message;
    },
    setTypingUsers(state, action) {
      const { ticketId, userId, isTyping } = action.payload;
      const thread = state.threads[ticketId] || (state.threads[ticketId] = emptyThread());
      if (isTyping) {
        if (!thread.typingUserIds.includes(userId)) thread.typingUserIds.push(userId);
      } else {
        thread.typingUserIds = thread.typingUserIds.filter((id) => id !== userId);
      }
    },
    applyDeliveredReceipt(state, action) {
      const { ticketId, userId, messageIds } = action.payload;
      const thread = state.threads[ticketId];
      if (!thread) return;
      messageIds.forEach((id) => {
        const msg = thread.byId[id];
        if (msg) {
          const receipt = msg.receipts?.find((r) => r.userId === userId);
          if (receipt) receipt.deliveredAt = new Date().toISOString();
          // Advance single-tick -> double-tick(grey). Never downgrade a message
          // that's already 'read' (read implies delivered).
          if (msg.status === 'sent') msg.status = 'delivered';
        }
      });
    },
    applyReadReceipt(state, action) {
      const { ticketId, userId, upToMessageId } = action.payload;
      const thread = state.threads[ticketId];
      if (!thread) return;
      const upToMsg = thread.byId[upToMessageId];
      if (!upToMsg) return;
      Object.values(thread.byId).forEach((msg) => {
        if (new Date(msg.createdAt) <= new Date(upToMsg.createdAt)) {
          const receipt = msg.receipts?.find((r) => r.userId === userId);
          if (receipt) receipt.readAt = new Date().toISOString();
          if (msg.status === 'sent' || msg.status === 'delivered') msg.status = 'read';
        }
      });
    },
    setReplyTo(state, action) {
      const { ticketId, messageId } = action.payload;
      state.activeReplyTo[ticketId] = messageId;
    },
    clearReplyTo(state, action) {
      state.activeReplyTo[action.payload] = null;
    },
    setDraftText(state, action) {
      const { ticketId, text } = action.payload;
      state.draftText[ticketId] = text;
    },
    clearThread(state, action) {
      delete state.threads[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state, action) => {
        const { ticketId } = action.meta.arg;
        const thread = state.threads[ticketId] || (state.threads[ticketId] = emptyThread());
        thread.loading = true;
        thread.error = null;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { ticketId, items, hasMore, nextCursor, isLoadMore } = action.payload;
        const thread = state.threads[ticketId] || (state.threads[ticketId] = emptyThread());
        thread.loading = false;
        thread.hasMore = hasMore;
        thread.nextCursor = nextCursor;
        // Messages arrive newest-first from the API; store chronologically.
        const chronological = [...items].reverse();
        chronological.forEach((m) => {
          thread.byId[m._id] = m;
        });
        const newIds = chronological.map((m) => m._id).filter((id) => !thread.allIds.includes(id));
        thread.allIds = isLoadMore ? [...newIds, ...thread.allIds] : [...thread.allIds, ...newIds];
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        const { ticketId, message } = action.payload || {};
        const thread = ticketId && state.threads[ticketId];
        if (thread) {
          thread.loading = false;
          thread.error = message;
        }
      })

      .addCase(sendMessage.fulfilled, (state, action) => {
        chatSlice.caseReducers.receiveMessage(state, { payload: action.payload.message });
      })
      .addCase(sendMessage.rejected, (state, action) => {
        const { ticketId, clientMessageId } = action.payload || {};
        const thread = ticketId && state.threads[ticketId];
        if (thread?.byId[clientMessageId]) {
          thread.byId[clientMessageId].status = 'failed';
        }
      })

      .addCase(sendMediaMessage.fulfilled, (state, action) => {
        chatSlice.caseReducers.receiveMessage(state, { payload: action.payload.message });
      })
      .addCase(sendMediaMessage.rejected, (state, action) => {
        const { ticketId, clientMessageId } = action.payload || {};
        const thread = ticketId && state.threads[ticketId];
        if (thread?.byId[clientMessageId]) {
          thread.byId[clientMessageId].status = 'failed';
        }
      })

      .addCase(editMessage.fulfilled, (state, action) => {
        const { ticketId, message } = action.payload;
        const thread = state.threads[ticketId];
        if (thread) thread.byId[message._id] = message;
      })

      .addCase(deleteMessage.fulfilled, (state, action) => {
        const { ticketId, message } = action.payload;
        const thread = state.threads[ticketId];
        if (thread) thread.byId[message._id] = message;
      })

      .addCase(reactToMessage.fulfilled, (state, action) => {
        const { ticketId, message } = action.payload;
        const thread = state.threads[ticketId];
        if (thread) thread.byId[message._id] = message;
      });
  },
});

export const {
  ensureThread,
  optimisticSendMessage,
  retryMessage,
  receiveMessage,
  setTypingUsers,
  applyDeliveredReceipt,
  applyReadReceipt,
  setReplyTo,
  clearReplyTo,
  setDraftText,
  clearThread,
} = chatSlice.actions;

export default chatSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────

const EMPTY_THREAD = emptyThread();

export const selectThread = (ticketId) => (state) => state.chat.threads[ticketId] || EMPTY_THREAD;

// createSelector needs a stable input selector per ticketId; a factory
// means each ticket's message list only recomputes when its own thread
// object changes, not on every unrelated thread update.
export const makeSelectMessagesForTicket = (ticketId) =>
  createSelector(
    (state) => state.chat.threads[ticketId],
    (thread) => (thread ? thread.allIds.map((id) => thread.byId[id]).filter((m) => !m.isDeleted) : [])
  );

export const selectTypingUsers = (ticketId) => (state) => state.chat.threads[ticketId]?.typingUserIds || [];
export const selectThreadLoading = (ticketId) => (state) => state.chat.threads[ticketId]?.loading || false;
export const selectThreadHasMore = (ticketId) => (state) => state.chat.threads[ticketId]?.hasMore ?? true;
export const selectThreadNextCursor = (ticketId) => (state) => state.chat.threads[ticketId]?.nextCursor || null;

export const selectReplyTo = (ticketId) => (state) => state.chat.activeReplyTo[ticketId] || null;
export const selectDraftText = (ticketId) => (state) => state.chat.draftText[ticketId] || '';