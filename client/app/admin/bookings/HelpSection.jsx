'use client';
import { useState } from 'react';
import {
  HelpCircle, ChevronDown, ChevronUp, ArrowRight,
  Layers, Edit2, UserCheck, DollarSign, Stethoscope,
  Heart, Navigation, Radio, QrCode, BarChart2, FileText,
  CheckCircle, XCircle, AlertTriangle, Phone, Shield,
} from 'lucide-react';

const HELP_SECTIONS = [
  {
    id:    'overview',
    title: 'Bookings Management — Overview',
    icon:  Layers,
    color: 'text-primary',
    content: `This admin dashboard manages all patient service bookings on Likeson.in. 
Each booking represents a healthcare service request — from doctor consultations to full care rides.`,
    items: [
      { label: 'Left panel', text: 'Search, filter, and browse all bookings. Click a card to open details.' },
      { label: 'Right panel', text: 'Full booking detail + 8 action tabs. Tabs shown depend on booking type.' },
      { label: 'Analysis tab', text: 'Revenue, completion rates, charts, and OP record table.' },
    ],
    actionLabel:    'Go to Bookings',
    actionSection:  'bookings',
  },
  {
    id:    'booking-types',
    title: 'Booking Types & What They Need',
    icon:  FileText,
    color: 'text-violet-400',
    content: 'Each booking type has different service requirements and partner assignments.',
    items: [
      { label: 'full_care_ride',      text: 'Doctor + Care Assistant + Driver/TP + Hospital. All partners needed. Live tracking active.' },
      { label: 'doctor_consultation', text: 'Doctor + Hospital. In-person. OP record generated.' },
      { label: 'doctor_online',       text: 'Doctor only. Telemedicine room auto-created on confirm. No transport.' },
      { label: 'physiotherapist',     text: 'Physiotherapist (doctor profile) + Hospital.' },
      { label: 'care_assistant',      text: 'Care Assistant only. Live CA tracking, no driver.' },
      { label: 'patient_transport',   text: 'Solo Driver or Transport Partner. Ride tracking active.' },
      { label: 'diagnostic_center',   text: 'Lab partner handles. No partner assignment from admin.' },
      { label: 'diagnostic_home',     text: 'Home sample collection. Driver for kit delivery.' },
      { label: 'follow_up',           text: 'Linked to parent booking. Doctor + Hospital. OP linked to parent OP.' },
    ],
    actionLabel:   null,
  },
  {
    id:    'status',
    title: 'Status Tab — Lifecycle Management',
    icon:  Edit2,
    color: 'text-warning',
    content: 'Manually transition a booking through its lifecycle. All changes are logged in the status audit trail.',
    items: [
      { label: 'draft',          text: 'Initial state. Details incomplete. Not visible to partners.' },
      { label: 'pending',        text: 'Booking submitted. Awaiting payment or admin confirmation.' },
      { label: 'confirmed',      text: 'Admin/system confirmed. Partners can see and act on it.' },
      { label: 'in_progress',    text: 'Service active — ride started, consultation ongoing, etc.' },
      { label: 'completed',      text: 'Service rendered and confirmed. Final state (with payment).' },
      { label: 'cancelled',      text: 'Cancelled by any party. Subscription usage recovered if applicable.' },
      { label: 'no_show',        text: 'Patient did not appear. Cancellation fee may apply.' },
      { label: 'refund_pending', text: 'Refund initiated. Awaiting gateway processing.' },
      { label: 'refunded',       text: 'Refund completed. Razorpay confirmation received.' },
    ],
    actionLabel:   'Go to Status Tab',
    actionSection: 'status',
  },
  {
    id:    'assign',
    title: 'Assign Tab — Partner Assignment',
    icon:  UserCheck,
    color: 'text-success',
    content: 'Search and assign nearby partners. Only tabs relevant to the booking type are shown.',
    items: [
      { label: 'Solo Drivers',   text: 'Independently onboarded Likeson drivers. Direct assignment, no agency layer.' },
      { label: 'Transport (TP)', text: 'Fleet agencies. Admin assigns TP, then TP assigns their own driver.' },
      { label: 'Care Asst.',     text: 'Nearby verified care assistants. For care_assistant and full_care_ride types.' },
      { label: 'Hospitals',      text: 'Link a hospital for the appointment. Hospital then confirms the slot.' },
      { label: 'Reassign',       text: 'If a partner is already assigned, button changes to Reassign. Enter reason.' },
      { label: 'Rejected',       text: 'If partner rejected, shown in red. Use Assign tab to pick a new one.' },
    ],
    actionLabel:   'Go to Assign Tab',
    actionSection: 'assign',
  },
  {
    id:    'refund',
    title: 'Refund Tab — Process Refunds',
    icon:  DollarSign,
    color: 'text-error',
    content: 'Initiate Razorpay refunds. Wallet payments get credited back. Subscription usage is recovered on refund.',
    items: [
      { label: 'Full refund',    text: 'Leave amount blank. Refunds entire amountPaid from fareBreakdown.' },
      { label: 'Partial refund', text: 'Enter amount. Only that amount is refunded.' },
      { label: 'Reason',         text: 'Required. Stored in status log + sent to Razorpay as note.' },
      { label: 'Already refunded', text: 'Shows prior refund amount. Additional refund still possible.' },
    ],
    actionLabel:   'Go to Refund Tab',
    actionSection: 'refund',
  },
  {
    id:    'op',
    title: 'OP Tab — OutPatient Record',
    icon:  Stethoscope,
    color: 'text-blue-400',
    content: 'View and update the OutPatient record linked to this booking. OP created on booking confirmation for doctor bookings.',
    items: [
      { label: 'OP Number',      text: 'Unique identifier. Patient receives OP card as PDF+ZIP via email.' },
      { label: 'Status update',  text: 'Admin can transition OP status. Notifies doctor and hospital.' },
      { label: 'Doctor notes',   text: 'Admin can add clinical notes to the OP record.' },
      { label: 'Follow-ups',     text: 'OP card includes follow-up eligibility window and fee.' },
    ],
    actionLabel:   'Go to OP Tab',
    actionSection: 'op',
  },
  {
    id:    'care-ride',
    title: 'Care Ride Tab — Create Transport for Care Booking',
    icon:  Heart,
    color: 'text-rose-400',
    content: 'Manually request a ride for an existing care booking when the patient needs transport during service.',
    items: [
      { label: 'Requester type', text: 'care_assistant: CA requested ride. customer: Patient requested ride.' },
      { label: 'Find Nearby',    text: 'Scans nearby solo drivers and TPs. Shows counts + names.' },
      { label: 'Create Care Ride', text: 'Creates a Ride record and links to booking. Then assign a driver from Assign tab.' },
    ],
    actionLabel:   'Go to Care Ride Tab',
    actionSection: 'care_ride',
  },
  {
    id:    'tracking',
    title: 'Tracking Tab — Live Ride Monitoring',
    icon:  Navigation,
    color: 'text-teal-400',
    content: 'Real-time tracking of driver and care assistant for active rides. Powered by socket events.',
    items: [
      { label: 'Driver location', text: 'Live GPS dot on map. Speed + heading shown.' },
      { label: 'CA location',     text: 'For full_care_ride: CA navigates to join point independently.' },
      { label: 'CA Join Point',   text: 'The computed location where CA boards the driver vehicle. Auto-calculated on CA assignment.' },
      { label: 'SOS Alert',       text: 'Red banner if active SOS. Escalate immediately to ops team.' },
      { label: 'Milestones',      text: 'Timestamped events: driver_arrived, otp_verified, ride_completed, etc.' },
      { label: 'care_assistant booking', text: 'CA is primary tracked entity. No driver on map.' },
    ],
    actionLabel:   'Go to Tracking Tab',
    actionSection: 'tracking',
  },
  {
    id:    'consultation',
    title: 'Consultation Tab — Telemedicine Session',
    icon:  Radio,
    color: 'text-violet-400',
    content: 'Manage the Agora-based telemedicine room linked to this booking.',
    items: [
      { label: 'Auto-created',   text: 'For doctor_online bookings, consultation session auto-created on confirm.' },
      { label: 'Manual create',  text: 'For other types, admin can manually create a consultation room.' },
      { label: 'Get Agora Token', text: 'Fetches or provisions host/participant tokens. 2-hour validity.' },
      { label: 'Join Room',      text: 'Opens the consultation room in the doctor interface.' },
      { label: 'Consent',        text: 'Patient must accept telemedicine consent before session starts.' },
    ],
    actionLabel:   'Go to Consultation Tab',
    actionSection: 'consultation',
  },
  {
    id:    'payment',
    title: 'Payment Tab — Pay-at-Service',
    icon:  QrCode,
    color: 'text-cyan-400',
    content: 'Generate QR payment links for patients who pay at the point of service. Supports cash recording.',
    items: [
      { label: 'Generate QR',    text: 'Creates a Razorpay payment link. Patient scans QR or clicks link.' },
      { label: 'Auto-poll',      text: 'Status auto-refreshes every 8 seconds while link is active.' },
      { label: 'Mark Collected', text: 'Record cash/manual payment. Marks paymentStatus as paid.' },
      { label: 'Mark Complete',  text: 'Finalizes service. Triggers invoice email and partner notifications.' },
      { label: 'Link expiry',    text: 'Expired links can be regenerated anytime.' },
    ],
    actionLabel:   'Go to Payment Tab',
    actionSection: 'payment',
  },
  {
    id:    'statuses-legend',
    title: 'Partner Status Indicators',
    icon:  Shield,
    color: 'text-accent',
    content: 'Color-coded banners appear at the top of the detail panel showing current partner assignment states.',
    items: [
      { label: '🟢 Green',  text: 'Partner assigned and active.' },
      { label: '🔴 Red',    text: 'Partner rejected the booking. Reassign needed.' },
      { label: '🔵 Blue',   text: 'Transport Partner assigned. Awaiting their driver pick.' },
      { label: '🩷 Rose',   text: 'Care Assistant assigned. Status shows joined/not joined ride.' },
      { label: '🩵 Cyan',   text: 'Hospital linked. Awaiting hospital slot confirmation.' },
      { label: 'Call button', text: 'Every partner shows a direct call link. Click to dial on mobile.' },
    ],
    actionLabel:   null,
  },
  {
    id:    'analysis',
    title: 'Analysis Section',
    icon:  BarChart2,
    color: 'text-indigo-400',
    content: 'Overview of booking metrics, revenue, and completion rates across all booking types.',
    items: [
      { label: 'Date filter',    text: 'Filter analytics by date range. Updates all charts.' },
      { label: 'Status pie',     text: 'Distribution of bookings across lifecycle statuses.' },
      { label: 'Service bar',    text: 'Most-used service types ranked by volume.' },
      { label: 'Weekly trend',   text: 'Estimated daily bookings, completions, and revenue.' },
      { label: 'OP table',       text: 'All outpatient records with filter by status.' },
    ],
    actionLabel:   'Go to Analysis',
    actionSection: 'analysis',
  },
];

