'use client';

import {
  useEffect, useState, useCallback, useMemo, useRef, memo,
} from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Calendar, Clock, ChevronRight, ChevronLeft,
  FileText, Stethoscope, Video, Home, Search,
  CheckCircle2, AlertCircle, XCircle, Clock3, RefreshCw,
  Plus, Eye, Activity, CalendarDays, MoreVertical, Layers,
  ClipboardList, PenLine, BadgeCheck, Radio, UserCheck, XOctagon,
  TrendingUp, LayoutDashboard, History, Star, Users,
  Phone, QrCode, CreditCard, DollarSign, Wallet, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import {
  fetchDoctorAppointments,
  fetchOPRecords,
  completeOPRecord,
  selectDoctorAppointments,
  selectDoctorAppointmentsTotal,
  selectOPRecords,
  selectClinicalLoading,
  selectClinicalError,
} from '@/store/slices/clinicalSlice';

import {
  generatePayAtServiceLink,
  fetchPayAtServiceStatus,
  markCollectedByPartner,
  markServiceComplete,
  paidFromSocket,
  clearSession,
  selectPayAtServiceSession,
  selectPayAtServiceLoading,
  selectCanMarkComplete,
  selectNeedsNewLink,
} from '@/store/slices/payAtServiceSlice';

import {
  fetchDoctorSchedule,
  fetchDoctorHistory,
  fetchDoctorStats,
  fetchDoctorActive,
  fetchDoctorMy,
  cancelConsultation,
  selectDoctorSchedule,
  selectDoctorStats,
  selectConsultationList,
  selectLoading as selectConsultLoading,
} from '@/store/slices/consultationSlice';

// FIX: Accept / Confirm (doctor accepts a pending consultation, booking
// pending -> confirmed, OP card auto-sent) live on the booking-embedded
// consultation system (bookingRouter2 controller), wired through
// operationsSlice — NOT consultationSlice. These were completely missing
// from this file before, so pending appointments had no way to be
// accepted or rejected by the doctor.
import {
  acceptConsultation,
  confirmConsultation,
  selectAcceptConsultationLoading,
  selectConfirmConsultationLoading,
} from '@/store/slices/operationsSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: '',            label: 'All'         },
  { value: 'pending',     label: 'Pending'     },
  { value: 'created',     label: 'Created'     },
  { value: 'scheduled',   label: 'Scheduled'   },
  { value: 'confirmed',   label: 'Confirmed'   },
  { value: 'waiting',     label: 'Waiting'     },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'active',      label: 'Active'      },
  { value: 'completed',   label: 'Completed'   },
  { value: 'cancelled',   label: 'Cancelled'   },
  { value: 'no_show',     label: 'No Show'     },
];

const CONSULT_TYPES = [
  { value: '',          label: 'All Types'  },
  { value: 'inPerson',  label: 'In Person'  },
  { value: 'video',     label: 'Video'      },
  { value: 'homeVisit', label: 'Home Visit' },
];

const BOOKING_TYPE_LABEL = {
  full_care_ride:      'Full Care',
  doctor_consultation: 'Consultation',
  doctor_online:       'Online',
  physiotherapist:     'Physio',
  follow_up:           'Follow-up',
};

const TAB_OPTIONS = [
  { value: 'appointments', label: 'Appointments', icon: CalendarDays },
  { value: 'schedule',     label: 'Schedule',     icon: Calendar },
  { value: 'history',      label: 'History',      icon: History },
  { value: 'active',       label: 'Active',       icon: Radio },
];

const PAGE_LIMIT         = 10;
const SEARCH_DEBOUNCE_MS = 400;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const statusConfig = (status) => {
  const map = {
    pending:     { label: 'Pending',     bg: 'bg-warning/10',  text: 'text-warning',  Icon: Clock3       },
    created:     { label: 'Created',     bg: 'bg-warning/10',  text: 'text-warning',  Icon: Clock3       },
    waiting:     { label: 'Waiting',     bg: 'bg-info/10',     text: 'text-info',     Icon: Clock        },
    scheduled:   { label: 'Scheduled',   bg: 'bg-info/10',     text: 'text-info',     Icon: Calendar     },
    confirmed:   { label: 'Confirmed',   bg: 'bg-info/10',     text: 'text-info',     Icon: BadgeCheck   },
    active:      { label: 'Active',      bg: 'bg-primary/10',  text: 'text-primary',  Icon: Activity     },
    in_progress: { label: 'In Progress', bg: 'bg-primary/10',  text: 'text-primary',  Icon: Activity     },
    completed:   { label: 'Completed',   bg: 'bg-success/10',  text: 'text-success',  Icon: CheckCircle2 },
    cancelled:   { label: 'Cancelled',   bg: 'bg-error/10',    text: 'text-error',    Icon: XCircle      },
    no_show:     { label: 'No Show',     bg: 'bg-error/10',    text: 'text-error',    Icon: AlertCircle  },
  };
  return map[status] ?? { label: status, bg: 'bg-base-200', text: 'text-base-content', Icon: Clock3 };
};

const consultIcon = (type) => {
  if (type === 'video')     return <Video size={13} />;
  if (type === 'homeVisit') return <Home  size={13} />;
  return <Stethoscope size={13} />;
};

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch { return '—'; }
};

const formatShortDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
};

const buildChartData = (appointments) => {
  const now  = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    return { date: formatShortDate(d), count: 0, key: d.toDateString() };
  });
  (appointments || []).forEach((a) => {
    try {
      const k    = new Date(a.scheduledAt).toDateString();
      const slot = days.find((d) => d.key === k);
      if (slot) slot.count += 1;
    } catch {}
  });
  return days;
};

// State Helpers
const isOnlineBooking = (b) => b?.bookingType === 'doctor_online' || b?.consultationType === 'video';

const isBookingPaid = (b) => ['paid', 'pay_at_service_paid', 'waived'].includes(b?.paymentStatus);

const canShowQrPay = (b) => {
  if (isBookingPaid(b)) return false;
  if (['completed', 'cancelled', 'no_show', 'failed'].includes(b?.status)) return false;
  if (b?.bookingType === 'doctor_online') return false;
  return true;
};

const canJoinConsult = (b) =>
  isOnlineBooking(b) &&
  ['confirmed', 'in_progress', 'scheduled', 'waiting', 'active'].includes(b?.status) &&
  !!b?.consultationSessionId;

