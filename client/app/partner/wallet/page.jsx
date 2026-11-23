'use client';

/**
 * PartnerAccountingManagement.jsx
 *
 * Partner-facing accounting dashboard. Mirrors every "/me" + partner-scoped
 * route on accountingRouter.js via accountingSlice.js thunks.
 *
 * Sections:
 * Overview     -> fetchMyWallet + fetchPartnerDashboard
 * Bank Details -> fetchMyBankDetails + CRUD thunks
 * Transactions -> fetchMyTransactions
 * Settlements  -> fetchMySettlements
 * Allocations  -> fetchMyAllocations
 * Withdrawals  -> fetchMyWithdrawals + requestWithdrawal
 * Liabilities  -> fetchMyLiabilities
 *
 * No inline style. Tailwind utility classes + global.css tokens only.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { selectUser } from '@/store/slices/userSlice';
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Receipt,
  ListChecks,
  Layers,
  Banknote,
  AlertTriangle,
  XCircle,
  Hourglass,
  Info,
  X,
  Landmark,
  TrendingUp,
  TrendingDown,
  CircleDollarSign,
  Loader2,
  Inbox,
  Plus,
  Trash2,
  Edit2,
  Star,
  Building2,
} from 'lucide-react';

import {
  fetchMyWallet,
  fetchMyBankDetails,
  fetchMyTransactions,
  fetchMySettlements,
  fetchMyAllocations,
  fetchMyWithdrawals,
  fetchMyLiabilities,
  fetchPartnerDashboard,
  requestWithdrawal,
  addBankAccount,
  updateBankAccount,
  deleteBankAccount,
  setPrimaryBankAccount,
  selectMyWallet,
  selectMyBankDetails,
  selectMyBankVerified,
  selectMyTransactions,
  selectMyTransactionsPagination,
  selectMySettlements,
  selectMySettlementsPagination,
  selectMyAllocations,
  selectMyAllocationsPagination,
  selectMyWithdrawals,
  selectMyWithdrawalsPagination,
  selectMyLiabilities,
  selectMyLiabilitiesOutstandingTotal,
  selectPartnerDashboard,
  selectIsLoading,
} from '@/store/slices/accountingSlice';

// ── Static config ────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview', icon: Layers },
  { id: 'bank', label: 'Bank Details', icon: Landmark },
  { id: 'transactions', label: 'Ledger', icon: Receipt },
  { id: 'settlements', label: 'Settlements', icon: ListChecks },
  { id: 'allocations', label: 'Allocations', icon: Layers },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
  { id: 'liabilities', label: 'Liabilities', icon: ShieldAlert },
];

const STATUS_STYLES = {
  // settlements
  PENDING: 'badge-warning',
  SETTLED: 'badge-success',
  REVERSED: 'badge-error',
  FAILED: 'badge-error',
  SKIPPED: 'badge-secondary',
  // withdrawals
  REQUESTED: 'badge-info',
  APPROVED: 'badge-info',
  REJECTED: 'badge-error',
  queued: 'badge-info',
  pending: 'badge-warning',
  processing: 'badge-warning',
  processed: 'badge-success',
  reversed: 'badge-error',
  cancelled: 'badge-secondary',
  failed: 'badge-error',
  // liabilities
  OPEN: 'badge-error',
  PARTIALLY_RECOVERED: 'badge-warning',
  RECOVERED: 'badge-success',
  WAIVED: 'badge-secondary',
};

const fmtINR = (n = 0) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

// ── Small reusable bits ─────────────────────────────────────────────────

function FieldNote({ label, value, hint, valueClassName = '', icon: Icon }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="flex items-center gap-1.5 text-[0.65rem] sm:text-xs font-semibold uppercase tracking-wider text-base-content/50">
        {Icon ? <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> : null}
        {label}
      </span>
      <span className={`text-sm sm:text-base font-bold text-base-content truncate ${valueClassName}`}>
        {value}
      </span>
      {hint ? <span className="text-[0.65rem] sm:text-xs text-base-content/40 leading-snug">{hint}</span> : null}
    </div>
  );
}

function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] ?? 'badge-secondary';
  return <span className={`badge ${cls} badge-sm whitespace-nowrap`}>{String(status).replace(/_/g, ' ')}</span>;
}

function SectionLoading({ label = 'Loading data' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-base-content/50">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <span className="text-sm font-medium">{label}…</span>
    </div>
  );
}

function EmptyState({ label, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center px-4">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
        <Inbox className="w-5 h-5 text-primary" />
      </div>
      <p className="text-sm font-semibold text-base-content">{label}</p>
      {hint ? <p className="text-xs text-base-content/50 max-w-xs">{hint}</p> : null}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function Pagination({ pagination, onChange }) {
  if (!pagination || pagination.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-4 flex-wrap">
      <span className="text-xs text-base-content/50">
        Page {pagination.page} of {pagination.pages} · {pagination.total} total
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={pagination.page <= 1}
          onClick={() => onChange(pagination.page - 1)}
        >
          Prev
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={pagination.page >= pagination.pages}
          onClick={() => onChange(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, note, tone = 'primary' }) {
  const toneText = { primary: 'text-primary', success: 'text-success', warning: 'text-warning', error: 'text-error' }[tone];
  const toneBg = { primary: 'bg-primary/10', success: 'bg-success/10', warning: 'bg-warning/10', error: 'bg-error/10' }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="stat-card flex items-start justify-between gap-3"
    >
      <div className="flex flex-col gap-1 min-w-0">
        <span className="stat-card-label">{label}</span>
        <span className={`stat-card-value ${toneText} truncate`}>{value}</span>
        {note ? <span className="text-[0.65rem] text-base-content/40">{note}</span> : null}
      </div>
      <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${toneBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-4.5 h-4.5 sm:w-5 sm:h-5 ${toneText}`} />
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PartnerAccountingManagement() {
  const dispatch = useDispatch();
  const router = useRouter();
  const user = useSelector(selectUser);

  const [activeTab, setActiveTab] = useState('overview');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Selectors
  const wallet = useSelector(selectMyWallet);
  const bankDetails = useSelector(selectMyBankDetails);
  const bankVerified = useSelector(selectMyBankVerified);
  const dashboard = useSelector(selectPartnerDashboard);
  const transactions = useSelector(selectMyTransactions);
  const txnPagination = useSelector(selectMyTransactionsPagination);
  const settlements = useSelector(selectMySettlements);
  const settlementsPagination = useSelector(selectMySettlementsPagination);
  const allocations = useSelector(selectMyAllocations);
  const allocationsPagination = useSelector(selectMyAllocationsPagination);
  const withdrawals = useSelector(selectMyWithdrawals);
  const withdrawalsPagination = useSelector(selectMyWithdrawalsPagination);
  const liabilities = useSelector(selectMyLiabilities);
  const liabilitiesOutstanding = useSelector(selectMyLiabilitiesOutstandingTotal);

  const loadingWallet = useSelector(selectIsLoading('wallet/fetchMine'));
  const loadingBanks = useSelector(selectIsLoading('wallet/bank/fetchMine'));
  const loadingDashboard = useSelector(selectIsLoading('reports/partnerDashboard'));
  const loadingTxns = useSelector(selectIsLoading('transactions/fetchMine'));
  const loadingSettlements = useSelector(selectIsLoading('settlements/fetchMine'));
  const loadingAllocations = useSelector(selectIsLoading('allocations/fetchMine'));
  const loadingWithdrawals = useSelector(selectIsLoading('withdrawals/fetchMine'));
  const loadingLiabilities = useSelector(selectIsLoading('liabilities/fetchMine'));
  const submittingWithdrawal = useSelector(selectIsLoading('withdrawals/request'));

  // Pagination states
  const [txnPage, setTxnPage] = useState(1);
  const [settlementPage, setSettlementPage] = useState(1);
  const [allocationPage, setAllocationPage] = useState(1);
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [liabilityPage, setLiabilityPage] = useState(1);

  // Initialization & Role guard
  useEffect(() => {
    if (!user) return;
    if (['admin', 'superadmin'].includes(user.role)) {
      router.replace('/admin/dashboard');
      return;
    }
    if (user.role === 'customer') {
      router.replace('/wallet');
      return;
    }
    dispatch(fetchMyWallet());
    dispatch(fetchMyBankDetails());
    dispatch(fetchPartnerDashboard());
  }, [dispatch, user, router]);

  // Tab data fetching
  useEffect(() => {
    if (activeTab === 'transactions') dispatch(fetchMyTransactions({ page: txnPage, limit: 20 }));
  }, [dispatch, activeTab, txnPage]);

  useEffect(() => {
    if (activeTab === 'settlements') dispatch(fetchMySettlements({ page: settlementPage, limit: 20 }));
  }, [dispatch, activeTab, settlementPage]);

  useEffect(() => {
    if (activeTab === 'allocations') dispatch(fetchMyAllocations({ page: allocationPage, limit: 20 }));
  }, [dispatch, activeTab, allocationPage]);

  useEffect(() => {
    if (activeTab === 'withdrawals') dispatch(fetchMyWithdrawals({ page: withdrawalPage, limit: 20 }));
  }, [dispatch, activeTab, withdrawalPage]);

  useEffect(() => {
    if (activeTab === 'liabilities') dispatch(fetchMyLiabilities({ page: liabilityPage, limit: 20 }));
  }, [dispatch, activeTab, liabilityPage]);

  const handleRefreshAll = useCallback(() => {
    dispatch(fetchMyWallet());
    dispatch(fetchMyBankDetails());
    dispatch(fetchPartnerDashboard());
    if (activeTab === 'transactions') dispatch(fetchMyTransactions({ page: txnPage, limit: 20 }));
    if (activeTab === 'settlements') dispatch(fetchMySettlements({ page: settlementPage, limit: 20 }));
    if (activeTab === 'allocations') dispatch(fetchMyAllocations({ page: allocationPage, limit: 20 }));
    if (activeTab === 'withdrawals') dispatch(fetchMyWithdrawals({ page: withdrawalPage, limit: 20 }));
    if (activeTab === 'liabilities') dispatch(fetchMyLiabilities({ page: liabilityPage, limit: 20 }));
  }, [dispatch, activeTab, txnPage, settlementPage, allocationPage, withdrawalPage, liabilityPage]);

  const w = wallet?.wallet ?? {};
  const outstandingLiability = wallet?.outstandingLiability ?? 0;
  const canWithdraw = !!w.isWithdrawable;

  return (
    <div className="min-h-screen bg-base-100">
      <div className="container-custom max-w-7xl py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-8">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-base-content flex items-center gap-2">
              <Wallet className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              My Earnings &amp; Wallet
            </h1>
            <p className="section-subheading mt-1 mb-0">
              Track earnings, settlements, withdrawals and recovery in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleRefreshAll} className="btn btn-ghost btn-sm gap-2" title="Refresh data">
              <RefreshCw className={`w-4 h-4 ${loadingWallet ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => setShowWithdrawModal(true)}
              disabled={!canWithdraw}
              className="btn btn-primary-cta btn-sm sm:btn-md gap-2"
              title={canWithdraw ? 'Request a withdrawal' : 'Withdrawals unavailable right now'}
            >
              <ArrowUpFromLine className="w-4 h-4" />
              Withdraw
            </button>
          </div>
        </header>

        {/* Warning Strips */}
        {!loadingWallet && w.walletStatus && w.walletStatus !== 'active' && (
          <div className="alert alert-warning">
            <ShieldAlert className="w-5 h-5 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-semibold">Wallet is {w.walletStatus}.</p>
              <p className="text-xs text-base-content/60">
                Withdrawals and some actions may be restricted until this is resolved by support.
              </p>
            </div>
          </div>
        )}

        {/* Stat Cards */}
        {loadingWallet ? (
          <SectionLoading label="Loading wallet" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard icon={CircleDollarSign} label="Available Balance" value={fmtINR(w.availableBalance)} note="Ready to withdraw" tone="success" />
            <StatCard icon={Hourglass} label="Pending Balance" value={fmtINR(w.pendingBalance)} note="Awaiting settlement" tone="warning" />
            <StatCard icon={ArrowUpFromLine} label="Locked in Withdrawal" value={fmtINR(w.withdrawalBalance)} note="Withdrawal in progress" tone="primary" />
            <StatCard icon={ShieldAlert} label="Outstanding Liability" value={fmtINR(outstandingLiability)} note="Auto-deducted from future earnings" tone={outstandingLiability > 0 ? 'error' : 'success'} />
          </div>
        )}

        {/* Compliance row */}
        {!loadingWallet && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ComplianceChip label="KYC" verified={w.kycVerified} note="Identity verification status" />
            <ComplianceChip label="Bank Details" verified={bankVerified} note={bankDetails?.length ? `${bankDetails.length} account(s) saved` : 'Requires 1 verified account'} />
            <ComplianceChip
              label="Compliance Hold"
              verified={!w.complianceHold}
              positiveLabel="No hold"
              negativeLabel="On hold"
              note={w.holdReason || 'No active restriction'}
              invertTone
            />
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-base-300 overflow-x-auto scrollbar-thin">
          <div className="flex gap-1 min-w-max sm:min-w-0">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors
                    ${active ? 'text-primary' : 'text-base-content/50 hover:text-base-content'}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {active && (
                    <motion.span
                      layoutId="partner-acct-tab-underline"
                      className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            
            {activeTab === 'overview' && <OverviewTab dashboard={dashboard} loading={loadingDashboard} />}
            
            {activeTab === 'bank' && <BankAccountsTab bankDetails={bankDetails} loading={loadingBanks} />}

            {activeTab === 'transactions' && <TransactionsTab items={transactions} pagination={txnPagination} loading={loadingTxns} onPageChange={setTxnPage} />}

            {activeTab === 'settlements' && <SettlementsTab items={settlements} pagination={settlementsPagination} loading={loadingSettlements} onPageChange={setSettlementPage} />}

            {activeTab === 'allocations' && <AllocationsTab items={allocations} pagination={allocationsPagination} loading={loadingAllocations} onPageChange={setAllocationPage} />}

            {activeTab === 'withdrawals' && (
              <WithdrawalsTab
                items={withdrawals}
                pagination={withdrawalsPagination}
                loading={loadingWithdrawals}
                onPageChange={setWithdrawalPage}
                onNewRequest={() => setShowWithdrawModal(true)}
                canWithdraw={canWithdraw}
              />
            )}

            {activeTab === 'liabilities' && <LiabilitiesTab items={liabilities} outstandingTotal={liabilitiesOutstanding} loading={loadingLiabilities} onPageChange={setLiabilityPage} />}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Withdrawal Modal (Simplified) */}
      <WithdrawModal
        open={showWithdrawModal}
        onClose={() => setShowWithdrawModal(false)}
        availableBalance={w.availableBalance ?? 0}
        bankDetails={bankDetails}
        canWithdraw={canWithdraw}
        submitting={submittingWithdrawal}
        onSubmit={async (payload) => {
          const result = await dispatch(requestWithdrawal(payload));
          if (!result.error) {
            setShowWithdrawModal(false);
            dispatch(fetchMyWallet());
          }
        }}
      />
    </div>
  );
}

