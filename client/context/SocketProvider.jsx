'use client';

/**
 * SocketProvider.jsx — Likeson.in
 *
 * Provides socket connection + booking room subscription to all children.
 * Exposes useSocket() hook for event subscriptions and emit helpers.
 *
 * Usage:
 *   <SocketProvider token={jwt} bookingId={activeBookingId}>
 *     <YourComponent />
 *   </SocketProvider>
 *
 *   const { socket, connected, bookingState, rideStops, participants, on } = useSocket();
 *
 * Deliberately has no Redux dependency (no userSlice/socketSlice import) —
 * `token` comes in as a prop, all live state lives in local React state.
 * Whoever mounts this (root layout, typically) is free to source the token
 * however the app does auth; this component doesn't care.
 *
 * `bookingId` / `tpId` / `enableGps` / `isCareGps` are OPTIONAL convenience
 * props for simple single-booking pages that don't want to write their own
 * tracking hook. They are NOT required, and they do not conflict with pages
 * that manage their own room joins directly via `socketService.joinBookingRoom`
 * (useRideTracking.js and useCareAssistantTracking.js both do this) — joining
 * a room you're already in is a harmless no-op, so the two mechanisms can
 * coexist on the same page without double-booking anything.
 *
 * FIX SUMMARY (this pass):
 *  1. CRASH: `updateCareStatus` and `stopAllTracking` were bound off
 *     socketService below, but neither method existed there — every
 *     render threw `Cannot read properties of undefined (reading 'bind')`
 *     the instant this component mounted. Since this wraps the whole app,
 *     that's a hard crash on first paint. Both methods now exist on
 *     socketService (see that file's changelog) — no other change needed
 *     here, but flagging because it's the difference between "the app
 *     loads" and "the app doesn't."
 *  2. Token loss (logout) didn't disconnect the socket — the init effect's
 *     cleanup intentionally avoided calling `socketService.destroy()`
 *     ("singleton lives for app lifetime"), but that comment described the
 *     *unmount* case, not the *token went from truthy to falsy* case. A
 *     user logging out kept a live, previously-authenticated socket
 *     connection open, still receiving room broadcasts for whatever
 *     bookings it had joined. Added an explicit branch: token present →
 *     falsy transitions now call `socketService.destroy()` and reset all
 *     local state; component unmount still leaves the singleton alone.
 *  3. `destination_changed` payload shape is inconsistent across the two
 *     backend routes that emit it — bookingRouter2.js sends `newDestination`
 *     as a bare `[lng, lat]` array, rideOperationsRouter.js sends it as a
 *     full `{type, coordinates, address}` object. The handler only handled
 *     the second shape; on the bookingRouter2 path it stored the array
 *     itself as "coordinates" (i.e. nested it one level too deep). Now
 *     accepts either shape.
 *  4. SOS payloads use two different id keys depending on which route
 *     triggered them (`sosEventId` from bookingRouter2 / driver SOS,
 *     `sosId` from rideOperationsRouter's generic participant SOS route).
 *     `SOS_RESOLVED`'s filter only matched `sosEventId`, so an SOS raised
 *     through the generic route would never get cleared from `activeSos`
 *     once resolved. Now checks both keys.
 *  5. BOOKING_STATE_SNAPSHOT didn't hydrate `caLocation` at all on
 *     reconnect — added, reading the active CARE_ASSISTANT entry out of
 *     `data.tracking.participants[]` (the current RideTracking schema),
 *     matching the same fix already applied in useRideTracking.js /
 *     useCareAssistantTracking.js.
 *  6. Context `value` was a brand-new object (with a dozen freshly-bound
 *     functions) on every render, so every `useSocket()` consumer
 *     re-rendered on every socket event regardless of whether the slice of
 *     state it actually reads changed. Wrapped the imperative-method half
 *     in a `useMemo` with empty deps (socketService is a stable singleton,
 *     these never need to change) and the full value in a `useMemo` keyed
 *     on the state that does change.
 *  7. Removed `unsubsRef` — it was being pushed to on every
 *     `registerListener` call but never read anywhere; dead write-only ref.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import socketService, { SOCKET_EVENTS } from '@/services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

const SocketContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{
 *   token: string,
 *   bookingId?: string,
 *   tpId?: string,
 *   role?: string,        // 'customer' | 'driver' | 'solodriverpartner' | 'care_assistant' | 'transportpartner' | 'admin' | 'superadmin'
 *   enableGps?: boolean,  // driver auto-starts GPS if true
 *   isCareGps?: boolean,  // CA auto-starts care GPS if true
 *   children: React.ReactNode
 * }} props
 */
