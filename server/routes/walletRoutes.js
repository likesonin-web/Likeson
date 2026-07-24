/**
 * walletRouter.js — Likeson.in
 *
 * Enterprise-grade wallet router.
 * Business logic lives in controllers/wallet.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import * as ctrl from '../controllers/wallet.controller.js';

const router = express.Router();

router.get('/me', protect, cache(30, (req) => `wallet:${req.user._id}`), ctrl.getMe);
router.post('/add-money', protect, ctrl.postAddMoney);
router.post('/verify-topup', protect, ctrl.postVerifyTopup);
router.get('/withdrawable-balance', protect, ctrl.getWithdrawableBalance);
router.get('/bank-accounts', protect, ctrl.getBankAccounts);
router.post('/bank-accounts', protect, ctrl.postBankAccounts);
router.patch('/bank-accounts/:bankAccountId/set-primary', protect, ctrl.patchBankAccountsByBankAccountIdSetPrimary);
router.delete('/bank-accounts/:bankAccountId', protect, ctrl.deleteBankAccountsByBankAccountId);
router.get('/withdrawals', protect, ctrl.getWithdrawals);
router.post('/withdrawals', protect, ctrl.postWithdrawals);
router.get('/withdrawals/:requestId', protect, ctrl.getWithdrawalsByRequestId);
router.post('/withdrawals/:requestId/cancel', protect, ctrl.postWithdrawalsByRequestIdCancel);
router.get('/transactions', protect, ctrl.getTransactions);
router.get('/admin/withdrawals', protect, authorize('admin', 'superadmin', 'finance'), ctrl.getAdminWithdrawals);
router.post('/admin/withdrawals/:requestId/approve', protect, authorize('admin', 'superadmin', 'finance'), ctrl.postAdminWithdrawalsByRequestIdApprove);
router.post('/admin/withdrawals/:requestId/complete', protect, authorize('admin', 'superadmin', 'finance'), ctrl.postAdminWithdrawalsByRequestIdComplete);
router.post('/admin/withdrawals/:requestId/reject', protect, authorize('admin', 'superadmin', 'finance'), ctrl.postAdminWithdrawalsByRequestIdReject);
router.post('/admin/withdrawals/:requestId/fail', protect, authorize('admin', 'superadmin', 'finance'), ctrl.postAdminWithdrawalsByRequestIdFail);
router.patch('/admin/bank-accounts/:walletId/:bankAccountId/verify', protect, authorize('admin', 'superadmin', 'finance'), ctrl.patchAdminBankAccountsByWalletIdByBankAccountIdVerify);
router.get('/admin/wallets', protect, authorize('admin', 'superadmin', 'finance'), ctrl.getAdminWallets);
router.patch('/admin/wallets/:walletId/toggle-active', protect, authorize('admin', 'superadmin'), ctrl.patchAdminWalletsByWalletIdToggleActive);
router.post('/admin/credit', protect, authorize('admin', 'superadmin'), ctrl.postAdminCredit);
router.post('/admin/debit', protect, authorize('admin', 'superadmin'), ctrl.postAdminDebit);
router.get('/admin/wallets/:walletId', protect, authorize('admin', 'superadmin', 'finance'), ctrl.getAdminWalletsByWalletId);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;
