'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, TrendingUp, AlertTriangle, RefreshCw, Download, Search,
  ChevronLeft, ChevronRight, Eye, XCircle, CheckCircle2, Clock, Zap, X,
} from 'lucide-react';

// ── Redux — ONLY thunks/selectors that exist in subscriptionPlanSlice.js (§8) ──
import {
  fetchActiveSubscriptions,
  selectActiveSubscriptions,
  selectActiveSubscriptionsPagination,
  selectActiveSubscriptionsLoading,
  selectActiveSubscriptionsError,
  adminUpdateSubscription, // §7 — only mutator available for a subId
} from '../../../store/slices/subscriptionPlanSlice';

// ── Constants ─────────────────────────────────────────────────────────────
const PLAN_BADGE_CLASS = {
  'Basic Care':          'badge-info',
  'Standard Care':       'badge-secondary',
  'Premium Care':        'badge-primary',
  'Family Care':         'badge-warning',
  'Pregnant Women Care': 'badge-accent',
  "NRI's Care":          'badge-success',
};
const getPlanBadgeClass = (name) => PLAN_BADGE_CLASS[name] ?? 'bg-base-200 text-base-content/70 border border-base-300';

const STATUS_MAP = {
  Active:    { icon: CheckCircle2,  label: 'Active',    cls: 'badge-success' },
  Trial:     { icon: Clock,         label: 'Trial',     cls: 'badge-warning' },
  Cancelled: { icon: XCircle,       label: 'Cancelled', cls: 'badge-error'   },
  Expired:   { icon: AlertTriangle, label: 'Expired',   cls: 'bg-base-200 text-base-content/60 border border-base-300' },
};

const PER_PAGE = 10;

// ── Helpers ──────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();

const daysLeft = (dateStr) => {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - Date.now()) / 86_400_000);
};

const fmtDate = (dateStr) =>
  !dateStr ? '—' : new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

const AVATAR_HUES = ['bg-primary/10 text-primary', 'bg-secondary/10 text-secondary', 'bg-accent/10 text-accent', 'bg-success/10 text-success'];
const avatarClass = (name = '') => AVATAR_HUES[name.charCodeAt(0) % AVATAR_HUES.length];

// ── Sub-components ──────────────────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, accent, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="stat-card"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-${accent}/10 text-${accent}`}>
        <Icon size={18} />
      </div>
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value">{value}</p>
    </motion.div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_MAP[status] ?? STATUS_MAP.Active;
  const Icon = meta.icon;
  return (
    <span className={`badge badge-xs ${meta.cls}`}>
      <Icon size={11} />
      {meta.label}
    </span>
  );
}

function PlanBadge({ name }) {
  return <span className={`badge badge-xs ${getPlanBadgeClass(name)}`}>{name ?? 'Unknown'}</span>;
}

function ExpiryCell({ dateStr, calculatedDays }) {
  const d = calculatedDays ?? daysLeft(dateStr);
  if (d === null) return <span className="text-base-content/40 text-xs">—</span>;
  const urgent = d <= 7;
  const warn = d <= 14;
  return (
    <span className={`font-mono text-xs ${urgent ? 'text-error font-bold' : warn ? 'text-warning font-semibold' : 'text-base-content/70'}`}>
      {fmtDate(dateStr)}
      {urgent && <span className="opacity-75"> · {d}d left</span>}
    </span>
  );
}

function UsageBar({ pct }) {
  const safe = Math.min(100, Math.max(0, pct ?? 0));
  const color = safe > 80 ? 'bg-error' : safe > 55 ? 'bg-warning' : 'bg-success';
  return (
    <div className="flex items-center gap-2">
      <div className="progress-bar w-16 h-1.5">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${safe}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
        />
      </div>
      <span className="text-xs font-mono font-semibold min-w-[28px] text-base-content/70">{safe}%</span>
    </div>
  );
}

