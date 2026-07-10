// utils/errors.js
//
// Typed error hierarchy. Every service throws one of these instead of a
// bare Error/string so errorHandler.middleware.js can map to the correct
// HTTP status + stable error `code` without string-matching messages.

export class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found.`, 404, 'NOT_FOUND');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please slow down.', retryAfterSeconds = null) {
    super(message, 429, 'RATE_LIMITED', { retryAfterSeconds });
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(from, to) {
    super(`Cannot transition ticket status from '${from}' to '${to}'.`, 422, 'INVALID_STATUS_TRANSITION', { from, to });
  }
}

export class FileValidationError extends AppError {
  constructor(message) {
    super(message, 415, 'FILE_VALIDATION_ERROR');
  }
}

export class SocketAuthError extends AppError {
  constructor(message = 'Socket authentication failed.') {
    super(message, 401, 'SOCKET_AUTH_ERROR');
  }
}

// ── ObjectId validation ─────────────────────────────────────────────────────
// Client-supplied ids (socket payloads especially — they never pass through
// Joi validation the way REST bodies do) must be checked BEFORE they reach
// a Mongoose query. An invalid string thrown as a raw CastError inside an
// async handler becomes an unhandled promise rejection, which crashes the
// whole process on modern Node — this turns that into a clean, typed 400
// instead of a server crash.
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

export function isValidObjectId(value) {
  return typeof value === 'string' && OBJECT_ID_RE.test(value);
}

export function assertValidObjectId(value, label = 'id') {
  if (!isValidObjectId(value)) {
    throw new ValidationError(`Invalid ${label}: '${value}' is not a valid id.`);
  }
}