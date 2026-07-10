// src/redux/slices/presenceSlice.js
//
// Purely client-side cache of presence events pushed over Socket.IO
// (USER_ONLINE / USER_OFFLINE). Does not duplicate the backend's User.isOnline
// field — this is a real-time overlay so the UI updates without refetching.

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  onlineUserIds: {}, // userId -> true
  lastSeenByUser: {}, // userId -> ISO date string
};

const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    setUserOnline: (state, action) => {
      state.onlineUserIds[action.payload] = true;
    },
    setUserOffline: (state, action) => {
      delete state.onlineUserIds[action.payload];
      state.lastSeenByUser[action.payload] = new Date().toISOString();
    },
    hydratePresence: (state, action) => {
      // Bulk-set on initial conversation/member fetch (from User.isOnline/lastseen).
      action.payload.forEach(({ userId, isOnline, lastseen }) => {
        if (isOnline) state.onlineUserIds[userId] = true;
        if (lastseen) state.lastSeenByUser[userId] = lastseen;
      });
    },
  },
});

export const { setUserOnline, setUserOffline, hydratePresence } = presenceSlice.actions;

export const selectIsUserOnline = (userId) => (s) => !!s.presence.onlineUserIds[userId];
export const selectLastSeen = (userId) => (s) => s.presence.lastSeenByUser[userId] ?? null;

export default presenceSlice.reducer;
