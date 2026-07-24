'use client';

/**
 * LiveTrackingPanel.jsx — Likeson.in
 *
 * CANONICAL ROUTE PRINCIPLE:
 *   estimatedDistanceKm / estimatedDurationMin → locked in Ride DB at creation.
 *   expectedRoutePolyline → locked in RideTracking DB at creation.
 *   ALL roles see SAME route from DB. Live driver GPS overlaid on top.
 *   Zero client-side distance recalculation.
 *
 * FULLSCREEN (locked):
 *   - Map fills entire viewport as background
 *   - Top-left floating panel: MAP_LAYERS toolbar + Lock/Unlock button
 *   - Bottom-right floating button: opens/closes panel with Map/Waypoints/Timeline/Stats tabs
 *   - Both panels closed by default, toggleable
 *
 * NORMAL (unlocked):
 *   - Standard card layout
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map, Wifi, WifiOff, ExternalLink, Radio, Clock,
  MapPin, Car, AlertTriangle, AlertCircle, Navigation,
  RotateCcw, Activity, CheckCircle, Lock, Unlock,
  Layers, Train, TrafficCone, Bike, Mountain, Eye,
  Flame, Wind, Timer, Ruler, Satellite, GitCompare, X,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import API from '@/store/api';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '';

const ACTIVE_STATUSES = new Set([
  'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived', 'otp_verified', 'in_progress', 'at_stop',
]);

const MILESTONE_LABELS = {
  ride_created:           'Ride created',
  driver_search_started:  'Driver search started',
  driver_assigned:        'Driver assigned',
  driver_accepted:        'Driver accepted',
  driver_en_route:        'Driver en route',
  driver_arrived:         'Driver arrived',
  otp_verified:           'OTP verified',
  ride_started:           'Ride started',
  stop_reached:           'Stop reached',
  stop_departed:          'Stop departed',
  hospital_arrived:       'Hospital arrived',
  patient_handed_over:    'Patient handed over',
  care_assistant_joined:  'Care assistant joined',
  consultation_started:   'Consultation started',
  consultation_completed: 'Consultation completed',
  pharmacy_collected:     'Pharmacy collected',
  return_ride_started:    'Return ride started',
  patient_home_reached:   'Patient home reached',
  vehicle_breakdown:      'Vehicle breakdown',
  driver_replaced:        'Driver replaced',
  route_deviated:         'Route deviation',
  sos_triggered:          'SOS triggered',
  ride_paused:            'Ride paused',
  ride_resumed:           'Ride resumed',
  ride_completed:         'Ride completed',
  ride_cancelled:         'Ride cancelled',
};

// Only layers supported by Google Maps JS API natively
const MAP_LAYERS = [
  { id: 'satellite',  label: 'Satellite',   icon: Satellite,   type: 'maptype',  value: 'hybrid' },
  { id: 'terrain',    label: 'Terrain',     icon: Mountain,    type: 'maptype',  value: 'terrain' },
  { id: 'traffic',    label: 'Traffic',     icon: TrafficCone, type: 'overlay',  value: 'traffic' },
  { id: 'transit',    label: 'Transit',     icon: Train,       type: 'overlay',  value: 'transit' },
  { id: 'biking',     label: 'Biking',      icon: Bike,        type: 'overlay',  value: 'biking' },
  { id: 'streetview', label: 'Street View', icon: Eye,         type: 'streetview' },
  { id: 'measure',    label: 'Measure',     icon: Ruler,       type: 'measure' },
  { id: 'compare',    label: 'Compare',     icon: GitCompare,  type: 'compare' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

const coordsStr = (c) =>
  Array.isArray(c) && c.length === 2
    ? `${Number(c[1]).toFixed(5)}, ${Number(c[0]).toFixed(5)}`
    : '—';

function decodePolyline(encoded) {
  if (!encoded) return [];
  let index = 0, lat = 0, lng = 0;
  const result = [];
  while (index < encoded.length) {
    let b, shift = 0, result2 = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result2 |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result2 & 1) ? ~(result2 >> 1) : result2 >> 1;
    shift = 0; result2 = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result2 |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result2 & 1) ? ~(result2 >> 1) : result2 >> 1;
    result.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return result;
}

let _gmapsPromise = null;
function loadGMaps() {
  if (_gmapsPromise) return _gmapsPromise;
  _gmapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) { resolve(window.google.maps); return; }
    const s = document.createElement('script');
    s.src     = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=geometry&loading=async`;
    s.async   = true;
    s.onload  = () => resolve(window.google.maps);
    s.onerror = () => { _gmapsPromise = null; reject(new Error('Maps load failed')); };
    document.head.appendChild(s);
  });
  return _gmapsPromise;
}

async function fetchTrackingData(rideId) {
  try {
    const { data } = await API.get(`/rides/${rideId}/tracking`);
    return data?.data ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      className="shrink-0" style={{ animation: 'ltp-spin 1s linear infinite' }}>
      <style>{`@keyframes ltp-spin{to{transform:rotate(360deg)}}`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor"
        strokeWidth="2.5" strokeDasharray="31.4" strokeDashoffset="10" strokeLinecap="round" />
    </svg>
  );
}

function InfoRow({ label, value, mono, highlight }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">
        {label}
      </span>
      <span className={`text-xs truncate ${mono ? 'font-mono' : ''} ${highlight ? 'text-primary font-bold' : 'text-base-content'}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function SectionTitle({ icon: Icon, label, count }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <Icon size={12} className="text-base-content/40 flex-shrink-0" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
        {label}
      </span>
      {count != null && (
        <span className="ml-auto text-[10px] bg-base-300/60 px-1.5 py-0.5 rounded-full text-base-content/50 font-semibold">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ icon: Icon = Car, text = 'No data' }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-2 text-base-content/25">
      <Icon size={28} strokeWidth={1} />
      <p className="text-xs font-medium">{text}</p>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold transition-all duration-150 ${
        active
          ? 'bg-primary text-primary-content shadow-sm'
          : 'text-base-content/60 hover:text-base-content hover:bg-base-200'
      }`}
    >
      <Icon size={12} />
      {label}
      {dot && (
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP CANVAS
// ─────────────────────────────────────────────────────────────────────────────

function MapCanvas({ booking, tracking, mapRoutePolyline, liveLocation, activeLayers, style }){
  const mapRef         = useRef(null);
  const mapObj         = useRef(null);
  const routeRef       = useRef(null);
  const driverRef      = useRef(null);
  const pickupRef      = useRef(null);
  const dropRef        = useRef(null);
  const stopRefs       = useRef([]);
  const trafficRef     = useRef(null);
  const transitRef     = useRef(null);
  const bikingRef      = useRef(null);
  const svPanoRef      = useRef(null);
  const svContainerRef = useRef(null);
  const measureRef     = useRef(null);
  const measurePtsRef  = useRef([]);
  const measureMarkRef = useRef([]);

  const [loading, setLoading]       = useState(true);
  const [error,   setError]         = useState(false);
  const [svOpen,  setSvOpen]        = useState(false);
  const [measureDist, setMeasureDist] = useState(null);
  const [mapView, setMapView]       = useState(null); // { center, zoom } — synced from map events, never read from ref during render

  const pickupCoords  = booking?.patientLocation?.coordinates;
  const dropoffCoords = booking?.destinationLocation?.coordinates;
const polylineStr = tracking?.expectedRoutePolyline ?? mapRoutePolyline ?? null;

  useEffect(() => {
    if (!GMAPS_KEY) { setLoading(false); setError(true); return; }
    if (!mapRef.current) return;

    loadGMaps()
      .then((maps) => {
        setLoading(false);
        if (!mapRef.current) return;

        const defaultLat = pickupCoords ? pickupCoords[1] : 16.506;
        const defaultLng = pickupCoords ? pickupCoords[0] : 80.648;

        const map = new maps.Map(mapRef.current, {
          center:            { lat: defaultLat, lng: defaultLng },
          zoom:              13,
          disableDefaultUI:  true,
          zoomControl:       true,
          fullscreenControl: false,
          mapTypeControl:    false,
          streetViewControl: false,
          styles: [
            { featureType: 'poi',      stylers: [{ visibility: 'off' }] },
            { featureType: 'transit',  stylers: [{ visibility: 'off' }] },
            { featureType: 'road.local', elementType: 'labels',
              stylers: [{ visibility: 'simplified' }] },
          ],
        });
        mapObj.current = map;
        setMapView({ center: map.getCenter(), zoom: map.getZoom() });
        map.addListener('idle', () => {
          setMapView({ center: map.getCenter(), zoom: map.getZoom() });
        });

        if (polylineStr) {
          const path = decodePolyline(polylineStr);
          routeRef.current = new maps.Polyline({
            path,
            map,
            strokeColor:   '#4f46e5',
            strokeWeight:  4,
            strokeOpacity: 0.88,
            zIndex:        2,
          });
          const bounds = new maps.LatLngBounds();
          path.forEach((p) => bounds.extend(p));
          map.fitBounds(bounds, 48);
        } else if (pickupCoords && dropoffCoords) {
          const bounds = new maps.LatLngBounds();
          bounds.extend({ lat: pickupCoords[1],  lng: pickupCoords[0] });
          bounds.extend({ lat: dropoffCoords[1], lng: dropoffCoords[0] });
          map.fitBounds(bounds, 48);
        }

        if (pickupCoords) {
          pickupRef.current = new maps.Marker({
            position: { lat: pickupCoords[1], lng: pickupCoords[0] },
            map, title: 'Pickup', zIndex: 5,
            icon: {
              path: maps.SymbolPath.CIRCLE, scale: 10,
              fillColor: '#10b981', fillOpacity: 1,
              strokeColor: '#fff', strokeWeight: 2.5,
            },
            label: { text: 'P', color: '#fff', fontSize: '9px', fontWeight: 'bold' },
          });
        }

        if (dropoffCoords) {
          dropRef.current = new maps.Marker({
            position: { lat: dropoffCoords[1], lng: dropoffCoords[0] },
            map, title: 'Drop-off', zIndex: 5,
            icon: {
              path: maps.SymbolPath.CIRCLE, scale: 10,
              fillColor: '#ef4444', fillOpacity: 1,
              strokeColor: '#fff', strokeWeight: 2.5,
            },
            label: { text: 'D', color: '#fff', fontSize: '9px', fontWeight: 'bold' },
          });
        }

        const stops = booking?.primaryRide?.stops ?? [];
        stopRefs.current = stops
          .filter((s) => s.location?.coordinates)
          .map((s) => new maps.Marker({
            position: { lat: s.location.coordinates[1], lng: s.location.coordinates[0] },
            map, title: `Stop ${s.sequence}`, zIndex: 4,
            icon: {
              path: maps.SymbolPath.CIRCLE, scale: 8,
              fillColor: '#f59e0b', fillOpacity: 1,
              strokeColor: '#fff', strokeWeight: 2,
            },
            label: { text: `${s.sequence}`, color: '#fff', fontSize: '9px', fontWeight: 'bold' },
          }));

        if (liveLocation?.lat && liveLocation?.lng) {
          driverRef.current = new maps.Marker({
            position: { lat: liveLocation.lat, lng: liveLocation.lng },
            map, title: 'Driver', zIndex: 10,
            icon: {
              path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6,
              fillColor: '#4f46e5', fillOpacity: 1,
              strokeColor: '#fff', strokeWeight: 2,
              rotation: liveLocation.heading ?? 0,
            },
          });
        }

        trafficRef.current = new maps.TrafficLayer();
        transitRef.current = new maps.TransitLayer();
        bikingRef.current  = new maps.BicyclingLayer();
      })
      .catch(() => { setLoading(false); setError(true); });

    return () => {
      routeRef.current?.setMap(null);
      driverRef.current?.setMap(null);
      pickupRef.current?.setMap(null);
      dropRef.current?.setMap(null);
      stopRefs.current.forEach((m) => m?.setMap(null));
      trafficRef.current?.setMap(null);
      transitRef.current?.setMap(null);
      bikingRef.current?.setMap(null);
      measureRef.current?.setMap(null);
      measureMarkRef.current.forEach((m) => m?.setMap(null));
      mapObj.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapObj.current || !liveLocation?.lat || !liveLocation?.lng) return;
    const maps = window.google?.maps;
    if (!maps) return;
    const pos  = { lat: liveLocation.lat, lng: liveLocation.lng };
    const icon = {
      path: maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 6,
      fillColor: '#4f46e5', fillOpacity: 1,
      strokeColor: '#fff', strokeWeight: 2,
      rotation: liveLocation.heading ?? 0,
    };
    if (driverRef.current) {
      driverRef.current.setPosition(pos);
      driverRef.current.setIcon(icon);
    } else {
      driverRef.current = new maps.Marker({ position: pos, map: mapObj.current, title: 'Driver', zIndex: 10, icon });
    }
  }, [liveLocation?.lat, liveLocation?.lng, liveLocation?.heading]);

  useEffect(() => {
    const map  = mapObj.current;
    const maps = window.google?.maps;
    if (!map || !maps) return;

    if (activeLayers.has('satellite')) map.setMapTypeId('hybrid');
    else if (activeLayers.has('terrain')) map.setMapTypeId('terrain');
    else map.setMapTypeId('roadmap');

    trafficRef.current?.setMap(activeLayers.has('traffic') ? map : null);
    transitRef.current?.setMap(activeLayers.has('transit') ? map : null);
    bikingRef.current?.setMap(activeLayers.has('biking')   ? map : null);

    if (activeLayers.has('streetview')) {
      const center = map.getCenter();
      if (center && !svPanoRef.current && svContainerRef.current) {
        svPanoRef.current = new maps.StreetViewPanorama(svContainerRef.current, {
          position: center, pov: { heading: 165, pitch: 0 },
          visible: true, disableDefaultUI: true, zoomControl: false,
        });
        map.setStreetView(svPanoRef.current);
      }
      setSvOpen(true);
    } else {
      if (svPanoRef.current) {
        svPanoRef.current.setVisible(false);
        map.setStreetView(null);
        svPanoRef.current = null;
      }
      setSvOpen(false);
    }

    if (activeLayers.has('measure')) {
      if (!measureRef.current) {
        measureRef.current = new maps.Polyline({
          map, path: [],
          strokeColor: '#f59e0b', strokeWeight: 2.5, strokeOpacity: 0.9, zIndex: 20,
        });
      }
      map.setOptions({ draggableCursor: 'crosshair' });
      const listener = map.addListener('click', (e) => {
        const pt = e.latLng;
        measurePtsRef.current.push(pt);
        measureRef.current.getPath().push(pt);
        const dot = new maps.Marker({
          position: pt, map,
          icon: { path: maps.SymbolPath.CIRCLE, scale: 4, fillColor: '#f59e0b', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1.5 },
          zIndex: 21,
        });
        measureMarkRef.current.push(dot);
        if (measurePtsRef.current.length > 1) {
          let total = 0;
          for (let i = 1; i < measurePtsRef.current.length; i++) {
            total += maps.geometry.spherical.computeDistanceBetween(
              measurePtsRef.current[i - 1], measurePtsRef.current[i],
            );
          }
          setMeasureDist((total / 1000).toFixed(2));
        }
      });
      measureRef.current._listener = listener;
    } else {
      if (measureRef.current) {
        if (measureRef.current._listener) {
          maps.event.removeListener(measureRef.current._listener);
          measureRef.current._listener = null;
        }
        measureRef.current.setMap(null);
        measureRef.current = null;
      }
      measureMarkRef.current.forEach((m) => m.setMap(null));
      measureMarkRef.current = [];
      measurePtsRef.current  = [];
      map.setOptions({ draggableCursor: null });
      setMeasureDist(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayers]);

  if (!GMAPS_KEY || error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 bg-base-200
        text-base-content/30 text-xs text-center p-4 w-full h-full">
        <Map size={28} strokeWidth={1} />
        <span>{!GMAPS_KEY ? 'Set NEXT_PUBLIC_GOOGLE_MAPS_KEY in .env' : 'Map failed to load'}</span>
        {pickupCoords && dropoffCoords && (
          <a
            href={`https://www.google.com/maps/dir/${pickupCoords[1]},${pickupCoords[0]}/${dropoffCoords[1]},${dropoffCoords[0]}`}
            target="_blank" rel="noopener noreferrer"
            className="text-primary hover:underline flex items-center gap-1 mt-1 text-xs"
          >
            <ExternalLink size={10} /> Open in Google Maps
          </a>
        )}
      </div>
    );
  }

  const showCompare = activeLayers.has('compare');

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center
          bg-base-200 gap-2 text-base-content/40 text-xs">
          <Spinner /> Loading map…
        </div>
      )}

      {/* Measure badge */}
      {activeLayers.has('measure') && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20
          flex items-center gap-1.5 bg-base-100/95 border border-warning/40
          rounded-full px-3 py-1 shadow text-[11px] font-bold text-warning pointer-events-auto">
          <Ruler size={10} />
          {measureDist != null ? `${measureDist} km measured` : 'Click map to measure'}
          {measureDist != null && (
            <button type="button" onClick={() => {
              measurePtsRef.current = [];
              measureMarkRef.current.forEach((m) => m.setMap(null));
              measureMarkRef.current = [];
              measureRef.current?.getPath()?.clear();
              setMeasureDist(null);
            }} className="ml-1 text-base-content/40 hover:text-error">
              <X size={9} />
            </button>
          )}
        </div>
      )}

      {/* Street view badge */}
      {svOpen && (
        <div className="absolute top-3 right-3 z-20 bg-base-100/90 border border-base-300
          rounded-lg px-2 py-1 text-[10px] font-bold text-base-content/60 flex items-center gap-1">
          <Eye size={9} /> Street View active
        </div>
      )}

      {/* Map + compare split */}
      <div className="flex w-full h-full">
        <div ref={mapRef} className="h-full" style={{ width: showCompare ? '50%' : '100%' }} />
        {showCompare && (
          <CompareHalf
            center={mapView?.center}
            zoom={mapView?.zoom}
          />
        )}
      </div>

      {/* Street view overlay */}
      {svOpen && (
        <div ref={svContainerRef}
          className="absolute inset-0 z-10 h-full"
         
        />
      )}
    </div>
  );
}

