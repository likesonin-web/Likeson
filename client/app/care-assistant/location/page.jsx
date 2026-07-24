'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Navigation, Search, CheckCircle2, Loader2,
  Crosshair, Radio, ChevronDown, AlertCircle, RefreshCw, Map
} from 'lucide-react';
import {
  updateLocation, updateAvailability, updateServiceArea,
  selectProfile, selectLoading, selectErrorKey,
} from '@/store/slices/careAssistantSlice';
import BackButton from '../../../components/BackButton';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

/* ─── Load Google Maps script once ─────────────────────────────── */
function loadGoogleMaps() {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.google?.maps) return resolve(window.google.maps);

    // Script already in DOM — wait for it via callback
    const existing = document.getElementById('gmap-script');
    if (existing) {
      // Script may already be loaded but google not yet assigned — check both
      existing.addEventListener('load', () => resolve(window.google.maps));
      existing.addEventListener('error', reject);
      return;
    }

    // Fresh inject — use callback param so google guarantees availability
    const callbackName = '__gmaps_cb_' + Date.now();
    window[callbackName] = () => {
      resolve(window.google.maps);
      delete window[callbackName];
    };

    const script = document.createElement('script');
    script.id    = 'gmap-script';
    script.src   = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places,geometry&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      delete window[callbackName];
      reject(new Error('Script load failed'));
    };
    document.head.appendChild(script);
  });
}

const RADIUS_OPTIONS = [1, 2, 5, 10, 15, 20, 25, 30];

