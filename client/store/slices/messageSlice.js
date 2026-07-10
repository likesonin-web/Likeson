// src/redux/slices/messageSlice.js
//
// Messages are keyed per-conversation to avoid one giant flat list re-rendering
// every chat screen. Sending is optimistic: a temp message is inserted
// immediately with status='sending', then reconciled with the server response
// (or marked 'failed' on rejection) — this is what makes the composer feel instant.

import { createSlice, createAsyncThunk, nanoid } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';
import { MESSAGE_PAGE_SIZE } from '../../constants/chatConstants';

const extractError = (err, fallback = 'Something went wrong. Please try again.') => {
  const serverMsg = err?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection. Please check your network.';
  return fallback;
};

// ── Thunks ──────────────────────────────────────────────────────────────────

export const fetchMessages = createAsyncThunk(
  'messages/fetchPage',
  async ({ conversationId, before, limit = MESSAGE_PAGE_SIZE }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/support/messages/${conversationId}`, { params: { before, limit } });
      return { conversationId, items: data.data, pagination: data.pagination, before };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load messages.'));
    }
  }
);

export const sendMessage = createAsyncThunk(
  'messages/send',
  async ({ conversationId, type = 'text', body, attachmentId, replyTo, mentions, clientMessageId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/support/messages/${conversationId}`, {
        type, body, attachmentId, replyTo, mentions, clientMessageId,
      });
      return { conversationId, message: data.data, clientMessageId };
    } catch (err) {
      const msg = extractError(err, 'Message failed to send.');
      return rejectWithValue({ conversationId, clientMessageId, message: msg });
    }
  }
);

