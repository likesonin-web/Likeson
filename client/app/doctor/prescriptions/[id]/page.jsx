'use client';

/**
 * EPrescription.jsx
 * Likeson.in — Doctor Dashboard
 *
 * Dual-mode: CREATE (new) + VIEW (existing by :id)
 *
 * URL patterns:
 *   /doctor/prescriptions/new?bookingId=xxx   → create mode
 *   /doctor/prescriptions/new?opId=xxx        → create linked to OP
 *   /doctor/prescriptions/:id                 → view/print mode
 *
 * Covers ALL fields from EPrescription + Booking + OutPatientRecord models:
 *   doctor snapshot, patient snapshot, diagnosis, ICD-10, chief complaints,
 *   clinical findings, vitals, medicines[], labTests[], followUp, advice,
 *   referral, digital signature flag, PDF download.
 *
 * Redux: createPrescription, fetchPrescriptionById, downloadPrescriptionPdf,
 *        cancelPrescription, verifyPrescription, fetchPrescriptionById
 */

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Trash2, Download, ArrowLeft, CheckCircle2,
  AlertCircle, Pill, FlaskConical, User, Stethoscope, Heart,
  Thermometer, Activity, Droplets, Weight, Ruler, Wind,
  CalendarDays, Clock, PenLine, Shield, XCircle, Eye,
  ChevronDown, ChevronUp, Printer, RefreshCw, Save,
  BadgeCheck, ClipboardList, Info, Syringe, TestTube2,
  BookOpen, Phone, Mail, Hospital, Hash, Star,
} from 'lucide-react';

import {
  createPrescription,
  fetchPrescriptionById,
  downloadPrescriptionPdf,
  cancelPrescription,
  selectSelectedPrescription,
  selectClinicalLoading,
  selectClinicalError,
  clearSelectedPrescription,
} from '@/store/slices/clinicalSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const FREQUENCIES = ['OD','BD','TDS','QID','SOS','HS','AC','PC','STAT','Weekly','Monthly','As Directed'];
const TIMINGS     = ['Before Food','After Food','With Food','Empty Stomach','Bedtime','As Directed'];
const ROUTES      = ['Oral','Topical','IV','IM','Inhalation','Sublingual','Rectal','Other'];
const URGENCIES   = ['routine','urgent','stat'];

const EMPTY_MEDICINE = {
  medicineName: '', genericName: '', brandName: '', dosage: '', form: '',
  frequency: 'OD', timing: 'After Food', route: 'Oral',
  durationDays: '', quantity: '', refillsAllowed: 0,
  instructions: '', isSubstitutable: true,
};

const EMPTY_LAB = {
  testName: '', testCode: '', urgency: 'routine', instructions: '',
};

const EMPTY_VITALS = {
  bloodPressure: '', pulseRate: '', temperature: '',
  spO2: '', bloodSugar: '', weightKg: '', heightCm: '', respiratoryRate: '',
};

