// store/slices/ticketSlice.js

import { createSlice, createAsyncThunk, createSelector, createEntityAdapter } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import supportApi from '../../services/support/supportApi';

// ── Helpers ───────────────────────────────────────────────────────────────

const extractError = (err, fallback = 'Something went wrong. Please try again.') => {
  const serverMsg = err?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection. Please check your network.';
  return fallback;
};

const ticketsAdapter = createEntityAdapter({
  selectId: (ticket) => ticket._id,
  sortComparer: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
});

// ── Thunks ────────────────────────────────────────────────────────────────

export const createTicket = createAsyncThunk(
  'ticket/create',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.createTicket(payload);
      toast.success(`Ticket ${data.ticketNumber} created.`);
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not create ticket.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchTickets = createAsyncThunk(
  'ticket/fetchList',
  async (params = {}, { rejectWithValue }) => {
    try {
      const data = await supportApi.listTickets(params);
      return { ...data, isLoadMore: !!params.cursor };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load tickets.'));
    }
  }
);

export const fetchTicketById = createAsyncThunk(
  'ticket/fetchOne',
  async (ticketId, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getTicket(ticketId);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load ticket.'));
    }
  }
);

export const updateTicket = createAsyncThunk(
  'ticket/update',
  async ({ ticketId, updates }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.updateTicket(ticketId, updates);
      toast.success('Ticket updated.');
      return data;
    } catch (err) {
      const msg = extractError(err, 'Update failed.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const changeTicketStatus = createAsyncThunk(
  'ticket/changeStatus',
  async ({ ticketId, status, reason }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.changeStatus(ticketId, { status, reason });
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not change status.');
      toast.error(msg);
      return rejectWithValue({ ticketId, message: msg });
    }
  }
);

export const changeTicketPriority = createAsyncThunk(
  'ticket/changePriority',
  async ({ ticketId, priority, reason }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.changePriority(ticketId, { priority, reason });
      return data;
    } catch (err) {
      const msg = extractError(err, 'Could not change priority.');
      toast.error(msg);
      return rejectWithValue({ ticketId, message: msg });
    }
  }
);

export const assignTicket = createAsyncThunk(
  'ticket/assign',
  async ({ ticketId, assignees, note }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.assignTicket(ticketId, { assignees, note });
      toast.success('Ticket assigned.');
      return data;
    } catch (err) {
      const msg = extractError(err, 'Assignment failed.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchAssignmentHistory = createAsyncThunk(
  'ticket/fetchAssignmentHistory',
  async (ticketId, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getAssignmentHistory(ticketId);
      return { ticketId, history: data };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load assignment history.'));
    }
  }
);

export const fetchTicketTimeline = createAsyncThunk(
  'ticket/fetchTimeline',
  async ({ ticketId, before } = {}, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getTimeline(ticketId, before ? { before } : {});
      return { ticketId, timeline: data };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load timeline.'));
    }
  }
);

