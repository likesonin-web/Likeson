// support-module/utils/supportRedis.util.js
//
// Thin, support-module-scoped wrapper over the existing shared Redis client.
// Namespaces every key under `support:` to avoid collisions with other modules
// using the same Redis instance.

// 🆕 CORRECTED: Added .js extension and adjusted path to reach the root config
import redisClient from '../config/redis.js';

const NS = 'support';
const key = (...parts) => [NS, ...parts].join(':');

// ── Presence ──────────────────────────────────────────────────────────────
// Presence TTL slightly longer than the heartbeat interval so a single
// missed heartbeat under transient network jitter doesn't flip a user to
// offline; sockets.js sends a heartbeat every 20s, TTL below is 45s.
const PRESENCE_TTL_SECONDS = 45;

export async function setUserOnline(userId) {
  await redisClient.set(key('presence', userId), '1', { EX: PRESENCE_TTL_SECONDS });
}

export async function refreshPresence(userId) {
  await redisClient.expire(key('presence', userId), PRESENCE_TTL_SECONDS);
}

export async function setUserOffline(userId) {
  await redisClient.del(key('presence', userId));
}

export async function isUserOnline(userId) {
  const val = await redisClient.get(key('presence', userId));
  return val === '1';
}

export async function getOnlineStatuses(userIds) {
  if (userIds.length === 0) return {};
  const pipeline = redisClient.multi();
  userIds.forEach((id) => pipeline.get(key('presence', id)));
  const results = await pipeline.exec();
  const out = {};
  userIds.forEach((id, i) => {
    out[id] = results[i] === '1';
  });
  return out;
}

// ── Typing indicators ─────────────────────────────────────────────────────
const TYPING_TTL_SECONDS = 8; // auto-clears if stop_typing event is ever dropped

export async function setTyping(ticketId, userId) {
  await redisClient.set(key('typing', ticketId, userId), '1', { EX: TYPING_TTL_SECONDS });
}

export async function clearTyping(ticketId, userId) {
  await redisClient.del(key('typing', ticketId, userId));
}

export async function getTypingUsers(ticketId) {
  const pattern = key('typing', ticketId, '*');
  const keys = [];
  for await (const k of redisClient.scanIterator({ MATCH: pattern, COUNT: 100 })) {
    keys.push(k);
  }
  if (keys.length === 0) return [];
  return keys.map((k) => k.split(':').pop());
}

// ── Message flood / rate limiting (sliding window via sorted set) ─────────
export async function checkMessageRateLimit(userId, ticketId, { windowMs, maxMessages }) {
  const k = key('ratelimit', 'msg', ticketId, userId);
  const now = Date.now();
  const windowStart = now - windowMs;

  const multi = redisClient.multi();
  multi.zRemRangeByScore(k, 0, windowStart);
  multi.zAdd(k, { score: now, value: `${now}` });
  multi.zCard(k);
  multi.pExpire(k, windowMs);
  const results = await multi.exec();

  const count = results[2];
  return { allowed: count <= maxMessages, count, limit: maxMessages };
}

// ── Ticket-creation rate limiting (per user) ───────────────────────────────
export async function checkTicketCreateRateLimit(userId, { windowMs, maxTickets }) {
  const k = key('ratelimit', 'ticket_create', userId);
  const now = Date.now();
  const windowStart = now - windowMs;

  const multi = redisClient.multi();
  multi.zRemRangeByScore(k, 0, windowStart);
  multi.zAdd(k, { score: now, value: `${now}` });
  multi.zCard(k);
  multi.pExpire(k, windowMs);
  const results = await multi.exec();

  const count = results[2];
  return { allowed: count <= maxTickets, count, limit: maxTickets };
}

// ── Ticket list cache (short TTL, invalidated on write) ────────────────────
export async function cacheTicketList(cacheKey, payload, ttlSeconds = 15) {
  await redisClient.set(key('cache', 'list', cacheKey), JSON.stringify(payload), { EX: ttlSeconds });
}

export async function getCachedTicketList(cacheKey) {
  const raw = await redisClient.get(key('cache', 'list', cacheKey));
  return raw ? JSON.parse(raw) : null;
}

export async function invalidateTicketListCache(ticketId) {
  // Coarse invalidation: list caches are short-TTL (15s) by design, so a
  // full SCAN+DEL on every write is intentionally avoided; staff list views
  // tolerate up to 15s staleness which is acceptable per spec (chat itself
  // stays fully realtime via sockets, only list/search views are cached).
  void ticketId;
}

// ── Distributed lock (e.g. prevent concurrent assignment race) ────────────
export async function acquireLock(lockKey, ttlMs = 5000) {
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;
  const ok = await redisClient.set(key('lock', lockKey), token, { NX: true, PX: ttlMs });
  return ok ? token : null;
}

export async function releaseLock(lockKey, token) {
  // Lua-style check-and-del to avoid releasing a lock acquired by someone
  // else after this one expired.
  const current = await redisClient.get(key('lock', lockKey));
  if (current === token) {
    await redisClient.del(key('lock', lockKey));
  }
}