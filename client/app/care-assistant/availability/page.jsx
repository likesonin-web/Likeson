"use client";

/**
 * Availability Page
 * Route: app/care-assistant/availability/page.jsx
 * Redux: updateAvailability, updateStatus, getProfile (careAssistantSlice)
 */

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wifi,
  WifiOff,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  MapPin,
  Bell,
  X,
  Activity,
  Moon,
  Sun,
  Zap,
  Info,
} from "lucide-react";
import {
  updateAvailability,
  updateStatus,
  getProfile,
  selectProfile,
  selectLoading,
  selectErrors,
  clearError,
  selectIsOnline,
  selectCurrentStatus,
  setOnlineOptimistic,
} from "@/store/slices/careAssistantSlice";

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  {
    key: "Available",
    label: "Available",
    icon: <CheckCircle2 size={18} />,
    color: "var(--success)",
    bg: "color-mix(in srgb, var(--success), transparent 85%)",
    note: "You are ready to accept new care bookings. Patients can find and book you.",
  },
  {
    key: "On-Break",
    label: "On Break",
    icon: <Coffee size={18} />,
    color: "var(--warning)",
    bg: "color-mix(in srgb, var(--warning), transparent 85%)",
    note: "Taking a short break. You won't receive new booking requests temporarily.",
  },
  {
    key: "Offline",
    label: "Offline",
    icon: <WifiOff size={18} />,
    color: "var(--base-content)",
    bg: "color-mix(in srgb, var(--base-content), transparent 85%)",
    note: "You are not available. No booking requests will be sent to you.",
  },
];

const NOTICE_OPTIONS = [
  { value: 15,  label: "15 min", note: "You can start a booking within 15 minutes of accepting" },
  { value: 30,  label: "30 min", note: "Standard lead time — most patients prefer this" },
  { value: 60,  label: "1 hour", note: "Good if you travel from a distance" },
  { value: 120, label: "2 hours", note: "Extra buffer time before you arrive" },
  { value: 240, label: "4 hours", note: "Plan-ahead bookings only" },
];

