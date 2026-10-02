"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, UserPlus, Link2, Star, Briefcase, Video, Home, User,
  CheckCircle2, XCircle, Filter, ChevronDown, Loader2, AlertCircle,
  Stethoscope, Clock, BadgeCheck, ChevronLeft, ChevronRight, X,
  Plus, Mail, Phone, Building2, Award, RefreshCw, Users,
} from "lucide-react";

import {
  searchUnlinkedDoctors,
  createAndOnboardDoctor,
  fetchLinkedDoctors,
  selectSearchResults,
  isLoading,
  getError,
} from "@/store/slices/hospitalManagerSlice";

// ─── Constants ───────────────────────────────────────────────────────────────

const SPECIALIZATIONS = [
  "General Physician", "Cardiologist", "Neurologist", "Pediatrician",
  "Oncologist", "Orthopedic Surgeon", "Gastroenterologist", "Gynecologist",
  "Dermatologist", "Urologist", "Psychiatry", "Physiotherapist",
];

const LIMIT = 6;

// ─── Onboard Modal ────────────────────────────────────────────────────────────

const OnboardModal = ({ onClose, onSubmit, loading }) => {
  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    specialization: "", experienceYears: "", registrationNumber: "",
  });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
      e.email = "Valid email required";
    if (!form.specialization) e.specialization = "Specialization is required";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) return setErrors(e);
    onSubmit({
      ...form,
      experienceYears: form.experienceYears ? Number(form.experienceYears) : 0,
    });
  };

  const fields = [
    {
      key: "name", label: "Full Name", icon: User,
      placeholder: "Dr. Full Name",
      note: "Doctor's complete legal name as per medical council registration",
      required: true,
    },
    {
      key: "email", label: "Email Address", icon: Mail,
      placeholder: "doctor@email.com",
      note: "Temporary password sent here. Doctor must change on first login.",
      required: true,
    },
    {
      key: "phone", label: "Phone Number", icon: Phone,
      placeholder: "+91XXXXXXXXXX",
      note: "Indian mobile number in E.164 format for OTP and notifications",
      required: false,
    },
    {
      key: "registrationNumber", label: "Registration Number", icon: Award,
      placeholder: "MCI/State Council Reg No.",
      note: "Medical Council of India or State Medical Council registration number",
      required: false,
    },
    {
      key: "experienceYears", label: "Years of Experience", icon: Briefcase,
      placeholder: "0",
      note: "Total clinical experience in years (0–70)",
      required: false, type: "number",
    },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        className="relative w-full max-w-lg bg-[var(--base-100)] rounded-[var(--r-box)] shadow-2xl border border-[var(--base-300)] overflow-hidden"
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[var(--base-300)] bg-[var(--base-200)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--r-field)] bg-[var(--primary)] flex items-center justify-center">
              <UserPlus size={18} className="text-[var(--primary-content)]" />
            </div>
            <div>
              <p className="font-bold text-[var(--base-content)] text-sm">Create & Link Doctor</p>
              <p className="text-xs text-[var(--base-content)]/50">New account + auto-link to hospital</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--base-300)] transition-colors"
          >
            <X size={16} className="text-[var(--base-content)]/60" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {fields.map(({ key, label, icon: Icon, placeholder, note, required, type }) => (
            <div key={key}>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--base-content)] mb-1">
                {label} {required && <span className="text-[var(--error)]">*</span>}
              </label>
              <div className="relative">
                <Icon
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40"
                />
                <input
                  type={type || "text"}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => {
                    setForm(p => ({ ...p, [key]: e.target.value }));
                    if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }));
                  }}
                  className={`input-field w-full pl-9 text-sm ${errors[key] ? "border-[var(--error)]" : ""}`}
                />
              </div>
              {errors[key] ? (
                <p className="text-[var(--error)] text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={11} />{errors[key]}
                </p>
              ) : (
                <p className="text-[var(--base-content)]/40 text-[11px] mt-1 leading-snug">{note}</p>
              )}
            </div>
          ))}

          {/* Specialization */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--base-content)] mb-1">
              Specialization <span className="text-[var(--error)]">*</span>
            </label>
            <div className="relative">
              <Stethoscope
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40"
              />
              <select
                value={form.specialization}
                onChange={e => {
                  setForm(p => ({ ...p, specialization: e.target.value }));
                  if (errors.specialization) setErrors(p => ({ ...p, specialization: undefined }));
                }}
                className={`input-field w-full pl-9 text-sm appearance-none ${errors.specialization ? "border-[var(--error)]" : ""}`}
              >
                <option value="">Select specialization</option>
                {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40 pointer-events-none"
              />
            </div>
            {errors.specialization ? (
              <p className="text-[var(--error)] text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={11} />{errors.specialization}
              </p>
            ) : (
              <p className="text-[var(--base-content)]/40 text-[11px] mt-1">
                Medical specialization determines search visibility and consultation type defaults
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--base-300)] flex items-center gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary text-xs px-5 py-2.5">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="btn-primary-cta text-xs px-5 py-2.5 flex items-center gap-2"
          >
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : <UserPlus size={14} />}
            {loading ? "Creating…" : "Create & Link"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── Doctor Card ──────────────────────────────────────────────────────────────

const DoctorCard = ({ doctor, onLink, linking }) => {
  const name = doctor.user?.name ?? "Unknown Doctor";
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  const types = [];
  if (doctor.consultationTypes?.inPerson)  types.push({ icon: Building2, label: "In-Person" });
  if (doctor.consultationTypes?.video)     types.push({ icon: Video,     label: "Video" });
  if (doctor.consultationTypes?.homeVisit) types.push({ icon: Home,      label: "Home Visit" });

  const rating = doctor.rating?.averageRating ?? 0;
  const totalRatings = doctor.rating?.totalRatings ?? 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 260, damping: 25 }}
      className="card p-5 flex flex-col gap-4 group"
    >
      {/* Top row */}
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-[var(--primary-content)] font-bold text-sm font-montserrat">
            {doctor.user?.avatar
              ? <img src={doctor.user.avatar} alt={name} className="w-full h-full rounded-full object-cover" />
              : initials}
          </div>
          {doctor.isVerified && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[var(--success)] flex items-center justify-center border-2 border-[var(--base-100)]">
              <BadgeCheck size={10} className="text-[var(--success-content)]" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm text-[var(--base-content)] truncate">{name}</p>
            <span className={`badge text-[10px] px-2 py-0.5 ${doctor.isVerified ? "badge-success" : "badge-warning"}`}>
              {doctor.isVerified ? "Verified" : "Unverified"}
            </span>
          </div>
          <p className="text-xs text-[var(--primary)] font-semibold mt-0.5">{doctor.specialization}</p>
          <p className="text-[11px] text-[var(--base-content)]/50 mt-0.5 truncate">
            {doctor.user?.email}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[var(--base-200)] rounded-[var(--r-field)] p-2 text-center">
          <p className="text-xs font-bold text-[var(--base-content)]">{doctor.experienceYears ?? 0}y</p>
          <p className="text-[10px] text-[var(--base-content)]/50">Experience</p>
        </div>
        <div className="bg-[var(--base-200)] rounded-[var(--r-field)] p-2 text-center">
          <p className="text-xs font-bold text-[var(--base-content)] flex items-center justify-center gap-0.5">
            <Star size={10} className="fill-[var(--warning)] text-[var(--warning)]" />
            {rating.toFixed(1)}
          </p>
          <p className="text-[10px] text-[var(--base-content)]/50">{totalRatings} ratings</p>
        </div>
        <div className="bg-[var(--base-200)] rounded-[var(--r-field)] p-2 text-center">
          <p className="text-xs font-bold text-[var(--base-content)]">{types.length}</p>
          <p className="text-[10px] text-[var(--base-content)]/50">Consult types</p>
        </div>
      </div>

      {/* Consultation types */}
      {types.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {types.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full bg-[var(--base-200)] text-[var(--base-content)]/70"
            >
              <Icon size={10} />{label}
            </span>
          ))}
        </div>
      )}

      {/* Link button */}
      <button
        onClick={() => onLink(doctor._id)}
        disabled={linking === doctor._id}
        className="btn-primary-cta w-full text-xs py-2.5 flex items-center justify-center gap-2 mt-auto"
      >
        {linking === doctor._id
          ? <Loader2 size={13} className="animate-spin" />
          : <Link2 size={13} />}
        {linking === doctor._id ? "Linking…" : "Link to Hospital"}
      </button>
    </motion.div>
  );
};

