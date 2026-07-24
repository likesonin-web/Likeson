"use client";

/**
 * Training & Certificates Page — corrected with [data-theme="care-assistant"]
 * Route: app/care-assistant/training/[[...section]]/page.jsx
 */

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, FileText, BookOpen, Plus, Trash2, CheckCircle2, Clock,
  Upload, Award, HeartPulse, Users, Stethoscope, Pill, Scissors,
  ChevronRight, AlertCircle, CalendarDays, Building2, ExternalLink,
  Loader2, Save, X,
} from "lucide-react";
import {
  getProfile, updateTraining, addCertificate, deleteCertificate,
  selectProfile, selectLoading, selectErrors,
} from "@/store/slices/careAssistantSlice";
import BackButton from "../../../components/BackButton";

const links = [
  { name:"Training Competencies", href:"/care-assistant/training",                    segments:[],                    icon:<BookOpen size={17}/>, note:"Toggle your core skill flags" },
  { name:"My Certifications",     href:"/care-assistant/training/certificates",        segments:["certificates"],      icon:<Star size={17}/>,    note:"View all uploaded certificates" },
  { name:"Add Certificate",       href:"/care-assistant/training/certificates/add",   segments:["certificates","add"],icon:<FileText size={17}/>, note:"Upload a new certificate" },
];

const COMPETENCIES = [
  { key:"isFirstAidCertified",    label:"First Aid Certified",    note:"CPR & basic emergency response training",         icon:<HeartPulse size={18}/>, color:"var(--error)" },
  { key:"patientEtiquetteTrained",label:"Patient Etiquette",      note:"Communication, dignity & bedside manner",         icon:<Users size={18}/>,      color:"var(--info)" },
  { key:"mobilitySupportTrained", label:"Mobility Support",       note:"Transfer, positioning & walking assistance",      icon:<Stethoscope size={18}/>, color:"var(--secondary)" },
  { key:"medicationManagement",   label:"Medication Management",  note:"Dispensing, scheduling & record keeping",         icon:<Pill size={18}/>,       color:"var(--accent)" },
  { key:"woundCare",              label:"Wound Care",             note:"Dressing, monitoring & infection prevention",     icon:<Scissors size={18}/>,   color:"var(--success)" },
];

