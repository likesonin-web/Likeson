'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useInView } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Users, Stethoscope, Wifi, ShieldCheck, BadgeCheck,
  AlertCircle, Clock, ChevronRight, Activity, Star,
  BellRing, MapPin, Phone, Zap, ArrowUpRight, ArrowDownRight,
  CalendarDays, DollarSign, Heart, RefreshCw,
  TrendingUp, Wallet, Receipt, Percent, ClipboardList,
} from 'lucide-react';
import Earnings from '@/app/(partner)/earnings/myEarnings'

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

// ─── Poppins injected globally ────────────────────────────────────────────────
// Add to your global CSS instead if preferred:
// @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
if (typeof document !== 'undefined' && !document.getElementById('poppins-font')) {
  const link = document.createElement('link');
  link.id   = 'poppins-font';
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap';
  document.head.appendChild(link);
}

const POPPINS = { fontFamily: "'Poppins', sans-serif" };

// ─── Notification type → icon/color map ──────────────────────────────────────
const NOTIF_META = {
  Account_Status: { icon: AlertCircle,  color: 'var(--color-warning)' },
  Payment:        { icon: DollarSign,   color: 'var(--color-success)' },
  Booking:        { icon: CalendarDays, color: 'var(--color-info)'    },
  Security:       { icon: ShieldCheck,  color: 'var(--color-error)'   },
  General:        { icon: BellRing,     color: 'var(--color-primary)' },
};
const notifMeta = (type) => NOTIF_META[type] || { icon: BellRing, color: 'var(--color-primary)' };

// ─── Chart color palette ──────────────────────────────────────────────────────
const CHART_COLORS = [
  'var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)',
  'var(--color-chart-4)', 'var(--color-chart-5)',
];

