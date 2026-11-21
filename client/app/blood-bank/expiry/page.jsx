'use client';

import { useEffect, useState, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Cell,
} from 'recharts';
import {
  AlertTriangle, Clock, Calendar, RefreshCw, Play, CheckCircle2,
  Droplets, ChevronRight, Flame, ShieldAlert, TrendingDown, X,
  PackageSearch, Activity, Zap,
} from 'lucide-react';
import {
  fetchMyInventory,
  runExpiryCheck,
} from '@/store/slices/bloodbankSlice';

/* ── constants ── */
const GROUP_COLORS = {
  'A+':'#ef4444','A-':'#f97316','B+':'#3b82f6','B-':'#6366f1',
  'AB+':'#8b5cf6','AB-':'#ec4899','O+':'#10b981','O-':'#14b8a6',
};

const URGENCY_CONFIG = {
  expired:    { label:'Expired',       color:'var(--error)',     bg:'bg-error/10',    border:'border-error/30',    icon: ShieldAlert, pulse: true  },
  critical:   { label:'Expires ≤3d',   color:'var(--error)',     bg:'bg-error/8',     border:'border-error/20',    icon: Flame,       pulse: true  },
  warning:    { label:'Expires 4–7d',  color:'var(--warning)',   bg:'bg-warning/10',  border:'border-warning/30',  icon: AlertTriangle, pulse:false },
  low:        { label:'Expires 8–14d', color:'var(--info)',      bg:'bg-info/10',     border:'border-info/30',     icon: Clock,       pulse: false },
  good:       { label:'Adequate',      color:'var(--success)',   bg:'bg-success/10',  border:'border-success/30',  icon: CheckCircle2,pulse: false },
};

function urgencyOf(inv) {
  const d3 = inv.expiringIn3Days ?? 0;
  const d7 = inv.expiringIn7Days ?? 0;
  if ((inv.expiredUnits ?? 0) > 0)                return 'expired';
  if (inv.isCriticalStock || d3 > 0)              return 'critical';
  if (inv.isLowStock || d7 > 0)                   return 'warning';
  if ((inv.availableUnits ?? 0) <= 3)             return 'low';
  return 'good';
}

const container = { hidden:{}, show:{ transition:{ staggerChildren:.06 } } };
const cardAnim  = { hidden:{ opacity:0, y:18 }, show:{ opacity:1, y:0, transition:{ duration:.35, ease:[.4,0,.2,1] } } };

/* ── Countdown Timer ── */
function Countdown({ date }) {
  const now  = new Date();
  const diff = new Date(date) - now;
  if (diff <= 0) return <span className="text-error text-xs font-bold">Expired</span>;
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return <span className={`text-xs font-bold ${days <= 3 ? 'text-error' : days <= 7 ? 'text-warning' : 'text-base-content/60'}`}>{days}d {hours}h</span>;
  return <span className="text-error text-xs font-bold animate-pulse">{hours}h left</span>;
}

