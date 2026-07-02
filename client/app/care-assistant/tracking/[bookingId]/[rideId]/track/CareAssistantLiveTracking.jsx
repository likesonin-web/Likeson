'use client';

/**
 * CareAssistantLiveTracking.jsx
 *
 * NEW FIXES this pass:
 *  E. Map pan/rotate was dead — `useMapCamera` exposes `initCameraListeners`
 *     (drag/heading listeners that flip `followModeRef` off while the user
 *     is interacting) but the page never called it. Result: every GPS tick
 *     called `updateCamera`, which only checks `followModeRef`, and since
 *     that ref never got set to false on drag, the camera snapped back to
 *     follow position on the next tick — one-finger rotate/pan looked
 *     "broken" because it was instantly overwritten. Now wired up in its
 *     own effect, with the listener cleanup returned/disposed on unmount.
 *  F. Bottom sheet is now collapsible. Tapping the handle (or the new
 *     chevron) toggles between a compact one-line bar (phase + key metric
 *     + SOS) and the full sheet (timeline, driver card, actions). State:
 *     `sheetExpanded`.
 *  G. FloatingControls anchor moved up and now reacts to sheet state, so
 *     the zoom/voice/compass stack never sits under the (expanded) sheet.
 *  H. Added a dedicated "My Location" button, distinct from "Recenter":
 *     Recenter re-engages navigation follow-mode on the tracked subject
 *     (CA or driver). My Location is a one-shot browser-geolocation pan
 *     to the *viewer's own device position* with a small blue dot marker —
 *     useful for the customer/admin viewer who wants to see where THEY
 *     are relative to the ride, not toggle follow mode.
 *
 * FIXES carried over from prior passes (#1-4, A-C) — see git history /
 * previous revision for full detail; kept intact below.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';

import { useSocket } from '@/context/SocketProvider';
import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader';
import { useMapCamera } from '@/hooks/useMapCamera';
import { useDriverMarker, createStaticMarker } from '@/hooks/useDriverMarker';
import { useCareAssistantMarker } from '@/hooks/useCareAssistantMarker';
import { useRouteRenderer } from '@/hooks/useRouteRenderer';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import { useCareAssistantTracking } from '@/hooks/useCareAssistantTracking';
import { distanceKm, formatDistance, formatEta } from '@/utils/navigationUtils';
import {
  generatePayAtServiceLink,
  fetchPayAtServiceStatus,
  markCollectedByPartner,
  linkGeneratedFromSocket,
  paidFromSocket,
  selectPayAtServiceSession,
  selectPayAtServiceLoading,
  selectMinutesUntilExpiry,
  selectIsPaid,
} from '@/store/slices/payAtServiceSlice';

// Booking types this page can show — matches backend PAY_AT_SERVICE_TYPES,
// filtered to the two types this CA tracking page ever renders.
const PAY_AT_SERVICE_BOOKING_TYPES = ['care_assistant', 'full_care_ride'];
const PAY_STATUS_POLL_MS = 5000;

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'CA_LIVE_TRACKING';
const DEFAULT_CENTER = { lat: 16.506, lng: 80.648 };
const APPROACH_ANNOUNCE_KM = 0.15; // announce once within 150m of destination

const PHASE_LABEL = {
  loading:             'Loading…',
  awaiting_assignment: 'Waiting for assignment',
  standalone:          'En route to patient',
  navigate_to_jp:       'Heading to join point',
  in_vehicle:           'In vehicle — tracking driver',
  other:                'Tracking ride',
};

// in_vehicle keys match the actual DRIVER_STATUS string enum
// (see socketService.js DRIVER_STATUS) instead of CA-side statuses that
// never get emitted once the CA is a passenger.
const STATUS_STEPS = {
  standalone: [
    { key: 'assigned',           label: 'Assigned' },
    { key: 'en_route_to_pickup', label: 'En route' },
    { key: 'at_pickup',          label: 'At patient' },
    { key: 'in_progress',        label: 'In progress' },
    { key: 'completed',          label: 'Completed' },
  ],
  navigate_to_jp: [
    { key: 'en_route_to_pickup', label: 'Heading to JP' },
    { key: 'at_pickup',          label: 'At join point' },
    { key: 'in_ride',            label: 'Boarded' },
  ],
  in_vehicle: [
    { key: 'otp_verified', label: 'Boarded' },
    { key: 'ride_started', label: 'To hospital' },
    { key: 'at_stop',      label: 'Arrived' },
    { key: 'completed',    label: 'Completed' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Local marker helper — join point flag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * createJoinPointMarker — amber flag pin for the CA's calculated join point.
 * Kept local to this page (rather than overloading createStaticMarker's
 * pickup/dropoff branch) so it can't accidentally render as a mislabeled
 * "Drop-off" pin — a real dropoff (hospital) pin can coexist on the same
 * full_care_ride booking and the two must stay visually distinct.
 */
