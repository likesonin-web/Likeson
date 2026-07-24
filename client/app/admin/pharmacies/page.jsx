'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Shield,
  MapPin,
  Phone,
  Mail,
  Clock,
  Package,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Building2,
  Truck,
  Layers,
  Users,
  CheckCheck,
  X,
  Upload,
  ChevronLeft,
  LayoutGrid,
  List,
  UserPlus,
  BadgeCheck,
  Hash,
  AtSign,
  FileText,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import {
  fetchAllStores,
  createPharmacyStore,
  verifyPharmacyStore,
  resetPharmacyStatus,
} from '@/store/slices/pharmacySlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';

// ─── Animation Variants ───────────────────────────────────────────────────────
// NOTE: Every variant object used with `variants` prop MUST define all keys
// referenced via `initial`, `animate`, and `exit` props on motion components.
// Missing keys cause framer-motion to silently skip the animation entirely.

const fadeUp = {
  initial:    { opacity: 0, y: 20 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -10 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
};

/** Parent stagger container — MUST include `initial` so children can resolve it */
const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

/** Individual card variant — used as child of staggerContainer */
const cardVariant = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
  exit:    { opacity: 0, y: -8, scale: 0.97 },
};

const modalVariant = {
  initial: { opacity: 0, scale: 0.95, y: 16 },
  animate: { opacity: 1, scale: 1, y: 0,
    transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  },
  exit:    { opacity: 0, scale: 0.95, y: 16,
    transition: { duration: 0.2 },
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIALIZATIONS = ['Generic', 'Ayurvedic', 'Critical Care', 'Homeopathy', 'Surgical Supplies'];
const STATUS_OPTIONS   = ['Open', 'Closed', 'Under-Maintenance', 'Inactive'];
const TYPE_OPTIONS     = ['Owned', 'Partnered'];
const PRIORITY_OPTIONS = ['High', 'Medium', 'Low'];

/**
 * Initial form shape — exactly matches POST /api/v1/pharmacy/stores payload:
 * { name, email, phone, storeData }
 * The server atomically creates: User (role=pharmacy) + PharmacyStore + PharmacyProfile
 */
const INITIAL_FORM = {
  name:  '',
  email: '',
  phone: '',
  storeData: {
    storeName:        '',
    storeType:        'Owned',
    priority:         'Medium',
    status:           'Open',
    contact:          { email: '', phone: '', alternatePhone: '' },
    address:          { line1: '', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '' },
    legal:            { dlNumber: '', gstNumber: '', licenseExpiry: '', documentUrl: '' },
    deliverySettings: { canDeliver: true, deliveryRadiusKm: 5, estimatedDeliveryTime: '2 Hours' },
    specializations:  [],
    timings:          [],
  },
};

// ─── Pure Helpers ─────────────────────────────────────────────────────────────

/**
 * Safely extracts manager display fields.
 * After createPharmacyStore, `managedBy` is a raw ObjectId string.
 * After fetchAllStores with `.populate()`, it's a full object.
 */
const getManagerInfo = (managedBy) => {
  if (!managedBy) return null;
  if (typeof managedBy === 'string') {
    return { name: 'Manager Assigned', email: null, phone: null, avatar: null };
  }
  return {
    name:   managedBy.name   ?? 'Manager Assigned',
    email:  managedBy.email  ?? null,
    phone:  managedBy.phone  ?? null,
    avatar: managedBy.avatar ?? null,
  };
};

/** Format ISO → readable local date string */
const fmtDate = (iso) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return null; }
};

// ─── StoreSkeleton ────────────────────────────────────────────────────────────

const StoreSkeleton = memo(() => (
  <div className="card p-5 space-y-4 overflow-hidden">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
        <div className="space-y-2 flex-1">
          <div className="skeleton h-4 w-36 rounded" />
          <div className="skeleton h-3 w-20 rounded" />
        </div>
      </div>
      <div className="skeleton h-6 w-14 rounded-full shrink-0" />
    </div>
    <div className="skeleton h-px w-full" />
    <div className="grid grid-cols-2 gap-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton h-3 rounded" />
      ))}
    </div>
    <div className="flex gap-2 pt-1">
      <div className="skeleton h-8 w-28 rounded-lg" />
      <div className="skeleton h-8 w-20 rounded-lg" />
    </div>
  </div>
));
StoreSkeleton.displayName = 'StoreSkeleton';

// ─── EmptyState ───────────────────────────────────────────────────────────────

