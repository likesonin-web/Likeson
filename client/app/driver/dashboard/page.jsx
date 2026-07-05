'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

// ── Lucide ────────────────────────────────────────────────────────────────────
import {
  Menu, X, ChevronRight,
  MapPin, AlertCircle, TrendingUp, Star,
  Activity, Navigation, Zap, Clock,
  Shield, Wifi, LogOut, Bell, Settings,
  Award, BarChart2, Car, FileText,
  User, CreditCard, CheckCircle2,
  ChevronDown, Radio,
} from 'lucide-react';

// ── Recharts ──────────────────────────────────────────────────────────────────
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';

// ── Redux slice thunks ────────────────────────────────────────────────────────
import {
  fetchDriverMe,
  fetchDriverRewards,
  fetchDriverLogs,
  updateDriverStatus,
  resetTPState,
} from '@/store/slices/transportPartnerSlice';

// ── Navigation Constants ──────────────────────────────────────────────────────
import { 
  DRIVER_DASHBOARD_LINKS, 
  DRIVER_TOP_RIGHT_LINKS 
} from '../../../constants/driverlinks'; 

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Available', 'On-Break', 'Offline'];

const STATUS_META = {
  Available: {
    label: 'Available',
    dotClass: 'bg-primary',
    bgClass: 'bg-primary/15',
    borderClass: 'border-primary/50',
    textClass: 'text-primary',
  },
  'On-Trip': {
    label: 'On Trip',
    dotClass: 'bg-secondary',
    bgClass: 'bg-secondary/15',
    borderClass: 'border-secondary/50',
    textClass: 'text-secondary',
  },
  'On-Break': {
    label: 'On Break',
    dotClass: 'bg-accent',
    bgClass: 'bg-accent/15',
    borderClass: 'border-accent/50',
    textClass: 'text-accent',
  },
  Offline: {
    label: 'Offline',
    dotClass: 'bg-error',
    bgClass: 'bg-base-200',
    borderClass: 'border-base-300',
    textClass: 'text-base-content',
  },
};

const MOCK_WEEKLY = [
  { day: 'Mon', amt: 820  },
  { day: 'Tue', amt: 1240 },
  { day: 'Wed', amt: 960  },
  { day: 'Thu', amt: 1580 },
  { day: 'Fri', amt: 2100 },
  { day: 'Sat', amt: 1750 },
  { day: 'Sun', amt: 630  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const SIDEBAR_V = {
  closed: { x: '-100%', transition: { type: 'spring', stiffness: 400, damping: 42 } },
  open:   { x: 0,       transition: { type: 'spring', stiffness: 360, damping: 36 } },
};

const OVERLAY_V = {
  hidden: { opacity: 0 },
  visible:{ opacity: 1 },
};

const CARD_V = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.07, type: 'spring', stiffness: 280, damping: 24 },
  }),
};

const ITEM_V = {
  hidden:  { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.05, type: 'spring', stiffness: 320, damping: 28 },
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatusDot = ({ status, size = 'md' }) => {
  const m = STATUS_META[status] || STATUS_META.Offline;
  const sizeMap = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3.5 h-3.5' };
  
  return (
    <span className={`relative flex shrink-0 ${sizeMap[size]}`}>
      <span className={`${sizeMap[size]} rounded-full animate-ping absolute opacity-60 ${m.dotClass}`} />
      <span className={`${sizeMap[size]} rounded-full ${m.dotClass}`} />
    </span>
  );
};

const StatusToggle = ({ currentStatus, onSelect, disabled }) => {
  const options = STATUS_OPTIONS;
  const currentIdx = options.indexOf(currentStatus);
  const activeIdx = currentIdx === -1 ? 2 : currentIdx;

  return (
    <div className="flex items-center rounded-full p-0.5 gap-0.5 bg-base-200 border border-base-300">
      {options.map((s, i) => {
        const m = STATUS_META[s];
        const isActive = i === activeIdx;
        
        return (
          <button
            key={s}
            onClick={() => !disabled && onSelect(s)}
            disabled={disabled}
            className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-bold tracking-wide uppercase transition-all duration-200 cursor-pointer outline-none disabled:cursor-not-allowed ${
              isActive 
                ? `${m.bgClass} border ${m.borderClass} ${m.textClass}` 
                : 'bg-transparent border border-transparent text-base-content/50 hover:text-base-content/80'
            }`}
          >
            <span className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full shrink-0 ${isActive ? m.dotClass + ' opacity-100' : 'bg-current opacity-40'}`} />
            <span className="hidden sm:inline">{m.label}</span>
            <span className="sm:hidden">{m.label.substring(0, 3)}</span>
          </button>
        );
      })}
    </div>
  );
};

const EarningsTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-[11px] shadow-xl bg-base-100 border border-base-300 text-base-content">
      <p className="font-bold mb-0.5 m-0">{label}</p>
      <p className="m-0 font-bold text-primary">
        ₹ {payload[0]?.value?.toLocaleString('en-IN')}
      </p>
    </div>
  );
};

const NavGroup = ({ group, index, onLinkClick }) => {
  const [open, setOpen] = useState(false);

  return (
    <motion.div custom={index} variants={ITEM_V} initial="hidden" animate="visible" className="mb-0.5">
      <button
        onClick={() => setOpen(p => !p)}
        className={`w-full flex items-center justify-between px-3.5 py-3.5 rounded-xl border-none cursor-pointer text-[10px] uppercase tracking-wider font-bold transition-all duration-200 group outline-none ${
          open ? 'bg-primary/15 text-primary ' : 'text-base-content hover:bg-base-200'
        }`}
      >
        <span className="flex items-center gap-2.5">
          <span className={open ? 'opacity-100' : 'opacity-55'}>{group.icon}</span>
          {group.title}
        </span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} className="opacity-50">
          <ChevronRight size={13} strokeWidth={2.5} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { height: { duration: 0.28, ease: [0.04, 0.62, 0.23, 0.98] }, opacity: { duration: 0.3 }, staggerChildren: 0.05, delayChildren: 0.04 } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <div className="ml-5 pl-2 py-1.5 mt-1 mb-1 flex flex-col gap-0.5 border-l border-base-300">
              {group.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onLinkClick}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[10px] uppercase font-semibold no-underline transition-all duration-200 text-base-content/70 hover:bg-primary/10 hover:text-primary"
                >
                  <span className="opacity-60">{link.icon}</span>
                  {link.name}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const MetricCard = ({ icon: Icon, label, value, sub, colorClass = 'primary', index }) => {
  const colors = {
    primary: { text: 'text-primary', bg: 'bg-primary/15', border: 'border-t-primary' },
    accent: { text: 'text-accent', bg: 'bg-accent/15', border: 'border-t-accent' },
    success: { text: 'text-success', bg: 'bg-success/15', border: 'border-t-success' },
    warning: { text: 'text-warning', bg: 'bg-warning/15', border: 'border-t-warning' },
  };
  const c = colors[colorClass] || colors.primary;

  return (
    <motion.div
      custom={index} variants={CARD_V} initial="hidden" animate="visible"
      className={`rounded-2xl p-4 flex flex-col gap-2 bg-base-200 border border-base-300 border-t-[2.5px] ${c.border}`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.bg}`}>
        <Icon size={16} className={c.text} strokeWidth={2.2} />
      </div>
      <div>
        <p className={`font-montserrat font-extrabold text-xl leading-none m-0 ${c.text}`}>{value}</p>
        <p className="text-[0.62rem] font-bold uppercase tracking-wider m-0 mt-1 text-base-content/45">{label}</p>
        {sub && <p className="text-[0.6rem] m-0 mt-0.5 text-base-content/40">{sub}</p>}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function DriverDashboard() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const { driverMe, driverRewards, loading } = useSelector(s => s.transportPartner);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast,       setToast]       = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    dispatch(fetchDriverMe());
    dispatch(fetchDriverRewards());
    dispatch(fetchDriverLogs({ page: 1, limit: 5 }));
  }, [dispatch]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, type });
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const handleStatus = useCallback(async (status) => {
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      await dispatch(updateDriverStatus({ status })).unwrap();
      showToast(`Status → ${status}`);
    } catch (e) {
      showToast(e || 'Update failed', 'error');
    } finally {
      setStatusLoading(false);
    }
  }, [dispatch, statusLoading, showToast]);

  const handleLogout = useCallback(() => {
    dispatch(resetTPState());
    router.push('/login');
  }, [dispatch, router]);

  const driver  = driverMe;
  const rewards = driverRewards || driver?.rewards;
  const status  = driver?.status || 'Offline';
  const sm      = STATUS_META[status] || STATUS_META.Offline;
  const perf    = driver?.performance || {};
  const kycOk   = driver?.kyc?.verificationStatus === 'Verified';
  const onTrip  = status === 'On-Trip';

  const radialData = [{
    name: 'Rating',
    value: Math.round(((perf.rating || 0) / 5) * 100),
    fill: 'var(--primary)', 
  }];
  const weekTotal = MOCK_WEEKLY.reduce((a, b) => a + b.amt, 0);

  return (
    <div data-theme="driver" className="min-h-dvh font-poppins bg-base-100 relative overflow-x-hidden">

      {/* ─── Sidebar Overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            key="overlay"
            variants={OVERLAY_V} initial="hidden" animate="visible" exit="hidden"
            transition={{ duration: 0.18 }}
            onClick={closeSidebar}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            key="sidebar"
            variants={SIDEBAR_V} initial="closed" animate="open" exit="closed"
            className="fixed top-0 left-0 bottom-0 z-[100] flex flex-col overflow-y-auto bg-base-100 border-r border-base-300 w-[min(82vw,288px)]"
          >
            {/* Sidebar header */}
            <div className="p-4 flex items-center justify-between gap-3 border-b bg-gradient-to-r from-primary to-primary/80">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center overflow-hidden font-extrabold text-lg bg-white/20 border-2 border-white/35 text-white">
                  {driver?.user?.avatar
                    ? <img src={driver.user.avatar} alt="" className="w-full h-full object-cover" />
                    : (driver?.legalName || 'D')[0].toUpperCase()
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-xs text-white m-0 leading-tight truncate">
                    {driver?.legalName || 'Driver'}
                  </p>
                  <p className="text-[0.67rem] m-0 mt-0.5 truncate text-white/65">
                    {driver?.driverCode || 'ID pending'}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${sm.dotClass}`} />
                    <span className="text-[0.65rem] font-semibold text-white/80">
                      {sm.label}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={closeSidebar}
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border-none cursor-pointer text-white transition-colors bg-white/10 hover:bg-white/20"
              >
                <X size={16} />
              </button>
            </div>

            {/* KYC warning banner */}
            {!kycOk && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="mx-3 mt-3 px-3 py-2.5 rounded-xl flex items-center gap-2 bg-warning/15 border border-warning/50"
              >
                <AlertCircle size={15} className="text-warning shrink-0" />
                <Link
                  href="/driver/kyc/submit" onClick={closeSidebar}
                  className="text-[11px] font-bold no-underline text-warning hover:opacity-80"
                >
                  KYC pending — complete now →
                </Link>
              </motion.div>
            )}

            {/* Status toggle in sidebar */}
            <div className="px-3 pt-4 pb-2">
              <p className="text-[0.58rem] font-bold uppercase tracking-widest mb-2 text-base-content/40">
                My Status
              </p>
              <div className="flex rounded-xl p-1 gap-1 bg-base-200">
                {STATUS_OPTIONS.map(s => {
                  const m = STATUS_META[s];
                  const isActive = s === status;
                  return (
                    <button
                      key={s}
                      onClick={() => !onTrip && handleStatus(s)}
                      disabled={onTrip || statusLoading}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all duration-200 cursor-pointer outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive ? `${m.bgClass} ${m.textClass} ${m.borderClass}` : 'bg-transparent text-base-content/50 border-transparent hover:text-base-content/80'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? m.dotClass + ' opacity-100' : 'bg-current opacity-40'}`} />
                      {m.label.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nav groups mapped via imported constant */}
            <nav className="flex-1 px-3 py-2 flex flex-col gap-0">
              {DRIVER_DASHBOARD_LINKS.map((group, i) => (
                <NavGroup key={group.title} group={group} index={i} onLinkClick={closeSidebar} />
              ))}
            </nav>

            {/* Bottom: logout */}
            <div className="p-3 pb-[max(1.25rem,calc(env(safe-area-inset-bottom)+0.75rem))] border-t border-base-300">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-bold font-poppins cursor-pointer transition-all duration-200 bg-error/10 text-error border border-error/30 hover:bg-error hover:text-error-content"
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ─── Sticky Top Bar ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-[99] flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-1 sm:gap-3 bg-base-100/90 backdrop-blur-md backdrop-saturate-150 border-b border-base-300 pt-[max(0.75rem,calc(env(safe-area-inset-top)+0.5rem))]">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center cursor-pointer transition-colors shrink-0 bg-base-200 border border-base-300 text-base-content hover:bg-base-300"
          aria-label="Open menu"
        >
          <Menu size={16} className="sm:w-5 sm:h-5" />
        </button>

        <div className="flex-1 flex justify-center min-w-0 overflow-x-auto no-scrollbar">
          {onTrip ? (
            <div className={`flex items-center gap-1.5 sm:gap-2 px-2 py-1 sm:px-4 sm:py-2 rounded-full text-[9px] sm:text-[11px] font-bold truncate ${STATUS_META['On-Trip'].bgClass} ${STATUS_META['On-Trip'].borderClass} ${STATUS_META['On-Trip'].textClass}`}>
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full animate-ping shrink-0 bg-warning" />
              On Trip
            </div>
          ) : (
            <StatusToggle
              currentStatus={status}
              onSelect={handleStatus}
              disabled={statusLoading}
            />
          )}
        </div>

        <div className="flex gap-1 sm:gap-2 shrink-0">
          {DRIVER_TOP_RIGHT_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              title={l.name}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center no-underline transition-colors bg-base-200 border border-base-300 text-base-content hover:bg-base-300"
            >
              {l.icon}
            </Link>
          ))}
        </div>
      </header>

      {/* ─── Page Content ─────────────────────────────────────────────────── */}
      <main className="mx-auto pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+2rem))] max-w-[768px]">
        
       {/* ── Hero Card (Premium Glass & Glow) ──────────────────────────────────────── */}
<motion.div
  initial={{ opacity: 0, y: 18 }} 
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.06, type: 'spring', stiffness: 260, damping: 28 }}
  className="mx-4 mt-4 rounded-[1.5rem] overflow-hidden relative bg-base-100 border border-base-300 shadow-[0_12px_40px_rgba(0,0,0,0.08)] shadow-primary/10"
>
  {/* Decorative Glowing Orbs (Creates the corner effect without muddying the middle) */}
  <div className="absolute -top-16 -left-16 w-52 h-52 bg-primary/25 blur-[60px] rounded-full pointer-events-none" />
  <div className="absolute -bottom-16 -right-16 w-52 h-52 bg-primary/25 blur-[60px] rounded-full pointer-events-none" />
  
  {/* Subtle top-light gradient to give it a premium sheen */}
  <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

  <div className="relative z-10 p-5 sm:p-6">
    <div className="flex items-start justify-between mb-6">
      <div>
        <p className="m-0 text-[0.65rem] font-bold uppercase tracking-widest text-primary mb-1">
          Welcome Back
        </p>
        <h2 className="font-montserrat font-extrabold text-2xl text-base-content m-0">
          {driver?.legalName || 'Driver'} 👋
        </h2>
      </div>
      
      {/* KYC chip - Upgraded with deeper contrast */}
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full shrink-0 border shadow-sm backdrop-blur-sm ${kycOk ? 'bg-success/10 border-success/25 text-success' : 'bg-warning/10 border-warning/25 text-warning'}`}>
        {kycOk
          ? <CheckCircle2 size={14} className="text-success" />
          : <AlertCircle size={14} className="text-warning" />
        }
        <span className="text-[10px] font-extrabold uppercase tracking-wide">
          {kycOk ? 'Verified' : 'Pending'}
        </span>
      </div>
    </div>

    {/* 3 quick stats - Upgraded to floating inner cards */}
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
      {[
        {
          label: 'STATUS',
          content: (
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full animate-pulse shadow-sm ${sm.dotClass}`} />
              <span className="text-base-content font-extrabold text-xs sm:text-sm">{sm.label}</span>
            </div>
          ),
        },
        {
          label: 'TODAY EST.',
          content: (
            <p className="text-primary font-extrabold text-xs sm:text-sm m-0 mt-1">
              ₹ {(perf.totalEarnings ? Math.round(perf.totalEarnings / 30) : 0).toLocaleString('en-IN')}
            </p>
          ),
        },
        {
          label: 'RIDES',
          content: (
            <p className="text-base-content font-extrabold text-xs sm:text-sm m-0 mt-1">
              {(perf.monthlyRides || 0)} <span className="text-[9px] text-base-content/40 font-medium">this mo.</span>
            </p>
          ),
        },
      ].map(({ label, content }) => (
        <div 
          key={label} 
          className="rounded-2xl p-3 bg-base-100/60 backdrop-blur-md border border-base-300/60 shadow-sm transition-colors duration-300 hover:bg-base-100 hover:border-primary/30"
        >
          <p className="m-0 text-[0.6rem] font-bold uppercase tracking-wider text-base-content/50">
            {label}
          </p>
          {content}
        </div>
      ))}
    </div>
  </div>
</motion.div>

        {/* ── Metrics 2×2 grid ───────────────────────────────────────────── */}
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          <MetricCard
            index={0} icon={Activity} label="Total Rides"
            value={(perf.totalRidesCompleted || 0).toLocaleString('en-IN')}
            sub="All time" colorClass="primary"
          />
          <MetricCard
            index={1} icon={Star} label="Rating"
            value={perf.rating ? perf.rating.toFixed(1) : '—'}
            sub={`${perf.ratingCount || 0} reviews`} colorClass="accent"
          />
          <MetricCard
            index={2} icon={TrendingUp} label="Earned"
            value={`₹${((perf.totalEarnings || 0) / 1000).toFixed(1)}k`}
            sub="Lifetime" colorClass="success"
          />
          <MetricCard
            index={3} icon={Zap} label="Coins"
            value={(rewards?.coinBalance || 0).toLocaleString('en-IN')}
            sub={rewards?.tier || 'Bronze'} colorClass="warning"
          />
        </div>

        {/* ── Rating ring + profile % ────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, type: 'spring', stiffness: 240, damping: 26 }}
          className="mx-4 mt-4 p-4 rounded-2xl flex items-center gap-4 bg-base-200 border border-base-300"
        >
          <div className="w-[76px] h-[76px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="68%" outerRadius="100%"
                startAngle={90} endAngle={-270}
                data={radialData}
              >
                <RadialBar
                  dataKey="value"
                  cornerRadius={6}
                  background={{ fill: 'var(--base-300)' }}
                />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-montserrat font-extrabold text-2xl m-0 flex items-baseline gap-1 text-primary">
              {perf.rating ? perf.rating.toFixed(1) : '—'}
              <span className="text-[11px] font-medium text-base-content/40">/5</span>
            </p>
            <p className="text-[11px] m-0 mt-0.5 mb-3 text-base-content/55">
              Tier: <strong className="text-accent">{perf.performanceTier || 'Bronze'}</strong>
            </p>
            {/* Profile completion bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-base-300">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-primary to-primary/70"
                  style={{ width: `${driver?.profileCompletionPercent || 0}%` }}
                />
              </div>
              <span className="text-[0.67rem] font-bold shrink-0 text-primary">
                {driver?.profileCompletionPercent || 0}%
              </span>
            </div>
            <p className="text-[0.58rem] m-0 mt-0.5 text-base-content/35">
              Profile complete
            </p>
          </div>
        </motion.div>

        {/* ── Weekly earnings chart ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 240, damping: 26 }}
          className="mx-4 mt-4 p-4 rounded-2xl bg-base-200 border border-base-300"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-montserrat font-extrabold text-sm m-0 text-base-content">
                Weekly Earnings
              </h3>
              <p className="text-[11px] m-0 mt-0.5 text-base-content/50">
                This week breakdown
              </p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold bg-primary/10 border border-primary/35 text-primary">
              ₹ {weekTotal.toLocaleString('en-IN')}
            </span>
          </div>

          <div className="h-[110px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_WEEKLY} margin={{ top: 4, right: 2, left: -28, bottom: 0 }}>
                <defs>
                  <linearGradient id="drvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.45 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  content={<EarningsTooltip />}
                  cursor={{ stroke: 'var(--primary)', strokeWidth: 1, strokeDasharray: '4 3' }}
                />
                <Area
                  type="monotone" dataKey="amt"
                  stroke="var(--primary)" strokeWidth={2}
                  fill="url(#drvGrad)"
                  dot={{ fill: 'var(--primary)', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--base-100)' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Live stats row (3-col) ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.47, type: 'spring', stiffness: 240, damping: 26 }}
          className="px-4 mt-4 grid grid-cols-3 gap-2.5"
        >
          {[
            {
              label: 'Avg Pickup',
              value: `${perf.avgPickupTimeMinutes || 0}m`,
              icon: Clock,
              colorClass: 'text-info',
              borderClass: 'border-t-info',
            },
            {
              label: 'KM Driven',
              value: (perf.totalDistanceKm || 0).toLocaleString('en-IN'),
              icon: Navigation,
              colorClass: 'text-success',
              borderClass: 'border-t-success',
            },
            {
              label: 'Cancel %',
              value: `${Math.round(perf.cancellationRate || 0)}%`,
              icon: AlertCircle,
              colorClass: 'text-error',
              borderClass: 'border-t-error',
            },
          ].map(({ label, value, icon: Icon, colorClass, borderClass }) => (
            <div
              key={label}
              className={`rounded-2xl p-3 text-center bg-base-200 border border-base-300 border-t-[2.5px] ${borderClass}`}
            >
              <Icon size={17} className={`mx-auto mb-1.5 opacity-85 ${colorClass}`} />
              <p className={`font-montserrat font-extrabold text-base m-0 ${colorClass}`}>
                {value}
              </p>
              <p className="text-[0.58rem] uppercase tracking-wide m-0 mt-0.5 text-base-content/45">
                {label}
              </p>
            </div>
          ))}
        </motion.div>

        {/* ── Quick access chips ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.54, type: 'spring', stiffness: 240, damping: 26 }}
          className="px-4 mt-5"
        >
          <p className="text-[0.6rem] font-bold tracking-widest uppercase m-0 mb-3 text-base-content/40">
            Quick Access
          </p>
          <div className="flex flex-wrap gap-2">
            {DRIVER_TOP_RIGHT_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[11px] font-semibold no-underline transition-all duration-200 bg-base-200 border border-base-300 text-base-content hover:bg-primary/10 hover:border-primary/50 hover:text-primary"
              >
                <span className="opacity-65">{link.icon}</span>
                {link.name}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ── Connectivity strip ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.62 }}
          className="mx-4 mt-5 p-3.5 rounded-2xl flex items-center gap-3 bg-base-200 border border-base-300"
        >
          <Wifi size={17} className="text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold m-0 text-base-content">
              Live Tracking Active
            </p>
            <p className="text-[0.63rem] m-0 mt-0.5 text-base-content/50">
              Location syncing every 15s
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-bold shrink-0 bg-success/15 border border-success/40 text-success">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-success" />
            Online
          </div>
        </motion.div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-7 h-7 rounded-full border-[3px] border-primary/30 border-t-primary animate-spin" />
          </div>
        )}
      </main>

      {/* ─── Toast ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 32, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 18,  scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className={`fixed z-[999] text-xs font-bold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap pointer-events-none bottom-[max(5.5rem,calc(env(safe-area-inset-bottom)+5rem))] left-1/2 -translate-x-1/2 ${
              toast.type === 'error' ? 'bg-error text-error-content' : 'bg-success text-success-content'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}