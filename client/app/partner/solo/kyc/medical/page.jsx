'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, FileCheck2, HeartPulse, ShieldCheck,
  Upload, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronRight, Eye, Trash2, FileText, Camera, RefreshCw,
  BadgeCheck, Shield, Stethoscope, Car, Loader2, X,
  ArrowRight, ArrowLeft, CalendarDays, Hash, BookOpen, Award,
  Info, AlertCircle, HelpCircle,
} from 'lucide-react';

import {
  fetchKycStatus,
  submitKyc,
  submitMedicalFitness,
  submitPsvBadge,
  selectKyc,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';

import {
  uploadSingleFile,
} from '@/store/slices/uploadSlice';

import Container from '@/components/ui/Container';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'status',  label: 'KYC Status',       icon: ScanLine    },
  { id: 'submit',  label: 'Submit Documents',  icon: FileCheck2  },
  { id: 'medical', label: 'Medical Fitness',   icon: HeartPulse  },
  { id: 'psv',     label: 'PSV Badge',         icon: ShieldCheck },
];

const STATUS_CONFIG = {
  'not-submitted': {
    label:  'Not Submitted',
    color:  'text-base-content/50',
    bg:     'bg-base-300/40',
    icon:   Clock,
    border: 'border-base-300',
  },
  pending: {
    label:  'Pending',
    color:  'text-warning',
    bg:     'bg-warning/10',
    icon:   Clock,
    border: 'border-warning/40',
  },
  'under-review': {
    label:  'Under Review',
    color:  'text-info',
    bg:     'bg-info/10',
    icon:   RefreshCw,
    border: 'border-info/40',
  },
  verified: {
    label:  'Verified',
    color:  'text-success',
    bg:     'bg-success/10',
    icon:   CheckCircle2,
    border: 'border-success/40',
  },
  rejected: {
    label:  'Rejected',
    color:  'text-error',
    bg:     'bg-error/10',
    icon:   XCircle,
    border: 'border-error/40',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// InputNote — small helper text below inputs
// ─────────────────────────────────────────────────────────────────────────────

function InputNote({ children, variant = 'info' }) {
  const styles = {
    info:    { icon: Info,          cls: 'text-info/70'    },
    warning: { icon: AlertTriangle, cls: 'text-warning/80' },
    tip:     { icon: HelpCircle,    cls: 'text-primary/60' },
  };
  const { icon: Icon, cls } = styles[variant] || styles.info;

  return (
    <p className={`flex items-start gap-1.5 text-xs leading-relaxed mt-1.5 ${cls}`}>
      <Icon size={11} className="mt-0.5 shrink-0" />
      <span className="text-base-content/50">{children}</span>
    </p>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FileUploader
// ─────────────────────────────────────────────────────────────────────────────

function FileUploader({ label, value, onChange, folder, accept = 'image/*,.pdf', hint, note }) {
  const dispatch    = useDispatch();
  const isUploading = useSelector((s) => s.upload?.isUploading ?? false);
  const inputRef    = useRef(null);
  const [preview,  setPreview]  = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
      const result = await dispatch(uploadSingleFile({ file, folder }));
      if (uploadSingleFile.fulfilled.match(result)) {
        onChange(result.payload.url);
      }
    },
    [dispatch, folder, onChange]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const isImage = value && (value.match(/\.(jpg|jpeg|png|webp|gif)$/i) || preview);
  const isPdf   = value && value.match(/\.pdf$/i);

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-base-content/80">{label}</label>
      <div
        onClick={() => !value && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden
          ${dragOver
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : value
              ? 'border-success/50 bg-success/5'
              : 'border-base-300 hover:border-primary/50 hover:bg-primary/5'
          }`}
        style={{ minHeight: 120 }}
      >
        {isUploading ? (
          <div className="flex flex-col items-center justify-center p-8 gap-3">
            <Loader2 className="animate-spin text-primary" size={28} />
            <span className="text-sm text-base-content/60 font-medium">Uploading…</span>
          </div>
        ) : value ? (
          <div className="relative group">
            {isImage || preview ? (
              <img src={preview || value} alt="Preview" className="w-full h-36 object-cover" />
            ) : isPdf ? (
              <div className="flex items-center gap-3 p-4">
                <FileText size={32} className="text-error/70" />
                <div>
                  <p className="text-sm font-semibold text-base-content">PDF Document</p>
                  <p className="text-xs text-base-content/50 truncate max-w-[180px]">
                    {value.split('/').pop()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4">
                <FileText size={32} className="text-primary/70" />
                <p className="text-xs text-base-content/50 truncate max-w-[200px]">
                  {value.split('/').pop()}
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); window.open(value, '_blank'); }}
                className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                title="Preview"
              >
                <Eye size={16} className="text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(''); setPreview(null); }}
                className="p-2 rounded-full bg-error/60 hover:bg-error/80 transition-colors"
                title="Remove"
              >
                <Trash2 size={16} className="text-white" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                title="Replace"
              >
                <RefreshCw size={16} className="text-white" />
              </button>
            </div>
            <div className="absolute top-2 right-2 bg-success rounded-full p-0.5">
              <CheckCircle2 size={14} className="text-white" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 gap-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload size={18} className="text-primary" />
            </div>
            <p className="text-sm font-semibold text-base-content/70">Drop file or click to upload</p>
            {hint && <p className="text-xs text-base-content/40">{hint}</p>}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {note && <InputNote variant="tip">{note}</InputNote>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, subtitle, color = 'primary', children }) {
  const colorMap = {
    primary: { ring: 'ring-primary/20',  bg: 'bg-primary/10',  text: 'text-primary',  border: 'border-primary/20'  },
    info:    { ring: 'ring-info/20',     bg: 'bg-info/10',     text: 'text-info',     border: 'border-info/20'     },
    accent:  { ring: 'ring-accent/20',   bg: 'bg-accent/10',   text: 'text-accent',   border: 'border-accent/20'   },
    success: { ring: 'ring-success/20',  bg: 'bg-success/10',  text: 'text-success',  border: 'border-success/20'  },
    warning: { ring: 'ring-warning/20',  bg: 'bg-warning/10',  text: 'text-warning',  border: 'border-warning/20'  },
  };
  const c = colorMap[color] || colorMap.primary;

  return (
    <div className={`rounded-2xl border ${c.border} ${c.ring} ring-1 p-6 space-y-5`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
          <Icon size={20} className={c.text} />
        </div>
        <div>
          <p className="font-bold text-base-content">{title}</p>
          <p className="text-xs text-base-content/50">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Field wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Field({ label, children, note, noteVariant = 'info' }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-base-content/70">{label}</label>
      {children}
      {note && <InputNote variant={noteVariant}>{note}</InputNote>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Submit Button
// ─────────────────────────────────────────────────────────────────────────────

function SubmitButton({ loading, label }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileTap={{ scale: 0.97 }}
      className="btn-primary-cta w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {loading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          <span>Submitting…</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight size={16} />
        </>
      )}
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: KYC STATUS
// ─────────────────────────────────────────────────────────────────────────────

function KycStatusTab({ kyc }) {
  // kyc state shape from GET /kyc: { kyc: soloKycSchema, medicalFitness, profileCompletionPercent, onboarding, partnershipStatus }
  const kycData = kyc?.kyc || {};
  const medical = kyc?.medicalFitness || {};

  const docs = [
    {
      label:  'Driving Licence',
      icon:   Car,
      status: kycData.drivingLicenceNumber
        ? (kycData.verificationStatus || 'pending')
        : 'not-submitted',
      detail: kycData.drivingLicenceNumber
        ? `${kycData.drivingLicenceNumber} · Exp: ${
            kycData.drivingLicenceExpiry
              ? new Date(kycData.drivingLicenceExpiry).toLocaleDateString('en-IN')
              : '—'
          }`
        : 'Not submitted yet',
    },
    {
      label:  'Aadhaar Card',
      icon:   ScanLine,
      status: kycData.aadhaarVerified
        ? 'verified'
        : kycData.aadhaarFrontUrl
          ? 'pending'
          : 'not-submitted',
      detail: kycData.aadhaarLast4
        ? `XXXX XXXX ${kycData.aadhaarLast4}`
        : kycData.maskedAadhaar || 'Not submitted yet',
    },
    {
      label:  'PAN Card',
      icon:   FileText,
      status: kycData.panVerified
        ? 'verified'
        : kycData.panCardUrl
          ? 'pending'
          : 'not-submitted',
      detail: kycData.panNumber || 'Not submitted yet',
    },
    {
      label:  'PSV Badge',
      icon:   ShieldCheck,
      status: kycData.psvBadgeNumber ? 'pending' : 'not-submitted',
      detail: kycData.psvBadgeNumber
        ? `${kycData.psvBadgeNumber} · Exp: ${
            kycData.psvBadgeExpiry
              ? new Date(kycData.psvBadgeExpiry).toLocaleDateString('en-IN')
              : '—'
          }`
        : 'Not submitted yet',
    },
    {
      label:  'Medical Fitness',
      icon:   HeartPulse,
      status: medical.isValid
        ? 'verified'
        : medical.certificateNumber
          ? 'pending'
          : 'not-submitted',
      detail: medical.certificateNumber
        ? `Cert: ${medical.certificateNumber} · Blood: ${medical.bloodGroup || '—'}`
        : 'Not submitted yet',
    },
  ];

  const overallStatus = kycData.verificationStatus || 'not-submitted';
  const cfg           = STATUS_CONFIG[overallStatus] || STATUS_CONFIG['not-submitted'];
  const OverallIcon   = cfg.icon;

  const completedCount = docs.filter((d) => d.status === 'verified').length;
  const progress       = Math.round((completedCount / docs.length) * 100);

  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border p-5 flex items-center gap-4 ${cfg.bg} ${cfg.border}`}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cfg.bg} border ${cfg.border} shrink-0`}>
          <OverallIcon size={22} className={cfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-0.5">
            Overall KYC Status
          </p>
          <p className={`text-lg font-black ${cfg.color}`}>{cfg.label}</p>
          {kycData.submittedAt && (
            <p className="text-xs text-base-content/40 mt-0.5">
              Submitted{' '}
              {new Date(kycData.submittedAt).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>
            {progress}%
          </p>
          <p className="text-xs text-base-content/40">
            {completedCount}/{docs.length} verified
          </p>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-base-content/50 font-semibold">
          <span>Verification Progress</span>
          <span>{completedCount} of {docs.length} complete</span>
        </div>
        <div className="h-2 rounded-full bg-base-300 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
          />
        </div>
        <InputNote variant="info">
          All 5 documents must be verified before your partner account is fully activated.
        </InputNote>
      </div>

      {/* Partnership status callout */}
      {kyc?.partnershipStatus && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 flex gap-2 items-center">
          <BadgeCheck size={15} className="text-primary shrink-0" />
          <p className="text-xs text-base-content/60">
            Partnership status: <span className="font-bold capitalize text-primary">{kyc.partnershipStatus}</span>
            {kyc.onboarding?.isComplete ? ' · Onboarding complete' : ' · Onboarding pending'}
          </p>
        </div>
      )}

      {/* Document Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {docs.map((doc, i) => {
          const sc        = STATUS_CONFIG[doc.status] || STATUS_CONFIG['not-submitted'];
          const DocIcon    = doc.icon;
          const StatusIcon = sc.icon;
          return (
            <motion.div
              key={doc.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className={`rounded-xl border p-4 flex items-start gap-3 ${sc.bg} ${sc.border} transition-all`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${sc.bg} border ${sc.border}`}>
                <DocIcon size={18} className={sc.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-base-content">{doc.label}</p>
                <p className="text-xs text-base-content/50 mt-0.5 truncate">{doc.detail}</p>
              </div>
              <StatusIcon size={16} className={`${sc.color} shrink-0 mt-0.5`} />
            </motion.div>
          );
        })}
      </div>

      {/* Rejection reason */}
      {kycData.rejectionReason && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl bg-error/10 border border-error/30 p-4 flex gap-3"
        >
          <AlertTriangle size={18} className="text-error shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-error">Rejection Reason</p>
            <p className="text-xs text-base-content/60 mt-1">{kycData.rejectionReason}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SUBMIT KYC DOCUMENTS
// POST /kyc — fields: drivingLicenceNumber, drivingLicenceExpiry, drivingLicenceDocUrl,
//             licenceClass, aadhaarNumber, aadhaarFrontUrl, aadhaarBackUrl,
//             panNumber, panCardUrl
// ─────────────────────────────────────────────────────────────────────────────

function SubmitKycTab({ kyc, onSuccess }) {
  const dispatch     = useDispatch();
  const isSubmitting = useSelector(selectLoading('submitKyc'));

  // Pre-fill from existing kyc data (route returns masked data)
  const kd = kyc?.kyc || {};

  const [form, setForm] = useState({
    aadhaarNumber:        '',
    aadhaarFrontUrl:      kd.aadhaarFrontUrl      || '',
    aadhaarBackUrl:       kd.aadhaarBackUrl        || '',
    drivingLicenceNumber: kd.drivingLicenceNumber  || '',
    drivingLicenceExpiry: kd.drivingLicenceExpiry
      ? kd.drivingLicenceExpiry.split('T')[0]
      : '',
    drivingLicenceDocUrl: kd.drivingLicenceDocUrl  || '',
    licenceClass:         kd.licenceClass?.join(', ') || '',
    panNumber:            '',
    panCardUrl:           kd.panCardUrl || '',
  });

  const set      = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setInput = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      licenceClass: form.licenceClass
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const result = await dispatch(submitKyc(payload));
    if (submitKyc.fulfilled.match(result)) onSuccess?.();
  };

  // Block re-submission if already verified
  const isVerified = kd.verificationStatus === 'verified';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {isVerified && (
        <div className="rounded-xl bg-success/10 border border-success/30 p-4 flex gap-3">
          <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
          <p className="text-sm text-base-content/70">
            KYC already <strong className="text-success">verified</strong>. Contact support to make changes.
          </p>
        </div>
      )}

      {/* ── Driving Licence ── */}
      <Section icon={Car} title="Driving Licence" subtitle="Required for commercial vehicle operation in India" color="primary">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          <Field
            label="DL Number *"
            note="Enter exactly as printed on your licence — e.g. AP15 20210012345. No spaces or hyphens."
          >
            <input
              className="input-field w-full font-mono uppercase tracking-widest"
              placeholder="AP1520210012345"
              value={form.drivingLicenceNumber}
              onChange={setInput('drivingLicenceNumber')}
              maxLength={20}
              required
              disabled={isVerified}
            />
          </Field>

          <Field
            label="DL Expiry Date *"
            note="Licence must be valid for at least 90 days from today to qualify for activation."
            noteVariant="warning"
          >
            <input
              type="date"
              className="input-field w-full"
              value={form.drivingLicenceExpiry}
              onChange={setInput('drivingLicenceExpiry')}
              required
              disabled={isVerified}
            />
          </Field>

          <Field
            label="Licence Class"
            note="Separate multiple classes with commas — e.g. LMV, Transport, MC. Leave blank if unsure."
            noteVariant="tip"
          >
            <input
              className="input-field w-full"
              placeholder="LMV, Transport"
              value={form.licenceClass}
              onChange={setInput('licenceClass')}
              disabled={isVerified}
            />
          </Field>

        </div>

        <FileUploader
          label="Driving Licence Document *"
          value={form.drivingLicenceDocUrl}
          onChange={set('drivingLicenceDocUrl')}
          folder="kyc/dl"
          accept="image/*,.pdf"
          hint="Front side · JPG, PNG or PDF · max 5 MB"
          note="Upload the front page of your DL clearly showing your name, photo, and validity dates. Max file size: 5 MB."
        />
      </Section>

      {/* ── Aadhaar ── */}
      <Section icon={ScanLine} title="Aadhaar Card" subtitle="12-digit UIDAI-issued identity proof" color="info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          <Field
            label="Aadhaar Number"
            note="Your 12-digit Aadhaar number. Only last 4 digits are stored — rest are masked for your privacy."
            noteVariant="info"
          >
            <input
              className="input-field w-full font-mono tracking-[0.2em]"
              placeholder="XXXX XXXX XXXX"
              maxLength={12}
              inputMode="numeric"
              pattern="[0-9]{12}"
              value={form.aadhaarNumber}
              onChange={setInput('aadhaarNumber')}
              disabled={isVerified}
            />
          </Field>

        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FileUploader
            label="Aadhaar Front *"
            value={form.aadhaarFrontUrl}
            onChange={set('aadhaarFrontUrl')}
            folder="kyc/aadhaar"
            hint="Front side — name, DOB & photo visible"
            note="Your name, photo and date of birth must be clearly visible. Masked Aadhaar (last 4 digits) accepted."
          />
          <FileUploader
            label="Aadhaar Back *"
            value={form.aadhaarBackUrl}
            onChange={set('aadhaarBackUrl')}
            folder="kyc/aadhaar"
            hint="Back side — address visible"
            note="Full address must be visible without blurring, folding, or cropping."
          />
        </div>
      </Section>

      {/* ── PAN Card ── */}
      <Section icon={BookOpen} title="PAN Card" subtitle="Permanent Account Number — tax identity proof" color="accent">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          <Field
            label="PAN Number"
            note="10-character alphanumeric PAN — e.g. ABCDE1234F. Must exactly match the uploaded document."
          >
            <input
              className="input-field w-full font-mono uppercase tracking-widest"
              placeholder="ABCDE1234F"
              maxLength={10}
              pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
              title="Valid PAN format: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F)"
              value={form.panNumber}
              onChange={(e) => setForm((p) => ({ ...p, panNumber: e.target.value.toUpperCase() }))}
              disabled={isVerified}
            />
          </Field>

        </div>

        <FileUploader
          label="PAN Card Document"
          value={form.panCardUrl}
          onChange={set('panCardUrl')}
          folder="kyc/pan"
          hint="Clear photo or scan of your PAN card"
          note="All 4 edges and the full front face of the card must be visible. Laminated scans are acceptable."
        />
      </Section>

      {/* Info callout */}
      <div className="rounded-xl bg-info/10 border border-info/25 p-4 flex gap-3">
        <Info size={16} className="text-info shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-base-content">What happens after submission?</p>
          <p className="text-xs text-base-content/55 leading-relaxed">
            Our compliance team reviews documents within <strong>1–2 business days</strong>. You will receive
            an in-app notification once verification is complete. Rejected documents can be resubmitted
            with corrections at any time.
          </p>
        </div>
      </div>

      {!isVerified && <SubmitButton loading={isSubmitting} label="Submit KYC Documents" />}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: MEDICAL FITNESS
// POST /kyc/medical — fields: certificateNumber, issuedBy, issuedAt, expiryDate, documentUrl, bloodGroup
// ─────────────────────────────────────────────────────────────────────────────

function MedicalTab({ kyc, onSuccess }) {
  const dispatch     = useDispatch();
  // selectLoading('submitMedical') maps to loading.submitMedical in slice
  const isSubmitting = useSelector(selectLoading('submitMedical'));
  const med          = kyc?.medicalFitness || {};

  const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'];

  const [form, setForm] = useState({
    certificateNumber: med.certificateNumber || '',
    issuedBy:          med.issuedBy          || '',
    issuedAt:          med.issuedAt    ? med.issuedAt.split('T')[0]    : '',
    expiryDate:        med.expiryDate  ? med.expiryDate.split('T')[0]  : '',
    documentUrl:       med.documentUrl || '',
    bloodGroup:        med.bloodGroup  || 'Unknown',
  });

  const set      = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setInput = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // submitMedicalFitness dispatches POST /kyc/medical
    const result = await dispatch(submitMedicalFitness(form));
    if (submitMedicalFitness.fulfilled.match(result)) onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section
        icon={Stethoscope}
        title="Medical Fitness Certificate"
        subtitle="Required for commercial driving — must be valid and issued by registered medical practitioner"
        color="success"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          <Field
            label="Certificate Number"
            note="Unique certificate ID printed on the document — e.g. MFC/2024/001234. Leave blank if not printed."
          >
            <input
              className="input-field w-full font-mono"
              placeholder="MFC/2024/001234"
              value={form.certificateNumber}
              onChange={setInput('certificateNumber')}
            />
          </Field>

          <Field
            label="Issued By"
            note="Full name of the registered hospital or licensed medical officer (MBBS or above) who issued this certificate."
          >
            <input
              className="input-field w-full"
              placeholder="e.g. Apollo Hospital, Dr. R. Sharma"
              value={form.issuedBy}
              onChange={setInput('issuedBy')}
            />
          </Field>

          <Field
            label="Issue Date"
            note="The date this certificate was signed and officially stamped by the issuing authority."
          >
            <input
              type="date"
              className="input-field w-full"
              value={form.issuedAt}
              onChange={setInput('issuedAt')}
            />
          </Field>

          <Field
            label="Expiry Date *"
            note="Medical fitness certificates are typically valid for 1 year. Expired certificates will be rejected."
            noteVariant="warning"
          >
            <input
              type="date"
              className="input-field w-full"
              value={form.expiryDate}
              onChange={setInput('expiryDate')}
              required
            />
          </Field>

        </div>

        {/* Blood Group Picker */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-base-content/80">Blood Group</label>
          <div className="flex flex-wrap gap-2">
            {BLOOD_GROUPS.map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setForm((p) => ({ ...p, bloodGroup: bg }))}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all duration-200
                  ${form.bloodGroup === bg
                    ? 'border-success bg-success/15 text-success scale-105'
                    : 'border-base-300 bg-base-200 text-base-content/60 hover:border-success/50'
                  }`}
              >
                {bg}
              </button>
            ))}
          </div>
          <InputNote variant="info">
            Select your blood group as shown in the medical certificate or Aadhaar card.
            Choose "Unknown" if not stated — you can update this later.
          </InputNote>
        </div>

        <FileUploader
          label="Medical Fitness Certificate Document *"
          value={form.documentUrl}
          onChange={set('documentUrl')}
          folder="kyc/medical"
          accept="image/*,.pdf"
          hint="Signed & stamped certificate · JPG, PNG or PDF"
          note="Certificate must bear the doctor's stamp, registration number, and signature. Photocopies without official seal are not accepted."
        />
      </Section>

      {/* Requirements callout */}
      <div className="rounded-xl bg-success/10 border border-success/25 p-4 flex gap-3">
        <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-bold text-base-content">Medical fitness requirements</p>
          <p className="text-xs text-base-content/55 leading-relaxed">
            Certificate must be issued by a <strong>registered medical practitioner (MBBS or above)</strong>{' '}
            and cover fitness for commercial vehicle operation as per Motor Vehicles Act, 1988.
            Certificates older than 12 months will not be accepted.
          </p>
        </div>
      </div>

      <SubmitButton loading={isSubmitting} label="Submit Medical Certificate" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PSV BADGE
// POST /kyc/psv — fields: psvBadgeNumber, psvBadgeExpiry, psvBadgeDocUrl
// ─────────────────────────────────────────────────────────────────────────────

function PsvTab({ kyc, onSuccess }) {
  const dispatch     = useDispatch();
  // selectLoading('submitPsv') maps to loading.submitPsv in slice
  const isSubmitting = useSelector(selectLoading('submitPsv'));
  const kd           = kyc?.kyc || {};

  const [form, setForm] = useState({
    psvBadgeNumber: kd.psvBadgeNumber || '',
    psvBadgeExpiry: kd.psvBadgeExpiry ? kd.psvBadgeExpiry.split('T')[0] : '',
    psvBadgeDocUrl: kd.psvBadgeDocUrl || '',
  });

  const set      = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const setInput = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    // submitPsvBadge dispatches POST /kyc/psv
    const result = await dispatch(submitPsvBadge(form));
    if (submitPsvBadge.fulfilled.match(result)) onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <Section
        icon={Award}
        title="PSV Badge"
        subtitle="Public Service Vehicle badge — mandatory for passenger transport operations"
        color="warning"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          <Field
            label="PSV Badge Number *"
            note="Unique badge ID issued by your Regional Transport Office (RTO) — e.g. PSV/AP/2024/001. Enter exactly as printed."
          >
            <input
              className="input-field w-full font-mono uppercase tracking-widest"
              placeholder="PSV/AP/2024/001"
              value={form.psvBadgeNumber}
              onChange={setInput('psvBadgeNumber')}
              required
            />
          </Field>

          <Field
            label="Expiry Date *"
            note="PSV badges are typically valid for 3 years. A badge expiring within 30 days may delay account activation."
            noteVariant="warning"
          >
            <input
              type="date"
              className="input-field w-full"
              value={form.psvBadgeExpiry}
              onChange={setInput('psvBadgeExpiry')}
              required
            />
          </Field>

        </div>

        <FileUploader
          label="PSV Badge Document *"
          value={form.psvBadgeDocUrl}
          onChange={set('psvBadgeDocUrl')}
          folder="kyc/psv"
          accept="image/*,.pdf"
          hint="Clear scan or photo of your PSV badge"
          note="Both sides of the badge must be visible if the badge number and expiry are on different sides. Minimum resolution: 300 DPI."
        />

        {/* RTA warning */}
        <div className="rounded-xl bg-warning/10 border border-warning/30 p-4 flex gap-3">
          <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-base-content/60 leading-relaxed">
            The PSV badge must be issued by the <strong>Regional Transport Authority (RTA)</strong> and be
            currently valid. An expired or forged badge will result in immediate account suspension and
            may lead to legal action as per the Motor Vehicles Act.
          </p>
        </div>

        {/* How to obtain */}
        <div className="rounded-xl bg-info/10 border border-info/25 p-4 flex gap-3">
          <Info size={16} className="text-info shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-base-content">Don't have a PSV badge yet?</p>
            <p className="text-xs text-base-content/55 leading-relaxed">
              Visit your nearest Regional Transport Office (RTO) with your valid Driving Licence,
              Aadhaar, medical fitness certificate, and a passport-size photo. The PSV endorsement
              fee varies by state (typically ₹200–₹500).
            </p>
          </div>
        </div>
      </Section>

      <SubmitButton loading={isSubmitting} label="Submit PSV Badge Details" />
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUCCESS TOAST OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

function SuccessOverlay({ message, onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0, y: -16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0,   scale: 1    }}
        exit={{    opacity: 0, y: -16, scale: 0.96 }}
        className="fixed top-6 right-6 z-50 flex items-center gap-3 bg-success text-success-content rounded-2xl px-5 py-4 shadow-2xl"
        style={{ maxWidth: 340 }}
      >
        <CheckCircle2 size={22} />
        <p className="text-sm font-bold">{message}</p>
        <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

function KycVerificationContent({ defaultTab = 'medical', onTabChange } = {}) {
  const dispatch  = useDispatch();
  const router    = useRouter();

  // selectKyc returns state.soloDriver.kyc
  // which is populated by fetchKycStatus → GET /kyc
  // shape: { kyc: soloKycSchema, medicalFitness, profileCompletionPercent, onboarding, partnershipStatus }
  const kyc       = useSelector(selectKyc);

  // selectLoading('kyc') returns state.soloDriver.loading.kyc
  const isLoading = useSelector(selectLoading('kyc'));

  const [activeTab,  setActiveTab]  = useState(defaultTab);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    dispatch(fetchKycStatus());
  }, [dispatch]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    onTabChange?.(id);
  };

  const handleSuccess = (msg) => {
    setSuccessMsg(msg);
    // Refresh KYC status after submission
    dispatch(fetchKycStatus());
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const kycStatus  = kyc?.kyc?.verificationStatus || 'not-submitted';
  const sc         = STATUS_CONFIG[kycStatus] || STATUS_CONFIG['not-submitted'];
  const StatusIcon = sc.icon;

  return (
    <div
      data-theme="solodriverpartner"
      className="min-h-screen"
      style={{ background: 'var(--base-100)' }}
    >
      {successMsg && (
        <SuccessOverlay message={successMsg} onClose={() => setSuccessMsg(null)} />
      )}

      <Container>
        {/* ── Back Button ── */}
        <div className="pt-5 pb-0">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-semibold text-base-content/60 hover:text-primary transition-colors duration-200 group"
          >
            <ArrowLeft
              size={16}
              className="group-hover:-translate-x-0.5 transition-transform duration-200"
            />
            <span>Back</span>
          </button>
        </div>

        {/* ── Page Header ── */}
        <div className="pt-4 pb-0">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
              >
                <BadgeCheck size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black text-base-content tracking-tight">
                  KYC &amp; Verification
                </h1>
                <p className="text-xs text-base-content/50">
                  Upload and track your compliance documents
                </p>
              </div>
            </div>

            {/* Current Status Badge */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${sc.bg} ${sc.border} self-start sm:self-auto`}
            >
              <StatusIcon size={14} className={sc.color} />
              <span className={`text-xs font-bold ${sc.color}`}>{sc.label}</span>
            </div>
          </motion.div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 overflow-x-auto pb-0 scrollbar-none">
            {TABS.map((tab) => {
              const Icon     = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  whileTap={{ scale: 0.96 }}
                  className={`relative flex items-center gap-2 px-4 py-3 rounded-t-xl text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0
                    ${isActive
                      ? 'text-primary bg-base-100 border border-b-0 border-base-300'
                      : 'text-base-content/50 hover:text-base-content hover:bg-base-200/60 border border-transparent'
                    }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="active-tab-indicator"
                      className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                      style={{ background: 'var(--primary)' }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-base-300" />

        {/* ── Tab Content ── */}
        <div className="py-6">
          {isLoading && !kyc ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <p className="text-sm text-base-content/50">Loading KYC status…</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0  }}
                exit={{    opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'status'  && (
                  <KycStatusTab kyc={kyc} />
                )}
                {activeTab === 'submit'  && (
                  <SubmitKycTab
                    kyc={kyc}
                    onSuccess={() => handleSuccess('KYC documents submitted successfully!')}
                  />
                )}
                {activeTab === 'medical' && (
                  <MedicalTab
                    kyc={kyc}
                    onSuccess={() => handleSuccess('Medical certificate submitted!')}
                  />
                )}
                {activeTab === 'psv'     && (
                  <PsvTab
                    kyc={kyc}
                    onSuccess={() => handleSuccess('PSV badge details submitted!')}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </Container>
    </div>
  );
}

export default function KycVerificationPage() {
  return <KycVerificationContent defaultTab="medical" />;
}