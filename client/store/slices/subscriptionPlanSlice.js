import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

 
const extractError = (error) => {
  if (error?.response?.data?.errors) {
    return error.response.data.errors.map((e) => e.msg).join(', ');
  }
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.message === 'Network Error')
    return 'Network error. Please check your connection.';
  return 'Something went wrong. Please try again.';
};

/**
 * Thunk factory — reduces per-thunk boilerplate.
 *
 * @param {string}   typePrefix
 * @param {Function} apiFn         (arg, thunkAPI) => Promise<any>
 * @param {object}   [opts]
 * @param {string}   [opts.successMsg]  toast shown on fulfilled
 * @param {boolean}  [opts.silentError] suppress error toast (background calls)
 * @param {Function} [opts.condition]   (arg, { getState }) => boolean
 *                                      return false to skip dispatch (dedup guard)
 */
const makeThunk = (typePrefix, apiFn, opts = {}) =>
  createAsyncThunk(
    typePrefix,
    async (arg, thunkAPI) => {
      try {
        const result = await apiFn(arg, thunkAPI);
        if (opts.successMsg) toast.success(opts.successMsg);
        return result;
      } catch (error) {
        const message = extractError(error);
        if (!opts.silentError) toast.error(message);
        return thunkAPI.rejectWithValue(message);
      }
    },
    opts.condition ? { condition: opts.condition } : undefined
  );

// ─────────────────────────────────────────────────────────────────────────────
//  § 1  PLAN CATALOGUE
//  Routes: GET /plans  |  GET /plans/:planId
//  FIX: was pointing at /subscriptions/plans — the plans router mounts at /plans.
// ─────────────────────────────────────────────────────────────────────────────

/** GET /plans */
export const fetchAllPlans = makeThunk(
  'subscriptions/fetchAllPlans',
  async () => {
    const { data } = await API.get('/plans');
    return data; // { success, count, pagination, data: Plan[] }
  },
  {
    condition: (_, { getState }) => !getState().subscriptions.plansStatus.loading,
  }
);

