// app/store/slices/bookingslice
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import toast                              from 'react-hot-toast';
import API                                from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BASE = '/bookings';

export const BOOKING_TYPES = [
  'full_care_ride',
  'doctor_consultation',
  'doctor_online',
  'patient_transport',
  'physiotherapist',
  'follow_up',
  'diagnostic_center',
  'diagnostic_home',
  'care_assistant',
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const mkThunk = (type, fn) =>
  createAsyncThunk(type, async (arg, api) => {
    try {
      return await fn(arg, api);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || 'Something went wrong';
      toast.error(msg);
      return api.rejectWithValue(msg);
    }
  });

const key = (type) => type.split('/')[1];

const downloadBlob = (data, filename, mime = 'application/zip') => {
  const url  = window.URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement('a');
  link.href  = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Discovery ─────────────────────────────────────────────────────────────
  hospitals:            [],
  hospitalDoctors:      [],
  hospitalAvailability: null,
  doctorAvailability:   null,
  labs:                 [],
  selectedLab:          null,
  bookingOptions:       null,
  transportEstimate:    null,
  followUpEligibility:  null,
  platformPricing:      null,
  consultationCoverage: null,
  allDoctors:           [],
  allDoctorsMeta:       { total: 0, page: 1, limit: 20 },

  // ── Subscription benefits ─────────────────────────────────────────────────
  subscriptionBenefitConsultations: null,
  subscriptionBenefitCareAssistant: null,
  subscriptionBenefitLabs:          null,

  // ── Previous patient info ─────────────────────────────────────────────────
  previousPatientInfo: null,

  // ── My bookings ───────────────────────────────────────────────────────────
  myBookings:          [],
  myBookingsMeta:      { total: 0, page: 1, limit: 10 },
  selectedBooking:     null,
  cancelBookingResult: null,
  rateBookingResult:   null,

  // ── Payment results ───────────────────────────────────────────────────────
  verifyPaymentResult:      null,
  confirmCashPaymentResult: null,
  deleteFailedBookingResult: null,

  // ── Active booking creation ───────────────────────────────────────────────
  createdBooking:       null,
  createBookingLoading: false,
  createBookingError:   null,
  createBookingStatus:  'idle',

  // ── Per-thunk loading / error maps ────────────────────────────────────────
  loading: {},
  errors:  {},
};

// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchHospitals = mkThunk(
  'booking/fetchHospitals',
  async ({ city, hospitalType } = {}) => {
    const { data } = await API.get(`${BASE}/hospitals`, { params: { city, hospitalType } });
    return data.data;
  }
);

export const fetchHospitalDoctors = mkThunk(
  'booking/fetchHospitalDoctors',
  async ({ hospitalId }) => {
    const { data } = await API.get(`${BASE}/hospitals/${hospitalId}/doctors`);
    return data.data;
  }
);

export const checkHospitalAvailability = mkThunk(
  'booking/checkHospitalAvailability',
  async ({ hospitalId, scheduledAt }) => {
    const { data } = await API.get(`${BASE}/hospitals/${hospitalId}/availability`, {
      params: { scheduledAt },
    });
    return data.data;
  }
);

export const checkDoctorAvailability = mkThunk(
  'booking/checkDoctorAvailability',
  async ({ doctorId, scheduledAt, hospitalId }) => {
    const { data } = await API.get(`${BASE}/doctors/${doctorId}/availability`, {
      params: { scheduledAt, hospitalId },
    });
    return data.data;
  }
);

export const fetchAllDoctors = mkThunk(
  'booking/fetchAllDoctors',
  async ({ specialization, consultationType, city, isOnline, page = 1, limit = 20 } = {}) => {
    const { data } = await API.get(`${BASE}/doctors`, {
      params: { specialization, consultationType, city, isOnline, page, limit },
    });
    return data;
  }
);

export const fetchLabs = mkThunk(
  'booking/fetchLabs',
  async ({ city, labType, homeCollection } = {}) => {
    const { data } = await API.get(`${BASE}/labs`, {
      params: { city, labType, homeCollection },
    });
    return data.data;
  }
);

export const fetchLabById = mkThunk(
  'booking/fetchLabById',
  async ({ labId }) => {
    const { data } = await API.get(`${BASE}/labs/${labId}`);
    return data.data;
  }
);

export const fetchBookingOptions = mkThunk(
  'booking/fetchBookingOptions',
  async ({ type }) => {
    const { data } = await API.get(`${BASE}/booking-options/${type}`);
    return data.data;
  }
);

export const fetchTransportEstimate = mkThunk(
  'booking/fetchTransportEstimate',
  async ({
    pickupLng, pickupLat, dropoffLng, dropoffLat,
    includeReturn  = false,
    waitingMinutes = 0,
    bookingType    = 'patient_transport',
  }) => {
    const { data } = await API.get(`${BASE}/transport/estimate`, {
      params: { pickupLng, pickupLat, dropoffLng, dropoffLat, includeReturn, waitingMinutes, bookingType },
    });
    return data.data;
  }
);