function CompareHalf({ center, zoom }) {
  const ref    = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    loadGMaps().then((maps) => {
      if (mapRef.current) return;
      mapRef.current = new maps.Map(ref.current, {
        center: center ?? { lat: 16.506, lng: 80.648 },
        zoom: zoom ?? 13,
        mapTypeId: 'hybrid',
        disableDefaultUI: true, zoomControl: false,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const maps = window.google?.maps;
    if (!mapRef.current || !maps || !center) return;
    mapRef.current.setCenter(center);
    if (zoom) mapRef.current.setZoom(zoom);
  }, [center, zoom]);

  return (
    <div className="w-[50%] h-full relative">
      <div ref={ref} className="w-full h-full" />
      <div className="absolute top-1 left-1 bg-black/60 text-white text-[9px]
        font-bold px-1.5 py-0.5 rounded">Satellite</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING LAYERS PANEL (top-left in fullscreen)
// ─────────────────────────────────────────────────────────────────────────────

function FloatingLayersPanel({ activeLayers, onToggle, locked, onToggleLock }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 bg-base-100/95 backdrop-blur border border-base-300
          rounded-xl px-3 py-2 shadow-lg text-[11px] font-bold text-base-content
          hover:bg-base-100 transition-all"
      >
        <Layers size={12} className="text-primary" />
        <span>Layers</span>
        {activeLayers.size > 0 && (
          <span className="bg-primary text-primary-content rounded-full px-1.5 text-[10px] font-black">
            {activeLayers.size}
          </span>
        )}
        {/* Lock/Unlock always visible here */}
        <span className="ml-auto pl-2 border-l border-base-300">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
            title={locked ? 'Unlock (exit fullscreen)' : 'Lock (fullscreen)'}
            className={`flex items-center gap-1 text-[10px] font-bold transition-colors
              ${locked ? 'text-error' : 'text-base-content/60 hover:text-base-content'}`}
          >
            {locked ? <Unlock size={11} /> : <Lock size={11} />}
            {locked ? 'Unlock' : 'Lock'}
          </button>
        </span>
      </button>

      {/* Layer buttons — shown when open */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="layer-panel"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="bg-base-100/95 backdrop-blur border border-base-300 rounded-xl
              shadow-lg p-2.5 flex flex-col gap-1.5"
          >
            {MAP_LAYERS.map(({ id, label, icon: Icon }) => {
              const active = activeLayers.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onToggle(id)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold
                    border transition-all duration-150 w-full text-left
                    ${active
                      ? 'bg-primary text-primary-content border-primary shadow-sm'
                      : 'bg-base-200/60 text-base-content/70 border-base-300 hover:border-primary/40 hover:text-base-content'
                    }`}
                >
                  <Icon size={11} className="flex-shrink-0" />
                  {label}
                  {active && <CheckCircle size={10} className="ml-auto opacity-80" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING INFO PANEL (bottom-right in fullscreen)
// ─────────────────────────────────────────────────────────────────────────────

function FloatingInfoPanel({
  booking, tracking, liveLocation, ride, rideStatus, isActive,
  driverName, driverPhone, vehicleNum, vehicleStr,
  canonicalKm, canonicalMin, actualKm, etaMin,
  trackLoading, trackError, loadTracking,
  socketConnected,
}) {
  const [open, setOpen] = useState(false);
  const [tab,  setTab]  = useState('map');

  const pickupCoords  = booking?.patientLocation?.coordinates  ?? mapRoute?.pickupCoords;
const dropoffCoords = booking?.destinationLocation?.coordinates ?? mapRoute?.dropoffCoords;

  return (
    <div className="flex flex-col items-end gap-2 w-full max-w-sm">

      {/* Panel content — shown when open */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="info-panel"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="w-full bg-base-100/97 backdrop-blur border border-base-300
       rounded-2xl shadow-2xl overflow-hidden max-h-[60vh]"
           
          >
            {/* Ride summary strip */}
            {ride && (
              <div className="grid grid-cols-4 divide-x divide-base-300 border-b border-base-300 bg-base-100/60">
                {[
                  { label: 'Status',       value: rideStatus.replace(/_/g, ' '), accent: true },
                  { label: 'Driver',       value: driverName },
                  { label: 'Vehicle',      value: vehicleNum, mono: true },
                  { label: 'Canonical km', value: canonicalKm != null ? `${Number(canonicalKm).toFixed(2)} km` : '—', accent: true },
                ].map(({ label, value, accent, mono }) => (
                  <div key={label} className="p-2 text-center">
                    <p className="text-[9px] text-base-content/40 font-semibold uppercase tracking-wide">{label}</p>
                    <p className={`text-[11px] font-bold mt-0.5 truncate px-0.5 leading-tight
                      ${accent ? 'text-primary' : 'text-base-content'}
                      ${mono ? 'font-mono' : ''}`}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Live location banner */}
            <AnimatePresence>
              {isActive && liveLocation && (
                <motion.div
                  key="live-banner"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-success/10 border-b border-success/20 px-3 py-1.5
                    flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                    </span>
                    <span className="text-[10px] font-bold text-success">Driver broadcasting live</span>
                  </div>
                  <div className="text-[10px] text-success/70 font-mono flex items-center gap-2">
                    <span>{liveLocation.lat?.toFixed(5)}, {liveLocation.lng?.toFixed(5)}</span>
                    {liveLocation.speed != null && (
                      <span className="bg-success/15 px-1.5 py-0.5 rounded">
                        {Math.round(liveLocation.speed)} km/h
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Alert banners */}
            <AnimatePresence>
              {tracking?.hasActiveSos && (
                <motion.div key="sos" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-3 py-2 bg-error/10 border-b border-error/30">
                  <AlertTriangle size={13} className="text-error flex-shrink-0" />
                  <span className="text-[11px] font-bold text-error">Active SOS — contact driver immediately</span>
                </motion.div>
              )}
              {tracking?.hasUnacknowledgedDeviation && !tracking?.hasActiveSos && (
                <motion.div key="deviation" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex items-center gap-2 px-3 py-2 bg-warning/10 border-b border-warning/30">
                  <AlertCircle size={13} className="text-warning flex-shrink-0" />
                  <span className="text-[11px] font-bold text-warning">Route deviation — driver off canonical route</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tab bar */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-base-300 bg-base-100/60">
              <TabBtn active={tab === 'map'}       onClick={() => setTab('map')}       icon={Map}      label="Map"       dot={isActive && !!liveLocation} />
              <TabBtn active={tab === 'waypoints'} onClick={() => setTab('waypoints')} icon={MapPin}   label="Waypoints" />
              <TabBtn active={tab === 'timeline'}  onClick={() => setTab('timeline')}  icon={Activity} label="Timeline"  />
              <TabBtn active={tab === 'stats'}     onClick={() => setTab('stats')}     icon={Radio}    label="Stats"     />
            </div>

            {/* Tab content */}
            <div className="overflow-y-auto max-h-[calc(60vh - 140px)]">

              {/* ── MAP tab ── */}
              {tab === 'map' && (
                <div className="p-3 space-y-3">
                  {/* Distance cards */}
                  {ride && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'Canonical km',  value: canonicalKm != null ? `${Number(canonicalKm).toFixed(2)} km` : '—', sub: 'Locked — same for all', accent: true },
                        { label: 'Canonical ETA', value: canonicalMin != null ? `${Math.round(canonicalMin)} min` : '—', sub: 'Locked at booking' },
                        { label: 'Actual km (GPS)', value: (() => { const km = actualKm || tracking?.totalDistanceKm; return km ? `${Number(km).toFixed(2)} km` : '—'; })(), sub: 'Accumulated from GPS' },
                        { label: 'Current ETA',   value: etaMin != null ? `${Math.round(etaMin)} min` : '—', sub: 'Live recalculated' },
                      ].map(({ label, value, sub, accent }) => (
                        <div key={label} className={`rounded-xl p-2.5 border ${accent ? 'bg-primary/5 border-primary/20' : 'bg-base-200/60 border-base-300'}`}>
                          <p className="text-[9px] text-base-content/40 font-bold uppercase tracking-wider mb-1">{label}</p>
                          <p className={`text-sm font-black ${accent ? 'text-primary' : 'text-base-content'}`}>{value}</p>
                          <p className="text-[9px] text-base-content/35 mt-0.5 leading-tight">{sub}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Driver + vehicle */}
                  {ride && (
                    <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                      <SectionTitle icon={Car} label="Driver & Vehicle" />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <InfoRow label="Driver name"  value={driverName} />
                        <InfoRow label="Phone"        value={driverPhone} />
                        <InfoRow label="Vehicle"      value={vehicleStr} />
                        <InfoRow label="Plate number" value={vehicleNum} mono />
                        {ride?.vehicleSnapshot?.vehicleType && <InfoRow label="Type" value={ride.vehicleSnapshot.vehicleType} />}
                        {ride?.vehicleSnapshot?.isWheelchairAccessible && <InfoRow label="Wheelchair" value="Accessible ✓" />}
                        {ride?.fare?.ratePerKm != null && <InfoRow label="Rate/km" value={`₹${ride.fare.ratePerKm}`} highlight />}
                      </div>
                    </div>
                  )}

                  {!ride && <EmptyState icon={Car} text="No ride assigned yet" />}

                  {/* Map legend */}
                  <div className="flex items-center gap-3 flex-wrap px-1">
                    {[
                      { color: '#4f46e5', line: true,  label: 'Canonical route' },
                      { color: '#10b981', line: false, label: 'Pickup' },
                      { color: '#ef4444', line: false, label: 'Drop-off' },
                      { color: '#f59e0b', line: false, label: 'Stop' },
                      ...(liveLocation ? [{ color: '#4f46e5', line: false, label: 'Driver (live)' }] : []),
                    ].map(({ color, line, label }) => (
                      <div key={label} className="flex items-center gap-1">
                        {line
                          ? <div className="w-[18px] h-[3px] rounded-[2px]" style={{ background: color }} />
                          : <div className="w-[9px] h-[9px] rounded-[50%] border-[2px] border-[white] box-border" style={{ background: color }} />
                        }
                        <span className="text-[10px] text-base-content/50">{label}</span>
                      </div>
                    ))}
                    {pickupCoords && (
                      <a
                        href={dropoffCoords
                          ? `https://www.google.com/maps/dir/${pickupCoords[1]},${pickupCoords[0]}/${dropoffCoords[1]},${dropoffCoords[0]}`
                          : `https://www.google.com/maps/search/?api=1&query=${pickupCoords[1]},${pickupCoords[0]}`}
                        target="_blank" rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-[10px] text-primary hover:underline"
                      >
                        <ExternalLink size={10} /> Open in Maps
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ── WAYPOINTS tab ── */}
              {tab === 'waypoints' && (
                <div className="p-3 space-y-3">
                  <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                    <SectionTitle icon={MapPin} label="Pickup (locked at booking)" />
                    {pickupCoords ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-base-content">{booking?.patientLocation?.address ?? 'Address not set'}</p>
                        <p className="text-[10px] font-mono text-base-content/40">{coordsStr(pickupCoords)}</p>
                        {booking?.patientLocation?.city && (
                          <p className="text-[10px] text-base-content/50">
                            {booking.patientLocation.city}{booking.patientLocation.pincode ? ` — ${booking.patientLocation.pincode}` : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-base-content/40">No pickup coordinates set</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                    <SectionTitle icon={Navigation} label="Drop-off (locked at booking)" />
                    {dropoffCoords ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-base-content">{booking?.destinationLocation?.address ?? 'Address not set'}</p>
                        <p className="text-[10px] font-mono text-base-content/40">{coordsStr(dropoffCoords)}</p>
                        {booking?.destinationLocation?.city && (
                          <p className="text-[10px] text-base-content/50">
                            {booking.destinationLocation.city}{booking.destinationLocation.pincode ? ` — ${booking.destinationLocation.pincode}` : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-base-content/40">No drop-off coordinates set</p>
                    )}
                  </div>

                  {ride?.stops?.length > 0 && (
                    <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                      <SectionTitle icon={MapPin} label="Intermediate stops" count={ride.stops.length} />
                      <div className="space-y-2">
                        {ride.stops.map((s) => (
                          <div key={s._id ?? s.sequence}
                            className="flex items-start gap-2.5 p-2.5 rounded-lg border border-base-300 bg-base-200/40">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-black
                              ${s.isCompleted ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                              {s.sequence}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-base-content truncate">
                                {s.location?.address ?? coordsStr(s.location?.coordinates)}
                              </p>
                              <div className="flex gap-2 mt-0.5 flex-wrap">
                                {s.purpose && <span className="text-[10px] text-base-content/50">{s.purpose.replace(/_/g, ' ')}</span>}
                                {s.waitMinutes > 0 && <span className="text-[10px] text-base-content/50">wait: {s.waitMinutes} min</span>}
                                <span className={`text-[10px] font-semibold ${s.isCompleted ? 'text-success' : 'text-warning'}`}>
                                  {s.isCompleted ? '✓ done' : 'pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pickupCoords && dropoffCoords && (
                    <a
                      href={`https://www.google.com/maps/dir/${pickupCoords[1]},${pickupCoords[0]}/${dropoffCoords[1]},${dropoffCoords[0]}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline px-1"
                    >
                      <ExternalLink size={12} /> Open full route in Google Maps
                    </a>
                  )}
                </div>
              )}

              {/* ── TIMELINE tab ── */}
              {tab === 'timeline' && (
                <div className="p-3 space-y-3">
                  {ride && (
                    <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                      <SectionTitle icon={Clock} label="Ride timestamps" />
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <InfoRow label="Scheduled pickup"       value={fmt(ride.scheduledPickupAt)} />
                        <InfoRow label="Driver assigned"        value={fmt(ride.driverAssignedAt)} />
                        <InfoRow label="Driver accepted"        value={fmt(ride.driverAcceptedAt)} />
                        <InfoRow label="Driver en route"        value={fmt(ride.driverEnRouteAt)} />
                        <InfoRow label="Driver arrived"         value={fmt(ride.driverArrivedAt)} />
                        <InfoRow label="Ride started (OTP)"     value={fmt(ride.rideStartedAt)} />
                        <InfoRow label="Completed"              value={fmt(ride.rideCompletedAt)} />
                        <InfoRow label="OTP verified at"        value={fmt(ride.pickupOtpVerifiedAt)} />
                      </div>
                    </div>
                  )}
                  {trackLoading && (
                    <div className="flex items-center gap-2 justify-center py-4 text-base-content/40 text-xs">
                      <Spinner /> Loading milestones…
                    </div>
                  )}
                  {trackError && !trackLoading && (
                    <div className="flex flex-col items-center gap-2 py-4">
                      <p className="text-xs text-error">{trackError}</p>
                      <button onClick={loadTracking} className="btn btn-xs btn-ghost gap-1">
                        <RotateCcw size={11} /> Retry
                      </button>
                    </div>
                  )}
                  {!trackLoading && tracking?.milestones?.length > 0 && (
                    <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                      <SectionTitle icon={CheckCircle} label="Milestones" count={tracking.milestones.length} />
                      <div>
                        {[...tracking.milestones].reverse().map((m, i, arr) => {
                          const isLast = i === arr.length - 1;
                          return (
                            <div key={m._id ?? i} className="flex gap-2.5">
                              <div className="flex flex-col items-center flex-shrink-0 pt-1">
                                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                                {!isLast && <div className="w-px flex-1 bg-base-300 my-1 min-h-[12px]" />}
                              </div>
                              <div className={`flex-1 min-w-0 ${!isLast ? 'pb-3' : ''}`}>
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-xs font-semibold text-base-content capitalize">
                                    {MILESTONE_LABELS[m.name] ?? m.name.replace(/_/g, ' ')}
                                  </span>
                                  <span className="text-[10px] text-base-content/40 flex-shrink-0">{fmt(m.occurredAt)}</span>
                                </div>
                                {m.recordedBy && (
                                  <span className="text-[10px] text-base-content/40">
                                    {m.recordedBy}{m.stopSequence != null ? ` · stop ${m.stopSequence}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {!trackLoading && !tracking?.milestones?.length && !trackError && (
                    <EmptyState icon={Activity} text="No milestones yet" />
                  )}
                </div>
              )}

              {/* ── STATS tab ── */}
              {tab === 'stats' && (
                <div className="p-3 space-y-3">
                  {trackLoading && (
                    <div className="flex items-center gap-2 justify-center py-8 text-base-content/40 text-xs">
                      <Spinner /> Loading tracking stats…
                    </div>
                  )}
                  {trackError && !trackLoading && (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <p className="text-xs text-error">{trackError}</p>
                      <button onClick={loadTracking} className="btn btn-xs btn-ghost gap-1">
                        <RotateCcw size={11} /> Retry
                      </button>
                    </div>
                  )}
                  {!trackLoading && tracking && (
                    <>
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <SectionTitle icon={Navigation} label="Canonical vs actual distance" />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[10px] text-base-content/40 uppercase tracking-wide mb-1">Canonical (locked)</p>
                            <p className="text-xl font-black text-primary">
                              {canonicalKm != null ? `${Number(canonicalKm).toFixed(2)} km` : '—'}
                            </p>
                            <p className="text-[10px] text-base-content/40 mt-0.5">Same for all roles</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-base-content/40 uppercase tracking-wide mb-1">Actual (GPS)</p>
                            <p className="text-xl font-black text-base-content">
                              {tracking.totalDistanceKm != null
                                ? `${Number(tracking.totalDistanceKm).toFixed(2)} km`
                                : actualKm ? `${Number(actualKm).toFixed(2)} km` : '—'}
                            </p>
                            <p className="text-[10px] text-base-content/40 mt-0.5">Accumulated from GPS</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                        <SectionTitle icon={Radio} label="GPS tracking stats" />
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <InfoRow label="GPS pings"        value={tracking.breadcrumbCount ?? 0} />
                          <InfoRow label="Avg speed"        value={tracking.summary?.avgSpeedKmh != null ? `${Math.round(tracking.summary.avgSpeedKmh)} km/h` : '—'} />
                          <InfoRow label="Max speed"        value={tracking.summary?.maxSpeedKmh != null ? `${Math.round(tracking.summary.maxSpeedKmh)} km/h` : '—'} />
                          <InfoRow label="Pickup wait"      value={tracking.summary?.pickupWaitMin != null ? `${tracking.summary.pickupWaitMin} min` : '—'} />
                          <InfoRow label="Stop wait total"  value={tracking.summary?.totalStopWaitMin != null ? `${tracking.summary.totalStopWaitMin} min` : '—'} />
                          <InfoRow label="SOS events"       value={tracking.sosEvents?.length ?? 0} />
                          <InfoRow label="Route deviations" value={tracking.routeDeviations?.length ?? 0} />
                          <InfoRow label="Archived"         value={tracking.isArchived ? 'Yes' : 'No'} />
                        </div>
                      </div>

                      {tracking.sosEvents?.length > 0 && (
                        <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                          <SectionTitle icon={AlertTriangle} label="SOS events" count={tracking.sosEvents.length} />
                          <div className="space-y-2">
                            {tracking.sosEvents.map((e, i) => (
                              <div key={e._id ?? i}
                                className={`p-2.5 rounded-lg border text-xs ${e.isResolved ? 'border-base-300 bg-base-200/40' : 'border-error/30 bg-error/5'}`}>
                                <div className="flex justify-between mb-1">
                                  <span className={`font-bold ${e.isResolved ? 'text-base-content' : 'text-error'}`}>
                                    {e.sosType ?? 'SOS'} — by {e.triggeredBy}
                                  </span>
                                  <span className={`text-[10px] font-bold ${e.isResolved ? 'text-success' : 'text-error'}`}>
                                    {e.isResolved ? 'resolved' : 'ACTIVE'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-base-content/50">{fmt(e.triggeredAt)}</p>
                                {e.description && <p className="text-[10px] text-base-content/60 mt-1">{e.description}</p>}
                                {e.isResolved && e.resolutionNotes && <p className="text-[10px] text-success mt-1">✓ {e.resolutionNotes}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {tracking.routeDeviations?.length > 0 && (
                        <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                          <SectionTitle icon={AlertCircle} label="Route deviations" count={tracking.routeDeviations.length} />
                          <div className="space-y-2">
                            {tracking.routeDeviations.map((d, i) => (
                              <div key={d._id ?? i}
                                className={`p-2.5 rounded-lg border text-xs ${d.wasAcknowledged ? 'border-base-300 bg-base-200/40' : 'border-warning/30 bg-warning/5'}`}>
                                <div className="flex justify-between mb-0.5">
                                  <span className="font-bold text-base-content">
                                    {d.deviationKm != null ? `${Number(d.deviationKm).toFixed(1)} km off canonical route` : 'Deviation detected'}
                                  </span>
                                  <span className={`text-[10px] font-bold ${d.wasAcknowledged ? 'text-base-content/40' : 'text-warning'}`}>
                                    {d.wasAcknowledged ? 'ack' : 'unacknowledged'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-base-content/50">{fmt(d.detectedAt)}</p>
                                {d.driverReason && <p className="text-[10px] text-base-content/60 mt-1">Reason: {d.driverReason}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {!trackLoading && !tracking && !trackError && (
                    <EmptyState icon={Radio} text="No tracking data yet" />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg border text-[11px] font-bold
          transition-all duration-150 backdrop-blur self-end
          ${open
            ? 'bg-primary text-primary-content border-primary'
            : 'bg-base-100/95 text-base-content border-base-300 hover:bg-base-100'
          }`}
      >
        {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        {open ? 'Close' : 'Details'}
        {/* Pulse when live */}
        {isActive && liveLocation && !open && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
        )}
        {/* Socket badge */}
        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5
          rounded-full border ${socketConnected
            ? 'bg-success/10 text-success border-success/30'
            : 'bg-error/10 text-error border-error/30'}`}>
          {socketConnected ? <Wifi size={8} /> : <WifiOff size={8} />}
          {socketConnected ? 'Live' : 'Off'}
        </span>
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NORMAL MODE INNER PANEL (unlocked)
// ─────────────────────────────────────────────────────────────────────────────

function NormalPanel({
  booking, tracking, liveLocation, socketConnected,
  ride, rideStatus, isActive,
  driverName, driverPhone, vehicleNum, vehicleStr,
  canonicalKm, canonicalMin, actualKm, etaMin,
  activeLayers, handleLayerToggle,
  trackLoading, trackError, loadTracking,
  locked, handleToggleLock,
}) {
  const [tab, setTab] = useState('map');

  const pickupCoords  = booking?.patientLocation?.coordinates;
  const dropoffCoords = booking?.destinationLocation?.coordinates;
  const rideId        = ride?._id;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-base-300 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Map size={13} />
          </span>
          <div>
            <p className="text-xs font-bold text-base-content leading-none">Live Tracking</p>
            <p className="text-[10px] text-base-content/40 mt-0.5">{booking?.bookingCode ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5
            rounded-full border ${socketConnected
              ? 'bg-success/10 text-success border-success/30'
              : 'bg-error/10 text-error border-error/30'}`}>
            {socketConnected ? <Wifi size={9} /> : <WifiOff size={9} />}
            {socketConnected ? 'Live' : 'Offline'}
          </span>
          <button type="button" onClick={loadTracking} disabled={trackLoading}
            className="btn btn-xs btn-ghost btn-circle" title="Refresh">
            {trackLoading ? <Spinner /> : <RotateCcw size={11} />}
          </button>
          <button type="button" onClick={handleToggleLock}
            title="Lock (fullscreen)"
            className="btn btn-xs btn-ghost btn-circle">
            <Lock size={11} />
          </button>
        </div>
      </div>

      {/* Ride summary strip */}
      {rideId && (
        <div className="flex-shrink-0 grid grid-cols-4 divide-x divide-base-300 border-b border-base-300 bg-base-100/60">
          {[
            { label: 'Status',       value: rideStatus.replace(/_/g, ' '), accent: true },
            { label: 'Driver',       value: driverName },
            { label: 'Vehicle',      value: vehicleNum, mono: true },
            { label: 'Canonical km', value: canonicalKm != null ? `${Number(canonicalKm).toFixed(2)} km` : '—', accent: true },
          ].map(({ label, value, accent, mono }) => (
            <div key={label} className="p-2 text-center">
              <p className="text-[9px] text-base-content/40 font-semibold uppercase tracking-wide">{label}</p>
              <p className={`text-[11px] font-bold mt-0.5 truncate px-0.5 leading-tight
                ${accent ? 'text-primary' : 'text-base-content'} ${mono ? 'font-mono' : ''}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Live location banner */}
      <AnimatePresence>
        {isActive && liveLocation && (
          <motion.div key="live-banner" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 bg-success/10 border-b border-success/20 px-3 py-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-[10px] font-bold text-success">Driver broadcasting live</span>
            </div>
            <div className="text-[10px] text-success/70 font-mono flex items-center gap-2">
              <span>{liveLocation.lat?.toFixed(5)}, {liveLocation.lng?.toFixed(5)}</span>
              {liveLocation.speed != null && (
                <span className="bg-success/15 px-1.5 py-0.5 rounded">{Math.round(liveLocation.speed)} km/h</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert banners */}
      <AnimatePresence>
        {tracking?.hasActiveSos && (
          <motion.div key="sos" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-error/10 border-b border-error/30">
            <AlertTriangle size={13} className="text-error flex-shrink-0" />
            <span className="text-[11px] font-bold text-error">Active SOS — contact driver immediately</span>
          </motion.div>
        )}
        {tracking?.hasUnacknowledgedDeviation && !tracking?.hasActiveSos && (
          <motion.div key="deviation" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-warning/10 border-b border-warning/30">
            <AlertCircle size={13} className="text-warning flex-shrink-0" />
            <span className="text-[11px] font-bold text-warning">Route deviation — driver off canonical route</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b border-base-300 bg-base-100/60">
        <TabBtn active={tab === 'map'}       onClick={() => setTab('map')}       icon={Map}      label="Map"      dot={isActive && !!liveLocation} />
        <TabBtn active={tab === 'waypoints'} onClick={() => setTab('waypoints')} icon={MapPin}   label="Waypoints" />
        <TabBtn active={tab === 'timeline'}  onClick={() => setTab('timeline')}  icon={Activity} label="Timeline" />
        <TabBtn active={tab === 'stats'}     onClick={() => setTab('stats')}     icon={Radio}    label="Stats" />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {tab === 'map' && (
          <div className="p-3 space-y-3">
            {/* Layer toolbar */}
            <div className="rounded-xl border border-base-300 bg-base-100 p-2.5">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-base-content/40 mr-1">
                  <Layers size={10} /> Layers
                </span>
                {MAP_LAYERS.map(({ id, label, icon: Icon }) => {
                  const active = activeLayers.has(id);
                  return (
                    <button key={id} type="button" onClick={() => handleLayerToggle(id)} title={label}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all duration-150 select-none
                        ${active
                          ? 'bg-primary text-primary-content border-primary shadow-sm'
                          : 'bg-base-200/70 text-base-content/60 border-base-300 hover:border-primary/40 hover:text-base-content'
                        }`}>
                      <Icon size={9} />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Map canvas */}
            {trackLoading && !tracking ? (
              <div className="flex items-center justify-center bg-base-200 rounded-xl gap-2 text-base-content/40 text-xs h-[260px]">
                <Spinner /> Loading canonical route…
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-base-300 h-[260px]">
                <MapCanvas
                  booking={booking}
                  tracking={tracking}
                  liveLocation={liveLocation}
                  activeLayers={activeLayers}
                />
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center gap-3 px-1 flex-wrap">
              {[
                { color: '#4f46e5', line: true,  label: 'Canonical route' },
                { color: '#10b981', line: false, label: 'Pickup' },
                { color: '#ef4444', line: false, label: 'Drop-off' },
                { color: '#f59e0b', line: false, label: 'Stop' },
                ...(liveLocation ? [{ color: '#4f46e5', line: false, label: 'Driver (live)' }] : []),
              ].map(({ color, line, label }) => (
                <div key={label} className="flex items-center gap-1">
                  {line
                    ? <div className="w-[18px] h-[3px] rounded-[2px]" style={{ background: color }} />
                    : <div className="w-[9px] h-[9px] rounded-[50%] border-[2px] border-[white] box-border" style={{ background: color }} />
                  }
                  <span className="text-[10px] text-base-content/50">{label}</span>
                </div>
              ))}
              {pickupCoords && (
                <a href={dropoffCoords
                  ? `https://www.google.com/maps/dir/${pickupCoords[1]},${pickupCoords[0]}/${dropoffCoords[1]},${dropoffCoords[0]}`
                  : `https://www.google.com/maps/search/?api=1&query=${pickupCoords[1]},${pickupCoords[0]}`}
                  target="_blank" rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 text-[10px] text-primary hover:underline">
                  <ExternalLink size={10} /> Open in Maps
                </a>
              )}
            </div>

            {/* Distance cards */}
            {rideId && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Canonical km',  value: canonicalKm != null ? `${Number(canonicalKm).toFixed(2)} km` : '—', sub: 'Locked at booking — same for all', accent: true },
                  { label: 'Canonical ETA', value: canonicalMin != null ? `${Math.round(canonicalMin)} min` : '—', sub: 'Locked at booking' },
                  { label: 'Actual km (GPS)', value: (() => { const km = actualKm || tracking?.totalDistanceKm; return km ? `${Number(km).toFixed(2)} km` : '—'; })(), sub: 'Accumulated from GPS breadcrumbs' },
                  { label: 'Current ETA',   value: etaMin != null ? `${Math.round(etaMin)} min` : '—', sub: 'Live recalculated' },
                ].map(({ label, value, sub, accent }) => (
                  <div key={label} className={`rounded-xl p-2.5 border ${accent ? 'bg-primary/5 border-primary/20' : 'bg-base-200/60 border-base-300'}`}>
                    <p className="text-[9px] text-base-content/40 font-bold uppercase tracking-wider mb-1">{label}</p>
                    <p className={`text-sm font-black ${accent ? 'text-primary' : 'text-base-content'}`}>{value}</p>
                    <p className="text-[9px] text-base-content/35 mt-0.5 leading-tight">{sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Driver + vehicle */}
            {rideId && (
              <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                <SectionTitle icon={Car} label="Driver & Vehicle" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <InfoRow label="Driver name"  value={driverName} />
                  <InfoRow label="Phone"        value={driverPhone} />
                  <InfoRow label="Vehicle"      value={vehicleStr} />
                  <InfoRow label="Plate number" value={vehicleNum} mono />
                  {ride?.vehicleSnapshot?.vehicleType && <InfoRow label="Type" value={ride.vehicleSnapshot.vehicleType} />}
                  {ride?.vehicleSnapshot?.isWheelchairAccessible && <InfoRow label="Wheelchair" value="Accessible ✓" />}
                  {ride?.fare?.ratePerKm != null && <InfoRow label="Rate/km" value={`₹${ride.fare.ratePerKm}`} highlight />}
                </div>
              </div>
            )}

            {!rideId && <EmptyState icon={Car} text="No ride assigned yet" />}
          </div>
        )}

        {tab === 'waypoints' && (
          <div className="p-3 space-y-3">
            <div className="rounded-xl border border-base-300 bg-base-100 p-3">
              <SectionTitle icon={MapPin} label="Pickup (locked at booking)" />
              {pickupCoords ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-base-content">{booking?.patientLocation?.address ?? 'Address not set'}</p>
                  <p className="text-[10px] font-mono text-base-content/40">{coordsStr(pickupCoords)}</p>
                  {booking?.patientLocation?.city && (
                    <p className="text-[10px] text-base-content/50">
                      {booking.patientLocation.city}{booking.patientLocation.pincode ? ` — ${booking.patientLocation.pincode}` : ''}
                    </p>
                  )}
                </div>
              ) : <p className="text-xs text-base-content/40">No pickup coordinates set</p>}
            </div>

            <div className="rounded-xl border border-base-300 bg-base-100 p-3">
              <SectionTitle icon={Navigation} label="Drop-off (locked at booking)" />
              {dropoffCoords ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-base-content">{booking?.destinationLocation?.address ?? 'Address not set'}</p>
                  <p className="text-[10px] font-mono text-base-content/40">{coordsStr(dropoffCoords)}</p>
                  {booking?.destinationLocation?.city && (
                    <p className="text-[10px] text-base-content/50">
                      {booking.destinationLocation.city}{booking.destinationLocation.pincode ? ` — ${booking.destinationLocation.pincode}` : ''}
                    </p>
                  )}
                </div>
              ) : <p className="text-xs text-base-content/40">No drop-off coordinates set</p>}
            </div>

            {ride?.stops?.length > 0 && (
              <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                <SectionTitle icon={MapPin} label="Intermediate stops" count={ride.stops.length} />
                <div className="space-y-2">
                  {ride.stops.map((s) => (
                    <div key={s._id ?? s.sequence}
                      className="flex items-start gap-2.5 p-2.5 rounded-lg border border-base-300 bg-base-200/40">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[9px] font-black
                        ${s.isCompleted ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
                        {s.sequence}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-base-content truncate">
                          {s.location?.address ?? coordsStr(s.location?.coordinates)}
                        </p>
                        <div className="flex gap-2 mt-0.5 flex-wrap">
                          {s.purpose && <span className="text-[10px] text-base-content/50">{s.purpose.replace(/_/g, ' ')}</span>}
                          {s.waitMinutes > 0 && <span className="text-[10px] text-base-content/50">wait: {s.waitMinutes} min</span>}
                          <span className={`text-[10px] font-semibold ${s.isCompleted ? 'text-success' : 'text-warning'}`}>
                            {s.isCompleted ? '✓ done' : 'pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pickupCoords && dropoffCoords && (
              <a href={`https://www.google.com/maps/dir/${pickupCoords[1]},${pickupCoords[0]}/${dropoffCoords[1]},${dropoffCoords[0]}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline px-1">
                <ExternalLink size={12} /> Open full route in Google Maps
              </a>
            )}
          </div>
        )}

        {tab === 'timeline' && (
          <div className="p-3 space-y-3">
            {ride && (
              <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                <SectionTitle icon={Clock} label="Ride timestamps" />
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <InfoRow label="Scheduled pickup"   value={fmt(ride.scheduledPickupAt)} />
                  <InfoRow label="Driver assigned"    value={fmt(ride.driverAssignedAt)} />
                  <InfoRow label="Driver accepted"    value={fmt(ride.driverAcceptedAt)} />
                  <InfoRow label="Driver en route"    value={fmt(ride.driverEnRouteAt)} />
                  <InfoRow label="Driver arrived"     value={fmt(ride.driverArrivedAt)} />
                  <InfoRow label="Ride started (OTP)" value={fmt(ride.rideStartedAt)} />
                  <InfoRow label="Completed"          value={fmt(ride.rideCompletedAt)} />
                  <InfoRow label="OTP verified at"    value={fmt(ride.pickupOtpVerifiedAt)} />
                </div>
              </div>
            )}
            {trackLoading && (
              <div className="flex items-center gap-2 justify-center py-4 text-base-content/40 text-xs">
                <Spinner /> Loading milestones…
              </div>
            )}
            {trackError && !trackLoading && (
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-xs text-error">{trackError}</p>
                <button onClick={loadTracking} className="btn btn-xs btn-ghost gap-1"><RotateCcw size={11} /> Retry</button>
              </div>
            )}
            {!trackLoading && tracking?.milestones?.length > 0 && (
              <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                <SectionTitle icon={CheckCircle} label="Milestones" count={tracking.milestones.length} />
                <div>
                  {[...tracking.milestones].reverse().map((m, i, arr) => {
                    const isLast = i === arr.length - 1;
                    return (
                      <div key={m._id ?? i} className="flex gap-2.5">
                        <div className="flex flex-col items-center flex-shrink-0 pt-1">
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          {!isLast && <div className="w-px flex-1 bg-base-300 my-1 min-h-[12px]" />}
                        </div>
                        <div className={`flex-1 min-w-0 ${!isLast ? 'pb-3' : ''}`}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold text-base-content capitalize">
                              {MILESTONE_LABELS[m.name] ?? m.name.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-base-content/40 flex-shrink-0">{fmt(m.occurredAt)}</span>
                          </div>
                          {m.recordedBy && (
                            <span className="text-[10px] text-base-content/40">
                              {m.recordedBy}{m.stopSequence != null ? ` · stop ${m.stopSequence}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {!trackLoading && !tracking?.milestones?.length && !trackError && (
              <EmptyState icon={Activity} text="No milestones yet" />
            )}
          </div>
        )}

        {tab === 'stats' && (
          <div className="p-3 space-y-3">
            {trackLoading && (
              <div className="flex items-center gap-2 justify-center py-8 text-base-content/40 text-xs">
                <Spinner /> Loading tracking stats…
              </div>
            )}
            {trackError && !trackLoading && (
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-xs text-error">{trackError}</p>
                <button onClick={loadTracking} className="btn btn-xs btn-ghost gap-1"><RotateCcw size={11} /> Retry</button>
              </div>
            )}
            {!trackLoading && tracking && (
              <>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <SectionTitle icon={Navigation} label="Canonical vs actual distance" />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-base-content/40 uppercase tracking-wide mb-1">Canonical (locked)</p>
                      <p className="text-xl font-black text-primary">
                        {canonicalKm != null ? `${Number(canonicalKm).toFixed(2)} km` : '—'}
                      </p>
                      <p className="text-[10px] text-base-content/40 mt-0.5">Same for all roles</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-base-content/40 uppercase tracking-wide mb-1">Actual (GPS)</p>
                      <p className="text-xl font-black text-base-content">
                        {tracking.totalDistanceKm != null
                          ? `${Number(tracking.totalDistanceKm).toFixed(2)} km`
                          : actualKm ? `${Number(actualKm).toFixed(2)} km` : '—'}
                      </p>
                      <p className="text-[10px] text-base-content/40 mt-0.5">Accumulated from GPS</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                  <SectionTitle icon={Radio} label="GPS tracking stats" />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <InfoRow label="GPS pings"        value={tracking.breadcrumbCount ?? 0} />
                    <InfoRow label="Avg speed"        value={tracking.summary?.avgSpeedKmh != null ? `${Math.round(tracking.summary.avgSpeedKmh)} km/h` : '—'} />
                    <InfoRow label="Max speed"        value={tracking.summary?.maxSpeedKmh != null ? `${Math.round(tracking.summary.maxSpeedKmh)} km/h` : '—'} />
                    <InfoRow label="Pickup wait"      value={tracking.summary?.pickupWaitMin != null ? `${tracking.summary.pickupWaitMin} min` : '—'} />
                    <InfoRow label="Stop wait total"  value={tracking.summary?.totalStopWaitMin != null ? `${tracking.summary.totalStopWaitMin} min` : '—'} />
                    <InfoRow label="SOS events"       value={tracking.sosEvents?.length ?? 0} />
                    <InfoRow label="Route deviations" value={tracking.routeDeviations?.length ?? 0} />
                    <InfoRow label="Archived"         value={tracking.isArchived ? 'Yes' : 'No'} />
                  </div>
                </div>
                {tracking.sosEvents?.length > 0 && (
                  <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                    <SectionTitle icon={AlertTriangle} label="SOS events" count={tracking.sosEvents.length} />
                    <div className="space-y-2">
                      {tracking.sosEvents.map((e, i) => (
                        <div key={e._id ?? i}
                          className={`p-2.5 rounded-lg border text-xs ${e.isResolved ? 'border-base-300 bg-base-200/40' : 'border-error/30 bg-error/5'}`}>
                          <div className="flex justify-between mb-1">
                            <span className={`font-bold ${e.isResolved ? 'text-base-content' : 'text-error'}`}>
                              {e.sosType ?? 'SOS'} — by {e.triggeredBy}
                            </span>
                            <span className={`text-[10px] font-bold ${e.isResolved ? 'text-success' : 'text-error'}`}>
                              {e.isResolved ? 'resolved' : 'ACTIVE'}
                            </span>
                          </div>
                          <p className="text-[10px] text-base-content/50">{fmt(e.triggeredAt)}</p>
                          {e.description && <p className="text-[10px] text-base-content/60 mt-1">{e.description}</p>}
                          {e.isResolved && e.resolutionNotes && <p className="text-[10px] text-success mt-1">✓ {e.resolutionNotes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tracking.routeDeviations?.length > 0 && (
                  <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                    <SectionTitle icon={AlertCircle} label="Route deviations" count={tracking.routeDeviations.length} />
                    <div className="space-y-2">
                      {tracking.routeDeviations.map((d, i) => (
                        <div key={d._id ?? i}
                          className={`p-2.5 rounded-lg border text-xs ${d.wasAcknowledged ? 'border-base-300 bg-base-200/40' : 'border-warning/30 bg-warning/5'}`}>
                          <div className="flex justify-between mb-0.5">
                            <span className="font-bold text-base-content">
                              {d.deviationKm != null ? `${Number(d.deviationKm).toFixed(1)} km off canonical route` : 'Deviation detected'}
                            </span>
                            <span className={`text-[10px] font-bold ${d.wasAcknowledged ? 'text-base-content/40' : 'text-warning'}`}>
                              {d.wasAcknowledged ? 'ack' : 'unacknowledged'}
                            </span>
                          </div>
                          <p className="text-[10px] text-base-content/50">{fmt(d.detectedAt)}</p>
                          {d.driverReason && <p className="text-[10px] text-base-content/60 mt-1">Reason: {d.driverReason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {!trackLoading && !tracking && !trackError && (
              <EmptyState icon={Radio} text="No tracking data yet" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LiveTrackingPanel({ booking, mapRoute, liveLocation, socketConnected }) {
  const [tracking,     setTracking]     = useState(null);
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError,   setTrackError]   = useState(null);
  const [activeLayers, setActiveLayers] = useState(new Set());
  const [locked,       setLocked]       = useState(false);

  const ride         = booking?.primaryRide;
  const rideId       = ride?._id;
  const rideStatus   = ride?.status ?? 'unknown';
  const isActive     = ACTIVE_STATUSES.has(rideStatus);
 const canonicalKm  = mapRoute?.estimatedDistKm  ?? ride?.estimatedDistanceKm;
const canonicalMin = mapRoute?.estimatedMinutes  ?? ride?.estimatedDurationMin;
// Also pull polyline from mapRoute if tracking not loaded yet
const mapRoutePolyline = mapRoute?.polyline ?? null;
  const actualKm     = ride?.actualDistanceKm;
  const etaMin       = ride?.currentEtaMinutes;
  const driverName   = ride?.driverSnapshot?.legalName ?? ride?.driverSnapshot?.name ?? '—';
  const driverPhone  = ride?.driverSnapshot?.phone ?? '—';
  const vehicleNum   = ride?.vehicleSnapshot?.registrationNumber ?? '—';
  const vehicleStr   = `${ride?.vehicleSnapshot?.make ?? ''} ${ride?.vehicleSnapshot?.model ?? ''}`.trim() || '—';

  const loadTracking = useCallback(async () => {
    if (!rideId) return;
    setTrackLoading(true);
    setTrackError(null);
    const data = await fetchTrackingData(rideId);
    if (!data) setTrackError('Could not load tracking data');
    setTracking(data);
    setTrackLoading(false);
  }, [rideId]);

  useEffect(() => { loadTracking(); }, [loadTracking]);

  const handleLayerToggle = useCallback((id) => {
    const layerDef = MAP_LAYERS.find((l) => l.id === id);
    if (!layerDef) return;
    setActiveLayers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (layerDef.type === 'maptype') {
          next.delete('satellite');
          next.delete('terrain');
        }
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleLock = useCallback(() => setLocked((v) => !v), []);

  // ESC to unlock
  useEffect(() => {
    if (!locked) return;
    const handler = (e) => { if (e.key === 'Escape') setLocked(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [locked]);

  const sharedProps = {
    booking, tracking, liveLocation, socketConnected,
    ride, rideStatus, isActive,
    driverName, driverPhone, vehicleNum, vehicleStr,
    canonicalKm, canonicalMin, actualKm, etaMin,
    activeLayers, handleLayerToggle,
    trackLoading, trackError, loadTracking,
    locked, handleToggleLock,
  };

  // ── FULLSCREEN / LOCKED MODE ──────────────────────────────────────────────
  if (locked) {
    return (
      <>
        {/* Placeholder in normal flow */}
        <div className="rounded-xl border border-base-300 bg-base-100 overflow-hidden min-h-[120px]">
          <div className="flex flex-col items-center justify-center h-full py-8 gap-2 text-base-content/30 text-xs">
            <Lock size={20} strokeWidth={1} />
            <span>Tracking locked to fullscreen</span>
            <button type="button" onClick={handleToggleLock}
              className="btn btn-xs btn-ghost gap-1 text-primary mt-1">
              <Unlock size={10} /> Unlock
            </button>
          </div>
        </div>

        {/* Fullscreen overlay */}
        <AnimatePresence>
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[9999] bg-base-300"
          >
            {/* MAP fills entire background */}
            <div className="absolute inset-0 z-0">
             <MapCanvas
  booking={booking}
  tracking={tracking}
  mapRoutePolyline={mapRoutePolyline}   // ← ADD
  liveLocation={liveLocation}
  activeLayers={activeLayers}
/>
            </div>

            {/* Floating UI overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none p-4 flex flex-col justify-between">

              {/* TOP-LEFT: Layers panel + Lock/Unlock */}
              <div className="pointer-events-auto self-start">
                <FloatingLayersPanel
                  activeLayers={activeLayers}
                  onToggle={handleLayerToggle}
                  locked={locked}
                  onToggleLock={handleToggleLock}
                />
              </div>

              {/* BOTTOM-RIGHT: Details panel + toggle button */}
              <div className="pointer-events-auto self-end w-full max-w-sm ml-auto">
                <FloatingInfoPanel {...sharedProps} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </>
    );
  }

  // ── NORMAL MODE ───────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 overflow-hidden h-full">
      <NormalPanel {...sharedProps} />
    </div>
  );
}