/**
 * @file logger.js
 * @desc Minimal structured JSON logger shared across controllers.
 */

const log = {
  info: (msg, meta = {}) =>
    console.log(JSON.stringify({ level: 'info', msg, ...meta, ts: new Date().toISOString() })),

  warn: (msg, meta = {}) =>
    console.warn(JSON.stringify({ level: 'warn', msg, ...meta, ts: new Date().toISOString() })),

  error: (msg, meta = {}) =>
    console.error(JSON.stringify({ level: 'error', msg, ...meta, ts: new Date().toISOString() })),
};

export default log;