// ── Compliance chip ──────────────────────────────────────────────────────

function ComplianceChip({ label, verified, note, positiveLabel = 'Verified', negativeLabel = 'Pending Action', invertTone }) {
  const isGood = invertTone ? verified : verified;
  return (
    <div className="card flex items-center gap-3 p-3 sm:p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isGood ? 'bg-success/10' : 'bg-error/10'}`}>
        {isGood ? <ShieldCheck className="w-4.5 h-4.5 text-success" /> : <ShieldAlert className="w-4.5 h-4.5 text-error" />}
      </div>
      <FieldNote label={label} value={isGood ? positiveLabel : negativeLabel} hint={note} valueClassName={isGood ? 'text-success' : 'text-error'} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════

function OverviewTab({ dashboard, loading }) {
  if (loading) return <SectionLoading label="Loading dashboard" />;
  if (!dashboard) return <EmptyState label="No dashboard data yet" hint="Earnings will appear here after your first completed booking." />;

  const earning = dashboard.earningSummary ?? {};

  return (
    <div className="space-y-6">
      <div className="card p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold text-base-content mb-4 flex items-center gap-2">
          <TrendingUp className="w-4.5 h-4.5 text-primary" />
          Lifetime Earning Summary
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
          <FieldNote label="Total Earned" value={fmtINR(earning.totalEarned)} hint="Gross, before deductions" icon={CircleDollarSign} />
          <FieldNote label="Recovered" value={fmtINR(earning.totalRecovered)} hint="Deducted toward liability" icon={ShieldAlert} />
          <FieldNote label="Withdrawn" value={fmtINR(earning.totalWithdrawn)} hint="Successfully paid out" icon={ArrowUpFromLine} />
          <FieldNote label="Manual Credits" value={fmtINR(earning.totalManualCredit)} hint="Added by finance team" icon={TrendingUp} />
          <FieldNote label="Manual Debits" value={fmtINR(earning.totalManualDebit)} hint="Deducted by finance team" icon={TrendingDown} />
        </div>
        {typeof earning.bookingCount === 'number' && (
          <p className="text-xs text-base-content/40 mt-4">
            Based on {earning.bookingCount} settled booking{earning.bookingCount === 1 ? '' : 's'}.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4 sm:p-6">
          <h3 className="text-base font-bold text-base-content mb-1 flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-warning" />
            Pending Settlements
          </h3>
          <p className="text-xs text-base-content/40 mb-4">Bookings completed but not yet credited to wallet.</p>
          {dashboard.pendingSettlements?.length ? (
            <ul className="space-y-3">
              {dashboard.pendingSettlements.map((s) => (
                <li key={s._id} className="flex items-center justify-between gap-3 border-b border-base-300 pb-3 last:border-0 last:pb-0">
                  <FieldNote label={s.bookingId?.bookingCode ?? 'Booking'} value={fmtINR(s.netSettlement)} hint={fmtDate(s.bookingId?.scheduledAt ?? s.createdAt)} />
                  <StatusBadge status={s.settlementStatus} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState label="No pending settlements" />
          )}
        </div>

        <div className="card p-4 sm:p-6">
          <h3 className="text-base font-bold text-base-content mb-1 flex items-center gap-2">
            <ArrowUpFromLine className="w-4.5 h-4.5 text-primary" />
            Recent Withdrawals
          </h3>
          <p className="text-xs text-base-content/40 mb-4">Last 5 payout requests.</p>
          {dashboard.recentWithdrawals?.length ? (
            <ul className="space-y-3">
              {dashboard.recentWithdrawals.map((wd) => (
                <li key={wd._id} className="flex items-center justify-between gap-3 border-b border-base-300 pb-3 last:border-0 last:pb-0">
                  <FieldNote label={wd.withdrawalId} value={fmtINR(wd.amount)} hint={`Requested ${fmtDate(wd.requestedAt)}${wd.utr ? ` · UTR ${wd.utr}` : ''}`} />
                  <StatusBadge status={wd.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState label="No withdrawals yet" />
          )}
        </div>
      </div>

      <div className="card p-4 sm:p-6">
        <h3 className="text-base font-bold text-base-content mb-1 flex items-center gap-2">
          <Receipt className="w-4.5 h-4.5 text-primary" />
          Recent Ledger Activity
        </h3>
        <p className="text-xs text-base-content/40 mb-4">Last 10 wallet movements. See the Ledger tab for full history.</p>
        {dashboard.recentTransactions?.length ? (
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <table className="table min-w-[640px]">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance After</th>
                  <th>Date</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentTransactions.map((t) => (
                  <tr key={t.txnId}>
                    <td><LedgerTypeBadge type={t.type} direction={t.direction} /></td>
                    <td className={t.direction === 'debit' ? 'text-error font-semibold' : 'text-success font-semibold'}>
                      {t.direction === 'debit' ? '-' : '+'}
                      {fmtINR(t.amount)}
                    </td>
                    <td>{fmtINR(t.afterBalance)}</td>
                    <td className="text-base-content/50 text-xs">{fmtDate(t.createdAt)}</td>
                    <td className="text-base-content/50 text-xs max-w-[220px] truncate">{t.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState label="No ledger entries yet" />
        )}
      </div>
    </div>
  );
}

function LedgerTypeBadge({ type, direction }) {
  const Icon = direction === 'debit' ? TrendingDown : direction === 'credit' ? TrendingUp : Info;
  const tone = direction === 'debit' ? 'text-error' : direction === 'credit' ? 'text-success' : 'text-base-content/50';
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tone}`}>
      <Icon className="w-3.5 h-3.5" />
      {String(type).replace(/_/g, ' ')}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BANK ACCOUNTS TAB (NEW)
// ═══════════════════════════════════════════════════════════════════════════

function BankAccountsTab({ bankDetails, loading }) {
  const dispatch = useDispatch();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(null);

  const submittingAdd = useSelector(selectIsLoading('wallet/bank/add'));
  const submittingUpdate = useSelector(selectIsLoading('wallet/bank/update'));
  const submittingAction = submittingAdd || submittingUpdate;

  const handleEdit = (bank) => {
    setEditingBank(bank);
    setModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingBank(null);
    setModalOpen(true);
  };

  const handleDelete = (bankId) => {
    if (confirm('Are you sure you want to remove this bank account?')) {
      dispatch(deleteBankAccount(bankId));
    }
  };

  const handleSetPrimary = (bankId) => {
    dispatch(setPrimaryBankAccount(bankId));
  };

  const handleSubmit = async (payload) => {
    let result;
    if (editingBank) {
      result = await dispatch(updateBankAccount({ bankId: editingBank._id, payload }));
    } else {
      result = await dispatch(addBankAccount(payload));
    }
    if (!result.error) {
      setModalOpen(false);
    }
  };

  if (loading) return <SectionLoading label="Loading bank accounts" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-base-content flex items-center gap-2">
            <Landmark className="w-4.5 h-4.5 text-primary" />
            Bank Accounts
          </h3>
          <p className="text-xs text-base-content/40 mt-1">Manage where your earnings are withdrawn.</p>
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          disabled={bankDetails?.length >= 3}
          className="btn btn-primary btn-sm gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Account
        </button>
      </div>

      {!bankDetails?.length ? (
        <EmptyState 
          label="No bank accounts" 
          hint="Add a bank account to enable withdrawals." 
          action={
            <button type="button" onClick={handleAddNew} className="btn btn-outline btn-sm gap-2">
              <Plus className="w-4 h-4" /> Add your first account
            </button>
          } 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bankDetails.map(bank => (
            <div key={bank._id} className={`card p-4 sm:p-5 border ${bank.isPrimary ? 'border-primary/40 bg-primary/5' : 'border-base-300'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-base-200 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-base-content/60" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-base-content">{bank.bankName || 'Unknown Bank'}</h4>
                    <p className="text-xs text-base-content/50 uppercase">IFSC: {bank.ifscCode}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {bank.isVerified ? (
                    <span className="badge badge-success badge-sm gap-1">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </span>
                  ) : (
                    <span className="badge badge-warning badge-sm gap-1">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                  {bank.isPrimary && (
                    <span className="badge badge-primary badge-sm gap-1 mt-1">
                      <Star className="w-3 h-3" /> Primary
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <FieldNote label="Account Holder" value={bank.accountHolderName} />
                <FieldNote label="Account Number" value={`•••• •••• ${bank.accountNumberLast4}`} />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-base-300 mt-auto">
                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEdit(bank)} className="btn btn-ghost btn-xs gap-1">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(bank._id)} className="btn btn-ghost btn-xs text-error gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Remove
                  </button>
                </div>
                {!bank.isPrimary && (
                  <button type="button" onClick={() => handleSetPrimary(bank._id)} className="btn btn-outline btn-primary btn-xs">
                    Make Primary
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {bankDetails?.length >= 3 && (
        <p className="text-xs text-base-content/40 text-center mt-4">
          Maximum of 3 bank accounts allowed. Remove one to add a new one.
        </p>
      )}

      {/* Bank Form Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="w-full sm:max-w-md bg-base-100 rounded-t-2xl sm:rounded-2xl shadow-depth-lg p-5 sm:p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-primary" />
                  {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
                </h2>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost btn-circle btn-sm">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const payload = {
                  accountHolderName: fd.get('accountHolderName'),
                  bankName: fd.get('bankName'),
                };
                if (!editingBank || !editingBank.isVerified) {
                  const last4 = fd.get('accountNumberLast4');
                  if (last4) payload.accountNumberLast4 = last4;
                  const ifsc = fd.get('ifscCode');
                  if (ifsc) payload.ifscCode = ifsc.toUpperCase();
                }
                handleSubmit(payload);
              }} className="space-y-4">
                
                <div className="flex flex-col gap-1.5">
                  <label className="label-text">Account Holder Name</label>
                  <input
                    name="accountHolderName"
                    type="text"
                    defaultValue={editingBank?.accountHolderName}
                    className="input-field"
                    required
                    placeholder="Exact name on bank account"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="label-text">Account No. (Last 4)</label>
                    <input
                      name="accountNumberLast4"
                      type="text"
                      maxLength={4}
                      pattern="\d{4}"
                      defaultValue={editingBank?.accountNumberLast4}
                      className="input-field"
                      required={!editingBank?.isVerified}
                      disabled={editingBank?.isVerified}
                      placeholder="e.g. 1234"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="label-text">IFSC Code</label>
                    <input
                      name="ifscCode"
                      type="text"
                      defaultValue={editingBank?.ifscCode}
                      className="input-field uppercase"
                      required={!editingBank?.isVerified}
                      disabled={editingBank?.isVerified}
                      placeholder="e.g. HDFC0001234"
                    />
                  </div>
                </div>
                
                {editingBank?.isVerified && (
                  <p className="text-[0.65rem] text-warning mt-1 leading-snug">
                    Account number and IFSC cannot be changed after verification. Please add a new account instead.
                  </p>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="label-text">Bank Name</label>
                  <input
                    name="bankName"
                    type="text"
                    defaultValue={editingBank?.bankName}
                    className="input-field"
                    required
                    placeholder="e.g. State Bank of India"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost flex-1">Cancel</button>
                  <button type="submit" disabled={submittingAction} className="btn btn-primary-cta flex-1 gap-2">
                    {submittingAction && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save Account
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACTIONS (LEDGER) TAB
// ═══════════════════════════════════════════════════════════════════════════

function TransactionsTab({ items, pagination, loading, onPageChange }) {
  if (loading) return <SectionLoading label="Loading ledger" />;
  if (!items?.length) return <EmptyState label="No transactions yet" hint="Your earning, recovery and withdrawal entries will show up here." />;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-base-300">
        <h3 className="text-base font-bold text-base-content flex items-center gap-2">
          <Receipt className="w-4.5 h-4.5 text-primary" />
          Wallet Ledger
        </h3>
        <p className="text-xs text-base-content/40 mt-1">Immutable, append-only record of every balance movement.</p>
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>Before</th>
              <th>After</th>
              <th>Date</th>
              <th>Booking</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.txnId}>
                <td><LedgerTypeBadge type={t.type} direction={t.direction} /></td>
                <td className={t.direction === 'debit' ? 'text-error font-semibold' : 'text-success font-semibold'}>
                  {t.direction === 'debit' ? '-' : '+'}
                  {fmtINR(t.amount)}
                </td>
                <td className="text-base-content/50">{fmtINR(t.beforeBalance)}</td>
                <td className="font-semibold">{fmtINR(t.afterBalance)}</td>
                <td className="text-xs text-base-content/50">{fmtDateTime(t.createdAt)}</td>
                <td className="text-xs text-base-content/50">{t.bookingId ? String(t.bookingId).slice(-6) : '—'}</td>
                <td className="text-xs text-base-content/50 max-w-[220px] truncate">{t.remarks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden divide-y divide-base-300">
        {items.map((t) => (
          <div key={t.txnId} className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <LedgerTypeBadge type={t.type} direction={t.direction} />
              <span className={`font-bold text-sm ${t.direction === 'debit' ? 'text-error' : 'text-success'}`}>
                {t.direction === 'debit' ? '-' : '+'}
                {fmtINR(t.amount)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldNote label="Balance After" value={fmtINR(t.afterBalance)} />
              <FieldNote label="Date" value={fmtDate(t.createdAt)} />
            </div>
            {t.remarks && <p className="text-xs text-base-content/50 leading-snug">{t.remarks}</p>}
          </div>
        ))}
      </div>

      <div className="p-4 sm:p-6 pt-0">
        <Pagination pagination={pagination} onChange={onPageChange} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTLEMENTS TAB
// ═══════════════════════════════════════════════════════════════════════════

function SettlementsTab({ items, pagination, loading, onPageChange }) {
  if (loading) return <SectionLoading label="Loading settlements" />;
  if (!items?.length) return <EmptyState label="No settlements yet" hint="One record is created per booking once it completes." />;

  return (
    <div className="space-y-4">
      {items.map((s) => (
        <motion.div key={s._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-sm font-bold text-base-content">{s.settlementId}</p>
              <p className="text-xs text-base-content/40">
                Booking {s.bookingId?.bookingCode ?? '—'} · {fmtDate(s.bookingId?.scheduledAt ?? s.createdAt)}
              </p>
            </div>
            <StatusBadge status={s.settlementStatus} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <FieldNote label="Gross" value={fmtINR(s.grossAmount)} hint="Before deductions" />
            <FieldNote label="Platform Fee" value={fmtINR(s.platformFee)} hint="Likeson commission" />
            <FieldNote label="Tax" value={fmtINR(s.taxAmount)} hint="GST applied" />
            <FieldNote label="Recovery" value={fmtINR(s.recoveryDeduction)} hint="Liability deducted" valueClassName={s.recoveryDeduction > 0 ? 'text-error' : ''} />
            <FieldNote label="Net Settled" value={fmtINR(s.netSettlement)} hint="Credited to wallet" valueClassName="text-success" />
            <FieldNote label="Subscription Absorbed" value={fmtINR(s.subscriptionAbsorbed)} hint="Platform-covered discount" />
          </div>

          {s.settlementStatus === 'REVERSED' && (
            <div className="alert alert-error mt-4">
              <XCircle className="w-4 h-4 shrink-0" />
              <div className="text-xs">
                <p className="font-semibold">Reversed {fmtDate(s.reversedAt)}</p>
                {s.reversalReason && <p className="text-base-content/60">{s.reversalReason}</p>}
              </div>
            </div>
          )}
        </motion.div>
      ))}
      <Pagination pagination={pagination} onChange={onPageChange} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ALLOCATIONS TAB
// ═══════════════════════════════════════════════════════════════════════════

function AllocationsTab({ items, pagination, loading, onPageChange }) {
  if (loading) return <SectionLoading label="Loading allocations" />;
  if (!items?.length) return <EmptyState label="No allocations yet" hint="Created per booking before settlement runs." />;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-base-300">
        <h3 className="text-base font-bold text-base-content flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-primary" />
          Booking Allocations
        </h3>
        <p className="text-xs text-base-content/40 mt-1">Your earning share computed per completed booking.</p>
      </div>

      <div className="divide-y divide-base-300">
        {items.map((a) => (
          <div key={a._id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-base-content truncate">{a.bookingId?.bookingCode ?? 'Booking'}</p>
              <p className="text-xs text-base-content/40">{fmtDate(a.bookingId?.scheduledAt)} · {a.bookingType?.replace(/_/g, ' ')}</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1">
              <FieldNote label="Gross" value={fmtINR(a.grossAmount)} />
              <FieldNote label="Net Payable" value={fmtINR(a.netPayable)} valueClassName="text-success" />
              <FieldNote label="Cash Collected" value={a.isCashCollector ? fmtINR(a.cashCollected) : '—'} hint={a.isCashCollector ? 'You collected this booking' : 'Not the collector'} />
              <div className="flex items-center"><StatusBadge status={a.status} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 sm:p-6 pt-0">
        <Pagination pagination={pagination} onChange={onPageChange} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WITHDRAWALS TAB
// ═══════════════════════════════════════════════════════════════════════════

function WithdrawalsTab({ items, pagination, loading, onPageChange, onNewRequest, canWithdraw }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold text-base-content flex items-center gap-2">
            <ArrowUpFromLine className="w-4.5 h-4.5 text-primary" />
            Withdrawal History
          </h3>
          <p className="text-xs text-base-content/40 mt-1">Payouts move through RazorpayX once approved.</p>
        </div>
        <button type="button" onClick={onNewRequest} disabled={!canWithdraw} className="btn btn-primary btn-sm gap-2">
          <Banknote className="w-4 h-4" />
          New Request
        </button>
      </div>

      {loading ? (
        <SectionLoading label="Loading withdrawals" />
      ) : !items?.length ? (
        <EmptyState label="No withdrawals yet" hint="Request a payout once your available balance is sufficient." />
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="divide-y divide-base-300">
            {items.map((wd) => (
              <div key={wd._id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-base-content">{wd.withdrawalId}</p>
                  <p className="text-xs text-base-content/40">
                    Requested {fmtDateTime(wd.requestedAt)}
                    {wd.completedAt ? ` · Completed ${fmtDateTime(wd.completedAt)}` : ''}
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1">
                  <FieldNote label="Amount" value={fmtINR(wd.amount)} />
                  <FieldNote label="UTR" value={wd.utr ?? '—'} hint="Bank reference once processed" />
                  <FieldNote label="Bank" value={wd.bankAccountSnapshot?.bankName ?? '—'} hint={wd.bankAccountSnapshot ? `••••${wd.bankAccountSnapshot.accountNumberLast4 ?? '----'}` : undefined} />
                </div>
                <div className="flex items-center gap-2"><StatusBadge status={wd.status} /></div>
              </div>
            ))}
          </div>
          <div className="p-4 sm:p-6 pt-0">
            <Pagination pagination={pagination} onChange={onPageChange} />
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIABILITIES TAB
// ═══════════════════════════════════════════════════════════════════════════

function LiabilitiesTab({ items, outstandingTotal, loading, onPageChange }) {
  if (loading) return <SectionLoading label="Loading liabilities" />;

  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6 flex items-center justify-between gap-3">
        <FieldNote label="Total Outstanding" value={fmtINR(outstandingTotal)} hint="Sum across OPEN and PARTIALLY_RECOVERED liabilities" valueClassName={outstandingTotal > 0 ? 'text-error' : 'text-success'} icon={ShieldAlert} />
      </div>

      {!items?.length ? (
        <EmptyState label="No outstanding liabilities" hint="Cash-collection liabilities appear here when you collect more cash than your own earning." />
      ) : (
        items.map((l) => (
          <div key={l._id} className="card p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <FieldNote label="Booking" value={l.booking?.bookingCode ?? '—'} hint={fmtDate(l.createdAt)} />
              <StatusBadge status={l.status} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FieldNote label="Collected" value={fmtINR(l.amountCollected)} hint="Total cash received" />
              <FieldNote label="Own Earning" value={fmtINR(l.ownEarning)} hint="Your entitlement" />
              <FieldNote label="Recovered" value={fmtINR(l.amountRecovered)} hint="Deducted so far" />
              <FieldNote label="Outstanding" value={fmtINR(l.outstandingLiability)} hint="Remaining to recover" valueClassName={l.outstandingLiability > 0 ? 'text-error' : 'text-success'} />
            </div>
            {l.status === 'WAIVED' && (
              <div className="alert alert-info mt-4">
                <Info className="w-4 h-4 shrink-0" />
                <p className="text-xs">Waived {fmtDate(l.waivedAt)}{l.waiverReason ? ` — ${l.waiverReason}` : ''}</p>
              </div>
            )}
          </div>
        ))
      )}
      <Pagination pagination={null} onChange={onPageChange} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMPLIFIED WITHDRAW MODAL
// ═══════════════════════════════════════════════════════════════════════════

function WithdrawModal({ open, onClose, availableBalance, bankDetails = [], canWithdraw, submitting, onSubmit }) {
  const [amount, setAmount] = useState('');
  
  // Set default selected bank to the primary one, or the first available
  const defaultBank = bankDetails.find(b => b.isPrimary) || bankDetails[0];
  const [selectedBankId, setSelectedBankId] = useState(defaultBank?._id || '');

  useEffect(() => {
    if (open) {
      setAmount('');
      if (defaultBank) setSelectedBankId(defaultBank._id);
    }
  }, [open, defaultBank]);

  const numericAmount = Number(amount);
  const isAmountValid = amount && !Number.isNaN(numericAmount) && numericAmount >= 100 && numericAmount <= 50000 && numericAmount <= availableBalance;
  
  const noBankSaved = bankDetails.length === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAmountValid || !selectedBankId) {
      toast.error('Check amount and selected bank account.');
      return;
    }
    await onSubmit({
      amount: numericAmount,
      bankId: selectedBankId,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className="w-full sm:max-w-md bg-base-100 rounded-t-2xl sm:rounded-2xl shadow-depth-lg"
          >
            <div className="flex items-center justify-between p-5 border-b border-base-300">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Landmark className="w-5 h-5 text-primary" /> Request Withdrawal
              </h2>
              <button type="button" onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {!canWithdraw && (
                <div className="alert alert-warning">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <p className="text-xs">Withdrawals are currently unavailable. Ensure KYC and Bank details are verified.</p>
                </div>
              )}

              {noBankSaved && canWithdraw && (
                <div className="alert alert-error">
                  <Building2 className="w-4 h-4 shrink-0" />
                  <p className="text-xs">You need to add a bank account in the <b>Bank Details</b> tab before you can withdraw funds.</p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="label-text">Withdrawal Amount (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input-field text-xl font-bold py-3"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={noBankSaved || !canWithdraw}
                />
                <div className="flex justify-between items-center text-[0.7rem] text-base-content/50 px-1">
                  <span>Min: ₹100, Max: ₹50,000</span>
                  <span className="font-semibold">Available: {fmtINR(availableBalance)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="label-text">Select Bank Account</label>
                <select
                  className="select select-bordered w-full bg-base-200/50"
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  disabled={noBankSaved || !canWithdraw}
                  required
                >
                  {noBankSaved && <option value="">No bank accounts found</option>}
                  {bankDetails.map(b => (
                    <option key={b._id} value={b._id}>
                      {b.bankName || 'Bank'} (•••• {b.accountNumberLast4}) {b.isPrimary ? ' - Primary' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2 border-t border-base-200">
                <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
                <button
                  type="submit"
                  disabled={!canWithdraw || noBankSaved || !isAmountValid || submitting}
                  className="btn btn-primary-cta flex-1 gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                  {submitting ? 'Processing…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}