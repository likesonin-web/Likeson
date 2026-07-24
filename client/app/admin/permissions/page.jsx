'use client';

/**
 * PermissionsPage.jsx — Single-file admin permissions dashboard
 *
 * Integrates with:
 *   - Redux slice: store/slices/userSlice.js  (adminGetAllUsers, adminUpdateRole,
 *                                              adminSuspendUser, adminUnblockUser, adminResetOtp)
 *   - global.css design tokens (--primary, --error, --success, etc.)
 *
 * Stack: Next.js · Redux Toolkit · Tailwind CSS · Framer Motion · Recharts · Lucide
 *
 * FIXES APPLIED:
 *  1. ROLE_META: added 'lab_partner' (was 'lab partner' with space) + 'blood_bank'
 *  2. loaders keys: adminSuspend → adminSuspendUser, adminUnblock → adminUnblockUser
 *  3. ALL_ROLES_LIST auto-corrected via ROLE_META fix
 *  4. BADGE_CLASS: added 'accent' variant (used by lab_partner)
 *  5. ROLE_META color for blood_bank mapped to 'error' (crimson theme)
 */

import {
  useState, useEffect, useCallback, useRef, useMemo, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import {
  Users, ShieldAlert, ShieldCheck, Activity,
  Search, SlidersHorizontal, RefreshCw, X,
  Shield, ShieldOff, RotateCcw, ChevronDown,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Wifi, WifiOff, BadgeCheck, Clock,
} from 'lucide-react';

import {
  adminGetAllUsers,
  adminUpdateRole,
  adminSuspendUser,
  adminUnblockUser,
  adminResetOtp,
} from '@/store/slices/userSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Only these 4 roles may be assigned through this UI panel */
const ALLOWED_ROLES = ['superadmin', 'admin', 'finance', 'customer'];

// FIX 1: 'lab partner' (space) → 'lab_partner' (underscore, matches schema)
// FIX 1: Added 'blood_bank' role (present in schema, missing here)
const ROLE_META = {
  superadmin:        { label: 'Superadmin',    color: 'error',   icon: '👑' },
  admin:             { label: 'Admin',          color: 'warning', icon: '🛡️' },
  customer:          { label: 'Customer',       color: 'info',    icon: '👤' },
  hospital:          { label: 'Hospital',       color: 'primary', icon: '🏥' },
  solodriverpartner: { label: 'Solo Driver',    color: 'primary', icon: '🚘' },
  care_assistant:    { label: 'Care Assistant', color: 'success', icon: '🩺' },
  doctor:            { label: 'Doctor',         color: 'primary', icon: '⚕️' },
  driver:            { label: 'Driver',         color: 'error',   icon: '🚗' },
  pharmacy:          { label: 'Pharmacy',       color: 'accent',  icon: '💊' },
  transportpartner:  { label: 'Transport',      color: 'error',   icon: '🚛' },
  lab_partner:       { label: 'Lab Partner',    color: 'info',    icon: '🔬' }, // FIX: was 'lab partner'
  finance:           { label: 'Finance',        color: 'warning', icon: '💰' },
  blood_bank:        { label: 'Blood Bank',     color: 'error',   icon: '🩸' }, // FIX: added
};

const ALL_ROLES_LIST = Object.entries(ROLE_META).map(([value, m]) => ({
  value, label: m.label, icon: m.icon,
}));

const DONUT_COLORS = [
  'var(--color-primary,#3b82f6)',
  'var(--color-secondary,#14b8a6)',
  'var(--color-accent,#f59e0b)',
  'var(--color-success,#22c55e)',
  'var(--color-warning,#f97316)',
];

// FIX 4: Added 'accent' variant (used by pharmacy → ROLE_META.pharmacy.color = 'accent')
const BADGE_CLASS = {
  error:   'bg-error/10 text-error border border-error/30',
  warning: 'bg-warning/10 text-warning border border-warning/30',
  info:    'bg-info/10 text-info border border-info/30',
  success: 'bg-success/10 text-success border border-success/30',
  primary: 'bg-primary/10 text-primary border border-primary/30',
  accent:  'bg-accent/10 text-accent border border-accent/30',   // FIX: was missing
  neutral: 'bg-neutral/10 text-neutral-content border border-neutral/30',
};

// ─────────────────────────────────────────────────────────────────────────────
// TINY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const makeSparkData = (base, noise = 8) =>
  Array.from({ length: 8 }, (_, i) => ({
    v: Math.max(0, base + Math.round(Math.sin(i * 1.2) * noise + Math.random() * noise)),
  }));

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : '—';

const avatarSrc = (user) =>
  user.avatar ||
  `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(user.name)}`;

// ─────────────────────────────────────────────────────────────────────────────
// HOOK — all data / action logic lives here
// ─────────────────────────────────────────────────────────────────────────────

function usePermissions() {
  const dispatch = useDispatch();
  const { allUsers, loaders, error } = useSelector((s) => s.user);

  const [filters, setFilters] = useState({
    page: 1, limit: 20, role: '', isBlocked: '', search: '',
  });
  const [modal, setModal] = useState({ type: null, user: null });

  const searchTimer = useRef(null);

  const fetchUsers = useCallback(
    (overrides = {}) => {
      const merged = { ...filters, ...overrides };
      const clean  = Object.fromEntries(
        Object.entries(merged).filter(([, v]) => v !== '')
      );
      dispatch(adminGetAllUsers(clean));
    },
    [dispatch, filters]
  );

  // Re-fetch whenever page / role / blocked filter changes
  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.role, filters.isBlocked]);

  const handleSearch = useCallback(
    (value) => {
      clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        setFilters((prev) => ({ ...prev, search: value, page: 1 }));
        dispatch(adminGetAllUsers({ ...filters, search: value, page: 1 }));
      }, 380);
    },
    [dispatch, filters]
  );

  const applyFilter = useCallback(
    (key, value) => setFilters((prev) => ({ ...prev, [key]: value, page: 1 })),
    []
  );

  const goToPage = useCallback(
    (page) => setFilters((prev) => ({ ...prev, page })),
    []
  );

  const openModal  = useCallback((type, user) => setModal({ type, user }), []);
  const closeModal = useCallback(() => setModal({ type: null, user: null }), []);

  const handleUpdateRole = useCallback(
    async (userId, newRole) => {
      if (!ALLOWED_ROLES.includes(newRole)) return;
      await dispatch(adminUpdateRole({ id: userId, role: newRole }));
      closeModal();
      fetchUsers();
    },
    [dispatch, closeModal, fetchUsers]
  );

  const handleSuspend = useCallback(
    async ({ id, reason, durationDays }) => {
      await dispatch(adminSuspendUser({ id, reason, durationDays }));
      closeModal();
      fetchUsers();
    },
    [dispatch, closeModal, fetchUsers]
  );

  const handleUnblock = useCallback(
    async (userId) => {
      await dispatch(adminUnblockUser(userId));
      closeModal();
      fetchUsers();
    },
    [dispatch, closeModal, fetchUsers]
  );

  const handleResetOtp = useCallback(
    async (email) => {
      await dispatch(adminResetOtp(email));
      closeModal();
    },
    [dispatch, closeModal]
  );

  return {
    users: allUsers.data,
    total: allUsers.total,
    pages: allUsers.pages,
    currentPage: allUsers.currentPage,
    filters,
    loaders,
    error,
    modal,
    openModal,
    closeModal,
    handleSearch,
    applyFilter,
    goToPage,
    handleUpdateRole,
    handleSuspend,
    handleUnblock,
    handleResetOtp,
    refetch: fetchUsers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = memo(function StatCard({ icon: Icon, label, value, colorKey, sparkData, delay }) {
  const style = {
    primary: { ring: 'bg-primary/10',  text: 'text-primary',  stroke: 'var(--color-primary,#3b82f6)' },
    error:   { ring: 'bg-error/10',    text: 'text-error',    stroke: 'var(--color-error,#ef4444)'   },
    success: { ring: 'bg-success/10',  text: 'text-success',  stroke: 'var(--color-success,#22c55e)' },
    warning: { ring: 'bg-warning/10',  text: 'text-warning',  stroke: 'var(--color-warning,#f97316)' },
  }[colorKey] ?? {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl border border-base-300/50 bg-base-100 p-5 flex flex-col gap-3 relative overflow-hidden shadow-sm hover:shadow-md transition-shadow"
    >
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-3xl opacity-15 ${style.ring}`} />
      <div className="flex items-start justify-between relative">
        <div className={`p-2.5 rounded-xl ${style.ring}`}>
          <Icon className={`w-5 h-5 ${style.text}`} strokeWidth={2} />
        </div>
        <div className="w-24 h-10 opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, bottom: 2 }}>
              <defs>
                <linearGradient id={`sg-${colorKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={style.stroke} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={style.stroke} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v"
                stroke={style.stroke} strokeWidth={2}
                fill={`url(#sg-${colorKey})`} dot={false}
                isAnimationActive animationDuration={1400}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="relative">
        <p className="text-2xl font-black text-base-content tabular-nums" style={{ fontFamily: 'var(--font-family-montserrat,sans-serif)' }}>
          {value?.toLocaleString() ?? '—'}
        </p>
        <p className="text-[11px] text-base-content/50 mt-0.5 uppercase tracking-widest font-medium">
          {label}
        </p>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLE DONUT
// ─────────────────────────────────────────────────────────────────────────────

const RoleDonut = memo(function RoleDonut({ users }) {
  const data = useMemo(() => {
    const counts = {};
    users.forEach((u) => { counts[u.role] = (counts[u.role] ?? 0) + 1; });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([role, count], i) => ({
        name:  ROLE_META[role]?.label ?? role,
        value: count,
        fill:  DONUT_COLORS[i % DONUT_COLORS.length],
      }));
  }, [users]);

  if (!data.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.45 }}
      className="rounded-2xl border border-base-300/50 bg-base-100 p-5 flex flex-col gap-3 shadow-sm"
    >
      <p className="text-[11px] uppercase tracking-widest text-base-content/40 font-medium">
        Role Distribution
      </p>
      <div className="flex items-center gap-4">
        <div className="w-28 h-28 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="52%" outerRadius="100%"
              data={data} startAngle={90} endAngle={-270} barSize={9}
            >
              <RadialBar dataKey="value" cornerRadius={5} isAnimationActive animationDuration={1300} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-col gap-1.5 flex-1 min-w-0">
          {data.map((d) => (
            <li key={d.name} className="flex items-center gap-2 text-[10px] text-base-content/65">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.fill }} />
              <span className="truncate">{d.name}</span>
              <span className="ml-auto font-bold text-base-content tabular-nums">{d.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ users, total }) {
  const blocked  = useMemo(() => users.filter((u) => u.isBlocked).length, [users]);
  const online   = useMemo(() => users.filter((u) => u.isOnline).length,  [users]);
  const verified = useMemo(() => users.filter((u) => u.isEmailVerified).length, [users]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <StatCard icon={Users}       label="Total Users"  value={total}    colorKey="primary" sparkData={makeSparkData(total,   5)} delay={0.05} />
      <StatCard icon={Activity}    label="Online Now"   value={online}   colorKey="success" sparkData={makeSparkData(online,  3)} delay={0.1}  />
      <StatCard icon={ShieldAlert} label="Suspended"    value={blocked}  colorKey="error"   sparkData={makeSparkData(blocked, 1)} delay={0.15} />
      <StatCard icon={ShieldCheck} label="Verified"     value={verified} colorKey="warning" sparkData={makeSparkData(verified,3)} delay={0.2}  />
      <RoleDonut users={users} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTERS BAR
// ─────────────────────────────────────────────────────────────────────────────

function FiltersBar({ filters, onSearch, onFilter, onRefetch, loading }) {
  const inputRef = useRef(null);

  const handleChange = useCallback(
    (e) => onSearch(e.target.value),
    [onSearch]
  );

  const clearSearch = useCallback(() => {
    if (inputRef.current) inputRef.current.value = '';
    onSearch('');
  }, [onSearch]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col sm:flex-row gap-3 mb-5"
    >
      {/* Search */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/35 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          placeholder="Search by name, email or phone…"
          onChange={handleChange}
          defaultValue={filters.search}
          aria-label="Search users"
          className="w-full h-10 pl-10 pr-9 rounded-xl border border-base-300 bg-base-200/60 text-xs text-base-content placeholder:text-base-content/35 outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
        />
        {filters.search && (
          <button
            onClick={clearSearch}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/35 hover:text-base-content transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Role */}
      <div className="relative">
        <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/35 pointer-events-none" />
        <select
          value={filters.role}
          onChange={(e) => onFilter('role', e.target.value)}
          aria-label="Filter by role"
          className="h-10 pl-9 pr-8 rounded-xl border border-base-300 bg-base-200/60 text-xs text-base-content outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer appearance-none min-w-[160px] transition-all"
        >
          <option value="">All Roles</option>
          {ALL_ROLES_LIST.map((r) => (
            <option key={r.value} value={r.value}>{r.icon} {r.label}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <select
        value={filters.isBlocked}
        onChange={(e) => onFilter('isBlocked', e.target.value)}
        aria-label="Filter by status"
        className="h-10 px-4 rounded-xl border border-base-300 bg-base-200/60 text-xs text-base-content outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary cursor-pointer appearance-none min-w-[140px] transition-all"
      >
        <option value="">All Status</option>
        <option value="false">Active</option>
        <option value="true">Suspended</option>
      </select>

      {/* Refresh */}
      <button
        onClick={onRefetch}
        disabled={loading}
        aria-label="Refresh"
        className="h-10 px-4 flex items-center gap-2 rounded-xl border-2 border-primary text-primary text-xs font-bold hover:bg-primary hover:text-primary-content transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
        <span className="hidden sm:inline">Refresh</span>
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE BADGE
// ─────────────────────────────────────────────────────────────────────────────

const RoleBadge = memo(function RoleBadge({ role }) {
  const m = ROLE_META[role] ?? { label: role, color: 'neutral', icon: '?' };
  const cls = BADGE_CLASS[m.color] ?? BADGE_CLASS.neutral;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${cls}`}>
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTION BUTTON
// ─────────────────────────────────────────────────────────────────────────────

const ActionBtn = memo(function ActionBtn({ onClick, icon: Icon, tooltip, colorKey = 'base', disabled }) {
  const cls = {
    base:    'text-base-content/45 hover:text-base-content hover:bg-base-200',
    error:   'text-error/60 hover:text-error hover:bg-error/10',
    success: 'text-success/60 hover:text-success hover:bg-success/10',
    warning: 'text-warning/60 hover:text-warning hover:bg-warning/10',
    info:    'text-info/60 hover:text-info hover:bg-info/10',
  }[colorKey] ?? 'text-base-content/45 hover:text-base-content hover:bg-base-200';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip}
      className={`p-1.5 rounded-lg transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${cls}`}
    >
      <Icon className="w-4 h-4" strokeWidth={2} />
    </button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// USER ROW
// ─────────────────────────────────────────────────────────────────────────────

const UserRow = memo(function UserRow({ user, onOpenModal, index }) {
  const canChangeRole = ALLOWED_ROLES.includes(user.role);

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.018, duration: 0.22 }}
      className="border-b border-base-300/30 hover:bg-base-200/40 transition-colors group"
    >
      {/* Avatar */}
      <td className="px-4 py-3">
        <div className="relative w-9 h-9">
          <img
            src={avatarSrc(user)} alt={user.name}
            width={36} height={36} loading="lazy"
            className="w-9 h-9 rounded-full object-cover border-2 border-base-300"
          />
          {user.isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-base-100" />
          )}
        </div>
      </td>

      {/* Name + email */}
      <td className="px-4 py-3 max-w-[200px]">
        <p className="text-xs font-semibold text-base-content truncate flex items-center gap-1.5">
          {user.name}
          {user.isEmailVerified && <BadgeCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
        </p>
        <p className="text-[10px] text-base-content/40 truncate">{user.email}</p>
      </td>

      {/* Phone */}
      <td className="px-4 py-3 text-[10px] text-base-content/55 whitespace-nowrap hidden md:table-cell">
        {user.phone ?? <span className="text-base-content/25">—</span>}
      </td>

      {/* Role */}
      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>

      {/* Status */}
      <td className="px-4 py-3">
        {user.isBlocked ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-error/10 text-error border border-error/30">
            <ShieldOff className="w-3 h-3" /> Suspended
          </span>
        ) : user.isOnline ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/30">
            <Wifi className="w-3 h-3" /> Online
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-info/10 text-info border border-info/30">
            <WifiOff className="w-3 h-3" /> Offline
          </span>
        )}
      </td>

      {/* Last active */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-1.5 text-[10px] text-base-content/40">
          <Clock className="w-3 h-3 flex-shrink-0" />
          {fmtDate(user.lastActiveAt)}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
          {canChangeRole && (
            <ActionBtn icon={ChevronDown} tooltip="Change Role" colorKey="info"
              onClick={() => onOpenModal('role', user)} />
          )}
          {user.isBlocked ? (
            <ActionBtn icon={Shield} tooltip="Unblock User" colorKey="success"
              onClick={() => onOpenModal('unblock', user)} />
          ) : (
            <ActionBtn icon={ShieldOff} tooltip="Suspend User" colorKey="error"
              onClick={() => onOpenModal('suspend', user)} />
          )}
          <ActionBtn icon={RotateCcw} tooltip="Reset OTP" colorKey="warning"
            onClick={() => onOpenModal('resetOtp', user)} />
        </div>
      </td>
    </motion.tr>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON ROW
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-base-300/30">
      {[36, 140, 100, 80, 80, 90, 80].map((w, i) => (
        <td key={i} className={`px-4 py-3.5 ${i === 2 ? 'hidden md:table-cell' : ''} ${i === 5 ? 'hidden lg:table-cell' : ''}`}>
          <div className="animate-pulse bg-base-300 rounded-lg h-4" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS TABLE
// ─────────────────────────────────────────────────────────────────────────────

function UsersTable({ users, loading, onOpenModal }) {
  const cols = ['', 'User', 'Phone', 'Role', 'Status', 'Last Active', 'Actions'];

  return (
    <div className="overflow-x-auto rounded-2xl border border-base-300/50 shadow-sm">
      <table className="w-full text-left text-xs" aria-label="Users permission table">
        <thead>
          <tr className="border-b border-base-300/50 bg-base-200/50">
            {cols.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={`px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-base-content/35 whitespace-nowrap
                  ${i === 2 ? 'hidden md:table-cell' : ''}
                  ${i === 5 ? 'hidden lg:table-cell' : ''}
                `}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="wait">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-base-200 flex items-center justify-center">
                      <Shield className="w-8 h-8 text-base-content/20" strokeWidth={1.5} />
                    </div>
                    <p className="text-base-content/35 text-xs">No users found matching your filters</p>
                  </motion.div>
                </td>
              </tr>
            ) : (
              users.map((u, i) => (
                <UserRow key={u._id} user={u} index={i} onOpenModal={onOpenModal} />
              ))
            )}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

const Pagination = memo(function Pagination({ currentPage, pages, total, limit, onPage }) {
  const range = useMemo(() => {
    if (pages <= 5) return Array.from({ length: pages }, (_, i) => i + 1);
    let s = Math.max(1, currentPage - 2);
    let e = Math.min(pages, currentPage + 2);
    if (e - s < 4) {
      if (s === 1) e = Math.min(5, pages);
      else s = Math.max(1, e - 4);
    }
    return Array.from({ length: e - s + 1 }, (_, i) => s + i);
  }, [currentPage, pages]);

  if (pages <= 1) return null;

  const from = (currentPage - 1) * limit + 1;
  const to   = Math.min(currentPage * limit, total);

  const PageBtn = ({ n }) => (
    <button
      onClick={() => onPage(n)}
      aria-current={n === currentPage ? 'page' : undefined}
      className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition-all
        ${n === currentPage
          ? 'bg-primary text-primary-content shadow-sm'
          : 'border border-base-300 text-base-content/55 hover:bg-base-200 hover:text-base-content'
        }`}
    >
      {n}
    </button>
  );

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 pt-4 border-t border-base-300/40">
      <p className="text-[10px] text-base-content/40">
        Showing <strong className="text-base-content">{from}–{to}</strong> of{' '}
        <strong className="text-base-content">{total}</strong> users
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          onClick={() => onPage(currentPage - 1)} disabled={currentPage === 1}
          aria-label="Previous" className="p-2 rounded-lg border border-base-300 text-base-content/50 hover:text-base-content hover:bg-base-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {range[0] > 1 && (
          <>
            <PageBtn n={1} />
            {range[0] > 2 && <span className="px-1 text-base-content/25 text-xs">…</span>}
          </>
        )}
        {range.map((n) => <PageBtn key={n} n={n} />)}
        {range[range.length - 1] < pages && (
          <>
            {range[range.length - 1] < pages - 1 && (
              <span className="px-1 text-base-content/25 text-xs">…</span>
            )}
            <PageBtn n={pages} />
          </>
        )}
        <button
          onClick={() => onPage(currentPage + 1)} disabled={currentPage === pages}
          aria-label="Next" className="p-2 rounded-lg border border-base-300 text-base-content/50 hover:text-base-content hover:bg-base-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </nav>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MODAL SHELL
// ─────────────────────────────────────────────────────────────────────────────

function ModalShell({ children, onClose, title, icon: Icon, accentKey = 'primary' }) {
  const accentMap = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    error:   'bg-error/10   text-error   border-error/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
  };

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="bd"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <motion.div
        key="panel"
        role="dialog" aria-modal="true" aria-labelledby="modal-title"
        initial={{ opacity: 0, scale: 0.93, y: 14 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.93, y: 14  }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-base-300/60 bg-base-100 shadow-2xl p-6 relative">
          {/* Close */}
          <button
            onClick={onClose} aria-label="Close"
            className="absolute top-4 right-4 p-1.5 rounded-lg text-base-content/35 hover:text-base-content hover:bg-base-200 transition-all"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className={`p-2.5 rounded-xl border ${accentMap[accentKey]}`}>
              <Icon className="w-5 h-5" strokeWidth={2} />
            </div>
            <h2 id="modal-title" className="text-lg font-black text-base-content" style={{ fontFamily: 'var(--font-family-montserrat,sans-serif)' }}>
              {title}
            </h2>
          </div>

          {children}
        </div>
      </motion.div>
    </>
  );
}

// ── User summary inside modals ────────────────────────────────────────────────
function UserSummary({ user, accentKey = 'neutral' }) {
  const bgMap = {
    neutral: 'bg-base-200/70',
    error:   'bg-error/5 border border-error/20',
    success: 'bg-success/5 border border-success/20',
    warning: 'bg-warning/5 border border-warning/20',
  };
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl mb-4 ${bgMap[accentKey] ?? bgMap.neutral}`}>
      <img src={avatarSrc(user)} alt={user.name} width={36} height={36}
        className="w-9 h-9 rounded-full object-cover border border-base-300" />
      <div className="min-w-0">
        <p className="text-xs font-bold text-base-content truncate">{user.name}</p>
        <p className="text-[10px] text-base-content/40 truncate">{user.email}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Change Role
// ─────────────────────────────────────────────────────────────────────────────

function RoleModal({ user, onConfirm, onClose, loading }) {
  const [selected, setSelected] = useState(user.role);
  const changed = selected !== user.role;

  return (
    <ModalShell title="Change Role" icon={ChevronDown} accentKey="primary" onClose={onClose}>
      <UserSummary user={user} />
      <p className="text-[10px] text-base-content/45 mb-3">
        Only these roles can be assigned via this panel:
      </p>

      {/* Role grid */}
      <div className="grid grid-cols-2 gap-2 mb-5" role="radiogroup">
        {ALLOWED_ROLES.map((role) => {
          const m      = ROLE_META[role];
          const active = selected === role;
          return (
            <button
              key={role}
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(role)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all
                ${active
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-base-300 text-base-content/65 hover:border-primary/40 hover:bg-base-200'
                }`}
            >
              <span aria-hidden>{m.icon}</span>
              <span className="truncate">{m.label}</span>
              {active && <CheckCircle2 className="w-3.5 h-3.5 ml-auto flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Warning if current role is restricted */}
      {!ALLOWED_ROLES.includes(user.role) && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/8 border border-warning/25 text-[10px] text-warning mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Current role <strong>{ROLE_META[user.role]?.label ?? user.role}</strong> is restricted —
            assigning a new role will delete the old profile data.
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 h-10 rounded-xl border-2 border-primary text-primary text-xs font-bold hover:bg-primary hover:text-primary-content transition-all">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(user._id, selected)}
          disabled={!changed || loading}
          className="flex-1 h-10 rounded-xl bg-primary text-primary-content text-xs font-bold transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving…' : 'Update Role'}
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Suspend
// ─────────────────────────────────────────────────────────────────────────────

function SuspendModal({ user, onConfirm, onClose, loading }) {
  const [reason,       setReason]   = useState('');
  const [durationDays, setDuration] = useState(30);

  const unblockDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + Number(durationDays));
    return d;
  }, [durationDays]);

  return (
    <ModalShell title="Suspend Account" icon={ShieldOff} accentKey="error" onClose={onClose}>
      <UserSummary user={user} accentKey="error" />

      <div className="flex flex-col gap-3 mb-4">
        <div>
          <label htmlFor="sr" className="block text-[10px] font-semibold text-base-content/55 mb-1.5">
            Reason <span className="text-base-content/30">(optional)</span>
          </label>
          <textarea
            id="sr" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Violation of terms, abusive behaviour…"
            rows={3}
            className="w-full rounded-xl border border-base-300 bg-base-200/60 px-4 py-2.5 text-xs text-base-content resize-none outline-none focus:ring-2 focus:ring-error/30 focus:border-error transition-all"
          />
        </div>

        <div>
          <label htmlFor="sd" className="block text-[10px] font-semibold text-base-content/55 mb-1.5">
            Duration — <span className="text-error font-bold">{durationDays} days</span>
          </label>
          <input
            id="sd" type="range" min={1} max={365}
            value={durationDays} onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full h-1.5 cursor-pointer accent-error"
          />
          <p className="text-[10px] text-base-content/35 mt-1">
            Auto-unblock on {fmtDate(unblockDate)}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-xl bg-error/8 border border-error/25 text-[10px] text-error mb-4">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>All active sessions and push tokens will be revoked immediately.</span>
      </div>

      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 h-10 rounded-xl border-2 border-base-300 text-base-content/70 text-xs font-bold hover:bg-base-200 transition-all">
          Cancel
        </button>
        <button
          onClick={() => onConfirm({ id: user._id, reason: reason || undefined, durationDays })}
          disabled={loading}
          className="flex-1 h-10 rounded-xl bg-error text-error-content text-xs font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Suspending…' : 'Suspend User'}
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Unblock
// ─────────────────────────────────────────────────────────────────────────────

function UnblockModal({ user, onConfirm, onClose, loading }) {
  return (
    <ModalShell title="Unblock Account" icon={Shield} accentKey="success" onClose={onClose}>
      <UserSummary user={user} accentKey="success" />

      {user.blockReason && (
        <div className="p-3 bg-base-200 rounded-xl mb-4 text-[10px] text-base-content/55">
          <p className="font-semibold text-base-content/75 mb-0.5">Suspension reason:</p>
          <p>{user.blockReason}</p>
        </div>
      )}

      <p className="text-xs text-base-content/65 mb-5">
        This will immediately restore full access to{' '}
        <strong className="text-base-content">{user.name}</strong>.
        They will receive an SMS and WhatsApp notification.
      </p>

      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 h-10 rounded-xl border-2 border-base-300 text-base-content/70 text-xs font-bold hover:bg-base-200 transition-all">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(user._id)} disabled={loading}
          className="flex-1 h-10 rounded-xl bg-success text-success-content text-xs font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Unblocking…' : 'Unblock User'}
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: Reset OTP
// ─────────────────────────────────────────────────────────────────────────────

function ResetOtpModal({ user, onConfirm, onClose, loading }) {
  return (
    <ModalShell title="Reset OTP State" icon={RotateCcw} accentKey="warning" onClose={onClose}>
      <UserSummary user={user} accentKey="warning" />

      <p className="text-xs text-base-content/65 mb-5">
        Clears any pending OTP and expiry from{' '}
        <strong className="text-base-content">{user.name}</strong>'s account,
        unblocking them from OTP-gated flows. Use when a user is stuck in a login loop.
      </p>

      <div className="flex gap-2">
        <button onClick={onClose}
          className="flex-1 h-10 rounded-xl border-2 border-base-300 text-base-content/70 text-xs font-bold hover:bg-base-200 transition-all">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(user.email)} disabled={loading}
          className="flex-1 h-10 rounded-xl bg-warning text-warning-content text-xs font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Clearing…' : 'Clear OTP'}
        </button>
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

function PermissionModals({ modal, onClose, onUpdateRole, onSuspend, onUnblock, onResetOtp, loaders }) {
  if (!modal.user) return null;
  return (
    <AnimatePresence>
      {modal.type === 'role' && (
        <RoleModal key="role" user={modal.user} onConfirm={onUpdateRole}
          onClose={onClose} loading={loaders.adminUpdateRole} />
      )}
      {modal.type === 'suspend' && (
        <SuspendModal key="suspend" user={modal.user} onConfirm={onSuspend}
          onClose={onClose} loading={loaders.adminSuspendUser} />  // FIX 2: was adminSuspend
      )}
      {modal.type === 'unblock' && (
        <UnblockModal key="unblock" user={modal.user} onConfirm={onUnblock}
          onClose={onClose} loading={loaders.adminUnblockUser} />  // FIX 2: was adminUnblock
      )}
      {modal.type === 'resetOtp' && (
        <ResetOtpModal key="otp" user={modal.user} onConfirm={onResetOtp}
          onClose={onClose} loading={loaders.adminResetOtp} />
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE EXPORT
// ─────────────────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const {
    users, total, pages, currentPage,
    filters, loaders, error,
    modal, openModal, closeModal,
    handleSearch, applyFilter, goToPage,
    handleUpdateRole, handleSuspend, handleUnblock, handleResetOtp,
    refetch,
  } = usePermissions();

  return (
    <div data-theme="admin" className="min-h-screen bg-base-100 py-6 px-4  ">
      <div className="max-w-screen-xl mx-auto">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="flex items-center gap-3 mb-7"
        >
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-6 h-6 text-primary" strokeWidth={2} />
          </div>
          <div>
            <h1
              className="text-2xl md:text-3xl font-black text-base-content leading-tight"
              style={{ fontFamily: 'var(--font-family-montserrat,sans-serif)' }}
            >
              User Permissions
            </h1>
            <p className="text-xs text-base-content/45 mt-0.5">
              Manage roles, suspend accounts and reset authentication states
            </p>
          </div>
        </motion.div>

        {/* ── Stats ── */}
        <StatsBar users={users} total={total} />

        {/* ── Error banner ── */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 p-3 mb-5 rounded-xl bg-error/10 border border-error/25 text-xs text-error"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        {/* ── Filters ── */}
        <FiltersBar
          filters={filters}
          onSearch={handleSearch}
          onFilter={applyFilter}
          onRefetch={refetch}
          loading={loaders.adminUsers}
        />

        {/* ── Table ── */}
        <UsersTable
          users={users}
          loading={loaders.adminUsers}
          onOpenModal={openModal}
        />

        {/* ── Pagination ── */}
        <Pagination
          currentPage={currentPage}
          pages={pages}
          total={total}
          limit={filters.limit}
          onPage={goToPage}
        />
      </div>

      {/* ── Modals ── */}
      <PermissionModals
        modal={modal}
        onClose={closeModal}
        onUpdateRole={handleUpdateRole}
        onSuspend={handleSuspend}
        onUnblock={handleUnblock}
        onResetOtp={handleResetOtp}
        loaders={loaders}
      />
    </div>
  );
}