"use client";

/**
 * MyProfile.jsx — Single file, all sections, URL-param driven
 * Theme: care-assistant  (warm lavender + rose + amber)
 *
 * Next.js route: app/care-assistant/profile/[[...section]]/page.jsx
 *
 * URL → Active section:
 *   /care-assistant/profile                    → overview
 *   /care-assistant/profile/personal           → personal
 *   /care-assistant/profile/address            → address
 *   /care-assistant/profile/emergency-contact  → emergency-contact
 *   /care-assistant/profile/photo              → photo
 */

import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound, UserCog, MapPin, Phone, Camera,
  ArrowLeft, Save, AlertTriangle, CheckCircle2,
  AlertCircle, Mail, Calendar, Globe, Briefcase,
  Clock, Star, Home, Building, Hash, Heart,
  Navigation, Trash2, Upload, User, ChevronDown,
} from "lucide-react";

import {
  getProfile,
  updateProfile,
  updateServiceArea,
  uploadPhoto,
  selectProfile,
  selectLoading,
  selectErrors,
  selectProfileCompletion,
} from "@/store/slices/careAssistantSlice";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  { key: "overview",          label: "Overview",  icon: UserRound, param: null },
  { key: "personal",          label: "Personal",  icon: UserCog,   param: "personal" },
  { key: "address",           label: "Address",   icon: MapPin,    param: "address" },
  { key: "emergency-contact", label: "Emergency", icon: Phone,     param: "emergency-contact" },
  { key: "photo",             label: "Photo",     icon: Camera,    param: "photo" },
];

const RELATIONS  = ["Spouse","Parent","Sibling","Child","Friend","Relative","Neighbour","Other"];
const WORK_TYPES = ["Part-Time","Full-Time","Freelance"];
const GENDERS    = ["Male","Female","Other","Prefer not to say"];
const KYC_BADGE  = {
  Verified:      "badge-success",
  "Under-Review":"badge-warning",
  Rejected:      "badge-error",
  Pending:       "badge-info",
};

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI ATOMS
// ─────────────────────────────────────────────────────────────────────────────

const Skel = ({ h = "h-12" }) => (
  <div className={`skeleton rounded-xl w-full ${h}`} />
);

const Field = ({ label, note, icon: Icon, children }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1.5 text-xs font-semibold text-base-content">
      {Icon && <Icon size={11} className="text-primary flex-shrink-0" />}
      {label}
    </label>
    {children}
    {note && (
      <p className="text-[10px] leading-snug text-base-content/45">{note}</p>
    )}
  </div>
);

const Inp = ({ className = "", ...props }) => (
  <input className={`input-field w-full text-sm ${className}`} {...props} />
);

const Sel = ({ children, ...props }) => (
  <div className="relative">
    <select className="input-field w-full text-sm appearance-none pr-8" {...props}>
      {children}
    </select>
    <ChevronDown
      size={13}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none"
    />
  </div>
);

/** Primary save button — care-assistant: fully rounded, warm lavender gradient */
const SaveBtn = ({ onClick, disabled, saving, label = "Save Changes" }) => (
  <button
    onClick={onClick}
    disabled={disabled || saving}
    className="btn-primary-cta w-full flex items-center justify-center gap-2 py-3 text-sm disabled:opacity-40"
  >
    {saving ? <span className="spinner w-4 h-4" /> : <Save size={14} />}
    {saving ? "Saving…" : label}
  </button>
);

/** Pill toggle — care-assistant style (fully rounded) */
const PillToggle = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        className={`px-3 py-1.5 text-[11px] font-semibold transition-all
          ${value === opt
            ? "bg-primary/10 text-primary border border-primary"
            : "bg-base-200 text-base-content/55 border border-base-300 hover:border-primary/40"
          } rounded-[var(--r-selector)]`}
  /* 1rem — care-assistant fully-rounded */
      >
        {opt}
      </button>
    ))}
  </div>
);

