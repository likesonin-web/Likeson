'use client';

/**
 * SubscriptionsAnalysis.jsx
 * ─────────────────────────────────────────────────────────────────────────
 * Admin analytics dashboard for the Plans Router (§8) surface: MRR, revenue
 * collected, subscriber roster, and live active-subscription usage.
 *
 * Wired to the provided `subscriptionPlanSlice` thunks/selectors:
 *   fetchRevenueSummary, fetchRevenueByPlan, fetchSubscribers, fetchActiveSubscriptions
 *
 * Styling: Tailwind utility classes + the component classes already defined
 * in global.css (.card, .btn, .badge, .table, .stat-card, .input-field …).
 * No inline `style` props — every dynamic value is expressed through
 * Recharts data/props or conditional className, never raw CSS.
 *
 * NOTE: adjust the slice import path below to match your project structure.
 */

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, animate, useMotionValue, useMotionValueEvent } from 'framer-motion';
import {
  IndianRupee,
  TrendingUp,
  Users,
  UserPlus,
  Receipt,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Inbox,
  Calendar,
  X,
  Crown,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import {
  fetchRevenueSummary,
  fetchRevenueByPlan,
  fetchSubscribers,
  fetchActiveSubscriptions,
  selectRevenueSummary,
  selectRevenueSummaryLoading,
  selectRevenueSummaryError,
  selectRevenueByPlan,
  selectRevenueByPlanLoading,
  selectRevenueByPlanError,
  selectSubscribers,
  selectSubscribersPagination,
  selectSubscribersLoading,
  selectSubscribersError,
  selectActiveSubscriptions,
  selectActiveSubscriptionsPagination,
  selectActiveSubscriptionsLoading,
  selectActiveSubscriptionsError,
} from '@/store/slices/subscriptionPlanSlice';

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const STATUS_BADGE = {
  Active: 'badge-success',
  Trial: 'badge-info',
  Paused: 'badge-warning',
  Cancelled: 'badge-secondary',
  Expired: 'badge-error',
};

const PLAN_TYPE_BADGE = {
  fixed: 'badge-primary',
  custom: 'badge-accent',
};

const CHART_CSS_VARS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
  '--success',
  '--info',
  '--warning',
  '--error',
  '--secondary',
  '--base-content',
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(value ?? 0);

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const toISODate = (date) => date.toISOString().slice(0, 10);

const startOfThisMonth = () => {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
};

/** Resolves CSS custom properties (incl. oklch) to computed rgb strings, theme-aware. */
function useThemeColors() {
  const [colors, setColors] = useState({});

  useEffect(() => {
    const resolve = () => {
      const probe = document.createElement('span');
      probe.style.display = 'none';
      document.body.appendChild(probe);
      const next = {};
      CHART_CSS_VARS.forEach((name) => {
        probe.style.color = `var(${name})`;
        next[name] = getComputedStyle(probe).color;
      });
      document.body.removeChild(probe);
      setColors(next);
    };

    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class'],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// ─────────────────────────────────────────────────────────────────────────
// Small presentational pieces
// ─────────────────────────────────────────────────────────────────────────

function AnimatedNumber({ value = 0, formatter = formatNumber }) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(formatter(0));

  useMotionValueEvent(motionValue, 'change', (latest) => setDisplay(formatter(Math.round(latest))));

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span>{display}</span>;
}

function StatCard({ icon: Icon, label, value, sublabel, loading, accent = 'text-primary' }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
      className="stat-card flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="stat-card-label">{label}</span>
        <span className={`rounded-full bg-primary/10 p-2 ${accent}`}>
          <Icon className="h-4 w-4" strokeWidth={2.25} />
        </span>
      </div>
      {loading ? (
        <div className="skeleton h-8 w-28" />
      ) : (
        <p className="stat-card-value">
          <AnimatedNumber value={value} formatter={typeof value === 'number' ? formatNumber : () => value} />
        </p>
      )}
      {sublabel && <p className="text-xs text-base-content/60">{sublabel}</p>}
    </motion.div>
  );
}

function StatusPill({ status }) {
  return <span className={`badge badge-sm ${STATUS_BADGE[status] ?? 'badge-secondary'}`}>{status}</span>;
}

function PlanTypePill({ planType }) {
  return (
    <span className={`badge badge-sm ${PLAN_TYPE_BADGE[planType] ?? 'badge-secondary'}`}>{planType}</span>
  );
}

function SectionHeading({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="rounded-lg bg-primary/10 p-2 text-primary">
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <div>
        <h3 className="text-base font-bold text-base-content">{title}</h3>
        {subtitle && <p className="text-xs text-base-content/55">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyState({ label = 'Nothing here yet' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-base-content/45">
      <Inbox className="h-8 w-8" strokeWidth={1.5} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14">
      <AlertTriangle className="h-8 w-8 text-error" strokeWidth={1.5} />
      <p className="max-w-xs text-center text-sm text-base-content/60">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-outline btn-sm">
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

function TableSkeletonRows({ columns, rows = 5 }) {
  return Array.from({ length: rows }).map((_, r) => (
    <tr key={r}>
      {Array.from({ length: columns }).map((__, c) => (
        <td key={c}>
          <div className="skeleton h-4 w-full max-w-[10rem]" />
        </td>
      ))}
    </tr>
  ));
}

function Pagination({ pagination, onPageChange }) {
  const { page, pages, total } = pagination;
  if (!total) return null;

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-base-300 px-4 py-3 sm:flex-row">
      <p className="text-xs text-base-content/55">
        Page <span className="font-semibold text-base-content">{page}</span> of{' '}
        <span className="font-semibold text-base-content">{pages}</span> · {formatNumber(total)} total
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-circle"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Chart tooltip (styled with global.css tokens, not inline CSS)
// ─────────────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, valueFormatter = formatCurrency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-3 py-2 shadow-depth">
      {label && <p className="mb-1 text-xs font-semibold text-base-content/70">{label}</p>}
      {payload.map((entry) => (
        <p key={entry.dataKey ?? entry.name} className="text-sm font-bold text-base-content">
          {valueFormatter(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────

export default function SubscriptionsAnalysis() {
  const dispatch = useDispatch();
  const themeColors = useThemeColors();

  // ── Date range ────────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState(startOfThisMonth());
  const [endDate, setEndDate] = useState(toISODate(new Date()));

  // ── Roster tab state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('subscribers'); // 'subscribers' | 'active'
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planTypeFilter, setPlanTypeFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search, 400);

  // ── Selectors ─────────────────────────────────────────────────────────
  const revenueSummary = useSelector(selectRevenueSummary);
  const revenueSummaryLoading = useSelector(selectRevenueSummaryLoading);
  const revenueSummaryError = useSelector(selectRevenueSummaryError);

  const revenueByPlan = useSelector(selectRevenueByPlan);
  const revenueByPlanLoading = useSelector(selectRevenueByPlanLoading);
  const revenueByPlanError = useSelector(selectRevenueByPlanError);

  const subscribers = useSelector(selectSubscribers);
  const subscribersPagination = useSelector(selectSubscribersPagination);
  const subscribersLoading = useSelector(selectSubscribersLoading);
  const subscribersError = useSelector(selectSubscribersError);

  const activeSubscriptions = useSelector(selectActiveSubscriptions);
  const activeSubscriptionsPagination = useSelector(selectActiveSubscriptionsPagination);
  const activeSubscriptionsLoading = useSelector(selectActiveSubscriptionsLoading);
  const activeSubscriptionsError = useSelector(selectActiveSubscriptionsError);

  // ── Fetchers ──────────────────────────────────────────────────────────
  const loadRevenue = () => {
    dispatch(fetchRevenueSummary({ startDate, endDate }));
    dispatch(fetchRevenueByPlan({ startDate, endDate }));
  };

  const loadRoster = () => {
    if (activeTab === 'subscribers') {
      dispatch(
        fetchSubscribers({
          page,
          limit: PAGE_SIZE,
          status: statusFilter || undefined,
          planType: planTypeFilter || undefined,
          search: debouncedSearch || undefined,
        })
      );
    } else {
      dispatch(fetchActiveSubscriptions({ page, limit: PAGE_SIZE }));
    }
  };

  useEffect(loadRevenue, [dispatch, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(loadRoster, [dispatch, activeTab, page, statusFilter, planTypeFilter, debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 1 whenever a filter or tab changes
  useEffect(() => setPage(1), [activeTab, statusFilter, planTypeFilter, debouncedSearch]);

  const isRefreshing = revenueSummaryLoading || revenueByPlanLoading || subscribersLoading || activeSubscriptionsLoading;

  const handleRefreshAll = () => {
    loadRevenue();
    loadRoster();
  };

  // ── Derived chart data ───────────────────────────────────────────────
  const statusChartData = useMemo(() => {
    const breakdown = revenueSummary?.statusBreakdown ?? {};
    return Object.entries(breakdown).map(([name, value]) => ({ name, value }));
  }, [revenueSummary]);

  const statusColorFor = (status) =>
    ({
      Active: themeColors['--success'],
      Trial: themeColors['--info'],
      Paused: themeColors['--warning'],
      Cancelled: themeColors['--secondary'],
      Expired: themeColors['--error'],
    }[status] ?? themeColors['--chart-5']);

  const revenueBarData = useMemo(
    () => (revenueByPlan ?? []).map((p) => ({ ...p, shortName: p.planName?.length > 14 ? `${p.planName.slice(0, 13)}…` : p.planName })),
    [revenueByPlan]
  );

  const barPalette = [
    themeColors['--chart-1'],
    themeColors['--chart-2'],
    themeColors['--chart-3'],
    themeColors['--chart-4'],
    themeColors['--chart-5'],
    themeColors['--chart-6'],
  ];

  const containerStagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06 } },
  };

  return (
    <div data-theme="admin" className="min-h-screen bg-base-200/50 p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col justify-between gap-4 md:flex-row md:items-end"
        >
          <div>
            <span className="role-badge mb-2">
              <Crown className="h-3 w-3" /> Admin
            </span>
            <h1 className="text-3xl font-black text-base-content md:text-4xl">
              Subscription <span className="text-gradient-primary">Analytics</span>
            </h1>
            <p className="mt-1 text-sm text-base-content/60">
              Revenue, roster, and live usage across every plan on the platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="glass-card flex items-center gap-2 px-3 py-2">
              <Calendar className="h-4 w-4 text-base-content/50" />
              <input
                type="date"
                value={startDate}
                max={endDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-sm font-medium text-base-content outline-none"
              />
              <span className="text-base-content/40">–</span>
              <input
                type="date"
                value={endDate}
                min={startDate}
                max={toISODate(new Date())}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-sm font-medium text-base-content outline-none"
              />
            </div>

            <button type="button" onClick={handleRefreshAll} className="btn btn-primary btn-sm" disabled={isRefreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </motion.header>

        {/* ── Summary ────────────────────────────────────────────────── */}
        {revenueSummaryError ? (
          <div className="card p-6">
            <ErrorState message={revenueSummaryError} onRetry={loadRevenue} />
          </div>
        ) : (
          <motion.section variants={containerStagger} initial="hidden" animate="show" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <motion.div
              variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } }}
              className="glass-card relative col-span-1 flex flex-col justify-between overflow-hidden p-6 sm:col-span-2"
            >
              <Sparkles className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 text-primary/10" strokeWidth={1} />
              <div className="flex items-center justify-between">
                <span className="stat-card-label">Monthly Recurring Revenue</span>
                <span className="rounded-full bg-primary/10 p-2 text-primary">
                  <IndianRupee className="h-4 w-4" strokeWidth={2.25} />
                </span>
              </div>
              {revenueSummaryLoading ? (
                <div className="skeleton mt-3 h-10 w-40" />
              ) : (
                <p className="mt-2 text-4xl font-black text-gradient-primary">
                  <AnimatedNumber value={revenueSummary?.mrr ?? 0} formatter={formatCurrency} />
                </p>
              )}
              <p className="mt-2 text-xs text-base-content/55">
                From {formatNumber(revenueSummary?.activeSubscriptionsCount ?? 0)} active &amp; trial subscribers right now
              </p>
            </motion.div>

            <StatCard
              icon={TrendingUp}
              label="Revenue This Period"
              value={revenueSummaryLoading ? 0 : revenueSummary?.revenueThisPeriod ?? 0}
              sublabel={`${formatNumber(revenueSummary?.transactionCount ?? 0)} transactions`}
              loading={revenueSummaryLoading}
              accent="text-success"
            />
            <StatCard
              icon={UserPlus}
              label="New Subscriptions"
              value={revenueSummaryLoading ? 0 : revenueSummary?.newSubscriptionsInPeriod ?? 0}
              sublabel="Created within the selected range"
              loading={revenueSummaryLoading}
              accent="text-info"
            />
          </motion.section>
        )}

        {revenueSummary && !revenueSummaryLoading && (
          <p className="-mt-4 text-xs text-base-content/45">
            <Receipt className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
            Period: {formatDate(revenueSummary.period?.start)} – {formatDate(revenueSummary.period?.end)}
          </p>
        )}

        {/* ── Charts ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            className="card p-6 xl:col-span-3"
          >
            <SectionHeading icon={TrendingUp} title="Revenue by Plan" subtitle="Collected payments, selected period" />
            {revenueByPlanError ? (
              <ErrorState message={revenueByPlanError} onRetry={loadRevenue} />
            ) : revenueByPlanLoading ? (
              <div className="skeleton h-72 w-full" />
            ) : revenueBarData.length === 0 ? (
              <EmptyState label="No revenue recorded for this period" />
            ) : (
              <ResponsiveContainer width="100%" height={288}>
                <BarChart data={revenueBarData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={themeColors['--chart-1']} strokeOpacity={0.12} vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fontSize: 12, fill: themeColors['--base-content'] }}
                    axisLine={{ stroke: themeColors['--base-content'], strokeOpacity: 0.15 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: themeColors['--base-content'] }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                  />
                  <Tooltip cursor={{ fill: themeColors['--chart-1'], fillOpacity: 0.06 }} content={<ChartTooltip />} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {revenueBarData.map((entry, index) => (
                      <Cell key={entry.planId ?? index} fill={barPalette[index % barPalette.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            className="card p-6 xl:col-span-2"
          >
            <SectionHeading icon={Users} title="Subscriber Status" subtitle="All-time, every status" />
            {statusChartData.length === 0 ? (
              <EmptyState label="No subscribers yet" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusChartData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} strokeWidth={0}>
                      {statusChartData.map((entry) => (
                        <Cell key={entry.name} fill={statusColorFor(entry.name)} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip valueFormatter={formatNumber} />} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                  {statusChartData.map((entry) => (
                    <li key={entry.name} className="flex items-center gap-2 text-xs">
                      <span className={`status-dot status-dot-${(STATUS_BADGE[entry.name] ?? '').replace('badge-', '') || 'info'}`} />
                      <span className="text-base-content/70">{entry.name}</span>
                      <span className="ml-auto font-semibold text-base-content">{formatNumber(entry.value)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </motion.div>
        </div>

        {/* ── Roster ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          className="card overflow-hidden"
        >
          <div className="flex flex-col gap-4 border-b border-base-300 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1 rounded-lg bg-base-200 p-1">
              {[
                { key: 'subscribers', label: 'All Subscribers' },
                { key: 'active', label: 'Currently Active' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'subscribers' && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-base-content/40" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or email…"
                    className="input-field w-56 pl-9"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-auto">
                  <option value="">All statuses</option>
                  {Object.keys(STATUS_BADGE).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select value={planTypeFilter} onChange={(e) => setPlanTypeFilter(e.target.value)} className="input-field w-auto">
                  <option value="">All plan types</option>
                  <option value="fixed">Fixed</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'subscribers' ? (
                <motion.table
                  key="subscribers"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="table"
                >
                  <thead>
                    <tr>
                      <th>Subscriber</th>
                      <th>Plan</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Expires</th>
                      <th>Auto-renew</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribersLoading ? (
                      <TableSkeletonRows columns={7} />
                    ) : subscribersError ? (
                      <tr>
                        <td colSpan={7}>
                          <ErrorState message={subscribersError} onRetry={loadRoster} />
                        </td>
                      </tr>
                    ) : subscribers.length === 0 ? (
                      <tr>
                        <td colSpan={7}>
                          <EmptyState label="No subscribers match these filters" />
                        </td>
                      </tr>
                    ) : (
                      subscribers.map((row) => (
                        <tr key={row._id}>
                          <td>
                            <p className="font-semibold text-base-content">{row.userName}</p>
                            <p className="text-xs text-base-content/50">{row.userEmail}</p>
                          </td>
                          <td>{row.planName}</td>
                          <td>
                            <PlanTypePill planType={row.planType} />
                          </td>
                          <td>
                            <StatusPill status={row.status} />
                          </td>
                          <td>{formatDate(row.expiryDate)}</td>
                          <td>
                            <span className={`badge badge-sm ${row.autoRenew ? 'badge-success' : 'badge-secondary'}`}>
                              {row.autoRenew ? 'On' : 'Off'}
                            </span>
                          </td>
                          <td>{formatDate(row.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </motion.table>
              ) : (
                <motion.table
                  key="active"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="table"
                >
                  <thead>
                    <tr>
                      <th>Subscriber</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th>Days left</th>
                      <th>Monthly value</th>
                      <th>Consultations used</th>
                      <th>Rides used</th>
                      <th>Lab tests used</th>
                      <th>CA visits used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeSubscriptionsLoading ? (
                      <TableSkeletonRows columns={9} />
                    ) : activeSubscriptionsError ? (
                      <tr>
                        <td colSpan={9}>
                          <ErrorState message={activeSubscriptionsError} onRetry={loadRoster} />
                        </td>
                      </tr>
                    ) : activeSubscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={9}>
                          <EmptyState label="No currently active subscriptions" />
                        </td>
                      </tr>
                    ) : (
                      activeSubscriptions.map((row) => (
                        <tr key={row._id}>
                          <td>
                            <p className="font-semibold text-base-content">{row.userName}</p>
                            <p className="text-xs text-base-content/50">{row.userEmail}</p>
                          </td>
                          <td>
                            {row.planName}
                            <span className="ml-2">
                              <PlanTypePill planType={row.planType} />
                            </span>
                          </td>
                          <td>
                            <StatusPill status={row.status} />
                          </td>
                          <td>
                            <span className={row.daysRemaining <= 5 ? 'font-semibold text-error' : 'text-base-content'}>
                              {row.daysRemaining}
                            </span>
                          </td>
                          <td>{formatCurrency(row.monthlyValue)}</td>
                          <td>{formatNumber(row.usage?.consultationsUsed)}</td>
                          <td>{formatNumber(row.usage?.transportRidesUsed)}</td>
                          <td>{formatNumber(row.usage?.labTestsUsed)}</td>
                          <td>{formatNumber(row.usage?.careAssistantVisitsUsed)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </motion.table>
              )}
            </AnimatePresence>
          </div>

          <Pagination
            pagination={activeTab === 'subscribers' ? subscribersPagination : activeSubscriptionsPagination}
            onPageChange={setPage}
          />
        </motion.div>
      </div>
    </div>
  );
}