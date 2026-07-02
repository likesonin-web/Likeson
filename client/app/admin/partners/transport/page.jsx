'use client';

import {
  useState, useCallback, useMemo, useEffect, useRef, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Building2, Users, Truck, ShieldCheck, ShieldX, DollarSign,
  Search, Plus, Eye, Pencil, Trash2, AlertTriangle, BarChart2,
  FileText, MapPin, RefreshCw, ChevronLeft, ChevronRight,
  Activity, Lock, Unlock, StickyNote, Star,
  Loader2, X, Check, Ban, Wallet, Globe,
  Info, BadgeCheck, Receipt, Coins, Image, ExternalLink,
  FileImage, FileBadge, Car,
} from 'lucide-react';

import {
  adminFetchPartners,
  adminFetchPartnerById,
  adminCreatePartner,
  adminUpdatePartner,
  adminUpdatePartnerStatus,
  adminUpdatePartnerKyc,
  adminUpdatePartnerNotes,
  adminDeletePartner,
  adminFetchPartnerLogs,
  adminFetchPendingVehicles,
  adminVerifyVehicle,
  adminFetchAllDrivers,
  adminFetchAvailableDrivers,
  adminFetchDriverById,
  adminVerifyDriverKyc,
  adminBlockDriver,
  adminUnblockDriver,
  adminUpdateDriverNotes,
  adminAdjustDriverCoins,
  adminFetchDriverLogs,
  adminFetchGlobalPricing,
  adminUpdateGlobalPricing,
  adminSetPartnerPlatformFee,
  adminProcessPartnerSettlement,
  adminFetchTransportLogs,
  adminFetchTransportStats,
} from '@/store/slices/transportPartnerSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview',    icon: BarChart2 },
  { id: 'partners', label: 'Partners',    icon: Building2 },
  { id: 'vehicles', label: 'Vehicles',    icon: Truck },
  { id: 'drivers',  label: 'Drivers',     icon: Users },
  { id: 'pricing',  label: 'Pricing',     icon: DollarSign },
  { id: 'logs',     label: 'System Logs', icon: FileText },
];

const STATUS_CSS = {
  active:          'badge-success',
  pending:         'badge-warning',
  'under-review':  'badge-info',
  suspended:       'badge-error',
  rejected:        'badge-error',
};

const KYC_CSS = {
  verified:        'badge-success',
  pending:         'badge-warning',
  'under-review':  'badge-info',
  rejected:        'badge-error',
  'not-submitted': 'badge-ghost',
};

const DRIVER_KYC_CSS = {
  Verified:        'badge-success',
  Pending:         'badge-warning',
  'Under-Review':  'badge-info',
  Rejected:        'badge-error',
};

const DRIVER_KYC_STATUSES      = ['Pending', 'Under-Review', 'Verified', 'Rejected'];
const VEHICLE_VERIFY_STATUSES  = ['under-review', 'verified', 'rejected'];
const PARTNERSHIP_STATUSES     = ['pending', 'under-review', 'active', 'suspended', 'rejected'];

const CHART_PALETTE = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)',
];

// ─────────────────────────────────────────────────────────────────────────────
// FRAMER VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.26, ease: 'easeOut' } } };
const stagger = { visible: { transition: { staggerChildren: 0.055 } } };
const slideIn = { hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.24, ease: 'easeOut' } }, exit: { opacity: 0, x: 20, transition: { duration: 0.16 } } };
const scaleIn = { hidden: { opacity: 0, scale: 0.96 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.2 } }, exit: { opacity: 0, scale: 0.96, transition: { duration: 0.14 } } };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Detect if URL is a PDF */
const isPdf = (url) => url && url.toLowerCase().includes('.pdf');

/** Detect if URL is an image */
const isImage = (url) => url && /\.(jpg|jpeg|png|webp|gif|svg|avif)(\?|$)/i.test(url);

/** Format INR */
const inr = (n) => Number(n ?? 0).toLocaleString('en-IN');

// ─────────────────────────────────────────────────────────────────────────────
// DOC VIEWER MODAL
// ─────────────────────────────────────────────────────────────────────────────

const DocViewerModal = memo(({ open, onClose, url, title }) => {
  if (!open || !url) return null;
  const pdf = isPdf(url);
  const img = isImage(url);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            variants={scaleIn} initial="hidden" animate="visible" exit="exit"
            className="bg-base-100 rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-base-300 shrink-0">
              <div className="flex items-center gap-2">
                {pdf ? <FileText size={15} className="text-error" /> : <FileImage size={15} className="text-primary" />}
                <span className="text-sm font-bold text-base-content">{title}</span>
              </div>
              <div className="flex items-center gap-2">
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-xs gap-1" title="Open in new tab">
                  <ExternalLink size={12} /> Open
                </a>
                <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle"><X size={14} /></button>
              </div>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
              {pdf ? (
                <iframe
                  src={url}
                  className="w-full rounded-lg border border-base-300"
                  style={{ minHeight: '70vh' }}
                  title={title}
                />
              ) : img ? (
                <img
                  src={url}
                  alt={title}
                  className="max-w-full max-h-[72vh] rounded-lg object-contain border border-base-300 shadow"
                />
              ) : (
                <div className="text-center py-16">
                  <FileText size={48} className="mx-auto mb-4 text-base-content/20" />
                  <p className="text-sm text-base-content/50 mb-4">Cannot preview this file type.</p>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm gap-2">
                    <ExternalLink size={13} /> Open in New Tab
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
DocViewerModal.displayName = 'DocViewerModal';

// ─────────────────────────────────────────────────────────────────────────────
// DOC THUMB
// ─────────────────────────────────────────────────────────────────────────────

const DocThumb = memo(({ url, label }) => {
  const [open, setOpen] = useState(false);
  if (!url) return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-dashed border-base-300 bg-base-200/50 min-w-[100px]">
      <FileText size={22} className="text-base-content/20" />
      <span className="text-xs text-base-content/40 text-center leading-tight">{label}</span>
      <span className="text-xs text-base-content/30 italic">Not uploaded</span>
    </div>
  );
  const pdf = isPdf(url);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-base-300 bg-base-200 hover:border-primary hover:bg-primary/5 transition-all min-w-[100px] cursor-pointer group"
        title={`View ${label}`}
      >
        {pdf ? (
          <div className="w-16 h-12 flex items-center justify-center bg-error/10 rounded-md">
            <FileText size={28} className="text-error" />
          </div>
        ) : (
          <img
            src={url}
            alt={label}
            className="w-16 h-12 object-cover rounded-md border border-base-300 group-hover:ring-2 group-hover:ring-primary transition-all"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        )}
        <span className="text-xs text-base-content/60 text-center leading-tight font-medium">{label}</span>
        <span className="text-xs text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye size={10} /> View
        </span>
      </button>
      <DocViewerModal open={open} onClose={() => setOpen(false)} url={url} title={label} />
    </>
  );
});
DocThumb.displayName = 'DocThumb';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const FieldNote = memo(({ label, note, children, required = false }) => (
  <div className="flex flex-col gap-1">
    <label className="label-text flex items-center gap-1">
      {label}
      {required && <span className="text-error text-xs leading-none">*</span>}
    </label>
    {children}
    {note && (
      <p className="flex items-center gap-1 text-xs text-base-content/50 leading-snug">
        <Info size={10} className="shrink-0" />
        {note}
      </p>
    )}
  </div>
));
FieldNote.displayName = 'FieldNote';

const SkeletonRow = memo(({ cols = 6 }) => (
  <tr aria-hidden="true">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="skeleton h-4 w-full rounded animate-pulse bg-base-300" />
      </td>
    ))}
  </tr>
));
SkeletonRow.displayName = 'SkeletonRow';

const StatCard = memo(({ icon: Icon, label, value, sub, color = 'primary' }) => (
  <motion.div variants={fadeUp} className="stat-card relative overflow-hidden flex flex-col gap-2">
    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-60"
      style={{ backgroundColor: `color-mix(in srgb, var(--${color}), transparent 85%)` }} aria-hidden="true" />
    <div className="p-2 rounded-lg w-fit" style={{ backgroundColor: `color-mix(in srgb, var(--${color}), transparent 88%)` }}>
      <Icon size={18} style={{ color: `var(--${color})` }} />
    </div>
    <div>
      <p className="stat-card-label">{label}</p>
      <p className="stat-card-value" style={{ color: `var(--${color})` }}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-base-content/40 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
));
StatCard.displayName = 'StatCard';

const StatusBadge = memo(({ status, className = '' }) => (
  <span className={`badge ${STATUS_CSS[status] ?? 'badge-ghost'} ${className}`}>{status ?? 'unknown'}</span>
));
StatusBadge.displayName = 'StatusBadge';

const KycBadge = memo(({ status, className = '' }) => (
  <span className={`badge ${KYC_CSS[status?.toLowerCase?.()] ?? 'badge-ghost'} ${className}`}>{status ?? 'n/a'}</span>
));
KycBadge.displayName = 'KycBadge';

const DriverKycBadge = memo(({ status, className = '' }) => (
  <span className={`badge ${DRIVER_KYC_CSS[status] ?? 'badge-ghost'} ${className}`}>{status ?? 'n/a'}</span>
));
DriverKycBadge.displayName = 'DriverKycBadge';

const CurrentValueRow = memo(({ label, children }) => (
  <div className="flex items-center gap-3 bg-base-200 rounded-lg px-4 py-2.5 text-sm">
    <span className="text-base-content/50 font-medium shrink-0">{label}:</span>
    <span className="font-semibold text-base-content">{children}</span>
  </div>
));
CurrentValueRow.displayName = 'CurrentValueRow';

