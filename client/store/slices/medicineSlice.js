import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import API from "../api";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// § API BASEx
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "/medicines";

// ─────────────────────────────────────────────────────────────────────────────
// § INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Medicines ──────────────────────────────────────────────────────────────
  medicines: [],
  medicineDetail: null,
  medicineStats: null,
  medicinePagination: { total: 0, totalPages: 0, currentPage: 1, pageSize: 20 },
  storeInventorySummary: null,
  // ── HSN ───────────────────────────────────────────────────────────────────
  hsnCodes: [],
  hsnDetail: null,
  hsnStats: null,
  hsnPagination: { total: 0, totalPages: 0, currentPage: 1, pageSize: 20 },
  hsnUploadResult: null,

  // ── Inventory ─────────────────────────────────────────────────────────────
  inventory: [],
  inventoryEntry: null,
  lowStock: [],
  lowStockTotal: 0,
  expiryAlerts: [],
  expiryAlertTotal: 0,

  // ── Stores ────────────────────────────────────────────────────────────────
  stores: [],
  storeDetail: null,
  nearbyStores: [],
  myStore: null,
  storePagination: { total: 0, pages: 0, page: 1, limit: 10 },
  storeLifecycleResult: null,
  // ── Sync / misc ───────────────────────────────────────────────────────────
  syncResult: null,
  restockResult: null,
  lowStockTrigger: null,

  // ── UI state ──────────────────────────────────────────────────────────────
  loading: false,
  actionLoading: false,
  uploadLoading: false,
  error: null,
  actionError: null,
  successMessage: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// § HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Unwrap error to a plain string */
const extractError = (err) =>
  err?.response?.data?.message ||
  err?.response?.data?.error ||
  err?.message ||
  "An unexpected error occurred.";

/** Reusable error handler for thunks */
const handleError = (err, rejectWithValue) => {
  const errorMessage = extractError(err);
  toast.error(errorMessage);
  return rejectWithValue(errorMessage);
};

/** Shared pending/rejected handlers to reduce repetition */
const onPending =
  (key = "loading") =>
  (state) => {
    state[key] = true;
    state.error = null;
  };
const onRejected =
  (key = "loading", errKey = "error") =>
  (state, { payload }) => {
    state[key] = false;
    state[errKey] = payload;
  };

