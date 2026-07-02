/**
 * hospitalManagerSlice.js
 * Redux Toolkit slice for the Hospital Manager role.
 * Covers every route defined in hospitalManagerRouter.js
 *
 * Base URL  : /api/hospital-manager   (configure API baseURL in ../api)
 * Auth      : Bearer token via API interceptor
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// §1  PROFILE
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/profile */
export const fetchHospitalProfile = createAsyncThunk(
  'hospitalManager/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/profile');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** PATCH /hospital-manager/profile/basic */
export const updateBasicProfile = createAsyncThunk(
  'hospitalManager/updateBasicProfile',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/hospital-manager/profile/basic', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** PATCH /hospital-manager/profile/location */
export const updateLocation = createAsyncThunk(
  'hospitalManager/updateLocation',
  async (payload, { rejectWithValue }) => {
    // payload: { lat, lng, address? }
    try {
      const { data } = await API.patch('/hospital-manager/profile/location', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §2  IMAGE & DOCUMENT UPLOADS
// ─────────────────────────────────────────────────────────────────────────────

/** POST /hospital-manager/upload/logo  (FormData: logo) */
export const uploadLogo = createAsyncThunk(
  'hospitalManager/uploadLogo',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/hospital-manager/upload/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** POST /hospital-manager/upload/images  (FormData: images, max 5) */
export const uploadGalleryImages = createAsyncThunk(
  'hospitalManager/uploadGalleryImages',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/hospital-manager/upload/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return { uploaded: data.uploaded, totalImages: data.totalImages };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** DELETE /hospital-manager/upload/images  Body: { imageUrl } */
export const deleteGalleryImage = createAsyncThunk(
  'hospitalManager/deleteGalleryImage',
  async (imageUrl, { rejectWithValue }) => {
    try {
      const { data } = await API.delete('/hospital-manager/upload/images', {
        data: { imageUrl },
      });
      return { imageUrl, remaining: data.remaining };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** POST /hospital-manager/upload/license-document  (FormData: document) */
export const uploadLicenseDocument = createAsyncThunk(
  'hospitalManager/uploadLicenseDocument',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/hospital-manager/upload/license-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §3  OPERATING HOURS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/operating-hours */
export const fetchOperatingHours = createAsyncThunk(
  'hospitalManager/fetchOperatingHours',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/operating-hours');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** PUT /hospital-manager/operating-hours  Body: { operatingHours, is24x7? } */
export const updateOperatingHours = createAsyncThunk(
  'hospitalManager/updateOperatingHours',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.put('/hospital-manager/operating-hours', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §4  HOSPITAL-WIDE CONSULTATION PRICING
// ─────────────────────────────────────────────────────────────────────────────
// BUG FIX: this used to call GET/PATCH /doctors/:doctorProfileId/pricing.
// Router deprecated those to 410 stubs — pricing for a hospital-manager
// hospital is NOT per-doctor, it's hospital-wide (Hospital.consultationPricing),
// applied to every linked doctor. Correct endpoints are GET/PATCH /pricing.

/** GET /hospital-manager/pricing */
export const fetchHospitalPricing = createAsyncThunk(
  'hospitalManager/fetchHospitalPricing',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/pricing');
      // { consultationPricing, platformFee, settlementCycle, note }
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** PATCH /hospital-manager/pricing */
export const updateHospitalPricing = createAsyncThunk(
  'hospitalManager/updateHospitalPricing',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/hospital-manager/pricing', payload);
      // returns consultationPricing only
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §4b  PLATFORM FEE (READ-ONLY)
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/platform-fee */
export const fetchPlatformFee = createAsyncThunk(
  'hospitalManager/fetchPlatformFee',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/platform-fee');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §5  DOCTOR MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /hospital-manager/doctors
 * params: { page?, limit?, search?, specialization?, isVerified? }
 */
export const fetchLinkedDoctors = createAsyncThunk(
  'hospitalManager/fetchLinkedDoctors',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/doctors', { params });
      return { doctors: data.data, pagination: data.pagination };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** GET /hospital-manager/doctors/:doctorProfileId */
export const fetchLinkedDoctorById = createAsyncThunk(
  'hospitalManager/fetchLinkedDoctorById',
  async (doctorProfileId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospital-manager/doctors/${doctorProfileId}`);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/**
 * GET /hospital-manager/doctors/search
 * params: { q?, specialization?, page?, limit? }
 */
export const searchUnlinkedDoctors = createAsyncThunk(
  'hospitalManager/searchUnlinkedDoctors',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/doctors/search', { params });
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** POST /hospital-manager/doctors/create-and-link */
export const createAndOnboardDoctor = createAsyncThunk(
  'hospitalManager/createAndOnboardDoctor',
  async (doctorData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/hospital-manager/doctors/create-and-link', doctorData);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to onboard doctor');
    }
  }
);

/** DELETE /hospital-manager/doctors/:doctorProfileId/unlink */
export const unlinkDoctor = createAsyncThunk(
  'hospitalManager/unlinkDoctor',
  async (doctorProfileId, { rejectWithValue }) => {
    try {
      await API.delete(`/hospital-manager/doctors/${doctorProfileId}/unlink`);
      return doctorProfileId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** GET /hospital-manager/doctors/:doctorProfileId/availability */
export const fetchDoctorAvailability = createAsyncThunk(
  'hospitalManager/fetchDoctorAvailability',
  async (doctorProfileId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospital-manager/doctors/${doctorProfileId}/availability`);
      return { doctorProfileId, availability: data.data, doctorName: data.doctor };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** GET /hospital-manager/doctors/stats */
export const fetchDoctorStats = createAsyncThunk(
  'hospitalManager/fetchDoctorStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/doctors/stats');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §6  REGISTRATION / LEGAL
// ─────────────────────────────────────────────────────────────────────────────

/** PATCH /hospital-manager/registration  Body: { licenseNumber?, gstNumber?, panNumber?, licenseExpiry? } */
export const updateRegistration = createAsyncThunk(
  'hospitalManager/updateRegistration',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/hospital-manager/registration', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §7  ONBOARDING
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/onboarding */
export const fetchOnboarding = createAsyncThunk(
  'hospitalManager/fetchOnboarding',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/onboarding');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §8  NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/notifications  params: { page?, limit?, unreadOnly? } */
export const fetchNotifications = createAsyncThunk(
  'hospitalManager/fetchNotifications',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/notifications', { params });
      return {
        notifications: data.data,
        unreadCount:   data.unreadCount,
        pagination:    data.pagination,
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** PATCH /hospital-manager/notifications/mark-read  Body: { notificationIds?: string[] } */
export const markNotificationsRead = createAsyncThunk(
  'hospitalManager/markNotificationsRead',
  async (notificationIds, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/hospital-manager/notifications/mark-read', {
        notificationIds: notificationIds ?? [],
      });
      return { notificationIds, modifiedCount: data.modifiedCount };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §9  SECURITY
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/security/sessions */
export const fetchSessions = createAsyncThunk(
  'hospitalManager/fetchSessions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/security/sessions');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** DELETE /hospital-manager/security/sessions/:sessionId */
export const revokeSession = createAsyncThunk(
  'hospitalManager/revokeSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      await API.delete(`/hospital-manager/security/sessions/${sessionId}`);
      return sessionId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** DELETE /hospital-manager/security/sessions  (revoke ALL other sessions) */
export const revokeAllOtherSessions = createAsyncThunk(
  'hospitalManager/revokeAllOtherSessions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.delete('/hospital-manager/security/sessions');
      return data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** GET /hospital-manager/security/device-tokens */
export const fetchDeviceTokens = createAsyncThunk(
  'hospitalManager/fetchDeviceTokens',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/security/device-tokens');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** DELETE /hospital-manager/security/device-tokens/:tokenId */
export const removeDeviceToken = createAsyncThunk(
  'hospitalManager/removeDeviceToken',
  async (tokenId, { rejectWithValue }) => {
    try {
      await API.delete(`/hospital-manager/security/device-tokens/${tokenId}`);
      return tokenId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** PATCH /hospital-manager/security/change-password */
export const changePassword = createAsyncThunk(
  'hospitalManager/changePassword',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/hospital-manager/security/change-password', payload);
      return data.message;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** PATCH /hospital-manager/security/notification-preferences */
export const updateNotificationPreferences = createAsyncThunk(
  'hospitalManager/updateNotificationPreferences',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        '/hospital-manager/security/notification-preferences',
        payload
      );
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §10  DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/dashboard */
export const fetchDashboard = createAsyncThunk(
  'hospitalManager/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/dashboard');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §11  ACCOUNT SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/settings/account */
export const fetchAccountSettings = createAsyncThunk(
  'hospitalManager/fetchAccountSettings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/settings/account');
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** PATCH /hospital-manager/settings/account */
export const updateAccountSettings = createAsyncThunk(
  'hospitalManager/updateAccountSettings',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/hospital-manager/settings/account', payload);
      return data.data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

/** POST /hospital-manager/settings/avatar */
export const uploadAvatar = createAsyncThunk(
  'hospitalManager/uploadAvatar',
  async (formData, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/hospital-manager/settings/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.url;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// §12  IMAGEKIT AUTH
// ─────────────────────────────────────────────────────────────────────────────

/** GET /hospital-manager/imagekit-auth */
export const fetchImageKitAuth = createAsyncThunk(
  'hospitalManager/fetchImageKitAuth',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospital-manager/imagekit-auth');
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
  // §1 Profile
  hospital: null,

  // §3 Operating hours
  operatingHours: null,

  // §4 Hospital-wide consultation pricing (renamed from doctor-scoped — see BUG FIX note above)
  hospitalPricing: null, // { consultationPricing, platformFee, settlementCycle, note }

  // §4b Platform Fee
  platformFee: null, // { platformFee: {type, value}, settlementCycle, note }

  // §5 Doctors
  linkedDoctors:      [],
  doctorsPagination:  {},
  selectedDoctor:     null,
  searchResults:      [],
  doctorStats:        null,
  doctorAvailability: null,

  // §7 Onboarding
  onboarding: null,

  // §8 Notifications
  notifications:           [],
  notificationsPagination: {},
  unreadCount:             0,

  // §9 Security
  sessions:     [],
  deviceTokens: [],
  notifPrefs:   null,

  // §10 Dashboard
  dashboard: null,

  // §11 Account
  account: null,

  // §12 ImageKit auth
  imagekitAuth: null,

  // Global async flags
  loading: {},   // keyed by thunk action type
  errors:  {},   // keyed by thunk action type
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const key = (action) => action.type.split('/')[1];

const setPending  = (state, action) => { state.loading[key(action)] = true;  delete state.errors[key(action)]; };
const setRejected = (state, action) => { state.loading[key(action)] = false; state.errors[key(action)] = action.payload; };
const clearLoad   = (state, action) => { state.loading[key(action)] = false; };

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const hospitalManagerSlice = createSlice({
  name: 'hospitalManager',
  initialState,

  reducers: {
    clearError(state, action) {
      delete state.errors[action.payload];
    },
    resetHospitalManagerState() {
      return initialState;
    },
  },

  extraReducers: (builder) => {

    // ── §1 Profile ──────────────────────────────────────────────────────────

    builder
      .addCase(fetchHospitalProfile.pending,   setPending)
      .addCase(fetchHospitalProfile.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchHospitalProfile.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.hospital = action.payload;
      });

    builder
      .addCase(updateBasicProfile.pending,   setPending)
      .addCase(updateBasicProfile.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(updateBasicProfile.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.hospital = action.payload;
        toast.success('Hospital profile updated.');
      });

    builder
      .addCase(updateLocation.pending,   setPending)
      .addCase(updateLocation.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(updateLocation.fulfilled, (state, action) => {
        clearLoad(state, action);
        if (state.hospital) {
          state.hospital.location = action.payload.location;
          state.hospital.address  = action.payload.address;
        }
        toast.success('Location updated.');
      });

    // ── §2 Uploads ──────────────────────────────────────────────────────────

    builder
      .addCase(uploadLogo.pending,   setPending)
      .addCase(uploadLogo.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(uploadLogo.fulfilled, (state, action) => {
        clearLoad(state, action);
        if (state.hospital) state.hospital.logo = action.payload;
        toast.success('Logo uploaded.');
      });

    builder
      .addCase(uploadGalleryImages.pending,   setPending)
      .addCase(uploadGalleryImages.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(uploadGalleryImages.fulfilled, (state, action) => {
        clearLoad(state, action);
        if (state.hospital) {
          state.hospital.images = [
            ...(state.hospital.images || []),
            ...action.payload.uploaded,
          ];
        }
        toast.success(`${action.payload.uploaded.length} image(s) uploaded.`);
      });

    builder
      .addCase(deleteGalleryImage.pending,   setPending)
      .addCase(deleteGalleryImage.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(deleteGalleryImage.fulfilled, (state, action) => {
        clearLoad(state, action);
        if (state.hospital?.images) {
          state.hospital.images = state.hospital.images.filter(
            (url) => url !== action.payload.imageUrl
          );
        }
        toast.success('Image removed.');
      });

    builder
      .addCase(uploadLicenseDocument.pending,   setPending)
      .addCase(uploadLicenseDocument.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(uploadLicenseDocument.fulfilled, (state, action) => {
        clearLoad(state, action);
        if (state.hospital?.registrationDetails) {
          state.hospital.registrationDetails.documentUrl = action.payload;
        }
        toast.success('License document uploaded.');
      });

    // ── §3 Operating Hours ──────────────────────────────────────────────────

    builder
      .addCase(fetchOperatingHours.pending,   setPending)
      .addCase(fetchOperatingHours.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchOperatingHours.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.operatingHours = action.payload;
      });

    builder
      .addCase(updateOperatingHours.pending,   setPending)
      .addCase(updateOperatingHours.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(updateOperatingHours.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.operatingHours = action.payload;
        toast.success('Operating hours updated.');
      });

    // ── §4 Hospital-wide Consultation Pricing ──────────────────────────────

    builder
      .addCase(fetchHospitalPricing.pending,   setPending)
      .addCase(fetchHospitalPricing.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchHospitalPricing.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.hospitalPricing = action.payload;
      });

    builder
      .addCase(updateHospitalPricing.pending,   setPending)
      .addCase(updateHospitalPricing.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(updateHospitalPricing.fulfilled, (state, action) => {
        clearLoad(state, action);
        // PATCH returns consultationPricing only — merge into existing pricing bundle,
        // leave platformFee/settlementCycle/note as last fetched.
        state.hospitalPricing = {
          ...(state.hospitalPricing || {}),
          consultationPricing: action.payload,
        };
        toast.success('Consultation pricing updated.');
      });

    // ── §4b Platform Fee ────────────────────────────────────────────────────

    builder
      .addCase(fetchPlatformFee.pending,   setPending)
      .addCase(fetchPlatformFee.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchPlatformFee.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.platformFee = action.payload;
      });

    // ── §5 Doctors ──────────────────────────────────────────────────────────

    builder
      .addCase(fetchLinkedDoctors.pending,   setPending)
      .addCase(fetchLinkedDoctors.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchLinkedDoctors.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.linkedDoctors     = action.payload.doctors;
        state.doctorsPagination = action.payload.pagination;
      });

    builder
      .addCase(fetchLinkedDoctorById.pending,   setPending)
      .addCase(fetchLinkedDoctorById.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchLinkedDoctorById.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.selectedDoctor = action.payload;
      });

    builder
      .addCase(searchUnlinkedDoctors.pending,   setPending)
      .addCase(searchUnlinkedDoctors.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(searchUnlinkedDoctors.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.searchResults = action.payload;
      });

    builder
      .addCase(createAndOnboardDoctor.pending, (state) => {
        state.loading['createAndOnboardDoctor'] = true;
        delete state.errors['createAndOnboardDoctor'];
      })
      .addCase(createAndOnboardDoctor.fulfilled, (state, action) => {
        state.loading['createAndOnboardDoctor'] = false;
        if (action.payload.doctor) {
          state.linkedDoctors.unshift(action.payload.doctor);
        }
        toast.success(action.payload.message || 'Doctor onboarded successfully');
      })
      .addCase(createAndOnboardDoctor.rejected, (state, action) => {
        state.loading['createAndOnboardDoctor'] = false;
        state.errors['createAndOnboardDoctor'] = action.payload;
        toast.error(action.payload || 'Failed to create doctor account');
      });

    builder
      .addCase(unlinkDoctor.pending,   setPending)
      .addCase(unlinkDoctor.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(unlinkDoctor.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.linkedDoctors = state.linkedDoctors.filter(
          (d) => d._id !== action.payload
        );
        toast.success('Doctor unlinked successfully.');
      });

    builder
      .addCase(fetchDoctorAvailability.pending,   setPending)
      .addCase(fetchDoctorAvailability.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchDoctorAvailability.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.doctorAvailability = action.payload;
      });

    builder
      .addCase(fetchDoctorStats.pending,   setPending)
      .addCase(fetchDoctorStats.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchDoctorStats.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.doctorStats = action.payload;
      });

    // ── §6 Registration ──────────────────────────────────────────────────────

    builder
      .addCase(updateRegistration.pending,   setPending)
      .addCase(updateRegistration.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(updateRegistration.fulfilled, (state, action) => {
        clearLoad(state, action);
        if (state.hospital) state.hospital.registrationDetails = action.payload;
        toast.success('Registration details updated.');
      });

    // ── §7 Onboarding ────────────────────────────────────────────────────────

    builder
      .addCase(fetchOnboarding.pending,   setPending)
      .addCase(fetchOnboarding.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchOnboarding.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.onboarding = action.payload;
      });

    // ── §8 Notifications ─────────────────────────────────────────────────────

    builder
      .addCase(fetchNotifications.pending,   setPending)
      .addCase(fetchNotifications.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.notifications           = action.payload.notifications;
        state.unreadCount             = action.payload.unreadCount;
        state.notificationsPagination = action.payload.pagination;
      });

    builder
      .addCase(markNotificationsRead.pending,   setPending)
      .addCase(markNotificationsRead.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(markNotificationsRead.fulfilled, (state, action) => {
        clearLoad(state, action);
        const ids = action.payload.notificationIds;
        state.notifications = state.notifications.map((n) => {
          if (!ids?.length || ids.includes(n._id)) {
            return { ...n, isRead: true };
          }
          return n;
        });
        state.unreadCount = state.notifications.filter((n) => !n.isRead).length;
      });

    // ── §9 Security ──────────────────────────────────────────────────────────

    builder
      .addCase(fetchSessions.pending,   setPending)
      .addCase(fetchSessions.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.sessions = action.payload;
      });

    builder
      .addCase(revokeSession.pending,   setPending)
      .addCase(revokeSession.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(revokeSession.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.sessions = state.sessions.filter((s) => s.id !== action.payload);
        toast.success('Session revoked.');
      });

    builder
      .addCase(revokeAllOtherSessions.pending,   setPending)
      .addCase(revokeAllOtherSessions.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(revokeAllOtherSessions.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.sessions = state.sessions.filter((s) => s.isCurrent);
        toast.success(action.payload);
      });

    builder
      .addCase(fetchDeviceTokens.pending,   setPending)
      .addCase(fetchDeviceTokens.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchDeviceTokens.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.deviceTokens = action.payload;
      });

    builder
      .addCase(removeDeviceToken.pending,   setPending)
      .addCase(removeDeviceToken.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(removeDeviceToken.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.deviceTokens = state.deviceTokens.filter((t) => t.id !== action.payload);
        toast.success('Device token removed.');
      });

    builder
      .addCase(changePassword.pending,   setPending)
      .addCase(changePassword.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(changePassword.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.sessions = state.sessions.filter((s) => s.isCurrent);
        toast.success(action.payload || 'Password changed. All other sessions logged out.');
      });

    builder
      .addCase(updateNotificationPreferences.pending,   setPending)
      .addCase(updateNotificationPreferences.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.notifPrefs = action.payload;
        toast.success('Notification preferences saved.');
      });

    // ── §10 Dashboard ────────────────────────────────────────────────────────

    builder
      .addCase(fetchDashboard.pending,   setPending)
      .addCase(fetchDashboard.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.dashboard   = action.payload;
        state.unreadCount = action.payload.unreadNotifications ?? state.unreadCount;
      });

    // ── §11 Account Settings ─────────────────────────────────────────────────

    builder
      .addCase(fetchAccountSettings.pending,   setPending)
      .addCase(fetchAccountSettings.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchAccountSettings.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.account = action.payload;
      });

    builder
      .addCase(updateAccountSettings.pending,   setPending)
      .addCase(updateAccountSettings.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(updateAccountSettings.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.account = { ...state.account, ...action.payload };
        toast.success('Account details updated.');
      });

    builder
      .addCase(uploadAvatar.pending,   setPending)
      .addCase(uploadAvatar.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(uploadAvatar.fulfilled, (state, action) => {
        clearLoad(state, action);
        if (state.account) state.account.avatar = action.payload;
        toast.success('Avatar updated.');
      });

    // ── §12 ImageKit Auth ────────────────────────────────────────────────────

    builder
      .addCase(fetchImageKitAuth.pending,   setPending)
      .addCase(fetchImageKitAuth.rejected,  (state, action) => {
        setRejected(state, action);
        toast.error(action.payload);
      })
      .addCase(fetchImageKitAuth.fulfilled, (state, action) => {
        clearLoad(state, action);
        state.imagekitAuth = action.payload;
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export const { clearError, resetHospitalManagerState } = hospitalManagerSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const isLoading  = (thunk) => (state) =>
  !!state.hospitalManager.loading[thunk.typePrefix.split('/')[1]];

export const getError   = (thunk) => (state) =>
  state.hospitalManager.errors[thunk.typePrefix.split('/')[1]] ?? null;

export const selectHospital       = (s) => s.hospitalManager.hospital;
export const selectOperatingHours = (s) => s.hospitalManager.operatingHours;

export const selectHospitalPricing            = (s) => s.hospitalManager.hospitalPricing;
export const selectHospitalConsultationPricing = (s) => s.hospitalManager.hospitalPricing?.consultationPricing ?? null;
export const selectHospitalPricingPlatformFee  = (s) => s.hospitalManager.hospitalPricing?.platformFee ?? null;
export const selectPlatformFee                 = (s) => s.hospitalManager.platformFee;

export const selectLinkedDoctors           = (s) => s.hospitalManager.linkedDoctors;
export const selectDoctorsPagination       = (s) => s.hospitalManager.doctorsPagination;
export const selectSelectedDoctor          = (s) => s.hospitalManager.selectedDoctor;
export const selectSearchResults           = (s) => s.hospitalManager.searchResults;
export const selectDoctorStats             = (s) => s.hospitalManager.doctorStats;
export const selectDoctorAvailability      = (s) => s.hospitalManager.doctorAvailability;
export const selectOnboarding              = (s) => s.hospitalManager.onboarding;
export const selectNotifications           = (s) => s.hospitalManager.notifications;
export const selectNotificationsPagination = (s) => s.hospitalManager.notificationsPagination;
export const selectUnreadCount             = (s) => s.hospitalManager.unreadCount;
export const selectSessions                = (s) => s.hospitalManager.sessions;
export const selectDeviceTokens            = (s) => s.hospitalManager.deviceTokens;
export const selectNotifPrefs              = (s) => s.hospitalManager.notifPrefs;
export const selectDashboard               = (s) => s.hospitalManager.dashboard;
export const selectDashboardBookings       = (s) => s.hospitalManager.dashboard?.bookings ?? null;
export const selectDashboardRevenue        = (s) => s.hospitalManager.dashboard?.revenue ?? null;
export const selectDashboardPlatformFee    = (s) => s.hospitalManager.dashboard?.platformFee ?? null;
export const selectAccount                 = (s) => s.hospitalManager.account;
export const selectImageKitAuth            = (s) => s.hospitalManager.imagekitAuth;

// ─────────────────────────────────────────────────────────────────────────────

export default hospitalManagerSlice.reducer;