'use client';
import {
  Phone, Heart, Stethoscope, Radio, Activity, UserCheck,
  Package, Truck, RotateCcw, FileText, TrendingUp, TrendingDown,
  CheckCircle, XCircle, Car, Clock,
} from 'lucide-react';

/* ─── BOOKING TYPE CONFIG ──────────────────────────────────────────────────── */
export const BOOKING_TYPES = [
  'full_care_ride', 'doctor_consultation', 'doctor_online',
  'physiotherapist', 'care_assistant', 'diagnostic_center',
  'diagnostic_home', 'patient_transport', 'follow_up',
];

export const BOOKING_STATUSES = [
  'draft', 'pending', 'confirmed', 'in_progress',
  'completed', 'cancelled', 'no_show', 'refund_pending', 'refunded',
];

export const OP_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show'];

/** Which action tabs each booking type needs */
export const TYPE_ACTION_TABS = {
  full_care_ride:      ['status', 'assign', 'care_ride', 'tracking', 'consultation', 'refund', 'payment', 'op'],
  doctor_consultation: ['status', 'assign', 'op', 'refund', 'payment'],
  doctor_online:       ['status', 'consultation', 'op', 'refund', 'payment'],
  physiotherapist:     ['status', 'assign', 'op', 'refund', 'payment'],
  care_assistant:      ['status', 'assign', 'tracking', 'refund', 'payment'],
  diagnostic_center:   ['status', 'refund', 'payment'],
  diagnostic_home:     ['status', 'assign', 'refund', 'payment'],
  patient_transport:   ['status', 'assign', 'care_ride', 'tracking', 'refund', 'payment'],
  follow_up:           ['status', 'assign', 'op', 'consultation', 'refund', 'payment'],
};

/** Which partner assignment tabs are shown per booking type */
export const TYPE_ASSIGN_TABS = {
  full_care_ride:      ['driver', 'tp', 'care', 'hospital'],
  doctor_consultation: ['hospital'],
  doctor_online:       [],
  physiotherapist:     ['hospital'],
  care_assistant:      ['care'],
  diagnostic_center:   [],
  diagnostic_home:     [],
  patient_transport:   ['driver', 'tp'],
  follow_up:           ['hospital'],
};

export const STATUS_COLORS = {
  draft:          '#94a3b8',
  pending:        '#f59e0b',
  confirmed:      '#3b82f6',
  in_progress:    '#8b5cf6',
  completed:      '#10b981',
  cancelled:      '#ef4444',
  no_show:        '#f97316',
  refund_pending: '#ec4899',
  refunded:       '#06b6d4',
};

export const CHART_COLORS = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16'];

export const STATUS_NOTE_OPTIONS = {
  cancelled: [
    'Patient cancelled — no charge',
    'Patient no-show — cancellation fee applied',
    'Doctor unavailable — rescheduled',
    'Hospital at capacity',
    'Transport unavailable in area',
    'Weather/emergency cancellation',
    'Admin initiated — operational issue',
    'Payment failed — booking auto-cancelled',
    'Duplicate booking — cancelled by admin',
    'Partner rejected — no alternate available',
    'Care assistant unavailable in area',
    'Lab partner capacity full',
    'Patient hospitalised elsewhere',
    'Family emergency — patient request',
    'Administrative error — wrong booking details',
  ],
  confirmed: [
    'Manual confirmation — payment verified',
    'Admin override — special case',
    'Re-confirmed after reschedule',
    'Confirmed after payment verification',
    'Confirmed via offline payment',
    'Insurance pre-auth cleared',
    'Corporate booking confirmed',
    'Subscription benefit applied',
  ],
  refunded: [
    'Full refund — service not rendered',
    'Partial refund — service partially delivered',
    'Goodwill refund — service quality issue',
    'Refund per dispute resolution',
    'Technical error refund',
    'Duplicate payment refund',
    'Insurance refund processed',
    'Subscription benefit refund',
    'Driver no-show — full refund',
    'Doctor no-show — full refund',
  ],
  in_progress: [
    'Admin-initiated start — partner on site',
    'Override start — OTP unavailable',
    'Consultation in progress — confirmed by doctor',
    'Care assistant started task',
    'Transport ride started',
  ],
  completed: [
    'Admin-marked complete — verified by ops team',
    'Manual completion — GPS off',
    'Service confirmed complete by partner',
    'Lab report delivered — marked complete',
    'Consultation completed by doctor',
    'Care task completed — patient confirmation',
  ],
  no_show: [
    'Patient no-show confirmed',
    'Unreachable after 3 attempts',
    'Patient arrived late — slot expired',
    'Wrong address — patient no-show',
    'Doctor confirmed patient absent',
  ],
  pending: [
    'Reverted to pending — payment re-verification needed',
    'Reverted to pending — partner change',
    'Awaiting insurance approval',
    'Pending lab kit delivery',
    'On hold — additional documentation needed',
  ],
  draft: [
    'Reverted to draft — details incomplete',
    'Draft — awaiting patient info',
    'Admin drafted — pending customer approval',
  ],
  refund_pending: [
    'Refund initiated — Razorpay processing',
    'Refund pending — bank processing delay',
    'Partial refund pending review',
    'Escalated to finance team',
  ],
};

