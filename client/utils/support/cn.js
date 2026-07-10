// utils/support/cn.js

import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines conditional classnames (clsx) with Tailwind conflict resolution
 * (tailwind-merge) — e.g. cn('px-2', condition && 'px-4') correctly keeps
 * only px-4 rather than emitting both classes.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
