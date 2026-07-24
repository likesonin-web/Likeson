"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useSpring, useTransform, useInView } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Plus, Search, Grid, List, LayoutList, Trash2, Edit3,
  Stethoscope, Truck, Pill, X, HeartPulse,
  CheckCircle2, IndianRupee, Minus, Activity,
  Zap, Crown, Star, Settings, Package, Clock, BadgeCheck,
  FlaskConical, UserCheck, Percent, Sparkles, TrendingUp,
  TrendingDown, Users, Shield, ArrowRight, RefreshCw,
  AlertTriangle, Bell, ChevronRight, Eye, MoreVertical,
  Layers, Target, BarChart2, PieChart as PieChartIcon,
  CalendarDays, Microscope, Home, Filter, Download,
  ChevronDown, ChevronUp, Info, Flame, Rocket, Award
} from 'lucide-react';

// ── Slice imports (correct selectors & thunks from subscriptionSlice.js) ─────
import {
  fetchAllPlans,
  adminFetchAllPlans,
  adminFetchAllSubscriptions,
  adminFetchAllTrials,
  adminCreatePlan,
  adminUpdatePlan,
  adminDeactivatePlan,
  adminUpdateSubscription,
  sendExpiryAlerts,
  triggerAutoRenew,
  adminExpireStaleTrials,
  selectAllPlans,
  selectAdminPlans,
  selectAdminSubscriptions,
  selectAdminSubPagination,
  selectAdminTrials,
  selectAdminTrialsPagination,
  selectAdminPlansLoading,
  selectAdminSubLoading,
  selectAdminPlanMutateLoading,
  selectAdminPlanMutateError,
  selectAdminTrialsLoading,
  selectExpiryAlertLoading,
  selectExpiryAlertResult,
  selectAutoRenewLoading,
  selectAutoRenewResult,
  selectAdminExpireStaleLoading,
  clearCronResults,
} from '@/store/slices/subscriptionSlice';

// ─────────────────────────────────────────────────────────────────────────────
//  DESIGN TOKENS  (mirrors CSS variables from globals.css)
// ─────────────────────────────────────────────────────────────────────────────
const TIER = {
  'Basic Care': {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    gradientSoft: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(29,78,216,0.08) 100%)',
    accent: '#3b82f6',
    rank: 1,
    icon: Shield,
    tag: 'Starter',
    tagline: 'Essential individual coverage',
  },
  'Premium Care': {
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
    gradientSoft: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(109,40,217,0.08) 100%)',
    accent: '#8b5cf6',
    rank: 2,
    icon: Crown,
    tag: 'Popular',
    tagline: 'Top-tier comprehensive care',
  },
  'Family Care': {
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    gradientSoft: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.08) 100%)',
    accent: '#10b981',
    rank: 3,
    icon: Users,
    tag: 'Best Value',
    tagline: 'Complete family protection',
  },
  "Pregnant Women Care": {
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    gradientSoft: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(217,119,6,0.08) 100%)',
    accent: '#f59e0b',
    rank: 4,
    icon: HeartPulse,
    tag: 'Maternity',
    tagline: 'Dedicated maternity support',
  },
  "NRI's Care": {
    gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    gradientSoft: 'linear-gradient(135deg, rgba(239,68,68,0.15) 0%, rgba(220,38,38,0.08) 100%)',
    accent: '#ef4444',
    rank: 5,
    icon: Rocket,
    tag: 'Global',
    tagline: 'Cross-border healthcare',
  },
};

const getTier = (name) => TIER[name] || TIER['Basic Care'];

