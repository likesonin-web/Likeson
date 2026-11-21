'use client';

import {
  useEffect, useState, useRef, useCallback, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleMap, Marker, DirectionsRenderer, OverlayView } from '@react-google-maps/api';
import { useGoogleMaps } from '@/context/GoogleMapsProvider';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  Star,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Navigation2,
  Car,
  Stethoscope,
  FlaskConical,
  HeartPulse,
  Video,
  Dumbbell,
  Ambulance,
  RotateCcw,
  Home,
  FileText,
  CreditCard,
  Activity,
  Package,
  Shield,
  IndianRupee,
  ThumbsUp,
  RefreshCw,
  Copy,
  ExternalLink,
  Info,
  ChevronRight,
  AlertCircle,
  Lock,
  Timer,
  Banknote,
  Zap,
  Building2,
  TestTube2,
  Navigation,
  CheckCheck,
  TrendingUp,
  Download,
  Radio,
} from 'lucide-react';

import {
  fetchMyBookingById,
  cancelMyBooking,
  rateMyBooking,
  downloadOpCard,
  clearSelectedBooking,
  resetCancelBooking,
  resetRateBooking,
  selectActiveBooking,
  selectActiveBookingLoading,
  selectActiveBookingError,
  selectCancelBooking,
  selectCancelBookingLoading,
  selectRateBooking,
  selectRateBookingLoading,
  selectDownloadOpCardLoading,
} from '@/store/slices/bookingSlice';


import {
  fetchPayAtServiceStatus,
  linkGeneratedFromSocket,
  paidFromSocket,
  serviceCompletedFromSocket,
  clearSession,
  selectPayAtServiceSession,
  selectIsPaid,
  selectNeedsNewLink,
  selectMinutesUntilExpiry,
} from '@/store/slices/payAtServiceSlice';
import QRCode from 'qrcode';
import socketService, { SOCKET_EVENTS } from '@/services/socketService'; // adjust path

// ─── Map Styles ───────────────────────────────────────────────────────────────

const MAP_STYLES_CLEAN = [
  { elementType: 'geometry', stylers: [{ color: '#f8f9ff' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5a6478' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f8f9ff' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f0f2ff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e8ecff' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#8892b0' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dde8ff' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#e0e4f0' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f4f5fc' }] },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_TYPE_META = {
  full_care_ride:      { label: 'Full Care Ride',      icon: Ambulance,    color: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/20' },
  doctor_consultation: { label: 'Doctor Consultation', icon: Stethoscope,  color: 'text-info',      bg: 'bg-info/10',      border: 'border-info/20'    },
  doctor_online:       { label: 'Online Consult',      icon: Video,        color: 'text-accent',    bg: 'bg-accent/5',     border: 'border-accent/20'  },
  physiotherapist:     { label: 'Physiotherapy',       icon: Dumbbell,     color: 'text-success',   bg: 'bg-success/10',   border: 'border-success/20' },
  care_assistant:      { label: 'Care Assistant',      icon: HeartPulse,   color: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/20'},
  diagnostic_center:   { label: 'Diagnostic Center',   icon: FlaskConical, color: 'text-warning',   bg: 'bg-warning/10',   border: 'border-warning/20' },
  diagnostic_home:     { label: 'Home Diagnostics',    icon: Home,         color: 'text-warning',   bg: 'bg-warning/5',    border: 'border-warning/20' },
  patient_transport:   { label: 'Patient Transport',   icon: Car,          color: 'text-accent',    bg: 'bg-accent/5',     border: 'border-accent/20'  },
  follow_up:           { label: 'Follow-Up Visit',     icon: RotateCcw,    color: 'text-info',      bg: 'bg-info/10',      border: 'border-info/20'    },
};

const STATUS_META = {
  draft:          { label: 'Draft',          dotCls: 'bg-base-content/30',    textCls: 'text-base-content/50', bgCls: 'bg-base-300/50'  },
  pending:        { label: 'Pending',        dotCls: 'bg-warning',            textCls: 'text-warning',         bgCls: 'bg-warning/10'   },
  confirmed:      { label: 'Confirmed',      dotCls: 'bg-success',            textCls: 'text-success',         bgCls: 'bg-success/10'   },
  in_progress:    { label: 'In Progress',    dotCls: 'bg-info animate-pulse', textCls: 'text-info',            bgCls: 'bg-info/10'      },
  completed:      { label: 'Completed',      dotCls: 'bg-success',            textCls: 'text-success',         bgCls: 'bg-success/10'   },
  cancelled:      { label: 'Cancelled',      dotCls: 'bg-error',              textCls: 'text-error',           bgCls: 'bg-error/5'      },
  no_show:        { label: 'No Show',        dotCls: 'bg-error',              textCls: 'text-error',           bgCls: 'bg-error/5'      },
  refund_pending: { label: 'Refund Pending', dotCls: 'bg-warning',            textCls: 'text-warning',         bgCls: 'bg-warning/10'   },
  refunded:       { label: 'Refunded',       dotCls: 'bg-base-content/30',    textCls: 'text-base-content/50', bgCls: 'bg-base-300/50'  },
};

const PAYMENT_STATUS_META = {
  unpaid:             { label: 'Unpaid',               cls: 'text-error bg-error/10'      },
  pending:            { label: 'Payment Pending',      cls: 'text-warning bg-warning/10' },
  paid:               { label: 'Paid',                 cls: 'text-success bg-success/10' },
  partially_paid:     { label: 'Partially Paid',       cls: 'text-warning bg-warning/10' },
  failed:             { label: 'Payment Failed',       cls: 'text-error bg-error/10'      },
  refunded:           { label: 'Refunded',             cls: 'text-info bg-info/10'        },
  partially_refunded: { label: 'Partially Refunded',   cls: 'text-info bg-info/10'        },
waived:                  { label: 'Waived',                    cls: 'text-success bg-success/10'  },
  pay_at_service_pending:  { label: 'Awaiting QR Payment',       cls: 'text-warning bg-warning/10'  },
  pay_at_service_paid:     { label: 'Paid via QR',               cls: 'text-success bg-success/10'  },
};

// ─── ID Helpers ───────────────────────────────────────────────────────────────

/**
 * Resolve the MongoDB _id of the consultationSession.
 * Booking.consultationSessionId can be:
 * - null / undefined
 * - string (ObjectId as string)
 * - ObjectId (plain)
 * - populated object { _id, consultationId, meetingLink, ... }
 */
const resolveConsultationId = (consultationSessionId) => {
  if (!consultationSessionId) return null;
  if (typeof consultationSessionId === 'string') return consultationSessionId;
  if (typeof consultationSessionId === 'object') {
    // This line right here automatically extracts the _id from the object!
    return consultationSessionId._id?.toString() ?? null; 
  }
  return null;
};

/**
 * Whether a booking has a linked consultation session.
 */
const hasConsultationSession = (booking) => {
  return !!resolveConsultationId(booking?.consultationSessionId);
};

/**
 * Whether the patient can join the consultation right now.
 * Requires: doctor_online booking OR video consultationType,
 * status confirmed or in_progress, and a linked consultationSessionId.
 */
const canJoinConsultation = (booking) => {
  const isOnline =
    booking?.bookingType === 'doctor_online' ||
    booking?.consultationType === 'video';
  const statusOk = ['confirmed', 'in_progress'].includes(booking?.status);
  return isOnline && statusOk && hasConsultationSession(booking);
};

// ─── Misc Helpers ─────────────────────────────────────────────────────────────

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  }) : '—';

const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  }) : '—';

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n ?? 0);

function isWithin12Hours(scheduledAt) {
  if (!scheduledAt) return false;
  const diff = new Date(scheduledAt).getTime() - Date.now();
  return diff > 0 && diff < 12 * 60 * 60 * 1000;
}

