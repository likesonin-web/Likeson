// routes/attachmentRoutes.js
import express from 'express';
import multer from 'multer';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { uploadLimiter, searchLimiter } from '../utils/rateLimiter.js';
import AttachmentService from '../services/AttachmentService.js';
import PermissionService from '../services/PermissionService.js';
import {
  validateAttachmentIdParam,
  validateConversationIdParam,
  validateAttachmentSearch,
} from '../validations/attachmentValidation.js';
import { MAX_ATTACHMENT_SIZE_BYTES } from '../constants/messageConstants.js';

const upload = multer({
  storage: multer.memoryStorage(), // never write to disk / never store in Mongo
  limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
});

const router = express.Router();
router.use(protect, getDeviceInfo);

// POST /attachments/:conversationId — upload a file into a conversation
router.post(
  '/:conversationId',
  uploadLimiter,
  validateConversationIdParam,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    await PermissionService.assertIsActiveMember(req.params.conversationId, req.user._id);
    const attachment = await AttachmentService.uploadAndCreate({
      file: req.file,
      uploadedBy: req.user._id,
      conversationId: req.params.conversationId,
    });
    return sendSuccess(res, { statusCode: 201, message: 'File uploaded.', data: attachment });
  })
);

// GET /attachments/:attachmentId
router.get(
  '/item/:attachmentId',
  validateAttachmentIdParam,
  asyncHandler(async (req, res) => {
    const attachment = await AttachmentService.getById(req.params.attachmentId);
    return sendSuccess(res, { message: 'Attachment fetched.', data: attachment });
  })
);

// DELETE /attachments/:attachmentId
router.delete(
  '/item/:attachmentId',
  validateAttachmentIdParam,
  asyncHandler(async (req, res) => {
    const attachment = await AttachmentService.softDelete(req.params.attachmentId, req.user._id);
    return sendSuccess(res, { message: 'Attachment deleted.', data: attachment });
  })
);

// GET /attachments/:conversationId/search
router.get(
  '/:conversationId/search',
  searchLimiter,
  validateAttachmentSearch,
  asyncHandler(async (req, res) => {
    await PermissionService.assertIsActiveMember(req.params.conversationId, req.user._id);
    const { mimeType, page = 1, limit = 20 } = req.query;
    const result = await AttachmentService.searchInConversation(req.params.conversationId, { mimeType, page, limit });
    return sendSuccess(res, { message: 'Attachments fetched.', data: result.items });
  })
);

export default router;
