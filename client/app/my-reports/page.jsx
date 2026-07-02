'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, FileText, Pill, Download, Eye,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Calendar, User, Hospital, Clock,
  CheckCircle2, XCircle, AlertCircle, RefreshCw,
  Trash2, Upload, X, Search, Stethoscope, FlaskConical,
  Shield, Loader2, FolderOpen, BadgeCheck, Activity, ZoomIn,
  HeartPulse, Utensils, Syringe, StickyNote, ClipboardList, Siren,
} from 'lucide-react';

import {
  fetchPrescriptions, fetchPrescriptionByRx,
  fetchReports, uploadReportFiles, deleteReportFile, fetchKyc,
  fetchCareRecords, fetchCareRecordById, clearActiveCareRecord,
  selectPrescriptions, selectPrescriptionsMeta, selectActivePrescription,
  selectReports, selectReportsTotal, selectKyc, selectSectionLoading,
  selectCareRecords, selectCareRecordsMeta, selectActiveCareRecord,
} from '@/store/slices/customerProfileSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { id: 'reports',       label: 'Lab Reports',   icon: FlaskConical },
  { id: 'careRecords',   label: 'Care Records',  icon: HeartPulse },
  { id: 'kyc',           label: 'KYC Docs',      icon: Shield },
];

const RX_STATUS_MAP = {
  issued:    { label: 'Issued',    cls: 'badge-info' },
  dispensed: { label: 'Dispensed', cls: 'badge-success' },
  expired:   { label: 'Expired',   cls: 'badge-error' },
  cancelled: { label: 'Cancelled', cls: 'badge-error' },
  draft:     { label: 'Draft',     cls: 'badge-warning' },
};

const KYC_STATUS_MAP = {
  Pending:  { label: 'Pending',  cls: 'badge-warning', icon: AlertCircle },
  Approved: { label: 'Approved', cls: 'badge-success', icon: CheckCircle2 },
  Rejected: { label: 'Rejected', cls: 'badge-error',   icon: XCircle },
};

const CARE_STATUS_MAP = {
  active:      { label: 'Active',      cls: 'badge-success' },
  discharged:  { label: 'Discharged',  cls: 'badge-neutral' },
  transferred: { label: 'Transferred', cls: 'badge-info' },
  on_hold:     { label: 'On Hold',     cls: 'badge-warning' },
};

const SEVERITY_MAP = {
  low:      'badge-ghost',
  medium:   'badge-info',
  high:     'badge-warning',
  critical: 'badge-error',
};

const FREQ_LABELS = {
  OD: 'Once Daily', BD: 'Twice Daily', TDS: 'Thrice Daily',
  QID: '4x Daily', SOS: 'As Needed', HS: 'At Bedtime',
  AC: 'Before Food', PC: 'After Food', STAT: 'Immediately',
  Weekly: 'Weekly', Monthly: 'Monthly', 'As Directed': 'As Directed',
};

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

const tabPanel = {
  hidden:  { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit:    { opacity: 0, x: -16, transition: { duration: 0.2 } },
};

// ─── Shared sub-components ─────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <div className="loading loading-md loading-spinner" />
      <span className="text-sm text-base-content/50">Loading…</span>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <motion.div
      className="flex flex-col items-center gap-3 py-16 text-center"
      variants={fadeUp} initial="hidden" animate="visible"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon size={32} />
      </div>
      <p className="font-montserrat text-base font-bold text-base-content">{title}</p>
      <p className="max-w-xs text-sm text-base-content/50">{subtitle}</p>
    </motion.div>
  );
}

function ImageThumb({ url, alt, onZoom }) {
  const isImage = /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url || '');
  return (
    <div className="group relative h-[70px] w-[70px] flex-shrink-0 overflow-hidden rounded-field border border-base-300 bg-base-200">
      {isImage ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-primary">
          <FileText size={22} />
          <span className="text-[0.6rem] font-bold">FILE</span>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
        {isImage && (
          <button
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30"
            onClick={() => onZoom(url)}
          >
            <ZoomIn size={11} />
          </button>
        )}
        <a
          href={url} target="_blank" rel="noopener noreferrer"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30"
        >
          <Download size={11} />
        </a>
      </div>
    </div>
  );
}

function Lightbox({ url, onClose }) {
  if (!url) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/88 p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.img
        src={url} alt="preview"
        className="max-h-[90vh] max-w-full rounded-box object-contain shadow-2xl"
        initial={{ scale: 0.85 }} animate={{ scale: 1 }} exit={{ scale: 0.85 }}
        onClick={(e) => e.stopPropagation()}
      />
      <button
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30"
        onClick={onClose}
      >
        <X size={20} />
      </button>
    </motion.div>
  );
}

