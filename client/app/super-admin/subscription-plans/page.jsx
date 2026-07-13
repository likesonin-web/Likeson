"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, useSpring, useTransform, useInView } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Plus, Search, Grid, LayoutList, Trash2, Edit3,
  Stethoscope, Truck, Pill, X, HeartPulse,
  CheckCircle2, IndianRupee, Minus, Activity,
  Zap, Crown, Star, Settings, Package, Clock, BadgeCheck,
  FlaskConical, Percent, Sparkles, TrendingUp,
  TrendingDown, Users, Shield, RefreshCw,
  AlertTriangle, Bell, Eye,
  Layers, Target, BarChart2, PieChart as PieChartIcon,
  Microscope, Home, Filter,
  ChevronDown, ChevronUp, Info, Flame, Rocket, Award,
  CreditCard, CheckSquare, Globe, Baby, Briefcase,
  Hash, AlignLeft, ToggleLeft, ToggleRight, Phone,
  MapPin, Calendar, Truck as TruckIcon, Syringe,
} from 'lucide-react';

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
//  NOTE ON CARE ASSISTANT
//  Fixed plans (the 6 admin-authored catalog tiers managed on this page) carry
//  NO Care Assistant subscription benefit or quota — SubscriptionPlan.js keeps
//  those schema fields for legacy display only, and every CA booking on a
//  fixed plan is charged at the platform rate at booking time.
//  Care Assistant quota/pricing is configured EXCLUSIVELY on per-customer
//  Custom Plans (via customOptions[]), which are built by customers through
//  the subscription flow — never through this admin route
//  (POST/PUT /subscriptions/admin/plans always forces planType: 'fixed').
//  Accordingly, this component has no Care Assistant fields, pills, or rows.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  TIER CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const TIER = {
  'Basic Care':           { accent: '#3b82f6', rank: 1, icon: Shield,    tag: 'Starter',   tagline: 'Essential individual coverage',  gradFrom: '#3b82f6', gradTo: '#1d4ed8' },
  'Standard Care':        { accent: '#0ea5e9', rank: 2, icon: BadgeCheck, tag: 'Standard',  tagline: 'Upgraded everyday coverage',     gradFrom: '#0ea5e9', gradTo: '#0284c7' },
  'Premium Care':         { accent: '#8b5cf6', rank: 3, icon: Crown,     tag: 'Popular',   tagline: 'Top-tier comprehensive care',    gradFrom: '#8b5cf6', gradTo: '#6d28d9' },
  'Family Care':          { accent: '#10b981', rank: 4, icon: Users,     tag: 'Best Value',tagline: 'Complete family protection',     gradFrom: '#10b981', gradTo: '#059669' },
  'Pregnant Women Care':  { accent: '#f59e0b', rank: 5, icon: HeartPulse,tag: 'Maternity', tagline: 'Dedicated maternity support',    gradFrom: '#f59e0b', gradTo: '#d97706' },
  "NRI's Care":           { accent: '#ef4444', rank: 6, icon: Rocket,    tag: 'Global',    tagline: 'Cross-border healthcare',        gradFrom: '#ef4444', gradTo: '#dc2626' },
};
const getTier = (name) => TIER[name] || TIER['Basic Care'];

const SUPPORT_BADGE = {
  'Standard':            { bg: 'bg-blue-500/10',   text: 'text-blue-500',   label: 'Standard' },
  'Priority':            { bg: 'bg-amber-500/10',  text: 'text-amber-500',  label: 'Priority' },
  'Dedicated Executive': { bg: 'bg-violet-500/10', text: 'text-violet-500', label: 'VIP Exec' },
  '24/7 Service':        { bg: 'bg-red-500/10',    text: 'text-red-500',    label: '24/7' },
};

const STATUS_COLORS = {
  Active:    { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  Trial:     { bg: 'bg-amber-500/10',   text: 'text-amber-500'   },
  Paused:    { bg: 'bg-blue-500/10',    text: 'text-blue-500'    },
  Cancelled: { bg: 'bg-zinc-500/10',    text: 'text-zinc-400'    },
  Expired:   { bg: 'bg-red-500/10',     text: 'text-red-500'     },
};

const PLAN_NAMES = ['Basic Care', 'Standard Care', 'Premium Care', 'Family Care', 'Pregnant Women Care', "NRI's Care"];

// ─────────────────────────────────────────────────────────────────────────────
//  ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24, scale: 0.97 },
  visible: (i = 0) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.055, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.065, delayChildren: 0.04 } } };