export const editMessage = createAsyncThunk(
  'messages/edit',
  async ({ messageId, body, conversationId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/support/messages/message/${messageId}`, { body });
      return { conversationId, message: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not edit message.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deleteMessageForMe = createAsyncThunk(
  'messages/deleteForMe',
  async ({ messageId, conversationId }, { rejectWithValue }) => {
    try {
      await API.delete(`/support/messages/message/${messageId}/me`);
      return { conversationId, messageId };
    } catch (err) {
      const msg = extractError(err, 'Could not delete message.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deleteMessageForEveryone = createAsyncThunk(
  'messages/deleteForEveryone',
  async ({ messageId, conversationId }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/support/messages/message/${messageId}/everyone`);
      return { conversationId, message: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not delete message for everyone.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const forwardMessage = createAsyncThunk(
  'messages/forward',
  async ({ messageId, targetConversationId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/support/messages/message/${messageId}/forward/${targetConversationId}`);
      return { conversationId: targetConversationId, message: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not forward message.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const markConversationRead = createAsyncThunk(
  'messages/markRead',
  async ({ conversationId, upToMessageId }, { rejectWithValue }) => {
    try {
      await API.post(`/support/messages/${conversationId}/read`, { upToMessageId });
      return { conversationId, upToMessageId };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Could not mark as read.'));
    }
  }
);

export const searchMessages = createAsyncThunk(
  'messages/search',
  async ({ conversationId, q, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/support/messages/${conversationId}/search`, { params: { q, page, limit } });
      return { conversationId, results: data.data, pagination: data.pagination };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Search failed.'));
    }
  }
);

// ── State shape: byConversation[conversationId] = { items, hasMore, pagination, searchResults } ──

const emptyThread = () => ({
  items: [],       // sorted ascending by createdAt
  hasMore: true,
  loadingMore: false,
  searchResults: [],
});

const initialState = {
  byConversation: {},
  loading: false,
  error: null,
  loaders: { fetch: false, send: false, edit: false, remove: false, search: false },
};

const getThread = (state, conversationId) => {
  if (!state.byConversation[conversationId]) state.byConversation[conversationId] = emptyThread();
  return state.byConversation[conversationId];
};

const messageSlice = createSlice({
  name: 'messages',
  initialState,
  reducers: {
    clearMessageError: (state) => { state.error = null; },

    /** Real-time inbound message from Socket.IO — dedupes by clientMessageId/_id. */
    receiveSocketMessage: (state, action) => {
      const message = action.payload;
      const thread = getThread(state, message.conversation);
      const existingIdx = thread.items.findIndex(
        (m) => m._id === message._id || (m.clientMessageId && m.clientMessageId === message.clientMessageId)
      );
      if (existingIdx >= 0) {
        thread.items[existingIdx] = message;
      } else {
        thread.items.push(message);
      }
    },

    applySocketEdit: (state, action) => {
      const message = action.payload;
      const thread = getThread(state, message.conversation);
      const idx = thread.items.findIndex((m) => m._id === message._id);
      if (idx >= 0) thread.items[idx] = message;
    },

    applySocketDelete: (state, action) => {
      const { conversationId, messageId } = action.payload;
      const applyTo = (thread) => {
        const idx = thread.items.findIndex((m) => m._id === messageId);
        if (idx >= 0) {
          thread.items[idx] = { ...thread.items[idx], type: 'deleted', body: null, isDeletedForEveryone: true };
          return true;
        }
        return false;
      };
      if (conversationId && state.byConversation[conversationId]) {
        applyTo(state.byConversation[conversationId]);
        return;
      }
      // Fallback: conversationId wasn't provided (kept out of the socket
      // payload to keep it small) — scan cached threads for the message.
      for (const key of Object.keys(state.byConversation)) {
        if (applyTo(state.byConversation[key])) break;
      }
    },

    applyReactionUpdate: (state, action) => {
      const { conversationId, messageId, reactions } = action.payload;
      const thread = state.byConversation[conversationId];
      if (!thread) return;
      const msg = thread.items.find((m) => m._id === messageId);
      if (msg) msg.reactions = reactions;
    },

    clearSearchResults: (state, action) => {
      const thread = state.byConversation[action.payload];
      if (thread) thread.searchResults = [];
    },

    /** Plain optimistic insert used by useMessages when sending via socket
     * directly (REST thunk has its own built-in optimistic .pending case). */
    insertOptimisticMessage: (state, action) => {
      const { conversationId, clientMessageId, type, body, replyTo } = action.payload;
      const thread = getThread(state, conversationId);
      thread.items.push({
        _id: `temp-${clientMessageId}`,
        clientMessageId,
        conversation: conversationId,
        type,
        body,
        replyTo,
        status: 'sending',
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      });
    },

    markOptimisticFailed: (state, action) => {
      const { conversationId, clientMessageId } = action.payload;
      const thread = state.byConversation[conversationId];
      if (!thread) return;
      const idx = thread.items.findIndex((m) => m.clientMessageId === clientMessageId && m.isOptimistic);
      if (idx >= 0) thread.items[idx].status = 'failed';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMessages.pending, (state, action) => {
        const thread = getThread(state, action.meta.arg.conversationId);
        thread.loadingMore = true;
        state.loaders.fetch = true;
      })
      .addCase(fetchMessages.fulfilled, (state, action) => {
        const { conversationId, items, before } = action.payload;
        const thread = getThread(state, conversationId);
        thread.loadingMore = false;
        state.loaders.fetch = false;
        thread.hasMore = items.length > 0;
        if (before) {
          // Prepend older page, de-duping.
          const existingIds = new Set(thread.items.map((m) => m._id));
          const newer = items.filter((m) => !existingIds.has(m._id));
          thread.items = [...newer, ...thread.items];
        } else {
          thread.items = items;
        }
      })
      .addCase(fetchMessages.rejected, (state, action) => {
        state.loaders.fetch = false;
        state.error = action.payload;
        const thread = getThread(state, action.meta.arg.conversationId);
        thread.loadingMore = false;
      })

      // ── Optimistic send ─────────────────────────────────────────────────
      .addCase(sendMessage.pending, (state, action) => {
        state.loaders.send = true;
        const { conversationId, type = 'text', body, clientMessageId, replyTo } = action.meta.arg;
        const thread = getThread(state, conversationId);
        thread.items.push({
          _id: `temp-${clientMessageId}`,
          clientMessageId,
          conversation: conversationId,
          type,
          body,
          replyTo,
          status: 'sending',
          createdAt: new Date().toISOString(),
          isOptimistic: true,
        });
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        state.loaders.send = false;
        const { conversationId, message, clientMessageId } = action.payload;
        const thread = getThread(state, conversationId);
        const idx = thread.items.findIndex((m) => m.clientMessageId === clientMessageId && m.isOptimistic);
        if (idx >= 0) thread.items[idx] = message;
        else thread.items.push(message);
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.loaders.send = false;
        const { conversationId, clientMessageId, message } = action.payload || {};
        if (conversationId) {
          const thread = getThread(state, conversationId);
          const idx = thread.items.findIndex((m) => m.clientMessageId === clientMessageId && m.isOptimistic);
          if (idx >= 0) thread.items[idx].status = 'failed';
        }
        toast.error(message || 'Message failed to send.');
      })

      .addCase(editMessage.fulfilled, (state, action) => {
        const { conversationId, message } = action.payload;
        const thread = getThread(state, conversationId);
        const idx = thread.items.findIndex((m) => m._id === message._id);
        if (idx >= 0) thread.items[idx] = message;
      })

      .addCase(deleteMessageForMe.fulfilled, (state, action) => {
        const { conversationId, messageId } = action.payload;
        const thread = getThread(state, conversationId);
        thread.items = thread.items.filter((m) => m._id !== messageId);
      })

      .addCase(deleteMessageForEveryone.fulfilled, (state, action) => {
        const { conversationId, message } = action.payload;
        const thread = getThread(state, conversationId);
        const idx = thread.items.findIndex((m) => m._id === message._id);
        if (idx >= 0) thread.items[idx] = message;
      })

      .addCase(forwardMessage.fulfilled, (state, action) => {
        const { conversationId, message } = action.payload;
        const thread = getThread(state, conversationId);
        thread.items.push(message);
        toast.success('Message forwarded.');
      })

      .addCase(searchMessages.pending, (state) => { state.loaders.search = true; })
      .addCase(searchMessages.fulfilled, (state, action) => {
        state.loaders.search = false;
        const { conversationId, results } = action.payload;
        const thread = getThread(state, conversationId);
        thread.searchResults = results;
      })
      .addCase(searchMessages.rejected, (state) => { state.loaders.search = false; });
  },
});

export const {
  clearMessageError,
  receiveSocketMessage,
  applySocketEdit,
  applySocketDelete,
  applyReactionUpdate,
  clearSearchResults,
  insertOptimisticMessage,
  markOptimisticFailed,
} = messageSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────
export const selectMessagesForConversation = (conversationId) => (s) =>
  s.messages.byConversation[conversationId]?.items ?? [];
export const selectHasMoreMessages = (conversationId) => (s) =>
  s.messages.byConversation[conversationId]?.hasMore ?? true;
export const selectMessageLoaders = (s) => s.messages.loaders;
export const selectSearchResults = (conversationId) => (s) =>
  s.messages.byConversation[conversationId]?.searchResults ?? [];

export const generateClientMessageId = () => nanoid();

export default messageSlice.reducer;
