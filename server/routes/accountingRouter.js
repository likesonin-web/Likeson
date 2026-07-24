/**
 * accountingRouter.js — Likeson.in
 * Business logic lives in controllers/accounting.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/accounting.controller.js';

const router = express.Router();

// Define the missing role arrays 
// (Adjust these strings if your platform uses slightly different role names)
const ADMIN_ROLES = ['admin', 'superadmin'];
const FINANCE_ROLES = ['admin', 'superadmin', 'finance'];
const PARTNER_ROLES = [
  'hospital', 
  'doctor', 
  'blood_bank', 
  'care_assistant', 
  'pharmacy', 
  'diagnostic', 
  'driver'
];

router.post('/settlement/process/:bookingId', protect, authorize(...ADMIN_ROLES), ctrl.postSettlementProcessByBookingId);
router.get('/settlement/status/:bookingId', protect, authorize(...FINANCE_ROLES), ctrl.getSettlementStatusByBookingId);
router.get('/wallets/me', protect, authorize(...PARTNER_ROLES), ctrl.getWalletsMe);
router.get('/wallets/:partnerId', protect, authorize(...FINANCE_ROLES), ctrl.getWalletsByPartnerId);
router.get('/wallets', protect, authorize(...FINANCE_ROLES), ctrl.getWallets);
router.patch('/wallets/:partnerId/freeze', protect, authorize(...ADMIN_ROLES), ctrl.patchWalletsByPartnerIdFreeze);
router.post('/wallets/me/bank', protect, authorize(...PARTNER_ROLES), ctrl.postWalletsMeBank);
router.patch('/wallets/me/bank/:bankId', protect, authorize(...PARTNER_ROLES), ctrl.patchWalletsMeBankByBankId);
router.delete('/wallets/me/bank/:bankId', protect, authorize(...PARTNER_ROLES), ctrl.deleteWalletsMeBankByBankId);
router.patch('/wallets/me/bank/:bankId/set-primary', protect, authorize(...PARTNER_ROLES), ctrl.patchWalletsMeBankByBankIdSetPrimary);
router.patch('/wallets/:partnerId/bank/:bankId/verify', protect, authorize(...ADMIN_ROLES), ctrl.patchWalletsByPartnerIdBankByBankIdVerify);
router.patch('/wallets/:partnerId/release', protect, authorize(...ADMIN_ROLES), ctrl.patchWalletsByPartnerIdRelease);
router.patch('/wallets/:partnerId/kyc-status', protect, authorize(...ADMIN_ROLES), ctrl.patchWalletsByPartnerIdKycStatus);
router.get('/transactions/me', protect, authorize(...PARTNER_ROLES), ctrl.getTransactionsMe);
router.get('/transactions/:partnerId', protect, authorize(...FINANCE_ROLES), ctrl.getTransactionsByPartnerId);
router.get('/transactions/txn/:txnId', protect, authorize(...FINANCE_ROLES), ctrl.getTransactionsTxnByTxnId);
router.get('/settlements/me', protect, authorize(...PARTNER_ROLES), ctrl.getSettlementsMe);
router.get('/settlements/:settlementId', protect, authorize(...FINANCE_ROLES, ...PARTNER_ROLES), ctrl.getSettlementsBySettlementId);
router.get('/settlements', protect, authorize(...FINANCE_ROLES), ctrl.getSettlements);
router.post('/settlements/:settlementId/reverse', protect, authorize(...ADMIN_ROLES), ctrl.postSettlementsBySettlementIdReverse);
router.get('/allocations/booking/:bookingId', protect, authorize(...FINANCE_ROLES), ctrl.getAllocationsBookingByBookingId);
router.get('/allocations/me', protect, authorize(...PARTNER_ROLES), ctrl.getAllocationsMe);
router.post('/withdrawals/request', protect, authorize(...PARTNER_ROLES), ctrl.postWithdrawalsRequest);
router.get('/wallets/me/bank', protect, authorize(...PARTNER_ROLES), ctrl.getWalletsMeBank);
router.get('/withdrawals/me', protect, authorize(...PARTNER_ROLES), ctrl.getWithdrawalsMe);
router.get('/withdrawals', protect, authorize(...FINANCE_ROLES), ctrl.getWithdrawals);
router.get('/withdrawals/:withdrawalId', protect, authorize(...FINANCE_ROLES, ...PARTNER_ROLES), ctrl.getWithdrawalsByWithdrawalId);
router.post('/withdrawals/:withdrawalId/approve', protect, authorize(...ADMIN_ROLES), ctrl.postWithdrawalsByWithdrawalIdApprove);
router.post('/withdrawals/:withdrawalId/reject', protect, authorize(...ADMIN_ROLES), ctrl.postWithdrawalsByWithdrawalIdReject);
router.post('/withdrawals/:withdrawalId/retry', protect, authorize(...ADMIN_ROLES), ctrl.postWithdrawalsByWithdrawalIdRetry);
router.post('/withdrawals/webhook', ctrl.postWithdrawalsWebhook);
router.get('/liabilities/me', protect, authorize(...PARTNER_ROLES), ctrl.getLiabilitiesMe);
router.get('/liabilities', protect, authorize(...FINANCE_ROLES), ctrl.getLiabilities);
router.post('/liabilities/:liabilityId/waive', protect, authorize(...ADMIN_ROLES), ctrl.postLiabilitiesByLiabilityIdWaive);
router.get('/liabilities/:liabilityId', protect, authorize(...FINANCE_ROLES), ctrl.getLiabilitiesByLiabilityId);
router.post('/reconciliation/run', protect, authorize(...ADMIN_ROLES), ctrl.postReconciliationRun);
router.post('/reconciliation/wallet/:walletId', protect, authorize(...FINANCE_ROLES), ctrl.postReconciliationWalletByWalletId);
router.get('/reconciliation/platform-revenue', protect, authorize(...FINANCE_ROLES), ctrl.getReconciliationPlatformRevenue);
router.post('/finance/manual-credit', protect, authorize(...FINANCE_ROLES), ctrl.postFinanceManualCredit);
router.post('/finance/manual-debit', protect, authorize(...ADMIN_ROLES), ctrl.postFinanceManualDebit);
router.post('/finance/force-settle/:bookingId', protect, authorize('superadmin'), ctrl.postFinanceForceSettleByBookingId);
router.get('/reports/partner-dashboard', protect, authorize(...PARTNER_ROLES), ctrl.getReportsPartnerDashboard);
router.get('/reports/partner-earnings/:partnerId', protect, authorize(...FINANCE_ROLES), ctrl.getReportsPartnerEarningsByPartnerId);
router.get('/reports/platform-revenue-summary', protect, authorize(...FINANCE_ROLES), ctrl.getReportsPlatformRevenueSummary);
router.get('/reports/settlement-summary', protect, authorize(...FINANCE_ROLES), ctrl.getReportsSettlementSummary);
router.get('/reports/liability-summary', protect, authorize(...FINANCE_ROLES), ctrl.getReportsLiabilitySummary);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
} else {
  // Fallback in case errorHandler isn't exported from the controller
  router.use((err, req, res, next) => {
    res.status(500).json({ success: false, message: err.message });
  });
}

export default router;