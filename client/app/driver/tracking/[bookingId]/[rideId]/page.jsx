'use client';

 

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSocket } from '@/context/SocketProvider';
import { useRideTracking } from '@/hooks/useRideTracking';
import { useRideLiveMap } from '@/hooks/useRideLiveMap';
import { useRouteRenderer } from '@/hooks/useRouteRenderer';
import { useDriverMarker, createStaticMarker } from '@/hooks/useDriverMarker';
import { useMapCamera } from '@/hooks/useMapCamera';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import {
  formatEta,
  formatDistance,
  formatSpeed,
  getManeuverIcon,
} from '@/utils/navigationUtils';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ETA_TICK_MS = 1000;

const BOOKING_TYPE_LABELS = {
  INSTANT:          'Ride',
  SCHEDULED:        'Scheduled Ride',
  CARE_ASSISTANT:   'Care Assistant Ride',
  OUTSTATION:       'Outstation Trip',
  RETURN_TRIP:      'Return Trip',
};

// Statuses that mean "vehicle is stationary at a stop, not driving"
const AT_STOP_STATUSES = new Set(['at_stop', 'arrived', 'otp_verified']);

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// StopWaitTimer / EtaTimer — small presentational sub-pieces
// ─────────────────────────────────────────────────────────────────────────────

function StopWaitTimer({ label, startedAt }) {
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsedSec((Date.now() - startedAt) / 1000);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <div className="lrt-timer lrt-timer--wait" role="status">
      <span className="lrt-timer__dot" />
      <div className="lrt-timer__text">
        <div className="lrt-timer__label">{label}</div>
        <div className="lrt-timer__value">{formatHMS(elapsedSec)}</div>
      </div>
    </div>
  );
}