// ─────────────────────────────────────────────────────────────────────────────
//  ANIMATED NUMBER
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const spring = useSpring(0, { stiffness: 55, damping: 18 });
  const display = useTransform(spring, v => {
    const n = decimals > 0 ? v.toFixed(decimals) : Math.round(v);
    return `${prefix}${Number(n).toLocaleString('en-IN')}${suffix}`;
  });
  useEffect(() => { if (inView) spring.set(value); }, [inView, value, spring]);
  return <motion.span ref={ref}>{display}</motion.span>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CHART TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl px-4 py-2.5 shadow-xl min-w-[110px]">
      {label && <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 mb-0.5">
          <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-xs font-bold text-base-content">
            {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  TOGGLE SWITCH
// ─────────────────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, desc }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-base-300 last:border-b-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-xs font-bold text-base-content">{label}</p>
        {desc && <p className="text-[10px] text-base-content/40 mt-0.5 leading-snug">{desc}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 rounded-full transition-all duration-300 w-11 h-6 ${checked ? 'bg-primary shadow-[0_0_12px_color-mix(in_srgb,var(--primary),transparent_45%)]' : 'bg-base-300'}`}
      >
        <motion.div
          animate={{ x: checked ? 20 : 2 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
        />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEPPER INPUT
// ─────────────────────────────────────────────────────────────────────────────
function Stepper({ label, desc, value, onChange, min = 0, max = 100, suffix }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{label}</label>
      {desc && <p className="text-[10px] text-base-content/40 leading-snug">{desc}</p>}
      <div className="flex items-center border border-base-300 rounded-xl overflow-hidden">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="w-9 h-9 flex items-center justify-center bg-base-200 hover:bg-base-300 transition-colors flex-shrink-0 text-base-content/60">
          <Minus size={11} />
        </button>
        <input type="number" value={value}
          onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
          className="flex-1 text-center text-sm font-black bg-base-100 outline-none py-2 text-base-content border-x border-base-300" />
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))}
          className="w-9 h-9 flex items-center justify-center bg-base-200 hover:bg-base-300 transition-colors flex-shrink-0 text-base-content/60">
          <Plus size={11} />
        </button>
      </div>
      {suffix && <p className="text-[9px] font-bold uppercase tracking-wider text-base-content/30">{suffix}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEXT INPUT
// ─────────────────────────────────────────────────────────────────────────────
function TxtInput({ label, desc, value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{label}</label>
      {desc && <p className="text-[10px] text-base-content/40 leading-snug">{desc}</p>}
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="input-field w-full text-sm"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION LABEL
// ─────────────────────────────────────────────────────────────────────────────
function SLabel({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={12} className="text-primary flex-shrink-0" />}
      <p className="text-[10px] font-black uppercase tracking-widest text-base-content/40">{children}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FORM DEFAULT + FLATTEN + UNFLATTEN
//  Fixed-plan fields ONLY. Care Assistant intentionally omitted — it is not
//  part of the fixed-plan benefit set (see note near top of file).
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_FORM = () => ({
  // Identity
  name: 'Basic Care',
  fixedTier: 'Basic Care',
  slug: '',
  description: '',
  planType: 'fixed',
  visibleToCustomerOnly: false,
  idealFor: '',
  isActive: true,
  isFeatured: false,
  badgeLabel: '',
  displayOrder: 1,
  // Pricing
  'pricing.monthly': 299,
  'pricing.billingCycle': 'monthly',
  'pricing.billingLabel': '/month',
  'pricing.currency': 'INR',
  // Free Trial
  'freeTrial.enabled': true,
  'freeTrial.durationDays': 7,
  'freeTrial.requiresPaymentMethod': false,
  // Membership
  'membership.maxMembers': 1,
  'membership.membershipNote': '',
  // Consultations
  'consultations.freePerMonth': 2,
  'consultations.modes.inPerson': true,
  'consultations.modes.video': false,
  'consultations.modes.home': false,
  'consultations.onlineModeAllowed': false,
  'consultations.specialNote': '',
  // Pharmacy
  'pharmacy.discountMin': 0,
  'pharmacy.discountMax': 0,
  'pharmacy.isFlat': false,
  'pharmacy.specialOffer': '',
  'pharmacy.deliveryChargePerOrder': '',
  'pharmacy.deliveryNote': '',
  // Diagnostics
  'diagnostics.discountPercent': 0,
  'diagnostics.isApplicable': true,
  'diagnostics.homeSampleCollection': false,   // ONE-TIME benefit per cycle
  // Transport
  'transport.ratePerKm': '',
  'transport.isApplicable': true,
  'transport.ridesPerMonth': 0,
  // Support
  'support.tier': 'Standard',
  'support.priorityAppointmentScheduling': false,
  // Features
  'features.noHiddenCharges': true,
  'features.monthlyHealthSummary': false,
  'features.noCancellationCharges': false,
  'features.autoRefillReminders': false,
  'features.digitalReportAccess': false,
  'features.additionalFeatures': '',
});

function flattenPlan(plan) {
  if (!plan) return DEFAULT_FORM();
  return {
    name: plan.name ?? 'Basic Care',
    fixedTier: plan.fixedTier ?? plan.name ?? 'Basic Care',
    slug: plan.slug ?? '',
    description: plan.description ?? '',
    planType: plan.planType ?? 'fixed',
    visibleToCustomerOnly: plan.visibleToCustomerOnly ?? false,
    idealFor: plan.idealFor ?? '',
    isActive: plan.isActive ?? true,
    isFeatured: plan.isFeatured ?? false,
    badgeLabel: plan.badgeLabel ?? '',
    displayOrder: plan.displayOrder ?? 1,
    'pricing.monthly': plan.pricing?.monthly ?? 299,
    'pricing.billingCycle': plan.pricing?.billingCycle ?? 'monthly',
    'pricing.billingLabel': plan.pricing?.billingLabel ?? '/month',
    'pricing.currency': plan.pricing?.currency ?? 'INR',
    'freeTrial.enabled': plan.freeTrial?.enabled ?? true,
    'freeTrial.durationDays': plan.freeTrial?.durationDays ?? 7,
    'freeTrial.requiresPaymentMethod': plan.freeTrial?.requiresPaymentMethod ?? false,
    'membership.maxMembers': plan.membership?.maxMembers ?? 1,
    'membership.membershipNote': plan.membership?.membershipNote ?? '',
    'consultations.freePerMonth': plan.consultations?.freePerMonth ?? 0,
    'consultations.modes.inPerson': plan.consultations?.modes?.inPerson ?? true,
    'consultations.modes.video': plan.consultations?.modes?.video ?? false,
    'consultations.modes.home': plan.consultations?.modes?.home ?? false,
    'consultations.onlineModeAllowed': plan.consultations?.onlineModeAllowed ?? false,
    'consultations.specialNote': plan.consultations?.specialNote ?? '',
    'pharmacy.discountMin': plan.pharmacy?.discountMin ?? 0,
    'pharmacy.discountMax': plan.pharmacy?.discountMax ?? 0,
    'pharmacy.isFlat': plan.pharmacy?.isFlat ?? false,
    'pharmacy.specialOffer': plan.pharmacy?.specialOffer ?? '',
    'pharmacy.deliveryChargePerOrder': plan.pharmacy?.deliveryChargePerOrder ?? '',
    'pharmacy.deliveryNote': plan.pharmacy?.deliveryNote ?? '',
    'diagnostics.discountPercent': plan.diagnostics?.discountPercent ?? 0,
    'diagnostics.isApplicable': plan.diagnostics?.isApplicable ?? true,
    'diagnostics.homeSampleCollection': plan.diagnostics?.homeSampleCollection ?? false,
    'transport.ratePerKm': plan.transport?.ratePerKm ?? '',
    'transport.isApplicable': plan.transport?.isApplicable ?? true,
    'transport.ridesPerMonth': plan.transport?.ridesPerMonth ?? 0,
    'support.tier': plan.support?.tier ?? 'Standard',
    'support.priorityAppointmentScheduling': plan.support?.priorityAppointmentScheduling ?? false,
    'features.noHiddenCharges': plan.features?.noHiddenCharges ?? true,
    'features.monthlyHealthSummary': plan.features?.monthlyHealthSummary ?? false,
    'features.noCancellationCharges': plan.features?.noCancellationCharges ?? false,
    'features.autoRefillReminders': plan.features?.autoRefillReminders ?? false,
    'features.digitalReportAccess': plan.features?.digitalReportAccess ?? false,
    'features.additionalFeatures': (plan.features?.additionalFeatures ?? []).join(', '),
  };
}

function unflattenForm(f) {
  const slug = f.slug || f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/'/g, '');
  return {
    name: f.name,
    fixedTier: f.name,
    slug,
    description: f.description,
    planType: f.planType,
    visibleToCustomerOnly: f.visibleToCustomerOnly,
    idealFor: f.idealFor,
    isActive: f.isActive,
    isFeatured: f.isFeatured,
    badgeLabel: f.badgeLabel,
    displayOrder: Number(f.displayOrder),
    pricing: {
      monthly: Number(f['pricing.monthly']),
      billingCycle: f['pricing.billingCycle'],
      billingLabel: f['pricing.billingLabel'],
      currency: f['pricing.currency'],
    },
    freeTrial: {
      enabled: f['freeTrial.enabled'],
      durationDays: Number(f['freeTrial.durationDays']),
      requiresPaymentMethod: f['freeTrial.requiresPaymentMethod'],
    },
    membership: {
      maxMembers: Number(f['membership.maxMembers']),
      membershipNote: f['membership.membershipNote'],
    },
    consultations: {
      freePerMonth: Number(f['consultations.freePerMonth']),
      onlineModeAllowed: f['consultations.onlineModeAllowed'],
      specialNote: f['consultations.specialNote'],
      modes: {
        inPerson: f['consultations.modes.inPerson'],
        video: f['consultations.modes.video'],
        home: f['consultations.modes.home'],
      },
    },
    pharmacy: {
      discountMin: Number(f['pharmacy.discountMin']),
      discountMax: Number(f['pharmacy.discountMax']),
      isFlat: f['pharmacy.isFlat'],
      specialOffer: f['pharmacy.specialOffer'],
      deliveryNote: f['pharmacy.deliveryNote'],
      deliveryChargePerOrder: f['pharmacy.deliveryChargePerOrder'] === '' ? null : Number(f['pharmacy.deliveryChargePerOrder']),
    },
    diagnostics: {
      discountPercent: Number(f['diagnostics.discountPercent']),
      isApplicable: f['diagnostics.isApplicable'],
      // HOME SAMPLE COLLECTION: one-time free per billing cycle.
      // homeCollectionUsedOnce flag tracked in UserSubscription.limits.
      // This field marks plan includes it — reset happens on subscription renewal.
      homeSampleCollection: f['diagnostics.homeSampleCollection'],
    },
    transport: {
      ratePerKm: f['transport.ratePerKm'] === '' ? null : Number(f['transport.ratePerKm']),
      isApplicable: f['transport.isApplicable'],
      ridesPerMonth: Number(f['transport.ridesPerMonth'] || 0),
    },
    support: {
      tier: f['support.tier'],
      priorityAppointmentScheduling: f['support.priorityAppointmentScheduling'],
    },
    features: {
      noHiddenCharges: f['features.noHiddenCharges'],
      monthlyHealthSummary: f['features.monthlyHealthSummary'],
      noCancellationCharges: f['features.noCancellationCharges'],
      autoRefillReminders: f['features.autoRefillReminders'],
      digitalReportAccess: f['features.digitalReportAccess'],
      additionalFeatures: f['features.additionalFeatures'].split(',').map(s => s.trim()).filter(Boolean),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN CARD
// ─────────────────────────────────────────────────────────────────────────────
function PlanCard({ plan, onEdit, onDelete, onClick, index, viewMode }) {
  const t = getTier(plan.fixedTier || plan.name);
  const TIcon = t.icon;
  const support = SUPPORT_BADGE[plan.support?.tier] || SUPPORT_BADGE['Standard'];
  const monthly = plan.pricing?.monthly ?? 0;
  const consults = plan.consultations?.freePerMonth ?? 0;
  const pharmDisc = plan.pharmacy?.discountMax ?? 0;
  const diagDisc = plan.diagnostics?.discountPercent ?? 0;
  const maxMembers = plan.membership?.maxMembers ?? 1;
  const homeSample = plan.diagnostics?.homeSampleCollection ?? false;
  const hasTransport = plan.transport?.isApplicable ?? false;
  const ratePerKm = plan.transport?.ratePerKm ?? null;

  const pills = [
    { icon: Stethoscope, val: consults === -1 ? '∞' : `${consults}/mo`, active: consults !== 0, label: 'Consult' },
    { icon: Pill,        val: `${pharmDisc}%`,  active: pharmDisc > 0,  label: 'Pharma'  },
    { icon: Microscope,  val: `${diagDisc}%`,   active: diagDisc > 0,   label: 'Diag'    },
    { icon: Home,        val: homeSample ? '1×/cycle' : '—', active: homeSample, label: 'HomeLab' },
    { icon: Users,       val: maxMembers, active: true, label: 'Members'    },
  ];

  if (viewMode === 'compact') {
    return (
      <motion.div
        layout custom={index} variants={fadeUp} initial="hidden" animate="visible"
        whileHover={{ backgroundColor: 'color-mix(in srgb, var(--base-200) 100%, transparent)' }}
        onClick={onClick}
        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer border-b border-base-300 last:border-b-0 transition-colors"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})` }}>
          <TIcon size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-base-content truncate">{plan.name}</p>
          <p className="text-[10px] text-base-content/40 truncate">{t.tagline}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${support.bg} ${support.text}`}>
            {support.label}
          </span>
          <span className="text-sm font-black" style={{ color: t.accent }}>₹{monthly}</span>
          <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
            <button onClick={() => onEdit(plan)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
              <Edit3 size={12} />
            </button>
            <button onClick={() => onDelete(plan._id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-error hover:bg-error/10 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout custom={index} variants={fadeUp} initial="hidden" animate="visible"
      whileHover={{ y: -5, scale: 1.005 }}
      onClick={onClick}
      className="relative cursor-pointer overflow-hidden flex flex-col rounded-2xl border border-base-300 bg-base-100 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-primary"
    >
      {/* Gradient header */}
      <div className="relative h-28 flex items-end p-4 overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})` }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
          className="absolute -right-8 -top-8 w-28 h-28 rounded-full border-[20px] border-white/5 pointer-events-none" />
        <div className="relative z-10 w-full flex items-end justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-white/20 backdrop-blur-sm">
                <TIcon size={12} className="text-white" />
              </div>
              <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">{t.tag}</span>
            </div>
            <h4 className="text-base font-black text-white leading-none">{plan.name}</h4>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-white/40 uppercase font-bold mb-0.5">/mo</p>
            <p className="text-xl font-black text-white leading-none">₹{monthly}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${support.bg} ${support.text}`}>
            {support.label}
          </span>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-base-200 text-base-content/60">
            <Users size={8} className="inline mr-0.5" />{maxMembers} {maxMembers === 1 ? 'member' : 'members'}
          </span>
          {!plan.isActive && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-error/10 text-error">Inactive</span>
          )}
          {plan.isFeatured && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
              <Star size={8} className="inline mr-0.5" />Featured
            </span>
          )}
          {plan.badgeLabel && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{plan.badgeLabel}</span>
          )}
        </div>

        {/* Benefits grid */}
        <div className="grid grid-cols-3 gap-1.5">
          {pills.map((b, i) => (
            <div key={i} className={`flex flex-col items-center gap-0.5 py-2 rounded-xl transition-colors ${b.active ? 'bg-primary/8' : 'bg-base-200 opacity-30'}`}>
              <b.icon size={11} style={{ color: b.active ? t.accent : 'inherit' }} />
              <span className="text-[10px] font-black" style={{ color: b.active ? t.accent : 'inherit' }}>{b.val}</span>
              <span className="text-[7px] font-bold uppercase text-base-content/40">{b.label}</span>
            </div>
          ))}
        </div>

        {/* Home sample note */}
        {homeSample && (
          <div className="flex items-start gap-1.5 p-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
            <Home size={10} className="text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-[9px] text-emerald-500 font-bold leading-snug">
              Home sample collection: 1 free use per billing cycle. Resets on renewal.
            </p>
          </div>
        )}

        {/* Transport info */}
        {hasTransport && ratePerKm && (
          <div className="flex items-center gap-1.5">
            <Truck size={10} className="text-base-content/30 flex-shrink-0" />
            <span className="text-[9px] text-base-content/40 font-semibold">₹{ratePerKm}/km transport rate</span>
          </div>
        )}

        {/* Meta */}
        <p className="text-[9px] text-base-content/35 font-semibold">
          {plan.pricing?.billingLabel || '/month'} · {plan.freeTrial?.enabled ? `${plan.freeTrial.durationDays}d trial` : 'No trial'}
          {plan.pricing?.billingCycle === 'till_delivery' ? ' · Till Delivery' : ''}
        </p>

        {/* Actions */}
        <div className="flex gap-1.5 mt-auto pt-3 border-t border-base-300" onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(plan)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-base-200 text-base-content hover:bg-primary/10 hover:text-primary transition-colors">
            <Edit3 size={11} /> Edit
          </button>
          <button onClick={() => onDelete(plan._id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-base-200 text-base-content/50 hover:bg-error/10 hover:text-error transition-colors flex-shrink-0">
            <Trash2 size={11} />
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
    { icon: Stethoscope, label: 'Consultation Modes', val: [plan.consultations?.modes?.inPerson && 'In-Person', plan.consultations?.modes?.video && 'Video', plan.consultations?.modes?.home && 'Home'].filter(Boolean).join(', ') || 'None', active: true },
    { icon: Pill,        label: 'Pharmacy Discount',   val: plan.pharmacy?.isFlat ? `Flat ${plan.pharmacy.discountMax}%` : `${plan.pharmacy?.discountMin ?? 0}–${plan.pharmacy?.discountMax ?? 0}%`, active: (plan.pharmacy?.discountMax ?? 0) > 0 },
    { icon: Pill,        label: 'Delivery Charge',     val: plan.pharmacy?.deliveryChargePerOrder != null ? `₹${plan.pharmacy.deliveryChargePerOrder}` : 'Free', active: true },
    { icon: Microscope,  label: 'Diagnostic Discount', val: `${plan.diagnostics?.discountPercent ?? 0}%`, active: (plan.diagnostics?.discountPercent ?? 0) > 0 },
    { icon: Home,        label: 'Home Sample Collection', val: plan.diagnostics?.homeSampleCollection ? '1× free per billing cycle' : 'Not included', active: plan.diagnostics?.homeSampleCollection ?? false },
    { icon: Truck,       label: 'Transport Rate',      val: plan.transport?.isApplicable ? (plan.transport?.ratePerKm ? `₹${plan.transport.ratePerKm}/km` : 'N/A') : 'Not applicable', active: plan.transport?.isApplicable ?? false },
    { icon: Truck,       label: 'Rides/Month',         val: plan.transport?.ridesPerMonth ? `${plan.transport.ridesPerMonth} rides` : 'Unlimited', active: plan.transport?.isApplicable ?? false },
    { icon: Users,       label: 'Max Members',         val: `${plan.membership?.maxMembers ?? 1} member(s)`, active: true },
    { icon: Clock,       label: 'Free Trial',          val: plan.freeTrial?.enabled ? `${plan.freeTrial.durationDays} days` : 'Not available', active: plan.freeTrial?.enabled ?? false },
    { icon: BadgeCheck,  label: 'Support Tier',        val: plan.support?.tier ?? 'Standard', active: true },
  ];

  const flags = [
    { label: 'No Hidden Charges',        val: plan.features?.noHiddenCharges },
    { label: 'Monthly Health Summary',   val: plan.features?.monthlyHealthSummary },
    { label: 'No Cancellation Charges',  val: plan.features?.noCancellationCharges },
    { label: 'Auto Refill Reminders',    val: plan.features?.autoRefillReminders },
    { label: 'Digital Report Access',    val: plan.features?.digitalReportAccess },
    { label: 'Priority Appt Scheduling', val: plan.support?.priorityAppointmentScheduling },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-xl" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 28 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 28 }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-[0_48px_96px_rgba(0,0,0,0.35)]"
      >
        {/* Header */}
        <div className="relative h-36 flex items-end p-6 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})` }}>
          <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.06, 0.11, 0.06] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 bg-[radial-gradient(circle_at_80%_30%,white_0%,transparent_60%)]" />
          <div className="relative z-10 flex items-end justify-between w-full">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-sm">
                  <TIcon size={18} className="text-white" />
                </div>
                <span className="text-[10px] font-black text-white/55 uppercase tracking-widest">Tier {t.rank}</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${support.bg} ${support.text}`}>
                  {support.label}
                </span>
              </div>
              <h2 className="text-2xl font-black text-white leading-none">{plan.name}</h2>
              <p className="text-white/45 text-[11px] mt-0.5">{t.tagline}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/35 uppercase font-bold mb-0.5">Monthly</p>
              <p className="text-3xl font-black text-white leading-none">₹{plan.pricing?.monthly ?? 0}</p>
              <p className="text-white/35 text-[10px] mt-0.5">{plan.pricing?.billingLabel || '/month'}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center text-white bg-white/15 hover:bg-white/25 transition-colors z-20">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid md:grid-cols-2 gap-5 max-h-[58vh] overflow-y-auto">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-3">Service Details</p>
            <div className="space-y-0">
              {rows.map((r, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`flex items-center gap-2.5 py-2 border-b border-base-300 last:border-b-0 ${r.active ? '' : 'opacity-25'}`}>
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${r.active ? 'bg-primary/10' : 'bg-base-300'}`}>
                    <r.icon size={11} style={{ color: r.active ? t.accent : 'inherit' }} />
                  </div>
                  <span className="text-[11px] font-semibold flex-1 text-base-content/70">{r.label}</span>
                  <span className="text-[11px] font-black" style={{ color: r.active ? t.accent : 'inherit' }}>{r.val}</span>
                </motion.div>
              ))}
            </div>

            {/* Home collection note */}
            {plan.diagnostics?.homeSampleCollection && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
                <p className="text-[10px] text-emerald-500 font-bold leading-snug">
                  ⚠ Home collection is a ONE-TIME benefit per billing cycle.
                  The <code className="font-mono text-[9px]">homeCollectionUsedOnce</code> flag
                  in UserSubscription resets on renewal.
                </p>
              </div>
            )}

            {/* Care Assistant note — fixed plans never carry this benefit */}
            <div className="mt-3 p-2.5 rounded-xl bg-base-200 border border-base-300">
              <p className="text-[10px] text-base-content/40 font-semibold leading-snug">
                Care Assistant isn't part of fixed plans. Bookings on this tier are charged the
                platform rate at booking time — CA quotas only exist on customer-built Custom Plans.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Feature flags */}
            <div className="rounded-xl p-3.5 bg-base-200 border border-base-300">
              <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-2.5">Feature Flags</p>
              {flags.map((f, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="text-[11px] font-medium text-base-content/55">{f.label}</span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${f.val ? 'bg-primary/10 text-primary' : 'bg-base-300 text-base-content/25'}`}>
                    {f.val ? '✓ Yes' : '✗ No'}
                  </span>
                </div>
              ))}
            </div>

            {/* Additional features */}
            {plan.features?.additionalFeatures?.length > 0 && (
              <div className="rounded-xl p-3.5 bg-base-200 border border-base-300">
                <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-2.5">Extra Perks</p>
                {plan.features.additionalFeatures.map((f, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-2 mb-1.5">
                    <CheckCircle2 size={11} style={{ color: t.accent }} className="flex-shrink-0 mt-0.5" />
                    <span className="text-[11px] font-medium text-base-content/65">{f}</span>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Description / idealFor */}
            {(plan.description || plan.idealFor) && (
              <div className="rounded-xl p-3.5 bg-base-200 border border-base-300 space-y-2">
                {plan.description && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-1">Description</p>
                    <p className="text-[11px] text-base-content/55 leading-snug">{plan.description}</p>
                  </div>
                )}
                {plan.idealFor && (
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-1">Ideal For</p>
                    <p className="text-[11px] text-base-content/55 leading-snug">{plan.idealFor}</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto flex gap-2">
              <button onClick={() => { onClose(); onEdit(plan); }}
                className="btn-primary-cta flex-1 flex items-center justify-center gap-2 !text-xs">
                <Edit3 size={12} /> Edit Plan
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN DRAWER TABS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'identity',  label: 'Identity',   icon: Sparkles    },
  { id: 'pricing',   label: 'Pricing',    icon: CreditCard  },
  { id: 'benefits',  label: 'Benefits',   icon: Zap         },
  { id: 'services',  label: 'Services',   icon: Stethoscope },
  { id: 'features',  label: 'Features',   icon: CheckSquare },
  { id: 'display',   label: 'Display',    icon: Eye         },
];

// ─────────────────────────────────────────────────────────────────────────────
//  PLAN DRAWER
// ─────────────────────────────────────────────────────────────────────────────
function PlanDrawer({ isOpen, editingPlan, onClose, onSubmit, loading }) {
  const [form, setForm] = useState(DEFAULT_FORM());
  const [tab, setTab] = useState('identity');
  const t = getTier(form.name);

  useEffect(() => {
    setForm(flattenPlan(editingPlan));
    setTab('identity');
  }, [editingPlan, isOpen]);

  const set = useCallback((key, val) => setForm(f => ({ ...f, [key]: val })), []);
  const handleSubmit = () => onSubmit(unflattenForm(form));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-lg" onClick={onClose} />

          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 h-screen w-full max-w-[520px] z-[101] flex flex-col bg-base-100 border-l border-base-300 shadow-[-32px_0_80px_rgba(0,0,0,0.28)]"
          >
            {/* Header */}
            <div className="relative overflow-hidden flex-shrink-0 px-6 py-5"
              style={{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})` }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 55, repeat: Infinity, ease: 'linear' }}
                className="absolute -right-14 -top-14 w-44 h-44 rounded-full border-[28px] border-white/5 pointer-events-none" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-white/45 uppercase tracking-widest mb-0.5">
                    {editingPlan ? 'Editing Plan' : 'New Care Tier'}
                  </p>
                  <h2 className="text-lg font-black text-white leading-tight">{form.name}</h2>
                  <p className="text-white/40 text-[10px] mt-0.5">₹{form['pricing.monthly']}/mo · {form['pricing.billingCycle']}</p>
                </div>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white bg-white/15 hover:bg-white/25 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-shrink-0 bg-base-200 border-b border-base-300 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2.5 text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-b-2 flex-shrink-0 ${
                    tab === id
                      ? 'text-primary border-primary bg-primary/5'
                      : 'text-base-content/40 border-transparent hover:text-base-content/70'
                  }`}>
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              <AnimatePresence mode="wait">

                {/* ── IDENTITY ── */}
                {tab === 'identity' && (
                  <motion.div key="identity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                    <SLabel icon={Sparkles}>Plan Tier</SLabel>
                    <div className="grid grid-cols-1 gap-2">
                      {PLAN_NAMES.map(name => {
                        const tc = getTier(name);
                        const PIcon = tc.icon;
                        return (
                          <button key={name} type="button"
                            onClick={() => { set('name', name); set('fixedTier', name); }}
                            className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all border-2 ${
                              form.name === name
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-base-300 bg-base-200 hover:border-primary/40'
                            }`}>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: `linear-gradient(135deg, ${tc.gradFrom}, ${tc.gradTo})` }}>
                              <PIcon size={13} className="text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-base-content">{name}</p>
                              <p className="text-[9px] text-base-content/40">{tc.tagline}</p>
                            </div>
                            {form.name === name && <CheckCircle2 size={14} style={{ color: tc.accent }} />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-3">
                      <TxtInput label="URL Slug" desc="Auto-generated if empty (e.g., basic-care)"
                        value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="basic-care" />
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Description</label>
                        <textarea rows={3} placeholder="Brief plan summary…"
                          value={form.description} onChange={e => set('description', e.target.value)}
                          className="input-field w-full text-sm resize-none" />
                      </div>
                      <TxtInput label="Ideal For" desc="Target demographic text"
                        value={form.idealFor} onChange={e => set('idealFor', e.target.value)}
                        placeholder="Expecting mothers, NRI families…" />
                      <Toggle label="Custom Plan Type"
                        desc="Leave off — this drawer creates the 6 standard admin tiers only. Custom plans are built by customers through the subscription flow, not here."
                        checked={form.planType === 'custom'} onChange={v => set('planType', v ? 'custom' : 'fixed')} />
                      <Toggle label="Visible to Customer Only"
                        desc="Hidden from global pricing page. Fixed plans should normally leave this off."
                        checked={form.visibleToCustomerOnly} onChange={v => set('visibleToCustomerOnly', v)} />
                    </div>
                  </motion.div>
                )}

                {/* ── PRICING ── */}
                {tab === 'pricing' && (
                  <motion.div key="pricing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-4">
                      <SLabel icon={CreditCard}>Pricing Strategy</SLabel>
                      <TxtInput label="Monthly Fee (₹)" desc="Base subscription price before coupons/trials."
                        type="number" value={form['pricing.monthly']}
                        onChange={e => set('pricing.monthly', e.target.value)} />
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-base-content/40">Billing Cycle</label>
                        <p className="text-[10px] text-base-content/40">Monthly for most; Till Delivery for maternity plans.</p>
                        <div className="flex gap-2">
                          {[['monthly', '/month'], ['till_delivery', 'Till Delivery'], ['custom', 'Custom']].map(([val, lbl]) => (
                            <button key={val} type="button"
                              onClick={() => { set('pricing.billingCycle', val); set('pricing.billingLabel', lbl); }}
                              className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                                form['pricing.billingCycle'] === val
                                  ? 'border-primary bg-primary/5 text-primary'
                                  : 'border-base-300 bg-base-100 text-base-content hover:border-primary/40'
                              }`}>
                              {val}
                            </button>
                          ))}
                        </div>
                      </div>
                      <TxtInput label="Billing Label" desc="UI text next to price (e.g., '/month')"
                        value={form['pricing.billingLabel']} onChange={e => set('pricing.billingLabel', e.target.value)} />
                      <TxtInput label="Currency" value={form['pricing.currency']}
                        onChange={e => set('pricing.currency', e.target.value)} />
                    </div>

                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-4">
                      <SLabel icon={Clock}>Free Trial</SLabel>
                      <Toggle label="Enable Free Trial" checked={form['freeTrial.enabled']}
                        onChange={v => set('freeTrial.enabled', v)} />
                      {form['freeTrial.enabled'] && (
                        <>
                          <Stepper label="Duration (days)" value={form['freeTrial.durationDays']}
                            onChange={v => set('freeTrial.durationDays', v)} min={1} max={30} />
                          <Toggle label="Requires Payment Method"
                            desc="Demand saved card/UPI before starting trial."
                            checked={form['freeTrial.requiresPaymentMethod']}
                            onChange={v => set('freeTrial.requiresPaymentMethod', v)} />
                        </>
                      )}
                    </div>

                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-4">
                      <SLabel icon={Users}>Membership</SLabel>
                      <Stepper label="Max Members" desc="1 individual · 4 Family Care · 2 NRI Care"
                        value={form['membership.maxMembers']} onChange={v => set('membership.maxMembers', v)} min={1} max={10} />
                      <TxtInput label="Membership Note" desc="E.g. 'Immediate family only'"
                        value={form['membership.membershipNote']}
                        onChange={e => set('membership.membershipNote', e.target.value)} />
                    </div>
                  </motion.div>
                )}

                {/* ── BENEFITS ── */}
                {tab === 'benefits' && (
                  <motion.div key="benefits" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                    {/* Consultations */}
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-4">
                      <SLabel icon={Stethoscope}>Doctor Consultations</SLabel>
                      <Stepper label="Free/month" desc="Use -1 for unlimited. 0 = none included."
                        value={form['consultations.freePerMonth']}
                        onChange={v => set('consultations.freePerMonth', v)} min={-1} max={99}
                        suffix="consultations per month" />
                      <div className="grid grid-cols-2 gap-0">
                        <Toggle label="In-Person" checked={form['consultations.modes.inPerson']}
                          onChange={v => set('consultations.modes.inPerson', v)} />
                        <Toggle label="Video Call" checked={form['consultations.modes.video']}
                          onChange={v => set('consultations.modes.video', v)} />
                        <Toggle label="Home Visit" checked={form['consultations.modes.home']}
                          onChange={v => set('consultations.modes.home', v)} />
                        <Toggle label="Online Mode Overall" checked={form['consultations.onlineModeAllowed']}
                          onChange={v => set('consultations.onlineModeAllowed', v)} />
                      </div>
                      <TxtInput label="Special Note" desc="UI display note for quota limits."
                        value={form['consultations.specialNote']}
                        onChange={e => set('consultations.specialNote', e.target.value)} />
                    </div>

                    {/* Pharmacy */}
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-4">
                      <SLabel icon={Pill}>Pharmacy (max 25% admin cap)</SLabel>
                      <div className="grid grid-cols-2 gap-4">
                        <Stepper label="Discount Min %" value={form['pharmacy.discountMin']}
                          onChange={v => set('pharmacy.discountMin', v)} min={0} max={25} />
                        <Stepper label="Discount Max %" value={form['pharmacy.discountMax']}
                          onChange={v => set('pharmacy.discountMax', v)} min={0} max={25} />
                      </div>
                      <Toggle label="Flat Discount" desc="Apply max % as flat rate (no range)"
                        checked={form['pharmacy.isFlat']} onChange={v => set('pharmacy.isFlat', v)} />
                      <TxtInput label="Delivery Charge (₹)" desc="Leave empty = free. 10 for Basic Care, etc."
                        type="number" value={form['pharmacy.deliveryChargePerOrder']}
                        onChange={e => set('pharmacy.deliveryChargePerOrder', e.target.value)}
                        placeholder="Leave empty = Free" />
                      <TxtInput label="Delivery Note" desc="E.g. 'Free Delivery'"
                        value={form['pharmacy.deliveryNote']}
                        onChange={e => set('pharmacy.deliveryNote', e.target.value)} />
                      <TxtInput label="Special Offer" desc="E.g. 'International e-Prescription' for NRI"
                        value={form['pharmacy.specialOffer']}
                        onChange={e => set('pharmacy.specialOffer', e.target.value)} />
                    </div>

                    {/* Diagnostics */}
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-4">
                      <SLabel icon={Microscope}>Diagnostics (max 25% admin cap)</SLabel>
                      <Toggle label="Diagnostics Applicable"
                        desc="Enables diagnostic perks for this tier."
                        checked={form['diagnostics.isApplicable']}
                        onChange={v => set('diagnostics.isApplicable', v)} />
                      {form['diagnostics.isApplicable'] && (
                        <>
                          <Stepper label="Discount %" desc="Admin cap enforced at 25%."
                            value={form['diagnostics.discountPercent']}
                            onChange={v => set('diagnostics.discountPercent', v)} min={0} max={25} />
                          <div className="space-y-2">
                            <Toggle label="Home Sample Collection"
                              desc="Includes one FREE home collection per billing cycle. The homeCollectionUsedOnce flag in UserSubscription tracks usage and resets on renewal."
                              checked={form['diagnostics.homeSampleCollection']}
                              onChange={v => set('diagnostics.homeSampleCollection', v)} />
                            {form['diagnostics.homeSampleCollection'] && (
                              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20">
                                <AlertTriangle size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                <p className="text-[10px] text-amber-500 font-semibold leading-snug">
                                  One-time per billing cycle. Backend sets <code className="font-mono text-[9px]">homeCollectionUsedOnce=true</code> after first use,
                                  resets to <code className="font-mono text-[9px]">false</code> on subscription renewal.
                                  Diagnostic booking route guards this via <code className="font-mono text-[9px]">POST /use-home-sample-collection</code>.
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ── SERVICES ── */}
                {tab === 'services' && (
                  <motion.div key="services" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                    {/* Transport */}
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-4">
                      <SLabel icon={Truck}>Transport</SLabel>
                      <Toggle label="Transport Applicable"
                        desc="Disable for NRI plan (no local transport)."
                        checked={form['transport.isApplicable']}
                        onChange={v => set('transport.isApplicable', v)} />
                      {form['transport.isApplicable'] && (
                        <div className="grid grid-cols-2 gap-4">
                          <TxtInput label="Rate (₹/km)" desc="Leave empty = N/A." type="number"
                            value={form['transport.ratePerKm']}
                            onChange={e => set('transport.ratePerKm', e.target.value)}
                            placeholder="e.g. 18" />
                          <Stepper label="Rides/month" desc="0 = unlimited." value={form['transport.ridesPerMonth']}
                            onChange={v => set('transport.ridesPerMonth', v)} min={0} max={50} />
                        </div>
                      )}
                    </div>

                    {/* Support */}
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-3">
                      <SLabel icon={BadgeCheck}>Support Tier</SLabel>
                      {['Standard', 'Priority', 'Dedicated Executive', '24/7 Service'].map(tier => {
                        const sb = SUPPORT_BADGE[tier];
                        return (
                          <button key={tier} type="button"
                            onClick={() => set('support.tier', tier)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl text-left border-2 transition-all ${
                              form['support.tier'] === tier
                                ? `border-current ${sb.text}`
                                : 'border-base-300 bg-base-100 text-base-content hover:border-primary/40'
                            }`}>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${sb.bg} ${sb.text}`}>
                              {sb.label}
                            </span>
                            <span className="text-xs font-bold flex-1">{tier}</span>
                            {form['support.tier'] === tier && <CheckCircle2 size={13} className={sb.text} />}
                          </button>
                        );
                      })}
                      <Toggle label="Priority Appointment Scheduling"
                        desc="Fast-tracked slot booking for this plan tier."
                        checked={form['support.priorityAppointmentScheduling']}
                        onChange={v => set('support.priorityAppointmentScheduling', v)} />
                    </div>

                    {/* Care Assistant — informational only, not editable here */}
                    <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-base-200 border border-base-300">
                      <Info size={13} className="text-base-content/35 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-base-content/40 leading-snug">
                        Care Assistant isn't configured here. Fixed plans have no CA quota or benefit —
                        every CA booking on a fixed tier is charged the platform rate at booking time.
                        CA quotas are set per-customer on Custom Plans only.
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* ── FEATURES ── */}
                {tab === 'features' && (
                  <motion.div key="features" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300">
                      <SLabel icon={CheckSquare}>Feature Flags</SLabel>
                      {[
                        { key: 'features.noHiddenCharges',       label: 'No Hidden Charges',        desc: 'All charges fully disclosed upfront' },
                        { key: 'features.monthlyHealthSummary',  label: 'Monthly Health Summary',   desc: 'Auto-generated health report each month' },
                        { key: 'features.noCancellationCharges', label: 'No Cancellation Charges',  desc: 'Cancel anytime at zero cost' },
                        { key: 'features.autoRefillReminders',   label: 'Auto Refill Reminders',    desc: 'Push notifications for medicine refills' },
                        { key: 'features.digitalReportAccess',   label: 'Digital Report Access',    desc: 'All reports stored digitally in-app' },
                      ].map(({ key, label, desc }) => (
                        <Toggle key={key} label={label} desc={desc}
                          checked={form[key]} onChange={v => set(key, v)} />
                      ))}
                    </div>
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-2">
                      <SLabel icon={AlignLeft}>Additional Custom Perks</SLabel>
                      <p className="text-[10px] text-base-content/40">Comma-separated list of extra selling points shown on plan card.</p>
                      <textarea rows={4} placeholder="e.g. Free ambulance, Monthly vitals check, Dedicated wellness coach…"
                        value={form['features.additionalFeatures']}
                        onChange={e => set('features.additionalFeatures', e.target.value)}
                        className="input-field w-full text-xs resize-none" />
                    </div>
                  </motion.div>
                )}

                {/* ── DISPLAY ── */}
                {tab === 'display' && (
                  <motion.div key="display" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-5">
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-4">
                      <SLabel icon={Eye}>Visibility & Ordering</SLabel>
                      <Toggle label="Active" desc="Hidden from all users if inactive."
                        checked={form.isActive} onChange={v => set('isActive', v)} />
                      <Toggle label="Featured" desc="Highlighted on plan selector with a special badge."
                        checked={form.isFeatured} onChange={v => set('isFeatured', v)} />
                      <div className="grid grid-cols-2 gap-4">
                        <Stepper label="Display Order" desc="Sort rank in UI (lower = earlier)."
                          value={form.displayOrder} onChange={v => set('displayOrder', v)} min={1} max={99} />
                        <TxtInput label="Badge Label" desc="Promo text (e.g. 'Most Popular')."
                          value={form.badgeLabel} onChange={e => set('badgeLabel', e.target.value)} />
                      </div>
                    </div>

                    {/* Preview card mini */}
                    <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-3">
                      <SLabel icon={Eye}>Live Preview</SLabel>
                      <div className="rounded-xl border-2 overflow-hidden" style={{ borderColor: t.accent }}>
                        <div className="h-16 flex items-center px-4 justify-between"
                          style={{ background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})` }}>
                          <div>
                            <p className="text-[9px] text-white/50 uppercase font-black tracking-widest">{t.tag}</p>
                            <p className="text-sm font-black text-white">{form.name}</p>
                          </div>
                          <p className="text-lg font-black text-white">₹{form['pricing.monthly']}</p>
                        </div>
                        <div className="p-3 bg-base-100">
                          <div className="flex gap-1.5 flex-wrap mb-2">
                            {!form.isActive && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-error/10 text-error">Inactive</span>}
                            {form.isFeatured && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500">⭐ Featured</span>}
                            {form.badgeLabel && <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{form.badgeLabel}</span>}
                          </div>
                          <p className="text-[10px] text-base-content/50">
                            {form['freeTrial.enabled'] ? `${form['freeTrial.durationDays']}d trial · ` : ''}
                            {form['pricing.billingLabel']} · Order #{form.displayOrder}
                          </p>
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
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-base-300 text-base-content hover:bg-base-300/70 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={loading}
                className="btn-primary-cta flex-1 !py-3 flex items-center justify-center gap-2 !text-xs disabled:opacity-50">
                {loading
                  ? <><RefreshCw size={12} className="animate-spin" /> Saving…</>
                  : <><CheckCircle2 size={13} /> {editingPlan ? 'Save Changes' : 'Create Plan'}</>
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
//  ANALYTICS SECTION
// ─────────────────────────────────────────────────────────────────────────────
const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function AnalyticsSection({ plans, subs, trials }) {
  const [activeChart, setActiveChart] = useState('revenue');

  const totalActiveSubs = useMemo(() => subs.filter(s => s.status === 'Active').length, [subs]);
  const totalTrialSubs  = useMemo(() => trials.filter(t => t.status === 'Trial').length, [trials]);
  const totalRevenue    = useMemo(() => subs.filter(s => s.status === 'Active').reduce((a, s) => a + (s.plan?.pricing?.monthly ?? 0), 0), [subs]);
  const avgPlanPrice    = useMemo(() => plans.length ? Math.round(plans.reduce((a, p) => a + (p.pricing?.monthly ?? 0), 0) / plans.length) : 0, [plans]);
  const homeSamplePlans = useMemo(() => plans.filter(p => p.diagnostics?.homeSampleCollection).length, [plans]);

  const revenueByPlan = useMemo(() => plans.map(p => ({
    name: (p.fixedTier || p.name)?.split(' ')[0],
    revenue: subs.filter(s => s.status === 'Active' && (s.plan?._id === p._id || s.plan === p._id)).length * (p.pricing?.monthly ?? 0),
    subs: subs.filter(s => s.status === 'Active' && (s.plan?._id === p._id || s.plan === p._id)).length,
  })), [plans, subs]);

  const statusDist = useMemo(() => {
    const counts = subs.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [subs]);

  const trendData = useMemo(() => {
    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
    return months.map((m, i) => ({
      month: m,
      active:  Math.max(totalActiveSubs - (7 - i) * 3, 0),
      trial:   Math.max(totalTrialSubs  - (7 - i) * 2, 0),
      revenue: Math.max(totalRevenue    - (7 - i) * 1400, 0),
    }));
  }, [totalActiveSubs, totalTrialSubs, totalRevenue]);

  const KPIs = [
    { label: 'Active Plans',    val: plans.filter(p => p.isActive).length, total: plans.length, icon: Layers,     color: '#3b82f6', change: +2  },
    { label: 'Active Subs',     val: totalActiveSubs,                                           icon: BadgeCheck, color: '#10b981', change: +12 },
    { label: 'On Trial',        val: totalTrialSubs,                                            icon: Clock,      color: '#f59e0b', change: +5  },
    { label: 'Monthly Revenue', val: totalRevenue, prefix: '₹',                                icon: IndianRupee,color: '#8b5cf6', change: +8  },
    { label: 'Avg Price',       val: avgPlanPrice, prefix: '₹',                                icon: TrendingUp, color: '#ef4444', change: +3  },
    { label: 'Home Sample Plans', val: homeSamplePlans,                                        icon: Home,       color: '#06b6d4', change: 0   },
  ];

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {KPIs.map((k, i) => (
          <motion.div key={i} custom={i} variants={fadeUp}
            whileHover={{ y: -3, scale: 1.015 }}
            className="relative overflow-hidden rounded-2xl p-4 bg-base-100 border border-base-300 shadow-sm">
            <div className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{ background: `radial-gradient(circle at 90% 10%, ${k.color}18, transparent 65%)` }} />
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${k.color}20` }}>
                <k.icon size={15} style={{ color: k.color }} />
              </div>
              <span className="text-[9px] font-black flex items-center gap-0.5"
                style={{ color: k.change >= 0 ? '#10b981' : '#ef4444' }}>
                {k.change >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                {Math.abs(k.change)}%
              </span>
            </div>
            <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-0.5">{k.label}</p>
            <p className="text-xl font-black" style={{ color: k.color }}>
              <AnimatedNumber value={k.val} prefix={k.prefix || ''} />
            </p>
            {k.total !== undefined && (
              <div className="mt-2 h-1 rounded-full bg-base-300 overflow-hidden">
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${k.total > 0 ? (k.val / k.total) * 100 : 0}%` }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: i * 0.1 }}
                  style={{ background: k.color }} />
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Area chart */}
        <motion.div custom={0} variants={fadeUp}
          className="lg:col-span-2 rounded-2xl p-5 bg-base-100 border border-base-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-0.5">Trend</p>
              <p className="text-sm font-black text-base-content">Subscription Growth</p>
            </div>
            <div className="flex gap-1">
              {['revenue', 'subs'].map(c => (
                <button key={c} onClick={() => setActiveChart(c)}
                  className={`text-[9px] font-black px-2.5 py-1.5 rounded-lg uppercase transition-all ${
                    activeChart === c ? 'bg-primary text-white' : 'bg-base-200 text-base-content hover:bg-base-300'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip content={<ChartTip />} />
              {activeChart === 'subs' ? (
                <>
                  <Area type="monotone" dataKey="active" name="Active" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gActive)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
                  <Area type="monotone" dataKey="trial"  name="Trial"  stroke="#f59e0b" strokeWidth={2} fill="none" strokeDasharray="5 3" dot={false} activeDot={{ r: 3, fill: '#f59e0b' }} />
                </>
              ) : (
                <Area type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gRevenue)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6' }} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie chart */}
        <motion.div custom={1} variants={fadeUp}
          className="rounded-2xl p-5 bg-base-100 border border-base-300">
          <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-0.5">Status</p>
          <p className="text-sm font-black text-base-content mb-3">Distribution</p>
          {statusDist.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={130}>
                <PieChart>
                  <Pie data={statusDist} cx="50%" cy="50%" innerRadius={36} outerRadius={58}
                    paddingAngle={3} dataKey="value" animationBegin={200} animationDuration={1100}>
                    {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2">
                {statusDist.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[10px] font-semibold text-base-content/55">{d.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-base-content">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-30">
              <PieChartIcon size={26} />
              <p className="text-xs font-bold text-base-content">No data</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bar chart */}
      <motion.div custom={2} variants={fadeUp}
        className="rounded-2xl p-5 bg-base-100 border border-base-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-0.5">Revenue</p>
            <p className="text-sm font-black text-base-content">Monthly Revenue by Plan</p>
          </div>
          <BarChart2 size={14} className="text-base-content/30" />
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={revenueByPlan} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.4 }} axisLine={false} tickLine={false} width={42} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="revenue" name="Revenue (₹)" radius={[5, 5, 0, 0]} animationBegin={300} animationDuration={1000}>
              {revenueByPlan.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 skeleton h-56 rounded-2xl" />
        <div className="skeleton h-56 rounded-2xl" />
      </div>
      <div className="skeleton h-44 rounded-2xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-72 rounded-2xl" />)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CRON PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CronPanel({ onClose }) {
  const dispatch           = useDispatch();
  const expiryLoading      = useSelector(selectExpiryAlertLoading);
  const expiryResult       = useSelector(selectExpiryAlertResult);
  const renewLoading       = useSelector(selectAutoRenewLoading);
  const renewResult        = useSelector(selectAutoRenewResult);
  const expireStaleLoading = useSelector(selectAdminExpireStaleLoading);

  const jobs = [
    {
      label: 'Send Expiry Alerts',
      desc:  'Notify users expiring within 7 days. Emails + in-app notifications.',
      icon:  Bell, color: '#f59e0b',
      loading: expiryLoading, result: expiryResult,
      action: () => dispatch(sendExpiryAlerts()),
    },
    {
      label: 'Trigger Auto-Renewal',
      desc:  'Deduct wallet for subscriptions expiring in 24 h. Resets homeCollectionUsedOnce on renewal.',
      icon:  RefreshCw, color: '#10b981',
      loading: renewLoading, result: renewResult,
      action: () => dispatch(triggerAutoRenew()),
    },
    {
      label: 'Expire Stale Trials',
      desc:  'Mark overdue free trials as Expired, send conversion nudges.',
      icon:  Clock, color: '#ef4444',
      loading: expireStaleLoading, result: null,
      action: () => dispatch(adminExpireStaleTrials()),
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/65 backdrop-blur-xl" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 22 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 22 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-[0_48px_96px_rgba(0,0,0,0.35)]"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-base-300">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-0.5">System</p>
            <h3 className="text-lg font-black text-base-content">Cron Jobs</h3>
          </div>
          <button onClick={() => { dispatch(clearCronResults()); onClose(); }}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 text-base-content/50 hover:bg-base-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {jobs.map((job, i) => (
            <div key={i} className="rounded-xl p-4 bg-base-200 border border-base-300">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${job.color}20` }}>
                  <job.icon size={15} style={{ color: job.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-black text-base-content">{job.label}</p>
                  <p className="text-[10px] text-base-content/40 mt-0.5 leading-snug">{job.desc}</p>
                </div>
                <button onClick={job.action} disabled={job.loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex-shrink-0 disabled:opacity-50"
                  style={{ background: `${job.color}18`, color: job.color }}>
                  {job.loading ? <RefreshCw size={10} className="animate-spin" /> : <Zap size={10} />}
                  {job.loading ? 'Running…' : 'Run'}
                </button>
              </div>
              {job.result && (
                <motion.pre initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg p-3 text-[10px] font-mono bg-base-300 text-base-content overflow-auto max-h-32">
                  {JSON.stringify(job.result, null, 2)}
                </motion.pre>
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

  const plans         = useSelector(selectAdminPlans);
  const subs          = useSelector(selectAdminSubscriptions);
  const trials        = useSelector(selectAdminTrials);
  const plansLoading  = useSelector(selectAdminPlansLoading);
  const subLoading    = useSelector(selectAdminSubLoading);
  const mutateLoading = useSelector(selectAdminPlanMutateLoading);
  const mutateError   = useSelector(selectAdminPlanMutateError);

  const [viewMode,      setViewMode]     = useState('grid');
  const [searchTerm,    setSearchTerm]   = useState('');
  const [filterActive,  setFilterActive] = useState('all');
  const [isDrawerOpen,  setIsDrawerOpen] = useState(false);
  const [editingPlan,   setEditingPlan]  = useState(null);
  const [selectedPlan,  setSelectedPlan] = useState(null);
  const [showCron,      setShowCron]     = useState(false);
  const [showAnalytics, setShowAnalytics]= useState(true);
  const [subPage,       setSubPage]      = useState(1);

  useEffect(() => {
    dispatch(adminFetchAllPlans());
    dispatch(adminFetchAllSubscriptions({ page: subPage, limit: 20 }));
    dispatch(adminFetchAllTrials({ page: 1, limit: 50 }));
  }, [dispatch]);

  useEffect(() => {
    dispatch(adminFetchAllSubscriptions({ page: subPage, limit: 20 }));
  }, [subPage, dispatch]);

  useEffect(() => {
    if (mutateError) setIsDrawerOpen(false);
  }, [mutateError]);

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
    if (confirm('Deactivate this plan? It will be hidden from all users.'))
      dispatch(adminDeactivatePlan(planId));
  }, [dispatch]);

  if (plansLoading && plans.length === 0) return <Skeleton />;

  return (
    <div className="p-6 space-y-7 max-w-7xl mx-auto min-h-screen">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                <Crown size={16} className="text-white" />
              </motion.div>
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-base-content/35">
                Subscription Management
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-base-content leading-tight">
              Care Plan <span className="text-gradient-primary">Tiers</span>
            </h1>
            <p className="text-sm text-base-content/40 mt-1">
              Manage the 6 fixed plans, benefits, pricing, and billing configuration
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAnalytics(v => !v)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold border border-base-300 transition-all ${
                showAnalytics ? 'bg-primary/8 text-primary border-primary/20' : 'bg-base-200 text-base-content'
              }`}>
              <BarChart2 size={13} /> Analytics
            </button>
            <button onClick={() => setShowCron(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-base-200 border border-base-300 text-base-content hover:bg-base-300 transition-colors">
              <Zap size={13} /> Cron Jobs
            </button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => handleOpenDrawer()}
              className="btn-primary-cta flex items-center gap-2 !text-xs">
              <Plus size={14} /> Create Plan
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── Analytics ── */}
      <AnimatePresence>
        {showAnalytics && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
            <AnalyticsSection plans={plans} subs={subs} trials={trials} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Home Collection Info Banner ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <Home size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-amber-500 mb-0.5">Home Sample Collection — One-Time Rule</p>
          <p className="text-[10px] text-amber-500/70 leading-relaxed">
            Plans with home sample collection enabled give customers <strong>1 free use per billing cycle</strong>.
            The <code className="font-mono text-[9px]">homeCollectionUsedOnce</code> flag in UserSubscription tracks usage.
            It resets to <code className="font-mono text-[9px]">false</code> automatically on each subscription renewal via the auto-renew cron.
            The diagnostic booking route calls <code className="font-mono text-[9px]">POST /subscriptions/use-home-sample-collection</code> to guard and flip the flag after payment.
          </p>
        </div>
      </motion.div>

      {/* ── Care Assistant Scope Banner ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}
        className="flex items-start gap-3 p-4 rounded-xl border border-base-300 bg-base-200/60">
        <Info size={14} className="text-base-content/35 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-base-content/70 mb-0.5">Care Assistant Isn't a Fixed-Plan Benefit</p>
          <p className="text-[10px] text-base-content/40 leading-relaxed">
            None of the 6 fixed tiers managed here carry a Care Assistant quota — every CA booking on a fixed plan
            is charged the platform rate at booking time. CA quota and pricing are configured per-customer on
            Custom Plans only, which customers build themselves through the subscription flow.
          </p>
        </div>
      </motion.div>

      {/* ── Controls bar ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/35" />
          <input type="text" placeholder="Search plans…"
            className="input-field w-full pl-10 text-sm"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/35 hover:text-base-content/70 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex gap-1.5">
          {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterActive(val)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                filterActive === val
                  ? 'bg-primary text-white border-primary'
                  : 'bg-base-200 text-base-content border-base-300 hover:border-primary/40'
              }`}>
              {lbl}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex rounded-xl overflow-hidden border border-base-300">
            {[
              { id: 'grid',    icon: Grid,       title: 'Grid'    },
              { id: 'compact', icon: LayoutList,  title: 'Compact' },
            ].map(({ id, icon: Icon, title }) => (
              <button key={id} onClick={() => setViewMode(id)} title={title}
                className={`flex items-center justify-center w-9 h-9 transition-all ${
                  viewMode === id ? 'bg-primary text-white' : 'bg-transparent text-base-content hover:bg-base-200'
                }`}>
                <Icon size={13} />
              </button>
            ))}
          </div>
          <span className="text-xs font-bold text-base-content/35">
            {filtered.length} plan{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </motion.div>

      {/* ── Plan List ── */}
      {filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 gap-4">
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/8">
            <Package size={26} className="text-primary" />
          </motion.div>
          <h3 className="text-lg font-black text-base-content">No plans found</h3>
          <p className="text-sm text-base-content/40">
            {searchTerm ? `No results for "${searchTerm}"` : 'Create your first subscription tier'}
          </p>
          {!searchTerm && (
            <button onClick={() => handleOpenDrawer()} className="btn-primary-cta flex items-center gap-2 !text-xs">
              <Plus size={13} /> Create First Plan
            </button>
          )}
        </motion.div>
      ) : viewMode === 'compact' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
          <AnimatePresence mode="popLayout">
            {filtered.map((plan, i) => (
              <PlanCard key={plan._id} plan={plan} viewMode="compact" index={i}
                onEdit={handleOpenDrawer} onDelete={handleDeactivate}
                onClick={() => setSelectedPlan(plan)} />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((plan, i) => (
              <PlanCard key={plan._id} plan={plan} viewMode="grid" index={i}
                onEdit={handleOpenDrawer} onDelete={handleDeactivate}
                onClick={() => setSelectedPlan(plan)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Subscriptions Table ── */}
      {subs.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="rounded-2xl overflow-hidden border border-base-300">
          <div className="flex items-center justify-between px-6 py-4 bg-base-200 border-b border-base-300">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-base-content/35 mb-0.5">Admin View</p>
              <p className="text-sm font-black text-base-content">Recent Subscriptions</p>
            </div>
            <div className="flex items-center gap-2">
              {subLoading && <RefreshCw size={12} className="animate-spin text-base-content/35" />}
              <button onClick={() => setSubPage(p => Math.max(1, p - 1))} disabled={subPage === 1}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-base-300 text-base-content disabled:opacity-30 hover:bg-base-300/70 transition-colors">
                <ChevronDown size={11} />
              </button>
              <span className="text-xs font-black text-base-content/40">pg {subPage}</span>
              <button onClick={() => setSubPage(p => p + 1)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-base-300 text-base-content hover:bg-base-300/70 transition-colors">
                <ChevronUp size={11} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table w-full text-xs">
              <thead>
                <tr>
                  {['User', 'Plan', 'Status', 'Expiry', 'Auto-Renew', 'Trial', 'Home Sample'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[9px] font-black uppercase tracking-widest text-base-content/35 bg-base-200 border-b border-base-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.slice(0, 10).map((s, i) => {
                  const sc = STATUS_COLORS[s.status] || STATUS_COLORS.Expired;
                  const tc = getTier(s.plan?.fixedTier || s.plan?.name || '');
                  // HOME COLLECTION FIX: show homeCollectionUsedOnce from limits
                  const homeUsed = s.limits?.homeCollectionUsedOnce ?? false;
                  const homeIncluded = s.limits?.homeSampleCollection ?? false;
                  return (
                    <motion.tr key={s._id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.025 }}
                      className="border-b border-base-300 last:border-b-0 hover:bg-base-200/50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-base-content">{s.user?.name ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-black" style={{ color: tc.accent }}>{s.plan?.name ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`font-black px-2 py-0.5 rounded-full text-[9px] ${sc.bg} ${sc.text}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-base-content/50">
                        {s.expiryDate ? new Date(s.expiryDate).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`font-black text-[10px] ${s.autoRenew ? 'text-emerald-500' : 'text-base-content/30'}`}>
                          {s.autoRenew ? '✓ On' : '✗ Off'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`font-black text-[10px] ${s.trialUsed ? 'text-amber-500' : 'text-base-content/30'}`}>
                          {s.trialUsed ? 'Used' : 'Available'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {!homeIncluded ? (
                          <span className="text-[10px] text-base-content/25 font-semibold">N/A</span>
                        ) : homeUsed ? (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">Used</span>
                        ) : (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Available</span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {selectedPlan && (
          <PlanModal plan={selectedPlan} onClose={() => setSelectedPlan(null)}
            onEdit={(p) => { setSelectedPlan(null); handleOpenDrawer(p); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCron && <CronPanel onClose={() => setShowCron(false)} />}
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