"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Search,
  Filter,
  Plus,
  ChevronRight,
  ChevronLeft,
  Activity,
  Shield,
  Stethoscope,
  Building2,
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Eye,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Send,
  Upload,
  FileText,
  Star,
  MapPin,
  Phone,
  Mail,
  Calendar,
  RefreshCw,
  Award,
  Wallet,
  UserCheck,
  UserX,
  Loader2,
  X,
  Save,
  ChevronDown,
  ArrowUpRight,
  Hash,
  Banknote,
  Globe,
  BadgeCheck,
  AlertTriangle,
} from "lucide-react";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

import {
  fetchAllDoctors,
  fetchDoctorById,
  fetchDoctorStats,
  createDoctorProfile,
  updateDoctorProfile,
  updateDoctorSettings,
  updateDoctorAvailability,
  updateDoctorBankDetails,
  updateDoctorKyc,
  updateDoctorSecurity,
  updateDoctorPlatformFee,
  updateDoctorPartnership,
  verifyDoctorKyc,
  toggleDoctorActive,
  resendDoctorCredentials,
  deleteDoctorProfile,
  uploadDoctorPhoto,
  searchDoctors,
  selectDoctors,
  selectSelectedDoctor,
  selectDoctorStats,
  selectDoctorTotal,
  selectDoctorPage,
  selectDoctorPages,
  selectHospitalLoading,
  selectHospitalError,
  clearSelectedDoctor,
  clearError,
} from "@/store/slices/hospitalSlice";

import { selectUser } from "@/store/slices/userSlice";

// ── Guards ────────────────────────────────────────────────────────────────────
const ALLOWED_ROLES = ["admin", "superadmin"];

// ── Palette constants using CSS variable-aware classes ────────────────────────
// KYC_COLOR uses inline styles referencing CSS vars for dynamic theming
const KYC_COLOR = {
  verified: { bg: "badge-success", icon: CheckCircle2 },
  pending: { bg: "badge-warning", icon: Clock },
  "under-review": { bg: "badge-info", icon: Eye },
  rejected: { bg: "badge-error", icon: XCircle },
  "not-submitted": { bg: "badge", icon: AlertCircle },
};

const PARTNER_COLOR = {
  Active: "badge-success",
  Pending: "badge-warning",
  Inactive: "badge",
  Suspended: "badge-error",
};

