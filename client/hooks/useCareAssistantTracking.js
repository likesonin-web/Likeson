'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSocket } from '@/context/SocketProvider';
import socketService, { SOCKET_EVENTS } from '@/services/socketService';

import {
  fetchCareTrackingSnapshot,
  updateCareLocation,
  markCareArrived,
  markCareStart,
  markCareComplete,
careReachedJoinPoint,
  careJoinRide,
  careUpdateRideStatus,
  triggerBookingSos,
  setCareAssistantLocation,
  setCareAssistantStatus,
  setCareAssistantJoined,
  setCaAtJoinPoint,
  setCaHasJoined,
  setJpWaypointCompleted,
  clearCareRideState,
  setLiveLocation,
  setEtaUpdate,
  setRideStatus,
  setSosAlert,
  clearSosAlert,
  selectCareTrackingSnapshot,
  selectCareAssistantLocation,
  selectCareAssistantStatus,
  selectCareRideStatus,
  selectCaViewMode,
  selectCaHasJoined,
  selectCaAtJoinPoint,
  selectCaJoinPoint,
  selectLiveLocation,
  selectEtaUpdate,
  selectSosAlert,
  selectCareTrackingLoading,
} from '@/store/slices/operationsSlice';

const GPS_PUSH_INTERVAL_MS = 4000;
const SELF_GPS_OPTIONS = { enableHighAccuracy: true, maximumAge: 2000, timeout: 10_000 };

/**
 * useCareAssistantTracking
 *
 * Dedicated master hook for the Care Assistant tracking experience —
 * intentionally NOT a branch inside useRideTracking. The CA flow needs a
 * different backend endpoint (`/bookings/:id/care/tracking-snapshot`, which
 * is booking-type aware and returns the right shape for 'care_assistant'
 * vs 'full_care_ride'), a different GPS subject (push the CA's own
 * position, not a vehicle's), and a different derived state machine
 * ("phase": standalone / navigate_to_jp / in_vehicle) — bolting that onto
 * the driver-ride hook would have meant another round of conditional
 * branches inside a hook that already had dead CA code from the last
 * redesign pass (see useRideTracking.js fix notes).
 *
 * @param {{ bookingId: string, viewerRole?: 'care_assistant'|'customer'|'admin'|'superadmin'|'driver'|'solodriverpartner' }} params
 */
