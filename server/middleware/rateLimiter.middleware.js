// middlewares/rateLimiter.middleware.js
//
// HTTP-layer rate limiting for endpoints that don't go through the socket
// message path (socket messages are rate-limited directly inside
// message.service.js#sendMessage via the same Redis helper). This
// middleware covers ticket creation and any REST fallback for sending
// messages.

import { checkTicketCreateRateLimit } from '../utils/supportRedis.util.js';
import { TICKET_CREATE_RATE_LIMIT } from '../constants/support.constants.js';
import { RateLimitError } from '../utils/errors.js';
import asyncHandler from '../utils/asyncHandler.js';

export const ticketCreateRateLimiter = asyncHandler(async (req, res, next) => {
  const result = await checkTicketCreateRateLimit(req.user._id, TICKET_CREATE_RATE_LIMIT);
  if (!result.allowed) {
    throw new RateLimitError('You have created too many tickets recently. Please try again later.');
  }
  next();
});