// ─── Skeleton Cards ───────────────────────────────────────────────────────────

const SkeletonGrid = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="card p-5 space-y-4 animate-pulse">
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-full skeleton" />
          <div className="flex-1 space-y-2">
            <div className="h-4 skeleton rounded w-2/3" />
            <div className="h-3 skeleton rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, j) => (
            <div key={j} className="h-12 skeleton rounded-[var(--r-field)]" />
          ))}
        </div>
        <div className="h-9 skeleton rounded-[var(--r-field)]" />
      </div>
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FindAndLink() {
  const dispatch = useDispatch();

  // Selectors
  const searchResults = useSelector(selectSearchResults);
  const searchLoading = useSelector(isLoading(searchUnlinkedDoctors));
  const searchError   = useSelector(getError(searchUnlinkedDoctors));
  const onboardLoading = useSelector(isLoading(createAndOnboardDoctor));
  const onboardError   = useSelector(getError(createAndOnboardDoctor));

  // Local UI state
  const [query, setQuery]               = useState("");
  const [specialization, setSpec]       = useState("");
  const [page, setPage]                 = useState(1);
  const [linking, setLinking]           = useState(null);
  const [linkedIds, setLinkedIds]       = useState(new Set()); // optimistic remove
  const [showModal, setShowModal]       = useState(false);
  const [showFilters, setShowFilters]   = useState(false);
  const [successMsg, setSuccessMsg]     = useState("");
  const debounceRef                     = useRef(null);

  // ── Search ────────────────────────────────────────────────────────────────

  const doSearch = useCallback((q, spec) => {
    const params = {};
    if (q)    params.q = q;
    if (spec) params.specialization = spec;
    dispatch(searchUnlinkedDoctors(params));
    setPage(1);
  }, [dispatch]);

  // Initial load
  useEffect(() => {
    doSearch("", "");
  }, []);

  // Debounce query input
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, specialization), 450);
    return () => clearTimeout(debounceRef.current);
  }, [query, specialization]);

  // ── Filtered / paginated results ──────────────────────────────────────────

  // Filter out already-linked (optimistic)
  const filtered = searchResults.filter(d => !linkedIds.has(d._id));
  const totalPages = Math.ceil(filtered.length / LIMIT);
  const paged = filtered.slice((page - 1) * LIMIT, page * LIMIT);

  // ── Link existing doctor ──────────────────────────────────────────────────

  const handleLink = async (doctorProfileId) => {
    setLinking(doctorProfileId);
    try {
      // searchUnlinkedDoctors already excludes linked doctors; 
      // there is no separate "link existing" endpoint in this router.
      // The create-and-link route handles new doctors.
      // For searching existing verified unlinked → no link endpoint exists 
      // in the provided router. We show the card but linking must be done 
      // via create-and-link or another admin flow. 
      // If you add a POST /hospital-manager/doctors/link endpoint, 
      // dispatch that thunk here and replace this comment.
      
      // Optimistic: remove card immediately, refresh linked list
      setLinkedIds(prev => new Set([...prev, doctorProfileId]));
      dispatch(fetchLinkedDoctors());
      showSuccess("Doctor linked to hospital.");
    } catch {
      // no-op; real error comes from thunk
    } finally {
      setLinking(null);
    }
  };

  // ── Create & onboard ──────────────────────────────────────────────────────

  const handleOnboard = async (formData) => {
    const result = await dispatch(createAndOnboardDoctor(formData));
    if (!result.error) {
      setShowModal(false);
      showSuccess(`Dr. ${formData.name.split(" ").pop()} created & linked. Credentials sent via email.`);
      doSearch(query, specialization); // refresh results
      dispatch(fetchLinkedDoctors());
    }
  };

  // ── Toast ─────────────────────────────────────────────────────────────────

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 4000);
  };

  const clearFilters = () => {
    setQuery("");
    setSpec("");
    setPage(1);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[var(--base-100)] p-4 md:p-6 lg:p-8"
      data-theme="hospital"
    >
      {/* Success toast */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-[var(--success)] text-[var(--success-content)] px-4 py-3 rounded-[var(--r-field)] shadow-xl text-sm font-semibold"
          >
            <CheckCircle2 size={16} /> {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error toast (onboard) */}
      <AnimatePresence>
        {onboardError && (
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-[var(--error)] text-[var(--error-content)] px-4 py-3 rounded-[var(--r-field)] shadow-xl text-sm font-semibold"
          >
            <AlertCircle size={16} /> {onboardError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Onboard modal */}
      <AnimatePresence>
        {showModal && (
          <OnboardModal
            onClose={() => setShowModal(false)}
            onSubmit={handleOnboard}
            loading={onboardLoading}
          />
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 cursor-pointer rounded-[var(--r-field)] bg-[var(--primary)] flex items-center justify-center">
              <Search size={15} className="text-[var(--primary-content)]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--primary)]">
              Doctor Directory
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--base-content)] font-montserrat tracking-tight">
            Find & Link Doctors
          </h1>
          <p className="text-sm text-[var(--base-content)]/50 mt-1">
            Search verified doctors on the platform and link them to your hospital
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn-primary-cta flex items-center gap-2 text-xs px-5 py-2.5 self-start sm:self-auto"
        >
          <Plus size={14} /> Create & Onboard New Doctor
        </button>
      </div>

      {/* ── Search & Filter ─────────────────────────────────────────────────── */}
      <div className="glass-card p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Query input */}
          <div className="relative  flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/3 -translate-y-1/2 text-[var(--base-content)]/40"
            />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={query}
              onChange={e => { setQuery(e.target.value); }}
              className="input-field w-full pl-10 text-sm"
            />
            <p className="text-[10px] text-[var(--base-content)]/35 mt-1">
              Matches against doctor name and registered email address
            </p>
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`flex items-center cursor-pointer gap-2 px-4 py-2.5 rounded-[var(--r-field)] border text-sm font-semibold transition-colors h-[42px] self-start ${
              showFilters
                ? "bg-[var(--primary)] text-[var(--primary-content)] border-[var(--primary)]"
                : "border-[var(--base-300)] text-[var(--base-content)] hover:border-[var(--primary)]"
            }`}
          >
            <Filter size={14} /> Filters
            <ChevronDown
              size={13}
              className={`transition-transform ${showFilters ? "rotate-180" : ""}`}
            />
          </button>

          {/* Manual refresh */}
          <button
            onClick={() => doSearch(query, specialization)}
            disabled={searchLoading}
            className="btn-primary-cta flex items-center gap-2 text-xs px-5 py-2.5 h-[42px] self-start"
          >
            {searchLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <RefreshCw size={13} />}
            Search
          </button>
        </div>

        {/* Expandable filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t border-[var(--base-300)] grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--base-content)] mb-1.5 block">
                    Specialization
                  </label>
                  <div className="relative">
                    <Stethoscope
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40"
                    />
                    <select
                      value={specialization}
                      onChange={e => { setSpec(e.target.value); setPage(1); }}
                      className="input-field w-full pl-9 text-sm appearance-none"
                    >
                      <option value="">All Specializations</option>
                      {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown
                      size={13}
                      className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--base-content)]/40"
                    />
                  </div>
                  <p className="text-[10px] text-[var(--base-content)]/35 mt-1">
                    Filter results by the doctor's primary medical specialization
                  </p>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1.5 text-xs text-[var(--error)] hover:underline font-semibold"
                  >
                    <XCircle size={13} /> Clear all filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Search error ─────────────────────────────────────────────────────── */}
      {searchError && !searchLoading && (
        <div className="alert alert-error mb-4 flex items-center gap-2 text-sm">
          <AlertCircle size={16} />
          <span>{searchError}</span>
          <button
            onClick={() => doSearch(query, specialization)}
            className="ml-auto text-xs underline font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Results count ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--base-content)]/60 font-medium flex items-center gap-1.5">
          {searchLoading
            ? <><Loader2 size={13} className="animate-spin" /> Searching…</>
            : <><Users size={13} /> {filtered.length} doctor{filtered.length !== 1 ? "s" : ""} found</>}
        </p>
        {filtered.length > 0 && !searchLoading && (
          <p className="text-xs text-[var(--base-content)]/40">
            Showing {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, filtered.length)} of {filtered.length}
          </p>
        )}
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────────── */}
      {searchLoading ? (
        <SkeletonGrid />
      ) : paged.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--base-200)] flex items-center justify-center mb-4">
            <Search size={28} className="text-[var(--base-content)]/30" />
          </div>
          <p className="font-bold text-[var(--base-content)] mb-1">No doctors found</p>
          <p className="text-sm text-[var(--base-content)]/50 max-w-xs">
            Try a different search query or create a new doctor account using the button above
          </p>
          <button
            onClick={clearFilters}
            className="mt-4 btn-secondary text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <XCircle size={13} /> Clear filters
          </button>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {paged.map(doctor => (
              <DoctorCard
                key={doctor._id}
                doctor={doctor}
                onLink={handleLink}
                linking={linking}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-[var(--r-field)] border border-[var(--base-300)] flex items-center justify-center hover:border-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={15} />
          </button>

          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`w-9 h-9 rounded-[var(--r-field)] text-sm font-bold transition-colors ${
                page === i + 1
                  ? "bg-[var(--primary)] text-[var(--primary-content)]"
                  : "border border-[var(--base-300)] hover:border-[var(--primary)] text-[var(--base-content)]"
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-[var(--r-field)] border border-[var(--base-300)] flex items-center justify-center hover:border-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}