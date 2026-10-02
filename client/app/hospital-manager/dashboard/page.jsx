'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useInView } from 'framer-motion';
import {
  BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Users, Wifi, ShieldCheck, BadgeCheck,
  AlertCircle, ChevronRight, BellRing, MapPin, Phone, 
  ArrowUpRight, ArrowDownRight, CalendarDays, DollarSign, 
  Heart, RefreshCw, TrendingUp, Wallet, Receipt, Percent, ClipboardList,
} from 'lucide-react';

import Earnings from '@/app/(partner)/earnings/myEarnings';

import {
  fetchDashboard,
  fetchDoctorStats,
  fetchNotifications,
  selectDashboard,
  selectDashboardBookings,
  selectDashboardRevenue,
  selectDashboardPlatformFee,
  selectDoctorStats,
  selectNotifications,
  isLoading,
} from '@/store/slices/hospitalManagerSlice';

// ─── Global Font Injection ────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('poppins-font')) {
  const link = document.createElement('link');
  link.id   = 'poppins-font';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

// ─── Notification Meta ────────────────────────────────────────────────────────
const NOTIF_META = {
  Account_Status: { icon: AlertCircle,  color: 'var(--color-warning)' },
  Payment:        { icon: DollarSign,   color: 'var(--color-success)' },
  Booking:        { icon: CalendarDays, color: 'var(--color-info)'    },
  Security:       { icon: ShieldCheck,  color: 'var(--color-error)'   },
  General:        { icon: BellRing,     color: 'var(--color-primary)' },
};
const notifMeta = (type) => NOTIF_META[type] || { icon: BellRing, color: 'var(--color-primary)' };

// ─── Chart Colors ─────────────────────────────────────────────────────────────
const CHART_COLORS = [
  'var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)',
  'var(--color-chart-4)', 'var(--color-chart-5)',
];

