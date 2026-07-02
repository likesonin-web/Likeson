'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, Activity, Users, DollarSign,
  Video, Home, Stethoscope, BarChart2,
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  fetchDoctorStats,
  selectMyDoctorProfile,
  selectDoctorStats,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

/* ─── animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: 'easeOut' },
  }),
};

/* ─── custom tooltip ─── */
const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-sm shadow-2xl border"
      style={{
        background: 'var(--base-200)',
        borderColor: 'color-mix(in srgb, var(--primary), transparent 65%)',
        color: 'var(--base-content)',
      }}
    >
      {label && <p className="text-xs mb-1" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-bold" style={{ color: p.color || p.fill || 'var(--primary)' }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{suffix}
        </p>
      ))}
    </div>
  );
};

/* ─── synthetic monthly data ─── */
const buildMonthlyData = (stats) => {
  const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const total = stats?.totalConsultations || 0;
  const earn = stats?.totalEarnings || 0;
  return months.map((m) => ({
    month: m,
    consultations: Math.round((total / 8) * (0.6 + Math.random() * 0.8)),
    earnings: Math.round((earn / 8) * (0.6 + Math.random() * 0.8)),
    referrals: Math.round(((stats?.totalReferrals || 0) / 8) * (0.5 + Math.random())),
  }));
};

/* ─── KPI chip ─── */
const StatChip = ({ icon: Icon, label, value, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className="flex items-center gap-3 p-4 rounded-xl border"
    style={{
      background: 'var(--base-200)',
      borderColor: 'color-mix(in srgb, var(--base-content), transparent 88%)',
    }}
  >
    <div
      className="p-2 rounded-lg flex-shrink-0"
      style={{ background: 'color-mix(in srgb, var(--primary), transparent 82%)', color: 'var(--primary)' }}
    >
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-lg font-black font-mono truncate" style={{ color: 'var(--base-content)' }}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide truncate"
        style={{ color: 'color-mix(in oklch, var(--base-content) 48%, transparent)' }}>
        {label}
      </p>
    </div>
  </motion.div>
);

/* ─── tab button ─── */
const TabBtn = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
    style={
      active
        ? { background: 'var(--primary)', color: 'var(--primary-content)' }
        : { background: 'transparent', color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }
    }
  >
    {children}
  </button>
);

/* ─── section card ─── */
const SectionCard = ({ children, delay, className = '' }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className={`p-5 rounded-2xl border ${className}`}
    style={{
      background: 'var(--base-200)',
      borderColor: 'color-mix(in srgb, var(--base-content), transparent 88%)',
    }}
  >
    {children}
  </motion.div>
);

const SectionTitle = ({ children }) => (
  <h2 className="text-xs font-bold uppercase tracking-widest mb-4"
    style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
    {children}
  </h2>
);

