// utils/imagekitUpload.util.js
//
// All ImageKit interaction for the support module goes through here.
// Credentials are read from environment ONLY — never hardcoded. If this
// process's env is missing any of these three, fail loudly at startup
// rather than silently uploading with bad/missing auth.

import ImageKit from 'imagekit';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../constants/support.constants.js';
import { FileValidationError } from './errors.js';

const REQUIRED_ENV = ['IMAGEKIT_PUBLIC_KEY', 'IMAGEKIT_PRIVATE_KEY', 'IMAGEKIT_URL_ENDPOINT'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`[imagekitUpload] Missing required env var: ${key}`);
  }
}

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

/**
 * Validates a file's declared type/size BEFORE any upload attempt.
 * @param {string} fileType  one of 'image' | 'video' | 'pdf' | 'audio'
 * @param {string} mimeType
 * @param {number} sizeBytes
 */
export function validateFile(fileType, mimeType, sizeBytes) {
  const allowedMimes = ALLOWED_MIME_TYPES[fileType];
  if (!allowedMimes) {
    throw new FileValidationError(`Unsupported file category: ${fileType}`);
  }
  if (!allowedMimes.includes(mimeType)) {
    throw new FileValidationError(
      `MIME type '${mimeType}' is not allowed for ${fileType} attachments. Allowed: ${allowedMimes.join(', ')}`
    );
  }
  const maxSize = MAX_FILE_SIZE_BYTES[fileType];
  if (sizeBytes > maxSize) {
    throw new FileValidationError(
      `File exceeds maximum size of ${(maxSize / (1024 * 1024)).toFixed(0)}MB for ${fileType} attachments.`
    );
  }
}

/**
 * @param {Buffer|string} fileData   Buffer or base64 string
 * @param {string} fileName
 * @param {string} folder            e.g. `support-tickets/${ticketId}`
 */
export async function uploadToImageKit(fileData, fileName, folder) {
  const result = await imagekit.upload({
    file: fileData,
    fileName,
    folder,
    useUniqueFileName: true,
  });
  return {
    fileId: result.fileId,
    url: result.url,
    thumbnailUrl: result.thumbnailUrl ?? null,
    filePath: result.filePath,
    size: result.size,
  };
}

export async function deleteFromImageKit(fileId) {
  try {
    await imagekit.deleteFile(fileId);
  } catch (err) {
    // Non-fatal — orphaned ImageKit file is a cleanup-job concern, must
    // never block the caller's soft-delete of the DB record.
    console.error('[imagekitUpload] deleteFile failed:', fileId, err.message);
  }
}

export function getSignedUrl(filePath, expirySeconds = 3600) {
  return imagekit.url({
    path: filePath,
    signed: true,
    expireSeconds: expirySeconds,
  });
}