function hoursUntil(scheduledAt) {
  if (!scheduledAt) return null;
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 3600000);
  const min = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${min}m`;
  return `${min}m`;
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: 8 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '', style }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

function BookingDetailsSkeleton() {
  return (
    <div className="min-h-screen bg-base-100" aria-busy="true" aria-label="Loading">
      <div className="h-16 border-b border-base-300 bg-base-100 px-4 flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="w-36 h-4" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>
      <div className="h-32 bg-base-200" />
      <div className="container-custom py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {[260, 200, 180, 140].map((h, i) => (
            <Skeleton key={i} className="w-full rounded-2xl" style={{ height: h }} />
          ))}
        </div>
        <div className="space-y-5">
          <Skeleton className="w-full h-52 rounded-2xl" />
          <Skeleton className="w-full h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Field Info Row ───────────────────────────────────────────────────────────

const FieldRow = memo(function FieldRow({
  label, value, note, mono = false, highlight = false, icon: Icon, badge,
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-base-300/50 last:border-0">
      <div className="flex items-start gap-2 min-w-0 flex-1">
        {Icon && <Icon size={13} className="text-base-content/30 mt-0.5 flex-shrink-0" />}
        <div className="min-w-0">
          <dt className="text-[11px] font-bold uppercase tracking-widest text-base-content/40 leading-none mb-1">
            {label}
          </dt>
          {note && (
            <p className="text-[10px] text-base-content/30 leading-tight mt-0.5">{note}</p>
          )}
        </div>
      </div>
      <dd className={`
        text-right text-sm shrink-0 max-w-[55%] break-words
        ${highlight ? 'font-black text-base-content text-base' : 'font-semibold text-base-content/80'}
        ${mono ? 'font-mono text-xs' : ''}
      `}>
        {badge ? (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${badge}`}>
            {value}
          </span>
        ) : (
          value || <span className="text-base-content/25">—</span>
        )}
      </dd>
    </div>
  );
});

// ─── Section Card ─────────────────────────────────────────────────────────────

const SectionCard = memo(function SectionCard({
  title, subtitle, icon: Icon, iconColor = 'text-primary', iconBg = 'bg-primary/10',
  children, delay = 0, accent,
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.35, delay }}
      className="card overflow-hidden"
    >
      {accent && <div className={`h-0.5 w-full ${accent}`} />}
      <div className="px-5 py-4 border-b border-base-300/60 flex items-center gap-3">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon size={15} className={iconColor} />
        </div>
        <div>
          <h3 className="font-black text-sm text-base-content leading-tight">{title}</h3>
          {subtitle && <p className="text-[10px] text-base-content/40 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 py-2">{children}</div>
    </motion.div>
  );
});

// ─── Route Map ────────────────────────────────────────────────────────────────

const RouteMap = memo(function RouteMap({ patientLocation, destinationLocation, isLoaded }) {
  const [directions, setDirections] = useState(null);
  const [mapReady,   setMapReady]   = useState(false);
  const mapRef = useRef(null);

  const pickupCoords  = patientLocation?.coordinates;
  const dropoffCoords = destinationLocation?.coordinates;

  const pickupLat  = pickupCoords?.[1]  ?? null;
  const pickupLng  = pickupCoords?.[0]  ?? null;
  const dropoffLat = dropoffCoords?.[1] ?? null;
  const dropoffLng = dropoffCoords?.[0] ?? null;

  const pickupPos  = pickupLat  != null ? { lat: pickupLat,  lng: pickupLng  } : null;
  const dropoffPos = dropoffLat != null ? { lat: dropoffLat, lng: dropoffLng } : null;

  const center = pickupPos || dropoffPos || { lat: 16.5062, lng: 80.6480 };

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    setMapReady(true);
    if (pickupLat != null && dropoffLat != null && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend({ lat: pickupLat,  lng: pickupLng  });
      bounds.extend({ lat: dropoffLat, lng: dropoffLng });
      map.fitBounds(bounds, { top: 48, right: 32, bottom: 48, left: 32 });
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  useEffect(() => {
    if (!isLoaded || pickupLat == null || dropoffLat == null) return;
    const svc = new window.google.maps.DirectionsService();
    svc.route({
      origin:      { lat: pickupLat,  lng: pickupLng  },
      destination: { lat: dropoffLat, lng: dropoffLng },
      travelMode:  window.google.maps.TravelMode.DRIVING,
    }, (result, status) => {
      if (status === 'OK') setDirections(result);
    });
  }, [isLoaded, pickupLat, pickupLng, dropoffLat, dropoffLng]);

  if (!pickupCoords && !dropoffCoords) return null;
  if (!isLoaded) return <Skeleton className="w-full h-52 rounded-none" />;

  return (
    <div className="relative w-full h-52">
      {!mapReady && <Skeleton className="absolute inset-0 rounded-none" />}
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={13}
        onLoad={onMapLoad}
        options={{
          styles: MAP_STYLES_CLEAN,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'none',
          clickableIcons: false,
        }}
      >
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor:   'var(--primary, #3b82f6)',
                strokeWeight:  4,
                strokeOpacity: 0.85,
              },
            }}
          />
        )}
        {pickupPos && (
          <OverlayView
            position={pickupPos}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h })}
          >
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-white">
                <MapPin size={13} className="text-primary-content" strokeWidth={2.5} />
              </div>
              <div className="w-0.5 h-2 bg-primary" />
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
          </OverlayView>
        )}
        {dropoffPos && (
          <OverlayView
            position={dropoffPos}
            mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            getPixelPositionOffset={(w, h) => ({ x: -w / 2, y: -h })}
          >
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-success flex items-center justify-center shadow-lg border-2 border-white">
                <MapPin size={13} className="text-white" strokeWidth={2.5} />
              </div>
              <div className="w-0.5 h-2 bg-success" />
              <div className="w-1.5 h-1.5 rounded-full bg-success" />
            </div>
          </OverlayView>
        )}
      </GoogleMap>
      <div className="absolute bottom-2 left-2 flex gap-2 pointer-events-none">
        <div className="flex items-center gap-1 px-2 py-1 bg-white/90 rounded-lg shadow text-[10px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-primary inline-block" />
          Pickup
        </div>
        {dropoffPos && (
          <div className="flex items-center gap-1 px-2 py-1 bg-white/90 rounded-lg shadow text-[10px] font-semibold">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            Destination
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Fare Breakdown ───────────────────────────────────────────────────────────

const FareBreakdown = memo(function FareBreakdown({ fare }) {
  if (!fare) {
    return <p className="text-sm text-base-content/40 py-3">No fare information available.</p>;
  }

  const rows = [
    { label: 'Consultation Fee',  note: 'Doctor / specialist visit charge',            key: 'consultationFee',   show: !!fare.consultationFee   },
    { label: 'Transport Fee',     note: 'Vehicle + driver cost for the trip',          key: 'transportFee',      show: !!fare.transportFee      },
    { label: 'Care Assistant',    note: 'Personal care companion service charge',      key: 'careAssistantFee',  show: !!fare.careAssistantFee  },
    { label: 'Diagnostic Fee',    note: 'Lab test or diagnostic procedure charges',    key: 'diagnosticFee',     show: !!fare.diagnosticFee     },
    { label: 'Home Collection',   note: 'Technician visit to collect sample',          key: 'homeCollectionFee', show: !!fare.homeCollectionFee },
    { label: 'Platform Fee',      note: 'Likeson service and coordination fee',        key: 'platformFee',       show: !!fare.platformFee       },
    { label: 'Taxes & GST',       note: 'Government-applicable statutory charges',     key: 'taxes',             show: !!fare.taxes             },
    { label: 'Discount Applied',  note: 'Promotional or subscription discount',        key: 'discount',          show: !!fare.discount,          isDeduction: true },
    { label: 'Coupon Savings',    note: 'Promo code discount applied at checkout',     key: 'couponDiscount',    show: !!fare.couponDiscount,    isDeduction: true },
    { label: 'Wallet Deducted',   note: 'Likeson wallet credit used for this booking', key: 'walletApplied',     show: !!fare.walletApplied,     isDeduction: true },
  ].filter(r => r.show);

  return (
    <dl className="divide-y divide-base-300/50">
      {rows.map((r) => (
        <div key={r.key} className="flex items-start justify-between py-2.5 gap-3">
          <div>
            <dt className="text-xs font-semibold text-base-content/70">{r.label}</dt>
            <p className="text-[10px] text-base-content/30 mt-0.5">{r.note}</p>
          </div>
          <dd className={`text-sm font-bold shrink-0 ${r.isDeduction ? 'text-success' : 'text-base-content'}`}>
            {r.isDeduction ? '− ' : ''}{fmtINR(Math.abs(fare[r.key] ?? 0))}
          </dd>
        </div>
      ))}
      <div className="flex items-center justify-between pt-3 mt-1">
        <div>
          <dt className="font-black text-sm text-base-content">Total Payable</dt>
          <p className="text-[10px] text-base-content/30 mt-0.5">All charges included</p>
        </div>
        <dd className="font-black text-xl text-primary">{fmtINR(fare.totalAmount)}</dd>
      </div>
      {fare.refundAmount > 0 && (
        <div className="flex items-center justify-between pt-2">
          <div>
            <dt className="text-xs font-bold text-success">Refund Amount</dt>
            <p className="text-[10px] text-success/60 mt-0.5">Will be credited within 5-7 working days</p>
          </div>
          <dd className="text-sm font-bold text-success">{fmtINR(fare.refundAmount)}</dd>
        </div>
      )}
    </dl>
  );
});

// ─── Star Rating Input ────────────────────────────────────────────────────────

const StarInput = memo(function StarInput({ value, onChange, label }) {
  const [hovered, setHovered] = useState(0);
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <motion.button
            key={s}
            type="button"
            whileTap={{ scale: 0.85 }}
            onClick={() => onChange(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="focus:outline-none"
            aria-label={`${s} star${s > 1 ? 's' : ''}`}
          >
            <Star
              size={24}
              className={`transition-colors duration-150 ${
                s <= (hovered || value) ? 'text-warning fill-current' : 'text-base-300'
              }`}
            />
          </motion.button>
        ))}
      </div>
    </fieldset>
  );
});

