"use client";

import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserRound, Stethoscope, Award, Languages, CircleDollarSign, Camera,
  CheckCircle2, Clock, AlertCircle, ChevronRight, Star, Activity,
  Building2, Shield, Edit3, Save, X, Plus, Trash2, Upload, RotateCcw,
  TrendingUp, Users, Calendar, Briefcase, Globe, Phone, Mail, BadgeCheck,
  Image as ImageIcon, FileText, BookOpen, Mic,
} from "lucide-react";
import {
  fetchMyDoctorProfile,
  updateDoctorProfile,
  uploadDoctorPhoto,
  uploadDoctorSignature,
  selectMyDoctorProfile,
  selectHospitalLoading,
  selectHospitalError,
} from "@/store/slices/hospitalSlice";
import { RadialBarChart, RadialBar, ResponsiveContainer } from "recharts";

// ─── Section registry ─────────────────────────────────────────────────────────
const SECTIONS = [
  { id: "overview",       label: "Profile Overview",  icon: UserRound,        href: "/doctor/profile" },
  { id: "professional",   label: "Professional Info", icon: Stethoscope,      href: "/doctor/profile/professional" },
  { id: "qualifications", label: "Qualifications",    icon: Award,            href: "/doctor/profile/qualifications" },
  { id: "bio",            label: "Languages & Bio",   icon: Languages,        href: "/doctor/profile/bio" },
  { id: "fees",           label: "Consultation Fees", icon: CircleDollarSign, href: "/doctor/profile/fees" },
  { id: "photo",          label: "Profile Photo",     icon: Camera,           href: "/doctor/profile/photo" },
  { id: "signature",      label: "E-Signature",       icon: Edit3,            href: "/doctor/profile/signature" },
];

const resolveSection = (param) => {
  if (!param) return "overview";
  return SECTIONS.find((s) => s.id === param)?.id ?? "overview";
};

// ─── Style tokens — routed through globals.css component classes ─────────────
const inputCls = "input-field text-xs";
const labelCls = "block text-[10px] font-semibold uppercase tracking-widest text-base-content/50 mb-1.5 font-montserrat";

// ─── Badge helpers — map onto globals.css .badge-* variants ──────────────────
const kycBadge = (status) => {
  const map = {
    verified:        { label: "KYC Verified",  cls: "badge-success" },
    pending:         { label: "KYC Pending",   cls: "badge-warning" },
    "under-review":  { label: "Under Review",  cls: "badge-info" },
    rejected:        { label: "KYC Rejected",  cls: "badge-error" },
    "not-submitted": { label: "Not Submitted", cls: "badge-secondary" },
  };
  return map[status] ?? map["not-submitted"];
};

