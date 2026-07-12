import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API   from '../api';
import toast from 'react-hot-toast';

const BASE  = '/solo-driver';
const ADMIN = `${BASE}/admin`;

const rejectWith = (thunkAPI, error, fallback = 'Something went wrong') => {
  const msg =
    error?.response?.data?.message ||
    error?.response?.data?.errors?.[0] ||
    error?.message ||
    fallback;
  return thunkAPI.rejectWithValue(msg);
};

// ═══════════════════════════════════════════════════════════════════════════════
// §A  PROFILE THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchMyProfile = createAsyncThunk(
  'soloDriver/fetchMyProfile',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/me`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load profile');
    }
  }
);

export const updateMyProfile = createAsyncThunk(
  'soloDriver/updateMyProfile',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/me`, payload);
      toast.success(data.message || 'Profile updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update profile');
    }
  }
);

export const updateContactInfo = createAsyncThunk(
  'soloDriver/updateContactInfo',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/me/contact`, payload);
      toast.success(data.message || 'Contact info updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update contact');
    }
  }
);

export const updateAddress = createAsyncThunk(
  'soloDriver/updateAddress',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/me/address`, payload);
      toast.success(data.message || 'Address updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update address');
    }
  }
);

export const updateProfessionalInfo = createAsyncThunk(
  'soloDriver/updateProfessionalInfo',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/me/professional`, payload);
      toast.success(data.message || 'Professional info updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update professional info');
    }
  }
);

export const addTrainingCertificate = createAsyncThunk(
  'soloDriver/addTrainingCertificate',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post(`${BASE}/me/training-certificates`, payload);
      toast.success(data.message || 'Certificate added');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add certificate');
      return rejectWith(thunkAPI, err, 'Failed to add certificate');
    }
  }
);

export const removeTrainingCertificate = createAsyncThunk(
  'soloDriver/removeTrainingCertificate',
  async (certId, thunkAPI) => {
    try {
      await API.delete(`${BASE}/me/training-certificates/${certId}`);
      toast.success('Certificate removed');
      return certId;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove certificate');
      return rejectWith(thunkAPI, err, 'Failed to remove certificate');
    }
  }
);

export const updateEmergencyContact = createAsyncThunk(
  'soloDriver/updateEmergencyContact',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/me/emergency`, payload);
      toast.success(data.message || 'Emergency contact updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update emergency contact');
    }
  }
);

export const fetchSettings = createAsyncThunk(
  'soloDriver/fetchSettings',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/me/settings`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load settings');
    }
  }
);

export const updateSettings = createAsyncThunk(
  'soloDriver/updateSettings',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/me/settings`, payload);
      toast.success(data.message || 'Settings updated');
      return payload;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update settings');
    }
  }
);

export const requestAccountDeletion = createAsyncThunk(
  'soloDriver/requestAccountDeletion',
  async ({ password, reason }, thunkAPI) => {
    try {
      const { data } = await API.delete(`${BASE}/me`, { data: { password, reason } });
      toast.success(data.message || 'Deletion request submitted');
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Request failed');
      return rejectWith(thunkAPI, err, 'Failed to submit deletion request');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §B  KYC THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchKycStatus = createAsyncThunk(
  'soloDriver/fetchKycStatus',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/kyc`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load KYC status');
    }
  }
);

export const submitKyc = createAsyncThunk(
  'soloDriver/submitKyc',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post(`${BASE}/kyc`, payload);
      toast.success(data.message || 'KYC submitted');
      return data.data;
    } catch (err) {
      const errors = err?.response?.data?.errors;
      if (errors?.length) errors.forEach((e) => toast.error(e));
      else toast.error(err?.response?.data?.message || 'KYC submission failed');
      return rejectWith(thunkAPI, err, 'KYC submission failed');
    }
  }
);

export const submitMedicalFitness = createAsyncThunk(
  'soloDriver/submitMedicalFitness',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post(`${BASE}/kyc/medical`, payload);
      toast.success(data.message || 'Medical fitness certificate submitted');
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Submission failed');
      return rejectWith(thunkAPI, err, 'Failed to submit medical fitness');
    }
  }
);

export const submitPsvBadge = createAsyncThunk(
  'soloDriver/submitPsvBadge',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post(`${BASE}/kyc/psv`, payload);
      toast.success(data.message || 'PSV badge details submitted');
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Submission failed');
      return rejectWith(thunkAPI, err, 'Failed to submit PSV badge');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §C  VEHICLE THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchVehicle = createAsyncThunk(
  'soloDriver/fetchVehicle',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/vehicle`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load vehicle info');
    }
  }
);

export const updateVehicle = createAsyncThunk(
  'soloDriver/updateVehicle',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put(`${BASE}/vehicle`, payload);
      toast.success(data.message || 'Vehicle details submitted for verification');
      return data.data;
    } catch (err) {
      const errors = err?.response?.data?.errors;
      if (errors?.length) errors.forEach((e) => toast.error(e));
      else toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update vehicle');
    }
  }
);

export const updateVehicleDocuments = createAsyncThunk(
  'soloDriver/updateVehicleDocuments',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/vehicle/documents`, payload);
      toast.success(data.message || 'Vehicle documents updated');
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update vehicle documents');
    }
  }
);

export const updateVehicleFeatures = createAsyncThunk(
  'soloDriver/updateVehicleFeatures',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/vehicle/features`, payload);
      toast.success(data.message || 'Vehicle features updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update vehicle features');
    }
  }
);

export const updateVehicleLocation = createAsyncThunk(
  'soloDriver/updateVehicleLocation',
  async ({ lng, lat, heading, speedKmh, gpsDeviceId }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/vehicle/location`, {
        lng, lat, heading, speedKmh, gpsDeviceId,
      });
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Location update failed');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §D  BANK & SETTLEMENT THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchBankDetails = createAsyncThunk(
  'soloDriver/fetchBankDetails',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/bank`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load bank details');
    }
  }
);