const SPEC_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--primary)",
  "var(--secondary)",
  "var(--accent)",
  "var(--info)",
];

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const fmt = (n) => n?.toLocaleString("en-IN") ?? "—";
const avatar = (doc) =>
  doc?.user?.avatar ||
  doc?.profilePhotoUrl ||
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(doc?.user?.name || "Dr")}&backgroundColor=4f46e5&textColor=ffffff`;

// ── Sub-components ─────────────────────────────────────────────────────────────

function Pill({ children, className = "" }) {
  return (
    <span
      className={`badge text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider inline-flex items-center gap-1 ${className}`}
    >
      {children}
    </span>
  );
}

function Field({ label, note, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{
          color: "color-mix(in oklch, var(--base-content) 60%, transparent)",
        }}
      >
        {label}
      </label>
      {children}
      {note && (
        <span
          className="text-[10px] leading-tight"
          style={{
            color: "color-mix(in oklch, var(--base-content) 45%, transparent)",
          }}
        >
          {note}
        </span>
      )}
    </div>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input className={`input-field w-full text-sm ${className}`} {...props} />
  );
}

function Select({ className = "", children, ...props }) {
  return (
    <select className={`input-field w-full text-sm ${className}`} {...props}>
      {children}
    </select>
  );
}

function Btn({
  variant = "ghost",
  size = "sm",
  className = "",
  children,
  loading,
  ...props
}) {
  const base =
    "inline-flex items-center gap-1.5 font-semibold rounded-lg transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed";

  const sizes = {
    xs: "px-2 py-1 text-[11px]",
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
  };

  // Map variants to global CSS classes or inline style combos
  const variantStyles = {
    ghost: {
      className: "hover:bg-base-300 text-base-content",
      style: { backgroundColor: "transparent" },
    },
    primary: { className: "btn-primary-cta", style: {} },
    danger: {
      className: "",
      style: { background: "var(--error)", color: "var(--error-content)" },
    },
    success: { className: "btn-success", style: {} },
    warning: {
      className: "",
      style: { background: "var(--warning)", color: "var(--warning-content)" },
    },
    outline: { className: "btn-secondary", style: {} },
  };

  const v = variantStyles[variant] || variantStyles.ghost;

  return (
    <button
      disabled={loading || props.disabled}
      className={`${base} ${sizes[size]} ${v.className} ${className}`}
      style={v.style}
      {...props}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: "var(--base-300)" }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{
          background: "var(--base-200)",
          borderColor: "var(--base-300)",
        }}
      >
        {Icon && <Icon size={14} style={{ color: "var(--primary)" }} />}
        <span
          className="text-xs font-bold uppercase tracking-wider"
          style={{ color: "var(--base-content)" }}
        >
          {title}
        </span>
      </div>
      <div
        className="p-4"
        style={{
          background:
            "color-mix(in oklch, var(--base-100) 80%, var(--base-200) 20%)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Stats Panel ───────────────────────────────────────────────────────────────
function StatsPanel({ doctor, stats }) {
  const d = stats?.data || {};
  const s = d.stats || {};

  const kpiData = [
    {
      name: "Consultations",
      value: s.totalConsultations || 0,
      color: "var(--chart-1)",
    },
    {
      name: "Video",
      value: s.totalVideoConsultations || 0,
      color: "var(--chart-2)",
    },
    {
      name: "Home Visits",
      value: s.totalHomeVisits || 0,
      color: "var(--chart-3)",
    },
    {
      name: "Referrals",
      value: s.totalReferrals || 0,
      color: "var(--chart-4)",
    },
  ];

  const earningsData = [
    { label: "Earned", value: s.totalEarnings || 0, color: "var(--success)" },
    { label: "Settled", value: s.totalSettled || 0, color: "var(--primary)" },
    {
      label: "Pending",
      value: s.pendingSettlement || 0,
      color: "var(--warning)",
    },
    {
      label: "Commission",
      value: s.totalCommissionEarned || 0,
      color: "var(--info)",
    },
  ];

  const completionVal = d.profileCompletionPercent || 0;

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        {kpiData.map((k) => (
          <div
            key={k.name}
            className="rounded-xl p-3 border"
            style={{
              background: "var(--base-200)",
              borderColor: "var(--base-300)",
            }}
          >
            <p
              className="text-[10px] uppercase tracking-wider mb-1"
              style={{
                color:
                  "color-mix(in oklch, var(--base-content) 50%, transparent)",
              }}
            >
              {k.name}
            </p>
            <p className="text-xl font-black" style={{ color: k.color }}>
              {fmt(k.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Profile completion */}
      <div
        className="rounded-xl p-3 border"
        style={{
          background: "var(--base-200)",
          borderColor: "var(--base-300)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className="text-[10px] uppercase tracking-wider"
            style={{
              color:
                "color-mix(in oklch, var(--base-content) 50%, transparent)",
            }}
          >
            Profile Completion
          </span>
          <span
            className="text-sm font-bold"
            style={{ color: "var(--primary)" }}
          >
            {completionVal}%
          </span>
        </div>
        <div className="progress-bar">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completionVal}%` }}
            className="progress-bar-fill"
          />
        </div>
      </div>

      {/* Earnings bar */}
      <div
        className="rounded-xl p-3 border"
        style={{
          background: "var(--base-200)",
          borderColor: "var(--base-300)",
        }}
      >
        <p
          className="text-[10px] uppercase tracking-wider mb-3"
          style={{
            color: "color-mix(in oklch, var(--base-content) 50%, transparent)",
          }}
        >
          Earnings Breakdown (₹)
        </p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={earningsData} barSize={16}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--base-300)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{
                fill: "color-mix(in oklch, var(--base-content) 60%, transparent)",
                fontSize: 9,
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{
                fill: "color-mix(in oklch, var(--base-content) 60%, transparent)",
                fontSize: 9,
              }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
            <Tooltip
              contentStyle={{
                background: "var(--base-200)",
                border: "1px solid var(--base-300)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--base-content)",
              }}
              labelStyle={{
                color:
                  "color-mix(in oklch, var(--base-content) 70%, transparent)",
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {earningsData.map((e, i) => (
                <Cell key={i} fill={e.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* KYC / Partnership status */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="rounded-xl p-3 border"
          style={{
            background: "var(--base-200)",
            borderColor: "var(--base-300)",
          }}
        >
          <p
            className="text-[10px] uppercase tracking-wider mb-1.5"
            style={{
              color:
                "color-mix(in oklch, var(--base-content) 50%, transparent)",
            }}
          >
            KYC Status
          </p>
          {(() => {
            const k = d.kycStatus || doctor?.kycStatus || "not-submitted";
            const cfg = KYC_COLOR[k] || KYC_COLOR["not-submitted"];
            const Icon = cfg.icon;
            return (
              <div
                className={`badge ${cfg.bg} flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full`}
              >
                <Icon size={10} /> {k}
              </div>
            );
          })()}
        </div>
        <div
          className="rounded-xl p-3 border"
          style={{
            background: "var(--base-200)",
            borderColor: "var(--base-300)",
          }}
        >
          <p
            className="text-[10px] uppercase tracking-wider mb-1.5"
            style={{
              color:
                "color-mix(in oklch, var(--base-content) 50%, transparent)",
            }}
          >
            Partnership
          </p>
          <div
            className={`badge ${PARTNER_COLOR[doctor?.partnershipStatus] || PARTNER_COLOR.Pending} text-[10px] font-semibold px-2 py-1 rounded-full`}
          >
            {doctor?.partnershipStatus || "Pending"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Doctor Card (left list item) ──────────────────────────────────────────────
function DoctorCard({ doc, selected, onClick }) {
  const kycCfg = KYC_COLOR[doc.kycStatus] || KYC_COLOR["not-submitted"];
  const KycIcon = kycCfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      onClick={() => onClick(doc._id)}
      className="relative flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all duration-150"
      style={
        selected
          ? {
              background:
                "color-mix(in oklch, var(--primary) 15%, var(--base-200))",
              borderColor:
                "color-mix(in oklch, var(--primary) 50%, transparent)",
              boxShadow: "var(--shadow-depth)",
            }
          : {
              background: "var(--base-200)",
              borderColor: "var(--base-300)",
            }
      }
    >
      <div className="relative shrink-0">
        <img
          src={avatar(doc)}
          alt=""
          className="w-10 h-10 rounded-xl object-cover"
          style={{ background: "var(--base-300)" }}
        />
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
          style={{
            background: doc.isOnline ? "var(--success)" : "var(--base-300)",
            borderColor: "var(--base-100)",
          }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold truncate"
          style={{ color: "var(--base-content)" }}
        >
          {doc.user?.name || "—"}
        </p>
        <p
          className="text-[10px] truncate"
          style={{
            color: "color-mix(in oklch, var(--base-content) 55%, transparent)",
          }}
        >
          {doc.specialization}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <div
            className={`badge ${kycCfg.bg} flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full`}
          >
            <KycIcon size={8} /> {doc.kycStatus}
          </div>
          {!doc.isActive && (
            <span className="badge badge-error text-[9px] font-semibold px-1.5 py-0.5 rounded-full">
              Inactive
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <div
          className="flex items-center gap-0.5"
          style={{ color: "var(--warning)" }}
        >
          <Star size={9} fill="currentColor" />
          <span className="text-[10px] font-bold">
            {doc.rating?.averageRating?.toFixed(1) || "—"}
          </span>
        </div>
        <span
          className="text-[10px]"
          style={{
            color: "color-mix(in oklch, var(--base-content) 40%, transparent)",
          }}
        >
          {doc.experienceYears}yr
        </span>
      </div>
      {selected && (
        <ChevronRight
          size={14}
          className="absolute right-2 top-1/2 -translate-y-1/2"
          style={{ color: "var(--primary)" }}
        />
      )}
    </motion.div>
  );
}

// ── Action Panel Tabs ─────────────────────────────────────────────────────────
const TABS = [
  { key: "overview", label: "Overview", icon: Eye },
  { key: "stats", label: "Analytics", icon: BarChart3 },
  { key: "profile", label: "Profile", icon: Edit3 },
  { key: "kyc", label: "KYC", icon: Shield },
  { key: "bank", label: "Bank", icon: CreditCard },
  { key: "partnership", label: "Partnership", icon: Award },
  { key: "platformfee", label: "Fee", icon: Banknote },
  { key: "security", label: "Security", icon: FileText },
  { key: "actions", label: "Actions", icon: Activity },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DoctorManagement() {
  const dispatch = useDispatch();
  const currentUser = useSelector(selectUser);
  const doctors = useSelector(selectDoctors);
  const selectedDoctor = useSelector(selectSelectedDoctor);
  const doctorStats = useSelector(selectDoctorStats);
  const total = useSelector(selectDoctorTotal);
  const page = useSelector(selectDoctorPage);
  const pages = useSelector(selectDoctorPages);
  const loading = useSelector(selectHospitalLoading);
  const error = useSelector(selectHospitalError);

  const [tab, setTab] = useState("overview");
  const [searchQ, setSearchQ] = useState("");
  const [filterSpec, setFilterSpec] = useState("");
  const [filterKyc, setFilterKyc] = useState("");
  const [filterPartner, setFilterPartner] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  // Form states
  const [profileForm, setProfileForm] = useState({});
  const [kycForm, setKycForm] = useState({});
  const [bankForm, setBankForm] = useState({});
  const [partnerForm, setPartnerForm] = useState({});
  const [feeForm, setFeeForm] = useState({});
  const [securityForm, setSecurityForm] = useState({});
  const [kycAction, setKycAction] = useState({
    action: "approve",
    rejectionReason: "",
  });
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    phone: "",
    specialization: "General Physician",
    experienceYears: 0,
    primaryHospital: "",
  });

  // Guard
  if (!currentUser || !ALLOWED_ROLES.includes(currentUser.role)) {
    return (
      <div data-theme="admin"
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--base-100)" }}
      >
        <div className="text-center">
          <Shield
            size={48}
            className="mx-auto mb-4"
            style={{ color: "var(--error)" }}
          />
          <p
            className="text-xl font-bold"
            style={{ color: "var(--base-content)" }}
          >
            Access Denied
          </p>
          <p
            className="mt-2"
            style={{
              color:
                "color-mix(in oklch, var(--base-content) 55%, transparent)",
            }}
          >
            Only Admin or Superadmin can access this page.
          </p>
        </div>
      </div>
    );
  }

  // Load doctors
  useEffect(() => {
    const params = { page: currentPage, limit: 20 };
    if (filterSpec) params.specialization = filterSpec;
    if (filterPartner) params.partnershipStatus = filterPartner;
    dispatch(fetchAllDoctors(params));
  }, [currentPage, filterSpec, filterPartner]);

  // Search
  useEffect(() => {
    if (!searchQ.trim()) return;
    const t = setTimeout(() => {
      dispatch(
        searchDoctors({ q: searchQ, specialization: filterSpec || undefined }),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [searchQ]);

  // Select doctor
  const selectDoc = useCallback(
    (id) => {
      dispatch(fetchDoctorById(id));
      dispatch(fetchDoctorStats(id));
      setTab("overview");
    },
    [dispatch],
  );

  // Sync forms when doctor changes
  useEffect(() => {
    if (!selectedDoctor) return;
    setProfileForm({
      specialization: selectedDoctor.specialization || "",
      experienceYears: selectedDoctor.experienceYears || 0,
      biography: selectedDoctor.biography || "",
      registrationNumber: selectedDoctor.registrationNumber || "",
      "fees.inPersonFee": selectedDoctor.fees?.inPersonFee ?? 0,
      "fees.videoFee": selectedDoctor.fees?.videoFee ?? 0,
      "fees.homeVisitFee": selectedDoctor.fees?.homeVisitFee ?? 0,
      "fees.inPersonHonorarium": selectedDoctor.fees?.inPersonHonorarium ?? 0,
      "fees.videoHonorarium": selectedDoctor.fees?.videoHonorarium ?? 0,
      "fees.homeVisitHonorarium": selectedDoctor.fees?.homeVisitHonorarium ?? 0,
    });
    setKycForm({
      aadhaarNumber: selectedDoctor.kyc?.aadhaarNumber || "",
      panNumber: selectedDoctor.kyc?.panNumber || "",
      aadhaarFrontUrl: selectedDoctor.kyc?.aadhaarFrontUrl || "",
      aadhaarBackUrl: selectedDoctor.kyc?.aadhaarBackUrl || "",
      panCardUrl: selectedDoctor.kyc?.panCardUrl || "",
    });
    setBankForm({
      accountHolderName: selectedDoctor.bankDetails?.accountHolderName || "",
      ifscCode: selectedDoctor.bankDetails?.ifscCode || "",
      bankName: selectedDoctor.bankDetails?.bankName || "",
      upiId: selectedDoctor.bankDetails?.upiId || "",
    });
    setPartnerForm({
      partnershipStatus: selectedDoctor.partnershipStatus || "Pending",
      adminNotes: selectedDoctor.adminNotes || "",
    });
    setFeeForm({
      platformFeeType: selectedDoctor.platformFee?.type || "percentage",
      platformFeeValue: selectedDoctor.platformFee?.value ?? "",
    });
    setSecurityForm({
      registrationNumber: selectedDoctor.registrationNumber || "",
      registrationCouncil: selectedDoctor.registrationCouncil || "",
      contractUrl: selectedDoctor.contractUrl || "",
      adminNotes: selectedDoctor.adminNotes || "",
    });
  }, [selectedDoctor]);

  const id = selectedDoctor?._id;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const isHospitalManaged =
    selectedDoctor?.primaryHospital?.managementModel === "hospital-manager";

  const handleUpdateProfile = () => {
    const {
      ["fees.inPersonFee"]: ipf,
      ["fees.videoFee"]: vf,
      ["fees.homeVisitFee"]: hvf,
      ["fees.inPersonHonorarium"]: iph,
      ["fees.videoHonorarium"]: vh,
      ["fees.homeVisitHonorarium"]: hvh,
      ...rest
    } = profileForm;

    const payload = { id, ...rest };
    // Only send fees for doctor-owner hospitals — hospital-manager doctors
    // ignore doctor.fees entirely (Hospital.consultationPricing governs instead).
    if (!isHospitalManaged) {
      payload.fees = {
        inPersonFee: Number(ipf),
        videoFee: Number(vf),
        homeVisitFee: Number(hvf),
        inPersonHonorarium: Number(iph),
        videoHonorarium: Number(vh),
        homeVisitHonorarium: Number(hvh),
      };
    }
    dispatch(updateDoctorProfile(payload));
  };

  const handleUpdateKyc = () => dispatch(updateDoctorKyc({ id, ...kycForm }));

  const handleVerifyKyc = () =>
    dispatch(
      verifyDoctorKyc({
        id,
        action: kycAction.action,
        rejectionReason: kycAction.rejectionReason,
      }),
    );

  const handleUpdateBank = () =>
    dispatch(updateDoctorBankDetails({ id, ...bankForm }));

  const handleUpdatePartner = () =>
    dispatch(updateDoctorPartnership({ id, ...partnerForm }));

  const handleUpdateFee = () => {
    const payload =
      feeForm.platformFeeValue === ""
        ? { id, platformFee: null }
        : {
            id,
            platformFee: {
              type: feeForm.platformFeeType,
              value: Number(feeForm.platformFeeValue),
            },
          };
    dispatch(updateDoctorPlatformFee(payload));
  };

  const handleUpdateSecurity = () =>
    dispatch(updateDoctorSecurity({ id, ...securityForm }));

  const handleToggle = () => dispatch(toggleDoctorActive(id));
  const handleResend = () => dispatch(resendDoctorCredentials(id));
  const handleDelete = () => {
    if (
      confirm(
        `Permanently delete Dr. ${selectedDoctor?.user?.name}? This cannot be undone.`,
      )
    ) {
      dispatch(deleteDoctorProfile(id)).then(() =>
        dispatch(clearSelectedDoctor()),
      );
    }
  };

  const handleCreate = () => {
    dispatch(createDoctorProfile(createForm)).then(() => setShowCreate(false));
  };

  const isLoading = (key) => loading[key];

  const SPECS = [
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

  // ── Render Detail Tabs ─────────────────────────────────────────────────────
  const renderTab = () => {
    if (!selectedDoctor) return null;
    const doc = selectedDoctor;

    switch (tab) {
      case "overview":
        return (
          <div className="space-y-4">
            {/* Hero */}
            <div
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{
                background: "var(--base-200)",
                borderColor: "var(--base-300)",
              }}
            >
              <img
                src={avatar(doc)}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover border-2"
                style={{
                  borderColor:
                    "color-mix(in oklch, var(--primary) 30%, transparent)",
                }}
              />
              <div className="flex-1 min-w-0">
                <h3
                  className="text-lg font-black"
                  style={{ color: "var(--base-content)" }}
                >
                  {doc.user?.name || "—"}
                </h3>
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--primary)" }}
                >
                  {doc.specialization}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <Pill
                    className={
                      KYC_COLOR[doc.kycStatus]?.bg ||
                      KYC_COLOR["not-submitted"].bg
                    }
                  >
                    {(() => {
                      const I = (
                        KYC_COLOR[doc.kycStatus] || KYC_COLOR["not-submitted"]
                      ).icon;
                      return <I size={9} />;
                    })()}
                    {doc.kycStatus}
                  </Pill>
                  <Pill
                    className={
                      PARTNER_COLOR[doc.partnershipStatus] ||
                      PARTNER_COLOR.Pending
                    }
                  >
                    {doc.partnershipStatus}
                  </Pill>
                  {doc.isVerified && (
                    <Pill className="badge-success">
                      <BadgeCheck size={9} />
                      Verified
                    </Pill>
                  )}
                  {!doc.isActive && (
                    <Pill className="badge-error">
                      <AlertTriangle size={9} />
                      Inactive
                    </Pill>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div
                  className="flex items-center gap-1"
                  style={{ color: "var(--warning)" }}
                >
                  <Star size={12} fill="currentColor" />
                  <span className="text-sm font-bold">
                    {doc.rating?.averageRating?.toFixed(1) || "—"}
                  </span>
                </div>
                <p
                  className="text-[10px]"
                  style={{
                    color:
                      "color-mix(in oklch, var(--base-content) 40%, transparent)",
                  }}
                >
                  {doc.rating?.totalRatings || 0} ratings
                </p>
              </div>
            </div>

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "Experience",
                  value: `${doc.experienceYears || 0} years`,
                  icon: Clock,
                },
                {
                  label: "Languages",
                  value: doc.languagesSpoken?.join(", ") || "—",
                  icon: Globe,
                },
                { label: "Email", value: doc.user?.email || "—", icon: Mail },
                { label: "Phone", value: doc.user?.phone || "—", icon: Phone },
                {
                  label: "Hospital",
                  value: doc.primaryHospital?.name || "—",
                  icon: Building2,
                },
                {
                  label: "Reg. No.",
                  value: doc.registrationNumber || "—",
                  icon: Hash,
                },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-start gap-2 p-3 rounded-xl border"
                  style={{
                    background: "var(--base-200)",
                    borderColor: "var(--base-300)",
                  }}
                >
                  <Icon
                    size={12}
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--primary)" }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-[9px] uppercase tracking-wider"
                      style={{
                        color:
                          "color-mix(in oklch, var(--base-content) 45%, transparent)",
                      }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-xs truncate font-medium"
                      style={{ color: "var(--base-content)" }}
                    >
                      {value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Fees */}
            <Section title="Consultation Fees" icon={CreditCard}>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "In-Person", value: doc.fees?.inPersonFee },
                  { label: "Video", value: doc.fees?.videoFee },
                  { label: "Home Visit", value: doc.fees?.homeVisitFee },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="text-center p-2 rounded-lg"
                    style={{ background: "var(--base-300)" }}
                  >
                    <p
                      className="text-[9px] uppercase tracking-wider"
                      style={{
                        color:
                          "color-mix(in oklch, var(--base-content) 45%, transparent)",
                      }}
                    >
                      {label}
                    </p>
                    <p
                      className="text-sm font-black"
                      style={{ color: "var(--success)" }}
                    >
                      ₹{fmt(value)}
                    </p>
                  </div>
                ))}
              </div>
              <p
                className="text-[10px] mt-2"
                style={{
                  color:
                    "color-mix(in oklch, var(--base-content) 45%, transparent)",
                }}
              >
                {doc.primaryHospital?.managementModel === "hospital-manager"
                  ? "⚠ Note: read-only here — set hospital-wide in Hospital → Pricing tab, applies to every linked doctor."
                  : "Note: doctor-owner — editable in the Profile tab, self-managed by this doctor."}
              </p>
            </Section>

            {/* Consultation types */}
            <Section title="Consultation Types" icon={Stethoscope}>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(doc.consultationTypes || {}).map(([k, v]) => (
                  <Pill key={k} className={v ? "badge-primary" : "badge"}>
                    {v ? <CheckCircle2 size={9} /> : <XCircle size={9} />} {k}
                  </Pill>
                ))}
              </div>
            </Section>

            {/* Bio */}
            {doc.biography && (
              <Section title="Biography" icon={FileText}>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--base-content)" }}
                >
                  {doc.biography}
                </p>
              </Section>
            )}
          </div>
        );

      case "stats":
        return <StatsPanel doctor={doc} stats={doctorStats} />;

      case "profile":
        return (
          <div className="space-y-4">
            <Section title="Update Profile" icon={Edit3}>
              <div className="space-y-3">
                <Field
                  label="Specialization"
                  note="Choose the doctor's medical specialization."
                >
                  <Select
                    value={profileForm.specialization || ""}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        specialization: e.target.value,
                      }))
                    }
                  >
                    {SPECS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Experience Years"
                  note="Total years of clinical practice."
                >
                  <Input
                    type="number"
                    min={0}
                    max={70}
                    value={profileForm.experienceYears || ""}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        experienceYears: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Registration Number"
                  note="MCI or State Medical Council registration number."
                >
                  <Input
                    value={profileForm.registrationNumber || ""}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        registrationNumber: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Biography"
                  note="Professional summary (max 1000 characters)."
                >
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={profileForm.biography || ""}
                    onChange={(e) =>
                      setProfileForm((p) => ({
                        ...p,
                        biography: e.target.value,
                      }))
                    }
                    className="input-field w-full text-sm resize-none"
                  />
                </Field>
                <Btn
                  variant="primary"
                  size="md"
                  loading={isLoading("updateDoctorProfile")}
                  onClick={handleUpdateProfile}
                >
                  <Save size={12} /> Save Profile
                </Btn>
              </div>
            </Section>

            <Section title="Consultation Fees" icon={CreditCard}>
              {isHospitalManaged ? (
                <div
                  className="flex items-start gap-2 p-3 rounded-lg text-[11px]"
                  style={{
                    background:
                      "color-mix(in oklch, var(--warning) 8%, var(--base-200))",
                    border:
                      "1px solid color-mix(in oklch, var(--warning) 30%, transparent)",
                    color: "var(--warning)",
                  }}
                >
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Note: this doctor's primary hospital is{" "}
                    <strong>hospital-manager</strong> type — fees are set once
                    for the whole hospital (Hospital → Pricing tab) and apply to
                    every linked doctor. Per-doctor fee fields are disabled here
                    to prevent silently-ignored edits.
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <p
                    className="text-[10px]"
                    style={{
                      color:
                        "color-mix(in oklch, var(--base-content) 45%, transparent)",
                    }}
                  >
                    Note: doctor-owner hospital — fees below are self-managed by
                    this doctor and used directly at booking time.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["In-Person Fee (₹)", "fees.inPersonFee"],
                      ["In-Person Honorarium (₹)", "fees.inPersonHonorarium"],
                      ["Video Fee (₹)", "fees.videoFee"],
                      ["Video Honorarium (₹)", "fees.videoHonorarium"],
                      ["Home Visit Fee (₹)", "fees.homeVisitFee"],
                      ["Home Visit Honorarium (₹)", "fees.homeVisitHonorarium"],
                    ].map(([label, key]) => (
                      <Field
                        key={key}
                        label={label}
                        note={
                          key.includes("Honorarium")
                            ? "Cannot exceed matching fee."
                            : undefined
                        }
                      >
                        <Input
                          type="number"
                          min={0}
                          value={profileForm[key] ?? 0}
                          onChange={(e) =>
                            setProfileForm((p) => ({
                              ...p,
                              [key]: e.target.value,
                            }))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <Btn
                    variant="primary"
                    size="md"
                    loading={isLoading("updateDoctorProfile")}
                    onClick={handleUpdateProfile}
                  >
                    <Save size={12} /> Save Fees
                  </Btn>
                </div>
              )}
            </Section>
          </div>
        );

      case "kyc":
        return (
          <div className="space-y-4">
            <Section title="KYC Documents" icon={Shield}>
              <div className="space-y-3">
                <Field
                  label="Aadhaar Number"
                  note="12-digit Aadhaar UID. Stored encrypted and never displayed publicly."
                >
                  <Input
                    type="password"
                    placeholder="XXXXXXXXXXXX"
                    value={kycForm.aadhaarNumber || ""}
                    onChange={(e) =>
                      setKycForm((p) => ({
                        ...p,
                        aadhaarNumber: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Aadhaar Front URL"
                  note="ImageKit CDN URL of the front side of Aadhaar card."
                >
                  <Input
                    placeholder="https://ik.imagekit.io/..."
                    value={kycForm.aadhaarFrontUrl || ""}
                    onChange={(e) =>
                      setKycForm((p) => ({
                        ...p,
                        aadhaarFrontUrl: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Aadhaar Back URL"
                  note="ImageKit CDN URL of the back side of Aadhaar card."
                >
                  <Input
                    placeholder="https://ik.imagekit.io/..."
                    value={kycForm.aadhaarBackUrl || ""}
                    onChange={(e) =>
                      setKycForm((p) => ({
                        ...p,
                        aadhaarBackUrl: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="PAN Number"
                  note="10-character alphanumeric PAN (e.g. ABCDE1234F)."
                >
                  <Input
                    placeholder="ABCDE1234F"
                    maxLength={10}
                    value={kycForm.panNumber || ""}
                    onChange={(e) =>
                      setKycForm((p) => ({
                        ...p,
                        panNumber: e.target.value.toUpperCase(),
                      }))
                    }
                  />
                </Field>
                <Field
                  label="PAN Card URL"
                  note="ImageKit CDN URL of the PAN card image."
                >
                  <Input
                    placeholder="https://ik.imagekit.io/..."
                    value={kycForm.panCardUrl || ""}
                    onChange={(e) =>
                      setKycForm((p) => ({ ...p, panCardUrl: e.target.value }))
                    }
                  />
                </Field>
                <Btn
                  variant="primary"
                  size="md"
                  loading={isLoading("updateDoctorKyc")}
                  onClick={handleUpdateKyc}
                >
                  <Save size={12} /> Submit KYC
                </Btn>
              </div>
            </Section>

            {currentUser.role === "superadmin" ||
            currentUser.role === "admin" ? (
              <Section title="KYC Verification" icon={BadgeCheck}>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Pill
                      className={
                        KYC_COLOR[doc?.kycStatus]?.bg ||
                        KYC_COLOR["not-submitted"].bg
                      }
                    >
                      Current: {doc?.kycStatus}
                    </Pill>
                  </div>
                  <Field
                    label="Action"
                    note="Approve to verify the doctor; Reject requires a reason."
                  >
                    <Select
                      value={kycAction.action}
                      onChange={(e) =>
                        setKycAction((p) => ({ ...p, action: e.target.value }))
                      }
                    >
                      <option value="approve">Approve</option>
                      <option value="reject">Reject</option>
                    </Select>
                  </Field>
                  {kycAction.action === "reject" && (
                    <Field
                      label="Rejection Reason"
                      note="Required when rejecting KYC. Doctor will be notified."
                    >
                      <Input
                        placeholder="State the reason for rejection..."
                        value={kycAction.rejectionReason || ""}
                        onChange={(e) =>
                          setKycAction((p) => ({
                            ...p,
                            rejectionReason: e.target.value,
                          }))
                        }
                      />
                    </Field>
                  )}
                  <div className="flex gap-2">
                    <Btn
                      variant={
                        kycAction.action === "approve" ? "success" : "danger"
                      }
                      size="md"
                      loading={isLoading("verifyDoctorKyc")}
                      onClick={handleVerifyKyc}
                    >
                      <Shield size={12} />
                      {kycAction.action === "approve"
                        ? "Approve KYC"
                        : "Reject KYC"}
                    </Btn>
                  </div>
                </div>
              </Section>
            ) : null}
          </div>
        );

      case "bank":
        return (
          <Section title="Bank Details" icon={CreditCard}>
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Pill
                  className={
                    doc.bankDetails?.isBankVerified
                      ? "badge-success"
                      : "badge-warning"
                  }
                >
                  {doc.bankDetails?.isBankVerified ? (
                    <CheckCircle2 size={9} />
                  ) : (
                    <Clock size={9} />
                  )}
                  {doc.bankDetails?.isBankVerified
                    ? "Verified"
                    : "Pending Verification"}
                </Pill>
                {doc.bankDetails?.accountLast4 && (
                  <span
                    className="text-[10px]"
                    style={{
                      color:
                        "color-mix(in oklch, var(--base-content) 40%, transparent)",
                    }}
                  >
                    ••••{doc.bankDetails.accountLast4}
                  </span>
                )}
              </div>
              <Field
                label="Account Holder Name"
                note="Must match exactly as in bank records."
              >
                <Input
                  value={bankForm.accountHolderName || ""}
                  onChange={(e) =>
                    setBankForm((p) => ({
                      ...p,
                      accountHolderName: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="Account Number"
                note="Full account number. Stored securely; only last 4 digits shown after save."
              >
                <Input
                  type="password"
                  placeholder="Enter account number"
                  onChange={(e) =>
                    setBankForm((p) => ({
                      ...p,
                      accountNumber: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="IFSC Code"
                note="11-character IFSC (e.g. SBIN0001234). Used for NEFT/RTGS."
              >
                <Input
                  placeholder="SBIN0001234"
                  maxLength={11}
                  value={bankForm.ifscCode || ""}
                  onChange={(e) =>
                    setBankForm((p) => ({
                      ...p,
                      ifscCode: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </Field>
              <Field
                label="Bank Name"
                note="Name of the bank where the account is held."
              >
                <Input
                  value={bankForm.bankName || ""}
                  onChange={(e) =>
                    setBankForm((p) => ({ ...p, bankName: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="UPI ID"
                note="Optional. Used for instant settlement payouts."
              >
                <Input
                  placeholder="doctor@upi"
                  value={bankForm.upiId || ""}
                  onChange={(e) =>
                    setBankForm((p) => ({ ...p, upiId: e.target.value }))
                  }
                />
              </Field>
              <Btn
                variant="primary"
                size="md"
                loading={isLoading("updateDoctorBankDetails")}
                onClick={handleUpdateBank}
              >
                <Save size={12} /> Save Bank Details
              </Btn>
              <p className="text-[10px]" style={{ color: "var(--warning)" }}>
                ⚠ Saving will reset bank verification status. Admin
                re-verification required.
              </p>
            </div>
          </Section>
        );

      case "partnership":
        return (
          <Section title="Partnership Status" icon={Award}>
            <div className="space-y-3">
              <Field
                label="Partnership Status"
                note="Active = doctor is live on the platform. Suspended = temporarily blocked."
              >
                <Select
                  value={partnerForm.partnershipStatus || ""}
                  onChange={(e) =>
                    setPartnerForm((p) => ({
                      ...p,
                      partnershipStatus: e.target.value,
                    }))
                  }
                >
                  {["Pending", "Active", "Inactive", "Suspended"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Admin Notes"
                note="Internal notes only. Not visible to the doctor."
              >
                <textarea
                  rows={3}
                  value={partnerForm.adminNotes || ""}
                  onChange={(e) =>
                    setPartnerForm((p) => ({
                      ...p,
                      adminNotes: e.target.value,
                    }))
                  }
                  className="input-field w-full text-sm resize-none"
                />
              </Field>
              <Btn
                variant="primary"
                size="md"
                loading={isLoading("updateDoctorPartnership")}
                onClick={handleUpdatePartner}
              >
                <Save size={12} /> Update Partnership
              </Btn>
            </div>
          </Section>
        );

      case "platformfee":
        return (
          <Section title="Platform Fee Override" icon={Banknote}>
            <div className="space-y-3">
              <div
                className="p-3 rounded-lg text-[11px]"
                style={{
                  background:
                    "color-mix(in oklch, var(--warning) 8%, var(--base-200))",
                  border:
                    "1px solid color-mix(in oklch, var(--warning) 30%, transparent)",
                  color: "var(--warning)",
                }}
              >
                Override the global platform fee for this doctor only. Leave
                value empty to revert to global default. For hospital-manager
                doctors, this field is ignored — hospital-level fee applies.
              </div>
              <Field
                label="Fee Type"
                note="Fixed = flat rupee amount deducted per consultation. Percentage = % of consultation fee."
              >
                <Select
                  value={feeForm.platformFeeType || "percentage"}
                  onChange={(e) =>
                    setFeeForm((p) => ({
                      ...p,
                      platformFeeType: e.target.value,
                    }))
                  }
                >
                  <option value="fixed">Fixed (₹)</option>
                  <option value="percentage">Percentage (%)</option>
                </Select>
              </Field>
              <Field
                label="Fee Value"
                note="Leave blank to remove override and use global PlatformPricingConfig."
              >
                <Input
                  type="number"
                  min={0}
                  max={
                    feeForm.platformFeeType === "percentage" ? 100 : undefined
                  }
                  placeholder="e.g. 10"
                  value={feeForm.platformFeeValue ?? ""}
                  onChange={(e) =>
                    setFeeForm((p) => ({
                      ...p,
                      platformFeeValue: e.target.value,
                    }))
                  }
                />
              </Field>
              {doc?.platformFee && (
                <Pill className="badge-primary">
                  Current override: {doc.platformFee.type} ={" "}
                  {doc.platformFee.value}
                </Pill>
              )}
              <Btn
                variant="primary"
                size="md"
                loading={isLoading("updateDoctorPlatformFee")}
                onClick={handleUpdateFee}
              >
                <Save size={12} /> Save Fee Override
              </Btn>
            </div>
          </Section>
        );

      case "security":
        return (
          <Section title="Security & Registration" icon={FileText}>
            <div className="space-y-3">
              <Field
                label="Registration Number"
                note="MCI / State Medical Council reg. Duplicate check is enforced across all doctors."
              >
                <Input
                  value={securityForm.registrationNumber || ""}
                  onChange={(e) =>
                    setSecurityForm((p) => ({
                      ...p,
                      registrationNumber: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="Registration Council"
                note="Full name of the issuing medical council (e.g. Andhra Pradesh Medical Council)."
              >
                <Input
                  value={securityForm.registrationCouncil || ""}
                  onChange={(e) =>
                    setSecurityForm((p) => ({
                      ...p,
                      registrationCouncil: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="Contract URL"
                note="Link to the signed partnership agreement document (PDF)."
              >
                <Input
                  placeholder="https://..."
                  value={securityForm.contractUrl || ""}
                  onChange={(e) =>
                    setSecurityForm((p) => ({
                      ...p,
                      contractUrl: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="Admin Notes"
                note="Sensitive admin-only notes. Never exposed to the doctor."
              >
                <textarea
                  rows={3}
                  value={securityForm.adminNotes || ""}
                  onChange={(e) =>
                    setSecurityForm((p) => ({
                      ...p,
                      adminNotes: e.target.value,
                    }))
                  }
                  className="input-field w-full text-sm resize-none"
                />
              </Field>
              <Btn
                variant="primary"
                size="md"
                loading={isLoading("updateDoctorSecurity")}
                onClick={handleUpdateSecurity}
              >
                <Save size={12} /> Save Security Info
              </Btn>
            </div>
          </Section>
        );

      case "actions":
        return (
          <div className="space-y-4">
            <Section title="Quick Actions" icon={Activity}>
              <div className="grid grid-cols-1 gap-2">
                <Btn
                  variant={doc.isActive ? "warning" : "success"}
                  size="md"
                  loading={isLoading("toggleDoctorActive")}
                  onClick={handleToggle}
                  className="w-full justify-center"
                >
                  {doc.isActive ? (
                    <ToggleLeft size={14} />
                  ) : (
                    <ToggleRight size={14} />
                  )}
                  {doc.isActive ? "Deactivate Doctor" : "Activate Doctor"}
                </Btn>
                <Btn
                  variant="outline"
                  size="md"
                  loading={isLoading("resendDoctorCredentials")}
                  onClick={handleResend}
                  className="w-full justify-center"
                >
                  <Send size={12} /> Resend Credentials Email
                </Btn>
              </div>
            </Section>
            <Section title="Danger Zone" icon={AlertTriangle}>
              <div className="space-y-2">
                <p className="text-[11px]" style={{ color: "var(--error)" }}>
                  Permanently deletes this doctor profile and unlinks them from
                  all hospitals. This action is irreversible.
                </p>
                <Btn
                  variant="danger"
                  size="md"
                  loading={isLoading("deleteDoctorProfile")}
                  onClick={handleDelete}
                  className="w-full justify-center"
                >
                  <Trash2 size={12} /> Delete Doctor Permanently
                </Btn>
              </div>
            </Section>
          </div>
        );

      default:
        return null;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--base-100)",
        color: "var(--base-content)",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Top Bar */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b backdrop-blur-strong"
        style={{
          background: "color-mix(in oklch, var(--base-100) 90%, transparent)",
          borderColor: "var(--base-300)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--primary)" }}
          >
            <Stethoscope
              size={16}
              style={{ color: "var(--primary-content)" }}
            />
          </div>
          <div>
            <h1
              className="text-sm font-black tracking-tight"
              style={{ color: "var(--base-content)" }}
            >
              Doctor Management
            </h1>
            <p
              className="text-[10px]"
              style={{
                color:
                  "color-mix(in oklch, var(--base-content) 40%, transparent)",
              }}
            >
              {total} doctors total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Btn
            variant="ghost"
            size="sm"
            onClick={() => dispatch(fetchAllDoctors({ page: currentPage }))}
          >
            <RefreshCw
              size={12}
              className={isLoading("fetchAllDoctors") ? "animate-spin" : ""}
            />
            Refresh
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={12} /> New Doctor
          </Btn>
        </div>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* ── LEFT PANEL ───────────────────────────────────────────────────── */}
        <div
          className="w-80 shrink-0 flex flex-col border-r overflow-hidden"
          style={{ borderColor: "var(--base-300)" }}
        >
          {/* Filters */}
          <div
            className="p-3 space-y-2 border-b"
            style={{
              background: "var(--base-200)",
              borderColor: "var(--base-300)",
            }}
          >
            <div className="relative">
              <Search
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{
                  color:
                    "color-mix(in oklch, var(--base-content) 40%, transparent)",
                }}
              />
              <input
                className="input-field w-full text-xs pl-8 pr-3 py-2"
                placeholder="Search doctor name..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Select
                className="text-[11px] py-1.5"
                value={filterSpec}
                onChange={(e) => {
                  setFilterSpec(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Specializations</option>
                {SPECS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Select
                className="text-[11px] py-1.5"
                value={filterPartner}
                onChange={(e) => {
                  setFilterPartner(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Status</option>
                {["Pending", "Active", "Inactive", "Suspended"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {isLoading("fetchAllDoctors") ? (
              <div className="flex items-center justify-center h-32">
                <Loader2
                  size={24}
                  className="animate-spin"
                  style={{ color: "var(--primary)" }}
                />
              </div>
            ) : doctors.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-32"
                style={{
                  color:
                    "color-mix(in oklch, var(--base-content) 35%, transparent)",
                }}
              >
                <Users size={24} className="mb-2 opacity-40" />
                <p className="text-xs">No doctors found</p>
              </div>
            ) : (
              <AnimatePresence>
                {doctors.map((doc) => (
                  <DoctorCard
                    key={doc._id}
                    doc={doc}
                    selected={selectedDoctor?._id === doc._id}
                    onClick={selectDoc}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div
              className="flex items-center justify-between px-3 py-2 border-t"
              style={{
                background: "var(--base-200)",
                borderColor: "var(--base-300)",
              }}
            >
              <Btn
                variant="ghost"
                size="xs"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft size={10} /> Prev
              </Btn>
              <span
                className="text-[10px]"
                style={{
                  color:
                    "color-mix(in oklch, var(--base-content) 40%, transparent)",
                }}
              >
                {currentPage} / {pages}
              </span>
              <Btn
                variant="ghost"
                size="xs"
                disabled={currentPage >= pages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next <ChevronRight size={10} />
              </Btn>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedDoctor ? (
            <div
              className="flex-1 flex flex-col items-center justify-center"
              style={{
                color:
                  "color-mix(in oklch, var(--base-content) 25%, transparent)",
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.04, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Stethoscope size={56} />
              </motion.div>
              <p className="text-sm mt-4 font-medium">
                Select a doctor to view details
              </p>
              <p
                className="text-xs mt-1"
                style={{
                  color:
                    "color-mix(in oklch, var(--base-content) 18%, transparent)",
                }}
              >
                {total} doctors available
              </p>
            </div>
          ) : (
            <>
              {/* Tab Bar */}
              <div
                className="flex items-center gap-0.5 px-4 py-2 border-b overflow-x-auto shrink-0"
                style={{
                  background: "var(--base-200)",
                  borderColor: "var(--base-300)",
                }}
              >
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
                    style={
                      tab === key
                        ? {
                            background: "var(--primary)",
                            color: "var(--primary-content)",
                          }
                        : {
                            color:
                              "color-mix(in oklch, var(--base-content) 55%, transparent)",
                            background: "transparent",
                          }
                    }
                  >
                    <Icon size={11} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoading("fetchDoctorById") ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2
                      size={28}
                      className="animate-spin"
                      style={{ color: "var(--primary)" }}
                    />
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.15 }}
                    >
                      {renderTab()}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Error toast */}
              {error && (
                <div
                  className="mx-4 mb-4 flex items-center gap-2 p-3 rounded-lg text-xs"
                  style={{
                    background:
                      "color-mix(in oklch, var(--error) 10%, var(--base-200))",
                    border:
                      "1px solid color-mix(in oklch, var(--error) 30%, transparent)",
                    color: "var(--error)",
                  }}
                >
                  <XCircle size={12} /> {error}
                  <button
                    className="ml-auto"
                    onClick={() => dispatch(clearError())}
                  >
                    <X size={10} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Create Doctor Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(6px)",
            }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 16 }}
              className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              style={{
                background: "var(--base-100)",
                border: "1px solid var(--base-300)",
                boxShadow: "var(--shadow-depth)",
              }}
            >
              {/* Modal Header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: "var(--base-300)" }}
              >
                <div className="flex items-center gap-2">
                  <Plus size={16} style={{ color: "var(--primary)" }} />
                  <span
                    className="font-bold text-sm"
                    style={{ color: "var(--base-content)" }}
                  >
                    Create New Doctor
                  </span>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{
                    color:
                      "color-mix(in oklch, var(--base-content) 40%, transparent)",
                  }}
                  className="transition-colors hover:opacity-80"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                <Field
                  label="Full Name"
                  note="Doctor's legal full name as on ID proof."
                >
                  <Input
                    placeholder="Dr. Rajesh Kumar"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="Email Address"
                  note="Used for login credentials. Must be unique."
                >
                  <Input
                    type="email"
                    placeholder="doctor@example.com"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, email: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="Phone"
                  note="Optional. Indian mobile number (+91XXXXXXXXXX)."
                >
                  <Input
                    placeholder="+91XXXXXXXXXX"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm((p) => ({ ...p, phone: e.target.value }))
                    }
                  />
                </Field>
                <Field
                  label="Specialization"
                  note="Primary medical specialization."
                >
                  <Select
                    value={createForm.specialization}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        specialization: e.target.value,
                      }))
                    }
                  >
                    {SPECS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Experience Years"
                  note="Years of professional clinical experience."
                >
                  <Input
                    type="number"
                    min={0}
                    max={70}
                    value={createForm.experienceYears}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        experienceYears: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field
                  label="Primary Hospital ID"
                  note="Optional. MongoDB ObjectId of the hospital to link. Determines pricing model."
                >
                  <Input
                    placeholder="MongoDB ObjectId (optional)"
                    value={createForm.primaryHospital}
                    onChange={(e) =>
                      setCreateForm((p) => ({
                        ...p,
                        primaryHospital: e.target.value,
                      }))
                    }
                  />
                </Field>
                <p
                  className="text-[10px] rounded-lg p-2"
                  style={{
                    color: "var(--info)",
                    background:
                      "color-mix(in oklch, var(--info) 8%, var(--base-200))",
                    border:
                      "1px solid color-mix(in oklch, var(--info) 25%, transparent)",
                  }}
                >
                  Login credentials will be auto-generated and emailed to the
                  doctor after creation.
                </p>
              </div>

              {/* Modal Footer */}
              <div
                className="flex items-center justify-end gap-2 px-5 py-3 border-t"
                style={{
                  background: "var(--base-200)",
                  borderColor: "var(--base-300)",
                }}
              >
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Btn>
                <Btn
                  variant="primary"
                  size="sm"
                  loading={isLoading("createDoctorProfile")}
                  onClick={handleCreate}
                  disabled={!createForm.name || !createForm.email}
                >
                  <Plus size={12} /> Create Doctor
                </Btn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
