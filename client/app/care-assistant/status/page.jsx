"use client";

/**
 * Status Page
 * Route: app/care-assistant/status/page.jsx
 * Redux: updateStatus, getProfile (careAssistantSlice)
 */

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Coffee,
  WifiOff,
  Briefcase,
  AlertCircle,
  Loader2,
  X,
  Activity,
  Info,
  Zap,
  Clock,
  ShieldAlert,
} from "lucide-react";
import {
  updateStatus,
  getProfile,
  selectProfile,
  selectLoading,
  selectErrors,
  clearError,
  selectCurrentStatus,
  selectIsOnline,
} from "@/store/slices/careAssistantSlice";

// ─── Status definitions ───────────────────────────────────────────────────────
const STATUSES = [
  {
    key: "Available",
    label: "Available",
    emoji: "🟢",
    icon: <CheckCircle2 size={22} />,
    color: "var(--success)",
    bg: "color-mix(in srgb, var(--success), transparent 82%)",
    border: "color-mix(in srgb, var(--success), transparent 55%)",
    selfSet: true,
    note: "You are ready to accept new care requests. Patients nearby can book you. Keep your phone handy for incoming alerts.",
    tips: [
      "Make sure your location is up to date",
      "Have your care kit ready before going available",
      "Check your schedule before setting this status",
    ],
  },
  {
    key: "On-Break",
    label: "On Break",
    emoji: "🟡",
    icon: <Coffee size={22} />,
    color: "var(--warning)",
    bg: "color-mix(in srgb, var(--warning), transparent 82%)",
    border: "color-mix(in srgb, var(--warning), transparent 55%)",
    selfSet: true,
    note: "You are resting temporarily. No new booking requests will be assigned to you during a break.",
    tips: [
      "Use break time to hydrate and rest",
      "Inform your current patient if you have one",
      "Resume Available status when you're ready",
    ],
  },
  {
    key: "Offline",
    label: "Offline",
    emoji: "⚫",
    icon: <WifiOff size={22} />,
    color: "var(--base-content)",
    bg: "color-mix(in srgb, var(--base-content), transparent 88%)",
    border: "color-mix(in srgb, var(--base-content), transparent 70%)",
    selfSet: true,
    note: "You are not available. No bookings will be routed to you until you go online again.",
    tips: [
      "Go offline at the end of your shift",
      "Ensure all active tasks are completed first",
      "Your earnings remain safe while you're offline",
    ],
  },
  {
    key: "On-Task",
    label: "On Task",
    emoji: "🔵",
    icon: <Briefcase size={22} />,
    color: "var(--info)",
    bg: "color-mix(in srgb, var(--info), transparent 82%)",
    border: "color-mix(in srgb, var(--info), transparent 55%)",
    selfSet: false,
    note: "You are currently performing a care booking. This status is set automatically by the system when a task is active.",
    tips: [
      "This status is set automatically — you cannot change it manually",
      "Focus on delivering quality care to your patient",
      "The system will return you to Available once the task ends",
    ],
  },
  {
    key: "Suspended",
    label: "Suspended",
    emoji: "🔴",
    icon: <ShieldAlert size={22} />,
    color: "var(--error)",
    bg: "color-mix(in srgb, var(--error), transparent 82%)",
    border: "color-mix(in srgb, var(--error), transparent 55%)",
    selfSet: false,
    note: "Your account has been suspended by the admin team. Contact support to resolve this.",
    tips: [
      "This status is applied by admin only",
      "Check your registered email for details",
      "Reach out to support@likeson.in for resolution",
    ],
  },
];