export const submitBankDetails = createAsyncThunk(
  'soloDriver/submitBankDetails',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post(`${BASE}/bank`, payload);
      toast.success(data.message || 'Bank details submitted for verification');
      return true;
    } catch (err) {
      const errors = err?.response?.data?.errors;
      if (errors?.length) errors.forEach((e) => toast.error(e));
      else toast.error(err?.response?.data?.message || 'Submission failed');
      return rejectWith(thunkAPI, err, 'Failed to submit bank details');
    }
  }
);

export const fetchSettlementSummary = createAsyncThunk(
  'soloDriver/fetchSettlementSummary',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/settlement`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load settlement summary');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §E  DISPATCH THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchDispatchStatus = createAsyncThunk(
  'soloDriver/fetchDispatchStatus',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/dispatch/status`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load dispatch status');
    }
  }
);

export const updateDispatchStatus = createAsyncThunk(
  'soloDriver/updateDispatchStatus',
  async (status, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/dispatch/status`, { status });
      toast.success(data.message || `Status: ${status}`);
      return data.data; 
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Status update failed');
      return rejectWith(thunkAPI, err, 'Failed to update dispatch status');
    }
  }
);

export const updateDispatchShift = createAsyncThunk(
  'soloDriver/updateDispatchShift',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/dispatch/shift`, payload);
      toast.success(data.message || 'Shift updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Shift update failed');
      return rejectWith(thunkAPI, err, 'Failed to update shift');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §F  SERVICE ZONES THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchServiceZones = createAsyncThunk(
  'soloDriver/fetchServiceZones',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/service-zones`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load service zones');
    }
  }
);

export const addServiceZone = createAsyncThunk(
  'soloDriver/addServiceZone',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post(`${BASE}/service-zones`, payload);
      toast.success(data.message || 'Service zone added');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add service zone');
      return rejectWith(thunkAPI, err, 'Failed to add service zone');
    }
  }
);

export const removeServiceZone = createAsyncThunk(
  'soloDriver/removeServiceZone',
  async (zoneId, thunkAPI) => {
    try {
      await API.delete(`${BASE}/service-zones/${zoneId}`);
      toast.success('Service zone removed');
      return zoneId;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove service zone');
      return rejectWith(thunkAPI, err, 'Failed to remove service zone');
    }
  }
);

export const updateServiceZone = createAsyncThunk(
  'soloDriver/updateServiceZone',
  async ({ zoneId, ...payload }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/service-zones/${zoneId}`, payload);
      toast.success(data.message || 'Service zone updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update service zone');
      return rejectWith(thunkAPI, err, 'Failed to update service zone');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §G  PRICING THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchPricing = createAsyncThunk(
  'soloDriver/fetchPricing',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/pricing`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load pricing');
    }
  }
);

export const updatePricing = createAsyncThunk(
  'soloDriver/updatePricing',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.put(`${BASE}/pricing`, payload);
      toast.success(data.message || 'Pricing updated');
      return data.data;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update pricing');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §H  PERFORMANCE & REWARDS THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchPerformance = createAsyncThunk(
  'soloDriver/fetchPerformance',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/performance`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load performance');
    }
  }
);

export const fetchRewards = createAsyncThunk(
  'soloDriver/fetchRewards',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/rewards`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load rewards');
    }
  }
);

export const fetchRewardBadges = createAsyncThunk(
  'soloDriver/fetchRewardBadges',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/rewards/badges`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load badges');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §I  COMPLIANCE THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchComplianceDashboard = createAsyncThunk(
  'soloDriver/fetchComplianceDashboard',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/compliance`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load compliance dashboard');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §J  SECURITY & NOTIFICATIONS THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchSessions = createAsyncThunk(
  'soloDriver/fetchSessions',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/security/sessions`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load sessions');
    }
  }
);

export const revokeSession = createAsyncThunk(
  'soloDriver/revokeSession',
  async (sessionId, thunkAPI) => {
    try {
      await API.delete(`${BASE}/security/sessions/${sessionId}`);
      toast.success('Session revoked');
      return sessionId;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to revoke session');
      return rejectWith(thunkAPI, err, 'Failed to revoke session');
    }
  }
);

export const fetchDevices = createAsyncThunk(
  'soloDriver/fetchDevices',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.get(`${BASE}/security/devices`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load devices');
    }
  }
);

export const removeDevice = createAsyncThunk(
  'soloDriver/removeDevice',
  async (deviceId, thunkAPI) => {
    try {
      await API.delete(`${BASE}/security/devices/${deviceId}`);
      toast.success('Device removed');
      return deviceId;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to remove device');
      return rejectWith(thunkAPI, err, 'Failed to remove device');
    }
  }
);

export const changePassword = createAsyncThunk(
  'soloDriver/changePassword',
  async ({ currentPassword, newPassword }, thunkAPI) => {
    try {
      const { data } = await API.post(`${BASE}/security/change-password`, {
        currentPassword,
        newPassword,
      });
      toast.success(data.message || 'Password changed successfully');
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Password change failed');
      return rejectWith(thunkAPI, err, 'Failed to change password');
    }
  }
);

