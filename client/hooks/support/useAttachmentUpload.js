// hooks/support/useAttachmentUpload.js

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDispatch } from 'react-redux';
import { nanoid } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { optimisticSendMessage, sendMediaMessage } from '../../store/slices/chatSlice';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../../features/support/constants/support.constants';

const ALL_ALLOWED_MIMES = Object.values(ALLOWED_MIME_TYPES).flat();

function classifyFile(mimeType) {
  return Object.entries(ALLOWED_MIME_TYPES).find(([, mimes]) => mimes.includes(mimeType))?.[0] ?? null;
}

/**
 * @param {string} ticketId
 * @param {{_id: string, name: string, role: string}} currentUser
 */
export function useAttachmentUpload(ticketId, currentUser) {
  const dispatch = useDispatch();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(
    async (file) => {
      const fileType = classifyFile(file.type);
      if (!fileType) {
        toast.error(`"${file.name}" isn't a supported file type.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES[fileType]) {
        toast.error(`"${file.name}" is too large (max ${(MAX_FILE_SIZE_BYTES[fileType] / (1024 * 1024)).toFixed(0)}MB).`);
        return;
      }

      const clientMessageId = nanoid();
      const previewUrl = ['image', 'video', 'audio'].includes(fileType) ? URL.createObjectURL(file) : null;

      dispatch(
        optimisticSendMessage({
          ticketId,
          clientMessageId,
          tempMessage: {
            ticket: ticketId,
            sender: currentUser,
            senderRole: currentUser.role,
            messageType: fileType,
            text: '',
            attachment: {
              url: previewUrl,
              originalName: file.name,
              sizeBytes: file.size,
              mimeType: file.type,
              fileType,
            },
            createdAt: new Date().toISOString(),
          },
        })
      );

      const formData = new FormData();
      formData.append('file', file);

      setIsUploading(true);
      setUploadProgress(0);

      await dispatch(
        sendMediaMessage({
          ticketId,
          clientMessageId,
          formData,
          onUploadProgress: (evt) => {
            if (evt.total) setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          },
        })
      );

      setIsUploading(false);
      setUploadProgress(0);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [ticketId, currentUser, dispatch]
  );

  const onDrop = useCallback(
    (acceptedFiles, rejectedFiles) => {
      rejectedFiles.forEach((rejection) => {
        toast.error(`"${rejection.file.name}" was rejected: ${rejection.errors[0]?.message ?? 'invalid file'}`);
      });
      acceptedFiles.forEach(uploadFile);
    },
    [uploadFile]
  );

  const dropzone = useDropzone({
    onDrop,
    accept: ALL_ALLOWED_MIMES.reduce((acc, mime) => ({ ...acc, [mime]: [] }), {}),
    maxSize: Math.max(...Object.values(MAX_FILE_SIZE_BYTES)),
    noClick: true, // the paperclip button triggers the dialog explicitly
  });

  /** For clipboard-paste upload — call from the composer's onPaste handler */
  const handlePaste = useCallback(
    (clipboardEvent) => {
      const items = Array.from(clipboardEvent.clipboardData?.items || []);
      const files = items.filter((item) => item.kind === 'file').map((item) => item.getAsFile()).filter(Boolean);
      files.forEach(uploadFile);
    },
    [uploadFile]
  );

  return {
    ...dropzone,
    uploadFile,
    handlePaste,
    isUploading,
    uploadProgress,
  };
}

export default useAttachmentUpload;
