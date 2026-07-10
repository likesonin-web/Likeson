// store/slices/socketSlice.js
//
// Pure connection-state store. The actual Socket.IO client instance lives
// in services/support/supportSocket.js (a module-level singleton, same
// pattern as the app's existing socket provider) — this slice only tracks
// UI-relevant state so components can react to it without reaching into a
// non-serializable object in the store on every render.

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  connected: false,
  connecting: false,
  reconnecting: false,
  reconnectAttempt: 0,
  lastError: null,
  lastConnectedAt: null,

  // Presence: userId -> boolean, updated from support:presence_update events
  onlineUsers: {},
};

const socketSlice = createSlice({
  name: 'supportSocket',
  initialState,
  reducers: {
    connecting(state) {
      state.connecting = true;
      state.lastError = null;
    },
    connected(state) {
      state.connected = true;
      state.connecting = false;
      state.reconnecting = false;
      state.reconnectAttempt = 0;
      state.lastError = null;
      state.lastConnectedAt = new Date().toISOString();
    },
    disconnected(state, action) {
      state.connected = false;
      state.connecting = false;
      state.lastError = action.payload?.reason || null;
    },
    reconnecting(state, action) {
      state.reconnecting = true;
      state.reconnectAttempt = action.payload?.attempt ?? state.reconnectAttempt + 1;
    },
    connectionError(state, action) {
      state.connecting = false;
      state.lastError = action.payload || 'Connection error.';
    },
    setUserOnline(state, action) {
      state.onlineUsers[action.payload.userId] = true;
    },
    setUserOffline(state, action) {
      state.onlineUsers[action.payload.userId] = false;
    },
    setBulkPresence(state, action) {
      state.onlineUsers = { ...state.onlineUsers, ...action.payload };
    },
  },
});

export const {
  connecting,
  connected,
  disconnected,
  reconnecting,
  connectionError,
  setUserOnline,
  setUserOffline,
  setBulkPresence,
} = socketSlice.actions;

export default socketSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────

export const selectSocketConnected = (state) => state.supportSocket.connected;
export const selectSocketConnecting = (state) => state.supportSocket.connecting;
export const selectSocketReconnecting = (state) => state.supportSocket.reconnecting;
export const selectSocketReconnectAttempt = (state) => state.supportSocket.reconnectAttempt;
export const selectSocketError = (state) => state.supportSocket.lastError;
export const selectIsUserOnline = (userId) => (state) => !!state.supportSocket.onlineUsers[userId];
export const selectOnlineUsersMap = (state) => state.supportSocket.onlineUsers;