export const OP_NOTE_OPTIONS = {
  completed:   ['Consultation completed normally', 'Teleconsultation completed', 'Admin-verified completion', 'Doctor confirmed all done', 'Follow-up scheduled'],
  cancelled:   ['Doctor unavailable', 'Patient no-show', 'Hospital request', 'Emergency cancellation', 'Rescheduled to new slot'],
  no_show:     ['Patient did not appear', 'Unreachable — marked no-show after 30 min', 'Patient confirmed absent via phone'],
  in_progress: ['Consultation started — doctor confirmed', 'Patient in consultation room', 'Teleconsult in progress'],
  scheduled:   ['Reverted to scheduled — error correction', 'Rescheduled by doctor', 'Reschedule requested by patient'],
};

export const CA_STATUS_LABELS = {
  not_joined: 'Not Joined', en_route_to_pickup: 'En Route',
  at_pickup: 'At Pickup', in_ride: 'In Ride', departed: 'Departed',
};

export const CA_STATUS_COLORS = {
  not_joined: 'text-base-content/40', en_route_to_pickup: 'text-warning',
  at_pickup: 'text-info', in_ride: 'text-success', departed: 'text-base-content/50',
};

export const ACTIVE_RIDE_STATUSES = [
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived', 'otp_verified', 'in_progress', 'at_stop', 'completed',
];

export const REJECTED_RIDE_STATUSES = ['cancelled'];

export const REFUND_REASONS = [
  'Full refund — service not rendered',
  'Partial refund — service partially delivered',
  'Goodwill refund — quality complaint',
  'Technical error — duplicate charge',
  'Driver no-show',
  'Care assistant no-show',
  'Hospital appointment cancelled',
  'Per dispute resolution — customer escalation',
  'Refund per management approval',
  'Insurance claim processed',
  'Subscription benefit reversal',
];

