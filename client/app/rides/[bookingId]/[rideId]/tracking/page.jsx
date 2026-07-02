'use client';

 

import React, {
  useEffect, useRef, useCallback, useState, useMemo, memo, useReducer,
} from 'react';
import { useParams, useRouter }    from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence }  from 'framer-motion';
import { GoogleMap, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { useGoogleMaps }            from '@/context/GoogleMapsProvider';
import {
  Phone, Navigation, Clock, Shield, ShieldAlert, WifiOff,
  ChevronDown, ChevronLeft, CheckCircle, Loader2, X, Star, Car,
  RefreshCw, AlertTriangle, Zap, Copy, Check, ArrowUpRight,
  Maximize2, Minimize2, Plus, Minus, Heart, MapPin, Activity,
  Bell, Info, MessageCircle, Share2, Battery, Signal, Wifi,
  ChevronRight, User, Ambulance, Stethoscope, Package,
  CircleDot, Route, Timer, TrendingUp, Eye, EyeOff,
  Volume2, VolumeX, LocateFixed, Layers, Building2, Flag,
} from 'lucide-react';

// ── Store slices ───────────────────────────────────────────────────────────
import {
  fetchRideLive, fetchRideTracking,
  selectCurrentRide, selectSocketLive, selectLiveData,
  socketLocationUpdate, socketEtaUpdate, socketRideStatusChanged,
  socketDriverAccepted, socketDriverEnRoute, socketDriverArrived,
  socketOtpVerified, socketRideStarted, socketRideCompleted,
  socketRideCancelled, socketNavigationTargetChanged, socketRideAssigned,
  socketCaAtJoinPoint, socketCaJoinedRide, socketJpWaypointCompleted,
  socketCareAssistantTracking, socketHospitalEtaUpdate,
} from '@/store/slices/rideRequestSlice';

import { fetchMyBookingById, selectSelectedBooking } from '@/store/slices/bookingSlice';
import {
  fetchCareTrackingSnapshot,
  selectCareTrackingSnapshot,
  triggerBookingSos, fetchBookingSosEvents, selectBookingSosEvents,
  fetchRideStops, fetchRideParticipants,
  selectRideStops as selectStops,
  selectRideParticipants as selectParticipants,
  selectCurrentStopId,
} from '@/store/slices/operationsSlice';

import { useSocket } from '@/context/SocketProvider';
import socketService, { SOCKET_EVENTS } from '@/services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const MAP_ID   = process.env.NEXT_PUBLIC_MAP_ID || '33a293614af186975a18525f';
const POLL_MS  = 6000;
const ROUTE_THROTTLE_MS = 25000;

// Status visual config
const STATUS_CFG = {
  searching:       { label: 'Finding Driver',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.30)',  glow: 'rgba(245,158,11,0.25)',  icon: '🔍', pulse: true,  step: 0 },
  requested:       { label: 'Finding Driver',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.30)',  glow: 'rgba(245,158,11,0.25)',  icon: '🔍', pulse: true,  step: 0 },
  driver_assigned: { label: 'Driver Assigned',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.30)', glow: 'rgba(59,130,246,0.25)',  icon: '👤', pulse: false, step: 1 },
  driver_accepted: { label: 'Driver Confirmed',  color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.30)',  glow: 'rgba(6,182,212,0.25)',   icon: '✅', pulse: false, step: 2 },
  driver_en_route: { label: 'On The Way',        color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.30)',  glow: 'rgba(6,182,212,0.25)',   icon: '🚗', pulse: true,  step: 2 },
  driver_arrived:  { label: 'Driver Arrived!',   color: '#a855f7', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.40)', glow: 'rgba(168,85,247,0.30)',  icon: '📍', pulse: true,  step: 3 },
  otp_verified:    { label: 'Starting Ride',     color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.30)', glow: 'rgba(16,185,129,0.25)',  icon: '🔑', pulse: false, step: 4 },
  in_progress:     { label: 'En Route to Hospital', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.30)',  glow: 'rgba(34,197,94,0.25)',   icon: '🏥', pulse: false, step: 4 },
  at_stop:         { label: 'At Stop',           color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.30)', glow: 'rgba(249,115,22,0.25)',  icon: '⏸️', pulse: false, step: 4 },
  completed:       { label: 'Ride Completed',    color: '#64748b', bg: 'rgba(100,116,139,0.12)',border: 'rgba(100,116,139,0.30)',glow: 'rgba(100,116,139,0.20)', icon: '🎉', pulse: false, step: 5 },
  cancelled:       { label: 'Cancelled',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.30)',  glow: 'rgba(239,68,68,0.25)',   icon: '❌', pulse: false, step: -1 },
};

const CA_STATUS_CFG = {
  not_joined:         { label: 'Assigned',        color: '#94a3b8', dot: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.25)' },
  en_route_to_pickup: { label: 'On the Way',      color: '#3b82f6', dot: '#3b82f6', bg: 'rgba(59,130,246,0.10)',  border: 'rgba(59,130,246,0.25)'  },
  at_pickup:          { label: 'At Join Point',   color: '#f59e0b', dot: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)'  },
  at_join_point:      { label: 'At Join Point',   color: '#f59e0b', dot: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)'  },
  AT_JOIN_POINT:      { label: 'At Join Point',   color: '#f59e0b', dot: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)'  },
  IN_VEHICLE:         { label: 'In the Vehicle',  color: '#22c55e', dot: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)'   },
  in_ride:            { label: 'In the Vehicle',  color: '#22c55e', dot: '#22c55e', bg: 'rgba(34,197,94,0.10)',   border: 'rgba(34,197,94,0.25)'   },
  departed:           { label: 'Completed',       color: '#8b5cf6', dot: '#8b5cf6', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.25)'  },
  AT_HOSPITAL:        { label: 'At Hospital',     color: '#8b5cf6', dot: '#8b5cf6', bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.25)'  },
};

const TIMELINE = [
  { key: 'searching',       label: 'Booked',   icon: '📋' },
  { key: 'driver_assigned', label: 'Assigned', icon: '👤' },
  { key: 'driver_en_route', label: 'En Route', icon: '🚗' },
  { key: 'driver_arrived',  label: 'Arrived',  icon: '📍' },
  { key: 'in_progress',     label: 'Riding',   icon: '🏥' },
  { key: 'completed',       label: 'Done',     icon: '✅' },
];

const BOOKING_TYPE_LABELS = {
  full_care_ride:       { icon: '🚑', label: 'Full Care Ride',       color: '#ec4899' },
  care_assistant:       { icon: '❤️', label: 'Care Assistant',        color: '#ec4899' },
  patient_transport:    { icon: '🚗', label: 'Patient Transport',     color: '#3b82f6' },
  doctor_consultation:  { icon: '👨‍⚕️', label: 'Doctor Consultation',  color: '#06b6d4' },
  doctor_online:        { icon: '💻', label: 'Online Consultation',   color: '#06b6d4' },
  physiotherapist:      { icon: '🤲', label: 'Physiotherapy',         color: '#10b981' },
  diagnostic_center:    { icon: '🔬', label: 'Diagnostics',           color: '#f59e0b' },
  diagnostic_home:      { icon: '🏠', label: 'Home Diagnostics',      color: '#f59e0b' },
  follow_up:            { icon: '📅', label: 'Follow-up',             color: '#6366f1' },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const lerp = (a, b, t) => a + (b - a) * t;

const fmtEta = (min) => {
  if (min == null) return null;
  if (min < 1) return '< 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60); const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const fmtKm = (km) => {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

const fmtTime = (date) => {
  if (!date) return null;
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const getStepIdx = (status) => {
  if (['driver_accepted', 'driver_en_route'].includes(status)) return 2;
  if (status === 'otp_verified') return 3;
  if (status === 'at_stop') return 4;
  const map = { searching: 0, requested: 0, driver_assigned: 1, driver_arrived: 3, in_progress: 4, completed: 5 };
  return map[status] ?? 0;
};

const geoToLatLng = (arr) => arr?.length >= 2 ? { lat: arr[1], lng: arr[0] } : null;

// ─────────────────────────────────────────────────────────────────────────────
// MARKER HTML
// ─────────────────────────────────────────────────────────────────────────────

const mkDriverMarker = (heading = 0, speed = 0) => {
  const moving = speed > 4;
  return `
<div style="position:absolute;width:0;height:0;pointer-events:none;">
  <div style="position:absolute;width:80px;height:80px;left:-40px;top:-40px;display:flex;align-items:center;justify-content:center;">
    ${moving ? `<div style="position:absolute;width:76px;height:76px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.18) 0%,transparent 70%);animation:drPulse 1.8s ease-out infinite;pointer-events:none;"></div>` : ''}
    <div style="position:absolute;width:52px;height:52px;border-radius:50%;border:1.5px solid rgba(59,130,246,0.28);background:rgba(59,130,246,0.05);pointer-events:none;"></div>
    <div style="position:absolute;width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:13px solid rgba(59,130,246,0.90);top:8px;left:50%;transform:translateX(-50%) rotate(${heading}deg);transform-origin:bottom center;transition:transform 0.3s ease;pointer-events:none;filter:drop-shadow(0 2px 4px rgba(59,130,246,0.5));"></div>
    <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:38px;height:10px;border-radius:50%;background:rgba(0,0,0,0.22);filter:blur(5px);pointer-events:none;"></div>
    <div style="position:relative;font-size:36px;line-height:1;filter:drop-shadow(0 5px 10px rgba(0,0,0,0.50)) drop-shadow(0 2px 5px rgba(59,130,246,0.65));z-index:2;pointer-events:none;">🚗</div>
    ${moving ? `<div style="position:absolute;bottom:-3px;right:-2px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);color:#fff;font-size:7px;font-weight:800;padding:1px 4px;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.35);pointer-events:none;z-index:3;">${Math.round(speed)}<span style="font-size:5px;"> km/h</span></div>` : ''}
  </div>
</div>`;
};

const mkCaMarker = (status = 'not_joined', name = '') => {
  const inRide = ['in_ride', 'IN_VEHICLE'].includes(status);
  const atJp   = ['at_pickup', 'at_join_point', 'AT_JOIN_POINT'].includes(status);
  const colors = {
    default:             { ring: 'rgba(148,163,184,0.28)', glow: 'rgba(148,163,184,0.18)', shad: 'rgba(148,163,184,0.45)' },
    en_route_to_pickup:  { ring: 'rgba(59,130,246,0.35)',  glow: 'rgba(59,130,246,0.20)',  shad: 'rgba(59,130,246,0.55)'  },
    at_pickup:           { ring: 'rgba(245,158,11,0.42)',  glow: 'rgba(245,158,11,0.25)',  shad: 'rgba(245,158,11,0.65)'  },
    at_join_point:       { ring: 'rgba(245,158,11,0.42)',  glow: 'rgba(245,158,11,0.25)',  shad: 'rgba(245,158,11,0.65)'  },
    AT_JOIN_POINT:       { ring: 'rgba(245,158,11,0.42)',  glow: 'rgba(245,158,11,0.25)',  shad: 'rgba(245,158,11,0.65)'  },
    in_ride:             { ring: 'rgba(34,197,94,0.42)',   glow: 'rgba(34,197,94,0.20)',   shad: 'rgba(34,197,94,0.60)'   },
    IN_VEHICLE:          { ring: 'rgba(34,197,94,0.42)',   glow: 'rgba(34,197,94,0.20)',   shad: 'rgba(34,197,94,0.60)'   },
  };
  const c = colors[status] || colors.default;
  const emoji = inRide ? '❤️‍🔥' : atJp ? '⏳' : '❤️';
  return `
<div style="position:absolute;width:0;height:0;pointer-events:none;">
  <div style="position:absolute;width:74px;height:80px;left:-37px;top:-40px;display:flex;align-items:center;justify-content:center;flex-direction:column;">
    <div style="position:absolute;width:64px;height:64px;border-radius:50%;background:radial-gradient(circle,${c.glow} 0%,transparent 70%);animation:caPulse 2s ease-out infinite;pointer-events:none;"></div>
    <div style="position:absolute;width:50px;height:50px;border-radius:50%;border:2px solid ${c.ring};pointer-events:none;${atJp ? 'animation:jpRing 1.3s ease-in-out infinite;' : ''}"></div>
    <div style="position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);width:36px;height:9px;border-radius:50%;background:rgba(0,0,0,0.20);filter:blur(4px);pointer-events:none;"></div>
    <div style="position:relative;font-size:${inRide ? '33px' : '30px'};line-height:1;filter:drop-shadow(0 5px 9px rgba(0,0,0,0.42)) drop-shadow(0 2px 5px ${c.shad});z-index:2;pointer-events:none;${inRide ? 'animation:caHB 1.5s ease-in-out infinite;' : ''}">${emoji}</div>
    ${name ? `<div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);color:#fff;font-size:7.5px;font-weight:800;letter-spacing:0.05em;padding:1px 6px;border-radius:8px;white-space:nowrap;font-family:system-ui,sans-serif;pointer-events:none;">${name.split(' ')[0]}</div>` : ''}
  </div>
</div>`;
};

const mkPickupMarker = () => `
<div style="position:absolute;left:-18px;top:-56px;display:flex;flex-direction:column;align-items:center;pointer-events:none;">
  <div style="font-size:36px;line-height:1;filter:drop-shadow(0 5px 9px rgba(59,130,246,0.52)) drop-shadow(0 2px 4px rgba(0,0,0,0.38));">📍</div>
  <div style="background:rgba(59,130,246,0.95);color:#fff;padding:1.5px 7px;border-radius:18px;font-size:8.5px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.28);font-family:system-ui,sans-serif;">Pickup</div>
</div>`;

const mkHospMarker = () => `
<div style="position:absolute;left:-18px;top:-56px;display:flex;flex-direction:column;align-items:center;pointer-events:none;">
  <div style="font-size:36px;line-height:1;filter:drop-shadow(0 5px 9px rgba(239,68,68,0.52)) drop-shadow(0 2px 4px rgba(0,0,0,0.38));">🏥</div>
  <div style="background:rgba(239,68,68,0.95);color:#fff;padding:1.5px 7px;border-radius:18px;font-size:8.5px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.28);font-family:system-ui,sans-serif;">Hospital</div>
</div>`;

const mkJpMarker = (done = false) => `
<div style="position:absolute;left:-20px;top:-62px;display:flex;flex-direction:column;align-items:center;pointer-events:none;">
  <div style="width:40px;height:40px;border-radius:50%;background:${done ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#f59e0b,#d97706)'};display:flex;align-items:center;justify-content:center;box-shadow:0 5px 16px ${done ? 'rgba(34,197,94,0.50)' : 'rgba(245,158,11,0.50)'};border:2px solid #fff;${done ? '' : 'animation:jpBob 2s ease-in-out infinite;'}">
    <span style="font-size:18px;">${done ? '✅' : '📌'}</span>
  </div>
  <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:10px solid ${done ? '#16a34a' : '#d97706'};margin-top:-1px;"></div>
  <div style="background:${done ? 'rgba(34,197,94,0.95)' : 'rgba(245,158,11,0.95)'};color:#fff;padding:1.5px 7px;border-radius:18px;font-size:7.5px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;white-space:nowrap;margin-top:2px;box-shadow:0 2px 8px rgba(0,0,0,0.28);font-family:system-ui,sans-serif;">${done ? 'CA Joined ✓' : 'Meet Here'}</div>
</div>`;

// ─────────────────────────────────────────────────────────────────────────────
// KEYFRAMES
// ─────────────────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes drPulse  { 0%{transform:scale(0.85);opacity:1} 100%{transform:scale(2.6);opacity:0} }
@keyframes caPulse  { 0%{transform:scale(0.85);opacity:1} 100%{transform:scale(2.4);opacity:0} }
@keyframes caHB     { 0%,100%{transform:scale(1) translateY(0)} 50%{transform:scale(1.18) translateY(-4px)} }
@keyframes jpBob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes jpRing   { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0.6)} 50%{box-shadow:0 0 0 9px rgba(245,158,11,0)} }
@keyframes shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes sosRing  { 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.8)} 70%{box-shadow:0 0 0 20px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
@keyframes fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes notifSlide { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
@keyframes heartbeat { 0%,100%{transform:scale(1)} 14%{transform:scale(1.3)} 28%{transform:scale(1)} 42%{transform:scale(1.3)} 70%{transform:scale(1)} }
`;

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = memo(function StatusBadge({ status, size = 'sm', showPulse = true }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.searching;
  const px = size === 'lg' ? 'px-3.5 py-1.5 text-[11px]' : 'px-2.5 py-0.5 text-[9.5px]';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-widest border ${px}`}
      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.color }}>
      {showPulse && cfg.pulse && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: cfg.color }} />
      )}
      {cfg.icon} {cfg.label}
    </span>
  );
});

const CaBadge = memo(function CaBadge({ status }) {
  const cfg = CA_STATUS_CFG[status] || CA_STATUS_CFG.not_joined;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-widest border"
      style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
});

const FabBtn = memo(function FabBtn({ onClick, active, danger, disabled, title, children }) {
  return (
    <motion.button whileTap={{ scale: 0.86 }} onClick={onClick} title={title} disabled={disabled}
      className={[
        'w-11 h-11 rounded-[13px] flex items-center justify-center cursor-pointer border transition-all',
        'shadow-[0_4px_18px_rgba(0,0,0,0.36)]',
        disabled ? 'opacity-40 cursor-not-allowed' :
        danger ? (active ? 'bg-error border-error/60 text-error-content' : 'bg-error/10 border-error/30 text-error hover:bg-error/18')
               : (active ? 'bg-primary text-primary-content border-primary' : 'bg-base-200/92 text-base-content/60 border-base-300 hover:text-base-content hover:bg-base-300/80'),
      ].join(' ')}>
      {children}
    </motion.button>
  );
});

const InfoRow = memo(function InfoRow({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-base-300/40 last:border-0">
      <span className="text-[10.5px] text-base-content/40 font-semibold uppercase tracking-wide">{label}</span>
      <span className={`text-[11.5px] text-base-content/72 font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
});

const Skeleton = memo(function Skeleton({ className }) {
  return (
    <div className={`rounded-xl ${className}`}
      style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.8s linear infinite' }} />
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// OTP MODAL
// ─────────────────────────────────────────────────────────────────────────────

const OtpModal = memo(function OtpModal({ otp, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(String(otp)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }, [otp]);
  if (!otp) return null;
  const digits = String(otp).split('');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        className="w-full max-w-sm rounded-3xl p-7 border shadow-[0_24px_72px_rgba(0,0,0,0.72)]"
        style={{ background: 'var(--base-200)', borderColor: 'rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🔑</span>
              <h3 className="text-lg font-black text-base-content m-0">Ride OTP</h3>
            </div>
            <p className="text-xs text-base-content/45 m-0">Show this to your driver to start the ride</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-base-300 flex items-center justify-center text-base-content/50 cursor-pointer border border-base-300 flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        <motion.div animate={{ opacity: [0.65, 1, 0.65] }} transition={{ repeat: Infinity, duration: 2.2 }}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl mb-5 border"
          style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.28)' }}>
          <AlertTriangle size={13} className="text-warning flex-shrink-0" />
          <p className="text-[11px] font-semibold text-warning m-0">Never share this with anyone except your driver</p>
        </motion.div>

        <div className="flex gap-2 justify-center mb-6">
          {digits.map((d, i) => (
            <motion.div key={i}
              initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: i * 0.08, type: 'spring', stiffness: 420, damping: 18 }}
              className="w-[52px] h-[62px] rounded-2xl flex items-center justify-center font-black text-3xl border-2"
              style={{ background: 'rgba(168,85,247,0.10)', borderColor: 'rgba(168,85,247,0.55)', color: '#a855f7', boxShadow: '0 4px 18px rgba(168,85,247,0.20)' }}>
              {d}
            </motion.div>
          ))}
        </div>

        <button onClick={copy}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-semibold transition-all cursor-pointer"
          style={{ background: copied ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.04)', borderColor: copied ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)', color: copied ? '#22c55e' : 'rgba(255,255,255,0.55)' }}>
          {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy OTP</>}
        </button>
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SOS MODAL
// ─────────────────────────────────────────────────────────────────────────────

const SOS_TYPES_UI = [
  { key: 'MEDICAL',           label: 'Medical Emergency', icon: '🏥', color: '#ef4444' },
  { key: 'SAFETY',            label: 'Safety Concern',    icon: '🛡️', color: '#f97316' },
  { key: 'VEHICLE_BREAKDOWN', label: 'Vehicle Breakdown', icon: '🔧', color: '#f59e0b' },
  { key: 'ACCIDENT',          label: 'Accident',          icon: '💥', color: '#dc2626' },
  { key: 'PATIENT_CONDITION', label: 'Patient Condition', icon: '❤️', color: '#ec4899' },
  { key: 'OTHER',             label: 'Other',             icon: '❗', color: '#6366f1' },
];

const SosModal = memo(function SosModal({ bookingId, rideId, onClose, onTriggered }) {
  const dispatch = useDispatch();
  const [selected, setSelected] = useState(null);
  const [desc, setDesc] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!selected) return;
    setSending(true);
    try {
      await dispatch(triggerBookingSos({ bookingId, sosType: selected, description: desc || undefined, rideId }));
      setDone(true);
      onTriggered?.();
      setTimeout(onClose, 2800);
    } catch { setSending(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }} transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        className="w-full max-w-sm rounded-3xl border overflow-hidden"
        style={{ background: 'var(--base-200)', borderColor: 'rgba(239,68,68,0.40)' }}
        onClick={e => e.stopPropagation()}>

        {!done ? (
          <>
            <div className="px-6 pt-6 pb-4 border-b border-base-300/40">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)', animation: 'sosRing 1.5s ease-in-out infinite', boxShadow: '0 0 0 0 rgba(239,68,68,0.8)' }}>
                    <ShieldAlert size={18} className="text-error" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-base-content m-0">Emergency SOS</h3>
                    <p className="text-[10px] text-base-content/45 m-0">Select emergency type</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-7 h-7 rounded-xl bg-base-300 flex items-center justify-center cursor-pointer text-base-content/50">
                  <X size={12} />
                </button>
              </div>
            </div>

            <div className="px-4 py-4 grid grid-cols-3 gap-2.5">
              {SOS_TYPES_UI.map(t => (
                <button key={t.key} onClick={() => setSelected(t.key)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 cursor-pointer transition-all text-center ${selected === t.key ? 'scale-[1.04]' : 'opacity-70 hover:opacity-100'}`}
                  style={{ borderColor: selected === t.key ? t.color : 'transparent', background: selected === t.key ? `${t.color}15` : 'rgba(255,255,255,0.04)' }}>
                  <span className="text-2xl">{t.icon}</span>
                  <span className="text-[9px] font-bold leading-tight" style={{ color: selected === t.key ? t.color : 'rgba(255,255,255,0.65)' }}>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="px-4 pb-2">
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
                placeholder="Brief description (optional)…"
                className="w-full text-xs rounded-xl border border-base-300/60 bg-base-300/40 text-base-content/72 px-3 py-2 resize-none outline-none"
                style={{ fontFamily: 'inherit' }} />
            </div>

            <div className="px-4 pb-5">
              <motion.button whileTap={{ scale: 0.97 }} onClick={send} disabled={!selected || sending}
                className="w-full py-3.5 rounded-2xl font-black text-sm flex items-center justify-center gap-2 border-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: selected ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.06)', borderColor: selected ? 'rgba(239,68,68,0.70)' : 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />}
                {sending ? 'Sending SOS…' : 'Send Emergency Alert'}
              </motion.button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center px-6 py-10 gap-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 14 }}
              className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.15)' }}>
              <CheckCircle size={36} className="text-error" />
            </motion.div>
            <div className="text-center">
              <h3 className="text-base font-black text-base-content m-0 mb-1">SOS Alert Sent</h3>
              <p className="text-xs text-base-content/50 m-0">Help is on the way. Stay calm and stay safe.</p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE BAR
// ─────────────────────────────────────────────────────────────────────────────

const TimelineBar = memo(function TimelineBar({ status }) {
  const active = getStepIdx(status || 'searching');
  return (
    <div className="px-3 py-3.5">
      <div className="flex items-start justify-between relative">
        <div className="absolute top-[11px] bg-base-300/70 h-0.5" style={{ left: '8%', right: '8%', zIndex: 0 }} />
        <motion.div className="absolute top-[11px] h-0.5 bg-primary" style={{ left: '8%', zIndex: 1 }}
          animate={{ width: `${(active / (TIMELINE.length - 1)) * 84}%` }}
          transition={{ duration: 0.7, ease: 'easeInOut' }} />
        {TIMELINE.map((step, i) => {
          const done = i <= active; const isActive = i === active;
          return (
            <div key={step.key} className="flex flex-col items-center gap-1.5 relative z-10 flex-1">
              <motion.div
                className="w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 flex-shrink-0"
                animate={{
                  backgroundColor: done ? 'var(--primary)' : 'var(--base-300)',
                  borderColor: done ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                  scale: isActive ? 1.28 : 1,
                }}
                transition={{ duration: 0.35 }}>
                {done ? <Check size={10} color="white" strokeWidth={3} /> : null}
              </motion.div>
              <p className="text-[8.5px] text-center leading-tight font-semibold" style={{ color: done ? 'var(--primary)' : 'rgba(255,255,255,0.25)' }}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER CARD
// ─────────────────────────────────────────────────────────────────────────────

const DriverCard = memo(function DriverCard({ driverSnapshot, vehicleSnapshot, status }) {
  const name  = driverSnapshot?.legalName || driverSnapshot?.name;
  const phone = driverSnapshot?.phone;
  const rating = driverSnapshot?.rating;
  const photo  = driverSnapshot?.photoUrl;
  const v = vehicleSnapshot;
  if (!name && !v) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3.5 rounded-2xl border"
      style={{ background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.18)' }}>
      <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
        style={{ background: 'rgba(59,130,246,0.12)' }}>
        {photo ? <img src={photo} alt={name} className="w-full h-full object-cover" /> : <span className="text-2xl">🚗</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {name && <p className="text-sm font-bold text-base-content m-0 truncate">{name}</p>}
          {rating && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star size={10} className="text-warning fill-warning" />
              <span className="text-[10px] font-bold text-base-content/55">{Number(rating).toFixed(1)}</span>
            </div>
          )}
        </div>
        {v && (
          <p className="text-[10.5px] text-base-content/45 m-0 mt-0.5 truncate">
            {[v.make, v.model, v.color].filter(Boolean).join(' · ')}
            {v.registrationNumber ? ` · ${v.registrationNumber}` : ''}
          </p>
        )}
        {status && (
          <div className="mt-1">
            <StatusBadge status={status} />
          </div>
        )}
      </div>
      {phone && (
        <a href={`tel:${phone}`}
          className="w-10 h-10 rounded-xl flex items-center justify-center no-underline flex-shrink-0"
          style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.28)', color: '#3b82f6' }}>
          <Phone size={15} />
        </a>
      )}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// CARE ASSISTANT CARD
// ─────────────────────────────────────────────────────────────────────────────

const CareCard = memo(function CareCard({ snapshot, caStatus, jpCompleted, jpCoords }) {
  if (!snapshot) return null;
  const name  = snapshot.name || snapshot.fullName;
  const phone = snapshot.phone;
  const photo = snapshot.photoUrl;
  const cfg   = CA_STATUS_CFG[caStatus] || CA_STATUS_CFG.not_joined;
  const inRide = ['in_ride', 'IN_VEHICLE'].includes(caStatus);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3.5 rounded-2xl border"
      style={{ background: 'rgba(236,72,153,0.06)', borderColor: 'rgba(236,72,153,0.18)' }}>
      <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center relative"
        style={{ background: 'rgba(236,72,153,0.12)' }}>
        {photo ? <img src={photo} alt={name} className="w-full h-full object-cover" /> : <span className="text-2xl" style={{ animation: inRide ? 'heartbeat 1.5s ease-in-out infinite' : undefined }}>❤️</span>}
        {inRide && <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-success border-2 border-base-200 flex items-center justify-center"><Check size={7} color="white" strokeWidth={3} /></div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {name && <p className="text-sm font-bold text-base-content m-0 truncate">{name}</p>}
          {jpCompleted && <span className="text-[9px] bg-success/12 text-success border border-success/28 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">In Ride ✓</span>}
        </div>
        <div className="mt-1"><CaBadge status={caStatus} /></div>
        {jpCoords && !jpCompleted && (
          <p className="text-[10px] text-base-content/40 m-0 mt-1 flex items-center gap-1">
            <MapPin size={9} className="flex-shrink-0" />
            Heading to join point
          </p>
        )}
      </div>
      {phone && (
        <a href={`tel:${phone}`}
          className="w-10 h-10 rounded-xl flex items-center justify-center no-underline flex-shrink-0"
          style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.28)', color: '#ec4899' }}>
          <Phone size={15} />
        </a>
      )}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// STOPS PANEL
// ─────────────────────────────────────────────────────────────────────────────

const StopsPanel = memo(function StopsPanel({ stops = [], currentStopId }) {
  if (!stops.length) return null;
  const STOP_ICONS = { PATIENT_PICKUP: '📍', CARE_ASSISTANT_JOIN: '📌', HOSPITAL: '🏥', PHARMACY: '💊', LAB: '🔬', BLOOD_BANK: '🩸', CUSTOM: '📌' };
  const STATUS_DOT = { PENDING: '#64748b', ARRIVED: '#f59e0b', COMPLETED: '#22c55e', SKIPPED: '#64748b', MISSED: '#ef4444' };
  return (
    <div className="p-3.5 rounded-2xl bg-base-300/50 border border-base-300">
      <p className="text-[9.5px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-3">Route Stops</p>
      <div className="flex flex-col gap-1">
        {stops.slice().sort((a, b) => (a.sequence || 0) - (b.sequence || 0)).map((s, i) => {
          const isActive = s._id?.toString() === currentStopId?.toString() || s.stopId?.toString() === currentStopId?.toString();
          return (
            <div key={s._id || i} className={`flex items-center gap-2.5 p-2 rounded-xl transition-all ${isActive ? 'bg-primary/10 border border-primary/28' : ''}`}>
              <span className="text-base flex-shrink-0">{STOP_ICONS[s.stopType] || '📌'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-base-content/75 m-0 truncate">{s.location?.address || s.stopType?.replace(/_/g, ' ')}</p>
                {s.status && <p className="text-[9px] text-base-content/40 m-0">{s.status}</p>}
              </div>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[s.status] || '#64748b' }} />
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM SHEET
// ─────────────────────────────────────────────────────────────────────────────

const BottomSheet = memo(function BottomSheet({
  open, onToggle, status, rideCode, booking, btype,
  otp, onShowOtp,
  driverSnapshot, vehicleSnapshot,
  caSnapshot, caStatus, jpCompleted, jpCoords,
  etaMinutes, distKm,
  stops, currentStopId,
  hospitalEta,
  activeTab, onTabChange,
}) {
  const statusCfg = STATUS_CFG[status] || STATUS_CFG.searching;
  const showOtpBtn = ['driver_arrived', 'otp_verified'].includes(status) && otp;
  const isCareOnly = btype === 'care_assistant';
  const isFullCare = btype === 'full_care_ride';
  const caCfg = CA_STATUS_CFG[caStatus] || CA_STATUS_CFG.not_joined;
  const btLabel = BOOKING_TYPE_LABELS[btype];

  const TABS = [
    { key: 'info', label: 'Status' },
    { key: 'route', label: 'Route' },
    { key: 'details', label: 'Details' },
  ];

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: open ? '0%' : 'calc(100% - 88px)' }}
      transition={{ type: 'spring', damping: 28, stiffness: 290 }}
      className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl border border-b-0"
      style={{
        background: 'rgba(var(--base-200-rgb, 18,22,32), 0.97)',
        backdropFilter: 'blur(24px)',
        borderColor: 'rgba(255,255,255,0.07)',
        maxHeight: '82vh',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.42)',
      }}>

      {/* Handle + status row */}
      <button onClick={onToggle} className="w-full cursor-pointer px-4 pt-3 pb-2.5 flex flex-col items-center bg-transparent border-none">
        <div className="w-10 h-1 rounded-full bg-base-300/70 mb-3" />
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-1.5 flex-wrap gap-y-1.5 flex-1 min-w-0">
            {!isCareOnly && <StatusBadge status={status} />}
            {(isFullCare || isCareOnly) && caStatus && <CaBadge status={caStatus} />}
            {btLabel && (
              <span className="text-[9px] font-bold text-base-content/35 ml-1">{btLabel.icon} {btLabel.label}</span>
            )}
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {etaMinutes != null && (
              <div className="flex items-center gap-1">
                <Clock size={11} className="text-primary" />
                <span className="text-xs font-black text-primary">{fmtEta(etaMinutes)}</span>
              </div>
            )}
            {distKm != null && (
              <div className="flex items-center gap-1">
                <Navigation size={11} className="text-base-content/40" />
                <span className="text-[11px] font-semibold text-base-content/50">{fmtKm(distKm)}</span>
              </div>
            )}
            <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.22 }}>
              <ChevronDown size={14} className="text-base-content/35" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Content */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(82vh - 100px)' }}>

        {/* Tabs */}
        <div className="flex px-4 gap-1.5 mb-3 border-b border-base-300/40 pb-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => onTabChange(t.key)}
              className={`flex-1 py-2.5 text-[11px] font-bold cursor-pointer bg-transparent border-none border-b-2 transition-all ${activeTab === t.key ? 'text-primary border-primary' : 'text-base-content/35 border-transparent hover:text-base-content/65'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-4 pb-6">
          {activeTab === 'info' && (
            <div className="flex flex-col gap-3">
              {/* OTP Banner */}
              <AnimatePresence>
                {showOtpBtn && (
                  <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    onClick={onShowOtp}
                    className="w-full flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer"
                    style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.38)' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(168,85,247,0.14)' }}>
                        <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.6 }} className="text-xl">🔑</motion.span>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black m-0" style={{ color: '#a855f7' }}>Show OTP to Driver</p>
                        <p className="text-[10.5px] m-0 mt-0.5" style={{ color: 'rgba(168,85,247,0.65)' }}>Tap to reveal your ride code</p>
                      </div>
                    </div>
                    <ArrowUpRight size={16} style={{ color: '#a855f7' }} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Hospital ETA */}
              {hospitalEta?.etaMinutes && (
                <div className="flex items-center gap-3 p-3.5 rounded-2xl border"
                  style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.18)' }}>
                  <span className="text-2xl">🏥</span>
                  <div>
                    <p className="text-xs font-bold text-base-content/65 m-0">Hospital ETA</p>
                    <p className="text-base font-black text-error m-0">{fmtEta(hospitalEta.etaMinutes)} · {fmtKm(hospitalEta.distanceKm)}</p>
                    {hospitalEta.hospitalName && <p className="text-[10px] text-base-content/40 m-0">{hospitalEta.hospitalName}</p>}
                  </div>
                </div>
              )}

              {/* Driver + CA cards */}
              {!isCareOnly && <DriverCard driverSnapshot={driverSnapshot} vehicleSnapshot={vehicleSnapshot} status={status} />}
              {(isFullCare || isCareOnly) && <CareCard snapshot={caSnapshot} caStatus={caStatus} jpCompleted={jpCompleted} jpCoords={jpCoords} />}

              {/* Timeline */}
              {!isCareOnly && <div className="rounded-2xl bg-base-300/40 border border-base-300/60 overflow-hidden"><TimelineBar status={status} /></div>}
            </div>
          )}

          {activeTab === 'route' && (
            <div className="flex flex-col gap-3">
              {stops?.length > 0 ? (
                <StopsPanel stops={stops} currentStopId={currentStopId} />
              ) : (
                <>
                  {/* Pickup → Destination route card */}
                  <div className="p-3.5 rounded-2xl bg-base-300/40 border border-base-300/60">
                    <p className="text-[9.5px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-3">Your Journey</p>
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center gap-1 pt-1 flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-base-100" />
                        <div className="w-0.5 h-8 bg-base-300/60" />
                        {(booking?.destinationLocation || booking?.hospital) && <div className="w-2.5 h-2.5 rounded-full bg-error border-2 border-base-100" />}
                      </div>
                      <div className="flex-1 flex flex-col gap-4 min-w-0">
                        <div>
                          <p className="text-[11.5px] font-semibold text-base-content/75 m-0 truncate">{booking?.patientLocation?.address || 'Pickup point'}</p>
                          <p className="text-[9.5px] text-base-content/40 m-0">Pickup</p>
                        </div>
                        {booking?.destinationLocation?.address && (
                          <div>
                            <p className="text-[11.5px] font-semibold text-base-content/75 m-0 truncate">{booking.destinationLocation.address}</p>
                            <p className="text-[9.5px] text-base-content/40 m-0">Hospital / Destination</p>
                          </div>
                        )}
                      </div>
                    </div>
                    {(distKm || etaMinutes) && (
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-base-300/40">
                        {distKm && <div className="flex items-center gap-1"><Route size={11} className="text-primary" /><span className="text-xs font-bold text-primary">{fmtKm(distKm)}</span></div>}
                        {etaMinutes && <div className="flex items-center gap-1"><Timer size={11} className="text-base-content/45" /><span className="text-xs font-semibold text-base-content/55">{fmtEta(etaMinutes)}</span></div>}
                      </div>
                    )}
                  </div>

                  {/* JP card for full care ride */}
                  {isFullCare && jpCoords && (
                    <div className={`p-3.5 rounded-2xl border ${jpCompleted ? 'border-success/28' : 'border-warning/28'}`}
                      style={{ background: jpCompleted ? 'rgba(34,197,94,0.06)' : 'rgba(245,158,11,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{jpCompleted ? '✅' : '📌'}</span>
                        <div>
                          <p className="text-[11px] font-bold m-0" style={{ color: jpCompleted ? '#22c55e' : '#f59e0b' }}>
                            {jpCompleted ? 'Care Assistant Joined' : 'Care Assistant Join Point'}
                          </p>
                          <p className="text-[10px] text-base-content/40 m-0 mt-0.5">
                            {jpCompleted ? 'CA is in the vehicle with you' : 'CA will meet the vehicle here'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="flex flex-col gap-3">
              {booking && (
                <div className="p-3.5 rounded-2xl bg-base-300/40 border border-base-300/60">
                  <p className="text-[9.5px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2.5">Booking</p>
                  <InfoRow label="Code"        value={booking.bookingCode} mono />
                  <InfoRow label="Ride Code"   value={rideCode} mono />
                  <InfoRow label="Type"        value={btLabel ? `${btLabel.icon} ${btLabel.label}` : booking.bookingType?.replace(/_/g, ' ')} />
                  <InfoRow label="Scheduled"   value={booking.scheduledAt ? new Date(booking.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null} />
                  <InfoRow label="Patient"     value={booking.patientInfo?.name} />
                  <InfoRow label="Payment"     value={booking.paymentStatus} />
                  <InfoRow label="Total Fare"  value={booking.fareBreakdown?.totalAmount ? `₹${booking.fareBreakdown.totalAmount}` : null} />
                  <InfoRow label="Paid"        value={booking.fareBreakdown?.amountPaid ? `₹${booking.fareBreakdown.amountPaid}` : null} />
                </div>
              )}
              {driverSnapshot && (
                <div className="p-3.5 rounded-2xl bg-base-300/40 border border-base-300/60">
                  <p className="text-[9.5px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2.5">Driver</p>
                  <InfoRow label="Name"        value={driverSnapshot.legalName || driverSnapshot.name} />
                  <InfoRow label="Code"        value={driverSnapshot.driverCode} mono />
                  <InfoRow label="Rating"      value={driverSnapshot.rating ? `${Number(driverSnapshot.rating).toFixed(1)} ⭐` : null} />
                  <InfoRow label="Phone"       value={vehicleSnapshot?.registrationNumber} />
                  <InfoRow label="Vehicle"     value={vehicleSnapshot ? [vehicleSnapshot.make, vehicleSnapshot.model, vehicleSnapshot.color].filter(Boolean).join(' ') : null} />
                  <InfoRow label="Reg No."     value={vehicleSnapshot?.registrationNumber} mono />
                </div>
              )}
              {caSnapshot && (
                <div className="p-3.5 rounded-2xl bg-base-300/40 border border-base-300/60">
                  <p className="text-[9.5px] text-base-content/40 font-bold uppercase tracking-widest m-0 mb-2.5">Care Assistant</p>
                  <InfoRow label="Name"  value={caSnapshot.name || caSnapshot.fullName} />
                  <InfoRow label="Phone" value={caSnapshot.phone} />
                  <InfoRow label="Status" value={CA_STATUS_CFG[caStatus]?.label} />
                  {jpCompleted && <InfoRow label="Status" value="In vehicle ✓" />}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TOAST
// ─────────────────────────────────────────────────────────────────────────────

let _notifId = 0;
const useNotifications = () => {
  const [notifs, setNotifs] = useState([]);
  const push = useCallback((msg, type = 'info', icon = '📢') => {
    const id = ++_notifId;
    setNotifs(p => [...p.slice(-4), { id, msg, type, icon }]);
    setTimeout(() => setNotifs(p => p.filter(n => n.id !== id)), 4500);
  }, []);
  return { notifs, push };
};

const NotifToast = memo(function NotifToast({ notifs }) {
  if (!notifs.length) return null;
  const TYPE_COLORS = { info: '#3b82f6', success: '#22c55e', warning: '#f59e0b', error: '#ef4444' };
  return (
    <div className="fixed right-3 z-[55] flex flex-col gap-2" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 72px)' }}>
      <AnimatePresence>
        {notifs.map(n => (
          <motion.div key={n.id}
            initial={{ x: 120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 120, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 360 }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold max-w-[220px] shadow-lg"
            style={{ background: `${TYPE_COLORS[n.type]}15`, border: `1px solid ${TYPE_COLORS[n.type]}30`, color: TYPE_COLORS[n.type], backdropFilter: 'blur(12px)' }}>
            <span className="text-base flex-shrink-0">{n.icon}</span>
            <span className="leading-tight">{n.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// END / CANCELLED SCREENS
// ─────────────────────────────────────────────────────────────────────────────

const CompletedScreen = memo(function CompletedScreen({ booking, onBack, onRate }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--base-100)' }}>
      <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.1, type: 'spring', damping: 14, stiffness: 260 }}
        className="text-7xl mb-6">🎉</motion.div>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ delay: 0.25, type: 'spring', damping: 14 }}
        className="w-[80px] h-[80px] rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.35)' }}>
        <CheckCircle size={42} className="text-success" />
      </motion.div>
      <motion.h2 initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="text-2xl font-black text-base-content text-center m-0 mb-2">
        Ride Completed!
      </motion.h2>
      <motion.p initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="text-sm text-base-content/50 text-center m-0 mb-2">
        We hope you had a safe and comfortable journey.
      </motion.p>
      {booking?.fareBreakdown?.totalAmount && (
        <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl border mb-8"
          style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.25)' }}>
          <span className="text-sm text-base-content/55">Total Fare</span>
          <span className="text-lg font-black text-success">₹{booking.fareBreakdown.totalAmount}</span>
        </motion.div>
      )}
      <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={onRate} className="btn btn-primary btn-lg rounded-2xl font-bold" style={{ fontFamily: 'inherit' }}>
          <Star size={16} /> Rate Your Experience
        </button>
        <button onClick={onBack} className="btn btn-ghost btn-lg rounded-2xl font-semibold text-base-content/55" style={{ fontFamily: 'inherit' }}>
          Back to Bookings
        </button>
      </motion.div>
    </motion.div>
  );
});

const CancelledScreen = memo(function CancelledScreen({ onBack }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center px-6"
      style={{ background: 'var(--base-100)' }}>
      <div className="text-7xl mb-6">😔</div>
      <h2 className="text-2xl font-black text-base-content text-center m-0 mb-2">Ride Cancelled</h2>
      <p className="text-sm text-base-content/50 text-center m-0 mb-8">Your ride was cancelled. Please book again if needed.</p>
      <button onClick={onBack} className="btn btn-primary btn-lg rounded-2xl px-8 font-bold" style={{ fontFamily: 'inherit' }}>
        Back to Bookings
      </button>
    </motion.div>
  );
});

const InitLoading = memo(function InitLoading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'var(--base-100)' }}>
      <motion.div animate={{ scale: [1, 1.18, 1] }} transition={{ repeat: Infinity, duration: 1.8 }} className="text-5xl">🚑</motion.div>
      <div className="flex flex-col items-center gap-1">
        <p className="text-sm font-bold text-base-content/60 m-0">Loading your ride…</p>
        <Skeleton className="w-32 h-2 mt-2" />
      </div>
    </div>
  );
});

const SearchingOverlay = memo(function SearchingOverlay({ bookingCode, btype }) {
  const btLabel = BOOKING_TYPE_LABELS[btype];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10 px-7"
      style={{ background: 'var(--base-100)' }}>
      <motion.div animate={{ scale: [1, 1.20, 1] }} transition={{ repeat: Infinity, duration: 2.2 }} className="text-6xl mb-6">🔍</motion.div>
      {btLabel && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
          style={{ background: `${btLabel.color}15`, color: btLabel.color, border: `1px solid ${btLabel.color}30` }}>
          {btLabel.icon} {btLabel.label}
        </span>
      )}
      <h3 className="text-xl font-black text-base-content m-0 mb-2 text-center">Finding Your Driver</h3>
      <p className="text-sm text-base-content/50 text-center m-0 mb-1">Matching you with the best available driver nearby.</p>
      {bookingCode && <p className="text-[11px] text-base-content/28 font-mono m-0 mt-1">#{bookingCode}</p>}
      <motion.p animate={{ opacity: [0.38, 1, 0.38] }} transition={{ repeat: Infinity, duration: 2.5 }}
        className="text-xs text-primary font-semibold mt-8 m-0">
        You'll be notified when a driver accepts
      </motion.p>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAP LEGEND (full_care_ride)
// ─────────────────────────────────────────────────────────────────────────────

const MapLegend = memo(function MapLegend({ show }) {
  if (!show) return null;
  const items = [
    { color: '#3b82f6', label: 'Driver' },
    { color: '#22c55e', label: 'Pickup' },
    { color: '#ef4444', label: 'Hospital' },
    { color: '#f59e0b', label: 'Join Point' },
    { color: '#ec4899', label: 'Care Asst.' },
  ];
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
      className="absolute z-20 flex flex-col gap-1.5 px-3 py-2.5 rounded-2xl"
      style={{
        bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', left: 12,
        background: 'rgba(0,0,0,0.82)', border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(14px)', minWidth: 110,
      }}>
      <p className="text-[7.5px] font-bold uppercase tracking-widest text-white/32 m-0 mb-0.5">Legend</p>
      {items.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 4px ${color}90` }} />
          <span className="text-[9px] font-semibold text-white/62">{label}</span>
        </div>
      ))}
    </motion.div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function CustomerRideLiveTracking() {
  const params    = useParams();
  const router    = useRouter();
  const dispatch  = useDispatch();
  const bookingId = params?.bookingId ?? null;
  const rideId    = params?.rideId    ?? null;

  // ── Store selectors ───────────────────────────────────────────────────────
  const currentRide    = useSelector(selectCurrentRide);
  const socketLive     = useSelector(selectSocketLive);
  const liveData       = useSelector(selectLiveData);
  const booking        = useSelector(selectSelectedBooking);
const careSnapshot   = useSelector(selectCareTrackingSnapshot);
  const participants   = useSelector(selectParticipants);
  const rideStops      = useSelector(selectStops);
  const currentStopId  = useSelector(selectCurrentStopId);
  const sosEvents      = useSelector(selectBookingSosEvents);

  // ── Socket ────────────────────────────────────────────────────────────────
  const { on, connected } = useSocket();
  const { isLoaded }      = useGoogleMaps();

  // ── Notifications ─────────────────────────────────────────────────────────
  const { notifs, push: notify } = useNotifications();

  // ── Refs — map ────────────────────────────────────────────────────────────
  const mapRef          = useRef(null);
  const mapContainerRef = useRef(null);
  const dirSvcRef       = useRef(null);

  // ── Refs — driver marker ──────────────────────────────────────────────────
  const driverMkRef   = useRef(null);
  const driverPosRef  = useRef(null);
  const driverTgtRef  = useRef(null);
  const driverSpdRef  = useRef(0);
  const headRef       = useRef(0);

  // ── Refs — CA marker ──────────────────────────────────────────────────────
  const caMkRef   = useRef(null);
  const caPosRef  = useRef(null);
  const caTgtRef  = useRef(null);

  // ── Refs — static markers ─────────────────────────────────────────────────
  const pickupMkRef = useRef(null);
  const destMkRef   = useRef(null);
  const jpMkRef     = useRef(null);
  const staticsDone = useRef(false);

  // ── Refs — misc ───────────────────────────────────────────────────────────
  const animRef       = useRef(null);
  const pollRef       = useRef(null);
  const routeThrottle = useRef(0);
  const mountedRef    = useRef(true);

  // ── State ─────────────────────────────────────────────────────────────────
  const [mapReady,      setMapReady]      = useState(false);
  const [initLoading,   setInitLoading]   = useState(true);
  const [rideStatus,    setRideStatus]    = useState(null);
  const [btype,         setBtype]         = useState(null);
  const [driverPos,     setDriverPos]     = useState(null);
  const [caPos,         setCaPos]         = useState(null);
  const [heading,       setHeading]       = useState(0);
  const [speed,         setSpeed]         = useState(0);
  const [etaMinutes,    setEtaMinutes]    = useState(null);
  const [distKm,        setDistKm]        = useState(null);
  const [hospitalEta,   setHospitalEta]   = useState(null);
  const [otp,           setOtp]           = useState(null);
  const [caStatus,      setCaStatus]      = useState('not_joined');
  const [caSnapshot,    setCaSnapshot]    = useState(null);
  const [jpCoords,      setJpCoords]      = useState(null);
  const [jpCompleted,   setJpCompleted]   = useState(false);
  const [driverRoute,   setDriverRoute]   = useState(null);
  const [overviewRoute, setOverviewRoute] = useState(null);
  const [followDriver,  setFollowDriver]  = useState(true);
  const [sheetOpen,     setSheetOpen]     = useState(false);
  const [activeTab,     setActiveTab]     = useState('info');
  const [showOtpModal,  setShowOtpModal]  = useState(false);
  const [showSosModal,  setShowSosModal]  = useState(false);
  const [sosActive,     setSosActive]     = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);
  const [mapZoom,       setMapZoom]       = useState(15);
  const [isFullscreen,  setIsFullscreen]  = useState(false);
  const [showLegend,    setShowLegend]    = useState(true);

  // ── Derived ───────────────────────────────────────────────────────────────
  const rd         = currentRide || liveData;
  const activeRideId = rideId || currentRide?._id || liveData?.rideId;
  const isCareOnly = btype === 'care_assistant';
  const isFullCare = btype === 'full_care_ride';
  const showDriver = !isCareOnly;
  const showCa     = isCareOnly || isFullCare;
  const activeStatus = rideStatus || socketLive?.status || rd?.status || 'searching';
  const isSearching  = ['searching', 'requested'].includes(activeStatus);
  const isPostOtp    = ['otp_verified', 'in_progress', 'at_stop'].includes(activeStatus);

  const driverSnapshot  = useMemo(() => socketLive?.driverSnapshot  || rd?.driverSnapshot,  [socketLive, rd]);
  const vehicleSnapshot = useMemo(() => socketLive?.vehicleSnapshot || rd?.vehicleSnapshot, [socketLive, rd]);
  const caName = caSnapshot?.name || caSnapshot?.fullName || 'Care Asst.';

  const pickupCoords = useMemo(() => {
    const c = rd?.pickup?.coordinates || booking?.patientLocation?.coordinates;
    return geoToLatLng(c);
  }, [rd, booking]);

  const dropoffCoords = useMemo(() => {
    const c = rd?.dropoff?.coordinates || booking?.destinationLocation?.coordinates;
    return geoToLatLng(c);
  }, [rd, booking]);

  // ── Route calc ────────────────────────────────────────────────────────────
  const routeOnce = useCallback(async (origin, destination) => {
    if (!dirSvcRef.current || !origin || !destination) return null;
    try {
      const r = await dirSvcRef.current.route({
        origin, destination, travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      });
      return r.status === 'OK' ? r : null;
    } catch { return null; }
  }, []);

  const calcRoutes = useCallback(async (drPos) => {
    if (!mapReady || !pickupCoords || !dropoffCoords || isCareOnly) return;
    const now = Date.now();
    if (now - routeThrottle.current < ROUTE_THROTTLE_MS) return;
    routeThrottle.current = now;
    const origin = drPos || driverPosRef.current;
    const dest   = isPostOtp ? dropoffCoords : pickupCoords;
    const [ovr, dr] = await Promise.all([
      routeOnce(pickupCoords, dropoffCoords),
      origin ? routeOnce(origin, dest) : null,
    ]);
    if (ovr && mountedRef.current) setOverviewRoute(ovr);
    if (dr  && mountedRef.current) setDriverRoute(dr);
  }, [mapReady, pickupCoords, dropoffCoords, isPostOtp, routeOnce, isCareOnly]);

  // ── Initial data load ─────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const load = async () => {
      setInitLoading(true);
      const tasks = [];
if (rideId)    { tasks.push(dispatch(fetchRideTracking({ rideId }))); tasks.push(dispatch(fetchRideLive(rideId))); tasks.push(dispatch(fetchRideStops({ rideId }))); }
      if (bookingId) { tasks.push(dispatch(fetchMyBookingById({ bookingId }))); tasks.push(dispatch(fetchCareTrackingSnapshot({ bookingId }))); tasks.push(dispatch(fetchBookingSosEvents({ bookingId }))); }
      if (rideId)    { tasks.push(dispatch(fetchRideParticipants({ rideId }))); }
      await Promise.all(tasks).catch(console.error);
      if (mountedRef.current) setInitLoading(false);
    };
    load();
    return () => { mountedRef.current = false; };
  }, [rideId, bookingId]); // eslint-disable-line

  // ── Sync booking type ─────────────────────────────────────────────────────
  useEffect(() => {
    const bt = booking?.bookingType || currentRide?.bookingType;
    if (bt && bt !== btype) setBtype(bt);
  }, [booking, currentRide, btype]);

  // ── Sync CA snapshot from participants ────────────────────────────────────
  useEffect(() => {
    if (!participants?.length) return;
    const caPart = participants.find(p => p.role === 'CARE_ASSISTANT' && p.isActive !== false);
    if (caPart?.snapshot && !caSnapshot) setCaSnapshot(caPart.snapshot);
    if (caPart?.status && caPart.status !== caStatus) setCaStatus(caPart.status);
  }, [participants]); // eslint-disable-line

  // ── Sync CA snapshot from careTrackingSnapshot ────────────────────────────
  useEffect(() => {
    if (!careSnapshot) return;
    if (careSnapshot.careAssistant && !caSnapshot) {
      setCaSnapshot(careSnapshot.careAssistant);
      if (careSnapshot.careAssistant.status) setCaStatus(careSnapshot.careAssistant.status);
    }
    if (careSnapshot.route?.caJoinWaypoint) {
      const jp = careSnapshot.route.caJoinWaypoint;
      if (jp.coordinates?.length >= 2) setJpCoords({ lat: jp.coordinates[1], lng: jp.coordinates[0] });
      if (jp.isCompleted) setJpCompleted(true);
    }
  }, [careSnapshot]); // eslint-disable-line

  // ── Sync JP from ride waypoints ───────────────────────────────────────────
  useEffect(() => {
    if (!isFullCare) return;
    const wps = rd?.waypoints || [];
    const jp  = wps.find(w => w.type === 'care_assistant_join');
    if (jp?.location?.coordinates?.length >= 2) {
      const c = jp.location.coordinates;
      setJpCoords({ lat: c[1], lng: c[0] });
      if (jp.isCompleted) setJpCompleted(true);
    }
  }, [isFullCare, rd?.waypoints]);

  // ── Seed driver pos ───────────────────────────────────────────────────────
  useEffect(() => {
    const loc = socketLive?.liveLocation || liveData?.liveLocation;
    if (loc?.lat && loc?.lng && !driverTgtRef.current) {
      const pos = { lat: loc.lat, lng: loc.lng };
      driverTgtRef.current = pos; driverPosRef.current = pos;
      driverSpdRef.current = loc.speedKmh || 0;
      setDriverPos(pos); setHeading(loc.heading || 0); setSpeed(loc.speedKmh || 0);
      headRef.current = loc.heading || 0;
    }
  }, [socketLive?.liveLocation, liveData?.liveLocation]);

  // ── Seed CA pos ───────────────────────────────────────────────────────────
  useEffect(() => {
    const caLoc = careSnapshot?.careAssistant?.liveLocation;
    if (caLoc?.lat && caLoc?.lng && !caTgtRef.current) {
      const pos = { lat: caLoc.lat, lng: caLoc.lng };
      caTgtRef.current = pos; caPosRef.current = pos;
      setCaPos(pos);
    }
  }, [careSnapshot]);

  // ── Sync status / ETA ─────────────────────────────────────────────────────
  useEffect(() => {
    const s = socketLive?.status || rd?.status;
    if (s && mountedRef.current) setRideStatus(s);
  }, [socketLive?.status, rd?.status]);

  useEffect(() => {
    const eta = socketLive?.etaMinutes ?? liveData?.currentEtaMinutes;
    if (eta != null && mountedRef.current) setEtaMinutes(eta);
  }, [socketLive?.etaMinutes, liveData?.currentEtaMinutes]);

  // ── SOS active sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const active = sosEvents?.some(e => !e.isResolved);
    setSosActive(active);
  }, [sosEvents]);

  // ── Completed / cancelled ─────────────────────────────────────────────────
  useEffect(() => {
    if (activeStatus === 'completed') { const t = setTimeout(() => { if (mountedRef.current) setShowCompleted(true); }, 2200); return () => clearTimeout(t); }
    if (activeStatus === 'cancelled') { const t = setTimeout(() => { if (mountedRef.current) setShowCancelled(true); }, 1200); return () => clearTimeout(t); }
  }, [activeStatus]);

  // ── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [

      on(SOCKET_EVENTS.RIDE_STATUS_CHANGED, (d) => {
        dispatch(socketRideStatusChanged(d));
        if (mountedRef.current) setRideStatus(d.status);
        if (d.bookingType) setBtype(d.bookingType);
      }),

      on('driver_accepted',  (d) => { dispatch(socketDriverAccepted(d));  if (mountedRef.current) { setRideStatus('driver_accepted'); notify('Driver confirmed your ride!', 'success', '✅'); } }),
      on('driver_en_route',  (d) => { dispatch(socketDriverEnRoute(d));   if (mountedRef.current) { setRideStatus('driver_en_route'); notify('Driver is on the way!', 'info', '🚗'); } }),
      on('driver_arrived',   (d) => { dispatch(socketDriverArrived(d));   if (mountedRef.current) { setRideStatus('driver_arrived'); setSheetOpen(true); notify('Driver has arrived!', 'warning', '📍'); } }),
      on('otp_verified',     (d) => { dispatch(socketOtpVerified(d));     if (mountedRef.current) { setRideStatus('otp_verified'); setShowOtpModal(false); notify('OTP verified — ride starting!', 'success', '🔑'); } }),
      on('ride_started',     (d) => { dispatch(socketRideStarted(d));     if (mountedRef.current) { setRideStatus('in_progress'); notify('Ride is in progress', 'success', '🏥'); } }),
      on('ride_completed',   (d) => { dispatch(socketRideCompleted(d));   if (mountedRef.current) setRideStatus('completed'); }),
      on('ride_cancelled',   (d) => { dispatch(socketRideCancelled(d));   if (mountedRef.current) setRideStatus('cancelled'); }),
      on('ride_assigned',    (d) => { dispatch(socketRideAssigned(d));    if (mountedRef.current) { setRideStatus(d.status); notify('Driver assigned!', 'info', '👤'); } }),

      on(SOCKET_EVENTS.LOCATION_UPDATE, (d) => {
        dispatch(socketLocationUpdate(d));
        const { lat, lng, heading: hdg = 0, speed: spd = 0, remainingKm, etaMinutes: eta } = d;
        driverTgtRef.current = { lat, lng };
        driverSpdRef.current = spd;
        let diff = hdg - headRef.current;
        if (diff > 180) diff -= 360; if (diff < -180) diff += 360;
        headRef.current = (headRef.current + diff * 0.18 + 360) % 360;
        if (mountedRef.current) { setHeading(headRef.current); setSpeed(spd); }
        if (eta != null && mountedRef.current) setEtaMinutes(eta);
        if (remainingKm != null && mountedRef.current) setDistKm(remainingKm);
      }),

      on(SOCKET_EVENTS.ETA_UPDATE, (d) => {
        dispatch(socketEtaUpdate(d));
        if (d.etaMinutes != null && mountedRef.current)           setEtaMinutes(d.etaMinutes);
        if (d.distanceRemainingKm != null && mountedRef.current)  setDistKm(d.distanceRemainingKm);
      }),

      on(SOCKET_EVENTS.HOSPITAL_ETA_UPDATE, (d) => {
        dispatch(socketHospitalEtaUpdate(d));
        if (mountedRef.current) setHospitalEta({ etaMinutes: d.etaMinutes, distanceKm: d.distanceKm, hospitalName: d.hospitalName });
      }),

      on('otp_required', (d) => {
        if (!mountedRef.current) return;
        if (d.otp) setOtp(String(d.otp));
        setRideStatus('driver_arrived');
        setSheetOpen(true);
        notify('Show OTP to your driver', 'warning', '🔑');
      }),

      // ── CA events ──────────────────────────────────────────────────────
      on(SOCKET_EVENTS.CARE_ASSISTANT_LOCATION_UPDATE, (d) => {
        if (!mountedRef.current) return;
        caTgtRef.current = { lat: d.lat, lng: d.lng };
        if (d.status) setCaStatus(d.status);
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_STATUS_CHANGE, (d) => {
        if (!mountedRef.current) return;
        const s = d.careAssistantStatus || d.status;
        if (s) { setCaStatus(s); if (s === 'AT_JOIN_POINT' || s === 'at_pickup') notify('Care assistant at the join point!', 'warning', '❤️'); }
        if (d.careAssistantName) setCaSnapshot(p => ({ ...(p || {}), name: d.careAssistantName }));
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_AT_JP, (d) => {
        dispatch(socketCaAtJoinPoint(d));
        if (!mountedRef.current) return;
        setCaStatus('at_pickup');
        notify('Care assistant waiting at join point!', 'warning', '⏳');
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_JOINED_RIDE, (d) => {
        dispatch(socketCaJoinedRide(d));
        if (!mountedRef.current) return;
        setCaStatus('in_ride');
        if (d.jpCompleted) setJpCompleted(true);
        if (d.careAssistantName) setCaSnapshot(p => ({ ...(p || {}), name: d.careAssistantName }));
        notify('Care assistant is in the vehicle!', 'success', '❤️‍🔥');
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_ATTACHED, (d) => {
        if (!mountedRef.current) return;
        if (d.careAssistantName) setCaSnapshot(p => ({ ...(p || {}), name: d.careAssistantName }));
        setCaStatus('en_route_to_pickup');
        if (d.caJoinPoint?.coordinates?.length >= 2) {
          const c = d.caJoinPoint.coordinates;
          setJpCoords({ lat: c[1], lng: c[0] });
        }
        notify('Care assistant assigned to your ride', 'info', '❤️');
      }),

      on(SOCKET_EVENTS.CA_JOIN_WAYPOINT_COMPLETED, (d) => {
        dispatch(socketJpWaypointCompleted(d));
        if (!mountedRef.current) return;
        setJpCompleted(true);
        notify('CA joined the vehicle!', 'success', '✅');
      }),

      // ── SOS ─────────────────────────────────────────────────────────────
      on(SOCKET_EVENTS.SOS_RESOLVED, () => {
        if (!mountedRef.current) return;
        setSosActive(false);
        notify('SOS has been resolved', 'success', '✅');
      }),

      // ── Destination changed (admin) ──────────────────────────────────
      on(SOCKET_EVENTS.DESTINATION_CHANGED, (d) => {
        if (!mountedRef.current) return;
        notify('Destination was updated by admin', 'warning', '📍');
        routeThrottle.current = 0;
      }),

      // ── Stop events ──────────────────────────────────────────────────
      on(SOCKET_EVENTS.STOP_ARRIVED, (d) => {
        if (!mountedRef.current) return;
        notify('Arrived at stop', 'info', '⏸️');
      }),
      on(SOCKET_EVENTS.STOP_DEPARTED, (d) => {
        if (!mountedRef.current) return;
        notify('Departed from stop', 'info', '▶️');
      }),

      // ── Booking state snapshot ───────────────────────────────────────
      on(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, (d) => {
        if (!mountedRef.current || (d.bookingId && d.bookingId !== bookingId)) return;
        if (d.bookingType) setBtype(d.bookingType);
        if (d.tracking?.careAssistantStatus) setCaStatus(d.tracking.careAssistantStatus);
        const caLoc = d.tracking?.careAssistantLiveLocation;
        if (caLoc?.coordinates?.length === 2) caTgtRef.current = { lat: caLoc.coordinates[1], lng: caLoc.coordinates[0] };
        else if (caLoc?.lat && caLoc?.lng)    caTgtRef.current = { lat: caLoc.lat, lng: caLoc.lng };
        const jp = d.fullCareRide?.caJoinPoint;
        if (jp?.coordinates?.length >= 2) { setJpCoords({ lat: jp.coordinates[1], lng: jp.coordinates[0] }); if (jp.isCompleted) setJpCompleted(true); }
      }),
    ];

    return () => unsubs.forEach(fn => fn?.());
  }, [on, bookingId, dispatch]); // eslint-disable-line

  // ── Polling fallback ──────────────────────────────────────────────────────
  useEffect(() => {
    if (connected) { clearInterval(pollRef.current); return; }
    if (!activeRideId) return;
    pollRef.current = setInterval(() => {
      if (activeRideId) dispatch(fetchRideLive(activeRideId));
    }, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [connected, activeRideId, dispatch]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (driverTgtRef.current) {
        const cur = driverPosRef.current || { ...driverTgtRef.current };
        const p   = { lat: lerp(cur.lat, driverTgtRef.current.lat, 0.11), lng: lerp(cur.lng, driverTgtRef.current.lng, 0.11) };
        driverPosRef.current = p;
        if (mountedRef.current) setDriverPos({ ...p });
      }
      if (caTgtRef.current) {
        const cur = caPosRef.current || { ...caTgtRef.current };
        const p   = { lat: lerp(cur.lat, caTgtRef.current.lat, 0.09), lng: lerp(cur.lng, caTgtRef.current.lng, 0.09) };
        caPosRef.current = p;
        if (mountedRef.current) setCaPos({ ...p });
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, []);

  // ── Route recalc ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !driverPos || isCareOnly) return;
    calcRoutes(driverPos);
  }, [driverPos, mapReady, calcRoutes, isCareOnly]); // eslint-disable-line

  useEffect(() => {
    if (!mapReady) return;
    routeThrottle.current = 0;
    calcRoutes(driverPosRef.current || pickupCoords);
  }, [mapReady, isPostOtp, pickupCoords, dropoffCoords]); // eslint-disable-line

  // ── DRIVER MARKER ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !driverPos || !showDriver || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    if (!driverMkRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML = mkDriverMarker(heading, speed);
      driverMkRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: driverPos, zIndex: 10 });
    } else {
      driverMkRef.current.position = driverPos;
      const arrow = driverMkRef.current.content?.querySelector('div[style*="border-bottom"]');
      if (arrow) arrow.style.transform = `translateX(-50%) rotate(${heading}deg)`;
    }
    if (followDriver && mapRef.current && !isCareOnly) mapRef.current.panTo(driverPos);
  }, [driverPos, mapReady, heading, speed, showDriver, followDriver, isCareOnly]); // eslint-disable-line

  useEffect(() => { if (!showDriver && driverMkRef.current) { driverMkRef.current.map = null; driverMkRef.current = null; } }, [showDriver]);

  // ── CA MARKER ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !caPos || !showCa || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    if (!caMkRef.current) {
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML = mkCaMarker(caStatus, caName);
      caMkRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: caPos, zIndex: 12 });
    } else {
      caMkRef.current.position = caPos;
      if (caMkRef.current.content) caMkRef.current.content.innerHTML = mkCaMarker(caStatus, caName);
    }
    if (isCareOnly && followDriver && mapRef.current) mapRef.current.panTo(caPos);
  }, [caPos, mapReady, showCa, caStatus, caName, isCareOnly, followDriver]); // eslint-disable-line

  useEffect(() => { if (!showCa && caMkRef.current) { caMkRef.current.map = null; caMkRef.current = null; } }, [showCa]);

  // ── JP MARKER ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !isFullCare || !jpCoords || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    const stale = jpMkRef.current?._done !== jpCompleted;
    if (!jpMkRef.current || stale) {
      if (jpMkRef.current) { jpMkRef.current.map = null; jpMkRef.current = null; }
      const el = document.createElement('div');
      el.style.cssText = 'position:relative;width:0;height:0;';
      el.innerHTML = mkJpMarker(jpCompleted);
      jpMkRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: jpCoords, zIndex: 8 });
      jpMkRef.current._done = jpCompleted;
    } else { jpMkRef.current.position = jpCoords; }
  }, [mapReady, isFullCare, jpCoords, jpCompleted]);

  // ── STATIC MARKERS ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || staticsDone.current || !window.google?.maps?.marker?.AdvancedMarkerElement) return;
    let any = false;
    if (pickupCoords && !pickupMkRef.current) {
      const el = document.createElement('div'); el.style.cssText = 'position:relative;width:0;height:0;'; el.innerHTML = mkPickupMarker();
      pickupMkRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: pickupCoords, zIndex: 5 });
      any = true;
    }
    if (dropoffCoords && !destMkRef.current) {
      const el = document.createElement('div'); el.style.cssText = 'position:relative;width:0;height:0;'; el.innerHTML = mkHospMarker();
      destMkRef.current = new window.google.maps.marker.AdvancedMarkerElement({ map: mapRef.current, content: el, position: dropoffCoords, zIndex: 5 });
      any = true;
    }
    if (any) staticsDone.current = true;
  }, [mapReady, pickupCoords, dropoffCoords]);

  // ── Fit bounds on map ready ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const bounds = new window.google.maps.LatLngBounds();
    let pts = 0;
    [pickupCoords, dropoffCoords, driverPos, caPos, jpCoords].forEach(p => { if (p) { bounds.extend(p); pts++; } });
    if (pts > 1) mapRef.current.fitBounds(bounds, { top: 90, bottom: 200, left: 40, right: 40 });
  }, [mapReady]); // eslint-disable-line

  // ── Fullscreen listener ───────────────────────────────────────────────────
  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      [driverMkRef, caMkRef, jpMkRef, pickupMkRef, destMkRef].forEach(r => { if (r.current) { r.current.map = null; r.current = null; } });
      staticsDone.current = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onMapLoad = useCallback((map) => {
    mapRef.current  = map;
    dirSvcRef.current = new window.google.maps.DirectionsService();
    setMapReady(true);
    map.addListener('zoom_changed', () => { if (mountedRef.current) setMapZoom(map.getZoom()); });
  }, []);

  const handleBack   = useCallback(() => { if (window.history?.length > 1) router.back(); else router.push('/bookings'); }, [router]);
  const handleRate   = useCallback(() => router.push(bookingId ? `/bookings/${bookingId}/rate` : '/bookings'), [router, bookingId]);

  const handleRecenter = useCallback(() => {
    setFollowDriver(true);
    const target = isCareOnly ? caPos : driverPos;
    if (target && mapRef.current) { mapRef.current.panTo(target); mapRef.current.setZoom(16); }
    else if (pickupCoords && mapRef.current) mapRef.current.panTo(pickupCoords);
  }, [driverPos, caPos, pickupCoords, isCareOnly]);

  const handleZoomIn  = useCallback(() => { mapRef.current?.setZoom(Math.min(mapRef.current.getZoom() + 1, 21)); }, []);
  const handleZoomOut = useCallback(() => { mapRef.current?.setZoom(Math.max(mapRef.current.getZoom() - 1, 3));  }, []);

  const handleFullscreen = useCallback(() => {
    const el = mapContainerRef.current || document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  const handleFitAll = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = new window.google.maps.LatLngBounds();
    let pts = 0;
    [pickupCoords, dropoffCoords, driverPos, caPos, jpCoords].forEach(p => { if (p) { bounds.extend(p); pts++; } });
    if (pts > 0) mapRef.current.fitBounds(bounds, { top: 90, bottom: 200, left: 40, right: 40 });
  }, [pickupCoords, dropoffCoords, driverPos, caPos, jpCoords]);

const handleRefresh = useCallback(() => {
    if (activeRideId) { dispatch(fetchRideLive(activeRideId)); dispatch(fetchRideStops({ rideId: activeRideId })); }
    if (bookingId)    dispatch(fetchCareTrackingSnapshot({ bookingId }));
    notify('Refreshing…', 'info', '🔄');
  }, [activeRideId, bookingId, dispatch, notify]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER GUARDS
  // ─────────────────────────────────────────────────────────────────────────
  if (initLoading || !isLoaded) return <InitLoading />;
  if (showCompleted) return <CompletedScreen booking={booking} onBack={handleBack} onRate={handleRate} />;
  if (showCancelled) return <CancelledScreen onBack={handleBack} />;

  const statusCfg = STATUS_CFG[activeStatus] || STATUS_CFG.searching;

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{KEYFRAMES}</style>

      <div ref={mapContainerRef} className="fixed inset-0 overflow-hidden select-none">

        {/* ────────────────── MAP ───────────────────────────────── */}
        <div className="absolute inset-0">
          {isSearching ? (
            <SearchingOverlay bookingCode={booking?.bookingCode} btype={btype} />
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={(isCareOnly ? caPos : driverPos) || pickupCoords || { lat: 16.506, lng: 80.648 }}
              zoom={15}
              options={{
                mapId: MAP_ID,
                disableDefaultUI: true,
                clickableIcons: false,
                gestureHandling: 'greedy',
                mapTypeId: 'roadmap',
              }}
              onLoad={onMapLoad}
              onDragStart={() => setFollowDriver(false)}>

              {/* Overview route — light dotted */}
              {overviewRoute && !isCareOnly && (
                <DirectionsRenderer directions={overviewRoute} options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor:  isPostOtp ? 'rgba(34,197,94,0.22)' : 'rgba(59,130,246,0.18)',
                    strokeWeight: 5, strokeOpacity: 1,
                    icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '14px' }],
                  },
                }} />
              )}

              {/* Active driver route */}
              {driverRoute && !isCareOnly && (
                <DirectionsRenderer directions={driverRoute} options={{
                  suppressMarkers: true,
                  polylineOptions: isPostOtp
                    ? { strokeColor: '#22c55e', strokeWeight: 6, strokeOpacity: 0.92 }
                    : { strokeColor: '#3b82f6', strokeWeight: 5, strokeOpacity: 1 },
                }} />
              )}
            </GoogleMap>
          )}
        </div>

        {/* ────────────────── OFFLINE BANNER ───────────────────── */}
        <AnimatePresence>
          {!connected && !isSearching && (
            <motion.div initial={{ y: -44 }} animate={{ y: 0 }} exit={{ y: -44 }}
              className="absolute top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
              style={{ background: 'rgba(245,158,11,0.95)', color: '#000' }}>
              <WifiOff size={12} /> Reconnecting — tracking may be delayed
            </motion.div>
          )}
        </AnimatePresence>

        {/* ────────────────── TOP BAR ───────────────────────────── */}
        <div className="absolute top-0 left-0 right-0 z-20" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-3.5 py-2.5 border-b"
            style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(18px)', borderColor: 'rgba(255,255,255,0.06)' }}>

            <motion.button whileTap={{ scale: 0.88 }} onClick={handleBack}
              className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center cursor-pointer text-white/60 border"
              style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.10)' }}>
              <ChevronLeft size={18} />
            </motion.button>

            {/* Connection dot */}
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
              background: connected ? '#22c55e' : '#f59e0b',
              boxShadow: connected ? '0 0 6px rgba(34,197,94,0.7)' : '0 0 6px rgba(245,158,11,0.7)',
            }} />

            {/* Status badges */}
            <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0 gap-y-1">
              {!isCareOnly && <StatusBadge status={activeStatus} />}
              {showCa && caStatus && caStatus !== 'not_joined' && <CaBadge status={caStatus} />}
            </div>

            {/* ETA / Distance */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {etaMinutes != null && (
                <div className="flex items-center gap-1">
                  <Clock size={11} className="text-primary" />
                  <span className="text-xs font-black text-primary">{fmtEta(etaMinutes)}</span>
                </div>
              )}
              {distKm != null && (
                <div className="flex items-center gap-1">
                  <Navigation size={10} style={{ color: 'rgba(255,255,255,0.38)' }} />
                  <span className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.45)' }}>{fmtKm(distKm)}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Driver arrived banner */}
          <AnimatePresence>
            {activeStatus === 'driver_arrived' && !isCareOnly && (
              <motion.button initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} onClick={() => setShowOtpModal(true)}
                className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer border-b"
                style={{ background: 'rgba(168,85,247,0.16)', backdropFilter: 'blur(12px)', borderColor: 'rgba(168,85,247,0.28)' }}>
                <div className="flex items-center gap-2">
                  <motion.span animate={{ scale: [1, 1.28, 1] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-lg">📍</motion.span>
                  <span className="text-xs font-bold" style={{ color: '#c084fc' }}>Your driver has arrived — tap to show OTP</span>
                </div>
                <div className="flex items-center gap-1" style={{ color: '#a855f7' }}>
                  <span className="text-[10px] font-bold">Show OTP</span>
                  <ArrowUpRight size={11} />
                </div>
              </motion.button>
            )}
          </AnimatePresence>

          {/* CA at JP banner */}
          <AnimatePresence>
            {isFullCare && ['at_pickup', 'at_join_point', 'AT_JOIN_POINT'].includes(caStatus) && !jpCompleted && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 border-b"
                style={{ background: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)', backdropFilter: 'blur(10px)' }}>
                <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>❤️</motion.span>
                <span className="text-xs font-bold text-warning">Care assistant is waiting at the join point</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CA in ride banner */}
          <AnimatePresence>
            {isFullCare && ['in_ride', 'IN_VEHICLE'].includes(caStatus) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2.5 border-b"
                style={{ background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.25)', backdropFilter: 'blur(10px)' }}>
                <Activity size={12} className="text-success animate-pulse flex-shrink-0" />
                <span className="text-xs font-bold text-success">Care assistant is in the vehicle with you ❤️‍🔥</span>
                {jpCompleted && <span className="ml-auto text-[9px] bg-success/15 text-success border border-success/25 px-1.5 py-0.5 rounded-full font-bold">JP ✓</span>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* In progress banner */}
          <AnimatePresence>
            {activeStatus === 'in_progress' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 px-4 py-2 border-b"
                style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.20)', backdropFilter: 'blur(10px)' }}>
                <Zap size={11} className="text-success flex-shrink-0" />
                <span className="text-[11px] font-bold text-success">
                  {isFullCare && ['in_ride', 'IN_VEHICLE'].includes(caStatus)
                    ? 'En route to hospital — care assistant on board 🎉'
                    : 'Ride in progress — heading to destination'}
                </span>
                {hospitalEta?.etaMinutes && (
                  <span className="ml-auto text-[10px] text-success/70 font-semibold flex-shrink-0">
                    🏥 {fmtEta(hospitalEta.etaMinutes)}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ────────────────── NOTIFICATIONS ────────────────────── */}
        <NotifToast notifs={notifs} />

        {/* ────────────────── MAP LEGEND ────────────────────────── */}
        {isFullCare && !isSearching && <MapLegend show={showLegend} />}

        {/* ────────────────── FABs ──────────────────────────────── */}
        <div className="absolute right-3 z-20 flex flex-col gap-2"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 112px)' }}>
          <FabBtn onClick={handleRecenter} active={followDriver} title={isCareOnly ? 'Center on care assistant' : 'Center on driver'}>
            <LocateFixed size={16} />
          </FabBtn>
          <FabBtn onClick={handleFitAll} title="Fit all markers">
            <Layers size={15} />
          </FabBtn>
          <FabBtn onClick={handleZoomIn} title="Zoom in"><Plus size={17} strokeWidth={2.5} /></FabBtn>
          <FabBtn onClick={handleZoomOut} title="Zoom out"><Minus size={17} strokeWidth={2.5} /></FabBtn>
          <FabBtn onClick={handleFullscreen} active={isFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </FabBtn>
          {isFullCare && (
            <FabBtn onClick={() => setShowLegend(p => !p)} active={showLegend} title="Toggle legend">
              <Eye size={15} />
            </FabBtn>
          )}
          <FabBtn onClick={() => setShowSosModal(true)} danger active={sosActive} title="Emergency SOS">
            {sosActive ? <ShieldAlert size={16} /> : <Shield size={16} />}
          </FabBtn>
          {!connected && (
            <FabBtn onClick={handleRefresh} title="Refresh">
              <RefreshCw size={15} />
            </FabBtn>
          )}
        </div>

        {/* Zoom badge */}
        {mapReady && !isSearching && (
          <div className="absolute z-20" style={{ bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', left: 12 }}>
            <div className="px-2.5 py-1 rounded-xl text-[9.5px] font-bold font-mono"
              style={{ background: 'rgba(0,0,0,0.65)', color: 'rgba(255,255,255,0.38)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}>
              z{mapZoom}
            </div>
          </div>
        )}

        {/* SOS active ribbon */}
        <AnimatePresence>
          {sosActive && !showSosModal && (
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              className="fixed z-40 left-4 right-4 flex items-center gap-3 p-4 rounded-2xl border"
              style={{
                bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
                background: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.55)',
                animation: 'sosRing 1.8s ease-in-out infinite',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 8px 32px rgba(239,68,68,0.40)',
              }}>
              <ShieldAlert size={20} className="text-error flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-black text-error m-0">SOS Alert Active</p>
                <p className="text-[10.5px] text-error/65 m-0">Help is on the way. Stay calm.</p>
              </div>
              <button onClick={() => setSosActive(false)} className="text-error/55 cursor-pointer bg-transparent border-none p-1">
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ────────────────── BOTTOM SHEET ─────────────────────── */}
        <BottomSheet
          open={sheetOpen} onToggle={() => setSheetOpen(p => !p)}
          status={activeStatus} rideCode={rd?.rideCode}
          booking={booking} btype={btype}
          otp={otp} onShowOtp={() => setShowOtpModal(true)}
          driverSnapshot={driverSnapshot} vehicleSnapshot={vehicleSnapshot}
          caSnapshot={caSnapshot} caStatus={caStatus}
          jpCompleted={jpCompleted} jpCoords={jpCoords}
          etaMinutes={etaMinutes} distKm={distKm}
          stops={rideStops} currentStopId={currentStopId}
          hospitalEta={hospitalEta}
          activeTab={activeTab} onTabChange={setActiveTab}
        />

        {/* ────────────────── MODALS ───────────────────────────── */}
        <AnimatePresence>
          {showOtpModal && otp && <OtpModal otp={otp} onClose={() => setShowOtpModal(false)} />}
        </AnimatePresence>

        <AnimatePresence>
          {showSosModal && (
            <SosModal
              bookingId={bookingId} rideId={activeRideId}
              onClose={() => setShowSosModal(false)}
              onTriggered={() => setSosActive(true)}
            />
          )}
        </AnimatePresence>

      </div>
    </>
  );
}