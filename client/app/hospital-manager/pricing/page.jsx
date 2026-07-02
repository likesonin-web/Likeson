'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  IndianRupee, Stethoscope, RefreshCw, Save,
  AlertTriangle, CheckCircle2, Info, Edit3,
  TrendingUp, Percent, Clock, ChevronDown,
  Loader2, Users, SearchX,
  MonitorSmartphone, Home, Building2, Video,
  ChevronRight, Landmark, ToggleLeft, ToggleRight,
} from 'lucide-react';

import {
  fetchLinkedDoctors,
  fetchHospitalPricing,
  updateHospitalPricing,
  selectLinkedDoctors,
  selectHospitalPricing,
  selectHospitalPricingPlatformFee,
  isLoading,
  getError,
} from '@/store/slices/hospitalManagerSlice';

// ─── animation presets ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.38, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n ?? 0);

const clamp = (val, min, max) => Math.min(Math.max(Number(val) || 0, min), max);

const marginPct = (fee, hon) =>
  fee > 0 ? ((1 - (hon ?? 0) / fee) * 100).toFixed(1) : '0.0';

const fmtPlatformFee = (pf) => {
  if (!pf?.value) return '—';
  return pf.type === 'percentage' ? `${pf.value}%` : fmt(pf.value);
};

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, accentVar, index = 0 }) {
  return (
    <motion.div variants={fadeUp} custom={index} className="card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-[var(--r-field)]"
          style={{ background: `color-mix(in srgb, ${accentVar}, transparent 85%)` }}
        >
          <Icon size={17} style={{ color: accentVar }} />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">
          {label}
        </span>
      </div>
      <div>
        <p className="font-montserrat text-[1.6rem] font-black text-base-content leading-none">
          {value}
        </p>
        {sub && <p className="mt-1 text-[10px] text-base-content/50">{sub}</p>}
      </div>
    </motion.div>
  );
}

function SectionTitle({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--r-field)] bg-primary/10">
        <Icon size={15} className="text-primary" />
      </span>
      <div>
        <h3 className="font-montserrat text-sm font-bold text-base-content leading-snug">
          {title}
        </h3>
        {desc && <p className="text-[10px] text-base-content/50 mt-0.5 leading-relaxed">{desc}</p>}
      </div>
    </div>
  );
}

