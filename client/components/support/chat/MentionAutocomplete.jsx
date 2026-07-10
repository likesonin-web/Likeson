'use client';

import { useEffect, useState } from 'react';
import PresenceAvatar from '../shared/PresenceAvatar';

/**
 * WhatsApp-style "@" mention dropdown. Purely presentational + keyboard
 * navigation — the caret-position detection and text-splicing on select
 * live in ChatInput, which owns the textarea.
 *
 * @param {{
 *   options: Array<{ id: string, name: string, role: string, avatar?: string, token: string }>,
 *   onSelect: (option: object) => void,
 *   onClose: () => void,
 * }} props
 */
export default function MentionAutocomplete({ options, onSelect, onClose }) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Query changes -> reset selection back to the top match.
  useEffect(() => setActiveIndex(0), [options]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + options.length) % options.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (options[activeIndex]) onSelect(options[activeIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [options, activeIndex, onSelect, onClose]);

  if (!options.length) return null;

  return (
    <div
      role="listbox"
      className="absolute bottom-full left-0 mb-2 w-64 max-h-56 overflow-y-auto card bg-base-100 shadow-depth-lg z-30 py-1"
    >
      {options.map((opt, i) => (
        <button
          key={opt.id}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          onMouseEnter={() => setActiveIndex(i)}
          onClick={() => onSelect(opt)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left ${i === activeIndex ? 'bg-base-200' : ''}`}
        >
          <PresenceAvatar user={{ _id: opt.id, name: opt.name, avatar: opt.avatar }} size="xs" showPresence={false} />
          <span className="flex-1 min-w-0">
            <span className="block text-xs font-semibold truncate">{opt.name}</span>
            <span className="block text-[10px] text-base-content/50 capitalize">{opt.role}</span>
          </span>
        </button>
      ))}
    </div>
  );
}