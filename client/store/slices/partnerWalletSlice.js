import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import API from "../api";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Base path — mount partnerWalletRouter.js at /api/partner-wallet in Express
// ─────────────────────────────────────────────────────────────────────────────

const BASE = "/partner-wallet";

// ─────────────────────────────────────────────────────────────────────────────
// Thunks — Partner (self) actions
// ─────────────────────────────────────────────────────────────────────────────

export const fetchPartnerWallet = createAsyncThunk(
  "partnerWallet/fetchWallet",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/me`);
      return data.wallet;
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load wallet";
      return rejectWithValue(msg);
    }
  }
);

export const fetchPartnerBankAccounts = createAsyncThunk(
  "partnerWallet/fetchBankAccounts",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/bank-accounts`);
      return data.bankAccounts;
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load bank accounts";
      return rejectWithValue(msg);
    }
  }
);

export const addPartnerBankAccount = createAsyncThunk(
  "partnerWallet/addBankAccount",
  async (payload, { rejectWithValue }) => {
    // payload: { accountHolderName, accountNumber, ifscCode, bankName?, branchName?, upiId?, isPrimary? }
    try {
      const { data } = await API.post(`${BASE}/bank-accounts`, payload);
      toast.success(data.message || "Bank account added");
      return data.bankAccounts;
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to add bank account";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const setPrimaryPartnerBankAccount = createAsyncThunk(
  "partnerWallet/setPrimaryBankAccount",
  async (bankId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/bank-accounts/${bankId}/set-primary`);
      toast.success(data.message || "Primary bank account updated");
      return data.primaryBank;
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to set primary bank account";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const removePartnerBankAccount = createAsyncThunk(
  "partnerWallet/removeBankAccount",
  async (bankId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`${BASE}/bank-accounts/${bankId}`);
      toast.success(data.message || "Bank account removed");
      return bankId;
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to remove bank account";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Thunks — Admin actions (admin | superadmin only, route-guarded server-side)
// ─────────────────────────────────────────────────────────────────────────────

export const fetchAdminPartnerWallets = createAsyncThunk(
  "partnerWallet/admin/fetchWallets",
  async ({ page = 1, limit = 20, partnerRole, walletStatus } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/admin/wallets`, {
        params: { page, limit, partnerRole, walletStatus },
      });
      return data; // { total, page, limit, wallets }
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load partner wallets";
      return rejectWithValue(msg);
    }
  }
);

export const fetchAdminPartnerWalletById = createAsyncThunk(
  "partnerWallet/admin/fetchWalletById",
  async (walletId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`${BASE}/admin/wallets/${walletId}`);
      return data.wallet;
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to load wallet";
      return rejectWithValue(msg);
    }
  }
);

