/**
 * socketService.js — Likeson.in Booking Socket Client
 *
 * FIX (this pass): SocketProvider.jsx binds `updateCareStatus` and
 * `stopAllTracking` off this service — neither method existed, so every
 * render of SocketProvider threw `Cannot read properties of undefined
 * (reading 'bind')` the instant the component mounted. Since SocketProvider
 * wraps the whole app, that's a hard crash on first paint, not a corner
 * case. Added both methods below; everything else in this file is
 * unchanged from the previous pass.
 */

import { io } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5050';

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET EVENTS (server → client)
// ─────────────────────────────────────────────────────────────────────────────

export const SOCKET_EVENTS = {
  // ── Connection ──────────────────────────────────────────────────────────────
  JOINED_ROOM:                'joined_room',
  LEFT_ROOM:                  'left_room',
  PARTICIPANT_JOINED:         'participant_joined',
  PARTICIPANT_LEFT:           'participant_left',
  DRIVER_ONLINE:              'driver_online',
  DRIVER_OFFLINE:             'driver_offline',

  // ── Driver location ─────────────────────────────────────────────────────────
  DRIVER_LOCATION:            'driver_location',        // admin:ops feed
  LOCATION_UPDATE:            'location_update',        // driver GPS → booking room

  // ── Care assistant location / status ────────────────────────────────────────
  CARE_ASSISTANT_LOCATION_UPDATE: 'care_assistant_location_update',
  CARE_ASSISTANT_STATUS_CHANGE:   'care_assistant_status_change',
  CARE_ASSISTANT_JOINED_RIDE:     'care_assistant_joined_ride',
  CARE_ASSISTANT_ATTACHED:        'care_assistant_attached_to_ride',
  CARE_ASSISTANT_AT_JP:           'care_assistant_at_jp',
  CA_JOIN_WAYPOINT_COMPLETED:     'ca_join_waypoint_completed',
  CARE_REACHED_JP:                'care_reached_jp',   // CA at join point (HTTP → socket broadcast)

  // ── Join point events (rideOperationsRouter) ────────────────────────────────
  JOIN_POINT_CALCULATED:      'join_point_calculated',
  JOIN_POINT_STATUS_CHANGED:  'join_point_status_changed',
  JOIN_POINT_MISSED:          'join_point_missed',
  JOIN_POINT_RECALCULATED:    'join_point_recalculated',
  CA_MISSED_JOINPOINT:        'ca_missed_joinpoint',    // CA self-reports missed JP

  // ── Ride stop events (rideOperationsRouter) ─────────────────────────────────
  STOP_OTP_VERIFIED:          'stop_otp_verified',
  STOP_STATUS_CHANGED:        'stop_status_changed',
  STOP_ARRIVED:               'stop_arrived',
  STOP_DEPARTED:              'stop_departed',

  // ── Participant events (rideOperationsRouter) ────────────────────────────────
  PARTICIPANT_ASSIGNED:       'participant_assigned',
  PARTICIPANT_STATUS_CHANGE:  'participant_status_change',
  PARTICIPANT_REMOVED:        'participant_removed',

  // ── Destination change (bookingRouter2 + rideOperationsRouter) ───────────────
  DESTINATION_CHANGED:        'destination_changed',

  // ── ETA ─────────────────────────────────────────────────────────────────────
  ETA_UPDATE:                 'eta_update',
  HOSPITAL_ETA_UPDATE:        'hospital_eta_update',

  // ── Ride status ─────────────────────────────────────────────────────────────
  RIDE_STATUS_CHANGED:        'ride_status_changed',
  RIDE_STAGE_CHANGED:         'ride_stage_changed',
  BOOKING_STATUS_CHANGE:      'booking_status_change',
  NAVIGATION_TARGET_CHANGED:  'navigation_target_changed',
  STATUS_UPDATE_ACK:          'status_update_ack',

  // ── OTP ─────────────────────────────────────────────────────────────────────
  OTP_RESULT:                 'otp_result',
  OTP_WRONG_ATTEMPT:          'otp_wrong_attempt',
  OTP_RESEND_REQUESTED:       'otp_resend_requested',
  OTP_FOR_ADMIN:              'otp_for_admin',
  OTP_FAILED_ATTEMPT:         'otp_failed_attempt',

  // ── SOS ─────────────────────────────────────────────────────────────────────
  SOS_ALERT:                  'sos_alert',           // booking room broadcast
  SOS_ACK:                    'sos_ack',             // driver SOS ack
  SOS_TRIGGERED:              'sos_triggered',       // admin:ops notification
  SOS_RESOLVED:                'sos_resolved',        // resolution broadcast

  // ── Route ───────────────────────────────────────────────────────────────────
  ROUTE_DEVIATION_ALERT:      'route_deviation_alert',

  // ── Snapshot / state ────────────────────────────────────────────────────────
  BOOKING_STATE_SNAPSHOT:     'booking_state_snapshot',
  RIDE_STOPS_SNAPSHOT:        'ride_stops_snapshot',
  PARTICIPANTS_SNAPSHOT:      'participants_snapshot',

  // ── Return ride ─────────────────────────────────────────────────────────────
RETURN_RIDE_ACTIVATED:      'return_ride_activated',
  VEHICLE_REPLACED:           'vehicle_replaced',

  // ── Ride completed ──────────────────────────────────────────────────────────
  RIDE_COMPLETED:             'ride_completed',

  // ── Care ride ───────────────────────────────────────────────────────────────
  CARE_ARRIVED:               'care_arrived',
  CARE_COMPLETED:             'care_completed',
  RIDE_REQUESTED:             'ride_requested',       // CA/customer requested ride
  DRIVER_ARRIVED:             'driver_arrived',
  OTP_REQUIRED:               'otp_required',

  // ── Consultation ────────────────────────────────────────────────────────────
  CONSULTATION_CONFIRMED:     'consultation_confirmed',
  CONSULTATION_ACCEPTED:      'consultation_accepted',
  CONSULTATION_STARTED:       'consultation_started',
  CONSULTATION_ENDED:         'consultation_ended',
  CHAT_MESSAGE:               'chat_message',

  // ── Health ──────────────────────────────────────────────────────────────────
  PONG_HEALTH:                'pong_health',

  // ── Error ───────────────────────────────────────────────────────────────────
  ERROR:                      'error',
};

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT EVENTS (client → server)
// ─────────────────────────────────────────────────────────────────────────────

