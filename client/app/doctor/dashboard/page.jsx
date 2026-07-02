'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Activity, Users, Calendar, TrendingUp, Star, Clock,
  CheckCircle, AlertCircle, Wallet, Stethoscope, ArrowUpRight,
  Building2, Video, Home, UserCheck
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  fetchDoctorStats,
  selectMyDoctorProfile,
  selectDoctorStats,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

// ─── Animation variants ────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
};

const pulse = {
  animate: {
    scale: [1, 1.04, 1],
    transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
  },
};

// ─── StatusBadge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Active:    { cls: 'bg-success/10 border border-success/30 text-success',    dot: 'bg-success'   },
    Pending:   { cls: 'bg-warning/10 border border-warning/30 text-warning',    dot: 'bg-warning'   },
    Inactive:  { cls: 'bg-base-300/60 border border-base-300 text-base-content/50', dot: 'bg-base-content/30' },
    Suspended: { cls: 'bg-error/10 border border-error/30 text-error',          dot: 'bg-error'     },
  };
  const cfg = map[status] || map.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
      {status ?? 'Pending'}
    </span>
  );
};

// ─── KpiCard ──────────────────────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, sub, colorClass, iconBg, delay, trend }) => (
  <motion.div
    variants={fadeUp}
    custom={delay}
    initial="hidden"
    animate="show"
    className="relative overflow-hidden rounded-2xl border border-base-300/60 bg-base-200 p-5 group hover:border-primary/30 transition-colors duration-300"
    style={{ boxShadow: 'var(--shadow-depth)' }}
  >
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>
          <Icon className="w-5 h-5 text-primary-content" />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs text-success font-bold">
            <ArrowUpRight className="w-3.5 h-3.5" /> {trend}
          </span>
        )}
      </div>
      <p className="text-xl font-semibold text-base-content font-poppins tracking-tight">
        {value ?? '—'}
      </p>
      <p className="text-xs text-base-content/60 mt-1 font-semibold">{label}</p>
      {sub && <p className="text-[11px] text-base-content/40 mt-0.5">{sub}</p>}
    </div>
  </motion.div>
);

// ─── QuickAction ──────────────────────────────────────────────────────────
const QuickAction = ({ icon: Icon, label, href, iconBg, delay }) => (
  <motion.a
    href={href}
    variants={fadeUp}
    custom={delay}
    initial="hidden"
    animate="show"
    whileHover={{ scale: 1.04 }}
    whileTap={{ scale: 0.96 }}
    className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-base-300/60 bg-base-100 hover:border-primary/30 hover:bg-base-200 transition-all cursor-pointer group"
  >
    <div className={`p-3 rounded-xl ${iconBg} group-hover:brightness-110 transition-all`}>
      <Icon className="w-5 h-5 text-primary-content" />
    </div>
    <span className="text-[11px] text-base-content/60 font-semibold text-center leading-tight">
      {label}
    </span>
  </motion.a>
);

// ─── Main Component ───────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const dispatch = useDispatch();

  // Real selectors from hospitalSlice
  const profile = useSelector(selectMyDoctorProfile);
  const stats   = useSelector(selectDoctorStats);
  const loading = useSelector(selectHospitalLoading);

  useEffect(() => {
    dispatch(fetchMyDoctorProfile());
  }, [dispatch]);

  useEffect(() => {
    if (profile?._id) {
      dispatch(fetchDoctorStats(profile._id));
    }
  }, [dispatch, profile?._id]);

// Legacy denormalized cache — kept as fallback only, usually stale/zero
  const s = stats?.profile?.stats ?? {};
  // Live computed numbers — source of truth now
  const live = stats?.liveStats ?? {};
  const recent = stats?.recentActivity ?? {};

  const isLoading =
    loading?.fetchMyDoctorProfile ||
    loading?.fetchDoctorStats;