export const updateAdminWalletStatus = createAsyncThunk(
  "partnerWallet/admin/updateWalletStatus",
  async ({ walletId, walletStatus }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/admin/wallets/${walletId}/status`, { walletStatus });
      toast.success(data.message || "Wallet status updated");
      return { walletId, walletStatus: data.walletStatus };
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update wallet status";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const updateAdminWalletKycStatus = createAsyncThunk(
  "partnerWallet/admin/updateKycStatus",
  async ({ walletId, kycVerified, bankVerified }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/admin/wallets/${walletId}/kyc-status`, {
        kycVerified,
        bankVerified,
      });
      toast.success(data.message || "KYC status updated");
      return { walletId, kycVerified: data.kycVerified, bankVerified: data.bankVerified };
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update KYC status";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const toggleAdminWalletHold = createAsyncThunk(
  "partnerWallet/admin/toggleHold",
  async ({ walletId, hold, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/admin/wallets/${walletId}/hold`, { hold, reason });
      toast.success(data.message || "Hold status updated");
      return { walletId, complianceHold: data.complianceHold };
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to update hold status";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const verifyAdminPartnerBankAccount = createAsyncThunk(
  "partnerWallet/admin/verifyBankAccount",
  async ({ walletId, bankId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`${BASE}/admin/bank-accounts/${walletId}/${bankId}/verify`);
      toast.success(data.message || "Bank account verified");
      return { walletId, account: data.account, bankVerified: data.bankVerified };
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to verify bank account";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Initial State
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // self (partner)
  wallet: null,
  bankAccounts: [],
  loading: false,
  error: null,

  // admin
  admin: {
    wallets: [],
    total: 0,
    page: 1,
    limit: 20,
    selectedWallet: null,
    loading: false,
    error: null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────

const partnerWalletSlice = createSlice({
  name: "partnerWallet",
  initialState,
  reducers: {
    clearPartnerWalletError(state) {
      state.error = null;
      state.admin.error = null;
    },
    resetPartnerWallet() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      // ── fetchPartnerWallet ──────────────────────────────────────────────
      .addCase(fetchPartnerWallet.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPartnerWallet.fulfilled, (state, action) => {
        state.loading = false;
        state.wallet = action.payload;
        state.bankAccounts = action.payload?.bankDetails || [];
      })
      .addCase(fetchPartnerWallet.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // ── fetchPartnerBankAccounts ────────────────────────────────────────
      .addCase(fetchPartnerBankAccounts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPartnerBankAccounts.fulfilled, (state, action) => {
        state.loading = false;
        state.bankAccounts = action.payload;
      })
      .addCase(fetchPartnerBankAccounts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // ── addPartnerBankAccount ───────────────────────────────────────────
      .addCase(addPartnerBankAccount.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addPartnerBankAccount.fulfilled, (state, action) => {
        state.loading = false;
        state.bankAccounts = action.payload;
      })
      .addCase(addPartnerBankAccount.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })

      // ── setPrimaryPartnerBankAccount ────────────────────────────────────
      .addCase(setPrimaryPartnerBankAccount.fulfilled, (state, action) => {
        const primary = action.payload;
        state.bankAccounts = state.bankAccounts.map((b) => ({
          ...b,
          isPrimary: b._id === primary._id,
        }));
      })
      .addCase(setPrimaryPartnerBankAccount.rejected, (state, action) => {
        state.error = action.payload;
      })

      // ── removePartnerBankAccount ────────────────────────────────────────
      .addCase(removePartnerBankAccount.fulfilled, (state, action) => {
        state.bankAccounts = state.bankAccounts.filter((b) => b._id !== action.payload);
      })
      .addCase(removePartnerBankAccount.rejected, (state, action) => {
        state.error = action.payload;
      })

      // ── fetchAdminPartnerWallets ─────────────────────────────────────────
      .addCase(fetchAdminPartnerWallets.pending, (state) => {
        state.admin.loading = true;
        state.admin.error = null;
      })
      .addCase(fetchAdminPartnerWallets.fulfilled, (state, action) => {
        state.admin.loading = false;
        state.admin.wallets = action.payload.wallets;
        state.admin.total = action.payload.total;
        state.admin.page = action.payload.page;
        state.admin.limit = action.payload.limit;
      })
      .addCase(fetchAdminPartnerWallets.rejected, (state, action) => {
        state.admin.loading = false;
        state.admin.error = action.payload;
      })

      // ── fetchAdminPartnerWalletById ──────────────────────────────────────
      .addCase(fetchAdminPartnerWalletById.pending, (state) => {
        state.admin.loading = true;
        state.admin.error = null;
      })
      .addCase(fetchAdminPartnerWalletById.fulfilled, (state, action) => {
        state.admin.loading = false;
        state.admin.selectedWallet = action.payload;
      })
      .addCase(fetchAdminPartnerWalletById.rejected, (state, action) => {
        state.admin.loading = false;
        state.admin.error = action.payload;
      })

      // ── updateAdminWalletStatus ──────────────────────────────────────────
      .addCase(updateAdminWalletStatus.fulfilled, (state, action) => {
        const { walletId, walletStatus } = action.payload;
        state.admin.wallets = state.admin.wallets.map((w) =>
          w._id === walletId ? { ...w, walletStatus } : w
        );
        if (state.admin.selectedWallet?._id === walletId) {
          state.admin.selectedWallet.walletStatus = walletStatus;
        }
      })
      .addCase(updateAdminWalletStatus.rejected, (state, action) => {
        state.admin.error = action.payload;
      })

      // ── updateAdminWalletKycStatus ───────────────────────────────────────
      .addCase(updateAdminWalletKycStatus.fulfilled, (state, action) => {
        const { walletId, kycVerified, bankVerified } = action.payload;
        state.admin.wallets = state.admin.wallets.map((w) =>
          w._id === walletId ? { ...w, kycVerified, bankVerified } : w
        );
        if (state.admin.selectedWallet?._id === walletId) {
          state.admin.selectedWallet.kycVerified = kycVerified;
          state.admin.selectedWallet.bankVerified = bankVerified;
        }
      })
      .addCase(updateAdminWalletKycStatus.rejected, (state, action) => {
        state.admin.error = action.payload;
      })

      // ── toggleAdminWalletHold ────────────────────────────────────────────
      .addCase(toggleAdminWalletHold.fulfilled, (state, action) => {
        const { walletId, complianceHold } = action.payload;
        state.admin.wallets = state.admin.wallets.map((w) =>
          w._id === walletId ? { ...w, complianceHold } : w
        );
        if (state.admin.selectedWallet?._id === walletId) {
          state.admin.selectedWallet.complianceHold = complianceHold;
        }
      })
      .addCase(toggleAdminWalletHold.rejected, (state, action) => {
        state.admin.error = action.payload;
      })

      // ── verifyAdminPartnerBankAccount ────────────────────────────────────
      .addCase(verifyAdminPartnerBankAccount.fulfilled, (state, action) => {
        const { walletId, account, bankVerified } = action.payload;
        if (state.admin.selectedWallet?._id === walletId) {
          state.admin.selectedWallet.bankDetails = (
            state.admin.selectedWallet.bankDetails || []
          ).map((b) => (b._id === account._id ? account : b));
          state.admin.selectedWallet.bankVerified = bankVerified;
        }
      })
      .addCase(verifyAdminPartnerBankAccount.rejected, (state, action) => {
        state.admin.error = action.payload;
      });
  },
});

export const { clearPartnerWalletError, resetPartnerWallet } = partnerWalletSlice.actions;
export default partnerWalletSlice.reducer;