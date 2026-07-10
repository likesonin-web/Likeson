import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '@/store/api';
import toast from 'react-hot-toast';

const extractError = (err, fallback = 'Something went wrong. Please try again.') => {
  const serverMsg = err?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection. Please check your network.';
  return fallback;
};

// ── Thunks ──────────────────────────────────────────────────────────────────

export const fetchGroupMembers = createAsyncThunk(
  'groups/fetchMembers',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/support/groups/${conversationId}/members`);
      return { conversationId, members: data.data };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Could not load members.'));
    }
  }
);

export const createGroup = createAsyncThunk(
  'groups/create',
  async ({ title, memberIds }, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/support/groups', { title, memberIds });
      toast.success('Group created.');
      return data.data;
    } catch (err) {
      const msg = extractError(err, 'Could not create group.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const renameGroup = createAsyncThunk(
  'groups/rename',
  async ({ conversationId, title }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/support/groups/${conversationId}/rename`, { title });
      toast.success('Group renamed.');
      return data.data;
    } catch (err) {
      const msg = extractError(err, 'Could not rename group.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const archiveGroup = createAsyncThunk(
  'groups/archive',
  async ({ conversationId, archived = true }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/support/groups/${conversationId}/archive`, { archived });
      toast.success(archived ? 'Group archived.' : 'Group unarchived.');
      return { conversationId, archived, conversation: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not update archive state.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const lockGroup = createAsyncThunk(
  'groups/lock',
  async ({ conversationId, locked }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/support/groups/${conversationId}/lock`, { locked });
      toast.success(locked ? 'Group locked.' : 'Group unlocked.');
      return data.data;
    } catch (err) {
      const msg = extractError(err, 'Could not update lock state.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const deleteGroup = createAsyncThunk(
  'groups/delete',
  async (conversationId, { rejectWithValue }) => {
    try {
      await API.delete(`/support/groups/${conversationId}`);
      toast.success('Group deleted.');
      return conversationId;
    } catch (err) {
      const msg = extractError(err, 'Could not delete group.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const addGroupMembers = createAsyncThunk(
  'groups/addMembers',
  async ({ conversationId, memberIds }, { rejectWithValue, dispatch }) => {
    try {
      const { data } = await API.post(`/support/groups/${conversationId}/members`, { memberIds });
      toast.success('Members added.');
      dispatch(fetchGroupMembers(conversationId)); // roster changed — refresh it
      return { conversationId, conversation: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not add members.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const removeGroupMember = createAsyncThunk(
  'groups/removeMember',
  async ({ conversationId, userId }, { rejectWithValue }) => {
    try {
      await API.delete(`/support/groups/${conversationId}/members/${userId}`);
      toast.success('Member removed.');
      return { conversationId, userId };
    } catch (err) {
      const msg = extractError(err, 'Could not remove member.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const assignModerator = createAsyncThunk(
  'groups/assignModerator',
  async ({ conversationId, userId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/support/groups/${conversationId}/members/${userId}/moderator`);
      toast.success('Moderator assigned.');
      return { conversationId, userId, member: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not assign moderator.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const muteGroupMember = createAsyncThunk(
  'groups/muteMember',
  async ({ conversationId, userId, muted, mutedUntil = null }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/support/groups/${conversationId}/members/${userId}/mute`, { muted, mutedUntil });
      toast.success(muted ? 'Member muted.' : 'Member unmuted.');
      return { conversationId, userId, muted, member: data.data };
    } catch (err) {
      const msg = extractError(err, 'Could not update mute state.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ── State ───────────────────────────────────────────────────────────────────

const initialState = {
  membersByConversation: {}, // conversationId -> [{ user, role, isMuted, ... }]
  loading: false,
  error: null,
  loaders: {
    fetchMembers: false, create: false, rename: false, archive: false,
    lock: false, remove: false, addMembers: false, removeMember: false,
    assignModerator: false, muteMember: false,
  },
};

const LOADER_MAP = {
  'groups/fetchMembers': 'fetchMembers',
  'groups/create': 'create',
  'groups/rename': 'rename',
  'groups/archive': 'archive',
  'groups/lock': 'lock',
  'groups/delete': 'remove',
  'groups/addMembers': 'addMembers',
  'groups/removeMember': 'removeMember',
  'groups/assignModerator': 'assignModerator',
  'groups/muteMember': 'muteMember',
};

const getBaseType = (type) => type.replace(/\/(pending|fulfilled|rejected)$/, '');
const getLoaderKey = (type) => LOADER_MAP[getBaseType(type)] ?? null;

const groupSlice = createSlice({
  name: 'groups',
  initialState,
  reducers: {
    clearGroupError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addMatcher((a) => a.type.startsWith('groups/') && a.type.endsWith('/pending'), (state, action) => {
        state.loading = true;
        state.error = null;
        const key = getLoaderKey(action.type);
        if (key) state.loaders[key] = true;
      })
      .addMatcher((a) => a.type.startsWith('groups/') && a.type.endsWith('/rejected'), (state, action) => {
        state.loading = false;
        state.error = action.payload ?? null;
        const key = getLoaderKey(action.type);
        if (key) state.loaders[key] = false;
      })
      .addMatcher((a) => a.type.startsWith('groups/') && a.type.endsWith('/fulfilled'), (state, action) => {
        state.loading = false;
        const key = getLoaderKey(action.type);
        if (key) state.loaders[key] = false;
      })
      .addCase(fetchGroupMembers.fulfilled, (state, action) => {
        state.membersByConversation[action.payload.conversationId] = action.payload.members;
      })
      .addCase(removeGroupMember.fulfilled, (state, action) => {
        const { conversationId, userId } = action.payload;
        const list = state.membersByConversation[conversationId];
        if (list) state.membersByConversation[conversationId] = list.filter((m) => m.user._id !== userId);
      })
      .addCase(assignModerator.fulfilled, (state, action) => {
        const { conversationId, userId, member } = action.payload;
        const list = state.membersByConversation[conversationId];
        if (list) {
          const idx = list.findIndex((m) => m.user._id === userId);
          if (idx >= 0) list[idx] = { ...list[idx], role: member.role };
        }
      })
      .addCase(muteGroupMember.fulfilled, (state, action) => {
        const { conversationId, userId, muted } = action.payload;
        const list = state.membersByConversation[conversationId];
        if (list) {
          const idx = list.findIndex((m) => m.user._id === userId);
          if (idx >= 0) list[idx] = { ...list[idx], isMuted: muted };
        }
      });
  },
});

export const { clearGroupError } = groupSlice.actions;

export const selectGroupMembers = (conversationId) => (s) => s.groups.membersByConversation[conversationId] ?? null;
export const selectGroupLoaders = (s) => s.groups.loaders;
export const selectGroupError = (s) => s.groups.error;

export default groupSlice.reducer;