function SubDetailDrawer({ sub, onClose, onUpdate }) {
  const dispatch = useDispatch();
  const [saving, setSaving] = useState(false);
  if (!sub) return null;

  const handleCancel = async () => {
    setSaving(true);
    await dispatch(adminUpdateSubscription({ subId: sub._id, status: 'Cancelled' }));
    setSaving(false);
    onUpdate();
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="fixed top-0 right-0 bottom-0 w-full sm:w-96 bg-base-100 border-l border-base-300 z-50 flex flex-col"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <h2 className="text-base font-bold">Subscription Detail</h2>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className={`avatar-circle w-12 h-12 rounded-full flex items-center justify-center font-bold ${avatarClass(sub.userName ?? '')}`}>
              {initials(sub.userName)}
            </div>
            <div>
              <p className="font-bold">{sub.userName ?? '—'}</p>
              <p className="text-xs font-mono text-base-content/50">{sub.userEmail ?? '—'}</p>
            </div>
          </div>

          <hr className="border-base-300 my-4" />

          <div className="flex flex-col gap-2.5">
            {[
              ['Plan',          <PlanBadge key="p" name={sub.planName} />],
              ['Status',        <StatusBadge key="s" status={sub.status} />],
              ['Expiry',        <ExpiryCell key="e" dateStr={sub.expiryDate} calculatedDays={sub.daysRemaining} />],
              ['Monthly Value', fmtINR(sub.monthlyValue)], // Updated from planMrr
              ['Sub ID',        <span key="id" className="font-mono text-[10px] text-base-content/60">{sub._id}</span>],
              ['Auto-renew',    sub.autoRenew ? '✓ Enabled' : '— Off'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-xs">
                <span className="text-base-content/50 font-medium">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>

          {sub.usage && (
            <>
              <hr className="border-base-300 my-4" />
              <p className="text-[11px] font-bold uppercase tracking-wide text-base-content/50 mb-2.5">Usage this month</p>
              {Object.entries(sub.usage).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between mb-2 text-xs">
                  <span className="text-base-content/50 font-medium">{k}</span>
                  <UsageBar pct={typeof v === 'number' ? v : 0} />
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-base-300">
          <button
            className="btn btn-error w-full"
            onClick={handleCancel}
            disabled={saving}
          >
            {saving ? 'Cancelling…' : 'Cancel Subscription'}
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────
export default function ActiveSubscriptionsPage() {
  const dispatch = useDispatch();
  const rawSubs    = useSelector(selectActiveSubscriptions);
  const pagination = useSelector(selectActiveSubscriptionsPagination);
  const loading    = useSelector(selectActiveSubscriptionsLoading);
  const error      = useSelector(selectActiveSubscriptionsError);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedSub, setSelectedSub] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (p = 1) => dispatch(fetchActiveSubscriptions({ page: p, limit: PER_PAGE })),
    [dispatch]
  );

  useEffect(() => { load(page); }, [load, page]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load(page);
    setRefreshing(false);
  };

  const displayed = useMemo(() => {
    let rows = rawSubs ?? [];
    if (filter !== 'all')
      rows = rows.filter((s) => (filter === 'expiring' ? (s.daysRemaining ?? daysLeft(s.expiryDate)) <= 10 : s.status === filter));
    if (search.trim())
      rows = rows.filter((s) =>
        [s.userName, s.userEmail, s.planName].some((f) => (f ?? '').toLowerCase().includes(search.toLowerCase()))
      );
    return rows;
  }, [rawSubs, filter, search]);

  const metrics = useMemo(() => {
    const all = rawSubs ?? [];
    return {
      total: all.length,
      active: all.filter((s) => s.status === 'Active').length,
      trial: all.filter((s) => s.status === 'Trial').length,
      expiring: all.filter((s) => (s.daysRemaining ?? daysLeft(s.expiryDate)) <= 10).length,
      mrr: all.reduce((a, s) => a + (s.monthlyValue ?? 0), 0), // Updated from planMrr
    };
  }, [rawSubs]);

  const planChartData = useMemo(() => {
    const map = {};
    (rawSubs ?? []).forEach((s) => {
      const name = s.planName ?? 'Unknown';
      map[name] = (map[name] ?? 0) + 1;
    });
    return Object.entries(map).map(([name, count]) => ({ name: name.replace(' Care', '').replace("NRI's", 'NRI'), count }));
  }, [rawSubs]);

  const mrrPieData = useMemo(() => {
    const map = {};
    (rawSubs ?? []).forEach((s) => {
      const name = s.planName ?? 'Unknown';
      map[name] = (map[name] ?? 0) + (s.monthlyValue ?? 0); // Updated from planMrr
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [rawSubs]);

  const exportCSV = () => {
    const header = 'Name,Email,Plan,Status,Expiry,Monthly Value';
    const rows = displayed.map(
      (s) => `"${s.userName}","${s.userEmail}","${s.planName}",${s.status},${s.expiryDate ?? ''},${s.monthlyValue ?? 0}` // Updated from planMrr
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'active_subscriptions.csv' });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

  return (
    <div className="min-h-screen bg-base-100 px-8 py-7">

      {/* Topbar */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Active Subscriptions</h1>
          <p className="text-xs font-mono text-base-content/50 mt-1">admin / subscriptions / active</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-success badge-sm">
            <span className="status-dot status-dot-success animate-pulse" /> Live
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportCSV}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <MetricCard icon={Users}         label="Total subscribers"    value={metrics.total}          accent="primary" delay={0} />
        <MetricCard icon={Zap}           label="On free trial"        value={metrics.trial}          accent="secondary" delay={0.05} />
        <MetricCard icon={AlertTriangle} label="Expiring ≤ 10 days"   value={metrics.expiring}       accent="warning" delay={0.1} />
        <MetricCard icon={TrendingUp}    label="Monthly Value"        value={fmtINR(metrics.mrr)}    accent="success" delay={0.15} />
      </div>

      {/* Charts */}
      {!loading && rawSubs?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-3 mb-4">
          <div className="card p-5">
            <p className="text-sm font-bold">Subscribers by plan</p>
            <p className="text-xs text-base-content/45 mb-3">Distribution across plan tiers</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={planChartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'var(--base-200)' }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {planChartData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <p className="text-sm font-bold">Value by plan</p>
            <p className="text-xs text-base-content/45 mb-3">Revenue breakdown</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={mrrPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={3}>
                  {mrrPieData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtINR(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-2 mt-2">
              {mrrPieData.map((e, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-base-content/60">
                  <span className="w-2 h-2 rounded-sm" style={{ background: chartColors[i % chartColors.length] }} />
                  {e.name.replace(' Care', '')}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card mb-4 overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3.5 border-b border-base-300">
          <span className="text-sm font-bold">
            Subscriber roster
            <span className="font-normal text-xs text-base-content/45 ml-2">{pagination?.total ?? rawSubs?.length ?? 0} total</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {['all', 'Active', 'Trial', 'expiring'].map((f) => (
                <button
                  key={f}
                  className={`btn btn-xs ${filter === f ? 'btn-primary' : 'btn-ghost border border-base-300'}`}
                  onClick={() => { setFilter(f); setPage(1); }}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 bg-base-200 border border-base-300 rounded-md px-2.5 py-1.5">
              <Search size={13} className="text-base-content/40 shrink-0" />
              <input
                className="bg-transparent outline-none text-xs w-40 placeholder:text-base-content/40"
                placeholder="Search name, email, plan…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <button onClick={() => setSearch('')}>
                  <X size={12} className="text-base-content/40" />
                </button>
              )}
            </div>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>User</th><th>Plan</th><th>Status</th><th>Expiry</th><th>Usage</th><th>Monthly Value</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {[140, 100, 80, 90, 90, 70, 90].map((w, j) => (
                  <td key={j}><div className="skeleton" style={{ width: w, height: 14 }} /></td>
                ))}
              </tr>
            ))}

            {!loading && error && (
              <tr><td colSpan={7}>
                <div className="alert alert-error m-4">
                  <AlertTriangle size={18} /><p className="text-sm">{error}</p>
                </div>
              </td></tr>
            )}

            {!loading && !error && displayed.length === 0 && (
              <tr><td colSpan={7}>
                <div className="text-center py-12 text-base-content/45">
                  <Users size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No subscriptions match your filters.</p>
                </div>
              </td></tr>
            )}

            {!loading && !error && displayed.map((sub, idx) => {
              const usagePct = sub.usage
                ? Math.round(Object.values(sub.usage).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0) / Math.max(1, Object.keys(sub.usage).length))
                : 0;
              return (
                <motion.tr
                  key={sub._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.03 }}
                  className="cursor-pointer"
                  onClick={() => setSelectedSub(sub)}
                >
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass(sub.userName ?? '')}`}>
                        {initials(sub.userName)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{sub.userName ?? '—'}</div>
                        <div className="text-[10px] font-mono text-base-content/50">{sub.userEmail ?? '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td><PlanBadge name={sub.planName} /></td>
                  <td><StatusBadge status={sub.status} /></td>
                  <td><ExpiryCell dateStr={sub.expiryDate} calculatedDays={sub.daysRemaining} /></td>
                  <td><UsageBar pct={usagePct} /></td>
                  <td><span className="font-mono text-xs font-semibold">{fmtINR(sub.monthlyValue)}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs btn-circle border border-base-300" title="View" onClick={() => setSelectedSub(sub)}>
                        <Eye size={13} />
                      </button>
                      <button className="btn btn-ghost btn-xs btn-circle border border-base-300 hover:!bg-error hover:!text-error-content" title="Cancel" onClick={() => setSelectedSub(sub)}>
                        <XCircle size={13} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>

        {!loading && displayed.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-base-300 text-xs text-base-content/50">
            <span>Page {page} of {pagination?.pages ?? 1} · {pagination?.total ?? displayed.length} total</span>
            <div className="flex gap-1">
              <button className="btn btn-ghost btn-xs btn-circle border border-base-300" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft size={13} />
              </button>
              {Array.from({ length: pagination?.pages ?? 1 }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === (pagination?.pages ?? 1) || Math.abs(p - page) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '…'
                    ? <span key={i} className="px-1 text-base-content/40">…</span>
                    : <button key={p} className={`btn btn-xs ${p === page ? 'btn-primary' : 'btn-ghost border border-base-300'}`} onClick={() => setPage(p)}>{p}</button>
                )}
              <button className="btn btn-ghost btn-xs btn-circle border border-base-300" onClick={() => setPage((p) => Math.min(pagination?.pages ?? 1, p + 1))} disabled={page >= (pagination?.pages ?? 1)}>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Plan summary footer */}
      {!loading && rawSubs?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {planChartData
            .slice()
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map((p, i) => {
              const max = planChartData[0]?.count ?? 1;
              return (
                <motion.div
                  key={p.name}
                  className="stat-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                >
                  <div className="stat-card-label">{p.name} Care</div>
                  <div className="stat-card-value !text-2xl">{p.count}</div>
                  <div className="progress-bar my-1.5">
                    <div className="progress-bar-fill" style={{ width: `${Math.round((p.count / max) * 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-base-content/55">
                    <span>{p.count} subscribers</span>
                    <span>{Math.round((p.count / (rawSubs?.length || 1)) * 100)}% share</span>
                  </div>
                </motion.div>
              );
            })}
        </div>
      )}

      <SubDetailDrawer sub={selectedSub} onClose={() => setSelectedSub(null)} onUpdate={() => load(page)} />
    </div>
  );
}