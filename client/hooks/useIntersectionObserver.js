// src/hooks/useIntersectionObserver.js
'use client';
import { useEffect, useRef, useState } from 'react';

export function useIntersectionObserver({ threshold = 0.1, rootMargin = '0px', enabled = true } = {}) {
  const targetRef = useRef(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!enabled || !targetRef.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { threshold, rootMargin }
    );
    observer.observe(targetRef.current);
    return () => observer.disconnect();
  }, [threshold, rootMargin, enabled]);

  return { targetRef, isIntersecting };
}
