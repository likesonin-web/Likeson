'use client';

/**
 * BookingsManagement.jsx — Likeson.in
 * Role: Hospital
 * Routes consumed:
 *   GET  /hospital/upcoming          → fetchHospitalUpcoming
 *   PATCH /:id/hospital/confirm      → hospitalConfirmBooking
 *   GET  /hospital/:id/ops           → fetchHospitalOps
 *   GET  /hospital/:id/valid-ops     → fetchHospitalValidOps
 *
 * Stack: Next.js · Redux (operationsSlice) · Tailwind (custom CSS vars)
 *        Lucide Icons · Framer Motion · Recharts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import {
  CalendarDays, ClipboardList, CheckCircle2, Clock, ChevronRight,
  Search, SlidersHorizontal, RefreshCw, Building2, UserCheck,
  Stethoscope, ArrowUpRight, AlertCircle, X, ChevronDown,
  ChevronLeft, TrendingUp, Activity, Users, FileText,
  CheckCheck, Eye, Download, Loader2, MoreHorizontal,
  Calendar, Phone, Badge, Star, Filter, XCircle,
} from 'lucide-react';

import {
  fetchHospitalUpcoming,
  fetchHospitalOps,
  fetchHospitalValidOps,
  hospitalConfirmBooking,
  selectHospitalUpcoming,
  selectHospitalOps,
  selectHospitalOpsMeta,
  selectHospitalValidOps,
  selectHospitalValidOpsMeta,
  selectLoading,
  selectError,
} from '@/store/slices/operationsSlice';

// ─── constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'upcoming',   label: 'Upcoming',    icon: CalendarDays },
  { id: 'ops',        label: 'All OPs',     icon: ClipboardList },
  { id: 'valid-ops',  label: 'Follow-Up Eligible', icon: CheckCircle2 },
  { id: 'analytics',  label: 'Analytics',   icon: TrendingUp },
];

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     color: 'warning',  dot: '#f59e0b' },
  confirmed:   { label: 'Confirmed',   color: 'success',  dot: '#10b981' },
  in_progress: { label: 'In Progress', color: 'info',     dot: '#3b82f6' },
  completed:   { label: 'Completed',   color: 'success',  dot: '#059669' },
  cancelled:   { label: 'Cancelled',   color: 'error',    dot: '#ef4444' },
  no_show:     { label: 'No Show',     color: 'error',    dot: '#dc2626' },
  scheduled:   { label: 'Scheduled',   color: 'primary',  dot: 'var(--primary)' },
};

const BOOKING_TYPE_LABELS = {
  full_care_ride:       'Full Care + Ride',
  doctor_consultation:  'Doctor Consult',
  doctor_online:        'Online Consult',
  physiotherapist:      'Physio',
  follow_up:            'Follow-Up',
};

const CONSULTATION_LABELS = {
  inPerson:  'In-Person',
  video:     'Video',
  homeVisit: 'Home Visit',
};

const OP_STATUS_OPTIONS = ['', 'scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];

// ─── animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' } }),
};

const slideIn = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (date, opts = {}) => {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', ...opts,
  });
};

const fmtDate = (date) => fmt(date, { hour: undefined, minute: undefined });

const daysLeft = (expiry) => {
  if (!expiry) return 0;
  return Math.max(0, Math.ceil((new Date(expiry) - new Date()) / 86400000));
};

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: 'neutral', dot: '#888' };
  return (
    <span className={`badge badge-${cfg.color} gap-1.5`}>
      <span className="status-dot" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className="badge badge-secondary text-xs">
      {BOOKING_TYPE_LABELS[type] || type}
    </span>
  );
}

function ConsultBadge({ type }) {
  if (!type) return null;
  return (
    <span className="badge badge-accent badge-sm">
      {CONSULTATION_LABELS[type] || type}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'primary', index = 0 }) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="stat-card group cursor-default"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in srgb, var(--${color}), transparent 88%)` }}
        >
          <Icon size={18} style={{ color: `var(--${color})` }} />
        </div>
        <ArrowUpRight size={14} className="text-base-content/30 group-hover:text-primary transition-colors" />
      </div>
      <div className="stat-card-value" style={{ color: `var(--${color})` }}>{value}</div>
      <div className="stat-card-label">{label}</div>
      {sub && <p className="text-xs text-base-content/40 mt-1">{sub}</p>}
    </motion.div>
  );
}

function EmptyState({ icon: Icon = FileText, title = 'No records found', sub = 'Try adjusting filters.' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon size={28} className="text-primary/50" />
      </div>
      <h3 className="font-semibold text-base-content/70 mb-1">{title}</h3>
      <p className="text-sm text-base-content/40">{sub}</p>
    </div>
  );
}

function Spinner({ size = 20 }) {
  return <Loader2 size={size} className="animate-spin text-primary" />;
}

function Pagination({ meta, page, setPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 border-t border-base-300">
      <span className="text-sm text-base-content/50">
        Showing page {meta.page} of {meta.pages} · {meta.total} total
      </span>
      <div className="flex gap-2">
        <button
          className="btn btn-sm btn-ghost"
          disabled={page <= 1}
          onClick={() => setPage(p => p - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(meta.pages, 5) }, (_, i) => {
          const p = i + 1;
          return (
            <button
              key={p}
              className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setPage(p)}
            >
              {p}
            </button>
          );
        })}
        <button
          className="btn btn-sm btn-ghost"
          disabled={page >= meta.pages}
          onClick={() => setPage(p => p + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── booking detail modal ─────────────────────────────────────────────────────

function BookingDetailModal({ booking, onClose, onConfirm, confirming }) {
  if (!booking) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          className="relative w-full max-w-lg bg-base-100 rounded-2xl shadow-depth-lg overflow-hidden"
          initial={{ scale: 0.92, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        >
          {/* header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
            <div>
              <h2 className="text-lg font-bold text-base-content">{booking.bookingCode}</h2>
              <div className="flex gap-2 mt-1">
                <TypeBadge type={booking.bookingType} />
                <StatusBadge status={booking.status} />
              </div>
            </div>
            <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          {/* body */}
          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {/* patient */}
            <Section title="Patient" icon={Users}>
              <Row label="Name"   value={booking.patientInfo?.name} />
              <Row label="Age / Gender" value={`${booking.patientInfo?.age ?? '—'} · ${booking.patientInfo?.gender ?? '—'}`} />
              <Row label="Phone"  value={booking.patientInfo?.phone || booking.customer?.phone} />
              <Row label="Blood"  value={booking.patientInfo?.bloodGroup} />
            </Section>

            {/* appointment */}
            <Section title="Appointment" icon={CalendarDays}>
              <Row label="Scheduled" value={fmt(booking.scheduledAt)} />
              <Row label="Type"      value={CONSULTATION_LABELS[booking.consultationType] || '—'} />
            </Section>

            {/* doctor */}
            {(booking.doctor || booking.doctorSnapshot) && (
              <Section title="Doctor" icon={Stethoscope}>
                <Row label="Name"  value={booking.doctorSnapshot?.name || booking.doctor?.user?.name} />
                <Row label="Spec." value={booking.doctorSnapshot?.specialization || booking.doctor?.specialization} />
              </Section>
            )}

            {/* care assistant */}
            {booking.careAssistant && (
              <Section title="Care Assistant" icon={UserCheck}>
                <Row label="Name"  value={booking.careAssistant?.fullName || booking.careAssistantSnapshot?.name} />
                <Row label="Phone" value={booking.careAssistant?.phone || booking.careAssistantSnapshot?.phone} />
              </Section>
            )}

            {/* fare */}
            <Section title="Fare" icon={Badge}>
              <Row label="Consult Fee"   value={`₹${booking.fareBreakdown?.consultationFee ?? 0}`} />
              <Row label="Transport Fee" value={`₹${booking.fareBreakdown?.transportFee ?? 0}`} />
              <Row label="Total"         value={`₹${booking.fareBreakdown?.totalAmount ?? 0}`} bold />
              <Row label="Payment"       value={booking.paymentStatus} />
            </Section>
          </div>

          {/* footer */}
          <div className="px-6 py-4 border-t border-base-300 flex justify-end gap-3">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            {booking.status === 'pending' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onConfirm(booking._id)}
                disabled={confirming}
              >
                {confirming ? <Spinner size={14} /> : <CheckCheck size={14} />}
                Confirm Appointment
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/50">{title}</span>
      </div>
      <div className="bg-base-200 rounded-xl px-4 py-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-base-content/50 shrink-0">{label}</span>
      <span className={`text-sm text-right ${bold ? 'font-bold text-primary' : 'text-base-content'}`}>
        {value || '—'}
      </span>
    </div>
  );
}

