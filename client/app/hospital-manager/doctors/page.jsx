"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Star,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  Eye,
  Trash2,
  Link2,
  Link2Off,
  Upload,
  ExternalLink,
  BarChart3,
  Calendar,
  Stethoscope,
  Award,
  AlertCircle,
  X,
  ArrowLeft,
  MoreVertical,
  RefreshCw,
  Building2,
  Phone,
  Mail,
  ImageIcon,
  FileText,
  Loader2,
  TrendingUp,
  Activity,
  Shield,
  ChevronRight,
  UserCheck,
  Clipboard,
  BookOpen,
  ChevronLeft,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  fetchLinkedDoctors,
  fetchLinkedDoctorById,
  searchUnlinkedDoctors,
  createAndOnboardDoctor,
  unlinkDoctor,
  fetchDoctorAvailability,
  fetchDoctorStats,
  selectLinkedDoctors,
  selectDoctorsPagination,
  selectSelectedDoctor,
  selectSearchResults,
  selectDoctorStats,
  selectDoctorAvailability,
  isLoading,
  getError,
} from "@/store/slices/hospitalManagerSlice";

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIALIZATIONS = [
  "General Physician",
  "Cardiologist",
  "Neurologist",
  "Pediatrician",
  "Oncologist",
  "Orthopedic Surgeon",
  "Gastroenterologist",
  "Gynecologist",
  "Dermatologist",
  "Urologist",
  "Psychiatry",
  "Physiotherapist",
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];

// ─── Animation Variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const slideRight = {
  hidden: { opacity: 0, x: -24 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, x: -24, transition: { duration: 0.22 } },
};

