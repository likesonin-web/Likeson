/**
 * @file heroPageHelpers.js
 * @desc Shared helpers used by heroPageRoutes.js — response formatting,
 * validation, ImageKit upload, cache clearing, and audit logging.
 */

import mongoose from 'mongoose';
import { invalidatePattern, invalidateKey } from './cacheInvalidation.js';

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function sendSuccess(res, status, message, extra = {}) {
  return res.status(status).json({
    success: true,
    message,
    ...extra, // e.g. { data }, { pagination }
  });
}

export function sendError(res, status, message, errors = undefined) {
  return res.status(status).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION / SANITIZATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Trims strings; passes through non-strings (numbers, undefined, null) as-is.
 * Returns undefined for undefined input so callers can distinguish
 * "field not sent" from "field sent as empty string".
 */
export function sanitizeStr(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  return value.trim();
}

/**
 * Parses page/limit query params into safe, bounded numbers.
 * Defaults: page=1, limit=20. Max limit: 100.
 */
export function parsePagination(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  page = Number.isFinite(page) && page > 0 ? page : 1;
  limit = Number.isFinite(limit) && limit > 0 ? limit : 20;
  limit = Math.min(limit, 100);

  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Validates a single CTA button object.
 * Expected shape: { label: string, url: string, style?: 'primary'|'secondary'|'outline', target?: '_self'|'_blank' }
 * Returns an error message string if invalid, or null if valid.
 */
export function validateCtaButton(btn) {
  if (!btn || typeof btn !== 'object') {
    return 'Each ctaButton must be an object';
  }
  if (!btn.label || typeof btn.label !== 'string' || !btn.label.trim()) {
    return 'ctaButton.label is required';
  }
  if (!btn.url || typeof btn.url !== 'string' || !btn.url.trim()) {
    return 'ctaButton.url is required';
  }
  if (btn.style && !['primary', 'secondary', 'outline'].includes(btn.style)) {
    return 'ctaButton.style must be primary | secondary | outline';
  }
  if (btn.target && !['_self', '_blank'].includes(btn.target)) {
    return 'ctaButton.target must be _self | _blank';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGEKIT UPLOAD HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to ImageKit under a hero-specific folder/filename.
 * @param {ImageKit} imagekit - the ImageKit client instance
 * @param {Buffer} buffer - file buffer (e.g. req.file.buffer from multer memoryStorage)
 * @param {string} originalName - original filename, used to derive extension
 * @param {string} heroId - hero page id (or temp id), used to namespace the file
 */
export async function uploadToImageKit(imagekit, buffer, originalName, heroId) {
  const ext = originalName?.includes('.')
    ? originalName.slice(originalName.lastIndexOf('.'))
    : '';
  const fileName = `hero-${heroId}-${Date.now()}${ext}`;

  const result = await imagekit.upload({
    file: buffer,               // ImageKit SDK accepts a Buffer directly
    fileName,
    folder: '/hero-pages',
    useUniqueFileName: false,
  });

  return result; // { url, fileId, ... }
}

// ─────────────────────────────────────────────────────────────────────────────
// CACHE CLEARING HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clears all cached responses affected by a hero page mutation:
 * - the public "active hero" cache
 * - the paginated list cache (all pages/filters)
 * - the single hero-by-id cache, if an id is given
 */
export async function clearHeroCaches(heroId) {
  await Promise.all([
    invalidateKey('hero:active'),
    invalidatePattern('hero:list:*'),
    heroId ? invalidateKey(`hero:${heroId}`) : Promise.resolve(),
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOG HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lightweight audit logger. Replace the console.log with a write to an
 * AuditLog Mongo collection if you want persistent audit trails.
 */
export function audit(action, userId, targetId, meta = {}) {
  console.log(JSON.stringify({
    level: 'audit',
    action,
    userId: userId?.toString?.() ?? userId,
    targetId: targetId?.toString?.() ?? targetId,
    meta,
    ts: new Date().toISOString(),
  }));
}