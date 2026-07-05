// validations/attachmentValidation.js
import { param, query } from 'express-validator';
import { SUPPORTED_ATTACHMENT_MIME_TYPES } from '../constants/messageConstants.js';
import { handleValidation } from './handleValidation.js';

export const validateAttachmentIdParam = [
  param('attachmentId').isMongoId(),
  handleValidation,
];

export const validateConversationIdParam = [
  param('conversationId').isMongoId(),
  handleValidation,
];

export const validateAttachmentSearch = [
  param('conversationId').isMongoId(),
  query('mimeType').optional().isIn(SUPPORTED_ATTACHMENT_MIME_TYPES),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidation,
];
