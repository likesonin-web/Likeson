// utils/asyncHandler.js
// Wraps async route handlers so rejected promises reach Express's error middleware
// instead of crashing the process or hanging the request.

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
