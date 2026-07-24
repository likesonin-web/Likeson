"use client";

import { useEffect, useState } from "react";

/**
 * Returns `value`, updated only after `delay` ms of no changes.
 * Used to keep autocomplete from firing a request on every keystroke.
 */
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}