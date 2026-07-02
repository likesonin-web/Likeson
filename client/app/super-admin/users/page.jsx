'use client'
import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Users, UserPlus, Search, Shield, ShieldOff, KeyRound,
  MailCheck, Trash2, Eye, X, ChevronLeft, ChevronRight,
  RefreshCw, Stethoscope, FlaskConical, Truck, Pill,
  BadgeDollarSign, HeartHandshake, UserCircle, CheckCircle2,
  Clock, MoreVertical, LogOut, Monitor, Smartphone, Globe,
  AlertTriangle, Loader2, Info, ChevronDown,
  Phone, Mail, Calendar, MapPin, Star, FileText,
  LayoutGrid, LayoutList, TrendingUp, TrendingDown, Activity,
  BarChart2, PieChart as PieChartIcon, Upload,
  Eye as EyeIcon, Building2, Zap,
} from 'lucide-react';

import {
  fetchAllUsers,
  fetchUserById,
  fetchRefHospitals,
  fetchRefLabPartnerHospitals,
  fetchRefPharmacyStores,
  fetchRefTransportPartners,
  createCustomer,
  createDoctor,
  createLabPartner,
  createTransportPartner,
  createPharmacy,
  createFinance,
  createCareAssistant,
  blockUnblockUser,
  resetUserPassword,
  verifyUserEmail,
  updateUser,
  deleteUser,
  fetchUserSessions,
  revokeUserSession,
  setFilters,
  setPage,
  clearSelectedUser,
  clearErrors,
  selectAllUsers,
  selectUsersPagination,
  selectUsersFilters,
  selectListLoading,
  selectDetailLoading,
  selectSelectedUser,
  selectRefData,
  selectUsersErrors,
  selectUserSessions,
  selectSessionsLoading,
  selectCreateLoading,
  selectBlockLoading,
  selectResetPasswordLoading,
  selectDeleteLoading,
  selectUsersLoading,
} from '@/store/slices/adminUserSlice';

import {
  uploadSingleFile,
  resetUploadState,
} from '@/store/slices/uploadSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ROLES = [
  { value: '',               label: 'All Roles',      icon: Users,          color: 'primary'   },
  { value: 'customer',       label: 'Customer',       icon: UserCircle,     color: 'info'      },
  { value: 'doctor',         label: 'Doctor',         icon: Stethoscope,    color: 'success'   },
  { value: 'lab partner',    label: 'Lab Partner',    icon: FlaskConical,   color: 'warning'   },
  { value: 'transportpartner', label: 'Transport',    icon: Truck,          color: 'accent'    },
  { value: 'pharmacy',       label: 'Pharmacy',       icon: Pill,           color: 'secondary' },
  { value: 'finance',        label: 'Finance',        icon: BadgeDollarSign,color: 'success'   },
  { value: 'care assistant', label: 'Care Assistant', icon: HeartHandshake, color: 'error'     },
];

// ─────────────────────────────────────────────────────────────────────────────
// ROLE CREATE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_CREATE_CONFIG = {
  customer: {
    label: 'Customer', icon: UserCircle, color: 'info',
    description: 'Creates a patient/customer account. A temporary password will be emailed upon creation.',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true, hint: 'e.g. Ravi Kumar', note: 'Enter the legal name as it appears on government ID.' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, hint: 'e.g. ravi@example.com', note: 'Login credential. Temporary password will be sent here.' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: false, hint: 'e.g. 9876543210', note: 'Indian mobile only (10 digits, starts 6–9).' },
      { name: 'gender', label: 'Gender', type: 'select', required: false, options: ['Male', 'Female', 'Transgender', 'Other', 'Prefer not to say'] },
      { name: 'bloodGroup', label: 'Blood Group', type: 'select', required: false, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    ],
  },
  doctor: {
    label: 'Doctor', icon: Stethoscope, color: 'success',
    description: 'Creates a doctor account linked to a hospital. Doctor can set their own availability after login.',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true, hint: 'e.g. Dr. Priya Sharma' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, hint: 'e.g. dr.priya@hospital.com' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: false, hint: 'e.g. 9876543210' },
      { name: 'specialization', label: 'Specialization', type: 'select', required: true, options: ['General Physician','Cardiologist','Neurologist','Pediatrician','Oncologist','Orthopedic Surgeon','Gastroenterologist','Gynecologist','Dermatologist','Urologist','Psychiatry','Physiotherapist'] },
      { name: 'experienceYears', label: 'Years of Experience', type: 'number', required: true, hint: 'e.g. 8' },
      { name: 'registrationNumber', label: 'MCI Registration No.', type: 'text', required: false, hint: 'e.g. MH-123456' },
      { name: 'primaryHospital', label: 'Primary Hospital', type: 'ref', required: true, refKey: 'hospitals' },
      { name: 'inPersonFee', label: 'In-Person Consultation Fee (₹)', type: 'number', required: true, hint: 'e.g. 500' },
    ],
  },
  'lab partner': {
    label: 'Lab Partner', icon: FlaskConical, color: 'warning',
    description: 'Creates a lab technician/partner account linked to a Clinic or Diagnostic Center.',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true, hint: 'e.g. Suresh Babu' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, hint: 'e.g. suresh@diagnostics.com' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: false, hint: 'e.g. 9876543210' },
      { name: 'assignedHospital', label: 'Assigned Clinic / Lab', type: 'ref', required: true, refKey: 'labPartnerHospitals' },
    ],
  },
  transportpartner: {
    label: 'Transport Partner', icon: Truck, color: 'accent',
    description: 'Links a user account to an existing Transport Agency. KYC is mandatory per transport regulations.',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true, hint: 'e.g. Ramesh Yadav' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, hint: 'e.g. ramesh@transagency.com' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: false, hint: 'e.g. 9876543210' },
      { name: 'agencyId', label: 'Transport Agency', type: 'ref', required: true, refKey: 'transportPartners' },
      { name: 'kyc.panNumber', label: 'PAN Number', type: 'text', required: true, hint: 'e.g. ABCDE1234F', note: 'Mandatory per RBI/transport compliance.' },
      { name: 'kyc.aadhaarNumber', label: 'Aadhaar Number', type: 'text', required: true, hint: 'Enter 12-digit number', note: 'Exactly 12 digits. Only last 4 digits stored in profile.' },
      { name: 'kyc.documentUrl', label: 'Identity Proof Document', type: 'upload', required: true, hint: 'PAN card / Aadhaar scan / Passport', folder: 'kyc/transport-partners' },
    ],
  },
  pharmacy: {
    label: 'Pharmacist', icon: Pill, color: 'secondary',
    description: 'Creates a pharmacist account linked to a Pharmacy Store. Pharmacist manages orders for that store.',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true, hint: 'e.g. Meena Pillai' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, hint: 'e.g. meena@pharma.com' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: false, hint: 'e.g. 9876543210' },
      { name: 'pharmacistName', label: 'Pharmacist Display Name', type: 'text', required: true, hint: 'e.g. Meena R. Pillai' },
      { name: 'registrationNumber', label: 'PCI Registration No.', type: 'text', required: true, hint: 'e.g. AP/2019/123456' },
      { name: 'qualification', label: 'Qualification', type: 'select', required: true, options: ['D.Pharm', 'B.Pharm', 'M.Pharm', 'Pharm.D'] },
      { name: 'assignedStore', label: 'Assigned Pharmacy Store', type: 'ref', required: true, refKey: 'pharmacyStores' },
    ],
  },
  finance: {
    label: 'Finance', icon: BadgeDollarSign, color: 'success',
    description: 'Creates a Finance team account. Only Superadmins can create Finance users.',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true, hint: 'e.g. Ananya Krishnan' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, hint: 'e.g. ananya@likeson.in' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: false, hint: 'e.g. 9876543210' },
    ],
  },
  'care assistant': {
    label: 'Care Assistant', icon: HeartHandshake, color: 'error',
    description: 'Creates a Care Assistant account for home-based patient support. Background verification required separately.',
    fields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true, hint: 'e.g. Lakshmi Devi' },
      { name: 'email', label: 'Email Address', type: 'email', required: true, hint: 'e.g. lakshmi@care.com' },
      { name: 'phone', label: 'Mobile Number', type: 'tel', required: false, hint: 'e.g. 9876543210' },
      { name: 'experienceYears', label: 'Years of Experience', type: 'number', required: false, hint: 'e.g. 3' },
      { name: 'baseServiceCharge', label: 'Base Service Charge (₹)', type: 'number', required: false, hint: 'e.g. 500' },
    ],
  },
};

