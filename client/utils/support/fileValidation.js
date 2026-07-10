// utils/support/fileValidation.js

import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../../features/support/constants/support.constants';

export function classifyFile(mimeType) {
  return Object.entries(ALLOWED_MIME_TYPES).find(([, mimes]) => mimes.includes(mimeType))?.[0] ?? null;
}

/**
 * @returns {{ valid: boolean, error?: string, fileType?: string }}
 */
export function validateFile(file) {
  const fileType = classifyFile(file.type);
  if (!fileType) {
    return { valid: false, error: `"${file.name}" isn't a supported file type.` };
  }
  const maxSize = MAX_FILE_SIZE_BYTES[fileType];
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `"${file.name}" is too large (max ${(maxSize / (1024 * 1024)).toFixed(0)}MB for ${fileType}).`,
    };
  }
  return { valid: true, fileType };
}
