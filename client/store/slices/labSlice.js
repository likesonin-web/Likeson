import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Build FormData from a plain object, appending File values directly */
const toFormData = (obj) => {
  const fd = new FormData();
  Object.entries(obj).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (value instanceof File || value instanceof Blob) {
      fd.append(key, value);
    } else if (typeof value === 'object' && !(value instanceof File)) {
      fd.append(key, JSON.stringify(value));
    } else {
      fd.append(key, value);
    }
  });
  return fd;
};

/** Reusable error extractor */
const extractError = (err) =>
  err.response?.data?.message || err.message || 'Something went wrong';

// ═══════════════════════════════════════════════════════════════════════════
//  PUBLIC THUNKS  —  GET /api/labs/public/*
// ═══════════════════════════════════════════════════════════════════════════

/** GET /api/labs/public  — browse approved labs */
export const fetchPublicLabs = createAsyncThunk(
  'labs/fetchPublicLabs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/public', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/public/search — Unified public lab + test search */
export const searchPublicLabs = createAsyncThunk(
  'labs/searchPublicLabs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/public/search', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/public/featured */
export const fetchFeaturedLabs = createAsyncThunk(
  'labs/fetchFeaturedLabs',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/public/featured');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/public/:id */
export const fetchPublicLabById = createAsyncThunk(
  'labs/fetchPublicLabById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/labs/public/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/public/:id/tests */
export const fetchPublicLabTests = createAsyncThunk(
  'labs/fetchPublicLabTests',
  async ({ id, params = {} }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/labs/public/${id}/tests`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/public/:id/packages */
export const fetchPublicLabPackages = createAsyncThunk(
  'labs/fetchPublicLabPackages',
  async ({ id, params = {} }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/labs/public/${id}/packages`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/public/:id/reviews */
export const fetchPublicLabReviews = createAsyncThunk(
  'labs/fetchPublicLabReviews',
  async ({ id, params = {} }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/labs/public/${id}/reviews`, { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);


// ═══════════════════════════════════════════════════════════════════════════
//  LAB PARTNER THUNKS  —  /api/labs/partner/me/*
// ═══════════════════════════════════════════════════════════════════════════

// ── Profile ──────────────────────────────────────────────────────────────

/** GET /api/labs/partner/me */
export const fetchPartnerProfile = createAsyncThunk(
  'labs/fetchPartnerProfile',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me  — supports logo / coverImage file uploads */
export const updatePartnerProfile = createAsyncThunk(
  'labs/updatePartnerProfile',
  async (payload, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.patch('/labs/partner/me', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Profile updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/bank-details */
export const updatePartnerBankDetails = createAsyncThunk(
  'labs/updatePartnerBankDetails',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/bank-details', payload);
      toast.success(data.message || 'Bank details updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Tests ─────────────────────────────────────────────────────────────────

/** GET /api/labs/partner/me/tests */
export const fetchPartnerTests = createAsyncThunk(
  'labs/fetchPartnerTests',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/tests', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/partner/me/tests */
export const addPartnerTest = createAsyncThunk(
  'labs/addPartnerTest',
  async (payload, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.post('/labs/partner/me/tests', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Test added.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/tests/:testId */
export const updatePartnerTest = createAsyncThunk(
  'labs/updatePartnerTest',
  async ({ testId, ...payload }, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.patch(`/labs/partner/me/tests/${testId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Test updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/partner/me/tests/:testId  (soft deactivate) */
export const deletePartnerTest = createAsyncThunk(
  'labs/deletePartnerTest',
  async (testId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/labs/partner/me/tests/${testId}`);
      toast.success(data.message || 'Test deactivated.');
      return { testId, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Packages ──────────────────────────────────────────────────────────────

/** GET /api/labs/partner/me/packages */
export const fetchPartnerPackages = createAsyncThunk(
  'labs/fetchPartnerPackages',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/packages', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/partner/me/packages */
export const addPartnerPackage = createAsyncThunk(
  'labs/addPartnerPackage',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/labs/partner/me/packages', payload);
      toast.success(data.message || 'Package added.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/packages/:pkgId */
export const updatePartnerPackage = createAsyncThunk(
  'labs/updatePartnerPackage',
  async ({ pkgId, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/labs/partner/me/packages/${pkgId}`, payload);
      toast.success(data.message || 'Package updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/partner/me/packages/:pkgId */
export const deletePartnerPackage = createAsyncThunk(
  'labs/deletePartnerPackage',
  async (pkgId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/labs/partner/me/packages/${pkgId}`);
      toast.success(data.message || 'Package deactivated.');
      return { pkgId, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Accreditations & Compliance ───────────────────────────────────────────

/** GET /api/labs/partner/me/accreditations */
export const fetchPartnerAccreditations = createAsyncThunk(
  'labs/fetchPartnerAccreditations',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/accreditations');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/partner/me/accreditations */
export const addPartnerAccreditation = createAsyncThunk(
  'labs/addPartnerAccreditation',
  async (payload, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.post('/labs/partner/me/accreditations', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Accreditation submitted.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/partner/me/compliance-docs */
export const addPartnerComplianceDoc = createAsyncThunk(
  'labs/addPartnerComplianceDoc',
  async (payload, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.post('/labs/partner/me/compliance-docs', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Compliance doc submitted.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Status & Reviews ──────────────────────────────────────────────────────

/** GET /api/labs/partner/me/status-log */
export const fetchPartnerStatusLog = createAsyncThunk(
  'labs/fetchPartnerStatusLog',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/status-log');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/partner/me/reviews */
export const fetchPartnerReviews = createAsyncThunk(
  'labs/fetchPartnerReviews',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/reviews');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Settings ──────────────────────────────────────────────────────────────

/** GET /api/labs/partner/me/settings */
export const fetchPartnerSettings = createAsyncThunk(
  'labs/fetchPartnerSettings',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/settings');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/settings/operational */
export const updatePartnerOperationalSettings = createAsyncThunk(
  'labs/updatePartnerOperationalSettings',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/settings/operational', payload);
      toast.success(data.message || 'Operational settings updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/settings/display */
export const updatePartnerDisplaySettings = createAsyncThunk(
  'labs/updatePartnerDisplaySettings',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/settings/display', payload);
      toast.success(data.message || 'Display settings updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/settings/notifications */
export const updatePartnerNotificationPreferences = createAsyncThunk(
  'labs/updatePartnerNotificationPreferences',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/settings/notifications', payload);
      toast.success(data.message || 'Notification preferences updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/settings/contact-persons */
export const updatePartnerContactPersons = createAsyncThunk(
  'labs/updatePartnerContactPersons',
  async (contactPersons, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/settings/contact-persons', {
        contactPersons: JSON.stringify(contactPersons),
      });
      toast.success(data.message || 'Contact persons updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/settings/timing */
export const updatePartnerTiming = createAsyncThunk(
  'labs/updatePartnerTiming',
  async (timing, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/settings/timing', {
        timing: JSON.stringify(timing),
      });
      toast.success(data.message || 'Timing updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/settings/images */
export const updatePartnerImages = createAsyncThunk(
  'labs/updatePartnerImages',
  async (payload, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.patch('/labs/partner/me/settings/images', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Images updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Security ──────────────────────────────────────────────────────────────

/** PATCH /api/labs/partner/me/change-password */
export const changePartnerPassword = createAsyncThunk(
  'labs/changePartnerPassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success(data.message || 'Password changed.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/partner/me/security/request-email-change */
export const requestPartnerEmailChange = createAsyncThunk(
  'labs/requestPartnerEmailChange',
  async (newEmail, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/labs/partner/me/security/request-email-change', { newEmail });
      toast.success(data.message || 'OTP sent to your current email.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/security/confirm-email-change */
export const confirmPartnerEmailChange = createAsyncThunk(
  'labs/confirmPartnerEmailChange',
  async ({ newEmail, otp }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/security/confirm-email-change', {
        newEmail,
        otp,
      });
      toast.success(data.message || 'Email changed successfully.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/partner/me/security/sessions */
export const fetchPartnerSessions = createAsyncThunk(
  'labs/fetchPartnerSessions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/security/sessions');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/partner/me/security/sessions/:sessionId */
export const revokePartnerSession = createAsyncThunk(
  'labs/revokePartnerSession',
  async (sessionId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/labs/partner/me/security/sessions/${sessionId}`);
      toast.success(data.message || 'Session revoked.');
      return { sessionId, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/partner/me/security/sessions  (revoke all others) */
export const revokeAllPartnerSessions = createAsyncThunk(
  'labs/revokeAllPartnerSessions',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.delete('/labs/partner/me/security/sessions');
      toast.success(data.message || 'All other sessions revoked.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/partner/me/security/login-history */
export const fetchPartnerLoginHistory = createAsyncThunk(
  'labs/fetchPartnerLoginHistory',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/security/login-history');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/partner/me/security/send-verification-otp */
export const sendPartnerVerificationOtp = createAsyncThunk(
  'labs/sendPartnerVerificationOtp',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/labs/partner/me/security/send-verification-otp');
      toast.success(data.message || 'OTP sent.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/partner/me/security/verify-email */
export const verifyPartnerEmail = createAsyncThunk(
  'labs/verifyPartnerEmail',
  async (otp, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/labs/partner/me/security/verify-email', { otp });
      toast.success(data.message || 'Email verified.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Notifications (Lab Partner) ───────────────────────────────────────────

/** GET /api/labs/partner/me/notifications */
export const fetchPartnerNotifications = createAsyncThunk(
  'labs/fetchPartnerNotifications',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/notifications', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/notifications/:notificationId/read */
export const markPartnerNotificationRead = createAsyncThunk(
  'labs/markPartnerNotificationRead',
  async (notificationId, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/labs/partner/me/notifications/${notificationId}/read`
      );
      return { notificationId, ...data };
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/partner/me/notifications/read-all */
export const markAllPartnerNotificationsRead = createAsyncThunk(
  'labs/markAllPartnerNotificationsRead',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.patch('/labs/partner/me/notifications/read-all');
      toast.success(data.message || 'All notifications marked as read.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/partner/me/notifications/:notificationId */
export const deletePartnerNotification = createAsyncThunk(
  'labs/deletePartnerNotification',
  async (notificationId, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(
        `/labs/partner/me/notifications/${notificationId}`
      );
      toast.success(data.message || 'Notification deleted.');
      return { notificationId, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/partner/me/notifications  (?readOnly=true) */
export const clearPartnerNotifications = createAsyncThunk(
  'labs/clearPartnerNotifications',
  async (readOnly = false, { rejectWithValue }) => {
    try {
      const { data } = await API.delete('/labs/partner/me/notifications', {
        params: readOnly ? { readOnly: 'true' } : {},
      });
      toast.success(data.message || 'Notifications cleared.');
      return { readOnly, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Dashboard & Analytics (Lab Partner) ──────────────────────────────────

/** GET /api/labs/partner/me/dashboard */
export const fetchPartnerDashboard = createAsyncThunk(
  'labs/fetchPartnerDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/dashboard');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/partner/me/analytics/reviews */
export const fetchPartnerReviewAnalytics = createAsyncThunk(
  'labs/fetchPartnerReviewAnalytics',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/partner/me/analytics/reviews');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN THUNKS  —  /api/labs/admin/*
// ═══════════════════════════════════════════════════════════════════════════

// ── Lab CRUD ──────────────────────────────────────────────────────────────

/** POST /api/labs/admin  — create lab + user in one shot */
export const adminCreateLab = createAsyncThunk(
  'labs/adminCreateLab',
  async (payload, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.post('/labs/admin', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Lab created successfully.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/admin */
export const adminFetchLabs = createAsyncThunk(
  'labs/adminFetchLabs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/admin', { params });
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/admin/:id */
export const adminFetchLabById = createAsyncThunk(
  'labs/adminFetchLabById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/labs/admin/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/admin/:id */
export const adminUpdateLab = createAsyncThunk(
  'labs/adminUpdateLab',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.patch(`/labs/admin/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Lab updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/admin/:id/status */
export const adminChangeLabStatus = createAsyncThunk(
  'labs/adminChangeLabStatus',
  async ({ id, action, reason }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/labs/admin/${id}/status`, { action, reason });
      toast.success(data.message || `Lab ${action}d.`);
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Platform Fee ──────────────────────────────────────────────────────────

/** PATCH /api/labs/admin/:id/platform-fee */
export const adminSetLabPlatformFee = createAsyncThunk(
  'labs/adminSetLabPlatformFee',
  async ({ id, type, value }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/labs/admin/${id}/platform-fee`, { type, value });
      toast.success(data.message || 'Platform fee set.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/admin/:id/platform-fee */
export const adminRemoveLabPlatformFee = createAsyncThunk(
  'labs/adminRemoveLabPlatformFee',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/labs/admin/${id}/platform-fee`);
      toast.success(data.message || 'Platform fee override removed.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Admin Tests ───────────────────────────────────────────────────────────

/** POST /api/labs/admin/:id/tests */
export const adminAddLabTest = createAsyncThunk(
  'labs/adminAddLabTest',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.post(`/labs/admin/${id}/tests`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Test added.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/admin/:id/tests/:testId */
export const adminUpdateLabTest = createAsyncThunk(
  'labs/adminUpdateLabTest',
  async ({ id, testId, ...payload }, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.patch(`/labs/admin/${id}/tests/${testId}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Test updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/admin/:id/tests/:testId */
export const adminDeleteLabTest = createAsyncThunk(
  'labs/adminDeleteLabTest',
  async ({ id, testId }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/labs/admin/${id}/tests/${testId}`);
      toast.success(data.message || 'Test deactivated.');
      return { testId, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Admin Packages ────────────────────────────────────────────────────────

/** POST /api/labs/admin/:id/packages */
export const adminAddLabPackage = createAsyncThunk(
  'labs/adminAddLabPackage',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/labs/admin/${id}/packages`, payload);
      toast.success(data.message || 'Package added.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/admin/:id/packages/:pkgId */
export const adminUpdateLabPackage = createAsyncThunk(
  'labs/adminUpdateLabPackage',
  async ({ id, pkgId, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/labs/admin/${id}/packages/${pkgId}`, payload);
      toast.success(data.message || 'Package updated.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/admin/:id/packages/:pkgId */
export const adminDeleteLabPackage = createAsyncThunk(
  'labs/adminDeleteLabPackage',
  async ({ id, pkgId }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/labs/admin/${id}/packages/${pkgId}`);
      toast.success(data.message || 'Package deactivated.');
      return { pkgId, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Admin Accreditations ──────────────────────────────────────────────────

/** POST /api/labs/admin/:id/accreditations */
export const adminAddLabAccreditation = createAsyncThunk(
  'labs/adminAddLabAccreditation',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.post(`/labs/admin/${id}/accreditations`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Accreditation added.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Admin Compliance Docs ─────────────────────────────────────────────────

/** POST /api/labs/admin/:id/compliance-docs */
export const adminAddLabComplianceDoc = createAsyncThunk(
  'labs/adminAddLabComplianceDoc',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const fd = toFormData(payload);
      const { data } = await API.post(`/labs/admin/${id}/compliance-docs`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(data.message || 'Compliance doc added.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/admin/:id/verify-doc/:docId */
export const adminVerifyLabDoc = createAsyncThunk(
  'labs/adminVerifyLabDoc',
  async ({ id, docId, docCollection }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/labs/admin/${id}/verify-doc/${docId}`, { docCollection });
      toast.success(data.message || 'Document verified.');
      return { docId, docCollection, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/admin/:id/verify-bank */
export const adminVerifyLabBank = createAsyncThunk(
  'labs/adminVerifyLabBank',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/labs/admin/${id}/verify-bank`);
      toast.success(data.message || 'Bank details verified.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Admin Reviews ─────────────────────────────────────────────────────────

/** GET /api/labs/admin/:id/reviews */
export const adminFetchLabReviews = createAsyncThunk(
  'labs/adminFetchLabReviews',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/labs/admin/${id}/reviews`);
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

/** PATCH /api/labs/admin/:id/reviews/:reviewId  — toggle visibility */
export const adminToggleReviewVisibility = createAsyncThunk(
  'labs/adminToggleReviewVisibility',
  async ({ id, reviewId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/labs/admin/${id}/reviews/${reviewId}`);
      toast.success(data.message || 'Review visibility toggled.');
      return { reviewId, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** DELETE /api/labs/admin/:id/reviews/:reviewId */
export const adminDeleteLabReview = createAsyncThunk(
  'labs/adminDeleteLabReview',
  async ({ id, reviewId }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/labs/admin/${id}/reviews/${reviewId}`);
      toast.success(data.message || 'Review deleted.');
      return { reviewId, ...data };
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

// ── Admin Misc ────────────────────────────────────────────────────────────

/** PATCH /api/labs/admin/:id/resend-credentials  (superadmin only) */
export const adminResendLabCredentials = createAsyncThunk(
  'labs/adminResendLabCredentials',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/labs/admin/${id}/resend-credentials`);
      toast.success(data.message || 'Credentials re-sent.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** POST /api/labs/admin/:id/send-notification */
export const adminSendLabNotification = createAsyncThunk(
  'labs/adminSendLabNotification',
  async ({ id, ...payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/labs/admin/${id}/send-notification`, payload);
      toast.success(data.message || 'Notification sent.');
      return data;
    } catch (err) {
      toast.error(extractError(err));
      return rejectWithValue(extractError(err));
    }
  }
);

/** GET /api/labs/admin/stats/overview */
export const adminFetchLabStats = createAsyncThunk(
  'labs/adminFetchLabStats',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/labs/admin/stats/overview');
      return data;
    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
//  INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── Public / Customer ──────────────────────────────────────────────────
  publicLabs: [],
  featuredLabs: [],
  publicPagination: {},
  selectedLab: null,          // single lab detail (public view)
  publicTests: [],
  publicPackages: [],
  publicReviews: [],
  reviewsPagination: {},
  publicSearchResults: [],    // Replaces customer search

  // ── Lab Partner ────────────────────────────────────────────────────────
  partnerProfile: null,
  partnerTests: [],
  partnerPackages: [],
  partnerAccreditations: [],
  partnerComplianceDocs: [],
  partnerStatusLog: [],
  partnerReviews: [],
  partnerSettings: null,
  partnerSessions: [],
  partnerLoginHistory: null,
  partnerNotifications: [],
  partnerNotificationsPagination: {},
  partnerUnreadCount: 0,
  partnerDashboard: null,
  partnerReviewAnalytics: null,

  // ── Admin ──────────────────────────────────────────────────────────────
  adminLabs: [],
  adminPagination: {},
  adminSelectedLab: null,
  adminStats: null,
  adminReviews: [],

  // ── Global UI ──────────────────────────────────────────────────────────
  loading: false,
  actionLoading: false,   // spinner for mutating operations
  error: null,
};

// ═══════════════════════════════════════════════════════════════════════════
//  HELPERS — reducer builder shorthands
// ═══════════════════════════════════════════════════════════════════════════

/** Generic pending handler — shows full-page loading */
const pending = (state) => {
  state.loading = true;
  state.error   = null;
};

/** Generic pending handler for mutations — shows action spinner */
const actionPending = (state) => {
  state.actionLoading = true;
  state.error         = null;
};

/** Generic rejected handler */
const rejected = (state, { payload }) => {
  state.loading       = false;
  state.actionLoading = false;
  state.error         = payload;
};

// ═══════════════════════════════════════════════════════════════════════════
//  SLICE
// ═══════════════════════════════════════════════════════════════════════════

const labSlice = createSlice({
  name: 'labs',
  initialState,
  reducers: {
    clearLabError:    (state) => { state.error = null; },
    clearSelectedLab: (state) => { state.selectedLab = null; },
    clearAdminSelectedLab: (state) => { state.adminSelectedLab = null; },
    resetLabState:    () => initialState,
  },
  extraReducers: (builder) => {

    // ── PUBLIC ─────────────────────────────────────────────────────────

    builder
      .addCase(fetchPublicLabs.pending,  pending)
      .addCase(fetchPublicLabs.rejected, rejected)
      .addCase(fetchPublicLabs.fulfilled, (state, { payload }) => {
        state.loading        = false;
        state.publicLabs     = payload.data;
        state.publicPagination = payload.pagination;
      });
      
    builder
      .addCase(searchPublicLabs.pending, pending)
      .addCase(searchPublicLabs.rejected, rejected)
      .addCase(searchPublicLabs.fulfilled, (state, { payload }) => {
        state.loading = false;
        state.publicSearchResults = payload.data;
      });

    builder
      .addCase(fetchFeaturedLabs.pending,  pending)
      .addCase(fetchFeaturedLabs.rejected, rejected)
      .addCase(fetchFeaturedLabs.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.featuredLabs = payload.data;
      });

    builder
      .addCase(fetchPublicLabById.pending,  pending)
      .addCase(fetchPublicLabById.rejected, rejected)
      .addCase(fetchPublicLabById.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.selectedLab = payload.data;
      });

    builder
      .addCase(fetchPublicLabTests.pending,  pending)
      .addCase(fetchPublicLabTests.rejected, rejected)
      .addCase(fetchPublicLabTests.fulfilled, (state, { payload }) => {
        state.loading      = false;
        state.publicTests  = payload.data;
      });

    builder
      .addCase(fetchPublicLabPackages.pending,  pending)
      .addCase(fetchPublicLabPackages.rejected, rejected)
      .addCase(fetchPublicLabPackages.fulfilled, (state, { payload }) => {
        state.loading         = false;
        state.publicPackages  = payload.data;
      });

    builder
      .addCase(fetchPublicLabReviews.pending,  pending)
      .addCase(fetchPublicLabReviews.rejected, rejected)
      .addCase(fetchPublicLabReviews.fulfilled, (state, { payload }) => {
        state.loading            = false;
        state.publicReviews      = payload.data;
        state.reviewsPagination  = payload.pagination;
      });


    // ── PARTNER — PROFILE ──────────────────────────────────────────────

    builder
      .addCase(fetchPartnerProfile.pending,  pending)
      .addCase(fetchPartnerProfile.rejected, rejected)
      .addCase(fetchPartnerProfile.fulfilled, (state, { payload }) => {
        state.loading        = false;
        state.partnerProfile = payload.data;
      });

    builder
      .addCase(updatePartnerProfile.pending,  actionPending)
      .addCase(updatePartnerProfile.rejected, rejected)
      .addCase(updatePartnerProfile.fulfilled, (state, { payload }) => {
        state.actionLoading  = false;
        state.partnerProfile = payload.data;
      });

    builder
      .addCase(updatePartnerBankDetails.pending,  actionPending)
      .addCase(updatePartnerBankDetails.rejected, rejected)
      .addCase(updatePartnerBankDetails.fulfilled, (state) => {
        state.actionLoading = false;
      });

    // ── PARTNER — TESTS ────────────────────────────────────────────────

    builder
      .addCase(fetchPartnerTests.pending,  pending)
      .addCase(fetchPartnerTests.rejected, rejected)
      .addCase(fetchPartnerTests.fulfilled, (state, { payload }) => {
        state.loading       = false;
        state.partnerTests  = payload.data;
      });

    builder
      .addCase(addPartnerTest.pending,  actionPending)
      .addCase(addPartnerTest.rejected, rejected)
      .addCase(addPartnerTest.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload.data) state.partnerTests.push(payload.data);
      });

    builder
      .addCase(updatePartnerTest.pending,  actionPending)
      .addCase(updatePartnerTest.rejected, rejected)
      .addCase(updatePartnerTest.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const idx = state.partnerTests.findIndex((t) => t._id === payload.data?._id);
        if (idx !== -1) state.partnerTests[idx] = payload.data;
      });

    builder
      .addCase(deletePartnerTest.pending,  actionPending)
      .addCase(deletePartnerTest.rejected, rejected)
      .addCase(deletePartnerTest.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.partnerTests = state.partnerTests.map((t) =>
          t._id === payload.testId ? { ...t, isActive: false } : t
        );
      });

    // ── PARTNER — PACKAGES ─────────────────────────────────────────────

    builder
      .addCase(fetchPartnerPackages.pending,  pending)
      .addCase(fetchPartnerPackages.rejected, rejected)
      .addCase(fetchPartnerPackages.fulfilled, (state, { payload }) => {
        state.loading          = false;
        state.partnerPackages  = payload.data;
      });

    builder
      .addCase(addPartnerPackage.pending,  actionPending)
      .addCase(addPartnerPackage.rejected, rejected)
      .addCase(addPartnerPackage.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload.data) state.partnerPackages.push(payload.data);
      });

    builder
      .addCase(updatePartnerPackage.pending,  actionPending)
      .addCase(updatePartnerPackage.rejected, rejected)
      .addCase(updatePartnerPackage.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const idx = state.partnerPackages.findIndex((p) => p._id === payload.data?._id);
        if (idx !== -1) state.partnerPackages[idx] = payload.data;
      });

    builder
      .addCase(deletePartnerPackage.pending,  actionPending)
      .addCase(deletePartnerPackage.rejected, rejected)
      .addCase(deletePartnerPackage.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.partnerPackages = state.partnerPackages.map((p) =>
          p._id === payload.pkgId ? { ...p, isActive: false } : p
        );
      });

    // ── PARTNER — ACCREDITATIONS & COMPLIANCE ─────────────────────────

    builder
      .addCase(fetchPartnerAccreditations.pending,  pending)
      .addCase(fetchPartnerAccreditations.rejected, rejected)
      .addCase(fetchPartnerAccreditations.fulfilled, (state, { payload }) => {
        state.loading                = false;
        state.partnerAccreditations  = payload.accreditations;
        state.partnerComplianceDocs  = payload.complianceDocs;
      });

    builder
      .addCase(addPartnerAccreditation.pending,  actionPending)
      .addCase(addPartnerAccreditation.rejected, rejected)
      .addCase(addPartnerAccreditation.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload.data) state.partnerAccreditations.push(payload.data);
      });

    builder
      .addCase(addPartnerComplianceDoc.pending,  actionPending)
      .addCase(addPartnerComplianceDoc.rejected, rejected)
      .addCase(addPartnerComplianceDoc.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload.data) state.partnerComplianceDocs.push(payload.data);
      });

    // ── PARTNER — STATUS & REVIEWS ─────────────────────────────────────

    builder
      .addCase(fetchPartnerStatusLog.pending,  pending)
      .addCase(fetchPartnerStatusLog.rejected, rejected)
      .addCase(fetchPartnerStatusLog.fulfilled, (state, { payload }) => {
        state.loading           = false;
        state.partnerStatusLog  = payload.statusLog;
      });

    builder
      .addCase(fetchPartnerReviews.pending,  pending)
      .addCase(fetchPartnerReviews.rejected, rejected)
      .addCase(fetchPartnerReviews.fulfilled, (state, { payload }) => {
        state.loading         = false;
        state.partnerReviews  = payload.data;
      });

    // ── PARTNER — SETTINGS ─────────────────────────────────────────────

    builder
      .addCase(fetchPartnerSettings.pending,  pending)
      .addCase(fetchPartnerSettings.rejected, rejected)
      .addCase(fetchPartnerSettings.fulfilled, (state, { payload }) => {
        state.loading          = false;
        state.partnerSettings  = payload.data;
      });

    [
      updatePartnerOperationalSettings,
      updatePartnerDisplaySettings,
      updatePartnerNotificationPreferences,
      updatePartnerContactPersons,
      updatePartnerTiming,
      updatePartnerImages,
    ].forEach((thunk) => {
      builder
        .addCase(thunk.pending,  actionPending)
        .addCase(thunk.rejected, rejected)
        .addCase(thunk.fulfilled, (state, { payload }) => {
          state.actionLoading = false;
          // Merge returned data into settings
          if (state.partnerSettings && payload.data) {
            state.partnerSettings = { ...state.partnerSettings, ...payload.data };
          }
        });
    });

    // ── PARTNER — SECURITY ─────────────────────────────────────────────

    builder
      .addCase(changePartnerPassword.pending,  actionPending)
      .addCase(changePartnerPassword.rejected, rejected)
      .addCase(changePartnerPassword.fulfilled, (state) => {
        state.actionLoading = false;
      });

    builder
      .addCase(requestPartnerEmailChange.pending,  actionPending)
      .addCase(requestPartnerEmailChange.rejected, rejected)
      .addCase(requestPartnerEmailChange.fulfilled, (state) => {
        state.actionLoading = false;
      });

    builder
      .addCase(confirmPartnerEmailChange.pending,  actionPending)
      .addCase(confirmPartnerEmailChange.rejected, rejected)
      .addCase(confirmPartnerEmailChange.fulfilled, (state) => {
        state.actionLoading = false;
      });

    builder
      .addCase(fetchPartnerSessions.pending,  pending)
      .addCase(fetchPartnerSessions.rejected, rejected)
      .addCase(fetchPartnerSessions.fulfilled, (state, { payload }) => {
        state.loading          = false;
        state.partnerSessions  = payload.data;
      });

    builder
      .addCase(revokePartnerSession.pending,  actionPending)
      .addCase(revokePartnerSession.rejected, rejected)
      .addCase(revokePartnerSession.fulfilled, (state, { payload }) => {
        state.actionLoading   = false;
        state.partnerSessions = state.partnerSessions.filter(
          (s) => s._id !== payload.sessionId
        );
      });

    builder
      .addCase(revokeAllPartnerSessions.pending,  actionPending)
      .addCase(revokeAllPartnerSessions.rejected, rejected)
      .addCase(revokeAllPartnerSessions.fulfilled, (state) => {
        state.actionLoading = false;
        // Keep only current session; the server did the filtering
        state.partnerSessions = state.partnerSessions.slice(0, 1);
      });

    builder
      .addCase(fetchPartnerLoginHistory.pending,  pending)
      .addCase(fetchPartnerLoginHistory.rejected, rejected)
      .addCase(fetchPartnerLoginHistory.fulfilled, (state, { payload }) => {
        state.loading              = false;
        state.partnerLoginHistory  = payload.data;
      });

    builder
      .addCase(sendPartnerVerificationOtp.pending,  actionPending)
      .addCase(sendPartnerVerificationOtp.rejected, rejected)
      .addCase(sendPartnerVerificationOtp.fulfilled, (state) => {
        state.actionLoading = false;
      });

    builder
      .addCase(verifyPartnerEmail.pending,  actionPending)
      .addCase(verifyPartnerEmail.rejected, rejected)
      .addCase(verifyPartnerEmail.fulfilled, (state) => {
        state.actionLoading = false;
        if (state.partnerProfile?.user) {
          state.partnerProfile.user.isEmailVerified = true;
        }
      });

    // ── PARTNER — NOTIFICATIONS ────────────────────────────────────────

    builder
      .addCase(fetchPartnerNotifications.pending,  pending)
      .addCase(fetchPartnerNotifications.rejected, rejected)
      .addCase(fetchPartnerNotifications.fulfilled, (state, { payload }) => {
        state.loading                        = false;
        state.partnerNotifications           = payload.data;
        state.partnerNotificationsPagination = payload.pagination;
        state.partnerUnreadCount             = payload.unreadCount;
      });

    builder
      .addCase(markPartnerNotificationRead.pending,  actionPending)
      .addCase(markPartnerNotificationRead.rejected, rejected)
      .addCase(markPartnerNotificationRead.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        const n = state.partnerNotifications.find((n) => n._id === payload.notificationId);
        if (n && !n.isRead) {
          n.isRead = true;
          state.partnerUnreadCount = Math.max(0, state.partnerUnreadCount - 1);
        }
      });

    builder
      .addCase(markAllPartnerNotificationsRead.pending,  actionPending)
      .addCase(markAllPartnerNotificationsRead.rejected, rejected)
      .addCase(markAllPartnerNotificationsRead.fulfilled, (state) => {
        state.actionLoading = false;
        state.partnerNotifications = state.partnerNotifications.map((n) => ({
          ...n,
          isRead: true,
        }));
        state.partnerUnreadCount = 0;
      });

    builder
      .addCase(deletePartnerNotification.pending,  actionPending)
      .addCase(deletePartnerNotification.rejected, rejected)
      .addCase(deletePartnerNotification.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.partnerNotifications = state.partnerNotifications.filter(
          (n) => n._id !== payload.notificationId
        );
      });

    builder
      .addCase(clearPartnerNotifications.pending,  actionPending)
      .addCase(clearPartnerNotifications.rejected, rejected)
      .addCase(clearPartnerNotifications.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload.readOnly) {
          state.partnerNotifications = state.partnerNotifications.filter((n) => !n.isRead);
        } else {
          state.partnerNotifications = [];
          state.partnerUnreadCount   = 0;
        }
      });

    // ── PARTNER — DASHBOARD & ANALYTICS ───────────────────────────────

    builder
      .addCase(fetchPartnerDashboard.pending,  pending)
      .addCase(fetchPartnerDashboard.rejected, rejected)
      .addCase(fetchPartnerDashboard.fulfilled, (state, { payload }) => {
        state.loading           = false;
        state.partnerDashboard  = payload.data;
      });

    builder
      .addCase(fetchPartnerReviewAnalytics.pending,  pending)
      .addCase(fetchPartnerReviewAnalytics.rejected, rejected)
      .addCase(fetchPartnerReviewAnalytics.fulfilled, (state, { payload }) => {
        state.loading                = false;
        state.partnerReviewAnalytics = payload.data;
      });

    // ── ADMIN — LABS ───────────────────────────────────────────────────

    builder
      .addCase(adminCreateLab.pending,  actionPending)
      .addCase(adminCreateLab.rejected, rejected)
      .addCase(adminCreateLab.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (payload.data?.lab) state.adminLabs.unshift(payload.data.lab);
      });

    builder
      .addCase(adminFetchLabs.pending,  pending)
      .addCase(adminFetchLabs.rejected, rejected)
      .addCase(adminFetchLabs.fulfilled, (state, { payload }) => {
        state.loading          = false;
        state.adminLabs        = payload.data;
        state.adminPagination  = payload.pagination;
      });

    builder
      .addCase(adminFetchLabById.pending,  pending)
      .addCase(adminFetchLabById.rejected, rejected)
      .addCase(adminFetchLabById.fulfilled, (state, { payload }) => {
        state.loading           = false;
        state.adminSelectedLab  = payload.data;
      });

    builder
      .addCase(adminUpdateLab.pending,  actionPending)
      .addCase(adminUpdateLab.rejected, rejected)
      .addCase(adminUpdateLab.fulfilled, (state, { payload }) => {
        state.actionLoading    = false;
        state.adminSelectedLab = payload.data;
        const idx = state.adminLabs.findIndex((l) => l._id === payload.data?._id);
        if (idx !== -1) state.adminLabs[idx] = payload.data;
      });

    builder
      .addCase(adminChangeLabStatus.pending,  actionPending)
      .addCase(adminChangeLabStatus.rejected, rejected)
      .addCase(adminChangeLabStatus.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab) {
          state.adminSelectedLab.status   = payload.data?.status;
          state.adminSelectedLab.isActive = payload.data?.isActive;
        }
      });

    // ── ADMIN — PLATFORM FEE ───────────────────────────────────────────

    builder
      .addCase(adminSetLabPlatformFee.pending,  actionPending)
      .addCase(adminSetLabPlatformFee.rejected, rejected)
      .addCase(adminSetLabPlatformFee.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab) {
          state.adminSelectedLab.platformFee = payload.data?.platformFee;
        }
      });

    builder
      .addCase(adminRemoveLabPlatformFee.pending,  actionPending)
      .addCase(adminRemoveLabPlatformFee.rejected, rejected)
      .addCase(adminRemoveLabPlatformFee.fulfilled, (state) => {
        state.actionLoading = false;
        if (state.adminSelectedLab) {
          state.adminSelectedLab.platformFee = null;
        }
      });

    // ── ADMIN — TESTS ──────────────────────────────────────────────────

    builder
      .addCase(adminAddLabTest.pending,  actionPending)
      .addCase(adminAddLabTest.rejected, rejected)
      .addCase(adminAddLabTest.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab && payload.data) {
          state.adminSelectedLab.labTests = [
            ...(state.adminSelectedLab.labTests ?? []),
            payload.data,
          ];
        }
      });

    builder
      .addCase(adminUpdateLabTest.pending,  actionPending)
      .addCase(adminUpdateLabTest.rejected, rejected)
      .addCase(adminUpdateLabTest.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab && payload.data) {
          state.adminSelectedLab.labTests = state.adminSelectedLab.labTests.map(
            (t) => (t._id === payload.data._id ? payload.data : t)
          );
        }
      });

    builder
      .addCase(adminDeleteLabTest.pending,  actionPending)
      .addCase(adminDeleteLabTest.rejected, rejected)
      .addCase(adminDeleteLabTest.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab) {
          state.adminSelectedLab.labTests = state.adminSelectedLab.labTests.map(
            (t) => (t._id === payload.testId ? { ...t, isActive: false } : t)
          );
        }
      });

    // ── ADMIN — PACKAGES ───────────────────────────────────────────────

    builder
      .addCase(adminAddLabPackage.pending,  actionPending)
      .addCase(adminAddLabPackage.rejected, rejected)
      .addCase(adminAddLabPackage.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab && payload.data) {
          state.adminSelectedLab.labPackages = [
            ...(state.adminSelectedLab.labPackages ?? []),
            payload.data,
          ];
        }
      });

    builder
      .addCase(adminUpdateLabPackage.pending,  actionPending)
      .addCase(adminUpdateLabPackage.rejected, rejected)
      .addCase(adminUpdateLabPackage.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab && payload.data) {
          state.adminSelectedLab.labPackages = state.adminSelectedLab.labPackages.map(
            (p) => (p._id === payload.data._id ? payload.data : p)
          );
        }
      });

    builder
      .addCase(adminDeleteLabPackage.pending,  actionPending)
      .addCase(adminDeleteLabPackage.rejected, rejected)
      .addCase(adminDeleteLabPackage.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab) {
          state.adminSelectedLab.labPackages = state.adminSelectedLab.labPackages.map(
            (p) => (p._id === payload.pkgId ? { ...p, isActive: false } : p)
          );
        }
      });

    // ── ADMIN — ACCREDITATIONS & COMPLIANCE ───────────────────────────

    builder
      .addCase(adminAddLabAccreditation.pending,  actionPending)
      .addCase(adminAddLabAccreditation.rejected, rejected)
      .addCase(adminAddLabAccreditation.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab && payload.data) {
          state.adminSelectedLab.accreditations = [
            ...(state.adminSelectedLab.accreditations ?? []),
            payload.data,
          ];
        }
      });

    builder
      .addCase(adminAddLabComplianceDoc.pending,  actionPending)
      .addCase(adminAddLabComplianceDoc.rejected, rejected)
      .addCase(adminAddLabComplianceDoc.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab && payload.data) {
          state.adminSelectedLab.complianceDocs = [
            ...(state.adminSelectedLab.complianceDocs ?? []),
            payload.data,
          ];
        }
      });

    builder
      .addCase(adminVerifyLabDoc.pending,  actionPending)
      .addCase(adminVerifyLabDoc.rejected, rejected)
      .addCase(adminVerifyLabDoc.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        if (state.adminSelectedLab && payload.docId) {
          const col = payload.docCollection;
          state.adminSelectedLab[col] = (state.adminSelectedLab[col] ?? []).map(
            (d) => (d._id === payload.docId ? { ...d, isVerified: true } : d)
          );
        }
      });

    builder
      .addCase(adminVerifyLabBank.pending,  actionPending)
      .addCase(adminVerifyLabBank.rejected, rejected)
      .addCase(adminVerifyLabBank.fulfilled, (state) => {
        state.actionLoading = false;
        if (state.adminSelectedLab?.bankDetails) {
          state.adminSelectedLab.bankDetails.isVerified = true;
        }
      });

    // ── ADMIN — REVIEWS ────────────────────────────────────────────────

    builder
      .addCase(adminFetchLabReviews.pending,  pending)
      .addCase(adminFetchLabReviews.rejected, rejected)
      .addCase(adminFetchLabReviews.fulfilled, (state, { payload }) => {
        state.loading       = false;
        state.adminReviews  = payload.data?.reviews ?? [];
      });

    builder
      .addCase(adminToggleReviewVisibility.pending,  actionPending)
      .addCase(adminToggleReviewVisibility.rejected, rejected)
      .addCase(adminToggleReviewVisibility.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.adminReviews  = state.adminReviews.map((r) =>
          r._id === payload.reviewId ? { ...r, isVisible: !r.isVisible } : r
        );
      });

    builder
      .addCase(adminDeleteLabReview.pending,  actionPending)
      .addCase(adminDeleteLabReview.rejected, rejected)
      .addCase(adminDeleteLabReview.fulfilled, (state, { payload }) => {
        state.actionLoading = false;
        state.adminReviews  = state.adminReviews.filter((r) => r._id !== payload.reviewId);
      });

    // ── ADMIN — MISC ───────────────────────────────────────────────────

    builder
      .addCase(adminResendLabCredentials.pending,  actionPending)
      .addCase(adminResendLabCredentials.rejected, rejected)
      .addCase(adminResendLabCredentials.fulfilled, (state) => {
        state.actionLoading = false;
      });

    builder
      .addCase(adminSendLabNotification.pending,  actionPending)
      .addCase(adminSendLabNotification.rejected, rejected)
      .addCase(adminSendLabNotification.fulfilled, (state) => {
        state.actionLoading = false;
      });

    builder
      .addCase(adminFetchLabStats.pending,  pending)
      .addCase(adminFetchLabStats.rejected, rejected)
      .addCase(adminFetchLabStats.fulfilled, (state, { payload }) => {
        state.loading     = false;
        state.adminStats  = payload.data;
      });
  },
});

// ═══════════════════════════════════════════════════════════════════════════
//  ACTIONS & SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

export const {
  clearLabError,
  clearSelectedLab,
  clearAdminSelectedLab,
  resetLabState,
} = labSlice.actions;

// ── Public selectors ─────────────────────────────────────────────────────
export const selectPublicLabs           = (s) => s.labs.publicLabs;
export const selectFeaturedLabs         = (s) => s.labs.featuredLabs;
export const selectPublicPagination     = (s) => s.labs.publicPagination;
export const selectSelectedLab          = (s) => s.labs.selectedLab;
export const selectPublicTests          = (s) => s.labs.publicTests;
export const selectPublicPackages       = (s) => s.labs.publicPackages;
export const selectPublicReviews        = (s) => s.labs.publicReviews;
export const selectReviewsPagination    = (s) => s.labs.reviewsPagination;
export const selectPublicSearchResults  = (s) => s.labs.publicSearchResults; // replaces customerSearch

// ── Partner selectors ────────────────────────────────────────────────────
export const selectPartnerProfile            = (s) => s.labs.partnerProfile;
export const selectPartnerTests              = (s) => s.labs.partnerTests;
export const selectPartnerPackages           = (s) => s.labs.partnerPackages;
export const selectPartnerAccreditations     = (s) => s.labs.partnerAccreditations;
export const selectPartnerComplianceDocs     = (s) => s.labs.partnerComplianceDocs;
export const selectPartnerStatusLog          = (s) => s.labs.partnerStatusLog;
export const selectPartnerReviews            = (s) => s.labs.partnerReviews;
export const selectPartnerSettings           = (s) => s.labs.partnerSettings;
export const selectPartnerSessions           = (s) => s.labs.partnerSessions;
export const selectPartnerLoginHistory       = (s) => s.labs.partnerLoginHistory;
export const selectPartnerNotifications      = (s) => s.labs.partnerNotifications;
export const selectPartnerNotificationsPagination = (s) => s.labs.partnerNotificationsPagination;
export const selectPartnerUnreadCount        = (s) => s.labs.partnerUnreadCount;
export const selectPartnerDashboard          = (s) => s.labs.partnerDashboard;
export const selectPartnerReviewAnalytics    = (s) => s.labs.partnerReviewAnalytics;

// ── Admin selectors ──────────────────────────────────────────────────────
export const selectAdminLabs            = (s) => s.labs.adminLabs;
export const selectAdminPagination      = (s) => s.labs.adminPagination;
export const selectAdminSelectedLab     = (s) => s.labs.adminSelectedLab;
export const selectAdminStats           = (s) => s.labs.adminStats;
export const selectAdminReviews         = (s) => s.labs.adminReviews;

// ── UI selectors ─────────────────────────────────────────────────────────
export const selectLabLoading           = (s) => s.labs.loading;
export const selectLabActionLoading     = (s) => s.labs.actionLoading;
export const selectLabError             = (s) => s.labs.error;

export default labSlice.reducer;