'use client';

/**
 * SoloDriversManagement.jsx
 * Admin / Superadmin — Solo Driver Partners Management
 *
 * Uses:
 * - Redux: soloDriverSlice (all admin thunks)
 * - selectUser from userSlice
 * - Next.js (app router)
 * - Tailwind CSS + project CSS vars
 * - Lucide React icons
 * - Framer Motion
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Filter, Plus, Eye, CheckCircle, XCircle,
  Building2, CreditCard, Car, FileText, Shield, Bell,
  Award, Coins, Ban, Unlock, TrendingUp, MapPin, Phone,
  Mail, Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  RefreshCw, Download, AlertTriangle, Clock, Star,
  MoreVertical, Edit3, Trash2, Activity, Wallet, BadgeCheck,
  UserCheck, UserX, Settings, X, Check, ExternalLink,
  ClipboardList, Truck, Zap, BarChart3, PieChart, Hash, Info,
} from 'lucide-react';

// ── Redux selectors & thunks ──────────────────────────────────────────────────
import {
  adminFetchPartnerList,
  adminFetchPartnerDetail,
  adminFetchComplianceAlerts,
  adminVerifyKyc,
  adminVerifyVehicle,
  adminVerifyBank,
  adminUpdatePartnerStatus,
  adminBlockPartner,
  adminUpdatePlatformFee,
  adminUpdateNotes,
  adminAwardBadge,
  adminAdjustCoins,
  adminCreateSoloDriver,
  selectAdminPartnerList,
  selectAdminPagination,
  selectAdminSelectedPartner,
  selectAdminComplianceAlerts,
  selectAdminComplianceTotal,
  selectAdminLastCreated,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';

export const selectUser = (s) => s.user.user;

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

const slideIn = {
  hidden: { opacity: 0, x: 40 },
  show:   { opacity: 1, x: 0,  transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, x: 60, transition: { duration: 0.25 } },
};

const stagger = {
  show: { transition: { staggerChildren: 0.07 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit:   { opacity: 0, scale: 0.88, transition: { duration: 0.2 } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  active:       'badge-success',
  pending:      'badge-warning',
  'under-review': 'badge-info',
  suspended:    'badge-error',
  rejected:     'badge-error',
};

const VERIFIED_COLORS = {
  verified:       'text-success',
  pending:        'text-warning',
  rejected:       'text-error',
  'not-submitted': 'text-base-content/40',
  'under-review': 'text-info',
};

const KYC_STATUS_LABELS = {
  Verified:       '✅ Verified',
  Pending:        '⏳ Pending',
  Rejected:       '❌ Rejected',
  'not-submitted': '— Not Submitted',
  'Under-Review': '🔍 Under Review',
  verified:       '✅ Verified',
  pending:        '⏳ Pending',
  rejected:       '❌ Rejected',
  'under-review': '🔍 Under Review',
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// ── Subcomponents ─────────────────────────────────────────────────────────────

/** Pill badge */
function StatusBadge({ status }) {
  return (
    <span className={`badge ${STATUS_COLORS[status] || 'badge-primary'} capitalize`}>
      {status?.replace(/-/g, ' ') || 'Unknown'}
    </span>
  );
}