const Pagination = memo(({ page, total, limit, onPageChange }) => {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const visiblePages = useMemo(() => {
    const range = [];
    const delta = 2;
    for (let i = Math.max(1, page - delta); i <= Math.min(pages, page + delta); i++) range.push(i);
    return range;
  }, [page, pages]);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-base-300 flex-wrap gap-2">
      <p className="text-xs text-base-content/50">
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </p>
      <div className="flex items-center gap-1" role="navigation" aria-label="Pagination">
        <button className="btn btn-ghost btn-xs btn-circle" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous">
          <ChevronLeft size={13} />
        </button>
        {visiblePages.map((p) => (
          <button key={p} className={`btn btn-xs btn-circle ${page === p ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onPageChange(p)} aria-current={page === p ? 'page' : undefined}>
            {p}
          </button>
        ))}
        <button className="btn btn-ghost btn-xs btn-circle" disabled={page >= pages} onClick={() => onPageChange(page + 1)} aria-label="Next">
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
});
Pagination.displayName = 'Pagination';

const Modal = memo(({ open, onClose, title, children, width = 'max-w-2xl' }) => {
  const overlayRef = useRef(null);
  const handleOverlayClick = useCallback((e) => { if (e.target === overlayRef.current) onClose(); }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={handleOverlayClick}
          role="dialog" aria-modal="true" aria-label={title}
        >
          <motion.div
            variants={scaleIn} initial="hidden" animate="visible" exit="exit"
            className={`bg-base-100 rounded-xl shadow-2xl w-full ${width} max-h-[90vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 shrink-0">
              <h2 className="text-base font-bold text-base-content">{title}</h2>
              <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle" aria-label="Close modal"><X size={15} /></button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
Modal.displayName = 'Modal';

const ConfirmDialog = memo(({ open, onClose, onConfirm, title, message, danger = false, loading = false }) => (
  <Modal open={open} onClose={onClose} title={title} width="max-w-sm">
    <div className="space-y-4">
      {danger && (
        <div className="alert alert-error text-sm">
          <AlertTriangle size={15} />
          <span>This action cannot be undone.</span>
        </div>
      )}
      <p className="text-sm text-base-content/70">{message}</p>
      <div className="flex gap-2 justify-end">
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>Cancel</button>
        <button className={`btn btn-sm ${danger ? 'btn-error' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Confirm
        </button>
      </div>
    </div>
  </Modal>
));
ConfirmDialog.displayName = 'ConfirmDialog';

const SectionTabs = memo(({ sections, active, onChange }) => (
  <div className="flex flex-wrap gap-1 border-b border-base-300 pb-2 mb-4" role="tablist">
    {sections.map(({ id, label, icon: Icon }) => (
      <button key={id} role="tab" aria-selected={active === id}
        className={`btn btn-xs gap-1 ${active === id ? 'btn-primary' : 'btn-ghost'}`}
        onClick={() => onChange(id)}>
        <Icon size={11} />{label}
      </button>
    ))}
  </div>
));
SectionTabs.displayName = 'SectionTabs';

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────

const OverviewTab = memo(() => {
  const dispatch = useDispatch();
  const { adminStats, loading } = useSelector((s) => s.transportPartner);

  useEffect(() => { dispatch(adminFetchTransportStats()); }, [dispatch]);

  const partnerData = useMemo(() =>
    (adminStats?.partnerStats ?? []).map((s) => ({ name: s._id ?? 'unknown', count: s.count, rides: s.totalRides ?? 0, earnings: s.totalEarnings ?? 0 })), [adminStats]);
  const driverData  = useMemo(() =>
    (adminStats?.driverStats  ?? []).map((s) => ({ name: s._id ?? 'unknown', count: s.count })), [adminStats]);
  const vehicleData = useMemo(() =>
    (adminStats?.vehicleStats ?? []).map((s) => ({ name: s._id ?? 'unknown', count: s.count })), [adminStats]);

  const kpis = useMemo(() => ({
    totalPartners:  partnerData.reduce((a, b) => a + b.count, 0),
    activePartners: partnerData.find((p) => p.name === 'active')?.count ?? 0,
    totalDrivers:   driverData.reduce((a, b)  => a + b.count, 0),
    totalVehicles:  vehicleData.reduce((a, b) => a + b.count, 0),
  }), [partnerData, driverData, vehicleData]);

  if (loading && !adminStats) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="stat-card animate-pulse">
          <div className="skeleton h-8 w-20 rounded mb-3 bg-base-300" />
          <div className="skeleton h-5 w-12 rounded bg-base-300" />
        </div>
      ))}
    </div>
  );

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Building2}  label="Total Partners"  value={kpis.totalPartners}  sub={`${kpis.activePartners} active`} color="primary" />
        <StatCard icon={ShieldCheck} label="Active Partners" value={kpis.activePartners} color="success" />
        <StatCard icon={Users}      label="Total Drivers"   value={kpis.totalDrivers}   color="secondary" />
        <StatCard icon={Truck}      label="Total Vehicles"  value={kpis.totalVehicles}  color="accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-base-content mb-4">Partners by Status</h3>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={partnerData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--base-content)' }} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} labelStyle={{ fontWeight: 700, color: 'var(--base-content)' }} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {partnerData.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-bold text-base-content mb-4">Driver Status Split</h3>
          <ResponsiveContainer width="100%" height={210}>
            <PieChart>
              <Pie data={driverData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={72}
                label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                {driverData.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: 8, fontSize: 12 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {vehicleData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-base-content mb-4">Vehicles by Verification Status</h3>
          <div className="flex flex-wrap gap-3">
            {vehicleData.map((v, i) => (
              <div key={v.name} className="stat-card flex-1 min-w-[100px] text-center py-4">
                <p className="stat-card-value" style={{ color: CHART_PALETTE[i % CHART_PALETTE.length] }}>{v.count}</p>
                <p className="stat-card-label">{v.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
});
OverviewTab.displayName = 'OverviewTab';

// ─────────────────────────────────────────────────────────────────────────────
// CREATE / EDIT PARTNER MODAL
// ─────────────────────────────────────────────────────────────────────────────

const BLANK_PARTNER = {
  name: '', email: '', phone: '', password: '',
  businessName: '', ownerName: '', ownerPhone: '', ownerEmail: '',
  businessType: 'proprietorship', gstNumber: '', panNumber: '',
  partnershipStatus: 'pending',
};

const PartnerFormModal = memo(({ open, onClose, editData }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector((s) => s.transportPartner);
  const [form, setForm] = useState(BLANK_PARTNER);
  const isEdit = !!editData;

  useEffect(() => {
    if (editData) {
      setForm({
        ...BLANK_PARTNER,
        businessName:      editData.businessName      ?? '',
        ownerName:         editData.ownerName         ?? '',
        ownerPhone:        editData.ownerPhone        ?? '',
        ownerEmail:        editData.ownerEmail        ?? '',
        businessType:      editData.businessType      ?? 'proprietorship',
        gstNumber:         editData.gstNumber         ?? '',
        partnershipStatus: editData.partnershipStatus ?? 'pending',
      });
    } else {
      setForm(BLANK_PARTNER);
    }
  }, [editData, open]);

  const set = useCallback((k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value })), []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (isEdit) {
      const { name, email, phone, password, panNumber, ...rest } = form;
      await dispatch(adminUpdatePartner({ partnerId: editData._id, data: rest }));
    } else {
      await dispatch(adminCreatePartner(form));
    }
    onClose();
  }, [dispatch, form, isEdit, editData, onClose]);

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Partner' : 'Create Transport Partner'} width="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {!isEdit && (
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold uppercase tracking-widest text-base-content/40 pb-1 border-b border-base-300 w-full">
              User Account Credentials
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldNote label="Full Name" note="Legal name for the login account" required>
                <input className="input-field w-full" value={form.name} onChange={set('name')} placeholder="Business owner name" required />
              </FieldNote>
              <FieldNote label="Email Address" note="Primary login email — must be unique" required>
                <input className="input-field w-full" type="email" value={form.email} onChange={set('email')} placeholder="owner@business.com" required />
              </FieldNote>
              <FieldNote label="Mobile Number" note="10-digit Indian mobile (+91 auto-prefixed)">
                <input className="input-field w-full" value={form.phone} onChange={set('phone')} placeholder="9876543210" />
              </FieldNote>
              <FieldNote label="Temporary Password" note="Share securely — user should change on first login" required>
                <input className="input-field w-full" type="password" value={form.password} onChange={set('password')} placeholder="Min. 8 characters" required minLength={8} />
              </FieldNote>
            </div>
          </fieldset>
        )}

        <fieldset className="space-y-4">
          <legend className="text-xs font-bold uppercase tracking-widest text-base-content/40 pb-1 border-b border-base-300 w-full">
            Business & Company Details
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldNote label="Business / Trade Name" note="Registered or operating name of the company" required>
              <input className="input-field w-full" value={form.businessName} onChange={set('businessName')} placeholder="Nalluri Transports Pvt Ltd" required />
            </FieldNote>
            <FieldNote label="Business Structure" note="Legal incorporation type">
              <select className="input-field w-full" value={form.businessType} onChange={set('businessType')}>
                {[['proprietorship', 'Sole Proprietorship'], ['partnership', 'Partnership Firm'],
                  ['pvt-ltd', 'Private Limited (Pvt Ltd)'], ['ltd', 'Limited (Ltd)'],
                  ['llp', 'LLP'], ['individual', 'Individual']].map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </FieldNote>
            <FieldNote label="Owner / Promoter Name" note="Full name of the primary business owner">
              <input className="input-field w-full" value={form.ownerName} onChange={set('ownerName')} placeholder="Owner full name" />
            </FieldNote>
            <FieldNote label="Owner Contact Email" note="For owner-specific notifications">
              <input className="input-field w-full" type="email" value={form.ownerEmail} onChange={set('ownerEmail')} placeholder="owner@business.com" />
            </FieldNote>
            <FieldNote label="Owner Mobile" note="Direct contact for the business owner">
              <input className="input-field w-full" value={form.ownerPhone} onChange={set('ownerPhone')} placeholder="9876543210" />
            </FieldNote>
            <FieldNote label="GST Registration Number" note="15-character GSTIN">
              <input className="input-field w-full" value={form.gstNumber} onChange={set('gstNumber')} placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </FieldNote>
            {!isEdit && (
              <FieldNote label="PAN Card Number" note="10-character PAN — stored encrypted">
                <input className="input-field w-full" value={form.panNumber} onChange={set('panNumber')} placeholder="ABCDE1234F" maxLength={10} />
              </FieldNote>
            )}
            <FieldNote label="Initial Partnership Status" note="'active' to pre-approve; otherwise starts pending">
              <select className="input-field w-full" value={form.partnershipStatus} onChange={set('partnershipStatus')}>
                {(isEdit ? PARTNERSHIP_STATUSES : ['pending', 'under-review', 'active']).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </FieldNote>
          </div>
        </fieldset>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {isEdit ? 'Save Changes' : 'Create Partner'}
          </button>
        </div>
      </form>
    </Modal>
  );
});
PartnerFormModal.displayName = 'PartnerFormModal';

// ─────────────────────────────────────────────────────────────────────────────
// PARTNER DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────

const PARTNER_SECTIONS = [
  { id: 'info',       label: 'Info',         icon: Info },
  { id: 'kyc',        label: 'KYC & Docs',   icon: BadgeCheck },
  { id: 'status',     label: 'Status',       icon: Activity },
  { id: 'fee',        label: 'Platform Fee', icon: DollarSign },
  { id: 'settlement', label: 'Settlement',   icon: Wallet },
  { id: 'notes',      label: 'Notes',        icon: StickyNote },
  { id: 'logs',       label: 'Logs',         icon: FileText },
];

const PartnerDetailModal = memo(({ open, onClose, partnerId }) => {
  const dispatch = useDispatch();
  const { adminPartnerDetail: p, adminPartnerLogs, loading } = useSelector((s) => s.transportPartner);
  const [sec, setSec]               = useState('info');
  const [kycForm, setKycForm]       = useState({ kycStatus: '', aadhaarVerified: false, panVerified: false, rejectionReason: '' });
  const [statusForm, setStatusForm] = useState({ status: '', reason: '' });
  const [feeForm, setFeeForm]       = useState({ type: 'percentage', value: '', clear: false });
  const [settlementAmt, setSettlementAmt] = useState('');
  const [notes, setNotes]           = useState('');

  useEffect(() => {
    if (!open || !partnerId) return;
    dispatch(adminFetchPartnerById(partnerId));
    dispatch(adminFetchPartnerLogs({ partnerId }));
  }, [open, partnerId, dispatch]);

  useEffect(() => {
    if (p) {
      setNotes(p.internalNotes ?? '');
      setKycForm({
        kycStatus:       p.ownerKyc?.kycStatus      ?? '',
        aadhaarVerified: p.ownerKyc?.aadhaarVerified ?? false,
        panVerified:     p.ownerKyc?.panVerified     ?? false,
        rejectionReason: '',
      });
      setStatusForm({ status: p.partnershipStatus ?? '', reason: '' });
    }
  }, [p]);

  const handleKycSave    = useCallback(() => dispatch(adminUpdatePartnerKyc({ partnerId, ...kycForm })), [dispatch, partnerId, kycForm]);
  const handleStatus     = useCallback(() => dispatch(adminUpdatePartnerStatus({ partnerId, status: statusForm.status, reason: statusForm.reason })), [dispatch, partnerId, statusForm]);
  const handleFeeSave    = useCallback(() => dispatch(adminSetPartnerPlatformFee({ partnerId, ...feeForm, value: +feeForm.value })), [dispatch, partnerId, feeForm]);
  const handleSettlement = useCallback(() => { dispatch(adminProcessPartnerSettlement({ partnerId, amount: +settlementAmt })); setSettlementAmt(''); }, [dispatch, partnerId, settlementAmt]);
  const handleNotesSave  = useCallback(() => dispatch(adminUpdatePartnerNotes({ partnerId, notes })), [dispatch, partnerId, notes]);

  const kyc = p?.ownerKyc ?? {};

  return (
    <Modal open={open} onClose={onClose} title={p?.businessName ?? 'Partner Details'} width="max-w-4xl">
      {!p && loading
        ? <div className="flex justify-center py-14"><Loader2 size={28} className="animate-spin text-primary" /></div>
        : !p
          ? <p className="text-center text-base-content/40 py-10 text-sm">No data available.</p>
          : (
            <>
              <SectionTabs sections={PARTNER_SECTIONS} active={sec} onChange={setSec} />

              {/* ── INFO ── */}
              {sec === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    {[
                      ['Business Name',    p.businessName],
                      ['Owner Name',       p.ownerName],
                      ['Owner Email',      p.ownerEmail],
                      ['Owner Phone',      p.ownerPhone],
                      ['Business Type',    p.businessType],
                      ['GST Number',       p.gstNumber     ?? '—'],
                      ['MSME / Udyam',     p.msmeUdyamNumber ?? '—'],
                      ['Partner Since',    p.partnerSince  ? new Date(p.partnerSince).toLocaleDateString('en-IN')  : '—'],
                      ['Verified At',      p.verifiedAt    ? new Date(p.verifiedAt).toLocaleDateString('en-IN')    : '—'],
                      ['Settlement Cycle', p.settlementCycle ?? '—'],
                      ['Total Vehicles',   p.totalVehicles ?? p.vehicles?.length ?? 0],
                      ['Active Vehicles',  p.activeVehicles ?? '—'],
                      ['Total Drivers',    p.drivers?.length ?? 0],
                      ['Dispatch Ready',   p.isDispatchReady ? 'Yes ✓' : 'No'],
                      ['Pref. Settlement', p.bankDetails?.preferredSettlementMethod ?? '—'],
                    ].map(([l, v]) => (
                      <div key={l} className="bg-base-200 rounded-lg p-3">
                        <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">{l}</p>
                        <p className="font-semibold text-base-content mt-0.5 break-all">{String(v)}</p>
                      </div>
                    ))}
                    <div className="bg-base-200 rounded-lg p-3">
                      <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">Partnership Status</p>
                      <StatusBadge status={p.partnershipStatus} className="mt-1.5" />
                    </div>
                    <div className="bg-base-200 rounded-lg p-3">
                      <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">KYC Status</p>
                      <KycBadge status={p.ownerKyc?.kycStatus} className="mt-1.5" />
                    </div>
                    <div className="bg-base-200 rounded-lg p-3">
                      <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">Owner Age</p>
                      <p className="font-semibold text-base-content mt-0.5">{p.ownerAge ? `${p.ownerAge} yrs` : '—'}</p>
                    </div>
                  </div>

                  {/* Vehicles summary */}
                  {p.vehicles?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Vehicles ({p.vehicles.length})</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {p.vehicles.map((v) => (
                          <div key={v._id} className="flex items-center gap-3 bg-base-200 rounded-lg p-3 text-xs">
                            <Car size={16} className="text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-bold font-mono tracking-wider">{v.registrationNumber}</p>
                              <p className="text-base-content/60">{v.make} {v.model} · {v.vehicleType}</p>
                            </div>
                            <span className={`badge badge-xs ${v.verificationStatus === 'verified' ? 'badge-success' : v.verificationStatus === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                              {v.verificationStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── KYC & DOCS ── */}
              {sec === 'kyc' && (
                <div className="space-y-5">
                  <CurrentValueRow label="Current KYC Status">
                    <KycBadge status={kyc.kycStatus} />
                    {kyc.aadhaarVerified && <span className="badge badge-success badge-xs ml-2">Aadhaar ✓</span>}
                    {kyc.panVerified     && <span className="badge badge-success badge-xs ml-1">PAN ✓</span>}
                  </CurrentValueRow>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      ['Full Name',    kyc.fullName ?? '—'],
                      ['Date of Birth', kyc.dateOfBirth ? new Date(kyc.dateOfBirth).toLocaleDateString('en-IN') : '—'],
                      ['Gender',       kyc.gender ?? '—'],
                      ['DL Number',    kyc.drivingLicenseNumber ?? '—'],
                      ['DL Expiry',    kyc.drivingLicenseExpiry ? new Date(kyc.drivingLicenseExpiry).toLocaleDateString('en-IN') : '—'],
                      ['KYC Verified At', kyc.kycVerifiedAt ? new Date(kyc.kycVerifiedAt).toLocaleDateString('en-IN') : '—'],
                    ].map(([l, v]) => (
                      <div key={l} className="bg-base-200 rounded-lg p-2.5">
                        <p className="text-base-content/50 font-semibold uppercase tracking-wide text-[10px]">{l}</p>
                        <p className="font-semibold text-base-content mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Uploaded Documents</p>
                    <div className="flex flex-wrap gap-3">
                      <DocThumb url={kyc.aadhaarFrontUrl}  label="Aadhaar Front" />
                      <DocThumb url={kyc.aadhaarBackUrl}   label="Aadhaar Back" />
                      <DocThumb url={kyc.drivingLicenseUrl} label="Driving Licence" />
                      <DocThumb url={kyc.panCardUrl}       label="PAN Card" />
                      {kyc.profilePhotoUrl && <DocThumb url={kyc.profilePhotoUrl} label="Profile Photo" />}
                    </div>
                  </div>

                  <div className="border-t border-base-300 pt-4 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Update KYC Decision</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FieldNote label="KYC Status Decision" note="'verified' sets kycVerifiedAt + kycVerifiedBy automatically">
                        <select className="input-field w-full" value={kycForm.kycStatus} onChange={(e) => setKycForm((p) => ({ ...p, kycStatus: e.target.value }))}>
                          <option value="">— Select —</option>
                          {['not-submitted', 'pending', 'under-review', 'verified', 'rejected'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </FieldNote>
                      <FieldNote label="Rejection Reason" note="Required when rejecting — shown to partner in email">
                        <input className="input-field w-full" value={kycForm.rejectionReason} onChange={(e) => setKycForm((p) => ({ ...p, rejectionReason: e.target.value }))} placeholder="Document quality poor, details mismatch..." />
                      </FieldNote>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <label className="label cursor-pointer gap-2">
                        <input type="checkbox" className="checkbox checkbox-success checkbox-sm" checked={kycForm.aadhaarVerified} onChange={(e) => setKycForm((p) => ({ ...p, aadhaarVerified: e.target.checked }))} />
                        <span className="label-text">Aadhaar Manually Verified</span>
                      </label>
                      <label className="label cursor-pointer gap-2">
                        <input type="checkbox" className="checkbox checkbox-success checkbox-sm" checked={kycForm.panVerified} onChange={(e) => setKycForm((p) => ({ ...p, panVerified: e.target.checked }))} />
                        <span className="label-text">PAN Manually Verified</span>
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button className="btn btn-primary btn-sm" onClick={handleKycSave} disabled={loading}>
                        {loading ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
                        Save KYC Decision
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── STATUS ── */}
              {sec === 'status' && (
                <div className="space-y-4">
                  <CurrentValueRow label="Current Status">
                    <StatusBadge status={p.partnershipStatus} />
                    {p.verifiedAt && (
                      <span className="text-xs text-base-content/50 ml-2">
                        since {new Date(p.verifiedAt).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </CurrentValueRow>

                  {p.rejectionReason && (
                    <div className="alert alert-error text-sm py-2">
                      <AlertTriangle size={14} />
                      <span>Rejection Reason: <strong>{p.rejectionReason}</strong></span>
                    </div>
                  )}

                  <div className="alert alert-warning text-sm">
                    <AlertTriangle size={15} />
                    <span>Changing to <strong>suspended</strong> or <strong>rejected</strong> will send automated email to partner.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FieldNote label="New Partnership Status" note="'active' auto-populates verifiedAt, verifiedBy, partnerSince">
                      <select className="input-field w-full" value={statusForm.status} onChange={(e) => setStatusForm((p) => ({ ...p, status: e.target.value }))}>
                        <option value="">— Select new status —</option>
                        {PARTNERSHIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </FieldNote>
                    <FieldNote label="Reason / Note" note="Required for suspension or rejection — stored in audit log">
                      <input className="input-field w-full" value={statusForm.reason} onChange={(e) => setStatusForm((p) => ({ ...p, reason: e.target.value }))} placeholder="Administrative review, fraud detected..." />
                    </FieldNote>
                  </div>
                  <div className="flex justify-end">
                    <button className="btn btn-primary btn-sm" onClick={handleStatus} disabled={loading || !statusForm.status}>
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
                      Update Status
                    </button>
                  </div>
                </div>
              )}

              {/* ── FEE ── */}
              {sec === 'fee' && (
                <div className="space-y-4">
                  <CurrentValueRow label="Current Override">
                    {p.platformFeeOverride
                      ? <span>{p.platformFeeOverride.value} ({p.platformFeeOverride.type})</span>
                      : <span className="text-base-content/50 italic">Using global default</span>}
                  </CurrentValueRow>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FieldNote label="Fee Type" note="'percentage' = % of fare; 'fixed' = flat ₹ amount">
                      <select className="input-field w-full" value={feeForm.type} onChange={(e) => setFeeForm((p) => ({ ...p, type: e.target.value }))}>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Flat Amount (₹)</option>
                      </select>
                    </FieldNote>
                    <FieldNote label="Override Value" note="e.g. 8 for 8% or 50 for ₹50 flat">
                      <input className="input-field w-full" type="number" value={feeForm.value} onChange={(e) => setFeeForm((p) => ({ ...p, value: e.target.value }))} placeholder="e.g. 8" min={0} disabled={feeForm.clear} />
                    </FieldNote>
                    <div className="flex flex-col justify-end pb-1">
                      <label className="label cursor-pointer gap-2">
                        <input type="checkbox" className="checkbox checkbox-sm" checked={feeForm.clear} onChange={(e) => setFeeForm((p) => ({ ...p, clear: e.target.checked }))} />
                        <span className="label-text text-xs">Clear override — revert to global</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button className="btn btn-primary btn-sm" onClick={handleFeeSave} disabled={loading}>
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <DollarSign size={13} />}
                      {feeForm.clear ? 'Clear Override' : 'Apply Override'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── SETTLEMENT ── */}
              {sec === 'settlement' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center">
                      <p className="text-xs text-success font-semibold uppercase tracking-wide">Pending Settlement</p>
                      <p className="text-3xl font-black text-success mt-1.5">₹{inr(p.bankDetails?.pendingSettlementAmount)}</p>
                    </div>
                    <div className="bg-base-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">Total Settled (All Time)</p>
                      <p className="text-3xl font-black text-base-content mt-1.5">₹{inr(p.bankDetails?.totalSettledAmount)}</p>
                    </div>
                  </div>
                  {p.bankDetails?.lastSettledAt && (
                    <p className="text-xs text-base-content/50">Last settled: {new Date(p.bankDetails.lastSettledAt).toLocaleDateString('en-IN')}</p>
                  )}
                  <FieldNote label="Settlement Amount (₹)" note="Must not exceed pending balance">
                    <input className="input-field w-full" type="number" value={settlementAmt} onChange={(e) => setSettlementAmt(e.target.value)} placeholder="Enter amount to process" min={1} max={p.bankDetails?.pendingSettlementAmount} />
                  </FieldNote>
                  <div className="flex justify-end">
                    <button className="btn btn-success btn-sm" onClick={handleSettlement} disabled={loading || !settlementAmt}>
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <Receipt size={13} />}
                      Process Settlement
                    </button>
                  </div>
                </div>
              )}

              {/* ── NOTES ── */}
              {sec === 'notes' && (
                <div className="space-y-3">
                  <FieldNote label="Internal Admin Notes" note="Strictly internal — never visible to partner or driver">
                    <textarea className="input-field w-full min-h-[130px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Document compliance observations, fraud flags..." maxLength={1000} />
                  </FieldNote>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-base-content/40">{notes.length}/1000</p>
                    <button className="btn btn-primary btn-sm" onClick={handleNotesSave} disabled={loading}>
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <StickyNote size={13} />}
                      Save Notes
                    </button>
                  </div>
                </div>
              )}

              {/* ── LOGS ── */}
              {sec === 'logs' && (
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                  {(adminPartnerLogs ?? []).length === 0
                    ? <p className="text-center text-base-content/40 py-10 text-sm">No logs recorded yet.</p>
                    : (adminPartnerLogs ?? []).map((log) => (
                      <div key={log._id} className="bg-base-200 rounded-lg p-3 text-xs flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`badge badge-xs ${log.level === 'error' ? 'badge-error' : log.level === 'success' ? 'badge-success' : log.level === 'warning' ? 'badge-warning' : 'badge-info'}`}>{log.level}</span>
                          <span className="text-base-content/40">{new Date(log.createdAt).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-base-content leading-snug">{log.message}</p>
                      </div>
                    ))
                  }
                </div>
              )}
            </>
          )
      }
    </Modal>
  );
});
PartnerDetailModal.displayName = 'PartnerDetailModal';

// ─────────────────────────────────────────────────────────────────────────────
// PARTNERS TAB
// ─────────────────────────────────────────────────────────────────────────────

const PartnersTab = memo(() => {
  const dispatch = useDispatch();
  const { adminPartners, adminPartnersTotal, loading } = useSelector((s) => s.transportPartner);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editPartner, setEditPartner] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const LIMIT = 15;

  const params = useMemo(() => ({
    page, limit: LIMIT,
    ...(search    && { search }),
    ...(status    && { status }),
    ...(kycStatus && { kycStatus }),
  }), [page, search, status, kycStatus]);

  useEffect(() => { dispatch(adminFetchPartners(params)); }, [dispatch, params]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    await dispatch(adminDeletePartner(deleteTarget._id));
    setDeleteTarget(null);
  }, [dispatch, deleteTarget]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex   gap-2 flex-1">
          <div className=" flex-1 relative w-full   ">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
            <input className="input-field w-full  pl-8 pr-3 py-2 text-sm  " placeholder="Search by name, email..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search partners" />
          </div>
          <select className="input-field w-fit py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {PARTNERSHIP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input-field w-fit py-2 text-sm" value={kycStatus} onChange={(e) => { setKycStatus(e.target.value); setPage(1); }}>
            <option value="">All KYC</option>
            {['not-submitted', 'pending', 'under-review', 'verified', 'rejected'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={() => dispatch(adminFetchPartners(params))} aria-label="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
        <button className="btn btn-primary btn-sm gap-1.5 shrink-0" onClick={() => setShowCreate(true)}>
          <Plus size={13} /> Add Partner
        </button>
      </motion.div>

      <motion.div variants={fadeUp} className="card overflow-hidden">
        <div className="overflow-x-auto" role="region" aria-label="Partners table">
          <table className="table" aria-label="Transport partners list">
            <thead>
              <tr>
                <th>Business</th>
                <th>Owner</th>
                <th>Status</th>
                <th>KYC</th>
                <th className="text-center">Vehicles</th>
                <th className="text-center">Drivers</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && adminPartners.length === 0
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : adminPartners.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="text-center py-14">
                        <Building2 size={36} className="mx-auto mb-3 text-base-content/20" />
                        <p className="text-sm text-base-content/40">No transport partners found.</p>
                      </td>
                    </tr>
                  )
                  : adminPartners.map((p) => (
                    <tr key={p._id}>
                      <td>
                        <p className="font-semibold text-sm text-base-content">{p.businessName}</p>
                        <p className="text-xs text-base-content/50 mt-0.5">{p.ownerEmail}</p>
                      </td>
                      <td className="text-sm">{p.ownerName}</td>
                      <td><StatusBadge status={p.partnershipStatus} /></td>
                      <td><KycBadge status={p.ownerKyc?.kycStatus} /></td>
                      <td className="text-sm text-center">{p.totalVehicles ?? p.vehicles?.length ?? 0}</td>
                      <td className="text-sm text-center">{p.drivers?.length ?? 0}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setDetailId(p._id)} aria-label={`View ${p.businessName}`}><Eye size={13} /></button>
                          <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setEditPartner(p)} aria-label={`Edit ${p.businessName}`}><Pencil size={13} /></button>
                          <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.businessName}`}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={adminPartnersTotal} limit={LIMIT} onPageChange={setPage} />
      </motion.div>

      <PartnerFormModal open={showCreate || !!editPartner} onClose={() => { setShowCreate(false); setEditPartner(null); }} editData={editPartner} />
      <PartnerDetailModal open={!!detailId} onClose={() => setDetailId(null)} partnerId={detailId} />
      <ConfirmDialog
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        title="Delete Transport Partner"
        message={`Permanently delete "${deleteTarget?.businessName}"? All linked drivers will be unlinked. This is irreversible.`}
        danger loading={loading}
      />
    </motion.div>
  );
});
PartnersTab.displayName = 'PartnersTab';

// ─────────────────────────────────────────────────────────────────────────────
// VEHICLES TAB
// ─────────────────────────────────────────────────────────────────────────────

const VehicleDetailModal = memo(({ open, onClose, v, onVerify }) => {
  const { loading } = useSelector((s) => s.transportPartner);
  const [vForm, setVForm] = useState({ verificationStatus: 'verified', rejectionReason: '' });

  useEffect(() => {
    if (v) setVForm({ verificationStatus: v.verificationStatus === 'pending' ? 'under-review' : 'verified', rejectionReason: '' });
  }, [v]);

  if (!v) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Vehicle Review — ${v.registrationNumber}`} width="max-w-2xl">
      <div className="space-y-5">
        <CurrentValueRow label="Current Status">
          <span className={`badge badge-xs ${v.verificationStatus === 'verified' ? 'badge-success' : v.verificationStatus === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
            {v.verificationStatus}
          </span>
        </CurrentValueRow>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {[
            ['Make', v.make],
            ['Model', v.model],
            ['Type', v.vehicleType],
            ['Year', v.year ?? '—'],
            ['Color', v.color ?? '—'],
            ['Seating', v.seatingCapacity ?? '—'],
            ['Permit Type', v.permitType ?? '—'],
            ['Permit Expiry', v.permitExpiry ? new Date(v.permitExpiry).toLocaleDateString('en-IN') : '—'],
            ['Insurance Expiry', v.insuranceExpiry ? new Date(v.insuranceExpiry).toLocaleDateString('en-IN') : '—'],
            ['Fitness Cert Expiry', v.fitnessCertExpiry ? new Date(v.fitnessCertExpiry).toLocaleDateString('en-IN') : '—'],
            ['Pollution Cert Expiry', v.pollutionCertExpiry ? new Date(v.pollutionCertExpiry).toLocaleDateString('en-IN') : '—'],
            ['GPS Device', v.gpsDeviceId ?? '—'],
          ].map(([l, val]) => (
            <div key={l} className="bg-base-200 rounded-lg p-2.5">
              <p className="text-base-content/50 font-semibold uppercase tracking-wide text-[10px]">{l}</p>
              <p className="font-semibold text-base-content mt-0.5">{String(val)}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ['AC', v.hasAC],
            ['Medical Kit', v.hasMedicalKit],
            ['Stretcher', v.hasStretcherSupport],
            ['Oxygen', v.hasOxygenSupport],
            ['Wheelchair Access', v.isWheelchairAccessible],
          ].map(([label, val]) => (
            <span key={label} className={`badge badge-sm ${val ? 'badge-success' : 'badge-ghost opacity-50'}`}>
              {val ? '✓' : '✗'} {label}
            </span>
          ))}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Documents</p>
          <div className="flex flex-wrap gap-3">
            <DocThumb url={v.rcBookUrl}          label="RC Book" />
            <DocThumb url={v.insurancePolicyUrl} label="Insurance Policy" />
            <DocThumb url={v.pollutionCertUrl}   label="Pollution Cert" />
            <DocThumb url={v.fitnessCertUrl}     label="Fitness Cert" />
          </div>
        </div>

        {v.photos?.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Vehicle Photos</p>
            <div className="flex flex-wrap gap-2">
              {v.photos.map((ph, i) => <DocThumb key={i} url={ph} label={`Photo ${i + 1}`} />)}
            </div>
          </div>
        )}

        <div className="bg-base-200 rounded-lg p-3 text-xs">
          <p className="text-base-content/50 font-semibold uppercase tracking-wide">Owner / Agency</p>
          <p className="font-semibold text-base-content mt-0.5">
            {v.ownerId?.businessName || v.ownerId?.name || 'Unknown'} — {v.ownerId?.ownerPhone || v.ownerId?.phone || '—'}
          </p>
        </div>

        <div className="border-t border-base-300 pt-4 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Verification Decision</p>
          <FieldNote label="New Status" note="'verified' makes vehicle available for assignments">
            <select className="input-field w-full" value={vForm.verificationStatus} onChange={(e) => setVForm((p) => ({ ...p, verificationStatus: e.target.value }))}>
              {VEHICLE_VERIFY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </FieldNote>
          {vForm.verificationStatus === 'rejected' && (
            <FieldNote label="Rejection Reason" note="Clearly explain what is deficient" required>
              <textarea className="input-field w-full min-h-[80px]" value={vForm.rejectionReason} onChange={(e) => setVForm((p) => ({ ...p, rejectionReason: e.target.value }))} placeholder="RC expired, insurance document missing..." />
            </FieldNote>
          )}
          <div className="flex gap-3 justify-end">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={() => onVerify(v, vForm)} disabled={loading}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Submit Decision
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
});
VehicleDetailModal.displayName = 'VehicleDetailModal';

const VehiclesTab = memo(() => {
  const dispatch = useDispatch();
  const { pendingVehicles, pendingVehiclesTotal, loading } = useSelector((s) => s.transportPartner);
  const [page, setPage]           = useState(1);
  const [reviewItem, setReviewItem] = useState(null);
  const LIMIT = 15;

  useEffect(() => { dispatch(adminFetchPendingVehicles({ page, limit: LIMIT })); }, [dispatch, page]);

  const handleVerify = useCallback(async (v, vForm) => {
    await dispatch(adminVerifyVehicle({
      vehicleId:          v._id,
      verificationStatus: vForm.verificationStatus,
      rejectionReason:    vForm.rejectionReason,
    }));
    setReviewItem(null);
  }, [dispatch]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={fadeUp} className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-base-content">Pending Vehicle Verifications</h3>
          <p className="text-xs text-base-content/50 mt-0.5">{pendingVehiclesTotal} vehicle(s) awaiting review</p>
        </div>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => dispatch(adminFetchPendingVehicles({ page, limit: LIMIT }))} aria-label="Refresh">
          <RefreshCw size={14} />
        </button>
      </motion.div>

      <motion.div variants={fadeUp} className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table" aria-label="Pending vehicles">
            <thead>
              <tr>
                <th>Agency / Owner</th>
                <th>Registration No.</th>
                <th>Type</th>
                <th>Make / Model</th>
                <th>Status</th>
                <th>Submitted</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && pendingVehicles.length === 0
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
                : pendingVehicles.length === 0
                  ? (
                    <tr>
                      <td colSpan={7} className="text-center py-14">
                        <Truck size={36} className="mx-auto mb-3 text-base-content/20" />
                        <p className="text-sm text-base-content/40">All vehicles reviewed. Nothing pending.</p>
                      </td>
                    </tr>
                  )
                  : pendingVehicles.map((v) => (
                    <tr key={v._id}>
                      <td>
                        <p className="font-semibold text-sm">{v.ownerId?.businessName || v.ownerId?.name || 'Unknown'}</p>
                        <p className="text-xs text-base-content/50">{v.ownerId?.ownerPhone || v.ownerId?.phone || '—'}</p>
                      </td>
                      <td className="font-mono text-sm font-bold tracking-wider">{v.registrationNumber}</td>
                      <td className="text-sm">{v.vehicleType}</td>
                      <td className="text-sm">{[v.make, v.model].filter(Boolean).join(' ') || '—'}</td>
                      <td>
                        <span className={`badge badge-xs ${v.verificationStatus === 'verified' ? 'badge-success' : v.verificationStatus === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                          {v.verificationStatus}
                        </span>
                      </td>
                      <td className="text-xs text-base-content/50">
                        {v.createdAt ? new Date(v.createdAt).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="text-right">
                        <button className="btn btn-primary btn-xs gap-1" onClick={() => setReviewItem(v)}>
                          <Eye size={11} /> Review
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={pendingVehiclesTotal} limit={LIMIT} onPageChange={setPage} />
      </motion.div>

      <VehicleDetailModal open={!!reviewItem} onClose={() => setReviewItem(null)} v={reviewItem} onVerify={handleVerify} />
    </motion.div>
  );
});
VehiclesTab.displayName = 'VehiclesTab';

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────

const DRIVER_SECTIONS = [
  { id: 'info',  label: 'Info',  icon: Info },
  { id: 'kyc',   label: 'KYC & Docs', icon: BadgeCheck },
  { id: 'block', label: 'Block', icon: Ban },
  { id: 'coins', label: 'Coins', icon: Coins },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'logs',  label: 'Logs',  icon: FileText },
];

const DriverDetailModal = memo(({ open, onClose, driverId }) => {
  const dispatch = useDispatch();
  const { adminDriverDetail: d, adminDriverLogs, loading } = useSelector((s) => s.transportPartner);
  const [sec, setSec]           = useState('info');
  const [kycForm, setKycForm]   = useState({ verificationStatus: '', rejectionReason: '' });
  const [blockReason, setBlockReason] = useState('');
  const [notes, setNotes]       = useState('');
  const [coinForm, setCoinForm] = useState({ type: 'ADMIN_CREDIT', amount: '', description: '' });

  useEffect(() => {
    if (!open || !driverId) return;
    dispatch(adminFetchDriverById(driverId));
    dispatch(adminFetchDriverLogs({ driverId }));
  }, [open, driverId, dispatch]);

  useEffect(() => {
    if (d) {
      setNotes(d.adminNotes ?? '');
      setKycForm((p) => ({ ...p, verificationStatus: d.kyc?.verificationStatus ?? '' }));
    }
  }, [d]);

  const kyc = d?.kyc ?? {};

  return (
    <Modal open={open} onClose={onClose} title={d?.legalName ?? 'Driver Details'} width="max-w-3xl">
      {!d && loading
        ? <div className="flex justify-center py-14"><Loader2 size={28} className="animate-spin text-primary" /></div>
        : !d ? null
          : (
            <>
              <SectionTabs sections={DRIVER_SECTIONS} active={sec} onChange={setSec} />

              {/* INFO */}
              {sec === 'info' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                  {[
                    ['Driver Code',   d.driverCode],
                    ['Legal Name',    d.legalName],
                    ['Phone',         d.phone     ?? '—'],
                    ['Email',         d.email     ?? '—'],
                    ['Gender',        d.gender    ?? '—'],
                    ['Date of Birth', d.dateOfBirth ? new Date(d.dateOfBirth).toLocaleDateString('en-IN') : '—'],
                    ['Agency',        d.ownerAgency?.businessName ?? '—'],
                    ['Vehicle',       d.assignedVehicleSnapshot?.registrationNumber ?? '—'],
                    ['Shift',         d.shift?.shiftType ?? '—'],
                    ['Experience',    d.yearsOfExperience ? `${d.yearsOfExperience} yrs` : '—'],
                    ['Current Status', d.status],
                    ['Active',        d.isActive  ? 'Yes' : 'No'],
                    ['Verified',      d.isVerified ? 'Yes' : 'No'],
                    ['Blocked',       d.isBlocked  ? 'Yes' : 'No'],
                    ['Rating',        `${d.performance?.rating?.toFixed(1) ?? 0} / 5`],
                    ['Total Rides',   d.performance?.totalRidesCompleted ?? 0],
                    ['Coin Balance',  `${inr(d.rewards?.coinBalance)} coins`],
                    ['Reward Tier',   d.rewards?.tier ?? '—'],
                    ['Profile Complete', `${d.profileCompletionPercent ?? 0}%`],
                    ['Blood Group',   d.medicalFitness?.bloodGroup ?? '—'],
                  ].map(([l, v]) => (
                    <div key={l} className="bg-base-200 rounded-lg p-3">
                      <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">{l}</p>
                      <p className="font-semibold text-base-content mt-0.5">{String(v)}</p>
                    </div>
                  ))}
                  <div className="bg-base-200 rounded-lg p-3">
                    <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">KYC Status</p>
                    <DriverKycBadge status={kyc.verificationStatus} className="mt-1.5" />
                  </div>
                </div>
              )}

              {/* KYC & DOCS */}
              {sec === 'kyc' && (
                <div className="space-y-5">
                  <CurrentValueRow label="Current KYC Status">
                    <DriverKycBadge status={kyc.verificationStatus} />
                    {kyc.isVerified && <span className="badge badge-success badge-xs ml-2">Verified ✓</span>}
                  </CurrentValueRow>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {[
                      ['DL Number',      kyc.drivingLicenceNumber ?? '—'],
                      ['DL Expiry',      kyc.drivingLicenceExpiry ? new Date(kyc.drivingLicenceExpiry).toLocaleDateString('en-IN') : '—'],
                      ['DL Classes',     kyc.licenceClass?.join(', ') || '—'],
                      ['PSV Badge',      kyc.psvBadgeNumber ?? '—'],
                      ['PSV Expiry',     kyc.psvBadgeExpiry ? new Date(kyc.psvBadgeExpiry).toLocaleDateString('en-IN') : '—'],
                      ['PAN Number',     kyc.panNumber ?? '—'],
                      ['Aadhaar Last4',  kyc.aadhaarLast4 ? `XXXX XXXX ${kyc.aadhaarLast4}` : '—'],
                      ['Submitted At',   kyc.submittedAt ? new Date(kyc.submittedAt).toLocaleDateString('en-IN') : '—'],
                      ['Verified At',    kyc.verifiedAt ? new Date(kyc.verifiedAt).toLocaleDateString('en-IN') : '—'],
                    ].map(([l, v]) => (
                      <div key={l} className="bg-base-200 rounded-lg p-2.5">
                        <p className="text-base-content/50 font-semibold uppercase tracking-wide text-[10px]">{l}</p>
                        <p className="font-semibold text-base-content mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Uploaded Documents</p>
                    <div className="flex flex-wrap gap-3">
                      <DocThumb url={kyc.aadhaarDocUrl}        label="Aadhaar" />
                      <DocThumb url={kyc.drivingLicenceDocUrl} label="Driving Licence" />
                      <DocThumb url={kyc.psvBadgeDocUrl}       label="PSV Badge" />
                      <DocThumb url={kyc.panDocUrl}            label="PAN Card" />
                      {d.photoUrl && <DocThumb url={d.photoUrl} label="Driver Photo" />}
                    </div>
                  </div>

                  {d.medicalFitness?.documentUrl && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Medical Fitness</p>
                      <div className="flex flex-wrap gap-3">
                        <DocThumb url={d.medicalFitness.documentUrl} label="Fitness Certificate" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 text-xs">
                        {[
                          ['Cert No.', d.medicalFitness.certificateNumber ?? '—'],
                          ['Blood Group', d.medicalFitness.bloodGroup ?? '—'],
                          ['Expiry', d.medicalFitness.expiryDate ? new Date(d.medicalFitness.expiryDate).toLocaleDateString('en-IN') : '—'],
                        ].map(([l, v]) => (
                          <div key={l} className="bg-base-200 rounded-lg p-2.5">
                            <p className="text-base-content/50 font-semibold uppercase tracking-wide text-[10px]">{l}</p>
                            <p className="font-semibold text-base-content mt-0.5">{v}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-base-300 pt-4 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Update KYC Decision</p>
                    {kyc.rejectionReason && (
                      <div className="alert alert-error text-xs py-2">
                        <AlertTriangle size={12} />
                        <span>Previous rejection: {kyc.rejectionReason}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FieldNote label="KYC Verification Decision" note="'Verified' sets isVerified=true and activates driver account">
                        <select className="input-field w-full" value={kycForm.verificationStatus} onChange={(e) => setKycForm((p) => ({ ...p, verificationStatus: e.target.value }))}>
                          <option value="">— Select decision —</option>
                          {DRIVER_KYC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </FieldNote>
                      <FieldNote label="Rejection Reason" note="Required when rejecting — driver will see this in-app">
                        <input className="input-field w-full" value={kycForm.rejectionReason} onChange={(e) => setKycForm((p) => ({ ...p, rejectionReason: e.target.value }))} placeholder="DL expired, photo mismatch..." />
                      </FieldNote>
                    </div>
                    <div className="flex justify-end">
                      <button className="btn btn-primary btn-sm" onClick={() => dispatch(adminVerifyDriverKyc({ driverId, ...kycForm }))} disabled={loading || !kycForm.verificationStatus}>
                        {loading ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
                        Submit KYC Decision
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* BLOCK */}
              {sec === 'block' && (
                <div className="space-y-4">
                  <CurrentValueRow label="Block Status">
                    {d.isBlocked
                      ? <span className="badge badge-error">Blocked</span>
                      : <span className="badge badge-success">Active / Clear</span>}
                  </CurrentValueRow>

                  {d.isBlocked && (
                    <div className="bg-error/10 border border-error/30 rounded-lg p-4 text-sm space-y-1">
                      <div className="flex items-center gap-2 text-error font-bold">
                        <ShieldX size={15} />
                        <span>Driver is currently BLOCKED</span>
                      </div>
                      {d.blockReason && (
                        <p className="text-base-content/70 pl-5">
                          <strong>Reason:</strong> {d.blockReason}
                        </p>
                      )}
                    </div>
                  )}

                  {!d.isBlocked && (
                    <>
                      <div className="alert alert-warning text-sm">
                        <AlertTriangle size={15} />
                        <span>Blocking will suspend driver's ability to receive trips. All active trips will be flagged.</span>
                      </div>
                      <FieldNote label="Block Reason" note="Mandatory — stored in audit log and shown to driver" required>
                        <textarea className="input-field w-full min-h-[90px]" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Policy violation, trip fraud, unsafe driving..." />
                      </FieldNote>
                    </>
                  )}

                  <div className="flex justify-end">
                    {d.isBlocked
                      ? (
                        <button className="btn btn-success btn-sm gap-1" onClick={() => dispatch(adminUnblockDriver(driverId))} disabled={loading}>
                          {loading ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                          Unblock Driver
                        </button>
                      ) : (
                        <button className="btn btn-error btn-sm gap-1" onClick={() => dispatch(adminBlockDriver({ driverId, blockReason }))} disabled={loading || !blockReason}>
                          {loading ? <Loader2 size={13} className="animate-spin" /> : <Lock size={13} />}
                          Block Driver
                        </button>
                      )
                    }
                  </div>
                </div>
              )}

              {/* COINS */}
              {sec === 'coins' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-accent/10 border border-accent/30 rounded-xl p-4 text-center">
                      <p className="text-xs text-accent font-semibold uppercase tracking-wide">Coin Balance</p>
                      <p className="text-3xl font-black text-accent mt-1">{inr(d.rewards?.coinBalance)}</p>
                    </div>
                    <div className="bg-base-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">Total Earned</p>
                      <p className="text-2xl font-black text-base-content mt-1">{inr(d.rewards?.totalCoinsEarned)}</p>
                    </div>
                    <div className="bg-base-200 rounded-xl p-4 text-center">
                      <p className="text-xs text-base-content/50 font-semibold uppercase tracking-wide">Total Redeemed</p>
                      <p className="text-2xl font-black text-base-content mt-1">{inr(d.rewards?.totalCoinsRedeemed)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-base-content/40 text-center">Reward Tier: <strong>{d.rewards?.tier ?? '—'}</strong></p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FieldNote label="Transaction Type" note="CREDIT adds; DEBIT subtracts">
                      <select className="input-field w-full" value={coinForm.type} onChange={(e) => setCoinForm((p) => ({ ...p, type: e.target.value }))}>
                        <option value="ADMIN_CREDIT">Admin Credit (+)</option>
                        <option value="ADMIN_DEBIT">Admin Debit (−)</option>
                      </select>
                    </FieldNote>
                    <FieldNote label="Amount (coins)" note="Positive integer">
                      <input className="input-field w-full" type="number" min={1} value={coinForm.amount} onChange={(e) => setCoinForm((p) => ({ ...p, amount: e.target.value }))} placeholder="e.g. 500" />
                    </FieldNote>
                    <FieldNote label="Description" note="Shown in driver's coin history">
                      <input className="input-field w-full" value={coinForm.description} onChange={(e) => setCoinForm((p) => ({ ...p, description: e.target.value }))} placeholder="Performance bonus, correction..." />
                    </FieldNote>
                  </div>
                  <div className="flex justify-end">
                    <button className="btn btn-primary btn-sm" onClick={() => dispatch(adminAdjustDriverCoins({ driverId, ...coinForm, amount: +coinForm.amount }))} disabled={loading || !coinForm.amount || +coinForm.amount <= 0}>
                      {loading ? <Loader2 size={13} className="animate-spin" /> : <Coins size={13} />}
                      Apply Adjustment
                    </button>
                  </div>
                </div>
              )}

              {/* NOTES */}
              {sec === 'notes' && (
                <div className="space-y-3">
                  <FieldNote label="Admin-Only Notes" note="Never visible to driver">
                    <textarea className="input-field w-full min-h-[120px] resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Incident reports, fraud flags, warnings issued..." maxLength={1000} />
                  </FieldNote>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-base-content/40">{notes.length}/1000</p>
                    <button className="btn btn-primary btn-sm" onClick={() => dispatch(adminUpdateDriverNotes({ driverId, notes }))} disabled={loading}>
                      <StickyNote size={13} /> Save Notes
                    </button>
                  </div>
                </div>
              )}

              {/* LOGS */}
              {sec === 'logs' && (
                <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                  {(adminDriverLogs ?? []).length === 0
                    ? <p className="text-center text-base-content/40 py-10 text-sm">No logs yet.</p>
                    : (adminDriverLogs ?? []).map((log) => (
                      <div key={log._id} className="bg-base-200 rounded-lg p-3 text-xs flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`badge badge-xs ${log.level === 'error' ? 'badge-error' : log.level === 'success' ? 'badge-success' : log.level === 'warning' ? 'badge-warning' : 'badge-info'}`}>{log.level}</span>
                          <span className="text-base-content/40">{new Date(log.createdAt).toLocaleString('en-IN')}</span>
                        </div>
                        <p className="text-base-content leading-snug">{log.message}</p>
                      </div>
                    ))
                  }
                </div>
              )}
            </>
          )
      }
    </Modal>
  );
});
DriverDetailModal.displayName = 'DriverDetailModal';

// ─────────────────────────────────────────────────────────────────────────────
// DRIVERS TAB
// ─────────────────────────────────────────────────────────────────────────────

const DriversTab = memo(() => {
  const dispatch = useDispatch();
  const { adminDrivers, adminDriversTotal, adminAvailableDrivers, loading } = useSelector((s) => s.transportPartner);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [kycStatus, setKycStatus] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [showGeo, setShowGeo] = useState(false);
  const [geo, setGeo]         = useState({ lng: '', lat: '', radius: '10000' });
  const LIMIT = 15;

  const params = useMemo(() => ({
    page, limit: LIMIT,
    ...(search    && { search }),
    ...(status    && { status }),
    ...(kycStatus && { kycStatus }),
  }), [page, search, status, kycStatus]);

  useEffect(() => { dispatch(adminFetchAllDrivers(params)); }, [dispatch, params]);

  const handleGeoSearch = useCallback(() => {
    if (!geo.lng || !geo.lat) return;
    dispatch(adminFetchAvailableDrivers({ lng: +geo.lng, lat: +geo.lat, radius: +geo.radius }));
  }, [dispatch, geo]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
            <input className="input-field pl-8 pr-3 py-2 text-sm w-48" placeholder="Search drivers..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search drivers" />
          </div>
          <select className="input-field py-2 text-sm" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            {['Available', 'On-Trip', 'Offline', 'On-Break', 'Suspended'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input-field py-2 text-sm" value={kycStatus} onChange={(e) => { setKycStatus(e.target.value); setPage(1); }}>
            <option value="">All KYC</option>
            {DRIVER_KYC_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={() => dispatch(adminFetchAllDrivers(params))} aria-label="Refresh"><RefreshCw size={14} /></button>
        </div>
        <button className="btn btn-outline btn-sm gap-1.5 shrink-0" onClick={() => setShowGeo((v) => !v)}>
          <MapPin size={13} /> Geo Search
        </button>
      </motion.div>

      <AnimatePresence>
        {showGeo && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" exit="hidden" className="card p-4 space-y-3">
            <p className="text-sm font-bold text-base-content">Find Available Drivers by Location</p>
            <div className="flex flex-wrap gap-3 items-end">
              <FieldNote label="Longitude" note="e.g. 80.648 (Vijayawada)">
                <input className="input-field w-36" value={geo.lng} onChange={(e) => setGeo((p) => ({ ...p, lng: e.target.value }))} placeholder="80.648" />
              </FieldNote>
              <FieldNote label="Latitude" note="e.g. 16.506">
                <input className="input-field w-36" value={geo.lat} onChange={(e) => setGeo((p) => ({ ...p, lat: e.target.value }))} placeholder="16.506" />
              </FieldNote>
              <FieldNote label="Radius (metres)" note="Default 10km">
                <input className="input-field w-32" value={geo.radius} onChange={(e) => setGeo((p) => ({ ...p, radius: e.target.value }))} placeholder="10000" />
              </FieldNote>
              <button className="btn btn-primary btn-sm" onClick={handleGeoSearch} disabled={!geo.lng || !geo.lat}>
                <Search size={13} /> Find
              </button>
            </div>
            {adminAvailableDrivers.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {adminAvailableDrivers.map((dr) => (
                  <div key={dr._id} className="bg-success/10 border border-success/30 rounded-lg px-3 py-2 text-xs">
                    <p className="font-semibold text-base-content">{dr.legalName}</p>
                    <p className="text-base-content/50 font-mono">{dr.driverCode}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={fadeUp} className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table" aria-label="Drivers list">
            <thead>
              <tr>
                <th>Driver</th>
                <th>Agency</th>
                <th>Status</th>
                <th>KYC</th>
                <th>Block</th>
                <th>Rating</th>
                <th className="text-center">Coins</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && adminDrivers.length === 0
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
                : adminDrivers.length === 0
                  ? (
                    <tr>
                      <td colSpan={8} className="text-center py-14">
                        <Users size={36} className="mx-auto mb-3 text-base-content/20" />
                        <p className="text-sm text-base-content/40">No drivers found.</p>
                      </td>
                    </tr>
                  )
                  : adminDrivers.map((dr) => (
                    <tr key={dr._id}>
                      <td>
                        <p className="font-semibold text-sm text-base-content">{dr.legalName}</p>
                        <p className="text-xs text-base-content/50 font-mono">{dr.driverCode}</p>
                      </td>
                      <td className="text-sm">{dr.ownerAgency?.businessName ?? '—'}</td>
                      <td>
                        <span className={`badge badge-xs ${dr.status === 'Available' ? 'badge-success' : dr.status === 'On-Trip' ? 'badge-info' : dr.status === 'Suspended' ? 'badge-error' : ''}`}>
                          {dr.status}
                        </span>
                      </td>
                      <td><DriverKycBadge status={dr.kyc?.verificationStatus} /></td>
                      <td>
                        {dr.isBlocked
                          ? <span className="badge badge-error badge-xs">Blocked</span>
                          : <span className="badge badge-success badge-xs">Clear</span>}
                      </td>
                      <td className="text-sm">
                        <span className="flex items-center gap-1">
                          <Star size={11} className="text-warning fill-warning" />
                          {dr.performance?.rating?.toFixed(1) ?? '—'}
                        </span>
                      </td>
                      <td className="text-sm text-center">{inr(dr.rewards?.coinBalance)}</td>
                      <td className="text-right">
                        <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setDetailId(dr._id)} aria-label={`View ${dr.legalName}`}>
                          <Eye size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={adminDriversTotal} limit={LIMIT} onPageChange={setPage} />
      </motion.div>

      <DriverDetailModal open={!!detailId} onClose={() => setDetailId(null)} driverId={detailId} />
    </motion.div>
  );
});
DriversTab.displayName = 'DriversTab';

// ─────────────────────────────────────────────────────────────────────────────
// PRICING TAB
// ─────────────────────────────────────────────────────────────────────────────

const PRICING_FIELDS = [
  { key: 'platformFee',           label: 'Platform Fee (%)',       note: 'Default % deducted from partner earnings per completed ride' },
  { key: 'baseFare',              label: 'Base Fare (₹)',          note: 'Flat amount charged for any ride regardless of distance' },
  { key: 'baseFarePerKm',         label: 'Fare Per KM (₹)',        note: 'Additional amount charged per kilometre' },
  { key: 'minimumFare',           label: 'Minimum Fare (₹)',       note: 'Floor price — rider always pays at least this' },
  { key: 'waitingChargePerMin',   label: 'Waiting Charge/Min (₹)', note: 'Rate applied after free waiting window expires' },
  { key: 'freeWaitingMinutes',    label: 'Free Waiting (min)',     note: 'Grace period before waiting charges begin' },
  { key: 'nightSurchargePercent', label: 'Night Surcharge (%)',    note: 'Extra percentage added during night hours' },
];

const PricingTab = memo(() => {
  const dispatch = useDispatch();
  const { globalPricing, loading } = useSelector((s) => s.transportPartner);
  const [form, setForm] = useState({});
  const [note, setNote] = useState('');

  useEffect(() => { dispatch(adminFetchGlobalPricing()); }, [dispatch]);
  useEffect(() => { if (globalPricing) setForm({ ...globalPricing }); }, [globalPricing]);

  const set = useCallback((k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value === '' ? '' : +e.target.value })), []);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeUp} className="card p-6 space-y-6">
        <div className="flex items-start gap-4">
          <Globe size={18} className="text-primary mt-0.5" />
          <div>
            <h3 className="font-bold text-base-content">Global Transport Pricing</h3>
            <p className="text-xs text-base-content/50 mt-0.5">Platform-wide defaults — individual partners may override via Partner Detail → Platform Fee.</p>
          </div>
        </div>

        {!globalPricing && loading
          ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRICING_FIELDS.map((_, i) => <div key={i} className="skeleton h-20 rounded-lg animate-pulse bg-base-300" />)}
            </div>
          )
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRICING_FIELDS.map(({ key, label, note: fieldNote }) => (
                <FieldNote key={key} label={label} note={fieldNote}>
                  <input className="input-field w-full" type="number" value={form[key] ?? ''} onChange={set(key)} min={0} step="0.01" placeholder="0" />
                </FieldNote>
              ))}
            </div>
          )
        }

        <div className="space-y-3 pt-2 border-t border-base-300">
          <FieldNote label="Change Audit Note" note="Reason for this pricing update — stored in audit log">
            <input className="input-field w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Q2 2025 pricing review — adjusted base fare..." />
          </FieldNote>
          <div className="flex justify-end">
            <button className="btn btn-primary btn-sm" onClick={() => dispatch(adminUpdateGlobalPricing({ ...form, note: note || undefined }))} disabled={loading || !globalPricing}>
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Save Global Pricing
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="alert alert-info text-sm">
        <Info size={15} />
        <div>
          <p className="font-semibold">Per-Partner Fee Overrides</p>
          <p className="text-base-content/70 text-xs mt-0.5">To apply a custom platform fee, go to Partners → View Partner → Platform Fee tab.</p>
        </div>
      </motion.div>
    </motion.div>
  );
});
PricingTab.displayName = 'PricingTab';

// ─────────────────────────────────────────────────────────────────────────────
// LOGS TAB
// ─────────────────────────────────────────────────────────────────────────────

const LEVEL_BADGE = { error: 'badge-error', warning: 'badge-warning', success: 'badge-success', info: 'badge-info' };

const LogsTab = memo(() => {
  const dispatch = useDispatch();
  const { adminLogs, adminLogsTotal, loading } = useSelector((s) => s.transportPartner);
  const [page, setPage]         = useState(1);
  const [level, setLevel]       = useState('');
  const [category, setCategory] = useState('');
  const LIMIT = 20;

  const params = useMemo(() => ({ page, limit: LIMIT, ...(level && { level }), ...(category && { category }) }), [page, level, category]);
  useEffect(() => { dispatch(adminFetchTransportLogs(params)); }, [dispatch, params]);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={fadeUp} className="flex flex-wrap gap-2 items-center">
        <select className="input-field py-2 text-sm" value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
          <option value="">All Levels</option>
          {['info', 'success', 'warning', 'error'].map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="input-field py-2 text-sm" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {['user', 'kyc', 'security', 'system', 'payment'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => dispatch(adminFetchTransportLogs(params))} aria-label="Refresh logs"><RefreshCw size={14} /></button>
        <span className="text-xs text-base-content/40 ml-auto">{(adminLogsTotal ?? 0).toLocaleString('en-IN')} total entries</span>
      </motion.div>

      <motion.div variants={fadeUp} className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table" aria-label="System logs">
            <thead>
              <tr>
                <th className="w-40">Timestamp</th>
                <th className="w-20">Level</th>
                <th className="w-24">Category</th>
                <th>Actor</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {loading && (adminLogs ?? []).length === 0
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
                : (adminLogs ?? []).length === 0
                  ? (
                    <tr>
                      <td colSpan={5} className="text-center py-14">
                        <FileText size={36} className="mx-auto mb-3 text-base-content/20" />
                        <p className="text-sm text-base-content/40">No logs match the current filters.</p>
                      </td>
                    </tr>
                  )
                  : (adminLogs ?? []).map((log) => (
                    <tr key={log._id}>
                      <td className="text-xs text-base-content/50 whitespace-nowrap font-mono">
                        {new Date(log.createdAt).toLocaleString('en-IN', { hour12: false, dateStyle: 'short', timeStyle: 'medium' })}
                      </td>
                      <td><span className={`badge badge-xs ${LEVEL_BADGE[log.level] ?? ''}`}>{log.level}</span></td>
                      <td><span className="badge badge-xs">{log.category}</span></td>
                      <td className="text-xs text-base-content/70">{log.actor?.name ?? '—'}</td>
                      <td className="text-sm max-w-xs" title={log.message}><p className="truncate">{log.message}</p></td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={adminLogsTotal ?? 0} limit={LIMIT} onPageChange={setPage} />
      </motion.div>
    </motion.div>
  );
});
LogsTab.displayName = 'LogsTab';

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function TransportPartnersManagement() {
  const [activeTab, setActiveTab] = useState('overview');

  const renderTab = useMemo(() => {
    switch (activeTab) {
      case 'overview': return <OverviewTab />;
      case 'partners': return <PartnersTab />;
      case 'vehicles': return <VehiclesTab />;
      case 'drivers':  return <DriversTab />;
      case 'pricing':  return <PricingTab />;
      case 'logs':     return <LogsTab />;
      default:         return null;
    }
  }, [activeTab]);

  return (
    <main className="min-h-screen bg-base-100" data-theme="admin">
      <header className="sticky top-0 z-30 bg-base-100/95 border-b border-base-300" style={{ backdropFilter: 'blur(12px)' }}>
        <div className="container-custom">
          <div className="flex items-center justify-between py-4 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Truck size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-black text-base-content leading-tight">Transport Management</h1>
                <p className="text-xs text-base-content/50">Superadmin — Partners · Vehicles · Drivers · Pricing</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge badge-primary text-xs">Superadmin</span>
              <span className="flex items-center gap-1 text-xs text-base-content/40">
                <span className="status-dot status-dot-success" aria-hidden="true" />
                Live
              </span>
            </div>
          </div>

          <nav className="flex gap-0.5 overflow-x-auto scrollbar-thin pb-0" role="tablist" aria-label="Management sections">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} role="tab" aria-selected={activeTab === id}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${activeTab === id ? 'border-primary text-primary' : 'border-transparent text-base-content/55 hover:text-base-content hover:border-base-300'}`}
                onClick={() => setActiveTab(id)}>
                <Icon size={14} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <section className="container-custom py-6">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} variants={slideIn} initial="hidden" animate="visible" exit="exit" role="tabpanel" aria-label={`${activeTab} panel`}>
            {renderTab}
          </motion.div>
        </AnimatePresence>
      </section>
    </main>
  );
}