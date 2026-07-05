import { body, param, query } from 'express-validator';
import { MESSAGE_TYPES, REACTION_EMOJIS } from '../constants/messageConstants.js';
import { handleValidation } from './handleValidation.js';

export const validateSendMessage = [
  param('conversationId').isMongoId(),
  body('type').optional().isIn(MESSAGE_TYPES),
  body('body').if((value, { req }) => req.body.type === 'text' || !req.body.type)
    .isString().trim().isLength({ min: 1, max: 8000 }).withMessage('Message body is required (1-8000 chars).'),
  body('attachmentId').optional().isMongoId(),
  body('replyTo').optional().isMongoId(),
  body('clientMessageId').optional().isString().isLength({ max: 100 }),
  body('mentions').optional().isArray(),
  body('mentions.*.user').optional().isMongoId(),
  handleValidation,
];

export const validateEditMessage = [
  param('messageId').isMongoId(),
  body('body').isString().trim().isLength({ min: 1, max: 8000 }),
  handleValidation,
];

export const validateMessageIdParam = [
  param('messageId').isMongoId(),
  handleValidation,
];

export const validateReaction = [
  param('messageId').isMongoId(),
  body('emoji').isIn(REACTION_EMOJIS),
  handleValidation,
];

export const validateListMessages = [
  param('conversationId').isMongoId(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('before').optional().isISO8601(),
  handleValidation,
];

export const validateMarkRead = [
  param('conversationId').isMongoId(),
  body('upToMessageId').isMongoId(),
  handleValidation,
];

export const validateSearchMessages = [
  param('conversationId').isMongoId(),
  query('q').isString().trim().isLength({ min: 1, max: 200 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidation,
];