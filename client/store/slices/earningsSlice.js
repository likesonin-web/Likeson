import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import API from "../api";
import toast from "react-hot-toast";

const DEFAULT_SUMMARY = {
  pending:  { total: 0, netTotal: 0, count: 0 },
  settled:  { total: 0, netTotal: 0, count: 0 },
  reversed: { total: 0, netTotal: 0, count: 0 },
  recovery: { total: 0, netTotal: 0, count: 0 },
  partial:  { total: 0, netTotal: 0, count: 0 },
  allTimeGross: 0,
  allTimeNet: 0,
};

const initialState = {
  summary: DEFAULT_SUMMARY,
  periodBreakdown: [],
  items: [],
  pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 0 },
  filters: { status: "", range: "monthly", from: "", to: "" },
  selectedEarning: null,
  listStatus: "idle",   // idle | loading | succeeded | failed
  detailStatus: "idle",
  error: null,
};

// ── Thunks ────────────────────────────────────────────────────────────────

export const fetchEarnings = createAsyncThunk(
  "earnings/fetchEarnings",
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { filters, pagination } = getState().earnings;
      const query = {
        status: filters.status || undefined,
        range: filters.range || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page: params.page ?? pagination.page,
        limit: params.limit ?? pagination.limit,
        ...params,
      };
      const { data } = await API.get("/earnings", { params: query });
      return data;
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to load earnings";
      return rejectWithValue(message);
    }
  }
);

export const fetchEarningDetail = createAsyncThunk(
  "earnings/fetchEarningDetail",
  async (allocationId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/earnings/${allocationId}`);
      return data;
    } catch (err) {
      const message = err?.response?.data?.message || "Failed to load earning detail";
      return rejectWithValue(message);
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────

const earningsSlice = createSlice({
  name: "earnings",
  initialState,
  reducers: {
    setStatusFilter(state, action) {
      state.filters.status = action.payload;
      state.pagination.page = 1;
    },
    setRangeFilter(state, action) {
      state.filters.range = action.payload;
    },
    setDateRangeFilter(state, action) {
      state.filters.from = action.payload.from ?? state.filters.from;
      state.filters.to = action.payload.to ?? state.filters.to;
      state.pagination.page = 1;
    },
    setPage(state, action) {
      state.pagination.page = action.payload;
    },
    clearSelectedEarning(state) {
      state.selectedEarning = null;
      state.detailStatus = "idle";
    },
    resetFilters(state) {
      state.filters = { status: "", range: "monthly", from: "", to: "" };
      state.pagination.page = 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEarnings.pending, (state) => {
        state.listStatus = "loading";
        state.error = null;
      })
      .addCase(fetchEarnings.fulfilled, (state, action) => {
        state.listStatus = "succeeded";
        state.summary = action.payload.summary || DEFAULT_SUMMARY;
        state.periodBreakdown = action.payload.periodBreakdown || [];
        state.items = action.payload.items || [];
        state.pagination = action.payload.pagination || state.pagination;
      })
      .addCase(fetchEarnings.rejected, (state, action) => {
        state.listStatus = "failed";
        state.error = action.payload;
        toast.error(action.payload || "Failed to load earnings");
      })
      .addCase(fetchEarningDetail.pending, (state) => {
        state.detailStatus = "loading";
      })
      .addCase(fetchEarningDetail.fulfilled, (state, action) => {
        state.detailStatus = "succeeded";
        state.selectedEarning = action.payload;
      })
      .addCase(fetchEarningDetail.rejected, (state, action) => {
        state.detailStatus = "failed";
        toast.error(action.payload || "Failed to load earning detail");
      });
  },
});

export const {
  setStatusFilter,
  setRangeFilter,
  setDateRangeFilter,
  setPage,
  clearSelectedEarning,
  resetFilters,
} = earningsSlice.actions;

export default earningsSlice.reducer;