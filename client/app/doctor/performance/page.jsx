'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  Star, TrendingUp, Award, CheckCircle, Clock,
  Zap, Target, Activity, ShieldCheck, UserCheck, BarChart3,
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

/* ─── skeleton ─── */
const Skeleton = ({ className = '' }) => (
  <div className={`skeleton ${className}`} />
);

/* ─── progress bar ─── */
const ProgressBar = ({ label, value, max, icon: Icon, delay }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="show" className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-base-content/60">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-base-content font-mono">{value.toLocaleString('en-IN')}</span>
          <span className="text-xs text-base-content/30">/ {max.toLocaleString('en-IN')}</span>
        </div>
      </div>
      <div className="progress-bar">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, delay: delay * 0.07 + 0.3, ease: 'easeOut' }}
          className="progress-bar-fill"
        />
      </div>
    </motion.div>
  );
};

/* ─── score ring ─── */
const ScoreRing = ({ value, label, colorClass, delay, size = 100 }) => {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <motion.div variants={fadeUp} custom={delay} initial="hidden" animate="show"
      className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={r}
            className="stroke-base-300" strokeWidth={7} fill="none"
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r}
            className={colorClass}
            strokeWidth={7} fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, delay: delay * 0.07, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black text-base-content font-mono">{value}%</span>
        </div>
      </div>
      <p className="text-[11px] text-base-content/50 text-center leading-tight">{label}</p>
    </motion.div>
  );
};

/* ─── badge card ─── */
const BadgeCard = ({ icon: Icon, title, desc, achieved, delay }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className={`p-4 rounded-xl border transition-all ${
      achieved
        ? 'border-primary/20 bg-base-200'
        : 'border-base-300/60 bg-base-200 opacity-40'
    }`}
  >
    <div className="flex items-start gap-3">
      <div className={`p-2 rounded-lg ${achieved ? 'bg-primary/10' : 'bg-base-300'}`}>
        <Icon className={`w-4 h-4 ${achieved ? 'text-primary' : 'text-base-content/30'}`} />
      </div>
      <div>
        <p className={`text-sm font-bold ${achieved ? 'text-base-content' : 'text-base-content/30'}`}>
          {title}
        </p>
        <p className="text-xs text-base-content/50 mt-0.5">{desc}</p>
        {achieved && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-success">
            <CheckCircle className="w-3 h-3" /> Achieved
          </span>
        )}
      </div>
    </div>
  </motion.div>
);

/* ─── section card ─── */
const SectionCard = ({ children, delay, className = '' }) => (
  <motion.div
    variants={fadeUp} custom={delay} initial="hidden" animate="show"
    className={`p-6 rounded-2xl border border-base-300/60 bg-base-200 ${className}`}
  >
    {children}
  </motion.div>
);

const SectionTitle = ({ children, icon: Icon }) => (
  <h2 className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-5 flex items-center gap-2">
    {Icon && <Icon className="w-3.5 h-3.5 text-primary" />}
    {children}
  </h2>
);

/* ─── custom radar tooltip ─── */
const RadarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-200 border border-primary/20 rounded-xl px-3 py-2 shadow-2xl">
      <p className="text-xs font-bold text-base-content">{payload[0]?.payload?.subject}</p>
      <p className="text-xs text-primary">{payload[0]?.value} pts</p>
    </div>
  );
};

/* ─── main page ─── */
export default function Performance() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const stats    = useSelector(selectDoctorStats);
  const loading  = useSelector(selectHospitalLoading);

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  useEffect(() => {
    if (profile?._id) dispatch(fetchDoctorStats(profile._id));
  }, [dispatch, profile?._id]);

const s          = stats?.profile?.stats || {};
  const rating     = stats?.profile?.rating || {};
  const live       = stats?.liveStats || {};
  const isLoading  = loading.fetchMyDoctorProfile || loading.fetchDoctorStats;
  const completion = profile?.profileCompletionPercent ?? 0;

  const ratingScore  = Math.round(((rating.averageRating || 0) / 5) * 100);
