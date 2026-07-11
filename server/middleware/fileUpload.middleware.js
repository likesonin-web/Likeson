// middlewares/fileUpload.middleware.js

import multer from 'multer';
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from '../constants/support.constants.js';
import { FileValidationError } from '../utils/errors.js';

// Memory storage — files are streamed straight to ImageKit in the service
// layer, never written to local disk (irrelevant/unsafe under multi-instance
// horizontal scaling for 10k concurrent users; no shared local filesystem
// to rely on).
const storage = multer.memoryStorage();

const MAX_UPLOAD_BYTES = Math.max(...Object.values(MAX_FILE_SIZE_BYTES)); // widest cap; per-type cap re-checked in service
const ALL_ALLOWED_MIMES = new Set(Object.values(ALLOWED_MIME_TYPES).flat());

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    // MediaRecorder-produced audio arrives as e.g. "audio/webm;codecs=opus" —
    // strip the codec suffix before checking against the plain-mimetype set.
    const baseMimeType = file.mimetype?.split(';')[0]?.trim();
    if (!ALL_ALLOWED_MIMES.has(baseMimeType)) {
      return cb(new FileValidationError(`File type '${file.mimetype}' is not permitted.`));
    }
    cb(null, true);
  },
}).single('file');

// Wraps multer's callback-style middleware so its errors flow into the
// standard Express error-handling chain (asyncHandler pattern expects a
// promise-returning function; multer's .single() is callback-based).
export const handleFileUpload = (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return next(new FileValidationError(err.message));
    }
    if (err) return next(err);
    next();
  });
};