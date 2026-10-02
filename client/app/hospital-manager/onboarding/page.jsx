"use client";

import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Building2,
  Image as ImageIcon,
  FileText,
  Clock,
  CircleDollarSign,
  Users,
  ShieldCheck,
  CheckCircle2,
  Circle,
  ChevronRight,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Lock,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Assuming these are your redux imports
import {
  fetchOnboarding,
  selectOnboarding,
  isLoading,
  fetchOnboarding as fetchOnboardingThunk,
} from "@/store/slices/hospitalManagerSlice";

// ─────────────────────────────────────────────────────────────────────────────
// STEP DEFINITIONS (Matched to Dashboard Links)
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    key: "basicProfile",
    icon: Building2,
    title: "Basic Profile",
    description:
      "Set your hospital name, description, contact info, address, and specialties.",
    action: "Complete Profile",
    href: "/hospital-manager/profile",
    tip: "A complete profile increases patient trust and search visibility.",
  },
  {
    key: "logoUploaded",
    icon: ImageIcon,
    title: "Upload Logo & Gallery",
    description: "Add your hospital logo and up to 20 gallery photos.",
    action: "Manage Media",
    href: "/hospital-manager/gallery",
    tip: "High-quality images improve click-through rates by up to 3×.",
  },
  {
    key: "licenseDocument",
    icon: FileText,
    title: "Registration Document",
    description:
      "Upload your hospital license or registration document for verification.",
    action: "Upload Document",
    href: "/hospital-manager/registration",
    tip: "Required for admin verification. PDF or image accepted (max 10 MB).",
  },
  {
    key: "operatingHoursSet",
    icon: Clock,
    title: "Operating Hours",
    description:
      "Define your weekly operating schedule so patients know when you're open.",
    action: "Set Hours",
    href: "/hospital-manager/operating-hours",
    tip: "Patients are 2× more likely to book when hours are clearly listed.",
  },
  {
    key: "pricingConfigured",
    icon: CircleDollarSign,
    title: "Consultation Pricing",
    description:
      "Configure in-person, video, and home-visit fees for all linked doctors.",
    action: "Set Pricing",
    href: "/hospital-manager/pricing",
    tip: "Transparent pricing builds confidence and reduces drop-offs.",
  },
  {
    key: "doctorsLinked",
    icon: Users,
    title: "Link Doctors",
    description: "Search and link verified doctors to your hospital.",
    action: "Add Doctors",
    href: "/hospital-manager/doctors/search",
    tip: "Minimum 1 doctor required to accept patient bookings.",
  },
  {
    key: "verified",
    icon: ShieldCheck,
    title: "Admin Verification",
    description:
      "Our team will review your profile and verify your hospital within 24–48 hours.",
    action: null,
    href: null,
    tip: "Ensure all documents are uploaded before submitting for review.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: "easeOut" },
  }),
};

