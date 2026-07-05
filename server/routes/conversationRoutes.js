// routes/conversationRoutes.js
//
// Routes contain ONLY: route def, validation, auth, authorization, service
// call, response. No business logic lives here.

import express from 'express';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import ConversationService from '../services/ConversationService.js';
import {
  validateCreateDirectConversation,
  validateConversationIdParam,
  validateListConversations,
  validateMuteConversation,
} from '../validations/conversationValidation.js';

const router = express.Router();
router.use(protect, getDeviceInfo);

// GET /conversations — list current user's conversations
router.get(
  '/',
  validateListConversations,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, archived = false, search } = req.query;
    const result = await ConversationService.listForUser(req.user._id, { page, limit, archived, search });
    return sendSuccess(res, { message: 'Conversations fetched.', data: result.items, pagination: result.pagination });
  })
);

// POST /conversations/direct — get or create a 1:1 conversation
router.post(
  '/direct',
  validateCreateDirectConversation,
  asyncHandler(async (req, res) => {
    const conversation = await ConversationService.getOrCreateDirectConversation(req.user, req.body.targetUserId);
    return sendSuccess(res, { statusCode: 201, message: 'Conversation ready.', data: conversation });
  })
);

// GET /conversations/:conversationId
router.get(
  '/:conversationId',
  validateConversationIdParam,
  asyncHandler(async (req, res) => {
    const conversation = await ConversationService.getByIdForUser(req.params.conversationId, req.user._id);
    return sendSuccess(res, { message: 'Conversation fetched.', data: conversation });
  })
);

// PATCH /conversations/:conversationId/archive
router.patch(
  '/:conversationId/archive',
  validateConversationIdParam,
  asyncHandler(async (req, res) => {
    const member = await ConversationService.archiveForUser(req.params.conversationId, req.user._id, req.body.archived !== false);
    return sendSuccess(res, { message: 'Conversation archive state updated.', data: member });
  })
);

// PATCH /conversations/:conversationId/pin
router.patch(
  '/:conversationId/pin',
  validateConversationIdParam,
  asyncHandler(async (req, res) => {
    const member = await ConversationService.pinForUser(req.params.conversationId, req.user._id, req.body.pinned !== false);
    return sendSuccess(res, { message: 'Conversation pin state updated.', data: member });
  })
);

// PATCH /conversations/:conversationId/mute
router.patch(
  '/:conversationId/mute',
  validateMuteConversation,
  asyncHandler(async (req, res) => {
    const member = await ConversationService.muteForUser(req.params.conversationId, req.user._id, {
      muted: req.body.muted,
      mutedUntil: req.body.mutedUntil || null,
    });
    return sendSuccess(res, { message: 'Conversation mute state updated.', data: member });
  })
);

// DELETE /conversations/:conversationId
router.delete(
  '/:conversationId',
  validateConversationIdParam,
  asyncHandler(async (req, res) => {
    const conversation = await ConversationService.deleteConversation(req.params.conversationId, req.user);
    return sendSuccess(res, { message: 'Conversation deleted.', data: conversation });
  })
);

export default router;
