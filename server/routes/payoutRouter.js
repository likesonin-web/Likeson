/**
 * payoutRouter.js — Likeson.in
 * Business logic lives in controllers/payout.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import * as ctrl from '../controllers/payout.controller.js';

const router = express.Router();

router.get('/preview/:partnerUserId', ctrl.getPreviewByPartnerUserId);
router.post('/initiate', ctrl.postInitiate);
router.post('/:payoutId/transfer', ctrl.postByPayoutIdTransfer);
router.post('/webhook/razorpayx', express.raw({ type: 'application/json' }), ctrl.postWebhookRazorpayx);
router.post('/:payoutId/cancel', ctrl.postByPayoutIdCancel);
router.get('/', ctrl.get);
router.get('/:payoutId', ctrl.getByPayoutId);
router.get('/partner/:partnerUserId', ctrl.getPartnerByPartnerUserId);

export default router;