function RupeeInput({ label, value, onChange, min = 0, max = 99999, disabled = false, helper, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={[
          'flex items-center rounded-[var(--r-field)] border overflow-hidden transition-colors duration-200',
          disabled
            ? 'bg-base-300/50 border-base-300 opacity-55 cursor-not-allowed'
            : error
              ? 'bg-base-200 border-error focus-within:ring-2 focus-within:ring-error/20'
              : 'bg-base-200 border-base-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        ].join(' ')}
      >
        <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40 shrink-0">
          <IndianRupee size={13} className="text-base-content/45" />
        </span>
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === '' ? null : clamp(e.target.value, min, max))}
          className="flex-1 h-10 bg-transparent px-3 text-xs font-semibold text-base-content outline-none
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
                     [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
      {error  && <p className="text-[10px] text-error font-medium">{error}</p>}
      {!error && helper && <p className="text-[10px] text-base-content/40">{helper}</p>}
    </div>
  );
}

function PercentInput({ label, value, onChange, min = 0, max = 100, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={[
          'flex items-center rounded-[var(--r-field)] border overflow-hidden transition-colors duration-200',
          error
            ? 'bg-base-200 border-error focus-within:ring-2 focus-within:ring-error/20'
            : 'bg-base-200 border-base-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        ].join(' ')}
      >
        <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40 shrink-0">
          <Percent size={13} className="text-base-content/45" />
        </span>
        <input
          type="number"
          min={min}
          max={max}
          value={value ?? ''}
          onChange={(e) => onChange(clamp(e.target.value, min, max))}
          className="flex-1 h-10 bg-transparent px-3 text-xs font-semibold text-base-content outline-none
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="pr-3 text-[11px] text-base-content/45 font-medium">%</span>
      </div>
      {error && <p className="text-[10px] text-error font-medium">{error}</p>}
    </div>
  );
}

function DaysInput({ label, value, onChange, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">
        {label}
      </label>
      <div
        className={[
          'flex items-center rounded-[var(--r-field)] border overflow-hidden transition-colors duration-200',
          error
            ? 'bg-base-200 border-error focus-within:ring-2 focus-within:ring-error/20'
            : 'bg-base-200 border-base-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
        ].join(' ')}
      >
        <span className="flex items-center justify-center h-10 w-10 border-r border-base-300 bg-base-300/40 shrink-0">
          <Clock size={13} className="text-base-content/45" />
        </span>
        <input
          type="number"
          min={1}
          max={90}
          value={value ?? ''}
          onChange={(e) => onChange(clamp(e.target.value, 1, 90))}
          className="flex-1 h-10 bg-transparent px-3 text-xs font-semibold text-base-content outline-none
                     [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="pr-3 text-[10px] text-base-content/45 font-medium">days</span>
      </div>
      {error && <p className="text-[10px] text-error font-medium">{error}</p>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card p-3 text-[10px] shadow-depth min-w-[10rem]">
      <p className="font-bold text-base-content mb-2 text-xs">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 mb-1">
          <span className="flex items-center gap-1.5 text-base-content/65">
            <span className="h-2 w-2 rounded-full inline-block" style={{ background: p.fill }} />
            {p.name}
          </span>
          <span className="font-bold" style={{ color: p.fill }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── per-type fee row (fee + honorarium + enabled toggle) ────────────────────

const CONSULTATION_TYPES = [
  { key: 'inPerson',  label: 'In-Person',  Icon: Building2 },
  { key: 'video',     label: 'Video',      Icon: Video },
  { key: 'homeVisit', label: 'Home Visit', Icon: Home },
];

function PerTypeRow({ typeKey, label, Icon, form, set, errors }) {
  const feeKey     = `${typeKey}Fee`;
  const honKey     = `${typeKey}Honorarium`;
  const enabledKey = typeKey; // consultationTypes[typeKey]

  const fee     = form[feeKey];
  const hon     = form[honKey];
  const enabled = form.consultationTypes?.[enabledKey] ?? false;

  const margin = fee != null && hon != null ? Math.max(0, fee - hon) : null;

  return (
    <div className={[
      'rounded-[var(--r-field)] border p-4 transition-opacity',
      enabled ? 'border-base-300 bg-base-200/40' : 'border-base-300 bg-base-200/20 opacity-60',
    ].join(' ')}>
      <div className="flex items-center gap-2 mb-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--r-field)] bg-secondary/10">
          <Icon size={13} className="text-secondary" />
        </span>
        <span className="text-xs font-bold text-base-content">{label}</span>

        <button
          type="button"
          onClick={() => set('consultationTypes', { ...form.consultationTypes, [enabledKey]: !enabled })}
          className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
        >
          {enabled
            ? <ToggleRight size={22} className="text-success" />
            : <ToggleLeft size={22} className="text-base-content/30" />}
          <span className={enabled ? 'text-success' : 'text-base-content/40'}>
            {enabled ? 'Offered' : 'Not Offered'}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <RupeeInput
          label="Patient Fee"
          value={fee}
          onChange={(v) => set(feeKey, v)}
          min={0}
          disabled={!enabled}
          helper="Required if this visit type is offered"
          error={errors[feeKey]}
        />
        <RupeeInput
          label="Doctor's Payout (Honorarium)"
          value={hon}
          onChange={(v) => set(honKey, v)}
          min={0}
          disabled={!enabled}
          helper="Cannot exceed the Patient Fee"
          error={errors[honKey]}
        />
      </div>

      {margin !== null && fee > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <TrendingUp size={12} className="text-success" />
          <p className="text-[10px] text-base-content/60">
            Hospital Profit:{' '}
            <strong className="text-base-content">{fmt(margin)}</strong>
            <span className="text-base-content/45 ml-1">({marginPct(fee, hon)}%)</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// Note: pricing here is HOSPITAL-WIDE, not per-doctor. Hospital.consultationPricing
// is the single source of truth and applies uniformly to every doctor linked to
// this hospital (managementModel === 'hospital-manager'). There is no per-doctor
// fee override for this hospital type — the linked-doctor list below is shown
// purely as an informational "this pricing applies to N doctors" reference.
// ═══════════════════════════════════════════════════════════════════════════════

export default function Pricing() {
  const dispatch = useDispatch();

  // ── redux ──────────────────────────────────────────────────────────────────
  const doctors      = useSelector(selectLinkedDoctors);
  const pricingData  = useSelector(selectHospitalPricing); // { consultationPricing, platformFee, settlementCycle, note }
  const platformFee  = useSelector(selectHospitalPricingPlatformFee); // { type: 'fixed'|'percentage', value } — read-only, set by Likeson admin
  const loadingDocs  = useSelector(isLoading(fetchLinkedDoctors));
  const loadingPrice = useSelector(isLoading(fetchHospitalPricing));
  const saving       = useSelector(isLoading(updateHospitalPricing));
  const error        = useSelector(getError(fetchHospitalPricing));

  // ── local state ────────────────────────────────────────────────────────────
  const [dirty,          setDirty]          = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [validationErrs, setValidationErrs] = useState({});
  const [showChart,      setShowChart]      = useState(true);

  const EMPTY_FORM = {
    inPersonFee:             null,
    inPersonHonorarium:      null,
    videoFee:                null,
    videoHonorarium:         null,
    homeVisitFee:            null,
    homeVisitHonorarium:     null,
    followUpFee:             0,
    followUpDiscountPercent: 20,
    followUpValidDays:       7,
    consultationTypes: { inPerson: true, video: false, homeVisit: false },
  };

  const [form, setForm] = useState(EMPTY_FORM);

  const hydrateForm = useCallback((cp) => ({
    inPersonFee:             cp?.inPersonFee             ?? null,
    inPersonHonorarium:      cp?.inPersonHonorarium      ?? null,
    videoFee:                cp?.videoFee                ?? null,
    videoHonorarium:         cp?.videoHonorarium         ?? null,
    homeVisitFee:            cp?.homeVisitFee            ?? null,
    homeVisitHonorarium:     cp?.homeVisitHonorarium     ?? null,
    followUpFee:             cp?.followUpFee             ?? 0,
    followUpDiscountPercent: cp?.followUpDiscountPercent ?? 20,
    followUpValidDays:       cp?.followUpValidDays       ?? 7,
    consultationTypes: {
      inPerson:  cp?.consultationTypes?.inPerson  ?? true,
      video:     cp?.consultationTypes?.video     ?? false,
      homeVisit: cp?.consultationTypes?.homeVisit ?? false,
    },
  }), []);

  // ── effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    dispatch(fetchLinkedDoctors({ limit: 200 }));
    dispatch(fetchHospitalPricing());
  }, [dispatch]);

  useEffect(() => {
    if (pricingData?.consultationPricing) {
      setForm(hydrateForm(pricingData.consultationPricing));
      setDirty(false);
    }
  }, [pricingData, hydrateForm]);

  // ── field helpers ──────────────────────────────────────────────────────────

  const set = useCallback((key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setSaved(false);
    setValidationErrs(e => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  // ── validation (mirrors Hospital model pre-validate) ─────────────────────────

  const validate = () => {
    const errs = {};
    CONSULTATION_TYPES.forEach(({ key }) => {
      const enabled = form.consultationTypes?.[key];
      const fee = form[`${key}Fee`];
      const hon = form[`${key}Honorarium`];

      if (enabled && (fee == null || fee <= 0)) {
        errs[`${key}Fee`] = 'Required when this visit type is offered';
      }
      if (fee != null && hon != null && hon > fee) {
        errs[`${key}Honorarium`] = `Cannot exceed ${key} patient fee`;
      }
    });
    if (form.followUpValidDays < 1 || form.followUpValidDays > 90) {
      errs.followUpValidDays = 'Must be between 1 and 90 days';
    }
    if (form.followUpDiscountPercent < 0 || form.followUpDiscountPercent > 100) {
      errs.followUpDiscountPercent = 'Must be between 0% and 100%';
    }
    return errs;
  };

  // ── save / reset ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setValidationErrs(errs); return; }

    const result = await dispatch(updateHospitalPricing(form));

    if (!result.error) {
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleReset = () => {
    if (pricingData?.consultationPricing) {
      setForm(hydrateForm(pricingData.consultationPricing));
      setDirty(false);
      setValidationErrs({});
    }
  };

  // ── chart data ─────────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const rows = [];
    CONSULTATION_TYPES.forEach(({ key, label }) => {
      const fee = form[`${key}Fee`];
      const hon = form[`${key}Honorarium`];
      if (fee > 0) {
        rows.push({
          name: label,
          'Patient Fee': fee,
          "Doctor's Payout": hon ?? 0,
          'Hospital Profit': Math.max(0, fee - (hon ?? 0)),
        });
      }
    });
    return rows;
  }, [form]);

  const primaryFee = form.inPersonFee ?? form.videoFee ?? form.homeVisitFee ?? 0;
  const primaryHon = form.inPersonHonorarium ?? form.videoHonorarium ?? form.homeVisitHonorarium ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  if (loadingDocs || loadingPrice) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={30} className="text-primary animate-spin" />
        <p className="text-xs text-base-content/50 font-medium">Loading pricing…</p>
      </div>
    );
  }

  return (
    <motion.div
      className="flex h-[calc(100vh-4rem)] overflow-hidden bg-base-200"
      initial="hidden"
      animate="visible"
      variants={stagger}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR — informational only: linked doctors this pricing applies to
      ═════════════════════════════════════════════════════════════════════ */}
      <motion.aside
        variants={fadeUp}
        className="w-72 shrink-0 flex flex-col bg-base-100 border-r border-base-300
                   overflow-hidden xl:w-80"
      >
        <div className="px-4 pt-4 pb-3 border-b border-base-300 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Users size={14} className="text-primary" />
            <span className="font-montserrat font-black text-sm text-base-content">
              Linked Doctors
            </span>
            <span className="badge badge-primary badge-xs ml-auto">
              {doctors?.length ?? 0}
            </span>
          </div>
          <p className="text-[10px] text-base-content/45 leading-relaxed">
            Note: pricing below is hospital-wide and applies to every doctor
            listed here. There is no per-doctor pricing for this hospital type.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {!doctors?.length ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <SearchX size={28} className="text-base-300" />
              <p className="text-xs text-base-content/45">No doctors linked yet</p>
            </div>
          ) : (
            doctors.map(doctor => (
              <div
                key={doctor._id}
                className="flex items-center gap-3 px-4 py-3 border-b border-base-300/50"
              >
                <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0
                                font-bold text-xs text-primary-content"
                     style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
                  {(doctor.user?.name ?? '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-base-content truncate">
                    Dr. {doctor.user?.name ?? '—'}
                  </p>
                  <p className="text-[11px] text-base-content/50 truncate">
                    {doctor.specialization ?? '—'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.aside>

      {/* ══════════════════════════════════════════════════════════════════════
          DETAIL PANE — hospital-wide pricing form
      ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* ── top bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-6 py-3.5 bg-base-100
                        border-b border-base-300 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 bg-primary/10">
              <Stethoscope size={16} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-montserrat font-black text-sm text-base-content truncate">
                Hospital Consultation Pricing
              </p>
              <p className="text-[10px] text-base-content/50 truncate">
                Applies to all {doctors?.length ?? 0} linked doctor(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <AnimatePresence>
              {saved && !dirty && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-field)]
                             bg-success/10 border border-success/30"
                >
                  <CheckCircle2 size={12} className="text-success" />
                  <span className="text-[10px] font-semibold text-success">Saved</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {dirty && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <button onClick={handleReset} className="btn btn-sm btn-ghost text-xs">
                    <RefreshCw size={12} />
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-sm btn-primary text-xs"
                  >
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── dirty warning stripe ────────────────────────────────────── */}
        <AnimatePresence>
          {dirty && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-warning/10 border-b border-warning/30 overflow-hidden shrink-0"
            >
              <div className="flex items-center gap-2 px-6 py-2">
                <AlertTriangle size={12} className="text-warning" />
                <span className="text-[10px] font-semibold text-warning">
                  You have unsaved changes — this updates pricing for every linked doctor
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── scrollable content ─────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {error ? (
            <div className="m-6 flex flex-col items-center gap-3 rounded-[var(--r-box)]
                            border border-error/20 bg-error/5 py-12">
              <AlertTriangle size={22} className="text-error" />
              <p className="text-xs text-error font-medium text-center">{error}</p>
            </div>
          ) : (
            <motion.div initial="hidden" animate="visible" variants={stagger} className="p-6 space-y-6 pb-24">

              {/* ── info notice ─────────────────────────────────── */}
              <motion.div variants={fadeUp} className="alert alert-info rounded-[var(--r-box)] border-none">
                <Info size={16} className="text-info shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-base-content">How Pricing Works Here</p>
                  <p className="text-xs text-base-content/70 mt-1 leading-relaxed">
                    This hospital manages pricing centrally — one set of fees applies to
                    <strong> every doctor linked to this hospital</strong>. There is no
                    per-doctor override. Toggle a visit type "Offered" and set its Patient
                    Fee and Doctor's Payout below.
                  </p>
                  <p className="text-[10px] text-base-content/50 mt-2 flex items-center gap-1.5">
                    <Landmark size={11} className="text-base-content/40 shrink-0" />
                    Note: Likeson platform fee ({fmtPlatformFee(platformFee)}) is deducted
                    separately from the hospital's share at settlement — read-only, set by
                    Likeson admin, does not affect the doctor's payout above.
                  </p>
                </div>
              </motion.div>

              {/* ── KPI bar ─────────────────────────────────────── */}
              <motion.div variants={stagger} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  icon={IndianRupee}
                  label="Primary Visit Fee"
                  value={fmt(primaryFee)}
                  sub="First enabled visit type"
                  accentVar="var(--primary)"
                  index={0}
                />
                <KpiCard
                  icon={Stethoscope}
                  label="Doctor Payout"
                  value={fmt(primaryHon)}
                  sub="Honorarium, same visit type"
                  accentVar="var(--secondary)"
                  index={1}
                />
                <KpiCard
                  icon={RefreshCw}
                  label="Follow-Up"
                  value={form.followUpFee === 0 ? 'Free' : fmt(form.followUpFee)}
                  sub={`Valid for ${form.followUpValidDays} days`}
                  accentVar="var(--accent)"
                  index={2}
                />
                <KpiCard
                  icon={Landmark}
                  label="Platform Fee"
                  value={fmtPlatformFee(platformFee)}
                  sub="Set by Likeson · read-only"
                  accentVar="var(--warning)"
                  index={3}
                />
              </motion.div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

                {/* LEFT column */}
                <div className="space-y-6">
                  <motion.div variants={fadeUp} className="card p-6 border border-base-300">
                    <SectionTitle
                      icon={MonitorSmartphone}
                      title="Pricing by Visit Type"
                      desc="Set patient fee and doctor payout for each visit type this hospital offers. Toggle a type off to stop offering it."
                    />
                    <div className="space-y-4 mt-2">
                      {CONSULTATION_TYPES.map(ct => (
                        <PerTypeRow
                          key={ct.key}
                          typeKey={ct.key}
                          label={ct.label}
                          Icon={ct.Icon}
                          form={form}
                          set={set}
                          errors={validationErrs}
                        />
                      ))}
                    </div>
                  </motion.div>
                </div>

                {/* RIGHT column */}
                <div className="space-y-6">
                  <motion.div variants={fadeUp} className="card p-6 border border-base-300">
                    <SectionTitle
                      icon={Edit3}
                      title="Follow-Up Visit Rules"
                      desc="Define how much patients pay when returning, and how long the offer lasts."
                    />

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <RupeeInput
                        label="Follow-Up Cost"
                        value={form.followUpFee}
                        onChange={v => set('followUpFee', v ?? 0)}
                        helper="Enter 0 to make follow-ups free"
                      />
                      <PercentInput
                        label="Discount (%)"
                        value={form.followUpDiscountPercent}
                        onChange={v => set('followUpDiscountPercent', v)}
                        error={validationErrs.followUpDiscountPercent}
                      />
                    </div>

                    <DaysInput
                      label="Offer valid for (days after 1st visit)"
                      value={form.followUpValidDays}
                      onChange={v => set('followUpValidDays', v)}
                      error={validationErrs.followUpValidDays}
                    />
                    <p className="text-[10px] text-base-content/50 mt-1.5 font-medium">Choose between 1 and 90 days.</p>
                  </motion.div>

                  <motion.div variants={fadeUp} className="card p-6 border border-base-300">
                    <div className="flex items-center justify-between mb-1">
                      <SectionTitle
                        icon={TrendingUp}
                        title="Profit & Revenue Breakdown"
                        desc="Profit margin vs. patient fee and doctor payout, per offered visit type."
                      />
                      <button
                        onClick={() => setShowChart(s => !s)}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-base-content/50
                                   hover:text-primary transition-colors shrink-0 -mt-5"
                      >
                        {showChart
                          ? <><ChevronDown size={13} /> Hide Chart</>
                          : <><ChevronRight size={13} /> Show Chart</>}
                      </button>
                    </div>

                    <AnimatePresence>
                      {showChart && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden mt-4"
                        >
                          {chartData.length === 0 ? (
                            <p className="text-xs text-base-content/45 text-center py-8">
                              No visit types with a fee set yet.
                            </p>
                          ) : (
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={chartData} margin={{ top: 6, right: 4, left: 0, bottom: 0 }} barCategoryGap="35%">
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                                <XAxis
                                  dataKey="name"
                                  tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.7, fontWeight: 500 }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis
                                  tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }}
                                  axisLine={false}
                                  tickLine={false}
                                  tickFormatter={v => `₹${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                                />
                                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--base-300)', opacity: 0.15 }} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10, fontWeight: 500 }} />
                                <Bar dataKey="Patient Fee" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="Doctor's Payout" fill="var(--secondary)" radius={[3, 3, 0, 0]} />
                                <Bar dataKey="Hospital Profit" fill="var(--success)" radius={[3, 3, 0, 0]} opacity={0.85} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── mobile sticky save bar ───────────────────────────────────────────── */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 xl:hidden
                       flex items-center justify-between gap-3
                       rounded-full border border-base-300 bg-base-100/90 backdrop-blur-md
                       shadow-[var(--shadow-depth-lg)] px-5 py-3 w-[92%] max-w-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className="text-warning" />
              <span className="text-[10px] font-semibold text-base-content/65">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleReset} className="text-[10px] font-bold text-base-content/45 hover:text-base-content transition-colors">
                Reset
              </button>
              <button onClick={handleSave} disabled={saving} className="btn btn-sm btn-primary text-[10px] px-4 rounded-full">
                {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}