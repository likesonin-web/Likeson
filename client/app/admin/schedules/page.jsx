'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  ChevronLeft, ChevronRight, Calendar, Clock, User, Building2,
  Stethoscope, X, RefreshCw, TrendingUp, Activity, Zap,
  CheckCircle2, XCircle, AlertCircle, Loader2, Phone,
  MapPin, CreditCard, Tag, ArrowRight, Users, Flame,
} from 'lucide-react';

import {
  fetchSchedules,
  selectHourlyDistribution,
  selectWeekdayDistribution,
  selectMonthlyVolume,
  selectUpcomingBusyDays,
  selectSchedulesLoading,
  selectSchedulesError,
} from '@/store/slices/adminAnalyticsSlice';

import {
  fetchAppointments,
  selectAppointmentsList,
  selectAppointmentsLoading,
} from '@/store/slices/adminAnalyticsSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const WEEKDAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS     = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

const pad  = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today  = toYMD(new Date());

const STATUS_META = {
  pending:     { label: 'Pending',    icon: AlertCircle,  cls: 'badge-warning', dot: 'status-dot-warning' },
  confirmed:   { label: 'Confirmed',  icon: CheckCircle2, cls: 'badge-success', dot: 'status-dot-success' },
  in_progress: { label: 'In Progress',icon: Loader2,      cls: 'badge-info',    dot: 'status-dot-info'    },
  completed:   { label: 'Completed',  icon: CheckCircle2, cls: 'badge-success', dot: 'status-dot-success' },
  cancelled:   { label: 'Cancelled',  icon: XCircle,      cls: 'badge-error',   dot: 'status-dot-error'   },
  no_show:     { label: 'No Show',    icon: XCircle,      cls: 'badge-error',   dot: 'status-dot-error'   },
};

const TYPE_COLORS = {
  doctor_consultation: 'var(--primary)',
  doctor_online:       'var(--secondary)',
  physiotherapist:     'var(--accent)',
  follow_up:           'var(--info)',
  full_care_ride:      'var(--success)',
  diagnostic_center:   'oklch(60% 0.17 280)',
  diagnostic_home:     'oklch(58% 0.18 340)',
};

const typeLabel = (t = '') =>
  t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const fmtTime = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtCurrency = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN')}` : '—';

