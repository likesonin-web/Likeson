'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  Stethoscope,
  X,
  Activity,
  CheckCircle2,
  Loader2,
  AlertCircle,
  HeartPulse,
  CalendarCheck,
} from 'lucide-react';

import {
  fetchCareAssistantTasks,
  fetchCareAssistantTasksByDate,
  selectCareAssistantTasks,
  selectCareAssistantTasksByDate,
  selectAvailabilityLoading,
  selectAvailabilityError,
} from '@/store/slices/availabilitySlice';

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const STATUS_CONFIG = {
  confirmed:   { label: 'Confirmed',   color: 'var(--success)',  bg: 'color-mix(in oklch, var(--success) 15%, transparent)' },
  in_progress: { label: 'In Progress', color: 'var(--info)',     bg: 'color-mix(in oklch, var(--info) 15%, transparent)'    },
  pending:     { label: 'Pending',     color: 'var(--warning)',  bg: 'color-mix(in oklch, var(--warning) 15%, transparent)' },
  completed:   { label: 'Completed',   color: 'var(--primary)',  bg: 'color-mix(in oklch, var(--primary) 15%, transparent)' },
  cancelled:   { label: 'Cancelled',   color: 'var(--error)',    bg: 'color-mix(in oklch, var(--error) 15%, transparent)'   },
  default:     { label: 'Unknown',     color: 'var(--neutral-content)', bg: 'var(--base-200)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYMD(date) {
  return date.toISOString().split('T')[0];
}

function formatTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatFullDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getStatusCfg(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.default;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = getStatusCfg(status);
  return (
    <span
      className="badge text-xs font-semibold rounded-[var(--r-selector)] py-[2px] px-[10px]"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}` }}
    >
      {cfg.label}
    </span>
  );
}

function BookingCard({ booking, onClick }) {
  const time = formatTime(booking.scheduledAt);
  const patient = booking.patientInfo?.name || booking.customer?.name || 'Patient';
  const type = booking.bookingType?.replace(/_/g, ' ') || 'Care';
  const cfg = getStatusCfg(booking.status);

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(booking)}
      className="w-full text-left mb-[10px]"
     
    >
      <div
        className="card py-[14px] px-[16px] rounded-[var(--r-box)] flex gap-[12px] items-center cursor-pointer"
        style={{ borderLeft: `4px solid ${cfg.color}`, transition: 'all 0.2s ease' }}
      >
        <div className="shrink-0">
          <div
            className="w-[38px] h-[38px] rounded-[50%] flex items-center justify-center" style={{ background: cfg.bg }}
          >
            <HeartPulse size={18} style={{ color: cfg.color }} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[14px] m-[0px] text-base-content whitespace-nowrap overflow-hidden text-ellipsis">
            {patient}
          </p>
          <p className="text-[12px] text-[color-mix(in oklch, var(--base-content) 60%, transparent)] mt-[2px] mx-[0px] mb-[0px] capitalize">
            {type}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[12px] font-semibold m-[0px]" style={{ color: cfg.color }}>{time}</p>
          <StatusBadge status={booking.status} />
        </div>
      </div>
    </motion.button>
  );
}

function BookingDetailDrawer({ booking, onClose }) {
  const patient  = booking.patientInfo || {};
  const customer = booking.customer    || {};
  const doctor   = booking.doctor      || {};
  const type     = booking.bookingType?.replace(/_/g, ' ') || 'Care';

  return (
    <motion.div
      key="backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[50] bg-black/45 flex items-end justify-center p-[0px]"
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[600px] bg-base-100 rounded-[var(--r-box) var(--r-box) 0 0] max-h-[88vh] overflow-y-auto shadow-[0_-8px_40px_rgba(0,0,0,0.18)]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-[12px]">
          <div className="w-[40px] h-[4px] rounded-[2px] bg-base-300" />
        </div>

        {/* Header */}
        <div className="pt-[16px] px-[20px] pb-[12px] flex items-center gap-[12px]">
          <div
            className="w-[48px] h-[48px] rounded-[50%] bg-[color-mix(in oklch, var(--primary) 12%, transparent)] flex items-center justify-center shrink-0"
          >
            <CalendarCheck size={22} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="m-[0px] text-[18px] font-bold text-base-content leading-[1.2]">
              {patient.name || customer.name || 'Patient'}
            </p>
            <p className="mt-[2px] mx-[0px] mb-[0px] text-[13px] text-[color-mix(in oklch, var(--base-content) 55%, transparent)] capitalize">
              {type}
            </p>
          </div>
          <StatusBadge status={booking.status} />
          <button
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm shrink-0"
           
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-base-300 my-[0px] mx-[20px]" />

        {/* Body */}
        <div className="pt-[16px] px-[20px] pb-[32px] flex flex-col gap-[20px]">

          {/* Time & Date */}
          <Section icon={<Clock size={16} />} title="Schedule">
            <InfoRow label="Date" value={formatFullDate(booking.scheduledAt)} />
            <InfoRow label="Time" value={formatTime(booking.scheduledAt)} />
            {booking.bookingCode && <InfoRow label="Booking ID" value={booking.bookingCode} mono />}
          </Section>

          {/* Patient Info */}
          <Section icon={<User size={16} />} title="Patient">
            {patient.name && <InfoRow label="Name" value={patient.name} />}
            {patient.age && <InfoRow label="Age" value={`${patient.age} yrs`} />}
            {patient.gender && <InfoRow label="Gender" value={patient.gender} />}
            {patient.bloodGroup && <InfoRow label="Blood Group" value={patient.bloodGroup} />}
            {patient.weight && <InfoRow label="Weight" value={`${patient.weight} kg`} />}
            {patient.phone && (
              <InfoRow label="Phone" value={patient.phone} icon={<Phone size={13} />} />
            )}
          </Section>

          {/* Doctor Info (if any) */}
          {(doctor.specialization || booking.doctorSnapshot?.name) && (
            <Section icon={<Stethoscope size={16} />} title="Doctor">
              {booking.doctorSnapshot?.name && <InfoRow label="Name" value={booking.doctorSnapshot.name} />}
              {booking.doctorSnapshot?.specialization && <InfoRow label="Specialty" value={booking.doctorSnapshot.specialization} />}
              {booking.consultationType && (
                <InfoRow label="Type" value={booking.consultationType} />
              )}
            </Section>
          )}

          {/* Location (if any) */}
          {booking.patientLocation?.address && (
            <Section icon={<MapPin size={16} />} title="Location">
              <InfoRow label="Address" value={booking.patientLocation.address} />
              {booking.patientLocation.city && <InfoRow label="City" value={booking.patientLocation.city} />}
              {booking.patientLocation.pincode && <InfoRow label="PIN" value={booking.patientLocation.pincode} />}
            </Section>
          )}

          {/* Fare */}
          {booking.fareBreakdown?.totalAmount > 0 && (
            <Section icon={<Activity size={16} />} title="Fare Breakdown">
              {booking.fareBreakdown.consultationFee > 0  && <InfoRow label="Consultation" value={`₹${booking.fareBreakdown.consultationFee}`} />}
              {booking.fareBreakdown.careAssistantFee > 0 && <InfoRow label="Care Assistant" value={`₹${booking.fareBreakdown.careAssistantFee}`} />}
              {booking.fareBreakdown.platformFee > 0      && <InfoRow label="Platform Fee" value={`₹${booking.fareBreakdown.platformFee}`} />}
              {booking.fareBreakdown.taxes > 0            && <InfoRow label="Taxes" value={`₹${booking.fareBreakdown.taxes}`} />}
              {booking.fareBreakdown.discount > 0         && <InfoRow label="Discount" value={`-₹${booking.fareBreakdown.discount}`} />}
              <div className="mt-[8px] pt-[8px] border-t border-base-300">
                <InfoRow label="Total" value={`₹${booking.fareBreakdown.totalAmount}`} bold />
              </div>
            </Section>
          )}

          {/* Payment status */}
          <Section icon={<CheckCircle2 size={16} />} title="Payment">
            <InfoRow label="Payment Status" value={booking.paymentStatus || '—'} />
          </Section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div>
      <div className="flex items-center gap-[6px] mb-[10px]">
        <span className="text-primary">{icon}</span>
        <p className="m-[0px] text-[12px] font-bold tracking-[0.07em] uppercase text-[color-mix(in oklch, var(--base-content) 50%, transparent)]">
          {title}
        </p>
      </div>
      <div
        className="bg-base-200 rounded-[var(--r-field)] py-[10px] px-[14px] flex flex-col gap-[8px]"
      >
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value, icon, mono, bold }) {
  return (
    <div className="flex justify-between items-center gap-[8px]">
      <span className="text-[13px] text-[color-mix(in oklch, var(--base-content) 55%, transparent)] shrink-0">
        {label}
      </span>
      <span
        className="text-[13px] text-right flex items-center gap-[4px]" style={{ fontWeight: bold ? 700 : 500, color: bold ? 'var(--primary)' : 'var(--base-content)', fontFamily: mono ? 'monospace' : undefined }}
      >
        {icon}{value}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Schedule() {
  const dispatch = useDispatch();
  const router   = useRouter();

  const tasks       = useSelector(selectCareAssistantTasks);
  const isLoading   = useSelector(selectAvailabilityLoading);
  const error       = useSelector(selectAvailabilityError);

  const today       = new Date();
  const [viewDate, setViewDate]         = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Fetch upcoming tasks on mount (30 days to populate calendar)
  useEffect(() => {
    dispatch(fetchCareAssistantTasks({ days: 30 }));
  }, [dispatch]);

  // Also fetch by date when selected
  const handleDateClick = useCallback((date) => {
    const ymd = toYMD(date);
    setSelectedDate(ymd);
    dispatch(fetchCareAssistantTasksByDate(ymd));
  }, [dispatch]);

  // Build a set of dates that have bookings for dot indicators
  const bookedDates = new Set(
    tasks.map(b => toYMD(new Date(b.scheduledAt)))
  );

  // Get bookings for selected date (from tasks array, filtered)
  const dateBookings = selectedDate
    ? tasks.filter(b => toYMD(new Date(b.scheduledAt)) === selectedDate)
    : [];

  // Calendar grid
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calDays = [];

  // Pad start
  for (let i = 0; i < firstDay; i++) calDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calDays.push(d);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday   = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    handleDateClick(today);
  };

  const todayStr = toYMD(today);

  return (
    <div
      className="min-h-[100vh] bg-base-100 pb-[40px]" style={{ fontFamily: 'var(--font-family-poppins, sans-serif)' }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-[0px] z-[30] bg-base-100 border-b border-base-300 py-[12px] px-[16px]"
      >
        <div className="max-w-[640px] my-[0px] mx-[auto] flex items-center gap-[12px]">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
            className="btn btn-ghost btn-circle btn-sm"
            aria-label="Go back"
          >
            <ArrowLeft size={20} className="text-primary" />
          </motion.button>

          <div className="flex-1">
            <h1 className="m-[0px] text-[20px] font-bold text-base-content leading-[1.2]" style={{ fontFamily: 'var(--font-family-montserrat, sans-serif)' }}>
              My Schedule
            </h1>
            <p className="m-[0px] text-[12px] text-[color-mix(in oklch, var(--base-content) 50%, transparent)]">
              Care Assistant
            </p>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={goToday}
            className="btn btn-outline btn-sm text-[12px]"
           
          >
            <Calendar size={14} />
            Today
          </motion.button>
        </div>
      </div>

      <div className="max-w-[640px] my-[0px] mx-[auto] pt-[16px] px-[16px] pb-[0px]">

        {/* ── Calendar ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="card p-[16px] mb-[20px]"
         
        >
          {/* Month nav */}
          <div className="flex items-center mb-[16px]">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={prevMonth}
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </motion.button>
            <motion.h2
              key={`${year}-${month}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex-1 text-center m-[0px] text-[16px] font-bold text-base-content" style={{ fontFamily: 'var(--font-family-montserrat, sans-serif)' }}
            >
              {MONTHS[month]} {year}
            </motion.h2>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={nextMonth}
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </motion.button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-[repeat(7,_1fr)] mb-[6px]">
            {DAYS_SHORT.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-[color-mix(in oklch, var(--base-content) 45%, transparent)] py-[4px] px-[0px] tracking-[0.04em]">
                {d}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-[repeat(7,_1fr)] gap-[4px]">
            {calDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;

              const dateObj = new Date(year, month, day);
              const ymd     = toYMD(dateObj);
              const isToday    = ymd === todayStr;
              const isSelected = ymd === selectedDate;
              const hasBooking = bookedDates.has(ymd);
              const isPast     = dateObj < new Date(todayStr);

              return (
                <motion.button
                  key={ymd}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => handleDateClick(dateObj)}
                  className="relative flex flex-col items-center justify-center h-[42px] rounded-[var(--r-field)] cursor-pointer" style={{ border: isSelected
                      ? '2px solid var(--primary)'
                      : isToday
                        ? '1.5px solid color-mix(in oklch, var(--primary) 40%, transparent)'
                        : '1px solid transparent', background: isSelected
                      ? 'var(--primary)'
                      : isToday
                        ? 'color-mix(in oklch, var(--primary) 10%, transparent)'
                        : 'transparent', transition: 'all 0.18s ease', opacity: isPast && !isToday && !isSelected ? 0.45 : 1 }}
                  aria-label={`${day} ${MONTHS[month]}`}
                >
                  <span
                    className="text-[13px] leading-[1]" style={{ fontWeight: isToday || isSelected ? 700 : 500, color: isSelected
                        ? 'var(--primary-content)'
                        : isToday
                          ? 'var(--primary)'
                          : 'var(--base-content)' }}
                  >
                    {day}
                  </span>
                  {hasBooking && (
                    <span
                      className="absolute bottom-[5px] w-[5px] h-[5px] rounded-[50%]" style={{ background: isSelected ? 'var(--primary-content)' : 'var(--accent)' }}
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Legend ── */}
        <div className="flex gap-[16px] mb-[16px] flex-wrap py-[0px] px-[2px]">
          {[
            { dot: 'var(--accent)', label: 'Has bookings' },
            { dot: 'var(--primary)', label: 'Selected' },
            { dot: 'color-mix(in oklch, var(--primary) 40%, transparent)', label: 'Today', border: true },
          ].map(({ dot, label, border }) => (
            <div key={label} className="flex items-center gap-[6px]">
              <span className="w-[10px] h-[10px] rounded-[50%] shrink-0" style={{ background: dot, border: border ? `1.5px solid ${dot}` : undefined }} />
              <span className="text-[12px] text-[color-mix(in oklch, var(--base-content) 55%, transparent)]">{label}</span>
            </div>
          ))}
        </div>

        {/* ── Day Bookings ── */}
        <AnimatePresence mode="wait">
          {selectedDate ? (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {/* Section title */}
              <div className="flex items-center justify-between mb-[12px]">
                <p className="m-[0px] text-[15px] font-bold text-base-content" style={{ fontFamily: 'var(--font-family-montserrat, sans-serif)' }}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
                {dateBookings.length > 0 && (
                  <span
                    className="badge badge-primary text-[12px]"
                   
                  >
                    {dateBookings.length} booking{dateBookings.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {isLoading ? (
                <div className="flex justify-center py-[32px] px-[0px]">
                  <Loader2 size={28} className="text-primary" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : error ? (
                <div className="alert alert-error mb-[12px]">
                  <AlertCircle size={16} />
                  <span className="text-[13px]">{error}</span>
                </div>
              ) : dateBookings.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-[36px] px-[20px] bg-base-200 rounded-[var(--r-box)]"
                >
                  <Calendar size={36} className="text-[color-mix(in oklch, var(--base-content) 25%, transparent)] mt-[0px] mx-[auto] mb-[10px]" />
                  <p className="m-[0px] text-[color-mix(in oklch, var(--base-content) 45%, transparent)] text-[14px]">
                    No bookings for this day
                  </p>
                </motion.div>
              ) : (
                <div>
                  {dateBookings
                    .slice()
                    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                    .map(booking => (
                      <BookingCard
                        key={booking._id}
                        booking={booking}
                        onClick={setSelectedBooking}
                      />
                    ))
                  }
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-[40px] px-[20px] bg-base-200 rounded-[var(--r-box)]"
            >
              <Calendar size={40} className="text-[color-mix(in oklch, var(--primary) 50%, transparent)] mt-[0px] mx-[auto] mb-[12px]" />
              <p className="m-[0px] text-[15px] font-semibold text-base-content">
                Select a date
              </p>
              <p className="mt-[6px] mx-[0px] mb-[0px] text-[13px] text-[color-mix(in oklch, var(--base-content) 45%, transparent)]">
                Tap any date to view your bookings
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Monthly Summary Stats ── */}
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-[28px]"
          >
            <p className="mt-[0px] mx-[0px] mb-[12px] text-[13px] font-bold tracking-[0.06em] uppercase text-[color-mix(in oklch, var(--base-content) 45%, transparent)]">
              Month Overview
            </p>
            <div className="grid grid-cols-[repeat(2,_1fr)] gap-[10px]">
              {[
                { label: 'Total Tasks',  value: tasks.length,                                                          icon: <CalendarCheck size={18} /> },
                { label: 'Confirmed',    value: tasks.filter(b => b.status === 'confirmed').length,                    icon: <CheckCircle2 size={18} /> },
                { label: 'In Progress',  value: tasks.filter(b => b.status === 'in_progress').length,                  icon: <Activity size={18} />     },
                { label: 'Active Days',  value: new Set(tasks.map(b => toYMD(new Date(b.scheduledAt)))).size,          icon: <Calendar size={18} />     },
              ].map(({ label, value, icon }) => (
                <div
                  key={label}
                  className="stat-card flex items-center gap-[12px]"
                 
                >
                  <div
                    className="w-[36px] h-[36px] rounded-[var(--r-field)] bg-[color-mix(in oklch, var(--primary) 12%, transparent)] flex items-center justify-center text-primary shrink-0"
                  >
                    {icon}
                  </div>
                  <div>
                    <p className="stat-card-value text-[22px]">{value}</p>
                    <p className="stat-card-label">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Booking Detail Drawer ── */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailDrawer
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
          />
        )}
      </AnimatePresence>

      {/* Spin keyframe for loader */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}