const EmptyState = memo(({ onAdd }) => (
  <div className="col-span-full flex flex-col items-center justify-center py-24 px-6 text-center">
    <motion.div {...fadeUp}>
      <div className="relative mb-6 inline-block">
        <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center">
          <Store className="w-10 h-10 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-primary/20 border-2 border-base-100 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
      <h3 className="text-xl font-black text-base-content mb-2 tracking-tight">
        No Pharmacy Stores Yet
      </h3>
      <p className="text-sm text-base-content/55 max-w-xs mb-8 leading-relaxed mx-auto">
        Register your first pharmacy store. A manager account and profile are
        provisioned automatically.
      </p>
      <button
        onClick={onAdd}
        className="btn-primary-cta flex items-center gap-2 text-sm mx-auto"
      >
        <Plus className="w-4 h-4" />
        Create First Store
      </button>
    </motion.div>
  </div>
));
EmptyState.displayName = 'EmptyState';

// ─── StatusBadge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  Open:                { cls: 'badge-success', Icon: CheckCircle2 },
  Closed:              { cls: 'badge-error',   Icon: XCircle      },
  'Under-Maintenance': { cls: 'badge-warning', Icon: AlertTriangle },
  Inactive:            { cls: 'badge',         Icon: XCircle      },
};

const StatusBadge = memo(({ status }) => {
  const { cls, Icon } = STATUS_CONFIG[status] ?? STATUS_CONFIG.Inactive;
  return (
    <span className={`badge ${cls} inline-flex items-center gap-1 shrink-0`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

// ─── PriorityDot ──────────────────────────────────────────────────────────────

const PRIORITY_COLOR = { High: 'text-error', Medium: 'text-warning', Low: 'text-success' };

const PriorityBadge = memo(({ priority }) => (
  <span className={`text-[11px] font-bold ${PRIORITY_COLOR[priority] ?? 'text-base-content/50'}`}>
    {priority}
  </span>
));
PriorityBadge.displayName = 'PriorityBadge';

// ─── StoreCard ────────────────────────────────────────────────────────────────

const StoreCard = memo(({ store, onVerify, isVerifying }) => {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const handleVerify = useCallback(
    (e) => { e.stopPropagation(); onVerify(store._id); },
    [onVerify, store._id]
  );

  // Safely destructure — API response guarantees these exist but guard anyway
  const contact  = store.contact          ?? {};
  const address  = store.address          ?? {};
  const delivery = store.deliverySettings ?? {};
  const legal    = store.legal            ?? {};
  const manager  = useMemo(() => getManagerInfo(store.managedBy), [store.managedBy]);
  const licenseExpiryFmt = useMemo(() => fmtDate(legal.licenseExpiry), [legal.licenseExpiry]);
  const createdAtFmt     = useMemo(() => fmtDate(store.createdAt),     [store.createdAt]);

  return (
    <motion.article
      variants={cardVariant}
      layout
      className="glass-card overflow-hidden flex flex-col min-h-0"
      aria-label={`Pharmacy: ${store.storeName}`}
    >
      {/* ── Clickable summary header ── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle()}
        className="p-5 cursor-pointer select-none"
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black text-[15px] text-base-content truncate leading-snug">
                {store.storeName}
              </h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={`badge text-[10px] py-0.5 px-2 ${
                    store.storeType === 'Owned' ? 'badge-primary' : 'badge-info'
                  }`}
                >
                  {store.storeType}
                </span>
                {store.priority && <PriorityBadge priority={store.priority} />}
                {store.isVerified && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-success">
                    <BadgeCheck className="w-3 h-3" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <StatusBadge status={store.status} />
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-base-content/40 flex items-center"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.span>
          </div>
        </div>

        {/* Always-visible info grid */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-3">
          {(address.city || address.pincode) && (
            <div className="flex items-center gap-1.5 min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/50" />
              <dd className="text-xs text-base-content/65 truncate">
                {[address.line1, address.city, address.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </dd>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Phone className="w-3.5 h-3.5 shrink-0 text-primary/50" />
              <dd className="text-xs text-base-content/65 truncate">{contact.phone}</dd>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Mail className="w-3.5 h-3.5 shrink-0 text-primary/50" />
              <dd className="text-xs text-base-content/65 truncate">{contact.email}</dd>
            </div>
          )}
          {(delivery.deliveryRadiusKm != null || delivery.estimatedDeliveryTime) && (
            <div className="flex items-center gap-1.5 min-w-0">
              <Truck className="w-3.5 h-3.5 shrink-0 text-primary/50" />
              <dd className="text-xs text-base-content/65">
                {delivery.deliveryRadiusKm != null
                  ? `${delivery.deliveryRadiusKm} km`
                  : ''}
                {delivery.estimatedDeliveryTime
                  ? ` · ${delivery.estimatedDeliveryTime}`
                  : ''}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* ── Expandable detail panel ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1,
              transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ height: 0, opacity: 0,
              transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } }}
            className="overflow-hidden"
          >
            <div className="divider my-0" />
            <div className="px-5 pt-4 pb-4 space-y-3">

              {/* Manager */}
              {manager && (
                <div className="flex items-start gap-2.5">
                  {manager.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={manager.avatar}
                      alt={manager.name}
                      className="w-8 h-8 rounded-full object-cover shrink-0 border border-base-300"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-secondary/15 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4 text-secondary" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-base-content leading-none">
                      {manager.name}
                    </p>
                    {manager.email && (
                      <p className="text-xs text-base-content/55 truncate mt-0.5">
                        {manager.email}
                      </p>
                    )}
                    {manager.phone && (
                      <p className="text-xs text-base-content/50 mt-0.5">{manager.phone}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Delivery */}
              <div className="flex items-center gap-2 text-xs text-base-content/65">
                <Package className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>
                  Home Delivery:{' '}
                  <strong className="text-base-content">
                    {delivery.canDeliver ? 'Enabled' : 'Disabled'}
                  </strong>
                </span>
              </div>

              {/* Specializations */}
              {store.specializations?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mb-1.5">
                    Specializations
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {store.specializations.map((s) => (
                      <span key={s} className="badge badge-primary text-[10px] gap-1">
                        <Layers className="w-2.5 h-2.5" />{s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Legal */}
              <div className="space-y-1.5">
                {legal.dlNumber && (
                  <div className="flex items-center gap-2 text-xs text-base-content/65">
                    <Hash className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                    <span>DL: <strong className="text-base-content font-mono">{legal.dlNumber}</strong></span>
                  </div>
                )}
                {legal.gstNumber && (
                  <div className="flex items-center gap-2 text-xs text-base-content/65">
                    <Hash className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                    <span>GST: <strong className="text-base-content font-mono">{legal.gstNumber}</strong></span>
                  </div>
                )}
                {licenseExpiryFmt && (
                  <div className="flex items-center gap-2 text-xs text-base-content/65">
                    <Calendar className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                    <span>Expires: <strong className="text-base-content">{licenseExpiryFmt}</strong></span>
                  </div>
                )}
                {legal.documentUrl && (
                  <a
                    href={legal.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline mt-0.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    View License Document
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* Timings */}
              {store.timings?.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-base-content/65">
                  <Clock className="w-3.5 h-3.5 text-primary/50 shrink-0" />
                  <span>{store.timings.length} day(s) schedule configured</span>
                </div>
              )}

              {/* Footer meta */}
              {createdAtFmt && (
                <p className="text-[10px] text-base-content/30 pt-1 border-t border-base-300">
                  Registered {createdAtFmt} · ID: <span className="font-mono">{store._id?.slice(-8)}</span>
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action footer ── */}
      <div className="mt-auto px-5 py-3 border-t border-base-300 flex items-center gap-3">
        {store.isVerified ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-success">
            <CheckCheck className="w-4 h-4" />
            Verified
          </span>
        ) : (
          <button
            onClick={handleVerify}
            disabled={isVerifying}
            aria-label={`Verify ${store.storeName}`}
            className="btn-primary-cta text-xs px-4 py-2 inline-flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isVerifying
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Shield className="w-3.5 h-3.5" />}
            {isVerifying ? 'Verifying…' : 'Verify Store'}
          </button>
        )}

        <span
          className="ml-auto text-[10px] font-mono text-base-content/25 truncate max-w-[100px]"
          title={store._id}
        >
          …{store._id?.slice(-8)}
        </span>
      </div>
    </motion.article>
  );
});
StoreCard.displayName = 'StoreCard';

// ─── StatsBar ─────────────────────────────────────────────────────────────────

const StatsBar = memo(({ stores, total }) => {
  const computed = useMemo(() => ({
    open:     stores.filter((s) => s.status === 'Open').length,
    verified: stores.filter((s) => s.isVerified).length,
    owned:    stores.filter((s) => s.storeType === 'Owned').length,
  }), [stores]);

  const stats = [
    { label: 'Total Stores', value: total ?? stores.length, Icon: Store,        color: 'text-primary',   bg: 'bg-primary/10'   },
    { label: 'Open Now',     value: computed.open,          Icon: CheckCircle2,  color: 'text-success',   bg: 'bg-success/10'   },
    { label: 'Verified',     value: computed.verified,      Icon: Shield,        color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Owned',        value: computed.owned,         Icon: Building2,     color: 'text-accent',    bg: 'bg-accent/10'    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {stats.map(({ label, value, Icon, color, bg }, i) => (
        <motion.div
          key={label}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.3 }}
          className="card p-4 flex items-center gap-3"
        >
          <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
          <div>
            <p className="text-2xl font-black text-base-content leading-none">{value ?? 0}</p>
            <p className="text-[11px] text-base-content/50 mt-0.5">{label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
});
StatsBar.displayName = 'StatsBar';

// ─── FilterBar ────────────────────────────────────────────────────────────────

const FilterBar = memo(({ filters, onChange, total }) => (
  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
    {/* Search — debounced, sent to server via fetchAllStores({ search }) */}
    <div className="relative flex-1 min-w-0 sm:max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
      <input
        type="search"
        value={filters.search}
        onChange={(e) => onChange({ search: e.target.value })}
        placeholder="Search by store name…"
        aria-label="Search pharmacy stores"
        className="input-field w-full pl-9 h-10 text-sm"
      />
    </div>

    {/* Status */}
    <div className="relative shrink-0">
      <select
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value })}
        aria-label="Filter by status"
        className="input-field h-10 text-sm pr-8 appearance-none cursor-pointer"
      >
        <option value="">All Statuses</option>
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
    </div>

    {/* Type */}
    <div className="relative shrink-0">
      <select
        value={filters.storeType}
        onChange={(e) => onChange({ storeType: e.target.value })}
        aria-label="Filter by store type"
        className="input-field h-10 text-sm pr-8 appearance-none cursor-pointer"
      >
        <option value="">All Types</option>
        {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40 pointer-events-none" />
    </div>

    <p className="hidden sm:block text-sm text-base-content/50 whitespace-nowrap ml-auto">
      <strong className="text-base-content">{total ?? 0}</strong> stores
    </p>
  </div>
));
FilterBar.displayName = 'FilterBar';

// ─── FormField ────────────────────────────────────────────────────────────────

const FormField = memo(({ label, required, hint, children }) => (
  <div className="space-y-1">
    <div className="flex items-baseline justify-between">
      <label className="text-sm font-semibold text-base-content">
        {label}
        {required && <span className="text-error text-xs ml-0.5">*</span>}
      </label>
      {hint && (
        <span className="text-xs text-base-content/40 font-normal">{hint}</span>
      )}
    </div>
    {children}
  </div>
));
FormField.displayName = 'FormField';

// ─── CreateStoreModal ─────────────────────────────────────────────────────────

const TOTAL_STEPS = 3;

const CreateStoreModal = memo(({ isOpen, onClose }) => {
  const dispatch  = useDispatch();
  const mutation  = useSelector((s) => s.pharmacy.loading?.mutation ?? false);
  const uploading = useSelector((s) => s.upload?.isUploading        ?? false);
  const uploadUrl = useSelector((s) => s.upload?.lastUploadedUrl    ?? null);

  const [form, setForm]         = useState(INITIAL_FORM);
  const [step, setStep]         = useState(1);
  const [docPending, setDocPending] = useState(false);
  const docSynced = useRef(false);

  // Sync uploaded document URL back into form
  useEffect(() => {
    if (uploadUrl && docPending && !docSynced.current) {
      docSynced.current = true;
      setForm((p) => ({
        ...p,
        storeData: {
          ...p.storeData,
          legal: { ...p.storeData.legal, documentUrl: uploadUrl },
        },
      }));
      setDocPending(false);
    }
  }, [uploadUrl, docPending]);

  // Deep immutable path setter — e.g. setField('storeData.legal.dlNumber', 'AP-001')
  const setField = useCallback((path, value) => {
    setForm((prev) => {
      const clone = structuredClone(prev);
      const parts = path.split('.');
      let   node  = clone;
      for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]];
      node[parts[parts.length - 1]] = value;
      return clone;
    });
  }, []);

  const toggleSpec = useCallback((spec) => {
    setForm((prev) => {
      const current = prev.storeData.specializations;
      const next    = current.includes(spec)
        ? current.filter((s) => s !== spec)
        : [...current, spec];
      return { ...prev, storeData: { ...prev.storeData, specializations: next } };
    });
  }, []);

  const handleDocUpload = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      docSynced.current = false;
      setDocPending(true);
      dispatch(uploadSingleFile({ file, folder: 'pharmacy/legal' }));
    },
    [dispatch]
  );

  // Per-step validation — no Zod, plain logical guards
  const validateStep = useCallback(async () => {
    const { default: toast } = await import('react-hot-toast');
    if (step === 1) {
      if (!form.name.trim())
        return toast.error('Manager full name is required.'), false;
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
        return toast.error('Valid manager email is required.'), false;
      if (!form.phone.trim())
        return toast.error('Manager phone is required.'), false;
      if (!form.storeData.storeName.trim())
        return toast.error('Store name is required.'), false;
      if (!form.storeData.contact.email.trim())
        return toast.error('Store contact email is required.'), false;
      if (!form.storeData.contact.phone.trim())
        return toast.error('Store contact phone is required.'), false;
    }
    if (step === 2) {
      if (!form.storeData.address.line1.trim())
        return toast.error('Address line is required.'), false;
      if (!form.storeData.address.pincode.trim())
        return toast.error('Pincode is required.'), false;
      if (!form.storeData.legal.dlNumber.trim())
        return toast.error('Drug License number is required.'), false;
    }
    return true;
  }, [step, form]);

  const handleNext = useCallback(async () => {
    if (await validateStep()) setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }, [validateStep]);

  // Submit — payload shape: { name, email, phone, storeData }
  const handleSubmit = useCallback(async () => {
    const { name, email, phone, storeData } = form;
    const result = await dispatch(createPharmacyStore({ name, email, phone, storeData }));
    if (!result.error) handleClose();
  }, [form, dispatch]);

  const handleClose = useCallback(() => {
    setForm(INITIAL_FORM);
    setStep(1);
    setDocPending(false);
    docSynced.current = false;
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const docDone = !!form.storeData.legal.documentUrl;

  return (
    <AnimatePresence>
      <motion.div
        key="modal-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-neutral/50 backdrop-blur-soft"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* Panel */}
        <motion.div
          key="modal-panel"
          variants={modalVariant}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative z-10 w-full sm:max-w-2xl bg-base-100 rounded-t-3xl sm:rounded-2xl shadow-xl flex flex-col max-h-[95dvh] sm:max-h-[88vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 shrink-0">
            <div>
              <h2 id="modal-heading" className="font-black text-lg text-base-content tracking-tight">
                Register Pharmacy Store
              </h2>
              <p className="text-xs text-base-content/45 mt-0.5">
                Step {step} / {TOTAL_STEPS} · creates User + Profile + Store in one transaction
              </p>
            </div>
            <button onClick={handleClose} aria-label="Close"
              className="w-8 h-8 rounded-full bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Step progress bar */}
          <div className="flex gap-1.5 px-6 pt-4 shrink-0">
            {[1, 2, 3].map((s) => (
              <div key={s} className="h-1.5 flex-1 rounded-full transition-all duration-500"
                style={{
                  backgroundColor:
                    s < step ? 'var(--success)' : s === step ? 'var(--primary)' : 'var(--base-300)',
                }}
              />
            ))}
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <AnimatePresence mode="wait">

              {/* ── Step 1: Manager + Store basics ── */}
              {step === 1 && (
                <motion.div key="step1" {...fadeUp} className="space-y-5">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                      Manager Account
                    </p>
                  </div>

                  <div className="alert alert-info text-xs">
                    A <strong>pharmacy</strong> role user is created automatically.
                    Login credentials are emailed to the address below.
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField label="Full Name" required>
                      <input type="text" value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        className="input-field w-full" placeholder="Dr. Arun Kumar"
                        autoComplete="name" />
                    </FormField>
                    <FormField label="Phone" required>
                      <input type="tel" value={form.phone}
                        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                        className="input-field w-full" placeholder="+91 9XXXXXXXXX"
                        autoComplete="tel" inputMode="tel" />
                    </FormField>
                  </div>

                  <FormField label="Email" required hint="Credentials sent here">
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" />
                      <input type="email" value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        className="input-field w-full pl-9" placeholder="manager@pharmacy.com"
                        autoComplete="email" />
                    </div>
                  </FormField>

                  <div className="divider" />

                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-primary" />
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                      Store Information
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField label="Store Name" required>
                      <input type="text" value={form.storeData.storeName}
                        onChange={(e) => setField('storeData.storeName', e.target.value)}
                        className="input-field w-full" placeholder="Likeson Pharmacy — MG Road" />
                    </FormField>
                    <FormField label="Store Type">
                      <div className="relative">
                        <select value={form.storeData.storeType}
                          onChange={(e) => setField('storeData.storeType', e.target.value)}
                          className="input-field w-full appearance-none">
                          {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-base-content/40" />
                      </div>
                    </FormField>
                    <FormField label="Initial Status">
                      <div className="relative">
                        <select value={form.storeData.status}
                          onChange={(e) => setField('storeData.status', e.target.value)}
                          className="input-field w-full appearance-none">
                          {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-base-content/40" />
                      </div>
                    </FormField>
                    <FormField label="Priority">
                      <div className="flex gap-2 h-[42px]">
                        {PRIORITY_OPTIONS.map((p) => {
                          const active = form.storeData.priority === p;
                          const cls =
                            p === 'High'   ? (active ? 'bg-error/15 border-error text-error'       : 'border-base-300 text-base-content/50') :
                            p === 'Medium' ? (active ? 'bg-warning/15 border-warning text-warning'  : 'border-base-300 text-base-content/50') :
                                             (active ? 'bg-success/15 border-success text-success'  : 'border-base-300 text-base-content/50');
                          return (
                            <button key={p} type="button"
                              onClick={() => setField('storeData.priority', p)}
                              className={`flex-1 rounded-lg text-xs font-bold border transition-all hover:border-primary ${cls}`}>
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    </FormField>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField label="Store Email" required>
                      <input type="email" value={form.storeData.contact.email}
                        onChange={(e) => setField('storeData.contact.email', e.target.value)}
                        className="input-field w-full" placeholder="store@pharmacy.com" />
                    </FormField>
                    <FormField label="Store Phone" required>
                      <input type="tel" value={form.storeData.contact.phone}
                        onChange={(e) => setField('storeData.contact.phone', e.target.value)}
                        className="input-field w-full" placeholder="+91 9XXXXXXXXX" inputMode="tel" />
                    </FormField>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2: Address + Legal ── */}
              {step === 2 && (
                <motion.div key="step2" {...fadeUp} className="space-y-4">
                  <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                    Store Address
                  </p>

                  <FormField label="Address Line" required>
                    <input type="text" value={form.storeData.address.line1}
                      onChange={(e) => setField('storeData.address.line1', e.target.value)}
                      className="input-field w-full" placeholder="Street, Locality, Area" />
                  </FormField>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <FormField label="City">
                      <input type="text" value={form.storeData.address.city}
                        onChange={(e) => setField('storeData.address.city', e.target.value)}
                        className="input-field w-full" />
                    </FormField>
                    <FormField label="State">
                      <input type="text" value={form.storeData.address.state}
                        onChange={(e) => setField('storeData.address.state', e.target.value)}
                        className="input-field w-full" />
                    </FormField>
                    <FormField label="Pincode" required>
                      <input type="text" value={form.storeData.address.pincode}
                        onChange={(e) => setField('storeData.address.pincode', e.target.value)}
                        className="input-field w-full" maxLength={6} placeholder="520001"
                        inputMode="numeric" />
                    </FormField>
                  </div>

                  <div className="divider" />
                  <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                    Legal &amp; Compliance
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField label="Drug License (DL) No." required>
                      <input type="text" value={form.storeData.legal.dlNumber}
                        onChange={(e) => setField('storeData.legal.dlNumber', e.target.value)}
                        className="input-field w-full font-mono tracking-wider"
                        placeholder="AP/VJA/2026/XXXX" />
                    </FormField>
                    <FormField label="GST Number">
                      <input type="text" value={form.storeData.legal.gstNumber}
                        onChange={(e) => setField('storeData.legal.gstNumber', e.target.value)}
                        className="input-field w-full font-mono tracking-wider"
                        placeholder="37AAACS0000A1Z5" />
                    </FormField>
                  </div>

                  <FormField label="License Expiry Date">
                    <input type="date" value={form.storeData.legal.licenseExpiry}
                      onChange={(e) => setField('storeData.legal.licenseExpiry', e.target.value)}
                      className="input-field w-full" />
                  </FormField>

                  <FormField label="License Document" hint="PDF / Image">
                    <label
                      className={`flex items-center gap-3 input-field cursor-pointer transition-colors ${
                        (docPending || uploading) ? 'opacity-60 cursor-wait' : 'hover:border-primary'
                      }`}
                    >
                      {(docPending || uploading)
                        ? <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                        : docDone
                        ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        : <Upload className="w-4 h-4 text-primary/60 shrink-0" />}
                      <span className="text-sm text-base-content/55 truncate">
                        {(docPending || uploading) ? 'Uploading…'
                          : docDone ? 'Document uploaded ✓'
                          : 'Click to upload'}
                      </span>
                      <input type="file" className="hidden" accept="image/*,application/pdf"
                        onChange={handleDocUpload} disabled={docPending || uploading} />
                    </label>
                  </FormField>
                </motion.div>
              )}

              {/* ── Step 3: Delivery + Specs + Summary ── */}
              {step === 3 && (
                <motion.div key="step3" {...fadeUp} className="space-y-5">
                  <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                    Delivery Configuration
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <FormField label="Delivery Radius (km)">
                      <input type="number" min={1} max={100} inputMode="numeric"
                        value={form.storeData.deliverySettings.deliveryRadiusKm}
                        onChange={(e) => setField('storeData.deliverySettings.deliveryRadiusKm', Number(e.target.value))}
                        className="input-field w-full" />
                    </FormField>
                    <FormField label="Estimated Delivery Time">
                      <input type="text" value={form.storeData.deliverySettings.estimatedDeliveryTime}
                        onChange={(e) => setField('storeData.deliverySettings.estimatedDeliveryTime', e.target.value)}
                        className="input-field w-full" placeholder="2 Hours" />
                    </FormField>
                  </div>

                  {/* Home delivery toggle */}
                  <button type="button" role="switch"
                    aria-checked={form.storeData.deliverySettings.canDeliver}
                    onClick={() => setField('storeData.deliverySettings.canDeliver',
                      !form.storeData.deliverySettings.canDeliver)}
                    className="flex items-center gap-3">
                    <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${
                      form.storeData.deliverySettings.canDeliver ? 'bg-primary' : 'bg-base-300'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${
                        form.storeData.deliverySettings.canDeliver ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <span className="text-sm font-semibold text-base-content">Home Delivery Enabled</span>
                  </button>

                  <div className="divider" />

                  {/* Specializations */}
                  <div>
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-2.5">
                      Specializations
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SPECIALIZATIONS.map((spec) => {
                        const active = form.storeData.specializations.includes(spec);
                        return (
                          <button key={spec} type="button" onClick={() => toggleSpec(spec)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
                              active
                                ? 'bg-primary/15 border-primary text-primary'
                                : 'border-base-300 text-base-content/55 hover:border-primary/60'}`}>
                            {spec}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="divider" />

                  {/* Summary */}
                  <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3">
                      Confirmation Summary
                    </p>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                      {[
                        ['Manager',  form.name || '—'],
                        ['Email',    form.email || '—'],
                        ['Store',    form.storeData.storeName || '—'],
                        ['Type',     form.storeData.storeType],
                        ['Status',   form.storeData.status],
                        ['DL No.',   form.storeData.legal.dlNumber || '—'],
                        ['City',     form.storeData.address.city],
                        ['Delivery', form.storeData.deliverySettings.canDeliver
                          ? `Yes · ${form.storeData.deliverySettings.deliveryRadiusKm} km` : 'No'],
                      ].map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt className="text-base-content/50">{k}</dt>
                          <dd className="font-semibold truncate text-base-content">{v}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-base-300 flex items-center justify-between shrink-0">
            <button type="button" onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="btn-secondary text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft className="w-4 h-4" />Back
            </button>
            {step < TOTAL_STEPS ? (
              <button type="button" onClick={handleNext}
                className="btn-primary-cta text-sm px-5 py-2 flex items-center gap-1.5">
                Next<ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={mutation}
                className="btn-primary-cta text-sm px-6 py-2 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                {mutation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />}
                {mutation ? 'Registering…' : 'Register Store'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
CreateStoreModal.displayName = 'CreateStoreModal';

// ─── Pagination ───────────────────────────────────────────────────────────────

const Pagination = memo(({ pagination, onPageChange }) => {
  const { currentPage = 1, totalPages = 1 } = pagination ?? {};
  const pages = useMemo(() => {
    const out = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
        out.push(i);
      } else if (out[out.length - 1] !== '…') {
        out.push('…');
      }
    }
    return out;
  }, [currentPage, totalPages]);
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1.5 mt-10">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}
        aria-label="Previous page"
        className="w-9 h-9 rounded-lg border border-base-300 flex items-center justify-center hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`e${i}`} className="w-9 text-center text-sm text-base-content/40">…</span>
          : (
            <button key={p} onClick={() => onPageChange(p)}
              aria-current={p === currentPage ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                p === currentPage
                  ? 'bg-primary text-primary-content shadow-primary'
                  : 'border border-base-300 hover:border-primary text-base-content/70'}`}>
              {p}
            </button>
          )
      )}
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}
        aria-label="Next page"
        className="w-9 h-9 rounded-lg border border-base-300 flex items-center justify-center hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
});
Pagination.displayName = 'Pagination';

// ─── PharmacyManagement (Main Page) ──────────────────────────────────────────

export default function PharmacyManagement() {
  const dispatch = useDispatch();

  // Selectors — inline with safe fallbacks so missing keys never crash render
  const user       = useSelector((s) => s.user?.user       ?? null);
  const stores     = useSelector((s) => Array.isArray(s.pharmacy?.stores) ? s.pharmacy.stores : []);
  const pagination = useSelector((s) => s.pharmacy?.pagination ?? { total: 0, totalPages: 0, currentPage: 1, limit: 12 });
  const loadingAll = useSelector((s) => s.pharmacy?.loading?.fetchAll ?? false);
  const mutation   = useSelector((s) => s.pharmacy?.loading?.mutation  ?? false);
  const error      = useSelector((s) => s.pharmacy?.error   ?? null);
  const success    = useSelector((s) => s.pharmacy?.success  ?? false);

  // Local UI state
  const [showModal,   setShowModal]   = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [viewMode,    setViewMode]    = useState('grid'); // 'grid' | 'list'
  const [page,        setPage]        = useState(1);
  const [filters,     setFilters]     = useState({ search: '', status: '', storeType: '' });

  // Debounce search input before sending to server (420ms)
  const searchTimer                          = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(filters.search), 420);
    return () => clearTimeout(searchTimer.current);
  }, [filters.search]);

  // ── Primary data fetch ────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchAllStores({
      page,
      limit: 12,
      ...(filters.status    ? { status:    filters.status    } : {}),
      ...(filters.storeType ? { storeType: filters.storeType } : {}),
      ...(debouncedSearch   ? { search:    debouncedSearch   } : {}),
    }));
  }, [dispatch, page, filters.status, filters.storeType, debouncedSearch]);

  // ── After successful create: reset + refetch ──────────────────────────────
  // We do NOT rely on the optimistic unshift in the slice — that store object
  // has `managedBy` as a raw ObjectId string (not populated). Instead we
  // refetch from page 1 to get the fully populated document from the DB.
  useEffect(() => {
    if (!success) return;
    dispatch(resetPharmacyStatus());
    setPage(1);
    const timer = setTimeout(() => {
      dispatch(fetchAllStores({ page: 1, limit: 12 }));
    }, 100);
    return () => clearTimeout(timer);
  }, [success, dispatch]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleFilterChange = useCallback((updates) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPage(1);
  }, []);

  const handleVerify = useCallback(async (id) => {
    setVerifyingId(id);
    await dispatch(verifyPharmacyStore(id));
    setVerifyingId(null);
  }, [dispatch]);

  const handleRefresh = useCallback(() => {
    dispatch(fetchAllStores({
      page,
      limit: 12,
      ...(filters.status    ? { status:    filters.status    } : {}),
      ...(filters.storeType ? { storeType: filters.storeType } : {}),
      ...(debouncedSearch   ? { search:    debouncedSearch   } : {}),
    }));
  }, [dispatch, page, filters, debouncedSearch]);

  const handlePageChange = useCallback((p) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openModal  = useCallback(() => setShowModal(true),  []);
  const closeModal = useCallback(() => setShowModal(false), []);

  return (
    <main className="min-h-screen bg-base-100">
      <div className="container-custom py-6 sm:py-10 max-w-7xl">

        {/* ── Page Header ── */}
        <motion.div {...fadeUp}
          className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-6 rounded-full bg-bg-gradient-primary"
                aria-hidden="true" />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">
                {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'} · Pharmacy Network
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-base-content tracking-tight">
              Pharmacy Store Management
            </h1>
            <p className="text-sm text-base-content/55 mt-1">
              Register, verify, and oversee all pharmacy stores across your network.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Refresh */}
            <button onClick={handleRefresh} disabled={loadingAll}
              aria-label="Refresh list"
              className="w-10 h-10 rounded-xl border border-base-300 flex items-center justify-center hover:border-primary transition-colors disabled:opacity-40">
              <RefreshCw className={`w-4 h-4 ${loadingAll ? 'animate-spin text-primary' : ''}`} />
            </button>

            {/* View mode toggle */}
            <div className="flex items-center border border-base-300 rounded-xl overflow-hidden"
              role="group" aria-label="View mode">
              {['grid', 'list'].map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  aria-label={`${mode === 'grid' ? 'Grid' : 'List'} view`}
                  className={`w-10 h-10 flex items-center justify-center transition-colors ${
                    viewMode === mode
                      ? 'bg-primary text-primary-content'
                      : 'hover:bg-base-200 text-base-content/60'}`}>
                  {mode === 'grid'
                    ? <LayoutGrid className="w-4 h-4" />
                    : <List className="w-4 h-4" />}
                </button>
              ))}
            </div>

            {/* Add store CTA */}
            <button onClick={openModal}
              className="btn-primary-cta flex items-center gap-2 text-sm"
              aria-label="Register new pharmacy store">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Store</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </motion.div>

        {/* ── Stats ── */}
        {stores.length > 0 && (
          <StatsBar stores={stores} total={pagination.total} />
        )}

        {/* ── Filters ── */}
        <FilterBar
          filters={filters}
          onChange={handleFilterChange}
          total={pagination.total ?? stores.length}
        />

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && !loadingAll && (
            <motion.div key="err" {...fadeUp} role="alert"
              className="alert alert-error mb-6 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-sm flex-1">{error}</p>
              <button onClick={handleRefresh}
                className="text-xs font-bold underline underline-offset-2 shrink-0">
                Retry
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Content area ── */}
        {loadingAll ? (
          /* Skeleton grid */
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'flex flex-col gap-3'}>
            {[...Array(6)].map((_, i) => <StoreSkeleton key={i} />)}
          </div>
        ) : stores.length === 0 ? (
          /* Empty state */
          <EmptyState onAdd={openModal} />
        ) : (
          /* Store cards — motion.div with staggerContainer handles the stagger;
             each StoreCard uses cardVariant as its variants prop */
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className={viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
              : 'flex flex-col gap-3'}
          >
            {stores.map((store) => (
              <StoreCard
                key={store._id}
                store={store}
                onVerify={handleVerify}
                isVerifying={verifyingId === store._id}
              />
            ))}
          </motion.div>
        )}

        {/* ── Pagination ── */}
        {!loadingAll && stores.length > 0 && (
          <Pagination pagination={pagination} onPageChange={handlePageChange} />
        )}
      </div>

      {/* ── Create Store Modal ── */}
      <CreateStoreModal isOpen={showModal} onClose={closeModal} />
    </main>
  );
}