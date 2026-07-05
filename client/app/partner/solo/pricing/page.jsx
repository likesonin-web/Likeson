'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { FaWheelchair } from "react-icons/fa6";
import {
  IndianRupee,
  Clock,
  Moon,
  Car,
  Save,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Zap,
  Timer,
  Lock,
} from 'lucide-react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

import {
  fetchPricing,
  updatePricing,
  selectPricing,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';
import BackButton from '../../../../components/BackButton';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (v) => (v == null ? '—' : `₹${Number(v).toLocaleString('en-IN')}`);

const FIELDS = [
  {
    key: 'baseFare',
    label: 'Base Fare',
    icon: IndianRupee,
    unit: '₹',
    desc: 'Flat charge at trip start (before per-km billing)',
    min: 0,
    color: 'var(--primary)',
    adminOnly: true, // Locked by admin
  },
  {
    key: 'baseFarePerKm',
    label: 'Rate per KM',
    icon: Car,
    unit: '₹/km',
    desc: 'Amount charged for every kilometre driven',
    min: 0,
    color: 'var(--secondary)',
    adminOnly: true, // Locked by admin
  },
  {
    key: 'minimumFare',
    label: 'Minimum Fare',
    icon: IndianRupee,
    unit: '₹',
    desc: 'Floor price per ride — cannot be below ₹50',
    min: 50,
    color: 'var(--accent)',
    adminOnly: true, // Locked by admin
  },
  {
    key: 'waitingChargePerMin',
    label: 'Waiting Charge / Min',
    icon: Clock,
    unit: '₹/min',
    desc: 'Charged after the free waiting window expires',
    min: 0,
    color: 'var(--info)',
    adminOnly: false,
  },
  {
    key: 'freeWaitingMinutes',
    label: 'Free Waiting Minutes',
    icon: Timer,
    unit: 'min',
    desc: 'Grace window before waiting charges kick in',
    min: 0,
    color: 'var(--success)',
    adminOnly: false,
  },
  {
    key: 'nightSurchargePercent',
    label: 'Night Surcharge',
    icon: Moon,
    unit: '%',
    desc: 'Percentage added to fare during night hours',
    min: 0,
    color: 'var(--warning)',
    adminOnly: false,
  },
  {
    key: 'wheelchairSurcharge',
    label: 'Wheelchair Surcharge',
    icon: FaWheelchair,
    unit: '₹',
    desc: 'Additional charge for wheelchair-accessible service',
    min: 0,
    color: 'var(--error)',
    adminOnly: false,
  },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function FieldCard({ field, value, onChange, error }) {
  const Icon = field.icon;
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-5 flex flex-col gap-3 relative overflow-hidden ${field.adminOnly ? 'opacity-80' : ''}`}
    >
      {/* accent line */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-[var(--r-box)]"
        style={{ background: field.adminOnly ? 'color-mix(in srgb, var(--base-content) 30%, transparent)' : field.color }}
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex items-center justify-center w-9 h-9 rounded-[var(--r-field)]"
            style={{ background: `color-mix(in srgb, ${field.color}, transparent 85%)` }}
          >
            <Icon size={18} style={{ color: field.color }} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-base-content leading-tight">{field.label}</p>
              {field.adminOnly && (
                <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-base-300/50 text-base-content/60">
                  <Lock size={9} /> Admin Only
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
              {field.unit}
            </p>
          </div>
        </div>

        <div className="group relative">
          <Info size={14} className="text-base-content/40 cursor-help" />
          <div className="absolute right-0 top-6 z-20 w-52 p-3 text-xs rounded-[var(--r-field)] bg-neutral text-neutral-content opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
            {field.desc}
            {field.adminOnly && (
              <div className="mt-2 pt-2 border-t border-neutral-content/20 text-warning font-semibold flex items-center gap-1">
                <Lock size={10} /> This field can only be modified by an administrator.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        <input
          type="number"
          min={field.min}
          step="1"
          value={value ?? ''}
          onChange={(e) => {
            if (!field.adminOnly) onChange(field.key, e.target.value);
          }}
          onFocus={() => {
            if (!field.adminOnly) setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          disabled={field.adminOnly}
          className={`input-field w-full pr-16 text-right font-mono text-base font-bold transition-all ${
            field.adminOnly 
              ? 'bg-base-200/50 text-base-content/60 cursor-not-allowed border-base-300' 
              : ''
          }`}
          style={!field.adminOnly ? {
            borderColor: focused ? field.color : undefined,
            boxShadow: focused ? `0 0 0 3px color-mix(in srgb, ${field.color}, transparent 80%)` : undefined,
          } : undefined}
          placeholder="0"
        />
        <span
          className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold pointer-events-none"
          style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}
        >
          {field.unit}
        </span>
      </div>

      {error && !field.adminOnly && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center gap-1 text-xs"
          style={{ color: 'var(--error)' }}
        >
          <AlertCircle size={12} /> {error}
        </motion.p>
      )}
    </motion.div>
  );
}

function RadarPreview({ values }) {
  const data = FIELDS.map((f) => ({
    subject: f.label.split(' ')[0],
    value: Math.min(100, ((Number(values[f.key]) || 0) / (f.key === 'minimumFare' ? 10 : f.key === 'baseFare' ? 5 : f.key === 'baseFarePerKm' ? 5 : f.key === 'nightSurchargePercent' ? 1 : f.key === 'wheelchairSurcharge' ? 3 : 2)) * 10),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="color-mix(in srgb, var(--base-content), transparent 85%)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 60%, transparent)', fontFamily: 'var(--font-family-poppins)' }}
        />
        <Radar
          name="Your Pricing"
          dataKey="value"
          stroke="var(--primary)"
          fill="var(--primary)"
          fillOpacity={0.18}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--base-200)',
            border: '1px solid var(--base-300)',
            borderRadius: 'var(--r-field)',
            fontSize: 12,
            fontFamily: 'var(--font-family-poppins)',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function MyPricingConfig() {
  const dispatch = useDispatch();
  const pricing  = useSelector(selectPricing);
  const isLoading      = useSelector(selectLoading('pricing'));
  const isSaving       = useSelector(selectLoading('updatePricing'));
  const fetchError     = useSelector(selectError('pricing'));

  const [form, setForm]       = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    dispatch(fetchPricing());
  }, [dispatch]);

  useEffect(() => {
    if (pricing?.pricing) {
      const p = pricing.pricing;
      setForm({
        baseFare:              p.baseFare              ?? 0,
        baseFarePerKm:         p.baseFarePerKm         ?? 0,
        minimumFare:           p.minimumFare           ?? 500,
        waitingChargePerMin:   p.waitingChargePerMin   ?? 2,
        freeWaitingMinutes:    p.freeWaitingMinutes    ?? 10,
        nightSurchargePercent: p.nightSurchargePercent ?? 20,
        wheelchairSurcharge:   p.wheelchairSurcharge   ?? 100,
      });
    }
  }, [pricing]);

  const handleChange = (key, rawVal) => {
    const val = rawVal === '' ? '' : Number(rawVal);
    setForm((prev) => ({ ...prev, [key]: val }));

    // inline validation
    const field = FIELDS.find((f) => f.key === key);
    if (field && val !== '' && val < field.min) {
      setFieldErrors((prev) => ({ ...prev, [key]: `Must be at least ${field.min}` }));
    } else {
      setFieldErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });
    }
  };

  const validate = () => {
    const errs = {};
    for (const f of FIELDS) {
      if (f.adminOnly) continue; // Skip validation for read-only fields
      const v = Number(form[f.key]);
      if (isNaN(v) || v < f.min) errs[f.key] = `Must be ≥ ${f.min}`;
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const payload = {};
    // Only send fields that the driver is allowed to change
    for (const f of FIELDS) {
      if (!f.adminOnly) {
        payload[f.key] = Number(form[f.key]);
      }
    }
    const result = await dispatch(updatePricing(payload));
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleReset = () => {
    if (pricing?.pricing) {
      const p = pricing.pricing;
      setForm({
        baseFare:              p.baseFare              ?? 0,
        baseFarePerKm:         p.baseFarePerKm         ?? 0,
        minimumFare:           p.minimumFare           ?? 500,
        waitingChargePerMin:   p.waitingChargePerMin   ?? 2,
        freeWaitingMinutes:    p.freeWaitingMinutes    ?? 10,
        nightSurchargePercent: p.nightSurchargePercent ?? 20,
        wheelchairSurcharge:   p.wheelchairSurcharge   ?? 100,
      });
      setFieldErrors({});
    }
  };

  // ── loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="skeleton h-10 w-64 rounded-[var(--r-field)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton h-32 rounded-[var(--r-box)]" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{fetchError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <BackButton className=' my-2 rounded-md px-3' />
      
      {/* ── header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h3 className="font-display text-2xl font-black tracking-tight">My Pricing Config</h3>
          <p className="text-sm mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
            Set your surcharge preferences — these are additive to the platform base fare.
          </p>
        </div>

        {/* platform fee chip */}
        {pricing && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-[var(--r-field)] border border-base-300 bg-base-200 shrink-0">
            <Zap size={15} style={{ color: 'var(--primary)' }} />
            <span className="text-xs font-semibold text-base-content">Platform fee:</span>
            <span className="text-xs font-bold" style={{ color: 'var(--primary)' }}>
              {pricing.isUsingGlobalFee
                ? 'Global default'
                : pricing.effectivePlatformFee?.type === 'percentage'
                  ? `${pricing.effectivePlatformFee.value}%`
                  : `₹${pricing.effectivePlatformFee?.value} flat`}
            </span>
            {pricing.isUsingGlobalFee && (
              <span className="badge badge-info text-[10px] py-0.5 px-2">global</span>
            )}
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── form grid ── */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map((field, i) => (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <FieldCard
                field={field}
                value={form[field.key]}
                onChange={handleChange}
                error={fieldErrors[field.key]}
              />
            </motion.div>
          ))}
        </div>

        {/* ── sidebar ── */}
        <div className="flex flex-col gap-4">
          {/* radar preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} style={{ color: 'var(--primary)' }} />
              <span className="text-sm font-semibold">Pricing Radar</span>
            </div>
            <RadarPreview values={form} />
            <p className="text-xs text-center mt-2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              Visual representation of your pricing mix
            </p>
          </motion.div>

          {/* summary card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="card p-4 space-y-2"
          >
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--primary)' }}>
              Current Summary
            </p>
            {FIELDS.map((f) => (
              <div key={f.key} className="flex justify-between text-sm items-center">
                <span className="flex items-center gap-1.5" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                  {f.label}
                  {f.adminOnly && <Lock size={10} className="opacity-50" />}
                </span>
                <span className="font-semibold font-mono">
                  {form[f.key] !== '' && form[f.key] != null
                    ? f.unit.startsWith('₹')
                      ? `₹${Number(form[f.key]).toLocaleString('en-IN')}`
                      : f.unit === '%'
                        ? `${form[f.key]}%`
                        : `${form[f.key]} ${f.unit}`
                    : '—'}
                </span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── actions ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-center gap-3 pt-2"
      >
        <button
          onClick={handleSave}
          disabled={isSaving || Object.keys(fieldErrors).length > 0}
          className="btn-primary-cta flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="spinner w-4 h-4" />
          ) : saved ? (
            <CheckCircle2 size={16} />
          ) : (
            <Save size={16} />
          )}
          {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save Pricing'}
        </button>

        <button
          onClick={handleReset}
          disabled={isSaving}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={15} />
          Reset
        </button>

        <AnimatePresence>
          {saved && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--success)' }}
            >
              <CheckCircle2 size={15} /> Pricing updated successfully
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── info banner ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="alert alert-info text-sm flex-col sm:flex-row items-start gap-4"
      >
        <div className="flex items-start gap-3">
          <Info size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--info)' }} />
          <p>
            These are <strong>your surcharges</strong> on top of the platform base fare. The final amount billed to the
            customer = Platform base + your surcharges. The platform fee is deducted from your earnings separately.
          </p>
        </div>
        <div className="flex items-start gap-3 sm:border-l sm:border-info/30 sm:pl-4">
          <Lock size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--info)' }} />
          <p>
            Fields marked with an <strong>Admin Only</strong> badge are locked by platform rules and cannot be manually overridden.
          </p>
        </div>
      </motion.div>
    </div>
  );
}