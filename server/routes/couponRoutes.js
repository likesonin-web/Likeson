/**
 * couponRoutes.js — Likeson.in
 * Business logic lives in controllers/coupon.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/coupon.controller.js';

const router = express.Router();

// 1. Define the validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 2. Define coupon validation rules
const couponValidation = [
  body('code').trim().notEmpty().withMessage('Coupon code is required').toUpperCase(),
  body('discountPercent').isNumeric().withMessage('Discount percent must be a number'),
  body('minOrderValue').optional().isNumeric(),
  body('expiryDate').optional().isISO8601().toDate(),
  body('isActive').optional().isBoolean(),
  validateRequest // This runs the validation result check automatically
];

router.post('/', protect, authorize('admin', 'superadmin'), couponValidation, ctrl.post);

router.get('/', protect, authorize('admin', 'superadmin'), [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('isActive').optional().isBoolean().toBoolean(),
    validateRequest
  ], ctrl.get);

router.post('/validate', protect, [
    body('code').notEmpty().toUpperCase().trim(),
    body('orderValue').isNumeric().withMessage('Order value is required for validation'),
    validateRequest
  ], ctrl.postValidate);

router.patch('/:id', protect, authorize('admin', 'superadmin'), [
    param('id').isMongoId().withMessage('Invalid ID format'), 
    validateRequest
  ], ctrl.patchById);

router.delete('/:id', protect, authorize('superadmin'), [
    param('id').isMongoId().withMessage('Invalid ID format'), 
    validateRequest
  ], ctrl.deleteById);

router.get('/stats/usage', protect, authorize('admin', 'superadmin'), ctrl.getStatsUsage);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;