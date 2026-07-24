"use client";

/**
 * Schedule Page
 * Route: app/care-assistant/schedule/page.jsx
 * Redux: getSchedule, updateSchedule (careAssistantSlice)
 */

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Briefcase,
  Info,
  Sun,
  Moon,
  Zap,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getSchedule,
  updateSchedule,
  selectSchedule,
  selectLoading,
  selectErrors,
  clearError,
} from "@/store/slices/careAssistantSlice";

// ─── Day config ────────────────────────────────────────────────────────────────
const DAYS = [
  { key: "monday",    label: "Monday",    short: "Mon", emoji: "🌅" },
  { key: "tuesday",   label: "Tuesday",   short: "Tue", emoji: "☀️" },
  { key: "wednesday", label: "Wednesday", short: "Wed", emoji: "🌤️" },
  { key: "thursday",  label: "Thursday",  short: "Thu", emoji: "⛅" },
  { key: "friday",    label: "Friday",    short: "Fri", emoji: "🌇" },
  { key: "saturday",  label: "Saturday",  short: "Sat", emoji: "🌴" },
  { key: "sunday",    label: "Sunday",    short: "Sun", emoji: "🏠" },
];

const WORK_TYPES = [
  {
    key: "Full-Time",
    label: "Full-Time",
    icon: "🌟",
    note: "You work 6–7 days a week, typically 8+ hours a day. Best for those who want maximum bookings.",
  },
  {
    key: "Part-Time",
    label: "Part-Time",
    icon: "⏰",
    note: "You work a few days a week or shorter shifts. Great for those balancing other responsibilities.",
  },
  {
    key: "Flexible",
    label: "Flexible",
    icon: "🔄",
    note: "You set your own hours day by day. Ideal if your availability changes regularly.",
  },
];

const TIME_SLOTS = [
  "06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00",
];

const MAX_HOURS = [2, 4, 6, 8, 10, 12];

const defaultDay = () => ({
  isAvailable:    false,
  startTime:      "09:00",
  endTime:        "18:00",
  maxHoursPerDay: 8,
});