// build calendar grid for a given year/month
function buildCalendar(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─────────────────────────────────────────────────────────────────────────────
// MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.055, duration: 0.42, ease: 'easeOut' } }),
};

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-xs shadow-depth">
      <p className="font-bold text-base-content mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold" style={{ color: p.fill || 'var(--primary)' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

function BookingDot({ count, type = 'default' }) {
  if (!count) return null;
  const many = count >= 5;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-[9px] font-black leading-none
        ${many ? 'bg-error text-error-content' : 'bg-primary text-primary-content'}
      `}
      style={{ minWidth: 16, height: 16, padding: '0 4px' }}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────

function BookingModal({ booking, onClose }) {
  if (!booking) return null;
  const meta = STATUS_META[booking.status] ?? STATUS_META.pending;
  const StatusIcon = meta.icon;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      >
        {/* backdrop */}
        <motion.div
          className="absolute inset-0 bg-neutral/60 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        />

        {/* panel */}
        <motion.div
          className="relative w-full max-w-lg bg-base-100 rounded-2xl shadow-depth-lg overflow-hidden"
          initial={{ scale: 0.92, opacity: 0, y: 24 }}
          animate={{ scale: 1,    opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {/* header band */}
          <div
            className="px-6 py-4 flex items-start justify-between"
            style={{ background: `linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)` }}
          >
            <div>
              <p className="text-xs font-bold text-primary-content/70 uppercase tracking-widest mb-0.5">
                Booking ID
              </p>
              <p className="font-montserrat font-black text-lg text-primary-content leading-tight">
                {booking.bookingCode ?? '—'}
              </p>
              <span className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wider">
                {typeLabel(booking.bookingType)}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* body */}
          <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">

            {/* status + time */}
            <div className="flex items-center justify-between">
              <span className={`badge ${meta.cls} gap-1.5`}>
                <StatusIcon size={11} />
                {meta.label}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-base-content/60">
                <Clock size={13} />
                <span className="font-semibold">{fmtTime(booking.scheduledAt)}</span>
                <span>·</span>
                <span>{fmtDate(booking.scheduledAt)}</span>
              </div>
            </div>

            <hr className="divider !my-0" />

            {/* patient */}
            <Section icon={User} title="Patient">
              <Row label="Name"  value={booking.patientInfo?.name ?? booking.customer?.name ?? '—'} />
              <Row label="Age"   value={booking.patientInfo?.age  ? `${booking.patientInfo.age} yrs` : '—'} />
              <Row label="Phone" value={booking.customer?.phone ?? '—'} icon={Phone} />
            </Section>

            {/* doctor */}
            {booking.doctor && (
              <Section icon={Stethoscope} title="Doctor">
                <Row label="Name"           value={booking.doctor?.user?.name ?? '—'} />
                <Row label="Specialization" value={booking.doctor?.specialization ?? '—'} />
              </Section>
            )}

            {/* hospital */}
            {booking.hospital && (
              <Section icon={Building2} title="Hospital">
                <Row label="Name" value={booking.hospital?.name ?? '—'} />
                <Row label="City" value={booking.hospital?.address?.city ?? '—'} icon={MapPin} />
              </Section>
            )}

            {/* payment */}
            <Section icon={CreditCard} title="Payment">
              <Row label="Amount"  value={fmtCurrency(booking.fareBreakdown?.totalAmount)} />
              <Row label="Status"  value={booking.paymentStatus ?? '—'} />
            </Section>

            {/* consultation type */}
            {booking.consultationType && (
              <Section icon={Tag} title="Consultation">
                <Row label="Type" value={typeLabel(booking.consultationType)} />
              </Section>
            )}

          </div>

          {/* footer */}
          <div className="px-6 py-4 border-t border-base-300 flex justify-end gap-2 bg-base-200/60">
            <button onClick={onClose} className="btn btn-ghost btn-sm">Close</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-primary" />
        <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">{title}</p>
      </div>
      <div className="bg-base-200 rounded-xl px-4 py-3 space-y-2">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-base-content/50 font-medium">{label}</span>
      <span className="font-semibold text-base-content flex items-center gap-1">
        {Icon && <Icon size={11} className="text-base-content/40" />}
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DAY PANEL — side panel listing bookings for selected date
// ─────────────────────────────────────────────────────────────────────────────

function DayPanel({ date, bookings, loading, onBookingClick, onClose }) {
  const d = new Date(date + 'T00:00:00');
  const label = d.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <motion.div
      key={date}
      initial={{ opacity: 0, x: 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 32 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="flex flex-col h-full"
    >
      {/* panel head */}
      <div className="flex items-start justify-between px-5 py-4 border-b border-base-300">
        <div>
          <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-widest mb-0.5">Selected</p>
          <p className="font-montserrat font-extrabold text-base text-base-content leading-snug">{label}</p>
          {!loading && (
            <p className="text-xs text-base-content/50 mt-0.5">
              {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle mt-0.5">
          <X size={14} />
        </button>
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 scrollbar-thin">
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-base-content/25">
            <Calendar size={36} className="mb-2 opacity-50" />
            <p className="text-sm font-semibold">No bookings</p>
            <p className="text-xs mt-0.5">Nothing scheduled this day</p>
          </div>
        ) : (
          bookings.map((b, i) => {
            const meta   = STATUS_META[b.status] ?? STATUS_META.pending;
            const color  = TYPE_COLORS[b.bookingType] ?? 'var(--primary)';
            return (
              <motion.button
                key={b._id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onBookingClick(b)}
                className="w-full text-left card p-4 hover:border-primary/40 group transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  {/* color strip */}
                  <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: color }} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-xs font-black text-base-content truncate">
                        {b.bookingCode ?? '—'}
                      </p>
                      <span className={`badge ${meta.cls} badge-xs flex-shrink-0`}>
                        {meta.label}
                      </span>
                    </div>

                    <p className="text-[11px] font-semibold text-base-content/70 truncate">
                      {b.patientInfo?.name ?? b.customer?.name ?? '—'}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-base-content/40 font-medium">
                        {typeLabel(b.bookingType)}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-base-content/60">
                        <Clock size={10} />
                        {fmtTime(b.scheduledAt)}
                      </div>
                    </div>

                    {b.fareBreakdown?.totalAmount && (
                      <p className="text-[10px] font-black text-success mt-1">
                        ₹{Number(b.fareBreakdown.totalAmount).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <ArrowRight size={14} className="text-base-content/20 group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SchedulesPage() {
  const dispatch = useDispatch();

  // redux
  const schedLoading  = useSelector(selectSchedulesLoading);
  const schedError    = useSelector(selectSchedulesError);
  const hourly        = useSelector(selectHourlyDistribution)  ?? [];
  const weekdayDist   = useSelector(selectWeekdayDistribution) ?? [];
  const monthlyVol    = useSelector(selectMonthlyVolume)       ?? [];
  const busyDays      = useSelector(selectUpcomingBusyDays)    ?? [];
  const apptData      = useSelector(selectAppointmentsList);
  const apptLoading   = useSelector(selectAppointmentsLoading);

  // calendar state
  const now           = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);
  const [activeBooking, setActiveBooking] = useState(null);

  // fetch schedule analytics on mount
  useEffect(() => {
    dispatch(fetchSchedules({ days: 90 }));
  }, [dispatch]);

  // fetch appointments when a date is selected
  useEffect(() => {
    if (!selectedDate) return;
    dispatch(fetchAppointments({
      from:  selectedDate + 'T00:00:00.000Z',
      to:    selectedDate + 'T23:59:59.999Z',
      limit: 50,
    }));
  }, [dispatch, selectedDate]);

  // ── calendar grid ──────────────────────────────────────────────────────
  const cells = useMemo(() => buildCalendar(calYear, calMonth), [calYear, calMonth]);

  // build a map: "YYYY-MM-DD" → booking count from busyDays + monthlyVol
  const busyMap = useMemo(() => {
    const m = {};
    busyDays.forEach(d => { if (d._id) m[d._id] = d.count; });
    return m;
  }, [busyDays]);

  // appts for selected date
  const dayBookings = useMemo(() => apptData?.data ?? [], [apptData]);

  // nav helpers
  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const selectDate = useCallback((day) => {
    if (!day) return;
    const ymd = `${calYear}-${pad(calMonth + 1)}-${pad(day)}`;
    setSelectedDate(prev => prev === ymd ? null : ymd);
    setActiveBooking(null);
  }, [calYear, calMonth]);

  // peak hour for badge
  const peakHour = useMemo(() => {
    if (!hourly.length) return null;
    const p = [...hourly].sort((a, b) => b.count - a.count)[0];
    return p ? `${pad(p._id)}:00` : null;
  }, [hourly]);

  // weekday labels
  const wkData = useMemo(() =>
    weekdayDist.map(d => ({ day: d.day ?? d.dayIndex, count: d.count })),
  [weekdayDist]);

  // monthly chart — last 6 months
  const mthData = useMemo(() =>
    monthlyVol.slice(-6).map(m => ({ month: m._id?.slice(5), count: m.count, revenue: m.revenue })),
  [monthlyVol]);

  // ── render ──────────────────────────────────────────────────────────────
  return (
    <div data-them='admin' className="min-h-screen bg-base-200/40">
      <div className="container-custom py-6 max-w-[1400px] space-y-6">

        {/* ═══ PAGE HEADER ══════════════════════════════════════════════ */}
        <motion.div
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary text-primary-content shadow-primary">
              <Calendar size={20} />
            </div>
            <div>
              <h1 className="section-heading !mb-0 !text-2xl md:!text-3xl">Booking Schedules</h1>
              <p className="section-subheading !mb-0 text-sm">
                Monthly calendar · click any date to inspect bookings
              </p>
            </div>
          </div>

          <button
            onClick={() => dispatch(fetchSchedules({ days: 90 }))}
            className="btn btn-outline btn-sm gap-2 self-start sm:self-auto"
          >
            <RefreshCw size={14} className={schedLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </motion.div>

        {/* ═══ ERROR ════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {schedError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="alert alert-error text-sm"
            >
              {schedError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ STAT STRIPS ══════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Activity,    label: 'Total Bookings',   value: monthlyVol.reduce((s, m) => s + m.count, 0).toLocaleString('en-IN'),  color: 'text-primary'   },
            { icon: Zap,         label: 'Peak Hour',        value: peakHour ?? '—',                                                       color: 'text-warning'   },
            { icon: Flame,       label: 'Busiest Day',      value: busyDays[0]?._id?.slice(5) ?? '—',                                     color: 'text-error'     },
            { icon: TrendingUp,  label: 'This Month',       value: (monthlyVol.at(-1)?.count ?? 0).toLocaleString('en-IN'),               color: 'text-success'   },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              variants={fadeUp} initial="hidden" animate="visible" custom={i}
              className="stat-card !p-4"
            >
              <s.icon size={16} className={`${s.color} mb-2`} />
              <p className="stat-card-label text-[10px]">{s.label}</p>
              {schedLoading
                ? <div className="skeleton h-6 w-20 mt-1 rounded" />
                : <p className={`text-xl font-extrabold font-montserrat ${s.color}`}>{s.value}</p>
              }
            </motion.div>
          ))}
        </div>

        {/* ═══ MAIN GRID: CALENDAR + PANEL ══════════════════════════════ */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* ── LEFT: CALENDAR ─────────────────────────────────────── */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
            className="xl:col-span-2 card overflow-hidden"
          >
            {/* calendar nav */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
              <button onClick={prevMonth} className="btn btn-ghost btn-sm btn-circle">
                <ChevronLeft size={18} />
              </button>

              <div className="text-center">
                <p className="font-montserrat font-black text-xl text-base-content">
                  {MONTHS[calMonth]}
                </p>
                <p className="text-xs text-base-content/40 font-semibold">{calYear}</p>
              </div>

              <button onClick={nextMonth} className="btn btn-ghost btn-sm btn-circle">
                <ChevronRight size={18} />
              </button>
            </div>

            {/* day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-base-300">
              {WEEKDAYS.map(wd => (
                <div key={wd} className="py-2.5 text-center text-[10px] font-black text-base-content/40 uppercase tracking-widest">
                  {wd}
                </div>
              ))}
            </div>

            {/* calendar cells */}
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                const ymd      = day ? `${calYear}-${pad(calMonth + 1)}-${pad(day)}` : null;
                const count    = ymd ? (busyMap[ymd] ?? 0) : 0;
                const isToday  = ymd === today;
                const isSel    = ymd === selectedDate;
                const isBusy   = count >= 5;
                const isPast   = ymd && ymd < today;

                return (
                  <motion.button
                    key={i}
                    whileHover={day ? { scale: 1.06 } : {}}
                    whileTap={day ? { scale: 0.95 } : {}}
                    disabled={!day}
                    onClick={() => selectDate(day)}
                    className={[
                      'relative flex flex-col items-center justify-start pt-2 pb-2.5 min-h-[68px] sm:min-h-[80px]',
                      'border-b border-r border-base-300 transition-colors duration-150',
                      !day ? 'cursor-default bg-base-200/40' : 'cursor-pointer',
                      isSel  ? 'bg-primary text-primary-content'       : '',
                      !isSel && isToday ? 'bg-primary/8'                : '',
                      !isSel && !isToday && isBusy ? 'bg-error/5'       : '',
                      !isSel && !isToday && !isBusy && day ? 'hover:bg-base-300/50' : '',
                      isPast && !isSel ? 'opacity-50' : '',
                    ].join(' ')}
                  >
                    {day && (
                      <>
                        {/* date number */}
                        <span className={[
                          'w-7 h-7 flex items-center justify-center rounded-full text-sm font-black leading-none mb-1',
                          isToday && !isSel ? 'bg-primary text-primary-content' : '',
                          isSel ? 'bg-white/25 text-primary-content' : '',
                          !isToday && !isSel ? 'text-base-content' : '',
                        ].join(' ')}>
                          {day}
                        </span>

                        {/* booking count dot */}
                        {count > 0 && (
                          <BookingDot count={count} />
                        )}

                        {/* heat strip at bottom */}
                        {count > 0 && !isSel && (
                          <div
                            className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full"
                            style={{
                              background: count >= 8 ? 'var(--error)'
                                : count >= 4 ? 'var(--warning)'
                                : 'var(--primary)',
                              opacity: 0.7,
                            }}
                          />
                        )}
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* legend */}
            <div className="flex flex-wrap items-center gap-4 px-6 py-3 border-t border-base-300 bg-base-200/50">
              <div className="flex items-center gap-1.5 text-[10px] text-base-content/50 font-semibold">
                <span className="w-3 h-1 rounded-full bg-primary inline-block" /> 1–3 bookings
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-base-content/50 font-semibold">
                <span className="w-3 h-1 rounded-full bg-warning inline-block" /> 4–7 bookings
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-base-content/50 font-semibold">
                <span className="w-3 h-1 rounded-full bg-error inline-block" /> 8+ bookings
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-base-content/50 font-semibold ml-auto">
                <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-[8px] text-primary-content font-black">●</span> today
              </div>
            </div>
          </motion.div>

          {/* ── RIGHT: DAY PANEL ───────────────────────────────────── */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={3}
            className="card overflow-hidden min-h-[400px] xl:min-h-0 flex flex-col"
          >
            <AnimatePresence mode="wait">
              {selectedDate ? (
                <DayPanel
                  key={selectedDate}
                  date={selectedDate}
                  bookings={dayBookings}
                  loading={apptLoading}
                  onBookingClick={setActiveBooking}
                  onClose={() => setSelectedDate(null)}
                />
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Calendar size={28} className="text-primary opacity-60" />
                  </div>
                  <p className="font-montserrat font-extrabold text-base text-base-content mb-1">
                    Select a Date
                  </p>
                  <p className="text-xs text-base-content/40 leading-relaxed max-w-[200px]">
                    Click any date on the calendar to view bookings scheduled for that day
                  </p>

                  {/* upcoming busy days preview */}
                  {busyDays.length > 0 && (
                    <div className="mt-6 w-full">
                      <p className="text-[10px] font-black text-base-content/40 uppercase tracking-widest mb-3">
                        Upcoming Busy Days
                      </p>
                      <div className="space-y-2">
                        {busyDays.slice(0, 5).map(d => (
                          <button
                            key={d._id}
                            onClick={() => {
                              const dt = new Date(d._id + 'T00:00:00');
                              setCalYear(dt.getFullYear());
                              setCalMonth(dt.getMonth());
                              setSelectedDate(d._id);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-base-200 hover:bg-primary/10 hover:border-primary/20 border border-base-300 transition-colors"
                          >
                            <span className="text-xs font-semibold text-base-content">
                              {new Date(d._id + 'T00:00:00').toLocaleDateString('en-IN', {
                                weekday: 'short', day: '2-digit', month: 'short',
                              })}
                            </span>
                            <BookingDot count={d.count} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ═══ ANALYTICS CHARTS ROW ═════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {/* Weekday distribution */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4} className="card p-5">
            <div className="mb-4">
              <h3 className="font-montserrat font-extrabold text-base text-base-content">By Weekday</h3>
              <p className="text-xs text-base-content/40 mt-0.5">Which days get most bookings</p>
            </div>
            {schedLoading ? <div className="skeleton h-44 rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={wkData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Bookings" radius={[4, 4, 0, 0]}>
                    {wkData.map((_, i) => (
                      <Cell key={i} fill={i === 0 || i === 6 ? 'var(--base-300)' : 'var(--primary)'} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Hourly distribution */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5} className="card p-5">
            <div className="mb-4">
              <h3 className="font-montserrat font-extrabold text-base text-base-content">By Hour of Day</h3>
              <p className="text-xs text-base-content/40 mt-0.5">Peak scheduling times</p>
            </div>
            {schedLoading ? <div className="skeleton h-44 rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={hourly.map(h => ({ hour: `${pad(h._id)}h`, count: h.count }))}
                  margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={8}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.5 }} tickLine={false} axisLine={false}
                    interval={2} />
                  <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: 0.45 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Bookings" radius={[3, 3, 0, 0]}>
                    {hourly.map((h, i) => (
                      <Cell key={i}
                        fill={h._id >= 9 && h._id <= 17 ? 'var(--accent)' : 'var(--secondary)'}
                        fillOpacity={0.8}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Monthly volume */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6} className="card p-5">
            <div className="mb-4">
              <h3 className="font-montserrat font-extrabold text-base text-base-content">Monthly Volume</h3>
              <p className="text-xs text-base-content/40 mt-0.5">Last 6 months booking trend</p>
            </div>
            {schedLoading ? <div className="skeleton h-44 rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={mthData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.55 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.45 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="count" name="Bookings" fill="var(--primary)" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>

        {/* ═══ UPCOMING BUSY TABLE ══════════════════════════════════════ */}
        {busyDays.length > 0 && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7} className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-base-300 flex items-center gap-2">
              <Flame size={16} className="text-error" />
              <h3 className="font-montserrat font-extrabold text-base text-base-content">Upcoming Busy Days</h3>
              <span className="badge badge-error badge-sm ml-1">{busyDays.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Bookings</th>
                    <th>Load</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {busyDays.map((d, i) => {
                    const dt = new Date(d._id + 'T00:00:00');
                    const max = busyDays[0]?.count ?? 1;
                    const pct = Math.round((d.count / max) * 100);
                    return (
                      <tr key={d._id}>
                        <td className="text-xs font-mono text-base-content/30">{i + 1}</td>
                        <td className="font-semibold text-sm">
                          {dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="text-sm text-base-content/60">
                          {dt.toLocaleDateString('en-IN', { weekday: 'long' })}
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <Users size={13} className="text-primary" />
                            <span className="font-black text-sm text-base-content">{d.count}</span>
                          </div>
                        </td>
                        <td className="w-40">
                          <div className="flex items-center gap-2">
                            <div className="progress-bar flex-1">
                              <div className="progress-bar-fill" style={{
                                width: `${pct}%`,
                                background: pct >= 80 ? 'var(--error)' : pct >= 50 ? 'var(--warning)' : 'var(--primary)',
                              }} />
                            </div>
                            <span className="text-[10px] font-bold text-base-content/40 w-7">{pct}%</span>
                          </div>
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => {
                              setCalYear(dt.getFullYear());
                              setCalMonth(dt.getMonth());
                              setSelectedDate(d._id);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="btn btn-primary btn-xs gap-1"
                          >
                            View <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

      </div>

      {/* ═══ BOOKING DETAIL MODAL ════════════════════════════════════════ */}
      <AnimatePresence>
        {activeBooking && (
          <BookingModal booking={activeBooking} onClose={() => setActiveBooking(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}