import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * PartnerWallet
 *
 * CACHED PROJECTION of PartnerWalletTransaction ledger.
 * Never update balances directly — always via ledger entry + wallet sync.
 * Source of truth = PartnerWalletTransaction.
 *
 * BANK DETAILS:
 *   Stored here as primary source for withdrawal.
 *   Synced from role-profile model (DoctorProfile, Driver, etc.) when
 *   profile bankDetails changes — but wallet bankDetails is the master
 *   for withdrawal purposes (can add/update/delete independently).
 *
 * KYC / BANK VERIFIED:
 *   kycVerified  — set by walletSyncService when profile KYC verified
 *   bankVerified — set by walletSyncService when profile bank verified
 *   Both can also be set directly by admin via PATCH /wallets/:id/kyc-status
 */

export const PARTNER_TYPES = Object.freeze([
  'doctor',
  'hospital',
  'care_assistant',
  'driver',
  'solodriverpartner',
  'transportpartner',
  'lab_partner',
]);

export const WALLET_STATUSES = Object.freeze([
  'active',
  'frozen',    // admin-frozen; no credits/debits
  'suspended', // KYC/compliance hold
  'closed',
]);

// ── Bank Details Sub-Schema ───────────────────────────────────────────────────
// Stored on wallet so withdrawal doesn't need to join profile model.
// Shape matches role-profile bankDetails for easy sync.
// accountNumber stored masked (last 4 only); full number never persisted here.

