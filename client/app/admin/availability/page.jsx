'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi, WifiOff, Calendar, Clock, Building2,
  User, Search, Filter, RefreshCw, ChevronLeft,
  ChevronRight, AlertCircle, CheckCircle2, XCircle,
  MapPin, Phone, Star, Layers, Activity, ShieldCheck,
  Eye, ChevronDown, ChevronUp, X, Stethoscope,
  Hospital, Users, CircleDot, TrendingUp, BarChart2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, RadialBarChart, RadialBar,
} from 'recharts';

import {
  fetchAvailability,
  resetAvailability,
  selectAvailabilityLoading,
  selectAvailabilityError,
  selectAvailabilitySummary,
  selectAvailabilityDoctors,
  selectAvailabilityHospitals,
  selectHospitalStats,
} from '@/store/slices/adminAnalyticsSlice';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt  = (n, d = 0) => n == null ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: d });
const pct  = (a, b)     => b ? +((a / b) * 100).toFixed(1) : 0;

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TODAY = DAYS[new Date().getDay()];

const CHART_COLORS = [
  'var(--primary)', 'var(--secondary)', 'var(--accent)',
  'var(--success)', 'var(--warning)', 'var(--info)',
  'oklch(55% 0.24 285)', 'oklch(48% 0.24 18)',
];

const PARTNER_COLOR = {
  active:   'success',
  pending:  'warning',
  inactive: 'error',
  suspended:'error',
};

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs shadow-xl border border-primary/20 min-w-32">
      <p className="font-bold mb-1.5 text-base-content">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill ?? p.color }} />
          <span style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>{p.name}:</span>
          <span className="font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, icon: Icon, color = 'primary', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4 }}
    className="stat-card group relative overflow-hidden"
  >
    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      style={{ background: `radial-gradient(ellipse at 75% 25%, color-mix(in srgb, var(--${color}), transparent 90%), transparent 70%)` }} />
    <div className="relative z-10 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <p className="stat-card-label truncate">{label}</p>
        <p className="stat-card-value mt-1" style={{ color: `var(--${color})` }}>{value}</p>
        {sub && <p className="text-xs mt-1 text-base-content/40">{sub}</p>}
      </div>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
        style={{ background: `color-mix(in srgb, var(--${color}), transparent 87%)` }}>
        <Icon size={18} style={{ color: `var(--${color})` }} />
      </div>
    </div>
  </motion.div>
);

// ─── Online Pulse ─────────────────────────────────────────────────────────────

const OnlinePulse = ({ online }) => (
  <span className="relative inline-flex items-center">
    {online && (
      <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
        style={{ background: 'var(--success)' }} />
    )}
    <span className="relative inline-flex rounded-full w-2 h-2"
      style={{ background: online ? 'var(--success)' : 'color-mix(in srgb, var(--base-content), transparent 70%)' }} />
  </span>
);

// ─── Day Slots Mini Grid ──────────────────────────────────────────────────────

const DaySlotsGrid = ({ weeklyAvailability }) => {
  if (!weeklyAvailability?.length) return <span className="text-xs text-base-content/30">No schedule</span>;
  return (
    <div className="flex gap-1">
      {DAYS.map(day => {
        const found = weeklyAvailability.find(d => d.day === day);
        const active = found?.isAvailable && found?.slots?.some(s => s.isActive);
        return (
          <div key={day}
            title={`${day}: ${active ? 'available' : 'off'}`}
            className="w-4 h-4 rounded-sm text-[8px] font-bold flex items-center justify-center"
            style={{
              background: active ? 'color-mix(in srgb, var(--success), transparent 78%)' : 'var(--base-300)',
              color: active ? 'var(--success)' : 'color-mix(in oklch, var(--base-content) 30%, transparent)',
              border: day === TODAY ? '1px solid var(--primary)' : 'none',
            }}>
            {day[0]}
          </div>
        );
      })}
    </div>
  );
};

// ─── Doctor Detail Drawer ─────────────────────────────────────────────────────