/* ─── main page ─── */
export default function Analytics() {
  const dispatch = useDispatch();
  const profile = useSelector(selectMyDoctorProfile);
  const stats = useSelector(selectDoctorStats);
  const loading = useSelector(selectHospitalLoading);
  const [tab, setTab] = useState('earnings');

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  useEffect(() => {
    if (profile?._id) dispatch(fetchDoctorStats(profile._id));
  }, [dispatch, profile?._id]);

// Legacy denormalized cache — used only where no live equivalent exists below
  const s = stats?.profile?.stats || {};
  const live = stats?.liveStats || {};
  const isLoading = loading.fetchMyDoctorProfile || loading.fetchDoctorStats;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const monthlyData = useMemo(() => buildMonthlyData(s), [s.totalConsultations, s.totalEarnings]);

// NOTE: no live per-type (video/homeVisit/inPerson) breakdown from backend
  // yet — liveStats.consultations only has byStatus. Falls back to legacy cache.
  const consultTypeData = [
    { name: 'In-Person', value: (s.totalConsultations || 0) - (s.totalVideoConsultations || 0) - (s.totalHomeVisits || 0) },
    { name: 'Video', value: s.totalVideoConsultations || 0 },
    { name: 'Home Visit', value: s.totalHomeVisits || 0 },
  ].filter((d) => d.value > 0);

  // CSS-var-driven colors for charts — injected inline so Recharts can consume them
  const C = {
    primary:   'var(--primary)',
    secondary: 'var(--secondary)',
    accent:    'var(--accent)',
    success:   'var(--success)',
    warning:   'var(--warning)',
    error:     'var(--error)',
  };

  // Pie slice colours from theme
  const pieColors = [C.primary, C.secondary, C.accent];

  const settlementData = [
    { name: 'Settled', value: s.totalSettled || 0, fill: C.success },
    { name: 'Pending', value: s.pendingSettlement || 0, fill: C.warning },
  ];

const chips = [
    { icon: Stethoscope, label: 'Consultations', value: live.consultations?.total ?? s.totalConsultations ?? 0,       delay: 1 },
    { icon: Video,       label: 'Bookings',      value: live.bookings?.total ?? 0,                                    delay: 2 },
    { icon: Home,        label: 'OP Records',    value: live.outPatientRecords?.total ?? 0,                           delay: 3 },
    { icon: Users,       label: 'Referrals',     value: s.totalReferrals || 0,                                        delay: 4 },
    { icon: DollarSign,  label: 'Doctor Share',  value: `₹${(live.earnings?.totalDoctorShare ?? 0).toLocaleString('en-IN')}`, delay: 5 },
    { icon: TrendingUp,  label: 'Collected',     value: `₹${(live.earnings?.totalCollected ?? 0).toLocaleString('en-IN')}`,   delay: 6 },
  ];

  const axisStyle = { fill: 'color-mix(in oklch, var(--base-content) 40%, transparent)', fontSize: 11 };
  const gridStyle = 'color-mix(in srgb, var(--base-content), transparent 90%)';

  return (
    <div className="min-h-screen font-[family-name:var(--font-family-poppins)]"
      style={{ background: 'var(--base-100)', color: 'var(--base-content)' }}>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl" style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}>
              <BarChart2 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--base-content)' }}>
              Analytics
            </h1>
          </div>
          <p className="text-sm ml-[3.25rem]"
            style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            Consultation &amp; earnings overview
          </p>
        </motion.div>

        {/* ── KPI chips ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {isLoading
            ? Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-20 rounded-xl animate-pulse"
                  style={{ background: 'var(--base-300)' }} />
              ))
            : chips.map((c) => <StatChip key={c.label} {...c} />)
          }
        </div>

        {/* ── Main row: trend + pie ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">

          {/* Trend area chart */}
          <SectionCard delay={7} className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Monthly Trend</SectionTitle>
              <div className="flex gap-1 p-1 rounded-lg"
                style={{ background: 'var(--base-300)' }}>
                {['earnings', 'consultations', 'referrals'].map((t) => (
                  <TabBtn key={t} active={tab === t} onClick={() => setTab(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </TabBtn>
                ))}
              </div>
            </div>

            {isLoading
              ? <div className="h-52 rounded-xl animate-pulse" style={{ background: 'var(--base-300)' }} />
              : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthlyData} margin={{ top: 5, right: 4, left: -22, bottom: 0 }}>
                    <defs>
                      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="var(--primary)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                    <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip prefix={tab === 'earnings' ? '₹' : ''} />} />
                    <Area
                      type="monotone" dataKey={tab}
                      stroke="var(--primary)" strokeWidth={2}
                      fill="url(#areaGrad)"
                      dot={{ fill: 'var(--primary)', strokeWidth: 0, r: 3 }}
                      activeDot={{ r: 5, fill: 'var(--primary)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )
            }
          </SectionCard>

          {/* Consultation type pie */}
          <SectionCard delay={8}>
            <SectionTitle>Consultation Types</SectionTitle>
            {isLoading
              ? <div className="h-52 rounded-xl animate-pulse" style={{ background: 'var(--base-300)' }} />
              : consultTypeData.length > 0
                ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={consultTypeData} cx="50%" cy="50%"
                          innerRadius={44} outerRadius={70}
                          dataKey="value" stroke="none"
                          paddingAngle={3}
                        >
                          {consultTypeData.map((_, i) => (
                            <Cell key={i} fill={pieColors[i % pieColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-3">
                      {consultTypeData.map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full"
                              style={{ background: pieColors[i % pieColors.length] }} />
                            <span className="text-xs"
                              style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                              {d.name}
                            </span>
                          </div>
                          <span className="text-xs font-bold" style={{ color: 'var(--base-content)' }}>
                            {d.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )
                : (
                  <div className="h-40 flex items-center justify-center text-sm"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 35%, transparent)' }}>
                    No data yet
                  </div>
                )
            }
          </SectionCard>
        </div>

        {/* ── Bottom row: bar + settlement ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Monthly referrals bar */}
          <SectionCard delay={9}>
            <SectionTitle>Monthly Referrals</SectionTitle>
            {isLoading
              ? <div className="h-40 rounded-xl animate-pulse" style={{ background: 'var(--base-300)' }} />
              : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -26, bottom: 0 }} barSize={13}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStyle} />
                    <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="referrals" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )
            }
          </SectionCard>

          {/* Settlement breakdown */}
          <SectionCard delay={10}>
            <SectionTitle>Settlement Breakdown</SectionTitle>
            {isLoading
              ? <div className="h-40 rounded-xl animate-pulse" style={{ background: 'var(--base-300)' }} />
              : (
                <div className="flex items-center gap-5">
                  <ResponsiveContainer width={130} height={130}>
                    <RadialBarChart
                      innerRadius={32} outerRadius={62}
                      data={settlementData}
                      startAngle={90} endAngle={-270}
                    >
                      <RadialBar dataKey="value" cornerRadius={5} />
                      <Tooltip content={<CustomTooltip prefix="₹" />} />
                    </RadialBarChart>
                  </ResponsiveContainer>

                  <div className="flex-1 space-y-4">
                    {settlementData.map((d) => {
                      const pct = Math.round((d.value / Math.max(1, s.totalEarnings || 1)) * 100);
                      return (
                        <div key={d.name}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                              <span className="text-xs font-medium"
                                style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                                {d.name}
                              </span>
                            </div>
                            <span className="text-xs font-bold" style={{ color: 'var(--base-content)' }}>
                              ₹{d.value.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: 'var(--base-300)' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.4 }}
                              className="h-full rounded-full"
                              style={{ background: d.fill }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-3 border-t"
                      style={{ borderColor: 'color-mix(in srgb, var(--base-content), transparent 88%)' }}>
                      <p className="text-[11px] uppercase tracking-wider font-semibold mb-0.5"
                        style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                        Total Earnings
                      </p>
                      <p className="text-base font-black" style={{ color: 'var(--primary)' }}>
                        ₹{(s.totalEarnings || 0).toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>
              )
            }
          </SectionCard>
        </div>

      </div>
    </div>
  );
}