export const CLIENT_EVENTS = {
  // Rooms
  JOIN_BOOKING_ROOM:        'join_booking_room',
  JOIN_TP_ROOM:             'join_tp_room',
  LEAVE_BOOKING_ROOM:       'leave_booking_room',
  LEAVE_TP_ROOM:            'leave_tp_room',

  // Location
  DRIVER_LOCATION:          'driver_location',          // driver GPS ping
  CARE_LOCATION:            'care_location',            // CA GPS ping (primary)
  CARE_ASSISTANT_LOCATION:  'care_assistant_location',  // alias accepted by server

  // Driver
  DRIVER_STATUS_UPDATE:     'driver_status_update',
  VERIFY_OTP:               'verify_otp',
  OTP_RESEND_REQUEST:       'otp_resend_request',

  // SOS / deviation
  SOS_TRIGGER:              'sos_trigger',
  ROUTE_DEVIATION:          'route_deviation',

  // CA join point
  CA_MISSED_JOINPOINT:      'ca_missed_joinpoint',

  // State requests
  REQUEST_BOOKING_STATE:    'request_booking_state',
  REQUEST_RIDE_STOPS:       'request_ride_stops',
  REQUEST_PARTICIPANTS:     'request_participants',

  // Health
  PING_HEALTH:              'ping_health',
};