// ─────────────────────────────────────────────────────────────────────────────
// § HSN THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchHsnCodes = createAsyncThunk(
  "medicine/fetchHsnCodes",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/hsn`, { params });
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchHsnStats = createAsyncThunk(
  "medicine/fetchHsnStats",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/hsn/stats`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const bulkDeleteHsnCodes = createAsyncThunk(
  "medicine/bulkDeleteHsnCodes",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/hsn/bulk-delete`, payload);
      toast.success(data?.message || "HSN codes deactivated.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const uploadHsnFile = createAsyncThunk(
  "medicine/uploadHsnFile",
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/hsn/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(data?.message || "HSN file uploaded successfully.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchHsnByCode = createAsyncThunk(
  "medicine/fetchHsnByCode",
  async (code, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/hsn/${code}`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const createHsnCode = createAsyncThunk(
  "medicine/createHsnCode",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/hsn`, payload);
      toast.success("HSN code created successfully.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const updateHsnCode = createAsyncThunk(
  "medicine/updateHsnCode",
  async ({ code, updates }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/hsn/${code}`, updates);
      toast.success("HSN code updated successfully.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const deleteHsnCode = createAsyncThunk(
  "medicine/deleteHsnCode",
  async (code, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`${BASE}/hsn/${code}`);
      toast.success(data?.message || "HSN code deactivated.");
      return { ...data, code };
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// § MEDICINE THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchMedicines = createAsyncThunk(
  "medicine/fetchMedicines",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}`, { params });
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchMedicineStats = createAsyncThunk(
  "medicine/fetchMedicineStats",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/admin/stats`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const submitRestockRequest = createAsyncThunk(
  "medicine/submitRestockRequest",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/restock-request`, payload);
      toast.success(data?.message || "Restock request submitted.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchMedicineBySlug = createAsyncThunk(
  "medicine/fetchMedicineBySlug",
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/${slug}`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const createMedicine = createAsyncThunk(
  "medicine/createMedicine",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}`, payload);
      toast.success("Medicine created successfully.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const updateMedicine = createAsyncThunk(
  "medicine/updateMedicine",
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/${id}`, updates);
      toast.success("Medicine updated successfully.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const addMedicineStock = createAsyncThunk(
  "medicine/addMedicineStock",
  async ({ medicineId, storeId, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/${medicineId}/inventory/${storeId}/add-stock`,
        payload,
      );
      toast.success(data?.message || "Stock added successfully.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const deductMedicineStock = createAsyncThunk(
  "medicine/deductMedicineStock",
  async ({ medicineId, storeId, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `${BASE}/${medicineId}/inventory/${storeId}/deduct-stock`,
        payload,
      );
      toast.success(data?.message || "Stock deducted successfully.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const discontinueMedicine = createAsyncThunk(
  "medicine/discontinueMedicine",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`${BASE}/${id}`);
      toast.success(data?.message || "Medicine discontinued.");
      return { ...data, id };
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const syncAllMedicinesInventory = createAsyncThunk(
  "medicine/syncAllMedicinesInventory",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/sync-inventory/all`, {});
      toast.success(
        `Sync complete. ${data?.totalEntriesAdded ?? 0} entries added.`,
      );
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const syncOneMedicineInventory = createAsyncThunk(
  "medicine/syncOneMedicineInventory",
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`${BASE}/${id}/sync-inventory`, {});
      toast.success(data?.message || "Inventory synced.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// § INVENTORY CRUD THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchLowStock = createAsyncThunk(
  "medicine/fetchLowStock",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/inventory/low-stock`, { params });
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchExpiryAlerts = createAsyncThunk(
  "medicine/fetchExpiryAlerts",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/inventory/expiry-alerts`, {
        params,
      });
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchInventoryByMedicine = createAsyncThunk(
  "medicine/fetchInventoryByMedicine",
  async (medicineId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/${medicineId}/inventory`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchInventoryEntry = createAsyncThunk(
  "medicine/fetchInventoryEntry",
  async ({ medicineId, storeId }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `${BASE}/${medicineId}/inventory/${storeId}`,
      );
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const addInventoryEntry = createAsyncThunk(
  "medicine/addInventoryEntry",
  async ({ medicineId, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/${medicineId}/inventory`,
        payload,
      );
      toast.success("Inventory entry added.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const updateInventoryEntry = createAsyncThunk(
  "medicine/updateInventoryEntry",
  async ({ medicineId, storeId, updates }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `${BASE}/${medicineId}/inventory/${storeId}`,
        updates,
      );
      toast.success("Inventory entry updated.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const deleteInventoryEntry = createAsyncThunk(
  "medicine/deleteInventoryEntry",
  async ({ medicineId, storeId, hard = false }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(
        `${BASE}/${medicineId}/inventory/${storeId}`,
        {
          params: { hard: hard ? "true" : undefined },
        },
      );
      toast.success(data?.message || "Inventory entry removed.");
      return { ...data, medicineId, storeId };
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// § STORE LIFECYCLE THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const deleteStore = createAsyncThunk(
  "medicine/deleteStore",
  async (storeId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`${BASE}/stores/${storeId}`);
      toast.success(data?.message || "Store deleted.");
      return { ...data, storeId };
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const suspendStore = createAsyncThunk(
  "medicine/suspendStore",
  async ({ storeId, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/stores/${storeId}/suspend`, {
        reason,
      });
      toast.success(data?.message || "Store suspended.");
      return { ...data, storeId };
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const unsuspendStore = createAsyncThunk(
  "medicine/unsuspendStore",
  async (storeId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `${BASE}/stores/${storeId}/unsuspend`,
        {},
      );
      toast.success(data?.message || "Store reopened.");
      return { ...data, storeId };
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const triggerLowStockAlerts = createAsyncThunk(
  "medicine/triggerLowStockAlerts",
  async (payload = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `${BASE}/stores/low-stock/trigger`,
        payload,
      );
      toast.success(data?.message || "Low-stock alerts triggered.");
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// § PHARMACY STORE THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchStores = createAsyncThunk(
  "medicine/fetchStores",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/stores`, { params });
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);


export const fetchStoreInventory = createAsyncThunk(
  "medicine/fetchStoreInventory",
  async (storeId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/inventory/store/${storeId}`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);


export const fetchNearbyStores = createAsyncThunk(
  "medicine/fetchNearbyStores",
  async (params, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/stores/nearby`, { params });
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchStoreInventorySummary = createAsyncThunk(
  "medicine/fetchStoreInventorySummary",
  async (storeId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `${BASE}/stores/${storeId}/inventory-summary`,
      );
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchStoreById = createAsyncThunk(
  "medicine/fetchStoreById",
  async (storeId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/stores/${storeId}`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchStoreBySlug = createAsyncThunk(
  "medicine/fetchStoreBySlug",
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/stores/slug/${slug}`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

export const fetchMyStore = createAsyncThunk(
  "medicine/fetchMyStore",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/stores/my/store`);
      return data;
    } catch (err) {
      return handleError(err, rejectWithValue);
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// § SLICE
// ─────────────────────────────────────────────────────────────────────────────

const medicineSlice = createSlice({
  name: "medicine",
  initialState,

  reducers: {
    clearMedicineError: (state) => {
      state.error = null;
      state.actionError = null;
    },

    clearSuccessMessage: (state) => {
      state.successMessage = null;
    },

    clearMedicineDetail: (state) => {
      state.medicineDetail = null;
    },

    clearInventoryEntry: (state) => {
      state.inventoryEntry = null;
    },

    clearHsnDetail: (state) => {
      state.hsnDetail = null;
    },

    clearHsnUploadResult: (state) => {
      state.hsnUploadResult = null;
    },

    clearSyncResult: (state) => {
      state.syncResult = null;
    },

    // ADD THIS
    clearStoreLifecycleResult: (state) => {
      state.storeLifecycleResult = null;
    },

    clearStoreDetail: (state) => {
      state.storeDetail = null;
    },

    resetMedicineState: () => initialState,
  },

  extraReducers: (builder) => {
    // ══════════════════════════════════════════════════════════════════════════
    // HSN
    // ══════════════════════════════════════════════════════════════════════════
    builder
      .addCase(fetchHsnCodes.pending, onPending("loading"))
      .addCase(fetchHsnCodes.rejected, onRejected("loading", "error"))
      .addCase(fetchHsnCodes.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.hsnCodes = payload.data ?? [];
        state.hsnPagination = {
          total: payload.total ?? 0,
          totalPages: payload.metadata?.totalPages ?? 0,
          currentPage: payload.metadata?.currentPage ?? 1,
          pageSize: payload.metadata?.pageSize ?? 20,
        };
      });

    builder
      .addCase(fetchHsnStats.pending, onPending("loading"))
      .addCase(fetchHsnStats.rejected, onRejected("loading", "error"))
      .addCase(fetchHsnStats.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.hsnStats = payload.data ?? null;
      });

    builder
      .addCase(bulkDeleteHsnCodes.pending, onPending("actionLoading"))
      .addCase(
        bulkDeleteHsnCodes.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(bulkDeleteHsnCodes.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = payload.message ?? "HSN codes deactivated.";
      });

    builder
      .addCase(uploadHsnFile.pending, onPending("uploadLoading"))
      .addCase(
        uploadHsnFile.rejected,
        onRejected("uploadLoading", "actionError"),
      )
      .addCase(uploadHsnFile.fulfilled, (state, { payload }) => {
        state.uploadLoading = false;
        state.hsnUploadResult = payload;
        state.successMessage = payload.message ?? "HSN file uploaded.";
      });

    builder
      .addCase(fetchHsnByCode.pending, onPending("loading"))
      .addCase(fetchHsnByCode.rejected, onRejected("loading", "error"))
      .addCase(fetchHsnByCode.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.hsnDetail = payload.data ?? null;
      });

    builder
      .addCase(createHsnCode.pending, onPending("actionLoading"))
      .addCase(
        createHsnCode.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(createHsnCode.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = "HSN code created.";
        if (payload.data) state.hsnCodes.unshift(payload.data);
      });

    builder
      .addCase(updateHsnCode.pending, onPending("actionLoading"))
      .addCase(
        updateHsnCode.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(updateHsnCode.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = "HSN code updated.";
        if (payload.data) {
          const idx = state.hsnCodes.findIndex(
            (h) => h._id === payload.data._id,
          );
          if (idx > -1) state.hsnCodes[idx] = payload.data;
          if (state.hsnDetail?._id === payload.data._id)
            state.hsnDetail = payload.data;
        }
      });

    builder
      .addCase(deleteHsnCode.pending, onPending("actionLoading"))
      .addCase(
        deleteHsnCode.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(deleteHsnCode.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = payload.message ?? "HSN code deactivated.";
        const idx = state.hsnCodes.findIndex((h) => h.hsnCode === payload.code);
        if (idx > -1) state.hsnCodes[idx].isActive = false;
      });

    // ══════════════════════════════════════════════════════════════════════════
    // MEDICINE
    // ══════════════════════════════════════════════════════════════════════════
    builder
      .addCase(fetchMedicines.pending, onPending("loading"))
      .addCase(fetchMedicines.rejected, onRejected("loading", "error"))
      .addCase(fetchMedicines.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.medicines = payload.data ?? [];
        state.medicinePagination = {
          total: payload.count ?? 0,
          totalPages: payload.metadata?.totalPages ?? 0,
          currentPage: payload.metadata?.currentPage ?? 1,
          pageSize: payload.metadata?.pageSize ?? 20,
        };
      });

    builder
      .addCase(fetchMedicineStats.pending, onPending("loading"))
      .addCase(fetchMedicineStats.rejected, onRejected("loading", "error"))

      .addCase(fetchMedicineStats.fulfilled, (state, { payload }) => {
        state.loading = false;
        // Map the whole data object directly to state.medicineStats
        state.medicineStats = payload.data ?? null;
      });

    builder
      .addCase(submitRestockRequest.pending, onPending("actionLoading"))
      .addCase(
        submitRestockRequest.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(submitRestockRequest.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.restockResult = payload;
        state.successMessage = payload.message ?? "Restock request submitted.";
      });

    builder
      .addCase(fetchStoreInventorySummary.pending, onPending("loading"))
      .addCase(
        fetchStoreInventorySummary.rejected,
        onRejected("loading", "error"),
      )
      .addCase(fetchStoreInventorySummary.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.storeInventorySummary = payload.data ?? null;
      });


      builder
      .addCase(fetchStoreInventory.pending, onPending("loading"))
      .addCase(fetchStoreInventory.rejected, onRejected("loading", "error"))
      .addCase(fetchStoreInventory.fulfilled, (state, { payload }) => {
        state.loading = false;
        // This safely populates the same inventory array your UI is already mapping over!
        state.inventory = payload.data ?? []; 
      });

    builder
      .addCase(addMedicineStock.pending, onPending("actionLoading"))
      .addCase(
        addMedicineStock.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(addMedicineStock.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = payload.message;
        // Update local inventory array if it's currently loaded
        if (payload.data?.inventory) {
          const updatedInv = payload.data.inventory;
          const idx = state.inventory.findIndex(
            (i) => i._id === updatedInv._id,
          );
          if (idx > -1) state.inventory[idx] = updatedInv;
          if (state.inventoryEntry?._id === updatedInv._id)
            state.inventoryEntry = updatedInv;
        }
      });

    builder
      .addCase(deductMedicineStock.pending, onPending("actionLoading"))
      .addCase(
        deductMedicineStock.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(deductMedicineStock.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = payload.message;
        if (payload.data) {
          const updatedInv = payload.data;
          const idx = state.inventory.findIndex(
            (i) => i._id === updatedInv._id,
          );
          if (idx > -1) state.inventory[idx] = updatedInv;
          if (state.inventoryEntry?._id === updatedInv._id)
            state.inventoryEntry = updatedInv;
        }
      });

    builder
      .addCase(fetchMedicineBySlug.pending, onPending("loading"))
      .addCase(fetchMedicineBySlug.rejected, onRejected("loading", "error"))
      .addCase(fetchMedicineBySlug.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.medicineDetail = payload.data ?? null;
      });

    builder
      .addCase(createMedicine.pending, onPending("actionLoading"))
      .addCase(
        createMedicine.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(createMedicine.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = "Medicine created successfully.";
        if (payload.data) state.medicines.unshift(payload.data);
      });

    builder
      .addCase(updateMedicine.pending, onPending("actionLoading"))
      .addCase(
        updateMedicine.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(updateMedicine.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = "Medicine updated.";
        if (payload.data) {
          const idx = state.medicines.findIndex(
            (m) => m._id === payload.data._id,
          );
          if (idx > -1) state.medicines[idx] = payload.data;
          if (state.medicineDetail?._id === payload.data._id)
            state.medicineDetail = payload.data;
        }
      });

    builder
      .addCase(discontinueMedicine.pending, onPending("actionLoading"))
      .addCase(
        discontinueMedicine.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(discontinueMedicine.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = payload.message ?? "Medicine discontinued.";
        state.medicines = state.medicines.filter((m) => m._id !== payload.id);
        if (state.medicineDetail?._id === payload.id) {
          state.medicineDetail = {
            ...state.medicineDetail,
            isDiscontinued: true,
          };
        }
      });

    builder
      .addCase(syncAllMedicinesInventory.pending, onPending("actionLoading"))
      .addCase(
        syncAllMedicinesInventory.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(syncAllMedicinesInventory.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.syncResult = payload;
        state.successMessage = `Sync complete. ${payload.totalEntriesAdded ?? 0} entries added across ${payload.medicinesSynced ?? 0} medicine(s).`;
      });

    builder
      .addCase(syncOneMedicineInventory.pending, onPending("actionLoading"))
      .addCase(
        syncOneMedicineInventory.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(syncOneMedicineInventory.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.syncResult = payload;
        state.successMessage = payload.message ?? "Inventory synced.";
      });

    // ══════════════════════════════════════════════════════════════════════════
    // INVENTORY CRUD
    // ══════════════════════════════════════════════════════════════════════════
    builder
      .addCase(fetchLowStock.pending, onPending("loading"))
      .addCase(fetchLowStock.rejected, onRejected("loading", "error"))
      .addCase(fetchLowStock.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.lowStock = payload.data ?? [];
        state.lowStockTotal = payload.total ?? 0;
      });

    builder
      .addCase(fetchExpiryAlerts.pending, onPending("loading"))
      .addCase(fetchExpiryAlerts.rejected, onRejected("loading", "error"))
      .addCase(fetchExpiryAlerts.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.expiryAlerts = payload.data ?? [];
        state.expiryAlertTotal = payload.total ?? 0;
      });

    builder
      .addCase(fetchInventoryByMedicine.pending, onPending("loading"))
      .addCase(
        fetchInventoryByMedicine.rejected,
        onRejected("loading", "error"),
      )
      .addCase(fetchInventoryByMedicine.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.inventory = payload.data ?? [];
      });

    builder
      .addCase(fetchInventoryEntry.pending, onPending("loading"))
      .addCase(fetchInventoryEntry.rejected, onRejected("loading", "error"))
      .addCase(fetchInventoryEntry.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.inventoryEntry = payload.data ?? null;
      });

    builder
      .addCase(addInventoryEntry.pending, onPending("actionLoading"))
      .addCase(
        addInventoryEntry.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(addInventoryEntry.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = "Inventory entry added.";
        if (payload.data) state.inventory.push(payload.data);
      });

    builder
      .addCase(updateInventoryEntry.pending, onPending("actionLoading"))
      .addCase(
        updateInventoryEntry.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(updateInventoryEntry.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = "Inventory entry updated.";
        if (payload.data) {
          const idx = state.inventory.findIndex(
            (i) =>
              i.storeId?._id === payload.data.storeId?._id ||
              i.storeId === payload.data.storeId,
          );
          if (idx > -1) state.inventory[idx] = payload.data;
          if (state.inventoryEntry) state.inventoryEntry = payload.data;
        }
      });

    builder
      .addCase(deleteInventoryEntry.pending, onPending("actionLoading"))
      .addCase(
        deleteInventoryEntry.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(deleteInventoryEntry.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.successMessage = payload.message ?? "Inventory entry removed.";
        state.inventory = state.inventory.filter((i) => {
          const sid = i.storeId?._id?.toString() ?? i.storeId?.toString();
          return sid !== payload.storeId;
        });
      });

    // ══════════════════════════════════════════════════════════════════════════
    // STORE LIFECYCLE
    // ══════════════════════════════════════════════════════════════════════════
    builder
      .addCase(deleteStore.pending, onPending("actionLoading"))
      .addCase(deleteStore.rejected, onRejected("actionLoading", "actionError"))
      .addCase(deleteStore.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.storeLifecycleResult = {
          type: "deleted",
          message: payload.message,
          medicinesUpdated: payload.inventoryCount ?? 0,
        };
        state.stores = state.stores.filter((s) => s._id !== payload.storeId);
      });

    builder
      .addCase(suspendStore.pending, onPending("actionLoading"))
      .addCase(
        suspendStore.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(suspendStore.fulfilled, (state, { payload }) => {
    state.actionLoading = false;
    state.storeLifecycleResult = {
      type: "suspended",
      message: payload.message,
      medicinesUpdated: payload.count ?? 0,
    };
    const store = state.stores.find((s) => s._id === payload.storeId);
    if (store) store.status = "Under-Maintenance";
  });


    builder
      .addCase(unsuspendStore.pending, onPending("actionLoading"))
      .addCase(
        unsuspendStore.rejected,
        onRejected("actionLoading", "actionError"),
      )
      .addCase(unsuspendStore.fulfilled, (state, { payload }) => {
    state.actionLoading = false;
    state.storeLifecycleResult = {
      type: "unsuspended",
      message: payload.message,
      medicinesUpdated: payload.count ?? 0,
    };
    const store = state.stores.find((s) => s._id === payload.storeId);
    if (store) store.status = "Open";
  });

    builder
      .addCase(triggerLowStockAlerts.pending, onPending("actionLoading"))
      .addCase(
        triggerLowStockAlerts.rejected,
        onRejected("actionLoading", "actionError"),
      )
     .addCase(triggerLowStockAlerts.fulfilled, (state, { payload }) => {
    state.actionLoading = false;
    state.storeLifecycleResult = {
      type: "lowStockTriggered",
      message: payload.message,
    };
  });

    // ══════════════════════════════════════════════════════════════════════════
    // PHARMACY STORES
    // ══════════════════════════════════════════════════════════════════════════
    builder
      .addCase(fetchStores.pending, onPending("loading"))
      .addCase(fetchStores.rejected, onRejected("loading", "error"))
      .addCase(fetchStores.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.stores = payload.data ?? [];
        state.storePagination = {
          total: payload.pagination?.total ?? 0,
          pages: payload.pagination?.pages ?? 0,
          page: payload.pagination?.page ?? 1,
          limit: payload.pagination?.limit ?? 10,
        };
      });

    builder
      .addCase(fetchNearbyStores.pending, onPending("loading"))
      .addCase(fetchNearbyStores.rejected, onRejected("loading", "error"))
      .addCase(fetchNearbyStores.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.nearbyStores = payload.data ?? [];
      });

    builder
      .addCase(fetchStoreById.pending, onPending("loading"))
      .addCase(fetchStoreById.rejected, onRejected("loading", "error"))
      .addCase(fetchStoreById.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.storeDetail = payload.data ?? null;
      });

    builder
      .addCase(fetchStoreBySlug.pending, onPending("loading"))
      .addCase(fetchStoreBySlug.rejected, onRejected("loading", "error"))
      .addCase(fetchStoreBySlug.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.storeDetail = payload.data ?? null;
      });

    builder
      .addCase(fetchMyStore.pending, onPending("loading"))
      .addCase(fetchMyStore.rejected, onRejected("loading", "error"))
      .addCase(fetchMyStore.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.myStore = payload.data ?? null;
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// § ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearMedicineError,
  clearSuccessMessage,
  clearMedicineDetail,
  clearInventoryEntry,
  clearHsnDetail,
  clearHsnUploadResult,
  clearSyncResult,
  clearStoreLifecycleResult, // <-- ADD THIS
  clearStoreDetail,
  resetMedicineState,
} = medicineSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// § SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// § SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// Medicine
export const selectMedicines = (s) => s.medicine.medicines;
export const selectMedicineDetail = (s) => s.medicine.medicineDetail;
export const selectMedicineStats = (s) => s.medicine.medicineStats;
export const selectMedicinePagination = (s) => s.medicine.medicinePagination;

// HSN
export const selectHsnCodes = (s) => s.medicine.hsnCodes;
export const selectHsnDetail = (s) => s.medicine.hsnDetail;
export const selectHsnStats = (s) => s.medicine.hsnStats;
export const selectHsnPagination = (s) => s.medicine.hsnPagination;
export const selectHsnUploadResult = (s) => s.medicine.hsnUploadResult;

// Inventory
export const selectInventory = (s) => s.medicine.inventory;
export const selectInventoryEntry = (s) => s.medicine.inventoryEntry;
export const selectLowStock = (s) => s.medicine.lowStock;
export const selectLowStockTotal = (s) => s.medicine.lowStockTotal;
export const selectExpiryAlerts = (s) => s.medicine.expiryAlerts;
export const selectExpiryAlertTotal = (s) => s.medicine.expiryAlertTotal;

// Stores
export const selectStores = (s) => s.medicine.stores;
export const selectStoreDetail = (s) => s.medicine.storeDetail;
export const selectNearbyStores = (s) => s.medicine.nearbyStores;
export const selectMyStore = (s) => s.medicine.myStore;
export const selectStorePagination = (s) => s.medicine.storePagination;
export const selectStoreInventorySummary = (s) =>
  s.medicine.storeInventorySummary; // <-- NEW

// Misc
export const selectSyncResult = (s) => s.medicine.syncResult;
export const selectRestockResult = (s) => s.medicine.restockResult;
export const selectLowStockTrigger = (s) => s.medicine.lowStockTrigger;

// UI
export const selectMedicineLoading = (s) => s.medicine.loading;
export const selectActionLoading = (s) => s.medicine.actionLoading;
export const selectUploadLoading = (s) => s.medicine.uploadLoading;
export const selectMedicineError = (s) => s.medicine.error;
export const selectActionError = (s) => s.medicine.actionError;
export const selectSuccessMessage = (s) => s.medicine.successMessage;

const selectMedicine = (state) => state.medicine;

export const selectStoreLifecycleResult = (state) =>
  state.medicine.storeLifecycleResult;
export default medicineSlice.reducer;