function MedicineChip({ med }) {
  return (
    <div className="flex flex-col rounded-selector border border-primary/20 bg-primary/10 px-2 py-1">
      <span className="text-xs font-bold text-primary">{med.medicineName}</span>
      <span className="text-[0.65rem] text-base-content/55">
        {med.dosage} · {FREQ_LABELS[med.frequency] || med.frequency}
        {med.durationDays ? ` · ${med.durationDays}d` : ''}
      </span>
    </div>
  );
}

// ─── Prescription components ───────────────────────────────────────

function PrescriptionCard({ rx, onOpen }) {
  const status = RX_STATUS_MAP[rx.status] || { label: rx.status, cls: 'badge-primary' };

  return (
    <motion.div className="card flex flex-col overflow-hidden" variants={fadeUp} layout>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-montserrat text-xs font-extrabold tracking-widest text-primary">
            {rx.rxNumber}
          </span>
          <span className={`badge badge-sm ${status.cls}`}>{status.label}</span>
        </div>
        <span className="flex items-center gap-1 text-xs text-base-content/50">
          <Calendar size={12} />
          {rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-base-content">
          <Stethoscope size={13} className="text-primary" />
          <span>{rx.doctor?.name || 'Doctor'}</span>
          {rx.doctor?.specialization && (
            <span className="text-base-content/55">· {rx.doctor.specialization}</span>
          )}
        </div>
        {rx.diagnosis && (
          <div className="flex items-center gap-1.5 text-sm text-base-content">
            <Activity size={13} className="text-primary" />
            <span className="font-medium">{rx.diagnosis}</span>
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {rx.medicines?.slice(0, 3).map((m) => (
            <MedicineChip key={m._id || m.medicineName} med={m} />
          ))}
          {rx.medicines?.length > 3 && (
            <span className="self-center text-xs text-base-content/50">
              +{rx.medicines.length - 3} more
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-base-300 bg-base-200 px-4 py-2">
        {rx.followUpDate ? (
          <span className="flex items-center gap-1 text-xs text-base-content/55">
            <Clock size={11} />
            Follow-up: {new Date(rx.followUpDate).toLocaleDateString('en-IN')}
          </span>
        ) : <span />}
        <button className="btn btn-sm btn-outline ml-auto" onClick={() => onOpen(rx.rxNumber)}>
          <Eye size={14} /> View
        </button>
      </div>
    </motion.div>
  );
}

function PrescriptionDetail({ rx, onClose }) {
  if (!rx) return null;
  const status = RX_STATUS_MAP[rx.status] || { label: rx.status, cls: 'badge-primary' };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-box rounded-b-none bg-base-100 sm:max-w-2xl sm:rounded-box"
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-base-300 bg-base-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-montserrat text-base font-extrabold tracking-widest text-primary">
              {rx.rxNumber}
            </span>
            <span className={`badge ${status.cls}`}>{status.label}</span>
          </div>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: <><User size={12} /> Doctor</>,
                value: rx.doctor?.name,
                subs: [rx.doctor?.specialization, rx.doctor?.registrationNumber ? `Reg: ${rx.doctor.registrationNumber}` : null],
              },
              {
                label: <><Calendar size={12} /> Issued</>,
                value: rx.issuedAt ? new Date(rx.issuedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A',
                subs: [rx.expiresAt ? `Expires: ${new Date(rx.expiresAt).toLocaleDateString('en-IN')}` : null],
              },
            ].map((s, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">
                  {s.label}
                </p>
                <p className="text-sm font-semibold text-base-content">{s.value}</p>
                {s.subs.filter(Boolean).map((sub, j) => (
                  <p key={j} className="text-xs text-base-content/55">{sub}</p>
                ))}
              </div>
            ))}
          </div>

          {rx.diagnosis && (
            <div className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-200 p-3">
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">
                <Activity size={12} /> Diagnosis
              </p>
              <p className="text-sm font-semibold text-base-content">{rx.diagnosis}</p>
              {rx.diagnosisCode && (
                <span className="badge badge-xs badge-secondary">{rx.diagnosisCode}</span>
              )}
            </div>
          )}

          {rx.vitals && Object.values(rx.vitals).some(Boolean) && (
            <div className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-200 p-3">
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">
                <Activity size={12} /> Vitals
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rx.vitals.bloodPressure && <span className="rounded-selector border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">BP: {rx.vitals.bloodPressure}</span>}
                {rx.vitals.pulseRate    && <span className="rounded-selector border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">Pulse: {rx.vitals.pulseRate}</span>}
                {rx.vitals.temperature  && <span className="rounded-selector border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">Temp: {rx.vitals.temperature}°C</span>}
                {rx.vitals.spO2         && <span className="rounded-selector border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">SpO₂: {rx.vitals.spO2}%</span>}
                {rx.vitals.weightKg     && <span className="rounded-selector border border-info/30 bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">Wt: {rx.vitals.weightKg}kg</span>}
              </div>
            </div>
          )}

          {rx.medicines?.length > 0 && (
            <div className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-200 p-3">
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">
                <Pill size={12} /> Medicines ({rx.medicines.length})
              </p>
              <div className="flex flex-col gap-2">
                {rx.medicines.map((m, i) => (
                  <div key={m._id || i} className="flex flex-col gap-1.5 rounded-field border border-base-300 bg-base-100 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold text-base-content">{m.medicineName}</span>
                      {m.genericName && <span className="text-xs text-base-content/55">({m.genericName})</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="badge badge-xs badge-primary">{m.dosage}</span>
                      <span className="badge badge-xs badge-secondary">{FREQ_LABELS[m.frequency] || m.frequency}</span>
                      {m.timing && <span className="badge badge-xs badge-accent">{m.timing}</span>}
                      {m.durationDays && <span className="text-xs text-base-content/55">{m.durationDays}d</span>}
                    </div>
                    {m.instructions && <p className="text-xs italic text-base-content/55">{m.instructions}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {rx.labTests?.length > 0 && (
            <div className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-200 p-3">
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">
                <FlaskConical size={12} /> Lab Tests
              </p>
              <div className="flex flex-col divide-y divide-base-300">
                {rx.labTests.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium text-base-content">{t.testName}</span>
                    {t.urgency !== 'routine' && <span className="badge badge-xs badge-warning">{t.urgency}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(rx.advice || rx.followUpDate) && (
            <div className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-200 p-3">
              {rx.advice && (
                <>
                  <p className="text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">Advice</p>
                  <p className="text-sm leading-relaxed text-base-content">{rx.advice}</p>
                </>
              )}
              {rx.followUpDate && (
                <div className="mt-1 inline-flex items-center gap-1.5 rounded-selector border border-info/30 bg-info/10 px-2.5 py-1 text-xs font-semibold text-info">
                  <Clock size={12} />
                  Follow-up: {new Date(rx.followUpDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {rx.followUpInstructions && <span>· {rx.followUpInstructions}</span>}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Reports components ────────────────────────────────────────────

function ReportEventCard({ report, onUpload, onDeleteFile }) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const loading = useSelector(selectSectionLoading('reports'));

  const isImage = (url) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);

  const handleUpload = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('reportFiles', f));
    onUpload(report.eventId, fd);
  };

  return (
    <motion.div
      className="overflow-hidden rounded-box border border-base-300 bg-base-100 transition-colors hover:border-primary/30"
      variants={fadeUp} layout
    >
      <div className="flex cursor-pointer items-center gap-3 px-4 py-3" onClick={() => setExpanded((p) => !p)}>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field bg-primary/10 text-primary">
          <FileText size={16} />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <p className="truncate text-sm font-bold text-base-content">{report.eventTitle}</p>
          <div className="flex flex-wrap gap-2">
            {report.hospitalName && (
              <span className="flex items-center gap-1 text-[0.7rem] text-base-content/50">
                <Hospital size={11} /> {report.hospitalName}
              </span>
            )}
            {report.doctorName && (
              <span className="flex items-center gap-1 text-[0.7rem] text-base-content/50">
                <User size={11} /> {report.doctorName}
              </span>
            )}
            <span className="flex items-center gap-1 text-[0.7rem] text-base-content/50">
              <Calendar size={11} />
              {report.date ? new Date(report.date).toLocaleDateString('en-IN') : 'N/A'}
            </span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2 text-base-content/50">
          <span className="badge badge-sm badge-primary">
            {report.reportUrls?.length || 0} file{report.reportUrls?.length !== 1 ? 's' : ''}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            className="overflow-hidden border-t border-base-300"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex flex-wrap gap-3 p-4">
              {report.reportUrls?.map((url, i) => (
                <div key={i} className="group relative h-[90px] w-[90px] flex-shrink-0 overflow-hidden rounded-field border border-base-300 bg-base-200">
                  {isImage(url) ? (
                    <img src={url} alt={`report-${i}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-primary">
                      <FileText size={28} />
                      <span className="text-[0.65rem] font-bold">PDF</span>
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                    {isImage(url) && (
                      <button
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
                        onClick={() => setLightbox(url)}
                      >
                        <ZoomIn size={13} />
                      </button>
                    )}
                    <a
                      href={url} target="_blank" rel="noopener noreferrer"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/30"
                    >
                      <Download size={13} />
                    </a>
                    <button
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-error/70"
                      onClick={() => onDeleteFile(report.eventId, url)}
                      disabled={loading}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              <label className="flex h-[90px] w-[90px] flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-field border-2 border-dashed border-primary/40 bg-primary/5 text-primary transition-colors hover:border-primary hover:bg-primary/10">
                <input
                  type="file" multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleUpload}
                  disabled={loading}
                  className="hidden"
                />
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                <span className="text-[0.65rem] font-bold">Add Files</span>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── KYC card ───────────────────────────────────────────────────────

function KycCard({ doc }) {
  const statusInfo = KYC_STATUS_MAP[doc.verificationStatus] || { label: doc.verificationStatus, cls: 'badge-primary', icon: AlertCircle };
  const StatusIcon = statusInfo.icon;

  return (
    <motion.div
      className="flex flex-wrap items-start justify-between gap-3 rounded-box border border-base-300 bg-base-100 p-4 transition-all hover:border-primary/30 hover:shadow-depth"
      variants={fadeUp}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-field bg-gradient-to-br from-primary to-secondary text-primary-content">
          <BadgeCheck size={18} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="font-montserrat text-sm font-extrabold text-base-content">{doc.type}</p>
          {doc.holderName && <p className="text-xs font-medium text-base-content">{doc.holderName}</p>}
          {doc.documentNumber && <p className="font-mono text-[0.7rem] text-base-content/50">#{doc.documentNumber}</p>}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className={`badge badge-sm ${statusInfo.cls}`}>
          <StatusIcon size={11} /> {statusInfo.label}
        </span>
        <div className="flex gap-1.5">
          {doc.documentUrl && (
            <a
              href={doc.documentUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-selector border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Eye size={13} /> Front
            </a>
          )}
          {doc.backSideUrl && (
            <a
              href={doc.backSideUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-selector border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
            >
              <Eye size={13} /> Back
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Care Record components (NEW) ───────────────────────────────────────────────

function CareRecordCard({ record, onOpen }) {
  const status = CARE_STATUS_MAP[record.status] || { label: record.status, cls: 'badge-primary' };
  const booking = record.booking || {};
  const openAlerts = (record.careNotes || []).filter((n) => n.severity === 'critical' && !n.isResolved);

  return (
    <motion.div
      className="card flex flex-col overflow-hidden cursor-pointer"
      variants={fadeUp} layout
      onClick={() => onOpen(record._id)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-montserrat text-xs font-extrabold tracking-widest text-primary">
            {booking.bookingCode || 'Care Record'}
          </span>
          <span className={`badge badge-sm ${status.cls}`}>{status.label}</span>
          {openAlerts.length > 0 && (
            <span className="badge badge-sm badge-error gap-1">
              <Siren size={11} /> {openAlerts.length}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs text-base-content/50">
          <Calendar size={12} />
          {record.assignedAt ? new Date(record.assignedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-base-content">
          <User size={13} className="text-primary" />
          <span>{record.careAssistant?.fullName || 'Care Assistant'}</span>
        </div>
        {booking.bookingType && (
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <ClipboardList size={13} className="text-primary" />
            <span className="capitalize">{booking.bookingType.replaceAll('_', ' ')}</span>
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-2 text-[0.7rem] text-base-content/50">
          <span className="flex items-center gap-1"><HeartPulse size={11} /> {record.vitalsLog?.length || 0} vitals</span>
          <span className="flex items-center gap-1"><Syringe size={11} /> {record.medicineLog?.length || 0} meds</span>
          <span className="flex items-center gap-1"><Utensils size={11} /> {record.foodLog?.length || 0} meals</span>
          <span className="flex items-center gap-1"><StickyNote size={11} /> {record.careNotes?.length || 0} notes</span>
        </div>
      </div>

      <div className="flex items-center justify-end border-t border-base-300 bg-base-200 px-4 py-2">
        <button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); onOpen(record._id); }}>
          <Eye size={14} /> View
        </button>
      </div>
    </motion.div>
  );
}

function CareRecordDetail({ record, onClose }) {
  const [lightbox, setLightbox] = useState(null);
  const [section, setSection]   = useState('vitals');

  if (!record) return null;

  const status  = CARE_STATUS_MAP[record.status] || { label: record.status, cls: 'badge-primary' };
  const booking = record.booking || {};
  // Safely extract snapshot from booking.patientInfo (if populated) or record fallback
  const snap    = booking.patientInfo || record.patientSnapshot || {};

  const SECTIONS = [
    { id: 'vitals',       label: 'Vitals',       icon: HeartPulse,    data: record.vitalsLog       || [] },
    { id: 'medicine',     label: 'Medicines',    icon: Syringe,       data: record.medicineLog     || [] },
    { id: 'food',         label: 'Food',         icon: Utensils,      data: record.foodLog         || [] },
    { id: 'notes',        label: 'Care Notes',   icon: StickyNote,    data: record.careNotes       || [] },
    // Backend populates this as +hospitalInstructions
    { id: 'instructions', label: 'Instructions', icon: ClipboardList, data: record.hospitalInstructions || record.instructions || [] },
  ];

  const active = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-box rounded-b-none bg-base-100 sm:max-w-2xl sm:rounded-box"
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-base-300 bg-base-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-montserrat text-base font-extrabold tracking-widest text-primary">
              {booking.bookingCode || 'Care Record'}
            </span>
            <span className={`badge ${status.cls}`}>{status.label}</span>
          </div>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">

          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">
                <User size={12} /> Care Assistant
              </p>
              <p className="text-sm font-semibold text-base-content">{record.careAssistant?.fullName || '—'}</p>
              {record.careAssistant?.phone && <p className="text-xs text-base-content/55">{record.careAssistant.phone}</p>}
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">
                <ClipboardList size={12} /> Booking
              </p>
              <p className="text-sm font-semibold capitalize text-base-content">
                {booking.bookingType?.replaceAll('_', ' ') || '—'}
              </p>
              {booking.scheduledAt && (
                <p className="text-xs text-base-content/55">
                  {new Date(booking.scheduledAt).toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>

          {/* Emergency snapshot */}
          {(snap.bloodGroup || snap.allergies?.length || snap.chronicConditions?.length || snap.emergencyContact?.phone) && (
            <div className="flex flex-col gap-2 rounded-field border border-error/30 bg-error/5 p-3">
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-error/70">
                <Siren size={12} /> Emergency Snapshot
              </p>
              <div className="flex flex-wrap gap-1.5">
                {snap.bloodGroup && <span className="badge badge-xs badge-error">Blood: {snap.bloodGroup}</span>}
                {snap.allergies?.map((a, i) => <span key={i} className="badge badge-xs badge-warning">Allergy: {a}</span>)}
                {snap.chronicConditions?.map((c, i) => <span key={i} className="badge badge-xs badge-info">{c}</span>)}
              </div>
              {snap.emergencyContact?.phone && (
                <p className="text-xs text-base-content/70">
                  Contact: {snap.emergencyContact.name} ({snap.emergencyContact.relation}) · {snap.emergencyContact.phone}
                </p>
              )}
            </div>
          )}

          {/* Booking documents */}
          {booking.documents?.length > 0 && (
            <div className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-200 p-3">
              <p className="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-widest text-base-content/45">
                <FileText size={12} /> Booking Documents
              </p>
              <div className="flex flex-wrap gap-3">
                {booking.documents.map((d) => (
                  <div key={d._id || d.url} className="flex flex-col items-center gap-1">
                    <ImageThumb url={d.url} alt={d.docType} onZoom={setLightbox} />
                    <span className="text-[0.6rem] capitalize text-base-content/50">{d.docType?.replaceAll('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-thin">
            {SECTIONS.map(({ id, label, icon: Icon, data }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={[
                  'inline-flex flex-shrink-0 items-center gap-1.5 rounded-field border px-3 py-1.5 text-xs font-semibold transition-all',
                  section === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-base-300 text-base-content/60 hover:border-primary/40',
                ].join(' ')}
              >
                <Icon size={12} /> {label} ({data.length})
              </button>
            ))}
          </div>

          {/* Section content */}
          <div className="flex flex-col gap-2">
            {active.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-base-content/50">No {active.label.toLowerCase()} recorded yet.</p>
            )}

            {/* Vitals */}
            {section === 'vitals' && active.data?.slice().reverse().map((v) => (
              <div key={v._id} className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-base-content/60">
                    {v.recordedAt ? new Date(v.recordedAt).toLocaleString('en-IN') : 'N/A'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {v.bloodPressure && <span className="badge badge-xs badge-info">BP {v.bloodPressure}</span>}
                  {v.pulseRate != null && <span className="badge badge-xs badge-info">Pulse {v.pulseRate}</span>}
                  {v.temperature != null && <span className="badge badge-xs badge-info">Temp {v.temperature}°C</span>}
                  {v.spO2 != null && <span className="badge badge-xs badge-info">SpO₂ {v.spO2}%</span>}
                  {v.bloodSugar != null && <span className="badge badge-xs badge-info">Sugar {v.bloodSugar}</span>}
                  {v.weightKg != null && <span className="badge badge-xs badge-info">Wt {v.weightKg}kg</span>}
                  {v.respiratoryRate != null && <span className="badge badge-xs badge-info">RR {v.respiratoryRate}</span>}
                </div>
                {v.notes && <p className="text-xs italic text-base-content/55">{v.notes}</p>}
                {v.evidenceImages?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {v.evidenceImages.map((img) => (
                      <ImageThumb key={img._id || img.url} url={img.url} alt="vitals evidence" onZoom={setLightbox} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Medicine */}
            {section === 'medicine' && active.data?.slice().reverse().map((m) => (
              <div key={m._id} className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-base-content">{m.medicineName}</span>
                  <span className={`badge badge-xs ${
                    m.status === 'given' ? 'badge-success' :
                    m.status === 'missed' || m.status === 'refused' ? 'badge-error' : 'badge-ghost'
                  }`}>{m.status}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-xs text-base-content/60">
                  {m.dosage && <span>{m.dosage}</span>}
                  {m.route && <span className="capitalize">· {m.route}</span>}
                  {m.scheduledAt && <span>· Scheduled {new Date(m.scheduledAt).toLocaleString('en-IN')}</span>}
                </div>
                {m.missedReason && <p className="text-xs italic text-error">{m.missedReason}</p>}
                {m.notes && <p className="text-xs italic text-base-content/55">{m.notes}</p>}
                {m.pillImages?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.pillImages.map((img) => (
                      <ImageThumb key={img._id || img.url} url={img.url} alt="pill confirmation" onZoom={setLightbox} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Food */}
            {section === 'food' && active.data?.slice().reverse().map((f) => (
              <div key={f._id} className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold capitalize text-base-content">{f.mealType}</span>
                  <span className={`badge badge-xs ${
                    f.status === 'consumed' ? 'badge-success' :
                    f.status === 'refused' || f.status === 'vomited' ? 'badge-error' : 'badge-warning'
                  }`}>{f.status}</span>
                </div>
                <span className="text-xs text-base-content/60">
                  {f.mealTime ? new Date(f.mealTime).toLocaleString('en-IN') : 'N/A'}
                </span>
                {f.description && <p className="text-xs text-base-content">{f.description}</p>}
                {f.quantityMl != null && <span className="text-xs text-base-content/55">{f.quantityMl} ml</span>}
                {f.refusalReason && <p className="text-xs italic text-error">{f.refusalReason}</p>}
                {f.images?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {f.images.map((img) => (
                      <ImageThumb key={img._id || img.url} url={img.url} alt="meal" onZoom={setLightbox} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Care Notes */}
            {section === 'notes' && active.data?.slice().reverse().map((n) => (
              <div key={n._id} className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="badge badge-xs capitalize">{n.category}</span>
                  <span className={`badge badge-xs ${SEVERITY_MAP[n.severity] || 'badge-ghost'}`}>{n.severity}</span>
                </div>
                <p className="text-sm text-base-content">{n.note}</p>
                <span className="text-xs text-base-content/50">
                  {n.recordedAt ? new Date(n.recordedAt).toLocaleString('en-IN') : 'N/A'}
                  {n.isResolved ? ' · Resolved' : ''}
                </span>
                {n.observationImages?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {n.observationImages.map((img) => (
                      <ImageThumb key={img._id || img.url} url={img.url} alt="observation" onZoom={setLightbox} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Hospital Instructions */}
            {section === 'instructions' && active.data?.slice().reverse().map((ins) => (
              <div key={ins._id} className="flex flex-col gap-2 rounded-field border border-base-300 bg-base-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="badge badge-xs capitalize">{ins.category}</span>
                  <span className="text-xs text-base-content/50">
                    {ins.issuedAt ? new Date(ins.issuedAt).toLocaleString('en-IN') : 'N/A'}
                  </span>
                </div>
                <p className="text-sm text-base-content">{ins.instruction}</p>
                {ins.issuedByName && <span className="text-xs text-base-content/55">— {ins.issuedByName}</span>}
                {ins.attachments?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ins.attachments.map((img) => (
                      <ImageThumb key={img._id || img.url} url={img.url} alt="instruction attachment" onZoom={setLightbox} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {lightbox && <Lightbox url={lightbox} onClose={() => setLightbox(null)} />}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MyReports() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const [activeTab, setActiveTab] = useState('prescriptions');
  const [rxStatus,  setRxStatus]  = useState('');
  const [rxSearch,  setRxSearch]  = useState('');
  const [detailRx,  setDetailRx]  = useState(false);
  const [rxPage,    setRxPage]    = useState(1);

  const [carePage,   setCarePage]   = useState(1);
  const [careStatus, setCareStatus] = useState('');
  const [careDetailOpen, setCareDetailOpen] = useState(false);

  const prescriptions      = useSelector(selectPrescriptions);
  const prescriptionsMeta  = useSelector(selectPrescriptionsMeta);
  const activePrescription = useSelector(selectActivePrescription);
  const reports            = useSelector(selectReports);
  const reportsTotal       = useSelector(selectReportsTotal);
  const kyc                = useSelector(selectKyc);
  const careRecords        = useSelector(selectCareRecords);
  const careRecordsMeta    = useSelector(selectCareRecordsMeta);
  const activeCareRecord   = useSelector(selectActiveCareRecord);

  const rxLoading      = useSelector(selectSectionLoading('prescriptions'));
  const reportsLoading = useSelector(selectSectionLoading('reports'));
  const kycLoading     = useSelector(selectSectionLoading('kyc'));
  const careLoading    = useSelector(selectSectionLoading('careRecords'));

  useEffect(() => {
    if (activeTab === 'prescriptions') {
      dispatch(fetchPrescriptions({ page: rxPage, limit: 8, status: rxStatus || undefined }));
    } else if (activeTab === 'reports') {
      dispatch(fetchReports());
    } else if (activeTab === 'kyc') {
      dispatch(fetchKyc());
    } else if (activeTab === 'careRecords') {
      dispatch(fetchCareRecords({ page: carePage, limit: 8, status: careStatus || undefined }));
    }
  }, [activeTab, rxPage, rxStatus, carePage, careStatus, dispatch]);

  const handleOpenDetail = useCallback(async (rxNumber) => {
    await dispatch(fetchPrescriptionByRx(rxNumber));
    setDetailRx(true);
  }, [dispatch]);

  const handleUploadFiles = useCallback((eventId, formData) => {
    dispatch(uploadReportFiles({ eventId, formData }));
  }, [dispatch]);

  const handleDeleteFile = useCallback((eventId, url) => {
    if (window.confirm('Remove this file?')) {
      dispatch(deleteReportFile({ eventId, url }));
    }
  }, [dispatch]);

  const handleOpenCareRecord = useCallback(async (recordId) => {
    await dispatch(fetchCareRecordById(recordId));
    setCareDetailOpen(true);
  }, [dispatch]);

  const handleCloseCareRecord = useCallback(() => {
    setCareDetailOpen(false);
    dispatch(clearActiveCareRecord());
  }, [dispatch]);

  const filteredRx = rxSearch
    ? prescriptions.filter((rx) =>
        rx.rxNumber?.toLowerCase().includes(rxSearch.toLowerCase()) ||
        rx.doctor?.name?.toLowerCase().includes(rxSearch.toLowerCase()) ||
        rx.diagnosis?.toLowerCase().includes(rxSearch.toLowerCase())
      )
    : prescriptions;

  return (
    <div data-theme="customer" className="min-h-screen bg-base-100 pb-12">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30 flex items-start gap-3 border-b border-base-300 bg-base-100/90 px-4 py-4 backdrop-blur-soft md:px-8 md:py-5">
        <button className="btn btn-ghost btn-sm mt-0.5 flex-shrink-0 gap-1.5" onClick={() => router.back()}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-montserrat text-xl font-black tracking-tight text-base-content md:text-2xl">
            My Health Records
          </h3>
          <p className="text-xs text-base-content/50">Prescriptions, lab reports, care records &amp; documents</p>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 overflow-x-auto border-b border-base-300 bg-base-100 px-4 scrollbar-thin md:px-8">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              'inline-flex flex-shrink-0 items-center gap-1.5 rounded-t-field border-b-2 px-4 py-3 text-xs font-semibold transition-all',
              activeTab === id
                ? 'border-primary bg-primary/8 text-primary'
                : 'border-transparent text-base-content/60 hover:bg-primary/5 hover:text-primary',
            ].join(' ')}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-3xl px-4 py-5 md:px-8">
        <AnimatePresence mode="wait">

          {/* ══ PRESCRIPTIONS ══ */}
          {activeTab === 'prescriptions' && (
            <motion.div key="prescriptions" variants={tabPanel} initial="hidden" animate="visible" exit="exit">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/45 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search RX, doctor, diagnosis…"
                    value={rxSearch}
                    onChange={(e) => setRxSearch(e.target.value)}
                    className="input-field pl-9"
                  />
                </div>
                <select
                  value={rxStatus}
                  onChange={(e) => { setRxStatus(e.target.value); setRxPage(1); }}
                  className="input-field sm:w-40"
                >
                  <option value="">All Status</option>
                  {Object.entries(RX_STATUS_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button
                  className="btn btn-ghost btn-sm flex-shrink-0"
                  onClick={() => dispatch(fetchPrescriptions({ page: rxPage, limit: 8, status: rxStatus || undefined }))}
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {rxLoading ? (
                <PageLoader />
              ) : filteredRx.length === 0 ? (
                <EmptyState icon={Pill} title="No prescriptions found" subtitle="Your prescriptions will appear here after a consultation." />
              ) : (
                <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2" variants={stagger} initial="hidden" animate="visible">
                  {filteredRx.map((rx) => (
                    <PrescriptionCard key={rx._id} rx={rx} onOpen={handleOpenDetail} />
                  ))}
                </motion.div>
              )}

              {!rxSearch && prescriptionsMeta?.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button className="btn btn-ghost btn-circle btn-sm" disabled={rxPage === 1} onClick={() => setRxPage((p) => p - 1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-semibold text-base-content">
                    {rxPage} / {prescriptionsMeta.totalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-circle btn-sm"
                    disabled={rxPage === prescriptionsMeta.totalPages}
                    onClick={() => setRxPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ REPORTS ══ */}
          {activeTab === 'reports' && (
            <motion.div key="reports" variants={tabPanel} initial="hidden" animate="visible" exit="exit">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-base-content/55">
                  {reportsTotal} event{reportsTotal !== 1 ? 's' : ''} with reports
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => dispatch(fetchReports())}>
                  <RefreshCw size={14} />
                </button>
              </div>

              {reportsLoading ? (
                <PageLoader />
              ) : reports.length === 0 ? (
                <EmptyState icon={FolderOpen} title="No reports uploaded" subtitle="Add report files to your medical timeline events." />
              ) : (
                <motion.div className="flex flex-col gap-3" variants={stagger} initial="hidden" animate="visible">
                  {reports.map((r) => (
                    <ReportEventCard key={r.eventId} report={r} onUpload={handleUploadFiles} onDeleteFile={handleDeleteFile} />
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ══ CARE RECORDS (NEW) ══ */}
          {activeTab === 'careRecords' && (
            <motion.div key="careRecords" variants={tabPanel} initial="hidden" animate="visible" exit="exit">
              <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="flex-1 text-xs font-semibold text-base-content/55">
                  {careRecordsMeta?.total || 0} care record{(careRecordsMeta?.total || 0) !== 1 ? 's' : ''}
                </span>
                <select
                  value={careStatus}
                  onChange={(e) => { setCareStatus(e.target.value); setCarePage(1); }}
                  className="input-field sm:w-40"
                >
                  <option value="">All Status</option>
                  {Object.entries(CARE_STATUS_MAP).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                <button
                  className="btn btn-ghost btn-sm flex-shrink-0"
                  onClick={() => dispatch(fetchCareRecords({ page: carePage, limit: 8, status: careStatus || undefined }))}
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {careLoading ? (
                <PageLoader />
              ) : careRecords.length === 0 ? (
                <EmptyState icon={HeartPulse} title="No care records yet" subtitle="Records created for care-assistant bookings will appear here, with vitals, meals, medicine logs and photos." />
              ) : (
                <motion.div className="grid grid-cols-1 gap-3 sm:grid-cols-2" variants={stagger} initial="hidden" animate="visible">
                  {careRecords.map((record) => (
                    <CareRecordCard key={record._id} record={record} onOpen={handleOpenCareRecord} />
                  ))}
                </motion.div>
              )}

              {careRecordsMeta?.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button className="btn btn-ghost btn-circle btn-sm" disabled={carePage === 1} onClick={() => setCarePage((p) => p - 1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-semibold text-base-content">
                    {carePage} / {careRecordsMeta.totalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-circle btn-sm"
                    disabled={carePage === careRecordsMeta.totalPages}
                    onClick={() => setCarePage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ KYC ══ */}
          {activeTab === 'kyc' && (
            <motion.div key="kyc" variants={tabPanel} initial="hidden" animate="visible" exit="exit">
              {kycLoading ? (
                <PageLoader />
              ) : kyc.length === 0 ? (
                <EmptyState icon={Shield} title="No KYC documents" subtitle="Upload your ID documents to verify your account." />
              ) : (
                <motion.div className="flex flex-col gap-3" variants={stagger} initial="hidden" animate="visible">
                  {kyc.map((doc) => (
                    <KycCard key={doc._id} doc={doc} />
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Prescription Detail Overlay ── */}
      <AnimatePresence>
        {detailRx && (
          <PrescriptionDetail rx={activePrescription} onClose={() => setDetailRx(false)} />
        )}
      </AnimatePresence>

      {/* ── Care Record Detail Overlay (NEW) ── */}
      <AnimatePresence>
        {careDetailOpen && (
          <CareRecordDetail record={activeCareRecord} onClose={handleCloseCareRecord} />
        )}
      </AnimatePresence>
    </div>
  );
}