export const fetchNotifications = createAsyncThunk(
  'soloDriver/fetchNotifications',
  async ({ page = 1, limit = 20, unread, type } = {}, thunkAPI) => {
    try {
      const params = { page, limit };
      if (unread) params.unread = 'true';
      if (type)   params.type   = type;
      const { data } = await API.get(`${BASE}/notifications`, { params });
      return data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load notifications');
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk(
  'soloDriver/markAllNotificationsRead',
  async (_, thunkAPI) => {
    try {
      const { data } = await API.patch(`${BASE}/notifications/read-all`);
      toast.success(data.message || 'All notifications marked as read');
      return true;
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
      return rejectWith(thunkAPI, err, 'Failed to mark all as read');
    }
  }
);

export const markNotificationRead = createAsyncThunk(
  'soloDriver/markNotificationRead',
  async (notificationId, thunkAPI) => {
    try {
      await API.patch(`${BASE}/notifications/${notificationId}/read`);
      return notificationId;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to mark notification as read');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §K  ADMIN THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const adminCreateSoloDriver = createAsyncThunk(
  'soloDriver/adminCreateSoloDriver',
  async (payload, thunkAPI) => {
    try {
      const { data } = await API.post(`${ADMIN}/create`, payload);
      toast.success(data.message || 'Solo driver partner account created');
      return data.data;
    } catch (err) {
      const errors = err?.response?.data?.errors;
      if (errors?.length) errors.forEach((e) => toast.error(e));
      else toast.error(err?.response?.data?.message || 'Creation failed');
      return rejectWith(thunkAPI, err, 'Failed to create solo driver partner');
    }
  }
);

export const adminFetchPartnerList = createAsyncThunk(
  'soloDriver/adminFetchPartnerList',
  async (
    {
      page = 1, limit = 20,
      status, kycStatus, vehicleStatus,
      city, state, search,
      sortBy, sortOrder, isBlocked, partnershipStatus,
    } = {},
    thunkAPI
  ) => {
    try {
      const params = { page, limit };
      if (status || partnershipStatus) params.status = status || partnershipStatus;
      if (kycStatus)     params.kycStatus     = kycStatus;
      if (vehicleStatus) params.vehicleStatus = vehicleStatus;
      if (city)          params.city          = city;
      if (state)         params.state         = state;
      if (search)        params.search        = search;
      if (isBlocked !== undefined) params.isBlocked = isBlocked;
      if (sortBy)        params.sortBy        = sortBy;
      if (sortOrder)     params.sortOrder     = sortOrder;
      const { data } = await API.get(`${ADMIN}/list`, { params });
      return data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load partner list');
    }
  }
);

export const adminFetchComplianceAlerts = createAsyncThunk(
  'soloDriver/adminFetchComplianceAlerts',
  async ({ days = 30 } = {}, thunkAPI) => {
    try {
      const { data } = await API.get(`${ADMIN}/compliance-alerts`, { params: { days } });
      return data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load compliance alerts');
    }
  }
);

export const adminFetchPartnerDetail = createAsyncThunk(
  'soloDriver/adminFetchPartnerDetail',
  async (partnerId, thunkAPI) => {
    try {
      const { data } = await API.get(`${ADMIN}/${partnerId}`);
      return data.data;
    } catch (err) {
      return rejectWith(thunkAPI, err, 'Failed to load partner details');
    }
  }
);

export const adminVerifyKyc = createAsyncThunk(
  'soloDriver/adminVerifyKyc',
  async ({ partnerId, action, rejectionReason }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${ADMIN}/${partnerId}/verify-kyc`, {
        action, rejectionReason,
      });
      toast.success(data.message || `KYC ${action}d`);
      return { partnerId, ...data.data };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
      return rejectWith(thunkAPI, err, 'KYC verification action failed');
    }
  }
);

export const adminVerifyVehicle = createAsyncThunk(
  'soloDriver/adminVerifyVehicle',
  async ({ partnerId, action, rejectionReason }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${ADMIN}/${partnerId}/verify-vehicle`, {
        action, rejectionReason,
      });
      toast.success(data.message || `Vehicle ${action}d`);
      return { partnerId, ...data.data };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
      return rejectWith(thunkAPI, err, 'Vehicle verification action failed');
    }
  }
);

export const adminVerifyBank = createAsyncThunk(
  'soloDriver/adminVerifyBank',
  async (partnerId, thunkAPI) => {
    try {
      const { data } = await API.patch(`${ADMIN}/${partnerId}/verify-bank`);
      toast.success(data.message || 'Bank account verified');
      return { partnerId, ...data.data };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Verification failed');
      return rejectWith(thunkAPI, err, 'Bank verification failed');
    }
  }
);

export const adminUpdatePartnerStatus = createAsyncThunk(
  'soloDriver/adminUpdatePartnerStatus',
  async ({ partnerId, status, rejectionReason }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${ADMIN}/${partnerId}/status`, {
        status, rejectionReason,
      });
      toast.success(data.message || `Status updated to ${status}`);
      return { partnerId, partnershipStatus: data.data.partnershipStatus };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Status update failed');
      return rejectWith(thunkAPI, err, 'Failed to update partner status');
    }
  }
);

export const adminBlockPartner = createAsyncThunk(
  'soloDriver/adminBlockPartner',
  async ({ partnerId, action, blockReason, unblockAt }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${ADMIN}/${partnerId}/block`, {
        action, blockReason, unblockAt,
      });
      toast.success(data.message || `Account ${action}ed`);
      return { partnerId, action };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Action failed');
      return rejectWith(thunkAPI, err, 'Block/unblock action failed');
    }
  }
);

export const adminUpdatePlatformFee = createAsyncThunk(
  'soloDriver/adminUpdatePlatformFee',
  async ({ partnerId, platformFeeOverride, settlementCycle }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${ADMIN}/${partnerId}/platform-fee`, {
        platformFeeOverride,
        settlementCycle,
      });
      toast.success(data.message || 'Platform fee settings updated');
      return { partnerId, ...data.data };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update platform fee');
    }
  }
);

export const adminUpdateNotes = createAsyncThunk(
  'soloDriver/adminUpdateNotes',
  async ({ partnerId, notes }, thunkAPI) => {
    try {
      const { data } = await API.post(`${ADMIN}/${partnerId}/notes`, { notes });
      toast.success(data.message || 'Notes updated');
      return { partnerId, notes };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Update failed');
      return rejectWith(thunkAPI, err, 'Failed to update notes');
    }
  }
);

export const adminAwardBadge = createAsyncThunk(
  'soloDriver/adminAwardBadge',
  async ({ partnerId, badgeId, name, description, iconUrl }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${ADMIN}/${partnerId}/rewards/award-badge`, {
        badgeId, name, description, iconUrl,
      });
      toast.success(data.message || `Badge "${name}" awarded`);
      return { partnerId, badgeId, name, description, iconUrl };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to award badge');
      return rejectWith(thunkAPI, err, 'Failed to award badge');
    }
  }
);