const slideIn = {
  hidden: { opacity: 0, x: -15 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const StepCard = ({ step, done, index, isLast, onSelect, selected }) => {
  const Icon = step.icon;
  const isSelected = selected === step.key;

  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      layout
    >
      <button
        onClick={() => onSelect(step.key)}
        className={cn(
          "w-full text-left group relative rounded-2xl border transition-all duration-300 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          done
            ? "border-success/30 bg-success/5"
            : isSelected
            ? "border-primary/40 bg-primary/5 shadow-lg shadow-primary/5"
            : "border-base-300 bg-base-100 hover:border-primary/30"
        )}
      >
        {/* Left accent border */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl transition-all duration-300",
            done ? "bg-success opacity-100" : isSelected ? "bg-primary opacity-100" : "bg-primary opacity-0 group-hover:opacity-40"
          )}
        />

        <div className="flex items-center gap-4 p-5 pl-6">
          {/* Status Icon */}
          <div className="flex-shrink-0">
            {done ? (
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className="w-11 h-11 rounded-xl flex items-center justify-center bg-success/15 text-success"
              >
                <CheckCircle2 size={22} />
              </motion.div>
            ) : (
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-300",
                  isSelected ? "bg-primary/15 text-primary" : "bg-base-200 text-base-content/40"
                )}
              >
                <Icon size={20} />
              </div>
            )}
          </div>

          {/* Title Area */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-widest",
                  done ? "text-success" : "text-base-content/40"
                )}
              >
                Step {index + 1}
              </span>
              {!done && step.key === "verified" && (
                <span className="flex items-center gap-1 text-[10px] text-info font-semibold">
                  <Lock size={10} /> Admin only
                </span>
              )}
            </div>
            <p
              className={cn(
                "mt-0.5 font-bold text-sm",
                done ? "text-base-content/60 line-through" : "text-base-content"
              )}
            >
              {step.title}
            </p>
          </div>

          {/* Expand Arrow */}
          <ChevronRight
            size={18}
            className={cn(
              "flex-shrink-0 transition-all duration-300",
              isSelected
                ? "rotate-90 text-primary"
                : "text-base-content/25 group-hover:text-base-content/50"
            )}
          />
        </div>

        {/* Expanded Content */}
        <AnimatePresence>
          {isSelected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-5 pt-0 border-t border-base-300/60 mt-1">
                <p className="mt-4 text-xs text-base-content/65 leading-relaxed">
                  {step.description}
                </p>

                {/* Helpful Tip */}
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-base-200/70 p-3 border border-base-300">
                  <Sparkles size={13} className="flex-shrink-0 mt-0.5 text-warning" />
                  <p className="text-[11px] font-medium text-base-content/70 leading-relaxed">
                    {step.tip}
                  </p>
                </div>

                {/* Call to Action */}
                {step.action && step.href && !done && (
                  <Link href={step.href}>
                    <span className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-content transition-all duration-200 hover:opacity-90 hover:gap-3 cursor-pointer">
                      {step.action}
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                )}

                {/* Completed State Indicator */}
                {done && (
                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-success bg-success/10 w-fit px-3 py-1.5 rounded-lg border border-success/20">
                    <CheckCircle2 size={15} />
                    Completed
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Vertical Connector Line */}
      {!isLast && (
        <div className="flex justify-start pl-[2.375rem] my-1.5">
          <div
            className={cn(
              "w-0.5 h-5 rounded-full transition-colors duration-500",
              done ? "bg-success" : "bg-base-300"
            )}
          />
        </div>
      )}
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// CIRCULAR PROGRESS COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const CircularProgress = ({ percent }) => {
  const r = 54;
  const circum = 2 * Math.PI * r;
  const dashOffset = circum * (1 - percent / 100);

  const strokeColorClass =
    percent === 100 ? "text-success" : percent >= 60 ? "text-primary" : "text-warning";

  return (
    <div className="relative w-32 h-32 sm:w-36 sm:h-36 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        {/* Track */}
        <circle cx="64" cy="64" r={r} fill="none" className="stroke-base-300" strokeWidth="10" />
        {/* Progress */}
        <motion.circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          className={strokeColorClass}
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circum}
          initial={{ strokeDashoffset: circum }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, delay: 0.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="text-2xl sm:text-3xl font-black text-base-content"
        >
          {percent}%
        </motion.span>
        <span className="text-[9px] sm:text-[10px] text-base-content/45 font-semibold uppercase tracking-wider">
          Complete
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ONBOARDING COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Onboarding() {
  const dispatch = useDispatch();
  const onboarding = useSelector(selectOnboarding);
  const loading = useSelector(isLoading(fetchOnboardingThunk));

  const [selected, setSelected] = useState(null);

  useEffect(() => {
    dispatch(fetchOnboarding());
  }, [dispatch]);

  const checklist = onboarding?.checklist ?? {};
  const percent = onboarding?.percentComplete ?? 0;
  const completedSteps = onboarding?.completedSteps ?? 0;
  const totalSteps = onboarding?.totalSteps ?? STEPS.length;

  const nextPending = STEPS.find((s) => !checklist[s.key]);

  // Auto-expand the first incomplete step on load
  useEffect(() => {
    if (!selected && nextPending) setSelected(nextPending.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextPending?.key]);

  // Loader state
  if (loading && !onboarding) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-2 border-base-300 border-t-primary"
          />
          <p className="text-xs font-bold text-base-content/40 uppercase tracking-widest">
            Loading Onboarding...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-1 sm:p-4">
      {/* ── Page Header ── */}
      <motion.div
        variants={fadeUp}
        custom={0}
        initial="hidden"
        animate="visible"
        className="mb-8 pl-1"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
          Setup Progress
        </span>
        <h1 className="mt-1 text-2xl sm:text-3xl font-black text-base-content leading-tight">
          Hospital Onboarding
        </h1>
        <p className="mt-2 text-xs text-base-content/60 max-w-xl leading-relaxed">
          Complete the foundational steps below to get your facility verified and
          ready to accept patient bookings on the MedCore platform.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* ── Left Column: Step Cards ── */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="space-y-0 relative">
            {STEPS.map((step, i) => (
              <StepCard
                key={step.key}
                step={step}
                done={!!checklist[step.key]}
                index={i}
                isLast={i === STEPS.length - 1}
                selected={selected}
                onSelect={(key) => setSelected((prev) => (prev === key ? null : key))}
              />
            ))}
          </div>
        </div>

        {/* ── Right Column: Progress & Summary ── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Progress Overview Card */}
          <motion.div
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm"
          >
            <h3 className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest mb-6">
              Overall Progress
            </h3>

            <div className="flex items-center gap-5 sm:gap-6">
              <CircularProgress percent={percent} />
              <div>
                <p className="text-3xl sm:text-4xl font-black text-base-content">
                  {completedSteps}
                  <span className="text-lg text-base-content/30">/{totalSteps}</span>
                </p>
                <p className="text-[10px] text-base-content/50 uppercase tracking-wider mt-1 font-semibold">
                  Steps Completed
                </p>

                {percent < 100 && nextPending && (
                  <div className="mt-4 flex items-start gap-2 text-[11px] text-warning font-semibold bg-warning/10 px-2.5 py-1.5 rounded-lg border border-warning/20">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>Next: {nextPending.title}</span>
                  </div>
                )}
                {percent === 100 && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="mt-4 flex items-center gap-2 text-[11px] font-bold text-success bg-success/10 px-2.5 py-1.5 rounded-lg border border-success/20"
                  >
                    <CheckCircle2 size={14} />
                    All steps done!
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Checklist Summary Card */}
          <motion.div
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm"
          >
            <h3 className="text-[10px] font-bold text-base-content/50 uppercase tracking-widest mb-5">
              Requirements Checklist
            </h3>
            <div className="space-y-3">
              {STEPS.map((step) => {
                const done = !!checklist[step.key];
                return (
                  <motion.div
                    key={step.key}
                    variants={slideIn}
                    initial="hidden"
                    animate="visible"
                    className="flex items-center gap-3"
                  >
                    {done ? (
                      <CheckCircle2 size={16} className="flex-shrink-0 text-success" />
                    ) : (
                      <Circle size={16} className="flex-shrink-0 text-base-content/20" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-medium",
                        done ? "text-base-content/40 line-through" : "text-base-content/80"
                      )}
                    >
                      {step.title}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Dynamic CTA Card */}
          {percent > 0 && percent < 100 && (
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="visible"
              className="rounded-2xl overflow-hidden relative bg-primary p-6 shadow-lg shadow-primary/20 text-primary-content"
            >
              {/* Decorative Background Elements */}
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
              <div className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

              <div className="relative z-10">
                <Zap size={22} className="text-primary-content/80 mb-3" />
                <p className="font-black text-lg text-base-100 leading-snug">Keep going!</p>
                <p className="text-primary-content/80 text-xs mt-1 mb-5 leading-relaxed">
                  You are {totalSteps - completedSteps} step
                  {totalSteps - completedSteps > 1 ? "s" : ""} away from being
                  fully set up on the platform.
                </p>
                {nextPending?.href && (
                  <Link href={nextPending.href}>
                    <span className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-primary-content text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer">
                      Continue Setup <ArrowRight size={14} />
                    </span>
                  </Link>
                )}
              </div>
            </motion.div>
          )}

          {percent === 100 && (
            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="visible"
              className="rounded-2xl overflow-hidden relative bg-success p-6 shadow-lg shadow-success/20 text-success-content"
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 pointer-events-none" />
              
              <div className="relative z-10">
                <ShieldCheck size={26} className="mb-3 opacity-90" />
                <p className="font-black text-lg">Onboarding Complete!</p>
                <p className="text-success-content/85 text-xs mt-1.5 leading-relaxed">
                  Your profile is currently under review by the administration
                  team. You will be notified within 24–48 hours once verified.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}