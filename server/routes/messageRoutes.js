// routes/messageRoutes.js
import express from 'express';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { messageSendLimiter, reactionLimiter, searchLimiter } from '../utils/rateLimiter.js';
import MessageService from '../services/MessageService.js';
import ReactionService from '../services/ReactionService.js';
import ReadReceiptService from '../services/ReadReceiptService.js';
import {
  validateSendMessage,
  validateEditMessage,
  validateMessageIdParam,
  validateReaction,
  validateListMessages,
  validateMarkRead,
  validateSearchMessages,
} from '../validations/messageValidation.js';

const router = express.Router();
router.use(protect, getDeviceInfo);

// GET /messages/:conversationId — paginated message history
router.get(
  '/:conversationId',
  validateListMessages,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 30, before } = req.query;
    const result = await MessageService.listMessages(req.params.conversationId, req.user._id, { page, limit, before });
    return sendSuccess(res, { message: 'Messages fetched.', data: result.items, pagination: result.pagination });
  })
);

// POST /messages/:conversationId — send a message
router.post(
  '/:conversationId',
  messageSendLimiter,
  validateSendMessage,
  asyncHandler(async (req, res) => {
    const message = await MessageService.sendMessage(req.user, req.params.conversationId, req.body);
    return sendSuccess(res, { statusCode: 201, message: 'Message sent.', data: message });
  })
);

// PATCH /messages/message/:messageId — edit (within 5-min window)
router.patch(
  '/message/:messageId',
  validateEditMessage,
  asyncHandler(async (req, res) => {
    const message = await MessageService.editMessage(req.user, req.params.messageId, req.body.body);
    return sendSuccess(res, { message: 'Message edited.', data: message });
  })
);

// DELETE /messages/message/:messageId/me
router.delete(
  '/message/:messageId/me',
  validateMessageIdParam,
  asyncHandler(async (req, res) => {
    const result = await MessageService.deleteForMe(req.user._id, req.params.messageId);
    return sendSuccess(res, { message: 'Message deleted for you.', data: result });
  })
);

// DELETE /messages/message/:messageId/everyone
router.delete(
  '/message/:messageId/everyone',
  validateMessageIdParam,
  asyncHandler(async (req, res) => {
    const message = await MessageService.deleteForEveryone(req.user, req.params.messageId);
    return sendSuccess(res, { message: 'Message deleted for everyone.', data: message });
  })
);

// POST /messages/message/:messageId/forward/:targetConversationId
router.post(
  '/message/:messageId/forward/:targetConversationId',
  validateMessageIdParam,
  asyncHandler(async (req, res) => {
    const message = await MessageService.forwardMessage(req.user, req.params.messageId, req.params.targetConversationId);
    return sendSuccess(res, { statusCode: 201, message: 'Message forwarded.', data: message });
  })
);

// POST /messages/:conversationId/read — mark read up to a message
router.post(
  '/:conversationId/read',
  validateMarkRead,
  asyncHandler(async (req, res) => {
    const result = await MessageService.markRead(req.params.conversationId, req.user._id, req.body.upToMessageId);
    return sendSuccess(res, { message: 'Marked as read.', data: result });
  })
);

// GET /messages/:conversationId/search?q=
router.get(
  '/:conversationId/search',
  searchLimiter,
  validateSearchMessages,
  asyncHandler(async (req, res) => {
    const { q, page = 1, limit = 20 } = req.query;
    const result = await MessageService.searchMessages(req.params.conversationId, req.user._id, q, { page, limit });
    return sendSuccess(res, { message: 'Search results.', data: result.items, pagination: result.pagination });
  })
);

// POST /messages/message/:messageId/react
router.post(
  '/message/:messageId/react',
  reactionLimiter,
  validateReaction,
  asyncHandler(async (req, res) => {
    const reaction = await ReactionService.react(req.user, req.params.messageId, req.body.emoji);
    return sendSuccess(res, { message: 'Reaction added.', data: reaction });
  })
);

// DELETE /messages/message/:messageId/react
router.delete(
  '/message/:messageId/react',
  validateMessageIdParam,
  asyncHandler(async (req, res) => {
    await ReactionService.removeReaction(req.user, req.params.messageId);
    return sendSuccess(res, { message: 'Reaction removed.' });
  })
);

// GET /messages/message/:messageId/reactions
router.get(
  '/message/:messageId/reactions',
  validateMessageIdParam,
  asyncHandler(async (req, res) => {
    const reactions = await ReactionService.getReactionsForMessage(req.params.messageId);
    return sendSuccess(res, { message: 'Reactions fetched.', data: reactions });
  })
);

// GET /messages/message/:messageId/read-by
router.get(
  '/message/:messageId/read-by',
  validateMessageIdParam,
  asyncHandler(async (req, res) => {
    const readers = await ReadReceiptService.getReadersForMessage(req.params.messageId);
    return sendSuccess(res, { message: 'Read receipts fetched.', data: readers });
  })
);

export default router;