export function useCareAssistantTracking({ bookingId, viewerRole = 'care_assistant' }) {
  const dispatch = useDispatch();
  const { on, connected } = useSocket();
  const isSelf = viewerRole === 'care_assistant';

  // ── Redux state ────────────────────────────────────────────────────────
  const snapshot          = useSelector(selectCareTrackingSnapshot);
  const caLocation        = useSelector(selectCareAssistantLocation);
  const caStatusRedux     = useSelector(selectCareAssistantStatus);
  const careRideStatus    = useSelector(selectCareRideStatus);
  const caViewMode        = useSelector(selectCaViewMode);
  const caHasJoined       = useSelector(selectCaHasJoined);
  const caAtJoinPoint     = useSelector(selectCaAtJoinPoint);
  const caJoinPointRedux  = useSelector(selectCaJoinPoint);
  const driverLiveLocation = useSelector(selectLiveLocation);
  const etaMinutes        = useSelector(selectEtaUpdate);
  const sosAlert          = useSelector(selectSosAlert);
  const snapshotLoading   = useSelector(selectCareTrackingLoading);

  // ── Local state ──────────────────────────────────────────────────────────
  const [isLoading, setIsLoading]             = useState(true);
  const [loadError, setLoadError]             = useState(null);
  const [gpsError, setGpsError]               = useState(null);
  const [isOffline, setIsOffline]             = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);

  const mountedRef    = useRef(true);
  const gpsWatchIdRef = useRef(null);
  const lastPushAtRef = useRef(0);
  const lastPosRef    = useRef(null);

  // ── 1. Fetch booking-aware snapshot ───────────────────────────────────────
  const refresh = useCallback(() => {
    if (!bookingId) return;
    setIsLoading(true);
    dispatch(fetchCareTrackingSnapshot({ bookingId }))
      .then((result) => {
        if (!mountedRef.current) return;
        setLoadError(result?.error ? (result.payload || 'Failed to load tracking data') : null);
      })
      .finally(() => { if (mountedRef.current) setIsLoading(false); });
  }, [bookingId, dispatch]);

  useEffect(() => { refresh(); }, [refresh]);

  // ── 2. Join booking room + hydrate on (re)connect ─────────────────────────
  useEffect(() => {
    if (!connected || !bookingId) return;
    socketService.joinBookingRoom(bookingId);
    socketService.requestBookingState(bookingId);
    return () => socketService.leaveBookingRoom(bookingId);
  }, [connected, bookingId]);

  // ── 3. Socket listeners ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubs = [

      on(SOCKET_EVENTS.CARE_ASSISTANT_LOCATION_UPDATE, (data) => {
        dispatch(setCareAssistantLocation({
          lat: data.lat, lng: data.lng,
          heading: data.heading ?? 0, speed: data.speed ?? 0,
          updatedAt: data.updatedAt || new Date().toISOString(),
          role: 'care_assistant', careAssistantId: data.careAssistantId || null,
        }));
        if (data.status) dispatch(setCareAssistantStatus({ careAssistantStatus: data.status }));
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_STATUS_CHANGE, (data) => {
        dispatch(setCareAssistantStatus({
          careAssistantStatus: data.careAssistantStatus || data.status,
          careAssistantName:   data.careAssistantName,
        }));
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_AT_JP, (data) => {
        dispatch(setCaAtJoinPoint());
        if (data?.careAssistantStatus) {
          dispatch(setCareAssistantStatus({ careAssistantStatus: data.careAssistantStatus }));
        }
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_JOINED_RIDE, (data) => {
        dispatch(setCareAssistantJoined({
          careAssistantId: data.careAssistantId, careAssistantName: data.careAssistantName,
          joinedAt: data.joinedAt, caJoinPoint: null,
        }));
        dispatch(setCaHasJoined(data));
      }),

      on(SOCKET_EVENTS.CARE_ASSISTANT_ATTACHED, (data) => {
        dispatch(setCareAssistantJoined({
          careAssistantId: data.careAssistantId, careAssistantName: data.careAssistantName,
          joinedAt: new Date().toISOString(), caJoinPoint: data.caJoinPoint || null,
        }));
      }),

      on(SOCKET_EVENTS.CA_JOIN_WAYPOINT_COMPLETED, (data) => {
        dispatch(setJpWaypointCompleted(data));
      }),

      // Driver location only matters once the CA has boarded ('in_vehicle' phase)
      on(SOCKET_EVENTS.LOCATION_UPDATE, (data) => {
        dispatch(setLiveLocation(data));
      }),

      on(SOCKET_EVENTS.ETA_UPDATE, (data) => {
        dispatch(setEtaUpdate(data?.etaMinutes ?? data));
      }),

      on(SOCKET_EVENTS.RIDE_STATUS_CHANGED,  (data) => dispatch(setRideStatus(data))),
      on(SOCKET_EVENTS.BOOKING_STATUS_CHANGE, (data) => dispatch(setRideStatus(data))),

      on(SOCKET_EVENTS.SOS_ALERT,     (data) => dispatch(setSosAlert(data))),
      on(SOCKET_EVENTS.SOS_TRIGGERED, (data) => dispatch(setSosAlert(data))),
      on(SOCKET_EVENTS.SOS_RESOLVED,  ()     => dispatch(clearSosAlert())),

      // A fresh/recalculated join point invalidates whatever route the page
      // last drew — the page's own effect watches caJoinPoint and re-requests.
      on(SOCKET_EVENTS.JOIN_POINT_CALCULATED, (data) => {
        if (data?.location) {
          dispatch(setCareAssistantJoined({
            caJoinPoint: { coordinates: data.location.coordinates, zone: data.zone, distCaToJoinKm: data.distCaToJoinKm },
          }));
        }
      }),
      on(SOCKET_EVENTS.JOIN_POINT_RECALCULATED, (data) => {
        if (data?.location) {
          dispatch(setCareAssistantJoined({
            caJoinPoint: { coordinates: data.location.coordinates, zone: data.zone, distCaToJoinKm: data.distCaToJoinKm },
          }));
        }
      }),

      // Reconnect hydration — generic participants[] schema (current RideTracking shape)
      on(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, (data) => {
        const caEntry = data?.tracking?.participants?.find((p) => p.role === 'CARE_ASSISTANT' && p.isActive);
        if (caEntry?.liveLocation?.coordinates?.length === 2) {
          dispatch(setCareAssistantLocation({
            lat: caEntry.liveLocation.coordinates[1], lng: caEntry.liveLocation.coordinates[0],
            heading: caEntry.liveLocation.heading || 0, speed: caEntry.liveLocation.speedKmh || 0,
            role: 'care_assistant',
          }));
        }
        if (caEntry?.status) dispatch(setCareAssistantStatus({ careAssistantStatus: caEntry.status }));
      }),
    ];

    return () => unsubs.forEach((fn) => fn?.());
  }, [on, dispatch]);

  // ── 4. Self GPS — only pushed when the viewer IS the Care Assistant ───────
  const startSelfGps = useCallback(() => {
    if (!isSelf || typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (gpsWatchIdRef.current !== null) return;

    gpsWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading, accuracy } = pos.coords;
        const speedKmh = pos.coords.speed != null && pos.coords.speed >= 0
          ? +(pos.coords.speed * 3.6).toFixed(1)
          : 0;

        let computedHeading = heading;
        if ((computedHeading === null || computedHeading === undefined) && lastPosRef.current) {
          const prev = lastPosRef.current;
          computedHeading = ((Math.atan2(lng - prev.lng, lat - prev.lat) * 180) / Math.PI + 360) % 360;
        }

        const position = { lat, lng, heading: +(computedHeading ?? 0).toFixed(1), speed: speedKmh, accuracy: accuracy ?? null };
        lastPosRef.current = position;
        if (mountedRef.current) setCurrentPosition({ ...position });

        const now = Date.now();
        if (now - lastPushAtRef.current >= GPS_PUSH_INTERVAL_MS) {
          lastPushAtRef.current = now;
          dispatch(updateCareLocation({
            lat, lng, bookingId,
            status: careRideStatus?.status || undefined,
          }));
        }

        if (mountedRef.current) setGpsError((prev) => (prev ? null : prev));
      },
      (err) => {
        if (!mountedRef.current) return;
        if (err.code === err.PERMISSION_DENIED)      setGpsError('Location permission denied. Enable it to share your position.');
        else if (err.code === err.POSITION_UNAVAILABLE) setGpsError('GPS signal unavailable.');
        else                                            setGpsError('GPS timeout. Retrying…');
      },
      SELF_GPS_OPTIONS
    );
  }, [isSelf, dispatch, bookingId, careRideStatus]);

  const stopSelfGps = useCallback(() => {
    if (gpsWatchIdRef.current !== null) {
      navigator?.geolocation?.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    startSelfGps();
    return () => stopSelfGps();
  }, [startSelfGps, stopSelfGps]);

  // ── 5. Offline detection ───────────────────────────────────────────────────
  useEffect(() => {
    const onOffline = () => { if (mountedRef.current) setIsOffline(true); };
    const onOnline  = () => { if (!mountedRef.current) return; setIsOffline(false); refresh(); };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Reset CA-scoped slice state on unmount so a different booking's leftover
  // CA position/status can't bleed into the next page that mounts this hook.
  useEffect(() => () => { dispatch(clearCareRideState()); }, [dispatch]);

  // ── Derived: booking-type-aware phase ──────────────────────────────────────
  const bookingType = snapshot?.bookingType ?? null;
  const hasRide = !!snapshot && snapshot.hasRide !== false && snapshot.message !== 'No active ride yet';

  let phase = 'loading';
  if (!isLoading && snapshot) {
    if (!hasRide) phase = 'awaiting_assignment';
    else if (bookingType === 'care_assistant') phase = 'standalone';
    else if (bookingType === 'full_care_ride') phase = caHasJoined ? 'in_vehicle' : 'navigate_to_jp';
    else phase = 'other';
  }

  // NOTE: 'pickupLocation' is the CA's actual navigation target before
  // boarding — the patient's location for a standalone care_assistant
  // booking, or the patient pickup point for full_care_ride (NOT the
  // hospital — that's `dropoffLocation` below). Getting this backwards
  // would have the page draw a "Pickup" pin on the hospital.
  const pickupLocation = bookingType === 'care_assistant'
    ? snapshot?.route?.patientLocation
    : snapshot?.route?.pickup;

  const dropoffLocation = bookingType === 'full_care_ride' ? snapshot?.route?.dropoff : null;

  const caStartLocation  = bookingType === 'care_assistant' ? snapshot?.route?.caStart : null;
  const caJoinWaypoint   = caJoinPointRedux ?? snapshot?.route?.caJoinWaypoint ?? null;
  const liveCaLocation   = caLocation ?? snapshot?.careAssistant?.liveLocation ?? null;
  const liveDriverLocation = driverLiveLocation ?? snapshot?.driver?.liveLocation ?? null;

  // ── Actions ─────────────────────────────────────────────────────────────
  const reachedJoinPoint = useCallback((lat, lng) =>
    dispatch(careReachedJoinPoint({ bookingId, lat, lng })), [dispatch, bookingId]);
const boardVehicle = useCallback((lat, lng) =>
    dispatch(careJoinRide({ bookingId, currentLat: lat, currentLng: lng })), [dispatch, bookingId]);

  const setOwnRideStatus = useCallback((status, lat, lng) =>
    dispatch(careUpdateRideStatus({ bookingId, status, lat, lng })), [dispatch, bookingId]);

  const markArrived  = useCallback(() => dispatch(markCareArrived({ bookingId })),  [dispatch, bookingId]);
  const startTask    = useCallback(() => dispatch(markCareStart({ bookingId })),    [dispatch, bookingId]);
  const completeTask = useCallback(() => dispatch(markCareComplete({ bookingId })), [dispatch, bookingId]);

  const sos = useCallback((sosType, description) => {
    const pos = lastPosRef.current || currentPosition;
    return dispatch(triggerBookingSos({
      bookingId, sosType, description,
      lat: pos?.lat, lng: pos?.lng,
      rideId: snapshot?.rideId,
    }));
  }, [dispatch, bookingId, currentPosition, snapshot]);

  const dismissSos = useCallback(() => dispatch(clearSosAlert()), [dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  return {
    isLoading: isLoading || snapshotLoading,
    loadError,
    isOffline,
    gpsError,
    connected,

    bookingType,
    phase,
    hasRide,
    snapshot,
    rideStatus: snapshot?.rideStatus ?? careRideStatus?.status ?? null,
    rideStage:  snapshot?.rideStage ?? null,

    caViewMode,
    caHasJoined,
    caAtJoinPoint,
    caStatus: caStatusRedux?.careAssistantStatus ?? careRideStatus?.status ?? null,

    pickupLocation,
    dropoffLocation,
    caStartLocation,
    caJoinPoint: caJoinWaypoint,
    caLiveLocation: liveCaLocation,
    driverLiveLocation: liveDriverLocation,
    driverSnapshot:  snapshot?.driver?.snapshot ?? null,
    vehicleSnapshot: snapshot?.driver?.vehicleSnapshot ?? null,
    expectedPolyline: snapshot?.route?.expectedPolyline ?? null,
    estimatedDistanceKm: snapshot?.route?.estimatedDistanceKm ?? null,

    etaMinutes,
    hasActiveSos: snapshot?.hasActiveSos ?? false,
    sosAlert,
    milestones: snapshot?.milestones ?? [],

    currentPosition,
    isSelf,

    refresh,
    actions: {
      reachedJoinPoint,
      boardVehicle,
      setOwnRideStatus,
      markArrived,
      startTask,
      completeTask,
      sos,
      dismissSos,
    },
  };
}