export default function AvailabilityPage() {
  const dispatch       = useDispatch();
  const profile        = useSelector(selectProfile);
  const loading        = useSelector(selectLoading);
  const errors         = useSelector(selectErrors);
  const isOnline       = useSelector(selectIsOnline);
  const currentStatus  = useSelector(selectCurrentStatus);

  const [city, setCity]             = useState("");
  const [notice, setNotice]         = useState(30);
  const [toggling, setToggling]     = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!profile) dispatch(getProfile());
  }, [dispatch, profile]);

  useEffect(() => {
    if (profile) {
      setCity(profile.availability?.currentCity || "");
      setNotice(profile.availability?.minNoticeMinutes || 30);
    }
  }, [profile]);

  // ── Toggle online/offline ──────────────────────────────────────────────────
  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    dispatch(setOnlineOptimistic(!isOnline));
    const result = await dispatch(
      updateAvailability({ isOnline: !isOnline, currentCity: city })
    );
    if (result.error) {
      dispatch(setOnlineOptimistic(isOnline)); // revert on error
    }
    setToggling(false);
  };

  // ── Save city + notice settings ────────────────────────────────────────────
  const handleSaveSettings = async () => {
    const result = await dispatch(
      updateAvailability({ currentCity: city, minNoticeMinutes: notice })
    );
    if (!result.error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  // ── Set status ─────────────────────────────────────────────────────────────
  const handleStatus = async (status) => {
    if (status === currentStatus) return;
    await dispatch(updateStatus({ status }));
  };

  const activeStatus = STATUS_OPTIONS.find((s) => s.key === currentStatus) || STATUS_OPTIONS[2];

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-5 pb-3 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[14px] border-b border-base-300"
       
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5 text-primary">
            Work Status
          </p>
          <h1 className="!text-xl !font-black !leading-tight text-base-content">
            Availability
          </h1>
          <p className="text-xs mt-0.5 text-base-content opacity-50">
            Control when and where you accept care bookings
          </p>
        </motion.div>
      </div>

      <div className="px-4 py-5 pb-24 space-y-5">
        {/* ── Error banner ── */}
        <AnimatePresence>
          {(errors.availability || errors.status) && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert alert-error">
              <AlertCircle size={14} />
              <p className="text-xs flex-1">{errors.availability || errors.status}</p>
              <button onClick={() => { dispatch(clearError("availability")); dispatch(clearError("status")); }}>
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Online / Offline Big Toggle ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-6 flex flex-col items-center gap-4"
        >
          {/* Pulsing indicator */}
          <div className="relative">
            {isOnline && (
              <motion.div
                className="absolute inset-0 rounded-full bg-success"
               
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <div
              className="relative w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: isOnline
                  ? "color-mix(in srgb, var(--success), transparent 80%)"
                  : "color-mix(in srgb, var(--base-content), transparent 90%)",
              }}
            >
              {isOnline
                ? <Wifi size={32} className="text-success" />
                : <WifiOff size={32} className="text-base-content opacity-40" />
              }
            </div>
          </div>

          <div className="text-center">
            <p className="text-base font-black text-base-content">
              You are currently{" "}
              <span style={{ color: isOnline ? "var(--success)" : "var(--base-content)" }}>
                {isOnline ? "Online" : "Offline"}
              </span>
            </p>
            <p className="text-xs mt-1 text-base-content opacity-50">
              {isOnline
                ? "Patients can find and book you right now"
                : "You won't receive any booking requests"}
            </p>
          </div>

          {/* Toggle switch */}
          <button
            onClick={handleToggle}
            disabled={toggling || loading.availability}
            className="relative w-20 h-10 rounded-full transition-all duration-300 flex items-center p-[3px]"
            style={{ background: isOnline ? "var(--success)" : "var(--base-300)" }}
          >
            <motion.div
              layout
              className="w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-[white]"
             
              animate={{ x: isOnline ? 40 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {toggling
                ? <Loader2 size={14} className="animate-spin text-base-300" />
                : isOnline
                  ? <Sun size={14} className="text-success" />
                  : <Moon size={14} className="text-base-300" />
              }
            </motion.div>
          </button>

          <p className="text-[11px] text-center text-base-content opacity-40">
            {toggling ? "Updating your status…" : "Tap the toggle to go online or offline"}
          </p>
        </motion.div>

        {/* ── Status selector (only when online) ── */}
        <AnimatePresence>
          {isOnline && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-1">
                <Activity size={14} className="text-primary" />
                <p className="text-xs font-bold text-base-content">
                  Current Activity Status
                </p>
              </div>
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-xl bg-[color-mix(in srgb, var(--info), transparent 90%)]"
               
              >
                <Info size={12} className="shrink-0 mt-0.5 text-info" />
                <p className="text-[11px] text-info">
                  Set your current activity so patients know if you're ready, on a short break, or stepping away.
                </p>
              </div>

              <div className="space-y-2">
                {STATUS_OPTIONS.map((s) => {
                  const isActive = currentStatus === s.key;
                  return (
                    <motion.button
                      key={s.key}
                      onClick={() => handleStatus(s.key)}
                      disabled={loading.status}
                      whileTap={{ scale: 0.98 }}
                      className="w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3"
                      style={{
                        background: isActive ? s.bg : "var(--base-200)",
                        borderColor: isActive ? s.color : "transparent",
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: isActive ? s.bg : "var(--base-300)", color: isActive ? s.color : "var(--base-content)" }}
                      >
                        {loading.status && currentStatus !== s.key ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : s.icon}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold" style={{ color: isActive ? s.color : "var(--base-content)" }}>
                            {s.label}
                          </p>
                          {isActive && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 text-base-content opacity-55">
                          {s.note}
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Divider ── */}
        <div className="divider" />

        {/* ── Current City ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-primary" />
            <label className="text-xs font-bold text-base-content">
              Current City / Area
            </label>
          </div>
          <p className="text-[11px] px-1 text-base-content opacity-45">
            Tell patients which city or neighbourhood you're working in today. This helps them find you faster and improves your booking matches.
          </p>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Banjara Hills, Hyderabad"
            className="input-field w-full"
          />
        </div>

        {/* ── Minimum Notice ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-primary" />
            <label className="text-xs font-bold text-base-content">
              Minimum Notice Time
            </label>
          </div>
          <p className="text-[11px] px-1 text-base-content opacity-45">
            The minimum time you need before starting a booking after accepting it. Choose a realistic buffer so you can always arrive on time.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {NOTICE_OPTIONS.map((opt) => {
              const isActive = notice === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setNotice(opt.value)}
                  className="text-left p-3 rounded-xl border-2 transition-all"
                  style={{
                    background: isActive ? "color-mix(in srgb, var(--primary), transparent 88%)" : "var(--base-200)",
                    borderColor: isActive ? "var(--primary)" : "transparent",
                  }}
                >
                  <p className="text-sm font-bold" style={{ color: isActive ? "var(--primary)" : "var(--base-content)" }}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] mt-0.5 text-base-content opacity-50">
                    {opt.note}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Save settings button ── */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert alert-success">
              <CheckCircle2 size={14} />
              <p className="text-xs font-semibold">Availability settings saved!</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleSaveSettings}
          disabled={loading.availability}
          className="btn-primary-cta w-full flex items-center justify-center gap-2"
        >
          {loading.availability
            ? <Loader2 size={16} className="animate-spin" />
            : <Zap size={16} />
          }
          {loading.availability ? "Saving…" : "Save Availability Settings"}
        </button>

        {/* ── Info card ── */}
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Bell size={13} className="text-primary" />
            <p className="text-xs font-bold text-base-content">How availability works</p>
          </div>
          {[
            "Go Online to start receiving booking requests from patients nearby.",
            "Use On Break if you need a short rest — you won't get new requests.",
            "Go Offline at the end of your shift to stop all incoming bookings.",
            "Your city helps the system match you with nearby patients accurately.",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-[color-mix(in srgb, var(--primary), transparent 85%)]">
                <span className="text-[9px] font-black text-primary">{i + 1}</span>
              </div>
              <p className="text-[11px] text-base-content opacity-60">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}