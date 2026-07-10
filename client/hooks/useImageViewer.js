// src/hooks/useImageViewer.js
'use client';
import { useCallback, useState } from 'react';

export function useImageViewer() {
  const [viewerState, setViewerState] = useState({ isOpen: false, images: [], startIndex: 0 });

  const open = useCallback((images, startIndex = 0) => {
    setViewerState({ isOpen: true, images, startIndex });
  }, []);

  const close = useCallback(() => {
    setViewerState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return { ...viewerState, open, close };
}