export default function StatusPage() {
  const dispatch      = useDispatch();
  const profile       = useSelector(selectProfile);
  const loading       = useSelector(selectLoading);
  const errors        = useSelector(selectErrors);
  const currentStatus = useSelector(selectCurrentStatus);
  const isOnline      = useSelector(selectIsOnline);

  useEffect(() => {
    if (!profile) dispatch(getProfile());
  }, [dispatch, profile]);

  const handleStatus = async (statusKey) => {
    if (statusKey === currentStatus) return;
    await dispatch(updateStatus({ status: statusKey }));
  };

  const activeConfig = STATUSES.find((s) => s.key === currentStatus) || STATUSES[2];

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-5 pb-3 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[14px] border-b border-base-300"
       
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: activeConfig.color }}>
            Activity Status
          </p>
          <h1 className="!text-xl !font-black !leading-tight text-base-content">
            My Status
          </h1>
          <p className="text-xs mt-0.5 text-base-content opacity-50">
            Let patients and the platform know your current activity
          </p>
        </motion.div>
      </div>

      <div className="px-4 py-5 pb-24 space-y-5">
        {/* ── Error ── */}
        <AnimatePresence>
          {errors.status && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert alert-error">
              <AlertCircle size={14} />
              <p className="text-xs flex-1">{errors.status}</p>
              <button onClick={() => dispatch(clearError("status"))}><X size={12} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Current status hero ── */}
        <motion.div
          key={currentStatus}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl p-5 flex items-start gap-4"
          style={{ background: activeConfig.bg, border: `2px solid ${activeConfig.border}` }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[white]"
            style={{ color: activeConfig.color }}
          >
            {activeConfig.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base">{activeConfig.emoji}</span>
              <p className="text-base font-black" style={{ color: activeConfig.color }}>
                {activeConfig.label}
              </p>
              <span
                className="ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/70"
                style={{ color: activeConfig.color }}
              >
                Current
              </span>
            </div>
            <p className="text-[11px] mt-1 text-base-content opacity-65">
              {activeConfig.note}
            </p>
          </div>
        </motion.div>

        {/* ── Offline warning ── */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[color-mix(in srgb, var(--warning), transparent 88%)]"
           
          >
            <Info size={13} className="shrink-0 mt-0.5 text-warning" />
            <p className="text-[11px] text-warning">
              You're currently offline. Go to the Availability page and toggle Online first before changing your status.
            </p>
          </motion.div>
        )}

        {/* ── Status picker ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Activity size={14} className="text-primary" />
            <p className="text-xs font-bold text-base-content">
              Change Status
            </p>
          </div>

          {STATUSES.map((s, i) => {
            const isActive  = currentStatus === s.key;
            const canChange = s.selfSet && isOnline;

            return (
              <motion.button
                key={s.key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => canChange && handleStatus(s.key)}
                disabled={!canChange || loading.status}
                whileTap={canChange ? { scale: 0.98 } : {}}
                className="w-full text-left p-4 rounded-2xl border-2 transition-all"
                style={{
                  background: isActive ? s.bg : "var(--base-200)",
                  borderColor: isActive ? s.color : "transparent",
                  opacity: !canChange && !isActive ? 0.5 : 1,
                  cursor: canChange ? "pointer" : "not-allowed",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: isActive ? "rgba(255,255,255,0.6)" : "var(--base-300)",
                      color: isActive ? s.color : "var(--base-content)",
                    }}
                  >
                    {loading.status && isActive
                      ? <Loader2 size={18} className="animate-spin" />
                      : <span className="text-base">{s.emoji}</span>
                    }
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: isActive ? s.color : "var(--base-content)" }}>
                        {s.label}
                      </p>
                      {!s.selfSet && (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[color-mix(in srgb, var(--base-content), transparent 85%)] text-base-content"
                         
                        >
                          System Only
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] mt-0.5 text-base-content opacity-55">
                      {s.note}
                    </p>
                  </div>
                  {isActive && (
                    <div
                      className="status-dot status-dot-success shrink-0 mt-1"
                      style={{ background: s.color }}
                    />
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* ── Tips for current status ── */}
        <div className="glass-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={13} style={{ color: activeConfig.color }} />
            <p className="text-xs font-bold text-base-content">
              Tips for "{activeConfig.label}" status
            </p>
          </div>
          {activeConfig.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <Clock size={11} className="shrink-0 mt-0.5" style={{ color: activeConfig.color }} />
              <p className="text-[11px] text-base-content opacity-60">{tip}</p>
            </div>
          ))}
        </div>

        {/* ── Status history note ── */}
        <div
          className="flex items-start gap-2 px-3 py-3 rounded-xl bg-[color-mix(in srgb, var(--info), transparent 90%)]"
         
        >
          <Info size={12} className="shrink-0 mt-0.5 text-info" />
          <p className="text-[11px] text-info">
            Status changes are logged by the system. Your availability history may be reviewed during performance evaluations.
          </p>
        </div>
      </div>
    </div>
  );
}