export const adminAdjustCoins = createAsyncThunk(
  'soloDriver/adminAdjustCoins',
  async ({ partnerId, type, amount, description }, thunkAPI) => {
    try {
      const { data } = await API.patch(`${ADMIN}/${partnerId}/rewards/adjust-coins`, {
        type, amount, description,
      });
      toast.success(data.message || 'Coins adjusted');
      return { partnerId, type, amount, newBalance: data.data.newBalance };
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Coin adjustment failed');
      return rejectWith(thunkAPI, err, 'Failed to adjust coins');
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// §L  INITIAL STATE & SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  profile:       null,
  settings:      null,
  kyc:           null,
  vehicle:       null,
  bankDetails:   null,
  settlement:    null,
  dispatch:      null,
  serviceZones:  [],
  pricing:       null,
  performance:   null,
  rewards:       null,
  badges:        [],
  compliance:    null,
  sessions:      [],
  devices:       [],
  notifications: {
    list:        [],
    pagination:  null,
    unreadCount: 0,
  },

  admin: {
    list:             [],
    pagination:       null,
    selectedPartner:  null,
    complianceAlerts: [],
    complianceTotal:  0,
    lastCreated:      null,
  },

  loading: {
    profile:               false,
    updateProfile:         false,
    updateContact:         false,
    updateAddress:         false,
    updateProfessional:    false,
    addCertificate:        false,
    removeCertificate:     false,
    updateEmergency:       false,
    settings:              false,
    updateSettings:        false,
    deletionRequest:       false,
    kyc:                   false,
    submitKyc:             false,
    submitMedical:         false,
    submitPsv:             false,
    vehicle:               false,
    updateVehicle:         false,
    updateVehicleDocs:     false,
    updateVehicleFeatures: false,
    updateLocation:        false,
    bank:                  false,
    submitBank:            false,
    settlement:            false,
    dispatch:              false,
    updateDispatchStatus:  false,
    updateDispatchShift:   false,
    serviceZones:          false,
    addZone:               false,
    removeZone:            false,
    updateZone:            false,
    pricing:               false,
    updatePricing:         false,
    performance:           false,
    rewards:               false,
    badges:                false,
    compliance:            false,
    sessions:              false,
    revokeSession:         false,
    devices:               false,
    removeDevice:          false,
    changePassword:        false,
    notifications:         false,
    markAllRead:           false,
    adminCreate:           false,
    adminList:             false,
    adminDetail:           false,
    adminVerifyKyc:        false,
    adminVerifyVehicle:    false,
    adminVerifyBank:       false,
    adminStatus:           false,
    adminBlock:            false,
    adminPlatformFee:      false,
    adminComplianceAlerts: false,
    adminNotes:            false,
    adminAwardBadge:       false,
    adminAdjustCoins:      false,
  },

  errors: {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const setLoading   = (key) => (state)         => { state.loading[key] = true; delete state.errors[key]; };
const setError     = (key) => (state, action) => { state.loading[key] = false; state.errors[key] = action.payload; };
const clearLoading = (key) => (state)         => { state.loading[key] = false; };

// ─── Slice ────────────────────────────────────────────────────────────────────
const soloDriverSlice = createSlice({
  name: 'soloDriver',
  initialState,

  reducers: {
    clearError(state, action) {
      delete state.errors[action.payload];
    },
    resetSoloDriver() {
      return initialState;
    },
    setDispatchStatusOptimistic(state, action) {
      if (state.dispatch) state.dispatch.status = action.payload;
      if (state.profile)  state.profile.status  = action.payload;
    },
    incrementUnreadCount(state) {
      state.notifications.unreadCount += 1;
    },
    prependNotification(state, action) {
      state.notifications.list.unshift(action.payload);
      state.notifications.unreadCount += 1;
    },
  },

  extraReducers: (builder) => {

    // ── §A  Profile ────────────────────────────────────────────────────────
    builder
      .addCase(fetchMyProfile.pending,   setLoading('profile'))
      .addCase(fetchMyProfile.rejected,  setError('profile'))
      .addCase(fetchMyProfile.fulfilled, (state, action) => {
        state.loading.profile = false;
        state.profile         = action.payload;
      })

      .addCase(updateMyProfile.pending,   setLoading('updateProfile'))
      .addCase(updateMyProfile.rejected,  setError('updateProfile'))
      .addCase(updateMyProfile.fulfilled, (state, action) => {
        state.loading.updateProfile = false;
        if (state.profile && action.payload) state.profile = { ...state.profile, ...action.payload };
      })

      .addCase(updateContactInfo.pending,   setLoading('updateContact'))
      .addCase(updateContactInfo.rejected,  setError('updateContact'))
      .addCase(updateContactInfo.fulfilled, (state, action) => {
        state.loading.updateContact = false;
        if (state.profile && action.payload) state.profile = { ...state.profile, ...action.payload };
      })

      .addCase(updateAddress.pending,   setLoading('updateAddress'))
      .addCase(updateAddress.rejected,  setError('updateAddress'))
      .addCase(updateAddress.fulfilled, (state, action) => {
        state.loading.updateAddress = false;
        if (state.profile && action.payload) state.profile.address = action.payload;
      })

      .addCase(updateProfessionalInfo.pending,   setLoading('updateProfessional'))
      .addCase(updateProfessionalInfo.rejected,  setError('updateProfessional'))
      .addCase(updateProfessionalInfo.fulfilled, (state, action) => {
        state.loading.updateProfessional = false;
        if (state.profile && action.payload) state.profile = { ...state.profile, ...action.payload };
      })

      .addCase(addTrainingCertificate.pending,   setLoading('addCertificate'))
      .addCase(addTrainingCertificate.rejected,  setError('addCertificate'))
      .addCase(addTrainingCertificate.fulfilled, (state, action) => {
        state.loading.addCertificate = false;
        if (state.profile) state.profile.trainingCertificates = action.payload;
      })

      .addCase(removeTrainingCertificate.pending,   setLoading('removeCertificate'))
      .addCase(removeTrainingCertificate.rejected,  setError('removeCertificate'))
      .addCase(removeTrainingCertificate.fulfilled, (state, action) => {
        state.loading.removeCertificate = false;
        if (state.profile?.trainingCertificates) {
          state.profile.trainingCertificates =
            state.profile.trainingCertificates.filter(
              (c) => String(c._id) !== String(action.payload)
            );
        }
      })

      .addCase(updateEmergencyContact.pending,   setLoading('updateEmergency'))
      .addCase(updateEmergencyContact.rejected,  setError('updateEmergency'))
      .addCase(updateEmergencyContact.fulfilled, (state, action) => {
        state.loading.updateEmergency = false;
        if (state.profile && action.payload) state.profile.emergencyContact = action.payload;
      })

      .addCase(fetchSettings.pending,   setLoading('settings'))
      .addCase(fetchSettings.rejected,  setError('settings'))
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.loading.settings = false;
        state.settings         = action.payload;
      })

      .addCase(updateSettings.pending,   setLoading('updateSettings'))
      .addCase(updateSettings.rejected,  setError('updateSettings'))
      .addCase(updateSettings.fulfilled, (state, action) => {
        state.loading.updateSettings = false;
        if (state.settings) state.settings = { ...state.settings, ...action.payload };
      })

      .addCase(requestAccountDeletion.pending,   setLoading('deletionRequest'))
      .addCase(requestAccountDeletion.rejected,  setError('deletionRequest'))
      .addCase(requestAccountDeletion.fulfilled, clearLoading('deletionRequest'))

    // ── §B  KYC ────────────────────────────────────────────────────────────
      .addCase(fetchKycStatus.pending,   setLoading('kyc'))
      .addCase(fetchKycStatus.rejected,  setError('kyc'))
      .addCase(fetchKycStatus.fulfilled, (state, action) => {
        state.loading.kyc = false;
        state.kyc         = action.payload;
      })

      .addCase(submitKyc.pending,   setLoading('submitKyc'))
      .addCase(submitKyc.rejected,  setError('submitKyc'))
      .addCase(submitKyc.fulfilled, (state, action) => {
        state.loading.submitKyc = false;
        if (state.kyc && action.payload) state.kyc = { ...state.kyc, ...action.payload };
      })

      .addCase(submitMedicalFitness.pending,   setLoading('submitMedical'))
      .addCase(submitMedicalFitness.rejected,  setError('submitMedical'))
      .addCase(submitMedicalFitness.fulfilled, clearLoading('submitMedical'))

      .addCase(submitPsvBadge.pending,   setLoading('submitPsv'))
      .addCase(submitPsvBadge.rejected,  setError('submitPsv'))
      .addCase(submitPsvBadge.fulfilled, clearLoading('submitPsv'))

    // ── §C  Vehicle ────────────────────────────────────────────────────────
      .addCase(fetchVehicle.pending,   setLoading('vehicle'))
      .addCase(fetchVehicle.rejected,  setError('vehicle'))
      .addCase(fetchVehicle.fulfilled, (state, action) => {
        state.loading.vehicle = false;
        state.vehicle         = action.payload;
      })

      .addCase(updateVehicle.pending,   setLoading('updateVehicle'))
      .addCase(updateVehicle.rejected,  setError('updateVehicle'))
      .addCase(updateVehicle.fulfilled, (state, action) => {
        state.loading.updateVehicle = false;
        state.vehicle               = action.payload;
        // REMOVED state.profile.vehicleStatus syncing — the field was removed from the schema
      })

      .addCase(updateVehicleDocuments.pending,   setLoading('updateVehicleDocs'))
      .addCase(updateVehicleDocuments.rejected,  setError('updateVehicleDocs'))
      .addCase(updateVehicleDocuments.fulfilled, clearLoading('updateVehicleDocs'))

      .addCase(updateVehicleFeatures.pending,   setLoading('updateVehicleFeatures'))
      .addCase(updateVehicleFeatures.rejected,  setError('updateVehicleFeatures'))
      .addCase(updateVehicleFeatures.fulfilled, (state, action) => {
        state.loading.updateVehicleFeatures = false;
        if (state.vehicle && action.payload) state.vehicle = { ...state.vehicle, ...action.payload };
      })

      .addCase(updateVehicleLocation.pending,   setLoading('updateLocation'))
      .addCase(updateVehicleLocation.rejected,  setError('updateLocation'))
      .addCase(updateVehicleLocation.fulfilled, (state, action) => {
        state.loading.updateLocation = false;
        if (state.vehicle && action.payload) {
          state.vehicle.location = { 
            type: 'Point',
            coordinates: [action.payload.lng, action.payload.lat],
          };
          state.vehicle.locationUpdatedAt = action.payload.updatedAt;
        }
        if (state.dispatch) state.dispatch.lastLocationUpdate = action.payload?.updatedAt;
      })

    // ── §D  Bank & Settlement ──────────────────────────────────────────────
      .addCase(fetchBankDetails.pending,   setLoading('bank'))
      .addCase(fetchBankDetails.rejected,  setError('bank'))
      .addCase(fetchBankDetails.fulfilled, (state, action) => {
        state.loading.bank = false;
        state.bankDetails  = action.payload;
      })

      .addCase(submitBankDetails.pending,   setLoading('submitBank'))
      .addCase(submitBankDetails.rejected,  setError('submitBank'))
      .addCase(submitBankDetails.fulfilled, clearLoading('submitBank'))

      .addCase(fetchSettlementSummary.pending,   setLoading('settlement'))
      .addCase(fetchSettlementSummary.rejected,  setError('settlement'))
      .addCase(fetchSettlementSummary.fulfilled, (state, action) => {
        state.loading.settlement = false;
        state.settlement         = action.payload;
      })

    // ── §E  Dispatch ───────────────────────────────────────────────────────
      .addCase(fetchDispatchStatus.pending,   setLoading('dispatch'))
      .addCase(fetchDispatchStatus.rejected,  setError('dispatch'))
      .addCase(fetchDispatchStatus.fulfilled, (state, action) => {
        state.loading.dispatch = false;
        state.dispatch         = action.payload;
      })

      .addCase(updateDispatchStatus.pending,   setLoading('updateDispatchStatus'))
      .addCase(updateDispatchStatus.rejected,  (state, action) => {
        state.loading.updateDispatchStatus = false;
        state.errors.updateDispatchStatus  = action.payload;
      })
      .addCase(updateDispatchStatus.fulfilled, (state, action) => {
        state.loading.updateDispatchStatus = false;
        if (state.dispatch) state.dispatch.status = action.payload.status;
        if (state.profile)  state.profile.status  = action.payload.status;
      })

      .addCase(updateDispatchShift.pending,   setLoading('updateDispatchShift'))
      .addCase(updateDispatchShift.rejected,  setError('updateDispatchShift'))
      .addCase(updateDispatchShift.fulfilled, (state, action) => {
        state.loading.updateDispatchShift = false;
        if (state.dispatch && action.payload) state.dispatch.shift = { ...state.dispatch.shift, ...action.payload };
        if (state.profile  && action.payload) state.profile.shift  = { ...state.profile.shift,  ...action.payload };
      })

    // ── §F  Service Zones ──────────────────────────────────────────────────
      .addCase(fetchServiceZones.pending,   setLoading('serviceZones'))
      .addCase(fetchServiceZones.rejected,  setError('serviceZones'))
      .addCase(fetchServiceZones.fulfilled, (state, action) => {
        state.loading.serviceZones = false;
        state.serviceZones         = action.payload || [];
      })

      .addCase(addServiceZone.pending,   setLoading('addZone'))
      .addCase(addServiceZone.rejected,  setError('addZone'))
      .addCase(addServiceZone.fulfilled, (state, action) => {
        state.loading.addZone = false;
        state.serviceZones    = action.payload || [];
      })

      .addCase(removeServiceZone.pending,   setLoading('removeZone'))
      .addCase(removeServiceZone.rejected,  setError('removeZone'))
      .addCase(removeServiceZone.fulfilled, (state, action) => {
        state.loading.removeZone = false;
        state.serviceZones       = state.serviceZones.filter(
          (z) => String(z._id) !== String(action.payload)
        );
      })

      .addCase(updateServiceZone.pending,   setLoading('updateZone'))
      .addCase(updateServiceZone.rejected,  setError('updateZone'))
      .addCase(updateServiceZone.fulfilled, (state, action) => {
        state.loading.updateZone = false;
        const updatedZone = action.payload;
        if (state.serviceZones && updatedZone) {
          state.serviceZones = state.serviceZones.map((z) =>
            String(z._id) === String(updatedZone._id) ? updatedZone : z
          );
        }
      })

    // ── §G  Pricing ────────────────────────────────────────────────────────
      .addCase(fetchPricing.pending,   setLoading('pricing'))
      .addCase(fetchPricing.rejected,  setError('pricing'))
      .addCase(fetchPricing.fulfilled, (state, action) => {
        state.loading.pricing = false;
        state.pricing         = action.payload;
      })

      .addCase(updatePricing.pending,   setLoading('updatePricing'))
      .addCase(updatePricing.rejected,  setError('updatePricing'))
      .addCase(updatePricing.fulfilled, (state, action) => {
        state.loading.updatePricing = false;
        if (state.pricing && action.payload) state.pricing = { ...state.pricing, ...action.payload };
      })

    // ── §H  Performance & Rewards ──────────────────────────────────────────
      .addCase(fetchPerformance.pending,   setLoading('performance'))
      .addCase(fetchPerformance.rejected,  setError('performance'))
      .addCase(fetchPerformance.fulfilled, (state, action) => {
        state.loading.performance = false;
        state.performance         = action.payload;
      })

      .addCase(fetchRewards.pending,   setLoading('rewards'))
      .addCase(fetchRewards.rejected,  setError('rewards'))
      .addCase(fetchRewards.fulfilled, (state, action) => {
        state.loading.rewards = false;
        state.rewards         = action.payload;
      })

      .addCase(fetchRewardBadges.pending,   setLoading('badges'))
      .addCase(fetchRewardBadges.rejected,  setError('badges'))
      .addCase(fetchRewardBadges.fulfilled, (state, action) => {
        state.loading.badges = false;
        state.badges         = action.payload || [];
      })

    // ── §I  Compliance ─────────────────────────────────────────────────────
      .addCase(fetchComplianceDashboard.pending,   setLoading('compliance'))
      .addCase(fetchComplianceDashboard.rejected,  setError('compliance'))
      .addCase(fetchComplianceDashboard.fulfilled, (state, action) => {
        state.loading.compliance = false;
        state.compliance         = action.payload;
      })

    // ── §J  Security & Notifications ───────────────────────────────────────
      .addCase(fetchSessions.pending,   setLoading('sessions'))
      .addCase(fetchSessions.rejected,  setError('sessions'))
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.loading.sessions = false;
        state.sessions         = action.payload?.sessions || [];
      })

      .addCase(revokeSession.pending,   setLoading('revokeSession'))
      .addCase(revokeSession.rejected,  setError('revokeSession'))
      .addCase(revokeSession.fulfilled, (state, action) => {
        state.loading.revokeSession = false;
        state.sessions              = state.sessions.filter(
          (s) => String(s._id) !== String(action.payload)
        );
      })

      .addCase(fetchDevices.pending,   setLoading('devices'))
      .addCase(fetchDevices.rejected,  setError('devices'))
      .addCase(fetchDevices.fulfilled, (state, action) => {
        state.loading.devices = false;
        state.devices         = action.payload || [];
      })

      .addCase(removeDevice.pending,   setLoading('removeDevice'))
      .addCase(removeDevice.rejected,  setError('removeDevice'))
      .addCase(removeDevice.fulfilled, (state, action) => {
        state.loading.removeDevice = false;
        state.devices              = state.devices.filter(
          (d) => String(d._id) !== String(action.payload)
        );
      })

      .addCase(changePassword.pending,   setLoading('changePassword'))
      .addCase(changePassword.rejected,  setError('changePassword'))
      .addCase(changePassword.fulfilled, clearLoading('changePassword'))

      .addCase(fetchNotifications.pending,   setLoading('notifications'))
      .addCase(fetchNotifications.rejected,  setError('notifications'))
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading.notifications     = false;
        state.notifications.list        = action.payload.data       || [];
        state.notifications.pagination  = action.payload.pagination || null;
        state.notifications.unreadCount = action.payload.unreadCount ?? state.notifications.unreadCount;
      })

      .addCase(markAllNotificationsRead.pending,   setLoading('markAllRead'))
      .addCase(markAllNotificationsRead.rejected,  setError('markAllRead'))
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.loading.markAllRead       = false;
        state.notifications.unreadCount = 0;
        state.notifications.list        = state.notifications.list.map((n) => ({
          ...n, isRead: true, readAt: new Date().toISOString(),
        }));
      })

      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const id  = action.payload;
        const idx = state.notifications.list.findIndex((n) => String(n._id) === String(id));
        if (idx !== -1 && !state.notifications.list[idx].isRead) {
          state.notifications.list[idx].isRead = true;
          state.notifications.list[idx].readAt = new Date().toISOString();
          state.notifications.unreadCount      = Math.max(0, state.notifications.unreadCount - 1);
        }
      })

    // ── §K  Admin ──────────────────────────────────────────────────────────
      .addCase(adminCreateSoloDriver.pending,   setLoading('adminCreate'))
      .addCase(adminCreateSoloDriver.rejected,  setError('adminCreate'))
      .addCase(adminCreateSoloDriver.fulfilled, (state, action) => {
        state.loading.adminCreate = false;
        state.admin.lastCreated   = action.payload;
      })

      .addCase(adminFetchPartnerList.pending,   setLoading('adminList'))
      .addCase(adminFetchPartnerList.rejected,  setError('adminList'))
      .addCase(adminFetchPartnerList.fulfilled, (state, action) => {
        state.loading.adminList = false;
        state.admin.list        = action.payload.data       || [];
        state.admin.pagination  = action.payload.pagination || null;
      })

      .addCase(adminFetchComplianceAlerts.pending,   setLoading('adminComplianceAlerts'))
      .addCase(adminFetchComplianceAlerts.rejected,  setError('adminComplianceAlerts'))
      .addCase(adminFetchComplianceAlerts.fulfilled, (state, action) => {
        state.loading.adminComplianceAlerts = false;
        state.admin.complianceAlerts        = action.payload.data  || [];
        state.admin.complianceTotal         = action.payload.total || 0;
      })

      .addCase(adminFetchPartnerDetail.pending,   setLoading('adminDetail'))
      .addCase(adminFetchPartnerDetail.rejected,  setError('adminDetail'))
      .addCase(adminFetchPartnerDetail.fulfilled, (state, action) => {
        state.loading.adminDetail   = false;
        state.admin.selectedPartner = action.payload;
      })

      .addCase(adminVerifyKyc.pending,   setLoading('adminVerifyKyc'))
      .addCase(adminVerifyKyc.rejected,  setError('adminVerifyKyc'))
      .addCase(adminVerifyKyc.fulfilled, (state, action) => {
        state.loading.adminVerifyKyc = false;
        const { kycStatus, autoActivated, partnershipStatus } = action.payload;
        if (state.admin.selectedPartner) {
          state.admin.selectedPartner.kyc.verificationStatus = kycStatus;
          state.admin.selectedPartner.kyc.isVerified         = kycStatus === 'verified';
          if (autoActivated) state.admin.selectedPartner.partnershipStatus = partnershipStatus;
        }
      })

      .addCase(adminVerifyVehicle.pending,   setLoading('adminVerifyVehicle'))
      .addCase(adminVerifyVehicle.rejected,  setError('adminVerifyVehicle'))
      .addCase(adminVerifyVehicle.fulfilled, (state, action) => {
        state.loading.adminVerifyVehicle = false;
        const { autoActivated, partnershipStatus } = action.payload;
        // REMOVED mutating state.admin.selectedPartner.vehicleStatus 
        // Vehicle is maintained in a completely standalone collection now.
        if (state.admin.selectedPartner && autoActivated) {
          state.admin.selectedPartner.partnershipStatus = partnershipStatus;
        }
      })

      .addCase(adminVerifyBank.pending,   setLoading('adminVerifyBank'))
      .addCase(adminVerifyBank.rejected,  setError('adminVerifyBank'))
      .addCase(adminVerifyBank.fulfilled, (state, action) => {
        state.loading.adminVerifyBank = false;
        const { autoActivated, partnershipStatus } = action.payload;
        if (state.admin.selectedPartner) {
          state.admin.selectedPartner.bankDetails.isVerified = true;
          if (autoActivated) state.admin.selectedPartner.partnershipStatus = partnershipStatus;
        }
      })

      .addCase(adminUpdatePartnerStatus.pending,   setLoading('adminStatus'))
      .addCase(adminUpdatePartnerStatus.rejected,  setError('adminStatus'))
      .addCase(adminUpdatePartnerStatus.fulfilled, (state, action) => {
        state.loading.adminStatus = false;
        const { partnerId, partnershipStatus } = action.payload;
        if (String(state.admin.selectedPartner?._id) === String(partnerId))
          state.admin.selectedPartner.partnershipStatus = partnershipStatus;
        const listItem = state.admin.list.find((p) => String(p._id) === String(partnerId));
        if (listItem) listItem.partnershipStatus = partnershipStatus;
      })

      .addCase(adminBlockPartner.pending,   setLoading('adminBlock'))
      .addCase(adminBlockPartner.rejected,  setError('adminBlock'))
      .addCase(adminBlockPartner.fulfilled, (state, action) => {
        state.loading.adminBlock = false;
        const { partnerId, action: blockAction } = action.payload;
        const isBlocked = blockAction === 'block';
        if (String(state.admin.selectedPartner?._id) === String(partnerId))
          state.admin.selectedPartner.user.isBlocked = isBlocked;
        const listItem = state.admin.list.find((p) => String(p._id) === String(partnerId));
        if (listItem?.user) listItem.user.isBlocked = isBlocked;
      })

      .addCase(adminUpdatePlatformFee.pending,   setLoading('adminPlatformFee'))
      .addCase(adminUpdatePlatformFee.rejected,  setError('adminPlatformFee'))
      .addCase(adminUpdatePlatformFee.fulfilled, (state, action) => {
        state.loading.adminPlatformFee = false;
        const { partnerId, platformFeeOverride, settlementCycle } = action.payload;
        if (String(state.admin.selectedPartner?._id) === String(partnerId)) {
          if (platformFeeOverride !== undefined)
            state.admin.selectedPartner.platformFeeOverride = platformFeeOverride;
          if (settlementCycle)
            state.admin.selectedPartner.settlementCycle = settlementCycle;
        }
      })

      .addCase(adminUpdateNotes.pending,   setLoading('adminNotes'))
      .addCase(adminUpdateNotes.rejected,  setError('adminNotes'))
      .addCase(adminUpdateNotes.fulfilled, (state, action) => {
        state.loading.adminNotes = false;
        if (state.admin.selectedPartner)
          state.admin.selectedPartner.adminNotes = action.payload.notes;
      })

      .addCase(adminAwardBadge.pending,   setLoading('adminAwardBadge'))
      .addCase(adminAwardBadge.rejected,  setError('adminAwardBadge'))
      .addCase(adminAwardBadge.fulfilled, (state, action) => {
        state.loading.adminAwardBadge = false;
        const { badgeId, name, description, iconUrl } = action.payload;
        if (state.admin.selectedPartner) {
          if (!state.admin.selectedPartner.rewards) state.admin.selectedPartner.rewards = {};
          if (!state.admin.selectedPartner.rewards.badges) state.admin.selectedPartner.rewards.badges = [];
          state.admin.selectedPartner.rewards.badges.push({
            badgeId, name, description, iconUrl,
            earnedAt: new Date().toISOString(),
            isActive: true,
          });
        }
      })

      .addCase(adminAdjustCoins.pending,   setLoading('adminAdjustCoins'))
      .addCase(adminAdjustCoins.rejected,  setError('adminAdjustCoins'))
      .addCase(adminAdjustCoins.fulfilled, (state, action) => {
        state.loading.adminAdjustCoins = false;
        const { partnerId, newBalance } = action.payload;
        if (String(state.admin.selectedPartner?._id) === String(partnerId)) {
          if (!state.admin.selectedPartner.rewards) state.admin.selectedPartner.rewards = {};
          state.admin.selectedPartner.rewards.coinBalance = newBalance;
        }
      });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// §M  SELECTORS
