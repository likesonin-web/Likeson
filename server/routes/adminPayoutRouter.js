/**
 * adminPayoutRouter.js — Likeson.in
 * Business logic lives in controllers/adminPayout.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import * as ctrl from '../controllers/adminPayout.controller.js';

const router = express.Router();

router.use(protect, authorize('admin', 'superadmin', 'finance_admin', 'finance_manager'))
router.get('/payout-dashboard', ctrl.getPayoutDashboard);
router.get('/settlement-dashboard', ctrl.getSettlementDashboard);
router.get('/partner-balances', ctrl.getPartnerBalances);
router.get('/ledger', ctrl.getLedger);
router.get('/failed-payouts', ctrl.getFailedPayouts);
router.get('/retry-queue', ctrl.getRetryQueue);
router.post('/payouts/:id/approve', authorize('finance_admin', 'superadmin'), ctrl.postPayoutsByIdApprove);
router.post('/payouts/:id/reject', authorize('finance_admin', 'superadmin'), ctrl.postPayoutsByIdReject);
router.post('/payouts/:id/retry', ctrl.postPayoutsByIdRetry);
router.post('/payouts/:id/force-reconcile', authorize('finance_admin', 'superadmin'), ctrl.postPayoutsByIdForceReconcile);
router.post('/payouts/bulk-initiate', authorize('finance_admin', 'superadmin'), ctrl.postPayoutsBulkInitiate);
router.post('/settlements/create-batch', authorize('finance_admin', 'superadmin'), ctrl.postSettlementsCreateBatch);
router.post('/settlements/:id/approve', authorize('finance_admin', 'superadmin'), ctrl.postSettlementsByIdApprove);
router.post('/settlements/:id/process', authorize('finance_admin', 'superadmin'), ctrl.postSettlementsByIdProcess);
router.post('/settlements/:id/cancel', authorize('finance_admin', 'superadmin'), ctrl.postSettlementsByIdCancel);
router.get('/reconciliation', ctrl.getReconciliation);

export default router;
