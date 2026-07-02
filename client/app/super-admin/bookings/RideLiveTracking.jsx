'use client';

/**
 * RideLiveTracking.jsx — Likeson.in
 * Admin/Superadmin real-time ride tracking panel.
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  Navigation,
  Clock,
  AlertTriangle,
  Shield,
  Users,
  Route,
  Activity,
  ChevronDown,
  RefreshCw,
  Radio,
  TrendingUp,
  Flag,
  UserCheck,
  History,
  CheckCircle,
  Wifi,
  WifiOff,
  LocateFixed,
  Car,
} from 'lucide-react';

import API from '@/store/api';
import socketService, {
  SOCKET_EVENTS,
} from '@/services/socketService';

// Imports from rideRequestSlice
import {
  fetchRideTracking,
  fetchRideLive,
  socketLocationUpdate,
  socketEtaUpdate,
  socketRideStatusChanged,
  socketCaAtJoinPoint,
  socketCaJoinedRide,
  socketJpWaypointCompleted,
  socketOtpResult,
  socketRideAssigned,
  selectCurrentRide,
  selectTrackingData,
  selectSocketLive,
  selectRideLoading,
  wireRideSocketEvents,
} from '@/store/slices/rideRequestSlice';

// Imports from operationsSlice (where stops, participants, and SOS actually live)
import {
  fetchBookingAssignmentHistory,
  selectBookingAssignmentHistory,
  fetchRideStops,
  fetchRideParticipants,
  fetchBookingSosEvents,
  selectRideStops,
  selectRideParticipants,
  selectBookingSosEvents,
} from '@/store/slices/operationsSlice';

import { useGoogleMaps } from '@/hooks/useGoogleMaps';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DRIVER_MARKER_COLOR = '#2563eb';

const STATUS_LABELS = {
  requested:       'Requested',
  searching:       'Searching Driver',
  driver_assigned: 'Driver Assigned',
  driver_accepted: 'Driver Accepted',
  driver_en_route: 'En Route',
  driver_arrived:  'Driver Arrived',
  otp_verified:    'OTP Verified',
  in_progress:     'In Progress',
  at_stop:         'At Stop',
  completed:       'Completed',
  cancelled:       'Cancelled',
};

const STATUS_COLORS = {
  requested:       'badge-info',
  searching:       'badge-warning',
  driver_assigned: 'badge-primary',
  driver_accepted: 'badge-primary',
  driver_en_route: 'badge-secondary',
  driver_arrived:  'badge-accent',
  otp_verified:    'badge-success',
  in_progress:     'badge-success',
  at_stop:         'badge-warning',
  completed:       'badge-success',
  cancelled:       'badge-error',
};

const STOP_TYPE_LABELS = {
  PATIENT_PICKUP:     'Patient Pickup',
  CARE_ASSISTANT_JOIN:'CA Join Point',
  HOSPITAL:           'Hospital',
  PHARMACY:           'Pharmacy',
  LAB:                'Lab',
  BLOOD_BANK:         'Blood Bank',
  CUSTOM:             'Custom Stop',
};

const STOP_STATUS_COLORS = {
  PENDING:   'badge-warning',
  ARRIVED:   'badge-info',
  COMPLETED: 'badge-success',
  SKIPPED:   'badge-secondary',
  MISSED:    'badge-error',
};

const STOP_STATUS_PIN_COLOR = {
  PENDING:   '#f59e0b',
  ARRIVED:   '#2563eb',
  COMPLETED: '#16a34a',
  SKIPPED:   '#64748b',
  MISSED:    '#dc2626',
};

const PARTICIPANT_ROLE_LABELS = {
  CARE_ASSISTANT:   'Care Assistant',
  NURSE:            'Nurse',
  TECHNICIAN:       'Technician',
  ESCORT:           'Escort',
  FAMILY:           'Family Member',
  EQUIPMENT_HANDLER:'Equipment Handler',
  DOCTOR:           'Doctor',
};

const ASSIGNMENT_ACTION_COLORS = {
  ASSIGNED: 'badge-success',
  ACCEPTED: 'badge-primary',
  REPLACED: 'badge-warning',
  REMOVED:  'badge-error',
};

const SOS_TYPE_COLORS = {
  MEDICAL:           'badge-error',
  SAFETY:            'badge-error',
  VEHICLE_BREAKDOWN: 'badge-warning',
  ACCIDENT:          'badge-error',
  PATIENT_CONDITION: 'badge-error',
  OTHER:             'badge-warning',
};

const PANEL_TABS = [
  { id: 'overview',    label: 'Overview',    icon: Activity },
  { id: 'stops',       label: 'Stops',       icon: MapPin },
  { id: 'participants',label: 'Participants', icon: Users },
  { id: 'sos',         label: 'SOS',         icon: AlertTriangle },
  { id: 'history',     label: 'History',     icon: History },
  { id: 'route',       label: 'Route',       icon: Route },
];

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.06 } },
};

const pulse = {
  animate: {
    scale: [1, 1.15, 1],
    opacity: [1, 0.7, 1],
    transition: { duration: 1.8, repeat: Infinity },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmtTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
};

const fmtCoords = (coords) => {
  if (!coords || coords.length < 2) return '—';
  return `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ConnectionBadge({ connected }) {
  return (
    <motion.div
      className={`flex items-center gap-1.5 badge badge-sm ${connected ? 'badge-success' : 'badge-error'}`}
      animate={{ opacity: connected ? 1 : [1, 0.5, 1] }}
      transition={connected ? {} : { duration: 1.5, repeat: Infinity }}
    >
      {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
      {connected ? 'Live' : 'Offline'}
    </motion.div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`badge badge-sm ${STATUS_COLORS[status] ?? 'badge-secondary'}`}>
      {STATUS_LABELS[status] ?? status ?? '—'}
    </span>
  );
}

function InfoRow({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-base-300 last:border-0">
      <span className="text-base-content/50 text-xs uppercase tracking-wider font-semibold shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, accent = false, collapsible = false }) {
  const [open, setOpen] = useState(true);
  return (
    <motion.div variants={fadeInUp} className="card p-4">
      <button
        onClick={() => collapsible && setOpen(v => !v)}
        className={`flex items-center justify-between w-full mb-3 ${collapsible ? 'cursor-pointer' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2">
          {Icon && (
            <span className={`p-1.5 rounded-lg ${accent ? 'bg-error/10' : 'bg-primary/10'}`}>
              <Icon className={`w-4 h-4 ${accent ? 'text-error' : 'text-primary'}`} />
            </span>
          )}
          <span className="font-montserrat font-bold text-sm">{title}</span>
        </div>
        {collapsible && (
          <ChevronDown className={`w-4 h-4 text-base-content/40 transition-transform ${open ? '' : '-rotate-90'}`} />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EtaChip({ etaMinutes, label = 'ETA' }) {
  if (!etaMinutes) return null;
  return (
    <div className="flex items-center gap-1.5 badge badge-primary badge-sm">
      <Clock className="w-3 h-3" />
      {label}: {etaMinutes}m
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP PANEL (Google Maps)
// ─────────────────────────────────────────────────────────────────────────────

function MapPanel({ liveLocation, stops, caLocation, ride }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const { isLoaded, loadError } = useGoogleMaps();

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;
    const center = liveLocation
      ? { lat: liveLocation.lat, lng: liveLocation.lng }
      : ride?.pickup?.coordinates
      ? { lat: ride.pickup.coordinates[1], lng: ride.pickup.coordinates[0] }
      : { lat: 16.506, lng: 80.648 };

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      zoom: 14,
      center,
      mapTypeId: 'roadmap',
      disableDefaultUI: false,
      zoomControl: true,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });
  }, [liveLocation, ride]);

  useEffect(() => {
    if (isLoaded && !mapInstanceRef.current) {
      initMap();
    }
  }, [isLoaded, initMap]);

  // Update driver marker
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !liveLocation) return;
    const pos = { lat: liveLocation.lat, lng: liveLocation.lng };
    if (markersRef.current.driver) {
      markersRef.current.driver.setPosition(pos);
      const icon = markersRef.current.driver.getIcon();
      markersRef.current.driver.setIcon({ ...icon, rotation: liveLocation.heading ?? 0 });
    } else {
      markersRef.current.driver = new window.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: 'Driver',
        icon: {
          path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: DRIVER_MARKER_COLOR,
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          rotation: liveLocation.heading ?? 0,
        },
        zIndex: 10,
      });
    }
  }, [liveLocation]);

  // CA marker
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !caLocation) return;
    const pos = { lat: caLocation.lat, lng: caLocation.lng };
    if (markersRef.current.ca) {
      markersRef.current.ca.setPosition(pos);
    } else {
      markersRef.current.ca = new window.google.maps.Marker({
        position: pos,
        map: mapInstanceRef.current,
        title: 'Care Assistant',
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#e11d48',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
        zIndex: 9,
      });
    }
  }, [caLocation]);

  // Stop markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google || !stops?.length) return;
    stops.forEach((stop, i) => {
      const coords = stop.location?.coordinates;
      if (!coords || coords.length < 2) return;
      const pos = { lat: coords[1], lng: coords[0] };
      const key = `stop_${i}`;
      const fillColor = STOP_STATUS_PIN_COLOR[stop.status] ?? '#f59e0b';
      const labelText = String(stop.sequence ?? i + 1);

      if (!markersRef.current[key]) {
        markersRef.current[key] = new window.google.maps.Marker({
          position: pos,
          map: mapInstanceRef.current,
          title: STOP_TYPE_LABELS[stop.stopType] ?? stop.stopType,
          label: {
            text: labelText,
            color: '#fff',
            fontSize: '11px',
            fontWeight: 'bold',
          },
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
          zIndex: 8,
        });
      } else {
        markersRef.current[key].setPosition(pos);
        markersRef.current[key].setLabel({
          text: labelText,
          color: '#fff',
          fontSize: '11px',
          fontWeight: 'bold',
        });
        const icon = markersRef.current[key].getIcon();
        markersRef.current[key].setIcon({ ...icon, fillColor });
      }
    });
  }, [stops]);

  if (loadError) {
    return (
      <div className="card p-6 flex items-center justify-center gap-2 text-error">
        <AlertTriangle className="w-5 h-5" />
        <span className="text-sm">Map failed to load</span>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="card flex items-center justify-center" style={{ height: 380 }}>
        <div className="loading loading-lg" />
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="card overflow-hidden"
      style={{ height: 380, borderRadius: 'var(--r-box)' }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

function TabOverview({ ride, tracking, socketLive, liveLocation }) {
  const status = socketLive?.status ?? ride?.status;
  const eta = socketLive?.etaMinutes ?? tracking?.currentEtaMinutes;

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-4">

      <motion.div variants={fadeInUp} className="card p-4 flex max-h-[300px] overflow-y-auto flex-wrap items-center gap-3">
        <StatusBadge status={status} />
        <EtaChip etaMinutes={eta} />
        {tracking?.hasActiveSos && (
          <motion.span {...pulse} className="badge badge-sm badge-error">
            🆘 Active SOS
          </motion.span>
        )}
        {tracking?.hasUnacknowledgedDeviation && (
          <span className="badge badge-sm badge-warning">⚠ Route Deviation</span>
        )}
        {liveLocation && (
          <span className="badge badge-sm badge-secondary ml-auto">
            <LocateFixed className="w-3 h-3 mr-1" />
            {liveLocation.lat?.toFixed(4)}, {liveLocation.lng?.toFixed(4)}
          </span>
        )}
      </motion.div>

      <SectionCard title="Ride Details" icon={Car}>
        <InfoRow label="Ride Code" value={ride?.rideCode} mono />
        <InfoRow label="Type" value={ride?.rideType} />
        <InfoRow label="Vehicle Class" value={ride?.vehicleClass} />
        <InfoRow label="Est. Distance" value={ride?.estimatedDistanceKm ? `${ride.estimatedDistanceKm} km` : null} />
        <InfoRow label="Est. Duration" value={ride?.estimatedDurationMin ? `${ride.estimatedDurationMin} min` : null} />
        <InfoRow label="Actual Distance" value={ride?.actualDistanceKm ? `${ride.actualDistanceKm} km` : null} />
        <InfoRow label="Pickup" value={ride?.pickup?.address ?? fmtCoords(ride?.pickup?.coordinates)} />
        <InfoRow label="Dropoff" value={ride?.dropoff?.address ?? fmtCoords(ride?.dropoff?.coordinates)} />
      </SectionCard>

      <SectionCard title="Timing" icon={Clock} collapsible>
        <InfoRow label="Scheduled" value={fmtDateTime(ride?.scheduledPickupAt)} />
        <InfoRow label="Driver Assigned" value={fmtDateTime(ride?.driverAssignedAt)} />
        <InfoRow label="Driver Accepted" value={fmtDateTime(ride?.driverAcceptedAt)} />
        <InfoRow label="Driver Arrived" value={fmtDateTime(ride?.driverArrivedAt)} />
        <InfoRow label="Ride Started" value={fmtDateTime(ride?.rideStartedAt)} />
        <InfoRow label="Completed" value={fmtDateTime(ride?.rideCompletedAt)} />
      </SectionCard>

      {ride?.driverSnapshot && (
        <SectionCard title="Driver" icon={UserCheck} collapsible>
          <InfoRow label="Name" value={ride.driverSnapshot.legalName} />
          <InfoRow label="Phone" value={ride.driverSnapshot.phone} />
          <InfoRow label="Rating" value={ride.driverSnapshot.rating ? `${ride.driverSnapshot.rating} ★` : null} />
          <InfoRow label="Vehicle" value={ride.vehicleSnapshot?.registrationNumber} />
          <InfoRow label="Make/Model" value={[ride.vehicleSnapshot?.make, ride.vehicleSnapshot?.model].filter(Boolean).join(' ')} />
          <InfoRow label="Type" value={ride.vehicleSnapshot?.vehicleType} />
        </SectionCard>
      )}

      {liveLocation && (
        <SectionCard title="Live Position" icon={Navigation}>
          <InfoRow label="Lat, Lng" value={`${liveLocation.lat?.toFixed(6)}, ${liveLocation.lng?.toFixed(6)}`} mono />
          <InfoRow label="Heading" value={liveLocation.heading != null ? `${liveLocation.heading}°` : null} />
          <InfoRow label="Speed" value={liveLocation.speedKmh != null ? `${liveLocation.speedKmh} km/h` : null} />
          <InfoRow label="Updated" value={fmtTime(liveLocation.updatedAt)} />
        </SectionCard>
      )}

      {tracking?.summary?.isCompleted && (
        <SectionCard title="Summary" icon={TrendingUp}>
          <InfoRow label="Total Distance" value={`${tracking.summary.totalDistanceKm ?? '—'} km`} />
          <InfoRow label="Total Duration" value={`${tracking.summary.totalDurationMin ?? '—'} min`} />
          <InfoRow label="Avg Speed" value={`${tracking.summary.avgSpeedKmh ?? '—'} km/h`} />
          <InfoRow label="Max Speed" value={`${tracking.summary.maxSpeedKmh ?? '—'} km/h`} />
          <InfoRow label="Pickup Wait" value={`${tracking.summary.pickupWaitMin ?? '—'} min`} />
          <InfoRow label="Pings Received" value={tracking.summary.totalPingsReceived} />
        </SectionCard>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: STOPS
// ─────────────────────────────────────────────────────────────────────────────

function TabStops({ stops }) {
  if (!stops?.length) {
    return (
      <div className="card p-8 flex flex-col items-center gap-2 text-base-content/40">
        <MapPin className="w-8 h-8" />
        <p className="text-sm">No stops loaded</p>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-3">
      {stops.map((stop, i) => (
        <motion.div key={stop._id ?? i} variants={fadeInUp} className="card p-4">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-0.5">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${stop.status === 'COMPLETED' ? 'bg-success text-success-content'
                  : stop.status === 'ARRIVED'  ? 'bg-primary text-primary-content'
                  : stop.status === 'MISSED'   ? 'bg-error text-error-content'
                  : 'bg-base-300 text-base-content'}`}>
                {stop.sequence ?? i + 1}
              </div>
              {i < stops.length - 1 && (
                <div className="w-px flex-1 min-h-4 bg-base-300" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold text-sm">
                  {STOP_TYPE_LABELS[stop.stopType] ?? stop.stopType}
                </span>
                <span className={`badge badge-xs ${STOP_STATUS_COLORS[stop.status] ?? 'badge-secondary'}`}>
                  {stop.status}
                </span>
              </div>
              {stop.location?.address && (
                <p className="text-xs text-base-content/60 mb-2">{stop.location.address}</p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {stop.arrival?.actualAt && (
                  <span className="text-base-content/50">Arrived: <strong>{fmtTime(stop.arrival.actualAt)}</strong></span>
                )}
                {stop.departure?.actualAt && (
                  <span className="text-base-content/50">Departed: <strong>{fmtTime(stop.departure.actualAt)}</strong></span>
                )}
                {stop.otp?.verifiedAt && (
                  <span className="text-success text-xs flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> OTP verified
                  </span>
                )}
              </div>
              {stop.meta && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {stop.meta.zone && (
                    <span className="badge badge-xs badge-accent">Zone: {stop.meta.zone.replace(/_/g, ' ')}</span>
                  )}
                  {stop.meta.distCaToJoinKm && (
                    <span className="badge badge-xs badge-secondary">CA dist: {stop.meta.distCaToJoinKm} km</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: PARTICIPANTS
// ─────────────────────────────────────────────────────────────────────────────

function TabParticipants({ participants }) {
  if (!participants?.length) {
    return (
      <div className="card p-8 flex flex-col items-center gap-2 text-base-content/40">
        <Users className="w-8 h-8" />
        <p className="text-sm">No participants assigned</p>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-3">
      {participants.map((p, i) => (
        <motion.div key={p._id ?? i} variants={fadeInUp} className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="avatar placeholder">
              <div className="w-9">
                <span>{(p.snapshot?.name ?? p.role)?.[0]?.toUpperCase() ?? '?'}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">{p.snapshot?.name ?? '—'}</span>
                <span className="badge badge-xs badge-primary">
                  {PARTICIPANT_ROLE_LABELS[p.role] ?? p.role}
                </span>
                {!p.isActive && <span className="badge badge-xs badge-error">Inactive</span>}
                {p.isReplacement && <span className="badge badge-xs badge-warning">Replacement</span>}
              </div>
              {p.snapshot?.phone && (
                <p className="text-xs text-base-content/50 mt-0.5">{p.snapshot.phone}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <InfoRow label="Status" value={p.status} />
            <InfoRow label="Join Mode" value={p.joinMode?.replace(/_/g, ' ')} />
            {p.joinedAt && <InfoRow label="Joined" value={fmtDateTime(p.joinedAt)} />}
            {p.departedAt && <InfoRow label="Departed" value={fmtDateTime(p.departedAt)} />}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: SOS
// ─────────────────────────────────────────────────────────────────────────────

function TabSos({ sosEvents }) {
  if (!sosEvents?.length) {
    return (
      <div className="card p-8 flex flex-col items-center gap-2 text-base-content/40">
        <Shield className="w-8 h-8" />
        <p className="text-sm">No SOS events</p>
      </div>
    );
  }

  const active = sosEvents.filter(e => !e.isResolved);
  const resolved = sosEvents.filter(e => e.isResolved);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-3">
      {active.length > 0 && (
        <motion.div variants={fadeInUp} className="alert alert-error">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">{active.length} active SOS event{active.length > 1 ? 's' : ''}</span>
        </motion.div>
      )}
      {sosEvents.map((ev, i) => (
        <motion.div key={ev._id ?? i} variants={fadeInUp}
          className={`card p-4 border ${ev.isResolved ? 'border-base-300' : 'border-error/40'}`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${ev.isResolved ? 'bg-success/10' : 'bg-error/10'}`}>
              {ev.isResolved
                ? <CheckCircle className="w-4 h-4 text-success" />
                : <AlertTriangle className="w-4 h-4 text-error" />}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`badge badge-sm ${SOS_TYPE_COLORS[ev.sosType] ?? 'badge-warning'}`}>
                  {ev.sosType}
                </span>
                <span className="badge badge-xs badge-secondary">{ev.triggeredByRole}</span>
                {ev.isResolved && <span className="badge badge-xs badge-success">Resolved</span>}
              </div>
              {ev.description && (
                <p className="text-xs text-base-content/70 mb-2">{ev.description}</p>
              )}
              <div className="text-xs text-base-content/50 flex flex-wrap gap-x-4 gap-y-1">
                <span>Triggered: {fmtDateTime(ev.createdAt)}</span>
                {ev.resolvedAt && <span>Resolved: {fmtDateTime(ev.resolvedAt)}</span>}
              </div>
              {ev.resolutionNotes && (
                <p className="text-xs text-base-content/60 mt-1 italic">"{ev.resolutionNotes}"</p>
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: HISTORY (Assignment History)
// ─────────────────────────────────────────────────────────────────────────────

function TabHistory({ assignmentHistory }) {
  if (!assignmentHistory?.length) {
    return (
      <div className="card p-8 flex flex-col items-center gap-2 text-base-content/40">
        <History className="w-8 h-8" />
        <p className="text-sm">No assignment history</p>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-2">
      {[...assignmentHistory].reverse().map((h, i) => (
        <motion.div key={h._id ?? i} variants={fadeInUp} className="card p-3">
          <div className="flex items-start gap-3">
            <div className="w-px self-stretch bg-base-300 ml-2 relative">
              <div className="w-2 h-2 rounded-full bg-primary absolute -left-[3px] top-1" />
            </div>
            <div className="flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`badge badge-xs ${ASSIGNMENT_ACTION_COLORS[h.action] ?? 'badge-secondary'}`}>
                  {h.action}
                </span>
                <span className="badge badge-xs badge-primary">{h.assignmentType}</span>
                <span className="text-xs font-mono text-base-content/50">{h.entityRefModel}</span>
              </div>
              {h.reason && (
                <p className="text-xs text-base-content/60">{h.reason}</p>
              )}
              <div className="text-xs text-base-content/40 mt-1 flex gap-3">
                <span>{fmtDateTime(h.effectiveAt)}</span>
                {h.performedBy?.name && <span>by {h.performedBy.name}</span>}
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: ROUTE
// ─────────────────────────────────────────────────────────────────────────────

function TabRoute({ tracking, activeRouteVersion, milestones }) {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible" className="flex flex-col gap-4">

      {activeRouteVersion && (
        <SectionCard title="Active Route Version" icon={Route}>
          <InfoRow label="Version #" value={activeRouteVersion.versionNumber} />
          <InfoRow label="Distance" value={activeRouteVersion.totalDistanceKm ? `${activeRouteVersion.totalDistanceKm} km` : null} />
          <InfoRow label="Duration" value={activeRouteVersion.totalDurationMin ? `${activeRouteVersion.totalDurationMin} min` : null} />
          <InfoRow label="Reason" value={activeRouteVersion.generatedReason?.replace(/_/g, ' ')} />
        </SectionCard>
      )}

      {milestones?.length > 0 && (
        <SectionCard title={`Milestones (${milestones.length})`} icon={Flag} collapsible>
          <div className="flex flex-col gap-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
            {[...milestones].reverse().map((m, i) => (
              <div key={i} className="flex items-start gap-3 py-1.5 border-b border-base-300 last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary">
                      {m.name?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-base-content/40 shrink-0">{fmtTime(m.occurredAt)}</span>
                  </div>
                  {m.recordedBy && (
                    <span className="text-xs text-base-content/40">via {m.recordedBy}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {tracking?.routeDeviations?.length > 0 && (
        <SectionCard title={`Deviations (${tracking.routeDeviations.length})`} icon={AlertTriangle} accent>
          {tracking.routeDeviations.map((d, i) => (
            <div key={i} className="py-2 border-b border-base-300 last:border-0">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-warning font-semibold">{d.deviationKm ? `${d.deviationKm} km off` : 'Deviation'}</span>
                {d.wasAcknowledged && <span className="badge badge-xs badge-success">Acknowledged</span>}
              </div>
              {d.driverReason && <p className="text-xs text-base-content/60 mt-0.5">{d.driverReason}</p>}
              <p className="text-xs text-base-content/40 mt-0.5">{fmtDateTime(d.detectedAt)}</p>
            </div>
          ))}
        </SectionCard>
      )}

      <SectionCard title="Breadcrumbs" icon={Activity} collapsible>
        <InfoRow label="Total Pings" value={tracking?.breadcrumbCount ?? '—'} />
        <InfoRow label="In Window" value={tracking?.breadcrumbs?.length ?? '—'} />
        <InfoRow label="Current ETA" value={tracking?.currentEtaMinutes ? `${tracking.currentEtaMinutes} min` : null} />
        <InfoRow label="Current Target" value={tracking?.currentEtaTarget} />
      </SectionCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET EVENTS PANEL (live feed)
// ─────────────────────────────────────────────────────────────────────────────

function LiveEventFeed({ events }) {
  if (!events?.length) return null;
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-2">
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}>
          <Radio className="w-3.5 h-3.5 text-success" />
        </motion.div>
        <span className="text-xs font-semibold uppercase tracking-wider text-base-content/50">Live Events</span>
      </div>
      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto scrollbar-thin">
        {events.slice(-10).reverse().map((ev, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-0.5 border-b border-base-300 last:border-0">
            <span className="text-base-content/40 font-mono shrink-0">{fmtTime(ev.ts)}</span>
            <span className="badge badge-xs badge-primary">{ev.event}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function RideLiveTracking({ bookingId, rideId }) {
  const dispatch = useDispatch();

  // Redux state
  const ride         = useSelector(selectCurrentRide);
  const tracking     = useSelector(selectTrackingData);
  const stops        = useSelector(selectRideStops);
  const participants = useSelector(selectRideParticipants);
  const sosEvents    = useSelector(selectBookingSosEvents);
  const socketLive   = useSelector(selectSocketLive);
  const loading      = useSelector(selectRideLoading);
  const assignmentHistory = useSelector(selectBookingAssignmentHistory);

  // Local state
  const [activeTab,          setActiveTab]          = useState('overview');
  const [socketConnected,    setSocketConnected]     = useState(false);
  const [liveEvents,         setLiveEvents]          = useState([]);
  const [activeRouteVersion, setActiveRouteVersion]  = useState(null);
  const [lastRefreshed,      setLastRefreshed]        = useState(null);
  const [caLocation,         setCaLocation]          = useState(null);
  const unsubsRef = useRef([]);
  const pollRef   = useRef(null);

  // Push live event to feed
  const pushEvent = useCallback((event) => {
    setLiveEvents(prev => [...prev.slice(-49), { event, ts: new Date() }]);
  }, []);

  // Initial data load
  const loadAll = useCallback(async () => {
    if (!rideId) return;
    await Promise.all([
      dispatch(fetchRideTracking({ rideId, breadcrumbs: 100 })),
      dispatch(fetchRideStops({ rideId })),
      dispatch(fetchRideParticipants({ rideId })),
      dispatch(fetchBookingSosEvents({ bookingId })),
      dispatch(fetchBookingAssignmentHistory({ bookingId })),
    ]);
    // Fetch active route version separately
    try {
      const { data } = await API.get(`/ride-ops/rides/${rideId}/route-versions/active`);
      if (data?.data?.version) setActiveRouteVersion(data.data.version);
    } catch {}
    setLastRefreshed(new Date());
  }, [rideId, bookingId, dispatch]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Socket setup
  useEffect(() => {
    if (!bookingId) return;
    socketService.joinBookingRoom(bookingId);

    const on = (event, handler) => {
      const unsub = socketService.on(event, handler);
      unsubsRef.current.push(unsub);
      return unsub;
    };

    on('connect',    () => setSocketConnected(true));
    on('disconnect', () => setSocketConnected(false));
    if (socketService.connected) setSocketConnected(true);

    // Wire standard ride events to Redux
    const cleanup = wireRideSocketEvents(
      (event, handler) => socketService.on(event, handler),
      SOCKET_EVENTS,
      dispatch
    );

    // Track events in local feed + refresh data as needed
    on(SOCKET_EVENTS.LOCATION_UPDATE, (d) => {
      dispatch(socketLocationUpdate(d));
      pushEvent('location_update');
    });

    on(SOCKET_EVENTS.ETA_UPDATE, (d) => {
      dispatch(socketEtaUpdate(d));
      pushEvent('eta_update');
    });

    on(SOCKET_EVENTS.RIDE_STATUS_CHANGED, (d) => {
      dispatch(socketRideStatusChanged(d));
      pushEvent(`status→${d?.status}`);
    });

    on(SOCKET_EVENTS.STOP_ARRIVED, () => {
      dispatch(fetchRideStops({ rideId }));
      pushEvent('stop_arrived');
    });

    on(SOCKET_EVENTS.STOP_DEPARTED, () => {
      dispatch(fetchRideStops({ rideId }));
      pushEvent('stop_departed');
    });

    on(SOCKET_EVENTS.CARE_ASSISTANT_LOCATION_UPDATE, (d) => {
      if (d?.lat && d?.lng) setCaLocation({ lat: d.lat, lng: d.lng });
      pushEvent('ca_location');
    });

    on(SOCKET_EVENTS.CARE_ASSISTANT_JOINED_RIDE, (d) => {
      dispatch(socketCaJoinedRide(d));
      dispatch(fetchRideParticipants({ rideId }));
      pushEvent('ca_joined_ride');
    });

    on(SOCKET_EVENTS.CA_JOIN_WAYPOINT_COMPLETED, (d) => {
      dispatch(socketJpWaypointCompleted(d));
      dispatch(fetchRideStops({ rideId }));
      pushEvent('jp_completed');
    });

    on(SOCKET_EVENTS.SOS_TRIGGERED, () => {
      dispatch(fetchBookingSosEvents({ bookingId }));
      pushEvent('sos_triggered');
    });

    on(SOCKET_EVENTS.SOS_RESOLVED, () => {
      dispatch(fetchBookingSosEvents({ bookingId }));
      pushEvent('sos_resolved');
    });

    on(SOCKET_EVENTS.PARTICIPANT_ASSIGNED, () => {
      dispatch(fetchRideParticipants({ rideId }));
      dispatch(fetchBookingAssignmentHistory({ bookingId }));
      pushEvent('participant_assigned');
    });

    on(SOCKET_EVENTS.DESTINATION_CHANGED, () => {
      dispatch(fetchRideTracking({ rideId, breadcrumbs: 100 }));
      API.get(`/ride-ops/rides/${rideId}/route-versions/active`)
        .then(({ data }) => { if (data?.data?.version) setActiveRouteVersion(data.data.version); })
        .catch(() => {});
      pushEvent('destination_changed');
    });

    on(SOCKET_EVENTS.JOIN_POINT_RECALCULATED, () => {
      dispatch(fetchRideStops({ rideId }));
      pushEvent('jp_recalculated');
    });

    on(SOCKET_EVENTS.OTP_RESULT, (d) => {
      dispatch(socketOtpResult(d));
      pushEvent('otp_result');
    });

    // Polling fallback for live location when socket offline
    pollRef.current = setInterval(() => {
      if (!socketService.connected) {
        dispatch(fetchRideLive(rideId)).catch(() => {});
      }
    }, 6000);

    return () => {
      socketService.leaveBookingRoom(bookingId);
      for (const fn of unsubsRef.current) fn?.();
      unsubsRef.current = [];
      cleanup?.();
      clearInterval(pollRef.current);
    };
  }, [bookingId, rideId, dispatch, pushEvent]);

  // Derived
  const liveLocation = socketLive?.liveLocation;
  const activeSosCount = (sosEvents || []).filter(e => !e.isResolved).length;
  const milestones = tracking?.tracking?.milestones ?? tracking?.milestones ?? [];
  const resolvedRide = tracking?.ride ?? ride;

  const isLoading = loading?.tracking || loading?.fetchRide;

  if (isLoading && !ride) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="flex flex-col items-center gap-3">
          <div className="loading loading-lg" />
          <p className="text-sm text-base-content/50">Loading ride data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-h-[85vh] overflow-y-auto overflow-x-hidden scrollbar-thin pr-2 pb-2">

      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <LocateFixed className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-montserrat font-black text-lg">Live Ride Tracking</h2>
            {ride?.rideCode && (
              <p className="text-xs text-base-content/50 font-mono">{ride.rideCode}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectionBadge connected={socketConnected} />
          {activeSosCount > 0 && (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="badge badge-sm badge-error"
            >
              🆘 {activeSosCount} SOS
            </motion.div>
          )}
          <button
            onClick={loadAll}
            className="btn btn-ghost btn-sm"
            title="Refresh all data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {lastRefreshed && (
        <p className="text-xs text-base-content/40">
          Last refreshed: {fmtTime(lastRefreshed)}
        </p>
      )}

      {/* ── Map ── */}
      <MapPanel
        liveLocation={liveLocation}
        stops={stops || []}
        caLocation={caLocation}
        ride={resolvedRide}
      />

      {/* ── Live events feed ── */}
      <LiveEventFeed events={liveEvents} />

      {/* ── Tab nav ── */}
      <div className="flex gap-2 overflow-x-auto overflow-y-hidden pb-10 scrollbar-thin py-2 px-1">
        {PANEL_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const hasBadge = (tab.id === 'sos' && activeSosCount > 0);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 h-8 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0
                ${isActive
                  ? 'bg-primary text-primary-content shadow-primary'
                  : 'bg-base-200 text-base-content/60 hover:text-primary hover:bg-primary/10'}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {hasBadge && (
                <span className="ml-1 w-4 h-4 rounded-full bg-error text-error-content text-xs flex items-center justify-center font-bold">
                  {activeSosCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && (
            <TabOverview
              ride={resolvedRide}
              tracking={tracking?.tracking ?? tracking}
              socketLive={socketLive}
              liveLocation={liveLocation}
            />
          )}
          {activeTab === 'stops' && <TabStops stops={stops || []} />}
          {activeTab === 'participants' && <TabParticipants participants={participants || []} />}
          {activeTab === 'sos' && <TabSos sosEvents={sosEvents || []} />}
          {activeTab === 'history' && <TabHistory assignmentHistory={assignmentHistory || []} />}
          {activeTab === 'route' && (
            <TabRoute
              tracking={tracking?.tracking ?? tracking}
              activeRouteVersion={activeRouteVersion}
              milestones={milestones}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}