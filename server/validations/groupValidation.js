// validations/groupValidation.js
import { body, param } from 'express-validator';
import { handleValidation } from './handleValidation.js';

export const validateCreateGroup = [
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  body('memberIds').isArray({ min: 1 }),
  body('memberIds.*').isMongoId(),
  handleValidation,
];

export const validateGroupIdParam = [
  param('conversationId').isMongoId(),
  handleValidation,
];

export const validateRenameGroup = [
  param('conversationId').isMongoId(),
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  handleValidation,
];

export const validateMemberIds = [
  param('conversationId').isMongoId(),
  body('memberIds').isArray({ min: 1 }),
  body('memberIds.*').isMongoId(),
  handleValidation,
];

export const validateTargetUser = [
  param('conversationId').isMongoId(),
  param('userId').isMongoId(),
  handleValidation,
];

export const validateLockGroup = [
  param('conversationId').isMongoId(),
  body('locked').isBoolean(),
  handleValidation,
];

export const validateMuteMember = [
  param('conversationId').isMongoId(),
  param('userId').isMongoId(),
  body('muted').isBoolean(),
  body('mutedUntil').optional().isISO8601(),
  handleValidation,
];
