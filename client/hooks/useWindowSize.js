// src/hooks/useWindowSize.js
'use client';
import { useEffect, useState } from 'react';

const BREAKPOINTS = { mobile: 640, tablet: 1024, desktop: 1280 };

export function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return {
    ...size,
    isMobile: size.width > 0 && size.width < BREAKPOINTS.mobile,
    isTablet: size.width >= BREAKPOINTS.mobile && size.width < BREAKPOINTS.tablet,
    isDesktop: size.width >= BREAKPOINTS.tablet,
  };
}
