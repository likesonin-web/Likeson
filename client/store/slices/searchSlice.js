import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import API from "../api";
import toast from "react-hot-toast";

// ── Thunks ────────────────────────────────────────────────────────────────────
// Each mirrors one endpoint in search.routes.js. Params passed straight
// through as query params / body — keep callers thin.

export const searchAll = createAsyncThunk(
  "search/searchAll",
  async (params, { rejectWithValue }) => {
    // params: { q, type, page, limit, city, specialization, category, hospitalType, labType, prescriptionOnly }
    try {
      const { data } = await API.get("/search", { params });
      return data; // { success, query, type, data }
    } catch (err) {
      const message = err.response?.data?.message || "Search failed";
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const fetchSuggestions = createAsyncThunk(
  "search/fetchSuggestions",
  async (params, { rejectWithValue }) => {
    // params: { q, type }
    try {
      const { data } = await API.get("/search/suggestions", { params });
      return data.data; // array of { label, subtitle, type, slug/code }
    } catch (err) {
      // Suggestions fail silently — no toast, don't nag the user on every keystroke.
      return rejectWithValue(err.response?.data?.message || "Suggestions failed");
    }
  }
);

export const fetchTrendingSearches = createAsyncThunk(
  "search/fetchTrendingSearches",
  async (params = {}, { rejectWithValue }) => {
    // params: { type, window: 'day'|'week', limit }
    try {
      const { data } = await API.get("/search/trending", { params });
      return { window: data.window, items: data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to load trending searches");
    }
  }
);

export const fetchMostSearched = createAsyncThunk(
  "search/fetchMostSearched",
  async (params = {}, { rejectWithValue }) => {
    // params: { type, limit }
    try {
      const { data } = await API.get("/search/most-searched", { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to load most-searched terms");
    }
  }
);

export const fetchPopularCategories = createAsyncThunk(
  "search/fetchPopularCategories",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/search/popular-categories");
      return data.data; // { medicineCategories, specializations, hospitalTypes, labTypes }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || "Failed to load popular categories");
    }
  }
);

export const fetchSearchHistory = createAsyncThunk(
  "search/fetchSearchHistory",
  async (params = {}, { rejectWithValue }) => {
    // params: { limit } — requires auth, backend reads req.user
    try {
      const { data } = await API.get("/search/history", { params });
      return data.data;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load search history";
      if (err.response?.status !== 401) toast.error(message); // don't nag logged-out users
      return rejectWithValue(message);
    }
  }
);

export const clearSearchHistory = createAsyncThunk(
  "search/clearSearchHistory",
  async (_, { rejectWithValue }) => {
    try {
      await API.delete("/search/history");
      toast.success("Search history cleared");
      return true;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to clear search history";
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const recordSearchClick = createAsyncThunk(
  "search/recordSearchClick",
  async ({ searchLogId, resultId, resultType, position }, { rejectWithValue }) => {
    try {
      await API.post("/search/click", { searchLogId, resultId, resultType, position });
      return true;
    } catch (err) {
      // Analytics call — never surface to the user.
      return rejectWithValue(err.response?.data?.message || "Failed to record click");
    }
  }
);

export const fetchZeroResultQueries = createAsyncThunk(
  "search/fetchZeroResultQueries",
  async (params = {}, { rejectWithValue }) => {
    // params: { window, limit } — admin only
    try {
      const { data } = await API.get("/search/zero-results", { params });
      return data.data;
    } catch (err) {
      const message = err.response?.data?.message || "Failed to load zero-result queries";
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState = {
  // main search
  query: "",
  type: "all",
  results: { medicines: {}, doctors: {}, hospitals: {}, labs: {}, items: [], total: 0, page: 1, totalPages: 0 },
  searchStatus: "idle", // idle | loading | succeeded | failed
  searchError: null,

  // autocomplete
  suggestions: [],
  suggestStatus: "idle",

  // discovery widgets
  trending: { window: "day", items: [] },
  trendingStatus: "idle",
  mostSearched: [],
  mostSearchedStatus: "idle",
  popularCategories: { medicineCategories: [], specializations: [], hospitalTypes: [], labTypes: [] },
  popularCategoriesStatus: "idle",

  // personal
  history: [],
  historyStatus: "idle",

  // admin
  zeroResultQueries: [],
  zeroResultStatus: "idle",
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const searchSlice = createSlice({
  name: "search",
  initialState,
  reducers: {
    setQuery(state, action) {
      state.query = action.payload;
    },
    setSearchType(state, action) {
      state.type = action.payload;
    },
    clearSuggestions(state) {
      state.suggestions = [];
      state.suggestStatus = "idle";
    },
    resetSearchResults(state) {
      state.results = initialState.results;
      state.searchStatus = "idle";
      state.searchError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // searchAll
      .addCase(searchAll.pending, (state, action) => {
        state.searchStatus = "loading";
        state.searchError = null;
        state.query = action.meta.arg?.q ?? state.query;
        state.type = action.meta.arg?.type ?? state.type;
      })
      .addCase(searchAll.fulfilled, (state, action) => {
        state.searchStatus = "succeeded";
        state.results = action.payload.data;
      })
      .addCase(searchAll.rejected, (state, action) => {
        state.searchStatus = "failed";
        state.searchError = action.payload;
      })

      // fetchSuggestions
      .addCase(fetchSuggestions.pending, (state) => {
        state.suggestStatus = "loading";
      })
      .addCase(fetchSuggestions.fulfilled, (state, action) => {
        state.suggestStatus = "succeeded";
        state.suggestions = action.payload;
      })
      .addCase(fetchSuggestions.rejected, (state) => {
        state.suggestStatus = "failed";
        state.suggestions = [];
      })

      // fetchTrendingSearches
      .addCase(fetchTrendingSearches.pending, (state) => {
        state.trendingStatus = "loading";
      })
      .addCase(fetchTrendingSearches.fulfilled, (state, action) => {
        state.trendingStatus = "succeeded";
        state.trending = action.payload;
      })
      .addCase(fetchTrendingSearches.rejected, (state) => {
        state.trendingStatus = "failed";
      })

      // fetchMostSearched
      .addCase(fetchMostSearched.pending, (state) => {
        state.mostSearchedStatus = "loading";
      })
      .addCase(fetchMostSearched.fulfilled, (state, action) => {
        state.mostSearchedStatus = "succeeded";
        state.mostSearched = action.payload;
      })
      .addCase(fetchMostSearched.rejected, (state) => {
        state.mostSearchedStatus = "failed";
      })

      // fetchPopularCategories
      .addCase(fetchPopularCategories.pending, (state) => {
        state.popularCategoriesStatus = "loading";
      })
      .addCase(fetchPopularCategories.fulfilled, (state, action) => {
        state.popularCategoriesStatus = "succeeded";
        state.popularCategories = action.payload;
      })
      .addCase(fetchPopularCategories.rejected, (state) => {
        state.popularCategoriesStatus = "failed";
      })

      // fetchSearchHistory
      .addCase(fetchSearchHistory.pending, (state) => {
        state.historyStatus = "loading";
      })
      .addCase(fetchSearchHistory.fulfilled, (state, action) => {
        state.historyStatus = "succeeded";
        state.history = action.payload;
      })
      .addCase(fetchSearchHistory.rejected, (state) => {
        state.historyStatus = "failed";
      })

      // clearSearchHistory
      .addCase(clearSearchHistory.fulfilled, (state) => {
        state.history = [];
      })

      // fetchZeroResultQueries
      .addCase(fetchZeroResultQueries.pending, (state) => {
        state.zeroResultStatus = "loading";
      })
      .addCase(fetchZeroResultQueries.fulfilled, (state, action) => {
        state.zeroResultStatus = "succeeded";
        state.zeroResultQueries = action.payload;
      })
      .addCase(fetchZeroResultQueries.rejected, (state) => {
        state.zeroResultStatus = "failed";
      });
  },
});

export const { setQuery, setSearchType, clearSuggestions, resetSearchResults } = searchSlice.actions;
export default searchSlice.reducer;