// ═══════════════════════════════════════════════════════════════════════════════

const sd = (state) => state.soloDriver;

export const selectProfile           = (s) => sd(s).profile;
export const selectSettings          = (s) => sd(s).settings;
export const selectKyc               = (s) => sd(s).kyc;
export const selectVehicle           = (s) => sd(s).vehicle;
export const selectBankDetails       = (s) => sd(s).bankDetails;
export const selectSettlementSummary = (s) => sd(s).settlement;
export const selectDispatch          = (s) => sd(s).dispatch;
export const selectServiceZones      = (s) => sd(s).serviceZones;
export const selectPricing           = (s) => sd(s).pricing;
export const selectPerformance       = (s) => sd(s).performance;
export const selectRewards           = (s) => sd(s).rewards;
export const selectBadges            = (s) => sd(s).badges;
export const selectCompliance        = (s) => sd(s).compliance;
export const selectSessions          = (s) => sd(s).sessions;
export const selectDevices           = (s) => sd(s).devices;
export const selectNotifications     = (s) => sd(s).notifications;
export const selectUnreadCount       = (s) => sd(s).notifications.unreadCount;

export const selectAdminPartnerList      = (s) => sd(s).admin.list;
export const selectAdminPagination       = (s) => sd(s).admin.pagination;
export const selectAdminSelectedPartner  = (s) => sd(s).admin.selectedPartner;
export const selectAdminComplianceAlerts = (s) => sd(s).admin.complianceAlerts;
export const selectAdminComplianceTotal  = (s) => sd(s).admin.complianceTotal;
export const selectAdminLastCreated      = (s) => sd(s).admin.lastCreated;

