'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  FlaskConical, Plus, Search, X, CheckCircle2,
  AlertTriangle, Clock, Droplets, RefreshCw,
  ChevronDown, ChevronUp, User, CalendarDays,
  BadgeCheck, ShieldAlert, Trash2, ChevronRight,
  TestTube, Activity, Package, Beaker, ArrowLeft,
} from 'lucide-react';
import {
  fetchMyInventory,
  fetchInventorySlot,
  addBloodUnit,
  updateBloodUnit,
} from '@/store/slices/bloodbankSlice';

/* ─── CONSTANTS (match bloodUnitSchema exactly) ─── */

const UNIT_STATUSES = [
  'available', 'reserved', 'cross_matching', 'cross_matched',
  'dispatched', 'issued', 'transfused', 'expired',
  'discarded', 'quarantined', 'recalled',
];

const STORAGE_LOCATIONS = [
  'Refrigerator_1', 'Refrigerator_2', 'Refrigerator_3',
  'Freezer_1', 'Freezer_2', 'Platelet_Agitator',
  'Room_Temperature', 'Transport_Box', 'Mobile_Unit',
];

const SEPARATION_METHODS = [
  'Whole_Blood_Filtration', 'Apheresis', 'Centrifugation', 'Not_Applicable',
];

const TEST_KEYS = ['hiv', 'hbsAg', 'hcv', 'syphilis', 'malaria'];
const TEST_VALUES = ['Non-Reactive', 'Reactive', 'Pending', 'Not_Done'];
const CROSS_MATCH_RESULTS = ['Compatible', 'Incompatible', 'Pending'];

const STATUS_META = {
  available:     { color: 'var(--success)', bg: 'bg-success/10',   text: 'text-success',         border: 'border-success/30',  icon: CheckCircle2 },
  reserved:      { color: 'var(--warning)', bg: 'bg-warning/10',   text: 'text-warning',         border: 'border-warning/30',  icon: Clock },
  cross_matching:{ color: 'var(--info)',    bg: 'bg-info/10',      text: 'text-info',            border: 'border-info/30',     icon: TestTube },
  cross_matched: { color: 'var(--info)',    bg: 'bg-info/10',      text: 'text-info',            border: 'border-info/30',     icon: BadgeCheck },
  dispatched:    { color: 'var(--primary)', bg: 'bg-primary/10',   text: 'text-primary',         border: 'border-primary/20',  icon: Package },
  issued:        { color: 'var(--primary)', bg: 'bg-primary/10',   text: 'text-primary',         border: 'border-primary/20',  icon: BadgeCheck },
  transfused:    { color: 'var(--success)', bg: 'bg-success/10',   text: 'text-success',         border: 'border-success/30',  icon: Activity },
  expired:       { color: 'var(--error)',   bg: 'bg-error/10',     text: 'text-error',           border: 'border-error/30',    icon: ShieldAlert },
  discarded:     { color: 'var(--neutral)', bg: 'bg-base-300/60',  text: 'text-base-content/50', border: 'border-base-300',    icon: Trash2 },
  quarantined:   { color: 'var(--warning)', bg: 'bg-warning/10',   text: 'text-warning',         border: 'border-warning/30',  icon: AlertTriangle },
  recalled:      { color: 'var(--error)',   bg: 'bg-error/10',     text: 'text-error',           border: 'border-error/30',    icon: ShieldAlert },
};

const STATUS_NOTE = {
  available:     'Ready for reservation. Counted in availableUnits',
  reserved:      'Held for a request via reserveUnits(). In reservedUnits',
  cross_matching:'Sample sent for compatibility test',
  cross_matched: 'Cross-match result recorded',
  dispatched:    'In transit to hospital / patient',
  issued:        'Formally issued. In issuedUnits counter',
  transfused:    'Administered to patient. Terminal state',
  expired:       'Past expiresAt. Set by runExpiryCheck(). In expiredUnits',
  discarded:     'Damaged/contaminated. In discardedUnits',
  quarantined:   'Held for investigation. In quarantinedUnits',
  recalled:      'Post-issue recall. Set isRecalled=true instead',
};

/* ─── ANIMATION ─── */

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const row = { hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0, transition: { duration: .3, ease: [.4, 0, .2, 1] } } };