// ─── Time display helper ──────────────────────────────────────────────────────
const formatTime = (t) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour   = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, "0")} ${suffix}`;
};

const calcHours = (start, end) => {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60).toFixed(1);
};

// ─── Single Day Card ─────────────────────────────────────────────────────────
function DayCard({ dayConfig, value, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const data = value || defaultDay();

  const toggle = () => {
    const next = { ...data, isAvailable: !data.isAvailable };
    onChange(next);
    if (!data.isAvailable) setExpanded(true);
  };

  const set = (k, v) => onChange({ ...data, [k]: v });

  const hours = calcHours(data.startTime, data.endTime);

  return (
    <motion.div
      layout
      className="card overflow-hidden"
      style={{ borderColor: data.isAvailable ? "var(--primary)" : "var(--base-300)" }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => data.isAvailable && setExpanded((e) => !e)}
      >
        {/* Toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); toggle(); }}
          className="relative w-12 h-6 rounded-full shrink-0 transition-all duration-300"
          style={{ background: data.isAvailable ? "var(--success)" : "var(--base-300)" }}
        >
          <motion.div
            className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow"
            animate={{ x: data.isAvailable ? 26 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>

        <span className="text-base shrink-0">{dayConfig.emoji}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-base-content">
            {dayConfig.label}
          </p>
          {data.isAvailable ? (
            <p className="text-[11px] text-success">
              {formatTime(data.startTime)} → {formatTime(data.endTime)} · {hours}h
            </p>
          ) : (
            <p className="text-[11px] text-base-content opacity-40">
              Not available
            </p>
          )}
        </div>

        {data.isAvailable && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((e) => !e); }}
            className="text-base-content opacity-40"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {data.isAvailable && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 space-y-4 border-t border-base-300 pt-[12px]"
             
            >
              {/* Start time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold flex items-center gap-1 text-base-content">
                    <Sun size={11} className="text-warning" />
                    Start Time
                  </label>
                  <p className="text-[10px] text-base-content opacity-40">
                    When you begin your shift
                  </p>
                  <select
                    value={data.startTime}
                    onChange={(e) => set("startTime", e.target.value)}
                    className="input-field w-full text-xs"
                  >
                    {TIME_SLOTS.map((t) => <option key={t} value={t}>{formatTime(t)}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold flex items-center gap-1 text-base-content">
                    <Moon size={11} className="text-primary" />
                    End Time
                  </label>
                  <p className="text-[10px] text-base-content opacity-40">
                    When your shift ends
                  </p>
                  <select
                    value={data.endTime}
                    onChange={(e) => set("endTime", e.target.value)}
                    className="input-field w-full text-xs"
                  >
                    {TIME_SLOTS.filter((t) => t > data.startTime).map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Max hours */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold flex items-center gap-1 text-base-content">
                  <Clock size={11} className="text-info" />
                  Max Hours Per Day
                </label>
                <p className="text-[10px] text-base-content opacity-40">
                  Maximum you want to work in a single day — even if bookings are available beyond this.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {MAX_HOURS.map((h) => (
                    <button
                      key={h}
                      onClick={() => set("maxHoursPerDay", h)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: data.maxHoursPerDay === h ? "var(--primary)" : "var(--base-200)",
                        color: data.maxHoursPerDay === h ? "var(--primary-content)" : "var(--base-content)",
                      }}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[color-mix(in srgb, var(--success), transparent 90%)]"
               
              >
                <CheckCircle2 size={12} className="text-success" />
                <p className="text-[11px] text-success">
                  {formatTime(data.startTime)} to {formatTime(data.endTime)}, up to {data.maxHoursPerDay}h active work
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const dispatch = useDispatch();
  const schedule = useSelector(selectSchedule);
  const loading  = useSelector(selectLoading);
  const errors   = useSelector(selectErrors);

  const [workType,     setWorkType]     = useState("Part-Time");
  const [days,         setDays]         = useState({});
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const [expandAll,    setExpandAll]    = useState(false);

  useEffect(() => {
    dispatch(getSchedule());
  }, [dispatch]);

  useEffect(() => {
    if (schedule) {
      setWorkType(schedule.workType || "Part-Time");
      setDays(schedule.weeklySchedule || {});
    }
  }, [schedule]);

  const handleDayChange = (dayKey, data) => {
    setDays((prev) => ({ ...prev, [dayKey]: data }));
  };

  const activeDaysCount = DAYS.filter((d) => days[d.key]?.isAvailable).length;
  const totalWeeklyHours = DAYS.reduce((sum, d) => {
    const data = days[d.key];
    if (!data?.isAvailable) return sum;
    return sum + parseFloat(calcHours(data.startTime, data.endTime) || 0);
  }, 0);

  const handleSave = async () => {
    const payload = { workType };
    DAYS.forEach((d) => {
      if (days[d.key]) payload[d.key] = days[d.key];
    });
    const result = await dispatch(updateSchedule(payload));
    if (!result.error) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Sticky header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-5 pb-3 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[14px] border-b border-base-300"
       
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5 text-primary">
            Weekly Planner
          </p>
          <h1 className="!text-xl !font-black !leading-tight text-base-content">
            My Schedule
          </h1>
          <p className="text-xs mt-0.5 text-base-content opacity-50">
            Set your working days and shift hours for each week
          </p>
        </motion.div>
      </div>

      <div className="px-4 py-5 pb-24 space-y-5">
        {/* ── Errors ── */}
        <AnimatePresence>
          {errors.schedule && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert alert-error">
              <AlertCircle size={14} />
              <p className="text-xs flex-1">{errors.schedule}</p>
              <button onClick={() => dispatch(clearError("schedule"))}><X size={12} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Success ── */}
        <AnimatePresence>
          {saveSuccess && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert alert-success">
              <CheckCircle2 size={14} />
              <p className="text-xs font-semibold">Schedule saved successfully!</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Weekly summary stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active Days", value: activeDaysCount, icon: <Calendar size={16} />, color: "var(--primary)" },
            { label: "Weekly Hours", value: `${totalWeeklyHours.toFixed(0)}h`, icon: <Clock size={16} />, color: "var(--info)" },
            { label: "Work Type", value: workType.split("-")[0], icon: <Briefcase size={16} />, color: "var(--accent)" },
          ].map((stat) => (
            <div key={stat.label} className="stat-card text-center">
              <div className="flex justify-center mb-1" style={{ color: stat.color }}>{stat.icon}</div>
              <p className="stat-card-value !text-base" style={{ color: stat.color }}>{stat.value}</p>
              <p className="stat-card-label">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* ── Work Type selector ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Briefcase size={14} className="text-primary" />
            <p className="text-xs font-bold text-base-content">Work Arrangement</p>
          </div>
          <p className="text-[11px] px-1 text-base-content opacity-45">
            Choose how you generally work. This helps the platform understand your availability pattern and match you with suitable bookings.
          </p>
          <div className="space-y-2">
            {WORK_TYPES.map((wt) => {
              const isActive = workType === wt.key;
              return (
                <button
                  key={wt.key}
                  onClick={() => setWorkType(wt.key)}
                  className="w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3"
                  style={{
                    background: isActive ? "color-mix(in srgb, var(--primary), transparent 88%)" : "var(--base-200)",
                    borderColor: isActive ? "var(--primary)" : "transparent",
                  }}
                >
                  <span className="text-xl shrink-0">{wt.icon}</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: isActive ? "var(--primary)" : "var(--base-content)" }}>
                      {wt.label}
                    </p>
                    <p className="text-[11px] mt-0.5 text-base-content opacity-55">
                      {wt.note}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Day-wise schedule ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-primary" />
              <p className="text-xs font-bold text-base-content">Day-by-Day Schedule</p>
            </div>
            <button
              onClick={() => setExpandAll((e) => !e)}
              className="text-[11px] font-semibold text-primary"
             
            >
              {expandAll ? "Collapse all" : "Expand all"}
            </button>
          </div>

          <div
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[color-mix(in srgb, var(--info), transparent 90%)]"
           
          >
            <Info size={12} className="shrink-0 mt-0.5 text-info" />
            <p className="text-[11px] text-info">
              Toggle each day ON to mark it as a working day. Then set your start time, end time, and maximum hours. Only available days will be matched with bookings.
            </p>
          </div>

          {loading.schedule && !schedule ? (
            <div className="space-y-2">
              {DAYS.map((d) => <div key={d.key} className="skeleton h-16 rounded-xl" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {DAYS.map((d, i) => (
                <motion.div
                  key={d.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <DayCard
                    dayConfig={d}
                    value={days[d.key] || defaultDay()}
                    onChange={(data) => handleDayChange(d.key, data)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ── Weekend note ── */}
        {(days.saturday?.isAvailable || days.sunday?.isAvailable) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[color-mix(in srgb, var(--warning), transparent 88%)]"
           
          >
            <Info size={12} className="shrink-0 mt-0.5 text-warning" />
            <p className="text-[11px] text-warning">
              You're available on weekends! Weekend bookings often have higher demand. Ensure you've planned for personal rest time too.
            </p>
          </motion.div>
        )}

        {/* ── Save button ── */}
        <button
          onClick={handleSave}
          disabled={loading.schedule}
          className="btn-primary-cta w-full flex items-center justify-center gap-2"
        >
          {loading.schedule
            ? <Loader2 size={16} className="animate-spin" />
            : <Zap size={16} />
          }
          {loading.schedule ? "Saving Schedule…" : "Save Weekly Schedule"}
        </button>

        {/* ── Help card ── */}
        <div className="glass-card p-4 space-y-2">
          <p className="text-xs font-bold text-base-content">📅 Schedule Tips</p>
          {[
            "Your schedule is used by the system to route bookings to you only on your available days.",
            "Bookings won't be sent to you outside your set start and end times.",
            "Max hours per day protects you from being overbooked on a single day.",
            "You can update your schedule anytime — changes take effect immediately.",
            "A consistent schedule improves your ranking and patient trust score.",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-1 h-1 rounded-full mt-1.5 shrink-0 bg-primary" />
              <p className="text-[11px] text-base-content opacity-60">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}