/** Document viewer overlay */
function DocViewer({ url, label, onClose }) {
  return (
    <AnimatePresence>
      {url && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-4xl max-h-[90vh] bg-base-100 rounded-[var(--r-box)] overflow-hidden shadow-2xl z-10 flex flex-col"
            variants={scaleIn}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <span className="font-semibold text-sm text-base-content">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm gap-2">
                  <ExternalLink className="w-4 h-4" /> Open in new tab
                </a>
                <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 bg-base-200">
              {url?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                <img src={url} alt={label} className="w-full h-auto rounded-lg object-contain max-h-[75vh] mx-auto" />
              ) : url?.match(/\.pdf$/i) ? (
                <iframe src={url} title={label} className="w-full h-[75vh] rounded-lg border-0" />
              ) : (
                <div className="flex flex-col items-center justify-center h-60 gap-4 text-base-content/50">
                  <FileText className="w-12 h-12" />
                  <p className="text-sm">Preview not available for this file type.</p>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                    Open Document
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Doc field row */
function DocField({ label, value, docUrl, onView }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-base-300/50 last:border-0 gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-base-content/50 font-medium uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-sm text-base-content font-semibold text-sm truncate">{value || '—'}</p>
      </div>
      {docUrl && (
        <button
          onClick={() => onView(docUrl, label)}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-semibold text-sm border border-primary/30 rounded-lg px-2.5 py-1 hover:bg-primary/5 transition-all"
        >
          <Eye className="w-3.5 h-3.5" /> View
        </button>
      )}
    </div>
  );
}

/** Section card */
function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <motion.div variants={fadeUp} className={`card p-5 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h3 className="font-bold text-base-content text-sm uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

/** Confirm modal */
function ConfirmModal({ title, message, onConfirm, onCancel, loading, danger = false, children }) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[150] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
        <motion.div
          className="relative w-full max-w-md bg-base-100 rounded-[var(--r-box)] p-6 shadow-2xl z-10"
          variants={scaleIn}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <h3 className={`text-lg font-bold mb-2 ${danger ? 'text-error' : 'text-base-content'}`}>{title}</h3>
          <p className="text-sm text-base-content/60 mb-4">{message}</p>
          {children}
          <div className="flex gap-3 mt-5">
            <button onClick={onCancel} className="btn btn-ghost flex-1" disabled={loading}>Cancel</button>
            <button
              onClick={onConfirm}
              className={`btn flex-1 ${danger ? 'btn-error' : 'btn-primary'}`}
              disabled={loading}
            >
              {loading ? <span className="loading loading-spinner loading-sm" /> : 'Confirm'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Inline field */
function InfoRow({ label, value, className = '' }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-xs text-base-content/40 font-semibold text-sm uppercase tracking-wider">{label}</span>
      <span className="text-sm text-base-content font-medium">{value ?? '—'}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function SoloDriversManagement() {
  const dispatch = useDispatch();
  const user         = useSelector(selectUser);
  const partners     = useSelector(selectAdminPartnerList);
  const pagination   = useSelector(selectAdminPagination);
  const selected     = useSelector(selectAdminSelectedPartner);
  const alerts       = useSelector(selectAdminComplianceAlerts);
  const alertsTotal  = useSelector(selectAdminComplianceTotal);
  const lastCreated  = useSelector(selectAdminLastCreated);

  const loadingList    = useSelector(selectLoading('adminList'));
  const loadingDetail  = useSelector(selectLoading('adminDetail'));
  const loadingCreate  = useSelector(selectLoading('adminCreate'));
  const loadingKyc     = useSelector(selectLoading('adminVerifyKyc'));
  const loadingVehicle = useSelector(selectLoading('adminVerifyVehicle'));
  const loadingBank    = useSelector(selectLoading('adminVerifyBank'));
  const loadingStatus  = useSelector(selectLoading('adminStatus'));
  const loadingBlock   = useSelector(selectLoading('adminBlock'));
  const loadingFee     = useSelector(selectLoading('adminPlatformFee'));
  const loadingNotes   = useSelector(selectLoading('adminNotes'));
  const loadingBadge   = useSelector(selectLoading('adminAwardBadge'));
  const loadingCoins   = useSelector(selectLoading('adminAdjustCoins'));
  const loadingAlerts  = useSelector(selectLoading('adminComplianceAlerts'));

  // ── UI state ──────────────────────────────────────────────────────────────
  const [view, setView]           = useState('list'); // list | detail | create | compliance
  const [docViewer, setDocViewer] = useState(null);   // { url, label }
  const [modal, setModal]         = useState(null);   // see openModal()
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters]     = useState({
    page: 1, limit: 20,
    search: '', status: '', kycStatus: '', vehicleStatus: '',
    city: '', state: '', isBlocked: '', sortBy: 'createdAt', sortOrder: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const searchTimer = useRef(null);

  // modal state
  const [modalData, setModalData] = useState({});

  // ── Load list on mount / filter change ───────────────────────────────────
  const loadList = useCallback(() => {
    const params = { ...filters };
    if (!params.search) delete params.search;
    if (!params.status) delete params.status;
    if (!params.kycStatus) delete params.kycStatus;
    if (!params.vehicleStatus) delete params.vehicleStatus;
    if (!params.city) delete params.city;
    if (!params.state) delete params.state;
    if (params.isBlocked === '') delete params.isBlocked;
    dispatch(adminFetchPartnerList(params));
  }, [dispatch, filters]);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Compliance alerts ──────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(adminFetchComplianceAlerts({ days: 30 }));
  }, [dispatch]);

  // ── Debounced search ───────────────────────────────────────────────────────
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: val, page: 1 }));
    }, 400);
  };

  // ── Select partner ─────────────────────────────────────────────────────────
  const selectPartner = (id) => {
    dispatch(adminFetchPartnerDetail(id));
    setView('detail');
    setActiveTab('overview');
  };

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openModal = (type, extra = {}) => { setModal(type); setModalData(extra); };
  const closeModal = () => { setModal(null); setModalData({}); };
  const viewDoc = (url, label) => setDocViewer({ url, label });

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleVerifyKyc = async (action) => {
    await dispatch(adminVerifyKyc({
      partnerId: selected._id,
      action,
      rejectionReason: modalData.reason || '',
    }));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
  };

  const handleVerifyVehicle = async (action) => {
    await dispatch(adminVerifyVehicle({
      partnerId: selected._id,
      action,
      rejectionReason: modalData.reason || '',
    }));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
  };

  const handleVerifyBank = async () => {
    await dispatch(adminVerifyBank(selected._id));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
  };

  const handleUpdateStatus = async () => {
    await dispatch(adminUpdatePartnerStatus({
      partnerId: selected._id,
      status: modalData.status,
      rejectionReason: modalData.reason || '',
    }));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
    loadList();
  };

  const handleBlock = async () => {
    await dispatch(adminBlockPartner({
      partnerId: selected._id,
      action: modalData.action,
      blockReason: modalData.reason || '',
      unblockAt: modalData.unblockAt || undefined,
    }));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
    loadList();
  };

  const handleUpdateFee = async () => {
    await dispatch(adminUpdatePlatformFee({
      partnerId: selected._id,
      platformFeeOverride: modalData.platformFeeOverride,
      settlementCycle: modalData.settlementCycle,
    }));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
  };

  const handleUpdateNotes = async () => {
    await dispatch(adminUpdateNotes({ partnerId: selected._id, notes: modalData.notes }));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
  };

  const handleAwardBadge = async () => {
    await dispatch(adminAwardBadge({
      partnerId: selected._id,
      badgeId: modalData.badgeId,
      name: modalData.badgeName,
      description: modalData.badgeDesc,
    }));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
  };

  const handleAdjustCoins = async () => {
    await dispatch(adminAdjustCoins({
      partnerId: selected._id,
      type: modalData.coinType,
      amount: Number(modalData.coinAmount),
      description: modalData.coinDesc,
    }));
    closeModal();
    dispatch(adminFetchPartnerDetail(selected._id));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());
    payload.address = {
      street: payload.street, city: payload.city,
      state: payload.state, pinCode: payload.pinCode, country: 'India',
    };
    if (payload.platformFeeType && payload.platformFeeValue) {
      payload.platformFeeOverride = {
        type: payload.platformFeeType,
        value: Number(payload.platformFeeValue),
      };
    }
    payload.autoVerifyKyc     = payload.autoVerifyKyc === 'true';
    payload.autoVerifyVehicle = payload.autoVerifyVehicle === 'true';
    payload.autoVerifyBank    = payload.autoVerifyBank === 'true';
    const res = await dispatch(adminCreateSoloDriver(payload));
    if (!res.error) {
      setView('list');
      loadList();
    }
  };

  // ── Stats cards ────────────────────────────────────────────────────────────
  const statsCardsData = [
    { label: 'Total Partners',  value: pagination?.total  || 0, icon: Users,       color: 'text-primary' },
    { label: 'Active',          value: partners.filter(p => p.partnershipStatus === 'active').length, icon: CheckCircle, color: 'text-success' },
    { label: 'Pending Review',  value: partners.filter(p => p.partnershipStatus === 'pending').length, icon: Clock, color: 'text-warning' },
    { label: 'Compliance Alerts', value: alertsTotal, icon: AlertTriangle, color: 'text-error' },
  ];

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER: LIST VIEW
  // ═════════════════════════════════════════════════════════════════════════

  const renderList = () => (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

      {/* Stats Row */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCardsData.map((s, i) => (
          <motion.div
            key={s.label}
            variants={fadeUp}
            className="stat-card flex items-center gap-4"
            whileHover={{ y: -3 }}
          >
            <div className={`p-3 rounded-2xl bg-base-300/60`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <div className="stat-card-value text-2xl">{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Toolbar */}
      <motion.div variants={fadeUp} className="flex gap-3  items-center">
          <div className="relative flex w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Search name, phone, email..."
              className="input-field w-full pl-9"
            />
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}
            className="input-field text-sm py-2 pr-8 min-w-[130px]"
          >
            <option value="">All Statuses</option>
            {['pending','under-review','active','suspended','rejected'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>

          <select
            value={filters.kycStatus}
            onChange={(e) => setFilters(f => ({ ...f, kycStatus: e.target.value, page: 1 }))}
            className="input-field text-sm py-2 pr-8 min-w-[120px]"
          >
            <option value="">All KYC</option>
            {['verified','pending','rejected','not-submitted','under-review'].map(s => (
              <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>
            ))}
          </select>

          <select
            value={filters.isBlocked}
            onChange={(e) => setFilters(f => ({ ...f, isBlocked: e.target.value, page: 1 }))}
            className="input-field text-sm py-2 pr-8 min-w-[110px]"
          >
            <option value="">All Users</option>
            <option value="false">Active</option>
            <option value="true">Blocked</option>
          </select>

          <button onClick={loadList} className="btn btn-ghost btn-sm gap-2" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setView('compliance')}
            className={`btn btn-sm gap-2 ml-auto ${alertsTotal > 0 ? 'btn-error' : 'btn-ghost'}`}
          >
            <AlertTriangle className="w-4 h-4" />
            Alerts {alertsTotal > 0 && <span className="badge badge-sm badge-error text-error-content">{alertsTotal}</span>}
          </button>

          <button
            onClick={() => setView('create')}
            className="btn btn-primary btn-sm gap-2"
          >
            <Plus className="w-4 h-4" /> Add Partner
          </button>
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp} className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="bg-base-200 text-base-content/60 text-xs uppercase tracking-wider">
                <th className="font-bold py-3 px-4">Partner</th>
                <th className="font-bold py-3 px-4">Code / Phone</th>
                <th className="font-bold py-3 px-4">Partnership Status</th>
                <th className="font-bold py-3 px-4">KYC</th>
                <th className="font-bold py-3 px-4">Vehicle</th>
                <th className="font-bold py-3 px-4">Bank</th>
                <th className="font-bold py-3 px-4">Dispatch</th>
                <th className="font-bold py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="wait">
                {loadingList ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-base-200">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="py-4 px-4">
                          <div className="skeleton h-4 rounded w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : partners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-base-content/40">
                      <div className="flex flex-col items-center gap-3">
                        <Users className="w-12 h-12 opacity-20" />
                        <p className="text-sm font-medium">No partners found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
              partners.map((p, idx) => {
                    const dp = p.dispatch || p.driverProfile || {};
                    const vStatus = p.vehicleStatus || {};
                    return (
                      <motion.tr
                        key={p._id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="border-b border-base-200 hover:bg-base-200/50 transition-colors cursor-pointer"
                        onClick={() => selectPartner(p._id)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="avatar placeholder">
                              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                                {(p.legalName || p.displayName || '?')[0].toUpperCase()}
                              </div>
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-sm text-base-content leading-tight">{p.legalName}</p>
                              <p className="text-xs text-base-content/40">{p.email || p.user?.email}</p>
                            </div>
                            {p.user?.isBlocked && (
                              <span className="badge badge-error badge-xs">Blocked</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-xs font-mono font-bold text-primary">{p.partnerCode}</p>
                          <p className="text-xs text-base-content/50">{p.phone}</p>
                        </td>
                        <td className="py-3 px-4"><StatusBadge status={p.partnershipStatus} /></td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-semibold text-sm ${VERIFIED_COLORS[p.kyc?.verificationStatus] || ''}`}>
                            {KYC_STATUS_LABELS[p.kyc?.verificationStatus] || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-semibold text-sm ${VERIFIED_COLORS[vStatus.verificationStatus] || ''}`}>
                            {vStatus.registrationNumber || '—'}
                            {vStatus.verificationStatus === 'verified' && ' ✅'}
                            {vStatus.verificationStatus === 'rejected' && ' ❌'}
                            {['pending', 'under-review'].includes(vStatus.verificationStatus) && ' ⏳'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {p.bankDetails?.isVerified
                            ? <span className="text-success text-xs font-bold">✅ Verified</span>
                            : p.bankDetails?.accountLast4
                            ? <span className="text-warning text-xs font-bold">⏳ Unverified</span>
                            : <span className="text-base-content/30 text-xs">—</span>
                          }
                        </td>
                        <td className="py-3 px-4">
                          <div className={`flex items-center gap-1.5 text-xs font-semibold text-sm ${
                            dp.status === 'Available' ? 'text-success' :
                            dp.status === 'On-Trip' ? 'text-info' :
                            dp.status === 'On-Break' ? 'text-warning' : 'text-base-content/40'
                          }`}>
                            <span className={`status-dot ${
                              dp.status === 'Available' ? 'status-dot-success' :
                              dp.status === 'On-Trip' ? 'status-dot-info' :
                              dp.status === 'On-Break' ? 'status-dot-warning' : 'bg-base-300'
                            }`} />
                            {dp.status || 'Offline'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); selectPartner(p._id); }}
                            className="btn btn-ghost btn-xs gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/40">
              Showing {((filters.page - 1) * filters.limit) + 1}–{Math.min(filters.page * filters.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                disabled={!pagination.hasPrev}
                className="btn btn-ghost btn-xs"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-sm px-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                disabled={!pagination.hasNext}
                className="btn btn-ghost btn-xs"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER: DETAIL VIEW
  // ═════════════════════════════════════════════════════════════════════════

  const TABS = [
    { id: 'overview',    label: 'Overview',    icon: Activity },
    { id: 'kyc',         label: 'KYC',         icon: Shield },
    { id: 'vehicle',     label: 'Vehicle',     icon: Car },
    { id: 'bank',        label: 'Bank',        icon: CreditCard },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'rewards',     label: 'Rewards',     icon: Award },
    { id: 'dispatch',    label: 'Dispatch',    icon: Zap },
    { id: 'actions',     label: 'Admin Actions', icon: Settings },
  ];

  const renderDetail = () => {
    if (loadingDetail && !selected) {
      return (
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      );
    }
    if (!selected) return null;

const p = selected;
    const u = p.user || {};
    const dp = p.dispatch || p.driverProfile || {};

    return (
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

        {/* Header card */}
        <motion.div variants={fadeUp} className="card p-5">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-2xl font-black text-primary border border-primary/20">
                {(p.legalName || '?')[0]}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-base-content">{p.legalName}</h2>
                  <StatusBadge status={p.partnershipStatus} />
                  {u.isBlocked && <span className="badge badge-error">Blocked</span>}
                  {dp.isPaused && <span className="badge badge-warning">Paused</span>}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-base-content/50">
                  <span className="font-mono font-bold text-primary">{p.partnerCode}</span>
                  <span>{p.phone}</span>
                  <span>{p.email}</span>
                  <span>Partner since: {fmtDate(p.partnerSince)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => openModal('notes')} className="btn btn-ghost btn-sm gap-2">
                <ClipboardList className="w-4 h-4" /> Notes
              </button>
              <button
                onClick={() => openModal('status')}
                className="btn btn-primary btn-sm gap-2"
              >
                <Edit3 className="w-4 h-4" /> Update Status
              </button>
              <button
                onClick={() => openModal(u.isBlocked ? 'unblock' : 'block')}
                className={`btn btn-sm gap-2 ${u.isBlocked ? 'btn-success' : 'btn-error'}`}
              >
                {u.isBlocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                {u.isBlocked ? 'Unblock' : 'Block'}
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-base-300">
            {[
              { label: 'Total Rides', value: p.stats?.totalRidesCompleted || 0 },
              { label: 'Rating', value: `${(p.rating?.averageRating || 0).toFixed(1)} ⭐` },
              { label: 'Earnings', value: fmtCurrency(p.stats?.totalEarnings) },
              { label: 'Coins', value: u.coins || 0 },
              { label: 'Profile %', value: `${p.profileCompletionPercent || 0}%` },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-lg font-black text-primary">{s.value}</p>
                <p className="text-xs text-base-content/40 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={fadeUp} className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === t.id
                  ? 'bg-primary text-primary-content shadow-md'
                  : 'bg-base-200 text-base-content/60 hover:bg-base-300'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {activeTab === 'overview'    && <TabOverview p={p} u={u} dp={dp} onViewDoc={viewDoc} />}
            {activeTab === 'kyc'         && <TabKyc p={p} onView={viewDoc} onApprove={() => openModal('approveKyc')} onReject={() => openModal('rejectKyc')} />}
            {activeTab === 'vehicle'     && <TabVehicle p={p} onView={viewDoc} onApprove={() => openModal('approveVehicle')} onReject={() => openModal('rejectVehicle')} />}
            {activeTab === 'bank'        && <TabBank p={p} onView={viewDoc} onVerify={() => openModal('verifyBank')} />}
            {activeTab === 'performance' && <TabPerformance p={p} />}
            {activeTab === 'rewards'     && <TabRewards p={p} onAwardBadge={() => openModal('awardBadge')} onAdjustCoins={() => openModal('adjustCoins')} />}
            {activeTab === 'dispatch'    && <TabDispatch p={p} />}
            {activeTab === 'actions'     && (
              <TabActions
                p={p}
                onFee={() => openModal('platformFee')}
                onNotes={() => openModal('notes')}
                onStatus={() => openModal('status')}
                onBlock={() => openModal(u.isBlocked ? 'unblock' : 'block')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    );
  };

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER: CREATE VIEW
  // ═════════════════════════════════════════════════════════════════════════

  const renderCreate = () => (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="max-w-3xl mx-auto">
      <div className="card p-6">
        <h2 className="text-xl font-black text-base-content mb-1">Create Solo Driver Partner</h2>
        <p className="text-sm text-base-content/50 mb-6">
          Admin-created accounts are auto-verified if all data is provided. A welcome email with temp credentials is sent.
        </p>

        <form onSubmit={handleCreate} className="space-y-6">
          {/* Personal */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-2 flex items-center gap-2">
              <UserCheck className="w-4 h-4" /> Personal Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name:'name',        label:'Full Name *',        placeholder:'Ramesh Kumar' },
                { name:'legalName',   label:'Legal Name *',       placeholder:'As per Aadhaar' },
                { name:'displayName', label:'Display Name',       placeholder:'Display name on app' },
                { name:'email',       label:'Email *',            placeholder:'ramesh@example.com', type:'email' },
                { name:'phone',       label:'Phone *',            placeholder:'9876543210', type:'tel' },
                { name:'dateOfBirth', label:'Date of Birth',      type:'date' },
              ].map(f => (
                <div key={f.name}>
                  <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">{f.label}</span></label>
                  <input name={f.name} type={f.type || 'text'} placeholder={f.placeholder} className="input-field w-full text-sm" />
                </div>
              ))}
              <div>
                <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">Gender</span></label>
                <select name="gender" className="input-field w-full text-sm">
                  <option value="">Select gender</option>
                  {['Male','Female','Other','Prefer Not to Say'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          {/* Address */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" /> Residential Address
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name:'street',  label:'Street', placeholder:'Door no, Street name' },
                { name:'city',    label:'City *', placeholder:'Vijayawada' },
                { name:'state',   label:'State *', placeholder:'Andhra Pradesh' },
                { name:'pinCode', label:'PIN Code', placeholder:'520001' },
              ].map(f => (
                <div key={f.name}>
                  <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">{f.label}</span></label>
                  <input name={f.name} type="text" placeholder={f.placeholder} className="input-field w-full text-sm" />
                </div>
              ))}
            </div>
          </fieldset>

          {/* KYC */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4" /> KYC Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name:'drivingLicenceNumber', label:'DL Number *', placeholder:'AP0920210012345' },
                { name:'drivingLicenceExpiry', label:'DL Expiry *', type:'date' },
                { name:'aadhaarNumber',        label:'Aadhaar (12 digits)', placeholder:'XXXXXXXXXXXX', maxLength:12 },
                { name:'panNumber',            label:'PAN Number', placeholder:'ABCDE1234F' },
              ].map(f => (
                <div key={f.name}>
                  <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">{f.label}</span></label>
                  <input name={f.name} type={f.type || 'text'} placeholder={f.placeholder} maxLength={f.maxLength} className="input-field w-full text-sm" />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="label py-1 flex items-center gap-2">
                  <input type="checkbox" name="autoVerifyKyc" value="true" className="checkbox checkbox-primary checkbox-sm" />
                  <span className="label-text text-xs font-semibold text-sm">Auto-verify KYC (requires DL + Aadhaar)</span>
                </label>
                <p className="text-xs text-base-content/40 ml-6">Skip manual KYC review — partner can go online immediately after vehicle + bank verification.</p>
              </div>
            </div>
          </fieldset>

          {/* Vehicle */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Car className="w-4 h-4" /> Vehicle Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name:'registrationNumber', label:'Registration Number', placeholder:'AP09AB1234' },
                { name:'make',               label:'Make', placeholder:'Maruti' },
                { name:'vehicleModel',       label:'Model', placeholder:'Swift Dzire' },
                { name:'year',               label:'Year', type:'number', placeholder:'2022' },
                { name:'color',              label:'Color', placeholder:'White' },
                { name:'seatingCapacity',    label:'Seating Capacity', type:'number', placeholder:'4' },
              ].map(f => (
                <div key={f.name}>
                  <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">{f.label}</span></label>
                  <input name={f.name} type={f.type || 'text'} placeholder={f.placeholder} className="input-field w-full text-sm" />
                </div>
              ))}
              <div>
                <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">Vehicle Type</span></label>
                <select name="vehicleType" className="input-field w-full text-sm">
                  <option value="">Select type</option>
                  {['Sedan','SUV','Van','Minivan','Wheelchair-Van','Tempo-Traveller','Hatchback','Auto'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label py-1 flex items-center gap-2">
                  <input type="checkbox" name="autoVerifyVehicle" value="true" className="checkbox checkbox-primary checkbox-sm" />
                  <span className="label-text text-xs font-semibold text-sm">Auto-verify Vehicle (requires registration number)</span>
                </label>
              </div>
            </div>
          </fieldset>

          {/* Bank */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-2 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Bank Details
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name:'accountHolderName', label:'Account Holder Name', placeholder:'Ramesh Kumar' },
                { name:'accountNumber',     label:'Account Number', placeholder:'XXXXXXXXXXXXXXXX' },
                { name:'ifscCode',          label:'IFSC Code', placeholder:'SBIN0012345' },
                { name:'bankName',          label:'Bank Name', placeholder:'State Bank of India' },
                { name:'upiId',             label:'UPI ID (optional)', placeholder:'ramesh@upi' },
              ].map(f => (
                <div key={f.name}>
                  <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">{f.label}</span></label>
                  <input name={f.name} type="text" placeholder={f.placeholder} className="input-field w-full text-sm" />
                </div>
              ))}
              <div>
                <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">Account Type</span></label>
                <select name="accountType" className="input-field w-full text-sm">
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label py-1 flex items-center gap-2">
                  <input type="checkbox" name="autoVerifyBank" value="true" className="checkbox checkbox-primary checkbox-sm" />
                  <span className="label-text text-xs font-semibold text-sm">Auto-verify Bank (requires full bank details + valid IFSC)</span>
                </label>
              </div>
            </div>
          </fieldset>

          {/* Business / Platform Fee */}
          <fieldset className="space-y-4">
            <legend className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-2 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> Business & Fee Settings
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">Business Type</span></label>
                <select name="businessType" className="input-field w-full text-sm">
                  <option value="individual">Individual</option>
                  <option value="proprietorship">Proprietorship</option>
                </select>
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">Settlement Cycle</span></label>
                <select name="settlementCycle" className="input-field w-full text-sm">
                  {['Daily','Weekly','Bi-Weekly','Monthly'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">Platform Fee Type</span></label>
                <select name="platformFeeType" className="input-field w-full text-sm">
                  <option value="">Use Global Config</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
                <p className="text-xs text-base-content/40 mt-1">Leave blank to use global platform config.</p>
              </div>
              <div>
                <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">Platform Fee Value</span></label>
                <input name="platformFeeValue" type="number" min="0" step="0.01" placeholder="e.g. 12 for 12% or 40 for ₹40" className="input-field w-full text-sm" />
              </div>
              <div className="sm:col-span-2">
                <label className="label py-1"><span className="label-text text-xs font-semibold text-sm">Internal Notes (admin only)</span></label>
                <textarea name="internalNotes" rows={2} placeholder="Internal notes about this partner..." className="input-field w-full text-sm resize-none" />
              </div>
            </div>
          </fieldset>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setView('list')} className="btn btn-ghost flex-1">Cancel</button>
            <button type="submit" className="btn btn-primary flex-1 gap-2" disabled={loadingCreate}>
              {loadingCreate ? <span className="loading loading-spinner loading-sm" /> : <Plus className="w-4 h-4" />}
              Create Partner
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // RENDER: COMPLIANCE VIEW
  // ═════════════════════════════════════════════════════════════════════════

  const renderCompliance = () => (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-base-content flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-error" /> Compliance Alerts
          </h2>
          <select
            onChange={(e) => dispatch(adminFetchComplianceAlerts({ days: Number(e.target.value) }))}
            className="input-field text-sm py-2 w-36"
          >
            <option value="30">Next 30 days</option>
            <option value="60">Next 60 days</option>
            <option value="90">Next 90 days</option>
          </select>
        </div>
        <p className="text-sm text-base-content/50 mb-4">{alertsTotal} active partners have expiring or expired documents.</p>

        {loadingAlerts ? (
          <div className="flex justify-center py-10"><span className="loading loading-spinner loading-lg text-primary" /></div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 text-base-content/30">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-success" />
            <p className="font-medium">All documents are up to date!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <motion.div
                key={a._id}
                variants={fadeUp}
                className="card p-4 border border-base-300 hover:border-error/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-base-content">{a.legalName}</p>
                    <p className="text-xs text-base-content/40 font-mono">{a.partnerCode} · {a.phone}</p>
                  </div>
                  <button
                    onClick={() => selectPartner(a._id)}
                    className="btn btn-ghost btn-xs"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {a.expiringDocs?.map((doc) => (
                    <div
                      key={doc.label}
                      className={`flex items-center gap-1.5 text-xs font-semibold text-sm px-2.5 py-1 rounded-lg border ${
                        doc.isExpired
                          ? 'bg-error/10 text-error border-error/30'
                          : doc.daysLeft <= 7
                          ? 'bg-warning/10 text-warning border-warning/30'
                          : 'bg-info/10 text-info border-info/30'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {doc.label}:
                      {doc.isExpired ? ' EXPIRED' : ` ${doc.daysLeft}d left`}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // MODALS
  // ═════════════════════════════════════════════════════════════════════════

  const renderModals = () => (
    <AnimatePresence>
      {/* Approve KYC */}
      {modal === 'approveKyc' && (
        <ConfirmModal
          title="Approve KYC"
          message="This will verify the partner's KYC documents. If vehicle and bank are also verified, the account will be auto-activated."
          onConfirm={() => handleVerifyKyc('approve')}
          onCancel={closeModal}
          loading={loadingKyc}
        />
      )}

      {/* Reject KYC */}
      {modal === 'rejectKyc' && (
        <ConfirmModal
          title="Reject KYC"
          message="Provide a clear reason. The partner will be notified and can re-submit."
          onConfirm={() => handleVerifyKyc('reject')}
          onCancel={closeModal}
          loading={loadingKyc}
          danger
        >
          <textarea
            className="input-field w-full text-sm resize-none mt-2"
            rows={3}
            placeholder="Rejection reason (required)..."
            onChange={(e) => setModalData(d => ({ ...d, reason: e.target.value }))}
          />
        </ConfirmModal>
      )}

      {/* Approve Vehicle */}
      {modal === 'approveVehicle' && (
        <ConfirmModal
          title="Approve Vehicle"
          message="This will verify the partner's vehicle. Auto-activation applies if KYC and bank are also verified."
          onConfirm={() => handleVerifyVehicle('approve')}
          onCancel={closeModal}
          loading={loadingVehicle}
        />
      )}

      {/* Reject Vehicle */}
      {modal === 'rejectVehicle' && (
        <ConfirmModal
          title="Reject Vehicle"
          message="Provide a reason. The partner must re-submit their vehicle for verification."
          onConfirm={() => handleVerifyVehicle('reject')}
          onCancel={closeModal}
          loading={loadingVehicle}
          danger
        >
          <textarea
            className="input-field w-full text-sm resize-none mt-2"
            rows={3}
            placeholder="Rejection reason (required)..."
            onChange={(e) => setModalData(d => ({ ...d, reason: e.target.value }))}
          />
        </ConfirmModal>
      )}

      {/* Verify Bank */}
      {modal === 'verifyBank' && (
        <ConfirmModal
          title="Verify Bank Account"
          message="Confirm that the bank details are valid and match the partner's identity. Auto-activation applies if KYC and vehicle are verified."
          onConfirm={handleVerifyBank}
          onCancel={closeModal}
          loading={loadingBank}
        />
      )}

      {/* Update Status */}
      {modal === 'status' && (
        <ConfirmModal
          title="Update Partnership Status"
          message="Choose the new partnership status for this partner."
          onConfirm={handleUpdateStatus}
          onCancel={closeModal}
          loading={loadingStatus}
          danger={['suspended','rejected'].includes(modalData.status)}
        >
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">New Status</label>
              <select
                className="input-field w-full text-sm"
                onChange={(e) => setModalData(d => ({ ...d, status: e.target.value }))}
                defaultValue=""
              >
                <option value="" disabled>Select status...</option>
                {['pending','under-review','active','suspended','rejected'].map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            {['suspended','rejected'].includes(modalData.status) && (
              <div>
                <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Reason (required)</label>
                <textarea
                  className="input-field w-full text-sm resize-none"
                  rows={3}
                  placeholder="Reason for suspension/rejection..."
                  onChange={(e) => setModalData(d => ({ ...d, reason: e.target.value }))}
                />
              </div>
            )}
          </div>
        </ConfirmModal>
      )}

      {/* Block */}
      {modal === 'block' && (
        <ConfirmModal
          title="Block Account"
          message="Blocking will immediately set the partner's status to Offline and prevent them from accepting rides."
          onConfirm={handleBlock}
          onCancel={closeModal}
          loading={loadingBlock}
          danger
        >
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Block Reason (required)</label>
              <textarea
                className="input-field w-full text-sm resize-none"
                rows={3}
                placeholder="Reason for blocking..."
                onChange={(e) => setModalData(d => ({ ...d, action: 'block', reason: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Auto-unblock Date (optional)</label>
              <input
                type="datetime-local"
                className="input-field w-full text-sm"
                onChange={(e) => setModalData(d => ({ ...d, unblockAt: e.target.value }))}
              />
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Unblock */}
      {modal === 'unblock' && (
        <ConfirmModal
          title="Unblock Account"
          message="This will restore the partner's ability to log in and accept rides. Ensure all compliance requirements are met."
          onConfirm={() => { setModalData(d => ({ ...d, action: 'unblock' })); handleBlock(); }}
          onCancel={closeModal}
          loading={loadingBlock}
        />
      )}

      {/* Platform Fee */}
      {modal === 'platformFee' && (
        <ConfirmModal
          title="Update Platform Fee & Settlement"
          message="Override the global platform fee for this partner. Leave blank to revert to global config."
          onConfirm={handleUpdateFee}
          onCancel={closeModal}
          loading={loadingFee}
        >
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Fee Type</label>
                <select
                  className="input-field w-full text-sm"
                  onChange={(e) => setModalData(d => ({
                    ...d,
                    platformFeeOverride: e.target.value
                      ? { ...(d.platformFeeOverride || {}), type: e.target.value }
                      : null,
                  }))}
                >
                  <option value="">Use Global</option>
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed (₹)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Value</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input-field w-full text-sm"
                  placeholder="e.g. 12"
                  onChange={(e) => setModalData(d => ({
                    ...d,
                    platformFeeOverride: {
                      ...(d.platformFeeOverride || { type: 'percentage' }),
                      value: parseFloat(e.target.value),
                    },
                  }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Settlement Cycle</label>
              <select
                className="input-field w-full text-sm"
                onChange={(e) => setModalData(d => ({ ...d, settlementCycle: e.target.value || undefined }))}
              >
                <option value="">Keep existing</option>
                {['Daily','Weekly','Bi-Weekly','Monthly'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Notes */}
      {modal === 'notes' && (
        <ConfirmModal
          title="Update Admin Notes"
          message="These notes are admin-only and not visible to the partner."
          onConfirm={handleUpdateNotes}
          onCancel={closeModal}
          loading={loadingNotes}
        >
          <textarea
            className="input-field w-full text-sm resize-none mt-2"
            rows={5}
            maxLength={1000}
            placeholder="Admin notes (max 1000 chars)..."
            defaultValue={selected?.adminNotes || ''}
            onChange={(e) => setModalData(d => ({ ...d, notes: e.target.value }))}
          />
        </ConfirmModal>
      )}

      {/* Award Badge */}
      {modal === 'awardBadge' && (
        <ConfirmModal
          title="Award Badge"
          message="Award a recognition badge to this partner. Badges already earned cannot be re-awarded."
          onConfirm={handleAwardBadge}
          onCancel={closeModal}
          loading={loadingBadge}
        >
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Badge</label>
              <select
                className="input-field w-full text-sm"
                onChange={(e) => {
                  const val = e.target.value;
                  setModalData(d => ({ ...d, badgeId: val, badgeName: val.replace(/_/g, ' ') }));
                }}
              >
                <option value="">Select badge...</option>
                {['FIRST_RIDE','RIDES_10','RIDES_50','RIDES_100','RIDES_500','RIDES_1000',
                  'TOP_RATED','PERFECT_WEEK','ZERO_CANCEL_MONTH','SAFE_DRIVER','NIGHT_OWL',
                  'LONG_HAUL','VERIFIED_DRIVER','LOYAL_DRIVER_1Y','SOLO_PARTNER'].map(b => (
                  <option key={b} value={b}>{b.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Description (optional)</label>
              <input
                type="text"
                className="input-field w-full text-sm"
                placeholder="Badge description..."
                onChange={(e) => setModalData(d => ({ ...d, badgeDesc: e.target.value }))}
              />
            </div>
          </div>
        </ConfirmModal>
      )}

      {/* Adjust Coins */}
      {modal === 'adjustCoins' && (
        <ConfirmModal
          title="Adjust Coins Balance"
          message="Credit or debit coins from the partner's reward wallet. All adjustments are logged."
          onConfirm={handleAdjustCoins}
          onCancel={closeModal}
          loading={loadingCoins}
        >
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Action</label>
                <select
                  className="input-field w-full text-sm"
                  onChange={(e) => setModalData(d => ({ ...d, coinType: e.target.value }))}
                >
                  <option value="">Select...</option>
                  <option value="ADMIN_CREDIT">Credit (Add coins)</option>
                  <option value="ADMIN_DEBIT">Debit (Remove coins)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Amount</label>
                <input
                  type="number"
                  min="1"
                  className="input-field w-full text-sm"
                  placeholder="e.g. 100"
                  onChange={(e) => setModalData(d => ({ ...d, coinAmount: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-base-content/50 uppercase tracking-wider block mb-1">Description (required)</label>
              <input
                type="text"
                className="input-field w-full text-sm"
                placeholder="Reason for adjustment..."
                onChange={(e) => setModalData(d => ({ ...d, coinDesc: e.target.value }))}
              />
            </div>
            <p className="text-xs text-base-content/40">
              Current balance: <strong>{selected?.user?.coins || 0} coins</strong>
            </p>
          </div>
        </ConfirmModal>
      )}
    </AnimatePresence>
  );

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE LAYOUT
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-base-100">
      {/* Document Viewer Overlay */}
      <DocViewer url={docViewer?.url} label={docViewer?.label} onClose={() => setDocViewer(null)} />

      {/* Modals */}
      {renderModals()}

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-md border-b border-base-300"
      >
        <div className="container-custom flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            {(view === 'detail' || view === 'create' || view === 'compliance') && (
              <button
                onClick={() => setView('list')}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-primary/10">
                <Truck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-black text-base-content leading-tight">Solo Driver Partners</h1>
                <p className="text-xs text-base-content/40">
                  {view === 'list' ? 'All Partners' : view === 'detail' ? selected?.legalName || 'Partner Detail' : view === 'create' ? 'Create Partner' : 'Compliance Alerts'}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-base-content/40 hidden sm:block">
              {user?.name} · {user?.role}
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
              {user?.name?.[0] || 'A'}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main */}
      <div className="container-custom py-6">
        <AnimatePresence mode="wait">
          {view === 'list'       && <motion.div key="list"       initial="hidden" animate="show" exit="exit" variants={fadeUp}>{renderList()}</motion.div>}
          {view === 'detail'     && <motion.div key="detail"     initial="hidden" animate="show" exit="exit" variants={fadeUp}>{renderDetail()}</motion.div>}
          {view === 'create'     && <motion.div key="create"     initial="hidden" animate="show" exit="exit" variants={fadeUp}>{renderCreate()}</motion.div>}
          {view === 'compliance' && <motion.div key="compliance" initial="hidden" animate="show" exit="exit" variants={fadeUp}>{renderCompliance()}</motion.div>}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Overview Tab ──────────────────────────────────────────────────────────────
function TabOverview({ p, u, dp, onViewDoc }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SectionCard title="Personal Details" icon={UserCheck}>
        <div className="space-y-0">
          <DocField label="Legal Name" value={p.legalName} onView={onViewDoc} />
          <DocField label="Display Name" value={p.displayName} onView={onViewDoc} />
          <DocField label="Date of Birth" value={fmtDate(p.dateOfBirth)} onView={onViewDoc} />
          <DocField label="Gender" value={p.gender} onView={onViewDoc} />
          <DocField label="Bio" value={p.bio} onView={onViewDoc} />
          <DocField label="Languages Spoken" value={p.languagesSpoken?.join(', ')} onView={onViewDoc} />
          <DocField label="Years of Experience" value={p.yearsOfExperience} onView={onViewDoc} />
          {p.profilePhotoUrl && <DocField label="Profile Photo" value="Uploaded" docUrl={p.profilePhotoUrl} onView={onViewDoc} />}
        </div>
      </SectionCard>

      <SectionCard title="Contact Information" icon={Phone}>
        <div className="space-y-0">
          <DocField label="Phone" value={p.phone} onView={onViewDoc} />
          <DocField label="Alt Phone" value={p.altPhone} onView={onViewDoc} />
          <DocField label="WhatsApp" value={p.whatsappNumber} onView={onViewDoc} />
          <DocField label="Email" value={p.email} onView={onViewDoc} />
          <div className="pt-3 mt-3 border-t border-base-300/50">
            <p className="text-xs text-base-content/40 font-semibold text-sm uppercase tracking-wider mb-2">Address</p>
            <p className="text-sm text-base-content">
              {[p.address?.street, p.address?.city, p.address?.state, p.address?.pinCode, p.address?.country]
                .filter(Boolean).join(', ') || '—'}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Emergency Contact" icon={AlertTriangle}>
        <div className="space-y-0">
          <DocField label="Name" value={p.emergencyContact?.name} onView={onViewDoc} />
          <DocField label="Relationship" value={p.emergencyContact?.relationship} onView={onViewDoc} />
          <DocField label="Phone" value={p.emergencyContact?.phone} onView={onViewDoc} />
        </div>
      </SectionCard>

      <SectionCard title="Linked User Account" icon={Shield}>
        <div className="space-y-0">
          <DocField label="User ID" value={u._id} onView={onViewDoc} />
          <DocField label="Name" value={u.name} onView={onViewDoc} />
          <DocField label="Email" value={u.email} onView={onViewDoc} />
          <DocField label="Role" value={u.role} onView={onViewDoc} />
          <DocField label="Email Verified" value={u.isEmailVerified ? '✅ Yes' : '❌ No'} onView={onViewDoc} />
          <DocField label="Phone Verified" value={u.isPhoneVerified ? '✅ Yes' : '❌ No'} onView={onViewDoc} />
          <DocField label="Last Login" value={fmtDate(u.lastLoginAt)} onView={onViewDoc} />
          <DocField label="Login Count" value={u.loginCount} onView={onViewDoc} />
          <DocField label="Referral Code" value={u.referralCode} onView={onViewDoc} />
          <DocField label="Coins (User wallet)" value={u.coins} onView={onViewDoc} />
        </div>
      </SectionCard>

      <SectionCard title="Business & Partnership" icon={Building2} className="lg:col-span-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoRow label="Partner Code" value={p.partnerCode} />
          <InfoRow label="Business Type" value={p.businessType} />
          <InfoRow label="Trade Name" value={p.tradeName} />
          <InfoRow label="GST Number" value={p.gstNumber} />
          <InfoRow label="Settlement Cycle" value={p.settlementCycle} />
          <InfoRow label="Platform Fee" value={
            p.platformFeeOverride
              ? `${p.platformFeeOverride.type === 'percentage' ? p.platformFeeOverride.value + '%' : '₹' + p.platformFeeOverride.value} (override)`
              : 'Global Config'
          } />
          <InfoRow label="Partnership Status" value={p.partnershipStatus} />
          <InfoRow label="Partner Since" value={fmtDate(p.partnerSince)} />
          <InfoRow label="Onboarding Complete" value={p.isOnboardingComplete ? '✅ Yes' : '❌ No'} />
          <InfoRow label="Profile Completion" value={`${p.profileCompletionPercent || 0}%`} />
          <InfoRow label="Is Blocked" value={u.isBlocked ? '🚫 Yes' : '✅ No'} />
          <InfoRow label="Is Paused" value={dp.isPaused ? `⏸️ Until ${fmtDate(dp.pausedUntil)}` : '✅ No'} />
        </div>
      </SectionCard>

      {p.trainingCertificates?.length > 0 && (
        <SectionCard title="Training Certificates" icon={Award} className="lg:col-span-2">
          <div className="space-y-2">
            {p.trainingCertificates.map((cert, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-base-300/50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-sm text-base-content">{cert.name}</p>
                  <p className="text-xs text-base-content/40">{cert.issuedBy} · {fmtDate(cert.issuedAt)} · Expires: {fmtDate(cert.expiresAt)}</p>
                </div>
                {cert.documentUrl && (
                  <button
                    onClick={() => onViewDoc(cert.documentUrl, cert.name)}
                    className="btn btn-ghost btn-xs gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </motion.div>
  );
}

// ── KYC Tab ───────────────────────────────────────────────────────────────────
function TabKyc({ p, onView, onApprove, onReject }) {
  const kyc = p.kyc || {};
  const verified = kyc.verificationStatus === 'verified' || kyc.verificationStatus === 'Verified';
  const rejected = kyc.verificationStatus === 'rejected' || kyc.verificationStatus === 'Rejected';
  const pending  = ['pending', 'under-review', 'Pending', 'Under-Review'].includes(kyc.verificationStatus);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      {/* Status banner */}
      <motion.div
        variants={fadeUp}
        className={`card p-4 border ${
          verified ? 'border-success/40 bg-success/5' :
          rejected ? 'border-error/40 bg-error/5' :
          pending  ? 'border-warning/40 bg-warning/5' : 'border-base-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${verified ? 'bg-success/10' : rejected ? 'bg-error/10' : 'bg-warning/10'}`}>
              {verified ? <CheckCircle className="w-5 h-5 text-success" /> :
               rejected ? <XCircle className="w-5 h-5 text-error" /> :
               <Clock className="w-5 h-5 text-warning" />}
            </div>
            <div>
              <p className="font-bold text-base-content">{KYC_STATUS_LABELS[kyc.verificationStatus] || '—'}</p>
              <p className="text-xs text-base-content/40">
                {verified ? `Verified by admin · ${fmtDate(kyc.verifiedAt)}` :
                 rejected ? `Rejected: ${kyc.rejectionReason}` :
                 kyc.submittedAt ? `Submitted: ${fmtDate(kyc.submittedAt)}` : 'Not submitted yet'}
              </p>
            </div>
          </div>
          {!verified && (
            <div className="flex gap-2">
              {pending && (
                <button onClick={onApprove} className="btn btn-success btn-sm gap-2">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              )}
              <button onClick={onReject} className="btn btn-error btn-sm gap-2">
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Driving Licence" icon={FileText}>
          <DocField label="DL Number" value={kyc.drivingLicenceNumber} onView={onView} />
          <DocField label="DL Expiry" value={fmtDate(kyc.drivingLicenceExpiry)} onView={onView} />
          <DocField label="Licence Class" value={kyc.licenceClass?.join(', ')} onView={onView} />
          {kyc.drivingLicenceDocUrl && <DocField label="DL Document" value="Uploaded" docUrl={kyc.drivingLicenceDocUrl} onView={onView} />}
        </SectionCard>

        <SectionCard title="Aadhaar" icon={UserCheck}>
          <DocField label="Aadhaar (masked)" value={kyc.aadhaarLast4 ? `XXXX XXXX ${kyc.aadhaarLast4}` : '—'} onView={onView} />
          <DocField label="Aadhaar Verified" value={kyc.aadhaarVerified ? '✅ Yes' : '❌ No'} onView={onView} />
          {kyc.aadhaarFrontUrl && <DocField label="Aadhaar Front" value="Uploaded" docUrl={kyc.aadhaarFrontUrl} onView={onView} />}
          {kyc.aadhaarBackUrl  && <DocField label="Aadhaar Back"  value="Uploaded" docUrl={kyc.aadhaarBackUrl}  onView={onView} />}
        </SectionCard>

        <SectionCard title="PAN Card" icon={Hash}>
          <DocField label="PAN Number (masked)" value={kyc.panNumber ? `${kyc.panNumber?.slice(0,3)}XX${kyc.panNumber?.slice(-2)}` : '—'} onView={onView} />
          <DocField label="PAN Verified" value={kyc.panVerified ? '✅ Yes' : '❌ No'} onView={onView} />
          {kyc.panCardUrl && <DocField label="PAN Card" value="Uploaded" docUrl={kyc.panCardUrl} onView={onView} />}
        </SectionCard>

        <SectionCard title="PSV Badge" icon={BadgeCheck}>
          <DocField label="PSV Badge Number" value={kyc.psvBadgeNumber} onView={onView} />
          <DocField label="PSV Badge Expiry"  value={fmtDate(kyc.psvBadgeExpiry)} onView={onView} />
          {kyc.psvBadgeDocUrl && <DocField label="PSV Badge Doc" value="Uploaded" docUrl={kyc.psvBadgeDocUrl} onView={onView} />}
        </SectionCard>

        <SectionCard title="Medical Fitness" icon={Activity} className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <InfoRow label="Certificate No." value={p.medicalFitness?.certificateNumber} />
            <InfoRow label="Issued By" value={p.medicalFitness?.issuedBy} />
            <InfoRow label="Issued At" value={fmtDate(p.medicalFitness?.issuedAt)} />
            <InfoRow label="Expiry Date" value={fmtDate(p.medicalFitness?.expiryDate)} />
            <InfoRow label="Blood Group" value={p.medicalFitness?.bloodGroup} />
            <InfoRow label="Is Valid" value={p.medicalFitness?.isValid ? '✅ Yes' : '❌ No'} />
          </div>
          {p.medicalFitness?.documentUrl && (
            <div className="mt-3 pt-3 border-t border-base-300/50">
              <DocField label="Medical Certificate" value="Uploaded" docUrl={p.medicalFitness.documentUrl} onView={onView} />
            </div>
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
}

// ── Vehicle Tab ───────────────────────────────────────────────────────────────
function TabVehicle({ p, onView, onApprove, onReject }) {
  // Use p.vehicleStatus from SoloDriverPartner root, merging with driverProfile.assignedVehicleSnapshot
  const vStatus = p.vehicleStatus || {};
  const vSnap = p.driverProfile?.assignedVehicleSnapshot || {};
  
  const verified = vStatus.verificationStatus === 'verified';
  const rejected = vStatus.verificationStatus === 'rejected';
  const pending  = ['pending', 'under-review'].includes(vStatus.verificationStatus);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      {/* Status banner */}
      <motion.div
        variants={fadeUp}
        className={`card p-4 border ${
          verified ? 'border-success/40 bg-success/5' :
          rejected ? 'border-error/40 bg-error/5' :
          pending  ? 'border-warning/40 bg-warning/5' : 'border-base-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${verified ? 'bg-success/10' : rejected ? 'bg-error/10' : 'bg-warning/10'}`}>
              {verified ? <CheckCircle className="w-5 h-5 text-success" /> :
               rejected ? <XCircle className="w-5 h-5 text-error" /> :
               <Clock className="w-5 h-5 text-warning" />}
            </div>
            <div>
              <p className="font-bold text-base-content">
                Vehicle {vStatus.verificationStatus ? vStatus.verificationStatus.charAt(0).toUpperCase() + vStatus.verificationStatus.slice(1) : 'Not submitted'}
              </p>
              <p className="text-xs text-base-content/40">
                {verified ? `Verified (via Global Vehicles list)` :
                 rejected ? `Rejected` : 'Awaiting verification'}
              </p>
            </div>
          </div>
          {!verified && (
            <div className="flex gap-2">
              {(pending || vStatus.registrationNumber) && (
                <button onClick={onApprove} className="btn btn-success btn-sm gap-2">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
              )}
              <button onClick={onReject} className="btn btn-error btn-sm gap-2">
                <XCircle className="w-4 h-4" /> Reject
              </button>
            </div>
          )}
        </div>
      </motion.div>

      <div className="alert alert-info text-sm mb-4 border-info/20 bg-info/5">
        <Info className="w-4 h-4 shrink-0" />
        <div>
          <h3 className="font-semibold text-sm">Standalone Vehicle Data</h3>
          <p className="text-base-content/70 text-sm mt-0.5">
            Vehicles are now managed in a standalone, global collection. This tab shows the cached snapshot assigned to this driver. To view full vehicle documents (RC, Insurance, photos), please navigate to the global <strong>Vehicles Tab</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Cached Vehicle Snapshot" icon={Car}>
          <DocField label="Registration Number" value={vStatus.registrationNumber || vSnap.registrationNumber} onView={onView} />
          <DocField label="Vehicle Code" value={vSnap.vehicleCode} onView={onView} />
          <DocField label="Make" value={vSnap.make} onView={onView} />
          <DocField label="Model" value={vSnap.model} onView={onView} />
          <DocField label="Type" value={vSnap.vehicleType} onView={onView} />
          <DocField label="Color" value={vSnap.color} onView={onView} />
          <DocField label="Is Active (Cache)" value={vStatus.isActive ? '✅ Yes' : '❌ No'} onView={onView} />
        </SectionCard>
      </div>
    </motion.div>
  );
}

// ── Bank Tab ──────────────────────────────────────────────────────────────────
function TabBank({ p, onView, onVerify }) {
  const b = p.bankDetails || {};

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      {/* Status banner */}
      <motion.div
        variants={fadeUp}
        className={`card p-4 border ${b.isVerified ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${b.isVerified ? 'bg-success/10' : 'bg-warning/10'}`}>
              {b.isVerified ? <CheckCircle className="w-5 h-5 text-success" /> : <Clock className="w-5 h-5 text-warning" />}
            </div>
            <div>
              <p className="font-bold text-base-content">
                Bank {b.isVerified ? 'Verified ✅' : b.accountLast4 ? 'Submitted — Pending Verification ⏳' : 'Not submitted'}
              </p>
              <p className="text-xs text-base-content/40">
                {b.isVerified ? `Verified · ${fmtDate(b.verifiedAt)}` : 'Bank details require manual verification'}
              </p>
            </div>
          </div>
          {!b.isVerified && b.accountLast4 && (
            <button onClick={onVerify} className="btn btn-success btn-sm gap-2">
              <CheckCircle className="w-4 h-4" /> Verify Bank
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Bank Account Details" icon={CreditCard}>
          <DocField label="Account Holder" value={b.accountHolderName} onView={onView} />
          <DocField label="Account (masked)" value={b.accountLast4 ? `XXXX XXXX XXXX ${b.accountLast4}` : '—'} onView={onView} />
          <DocField label="IFSC Code" value={b.ifscCode} onView={onView} />
          <DocField label="Bank Name" value={b.bankName} onView={onView} />
          <DocField label="Account Type" value={b.accountType} onView={onView} />
          <DocField label="UPI ID" value={b.upiId} onView={onView} />
          <DocField label="UPI Name" value={b.upiName} onView={onView} />
          {b.cancelledChequeUrl && <DocField label="Cancelled Cheque" value="Uploaded" docUrl={b.cancelledChequeUrl} onView={onView} />}
        </SectionCard>

        <SectionCard title="Settlement Summary" icon={Wallet}>
          <DocField label="Settlement Cycle" value={p.settlementCycle} onView={onView} />
          <DocField label="Preferred Method" value={p.settlement?.preferredMethod} onView={onView} />
          <div className="mt-3 pt-3 border-t border-base-300/50 space-y-2">
            <InfoRow label="Total Earnings" value={fmtCurrency(p.stats?.totalEarnings)} />
            <InfoRow label="Platform Fee Paid" value={fmtCurrency(p.stats?.totalPlatformFeePaid)} />
            <InfoRow label="Net Earnings" value={fmtCurrency((p.stats?.totalEarnings || 0) - (p.stats?.totalPlatformFeePaid || 0))} />
          </div>
        </SectionCard>
      </div>
    </motion.div>
  );
}

// ── Performance Tab ───────────────────────────────────────────────────────────
function TabPerformance({ p }) {
  const stats = p.stats || {};
  const rating = p.rating || {};
  const dPerf = p.performance || p.driverProfile?.performance || p.stats || {};

  const metrics = [
    { label: 'Total Rides',       value: stats.totalRidesCompleted  || 0, icon: Activity,    color: 'text-primary' },
    { label: 'Cancelled',         value: stats.totalRidesCancelled  || 0, icon: XCircle,     color: 'text-error'   },
    { label: 'Disputed',          value: stats.totalRidesDisputed   || 0, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Rating',            value: `${(rating.averageRating || 0).toFixed(1)} ⭐ (${rating.totalRatings || 0})`, icon: Star, color: 'text-accent' },
    { label: 'Total Earnings',    value: fmtCurrency(stats.totalEarnings),       icon: Wallet,      color: 'text-success' },
    { label: 'Platform Fee Paid', value: fmtCurrency(stats.totalPlatformFeePaid), icon: TrendingUp,  color: 'text-info'    },
    { label: 'Total Distance',    value: `${(dPerf.totalDistanceKm || 0).toFixed(1)} km`, icon: MapPin, color: 'text-secondary' },
    { label: 'Cancel Rate',       value: `${(dPerf.cancellationRate || 0).toFixed(1)}%`, icon: BarChart3, color: 'text-error'  },
    { label: 'On-Time Arrival',   value: `${(stats.onTimeArrivalRate || 100).toFixed(1)}%`, icon: Clock, color: 'text-success' },
    { label: 'Avg Pickup Time',   value: `${(stats.averagePickupTimeMinutes || 0).toFixed(1)} min`, icon: Zap, color: 'text-info'   },
    { label: 'Monthly Rides',     value: dPerf.monthlyRides         || 0, icon: PieChart,   color: 'text-primary' },
    { label: 'Last Ride',         value: fmtDate(stats.lastRideAt),      icon: Calendar,   color: 'text-base-content/60' },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {metrics.map((s) => (
          <motion.div key={s.label} variants={fadeUp} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-base-content/40 font-semibold text-sm uppercase tracking-wider">{s.label}</span>
            </div>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div variants={fadeUp} className="card p-5">
        <h3 className="font-bold text-sm text-base-content/60 uppercase tracking-wider mb-4">Performance Metrics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoRow label="Performance Tier" value={dPerf.performanceTier} />
          <InfoRow label="Warning Count" value={dPerf.warningCount} />
          <InfoRow label="Complaints" value={dPerf.complaintsCount} />
          <InfoRow label="Compliments" value={dPerf.complimentsCount} />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Rewards Tab ───────────────────────────────────────────────────────────────
function TabRewards({ p, onAwardBadge, onAdjustCoins }) {
  const r = p.rewards || p.driverProfile?.rewards || {};
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Coin Balance',   value: p.user?.coins || 0, icon: Coins,    color: 'text-accent'   },
          { label: 'Total Earned',   value: r.totalCoinsEarned   || 0, icon: TrendingUp, color: 'text-success' },
          { label: 'Total Redeemed', value: r.totalCoinsRedeem || 0, icon: Wallet,  color: 'text-warning'  },
          { label: 'Reward Tier',    value: r.tier               || 'Bronze', icon: Award, color: 'text-primary' },
        ].map((s) => (
          <motion.div key={s.label} variants={fadeUp} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-base-content/40 font-semibold text-sm uppercase tracking-wider">{s.label}</span>
            </div>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Actions */}
      <motion.div variants={fadeUp} className="flex gap-3">
        <button onClick={onAwardBadge} className="btn btn-primary btn-sm gap-2">
          <Award className="w-4 h-4" /> Award Badge
        </button>
        <button onClick={onAdjustCoins} className="btn btn-accent btn-sm gap-2">
          <Coins className="w-4 h-4" /> Adjust Coins
        </button>
      </motion.div>

      {/* Badges */}
      <motion.div variants={fadeUp} className="card p-5">
        <h3 className="font-bold text-sm text-base-content/60 uppercase tracking-wider mb-4">Earned Badges ({r.badges?.length || 0})</h3>
        {!r.badges?.length ? (
          <p className="text-sm text-base-content/40">No badges earned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {r.badges.map((b) => (
              <div
                key={b.badgeId}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-accent/30 bg-accent/5"
              >
                <Award className="w-4 h-4 text-accent" />
                <div>
                  <p className="text-xs font-bold text-base-content">{b.name}</p>
                  <p className="text-xs text-base-content/40">{fmtDate(b.earnedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Coin transactions */}
      {r.coinTransactions?.length > 0 && (
        <motion.div variants={fadeUp} className="card p-5">
          <h3 className="font-bold text-sm text-base-content/60 uppercase tracking-wider mb-4">Recent Coin Transactions</h3>
          <div className="space-y-2">
            {r.coinTransactions.slice(-10).reverse().map((tx, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-base-300/50 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-sm text-base-content">{tx.description}</p>
                  <p className="text-xs text-base-content/40">{tx.type} · {fmtDate(tx.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${['EARN','BONUS','ADMIN_CREDIT'].includes(tx.type) ? 'text-success' : 'text-error'}`}>
                    {['EARN','BONUS','ADMIN_CREDIT'].includes(tx.type) ? '+' : '-'}{tx.amount}
                  </p>
                  <p className="text-xs text-base-content/40">Bal: {tx.balance}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Dispatch Tab ──────────────────────────────────────────────────────────────
function TabDispatch({ p }) {
  const dp = p.dispatch || p.driverProfile || {};

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard title="Current Dispatch State" icon={Zap}>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-2.5 border-b border-base-300/50">
              <span className="text-xs text-base-content/50 font-medium uppercase tracking-wider">Status</span>
              <span className={`font-bold text-sm ${
                dp.status === 'Available' ? 'text-success' :
                dp.status === 'On-Trip'   ? 'text-info'    :
                dp.status === 'On-Break'  ? 'text-warning' : 'text-base-content/40'
              }`}>{dp.status || 'Offline'}</span>
            </div>
            <DocField label="Current Ride" value={dp.currentRide ? String(dp.currentRide) : 'None'} onView={() => {}} />
            <DocField label="Is Blocked" value={dp.isBlocked ? '🚫 Yes' : '✅ No'} onView={() => {}} />
            <DocField label="Is Paused" value={dp.isPaused ? `⏸️ Until ${fmtDate(dp.pausedUntil)}` : '✅ No'} onView={() => {}} />
            <DocField label="Pause Reason" value={dp.pauseReason} onView={() => {}} />
          </div>
        </SectionCard>

        <SectionCard title="Live Location" icon={MapPin}>
          <div className="space-y-0">
            <DocField label="Longitude" value={dp.location?.coordinates?.[0]} onView={() => {}} />
            <DocField label="Latitude"  value={dp.location?.coordinates?.[1]} onView={() => {}} />
            <DocField label="Heading"   value={dp.location?.heading !== undefined ? `${dp.location.heading}°` : '—'} onView={() => {}} />
            <DocField label="Speed"     value={dp.location?.speedKmh !== undefined ? `${dp.location.speedKmh} km/h` : '—'} onView={() => {}} />
            <DocField label="Last Updated" value={fmtDate(dp.location?.updatedAt)} onView={() => {}} />
          </div>
        </SectionCard>

        <SectionCard title="Shift Preferences" icon={Calendar}>
          <div className="space-y-0">
<DocField label="Shift Type"      value={dp.shift?.shiftType || dp.shiftType}       onView={() => {}} />
            <DocField label="Start Time"      value={dp.shift?.startTime || dp.shiftStart}       onView={() => {}} />
            <DocField label="End Time"        value={dp.shift?.endTime || dp.shiftEnd}         onView={() => {}} />
            <DocField label="Days Available"  value={dp.shift?.daysAvailable?.join(', ') || dp.daysAvailable?.join(', ')} onView={() => {}} />
            <DocField label="Next Available"  value={fmtDate(dp.shift?.nextAvailableAt || dp.nextAvailableAt)} onView={() => {}} />
          </div>
        </SectionCard>

        <SectionCard title="Service Zones" icon={MapPin}>
          {!p.serviceZones?.length ? (
            <p className="text-sm text-base-content/40">No service zones configured.</p>
          ) : (
            <div className="space-y-2">
              {p.serviceZones.map((z, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-base-300/50 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-sm text-base-content">{z.city}, {z.state}</p>
                    <p className="text-xs text-base-content/40">{z.radiusKm}km radius · {z.pinCodes?.join(', ')}</p>
                  </div>
                  <span className={`text-xs font-bold ${z.isActive ? 'text-success' : 'text-base-content/40'}`}>
                    {z.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Pricing Preferences" icon={Wallet} className="lg:col-span-2">
          {!p.pricing ? (
            <p className="text-sm text-base-content/40">No pricing configured.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoRow label="Base Fare" value={fmtCurrency(p.pricing.baseFare)} />
              <InfoRow label="Per KM" value={fmtCurrency(p.pricing.baseFarePerKm)} />
              <InfoRow label="Minimum Fare" value={fmtCurrency(p.pricing.minimumFare)} />
              <InfoRow label="Waiting / min" value={fmtCurrency(p.pricing.waitingChargePerMin)} />
              <InfoRow label="Free Waiting" value={`${p.pricing.freeWaitingMinutes} min`} />
              <InfoRow label="Night Surcharge" value={`${p.pricing.nightSurchargePercent}%`} />
              <InfoRow label="Wheelchair Surcharge" value={fmtCurrency(p.pricing.wheelchairSurcharge)} />
              <InfoRow label="Platform Fee (effective)" value={
                p.platformFeeOverride
                  ? `${p.platformFeeOverride.type === 'percentage' ? p.platformFeeOverride.value + '%' : '₹' + p.platformFeeOverride.value} (override)`
                  : 'Global Config'
              } />
            </div>
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
}

// ── Actions Tab ───────────────────────────────────────────────────────────────
function TabActions({ p, onFee, onNotes, onStatus, onBlock }) {
  const isUserBlocked = p.user?.isBlocked;
  
  const actions = [
    {
      title: 'Update Partnership Status',
      desc:  'Set to active, suspended, rejected, under-review, or pending. Suspended/rejected accounts are auto-blocked.',
      icon:  Edit3,
      color: 'var(--btn-primary)',
      onClick: onStatus,
    },
    {
      title: isUserBlocked ? 'Unblock Account' : 'Block Account',
      desc:  isUserBlocked
        ? 'Restore the partner\'s ability to log in and accept rides.'
        : 'Block this account. The partner will be forced Offline immediately.',
      icon:  isUserBlocked ? Unlock : Ban,
      color: isUserBlocked ? 'btn-success' : 'btn-error',
      onClick: onBlock,
    },
    {
      title: 'Override Platform Fee',
      desc:  'Set a custom platform fee (fixed ₹ or % of ride fare) for this partner, overriding the global config.',
      icon:  Wallet,
      color: 'btn-accent',
      onClick: onFee,
    },
    {
      title: 'Admin Notes',
      desc:  'Add or update internal notes about this partner. Notes are never visible to the partner.',
      icon:  ClipboardList,
      color: 'btn-ghost',
      onClick: onNotes,
    },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {actions.map((a) => (
          <motion.div key={a.title} variants={fadeUp} whileHover={{ y: -3 }} className="card p-5">
            <div className="flex   items-start gap-4">
              <div className="p-3 rounded-2xl bg-base-200 flex-shrink-0">
                <a.icon className="w-5 h-5 text-base-content/70 text-sm" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-base-content text-sm mb-1">{a.title}</h4>
                <p className="text-xs text-base-content/50 mb-3 leading-relaxed">{a.desc}</p>
                <button onClick={a.onClick} className={`btn ${a.color}  btn-sm gap-2`}>
                  <a.icon className="w-3.5 h-3.5" /> {a.title}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Current Settings Overview */}
      <motion.div variants={fadeUp} className="card p-5 mt-5">
        <h3 className="font-bold text-sm text-base-content/60 uppercase tracking-wider mb-4">Current Account Settings</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <InfoRow label="Partnership Status" value={p.partnershipStatus} />
          <InfoRow label="Is Blocked" value={isUserBlocked ? '🚫 Yes' : '✅ No'} />
          <InfoRow label="Block Reason" value={p.user?.blockReason} />
          <InfoRow label="Settlement Cycle" value={p.settlementCycle} />
          <InfoRow label="Platform Fee" value={
            p.platformFeeOverride
              ? `${p.platformFeeOverride.type === 'percentage' ? p.platformFeeOverride.value + '%' : '₹' + p.platformFeeOverride.value}`
              : 'Global Config'
          } />
          <InfoRow label="Onboarding" value={p.isOnboardingComplete ? '✅ Complete' : '❌ Incomplete'} />
          <InfoRow label="KYC Status" value={p.kyc?.verificationStatus} />
          <InfoRow label="Vehicle Status" value={(p.vehicleStatus || p.vehicle)?.verificationStatus} />
          <InfoRow label="Bank Verified" value={p.bankDetails?.isVerified ? '✅ Yes' : '❌ No'} />
          <InfoRow label="Created By" value={p.createdBy?.name || p.createdBy} />
          <InfoRow label="Last Updated" value={fmtDate(p.updatedAt)} />
          <InfoRow label="Created At" value={fmtDate(p.createdAt)} />
        </div>
      </motion.div>
    </motion.div>
  );
}