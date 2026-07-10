'use client';
 

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, CheckCircle2, RotateCcw, AlertTriangle, Clock,
  Calendar, ChevronLeft, ChevronRight, X, RefreshCw,
  ArrowUpRight, ArrowDownRight, FileText, TrendingUp,
  Filter, RotateCw, Banknote, Receipt, ShieldAlert, Ticket,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Legend,
} from 'recharts';

import {
  fetchEarnings,
  fetchEarningDetail,
  setStatusFilter,
  setRangeFilter,
  setDateRangeFilter,
  setPage,
  clearSelectedEarning,
  resetFilters,
} from '@/store/slices/earningsSlice';

// ─────────────────────────────────────────────────────────────────
// STATIC CONFIG
// ─────────────────────────────────────────────────────────────────

const STATUS_META = {
  pending:  { label: 'Pending',  icon: Clock,        tone: 'warning' },
  settled:  { label: 'Settled',  icon: CheckCircle2, tone: 'success' },
  reversed: { label: 'Reversed', icon: RotateCcw,    tone: 'error'   },
  recovery: { label: 'Recovery', icon: AlertTriangle,tone: 'error'   },
  partial:  { label: 'Partial',  icon: Wallet,        tone: 'info'    },
};

const CHART_COLOR = {
  pending:  'var(--warning)',
  settled:  'var(--success)',
  reversed: 'var(--error)',
  recovery: 'color-mix(in srgb, var(--error), black 20%)',
  partial:  'var(--info)',
};

const RANGE_OPTIONS = [
  { value: 'weekly',  label: 'Weekly'  },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly',  label: 'Yearly'  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// ─────────────────────────────────────────────────────────────────
// SMALL PRESENTATIONAL PIECES
// ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`badge badge-${meta.tone}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

function SummaryCard({ statusKey, data, index, active, onClick }) {
  const meta = STATUS_META[statusKey];
  const Icon = meta.icon;
  return (
    <motion.button
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="show"
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97 }}
      className={`stat-card text-left cursor-pointer ${active ? 'border-primary/50' : ''}`}
    >
      <div className="flex items-start justify-between">
        <span className={`p-2 rounded-xl bg-${meta.tone}/10`}>
          <Icon size={16} className={`text-${meta.tone}`} />
        </span>
        <span className="text-[10px] font-bold text-base-content/35">{data.count} entries</span>
      </div>
      <p className="stat-card-value mt-3 text-xl">{inr(data.netTotal)}</p>
      <p className="stat-card-label">{meta.label}</p>
      <p className="text-[10px] font-semibold text-base-content/35 mt-0.5">
        Gross {inr(data.total)}
      </p>
    </motion.button>
  );
}

