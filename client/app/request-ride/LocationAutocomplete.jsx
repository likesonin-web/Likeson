'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Autocomplete } from '@react-google-maps/api';
import { motion } from 'framer-motion';
import { MapPin, Loader2, X } from 'lucide-react';

function extractCity(place) {
  const comp = place.address_components || [];
  const city = comp.find(
    (c) => c.types.includes('locality') || c.types.includes('administrative_area_level_2'),
  );
  return city?.long_name || '';
}

/**
 * LocationAutocomplete
 * onChange receives: { coordinates: [lng, lat], address, label, city } | null
 *
 * `isLoaded` must come from the shared useGoogleMaps() hook (lib/useGoogleMaps.js),
 * called ONCE per page and passed down — never load the Maps script here directly,
 * or it will conflict with any other @react-google-maps/api component on the page.
 */
export default function LocationAutocomplete({
  label,
  note,
  placeholder,
  icon: Icon = MapPin,
  value,
  onChange,
  required = false,
  isLoaded,
  loadError,
}) {
  const autocompleteRef = useRef(null);
  const [inputText, setInputText] = useState(value?.label || value?.address || '');

  // Keep visible text in sync when `value` is cleared/changed externally
  // (e.g. parent resets the form). FIX: was previously a misused
  // `useState(fn, deps)` call — deps are ignored by useState, so this never
  // actually re-ran on value changes. useEffect is the correct hook here.
  useEffect(() => {
    setInputText(value?.label || value?.address || '');
  }, [value]);

  const handlePlaceChanged = useCallback(() => {
    if (!autocompleteRef.current) return;
    const place = autocompleteRef.current.getPlace();
    if (!place?.geometry?.location) {
      console.warn('[LocationAutocomplete] No geometry — pick a suggestion from the list.');
      return;
    }

    const coordinates = [place.geometry.location.lng(), place.geometry.location.lat()];
    const address = place.formatted_address || place.name || '';
    const placeLabel = place.name || address;
    const city = extractCity(place);

    setInputText(address);
    onChange({ coordinates, address, label: placeLabel, city });
  }, [onChange]);

  const handleClear = useCallback(() => {
    setInputText('');
    onChange(null);
  }, [onChange]);

  const handleTyping = (e) => {
    setInputText(e.target.value);
    if (value) onChange(null);
  };

  return (
    <div>
      <label className="label-text mb-1.5 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-primary" />
        {label}
        {required && <span className="text-error">*</span>}
      </label>

      <div className="relative">
        {isLoaded && !loadError ? (
          <Autocomplete
            onLoad={(ac) => {
              autocompleteRef.current = ac;
            }}
            onPlaceChanged={handlePlaceChanged}
            options={{
              componentRestrictions: { country: 'in' },
              fields: ['geometry', 'formatted_address', 'address_components', 'name'],
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={handleTyping}
              placeholder={placeholder}
              className="input-field pl-10 pr-9"
              autoComplete="off"
            />
          </Autocomplete>
        ) : (
          <input
            type="text"
            value={inputText}
            placeholder={loadError ? 'Location search unavailable' : 'Loading...'}
            className="input-field pl-10 pr-9"
            disabled
          />
        )}

        <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />

        {!isLoaded && !loadError && (
          <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 animate-spin" />
        )}

        {isLoaded && inputText && (
          <button
            type="button"
            onClick={handleClear}
            className="btn-circle btn-xs btn-ghost absolute right-1.5 top-1/2 -translate-y-1/2"
            aria-label="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {note && !loadError && <p className="label-text-alt mt-1">{note}</p>}
      {loadError && (
        <p className="text-xs text-error mt-1">
          Could not load location search. Check your connection and try again.
        </p>
      )}

      {value?.city && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-primary font-semibold mt-1"
        >
          {value.city}
        </motion.p>
      )}
    </div>
  );
}