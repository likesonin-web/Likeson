import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────────────────────────────────────

// POST /ride-requests/quote — works for BOTH customer and care_assistant roles.
// bookingId is mandatory. Returns fare (subscription-aware) + payment info,
// does NOT create a Ride yet.
export const quoteRide = createAsyncThunk(
  'rideRequest/quoteRide',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/ride-requests/quote', payload);
      return data.data; // { intentId, distKm, ratePerKm, rateSource, transportFee, requiresPayment, razorpay, walletAvailable, walletSufficient, expiresAt }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// POST /ride-requests/confirm — pays (razorpay/wallet/free) THEN creates the Ride.
export const confirmRide = createAsyncThunk(
  'rideRequest/confirmRide',
  async (payload, { rejectWithValue }) => {
    // payload: { intentId, paymentMethod?, razorpay_order_id?, razorpay_payment_id?, razorpay_signature? }
    try {
      const { data } = await API.post('/ride-requests/confirm', payload);
      return data.data; // { rideId, bookingId, transportFee, status }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// GET /ride-requests/:rideId
export const fetchRide = createAsyncThunk(
  'rideRequest/fetchRide',
  async (rideId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/${rideId}`);
      return data.data.ride;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// GET /ride-requests/admin/all
export const fetchAdminAllRides = createAsyncThunk(
  'rideRequest/fetchAdminAllRides',
  async ({ status = 'searching', page = 1, limit = 20 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/ride-requests/admin/all', {
        params: { status, page, limit },
      });
      return data.data; // { rides, total, page, pages }
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// GET /ride-requests/admin/:rideId/nearby
export const fetchNearbyDrivers = createAsyncThunk(
  'rideRequest/fetchNearbyDrivers',
  async (rideId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/admin/${rideId}/nearby`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// POST /ride-requests/admin/:rideId/assign
export const adminAssignRide = createAsyncThunk(
  'rideRequest/adminAssignRide',
  async ({ rideId, assignType, assignId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/ride-requests/admin/${rideId}/assign`, {
        assignType,
        assignId,
      });
      return { rideId, ...data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// PATCH /ride-requests/tp/:rideId/assign-driver
export const tpAssignDriver = createAsyncThunk(
  'rideRequest/tpAssignDriver',
  async ({ rideId, driverId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/ride-requests/tp/${rideId}/assign-driver`, {
        driverId,
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// PATCH /ride-requests/:rideId/status
export const updateRideStatus = createAsyncThunk(
  'rideRequest/updateRideStatus',
  async ({ rideId, action, otp, stopIndex, cancelReason, eta, waypointType } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/ride-requests/${rideId}/status`, {
        action,
        ...(otp          !== undefined && { otp }),
        ...(stopIndex    !== undefined && { stopIndex }),
        ...(cancelReason !== undefined && { cancelReason }),
        ...(eta          !== undefined && { eta }),
        ...(waypointType !== undefined && { waypointType }),
      });
      return { rideId, ...data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// GET /ride-requests/:rideId/live
export const fetchRideLive = createAsyncThunk(
  'rideRequest/fetchRideLive',
  async (rideId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/${rideId}/live`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// GET /ride-requests/:rideId/tracking
export const fetchRideTracking = createAsyncThunk(
  'rideRequest/fetchRideTracking',
  async ({ rideId, breadcrumbs = 100 } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/${rideId}/tracking`, {
        params: { breadcrumbs },
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// POST /ride-requests/:rideId/tracking/milestone
export const postMilestone = createAsyncThunk(
  'rideRequest/postMilestone',
  async ({ rideId, name, coordinates = null, stopSequence = null, meta = null } = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/ride-requests/${rideId}/tracking/milestone`, {
        name, coordinates, stopSequence, meta,
      });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// GET /ride-requests/:rideId/care-assistant-live
export const fetchCareAssistantLive = createAsyncThunk(
  'rideRequest/fetchCareAssistantLive',
  async (rideId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/ride-requests/${rideId}/care-assistant-live`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // Quote (pre-payment) — from /ride-requests/quote
  quote: null,

  // Single ride being viewed/tracked
  currentRide: null,
  liveData: null,
  trackingData: null,
  caLiveData: null,

  // Admin: list of rides
  adminRides: [],
  adminTotal: 0,
  adminPage:  1,
  adminPages: 1,

  // Admin: nearby search result for a ride
  nearbyResult: null,

  // Ride just created after successful payment
  createdRide: null,

  socketLive: {
    status:                 null,
    rideStage:              null,
    liveLocation:           null,
    etaMinutes:             null,
    etaTarget:              null,
    navigationTarget:       null,
    activeNavigationTarget: null,
    activeTarget:           null,
    driverSnapshot:         null,
    vehicleSnapshot:        null,
    otpResult:              null,
    wrongOtpAttempts:       0,
    hospitalEta: {
      hospitalId:   null,
      hospitalName: null,
      etaMinutes:   null,
      distanceKm:   null,
      coordinates:  null,
    },
    careAssistantTracking: {
      bookingId:      null,
      rideId:         null,
      driverLocation: null,
      activeTarget:   null,
      etaMinutes:     null,
      distanceKm:     null,
    },
  },

  caAtJoinPoint: false,
  caHasJoined:   false,
  caViewMode:    null,
  jpCompleted:   false,

  loading: {
    quote:        false,
    confirm:      false,
    fetchRide:    false,
    adminAll:     false,
    nearby:       false,
    adminAssign:  false,
    tpAssign:     false,
    statusUpdate: false,
    live:         false,
    tracking:     false,
    milestone:    false,
    caLive:       false,
  },

  errors: {
    quote:        null,
    confirm:      null,
    fetchRide:    null,
    adminAll:     null,
    nearby:       null,
    adminAssign:  null,
    tpAssign:     null,
    statusUpdate: null,
    live:         null,
    tracking:     null,
    milestone:    null,
    caLive:       null,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const rideRequestSlice = createSlice({
  name: 'rideRequest',
  initialState,

  reducers: {
    // ── Socket event handlers ──────────────────────────────────────────────
    socketLocationUpdate(state, action) {
      const p = action.payload;
      state.socketLive.liveLocation = {
        lat:       p.lat,
        lng:       p.lng,
        heading:   p.heading  ?? 0,
        speedKmh:  p.speedKmh ?? p.speed ?? 0,
        updatedAt: p.updatedAt ?? Date.now(),
      };
      if (state.liveData) {
        state.liveData.liveLocation = state.socketLive.liveLocation;
      }
    },

    socketEtaUpdate(state, action) {
      state.socketLive.etaMinutes = action.payload.etaMinutes   ?? state.socketLive.etaMinutes;
      state.socketLive.etaTarget  = action.payload.currentTarget ?? state.socketLive.etaTarget;
      if (state.liveData) state.liveData.currentEtaMinutes = action.payload.etaMinutes;
    },

    socketRideStatusChanged(state, action) {
      const p = action.payload;
      state.socketLive.status = p.status;
      if (p.rideStage)              state.socketLive.rideStage             = p.rideStage;
      if (p.activeNavigationTarget) {
        state.socketLive.activeNavigationTarget = p.activeNavigationTarget;
        state.socketLive.activeTarget           = p.activeNavigationTarget;
      }
      if (state.currentRide?._id === p.rideId) {
        state.currentRide.status = p.status;
        if (p.rideStage) state.currentRide.rideStage = p.rideStage;
      }
    },

    socketDriverAccepted(state) {
      state.socketLive.status = 'driver_accepted';
      if (state.currentRide) state.currentRide.status = 'driver_accepted';
    },
    socketDriverEnRoute(state, action) {
      state.socketLive.status     = 'driver_en_route';
      state.socketLive.etaMinutes = action.payload?.currentEtaMinutes ?? state.socketLive.etaMinutes;
      if (state.currentRide) state.currentRide.status = 'driver_en_route';
    },
    socketDriverArrived(state) {
      state.socketLive.status = 'driver_arrived';
      if (state.currentRide) state.currentRide.status = 'driver_arrived';
    },
    socketOtpVerified(state, action) {
      state.socketLive.status    = 'otp_verified';
      state.socketLive.otpResult = { success: true, ...action.payload };
      if (state.currentRide) state.currentRide.status = 'otp_verified';
    },
    socketRideStarted(state) {
      state.socketLive.status = 'in_progress';
      if (state.currentRide) state.currentRide.status = 'in_progress';
    },
    socketAtStop(state) {
      state.socketLive.status = 'at_stop';
      if (state.currentRide) state.currentRide.status = 'at_stop';
    },
    socketRideCompleted(state) {
      state.socketLive.status = 'completed';
      if (state.currentRide) state.currentRide.status = 'completed';
    },
    socketRideCancelled(state) {
      state.socketLive.status = 'cancelled';
      if (state.currentRide) state.currentRide.status = 'cancelled';
    },

    socketHospitalEtaUpdate(state, action) {
      state.socketLive.hospitalEta = {
        hospitalId:   action.payload.hospitalId,
        hospitalName: action.payload.hospitalName,
        etaMinutes:   action.payload.etaMinutes,
        distanceKm:   action.payload.distanceKm,
        coordinates:  action.payload.coordinates,
      };
    },

    socketCareAssistantTracking(state, action) {
      state.socketLive.careAssistantTracking = {
        bookingId:      action.payload.bookingId,
        rideId:         action.payload.rideId,
        driverLocation: action.payload.driverLocation,
        activeTarget:   action.payload.activeTarget,
        etaMinutes:     action.payload.etaMinutes,
        distanceKm:     action.payload.distanceKm,
      };
      state.socketLive.activeTarget = action.payload.activeTarget;
    },

    socketCaAtJoinPoint(state, action) {
      state.caAtJoinPoint = true;
      state.caViewMode    = 'navigate_to_jp';
      if (action.payload?.careAssistantStatus) {
        state.socketLive.careAssistantTracking = {
          ...state.socketLive.careAssistantTracking,
          caStatus: action.payload.careAssistantStatus,
        };
      }
    },

    socketCaJoinedRide(state, action) {
      state.caHasJoined   = true;
      state.caViewMode    = 'driver_tracking_only';
      state.caAtJoinPoint = false;
      if (action.payload?.jpCompleted) state.jpCompleted = true;
    },

    socketJpWaypointCompleted(state) {
      state.jpCompleted = true;
    },

    socketNavigationTargetChanged(state, action) {
      const p = action.payload;
      state.socketLive.navigationTarget      = p;
      state.socketLive.activeNavigationTarget = p.currentTarget || p.activeNavigationTarget;
      state.socketLive.activeTarget          = p.currentTarget || p.activeNavigationTarget;
    },

    socketOtpResult(state, action) {
      state.socketLive.otpResult = action.payload;
    },

    socketOtpWrongAttempt(state) {
      state.socketLive.wrongOtpAttempts += 1;
    },

    socketRideAssigned(state, action) {
      state.socketLive.status         = action.payload.status;
      state.socketLive.driverSnapshot = action.payload.driverSnapshot ?? state.socketLive.driverSnapshot;
      if (state.currentRide?._id === action.payload.rideId) {
        state.currentRide.status = action.payload.status;
      }
    },

    // ── Manual resets ──────────────────────────────────────────────────────
    clearQuote(state) {
      state.quote = null;
      state.errors.quote = null;
    },

    clearCurrentRide(state) {
      state.currentRide   = null;
      state.liveData      = null;
      state.trackingData  = null;
      state.nearbyResult  = null;
      state.createdRide   = null;
      state.caLiveData    = null;
      state.quote         = null;
      state.socketLive    = initialState.socketLive;
      state.caAtJoinPoint = false;
      state.caHasJoined   = false;
      state.caViewMode    = null;
      state.jpCompleted   = false;
    },

    clearCreatedRide(state) { state.createdRide = null; },
    clearNearby(state)       { state.nearbyResult = null; },
    clearErrors(state)       { state.errors = initialState.errors; },
    resetSocketLive(state)   {
      state.socketLive    = initialState.socketLive;
      state.caAtJoinPoint = false;
      state.caHasJoined   = false;
      state.caViewMode    = null;
      state.jpCompleted   = false;
    },
  },

  extraReducers: (builder) => {

    // ── quoteRide ─────────────────────────────────────────────────────────
    builder
      .addCase(quoteRide.pending, (state) => {
        state.loading.quote = true;
        state.errors.quote  = null;
        state.quote         = null;
      })
      .addCase(quoteRide.fulfilled, (state, action) => {
        state.loading.quote = false;
        state.quote         = action.payload;
      })
      .addCase(quoteRide.rejected, (state, action) => {
        state.loading.quote = false;
        state.errors.quote  = action.payload;
        toast.error(action.payload || 'Could not get fare quote');
      });

    // ── confirmRide ───────────────────────────────────────────────────────
    builder
      .addCase(confirmRide.pending, (state) => {
        state.loading.confirm = true;
        state.errors.confirm  = null;
      })
      .addCase(confirmRide.fulfilled, (state, action) => {
        state.loading.confirm = false;
        state.createdRide     = action.payload;
        state.quote           = null;
        toast.success('Ride requested. Waiting for driver assignment.');
      })
      .addCase(confirmRide.rejected, (state, action) => {
        state.loading.confirm = false;
        state.errors.confirm  = action.payload;
        toast.error(action.payload || 'Payment or ride confirmation failed');
      });

    // ── fetchRide ─────────────────────────────────────────────────────────
    builder
      .addCase(fetchRide.pending,   (state) => { state.loading.fetchRide = true;  state.errors.fetchRide = null; })
      .addCase(fetchRide.fulfilled, (state, action) => {
        state.loading.fetchRide     = false;
        state.currentRide           = action.payload;
        state.socketLive.status     = action.payload.status;
      })
      .addCase(fetchRide.rejected,  (state, action) => {
        state.loading.fetchRide = false;
        state.errors.fetchRide  = action.payload;
        toast.error(action.payload || 'Could not fetch ride');
      });

    // ── fetchAdminAllRides ────────────────────────────────────────────────
    builder
      .addCase(fetchAdminAllRides.pending,   (state) => { state.loading.adminAll = true;  state.errors.adminAll = null; })
      .addCase(fetchAdminAllRides.fulfilled, (state, action) => {
        state.loading.adminAll = false;
        state.adminRides       = action.payload.rides;
        state.adminTotal       = action.payload.total;
        state.adminPage        = action.payload.page;
        state.adminPages       = action.payload.pages;
      })
      .addCase(fetchAdminAllRides.rejected,  (state, action) => {
        state.loading.adminAll = false;
        state.errors.adminAll  = action.payload;
        toast.error(action.payload || 'Could not fetch rides');
      });

    // ── fetchNearbyDrivers ────────────────────────────────────────────────
    builder
      .addCase(fetchNearbyDrivers.pending,   (state) => { state.loading.nearby = true;  state.errors.nearby = null; })
      .addCase(fetchNearbyDrivers.fulfilled, (state, action) => { state.loading.nearby = false; state.nearbyResult = action.payload; })
      .addCase(fetchNearbyDrivers.rejected,  (state, action) => {
        state.loading.nearby = false;
        state.errors.nearby  = action.payload;
        toast.error(action.payload || 'Nearby search failed');
      });

    // ── adminAssignRide ───────────────────────────────────────────────────
    builder
      .addCase(adminAssignRide.pending,   (state) => { state.loading.adminAssign = true;  state.errors.adminAssign = null; })
      .addCase(adminAssignRide.fulfilled, (state, action) => {
        state.loading.adminAssign = false;
        state.adminRides = state.adminRides.filter(r => r._id !== action.payload.rideId);
        toast.success(action.payload.assignedTo === 'tp' ? 'Transport partner assigned. Waiting for driver.' : 'Driver assigned.');
      })
      .addCase(adminAssignRide.rejected,  (state, action) => {
        state.loading.adminAssign = false;
        state.errors.adminAssign  = action.payload;
        toast.error(action.payload || 'Assignment failed');
      });

    // ── tpAssignDriver ────────────────────────────────────────────────────
    builder
      .addCase(tpAssignDriver.pending,   (state) => { state.loading.tpAssign = true;  state.errors.tpAssign = null; })
      .addCase(tpAssignDriver.fulfilled, (state, action) => {
        state.loading.tpAssign = false;
        if (state.currentRide?._id === action.payload.rideId) {
          state.currentRide.status = action.payload.status;
          state.socketLive.status  = action.payload.status;
        }
        toast.success('Driver assigned to ride.');
      })
      .addCase(tpAssignDriver.rejected,  (state, action) => {
        state.loading.tpAssign = false;
        state.errors.tpAssign  = action.payload;
        toast.error(action.payload || 'Driver assignment failed');
      });

    // ── updateRideStatus ──────────────────────────────────────────────────
    builder
      .addCase(updateRideStatus.pending,   (state) => { state.loading.statusUpdate = true;  state.errors.statusUpdate = null; })
      .addCase(updateRideStatus.fulfilled, (state, action) => {
        state.loading.statusUpdate = false;
        const newStatus = action.payload.status;
        if (newStatus && state.currentRide?._id === action.payload.rideId) {
          state.currentRide.status = newStatus;
        }
        if (newStatus) state.socketLive.status = newStatus;
        if (action.payload.jpCompleted) state.jpCompleted = true;

        const toastMap = {
          driver_accepted: 'Ride accepted.',
          driver_en_route: 'En route to pickup.',
          driver_arrived:  'Arrived at pickup. OTP sent to customer.',
          otp_verified:    'OTP verified.',
          in_progress:     'Ride started.',
          at_stop:         'Stopped.',
          completed:       'Ride completed.',
          cancelled:       'Ride cancelled.',
        };
        if (newStatus && toastMap[newStatus]) toast.success(toastMap[newStatus]);
      })
      .addCase(updateRideStatus.rejected,  (state, action) => {
        state.loading.statusUpdate = false;
        state.errors.statusUpdate  = action.payload;
        toast.error(action.payload || 'Status update failed');
      });

    // ── fetchRideLive ─────────────────────────────────────────────────────
    builder
      .addCase(fetchRideLive.pending,   (state) => { state.loading.live = true;  state.errors.live = null; })
      .addCase(fetchRideLive.fulfilled, (state, action) => {
        state.loading.live          = false;
        state.liveData              = action.payload;
        state.socketLive.status     = action.payload.status;
        state.socketLive.etaMinutes = action.payload.currentEtaMinutes ?? state.socketLive.etaMinutes;
        state.socketLive.etaTarget  = action.payload.currentEtaTarget  ?? state.socketLive.etaTarget;
        state.socketLive.liveLocation = action.payload.liveLocation ?? state.socketLive.liveLocation;
      })
      .addCase(fetchRideLive.rejected,  (state, action) => { state.loading.live = false; state.errors.live = action.payload; });

    // ── fetchRideTracking ─────────────────────────────────────────────────
    builder
      .addCase(fetchRideTracking.pending,   (state) => { state.loading.tracking = true;  state.errors.tracking = null; })
      .addCase(fetchRideTracking.fulfilled, (state, action) => {
        state.loading.tracking = false;
        state.trackingData     = action.payload;
        if (action.payload.ride) {
          state.currentRide       = action.payload.ride;
          state.socketLive.status = action.payload.ride.status;
        }
      })
      .addCase(fetchRideTracking.rejected,  (state, action) => {
        state.loading.tracking = false;
        state.errors.tracking  = action.payload;
        toast.error(action.payload || 'Could not load tracking data');
      });

    // ── postMilestone ─────────────────────────────────────────────────────
    builder
      .addCase(postMilestone.pending,   (state) => { state.loading.milestone = true;  state.errors.milestone = null; })
      .addCase(postMilestone.fulfilled, (state, action) => {
        state.loading.milestone = false;
        if (state.trackingData?.tracking?.milestones) {
          state.trackingData.tracking.milestones.push(action.payload.milestone);
        }
      })
      .addCase(postMilestone.rejected,  (state, action) => {
        state.loading.milestone = false;
        state.errors.milestone  = action.payload;
        toast.error(action.payload || 'Milestone record failed');
      });

    // ── fetchCareAssistantLive ────────────────────────────────────────────
    builder
      .addCase(fetchCareAssistantLive.pending,   (state) => { state.loading.caLive = true;  state.errors.caLive = null; })
      .addCase(fetchCareAssistantLive.fulfilled, (state, action) => {
        state.loading.caLive = false;
        state.caLiveData     = action.payload;
        if (action.payload.caViewMode)                 state.caViewMode  = action.payload.caViewMode;
        if (action.payload.caHasJoined !== undefined)  state.caHasJoined = action.payload.caHasJoined;
      })
      .addCase(fetchCareAssistantLive.rejected,  (state, action) => {
        state.loading.caLive = false;
        state.errors.caLive  = action.payload;
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  socketLocationUpdate,
  socketEtaUpdate,
  socketRideStatusChanged,
  socketDriverAccepted,
  socketDriverEnRoute,
  socketDriverArrived,
  socketOtpVerified,
  socketRideStarted,
  socketAtStop,
  socketRideCompleted,
  socketRideCancelled,
  socketHospitalEtaUpdate,
  socketCareAssistantTracking,
  socketCaAtJoinPoint,
  socketCaJoinedRide,
  socketJpWaypointCompleted,
  socketNavigationTargetChanged,
  socketOtpResult,
  socketOtpWrongAttempt,
  socketRideAssigned,
  clearQuote,
  clearCurrentRide,
  clearCreatedRide,
  clearNearby,
  clearErrors,
  resetSocketLive,
} = rideRequestSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const selectQuote              = (s) => s.rideRequest.quote;
export const selectQuoteLoading       = (s) => s.rideRequest.loading.quote;
export const selectQuoteError         = (s) => s.rideRequest.errors.quote;
export const selectConfirmLoading     = (s) => s.rideRequest.loading.confirm;
export const selectConfirmError       = (s) => s.rideRequest.errors.confirm;

export const selectCurrentRide        = (s) => s.rideRequest.currentRide;
export const selectCreatedRide        = (s) => s.rideRequest.createdRide;
export const selectLiveData           = (s) => s.rideRequest.liveData;
export const selectTrackingData       = (s) => s.rideRequest.trackingData;
export const selectAdminRides         = (s) => s.rideRequest.adminRides;
export const selectAdminPagination    = (s) => ({
  total: s.rideRequest.adminTotal,
  page:  s.rideRequest.adminPage,
  pages: s.rideRequest.adminPages,
});
export const selectNearbyResult       = (s) => s.rideRequest.nearbyResult;
export const selectSocketLive         = (s) => s.rideRequest.socketLive;
export const selectRideStatus         = (s) => s.rideRequest.socketLive.status;
export const selectRideStage          = (s) => s.rideRequest.socketLive.rideStage;
export const selectLiveLocation       = (s) => s.rideRequest.socketLive.liveLocation;
export const selectNavigationTarget   = (s) => s.rideRequest.socketLive.navigationTarget;
export const selectActiveNavigationTarget = (s) => s.rideRequest.socketLive.activeNavigationTarget;
export const selectActiveTarget       = (s) => s.rideRequest.socketLive.activeTarget;
export const selectEta                = (s) => ({ minutes: s.rideRequest.socketLive.etaMinutes, target: s.rideRequest.socketLive.etaTarget });
export const selectEtaUpdate          = (s) => s.rideRequest.socketLive.etaMinutes;
export const selectOtpResult          = (s) => s.rideRequest.socketLive.otpResult;
export const selectWrongOtpAttempts   = (s) => s.rideRequest.socketLive.wrongOtpAttempts;
export const selectHospitalEta        = (s) => s.rideRequest.socketLive.hospitalEta;
export const selectCareAssistantTracking = (s) => s.rideRequest.socketLive.careAssistantTracking;

export const selectCaLiveData         = (s) => s.rideRequest.caLiveData;
export const selectCaAtJoinPoint      = (s) => s.rideRequest.caAtJoinPoint;
export const selectCaHasJoined        = (s) => s.rideRequest.caHasJoined;
export const selectCaViewMode         = (s) => s.rideRequest.caViewMode;
export const selectJpCompleted        = (s) => s.rideRequest.jpCompleted;

export const selectRideLoading        = (s) => s.rideRequest.loading;
export const selectRideErrors         = (s) => s.rideRequest.errors;
export const selectStatusUpdating     = (s) => s.rideRequest.loading.statusUpdate;
export const selectTrackingLoading    = (s) => s.rideRequest.loading.tracking;
export const selectLiveLoading        = (s) => s.rideRequest.loading.live;
export const selectAdminAllLoading    = (s) => s.rideRequest.loading.adminAll;
export const selectNearbyLoading      = (s) => s.rideRequest.loading.nearby;
export const selectAdminAssignLoading = (s) => s.rideRequest.loading.adminAssign;
export const selectTpAssignLoading    = (s) => s.rideRequest.loading.tpAssign;

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET WIRING HELPER
// ─────────────────────────────────────────────────────────────────────────────

export function wireRideSocketEvents(on, SOCKET_EVENTS, dispatch) {
  const EV = SOCKET_EVENTS;

  const unsubs = [
    on(EV.LOCATION_UPDATE,                    (d) => dispatch(socketLocationUpdate(d))),
    on(EV.ETA_UPDATE,                         (d) => dispatch(socketEtaUpdate(d))),
    on(EV.RIDE_STATUS_CHANGED,                (d) => dispatch(socketRideStatusChanged(d))),
    on(EV.NAVIGATION_TARGET_CHANGED,          (d) => dispatch(socketNavigationTargetChanged(d))),
    on(EV.OTP_RESULT,                         (d) => dispatch(socketOtpResult(d))),
    on(EV.OTP_WRONG_ATTEMPT,                  ()  => dispatch(socketOtpWrongAttempt())),
    on(EV.HOSPITAL_ETA_UPDATE,                (d) => dispatch(socketHospitalEtaUpdate(d))),

    on(EV.CARE_ASSISTANT_AT_JP,               (d) => dispatch(socketCaAtJoinPoint(d))),
    on(EV.CARE_ASSISTANT_JOINED_RIDE,         (d) => dispatch(socketCaJoinedRide(d))),
    on(EV.CA_JOIN_WAYPOINT_COMPLETED,         (d) => dispatch(socketJpWaypointCompleted(d))),
    on(EV.CARE_ASSISTANT_ATTACHED,            (d) => dispatch(socketRideAssigned(d))),

    on('care-assistant:ride:tracking',         (d) => dispatch(socketCareAssistantTracking(d))),

    on('driver_accepted',                      (d) => dispatch(socketDriverAccepted(d))),
    on('driver_en_route',                      (d) => dispatch(socketDriverEnRoute(d))),
    on('driver_arrived',                       (d) => dispatch(socketDriverArrived(d))),
    on('otp_verified',                         (d) => dispatch(socketOtpVerified(d))),
    on('ride_started',                         (d) => dispatch(socketRideStarted(d))),
    on('at_stop',                              (d) => dispatch(socketAtStop(d))),
    on(EV.RIDE_COMPLETED,                     (d) => dispatch(socketRideCompleted(d))),
    on('ride_cancelled',                       (d) => dispatch(socketRideCancelled(d))),
    on('ride_assigned',                        (d) => dispatch(socketRideAssigned(d))),
  ];

  return () => unsubs.forEach((fn) => fn?.());
}

export default rideRequestSlice.reducer;