/**
 * faqROutes.js — Likeson.in
 * Business logic lives in controllers/faq.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/faq.controller.js';

const router = express.Router();

// 1. Define the validate middleware to resolve your ReferenceError
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 2. Define faqValidation rules (this was also missing and would cause a crash)
// Note: Adjust the fields here if your FAQ schema requires different ones!
const faqValidation = [
  body('question').trim().notEmpty().withMessage('Question is required'),
  body('answer').trim().notEmpty().withMessage('Answer is required'),
  body('category').optional().isString(),
  validate // Automatically catches errors for these body checks
];

router.get('/', [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('category').optional().isString(),
    query('search').optional().isString(),
    validate
  ], ctrl.get);

router.post('/', protect, authorize('admin', 'superadmin'), faqValidation, ctrl.post);

router.patch('/:id/like', protect, [
    param('id').isMongoId().withMessage('Invalid ID format'), 
    validate
  ], ctrl.patchByIdLike);

router.put('/:id', protect, authorize('admin', 'superadmin'), [
    param('id').isMongoId().withMessage('Invalid ID format'),
    ...faqValidation 
  ], ctrl.putById);

router.delete('/:id', protect, authorize('superadmin'), [
    param('id').isMongoId().withMessage('Invalid ID format'), 
    validate
  ], ctrl.deleteById);

router.get('/stats/by-category', protect, authorize('admin', 'superadmin', 'doctor'), ctrl.getStatsByCategory);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;