// ─── UPCOMING TAB ─────────────────────────────────────────────────────────────

function UpcomingTab({ hospitalId }) {
  const dispatch   = useDispatch();
  const bookings   = useSelector(selectHospitalUpcoming);
  const loading    = useSelector(selectLoading('fetchHospitalUpcoming'));
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchHospitalUpcoming());
  }, [dispatch]);

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.toLowerCase();
    return bookings.filter(b =>
      b.bookingCode?.toLowerCase().includes(q) ||
      b.patientInfo?.name?.toLowerCase().includes(q) ||
      b.doctorSnapshot?.name?.toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const handleConfirm = async (bookingId) => {
    setConfirming(true);
    await dispatch(hospitalConfirmBooking({ bookingId }));
    setConfirming(false);
    setSelected(null);
    dispatch(fetchHospitalUpcoming());
  };

  return (
    <div className="space-y-4">
      {/* search bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            className="input-field pl-9 h-9 text-sm"
            placeholder="Search booking, patient, doctor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content" onClick={() => setSearch('')}>
              <X size={12} />
            </button>
          )}
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => dispatch(fetchHospitalUpcoming())}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !bookings.length ? (
        <div className="flex justify-center py-20"><Spinner size={28} /></div>
      ) : !filtered.length ? (
        <EmptyState icon={CalendarDays} title="No upcoming appointments" sub="All clear! No pending or confirmed appointments." />
      ) : (
        <div className="space-y-3">
          {filtered.map((booking, i) => (
            <motion.div
              key={booking._id}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="card p-4 cursor-pointer group"
              onClick={() => setSelected(booking)}
            >
              <div className="flex items-start justify-between gap-4">
                {/* left */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-bold text-sm text-base-content font-mono">{booking.bookingCode}</span>
                    <TypeBadge type={booking.bookingType} />
                    <StatusBadge status={booking.status} />
                    {booking.consultationType && <ConsultBadge type={booking.consultationType} />}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-base-content/70">
                    <span className="flex items-center gap-1">
                      <Users size={12} className="text-primary/60" />
                      {booking.patientInfo?.name}
                      {booking.patientInfo?.age ? `, ${booking.patientInfo.age}y` : ''}
                    </span>
                    {booking.doctorSnapshot?.name && (
                      <span className="flex items-center gap-1">
                        <Stethoscope size={12} className="text-primary/60" />
                        {booking.doctorSnapshot.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-base-content/50">
                    <Clock size={11} />
                    {fmt(booking.scheduledAt)}
                  </div>
                </div>

                {/* right */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-sm font-bold text-primary">
                    ₹{booking.fareBreakdown?.totalAmount ?? 0}
                  </span>
                  {booking.status === 'pending' && (
                    <button
                      className="btn btn-success btn-xs"
                      onClick={e => { e.stopPropagation(); handleConfirm(booking._id); }}
                      disabled={confirming}
                    >
                      {confirming ? <Spinner size={12} /> : <CheckCheck size={12} />}
                      Confirm
                    </button>
                  )}
                  <ChevronRight size={14} className="text-base-content/30 group-hover:text-primary transition-colors" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <BookingDetailModal
        booking={selected}
        onClose={() => setSelected(null)}
        onConfirm={handleConfirm}
        confirming={confirming}
      />
    </div>
  );
}

// ─── OPS TAB ─────────────────────────────────────────────────────────────────

function OpsTab({ hospitalId }) {
  const dispatch = useDispatch();
  const ops      = useSelector(selectHospitalOps);
  const meta     = useSelector(selectHospitalOpsMeta);
  const loading  = useSelector(selectLoading('fetchHospitalOps'));

  const [page,     setPage]     = useState(1);
  const [status,   setStatus]   = useState('');
  const [date,     setDate]     = useState('');
  const [search,   setSearch]   = useState('');
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    if (!hospitalId) return;
    dispatch(fetchHospitalOps({ hospitalId, status: status || undefined, date: date || undefined, page, limit: 20 }));
  }, [dispatch, hospitalId, status, date, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ops;
    const q = search.toLowerCase();
    return ops.filter(op =>
      op.opNumber?.toLowerCase().includes(q) ||
      op.patient?.name?.toLowerCase().includes(q)
    );
  }, [ops, search]);

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input className="input-field pl-9 h-9 text-sm" placeholder="OP number, patient…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <select
          className="input-field h-9 text-sm w-40"
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All Statuses</option>
          {OP_STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
          ))}
        </select>

        <input
          type="date"
          className="input-field h-9 text-sm w-40"
          value={date}
          onChange={e => { setDate(e.target.value); setPage(1); }}
        />

        {(status || date) && (
          <button className="btn btn-ghost btn-sm text-error" onClick={() => { setStatus(''); setDate(''); setPage(1); }}>
            <XCircle size={14} /> Clear
          </button>
        )}

        <button className="btn btn-ghost btn-sm ml-auto" onClick={load}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && !ops.length ? (
        <div className="flex justify-center py-20"><Spinner size={28} /></div>
      ) : !filtered.length ? (
        <EmptyState icon={ClipboardList} title="No OP records" sub="Try different filters." />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>OP #</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Scheduled</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Fee</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((op, i) => (
                  <motion.tr
                    key={op._id}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="cursor-pointer"
                    onClick={() => setSelected(op)}
                  >
                    <td className="font-mono font-bold text-primary">{op.opNumber}</td>
                    <td>
                      <div>{op.patient?.name || op.patientName || '—'}</div>
                      {op.patient?.phone && <div className="text-xs text-base-content/50">{op.patient.phone}</div>}
                    </td>
                    <td>
                      <div>{op.doctor?.user?.name || '—'}</div>
                      {op.doctor?.specialization && <div className="text-xs text-base-content/50">{op.doctor.specialization}</div>}
                    </td>
                    <td className="whitespace-nowrap text-xs">{fmt(op.scheduledAt)}</td>
                    <td><span className="badge badge-secondary badge-sm">{op.consultationType}</span></td>
                    <td><StatusBadge status={op.status} /></td>
                    <td className="font-bold">₹{op.consultationFee ?? 0}</td>
                    <td>
                      <button className="btn btn-ghost btn-xs btn-circle"><Eye size={13} /></button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={meta} page={page} setPage={setPage} />
        </>
      )}

      {/* OP detail mini-modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
            <motion.div
              className="relative w-full max-w-md bg-base-100 rounded-2xl shadow-depth-lg overflow-hidden"
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
                <div>
                  <span className="font-bold font-mono text-primary">{selected.opNumber}</span>
                  <div className="flex gap-2 mt-1">
                    <StatusBadge status={selected.status} />
                    <span className="badge badge-secondary badge-sm">{selected.consultationType}</span>
                  </div>
                </div>
                <button className="btn btn-ghost btn-circle btn-sm" onClick={() => setSelected(null)}><X size={16} /></button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <Section title="Patient" icon={Users}>
                  <Row label="Name"   value={selected.patient?.name} />
                  <Row label="Phone"  value={selected.patient?.phone} />
                  <Row label="Email"  value={selected.patient?.email} />
                </Section>
                <Section title="Doctor" icon={Stethoscope}>
                  <Row label="Name"   value={selected.doctor?.user?.name} />
                  <Row label="Spec."  value={selected.doctor?.specialization} />
                </Section>
                <Section title="Clinical" icon={FileText}>
                  <Row label="Reason"      value={selected.reasonForVisit} />
                  <Row label="Notes"       value={selected.doctorNotes ? '✓ Present' : '—'} />
                  <Row label="Rx URL"      value={selected.prescriptionUrl ? '✓ Attached' : '—'} />
                  <Row label="Completed"   value={fmtDate(selected.completedAt)} />
                </Section>
                {selected.isFollowUpEligible && (
                  <div className="alert alert-success text-sm">
                    <CheckCircle2 size={16} />
                    Follow-up eligible · {daysLeft(selected.followUpExpiry)} days remaining
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── VALID OPS (Follow-up eligible) TAB ──────────────────────────────────────

function ValidOpsTab({ hospitalId }) {
  const dispatch = useDispatch();
  const ops      = useSelector(selectHospitalValidOps);
  const meta     = useSelector(selectHospitalValidOpsMeta);
  const loading  = useSelector(selectLoading('fetchHospitalValidOps'));

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (hospitalId) dispatch(fetchHospitalValidOps({ hospitalId, page, limit: 20 }));
  }, [dispatch, hospitalId, page]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ops;
    const q = search.toLowerCase();
    return ops.filter(op =>
      op.opNumber?.toLowerCase().includes(q) ||
      op.patient?.name?.toLowerCase().includes(q)
    );
  }, [ops, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input className="input-field pl-9 h-9 text-sm" placeholder="OP, patient…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="alert alert-info text-xs py-2 px-3 ml-auto">
          <AlertCircle size={13} /> These OPs can accept FREE/reduced follow-up bookings
        </div>
      </div>

      {loading && !ops.length ? (
        <div className="flex justify-center py-20"><Spinner size={28} /></div>
      ) : !filtered.length ? (
        <EmptyState icon={CheckCircle2} title="No eligible OPs" sub="No OPs within follow-up window." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((op, i) => {
              const days = op.daysRemaining ?? daysLeft(op.followUpExpiry);
              const urgent = days <= 7;
              return (
                <motion.div
                  key={op._id}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  className={`card p-4 border-l-4 ${urgent ? 'border-l-warning' : 'border-l-success'}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-mono font-bold text-primary text-sm">{op.opNumber}</span>
                    <span className={`badge badge-sm ${urgent ? 'badge-warning' : 'badge-success'}`}>
                      {days}d left
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-base-content mb-0.5">
                    {op.patient?.name || op.patientName}
                  </div>
                  <div className="text-xs text-base-content/50 mb-2">
                    {op.doctor?.user?.name} · {op.doctor?.specialization}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-base-content/40">{fmtDate(op.scheduledAt)}</span>
                    <span className="text-xs font-bold text-success">
                      Follow-up fee: ₹{op.followUpFee ?? 0}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <Pagination meta={meta} page={page} setPage={setPage} />
        </>
      )}
    </div>
  );
}

// ─── ANALYTICS TAB ───────────────────────────────────────────────────────────

const COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--error)', 'var(--info)', 'var(--accent)'];

function AnalyticsTab({ upcoming, ops }) {
  // derive charts from real data
  const statusDist = useMemo(() => {
    const map = {};
    [...upcoming, ...ops].forEach(b => {
      const s = b.status || 'unknown';
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name: STATUS_CONFIG[name]?.label || name, value }));
  }, [upcoming, ops]);

  const typeDist = useMemo(() => {
    const map = {};
    upcoming.forEach(b => {
      const t = BOOKING_TYPE_LABELS[b.bookingType] || b.bookingType;
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [upcoming]);

  const consultDist = useMemo(() => {
    const map = {};
    [...upcoming, ...ops].forEach(b => {
      const c = CONSULTATION_LABELS[b.consultationType] || b.consultationType || 'Unknown';
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [upcoming, ops]);

  const revenueByType = useMemo(() => {
    const map = {};
    ops.forEach(op => {
      const t = BOOKING_TYPE_LABELS[op.booking?.bookingType] || 'Other';
      map[t] = (map[t] || 0) + (op.consultationFee || 0);
    });
    return Object.entries(map).map(([name, revenue]) => ({ name, revenue }));
  }, [ops]);

  const totalRevenue = useMemo(() =>
    ops.reduce((acc, op) => acc + (op.consultationFee || 0), 0), [ops]);

  const completedOps  = useMemo(() => ops.filter(o => o.status === 'completed').length, [ops]);
  const followUpReady = useMemo(() => upcoming.filter(b => b.status === 'pending').length, [upcoming]);

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'var(--base-200)',
      border: '1px solid var(--base-300)',
      borderRadius: '0.75rem',
      color: 'var(--base-content)',
      fontSize: '12px',
    },
  };

  return (
    <div className="space-y-6">
      {/* stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={CalendarDays} label="Upcoming" value={upcoming.length} color="primary" index={0} />
        <StatCard icon={CheckCircle2} label="Completed OPs" value={completedOps} color="success" index={1} />
        <StatCard icon={Clock}        label="Pending Confirm" value={followUpReady} color="warning" index={2} />
        <StatCard icon={Activity}     label="Total Revenue" value={`₹${totalRevenue.toLocaleString('en-IN')}`} color="accent" index={3} />
      </div>

      {/* charts row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* status pie */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="card p-5">
          <h3 className="font-bold text-sm text-base-content/70 mb-4 uppercase tracking-wider">Status Distribution</h3>
          {statusDist.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusDist} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                  {statusDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--base-content)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Activity} title="No data" sub="Bookings will appear here." />
          )}
        </motion.div>

        {/* type bar */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="card p-5">
          <h3 className="font-bold text-sm text-base-content/70 mb-4 uppercase tracking-wider">Upcoming by Type</h3>
          {typeDist.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeDist} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                  {typeDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={BarChart} title="No data" sub="Upcoming bookings will appear here." />
          )}
        </motion.div>
      </div>

      {/* charts row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* consult type */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="card p-5">
          <h3 className="font-bold text-sm text-base-content/70 mb-4 uppercase tracking-wider">By Consultation Mode</h3>
          {consultDist.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={consultDist} cx="50%" cy="50%" outerRadius={80} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {consultDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={Activity} title="No data" />
          )}
        </motion.div>

        {/* revenue */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="card p-5">
          <h3 className="font-bold text-sm text-base-content/70 mb-4 uppercase tracking-wider">Revenue by Booking Type</h3>
          {revenueByType.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueByType} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={v => [`₹${v}`, 'Revenue']} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState icon={TrendingUp} title="No revenue data" />
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function BookingsManagement() {
  const dispatch   = useDispatch();
  const [activeTab, setActiveTab] = useState('upcoming');

// hospital id from auth — adapt to your auth selector
  const [hospitalId, setHospitalId] = useState(null);
  useEffect(() => {
    // real impl: const id = useSelector(selectCurrentHospitalId)
    // mocking so page doesn't crash without auth
    // FIX: Replaced 'demo-hospital-id' with a valid 24-character hex string 
    // to pass MongoDB ObjectId validation on the backend.
    if (typeof window !== 'undefined') {
      setHospitalId(localStorage.getItem('hospitalId') || '507f1f77bcf86cd799439011');
    }
  }, []);

  const upcoming = useSelector(selectHospitalUpcoming);
  const ops      = useSelector(selectHospitalOps);

  // summary counts
  const pendingCount   = useMemo(() => upcoming.filter(b => b.status === 'pending').length, [upcoming]);
  const confirmedCount = useMemo(() => upcoming.filter(b => b.status === 'confirmed').length, [upcoming]);
  const inProgressCount = useMemo(() => upcoming.filter(b => b.status === 'in_progress').length, [upcoming]);

  return (
    <div data-theme="hospital" className="min-h-screen bg-base-100">
      <div className="max-w-7xl mx-auto px-4  py-6 space-y-6">

        {/* ── Page header ── */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2">
              <Building2 className="text-primary" size={24} />
              Bookings Management
            </h1>
            <p className="text-sm text-base-content/50 mt-0.5">Hospital operations · appointments · OP records</p>
          </div>

          {/* quick counts */}
          <div className="flex items-center gap-3">
            {[
              { label: 'Pending',     count: pendingCount,   color: 'warning' },
              { label: 'Confirmed',   count: confirmedCount, color: 'success' },
              { label: 'In Progress', count: inProgressCount, color: 'info' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-base-300 bg-base-200">
                <span className="status-dot" style={{ backgroundColor: `var(--${color})` }} />
                <span className="text-xs font-bold text-base-content/70">{label}</span>
                <span className="text-xs font-black" style={{ color: `var(--${color})` }}>{count}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Tabs ── */}
        <motion.div variants={slideIn} initial="hidden" animate="visible">
          <div className="flex gap-1 p-1 bg-base-200 rounded-xl w-fit overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-base-100 text-primary shadow-sm'
                    : 'text-base-content/60 hover:text-base-content hover:bg-base-300/50'
                }`}
              >
                <Icon size={14} />
                {label}
                {id === 'upcoming' && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-warning text-xs font-black text-warning-content flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === 'upcoming'  && <UpcomingTab  hospitalId={hospitalId} />}
            {activeTab === 'ops'       && <OpsTab       hospitalId={hospitalId} />}
            {activeTab === 'valid-ops' && <ValidOpsTab  hospitalId={hospitalId} />}
            {activeTab === 'analytics' && <AnalyticsTab upcoming={upcoming} ops={ops} />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}