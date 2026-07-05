// validations/complaintValidation.js
import { body, param, query } from 'express-validator';
import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES, COMPLAINT_STATUSES } from '../constants/complaintConstants.js';
import { handleValidation } from './handleValidation.js';

export const validateCreateComplaint = [
  body('category').isIn(COMPLAINT_CATEGORIES),
  body('priority').isIn(COMPLAINT_PRIORITIES),
  body('description').optional().isString().trim().isLength({ max: 4000 }),
  body('adminRecipientId').optional().isMongoId(),
  handleValidation,
];

export const validateUpdateComplaintStatus = [
  param('conversationId').isMongoId(),
  body('status').isIn(COMPLAINT_STATUSES),
  body('note').optional().isString().trim().isLength({ max: 1000 }),
  handleValidation,
];

export const validateAssignComplaint = [
  param('conversationId').isMongoId(),
  body('assigneeId').isMongoId(),
  handleValidation,
];

export const validateComplaintDashboardQuery = [
  query('status').optional().isIn(COMPLAINT_STATUSES),
  query('priority').optional().isIn(COMPLAINT_PRIORITIES),
  query('category').optional().isIn(COMPLAINT_CATEGORIES),
  query('assignedTo').optional().isMongoId(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  handleValidation,
];

export const validateConversationIdParam = [
  param('conversationId').isMongoId(),
  handleValidation,
];
