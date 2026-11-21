"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Stethoscope, Truck, Pill, Microscope, UserCheck, Home,
  Shield, Users, HeartPulse, Globe, Crown, Layers,
  BadgeCheck, RefreshCw, X, Clock, ChevronDown,
  Gift, CreditCard, AlertCircle, ArrowRight,
  Zap, Activity, Calendar, TrendingUp, Info,
  BarChart3, Sparkles, HelpCircle, CheckCircle2, ShoppingBag,
  UserPlus, Trash2, Mail, Heart, User2, UserMinus, Phone
} from "lucide-react";

import {
  fetchMySubscription,
  fetchMySubscriptionHistory,
  fetchTrialStatus,
  cancelSubscription,
  toggleAutoRenew,
  initiateTrialConversion,
  verifyTrialConversion,
  optimisticToggleAutoRenew,
  clearTrialOrder,
  addFamilyMember,
  removeFamilyMember,
  selectMySubscription,
  selectMySubIsActive,
  selectMySubIsOnTrial,
  selectMySubAutoRenew,
  selectMySubLoading,
  selectMyHistory,
  selectMyHistoryPagination,
  selectMyHistoryLoading,
  selectCancelLoading,
  selectToggleAutoRenewLoading,
  selectTrialStatus,
  selectIsOnActiveTrial,
  selectTrialDaysLeft,
  selectTrialStatusLoading,
  selectTrialOrder,
  selectTrialConvertLoading,
  selectTrialVerifyConvertLoading,
  selectMySubMembers,
  selectMySubIsShared,
  selectMySubPrimaryHolder,
} from "@/store/slices/subscriptionSlice";
import BackButton from "../../components/BackButton";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN THEME MAPPER
// ─────────────────────────────────────────────────────────────────────────────
const TIER_THEMES = {
  "Basic Care": {
    gradient: "linear-gradient(135deg, oklch(54% 0.19 242) 0%, oklch(48% 0.18 228) 100%)",
    patternId: "grid",
    tagline: "Essential protection covering fundamental wellness checks."
  },
  "Standard Care": {
    gradient: "linear-gradient(135deg, oklch(48% 0.18 228) 0%, oklch(40% 0.20 245) 100%)",
    patternId: "zigzag",
    tagline: "Balanced everyday healthcare protection for individuals."
  },
  "Premium Care": {
    gradient: "linear-gradient(135deg, oklch(46% 0.26 272) 0%, oklch(55% 0.24 285) 100%)",
    patternId: "diamonds",
    tagline: "Elite unrestricted direct clinical care access package."
  },
  "Family Care": {
    gradient: "linear-gradient(135deg, oklch(50% 0.22 158) 0%, oklch(40% 0.18 156) 100%)",
    patternId: "circles",
    tagline: "Multi-member combined dashboard clinical group mapping."
  },
  "Pregnant Women Care": {
    gradient: "linear-gradient(135deg, oklch(58% 0.20 12) 0%, oklch(62% 0.16 345) 100%)",
    patternId: "hearts",
    tagline: "Specialized critical monitoring path tracking down to delivery."
  },
  "NRI's Care": {
    gradient: "linear-gradient(135deg, oklch(48% 0.24 18) 0%, oklch(58% 0.18 30) 100%)",
    patternId: "grid",
    tagline: "International priority remote relative clinical mapping."
  },
};

const TIER_ICONS = {
  "Basic Care": Shield,
  "Standard Care": Activity,
  "Premium Care": Crown,
  "Family Care": Users,
  "Pregnant Women Care": HeartPulse,
  "NRI's Care": Globe,
};

const CUSTOM_PLAN_THEME = {
  gradient: "linear-gradient(135deg, oklch(56% 0.18 215) 0%, oklch(55% 0.24 285) 100%)",
  patternId: "waves",
  tagline: "Tailored modular health block blueprint created by you."
};

const getTierTheme = (name) => TIER_THEMES[name] || CUSTOM_PLAN_THEME;
const getTierIcon  = (name) => TIER_ICONS[name]  || Layers;

