// src/redux/slices/attachmentSlice.js
//
// Handles ImageKit-backed file upload via the backend's /support/attachments
// routes (backend proxies to ImageKit — this slice never talks to ImageKit
// directly, keeping the private key server-side only). Upload progress is
// tracked per clientUploadId so multiple concurrent uploads don't collide.

import { createSlice, createAsyncThunk, nanoid } from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';

const extractError = (err, fallback = 'Upload failed. Please try again.') => {
  const serverMsg = err?.response?.data?.message;
  if (typeof serverMsg === 'string' && serverMsg.length < 300) return serverMsg;
  if (err?.message === 'Network Error') return 'No internet connection. Please check your network.';
  return fallback;
};

export const uploadAttachment = createAsyncThunk(
  'attachments/upload',
  async ({ conversationId, file, clientUploadId }, { dispatch, rejectWithValue, signal }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const controller = new AbortController();
      signal.addEventListener('abort', () => controller.abort());

      const { data } = await API.post(`/support/attachments/${conversationId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal: controller.signal,
        onUploadProgress: (evt) => {
          const percent = evt.total ? Math.round((evt.loaded * 100) / evt.total) : 0;
          dispatch(setUploadProgress({ clientUploadId, percent }));
        },
      });
      return { clientUploadId, attachment: data.data };
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        return rejectWithValue({ clientUploadId, message: 'Upload cancelled.', cancelled: true });
      }
      return rejectWithValue({ clientUploadId, message: extractError(err) });
    }
  }
);

export const deleteAttachment = createAsyncThunk(
  'attachments/delete',
  async (attachmentId, { rejectWithValue }) => {
    try {
      await API.delete(`/support/attachments/item/${attachmentId}`);
      return attachmentId;
    } catch (err) {
      const msg = extractError(err, 'Could not delete attachment.');
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

export const searchAttachments = createAsyncThunk(
  'attachments/search',
  async ({ conversationId, mimeType, page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/support/attachments/${conversationId}/search`, {
        params: { mimeType, page, limit },
      });
      return { conversationId, items: data.data };
    } catch (err) {
      return rejectWithValue(extractError(err, 'Could not load attachments.'));
    }
  }
);

const initialState = {
  uploadsById: {}, // clientUploadId -> { fileName, percent, status: 'uploading'|'done'|'failed'|'cancelled', attachment? }
  galleryByConversation: {}, // conversationId -> items[]
  loaders: { search: false },
};

const attachmentSlice = createSlice({
  name: 'attachments',
  initialState,
  reducers: {
    setUploadProgress: (state, action) => {
      const { clientUploadId, percent } = action.payload;
      if (state.uploadsById[clientUploadId]) state.uploadsById[clientUploadId].percent = percent;
    },
    registerPendingUpload: (state, action) => {
      const { clientUploadId, fileName, previewUrl, mimeType } = action.payload;
      state.uploadsById[clientUploadId] = { fileName, previewUrl, mimeType, percent: 0, status: 'uploading' };
    },
    clearUpload: (state, action) => {
      delete state.uploadsById[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(uploadAttachment.fulfilled, (state, action) => {
        const { clientUploadId, attachment } = action.payload;
        if (state.uploadsById[clientUploadId]) {
          state.uploadsById[clientUploadId].status = 'done';
          state.uploadsById[clientUploadId].attachment = attachment;
          state.uploadsById[clientUploadId].percent = 100;
        }
      })
      .addCase(uploadAttachment.rejected, (state, action) => {
        const { clientUploadId, message, cancelled } = action.payload || {};
        if (clientUploadId && state.uploadsById[clientUploadId]) {
          state.uploadsById[clientUploadId].status = cancelled ? 'cancelled' : 'failed';
        }
        if (!cancelled) toast.error(message || 'Upload failed.');
      })
      .addCase(searchAttachments.pending, (state) => { state.loaders.search = true; })
      .addCase(searchAttachments.fulfilled, (state, action) => {
        state.loaders.search = false;
        state.galleryByConversation[action.payload.conversationId] = action.payload.items;
      })
      .addCase(searchAttachments.rejected, (state) => { state.loaders.search = false; });
  },
});

export const { setUploadProgress, registerPendingUpload, clearUpload } = attachmentSlice.actions;

export const generateUploadId = () => nanoid();

export const selectUploadsById = (s) => s.attachments.uploadsById;
export const selectUpload = (id) => (s) => s.attachments.uploadsById[id];
export const selectGalleryForConversation = (conversationId) => (s) =>
  s.attachments.galleryByConversation[conversationId] ?? [];

export default attachmentSlice.reducer;