const partnerBadge = (status) => {
  const map = {
    Active:    { label: "Active Partner", cls: "badge-success" },
    Pending:   { label: "Pending",        cls: "badge-warning" },
    Inactive:  { label: "Inactive",       cls: "badge-secondary" },
    Suspended: { label: "Suspended",      cls: "badge-error" },
  };
  return map[status] ?? map["Pending"];
};

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function SectionCard({ children, className = "" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className={`card p-6 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, icon: Icon, onEdit, isEditing, onCancel, onSave, saving }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="text-base font-bold text-base-content font-montserrat">{title}</h2>
          {subtitle && <p className="text-[10px] text-base-content/50 mt-0.5 font-poppins">{subtitle}</p>}
        </div>
      </div>
      {onEdit && (
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={onCancel} className="btn btn-xs btn-ghost">
                <X size={13} /> Cancel
              </button>
              <button onClick={onSave} disabled={saving} className="btn btn-xs btn-primary">
                {saving ? <span className="spinner w-3 h-3" /> : <Save size={13} />} Save
              </button>
            </>
          ) : (
            <button onClick={onEdit} className="btn btn-xs btn-outline">
              <Edit3 size={13} /> Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon size={15} className="text-primary mt-0.5 flex-shrink-0" />}
      <div>
        <p className="text-[10px] text-base-content/40 font-poppins">{label}</p>
        <p className="text-xs font-semibold text-base-content font-poppins">{value || "—"}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SECTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Overview ─────────────────────────────────────────────────────────────────
function OverviewSection({ profile }) {
  const user    = profile?.user || {};
  const kyc     = kycBadge(profile?.kycStatus);
  const partner = partnerBadge(profile?.partnershipStatus);
  const completion = profile?.profileCompletionPercent ?? 0;

  const completionData = [
    { name: "Completion", value: completion, fill: "var(--color-primary)" },
  ];

  const stats = [
    { label: "Consultations", value: profile?.stats?.totalConsultations ?? 0,                         icon: Users },
    { label: "Avg Rating",    value: profile?.rating?.averageRating?.toFixed(1) ?? "—",               icon: Star },
    { label: "Experience",    value: `${profile?.experienceYears ?? 0}y`,                             icon: Briefcase },
    { label: "Earnings",      value: `₹${((profile?.stats?.totalEarnings ?? 0) / 1000).toFixed(1)}k`, icon: TrendingUp },
  ];

  // FIX: schema field is `weeklyAvailability`, not `availability`.
  const hasAvailability = (profile?.weeklyAvailability ?? []).some(
    (d) => d.isAvailable && d.slots?.length > 0
  );

  return (
    <div className="space-y-5">
      {/* Profile-incomplete nudge */}
      {completion < 100 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="alert alert-warning"
        >
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-warning" />
          <div>
            <p className="text-sm font-semibold text-warning">Your profile is {completion}% complete</p>
            <p className="text-xs text-base-content/60 mt-0.5">
              Finish the checklist below to unlock full visibility to patients.
            </p>
          </div>
        </motion.div>
      )}

      {/* Hero card */}
      <SectionCard>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-md">
              {profile?.profilePhotoUrl || user?.avatar ? (
                <img src={profile?.profilePhotoUrl || user?.avatar} alt={user?.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <UserRound size={36} className="text-primary/40" />
                </div>
              )}
            </div>
            <div className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-base-100 ${profile?.isOnline ? "bg-success" : "bg-base-300"}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-black text-base-content font-montserrat">Dr. {user?.name || "—"}</h1>
              {profile?.isVerified && <BadgeCheck size={18} className="text-primary" />}
            </div>
            <p className="text-xs text-primary font-semibold mb-2 font-poppins">{profile?.specialization || "—"}</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className={`badge badge-sm ${kyc.cls}`}>{kyc.label}</span>
              <span className={`badge badge-sm ${partner.cls}`}>{partner.label}</span>
            </div>
            <div className="flex flex-wrap gap-4 text-[10px] text-base-content/50">
              {user?.email && <span className="flex items-center gap-1"><Mail size={12} />{user.email}</span>}
              {user?.phone && <span className="flex items-center gap-1"><Phone size={12} />{user.phone}</span>}
            </div>
          </div>

          {/* Completion ring */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="relative w-20 h-20">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="65%" outerRadius="100%" data={completionData} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "var(--color-base-300)" }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-black text-base-content font-montserrat">{completion}%</span>
              </div>
            </div>
            <p className="text-[10px] text-base-content/40 font-poppins">Profile</p>
          </div>
        </div>
      </SectionCard>

      {/* Stats grid — using globals.css .stat-card family */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="stat-card text-center hover:-translate-y-0.5 transition-transform cursor-default">
            <Icon size={18} className="text-primary mx-auto mb-1.5" />
            <p className="stat-card-value !text-lg">{value}</p>
            <p className="stat-card-label !mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Primary hospital */}
      {profile?.primaryHospital && (
        <SectionCard>
          <div className="flex items-center gap-3">
            <Building2 size={18} className="text-primary" />
            <div>
              <p className="text-[10px] text-base-content/40 font-poppins">Primary Hospital</p>
              <p className="text-xs font-semibold text-base-content font-montserrat">{profile.primaryHospital?.name || "—"}</p>
              {profile.primaryHospital?.address?.city && (
                <p className="text-[10px] text-base-content/40">{profile.primaryHospital.address.city}, {profile.primaryHospital.address.state}</p>
              )}
              {profile.primaryHospital?.managementModel === "hospital-manager" && (
                <span className="badge badge-sm badge-info mt-1.5">Hospital sets your pricing</span>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Onboarding checklist */}
      <SectionCard>
        <SectionHeader title="Onboarding Checklist" subtitle="Complete all steps to go live" icon={CheckCircle2} />
        <div className="space-y-2.5">
          {[
            { label: "Specialization set",        done: !!profile?.specialization },
            { label: "Registration number added", done: !!profile?.registrationNumber },
            { label: "Aadhaar verified",          done: !!profile?.kyc?.aadhaarVerified },
            { label: "PAN verified",              done: !!profile?.kyc?.panVerified },
            { label: "Primary hospital linked",   done: !!profile?.primaryHospital },
            { label: "Availability schedule set", done: hasAvailability },
            { label: "Consultation fee set",      done: (profile?.fees?.inPersonFee ?? 0) > 0 },
            { label: "Bank details submitted",    done: !!profile?.bankDetails?.isBankVerified },
            { label: "Profile photo uploaded",    done: !!profile?.profilePhotoUrl },
            { label: "E-Signature uploaded",      done: !!profile?.doctorSignature },
            { label: "Partnership active",        done: profile?.partnershipStatus === "Active" },
          ].map(({ label, done }) => (
            <div key={label} className="flex items-center gap-3">
              {done
                ? <CheckCircle2 size={15} className="text-success flex-shrink-0" />
                : <Clock size={15} className="text-base-content/30 flex-shrink-0" />}
              <span className={`text-xs font-poppins ${done ? "text-base-content/70 line-through" : "text-base-content"}`}>{label}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Professional ─────────────────────────────────────────────────────────────
function ProfessionalSection({ profile, dispatch }) {
  const loading = useSelector(selectHospitalLoading);
  const saving  = loading.updateDoctorProfile;

  const SPECIALIZATIONS = [
    "General Physician","Cardiologist","Neurologist","Pediatrician","Oncologist",
    "Orthopedic Surgeon","Gastroenterologist","Gynecologist","Dermatologist",
    "Urologist","Psychiatry","Physiotherapist",
  ];

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    specialization:      profile?.specialization      || "",
    experienceYears:     profile?.experienceYears     || 0,
    registrationNumber:  profile?.registrationNumber  || "",
    registrationCouncil: profile?.registrationCouncil || "",
    achievements:        profile?.achievements        || [],
  });
  const [newAch, setNewAch] = useState("");

  const reset = () => {
    setForm({
      specialization:      profile?.specialization      || "",
      experienceYears:     profile?.experienceYears     || 0,
      registrationNumber:  profile?.registrationNumber  || "",
      registrationCouncil: profile?.registrationCouncil || "",
      achievements:        profile?.achievements        || [],
    });
    setEditing(false);
  };

  const save = async () => {
    if (!profile?._id) return;
    await dispatch(updateDoctorProfile({ id: profile._id, ...form }));
    setEditing(false);
  };

  const addAch = () => {
    if (!newAch.trim()) return;
    setForm((f) => ({ ...f, achievements: [...f.achievements, newAch.trim()] }));
    setNewAch("");
  };

  return (
    <SectionCard>
      <SectionHeader
        title="Professional Information"
        subtitle="Your credentials and specialization"
        icon={Stethoscope}
        onEdit={() => setEditing(true)}
        isEditing={editing}
        onCancel={reset}
        onSave={save}
        saving={saving}
      />
      {editing ? (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Specialization</label>
            <select className={inputCls} value={form.specialization} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))}>
              <option value="">Select specialization</option>
              {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Experience (years)</label>
              <input type="number" min={0} max={70} className={inputCls} value={form.experienceYears} onChange={(e) => setForm((f) => ({ ...f, experienceYears: +e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>MCI Registration No.</label>
              <input className={inputCls} value={form.registrationNumber} onChange={(e) => setForm((f) => ({ ...f, registrationNumber: e.target.value }))} placeholder="MCI-XXXXX" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Registration Council</label>
            <input className={inputCls} value={form.registrationCouncil} onChange={(e) => setForm((f) => ({ ...f, registrationCouncil: e.target.value }))} placeholder="e.g. Andhra Pradesh Medical Council" />
          </div>
          <div>
            <label className={labelCls}>Achievements</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.achievements.map((a, i) => (
                <span key={i} className="badge badge-primary">
                  {a}
                  <button onClick={() => setForm((f) => ({ ...f, achievements: f.achievements.filter((_, j) => j !== i) }))}><X size={11} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inputCls} value={newAch} onChange={(e) => setNewAch(e.target.value)} placeholder="Add achievement…" onKeyDown={(e) => e.key === "Enter" && addAch()} />
              <button onClick={addAch} className="btn btn-sm btn-primary"><Plus size={16} /></button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <InfoRow label="Specialization"   value={profile?.specialization}                    icon={Stethoscope} />
          <InfoRow label="Experience"       value={`${profile?.experienceYears ?? 0} years`}  icon={Briefcase} />
          <InfoRow label="Registration No." value={profile?.registrationNumber  || "Not set"} icon={FileText} />
          <InfoRow label="Council"          value={profile?.registrationCouncil || "Not set"} icon={Shield} />
          {profile?.achievements?.length > 0 && (
            <div>
              <p className={labelCls}>Achievements</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.achievements.map((a, i) => (
                  <span key={i} className="badge badge-primary">{a}</span>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className={labelCls}>Consultation Types</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {profile?.consultationTypes?.inPerson  && <span className="badge badge-success">In-Person</span>}
              {profile?.consultationTypes?.video     && <span className="badge badge-info">Video</span>}
              {profile?.consultationTypes?.homeVisit && <span className="badge badge-warning">Home Visit</span>}
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Qualifications ───────────────────────────────────────────────────────────
function QualificationsSection({ profile, dispatch }) {
  const loading = useSelector(selectHospitalLoading);
  const saving  = loading.updateDoctorProfile;

  const [editing, setEditing] = useState(false);
  const [quals, setQuals]     = useState(profile?.qualifications || []);

  const reset  = () => { setQuals(profile?.qualifications || []); setEditing(false); };
  const add    = () => setQuals((q) => [...q, { degree: "", college: "", year: "" }]);
  const remove = (i) => setQuals((q) => q.filter((_, j) => j !== i));
  const update = (i, field, val) => setQuals((q) => q.map((item, j) => j === i ? { ...item, [field]: val } : item));

  const save = async () => {
    if (!profile?._id) return;
    await dispatch(updateDoctorProfile({ id: profile._id, qualifications: quals }));
    setEditing(false);
  };

  return (
    <SectionCard>
      <SectionHeader
        title="Qualifications"
        subtitle="Academic and professional degrees"
        icon={Award}
        onEdit={() => setEditing(true)}
        isEditing={editing}
        onCancel={reset}
        onSave={save}
        saving={saving}
      />
      {editing ? (
        <div className="space-y-4">
          {quals.map((q, i) => (
            <div key={i} className="p-4 bg-base-200 rounded-xl border border-base-300 space-y-3 relative">
              <button onClick={() => remove(i)} className="absolute top-3 right-3 text-error/70 hover:text-error transition-colors"><Trash2 size={14} /></button>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Degree</label>
                  <input className={inputCls} value={q.degree} onChange={(e) => update(i, "degree", e.target.value)} placeholder="e.g. MBBS" />
                </div>
                <div>
                  <label className={labelCls}>Year</label>
                  <input type="number" className={inputCls} value={q.year} onChange={(e) => update(i, "year", +e.target.value)} placeholder="e.g. 2015" />
                </div>
              </div>
              <div>
                <label className={labelCls}>College / University</label>
                <input className={inputCls} value={q.college} onChange={(e) => update(i, "college", e.target.value)} placeholder="e.g. AIIMS Delhi" />
              </div>
            </div>
          ))}
          <button onClick={add} className="flex items-center gap-2 text-xs text-primary font-semibold hover:underline font-poppins">
            <Plus size={15} /> Add Qualification
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {(profile?.qualifications?.length ?? 0) === 0 ? (
            <p className="text-xs text-base-content/40 italic font-poppins">No qualifications added yet.</p>
          ) : (
            profile.qualifications.map((q, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-base-200/60 rounded-xl border border-base-300">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Award size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold text-base-content font-montserrat">{q.degree || "—"}</p>
                  <p className="text-[10px] text-base-content/60 font-poppins">{q.college || "—"}</p>
                  {q.year && <p className="text-[10px] text-primary mt-0.5">{q.year}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Bio ──────────────────────────────────────────────────────────────────────
function BioSection({ profile, dispatch }) {
  const loading = useSelector(selectHospitalLoading);
  const saving  = loading.updateDoctorProfile;

  const ALL_LANGS = ["English","Telugu","Hindi","Tamil","Kannada","Malayalam","Urdu","Marathi","Bengali","Gujarati","Punjabi","Odia"];

  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({
    biography:       profile?.biography       || "",
    languagesSpoken: profile?.languagesSpoken || [],
  });

  const reset = () => {
    setForm({ biography: profile?.biography || "", languagesSpoken: profile?.languagesSpoken || [] });
    setEditing(false);
  };

  const save = async () => {
    if (!profile?._id) return;
    await dispatch(updateDoctorProfile({ id: profile._id, ...form }));
    setEditing(false);
  };

  const toggleLang = (lang) =>
    setForm((f) => ({
      ...f,
      languagesSpoken: f.languagesSpoken.includes(lang)
        ? f.languagesSpoken.filter((l) => l !== lang)
        : [...f.languagesSpoken, lang],
    }));

  return (
    <SectionCard>
      <SectionHeader
        title="Languages & Biography"
        subtitle="Tell patients about yourself"
        icon={Languages}
        onEdit={() => setEditing(true)}
        isEditing={editing}
        onCancel={reset}
        onSave={save}
        saving={saving}
      />
      {editing ? (
        <div className="space-y-5">
          <div>
            <label className={labelCls}>Biography</label>
            <textarea
              className={`${inputCls} h-32 resize-none`}
              value={form.biography}
              onChange={(e) => setForm((f) => ({ ...f, biography: e.target.value }))}
              placeholder="Write a short bio about your practice, expertise, and approach to patient care…"
              maxLength={1000}
            />
            <p className="text-[10px] text-base-content/30 mt-1 text-right">{form.biography.length}/1000</p>
          </div>
          <div>
            <label className={labelCls}>Languages Spoken</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_LANGS.map((lang) => (
                <button
                  key={lang}
                  onClick={() => toggleLang(lang)}
                  className={`badge badge-sm cursor-pointer transition-all ${
                    form.languagesSpoken.includes(lang) ? "badge-primary" : "badge-secondary"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <p className={labelCls}><Mic size={11} className="inline mr-1" />Biography</p>
            {profile?.biography
              ? <p className="text-xs text-base-content/80 leading-relaxed font-poppins">{profile.biography}</p>
              : <p className="text-xs text-base-content/30 italic">No biography added yet.</p>}
          </div>
          <div>
            <p className={labelCls}><Globe size={11} className="inline mr-1" />Languages</p>
            {(profile?.languagesSpoken?.length ?? 0) > 0 ? (
              <div className="flex flex-wrap gap-2 mt-1">
                {profile.languagesSpoken.map((l) => (
                  <span key={l} className="badge badge-primary">{l}</span>
                ))}
              </div>
            ) : <p className="text-xs text-base-content/30 italic">No languages added.</p>}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Fees ─────────────────────────────────────────────────────────────────────
function FeesSection({ profile, dispatch }) {
  const loading = useSelector(selectHospitalLoading);
  const saving  = loading.updateDoctorProfile;

  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({
    fees:              { ...profile?.fees },
    consultationTypes: { ...profile?.consultationTypes },
  });

  const reset = () => {
    setForm({ fees: { ...profile?.fees }, consultationTypes: { ...profile?.consultationTypes } });
    setEditing(false);
  };

  const save = async () => {
    if (!profile?._id) return;
    await dispatch(updateDoctorProfile({ id: profile._id, fees: form.fees, consultationTypes: form.consultationTypes }));
    setEditing(false);
  };

  const feeFields = [
    { key: "inPersonFee",  label: "In-Person Consultation", type: "inPerson",  icon: Users },
    { key: "videoFee",     label: "Video Consultation",     type: "video",     icon: Activity },
    { key: "homeVisitFee", label: "Home Visit",             type: "homeVisit", icon: Building2 },
    { key: "followUpFee",  label: "Follow-Up",              type: null,        icon: Calendar },
  ];

  const isHospitalManaged = profile?.primaryHospital?.managementModel === "hospital-manager";

  return (
    <SectionCard>
      <SectionHeader
        title="Consultation Fees"
        subtitle={isHospitalManaged ? "Set by your hospital manager" : "Set your fees for each consultation type"}
        icon={CircleDollarSign}
        onEdit={isHospitalManaged ? undefined : () => setEditing(true)}
        isEditing={editing}
        onCancel={reset}
        onSave={save}
        saving={saving}
      />

      {isHospitalManaged && (
        <div className="alert alert-info mb-4">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-info" />
          <p className="text-xs text-base-content/70">
            {profile.primaryHospital?.name} controls consultation pricing for all its linked doctors.
            Talk to your hospital manager to change fees.
          </p>
        </div>
      )}

      {editing ? (
        <div className="space-y-4">
          {feeFields.map(({ key, label, type, icon: Icon }) => (
            <div key={key} className="p-4 bg-base-200 rounded-xl border border-base-300">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={14} className="text-primary" />
                  <span className="text-xs font-semibold text-base-content font-poppins">{label}</span>
                </div>
                {type && (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={form.consultationTypes?.[type] || false}
                      onChange={(e) => setForm((f) => ({ ...f, consultationTypes: { ...f.consultationTypes, [type]: e.target.checked } }))}
                    />
                    <span className="text-[10px] text-base-content/50">Enabled</span>
                  </label>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-base-content/40 font-bold">₹</span>
                <input
                  type="number"
                  min={0}
                  className={`${inputCls} pl-8`}
                  value={form.fees?.[key] || ""}
                  onChange={(e) => setForm((f) => ({ ...f, fees: { ...f.fees, [key]: +e.target.value } }))}
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {feeFields.map(({ key, label, type, icon: Icon }) => {
            const enabled = type ? profile?.consultationTypes?.[type] : true;
            const fee     = profile?.fees?.[key];
            return (
              <div key={key} className={`flex items-center justify-between p-4 rounded-xl border ${enabled ? "bg-base-200/60 border-base-300" : "bg-base-200/20 border-base-300/30 opacity-50"}`}>
                <div className="flex items-center gap-3">
                  <Icon size={15} className={enabled ? "text-primary" : "text-base-content/30"} />
                  <div>
                    <p className="text-xs font-semibold text-base-content font-poppins">{label}</p>
                    {type && <p className="text-[10px] text-base-content/40">{enabled ? "Enabled" : "Disabled"}</p>}
                  </div>
                </div>
                <p className="text-base font-black text-base-content font-montserrat">
                  {fee
                    ? `₹${fee.toLocaleString("en-IN")}`
                    : <span className="text-base-content/30 text-xs font-poppins">Not set</span>}
                </p>
              </div>
            );
          })}
          {profile?.platformFee && (
            <div className="alert alert-warning mt-2">
              <AlertCircle size={13} className="text-warning flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold text-warning font-montserrat">Custom Platform Fee Applied</p>
                <p className="text-[10px] text-base-content/60 font-poppins">
                  {profile.platformFee.type === "fixed"
                    ? `₹${profile.platformFee.value} flat per transaction`
                    : `${profile.platformFee.value}% of transaction value`}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Photo ────────────────────────────────────────────────────────────────────
function PhotoSection({ profile, dispatch }) {
  const loading   = useSelector(selectHospitalLoading);
  const uploading = loading.uploadDoctorPhoto;
  const fileRef   = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile]       = useState(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !profile?._id) return;
    await dispatch(uploadDoctorPhoto({ id: profile._id, photo: file }));
    setFile(null);
    setPreview(null);
  };

  const cancel       = () => { setFile(null); setPreview(null); };
  const currentPhoto = profile?.profilePhotoUrl || profile?.user?.avatar;

  return (
    <SectionCard>
      <SectionHeader title="Profile Photo" subtitle="Upload a professional headshot" icon={Camera} />
      <div className="flex flex-col sm:flex-row gap-8 items-center">
        <div className="relative flex-shrink-0">
          <div className="w-36 h-36 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-lg">
            {preview || currentPhoto ? (
              <img src={preview || currentPhoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-primary/5 flex flex-col items-center justify-center gap-2">
                <Camera size={32} className="text-primary/30" />
                <p className="text-[10px] text-base-content/30">No photo</p>
              </div>
            )}
          </div>
          {preview && (
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-warning text-warning-content flex items-center justify-center">
              <span className="text-[10px] font-black">!</span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <p className="text-xs text-base-content/60 font-poppins leading-relaxed">
            Upload a clear, professional headshot. Accepted formats: JPG, PNG, WEBP. Max 5MB.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileRef.current?.click()} className="btn btn-sm btn-outline">
              <ImageIcon size={15} /> Choose Photo
            </button>
            {file && (
              <>
                <button onClick={handleUpload} disabled={uploading} className="btn btn-sm btn-primary">
                  {uploading ? <span className="spinner w-4 h-4" /> : <Upload size={15} />}
                  {uploading ? "Uploading…" : "Upload"}
                </button>
                <button onClick={cancel} className="btn btn-sm btn-ghost">
                  <RotateCcw size={13} /> Reset
                </button>
              </>
            )}
          </div>
          {file && <p className="text-[10px] text-primary font-poppins">Selected: {file.name}</p>}
          <p className="text-[10px] text-base-content/30 font-poppins">Your photo will also update your platform account avatar.</p>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Signature ────────────────────────────────────────────────────────────────
function SignatureSection({ profile, dispatch }) {
  const loading   = useSelector(selectHospitalLoading);
  const uploading = loading.uploadDoctorSignature;
  const fileRef   = useRef(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile]       = useState(null);

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleUpload = async () => {
    if (!file || !profile?._id) return;
    await dispatch(uploadDoctorSignature({ id: profile._id, signature: file }));
    setFile(null);
    setPreview(null);
  };

  const cancel            = () => { setFile(null); setPreview(null); };
  const currentSignature  = profile?.doctorSignature;

  return (
    <SectionCard>
      <SectionHeader title="E-Signature" subtitle="Upload your digital signature for prescriptions" icon={Edit3} />
      <div className="flex flex-col sm:flex-row gap-8 items-center">
        <div className="relative flex-shrink-0">
          <div className="w-48 h-24 rounded-2xl overflow-hidden border-2 border-primary/20 bg-base-100 flex items-center justify-center p-2 shadow-inner">
            {preview || currentSignature ? (
              <img src={preview || currentSignature} alt="Signature" className="max-w-full max-h-full object-contain mix-blend-multiply dark:mix-blend-normal" />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <Edit3 size={24} className="text-primary/30" />
                <p className="text-[10px] text-base-content/30">No signature</p>
              </div>
            )}
          </div>
          {preview && (
            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-warning text-warning-content flex items-center justify-center">
              <span className="text-[10px] font-black">!</span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <input ref={fileRef} type="file" accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleFile} />
          <p className="text-xs text-base-content/60 font-poppins leading-relaxed">
            Upload a clear image of your signature on a plain white background. This will be used automatically on your generated prescriptions and medical certificates.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => fileRef.current?.click()} className="btn btn-sm btn-outline">
              <ImageIcon size={15} /> Choose Signature
            </button>
            {file && (
              <>
                <button onClick={handleUpload} disabled={uploading} className="btn btn-sm btn-primary">
                  {uploading ? <span className="spinner w-4 h-4" /> : <Upload size={15} />}
                  {uploading ? "Uploading…" : "Upload"}
                </button>
                <button onClick={cancel} className="btn btn-sm btn-ghost">
                  <RotateCcw size={13} /> Reset
                </button>
              </>
            )}
          </div>
          {file && <p className="text-[10px] text-primary font-poppins">Selected: {file.name}</p>}
        </div>
      </div>
    </SectionCard>
  );
}

// ─── Navigation components ────────────────────────────────────────────────────
function SidebarNav({ activeId }) {
  return (
    <nav className="space-y-1">
      {SECTIONS.map(({ id, label, icon: Icon, href }) => {
        const isActive = activeId === id;
        return (
          <Link
            key={id}
            href={href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all group ${
              isActive
                ? "bg-primary text-primary-content shadow-md shadow-primary/20"
                : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
            }`}
          >
            <Icon
              size={16}
              className={isActive ? "text-primary-content" : "text-base-content/40 group-hover:text-primary transition-colors"}
            />
            <span className="font-poppins">{label}</span>
            {isActive && <ChevronRight size={14} className="ml-auto text-primary-content/60" />}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileTabs({ activeId }) {
  return (
    <div className="flex overflow-x-auto gap-2 scrollbar-hide">
      {SECTIONS.map(({ id, label, icon: Icon, href }) => {
        const isActive = activeId === id;
        return (
          <Link
            key={id}
            href={href}
            className={`flex-shrink-0 flex items-center mb-4 gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold transition-all ${
              isActive ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/60"
            }`}
          >
            <Icon size={13} />
            <span className="font-poppins whitespace-nowrap">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function MyProfile() {
  const params   = useParams();
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const loading  = useSelector(selectHospitalLoading);
  const error    = useSelector(selectHospitalError);

  const activeId = resolveSection(params?.section);

  useEffect(() => {
    dispatch(fetchMyDoctorProfile());
  }, [dispatch]);

  if (loading.fetchMyDoctorProfile) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="loading-spinner loading-lg" />
          <p className="text-xs text-base-content/50 font-poppins">Loading your profile…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <AlertCircle size={36} className="text-error mx-auto" />
          <p className="text-base font-semibold text-base-content font-montserrat">Failed to load profile</p>
          <p className="text-xs text-base-content/50 font-poppins">{error}</p>
          <button onClick={() => dispatch(fetchMyDoctorProfile())} className="btn btn-primary-cta text-[10px] px-5 py-2.5">Retry</button>
        </div>
      </div>
    );
  }

  const sectionProps = { profile, dispatch };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Top banner */}
      <div className="bg-base-100 border-b border-base-300 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserRound size={16} className="text-primary" />
            </div>
            <h1 className="text-lg font-black text-base-content font-montserrat">My Profile</h1>
          </div>
          <p className="text-[10px] text-base-content/40 font-poppins ml-11">
            Manage your professional identity on Likeson Healthcare
          </p>
        </div>
      </div>

      <div className="w-full mx-auto md:px-4 px-2 py-6">
        {/* Mobile tab bar */}
        <div className="lg:hidden mb-4">
          <MobileTabs activeId={activeId} />
        </div>

        <div className="flex gap-2 md:gap-4 items-start">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0 sticky top-6">
            <div className="card p-3">
              <div className="px-2 py-2 mb-2">
                <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest font-montserrat">Sections</p>
              </div>
              <SidebarNav activeId={activeId} />
            </div>

            {/* Quick info panel */}
            <div className="mt-4 card p-4 space-y-3">
              <p className="text-[10px] font-bold text-base-content/30 uppercase tracking-widest font-montserrat mb-2">Quick Info</p>
              <div className="flex items-center gap-2">
                <span className={`status-dot ${profile?.isOnline ? "status-dot-success" : "bg-base-300"}`} />
                <span className="text-[10px] font-poppins text-base-content/60">{profile?.isOnline ? "Online" : "Offline"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Star size={12} className="text-warning" />
                <span className="text-[10px] font-poppins text-base-content/60">
                  {profile?.rating?.averageRating?.toFixed(1) ?? "0.0"} ({profile?.rating?.totalRatings ?? 0} ratings)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Shield size={12} className="text-primary" />
                <span className={`text-[10px] font-poppins ${profile?.isVerified ? "text-success" : "text-base-content/40"}`}>
                  {profile?.isVerified ? "Verified" : "Unverified"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BookOpen size={12} className="text-primary" />
                <span className="text-[10px] font-poppins text-base-content/60">
                  Step {profile?.onboarding?.step ?? 1} of onboarding
                </span>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div key={activeId}>
                {activeId === "overview"       && <OverviewSection       {...sectionProps} />}
                {activeId === "professional"   && <ProfessionalSection   {...sectionProps} />}
                {activeId === "qualifications" && <QualificationsSection {...sectionProps} />}
                {activeId === "bio"            && <BioSection            {...sectionProps} />}
                {activeId === "fees"           && <FeesSection           {...sectionProps} />}
                {activeId === "photo"          && <PhotoSection          {...sectionProps} />}
                {activeId === "signature"      && <SignatureSection      {...sectionProps} />}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}