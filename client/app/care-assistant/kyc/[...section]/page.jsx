"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ScanLine,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Upload,
  Eye,
  EyeOff,
  Loader2,
  X,
  CreditCard,
  Fingerprint,
  Camera,
  FileImage,
  Shield,
  ChevronRight,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  getKycStatus,
  submitKyc,
  uploadDocument,
  selectProfile,
  selectKycStatus,
  selectLoading,
  selectErrors,
  getProfile,
} from "@/store/slices/careAssistantSlice";
import BackButton from "../../../../components/BackButton";

// ─── nav links ─────────────────────────────────────────────────────────────
const links = [
  {
    name: "Verification Status",
    href: "/care-assistant/kyc/status",
    segments: ["status"],
    icon: <ShieldCheck size={17} />,
    note: "Real-time KYC & police verification status",
  },
  {
    name: "Submit KYC",
    href: "/care-assistant/kyc/submit",
    segments: ["submit"],
    icon: <ScanLine size={17} />,
    note: "Enter Aadhaar & PAN details for review",
  },
  {
    name: "Upload Documents",
    href: "/care-assistant/kyc/document",
    segments: ["document"],
    icon: <FileText size={17} />,
    note: "Upload Aadhaar, PAN & other supporting docs",
  },
];

const matchSection = (params) => {
  const seg = params?.section ?? [];
  if (!seg || seg.length === 0) return "status";
  if (seg[0] === "status") return "status";
  if (seg[0] === "submit") return "submit";
  if (seg[0] === "document") return "document";
  return "status";
};

// ─── status badge helper ──────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Verified:      { cls: "badge-success", icon: <CheckCircle2 size={12} />, label: "Verified" },
    "Under-Review":{ cls: "badge-warning", icon: <Clock size={12} />,        label: "Under Review" },
    Pending:       { cls: "badge-info",    icon: <Clock size={12} />,        label: "Pending" },
    Rejected:      { cls: "badge-error",   icon: <XCircle size={12} />,      label: "Rejected" },
    Completed:     { cls: "badge-success", icon: <CheckCircle2 size={12} />, label: "Completed" },
  };
  const s = map[status] ?? map["Pending"];
  return (
    <span className={`badge ${s.cls} flex items-center gap-1`}>
      {s.icon} {s.label}
    </span>
  );
};

