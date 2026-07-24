/**
 * partnerWalletRouter.js — Likeson.in
 * Business logic lives in controllers/partnerWallet.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache                  from '../middleware/cache.js';
import * as ctrl from '../controllers/partnerWallet.controller.js';

const router = express.Router();
export const PARTNER_ROLES = Object.freeze([
  'doctor',
  'hospital',
  'care_assistant',
  'driver',
  'solodriverpartner',
  'transportpartner',
  'lab_partner',
]);

export const ADMIN_ROLES = Object.freeze([
  'admin',
  'superadmin',
]);

export const onlyPartner = authorize(...PARTNER_ROLES);
export const onlyAdmin = authorize(...ADMIN_ROLES);

router.get('/me', protect, onlyPartner, cache(30, (req) => `partnerWallet:${req.user._id}`), ctrl.getMe);
router.get('/bank-accounts', protect, onlyPartner, ctrl.getBankAccounts);
router.post('/bank-accounts', protect, onlyPartner, ctrl.postBankAccounts);
router.patch('/bank-accounts/:bankId/set-primary', protect, onlyPartner, ctrl.patchBankAccountsByBankIdSetPrimary);
router.delete('/bank-accounts/:bankId', protect, onlyPartner, ctrl.deleteBankAccountsByBankId);
router.get('/admin/wallets', protect, onlyAdmin, ctrl.getAdminWallets);
router.get('/admin/wallets/:walletId', protect, onlyAdmin, ctrl.getAdminWalletsByWalletId);
router.patch('/admin/wallets/:walletId/status', protect, onlyAdmin, ctrl.patchAdminWalletsByWalletIdStatus);
router.patch('/admin/wallets/:walletId/kyc-status', protect, onlyAdmin, ctrl.patchAdminWalletsByWalletIdKycStatus);
router.patch('/admin/wallets/:walletId/hold', protect, onlyAdmin, ctrl.patchAdminWalletsByWalletIdHold);
router.patch('/admin/bank-accounts/:walletId/:bankId/verify', protect, onlyAdmin, ctrl.patchAdminBankAccountsByWalletIdByBankIdVerify);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;