/* ─── FORMAT HELPERS ───────────────────────────────────────────────────────── */
export const fmt     = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const currency = (n) => n != null ? `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : '—';
export const pct     = (a, b) => b ? ((a / b) * 100).toFixed(1) : '0.0';

export const resolveConsultId = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') return String(raw._id ?? raw);
  return String(raw);
};

export const telLink = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).trim().replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : null;
};

export function getDriverAssignmentState(booking) {
  const primary = booking?.primaryRide;
  if (primary?.status) {
    if (REJECTED_RIDE_STATUSES.includes(primary.status)) return { state: 'rejected', ride: primary };
    if (ACTIVE_RIDE_STATUSES.includes(primary.status)) return { state: 'assigned', ride: primary };
  }
  const rides = booking?.rides ?? [];
  const lastCancelled = [...rides].reverse().find(r => r.status === 'cancelled');
  if (lastCancelled) return { state: 'rejected', ride: lastCancelled };
  return { state: 'none', ride: null };
}

/* ─── MICRO COMPONENTS ─────────────────────────────────────────────────────── */

export function statusBadge(status) {
  const color = STATUS_COLORS[status] ?? '#94a3b8';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase border"
      style={{ background: color + '22', color, borderColor: color + '55' }}
    >
      {status?.replace(/_/g, ' ')}
    </span>
  );
}

export function CallButton({ phone, label = 'Call', size = 'xs', className = '' }) {
  const href = telLink(phone);
  if (!href) return null;
  return (
    <a
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={`btn btn-${size} gap-1 bg-success/15 text-success border-success/30 hover:bg-success/25 ${className}`}
    >
      <Phone size={size === 'xs' ? 9 : 11} /> {label}
    </a>
  );
}

export function typeIcon(type) {
  const map = {
    full_care_ride:      <Heart       size={12} className="text-rose-400"    />,
    doctor_consultation: <Stethoscope size={12} className="text-blue-400"    />,
    doctor_online:       <Radio       size={12} className="text-violet-400"  />,
    physiotherapist:     <Activity    size={12} className="text-emerald-400" />,
    care_assistant:      <UserCheck   size={12} className="text-amber-400"   />,
    diagnostic_center:   <Package     size={12} className="text-cyan-400"    />,
    diagnostic_home:     <Package     size={12} className="text-teal-400"    />,
    patient_transport:   <Truck       size={12} className="text-indigo-400"  />,
    follow_up:           <RotateCcw   size={12} className="text-pink-400"    />,
  };
  return map[type] ?? <FileText size={12} className="text-base-content/40" />;
}

export function Spinner({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={`animate-spin flex-shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5"
        strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({ icon: Icon = FileText, text = 'No data', sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 gap-3 text-base-content/40">
      <Icon size={32} strokeWidth={1} />
      <p className="text-sm font-semibold m-0">{text}</p>
      {sub && <p className="text-xs text-base-content/30 m-0">{sub}</p>}
    </div>
  );
}

export function StatCard({ label, value, sub, icon: Icon, trend, color = 'var(--primary)', loading }) {
  return (
    <div className="stat-card group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-base-content/50">{label}</span>
        {Icon && <Icon size={14} style={{ color }} />}
      </div>
      {loading ? <div className="skeleton h-7 w-24 mb-1" /> : <p className="stat-card-value" style={{ color }}>{value}</p>}
      {sub && <p className="text-[11px] text-base-content/45 mt-0.5">{sub}</p>}
      {trend != null && (
        <div className={`flex items-center gap-1 text-[11px] font-bold mt-1 ${trend >= 0 ? 'text-success' : 'text-error'}`}>
          {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(trend)}% vs last period
        </div>
      )}
    </div>
  );
}

export function FieldNote({ text }) {
  if (!text) return null;
  return <p className="text-[9px] text-base-content/35 italic mt-0.5 m-0">{text}</p>;
}

