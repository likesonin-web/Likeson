// utils/rateLimiter.js
// Thin wrapper around express-rate-limit so every limiter in this module
// shares one response shape and one key strategy (per authenticated user,
// falling back to IP for unauthenticated socket-adjacent REST calls).

import rateLimit from 'express-rate-limit';
import { sendError } from './apiResponse.js';

export const makeRateLimiter = ({ windowMs, max, message = 'Too many requests. Please slow down.' }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { ip: false }, // Disables strict IPv6 validation for the custom keyGenerator
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    handler: (req, res) => sendError(res, { statusCode: 429, message }),
  });

export const messageSendLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'You are sending messages too fast.',
});

export const typingLimiter = makeRateLimiter({
  windowMs: 10 * 1000,
  max: 30,
  message: 'Typing signal rate exceeded.',
});

export const reactionLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many reactions in a short time.',
});

export const uploadLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Upload rate limit exceeded.',
});

export const searchLimiter = makeRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Search rate limit exceeded.',
});