/**
 * partnerPayoutRouter.js — Likeson.in
 * Business logic lives in controllers/partnerPayout.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import * as ctrl from '../controllers/partnerPayout.controller.js';

const router = express.Router();

router.post('/bank-account', requireAuth, [
    body('partnerType').isIn([
      'doctor','hospital','transportpartner','driver',
      'solodriverpartner','pharmacy','care_assistant','lab_partner','customer',
    ]),
    body('partnerProfileId').isMongoId(),
    body('accountHolderName').trim().notEmpty(),
    body('accountNumber').trim().notEmpty().isLength({ min: 9, max: 18 }),
    body('ifscCode').trim().notEmpty().matches(IFSC_REGEX).withMessage('Invalid IFSC'),
    body('bankName').trim().notEmpty(),
  ], validate, ctrl.postBankAccount);
router.post('/upi', requireAuth, [
    body('partnerType').isIn([
      'doctor','hospital','transportpartner','driver',
      'solodriverpartner','pharmacy','care_assistant','lab_partner','customer',
    ]),
    body('partnerProfileId').isMongoId(),
    body('upiAddress').trim().notEmpty().matches(/^[\w.\-]+@[\w]+$/).withMessage('Invalid UPI ID format'),
  ], validate, ctrl.postUpi);
router.get('/fund-accounts', requireAuth, [
    query('partnerType').notEmpty(),
    query('partnerProfileId').isMongoId(),
  ], validate, ctrl.getFundAccounts);
router.get('/my/settlements', requireAuth, ctrl.getMySettlements);
router.get('/my/settlements/:id', requireAuth, ctrl.getMySettlementsById);
router.get('/my/payouts', requireAuth, ctrl.getMyPayouts);
router.get('/my/earnings', requireAuth, ctrl.getMyEarnings);
router.post('/admin/settle/:partnerType/:profileId', requireAdmin, [
    param('partnerType').isIn([
      'doctor','hospital','transportpartner','driver',
      'solodriverpartner','pharmacy','care_assistant','lab_partner',
    ]),
    param('profileId').isMongoId(),
  ], validate, ctrl.postAdminSettleByPartnerTypeByProfileId);
router.post('/admin/settle/batch', requireSuperAdmin, [body('cycle').isIn(['Daily', 'Weekly', 'Bi-Weekly', 'Monthly'])], validate, ctrl.postAdminSettleBatch);
router.get('/admin/settlements', requireAdmin, ctrl.getAdminSettlements);
router.get('/admin/payouts', requireAdmin, ctrl.getAdminPayouts);
router.post('/admin/retry-failed', requireAdmin, ctrl.postAdminRetryFailed);
router.post('/refund', requireAdmin, [
    body('customerUserId').isMongoId(),
    body('amountPaise').isInt({ min: 100 }),
    body('narration').trim().notEmpty(),
  ], validate, ctrl.postRefund);
router.post('/webhook/razorpayx', ctrl.postWebhookRazorpayx);

export default router;