// KPI cards — live-computed from Booking/OutPatientRecord/Consultation,
  // falling back to the legacy DoctorProfile.stats cache only where no
  // live equivalent exists (pendingSettlement has no live source yet).
  const kpiCards = [
    {
      icon: Stethoscope,
      label: 'Total Consultations',
      value: live.consultations?.total ?? s.totalConsultations ?? 0,
      sub: `${live.consultations?.byStatus?.scheduled ?? 0} scheduled`,
      iconBg: 'bg-primary',
      delay: 1,
    },
    {
      icon: Calendar,
      label: 'Total Bookings',
      value: live.bookings?.total ?? 0,
      sub: `${live.bookings?.byStatus?.completed ?? 0} completed`,
      iconBg: 'bg-secondary',
      delay: 2,
    },
    {
      icon: Home,
      label: 'OP Records',
      value: live.outPatientRecords?.total ?? 0,
      sub: `${live.outPatientRecords?.followUpEligibleNow ?? 0} follow-up eligible`,
      iconBg: 'bg-info',
      delay: 3,
    },
    {
      icon: CheckCircle,
      label: 'Completed Bookings',
      value: live.earnings?.completedBookings ?? 0,
      iconBg: 'bg-warning',
      delay: 4,
    },
    {
      icon: TrendingUp,
      label: 'Doctor Earnings',
      value: `₹${Number(live.earnings?.totalDoctorShare ?? 0).toLocaleString('en-IN')}`,
      sub: `₹${Number(live.earnings?.totalCollected ?? 0).toLocaleString('en-IN')} collected`,
      iconBg: 'bg-success',
      delay: 5,
    },
    {
      icon: Wallet,
      label: 'Pending Settlement',
      value: s.pendingSettlement != null
        ? `₹${Number(s.pendingSettlement).toLocaleString('en-IN')}`
        : '₹0',
      iconBg: 'bg-accent',
      delay: 6,
    },
  ];

  // Quick actions — href matches doctor routes in app
  const quickActions = [
    { icon: Calendar,  label: 'Availability', href: '/doctor/availability', iconBg: 'bg-primary',   delay: 1 },
    { icon: UserCheck, label: 'KYC Status',   href: '/doctor/kyc',          iconBg: 'bg-secondary', delay: 2 },
    { icon: Building2, label: 'My Hospitals', href: '/doctor/hospitals',    iconBg: 'bg-info',      delay: 3 },
    { icon: Wallet,    label: 'Bank Details', href: '/doctor/bank',         iconBg: 'bg-success',   delay: 4 },
    { icon: Activity,  label: 'Analytics',   href: '/doctor/analytics',    iconBg: 'bg-warning',   delay: 5 },
    { icon: Star,      label: 'Performance', href: '/doctor/performance',  iconBg: 'bg-error',     delay: 6 },
  ];

  return (
    <div
      className="min-h-screen font-poppins"
      style={{ backgroundColor: 'var(--base-100)', color: 'var(--base-content)' }}
      data-theme="doctor"
    >
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{ background: 'color-mix(in srgb, var(--primary), transparent 92%)' }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full blur-3xl"
          style={{ background: 'color-mix(in srgb, var(--secondary), transparent 94%)' }}
        />
        <div
          className="absolute top-1/2 left-0 w-64 h-64 rounded-full blur-3xl"
          style={{ background: 'color-mix(in srgb, var(--info), transparent 95%)' }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto  py-8">

        {/* ── Header ── */}
        <motion.div
          variants={fadeUp}
          custom={0}
          initial="hidden"
          animate="show"
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              {isLoading ? (
                <div className="w-16 h-16 rounded-2xl bg-base-300 animate-pulse skeleton" />
              ) : (
                <motion.div {...pulse} className="relative">
                  <img
                    src={
                      profile?.profilePhotoUrl ||
                      profile?.user?.avatar ||
                      '/placeholder-doctor.png'
                    }
                    alt="Doctor avatar"
                    className="w-16 h-16 rounded-2xl object-cover"
                    style={{ border: '2px solid color-mix(in srgb, var(--primary), transparent 60%)' }}
                  />
                  {/* Online indicator */}
                  <div
                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2"
                    style={{
                      backgroundColor: profile?.isOnline ? 'var(--success)' : 'var(--base-300)',
                      borderColor: 'var(--base-100)',
                    }}
                  />
                </motion.div>
              )}

              <div>
                {isLoading ? (
                  <div className="space-y-2">
                    <div className="h-6 w-48 bg-base-300 rounded animate-pulse skeleton" />
                    <div className="h-4 w-32 bg-base-300 rounded animate-pulse skeleton" />
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-semibold tracking-tight text-base-content">
                      Dr. {profile?.user?.name ?? 'Doctor'}
                    </h1>
                    <p className="text-sm text-base-content/60">
                      {profile?.specialization}
                      {profile?.experienceYears != null
                        ? ` · ${profile.experienceYears}y exp`
                        : ''}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Badges */}
            {!isLoading && profile && (
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={profile.partnershipStatus} />
                <span
                  className={`text-xs px-3 py-1 rounded-full border font-bold uppercase tracking-wider ${
                    profile.kycStatus === 'verified'
                      ? 'bg-success/10 border-success/30 text-success'
                      : 'bg-warning/10 border-warning/30 text-warning'
                  }`}
                >
                  KYC: {(profile.kycStatus ?? 'not-submitted').replace('-', ' ').toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Profile completion bar ── */}
        {!isLoading && profile && (
          <motion.div
            variants={fadeUp}
            custom={0.5}
            initial="hidden"
            animate="show"
            className="mb-6 p-4 rounded-2xl border border-base-300/60 bg-base-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-base-content">Profile Completion</span>
              <span className="text-sm font-semibold text-primary">
                {profile.profileCompletionPercent ?? 0}%
              </span>
            </div>
            <div className="progress-bar">
              <motion.div
                className="progress-bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${profile.profileCompletionPercent ?? 0}%` }}
                transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
              />
            </div>
            {(profile.profileCompletionPercent ?? 0) < 100 && (
              <p className="text-[11px] text-base-content/40 mt-1.5">
                Complete your profile to unlock all features
              </p>
            )}
          </motion.div>
        )}

        {/* ── KPI Grid ── */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-8">
          {isLoading
            ? Array(6).fill(0).map((_, i) => (
                <div key={i} className="h-32 rounded-2xl bg-base-200 animate-pulse skeleton" />
              ))
            : kpiCards.map((c) => <KpiCard key={c.label} {...c} />)}
        </div>

        {/* ── Quick Actions + Rating/Settlement ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Quick Actions panel */}
          <motion.div
            variants={fadeUp}
            custom={7}
            initial="hidden"
            animate="show"
            className="lg:col-span-2   rounded-2xl border border-base-300/60 bg-base-200"
          >
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-4"
              style={{ color: 'var(--base-content)', opacity: 0.5 }}
            >
              Quick Actions
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {quickActions.map((a) => <QuickAction key={a.label} {...a} />)}
            </div>
          </motion.div>

          {/* Rating + Settlement */}
          <motion.div
            variants={fadeUp}
            custom={8}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {/* Rating — from DoctorProfile.rating.averageRating */}
            <div className="p-5 rounded-2xl border border-base-300/60 bg-base-200">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-warning" />
                <span className="text-sm font-semibold text-base-content">Rating</span>
              </div>
              {isLoading ? (
                <div className="h-8 bg-base-300 rounded animate-pulse skeleton" />
              ) : (
                <>
<p className="text-3xl font-semibold font-poppins text-warning">
                    {stats?.profile?.rating?.averageRating != null
                      ? Number(stats.profile.rating.averageRating).toFixed(1)
                      : '—'}
                  </p>
                  <p className="text-xs text-base-content/40 mt-1">
                    {stats?.profile?.rating?.totalRatings ?? 0} ratings
                  </p>
                </>
              )}
            </div>

            {/* Settlement — from DoctorProfile.settlementCycle + stats.totalSettled */}
            <div className="p-5 rounded-2xl border border-base-300/60 bg-base-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-info" />
                <span className="text-sm font-semibold text-base-content">Settlement</span>
              </div>
              {isLoading ? (
                <div className="h-8 bg-base-300 rounded animate-pulse skeleton" />
              ) : (
                <>
                  <p className="text-lg font-semibold capitalize text-info">
                    {profile?.settlementCycle ?? 'monthly'}
                  </p>
                  <p className="text-xs text-base-content/40 mt-1">
                    ₹{Number(s.totalSettled ?? 0).toLocaleString('en-IN')} total settled
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </div>

    {/* ── Recent Activity ── */}
        {!isLoading && (recent.recentBookings?.length > 0 || recent.recentConsultations?.length > 0) && (
          <motion.div
            variants={fadeUp}
            custom={8.5}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
          >
            <div className="rounded-2xl border border-base-300/60 bg-base-200 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 text-base-content/50">
                Recent Bookings
              </h2>
              <div className="space-y-3">
                {(recent.recentBookings ?? []).map((b) => (
                  <div key={b._id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-base-content">{b.patientInfo?.name ?? 'Patient'}</p>
                      <p className="text-xs text-base-content/40">{b.bookingCode} · {b.status}</p>
                    </div>
                    <p className="text-xs font-semibold text-base-content/60">
                      ₹{Number(b.fareBreakdown?.totalAmount ?? 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-base-300/60 bg-base-200 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-4 text-base-content/50">
                Recent Consultations
              </h2>
              <div className="space-y-3">
                {(recent.recentConsultations ?? []).map((c) => (
                  <div key={c._id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-semibold text-base-content">{c.patientSnapshot?.name ?? 'Patient'}</p>
                      <p className="text-xs text-base-content/40">{c.consultationCode} · {c.status}</p>
                    </div>
                    <span className="text-xs font-semibold text-base-content/60 capitalize">
                      {c.consultationType}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Alerts ── */}
        <div className="space-y-3">

          {/* KYC incomplete */}
          {!isLoading && profile?.kycStatus !== 'verified' && (
            <motion.div
              variants={fadeUp}
              custom={9}
              initial="hidden"
              animate="show"
              className="alert alert-warning"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
                  KYC Incomplete
                </p>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Complete KYC verification to receive settlements and activate your account.
                </p>
              </div>
            </motion.div>
          )}

          {/* Bank unverified — from DoctorProfile.bankDetails.isBankVerified */}
          {!isLoading && !profile?.bankDetails?.isBankVerified && (
            <motion.div
              variants={fadeUp}
              custom={10}
              initial="hidden"
              animate="show"
              className="alert alert-warning"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>
                  Bank Unverified
                </p>
                <p className="text-xs text-base-content/60 mt-0.5">
                  Add and verify bank details to receive earnings settlements.
                </p>
              </div>
            </motion.div>
          )}

          {/* All systems active */}
          {!isLoading &&
            profile?.partnershipStatus === 'Active' &&
            profile?.kycStatus === 'verified' &&
            profile?.bankDetails?.isBankVerified && (
              <motion.div
                variants={fadeUp}
                custom={9}
                initial="hidden"
                animate="show"
                className="alert alert-success"
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                    All Systems Active
                  </p>
                  <p className="text-xs text-base-content/60 mt-0.5">
                    Your account is fully verified and ready to receive patients.
                  </p>
                </div>
              </motion.div>
            )}
        </div>

      </div>
    </div>
  );
}