export const DRIVER_STATUS = {
  ACCEPTED:      'accepted',
  EN_ROUTE:      'en_route',
  ARRIVED:       'arrived',
  OTP_VERIFIED:  'otp_verified',
  RIDE_STARTED:  'ride_started',
  AT_STOP:       'at_stop',
  STOP_DEPARTED: 'stop_departed',
  COMPLETED:     'completed',
  CANCELLED:     'cancelled',
};

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class SocketService {
  constructor() {
    /** @type {import('socket.io-client').Socket|null} */
    this._socket          = null;
    this._currentToken    = null;
    this._pendingEmits    = [];
    this._gpsWatchId      = null;
    this._careGpsWatchId  = null;   // CA-specific GPS watch
    this._activeBookingId = null;
  }

  // ── Init / Destroy ─────────────────────────────────────────────────────────

  init(token) {
    if (this._socket?.connected) {
      if (this._currentToken === token) {
        console.warn('[Socket] Already connected with this token');
        return this._socket;
      }
      console.warn('[Socket] Token changed, reconnecting...');
      this.destroy();
    }

    this._currentToken = token;
    this._socket = io(SOCKET_URL, {
      auth:                 (cb) => cb({ token: this._currentToken || '' }),
      transports:           ['websocket', 'polling'],
      reconnection:         true,
      reconnectionAttempts: 10,
      reconnectionDelay:    1_000,
      reconnectionDelayMax: 10_000,
      timeout:              20_000,
    });

    this._socket.on('connect', () => {
      console.log('[Socket] Connected:', this._socket.id);
      for (const { event, payload } of this._pendingEmits) {
        this._socket.emit(event, payload);
      }
      this._pendingEmits = [];
    });

    this._socket.on('connect_error', (err) => {
      console.error('[Socket] Connect error:', err.message);
    });

    this._socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });

    this._socket.on('error', (err) => {
      console.error('[Socket] Server error:', err?.message ?? err);
    });

    return this._socket;
  }

  destroy() {
    this.stopAllTracking();
    this._activeBookingId = null;
    this._pendingEmits    = [];
    this._currentToken    = null;
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }
    console.log('[Socket] Destroyed');
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  get connected() { return this._socket?.connected ?? false; }
  get id()        { return this._socket?.id         ?? null; }

  // ── Event helpers ──────────────────────────────────────────────────────────

  /**
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe function
   */
  on(event, handler) {
    this._socket?.on(event, handler);
    return () => this._socket?.off(event, handler);
  }

  once(event, handler) { this._socket?.once(event, handler); }
  off(event, handler)  { this._socket?.off(event, handler);  }

  emit(event, payload = {}) {
    if (this._socket?.connected) {
      this._socket.emit(event, payload);
    } else {
      this._pendingEmits.push({ event, payload });
    }
  }

  // ── Room management ────────────────────────────────────────────────────────

  joinBookingRoom(bookingId) {
    if (!bookingId) return;
    this._activeBookingId = bookingId;
    this.emit(CLIENT_EVENTS.JOIN_BOOKING_ROOM, { bookingId });
  }

  leaveBookingRoom(bookingId) {
    this.emit(CLIENT_EVENTS.LEAVE_BOOKING_ROOM, {
      bookingId: bookingId ?? this._activeBookingId,
    });
    if (this._activeBookingId === bookingId) this._activeBookingId = null;
  }

  joinTpRoom(tpId)  { this.emit(CLIENT_EVENTS.JOIN_TP_ROOM,  { tpId }); }
  leaveTpRoom(tpId) { this.emit(CLIENT_EVENTS.LEAVE_TP_ROOM, { tpId }); }

  // ── Booking / ride state ───────────────────────────────────────────────────

  requestBookingState(bookingId) {
    this.emit(CLIENT_EVENTS.REQUEST_BOOKING_STATE, { bookingId });
  }

  /**
   * requestRideStops — ask server to emit ride_stops_snapshot for a ride.
   * @param {{ rideId: string }} params
   */
  requestRideStops({ rideId } = {}) {
    this.emit(CLIENT_EVENTS.REQUEST_RIDE_STOPS, { rideId });
  }

  /**
   * requestParticipants — ask server to emit participants_snapshot for a ride.
   * @param {{ rideId: string }} params
   */
  requestParticipants({ rideId } = {}) {
    this.emit(CLIENT_EVENTS.REQUEST_PARTICIPANTS, { rideId });
  }

  // ── DRIVER GPS tracking ────────────────────────────────────────────────────

  startGpsTracking({ bookingId } = {}) {
    if (!navigator?.geolocation) {
      console.warn('[Socket] Geolocation not supported');
      return;
    }
    this.stopGpsTracking();
    this._gpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh =
          pos.coords.speed != null && pos.coords.speed >= 0
            ? +(pos.coords.speed * 3.6).toFixed(1)
            : undefined;
        this.emit(CLIENT_EVENTS.DRIVER_LOCATION, {
          bookingId: bookingId ?? this._activeBookingId ?? undefined,
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          heading:   pos.coords.heading  ?? undefined,
          speed:     speedKmh,
          accuracy:  pos.coords.accuracy ?? undefined,
        });
      },
      (err) => console.error('[GPS Driver]', err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
  }

  stopGpsTracking() {
    if (this._gpsWatchId !== null) {
      navigator?.geolocation?.clearWatch(this._gpsWatchId);
      this._gpsWatchId = null;
    }
  }

  // ── CARE ASSISTANT GPS tracking ────────────────────────────────────────────

  /**
   * startCareGpsTracking — begin CA GPS watch.
   * Emits care_location event. Server broadcasts care_assistant_location_update to booking room.
   *
   * @param {{ bookingId: string, status?: string }} options
   */
  startCareGpsTracking({ bookingId, status } = {}) {
    if (!navigator?.geolocation) {
      console.warn('[Socket] Geolocation not supported');
      return;
    }
    this.stopCareGpsTracking();
    this._careGpsWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        const speedKmh =
          pos.coords.speed != null && pos.coords.speed >= 0
            ? +(pos.coords.speed * 3.6).toFixed(1)
            : undefined;
        this.emit(CLIENT_EVENTS.CARE_LOCATION, {
          bookingId: bookingId ?? this._activeBookingId ?? undefined,
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          heading:   pos.coords.heading  ?? undefined,
          speed:     speedKmh,
          accuracy:  pos.coords.accuracy ?? undefined,
          status:    status ?? undefined,
        });
      },
      (err) => console.error('[GPS Care]', err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 }
    );
  }

  stopCareGpsTracking() {
    if (this._careGpsWatchId !== null) {
      navigator?.geolocation?.clearWatch(this._careGpsWatchId);
      this._careGpsWatchId = null;
    }
  }

  /**
   * emitCareLocation — single CA location ping via socket (not continuous watch).
   * Use when component needs one-time emit without starting GPS watch.
   *
   * @param {{ bookingId?: string, lat: number, lng: number, heading?: number, speed?: number, status?: string }} params
   */
  emitCareLocation({ bookingId, lat, lng, heading, speed, status } = {}) {
    this.emit(CLIENT_EVENTS.CARE_LOCATION, {
      bookingId: bookingId ?? this._activeBookingId ?? undefined,
      lat,
      lng,
      heading:  heading ?? undefined,
      speed:    speed   ?? undefined,
      status:   status  ?? undefined,
    });
  }

  /**
   * emitLocation — generic location emit.
   * isCare=true → care_location (CA).
   * isCare=false → driver_location (driver/solo).
   *
   * @param {{ bookingId?: string, lat: number, lng: number, heading?: number, speed?: number, isCare?: boolean, status?: string }} params
   */
  emitLocation({ bookingId, lat, lng, heading, speed, isCare = false, status } = {}) {
    const event = isCare
      ? CLIENT_EVENTS.CARE_LOCATION
      : CLIENT_EVENTS.DRIVER_LOCATION;
    this.emit(event, {
      bookingId: bookingId ?? this._activeBookingId ?? undefined,
      lat,
      lng,
      heading:  heading ?? undefined,
      speed:    speed   ?? undefined,
      ...(isCare && status ? { status } : {}),
    });
  }

  /**
   * updateCareStatus — NEW. Push a CA status change (e.g. 'en_route_to_pickup',
   * 'at_pickup', 'in_ride') over the socket without necessarily sending a
   * position fix. SocketProvider.jsx exposes this on context; it was being
   * `.bind()`'d here before this method existed, which crashed on every
   * render. Piggybacks on the same `care_location` channel the server
   * already listens on (mirrors how startCareGpsTracking/emitCareLocation
   * optionally attach `status`), so no new server-side event is required.
   *
   * @param {{ bookingId?: string, status: string, lat?: number, lng?: number }} params
   */
  updateCareStatus({ bookingId, status, lat, lng } = {}) {
    this.emit(CLIENT_EVENTS.CARE_LOCATION, {
      bookingId: bookingId ?? this._activeBookingId ?? undefined,
      status,
      ...(lat != null && lng != null ? { lat, lng } : {}),
    });
  }

  // ── Driver status ──────────────────────────────────────────────────────────

  updateDriverStatus({ bookingId, rideId, status, lat, lng, meta } = {}) {
    this.emit(CLIENT_EVENTS.DRIVER_STATUS_UPDATE, {
      bookingId,
      rideId,
      status,
      lat,
      lng,
      meta,
    });
  }

  // ── OTP ────────────────────────────────────────────────────────────────────

  verifyOtp({ bookingId, rideId, otp }) {
    this.emit(CLIENT_EVENTS.VERIFY_OTP, { bookingId, rideId, otp });
  }

  requestOtpResend(bookingId) {
    this.emit(CLIENT_EVENTS.OTP_RESEND_REQUEST, { bookingId });
  }

  // ── SOS ────────────────────────────────────────────────────────────────────

  triggerSos({ bookingId, rideId, lat, lng, sosType = 'OTHER', description } = {}) {
    this.emit(CLIENT_EVENTS.SOS_TRIGGER, {
      bookingId,
      rideId,
      lat,
      lng,
      sosType,
      description,
    });
  }

  // ── Route deviation ────────────────────────────────────────────────────────

  reportRouteDeviation({ bookingId, rideId, lat, lng, deviationKm, driverReason } = {}) {
    this.emit(CLIENT_EVENTS.ROUTE_DEVIATION, {
      bookingId,
      rideId,
      lat,
      lng,
      deviationKm,
      driverReason,
    });
  }

  // ── CA join point ──────────────────────────────────────────────────────────

  /**
   * emitCaMissedJoinpoint — CA self-reports that they missed the join point.
   * Server marks JoinPoint MISSED, notifies admin.
   *
   * @param {{ bookingId: string, rideId: string, reason?: string }} params
   */
  emitCaMissedJoinpoint({ bookingId, rideId, reason } = {}) {
    this.emit(CLIENT_EVENTS.CA_MISSED_JOINPOINT, {
      bookingId,
      rideId,
      reason: reason ?? '',
    });
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  pingHealth() { this.emit(CLIENT_EVENTS.PING_HEALTH); }

  /**
   * stopAllTracking — NEW. Stop both GPS watches (driver + CA) in one call.
   * Was being `.bind()`'d in SocketProvider.jsx before this method existed.
   * Useful as a single teardown call on logout/unmount instead of having
   * every caller remember to stop both watches individually.
   */
  stopAllTracking() {
    this.stopGpsTracking();
    this.stopCareGpsTracking();
  }

  // ── Promise wrappers ───────────────────────────────────────────────────────

  /**
   * verifyOtpAsync — emit verify_otp, await otp_result event.
   * @param {{ bookingId: string, rideId: string, otp: string|number }} params
   * @param {number} timeoutMs
   * @returns {Promise<object>}
   */
  verifyOtpAsync({ bookingId, rideId, otp }, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error('Socket not initialized'));
      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.OTP_RESULT, handler);
        reject(new Error('OTP verify timeout'));
      }, timeoutMs);
      const handler = (data) => {
        if (data.rideId && data.rideId !== rideId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.OTP_RESULT, handler);
        if (data.success) resolve(data);
        else reject(new Error(data.message || 'OTP failed'));
      };
      this._socket.on(SOCKET_EVENTS.OTP_RESULT, handler);
      this.verifyOtp({ bookingId, rideId, otp });
    });
  }

  /**
   * requestBookingStateAsync — emit request_booking_state, await booking_state_snapshot.
   * @param {string} bookingId
   * @param {number} timeoutMs
   * @returns {Promise<object>}
   */
  requestBookingStateAsync(bookingId, timeoutMs = 8_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error('Socket not initialized'));
      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, handler);
        reject(new Error('State snapshot timeout'));
      }, timeoutMs);
      const handler = (data) => {
        if (data.bookingId && data.bookingId !== bookingId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, handler);
        resolve(data);
      };
      this._socket.on(SOCKET_EVENTS.BOOKING_STATE_SNAPSHOT, handler);
      this.requestBookingState(bookingId);
    });
  }

  /**
   * requestRideStopsAsync — emit request_ride_stops, await ride_stops_snapshot.
   * @param {string} rideId
   * @param {number} timeoutMs
   * @returns {Promise<object>}
   */
  requestRideStopsAsync(rideId, timeoutMs = 8_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error('Socket not initialized'));
      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.RIDE_STOPS_SNAPSHOT, handler);
        reject(new Error('Ride stops snapshot timeout'));
      }, timeoutMs);
      const handler = (data) => {
        if (data.rideId && data.rideId !== rideId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.RIDE_STOPS_SNAPSHOT, handler);
        resolve(data);
      };
      this._socket.on(SOCKET_EVENTS.RIDE_STOPS_SNAPSHOT, handler);
      this.requestRideStops({ rideId });
    });
  }

  /**
   * requestParticipantsAsync — emit request_participants, await participants_snapshot.
   * @param {string} rideId
   * @param {number} timeoutMs
   * @returns {Promise<object>}
   */
  requestParticipantsAsync(rideId, timeoutMs = 8_000) {
    return new Promise((resolve, reject) => {
      if (!this._socket) return reject(new Error('Socket not initialized'));
      const timer = setTimeout(() => {
        this._socket.off(SOCKET_EVENTS.PARTICIPANTS_SNAPSHOT, handler);
        reject(new Error('Participants snapshot timeout'));
      }, timeoutMs);
      const handler = (data) => {
        if (data.rideId && data.rideId !== rideId) return;
        clearTimeout(timer);
        this._socket.off(SOCKET_EVENTS.PARTICIPANTS_SNAPSHOT, handler);
        resolve(data);
      };
      this._socket.on(SOCKET_EVENTS.PARTICIPANTS_SNAPSHOT, handler);
      this.requestParticipants({ rideId });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

export const socketService = new SocketService();
export default socketService;