// middlewares/errorHandler.middleware.js
//
// Consistent response envelope for every error path in the module:
//   { success: false, message, code, details? }
// Non-operational (unexpected/programmer) errors are logged with full
// stack server-side but never leak internals to the client.

import { AppError } from '../utils/errors.js';

export const supportErrorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      details: err.details ?? undefined,
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError' && err.errors) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return res.status(400).json({ success: false, message: 'Validation failed.', code: 'VALIDATION_ERROR', details });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
      code: 'DUPLICATE_KEY',
      details: err.keyValue,
    });
  }

  console.error('[SupportModule] Unhandled error:', err);
  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again.',
    code: 'INTERNAL_ERROR',
  });
};
