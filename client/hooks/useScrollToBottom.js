// src/hooks/useScrollToBottom.js
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Auto-scrolls a message container to bottom on new content, but stops
 * auto-scrolling once the user has manually scrolled up to read history —
 * exactly like WhatsApp/Slack. Exposes `showJumpToBottom` for a floating button.
 */
export function useScrollToBottom(dependencyList = []) {
  const containerRef = useRef(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowJumpToBottom(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < 120;
    setShowJumpToBottom(distanceFromBottom > 300);
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) scrollToBottom('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencyList);

  return { containerRef, handleScroll, scrollToBottom, showJumpToBottom };
}
