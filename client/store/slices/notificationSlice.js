import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ==========================================
// --- UTILITIES
// ==========================================
const extractError = (err, fallback = 'Something went wrong. Please try again.') => {
  const serverMsg = err?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection. Please check your network.';
  return fallback;
};

// ==========================================
// --- THUNKS: SUPPORT (/support/notifications)
// ==========================================

export const listNotifications = createAsyncThunk(
  'notifications/fetchSupport',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/support/notifications', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load support notifications.'));
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markSupportRead',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/support/notifications/${id}/read`);
      return data.notification || data; 
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to mark as read.'));
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllSupportRead',
  async (_, { rejectWithValue }) => {
    try {
      await API.patch('/support/notifications/read-all');
      return true;
    } catch (err) {
      const msg = extractError(err, 'Failed to mark all as read.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deleteSupportNotification = createAsyncThunk(
  'notifications/deleteSupport',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/support/notifications/${id}`);
      return id;
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to delete notification.'));
    }
  }
);

// ==========================================
// --- THUNKS: GENERAL (/notifications)
// ==========================================

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchAll',
  async (params = {}, { rejectWithValue }) => {
    try {
      const response = await API.get('/notifications', { params });
      return response.data; // { success, pagination, data: [] }
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to load notifications.'));
    }
  }
);

export const fetchUnreadCount = createAsyncThunk(
  'notifications/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.get('/notifications/unread-count');
      return response.data; // { success, unreadCount }
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to get count.'));
    }
  }
);

export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (id, { rejectWithValue }) => {
    try {
      const response = await API.patch(`/notifications/${id}/read`);
      return response.data; // { success, data: { notification } }
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to update.'));
    }
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await API.patch('/notifications/read-all');
      return response.data; // { success, message, modified }
    } catch (error) {
      return rejectWithValue(extractError(error, 'Update failed.'));
    }
  }
);

export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/notifications/${id}`);
      return id; // Return the ID so we can remove it from state
    } catch (error) {
      return rejectWithValue(extractError(error, 'Delete failed.'));
    }
  }
);

export const sendNotification = createAsyncThunk(
  'notifications/send',
  async (notificationData, { rejectWithValue }) => {
    try {
      const response = await API.post('/notifications/send', notificationData);
      toast.success('Notification sent successfully');
      return response.data;
    } catch (error) {
      return rejectWithValue(extractError(error, 'Failed to send.'));
    }
  }
);

// ==========================================
// --- SLICE CONFIGURATION & STATE
// ==========================================

const initialState = {
  items: [],
  pagination: { page: 1, limit: 20, total: 0 },
  unreadCount: 0,
  loading: false,
  error: null,
  loaders: {
    list: false,
    markRead: false,
    markAllRead: false,
    remove: false,
    send: false,
  },
};

// Maps loader keys dynamically based on the thunk type prefix to track individual loading states
const LOADER_MAP = {
  'notifications/fetchSupport': 'list',
  'notifications/fetchAll': 'list',
  'notifications/markSupportRead': 'markRead',
  'notifications/markAsRead': 'markRead',
  'notifications/markAllSupportRead': 'markAllRead',
  'notifications/markAllAsRead': 'markAllRead',
  'notifications/deleteSupport': 'remove',
  'notifications/delete': 'remove',
  'notifications/send': 'send',
};

const getBaseType = (type) => type.replace(/\/(pending|fulfilled|rejected)$/, '');
const getLoaderKey = (type) => LOADER_MAP[getBaseType(type)] || null;

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    // Both of these do the exact same thing, included both to prevent breaking your components
    receiveNotification: (state, action) => {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },
    addIncomingNotification: (state, action) => {
      state.items.unshift(action.payload);
      state.unreadCount += 1;
    },
    clearNotificationError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    // 1. Explicit Handlers
    builder.addCase(fetchUnreadCount.fulfilled, (state, action) => {
      state.unreadCount = action.payload.unreadCount;
    });

    // 2. Generic Matchers (Grouped logic to handle both Support and General thunks without duplicating code)
    builder
      // --- PENDING ---
      .addMatcher(
        (action) => action.type.startsWith('notifications/') && action.type.endsWith('/pending'),
        (state, action) => {
          state.loading = true;
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = true;
        }
      )
      // --- REJECTED ---
      .addMatcher(
        (action) => action.type.startsWith('notifications/') && action.type.endsWith('/rejected'),
        (state, action) => {
          state.loading = false;
          state.error = action.payload ?? null;
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = false;
        }
      )
      // --- FULFILLED (Loading State Cleanup) ---
      .addMatcher(
        (action) => action.type.startsWith('notifications/') && action.type.endsWith('/fulfilled'),
        (state, action) => {
          state.loading = false;
          const key = getLoaderKey(action.type);
          if (key) state.loaders[key] = false;
        }
      )
      // --- FULFILLED: FETCH LIST ---
      .addMatcher(
        (action) =>
          action.type === listNotifications.fulfilled.type ||
          action.type === fetchNotifications.fulfilled.type,
        (state, action) => {
          // Normalize payload (Support returns .notifications, General returns .data)
          state.items = action.payload.notifications || action.payload.data || [];
          state.pagination = action.payload.pagination || {};
          
          // If the API returns a specific unreadCount, use it. Otherwise, calculate it locally.
          state.unreadCount = action.payload.unreadCount ?? state.items.filter((n) => !n.isRead).length;
        }
      )
      // --- FULFILLED: MARK SINGLE READ ---
      .addMatcher(
        (action) =>
          action.type === markNotificationRead.fulfilled.type ||
          action.type === markAsRead.fulfilled.type,
        (state, action) => {
          // Extract the updated item robustly depending on which API responded
          const updated = action.payload.data || action.payload; 
          const id = updated?._id || action.meta.arg; 

          const item = state.items.find((n) => n._id === id);
          if (item && !item.isRead) {
            item.isRead = true;
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
        }
      )
      // --- FULFILLED: MARK ALL READ ---
      .addMatcher(
        (action) =>
          action.type === markAllNotificationsRead.fulfilled.type ||
          action.type === markAllAsRead.fulfilled.type,
        (state) => {
          state.items.forEach((n) => { n.isRead = true; });
          state.unreadCount = 0;
          toast.success('All marked as read');
        }
      )
      // --- FULFILLED: DELETE ---
      .addMatcher(
        (action) =>
          action.type === deleteSupportNotification.fulfilled.type ||
          action.type === deleteNotification.fulfilled.type,
        (state, action) => {
          const removedId = action.payload;
          const item = state.items.find((n) => n._id === removedId);
          if (item && !item.isRead) {
            state.unreadCount = Math.max(0, state.unreadCount - 1);
          }
          state.items = state.items.filter((n) => n._id !== removedId);
        }
      );
  },
});

// ==========================================
// --- ACTIONS & SELECTORS
// ==========================================

export const { receiveNotification, addIncomingNotification, clearNotificationError } = notificationSlice.actions;

export const selectAllNotifications = (state) => state.notifications.items;
export const selectUnreadCount = (state) => state.notifications.unreadCount;
export const selectNotificationPagination = (state) => state.notifications.pagination;
export const selectNotificationLoading = (state) => state.notifications.loading;
export const selectNotificationLoaders = (state) => state.notifications.loaders;
export const selectNotificationError = (state) => state.notifications.error;

export default notificationSlice.reducer;