export default function LocationPage() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectProfile);
  const loading  = useSelector(selectLoading);
  const locError = useSelector(selectErrorKey('location'));

  /* ── state ── */
  const [mapsReady, setMapsReady]     = useState(false);
  const [mapError,  setMapError]      = useState(null);
  const [searchVal, setSearchVal]     = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [radius, setRadius]           = useState(
    profile?.maxServiceRadiusKm || 10
  );
  const [coords, setCoords]           = useState({
    lat: profile?.location?.coordinates?.[1] || 16.506,
    lng: profile?.location?.coordinates?.[0] || 80.648,
  });
  const [address,  setAddress]        = useState('');
  const [saved,    setSaved]          = useState(false);
  const [gettingLoc, setGettingLoc]   = useState(false);

  /* ── refs ── */
  const mapRef      = useRef(null);
  const gmap        = useRef(null);
  const marker      = useRef(null);
  const circle      = useRef(null);
  const acService   = useRef(null);
  const geocoder    = useRef(null);
  const searchRef   = useRef(null);

  /* ── Init Google Maps ── */
  useEffect(() => {
    loadGoogleMaps()
      .then((maps) => {
        acService.current = new maps.places.AutocompleteService();
        geocoder.current  = new maps.Geocoder();
        setMapsReady(true);
      })
      .catch(() => setMapError('Failed to load Google Maps. Check your API key.'));
  }, []);

  /* ── Draw / update map ── */
  const drawMap = useCallback(() => {
    if (!mapsReady || !mapRef.current) return;
    const maps = window.google.maps;
    const center = new maps.LatLng(coords.lat, coords.lng);

    if (!gmap.current) {
      gmap.current = new maps.Map(mapRef.current, {
        center,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        styles: [
          { elementType: 'geometry',                          stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.stroke',                stylers: [{ color: '#1a1a2e' }] },
          { elementType: 'labels.text.fill',                  stylers: [{ color: '#a8b2c8' }] },
          { featureType: 'road',        elementType: 'geometry',        stylers: [{ color: '#2d2d54' }] },
          { featureType: 'road',        elementType: 'geometry.stroke', stylers: [{ color: '#212146' }] },
          { featureType: 'water',       elementType: 'geometry',        stylers: [{ color: '#0a0a1f' }] },
          { featureType: 'poi',         elementType: 'geometry',        stylers: [{ color: '#1e1e3f' }] },
          { featureType: 'transit',     elementType: 'geometry',        stylers: [{ color: '#2f2f5a' }] },
          { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#7b3fe4' }] },
        ],
      });

      /* Marker */
      marker.current = new maps.Marker({
        position: center,
        map: gmap.current,
        title: 'Your Location',
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#a855f7',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
      });

      /* Click to move */
      gmap.current.addListener('click', (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
      });
    } else {
      gmap.current.setCenter(center);
      marker.current.setPosition(center);
    }

    /* Circle */
    if (circle.current) circle.current.setMap(null);
    circle.current = new maps.Circle({
      map:           gmap.current,
      center,
      radius:        radius * 1000,
      strokeColor:   '#a855f7',
      strokeOpacity: 0.8,
      strokeWeight:  2,
      fillColor:     '#a855f7',
      fillOpacity:   0.12,
    });
  }, [mapsReady, coords, radius]);

  useEffect(() => { drawMap(); }, [drawMap]);

  /* ── Reverse geocode ── */
  const reverseGeocode = (lat, lng) => {
    if (!geocoder.current) return;
    geocoder.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        setAddress(results[0].formatted_address);
        setSearchVal(results[0].formatted_address);
      }
    });
  };

  /* ── Autocomplete ── */
  const handleSearchChange = (val) => {
    setSearchVal(val);
    if (!val.trim() || !acService.current) { setSuggestions([]); return; }
    acService.current.getPlacePredictions(
      { input: val, componentRestrictions: { country: 'in' } },
      (preds, status) => {
        if (status === 'OK') { setSuggestions(preds); setShowSuggest(true); }
        else setSuggestions([]);
      }
    );
  };

  const selectSuggestion = (place) => {
    setSearchVal(place.description);
    setSuggestions([]); setShowSuggest(false);
    if (!geocoder.current) return;
    geocoder.current.geocode({ placeId: place.place_id }, (res, status) => {
      if (status === 'OK' && res[0]) {
        const lat = res[0].geometry.location.lat();
        const lng = res[0].geometry.location.lng();
        setCoords({ lat, lng });
        setAddress(res[0].formatted_address);
      }
    });
  };

  /* ── Current location ── */
  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setGettingLoc(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        reverseGeocode(lat, lng);
        setGettingLoc(false);
      },
      () => setGettingLoc(false)
    );
  };

  /* ── Save ── */
  const handleSave = async () => {
    await dispatch(updateLocation({ latitude: coords.lat, longitude: coords.lng }));
    await dispatch(updateServiceArea({ maxServiceRadiusKm: radius }));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const isLoading = loading.location || loading.settings;

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-6 pt-8 pb-4"
      >
                   <BackButton className='my-3' />
        
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-[color-mix(in srgb, var(--primary), transparent 85%)]">
            <Map size={22} className="text-primary" />
          </div>
          <h1 className="text-2xl font-black font-montserrat tracking-tight text-base-content">
            Location & Service Area
          </h1>
        </div>
        <p className="text-sm ml-12 text-[color-mix(in oklch, var(--base-content) 55%, transparent)]">
          Set your location and service radius for bookings
        </p>
      </motion.div>

      <div className="px-6 pb-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left Panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 flex flex-col gap-5"
        >
          {/* Search */}
          <div className="card p-5 relative rounded-[var(--r-box)]">
            <label className="block text-xs font-bold uppercase tracking-widest mb-3 text-[color-mix(in oklch, var(--base-content) 55%, transparent)]"
             >
              Search Location
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color-mix(in oklch, var(--base-content) 40%, transparent)]"
                />
              <input
                ref={searchRef}
                value={searchVal}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => suggestions.length && setShowSuggest(true)}
                placeholder="Search area, locality, city…"
                className="input-field w-full pl-9 pr-4 text-[0.875rem]"
               
              />
            </div>

            <AnimatePresence>
              {showSuggest && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute left-5 right-5 z-50 mt-1 rounded-xl overflow-hidden shadow-2xl bg-base-200 border border-base-300"
                 
                >
                  {suggestions.map((s) => (
                    <button
                      key={s.place_id}
                      onClick={() => selectSuggestion(s)}
                      className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-base-300 text-[0.8125rem]"
                     
                      onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--primary), transparent 90%)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = ''}
                    >
                      <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
                      <span className="text-base-content">{s.description}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Current Location Button */}
            <button
              onClick={getCurrentLocation}
              disabled={gettingLoc}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all bg-[color-mix(in srgb, var(--secondary), transparent 85%)] text-secondary border border-[color-mix(in srgb, var(--secondary), transparent 70%)]"
             
            >
              {gettingLoc
                ? <Loader2 size={15} className="animate-spin" />
                : <Crosshair size={15} />}
              {gettingLoc ? 'Getting location…' : 'Use Current Location'}
            </button>
          </div>

          {/* Radius Selector */}
          <div className="card p-5 rounded-[var(--r-box)]">
            <label className="block text-xs font-bold uppercase tracking-widest mb-3 text-[color-mix(in oklch, var(--base-content) 55%, transparent)]"
             >
              Service Radius
            </label>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl font-black font-montserrat text-primary">{radius}</span>
                  <span className="text-sm font-semibold text-[color-mix(in oklch, var(--base-content) 55%, transparent)]">km</span>
                </div>
                <input
                  type="range" min={1} max={30} value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div className="flex justify-between text-xs mt-1 text-[color-mix(in oklch, var(--base-content) 40%, transparent)]"
                 >
                  <span>1 km</span><span>30 km</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className="py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: radius === r ? 'var(--primary)' : 'var(--base-300)',
                    color: radius === r ? 'var(--primary-content)' : 'var(--base-content)',
                    transform: radius === r ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {r}km
                </button>
              ))}
            </div>
          </div>

          {/* Current address card */}
          {(address || profile?.lastKnownAddress) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="card p-4 rounded-[var(--r-box)] bg-[color-mix(in srgb, var(--primary), transparent 92%)]"
             
            >
              <div className="flex gap-3 items-start">
                <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest mb-1 text-[color-mix(in oklch, var(--base-content) 50%, transparent)]"
                   >
                    Selected Location
                  </p>
                  <p className="text-sm font-medium text-base-content">
                    {address || profile?.lastKnownAddress}
                  </p>
                  <p className="text-xs mt-1 text-[color-mix(in oklch, var(--base-content) 50%, transparent)]">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error */}
          <AnimatePresence>
            {(locError || mapError) && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="alert alert-error"
              >
                <AlertCircle size={16} />
                <span className="text-sm">{locError || mapError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="btn-primary-cta w-full flex items-center justify-center gap-2"
          >
            {isLoading
              ? <Loader2 size={18} className="animate-spin" />
              : saved
              ? <><CheckCircle2 size={18} /> Location Saved!</>
              : <><MapPin size={18} /> Update Location</>}
          </button>
        </motion.div>

        {/* ── Map Panel ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-3"
        >
          <div className="card overflow-hidden rounded-[var(--r-box)] h-[520px] relative">
            {mapError ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 bg-base-200"
               >
                <AlertCircle size={40} className="text-error" />
                <p className="text-sm text-center px-6 text-base-content">{mapError}</p>
              </div>
            ) : !mapsReady ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 bg-base-200"
               >
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm text-[color-mix(in oklch, var(--base-content) 55%, transparent)]">
                  Loading map…
                </p>
              </div>
            ) : (
              <div ref={mapRef} className="w-full h-full" />
            )}

            {/* Map overlay info */}
            {mapsReady && (
              <div className="absolute bottom-4 left-4 right-4 flex gap-2 pointer-events-none">
                <div className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 bg-black/75 text-[#fff] backdrop-blur-[8px]"
                 >
                  <Radio size={12} className="text-[#a855f7]" />
                  Radius: {radius} km · Click map to reposition
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}