export function SectionHeader({ title, sub, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/45 m-0">{title}</p>
        {sub && <p className="text-[11px] text-base-content/35 m-0 mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function InfoRow({ label, value, sub, mono = false, callPhone = null, note = null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-base-300/60 last:border-0">
      <div className="shrink-0 w-28">
        <span className="text-[10px] text-base-content/45">{label}</span>
        {note && <FieldNote text={note} />}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-right min-w-0">
          <p className={`text-xs font-semibold text-base-content truncate m-0 ${mono ? 'font-mono' : ''}`}>{value}</p>
          {sub && <p className="text-[10px] text-base-content/40 m-0">{sub}</p>}
        </div>
        {callPhone && <CallButton phone={callPhone} label="" size="xs" />}
      </div>
    </div>
  );
}

export function PartnerStatusBanner({ booking }) {
  const driverState  = getDriverAssignmentState(booking);
  const caAssigned   = !!booking?.careAssistantSnapshot?.name || !!booking?.careAssistant;
  const tpAssigned   = !!booking?.transportPartner;
  const hospAssigned = !!booking?.hospital;

  const items = [];

  if (driverState.state === 'assigned') {
    items.push(
      <div key="drv-ok" className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-[11px] text-success">
        <CheckCircle size={12} />
        <span className="font-bold">Driver Assigned</span>
        {driverState.ride?.driverSnapshot?.legalName && (
          <span className="text-base-content/60">— {driverState.ride.driverSnapshot.legalName}</span>
        )}
        {driverState.ride?.driverSnapshot?.phone && (
          <CallButton phone={driverState.ride.driverSnapshot.phone} label="Call Driver" size="xs" className="ml-auto" />
        )}
        <span className="ml-auto text-[9px] text-success/60 font-medium">{driverState.ride?.status?.replace(/_/g,' ')}</span>
      </div>
    );
  } else if (driverState.state === 'rejected') {
    items.push(
      <div key="drv-rej" className="flex items-center gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-[11px] text-error">
        <XCircle size={12} />
        <span className="font-bold">Partner Rejected</span>
        {driverState.ride?.cancellation?.reason && (
          <span className="text-base-content/60 truncate">— {driverState.ride.cancellation.reason}</span>
        )}
        <span className="ml-auto text-base-content/40 normal-case font-medium">Use Assign tab</span>
      </div>
    );
  }

  if (caAssigned) {
    const caPhone = booking.careAssistantSnapshot?.phone;
    const driveStatus = booking?.primaryRide?.status;
    const caJoined = ['otp_verified','in_progress','at_stop','completed'].includes(driveStatus);
    items.push(
      <div key="ca-ok" className="flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-50/10 px-3 py-2 text-[11px] text-rose-400">
        <CheckCircle size={12} />
        <span className="font-bold">Care Assistant Assigned</span>
        <span className="text-base-content/60">— {booking.careAssistantSnapshot?.name ?? 'Linked'}</span>
        {caPhone && <CallButton phone={caPhone} label="Call CA" size="xs" className="ml-auto" />}
        {caJoined && <span className="text-[9px] bg-success/20 text-success px-1.5 py-0.5 rounded-full font-bold">In Ride</span>}
      </div>
    );
  }

  if (tpAssigned) {
    items.push(
      <div key="tp-ok" className="flex items-center gap-2 rounded-xl border border-indigo-300/30 bg-indigo-50/10 px-3 py-2 text-[11px] text-indigo-400">
        <CheckCircle size={12} />
        <span className="font-bold">Transport Partner Assigned</span>
        {booking.transportPartner?.businessName && <span className="text-base-content/60">— {booking.transportPartner.businessName}</span>}
        {booking.transportPartner?.ownerPhone && <CallButton phone={booking.transportPartner.ownerPhone} label="Call TP" size="xs" className="ml-auto" />}
      </div>
    );
  }

  if (hospAssigned) {
    items.push(
      <div key="hosp-ok" className="flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-50/10 px-3 py-2 text-[11px] text-cyan-400">
        <CheckCircle size={12} />
        <span className="font-bold">Hospital Linked</span>
        <span className="text-base-content/60">— {booking.hospital?.name ?? 'Linked'}</span>
        {booking.hospital?.contact?.phone && <CallButton phone={booking.hospital.contact.phone} label="Call" size="xs" className="ml-auto" />}
      </div>
    );
  }

  if (!items.length) return null;
  return <div className="flex flex-col gap-2 mb-3">{items}</div>;
}

export function RideHistoryList({ rides }) {
  if (!rides?.length) return null;
  return (
    <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto scrollbar-thin">
      {[...rides].reverse().map((r, i) => {
        const isRejected = r.status === 'cancelled';
        const isAssigned = ACTIVE_RIDE_STATUSES.includes(r.status) && !isRejected;
        return (
          <div key={r._id ?? i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-base-300/60 last:border-0">
            <div className="flex items-center gap-2 min-w-0">
              {isRejected ? <XCircle size={10} className="text-error shrink-0" /> : isAssigned ? <CheckCircle size={10} className="text-success shrink-0" /> : <Clock size={10} className="text-base-content/30 shrink-0" />}
              <span className="text-base-content/70 truncate">{r.driverSnapshot?.legalName ?? r.rideType ?? 'Ride'}</span>
              {r.driverSnapshot?.phone && <CallButton phone={r.driverSnapshot.phone} label="" size="xs" />}
            </div>
            <span className={`shrink-0 ml-2 ${isRejected ? 'text-error' : isAssigned ? 'text-success' : 'text-base-content/35'}`}>
              {r.status?.replace(/_/g, ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