// ─── STATUS SECTION ───────────────────────────────────────────────────────
function StatusSection({ kycStatus, dispatch, loading }) {
  useEffect(() => {
    dispatch(getKycStatus());
  }, [dispatch]);

  const kyc          = kycStatus?.kyc          ?? {};
  const verification = kycStatus?.verification ?? {};
  const completion   = kycStatus?.profileCompletionPercent ?? 0;

  const items = [
    {
      label:  "KYC Verification",
      note:   "Aadhaar & PAN document review by admin",
      status: kyc.verificationStatus ?? "Pending",
      icon:   <Fingerprint size={20} />,
      color:  "var(--primary)",
      details:
        kyc.rejectionReason
          ? `Reason: ${kyc.rejectionReason}`
          : kyc.verifiedAt
          ? `Verified on ${new Date(kyc.verifiedAt).toLocaleDateString("en-IN")}`
          : kyc.submittedAt
          ? `Submitted on ${new Date(kyc.submittedAt).toLocaleDateString("en-IN")}`
          : "Not yet submitted",
    },
    {
      label:  "Aadhaar Document",
      note:   "Front & back images of your Aadhaar card",
      status: kyc.aadhaarVerified ? "Verified" : kyc.aadhaarFrontUrl ? "Under-Review" : "Pending",
      icon:   <CreditCard size={20} />,
      color:  "var(--secondary)",
      details: kyc.aadhaarLast4 ? `Ending in ****${kyc.aadhaarLast4}` : "Not uploaded",
    },
    {
      label:  "PAN Card",
      note:   "Clear photo of your PAN card",
      status: kyc.panVerified ? "Verified" : kyc.panCardUrl ? "Under-Review" : "Pending",
      icon:   <CreditCard size={20} />,
      color:  "var(--accent)",
      details: kyc.panCardUrl ? "Document uploaded" : "Not uploaded",
    },
    {
      label:  "Police / Background Check",
      note:   "Police verification clearance certificate",
      status: verification.policeVerificationStatus ?? "Pending",
      icon:   <Shield size={20} />,
      color:  "var(--success)",
      details: verification.backgroundCheckDate
        ? `Checked on ${new Date(verification.backgroundCheckDate).toLocaleDateString("en-IN")}`
        : "Awaiting submission",
    },
  ];

  if (loading.kyc && !kycStatus) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* completion ring */}
      <div className="glass-card p-4 flex items-center gap-4">
        <div className="relative w-16 h-16 shrink-0">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="var(--base-300)" strokeWidth="5" />
            <motion.circle
              cx="28" cy="28" r="22"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 22}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 22 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 22 * (1 - completion / 100) }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-black text-primary">{completion}%</span>
          </div>
        </div>
        <div>
          <p className="font-semibold text-sm text-base-content">Profile Completion</p>
          <p className="text-xs mt-0.5 text-base-content opacity-55">
            Complete KYC to unlock bookings
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <button
              onClick={() => dispatch(getKycStatus())}
              className="flex items-center gap-1 text-xs font-semibold text-primary"
             
            >
              <RefreshCw size={11} /> Refresh
            </button>
          </div>
        </div>
      </div>

      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.07 }}
          className="card p-4 flex gap-3 items-start"
        >
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background: `color-mix(in srgb, ${item.color}, transparent 82%)`,
              color: item.color,
            }}
          >
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-semibold text-base-content">
                {item.label}
              </p>
              <StatusBadge status={item.status} />
            </div>
            <p className="text-[11px] mt-0.5 text-base-content opacity-50">
              {item.note}
            </p>
            <p className="text-xs mt-1.5 font-medium text-base-content opacity-65">
              {item.details}
            </p>
          </div>
        </motion.div>
      ))}

      {/* action hint */}
      {(kyc.verificationStatus === "Rejected" || kyc.verificationStatus === "Pending") && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="alert alert-warning">
          <AlertCircle size={16} />
          <div>
            <p className="text-xs font-semibold">Action needed</p>
            <p className="text-xs mt-0.5 opacity-80">
              {kyc.verificationStatus === "Rejected"
                ? "Your KYC was rejected. Please re-upload correct documents and resubmit."
                : "Submit your Aadhaar & PAN to start the verification process."}
            </p>
            <Link
              href="/care-assistant/kyc/submit"
              className="text-xs font-bold mt-1.5 inline-flex items-center gap-1 text-warning"
             
            >
              Go to Submit <ChevronRight size={12} />
            </Link>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── SUBMIT KYC SECTION ──────────────────────────────────────────────────
function SubmitKycSection({ kycStatus, dispatch, loading }) {
  const kyc = kycStatus?.kyc ?? {};
  const [form, setForm]         = useState({ aadhaarNumber: "", panNumber: "" });
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [errors, setErrors]     = useState({});

  useEffect(() => { dispatch(getKycStatus()); }, [dispatch]);

  const isVerified    = kyc.verificationStatus === "Verified";
  const isUnderReview = kyc.verificationStatus === "Under-Review";

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: "" }));
  };

  const validate = () => {
    const e = {};
    if (form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber.replace(/\s/g, "")))
      e.aadhaarNumber = "Must be exactly 12 digits";
    if (form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber.toUpperCase()))
      e.panNumber = "Format: ABCDE1234F (5 letters, 4 digits, 1 letter)";
    if (!form.aadhaarNumber.trim() && !form.panNumber.trim())
      e.aadhaarNumber = "Enter at least Aadhaar or PAN number";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const payload = {};
    if (form.aadhaarNumber) payload.aadhaarNumber = form.aadhaarNumber.replace(/\s/g, "");
    if (form.panNumber)     payload.panNumber = form.panNumber.toUpperCase();
    dispatch(submitKyc(payload));
  };

  const handleAadhaarChange = (v) => {
    const digits    = v.replace(/\D/g, "").slice(0, 12);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    set("aadhaarNumber", formatted);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {isVerified && (
        <div className="alert alert-success">
          <CheckCircle2 size={16} />
          <p className="text-sm font-semibold">KYC already verified — no changes needed.</p>
        </div>
      )}

      {isUnderReview && (
        <div className="alert alert-warning">
          <Clock size={16} />
          <div>
            <p className="text-xs font-semibold">Under Review</p>
            <p className="text-xs mt-0.5 opacity-80">
              Your documents are being reviewed. This usually takes 1–2 business days.
            </p>
          </div>
        </div>
      )}

      {/* info card */}
      <div className="glass-card p-4">
        <div className="flex items-start gap-2">
          <Info size={14} className="mt-0.5 shrink-0 text-info" />
          <p className="text-xs text-base-content opacity-70">
            Your Aadhaar and PAN numbers are encrypted and stored securely. They are never shared
            with third parties. Only the last 4 digits of Aadhaar are shown on your profile.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Aadhaar */}
        <div className="space-y-1.5">
          <label
            className="text-xs font-semibold flex items-center gap-1.5 text-base-content"
           
          >
            <Fingerprint size={13} className="text-primary" />
            Aadhaar Number
          </label>
          <p className="text-[11px] text-base-content opacity-50">
            12-digit UIDAI number printed on your Aadhaar card
          </p>
          <div className="relative">
            <input
              type={showAadhaar ? "text" : "password"}
              value={form.aadhaarNumber}
              onChange={(e) => handleAadhaarChange(e.target.value)}
              placeholder="XXXX XXXX XXXX"
              disabled={isVerified}
              className={`input-field w-full pr-10 tracking-widest ${
                errors.aadhaarNumber ? "!border-[var(--error)]" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowAadhaar((p) => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content opacity-40"
             
            >
              {showAadhaar ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.aadhaarNumber && (
            <p className="text-[11px] flex items-center gap-1 text-error">
              <X size={11} /> {errors.aadhaarNumber}
            </p>
          )}
          {kyc.aadhaarLast4 && (
            <p className="text-[11px] text-success">
              ✓ Previously saved — ending in ****{kyc.aadhaarLast4}
            </p>
          )}
        </div>

        {/* PAN */}
        <div className="space-y-1.5">
          <label
            className="text-xs font-semibold flex items-center gap-1.5 text-base-content"
           
          >
            <CreditCard size={13} className="text-primary" />
            PAN Number
          </label>
          <p className="text-[11px] text-base-content opacity-50">
            10-character alphanumeric ID (format: ABCDE1234F). Required for payouts above ₹50,000/year.
          </p>
          <input
            type="text"
            value={form.panNumber}
            onChange={(e) => set("panNumber", e.target.value.toUpperCase())}
            placeholder="ABCDE1234F"
            maxLength={10}
            disabled={isVerified}
            className={`input-field w-full uppercase tracking-widest ${
              errors.panNumber ? "!border-[var(--error)]" : ""
            }`}
          />
          {errors.panNumber && (
            <p className="text-[11px] flex items-center gap-1 text-error">
              <X size={11} /> {errors.panNumber}
            </p>
          )}
          {kyc.panVerified && (
            <p className="text-[11px] text-success">✓ PAN already verified</p>
          )}
        </div>

        {!isVerified && (
          <button
            type="submit"
            disabled={loading.kyc || isUnderReview}
            className="btn-primary-cta w-full flex items-center justify-center gap-2"
          >
            {loading.kyc ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ScanLine size={16} />
            )}
            {loading.kyc ? "Submitting…" : isUnderReview ? "Under Review" : "Submit for Verification"}
          </button>
        )}
      </form>

      <div
        className="rounded-2xl p-4 bg-[color-mix(in srgb, var(--base-200), transparent 30%)]"
       
      >
        <p className="text-xs font-semibold mb-2 text-base-content">
          What happens next?
        </p>
        {[
          "Admin reviews your Aadhaar & PAN details",
          "You receive an email when verified or if action is needed",
          "Once approved, go online and start accepting bookings",
        ].map((s, i) => (
          <div key={i} className="flex items-start gap-2 mb-1.5">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 bg-primary text-primary-content"
             
            >
              {i + 1}
            </span>
            <p className="text-xs text-base-content opacity-65">{s}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── UPLOAD DOCUMENTS SECTION ────────────────────────────────────────────
function UploadDocumentsSection({ kycStatus, dispatch, loading }) {
  const fileInputRef = useRef(null);
  const [selectedDocType, setSelectedDocType] = useState("aadhaar_front");
  const [dragOver, setDragOver]               = useState(false);
  const [preview, setPreview]                 = useState(null);
  const [selectedFile, setSelectedFile]       = useState(null);

  const docTypes = [
    {
      value:    "aadhaar_front",
      label:    "Aadhaar Front",
      note:     "Front side of your Aadhaar card showing name, DOB & address",
      icon:     <CreditCard size={16} />,
      existing: kycStatus?.kyc?.aadhaarFrontUrl,
    },
    {
      value:    "aadhaar_back",
      label:    "Aadhaar Back",
      note:     "Back side showing Aadhaar number barcode",
      icon:     <CreditCard size={16} />,
      existing: kycStatus?.kyc?.aadhaarBackUrl,
    },
    {
      value:    "pan_card",
      label:    "PAN Card",
      note:     "Full, uncropped photo of your PAN card",
      icon:     <CreditCard size={16} />,
      existing: kycStatus?.kyc?.panCardUrl,
    },
    {
      value:    "police_verification",
      label:    "Police Clearance",
      note:     "Police verification certificate issued by local authority",
      icon:     <Shield size={16} />,
      existing: kycStatus?.verification?.backgroundCheckUrl,
    },
    {
      value:    "certificate",
      label:    "Training Certificate",
      note:     "Any training or skill certificate (add to certificates section for tracking)",
      icon:     <FileImage size={16} />,
      existing: null,
    },
  ];

  const handleFile = (file) => {
    if (!file) return;
    setSelectedFile(file);
    const reader  = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const res = await dispatch(
      uploadDocument({ file: selectedFile, docType: selectedDocType })
    );
    if (!res.error) {
      setSelectedFile(null);
      setPreview(null);
      dispatch(getKycStatus());
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" />
          <p className="text-xs text-base-content opacity-70">
            Upload clear, well-lit images (JPEG/PNG/WEBP) or PDF. Max size 5 MB. Blurry or cropped
            documents will be rejected.
          </p>
        </div>
      </div>

      {/* doc type selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-base-content">
          Document Type
        </label>
        <p className="text-[11px] text-base-content opacity-50">
          Select the document you are uploading
        </p>
        <div className="grid grid-cols-1 gap-2">
          {docTypes.map((d) => (
            <button
              key={d.value}
              onClick={() => {
                setSelectedDocType(d.value);
                setSelectedFile(null);
                setPreview(null);
              }}
              className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all"
              style={{
                background:
                  selectedDocType === d.value
                    ? "color-mix(in srgb, var(--primary), transparent 88%)"
                    : "var(--base-200)",
                border: `1px solid ${
                  selectedDocType === d.value ? "var(--primary)" : "transparent"
                }`,
              }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-base-300 text-primary"
               
              >
                {d.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold flex items-center gap-1.5 text-base-content"
                 
                >
                  {d.label}
                  {d.existing && (
                    <span className="badge badge-success !py-0 !px-1.5 !text-[10px]">Uploaded</span>
                  )}
                </p>
                <p
                  className="text-[11px] mt-0.5 truncate text-base-content opacity-50"
                 
                >
                  {d.note}
                </p>
              </div>
              {selectedDocType === d.value && (
                <CheckCircle2 size={16} className="text-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* drop zone */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-base-content">
          Upload File
        </label>
        <p className="text-[11px] text-base-content opacity-50">
          Drag & drop or tap to choose — JPEG, PNG, WEBP or PDF, max 5 MB
        </p>

        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="rounded-2xl border-2 border-dashed p-6 flex flex-col items-center gap-3 cursor-pointer transition-all"
          style={{
            borderColor: dragOver ? "var(--primary)" : "var(--base-300)",
            background:  dragOver
              ? "color-mix(in srgb, var(--primary), transparent 93%)"
              : "var(--base-200)",
          }}
        >
          {preview ? (
            <div className="relative w-full">
              {preview.startsWith("data:image") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="preview"
                  className="w-full max-h-40 object-contain rounded-xl"
                />
              ) : (
                <div
                  className="flex flex-col items-center gap-2 py-4 text-primary"
                 
                >
                  <FileText size={28} />
                  <p className="text-xs font-semibold">{selectedFile?.name}</p>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPreview(null);
                  setSelectedFile(null);
                }}
                className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center bg-error text-error-content"
               
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[color-mix(in srgb, var(--primary), transparent 85%)]"
               
              >
                <Upload size={22} className="text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-base-content">
                  Tap to upload
                </p>
                <p className="text-xs mt-0.5 text-base-content opacity-45">
                  or drag & drop here
                </p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>

      {selectedFile && (
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleUpload}
          disabled={loading.uploadDocument}
          className="btn-primary-cta w-full flex items-center justify-center gap-2"
        >
          {loading.uploadDocument ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          {loading.uploadDocument
            ? "Uploading…"
            : `Upload ${docTypes.find((d) => d.value === selectedDocType)?.label}`}
        </motion.button>
      )}
    </motion.div>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────
export default function KycPage() {
  const params   = useParams();
  const dispatch = useDispatch();
  const profile    = useSelector(selectProfile);
  const kycStatus  = useSelector(selectKycStatus);
  const loading    = useSelector(selectLoading);
  const errors     = useSelector(selectErrors);

  const section = matchSection(params);

  useEffect(() => {
    if (!profile) dispatch(getProfile());
  }, [dispatch, profile]);

  const sectionTitle = {
    status:   "Verification Status",
    submit:   "Submit KYC Documents",
    document: "Upload Documents",
  }[section];

  const sectionSubtitle = {
    status:   "Live status of your KYC & background verification",
    submit:   "Enter your Aadhaar & PAN for identity verification",
    document: "Upload supporting documents for admin review",
  }[section];

  const kycVerificationStatus = kycStatus?.kyc?.verificationStatus ?? "Pending";
  const statusColors = {
    Verified:      "var(--success)",
    "Under-Review":"var(--warning)",
    Pending:       "var(--info)",
    Rejected:      "var(--error)",
  };
  const headerAccent = statusColors[kycVerificationStatus] ?? "var(--primary)";

  return (
    // ← Care-assistant theme applied at the root of this page
    <div data-theme="care-assistant" className="min-h-screen bg-base-100">
 
      {/* ── header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-5 pb-3 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[12px] border-b border-base-300"
       
      >
        <BackButton className="my-3" />
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <p
            className="text-[11px] font-semibold uppercase tracking-widest mb-0.5"
            style={{ color: headerAccent }}
          >
            KYC & Identity Verification
          </p>
          <h1
            className="!text-xl !font-black !leading-tight text-base-content"
           
          >
            {sectionTitle}
          </h1>
          <p className="text-xs mt-0.5 text-base-content opacity-55">
            {sectionSubtitle}
          </p>
        </motion.div>

        {/* overall KYC status pill */}
        <div className="flex items-center gap-2 mt-3">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={{
              background: `color-mix(in srgb, ${headerAccent}, transparent 85%)`,
              color:       headerAccent,
            }}
          >
            <ShieldCheck size={12} />
            KYC: {kycVerificationStatus}
          </div>
          {profile && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ml-auto bg-base-200 text-base-content"
             
            >
              Profile {profile.profileCompletionPercent ?? 0}% complete
            </div>
          )}
        </div>
      </div>

      {/* ── nav pills ── */}
      <div className="px-4 pt-4 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
        {links.map((l) => {
          const isActive = section === l.segments[0];
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all"
              style={{
                background: isActive
                  ? headerAccent
                  : `color-mix(in srgb, ${headerAccent}, transparent 88%)`,
                color: isActive ? "white" : headerAccent,
              }}
            >
              {l.icon}
              {l.name}
            </Link>
          );
        })}
      </div>

      {/* ── active note ── */}
      <div className="px-4 mt-3">
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ background: `color-mix(in srgb, ${headerAccent}, transparent 90%)` }}
        >
          <Info size={13} style={{ color: headerAccent }} />
          <p className="text-[11px]" style={{ color: headerAccent }}>
            {links.find((l) => l.segments[0] === section)?.note}
          </p>
        </div>
      </div>

      {/* ── content ── */}
      <div className="px-4 py-5 pb-24">
        {errors.profile && (
          <div className="alert alert-error mb-4">
            <AlertCircle size={16} />
            <p className="text-sm">{errors.profile}</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {section === "status" && (
            <StatusSection
              key="status"
              kycStatus={kycStatus}
              dispatch={dispatch}
              loading={loading}
            />
          )}
          {section === "submit" && (
            <SubmitKycSection
              key="submit"
              kycStatus={kycStatus}
              dispatch={dispatch}
              loading={loading}
            />
          )}
          {section === "document" && (
            <UploadDocumentsSection
              key="document"
              kycStatus={kycStatus}
              dispatch={dispatch}
              loading={loading}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}