/* ─── HELP SECTION ─────────────────────────────────────────────────────────── */
export function HelpSection({ onNavigate }) {
  const [expanded, setExpanded] = useState(new Set(['overview']));
  const [search,   setSearch]   = useState('');

  const toggle = (id) => setExpanded(p => {
    const next = new Set(p);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const filtered = HELP_SECTIONS.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.items?.some(i => i.label.toLowerCase().includes(search.toLowerCase()) || i.text.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle size={20} className="text-primary" />
            <h3 className="m-0 text-lg">Help & Documentation</h3>
          </div>
          <p className="text-xs text-base-content/50 m-0">Complete guide to Bookings Management. Click any section to expand.</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search help…"
          className="input-field text-xs w-48"
        />
      </div>

      {/* Quick nav */}
      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/45 mb-3">Quick Navigation</p>
        <div className="flex flex-wrap gap-2">
          {HELP_SECTIONS.map(({ id, title, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => {
                const el = document.getElementById(`help-${id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setExpanded(p => new Set([...p, id]));
              }}
              className="btn btn-xs gap-1.5 bg-base-300 text-base-content hover:bg-primary/15 hover:text-primary transition-colors"
            >
              <Icon size={9} className={color} />
              {title.split('—')[0].trim()}
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      {filtered.map(({ id, title, icon: Icon, color, content, items, actionLabel, actionSection }) => (
        <div key={id} id={`help-${id}`} className="rounded-2xl border border-base-300 bg-base-100 overflow-hidden">
          <button
            onClick={() => toggle(id)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-base-200/60 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl bg-base-200 flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} className={color} />
              </div>
              <span className="text-sm font-bold text-base-content">{title}</span>
            </div>
            {expanded.has(id) ? <ChevronUp size={14} className="text-base-content/40 shrink-0" /> : <ChevronDown size={14} className="text-base-content/40 shrink-0" />}
          </button>

          {expanded.has(id) && (
            <div className="px-5 pb-5 border-t border-base-300/60">
              <p className="text-xs text-base-content/60 mt-3 mb-4 leading-relaxed">{content}</p>

              {items?.length > 0 && (
                <div className="flex flex-col gap-1.5 mb-4">
                  {items.map(({ label, text }) => (
                    <div key={label} className="flex gap-3 text-xs py-2 border-b border-base-300/40 last:border-0">
                      <span className="font-bold text-base-content shrink-0 w-36 text-[11px]">{label}</span>
                      <span className="text-base-content/55">{text}</span>
                    </div>
                  ))}
                </div>
              )}

              {actionLabel && actionSection && (
                <button
                  onClick={() => {
                    if (onNavigate) onNavigate(actionSection);
                  }}
                  className="btn btn-sm btn-primary gap-2"
                >
                  <ArrowRight size={11} /> {actionLabel}
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-16 text-base-content/30">
          <HelpCircle size={36} strokeWidth={1} className="mx-auto mb-3" />
          <p className="text-sm font-semibold">No help sections match "{search}"</p>
        </div>
      )}
    </div>
  );
}
