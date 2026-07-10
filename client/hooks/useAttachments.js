// src/hooks/useAttachments.js
'use client';
import { useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  uploadAttachment, registerPendingUpload, clearUpload, generateUploadId, selectUploadsById,
} from '@/store/slices/attachmentSlice';
import { SUPPORTED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from '../constants/chatConstants';
import toast from 'react-hot-toast';

export function useAttachments(conversationId) {
  const dispatch = useDispatch();
  const uploadsById = useSelector(selectUploadsById);
  const controllersRef = useRef({}); // clientUploadId -> thunk promise (for .abort())

  const upload = useCallback((file) => {
    if (!SUPPORTED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
      toast.error(`Unsupported file type: ${file.type}`);
      return null;
    }
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      toast.error('File exceeds the 100MB size limit.');
      return null;
    }

    const clientUploadId = generateUploadId();
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

    dispatch(registerPendingUpload({ clientUploadId, fileName: file.name, previewUrl, mimeType: file.type }));

    const promise = dispatch(uploadAttachment({ conversationId, file, clientUploadId }));
    controllersRef.current[clientUploadId] = promise;

    return clientUploadId;
  }, [dispatch, conversationId]);

  const cancel = useCallback((clientUploadId) => {
    controllersRef.current[clientUploadId]?.abort?.();
    delete controllersRef.current[clientUploadId];
  }, []);

  const retry = useCallback((clientUploadId, file) => {
    dispatch(clearUpload(clientUploadId));
    return upload(file);
  }, [dispatch, upload]);

  const dismiss = useCallback((clientUploadId) => {
    dispatch(clearUpload(clientUploadId));
  }, [dispatch]);

  return { uploadsById, upload, cancel, retry, dismiss };
}
