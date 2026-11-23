// client/utils/support/formatters.ts

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(seconds?: number | null): string {
  if (!seconds && seconds !== 0) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatRelativeTime(date: string | number | Date): string {
  return dayjs(date).fromNow();
}

export function formatFullDate(date: string | number | Date): string {
  return dayjs(date).format('MMM D, YYYY h:mm A');
}

export function formatShortDate(date: string | number | Date): string {
  return dayjs(date).format('MMM D');
}

/** Truncates text to a max length with an ellipsis, word-boundary aware. */
export function truncate(text?: string | null, maxLength = 100): string {
  if (!text || text.length <= maxLength) return text || '';
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxLength)}…`;
}

/** Formats minutes into a human string (e.g. 95 -> "1h 35m") for SLA displays. */
export function formatMinutes(minutes?: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
