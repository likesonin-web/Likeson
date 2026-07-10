// utils/cursorPagination.js
//
// Cursor pagination on (createdAt, _id) — stable under concurrent inserts,
// unlike skip/limit. Cursor is an opaque base64 string so clients never
// construct or parse it themselves.

import { ValidationError } from './errors.js';

export function encodeCursor(doc) {
  if (!doc) return null;
  const payload = JSON.stringify({ createdAt: doc.createdAt.toISOString(), id: String(doc._id) });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const payload = Buffer.from(cursor, 'base64url').toString('utf8');
    const { createdAt, id } = JSON.parse(payload);
    if (!createdAt || !id) throw new Error('malformed');
    return { createdAt: new Date(createdAt), id };
  } catch {
    throw new ValidationError('Invalid pagination cursor.');
  }
}

/**
 * Builds a Mongo filter fragment for "strictly before/after this cursor"
 * ordered by createdAt desc, _id desc (ties broken by _id, since _id is
 * monotonic and unique — avoids duplicate/missed rows across pages when two
 * documents share a createdAt millisecond).
 */
export function buildCursorFilter(cursor, direction = 'before') {
  const decoded = decodeCursor(cursor);
  if (!decoded) return {};

  const op = direction === 'before' ? '$lt' : '$gt';
  return {
    $or: [
      { createdAt: { [op]: decoded.createdAt } },
      { createdAt: decoded.createdAt, _id: { [op]: decoded.id } },
    ],
  };
}

export function buildPageResult(docs, limit) {
  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;
  return {
    items: page,
    hasMore,
    nextCursor: hasMore ? encodeCursor(page[page.length - 1]) : null,
  };
}