// FIX: pending/created bookings tied to a linked Consultation doc are the
// ones a doctor can Accept (confirm) or Reject. Once accepted, status moves
// off pending/created so these buttons naturally disappear.
const canConfirmReject = (b) =>
  ['pending', 'created'].includes(b?.status) && !!b?.doctor;

const bookingIdFromOP = (op) => {
  if (!op?.booking) return null;
  if (typeof op.booking === 'string') return op.booking;
  if (typeof op.booking === 'object') return op.booking?._id?.toString() ?? null;
  return null;
};

const getPatientName = (b) => b?.patientInfo?.name ?? b?.customer?.name ?? '—';
const getPatientPhone = (b) => b?.patientInfo?.phone ?? b?.customer?.phone ?? '—';
const getInitial = (b) => (getPatientName(b)?.[0] ?? '?').toUpperCase();

// FIX: this is the single source of truth for "which Consultation document
// does this booking join?". It must ALWAYS resolve to the Consultation._id
// (i.e. Booking.consultationSessionId), never to the Booking._id itself —
// the /doctor/consultation/[consultationId] route expects a Consultation _id.
const getConsultationId = (b) => {
  const rawId = b?.consultationSessionId || b?.consultationId || b?.consultation;
  if (!rawId) return null;
  if (typeof rawId === 'string') return rawId;
  if (typeof rawId === 'object') {
    if (rawId._id) return String(rawId._id);
    return String(rawId);
  }
  return String(rawId);
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

const useDebounce = (value, delay) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const STAT_COLOR_MAP = {
  primary:   'var(--primary)',
  info:      'var(--info)',
  success:   'var(--success)',
  warning:   'var(--warning)',
  accent:    'var(--accent)',
};

const StatCard = memo(({ icon: Icon, label, value, sub, colorKey = 'primary', chartData, live }) => {
  const color = STAT_COLOR_MAP[colorKey] ?? STAT_COLOR_MAP.primary;
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card relative overflow-hidden flex flex-col gap-3 p-4 bg-base-100 rounded-2xl border border-base-300"
      aria-label={`${label}: ${value}`}
    >
      {live && (
        <span className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-success font-semibold" aria-label="Live">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
          Live
        </span>
      )}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-base-content/60 mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-base-content/50 mt-1">{sub}</p>}
        </div>
        <div
          className="p-2.5 rounded-xl"
          style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}
          aria-hidden="true"
        >
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      {chartData && (
        <div className="h-12 -mx-1 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={color} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="count" stroke={color} strokeWidth={2} fill={`url(#grad-${label})`} dot={false} />
              <Tooltip
                contentStyle={{ background: 'var(--base-200)', border: 'none', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: 'var(--base-content)' }}
                itemStyle={{ color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.article>
  );
});
StatCard.displayName = 'StatCard';

const StatusBadge = memo(({ status }) => {
  const { label, bg, text, Icon } = statusConfig(status);
  return (
    <span className={`badge badge-sm ${bg} ${text} border-0`}>
      <Icon size={10} className="mr-1" aria-hidden="true" />
      {label}
    </span>
  );
});
StatusBadge.displayName = 'StatusBadge';

const ConsultTypeBadge = memo(({ type }) => (
  <span className="inline-flex items-center gap-1 text-xs font-medium text-base-content/60">
    {consultIcon(type)}
    {type ?? '—'}
  </span>
));
ConsultTypeBadge.displayName = 'ConsultTypeBadge';

const PatientAvatar = memo(({ booking }) => (
  <div className="avatar placeholder" aria-hidden="true">
    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
      <span>{getInitial(booking)}</span>
    </div>
  </div>
));
PatientAvatar.displayName = 'PatientAvatar';

// ─────────────────────────────────────────────────────────────────────────────
// ACTION MENU (PORTALED)
// ─────────────────────────────────────────────────────────────────────────────

const MenuItem = ({ icon, label, highlight = '', onClick, disabled = false }) => (
  <button
    className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-base-200 text-base-content transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${highlight}`}
    onClick={onClick}
    disabled={disabled}
    role="menuitem"
  >
    {icon}
    {label}
  </button>
);

const ActionMenu = memo(({ booking, opRecord, onComplete, onCancel, onConfirm, onReject, confirmLoading, router }) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  const canComplete = ['in_progress', 'confirmed', 'active'].includes(booking?.status);
  const showVideo   = canJoinConsult(booking);
  const showConfirmReject = canConfirmReject(booking);
  // FIX: single, correct resolution of the Consultation _id — used for the
  // join action below. Previously a second "Join by Consultation ID" item
  // duplicated this while the first "Join Video Call" item incorrectly used
  // booking._id, sending doctors to a consultation route with the wrong id.
  const consultationId = getConsultationId(booking);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: Math.max(10, rect.right - 224) });
    }
    setOpen((p) => !p);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if (ref.current && !ref.current.contains(e.target) && !triggerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handler);
    document.addEventListener('mousedown', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      document.removeEventListener('keydown', handler);
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  const dropdownContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.12 }}
          style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 99999 }}
          className="w-56 bg-base-100 border border-base-300 rounded-xl shadow-2xl py-1 overflow-hidden"
          role="menu"
        >
          {/* Confirm / Reject — pending bookings only */}
          {showConfirmReject && (
            <>
              <MenuItem
                icon={<ThumbsUp size={14} className="text-success" />}
                label="Confirm / Accept"
                highlight="text-success hover:bg-success/10"
                disabled={confirmLoading}
                onClick={() => { close(); onConfirm(booking); }}
              />
              <MenuItem
                icon={<ThumbsDown size={14} className="text-error" />}
                label="Reject"
                highlight="text-error hover:bg-error/10"
                disabled={confirmLoading}
                onClick={() => { close(); onReject(booking); }}
              />
              <div className="border-t border-base-200 my-1 mx-3" role="separator" />
            </>
          )}

          <MenuItem
            icon={<Eye size={14} className="text-primary" />}
            label="View Details"
            onClick={() => { close(); router.push(`/doctor/appointments/${booking._id}`); }}
          />

          {/* FIX: was previously two menu items — "Join Video Call" (buggy,
              routed on booking._id) and "Join by Consultation ID" (correct,
              routed on consultationId). Collapsed into one correct item. */}
          {showVideo && consultationId && (
            <MenuItem
              icon={<Video size={14} className="text-info" />}
              label="Join Video Call"
              highlight="text-info font-medium"
              onClick={() => { close(); router.push(`/doctor/consultation/${consultationId}`); }}
            />
          )}

          <MenuItem
            icon={<PenLine size={14} className="text-accent" />}
            label="Write Prescription"
            onClick={() => { close(); router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`); }}
          />
          <MenuItem
            icon={<ClipboardList size={14} className="text-secondary" />}
            label="View Prescriptions"
            onClick={() => { close(); router.push(`/doctor/prescriptions?bookingId=${booking._id}`); }}
          />
          {opRecord && (
            <MenuItem
              icon={<FileText size={14} className="text-info" />}
              label={`OP: ${opRecord.opNumber || 'View Record'}`}
              onClick={() => { close(); router.push(`/doctor/op-records/${opRecord._id}`); }}
            />
          )}
          {canComplete && (
            <>
              <div className="border-t border-base-200 my-1 mx-3" role="separator" />
              <MenuItem
                icon={<CheckCircle2 size={14} className="text-success" />}
                label="Mark Complete"
                highlight="text-success hover:bg-success/10"
                onClick={() => { close(); onComplete(booking._id, opRecord?._id ?? null); }}
              />
            </>
          )}
          {isOnlineBooking(booking) && !['completed', 'cancelled', 'failed'].includes(booking?.status) && (
            <>
              <div className="border-t border-base-200 my-1 mx-3" role="separator" />
              <MenuItem
                icon={<XOctagon size={14} className="text-error" />}
                label="Cancel Consultation"
                highlight="text-error hover:bg-error/10"
                onClick={() => { close(); onCancel(consultationId); }}
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggleMenu}
        className="btn btn-ghost btn-xs btn-circle"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
      >
        <MoreVertical size={15} aria-hidden="true" />
      </button>
      {mounted && createPortal(dropdownContent, document.body)}
    </>
  );
});
ActionMenu.displayName = 'ActionMenu';

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE MODAL
// ─────────────────────────────────────────────────────────────────────────────