function EtaTimer({ etaMinutes, distanceKm, lastEtaUpdatedAt }) {
  const [displayMin, setDisplayMin] = useState(etaMinutes);

  // Tick the displayed ETA down locally between real backend/hook pushes so
  // the number doesn't sit frozen for up to ETA_UPDATE_INTERVAL_MS (8s).
  useEffect(() => {
    setDisplayMin(etaMinutes);
  }, [etaMinutes, lastEtaUpdatedAt]);

  useEffect(() => {
    if (displayMin == null) return;
    const id = setInterval(() => {
      setDisplayMin((prev) => (prev == null ? prev : Math.max(0, prev - ETA_TICK_MS / 60000)));
    }, ETA_TICK_MS);
    return () => clearInterval(id);
  }, [lastEtaUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="lrt-timer lrt-timer--eta" role="status">
      <span className="lrt-timer__dot lrt-timer__dot--driving" />
      <div className="lrt-timer__text">
        <div className="lrt-timer__label">Arriving in</div>
        <div className="lrt-timer__value">{formatEta(displayMin)}</div>
      </div>
      {distanceKm != null && (
        <div className="lrt-timer__distance">{formatDistance(distanceKm)}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function RideLiveTracking({ rideId, bookingId, tpId, role }) {
  const mapDivRef    = useRef(null);
  const mapRef       = useRef(null);
  const mapLoadedRef = useRef(false);
  const pickupMarkerRef  = useRef(null);
  const dropoffMarkerRef = useRef(null);

  // Tracks when the vehicle entered its current "at stop" state, so the
  // wait timer can count up from a stable anchor rather than from render time.
  const stopEnteredAtRef = useRef(null);
  const [stopEnteredAt, setStopEnteredAt] = useState(null);
  const [lastEtaUpdatedAt, setLastEtaUpdatedAt] = useState(null);

  const { participants } = useSocket();

  // ── Core tracking state ─────────────────────────────────────────────────
  const {
    ride,
    tracking,
    rideStatus,
    rideStage,
    activeNavigationTarget,
    currentPosition,
    isLoadingRide,
    gpsError,
    isOffline,
    connected,
    bookingType,
    caLiveLocation,
    caStatus,
    caJoinPoint,
    caName,
    sendStatusUpdate,
    verifyOtp,
    triggerSosAlert,
  } = useRideTracking({ rideId, bookingId });

  // ── Stops (used for both routing target + "which stop are we waiting at") ─
  const stops = tracking?.rideStops || tracking?.stops || [];
  const currentStop = useMemo(
    () => stops.find((s) => s.status === 'ARRIVED') ||
          stops.find((s) => s.status === 'PENDING' && s.isActive !== false) ||
          null,
    [stops]
  );

  // ── Camera / marker / route renderer ───────────────────────────────────
  const camera   = useMapCamera(mapRef);
  const marker   = useDriverMarker(mapRef, mapLoadedRef);
  const routes   = useRouteRenderer(mapRef);

  // ── Voice navigation ────────────────────────────────────────────────────
  const voice = useVoiceNavigation();

  // ── Directions / step nav / ETA ────────────────────────────────────────
  const liveMap = useRideLiveMap({
    mapRef,
    mapLoadedRef,
    ride,
    stops,
    activeVersion: tracking?.activeRouteVersion,
    bookingType,
    onEtaUpdate: () => setLastEtaUpdatedAt(Date.now()),
    onReroute: () => {
      // voice hook already announces "Recalculating route." via the
      // 'lrt:announce' CustomEvent dispatched inside useRideLiveMap.
    },
  });

  // ── Init Google Map once ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current || !window.google?.maps) return;

    const map = new window.google.maps.Map(mapDivRef.current, {
      center:              { lat: 16.5062, lng: 80.6480 }, // sensible default; recenters on first GPS fix
      zoom:                14,
      disableDefaultUI:    true,
      gestureHandling:     'greedy',
      mapId:               process.env.NEXT_PUBLIC_GOOGLE_MAP_ID || undefined,
    });

    mapRef.current   = map;
    mapLoadedRef.current = true;

    const cleanupCamera = camera.initCameraListeners(map);
    return () => {
      cleanupCamera?.();
      mapRef.current = null;
      mapLoadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Draw pickup / dropoff static pins once ride data is available ──────
  useEffect(() => {
    if (!mapRef.current || !ride) return;

    if (!pickupMarkerRef.current && ride.pickup?.coordinates?.length === 2) {
      const [lng, lat] = ride.pickup.coordinates;
      pickupMarkerRef.current = createStaticMarker(mapRef.current, lat, lng, 'pickup');
    }
    if (!dropoffMarkerRef.current && ride.dropoff?.coordinates?.length === 2) {
      const [lng, lat] = ride.dropoff.coordinates;
      dropoffMarkerRef.current = createStaticMarker(mapRef.current, lat, lng, 'dropoff');
    }

    return () => {
      pickupMarkerRef.current?.map && (pickupMarkerRef.current.map = null);
      dropoffMarkerRef.current?.map && (dropoffMarkerRef.current.map = null);
    };
  }, [ride]);

  // ── Drive marker + camera + voice off every GPS tick ────────────────────
  useEffect(() => {
    if (!currentPosition) return;
    const { lat, lng, heading, speed } = currentPosition;

    marker.updateMarker(lat, lng, heading, camera.mapBearingRef.current, speed);
    camera.updateCamera(lat, lng, heading, speed);
    routes.updateProgress(lat, lng);
    liveMap.onGpsUpdate(lat, lng, heading, speed);
  }, [currentPosition]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CA marker / route, when applicable ─────────────────────────────────
  useEffect(() => {
    if (!caLiveLocation?.lat) return;
    routes.updateCaProgress(caLiveLocation.lat, caLiveLocation.lng);
  }, [caLiveLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (caJoinPoint?.coordinates?.length === 2 && currentPosition) {
      // Draw a simple two-point CA route (CA's current pos → join point) if
      // we don't already have a richer Directions-based one. setCaRouteDirect
      // is the cheap path; CareAssistantLiveTracking page can later replace
      // it with a real Directions result via setCaRoute if needed.
      if (caLiveLocation?.lat) {
        routes.setCaRouteDirect([
          { lat: caLiveLocation.lat, lng: caLiveLocation.lng },
          { lat: caJoinPoint.coordinates[1], lng: caJoinPoint.coordinates[0] },
        ]);
      }
    }
  }, [caJoinPoint, caLiveLocation]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw driver route the moment useRideLiveMap computes one ───────────
  useEffect(() => {
    const handler = (e) => {
      const { result, targetType } = e.detail || {};
      if (!result) return;
      const routeType =
        targetType === 'HOSPITAL'              ? 'toDropoff' :
        targetType === 'CARE_ASSISTANT_JOIN'   ? 'toPickup'  : // CA-join leg uses pickup palette, CA's own line stays purple
                                                  'toPickup';
      routes.setRoute(result, routeType);
    };
    window.addEventListener('lrt:route_ready', handler);
    return () => window.removeEventListener('lrt:route_ready', handler);
  }, [routes]);

  // ── Mute voice while parked at a stop; un-mute once moving again ───────
  const atStop = AT_STOP_STATUSES.has(rideStatus) ||
    (currentStop && currentStop.status === 'ARRIVED');

  useEffect(() => {
    if (atStop && voice.voiceEnabled) {
      // don't permanently disable user preference — just silence queue
      voice.pauseSpeaking();
    }
  }, [atStop]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track when we entered the "at stop" state, for the wait timer ──────
  useEffect(() => {
    if (atStop) {
      if (!stopEnteredAtRef.current) {
        stopEnteredAtRef.current = Date.now();
        setStopEnteredAt(stopEnteredAtRef.current);
      }
    } else {
      stopEnteredAtRef.current = null;
      setStopEnteredAt(null);
    }
  }, [atStop]);

  // ── Compose wait-timer label by booking type + CA state ────────────────
  const waitLabel = useMemo(() => {
    if (!atStop) return null;

    if (bookingType === 'CARE_ASSISTANT') {
      if (caStatus && caStatus !== 'in_ride' && caStatus !== 'not_joined') {
        return caName
          ? `Waiting for ${caName} (Care Assistant)`
          : 'Waiting for Care Assistant';
      }
      return 'Waiting at stop';
    }

    if (bookingType === 'OUTSTATION' || bookingType === 'RETURN_TRIP') {
      if (currentStop?.location?.address || currentStop?.location?.label) {
        const seq = currentStop?.sequence ? ` #${currentStop.sequence}` : '';
        return `Waiting at stop${seq}: ${currentStop.location.address || currentStop.location.label}`;
      }
      return 'Waiting at stop';
    }

    return 'Waiting at stop';
  }, [atStop, bookingType, caStatus, caName, currentStop]);

  // ── Voice toggle handler exposed to UI ──────────────────────────────────
  const handleToggleVoice = useCallback(() => voice.toggleVoice(), [voice]);

  // ── Re-center button handler ────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (currentPosition) camera.recenter(currentPosition.lat, currentPosition.lng);
  }, [currentPosition, camera]);

  // ── SOS handler ─────────────────────────────────────────────────────────
  const handleSos = useCallback(() => {
    triggerSosAlert('SAFETY');
    voice.announceArrival; // no-op reference kept to silence lints if unused elsewhere
  }, [triggerSosAlert, voice]);

  const bookingTypeLabel = BOOKING_TYPE_LABELS[bookingType] || 'Ride';

  return (
    <div className="lrt-root">
      <div ref={mapDivRef} className="lrt-map" />

      {/* ── Top status bar ───────────────────────────────────────────── */}
      <div className="lrt-topbar">
        <div className="lrt-topbar__type">{bookingTypeLabel}</div>
        {isOffline && <div className="lrt-pill lrt-pill--warn">Offline — retrying…</div>}
        {!connected && !isOffline && <div className="lrt-pill lrt-pill--warn">Connecting…</div>}
        {gpsError && <div className="lrt-pill lrt-pill--error">{gpsError}</div>}
      </div>

      {/* ── Timer block — switches between wait timer and ETA timer ───── */}
      <div className="lrt-timer-zone">
        {atStop ? (
          <StopWaitTimer label={waitLabel} startedAt={stopEnteredAt} />
        ) : (
          <EtaTimer
            etaMinutes={liveMap.etaMinutes}
            distanceKm={liveMap.distanceKm}
            lastEtaUpdatedAt={lastEtaUpdatedAt}
          />
        )}
      </div>

      {/* ── Turn-by-turn banner (only while driving) ───────────────────── */}
      {!atStop && liveMap.hasRoute && (
        <div className="lrt-turnbanner">
          <span className={`lrt-turnbanner__icon lrt-icon--${getManeuverIcon(liveMap.currentManeuver)}`} />
          <div className="lrt-turnbanner__text">
            <div className="lrt-turnbanner__current">{liveMap.currentStepText || 'Continue straight'}</div>
            {liveMap.nextStepText && (
              <div className="lrt-turnbanner__next">Then {liveMap.nextStepText.toLowerCase()}</div>
            )}
          </div>
          {liveMap.isRerouting && <div className="lrt-pill lrt-pill--warn">Rerouting…</div>}
        </div>
      )}

      {/* ── CA status strip (Care Assistant bookings only) ─────────────── */}
      {bookingType === 'CARE_ASSISTANT' && (
        <div className="lrt-castrip">
          <span className="lrt-castrip__dot" />
          <span className="lrt-castrip__text">
            {caName ? `${caName} — ` : ''}
            {caStatus === 'in_ride' ? 'In vehicle' :
             caStatus === 'not_joined' ? 'Not yet joined' :
             caStatus?.replace(/_/g, ' ') || 'Status unknown'}
          </span>
        </div>
      )}

      {/* ── Bottom controls ──────────────────────────────────────────── */}
      <div className="lrt-controls">
        <button type="button" className="lrt-btn lrt-btn--recenter" onClick={handleRecenter}>
          Recenter
        </button>
        <button
          type="button"
          className={`lrt-btn lrt-btn--voice ${voice.voiceEnabled ? 'is-on' : 'is-off'}`}
          onClick={handleToggleVoice}
        >
          {voice.voiceEnabled ? 'Voice: On' : 'Voice: Off'}
        </button>
        <button type="button" className="lrt-btn lrt-btn--sos" onClick={handleSos}>
          SOS
        </button>
      </div>

      {isLoadingRide && (
        <div className="lrt-loading-overlay">Loading ride…</div>
      )}
    </div>
  );
}

export default function RideLiveTrackingPage() {
  const params = useParams();
  const rideId = params?.rideId;
  const bookingId = params?.bookingId;
  return <RideLiveTracking rideId={rideId} bookingId={bookingId} />;
}