const walletBankDetailSchema = new Schema(
  {
    accountHolderName: { type: String, trim: true, required: true },
    /**
     * accountNumberLast4 — last 4 digits only.
     * Full account number NEVER stored here.
     * When syncing from profile, slice(-4) before storing.
     */
    accountNumberLast4: { type: String, maxlength: 4, required: true },
    ifscCode: {
      type:      String,
      trim:      true,
      uppercase: true,
      match:     [/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC'],
      required:  true,
    },
    bankName:   { type: String, trim: true },
    branchName: { type: String, trim: true },
    upiId:      { type: String, trim: true, default: null },

    // Razorpay fund account tied to this bank account
    razorpayFundAccountId: { type: String, default: null, select: false },

    isPrimary:  { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },

    // Source tracking: 'profile_sync' | 'manual'
    source: {
      type:    String,
      enum:    ['profile_sync', 'manual'],
      default: 'manual',
    },

    addedAt:   { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const partnerWalletSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    partner: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true,
      index:    true,
    },

    partnerRole: {
      type:     String,
      required: true,
      enum:     PARTNER_TYPES,
      index:    true,
    },

    profileRef: {
      type:    Schema.Types.ObjectId,
      default: null,
    },

    currency: { type: String, default: 'INR' },

    // ── Live Balance Projections ─────────────────────────────────────────────
    availableBalance:  { type: Number, default: 0, min: 0 },
    pendingBalance:    { type: Number, default: 0, min: 0 },
    withdrawalBalance: { type: Number, default: 0, min: 0 },
    recoveryBalance:   { type: Number, default: 0, min: 0 },

    // ── Lifetime Aggregates ──────────────────────────────────────────────────
    lifetimeEarned:      { type: Number, default: 0, min: 0 },
    lifetimeRecovered:   { type: Number, default: 0, min: 0 },
    lifetimeWithdrawn:   { type: Number, default: 0, min: 0 },
    lifetimeAdjustments: { type: Number, default: 0 },

    // ── Settlement Tracking ──────────────────────────────────────────────────
    lastSettlementAt: { type: Date, default: null },
    totalSettlements: { type: Number, default: 0 },

    // ── Bank Details ─────────────────────────────────────────────────────────
    /**
     * bankDetails — array of bank accounts for this wallet.
     * Max 3 accounts. Exactly one must have isPrimary = true when non-empty.
     * Used as source for PartnerWithdrawal.bankAccountSnapshot.
     *
     * Add:    POST  /api/accounting/wallets/me/bank
     * Update: PATCH /api/accounting/wallets/me/bank/:bankId
     * Delete: DELETE /api/accounting/wallets/me/bank/:bankId
     * Set primary: PATCH /api/accounting/wallets/me/bank/:bankId/set-primary
     *
     * Sync from profile: walletSyncService.syncBankDetails()
     */
    bankDetails: {
      type:    [walletBankDetailSchema],
      default: [],
    },

    // ── Compliance / KYC Gate ────────────────────────────────────────────────
    /**
     * kycVerified  — auto-set by walletSyncService when profile KYC passes
     * bankVerified — auto-set by walletSyncService when primary bank verified
     *
     * Also settable by admin via PATCH /wallets/:id/kyc-status
     *
     * Withdrawal only allowed when: kycVerified + bankVerified + !complianceHold
     */
    kycVerified:    { type: Boolean, default: false },
    bankVerified:   { type: Boolean, default: false },
    complianceHold: { type: Boolean, default: false },
    holdReason:     { type: String, default: null },
    holdAt:         { type: Date,   default: null },
    holdReleasedAt: { type: Date,   default: null },

    // ── Status ───────────────────────────────────────────────────────────────
    walletStatus: {
      type:    String,
      enum:    WALLET_STATUSES,
      default: 'active',
      index:   true,
    },

    // ── Razorpay Payout Identity ─────────────────────────────────────────────
    razorpayContactId:     { type: String, select: false, default: null },
    razorpayFundAccountId: { type: String, select: false, default: null },

    // ── Optimistic Locking ───────────────────────────────────────────────────
    __v_balance: { type: Number, default: 0 },

    // ── Audit ────────────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // ── Reconciliation ───────────────────────────────────────────────────────
    lastReconciliationAt:     { type: Date,   default: null },
    lastReconciliationStatus: { type: String, enum: ['matched', 'mismatch', null], default: null },
    lastReconciliationDelta:  { type: Number, default: null },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ── Pre-save: enforce single primary ─────────────────────────────────────────

partnerWalletSchema.pre('save', function () {
  if (!this.isModified('bankDetails')) return;

  const primaries = this.bankDetails.filter(b => b.isPrimary);

  // If multiple primary, keep only last one
  if (primaries.length > 1) {
    this.bankDetails.forEach((b, i) => {
      b.isPrimary = (i === this.bankDetails.length - 1 &&
        this.bankDetails[this.bankDetails.length - 1].isPrimary);
    });
    // Simpler: de-dup by keeping last marked primary
    let lastPrimary = null;
    for (let i = this.bankDetails.length - 1; i >= 0; i--) {
      if (this.bankDetails[i].isPrimary) {
        if (!lastPrimary) {
          lastPrimary = i;
        } else {
          this.bankDetails[i].isPrimary = false;
        }
      }
    }
  }

  // If first bank added, auto-set as primary
  if (this.bankDetails.length === 1) {
    this.bankDetails[0].isPrimary = true;
  }

  // Max 3 bank accounts
  if (this.bankDetails.length > 3) {
    throw new Error('Maximum 3 bank accounts allowed per wallet');
  }

  // Sync bankVerified from primary account
  const primary = this.bankDetails.find(b => b.isPrimary);
  if (primary) {
    this.bankVerified = primary.isVerified === true;
  } else {
    this.bankVerified = false;
  }
});

// ── Virtuals ──────────────────────────────────────────────────────────────────

partnerWalletSchema.virtual('totalBalance').get(function () {
  return +(
    this.availableBalance +
    this.pendingBalance +
    this.withdrawalBalance
  ).toFixed(2);
});

partnerWalletSchema.virtual('isWithdrawable').get(function () {
  return (
    this.walletStatus === 'active' &&
    this.kycVerified &&
    this.bankVerified &&
    !this.complianceHold &&
    this.availableBalance > 0
  );
});

partnerWalletSchema.virtual('hasOutstandingLiability').get(function () {
  return this.recoveryBalance > 0;
});

partnerWalletSchema.virtual('primaryBank').get(function () {
  return this.bankDetails.find(b => b.isPrimary) ?? null;
});

// ── Indexes ───────────────────────────────────────────────────────────────────

partnerWalletSchema.index({ partnerRole: 1, walletStatus: 1 });
partnerWalletSchema.index({ recoveryBalance: 1 });
partnerWalletSchema.index({ lastSettlementAt: -1 });

const PartnerWallet = mongoose.model('PartnerWallet', partnerWalletSchema);
export default PartnerWallet;