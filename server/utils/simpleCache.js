/**
 * simpleCache.js
 * Minimal in-process TTL cache. Swap for Redis in multi-instance deployments —
 * interface (get/set/del) is intentionally Redis-compatible so that swap is a
 * one-file change.
 */

const store = new Map(); // key -> { value, expiresAt }

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value, ttlSeconds = 60) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheDel(keyPrefix) {
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

export async function cached(key, ttlSeconds, fn) {
  const hit = cacheGet(key);
  if (hit !== null) return hit;
  const value = await fn();
  cacheSet(key, value, ttlSeconds);
  return value;
}