// ─── 12hr Cancel Warning ──────────────────────────────────────────────────────

function CancelTimeWarning({ scheduledAt }) {
  const h = hoursUntil(scheduledAt);
  if (!h) return null;
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-error/5 border border-error/20 mt-3">
      <Lock size={14} className="text-error flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-error">Cancellation Locked</p>
        <p className="text-[10px] text-error/70 mt-0.5">
          Your appointment is in <strong>{h}</strong>. Cancellations are not allowed within 12 hours of the scheduled time.
        </p>
      </div>
    </div>
  );
}

// ─── Cancel Modal ─────────────────────────────────────────────────────────────

const CancelModal = memo(function CancelModal({ booking, onClose }) {
  const dispatch    = useDispatch();
  const cancelState = useSelector(selectCancelBooking);
  const loading     = useSelector(selectCancelBookingLoading);
  const [reason, setReason] = useState('');
  const textareaRef = useRef(null);

  const tooClose = isWithin12Hours(booking.scheduledAt);
  const canSubmit = !tooClose && reason.trim().length >= 10 && !loading;

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    dispatch(cancelMyBooking({ bookingId: booking._id, reason }));
  }, [dispatch, booking._id, reason, canSubmit]);

  useEffect(() => {
    if (cancelState?.status === 'cancelled') {
      const t = setTimeout(onClose, 2200);
      return () => clearTimeout(t);
    }
  }, [cancelState?.status, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="card w-full max-w-md overflow-hidden"
      >
        {cancelState?.status === 'cancelled' ? (
          <div className="flex flex-col items-center text-center px-6 py-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4"
            >
              <CheckCircle2 size={34} className="text-success" />
            </motion.div>
            <h3 className="font-black text-lg text-base-content">Booking Cancelled</h3>
            {cancelState?.refundAmount > 0 && (
              <p className="text-sm text-base-content/60 mt-2">
                Refund of <strong className="text-success">{fmtINR(cancelState.refundAmount)}</strong>{' '}
                ({cancelState.refundPercent}%) will be processed within 5–7 business days.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-error/10 flex items-center justify-center">
                  <AlertTriangle size={15} className="text-error" />
                </div>
                <div>
                  <h3 id="cancel-title" className="font-black text-sm text-base-content">Cancel Booking</h3>
                  <p className="text-[10px] text-base-content/40">{booking.bookingCode}</p>
                </div>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle">
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {tooClose && <CancelTimeWarning scheduledAt={booking.scheduledAt} />}
              {!tooClose && (
                <div className="alert alert-warning text-xs">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  <span>Cancellation charges may apply. Refund eligibility is calculated automatically.</span>
                </div>
              )}
              <div>
                <label htmlFor="cancel-reason" className="label-text block mb-1">
                  Reason for cancellation *
                </label>
                <p className="text-[10px] text-base-content/40 mb-2">
                  Please provide at least 10 characters.
                </p>
                <textarea
                  id="cancel-reason"
                  ref={textareaRef}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Appointment rescheduled by the doctor…"
                  rows={3}
                  disabled={tooClose}
                  className="input-field w-full resize-none disabled:opacity-40"
                  aria-required="true"
                />
                <p className="text-[10px] text-base-content/30 mt-1 text-right">
                  {reason.length} / min 10 chars
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="btn btn-ghost flex-1">Keep Booking</button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="btn btn-error flex-1 gap-2"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
});

// ─── Rating Modal ─────────────────────────────────────────────────────────────

const RATING_FIELDS_BY_TYPE = {
  full_care_ride:      ['overall', 'doctor', 'driver', 'careAssistant'],
  doctor_consultation: ['overall', 'doctor'],
  doctor_online:       ['overall', 'doctor'],
  physiotherapist:     ['overall', 'doctor'],
  care_assistant:      ['overall', 'careAssistant'],
  diagnostic_center:   ['overall', 'lab'],
  diagnostic_home:     ['overall', 'lab', 'driver'],
  patient_transport:   ['overall', 'driver'],
  follow_up:           ['overall', 'doctor'],
};

const RATING_META = {
  overall:       { label: 'Overall Experience', note: 'How satisfied were you overall?',                   stateKey: 'overallRating',       commentKey: 'overallComment',       icon: Star        },
  doctor:        { label: 'Doctor / Specialist', note: 'Quality of consultation and care',                 stateKey: 'doctorRating',        commentKey: 'doctorComment',        icon: Stethoscope },
  driver:        { label: 'Driver',              note: 'Punctuality, driving and vehicle condition',        stateKey: 'driverRating',        commentKey: 'driverComment',        icon: Car         },
  careAssistant: { label: 'Care Assistant',      note: 'Attentiveness and professionalism',                 stateKey: 'careAssistantRating', commentKey: 'careAssistantComment', icon: HeartPulse  },
  lab:           { label: 'Lab / Diagnostics',   note: 'Sample collection, report accuracy and turnaround', stateKey: 'labRating',           commentKey: 'labComment',           icon: FlaskConical},
};

const RatingModal = memo(function RatingModal({ booking, onClose }) {
  const dispatch  = useDispatch();
  const rateState = useSelector(selectRateBooking);
  const loading   = useSelector(selectRateBookingLoading);

  const fields = RATING_FIELDS_BY_TYPE[booking.bookingType] || ['overall'];

  const [form, setForm] = useState({
    overallRating: 0,       overallComment: '',
    doctorRating: 0,        doctorComment: '',
    driverRating: 0,        driverComment: '',
    careAssistantRating: 0, careAssistantComment: '',
    labRating: 0,           labComment: '',
  });

  const set = useCallback((key, val) => setForm(p => ({ ...p, [key]: val })), []);

  const handleSubmit = useCallback(() => {
    if (!form.overallRating) return;
    dispatch(rateMyBooking({ bookingId: booking._id, ...form }));
  }, [dispatch, booking._id, form]);

  const isSuccess = rateState?.bookingId === booking._id;

  useEffect(() => {
    if (isSuccess) {
      const t = setTimeout(onClose, 2000);
      return () => clearTimeout(t);
    }
  }, [isSuccess, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rating-title"
    >
      <motion.div
        initial={{ opacity: 0, y: 48, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 32, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="card w-full max-w-md overflow-hidden"
      >
        {isSuccess ? (
          <div className="flex flex-col items-center text-center px-6 py-10">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4"
            >
              <ThumbsUp size={30} className="text-warning" />
            </motion.div>
            <h3 className="font-black text-lg">Thank you!</h3>
            <p className="text-sm text-base-content/50 mt-2">
              Your feedback helps us deliver better care.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Star size={15} className="text-warning" />
                </div>
                <div>
                  <h3 id="rating-title" className="font-black text-sm">Rate Your Experience</h3>
                  <p className="text-[10px] text-base-content/40">Your feedback matters</p>
                </div>
              </div>
              <button onClick={onClose} className="btn btn-ghost btn-xs btn-circle">
                <X size={14} />
              </button>
            </div>
            <div className="px-5 py-4 max-h-[68vh] overflow-y-auto scrollbar-thin space-y-5">
              {fields.map((fieldKey) => {
                const meta = RATING_META[fieldKey];
                const FieldIcon = meta.icon;
                return (
                  <div key={fieldKey} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FieldIcon size={13} className="text-base-content/40" />
                      <div>
                        <p className="text-xs font-bold text-base-content">{meta.label}</p>
                        <p className="text-[10px] text-base-content/40">{meta.note}</p>
                      </div>
                    </div>
                    <StarInput
                      label={meta.label}
                      value={form[meta.stateKey]}
                      onChange={(v) => set(meta.stateKey, v)}
                    />
                    <input
                      type="text"
                      placeholder="Leave a comment (optional)"
                      value={form[meta.commentKey]}
                      onChange={(e) => set(meta.commentKey, e.target.value)}
                      className="input-field w-full mt-1"
                      aria-label={`${meta.label} comment`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-base-300">
              <button onClick={onClose} className="btn btn-ghost flex-1">Skip</button>
              <button
                onClick={handleSubmit}
                disabled={loading || !form.overallRating}
                className="btn btn-primary flex-1 gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Submit Rating
              </button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
});

// ─── Timeline Progress ────────────────────────────────────────────────────────

const STATUS_ORDER = [
  { key: 'pending',     label: 'Booking Received', note: 'Your booking request received'       },
  { key: 'confirmed',   label: 'Confirmed',        note: 'Healthcare team confirmed your slot' },
  { key: 'in_progress', label: 'In Progress',      note: 'Your care session is underway'       },
  { key: 'completed',   label: 'Completed',        note: 'Service delivered successfully'      },
];

function BookingTimeline({ status }) {
  const activeIdx = STATUS_ORDER.findIndex(s => s.key === status);
  if (activeIdx < 0 && status !== 'cancelled') return null;

  if (status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 px-1 py-2">
        <div className="w-6 h-6 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
          <X size={12} className="text-error" />
        </div>
        <div>
          <p className="text-xs font-bold text-error">Booking Cancelled</p>
          <p className="text-[10px] text-base-content/40">This booking was cancelled</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {STATUS_ORDER.map((step, idx) => {
        const isDone   = idx < activeIdx;
        const isActive = idx === activeIdx;
        return (
          <div key={step.key} className="flex items-start gap-3 pb-3 last:pb-0">
            <div className="flex flex-col items-center">
              <motion.div
                animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className={`
                  w-6 h-6 rounded-full flex items-center justify-center border-2 flex-shrink-0 mt-0.5
                  ${isDone   ? 'bg-success border-success' : ''}
                  ${isActive ? 'bg-primary border-primary shadow-md shadow-primary/40' : ''}
                  ${!isDone && !isActive ? 'bg-base-100 border-base-300' : ''}
                `}
              >
                {isDone   ? <CheckCheck size={11} className="text-white" />
                          : isActive ? <Zap size={10} className="text-primary-content" />
                          : <span className="w-1.5 h-1.5 rounded-full bg-base-300 block" />}
              </motion.div>
              {idx < STATUS_ORDER.length - 1 && (
                <div className={`w-0.5 h-5 mt-0.5 ${idx < activeIdx ? 'bg-success' : 'bg-base-300'}`} />
              )}
            </div>
            <div className="pt-0.5 flex-1">
              <p className={`text-xs font-bold leading-tight ${isActive ? 'text-primary' : isDone ? 'text-success' : 'text-base-content/30'}`}>
                {step.label}
              </p>
              <p className={`text-[10px] mt-0.5 ${isActive || isDone ? 'text-base-content/40' : 'text-base-content/20'}`}>
                {step.note}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Consultation Session Card ────────────────────────────────────────────────
// Shows session info + join button when booking has consultationSessionId

const ConsultationSessionCard = memo(function ConsultationSessionCard({ booking }) {
  const consultationId  = resolveConsultationId(booking.consultationSessionId);
  
  const joinable        = canJoinConsultation(booking);

  if (!consultationId) return null;

  return (
    <SectionCard
      title="Telemedicine Session"
      subtitle="Your online consultation details"
      icon={Radio}
      iconColor="text-accent"
      iconBg="bg-accent/5"
      delay={0.16}
    >
      <div className="py-2 space-y-3">
        {/* Session info strip */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/20">
          <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Video size={16} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-base-content capitalize">
              {booking.consultationType ?? 'video'} Consultation
            </p>
            
          </div>
          {joinable && (
            <span className="flex items-center gap-1.5 text-[10px] text-success font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Ready
            </span>
          )}
        </div>

        {/* Session ID row */}
        <FieldRow
          label="Session ID"
          note="Reference for support"
          value={String(consultationId)}
          mono
          icon={Radio}
        />

        {/* Join + external meeting link buttons */}
        <div className="flex gap-2 pt-1">
          <Link
            href={`/consultation/${consultationId}`}
            className={`btn flex-1 gap-2 ${joinable ? 'btn-accent' : 'btn-ghost border border-base-300'}`}
          >
            <Video size={14} />
            {joinable ? 'Join Consultation' : 'View Session'}
          </Link>
        </div>

        {!joinable && (
          <p className="text-[10px] text-base-content/30 text-center">
            Join button activates when booking is confirmed and consultation starts
          </p>
        )}
      </div>
    </SectionCard>
  );
});


// ─── Pay-at-Service Card (Customer View) ─────────────────────────────────────
// Shows when booking has payAtService.enabled OR paymentStatus = pay_at_service_pending/paid
// Customer sees: QR code, amount, expiry timer, paid confirmation

const PayAtServiceCard = memo(function PayAtServiceCard({ booking }) {
  const dispatch = useDispatch();
  const session = useSelector(selectPayAtServiceSession(booking._id));
  const isPaid = useSelector(selectIsPaid(booking._id));
  const needsNew = useSelector(selectNeedsNewLink(booking._id));
  const minsLeft = useSelector(selectMinutesUntilExpiry(booking._id));

  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const pollRef = useRef(null);

  const payAtService = booking.payAtService;
  const isPasEnabled = payAtService?.enabled || ['pay_at_service_pending', 'pay_at_service_paid'].includes(booking.paymentStatus);

  // Seed session from booking data on mount (no extra API call needed if data fresh)
  useEffect(() => {
    if (!isPasEnabled) return;
    // If booking already has shortUrl, seed into redux so QR renders immediately
    if (payAtService?.shortUrl && !session?.shortUrl) {
      dispatch(fetchPayAtServiceStatus({ bookingId: booking._id }));
    }
  }, [isPasEnabled]); // eslint-disable-line

  // Generate QR from shortUrl
  useEffect(() => {
    const url = session?.shortUrl ?? payAtService?.shortUrl;
    if (!url || isPaid) return;
    
    setQrLoading(true);
    QRCode.toDataURL(url, {
      width: 260,
      margin: 2,
      color: { dark: '#1e293b', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
      .finally(() => setQrLoading(false));
  }, [session?.shortUrl, payAtService?.shortUrl, isPaid]);

  // Poll every 5s while pending + not paid + not expired
  useEffect(() => {
    if (!isPasEnabled || isPaid || needsNew) {
      clearInterval(pollRef.current);
      return;
    }
    pollRef.current = setInterval(() => {
      dispatch(fetchPayAtServiceStatus({ bookingId: booking._id }));
    }, 5000);
    
    return () => clearInterval(pollRef.current);
  }, [isPasEnabled, isPaid, needsNew, booking._id, dispatch]);

  if (!isPasEnabled) return null;

  const amount = session?.amount ?? payAtService?.amount ?? booking.fareBreakdown?.totalAmount ?? 0;
  const shortUrl = session?.shortUrl ?? payAtService?.shortUrl ?? null;
  const expiresAt = session?.expiresAt ?? payAtService?.expiresAt ?? null;
  const paidAt = session?.paidAt ?? payAtService?.paidAt ?? null;
  const expired = session?.expired ?? (expiresAt ? new Date(expiresAt) < new Date() : false);
  const alreadyPaid = isPaid || ['pay_at_service_paid', 'paid'].includes(booking.paymentStatus);

  return (
    <SectionCard
      title="Pay for Your Service"
      subtitle="Scan QR or use the link to complete payment"
      icon={Banknote}
      iconColor="text-warning"
      iconBg="bg-warning/10"
      accent="bg-gradient-to-r from-warning/60 via-warning/20 to-transparent"
      delay={0.09}
    >
      <div className="py-2 space-y-4">
        {/* ── PAID state ── */}
        {alreadyPaid ? (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-3 py-6"
          >
            <div className="w-16 h-16 rounded-full bg-success/10 border-2 border-success/30 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-success" />
            </div>
            <div className="text-center">
              <p className="font-black text-success text-lg">Payment Received!</p>
              <p className="text-xs text-base-content/50 mt-1">
                {fmtINR(amount)} paid{paidAt ? ` on ${fmtDate(paidAt)} at ${fmtTime(paidAt)}` : ''}
              </p>
              <p className="text-[10px] text-base-content/30 mt-1">
                Your service provider will now complete your service.
              </p>
            </div>
          </motion.div>
        ) : expired ? (
          /* ── EXPIRED state ── */
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center">
              <Timer size={22} className="text-error" />
            </div>
            <div className="text-center">
              <p className="font-bold text-error text-sm">QR Code Expired</p>
              <p className="text-xs text-base-content/40 mt-1">
                This payment link has expired. Ask your service provider to generate a new QR.
              </p>
            </div>
          </div>
        ) : (
          /* ── PENDING / QR state ── */
          <>
            {/* Amount + timer */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-warning/5 border border-warning/20">
              <div>
                <p className="text-[11px] font-bold text-base-content/40 uppercase tracking-wide">Amount Due</p>
                <p className="font-black text-2xl text-warning">{fmtINR(amount)}</p>
              </div>
              {minsLeft != null && minsLeft > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-base-content/30 uppercase tracking-wide">Expires in</p>
                  <p className={`font-black text-lg ${minsLeft <= 10 ? 'text-error' : 'text-base-content/70'}`}>
                    {minsLeft}m
                  </p>
                </div>
              )}
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              {qrLoading && (
                <div className="w-[200px] h-[200px] flex items-center justify-center bg-base-200 rounded-2xl border border-base-300">
                  <Loader2 size={28} className="animate-spin text-warning" />
                </div>
              )}
              {!qrLoading && qrDataUrl && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative p-3 bg-white rounded-2xl shadow-lg border-2 border-warning/30"
                >
                  <img
                    src={qrDataUrl}
                    alt="Payment QR Code"
                    className="w-[200px] h-[200px] block"
                  />
                  {/* Likeson watermark center */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                      <IndianRupee size={14} className="text-warning" />
                    </div>
                  </div>
                </motion.div>
              )}
              {!qrLoading && !qrDataUrl && shortUrl && (
                <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-base-200 rounded-2xl border border-base-300 gap-2">
                  <AlertCircle size={24} className="text-warning" />
                  <p className="text-[10px] text-base-content/40 text-center px-3">QR could not load. Use button below.</p>
                </div>
              )}
              {!shortUrl && (
                <div className="w-[200px] h-[200px] flex flex-col items-center justify-center bg-base-200 rounded-2xl border border-dashed border-base-300 gap-2">
                  <Banknote size={24} className="text-base-content/20" />
                  <p className="text-[10px] text-base-content/30 text-center px-3">
                    Ask your service provider to show the QR code on their device.
                  </p>
                </div>
              )}

              <p className="text-[11px] text-base-content/40 text-center">
                Scan with any UPI app · Google Pay · PhonePe · Paytm
              </p>
            </div>

            {/* Pay via link button */}
            {shortUrl && (
              <a
                href={shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-warning w-full gap-2"
              >
                <ExternalLink size={14} />
                Pay {fmtINR(amount)} Online
              </a>
            )}

            {/* Polling indicator */}
            <div className="flex items-center gap-2 justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              <p className="text-[10px] text-base-content/30">
                Checking payment status automatically…
              </p>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
});

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BookingDetailsPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const params   = useParams();

  const id = params?.bookingId ?? params?.id ?? null;

  const booking        = useSelector(selectActiveBooking);
  const loading        = useSelector(selectActiveBookingLoading);
  const error          = useSelector(selectActiveBookingError);
  const downloadLoading = useSelector(selectDownloadOpCardLoading);

  const [showCancel, setShowCancel] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [copied,     setCopied]     = useState(false);

  const { isLoaded: mapsLoaded } = useGoogleMaps();

  // ── Pay-at-Service + booking socket events via socketService singleton ──
  useEffect(() => {
    if (!id) return;

    // Join booking room so server pushes events to this customer
    socketService.joinBookingRoom(id);

    // Handler: partner generated QR → customer sees QR card appear
    const onLinkGenerated = (data) => {
      if (String(data.bookingId) !== String(id)) return;
      dispatch(linkGeneratedFromSocket(data));
      // Fetch full status so session is seeded with shortUrl + expiry
      dispatch(fetchPayAtServiceStatus({ bookingId: id }));
    };

    // Handler: payment confirmed (webhook fired → server broadcasts)
    const onPaid = (data) => {
      if (String(data.bookingId) !== String(id)) return;
      dispatch(paidFromSocket(data));
    };

    // Handler: booking status changed (service completed, confirmed, etc.)
    const onBookingStatusChange = (data) => {
      if (String(data.bookingId) !== String(id)) return;
      if (data.status === 'completed') {
        dispatch(serviceCompletedFromSocket(data));
        // Refresh full booking so UI reflects completed state
        dispatch(fetchMyBookingById({ bookingId: id }));
      }
    };

    // Register all listeners via socketService
    const offLinkGenerated      = socketService.on('pay_at_service_link_generated', onLinkGenerated);
    const offPaid               = socketService.on('pay_at_service_paid',            onPaid);
    const offBookingStatusChange = socketService.on(
      SOCKET_EVENTS.BOOKING_STATUS_CHANGE,   // 'booking_status_change'
      onBookingStatusChange
    );

    return () => {
      // socketService.on() returns cleanup fn — call them all
      offLinkGenerated?.();
      offPaid?.();
      offBookingStatusChange?.();
      socketService.leaveBookingRoom(id);
      dispatch(clearSession({ bookingId: id }));
    };
  }, [id, dispatch]);

  useEffect(() => {
    if (!id) return;
    dispatch(fetchMyBookingById({ bookingId: id }));
    return () => { dispatch(clearSelectedBooking()); };
  }, [id, dispatch]);

  const handleRefresh = useCallback(() => {
    if (!id) return;
    dispatch(fetchMyBookingById({ bookingId: id }));
  }, [id, dispatch]);

  const handleCopy = useCallback(() => {
    if (!booking?.bookingCode) return;
    navigator.clipboard.writeText(booking.bookingCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, [booking?.bookingCode]);

  const handleCloseCancel = useCallback(() => {
    setShowCancel(false);
    dispatch(resetCancelBooking());
  }, [dispatch]);

  const handleCloseRating = useCallback(() => {
    setShowRating(false);
    dispatch(resetRateBooking());
  }, [dispatch]);

  /**
   * Download OP card ZIP.
   * Uses booking._id (not bookingCode) — thunk hits /my-bookings/:bookingId/op-download
   */
  const handleDownloadOp = useCallback(() => {
    if (!booking?._id) return;
    dispatch(downloadOpCard({
      bookingId: booking._id,
      filename:  `op-card-${booking.bookingCode ?? booking._id}.zip`,
    }));
  }, [dispatch, booking?._id, booking?.bookingCode]);

  // ── No id in URL ──
  if (!id) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6 bg-base-100">
        <div className="w-16 h-16 rounded-2xl bg-warning/10 flex items-center justify-center mb-2">
          <AlertTriangle size={28} className="text-warning" />
        </div>
        <h2 className="font-black text-xl text-base-content">Invalid URL</h2>
        <p className="text-sm text-base-content/50 max-w-xs">
          No booking ID found in the URL. Please go back and select a booking.
        </p>
        <button onClick={() => router.back()} className="btn btn-outline btn-sm gap-2">
          <ArrowLeft size={14} /> Go Back
        </button>
      </main>
    );
  }

  if (loading) return <BookingDetailsSkeleton />;

  if (error || !booking) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-6 bg-base-100">
        <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mb-2">
          <AlertTriangle size={28} className="text-error" />
        </div>
        <h2 className="font-black text-xl text-base-content">Booking Not Found</h2>
        <p className="text-sm text-base-content/50 max-w-xs">
          {error || 'This booking could not be loaded. Please check the link or try again.'}
        </p>
        <div className="flex gap-3 mt-2">
          <button onClick={() => router.back()} className="btn btn-outline btn-sm gap-2">
            <ArrowLeft size={14} /> Go Back
          </button>
          <button onClick={handleRefresh} className="btn btn-primary btn-sm gap-2">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </main>
    );
  }

  const meta  = BOOKING_TYPE_META[booking.bookingType] ?? BOOKING_TYPE_META.patient_transport;
  const sMeta = STATUS_META[booking.status]            ?? STATUS_META.pending;
  const pMeta = PAYMENT_STATUS_META[booking.paymentStatus] ?? PAYMENT_STATUS_META.unpaid;
  const Icon  = meta.icon;

  const canCancel    = ['pending', 'confirmed'].includes(booking.status);
  const cancelLocked = isWithin12Hours(booking.scheduledAt);
  const canRate      = booking.status === 'completed' && !booking.isRated;
  const hasMap       = !!(booking.patientLocation?.coordinates || booking.destinationLocation?.coordinates);
  const hasTransport = ['full_care_ride', 'patient_transport', 'diagnostic_home'].includes(booking.bookingType);
  const isLive       = hasTransport && ['confirmed', 'in_progress'].includes(booking.status);

  // Resolve primary ride ID — could be ObjectId string or populated object
  const primaryRideId = (() => {
    const r = booking.primaryRide;
    if (!r) return booking.rides?.[0]?._id ?? booking.rides?.[0] ?? null;
    if (typeof r === 'string') return r;
    if (typeof r === 'object') return r._id?.toString() ?? null;
    return null;
  })();

  // Consultation join
  const consultationId = resolveConsultationId(booking.consultationSessionId);
  const joinable       = canJoinConsultation(booking);

  // Has OP card to download (completed booking with a bookingCode = OP generated)
  const hasOpCard = booking.status === 'completed' && !!booking.bookingCode;

  return (
    <>
      <div data-theme="customer" className="min-h-screen bg-base-100">

        {/* ── Sticky Header ── */}
        <header className="sticky top-0 z-20 border-b border-base-300 bg-base-100/96 backdrop-blur-md">
          <div className="container-custom py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => router.back()}
                  className="btn btn-ghost btn-sm btn-circle shrink-0"
                  aria-label="Go back"
                >
                  <ArrowLeft size={16} />
                </motion.button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-black text-base text-base-content truncate">{meta.label}</h1>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black ${sMeta.bgCls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sMeta.dotCls}`} />
                      <span className={sMeta.textCls}>{sMeta.label}</span>
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[11px] text-base-content/40 hover:text-primary transition-colors mt-0.5 group"
                    aria-label={`Copy booking code ${booking.bookingCode}`}
                    title="Click to copy"
                  >
                    <span className="font-mono group-hover:text-primary">{booking.bookingCode}</span>
                    {copied ? <CheckCircle2 size={10} className="text-success" /> : <Copy size={10} />}
                  </button>
                </div>
              </div>

              {/* Header action buttons */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={handleRefresh}
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Refresh"
                >
                  <RefreshCw size={14} />
                </motion.button>

                {/* Live tracking */}
              {/* Live tracking */}
{isLive && primaryRideId && (
  <Link href={`/rides/${booking._id}/${primaryRideId}/tracking`} className="btn btn-info btn-sm gap-1.5">
    <Navigation2 size={13} />
    <span className="hidden sm:inline">Track Live</span>
  </Link>
)}

                {/* Join consultation — primary CTA when joinable */}
                {joinable && consultationId && (
                  <Link
                    href={`/consultation/${consultationId}`}
                    className="btn btn-accent btn-sm gap-1.5"
                    aria-label="Join video consultation"
                  >
                    <Video size={13} />
                    <span className="hidden sm:inline">Join Call</span>
                  </Link>
                )}

                {/* Download OP card */}
                {hasOpCard && (
                  <button
                    onClick={handleDownloadOp}
                    disabled={downloadLoading}
                    className="btn btn-ghost btn-sm gap-1.5"
                    aria-label="Download OP card"
                  >
                    {downloadLoading
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Download size={13} />
                    }
                    <span className="hidden sm:inline">OP Card</span>
                  </button>
                )}

                {canRate && (
                  <button onClick={() => setShowRating(true)} className="btn btn-primary btn-sm gap-1.5">
                    <Star size={13} />
                    <span className="hidden sm:inline">Rate</span>
                  </button>
                )}

                {canCancel && (
                  <button
                    onClick={() => setShowCancel(true)}
                    className="btn btn-sm gap-1.5 text-error border border-error/30 bg-error/5 hover:bg-error hover:text-error-content hover:border-error"
                  >
                    {cancelLocked ? <Lock size={13} /> : <X size={13} />}
                    <span className="hidden sm:inline">{cancelLocked ? 'Locked' : 'Cancel'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── Hero Band ── */}
        <div className="border-b border-base-300 bg-gradient-to-br from-base-200 via-base-100 to-base-100">
          <div className="container-custom py-6">
            <div className="flex items-start gap-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center ${meta.bg} ${meta.border} border-2 shadow-sm flex-shrink-0`}
              >
                <Icon size={28} className={meta.color} />
              </motion.div>
              <div className="flex-1 min-w-0">
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <p className="text-[11px] uppercase tracking-widest font-bold text-base-content/30 mb-1">
                    Scheduled Appointment
                  </p>
                  <p className="font-black text-2xl text-base-content leading-tight">
                    <time dateTime={booking.scheduledAt}>{fmtDate(booking.scheduledAt)}</time>
                  </p>
                  <p className="text-base-content/50 text-sm font-semibold mt-0.5">
                    <time dateTime={booking.scheduledAt}>{fmtTime(booking.scheduledAt)}</time>
                  </p>
                </motion.div>
                {canCancel && cancelLocked && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-1.5 mt-2"
                  >
                    <Timer size={12} className="text-error" />
                    <p className="text-[11px] text-error font-semibold">
                      Cancellation locked — less than 12 hours to appointment
                    </p>
                  </motion.div>
                )}
              </div>
              {hoursUntil(booking.scheduledAt) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex-shrink-0 text-center px-3 py-2 bg-primary/5 border border-primary/20 rounded-2xl"
                >
                  <p className="text-[10px] text-base-content/40 font-semibold uppercase">In</p>
                  <p className="font-black text-primary text-lg leading-none">{hoursUntil(booking.scheduledAt)}</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Content Grid ── */}
        <main className="container-custom py-6">
          <motion.div
            variants={stagger}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 lg:grid-cols-3 gap-5"
          >
            {/* ════ Left Column ════ */}
            <div className="lg:col-span-2 space-y-5">

              {hasMap && (
                <motion.div variants={fadeUp} className="card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-base-300">
                    <div className="flex items-center gap-2">
                      <Navigation size={14} className="text-primary" />
                      <span className="font-black text-sm text-base-content">Route Map</span>
                    </div>
                    <p className="text-[10px] text-base-content/40">Pickup → Destination</p>
                  </div>
                  <RouteMap
                    patientLocation={booking.patientLocation}
                    destinationLocation={booking.destinationLocation}
                    isLoaded={mapsLoaded}
                  />
                </motion.div>
              )}

              <SectionCard
                title="Patient Information"
                subtitle="Details of the person receiving care"
                icon={User}
                iconColor="text-primary"
                iconBg="bg-primary/10"
                accent="bg-gradient-to-r from-primary/60 via-primary/20 to-transparent"
                delay={0.05}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <FieldRow label="Full Name"  note="Legal name as on ID"                value={booking.patientInfo?.name}                                         icon={User}  highlight />
                  <FieldRow label="Age"        note="Patient's age in years"             value={booking.patientInfo?.age ? `${booking.patientInfo.age} yrs` : null} icon={Clock} />
                  <FieldRow label="Gender"     note="For medical records"                value={booking.patientInfo?.gender}                                                                    />
                  <FieldRow label="Blood Group"   note="For emergency preparedness"          value={booking.patientInfo?.bloodGroup}                                                                />
                  <FieldRow label="Contact Phone" note="For appointment-related calls"       value={booking.patientInfo?.phone}                                         icon={Phone} mono />
                  <FieldRow label="Self / Other"  note="Booking for yourself or another?"   value={booking.patientInfo?.isSelf ? 'For myself' : 'For another patient'}              />
                </div>
              </SectionCard>

              {booking.doctor && (
                <SectionCard
                  title="Doctor / Specialist"
                  subtitle="Assigned medical professional"
                  icon={Stethoscope}
                  iconColor="text-info"
                  iconBg="bg-info/10"
                  accent="bg-gradient-to-r from-info/60 via-info/20 to-transparent"
                  delay={0.1}
                >
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-base-300/50">
                    <div className="w-10 h-10 rounded-xl bg-info/10 border border-info/20 flex items-center justify-center flex-shrink-0">
                      {booking.doctorSnapshot?.profilePhotoUrl
                        ? <img src={booking.doctorSnapshot.profilePhotoUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                        : <Stethoscope size={18} className="text-info" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-base-content">{booking.doctorSnapshot?.name ?? 'Doctor'}</p>
                      <p className="text-[11px] text-base-content/50">{booking.doctorSnapshot?.specialization}</p>
                    </div>
                  </div>
                  <FieldRow label="Consultation Type" note="Mode of visit"          value={booking.consultationType}                  icon={Video} />
                  <FieldRow label="Registration No."  note="Medical council number" value={booking.doctorSnapshot?.registrationNumber} mono        />
                </SectionCard>
              )}

              {booking.hospital && (
                <SectionCard
                  title="Hospital / Clinic"
                  subtitle="Facility where appointment takes place"
                  icon={Building2}
                  iconColor="text-primary"
                  iconBg="bg-primary/10"
                  delay={0.12}
                >
                  <div className="flex items-start gap-3 pt-1 pb-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} className="text-primary" />
                    </div>
                    <address className="not-italic flex-1">
                      <p className="font-bold text-sm text-base-content">{booking.hospital?.name}</p>
                      <p className="text-[11px] text-base-content/50 mt-0.5">
                        {[booking.hospital?.address?.line1, booking.hospital?.address?.city].filter(Boolean).join(', ')}
                      </p>
                    </address>
                  </div>
                </SectionCard>
              )}

              {booking.careAssistant && (
                <SectionCard
                  title="Care Assistant"
                  subtitle="Your personal healthcare companion"
                  icon={HeartPulse}
                  iconColor="text-secondary"
                  iconBg="bg-secondary/10"
                  delay={0.13}
                >
                  <div className="flex items-center gap-3 py-2">
                    <div className="w-11 h-11 rounded-full bg-secondary/10 border-2 border-secondary/20 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {booking.careAssistantSnapshot?.photoUrl
                        ? <img src={booking.careAssistantSnapshot.photoUrl} alt="" className="w-full h-full object-cover" />
                        : <HeartPulse size={18} className="text-secondary" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-base-content">{booking.careAssistantSnapshot?.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone size={10} className="text-base-content/30" />
                        <p className="text-[11px] text-base-content/50 font-mono">{booking.careAssistantSnapshot?.phone ?? '—'}</p>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              )}

              {(booking.patientLocation || booking.destinationLocation) && (
                <SectionCard
                  title="Location Details"
                  subtitle="Pickup and destination addresses"
                  icon={MapPin}
                  iconColor="text-accent"
                  iconBg="bg-accent/10"
                  delay={0.14}
                >
                  {booking.patientLocation && (
                    <div className="mb-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        <span className="text-[11px] font-black text-primary uppercase tracking-wide">Pickup</span>
                      </div>
                      <address className="not-italic ml-3.5">
                        <p className="text-sm font-semibold text-base-content">{booking.patientLocation.address ?? '—'}</p>
                        {booking.patientLocation.city && <p className="text-[11px] text-base-content/50">{booking.patientLocation.city}</p>}
                      </address>
                    </div>
                  )}
                  {booking.destinationLocation && (
                    <div className="p-3 rounded-xl bg-success/5 border border-success/15">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-success flex-shrink-0" />
                        <span className="text-[11px] font-black text-success uppercase tracking-wide">Destination</span>
                      </div>
                      <address className="not-italic ml-3.5">
                        <p className="text-sm font-semibold text-base-content">{booking.destinationLocation.address ?? '—'}</p>
                        {booking.destinationLocation.city && <p className="text-[11px] text-base-content/50">{booking.destinationLocation.city}</p>}
                      </address>
                    </div>
                  )}
                </SectionCard>
              )}

              {/* ── Pay-at-Service QR Card ── */}
              {(booking.payAtService?.enabled ||
                ['pay_at_service_pending', 'pay_at_service_paid'].includes(booking.paymentStatus)
              ) && (
                <PayAtServiceCard booking={booking} />
              )}

              {/* ── Consultation Session Card (online bookings) ── */}
              {hasConsultationSession(booking) && (
                <ConsultationSessionCard booking={booking} />
              )}

              {booking.diagnosticDetails && (
                <SectionCard
                  title="Diagnostic Details"
                  subtitle="Tests and lab packages"
                  icon={TestTube2}
                  iconColor="text-warning"
                  iconBg="bg-warning/10"
                  delay={0.15}
                >
                  {booking.diagnosticDetails.testNames?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] font-bold text-base-content/40 uppercase tracking-wide mb-2">Individual Tests</p>
                      <div className="flex flex-wrap gap-1.5">
                        {booking.diagnosticDetails.testNames.map((t) => (
                          <span key={t} className="badge badge-warning badge-sm">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {booking.diagnosticDetails.packageNames?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[11px] font-bold text-base-content/40 uppercase tracking-wide mb-2">Packages</p>
                      <div className="flex flex-wrap gap-1.5">
                        {booking.diagnosticDetails.packageNames.map((p) => (
                          <span key={p} className="badge badge-accent badge-sm">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <FieldRow label="Report Delivery" note="How you'll receive results" value={booking.diagnosticDetails.reportDeliveryMode} icon={FileText} />
                </SectionCard>
              )}

              {/* Legacy onlineConsultation.meetingLink (fallback if not using consultationSessionId) */}
              {booking.onlineConsultation?.meetingLink && !hasConsultationSession(booking) && (
                <SectionCard
                  title="Video Consultation"
                  subtitle="Join your online appointment"
                  icon={Video}
                  iconColor="text-accent"
                  iconBg="bg-accent/5"
                  delay={0.16}
                >
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 border border-accent/20">
                    <Video size={20} className="text-accent flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-base-content">{booking.onlineConsultation.platform}</p>
                      <p className="text-[11px] text-base-content/40 truncate">{booking.onlineConsultation.meetingLink}</p>
                    </div>
                    <a href={booking.onlineConsultation.meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-sm gap-1 flex-shrink-0">
                      <ExternalLink size={12} /> Join
                    </a>
                  </div>
                </SectionCard>
              )}

              {booking.rides?.length > 0 && (
                <SectionCard
                  title="Associated Rides"
                  subtitle="Transport rides linked to this booking"
                  icon={Car}
                  iconColor="text-accent"
                  iconBg="bg-accent/5"
                  delay={0.17}
                >
                  <ul className="space-y-2 py-1">
                    {booking.rides.map((ride, i) => {
                      const rId = (typeof ride === 'object' ? ride._id : ride)?.toString() ?? null;
                      return (
                        <li key={rId ?? i}>
                          <div className="flex items-center gap-3 p-3 rounded-xl border border-base-300 bg-base-200 hover:border-primary/30 transition-colors">
                            <Car size={14} className="text-accent flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-base-content capitalize">
                                {ride.isReturnRide ? '↩ Return Ride' : '↗ Outbound Ride'}
                              </p>
                              <p className="text-[10px] text-base-content/40">{ride.rideCode ?? `Ride ${i + 1}`}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`badge badge-sm ${
                                ride.status === 'completed'   ? 'badge-success' :
                                ride.status === 'cancelled'   ? 'badge-error'   :
                                ride.status === 'in_progress' ? 'badge-info'    : 'badge-warning'
                              }`}>
                                {(ride.status ?? 'pending').replace(/_/g, ' ')}
                              </span>
                              {isLive && rId && primaryRideId && (
                                <Link href={`/rides/${consultationId}/${primaryRideId}/tracking`} className="btn btn-ghost btn-xs">
                                  <Navigation2 size={11} />
                                </Link>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </SectionCard>
              )}

              {booking.documents?.length > 0 && (
                <SectionCard
                  title="Documents"
                  subtitle="Medical records and supporting files"
                  icon={FileText}
                  iconColor="text-base-content/60"
                  iconBg="bg-base-300/60"
                  delay={0.18}
                >
                  <ul className="space-y-2 py-1">
                    {booking.documents.map((doc, i) => (
                      <li key={doc._id ?? i}>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 rounded-xl border border-base-300 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                        >
                          <FileText size={14} className="text-base-content/30 group-hover:text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-base-content capitalize">{doc.docType?.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] text-base-content/40 truncate">{doc.originalName}</p>
                          </div>
                          <ExternalLink size={12} className="text-base-content/20 group-hover:text-primary flex-shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}

              {booking.cancellation && (
                <SectionCard
                  title="Cancellation Details"
                  subtitle="How and why this booking was cancelled"
                  icon={AlertTriangle}
                  iconColor="text-error"
                  iconBg="bg-error/10"
                  delay={0.2}
                >
                  <div className="p-3 rounded-xl bg-error/5 border border-error/20 my-1 space-y-0">
                    <FieldRow label="Cancelled By"      note="Role that initiated cancellation"    value={booking.cancellation.cancelledBy}                                                                                                                                                                                                         />
                    <FieldRow label="Reason"            note="Reason at time of cancellation"      value={booking.cancellation.reason}                                                                                                                                                                                                              />
                    <FieldRow label="Cancelled At"      note="When cancellation was processed"     value={`${fmtDate(booking.cancellation.cancelledAt)} ${fmtTime(booking.cancellation.cancelledAt)}`}              icon={Clock}          />
                    <FieldRow label="Refund Eligible"   note="Under our cancellation policy"       value={booking.cancellation.refundEligible ? 'Yes' : 'No'}
                              badge={booking.cancellation.refundEligible ? 'text-success bg-success/10' : 'text-error bg-error/10'}                                                                                                                                                                                                                                     />
                    {booking.cancellation.refundPercent > 0 && (
                      <FieldRow label="Refund Percentage" note="Percentage to be refunded"         value={`${booking.cancellation.refundPercent}%`}                                                                                                                                                 highlight             />
                    )}
                  </div>
                </SectionCard>
              )}

              {booking.isRated && booking.rating && (
                <SectionCard
                  title="Your Review"
                  subtitle="Feedback submitted after your experience"
                  icon={Star}
                  iconColor="text-warning"
                  iconBg="bg-warning/10"
                  delay={0.22}
                >
                  <div className="py-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={20} className={s <= booking.rating.overallRating ? 'text-warning fill-current' : 'text-base-300'} />
                        ))}
                      </div>
                      <span className="font-black text-base-content">{booking.rating.overallRating}/5</span>
                    </div>
                    {booking.rating.overallComment && (
                      <blockquote className="text-sm text-base-content/70 italic border-l-2 border-warning/40 pl-3 mb-2">
                        {booking.rating.overallComment}
                      </blockquote>
                    )}
                    {booking.rating.ratedAt && (
                      <p className="text-[10px] text-base-content/30">
                        Submitted on <time dateTime={booking.rating.ratedAt}>{fmtDate(booking.rating.ratedAt)}</time>
                      </p>
                    )}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* ════ Right Column ════ */}
            <div className="space-y-5">

              <SectionCard
                title="Booking Progress"
                subtitle="Current stage of your care journey"
                icon={TrendingUp}
                iconColor="text-primary"
                iconBg="bg-primary/10"
                delay={0.08}
              >
                <div className="py-2">
                  <BookingTimeline status={booking.status} />
                </div>
              </SectionCard>

              <SectionCard
                title="Fare Breakdown"
                subtitle="Complete cost breakdown"
                icon={IndianRupee}
                iconColor="text-primary"
                iconBg="bg-primary/10"
                accent="bg-gradient-to-r from-primary/60 via-primary/20 to-transparent"
                delay={0.1}
              >
                <div className="py-1">
                  <FareBreakdown fare={booking.fareBreakdown} />
                </div>
                <div className="mt-3 pt-3 border-t border-base-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wide text-base-content/40">Payment Status</p>
                      <p className="text-[10px] text-base-content/30 mt-0.5">Current payment state</p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black ${pMeta.cls}`}>
                      {pMeta.label}
                    </span>
                  </div>
                  {booking.couponCode && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <CreditCard size={11} className="text-success" />
                      <span className="text-[11px] font-mono font-bold text-success">{booking.couponCode}</span>
                      <span className="text-[10px] text-base-content/30">coupon applied</span>
                    </div>
                  )}
                  {booking.coinsRedeemed > 0 && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <Zap size={11} className="text-warning" />
                      <span className="text-[11px] font-bold text-warning">{booking.coinsRedeemed} coins</span>
                      <span className="text-[10px] text-base-content/30">redeemed</span>
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Booking Info"
                subtitle="Administrative and reference details"
                icon={Info}
                iconColor="text-base-content/40"
                iconBg="bg-base-200"
                delay={0.12}
              >
                <div className="py-1">
                  <FieldRow label="Booking Code"  note="Share with support"            value={booking.bookingCode}  mono highlight icon={CreditCard} />
                  <FieldRow label="Booking Type"  note="Category of service"           value={meta.label}             icon={Icon}                      />
                  {booking.pricingSource && (
                    <FieldRow label="Pricing Source" note="Who set the pricing"        value={booking.pricingSource}                                 />
                  )}
                  <FieldRow label="Created On"    note="When booking was created"      value={`${fmtDate(booking.createdAt)}, ${fmtTime(booking.createdAt)}`} icon={Calendar} />
                  {booking.completedAt && (
                    <FieldRow label="Completed On" note="When service was delivered"  value={`${fmtDate(booking.completedAt)}, ${fmtTime(booking.completedAt)}`} icon={CheckCircle2} />
                  )}
                  {booking.slotId && (
                    <FieldRow label="Slot ID"     note="Doctor's slot reference"       value={String(booking.slotId)} mono />
                  )}
                  {/* Consultation session reference */}
                  {consultationId && (
                    <FieldRow
                      label="Consult Session"
                      note="Telemedicine session ID"
                      value={String(consultationId)}
                      mono
                      icon={Radio}
                    />
                  )}
                </div>
              </SectionCard>

              {booking.bookingType === 'follow_up' && booking.followUpParentBooking && (
                <SectionCard
                  title="Follow-Up Chain"
                  subtitle="Original booking this is linked to"
                  icon={RotateCcw}
                  iconColor="text-info"
                  iconBg="bg-info/10"
                  delay={0.14}
                >
                  <div className="p-3 rounded-xl bg-info/5 border border-info/20 my-1">
                    <p className="text-[11px] font-black text-info uppercase tracking-wide mb-1">Parent Booking ID</p>
                    <p className="text-xs font-mono text-base-content break-all">{String(booking.followUpParentBooking)}</p>
                    <p className="text-[10px] text-base-content/30 mt-1.5">
                      Discount: {booking.followUpDiscountPercent || 0}% applied.
                    </p>
                  </div>
                </SectionCard>
              )}

              {/* Action Buttons */}
              <motion.div variants={fadeUp} className="space-y-3">
                {isLive && primaryRideId && (
                  <Link href={`/rides/${consultationId}/${primaryRideId}/tracking`} className="btn btn-info w-full gap-2">
                    <Navigation2 size={15} /> Track Live Location
                  </Link>
                )}

              {/* Join consultation — full-width CTA in sidebar */}
                {joinable && consultationId && (
                  <Link 
                    href={`/consultation/${consultationId}`} 
                    className="btn btn-accent w-full gap-2"
                  >
                    <Video size={15} /> Join Consultation
                  </Link>
                )}

                {/* View session (not yet joinable) */}
                {!joinable && consultationId && (
                  <Link 
                    href={`/consultation/${consultationId}`} 
                    className="btn btn-ghost border border-base-300 w-full gap-2"
                  >
                    <Radio size={15} /> View Session
                  </Link>
                )}

                {/* Download OP Card */}
                {hasOpCard && (
                  <button
                    onClick={handleDownloadOp}
                    disabled={downloadLoading}
                    className="btn btn-ghost border border-base-300 w-full gap-2"
                    aria-label="Download OP Card"
                  >
                    {downloadLoading
                      ? <Loader2 size={15} className="animate-spin" />
                      : <Download size={15} />
                    }
                    {downloadLoading ? 'Downloading…' : 'Download OP Card'}
                  </button>
                )}

                {canRate && (
                  <button onClick={() => setShowRating(true)} className="btn btn-primary w-full gap-2">
                    <Star size={15} /> Rate Your Experience
                  </button>
                )}

                {canCancel && (
                  <div>
                    <button
                      onClick={() => !cancelLocked && setShowCancel(true)}
                      disabled={cancelLocked}
                      title={cancelLocked ? 'Not allowed within 12 hours' : 'Cancel booking'}
                      className={`btn w-full gap-2 ${
                        cancelLocked
                          ? 'opacity-50 cursor-not-allowed border-base-300 text-base-content/40 bg-base-200'
                          : 'text-error border-error/30 bg-error/5 hover:bg-error hover:text-error-content hover:border-error'
                      }`}
                    >
                      {cancelLocked ? <Lock size={14} /> : <X size={14} />}
                      {cancelLocked ? 'Cancellation Locked' : 'Cancel Booking'}
                    </button>
                    {cancelLocked && (
                      <p className="text-[10px] text-error/60 text-center mt-1.5">
                        Not allowed within 12 hours of appointment
                      </p>
                    )}
                  </div>
                )}
              </motion.div>

              {/* Quick Links */}
              <motion.nav variants={fadeUp} className="card p-4 space-y-1" aria-label="Quick links">
                <p className="text-[10px] font-black uppercase tracking-widest text-base-content/30 px-2 mb-2">Quick Links</p>
                <Link href="/my-bookings" className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-base-200 transition-colors group">
                  <div className="flex items-center gap-2">
                    <Package size={13} className="text-primary" />
                    <span className="text-sm text-base-content/70 group-hover:text-base-content">All Bookings</span>
                  </div>
                  <ChevronRight size={13} className="text-base-content/30" />
                </Link>
                <Link href="/book-appointment" className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-base-200 transition-colors group">
                  <div className="flex items-center gap-2">
                    <Activity size={13} className="text-primary" />
                    <span className="text-sm text-base-content/70 group-hover:text-base-content">New Booking</span>
                  </div>
                  <ChevronRight size={13} className="text-base-content/30" />
                </Link>
                {consultationId && (
                  <Link 
                    href={`/consultation/${consultationId}`} 
                    className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-base-200 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Radio size={13} className="text-accent" />
                      <span className="text-sm text-base-content/70 group-hover:text-base-content">Consultation Session</span>
                    </div>
                    <ChevronRight size={13} className="text-base-content/30" />
                  </Link>
                )}
              </motion.nav>
            </div>
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {showCancel && <CancelModal key="cancel" booking={booking} onClose={handleCloseCancel} />}
      </AnimatePresence>
      <AnimatePresence>
        {showRating && <RatingModal key="rating" booking={booking} onClose={handleCloseRating} />}
      </AnimatePresence>
    </>
  );
}