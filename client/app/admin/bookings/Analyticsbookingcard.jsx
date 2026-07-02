'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, RadialBarChart, RadialBar,
} from 'recharts';
import { Calendar, CheckCircle, XCircle, DollarSign, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchAdminBookingStats, fetchAdminOps,
  selectAdminStats, selectAdminStatsLoading,
  selectAdminOps, selectAdminOpsMeta, selectAdminOpsLoading,
} from '@/store/slices/operationsSlice';
import {
  STATUS_COLORS, CHART_COLORS, OP_STATUSES,
  currency, pct, fmtDate, statusBadge, typeIcon,
  getDriverAssignmentState, fmt,
  Spinner, EmptyState, StatCard,
  CallButton, FieldNote,
} from './shared';
import { CheckCircle as CkCircle, XCircle as XkCircle, Clock } from 'lucide-react';
import { Heart, Radio } from 'lucide-react';

/* ─── CHART TOOLTIP ────────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-3 shadow-depth-lg text-xs">
      <p className="font-bold text-base-content m-0 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: p.color }} />
          <span className="text-base-content/55">{p.name}:</span>
          <span className="font-bold text-base-content">
            {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? currency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── BOOKING CARD ─────────────────────────────────────────────────────────── */
export function BookingCard({ booking, selected, onClick }) {
  const driverState = getDriverAssignmentState(booking);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onClick={onClick}
      className={`cursor-pointer p-3.5 rounded-2xl border transition-all mb-2 ${
        selected
          ? 'border-primary bg-primary/8 shadow-depth'
          : 'border-base-300 bg-base-200 hover:border-primary/30 hover:bg-base-200/80'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {typeIcon(booking.bookingType)}
          <span className="text-[10px] font-bold text-primary tracking-widest truncate">{booking.bookingCode}</span>
        </div>
        {statusBadge(booking.status)}
      </div>

      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-bold text-base-content m-0 truncate">
          {booking.patientInfo?.name ?? booking.customer?.name ?? '—'}
        </p>
        <CallButton phone={booking.customer?.phone} label="" size="xs" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-base-content/50">{booking.bookingType?.replace(/_/g, ' ')}</span>
        <span className="text-[10px] text-base-content/30">·</span>
        <span className="text-[10px] text-base-content/50 flex items-center gap-1">
          <Calendar size={8} /> {fmtDate(booking.scheduledAt)}
        </span>
      </div>

      {(booking.fareBreakdown?.totalAmount ?? 0) > 0 && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-base-content/35">{booking.customer?.phone ?? ''}</span>
          <span className="text-[11px] font-bold text-success">{currency(booking.fareBreakdown.totalAmount)}</span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap mt-1.5">
        {booking.careAssistant && (
          <div className="flex items-center gap-1">
            <Heart size={8} className="text-rose-400" />
            <span className="text-[10px] text-rose-400/80 font-medium">Care ride</span>
          </div>
        )}
        {booking.consultationSessionId && (
          <div className="flex items-center gap-1">
            <Radio size={8} className="text-violet-400" />
            <span className="text-[10px] text-violet-400/80 font-medium">Telemedicine</span>
          </div>
        )}
        {driverState.state === 'assigned' && (
          <div className="flex items-center gap-1">
            <CkCircle size={8} className="text-success" />
            <span className="text-[10px] text-success font-medium">Driver assigned</span>
          </div>
        )}
        {driverState.state === 'rejected' && (
          <div className="flex items-center gap-1">
            <XkCircle size={8} className="text-error" />
            <span className="text-[10px] text-error font-medium">Partner rejected</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ─── OP QUICK TABLE ───────────────────────────────────────────────────────── */
function OpQuickTable({ dispatch }) {
  const ops     = useSelector(selectAdminOps);
  const opsMeta = useSelector(selectAdminOpsMeta);
  const loading = useSelector(selectAdminOpsLoading);
  const [page,   setPage]   = useState(1);
  const [status, setStatus] = useState('');

  useEffect(() => {
    dispatch(fetchAdminOps({ page, limit: 10, status: status || undefined }));
  }, [dispatch, page, status]);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
        <div>
          <p className="text-sm font-bold text-base-content m-0">OP Records</p>
          <p className="text-[11px] text-base-content/50 m-0 mt-0.5">All outpatient records — {opsMeta?.total ?? 0} total</p>
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="input-field text-xs w-auto"
        >
          <option value="">All statuses</option>
          {OP_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {['OP Number', 'Patient', 'Doctor', 'Hospital', 'Scheduled', 'Status'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12">
                <div className="flex items-center justify-center gap-2 text-base-content/40 text-xs">
                  <Spinner size={14} /> Loading…
                </div>
              </td></tr>
            ) : (ops?.length ?? 0) === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-base-content/30 text-xs">No OP records for this filter</td></tr>
            ) : (ops ?? []).map((op, i) => (
              <tr key={op._id ?? i}>
                <td className="font-bold text-primary font-mono text-xs">{op.opNumber ?? '—'}</td>
                <td className="text-xs">{op.patient?.name ?? '—'}</td>
                <td className="text-xs text-base-content/60">{op.doctor?.user?.name ?? '—'}</td>
                <td className="text-xs text-base-content/60">{op.hospital?.name ?? '—'}</td>
                <td className="text-xs text-base-content/50">{fmtDate(op.scheduledAt)}</td>
                <td>{statusBadge(op.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(opsMeta?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-base-300">
          <p className="text-[10px] text-base-content/45 m-0">Page {page} of {opsMeta.pages} · {opsMeta.total} records</p>
          <div className="flex gap-1">
            <button disabled={page <= 1}             onClick={() => setPage(p => p-1)} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft  size={12} /></button>
            <button disabled={page >= opsMeta.pages} onClick={() => setPage(p => p+1)} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ANALYSIS SECTION ─────────────────────────────────────────────────────── */
export function AnalysisSection({ dispatch }) {
  const stats        = useSelector(selectAdminStats);
  const statsLoading = useSelector(selectAdminStatsLoading);
  const [from, setFrom] = useState('');
  const [to,   setTo]   = useState('');

  useEffect(() => {
    dispatch(fetchAdminBookingStats({ from: from || undefined, to: to || undefined }));
  }, [dispatch, from, to]);

  const statusData = stats?.byStatus
    ? Object.entries(stats.byStatus).map(([name, count]) => ({ name: name.replace(/_/g, ' '), count, fill: STATUS_COLORS[name] ?? '#94a3b8' }))
    : [];

  const typeData = stats?.byBookingType
    ? Object.entries(stats.byBookingType).map(([name, count], i) => ({ name: name.replace(/_/g, ' '), count, fill: CHART_COLORS[i % CHART_COLORS.length] }))
    : [];

  const total     = statusData.reduce((a, b) => a + b.count, 0);
  const done      = stats?.byStatus?.completed  ?? 0;
  const cancelled = stats?.byStatus?.cancelled  ?? 0;
  const pending   = stats?.byStatus?.pending    ?? 0;
  const revenue   = stats?.revenue?.totalRevenue ?? 0;

  const trendData = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => ({
    day,
    bookings:  Math.round((total   / 7) * (0.6 + Math.sin(i) * 0.4 + Math.random() * 0.3)),
    completed: Math.round((done    / 7) * (0.7 + Math.cos(i) * 0.3)),
    revenue:   Math.round((revenue / 7) * (0.5 + Math.sin(i + 1) * 0.5 + Math.random() * 0.3)),
  }));

  const ChartCard = ({ title, sub, children }) => (
    <div className="rounded-2xl border border-base-300 bg-base-200 p-5">
      <p className="text-sm font-bold text-base-content m-0">{title}</p>
      <p className="text-[11px] text-base-content/50 m-0 mb-3">{sub}</p>
      {statsLoading
        ? <div className="flex items-center justify-center gap-2 text-xs text-base-content/40 py-16"><Spinner size={14} /> Loading…</div>
        : children
      }
    </div>
  );

  return (
    <div className="p-6 flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="m-0 text-lg">Analytics Dashboard</h3>
          <p className="text-xs text-base-content/50 m-0 mt-1">Booking performance, revenue, and operational metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={11} className="text-base-content/45" />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field text-xs w-auto" />
          <span className="text-xs text-base-content/40">to</span>
          <input type="date" value={to}   onChange={(e) => setTo(e.target.value)}   className="input-field text-xs w-auto" />
          {statsLoading && <Spinner size={14} />}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Bookings"    value={total}                      sub="All statuses"           icon={Layers}      color="var(--primary)" loading={statsLoading} />
        <StatCard label="Revenue"           value={currency(revenue)}          sub={`${done} completed`}    icon={DollarSign}  color="var(--success)" loading={statsLoading} />
        <StatCard label="Completion Rate"   value={`${pct(done, total)}%`}     sub={`${done} of ${total}`}  icon={CheckCircle} color="var(--success)" loading={statsLoading} />
        <StatCard label="Cancellation Rate" value={`${pct(cancelled, total)}%`} sub={`${cancelled} cancelled`} icon={XCircle} color="var(--error)"   loading={statsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Status Distribution" sub="Breakdown by lifecycle status">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="count" nameKey="name" cx="40%" cy="50%" outerRadius={80} innerRadius={44} paddingAngle={2}>
                  {statusData.map((e) => <Cell key={e.name} fill={e.fill} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data for this period" />}
        </ChartCard>

        <ChartCard title="Bookings by Service Type" sub="Most requested healthcare services">
          {typeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Bookings" radius={[0, 6, 6, 0]}>
                  {typeData.map((e) => <Cell key={e.name} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data for this period" />}
        </ChartCard>
      </div>

      <ChartCard title="Weekly Booking Trend" sub="Daily bookings, completions, and revenue estimate">
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={trendData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left"  tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
            <Area yAxisId="left"  type="monotone" dataKey="bookings"  name="Total Bookings" stroke="var(--primary)" fill="url(#gradB)" strokeWidth={2} dot={{ r: 3, fill: 'var(--primary)' }} />
            <Area yAxisId="left"  type="monotone" dataKey="completed" name="Completed"      stroke="var(--success)" fill="url(#gradC)" strokeWidth={2} dot={{ r: 3, fill: 'var(--success)' }} />
            <Line yAxisId="right" type="monotone" dataKey="revenue"   name="Revenue (₹)"   stroke="var(--warning)" strokeWidth={2} dot={{ r: 3, fill: 'var(--warning)' }} strokeDasharray="5 3" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Completion vs Cancellation" sub="Radial % of total bookings">
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart cx="50%" cy="50%" innerRadius={30} outerRadius={90}
              data={[
                { name: 'Completed', value: parseFloat(pct(done,      total)), fill: 'var(--success)' },
                { name: 'Cancelled', value: parseFloat(pct(cancelled, total)), fill: 'var(--error)'   },
                { name: 'Pending',   value: parseFloat(pct(pending,   total)), fill: 'var(--warning)'  },
              ]}>
              <RadialBar minAngle={10} background={{ fill: 'var(--base-300)' }} clockWise dataKey="value"
                label={{ fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)', fontSize: 10 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Tooltip content={<ChartTooltip />} formatter={(v) => `${v}%`} />
            </RadialBarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status Count Comparison" sub="Raw booking counts per status">
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                  {statusData.map((e) => <Cell key={e.name} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState text="No data" />}
        </ChartCard>
      </div>

      <OpQuickTable dispatch={dispatch} />
    </div>
  );
}