'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Calendar, ClipboardList, Search, Filter, 
  ChevronDown, ChevronRight, Eye, CheckCircle2, XCircle, 
  Clock, AlertTriangle, TrendingUp, RefreshCcw, X, 
  BarChart2, PieChart as PieIcon, Layers
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

import {
  fetchOPRecords,
  fetchOPRecordById,
  updateOPStatus,
  selectOPRecords,
  selectOPRecordsTotal,
  selectSelectedOP,
  selectClinicalLoading,
  clearSelectedOP,
} from '@/store/slices/clinicalSlice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  scheduled:   { label: 'Scheduled',   color: 'info',    icon: Clock },
  in_progress: { label: 'In Progress', color: 'warning', icon: Activity },
  completed:   { label: 'Completed',   color: 'success', icon: CheckCircle2 },
  cancelled:   { label: 'Cancelled',   color: 'error',   icon: XCircle },
  no_show:     { label: 'No Show',     color: 'error',   icon: AlertTriangle },
};

const RX_STATUS_META = {
  issued:    { label: 'Issued',    color: 'success' },
  dispensed: { label: 'Dispensed', color: 'info' },
  expired:   { label: 'Expired',   color: 'error' },
  cancelled: { label: 'Cancelled', color: 'error' },
  draft:     { label: 'Draft',     color: 'warning' },
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';
const fmtDateTime = (d) => d ? `${fmtDate(d)}, ${fmtTime(d)}` : '—';

const CHART_COLORS = ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--success)', 'var(--warning)'];

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status, meta = STATUS_META }) => {
  const m = meta[status] || { label: status, color: 'info' };
  return (
    <span className={`badge badge-${m.color} badge-sm whitespace-nowrap`}>
      {m.label}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, trend, color = 'primary', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    className="stat-card group cursor-default"
  >
    <div className="flex items-start justify-between mb-3">
      <div className={`p-2.5 rounded-xl bg-${color}/10 group-hover:bg-${color}/20 transition-colors duration-200`}>
        <Icon size={18} className={`text-${color}`} />
      </div>
      {trend !== undefined && (
        <span className={`flex items-center gap-0.5 text-xs font-bold ${trend >= 0 ? 'text-success' : 'text-error'}`}>
          {trend >= 0 ? <Activity size={12} /> : <Activity size={12} />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className="stat-card-value">{value}</div>
    <div className="stat-card-label">{label}</div>
    {sub && <p className="text-xs text-base-content/40 mt-1">{sub}</p>}
  </motion.div>
);

const SectionHeader = ({ icon: Icon, title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-primary/10">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <h3 className="font-montserrat font-extrabold text-base-content text-lg">{title}</h3>
        {subtitle && <p className="text-xs text-base-content/50">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const EmptyState = ({ icon: Icon, msg }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <div className="p-4 rounded-full bg-base-200">
      <Icon size={28} className="text-base-content/30" />
    </div>
    <p className="text-sm text-base-content/40 font-medium">{msg}</p>
  </div>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-16">
    <span className="loading loading-md" />
  </div>
);

// ─── OP Detail Drawer ─────────────────────────────────────────────────────────

const OPDetailDrawer = ({ op, onClose, onStatusChange, loading }) => {
  const [newStatus, setNewStatus] = useState('');
  const [reason, setReason] = useState('');
  const [showStatusForm, setShowStatusForm] = useState(false);

  if (!op) return null;

  const handleStatusSubmit = () => {
    if (!newStatus) return;
    onStatusChange({ id: op._id, status: newStatus, reason });
    setShowStatusForm(false);
    setNewStatus('');
    setReason('');
  };

const ALLOWED_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];

  // Wrap the drawer in a constant to pass it to the portal
  const drawerContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex"
    >
      {/* Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 bg-base-content/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-xl bg-base-100 shadow-depth-lg flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200">
          <div>
            <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wider">OP Record</p>
            <h2 className="font-montserrat font-extrabold text-base-content text-lg">{op.opNumber}</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={op.status} />
            <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="p-6 space-y-6">

            {/* Patient + Doctor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4">
                <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-2">Patient</p>
                <p className="font-bold text-base-content">{op.patientName || op.patient?.name || '—'}</p>
                {op.patient?.phone && <p className="text-sm text-base-content/60">{op.patient.phone}</p>}
              </div>
              <div className="card p-4">
                <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-2">Consultation</p>
                <p className="font-bold text-base-content capitalize">{op.consultationType?.replace('_', ' ') || '—'}</p>
                <p className="text-sm text-base-content/60">{fmtDate(op.scheduledAt)}</p>
              </div>
            </div>

            {/* Timeline */}
            <div className="card p-4">
              <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-3">Timeline</p>
              <div className="space-y-2">
                {[
                  ['Scheduled', op.scheduledAt],
                  ['Started', op.startedAt],
                  ['Completed', op.completedAt],
                ].map(([lbl, dt]) => (
                  <div key={lbl} className="flex items-center justify-between text-sm">
                    <span className="text-base-content/60">{lbl}</span>
                    <span className={`font-semibold ${dt ? 'text-base-content' : 'text-base-content/30'}`}>
                      {dt ? fmtDateTime(dt) : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing */}
            <div className="card p-4">
              <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-3">Billing</p>
              <div className="flex items-center justify-between">
                <span className="text-sm text-base-content/60">Consultation Fee</span>
                <span className="font-bold text-primary text-lg">₹{op.consultationFee ?? 0}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-base-content/60">Fee Source</span>
                <span className="badge badge-secondary badge-sm">{op.feeSource ?? '—'}</span>
              </div>
              {op.isCoveredBySubscription && (
                <div className="mt-2 alert alert-success py-2 text-xs">
                  Covered by subscription
                </div>
              )}
            </div>

            {/* Follow-up */}
            {op.followUpExpiry && (
              <div className="card p-4 border border-accent/30">
                <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-2">Follow-up Eligibility</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-base-content/60">Expiry</span>
                  <span className={`font-semibold ${new Date() < new Date(op.followUpExpiry) ? 'text-success' : 'text-error'}`}>
                    {fmtDate(op.followUpExpiry)}
                  </span>
                </div>
                {op.followUpFee !== undefined && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-base-content/60">Follow-up Fee</span>
                    <span className="font-semibold">₹{op.followUpFee}</span>
                  </div>
                )}
              </div>
            )}

            {/* Clinical Notes */}
            {(op.reasonForVisit || op.doctorNotes || op.diagnosisCode) && (
              <div className="card p-4">
                <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-3">Clinical Notes</p>
                {op.reasonForVisit && (
                  <div className="mb-2">
                    <p className="text-xs text-base-content/50 mb-1">Reason for Visit</p>
                    <p className="text-sm text-base-content">{op.reasonForVisit}</p>
                  </div>
                )}
                {op.diagnosisCode && (
                  <div className="mb-2 flex items-center gap-2">
                    <p className="text-xs text-base-content/50">ICD-10</p>
                    <span className="badge badge-info badge-sm">{op.diagnosisCode}</span>
                  </div>
                )}
                {op.doctorNotes && (
                  <div>
                    <p className="text-xs text-base-content/50 mb-1">Doctor Notes</p>
                    <p className="text-sm text-base-content bg-base-200 rounded-lg p-3 whitespace-pre-wrap">{op.doctorNotes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Linked Prescriptions */}
            {op.prescriptions?.length > 0 && (
              <div className="card p-4">
                <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-3">
                  Prescriptions ({op.prescriptions.length})
                </p>
                <div className="space-y-2">
                  {op.prescriptions.map((rx) => (
                    <div key={rx._id} className="flex items-center justify-between p-3 rounded-xl bg-base-200">
                      <div>
                        <p className="text-sm font-bold text-base-content">{rx.rxNumber}</p>
                        <p className="text-xs text-base-content/50">{fmtDate(rx.issuedAt)} · {rx.medicines?.length ?? 0} meds</p>
                      </div>
                      <StatusBadge status={rx.status} meta={RX_STATUS_META} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Override */}
            <div className="card p-4">
              <button
                onClick={() => setShowStatusForm((v) => !v)}
                className="flex items-center justify-between w-full text-sm font-semibold text-base-content"
              >
                <span>Update Status</span>
                <ChevronDown size={16} className={`transition-transform ${showStatusForm ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {showStatusForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-3">
                      <select
                        className="input-field text-sm"
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                      >
                        <option value="">Select status…</option>
                        {ALLOWED_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                        ))}
                      </select>
                      <textarea
                        className="input-field text-sm resize-none"
                        rows={2}
                        placeholder="Reason (optional)"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <button
                        onClick={handleStatusSubmit}
                        disabled={!newStatus || loading}
                        className="btn btn-primary btn-sm w-full"
                      >
                        {loading ? <span className="loading loading-xs" /> : 'Apply'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
</div>

          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  // Render outside the dashboard's DOM hierarchy to prevent layout clipping
  if (typeof document !== "undefined") {
    return createPortal(drawerContent, document.body);
  }
  
  return null;
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OPsManagement() {
  const dispatch = useDispatch();

  // Redux state
  const opRecords       = useSelector(selectOPRecords);
  const opTotal         = useSelector(selectOPRecordsTotal);
  const selectedOP      = useSelector(selectSelectedOP);

  const opLoading  = useSelector(selectClinicalLoading('fetchOPRecords'));
  const opxLoading = useSelector(selectClinicalLoading('fetchOPRecordById'));
  const updLoading = useSelector(selectClinicalLoading('updateOPStatus'));

  // Local UI state
  const [opPage, setOpPage]               = useState(1);
  const [opStatus, setOpStatus]           = useState('');
  const [search, setSearch]               = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');
  const [showFilters, setShowFilters]     = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [chartView, setChartView]         = useState('area');

  const LIMIT = 10;

  // Fetch OPs
  useEffect(() => {
    const params = { page: opPage, limit: LIMIT };
    if (opStatus) params.status = opStatus;
    if (dateFrom) params.from   = dateFrom;
    if (dateTo)   params.to     = dateTo;
    dispatch(fetchOPRecords(params));
  }, [dispatch, opPage, opStatus, dateFrom, dateTo]);

  const handleViewOP = useCallback((id) => {
    dispatch(fetchOPRecordById(id));
    setDrawerOpen(true);
  }, [dispatch]);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    dispatch(clearSelectedOP());
  }, [dispatch]);

  const handleStatusChange = useCallback((args) => {
    dispatch(updateOPStatus(args));
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchOPRecords({ page: opPage, limit: LIMIT, status: opStatus }));
  };

  // ── Stats derived from loaded data ──────────────────────────────────────────
  const stats = useMemo(() => {
    const byStatus = (arr, s) => arr.filter((r) => r.status === s).length;
    return {
      totalOPs:    opTotal,
      completedOPs: byStatus(opRecords, 'completed'),
      scheduledOPs: byStatus(opRecords, 'scheduled'),
      inProgressOPs: byStatus(opRecords, 'in_progress'),
      revenue:     opRecords.reduce((s, r) => s + (r.consultationFee ?? 0), 0),
    };
  }, [opRecords, opTotal]);

  // ── Chart data ───────────────────────────────────────────────────────────────
  const opStatusPieData = useMemo(() => {
    const counts = {};
    opRecords.forEach((r) => { counts[r.status] = (counts[r.status] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({
      name: STATUS_META[name]?.label ?? name, value,
    }));
  }, [opRecords]);

  // Build a daily OP trend for area chart (last 7 days from loaded data)
  const trendData = useMemo(() => {
    const days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      days[key] = { date: key, OPs: 0 };
    }
    opRecords.forEach((r) => {
      const key = new Date(r.scheduledAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (days[key]) days[key].OPs++;
    });
    return Object.values(days);
  }, [opRecords]);

  // Filter by search (client-side on name)
  const filteredOPs = useMemo(() => {
    if (!search) return opRecords;
    const q = search.toLowerCase();
    return opRecords.filter(
      (r) =>
        r.patientName?.toLowerCase().includes(q) ||
        r.opNumber?.toLowerCase().includes(q) ||
        r.patient?.name?.toLowerCase().includes(q)
    );
  }, [opRecords, search]);

  const opTotalPages = Math.ceil(opTotal / LIMIT);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100 font-inter" data-theme="hospital">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-base-300 bg-base-100 sticky top-0 z-50 backdrop-blur-strong">
        <div className="container-custom py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10">
                <Layers size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="font-montserrat font-black text-xl text-base-content tracking-tight">
                  OPs Management
                </h1>
                <p className="text-xs text-base-content/50">Out-patient records analysis & track</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                <input
                  type="text"
                  placeholder="Search patient / OP no…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-8 pr-3 py-2 text-sm w-52"
                />
              </div>

              {/* Filter toggle */}
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-outline'} gap-1.5`}
              >
                <Filter size={13} />
                Filters
                {showFilters && <span className="badge badge-primary badge-xs">on</span>}
              </button>

              {/* Refresh */}
              <button onClick={handleRefresh} className="btn btn-ghost btn-circle btn-sm" title="Refresh">
                <RefreshCcw size={15} />
              </button>
            </div>
          </div>

          {/* Filter row */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap gap-3 pt-4 pb-1">
                  <select
                    className="input-field text-sm w-36"
                    value={opStatus}
                    onChange={(e) => { setOpStatus(e.target.value); setOpPage(1); }}
                  >
                    <option value="">All OP Status</option>
                    {Object.entries(STATUS_META).map(([v, m]) => (
                      <option key={v} value={v}>{m.label}</option>
                    ))}
                  </select>
                  <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                    className="input-field text-sm w-36" placeholder="From" />
                  <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                    className="input-field text-sm w-36" placeholder="To" />
                  <button
                    onClick={() => { setOpStatus(''); setDateFrom(''); setDateTo(''); setSearch(''); }}
                    className="btn btn-ghost btn-sm text-error"
                  >
                    Clear
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="container-custom py-6 space-y-6">

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
          <div className="col-span-2">
            <StatCard icon={ClipboardList} label="Total OPs"      value={stats.totalOPs}     trend={4}   delay={0}    />
          </div>
          <div className="col-span-2">
            <StatCard icon={CheckCircle2} label="Completed"       value={stats.completedOPs}  trend={2}   delay={0.05} color="success" />
          </div>
          <div className="col-span-2">
            <StatCard icon={Clock}        label="Scheduled"        value={stats.scheduledOPs}  delay={0.10} color="info" />
          </div>
          <div className="col-span-2">
            <StatCard icon={Activity}     label="In Progress"      value={stats.inProgressOPs} delay={0.15} color="warning" />
          </div>
          <div className="col-span-4 md:col-span-8 xl:col-span-8">
            <StatCard icon={TrendingUp}   label="Revenue (loaded)" value={`₹${stats.revenue.toLocaleString('en-IN')}`} delay={0.20} color="primary" />
          </div>
        </div>

        {/* ── Charts Row ──────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          {/* Trend chart */}
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-primary" />
                <h3 className="font-montserrat font-extrabold text-base-content text-sm">Activity Trend (7 days)</h3>
              </div>
              <div className="flex gap-1">
                {['area', 'bar'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setChartView(v)}
                    className={`btn btn-xs ${chartView === v ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              {chartView === 'area' ? (
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="opGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--primary)"   stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)"   stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="OPs" stroke="var(--primary)" fill="url(#opGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              ) : (
                <BarChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} />
                  <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="OPs" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Pie chart */}
          <div className="card p-5 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-3">
              <PieIcon size={14} className="text-primary" />
              <h3 className="font-montserrat font-extrabold text-base-content text-xs">OP Status Distribution</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={opStatusPieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3}>
                  {opStatusPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Dynamic Table Container ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card overflow-hidden"
        >
          <div className="p-5">
            <SectionHeader
              icon={ClipboardList}
              title="Out-Patient Records"
              subtitle={`${opTotal} total records`}
            />
          </div>

          {opLoading ? (
            <Spinner />
          ) : filteredOPs.length === 0 ? (
            <EmptyState icon={ClipboardList} msg="No OP records found" />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>OP Number</th>
                      <th>Patient</th>
                      <th>Type</th>
                      <th>Scheduled</th>
                      <th>Fee</th>
                      <th>Status</th>
                      <th>Follow-up</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOPs.map((op, idx) => (
                      <motion.tr
                        key={op._id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="group"
                      >
                        <td>
                          <span className="font-mono text-xs font-bold text-primary">{op.opNumber}</span>
                        </td>
                        <td>
                          <div>
                            <p className="font-semibold text-base-content text-sm">{op.patientName || op.patient?.name || '—'}</p>
                            {op.patient?.phone && <p className="text-xs text-base-content/50">{op.patient.phone}</p>}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-secondary badge-sm capitalize">
                            {op.consultationType?.replace('_', ' ') ?? '—'}
                          </span>
                        </td>
                        <td>
                          <div>
                            <p className="text-sm font-medium">{fmtDate(op.scheduledAt)}</p>
                            <p className="text-xs text-base-content/50">{fmtTime(op.scheduledAt)}</p>
                          </div>
                        </td>
                        <td>
                          <span className="font-bold text-primary">₹{op.consultationFee ?? 0}</span>
                        </td>
                        <td><StatusBadge status={op.status} /></td>
                        <td>
                          {op.followUpExpiry ? (
                            <span className={`text-xs font-semibold ${new Date() < new Date(op.followUpExpiry) ? 'text-success' : 'text-error'}`}>
                              {fmtDate(op.followUpExpiry)}
                            </span>
                          ) : <span className="text-xs text-base-content/30">—</span>}
                        </td>
                        <td>
                          <button
                            onClick={() => handleViewOP(op._id)}
                            className="btn btn-ghost btn-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-base-300">
                {filteredOPs.map((op, idx) => (
                  <motion.div
                    key={op._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary">{op.opNumber}</span>
                        <StatusBadge status={op.status} />
                      </div>
                      <p className="font-semibold text-base-content text-sm truncate">
                        {op.patientName || op.patient?.name || '—'}
                      </p>
                      <p className="text-xs text-base-content/50">{fmtDateTime(op.scheduledAt)}</p>
                      <p className="text-xs font-bold text-primary">₹{op.consultationFee ?? 0}</p>
                    </div>
                    <button onClick={() => handleViewOP(op._id)} className="btn btn-ghost btn-circle btn-sm">
                      <ChevronRight size={16} />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {opTotalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
                  <p className="text-xs text-base-content/50">
                    Page {opPage} of {opTotalPages} · {opTotal} records
                  </p>
                  <div className="flex gap-1">
                    <button
                      disabled={opPage === 1}
                      onClick={() => setOpPage((p) => p - 1)}
                      className="btn btn-ghost btn-sm"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.min(opTotalPages, 5) }, (_, i) => {
                      const pg = i + 1;
                      return (
                        <button
                          key={pg}
                          onClick={() => setOpPage(pg)}
                          className={`btn btn-sm ${opPage === pg ? 'btn-primary' : 'btn-ghost'}`}
                        >
                          {pg}
                        </button>
                      );
                    })}
                    <button
                      disabled={opPage === opTotalPages}
                      onClick={() => setOpPage((p) => p + 1)}
                      className="btn btn-ghost btn-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>

      </div>

      {/* ── OP Detail Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <OPDetailDrawer
            op={selectedOP}
            onClose={handleCloseDrawer}
            onStatusChange={handleStatusChange}
            loading={updLoading || opxLoading}
          />
        )}
      </AnimatePresence>

    </div>
  );
}