function createJoinPointMarker(map, lat, lng) {
  if (!window.google?.maps?.marker?.AdvancedMarkerElement) return null;

  const color = '#f59e0b';
  const anchor = document.createElement('div');
  anchor.style.cssText =
    'position:absolute;width:0;height:0;overflow:visible;pointer-events:none;';
  anchor.innerHTML = `
    <div style="
        position:absolute;display:flex;flex-direction:column;align-items:center;
        left:-22px;top:-72px;pointer-events:none;">
      <div style="
          width:44px;height:44px;
          background:linear-gradient(135deg,#fbbf24,#d97706);
          border-radius:50%;border:3px solid #fff;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 6px 18px ${color}88;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M6 2v20h2v-8h9l-2-4 2-4H8V2z"/>
        </svg>
      </div>
      <div style="width:0;height:0;
           border-left:6px solid transparent;border-right:6px solid transparent;
           border-top:10px solid ${color};margin-top:-1px;"></div>
      <div style="
          background:${color};color:#fff;padding:2px 10px;border-radius:20px;
          font-size:10px;font-weight:800;letter-spacing:0.07em;text-transform:uppercase;
          white-space:nowrap;margin-top:2px;
          box-shadow:0 3px 10px rgba(0,0,0,0.25);
          font-family:system-ui,sans-serif;">Join Point</div>
    </div>
  `;

  return new window.google.maps.marker.AdvancedMarkerElement({
    map,
    content:  anchor,
    position: { lat, lng },
    zIndex:   11,
  });
}

/**
 * createMyLocationMarker — small solid blue dot + halo for the VIEWER's own
 * device position (FIX H). Visually distinct from every other marker on
 * the map (CA = purple cross, driver = blue arrow bubble, pickup/dropoff/JP
 * = flag pins) — this is just "you, the phone holding this app".
 */