const PLATFORM_ICON = { android: Smartphone, ios: Smartphone, web: Globe, desktop: Monitor };

const CHART_COLORS = [
  'var(--primary)', 'var(--success)', 'var(--warning)',
  'var(--accent)', 'var(--info)', 'var(--error)', 'var(--secondary)',
];

const CREATE_THUNKS = {
  customer:         createCustomer,
  doctor:           createDoctor,
  'lab partner':    createLabPartner,
  transportpartner: createTransportPartner,
  pharmacy:         createPharmacy,
  finance:          createFinance,
  'care assistant': createCareAssistant,
};

// ─────────────────────────────────────────────────────────────────────────────
// PORTAL WRAPPER (Fixes Fixed Positioning & Scroll issues)
// ─────────────────────────────────────────────────────────────────────────────
function ModalsPortal({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

// ─────────────────────────────────────────────────────────────────────────────
// REF ITEM LABEL RESOLVER
// ─────────────────────────────────────────────────────────────────────────────
const resolveRefLabel = (item) => {
  if (item.businessName) {
    const city = item.registeredAddress?.city ?? '';
    const type = item.businessType ? ` (${item.businessType})` : '';
    return `${item.businessName}${city ? ` — ${city}` : ''}${type}`;
  }
  if (item.storeName) {
    const city = item.address?.city ?? '';
    return `${item.storeName}${city ? ` — ${city}` : ''}`;
  }
  if (item.name) {
    const city = item.address?.city ?? '';
    const type = item.hospitalType ? ` (${item.hospitalType})` : '';
    return `${item.name}${city ? ` — ${city}` : ''}${type}`;
  }
  return item._id;
};

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const RoleBadge = ({ role }) => {
  const cfg  = ROLES.find(r => r.value === role) || ROLES[0];
  const Icon = cfg.icon;
  return (
    <span className={`badge badge-${cfg.color} gap-1`}>
      <Icon size={10} />{role || 'all'}
    </span>
  );
};

const StatusDot = ({ online }) => (
  <span className={`inline-block w-2 h-2 rounded-full ${online ? 'bg-success animate-pulse' : 'bg-base-300'}`} />
);

const BlockBadge = ({ isBlocked }) =>
  isBlocked
    ? <span className="badge badge-error gap-1"><ShieldOff size={10} />Blocked</span>
    : <span className="badge badge-success gap-1"><Shield size={10} />Active</span>;

const VerifyBadge = ({ verified }) =>
  verified
    ? <span className="badge badge-success gap-1"><CheckCircle2 size={10} />Verified</span>
    : <span className="badge badge-warning gap-1"><Clock size={10} />Unverified</span>;

const LoadingSpinner = ({ size = 20 }) => (
  <Loader2 size={size} className="animate-spin text-primary" />
);

const EmptyState = ({ message = 'No users found' }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-24 gap-4"
  >
    <div className="w-20 h-20 rounded-full bg-base-200 flex items-center justify-center">
      <Users size={32} className="text-base-content/30" />
    </div>
    <p className="text-base-content/50 font-medium">{message}</p>
  </motion.div>
);

const FieldNote = ({ note }) => {
  if (!note) return null;
  return (
    <div className="flex items-start gap-1.5 mt-1.5">
      <Info size={10} className="text-primary/60 flex-shrink-0 mt-0.5" />
      <p className="text-[10px] leading-relaxed text-base-content/45 font-medium">{note}</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED COUNTER
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedCounter({ value, duration = 1200, prefix = '', suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  useEffect(() => {
    const target = Number(value) || 0;
    const start  = performance.now();
    const tick = (now) => {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);
  return <>{prefix}{display.toLocaleString('en-IN')}{suffix}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS SECTION
// ─────────────────────────────────────────────────────────────────────────────
const mockTrend = () => {
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    data.push({ date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), users: Math.floor(Math.random() * 80) + 10 });
  }
  return data;
};
const MOCK_TREND = mockTrend();

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="card px-3 py-2 text-xs shadow-xl">
      <p className="font-black text-base-content mb-1">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-base-content/70">{p.name}:</span>
          <span className="font-bold text-base-content">{p.value?.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
};

function StatCard({ label, value, icon: Icon, color, trend, trendLabel, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', damping: 20, stiffness: 260 }}
      className="card p-5 relative overflow-hidden group"
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[inherit]"
        style={{ background: `radial-gradient(ellipse at top left, color-mix(in oklch, var(--${color}) 12%, transparent), transparent 70%)` }} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `color-mix(in oklch, var(--${color}) 15%, var(--base-200))` }}>
            <Icon size={20} style={{ color: `var(--${color})` }} />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
              {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <p className="text-3xl font-black text-base-content"><AnimatedCounter value={value} /></p>
        <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mt-1">{label}</p>
        {trendLabel && <p className="text-[10px] text-base-content/30 mt-0.5">{trendLabel}</p>}
      </div>
    </motion.div>
  );
}

function AnalyticsSection({ users, pagination }) {
  const [activeChart, setActiveChart] = useState('trend');
  const [isExpanded, setIsExpanded]   = useState(true);

  const total    = pagination?.total || 0;
  // Based entirely on the current page to avoid mathematically incorrect numbers globally
  const pageBlocked  = users.filter(u => u.isBlocked).length;
  const pageVerified = users.filter(u => u.isEmailVerified).length;
  const pageOnline   = users.filter(u => u.isOnline).length;

  const roleCount = {};
  users.forEach(u => {
    const label = ROLES.find(r => r.value === u.role)?.label || u.role || 'Unknown';
    roleCount[label] = (roleCount[label] || 0) + 1;
  });
  
  const pieData = Object.entries(roleCount).map(([name, value]) => ({ name, value }));
  const barData = Object.entries(roleCount).map(([name, count]) => ({
    name: name.length > 10 ? name.slice(0, 9) + '…' : name, count,
  })).sort((a, b) => b.count - a.count).slice(0, 6);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-base-300 cursor-pointer select-none" onClick={() => setIsExpanded(v => !v)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Activity size={18} className="text-primary" />
          </div>
          <div>
            <h2 className="font-black text-base-content text-base">Platform Analytics</h2>
            <p className="text-[11px] text-base-content/50">Total Platform Users & Current Page Data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-base-200 rounded-lg p-1">
            {[
              { id: 'trend', icon: Activity,     label: 'Trend' },
              { id: 'roles', icon: BarChart2,    label: 'Roles' },
              { id: 'pie',   icon: PieChartIcon, label: 'Share' },
            ].map(({ id, icon: Ic, label }) => (
              <button key={id}
                onClick={(e) => { e.stopPropagation(); setActiveChart(id); setIsExpanded(true); }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeChart === id ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
              >
                <Ic size={10} /> {label}
              </button>
            ))}
          </div>
          <motion.div animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
            <ChevronDown size={16} className="text-base-content/40" />
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} style={{ overflow: 'hidden' }}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 border-b border-base-300">
              <StatCard label="Total Users"    value={total}         icon={Users}        color="primary"  trend={8}  trendLabel="Global platform total" delay={0}    />
              <StatCard label="Verified (Page)" value={pageVerified} icon={CheckCircle2} color="info"                trendLabel="Of current page sample" delay={0.05} />
              <StatCard label="Blocked (Page)"  value={pageBlocked}  icon={ShieldOff}    color="error"               trendLabel="Of current page sample" delay={0.1}  />
              <StatCard label="Online Now"     value={pageOnline}    icon={Activity}     color="accent"              trendLabel="Of current page sample" delay={0.15} />
            </div>
            <div className="p-5">
              <AnimatePresence mode="wait">
                {activeChart === 'trend' && (
                  <motion.div key="trend" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-4">Registration Trend · Last 30 Days</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={MOCK_TREND} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="var(--primary)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0}    />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="users" name="New Users" stroke="var(--primary)" strokeWidth={2} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
                {activeChart === 'roles' && (
                  <motion.div key="roles" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                    <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-4">Users by Role · Current Page Sample</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%"   stopColor="var(--primary)"   stopOpacity={1}   />
                            <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.7} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.5 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name="Users" fill="url(#barGrad)" radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </motion.div>
                )}
                {activeChart === 'pie' && (
                  <motion.div key="pie" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-black uppercase tracking-widest text-base-content/40 mb-4">Role Distribution · Current Page Sample</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                            {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 min-w-32">
                      {pieData.map((item, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                          <span className="text-[10px] text-base-content/60 truncate">{item.name}</span>
                          <span className="text-[10px] font-black text-base-content ml-auto">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC DOCUMENT UPLOAD FIELD
// ─────────────────────────────────────────────────────────────────────────────
function KycDocUploadField({ field, currentUrl, onUploadComplete }) {
  const dispatch    = useDispatch();
  const uploadState = useSelector(state => state.upload);
  const { isUploading, lastUploadedUrl, error: uploadError } = uploadState;

  const [localFile, setLocalFile]             = useState(null);
  const [localPreview, setLocalPreview]       = useState(null);
  const [uploadTriggered, setUploadTriggered] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (uploadTriggered && !isUploading && lastUploadedUrl) {
      onUploadComplete(field.name, lastUploadedUrl);
      setUploadTriggered(false);
    }
  }, [isUploading, lastUploadedUrl, uploadTriggered, field.name, onUploadComplete]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('File too large. Maximum size is 5 MB.'); return; }
    setLocalFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setLocalPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else { setLocalPreview(null); }
    dispatch(resetUploadState());
    setUploadTriggered(true);
    dispatch(uploadSingleFile({ file, folder: field.folder || 'kyc/documents' }));
  };

  const isUploaded = Boolean(currentUrl);

  return (
    <div className="space-y-0">
      <label className="text-xs font-bold text-base-content/70 uppercase tracking-wider flex items-center gap-1">
        {field.label} {field.required && <span className="text-error">*</span>}
      </label>
      <div
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed cursor-pointer transition-all p-4 min-h-[90px] mt-1.5 ${
          isUploaded ? 'border-success/50 bg-success/5' : isUploading ? 'border-primary/50 bg-primary/5 cursor-not-allowed' : 'border-base-300 bg-base-200/40 hover:border-primary/40 hover:bg-primary/5'
        }`}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-1.5">
            <LoadingSpinner size={22} />
            <p className="text-xs text-base-content/50 font-medium">Uploading…</p>
          </div>
        ) : isUploaded ? (
          <div className="flex items-center gap-3 w-full">
            {localPreview ? (
              <img src={localPreview} alt="preview" className="w-12 h-12 rounded-lg object-cover border border-base-300 flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <FileText size={20} className="text-success" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-success flex items-center gap-1"><CheckCircle2 size={12} /> Uploaded successfully</p>
              <p className="text-[10px] text-base-content/50 truncate">{localFile?.name || 'Document'}</p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); setLocalFile(null); setLocalPreview(null); onUploadComplete(field.name, ''); dispatch(resetUploadState()); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              className="w-6 h-6 rounded-full bg-base-300 hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors flex-shrink-0">
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-center">
            <Upload size={20} className="text-base-content/30" />
            <p className="text-xs font-semibold text-base-content/50">Click to upload</p>
            <p className="text-[10px] text-base-content/30">{field.hint}</p>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,application/pdf" className="hidden" onChange={handleFileChange} required={field.required && !isUploaded} />
      </div>
      {uploadError && uploadTriggered === false && (
        <p className="text-[10px] text-error flex items-center gap-1 mt-1"><X size={10} /> {uploadError}</p>
      )}
      <FieldNote note={field.note} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE USER MODAL
// ─────────────────────────────────────────────────────────────────────────────
function CreateUserModal({ onClose }) {
  const dispatch      = useDispatch();
  const ref           = useSelector(selectRefData);
  const loadingMap    = useSelector(selectUsersLoading);
  const refLoading    = loadingMap.refHospitals || loadingMap.refLabHospitals || loadingMap.refPharmacyStores || loadingMap.refTransportPartners;
  const createLoading = useSelector(selectCreateLoading);
  const errors        = useSelector(selectUsersErrors);
  const createError   = errors.create;

  const [succeeded, setSucceeded]         = useState(false);
  const [selectedRole, setSelectedRole]   = useState('customer');
  const [formData, setFormData]           = useState({});
  const [localValidationError, setLocalValidationError] = useState('');
  const wasLoading = useRef(false);

  useEffect(() => {
    if (wasLoading.current && !createLoading && !createError) setSucceeded(true);
    wasLoading.current = createLoading;
  }, [createLoading, createError]);

  useEffect(() => {
    if (succeeded) {
      const t = setTimeout(() => { dispatch(clearErrors()); dispatch(resetUploadState()); onClose(); }, 800);
      return () => clearTimeout(t);
    }
  }, [succeeded, dispatch, onClose]);

  useEffect(() => { return () => { dispatch(resetUploadState()); }; }, [dispatch]);

  const REF_DATA = {
    hospitals:           ref.hospitals           ?? [],
    labPartnerHospitals: ref.labPartnerHospitals ?? [],
    pharmacyStores:      ref.pharmacyStores      ?? [],
    transportPartners:   ref.transportPartners   ?? [],
  };

  const config = ROLE_CREATE_CONFIG[selectedRole];

  useEffect(() => {
    dispatch(fetchRefHospitals());
    dispatch(fetchRefLabPartnerHospitals());
    dispatch(fetchRefPharmacyStores());
    dispatch(fetchRefTransportPartners());
  }, [dispatch]);

  const handleRoleChange = (role) => {
    setSelectedRole(role); setFormData({});
    dispatch(clearErrors()); dispatch(resetUploadState()); setSucceeded(false); setLocalValidationError('');
  };

  const setNestedValue = (obj, path, value) => {
    const keys   = path.split('.');
    const result = { ...obj };
    let current  = result;
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...(current[keys[i]] || {}) };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    return result;
  };

  const handleChange = useCallback(
    (name, value) => setFormData(prev => setNestedValue(prev, name, value)), []
  );

  const getNestedValue = (obj, path) =>
    path.split('.').reduce((o, k) => o?.[k] ?? '', obj);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(clearErrors()); setSucceeded(false); setLocalValidationError('');
    const payload = { ...formData };

    if (selectedRole === 'transportpartner') {
      if (!payload.kyc?.documentUrl) {
        setLocalValidationError('Please upload the identity proof document before submitting.');
        return;
      }
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(payload.kyc?.panNumber || '')) {
        setLocalValidationError('Invalid PAN format. Expected: ABCDE1234F'); return;
      }
      if (!/^\d{12}$/.test(payload.kyc?.aadhaarNumber || '')) {
        setLocalValidationError('Aadhaar must be exactly 12 digits.'); return;
      }
    }

    if (selectedRole === 'doctor' && payload.inPersonFee) {
      payload.fees = { inPersonFee: Number(payload.inPersonFee) };
      delete payload.inPersonFee;
    }

    dispatch(CREATE_THUNKS[selectedRole](payload));
  };

  const roleKeys = Object.keys(ROLE_CREATE_CONFIG);
  const isUploadInProgress = useSelector(state => state.upload?.isUploading);
  const submitDisabled = createLoading || isUploadInProgress;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="card w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col bg-base-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black text-base-content">Create New User</h2>
              <p className="text-xs text-base-content/50">Credentials emailed automatically on creation</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-base-200 hover:bg-error/10 hover:text-error flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Role Selector */}
        <div className="p-4 border-b border-base-300 bg-base-200/50 flex-shrink-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-2">Select Role</p>
          <div className="flex flex-wrap gap-1.5">
            {roleKeys.map(role => {
              const cfg  = ROLE_CREATE_CONFIG[role];
              const Icon = cfg.icon;
              const active = selectedRole === role;
              return (
                <button key={role} onClick={() => handleRoleChange(role)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${active ? 'bg-primary text-primary-content shadow-sm' : 'bg-base-100 text-base-content/60 hover:text-base-content hover:bg-base-300'}`}
                >
                  <Icon size={12} />{cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Role Description Banner */}
        <AnimatePresence mode="wait">
          <motion.div key={selectedRole} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="px-6 pt-4 flex-shrink-0">
            {config.description && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
                <Zap size={13} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-primary/80 font-medium leading-relaxed">{config.description}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          <form id="create-user-form" onSubmit={handleSubmit} className="space-y-5">
            {config.fields.map(field => {
              const value = getNestedValue(formData, field.name);

              // ── Upload ───────────────────────────────────────────────────────
              if (field.type === 'upload') {
                return (
                  <KycDocUploadField
                    key={field.name} field={field}
                    currentUrl={value} onUploadComplete={handleChange}
                  />
                );
              }

              // ── Select ───────────────────────────────────────────────────────
              if (field.type === 'select') {
                return (
                  <div key={field.name} className="space-y-0">
                    <label className="text-xs font-bold text-base-content/70 uppercase tracking-wider flex items-center gap-1">
                      {field.label} {field.required && <span className="text-error">*</span>}
                    </label>
                    <select className="input-field w-full mt-1.5" value={value}
                      onChange={e => handleChange(field.name, e.target.value)} required={field.required}>
                      <option value="">Select {field.label}</option>
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <FieldNote note={field.note} />
                  </div>
                );
              }

              // ── Ref Dropdown ─────────────────────────────────────────────────
              if (field.type === 'ref') {
                const refItems = REF_DATA[field.refKey] ?? [];
                return (
                  <div key={field.name} className="space-y-0">
                    <label className="text-xs font-bold text-base-content/70 uppercase tracking-wider flex items-center gap-1">
                      {field.label} {field.required && <span className="text-error">*</span>}
                    </label>
                    {refLoading ? (
                      <div className="input-field w-full flex items-center gap-2 text-base-content/40 mt-1.5">
                        <LoadingSpinner size={14} /> Loading options…
                      </div>
                    ) : refItems.length === 0 ? (
                      <div className="input-field w-full flex items-center gap-2 text-base-content/40 text-xs mt-1.5">
                        <AlertTriangle size={14} className="text-warning" />
                        No {field.label} records available
                      </div>
                    ) : (
                      <select className="input-field w-full mt-1.5" value={value}
                        onChange={e => handleChange(field.name, e.target.value)} required={field.required}>
                        <option value="">Select {field.label}</option>
                        {refItems.map(item => (
                          <option key={item._id} value={item._id}>{resolveRefLabel(item)}</option>
                        ))}
                      </select>
                    )}
                    {/* Vehicle count hint for transport */}
                    {field.refKey === 'transportPartners' && value && (() => {
                      const selected = refItems.find(i => i._id === value);
                      if (!selected) return null;
                      const vehicleCount = selected.vehicles?.length ?? 0;
                      const city = selected.registeredAddress?.city ?? '';
                      return (
                        <p className="text-[10px] text-base-content/40 flex items-center gap-1.5 mt-1">
                          <Truck size={9} />{vehicleCount} vehicle{vehicleCount !== 1 ? 's' : ''} registered{city ? ` · ${city}` : ''}
                        </p>
                      );
                    })()}
                    <FieldNote note={field.note} />
                  </div>
                );
              }

              // ── Text / Number / Email / Tel ──────────────────────────────────
              return (
                <div key={field.name} className="space-y-0">
                  <label className="text-xs font-bold text-base-content/70 uppercase tracking-wider flex items-center gap-1">
                    {field.label} {field.required && <span className="text-error">*</span>}
                  </label>
                  <input
                    type={field.type} className="input-field w-full mt-1.5"
                    placeholder={field.hint || field.label} value={value}
                    onChange={e => handleChange(field.name, e.target.value)}
                    required={field.required}
                    min={field.type === 'number' ? 0 : undefined}
                  />
                  <FieldNote note={field.note} />
                </div>
              );
            })}

            {/* Validation / API errors */}
            {localValidationError && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="alert alert-warning text-sm">
                <AlertTriangle size={16} className="text-warning flex-shrink-0" />{localValidationError}
              </motion.div>
            )}
            {createError && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="alert alert-error text-sm">
                <X size={16} className="text-error flex-shrink-0" />{createError}
              </motion.div>
            )}
            {succeeded && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="alert alert-success text-sm">
                <CheckCircle2 size={16} className="text-success flex-shrink-0" />Account created! Closing…
              </motion.div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-base-300 flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] text-base-content/35 flex items-center gap-1">
            <Info size={10} />Fields marked <span className="text-error font-bold">*</span> are required
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary px-5 py-2 text-sm">Cancel</button>
            <button form="create-user-form" type="submit" disabled={submitDisabled}
              title={isUploadInProgress ? 'Wait for document upload to complete' : undefined}
              className="btn-primary-cta px-5 py-2 text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {createLoading ? <><LoadingSpinner size={14} /> Creating…</>
                : isUploadInProgress ? <><LoadingSpinner size={14} /> Uploading…</>
                : <><UserPlus size={14} /> Create User</>}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────
function UserDetailDrawer({ userId, onClose }) {
  const dispatch      = useDispatch();
  const detail        = useSelector(selectSelectedUser);
  const detailLoading = useSelector(selectDetailLoading);
  const errors        = useSelector(selectUsersErrors);
  const detailError   = errors.detail;
  const sessions      = useSelector(selectUserSessions);
  const sessLoading   = useSelector(selectSessionsLoading);
  const blockLoading  = useSelector(selectBlockLoading);
  const resetLoading  = useSelector(selectResetPasswordLoading);
  const loadingMap    = useSelector(selectUsersLoading);

  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (userId) { dispatch(fetchUserById(userId)); dispatch(fetchUserSessions(userId)); }
    return () => { dispatch(clearSelectedUser()); dispatch(clearErrors()); };
  }, [userId, dispatch]);

  const handleBlock         = () => dispatch(blockUnblockUser({ id: userId, action: detail?.isBlocked ? 'unblock' : 'block', reason: 'Admin action via user panel' }));
  const handleResetPwd      = () => dispatch(resetUserPassword(userId));
  const handleVerifyEmail   = () => dispatch(verifyUserEmail(userId));
  const handleRevokeSession = (sessionId) => dispatch(revokeUserSession({ userId, sessionId }));

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'profile',  label: 'Profile'  },
    { id: 'orders',   label: 'Orders'   },
    { id: 'security', label: 'Security' },
  ];

  const PlatformIcon = ({ platform }) => {
    const Icon = PLATFORM_ICON[platform] || Monitor;
    return <Icon size={14} className="text-base-content/50" />;
  };

  const actionLoading = blockLoading || resetLoading || loadingMap.verifyEmail;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex justify-end"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-xl h-full bg-base-100 border-l border-base-300 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-base-300 flex-shrink-0">
          <h2 className="text-lg font-black text-base-content">User Detail</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>

        {detailLoading && <div className="flex-1 flex items-center justify-center"><LoadingSpinner size={32} /></div>}
        {detailError && !detailLoading && (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="alert alert-error"><X size={16} className="text-error" /> {detailError}</div>
          </div>
        )}

        {detail && !detailLoading && (
          <div className="flex-1 overflow-y-auto">
            {/* Hero */}
            <div className="p-5 bg-gradient-to-br from-primary/5 to-secondary/5 border-b border-base-300">
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={detail.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(detail.name)}&background=random`}
                    alt={detail.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-base-300"
                  />
                  <div className="absolute -bottom-1 -right-1"><StatusDot online={detail.isOnline} /></div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-xl text-base-content truncate">{detail.name}</h3>
                  <p className="text-sm text-base-content/60 truncate">{detail.email}</p>
                  {detail.phone && <p className="text-xs text-base-content/50">{detail.phone}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <RoleBadge role={detail.role} />
                    <BlockBadge isBlocked={detail.isCurrentlyBlocked ?? detail.isBlocked} />
                    <VerifyBadge verified={detail.isEmailVerified} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={handleBlock} disabled={actionLoading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-60 ${(detail.isCurrentlyBlocked ?? detail.isBlocked) ? 'bg-success/10 text-success hover:bg-success/20' : 'bg-error/10 text-error hover:bg-error/20'}`}
                >
                  {blockLoading ? <LoadingSpinner size={12} /> : (detail.isCurrentlyBlocked ?? detail.isBlocked) ? <><Shield size={12} /> Unblock</> : <><ShieldOff size={12} /> Block</>}
                </button>
                <button onClick={handleResetPwd} disabled={actionLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-warning/10 text-warning hover:bg-warning/20 transition-all disabled:opacity-60"
                >
                  {resetLoading ? <LoadingSpinner size={12} /> : <><KeyRound size={12} /> Reset Password</>}
                </button>
                {!detail.isEmailVerified && (
                  <button onClick={handleVerifyEmail} disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-info/10 text-info hover:bg-info/20 transition-all disabled:opacity-60"
                  >
                    {loadingMap.verifyEmail ? <LoadingSpinner size={12} /> : <><MailCheck size={12} /> Verify Email</>}
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-base-300 px-5 bg-base-200/30 flex-shrink-0">
              {TABS.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-base-content/50 hover:text-base-content'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {activeTab === 'overview' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: Mail,     label: 'Email',       value: detail.email },
                      { icon: Phone,    label: 'Phone',       value: detail.phone || '—' },
                      { icon: Calendar, label: 'Joined',      value: new Date(detail.accountTimeline?.createdAt).toLocaleDateString('en-IN') },
                      { icon: Clock,    label: 'Last Active', value: detail.accountTimeline?.lastActiveAt ? new Date(detail.accountTimeline.lastActiveAt).toLocaleDateString('en-IN') : '—' },
                      { icon: MapPin,   label: 'Address',     value: detail.lastKnownAddress || '—' },
                      { icon: Shield,   label: 'Work Status', value: detail.workStatus || '—' },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="bg-base-200/50 rounded-xl p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={12} className="text-primary" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">{label}</span>
                        </div>
                        <p className="text-sm font-semibold text-base-content truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                  {(detail.isCurrentlyBlocked ?? detail.isBlocked) && detail.blockReason && (
                    <div className="alert alert-error text-sm">
                      <AlertTriangle size={14} className="text-error flex-shrink-0" />
                      <div>
                        <p className="font-bold text-xs uppercase">Block Reason</p>
                        <p className="text-xs mt-0.5">{detail.blockReason}</p>
                        {detail.unblockAt && <p className="text-xs mt-1 opacity-70">Auto-unblocks: {new Date(detail.unblockAt).toLocaleString('en-IN')}</p>}
                      </div>
                    </div>
                  )}
                  {detail.notifications?.recent?.length > 0 && (
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-base-content/50 mb-2">Recent Notifications</h4>
                      <div className="space-y-2">
                        {detail.notifications.recent.slice(0, 5).map((n, i) => (
                          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${n.isRead ? 'bg-base-200/30 border-transparent' : 'bg-primary/5 border-primary/20'}`}>
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Info size={10} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-base-content truncate">{n.title}</p>
                              <p className="text-[11px] text-base-content/60 mt-0.5 line-clamp-2">{n.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'profile' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {detail.profile ? (
                    <div className="space-y-3">
                      {Object.entries(detail.profile)
                        .filter(([k]) => !['_id','__v','user','createdAt','updatedAt'].includes(k))
                        .map(([key, value]) => {
                          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                            return (
                              <div key={key} className="bg-base-200/50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50 mb-2">{key}</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {Object.entries(value).filter(([, v]) => v !== null && v !== undefined).map(([k2, v2]) => (
                                    <div key={k2}>
                                      <p className="text-[10px] text-base-content/40">{k2}</p>
                                      <p className="text-xs font-semibold text-base-content truncate">{String(v2)}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          if (Array.isArray(value)) {
                            return (
                              <div key={key} className="bg-base-200/50 rounded-xl p-3">
                                <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50 mb-1">{key}</p>
                                <p className="text-xs text-base-content/70">{value.join(', ') || '—'}</p>
                              </div>
                            );
                          }
                          return (
                            <div key={key} className="flex justify-between items-center py-2 border-b border-base-300">
                              <span className="text-xs text-base-content/50 capitalize">{key}</span>
                              <span className="text-xs font-semibold text-base-content">{String(value)}</span>
                            </div>
                          );
                        })}
                    </div>
                  ) : <EmptyState message="No profile data available" />}
                </motion.div>
              )}

         {activeTab === 'orders' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  {/* ── Pharmacy Orders ── */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-base-content/50">Pharmacy Orders</h4>
                    {detail.orderStats && (
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Total',     value: detail.orderStats.totalOrders,     color: 'primary' },
                          { label: 'Delivered', value: detail.orderStats.deliveredOrders, color: 'success' },
                          { label: 'Cancelled', value: detail.orderStats.cancelledOrders, color: 'error'   },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-base-200/50 rounded-xl p-3 text-center">
                            <p className={`text-2xl font-black text-${color}`}>{value}</p>
                            <p className="text-[10px] text-base-content/50 uppercase tracking-wider">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {detail.orderStats?.totalSpent && (
                      <div className="bg-success/5 border border-success/20 rounded-xl p-4 flex items-center justify-between">
                        <span className="text-sm text-base-content/60 font-medium">Total Spent</span>
                        <span className="text-2xl font-black text-success">₹{Number(detail.orderStats.totalSpent).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {detail.orderHistory?.length > 0 ? (
                      <div className="space-y-2">
                        {detail.orderHistory.map((order, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl">
                            <div>
                              <p className="text-xs font-bold text-base-content">{order.orderId}</p>
                              <p className="text-[10px] text-base-content/50">{new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-base-content">₹{order.billing?.totalPayable?.toLocaleString('en-IN')}</p>
                              <span className={`badge badge-${order.delivery?.status === 'Delivered' ? 'success' : order.delivery?.status === 'Cancelled' ? 'error' : 'warning'}`} style={{ fontSize: '9px' }}>
                                {order.delivery?.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <EmptyState message="No orders yet" />}
                  </div>

                  {/* ── Bookings (rides/consultations/etc) ── */}
                  <div className="space-y-4 pt-4 border-t border-base-300">
                    <h4 className="text-xs font-black uppercase tracking-wider text-base-content/50">Bookings</h4>
                    {detail.bookingStats && (
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Total',     value: detail.bookingStats.totalBookings,     color: 'primary' },
                          { label: 'Completed', value: detail.bookingStats.completedBookings, color: 'success' },
                          { label: 'Cancelled', value: detail.bookingStats.cancelledBookings, color: 'error'   },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="bg-base-200/50 rounded-xl p-3 text-center">
                            <p className={`text-2xl font-black text-${color}`}>{value}</p>
                            <p className="text-[10px] text-base-content/50 uppercase tracking-wider">{label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {detail.bookingStats?.totalSpent && (
                      <div className="bg-success/5 border border-success/20 rounded-xl p-4 flex items-center justify-between">
                        <span className="text-sm text-base-content/60 font-medium">Total Spent</span>
                        <span className="text-2xl font-black text-success">₹{Number(detail.bookingStats.totalSpent).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {detail.bookingHistory?.length > 0 ? (
                      <div className="space-y-2">
                        {detail.bookingHistory.map((booking, i) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl">
                            <div>
                              <p className="text-xs font-bold text-base-content">{booking.bookingCode}</p>
                              <p className="text-[10px] text-base-content/50 capitalize">{booking.bookingType?.replace(/_/g, ' ')}</p>
                              <p className="text-[10px] text-base-content/50">{new Date(booking.createdAt).toLocaleDateString('en-IN')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-base-content">₹{booking.fareBreakdown?.totalAmount?.toLocaleString('en-IN') ?? 0}</p>
                              <span className={`badge badge-${booking.status === 'completed' ? 'success' : ['cancelled','no_show'].includes(booking.status) ? 'error' : 'warning'}`} style={{ fontSize: '9px' }}>
                                {booking.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : <EmptyState message="No bookings yet" />}
                  </div>
                </motion.div>
              )}

              {activeTab === 'security' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-base-200/50 rounded-xl p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50">Login Count</p>
                      <p className="text-2xl font-black text-primary">{detail.security?.loginCount ?? 0}</p>
                    </div>
                    <div className="bg-base-200/50 rounded-xl p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-base-content/50">Active Sessions</p>
                      <p className="text-2xl font-black text-primary">{detail.security?.totalSessions ?? 0}</p>
                    </div>
                  </div>
                  {detail.security?.lastLoginAt && (
                    <div className="flex justify-between items-center py-2 border-b border-base-300">
                      <span className="text-xs text-base-content/50">Last Login</span>
                      <span className="text-xs font-semibold">{new Date(detail.security.lastLoginAt).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  {detail.security?.lastLoginIp && (
                    <div className="flex justify-between items-center py-2 border-b border-base-300">
                      <span className="text-xs text-base-content/50">Last IP</span>
                      <span className="text-xs font-mono font-semibold">{detail.security.lastLoginIp}</span>
                    </div>
                  )}
                  {sessLoading ? (
                    <div className="flex justify-center py-4"><LoadingSpinner /></div>
                  ) : sessions && sessions.length > 0 ? (
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-base-content/50 mb-2">Active Sessions</h4>
                      <div className="space-y-2">
                        {sessions.map(session => (
                          <div key={session._id} className="flex items-center justify-between p-3 bg-base-200/50 rounded-xl gap-3">
                            <div className="flex items-center gap-2">
                              <PlatformIcon platform={session.platform} />
                              <div>
                                <p className="text-xs font-bold text-base-content">{session.deviceName}</p>
                                <p className="text-[10px] text-base-content/50">{session.ipAddress}</p>
                              </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleRevokeSession(session._id); }}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-error/10 text-error hover:bg-error/20 transition-colors">
                              <LogOut size={10} /> Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <EmptyState message="No active sessions" />}
                </motion.div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTERS BAR
// ─────────────────────────────────────────────────────────────────────────────
function FiltersBar({ filters, onFilterChange, onReset, onSearch }) {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const handleSearchSubmit = (e) => { e.preventDefault(); onSearch(searchValue); };

  return (
    <div className="flex  flex-wrap items-center gap-3 p-4 bg-base-200/40 border-b border-base-300">
      <form onSubmit={handleSearchSubmit} className="flex relative items-center gap-2 flex-1 min-w-52">
        <div className=" flex-1 w-full max-w-xl relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input type="text" placeholder="Search name, email, phone…" value={searchValue}
            onChange={e => setSearchValue(e.target.value)} className="input-field w-full pl-9 py-2 text-sm" />
        </div>
        <button type="submit" className="btn-primary-cta btn px-3 py-2 text-xs"><Search size={12} /></button>
      </form>
      <select className="input-field w-20 py-2 text-sm min-w-32" value={filters.role || ''} onChange={e => onFilterChange({ role: e.target.value })}>
        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <div className='flex gap-2'>
        <select className="input-field py-2 text-sm" value={filters.isBlocked !== undefined ? String(filters.isBlocked) : ''} onChange={e => onFilterChange({ isBlocked: e.target.value })}>
          <option value="">All Status</option>
          <option value="false">Active</option>
          <option value="true">Blocked</option>
        </select>
        <select className="input-field py-2 text-sm" value={filters.isEmailVerified !== undefined ? String(filters.isEmailVerified) : ''} onChange={e => onFilterChange({ isEmailVerified: e.target.value })}>
          <option value="">All Verified</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
        <select className="input-field py-2 text-sm" value={`${filters.sortBy || 'createdAt'}_${filters.sortOrder || 'desc'}`}
          onChange={e => { const [sortBy, sortOrder] = e.target.value.split('_'); onFilterChange({ sortBy, sortOrder }); }}>
          <option value="createdAt_desc">Newest First</option>
          <option value="createdAt_asc">Oldest First</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
        </select>
        <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-base-content/60 hover:text-base-content bg-base-200 hover:bg-base-300 transition-colors">
          <RefreshCw size={12} /> Reset
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER ROW (Table)
// ─────────────────────────────────────────────────────────────────────────────
function UserRow({ user, onView, onBlock, onResetPwd, onDelete, mutLoading }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  
  useEffect(() => {
    const handleClick = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <motion.tr initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="border-b border-base-300 hover:bg-primary/3 transition-colors group relative">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=40&background=random`}
              alt={user.name} className="w-9 h-9 rounded-xl object-cover" />
            <div className="absolute -bottom-0.5 -right-0.5"><StatusDot online={user.isOnline} /></div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-base-content truncate max-w-36">{user.name}</p>
            <p className="text-xs text-base-content/50 truncate max-w-36">{user.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <BlockBadge isBlocked={user.isCurrentlyBlocked ?? user.isBlocked} />
          <VerifyBadge verified={user.isEmailVerified} />
        </div>
      </td>
      <td className="px-4 py-3"><p className="text-xs text-base-content/60">{new Date(user.createdAt).toLocaleDateString('en-IN')}</p></td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onView(user._id); }} className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors" title="View Details">
            <Eye size={13} />
          </button>
          <div className="relative" ref={menuRef}>
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="w-7 h-7 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors">
              <MoreVertical size={13} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div initial={{ opacity: 0, scale: 0.92, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                  className="absolute right-0 top-8 z-20 w-44 card shadow-xl py-1 overflow-hidden bg-base-100">
                  {[
                    { icon: user.isBlocked ? Shield : ShieldOff, label: user.isBlocked ? 'Unblock' : 'Block', color: user.isBlocked ? 'text-success' : 'text-error', onClick: () => { onBlock(user); } },
                    { icon: KeyRound, label: 'Reset Password', color: 'text-warning', onClick: () => { onResetPwd(user._id); } },
                    { icon: Trash2, label: 'Delete User', color: 'text-error', onClick: () => { onDelete(user._id); } },
                  ].map(({ icon: Icon, label, color, onClick }) => (
                    <button key={label} onClick={(e) => { e.stopPropagation(); onClick(); setMenuOpen(false); }} disabled={mutLoading}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold ${color} hover:bg-base-200 transition-colors disabled:opacity-50`}>
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </td>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER GRID CARD
// ─────────────────────────────────────────────────────────────────────────────
function UserGridCard({ user, onView, onBlock, onResetPwd, onDelete, mutLoading, index }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  
  useEffect(() => {
    const handleClick = (e) => { if (!menuRef.current?.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  const roleCfg = ROLES.find(r => r.value === user.role) || ROLES[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      transition={{ delay: index * 0.03, type: 'spring', damping: 22, stiffness: 280 }}
      className="card p-5 group relative overflow-visible"
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 opacity-60 group-hover:opacity-100 transition-opacity rounded-t-[inherit]" style={{ background: `var(--${roleCfg.color})` }} />
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&size=48&background=random`}
              alt={user.name} className="w-12 h-12 rounded-2xl object-cover border-2 border-base-300 group-hover:border-primary/40 transition-colors" />
            <div className="absolute -bottom-0.5 -right-0.5"><StatusDot online={user.isOnline} /></div>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-base-content truncate max-w-28">{user.name}</p>
            <p className="text-[10px] text-base-content/50 truncate max-w-28">{user.email}</p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} className="w-7 h-7 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100">
            <MoreVertical size={12} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div initial={{ opacity: 0, scale: 0.88, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88 }}
                className="absolute right-0 top-8 z-20 w-44 card shadow-xl py-1 overflow-hidden bg-base-100">
                {[
                  { icon: EyeIcon, label: 'View Details', color: 'text-primary', onClick: () => { onView(user._id); } },
                  { icon: user.isBlocked ? Shield : ShieldOff, label: user.isBlocked ? 'Unblock' : 'Block', color: user.isBlocked ? 'text-success' : 'text-error', onClick: () => { onBlock(user); } },
                  { icon: KeyRound, label: 'Reset Password', color: 'text-warning', onClick: () => { onResetPwd(user._id); } },
                  { icon: Trash2, label: 'Delete User', color: 'text-error', onClick: () => { onDelete(user._id); } },
                ].map(({ icon: Icon, label, color, onClick }) => (
                  <button key={label} onClick={(e) => { e.stopPropagation(); onClick(); setMenuOpen(false); }} disabled={mutLoading}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold ${color} hover:bg-base-200 transition-colors disabled:opacity-50`}>
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <RoleBadge role={user.role} />
        <BlockBadge isBlocked={user.isCurrentlyBlocked ?? user.isBlocked} />
      </div>
      <div className="space-y-1.5 mb-4">
        {user.phone && (
          <div className="flex items-center gap-2 text-[10px] text-base-content/50"><Phone size={9} /> <span className="truncate">{user.phone}</span></div>
        )}
        <div className="flex items-center gap-2 text-[10px] text-base-content/50"><Calendar size={9} /><span>Joined {new Date(user.createdAt).toLocaleDateString('en-IN')}</span></div>
        <div className="flex items-center gap-2 text-[10px]">
          {user.isEmailVerified
            ? <><CheckCircle2 size={9} className="text-success" /><span className="text-success">Email verified</span></>
            : <><Clock size={9} className="text-warning" /><span className="text-warning">Unverified</span></>}
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onView(user._id); }} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-primary/8 text-primary hover:bg-primary/15 transition-colors">
        <Eye size={11} /> View Details
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────
function Pagination({ pagination, limit, onPageChange, onLimitChange }) {
  const { total, page, totalPages } = pagination;
  const effectiveLimit = limit || pagination.limit || 20;
  
  const from = (page - 1) * effectiveLimit + 1;
  const to   = Math.min(page * effectiveLimit, total);
  
  return (
    <div className="flex items-center justify-between p-4 border-t border-base-300">
      <div className="flex items-center gap-2 text-xs text-base-content/60">
        <span>Show</span>
        <select className="input-field py-1 px-2 text-xs" value={effectiveLimit} onChange={e => onLimitChange(Number(e.target.value))}>
          {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span>of <strong className="text-base-content">{total.toLocaleString()}</strong> users ({from > total ? 0 : from}–{to})</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="w-8 h-8 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = totalPages <= 5 ? i + 1 : Math.max(1, page - 2) + i;
          if (p > totalPages) return null;
          return (
            <button key={p} onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${p === page ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300 text-base-content'}`}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || totalPages === 0} className="w-8 h-8 rounded-lg bg-base-200 hover:bg-base-300 flex items-center justify-center disabled:opacity-30 transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDialog({ action, onConfirm, onCancel, loading }) {
  const configs = {
    block:    { title: 'Block User',     body: 'This will prevent the user from logging in.',             color: 'error',   icon: ShieldOff },
    unblock:  { title: 'Unblock User',   body: 'The user will regain access to their account.',           color: 'success', icon: Shield    },
    delete:   { title: 'Delete User',    body: 'Soft delete — user is blocked and email anonymised.',     color: 'error',   icon: Trash2    },
    resetPwd: { title: 'Reset Password', body: 'A new password is generated and emailed to the user.',    color: 'warning', icon: KeyRound  },
  };
  const cfg  = configs[action?.type] || configs.block;
  const Icon = cfg.icon;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="card w-full max-w-sm p-6 space-y-4 bg-base-100">
        <div className={`w-12 h-12 rounded-2xl bg-${cfg.color}/10 flex items-center justify-center mx-auto`}>
          <Icon size={24} className={`text-${cfg.color}`} />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black text-base-content">{cfg.title}</h3>
          <p className="text-sm text-base-content/60 mt-1">{cfg.body}</p>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onCancel} className="flex-1 btn-secondary py-2 text-sm">Cancel</button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all bg-${cfg.color} text-${cfg.color === 'warning' ? 'base-100' : `${cfg.color}-content`} hover:brightness-110 disabled:opacity-60`}>
            {loading ? <><LoadingSpinner size={14} /> Processing…</> : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function UsersManagement() {
  const dispatch = useDispatch();

  const users       = useSelector(selectAllUsers);
  const pagination  = useSelector(selectUsersPagination);
  const filters     = useSelector(selectUsersFilters);
  const listLoading = useSelector(selectListLoading);
  const errors      = useSelector(selectUsersErrors);
  const listError   = errors.list;
  const loadingMap  = useSelector(selectUsersLoading);
  const mutLoading  = loadingMap.block || loadingMap.resetPassword || loadingMap.delete;

  const [showCreate,    setShowCreate]    = useState(false);
  const [viewUserId,    setViewUserId]    = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [viewMode,      setViewMode]      = useState('table');

  const activeLimit = filters.limit || pagination.limit || 20;

  useEffect(() => {
    dispatch(fetchAllUsers({ 
      ...filters, 
      page: pagination.page || 1, 
      limit: activeLimit 
    }));
  }, [filters, pagination.page, activeLimit, dispatch]);

  const handleFilterChange = (changes) => { dispatch(setFilters(changes)); dispatch(setPage(1)); };
  const handleSearch       = (search)  => { dispatch(setFilters({ search })); dispatch(setPage(1)); };
  const handleResetFilters = ()        => { dispatch(setFilters({ role: '', isBlocked: '', isEmailVerified: '', search: '', sortBy: 'createdAt', sortOrder: 'desc', limit: 20 })); dispatch(setPage(1)); };
  const handlePageChange   = (page)    => dispatch(setPage(page));
  const handleLimitChange  = (limit)   => { dispatch(setFilters({ limit })); dispatch(setPage(1)); };
  const handleBlock        = (user)    => setConfirmAction({ type: user.isBlocked ? 'unblock' : 'block', userId: user._id, user });
  const handleResetPwd     = (userId)  => setConfirmAction({ type: 'resetPwd', userId });
  const handleDelete       = (userId)  => setConfirmAction({ type: 'delete', userId });

  const handleConfirm = () => {
    if (!confirmAction) return;
    const { type, userId } = confirmAction;
    if (type === 'block' || type === 'unblock') {
      dispatch(blockUnblockUser({ id: userId, action: type, reason: 'Admin action' }));
    } else if (type === 'resetPwd') {
      dispatch(resetUserPassword(userId));
    } else if (type === 'delete') {
      dispatch(deleteUser(userId));
    }
    setConfirmAction(null);
  };

  return (
    <div className="min-h-screen bg-base-100">

      {/* ── Page Header ── */}
      <div className="sticky top-0 z-30 bg-base-100/80 backdrop-blur-strong border-b border-base-300 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-base-content tracking-tight">Users Management</h1>
            <p className="text-sm text-base-content/50 mt-0.5">
              <strong className="text-base-content">{pagination.total?.toLocaleString() || 0}</strong> total users across all roles
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-base-200 rounded-xl p-1 gap-1">
              <button onClick={() => setViewMode('table')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${viewMode === 'table' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
                title="Table view"><LayoutList size={15} /></button>
              <button onClick={() => setViewMode('grid')}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${viewMode === 'grid' ? 'bg-primary text-primary-content shadow-sm' : 'text-base-content/50 hover:text-base-content'}`}
                title="Grid view"><LayoutGrid size={15} /></button>
            </div>
            <button
              onClick={() => dispatch(fetchAllUsers({ ...filters, page: pagination.page, limit: activeLimit }))}
              disabled={listLoading}
              className="w-9 h-9 rounded-xl bg-base-200 hover:bg-base-300 flex items-center justify-center transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={listLoading ? 'animate-spin text-primary' : 'text-base-content/60'} />
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary-cta flex items-center gap-2 px-4 py-2.5 text-sm">
              <UserPlus size={15} /> New User
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4 relative z-10">

        {/* ── Analytics ── */}
        <AnalyticsSection users={users} pagination={pagination} />

        {/* ── Role Pills ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="flex flex-wrap gap-2">
          <button onClick={() => handleFilterChange({ role: '' })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${!filters.role ? 'bg-primary text-primary-content border-primary' : 'bg-base-200 text-base-content/70 border-base-300 hover:border-primary/50'}`}>
            <Users size={11} />All · {pagination.total?.toLocaleString() || 0}
          </button>
          {ROLES.slice(1).map(r => {
            const Icon = r.icon;
            return (
              <button key={r.value} onClick={() => handleFilterChange({ role: r.value })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${filters.role === r.value ? `bg-${r.color} text-${r.color}-content border-${r.color}` : 'bg-base-200 text-base-content/70 border-base-300 hover:border-primary/50'}`}>
                <Icon size={11} />{r.label}
              </button>
            );
          })}
        </motion.div>

        {/* ── Table / Grid ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card overflow-visible">
          <FiltersBar filters={filters} onFilterChange={handleFilterChange} onReset={handleResetFilters} onSearch={handleSearch} />

          {listError && (
            <div className="p-4">
              <div className="alert alert-error text-sm"><X size={14} className="text-error" /> {listError}</div>
            </div>
          )}

          {viewMode === 'table' && (
            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full">
                <thead>
                  <tr className="bg-base-200/60 border-b border-base-300">
                    {['User', 'Role', 'Status', 'Joined', 'Actions'].map(col => (
                      <th key={col} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-base-content/50">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {listLoading ? (
                      <tr><td colSpan={5} className="py-24 text-center"><LoadingSpinner size={32} /></td></tr>
                    ) : users.length === 0 ? (
                      <tr><td colSpan={5}><EmptyState message="No users match your filters" /></td></tr>
                    ) : (
                      users.map(user => (
                        <UserRow key={user._id} user={user} onView={setViewUserId} onBlock={handleBlock} onResetPwd={handleResetPwd} onDelete={handleDelete} mutLoading={mutLoading} />
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'grid' && (
            <div className="p-4 min-h-[400px]">
              {listLoading ? (
                <div className="flex items-center justify-center py-24"><LoadingSpinner size={32} /></div>
              ) : users.length === 0 ? (
                <EmptyState message="No users match your filters" />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  <AnimatePresence mode="popLayout">
                    {users.map((user, index) => (
                      <UserGridCard key={user._id} user={user} index={index} onView={setViewUserId} onBlock={handleBlock} onResetPwd={handleResetPwd} onDelete={handleDelete} mutLoading={mutLoading} />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {pagination.total > 0 && (
            <Pagination pagination={pagination} limit={activeLimit} onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
          )}
        </motion.div>
      </div>

      {/* ── Overlays (Portaled to strictly prevent scrolling bugs) ── */}
      <ModalsPortal>
        <AnimatePresence>
          {showCreate && (
            <CreateUserModal onClose={() => { setShowCreate(false); dispatch(clearErrors()); dispatch(resetUploadState()); }} />
          )}
          {viewUserId && (
            <UserDetailDrawer userId={viewUserId} onClose={() => setViewUserId(null)} />
          )}
          {confirmAction && (
            <ConfirmDialog action={confirmAction} onConfirm={handleConfirm} onCancel={() => setConfirmAction(null)} loading={mutLoading} />
          )}
        </AnimatePresence>
      </ModalsPortal>
    </div>
  );
}