// ─── Professional Subtle Animations ───────────────────────────────────────────
const fadeIn = {
  hidden:  { opacity: 0, y: 10 },
  visible: (i = 0) => ({
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: "easeOut" },
  }),
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-3 shadow-lg text-xs font-poppins">
      <p className="font-semibold text-[color:var(--color-base-content)] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[color:var(--color-base-content)] opacity-60">{p.name}:</span>
          <span className="font-semibold text-[color:var(--color-base-content)]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, subtitle, action, actionLabel }) => (
  <div className="flex items-end justify-between mb-5">
    <div>
      <h2 className="text-sm font-semibold text-[color:var(--color-base-content)] font-poppins">{title}</h2>
      {subtitle && (
        <p className="text-xs text-[color:var(--color-base-content)] opacity-50 mt-1 font-medium">{subtitle}</p>
      )}
    </div>
    {action && (
      <button onClick={action} className="flex items-center gap-1 text-xs font-medium text-[color:var(--color-primary)] hover:opacity-80 transition-opacity">
        {actionLabel} <ChevronRight size={14} />
      </button>
    )}
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, delta, deltaLabel, color, delay }) => {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const isPos  = delta >= 0;

  return (
    <motion.div
      ref={ref} custom={delay} variants={fadeIn}
      initial="hidden" animate={inView ? 'visible' : 'hidden'}
      className="relative rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[color:var(--color-base-200)] border border-[color:var(--color-base-300)]">
          <Icon size={18} style={{ color }} />
        </div>
        {delta !== 0 && (
          <span className={`flex items-center gap-0.5 font-medium px-2 py-1 rounded-md text-[10px] ${
            isPos
              ? 'bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]'
              : 'bg-[color:var(--color-error)]/10 text-[color:var(--color-error)]'
          }`}>
            {isPos ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-[color:var(--color-base-content)] opacity-60">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-[color:var(--color-base-content)] font-poppins tracking-tight">
          {value ?? '—'}
        </p>
        <p className="mt-1 text-[11px] font-medium text-[color:var(--color-base-content)] opacity-40">
          {deltaLabel}
        </p>
      </div>
    </motion.div>
  );
};

// ─── Pricing Card ────────────────────────────────────────────────────────────
const PricingCard = ({ label, fee, subLabel, icon: PIcon, color }) => (
  <div className="rounded-xl p-5 border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] shadow-sm">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[color:var(--color-base-200)]">
        <PIcon size={16} style={{ color }} />
      </div>
      <span className="text-xs font-medium text-[color:var(--color-base-content)] opacity-60">
        {label}
      </span>
    </div>
    <p className="text-xl font-semibold text-[color:var(--color-base-content)] font-poppins tracking-tight">
      ₹{fee ?? 0}
    </p>
    <p className="mt-1 text-[11px] font-medium text-[color:var(--color-base-content)] opacity-40">
      {subLabel ?? '—'}
    </p>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Overview() {
  const dispatch        = useDispatch();
  const dashboard       = useSelector(selectDashboard);
  const doctorStats     = useSelector(selectDoctorStats);
  const notifications   = useSelector(selectNotifications);
  const bookings        = useSelector(selectDashboardBookings) ?? {};
  const revenue         = useSelector(selectDashboardRevenue)  ?? {};
  const dashPlatformFee = useSelector(selectDashboardPlatformFee);
  const loading         = useSelector(isLoading(fetchDashboard));

  useEffect(() => {
    dispatch(fetchDashboard());
    dispatch(fetchDoctorStats());
    dispatch(fetchNotifications({ limit: 10, page: 1 }));
  }, [dispatch]);

  const hospital = dashboard?.hospital;
  const doctors  = dashboard?.doctors  ?? {};

  const specialtyData = useMemo(() =>
    (doctorStats?.bySpecialization ?? [])
      .slice(0, 5)
      .map((s, i) => ({
        name:  s._id,
        value: s.count,
        fill:  CHART_COLORS[i % CHART_COLORS.length],
      })),
    [doctorStats]
  );

  const recentActivity = useMemo(() =>
    (notifications ?? []).slice(0, 6).map(n => {
      const meta = notifMeta(n.type);
      return {
        id:     n._id,
        action: n.title ?? n.body,
        time:   n.createdAt,
        icon:   meta.icon,
        color:  meta.color,
        isRead: n.isRead,
      };
    }),
    [notifications]
  );

  const timeAgo = (iso) => {
    if (!iso) return '';
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const totalDoctors   = doctorStats?.total    ?? doctors.total    ?? 0;
  const verifiedDocs   = doctorStats?.verified ?? doctors.verified ?? 0;
  const onlineDocs     = doctorStats?.online   ?? doctors.online   ?? 0;
  const unreadNotifs   = dashboard?.unreadNotifications ?? 0;

  const stats = [
    { icon: Users,        label: 'Total Doctors',    value: totalDoctors, delta: 0, deltaLabel: 'Linked to hospital',      color: 'var(--color-primary)'  },
    { icon: BadgeCheck,   label: 'Verified',         value: verifiedDocs, delta: 0, deltaLabel: 'KYC approved',            color: 'var(--color-success)'  },
    { icon: Wifi,         label: 'Online',           value: onlineDocs,   delta: 0, deltaLabel: 'Currently active',        color: 'var(--color-accent)'   },
    { icon: CalendarDays, label: "Today's Bookings", value: bookings.today ?? 0, delta: 0, deltaLabel: `${bookings.pending ?? 0} pending`, color: 'var(--color-warning)' },
    { icon: TrendingUp,   label: 'Revenue (Month)',  value: `₹${revenue.thisMonth ?? 0}`, delta: 0, deltaLabel: `${revenue.completedBookingsThisMonth ?? 0} completed`, color: 'var(--color-chart-4)' },
    { icon: Heart,        label: 'Alerts',           value: unreadNotifs, delta: 0, deltaLabel: 'Pending notifications',   color: 'var(--color-error)'    },
  ];

  const specBarData = useMemo(() =>
    (doctorStats?.bySpecialization ?? [])
      .slice(0, 6)
      .map(s => ({ name: s._id.length > 10 ? s._id.slice(0, 9) + '…' : s._id, count: s.count })),
    [doctorStats]
  );

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[color:var(--color-base-300)] border-t-[color:var(--color-primary)] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-base-200)] p-4 md:p-6 font-poppins">
      
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-8">
        <Earnings />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mt-6">
          <div>
            <span className="text-[10px] font-bold text-[color:var(--color-primary)] uppercase tracking-widest">
              Overview
            </span>
            <h1 className="text-2xl font-semibold text-[color:var(--color-base-content)] mt-1 tracking-tight">
              {hospital?.name ?? 'Hospital Dashboard'}
            </h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-medium text-[color:var(--color-base-content)] opacity-70">
              {hospital?.address?.city && (
                <span className="flex items-center gap-1.5"><MapPin size={14} />{hospital.address.city}, {hospital.address.state}</span>
              )}
              {hospital?.contact?.phone && (
                <span className="flex items-center gap-1.5"><Phone size={14} />{hospital.contact.phone}</span>
              )}
              {hospital?.isVerified ? (
                <span className="flex items-center gap-1 text-[color:var(--color-success)]"><ShieldCheck size={14} /> Verified</span>
              ) : (
                <span className="flex items-center gap-1 text-[color:var(--color-warning)]"><AlertCircle size={14} /> Pending Verification</span>
              )}
            </div>
          </div>

          <button
            onClick={() => { dispatch(fetchDashboard()); dispatch(fetchDoctorStats()); dispatch(fetchNotifications({ limit: 10 })); }}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[color:var(--color-base-100)] border border-[color:var(--color-base-300)] text-[color:var(--color-base-content)] hover:bg-[color:var(--color-base-200)] transition-colors shadow-sm"
          >
            <RefreshCw size={14} /> Refresh Data
          </button>
        </div>
      </motion.div>

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {stats.map((s, i) => <StatCard key={s.label} {...s} delay={i} />)}
      </div>

      {/* ── Charts Row 1 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        
        {/* Specialization Bar Chart */}
        <motion.div variants={fadeIn} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="xl:col-span-2 rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm">
          <SectionHeader title="Doctors by Specialization" subtitle="Distribution of linked medical staff" />
          {specBarData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-[color:var(--color-base-content)] opacity-40">
              No specialization data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={specBarData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--color-base-content)', opacity: 0.5, fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--color-base-content)', opacity: 0.5, fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-base-200)' }} />
                <Bar dataKey="count" name="Doctors" radius={[4, 4, 0, 0]}>
                  {specBarData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Top Specialties Radial */}
        <motion.div variants={fadeIn} custom={2} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm">
          <SectionHeader title="Top Specialties" subtitle="Proportional breakdown" />
          {specialtyData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-[color:var(--color-base-content)] opacity-40">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <RadialBarChart innerRadius="40%" outerRadius="100%" data={specialtyData} startAngle={180} endAngle={-180}>
                  <RadialBar minAngle={15} dataKey="value" cornerRadius={4} background={{ fill: 'var(--color-base-200)' }} />
                  <Tooltip content={<CustomTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-4">
                {specialtyData.map(s => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.fill }} />
                      <span className="text-[color:var(--color-base-content)] opacity-70 font-medium">
                        {s.name.length > 16 ? s.name.slice(0, 15) + '…' : s.name}
                      </span>
                    </div>
                    <span className="font-semibold text-[color:var(--color-base-content)]">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Row 2: Bookings & Activity ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        
        {/* Recent Bookings */}
        <motion.div variants={fadeIn} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="xl:col-span-2 rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm">
          <SectionHeader title="Recent Bookings" subtitle={`${bookings.total ?? 0} total · ${bookings.totalConsultations ?? 0} consultations`} />
          
          {(bookings.recent ?? []).length === 0 ? (
            <div className="flex items-center justify-center h-48 text-xs text-[color:var(--color-base-content)] opacity-40">
              No recent bookings
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {bookings.recent.map((b) => {
                const statusColor =
                  b.status === 'completed' ? 'var(--color-success)' :
                  b.status === 'cancelled' ? 'var(--color-error)'   :
                  'var(--color-warning)';
                  
                return (
                  <div key={b._id} className="flex items-center justify-between p-3 rounded-lg hover:bg-[color:var(--color-base-200)] transition-colors border border-transparent hover:border-[color:var(--color-base-300)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-md flex items-center justify-center bg-[color:var(--color-base-200)] border border-[color:var(--color-base-300)] shrink-0">
                        <ClipboardList size={16} className="text-[color:var(--color-primary)]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[color:var(--color-base-content)] truncate">
                          {b.bookingCode} <span className="opacity-40 mx-1">|</span> {b.patientInfo?.name ?? 'Patient'}
                        </p>
                        <p className="text-[11px] font-medium text-[color:var(--color-base-content)] opacity-50 mt-0.5 truncate">
                          {b.bookingType?.replace(/_/g, ' ')} {b.doctorSnapshot?.name ? `· Dr. ${b.doctorSnapshot.name}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-semibold text-[color:var(--color-base-content)] tracking-tight">
                        ₹{b.fareBreakdown?.totalAmount ?? 0}
                      </p>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium capitalize"
                        style={{ color: statusColor, background: `color-mix(in oklch, ${statusColor} 10%, transparent)` }}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent Activity Feed */}
        <motion.div variants={fadeIn} custom={2} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm">
          <SectionHeader title="Recent Activity" subtitle="System & notification logs" />
          
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-40">
              <BellRing size={24} />
              <p className="text-xs font-medium">No recent activity</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 mt-2">
              {recentActivity.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.id} className={`flex items-start gap-3 ${!item.isRead ? 'opacity-100' : 'opacity-60'}`}>
                    <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center border border-[color:var(--color-base-300)]"
                      style={{ background: `color-mix(in oklch, ${item.color} 10%, transparent)` }}>
                      <Icon size={14} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-xs font-medium text-[color:var(--color-base-content)] leading-relaxed truncate">
                        {item.action}
                      </p>
                      <p className="text-[10px] font-medium text-[color:var(--color-base-content)] opacity-50 mt-1">
                        {timeAgo(item.time)}
                      </p>
                    </div>
                    {!item.isRead && (
                      <span className="w-2 h-2 rounded-full shrink-0 mt-1.5 bg-[color:var(--color-primary)]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Revenue & Platform Fee ───────────────────────────────────────── */}
      <motion.div variants={fadeIn} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-6 shadow-sm">
        <SectionHeader title="Revenue & Platform Fee" subtitle="Current billing cycle · Completed bookings only" />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-2">
          <PricingCard label="Total Gross Revenue" fee={revenue.thisMonth ?? 0}              subLabel="Before deductions"           icon={DollarSign} color="var(--color-chart-1)" />
          <PricingCard label="Hospital Share"      fee={revenue.hospitalShareThisMonth ?? 0} subLabel="Post doctor honorarium"    icon={Wallet}      color="var(--color-chart-2)" />
          <PricingCard label="Platform Fee Paid"   fee={revenue.platformFeeThisMonth ?? 0}   subLabel="Deducted at settlement"      icon={Receipt}     color="var(--color-chart-3)" />
          
          <div className="rounded-xl p-5 border border-[color:var(--color-base-300)] bg-[color:var(--color-base-200)] shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-[color:var(--color-base-100)] border border-[color:var(--color-base-300)]">
                <Percent size={16} className="text-[color:var(--color-chart-4)]" />
              </div>
              <span className="text-xs font-medium text-[color:var(--color-base-content)] opacity-60">
                Platform Fee Rate
              </span>
            </div>
            <p className="text-xl font-semibold text-[color:var(--color-base-content)] font-poppins tracking-tight">
              {dashPlatformFee
                ? dashPlatformFee.type === 'percentage' ? `${dashPlatformFee.value}%` : `₹${dashPlatformFee.value}`
                : '—'}
            </p>
            <p className="mt-1 text-[11px] font-medium text-[color:var(--color-base-content)] opacity-40">
              Admin configured · {hospital?.settlementCycle ?? 'Monthly'} settlement
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}