"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Clock, CheckCircle2, RotateCcw, TrendingUp, Calendar,
  ChevronLeft, ChevronRight, X, Receipt, IndianRupee, Filter,
  Loader2, ArrowUpRight, Banknote, AlertCircle, User2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend,
} from "recharts";
import {
  fetchEarnings,
  fetchEarningDetail,
  setStatusFilter,
  setRangeFilter,
  setPage,
  clearSelectedEarning,
} from "@/store/slices/earningsSlice";

// ── Framer Motion variants (project convention) ──────────────────────────
const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};
const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const formatINR = (amount = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_META = {
  pending:  { label: "Pending",  badge: "badge-warning", icon: Clock },
  settled:  { label: "Settled",  badge: "badge-success", icon: CheckCircle2 },
  reversed: { label: "Reversed", badge: "badge-error",   icon: RotateCcw },
  recovery: { label: "Recovery", badge: "badge-info",    icon: AlertCircle },
  partial:  { label: "Partial",  badge: "badge-accent",  icon: Banknote },
};

const RANGE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export default function MyEarnings() {
  const dispatch = useDispatch();
  const {
    summary,
    periodBreakdown,
    items,
    pagination,
    filters,
    selectedEarning,
    listStatus,
    detailStatus,
  } = useSelector((state) => state.earnings);

  useEffect(() => {
    dispatch(fetchEarnings({ page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.range]);

  const handlePageChange = useCallback(
    (newPage) => {
      dispatch(setPage(newPage));
      dispatch(fetchEarnings({ page: newPage }));
    },
    [dispatch]
  );

  const handleViewDetail = useCallback(
    (allocationId) => {
      dispatch(fetchEarningDetail(allocationId));
    },
    [dispatch]
  );

  // ── Chart data — group periodBreakdown rows by period into pending/settled columns ──
  const chartData = useMemo(() => {
    const map = new Map();
    (periodBreakdown || []).forEach((row) => {
      const period = row._id.period;
      const status = row._id.status;
      if (!map.has(period)) map.set(period, { period, pending: 0, settled: 0 });
      const entry = map.get(period);
      if (status === "pending") entry.pending = row.total;
      if (status === "settled") entry.settled = row.total;
    });
    return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period)).slice(-12);
  }, [periodBreakdown]);

  const statCards = [
    {
      key: "pending",
      label: "Pending Earnings",
      value: summary.pending.total,
      count: summary.pending.count,
      icon: Clock,
      tone: "warning",
    },
    {
      key: "settled",
      label: "Settled Earnings",
      value: summary.settled.total,
      count: summary.settled.count,
      icon: CheckCircle2,
      tone: "success",
    },
    {
      key: "allTime",
      label: "All-Time Earnings",
      value: summary.allTimeGross,
      count: summary.pending.count + summary.settled.count,
      icon: TrendingUp,
      tone: "primary",
    },
    {
      key: "net",
      label: "Net Payable (All-Time)",
      value: summary.allTimeNet,
      count: null,
      icon: Wallet,
      tone: "accent",
    },
  ];

  return (
    <div className="container-custom py-8 max-w-7xl">
      {/* ── Header ── */}
      <motion.div
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="section-heading mb-1">My Earnings</h1>
          <p className="section-subheading mb-0">
            Track what you've earned from completed bookings — pending and settled.
          </p>
        </div>

        <div className="flex items-center gap-1 bg-base-200 rounded-field p-1 border border-base-300 w-fit">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => dispatch(setRangeFilter(opt.value))}
              className={`btn btn-sm ${
                filters.range === opt.value ? "btn-primary" : "btn-ghost"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── Stat Cards ── */}
      <motion.div
        variants={STAGGER}
        initial="hidden"
        animate="show"
        className="grid-responsive mb-8"
      >
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.key} variants={ITEM} className="stat-card glass-card">
              <div className="flex items-start justify-between mb-3">
                <div className={`badge badge-${card.tone}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {card.label}
                </div>
              </div>
              <div className="stat-card-value flex items-center gap-1">
                <IndianRupee className="w-6 h-6" strokeWidth={2.5} />
                {card.value.toLocaleString("en-IN")}
              </div>
              {card.count !== null && (
                <div className="stat-card-label">{card.count} booking{card.count !== 1 ? "s" : ""}</div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Chart ── */}
      <motion.div variants={FADE_UP} initial="hidden" animate="show" className="card p-5 md:p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">Earnings Trend</h3>
        </div>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-base-content/40">
            <Receipt className="w-10 h-10 mb-2" />
            <p className="text-sm">No earnings data for this range yet</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: "var(--base-content)" }} />
              <YAxis tick={{ fontSize: 12, fill: "var(--base-content)" }} />
              <Tooltip
                formatter={(value) => formatINR(value)}
                contentStyle={{
                  backgroundColor: "var(--base-100)",
                  border: "1px solid var(--base-300)",
                  borderRadius: "var(--r-field)",
                  fontSize: "0.8rem",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "0.8rem" }} />
              <Bar dataKey="pending" name="Pending" fill="var(--warning)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="settled" name="Settled" fill="var(--success)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      {/* ── Filters ── */}
      <motion.div
        variants={FADE_UP}
        initial="hidden"
        animate="show"
        className="flex flex-wrap items-center gap-3 mb-4"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-base-content/50" />
          <span className="text-sm font-semibold text-base-content/70">Status:</span>
        </div>
        {["", "pending", "settled", "reversed", "recovery", "partial"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => dispatch(setStatusFilter(s))}
            className={`badge cursor-pointer ${
              filters.status === s ? "badge-primary" : "badge-secondary opacity-60"
            }`}
          >
            {s ? STATUS_META[s]?.label : "All"}
          </button>
        ))}
      </motion.div>

      {/* ── Earnings Table ── */}
      <motion.div variants={FADE_UP} initial="hidden" animate="show" className="card overflow-hidden">
        {listStatus === "loading" && items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-base-content/40">
            <Receipt className="w-12 h-12 mb-3" />
            <p className="text-sm font-semibold">No earnings found</p>
            <p className="text-xs mt-1">Complete a booking to start earning</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Gross</th>
                  <th>Net Payable</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const meta = STATUS_META[item.status] || STATUS_META.pending;
                  const StatusIcon = meta.icon;
                  return (
                    <tr key={item._id}>
                      <td>
                        <span className="font-bold text-sm">
                          {item.bookingId?.bookingCode || "—"}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-base-content/60 capitalize">
                          {(item.bookingId?.bookingType || item.bookingType || "").replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="text-sm">{formatDate(item.createdAt)}</td>
                      <td className="font-semibold text-sm">{formatINR(item.grossAmount)}</td>
                      <td className="font-semibold text-sm text-success">{formatINR(item.netPayable)}</td>
                      <td>
                        <span className={`badge badge-sm ${meta.badge}`}>
                          <StatusIcon className="w-3 h-3" />
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleViewDetail(item._id)}
                          className="btn btn-ghost btn-sm"
                        >
                          View <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-base-300">
            <span className="text-xs text-base-content/50">
              Page {pagination.page} of {pagination.totalPages} · {pagination.totalCount} total
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Detail Drawer/Modal ── */}
      <AnimatePresence>
        {selectedEarning && (
          <EarningDetailModal
            data={selectedEarning}
            loading={detailStatus === "loading"}
            onClose={() => dispatch(clearSelectedEarning())}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Detail Modal ────────────────────────────────────────────────────────

function EarningDetailModal({ data, loading, onClose }) {
  const { allocation, settlement, liability } = data || {};
  const meta = STATUS_META[allocation?.status] || STATUS_META.pending;
  const StatusIcon = meta.icon;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-soft p-0 md:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="glass-card w-full md:max-w-lg max-h-[88vh] overflow-y-auto scrollbar-thin rounded-t-box md:rounded-box"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-base-300 sticky top-0 bg-base-100/90 backdrop-blur-soft z-10">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            Earning Detail
          </h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !allocation ? (
          <div className="p-8 text-center text-base-content/50 text-sm">No data found</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Status + amount */}
            <div className="flex items-center justify-between">
              <span className={`badge ${meta.badge}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {meta.label}
              </span>
              <span className="stat-card-value text-2xl">{formatINR(allocation.netPayable)}</span>
            </div>

            {/* Booking info */}
            <div className="stat-card">
              <div className="stat-card-label mb-2">Booking</div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-base-content/60">Code</span>
                <span className="font-semibold">{allocation.bookingId?.bookingCode || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-base-content/60">Type</span>
                <span className="font-semibold capitalize">
                  {(allocation.bookingId?.bookingType || "").replaceAll("_", " ")}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-base-content/60 flex items-center gap-1">
                  <User2 className="w-3.5 h-3.5" /> Patient
                </span>
                <span className="font-semibold">{allocation.bookingId?.patientInfo?.name || "—"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-base-content/60 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Scheduled
                </span>
                <span className="font-semibold">{formatDate(allocation.bookingId?.scheduledAt)}</span>
              </div>
            </div>

            {/* Amount breakdown */}
            <div className="stat-card">
              <div className="stat-card-label mb-3">Amount Breakdown</div>
              <BreakdownRow label="Gross Amount" value={allocation.grossAmount} />
              <BreakdownRow label="Platform Fee" value={-allocation.platformFee} negative />
              <BreakdownRow label="Tax" value={-allocation.taxAmount} negative />
              <BreakdownRow label="TDS" value={-allocation.tdsAmount} negative />
              {allocation.recoveryDeduction > 0 && (
                <BreakdownRow label="Recovery Deduction" value={-allocation.recoveryDeduction} negative />
              )}
              <div className="divider my-2" />
              <BreakdownRow label="Net Payable" value={allocation.netPayable} bold />
            </div>

            {/* Cash collector info */}
            {allocation.isCashCollector && (
              <div className="alert alert-info">
                <Banknote className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="text-sm">
                  You collected <strong>{formatINR(allocation.cashCollected)}</strong> cash for this
                  booking on behalf of all partners.
                </div>
              </div>
            )}

            {/* Liability */}
            {liability && (
              <div className="stat-card">
                <div className="stat-card-label mb-2">Collection Liability</div>
                <BreakdownRow label="Total Liability" value={liability.totalLiability} />
                <BreakdownRow label="Recovered" value={liability.amountRecovered} />
                <BreakdownRow label="Outstanding" value={liability.outstandingLiability} bold />
                <div className="mt-2">
                  <span className={`badge badge-sm ${
                    liability.status === "RECOVERED" ? "badge-success" : "badge-warning"
                  }`}>
                    {liability.status}
                  </span>
                </div>
              </div>
            )}

            {/* Settlement */}
            {settlement && (
              <div className="stat-card">
                <div className="stat-card-label mb-2">Settlement</div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-base-content/60">Settlement ID</span>
                  <span className="font-semibold">{settlement.settlementId}</span>
                </div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-base-content/60">Status</span>
                  <span className="font-semibold">{settlement.settlementStatus}</span>
                </div>
                {settlement.settledAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-base-content/60">Settled On</span>
                    <span className="font-semibold">{formatDate(settlement.settledAt)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function BreakdownRow({ label, value, negative = false, bold = false }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span className="text-base-content/60">{label}</span>
      <span className={`${bold ? "font-bold text-base" : "font-medium"} ${negative ? "text-error" : ""}`}>
        {negative ? "-" : ""}
        {formatINR(Math.abs(value || 0))}
      </span>
    </div>
  );
}