function createMyLocationMarker(map, lat, lng) {
  if (!window.google?.maps?.marker?.AdvancedMarkerElement) return null;

  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:absolute;width:0;height:0;overflow:visible;pointer-events:none;';
  wrap.innerHTML = `
    <div style="position:absolute;left:-9px;top:-9px;width:18px;height:18px;
        border-radius:50%;background:#3b82f6;border:3px solid #fff;
        box-shadow:0 0 0 6px rgba(59,130,246,0.25),0 2px 6px rgba(0,0,0,0.3);"></div>
  `;

  return new window.google.maps.marker.AdvancedMarkerElement({
    map,
    content:  wrap,
    position: { lat, lng },
    zIndex:   30,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PayAtServiceCard — gates "complete" on payment, lets partner generate
// QR/link or record a cash fallback. Hidden entirely once booking is paid
// (parent only mounts this while unpaid).
//
// Permission model (per booking type):
//   care_assistant   — single partner on the booking. Only the CA themself
//                       (`canManage` = t.isSelf) can generate/collect; every
//                       other viewer (customer/admin) sees a read-only note.
//   full_care_ride   — multiple partners (driver/CA/doctor/hospital) share
//                       the booking. ANY non-customer partner viewing this
//                       page can generate the link or mark cash collected —
//                       whoever gets there first closes it out, no per-role
//                       lock. `canManage` = viewerRole !== 'customer'.
// ─────────────────────────────────────────────────────────────────────────────

function PayAtServiceCard({ bookingId, canManage }) {
  const dispatch = useDispatch();
  const session  = useSelector(selectPayAtServiceSession(bookingId));
  const loading  = useSelector(selectPayAtServiceLoading);
  const minsLeft = useSelector(selectMinutesUntilExpiry(bookingId));

  const [showCash, setShowCash]     = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [cashNote, setCashNote]     = useState('');

  // Hydrate + poll while this card is mounted (i.e. while unpaid).
  useEffect(() => {
    if (!bookingId) return undefined;
    dispatch(fetchPayAtServiceStatus({ bookingId }));
    const id = setInterval(() => dispatch(fetchPayAtServiceStatus({ bookingId })), PAY_STATUS_POLL_MS);
    return () => clearInterval(id);
  }, [bookingId, dispatch]);

  const handleGenerate = useCallback(() => {
    dispatch(generatePayAtServiceLink({ bookingId }));
  }, [dispatch, bookingId]);

  const handleCashSubmit = useCallback(() => {
    const amt = Number(cashAmount);
    if (!amt || amt <= 0) return;
    dispatch(markCollectedByPartner({ bookingId, amount: amt, method: 'cash', note: cashNote || undefined }));
    setShowCash(false);
    setCashAmount('');
    setCashNote('');
  }, [dispatch, bookingId, cashAmount, cashNote]);

  if (!canManage) {
    return (
      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
        Payment pending — service provider will collect it before marking complete.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Collect payment to complete</p>

      {!session?.shortUrl && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading.generateLink}
          className="mt-2 w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99] transition disabled:opacity-60"
        >
          {loading.generateLink ? 'Generating…' : 'Generate QR / payment link'}
        </button>
      )}

      {session?.shortUrl && (
        <div className="mt-2 flex items-center gap-3">
          {session.qrCodeDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.qrCodeDataUrl}
              alt="Scan to pay"
              className="h-20 w-20 shrink-0 rounded-lg border border-amber-200 bg-white"
            />
          )}
          <div className="min-w-0 flex-1">
            <a href={session.shortUrl} target="_blank" rel="noreferrer" className="block truncate text-xs font-medium text-violet-700 underline">
              {session.shortUrl}
            </a>
            <p className="mt-1 text-[11px] text-amber-700">
              {minsLeft == null ? '' : minsLeft > 0 ? `Expires in ${minsLeft} min` : 'Link expired — generate a new one'}
            </p>
          </div>
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {session?.shortUrl && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading.generateLink}
            className="flex-1 rounded-lg border border-amber-300 py-2 text-xs font-semibold text-amber-700 disabled:opacity-60"
          >
            {minsLeft === 0 ? 'New link' : 'Resend'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowCash((v) => !v)}
          className="flex-1 rounded-lg border border-amber-300 py-2 text-xs font-semibold text-amber-700"
        >
          Collected cash instead
        </button>
      </div>

      {showCash && (
        <div className="mt-2 space-y-2 rounded-lg bg-white p-2">
          <input
            type="number"
            inputMode="decimal"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            placeholder="Amount received (₹)"
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            value={cashNote}
            onChange={(e) => setCashNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={handleCashSubmit}
            disabled={loading.markCollected || !cashAmount}
            className="w-full rounded-md bg-amber-600 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {loading.markCollected ? 'Saving…' : 'Confirm cash collected'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational pieces
// ─────────────────────────────────────────────────────────────────────────────

function TopBar({ bookingCode, phase, onBack }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-white/95 to-white/0 backdrop-blur-sm">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md text-slate-700 active:scale-95 transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">
          {PHASE_LABEL[phase] || 'Tracking'}
        </span>
        {bookingCode && <span className="text-xs text-slate-500">#{bookingCode}</span>}
      </div>
    </div>
  );
}

// FIX G: now takes `bottomClassName` so the page can push the stack up
// when the bottom sheet is expanded (and let it settle lower when collapsed).
function FloatingControls({
  onRecenter,
  onLocateMe,
  onNorthUp,
  onZoomIn,
  onZoomOut,
  voiceEnabled,
  onToggleVoice,
  bottomClassName,
}) {
  const btn = 'flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md text-slate-700 active:scale-95 transition';
  return (
    <div className={`absolute right-3 z-20 flex flex-col gap-2 transition-[bottom] duration-200 ${bottomClassName}`}>
      <button type="button" className={btn} onClick={onToggleVoice} aria-label="Toggle voice announcements">
        {voiceEnabled ? '🔊' : '🔇'}
      </button>
      <button type="button" className={btn} onClick={onZoomIn} aria-label="Zoom in">+</button>
      <button type="button" className={btn} onClick={onZoomOut} aria-label="Zoom out">−</button>
      <button type="button" className={btn} onClick={onNorthUp} aria-label="Reset to north-up">⟲</button>
      {/* FIX H: separate one-shot "where am I" pin, distinct from Recenter's
          navigation-follow behavior below. */}
      <button type="button" className={btn} onClick={onLocateMe} aria-label="Show my location">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onRecenter}
        aria-label="Recenter map"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg active:scale-95 transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" /></svg>
      </button>
    </div>
  );
}

function Banner({ tone = 'warning', children }) {
  const tones = {
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger:  'bg-red-50 text-red-700 border-red-200',
    info:    'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <div className={`absolute top-16 left-3 right-3 z-20 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

function StatusTimeline({ steps, activeKey }) {
  const activeIdx = Math.max(0, steps.findIndex((s) => s.key === activeKey));
  return (
    <div className="flex items-center w-full px-1">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                i <= activeIdx ? 'bg-violet-600' : 'bg-slate-200'
              }`}
            />
            <span className={`text-[10px] whitespace-nowrap ${i <= activeIdx ? 'text-violet-700 font-medium' : 'text-slate-400'}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 ${i < activeIdx ? 'bg-violet-600' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function SosSheet({ onConfirm, onCancel }) {
  const [type, setType] = useState('SAFETY');
  const [note, setNote] = useState('');
  const TYPES = [
    { key: 'SAFETY',            label: 'Safety concern' },
    { key: 'MEDICAL',           label: 'Medical emergency' },
    { key: 'PATIENT_CONDITION', label: 'Patient condition' },
    { key: 'OTHER',             label: 'Other' },
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">Send an SOS alert</h3>
        <p className="mt-1 text-sm text-slate-500">Admins are notified immediately. Only use this for a real emergency.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                type === t.key ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional details"
          rows={2}
          className="mt-3 w-full resize-none rounded-lg border border-slate-200 p-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(type, note)}
            className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
          >
            Send SOS
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{ rideId?: string, bookingType?: string }} props
 */
export default function CareAssistantLiveTracking({ rideId, bookingType: bookingTypeProp }) {
  const params = useParams();
  const bookingId = params?.bookingId; // matches [bookingId] folder segment

  // Single role source — SocketProvider context, fed by the `role` prop
  // TrackPage already passed into <SocketProvider>. Also pulls `on` here so
  // this page can listen for pay-at-service socket events directly (booking
  // room is already joined by useCareAssistantTracking below).
  const { role: viewerRole, on } = useSocket();
  const dispatch = useDispatch();
  const isPaid = useSelector(selectIsPaid(bookingId));

  const { loaded: mapsLoaded, error: mapsError } = useGoogleMapsLoader();

  const mapContainerRef = useRef(null);
  const mapRef           = useRef(null);
  const mapLoadedRef      = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [showSos, setShowSos]   = useState(false);
  // FIX F: bottom sheet collapse/expand state.
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const announcedRef = useRef(false);
  // guards caMarker.destroyMarker() so it only fires once on the
  // standalone/navigate_to_jp -> in_vehicle transition, not on every tick.
  const caMarkerDestroyedRef = useRef(false);
  // FIX H: "my location" one-shot marker for the viewer's own device.
  const myLocationMarkerRef = useRef(null);

  // ── 1. Create the map once the SDK + container are both ready ────────────
  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || mapRef.current) return;
    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 14,
      mapId: MAP_ID,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
    });
    mapLoadedRef.current = true;
    setMapReady(true);
  }, [mapsLoaded]);

  // ── 2. Map-bound hooks ─────────────────────────────────────────────────────
  const camera     = useMapCamera(mapRef);
  const caMarker   = useCareAssistantMarker(mapRef, mapLoadedRef);
  const drvMarker  = useDriverMarker(mapRef, mapLoadedRef);
  const routes     = useRouteRenderer(mapRef);
  const voice      = useVoiceNavigation();

  // FIX E: wire up drag/heading listeners so user pan/rotate actually
  // disengages follow-mode. Without this, `followModeRef` never flips to
  // false on drag, and the very next GPS-tick `updateCamera()` call snaps
  // the map straight back — every manual rotate/pan looked like it was
  // being ignored. Listeners are torn down on unmount / map swap.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return undefined;
    return camera.initCameraListeners(mapRef.current);
  }, [mapReady, camera.initCameraListeners]);

  // Pay-at-service socket sync — booking room already joined by
  // useCareAssistantTracking below, just listen for these two events here
  // so the QR card / paid-state update live without a poll round-trip.
  useEffect(() => {
    if (!bookingId) return undefined;
    const unsubLink = on('pay_at_service_link_generated', (data) => {
      if (String(data?.bookingId) !== String(bookingId)) return;
      dispatch(linkGeneratedFromSocket({
        bookingId: String(bookingId), shortUrl: data.shortUrl, amount: data.amount, expiresAt: data.expiresAt,
      }));
    });
    const unsubPaid = on('pay_at_service_paid', (data) => {
      if (String(data?.bookingId) !== String(bookingId)) return;
      dispatch(paidFromSocket({
        bookingId: String(bookingId), amount: data.amount, paidAt: data.paidAt, canMarkComplete: data.canMarkComplete,
      }));
    });
    return () => { unsubLink?.(); unsubPaid?.(); };
  }, [on, dispatch, bookingId]);

  // ── 3. Data + sockets ──────────────────────────────────────────────────────
  const t = useCareAssistantTracking({ bookingId, viewerRole });

  // A one-time announcement made in one phase shouldn't permanently block
  // the equivalent announcement in a later phase.
  useEffect(() => { announcedRef.current = false; }, [t.phase]);

  // ── Static markers: patient pickup, hospital dropoff, join point ─────────
  const staticRef = useRef({ patient: null, dropoff: null, joinPoint: null });
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const pickupCoords = t.pickupLocation?.coordinates;
    if (pickupCoords?.length === 2 && !staticRef.current.patient) {
      staticRef.current.patient = createStaticMarker(map, pickupCoords[1], pickupCoords[0], 'pickup');
    }

    if (t.bookingType === 'full_care_ride') {
      const dropCoords = t.dropoffLocation?.coordinates;
      if (dropCoords?.length === 2 && !staticRef.current.dropoff) {
        staticRef.current.dropoff = createStaticMarker(map, dropCoords[1], dropCoords[0], 'dropoff');
      }
    }

    const jpCoords = t.caJoinPoint?.coordinates;
    if (jpCoords?.length === 2 && t.phase === 'navigate_to_jp') {
      // Dedicated join-point marker, not createStaticMarker's pickup/dropoff
      // branch (which would mislabel it "Drop-off").
      if (staticRef.current.joinPoint) staticRef.current.joinPoint.map = null;
      staticRef.current.joinPoint = createJoinPointMarker(map, jpCoords[1], jpCoords[0]);
    }
  }, [mapReady, t.pickupLocation, t.dropoffLocation, t.bookingType, t.caJoinPoint, t.phase]);

  // Join point marker must disappear once the CA boards — it's no longer
  // relevant once we switch to driver-tracking mode.
  useEffect(() => {
    if (t.phase === 'in_vehicle' && staticRef.current.joinPoint) {
      staticRef.current.joinPoint.map = null;
      staticRef.current.joinPoint = null;
    }
  }, [t.phase]);

  // ── Request the CA's own route once (origin -> JP, or origin -> patient) ─
  const caRouteRequestedRef = useRef(false);
  useEffect(() => {
    if (!mapReady || caRouteRequestedRef.current) return;
    if (t.phase !== 'navigate_to_jp' && t.phase !== 'standalone') return;

    const origin = t.currentPosition || (t.caLiveLocation
      ? { lat: t.caLiveLocation.lat, lng: t.caLiveLocation.lng }
      : null);
    const destCoords = t.phase === 'navigate_to_jp' ? t.caJoinPoint?.coordinates : t.pickupLocation?.coordinates;
    if (!origin || !destCoords?.length) return;

    caRouteRequestedRef.current = true;
    const svc = new window.google.maps.DirectionsService();
    svc.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destCoords[1], lng: destCoords[0] },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') routes.setCaRoute(result);
        else caRouteRequestedRef.current = false; // allow retry on next position tick
      }
    );
  }, [mapReady, t.phase, t.currentPosition, t.caLiveLocation, t.caJoinPoint, t.pickupLocation, routes]);

  // A recalculated join point invalidates the drawn route — clear the
  // "already requested" flag so the effect above fires again.
  const lastJpKeyRef = useRef(null);
  useEffect(() => {
    const key = t.caJoinPoint?.coordinates ? t.caJoinPoint.coordinates.join(',') : null;
    if (key && key !== lastJpKeyRef.current) {
      lastJpKeyRef.current = key;
      caRouteRequestedRef.current = false;
      routes.clearCaRoute();
    }
  }, [t.caJoinPoint, routes]);

  // ── Render driver route from the server-canonical polyline once boarded ──
  const driverRouteAppliedRef = useRef(false);
  useEffect(() => {
    if (t.phase !== 'in_vehicle' || !mapReady) return;
    if (!t.expectedPolyline || driverRouteAppliedRef.current) return;
    driverRouteAppliedRef.current = true;
    routes.setRouteFromPolyline(t.expectedPolyline, 'toDropoff');
  }, [t.phase, t.expectedPolyline, mapReady, routes]);

  // ── Drive the markers + camera + route progress off live position ────────
  useEffect(() => {
    if (!mapReady) return;

    if (t.phase === 'navigate_to_jp' || t.phase === 'standalone') {
      caMarkerDestroyedRef.current = false; // back in a CA-marker phase — allow future destroy
      const pos = t.isSelf ? t.currentPosition : t.caLiveLocation;
      if (pos?.lat && pos?.lng) {
        caMarker.updateMarker(pos.lat, pos.lng, pos.heading || 0, camera.mapBearingRef.current, t.caStatus);
        routes.updateCaProgress(pos.lat, pos.lng);
        if (camera.followModeRef.current) {
          camera.updateCamera(pos.lat, pos.lng, pos.heading || 0, pos.speed || 0);
        }

        // One-time proximity announcement
        const destCoords = t.phase === 'navigate_to_jp' ? t.caJoinPoint?.coordinates : t.pickupLocation?.coordinates;
        if (destCoords?.length === 2 && !announcedRef.current) {
          const distKm = distanceKm(pos.lat, pos.lng, destCoords[1], destCoords[0]);
          if (distKm <= APPROACH_ANNOUNCE_KM) {
            announcedRef.current = true;
            voice.speak(
              t.phase === 'navigate_to_jp' ? 'You are approaching the join point.' : 'You are approaching the patient location.',
              { priority: voice.PRIORITY.HIGH }
            );
          }
        }
      }
    }

    if (t.phase === 'in_vehicle') {
      // Only destroy once on the transition into this phase.
      if (!caMarkerDestroyedRef.current) {
        caMarker.destroyMarker();
        caMarkerDestroyedRef.current = true;
      }
      const pos = t.driverLiveLocation;
      if (pos?.lat && pos?.lng) {
        drvMarker.updateMarker(pos.lat, pos.lng, pos.heading || 0, camera.mapBearingRef.current, pos.speedKmh || pos.speed || 0);
        routes.updateProgress(pos.lat, pos.lng);
        if (camera.followModeRef.current) {
          camera.updateCamera(pos.lat, pos.lng, pos.heading || 0, pos.speedKmh || pos.speed || 0);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, t.phase, t.currentPosition, t.caLiveLocation, t.driverLiveLocation, t.caStatus]);

  // Clean up the "my location" marker on unmount.
  useEffect(() => () => {
    if (myLocationMarkerRef.current) {
      myLocationMarkerRef.current.map = null;
      myLocationMarkerRef.current = null;
    }
  }, []);

  // ── Derived UI bits ───────────────────────────────────────────────────────
  const steps = STATUS_STEPS[t.phase] || [];
  // Once boarded, caStatus stops being meaningful (CA is now a passenger) —
  // drive the timeline off rideStatus instead for in_vehicle.
  const activeStepKey = t.phase === 'in_vehicle'
    ? (t.rideStatus || t.caStatus)
    : (t.caStatus || t.rideStatus);

  const distToDestKm = useMemo(() => {
    const pos = t.isSelf ? t.currentPosition : t.caLiveLocation;
    const destCoords = t.phase === 'navigate_to_jp' ? t.caJoinPoint?.coordinates : t.pickupLocation?.coordinates;
    if (!pos?.lat || !destCoords?.length) return null;
    return distanceKm(pos.lat, pos.lng, destCoords[1], destCoords[0]);
  }, [t.isSelf, t.currentPosition, t.caLiveLocation, t.phase, t.caJoinPoint, t.pickupLocation]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined') window.history.back();
  }, []);

  const handleSosConfirm = useCallback((sosType, description) => {
    t.actions.sos(sosType, description);
    setShowSos(false);
  }, [t.actions]);

  const handlePrimaryAction = useCallback(() => {
    const pos = t.currentPosition;
    if (t.phase === 'navigate_to_jp') {
      if (!t.caAtJoinPoint) t.actions.reachedJoinPoint(pos?.lat, pos?.lng);
      else t.actions.boardVehicle(pos?.lat, pos?.lng);
      return;
    }
    if (t.phase === 'standalone') {
      if (t.caStatus === 'en_route_to_pickup' || !t.caStatus) t.actions.markArrived();
      else if (t.caStatus === 'at_pickup' || t.rideStatus === 'confirmed') t.actions.startTask();
      else t.actions.completeTask();
    }
  }, [t.phase, t.caAtJoinPoint, t.currentPosition, t.caStatus, t.rideStatus, t.actions]);

  const primaryLabel = useMemo(() => {
    if (t.phase === 'navigate_to_jp') return t.caAtJoinPoint ? "I've boarded the vehicle" : "I've reached the join point";
    if (t.phase === 'standalone') {
      if (t.caStatus === 'at_pickup') return 'Start task';
      if (t.caStatus === 'in_progress' || t.rideStatus === 'in_progress') return 'Mark task complete';
      return "I've arrived";
    }
    return null;
  }, [t.phase, t.caAtJoinPoint, t.caStatus, t.rideStatus]);

  // FIX H: one-shot browser-geolocation pan to the viewer's own device
  // position. Deliberately does NOT touch followModeRef/camera follow-mode —
  // this is "where am I", not "resume navigation".
  const handleLocateMe = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const map = mapRef.current;
        if (!map) return;
        map.moveCamera({ center: { lat, lng }, zoom: Math.max(map.getZoom() || 14, 16) });
        if (myLocationMarkerRef.current) myLocationMarkerRef.current.map = null;
        myLocationMarkerRef.current = createMyLocationMarker(map, lat, lng);
      },
      () => { /* permission denied / unavailable — silently no-op, controls stay usable */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 }
    );
  }, []);

  // FIX I (pay-at-service): before the FINAL completion step, an unpaid
  // booking of a type that supports pay-at-service must be settled first.
  //   care_assistant  — only the CA themself can collect/generate (single
  //                     partner on the booking).
  //   full_care_ride  — any non-customer partner viewing this page may
  //                     collect; whichever partner gets there first closes
  //                     it, no per-role lock (driver/CA/doctor/hospital all
  //                     hit the same authorize() list server-side).
  const payAtServiceApplies      = PAY_AT_SERVICE_BOOKING_TYPES.includes(t.bookingType);
  const needsPaymentBeforeComplete = payAtServiceApplies && !isPaid;
  const canManagePayment = t.bookingType === 'care_assistant'
    ? t.isSelf
    : t.bookingType === 'full_care_ride'
      ? viewerRole !== 'customer'
      : false;
  // Only the LAST step of the standalone flow ("Mark task complete") is
  // payment-gated — "I've arrived" / "Start task" proceed regardless.
  const primaryGatedByPayment = needsPaymentBeforeComplete && primaryLabel === 'Mark task complete';

  // FIX G: floating controls sit higher when the sheet is expanded (more
  // sheet height to clear) and settle lower when it's collapsed to a bar.
  const controlsBottomClass = sheetExpanded ? 'bottom-64' : 'bottom-28';

  // ── Render ──────────────────────────────────────────────────────────────
  if (!bookingId) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Missing booking id.</div>;
  }

  if (mapsError) {
    return <div className="flex h-screen items-center justify-center px-6 text-center text-red-600">{mapsError}</div>;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-100">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {!mapReady && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            <span className="text-sm text-slate-500">Loading map…</span>
          </div>
        </div>
      )}

      <TopBar bookingCode={t.snapshot?.bookingCode} phase={t.phase} onBack={handleBack} />

      {t.isOffline && <Banner tone="warning">You're offline — last known position shown.</Banner>}
      {!t.isOffline && t.gpsError && <Banner tone="warning">{t.gpsError}</Banner>}
      {!t.isOffline && !t.gpsError && t.loadError && <Banner tone="danger">{t.loadError}</Banner>}
      {t.hasActiveSos && <Banner tone="danger">SOS active on this ride — admin has been notified.</Banner>}

      {mapReady && (
        <FloatingControls
          bottomClassName={controlsBottomClass}
          onRecenter={() => {
            const pos = t.phase === 'in_vehicle' ? t.driverLiveLocation : (t.isSelf ? t.currentPosition : t.caLiveLocation);
            if (pos?.lat) camera.recenter(pos.lat, pos.lng);
          }}
          onLocateMe={handleLocateMe}
          onNorthUp={camera.resetToNorth}
          onZoomIn={camera.zoomIn}
          onZoomOut={camera.zoomOut}
          voiceEnabled={voice.voiceEnabled}
          onToggleVoice={voice.toggleVoice}
        />
      )}

      {/* ── Bottom sheet ─────────────────────────────────────────────────── */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl bg-white px-5 pb-6 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-[padding] duration-200 ${
          sheetExpanded ? 'pt-4' : 'pt-2'
        }`}
      >
        {/* Handle / collapse-expand toggle — FIX F */}
        <button
          type="button"
          onClick={() => setSheetExpanded((v) => !v)}
          aria-label={sheetExpanded ? 'Collapse details' : 'Expand details'}
          aria-expanded={sheetExpanded}
          className="mx-auto mb-3 flex w-full flex-col items-center gap-1 py-1"
        >
          <span className="h-1 w-10 rounded-full bg-slate-200" />
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={`text-slate-400 transition-transform duration-200 ${sheetExpanded ? '' : 'rotate-180'}`}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {t.phase === 'awaiting_assignment' ? (
          sheetExpanded && (
            <p className="py-4 text-center text-sm text-slate-500">Waiting for a ride to be assigned to this booking…</p>
          )
        ) : !sheetExpanded ? (
          // Collapsed: compact single-row summary, always-visible SOS.
          <div className="flex items-center justify-between gap-3 pb-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{PHASE_LABEL[t.phase] || 'Tracking'}</p>
              <p className="text-xs text-slate-500">
                {t.phase === 'in_vehicle' ? `ETA ${formatEta(t.etaMinutes)}` : `${formatDistance(distToDestKm)} away`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSos(true)}
              className="shrink-0 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 active:scale-[0.99] transition"
            >
              SOS
            </button>
          </div>
        ) : (
          <>
            {steps.length > 0 && <StatusTimeline steps={steps} activeKey={activeStepKey} />}

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {t.phase === 'in_vehicle' ? 'Driver ETA' : 'Distance remaining'}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {t.phase === 'in_vehicle' ? formatEta(t.etaMinutes) : formatDistance(distToDestKm)}
                </p>
              </div>
              {t.phase !== 'in_vehicle' && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-400">ETA</p>
                  <p className="text-lg font-semibold text-slate-900">{formatEta(t.etaMinutes)}</p>
                </div>
              )}
            </div>

            {t.driverSnapshot && t.phase !== 'standalone' && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.driverSnapshot.legalName || t.driverSnapshot.name}</p>
                  <p className="text-xs text-slate-500">{t.vehicleSnapshot?.registrationNumber || 'Vehicle assigned'}</p>
                </div>
                {t.driverSnapshot.phone && (
                  <a href={`tel:${t.driverSnapshot.phone}`} className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Call
                  </a>
                )}
              </div>
            )}

            {/* Pay-at-service — shown only while unpaid, hides itself the
                moment `isPaid` flips true (booking re-fetch / socket). */}
            {needsPaymentBeforeComplete && (
              <PayAtServiceCard bookingId={bookingId} canManage={canManagePayment} />
            )}

            <div className="mt-4 flex gap-2">
              {t.isSelf && primaryLabel && (
                <button
                  type="button"
                  onClick={primaryGatedByPayment ? undefined : handlePrimaryAction}
                  disabled={primaryGatedByPayment}
                  title={primaryGatedByPayment ? 'Collect payment above before completing' : undefined}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold text-white transition ${
                    primaryGatedByPayment
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-violet-600 active:scale-[0.99]'
                  }`}
                >
                  {primaryGatedByPayment ? 'Collect payment first' : primaryLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSos(true)}
                className={`rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 active:scale-[0.99] transition ${
                  t.isSelf && primaryLabel ? '' : 'flex-1'
                }`}
              >
                SOS
              </button>
            </div>
          </>
        )}
      </div>


      {showSos && <SosSheet onConfirm={handleSosConfirm} onCancel={() => setShowSos(false)} />}
    </div>
  );
}