function HeroCard({ gross, net }) {
  return (
    <motion.div
      variants={fadeUp} custom={0} initial="hidden" animate="show"
      className="glass-card p-5 lg:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary/80 flex items-center gap-1.5">
          <TrendingUp size={13} /> All-Time Net Earnings
        </p>
        <p className="text-3xl lg:text-4xl font-black text-base-content mt-1 font-montserrat">
          {inr(net)}
        </p>
        <p className="text-xs text-base-content/45 mt-1">
          on {inr(gross)} gross across all statuses
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary/8 border border-primary/20 self-start">
        <Banknote size={16} className="text-primary" />
        <span className="text-xs font-bold text-primary">
          {gross > 0 ? `${Math.round((net / gross) * 100)}% retained` : '—'}
        </span>
      </div>
    </motion.div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3.5 py-2.5 text-[11px]">
      <p className="font-bold mb-1.5 text-base-content">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 m-0" style={{ color: p.color }}>
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          {STATUS_META[p.dataKey]?.label ?? p.dataKey}: <strong>{inr(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3">
      <FileText size={30} className="text-base-content/20" />
      <p className="text-xs font-semibold text-base-content/40">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────

function EarningDetailDrawer({ open, onClose, detail, loading }) {
  const allocation = detail?.allocation;
  const settlement = detail?.settlement;
  const liability = detail?.liability;
  const booking = allocation?.bookingId;

  const rows = allocation ? [
    { label: 'Gross amount',       value: allocation.grossAmount,       sign: '+' },
    { label: 'Platform fee',       value: allocation.platformFee,       sign: '−' },
    { label: 'Tax',                value: allocation.taxAmount,         sign: '−' },
    { label: 'TDS',                value: allocation.tdsAmount,         sign: '−' },
    { label: 'Recovery deduction', value: allocation.recoveryDeduction, sign: '−' },
  ] : [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="fixed inset-y-0 right-0 z-[91] w-full sm:w-[420px] bg-base-100 border-l border-base-300 overflow-y-auto"
          >
            <div className="sticky top-0 bg-base-100/95 backdrop-blur-strong border-b border-base-300 px-5 py-4 flex items-center justify-between">
              <h3 className="text-sm font-black text-base-content">Earning Detail</h3>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors">
                <X size={16} className="text-base-content/60" />
              </button>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {Array(5).fill(0).map((_, i) => (
                  <div key={i} className="h-12 skeleton rounded-xl" />
                ))}
              </div>
            ) : !allocation ? (
              <EmptyState label="Could not load this earning." />
            ) : (
              <div className="p-5 space-y-5">

                <div className="flex items-center justify-between">
                  <StatusBadge status={allocation.status} />
                  <span className="text-[11px] font-semibold text-base-content/40">
                    {allocation.createdAt ? new Date(allocation.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </span>
                </div>

                {/* Booking context */}
                <div className="card p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2">Booking</p>
                  <p className="text-sm font-bold text-base-content">{booking?.bookingCode ?? '—'}</p>
                  <p className="text-xs text-base-content/50 mt-0.5 capitalize">
                    {booking?.bookingType?.replace(/_/g, ' ') ?? allocation.bookingType?.replace(/_/g, ' ')} · {booking?.consultationType ?? allocation.partnerRole}
                  </p>
                  {booking?.scheduledAt && (
                    <p className="text-[11px] text-base-content/40 mt-1.5 flex items-center gap-1.5">
                      <Calendar size={11} /> {new Date(booking.scheduledAt).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>

                {/* Amount breakdown */}
                <div className="card p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-3">Breakdown</p>
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between text-xs">
                        <span className="text-base-content/55 font-semibold">{r.label}</span>
                        <span className={`font-bold ${r.sign === '−' ? 'text-error' : 'text-base-content'}`}>
                          {r.sign} {inr(r.value)}
                        </span>
                      </div>
                    ))}
                    <div className="divider !my-2" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-black text-base-content">Net payable</span>
                      <span className="font-black text-success">{inr(allocation.netPayable)}</span>
                    </div>
                    {allocation.subscriptionAbsorbed > 0 && (
                      <p className="text-[10px] text-base-content/35 pt-1">
                        Includes {inr(allocation.subscriptionAbsorbed)} subscription discount absorbed by platform.
                      </p>
                    )}
                  </div>
                </div>

                {/* Settlement */}
                {settlement && (
                  <div className="card p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2 flex items-center gap-1.5">
                      <Receipt size={12} /> Settlement
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-base-content/55 font-semibold">Reference</span>
                      <span className="font-bold text-base-content">{settlement.settlementCode ?? settlement._id?.slice(-8) ?? '—'}</span>
                    </div>
                    {allocation.settledAt && (
                      <div className="flex items-center justify-between text-xs mt-2">
                        <span className="text-base-content/55 font-semibold">Settled on</span>
                        <span className="font-bold text-base-content">
                          {new Date(allocation.settledAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Cash collection liability */}
                {liability && (
                  <div className="alert alert-warning">
                    <ShieldAlert size={16} className="text-warning shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-warning">Cash Collector Liability</p>
                      <p className="text-[11px] text-base-content/55 mt-0.5">
                        You collected {inr(allocation.cashCollected)} in cash for this booking. Outstanding liability: {inr(liability.outstandingAmount ?? liability.amount ?? 0)}.
                      </p>
                    </div>
                  </div>
                )}

                {allocation.remarks && (
                  <div className="flex items-start gap-2 text-[11px] text-base-content/45">
                    <Ticket size={13} className="shrink-0 mt-0.5" />
                    <p>{allocation.remarks}</p>
                  </div>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

export default function Earnings() {
  const dispatch = useDispatch();
  const {
    summary, periodBreakdown, items, pagination, filters,
    selectedEarning, listStatus, detailStatus,
  } = useSelector((s) => s.earnings);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dateDraft, setDateDraft] = useState({ from: filters.from, to: filters.to });

  useEffect(() => {
    dispatch(fetchEarnings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, filters.status, filters.range, filters.from, filters.to, pagination.page]);

  const handleStatusClick = useCallback((key) => {
    dispatch(setStatusFilter(filters.status === key ? '' : key));
  }, [dispatch, filters.status]);

  const handleRowClick = useCallback((allocationId) => {
    setDrawerOpen(true);
    dispatch(fetchEarningDetail(allocationId));
  }, [dispatch]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    dispatch(clearSelectedEarning());
  }, [dispatch]);

  const applyDateRange = () => dispatch(setDateRangeFilter(dateDraft));

  const chartData = useMemo(() => {
    const map = new Map();
    (periodBreakdown || []).forEach((row) => {
      const period = row._id.period;
      const status = row._id.status;
      if (!map.has(period)) map.set(period, { period });
      map.get(period)[status] = row.netTotal;
    });
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
  }, [periodBreakdown]);

  const isLoading = listStatus === 'loading';
  const statusKeys = Object.keys(STATUS_META);

  return (
    <div className="space-y-6  pb-10">

      {/* ── Header ─────────────────────────────────────────── */}
      <motion.div
        variants={fadeUp} custom={0} initial="hidden" animate="show"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-xl font-black text-base-content font-montserrat">Earnings</h1>
          <p className="text-xs text-base-content/45 mt-0.5">
            Track allocations, settlements and recoveries across every booking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch(fetchEarnings())}
            className="btn btn-ghost btn-sm border border-base-300"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => { dispatch(resetFilters()); setDateDraft({ from: '', to: '' }); }}
            className="btn btn-outline btn-sm"
          >
            Reset filters
          </button>
        </div>
      </motion.div>

      {/* ── Hero ───────────────────────────────────────────── */}
      <HeroCard gross={summary.allTimeGross} net={summary.allTimeNet} />

      {/* ── Summary cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statusKeys.map((key, i) => (
          <SummaryCard
            key={key}
            statusKey={key}
            data={summary[key]}
            index={i + 1}
            active={filters.status === key}
            onClick={() => handleStatusClick(key)}
          />
        ))}
      </div>

      {/* ── Filter bar ─────────────────────────────────────── */}
      <motion.div
        variants={fadeUp} custom={1} initial="hidden" animate="show"
        className="card p-4 flex flex-col lg:flex-row lg:items-center gap-3"
      >
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-base-content/40 shrink-0">
          <Filter size={12} /> Range
        </div>
        <div className="flex rounded-xl p-1 gap-1 bg-base-200 w-fit">
          {RANGE_OPTIONS.map((r) => (
            <button
              key={r.value}
              onClick={() => dispatch(setRangeFilter(r.value))}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                filters.range === r.value ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:text-base-content'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 lg:ml-auto">
          <input
            type="date"
            value={dateDraft.from || ''}
            onChange={(e) => setDateDraft((d) => ({ ...d, from: e.target.value }))}
            className="input-field !py-1.5 !text-xs w-36"
          />
          <span className="text-base-content/30 text-xs">to</span>
          <input
            type="date"
            value={dateDraft.to || ''}
            onChange={(e) => setDateDraft((d) => ({ ...d, to: e.target.value }))}
            className="input-field !py-1.5 !text-xs w-36"
          />
          <button onClick={applyDateRange} className="btn btn-primary btn-sm">Apply</button>
        </div>
      </motion.div>

      {/* ── Chart ──────────────────────────────────────────── */}
      <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show" className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-base-content/55">
            Net Earnings by Period
          </h3>
          <span className="text-[11px] font-semibold text-base-content/35 capitalize">{filters.range} view</span>
        </div>
        {chartData.length === 0 ? (
          <EmptyState label="No earnings data for this range yet." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--base-300)', opacity: 0.3 }} />
                <Legend
                  formatter={(v) => STATUS_META[v]?.label ?? v}
                  wrapperStyle={{ fontSize: 11, fontWeight: 700 }}
                />
                {statusKeys.map((key) => (
                  <Bar key={key} dataKey={key} stackId="a" fill={CHART_COLOR[key]} radius={[3, 3, 0, 0]} maxBarSize={36} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* ── Table ──────────────────────────────────────────── */}
      <motion.div variants={fadeUp} custom={3} initial="hidden" animate="show" className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <h3 className="text-xs font-black uppercase tracking-widest text-base-content/55">
            Transactions
          </h3>
          <span className="text-[11px] font-semibold text-base-content/35">
            {pagination.totalCount} total
          </span>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {Array(6).fill(0).map((_, i) => <div key={i} className="h-12 skeleton rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState label="No earnings match the current filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item._id}
                    onClick={() => handleRowClick(item._id)}
                    className="cursor-pointer"
                  >
                    <td>
                      <p className="font-bold text-base-content">{item.bookingId?.bookingCode ?? '—'}</p>
                      <p className="text-[10px] text-base-content/40">{item.bookingId?.patientInfo?.name}</p>
                    </td>
                    <td className="capitalize text-xs text-base-content/60">
                      {item.bookingType?.replace(/_/g, ' ')}
                    </td>
                    <td className="text-xs text-base-content/60">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="text-xs font-semibold text-base-content/70">{inr(item.grossAmount)}</td>
                    <td className="text-xs font-black text-success">{inr(item.netPayable)}</td>
                    <td><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-base-300">
            <span className="text-[11px] font-semibold text-base-content/40">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={pagination.page <= 1}
                onClick={() => dispatch(setPage(pagination.page - 1))}
                className="btn btn-ghost btn-xs border border-base-300 disabled:opacity-30"
              >
                <ChevronLeft size={13} />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => dispatch(setPage(pagination.page + 1))}
                className="btn btn-ghost btn-xs border border-base-300 disabled:opacity-30"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Detail drawer ──────────────────────────────────── */}
      <EarningDetailDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        detail={selectedEarning}
        loading={detailStatus === 'loading'}
      />
    </div>
  );
}