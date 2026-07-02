"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Search, Filter, Mail, Phone,
  CheckCircle2, AlertCircle, Loader2,
  Shield, Calendar, UserCheck, UserX,
  Stethoscope, Store, Truck, HeartHandshake,
  User, ShieldCheck, ShieldAlert, Wallet,
  Car, FlaskConical, RefreshCw, ChevronDown,
  Globe, X, MoreVertical
} from 'lucide-react';
import { fetchEmployees } from '@/store/slices/userManagementSlice';

// ─── Role config (mirrors User schema enum) ───────────────────────────────────
const ROLE_META = {
  superadmin:       { color: 'var(--error)',     icon: ShieldAlert,    label: 'Super Admin' },
  admin:            { color: 'var(--primary)',   icon: ShieldCheck,    label: 'Admin' },
  customer:         { color: 'var(--success)',   icon: User,           label: 'Customer' },
  finance:          { color: 'var(--warning)',   icon: Wallet,         label: 'Finance' },
  'care assistant': { color: 'var(--chart-5)',   icon: HeartHandshake, label: 'Care Assistant' },
  doctor:           { color: 'var(--secondary)', icon: Stethoscope,    label: 'Doctor' },
  transportpartner: { color: 'var(--accent)',    icon: Car,            label: 'Transport Partner' },
  driver:           { color: 'var(--chart-1)',   icon: Truck,          label: 'Driver' },
  pharmacy:         { color: 'var(--chart-2)',   icon: Store,          label: 'Pharmacy' },
  'lab partner':    { color: 'var(--chart-3)',   icon: FlaskConical,   label: 'Lab Partner' },
};

const FILTER_ROLES = [
  { value: '',               label: 'All Roles' },
  { value: 'superadmin',     label: 'Super Admin' },
  { value: 'admin',          label: 'Admin' },
  { value: 'finance',        label: 'Finance' },
  { value: 'doctor',         label: 'Doctor' },
  { value: 'pharmacy',       label: 'Pharmacy' },
  { value: 'driver',         label: 'Driver' },
  { value: 'transportpartner', label: 'Transport Partner' },
  { value: 'care assistant', label: 'Care Assistant' },
  { value: 'lab partner',    label: 'Lab Partner' },
];

// ─── Animation variants ───────────────────────────────────────────────────────
const fadeUp = { 
  hidden: { opacity: 0, y: 15 }, 
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }) 
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const cardAnim = {
  hidden:  { opacity: 0, scale: 0.98, y: 10 },
  visible: { opacity: 1, scale: 1,    y: 0,  transition: { type: 'spring', stiffness: 300, damping: 24 } },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

// ─── Helper Components ────────────────────────────────────────────────────────
const InitialsAvatar = ({ name, color }) => {
  const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-full h-full flex items-center justify-center text-sm font-bold tracking-wide"
      style={{ background: `color-mix(in oklch, ${color} 12%, transparent)`, color }}>
      {initials}
    </div>
  );
};

const Badge = ({ children, color, filled = false }) => (
  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-colors"
    style={{ 
      background: filled ? color : `color-mix(in oklch, ${color} 10%, transparent)`, 
      color: filled ? '#fff' : color 
    }}>
    {children}
  </span>
);

