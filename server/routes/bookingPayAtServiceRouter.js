/**
 * bookingPayAtServiceRouter.js — Likeson.in
 * Business logic lives in controllers/bookingPayAtService.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/bookingPayAtService.controller.js';

const router = express.Router();

// Define the missing SERVICE_PARTNER_ROLES array
// (Adjust these exact string names if your platform uses slightly different role names)
const SERVICE_PARTNER_ROLES = [
  'hospital', 
  'doctor', 
  'blood_bank', 
  'care_assistant', 
  'pharmacy', 
  'diagnostic', 
  'admin', 
  'superadmin'
];

router.post('/:id/pay-at-service/generate-link', protect, authorize(...SERVICE_PARTNER_ROLES), ctrl.postByIdPayAtServiceGenerateLink);

router.get('/:id/pay-at-service/status', protect, authorize(...SERVICE_PARTNER_ROLES, 'customer'), ctrl.getByIdPayAtServiceStatus);

// Note: express.raw is a built-in middleware, so this line is perfectly fine!
router.post('/:id/pay-at-service/webhook', express.raw({ type: 'application/json' }), ctrl.postByIdPayAtServiceWebhook);

router.post('/:id/pay-at-service/mark-collected', protect, authorize(...SERVICE_PARTNER_ROLES), ctrl.postByIdPayAtServiceMarkCollected);

router.post('/:id/pay-at-service/complete', protect, authorize(...SERVICE_PARTNER_ROLES), ctrl.postByIdPayAtServiceComplete);

// Added your standard error handler to prevent further crashes
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;