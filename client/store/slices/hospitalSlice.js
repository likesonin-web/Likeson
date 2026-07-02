import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

const toQueryString = (params = {}) => {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `?${qs}` : '';
};

// ═══════════════════════════════════════════════════════════════════════════════
//  A. FORM DOWNLOAD THUNKS  (Note: not present in hospitalRouter.js as supplied —
//  presumed to live on a separate forms router. Left as-is; verify base path if
//  these 404 in your environment.)
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchAvailableForms = createAsyncThunk(
  'hospital/fetchAvailableForms',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospitals/forms/list');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const downloadHospitalForm = createAsyncThunk(
  'hospital/downloadHospitalForm',
  async (type = 'hospital-manager', { rejectWithValue }) => {
    try {
      const response = await API.get(
        `/hospitals/forms/hospital${toQueryString({ type })}`,
        { responseType: 'blob' }
      );
      const label = type === 'doctor-owner' ? 'Doctor-Owner-Hospital' : 'Managed-Hospital';
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `Likeson_${label}_Registration_Form.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return { type };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to download hospital form';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const downloadDoctorForm = createAsyncThunk(
  'hospital/downloadDoctorForm',
  async (type = 'doctor-owner', { rejectWithValue }) => {
    try {
      const response = await API.get(
        `/hospitals/forms/doctor${toQueryString({ type })}`,
        { responseType: 'blob' }
      );
      const label = type === 'hospital-manager' ? 'Affiliated-Doctor' : 'Doctor-Owner';
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `Likeson_${label}_Registration_Form.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return { type };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to download doctor form';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  B. PUBLIC HOSPITAL THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchNearbyHospitals = createAsyncThunk(
  'hospital/fetchNearbyHospitals',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/nearby${toQueryString(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchAllHospitals = createAsyncThunk(
  'hospital/fetchAllHospitals',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals${toQueryString(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchHospitalById = createAsyncThunk(
  'hospital/fetchHospitalById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchHospitalBySlug = createAsyncThunk(
  'hospital/fetchHospitalBySlug',
  async (slug, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/slug/${slug}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const searchHospitals = createAsyncThunk(
  'hospital/searchHospitals',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/search${toQueryString(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchHospitalEffectivePricing = createAsyncThunk(
  'hospital/fetchHospitalEffectivePricing',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/${id}/pricing`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  C. PUBLIC DOCTOR THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchNearbyDoctors = createAsyncThunk(
  'hospital/fetchNearbyDoctors',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/doctors/nearby${toQueryString(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchAllDoctors = createAsyncThunk(
  'hospital/fetchAllDoctors',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/doctors${toQueryString(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchDoctorById = createAsyncThunk(
  'hospital/fetchDoctorById',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/doctors/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchDoctorsBySpecialization = createAsyncThunk(
  'hospital/fetchDoctorsBySpecialization',
  async ({ spec, ...rest }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/hospitals/doctors/specialization/${encodeURIComponent(spec)}${toQueryString(rest)}`
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const searchDoctors = createAsyncThunk(
  'hospital/searchDoctors',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/doctors/search${toQueryString(params)}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchDoctorsByHospital = createAsyncThunk(
  'hospital/fetchDoctorsByHospital',
  async ({ hospitalId, ...rest }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/hospitals/doctors/by-hospital/${hospitalId}${toQueryString(rest)}`
      );
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  D. HOSPITAL ADMIN THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const createHospital = createAsyncThunk(
  'hospital/createHospital',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/hospitals', body);
      toast.success('Hospital created successfully');
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create hospital';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateHospitalProfile = createAsyncThunk(
  'hospital/updateHospitalProfile',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/${id}/profile`, body);
      toast.success('Hospital profile updated');
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update hospital profile';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateHospitalSettings = createAsyncThunk(
  'hospital/updateHospitalSettings',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/${id}/settings`, body);
      toast.success('Hospital settings updated');
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update hospital settings';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateHospitalSecurity = createAsyncThunk(
  'hospital/updateHospitalSecurity',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/${id}/security`, body);
      toast.success('Registration details updated');
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update registration details';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateHospitalConsultationPricing = createAsyncThunk(
  'hospital/updateHospitalConsultationPricing',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/${id}/consultation-pricing`, body);
      toast.success('Consultation pricing updated');
      return { id, consultationPricing: data.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update consultation pricing';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const resendHospitalManagerCredentials = createAsyncThunk(
  'hospital/resendHospitalManagerCredentials',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/hospitals/${id}/resend-credentials`);
      toast.success(data.message || 'Credentials resent successfully');
      return { id };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend credentials';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const uploadHospitalImages = createAsyncThunk(
  'hospital/uploadHospitalImages',
  async ({ id, logo, images }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      if (logo) fd.append('logo', logo);
      if (images) {
        const imageList = Array.isArray(images) ? images : [images];
        imageList.forEach((img) => fd.append('images', img));
      }
      const { data } = await API.post(`/hospitals/${id}/images`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Images uploaded successfully');
      return { id, uploaded: data.uploaded, logo: data.data?.logo, images: data.data?.images };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to upload images';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const deleteHospitalImage = createAsyncThunk(
  'hospital/deleteHospitalImage',
  async ({ id, imageIndex }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/hospitals/${id}/images/${imageIndex}`);
      toast.success('Image removed');
      return { id, images: data.images };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to remove image';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateHospitalLocation = createAsyncThunk(
  'hospital/updateHospitalLocation',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/${id}/location`, body);
      toast.success('Hospital location updated');
      return { id, location: data.location };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update location';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const linkDoctorToHospital = createAsyncThunk(
  'hospital/linkDoctorToHospital',
  async ({ hospitalId, doctorId }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/hospitals/${hospitalId}/doctors/${doctorId}`);
      toast.success('Doctor linked to hospital');
      return { hospitalId, doctorId, linkedDoctors: data.data?.linkedDoctors };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to link doctor';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const unlinkDoctorFromHospital = createAsyncThunk(
  'hospital/unlinkDoctorFromHospital',
  async ({ hospitalId, doctorId }, { rejectWithValue }) => {
    try {
      const { data } = await API.delete(`/hospitals/${hospitalId}/doctors/${doctorId}`);
      toast.success('Doctor unlinked from hospital');
      return { hospitalId, doctorId, linkedDoctors: data.data?.linkedDoctors };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to unlink doctor';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const verifyHospital = createAsyncThunk(
  'hospital/verifyHospital',
  async ({ id, isVerified }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/${id}/verify`, { isVerified });
      toast.success(data.message || `Hospital ${isVerified ? 'verified' : 'unverified'}`);
      return { id, isVerified: data.isVerified, verifiedAt: data.verifiedAt };
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification action failed';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const toggleHospitalActive = createAsyncThunk(
  'hospital/toggleHospitalActive',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/${id}/toggle`);
      toast.success(data.message);
      return { id, isActive: data.isActive };
    } catch (err) {
      const msg = err.response?.data?.message || 'Toggle failed';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const deleteHospital = createAsyncThunk(
  'hospital/deleteHospital',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/hospitals/${id}`);
      toast.success('Hospital deleted permanently');
      return { id };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete hospital';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  E. DOCTOR SELF / SHARED THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchMyDoctorProfile = createAsyncThunk(
  'hospital/fetchMyDoctorProfile',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospitals/doctors/me');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchMyManagedHospitals = createAsyncThunk(
  'hospital/fetchMyManagedHospitals',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospitals/doctors/me/hospitals');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchMyEffectivePricing = createAsyncThunk(
  'hospital/fetchMyEffectivePricing',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get('/hospitals/doctors/me/pricing');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const fetchDoctorStats = createAsyncThunk(
  'hospital/fetchDoctorStats',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/hospitals/doctors/${id}/stats`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data || { message: err.message });
    }
  }
);

export const createDoctorProfile = createAsyncThunk(
  'hospital/createDoctorProfile',
  async (body, { rejectWithValue }) => {
    try {
      const { data } = await API.post('/hospitals/doctors', body);
      toast.success('Doctor profile created');
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to create doctor profile';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateDoctorProfile = createAsyncThunk(
  'hospital/updateDoctorProfile',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/profile`, body);
      toast.success('Doctor profile updated');
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update doctor profile';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateDoctorSettings = createAsyncThunk(
  'hospital/updateDoctorSettings',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/settings`, body);
      toast.success('Doctor settings updated');
      return data;
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update doctor settings';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateDoctorAvailability = createAsyncThunk(
  'hospital/updateDoctorAvailability',
  async ({ id, availability }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/availability`, { availability });
      toast.success('Availability schedule updated');
      return { id, availability: data.weeklyAvailability };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update availability';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateDoctorBankDetails = createAsyncThunk(
  'hospital/updateDoctorBankDetails',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/bank`, body);
      toast.success('Bank details updated. Pending admin verification.');
      return { id, bankSummary: data.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update bank details';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateDoctorKyc = createAsyncThunk(
  'hospital/updateDoctorKyc',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/kyc`, body);
      toast.success('KYC submitted. Awaiting admin review.');
      return { id, kycStatus: data.kycStatus };
    } catch (err) {
      const msg = err.response?.data?.message || 'KYC submission failed';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const uploadDoctorPhoto = createAsyncThunk(
  'hospital/uploadDoctorPhoto',
  async ({ id, photo }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append('photo', photo);
      const { data } = await API.post(`/hospitals/doctors/${id}/photo`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Profile photo uploaded');
      return { id, profilePhotoUrl: data.profilePhotoUrl };
    } catch (err) {
      const msg = err.response?.data?.message || 'Photo upload failed';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const uploadDoctorSignature = createAsyncThunk(
  'hospital/uploadDoctorSignature',
  async ({ id, signature }, { rejectWithValue }) => {
    try {
      const fd = new FormData();
      fd.append('signature', signature);
      const { data } = await API.post(`/hospitals/doctors/${id}/signature`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Doctor signature uploaded');
      return { id, doctorSignature: data.doctorSignature };
    } catch (err) {
      const msg = err.response?.data?.message || 'Signature upload failed';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  F. ADMIN-ONLY DOCTOR THUNKS
// ═══════════════════════════════════════════════════════════════════════════════

export const updateDoctorSecurity = createAsyncThunk(
  'hospital/updateDoctorSecurity',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/security`, body);
      toast.success('Doctor security details updated');
      return { id, ...data.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update doctor security details';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateDoctorPlatformFee = createAsyncThunk(
  'hospital/updateDoctorPlatformFee',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/platform-fee`, body);
      toast.success(data.message || 'Platform fee updated');
      return { id, ...data.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update platform fee';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const updateDoctorPartnership = createAsyncThunk(
  'hospital/updateDoctorPartnership',
  async ({ id, ...body }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/partnership`, body);
      toast.success('Partnership details updated');
      return { id, ...data.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to update partnership';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const verifyDoctorKyc = createAsyncThunk(
  'hospital/verifyDoctorKyc',
  async ({ id, action, rejectionReason }, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/kyc/verify`, {
        action,
        rejectionReason,
      });
      toast.success(data.message || `KYC ${action === 'approve' ? 'approved' : 'rejected'}`);
      return { id, ...data.data };
    } catch (err) {
      const msg = err.response?.data?.message || 'KYC verification failed';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const toggleDoctorActive = createAsyncThunk(
  'hospital/toggleDoctorActive',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.put(`/hospitals/doctors/${id}/toggle`);
      toast.success(data.message);
      return { id, isActive: data.isActive };
    } catch (err) {
      const msg = err.response?.data?.message || 'Toggle failed';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const resendDoctorCredentials = createAsyncThunk(
  'hospital/resendDoctorCredentials',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await API.post(`/hospitals/doctors/${id}/resend-credentials`);
      toast.success(data.message || 'Credentials resent successfully');
      return { id };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to resend credentials';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

export const deleteDoctorProfile = createAsyncThunk(
  'hospital/deleteDoctorProfile',
  async (id, { rejectWithValue }) => {
    try {
      await API.delete(`/hospitals/doctors/${id}`);
      toast.success('Doctor profile deleted permanently');
      return { id };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to delete doctor profile';
      toast.error(msg);
      return rejectWithValue(err.response?.data || { message: msg });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
//  INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════════

const initialState = {
  // ── Hospital lists ──────────────────────────────────────────────────────────
  hospitals:       [],
  nearbyHospitals: [],
  searchResults:   [],
  hospitalTotal:   0,
  hospitalPage:    1,
  hospitalPages:   1,

  // ── Selected hospital ───────────────────────────────────────────────────────
  selectedHospital: null,

  // ── Hospital pricing ────────────────────────────────────────────────────────
  hospitalEffectivePricing: null,

  // ── Available forms ─────────────────────────────────────────────────────────
  availableForms: [],

  // ── Doctor lists ────────────────────────────────────────────────────────────
  doctors:               [],
  nearbyDoctors:         [],
  doctorSearchResults:   [],
  specializationDoctors: [],
  hospitalDoctors:       [],   // doctors fetched by-hospital
  doctorTotal:           0,
  doctorPage:            1,
  doctorPages:           1,

  // ── Selected / my doctor ────────────────────────────────────────────────────
  selectedDoctor:     null,
  myDoctorProfile:    null,
  myEffectivePricing: null,
  myManagedHospitals: {
    primaryHospital:  null,
    otherHospitals:   [],
    managedHospitals: [],
  },
  doctorStats: null,

  // ── Loading flags — one per thunk ───────────────────────────────────────────
  loading: {
    // Forms
    fetchAvailableForms: false,
    downloadHospitalForm: false,
    downloadDoctorForm:   false,
    // Public hospitals
    fetchNearbyHospitals:      false,
    fetchAllHospitals:         false,
    fetchHospitalById:         false,
    fetchHospitalBySlug:       false,
    searchHospitals:           false,
    fetchHospitalEffectivePricing: false,
    // Hospital admin
    createHospital:                     false,
    updateHospitalProfile:              false,
    updateHospitalSettings:             false,
    updateHospitalSecurity:             false,
    updateHospitalConsultationPricing:  false,
    resendHospitalManagerCredentials:   false,
    uploadHospitalImages:               false,
    deleteHospitalImage:                false,
    updateHospitalLocation:             false,
    linkDoctorToHospital:               false,
    unlinkDoctorFromHospital:           false,
    verifyHospital:                     false,
    toggleHospitalActive:               false,
    deleteHospital:                     false,
    // Public doctors
    fetchNearbyDoctors:           false,
    fetchAllDoctors:              false,
    fetchDoctorById:              false,
    fetchDoctorsBySpecialization: false,
    searchDoctors:                false,
    fetchDoctorsByHospital:       false,
    // Doctor self / shared
    fetchMyDoctorProfile:     false,
    fetchMyManagedHospitals:  false,
    fetchMyEffectivePricing:  false,
    fetchDoctorStats:         false,
    createDoctorProfile:      false,
    updateDoctorProfile:      false,
    updateDoctorSettings:     false,
    updateDoctorAvailability: false,
    updateDoctorBankDetails:  false,
    updateDoctorKyc:          false,
    uploadDoctorPhoto:        false,
    uploadDoctorSignature:    false,
    // Doctor admin-only
    updateDoctorSecurity:    false,
    updateDoctorPlatformFee: false,
    updateDoctorPartnership: false,
    verifyDoctorKyc:         false,
    toggleDoctorActive:      false,
    resendDoctorCredentials: false,
    deleteDoctorProfile:     false,
  },

  // ── Error ────────────────────────────────────────────────────────────────────
  error: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SLICE
// ═══════════════════════════════════════════════════════════════════════════════

const hospitalSlice = createSlice({
  name: 'hospital',
  initialState,
  reducers: {
    clearSelectedHospital(state)      { state.selectedHospital       = null; },
    clearSelectedDoctor(state)        { state.selectedDoctor         = null; },
    clearHospitalSearchResults(state) { state.searchResults          = []; },
    clearDoctorSearchResults(state)   { state.doctorSearchResults    = []; },
    clearHospitalDoctors(state)       { state.hospitalDoctors        = []; },
    clearHospitalEffectivePricing(state) { state.hospitalEffectivePricing = null; },
    clearMyEffectivePricing(state)    { state.myEffectivePricing     = null; },
    clearError(state)                 { state.error                  = null; },
    resetHospitalState()              { return initialState; },
    setDoctorOnlineStatus(state, { payload: { doctorId, isOnline } }) {
      const touch = (list) => {
        const d = list.find((doc) => doc._id === doctorId);
        if (d) d.isOnline = isOnline;
      };
      touch(state.doctors);
      touch(state.nearbyDoctors);
      touch(state.specializationDoctors);
      touch(state.doctorSearchResults);
      touch(state.hospitalDoctors);
      if (state.selectedDoctor?._id  === doctorId) state.selectedDoctor.isOnline  = isOnline;
      if (state.myDoctorProfile?._id === doctorId) state.myDoctorProfile.isOnline = isOnline;
    },
  },

  extraReducers: (builder) => {

    // ── Reusable builder helpers ──────────────────────────────────────────────
    const startLoading = (key) => (state) => {
      state.loading[key] = true;
      state.error        = null;
    };
    const stopLoading = (key) => (state) => { state.loading[key] = false; };
    const setError    = (key) => (state, { payload }) => {
      state.loading[key] = false;
      state.error = payload?.message || 'Something went wrong';
    };

    // =========================================================================
    //  A. FORMS
    // =========================================================================

    builder
      .addCase(fetchAvailableForms.pending,    startLoading('fetchAvailableForms'))
      .addCase(fetchAvailableForms.fulfilled, (state, { payload }) => {
        state.loading.fetchAvailableForms = false;
        state.availableForms = payload.forms || [];
      })
      .addCase(fetchAvailableForms.rejected, setError('fetchAvailableForms'));

    builder
      .addCase(downloadHospitalForm.pending,    startLoading('downloadHospitalForm'))
      .addCase(downloadHospitalForm.fulfilled, stopLoading('downloadHospitalForm'))
      .addCase(downloadHospitalForm.rejected,  setError('downloadHospitalForm'));

    builder
      .addCase(downloadDoctorForm.pending,    startLoading('downloadDoctorForm'))
      .addCase(downloadDoctorForm.fulfilled, stopLoading('downloadDoctorForm'))
      .addCase(downloadDoctorForm.rejected,  setError('downloadDoctorForm'));

    // =========================================================================
    //  B. PUBLIC HOSPITALS
    // =========================================================================

    builder
      .addCase(fetchNearbyHospitals.pending,    startLoading('fetchNearbyHospitals'))
      .addCase(fetchNearbyHospitals.fulfilled, (state, { payload }) => {
        state.loading.fetchNearbyHospitals = false;
        state.nearbyHospitals = payload.data  || [];
        state.hospitalTotal   = payload.total ?? state.hospitalTotal;
        state.hospitalPage    = payload.page  ?? state.hospitalPage;
        state.hospitalPages   = payload.pages ?? state.hospitalPages;
      })
      .addCase(fetchNearbyHospitals.rejected, setError('fetchNearbyHospitals'));

    builder
      .addCase(fetchAllHospitals.pending,    startLoading('fetchAllHospitals'))
      .addCase(fetchAllHospitals.fulfilled, (state, { payload }) => {
        state.loading.fetchAllHospitals = false;
        state.hospitals     = payload.data  || [];
        state.hospitalTotal = payload.total ?? 0;
        state.hospitalPage  = payload.page  ?? 1;
        state.hospitalPages = payload.pages ?? 1;
      })
      .addCase(fetchAllHospitals.rejected, setError('fetchAllHospitals'));

    builder
      .addCase(fetchHospitalById.pending,    startLoading('fetchHospitalById'))
      .addCase(fetchHospitalById.fulfilled, (state, { payload }) => {
        state.loading.fetchHospitalById = false;
        state.selectedHospital = payload.data || null;
      })
      .addCase(fetchHospitalById.rejected, setError('fetchHospitalById'));

    builder
      .addCase(fetchHospitalBySlug.pending,    startLoading('fetchHospitalBySlug'))
      .addCase(fetchHospitalBySlug.fulfilled, (state, { payload }) => {
        state.loading.fetchHospitalBySlug = false;
        state.selectedHospital = payload.data || null;
      })
      .addCase(fetchHospitalBySlug.rejected, setError('fetchHospitalBySlug'));

    builder
      .addCase(searchHospitals.pending,    startLoading('searchHospitals'))
      .addCase(searchHospitals.fulfilled, (state, { payload }) => {
        state.loading.searchHospitals = false;
        state.searchResults = payload.data  || [];
        state.hospitalTotal = payload.total ?? 0;
        state.hospitalPage  = payload.page  ?? 1;
        state.hospitalPages = payload.pages ?? 1;
      })
      .addCase(searchHospitals.rejected, setError('searchHospitals'));

    builder
      .addCase(fetchHospitalEffectivePricing.pending,    startLoading('fetchHospitalEffectivePricing'))
      .addCase(fetchHospitalEffectivePricing.fulfilled, (state, { payload }) => {
        state.loading.fetchHospitalEffectivePricing = false;
        state.hospitalEffectivePricing = payload.data || null;
      })
      .addCase(fetchHospitalEffectivePricing.rejected, setError('fetchHospitalEffectivePricing'));

    // =========================================================================
    //  C. PUBLIC DOCTORS
    // =========================================================================

    builder
      .addCase(fetchNearbyDoctors.pending,    startLoading('fetchNearbyDoctors'))
      .addCase(fetchNearbyDoctors.fulfilled, (state, { payload }) => {
        state.loading.fetchNearbyDoctors = false;
        state.nearbyDoctors = payload.data  || [];
        state.doctorTotal   = payload.total ?? state.doctorTotal;
        state.doctorPage    = payload.page  ?? state.doctorPage;
        state.doctorPages   = payload.pages ?? state.doctorPages;
      })
      .addCase(fetchNearbyDoctors.rejected, setError('fetchNearbyDoctors'));

    builder
      .addCase(fetchAllDoctors.pending,    startLoading('fetchAllDoctors'))
      .addCase(fetchAllDoctors.fulfilled, (state, { payload }) => {
        state.loading.fetchAllDoctors = false;
        state.doctors     = payload.data  || [];
        state.doctorTotal = payload.total ?? 0;
        state.doctorPage  = payload.page  ?? 1;
        state.doctorPages = payload.pages ?? 1;
      })
      .addCase(fetchAllDoctors.rejected, setError('fetchAllDoctors'));

    builder
      .addCase(fetchDoctorById.pending,    startLoading('fetchDoctorById'))
      .addCase(fetchDoctorById.fulfilled, (state, { payload }) => {
        state.loading.fetchDoctorById = false;
        state.selectedDoctor = payload.data || null;
      })
      .addCase(fetchDoctorById.rejected, setError('fetchDoctorById'));

    builder
      .addCase(fetchDoctorsBySpecialization.pending,    startLoading('fetchDoctorsBySpecialization'))
      .addCase(fetchDoctorsBySpecialization.fulfilled, (state, { payload }) => {
        state.loading.fetchDoctorsBySpecialization = false;
        state.specializationDoctors = payload.data  || [];
        state.doctorTotal           = payload.total ?? 0;
        state.doctorPage            = payload.page  ?? 1;
        state.doctorPages           = payload.pages ?? 1;
      })
      .addCase(fetchDoctorsBySpecialization.rejected, setError('fetchDoctorsBySpecialization'));

    builder
      .addCase(searchDoctors.pending,    startLoading('searchDoctors'))
      .addCase(searchDoctors.fulfilled, (state, { payload }) => {
        state.loading.searchDoctors = false;
        state.doctorSearchResults   = payload.data  || [];
        state.doctorTotal           = payload.total ?? 0;
        state.doctorPage            = payload.page  ?? 1;
        state.doctorPages           = payload.pages ?? 1;
      })
      .addCase(searchDoctors.rejected, setError('searchDoctors'));

    builder
      .addCase(fetchDoctorsByHospital.pending,    startLoading('fetchDoctorsByHospital'))
      .addCase(fetchDoctorsByHospital.fulfilled, (state, { payload }) => {
        state.loading.fetchDoctorsByHospital = false;
        state.hospitalDoctors = payload.data  || [];
        state.doctorTotal     = payload.total ?? 0;
        state.doctorPage      = payload.page  ?? 1;
        state.doctorPages     = payload.pages ?? 1;
      })
      .addCase(fetchDoctorsByHospital.rejected, setError('fetchDoctorsByHospital'));

    // =========================================================================
    //  D. HOSPITAL ADMIN
    // =========================================================================

    builder
      .addCase(createHospital.pending,    startLoading('createHospital'))
      .addCase(createHospital.fulfilled, (state, { payload }) => {
        state.loading.createHospital = false;
        if (payload.data?.hospital) state.hospitals.unshift(payload.data.hospital);
      })
      .addCase(createHospital.rejected, setError('createHospital'));

    builder
      .addCase(updateHospitalProfile.pending,    startLoading('updateHospitalProfile'))
      .addCase(updateHospitalProfile.fulfilled, (state, { payload }) => {
        state.loading.updateHospitalProfile = false;
        const updated = payload.data;
        if (!updated) return;
        const idx = state.hospitals.findIndex((h) => h._id === updated._id);
        if (idx !== -1) state.hospitals[idx] = { ...state.hospitals[idx], ...updated };
        if (state.selectedHospital?._id === updated._id) {
          state.selectedHospital = { ...state.selectedHospital, ...updated };
        }
      })
      .addCase(updateHospitalProfile.rejected, setError('updateHospitalProfile'));

    builder
      .addCase(updateHospitalSettings.pending,    startLoading('updateHospitalSettings'))
      .addCase(updateHospitalSettings.fulfilled, (state, { payload, meta }) => {
        state.loading.updateHospitalSettings = false;
        const id      = meta.arg.id;
        const updated = payload.data;
        if (!updated) return;
        const idx = state.hospitals.findIndex((h) => h._id === id);
        if (idx !== -1) state.hospitals[idx] = { ...state.hospitals[idx], ...updated };
        if (state.selectedHospital?._id === id) {
          state.selectedHospital = { ...state.selectedHospital, ...updated };
        }
      })
      .addCase(updateHospitalSettings.rejected, setError('updateHospitalSettings'));

    builder
      .addCase(updateHospitalSecurity.pending,    startLoading('updateHospitalSecurity'))
      .addCase(updateHospitalSecurity.fulfilled, (state, { payload, meta }) => {
        state.loading.updateHospitalSecurity = false;
        const id = meta.arg.id;
        const idx = state.hospitals.findIndex((h) => h._id === id);
        if (idx !== -1) state.hospitals[idx].registrationDetails = payload.data;
        if (state.selectedHospital?._id === id) {
          state.selectedHospital.registrationDetails = payload.data;
        }
      })
      .addCase(updateHospitalSecurity.rejected, setError('updateHospitalSecurity'));

    builder
      .addCase(updateHospitalConsultationPricing.pending,    startLoading('updateHospitalConsultationPricing'))
      .addCase(updateHospitalConsultationPricing.fulfilled, (state, { payload: { id, consultationPricing } }) => {
        state.loading.updateHospitalConsultationPricing = false;
        const idx = state.hospitals.findIndex((h) => h._id === id);
        if (idx !== -1) state.hospitals[idx].consultationPricing = consultationPricing;
        if (state.selectedHospital?._id === id) {
          state.selectedHospital.consultationPricing = consultationPricing;
        }
        if (state.hospitalEffectivePricing?.hospitalId === id) {
          state.hospitalEffectivePricing.consultationPricing = consultationPricing;
        }
      })
      .addCase(updateHospitalConsultationPricing.rejected, setError('updateHospitalConsultationPricing'));

    builder
      .addCase(resendHospitalManagerCredentials.pending,    startLoading('resendHospitalManagerCredentials'))
      .addCase(resendHospitalManagerCredentials.fulfilled, stopLoading('resendHospitalManagerCredentials'))
      .addCase(resendHospitalManagerCredentials.rejected,  setError('resendHospitalManagerCredentials'));

    builder
      .addCase(uploadHospitalImages.pending,    startLoading('uploadHospitalImages'))
      .addCase(uploadHospitalImages.fulfilled, (state, { payload }) => {
        state.loading.uploadHospitalImages = false;
        const { id, logo, images } = payload;
        const patch = (h) => ({
          ...h,
          ...(logo   !== undefined ? { logo }   : {}),
          ...(images !== undefined ? { images } : {}),
        });
        const idx = state.hospitals.findIndex((h) => h._id === id);
        if (idx !== -1) state.hospitals[idx] = patch(state.hospitals[idx]);
        if (state.selectedHospital?._id === id) {
          state.selectedHospital = patch(state.selectedHospital);
        }
      })
      .addCase(uploadHospitalImages.rejected, setError('uploadHospitalImages'));

    builder
      .addCase(deleteHospitalImage.pending,    startLoading('deleteHospitalImage'))
      .addCase(deleteHospitalImage.fulfilled, (state, { payload: { id, images } }) => {
        state.loading.deleteHospitalImage = false;
        const idx = state.hospitals.findIndex((h) => h._id === id);
        if (idx !== -1) state.hospitals[idx].images = images;
        if (state.selectedHospital?._id === id) state.selectedHospital.images = images;
      })
      .addCase(deleteHospitalImage.rejected, setError('deleteHospitalImage'));

    builder
      .addCase(updateHospitalLocation.pending,    startLoading('updateHospitalLocation'))
      .addCase(updateHospitalLocation.fulfilled, (state, { payload: { id, location } }) => {
        state.loading.updateHospitalLocation = false;
        const idx = state.hospitals.findIndex((h) => h._id === id);
        if (idx !== -1) state.hospitals[idx].location = location;
        if (state.selectedHospital?._id === id) state.selectedHospital.location = location;
      })
      .addCase(updateHospitalLocation.rejected, setError('updateHospitalLocation'));

    builder
      .addCase(linkDoctorToHospital.pending,    startLoading('linkDoctorToHospital'))
      .addCase(linkDoctorToHospital.fulfilled, (state, { payload }) => {
        state.loading.linkDoctorToHospital = false;
        const { hospitalId, linkedDoctors } = payload;
        const idx = state.hospitals.findIndex((h) => h._id === hospitalId);
        if (idx !== -1 && linkedDoctors) state.hospitals[idx].linkedDoctors = linkedDoctors;
        if (state.selectedHospital?._id === hospitalId && linkedDoctors) {
          state.selectedHospital.linkedDoctors = linkedDoctors;
        }
      })
      .addCase(linkDoctorToHospital.rejected, setError('linkDoctorToHospital'));

    builder
      .addCase(unlinkDoctorFromHospital.pending,    startLoading('unlinkDoctorFromHospital'))
      .addCase(unlinkDoctorFromHospital.fulfilled, (state, { payload }) => {
        state.loading.unlinkDoctorFromHospital = false;
        const { hospitalId, linkedDoctors } = payload;
        const idx = state.hospitals.findIndex((h) => h._id === hospitalId);
        if (idx !== -1 && linkedDoctors) state.hospitals[idx].linkedDoctors = linkedDoctors;
        if (state.selectedHospital?._id === hospitalId && linkedDoctors) {
          state.selectedHospital.linkedDoctors = linkedDoctors;
        }
      })
      .addCase(unlinkDoctorFromHospital.rejected, setError('unlinkDoctorFromHospital'));

    builder
      .addCase(verifyHospital.pending,    startLoading('verifyHospital'))
      .addCase(verifyHospital.fulfilled, (state, { payload: { id, isVerified, verifiedAt } }) => {
        state.loading.verifyHospital = false;
        const idx = state.hospitals.findIndex((h) => h._id === id);
        if (idx !== -1) {
          state.hospitals[idx].isVerified = isVerified;
          state.hospitals[idx].verifiedAt = verifiedAt;
        }
        if (state.selectedHospital?._id === id) {
          state.selectedHospital.isVerified = isVerified;
          state.selectedHospital.verifiedAt = verifiedAt;
        }
      })
      .addCase(verifyHospital.rejected, setError('verifyHospital'));

    builder
      .addCase(toggleHospitalActive.pending,    startLoading('toggleHospitalActive'))
      .addCase(toggleHospitalActive.fulfilled, (state, { payload: { id, isActive } }) => {
        state.loading.toggleHospitalActive = false;
        const idx = state.hospitals.findIndex((h) => h._id === id);
        if (idx !== -1) state.hospitals[idx].isActive = isActive;
        if (state.selectedHospital?._id === id) state.selectedHospital.isActive = isActive;
      })
      .addCase(toggleHospitalActive.rejected, setError('toggleHospitalActive'));

    builder
      .addCase(deleteHospital.pending,    startLoading('deleteHospital'))
      .addCase(deleteHospital.fulfilled, (state, { payload: { id } }) => {
        state.loading.deleteHospital = false;
        state.hospitals = state.hospitals.filter((h) => h._id !== id);
        if (state.selectedHospital?._id === id) state.selectedHospital = null;
      })
      .addCase(deleteHospital.rejected, setError('deleteHospital'));

    // =========================================================================
    //  E. DOCTOR SELF / SHARED
    // =========================================================================

    builder
      .addCase(fetchMyDoctorProfile.pending,    startLoading('fetchMyDoctorProfile'))
      .addCase(fetchMyDoctorProfile.fulfilled, (state, { payload }) => {
        state.loading.fetchMyDoctorProfile = false;
        state.myDoctorProfile = payload.data || null;
      })
      .addCase(fetchMyDoctorProfile.rejected, setError('fetchMyDoctorProfile'));

    builder
      .addCase(fetchMyManagedHospitals.pending,    startLoading('fetchMyManagedHospitals'))
      .addCase(fetchMyManagedHospitals.fulfilled, (state, { payload }) => {
        state.loading.fetchMyManagedHospitals = false;
        state.myManagedHospitals = payload.data || initialState.myManagedHospitals;
      })
      .addCase(fetchMyManagedHospitals.rejected, setError('fetchMyManagedHospitals'));

    builder
      .addCase(fetchMyEffectivePricing.pending,    startLoading('fetchMyEffectivePricing'))
      .addCase(fetchMyEffectivePricing.fulfilled, (state, { payload }) => {
        state.loading.fetchMyEffectivePricing = false;
        state.myEffectivePricing = payload.data || null;
      })
      .addCase(fetchMyEffectivePricing.rejected, setError('fetchMyEffectivePricing'));

    builder
      .addCase(fetchDoctorStats.pending,    startLoading('fetchDoctorStats'))
      .addCase(fetchDoctorStats.fulfilled, (state, { payload }) => {
        state.loading.fetchDoctorStats = false;
        state.doctorStats = payload.data || null;
      })
      .addCase(fetchDoctorStats.rejected, setError('fetchDoctorStats'));

    builder
      .addCase(createDoctorProfile.pending,    startLoading('createDoctorProfile'))
      .addCase(createDoctorProfile.fulfilled, (state, { payload }) => {
        state.loading.createDoctorProfile = false;
        if (payload.data?.profile) state.doctors.unshift(payload.data.profile);
      })
      .addCase(createDoctorProfile.rejected, setError('createDoctorProfile'));

    builder
      .addCase(updateDoctorProfile.pending,    startLoading('updateDoctorProfile'))
      .addCase(updateDoctorProfile.fulfilled, (state, { payload }) => {
        state.loading.updateDoctorProfile = false;
        const updated = payload.data;
        if (!updated) return;
        const idx = state.doctors.findIndex((d) => d._id === updated._id);
        if (idx !== -1) state.doctors[idx] = { ...state.doctors[idx], ...updated };
        if (state.selectedDoctor?._id  === updated._id) state.selectedDoctor  = { ...state.selectedDoctor,  ...updated };
        if (state.myDoctorProfile?._id === updated._id) state.myDoctorProfile = { ...state.myDoctorProfile, ...updated };
      })
      .addCase(updateDoctorProfile.rejected, setError('updateDoctorProfile'));

    builder
      .addCase(updateDoctorSettings.pending,    startLoading('updateDoctorSettings'))
      .addCase(updateDoctorSettings.fulfilled, (state, { payload, meta }) => {
        state.loading.updateDoctorSettings = false;
        const id      = meta.arg.id;
        const updated = payload.data;
        if (!updated) return;
        const patch = (d) => ({ ...d, ...updated });
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx] = patch(state.doctors[idx]);
        if (state.selectedDoctor?._id  === id) state.selectedDoctor  = patch(state.selectedDoctor);
        if (state.myDoctorProfile?._id === id) state.myDoctorProfile = patch(state.myDoctorProfile);
      })
      .addCase(updateDoctorSettings.rejected, setError('updateDoctorSettings'));

    builder
      .addCase(updateDoctorAvailability.pending,    startLoading('updateDoctorAvailability'))
      .addCase(updateDoctorAvailability.fulfilled, (state, { payload: { id, availability } }) => {
        state.loading.updateDoctorAvailability = false;
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx].weeklyAvailability = availability;
        if (state.selectedDoctor?._id  === id) state.selectedDoctor.weeklyAvailability  = availability;
        if (state.myDoctorProfile?._id === id) state.myDoctorProfile.weeklyAvailability = availability;
      })
      .addCase(updateDoctorAvailability.rejected, setError('updateDoctorAvailability'));

    builder
      .addCase(updateDoctorBankDetails.pending,    startLoading('updateDoctorBankDetails'))
      .addCase(updateDoctorBankDetails.fulfilled, (state, { payload: { id, bankSummary } }) => {
        state.loading.updateDoctorBankDetails = false;
        if (state.myDoctorProfile?._id === id && bankSummary) {
          state.myDoctorProfile.bankDetails = {
            ...state.myDoctorProfile.bankDetails,
            ...bankSummary,
          };
        }
      })
      .addCase(updateDoctorBankDetails.rejected, setError('updateDoctorBankDetails'));

    builder
      .addCase(updateDoctorKyc.pending,    startLoading('updateDoctorKyc'))
      .addCase(updateDoctorKyc.fulfilled, (state, { payload: { id, kycStatus } }) => {
        state.loading.updateDoctorKyc = false;
        if (state.myDoctorProfile?._id === id) state.myDoctorProfile.kycStatus = kycStatus;
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx].kycStatus = kycStatus;
      })
      .addCase(updateDoctorKyc.rejected, setError('updateDoctorKyc'));

    builder
      .addCase(uploadDoctorSignature.pending,    startLoading('uploadDoctorSignature'))
      .addCase(uploadDoctorSignature.fulfilled, (state, { payload: { id, doctorSignature } }) => {
        state.loading.uploadDoctorSignature = false;
        const patch = (d) => ({ ...d, doctorSignature });
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx] = patch(state.doctors[idx]);
        if (state.selectedDoctor?._id  === id) state.selectedDoctor  = patch(state.selectedDoctor);
        if (state.myDoctorProfile?._id === id) state.myDoctorProfile = patch(state.myDoctorProfile);
      })
      .addCase(uploadDoctorSignature.rejected, setError('uploadDoctorSignature'));

    // =========================================================================
    //  F. ADMIN-ONLY DOCTOR
    // =========================================================================

    builder
      .addCase(updateDoctorSecurity.pending,    startLoading('updateDoctorSecurity'))
      .addCase(updateDoctorSecurity.fulfilled, (state, { payload }) => {
        state.loading.updateDoctorSecurity = false;
        const { id, registrationNumber, registrationCouncil, contractUrl } = payload;
        const patch = (d) => ({ ...d, registrationNumber, registrationCouncil, contractUrl });
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx] = patch(state.doctors[idx]);
        if (state.selectedDoctor?._id  === id) state.selectedDoctor  = patch(state.selectedDoctor);
        if (state.myDoctorProfile?._id === id) state.myDoctorProfile = patch(state.myDoctorProfile);
      })
      .addCase(updateDoctorSecurity.rejected, setError('updateDoctorSecurity'));

    builder
      .addCase(updateDoctorPlatformFee.pending,    startLoading('updateDoctorPlatformFee'))
      .addCase(updateDoctorPlatformFee.fulfilled, (state, { payload }) => {
        state.loading.updateDoctorPlatformFee = false;
        const { id, platformFee, hasCustomPlatformFee, settlementCycle } = payload;
        const patch = (d) => ({ ...d, platformFee, hasCustomPlatformFee, settlementCycle });
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx] = patch(state.doctors[idx]);
        if (state.selectedDoctor?._id  === id) state.selectedDoctor  = patch(state.selectedDoctor);
        if (state.myDoctorProfile?._id === id) state.myDoctorProfile = patch(state.myDoctorProfile);
      })
      .addCase(updateDoctorPlatformFee.rejected, setError('updateDoctorPlatformFee'));

    builder
      .addCase(updateDoctorPartnership.pending,    startLoading('updateDoctorPartnership'))
      .addCase(updateDoctorPartnership.fulfilled, (state, { payload }) => {
        state.loading.updateDoctorPartnership = false;
        const { id, partnershipStatus, partnerSince, contractUrl } = payload;
        const patch = (d) => ({ ...d, partnershipStatus, partnerSince, contractUrl });
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx] = patch(state.doctors[idx]);
        if (state.selectedDoctor?._id === id) state.selectedDoctor = patch(state.selectedDoctor);
      })
      .addCase(updateDoctorPartnership.rejected, setError('updateDoctorPartnership'));

    builder
      .addCase(verifyDoctorKyc.pending,    startLoading('verifyDoctorKyc'))
      .addCase(verifyDoctorKyc.fulfilled, (state, { payload }) => {
        state.loading.verifyDoctorKyc = false;
        const { id, kycStatus, isVerified, kycVerifiedAt, kycVerifiedBy,
                kycRejectionReason, kyc } = payload;
        const patch = (d) => ({
          ...d,
          kycStatus,
          isVerified,
          kycVerifiedAt:      kycVerifiedAt      ?? d.kycVerifiedAt,
          kycVerifiedBy:      kycVerifiedBy      ?? d.kycVerifiedBy,
          kycRejectionReason: kycRejectionReason ?? d.kycRejectionReason,
          kyc: kyc ? { ...d.kyc, ...kyc } : d.kyc,
        });
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx] = patch(state.doctors[idx]);
        if (state.selectedDoctor?._id === id) state.selectedDoctor = patch(state.selectedDoctor);
      })
      .addCase(verifyDoctorKyc.rejected, setError('verifyDoctorKyc'));

    builder
      .addCase(toggleDoctorActive.pending,    startLoading('toggleDoctorActive'))
      .addCase(toggleDoctorActive.fulfilled, (state, { payload: { id, isActive } }) => {
        state.loading.toggleDoctorActive = false;
        const idx = state.doctors.findIndex((d) => d._id === id);
        if (idx !== -1) state.doctors[idx].isActive = isActive;
        if (state.selectedDoctor?._id  === id) state.selectedDoctor.isActive  = isActive;
        if (state.myDoctorProfile?._id === id) state.myDoctorProfile.isActive = isActive;
      })
      .addCase(toggleDoctorActive.rejected, setError('toggleDoctorActive'));

    builder
      .addCase(resendDoctorCredentials.pending,    startLoading('resendDoctorCredentials'))
      .addCase(resendDoctorCredentials.fulfilled, stopLoading('resendDoctorCredentials'))
      .addCase(resendDoctorCredentials.rejected,  setError('resendDoctorCredentials'));

    builder
      .addCase(deleteDoctorProfile.pending,    startLoading('deleteDoctorProfile'))
      .addCase(deleteDoctorProfile.fulfilled, (state, { payload: { id } }) => {
        state.loading.deleteDoctorProfile = false;
        state.doctors = state.doctors.filter((d) => d._id !== id);
        if (state.selectedDoctor?._id === id) state.selectedDoctor = null;
      })
      .addCase(deleteDoctorProfile.rejected, setError('deleteDoctorProfile'));
  },
});

// ── Action Exports ────────────────────────────────────────────────────────────
export const {
  clearSelectedHospital,
  clearSelectedDoctor,
  clearHospitalSearchResults,
  clearDoctorSearchResults,
  clearHospitalDoctors,
  clearHospitalEffectivePricing,
  clearMyEffectivePricing,
  clearError,
  resetHospitalState,
  setDoctorOnlineStatus,
} = hospitalSlice.actions;

// ── Selector Exports ──────────────────────────────────────────────────────────

// Hospital
export const selectHospitals                  = (s) => s.hospital.hospitals;
export const selectNearbyHospitals            = (s) => s.hospital.nearbyHospitals;
export const selectHospitalSearchResults      = (s) => s.hospital.searchResults;
export const selectSelectedHospital           = (s) => s.hospital.selectedHospital;
export const selectHospitalTotal              = (s) => s.hospital.hospitalTotal;
export const selectHospitalPage               = (s) => s.hospital.hospitalPage;
export const selectHospitalPages              = (s) => s.hospital.hospitalPages;
export const selectHospitalEffectivePricing   = (s) => s.hospital.hospitalEffectivePricing;
export const selectAvailableForms             = (s) => s.hospital.availableForms;

// Doctor
export const selectDoctors               = (s) => s.hospital.doctors;
export const selectNearbyDoctors         = (s) => s.hospital.nearbyDoctors;
export const selectDoctorSearchResults   = (s) => s.hospital.doctorSearchResults;
export const selectSpecializationDoctors = (s) => s.hospital.specializationDoctors;
export const selectHospitalDoctors       = (s) => s.hospital.hospitalDoctors;
export const selectSelectedDoctor        = (s) => s.hospital.selectedDoctor;
export const selectMyDoctorProfile       = (s) => s.hospital.myDoctorProfile;
export const selectMyManagedHospitals    = (s) => s.hospital.myManagedHospitals;
export const selectMyEffectivePricing    = (s) => s.hospital.myEffectivePricing;
export const selectDoctorStats           = (s) => s.hospital.doctorStats;
export const selectDoctorTotal           = (s) => s.hospital.doctorTotal;
export const selectDoctorPage            = (s) => s.hospital.doctorPage;
export const selectDoctorPages           = (s) => s.hospital.doctorPages;

// Loading — granular per operation
export const selectHospitalLoading                       = (s) => s.hospital.loading;
export const selectIsLoadingHospitals                    = (s) => s.hospital.loading.fetchAllHospitals;
export const selectIsLoadingNearbyHospitals              = (s) => s.hospital.loading.fetchNearbyHospitals;
export const selectIsLoadingSelectedHospital             = (s) =>
  s.hospital.loading.fetchHospitalById || s.hospital.loading.fetchHospitalBySlug;
export const selectIsLoadingDoctors                      = (s) => s.hospital.loading.fetchAllDoctors;
export const selectIsLoadingNearbyDoctors                = (s) => s.hospital.loading.fetchNearbyDoctors;
export const selectIsLoadingSelectedDoctor               = (s) => s.hospital.loading.fetchDoctorById;
export const selectIsLoadingHospitalDoctors              = (s) => s.hospital.loading.fetchDoctorsByHospital;
export const selectIsLoadingHospitalEffectivePricing     = (s) => s.hospital.loading.fetchHospitalEffectivePricing;
export const selectIsLoadingMyEffectivePricing           = (s) => s.hospital.loading.fetchMyEffectivePricing;
export const selectIsUploadingHospitalImages             = (s) => s.hospital.loading.uploadHospitalImages;
export const selectIsDeletingHospitalImage               = (s) => s.hospital.loading.deleteHospitalImage;
export const selectIsUpdatingHospitalConsultationPricing = (s) => s.hospital.loading.updateHospitalConsultationPricing;
export const selectIsResendingHospitalCredentials        = (s) => s.hospital.loading.resendHospitalManagerCredentials;
export const selectIsResendingDoctorCredentials          = (s) => s.hospital.loading.resendDoctorCredentials;
export const selectIsUpdatingDoctorSecurity              = (s) => s.hospital.loading.updateDoctorSecurity;
export const selectIsUpdatingDoctorPlatformFee           = (s) => s.hospital.loading.updateDoctorPlatformFee;
export const selectIsUploadingDoctorPhoto                = (s) => s.hospital.loading.uploadDoctorPhoto;
export const selectIsUploadingDoctorSignature            = (s) => s.hospital.loading.uploadDoctorSignature;
export const selectIsDownloadingHospitalForm             = (s) => s.hospital.loading.downloadHospitalForm;
export const selectIsDownloadingDoctorForm               = (s) => s.hospital.loading.downloadDoctorForm;

// Error
export const selectHospitalError = (s) => s.hospital.error;

export default hospitalSlice.reducer;