export function SocketProvider({
  token,
  bookingId,
  tpId,
  role,
  enableGps   = false,
  isCareGps   = false,
  children,
}) {
  const [connected,     setConnected]     = useState(false);
  const [bookingState,  setBookingState]  = useState(null);
  const [rideStops,     setRideStops]     = useState([]);
  const [participants,  setParticipants]  = useState([]);
  const [activeSos,     setActiveSos]     = useState([]);
  const [liveLocation,  setLiveLocation]  = useState(null);     // driver GPS
  const [caLocation,    setCaLocation]    = useState(null);     // CA GPS
  const [currentStop,   setCurrentStop]   = useState(null);     // active stop
  const [rideStatus,    setRideStatus]    = useState(null);

  const resetLocalState = useCallback(() => {
    setConnected(false);
    setBookingState(null);
    setRideStops([]);
    setParticipants([]);
    setActiveSos([]);
    setLiveLocation(null);
    setCaLocation(null);
    setCurrentStop(null);
    setRideStatus(null);
  }, []);

  // ── Register listener — thin wrapper kept for readability at call sites ──
  const registerListener = useCallback((event, handler) => socketService.on(event, handler), []);

  // ── Init socket / FIX #2: destroy on token loss, not just on unmount ──────

  useEffect(() => {
    if (!token) {
      // Token went away (logout) — actually tear the socket down. Previously
      // this branch didn't exist, so a stale authenticated connection kept
      // receiving room broadcasts after logout.
      socketService.destroy();
      resetLocalState();
      return;
    }

    const socket = socketService.init(token);

    const onConnect    = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect',    onConnect);
    socket.on('disconnect', onDisconnect);
    if (socket.connected) setConnected(true);

    return () => {
      socket.off('connect',    onConnect);
      socket.off('disconnect', onDisconnect);
      // Don't destroy on unmount — singleton lives for app lifetime.
      // Token going to null/undefined (handled above) is the actual
      // teardown signal; plain remount/unmount is not.
    };
  }, [token, resetLocalState]);

  // ── Join booking room ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!bookingId || !connected) return;
    socketService.joinBookingRoom(bookingId);
    // Request initial state
    socketService.requestBookingState(bookingId);
    return () => {
      socketService.leaveBookingRoom(bookingId);
    };
  }, [bookingId, connected]);

  // ── Join TP room ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tpId || !connected) return;
    socketService.joinTpRoom(tpId);
    return () => {
      socketService.leaveTpRoom(tpId);
    };
  }, [tpId, connected]);

  // ── Auto GPS (driver) ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!enableGps || !connected || !bookingId) return;
    socketService.startGpsTracking({ bookingId });
    return () => socketService.stopGpsTracking();
  }, [enableGps, connected, bookingId]);

  // ── Auto GPS (care assistant) ──────────────────────────────────────────────

  useEffect(() => {
    if (!isCareGps || !connected || !bookingId) return;
    socketService.startCareGpsTracking({ bookingId });
    return () => socketService.stopCareGpsTracking();
  }, [isCareGps, connected, bookingId]);

  // ── Core event listeners ───────────────────────────────────────────────────

  useEffect(() => {
    if (!connected) return;

    const unsubs = [

      // Booking state snapshot (full initial state)
      registerListener(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, (data) => {
        setBookingState(data);
        setRideStatus(data?.ride?.status ?? null);
        if (data?.rideStops?.length) setRideStops(data.rideStops);
        if (data?.ride?.currentStop)  setCurrentStop(data.ride.currentStop);
        if (data?.activeSos?.length)  setActiveSos(data.activeSos);

        // FIX #5: hydrate CA position on reconnect from the generic
        // participants[] array (current RideTracking schema) — this was
        // previously never set from the snapshot at all.
        const caEntry = data?.tracking?.participants?.find(
          (p) => p.role === 'CARE_ASSISTANT' && p.isActive
        );
        if (caEntry?.liveLocation?.coordinates?.length === 2) {
          setCaLocation({
            lat:       caEntry.liveLocation.coordinates[1],
            lng:       caEntry.liveLocation.coordinates[0],
            heading:   caEntry.liveLocation.heading  || 0,
            speed:     caEntry.liveLocation.speedKmh || 0,
            updatedAt: caEntry.liveLocation.updatedAt || new Date(),
          });
        }
      }),

      // Ride stops snapshot (on-demand request)
      registerListener(SOCKET_EVENTS.RIDE_STOPS_SNAPSHOT, (data) => {
        if (data?.stops) setRideStops(data.stops);
      }),

      // Participants snapshot (on-demand request)
      registerListener(SOCKET_EVENTS.PARTICIPANTS_SNAPSHOT, (data) => {
        if (data?.participants) setParticipants(data.participants);
      }),

      // Driver live location
      registerListener(SOCKET_EVENTS.LOCATION_UPDATE, (data) => {
        if (data?.lat && data?.lng) {
          setLiveLocation({ lat: data.lat, lng: data.lng, heading: data.heading, speed: data.speed, updatedAt: new Date() });
        }
      }),

      // CA live location
      registerListener(SOCKET_EVENTS.CARE_ASSISTANT_LOCATION_UPDATE, (data) => {
        if (data?.lat && data?.lng) {
          setCaLocation({ lat: data.lat, lng: data.lng, heading: data.heading, speed: data.speed, updatedAt: new Date() });
        }
      }),

      // Ride / booking status
      registerListener(SOCKET_EVENTS.BOOKING_STATUS_CHANGE, (data) => {
        setRideStatus(data?.status ?? null);
        setBookingState(prev => prev ? { ...prev, bookingStatus: data?.status } : prev);
      }),

      registerListener(SOCKET_EVENTS.RIDE_STATUS_CHANGED, (data) => {
        setRideStatus(data?.status ?? null);
      }),

      // Stop events — update stop list in place
      registerListener(SOCKET_EVENTS.STOP_ARRIVED, (data) => {
        setRideStops(prev => prev.map(s =>
          s.stopId?.toString() === data?.stopId?.toString()
            ? { ...s, status: 'ARRIVED', arrival: { actualAt: data?.timestamp } }
            : s
        ));
      }),

      registerListener(SOCKET_EVENTS.STOP_DEPARTED, (data) => {
        setRideStops(prev => prev.map(s =>
          s.stopId?.toString() === data?.departedStopId?.toString()
            ? { ...s, status: 'COMPLETED' }
            : s
        ));
        if (data?.nextStop) setCurrentStop(data.nextStop);
      }),

      registerListener(SOCKET_EVENTS.STOP_STATUS_CHANGED, (data) => {
        setRideStops(prev => prev.map(s =>
          s.stopId?.toString() === data?.stopId?.toString()
            ? { ...s, status: data.status }
            : s
        ));
      }),

      // Participant events — update participant list in place
      registerListener(SOCKET_EVENTS.PARTICIPANT_ASSIGNED, (data) => {
        // refetch full list on assign
        if (data?.rideId) socketService.requestParticipants({ rideId: data.rideId });
      }),

      registerListener(SOCKET_EVENTS.PARTICIPANT_STATUS_CHANGE, (data) => {
        setParticipants(prev => prev.map(p =>
          p.participantId?.toString() === data?.participantId?.toString()
            ? { ...p, status: data.status }
            : p
        ));
      }),

      registerListener(SOCKET_EVENTS.PARTICIPANT_REMOVED, (data) => {
        setParticipants(prev => prev.filter(
          p => p.participantId?.toString() !== data?.participantId?.toString()
        ));
      }),

      // SOS — FIX #4: backend uses two different id keys depending on which
      // route triggered the SOS (`sosEventId` vs `sosId`). Normalize on read.
      registerListener(SOCKET_EVENTS.SOS_ALERT, (data) => {
        setActiveSos(prev => [...prev, data]);
      }),

      registerListener(SOCKET_EVENTS.SOS_TRIGGERED, (data) => {
        setActiveSos(prev => [...prev, data]);
      }),

      registerListener(SOCKET_EVENTS.SOS_RESOLVED, (data) => {
        const resolvedId = data?.sosEventId?.toString() ?? data?.sosId?.toString();
        setActiveSos(prev => prev.filter((e) => {
          const eId = e?.sosEventId?.toString() ?? e?.sosId?.toString();
          return eId !== resolvedId;
        }));
      }),

      // Join point recalculated — update CA join stop in rideStops
      registerListener(SOCKET_EVENTS.JOIN_POINT_RECALCULATED, (data) => {
        if (data?.rideId) {
          socketService.requestRideStops({ rideId: data.rideId });
        }
      }),

      // CA join point missed — admin notified; update local stop status
      registerListener(SOCKET_EVENTS.CA_MISSED_JOINPOINT, () => {
        setRideStops(prev => prev.map(s =>
          s.stopType === 'CARE_ASSISTANT_JOIN' ? { ...s, status: 'MISSED' } : s
        ));
      }),

// Vehicle replaced (admin) — update snapshot in booking state.
      registerListener(SOCKET_EVENTS.VEHICLE_REPLACED, (data) => {
        setBookingState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            ride: prev.ride ? { ...prev.ride, vehicleSnapshot: data?.newVehicle } : prev.ride,
          };
        });
      }),

      // Destination changed — FIX #3: `newDestination` is a bare
      // [lng, lat] array on the bookingRouter2 path and a full
      // {type, coordinates, address} object on the rideOperationsRouter
      // path. Accept either.
      registerListener(SOCKET_EVENTS.DESTINATION_CHANGED, (data) => {
        const coords = Array.isArray(data?.newDestination)
          ? data.newDestination
          : data?.newDestination?.coordinates;
        const address = Array.isArray(data?.newDestination)
          ? undefined
          : data?.newDestination?.address;

        setBookingState(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            ride: prev.ride ? {
              ...prev.ride,
              dropoff: { coordinates: coords, address },
            } : prev.ride,
          };
        });
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub?.();
    };
  }, [connected, registerListener]);

  // ── Expose `on` for consumers wanting raw event access ─────────────────────

  /**
   * on — subscribe to a socket event from inside a component.
   * Returns unsubscribe function — call it in useEffect cleanup.
   *
   * @example
   * const { on } = useSocket();
   * useEffect(() => {
   *   const off = on(SOCKET_EVENTS.RIDE_COMPLETED, (data) => console.log(data));
   *   return off;
   * }, [on]);
   */
  const on = useCallback((event, handler) => {
    return socketService.on(event, handler);
  }, []);

  // ── Imperative method surface — FIX #6: bound once, socketService is a ───
  // stable module-level singleton so none of these ever need to change.
  const actions = useMemo(() => ({
    socket:    socketService,
    on,
    joinBookingRoom:       socketService.joinBookingRoom.bind(socketService),
    leaveBookingRoom:      socketService.leaveBookingRoom.bind(socketService),
    joinTpRoom:            socketService.joinTpRoom.bind(socketService),
    leaveTpRoom:           socketService.leaveTpRoom.bind(socketService),
    requestBookingState:   socketService.requestBookingState.bind(socketService),
    requestRideStops:      socketService.requestRideStops.bind(socketService),
    requestParticipants:   socketService.requestParticipants.bind(socketService),
    emitCareLocation:      socketService.emitCareLocation.bind(socketService),
    emitLocation:          socketService.emitLocation.bind(socketService),
    emitCaMissedJoinpoint: socketService.emitCaMissedJoinpoint.bind(socketService),
    updateCareStatus:      socketService.updateCareStatus.bind(socketService),
    updateDriverStatus:    socketService.updateDriverStatus.bind(socketService),
    verifyOtp:             socketService.verifyOtp.bind(socketService),
    verifyOtpAsync:        socketService.verifyOtpAsync.bind(socketService),
    requestOtpResend:      socketService.requestOtpResend.bind(socketService),
    triggerSos:            socketService.triggerSos.bind(socketService),
    reportRouteDeviation:  socketService.reportRouteDeviation.bind(socketService),
    pingHealth:            socketService.pingHealth.bind(socketService),
    startGpsTracking:      socketService.startGpsTracking.bind(socketService),
    stopGpsTracking:       socketService.stopGpsTracking.bind(socketService),
    startCareGpsTracking:  socketService.startCareGpsTracking.bind(socketService),
    stopCareGpsTracking:   socketService.stopCareGpsTracking.bind(socketService),
    stopAllTracking:       socketService.stopAllTracking.bind(socketService),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [on]);

  // ── Context value ──────────────────────────────────────────────────────────

  const value = useMemo(() => ({
    ...actions,
    connected,
    bookingState,
    rideStops,
    participants,
    activeSos,
    liveLocation,
    caLocation,
    currentStop,
    rideStatus,
    role: role ?? null,
  }), [actions, connected, bookingState, rideStops, participants, activeSos, liveLocation, caLocation, currentStop, rideStatus, role]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used inside <SocketProvider>');
  return ctx;
}

export default SocketProvider;