const SUPPORT_BADGE = {
  'Standard':           { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6',  label: 'Standard' },
  'Priority':           { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b',  label: 'Priority' },
  'Dedicated Executive':{ bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6',  label: 'VIP Exec' },
  '24/7 Service':       { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444',  label: '24/7' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 28, scale: 0.97 },
  visible: (i = 0) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// ─────────────────────────────────────────────────────────────────────────────
//  ANIMATED COUNTER
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 60, damping: 18 });
  const display = useTransform(spring, (v) => {
    const n = decimals > 0 ? v.toFixed(decimals) : Math.round(v);
    return `${prefix}${Number(n).toLocaleString('en-IN')}${suffix}`;
  });

  useEffect(() => { if (inView) spring.set(value); }, [inView, value, spring]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CUSTOM RECHARTS TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-[12px] py-[10px] px-[14px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] min-w-[120px]">
      {label && <p className="text-[10px] font-extrabold opacity-50 mb-[6px] uppercase tracking-[0.1em]">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-[8px] mb-[2px]">
          <div className="w-[8px] h-[8px] rounded-[2px]" style={{ background: p.color || p.fill }} />
          <span className="text-[12px] font-bold text-base-content">
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN CARD
// ─────────────────────────────────────────────────────────────────────────────
function PlanCard({ plan, viewMode, onEdit, onDelete, onClick, index }) {
  const t = getTier(plan.fixedTier || plan.name);
  const TIcon = t.icon;
  const support = SUPPORT_BADGE[plan.support?.tier] || SUPPORT_BADGE['Standard'];

  const monthly    = plan.pricing?.monthly ?? 0;
  const consults   = plan.consultations?.freePerMonth ?? 0;
  const pharmDisc  = plan.pharmacy?.discountMax ?? plan.pharmacy?.discountMin ?? 0;
  const diagDisc   = plan.diagnostics?.discountPercent ?? 0;
  const maxMembers = plan.membership?.maxMembers ?? 1;
  const careAssist = plan.careAssistant?.included ?? false;
  const homeSample = plan.diagnostics?.homeSampleCollection ?? false;

  const benefits = [
    { icon: Stethoscope, label: 'Consults',  val: consults === -1 ? '∞' : `${consults}/mo`,  active: consults !== 0 },
    { icon: Pill,        label: 'Pharmacy',  val: `${pharmDisc}%`,                            active: pharmDisc > 0 },
    { icon: Microscope,  label: 'Diag',      val: `${diagDisc}%`,                             active: diagDisc > 0 },
    { icon: UserCheck,   label: 'Assistant', val: careAssist ? 'Yes' : 'No',                  active: careAssist },
    { icon: Home,        label: 'Home Lab',  val: homeSample ? 'Yes' : 'No',                  active: homeSample },
    { icon: Users,       label: 'Members',   val: maxMembers,                                  active: true },
  ];

  if (viewMode === 'compact') {
    return (
      <motion.div
        layout
        custom={index}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        whileHover={{ backgroundColor: 'color-mix(in srgb, var(--base-200) 100%, transparent)' }}
        onClick={onClick}
        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer border-b border-base-300"
       
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: t.gradient }}>
          <TIcon size={15} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-base-content truncate">{plan.name}</p>
          <p className="text-[10px] truncate opacity-45">{t.tagline}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ background: support.bg, color: support.color }}>
            {support.label}
          </span>
          <span className="text-sm font-black" style={{ color: t.accent }}>₹{monthly}</span>
          <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(plan)} className="w-7 h-7 rounded-lg flex items-center justify-center text-primary"
             
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--primary), transparent 88%)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Edit3 size={13} />
            </button>
            <button onClick={() => onDelete(plan._id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-error"
             
              onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--error), transparent 88%)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -6, scale: 1.01 }}
      onClick={onClick}
      className="relative cursor-pointer overflow-hidden flex flex-col bg-base-100 border-[1.5px] border-base-300 rounded-[var(--r-box)] shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
      style={{ transition: 'all 0.3s cubic-bezier(0.22,1,0.36,1)' }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = t.accent;
        e.currentTarget.style.boxShadow = `0 12px 40px ${t.accent}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--base-300)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.04)';
      }}
    >
      {/* Gradient header */}
      <div className="relative h-32 flex items-end p-5 overflow-hidden" style={{ background: t.gradient }}>
        {/* Animated background pattern */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-[0.07] border-[20px] border-[white]"
         
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute -right-2 -top-2 w-16 h-16 rounded-full opacity-[0.06] border-[10px] border-[white]"
         
        />
        <div className="relative z-10 w-full">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20 backdrop-blur-[4px]"
                 >
                  <TIcon size={14} className="text-white" />
                </div>
                <span className="text-[9px] font-black text-white/60 uppercase tracking-[0.16em]">
                  {t.tag}
                </span>
              </div>
              <h4 className="text-lg font-black text-white leading-none tracking-tight">{plan.name}</h4>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/45 uppercase font-bold mb-0.5">/month</p>
              <p className="text-2xl font-black text-white leading-none">₹{monthly}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 flex flex-col gap-3">
        {/* Support badge + members */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
            style={{ background: support.bg, color: support.color }}>
            {support.label}
          </span>
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-base-200 text-base-content"
           >
            <Users size={9} className="inline mr-1" />
            {maxMembers} {maxMembers === 1 ? 'member' : 'members'}
          </span>
          {!plan.isActive && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[rgba(239,68,68,0.12)] text-[#ef4444]"
             >
              Inactive
            </span>
          )}
          {plan.isFeatured && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[rgba(245,158,11,0.12)] text-[#f59e0b]"
             >
              <Star size={9} className="inline mr-1" />Featured
            </span>
          )}
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-3 gap-2">
          {benefits.map((b, i) => (
            <div key={i}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
              style={{
                background: b.active ? `${t.accent}10` : 'var(--base-200)',
                opacity: b.active ? 1 : 0.35,
              }}>
              <b.icon size={13} style={{ color: b.active ? t.accent : 'var(--base-content)' }} />
              <span className="text-[10px] font-black" style={{ color: b.active ? t.accent : 'inherit' }}>{b.val}</span>
              <span className="text-[8px] font-bold opacity-50 uppercase leading-none">{b.label}</span>
            </div>
          ))}
        </div>

        {/* Billing label */}
        <p className="text-[10px] font-semibold opacity-45">
          {plan.pricing?.billingLabel || '/month'} · {plan.freeTrial?.enabled ? `${plan.freeTrial.durationDays}d trial` : 'No trial'}
        </p>

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-3 border-t border-base-300"
          onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onEdit(plan)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all bg-base-200 text-base-content"
           
            onMouseEnter={e => { e.currentTarget.style.background = `${t.accent}18`; e.currentTarget.style.color = t.accent; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--base-200)'; e.currentTarget.style.color = 'var(--base-content)'; }}>
            <Edit3 size={12} /> Edit
          </button>
          <button
            onClick={() => onDelete(plan._id)}
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all flex-shrink-0 bg-base-200"
           
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; e.currentTarget.style.color = '#ef4444'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--base-200)'; e.currentTarget.style.color = ''; }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PlanModal({ plan, onClose, onEdit }) {
  const t = getTier(plan.fixedTier || plan.name);
  const TIcon = t.icon;
  const support = SUPPORT_BADGE[plan.support?.tier] || SUPPORT_BADGE['Standard'];

  const rows = [
    { icon: Stethoscope, label: 'Doctor Consultations', val: plan.consultations?.freePerMonth === -1 ? 'Unlimited' : `${plan.consultations?.freePerMonth ?? 0}/month`, active: (plan.consultations?.freePerMonth ?? 0) !== 0 },
    { icon: Pill,        label: 'Pharmacy Discount',    val: plan.pharmacy?.isFlat ? `Flat ${plan.pharmacy.discountMax}%` : `${plan.pharmacy?.discountMin ?? 0}–${plan.pharmacy?.discountMax ?? 0}%`, active: (plan.pharmacy?.discountMax ?? 0) > 0 },
    { icon: Microscope,  label: 'Diagnostic Discount',  val: `${plan.diagnostics?.discountPercent ?? 0}%`, active: (plan.diagnostics?.discountPercent ?? 0) > 0 },
    { icon: Truck,       label: 'Transport Rate',       val: plan.transport?.isApplicable ? `₹${plan.transport?.ratePerKm ?? 0}/km` : 'N/A', active: plan.transport?.isApplicable ?? false },
    { icon: UserCheck,   label: 'Care Assistant',       val: plan.careAssistant?.serviceType ?? 'None', active: plan.careAssistant?.included ?? false },
    { icon: Home,        label: 'Home Sample Collection', val: plan.diagnostics?.homeSampleCollection ? 'Available' : 'Not Available', active: plan.diagnostics?.homeSampleCollection ?? false },
    { icon: Clock,       label: 'Free Trial',           val: plan.freeTrial?.enabled ? `${plan.freeTrial.durationDays} days` : 'Not Available', active: plan.freeTrial?.enabled ?? false },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-[16px]"
       
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 32 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 32 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl overflow-hidden bg-base-100 border-[1.5px] border-base-300 rounded-[calc(var(--r-box) * 1.5)] shadow-[0_48px_96px_rgba(0,0,0,0.35)]"
       >

        {/* Header */}
        <div className="relative h-40 flex items-end p-7 overflow-hidden" style={{ background: t.gradient }}>
          <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.07, 0.12, 0.07] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 bg-[radial-gradient(circle at 80% 30%, white 0%, transparent 60%)]"
            />
          <div className="relative z-10 flex items-end justify-between w-full">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-[8px]"
                 >
                  <TIcon size={20} className="text-white" />
                </div>
                <span className="text-xs font-black text-white/60 uppercase tracking-widest">Tier {t.rank}</span>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full"
                  style={{ background: support.bg, color: support.color }}>
                  {support.label}
                </span>
              </div>
              <h2 className="text-3xl font-black text-white leading-none">{plan.name}</h2>
              <p className="text-white/50 text-xs mt-1">{t.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/40 uppercase font-bold mb-0.5">Monthly</p>
              <p className="text-4xl font-black text-white leading-none">₹{plan.pricing?.monthly ?? 0}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{plan.pricing?.billingLabel || '/month'}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-white z-20 bg-white/15"
           
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-7 grid md:grid-cols-2 gap-6 max-h-[60vh] overflow-y-auto">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-40">Service Details</p>
            <div className="space-y-0">
              {rows.map((r, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 py-2.5 border-b border-base-300"
                  style={{ opacity: r.active ? 1 : 0.3 }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: r.active ? `${t.accent}18` : 'var(--base-300)' }}>
                    <r.icon size={13} style={{ color: r.active ? t.accent : 'inherit' }} />
                  </div>
                  <span className="text-xs font-semibold flex-1">{r.label}</span>
                  <span className="text-xs font-black" style={{ color: r.active ? t.accent : 'inherit' }}>{r.val}</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Features */}
            {plan.features?.additionalFeatures?.length > 0 && (
              <div className="rounded-xl p-4 bg-base-200 border border-base-300">
                <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-40">Features</p>
                {plan.features.additionalFeatures.map((f, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-2 mb-2">
                    <CheckCircle2 size={13} className="shrink-0 mt-[1px]" style={{ color: t.accent }} />
                    <span className="text-xs font-medium opacity-75">{f}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Plan meta flags */}
            <div className="rounded-xl p-4 bg-base-200 border border-base-300">
              <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-40">Plan Flags</p>
              {[
                { label: 'No Hidden Charges',       val: plan.features?.noHiddenCharges },
                { label: 'Monthly Health Summary',  val: plan.features?.monthlyHealthSummary },
                { label: 'No Cancellation Charges', val: plan.features?.noCancellationCharges },
                { label: 'Auto Refill Reminders',   val: plan.features?.autoRefillReminders },
                { label: 'Digital Report Access',   val: plan.features?.digitalReportAccess },
              ].map((f, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-xs font-medium opacity-60">{f.label}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={f.val ? { background: `${t.accent}18`, color: t.accent } : { background: 'var(--base-300)', opacity: 0.4 }}>
                    {f.val ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-auto flex gap-2">
              <button
                onClick={() => { onClose(); onEdit(plan); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all text-[white]"
                style={{ background: t.gradient }}>
                <Edit3 size={14} /> Edit Plan
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN DRAWER (create / edit)
// ─────────────────────────────────────────────────────────────────────────────
const PLAN_NAMES = ['Basic Care', 'Premium Care', 'Family Care', 'Pregnant Women Care', "NRI's Care"];

const DEFAULT_FORM = () => ({
  name: 'Basic Care',
  fixedTier: 'Basic Care',
  slug: '',
  description: '',
  'pricing.monthly': 299,
  'pricing.billingCycle': 'monthly',
  'pricing.billingLabel': '/month',
  'membership.maxMembers': 1,
  'membership.membershipNote': '',
  'consultations.freePerMonth': 2,
  'consultations.modes.video': false,
  'consultations.modes.home': false,
  'pharmacy.discountMin': 0,
  'pharmacy.discountMax': 0,
  'pharmacy.isFlat': false,
  'pharmacy.deliveryChargePerOrder': null,
  'diagnostics.discountPercent': 0,
  'diagnostics.homeSampleCollection': false,
  'transport.ratePerKm': null,
  'transport.isApplicable': true,
  'careAssistant.included': false,
  'careAssistant.isDedicated': false,
  'careAssistant.serviceType': 'None',
  'support.tier': 'Standard',
  'support.priorityAppointmentScheduling': false,
  'features.noHiddenCharges': true,
  'features.monthlyHealthSummary': false,
  'features.noCancellationCharges': false,
  'features.autoRefillReminders': false,
  'features.digitalReportAccess': false,
  'freeTrial.enabled': true,
  'freeTrial.durationDays': 7,
  idealFor: '',
  displayOrder: 1,
  isFeatured: false,
  badgeLabel: '',
  isActive: true,
});

// Flatten a nested plan object for the form
function flattenPlan(plan) {
  if (!plan) return DEFAULT_FORM();
  return {
    name: plan.name,
    fixedTier: plan.fixedTier,
    slug: plan.slug,
    description: plan.description || '',
    'pricing.monthly': plan.pricing?.monthly ?? 299,
    'pricing.billingCycle': plan.pricing?.billingCycle ?? 'monthly',
    'pricing.billingLabel': plan.pricing?.billingLabel ?? '/month',
    'membership.maxMembers': plan.membership?.maxMembers ?? 1,
    'membership.membershipNote': plan.membership?.membershipNote ?? '',
    'consultations.freePerMonth': plan.consultations?.freePerMonth ?? 0,
    'consultations.modes.video': plan.consultations?.modes?.video ?? false,
    'consultations.modes.home': plan.consultations?.modes?.home ?? false,
    'pharmacy.discountMin': plan.pharmacy?.discountMin ?? 0,
    'pharmacy.discountMax': plan.pharmacy?.discountMax ?? 0,
    'pharmacy.isFlat': plan.pharmacy?.isFlat ?? false,
    'pharmacy.deliveryChargePerOrder': plan.pharmacy?.deliveryChargePerOrder ?? null,
    'diagnostics.discountPercent': plan.diagnostics?.discountPercent ?? 0,
    'diagnostics.homeSampleCollection': plan.diagnostics?.homeSampleCollection ?? false,
    'transport.ratePerKm': plan.transport?.ratePerKm ?? null,
    'transport.isApplicable': plan.transport?.isApplicable ?? true,
    'careAssistant.included': plan.careAssistant?.included ?? false,
    'careAssistant.isDedicated': plan.careAssistant?.isDedicated ?? false,
    'careAssistant.serviceType': plan.careAssistant?.serviceType ?? 'None',
    'support.tier': plan.support?.tier ?? 'Standard',
    'support.priorityAppointmentScheduling': plan.support?.priorityAppointmentScheduling ?? false,
    'features.noHiddenCharges': plan.features?.noHiddenCharges ?? true,
    'features.monthlyHealthSummary': plan.features?.monthlyHealthSummary ?? false,
    'features.noCancellationCharges': plan.features?.noCancellationCharges ?? false,
    'features.autoRefillReminders': plan.features?.autoRefillReminders ?? false,
    'features.digitalReportAccess': plan.features?.digitalReportAccess ?? false,
    'freeTrial.enabled': plan.freeTrial?.enabled ?? true,
    'freeTrial.durationDays': plan.freeTrial?.durationDays ?? 7,
    idealFor: plan.idealFor ?? '',
    displayOrder: plan.displayOrder ?? 1,
    isFeatured: plan.isFeatured ?? false,
    badgeLabel: plan.badgeLabel ?? '',
    isActive: plan.isActive ?? true,
  };
}

// Unflatten form back to nested structure for API
function unflattenForm(f) {
  return {
    name: f.name,
    fixedTier: f.name,
    slug: f.slug || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/'/g, ''),
    description: f.description,
    pricing: { monthly: Number(f['pricing.monthly']), billingCycle: f['pricing.billingCycle'], billingLabel: f['pricing.billingLabel'], currency: 'INR' },
    membership: { maxMembers: Number(f['membership.maxMembers']), membershipNote: f['membership.membershipNote'] },
    consultations: { freePerMonth: Number(f['consultations.freePerMonth']), modes: { inPerson: true, video: f['consultations.modes.video'], home: f['consultations.modes.home'] } },
    pharmacy: { discountMin: Number(f['pharmacy.discountMin']), discountMax: Number(f['pharmacy.discountMax']), isFlat: f['pharmacy.isFlat'], deliveryChargePerOrder: f['pharmacy.deliveryChargePerOrder'] },
    diagnostics: { discountPercent: Number(f['diagnostics.discountPercent']), isApplicable: true, homeSampleCollection: f['diagnostics.homeSampleCollection'] },
    transport: { ratePerKm: f['transport.ratePerKm'] ? Number(f['transport.ratePerKm']) : null, isApplicable: f['transport.isApplicable'] },
    careAssistant: { included: f['careAssistant.included'], isDedicated: f['careAssistant.isDedicated'], serviceType: f['careAssistant.serviceType'] },
    support: { tier: f['support.tier'], priorityAppointmentScheduling: f['support.priorityAppointmentScheduling'] },
    features: { noHiddenCharges: f['features.noHiddenCharges'], monthlyHealthSummary: f['features.monthlyHealthSummary'], noCancellationCharges: f['features.noCancellationCharges'], autoRefillReminders: f['features.autoRefillReminders'], digitalReportAccess: f['features.digitalReportAccess'] },
    freeTrial: { enabled: f['freeTrial.enabled'], durationDays: Number(f['freeTrial.durationDays']), requiresPaymentMethod: false },
    idealFor: f.idealFor,
    displayOrder: Number(f.displayOrder),
    isFeatured: f.isFeatured,
    badgeLabel: f.badgeLabel,
    isActive: f.isActive,
    planType: 'fixed',
  };
}

const DRAWER_TABS = [
  { id: 'identity',  label: 'Identity',    icon: Sparkles },
  { id: 'benefits',  label: 'Benefits',    icon: Zap },
  { id: 'services',  label: 'Services',    icon: Stethoscope },
  { id: 'settings',  label: 'Settings',    icon: Settings },
];

function ToggleSwitch({ checked, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-base-300">
      <div>
        <p className="text-xs font-bold">{label}</p>
        {desc && <p className="text-[10px] mt-0.5 opacity-45">{desc}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 rounded-full transition-all duration-300 w-[44px] h-[24px]"
        style={{ background: checked ? 'var(--primary)' : 'var(--base-300)', boxShadow: checked ? '0 0 12px color-mix(in srgb, var(--primary), transparent 55%)' : 'none' }}>
        <motion.div animate={{ x: checked ? 22 : 2 }} transition={{ duration: 0.2, ease: 'easeOut' }}
          className="absolute top-1 w-4 h-4 rounded-full shadow-md bg-[white]" />
      </button>
    </div>
  );
}

function StepperInput({ label, value, onChange, min = 0, max = 100, suffix }) {
  return (
    <div>
      <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5 opacity-45">{label}</label>
      <div className="flex items-center rounded-xl overflow-hidden border" style={{ borderColor: 'var(--base-300)' }}>
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="w-9 h-9 flex items-center justify-center bg-base-200 shrink-0"
         >
          <Minus size={11} />
        </button>
        <input type="number" value={value}
          onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
          className="flex-1 text-center text-sm font-black outline-none py-2 bg-base-100 border-none text-base-content"
          />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="w-9 h-9 flex items-center justify-center bg-base-200 shrink-0"
         >
          <Plus size={11} />
        </button>
      </div>
      {suffix && <p className="text-[9px] mt-0.5 font-bold uppercase opacity-35">{suffix}</p>}
    </div>
  );
}

function PlanDrawer({ isOpen, editingPlan, onClose, onSubmit, loading }) {
  const [form, setForm] = useState(DEFAULT_FORM());
  const [tab, setTab]   = useState('identity');
  const t = getTier(form.name);

  useEffect(() => {
    setForm(flattenPlan(editingPlan));
    setTab('identity');
  }, [editingPlan, isOpen]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    const payload = unflattenForm(form);
    onSubmit(payload);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[8px]"
           
            onClick={onClose} />

          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 h-full w-full max-w-[500px] z-[101] flex flex-col bg-base-100 border-l-[1.5px] border-base-300 shadow-[-32px_0_80px_rgba(0,0,0,0.25)]"
           >

            {/* Drawer header */}
            <div className="relative overflow-hidden flex-shrink-0 pt-[22px] px-[24px] pb-[18px]" style={{ background: t.gradient }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
                className="absolute -right-12 -top-12 w-40 h-40 rounded-full opacity-[0.07] border-[24px] border-[white]"
                />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-0.5">
                    {editingPlan ? 'Editing Plan' : 'New Care Tier'}
                  </p>
                  <h2 className="text-xl font-black text-white">{form.name}</h2>
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-white bg-white/18"
                 >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-shrink-0 bg-base-200 border-b border-base-300">
              {DRAWER_TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[9px] font-black uppercase tracking-wider transition-all"
                  style={{
                    color: tab === id ? 'var(--primary)' : 'color-mix(in srgb, var(--base-content), transparent 55%)',
                    borderBottom: tab === id ? '2px solid var(--primary)' : '2px solid transparent',
                    background: tab === id ? 'color-mix(in srgb, var(--primary), transparent 92%)' : 'transparent',
                  }}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <AnimatePresence mode="wait">
                {tab === 'identity' && (
                  <motion.div key="identity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest block mb-2 opacity-45">Plan Tier</label>
                      <div className="grid grid-cols-1 gap-2">
                        {PLAN_NAMES.map(name => {
                          const tc = getTier(name);
                          const PIcon = tc.icon;
                          return (
                            <button key={name} type="button" onClick={() => { set('name', name); set('fixedTier', name); }}
                              className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                              style={{
                                border: form.name === name ? `2px solid ${tc.accent}` : '1.5px solid var(--base-300)',
                                background: form.name === name ? `${tc.accent}12` : 'var(--base-200)',
                                boxShadow: form.name === name ? `0 4px 16px ${tc.accent}28` : 'none',
                              }}>
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: tc.gradient }}>
                                <PIcon size={14} className="text-white" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-black">{name}</p>
                                <p className="text-[9px] mt-0.5 opacity-45">{tc.tagline}</p>
                              </div>
                              {form.name === name && <CheckCircle2 size={16} style={{ color: tc.accent }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5 opacity-45">Price (₹/month)</label>
                        <input type="number" className="input-field w-full text-lg font-black"
                          value={form['pricing.monthly']}
                          onChange={e => set('pricing.monthly', e.target.value)} />
                      </div>
                      <StepperInput label="Max Members" value={form['membership.maxMembers']}
                        onChange={v => set('membership.maxMembers', v)} min={1} max={10} />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5 opacity-45">Ideal For</label>
                      <input type="text" className="input-field w-full" placeholder="e.g. Expecting mothers, NRI families..."
                        value={form.idealFor} onChange={e => set('idealFor', e.target.value)} />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5 opacity-45">Billing Cycle</label>
                      <div className="flex gap-2">
                        {[['monthly', '/month'], ['till_delivery', 'Till Delivery']].map(([val, lbl]) => (
                          <button key={val} type="button" onClick={() => { set('pricing.billingCycle', val); set('pricing.billingLabel', lbl); }}
                            className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{
                              border: form['pricing.billingCycle'] === val ? '2px solid var(--primary)' : '1.5px solid var(--base-300)',
                              background: form['pricing.billingCycle'] === val ? 'color-mix(in srgb, var(--primary), transparent 90%)' : 'var(--base-200)',
                              color: form['pricing.billingCycle'] === val ? 'var(--primary)' : 'var(--base-content)',
                            }}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {tab === 'benefits' && (
                  <motion.div key="benefits" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
                    <div className="p-4 rounded-xl space-y-4 bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Consultations</p>
                      <p className="text-[10px] opacity-45">Use <strong>-1</strong> for unlimited</p>
                      <StepperInput label="Free/month" value={form['consultations.freePerMonth']}
                        onChange={v => set('consultations.freePerMonth', v)} min={-1} max={99} suffix="consultations per month" />
                      <div className="grid grid-cols-2 gap-2">
                        <ToggleSwitch label="Video Mode" checked={form['consultations.modes.video']}
                          onChange={v => set('consultations.modes.video', v)} />
                        <ToggleSwitch label="Home Visit" checked={form['consultations.modes.home']}
                          onChange={v => set('consultations.modes.home', v)} />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl space-y-4 bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Pharmacy</p>
                      <div className="grid grid-cols-2 gap-4">
                        <StepperInput label="Discount Min %" value={form['pharmacy.discountMin']}
                          onChange={v => set('pharmacy.discountMin', v)} min={0} max={25} suffix="max 25% (platform cap)" />
                        <StepperInput label="Discount Max %" value={form['pharmacy.discountMax']}
                          onChange={v => set('pharmacy.discountMax', v)} min={0} max={25} />
                      </div>
                      <ToggleSwitch label="Flat Discount" desc="Apply max % as flat (not range)"
                        checked={form['pharmacy.isFlat']} onChange={v => set('pharmacy.isFlat', v)} />
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5 opacity-45">Delivery Charge (₹)</label>
                        <input type="number" className="input-field w-full" placeholder="0 = free"
                          value={form['pharmacy.deliveryChargePerOrder'] ?? ''}
                          onChange={e => set('pharmacy.deliveryChargePerOrder', e.target.value === '' ? null : Number(e.target.value))} />
                      </div>
                    </div>

                    <div className="p-4 rounded-xl space-y-4 bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Diagnostics</p>
                      <StepperInput label="Discount %" value={form['diagnostics.discountPercent']}
                        onChange={v => set('diagnostics.discountPercent', v)} min={0} max={25} />
                      <ToggleSwitch label="Home Sample Collection" checked={form['diagnostics.homeSampleCollection']}
                        onChange={v => set('diagnostics.homeSampleCollection', v)} />
                    </div>
                  </motion.div>
                )}

                {tab === 'services' && (
                  <motion.div key="services" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
                    <div className="p-4 rounded-xl space-y-3 bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Transport</p>
                      <ToggleSwitch label="Transport Applicable" checked={form['transport.isApplicable']}
                        onChange={v => set('transport.isApplicable', v)} />
                      {form['transport.isApplicable'] && (
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5 opacity-45">Rate (₹/km)</label>
                          <input type="number" className="input-field w-full"
                            value={form['transport.ratePerKm'] ?? ''}
                            onChange={e => set('transport.ratePerKm', e.target.value === '' ? null : Number(e.target.value))} />
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl space-y-3 bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Care Assistant</p>
                      <ToggleSwitch label="Include Care Assistant" checked={form['careAssistant.included']}
                        onChange={v => set('careAssistant.included', v)} />
                      {form['careAssistant.included'] && (
                        <>
                          <ToggleSwitch label="Dedicated Assistant" desc="Assigned exclusively (Maternity)"
                            checked={form['careAssistant.isDedicated']} onChange={v => { set('careAssistant.isDedicated', v); set('careAssistant.serviceType', v ? 'Dedicated' : 'Standard'); }} />
                        </>
                      )}
                    </div>

                    <div className="p-4 rounded-xl space-y-3 bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Support Tier</p>
                      {['Standard', 'Priority', 'Dedicated Executive', '24/7 Service'].map(tier => {
                        const sb = SUPPORT_BADGE[tier];
                        return (
                          <button key={tier} type="button" onClick={() => set('support.tier', tier)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                            style={{
                              border: form['support.tier'] === tier ? `2px solid ${sb.color}` : '1.5px solid var(--base-300)',
                              background: form['support.tier'] === tier ? `${sb.color}10` : 'var(--base-100)',
                            }}>
                            <span className="text-[10px] font-black px-2.5 py-1 rounded-full flex-shrink-0"
                              style={{ background: sb.bg, color: sb.color }}>{sb.label}</span>
                            <span className="text-xs font-bold">{tier}</span>
                            {form['support.tier'] === tier && <CheckCircle2 size={14} className="ml-auto" style={{ color: sb.color }} />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {tab === 'settings' && (
                  <motion.div key="settings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-5">
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-40">Free Trial</p>
                      <ToggleSwitch label="Enable Free Trial" checked={form['freeTrial.enabled']}
                        onChange={v => set('freeTrial.enabled', v)} />
                      {form['freeTrial.enabled'] && (
                        <div className="mt-3">
                          <StepperInput label="Duration (days)" value={form['freeTrial.durationDays']}
                            onChange={v => set('freeTrial.durationDays', v)} min={1} max={30} />
                        </div>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-40">Feature Flags</p>
                      {[
                        ['features.noHiddenCharges',       'No Hidden Charges'],
                        ['features.monthlyHealthSummary',  'Monthly Health Summary'],
                        ['features.noCancellationCharges', 'No Cancellation Charges'],
                        ['features.autoRefillReminders',   'Auto Refill Reminders'],
                        ['features.digitalReportAccess',   'Digital Report Access'],
                      ].map(([key, label]) => (
                        <ToggleSwitch key={key} label={label}
                          checked={form[key]} onChange={v => set(key, v)} />
                      ))}
                    </div>

                    <div className="p-4 rounded-xl bg-base-200 border border-base-300">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-40">Display</p>
                      <ToggleSwitch label="Active" desc="Hidden from users if inactive" checked={form.isActive}
                        onChange={v => set('isActive', v)} />
                      <ToggleSwitch label="Featured" desc="Highlighted on the plan selector" checked={form.isFeatured}
                        onChange={v => set('isFeatured', v)} />
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <StepperInput label="Display Order" value={form.displayOrder}
                          onChange={v => set('displayOrder', v)} min={1} max={99} />
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest block mb-1.5 opacity-45">Badge Label</label>
                          <input type="text" className="input-field w-full text-xs"
                            placeholder="Most Popular..."
                            value={form.badgeLabel} onChange={e => set('badgeLabel', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex gap-3 p-5 bg-base-200 border-t border-base-300">
              <button type="button" onClick={onClose}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all bg-base-300 text-base-content"
               >
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={loading}
                className="btn-primary-cta flex-1 !py-3 flex items-center justify-center gap-2 text-xs"
                style={{ opacity: loading ? 0.7 : 1 }}>
                {loading
                  ? <><RefreshCw size={13} className="animate-spin" /> Saving…</>
                  : <><CheckCircle2 size={14} /> {editingPlan ? 'Save Changes' : 'Create Plan'}</>
                }
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ANALYTICS SECTION  (Recharts)
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsSection({ plans, subs, trials }) {
  const [activeChart, setActiveChart] = useState('revenue');

  // Compute real stats from plan data
  const totalActiveSubs   = useMemo(() => subs.filter(s => s.status === 'Active').length, [subs]);
  const totalTrialSubs    = useMemo(() => trials.filter(t => t.status === 'Trial').length, [trials]);
  const totalRevenue      = useMemo(() => subs.filter(s => s.status === 'Active').reduce((acc, s) => acc + (s.plan?.pricing?.monthly ?? 0), 0), [subs]);
  const avgPlanPrice      = useMemo(() => plans.length ? Math.round(plans.reduce((a, p) => a + (p.pricing?.monthly ?? 0), 0) / plans.length) : 0, [plans]);

  // Revenue by plan (for bar chart)
  const revenueByPlan = useMemo(() => plans.map(p => ({
    name: (p.fixedTier || p.name)?.split(' ')[0],
    revenue: subs.filter(s => s.status === 'Active' && (s.plan?._id === p._id || s.plan === p._id)).length * (p.pricing?.monthly ?? 0),
    subs: subs.filter(s => s.status === 'Active' && (s.plan?._id === p._id || s.plan === p._id)).length,
    price: p.pricing?.monthly ?? 0,
  })), [plans, subs]);

  // Status distribution (pie)
  const statusDist = useMemo(() => {
    const counts = subs.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [subs]);

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Simulated area chart data (monthly trend — would be real in production)
  const trendData = useMemo(() => {
    const months = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    return months.map((m, i) => ({
      month: m,
      active:  Math.max(totalActiveSubs - (7 - i) * 3, 0),
      trial:   Math.max(totalTrialSubs  - (7 - i) * 2, 0),
      revenue: Math.max(totalRevenue    - (7 - i) * 1200, 0),
    }));
  }, [totalActiveSubs, totalTrialSubs, totalRevenue]);

  const KPIs = [
    { label: 'Active Plans',    val: plans.filter(p => p.isActive).length, total: plans.length, icon: Layers,      color: '#3b82f6', change: +2 },
    { label: 'Active Subs',     val: totalActiveSubs,                       icon: BadgeCheck,   color: '#10b981', change: +12 },
    { label: 'On Trial',        val: totalTrialSubs,                        icon: Clock,        color: '#f59e0b', change: +5 },
    { label: 'Monthly Revenue', val: totalRevenue, prefix: '₹',            icon: IndianRupee,  color: '#8b5cf6', change: +8 },
    { label: 'Avg Plan Price',  val: avgPlanPrice, prefix: '₹',            icon: TrendingUp,   color: '#ef4444', change: +3 },
  ];

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {KPIs.map((k, i) => (
          <motion.div key={i} custom={i} variants={fadeUp}
            whileHover={{ y: -4, scale: 1.02 }}
            className="relative overflow-hidden rounded-2xl p-5 bg-base-100 border-[1.5px] border-base-300 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
           >
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(circle at 90% 10%, ${k.color}14, transparent 65%)` }} />
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${k.color}18` }}>
                <k.icon size={17} style={{ color: k.color }} />
              </div>
              <span className="text-[10px] font-black flex items-center gap-0.5"
                style={{ color: k.change >= 0 ? '#10b981' : '#ef4444' }}>
                {k.change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(k.change)}%
              </span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-40">{k.label}</p>
            <p className="text-2xl font-black" style={{ color: k.color }}>
              <AnimatedNumber value={k.val} prefix={k.prefix || ''} />
            </p>
            {k.total !== undefined && (
              <div className="mt-2 h-1 rounded-full overflow-hidden bg-base-300">
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${k.total > 0 ? (k.val / k.total) * 100 : 0}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: i * 0.1 }}
                  style={{ background: k.color }} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Area chart — subscription trend */}
        <motion.div custom={0} variants={fadeUp}
          className="lg:col-span-2 rounded-2xl p-5 bg-base-100 border-[1.5px] border-base-300"
         >
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-40">Subscription Trend</p>
              <p className="text-sm font-black">Growth Overview</p>
            </div>
            <div className="flex gap-1">
              {['revenue', 'subs'].map(c => (
                <button key={c} onClick={() => setActiveChart(c)}
                  className="text-[10px] font-black px-3 py-1.5 rounded-lg uppercase transition-all"
                  style={{
                    background: activeChart === c ? 'var(--primary)' : 'var(--base-200)',
                    color: activeChart === c ? 'white' : 'var(--base-content)',
                  }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<ChartTooltip />} />
              {activeChart === 'subs' ? (
                <>
                  <Area type="monotone" dataKey="active" name="Active" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorActive)" dot={false} activeDot={{ r: 5, fill: '#3b82f6' }} />
                  <Area type="monotone" dataKey="trial"  name="Trial"  stroke="#f59e0b" strokeWidth={2}   fill="none" strokeDasharray="5 3" dot={false} activeDot={{ r: 4, fill: '#f59e0b' }} />
                </>
              ) : (
                <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#colorRevenue)" dot={false} activeDot={{ r: 5, fill: '#8b5cf6' }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie chart — status distribution */}
        <motion.div custom={1} variants={fadeUp}
          className="rounded-2xl p-5 bg-base-100 border-[1.5px] border-base-300"
         >
          <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-40">Status Distribution</p>
          <p className="text-sm font-black mb-4">Subscription Status</p>
          {statusDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    paddingAngle={3} dataKey="value"
                    animationBegin={200} animationDuration={1200}>
                    {statusDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {statusDist.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[10px] font-semibold opacity-65">{d.name}</span>
                    </div>
                    <span className="text-[10px] font-black">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-35">
              <PieChartIcon size={28} />
              <p className="text-xs font-bold">No subscription data</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bar chart — revenue by plan */}
      <motion.div custom={2} variants={fadeUp}
        className="rounded-2xl p-5 bg-base-100 border-[1.5px] border-base-300"
       >
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-40">Revenue Breakdown</p>
            <p className="text-sm font-black">Monthly Revenue by Plan</p>
          </div>
          <BarChart2 size={16} className="opacity-35" />
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={revenueByPlan} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} width={45} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="revenue" name="Revenue (₹)" radius={[6, 6, 0, 0]} animationBegin={300} animationDuration={1000}>
              {revenueByPlan.map((_, i) => (
                <Cell key={i} fill={[
                  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'
                ][i % 5]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SKELETON
// ─────────────────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 skeleton h-64 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
      <div className="skeleton h-48 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-80 rounded-2xl" />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CRON PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CronPanel({ onClose }) {
  const dispatch = useDispatch();
  const expiryLoading     = useSelector(selectExpiryAlertLoading);
  const expiryResult      = useSelector(selectExpiryAlertResult);
  const renewLoading      = useSelector(selectAutoRenewLoading);
  const renewResult       = useSelector(selectAutoRenewResult);
  const expireStaleLoading = useSelector(selectAdminExpireStaleLoading);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/65 backdrop-blur-[12px]"
       
        onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 24 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg overflow-hidden bg-base-100 border-[1.5px] border-base-300 rounded-[calc(var(--r-box) * 1.5)] shadow-[0_48px_96px_rgba(0,0,0,0.35)]"
       >

        <div className="flex items-center justify-between p-6 pb-4 border-b border-base-300">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-40">System</p>
            <h3 className="text-lg font-black">Cron Jobs</h3>
          </div>
          <button onClick={() => { dispatch(clearCronResults()); onClose(); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200">
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {[
            {
              label: 'Send Expiry Alerts',
              desc: 'Notify users whose subscriptions expire within 7 days',
              icon: Bell,
              color: '#f59e0b',
              loading: expiryLoading,
              result: expiryResult,
              action: () => dispatch(sendExpiryAlerts()),
              resultKey: 'totalEmailsSent',
            },
            {
              label: 'Trigger Auto-Renewal',
              desc: 'Process wallet-based renewals for subscriptions expiring in 24h',
              icon: RefreshCw,
              color: '#10b981',
              loading: renewLoading,
              result: renewResult,
              action: () => dispatch(triggerAutoRenew()),
              resultKey: 'summary',
            },
            {
              label: 'Expire Stale Trials',
              desc: 'Mark overdue free trials as expired and send conversion nudges',
              icon: Clock,
              color: '#ef4444',
              loading: expireStaleLoading,
              result: null,
              action: () => dispatch(adminExpireStaleTrials()),
              resultKey: null,
            },
          ].map((job, i) => (
            <div key={i} className="rounded-xl p-4 bg-base-200 border border-base-300">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${job.color}18` }}>
                  <job.icon size={16} style={{ color: job.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black">{job.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-45">{job.desc}</p>
                </div>
                <button onClick={job.action} disabled={job.loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex-shrink-0"
                  style={{ background: `${job.color}18`, color: job.color, opacity: job.loading ? 0.6 : 1 }}>
                  {job.loading
                    ? <RefreshCw size={11} className="animate-spin" />
                    : <Zap size={11} />
                  }
                  {job.loading ? 'Running…' : 'Run'}
                </button>
              </div>
              {job.result && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg p-3 text-xs font-mono bg-base-300 text-base-content"
                 >
                  {JSON.stringify(job.result, null, 2)}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const SubscriptionManagement = () => {
  const dispatch = useDispatch();

  // ── Selectors (all from subscriptionSlice) ────────────────────────────────
  const plans        = useSelector(selectAdminPlans);
  const subs         = useSelector(selectAdminSubscriptions);
  const trials       = useSelector(selectAdminTrials);
  const plansLoading = useSelector(selectAdminPlansLoading);
  const subLoading   = useSelector(selectAdminSubLoading);
  const mutateLoading = useSelector(selectAdminPlanMutateLoading);
  const mutateError   = useSelector(selectAdminPlanMutateError);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [viewMode,       setViewMode]       = useState('grid');
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filterActive,   setFilterActive]   = useState('all');   // all | active | inactive
  const [isDrawerOpen,   setIsDrawerOpen]   = useState(false);
  const [editingPlan,    setEditingPlan]     = useState(null);
  const [selectedPlan,   setSelectedPlan]   = useState(null);
  const [showCron,       setShowCron]       = useState(false);
  const [showAnalytics,  setShowAnalytics]  = useState(true);
  const [subPage,        setSubPage]        = useState(1);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(adminFetchAllPlans());
    dispatch(adminFetchAllSubscriptions({ page: subPage, limit: 20 }));
    dispatch(adminFetchAllTrials({ page: 1, limit: 50 }));
  }, [dispatch]);

  useEffect(() => {
    dispatch(adminFetchAllSubscriptions({ page: subPage, limit: 20 }));
  }, [subPage, dispatch]);

  // ── Close drawer on mutation error ───────────────────────────────────────
  useEffect(() => {
    if (mutateError) setIsDrawerOpen(false);
  }, [mutateError]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = plans;
    if (filterActive === 'active')   list = list.filter(p => p.isActive);
    if (filterActive === 'inactive') list = list.filter(p => !p.isActive);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.fixedTier?.toLowerCase().includes(q) ||
        p.idealFor?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [plans, searchTerm, filterActive]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleOpenDrawer = useCallback((plan = null) => {
    setEditingPlan(plan);
    setIsDrawerOpen(true);
  }, []);

  const handleSubmit = useCallback(async (data) => {
    if (editingPlan) {
      const res = await dispatch(adminUpdatePlan({ planId: editingPlan._id, ...data }));
      if (!res.error) setIsDrawerOpen(false);
    } else {
      const res = await dispatch(adminCreatePlan(data));
      if (!res.error) setIsDrawerOpen(false);
    }
  }, [dispatch, editingPlan]);

  const handleDeactivate = useCallback((planId) => {
    if (confirm('Deactivate this plan? It will be hidden from all users.')) {
      dispatch(adminDeactivatePlan(planId));
    }
  }, [dispatch]);

  // ── Initial loading ───────────────────────────────────────────────────────
  if (plansLoading && plans.length === 0) return <Skeleton />;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto min-h-screen">

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-[linear-gradient(135deg, var(--primary), var(--secondary))]"
               >
                <Crown size={17} className="text-white" />
              </motion.div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-40">
                Subscription Management
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-base-content leading-tight">
              Care Plan <span className="text-gradient-primary">Tiers</span>
            </h1>
            <p className="text-sm mt-1 opacity-45">
              Manage fixed plans, pricing, benefits, and billing configuration
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAnalytics(v => !v)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border-[1.5px] border-base-300"
              style={{ background: showAnalytics ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'var(--base-200)', color: showAnalytics ? 'var(--primary)' : 'var(--base-content)' }}>
              <BarChart2 size={13} /> Analytics
            </button>
            <button onClick={() => setShowCron(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all bg-base-200 border-[1.5px] border-base-300"
             >
              <Zap size={13} /> Cron Jobs
            </button>
            <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              onClick={() => handleOpenDrawer()}
              className="btn-primary-cta flex items-center gap-2">
              <Plus size={16} /> Create Plan
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── Analytics ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
            <AnalyticsSection plans={plans} subs={subs} trials={trials} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" />
          <input type="text" placeholder="Search plans..."
            className="input-field w-full pl-10 text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-45">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5">
          {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterActive(val)}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-[1.5px] border-base-300"
              style={{ background: filterActive === val ? 'var(--primary)' : 'var(--base-200)', color: filterActive === val ? 'white' : 'var(--base-content)' }}>
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* View mode */}
          <div className="flex rounded-xl overflow-hidden border-[1.5px] border-base-300">
            {[
              { id: 'grid',    icon: Grid,       title: 'Grid' },
              { id: 'compact', icon: LayoutList,  title: 'Compact' },
            ].map(({ id, icon: Icon, title }) => (
              <button key={id} onClick={() => setViewMode(id)} title={title}
                className="flex items-center justify-center w-9 h-9 transition-all"
                style={{
                  background: viewMode === id ? 'var(--primary)' : 'transparent',
                  color: viewMode === id ? 'white' : 'var(--base-content)',
                }}>
                <Icon size={14} />
              </button>
            ))}
          </div>
          <span className="text-xs font-bold opacity-40">
            {filtered.length} plan{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </motion.div>

      {/* ── Plan List ────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-24 gap-4">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center bg-[color-mix(in srgb, var(--primary), transparent 88%)]"
           >
            <Package size={28} className="text-primary" />
          </motion.div>
          <h3 className="text-lg font-black">No plans found</h3>
          <p className="text-sm opacity-45">
            {searchTerm ? `No results for "${searchTerm}"` : 'Create your first subscription tier'}
          </p>
          {!searchTerm && (
            <button onClick={() => handleOpenDrawer()} className="btn-primary-cta flex items-center gap-2">
              <Plus size={14} /> Create First Plan
            </button>
          )}
        </motion.div>
      ) : viewMode === 'compact' ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="overflow-hidden rounded-2xl border-[1.5px] border-base-300"
         >
          <AnimatePresence mode="popLayout">
            {filtered.map((plan, i) => (
              <PlanCard key={plan._id} plan={plan} viewMode="compact" index={i}
                onEdit={handleOpenDrawer}
                onDelete={handleDeactivate}
                onClick={() => setSelectedPlan(plan)} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((plan, i) => (
              <PlanCard key={plan._id} plan={plan} viewMode="grid" index={i}
                onEdit={handleOpenDrawer}
                onDelete={handleDeactivate}
                onClick={() => setSelectedPlan(plan)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Subscriptions Mini Table ──────────────────────────────────────── */}
      {subs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl overflow-hidden border-[1.5px] border-base-300"
         >
          <div className="flex items-center justify-between px-6 py-4 bg-base-200 border-b border-base-300">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-40">Admin View</p>
              <p className="text-sm font-black">Recent Subscriptions</p>
            </div>
            <div className="flex items-center gap-2">
              {subLoading && <RefreshCw size={13} className="animate-spin opacity-40" />}
              <button onClick={() => setSubPage(p => Math.max(1, p - 1))} disabled={subPage === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-base-300" style={{ opacity: subPage === 1 ? 0.35 : 1 }}>
                <ChevronDown size={12} />
              </button>
              <span className="text-xs font-black opacity-50">pg {subPage}</span>
              <button onClick={() => setSubPage(p => p + 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-base-300">
                <ChevronUp size={12} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-base-300 bg-base-200">
                  {['User', 'Plan', 'Status', 'Expiry', 'Auto-Renew'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-black uppercase tracking-widest opacity-40">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.slice(0, 8).map((s, i) => {
                  const statusColors = { Active: '#10b981', Trial: '#f59e0b', Cancelled: '#6b7280', Expired: '#ef4444' };
                  const sc = statusColors[s.status] || '#6b7280';
                  return (
                    <motion.tr key={s._id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-base-300"
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--base-200)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-5 py-3.5 font-semibold">{s.user?.name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-black" style={{ color: getTier(s.plan?.fixedTier || s.plan?.name || '').accent }}>
                          {s.plan?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-black px-2.5 py-1 rounded-full text-[10px]"
                          style={{ background: `${sc}18`, color: sc }}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium opacity-60">
                        {s.expiryDate ? new Date(s.expiryDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-black text-[10px]" style={{ color: s.autoRenew ? '#10b981' : '#6b7280' }}>
                          {s.autoRenew ? '✓ On' : '✗ Off'}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Modals & Drawers ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedPlan && (
          <PlanModal
            plan={selectedPlan}
            onClose={() => setSelectedPlan(null)}
            onEdit={(p) => { setSelectedPlan(null); handleOpenDrawer(p); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCron && (
          <CronPanel onClose={() => setShowCron(false)} />
        )}
      </AnimatePresence>

      <PlanDrawer
        isOpen={isDrawerOpen}
        editingPlan={editingPlan}
        onClose={() => setIsDrawerOpen(false)}
        onSubmit={handleSubmit}
        loading={mutateLoading}
      />
    </div>
  );
};

export default SubscriptionManagement;