/** GET /plans/:planId */
export const fetchPlanById = makeThunk(
  'subscriptions/fetchPlanById',
  async (planId) => {
    const { data } = await API.get(`/plans/${planId}`);
    return data; // { success, data: Plan }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 2  CUSTOM PLAN BUILDER
//  Routes: GET  /custom-plan/pricing
//          POST /custom-plan
//          PUT  /custom-plan/:planId
//          DEL  /custom-plan/:planId
//  NOTE: separate router, not part of the plans router shown to Claude.
//  Left as-is — unverified against source.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /subscriptions/custom-plan/pricing
 *
 * Router response: { success, data: { optionPricing, caps } }
 *
 * NOTE: field is `optionPricing` (NOT `unitPrices` — old name removed).
 * Admin sets prices in PlatformPricingConfig — customers READ-ONLY.
 */
export const fetchCustomPlanPricing = makeThunk(
  'subscriptions/fetchCustomPlanPricing',
  async () => {
    const { data } = await API.get('/subscriptions/custom-plan/pricing');
    return data; // { success, data: { optionPricing, caps } }
  }
);

/** POST /subscriptions/custom-plan — payload: { name, options[] } */
export const createCustomPlan = makeThunk(
  'subscriptions/createCustomPlan',
  async (payload) => {
    const { data } = await API.post('/subscriptions/custom-plan', payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Custom plan created successfully!' }
);

/** PUT /subscriptions/custom-plan/:planId — payload: { planId, name?, options[] } */
export const updateCustomPlan = makeThunk(
  'subscriptions/updateCustomPlan',
  async ({ planId, ...payload }) => {
    const { data } = await API.put(`/subscriptions/custom-plan/${planId}`, payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Custom plan updated.' }
);

/** DELETE /subscriptions/custom-plan/:planId */
export const deleteCustomPlan = makeThunk(
  'subscriptions/deleteCustomPlan',
  async (planId) => {
    const { data } = await API.delete(`/subscriptions/custom-plan/${planId}`);
    return { ...data, planId }; // attach planId for reducer
  },
  { successMsg: 'Custom plan deactivated.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 3  PURCHASE FLOW
//  Routes: POST /buy  |  POST /verify
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /subscriptions/buy
 * payload: { planId, amount, couponCode? }
 *
 * Router response shapes:
 *   ₹0 plan  → { success, activated: true,  data: UserSubscription, message }
 *   paid     → { success, activated: false, orderId, amount, discount,
 *                planName, planType, planId }
 */
export const initiateSubscriptionPurchase = makeThunk(
  'subscriptions/initiateSubscriptionPurchase',
  async (payload) => {
    const { data } = await API.post('/subscriptions/buy', payload);
    return data;
  },
  {
    condition: (_, { getState }) => !getState().subscriptions.purchaseStatus.loading,
  }
);

/**
 * POST /subscriptions/verify
 * payload: { razorpay_order_id, razorpay_payment_id, razorpay_signature,
 *             planId?, amount? }
 */
export const verifySubscriptionPayment = makeThunk(
  'subscriptions/verifySubscriptionPayment',
  async (payload) => {
    const { data } = await API.post('/subscriptions/verify', payload);
    return data; // { success, data: UserSubscription }
  },
  {
    successMsg: 'Subscription activated! Welcome aboard 🎉',
    condition:  (_, { getState }) => !getState().subscriptions.verifyStatus.loading,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 4  CUSTOMER SUBSCRIPTION MANAGEMENT
//  Routes: GET /my  |  GET /my/history  |  PUT /upgrade
//          PUT /cancel  |  PUT /toggle-auto-renew
//          POST /my/members  |  DEL /my/members/:email
// ─────────────────────────────────────────────────────────────────────────────

/** GET /subscriptions/my */
export const fetchMySubscription = makeThunk(
  'subscriptions/fetchMySubscription',
  async () => {
    const { data } = await API.get('/subscriptions/my');
    return data; // { success, data: UserSubscription }
  },
  { silentError: true }
);

/** GET /subscriptions/my/history — params: { page?, limit? } */
export const fetchMySubscriptionHistory = makeThunk(
  'subscriptions/fetchMySubscriptionHistory',
  async (params = {}) => {
    const { data } = await API.get('/subscriptions/my/history', { params });
    return data; // { success, pagination, data: UserSubscription[] }
  }
);

/**
 * PUT /subscriptions/upgrade
 * payload: { newPlanId }
 * Router accepts Active OR Trial status.
 */
export const upgradeSubscription = makeThunk(
  'subscriptions/upgradeSubscription',
  async (payload) => {
    const { data } = await API.put('/subscriptions/upgrade', payload);
    return data; // { success, data: UserSubscription }
  },
  { successMsg: 'Plan upgraded successfully.' }
);

/**
 * PUT /subscriptions/cancel
 * payload: { reason? }
 * Router accepts Active OR Trial status.
 */
export const cancelSubscription = makeThunk(
  'subscriptions/cancelSubscription',
  async (payload = {}) => {
    const { data } = await API.put('/subscriptions/cancel', payload);
    return data; // { success, message, data: UserSubscription }
  },
  { successMsg: 'Subscription cancelled. You retain access until the current period ends.' }
);

/** PUT /subscriptions/toggle-auto-renew */
export const toggleAutoRenew = makeThunk(
  'subscriptions/toggleAutoRenew',
  async () => {
    const { data } = await API.put('/subscriptions/toggle-auto-renew');
    return data; // { success, autoRenew: boolean, message }
  },
  {
    condition: (_, { getState }) => !getState().subscriptions.toggleAutoRenewStatus.loading,
  }
);

/** POST /subscriptions/my/members — payload: { email, relation } */
export const addFamilyMember = makeThunk(
  'subscriptions/addFamilyMember',
  async (payload) => {
    const { data } = await API.post('/subscriptions/my/members', payload);
    return data; // { success, message, data: memberSlot[] }
  },
  { successMsg: 'Family member added successfully!' }
);

/** DELETE /subscriptions/my/members/:email */
export const removeFamilyMember = makeThunk(
  'subscriptions/removeFamilyMember',
  async (email) => {
    const { data } = await API.delete(`/subscriptions/my/members/${email}`);
    return data; // { success, message, data: memberSlot[] }
  },
  { successMsg: 'Family member removed.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 5  FREE TRIAL
//  Routes: POST /free-trial/start
//          GET  /free-trial/eligibility
//          GET  /free-trial/status
//          POST /free-trial/convert
//          POST /free-trial/verify-convert
//          POST /free-trial/expire-stale  (admin cron)
//          GET  /admin/trials             (admin)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /subscriptions/free-trial/start
 * payload: { planId, razorpay_payment_method_id? }
 * Always ₹0 — no Razorpay call on the server.
 */
export const startFreeTrial = makeThunk(
  'subscriptions/startFreeTrial',
  async (payload) => {
    const { data } = await API.post('/subscriptions/free-trial/start', payload);
    return data; // { success, message, trialExpiry, data: UserSubscription }
  },
  {
    successMsg: 'Your free trial has started! Enjoy full access.',
    condition:  (_, { getState }) => !getState().subscriptions.trialStartStatus.loading,
  }
);

/** GET /subscriptions/free-trial/eligibility */
export const fetchTrialEligibility = makeThunk(
  'subscriptions/fetchTrialEligibility',
  async () => {
    const { data } = await API.get('/subscriptions/free-trial/eligibility');
    return data; // { success, eligible, reason, eligiblePlans }
  },
  { silentError: true }
);

/** GET /subscriptions/free-trial/status */
export const fetchTrialStatus = makeThunk(
  'subscriptions/fetchTrialStatus',
  async () => {
    const { data } = await API.get('/subscriptions/free-trial/status');
    return data; // { success, activeTrial, daysLeft, trialExpiry, plan, data }
  },
  { silentError: true }
);

/**
 * POST /subscriptions/free-trial/convert
 * payload: { couponCode? }
 *
 * Router response shapes:
 *   ₹0 → { activated: true,  data: UserSubscription, message }
 *   paid → { activated: false, orderId, amount, discount, planName, trialSubId }
 */
export const initiateTrialConversion = makeThunk(
  'subscriptions/initiateTrialConversion',
  async (payload = {}) => {
    const { data } = await API.post('/subscriptions/free-trial/convert', payload);
    return data;
  },
  {
    condition: (_, { getState }) => !getState().subscriptions.trialConvertStatus.loading,
  }
);

/**
 * POST /subscriptions/free-trial/verify-convert
 * payload: { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount? }
 */
export const verifyTrialConversion = makeThunk(
  'subscriptions/verifyTrialConversion',
  async (payload) => {
    const { data } = await API.post('/subscriptions/free-trial/verify-convert', payload);
    return data; // { success, message, data: UserSubscription }
  },
  {
    successMsg: 'Trial converted — your subscription is now active! 🎉',
    condition:  (_, { getState }) => !getState().subscriptions.trialVerifyConvertStatus.loading,
  }
);

/** POST /subscriptions/free-trial/expire-stale (admin cron) */
export const adminExpireStaleTrials = makeThunk(
  'subscriptions/adminExpireStaleTrials',
  async () => {
    const { data } = await API.post('/subscriptions/free-trial/expire-stale');
    return data; // { success, expiredCount, details }
  },
  { successMsg: 'Stale trials expired and notifications sent.' }
);

/** GET /subscriptions/admin/trials — params: { page?, limit?, status?, userId? } */
export const adminFetchAllTrials = makeThunk(
  'subscriptions/adminFetchAllTrials',
  async (params = {}) => {
    const { data } = await API.get('/subscriptions/admin/trials', { params });
    return data; // { success, pagination, data: UserSubscription[] }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 6  CRON / SYSTEM JOBS
//  Routes: POST /send-expiry-alerts  |  POST /auto-renew-trigger
// ─────────────────────────────────────────────────────────────────────────────

/** POST /subscriptions/send-expiry-alerts */
export const sendExpiryAlerts = makeThunk(
  'subscriptions/sendExpiryAlerts',
  async () => {
    const { data } = await API.post('/subscriptions/send-expiry-alerts');
    return data; // { success, totalProcessed, totalEmailsSent, details }
  },
  { successMsg: 'Expiry alert emails dispatched.' }
);

/** POST /subscriptions/auto-renew-trigger */
export const triggerAutoRenew = makeThunk(
  'subscriptions/triggerAutoRenew',
  async () => {
    const { data } = await API.post('/subscriptions/auto-renew-trigger');
    return data; // { success, message, summary, details }
  },
  { successMsg: 'Auto-renewal process completed.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 7  ADMIN PLAN MANAGEMENT (legacy /subscriptions/admin/* router)
//  Routes: GET  /admin/all
//          GET  /admin/plans
//          POST /admin/plans
//          PUT  /admin/plans/:planId
//          DEL  /admin/plans/:planId
//          PUT  /admin/subscriptions/:subId
// ─────────────────────────────────────────────────────────────────────────────

/** GET /subscriptions/admin/all — params: { page?, limit?, status?, userId?, planType? } */
export const adminFetchAllSubscriptions = makeThunk(
  'subscriptions/adminFetchAllSubscriptions',
  async (params = {}) => {
    const { data } = await API.get('/subscriptions/admin/all', { params });
    return data; // { success, pagination, data: UserSubscription[] }
  }
);

/** GET /subscriptions/admin/plans — params: { planType?, isActive? } */
export const adminFetchAllPlans = makeThunk(
  'subscriptions/adminFetchAllPlans',
  async (params = {}) => {
    const { data } = await API.get('/subscriptions/admin/plans', { params });
    return data; // { success, count, data: Plan[] }
  }
);

/** POST /subscriptions/admin/plans — payload: full fixed plan body */
export const adminCreatePlan = makeThunk(
  'subscriptions/adminCreatePlan',
  async (payload) => {
    const { data } = await API.post('/subscriptions/admin/plans', payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Plan created.' }
);

/** PUT /subscriptions/admin/plans/:planId — payload: { planId, ...fields } */
export const adminUpdatePlan = makeThunk(
  'subscriptions/adminUpdatePlan',
  async ({ planId, ...payload }) => {
    const { data } = await API.put(`/subscriptions/admin/plans/${planId}`, payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Plan updated.' }
);

/** DELETE /subscriptions/admin/plans/:planId (superadmin only) */
export const adminDeactivatePlan = makeThunk(
  'subscriptions/adminDeactivatePlan',
  async (planId) => {
    const { data } = await API.delete(`/subscriptions/admin/plans/${planId}`);
    return { ...data, planId };
  },
  { successMsg: 'Plan deactivated.' }
);

/** PUT /subscriptions/admin/subscriptions/:subId — payload: { subId, status?, expiryDate?, autoRenew?, plan? } */
export const adminUpdateSubscription = makeThunk(
  'subscriptions/adminUpdateSubscription',
  async ({ subId, ...payload }) => {
    const { data } = await API.put(`/subscriptions/admin/subscriptions/${subId}`, payload);
    return data; // { success, data: UserSubscription }
  },
  { successMsg: 'Subscription updated.' }
);

// ─────────────────────────────────────────────────────────────────────────────
//  § 8  PLANS ROUTER — CATALOG ADMIN / SUBSCRIBERS / REVENUE (new)
//  Base: /plans  (the router rewritten against SubscriptionPlan +
//  UserSubscription + PlatformPricingConfig models). Distinct action names
//  to avoid collision with the legacy §7 /subscriptions/admin/* router.
// ─────────────────────────────────────────────────────────────────────────────

/** GET /plans/me/subscription — customer's current sub + server-computed benefitSnapshot */
export const fetchMySubscriptionSnapshot = makeThunk(
  'subscriptions/fetchMySubscriptionSnapshot',
  async () => {
    const { data } = await API.get('/plans/me/subscription');
    return data; // { success, data: { subscription, isCurrentlyActive, daysRemaining, benefitSnapshot } }
  },
  { silentError: true }
);

/** POST /plans — admin creates a FIXED catalog plan */
export const createFixedPlan = makeThunk(
  'subscriptions/createFixedPlan',
  async (payload) => {
    const { data } = await API.post('/plans', payload);
    return data; // { success, data: Plan }
  },
  { successMsg: 'Plan created.' }
);

/** DELETE /plans/:id — admin soft-deletes a plan */
export const deactivateFixedPlan = makeThunk(
  'subscriptions/deactivateFixedPlan',
  async (planId) => {
    const { data } = await API.delete(`/plans/${planId}`);
    return { ...data, planId };
  },
  { successMsg: 'Plan disabled.' }
);

/** GET /plans/admin/subscribers — params: { page?, limit?, status?, planType?, search? } */
export const fetchSubscribers = makeThunk(
  'subscriptions/fetchSubscribers',
  async (params = {}) => {
    const { data } = await API.get('/plans/admin/subscribers', { params });
    return data; // { success, pagination, data: subscriberRow[] }
  }
);

/** GET /plans/admin/active-subscriptions — params: { page?, limit? } */
export const fetchActiveSubscriptions = makeThunk(
  'subscriptions/fetchActiveSubscriptions',
  async (params = {}) => {
    const { data } = await API.get('/plans/admin/active-subscriptions', { params });
    return data; // { success, pagination, data: activeSubRow[] }
  }
);

/** GET /plans/admin/revenue/summary — params: { startDate?, endDate? } */
export const fetchRevenueSummary = makeThunk(
  'subscriptions/fetchRevenueSummary',
  async (params = {}) => {
    const { data } = await API.get('/plans/admin/revenue/summary', { params });
    return data; // { success, data: { period, mrr, activeSubscriptionsCount, revenueThisPeriod, transactionCount, newSubscriptionsInPeriod, statusBreakdown } }
  }
);

/** GET /plans/admin/revenue/by-plan — params: { startDate?, endDate? } */
export const fetchRevenueByPlan = makeThunk(
  'subscriptions/fetchRevenueByPlan',
  async (params = {}) => {
    const { data } = await API.get('/plans/admin/revenue/by-plan', { params });
    return data; // { success, period, count, data: byPlanRow[] }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
//  INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const asyncStatus = () => ({ loading: false, error: null });
const pagination  = () => ({ total: 0, page: 1, pages: 1 });

const initialState = {
  // ── § 1 Plan Catalogue ────────────────────────────────────────────────────
  plans:              [],
  selectedPlan:       null,
  plansStatus:        asyncStatus(),
  selectedPlanStatus: asyncStatus(),

  // ── § 2 Custom Plan Builder ───────────────────────────────────────────────
  /**
   * customPlanPricing shape (router: { data: { optionPricing, caps } }):
   * {
   *   optionPricing: { consultation, transport, diagnosticsDiscount,
   *                    pharmacyDiscount, careAssistant, addOns },
   *   caps: { pharmacyDiscountMax, diagnosticsDiscountMax,
   *           careAssistantMaxVisitsPerMonth, consultationsMaxPerMonth,
   *           transportMaxRidesPerMonth }
   * }
   * Customers use optionPricing to display prices — cannot set prices.
   */
  customPlanPricing:       null,
  customPlanPricingStatus: asyncStatus(),
  customPlanStatus:        asyncStatus(),

  // ── § 3 Purchase Flow ─────────────────────────────────────────────────────
  /**
   * pendingOrder: set for paid flows only (activated: false).
   * Shape: { orderId, amount, discount, planName, planType, planId }
   * For ₹0 (activated: true) → mySubscription set directly.
   */
  pendingOrder:   null,
  purchaseStatus: asyncStatus(),
  verifyStatus:   asyncStatus(),

  // ── § 4 Customer Subscription Management ─────────────────────────────────
  mySubscription:        null,
  mySubStatus:           asyncStatus(),
  myHistory:             [],
  myHistoryPagination:   pagination(),
  myHistoryStatus:       asyncStatus(),
  upgradeStatus:         asyncStatus(),
  cancelStatus:          asyncStatus(),
  toggleAutoRenewStatus: asyncStatus(),
  mySubIsShared:         false,
  mySubPrimaryHolder:    null,

  // ── § 5 Free Trial ────────────────────────────────────────────────────────
  /**
   * trialEligibility: { eligible, reason, eligiblePlans }
   * trialStatus:      { activeTrial, daysLeft, trialExpiry, plan, data }
   * trialOrder:       set for paid conversion only (activated: false).
   *                   Shape: { orderId, amount, discount, planName, trialSubId }
   */
  trialEligibility:        null,
  trialEligibilityStatus:  asyncStatus(),
  trialStatus:             null,
  trialStatusFetchStatus:  asyncStatus(),
  trialStartStatus:        asyncStatus(),   // separate from trialStatusFetchStatus
  trialOrder:              null,
  trialConvertStatus:      asyncStatus(),
  trialVerifyConvertStatus: asyncStatus(),
  adminTrials:             [],
  adminTrialsPagination:   pagination(),
  adminTrialsStatus:       asyncStatus(),
  adminExpireStaleStatus:  asyncStatus(),

  // ── § 6 Cron / System Jobs ────────────────────────────────────────────────
  expiryAlertResult: null,
  expiryAlertStatus: asyncStatus(),
  autoRenewResult:   null,
  autoRenewStatus:   asyncStatus(),

  // ── § 7 Admin Plan Management (legacy) ────────────────────────────────────
  adminSubscriptions:    [],
  adminSubPagination:    pagination(),
  adminSubStatus:        asyncStatus(),
  adminPlans:            [],
  adminPlansStatus:      asyncStatus(),
  adminPlanMutateStatus: asyncStatus(),
  adminSubUpdateStatus:  asyncStatus(),

  // ── § 8 Plans Router — Catalog Admin / Subscribers / Revenue ─────────────
  mySubSnapshot:            null, // { subscription, isCurrentlyActive, daysRemaining, benefitSnapshot }
  mySubSnapshotStatus:      asyncStatus(),
  catalogMutateStatus:      asyncStatus(),
  subscribers:               [],
  subscribersPagination:     pagination(),
  subscribersStatus:         asyncStatus(),
  activeSubscriptions:       [],
  activeSubscriptionsPagination: pagination(),
  activeSubscriptionsStatus: asyncStatus(),
  revenueSummary:            null,
  revenueSummaryStatus:      asyncStatus(),
  revenueByPlan:              [],
  revenueByPlanStatus:        asyncStatus(),
};

// ─────────────────────────────────────────────────────────────────────────────
//  SLICE
// ─────────────────────────────────────────────────────────────────────────────

const subscriptionPlanSlice = createSlice({
  name: 'subscriptions',
  initialState,

  reducers: {
    /** Wipe all subscription state on logout */
    clearSubscriptionState: () => initialState,

    /**
     * Clear Razorpay pending order (paid subscription flow).
     * Call after checkout modal closes or /verify completes.
     */
    clearPendingOrder: (state) => {
      state.pendingOrder   = null;
      state.purchaseStatus = asyncStatus();
      state.verifyStatus   = asyncStatus();
    },

    /**
     * Clear Razorpay trial-conversion order.
     * Call after trial checkout modal closes or /verify-convert completes.
     */
    clearTrialOrder: (state) => {
      state.trialOrder               = null;
      state.trialConvertStatus       = asyncStatus();
      state.trialVerifyConvertStatus = asyncStatus();
    },

    /** Clear a named status error key before re-submission */
    clearError: (state, action) => {
      const key = action.payload;
      if (state[key]) state[key].error = null;
    },

    /**
     * Optimistically flip autoRenew before the API round-trip.
     * toggleAutoRenew.rejected reverts on failure.
     */
    optimisticToggleAutoRenew: (state) => {
      if (state.mySubscription) {
        state.mySubscription.autoRenew = !state.mySubscription.autoRenew;
      }
    },

    /** Clear admin cron result panels */
    clearCronResults: (state) => {
      state.expiryAlertResult = null;
      state.autoRenewResult   = null;
    },

    /** Reset any async status block by key — useful on component unmount */
    resetStatus: (state, action) => {
      const key = action.payload;
      if (state[key] && 'loading' in state[key]) state[key] = asyncStatus();
    },
  },

  extraReducers: (builder) => {
    // Terse status setters
    const pending  = (key) => (state)         => { state[key].loading = true;  state[key].error = null; };
    const rejected = (key) => (state, action) => { state[key].loading = false; state[key].error = action.payload ?? null; };

    builder

    // ── § 1 Plan Catalogue ──────────────────────────────────────────────────
      .addCase(fetchAllPlans.pending,   pending('plansStatus'))
      .addCase(fetchAllPlans.rejected,  rejected('plansStatus'))
      .addCase(fetchAllPlans.fulfilled, (state, { payload }) => {
        state.plansStatus.loading = false;
        state.plans = payload.data ?? [];
      })

      .addCase(fetchPlanById.pending,   pending('selectedPlanStatus'))
      .addCase(fetchPlanById.rejected,  rejected('selectedPlanStatus'))
      .addCase(fetchPlanById.fulfilled, (state, { payload }) => {
        state.selectedPlanStatus.loading = false;
        state.selectedPlan = payload.data ?? null;
      })

    // ── § 2 Custom Plan Builder ─────────────────────────────────────────────
      .addCase(fetchCustomPlanPricing.pending,   pending('customPlanPricingStatus'))
      .addCase(fetchCustomPlanPricing.rejected,  rejected('customPlanPricingStatus'))
      .addCase(fetchCustomPlanPricing.fulfilled, (state, { payload }) => {
        state.customPlanPricingStatus.loading = false;
        /**
         * Router sends: { success, data: { optionPricing, caps } }
         * Store the whole data blob — selectors expose sub-keys.
         * Field is `optionPricing`, NOT the old `unitPrices`.
         */
        state.customPlanPricing = payload.data ?? null;
      })

      .addCase(createCustomPlan.pending,   pending('customPlanStatus'))
      .addCase(createCustomPlan.rejected,  rejected('customPlanStatus'))
      .addCase(createCustomPlan.fulfilled, (state, { payload }) => {
        state.customPlanStatus.loading = false;
        const created = payload.data;
        if (created) {
          // Server deactivated previous custom plans — replace all custom entries
          state.plans = [
            ...state.plans.filter((p) => p.planType !== 'custom'),
            created,
          ];
        }
      })

      .addCase(updateCustomPlan.pending,   pending('customPlanStatus'))
      .addCase(updateCustomPlan.rejected,  rejected('customPlanStatus'))
      .addCase(updateCustomPlan.fulfilled, (state, { payload }) => {
        state.customPlanStatus.loading = false;
        const updated = payload.data;
        if (updated) {
          state.plans = state.plans.map((p) => (p._id === updated._id ? updated : p));
          if (state.selectedPlan?._id === updated._id) state.selectedPlan = updated;
        }
      })

      .addCase(deleteCustomPlan.pending,   pending('customPlanStatus'))
      .addCase(deleteCustomPlan.rejected,  rejected('customPlanStatus'))
      .addCase(deleteCustomPlan.fulfilled, (state, { payload }) => {
        state.customPlanStatus.loading = false;
        state.plans = state.plans.filter((p) => p._id !== payload.planId);
        if (state.selectedPlan?._id === payload.planId) state.selectedPlan = null;
      })

    // ── § 3 Purchase Flow ───────────────────────────────────────────────────
      .addCase(initiateSubscriptionPurchase.pending,   pending('purchaseStatus'))
      .addCase(initiateSubscriptionPurchase.rejected,  rejected('purchaseStatus'))
      /**
       * PATH B (₹0, activated=true):
       *   Subscription already created server-side.
       *   Set mySubscription; toast immediately.
       *
       * PATH A (paid, activated=false):
       *   Store orderId for Razorpay checkout.
       *   Toast fires later in verifySubscriptionPayment.
       */
      .addCase(initiateSubscriptionPurchase.fulfilled, (state, { payload }) => {
        state.purchaseStatus.loading = false;
        if (payload.activated) {
          state.mySubscription = payload.data ?? null;
          state.pendingOrder   = null;
          toast.success(payload.message || 'Subscription activated for free! 🎉');
        } else {
          const { orderId, amount, discount, planName, planType, planId } = payload;
          state.pendingOrder = { orderId, amount, discount, planName, planType, planId };
        }
      })

      .addCase(verifySubscriptionPayment.pending,   pending('verifyStatus'))
      .addCase(verifySubscriptionPayment.rejected,  rejected('verifyStatus'))
      .addCase(verifySubscriptionPayment.fulfilled, (state, { payload }) => {
        state.verifyStatus.loading = false;
        state.pendingOrder         = null; // consumed
        state.mySubscription       = payload.data ?? null;
      })

    // ── § 4 Customer Subscription Management ───────────────────────────────
      .addCase(fetchMySubscription.pending,  pending('mySubStatus'))
      .addCase(fetchMySubscription.rejected, (state, { payload }) => {
        state.mySubStatus.loading = false;
        if (typeof payload === 'string' && payload.includes('No subscription')) {
          state.mySubscription    = null;
          state.mySubStatus.error = null; // expected 404 — not a UI error
        } else {
          state.mySubStatus.error = payload ?? null;
        }
      })
      .addCase(fetchMySubscription.fulfilled, (state, { payload }) => {
        state.mySubStatus.loading = false;
        state.mySubscription      = payload.data ?? null;
        state.mySubIsShared       = payload.isShared ?? false;
        state.mySubPrimaryHolder  = payload.primaryAccountHolder ?? null;
      })

      .addCase(fetchMySubscriptionHistory.pending,   pending('myHistoryStatus'))
      .addCase(fetchMySubscriptionHistory.rejected,  rejected('myHistoryStatus'))
      .addCase(fetchMySubscriptionHistory.fulfilled, (state, { payload }) => {
        state.myHistoryStatus.loading = false;
        state.myHistory           = payload.data        ?? [];
        state.myHistoryPagination = payload.pagination  ?? pagination();
      })

      .addCase(upgradeSubscription.pending,   pending('upgradeStatus'))
      .addCase(upgradeSubscription.rejected,  rejected('upgradeStatus'))
      .addCase(upgradeSubscription.fulfilled, (state, { payload }) => {
        state.upgradeStatus.loading = false;
        state.mySubscription = payload.data ?? state.mySubscription;
        // Sub is now Active — clear stale trial state
        if (state.trialStatus) state.trialStatus = { activeTrial: false };
      })

      .addCase(cancelSubscription.pending,   pending('cancelStatus'))
      .addCase(cancelSubscription.rejected,  rejected('cancelStatus'))
      .addCase(cancelSubscription.fulfilled, (state, { payload }) => {
        state.cancelStatus.loading = false;
        state.mySubscription = payload.data ?? state.mySubscription;
        if (state.trialStatus?.activeTrial) state.trialStatus = { activeTrial: false };
      })

      .addCase(toggleAutoRenew.pending,  pending('toggleAutoRenewStatus'))
      .addCase(toggleAutoRenew.rejected, (state, { payload }) => {
        state.toggleAutoRenewStatus.loading = false;
        state.toggleAutoRenewStatus.error   = payload ?? null;
        // Revert optimistic update on failure
        if (state.mySubscription) {
          state.mySubscription.autoRenew = !state.mySubscription.autoRenew;
        }
      })
      .addCase(toggleAutoRenew.fulfilled, (state, { payload }) => {
        state.toggleAutoRenewStatus.loading = false;
        state.toggleAutoRenewStatus.error   = null;
        if (state.mySubscription) {
          state.mySubscription.autoRenew = payload.autoRenew; // server is truth
        }
        toast.success(payload.message ?? 'Auto-renew preference saved.');
      })

      .addCase(addFamilyMember.pending,   pending('mySubStatus')) // reuse mySubStatus for consistency
      .addCase(addFamilyMember.rejected,  rejected('mySubStatus'))
      .addCase(addFamilyMember.fulfilled, (state, { payload }) => {
        state.mySubStatus.loading = false;
        if (state.mySubscription) {
          state.mySubscription.members = payload.data;
        }
      })

      .addCase(removeFamilyMember.pending,   pending('mySubStatus'))
      .addCase(removeFamilyMember.rejected,  rejected('mySubStatus'))
      .addCase(removeFamilyMember.fulfilled, (state, { payload }) => {
        state.mySubStatus.loading = false;
        if (state.mySubscription) {
          state.mySubscription.members = payload.data;
        }
      })

    // ── § 5 Free Trial ──────────────────────────────────────────────────────
      .addCase(startFreeTrial.pending,   pending('trialStartStatus'))
      .addCase(startFreeTrial.rejected,  rejected('trialStartStatus'))
      .addCase(startFreeTrial.fulfilled, (state, { payload }) => {
        state.trialStartStatus.loading = false;
        const sub = payload.data;
        if (sub) {
          state.mySubscription = sub;
          state.trialStatus = {
            activeTrial: true,
            trialExpiry: payload.trialExpiry ?? null,
            daysLeft:    payload.daysLeft    ?? null,
            plan:        sub.plan            ?? null,
            data:        sub,
          };
          // Mark ineligible immediately — no extra round-trip needed
          if (state.trialEligibility) {
            state.trialEligibility.eligible = false;
            state.trialEligibility.reason   = 'Free trial already used.';
          }
        }
      })

      .addCase(fetchTrialEligibility.pending,   pending('trialEligibilityStatus'))
      .addCase(fetchTrialEligibility.rejected,  rejected('trialEligibilityStatus'))
      .addCase(fetchTrialEligibility.fulfilled, (state, { payload }) => {
        state.trialEligibilityStatus.loading = false;
        state.trialEligibility = {
          eligible:      payload.eligible,
          reason:        payload.reason        ?? null,
          eligiblePlans: payload.eligiblePlans ?? [],
        };
      })

      .addCase(fetchTrialStatus.pending,  pending('trialStatusFetchStatus'))
      .addCase(fetchTrialStatus.rejected, (state, { payload }) => {
        state.trialStatusFetchStatus.loading = false;
        if (typeof payload === 'string' && payload.includes('No active trial')) {
          state.trialStatus = { activeTrial: false };
          state.trialStatusFetchStatus.error = null; // expected 404
        } else {
          state.trialStatusFetchStatus.error = payload ?? null;
        }
      })
      .addCase(fetchTrialStatus.fulfilled, (state, { payload }) => {
        state.trialStatusFetchStatus.loading = false;
        state.trialStatus = {
          activeTrial: payload.activeTrial ?? false,
          daysLeft:    payload.daysLeft    ?? 0,
          trialExpiry: payload.trialExpiry ?? null,
          plan:        payload.plan        ?? null,
          data:        payload.data        ?? null,
        };
      })

      .addCase(initiateTrialConversion.pending,   pending('trialConvertStatus'))
      .addCase(initiateTrialConversion.rejected,  rejected('trialConvertStatus'))
      /**
       * PATH B (₹0, activated=true):
       *   Already converted server-side.
       *   Set mySubscription; clear trialStatus; toast immediately.
       *
       * PATH A (paid, activated=false):
       *   Store trialOrder for Razorpay checkout.
       *   Toast fires in verifyTrialConversion.
       */
      .addCase(initiateTrialConversion.fulfilled, (state, { payload }) => {
        state.trialConvertStatus.loading = false;
        if (payload.activated) {
          state.mySubscription = payload.data ?? null;
          state.trialOrder     = null;
          state.trialStatus    = { activeTrial: false };
          toast.success(payload.message || 'Trial converted — subscription is now active! 🎉');
        } else {
          const { orderId, amount, discount, planName, trialSubId } = payload;
          state.trialOrder = { orderId, amount, discount, planName, trialSubId };
        }
      })

      .addCase(verifyTrialConversion.pending,   pending('trialVerifyConvertStatus'))
      .addCase(verifyTrialConversion.rejected,  rejected('trialVerifyConvertStatus'))
      .addCase(verifyTrialConversion.fulfilled, (state, { payload }) => {
        state.trialVerifyConvertStatus.loading = false;
        state.trialOrder = null; // consumed
        const converted  = payload.data;
        if (converted) {
          state.mySubscription = converted;
          state.trialStatus    = { activeTrial: false };
        }
      })

      .addCase(adminExpireStaleTrials.pending,   pending('adminExpireStaleStatus'))
      .addCase(adminExpireStaleTrials.rejected,  rejected('adminExpireStaleStatus'))
      .addCase(adminExpireStaleTrials.fulfilled, (state) => {
        state.adminExpireStaleStatus.loading = false;
        if (state.adminTrials.length > 0) {
          const now = new Date();
          state.adminTrials = state.adminTrials.map((t) =>
            t.status === 'Trial' && new Date(t.expiryDate) < now
              ? { ...t, status: 'Expired' }
              : t
          );
        }
      })

      .addCase(adminFetchAllTrials.pending,   pending('adminTrialsStatus'))
      .addCase(adminFetchAllTrials.rejected,  rejected('adminTrialsStatus'))
      .addCase(adminFetchAllTrials.fulfilled, (state, { payload }) => {
        state.adminTrialsStatus.loading = false;
        state.adminTrials           = payload.data        ?? [];
        state.adminTrialsPagination = payload.pagination  ?? pagination();
      })

    // ── § 6 Cron / System Jobs ──────────────────────────────────────────────
      .addCase(sendExpiryAlerts.pending,   pending('expiryAlertStatus'))
      .addCase(sendExpiryAlerts.rejected,  rejected('expiryAlertStatus'))
      .addCase(sendExpiryAlerts.fulfilled, (state, { payload }) => {
        state.expiryAlertStatus.loading = false;
        state.expiryAlertResult = {
          totalProcessed:  payload.totalProcessed,
          totalEmailsSent: payload.totalEmailsSent,
          details:         payload.details,
        };
      })

      .addCase(triggerAutoRenew.pending,   pending('autoRenewStatus'))
      .addCase(triggerAutoRenew.rejected,  rejected('autoRenewStatus'))
      .addCase(triggerAutoRenew.fulfilled, (state, { payload }) => {
        state.autoRenewStatus.loading = false;
        state.autoRenewResult = {
          summary: payload.summary,
          details: payload.details,
        };
      })

    // ── § 7 Admin Plan Management (legacy) ──────────────────────────────────
      .addCase(adminFetchAllSubscriptions.pending,   pending('adminSubStatus'))
      .addCase(adminFetchAllSubscriptions.rejected,  rejected('adminSubStatus'))
      .addCase(adminFetchAllSubscriptions.fulfilled, (state, { payload }) => {
        state.adminSubStatus.loading = false;
        state.adminSubscriptions = payload.data        ?? [];
        state.adminSubPagination = payload.pagination  ?? pagination();
      })

      .addCase(adminFetchAllPlans.pending,   pending('adminPlansStatus'))
      .addCase(adminFetchAllPlans.rejected,  rejected('adminPlansStatus'))
      .addCase(adminFetchAllPlans.fulfilled, (state, { payload }) => {
        state.adminPlansStatus.loading = false;
        state.adminPlans = payload.data ?? [];
      })

      .addCase(adminCreatePlan.pending,   pending('adminPlanMutateStatus'))
      .addCase(adminCreatePlan.rejected,  rejected('adminPlanMutateStatus'))
      .addCase(adminCreatePlan.fulfilled, (state, { payload }) => {
        state.adminPlanMutateStatus.loading = false;
        const created = payload.data;
        if (created) {
          state.adminPlans = [created, ...state.adminPlans];
          if (state.plans.length > 0) state.plans = [created, ...state.plans];
        }
      })

      .addCase(adminUpdatePlan.pending,   pending('adminPlanMutateStatus'))
      .addCase(adminUpdatePlan.rejected,  rejected('adminPlanMutateStatus'))
      .addCase(adminUpdatePlan.fulfilled, (state, { payload }) => {
        state.adminPlanMutateStatus.loading = false;
        const updated = payload.data;
        if (updated) {
          state.adminPlans = state.adminPlans.map((p) => (p._id === updated._id ? updated : p));
          state.plans      = state.plans.map((p)      => (p._id === updated._id ? updated : p));
          if (state.selectedPlan?._id === updated._id) state.selectedPlan = updated;
        }
      })

      .addCase(adminDeactivatePlan.pending,   pending('adminPlanMutateStatus'))
      .addCase(adminDeactivatePlan.rejected,  rejected('adminPlanMutateStatus'))
      .addCase(adminDeactivatePlan.fulfilled, (state, { payload }) => {
        state.adminPlanMutateStatus.loading = false;
        // Mark inactive in admin list — preserves table row context
        state.adminPlans = state.adminPlans.map((p) =>
          p._id === payload.planId ? { ...p, isActive: false } : p
        );
        // Remove from customer-facing list
        state.plans = state.plans.filter((p) => p._id !== payload.planId);
      })

      .addCase(adminUpdateSubscription.pending,   pending('adminSubUpdateStatus'))
      .addCase(adminUpdateSubscription.rejected,  rejected('adminSubUpdateStatus'))
      .addCase(adminUpdateSubscription.fulfilled, (state, { payload }) => {
        state.adminSubUpdateStatus.loading = false;
        const updated = payload.data;
        if (updated) {
          state.adminSubscriptions = state.adminSubscriptions.map((s) =>
            s._id === updated._id ? updated : s
          );
          // Keep customer view in sync for same document
          if (state.mySubscription?._id === updated._id) state.mySubscription = updated;
        }
      })

    // ── § 8 Plans Router — Catalog Admin / Subscribers / Revenue ────────────
      .addCase(fetchMySubscriptionSnapshot.pending,   pending('mySubSnapshotStatus'))
      .addCase(fetchMySubscriptionSnapshot.rejected,  (state, { payload }) => {
        state.mySubSnapshotStatus.loading = false;
        if (typeof payload === 'string' && payload.includes('No active subscription')) {
          state.mySubSnapshot = null;
          state.mySubSnapshotStatus.error = null; // expected 404
        } else {
          state.mySubSnapshotStatus.error = payload ?? null;
        }
      })
      .addCase(fetchMySubscriptionSnapshot.fulfilled, (state, { payload }) => {
        state.mySubSnapshotStatus.loading = false;
        state.mySubSnapshot = payload.data ?? null; // { subscription, isCurrentlyActive, daysRemaining, benefitSnapshot }
      })

      .addCase(createFixedPlan.pending,   pending('catalogMutateStatus'))
      .addCase(createFixedPlan.rejected,  rejected('catalogMutateStatus'))
      .addCase(createFixedPlan.fulfilled, (state, { payload }) => {
        state.catalogMutateStatus.loading = false;
        const created = payload.data;
        if (created) {
          state.plans = [created, ...state.plans];
        }
      })

      .addCase(deactivateFixedPlan.pending,   pending('catalogMutateStatus'))
      .addCase(deactivateFixedPlan.rejected,  rejected('catalogMutateStatus'))
      .addCase(deactivateFixedPlan.fulfilled, (state, { payload }) => {
        state.catalogMutateStatus.loading = false;
        state.plans = state.plans.filter((p) => p._id !== payload.planId);
        if (state.selectedPlan?._id === payload.planId) state.selectedPlan = null;
      })

      .addCase(fetchSubscribers.pending,   pending('subscribersStatus'))
      .addCase(fetchSubscribers.rejected,  rejected('subscribersStatus'))
      .addCase(fetchSubscribers.fulfilled, (state, { payload }) => {
        state.subscribersStatus.loading = false;
        state.subscribers           = payload.data       ?? [];
        state.subscribersPagination = payload.pagination ?? pagination();
      })

      .addCase(fetchActiveSubscriptions.pending,   pending('activeSubscriptionsStatus'))
      .addCase(fetchActiveSubscriptions.rejected,  rejected('activeSubscriptionsStatus'))
      .addCase(fetchActiveSubscriptions.fulfilled, (state, { payload }) => {
        state.activeSubscriptionsStatus.loading = false;
        state.activeSubscriptions           = payload.data       ?? [];
        state.activeSubscriptionsPagination = payload.pagination ?? pagination();
      })

      .addCase(fetchRevenueSummary.pending,   pending('revenueSummaryStatus'))
      .addCase(fetchRevenueSummary.rejected,  rejected('revenueSummaryStatus'))
      .addCase(fetchRevenueSummary.fulfilled, (state, { payload }) => {
        state.revenueSummaryStatus.loading = false;
        state.revenueSummary = payload.data ?? null;
      })

      .addCase(fetchRevenueByPlan.pending,   pending('revenueByPlanStatus'))
      .addCase(fetchRevenueByPlan.rejected,  rejected('revenueByPlanStatus'))
      .addCase(fetchRevenueByPlan.fulfilled, (state, { payload }) => {
        state.revenueByPlanStatus.loading = false;
        state.revenueByPlan = payload.data ?? [];
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearSubscriptionState,
  clearPendingOrder,
  clearTrialOrder,
  clearError,
  optimisticToggleAutoRenew,
  clearCronResults,
  resetStatus,
} = subscriptionPlanSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
//  SELECTORS
//  Pure functions. Derived values computed here — never stored in state.
//  Memo-safe: return primitives or stable references only.
// ─────────────────────────────────────────────────────────────────────────────

const sel = (state) => state.subscriptionPlan;

// § 1 Plans
export const selectAllPlans      = (state) => sel(state).plans;
export const selectFixedPlans    = (state) => sel(state).plans.filter((p) => p.planType === 'fixed');
export const selectMyCustomPlans = (state) => sel(state).plans.filter((p) => p.planType === 'custom');
export const selectSelectedPlan  = (state) => sel(state).selectedPlan;
export const selectPlansLoading  = (state) => sel(state).plansStatus.loading;
export const selectPlansError    = (state) => sel(state).plansStatus.error;

// § 2 Custom Plan Builder
/** Full pricing blob: { optionPricing, caps } */
export const selectCustomPlanPricing        = (state) => sel(state).customPlanPricing;
/** Admin-set option pricing (consultation, transport, diagnostics slabs, etc.) */
export const selectCustomOptionPricing      = (state) => sel(state).customPlanPricing?.optionPricing ?? null;
/** Admin-set discount/volume caps */
export const selectCustomPlanCaps           = (state) => sel(state).customPlanPricing?.caps ?? null;
export const selectCustomPlanPricingLoading = (state) => sel(state).customPlanPricingStatus.loading;
export const selectCustomPlanLoading        = (state) => sel(state).customPlanStatus.loading;
export const selectCustomPlanError          = (state) => sel(state).customPlanStatus.error;

// § 3 Purchase
export const selectPendingOrder    = (state) => sel(state).pendingOrder;
export const selectPurchaseLoading = (state) => sel(state).purchaseStatus.loading;
export const selectPurchaseError   = (state) => sel(state).purchaseStatus.error;
export const selectVerifyLoading   = (state) => sel(state).verifyStatus.loading;
export const selectVerifyError     = (state) => sel(state).verifyStatus.error;

// § 4 Customer Subscription
export const selectMySubscription         = (state) => sel(state).mySubscription;
export const selectMySubIsActive          = (state) => sel(state).mySubscription?.status === 'Active';
export const selectMySubIsOnTrial         = (state) => sel(state).mySubscription?.status === 'Trial';
/** True when user has any live access (Active OR Trial) */
export const selectMySubHasAccess         = (state) =>
  ['Active', 'Trial'].includes(sel(state).mySubscription?.status);
export const selectMySubAutoRenew         = (state) => sel(state).mySubscription?.autoRenew ?? false;
export const selectMySubStatus            = (state) => sel(state).mySubscription?.status ?? null;
export const selectMySubExpiryDate        = (state) => sel(state).mySubscription?.expiryDate ?? null;
export const selectMySubPlanName          = (state) => sel(state).mySubscription?.planName ?? null;
export const selectMySubLoading           = (state) => sel(state).mySubStatus.loading;
export const selectMySubError             = (state) => sel(state).mySubStatus.error;
export const selectMyHistory              = (state) => sel(state).myHistory;
export const selectMyHistoryPagination    = (state) => sel(state).myHistoryPagination;
export const selectMyHistoryLoading       = (state) => sel(state).myHistoryStatus.loading;
export const selectUpgradeLoading         = (state) => sel(state).upgradeStatus.loading;
export const selectUpgradeError           = (state) => sel(state).upgradeStatus.error;
export const selectCancelLoading          = (state) => sel(state).cancelStatus.loading;
export const selectCancelError            = (state) => sel(state).cancelStatus.error;
export const selectToggleAutoRenewLoading = (state) => sel(state).toggleAutoRenewStatus.loading;
export const selectToggleAutoRenewError   = (state) => sel(state).toggleAutoRenewStatus.error;
export const selectMySubIsShared          = (state) => sel(state).mySubIsShared;
export const selectMySubPrimaryHolder     = (state) => sel(state).mySubPrimaryHolder;
export const selectMySubMembers           = (state) => sel(state).mySubscription?.members ?? [];

// § 5 Free Trial
export const selectTrialEligibility          = (state) => sel(state).trialEligibility;
export const selectIsTrialEligible           = (state) => sel(state).trialEligibility?.eligible ?? null;
export const selectTrialEligiblePlans        = (state) => sel(state).trialEligibility?.eligiblePlans ?? [];
export const selectTrialEligibilityLoading   = (state) => sel(state).trialEligibilityStatus.loading;
export const selectTrialStatus               = (state) => sel(state).trialStatus;
export const selectIsOnActiveTrial           = (state) => sel(state).trialStatus?.activeTrial ?? false;
export const selectTrialDaysLeft             = (state) => sel(state).trialStatus?.daysLeft ?? 0;
export const selectTrialExpiry               = (state) => sel(state).trialStatus?.trialExpiry ?? null;
export const selectTrialStatusLoading        = (state) => sel(state).trialStatusFetchStatus.loading;
export const selectTrialStartLoading         = (state) => sel(state).trialStartStatus.loading;
export const selectTrialStartError           = (state) => sel(state).trialStartStatus.error;
export const selectTrialOrder                = (state) => sel(state).trialOrder;
export const selectTrialConvertLoading       = (state) => sel(state).trialConvertStatus.loading;
export const selectTrialConvertError         = (state) => sel(state).trialConvertStatus.error;
export const selectTrialVerifyConvertLoading = (state) => sel(state).trialVerifyConvertStatus.loading;
export const selectTrialVerifyConvertError   = (state) => sel(state).trialVerifyConvertStatus.error;
export const selectAdminTrials               = (state) => sel(state).adminTrials;
export const selectAdminTrialsPagination     = (state) => sel(state).adminTrialsPagination;
export const selectAdminTrialsLoading        = (state) => sel(state).adminTrialsStatus.loading;
export const selectAdminExpireStaleLoading   = (state) => sel(state).adminExpireStaleStatus.loading;
export const selectAdminExpireStaleError     = (state) => sel(state).adminExpireStaleStatus.error;

// § 6 Cron
export const selectExpiryAlertResult  = (state) => sel(state).expiryAlertResult;
export const selectExpiryAlertLoading = (state) => sel(state).expiryAlertStatus.loading;
export const selectExpiryAlertError   = (state) => sel(state).expiryAlertStatus.error;
export const selectAutoRenewResult    = (state) => sel(state).autoRenewResult;
export const selectAutoRenewLoading   = (state) => sel(state).autoRenewStatus.loading;
export const selectAutoRenewError     = (state) => sel(state).autoRenewStatus.error;

// § 7 Admin (legacy)
export const selectAdminSubscriptions     = (state) => sel(state).adminSubscriptions;
export const selectAdminSubPagination     = (state) => sel(state).adminSubPagination;
export const selectAdminSubLoading        = (state) => sel(state).adminSubStatus.loading;
export const selectAdminSubError          = (state) => sel(state).adminSubStatus.error;
export const selectAdminPlans             = (state) => sel(state).adminPlans;
export const selectAdminPlansLoading      = (state) => sel(state).adminPlansStatus.loading;
export const selectAdminPlanMutateLoading = (state) => sel(state).adminPlanMutateStatus.loading;
export const selectAdminPlanMutateError   = (state) => sel(state).adminPlanMutateStatus.error;
export const selectAdminSubUpdateLoading  = (state) => sel(state).adminSubUpdateStatus.loading;
export const selectAdminSubUpdateError    = (state) => sel(state).adminSubUpdateStatus.error;

// § 8 Plans Router — Catalog Admin / Subscribers / Revenue
export const selectMySubSnapshot           = (state) => sel(state).mySubSnapshot;
export const selectMySubSnapshotLoading    = (state) => sel(state).mySubSnapshotStatus.loading;
/** Server-computed virtuals from UserSubscription model — use these over ad-hoc client math */
export const selectMySubDaysRemaining      = (state) => sel(state).mySubSnapshot?.daysRemaining ?? 0;
export const selectMySubIsCurrentlyActive  = (state) => sel(state).mySubSnapshot?.isCurrentlyActive ?? false;
export const selectMySubBenefitSnapshot    = (state) => sel(state).mySubSnapshot?.benefitSnapshot ?? null;
export const selectMySubConsultations      = (state) => sel(state).mySubSnapshot?.benefitSnapshot?.consultations ?? null;
export const selectMySubCareAssistant      = (state) => sel(state).mySubSnapshot?.benefitSnapshot?.careAssistant ?? null;
export const selectMySubTransportRides     = (state) => sel(state).mySubSnapshot?.benefitSnapshot?.transportRides ?? null;
export const selectMySubLabTests           = (state) => sel(state).mySubSnapshot?.benefitSnapshot?.labTests ?? null;
export const selectMySubPharmacy           = (state) => sel(state).mySubSnapshot?.benefitSnapshot?.pharmacy ?? null;
export const selectMySubDiagnostics        = (state) => sel(state).mySubSnapshot?.benefitSnapshot?.diagnostics ?? null;

export const selectCatalogMutateLoading    = (state) => sel(state).catalogMutateStatus.loading;
export const selectCatalogMutateError      = (state) => sel(state).catalogMutateStatus.error;

export const selectSubscribers             = (state) => sel(state).subscribers;
export const selectSubscribersPagination   = (state) => sel(state).subscribersPagination;
export const selectSubscribersLoading      = (state) => sel(state).subscribersStatus.loading;
export const selectSubscribersError        = (state) => sel(state).subscribersStatus.error;

export const selectActiveSubscriptions           = (state) => sel(state).activeSubscriptions;
export const selectActiveSubscriptionsPagination = (state) => sel(state).activeSubscriptionsPagination;
export const selectActiveSubscriptionsLoading    = (state) => sel(state).activeSubscriptionsStatus.loading;
export const selectActiveSubscriptionsError      = (state) => sel(state).activeSubscriptionsStatus.error;

export const selectRevenueSummary          = (state) => sel(state).revenueSummary;
export const selectRevenueMRR              = (state) => sel(state).revenueSummary?.mrr ?? 0;
export const selectRevenueThisPeriod       = (state) => sel(state).revenueSummary?.revenueThisPeriod ?? 0;
export const selectRevenueSummaryLoading   = (state) => sel(state).revenueSummaryStatus.loading;
export const selectRevenueSummaryError     = (state) => sel(state).revenueSummaryStatus.error;

export const selectRevenueByPlan           = (state) => sel(state).revenueByPlan;
export const selectRevenueByPlanLoading    = (state) => sel(state).revenueByPlanStatus.loading;
export const selectRevenueByPlanError      = (state) => sel(state).revenueByPlanStatus.error;

// ─────────────────────────────────────────────────────────────────────────────
//  DEFAULT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default subscriptionPlanSlice.reducer;