export const rateTicket = createAsyncThunk(
  'ticket/rate',
  async ({ ticketId, rating, comment }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.rateTicket(ticketId, { rating, comment });
      toast.success('Thanks for your feedback!');
      return { ticketId, rating: data };
    } catch (err) {
      const msg = extractError(err, 'Could not submit rating.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const fetchParticipants = createAsyncThunk(
  'ticket/fetchParticipants',
  async (ticketId, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.listParticipants(ticketId);
      return { ticketId, participants: data };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Failed to load participants.'));
    }
  }
);

export const addParticipant = createAsyncThunk(
  'ticket/addParticipant',
  async ({ ticketId, userId, role }, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.addParticipant(ticketId, { userId, role });
      toast.success('Participant added.');
      return { ticketId, participant: data };
    } catch (err) {
      const msg = extractError(err, 'Could not add participant.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const removeParticipant = createAsyncThunk(
  'ticket/removeParticipant',
  async ({ ticketId, userId, reason }, { rejectWithValue }) => {
    try {
      await supportApi.removeParticipant(ticketId, userId, reason);
      toast.success('Participant removed.');
      return { ticketId, userId };
    } catch (err) {
      const msg = extractError(err, 'Could not remove participant.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── Initial state ─────────────────────────────────────────────────────────

const initialState = ticketsAdapter.getInitialState({
  nextCursor: null,
  hasMore: true,
  listLoading: false,
  listError: null,

  filters: {
    status: null,
    priority: null,
    ticketType: null,
    search: '',
    assignee: null,
    department: null,
    dateFrom: null,
    dateTo: null,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  },

  activeTicketId: null,
  activeTicketLoading: false,
  activeTicketError: null,

  participantsByTicket: {},
  assignmentHistoryByTicket: {},
  timelineByTicket: {},

  pinnedTicketIds: [],
  recentlyViewedIds: [],

  loaders: {
    create: false,
    update: false,
    changeStatus: false,
    changePriority: false,
    assign: false,
    rate: false,
  },
});

// ── Slice ─────────────────────────────────────────────────────────────────

const ticketSlice = createSlice({
  name: 'ticket',
  initialState,
  reducers: {
    setFilters(state, action) {
      state.filters = { ...state.filters, ...action.payload };
      state.nextCursor = null;
      state.hasMore = true;
    },
    resetFilters(state) {
      state.filters = initialState.filters;
      state.nextCursor = null;
      state.hasMore = true;
    },
    clearActiveTicket(state) {
      state.activeTicketId = null;
      state.activeTicketError = null;
    },
    pinTicket(state, action) {
      if (!state.pinnedTicketIds.includes(action.payload)) {
        state.pinnedTicketIds.unshift(action.payload);
      }
    },
    unpinTicket(state, action) {
      state.pinnedTicketIds = state.pinnedTicketIds.filter((id) => id !== action.payload);
    },
    touchRecentlyViewed(state, action) {
      state.recentlyViewedIds = [
        action.payload,
        ...state.recentlyViewedIds.filter((id) => id !== action.payload),
      ].slice(0, 10);
    },
    patchTicketFromSocket(state, action) {
      const { ticketId, changes } = action.payload;
      if (state.entities[ticketId]) {
        Object.assign(state.entities[ticketId], changes);
      }
    },
    touchTicketLastMessage(state, action) {
      const { ticketId, preview, at } = action.payload;
      const t = state.entities[ticketId];
      if (t) {
        t.lastMessageAt = at;
        t.lastMessagePreview = preview;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createTicket.pending, (state) => {
        state.loaders.create = true;
      })
      .addCase(createTicket.fulfilled, (state, action) => {
        state.loaders.create = false;
        ticketsAdapter.addOne(state, action.payload);
      })
      .addCase(createTicket.rejected, (state) => {
        state.loaders.create = false;
      })

      .addCase(fetchTickets.pending, (state) => {
        state.listLoading = true;
        state.listError = null;
      })
      .addCase(fetchTickets.fulfilled, (state, action) => {
        state.listLoading = false;
        const { items, hasMore, nextCursor, isLoadMore } = action.payload;
        if (isLoadMore) {
          ticketsAdapter.addMany(state, items);
        } else {
          ticketsAdapter.setAll(state, items);
        }
        state.hasMore = hasMore;
        state.nextCursor = nextCursor;
      })
      .addCase(fetchTickets.rejected, (state, action) => {
        state.listLoading = false;
        state.listError = action.payload;
      })

      .addCase(fetchTicketById.pending, (state, action) => {
        state.activeTicketId = action.meta.arg;
        state.activeTicketLoading = true;
        state.activeTicketError = null;
      })
      .addCase(fetchTicketById.fulfilled, (state, action) => {
        state.activeTicketLoading = false;
        ticketsAdapter.upsertOne(state, action.payload);
      })
      .addCase(fetchTicketById.rejected, (state, action) => {
        state.activeTicketLoading = false;
        state.activeTicketError = action.payload;
      })

      .addCase(updateTicket.pending, (state) => {
        state.loaders.update = true;
      })
      .addCase(updateTicket.fulfilled, (state, action) => {
        state.loaders.update = false;
        ticketsAdapter.upsertOne(state, action.payload);
      })
      .addCase(updateTicket.rejected, (state) => {
        state.loaders.update = false;
      })

      .addCase(changeTicketStatus.pending, (state, action) => {
        state.loaders.changeStatus = true;
        const { ticketId, status } = action.meta.arg;
        const t = state.entities[ticketId];
        if (t) {
          t._previousStatus = t.status;
          t.status = status;
        }
      })
      .addCase(changeTicketStatus.fulfilled, (state, action) => {
        state.loaders.changeStatus = false;
        ticketsAdapter.upsertOne(state, action.payload);
      })
      .addCase(changeTicketStatus.rejected, (state, action) => {
        state.loaders.changeStatus = false;
        const { ticketId } = action.payload || {};
        const t = ticketId && state.entities[ticketId];
        if (t && t._previousStatus) {
          t.status = t._previousStatus;
          delete t._previousStatus;
        }
      })

      .addCase(changeTicketPriority.pending, (state, action) => {
        state.loaders.changePriority = true;
        const { ticketId, priority } = action.meta.arg;
        const t = state.entities[ticketId];
        if (t) {
          t._previousPriority = t.priority;
          t.priority = priority;
        }
      })
      .addCase(changeTicketPriority.fulfilled, (state, action) => {
        state.loaders.changePriority = false;
        ticketsAdapter.upsertOne(state, action.payload);
      })
      .addCase(changeTicketPriority.rejected, (state, action) => {
        state.loaders.changePriority = false;
        const { ticketId } = action.payload || {};
        const t = ticketId && state.entities[ticketId];
        if (t && t._previousPriority) {
          t.priority = t._previousPriority;
          delete t._previousPriority;
        }
      })

      .addCase(assignTicket.pending, (state) => {
        state.loaders.assign = true;
      })
      .addCase(assignTicket.fulfilled, (state, action) => {
        state.loaders.assign = false;
        ticketsAdapter.upsertOne(state, action.payload);
      })
      .addCase(assignTicket.rejected, (state) => {
        state.loaders.assign = false;
      })

      .addCase(fetchAssignmentHistory.fulfilled, (state, action) => {
        state.assignmentHistoryByTicket[action.payload.ticketId] = action.payload.history;
      })

      .addCase(fetchTicketTimeline.fulfilled, (state, action) => {
        const { ticketId, timeline } = action.payload;
        const existing = state.timelineByTicket[ticketId] || [];
        state.timelineByTicket[ticketId] = [...existing, ...timeline].filter(
          (item, idx, arr) => arr.findIndex((i) => i._id === item._id) === idx
        );
      })

      .addCase(rateTicket.pending, (state) => {
        state.loaders.rate = true;
      })
      .addCase(rateTicket.fulfilled, (state, action) => {
        state.loaders.rate = false;
        const t = state.entities[action.payload.ticketId];
        if (t) {
          t.status = 'closed';
          t.rating = action.payload.rating._id;
        }
      })
      .addCase(rateTicket.rejected, (state) => {
        state.loaders.rate = false;
      })

      .addCase(fetchParticipants.fulfilled, (state, action) => {
        state.participantsByTicket[action.payload.ticketId] = action.payload.participants;
      })
      .addCase(addParticipant.fulfilled, (state, action) => {
        const { ticketId, participant } = action.payload;
        const list = state.participantsByTicket[ticketId] || [];
        state.participantsByTicket[ticketId] = [...list, participant];
      })
      .addCase(removeParticipant.fulfilled, (state, action) => {
        const { ticketId, userId } = action.payload;
        const list = state.participantsByTicket[ticketId] || [];
        state.participantsByTicket[ticketId] = list.filter((p) => p.userId?._id !== userId && p.userId !== userId);
      });
  },
});

export const {
  setFilters,
  resetFilters,
  clearActiveTicket,
  pinTicket,
  unpinTicket,
  touchRecentlyViewed,
  patchTicketFromSocket,
  touchTicketLastMessage,
} = ticketSlice.actions;

export default ticketSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────

const adapterSelectors = ticketsAdapter.getSelectors((state) => state.ticket);

export const selectAllTickets = adapterSelectors.selectAll;
export const selectTicketEntities = adapterSelectors.selectEntities;
export const selectTicketById = (ticketId) => (state) => adapterSelectors.selectById(state, ticketId);

export const selectActiveTicketId = (state) => state.ticket.activeTicketId;
export const selectActiveTicket = (state) =>
  state.ticket.activeTicketId ? adapterSelectors.selectById(state, state.ticket.activeTicketId) : null;
export const selectActiveTicketLoading = (state) => state.ticket.activeTicketLoading;
export const selectActiveTicketError = (state) => state.ticket.activeTicketError;

export const selectTicketFilters = (state) => state.ticket.filters;
export const selectTicketListLoading = (state) => state.ticket.listLoading;
export const selectTicketListError = (state) => state.ticket.listError;
export const selectTicketHasMore = (state) => state.ticket.hasMore;
export const selectTicketNextCursor = (state) => state.ticket.nextCursor;

export const selectTicketLoaders = (state) => state.ticket.loaders;

export const selectPinnedTicketIds = (state) => state.ticket.pinnedTicketIds;
export const selectRecentlyViewedIds = (state) => state.ticket.recentlyViewedIds;

export const selectParticipantsForTicket = (ticketId) => (state) =>
  state.ticket.participantsByTicket[ticketId] || [];
export const selectAssignmentHistoryForTicket = (ticketId) => (state) =>
  state.ticket.assignmentHistoryByTicket[ticketId] || [];
export const selectTimelineForTicket = (ticketId) => (state) => state.ticket.timelineByTicket[ticketId] || [];

// ── Memoized derived selectors ─────────────────────────────────────────────

export const selectPinnedTickets = createSelector(
  [selectAllTickets, selectPinnedTicketIds],
  (tickets, pinnedIds) => pinnedIds.map((id) => tickets.find((t) => t._id === id)).filter(Boolean)
);

export const selectRecentlyViewedTickets = createSelector(
  [selectAllTickets, selectRecentlyViewedIds],
  (tickets, recentIds) => recentIds.map((id) => tickets.find((t) => t._id === id)).filter(Boolean)
);

export const selectTicketsByStatus = createSelector(
  [selectAllTickets, (_, status) => status],
  (tickets, status) => tickets.filter((t) => t.status === status)
);

export const selectOpenTicketCount = createSelector([selectAllTickets], (tickets) =>
  tickets.filter((t) => !['resolved', 'closed', 'rejected'].includes(t.status)).length
);

export const selectOverdueTickets = createSelector([selectAllTickets], (tickets) =>
  tickets.filter((t) => {
    if (!t.sla?.resolutionDueAt) return false;
    if (['resolved', 'closed', 'rejected'].includes(t.status)) return false;
    return new Date(t.sla.resolutionDueAt) < new Date();
  })
);
