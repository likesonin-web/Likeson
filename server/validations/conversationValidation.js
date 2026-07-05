// validations/conversationValidation.js
import { body, param, query } from 'express-validator';
import { CONVERSATION_TYPES } from '../constants/conversationConstants.js';
import { handleValidation } from './handleValidation.js';

export const validateCreateDirectConversation = [
  body('targetUserId').isMongoId().withMessage('targetUserId must be a valid id.'),
  handleValidation,
];

export const validateConversationIdParam = [
  param('conversationId').isMongoId().withMessage('Invalid conversation id.'),
  handleValidation,
];

export const validateListConversations = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('archived').optional().isBoolean().toBoolean(),
  query('search').optional().isString().trim().isLength({ max: 100 }),
  handleValidation,
];

export const validateMuteConversation = [
  param('conversationId').isMongoId(),
  body('muted').isBoolean(),
  body('mutedUntil').optional().isISO8601(),
  handleValidation,
];

export const validateConversationType = [
  body('type').isIn(CONVERSATION_TYPES),
  handleValidation,
];
