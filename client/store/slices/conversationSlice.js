import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

const extractError = (err, fallback = 'Something went wrong. Please try again.') => {
  const serverMsg = err?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection. Please check your network.';
  return fallback;
};

// ── Thunks ──────────────────────────────────────────────────────────────────

export const fetchConversations = createAsyncThunk(
  'conversations/fetchAll',
  async ({ page = 1, limit = 20, archived = false, search } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/conversations', {
        params: { page, limit, archived, search },
      });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load conversations.'));
    }
  }
);

export const fetchConversationById = createAsyncThunk(
  'conversations/fetchOne',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/conversations/${conversationId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load conversation.'));
    }
  }
);

export const createDirectConversation = createAsyncThunk(
  'conversations/createDirect',
  async (targetUserId, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/conversations/direct', { targetUserId });
      return data.data;
    } catch (err) {
      const msg = extractError(err, 'Could not start conversation.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const archiveConversation = createAsyncThunk(
  'conversations/archive',
  async ({ conversationId, archived = true }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/conversations/${conversationId}/archive`, { archived });
      return { conversationId, archived, member: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not update archive state.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const pinConversation = createAsyncThunk(
  'conversations/pin',
  async ({ conversationId, pinned = true }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/conversations/${conversationId}/pin`, { pinned });
      return { conversationId, pinned, member: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not update pin state.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const muteConversation = createAsyncThunk(
  'conversations/mute',
  async ({ conversationId, muted = true, mutedUntil = null }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/conversations/${conversationId}/mute`, { muted, mutedUntil });
      return { conversationId, muted, mutedUntil, member: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not update mute state.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deleteConversation = createAsyncThunk(
  'conversations/delete',
  async (conversationId, { rejectWithValue }) => {
    try {
      await API.delete(`/conversations/${conversationId}`);
      toast.success('Conversation deleted.');
      return conversationId;
    } catch (err) {
      const msg = extractError(err, 'Could not delete conversation.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── State ───────────────────────────────────────────────────────────────────

const initialState = {
  items: [],              // [{ conversation, unreadCount, isPinned, isMuted, lastReadAt }]
  activeConversationId: null,
  byId: {},                // conversationId -> conversation doc (detail cache)
  pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  filters: { archived: false, search: '' },
  loading: false,
  error: null,
  loaders: { list: false, direct: false, archive: false, pin: false, mute: false, remove: false, detail: false },
};

const getLoaderKey = (type) => {
  const base = type.replace(/\/(pending|fulfilled|rejected)$/, '');
  const map = {
    'conversations/fetchAll': 'list',
    'conversations/fetchOne': 'detail',
    'conversations/createDirect': 'direct',
    'conversations/archive': 'archive',
    'conversations/pin': 'pin',
    'conversations/mute': 'mute',
    'conversations/delete': 'remove',
  };
  return map[base] ?? null;
};

const conversationSlice = createSlice({
  name: 'conversations',
  initialState,
  reducers: {
    setActiveConversation: (state, action) => {
      state.activeConversationId = action.payload;
    },
    setConversationFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearConversationError: (state) => {
      state.error = null;
    },
    /** Bump/insert a conversation to the top on a real-time newMessage event. */
    upsertConversationFromSocket: (state, action) => {
      const { conversation: patch, unreadIncrement = 0 } = action.payload;
      const existingCached = state.byId[patch._id];
      const merged = existingCached ? { ...existingCached, ...patch } : patch;

      const idx = state.items.findIndex((i) => i.conversation._id === patch._id);
      if (idx >= 0) {
        state.items[idx].conversation = { ...state.items[idx].conversation, ...patch };
        if (state.activeConversationId !== patch._id) {
          state.items[idx].unreadCount += unreadIncrement;
        }
        const [item] = state.items.splice(idx, 1);
        state.items.unshift(item);
      } else {
        state.items.unshift({ conversation: merged, unreadCount: unreadIncrement, isPinned: false, isMuted: false, lastReadAt: null });
      }
      state.byId[patch._id] = merged;
    },
    resetUnreadCount: (state, action) => {
      const item = state.items.find((i) => i.conversation._id === action.payload);
      if (item) item.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // 1. ALL addCase STATEMENTS FIRST
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.items = action.payload.data ?? [];
        state.pagination = action.payload.pagination ?? state.pagination;
        state.items.forEach((i) => { state.byId[i.conversation._id] = i.conversation; });
      })
      .addCase(fetchConversationById.fulfilled, (state, action) => {
        if (action.payload) state.byId[action.payload._id] = action.payload;
      })
      .addCase(createDirectConversation.fulfilled, (state, action) => {
        const conversation = action.payload;
        state.byId[conversation._id] = conversation;
        const exists = state.items.some((i) => i.conversation._id === conversation._id);
        if (!exists) {
          state.items.unshift({ conversation, unreadCount: 0, isPinned: false, isMuted: false, lastReadAt: null });
        }
        state.activeConversationId = conversation._id;
      })
      .addCase(archiveConversation.fulfilled, (state, action) => {
        const { conversationId, archived } = action.payload;
        const item = state.items.find((i) => i.conversation._id === conversationId);
        if (archived && item) {
          state.items = state.items.filter((i) => i.conversation._id !== conversationId);
        }
      })
      .addCase(pinConversation.fulfilled, (state, action) => {
        const { conversationId, pinned } = action.payload;
        const item = state.items.find((i) => i.conversation._id === conversationId);
        if (item) item.isPinned = pinned;
      })
      .addCase(muteConversation.fulfilled, (state, action) => {
        const { conversationId, muted, mutedUntil } = action.payload;
        const item = state.items.find((i) => i.conversation._id === conversationId);
        if (item) { item.isMuted = muted; item.mutedUntil = mutedUntil; }
      })
      .addCase(deleteConversation.fulfilled, (state, action) => {
        state.items = state.items.filter((i) => i.conversation._id !== action.payload);
        delete state.byId[action.payload];
        if (state.activeConversationId === action.payload) state.activeConversationId = null;
      })
      // 2. ALL addMatcher STATEMENTS SECOND
      .addMatcher((a) => a.type.startsWith('conversations/') && a.type.endsWith('/pending'), (state, action) => {
        state.loading = true;
        state.error = null;
        const key = getLoaderKey(action.type);
        if (key) state.loaders[key] = true;
      })
      .addMatcher((a) => a.type.startsWith('conversations/') && a.type.endsWith('/rejected'), (state, action) => {
        state.loading = false;
        state.error = action.payload ?? null;
        const key = getLoaderKey(action.type);
        if (key) state.loaders[key] = false;
      })
      .addMatcher((a) => a.type.startsWith('conversations/') && a.type.endsWith('/fulfilled'), (state, action) => {
        state.loading = false;
        const key = getLoaderKey(action.type);
        if (key) state.loaders[key] = false;
      });
  },
});

export const {
  setActiveConversation,
  setConversationFilters,
  clearConversationError,
  upsertConversationFromSocket,
  resetUnreadCount,
} = conversationSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────
export const selectConversations = (s) => s.conversations.items;
export const selectConversationById = (id) => (s) => s.conversations.byId[id];
export const selectActiveConversationId = (s) => s.conversations.activeConversationId;
export const selectActiveConversation = (s) =>
  s.conversations.byId[s.conversations.activeConversationId] ?? null;
export const selectConversationPagination = (s) => s.conversations.pagination;
export const selectConversationLoaders = (s) => s.conversations.loaders;
export const selectConversationFilters = (s) => s.conversations.filters;
export const selectTotalUnreadCount = (s) =>
  s.conversations.items.reduce((sum, i) => sum + (i.unreadCount || 0), 0);

export default conversationSlice.reducer;