/** Tag-list input */
const TagInput = ({ tags = [], onChange, placeholder }) => {
  const [val, setVal] = useState("");

  const add = () => {
    const v = val.trim();
    if (v && !tags.includes(v)) onChange([...tags, v]);
    setVal("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="input-field flex-1 text-sm"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 text-xs font-bold text-primary-content flex-shrink-0 bg-primary rounded-[var(--r-field)]"
         
        >
          Add
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <span
              key={t}
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="badge badge-primary text-[10px] cursor-pointer select-none"
            >
              {t} ×
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETION RING — care-assistant primary colour (lavender)
// ─────────────────────────────────────────────────────────────────────────────

const Ring = ({ pct = 0 }) => {
  const r    = 26;
  const circ = 2 * Math.PI * r;
  const off  = circ - (circ * pct) / 100;

  return (
    <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
      <svg width="56" height="56" className="-rotate-90" aria-hidden="true">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--base-300)" strokeWidth="4.5" />
        <circle
          cx="28" cy="28" r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4.5"
          strokeDasharray={circ}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.9s ease" }}
        />
      </svg>
      <span
        className="absolute text-[10px] font-bold text-primary"
       
      >
        {pct}%
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AVATAR — care-assistant gradient (lavender → rose)
// ─────────────────────────────────────────────────────────────────────────────

const Avatar = ({ src, name, size = 68 }) => {
  const initials = name
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "CA";

  return (
    <div
      className="relative overflow-hidden flex-shrink-0 rounded-[var(--r-box)]"
      style={{ width: size, height: size, /* 1.5rem — care-assistant */ }}
    >
      {src ? (
        <Image
          src={src}
          alt={name || "Profile photo"}
          fill
          sizes={`${size}px`}
          className="object-cover"
          priority
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center font-bold text-base bg-bg-gradient-primary"
          style={{ /* lavender → rose */
            color: "var(--primary-content)" }}
        >
          {initials}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A — OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

const SectionOverview = ({ profile, pct }) => {
  if (!profile) {
    return (
      <div className="space-y-3">
        <Skel h="h-24" />
        {[...Array(5)].map((_, i) => <Skel key={i} />)}
      </div>
    );
  }

  const kycStatus = profile.kyc?.verificationStatus || "Pending";
  const kycClass  = KYC_BADGE[kycStatus] || "badge-info";

  const infoRows = [
    { icon: Mail,      label: "Email",         val: profile.email },
    { icon: Phone,     label: "Phone",         val: profile.phone },
    { icon: Briefcase, label: "Work Type",     val: profile.workType },
    { icon: Clock,     label: "Experience",    val: profile.experienceYears != null ? `${profile.experienceYears} yrs` : null },
    { icon: Star,      label: "Rating",        val: profile.performance?.averageRating ? `${profile.performance.averageRating} / 5` : null },
    { icon: Calendar,  label: "Date of Birth", val: profile.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null },
  ].filter((r) => r.val);

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="glass-card p-4 flex items-center gap-3">
        <Avatar src={profile.photoUrl} name={profile.fullName} size={64} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] text-base-content leading-tight truncate">
            {profile.fullName || "—"}
          </p>
          <p className="text-[10px] text-base-content/55 mt-0.5 truncate">{profile.email}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className={`badge ${kycClass} text-[9px]`}>{kycStatus}</span>
            {profile.isActive && <span className="badge badge-success text-[9px]">Active</span>}
          </div>
        </div>
        <Ring pct={pct} />
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="card p-4">
          <p className="text-xs text-base-content/70 leading-relaxed">{profile.bio}</p>
        </div>
      )}

      {/* Info rows */}
      {infoRows.length > 0 && (
        <div className="card divide-y divide-base-300">
          {infoRows.map(({ icon: Icon, label, val }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3">
              <Icon size={14} className="text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-base-content/45 font-semibold uppercase tracking-wide">{label}</p>
                <p className="text-xs font-semibold text-base-content truncate">{val}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Specializations */}
      {profile.specializations?.length > 0 && (
        <div className="card p-4">
          <p className="text-[9px] text-base-content/45 font-semibold uppercase tracking-wide mb-2">
            Specializations
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.specializations.map((s) => (
              <span key={s} className="badge badge-primary text-[9px]">{s}</span>
            ))}
          </div>
        </div>
      )}

      {/* Completion hints */}
      {pct < 100 && (
        <div className="card p-4">
          <p className="text-[9px] text-base-content/45 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1">
            <AlertCircle size={10} /> Complete your profile
          </p>
          <div className="space-y-2">
            {!profile.kyc?.aadhaarNumber && (
              <a
                href="/care-assistant/kyc/submit"
                className="flex items-center justify-between text-xs text-warning font-semibold p-2.5 no-underline rounded-[var(--r-box)] bg-[color-mix(in srgb, var(--warning), transparent 90%)]"
               
              >
                Submit KYC documents <span aria-hidden>→</span>
              </a>
            )}
            {!profile.bankDetails?.accountNumber && (
              <a
                href="/care-assistant/bank"
                className="flex items-center justify-between text-xs text-info font-semibold p-2.5 no-underline rounded-[var(--r-box)] bg-[color-mix(in srgb, var(--info), transparent 90%)]"
               
              >
                Add bank details <span aria-hidden>→</span>
              </a>
            )}
            {!profile.emergencyContact?.name && (
              <a
                href="/care-assistant/profile/emergency-contact"
                className="flex items-center justify-between text-xs text-primary font-semibold p-2.5 no-underline rounded-[var(--r-box)] bg-[color-mix(in srgb, var(--primary), transparent 90%)]"
               
              >
                Add emergency contact <span aria-hidden>→</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B — PERSONAL INFORMATION
// ─────────────────────────────────────────────────────────────────────────────

const SectionPersonal = ({ profile }) => {
  const dispatch = useDispatch();
  const { updateProfile: saving } = useSelector(selectLoading);

  const init = useMemo(() => ({
    fullName:        profile?.fullName        || "",
    dateOfBirth:     profile?.dateOfBirth     ? profile.dateOfBirth.split("T")[0] : "",
    gender:          profile?.gender          || "",
    phone:           profile?.phone           || "",
    alternatePhone:  profile?.alternatePhone  || "",
    email:           profile?.email           || "",
    bio:             profile?.bio             || "",
    experienceYears: profile?.experienceYears ?? "",
    workType:        profile?.workType        || "Part-Time",
    specializations: profile?.specializations || [],
    languagesKnown:  profile?.languagesKnown  || [],
  }), [profile]);

  const [form,  setForm]  = useState(init);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setForm(init); setDirty(false); }, [init]);

  const set = useCallback((k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    const payload = { ...form };
    if (payload.experienceYears !== "") payload.experienceYears = Number(payload.experienceYears);
    const res = await dispatch(updateProfile(payload));
    if (updateProfile.fulfilled.match(res)) setDirty(false);
  }, [dispatch, form]);

  if (!profile) {
    return <div className="space-y-3">{[...Array(7)].map((_, i) => <Skel key={i} />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* ── Identity ── */}
      <div className="card p-4 space-y-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Identity</p>

        <Field label="Full Name" icon={User} note="Enter exactly as on your government ID — used for KYC matching">
          <Inp
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="e.g. Priya Sharma"
          />
        </Field>

        <Field label="Date of Birth" icon={Calendar} note="Must be 18+ years · required for identity verification">
          <Inp
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
          />
        </Field>

        <Field label="Gender" icon={User} note="Tap to select — used for staff matching preferences">
          <PillToggle
            options={GENDERS}
            value={form.gender}
            onChange={(v) => set("gender", v)}
          />
        </Field>
      </div>

      {/* ── Contact ── */}
      <div className="card p-4 space-y-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Contact</p>

        <Field label="Primary Phone" icon={Phone} note="For OTPs, patient calls, and alerts — Indian numbers only (+91)">
          <Inp
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+91 XXXXX XXXXX"
          />
        </Field>

        <Field label="Alternate Phone" icon={Phone} note="Optional backup number — useful if primary is unreachable">
          <Inp
            type="tel"
            value={form.alternatePhone}
            onChange={(e) => set("alternatePhone", e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Email" icon={Mail} note="Your login email — changing it will require re-verification via OTP">
          <Inp
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
      </div>

      {/* ── Professional ── */}
      <div className="card p-4 space-y-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Professional</p>

        <Field label="Work Type" icon={Briefcase} note="Full-Time = 8+ hrs/day · Part-Time = flexible shifts">
          <PillToggle
            options={WORK_TYPES}
            value={form.workType}
            onChange={(v) => set("workType", v)}
          />
        </Field>

        <Field label="Experience (years)" icon={Clock} note="Total years in care or healthcare — affects your job ranking">
          <Inp
            type="number"
            min="0"
            max="50"
            value={form.experienceYears}
            onChange={(e) => set("experienceYears", e.target.value)}
            placeholder="0"
          />
        </Field>

        <Field label="Short Bio" icon={Star} note="Brief intro visible to patients — keep it warm and professional (2–3 lines)">
          <textarea
            className="input-field w-full text-sm resize-none"
            rows={3}
            value={form.bio}
            onChange={(e) => set("bio", e.target.value)}
            placeholder="Tell patients a little about yourself…"
          />
        </Field>

        <Field label="Specializations" icon={Star} note="Skills you're trained in — type a skill and press Add or Enter · tap × to remove">
          <TagInput
            tags={form.specializations}
            onChange={(v) => set("specializations", v)}
            placeholder="e.g. Elderly Care"
          />
        </Field>

        <Field label="Languages Known" icon={Globe} note="Languages you can communicate in — helps match with patients">
          <TagInput
            tags={form.languagesKnown}
            onChange={(v) => set("languagesKnown", v)}
            placeholder="e.g. Telugu"
          />
        </Field>
      </div>

      <SaveBtn onClick={save} disabled={!dirty} saving={saving} />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C — ADDRESS
// ─────────────────────────────────────────────────────────────────────────────

const SectionAddress = ({ profile }) => {
  const dispatch = useDispatch();
  const { updateProfile: savingAddr, settings: savingArea } = useSelector(selectLoading);

  const initAddr = useMemo(() => {
    const a = profile?.address || {};
    return {
      street:  a.street  || "",
      city:    a.city    || "",
      state:   a.state   || "",
      pincode: a.pincode || "",
      country: a.country || "India",
    };
  }, [profile]);

  const initArea = useMemo(() => ({
    preferredServiceAreas: profile?.preferredServiceAreas || [],
    maxServiceRadiusKm:    profile?.maxServiceRadiusKm    || 10,
  }), [profile]);

  const [addr,      setAddr]      = useState(initAddr);
  const [area,      setArea]      = useState(initArea);
  const [areaInput, setAreaInput] = useState("");
  const [dirtyAddr, setDirtyAddr] = useState(false);
  const [dirtyArea, setDirtyArea] = useState(false);

  useEffect(() => { setAddr(initAddr); setDirtyAddr(false); }, [initAddr]);
  useEffect(() => { setArea(initArea); setDirtyArea(false); }, [initArea]);

  const setA = useCallback((k, v) => { setAddr((p) => ({ ...p, [k]: v })); setDirtyAddr(true); }, []);

  const addServiceArea = useCallback(() => {
    const v = areaInput.trim();
    if (!v || area.preferredServiceAreas.includes(v)) return;
    setArea((p) => ({ ...p, preferredServiceAreas: [...p.preferredServiceAreas, v] }));
    setAreaInput("");
    setDirtyArea(true);
  }, [areaInput, area.preferredServiceAreas]);

  const removeServiceArea = useCallback((t) => {
    setArea((p) => ({ ...p, preferredServiceAreas: p.preferredServiceAreas.filter((x) => x !== t) }));
    setDirtyArea(true);
  }, []);

  const saveAddr = useCallback(async () => {
    const res = await dispatch(updateProfile({ address: addr }));
    if (updateProfile.fulfilled.match(res)) setDirtyAddr(false);
  }, [dispatch, addr]);

  const saveArea = useCallback(async () => {
    const res = await dispatch(updateServiceArea({
      preferredServiceAreas: area.preferredServiceAreas,
      maxServiceRadiusKm:    Number(area.maxServiceRadiusKm),
    }));
    if (updateServiceArea.fulfilled.match(res)) setDirtyArea(false);
  }, [dispatch, area]);

  if (!profile) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skel key={i} />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* ── Home Address ── */}
      <div className="card p-4 space-y-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Home Address</p>
          <p className="text-[10px] text-base-content/45 mt-0.5">Not shared publicly — kept private in admin records</p>
        </div>

        <Field label="Street / Flat No." icon={Home} note="Door no., apartment number, street name, and landmark">
          <Inp
            value={addr.street}
            onChange={(e) => setA("street", e.target.value)}
            placeholder="e.g. 12-3, MG Road, Near Bus Stand"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="City" icon={Building} note="Your current city of residence">
            <Inp value={addr.city} onChange={(e) => setA("city", e.target.value)} placeholder="Vijayawada" />
          </Field>
          <Field label="State" icon={MapPin}>
            <Inp value={addr.state} onChange={(e) => setA("state", e.target.value)} placeholder="Andhra Pradesh" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="PIN Code" icon={Hash} note="6-digit postal code">
            <Inp
              type="tel"
              maxLength={6}
              value={addr.pincode}
              onChange={(e) => setA("pincode", e.target.value)}
              placeholder="520001"
            />
          </Field>
          <Field label="Country" icon={Globe}>
            <Inp value={addr.country} onChange={(e) => setA("country", e.target.value)} />
          </Field>
        </div>

        <SaveBtn onClick={saveAddr} disabled={!dirtyAddr} saving={savingAddr} label="Save Address" />
      </div>

      {/* ── Service Area ── */}
      <div className="card p-4 space-y-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Service Area</p>
          <p className="text-[10px] text-base-content/45 mt-0.5">Areas you can work in — used to match you with nearby jobs</p>
        </div>

        <Field label="Preferred Areas" icon={Navigation} note="Type an area name and press Add or Enter · tap × to remove">
          <div className="flex gap-2">
            <input
              className="input-field flex-1 text-sm"
              value={areaInput}
              onChange={(e) => setAreaInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addServiceArea(); } }}
              placeholder="e.g. Benz Circle"
            />
            <button
              type="button"
              onClick={addServiceArea}
              className="px-3 py-2 text-xs font-bold text-primary-content flex-shrink-0 bg-primary rounded-[var(--r-field)]"
             
            >
              Add
            </button>
          </div>
          {area.preferredServiceAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {area.preferredServiceAreas.map((t) => (
                <span
                  key={t}
                  onClick={() => removeServiceArea(t)}
                  className="badge badge-primary text-[10px] cursor-pointer select-none"
                >
                  {t} ×
                </span>
              ))}
            </div>
          )}
        </Field>

        <Field label="Max Travel Radius" icon={Navigation} note="Farthest distance you're willing to travel from your home">
          <input
            type="range"
            min={1}
            max={50}
            step={1}
            value={area.maxServiceRadiusKm}
            onChange={(e) => {
              setArea((p) => ({ ...p, maxServiceRadiusKm: e.target.value }));
              setDirtyArea(true);
            }}
            className="w-full"
            style={{ accentColor: "var(--primary)" }}
            aria-label="Max service radius in km"
          />
          <div className="flex justify-between text-[10px] text-base-content/45 mt-0.5">
            <span>1 km</span>
            <span className="font-bold text-primary">
              {area.maxServiceRadiusKm} km
            </span>
            <span>50 km</span>
          </div>
        </Field>

        <SaveBtn onClick={saveArea} disabled={!dirtyArea} saving={savingArea} label="Save Service Area" />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D — EMERGENCY CONTACT
// ─────────────────────────────────────────────────────────────────────────────

const SectionEmergency = ({ profile }) => {
  const dispatch = useDispatch();
  const { updateProfile: saving } = useSelector(selectLoading);

  const init = useMemo(() => {
    const ec = profile?.emergencyContact || {};
    return { name: ec.name || "", phone: ec.phone || "", relation: ec.relation || "" };
  }, [profile]);

  const [form,  setForm]  = useState(init);
  const [dirty, setDirty] = useState(false);

  useEffect(() => { setForm(init); setDirty(false); }, [init]);

  const set = useCallback((k, v) => { setForm((p) => ({ ...p, [k]: v })); setDirty(true); }, []);

  const save = useCallback(async () => {
    const res = await dispatch(updateProfile({ emergencyContact: form }));
    if (updateProfile.fulfilled.match(res)) setDirty(false);
  }, [dispatch, form]);

  const isComplete = form.name && form.phone && form.relation;

  if (!profile) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skel key={i} />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Incomplete warning */}
      {!isComplete && (
        <div className="alert alert-warning">
          <AlertTriangle size={13} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs">
            An emergency contact is required to complete your profile and go online.
          </p>
        </div>
      )}

      <div className="card p-4 space-y-4">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40">Emergency Contact</p>
          <p className="text-[10px] text-base-content/45 mt-0.5">
            This person is contacted immediately if something happens during your assignment
          </p>
        </div>

        <Field label="Contact Name" icon={User} note="Full name of your trusted emergency contact person">
          <Inp
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Ramesh Kumar"
          />
        </Field>

        <Field label="Phone Number" icon={Phone} note="Mobile number we can reach at any time — Indian number preferred">
          <Inp
            type="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+91 XXXXX XXXXX"
          />
        </Field>

        <Field label="Relationship" icon={Heart} note="How is this person related to you — tap to select">
          {/* care-assistant: fully-rounded pill grid */}
          <div className="grid grid-cols-3 gap-1.5">
            {RELATIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => set("relation", r)}
                className={`py-2 text-[11px] font-semibold border transition-all ${
                  form.relation === r
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-base-300 bg-base-200 text-base-content/55 hover:border-primary/40"
                } rounded-[var(--r-selector)]`}
  /* 1rem */
              >
                {r}
              </button>
            ))}
          </div>
        </Field>

        {/* Saved contact preview */}
        {isComplete && !dirty && (
          <div
            className="flex items-center gap-3 p-3 border rounded-[var(--r-box)] bg-[color-mix(in srgb, var(--success), transparent 90%)]"
            style={{ borderColor: "color-mix(in srgb, var(--success), transparent 80%)" }}
          >
            <div
              className="w-9 h-9 flex items-center justify-center flex-shrink-0 bg-bg-gradient-success rounded-[var(--r-box)]"
             
            >
              <CheckCircle2 size={15} className="text-success-content" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-base-content truncate">{form.name}</p>
              <p className="text-[10px] text-base-content/55 truncate">{form.phone} · {form.relation}</p>
            </div>
          </div>
        )}

        <SaveBtn onClick={save} disabled={!dirty} saving={saving} label="Save Emergency Contact" />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E — PROFILE PHOTO
// ─────────────────────────────────────────────────────────────────────────────

const SectionPhoto = ({ profile }) => {
  const dispatch = useDispatch();
  const { uploadPhoto: uploading } = useSelector(selectLoading);
  const { uploadPhoto: uploadErr } = useSelector(selectErrors);

  const fileRef               = useRef(null);
  const [preview, setPreview] = useState(null);
  const [fileErr, setFileErr] = useState(null);
  const [done,    setDone]    = useState(false);

  const pickFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileErr(null);
    setDone(false);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setFileErr("Only JPEG, PNG, or WEBP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileErr("File must be under 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setPreview({ url: ev.target.result, file });
    reader.readAsDataURL(file);
  }, []);

  const doUpload = useCallback(async () => {
    if (!preview?.file) return;
    const res = await dispatch(uploadPhoto(preview.file));
    if (uploadPhoto.fulfilled.match(res)) {
      setDone(true);
      setPreview(null);
    }
  }, [dispatch, preview]);

  const discard = useCallback(() => {
    setPreview(null);
    setFileErr(null);
    setDone(false);
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  if (!profile) {
    return (
      <div className="space-y-3">
        <Skel h="h-52" />
        <Skel h="h-14" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current photo display */}
      {profile.photoUrl && !preview && (
        <div className="card p-4 flex flex-col items-center gap-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40 self-start">
            Current Photo
          </p>
          <div
            className="relative w-28 h-28 overflow-hidden border-2 rounded-[var(--r-box)]"
            style={{ /* 1.5rem — care-assistant */
              borderColor: "color-mix(in srgb, var(--primary), transparent 70%)" }}
          >
            <Image
              src={profile.photoUrl}
              alt="Current profile photo"
              fill
              sizes="112px"
              className="object-cover"
              priority
            />
          </div>
          <div className="flex items-center gap-1 text-success">
            <CheckCircle2 size={11} />
            <span className="text-[10px] font-semibold">Photo on file</span>
          </div>
        </div>
      )}

      {/* Preview of new selection */}
      <AnimatePresence>
        {preview && (
          <motion.div
            className="card p-4 flex flex-col items-center gap-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40 self-start">
              Preview
            </p>
            <div
              className="relative w-28 h-28 overflow-hidden border-2 rounded-[var(--r-box)]"
              style={{ borderColor: "color-mix(in srgb, var(--primary), transparent 50%)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt="New photo preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2 w-full">
              <button
                onClick={discard}
                className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs"
              >
                <Trash2 size={12} /> Discard
              </button>
              <button
                onClick={doUpload}
                disabled={uploading}
                className="btn-primary-cta flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs disabled:opacity-40"
              >
                {uploading ? <span className="spinner w-3 h-3" /> : <Upload size={12} />}
                {uploading ? "Uploading…" : "Upload Photo"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success */}
      <AnimatePresence>
        {done && (
          <motion.div
            className="alert alert-success"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <CheckCircle2 size={13} className="text-success" />
            <p className="text-xs font-semibold">Photo updated successfully!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {(fileErr || uploadErr) && (
        <div className="alert alert-error">
          <AlertCircle size={13} className="text-error flex-shrink-0" />
          <p className="text-xs">{fileErr || uploadErr}</p>
        </div>
      )}

      {/* Upload tap zone — care-assistant: dashed border with primary tint */}
      {!preview && (
        <div
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
          role="button"
          tabIndex={0}
          aria-label="Select profile photo"
          className="card p-6 flex flex-col items-center gap-4 cursor-pointer active:bg-primary/5 transition-colors border-[2px] border-dashed border-[color-mix(in srgb, var(--primary), transparent 55%)] rounded-[var(--r-box)]"
         
        >
          <div
            className="w-14 h-14 flex items-center justify-center bg-bg-gradient-primary rounded-[var(--r-box)]"
           
          >
            <Camera size={22} className="text-primary-content" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-base-content">Tap to select photo</p>
            <p className="text-[10px] text-base-content/50 mt-0.5">
              Camera or gallery · JPEG, PNG, WEBP · max 5 MB
            </p>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card p-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-base-content/40 mb-3">Photo Tips</p>
        <ul className="space-y-2">
          {[
            "Face clearly visible — no sunglasses or hats",
            "Good lighting — natural light works best",
            "Plain or simple background preferred",
            "Recent photo — taken within the last year",
          ].map((tip) => (
            <li key={tip} className="flex items-start gap-2">
              <CheckCircle2 size={10} className="text-success flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-base-content/65">{tip}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="user"
        className="hidden"
        onChange={pickFile}
        aria-hidden="true"
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT — care-assistant theme wrapper + sticky nav
// ─────────────────────────────────────────────────────────────────────────────

export default function MyProfile() {
  const params   = useParams();
  const router   = useRouter();
  const dispatch = useDispatch();

  const profile  = useSelector(selectProfile);
  const loading  = useSelector(selectLoading);
  const pct      = useSelector(selectProfileCompletion);

  const rawParam  = Array.isArray(params?.section) ? params.section[0] : params?.section;
  const activeKey = NAV.find((n) => n.param === (rawParam || null))?.key || "overview";

  useEffect(() => {
    if (!profile) dispatch(getProfile());
  }, [dispatch, profile]);

  const navigateTo = useCallback((item) => {
    const path = item.param
      ? `/care-assistant/profile/${item.param}`
      : "/care-assistant/profile";
    router.push(path);
  }, [router]);

  const isFirstLoad = loading.profile && !profile;

  return (
    /* ── Apply care-assistant theme to the entire page ── */
    <div
      data-theme="care-assistant"
      className="min-h-screen bg-base-100 text-base-content"
     
    >

      {/* ──────────── Sticky Header ──────────── */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-base-300 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[14px]"
       
      >
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-base-200 transition-colors flex-shrink-0 rounded-[var(--r-selector)]"
         
          aria-label="Go back"
        >
          <ArrowLeft size={17} className="text-base-content" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-bold text-base-content leading-tight">My Profile</h1>
          <div className="flex items-center gap-2 mt-0.5" aria-label={`Profile ${pct}% complete`}>
            <div
              className="flex-1 h-1 overflow-hidden rounded-[9999px] bg-base-300"
             
            >
              <div
                className="h-full transition-all duration-700 rounded-[9999px] bg-bg-gradient-primary"
                style={{ width: `${pct}%`, /* lavender → rose */ }}
              />
            </div>
            <span
              className="text-[10px] font-semibold flex-shrink-0 text-primary"
             
            >
              {pct}%
            </span>
          </div>
        </div>

        {isFirstLoad && (
          <span className="spinner w-4 h-4 flex-shrink-0" role="status" aria-label="Loading" />
        )}
      </header>

      {/* ──────────── Sticky Tab Nav ──────────── */}
      <nav
        className="sticky top-[57px] z-20 border-b border-base-300 overflow-x-auto bg-[color-mix(in srgb, var(--base-100) 92%, transparent)]"
        style={{ scrollbarWidth: "none" }}
        aria-label="Profile sections"
      >
        <div className="flex px-2 py-1 itesm-center justify-center gap-0.5 w-max min-w-full">
          {NAV.map((item) => {
            const active = activeKey === item.key;
            const Icon   = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => navigateTo(item)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-3.5 py-2 text-[10px] font-semibold
                  transition-all duration-200 flex-shrink-0 ${
                  active
                    ? "text-primary bg-primary/10"
                    : "text-base-content/45 hover:text-base-content hover:bg-base-200 active:scale-95"
                } rounded-[var(--r-selector)]`}
  /* 1rem — care-assistant */
              >
                <Icon size={15} strokeWidth={active ? 2.5 : 1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ──────────── Section Content ──────────── */}
      <main className="px-4 pt-3 pb-24 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeKey}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
          >
            {isFirstLoad ? (
              <div className="space-y-3 pt-1">
                <Skel h="h-24" />
                {[...Array(4)].map((_, i) => <Skel key={i} />)}
              </div>
            ) : (
              <>
                {activeKey === "overview"          && <SectionOverview   profile={profile} pct={pct} />}
                {activeKey === "personal"          && <SectionPersonal   profile={profile} />}
                {activeKey === "address"           && <SectionAddress    profile={profile} />}
                {activeKey === "emergency-contact" && <SectionEmergency  profile={profile} />}
                {activeKey === "photo"             && <SectionPhoto      profile={profile} />}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}