/* ─── HELPERS ─── */

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDT(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function NoteLabel({ text }) {
  return <p className="text-[9px] text-base-content/40 leading-tight mt-0.5">{text}</p>;
}

function UnitStatusBadge({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.quarantined;
  const Icon = m.icon;
  return (
    <span className={`badge ${m.bg} ${m.text} border ${m.border} gap-1 text-[10px]`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function TestResultDot({ value }) {
  if (!value || value === 'Pending') return <span className="text-base-content/30 text-xs">—</span>;
  const ok = value === 'Non-Reactive';
  const nd = value === 'Not_Done';
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
      ${ok ? 'bg-success/15 text-success' : nd ? 'bg-base-300/60 text-base-content/40' : 'bg-error/15 text-error'}`}>
      {ok ? 'NR' : nd ? 'ND' : 'R'}
    </span>
  );
}

/* ─── ADD UNIT MODAL ─── */

function AddUnitModal({ open, onClose, invId }) {
  const dispatch = useDispatch();
  const { loading } = useSelector(s => s.bloodBank);

  const [form, setForm] = useState({
    bagNumber: '', donorCode: '', donorName: '',
    collectedAt: '', collectedByStaff: '', volumeMl: '', donorHemoglobin: '',
    processedAt: '', processedBy: '', separationMethod: 'Not_Applicable',
    storageLocation: '', storageSlot: '', storageTemperatureC: '',
    expiresAt: '',
    testResults: { hiv: 'Pending', hbsAg: 'Pending', hcv: 'Pending', syphilis: 'Pending', malaria: 'Pending' },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setTest = (k, v) => setForm(p => ({ ...p, testResults: { ...p.testResults, [k]: v } }));

  const submit = async (e) => {
    e.preventDefault();
    await dispatch(addBloodUnit({ invId, unitData: form }));
    // Refresh the slot to get updated units[]
    dispatch(fetchInventorySlot(invId));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-neutral/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: .94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .94, y: 20 }}
            transition={{ duration: .22, ease: [.4, 0, .2, 1] }}
            className="relative bg-base-100 rounded-2xl border border-base-300/60 shadow-depth-lg w-full max-w-xl p-6 z-10 max-h-[92vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-montserrat font-black text-xl text-base-content">Add Blood Unit</h3>
                <p className="text-sm text-base-content/50 mt-0.5">Register a new bag to this inventory slot</p>
                <NoteLabel text="Unit held (isReleaseApproved=false) until testing complete + bank manager approves" />
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-300/60">
                <X className="w-4 h-4 text-base-content/60" />
              </button>
            </div>

            <form onSubmit={submit} className="flex flex-col gap-5">

              {/* Traceability */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2">Traceability</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1"><span className="label-text">Bag Number *</span></label>
                    <input required value={form.bagNumber}
                      onChange={e => set('bagNumber', e.target.value.toUpperCase())}
                      className="input-field" placeholder="BAG-001" />
                    <NoteLabel text="bagNumber — unique, stored uppercase" />
                  </div>
                  <div>
                    <label className="label mb-1"><span className="label-text">Donor Code</span></label>
                    <input value={form.donorCode}
                      onChange={e => set('donorCode', e.target.value.toUpperCase())}
                      className="input-field" placeholder="WALK-IN" />
                    <NoteLabel text="string ref only, no FK" />
                  </div>
                  <div className="col-span-2">
                    <label className="label mb-1"><span className="label-text">Donor Name</span></label>
                    <input value={form.donorName}
                      onChange={e => set('donorName', e.target.value)}
                      className="input-field" placeholder="Optional" />
                  </div>
                </div>
              </section>

              {/* Collection */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2">Collection</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1"><span className="label-text">Collected At *</span></label>
                    <input required type="datetime-local" value={form.collectedAt}
                      onChange={e => set('collectedAt', e.target.value)} className="input-field" />
                    <NoteLabel text="collectedAt — required, blood draw timestamp" />
                  </div>
                  <div>
                    <label className="label mb-1"><span className="label-text">Expires At *</span></label>
                    <input required type="datetime-local" value={form.expiresAt}
                      onChange={e => set('expiresAt', e.target.value)} className="input-field" />
                    <NoteLabel text="expiresAt — required, indexed" />
                  </div>
                  <div>
                    <label className="label mb-1"><span className="label-text">Volume (mL) *</span></label>
                    <input required type="number" min="50" max="500" value={form.volumeMl}
                      onChange={e => set('volumeMl', e.target.value)}
                      className="input-field" placeholder="450" />
                    <NoteLabel text="volumeMl — 50–500 mL" />
                  </div>
                  <div>
                    <label className="label mb-1"><span className="label-text">Collected By</span></label>
                    <input value={form.collectedByStaff}
                      onChange={e => set('collectedByStaff', e.target.value)}
                      className="input-field" placeholder="Staff name" />
                  </div>
                  <div className="col-span-2">
                    <label className="label mb-1"><span className="label-text">Hemoglobin (g/dL)</span></label>
                    <input type="number" step="0.1" min="0" value={form.donorHemoglobin}
                      onChange={e => set('donorHemoglobin', e.target.value)}
                      className="input-field" placeholder="e.g. 13.5" />
                    <NoteLabel text="donorHemoglobin — Hb at time of donation" />
                  </div>
                </div>
              </section>

              {/* Processing */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2">Processing</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1"><span className="label-text">Processed At</span></label>
                    <input type="datetime-local" value={form.processedAt}
                      onChange={e => set('processedAt', e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="label mb-1"><span className="label-text">Processed By</span></label>
                    <input value={form.processedBy}
                      onChange={e => set('processedBy', e.target.value)}
                      className="input-field" placeholder="Lab tech name" />
                  </div>
                  <div className="col-span-2">
                    <label className="label mb-1"><span className="label-text">Separation Method</span></label>
                    <select value={form.separationMethod}
                      onChange={e => set('separationMethod', e.target.value)} className="input-field">
                      {SEPARATION_METHODS.map(m => <option key={m}>{m}</option>)}
                    </select>
                    <NoteLabel text="separationMethod enum" />
                  </div>
                </div>
              </section>

              {/* Storage */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2">Storage</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1"><span className="label-text">Storage Location</span></label>
                    <select value={form.storageLocation}
                      onChange={e => set('storageLocation', e.target.value)} className="input-field">
                      <option value="">— Select —</option>
                      {STORAGE_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <NoteLabel text="enum: Refrigerator_1…Mobile_Unit" />
                  </div>
                  <div>
                    <label className="label mb-1"><span className="label-text">Slot</span></label>
                    <input value={form.storageSlot}
                      onChange={e => set('storageSlot', e.target.value)}
                      className="input-field" placeholder="Row 2 / Slot 5" />
                  </div>
                  <div className="col-span-2">
                    <label className="label mb-1"><span className="label-text">Temp (°C)</span></label>
                    <input type="number" step="0.1" value={form.storageTemperatureC}
                      onChange={e => set('storageTemperatureC', e.target.value)}
                      className="input-field" placeholder="e.g. 4" />
                    <NoteLabel text="storageTemperatureC — actual recorded (PRBC: 2–6°C, FFP: -25 to -18°C)" />
                  </div>
                </div>
              </section>

              {/* Test Results */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-1">
                  Initial Test Results
                </p>
                <NoteLabel text="NACO/ELISA screening. Unit not released until all Non-Reactive + isReleaseApproved=true" />
                <div className="flex flex-col gap-1.5 mt-2">
                  {TEST_KEYS.map(k => (
                    <div key={k} className="flex items-center justify-between px-3 py-2 bg-base-200/60 rounded-xl">
                      <span className="text-xs font-semibold text-base-content/70 uppercase">{k}</span>
                      <select value={form.testResults[k]}
                        onChange={e => setTest(k, e.target.value)}
                        className="text-[11px] bg-transparent border border-base-300/60 rounded-lg px-2 py-0.5 text-base-content/70 outline-none">
                        {TEST_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                  {loading ? <span className="loading loading-sm loading-spinner" /> : 'Add Unit'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── UNIT DETAIL DRAWER ─── */

function UnitDetailDrawer({ unit, invId, onClose }) {
  const dispatch = useDispatch();
  const { loading } = useSelector(s => s.bloodBank);
  const [tab, setTab] = useState('info');
  const [saving, setSaving] = useState(false);

  const [editStatus,          setEditStatus]         = useState('');
  const [testResults,         setTestResults]        = useState({});
  const [isTestingComplete,   setIsTestingComplete]  = useState(false);
  const [isReleaseApproved,   setIsReleaseApproved]  = useState(false);
  const [storageLocation,     setStorageLocation]    = useState('');
  const [storageSlot,         setStorageSlot]        = useState('');
  const [storageTemperatureC, setStorageTempC]       = useState('');
  const [crossMatchResult,    setCrossMatchResult]   = useState('');
  const [transfusedAt,        setTransfusedAt]       = useState('');
  const [transfusedBy,        setTransfusedBy]       = useState('');
  const [isRecalled,          setIsRecalled]         = useState(false);
  const [recallReason,        setRecallReason]       = useState('');
  const [notes,               setNotes]              = useState('');

  useEffect(() => {
    if (!unit) return;
    setEditStatus(unit.status ?? 'available');
    setTestResults(unit.testResults ?? {});
    setIsTestingComplete(unit.isTestingComplete ?? false);
    setIsReleaseApproved(unit.isReleaseApproved ?? false);
    setStorageLocation(unit.storageLocation ?? '');
    setStorageSlot(unit.storageSlot ?? '');
    setStorageTempC(unit.storageTemperatureC ?? '');
    setCrossMatchResult(unit.crossMatch?.result ?? '');
    setTransfusedAt(unit.transfusedAt ? new Date(unit.transfusedAt).toISOString().slice(0, 16) : '');
    setTransfusedBy(unit.transfusedBy ?? '');
    setIsRecalled(unit.isRecalled ?? false);
    setRecallReason(unit.recallReason ?? '');
    setNotes(unit.notes ?? '');
    setTab('info');
  }, [unit]);

  const save = async () => {
    setSaving(true);
    const allClear = TEST_KEYS.every(k => testResults[k] === 'Non-Reactive');
    await dispatch(updateBloodUnit({
      invId,
      unitId: unit._id,
      updateData: {
        status: editStatus,
        testResults: { ...testResults, allClear },
        isTestingComplete,
        isReleaseApproved,
        storageLocation,
        storageSlot,
        storageTemperatureC: storageTemperatureC !== '' ? +storageTemperatureC : undefined,
        crossMatch: crossMatchResult
          ? { ...unit.crossMatch, result: crossMatchResult, resultAt: new Date() }
          : unit.crossMatch,
        transfusedAt: transfusedAt || undefined,
        transfusedBy: transfusedBy || undefined,
        isRecalled,
        recallReason: isRecalled ? recallReason : undefined,
        recalledAt: isRecalled && !unit.recalledAt ? new Date() : unit.recalledAt,
        notes,
      },
    }));
    // Refresh slot after update so units[] reflects changes
    await dispatch(fetchInventorySlot(invId));
    setSaving(false);
    onClose();
  };

  if (!unit) return null;

  const daysLeft = unit.expiresAt
    ? Math.ceil((new Date(unit.expiresAt) - new Date()) / 86400000)
    : null;

  const allClear = TEST_KEYS.every(k => testResults[k] === 'Non-Reactive');

  return (
    <AnimatePresence>
      {unit && (
        <motion.div className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-neutral/40 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: .28, ease: [.4, 0, .2, 1] }}
            className="relative bg-base-100 border-l border-base-300/60 w-full max-w-sm h-full overflow-y-auto z-10 flex flex-col">

            {/* Header */}
            <div className="sticky top-0 z-10 bg-base-100/95 backdrop-blur-sm border-b border-base-300/60 px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-montserrat font-black text-lg text-base-content">{unit.bagNumber}</h3>
                  <NoteLabel text="bagNumber — unique physical bag label" />
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-300/60">
                  <X className="w-4 h-4 text-base-content/60" />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <UnitStatusBadge status={unit.status} />
                {unit.isReleaseApproved && (
                  <span className="badge bg-success/10 text-success border border-success/30 text-[10px] gap-1">
                    <BadgeCheck className="w-3 h-3" /> Released
                  </span>
                )}
                {unit.isRecalled && (
                  <span className="badge bg-error/10 text-error border border-error/30 text-[10px] gap-1">
                    <ShieldAlert className="w-3 h-3" /> Recalled
                  </span>
                )}
              </div>
              <div className="flex gap-1 mt-3">
                {['info', 'tests', 'status', 'recall'].map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg capitalize transition-colors
                      ${tab === t ? 'bg-primary text-primary-content' : 'text-base-content/40 hover:text-base-content'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">

              {/* ── INFO ── */}
              {tab === 'info' && (
                <>
                  {daysLeft !== null && daysLeft <= 7 && (
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border
                      ${daysLeft <= 0 ? 'bg-error/10 border-error/30 text-error' : 'bg-warning/10 border-warning/30 text-warning'}`}>
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <p className="text-xs font-semibold">
                        {daysLeft <= 0 ? 'Unit has expired!' : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                  )}

                  {/* Traceability */}
                  <FieldGroup title="Traceability">
                    <InfoRow icon={CalendarDays} label="Bag #"       val={unit.bagNumber}   note="bagNumber — uppercase unique" />
                    <InfoRow icon={User}         label="Donor Code"  val={unit.donorCode}   note="string ref, no FK. WALK-IN for unregistered" />
                    <InfoRow icon={User}         label="Donor Name"  val={unit.donorName}   note="optional display only" />
                  </FieldGroup>

                  {/* Collection */}
                  <FieldGroup title="Collection">
                    <InfoRow icon={CalendarDays} label="Collected"   val={fmtDT(unit.collectedAt)}  note="collectedAt — required" />
                    <InfoRow icon={User}         label="By"          val={unit.collectedByStaff}     note="collectedByStaff" />
                    <InfoRow icon={Droplets}     label="Volume"      val={unit.volumeMl ? `${unit.volumeMl} mL` : '—'} note="volumeMl — 50–500 mL" />
                    <InfoRow icon={Activity}     label="Hemoglobin"  val={unit.donorHemoglobin != null ? `${unit.donorHemoglobin} g/dL` : '—'} note="donorHemoglobin" />
                  </FieldGroup>

                  {/* Processing */}
                  <FieldGroup title="Processing">
                    <InfoRow icon={CalendarDays} label="Processed"   val={fmtDT(unit.processedAt)}  note="processedAt" />
                    <InfoRow icon={User}         label="By"          val={unit.processedBy}          note="processedBy — lab tech" />
                    <InfoRow icon={Beaker}       label="Method"      val={unit.separationMethod}     note="separationMethod enum" />
                  </FieldGroup>

                  {/* Storage — editable */}
                  <FieldGroup title="Storage (editable)">
                    <div className="pb-2">
                      <label className="label mb-1"><span className="label-text">Location</span></label>
                      <select value={storageLocation} onChange={e => setStorageLocation(e.target.value)} className="input-field">
                        <option value="">— None —</option>
                        {STORAGE_LOCATIONS.map(l => <option key={l}>{l}</option>)}
                      </select>
                      <NoteLabel text="storageLocation enum" />
                    </div>
                    <div className="pb-2">
                      <label className="label mb-1"><span className="label-text">Slot</span></label>
                      <input value={storageSlot} onChange={e => setStorageSlot(e.target.value)}
                        className="input-field" placeholder="Row 2 / Slot 5" />
                    </div>
                    <div className="pb-2">
                      <label className="label mb-1"><span className="label-text">Temp (°C)</span></label>
                      <input type="number" step="0.1" value={storageTemperatureC}
                        onChange={e => setStorageTempC(e.target.value)}
                        className="input-field" placeholder="e.g. 4" />
                      <NoteLabel text="storageTemperatureC — actual recorded" />
                    </div>
                  </FieldGroup>

                  {/* Expiry */}
                  <FieldGroup title="Expiry">
                    <InfoRow icon={CalendarDays} label="Expires At" val={fmtDT(unit.expiresAt)}
                      warn={daysLeft !== null && daysLeft <= 7}
                      note="expiresAt — required, indexed. Auto-expired by runExpiryCheck()" />
                  </FieldGroup>

                  {/* Issuance */}
                  {unit.issuedTo?.issuedAt && (
                    <FieldGroup title="Issuance">
                      <InfoRow icon={CalendarDays} label="Issued At" val={fmtDT(unit.issuedTo.issuedAt)} note="issuedTo.issuedAt" />
                      <InfoRow icon={User}         label="Issued By" val={unit.issuedTo.issuedBy}        note="issuedTo.issuedBy" />
                      {unit.issuedTo.receiptUrl && (
                        <div className="py-1.5 border-b border-base-300/40">
                          <a href={unit.issuedTo.receiptUrl} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary underline underline-offset-2">View Receipt</a>
                        </div>
                      )}
                    </FieldGroup>
                  )}

                  {/* Transfusion */}
                  <FieldGroup title="Transfusion">
                    <div className="pb-2">
                      <label className="label mb-1"><span className="label-text">Transfused At</span></label>
                      <input type="datetime-local" value={transfusedAt}
                        onChange={e => setTransfusedAt(e.target.value)} className="input-field" />
                      <NoteLabel text="transfusedAt — patient administration timestamp" />
                    </div>
                    <div className="pb-2">
                      <label className="label mb-1"><span className="label-text">Transfused By</span></label>
                      <input value={transfusedBy}
                        onChange={e => setTransfusedBy(e.target.value)}
                        className="input-field" placeholder="Clinician name" />
                    </div>
                  </FieldGroup>

                  {/* Notes */}
                  <div>
                    <label className="label mb-1"><span className="label-text">Notes</span></label>
                    <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                      className="input-field resize-none" placeholder="Internal notes…" />
                    <NoteLabel text="notes — free-text staff notes" />
                  </div>
                </>
              )}

              {/* ── TESTS ── */}
              {tab === 'tests' && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">NACO / ELISA Screening</p>
                    {allClear && (
                      <span className="badge bg-success/10 text-success border border-success/30 text-[10px] gap-1">
                        <CheckCircle2 className="w-3 h-3" /> All Clear
                      </span>
                    )}
                  </div>
                  <NoteLabel text="allClear auto-set when all 5 = Non-Reactive. Unit held until allClear + isReleaseApproved" />

                  <div className="flex flex-col gap-1.5">
                    {TEST_KEYS.map(k => (
                      <div key={k} className="flex items-center justify-between px-3 py-2.5 bg-base-200/60 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-base-content/80 uppercase">{k}</span>
                          <NoteLabel text={`testResults.${k}`} />
                        </div>
                        <div className="flex items-center gap-2">
                          <TestResultDot value={testResults[k]} />
                          <select value={testResults[k] ?? 'Pending'}
                            onChange={e => setTestResults(p => ({ ...p, [k]: e.target.value }))}
                            className="text-[11px] bg-base-100 border border-base-300/60 rounded-lg px-1.5 py-0.5 text-base-content/80 outline-none">
                            {TEST_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>

                  {unit.testResults?.testedAt && (
                    <div className="bg-base-200/60 rounded-xl p-3">
                      <p className="text-[10px] text-base-content/40 uppercase">Tested</p>
                      <p className="text-sm font-bold text-base-content mt-0.5">
                        {fmtDT(unit.testResults.testedAt)}
                        {unit.testResults.testedBy && ` · ${unit.testResults.testedBy}`}
                      </p>
                      <NoteLabel text="testResults.testedAt + testedBy" />
                    </div>
                  )}

                  {/* isTestingComplete + isReleaseApproved — critical gates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl p-3 border cursor-pointer transition-all
                      ${isTestingComplete ? 'bg-success/10 border-success/30' : 'bg-base-200/60 border-base-300/40'}`}
                      onClick={() => setIsTestingComplete(v => !v)}>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className={`w-4 h-4 ${isTestingComplete ? 'text-success' : 'text-base-content/30'}`} />
                        <p className="text-xs font-bold">Testing Complete</p>
                      </div>
                      <p className={`text-sm font-black mt-1 ${isTestingComplete ? 'text-success' : 'text-base-content/40'}`}>
                        {isTestingComplete ? 'YES' : 'NO'}
                      </p>
                      <NoteLabel text="isTestingComplete — all NACO screens done" />
                    </div>
                    <div className={`rounded-xl p-3 border cursor-pointer transition-all
                      ${isReleaseApproved ? 'bg-success/10 border-success/30' : 'bg-error/10 border-error/30'}`}
                      onClick={() => setIsReleaseApproved(v => !v)}>
                      <div className="flex items-center gap-1.5">
                        <BadgeCheck className={`w-4 h-4 ${isReleaseApproved ? 'text-success' : 'text-error'}`} />
                        <p className="text-xs font-bold">Release Approved</p>
                      </div>
                      <p className={`text-sm font-black mt-1 ${isReleaseApproved ? 'text-success' : 'text-error'}`}>
                        {isReleaseApproved ? 'APPROVED' : 'HELD'}
                      </p>
                      <NoteLabel text="isReleaseApproved — manager gate. Bumps availableUnits when true" />
                    </div>
                  </div>

                  {/* Cross-match */}
                  <div>
                    <label className="label mb-1"><span className="label-text">Cross-Match Result</span></label>
                    <select value={crossMatchResult}
                      onChange={e => setCrossMatchResult(e.target.value)} className="input-field">
                      <option value="">— Not performed —</option>
                      {CROSS_MATCH_RESULTS.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <NoteLabel text="crossMatch.result — Compatible|Incompatible|Pending" />
                  </div>

                  {unit.crossMatch?.requestId && (
                    <div className="bg-base-200/60 rounded-xl p-3">
                      <p className="text-[10px] text-base-content/40 uppercase">Cross-Match Request</p>
                      <p className="text-xs font-mono font-bold text-base-content mt-0.5 break-all">
                        {String(unit.crossMatch.requestId)}
                      </p>
                      {unit.crossMatch.sampleSentAt && (
                        <p className="text-[10px] text-base-content/40 mt-0.5">Sent: {fmtDT(unit.crossMatch.sampleSentAt)}</p>
                      )}
                      <NoteLabel text="crossMatch.requestId → BloodRequest ref" />
                    </div>
                  )}
                </>
              )}

              {/* ── STATUS ── */}
              {tab === 'status' && (
                <>
                  <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Update Status</p>
                  <NoteLabel text="Status drives counter adjustments: $inc availableUnits, reservedUnits etc." />
                  <div className="flex flex-col gap-1.5">
                    {UNIT_STATUSES.map(s => {
                      const m = STATUS_META[s];
                      const Icon = m.icon;
                      const sel = editStatus === s;
                      return (
                        <button key={s} type="button" onClick={() => setEditStatus(s)}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left
                            ${sel ? `${m.bg} ${m.text} ${m.border}` : 'border-base-300/60 text-base-content/50 hover:border-primary/30'}`}>
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold capitalize">{s}</p>
                            <NoteLabel text={STATUS_NOTE[s]} />
                          </div>
                          {sel && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── RECALL ── */}
              {tab === 'recall' && (
                <>
                  <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Recall Management</p>
                  <NoteLabel text="isRecalled + recallReason + recalledAt (auto-set on first recall)" />

                  <div className={`rounded-xl p-4 border cursor-pointer transition-all
                    ${isRecalled ? 'bg-error/10 border-error/30' : 'bg-base-200/60 border-base-300/40'}`}
                    onClick={() => setIsRecalled(v => !v)}>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className={`w-5 h-5 ${isRecalled ? 'text-error' : 'text-base-content/30'}`} />
                      <div>
                        <p className="text-sm font-black text-base-content">{isRecalled ? 'RECALLED' : 'Mark as Recalled'}</p>
                        <NoteLabel text="isRecalled — boolean flag, triggers recall workflow" />
                      </div>
                    </div>
                  </div>

                  {isRecalled && (
                    <div>
                      <label className="label mb-1"><span className="label-text">Recall Reason *</span></label>
                      <textarea rows={3} value={recallReason}
                        onChange={e => setRecallReason(e.target.value)}
                        className="input-field resize-none" placeholder="Reason…" />
                      <NoteLabel text="recallReason — mandatory when isRecalled=true" />
                    </div>
                  )}

                  {unit.recalledAt && (
                    <div className="bg-error/5 rounded-xl p-3 border border-error/20">
                      <p className="text-[10px] text-base-content/40 uppercase">Recalled At</p>
                      <p className="text-sm font-bold text-error mt-0.5">{fmtDT(unit.recalledAt)}</p>
                    </div>
                  )}

                  {unit.reservedFor && (
                    <div className="bg-warning/5 rounded-xl p-3 border border-warning/20">
                      <p className="text-[10px] text-base-content/40 uppercase">Reserved For Request</p>
                      <p className="text-xs font-mono font-bold text-warning mt-0.5 break-all">
                        {String(unit.reservedFor)}
                      </p>
                      {unit.reservedAt && (
                        <p className="text-[10px] text-base-content/40 mt-0.5">Since: {fmtDT(unit.reservedAt)}</p>
                      )}
                      <NoteLabel text="reservedFor — BloodRequest ObjectId. Set by reserveUnits()" />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Sticky save */}
            <div className="sticky bottom-0 bg-base-100/95 backdrop-blur-sm border-t border-base-300/60 px-5 py-4">
              <button onClick={save} disabled={saving || loading} className="btn btn-primary w-full">
                {saving ? <span className="loading loading-sm loading-spinner" /> : 'Save Changes'}
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Field group helpers ── */
function FieldGroup({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2">{title}</p>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, val, note, warn }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-base-300/40 last:border-0">
      <Icon className="w-3.5 h-3.5 text-base-content/40 flex-shrink-0 mt-0.5" />
      <div className="w-24 flex-shrink-0">
        <p className="text-xs text-base-content/50">{label}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold break-words ${warn ? 'text-warning' : val && val !== '—' ? 'text-base-content' : 'text-base-content/30'}`}>
          {val || '—'}
        </p>
        {note && <NoteLabel text={note} />}
      </div>
    </div>
  );
}

/* ─── TABLE ROW ─── */

function UnitTableRow({ unit, onClick }) {
  const daysLeft = unit.expiresAt
    ? Math.ceil((new Date(unit.expiresAt) - new Date()) / 86400000)
    : null;

  return (
    <motion.tr variants={row} onClick={() => onClick(unit)}
      className="cursor-pointer hover:bg-primary/5 transition-colors group">
      <td>
        <p className="font-mono text-xs font-bold text-base-content">{unit.bagNumber}</p>
        {unit.donorCode && <p className="text-[9px] text-base-content/40">{unit.donorCode}</p>}
      </td>
      <td><UnitStatusBadge status={unit.status} /></td>
      <td>
        {unit.testResults?.allClear === true
          ? <span className="flex items-center gap-1 text-success text-xs font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Clear</span>
          : unit.testResults?.allClear === false
          ? <span className="flex items-center gap-1 text-error text-xs font-semibold"><ShieldAlert className="w-3.5 h-3.5" /> React</span>
          : <span className="text-base-content/40 text-xs">Pending</span>
        }
      </td>
      <td>
        {unit.isReleaseApproved
          ? <span className="badge bg-success/10 text-success border border-success/30 badge-xs gap-1"><BadgeCheck className="w-3 h-3" />OK</span>
          : <span className="badge bg-warning/10 text-warning border border-warning/30 badge-xs">Held</span>
        }
      </td>
      <td className="text-xs text-base-content/60">{unit.volumeMl ? `${unit.volumeMl} mL` : '—'}</td>
      <td>
        {daysLeft !== null
          ? <span className={`text-xs font-semibold
              ${daysLeft <= 0 ? 'text-error' : daysLeft <= 3 ? 'text-warning' : daysLeft <= 7 ? 'text-warning/70' : 'text-base-content/60'}`}>
              {daysLeft <= 0 ? 'Expired' : `${daysLeft}d`}
            </span>
          : <span className="text-base-content/30 text-xs">—</span>
        }
      </td>
      <td className="text-xs text-base-content/50">{unit.donorCode || '—'}</td>
      <td className="text-xs text-base-content/50">{unit.storageLocation || '—'}</td>
      <td>
        {unit.isRecalled && (
          <span className="badge bg-error/10 text-error border border-error/30 badge-xs gap-1">
            <ShieldAlert className="w-3 h-3" /> Recalled
          </span>
        )}
      </td>
      <td>
        <ChevronRight className="w-4 h-4 text-base-content/20 group-hover:text-primary transition-colors" />
      </td>
    </motion.tr>
  );
}

/* ─── PAGE ─── */

function BloodUnitsPageContent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { myInventory, loading } = useSelector(s => s.bloodBank);

  const preselectedInvId = searchParams.get('invId');
  const [selectedInvId, setSelectedInvId] = useState(preselectedInvId ?? '');
  const [loadingSlot,   setLoadingSlot]   = useState(false);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterRelease, setFilterRelease] = useState('');
  const [showAdd,       setShowAdd]       = useState(false);
  const [selectedUnit,  setSelectedUnit]  = useState(null);
  const [expandChart,   setExpandChart]   = useState(true);

  // Load summary list first
  useEffect(() => { dispatch(fetchMyInventory()); }, [dispatch]);

  // When preselectedInvId changes, store it
  useEffect(() => {
    if (preselectedInvId) setSelectedInvId(preselectedInvId);
  }, [preselectedInvId]);

  // KEY FIX: fetch full slot (with units[]) whenever selectedInvId changes
  useEffect(() => {
    if (!selectedInvId) return;
    setLoadingSlot(true);
    dispatch(fetchInventorySlot(selectedInvId)).finally(() => setLoadingSlot(false));
  }, [selectedInvId, dispatch]);

  // FIX: After fetchInventorySlot, myInventory entry for this slot has units[]
  // Get currentInv from updated myInventory (includes units[])
  const currentInv = (myInventory ?? []).find(i =>
    i._id === selectedInvId ||
    (!selectedInvId && myInventory?.[0]?._id)
  ) ?? myInventory?.[0];

  // Auto-select first slot if none selected
  useEffect(() => {
    if (!selectedInvId && myInventory?.length > 0) {
      const firstId = myInventory[0]._id;
      setSelectedInvId(firstId);
    }
  }, [myInventory, selectedInvId]);

  const units = currentInv?.units ?? [];

  const filtered = units.filter(u => {
    const q = search.toLowerCase();
    return (
      (!search       || u.bagNumber?.toLowerCase().includes(q) || u.donorCode?.toLowerCase().includes(q) || u.donorName?.toLowerCase().includes(q)) &&
      (!filterStatus || u.status === filterStatus) &&
      (!filterRelease|| (filterRelease === 'approved' ? u.isReleaseApproved : !u.isReleaseApproved))
    );
  });

  /* Area chart — units collected per day */
  const byDate = filtered.reduce((acc, u) => {
    if (!u.collectedAt) return acc;
    const d = new Date(u.collectedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    acc[d] = (acc[d] ?? 0) + 1;
    return acc;
  }, {});
  const areaData = Object.entries(byDate).slice(-14).map(([date, count]) => ({ date, count }));

  /* Status distribution */
  const statusDist = UNIT_STATUSES
    .map(s => ({ name: s, value: units.filter(u => u.status === s).length }))
    .filter(d => d.value > 0);
  const PIE_COLORS = statusDist.map(d => STATUS_META[d.name]?.color ?? 'var(--primary)');

  const heldCount     = units.filter(u => !u.isReleaseApproved).length;
  const recalledCount = units.filter(u => u.isRecalled).length;
  const expiredCount  = units.filter(u => u.status === 'expired').length;
  const hasFilters    = search || filterStatus || filterRelease;

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* ── Header ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            {/* Go Back button */}
            <button
              onClick={() => router.back()}
              className="btn btn-ghost btn-sm gap-1.5 mb-2 -ml-1 text-base-content/60 hover:text-base-content">
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </button>
            <h1 className="font-montserrat font-black text-2xl md:text-3xl text-base-content">Blood Units</h1>
            <p className="text-sm text-base-content/50 mt-0.5">
              Individual bag tracking · {filtered.length} unit{filtered.length !== 1 ? 's' : ''} shown · {units.length} total
            </p>
            <NoteLabel text="units[] — sub-docs of BloodInventory. Max 500/slot. Each = one physical blood bag." />
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: .96 }}
              onClick={() => { if (selectedInvId) { setLoadingSlot(true); dispatch(fetchInventorySlot(selectedInvId)).finally(() => setLoadingSlot(false)); } }}
              className="btn btn-ghost btn-sm gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${(loading || loadingSlot) ? 'animate-spin' : ''}`} />
            </motion.button>
            <motion.button whileTap={{ scale: .96 }} onClick={() => setShowAdd(true)}
              disabled={!currentInv}
              className="btn btn-primary btn-sm gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Unit
            </motion.button>
          </div>
        </motion.div>

        {/* ── Alert banners ── */}
        {recalledCount > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-error/10 border border-error/30">
            <ShieldAlert className="w-5 h-5 text-error flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-error">{recalledCount} unit{recalledCount !== 1 ? 's' : ''} under recall</p>
              <NoteLabel text="isRecalled=true — post-issue safety recall. Action required." />
            </div>
          </motion.div>
        )}

        {heldCount > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-warning">{heldCount} unit{heldCount !== 1 ? 's' : ''} awaiting release approval</p>
              <NoteLabel text="isReleaseApproved=false — bank manager must approve before issue" />
            </div>
          </motion.div>
        )}

        {/* ── Slot selector + Area chart ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Slot selector */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .05 }}
            className="card p-4 flex flex-col gap-3 lg:col-span-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Select Slot</p>
              <NoteLabel text="One BloodInventory doc per bloodGroup + component" />
            </div>
            {loading && !myInventory?.length ? (
              <div className="flex flex-col gap-1.5">
                {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto scrollbar-thin pr-1">
                {(myInventory ?? []).map(inv => {
                  const active = selectedInvId === inv._id || (!selectedInvId && myInventory?.[0]?._id === inv._id);
                  return (
                    <button key={inv._id}
                      onClick={() => setSelectedInvId(inv._id)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all text-sm font-semibold border
                        ${active
                          ? 'bg-primary text-primary-content border-transparent shadow-primary'
                          : 'border-base-300/60 hover:bg-primary/8 text-base-content'}`}>
                      <span className="font-black text-base">{inv.bloodGroup}</span>
                      <span className="truncate text-xs">{inv.component}</span>
                      <div className="ml-auto text-right">
                        <p className="text-xs opacity-70">{inv.availableUnits ?? 0} avail</p>
                        {inv.isCriticalStock && <p className="text-[9px] text-error font-bold">CRITICAL</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Area chart */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .1 }}
            className="card p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">
                  Units Collected (last 14 days)
                </p>
                <NoteLabel text="Grouped by collectedAt date" />
              </div>
              <button onClick={() => setExpandChart(v => !v)} className="text-base-content/40 hover:text-base-content">
                {expandChart ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
            <AnimatePresence>
              {expandChart && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 160, opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  {loadingSlot ? (
                    <div className="h-36 flex items-center justify-center">
                      <span className="loading loading-md loading-spinner" style={{ color: 'var(--primary)' }} />
                    </div>
                  ) : areaData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={150}>
                      <AreaChart data={areaData}>
                        <defs>
                          <linearGradient id="unitGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: .4 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: .4 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: '12px', fontSize: 11 }} />
                        <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} fill="url(#unitGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-36 flex items-center justify-center text-sm text-base-content/30">No collection data yet</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Status pie + filters ── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .15 }}
            className="card p-4 flex flex-col">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-1">Status Mix</p>
              <NoteLabel text="All 11 unit statuses from UNIT_STATUSES enum" />
            </div>
            {statusDist.length > 0 ? (
              <div className="h-32 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDist} cx="50%" cy="50%" innerRadius={32} outerRadius={52}
                      paddingAngle={3} dataKey="value">
                      {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: '12px', fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-sm text-base-content/30">
                {loadingSlot ? <span className="loading loading-sm loading-spinner" style={{ color: 'var(--primary)' }} /> : 'No units'}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 mt-1">
              {statusDist.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-[9px] text-base-content/50">{d.name} {d.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .18 }}
            className="card p-4 flex flex-col gap-3 lg:col-span-3">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Filters</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                <input placeholder="Search bag number, donor code or name…"
                  className="input-field pl-9" value={search}
                  onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="sm:w-44">
                <select className="input-field" value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  {UNIT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="sm:w-40">
                <select className="input-field" value={filterRelease}
                  onChange={e => setFilterRelease(e.target.value)}>
                  <option value="">All Releases</option>
                  <option value="approved">Released</option>
                  <option value="held">Held</option>
                </select>
              </div>
            </div>
            <NoteLabel text="Filters: bagNumber, donorCode, donorName — status enum (11) — isReleaseApproved" />

            {/* Quick status chips */}
            <div className="flex gap-2 flex-wrap">
              {UNIT_STATUSES.map(s => {
                const m = STATUS_META[s];
                const cnt = units.filter(u => u.status === s).length;
                if (!cnt) return null;
                return (
                  <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                    className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all
                      ${filterStatus === s ? `${m.bg} ${m.text} ${m.border}` : 'border-base-300/60 text-base-content/50 hover:border-primary/30'}`}>
                    {s} · {cnt}
                  </button>
                );
              })}
            </div>

            {hasFilters && (
              <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterRelease(''); }}
                className="btn btn-ghost btn-sm self-start gap-1 text-error">
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </motion.div>
        </div>

        {/* ── Table ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2 }}
          className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bag #<NoteLabel text="bagNumber" /></th>
                  <th>Status<NoteLabel text="status (11 enum)" /></th>
                  <th>Tests<NoteLabel text="testResults.allClear" /></th>
                  <th>Released<NoteLabel text="isReleaseApproved" /></th>
                  <th>Vol<NoteLabel text="volumeMl" /></th>
                  <th>Expires<NoteLabel text="expiresAt (days left)" /></th>
                  <th>Donor<NoteLabel text="donorCode" /></th>
                  <th>Storage<NoteLabel text="storageLocation" /></th>
                  <th>Recall<NoteLabel text="isRecalled" /></th>
                  <th />
                </tr>
              </thead>
              <motion.tbody variants={container} initial="hidden" animate="show">
                {loadingSlot && !units.length ? (
                  <tr><td colSpan={10}>
                    <div className="flex flex-col gap-2 p-4">
                      {Array(5).fill(0).map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
                    </div>
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10}>
                    <div className="flex flex-col items-center py-16 gap-3">
                      <FlaskConical className="w-10 h-10 text-base-content/20" />
                      <p className="text-sm text-base-content/40 font-semibold">
                        {units.length === 0
                          ? (loadingSlot ? 'Loading units…' : 'No units in this slot yet')
                          : 'No units match filters'}
                      </p>
                      {units.length === 0 && !loadingSlot && currentInv && (
                        <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm gap-1.5">
                          <Plus className="w-3.5 h-3.5" /> Add First Unit
                        </button>
                      )}
                    </div>
                  </td></tr>
                ) : (
                  filtered.map(unit => (
                    <UnitTableRow key={unit._id} unit={unit} onClick={setSelectedUnit} />
                  ))
                )}
              </motion.tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-base-300/60 text-xs text-base-content/40 flex items-center justify-between">
              <span>Showing {filtered.length} of {units.length} units</span>
              {expiredCount > 0 && (
                <span className="text-error font-semibold">{expiredCount} expired</span>
              )}
            </div>
          )}
        </motion.div>
      </div>

      <AddUnitModal open={showAdd} onClose={() => setShowAdd(false)} invId={currentInv?._id} />
      <UnitDetailDrawer unit={selectedUnit} invId={currentInv?._id} onClose={() => setSelectedUnit(null)} />
    </>
  );
}

export default function BloodUnitsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-base-100 flex items-center justify-center p-8"><div className="skeleton w-full max-w-4xl h-96 rounded-3xl" /></div>}>
      <BloodUnitsPageContent />
    </Suspense>
  );
}