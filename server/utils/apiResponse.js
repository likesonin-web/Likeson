// utils/apiResponse.js
// Every route in this module MUST respond through these helpers so the
// response shape is identical everywhere: { success, message, data, errors, meta, pagination }

export const sendSuccess = (res, {
  statusCode = 200,
  message = 'Success',
  data = null,
  meta = null,
  pagination = null,
} = {}) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    errors: null,
    meta,
    pagination,
  });
};

export const sendError = (res, {
  statusCode = 400,
  message = 'Something went wrong',
  errors = null,
} = {}) => {
  return res.status(statusCode).json({
    success: false,
    message,
    data: null,
    errors,
    meta: null,
    pagination: null,
  });
};

/**
 * ApiError — thrown from Services, caught by the global error middleware.
 * Services should never touch `res` directly; they throw this instead.
 */
export class ApiError extends Error {
  constructor(statusCode, message, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isApiError = true;
  }
}

/**
 * Global error-handling Express middleware. Mount LAST, after all routers.
 * Never leaks stack traces to the client.
 */
export const errorMiddleware = (err, req, res, _next) => {
  if (err?.isApiError) {
    return sendError(res, {
      statusCode: err.statusCode,
      message: err.message,
      errors: err.errors,
    });
  }

  if (err?.name === 'ValidationError') {
    return sendError(res, {
      statusCode: 422,
      message: 'Validation failed.',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err?.name === 'CastError') {
    return sendError(res, { statusCode: 400, message: 'Invalid identifier supplied.' });
  }

  if (err?.code === 11000) {
    return sendError(res, { statusCode: 409, message: 'Duplicate resource.' });
  }

  console.error('[UnhandledError]', err);
  return sendError(res, { statusCode: 500, message: 'Internal server error.' });
};

export const buildPagination = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(Math.ceil(total / limit), 1),
  hasNextPage: page * limit < total,
  hasPrevPage: page > 1,
});