const DoctorDrawer = ({ doc, onClose }) => {
  if (!doc) return null;
  const todayAvail = doc.weeklyAvailability?.find(d => d.day === TODAY);
  const activeSlots = todayAvail?.slots?.filter(s => s.isActive) ?? [];

  const Row = ({ label, value }) => (
    <div className="flex justify-between items-start gap-2 py-1.5 border-b border-base-300/50 last:border-0">
      <span className="text-xs font-medium text-base-content/50 flex-shrink-0 w-32">{label}</span>
      <span className="text-xs font-semibold text-right break-words">{value ?? '—'}</span>
    </div>
  );

  const Section = ({ title, children }) => (
    <div className="mb-5">
      <h4 className="text-xs font-bold uppercase tracking-widest mb-3 pb-1.5 border-b border-base-300"
        style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
        {title}
      </h4>
      {children}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="ml-auto relative w-full max-w-md h-full flex flex-col"
        style={{ background: 'var(--base-100)', borderLeft: '1px solid var(--base-300)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
              style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)', color: 'var(--primary)' }}>
              {(doc.user?.name ?? 'D')[0].toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-sm">{doc.user?.name ?? '—'}</p>
              <p className="text-xs text-base-content/40">{doc.specialization}</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2 mb-5">
            <span className={`badge badge-${doc.isOnline ? 'success' : 'error'} gap-1`} style={{ fontSize: '0.65rem' }}>
              <OnlinePulse online={doc.isOnline} />
              {doc.isOnline ? 'Online Now' : 'Offline'}
            </span>
            {doc.isVerified && <span className="badge badge-success badge-xs gap-1"><ShieldCheck size={9} />Verified</span>}
            <span className="badge badge-primary badge-xs">{doc.partnershipStatus ?? 'unknown'}</span>
          </div>

          <Section title="Today's Availability">
            {todayAvail?.isAvailable ? (
              <div>
                <p className="text-xs font-semibold text-success mb-2">
                  Available — {activeSlots.length} active slot{activeSlots.length !== 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {activeSlots.map((slot, i) => (
                    <div key={i} className="text-xs font-medium px-2 py-1 rounded text-center"
                      style={{ background: 'color-mix(in srgb, var(--success), transparent 87%)', color: 'var(--success)' }}>
                      {slot.startTime} – {slot.endTime}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-base-content/40">Not available today ({TODAY})</p>
            )}
          </Section>

          <Section title="Weekly Schedule">
            <div className="space-y-1.5">
              {DAYS.map(day => {
                const avail = doc.weeklyAvailability?.find(d => d.day === day);
                const slots = avail?.slots?.filter(s => s.isActive) ?? [];
                return (
                  <div key={day} className="flex items-center gap-2 py-0.5">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{
                        background: avail?.isAvailable && slots.length
                          ? 'var(--success)'
                          : 'var(--base-300)',
                      }} />
                    <span className={`text-xs w-20 font-medium ${day === TODAY ? 'font-bold' : ''}`}
                      style={{ color: day === TODAY ? 'var(--primary)' : undefined }}>
                      {day}{day === TODAY ? ' (today)' : ''}
                    </span>
                    <span className="text-xs text-base-content/50">
                      {avail?.isAvailable && slots.length
                        ? `${slots.length} slot${slots.length !== 1 ? 's' : ''}`
                        : 'Off'}
                    </span>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Profile">
            <Row label="Email"      value={doc.user?.email} />
            <Row label="Phone"      value={doc.user?.phone} />
            <Row label="Hospital"   value={doc.primaryHospital?.name} />
            <Row label="Hosp Type"  value={doc.primaryHospital?.hospitalType} />
            <Row 
  label="Consult Types" 
  value={
    Array.isArray(doc.consultationTypes) 
      ? doc.consultationTypes.join(', ') 
      : typeof doc.consultationTypes === 'string'
        ? doc.consultationTypes
        : '—'
  } 
/>
            <Row label="In-Person"  value={doc.fees?.inPersonFee ? `₹${doc.fees.inPersonFee}` : null} />
            <Row label="Video"      value={doc.fees?.videoFee    ? `₹${doc.fees.videoFee}` : null} />
            <Row label="Home Visit" value={doc.fees?.homeVisitFee? `₹${doc.fees.homeVisitFee}` : null} />
          </Section>

          <Section title="Stats">
            <Row label="Rating"           value={doc.rating?.averageRating != null ? `${doc.rating.averageRating.toFixed(2)} ★` : null} />
            <Row label="Profile Complete" value={doc.profileCompletionPercent != null ? `${doc.profileCompletionPercent}%` : null} />
          </Section>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AvailabilityPage() {
  const dispatch  = useDispatch();
  const loading   = useSelector(selectAvailabilityLoading);
  const error     = useSelector(selectAvailabilityError);
  const summary   = useSelector(selectAvailabilitySummary);
  const doctorsObj= useSelector(selectAvailabilityDoctors);
  const hospitals = useSelector(selectAvailabilityHospitals);
  const hospStats = useSelector(selectHospitalStats);

  const [page, setPage]           = useState(1);
  const [hospitalId, setHospitalId] = useState('');
  const [search, setSearch]       = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('doctors'); // doctors | hospitals | charts
  const [drawerDoc, setDrawerDoc] = useState(null);
  const [onlineOnly, setOnlineOnly] = useState(false);

  const load = useCallback(() => {
    const params = { page };
    if (hospitalId) params.hospitalId = hospitalId;
    dispatch(fetchAvailability(params));
  }, [page, hospitalId, dispatch]);

  useEffect(() => { load(); return () => dispatch(resetAvailability()); }, [load]);

  const doctors    = doctorsObj?.data ?? [];
  const pagination = doctorsObj?.pagination ?? {};

  const filtered = doctors.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      d.user?.name?.toLowerCase().includes(q) ||
      d.specialization?.toLowerCase().includes(q) ||
      d.primaryHospital?.name?.toLowerCase().includes(q);
    const matchOnline = !onlineOnly || d.isOnline;
    return matchSearch && matchOnline;
  });

  // Chart data
  const statusChartData = [
    { name: 'Online Now',    value: summary?.onlineNow  ?? 0, fill: 'var(--success)' },
    { name: 'With Slots',    value: summary?.withSlots   ?? 0, fill: 'var(--primary)' },
    { name: 'Without Slots', value: summary?.withoutSlots?? 0, fill: 'var(--error)' },
    { name: 'Total Active',  value: summary?.totalActive ?? 0, fill: 'var(--info)' },
  ];

  const hospTypeData = (hospStats ?? []).reduce((acc, h) => {
    const existing = acc.find(a => a.name === h.hospitalType);
    if (existing) existing.count++;
    else acc.push({ name: h.hospitalType ?? 'Other', count: 1, doctors: h.doctorCount });
    return acc;
  }, []);

 const doctorCountData = [...(hospStats ?? [])] //  Creates a mutable copy
  .sort((a, b) => (b.doctorCount ?? 0) - (a.doctorCount ?? 0))
  .slice(0, 10)
  .map(h => ({ name: h.name?.slice(0, 16) ?? '—', doctors: h.doctorCount ?? 0 }));

  const radialData = [
    { name: 'Online', value: pct(summary?.onlineNow, summary?.totalActive), fill: 'var(--success)' },
    { name: 'With Slots', value: pct(summary?.withSlots, summary?.totalActive), fill: 'var(--primary)' },
  ];

  const TabBtn = ({ id, label, Icon }) => (
    <button onClick={() => setActiveTab(id)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
        activeTab === id ? 'text-primary-content' : 'text-base-content/50 hover:text-base-content'
      }`}
      style={activeTab === id ? { background: 'var(--primary)' } : {}}>
      <Icon size={12} />{label}
    </button>
  );

  return (
    <div data-theme='admin' className="min-h-screen" style={{ background: 'var(--base-200)' }}>
      <AnimatePresence>
        {drawerDoc && <DoctorDrawer doc={drawerDoc} onClose={() => setDrawerDoc(null)} />}
      </AnimatePresence>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="section-heading !mb-1">Availability</h1>
            <p className="section-subheading !mb-0">
              Doctor–hospital availability · <span style={{ color: 'var(--primary)' }} className="font-semibold">{TODAY}</span> highlighted
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-xl border border-base-300 overflow-hidden p-0.5 gap-0.5" style={{ background: 'var(--base-100)' }}>
              <TabBtn id="doctors"   label="Doctors"   Icon={User} />
              <TabBtn id="hospitals" label="Hospitals" Icon={Building2} />
              <TabBtn id="charts"    label="Charts"    Icon={BarChart2} />
            </div>
            <button onClick={() => setShowFilters(s => !s)}
              className={`btn btn-sm gap-1 ${showFilters ? 'btn-primary' : 'btn-outline'}`}>
              <Filter size={13} />Filters
            </button>
            <button onClick={load} className="btn btn-sm btn-ghost" disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <div className="alert alert-error"><AlertCircle size={16} /><p className="text-sm">{error}</p></div>
        )}

        {/* ── Filters ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="card p-4 flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-44">
                  <label className="label-text text-xs mb-1 block">Hospital</label>
                  <select className="input-field text-xs py-1.5"
                    value={hospitalId} onChange={e => { setHospitalId(e.target.value); setPage(1); }}>
                    <option value="">All Hospitals</option>
                    {(hospitals ?? []).map(h => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <label className="label cursor-pointer gap-2 pb-0">
                  <input type="checkbox" className="checkbox checkbox-sm checkbox-success"
                    checked={onlineOnly} onChange={e => setOnlineOnly(e.target.checked)} />
                  <span className="label-text text-xs">Online only</span>
                </label>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Online Now"    value={fmt(summary?.onlineNow)}    icon={Wifi}        color="success"  delay={0}    sub="Currently active" />
          <StatCard label="With Slots"    value={fmt(summary?.withSlots)}    icon={Calendar}    color="primary"  delay={0.05} sub="Have schedule set" />
          <StatCard label="Without Slots" value={fmt(summary?.withoutSlots)} icon={WifiOff}     color="error"    delay={0.1}  sub="No schedule" />
          <StatCard label="Total Active"  value={fmt(summary?.totalActive)}  icon={Activity}    color="info"     delay={0.15} sub="Active doctors" />
        </div>

        {/* ── TABS ── */}
        <AnimatePresence mode="wait">

          {/* DOCTORS TAB */}
          {activeTab === 'doctors' && (
            <motion.div key="doctors"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="card overflow-hidden">

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-base-300">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Stethoscope size={14} style={{ color: 'var(--primary)' }} />
                  Doctor Availability
                  {pagination.total != null && (
                    <span className="badge badge-primary badge-xs">{fmt(pagination.total)} total</span>
                  )}
                </h3>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input className="input-field pl-8 text-xs py-1.5 w-52"
                      placeholder="Name, specialty, hospital…"
                      value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16"><div className="loading loading-lg" /></div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-base-content/30">
                    <User size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">No doctors found</p>
                  </div>
                ) : (
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Specialty</th>
                        <th>Hospital</th>
                        <th>Status</th>
                        <th>Today</th>
                        <th>Weekly</th>
                        <th>Rating</th>
                        <th>Profile</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence>
                        {filtered.map((doc, i) => {
                          const todayAvail = doc.todayAvailability ?? {};
                          return (
                            <motion.tr key={doc._id}
                              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.025 }}
                              className="cursor-pointer"
                              onClick={() => setDrawerDoc(doc)}>

                              {/* Doctor */}
                              <td>
                                <div className="flex items-center gap-2.5">
                                  <div className="relative">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs"
                                      style={{ background: 'color-mix(in srgb, var(--primary), transparent 87%)', color: 'var(--primary)' }}>
                                      {(doc.user?.name ?? 'D')[0].toUpperCase()}
                                    </div>
                                    <div className="absolute -bottom-0.5 -right-0.5">
                                      <OnlinePulse online={doc.isOnline} />
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-bold leading-tight">{doc.user?.name ?? '—'}</p>
                                    <p className="text-xs text-base-content/40 flex items-center gap-0.5">
                                      <Phone size={9} />{doc.user?.phone ?? '—'}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Specialty */}
                              <td>
                                <span className="text-xs font-semibold">{doc.specialization ?? '—'}</span>
                              </td>

                              {/* Hospital */}
                              <td>
                                <div className="flex items-start gap-1">
                                  <MapPin size={10} className="text-base-content/30 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <p className="text-xs font-medium leading-tight">{doc.primaryHospital?.name ?? '—'}</p>
                                    <p className="text-xs text-base-content/40">{doc.primaryHospital?.hospitalType}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Online status */}
                              <td>
                                <div className="flex flex-col gap-1">
                                  <span className={`badge badge-${doc.isOnline ? 'success' : 'error'} badge-xs gap-1`}>
                                    {doc.isOnline ? <Wifi size={8} /> : <WifiOff size={8} />}
                                    {doc.isOnline ? 'Online' : 'Offline'}
                                  </span>
                                  {doc.isVerified && (
                                    <span className="badge badge-success badge-xs gap-1">
                                      <ShieldCheck size={8} />Verified
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Today */}
                              <td>
                                {todayAvail.isAvailable ? (
                                  <div>
                                    <span className="badge badge-success badge-xs">
                                      {todayAvail.slots?.length ?? 0} slots
                                    </span>
                                  </div>
                                ) : (
                                  <span className="badge badge-error badge-xs">Off today</span>
                                )}
                              </td>

                              {/* Weekly heatmap */}
                              <td>
                                <DaySlotsGrid weeklyAvailability={doc.weeklyAvailability} />
                              </td>

                              {/* Rating */}
                              <td>
                                {doc.rating?.averageRating != null ? (
                                  <div className="flex items-center gap-1">
                                    <Star size={11} fill="var(--warning)" stroke="var(--warning)" />
                                    <span className="text-xs font-bold">{doc.rating.averageRating.toFixed(1)}</span>
                                  </div>
                                ) : <span className="text-xs text-base-content/30">—</span>}
                              </td>

                              {/* Profile completion */}
                              <td>
                                {doc.profileCompletionPercent != null ? (
                                  <div className="w-16">
                                    <div className="flex justify-between text-xs mb-0.5">
                                      <span className="text-base-content/40">Done</span>
                                      <span className="font-bold text-xs">{doc.profileCompletionPercent}%</span>
                                    </div>
                                    <div className="progress-bar">
                                      <div className="progress-bar-fill"
                                        style={{ width: `${doc.profileCompletionPercent}%` }} />
                                    </div>
                                  </div>
                                ) : <span className="text-xs text-base-content/30">—</span>}
                              </td>

                              {/* Action */}
                              <td>
                                <button className="btn btn-ghost btn-xs btn-circle"
                                  onClick={e => { e.stopPropagation(); setDrawerDoc(doc); }}>
                                  <Eye size={13} />
                                </button>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
                  <p className="text-xs text-base-content/50">
                    Page {page} of {pagination.pages} · {fmt(pagination.total)} doctors
                  </p>
                  <div className="flex items-center gap-1">
                    <button className="btn btn-ghost btn-xs btn-circle" disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}><ChevronLeft size={13} /></button>
                    <span className="text-xs font-bold px-2">{page}</span>
                    <button className="btn btn-ghost btn-xs btn-circle" disabled={page >= pagination.pages}
                      onClick={() => setPage(p => p + 1)}><ChevronRight size={13} /></button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* HOSPITALS TAB */}
          {activeTab === 'hospitals' && (
            <motion.div key="hospitals"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-base-300">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Building2 size={14} style={{ color: 'var(--primary)' }} />
                  Hospital Overview
                  <span className="badge badge-primary badge-xs">{hospStats?.length ?? 0}</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16"><div className="loading loading-lg" /></div>
                ) : !hospStats?.length ? (
                  <div className="flex flex-col items-center justify-center py-16 text-base-content/30">
                    <Hospital size={32} className="mb-2 opacity-30" />
                    <p className="text-sm">No hospital data</p>
                  </div>
                ) : (
                  <table className="table text-sm">
                    <thead>
                      <tr>
                        <th>Hospital</th>
                        <th>Type</th>
                        <th>City</th>
                        <th>Doctors</th>
                        <th>Features</th>
                        <th>Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hospStats.map((h, i) => (
                        <motion.tr key={h._id ?? i}
                          initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.025 }}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${CHART_COLORS[i % CHART_COLORS.length]}, transparent 85%)` }}>
                                <Building2 size={12} style={{ color: CHART_COLORS[i % CHART_COLORS.length] }} />
                              </div>
                              <p className="text-xs font-bold leading-tight">{h.name ?? '—'}</p>
                            </div>
                          </td>
                          <td><span className="badge badge-secondary badge-xs">{h.hospitalType ?? '—'}</span></td>
                          <td>
                            <div className="flex items-center gap-1 text-xs">
                              <MapPin size={10} className="text-base-content/30" />
                              {h['address.city'] ?? h.address?.city ?? '—'}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <Users size={11} style={{ color: 'var(--primary)' }} />
                              <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
                                {fmt(h.doctorCount)}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="flex gap-1.5 flex-wrap">
                              {h.hasBloodBank && (
                                <span className="badge badge-error badge-xs">Blood Bank</span>
                              )}
                              {h.is24x7 && (
                                <span className="badge badge-info badge-xs">24×7</span>
                              )}
                              {h.isEmergencyReady && (
                                <span className="badge badge-warning badge-xs">Emergency</span>
                              )}
                            </div>
                          </td>
                          <td>
                            {h.isVerified
                              ? <span className="badge badge-success badge-xs gap-1"><ShieldCheck size={8} />Yes</span>
                              : <span className="badge badge-error badge-xs">No</span>}
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </motion.div>
          )}

          {/* CHARTS TAB */}
          {activeTab === 'charts' && (
            <motion.div key="charts"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="space-y-4">
              {loading ? (
                <div className="card flex items-center justify-center py-24">
                  <div className="loading loading-lg" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* Radial availability */}
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <CircleDot size={14} style={{ color: 'var(--success)' }} />
                        Availability Rate
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <RadialBarChart cx="50%" cy="50%" innerRadius={40} outerRadius={90}
                          data={radialData} startAngle={90} endAngle={-270}>
                          <RadialBar minAngle={10} dataKey="value" cornerRadius={8} label={{ position: 'insideStart', fill: '#fff', fontSize: 10 }} />
                          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v, e) => `${v}: ${e.payload.value}%`} />
                          <Tooltip formatter={v => `${v}%`} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Status breakdown pie */}
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Activity size={14} style={{ color: 'var(--primary)' }} />
                        Status Overview
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={statusChartData} cx="50%" cy="50%"
                            innerRadius={55} outerRadius={80}
                            paddingAngle={4} dataKey="value" nameKey="name">
                            {statusChartData.map((e, i) => (
                              <Cell key={i} fill={e.fill} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Hospital type breakdown */}
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Building2 size={14} style={{ color: 'var(--secondary)' }} />
                        Hospital Types
                      </h3>
                      {hospTypeData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={hospTypeData} cx="50%" cy="50%"
                              outerRadius={80} dataKey="count" nameKey="name" paddingAngle={3}>
                              {hospTypeData.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 10 }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">No data</div>
                      )}
                    </div>
                  </div>

                  {/* Top hospitals by doctor count */}
                  {doctorCountData.length > 0 && (
                    <div className="card p-5">
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
                        Top Hospitals by Doctor Count
                      </h3>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={doctorCountData} layout="vertical" barSize={16}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
                          <YAxis dataKey="name" type="category" width={120}
                            tick={{ fontSize: 10, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="doctors" name="Doctors" radius={[0, 4, 4, 0]}>
                            {doctorCountData.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}