const matchSection = (params) => {
  const seg = params?.section ?? [];
  if (seg.length === 0)                              return "competencies";
  if (seg[0] === "certificates" && seg[1] === "add") return "add";
  if (seg[0] === "certificates")                     return "certificates";
  return "competencies";
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";

// ─── COMPETENCIES ─────────────────────────────────────────────────────────
function CompetenciesSection({ profile, dispatch, loading }) {
  const training = profile?.training ?? {};
  const [local, setLocal] = useState({});
  const [saved, setSaved] = useState(false);

  const toggle = (key) => setLocal((p) => ({ ...p, [key]: !(p[key] ?? training[key] ?? false) }));

  const handleSave = async () => {
    await dispatch(updateTraining(local));
    setLocal({});
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const hasChanges = Object.keys(local).length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-4">
      <div className="glass-card p-4 mb-2">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-xs text-base-content opacity-70">
            These flags appear on your public profile and are used for booking matching. Only toggle
            what you are genuinely trained for.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        {COMPETENCIES.map((c, i) => {
          const val = local[c.key] ?? training[c.key] ?? false;
          return (
            <motion.div
              key={c.key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-4 flex items-center gap-4 cursor-pointer select-none"
              style={{ borderColor: val ? c.color : undefined }}
              onClick={() => toggle(c.key)}
            >
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${c.color}, transparent 82%)`, color: c.color }}
              >
                {c.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-base-content">{c.label}</p>
                <p className="text-xs mt-0.5 text-base-content opacity-55">{c.note}</p>
              </div>
              <div
                className="w-12 h-6 rounded-full relative transition-all duration-300 shrink-0"
                style={{ background: val ? c.color : "var(--base-300)" }}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  animate={{ left: val ? "calc(100% - 20px)" : "4px" }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="sticky bottom-4"
          >
            <button
              onClick={handleSave}
              disabled={loading.training}
              className="btn-primary-cta w-full flex items-center justify-center gap-2"
            >
              {loading.training ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
              {loading.training ? "Saving…" : saved ? "Saved!" : "Save Changes"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── CERTIFICATES LIST ────────────────────────────────────────────────────
function CertificatesSection({ profile, dispatch, loading }) {
  const certs = profile?.training?.certificates ?? [];

  const handleDelete = (id) => {
    if (confirm("Remove this certificate?")) dispatch(deleteCertificate(id));
  };

  if (certs.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-16 gap-4"
      >
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-base-200">
          <Award size={28} className="text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-sm text-base-content">No certificates yet</p>
          <p className="text-xs mt-1 text-base-content opacity-55">
            Add your first training certificate to boost your profile score
          </p>
        </div>
        <Link href="/care-assistant/training/certificates/add" className="btn-primary-cta text-sm !py-2.5">
          + Add Certificate
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-base-content opacity-50">
          {certs.length} certificate{certs.length !== 1 ? "s" : ""}
        </p>
        <Link
          href="/care-assistant/training/certificates/add"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-[color-mix(in srgb, var(--primary), transparent 88%)] text-primary"
         
        >
          <Plus size={13} /> Add New
        </Link>
      </div>

      {certs.map((c, i) => (
        <motion.div
          key={c._id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06 }}
          className="card p-4 flex gap-3"
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-[color-mix(in srgb, var(--accent), transparent 85%)] text-accent"
           
          >
            <Award size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold truncate text-base-content">{c.name}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                {c.isVerified
                  ? <span className="badge badge-success !py-0.5 !px-2 !text-[10px]">Verified</span>
                  : <span className="badge badge-warning !py-0.5 !px-2 !text-[10px]">Pending</span>}
              </div>
            </div>

            {c.issuedBy && (
              <div className="flex items-center gap-1 mt-1">
                <Building2 size={11} className="text-base-content opacity-45" />
                <p className="text-xs text-base-content opacity-55">{c.issuedBy}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {c.issuedAt && (
                <div className="flex items-center gap-1">
                  <CalendarDays size={11} className="text-base-content opacity-40" />
                  <span className="text-xs text-base-content opacity-50">
                    Issued: {formatDate(c.issuedAt)}
                  </span>
                </div>
              )}
              {c.expiresAt && (
                <div className="flex items-center gap-1">
                  <Clock size={11} className="text-warning" />
                  <span className="text-xs text-warning">
                    Expires: {formatDate(c.expiresAt)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              {c.documentUrl && (
                <a
                  href={c.documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-primary"
                 
                >
                  <ExternalLink size={12} /> View Doc
                </a>
              )}
              <button
                onClick={() => handleDelete(c._id)}
                disabled={loading.training}
                className="flex items-center gap-1 text-xs font-semibold ml-auto text-error"
               
              >
                {loading.training ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Remove
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─── ADD CERTIFICATE ──────────────────────────────────────────────────────
function AddCertificateSection({ dispatch, loading }) {
  const router = useRouter();
  const [form, setForm] = useState({ name:"", issuedBy:"", issuedAt:"", expiresAt:"", documentUrl:"" });
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); if (errors[k]) setErrors((p) => ({ ...p, [k]:"" })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Certificate name is required";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {
      name: form.name.trim(),
      ...(form.issuedBy    && { issuedBy:    form.issuedBy }),
      ...(form.issuedAt    && { issuedAt:    form.issuedAt }),
      ...(form.expiresAt   && { expiresAt:   form.expiresAt }),
      ...(form.documentUrl && { documentUrl: form.documentUrl }),
    };
    const res = await dispatch(addCertificate(payload));
    if (!res.error) router.push("/care-assistant/training/certificates");
  };

  const fields = [
    { key:"name",        label:"Certificate Name", required:true, type:"text", placeholder:"e.g. Basic Life Support",        note:"Official name as printed on the certificate" },
    { key:"issuedBy",    label:"Issued By",                       type:"text", placeholder:"e.g. Indian Red Cross Society",   note:"Organisation that issued this certificate" },
    { key:"issuedAt",    label:"Issue Date",                      type:"date",                                                note:"Date the certificate was awarded" },
    { key:"expiresAt",   label:"Expiry Date",                     type:"date",                                                note:"Leave blank if this certificate does not expire" },
    { key:"documentUrl", label:"Document URL",                    type:"url",  placeholder:"https://…",                      note:"Direct link to the certificate image or PDF (optional)" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <div className="glass-card p-4 mb-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-info" />
          <p className="text-xs text-base-content opacity-70">
            Certificate details will be reviewed and verified by the admin team. Ensure names match
            official documents.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-semibold flex items-center gap-1 text-base-content">
              {f.label}
              {f.required && <span className="text-error">*</span>}
            </label>
            <p className="text-[11px] text-base-content opacity-50">{f.note}</p>
            <input
              type={f.type}
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={`input-field w-full ${errors[f.key] ? "!border-[var(--error)]" : ""}`}
            />
            {errors[f.key] && (
              <p className="text-[11px] flex items-center gap-1 text-error">
                <X size={11} /> {errors[f.key]}
              </p>
            )}
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading.training}
            className="btn-primary-cta flex-1 flex items-center justify-center gap-2"
          >
            {loading.training ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {loading.training ? "Saving…" : "Add Certificate"}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────
export default function TrainingPage() {
  const params   = useParams();
  const dispatch = useDispatch();
  const profile  = useSelector(selectProfile);
  const loading  = useSelector(selectLoading);
  const errors   = useSelector(selectErrors);

  const section = matchSection(params);

  useEffect(() => {
    if (!profile) dispatch(getProfile());
  }, [dispatch, profile]);

  const sectionTitle = {
    competencies: "Training Competencies",
    certificates: "My Certifications",
    add:          "Add Certificate",
  }[section];

  const sectionSubtitle = {
    competencies: "Toggle your verified skill flags used for booking matches",
    certificates: "All your training certificates in one place",
    add:          "Add a new professional training certificate",
  }[section];

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100">

      {/* ── header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-5 pb-3 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[12px] border-b border-base-300"
       
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                     <BackButton className='my-3' />
          
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-0.5 text-primary">
            Training & Certifications
          </p>
          <h1 className="!text-xl !font-black !leading-tight text-base-content">
            {sectionTitle}
          </h1>
          <p className="text-xs mt-0.5 text-base-content opacity-55">
            {sectionSubtitle}
          </p>
        </motion.div>

        {/* profile completion bar */}
        {profile && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-base-300">
              <motion.div
                className="h-full rounded-full bg-primary"
               
                initial={{ width: 0 }}
                animate={{ width: `${profile.profileCompletionPercent ?? 0}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="text-[11px] font-bold shrink-0 text-primary">
              {profile.profileCompletionPercent ?? 0}% complete
            </span>
          </div>
        )}
      </div>

      {/* ── nav pills ── */}
      <div className="px-4 pt-4 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
        {links.map((l) => {
          const isActive =
            (section === "competencies" && l.segments.length === 0) ||
            (section === "certificates" && l.segments.join("/") === "certificates") ||
            (section === "add"          && l.segments.join("/") === "certificates/add");
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all"
              style={{
                background: isActive ? "var(--primary)" : "color-mix(in srgb, var(--primary), transparent 90%)",
                color:      isActive ? "var(--primary-content)" : "var(--primary)",
              }}
            >
              {l.icon}{l.name}
            </Link>
          );
        })}
      </div>

      {/* ── active note ── */}
      <div className="px-4 mt-3">
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[color-mix(in srgb, var(--info), transparent 90%)]"
         
        >
          <AlertCircle size={13} className="text-info" />
          <p className="text-[11px] text-info">
            {links.find((l) =>
              (section === "competencies" && l.segments.length === 0) ||
              (section === "certificates" && l.segments.join("/") === "certificates") ||
              (section === "add"          && l.segments.join("/") === "certificates/add")
            )?.note}
          </p>
        </div>
      </div>

      {/* ── content ── */}
      <div className="px-4 py-5 pb-24">
        {loading.profile && !profile ? (
          <div className="flex flex-col gap-3">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-16 w-full rounded-2xl" />)}
          </div>
        ) : errors.profile ? (
          <div className="alert alert-error">
            <AlertCircle size={16} />
            <p className="text-sm">{errors.profile}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {section === "competencies" && (
              <CompetenciesSection key="competencies" profile={profile} dispatch={dispatch} loading={loading} />
            )}
            {section === "certificates" && (
              <CertificatesSection key="certificates" profile={profile} dispatch={dispatch} loading={loading} />
            )}
            {section === "add" && (
              <AddCertificateSection key="add" dispatch={dispatch} loading={loading} />
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}