// ─────────────────────────────────────────────────────────────────────────────
// VECTOR BACKGROUND PATTERNS
// ─────────────────────────────────────────────────────────────────────────────
const SVG_BACKGROUND_PATTERNS = {
  zigzag:   (id) => <pattern id={id} x="0" y="0" width="24" height="12" patternUnits="userSpaceOnUse"><polyline points="0,12 6,0 12,12 18,0 24,12" fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" /></pattern>,
  diamonds: (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><polygon points="10,1 19,10 10,19 1,10" fill="none" stroke="white" strokeWidth="1" /></pattern>,
  circles:  (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="7" fill="none" stroke="white" strokeWidth="0.9" /></pattern>,
  hearts:   (id) => <pattern id={id} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12,20 C12,20 3,13 3,7.5 C3,5 5,3 7.5,3 C9.24,3 10.91,4.1 12,5.5 C13.09,4.1 14.76,3 16.5,3 C19,3 21,5 21,7.5 C21,13 12,20 12,20Z" fill="none" stroke="white" strokeWidth="0.9" /></pattern>,
  grid:     (id) => <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0L0 0 0 20" fill="none" stroke="white" strokeWidth="0.7" /></pattern>,
  waves:    (id) => <pattern id={id} x="0" y="0" width="32" height="16" patternUnits="userSpaceOnUse"><path d="M0,8 Q8,0 16,8 Q24,16 32,8" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" /></pattern>,
};

function StructuralPattern({ id, name }) {
  const uniqueId = useMemo(() => `pattern-render-${id}-${(name || "").replace(/[\s']/g, "-").toLowerCase()}`, [id, name]);
  const RenderEngine = SVG_BACKGROUND_PATTERNS[id] || SVG_BACKGROUND_PATTERNS.grid;
  return (
    <div className="absolute inset-0 opacity-[0.06] pointer-events-none select-none mix-blend-overlay">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>{RenderEngine(uniqueId)}</defs>
        <rect width="100%" height="100%" fill={`url(#${uniqueId})`} />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RAZORPAY GATEWAY LOADER
// ─────────────────────────────────────────────────────────────────────────────
function callRazorpayGateway() {
  return new Promise((resolve) => {
    if (typeof window === "undefined") { resolve(false); return; }
    if (window.Razorpay) { resolve(true); return; }
    const paymentScript = document.createElement("script");
    paymentScript.src = "https://checkout.razorpay.com/v1/checkout.js";
    paymentScript.onload = () => resolve(true);
    paymentScript.onerror = () => resolve(false);
    document.body.appendChild(paymentScript);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRMATION DIALOG MODAL
// ─────────────────────────────────────────────────────────────────────────────
function PremiumConfirmModal({ isOpen, title, text, actionText = "Confirm", cancelText = "Dismiss", onProceed, onDismiss, variant = "primary" }) {
  if (!isOpen) return null;

  const iconBg    = variant === "error" ? "bg-error/10"   : variant === "warning" ? "bg-warning/10"   : "bg-primary/10";
  const iconColor = variant === "error" ? "text-error"    : variant === "warning" ? "text-warning"    : "text-primary";
  const btnClass  = variant === "error" ? "btn btn-error" : variant === "warning" ? "btn btn-warning" : "btn btn-primary";

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-base-content/40 backdrop-blur-md" onClick={onDismiss} />
      <div className="relative bg-base-200 border border-base-300 w-full max-w-md rounded-xl p-6 shadow-depth-lg space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            <AlertCircle size={22} className={iconColor} />
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <h3 className="text-lg font-black tracking-tight text-base-content">{title}</h3>
            <p className="text-sm text-base-content/60 leading-relaxed font-normal">{text}</p>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onDismiss} className="btn btn-ghost px-4 py-2.5 rounded-lg text-sm font-semibold">{cancelText}</button>
          <button onClick={onProceed} className={`${btnClass} px-5 py-2.5 rounded-lg text-sm font-bold`}>{actionText}</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// METRIC FIELD
// ─────────────────────────────────────────────────────────────────────────────
function StructuralMetricField({ icon: MetricIcon, value, caption, detail, isAlert = false }) {
  return (
    <div className="flex flex-col p-4 justify-between bg-base-100 border border-base-300 rounded-xl space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-base-content/40">{caption}</span>
        <MetricIcon size={16} className={isAlert ? "text-error" : "text-primary"} />
      </div>
      <div className="space-y-0.5">
        <div className="text-2xl font-black tracking-tight text-base-content">{value}</div>
        <p className="text-[11px] font-medium text-base-content/50">{detail}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE PLAN HERO CARD
// ─────────────────────────────────────────────────────────────────────────────
function LiveSubscriptionHeroCard({ activeSub, theme, IconEngine, residualDays, thresholdReached, progressRate, formattedExpiry }) {
  const canonicalName        = activeSub.plan?.fixedTier || activeSub.plan?.name || "Active Blueprint";
  const structuralMonthlyFee = activeSub.plan?.pricing?.monthly ?? 0;
  const architectureMode     = activeSub.planType === "custom";

  return (
    <div className="card overflow-hidden border border-base-300 shadow-depth relative">
      <div className="relative p-6 text-white overflow-hidden" style={{ background: theme.gradient }}>
        <StructuralPattern id={theme.patternId} name={canonicalName} />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 flex-1">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md text-white border border-white/10">
                {activeSub.status === "Trial" ? <Gift size={11} /> : <BadgeCheck size={11} />}
                {activeSub.status === "Trial" ? "Evaluation Cycle" : "Authorized Coverage"}
              </span>

              {architectureMode && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-black/10 backdrop-blur-md text-white border border-white/5">
                  <Layers size={11} /> Dynamic Custom
                </span>
              )}

              {activeSub.autoRenew && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-white/10 text-white">
                  <RefreshCw size={10} /> Auto-Renew Enabled
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-md border border-white/10 flex items-center justify-center flex-shrink-0">
                <IconEngine size={24} className="text-white" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-2xl font-black tracking-tight text-white leading-none">{canonicalName}</h2>
                <p className="text-white/70 text-xs font-medium">{theme.tagline}</p>
              </div>
            </div>
          </div>

          <div className="bg-black/10 backdrop-blur-md border border-white/10 rounded-xl p-4 text-left md:text-right md:self-center min-w-[120px]">
            <span className="text-[10px] text-white/50 uppercase font-bold block tracking-widest">Rate Volume</span>
            <div className="text-3xl font-black tracking-tight text-white leading-none mt-1">₹{structuralMonthlyFee}</div>
            <span className="text-[10px] text-white/60 block mt-1 font-medium">
              {activeSub.status === "Trial" ? "Zero Cost Stage" : "Per Billing Period"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6 bg-base-100">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StructuralMetricField
            icon={Clock}
            caption="Access Window"
            value={`${residualDays} Days`}
            detail={thresholdReached ? "Action Recommended" : "Authorized Coverage"}
            isAlert={thresholdReached}
          />
          <StructuralMetricField
            icon={Users}
            caption="Account Allocation"
            value={activeSub.plan?.membership?.maxMembers ?? 1}
            detail={`Primary + ${Math.max(0, (activeSub.plan?.membership?.maxMembers ?? 1) - 1)} Multi-Slots`}
          />
          <StructuralMetricField
            icon={Calendar}
            caption="Termination Axis"
            value={formattedExpiry}
            detail="Automated Evaluation Point"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-base-content/50 font-medium flex items-center gap-1">
              <TrendingUp size={12} /> Temporal Consumption Path
            </span>
            <span className="font-bold text-base-content">{formattedExpiry} Deadline</span>
          </div>
          <div className="progress-bar">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressRate}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className={`progress-bar-fill ${thresholdReached ? "bg-error" : ""}`}
              style={thresholdReached ? {} : { background: theme.gradient }}
            />
          </div>
          {thresholdReached && (
            <div className="alert alert-error p-3 mt-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-error" />
              <p className="text-xs font-semibold text-error">Warning: Expiry sequence threshold active. Verify renewal channels.</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-t border-base-300 bg-base-200">
        <h4 className="text-xs font-black tracking-widest text-base-content/40 uppercase mb-4">Contractual Care Benefits Blueprint</h4>

        {architectureMode && activeSub.plan?.customOptions?.length > 0 ? (
          <div className="space-y-2">
            {activeSub.plan.customOptions
              .filter((opt) => opt.optionKey === "transport" ? opt.quantity >= 0 : opt.quantity > 0)
              .map((block, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-base-200 border border-base-300">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-base-content">{block.label}</span>
                    <p className="text-[10px] text-base-content/40 font-medium">Provision Unit Volume: ×{block.quantity}</p>
                  </div>
                  <span className="text-xs font-black text-primary">₹{block.lineTotal?.toFixed(0) ?? 0}</span>
                </div>
              ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { icon: Stethoscope, tag: "Clinical Consultation",          text: activeSub.plan?.consultations?.freePerMonth === -1 ? "Unlimited Free Access" : `${activeSub.plan?.consultations?.freePerMonth ?? 0} Allocations / mo` },
              { icon: Pill,        tag: "Pharmacy Compound Hub",          text: `Up to ${activeSub.plan?.pharmacy?.discountMax ?? 0}% Flat Pricing Cap` },
              { icon: Microscope,  tag: "Diagnostics Diagnostics",        text: `${activeSub.plan?.diagnostics?.discountPercent ?? 0}% Network Discount Rate` },
              { icon: Truck,       tag: "Logistics Transport",            text: activeSub.plan?.transport?.isApplicable ? `Allocated Base Rate ₹${activeSub.plan?.transport?.ratePerKm ?? 0}/km` : "Direct Charge Protocol" },
              { icon: UserCheck,   tag: "Assigned Care Executive",        text: activeSub.plan?.careAssistant?.included ? "Dedicated Personnel Mapped" : "Standard Variable Request" },
              { icon: Home,        tag: "Domiciliary Diagnostic Collection", text: activeSub.plan?.diagnostics?.homeSampleCollection ? "Home Access Vector Active" : "Clinical Site Operations Only" },
            ].map((benefit, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-base-200 border border-base-300">
                <div className="p-1.5 rounded-md bg-base-200 border border-base-300 flex-shrink-0 text-primary">
                  <benefit.icon size={14} />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[11px] font-bold block text-base-content/40 uppercase tracking-wide">{benefit.tag}</span>
                  <p className="text-xs font-black text-base-content truncate">{benefit.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE TRACKER
// ─────────────────────────────────────────────────────────────────────────────
function LiveConsumptionTracker({ subscriptionState }) {
  const currentUsageMatrix = subscriptionState.currentMonthUsage;
  const dynamicLimits      = subscriptionState.limits;
  if (!dynamicLimits) return null;

  const operationalUsageVector = [
    { label: "Clinical Consultations",        consumed: currentUsageMatrix?.consultationsUsed ?? 0,     ceiling: dynamicLimits.consultationsPerMonth ?? 0,        icon: Stethoscope },
    { label: "Laboratory Diagnostic Tests",   consumed: currentUsageMatrix?.labTestsUsed ?? 0,           ceiling: dynamicLimits.labTestsPerMonth ?? 0,              icon: Microscope },
    { label: "Emergency Logistics Transports",consumed: currentUsageMatrix?.transportRidesUsed ?? 0,    ceiling: dynamicLimits.transportRidesPerMonth ?? null,     icon: Truck },
    { label: "Assigned Home Care Visits",     consumed: currentUsageMatrix?.careAssistantVisitsUsed ?? 0,ceiling: dynamicLimits.careAssistantVisitsPerMonth ?? null, icon: UserCheck },
].filter((item) => item.ceiling !== null && (item.ceiling === -1 || item.ceiling > 0));

  if (!operationalUsageVector.length) return null;

  return (
    <div className="p-5 rounded-xl border border-base-300 bg-base-200 space-y-4 shadow-sm">
      <div className="flex items-center gap-2">
        <BarChart3 size={16} className="text-primary" />
        <h4 className="text-xs font-black uppercase tracking-widest text-base-content/40">Current Quota Ledger Balance</h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {operationalUsageVector.map((metric, idx) => {
          const allocationInfinite = metric.ceiling === -1;
          const completionRatio    = allocationInfinite ? 0 : Math.min(100, (metric.consumed / metric.ceiling) * 100);
          const limitBreached      = !allocationInfinite && metric.consumed >= metric.ceiling;

          return (
            <div key={idx} className="p-3 rounded-lg bg-base-200 border border-base-300 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <metric.icon size={14} className="text-base-content/50" />
                  <span className="text-xs font-bold text-base-content/70 truncate">{metric.label}</span>
                </div>
                <span className={`text-xs font-black ${limitBreached ? "text-error" : "text-primary"}`}>
                  {metric.consumed} / {allocationInfinite ? "∞" : metric.ceiling}
                </span>
              </div>

              {!allocationInfinite && (
                <div className="progress-bar">
                  <div
                    className={`progress-bar-fill ${limitBreached ? "bg-error" : "bg-primary"}`}
                    style={{ width: `${completionRatio}%` }}
                  />
                </div>
              )}
              <p className="text-[10px] font-medium text-base-content/40">
                {allocationInfinite
                  ? "Unrestricted transactional clearance active."
                  : `${metric.ceiling - metric.consumed} clean contractual units left.`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER MANAGER
// ─────────────────────────────────────────────────────────────────────────────

const RELATION_OPTIONS = ["Spouse", "Child", "Parent", "Sibling", "Other"];

const RELATION_COLORS = {
  Spouse:  { bg: "bg-pink-500/10",   text: "text-pink-600",   border: "border-pink-500/20"   },
  Child:   { bg: "bg-blue-500/10",   text: "text-blue-600",   border: "border-blue-500/20"   },
  Parent:  { bg: "bg-amber-500/10",  text: "text-amber-600",  border: "border-amber-500/20"  },
  Sibling: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/20" },
  Other:   { bg: "bg-base-300/60",   text: "text-base-content/60", border: "border-base-300" },
};

const RELATION_ICONS = {
  Spouse:  Heart,
  Child:   User2,
  Parent:  Users,
  Sibling: Users,
  Other:   UserCheck,
};

function MemberAvatar({ email, relation }) {
  const initials = email ? email.slice(0, 2).toUpperCase() : "??";
  const colors   = RELATION_COLORS[relation] || RELATION_COLORS.Other;
  return (
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 border ${colors.bg} ${colors.text} ${colors.border}`}>
      {initials}
    </div>
  );
}

function FamilyMemberCard({ member, onRemove, removeLoading }) {
  const colors      = RELATION_COLORS[member.relation] || RELATION_COLORS.Other;
  const RelIcon     = RELATION_ICONS[member.relation]   || UserCheck;
  const addedDate   = member.addedAt
    ? new Date(member.addedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-100 group"
    >
      <MemberAvatar email={member.memberEmail} relation={member.relation} />

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-base-content truncate">{member.memberEmail}</span>
          {member.memberId && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20 uppercase tracking-wide">
              <BadgeCheck size={9} /> Registered
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${colors.bg} ${colors.text} ${colors.border}`}>
            <RelIcon size={9} /> {member.relation}
          </span>
          <span className="text-[10px] text-base-content/40 font-medium">Added {addedDate}</span>
        </div>
      </div>

      <button
        onClick={() => onRemove(member.memberEmail)}
        disabled={removeLoading}
        className="p-2 rounded-lg border border-error/20 bg-error/5 text-error hover:bg-error hover:text-white transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 disabled:opacity-40"
        title="Remove member"
      >
        {removeLoading ? <RefreshCw size={14} className="animate-spin" /> : <UserMinus size={14} />}
      </button>
    </motion.div>
  );
}

function AddMemberForm({ onAdd, loading, maxMembers, currentCount }) {
  const [email,    setEmail]    = useState("");
  const [relation, setRelation] = useState("Spouse");
  const [error,    setError]    = useState("");

  const slotsLeft = Math.max(0, (maxMembers - 1) - currentCount);

  const handleSubmit = () => {
    setError("");
    if (!email.trim()) { setError("Email required."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError("Invalid email format."); return; }
    if (slotsLeft <= 0) { setError("Member slot limit reached."); return; }
    onAdd({ email: email.trim().toLowerCase(), relation });
    setEmail("");
    setRelation("Spouse");
  };

  if (slotsLeft <= 0) return null;

  return (
    <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus size={14} className="text-primary" />
        <span className="text-xs font-black text-primary uppercase tracking-wider">Add Member Slot</span>
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">{slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} left</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <div className="relative">
          <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="member@email.com"
            className="input-field pl-8 text-xs h-9"
          />
        </div>

        <select
          value={relation}
          onChange={(e) => setRelation(e.target.value)}
          className="input-field text-xs h-9 pr-6 min-w-[110px]"
        >
          {RELATION_OPTIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="btn btn-primary h-9 px-4 text-xs font-bold rounded-lg flex items-center gap-1.5 whitespace-nowrap"
        >
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <UserPlus size={13} />}
          Add
        </button>
      </div>

      {error && (
        <p className="text-xs text-error font-semibold flex items-center gap-1">
          <AlertCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}

function FamilyMemberManager({ activeSub, members, subLoading }) {
  const dispatch = useDispatch();
  const [removingEmail, setRemovingEmail] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // email to confirm

  const maxMembers    = activeSub?.plan?.membership?.maxMembers ?? 1;
  const isMultiMember = maxMembers > 1;

  const handleAdd = useCallback(async ({ email, relation }) => {
    await dispatch(addFamilyMember({ email, relation }));
  }, [dispatch]);

  const handleRemoveConfirm = useCallback((email) => {
    setConfirmRemove(email);
  }, []);

  const handleRemoveProceed = useCallback(async () => {
    if (!confirmRemove) return;
    setRemovingEmail(confirmRemove);
    setConfirmRemove(null);
    await dispatch(removeFamilyMember(confirmRemove));
    setRemovingEmail(null);
  }, [dispatch, confirmRemove]);

  // Plan doesn't support members
  if (!isMultiMember) {
    return (
      <div className="p-5 rounded-xl border border-base-300 bg-base-200 space-y-3 shadow-sm">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-base-content/40" />
          <h4 className="text-xs font-black uppercase tracking-widest text-base-content/40">Family Member Registry</h4>
        </div>
        <div className="p-4 rounded-lg border border-dashed border-base-300 bg-base-100 text-center space-y-1.5">
          <Users size={20} className="text-base-content/20 mx-auto" />
          <p className="text-xs font-bold text-base-content/40">Current plan supports single-member access only.</p>
          <a href="/subscriptions" className="inline-flex items-center gap-1 text-[11px] font-black text-primary hover:underline mt-1">
            <Sparkles size={11} /> Upgrade to Family or NRI plan
          </a>
        </div>
      </div>
    );
  }

  const totalSlots  = maxMembers - 1; // primary doesn't count
  const usedSlots   = members.length;
  const slotPercent = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;

  return (
    <>
      <div className="p-5 rounded-xl border border-base-300 bg-base-200 space-y-4 shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <h4 className="text-xs font-black uppercase tracking-widest text-base-content/40">Family Member Registry</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-base-content/50">{usedSlots}/{totalSlots} slots used</span>
            <div className="w-16 h-1.5 rounded-full bg-base-300 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${slotPercent >= 100 ? "bg-error" : "bg-primary"}`}
                style={{ width: `${slotPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Add form */}
        <AddMemberForm
          onAdd={handleAdd}
          loading={subLoading}
          maxMembers={maxMembers}
          currentCount={usedSlots}
        />

        {/* Member list */}
        {members.length === 0 ? (
          <div className="p-6 rounded-xl border border-dashed border-base-300 bg-base-100 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-base-300/60 flex items-center justify-center mx-auto">
              <Users size={18} className="text-base-content/30" />
            </div>
            <p className="text-xs font-bold text-base-content/40">No members added yet.</p>
            <p className="text-[11px] text-base-content/30 font-medium">Add family members above to share plan benefits.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-base-content/40 uppercase tracking-wider px-1">
              <BadgeCheck size={11} /> Active Member Roster
            </div>
            <AnimatePresence>
              {members.map((member) => (
                <FamilyMemberCard
                  key={member.memberEmail}
                  member={member}
                  onRemove={handleRemoveConfirm}
                  removeLoading={removingEmail === member.memberEmail}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Slot summary footer */}
        <div className="flex items-center gap-2 pt-1 text-[11px] text-base-content/40 font-medium border-t border-base-300">
          <Info size={11} />
          <span>Plan supports {maxMembers} total members — you (primary) + {totalSlots} additional slot{totalSlots !== 1 ? "s" : ""}.</span>
        </div>
      </div>

      {/* Remove confirm modal */}
      <PremiumConfirmModal
        isOpen={!!confirmRemove}
        title="Remove Family Member?"
        text={`This will revoke plan access for ${confirmRemove}. They will receive a notification. Access is terminated immediately.`}
        actionText="Remove Member"
        cancelText="Cancel"
        variant="error"
        onProceed={handleRemoveProceed}
        onDismiss={() => setConfirmRemove(null)}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION PANEL
// ─────────────────────────────────────────────────────────────────────────────
function InteractiveActionPanel({ activeSub, executeRenewalToggle, executeCancellation, executeTrialConversion, cancellationLoading, toggleLoading, conversionLoading }) {
  return (
    <div className="bg-base-200 border border-base-300 rounded-xl p-5 space-y-4">
      <div className="space-y-1">
        <h4 className="text-sm font-black tracking-tight text-base-content">Subscription Administration Control Panel</h4>
        <p className="text-xs text-base-content/50">Manage dynamic authorization pipelines, billing status adjustments, and live clinical protection parameters.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {activeSub.status === "Trial" && (
          <button
            onClick={executeTrialConversion}
            disabled={conversionLoading}
            className="sm:col-span-2 w-full btn btn-primary h-12 rounded-lg flex items-center justify-center gap-2 shadow-primary"
          >
            {conversionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
            Activate Structural Plan Coverage — ₹{activeSub.plan?.pricing?.monthly ?? 0}/mo
          </button>
        )}

        <button
          onClick={executeRenewalToggle}
          disabled={toggleLoading}
          className={`p-4 rounded-lg border text-left flex items-start justify-between gap-4 transition-all ${
            activeSub.autoRenew
              ? "bg-base-200 border-primary/30 shadow-sm"
              : "bg-base-100 border-base-300 opacity-70"
          }`}
        >
          <div className="flex gap-3 items-start min-w-0">
            <div className={`p-2 rounded-md mt-0.5 ${activeSub.autoRenew ? "bg-primary/10 text-primary" : "bg-base-300 text-base-content/40"}`}>
              {toggleLoading ? <RefreshCw size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </div>
            <div className="space-y-0.5 min-w-0">
              <span className="text-xs font-black block text-base-content">Automatic Billing Loop</span>
              <p className="text-[11px] text-base-content/50 font-normal leading-normal">
                {activeSub.autoRenew
                  ? "System will generate transaction tokens at expiry."
                  : "Coverage deactivates safely at window termination."}
              </p>
            </div>
          </div>
          <div className={`w-8 h-5 rounded-full relative flex-shrink-0 p-0.5 transition-colors duration-200 ${activeSub.autoRenew ? "bg-primary" : "bg-base-300"}`}>
            <div className={`w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${activeSub.autoRenew ? "transform bg-white translate-x-3" : "bg-gray-500"}`} />
          </div>
        </button>

        <button
          onClick={executeCancellation}
          disabled={cancellationLoading}
          className="p-4 rounded-lg border border-error/20 bg-base-200 hover:bg-error/5 text-left flex items-start gap-3 transition-all group"
        >
          <div className="p-2 rounded-md bg-error/10 text-error mt-0.5 group-hover:bg-error group-hover:text-white transition-colors">
            {cancellationLoading ? <RefreshCw size={15} className="animate-spin" /> : <X size={15} />}
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-xs font-black block text-error">Terminate Coverage</span>
            <p className="text-[11px] text-base-content/40 font-normal leading-normal">Revoke systematic platform assignment safely. Access retained until expiry timestamp.</p>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-2 justify-center pt-2 text-[11px] text-base-content/40 font-medium">
        <Info size={12} />
        <span>Authorization protection active under global identifier: {activeSub._id}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY LEDGER
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_DOT_CLASS = {
  Active:    "status-dot-success",
  Trial:     "status-dot-warning",
  Cancelled: "status-dot",
  Expired:   "status-dot-error",
  Paused:    "status-dot-info",
};

const STATUS_BADGE_CLASS = {
  Active:    "badge badge-success",
  Trial:     "badge badge-warning",
  Cancelled: "badge",
  Expired:   "badge badge-error",
  Paused:    "badge badge-info",
};

function HistoricLedgerPipeline({ dataset, pagination, activeLoading, triggerPageChange }) {
  if (activeLoading && dataset.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 border border-base-300 rounded-xl bg-base-100">
        <RefreshCw size={20} className="animate-spin text-primary/40" />
      </div>
    );
  }

  if (dataset.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-base-300 rounded-xl bg-base-100 space-y-1">
        <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider">Archive Registry Clear</p>
        <p className="text-xs text-base-content/50 font-normal">No legacy transaction tokens exist under this identification sequence.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto border border-base-300 rounded-xl bg-base-200">
        <table className="table w-full text-left border-collapse">
          <thead>
            <tr>
              <th>Care Level Blueprint</th>
              <th>Structural Allocation Period</th>
              <th>System Status State</th>
              <th>Rate Charge</th>
            </tr>
          </thead>
          <tbody>
            {dataset.map((entry, index) => {
              const coreTitle          = entry.plan?.fixedTier || entry.plan?.name || "Standard Level Asset";
              const SystemIcon         = getTierIcon(coreTitle);
              const architectureCustom = entry.planType === "custom";
              const dotClass           = STATUS_DOT_CLASS[entry.status]  || "status-dot";
              const badgeClass         = STATUS_BADGE_CLASS[entry.status] || "badge";

              return (
                <tr key={entry._id || index}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg border border-base-300 bg-base-200 flex items-center justify-center flex-shrink-0 text-primary">
                        <SystemIcon size={14} />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-xs font-black text-base-content truncate block">{coreTitle}</span>
                        {architectureCustom && (
                          <span className="inline-block text-[9px] font-bold px-1 rounded bg-primary/10 text-primary uppercase">Custom Build</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs text-base-content/70 block font-medium">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </span>
                    <span className="text-[10px] text-base-content/40 block font-medium">
                      Expires: {entry.expiryDate ? new Date(entry.expiryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`${badgeClass} inline-flex items-center gap-1`}>
                      <span className={`status-dot ${dotClass}`} />
                      {entry.status}
                    </span>
                  </td>
                  <td>
                    <span className="text-xs font-black text-base-content block">₹{entry.plan?.pricing?.monthly ?? 0}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between p-2.5 border border-base-300 bg-base-200 rounded-xl">
          <button
            onClick={() => triggerPageChange(Math.max(1, pagination.page - 1))}
            disabled={pagination.page === 1}
            className="btn btn-sm bg-base-200 border-base-300 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 shadow-sm"
          >
            Previous Channel
          </button>
          <span className="text-xs font-bold text-base-content/50">Ledger Block {pagination.page} of {pagination.pages}</span>
          <button
            onClick={() => triggerPageChange(Math.min(pagination.pages, pagination.page + 1))}
            disabled={pagination.page === pagination.pages}
            className="btn btn-sm bg-base-200 border-base-300 text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 shadow-sm"
          >
            Next Channel
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────
function DefaultEmptyViewport() {
  return (
    <div className="border border-base-300 rounded-2xl bg-base-200 p-12 text-center max-w-xl mx-auto space-y-6 shadow-sm">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-sm">
        <HeartPulse size={32} />
      </div>
      <div className="space-y-2 max-w-sm mx-auto">
        <h3 className="text-xl font-black tracking-tight text-base-content">No Active Blueprint Discovered</h3>
        <p className="text-sm text-base-content/50 leading-relaxed font-normal">
          Your identity token is currently not bound to an active system subscription layout structure. Protect your health security metrics today.
        </p>
      </div>
      <div className="pt-2">
        <motion.a
          href="/subscriptions"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary px-6 py-3 rounded-lg text-sm inline-flex items-center gap-2 shadow-primary"
        >
          <Zap size={14} /> Initialize Platform Coverage
        </motion.a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────
function UIArchitectureSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton h-8 w-48 rounded-md" />
      </div>
      <div className="skeleton h-80 w-full rounded-xl" />
      <div className="skeleton h-40 w-full rounded-xl" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function MySubscriptionPage() {
  const dispatch = useDispatch();

  const dataCore               = useSelector(selectMySubscription);
  const statusActive           = useSelector(selectMySubIsActive);
  const evaluationState        = useSelector(selectMySubIsOnTrial);
  const autoRenewalLoop        = useSelector(selectMySubAutoRenew);
  const pipelineLoading        = useSelector(selectMySubLoading);
  const processingCancellation = useSelector(selectCancelLoading);
  const processingRenewalToggle= useSelector(selectToggleAutoRenewLoading);
  const archiveDataset         = useSelector(selectMyHistory);
  const archivePagination      = useSelector(selectMyHistoryPagination);
  const archiveLoading         = useSelector(selectMyHistoryLoading);
  const checkoutToken          = useSelector(selectTrialOrder);
  const executingConversion    = useSelector(selectTrialConvertLoading);
  const executingVerification  = useSelector(selectTrialVerifyConvertLoading);
  const familyMembers          = useSelector(selectMySubMembers);
  const isShared               = useSelector(selectMySubIsShared);
  const primaryHolder          = useSelector(selectMySubPrimaryHolder);

  const [expandArchive, setExpandArchive] = useState(false);
  const [archivePage,   setArchivePage]   = useState(1);
  const [modalState, setModalState] = useState({
    visible: false, title: "", text: "", actionText: "", variant: "primary", onProceed: () => {}
  });

  const GATEWAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

  useEffect(() => {
    dispatch(fetchMySubscription());
    dispatch(fetchTrialStatus());
  }, [dispatch]);

  useEffect(() => {
    if (expandArchive) dispatch(fetchMySubscriptionHistory({ page: archivePage, limit: 5 }));
  }, [expandArchive, archivePage, dispatch]);

  // Razorpay gateway
  useEffect(() => {
    if (!checkoutToken?.orderId) return;
    (async () => {
      const activeGatewayKey = checkoutToken.key_id || checkoutToken.razorpayKey || GATEWAY_KEY_ID;
      if (!activeGatewayKey) {
        alert("CRITICAL PAYMENT GATEWAY MISCONFIGURATION. ABORTING TRANSACTION.");
        dispatch(clearTrialOrder()); return;
      }
      const loaded = await callRazorpayGateway();
      if (!loaded) {
        alert("EXTERNAL GATEWAY DEPENDENCY INTEGRITY FAILURE. VERIFY INTERNET CONNECTION.");
        dispatch(clearTrialOrder()); return;
      }

      const activePlanTitle  = dataCore?.plan?.fixedTier || dataCore?.plan?.name || "System Base";
      const layoutTheme      = getTierTheme(activePlanTitle);
const structuralPaise  = Math.round(checkoutToken.amount * 100);

      const transactionalParams = {
        key:         activeGatewayKey,
        amount:      structuralPaise,
        currency:    checkoutToken.currency || "INR",
        name:        "Likeson Unified Care Platform",
        description: `Authorization Stage Conversion — ${activePlanTitle}`,
        order_id:    checkoutToken.orderId,
        image:       "/logo.png",
        handler: async (paymentResponse) => {
          try {
            await dispatch(verifyTrialConversion({
              razorpay_order_id:   paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature:  paymentResponse.razorpay_signature,
              amount:              checkoutToken.amount,
            }));
            dispatch(clearTrialOrder());
            dispatch(fetchMySubscription());
          } catch {
            alert("TRANSACTION VERIFICATION INTEGRITY REJECTED. CONTACT SYSTEMS TEAM.");
            dispatch(clearTrialOrder());
          }
        },
        prefill: { name: "", email: "", contact: "" },
        theme:   { color: layoutTheme.gradient },
        modal:   { ondismiss: () => dispatch(clearTrialOrder()) },
      };

      const nativeInstance = new window.Razorpay(transactionalParams);
      nativeInstance.on("payment.failed", (errorObject) => {
        alert(`TRANSACTION FAILURE EVENT: ${errorObject.error?.description || "UNKNOWN PIPELINE REJECTION"}`);
        dispatch(clearTrialOrder());
      });
      nativeInstance.open();
    })();
  }, [checkoutToken?.orderId]);

  // Actions
  const triggerRevocationWorkflow = useCallback(() => {
    setModalState({
      visible: true,
      title: "Confirm Care Plan Revocation?",
      text: "This operation will disconnect your automatic healthcare access parameters. You will maintain valid systematic data availability through the end of your current paid allocation window.",
      actionText: "Revoke Authorization",
      variant: "error",
      onProceed: async () => {
        setModalState((prev) => ({ ...prev, visible: false }));
        await dispatch(cancelSubscription());
        dispatch(fetchMySubscription());
      }
    });
  }, [dispatch]);

  const triggerRenewalToggleWorkflow = useCallback(() => {
    if (autoRenewalLoop) {
      setModalState({
        visible: true,
        title: "Deactivate Automated Billing Cycle?",
        text: "The payment engine will no longer generate transactional requests automatically at term expiration. Your active clinic protection plan will conclude at the specified deadline date.",
        actionText: "Deactivate Cycle",
        variant: "warning",
        onProceed: () => {
          setModalState((prev) => ({ ...prev, visible: false }));
          dispatch(optimisticToggleAutoRenew());
          dispatch(toggleAutoRenew());
        }
      });
    } else {
      dispatch(optimisticToggleAutoRenew());
      dispatch(toggleAutoRenew());
    }
  }, [dispatch, autoRenewalLoop]);

  const triggerEvaluationConversion = useCallback(() => {
    dispatch(initiateTrialConversion({}));
  }, [dispatch]);

  const closeModal = useCallback(() => setModalState((prev) => ({ ...prev, visible: false })), []);

  // Derived values
  const targetTitle      = dataCore?.plan?.fixedTier || dataCore?.plan?.name || "";
  const planTheme        = getTierTheme(targetTitle);
  const AssociatedIcon   = getTierIcon(targetTitle);
  const structuralExpiry = dataCore?.expiryDate ? new Date(dataCore.expiryDate) : null;
  const daysRemaining    = structuralExpiry ? Math.max(0, Math.ceil((structuralExpiry - Date.now()) / 86400000)) : 0;
  const expiryThreshold  = daysRemaining <= 7 && daysRemaining > 0;
const cycleTotalDays   = dataCore?.status === "Trial"
    ? (dataCore?.plan?.freeTrial?.durationDays ?? 7)
    : dataCore?.plan?.pricing?.billingCycle === "till_delivery"
      ? 280
      : 30;
  const progressRatio    = structuralExpiry ? Math.min(100, Math.max(0, (1 - daysRemaining / cycleTotalDays) * 100)) : 0;
  
  const validSubActive   = dataCore && (statusActive || evaluationState || isShared);
  const formattedExpiry  = structuralExpiry ? structuralExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";

  // Show family manager only on multi-member plans that are active
  const showFamilyManager = validSubActive && (dataCore?.plan?.membership?.maxMembers ?? 1) > 1;

  if (pipelineLoading && !dataCore) return <UIArchitectureSkeleton />;

  return (
    <>
      <div className="min-h-screen bg-base-100 font-sans antialiased text-base-content selection:bg-primary/10">
        <div className="max-w-4xl mx-auto px-4 pb-12 pt-3 space-y-8">
          <BackButton className=" " />

          {/* Page header */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-base-300 pb-6">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-base-content/40 block">Likeson Accounts Infrastructure</span>
              <h1 className="text-3xl font-black tracking-tight text-base-content font-display">System Health Plan Registry</h1>
            </div>

            {validSubActive && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-base-200 border border-base-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-base-content/70">{evaluationState ? "Evaluation Phase" : "Operational Allocation Continuous"}</span>
              </div>
            )}
          </motion.div>

          {/* Content router */}
          {!validSubActive && !pipelineLoading ? (
            <DefaultEmptyViewport />
          ) : (
            <AnimatePresence mode="wait">
              {validSubActive && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-6">

                 {/* Shared plan notice */}
                  {isShared && primaryHolder && (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-info/30 bg-info/5">
                      <div className="p-2 rounded-lg bg-info/10 text-info flex-shrink-0">
                        <Users size={16} />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-xs font-black text-base-content block">Shared Family Plan Access</span>
                        <p className="text-[11px] text-base-content/50 font-medium">
                          You are covered under {primaryHolder.name || primaryHolder.email}'s plan. Contact them to manage membership.
                        </p>
                      </div>
                    </div>
                  )}

                  <LiveSubscriptionHeroCard
                    activeSub={dataCore}
                    theme={planTheme}
                    IconEngine={AssociatedIcon}
                    residualDays={daysRemaining}
                    thresholdReached={expiryThreshold}
                    progressRate={progressRatio}
                    formattedExpiry={formattedExpiry}
                  />

                  <LiveConsumptionTracker subscriptionState={dataCore} />

                  {/* ── FAMILY MEMBER MANAGER — primary only ── */}
                  {!isShared && (
                    <FamilyMemberManager
                      activeSub={dataCore}
                      members={familyMembers}
                      subLoading={pipelineLoading}
                    />
                  )}

                  {/* ── ACTION PANEL — primary only ── */}
                  {!isShared && (
                    <InteractiveActionPanel
                      activeSub={dataCore}
                      executeRenewalToggle={triggerRenewalToggleWorkflow}
                      executeCancellation={triggerRevocationWorkflow}
                      executeTrialConversion={triggerEvaluationConversion}
                      cancellationLoading={processingCancellation}
                      toggleLoading={processingRenewalToggle}
                      conversionLoading={executingConversion || executingVerification}
                    />
                  )}

                  {/* History accordion */}
                  <div className="border border-base-300 rounded-xl overflow-hidden bg-base-200 shadow-sm">
                    <button
                      onClick={() => setExpandArchive((prev) => !prev)}
                      aria-expanded={expandArchive}
                      className="w-full p-5 flex items-center justify-between transition-colors bg-base-200 hover:bg-base-300/60"
                    >
                      <div className="flex items-center gap-3">
                        <motion.div animate={{ rotate: expandArchive ? 180 : 0 }} transition={{ duration: 0.25 }}>
                          <ChevronDown size={18} className="text-base-content/50" />
                        </motion.div>
                        <span className="text-sm font-black text-base-content">System Historic Transaction Record Registry</span>
                      </div>
                      {archivePagination.total > 0 && (
                        <span className="text-[10px] font-black px-2.5 py-1 border border-base-300 text-base-content/60 rounded-md">
                          {archivePagination.total} Logs Verified
                        </span>
                      )}
                    </button>

                    <AnimatePresence initial={false}>
                      {expandArchive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                        >
                          <div className="p-5 border-t border-base-300 bg-base-100/50">
                            <HistoricLedgerPipeline
                              dataset={archiveDataset}
                              pagination={archivePagination}
                              activeLoading={archiveLoading}
                              triggerPageChange={(targetPage) => setArchivePage(targetPage)}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Upgrade anchor */}
                  <motion.a
                    href="/subscriptions"
                    whileHover={{ y: -2 }}
                    className="flex items-center justify-between p-5 rounded-xl border border-base-300 hover:border-primary/40 transition-all group shadow-sm"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                        <Sparkles size={18} />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-sm font-black block text-base-content">Modify Operational Authorization Architecture</span>
                        <p className="text-xs text-base-content/50 font-medium">Upgrade, restructure slots, or scale clinical protection bounds parameters smoothly.</p>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-base-content/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </motion.a>

                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      <PremiumConfirmModal
        isOpen={modalState.visible}
        title={modalState.title}
        text={modalState.text}
        actionText={modalState.actionText}
        variant={modalState.variant}
        onProceed={modalState.onProceed}
        onDismiss={closeModal}
      />
    </>
  );
}