const CompleteModal = memo(({ open, onClose, onSubmit, loading }) => {
  const [notes,  setNotes]  = useState('');
  const [code,   setCode]   = useState('');
  const [reason, setReason] = useState('');
  const firstInputRef = useRef(null);

  useEffect(() => {
    if (open) setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = useCallback(() => {
    if (loading) return;
    onSubmit({ doctorNotes: notes, diagnosisCode: code, reasonForVisit: reason });
    setNotes(''); setCode(''); setReason('');
  }, [loading, onSubmit, notes, code, reason]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Complete consultation"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className="bg-base-100 border border-base-300 rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-success/10" aria-hidden="true">
                <CheckCircle2 size={20} className="text-success" />
              </div>
              <div>
                <h3 className="font-bold text-base-content text-lg leading-tight">Complete Consultation</h3>
                <p className="text-xs text-base-content/60 mt-0.5">All fields optional</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="complete-reason" className="text-sm font-medium block mb-1.5">Reason for Visit</label>
                <input
                  id="complete-reason"
                  ref={firstInputRef}
                  className="input input-bordered w-full"
                  placeholder="Chief complaints / reason…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="complete-code" className="text-sm font-medium block mb-1.5">ICD-10 Code <span className="text-xs text-base-content/50 font-normal ml-1">(optional)</span></label>
                <input
                  id="complete-code"
                  className="input input-bordered w-full font-mono"
                  placeholder="e.g. J06.9"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="complete-notes" className="text-sm font-medium block mb-1.5">Doctor Notes</label>
                <textarea
                  id="complete-notes"
                  className="textarea textarea-bordered w-full min-h-[96px] resize-none"
                  placeholder="Clinical findings, advice…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn btn-ghost flex-1" onClick={onClose} disabled={loading}>Cancel</button>
              <button className="btn btn-success flex-1 gap-2" onClick={handleSubmit} disabled={loading}>
                {loading ? <span className="loading loading-xs loading-spinner" aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
                Confirm
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
CompleteModal.displayName = 'CompleteModal';

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY / LOADING
// ─────────────────────────────────────────────────────────────────────────────

const EmptyState = () => (
  <tr>
    <td colSpan={8} className="py-20 text-center">
      <div className="flex flex-col items-center gap-3 text-base-content/40">
        <CalendarDays size={36} strokeWidth={1} aria-hidden="true" />
        <p className="font-semibold text-sm">No appointments found</p>
        <p className="text-xs">Try adjusting your filters</p>
      </div>
    </td>
  </tr>
);

const LoadingRows = () => (
  <tr>
    <td colSpan={8} className="py-20 text-center">
      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <span className="loading loading-md loading-spinner" aria-hidden="true" />
        <span className="text-sm text-base-content/40">Loading…</span>
      </div>
    </td>
  </tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// APPOINTMENT TABLE ROW
// ─────────────────────────────────────────────────────────────────────────────

const AppointmentRow = memo(({ booking, index, opByBooking, onComplete, onCancel, onConfirm, onReject, confirmLoading, onPayAtService, router }) => {
  const op       = opByBooking[booking._id?.toString()];
  const joinable = canJoinConsult(booking);
  const consultId = getConsultationId(booking);
  const showConfirmReject = canConfirmReject(booking);

  return (
    <motion.tr
      key={booking._id}
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0, transition: { delay: Math.min(index * 0.03, 0.3) } }}
      exit={{ opacity: 0 }}
      className="hover:bg-base-200 cursor-default group"
    >
      <td>
        <div className="flex items-center gap-2.5">
          <PatientAvatar booking={booking} />
          <div>
            <p className="font-semibold text-sm text-base-content leading-tight">{getPatientName(booking)}</p>
            <p className="text-xs text-base-content/60">{getPatientPhone(booking)}</p>
          </div>
        </div>
      </td>
      <td>
        <p className="font-mono text-xs font-bold text-primary">{booking.bookingCode ?? '—'}</p>
        <p className="text-xs text-base-content/60">{BOOKING_TYPE_LABEL[booking.bookingType] ?? booking.bookingType ?? '—'}</p>
      </td>
      <td><ConsultTypeBadge type={booking.consultationType} /></td>
      <td><p className="text-sm">{formatDate(booking.scheduledAt)}</p></td>
      <td><StatusBadge status={booking.status} /></td>
      <td>
        <span className={`text-xs font-semibold ${
          isBookingPaid(booking) ? 'text-success' :
          ['unpaid', 'failed'].includes(booking.paymentStatus) ? 'text-error' : 'text-warning'
        }`}>
          {booking.paymentStatus?.replace(/_/g, ' ').toUpperCase() ?? '—'}
        </span>
      </td>
      <td>
        {op ? (
          <button
            onClick={() => router.push(`/doctor/op-records/${op._id}`)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            <FileText size={11} aria-hidden="true" />
            {op.opNumber ?? 'View'}
          </button>
        ) : <span className="text-xs text-base-content/40">—</span>}
      </td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-1">
          {/* Confirm / Reject — pending bookings */}
          {showConfirmReject && (
            <>
              <button
                className="btn btn-success btn-xs gap-1"
                disabled={confirmLoading}
                title="Confirm / Accept booking"
                onClick={() => onConfirm(booking)}
              >
                {confirmLoading ? <span className="loading loading-xs loading-spinner" /> : <ThumbsUp size={12} aria-hidden="true" />}
                <span className="hidden lg:inline">Confirm</span>
              </button>
              <button
                className="btn btn-error btn-xs gap-1"
                disabled={confirmLoading}
                title="Reject booking"
                onClick={() => onReject(booking)}
              >
                <ThumbsDown size={12} aria-hidden="true" />
                <span className="hidden lg:inline">Reject</span>
              </button>
            </>
          )}

          {/* Call patient */}
          {booking?.patientInfo?.phone && (
             <a href={`tel:${booking.patientInfo.phone}`}
              className="btn btn-ghost btn-xs btn-circle text-success"
              title={`Call ${getPatientName(booking)}: ${booking.patientInfo.phone}`}
            >
              <Phone size={13} aria-hidden="true" />
            </a>
          )}

          {/* Pay-at-service */}
          {canShowQrPay(booking) && (
            <button
              className="btn btn-ghost btn-xs btn-circle text-primary"
              title="Pay at service / QR"
              onClick={() => onPayAtService({
                bookingId:   String(booking._id),
                bookingCode: booking.bookingCode,
                amount:      booking.fareBreakdown?.totalAmount ?? 0,
              })}
            >
              <QrCode size={13} aria-hidden="true" />
            </button>
          )}

          {joinable && consultId && (
            <button
              className="btn btn-info btn-xs gap-1"
              onClick={() => router.push(`/doctor/consultation/${consultId}`)}
            >
              <Video size={12} aria-hidden="true" />
              <span className="hidden lg:inline">Join</span>
            </button>
          )}

          <button
            className="btn btn-ghost btn-xs gap-1 text-accent hover:bg-accent/10"
            onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`)}
          >
            <PenLine size={13} aria-hidden="true" />
            <span className="hidden lg:inline text-xs">Prescribe</span>
          </button>

          <ActionMenu
            booking={booking}
            opRecord={op}
            onComplete={onComplete}
            onCancel={onCancel}
            onConfirm={onConfirm}
            onReject={onReject}
            confirmLoading={confirmLoading}
            router={router}
          />
        </div>
      </td>
    </motion.tr>
  );
});
AppointmentRow.displayName = 'AppointmentRow';

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE CARD
// ─────────────────────────────────────────────────────────────────────────────

const MobileCard = memo(({ booking, index, opByBooking, onComplete, onCancel, onConfirm, onReject, confirmLoading, onPayAtService, router }) => {
  const op = opByBooking[booking._id?.toString()];
  const joinable = canJoinConsult(booking);
  const consultId = getConsultationId(booking);
  const showConfirmReject = canConfirmReject(booking);

  return (
    <motion.div
      key={booking._id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index * 0.05, 0.3) } }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-3 bg-base-100 border-b border-base-200"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <PatientAvatar booking={booking} />
          <div>
            <p className="font-bold text-sm">{getPatientName(booking)}</p>
            <p className="text-xs text-base-content/60 font-mono">{booking.bookingCode}</p>
          </div>
        </div>
        <StatusBadge status={booking.status} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-base-content/50 mb-0.5">Scheduled</p>
          <p>{formatDate(booking.scheduledAt)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-base-content/50 mb-0.5">Type</p>
          <ConsultTypeBadge type={booking.consultationType} />
        </div>
      </div>

      {showConfirmReject && (
        <div className="flex gap-2">
          <button
            className="btn btn-success btn-sm flex-1 gap-1 text-xs"
            disabled={confirmLoading}
            onClick={() => onConfirm(booking)}
          >
            {confirmLoading ? <span className="loading loading-xs loading-spinner" /> : <ThumbsUp size={12} aria-hidden="true" />}
            Confirm
          </button>
          <button
            className="btn btn-error btn-sm flex-1 gap-1 text-xs"
            disabled={confirmLoading}
            onClick={() => onReject(booking)}
          >
            <ThumbsDown size={12} aria-hidden="true" />
            Reject
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {joinable && consultId && (
          <button
            onClick={() => router.push(`/doctor/consultation/${consultId}`)}
            className="btn btn-info btn-sm flex-1 gap-1 text-xs"
          >
            <Video size={12} aria-hidden="true" /> Join Call
          </button>
        )}
        <button
          className="btn btn-primary btn-sm flex-1 gap-1 text-xs"
          onClick={() => router.push(`/doctor/prescriptions/new?bookingId=${booking._id}`)}
        >
          <PenLine size={12} aria-hidden="true" /> Prescribe
        </button>

        {booking?.patientInfo?.phone && (
          <a href={`tel:${booking.patientInfo.phone}`}
            className="btn btn-success btn-sm gap-1 text-xs"
          >
            <Phone size={12} /> Call
          </a>
        )}

        {canShowQrPay(booking) && (
          <button
            className="btn btn-outline btn-sm gap-1 text-xs"
            onClick={() => onPayAtService({
              bookingId:   String(booking._id),
              bookingCode: booking.bookingCode,
              amount:      booking.fareBreakdown?.totalAmount ?? 0,
            })}
          >
            <QrCode size={12} /> QR Pay
          </button>
        )}

        {op && (
          <button
            className="btn btn-outline btn-sm gap-1 text-xs"
            onClick={() => router.push(`/doctor/op-records/${op._id}`)}
          >
            <FileText size={12} aria-hidden="true" /> OP
          </button>
        )}
        <div className="flex-none">
          <ActionMenu
            booking={booking}
            opRecord={op}
            onComplete={onComplete}
            onCancel={onCancel}
            onConfirm={onConfirm}
            onReject={onReject}
            confirmLoading={confirmLoading}
            router={router}
          />
        </div>
      </div>
    </motion.div>
  );
});
MobileCard.displayName = 'MobileCard';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEDULE TAB
// ─────────────────────────────────────────────────────────────────────────────

const ScheduleTab = memo(({ router }) => {
  const doctorSchedule = useSelector(selectDoctorSchedule);

  if (!doctorSchedule?.length) {
    return (
      <div className="py-16 text-center text-base-content/40">
        <Calendar size={36} strokeWidth={1} className="mx-auto mb-3" />
        <p>No schedule found</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-base-200">
      {doctorSchedule.map((item, i) => {
        const consultId = item?.consultationSessionId
          ? String(item.consultationSessionId)
          : null;

        return (
          <motion.div
            key={item._id ?? i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }}
            className="flex items-center justify-between p-4 hover:bg-base-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 flex-shrink-0">
                <Calendar size={16} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">{getPatientName(item)}</p>
                <p className="text-xs text-base-content/60">{formatDate(item.scheduledAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={item.status} />
              {canJoinConsult(item) && consultId && (
                <button
                  className="btn btn-info btn-xs gap-1"
                  onClick={() => router.push(`/doctor/consultation/${consultId}`)}
                >
                  <Video size={12} />
                  Join
                </button>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
});
ScheduleTab.displayName = 'ScheduleTab';

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY TAB
// ─────────────────────────────────────────────────────────────────────────────

const HistoryTab = memo(({ router }) => {
  const dispatch = useDispatch();
  const history = useSelector(selectConsultationList);
  const loading = useSelector(selectConsultLoading('fetch'));
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(fetchDoctorHistory({ page, limit: 10 }));
  }, [page, dispatch]);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <span className="loading loading-md loading-spinner" />
      </div>
    );
  }

  if (!history?.length) {
    return (
      <div className="py-16 text-center text-base-content/40">
        <History size={36} strokeWidth={1} className="mx-auto mb-3" />
        <p>No consultation history</p>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-base-200">
        {history.map((c, i) => (
          <motion.div
            key={c._id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
            className="flex items-center justify-between p-4 hover:bg-base-200"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-base-300 flex items-center justify-center text-sm font-bold">
                {(c.patientSnapshot?.name?.[0] ?? '?').toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm">{c.patientSnapshot?.name ?? '—'}</p>
                <p className="text-xs text-base-content/60">{formatDate(c.scheduledAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={c.status} />
              <button
                className="btn btn-ghost btn-xs"
                onClick={() => router.push(`/doctor/appointments/${c.booking ?? c._id}`)}
              >
                <Eye size={12} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex justify-center gap-2 p-4">
        <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft size={16} />
        </button>
        <span className="btn btn-ghost btn-sm pointer-events-none">{page}</span>
        <button className="btn btn-ghost btn-sm" disabled={history.length < 10} onClick={() => setPage((p) => p + 1)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
});
HistoryTab.displayName = 'HistoryTab';

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE SESSIONS TAB
// ─────────────────────────────────────────────────────────────────────────────

const ActiveTab = memo(({ router }) => {
  const dispatch = useDispatch();
  const active = useSelector((s) => s.consultation?.doctorActive ?? []);
  const loading = useSelector(selectConsultLoading('fetch'));

  useEffect(() => {
    dispatch(fetchDoctorActive());
  }, [dispatch]);

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <span className="loading loading-md loading-spinner" />
      </div>
    );
  }

  if (!active?.length) {
    return (
      <div className="py-16 text-center text-base-content/40">
        <Radio size={36} strokeWidth={1} className="mx-auto mb-3" />
        <p>No active sessions</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-base-200">
      {active.map((session, i) => (
        <motion.div
          key={session._id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between p-4 hover:bg-base-200"
        >
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-success/10">
              <Radio size={16} className="text-success" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-sm">{session.patientSnapshot?.name ?? '—'}</p>
              <p className="text-xs text-base-content/60">Started {formatDate(session.sessionStartedAt)}</p>
            </div>
          </div>
          <button
            className="btn btn-success btn-sm gap-1"
            onClick={() => router.push(`/doctor/consultation/${session._id}`)}
          >
            <Video size={12} />
            Rejoin
          </button>
        </motion.div>
      ))}
    </div>
  );
});
ActiveTab.displayName = 'ActiveTab';

// ─────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────

const Pagination = memo(({ page, totalPages, total, onPage }) => {
  const window_ = useMemo(() => {
    const max = 5;
    const start = Math.max(1, Math.min(page - Math.floor(max / 2), totalPages - max + 1));
    const end = Math.min(totalPages, start + max - 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav className="border-t border-base-300 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
      <p className="text-sm text-base-content/50">
        Page {page} of {totalPages} · {total} appointments
      </p>
      <div className="flex items-center gap-2">
        <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => onPage((p) => Math.max(1, p - 1))}>
          <ChevronLeft size={16} />
        </button>
        {window_.map((n) => (
          <button
            key={n}
            className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => onPage(n)}
          >
            {n}
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => onPage((p) => Math.min(totalPages, p + 1))}>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
});
Pagination.displayName = 'Pagination';

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR
// ─────────────────────────────────────────────────────────────────────────────

const FilterBar = memo(({
  searchRaw, setSearchRaw,
  statusFilter, setStatusFilter,
  consType, setConsType,
  from, setFrom,
  to, setTo,
  hasFilters, onClear,
}) => (
  <section className="bg-base-100 border border-base-300 rounded-2xl p-4 flex flex-wrap gap-3 items-center">
    <div className="relative flex-1 min-w-[200px]">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
      <input
        className="input input-sm input-bordered w-full pl-9"
        placeholder="Search patient, booking code, phone…"
        value={searchRaw}
        onChange={(e) => setSearchRaw(e.target.value)}
      />
    </div>
    <div className="flex flex-wrap gap-1.5">
      {STATUSES.map((s) => (
        <button
          key={s.value}
          onClick={() => setStatusFilter(s.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
            statusFilter === s.value
              ? 'border-primary bg-primary text-primary-content'
              : 'border-base-300 text-base-content/60 hover:border-primary/40'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
    <select
      className="select select-sm select-bordered w-auto min-w-[130px]"
      value={consType}
      onChange={(e) => setConsType(e.target.value)}
    >
      {CONSULT_TYPES.map((t) => (
        <option key={t.value} value={t.value}>{t.label}</option>
      ))}
    </select>
    <div className="flex flex-col sm:flex-row items-center gap-1.5">
      <input type="date" className="input input-sm input-bordered w-auto" value={from} onChange={(e) => setFrom(e.target.value)} />
      <span className="text-base-content/30 text-sm">→</span>
      <input type="date" className="input input-sm input-bordered w-auto" value={to} onChange={(e) => setTo(e.target.value)} />
    </div>
    {hasFilters && (
      <button className="btn btn-ghost btn-sm text-error gap-1" onClick={onClear}>
        <XCircle size={13} /> Clear
      </button>
    )}
  </section>
));
FilterBar.displayName = 'FilterBar';

const QRCodeImage = memo(({ value, size = 200 }) => {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { width: size, margin: 1 })
      .then(setDataUrl)
      .catch((e) => console.error('[QRCodeImage]', e.message));
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center bg-base-200 rounded-lg">
        <span className="loading loading-sm loading-spinner" />
      </div>
    );
  }

  return <img src={dataUrl} alt="Scan to pay" width={size} height={size} className="rounded-lg border border-base-300" />;
});
QRCodeImage.displayName = 'QRCodeImage';

// ─────────────────────────────────────────────────────────────────────────────
// PAY-AT-SERVICE PANEL (modal/drawer content)
// ─────────────────────────────────────────────────────────────────────────────

const PayAtServicePanel = memo(({ bookingId, bookingCode, amount, onClose }) => {
  const dispatch  = useDispatch();
  const session   = useSelector(selectPayAtServiceSession(bookingId));
  const loadFlags = useSelector(selectPayAtServiceLoading);
  const canComplete = useSelector(selectCanMarkComplete(bookingId));
  const needsNew    = useSelector(selectNeedsNewLink(bookingId));

  const [cashAmt,   setCashAmt]   = useState(amount ?? '');
  const [cashNote,  setCashNote]  = useState('');
  const [pollTimer, setPollTimer] = useState(null);

  // Poll every 5s when link active and not yet paid
  useEffect(() => {
    if (!session?.shortUrl || session?.paid || session?.expired) return;
    const id = setInterval(() => {
      dispatch(fetchPayAtServiceStatus({ bookingId }));
    }, 5000);
    setPollTimer(id);
    return () => clearInterval(id);
  }, [session?.shortUrl, session?.paid, session?.expired, bookingId, dispatch]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (pollTimer) clearInterval(pollTimer);
    dispatch(clearSession({ bookingId }));
  }, [bookingId, dispatch, pollTimer]);

  const handleGenerate = () => dispatch(generatePayAtServiceLink({ bookingId }));

  const handleCashCollect = () => {
    const n = parseFloat(cashAmt);
    if (!n || n <= 0) return toast.error('Enter valid amount');
    dispatch(markCollectedByPartner({ bookingId, amount: n, method: 'cash', note: cashNote }));
  };

  const handleComplete = () => dispatch(markServiceComplete({ bookingId }));

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="w-full max-w-md bg-base-100 rounded-2xl border border-base-300 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-base-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <QrCode size={18} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm">Pay at Service</p>
                <p className="text-xs text-base-content/50">#{bookingCode} · {fmt(amount)}</p>
              </div>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle">✕</button>
          </div>

          <div className="p-5 space-y-4">

            {/* Status badge */}
            {session?.paid && (
              <div className="flex items-center gap-2 p-3 bg-success/10 rounded-xl border border-success/20">
                <CheckCircle2 size={16} className="text-success" />
                <div>
                  <p className="text-sm font-bold text-success">Payment Confirmed</p>
                  <p className="text-xs text-base-content/60">{fmt(session.amount)} received</p>
                </div>
              </div>
            )}

            {session?.shortUrl   && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-xl border border-warning/20">
                  <Clock3 size={16} className="text-warning" />
                  <div>
                    <p className="text-sm font-semibold text-warning">Awaiting Payment</p>
                    <p className="text-xs text-base-content/60">Sent via SMS + Email to customer</p>
                  </div>
                </div>

                {session.qrCodeDataUrl && (
                  <div className="flex flex-col items-center gap-2 p-4 bg-base-100 rounded-xl border border-base-300">
                    <img src={session.qrCodeDataUrl} alt="Scan to pay" width={200} height={200} className="rounded-lg" />
                    <p className="text-xs text-base-content/50 text-center break-all">{session.shortUrl}</p>
                    <p className="text-xs font-semibold text-primary">Ask customer to scan with phone camera</p>
                  </div>
                )}
              </div>
            )}

            {(needsNew || !session?.shortUrl) && !session?.paid && (
              <div className="space-y-2">
                <p className="text-xs text-base-content/60">Generate Razorpay QR link — show to customer</p>
                <button
                  className="btn btn-primary w-full gap-2"
                  disabled={loadFlags.generateLink}
                  onClick={handleGenerate}
                >
                  {loadFlags.generateLink
                    ? <span className="loading loading-xs loading-spinner" />
                    : <QrCode size={15} />}
                  {needsNew ? 'Regenerate QR Link' : 'Generate QR Link'}
                </button>
              </div>
            )}

            {/* Cash fallback */}
            {!session?.paid && (
              <div className="border border-base-300 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50 flex items-center gap-1.5">
                  <DollarSign size={12} /> Cash / Manual Fallback
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="input input-bordered input-sm flex-1"
                    placeholder={`Amount (₹)`}
                    value={cashAmt}
                    onChange={(e) => setCashAmt(e.target.value)}
                  />
                  <input
                    type="text"
                    className="input input-bordered input-sm flex-1"
                    placeholder="Note (optional)"
                    value={cashNote}
                    onChange={(e) => setCashNote(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-outline btn-sm w-full gap-2"
                  disabled={loadFlags.markCollected}
                  onClick={handleCashCollect}
                >
                  {loadFlags.markCollected
                    ? <span className="loading loading-xs loading-spinner" />
                    : <Wallet size={13} />}
                  Mark Cash Collected
                </button>
              </div>
            )}

            {/* Complete service */}
            {canComplete && (
              <button
                className="btn btn-success w-full gap-2"
                disabled={loadFlags.markComplete}
                onClick={handleComplete}
              >
                {loadFlags.markComplete
                  ? <span className="loading loading-xs loading-spinner" />
                  : <CheckCircle2 size={15} />}
                Mark Service Complete
              </button>
            )}

            {session?.serviceCompleted && (
              <div className="text-center text-xs text-success font-semibold py-1">
                ✅ Service marked complete
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
});
PayAtServicePanel.displayName = 'PayAtServicePanel';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function AppointmentsManagement() {
  const dispatch = useDispatch();
  const router   = useRouter();

  // ── Redux ──────────────────────────────────────────────────────────────────
  const appointments = useSelector(selectDoctorAppointments);
  const total        = useSelector(selectDoctorAppointmentsTotal);
  const opRecords    = useSelector(selectOPRecords);
  const loadingAppts = useSelector(selectClinicalLoading('fetchDoctorAppointments'));
  const loadingOP    = useSelector(selectClinicalLoading('completeOPRecord'));
  const error        = useSelector(selectClinicalError('fetchDoctorAppointments'));
  const doctorStats  = useSelector(selectDoctorStats);

  // Confirm/Reject loading (operationsSlice — accept & confirm share the
  // 'accept' loading key for the button; reject reuses cancel loading below)
  const acceptLoading  = useSelector(selectAcceptConsultationLoading);
  const confirmLoading = useSelector(selectConfirmConsultationLoading);
  const confirmRejectBusy = acceptLoading || confirmLoading;

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('appointments');

  // ── Filter state ───────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('');
  const [consType,     setConsType]     = useState('');
  const [searchRaw,    setSearchRaw]    = useState('');
  const [from,         setFrom]         = useState('');
  const [to,           setTo]           = useState('');
  const [page,         setPage]         = useState(1);

  const search = useDebounce(searchRaw, SEARCH_DEBOUNCE_MS);

  // ── Complete modal ─────────────────────────────────────────────────────────
  const [completeTarget, setCompleteTarget] = useState(null);
  const [showComplete,   setShowComplete]   = useState(false);

  // Pay-at-service panel state
  const [payTarget, setPayTarget] = useState(null); // { bookingId, bookingCode, amount }

  // ── Fetch data ─────────────────────────────────────────────────────────────
  const fetchData = useCallback(() => {
    dispatch(fetchDoctorAppointments({
      status:           statusFilter || undefined,
      consultationType: consType     || undefined,
      from:             from         || undefined,
      to:               to           || undefined,
      search:           search       || undefined,
      page,
      limit: PAGE_LIMIT,
    }));
    dispatch(fetchOPRecords({ page: 1, limit: 200 }));
    dispatch(fetchDoctorStats());
    dispatch(fetchDoctorSchedule());
    dispatch(fetchDoctorMy({ page: 1, limit: 50 }));
  }, [dispatch, statusFilter, consType, search, from, to, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Reset page on filter change
  const filtersKey  = `${statusFilter}|${consType}|${search}|${from}|${to}`;
  const prevFilters = useRef(filtersKey);
  useEffect(() => {
    if (prevFilters.current !== filtersKey) {
      prevFilters.current = filtersKey;
      setPage(1);
    }
  }, [filtersKey]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const opByBooking = useMemo(() => {
    const map = {};
    (opRecords || []).forEach((op) => {
      const bk = bookingIdFromOP(op);
      if (!bk) return;
      const existing = map[bk];
      if (!existing || new Date(op.updatedAt) > new Date(existing.updatedAt)) {
        map[bk] = op;
      }
    });
    return map;
  }, [opRecords]);

  const stats = useMemo(() => {
    const appts = appointments || [];
    const today = new Date().toDateString();
    return {
      total,
      completed: appts.filter((a) => a.status === 'completed').length,
      today: appts.filter((a) => {
        try { return new Date(a.scheduledAt).toDateString() === today; } catch { return false; }
      }).length,
      pending: appts.filter((a) => ['pending', 'created', 'scheduled', 'confirmed'].includes(a.status)).length,
      online:  appts.filter((a) => ['in_progress', 'active'].includes(a.status) && isOnlineBooking(a)).length,
    };
  }, [appointments, total]);

  const chartData  = useMemo(() => buildChartData(appointments || []), [appointments]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_LIMIT)), [total]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCompleteClick = useCallback((bookingId, opId) => {
    setCompleteTarget({ bookingId, opId });
    setShowComplete(true);
  }, []);

  const handleCompleteSubmit = useCallback(async (body) => {
    if (!completeTarget) return;
    const { opId } = completeTarget;
    if (!opId) {
      toast.error('No OP record linked — cannot complete.');
      setShowComplete(false);
      return;
    }
    await dispatch(completeOPRecord({ id: opId, ...body }));
    setShowComplete(false);
    fetchData();
  }, [completeTarget, dispatch, fetchData]);

  const handleCancelConsultation = useCallback(async (consultationId) => {
    if (!consultationId) return toast.error('Consultation ID not found for this booking.');
    const reason = window.prompt('Reason for cancellation:');
    if (reason === null) return;
    await dispatch(cancelConsultation({ id: String(consultationId), reason: reason || 'Cancelled by doctor' }));
    fetchData();
  }, [dispatch, fetchData]);

  // FIX (new): doctor Confirm/Accept a pending booking. Uses the
  // booking-embedded consultation accept route when a Consultation is
  // already linked (online/video bookings); falls back to the explicit
  // confirm route (accepts consent) otherwise. Both live in operationsSlice.
  const handleConfirmBooking = useCallback(async (booking) => {
    const consultationId = getConsultationId(booking);
    if (!consultationId) {
      toast.error('No linked consultation session — ask admin to confirm this booking.');
      return;
    }
    const action = booking.status === 'created'
      ? confirmConsultation({ consultationId, consentAccepted: true })
      : acceptConsultation({ consultationId });
    await dispatch(action);
    fetchData();
  }, [dispatch, fetchData]);

  // FIX (new): doctor Reject a pending booking — reuses the same
  // cancel-consultation flow (prompts reason, cancels Consultation +
  // booking) already wired for "Cancel Consultation" in the menu.
  const handleRejectBooking = useCallback(async (booking) => {
    const consultationId = getConsultationId(booking);
    if (!consultationId) {
      toast.error('No linked consultation session — ask admin to reject this booking.');
      return;
    }
    await handleCancelConsultation(consultationId);
  }, [handleCancelConsultation]);

  const clearFilters = useCallback(() => {
    setStatusFilter(''); setConsType(''); setFrom(''); setTo(''); setSearchRaw('');
  }, []);

  const hasFilters = !!(statusFilter || consType || from || to || searchRaw);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div data-theme="doctor" className="min-h-screen bg-base-100 text-base-content">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-30 bg-base-100/90 backdrop-blur border-b border-base-300 px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <CalendarDays size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-base-content leading-tight">Appointments</h1>
              <p className="text-xs text-base-content/60">
                {total} total
                {stats.online > 0 && (
                  <span className="ml-2 text-success font-semibold">· {stats.online} live</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchData} disabled={loadingAppts} className="btn btn-ghost btn-sm gap-1.5">
              <RefreshCw size={14} className={loadingAppts ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={() => router.push('/doctor/prescriptions/new')} className="btn btn-primary btn-sm gap-1.5">
              <Plus size={14} />
              New Prescription
            </button>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Stat cards ────────────────────────────────────────────────── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <StatCard icon={Layers}       label="Total"     value={stats.total}     colorKey="primary" sub="All time"      chartData={chartData} />
          <StatCard icon={CalendarDays} label="Today"     value={stats.today}     colorKey="info"    sub="Scheduled today" />
          <StatCard icon={CheckCircle2} label="Completed" value={stats.completed} colorKey="success" sub="This page" />
          <StatCard icon={Clock3}       label="Pending"   value={stats.pending}   colorKey="warning" sub="Awaiting" />
          <StatCard icon={Radio}        label="Live"      value={stats.online}    colorKey="success" sub="In progress" live={stats.online > 0} />
        </section>

        {/* ── Doctor stats from API ──────────────────────────────────────── */}
        {doctorStats && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Consultations', value: doctorStats.totalConsultations ?? 0,  icon: Stethoscope, colorKey: 'primary' },
              { label: 'Avg. Rating',          value: doctorStats.avgRating?.toFixed(1) ?? '—', icon: Star, colorKey: 'warning' },
              { label: 'Completed (Month)',    value: doctorStats.completedThisMonth ?? 0, icon: CheckCircle2, colorKey: 'success' },
              { label: 'Patients',             value: doctorStats.totalPatients ?? 0,      icon: Users, colorKey: 'accent' },
            ].map(({ label, value, icon, colorKey }) => (
              <StatCard key={label} icon={icon} label={label} value={value} colorKey={colorKey} />
            ))}
          </section>
        )}

        {/* ── Tab nav ───────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-base-200 p-1 rounded-xl w-fit" role="tablist">
          {TAB_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              role="tab"
              aria-selected={activeTab === value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === value
                  ? 'bg-base-100 text-primary shadow-sm'
                  : 'text-base-content/60 hover:text-base-content'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {activeTab === 'appointments' && (
            <motion.div
              key="appointments"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <FilterBar
                searchRaw={searchRaw}    setSearchRaw={setSearchRaw}
                statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                consType={consType}      setConsType={setConsType}
                from={from}              setFrom={setFrom}
                to={to}                  setTo={setTo}
                hasFilters={hasFilters}
                onClear={clearFilters}
              />

              {error && (
                <div className="alert alert-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <section className="bg-base-100 border border-base-300 rounded-2xl overflow-visible shadow-sm">
                <div className="overflow-x-auto hidden md:block rounded-t-2xl">
                  <table className="table table-zebra w-full" aria-label="Appointments">
                    <thead className="bg-base-200">
                      <tr>
                        <th scope="col">Patient</th>
                        <th scope="col">Booking</th>
                        <th scope="col">Type</th>
                        <th scope="col">Scheduled</th>
                        <th scope="col">Status</th>
                        <th scope="col">Payment</th>
                        <th scope="col">OP Record</th>
                        <th scope="col" className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingAppts && <LoadingRows />}
                      {!loadingAppts && (appointments || []).length === 0 && <EmptyState />}
                      <AnimatePresence mode="popLayout">
                        {!loadingAppts && (appointments || []).map((booking, i) => (
                          <AppointmentRow
                            key={booking._id}
                            booking={booking}
                            index={i}
                            opByBooking={opByBooking}
                            onComplete={handleCompleteClick}
                            onCancel={handleCancelConsultation}
                            onConfirm={handleConfirmBooking}
                            onReject={handleRejectBooking}
                            confirmLoading={confirmRejectBusy}
                            onPayAtService={setPayTarget}
                            router={router}
                          />
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden divide-y divide-base-300">
                  {loadingAppts && (
                    <div className="py-16 flex justify-center">
                      <span className="loading loading-md loading-spinner" />
                    </div>
                  )}
                  <AnimatePresence>
                    {!loadingAppts && (appointments || []).map((booking, i) => (
                      <MobileCard
                        key={booking._id}
                        booking={booking}
                        index={i}
                        opByBooking={opByBooking}
                        onComplete={handleCompleteClick}
                        onCancel={handleCancelConsultation}
                        onConfirm={handleConfirmBooking}
                        onReject={handleRejectBooking}
                        confirmLoading={confirmRejectBusy}
                        onPayAtService={setPayTarget}
                        router={router}
                      />
                    ))}
                  </AnimatePresence>
                </div>

                <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
              </section>
            </motion.div>
          )}

          {activeTab === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-base-200">
                  <h2 className="font-bold text-base-content">Upcoming Schedule</h2>
                </div>
                <ScheduleTab router={router} />
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-base-200">
                  <h2 className="font-bold text-base-content">Consultation History</h2>
                </div>
                <HistoryTab router={router} />
              </div>
            </motion.div>
          )}

          {activeTab === 'active' && (
            <motion.div key="active" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-base-100 border border-base-300 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-base-200 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <h2 className="font-bold text-base-content">Active Sessions</h2>
                </div>
                <ActiveTab router={router} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <CompleteModal
        open={showComplete}
        onClose={() => setShowComplete(false)}
        onSubmit={handleCompleteSubmit}
        loading={loadingOP}
      />

      {payTarget && (
        <PayAtServicePanel
          bookingId={payTarget.bookingId}
          bookingCode={payTarget.bookingCode}
          amount={payTarget.amount}
          onClose={() => setPayTarget(null)}
        />
      )}
    </div>
  );
}