const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'];
const GENDERS      = ['Male','Female','Other','Prefer Not to Say'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const statusColor = (s) => {
  const m = {
    issued:    'badge-primary',
    dispensed: 'badge-success',
    cancelled: 'badge-error',
    expired:   'badge-warning',
    draft:     'badge-secondary',
  };
  return m[s] || 'badge-secondary';
};

// ─── Section Wrapper ──────────────────────────────────────────────────────────

const Section = ({ icon: Icon, title, children, collapsible = false, accent = 'primary' }) => {
  const [open, setOpen] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden"
      style={{ borderTop: `3px solid var(--${accent})` }}
    >
      <button
        type="button"
        className={`w-full flex items-center justify-between px-5 py-4 ${collapsible ? 'cursor-pointer hover:bg-base-200/50' : 'cursor-default'} transition-colors`}
        onClick={() => collapsible && setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg" style={{ background: `color-mix(in srgb, var(--${accent}), transparent 88%)` }}>
            <Icon size={16} style={{ color: `var(--${accent})` }} />
          </div>
          <h3 className="font-bold text-base-content font-montserrat text-sm">{title}</h3>
        </div>
        {collapsible && (open ? <ChevronUp size={16} className="text-base-content/40" /> : <ChevronDown size={16} className="text-base-content/40" />)}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-5 pt-1 border-t border-base-300/50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Field ────────────────────────────────────────────────────────────────────

const Field = ({ label, required, children, hint }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-bold uppercase tracking-wider text-base-content/50">
      {label}{required && <span className="text-error ml-0.5">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-base-content/30 mt-0.5">{hint}</p>}
  </div>
);

// ─── Medicine Row ─────────────────────────────────────────────────────────────

const MedicineRow = ({ med, idx, onChange, onRemove, isView }) => {
  const update = (key, val) => onChange(idx, { ...med, [key]: val });

  if (isView) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-base-200/60 rounded-xl p-4 border border-base-300"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Pill size={13} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-sm text-base-content">{med.medicineName}</p>
              {med.genericName && <p className="text-xs text-base-content/50">Generic: {med.genericName}</p>}
            </div>
          </div>
          <div className="text-right text-xs text-base-content/60 space-y-0.5">
            <p className="font-bold text-base-content">{med.dosage} · {med.frequency}</p>
            <p>{med.timing} · {med.route}</p>
            {med.durationDays && <p>{med.durationDays} days</p>}
          </div>
        </div>
        {med.instructions && (
          <p className="mt-2 text-xs text-base-content/50 italic border-t border-base-300 pt-2">
            📋 {med.instructions}
          </p>
        )}
        <div className="flex gap-2 mt-2 flex-wrap">
          {med.form && <span className="badge badge-xs badge-secondary">{med.form}</span>}
          {med.quantity && <span className="badge badge-xs badge-primary">Qty: {med.quantity}</span>}
          {med.refillsAllowed > 0 && <span className="badge badge-xs badge-accent">Refills: {med.refillsAllowed}</span>}
          {!med.isSubstitutable && <span className="badge badge-xs badge-error">No Substitution</span>}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-base-200/50 border border-base-300 rounded-xl p-4 space-y-3"
    >
      {/* Row header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary text-primary-content flex items-center justify-center text-xs font-bold">
            {idx + 1}
          </div>
          <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Medicine</span>
        </div>
        <button type="button" onClick={() => onRemove(idx)} className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10">
          <Trash2 size={13} />
        </button>
      </div>

      {/* Row 1: Name, Generic, Brand, Dosage, Form */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="md:col-span-2">
          <Field label="Medicine Name" required>
            <input className="input-field text-sm" placeholder="e.g. Paracetamol" value={med.medicineName}
              onChange={(e) => update('medicineName', e.target.value)} />
          </Field>
        </div>
        <Field label="Generic Name">
          <input className="input-field text-sm" placeholder="Generic" value={med.genericName}
            onChange={(e) => update('genericName', e.target.value)} />
        </Field>
        <Field label="Brand Name">
          <input className="input-field text-sm" placeholder="Brand" value={med.brandName}
            onChange={(e) => update('brandName', e.target.value)} />
        </Field>
        <Field label="Form">
          <input className="input-field text-sm" placeholder="Tablet/Syrup..." value={med.form}
            onChange={(e) => update('form', e.target.value)} />
        </Field>
      </div>

      {/* Row 2: Dosage, Frequency, Timing, Route, Duration, Qty, Refills */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <Field label="Dosage" required>
          <input className="input-field text-sm" placeholder="500mg" value={med.dosage}
            onChange={(e) => update('dosage', e.target.value)} />
        </Field>
        <Field label="Frequency" required>
          <select className="input-field text-sm" value={med.frequency}
            onChange={(e) => update('frequency', e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
          </select>
        </Field>
        <Field label="Timing">
          <select className="input-field text-sm" value={med.timing}
            onChange={(e) => update('timing', e.target.value)}>
            {TIMINGS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Route">
          <select className="input-field text-sm" value={med.route}
            onChange={(e) => update('route', e.target.value)}>
            {ROUTES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Duration (days)">
          <input type="number" min={1} className="input-field text-sm" placeholder="7" value={med.durationDays}
            onChange={(e) => update('durationDays', e.target.value)} />
        </Field>
        <Field label="Quantity">
          <input type="number" min={1} className="input-field text-sm" placeholder="14" value={med.quantity}
            onChange={(e) => update('quantity', e.target.value)} />
        </Field>
        <Field label="Refills">
          <input type="number" min={0} className="input-field text-sm" placeholder="0" value={med.refillsAllowed}
            onChange={(e) => update('refillsAllowed', Number(e.target.value))} />
        </Field>
      </div>

      {/* Row 3: Instructions + Substitutable */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <div className="md:col-span-2">
          <Field label="Instructions">
            <input className="input-field text-sm" placeholder="Apply thin layer / Take with warm water..." value={med.instructions}
              onChange={(e) => update('instructions', e.target.value)} />
          </Field>
        </div>
        <div className="flex items-center gap-2 pt-4">
          <input
            type="checkbox"
            id={`sub-${idx}`}
            className="checkbox checkbox-sm checkbox-success"
            checked={med.isSubstitutable}
            onChange={(e) => update('isSubstitutable', e.target.checked)}
          />
          <label htmlFor={`sub-${idx}`} className="text-xs font-semibold text-base-content/60 cursor-pointer">
            Allow generic substitution
          </label>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Lab Test Row ─────────────────────────────────────────────────────────────

const LabRow = ({ lab, idx, onChange, onRemove, isView }) => {
  const update = (key, val) => onChange(idx, { ...lab, [key]: val });

  if (isView) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start gap-3 bg-base-200/60 rounded-xl p-3.5 border border-base-300"
      >
        <div className="p-1.5 rounded-lg bg-accent/10 shrink-0">
          <TestTube2 size={13} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-base-content">{lab.testName}</p>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {lab.testCode && <span className="badge badge-xs badge-secondary font-mono">{lab.testCode}</span>}
            <span className={`badge badge-xs ${lab.urgency === 'stat' ? 'badge-error' : lab.urgency === 'urgent' ? 'badge-warning' : 'badge-success'}`}>
              {lab.urgency}
            </span>
          </div>
          {lab.instructions && <p className="text-xs text-base-content/50 mt-1 italic">{lab.instructions}</p>}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-base-200/50 border border-base-300 rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-accent text-accent-content flex items-center justify-center text-xs font-bold">
            {idx + 1}
          </div>
          <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wider">Lab Test</span>
        </div>
        <button type="button" onClick={() => onRemove(idx)} className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="md:col-span-2">
          <Field label="Test Name" required>
            <input className="input-field text-sm" placeholder="e.g. CBC, Lipid Profile" value={lab.testName}
              onChange={(e) => update('testName', e.target.value)} />
          </Field>
        </div>
        <Field label="Test Code">
          <input className="input-field text-sm font-mono" placeholder="LAB001" value={lab.testCode}
            onChange={(e) => update('testCode', e.target.value)} />
        </Field>
        <Field label="Urgency">
          <select className="input-field text-sm" value={lab.urgency}
            onChange={(e) => update('urgency', e.target.value)}>
            {URGENCIES.map((u) => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <div className="md:col-span-4">
          <Field label="Instructions">
            <input className="input-field text-sm" placeholder="Fasting 8hr / Collect in red tube..." value={lab.instructions}
              onChange={(e) => update('instructions', e.target.value)} />
          </Field>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Print View ───────────────────────────────────────────────────────────────

const PrintHeader = ({ rx }) => (
  <div className="print:block hidden">
    <div className="border-b-2 border-primary pb-4 mb-4 flex justify-between items-start">
      <div>
        <h1 className="text-xl font-black text-primary font-montserrat">Likeson.in</h1>
        <p className="text-sm font-semibold">{rx?.doctor?.name}</p>
        <p className="text-xs text-gray-500">{rx?.doctor?.specialization} · Reg: {rx?.doctor?.registrationNumber}</p>
        <p className="text-xs text-gray-500">{rx?.doctor?.phone} · {rx?.doctor?.email}</p>
      </div>
      <div className="text-right">
        <p className="font-mono font-bold text-primary text-sm">RX# {rx?.rxNumber}</p>
        <p className="text-xs text-gray-500">Issued: {formatDate(rx?.issuedAt)}</p>
        <p className="text-xs text-gray-500">Expires: {formatDate(rx?.expiresAt)}</p>
        {rx?.isDigitallySigned && <p className="text-xs text-green-600 font-bold">✓ Digitally Signed</p>}
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

function EPrescriptionContent() {
  const dispatch     = useDispatch();
  const router       = useRouter();
  const params       = useParams();
  const searchParams = useSearchParams();

  const prescriptionId = params?.id;
  const bookingId      = searchParams?.get('bookingId');
  const opId           = searchParams?.get('opId');
  const isCreateMode   = !prescriptionId;

  // Redux
  const rx          = useSelector(selectSelectedPrescription);
  const loadingGet  = useSelector(selectClinicalLoading('fetchPrescriptionById'));
  const loadingPost = useSelector(selectClinicalLoading('createPrescription'));
  const loadingPdf  = useSelector(selectClinicalLoading('downloadPrescriptionPdf'));
  const loadingCancel = useSelector(selectClinicalLoading('cancelPrescription'));
  const error       = useSelector(selectClinicalError(isCreateMode ? 'createPrescription' : 'fetchPrescriptionById'));

  // Form state
  const [patient, setPatient] = useState({
    name: '', age: '', gender: 'Male', phone: '', bloodGroup: 'Unknown',
    weight: '', allergies: [],
  });
  const [allergyInput, setAllergyInput] = useState('');
  const [diagnosis,        setDiagnosis]        = useState('');
  const [diagnosisCode,    setDiagnosisCode]    = useState('');
  const [chiefComplaints,  setChiefComplaints]  = useState(['']);
  const [clinicalFindings, setClinicalFindings] = useState('');
  const [advice,           setAdvice]           = useState('');
  const [referralNote,     setReferralNote]     = useState('');
  const [vitals,           setVitals]           = useState({ ...EMPTY_VITALS });
  const [medicines,        setMedicines]        = useState([{ ...EMPTY_MEDICINE }]);
  const [labTests,         setLabTests]         = useState([]);
  const [followUpDate,     setFollowUpDate]     = useState('');
  const [followUpInst,     setFollowUpInst]     = useState('');

  // Cancel modal
  const [showCancel,    setShowCancel]    = useState(false);
  const [cancelReason,  setCancelReason]  = useState('');

  // Fetch existing prescription
  useEffect(() => {
    if (prescriptionId) {
      dispatch(fetchPrescriptionById(prescriptionId));
    }
    return () => { dispatch(clearSelectedPrescription()); };
  }, [prescriptionId, dispatch]);

  // ─── Medicine handlers ────────────────────────────────────────────────────

  const addMedicine = () => setMedicines((p) => [...p, { ...EMPTY_MEDICINE }]);
  const removeMedicine = (idx) => setMedicines((p) => p.filter((_, i) => i !== idx));
  const updateMedicine = (idx, val) => setMedicines((p) => p.map((m, i) => i === idx ? val : m));

  // ─── Lab test handlers ────────────────────────────────────────────────────

  const addLab = () => setLabTests((p) => [...p, { ...EMPTY_LAB }]);
  const removeLab = (idx) => setLabTests((p) => p.filter((_, i) => i !== idx));
  const updateLab = (idx, val) => setLabTests((p) => p.map((l, i) => i === idx ? val : l));

  // ─── Complaint handlers ───────────────────────────────────────────────────

  const addComplaint = () => setChiefComplaints((p) => [...p, '']);
  const removeComplaint = (idx) => setChiefComplaints((p) => p.filter((_, i) => i !== idx));
  const updateComplaint = (idx, val) => setChiefComplaints((p) => p.map((c, i) => i === idx ? val : c));

  // ─── Allergy handlers ─────────────────────────────────────────────────────

  const addAllergy = () => {
    const v = allergyInput.trim();
    if (!v) return;
    setPatient((p) => ({ ...p, allergies: [...(p.allergies || []), v] }));
    setAllergyInput('');
  };
  const removeAllergy = (idx) =>
    setPatient((p) => ({ ...p, allergies: p.allergies.filter((_, i) => i !== idx) }));

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e) => {
    e.preventDefault();

    const body = {
      booking:          bookingId     || undefined,
      outPatientRecord: opId          || undefined,
      patient: {
        name:       patient.name,
        age:        patient.age       ? Number(patient.age)    : undefined,
        gender:     patient.gender    || undefined,
        phone:      patient.phone     || undefined,
        bloodGroup: patient.bloodGroup|| undefined,
        weight:     patient.weight    || undefined,
        allergies:  patient.allergies || [],
      },
      diagnosis,
      diagnosisCode,
      chiefComplaints: chiefComplaints.filter(Boolean),
      clinicalFindings,
      advice,
      referralNote,
      vitals: {
        bloodPressure:   vitals.bloodPressure   || undefined,
        pulseRate:       vitals.pulseRate       ? Number(vitals.pulseRate)       : undefined,
        temperature:     vitals.temperature     ? Number(vitals.temperature)     : undefined,
        spO2:            vitals.spO2            ? Number(vitals.spO2)            : undefined,
        bloodSugar:      vitals.bloodSugar      ? Number(vitals.bloodSugar)      : undefined,
        weightKg:        vitals.weightKg        ? Number(vitals.weightKg)        : undefined,
        heightCm:        vitals.heightCm        ? Number(vitals.heightCm)        : undefined,
        respiratoryRate: vitals.respiratoryRate ? Number(vitals.respiratoryRate) : undefined,
      },
      medicines: medicines.filter((m) => m.medicineName),
      labTests:  labTests.filter((l) => l.testName),
      followUpDate:         followUpDate || undefined,
      followUpInstructions: followUpInst || undefined,
    };

    const result = await dispatch(createPrescription(body));
    if (createPrescription.fulfilled.match(result)) {
      const newId = result.payload?._id;
      if (newId) router.replace(`/doctor/prescriptions/${newId}`);
    }
  };

  // ─── Cancel ───────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    await dispatch(cancelPrescription({ id: prescriptionId, reason: cancelReason }));
    setShowCancel(false);
    dispatch(fetchPrescriptionById(prescriptionId));
  };

  // ─── Render: VIEW mode ────────────────────────────────────────────────────

  if (!isCreateMode) {
    if (loadingGet) {
      return (
        <div data-theme="doctor" className="min-h-screen bg-base-100 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="loading loading-lg loading-spinner" />
            <p className="text-sm text-base-content/40">Loading prescription...</p>
          </div>
        </div>
      );
    }

    if (!rx) {
      return (
        <div data-theme="doctor" className="min-h-screen bg-base-100 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <AlertCircle size={40} className="text-error mx-auto" strokeWidth={1.5} />
            <p className="font-bold text-base-content">Prescription not found</p>
            <button className="btn btn-primary btn-sm" onClick={() => router.back()}>
              <ArrowLeft size={14} /> Go Back
            </button>
          </div>
        </div>
      );
    }

    return (
      <div data-theme="doctor" className="min-h-screen bg-base-100 text-base-content">
        <PrintHeader rx={rx} />

        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-strong border-b border-base-300 px-6 py-4 print:hidden"
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => router.back()}>
                <ArrowLeft size={16} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-black font-montserrat text-lg text-base-content">
                    {rx.rxNumber}
                  </h1>
                  <span className={`badge badge-sm ${statusColor(rx.status)}`}>
                    {rx.status}
                  </span>
                  {rx.isDigitallySigned && (
                    <span className="badge badge-sm badge-success gap-1">
                      <BadgeCheck size={10} /> Signed
                    </span>
                  )}
                </div>
                <p className="text-xs text-base-content/40">
                  Issued {formatDate(rx.issuedAt)} · Expires {formatDate(rx.expiresAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost btn-sm gap-1.5"
                onClick={() => window.print()}
              >
                <Printer size={14} /> Print
              </button>
              <button
                className="btn btn-outline btn-sm gap-1.5"
                disabled={loadingPdf}
                onClick={() => dispatch(downloadPrescriptionPdf(prescriptionId))}
              >
                {loadingPdf
                  ? <span className="loading loading-xs loading-spinner" />
                  : <Download size={14} />}
                PDF
              </button>
              {rx.status === 'issued' && (
                <button
                  className="btn btn-error btn-sm gap-1.5"
                  onClick={() => setShowCancel(true)}
                >
                  <XCircle size={14} /> Cancel Rx
                </button>
              )}
            </div>
          </div>
        </motion.div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5 print:px-0 print:py-0 print:space-y-3">

          {/* Doctor + Patient Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Doctor */}
            <Section icon={Stethoscope} title="Prescribing Doctor" accent="primary">
              <div className="space-y-2 text-sm">
                <InfoRow label="Name"         value={rx.doctor?.name} />
                <InfoRow label="Specialization" value={rx.doctor?.specialization} />
                <InfoRow label="Reg. Number"  value={rx.doctor?.registrationNumber} icon={<Hash size={11} />} mono />
                <InfoRow label="Council"      value={rx.doctor?.registrationCouncil} />
                <InfoRow label="Phone"        value={rx.doctor?.phone} icon={<Phone size={11} />} />
                <InfoRow label="Email"        value={rx.doctor?.email} icon={<Mail size={11} />} />
                {rx.hospital?.name && (
                  <InfoRow label="Hospital" value={rx.hospital.name} icon={<Hospital size={11} />} />
                )}
              </div>
            </Section>

            {/* Patient */}
            <Section icon={User} title="Patient Information" accent="secondary">
              <div className="space-y-2 text-sm">
                <InfoRow label="Name"        value={rx.patient?.name} />
                <InfoRow label="Age / Gender" value={[rx.patient?.age && `${rx.patient.age}y`, rx.patient?.gender].filter(Boolean).join(' · ')} />
                <InfoRow label="Phone"       value={rx.patient?.phone} icon={<Phone size={11} />} />
                <InfoRow label="Blood Group" value={rx.patient?.bloodGroup} />
                <InfoRow label="Weight"      value={rx.patient?.weight} />
                {rx.patient?.allergies?.length > 0 && (
                  <div>
                    <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-1">Allergies</p>
                    <div className="flex flex-wrap gap-1">
                      {rx.patient.allergies.map((a, i) => (
                        <span key={i} className="badge badge-xs badge-error">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          </div>

          {/* Clinical Context */}
          <Section icon={ClipboardList} title="Clinical Summary" accent="accent">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {rx.chiefComplaints?.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-1.5">Chief Complaints</p>
                  <ul className="space-y-1">
                    {rx.chiefComplaints.map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-base-content/80">
                        <span className="text-primary mt-0.5">·</span> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(rx.diagnosis || rx.diagnosisCode) && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-1.5">Diagnosis</p>
                  <p className="text-base-content font-semibold">{rx.diagnosis}</p>
                  {rx.diagnosisCode && (
                    <span className="badge badge-xs badge-primary font-mono mt-1">ICD-10: {rx.diagnosisCode}</span>
                  )}
                </div>
              )}
              {rx.clinicalFindings && (
                <div className="md:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-1.5">Clinical Findings</p>
                  <p className="text-base-content/80 leading-relaxed">{rx.clinicalFindings}</p>
                </div>
              )}
              {rx.advice && (
                <div className="md:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-1.5">Advice</p>
                  <p className="text-base-content/80 leading-relaxed">{rx.advice}</p>
                </div>
              )}
              {rx.referralNote && (
                <div className="md:col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-1.5">Referral Note</p>
                  <p className="text-base-content/80 leading-relaxed italic">{rx.referralNote}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Vitals */}
          {rx.vitals && Object.values(rx.vitals).some(Boolean) && (
            <Section icon={Activity} title="Vitals at Consultation" accent="info">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {rx.vitals.bloodPressure && <VitalChip icon={<Heart size={13} />} label="BP" value={`${rx.vitals.bloodPressure} mmHg`} />}
                {rx.vitals.pulseRate     && <VitalChip icon={<Activity size={13} />} label="Pulse" value={`${rx.vitals.pulseRate} bpm`} />}
                {rx.vitals.temperature   && <VitalChip icon={<Thermometer size={13} />} label="Temp" value={`${rx.vitals.temperature} °F`} />}
                {rx.vitals.spO2          && <VitalChip icon={<Droplets size={13} />} label="SpO₂" value={`${rx.vitals.spO2}%`} />}
                {rx.vitals.bloodSugar    && <VitalChip icon={<Activity size={13} />} label="Blood Sugar" value={`${rx.vitals.bloodSugar} mg/dL`} />}
                {rx.vitals.weightKg      && <VitalChip icon={<Weight size={13} />} label="Weight" value={`${rx.vitals.weightKg} kg`} />}
                {rx.vitals.heightCm      && <VitalChip icon={<Ruler size={13} />} label="Height" value={`${rx.vitals.heightCm} cm`} />}
                {rx.vitals.respiratoryRate && <VitalChip icon={<Wind size={13} />} label="RR" value={`${rx.vitals.respiratoryRate} /min`} />}
              </div>
            </Section>
          )}

          {/* Medicines */}
          {rx.medicines?.length > 0 && (
            <Section icon={Pill} title={`Medicines (${rx.medicines.length})`} accent="primary">
              <div className="space-y-3">
                {rx.medicines.map((m, i) => (
                  <MedicineRow key={i} med={m} idx={i} isView onChange={() => {}} onRemove={() => {}} />
                ))}
              </div>
            </Section>
          )}

          {/* Lab Tests */}
          {rx.labTests?.length > 0 && (
            <Section icon={FlaskConical} title={`Lab Tests (${rx.labTests.length})`} accent="accent">
              <div className="space-y-2">
                {rx.labTests.map((l, i) => (
                  <LabRow key={i} lab={l} idx={i} isView onChange={() => {}} onRemove={() => {}} />
                ))}
              </div>
            </Section>
          )}

          {/* Follow Up */}
          {(rx.followUpDate || rx.followUpInstructions) && (
            <Section icon={CalendarDays} title="Follow-Up" accent="secondary">
              <div className="flex flex-wrap gap-6 text-sm">
                {rx.followUpDate && (
                  <div>
                    <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-1">Follow-up Date</p>
                    <p className="font-bold text-primary">{formatDate(rx.followUpDate)}</p>
                  </div>
                )}
                {rx.followUpInstructions && (
                  <div className="flex-1">
                    <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider mb-1">Instructions</p>
                    <p className="text-base-content/80">{rx.followUpInstructions}</p>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Metadata */}
          <div className="text-center text-xs text-base-content/30 py-4 print:block">
            <p>Generated by Likeson.in · RX# {rx.rxNumber} · {formatDate(rx.issuedAt)}</p>
            <p>This prescription is valid for 30 days from issue date.</p>
          </div>
        </div>

        {/* Cancel modal */}
        <AnimatePresence>
          {showCancel && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowCancel(false)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                className="bg-base-100 border border-base-300 rounded-2xl shadow-depth-lg w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2 rounded-xl bg-error/10">
                    <XCircle size={20} className="text-error" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base-content text-lg font-montserrat">Cancel Prescription</h3>
                    <p className="text-xs text-base-content/50">This action cannot be undone</p>
                  </div>
                </div>
                <Field label="Reason for Cancellation">
                  <textarea
                    className="input-field min-h-[80px] resize-none text-sm"
                    placeholder="Enter reason..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </Field>
                <div className="flex gap-3 mt-5">
                  <button className="btn btn-ghost flex-1" onClick={() => setShowCancel(false)} disabled={loadingCancel}>Keep</button>
                  <button className="btn btn-error flex-1 gap-1" onClick={handleCancel} disabled={loadingCancel || !cancelReason.trim()}>
                    {loadingCancel ? <span className="loading loading-xs loading-spinner" /> : <XCircle size={14} />}
                    Cancel Rx
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ─── Render: CREATE mode ─────────────────────────────────────────────────

  return (
    <div data-theme="doctor" className="min-h-screen bg-base-100 text-base-content">

      {/* Top bar */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-strong border-b border-base-300 px-6 py-4"
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => router.back()}>
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="font-black font-montserrat text-lg text-base-content leading-tight">
                New E-Prescription
              </h1>
              <p className="text-xs text-base-content/40">
                {bookingId ? `Booking: ${bookingId}` : opId ? `OP: ${opId}` : 'Standalone prescription'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.back()}>
              Discard
            </button>
            <button
              type="submit"
              form="rx-form"
              disabled={loadingPost}
              className="btn btn-primary btn-sm gap-1.5"
            >
              {loadingPost
                ? <span className="loading loading-xs loading-spinner" />
                : <Save size={14} />}
              Issue Prescription
            </button>
          </div>
        </div>
      </motion.div>

      <form id="rx-form" onSubmit={handleSubmit}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="alert alert-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </motion.div>
          )}

          {/* ── Patient Info ── */}
          <Section icon={User} title="Patient Information" accent="secondary">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="col-span-2 md:col-span-3 lg:col-span-2">
                <Field label="Full Name" required>
                  <input className="input-field" placeholder="Patient full name" value={patient.name}
                    onChange={(e) => setPatient((p) => ({ ...p, name: e.target.value }))} required />
                </Field>
              </div>
              <Field label="Age">
                <input type="number" min={0} max={150} className="input-field" placeholder="Age (years)"
                  value={patient.age} onChange={(e) => setPatient((p) => ({ ...p, age: e.target.value }))} />
              </Field>
              <Field label="Gender">
                <select className="input-field" value={patient.gender}
                  onChange={(e) => setPatient((p) => ({ ...p, gender: e.target.value }))}>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Phone">
                <input className="input-field" placeholder="+91 XXXXX" value={patient.phone}
                  onChange={(e) => setPatient((p) => ({ ...p, phone: e.target.value }))} />
              </Field>
              <Field label="Blood Group">
                <select className="input-field" value={patient.bloodGroup}
                  onChange={(e) => setPatient((p) => ({ ...p, bloodGroup: e.target.value }))}>
                  {BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <div className="col-span-2 md:col-span-3 lg:col-span-3">
                <Field label="Weight / Notes">
                  <input className="input-field" placeholder="65 kg, 170 cm..." value={patient.weight}
                    onChange={(e) => setPatient((p) => ({ ...p, weight: e.target.value }))} />
                </Field>
              </div>
              {/* Allergies */}
              <div className="col-span-2 md:col-span-3 lg:col-span-3">
                <Field label="Known Allergies">
                  <div className="flex gap-2">
                    <input className="input-field flex-1" placeholder="Add allergy and press Enter"
                      value={allergyInput} onChange={(e) => setAllergyInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }} />
                    <button type="button" className="btn btn-outline btn-sm px-3" onClick={addAllergy}>
                      <Plus size={14} />
                    </button>
                  </div>
                  {patient.allergies?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {patient.allergies.map((a, i) => (
                        <span key={i} className="badge badge-sm badge-error gap-1 cursor-pointer"
                          onClick={() => removeAllergy(i)}>
                          {a} <XCircle size={10} />
                        </span>
                      ))}
                    </div>
                  )}
                </Field>
              </div>
            </div>
          </Section>

          {/* ── Chief Complaints ── */}
          <Section icon={ClipboardList} title="Chief Complaints" accent="warning" collapsible>
            <div className="space-y-2">
              <AnimatePresence>
                {chiefComplaints.map((c, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-2"
                  >
                    <input className="input-field flex-1 text-sm"
                      placeholder={`Complaint ${i + 1}`}
                      value={c}
                      onChange={(e) => updateComplaint(i, e.target.value)} />
                    {chiefComplaints.length > 1 && (
                      <button type="button" className="btn btn-ghost btn-sm btn-circle text-error"
                        onClick={() => removeComplaint(i)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <button type="button" className="btn btn-ghost btn-sm gap-1 text-primary" onClick={addComplaint}>
                <Plus size={13} /> Add Complaint
              </button>
            </div>
          </Section>

          {/* ── Diagnosis ── */}
          <Section icon={BookOpen} title="Diagnosis & Clinical Notes" accent="primary">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Field label="Diagnosis">
                  <input className="input-field" placeholder="Primary diagnosis description" value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)} />
                </Field>
              </div>
              <Field label="ICD-10 Code" hint="e.g. J06.9, E11.9">
                <input className="input-field font-mono" placeholder="ICD-10 code" value={diagnosisCode}
                  onChange={(e) => setDiagnosisCode(e.target.value)} />
              </Field>
              <div className="md:col-span-3">
                <Field label="Clinical Findings">
                  <textarea className="input-field min-h-[80px] resize-none text-sm"
                    placeholder="Examination findings, test results, observations..."
                    value={clinicalFindings}
                    onChange={(e) => setClinicalFindings(e.target.value)} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Advice / Lifestyle Instructions">
                  <textarea className="input-field min-h-[72px] resize-none text-sm"
                    placeholder="Diet, rest, exercise, home care advice..."
                    value={advice}
                    onChange={(e) => setAdvice(e.target.value)} />
                </Field>
              </div>
              <Field label="Referral Note">
                <textarea className="input-field min-h-[72px] resize-none text-sm"
                  placeholder="Refer to specialist / facility..."
                  value={referralNote}
                  onChange={(e) => setReferralNote(e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* ── Vitals ── */}
          <Section icon={Activity} title="Vitals at Consultation" accent="info" collapsible>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'bloodPressure',   label: 'Blood Pressure',    placeholder: '120/80 mmHg', Icon: Heart       },
                { key: 'pulseRate',        label: 'Pulse Rate',        placeholder: '72 bpm',      Icon: Activity    },
                { key: 'temperature',      label: 'Temperature',       placeholder: '98.6 °F',     Icon: Thermometer },
                { key: 'spO2',             label: 'SpO₂',             placeholder: '98 %',        Icon: Droplets    },
                { key: 'bloodSugar',       label: 'Blood Sugar',       placeholder: 'mg/dL',       Icon: Activity    },
                { key: 'weightKg',         label: 'Weight (kg)',       placeholder: '65',          Icon: Weight      },
                { key: 'heightCm',         label: 'Height (cm)',       placeholder: '170',         Icon: Ruler       },
                { key: 'respiratoryRate',  label: 'Resp. Rate (/min)', placeholder: '16',          Icon: Wind        },
              ].map(({ key, label, placeholder, Icon }) => (
                <div key={key} className="relative">
                  <Field label={label}>
                    <div className="relative">
                      <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                      <input className="input-field pl-8 text-sm" placeholder={placeholder}
                        value={vitals[key]}
                        onChange={(e) => setVitals((v) => ({ ...v, [key]: e.target.value }))} />
                    </div>
                  </Field>
                </div>
              ))}
            </div>
          </Section>

          {/* ── Medicines ── */}
          <Section icon={Pill} title={`Medicines (${medicines.length})`} accent="primary">
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {medicines.map((med, i) => (
                  <MedicineRow key={i} med={med} idx={i}
                    onChange={updateMedicine} onRemove={removeMedicine} isView={false} />
                ))}
              </AnimatePresence>
              {medicines.length < 20 && (
                <button type="button"
                  className="btn btn-outline btn-sm gap-1.5 border-dashed w-full"
                  onClick={addMedicine}>
                  <Plus size={13} /> Add Medicine
                </button>
              )}
            </div>
          </Section>

          {/* ── Lab Tests ── */}
          <Section icon={FlaskConical} title={`Lab Tests (${labTests.length})`} accent="accent" collapsible>
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {labTests.map((lab, i) => (
                  <LabRow key={i} lab={lab} idx={i}
                    onChange={updateLab} onRemove={removeLab} isView={false} />
                ))}
              </AnimatePresence>
              <button type="button"
                className="btn btn-outline btn-sm gap-1.5 border-dashed w-full"
                onClick={addLab}>
                <Plus size={13} /> Add Lab Test
              </button>
            </div>
          </Section>

          {/* ── Follow-Up ── */}
          <Section icon={CalendarDays} title="Follow-Up" accent="secondary" collapsible>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Follow-Up Date">
                <input type="datetime-local" className="input-field text-sm"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)} />
              </Field>
              <Field label="Follow-Up Instructions">
                <input className="input-field text-sm"
                  placeholder="Return if symptoms persist, check BP..."
                  value={followUpInst}
                  onChange={(e) => setFollowUpInst(e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* Validation note */}
          <div className="alert alert-info text-sm">
            <Info size={15} />
            <span>
              At least one <strong>medicine</strong> or <strong>lab test</strong> is required.
              Prescription will be issued immediately upon submission.
            </span>
          </div>

          {/* Bottom submit */}
          <div className="flex justify-end gap-3 pb-8">
            <button type="button" className="btn btn-ghost" onClick={() => router.back()}>
              Discard
            </button>
            <button type="submit" disabled={loadingPost} className="btn btn-primary gap-2 px-8">
              {loadingPost
                ? <><span className="loading loading-sm loading-spinner" /> Issuing...</>
                : <><Save size={16} /> Issue Prescription</>}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

const InfoRow = ({ label, value, icon, mono }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-base-content/40 w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`flex items-center gap-1 text-base-content/80 text-sm ${mono ? 'font-mono' : ''}`}>
        {icon && <span className="text-base-content/30">{icon}</span>}
        {value}
      </span>
    </div>
  );
};

const VitalChip = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 bg-base-200 rounded-xl p-3 border border-base-300">
    <div className="p-1.5 rounded-lg bg-info/10 text-info shrink-0">{icon}</div>
    <div>
      <p className="text-xs text-base-content/40 font-semibold uppercase tracking-wider leading-tight">{label}</p>
      <p className="text-sm font-bold text-base-content leading-tight">{value}</p>
    </div>
  </div>
);

export default function EPrescription() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-base-100 flex items-center justify-center p-8"><div className="skeleton w-full max-w-4xl h-96 rounded-3xl" /></div>}>
      <EPrescriptionContent />
    </Suspense>
  );
}