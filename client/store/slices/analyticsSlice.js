// store/slices/analyticsSlice.js

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import supportApi from '../../services/support/supportApi';

const extractError = (err, fallback = 'Failed to load analytics.') => err?.response?.data?.message || fallback;

export const fetchAnalyticsOverview = createAsyncThunk(
  'supportAnalytics/fetchOverview',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getAnalyticsOverview(params);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchAnalyticsVolume = createAsyncThunk(
  'supportAnalytics/fetchVolume',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getAnalyticsVolume(params);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchAnalyticsResponseTimes = createAsyncThunk(
  'supportAnalytics/fetchResponseTimes',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getAnalyticsResponseTimes(params);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchAnalyticsSLA = createAsyncThunk(
  'supportAnalytics/fetchSLA',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getAnalyticsSLA(params);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchAnalyticsCategoryBreakdown = createAsyncThunk(
  'supportAnalytics/fetchCategoryBreakdown',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getAnalyticsCategoryBreakdown(params);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchAnalyticsAgentWorkload = createAsyncThunk(
  'supportAnalytics/fetchAgentWorkload',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getAnalyticsAgentWorkload(params);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const fetchAnalyticsCSAT = createAsyncThunk(
  'supportAnalytics/fetchCSAT',
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await supportApi.getAnalyticsCSAT(params);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const exportAnalytics = createAsyncThunk(
  'supportAnalytics/export',
  async (params, { rejectWithValue }) => {
    try {
      const blob = await supportApi.exportAnalytics(params);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `support-analytics-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded.');
      return true;
    } catch (err) {
      const msg = extractError(err, 'Export failed.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

const initialState = {
  dateRange: { from: null, to: null, preset: 'last_30_days' },
  overview: null,
  volume: null,
  responseTimes: null,
  sla: null,
  categoryBreakdown: null,
  agentWorkload: null,
  csat: null,
  loaders: {
    overview: false,
    volume: false,
    responseTimes: false,
    sla: false,
    categoryBreakdown: false,
    agentWorkload: false,
    csat: false,
    export: false,
  },
  errors: {},
};

const analyticsSlice = createSlice({
  name: 'supportAnalytics',
  initialState,
  reducers: {
    setDateRange(state, action) {
      state.dateRange = { ...state.dateRange, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    const wire = (thunk, key, targetKey) => {
      builder
        .addCase(thunk.pending, (state) => {
          state.loaders[key] = true;
          delete state.errors[key];
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loaders[key] = false;
          state[targetKey ?? key] = action.payload;
        })
        .addCase(thunk.rejected, (state, action) => {
          state.loaders[key] = false;
          state.errors[key] = action.payload;
        });
    };

    wire(fetchAnalyticsOverview, 'overview');
    wire(fetchAnalyticsVolume, 'volume');
    wire(fetchAnalyticsResponseTimes, 'responseTimes');
    wire(fetchAnalyticsSLA, 'sla');
    wire(fetchAnalyticsCategoryBreakdown, 'categoryBreakdown');
    wire(fetchAnalyticsAgentWorkload, 'agentWorkload');
    wire(fetchAnalyticsCSAT, 'csat');

    builder
      .addCase(exportAnalytics.pending, (state) => {
        state.loaders.export = true;
      })
      .addCase(exportAnalytics.fulfilled, (state) => {
        state.loaders.export = false;
      })
      .addCase(exportAnalytics.rejected, (state) => {
        state.loaders.export = false;
      });
  },
});

export const { setDateRange } = analyticsSlice.actions;
export default analyticsSlice.reducer;

// ── Selectors ─────────────────────────────────────────────────────────────

export const selectAnalyticsDateRange = (state) => state.supportAnalytics.dateRange;
export const selectAnalyticsOverview = (state) => state.supportAnalytics.overview;
export const selectAnalyticsVolume = (state) => state.supportAnalytics.volume;
export const selectAnalyticsResponseTimes = (state) => state.supportAnalytics.responseTimes;
export const selectAnalyticsSLA = (state) => state.supportAnalytics.sla;
export const selectAnalyticsCategoryBreakdown = (state) => state.supportAnalytics.categoryBreakdown;
export const selectAnalyticsAgentWorkload = (state) => state.supportAnalytics.agentWorkload;
export const selectAnalyticsCSAT = (state) => state.supportAnalytics.csat;
export const selectAnalyticsLoaders = (state) => state.supportAnalytics.loaders;
export const selectAnalyticsErrors = (state) => state.supportAnalytics.errors;