export const checkConsultationCoverage = mkThunk(
  'booking/checkConsultationCoverage',
  async ({ consultationType } = {}) => {
    const { data } = await API.get(`${BASE}/consultation-check`, {
      params: consultationType ? { consultationType } : {},
    });
    return data.data;
  }
);

export const checkFollowUpEligibility = mkThunk(
  'booking/checkFollowUpEligibility',
  async ({ doctorId, hospitalId, patientName, patientPhone } = {}) => {
    const { data } = await API.get(`${BASE}/follow-up/check`, {
      params: { doctorId, hospitalId, patientName, patientPhone },
    });
    return data.data;
  }
);

export const fetchPlatformPricing = mkThunk(
  'booking/fetchPlatformPricing',
  async () => {
    const { data } = await API.get(`${BASE}/platform-pricing`);
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION BENEFIT THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchSubscriptionBenefitConsultations = mkThunk(
  'booking/fetchSubscriptionBenefitConsultations',
  async () => {
    try {
      const { data } = await API.get(`${BASE}/subscription-benefits/consultations`);
      return data.data;
    } catch (err) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }
);

export const fetchSubscriptionBenefitCareAssistant = mkThunk(
  'booking/fetchSubscriptionBenefitCareAssistant',
  async () => {
    try {
      const { data } = await API.get(`${BASE}/subscription-benefits/care-assistant`);
      return data.data;
    } catch (err) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }
);

export const fetchSubscriptionBenefitLabs = mkThunk(
  'booking/fetchSubscriptionBenefitLabs',
  async () => {
    try {
      const { data } = await API.get(`${BASE}/subscription-benefits/labs`);
      return data.data;
    } catch (err) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PREVIOUS PATIENT INFO THUNK
// GET /previous-patient-info
// Returns last booking's patientInfo for pre-filling forms.
// ─────────────────────────────────────────────────────────────────────────────

export const fetchPreviousPatientInfo = mkThunk(
  'booking/fetchPreviousPatientInfo',
  async () => {
    const { data } = await API.get(`${BASE}/previous-patient-info`);
    return data.data; // { patientInfo, fromBooking, bookingType, bookedAt } | null
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING CREATION THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const createFullCareRide = mkThunk(
  'booking/createFullCareRide',
  async (payload) => {
    const { data } = await API.post(`${BASE}/full-care-ride`, payload);
    toast.success('Full care ride booked!');
    return data.data;
  }
);

export const createDoctorConsultation = mkThunk(
  'booking/createDoctorConsultation',
  async (payload) => {
    const { data } = await API.post(`${BASE}/doctor-consultation`, payload);
    toast.success('Appointment confirmed!');
    return data.data;
  }
);

export const createDoctorOnline = mkThunk(
  'booking/createDoctorOnline',
  async (payload) => {
    const { data } = await API.post(`${BASE}/doctor-online`, payload);
    toast.success('Online consultation booked!');
    return data.data;
  }
);

export const createPatientTransport = mkThunk(
  'booking/createPatientTransport',
  async (payload) => {
    const { data } = await API.post(`${BASE}/patient-transport`, payload);
    toast.success('Transport booked!');
    return data.data;
  }
);

export const createPhysiotherapist = mkThunk(
  'booking/createPhysiotherapist',
  async (payload) => {
    const { data } = await API.post(`${BASE}/physiotherapist`, payload);
    toast.success('Physiotherapy appointment confirmed!');
    return data.data;
  }
);

export const createFollowUp = mkThunk(
  'booking/createFollowUp',
  async (payload) => {
    const { data } = await API.post(`${BASE}/follow-up`, payload);
    toast.success('Follow-up booked!');
    return data.data;
  }
);

export const createDiagnosticCenter = mkThunk(
  'booking/createDiagnosticCenter',
  async (payload) => {
    const { data } = await API.post(`${BASE}/diagnostic-center`, payload);
    toast.success('Diagnostic appointment booked!');
    return data.data;
  }
);

export const createDiagnosticHome = mkThunk(
  'booking/createDiagnosticHome',
  async (payload) => {
    const { data } = await API.post(`${BASE}/diagnostic-home`, payload);
    toast.success('Home collection booked!');
    return data.data;
  }
);

export const createCareAssistant = mkThunk(
  'booking/createCareAssistant',
  async (payload) => {
    const { data } = await API.post(`${BASE}/care-assistant`, payload);
    toast.success('Care assistant assigned!');
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const verifyRazorpayPayment = mkThunk(
  'booking/verifyRazorpayPayment',
  async ({ bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
    const { data } = await API.post(`${BASE}/verify-payment`, {
      bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature,
    });
    return { success: data.success, ...(data.data || {}) };
  }
);

export const confirmCashPayment = mkThunk(
  'booking/confirmCashPayment',
  async ({ bookingId, amountCollected }) => {
    const { data } = await API.post(`${BASE}/confirm-cash-payment`, {
      bookingId,
      ...(amountCollected != null && { amountCollected }),
    });
    toast.success('Cash payment confirmed.');
    return { bookingId, ...data.data };
  }
);

export const deleteFailedBooking = mkThunk(
  'booking/deleteFailedBooking',
  async ({ bookingId, walletApplied = 0 }) => {
    const { data } = await API.post(`${BASE}/delete-failed-booking`, {
      bookingId,
      walletApplied,
    });
    toast.success(`Booking deleted. Wallet refunded: ₹${data.data?.walletRefunded ?? 0}`);
    return data.data;
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING MANAGEMENT THUNKS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchMyBookings = mkThunk(
  'booking/fetchMyBookings',
  async ({ status, bookingType, page = 1, limit = 10 } = {}) => {
    const { data } = await API.get(`${BASE}/my-bookings`, {
      params: { status, bookingType, page, limit },
    });
    return data;
  }
);

export const fetchMyBookingById = mkThunk(
  'booking/fetchMyBookingById',
  async ({ bookingId }) => {
    const { data } = await API.get(`${BASE}/my-bookings/${bookingId}`);
    return data.data;
  }
);

export const cancelMyBooking = mkThunk(
  'booking/cancelMyBooking',
  async ({ bookingId, reason }) => {
    const { data } = await API.post(`${BASE}/my-bookings/${bookingId}/cancel`, { reason });
    toast.success(`Booking cancelled. Refund: ₹${data.data?.refundAmount ?? 0}`);
    return { bookingId, ...data.data };
  }
);

export const rateMyBooking = mkThunk(
  'booking/rateMyBooking',
  async ({
    bookingId,
    overallRating, overallComment,
    doctorRating,  doctorComment,
    careAssistantRating, careAssistantComment,
    driverRating,  driverComment,
    labRating,     labComment,
  }) => {
    const { data } = await API.post(`${BASE}/my-bookings/${bookingId}/rate`, {
      overallRating, overallComment,
      doctorRating,  doctorComment,
      careAssistantRating, careAssistantComment,
      driverRating,  driverComment,
      labRating,     labComment,
    });
    toast.success('Rating submitted!');
    return { bookingId };
  }
);

export const downloadOpCard = mkThunk(
  'booking/downloadOpCard',
  async ({ bookingId, filename = 'op-card.zip' }) => {
    const { data } = await API.get(`${BASE}/my-bookings/${bookingId}/op-download`, {
      responseType: 'blob',
    });
    downloadBlob(data, filename, 'application/zip');
    return { bookingId };
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const bookingSlice = createSlice({
  name: 'booking',
  initialState,

  reducers: {
    // ── Booking creation ─────────────────────────────────────────────────────
    clearCreatedBooking(state) {
      state.createdBooking       = null;
      state.createBookingLoading = false;
      state.createBookingError   = null;
      state.createBookingStatus  = 'idle';
    },
    resetCreateBooking(state) {
      state.createdBooking       = null;
      state.createBookingLoading = false;
      state.createBookingError   = null;
      state.createBookingStatus  = 'idle';
    },

    // ── Detail / list ────────────────────────────────────────────────────────
    clearSelectedBooking(state) {
      state.selectedBooking = null;
    },

    // ── Discovery ────────────────────────────────────────────────────────────
    clearDiscovery(state) {
      state.hospitals            = [];
      state.hospitalDoctors      = [];
      state.hospitalAvailability = null;
      state.doctorAvailability   = null;
      state.labs                 = [];
      state.selectedLab          = null;
      state.bookingOptions       = null;
      state.transportEstimate    = null;
      state.followUpEligibility  = null;
    },
    resetHospitals(state) {
      state.hospitals = [];
      delete state.loading.fetchHospitals;
      delete state.errors.fetchHospitals;
    },
    resetDoctorsByHospital(state) {
      state.hospitalDoctors = [];
      delete state.loading.fetchHospitalDoctors;
      delete state.errors.fetchHospitalDoctors;
    },
    resetHospitalAvailability(state) {
      state.hospitalAvailability = null;
      delete state.loading.checkHospitalAvailability;
      delete state.errors.checkHospitalAvailability;
    },
    resetDoctorAvailability(state) {
      state.doctorAvailability = null;
      delete state.loading.checkDoctorAvailability;
      delete state.errors.checkDoctorAvailability;
    },
    resetTransportEstimate(state) {
      state.transportEstimate = null;
      delete state.loading.fetchTransportEstimate;
      delete state.errors.fetchTransportEstimate;
    },
    resetFollowUpCheck(state) {
      state.followUpEligibility = null;
      delete state.loading.checkFollowUpEligibility;
      delete state.errors.checkFollowUpEligibility;
    },
    resetBookingOptions(state) {
      state.bookingOptions = null;
      delete state.loading.fetchBookingOptions;
      delete state.errors.fetchBookingOptions;
    },
    resetConsultationCoverage(state) {
      state.consultationCoverage = null;
      delete state.loading.checkConsultationCoverage;
      delete state.errors.checkConsultationCoverage;
    },
    resetPlatformPricing(state) {
      state.platformPricing = null;
      delete state.loading.fetchPlatformPricing;
      delete state.errors.fetchPlatformPricing;
    },
    resetAllDoctors(state) {
      state.allDoctors     = [];
      state.allDoctorsMeta = { total: 0, page: 1, limit: 20 };
      delete state.loading.fetchAllDoctors;
      delete state.errors.fetchAllDoctors;
    },

    // ── Previous patient info ─────────────────────────────────────────────
    resetPreviousPatientInfo(state) {
      state.previousPatientInfo = null;
      delete state.loading.fetchPreviousPatientInfo;
      delete state.errors.fetchPreviousPatientInfo;
    },

    // ── Subscription benefits ─────────────────────────────────────────────
    resetSubscriptionBenefitConsultations(state) {
      state.subscriptionBenefitConsultations = null;
      delete state.loading.fetchSubscriptionBenefitConsultations;
      delete state.errors.fetchSubscriptionBenefitConsultations;
    },
    resetSubscriptionBenefitCareAssistant(state) {
      state.subscriptionBenefitCareAssistant = null;
      delete state.loading.fetchSubscriptionBenefitCareAssistant;
      delete state.errors.fetchSubscriptionBenefitCareAssistant;
    },
    resetSubscriptionBenefitLabs(state) {
      state.subscriptionBenefitLabs = null;
      delete state.loading.fetchSubscriptionBenefitLabs;
      delete state.errors.fetchSubscriptionBenefitLabs;
    },

    // ── Cancel / rate ─────────────────────────────────────────────────────
    resetCancelBooking(state) {
      state.cancelBookingResult = null;
      delete state.loading.cancelMyBooking;
      delete state.errors.cancelMyBooking;
    },
    resetRateBooking(state) {
      state.rateBookingResult = null;
      delete state.loading.rateMyBooking;
      delete state.errors.rateMyBooking;
    },

    // ── Payment ───────────────────────────────────────────────────────────
    resetVerifyPayment(state) {
      state.verifyPaymentResult = null;
      delete state.loading.verifyRazorpayPayment;
      delete state.errors.verifyRazorpayPayment;
    },
    resetConfirmCashPayment(state) {
      state.confirmCashPaymentResult = null;
      delete state.loading.confirmCashPayment;
      delete state.errors.confirmCashPayment;
    },
    resetDeleteFailedBooking(state) {
      state.deleteFailedBookingResult = null;
      delete state.loading.deleteFailedBooking;
      delete state.errors.deleteFailedBooking;
    },

    // ── Global ────────────────────────────────────────────────────────────
    clearErrors(state) {
      state.errors = {};
    },
  },

  extraReducers: (builder) => {
    const pending = (state, action) => {
      state.loading[key(action.type)] = true;
      delete state.errors[key(action.type)];
    };

    const rejected = (state, action) => {
      state.loading[key(action.type)] = false;
      state.errors[key(action.type)]  = action.payload || 'Error';
    };

    const wire = (thunk, fulfilled) => {
      builder
        .addCase(thunk.pending,   pending)
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key(action.type)] = false;
          fulfilled(state, action);
        })
        .addCase(thunk.rejected, rejected);
    };

    const wireCreate = (thunk) => {
      builder
        .addCase(thunk.pending, (state, action) => {
          pending(state, action);
          state.createBookingLoading = true;
          state.createBookingError   = null;
          state.createBookingStatus  = 'loading';
        })
        .addCase(thunk.fulfilled, (state, action) => {
          state.loading[key(action.type)] = false;
          state.createdBooking       = action.payload ?? null;
          state.createBookingLoading = false;
          state.createBookingError   = null;
          state.createBookingStatus  = 'succeeded';
        })
        .addCase(thunk.rejected, (state, action) => {
          rejected(state, action);
          state.createBookingLoading = false;
          state.createBookingError   = action.payload || 'Error';
          state.createBookingStatus  = 'failed';
        });
    };

    // ── Discovery ─────────────────────────────────────────────────────────

    wire(fetchHospitals, (state, { payload }) => {
      state.hospitals = Array.isArray(payload) ? payload : [];
    });

    wire(fetchHospitalDoctors, (state, { payload }) => {
      state.hospitalDoctors = Array.isArray(payload) ? payload : [];
    });

    wire(checkHospitalAvailability, (state, { payload }) => {
      state.hospitalAvailability = payload ?? null;
    });

    wire(checkDoctorAvailability, (state, { payload }) => {
      state.doctorAvailability = payload ?? null;
    });

    wire(fetchAllDoctors, (state, { payload }) => {
      state.allDoctors     = Array.isArray(payload?.data) ? payload.data : [];
      state.allDoctorsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        limit: payload?.limit ?? 20,
      };
    });

    wire(fetchLabs, (state, { payload }) => {
      state.labs = Array.isArray(payload) ? payload : [];
    });

    wire(fetchLabById, (state, { payload }) => {
      state.selectedLab = payload ?? null;
    });

    wire(fetchBookingOptions, (state, { payload }) => {
      state.bookingOptions = payload ?? null;
    });

    wire(fetchTransportEstimate, (state, { payload }) => {
      state.transportEstimate = payload ?? null;
    });

    wire(checkConsultationCoverage, (state, { payload }) => {
      state.consultationCoverage = payload ?? null;
    });

    wire(checkFollowUpEligibility, (state, { payload }) => {
      state.followUpEligibility = payload ?? null;
    });

    wire(fetchPlatformPricing, (state, { payload }) => {
      state.platformPricing = payload ?? null;
    });

    // ── Subscription benefits ─────────────────────────────────────────────

    wire(fetchSubscriptionBenefitConsultations, (state, { payload }) => {
      state.subscriptionBenefitConsultations = payload ?? null;
    });

    wire(fetchSubscriptionBenefitCareAssistant, (state, { payload }) => {
      state.subscriptionBenefitCareAssistant = payload ?? null;
    });

    wire(fetchSubscriptionBenefitLabs, (state, { payload }) => {
      state.subscriptionBenefitLabs = payload ?? null;
    });

    // ── Previous patient info ─────────────────────────────────────────────
    // GET /previous-patient-info → { patientInfo, fromBooking, bookingType, bookedAt }

    wire(fetchPreviousPatientInfo, (state, { payload }) => {
      state.previousPatientInfo = payload ?? null;
    });

    // ── Booking creation ──────────────────────────────────────────────────

    wireCreate(createFullCareRide);
    wireCreate(createDoctorConsultation);
    wireCreate(createDoctorOnline);
    wireCreate(createPatientTransport);
    wireCreate(createPhysiotherapist);
    wireCreate(createFollowUp);
    wireCreate(createDiagnosticCenter);
    wireCreate(createDiagnosticHome);
    wireCreate(createCareAssistant);

    // ── Payment ───────────────────────────────────────────────────────────

    wire(verifyRazorpayPayment, (state, { payload }) => {
      state.verifyPaymentResult = payload ?? null;

      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => String(b._id) === String(payload.bookingId)
        );
        if (idx !== -1) {
          state.myBookings[idx] = {
            ...state.myBookings[idx],
            paymentStatus: payload.paymentStatus ?? 'paid',
          };
        }
        if (
          state.selectedBooking &&
          String(state.selectedBooking._id) === String(payload.bookingId)
        ) {
          state.selectedBooking = {
            ...state.selectedBooking,
            paymentStatus: payload.paymentStatus ?? 'paid',
          };
        }
        if (
          state.createdBooking &&
          String(state.createdBooking.bookingId) === String(payload.bookingId)
        ) {
          state.createdBooking = {
            ...state.createdBooking,
            paymentStatus: payload.paymentStatus ?? 'paid',
          };
        }
      }
    });

    wire(confirmCashPayment, (state, { payload }) => {
      state.confirmCashPaymentResult = payload ?? null;

      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => String(b._id) === String(payload.bookingId)
        );
        if (idx !== -1) {
          state.myBookings[idx] = { ...state.myBookings[idx], paymentStatus: 'paid' };
        }
        if (
          state.selectedBooking &&
          String(state.selectedBooking._id) === String(payload.bookingId)
        ) {
          state.selectedBooking = { ...state.selectedBooking, paymentStatus: 'paid' };
        }
      }
    });

    wire(deleteFailedBooking, (state, { payload }) => {
      state.deleteFailedBookingResult = payload ?? null;

      if (payload?.bookingId) {
        state.myBookings = state.myBookings.filter(
          (b) => String(b._id) !== String(payload.bookingId)
        );
        if (
          state.selectedBooking &&
          String(state.selectedBooking._id) === String(payload.bookingId)
        ) {
          state.selectedBooking = null;
        }
        if (
          state.createdBooking &&
          String(state.createdBooking.bookingId) === String(payload.bookingId)
        ) {
          state.createdBooking = null;
        }
      }
    });

    // ── Booking management ────────────────────────────────────────────────

    wire(fetchMyBookings, (state, { payload }) => {
      state.myBookings     = Array.isArray(payload?.data) ? payload.data : [];
      state.myBookingsMeta = {
        total: payload?.total ?? 0,
        page:  payload?.page  ?? 1,
        limit: payload?.limit ?? 10,
      };
    });

    wire(fetchMyBookingById, (state, { payload }) => {
      state.selectedBooking = payload ?? null;
    });

    wire(cancelMyBooking, (state, { payload }) => {
      state.cancelBookingResult = payload ?? null;
      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => String(b._id) === String(payload.bookingId)
        );
        if (idx !== -1) {
          state.myBookings[idx] = { ...state.myBookings[idx], status: 'cancelled' };
        }
        if (
          state.selectedBooking &&
          String(state.selectedBooking._id) === String(payload.bookingId)
        ) {
          state.selectedBooking = { ...state.selectedBooking, status: 'cancelled' };
        }
      }
    });

    wire(rateMyBooking, (state, { payload }) => {
      state.rateBookingResult = payload ?? null;
      if (payload?.bookingId) {
        const idx = state.myBookings.findIndex(
          (b) => String(b._id) === String(payload.bookingId)
        );
        if (idx !== -1) {
          state.myBookings[idx] = { ...state.myBookings[idx], isRated: true };
        }
        if (
          state.selectedBooking &&
          String(state.selectedBooking._id) === String(payload.bookingId)
        ) {
          state.selectedBooking = { ...state.selectedBooking, isRated: true };
        }
      }
    });

    wire(downloadOpCard, (state, { payload }) => {
      void payload;
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  clearCreatedBooking,
  resetCreateBooking,
  clearSelectedBooking,
  clearDiscovery,
  resetHospitals,
  resetDoctorsByHospital,
  resetHospitalAvailability,
  resetDoctorAvailability,
  resetTransportEstimate,
  resetFollowUpCheck,
  resetBookingOptions,
  resetConsultationCoverage,
  resetPlatformPricing,
  resetAllDoctors,
  resetPreviousPatientInfo,
  resetSubscriptionBenefitConsultations,
  resetSubscriptionBenefitCareAssistant,
  resetSubscriptionBenefitLabs,
  resetCancelBooking,
  resetRateBooking,
  resetVerifyPayment,
  resetConfirmCashPayment,
  resetDeleteFailedBooking,
  clearErrors,
} = bookingSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

// ── Discovery ─────────────────────────────────────────────────────────────────

export const selectHospitals                = (s) => s.booking.hospitals;
export const selectHospitalsLoading         = (s) => s.booking.loading.fetchHospitals              ?? false;
export const selectHospitalsError           = (s) => s.booking.errors.fetchHospitals               ?? null;

export const selectHospitalDoctors          = (s) => s.booking.hospitalDoctors;
export const selectDoctorsByHospital        = (s) => s.booking.hospitalDoctors;
export const selectDoctorsByHospitalLoading = (s) => s.booking.loading.fetchHospitalDoctors        ?? false;
export const selectDoctorsByHospitalError   = (s) => s.booking.errors.fetchHospitalDoctors         ?? null;

export const selectHospitalAvailability     = (s) => s.booking.hospitalAvailability;
export const selectHospitalAvailLoading     = (s) => s.booking.loading.checkHospitalAvailability   ?? false;
export const selectHospitalAvailError       = (s) => s.booking.errors.checkHospitalAvailability    ?? null;

export const selectDoctorAvailability       = (s) => s.booking.doctorAvailability;
export const selectDoctorAvailLoading       = (s) => s.booking.loading.checkDoctorAvailability     ?? false;
export const selectDoctorAvailError         = (s) => s.booking.errors.checkDoctorAvailability      ?? null;

export const selectAllDoctors               = (s) => s.booking.allDoctors;
export const selectAllDoctorsMeta           = (s) => s.booking.allDoctorsMeta;
export const selectAllDoctorsLoading        = (s) => s.booking.loading.fetchAllDoctors             ?? false;
export const selectAllDoctorsError          = (s) => s.booking.errors.fetchAllDoctors              ?? null;

export const selectLabs                     = (s) => s.booking.labs;
export const selectLabsLoading              = (s) => s.booking.loading.fetchLabs                   ?? false;
export const selectLabsError                = (s) => s.booking.errors.fetchLabs                    ?? null;

export const selectSelectedLab              = (s) => s.booking.selectedLab;
export const selectLabDetail                = (s) => s.booking.selectedLab;
export const selectLabDetailLoading         = (s) => s.booking.loading.fetchLabById                ?? false;
export const selectLabDetailError           = (s) => s.booking.errors.fetchLabById                 ?? null;

export const selectBookingOptions           = (s) => s.booking.bookingOptions;
export const selectBookingOptionsLoading    = (s) => s.booking.loading.fetchBookingOptions         ?? false;
export const selectBookingOptionsError      = (s) => s.booking.errors.fetchBookingOptions          ?? null;

export const selectTransportEstimate        = (s) => s.booking.transportEstimate;
export const selectTransportEstimateLoading = (s) => s.booking.loading.fetchTransportEstimate      ?? false;
export const selectTransportEstimLoading    = (s) => s.booking.loading.fetchTransportEstimate      ?? false;
export const selectTransportEstimateError   = (s) => s.booking.errors.fetchTransportEstimate       ?? null;

export const selectConsultationCoverage     = (s) => s.booking.consultationCoverage;
export const selectConsultationCoverageLoad = (s) => s.booking.loading.checkConsultationCoverage   ?? false;
export const selectConsultationCoverageErr  = (s) => s.booking.errors.checkConsultationCoverage    ?? null;

export const selectFollowUpEligibility      = (s) => s.booking.followUpEligibility;
export const selectFollowUpCheck            = (s) => s.booking.followUpEligibility;
export const selectFollowUpCheckLoading     = (s) => s.booking.loading.checkFollowUpEligibility    ?? false;
export const selectFollowUpCheckError       = (s) => s.booking.errors.checkFollowUpEligibility     ?? null;

export const selectPlatformPricing          = (s) => s.booking.platformPricing;
export const selectPlatformPricingLoading   = (s) => s.booking.loading.fetchPlatformPricing        ?? false;
export const selectPlatformPricingError     = (s) => s.booking.errors.fetchPlatformPricing         ?? null;

// ── Previous patient info ─────────────────────────────────────────────────────

export const selectPreviousPatientInfo        = (s) => s.booking.previousPatientInfo;
/** Convenience — pre-filled patientInfo object only */
export const selectPreviousPatientInfoData    = (s) => s.booking.previousPatientInfo?.patientInfo ?? null;
export const selectPreviousPatientInfoLoading = (s) => s.booking.loading.fetchPreviousPatientInfo  ?? false;
export const selectPreviousPatientInfoError   = (s) => s.booking.errors.fetchPreviousPatientInfo   ?? null;

// ── Subscription benefits ─────────────────────────────────────────────────────

export const selectSubBenefitConsultations        = (s) => s.booking.subscriptionBenefitConsultations;
export const selectSubBenefitConsultationsLoading = (s) => s.booking.loading.fetchSubscriptionBenefitConsultations ?? false;
export const selectSubBenefitConsultationsError   = (s) => s.booking.errors.fetchSubscriptionBenefitConsultations  ?? null;

export const selectSubConsultationQuota     = (s) => s.booking.subscriptionBenefitConsultations?.consultations       ?? null;
export const selectSubConsultationUsed      = (s) => s.booking.subscriptionBenefitConsultations?.consultations?.used ?? 0;
export const selectSubConsultationRemaining = (s) => s.booking.subscriptionBenefitConsultations?.consultations?.remaining ?? null;
export const selectSubConsultationModes     = (s) => s.booking.subscriptionBenefitConsultations?.consultations?.modes     ?? null;

export const selectSubBenefitCareAssistant        = (s) => s.booking.subscriptionBenefitCareAssistant;
export const selectSubBenefitCareAssistantLoading = (s) => s.booking.loading.fetchSubscriptionBenefitCareAssistant ?? false;
export const selectSubBenefitCareAssistantError   = (s) => s.booking.errors.fetchSubscriptionBenefitCareAssistant  ?? null;

export const selectSubCareAssistantQuota      = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant              ?? null;
export const selectSubCareAssistantUsed       = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant?.used        ?? 0;
export const selectSubCareAssistantRemaining  = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant?.remaining   ?? null;
export const selectSubCareAssistantAllTiers   = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant?.allTiers    ?? [];
export const selectSubCareAssistantActiveTier = (s) => s.booking.subscriptionBenefitCareAssistant?.careAssistant?.activeTier  ?? null;
export const selectSubCareAssistantIncluded   = (s) => s.booking.subscriptionBenefitCareAssistant?.included                   ?? false;

export const selectSubBenefitLabs              = (s) => s.booking.subscriptionBenefitLabs;
export const selectSubBenefitLabsLoading       = (s) => s.booking.loading.fetchSubscriptionBenefitLabs ?? false;
export const selectSubBenefitLabsError         = (s) => s.booking.errors.fetchSubscriptionBenefitLabs  ?? null;

export const selectSubLabsDiscountPercent      = (s) => s.booking.subscriptionBenefitLabs?.labs?.discountPercent         ?? 0;
export const selectSubLabsIncluded             = (s) => s.booking.subscriptionBenefitLabs?.included                      ?? false;
export const selectSubHomeCollectionIncluded   = (s) => s.booking.subscriptionBenefitLabs?.homeCollection?.included      ?? false;
export const selectSubHomeCollectionRemaining  = (s) => s.booking.subscriptionBenefitLabs?.homeCollection?.homeVisitsRemaining ?? null;
export const selectSubHomeCollectionUsed       = (s) => s.booking.subscriptionBenefitLabs?.homeCollection?.homeVisitsUsed     ?? 0;
export const selectSubHomeCollectionUnlimited  = (s) => s.booking.subscriptionBenefitLabs?.homeCollection?.homeVisitUnlimited ?? false;

// ── Booking creation ──────────────────────────────────────────────────────────

export const selectCreatedBooking            = (s) => s.booking.createdBooking;
export const selectCreateBookingData         = (s) => s.booking.createdBooking;
export const selectCreateBookingLoading      = (s) => s.booking.createBookingLoading;
export const selectCreateBookingError        = (s) => s.booking.createBookingError;
export const selectCreateBookingStatus       = (s) => s.booking.createBookingStatus;

export const selectCreatedRazorpayOrder      = (s) => s.booking.createdBooking?.razorpayOrder         ?? null;
export const selectCreatedMapRoutes          = (s) => s.booking.createdBooking?.mapRoutes             ?? null;
export const selectCreatedMapRoute           = (s) => s.booking.createdBooking?.mapRoute              ?? null;
export const selectCreatedFareBreakdown      = (s) => s.booking.createdBooking?.fareBreakdown         ?? null;
export const selectCreatedCareAssistant      = (s) => s.booking.createdBooking?.careAssistantAssigned ?? null;
export const selectCreatedOpNumber           = (s) => s.booking.createdBooking?.opNumber              ?? null;
export const selectCreatedRides              = (s) => s.booking.createdBooking?.rides                 ?? null;
export const selectCreatedBookingCode        = (s) => s.booking.createdBooking?.bookingCode           ?? null;
export const selectCreatedBookingId          = (s) => s.booking.createdBooking?.bookingId             ?? null;
export const selectCreatedSubCoverage        = (s) => s.booking.createdBooking?.subscriptionCoverage  ?? null;
export const selectCreatedTransportSummary   = (s) => s.booking.createdBooking?.transportSummary      ?? null;
export const selectCreatedDiagnosticDiscount = (s) => s.booking.createdBooking?.diagnosticDiscount    ?? null;
export const selectCreatedFollowUpDetails    = (s) => s.booking.createdBooking?.followUpDetails       ?? null;
export const selectCreatedConsultationSession = (s) => s.booking.createdBooking?.consultationSession  ?? null;
export const selectCreatedWalletSplit        = (s) => s.booking.createdBooking?.walletSplit           ?? null;

// ── My bookings ───────────────────────────────────────────────────────────────

export const selectMyBookings               = (s) => s.booking.myBookings;
export const selectMyBookingsMeta           = (s) => s.booking.myBookingsMeta;
export const selectMyBookingsLoading        = (s) => s.booking.loading.fetchMyBookings              ?? false;
export const selectMyBookingsError          = (s) => s.booking.errors.fetchMyBookings               ?? null;

export const selectSelectedBooking          = (s) => s.booking.selectedBooking;
export const selectActiveBooking            = (s) => s.booking.selectedBooking;
export const selectBookingMapRoute          = (s) => s.booking.selectedBooking?.mapRoute            ?? null;

export const selectMyBookingByIdLoading     = (s) => s.booking.loading.fetchMyBookingById           ?? false;
export const selectMyBookingByIdError       = (s) => s.booking.errors.fetchMyBookingById            ?? null;
export const selectActiveBookingLoading     = (s) => s.booking.loading.fetchMyBookingById           ?? false;
export const selectActiveBookingError       = (s) => s.booking.errors.fetchMyBookingById            ?? null;

export const selectCancelBooking            = (s) => s.booking.cancelBookingResult;
export const selectCancelBookingLoading     = (s) => s.booking.loading.cancelMyBooking              ?? false;
export const selectCancelBookingError       = (s) => s.booking.errors.cancelMyBooking               ?? null;

export const selectRateBooking              = (s) => s.booking.rateBookingResult;
export const selectRateBookingLoading       = (s) => s.booking.loading.rateMyBooking                ?? false;
export const selectRateBookingError         = (s) => s.booking.errors.rateMyBooking                 ?? null;

export const selectDownloadOpCardLoading    = (s) => s.booking.loading.downloadOpCard               ?? false;
export const selectDownloadOpCardError      = (s) => s.booking.errors.downloadOpCard                ?? null;

// ── Payment ───────────────────────────────────────────────────────────────────

export const selectVerifyPaymentResult       = (s) => s.booking.verifyPaymentResult;
export const selectVerifyPaymentLoading      = (s) => s.booking.loading.verifyRazorpayPayment       ?? false;
export const selectVerifyPaymentError        = (s) => s.booking.errors.verifyRazorpayPayment        ?? null;

export const selectConfirmCashPaymentResult  = (s) => s.booking.confirmCashPaymentResult;
export const selectConfirmCashPaymentLoading = (s) => s.booking.loading.confirmCashPayment          ?? false;
export const selectConfirmCashPaymentError   = (s) => s.booking.errors.confirmCashPayment           ?? null;

export const selectDeleteFailedBookingResult  = (s) => s.booking.deleteFailedBookingResult;
export const selectDeleteFailedBookingLoading = (s) => s.booking.loading.deleteFailedBooking        ?? false;
export const selectDeleteFailedBookingError   = (s) => s.booking.errors.deleteFailedBooking         ?? null;

// ── Generic factory selectors ─────────────────────────────────────────────────

export const selectLoading = (k) => (s) => s.booking.loading[k] ?? false;
export const selectError   = (k) => (s) => s.booking.errors[k]  ?? null;

// ─────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export { BOOKING_TYPES };

export default bookingSlice.reducer;