const consultCount = live.consultations?.total ?? s.totalConsultations ?? 0;
  const consultScore = Math.min(100, Math.round((consultCount / 50) * 100));
  const settleScore  = s.totalEarnings > 0
    ? Math.round(((s.totalSettled || 0) / s.totalEarnings) * 100)
    : 0;
  const overallScore = Math.round((ratingScore + consultScore + completion + settleScore) / 4);

  const radarData = [
    { subject: 'Rating',     A: ratingScore,  fullMark: 100 },
    { subject: 'Consults',   A: consultScore, fullMark: 100 },
    { subject: 'Profile',    A: completion,   fullMark: 100 },
    { subject: 'Settlement', A: settleScore,  fullMark: 100 },
    { subject: 'Referrals',  A: Math.min(100, ((s.totalReferrals || 0) / 20) * 100), fullMark: 100 },
  ];

  const badges = [
    { icon: Star,       title: 'Top Rated',     desc: 'Rating ≥ 4.5',                achieved: (rating.averageRating || 0) >= 4.5 },
    { icon: Zap,        title: 'Active Partner', desc: 'Partnership Active & KYC OK', achieved: profile?.partnershipStatus === 'Active' && profile?.kycStatus === 'verified' },
{ icon: Target,     title: 'High Volume',    desc: '50+ consultations',           achieved: consultCount >= 50 },   
    { icon: UserCheck,  title: 'KYC Verified',   desc: 'Identity confirmed',          achieved: profile?.kycStatus === 'verified' },
    { icon: ShieldCheck,title: 'Bank Verified',  desc: 'Payout enabled',             achieved: profile?.bankDetails?.isBankVerified },
    { icon: Award,      title: 'Profile Pro',    desc: '80%+ profile completion',     achieved: completion >= 80 },
  ];

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-family-poppins)]">

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-primary">
              <BarChart3 className="w-5 h-5 text-primary-content" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-base-content">Performance</h1>
          </div>
          <p className="text-sm text-base-content/50 ml-[3.25rem]">
            Track your quality metrics and achievements
          </p>
        </motion.div>

        {/* ── Score overview + Radar ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

          {/* Score rings */}
          <SectionCard delay={1}>
            <SectionTitle>Score Overview</SectionTitle>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-center mb-6">
                  <ScoreRing
                    value={overallScore}
                    label="Overall Score"
                    colorClass="stroke-primary"
                    delay={2}
                    size={120}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <ScoreRing value={ratingScore}  label="Rating"     colorClass="stroke-warning"   delay={3} />
                  <ScoreRing value={consultScore} label="Volume"     colorClass="stroke-secondary"  delay={4} />
                  <ScoreRing value={completion}   label="Profile"    colorClass="stroke-info"       delay={5} />
                  <ScoreRing value={settleScore}  label="Settlement" colorClass="stroke-success"    delay={6} />
                </div>
              </>
            )}
          </SectionCard>

          {/* Radar chart */}
          <SectionCard delay={7}>
            <SectionTitle>Performance Radar</SectionTitle>
            {isLoading ? (
              <Skeleton className="h-60 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-base-300" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: 'color-mix(in oklch, var(--base-content) 30%, transparent)' }}
                  />
                  <Radar
                    name="Score"
                    dataKey="A"
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.12}
                    strokeWidth={2}
                    dot={{ fill: 'var(--primary)', r: 3 }}
                  />
                  <Tooltip content={<RadarTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </SectionCard>
        </div>

        {/* ── Progress metrics ── */}
        <SectionCard delay={8} className="mb-5">
          <SectionTitle icon={Activity}>Progress Metrics</SectionTitle>
          {isLoading ? (
            <div className="space-y-4">
              {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
              <ProgressBar label="Profile Completion" value={completion}                     max={100}                                           icon={UserCheck}   delay={9}  />
<ProgressBar label="Consultations"      value={consultCount}                   max={Math.max(50, consultCount)}                     icon={Activity}    delay={10} />
              <ProgressBar label="Referrals"          value={s.totalReferrals || 0}          max={Math.max(20, s.totalReferrals || 0)}            icon={TrendingUp}  delay={11} />
              <ProgressBar label="Home Visits"        value={s.totalHomeVisits || 0}         max={Math.max(20, s.totalHomeVisits || 0)}           icon={Clock}       delay={12} />
              <ProgressBar label="Total Ratings"      value={rating.totalRatings || 0}       max={Math.max(50, rating.totalRatings || 0)}         icon={Star}        delay={13} />
              <ProgressBar label="Monthly Referrals"  value={s.monthlyReferrals || 0}        max={Math.max(10, s.monthlyReferrals || 0)}          icon={Target}      delay={14} />
            </div>
          )}
        </SectionCard>

        {/* ── Achievements ── */}
        <div>
          <motion.h2
            variants={fadeUp} custom={15} initial="hidden" animate="show"
            className="text-xs font-bold text-base-content/50 uppercase tracking-widest mb-4 flex items-center gap-2"
          >
            <Award className="w-3.5 h-3.5 text-warning" /> Achievements
          </motion.h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {isLoading
              ? Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)
              : badges.map((b, i) => <BadgeCard key={b.title} {...b} delay={16 + i} />)
            }
          </div>
        </div>

      </div>
    </div>
  );
}