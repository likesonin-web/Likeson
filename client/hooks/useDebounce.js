'use client';
// path: hooks/useDebounce.js
import { useEffect, useState } from 'react';

export default function useDebounce(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
