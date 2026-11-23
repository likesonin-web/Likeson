/**
 * accountingSlice.js
 *
 * CHANGES from previous version:
 *   1. Added wallet.bankDetails state + 5 new bank CRUD thunks:
 *        fetchMyBankDetails, addBankAccount, updateBankAccount,
 *        deleteBankAccount, setPrimaryBankAccount
 *      + 1 admin thunk: verifyBankAccount
 *   2. requestWithdrawal payload changed:
 *        OLD: { amount, bankAccountDetails: { accountHolderName, accountNumber, ifscCode, ... } }
 *        NEW: { amount, bankId? }   ← bankId optional (uses primary if omitted)
 *   3. wallet.mine now includes bankDetails array from GET /wallets/me response
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import accountingService from '@/services/accountingService';

const SLICE_NAME = 'accounting';

// ── Shared helpers ─────────────────────────────────────────────────────────

const defaultPagination = () => ({ page: 1, limit: 20, total: 0, pages: 0 });

const extractErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.message || fallback || 'Something went wrong';

function createThunk(type, apiFn, opts = {}) {
  return createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      const body = await apiFn(arg);
      if (!opts.silent && opts.successMessage) {
        const msg =
          typeof opts.successMessage === 'function'
            ? opts.successMessage(body, arg)
            : opts.successMessage;
        if (msg) toast.success(msg);
      }
      return body;
    } catch (err) {
      const message = extractErrorMessage(err, opts.errorMessage);
      if (!opts.silent && err?.response?.status !== 403) {
        toast.error(message);
      }
      return rejectWithValue({ message, status: err?.response?.status ?? null });
    }
  });
}

const thunkKey = (type) => type.replace(`${SLICE_NAME}/`, '');

const pendingCase = (key) => (state) => {
  state.loading[key] = true;
  state.errors[key] = null;
};

const rejectedCase = (key) => (state, action) => {
  state.loading[key] = false;
  state.errors[key] = action.payload?.message ?? 'Request failed';
};

// ═══════════════════════════════════════════════════════════════════════════
// THUNKS
// ═══════════════════════════════════════════════════════════════════════════

// ── §1 Settlement ────────────────────────────────────────────────────────

export const processBookingSettlement = createThunk(
  `${SLICE_NAME}/settlement/process`,
  (bookingId) => accountingService.processBookingSettlement(bookingId),
  { successMessage: (body) => body.message || 'Settlement processed', errorMessage: 'Failed to process settlement' }
);

export const fetchSettlementStatus = createThunk(
  `${SLICE_NAME}/settlement/fetchStatus`,
  (bookingId) => accountingService.getSettlementStatus(bookingId),
  { errorMessage: 'Failed to load settlement status' }
);

// ── §2 Wallet ────────────────────────────────────────────────────────────

export const fetchMyWallet = createThunk(
  `${SLICE_NAME}/wallet/fetchMine`,
  () => accountingService.getMyWallet(),
  { errorMessage: 'Failed to load your wallet', silent: true }
);

export const fetchPartnerWallet = createThunk(
  `${SLICE_NAME}/wallet/fetchOne`,
  (partnerId) => accountingService.getPartnerWallet(partnerId),
  { errorMessage: 'Failed to load partner wallet' }
);

export const fetchWalletsList = createThunk(
  `${SLICE_NAME}/wallet/fetchList`,
  (params) => accountingService.listWallets(params),
  { errorMessage: 'Failed to load wallets' }
);

export const freezeWallet = createThunk(
  `${SLICE_NAME}/wallet/freeze`,
  ({ partnerId, reason }) => accountingService.freezeWallet(partnerId, reason),
  { successMessage: (body) => body.message || 'Wallet frozen', errorMessage: 'Failed to freeze wallet' }
);

export const releaseWallet = createThunk(
  `${SLICE_NAME}/wallet/release`,
  ({ partnerId, reason }) => accountingService.releaseWallet(partnerId, reason),
  { successMessage: (body) => body.message || 'Wallet released', errorMessage: 'Failed to release wallet' }
);

export const updateWalletKycStatus = createThunk(
  `${SLICE_NAME}/wallet/updateKyc`,
  ({ partnerId, kycVerified, bankVerified }) =>
    accountingService.updateWalletKycStatus(partnerId, { kycVerified, bankVerified }),
  { successMessage: (body) => body.message || 'KYC status updated', errorMessage: 'Failed to update KYC status' }
);

// ── §2b Wallet Bank Details ──────────────────────────────────────────────
// NEW — bank CRUD on wallet

export const fetchMyBankDetails = createThunk(
  `${SLICE_NAME}/wallet/bank/fetchMine`,
  () => accountingService.getMyBankDetails(),
  { errorMessage: 'Failed to load bank accounts', silent: true }
);

export const addBankAccount = createThunk(
  `${SLICE_NAME}/wallet/bank/add`,
  (payload) => accountingService.addBankAccount(payload),
  { successMessage: 'Bank account added', errorMessage: 'Failed to add bank account' }
);

export const updateBankAccount = createThunk(
  `${SLICE_NAME}/wallet/bank/update`,
  ({ bankId, payload }) => accountingService.updateBankAccount(bankId, payload),
  { successMessage: 'Bank account updated', errorMessage: 'Failed to update bank account' }
);

export const deleteBankAccount = createThunk(
  `${SLICE_NAME}/wallet/bank/delete`,
  (bankId) => accountingService.deleteBankAccount(bankId),
  { successMessage: 'Bank account removed', errorMessage: 'Failed to remove bank account' }
);

export const setPrimaryBankAccount = createThunk(
  `${SLICE_NAME}/wallet/bank/setPrimary`,
  (bankId) => accountingService.setPrimaryBankAccount(bankId),
  { successMessage: 'Primary bank account updated', errorMessage: 'Failed to set primary bank account' }
);

// Admin: verify a partner bank account
export const verifyBankAccount = createThunk(
  `${SLICE_NAME}/wallet/bank/verify`,
  ({ partnerId, bankId }) => accountingService.verifyBankAccount(partnerId, bankId),
  { successMessage: 'Bank account verified', errorMessage: 'Failed to verify bank account' }
);

// ── §3 Transactions ──────────────────────────────────────────────────────

export const fetchMyTransactions = createThunk(
  `${SLICE_NAME}/transactions/fetchMine`,
  (params) => accountingService.getMyTransactions(params),
  { errorMessage: 'Failed to load your transactions' }
);

export const fetchPartnerTransactions = createThunk(
  `${SLICE_NAME}/transactions/fetchForPartner`,
  ({ partnerId, params }) => accountingService.getPartnerTransactions(partnerId, params),
  { errorMessage: 'Failed to load partner transactions' }
);

export const fetchTransactionByTxnId = createThunk(
  `${SLICE_NAME}/transactions/fetchOne`,
  (txnId) => accountingService.getTransactionByTxnId(txnId),
  { errorMessage: 'Failed to load transaction' }
);

// ── §4 Settlements ───────────────────────────────────────────────────────

export const fetchMySettlements = createThunk(
  `${SLICE_NAME}/settlements/fetchMine`,
  (params) => accountingService.getMySettlements(params),
  { errorMessage: 'Failed to load your settlements' }
);

export const fetchSettlementById = createThunk(
  `${SLICE_NAME}/settlements/fetchOne`,
  (settlementId) => accountingService.getSettlementById(settlementId),
  { errorMessage: 'Failed to load settlement' }
);

export const fetchSettlementsList = createThunk(
  `${SLICE_NAME}/settlements/fetchList`,
  (params) => accountingService.listSettlements(params),
  { errorMessage: 'Failed to load settlements' }
);

export const reverseSettlement = createThunk(
  `${SLICE_NAME}/settlements/reverse`,
  ({ settlementId, reason }) => accountingService.reverseSettlement(settlementId, reason),
  { successMessage: (body) => body.message || 'Settlement reversed', errorMessage: 'Failed to reverse settlement' }
);

// ── §5 Allocations ───────────────────────────────────────────────────────

export const fetchBookingAllocations = createThunk(
  `${SLICE_NAME}/allocations/fetchForBooking`,
  (bookingId) => accountingService.getBookingAllocations(bookingId),
  { errorMessage: 'Failed to load booking allocations' }
);

export const fetchMyAllocations = createThunk(
  `${SLICE_NAME}/allocations/fetchMine`,
  (params) => accountingService.getMyAllocations(params),
  { errorMessage: 'Failed to load your allocations' }
);

// ── §6 Withdrawals ───────────────────────────────────────────────────────
// CHANGED: requestWithdrawal payload is now { amount, bankId? }

export const requestWithdrawal = createThunk(
  `${SLICE_NAME}/withdrawals/request`,
  // payload = { amount: number, bankId?: string }
  (payload) => accountingService.requestWithdrawal(payload),
  { successMessage: (body) => body.message || 'Withdrawal requested', errorMessage: 'Failed to request withdrawal' }
);

export const fetchMyWithdrawals = createThunk(
  `${SLICE_NAME}/withdrawals/fetchMine`,
  (params) => accountingService.getMyWithdrawals(params),
  { errorMessage: 'Failed to load your withdrawals' }
);

export const fetchWithdrawalsList = createThunk(
  `${SLICE_NAME}/withdrawals/fetchList`,
  (params) => accountingService.listWithdrawals(params),
  { errorMessage: 'Failed to load withdrawals' }
);

export const fetchWithdrawalById = createThunk(
  `${SLICE_NAME}/withdrawals/fetchOne`,
  (withdrawalId) => accountingService.getWithdrawalById(withdrawalId),
  { errorMessage: 'Failed to load withdrawal' }
);

export const approveWithdrawal = createThunk(
  `${SLICE_NAME}/withdrawals/approve`,
  (withdrawalId) => accountingService.approveWithdrawal(withdrawalId),
  { successMessage: (body) => body.message || 'Withdrawal approved', errorMessage: 'Failed to approve withdrawal' }
);

export const rejectWithdrawal = createThunk(
  `${SLICE_NAME}/withdrawals/reject`,
  ({ withdrawalId, reason }) => accountingService.rejectWithdrawal(withdrawalId, reason),
  { successMessage: (body) => body.message || 'Withdrawal rejected', errorMessage: 'Failed to reject withdrawal' }
);

export const retryWithdrawal = createThunk(
  `${SLICE_NAME}/withdrawals/retry`,
  (withdrawalId) => accountingService.retryWithdrawal(withdrawalId),
  { successMessage: (body) => body.message || 'Withdrawal retry initiated', errorMessage: 'Failed to retry withdrawal' }
);

// ── §7 Liabilities ───────────────────────────────────────────────────────

export const fetchMyLiabilities = createThunk(
  `${SLICE_NAME}/liabilities/fetchMine`,
  (params) => accountingService.getMyLiabilities(params),
  { errorMessage: 'Failed to load your liabilities' }
);

export const fetchLiabilitiesList = createThunk(
  `${SLICE_NAME}/liabilities/fetchList`,
  (params) => accountingService.listLiabilities(params),
  { errorMessage: 'Failed to load liabilities' }
);

export const waiveLiability = createThunk(
  `${SLICE_NAME}/liabilities/waive`,
  ({ liabilityId, reason }) => accountingService.waiveLiability(liabilityId, reason),
  { successMessage: (body) => body.message || 'Liability waived', errorMessage: 'Failed to waive liability' }
);

export const fetchLiabilityById = createThunk(
  `${SLICE_NAME}/liabilities/fetchOne`,
  (liabilityId) => accountingService.getLiabilityById(liabilityId),
  { errorMessage: 'Failed to load liability' }
);

// ── §8 Reconciliation ────────────────────────────────────────────────────

export const runReconciliation = createThunk(
  `${SLICE_NAME}/reconciliation/run`,
  () => accountingService.runReconciliation(),
  { successMessage: (body) => body.message || 'Reconciliation complete', errorMessage: 'Failed to run reconciliation' }
);

export const reconcileWallet = createThunk(
  `${SLICE_NAME}/reconciliation/wallet`,
  (walletId) => accountingService.reconcileWallet(walletId),
  {
    successMessage: (body) => body.mismatch ? 'Wallet reconciled — mismatch found' : 'Wallet reconciled, no mismatch',
    errorMessage: 'Failed to reconcile wallet',
  }
);

export const fetchPlatformRevenueReconciliation = createThunk(
  `${SLICE_NAME}/reconciliation/platformRevenue`,
  (params) => accountingService.getPlatformRevenueReconciliation(params),
  { errorMessage: 'Failed to load platform revenue reconciliation' }
);

// ── §9 Finance admin ─────────────────────────────────────────────────────

export const manualCredit = createThunk(
  `${SLICE_NAME}/finance/manualCredit`,
  (payload) => accountingService.manualCredit(payload),
  { successMessage: (body) => body.message || 'Manual credit applied', errorMessage: 'Failed to apply manual credit' }
);

export const manualDebit = createThunk(
  `${SLICE_NAME}/finance/manualDebit`,
  (payload) => accountingService.manualDebit(payload),
  { successMessage: (body) => body.message || 'Manual debit applied', errorMessage: 'Failed to apply manual debit' }
);

export const forceSettleBooking = createThunk(
  `${SLICE_NAME}/finance/forceSettle`,
  (bookingId) => accountingService.forceSettleBooking(bookingId),
  { successMessage: (body) => body.message || 'Force settlement completed', errorMessage: 'Failed to force-settle booking' }
);

// ── §10 Reports ──────────────────────────────────────────────────────────

export const fetchPartnerDashboard = createThunk(
  `${SLICE_NAME}/reports/partnerDashboard`,
  () => accountingService.getPartnerDashboard(),
  { errorMessage: 'Failed to load dashboard', silent: true }
);

export const fetchPartnerEarnings = createThunk(
  `${SLICE_NAME}/reports/partnerEarnings`,
  ({ partnerId, params }) => accountingService.getPartnerEarnings(partnerId, params),
  { errorMessage: 'Failed to load partner earnings' }
);

export const fetchPlatformRevenueSummary = createThunk(
  `${SLICE_NAME}/reports/platformRevenueSummary`,
  (params) => accountingService.getPlatformRevenueSummary(params),
  { errorMessage: 'Failed to load platform revenue summary' }
);

export const fetchSettlementSummary = createThunk(
  `${SLICE_NAME}/reports/settlementSummary`,
  (params) => accountingService.getSettlementSummary(params),
  { errorMessage: 'Failed to load settlement summary' }
);

export const fetchLiabilitySummary = createThunk(
  `${SLICE_NAME}/reports/liabilitySummary`,
  () => accountingService.getLiabilitySummary(),
  { errorMessage: 'Failed to load liability summary' }
);

// ═══════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════

const initialState = {
  settlement: {
    statusByBooking: {},
    lastProcessResult: null,
  },

  wallet: {
    mine: null,
    selectedPartnerWallet: null,
    list: [],
    pagination: defaultPagination(),
    // NEW — bank details for logged-in partner
    bankDetails: [],
    bankVerified: false,
  },

  transactions: {
    mine: [],
    minePagination: defaultPagination(),
    byPartner: {},
    selectedTxn: null,
  },

  settlements: {
    mine: [],
    minePagination: defaultPagination(),
    list: [],
    listPagination: defaultPagination(),
    selected: null,
  },

  allocations: {
    mine: [],
    minePagination: defaultPagination(),
    byBooking: {},
  },

  withdrawals: {
    mine: [],
    minePagination: defaultPagination(),
    list: [],
    listPagination: defaultPagination(),
    selected: null,
  },

  liabilities: {
    mine: [],
    minePagination: defaultPagination(),
    myOutstandingTotal: 0,
    list: [],
    listPagination: defaultPagination(),
    listSummary: {},
    selected: null,
  },

  reconciliation: {
    lastRun: null,
    walletResults: {},
    platformRevenue: null,
  },

  finance: {
    lastManualCredit: null,
    lastManualDebit: null,
    lastForceSettle: null,
  },

  reports: {
    partnerDashboard: null,
    partnerEarnings: {},
    platformRevenueSummary: null,
    settlementSummary: null,
    liabilitySummary: null,
  },

  loading: {},
  errors: {},
};

const accountingSlice = createSlice({
  name: SLICE_NAME,
  initialState,
  reducers: {
    clearSelectedPartnerWallet(state) { state.wallet.selectedPartnerWallet = null; },
    clearSelectedTxn(state)           { state.transactions.selectedTxn = null; },
    clearSelectedSettlement(state)     { state.settlements.selected = null; },
    clearSelectedWithdrawal(state)     { state.withdrawals.selected = null; },
    clearSelectedLiability(state)      { state.liabilities.selected = null; },
    clearAccountingError(state, action){ state.errors[action.payload] = null; },
    resetAccountingErrors(state)       { state.errors = {}; },
    resetAccountingState()             { return initialState; },
  },
  extraReducers: (builder) => {

    // ── §1 Settlement ────────────────────────────────────────────────────
    builder
      .addCase(processBookingSettlement.pending,   pendingCase(thunkKey(processBookingSettlement.typePrefix)))
      .addCase(processBookingSettlement.fulfilled, (state, action) => {
        state.loading[thunkKey(processBookingSettlement.typePrefix)] = false;
        state.settlement.lastProcessResult = action.payload.data;
      })
      .addCase(processBookingSettlement.rejected,  rejectedCase(thunkKey(processBookingSettlement.typePrefix)))

      .addCase(fetchSettlementStatus.pending,   pendingCase(thunkKey(fetchSettlementStatus.typePrefix)))
      .addCase(fetchSettlementStatus.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchSettlementStatus.typePrefix)] = false;
        state.settlement.statusByBooking[action.meta.arg] = action.payload.data;
      })
      .addCase(fetchSettlementStatus.rejected,  rejectedCase(thunkKey(fetchSettlementStatus.typePrefix)));

    // ── §2 Wallet ────────────────────────────────────────────────────────
    builder
      .addCase(fetchMyWallet.pending,   pendingCase(thunkKey(fetchMyWallet.typePrefix)))
      .addCase(fetchMyWallet.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchMyWallet.typePrefix)] = false;
        state.wallet.mine = action.payload.data;
      })
      .addCase(fetchMyWallet.rejected,  rejectedCase(thunkKey(fetchMyWallet.typePrefix)))

      .addCase(fetchPartnerWallet.pending,   pendingCase(thunkKey(fetchPartnerWallet.typePrefix)))
      .addCase(fetchPartnerWallet.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchPartnerWallet.typePrefix)] = false;
        state.wallet.selectedPartnerWallet = action.payload.data;
      })
      .addCase(fetchPartnerWallet.rejected,  rejectedCase(thunkKey(fetchPartnerWallet.typePrefix)))

      .addCase(fetchWalletsList.pending,   pendingCase(thunkKey(fetchWalletsList.typePrefix)))
      .addCase(fetchWalletsList.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchWalletsList.typePrefix)] = false;
        state.wallet.list       = action.payload.data;
        state.wallet.pagination = action.payload.pagination ?? defaultPagination();
      })
      .addCase(fetchWalletsList.rejected,  rejectedCase(thunkKey(fetchWalletsList.typePrefix)))

      .addCase(freezeWallet.pending,   pendingCase(thunkKey(freezeWallet.typePrefix)))
      .addCase(freezeWallet.fulfilled, (state, action) => {
        state.loading[thunkKey(freezeWallet.typePrefix)] = false;
        patchWalletStatus(state, action.meta.arg.partnerId, action.payload.data.walletStatus);
      })
      .addCase(freezeWallet.rejected,  rejectedCase(thunkKey(freezeWallet.typePrefix)))

      .addCase(releaseWallet.pending,   pendingCase(thunkKey(releaseWallet.typePrefix)))
      .addCase(releaseWallet.fulfilled, (state, action) => {
        state.loading[thunkKey(releaseWallet.typePrefix)] = false;
        patchWalletStatus(state, action.meta.arg.partnerId, action.payload.data.walletStatus);
      })
      .addCase(releaseWallet.rejected,  rejectedCase(thunkKey(releaseWallet.typePrefix)))

      .addCase(updateWalletKycStatus.pending,   pendingCase(thunkKey(updateWalletKycStatus.typePrefix)))
      .addCase(updateWalletKycStatus.fulfilled, (state, action) => {
        state.loading[thunkKey(updateWalletKycStatus.typePrefix)] = false;
        const { partnerId, kycVerified, bankVerified } = action.meta.arg;
        const listItem = state.wallet.list.find(
          (w) => String(w.partner?._id ?? w.partner) === String(partnerId)
        );
        if (listItem) { listItem.kycVerified = kycVerified; listItem.bankVerified = bankVerified; }
        const sel = state.wallet.selectedPartnerWallet?.wallet;
        if (sel && String(sel.partner) === String(partnerId)) {
          sel.kycVerified = kycVerified;
          sel.bankVerified = bankVerified;
        }
      })
      .addCase(updateWalletKycStatus.rejected, rejectedCase(thunkKey(updateWalletKycStatus.typePrefix)));

    // ── §2b Wallet Bank CRUD ─────────────────────────────────────────────
    // NEW cases
    builder
      .addCase(fetchMyBankDetails.pending,   pendingCase(thunkKey(fetchMyBankDetails.typePrefix)))
      .addCase(fetchMyBankDetails.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchMyBankDetails.typePrefix)] = false;
        state.wallet.bankDetails  = action.payload.data.bankDetails ?? [];
        state.wallet.bankVerified = action.payload.data.bankVerified ?? false;
      })
      .addCase(fetchMyBankDetails.rejected,  rejectedCase(thunkKey(fetchMyBankDetails.typePrefix)))

      .addCase(addBankAccount.pending,   pendingCase(thunkKey(addBankAccount.typePrefix)))
      .addCase(addBankAccount.fulfilled, (state, action) => {
        state.loading[thunkKey(addBankAccount.typePrefix)] = false;
        // Server returns the new bank entry; push to local list
        state.wallet.bankDetails.push(action.payload.data);
      })
      .addCase(addBankAccount.rejected,  rejectedCase(thunkKey(addBankAccount.typePrefix)))

      .addCase(updateBankAccount.pending,   pendingCase(thunkKey(updateBankAccount.typePrefix)))
      .addCase(updateBankAccount.fulfilled, (state, action) => {
        state.loading[thunkKey(updateBankAccount.typePrefix)] = false;
        const updated = action.payload.data;
        const idx = state.wallet.bankDetails.findIndex(
          (b) => String(b._id) === String(updated.bankId ?? updated._id)
        );
        if (idx >= 0) Object.assign(state.wallet.bankDetails[idx], updated);
      })
      .addCase(updateBankAccount.rejected,  rejectedCase(thunkKey(updateBankAccount.typePrefix)))

      .addCase(deleteBankAccount.pending,   pendingCase(thunkKey(deleteBankAccount.typePrefix)))
      .addCase(deleteBankAccount.fulfilled, (state, action) => {
        state.loading[thunkKey(deleteBankAccount.typePrefix)] = false;
        const bankId = action.meta.arg;
        state.wallet.bankDetails = state.wallet.bankDetails.filter(
          (b) => String(b._id) !== String(bankId)
        );
      })
      .addCase(deleteBankAccount.rejected,  rejectedCase(thunkKey(deleteBankAccount.typePrefix)))

      .addCase(setPrimaryBankAccount.pending,   pendingCase(thunkKey(setPrimaryBankAccount.typePrefix)))
      .addCase(setPrimaryBankAccount.fulfilled, (state, action) => {
        state.loading[thunkKey(setPrimaryBankAccount.typePrefix)] = false;
        const { bankId, bankVerified } = action.payload.data;
        // Flip primary flags locally
        state.wallet.bankDetails.forEach((b) => {
          b.isPrimary = String(b._id) === String(bankId);
        });
        state.wallet.bankVerified = bankVerified ?? state.wallet.bankVerified;
      })
      .addCase(setPrimaryBankAccount.rejected, rejectedCase(thunkKey(setPrimaryBankAccount.typePrefix)))

      // verifyBankAccount — admin only; updates partner's selected wallet view
      .addCase(verifyBankAccount.pending,   pendingCase(thunkKey(verifyBankAccount.typePrefix)))
      .addCase(verifyBankAccount.fulfilled, (state, action) => {
        state.loading[thunkKey(verifyBankAccount.typePrefix)] = false;
        const { bankId, bankVerified } = action.payload.data;
        // Patch selectedPartnerWallet if loaded
        const banks = state.wallet.selectedPartnerWallet?.wallet?.bankDetails;
        if (banks) {
          const b = banks.find((b) => String(b._id) === String(bankId));
          if (b) { b.isVerified = true; }
          if (state.wallet.selectedPartnerWallet.wallet) {
            state.wallet.selectedPartnerWallet.wallet.bankVerified = bankVerified;
          }
        }
      })
      .addCase(verifyBankAccount.rejected, rejectedCase(thunkKey(verifyBankAccount.typePrefix)));

    // ── §3 Transactions ──────────────────────────────────────────────────
    builder
      .addCase(fetchMyTransactions.pending,   pendingCase(thunkKey(fetchMyTransactions.typePrefix)))
      .addCase(fetchMyTransactions.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchMyTransactions.typePrefix)] = false;
        state.transactions.mine           = action.payload.data;
        state.transactions.minePagination = action.payload.pagination ?? defaultPagination();
      })
      .addCase(fetchMyTransactions.rejected,  rejectedCase(thunkKey(fetchMyTransactions.typePrefix)))

      .addCase(fetchPartnerTransactions.pending,   pendingCase(thunkKey(fetchPartnerTransactions.typePrefix)))
      .addCase(fetchPartnerTransactions.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchPartnerTransactions.typePrefix)] = false;
        state.transactions.byPartner[action.meta.arg.partnerId] = {
          items:      action.payload.data,
          pagination: action.payload.pagination ?? defaultPagination(),
        };
      })
      .addCase(fetchPartnerTransactions.rejected,  rejectedCase(thunkKey(fetchPartnerTransactions.typePrefix)))

      .addCase(fetchTransactionByTxnId.pending,   pendingCase(thunkKey(fetchTransactionByTxnId.typePrefix)))
      .addCase(fetchTransactionByTxnId.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchTransactionByTxnId.typePrefix)] = false;
        state.transactions.selectedTxn = action.payload.data;
      })
      .addCase(fetchTransactionByTxnId.rejected,  rejectedCase(thunkKey(fetchTransactionByTxnId.typePrefix)));

    // ── §4 Settlements ───────────────────────────────────────────────────
    builder
      .addCase(fetchMySettlements.pending,   pendingCase(thunkKey(fetchMySettlements.typePrefix)))
      .addCase(fetchMySettlements.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchMySettlements.typePrefix)] = false;
        state.settlements.mine           = action.payload.data;
        state.settlements.minePagination = action.payload.pagination ?? defaultPagination();
      })
      .addCase(fetchMySettlements.rejected,  rejectedCase(thunkKey(fetchMySettlements.typePrefix)))

      .addCase(fetchSettlementById.pending,   pendingCase(thunkKey(fetchSettlementById.typePrefix)))
      .addCase(fetchSettlementById.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchSettlementById.typePrefix)] = false;
        state.settlements.selected = action.payload.data;
      })
      .addCase(fetchSettlementById.rejected,  rejectedCase(thunkKey(fetchSettlementById.typePrefix)))

      .addCase(fetchSettlementsList.pending,   pendingCase(thunkKey(fetchSettlementsList.typePrefix)))
      .addCase(fetchSettlementsList.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchSettlementsList.typePrefix)] = false;
        state.settlements.list           = action.payload.data;
        state.settlements.listPagination = action.payload.pagination ?? defaultPagination();
      })
      .addCase(fetchSettlementsList.rejected,  rejectedCase(thunkKey(fetchSettlementsList.typePrefix)))

      .addCase(reverseSettlement.pending,   pendingCase(thunkKey(reverseSettlement.typePrefix)))
      .addCase(reverseSettlement.fulfilled, (state, action) => {
        state.loading[thunkKey(reverseSettlement.typePrefix)] = false;
        const sid = action.payload.data.settlementId;
        const patch = (s) => { if (s.settlementId === sid) s.settlementStatus = 'REVERSED'; };
        state.settlements.list.forEach(patch);
        state.settlements.mine.forEach(patch);
        if (state.settlements.selected?.settlementId === sid)
          state.settlements.selected.settlementStatus = 'REVERSED';
      })
      .addCase(reverseSettlement.rejected,  rejectedCase(thunkKey(reverseSettlement.typePrefix)));

    // ── §5 Allocations ───────────────────────────────────────────────────
    builder
      .addCase(fetchBookingAllocations.pending,   pendingCase(thunkKey(fetchBookingAllocations.typePrefix)))
      .addCase(fetchBookingAllocations.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchBookingAllocations.typePrefix)] = false;
        state.allocations.byBooking[action.meta.arg] = action.payload.data;
      })
      .addCase(fetchBookingAllocations.rejected,  rejectedCase(thunkKey(fetchBookingAllocations.typePrefix)))

      .addCase(fetchMyAllocations.pending,   pendingCase(thunkKey(fetchMyAllocations.typePrefix)))
      .addCase(fetchMyAllocations.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchMyAllocations.typePrefix)] = false;
        state.allocations.mine           = action.payload.data;
        state.allocations.minePagination = action.payload.pagination ?? defaultPagination();
      })
      .addCase(fetchMyAllocations.rejected,  rejectedCase(thunkKey(fetchMyAllocations.typePrefix)));

    // ── §6 Withdrawals ───────────────────────────────────────────────────
    builder
      .addCase(requestWithdrawal.pending,   pendingCase(thunkKey(requestWithdrawal.typePrefix)))
      .addCase(requestWithdrawal.fulfilled, (state, action) => {
        state.loading[thunkKey(requestWithdrawal.typePrefix)] = false;
        state.withdrawals.mine.unshift(action.payload.data);
      })
      .addCase(requestWithdrawal.rejected,  rejectedCase(thunkKey(requestWithdrawal.typePrefix)))

      .addCase(fetchMyWithdrawals.pending,   pendingCase(thunkKey(fetchMyWithdrawals.typePrefix)))
      .addCase(fetchMyWithdrawals.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchMyWithdrawals.typePrefix)] = false;
        state.withdrawals.mine           = action.payload.data;
        state.withdrawals.minePagination = action.payload.pagination ?? defaultPagination();
      })
      .addCase(fetchMyWithdrawals.rejected,  rejectedCase(thunkKey(fetchMyWithdrawals.typePrefix)))

      .addCase(fetchWithdrawalsList.pending,   pendingCase(thunkKey(fetchWithdrawalsList.typePrefix)))
      .addCase(fetchWithdrawalsList.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchWithdrawalsList.typePrefix)] = false;
        state.withdrawals.list           = action.payload.data;
        state.withdrawals.listPagination = action.payload.pagination ?? defaultPagination();
      })
      .addCase(fetchWithdrawalsList.rejected,  rejectedCase(thunkKey(fetchWithdrawalsList.typePrefix)))

      .addCase(fetchWithdrawalById.pending,   pendingCase(thunkKey(fetchWithdrawalById.typePrefix)))
      .addCase(fetchWithdrawalById.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchWithdrawalById.typePrefix)] = false;
        state.withdrawals.selected = action.payload.data;
      })
      .addCase(fetchWithdrawalById.rejected,  rejectedCase(thunkKey(fetchWithdrawalById.typePrefix)))

      .addCase(approveWithdrawal.pending,   pendingCase(thunkKey(approveWithdrawal.typePrefix)))
      .addCase(approveWithdrawal.fulfilled, (state, action) => {
        state.loading[thunkKey(approveWithdrawal.typePrefix)] = false;
        patchWithdrawalStatus(state, action.payload.data.withdrawalId, action.payload.data.status);
      })
      .addCase(approveWithdrawal.rejected,  rejectedCase(thunkKey(approveWithdrawal.typePrefix)))

      .addCase(rejectWithdrawal.pending,   pendingCase(thunkKey(rejectWithdrawal.typePrefix)))
      .addCase(rejectWithdrawal.fulfilled, (state, action) => {
        state.loading[thunkKey(rejectWithdrawal.typePrefix)] = false;
        patchWithdrawalStatus(state, action.payload.data.withdrawalId, 'REJECTED');
      })
      .addCase(rejectWithdrawal.rejected,  rejectedCase(thunkKey(rejectWithdrawal.typePrefix)))

      .addCase(retryWithdrawal.pending,   pendingCase(thunkKey(retryWithdrawal.typePrefix)))
      .addCase(retryWithdrawal.fulfilled, (state, action) => {
        state.loading[thunkKey(retryWithdrawal.typePrefix)] = false;
        patchWithdrawalStatus(state, action.payload.data.withdrawalId, action.payload.data.status);
      })
      .addCase(retryWithdrawal.rejected,  rejectedCase(thunkKey(retryWithdrawal.typePrefix)));

    // ── §7 Liabilities ───────────────────────────────────────────────────
    builder
      .addCase(fetchMyLiabilities.pending,   pendingCase(thunkKey(fetchMyLiabilities.typePrefix)))
      .addCase(fetchMyLiabilities.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchMyLiabilities.typePrefix)] = false;
        state.liabilities.mine              = action.payload.data;
        state.liabilities.minePagination    = action.payload.pagination ?? defaultPagination();
        state.liabilities.myOutstandingTotal = action.payload.outstandingTotal ?? 0;
      })
      .addCase(fetchMyLiabilities.rejected,  rejectedCase(thunkKey(fetchMyLiabilities.typePrefix)))

      .addCase(fetchLiabilitiesList.pending,   pendingCase(thunkKey(fetchLiabilitiesList.typePrefix)))
      .addCase(fetchLiabilitiesList.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchLiabilitiesList.typePrefix)] = false;
        state.liabilities.list           = action.payload.data;
        state.liabilities.listPagination = action.payload.pagination ?? defaultPagination();
        state.liabilities.listSummary    = action.payload.summary ?? {};
      })
      .addCase(fetchLiabilitiesList.rejected,  rejectedCase(thunkKey(fetchLiabilitiesList.typePrefix)))

      .addCase(waiveLiability.pending,   pendingCase(thunkKey(waiveLiability.typePrefix)))
      .addCase(waiveLiability.fulfilled, (state, action) => {
        state.loading[thunkKey(waiveLiability.typePrefix)] = false;
        const { liabilityId } = action.meta.arg;
        const patch = (l) => {
          if (String(l._id) === String(liabilityId)) {
            l.status = 'WAIVED';
            l.outstandingLiability = 0;
          }
        };
        state.liabilities.list.forEach(patch);
        state.liabilities.mine.forEach(patch);
        if (state.liabilities.selected && String(state.liabilities.selected._id) === String(liabilityId)) {
          state.liabilities.selected.status = 'WAIVED';
          state.liabilities.selected.outstandingLiability = 0;
        }
      })
      .addCase(waiveLiability.rejected,  rejectedCase(thunkKey(waiveLiability.typePrefix)))

      .addCase(fetchLiabilityById.pending,   pendingCase(thunkKey(fetchLiabilityById.typePrefix)))
      .addCase(fetchLiabilityById.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchLiabilityById.typePrefix)] = false;
        state.liabilities.selected = action.payload.data;
      })
      .addCase(fetchLiabilityById.rejected,  rejectedCase(thunkKey(fetchLiabilityById.typePrefix)));

    // ── §8 Reconciliation ────────────────────────────────────────────────
    builder
      .addCase(runReconciliation.pending,   pendingCase(thunkKey(runReconciliation.typePrefix)))
      .addCase(runReconciliation.fulfilled, (state, action) => {
        state.loading[thunkKey(runReconciliation.typePrefix)] = false;
        state.reconciliation.lastRun = action.payload.data;
      })
      .addCase(runReconciliation.rejected,  rejectedCase(thunkKey(runReconciliation.typePrefix)))

      .addCase(reconcileWallet.pending,   pendingCase(thunkKey(reconcileWallet.typePrefix)))
      .addCase(reconcileWallet.fulfilled, (state, action) => {
        state.loading[thunkKey(reconcileWallet.typePrefix)] = false;
        state.reconciliation.walletResults[action.meta.arg] = action.payload.data;
      })
      .addCase(reconcileWallet.rejected,  rejectedCase(thunkKey(reconcileWallet.typePrefix)))

      .addCase(fetchPlatformRevenueReconciliation.pending,   pendingCase(thunkKey(fetchPlatformRevenueReconciliation.typePrefix)))
      .addCase(fetchPlatformRevenueReconciliation.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchPlatformRevenueReconciliation.typePrefix)] = false;
        state.reconciliation.platformRevenue = action.payload.data;
      })
      .addCase(fetchPlatformRevenueReconciliation.rejected,  rejectedCase(thunkKey(fetchPlatformRevenueReconciliation.typePrefix)));

    // ── §9 Finance admin ─────────────────────────────────────────────────
    builder
      .addCase(manualCredit.pending,   pendingCase(thunkKey(manualCredit.typePrefix)))
      .addCase(manualCredit.fulfilled, (state, action) => {
        state.loading[thunkKey(manualCredit.typePrefix)] = false;
        state.finance.lastManualCredit = action.payload.data;
      })
      .addCase(manualCredit.rejected,  rejectedCase(thunkKey(manualCredit.typePrefix)))

      .addCase(manualDebit.pending,   pendingCase(thunkKey(manualDebit.typePrefix)))
      .addCase(manualDebit.fulfilled, (state, action) => {
        state.loading[thunkKey(manualDebit.typePrefix)] = false;
        state.finance.lastManualDebit = action.payload.data;
      })
      .addCase(manualDebit.rejected,  rejectedCase(thunkKey(manualDebit.typePrefix)))

      .addCase(forceSettleBooking.pending,   pendingCase(thunkKey(forceSettleBooking.typePrefix)))
      .addCase(forceSettleBooking.fulfilled, (state, action) => {
        state.loading[thunkKey(forceSettleBooking.typePrefix)] = false;
        state.finance.lastForceSettle = action.payload.data;
      })
      .addCase(forceSettleBooking.rejected,  rejectedCase(thunkKey(forceSettleBooking.typePrefix)));

    // ── §10 Reports ──────────────────────────────────────────────────────
    builder
      .addCase(fetchPartnerDashboard.pending,   pendingCase(thunkKey(fetchPartnerDashboard.typePrefix)))
      .addCase(fetchPartnerDashboard.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchPartnerDashboard.typePrefix)] = false;
        state.reports.partnerDashboard = action.payload.data;
      })
      .addCase(fetchPartnerDashboard.rejected,  rejectedCase(thunkKey(fetchPartnerDashboard.typePrefix)))

      .addCase(fetchPartnerEarnings.pending,   pendingCase(thunkKey(fetchPartnerEarnings.typePrefix)))
      .addCase(fetchPartnerEarnings.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchPartnerEarnings.typePrefix)] = false;
        state.reports.partnerEarnings[action.meta.arg.partnerId] = action.payload.data;
      })
      .addCase(fetchPartnerEarnings.rejected,  rejectedCase(thunkKey(fetchPartnerEarnings.typePrefix)))

      .addCase(fetchPlatformRevenueSummary.pending,   pendingCase(thunkKey(fetchPlatformRevenueSummary.typePrefix)))
      .addCase(fetchPlatformRevenueSummary.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchPlatformRevenueSummary.typePrefix)] = false;
        state.reports.platformRevenueSummary = action.payload.data;
      })
      .addCase(fetchPlatformRevenueSummary.rejected,  rejectedCase(thunkKey(fetchPlatformRevenueSummary.typePrefix)))

      .addCase(fetchSettlementSummary.pending,   pendingCase(thunkKey(fetchSettlementSummary.typePrefix)))
      .addCase(fetchSettlementSummary.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchSettlementSummary.typePrefix)] = false;
        state.reports.settlementSummary = action.payload.data;
      })
      .addCase(fetchSettlementSummary.rejected,  rejectedCase(thunkKey(fetchSettlementSummary.typePrefix)))

      .addCase(fetchLiabilitySummary.pending,   pendingCase(thunkKey(fetchLiabilitySummary.typePrefix)))
      .addCase(fetchLiabilitySummary.fulfilled, (state, action) => {
        state.loading[thunkKey(fetchLiabilitySummary.typePrefix)] = false;
        state.reports.liabilitySummary = action.payload.data;
      })
      .addCase(fetchLiabilitySummary.rejected,  rejectedCase(thunkKey(fetchLiabilitySummary.typePrefix)));
  },
});

// ── Patch helpers ─────────────────────────────────────────────────────────

function patchWalletStatus(state, partnerId, walletStatus) {
  const item = state.wallet.list.find(
    (w) => String(w.partner?._id ?? w.partner) === String(partnerId)
  );
  if (item) item.walletStatus = walletStatus;
  const sel = state.wallet.selectedPartnerWallet?.wallet;
  if (sel && String(sel.partner) === String(partnerId)) sel.walletStatus = walletStatus;
}

function patchWithdrawalStatus(state, withdrawalId, status) {
  const patch = (w) => { if (w.withdrawalId === withdrawalId) w.status = status; };
  state.withdrawals.list.forEach(patch);
  state.withdrawals.mine.forEach(patch);
  if (state.withdrawals.selected?.withdrawalId === withdrawalId)
    state.withdrawals.selected.status = status;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS / REDUCER
// ═══════════════════════════════════════════════════════════════════════════

export const accountingActions = accountingSlice.actions;
export const {
  clearSelectedPartnerWallet,
  clearSelectedTxn,
  clearSelectedSettlement,
  clearSelectedWithdrawal,
  clearSelectedLiability,
  clearAccountingError,
  resetAccountingErrors,
  resetAccountingState,
} = accountingSlice.actions;

export default accountingSlice.reducer;

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

const root = (state) => state[SLICE_NAME];

export const selectIsLoading  = (key) => (state) => !!root(state).loading[key];
export const selectError       = (key) => (state) => root(state).errors[key] ?? null;

// Settlement
export const selectSettlementStatus    = (bookingId) => (state) => root(state).settlement.statusByBooking[bookingId] ?? null;
export const selectLastSettlementResult = (state) => root(state).settlement.lastProcessResult;

// Wallet
export const selectMyWallet              = (state) => root(state).wallet.mine;
export const selectSelectedPartnerWallet = (state) => root(state).wallet.selectedPartnerWallet;
export const selectWalletsList           = (state) => root(state).wallet.list;
export const selectWalletsPagination     = (state) => root(state).wallet.pagination;
// NEW bank selectors
export const selectMyBankDetails         = (state) => root(state).wallet.bankDetails;
export const selectMyBankVerified        = (state) => root(state).wallet.bankVerified;
export const selectPrimaryBank           = (state) =>
  root(state).wallet.bankDetails.find((b) => b.isPrimary) ?? null;

// Transactions
export const selectMyTransactions          = (state) => root(state).transactions.mine;
export const selectMyTransactionsPagination= (state) => root(state).transactions.minePagination;
export const selectPartnerTransactions     = (partnerId) => (state) => root(state).transactions.byPartner[partnerId] ?? { items: [], pagination: defaultPagination() };
export const selectSelectedTxn             = (state) => root(state).transactions.selectedTxn;

// Settlements
export const selectMySettlements           = (state) => root(state).settlements.mine;
export const selectMySettlementsPagination = (state) => root(state).settlements.minePagination;
export const selectSettlementsList         = (state) => root(state).settlements.list;
export const selectSettlementsListPagination=(state) => root(state).settlements.listPagination;
export const selectSelectedSettlement      = (state) => root(state).settlements.selected;

// Allocations
export const selectMyAllocations           = (state) => root(state).allocations.mine;
export const selectMyAllocationsPagination = (state) => root(state).allocations.minePagination;
export const selectBookingAllocations      = (bookingId) => (state) => root(state).allocations.byBooking[bookingId] ?? [];

// Withdrawals
export const selectMyWithdrawals           = (state) => root(state).withdrawals.mine;
export const selectMyWithdrawalsPagination = (state) => root(state).withdrawals.minePagination;
export const selectWithdrawalsList         = (state) => root(state).withdrawals.list;
export const selectWithdrawalsListPagination=(state) => root(state).withdrawals.listPagination;
export const selectSelectedWithdrawal      = (state) => root(state).withdrawals.selected;

// Liabilities
export const selectMyLiabilities                = (state) => root(state).liabilities.mine;
export const selectMyLiabilitiesOutstandingTotal= (state) => root(state).liabilities.myOutstandingTotal;
export const selectLiabilitiesList              = (state) => root(state).liabilities.list;
export const selectLiabilitiesListSummary       = (state) => root(state).liabilities.listSummary;
export const selectSelectedLiability            = (state) => root(state).liabilities.selected;

// Reconciliation
export const selectLastReconciliationRun  = (state) => root(state).reconciliation.lastRun;
export const selectWalletReconciliation   = (walletId) => (state) => root(state).reconciliation.walletResults[walletId] ?? null;
export const selectPlatformRevenueReconciliation = (state) => root(state).reconciliation.platformRevenue;

// Finance admin
export const selectLastManualCredit = (state) => root(state).finance.lastManualCredit;
export const selectLastManualDebit  = (state) => root(state).finance.lastManualDebit;
export const selectLastForceSettle  = (state) => root(state).finance.lastForceSettle;

// Reports
export const selectPartnerDashboard      = (state) => root(state).reports.partnerDashboard;
export const selectPartnerEarnings       = (partnerId) => (state) => root(state).reports.partnerEarnings[partnerId] ?? null;
export const selectPlatformRevenueSummary= (state) => root(state).reports.platformRevenueSummary;
export const selectSettlementSummary     = (state) => root(state).reports.settlementSummary;
export const selectLiabilitySummary      = (state) => root(state).reports.liabilitySummary;