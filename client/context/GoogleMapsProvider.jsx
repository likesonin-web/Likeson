'use client';

import React, { createContext, useContext } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';

export const GoogleMapsContext = createContext({
  isLoaded: false,
  loadError: null,
});

const GOOGLE_MAPS_LIBRARIES = ['geometry', 'places', 'marker'];

export function GoogleMapsProvider({ children }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id:                        'google-map-script',
    googleMapsApiKey:          process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
    libraries:                 GOOGLE_MAPS_LIBRARIES,
    mapIds:                    [process.env.NEXT_PUBLIC_MAP_ID || ''],
    version:                   'weekly',
    language:                  'en',
    region:                    'IN',
    preventGoogleFontsLoading: true,
  });

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext);
  if (!context) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider');
  }
  return context;
}

export default GoogleMapsProvider;