const slideLeft = {
  hidden: { opacity: 0, x: 32 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, x: 32, transition: { duration: 0.25 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.93 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
  },
  exit: { opacity: 0, scale: 0.93, transition: { duration: 0.18 } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const statusColor = (verified, active) => {
  if (!active) return "badge-error";
  if (verified) return "badge-success";
  return "badge-warning";
};

const statusLabel = (verified, active) => {
  if (!active) return "Inactive";
  if (verified) return "Verified";
  return "Pending";
};

// ─── Micro Components ─────────────────────────────────────────────────────────

const FieldNote = ({ children }) => (
  <p className="text-xs mt-0.5 text-base-content/50">{children}</p>
);

const FormField = ({
  label,
  note,
  required,
  error,
  children,
  className = "",
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <label className="text-xs font-semibold text-base-content">
      {label}
      {required && <span className="text-error ml-0.5">*</span>}
    </label>
    {children}
    {note && <FieldNote>{note}</FieldNote>}
    {error && <p className="text-xs text-error mt-0.5">{error}</p>}
  </div>
);

const DoctorAvatar = ({ doctor, size = 44 }) => {
  const name = doctor?.user?.name || doctor?.name || "";
  const photo = doctor?.profilePhotoUrl || doctor?.user?.avatar;
  return photo ? (
    <img
      src={photo}
      alt={name}
      className="rounded-full object-cover flex-shrink-0 ring-2 ring-primary/20"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full flex-shrink-0 flex items-center justify-center font-black text-xs bg-primary text-primary-content ring-2 ring-primary/20"
      style={{ width: size, height: size }}
    >
      {getInitials(name)}
    </div>
  );
};

const OnlineDot = ({ online }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-success animate-pulse" : "bg-base-300"}`}
  />
);

const DayPill = ({ day, available, slots }) => (
  <div className="flex flex-col items-center gap-1">
    <span
      className={`text-xs font-bold uppercase ${available ? "text-success" : "text-base-content/40"}`}
    >
      {day.slice(0, 3)}
    </span>
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2
        ${
          available
            ? "bg-success/10 text-success border-success"
            : "bg-base-300 text-base-content/40 border-base-300"
        }`}
    >
      {available ? slots : "—"}
    </div>
  </div>
);

// ─── Stat Tile ────────────────────────────────────────────────────────────────

const StatTile = ({ icon: Icon, label, value, color, index }) => (
  <motion.div
    variants={fadeUp}
    custom={index}
    initial="hidden"
    animate="visible"
    className="stat-card flex items-center gap-3 p-4"
    style={{ borderLeft: `3px solid ${color}` }}
  >
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: `color-mix(in oklch, ${color} 14%, transparent)` }}
    >
      <Icon size={20} style={{ color }} />
    </div>
    <div className="min-w-0">
      <p
        className="font-black leading-none"
        style={{
          color,
          fontSize: "1.45rem",
          fontFamily: "var(--font-display)",
        }}
      >
        {value}
      </p>
      <p className="stat-card-label text-xs truncate">{label}</p>
    </div>
  </motion.div>
);

// ─── Doctor Card ──────────────────────────────────────────────────────────────

const DoctorCard = ({ doctor, index, isSelected, onView, onUnlink }) => {
  const d = doctor;
  const name = d.user?.name || "Doctor";

  return (
    <motion.div
      variants={fadeUp}
      custom={index}
      initial="hidden"
      animate="visible"
      onClick={() => onView(d._id)}
      className={`card relative overflow-hidden cursor-pointer transition-all duration-200
        ${isSelected ? "ring-2 ring-primary border-primary/60 shadow-primary" : "hover:border-primary/30"}`}
    >
      {/* Selected indicator bar */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
      )}

      <div className="p-4">
        {/* Top row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative">
            <DoctorAvatar doctor={d} size={46} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-base-100
              ${d.isOnline ? "bg-success" : "bg-base-300"}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-black text-xs truncate"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Dr. {name}
            </h3>
            <p className="text-xs text-base-content/60 truncate mt-0.5">
              {d.specialization}
            </p>
            <span
              className={`badge badge-xs mt-1 ${statusColor(d.isVerified, d.isActive)}`}
            >
              {statusLabel(d.isVerified, d.isActive)}
            </span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnlink(d._id, name);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-error/10 text-error
              hover:bg-error/20 transition-colors flex-shrink-0 mt-0.5"
            title="Unlink doctor"
          >
            <Link2Off size={13} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: `${d.experienceYears || 0}y`, label: "Exp" },
            {
              val: (d.rating?.averageRating || 0).toFixed(1),
              label: "Rating",
              star: true,
            },
            {
              val: d.consultationTypes
                ? Object.values(d.consultationTypes).filter(Boolean).length
                : 0,
              label: "Types",
            },
          ].map(({ val, label, star }) => (
            <div
              key={label}
              className="text-center py-2 rounded-lg bg-base-200"
            >
              <div className="flex items-center justify-center gap-0.5">
                {star && (
                  <Star
                    size={9}
                    className="text-accent"
                    fill="var(--color-accent)"
                  />
                )}
                <span className="text-xs font-black text-primary">{val}</span>
              </div>
              <p className="text-xs text-base-content/50 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Analytics Panel ──────────────────────────────────────────────────────────

const AnalyticsPanel = ({ stats }) => {
  if (!stats) return null;

  const pieData =
    stats.bySpecialization?.slice(0, 6).map(({ _id, count }) => ({
      name: _id || "Other",
      value: count,
    })) || [];

  const barData = [
    { name: "Total", value: stats.total || 0, fill: "var(--color-chart-1)" },
    {
      name: "Verified",
      value: stats.verified || 0,
      fill: "var(--color-chart-2)",
    },
    { name: "Active", value: stats.active || 0, fill: "var(--color-chart-3)" },
    { name: "Online", value: stats.online || 0, fill: "var(--color-chart-4)" },
    {
      name: "Pending",
      value: stats.unverified || 0,
      fill: "var(--color-chart-6)",
    },
  ];

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5"
    >
      <div className="card p-5">
        <h3
          className="text-xs font-black mb-4 flex items-center gap-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <BarChart3 size={14} className="text-primary" /> Status Overview
        </h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={barData} barSize={26}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "var(--color-base-content)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--color-base-content)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-base-100)",
                border: "1px solid var(--color-base-300)",
                borderRadius: 10,
                fontSize: 11,
              }}
              cursor={{
                fill: "color-mix(in oklch, var(--color-primary) 8%, transparent)",
              }}
            />
            <Bar dataKey="value" radius={[5, 5, 0, 0]}>
              {barData.map((e, i) => (
                <Cell key={i} fill={e.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card p-5">
        <h3
          className="text-xs font-black mb-4 flex items-center gap-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <Activity size={14} className="text-secondary" /> By Specialization
        </h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={60}
                innerRadius={28}
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--color-base-100)",
                  border: "1px solid var(--color-base-300)",
                  borderRadius: 10,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 9 }} iconSize={7} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-36">
            <p className="text-xs text-base-content/40">No data</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Onboard Modal ────────────────────────────────────────────────────────────

const OnboardModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const loading = useSelector(isLoading(createAndOnboardDoctor));
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    specialization: "",
    experienceYears: "",
    registrationNumber: "",
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Full name required";
    if (!form.email.trim()) e.email = "Email required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.specialization) e.specialization = "Select specialization";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const result = await dispatch(
      createAndOnboardDoctor({
        ...form,
        experienceYears: Number(form.experienceYears) || 0,
      }),
    );
    if (!result.error) {
      dispatch(fetchLinkedDoctors());
      dispatch(fetchDoctorStats());
      onClose();
    }
  };

  const modalContent = (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        variants={scaleIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto
          rounded-t-3xl sm:rounded-2xl shadow-2xl bg-base-100"
      >
        {/* Header */}
        <div className="sticky top-0   flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary text-primary-content">
              <UserPlus size={19} />
            </div>
            <div>
              <h2
                className="text-base font-black"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Onboard New Doctor
              </h2>
              <p className="text-xs text-base-content/50">
                Create & link to your hospital
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-base-200 hover:bg-base-300 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5"
        >
          {/* Info alert */}
          <div className="col-span-full alert alert-info rounded-xl">
            <AlertCircle size={15} className="flex-shrink-0 text-info" />
            <div>
              <p className="text-xs font-semibold">Managed Hospital Pricing</p>
              <p className="text-xs text-base-content/60 mt-0.5">
                Doctor linked to your hospital. Fees governed by hospital
                pricing — doctor cannot set own fees.
              </p>
            </div>
          </div>

          <FormField
            label="Full Name"
            required
            note="As per medical council registration"
            error={errors.name}
          >
            <input
              className="input-field w-full"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Dr. Ravi Kumar"
            />
          </FormField>

          <FormField
            label="Email Address"
            required
            note="Login credentials sent to this email"
            error={errors.email}
          >
            <input
              type="email"
              className="input-field w-full"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="doctor@hospital.com"
            />
          </FormField>

          <FormField
            label="Phone Number"
            note="Indian mobile 10 digits — auto-formatted to +91XXXXXXXXXX"
          >
            <input
              type="tel"
              className="input-field w-full"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="9876543210"
            />
          </FormField>

          <FormField
            label="Specialization"
            required
            note="MCI classification"
            error={errors.specialization}
          >
            <select
              className="input-field w-full"
              value={form.specialization}
              onChange={(e) => set("specialization", e.target.value)}
            >
              <option value="">Select specialization…</option>
              {SPECIALIZATIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Years of Experience"
            note="0 for freshers. Range 0–70"
          >
            <input
              type="number"
              min={0}
              max={70}
              className="input-field w-full"
              value={form.experienceYears}
              onChange={(e) => set("experienceYears", e.target.value)}
              placeholder="5"
            />
          </FormField>

          <FormField
            label="MCI / State Council Reg. No."
            note="Leave blank if pending — doctor can add later"
          >
            <input
              className="input-field w-full"
              value={form.registrationNumber}
              onChange={(e) => set("registrationNumber", e.target.value)}
              placeholder="MH12345/2020"
            />
          </FormField>

          {/* Security note */}
          <div className="col-span-full rounded-xl p-4 flex gap-3 bg-warning/10 border border-warning/30">
            <Shield size={15} className="flex-shrink-0 mt-0.5 text-warning" />
            <p className="text-xs text-base-content/70">
              <strong>Secure temp password</strong> auto-generated & sent via
              email. Doctor must change on first login. All sessions audited.
            </p>
          </div>

          {/* Actions */}
          <div className="col-span-full flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost px-5 py-2.5 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-cta px-6 py-2.5 text-xs flex items-center gap-2"
            >
              {loading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <UserPlus size={15} />
              )}
              {loading ? "Creating…" : "Onboard Doctor"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
};

// ─── Search-Link Modal ────────────────────────────────────────────────────────

const SearchLinkModal = ({ onClose }) => {
  const dispatch = useDispatch();
  const searchResults = useSelector(selectSearchResults);
  const searchLoading = useSelector(isLoading(searchUnlinkedDoctors));
  const [query, setQuery] = useState("");
  const [spec, setSpec] = useState("");
  const [linking, setLinking] = useState(null);

  useEffect(() => {
    const t = setTimeout(
      () => dispatch(searchUnlinkedDoctors({ q: query, specialization: spec })),
      400,
    );
    return () => clearTimeout(t);
  }, [query, spec, dispatch]);

  const modalContent = (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        variants={scaleIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative w-full sm:max-w-lg max-h-[95vh] sm:max-h-[86vh] flex flex-col
          rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden bg-base-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-secondary text-secondary-content">
              <Link2 size={16} />
            </div>
            <h2
              className="text-base font-black"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Link Existing Doctor
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-base-200 hover:bg-base-300 transition-colors"
          >
            <X size={13} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 space-y-3 border-b border-base-300">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
            />
            <input
              className="input-field w-full pl-9 text-xs"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
            />
          </div>
          <select
            className="input-field w-full text-xs"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
          >
            <option value="">All Specializations</option>
            {SPECIALIZATIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <FieldNote>
            Only verified active doctors not yet linked appear here.
          </FieldNote>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {searchLoading && (
            <div className="flex items-center justify-center py-8 gap-2 text-primary">
              <Loader2 size={17} className="animate-spin" />
              <span className="text-xs">Searching…</span>
            </div>
          )}
          {!searchLoading && searchResults.length === 0 && (
            <div className="text-center py-10">
              <Users size={30} className="mx-auto mb-3 text-base-content/30" />
              <p className="text-xs font-semibold">No doctors found</p>
              <p className="text-xs mt-1 text-base-content/50">
                Try different name or onboard new
              </p>
            </div>
          )}
          {searchResults.map((doc) => (
            <div
              key={doc._id}
              className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-200"
            >
              <DoctorAvatar doctor={doc} size={38} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{doc.user?.name}</p>
                <p className="text-xs text-base-content/55 truncate">
                  {doc.specialization} · {doc.experienceYears}y
                </p>
                <p className="text-xs text-base-content/40 truncate">
                  {doc.user?.email}
                </p>
              </div>
              {doc.isVerified && (
                <CheckCircle2
                  size={14}
                  className="flex-shrink-0 text-success"
                />
              )}
              <button
                disabled={linking === doc._id}
                onClick={() => {
                  setLinking(doc._id);
                  setTimeout(() => {
                    setLinking(null);
                    onClose();
                  }, 800);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 bg-primary text-primary-content hover:brightness-110 transition-all"
              >
                {linking === doc._id ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Link2 size={11} />
                )}
                Link
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalContent, document.body);
  }

  return null;
};

// ─── Doctor Detail Panel ──────────────────────────────────────────────────────

const DoctorDetailPanel = ({ doctorId, onBack }) => {
  const dispatch = useDispatch();
  const doctor = useSelector(selectSelectedDoctor);
  const availability = useSelector(selectDoctorAvailability);
  const detailLoading = useSelector(isLoading(fetchLinkedDoctorById));
  const availLoading = useSelector(isLoading(fetchDoctorAvailability));
  const [unlinking, setUnlinking] = useState(false);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    dispatch(fetchLinkedDoctorById(doctorId));
    dispatch(fetchDoctorAvailability(doctorId));
  }, [doctorId, dispatch]);

  const handleUnlink = async () => {
    if (!confirm(`Unlink Dr. ${doctor?.user?.name}? They will be notified.`))
      return;
    setUnlinking(true);
    await dispatch(unlinkDoctor(doctorId));
    setUnlinking(false);
    onBack();
  };

  if (detailLoading || !doctor) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
        <Loader2 size={26} className="animate-spin text-primary" />
        <p className="text-xs font-medium text-base-content/50">
          Loading profile…
        </p>
      </div>
    );
  }

  const d = doctor;
  const name = d.user?.name || "Doctor";
  const avail = availability?.availability || [];

  const tabs = [
    { id: "overview", label: "Overview", icon: Stethoscope },
    { id: "availability", label: "Schedule", icon: Calendar },
    { id: "credentials", label: "Credentials", icon: Award },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Profile header card */}
      <div className="card p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-base-200 hover:bg-base-300 transition-colors flex-shrink-0 mt-1"
          >
            <ArrowLeft size={15} />
          </button>
          <div className="relative">
            <DoctorAvatar doctor={d} size={54} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-base-100 ${d.isOnline ? "bg-success" : "bg-base-300"}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="text-base font-black truncate"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Dr. {name}
              </h2>
              <span
                className={`badge badge-xs ${statusColor(d.isVerified, d.isActive)}`}
              >
                {statusLabel(d.isVerified, d.isActive)}
              </span>
            </div>
            <p className="text-xs text-base-content/55 truncate mt-0.5">
              {d.specialization} · {d.experienceYears}y exp
            </p>
            <p className="text-xs text-base-content/40 mt-0.5">
              {d.isOnline ? "🟢 Online now" : "⚫ Offline"}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            {
              val: (d.rating?.averageRating || 0).toFixed(1),
              label: "Rating",
              icon: Star,
            },
            { val: d.rating?.totalRatings || 0, label: "Reviews" },
            {
              val: d.consultationTypes
                ? Object.values(d.consultationTypes).filter(Boolean).length
                : 0,
              label: "Types",
            },
          ].map(({ val, label, icon: Icon }) => (
            <div
              key={label}
              className="text-center py-2 rounded-lg bg-base-200"
            >
              <div className="flex items-center justify-center gap-0.5">
                {Icon && (
                  <Icon
                    size={9}
                    className="text-accent"
                    fill="var(--color-accent)"
                  />
                )}
                <span className="text-xs font-black text-primary">{val}</span>
              </div>
              <p className="text-xs text-base-content/50">{label}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleUnlink}
          disabled={unlinking}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold
            bg-error/10 text-error border border-error/30 hover:bg-error/20 transition-colors"
        >
          {unlinking ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Link2Off size={13} />
          )}
          Unlink from Hospital
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl bg-base-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all
              ${tab === t.id ? "bg-base-100 text-primary shadow-sm" : "text-base-content/55 hover:text-base-content"}`}
          >
            <t.icon size={12} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin pb-4">
        <AnimatePresence mode="wait">
          {/* OVERVIEW */}
          {tab === "overview" && (
            <motion.div
              key="ov"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {/* Contact */}
              <div className="card p-4 space-y-3">
                <h3
                  className="text-xs font-black"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Contact
                </h3>
                {[
                  { icon: Mail, val: d.user?.email },
                  { icon: Phone, val: d.user?.phone },
                ].map(
                  ({ icon: Icon, val }) =>
                    val && (
                      <div
                        key={val}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Icon
                          size={13}
                          className="text-primary flex-shrink-0"
                        />
                        <span className="font-medium truncate">{val}</span>
                      </div>
                    ),
                )}
              </div>

              {/* Consultation types */}
              <div className="card p-4">
                <h3
                  className="text-xs font-black mb-3"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Consultation Types
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "inPerson", label: "In-Person" },
                    { key: "video", label: "Video" },
                    { key: "homeVisit", label: "Home Visit" },
                  ].map(({ key, label }) => (
                    <div
                      key={key}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border
                      ${
                        d.consultationTypes?.[key]
                          ? "bg-success/10 border-success/30"
                          : "bg-base-200 border-base-300"
                      }`}
                    >
                      {d.consultationTypes?.[key] ? (
                        <CheckCircle2 size={15} className="text-success" />
                      ) : (
                        <XCircle size={15} className="text-base-content/30" />
                      )}
                      <span className="text-xs font-semibold text-center leading-tight">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing note */}
              <div className="rounded-xl p-3 flex gap-2 bg-info/10 border border-info/25">
                <AlertCircle
                  size={13}
                  className="flex-shrink-0 mt-0.5 text-info"
                />
                <p className="text-xs text-base-content/70">
                  <strong>Pricing governed</strong> by hospital policy — doctor
                  cannot set own fees.
                </p>
              </div>
            </motion.div>
          )}

          {/* SCHEDULE */}
          {tab === "availability" && (
            <motion.div
              key="av"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {availLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-primary">
                  <Loader2 size={17} className="animate-spin" />
                  <span className="text-xs">Loading…</span>
                </div>
              ) : (
                <>
                  {/* Week pills */}
                  <div className="card p-4">
                    <h3
                      className="text-xs font-black mb-4"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      Weekly
                    </h3>
                    <div className="flex justify-between">
                      {DAYS.map((day) => {
                        const entry = avail.find((a) => a.day === day);
                        return (
                          <DayPill
                            key={day}
                            day={day}
                            available={entry?.isAvailable ?? false}
                            slots={
                              entry?.slots?.filter((s) => s.isActive).length ||
                              0
                            }
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Slot details */}
                  {avail
                    .filter((a) => a.isAvailable)
                    .map((dayEntry) => (
                      <div key={dayEntry.day} className="card p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold">{dayEntry.day}</h4>
                          <span className="badge badge-success badge-xs">
                            {dayEntry.slots?.filter((s) => s.isActive).length ||
                              0}{" "}
                            slots
                          </span>
                        </div>
                        <div className="space-y-2">
                          {dayEntry.slots
                            ?.filter((s) => s.isActive)
                            .map((slot, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-base-200"
                              >
                                <div className="flex items-center gap-2">
                                  <Clock size={12} className="text-primary" />
                                  <span className="text-xs font-semibold">
                                    {slot.startTime}–{slot.endTime}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-base-content/55">
                                    Max {slot.maxPatients}
                                  </span>
                                  <span className="badge badge-info badge-xs">
                                    {slot.consultationType}
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}

                  {avail.length === 0 && (
                    <div className="text-center py-10">
                      <Calendar
                        size={28}
                        className="mx-auto mb-2 text-base-content/30"
                      />
                      <p className="text-xs font-semibold">No schedule set</p>
                    </div>
                  )}

                  <div className="rounded-xl p-3 flex gap-2 bg-warning/10 border border-warning/25">
                    <AlertCircle
                      size={13}
                      className="flex-shrink-0 mt-0.5 text-warning"
                    />
                    <p className="text-xs text-base-content/70">
                      Availability is <strong>doctor-controlled</strong>. View
                      only.
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* CREDENTIALS */}
          {tab === "credentials" && (
            <motion.div
              key="cr"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              <div className="card p-4 space-y-3">
                <h3
                  className="text-xs font-black"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Professional
                </h3>
                {[
                  { label: "Registration No.", val: d.registrationNumber },
                  { label: "Council", val: d.registrationCouncil },
                  { label: "Partnership", val: d.partnershipStatus },
                  { label: "KYC Status", val: d.kycStatus },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-3"
                  >
                    <span className="text-xs font-semibold text-base-content/55 flex-shrink-0">
                      {label}
                    </span>
                    <span className="text-xs font-bold text-right">
                      {val || "—"}
                    </span>
                  </div>
                ))}
              </div>

              {d.qualifications?.length > 0 && (
                <div className="card p-4">
                  <h3
                    className="text-xs font-black mb-3"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Qualifications
                  </h3>
                  <div className="space-y-2">
                    {d.qualifications.map((q, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-3 py-2 rounded-lg bg-base-200"
                      >
                        <BookOpen
                          size={12}
                          className="text-primary flex-shrink-0 mt-0.5"
                        />
                        <div>
                          <span className="text-xs font-bold">{q.degree}</span>
                          {q.college && (
                            <span className="text-xs text-base-content/55 ml-1">
                              — {q.college}
                            </span>
                          )}
                          {q.year && (
                            <span className="text-xs text-base-content/40 ml-1">
                              ({q.year})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {d.languagesSpoken?.length > 0 && (
                <div className="card p-4">
                  <h3
                    className="text-xs font-black mb-3"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Languages
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {d.languagesSpoken.map((lang) => (
                      <span key={lang} className="badge badge-primary badge-sm">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function MedicalStaffManagement() {
  const dispatch = useDispatch();

  const doctors = useSelector(selectLinkedDoctors);
  const pagination = useSelector(selectDoctorsPagination);
  const stats = useSelector(selectDoctorStats);
  const listLoading = useSelector(isLoading(fetchLinkedDoctors));

  const [viewId, setViewId] = useState(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [search, setSearch] = useState("");
  const [specFilter, setSpecFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    dispatch(
      fetchLinkedDoctors({
        page,
        limit: 12,
        search,
        specialization: specFilter,
        isVerified: verifiedFilter,
      }),
    );
    dispatch(fetchDoctorStats());
  }, [dispatch, page, search, specFilter, verifiedFilter]);

  const handleUnlink = useCallback(
    async (id, name) => {
      if (!confirm(`Unlink Dr. ${name}? They will be notified.`)) return;
      await dispatch(unlinkDoctor(id));
      dispatch(fetchDoctorStats());
      if (viewId === id) setViewId(null);
    },
    [dispatch, viewId],
  );

  const handleRefresh = () => {
    dispatch(
      fetchLinkedDoctors({
        page,
        limit: 12,
        search,
        specialization: specFilter,
        isVerified: verifiedFilter,
      }),
    );
    dispatch(fetchDoctorStats());
  };

  const statTiles = [
    {
      icon: Users,
      label: "Total",
      value: stats?.total ?? "—",
      color: "var(--color-chart-1)",
    },
    {
      icon: CheckCircle2,
      label: "Verified",
      value: stats?.verified ?? "—",
      color: "var(--color-chart-2)",
    },
    {
      icon: Activity,
      label: "Active",
      value: stats?.active ?? "—",
      color: "var(--color-chart-3)",
    },
    {
      icon: Wifi,
      label: "Online",
      value: stats?.online ?? "—",
      color: "var(--color-chart-4)",
    },
    {
      icon: AlertCircle,
      label: "Unverified",
      value: stats?.unverified ?? "—",
      color: "var(--color-chart-6)",
    },
  ];

  return (
    <div className="min-h-screen w-full bg-base-100">
      {/* ══ Sticky Header ══════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-30 border-b border-base-300 bg-base-100/95 backdrop-blur-strong">
        <div className=" py-3 flex items-center justify-between gap-3 flex-wrap">
          {/* Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary text-primary-content">
              <Stethoscope size={18} />
            </div>
            <div>
              <h1
                className="text-xs font-black leading-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Medical Staff
              </h1>
              <p className="text-xs text-base-content/50">
                Manage doctors & schedules
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRefresh}
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 hover:bg-base-300 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowAnalytics((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all
                ${showAnalytics ? "bg-secondary text-secondary-content" : "bg-base-200 text-base-content hover:bg-base-300"}`}
            >
              <BarChart3 size={13} /> Analytics
            </button>
            <button
              onClick={() => setShowLink(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-base-200 text-base-content hover:bg-base-300 transition-all"
            >
              <Link2 size={13} /> Link
            </button>
            <button
              onClick={() => setShowOnboard(true)}
              className="btn-primary-cta flex items-center gap-1.5 px-4 py-2 text-xs"
            >
              <UserPlus size={13} /> Onboard
            </button>
          </div>
        </div>
      </div>

      <div className=" py-5">
        {/* ══ Stats Row ══════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {statTiles.map((t, i) => (
            <StatTile key={t.label} {...t} index={i} />
          ))}
        </div>

        {/* ══ Analytics (collapsible) ═══════════════════════════════════════ */}
        <AnimatePresence>
          {showAnalytics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: "hidden" }}
            >
              <AnalyticsPanel stats={stats} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ══ Two-Column Split ═══════════════════════════════════════════════ */}
        <div className={`flex  w-full gap-5 ${viewId ? "items-start" : ""}`}>
          {/* ── LEFT: List Panel ────────────────────────────────────────── */}
          <motion.div
            className="min-w-0 transition-all duration-300"
            animate={{
              flex: viewId ? "0 0 auto" : "1 1 0%",
              width: viewId ? undefined : undefined,
            }}
            style={{ flex: viewId ? "0 0 calc(50% - 10px)" : "1 1 0%" }}
          >
            {/* Search & filter bar */}
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={1}
              className="flex flex-col sm:flex-row gap-3 mb-4"
            >
              <div className="relative flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40"
                />
                <input
                  className="input-field h-10 w-full pl-9 text-xs"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name or email…"
                />
              </div>
              <button
                onClick={() => setFiltersOpen((p) => !p)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border
                  ${
                    filtersOpen
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-base-200 border-base-300 text-base-content hover:bg-base-300"
                  }`}
              >
                <Filter size={13} /> Filters
                {filtersOpen ? (
                  <ChevronUp size={13} />
                ) : (
                  <ChevronDown size={13} />
                )}
              </button>
            </motion.div>

            {/* Filter dropdown */}
            <AnimatePresence>
              {filtersOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl border border-base-300 bg-base-200"
                  style={{ overflow: "hidden" }}
                >
                  <FormField label="Specialization" note="Filter by specialty">
                    <select
                      className="input-field w-full text-xs"
                      value={specFilter}
                      onChange={(e) => {
                        setSpecFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All Specializations</option>
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </FormField>
                  <FormField
                    label="Verification"
                    note="KYC-verified doctors accept digital bookings"
                  >
                    <select
                      className="input-field w-full text-xs"
                      value={verifiedFilter}
                      onChange={(e) => {
                        setVerifiedFilter(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All Statuses</option>
                      <option value="true">Verified Only</option>
                      <option value="false">Unverified Only</option>
                    </select>
                  </FormField>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result count */}
            {!listLoading && doctors.length > 0 && (
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-base-content/50 font-medium">
                  {pagination?.total ?? doctors.length} doctors
                  {viewId && (
                    <span className="text-primary ml-1.5">· 1 selected</span>
                  )}
                </p>
                {viewId && (
                  <button
                    onClick={() => setViewId(null)}
                    className="text-xs text-base-content/50 hover:text-base-content flex items-center gap-1 transition-colors"
                  >
                    <X size={12} /> Clear selection
                  </button>
                )}
              </div>
            )}

            {/* Loading */}
            {listLoading && (
              <div className="flex items-center justify-center py-16 gap-3 text-primary">
                <Loader2 size={22} className="animate-spin" />
                <span className="text-xs font-medium">Loading doctors…</span>
              </div>
            )}

            {/* Empty state */}
            {!listLoading && doctors.length === 0 && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 bg-base-200">
                  <Users size={30} className="text-base-content/35" />
                </div>
                <h3
                  className="text-base font-black mb-2"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  No Doctors Found
                </h3>
                <p className="text-xs max-w-xs mb-6 text-base-content/55">
                  {search || specFilter
                    ? "Adjust your filters."
                    : "Start by onboarding or linking doctors."}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLink(true)}
                    className="btn btn-outline btn-sm flex items-center gap-2"
                  >
                    <Link2 size={13} /> Link Existing
                  </button>
                  <button
                    onClick={() => setShowOnboard(true)}
                    className="btn-primary-cta px-5 py-2 text-xs flex items-center gap-2"
                  >
                    <UserPlus size={13} /> Onboard
                  </button>
                </div>
              </motion.div>
            )}

            {/* Doctor grid — adapts columns based on panel open */}
            {!listLoading && doctors.length > 0 && (
              <>
                <div
                  className={`grid gap-3 mb-5 ${
                    viewId
                      ? "grid-cols-1"
                      : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
                  }`}
                >
                  {doctors.map((doc, i) => (
                    <DoctorCard
                      key={doc._id}
                      doctor={doc}
                      index={i}
                      isSelected={viewId === doc._id}
                      onView={(id) => setViewId(viewId === id ? null : id)}
                      onUnlink={handleUnlink}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {pagination?.pages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-base-200 hover:bg-base-300 transition-all disabled:opacity-40"
                    >
                      <ChevronLeft size={14} /> Prev
                    </button>
                    <div className="flex gap-1">
                      {Array.from(
                        { length: Math.min(pagination.pages, 7) },
                        (_, i) => i + 1,
                      ).map((p) => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition-all
                            ${page === p ? "bg-primary text-primary-content" : "bg-base-200 hover:bg-base-300 text-base-content"}`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                    <button
                      disabled={page >= pagination.pages}
                      onClick={() =>
                        setPage((p) => Math.min(pagination.pages, p + 1))
                      }
                      className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-base-200 hover:bg-base-300 transition-all disabled:opacity-40"
                    >
                      Next <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </motion.div>

          {/* ── RIGHT: Detail Panel (desktop sticky sidebar) ─────────────── */}
          <AnimatePresence>
            {viewId && (
              <motion.aside
                key="detail-panel"
                variants={slideLeft}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="hidden  w-full max-w-xl lg:flex flex-col flex-shrink-0"
                style={{
                  maxHeight: "calc(100vh - 80px)",
                  position: "sticky",
                  top: 72,
                  overflowY: "auto",
                }}
              >
                {/* Panel wrapper card */}
                <div className="card p-0 h-full overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                    <DoctorDetailPanel
                      doctorId={viewId}
                      onBack={() => setViewId(null)}
                    />
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ══ Mobile: Full-screen detail overlay ════════════════════════════════ */}
      <AnimatePresence>
        {viewId && (
          <motion.div
            key="mobile-detail"
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-40 flex flex-col lg:hidden bg-base-100"
          >
            {/* Mobile header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-base-100">
              <button
                onClick={() => setViewId(null)}
                className="w-9 h-9 rounded-xl flex items-center justify-center bg-base-200 hover:bg-base-300 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <span
                className="text-xs font-black"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Doctor Profile
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              <DoctorDetailPanel
                doctorId={viewId}
                onBack={() => setViewId(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Modals ══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showOnboard && <OnboardModal onClose={() => setShowOnboard(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showLink && <SearchLinkModal onClose={() => setShowLink(false)} />}
      </AnimatePresence>
    </div>
  );
}