/* ── Expiry Ring ── */
function ExpiryRing({ value, max, color, label, sub }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const r = 28, circ = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="var(--base-300)" strokeWidth="6" />
          <motion.circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
            transition={{ duration: .9, ease: 'easeOut', delay: .2 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black" style={{ color }}>{value}</span>
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-base-content/50 text-center leading-tight">{label}</p>
      {sub && <p className="text-[9px] text-base-content/30 text-center">{sub}</p>}
    </div>
  );
}

/* ── Slot Expiry Card ── */
function SlotExpiryCard({ inv, onRunCheck, checking }) {
  const urg  = urgencyOf(inv);
  const cfg  = URGENCY_CONFIG[urg];
  const Icon = cfg.icon;
  const color = GROUP_COLORS[inv.bloodGroup] ?? 'var(--primary)';
  const total = (inv.availableUnits ?? 0) + (inv.reservedUnits ?? 0) + (inv.expiredUnits ?? 0);

  return (
    <motion.div variants={cardAnim} whileHover={{ y:-3 }} whileTap={{ scale:.98 }}
      className={`glass-card p-4 relative overflow-hidden border ${cfg.border}`}>
      {/* urgency stripe */}
      <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: cfg.color }} />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white"
            style={{ background: color }}>
            {inv.bloodGroup}
          </div>
          <div>
            <p className="text-sm font-bold text-base-content leading-tight">{inv.bloodGroup}</p>
            <p className="text-xs text-base-content/50">{inv.component}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${cfg.bg} ${cfg.border}`}
          style={{ color: cfg.color }}>
          <Icon className={`w-3 h-3 ${cfg.pulse ? 'animate-pulse' : ''}`} />
          {cfg.label}
        </div>
      </div>

      {/* rings */}
      <div className="flex justify-around mb-3">
        <ExpiryRing value={inv.expiringIn3Days  ?? 0} max={total} color="var(--error)"   label="≤3d"    sub="Critical" />
        <ExpiryRing value={inv.expiringIn7Days  ?? 0} max={total} color="var(--warning)" label="≤7d"    sub="Warning"  />
        <ExpiryRing value={inv.expiredUnits     ?? 0} max={total} color="var(--error)"   label="Expired"                />
        <ExpiryRing value={inv.availableUnits   ?? 0} max={total} color="var(--success)" label="Available"              />
      </div>

      {/* next expiry */}
      {inv.nextExpiryAt && (
        <div className="flex items-center gap-2 px-3 py-2 bg-base-200/60 rounded-xl mb-3">
          <Calendar className="w-3.5 h-3.5 text-base-content/40 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-base-content/40 uppercase tracking-wide">Next Expiry</p>
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-base-content truncate">
                {new Date(inv.nextExpiryAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
              </p>
              <Countdown date={inv.nextExpiryAt} />
            </div>
          </div>
        </div>
      )}

      <motion.button whileTap={{ scale:.96 }}
        onClick={() => onRunCheck(inv._id)}
        disabled={checking === inv._id}
        className={`btn w-full btn-sm gap-1.5 ${urg === 'good' ? 'btn-ghost' : 'btn-primary'}`}>
        {checking === inv._id
          ? <span className="loading loading-xs loading-spinner" />
          : <><Play className="w-3.5 h-3.5" /> Run Expiry Check</>
        }
      </motion.button>
    </motion.div>
  );
}

/* ── Run All Confirm Modal ── */
function RunAllModal({ open, count, loading, onConfirm, onClose }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
          <motion.div className="absolute inset-0 bg-neutral/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity:0, scale:.94 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:.94 }}
            className="relative bg-base-100 rounded-2xl border border-base-300/60 shadow-depth-lg p-6 max-w-sm w-full z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-warning/15 flex items-center justify-center">
                <Zap className="w-6 h-6 text-warning" />
              </div>
              <div>
                <h3 className="font-montserrat font-black text-lg">Run All Checks?</h3>
                <p className="text-sm text-base-content/50">Will scan {count} inventory slot{count !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <p className="text-sm text-base-content/60 mb-5 leading-relaxed">
              This will sweep all inventory slots for expired units, update counts, and flag units expiring within 3 and 7 days.
            </p>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={onConfirm} disabled={loading} className="btn btn-primary flex-1 gap-1.5">
                {loading ? <span className="loading loading-sm loading-spinner" /> : <><Zap className="w-4 h-4" /> Run All</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Page ── */
function ExpiryCheckPageContent() {
  const dispatch     = useDispatch();
  const searchParams = useSearchParams();
  const { myInventory, loading } = useSelector(s => s.bloodBank);

  const [filterUrgency, setFilterUrgency] = useState('');
  const [checking,      setChecking]      = useState(null);
  const [checkingAll,   setCheckingAll]   = useState(false);
  const [showRunAll,    setShowRunAll]     = useState(false);
  const [lastRunAt,     setLastRunAt]      = useState(null);
  const [resultLog,     setResultLog]     = useState([]);  // { invId, result, ts }

  const preselected = searchParams.get('invId');

  useEffect(() => { dispatch(fetchMyInventory()); }, [dispatch]);

  const inv = myInventory ?? [];

  const filtered = inv.filter(i => !filterUrgency || urgencyOf(i) === filterUrgency);

  /* summary */
  const totalExpiring3  = inv.reduce((a,i) => a + (i.expiringIn3Days ?? 0), 0);
  const totalExpiring7  = inv.reduce((a,i) => a + (i.expiringIn7Days  ?? 0), 0);
  const totalExpired    = inv.reduce((a,i) => a + (i.expiredUnits      ?? 0), 0);
  const critSlots       = inv.filter(i => urgencyOf(i) === 'critical' || urgencyOf(i) === 'expired').length;

  /* bar chart: expiry summary per slot */
  const barData = inv.map(i => ({
    name:    `${i.bloodGroup}/${i.component?.slice(0,4)}`,
    exp3:    i.expiringIn3Days ?? 0,
    exp7:    (i.expiringIn7Days ?? 0) - (i.expiringIn3Days ?? 0),
    expired: i.expiredUnits ?? 0,
  })).filter(d => d.exp3 + d.exp7 + d.expired > 0);

  /* line chart: result log */
  const lineData = resultLog.slice(-10).map((r, idx) => ({
    idx: idx + 1,
    available:  r.result?.availableUnits   ?? 0,
    expired:    r.result?.expiredUnits     ?? 0,
  }));

  /* run single */
  const handleRunCheck = async (invId) => {
    setChecking(invId);
    const res = await dispatch(runExpiryCheck(invId));
    setChecking(null);
    setLastRunAt(new Date());
    if (res.payload?.result) {
      setResultLog(prev => [...prev, { invId, result: res.payload.result, ts: new Date() }]);
    }
    dispatch(fetchMyInventory());
  };

  /* run all */
  const handleRunAll = async () => {
    setCheckingAll(true);
    for (const slot of inv) {
      await dispatch(runExpiryCheck(slot._id));
    }
    setCheckingAll(false);
    setLastRunAt(new Date());
    setShowRunAll(false);
    dispatch(fetchMyInventory());
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* header */}
        <motion.div initial={{ opacity:0, y:-12 }} animate={{ opacity:1, y:0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="font-montserrat font-black text-2xl md:text-3xl text-base-content">Expiry Check</h1>
              {critSlots > 0 && (
                <motion.span
                  animate={{ scale:[1,1.12,1] }} transition={{ repeat:Infinity, duration:1.5 }}
                  className="bg-error text-error-content text-[10px] font-black px-2 py-0.5 rounded-full">
                  {critSlots} critical
                </motion.span>
              )}
            </div>
            <p className="text-sm text-base-content/50">
              Sweep inventory for expiring units
              {lastRunAt && <> · Last run: <span className="font-semibold">{lastRunAt.toLocaleTimeString()}</span></>}
            </p>
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale:.96 }} onClick={() => dispatch(fetchMyInventory())}
              className="btn btn-ghost btn-sm gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </motion.button>
            <motion.button whileTap={{ scale:.96 }} onClick={() => setShowRunAll(true)}
              className="btn btn-primary btn-sm gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Run All Checks
            </motion.button>
          </div>
        </motion.div>

        {/* alert banner */}
        {(totalExpired > 0 || totalExpiring3 > 0) && (
          <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }}
            className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-error/10 border border-error/30">
            <ShieldAlert className="w-5 h-5 text-error flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-error">Immediate Attention Required</p>
              <p className="text-xs text-error/80 mt-0.5">
                {totalExpired > 0 && <>{totalExpired} unit{totalExpired !== 1 ? 's' : ''} expired. </>}
                {totalExpiring3 > 0 && <>{totalExpiring3} unit{totalExpiring3 !== 1 ? 's' : ''} expiring within 3 days.</>}
              </p>
            </div>
          </motion.div>
        )}

        {/* summary stats */}
        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label:'Expired',       val: totalExpired,   color:'var(--error)',   icon: ShieldAlert },
            { label:'Expires ≤3 days', val: totalExpiring3, color:'var(--error)',   icon: Flame       },
            { label:'Expires ≤7 days', val: totalExpiring7, color:'var(--warning)', icon: AlertTriangle },
            { label:'Critical Slots',  val: critSlots,     color:'var(--secondary)', icon: Activity   },
          ].map(({ label, val, color, icon: Icon }) => (
            <motion.div key={label} variants={cardAnim}
              className="stat-card relative overflow-hidden group">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                style={{ background:`${color}0a` }} />
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
                style={{ background:`${color}18` }}>
                <Icon className="w-4.5 h-4.5" style={{ color }} />
              </div>
              <p className="stat-card-value" style={{ color }}>{val}</p>
              <p className="stat-card-label">{label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* expiry bar chart */}
          <motion.div initial={{ opacity:0, scale:.97 }} animate={{ opacity:1, scale:1 }} transition={{ delay:.1 }}
            className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Expiry Distribution by Slot</p>
            {barData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize:9, fill:'var(--base-content)', opacity:.45 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:9, fill:'var(--base-content)', opacity:.45 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background:'var(--base-200)', border:'1px solid var(--base-300)', borderRadius:'12px', fontSize:11 }} />
                    <Bar dataKey="expired" name="Expired"  fill="var(--error)"   radius={[4,4,0,0]} stackId="a" />
                    <Bar dataKey="exp3"    name="≤3 days"  fill="var(--error)"   radius={[0,0,0,0]} stackId="a" fillOpacity={.6} />
                    <Bar dataKey="exp7"    name="4–7 days" fill="var(--warning)" radius={[4,4,0,0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center">
                <div className="text-center">
                  <CheckCircle2 className="w-10 h-10 text-success/40 mx-auto mb-2" />
                  <p className="text-sm text-base-content/40">All units are healthy</p>
                </div>
              </div>
            )}
          </motion.div>

          {/* result log line chart */}
          <motion.div initial={{ opacity:0, scale:.97 }} animate={{ opacity:1, scale:1 }} transition={{ delay:.15 }}
            className="card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-3">Check Result History</p>
            {lineData.length > 1 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                    <XAxis dataKey="idx" tick={{ fontSize:9, fill:'var(--base-content)', opacity:.45 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize:9, fill:'var(--base-content)', opacity:.45 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background:'var(--base-200)', border:'1px solid var(--base-300)', borderRadius:'12px', fontSize:11 }} />
                    <Line type="monotone" dataKey="available" name="Available" stroke="var(--success)" strokeWidth={2} dot={{ r:3, fill:'var(--success)' }} />
                    <Line type="monotone" dataKey="expired"   name="Expired"   stroke="var(--error)"   strokeWidth={2} dot={{ r:3, fill:'var(--error)'   }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-3 text-center">
                <PackageSearch className="w-10 h-10 text-base-content/20" />
                <p className="text-sm text-base-content/40">Run checks to see history</p>
                <button onClick={() => setShowRunAll(true)} className="btn btn-primary btn-sm gap-1.5">
                  <Play className="w-3.5 h-3.5" /> Start
                </button>
              </div>
            )}
          </motion.div>
        </div>

        {/* urgency filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-base-content/40 uppercase tracking-widest">Filter:</span>
          <button onClick={() => setFilterUrgency('')}
            className={`text-xs font-bold px-3 py-1 rounded-full border transition-all
              ${!filterUrgency ? 'bg-primary text-primary-content border-transparent' : 'border-base-300/60 text-base-content/50 hover:border-primary/30'}`}>
            All · {inv.length}
          </button>
          {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => {
            const cnt = inv.filter(i => urgencyOf(i) === key).length;
            if (!cnt) return null;
            const Icon = cfg.icon;
            return (
              <button key={key} onClick={() => setFilterUrgency(filterUrgency === key ? '' : key)}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border transition-all
                  ${filterUrgency === key ? `${cfg.bg} border ${cfg.border}` : 'border-base-300/60 text-base-content/50 hover:border-primary/30'}`}
                style={filterUrgency === key ? { color: cfg.color } : {}}>
                <Icon className="w-3 h-3" />
                {cfg.label} · {cnt}
              </button>
            );
          })}
        </div>

        {/* cards grid */}
        {loading && !inv.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_,i) => <div key={i} className="skeleton h-64 rounded-2xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            className="flex flex-col items-center py-20 gap-3 text-center">
            <PackageSearch className="w-12 h-12 text-base-content/20" />
            <p className="font-semibold text-base-content/50">No slots match this filter</p>
            <button onClick={() => setFilterUrgency('')} className="btn btn-ghost btn-sm">Clear filter</button>
          </motion.div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered
              .sort((a,b) => {
                const order = { expired:0, critical:1, warning:2, low:3, good:4 };
                return (order[urgencyOf(a)] ?? 5) - (order[urgencyOf(b)] ?? 5);
              })
              .map(slot => (
                <SlotExpiryCard
                  key={slot._id}
                  inv={slot}
                  onRunCheck={handleRunCheck}
                  checking={checking}
                />
              ))
            }
          </motion.div>
        )}

        {/* result log table */}
        {resultLog.length > 0 && (
          <motion.div initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
            className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-base-300/60 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Check Results Log</p>
              <button onClick={() => setResultLog([])} className="text-xs text-base-content/40 hover:text-error transition-colors gap-1 flex items-center">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {['Slot','Available','Expiring 3d','Expiring 7d','Expired','Next Expiry','Run At'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...resultLog].reverse().map((r, i) => {
                    const slot = inv.find(s => s._id === r.invId);
                    return (
                      <motion.tr key={i} initial={{ opacity:0 }} animate={{ opacity:1 }} className="hover:bg-primary/5 transition-colors">
                        <td className="text-xs font-bold">{slot ? `${slot.bloodGroup} / ${slot.component}` : r.invId}</td>
                        <td><span className="text-success font-bold text-xs">{r.result?.availableUnits ?? '—'}</span></td>
                        <td><span className={`font-bold text-xs ${(r.result?.expiringIn3Days ?? 0) > 0 ? 'text-error' : 'text-base-content/50'}`}>{r.result?.expiringIn3Days ?? '—'}</span></td>
                        <td><span className={`font-bold text-xs ${(r.result?.expiringIn7Days ?? 0) > 0 ? 'text-warning' : 'text-base-content/50'}`}>{r.result?.expiringIn7Days ?? '—'}</span></td>
                        <td><span className={`font-bold text-xs ${(r.result?.expiredUnits ?? 0) > 0 ? 'text-error' : 'text-base-content/50'}`}>{r.result?.expiredUnits ?? '—'}</span></td>
                        <td className="text-xs text-base-content/50">
                          {r.result?.nextExpiryAt ? new Date(r.result.nextExpiryAt).toLocaleDateString() : '—'}
                        </td>
                        <td className="text-xs text-base-content/40">{r.ts.toLocaleTimeString()}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      <RunAllModal
        open={showRunAll}
        count={inv.length}
        loading={checkingAll}
        onConfirm={handleRunAll}
        onClose={() => setShowRunAll(false)}
      />
    </>
  );
}

export default function ExpiryCheckPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-base-100 flex items-center justify-center p-8"><div className="skeleton w-full max-w-4xl h-96 rounded-3xl" /></div>}>
      <ExpiryCheckPageContent />
    </Suspense>
  );
}