// ─── Animations ───────────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-3 shadow-xl"
      style={{ ...POPPINS, fontSize: 11 }}>
      <p className="font-bold text-[color:var(--color-base-content)] mb-1.5">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>{p.name}:</span>
          <span className="font-semibold text-[color:var(--color-base-content)]">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Section Header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, subtitle, action, actionLabel }) => (
  <div className="flex items-end justify-between mb-4">
    <div>
      <h2 className="font-bold text-[color:var(--color-base-content)]"
        style={{ ...POPPINS, fontSize: 14 }}>{title}</h2>
      {subtitle && (
        <p style={{ ...POPPINS, fontSize: 11, color: 'color-mix(in oklch, var(--color-base-content) 50%, transparent)' }}
          className="mt-0.5">{subtitle}</p>
      )}
    </div>
    {action && (
      <button onClick={action}
        className="flex items-center gap-1 font-semibold text-[color:var(--color-primary)] hover:gap-2 transition-all"
        style={{ ...POPPINS, fontSize: 11 }}>
        {actionLabel} <ChevronRight size={12} />
      </button>
    )}
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, delta, deltaLabel, color, delay }) => {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const isPos  = delta >= 0;

  return (
    <motion.div
      ref={ref} custom={delay} variants={fadeUp}
      initial="hidden" animate={inView ? 'visible' : 'hidden'}
      className="relative overflow-hidden rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-4 shadow-sm group"
      whileHover={{ y: -3, boxShadow: '0 16px 32px -8px rgba(0,0,0,0.10)' }}
    >
      {/* Blob */}
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-10 blur-2xl transition-all duration-500 group-hover:opacity-20"
        style={{ background: color }} />

      <div className="relative flex items-start justify-between">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ background: `color-mix(in oklch, ${color} 15%, transparent)` }}>
          <Icon size={17} style={{ color }} />
        </div>
        <span className={`flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded-full ${
          isPos
            ? 'bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]'
            : 'bg-[color:var(--color-error)]/10 text-[color:var(--color-error)]'
        }`} style={{ fontSize: 10 }}>
          {isPos ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {Math.abs(delta)}%
        </span>
      </div>

      <div className="mt-3">
        <p style={{ ...POPPINS, fontSize: 11, color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
          {label}
        </p>
        <p className="mt-0.5 font-black text-[color:var(--color-base-content)]"
          style={{ ...POPPINS, fontSize: 22 }}>
          {value ?? '—'}
        </p>
        <p className="mt-0.5" style={{ ...POPPINS, fontSize: 10, color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }}>
          {deltaLabel}
        </p>
      </div>

      {/* Bottom accent */}
      <div className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-full"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </motion.div>
  );
};

// ─── Pricing Card ────────────────────────────────────────────────────────────
// FIX: hardcoded "Honorarium:" made this unusable for revenue/platform-fee data.
// Now takes a generic subLabel.
const PricingCard = ({ label, fee, subLabel, icon: PIcon, color }) => (
  <div className="rounded-xl p-4 border border-[color:var(--color-base-300)] bg-[color:var(--color-base-200)] hover:border-current transition-colors duration-200">
    <div className="flex items-center gap-2 mb-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: `color-mix(in oklch, ${color} 15%, transparent)` }}>
        <PIcon size={13} style={{ color }} />
      </div>
      <span className="font-semibold" style={{ ...POPPINS, fontSize: 11, color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)' }}>
        {label}
      </span>
    </div>
    <p className="font-black text-[color:var(--color-base-content)]" style={{ ...POPPINS, fontSize: 20 }}>
      ₹{fee ?? 0}
    </p>
    <p style={{ ...POPPINS, fontSize: 10, color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }} className="mt-1">
      {subLabel ?? '—'}
    </p>
  </div>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
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
    // Fetch recent notifications for activity feed (latest 10, unread-first)
    dispatch(fetchNotifications({ limit: 10, page: 1 }));
  }, [dispatch]);

const hospital = dashboard?.hospital;
  const doctors  = dashboard?.doctors  ?? {};
  // FIX: dashboard.pricing never existed on the API — /dashboard has never returned
  // per-consultation-type fees. Every cp?.xFee reference below rendered against a
  // field that doesn't exist. Real fee data lives on fetchDoctorPricing (per-doctor).
  // Dashboard now sources real fields: bookings, revenue, platformFee.

  // ── Specialty radial data from real doctorStats ───────────────────────────
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

 

  // ── Recent activity from real notifications ───────────────────────────────
  const recentActivity = useMemo(() =>
    (notifications ?? []).slice(0, 6).map(n => {
      const meta = notifMeta(n.type);
      return {
        id:     n._id,
        action: n.title ?? n.body,
        body:   n.body,
        time:   n.createdAt,
        icon:   meta.icon,
        color:  meta.color,
        isRead: n.isRead,
      };
    }),
    [notifications]
  );

  // ── timeAgo helper ────────────────────────────────────────────────────────
  const timeAgo = (iso) => {
    if (!iso) return '';
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // ── KPI stat cards ────────────────────────────────────────────────────────
  const totalDoctors   = doctorStats?.total    ?? doctors.total    ?? 0;
  const verifiedDocs   = doctorStats?.verified ?? doctors.verified ?? 0;
  const onlineDocs     = doctorStats?.online   ?? doctors.online   ?? 0;
  const unreadNotifs   = dashboard?.unreadNotifications ?? 0;

const stats = [
    { icon: Users,        label: 'Total Doctors',    value: totalDoctors, delta: 0, deltaLabel: 'linked to hospital',      color: 'var(--color-primary)'  },
    { icon: BadgeCheck,   label: 'Verified Doctors',  value: verifiedDocs, delta: 0, deltaLabel: 'KYC approved',            color: 'var(--color-success)'  },
    { icon: Wifi,         label: 'Doctors Online',    value: onlineDocs,   delta: 0, deltaLabel: 'currently active',        color: 'var(--color-accent)'   },
    { icon: CalendarDays, label: "Today's Bookings",  value: bookings.today ?? 0, delta: 0, deltaLabel: `${bookings.pending ?? 0} pending`, color: 'var(--color-warning)' },
    { icon: TrendingUp,   label: 'Revenue (Month)',   value: `₹${revenue.thisMonth ?? 0}`, delta: 0, deltaLabel: `${revenue.completedBookingsThisMonth ?? 0} completed`, color: 'var(--color-chart-4)' },
    { icon: Heart,        label: 'Unread Alerts',     value: unreadNotifs, delta: 0, deltaLabel: 'pending notifications',   color: 'var(--color-error)'    },
  ];

  // ── Specialty bar data for BarChart (cleaner than radial for small counts) -
  const specBarData = useMemo(() =>
    (doctorStats?.bySpecialization ?? [])
      .slice(0, 6)
      .map(s => ({ name: s._id.length > 10 ? s._id.slice(0, 9) + '…' : s._id, count: s.count })),
    [doctorStats]
  );

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-96">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2 border-[color:var(--color-base-300)] border-t-[color:var(--color-primary)]"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--color-base-200)]  p-3" style={POPPINS}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-6">
        <Earnings />
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <span style={{ ...POPPINS, fontSize: 10, color: 'var(--color-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Dashboard
            </span>
            <h1 className="font-black text-[color:var(--color-base-content)] leading-tight mt-0.5"
              style={{ ...POPPINS, fontSize: 22 }}>
              {hospital?.name ?? 'Hospital Overview'}
            </h1>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {hospital?.address?.city && (
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                  <MapPin size={11} />{hospital.address.city}, {hospital.address.state}
                </span>
              )}
              {hospital?.contact?.phone && (
                <span className="flex items-center gap-1" style={{ fontSize: 11, color: 'color-mix(in oklch, var(--color-base-content) 55%, transparent)' }}>
                  <Phone size={11} />{hospital.contact.phone}
                </span>
              )}
              {hospital?.isVerified
                ? <span className="flex items-center gap-1 font-bold text-[color:var(--color-success)] bg-[color:var(--color-success)]/10 px-2 py-0.5 rounded-full" style={{ fontSize: 10 }}>
                    <ShieldCheck size={10} /> Verified
                  </span>
                : <span className="flex items-center gap-1 font-bold text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/10 px-2 py-0.5 rounded-full" style={{ fontSize: 10 }}>
                    <AlertCircle size={10} /> Pending Verification
                  </span>
              }
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => { dispatch(fetchDashboard()); dispatch(fetchDoctorStats()); dispatch(fetchNotifications({ limit: 10 })); }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[color:var(--color-primary)] text-[color:var(--color-primary-content)] font-semibold shadow-lg shadow-[color:var(--color-primary)]/20"
            style={{ fontSize: 12 }}>
            <RefreshCw size={13} /> Refresh
          </motion.button>
        </div>
      </motion.div>

      {/* ── Stat Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {stats.map((s, i) => <StatCard key={s.label} {...s} delay={i} />)}
      </div>

      {/* ── Charts Row 1: Spec bar + Specialty radial ─────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">

        {/* Specialization bar — real data from doctorStats */}
        <motion.div variants={fadeUp} custom={2} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="xl:col-span-2 rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-5 shadow-sm">
          <SectionHeader title="Doctors by Specialization" subtitle="From linked doctor profiles" />
          {specBarData.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-[color:var(--color-base-content)]/30" style={{ fontSize: 12 }}>
              No specialization data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={specBarData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--color-base-content)', opacity: 0.45, fontSize: 10, fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--color-base-content)', opacity: 0.45, fontSize: 10, fontFamily: 'Poppins' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Doctors" radius={[6, 6, 0, 0]}>
                  {specBarData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Specialty radial */}
        <motion.div variants={fadeUp} custom={3} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-5 shadow-sm">
          <SectionHeader title="Top Specialties" subtitle="By doctor count" />
          {specialtyData.length === 0 ? (
            <div className="flex items-center justify-center h-36 text-[color:var(--color-base-content)]/30" style={{ fontSize: 11 }}>No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <RadialBarChart innerRadius="30%" outerRadius="88%" data={specialtyData} startAngle={180} endAngle={-180}>
                  <RadialBar minAngle={15} dataKey="value" cornerRadius={5} background={{ fill: 'var(--color-base-200)' }} />
                  <Tooltip content={<CustomTooltip />} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {specialtyData.map(s => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                      <span style={{ ...POPPINS, fontSize: 11, color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)' }}>
                        {s.name.length > 14 ? s.name.slice(0, 13) + '…' : s.name}
                      </span>
                    </div>
                    <span className="font-bold text-[color:var(--color-base-content)]" style={{ fontSize: 11 }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Row 2: Doctor capacity + Recent activity ──────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-5">

       {/* Recent bookings — real data from Booking collection via dashboard.bookings.recent */}
        <motion.div variants={fadeUp} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="xl:col-span-2 rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-5 shadow-sm">
          <SectionHeader
            title="Recent Bookings"
            subtitle={`${bookings.total ?? 0} total · ${bookings.totalConsultations ?? 0} consultations recorded`}
          />
          {(bookings.recent ?? []).length === 0 ? (
            <div className="flex items-center justify-center h-44 text-[color:var(--color-base-content)]/30" style={{ fontSize: 12 }}>
              No bookings yet
            </div>
          ) : (
            <div className="space-y-2">
              {bookings.recent.map((b, i) => {
                const statusColor =
                  b.status === 'completed' ? 'var(--color-success)' :
                  b.status === 'cancelled' ? 'var(--color-error)'   :
                  'var(--color-warning)';
                return (
                  <motion.div key={b._id}
                    initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between rounded-lg p-2.5 border border-[color:var(--color-base-300)] bg-[color:var(--color-base-200)]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in oklch, var(--color-primary) 15%, transparent)' }}>
                        <ClipboardList size={13} style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-[color:var(--color-base-content)] truncate" style={{ ...POPPINS, fontSize: 11 }}>
                          {b.bookingCode} · {b.patientInfo?.name ?? 'Patient'}
                        </p>
                        <p style={{ ...POPPINS, fontSize: 10, color: 'color-mix(in oklch, var(--color-base-content) 45%, transparent)' }} className="truncate">
                          {b.bookingType?.replace(/_/g, ' ')} {b.doctorSnapshot?.name ? `· Dr. ${b.doctorSnapshot.name}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-bold text-[color:var(--color-base-content)]" style={{ ...POPPINS, fontSize: 12 }}>
                        ₹{b.fareBreakdown?.totalAmount ?? 0}
                      </p>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded-full font-semibold"
                        style={{ fontSize: 9, color: statusColor, background: `color-mix(in oklch, ${statusColor} 12%, transparent)` }}>
                        {b.status}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Recent activity — from real notifications */}
        <motion.div variants={fadeUp} custom={2} initial="hidden" whileInView="visible" viewport={{ once: true }}
          className="rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-5 shadow-sm">
          <SectionHeader title="Recent Activity" subtitle="From notifications" />
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-36 gap-2">
              <BellRing size={20} style={{ color: 'color-mix(in oklch, var(--color-base-content) 25%, transparent)' }} />
              <p style={{ ...POPPINS, fontSize: 11, color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }}>
                No recent activity
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentActivity.map((item, i) => {
                const Icon = item.icon;
                return (
                  <motion.div key={item.id}
                    initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.04 }}
                    className={`flex items-start gap-2.5 ${!item.isRead ? 'opacity-100' : 'opacity-70'}`}>
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
                      style={{ background: `color-mix(in oklch, ${item.color} 15%, transparent)` }}>
                      <Icon size={12} style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[color:var(--color-base-content)] leading-snug truncate"
                        style={{ ...POPPINS, fontSize: 11 }}>{item.action}</p>
                      <p style={{ ...POPPINS, fontSize: 10, color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }} className="mt-0.5">
                        {timeAgo(item.time)}
                      </p>
                    </div>
                    {!item.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: 'var(--color-primary)' }} />
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

{/* ── Revenue & Platform Fee ───────────────────────────────────────── */}
      <motion.div variants={fadeUp} custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }}
        className="rounded-xl border border-[color:var(--color-base-300)] bg-[color:var(--color-base-100)] p-5 shadow-sm">
        <SectionHeader title="Revenue & Platform Fee" subtitle="This month · from completed bookings" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PricingCard label="Total Revenue"     fee={revenue.thisMonth ?? 0}              subLabel="gross, completed bookings" icon={DollarSign} color="var(--color-chart-1)" />
          <PricingCard label="Hospital Share"    fee={revenue.hospitalShareThisMonth ?? 0} subLabel="after doctor honorarium"   icon={Wallet}      color="var(--color-chart-2)" />
          <PricingCard label="Platform Fee Paid" fee={revenue.platformFeeThisMonth ?? 0}   subLabel="deducted at settlement"    icon={Receipt}     color="var(--color-chart-3)" />
          <div className="rounded-xl p-4 border border-[color:var(--color-base-300)] bg-[color:var(--color-base-200)]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in oklch, var(--color-chart-4) 15%, transparent)' }}>
                <Percent size={13} style={{ color: 'var(--color-chart-4)' }} />
              </div>
              <span className="font-semibold" style={{ ...POPPINS, fontSize: 11, color: 'color-mix(in oklch, var(--color-base-content) 60%, transparent)' }}>
                Platform Fee Rate
              </span>
            </div>
            <p className="font-black text-[color:var(--color-base-content)]" style={{ ...POPPINS, fontSize: 20 }}>
              {dashPlatformFee
                ? dashPlatformFee.type === 'percentage' ? `${dashPlatformFee.value}%` : `₹${dashPlatformFee.value}`
                : '—'}
            </p>
            <p style={{ ...POPPINS, fontSize: 10, color: 'color-mix(in oklch, var(--color-base-content) 40%, transparent)' }} className="mt-1">
              Set by Likeson admin · {hospital?.settlementCycle ?? 'monthly'} settlement
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}