// ─── Employee Card ────────────────────────────────────────────────────────────
const EmployeeCard = React.memo(({ emp, index }) => {
  const meta = ROLE_META[emp.role] || ROLE_META.customer;
  const RIcon = meta.icon;
  const isBlocked = emp.isBlocked;

  return (
    <motion.div
      layout
      variants={cardAnim}
      custom={index}
      className="group relative flex flex-col bg-base-100 border border-base-300 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-base-content/10 transition-all duration-300"
      style={{ opacity: isBlocked ? 0.75 : 1 }}
    >
      {/* Blocked overlay hint */}
      {isBlocked && (
        <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden rounded-tr-2xl z-10 pointer-events-none">
          <div className="absolute top-2 -right-6 bg-error text-white text-[9px] font-bold uppercase tracking-wider py-1 px-8 rotate-45">
            Blocked
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-start gap-4 mb-5">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-base-200 shadow-sm">
            {emp.avatar
              ? <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
              : <InitialsAvatar name={emp.name} color={meta.color} />}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-base-100 flex items-center justify-center"
            style={{ background: isBlocked ? 'var(--error)' : emp.isOnline ? 'var(--success)' : 'var(--base-300)' }}>
          </div>
        </div>

        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-semibold text-sm text-base-content truncate">
            {emp.name}
          </h3>
          <div className="mt-1 flex items-center gap-2">
            <Badge color={meta.color}>
              <RIcon size={10} />
              {meta.label}
            </Badge>
          </div>
        </div>

        {/* Options menu stub */}
        <button className="text-base-content/40 hover:text-base-content transition-colors p-1 rounded-md hover:bg-base-200">
          <MoreVertical size={16} />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="space-y-3 mb-5 flex-1">
        <div className="flex items-center gap-3 text-xs text-base-content/70">
          <div className="w-7 h-7 rounded-full bg-base-200 flex items-center justify-center flex-shrink-0">
            <Mail size={12} />
          </div>
          <span className="truncate">{emp.email}</span>
          {emp.isEmailVerified && (
            <CheckCircle2 size={14} className="text-success ml-auto flex-shrink-0" title="Verified Email" />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-base-content/70">
          <div className="w-7 h-7 rounded-full bg-base-200 flex items-center justify-center flex-shrink-0">
            <Phone size={12} />
          </div>
          <span className="truncate">{emp.phone || 'No phone provided'}</span>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="pt-4 border-t border-base-200/60 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-base-content/50 font-medium">
          <div className="flex items-center gap-1.5" title="Joined Date">
            <Calendar size={12} />
            {new Date(emp.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </div>
          {emp.googleAuth?.isVerified && (
            <div className="flex items-center gap-1.5" title="Google Linked">
              <Globe size={12} className="text-info" />
              SSO
            </div>
          )}
        </div>

        {/* Primary Action Button */}
        {isBlocked ? (
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-base-content bg-base-200 hover:bg-success hover:text-white transition-all">
            <UserCheck size={12} /> Unblock
          </button>
        ) : (
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-base-content bg-base-200 hover:bg-error hover:text-white transition-all opacity-0 group-hover:opacity-100 focus:opacity-100">
            <UserX size={12} /> Block
          </button>
        )}
      </div>
    </motion.div>
  );
});

EmployeeCard.displayName = 'EmployeeCard';

// ─── Stat pill ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color, icon: Icon }) => (
  <div className="bg-base-100 border border-base-200 rounded-2xl p-4 flex items-center gap-4 shadow-sm flex-1 min-w-[140px]">
    <div className="w-10 h-10 rounded-full flex items-center justify-center"
      style={{ background: `color-mix(in oklch, ${color} 10%, transparent)`, color }}>
      <Icon size={18} />
    </div>
    <div>
      <p className="text-2xl font-bold text-base-content leading-none">{value}</p>
      <p className="text-xs text-base-content/50 font-medium mt-1">{label}</p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Employees() {
  const dispatch = useDispatch();
  const { employees = [], loading } = useSelector(state => state.userManagement);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter,  setRoleFilter]  = useState('');

  useEffect(() => {
    dispatch(fetchEmployees(roleFilter));
  }, [dispatch, roleFilter]);

  const safeEmployees = Array.isArray(employees) ? employees : [];

  const filteredEmployees = useMemo(() =>
    safeEmployees.filter(emp => {
      const matchSearch =
        emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRole = roleFilter === '' || emp.role === roleFilter;
      return matchSearch && matchRole;
    }),
  [safeEmployees, searchQuery, roleFilter]);

  const stats = useMemo(() => ({
    total:   safeEmployees.length,
    active:  safeEmployees.filter(e => !e.isBlocked).length,
    blocked: safeEmployees.filter(e =>  e.isBlocked).length,
    online:  safeEmployees.filter(e =>  e.isOnline).length,
  }), [safeEmployees]);

  const clearFilters = () => { setSearchQuery(''); setRoleFilter(''); };
  const hasFilters   = searchQuery || roleFilter;

  return (
    <div data-theme="admin" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* ── Header ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-base-content tracking-tight">Workforce Directory</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage, monitor, and configure system personnel.</p>
        </div>
        <button onClick={() => dispatch(fetchEmployees(roleFilter))}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-base-100 border border-base-300 rounded-lg text-sm font-medium text-base-content hover:bg-base-200 transition-colors shadow-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </motion.div>

      {/* ── Stats ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="flex flex-wrap gap-4">
        <StatCard label="Total Users" value={stats.total} color="var(--primary)" icon={Users} />
        <StatCard label="Active Accounts" value={stats.active} color="var(--success)" icon={UserCheck} />
        <StatCard label="Currently Online" value={stats.online} color="var(--info)" icon={Globe} />
        <StatCard label="Blocked Users" value={stats.blocked} color="var(--error)" icon={UserX} />
      </motion.div>

      {/* ── Toolbar ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} 
        className="bg-base-100 border border-base-200 p-2 rounded-xl flex flex-col md:flex-row gap-2 shadow-sm">
        
        {/* Search Input */}
        <div className="relative input-field h-10 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            placeholder="Search by name or email..."
            className="w-full  pl-5 pr-10  text-sm transition-all outline-none"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Role Filter */}
        <div className="relative input-field h-10 w-fit">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <select
            className="w-full       rounded-lg pl-10 pr-10  text-sm appearance-none transition-all outline-none font-medium text-base-content"
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}>
            {FILTER_ROLES.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
        </div>

        {/* Clear Filters Button */}
        <AnimatePresence>
          {hasFilters && (
            <motion.button 
              initial={{ opacity: 0, width: 0, padding: 0 }} 
              animate={{ opacity: 1, width: 'auto', paddingLeft: 16, paddingRight: 16 }} 
              exit={{ opacity: 0, width: 0, padding: 0 }}
              onClick={clearFilters}
              className="flex items-center justify-center gap-1.5 bg-error/10 text-error hover:bg-error hover:text-white rounded-lg text-sm font-medium transition-colors overflow-hidden whitespace-nowrap">
              <X size={14} /> Clear
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Content Area ── */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-base-content/50">
            <Loader2 size={32} className="animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Fetching directory...</p>
          </div>
        ) : filteredEmployees.length > 0 ? (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredEmployees.map((emp, i) => (
                <EmployeeCard key={emp._id} emp={emp} index={i} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-[400px] bg-base-100 border border-base-200 border-dashed rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-base-200 flex items-center justify-center mb-4 text-base-content/30">
              <Users size={32} />
            </div>
            <h3 className="text-lg font-bold text-base-content mb-1">No personnel found</h3>
            <p className="text-sm text-base-content/50 max-w-sm text-center">
              We couldn't find anyone matching your current search and filter parameters.
            </p>
            {hasFilters && (
              <button onClick={clearFilters} className="mt-6 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                Clear all filters
              </button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}