export const selectLoading = (key) => (s) => sd(s).loading[key] ?? false;
export const selectError   = (key) => (s) => sd(s).errors[key]  ?? null;

export const selectDispatchStatus    = (s) => sd(s).dispatch?.status ?? sd(s).profile?.status ?? null;
export const selectIsOnline          = (s) => sd(s).dispatch?.status === 'Available' ?? false;
export const selectIsDispatchReady   = (s) => sd(s).dispatch?.isDispatchable ?? false;
export const selectPartnershipStatus = (s) => sd(s).profile?.partnershipStatus ?? null;
export const selectProfileCompletion = (s) => sd(s).profile?.profileCompletionPercent ?? 0;

export const selectKycStatus         = (s) =>
  sd(s).kyc?.kyc?.verificationStatus  ?? sd(s).profile?.kyc?.verificationStatus ?? null;
 
// FIXED: Reads straight from the separated `state.vehicle` slice, abandoning the `profile.vehicleStatus` fallback
export const selectVehicleStatus     = (s) => sd(s).vehicle?.verificationStatus ?? null;

export const selectEffectivePlatformFee = (s) => {
  const override = sd(s).profile?.platformFeeOverride;
  if (!override) return 'Platform default';
  return override.type === 'percentage'
    ? `${override.value}%`
    : `₹${override.value} flat`;
};

export const selectHasComplianceIssue = (s) => {
  const c = sd(s).compliance;
  return c ? (c.hasExpired || c.hasExpiring) : false;
};

// Returns coinBalance off the properly structured rewards schema 
export const selectCoinBalance = (s) =>
  sd(s).rewards?.coinBalance ?? sd(s).profile?.rewards?.coinBalance ?? 0;

// ═══════════════════════════════════════════════════════════════════════════════
// §N  EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const {
  clearError,
  resetSoloDriver,
  setDispatchStatusOptimistic,
  incrementUnreadCount,
  prependNotification,
} = soloDriverSlice.actions;

export default soloDriverSlice.reducer;