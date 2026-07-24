/**
 * @file finaliseLogin.js
 * @desc Shared post-authentication step for password login, OTP login, and
 * Google OAuth login. Records a new session, updates login metadata, and
 * issues a JWT that embeds the sessionId (so it can be read back off
 * req.user.sessionId by protect() on later requests).
 */

import jwt from 'jsonwebtoken';

/**
 * @param {Document} user - a full Mongoose User document (must include auditSessions in the query projection)
 * @param {import('express').Request} req - needs req.deviceInfo (ipAddress, userAgent, deviceName) set by getDeviceInfo middleware
 * @returns {Promise<{ token: string, sessionId: string }>}
 */
export async function finaliseLogin(user, req) {
  const ipAddress  = req.deviceInfo?.ipAddress  ?? 'Unknown';
  const userAgent  = req.deviceInfo?.userAgent  ?? 'Unknown';
  const deviceName = req.deviceInfo?.deviceName ?? 'Unknown';

  const now = new Date();

  // Push a new session record
  user.auditSessions = user.auditSessions ?? [];
  user.auditSessions.push({
    ipAddress,
    userAgent,
    deviceName,
    loginAt:      now,
    lastActiveAt: now,
  });

  // Keep only the most recent 20 sessions to avoid unbounded growth
  if (user.auditSessions.length > 20) {
    user.auditSessions = user.auditSessions.slice(-20);
  }

  const newSession = user.auditSessions[user.auditSessions.length - 1];
  const sessionId  = newSession._id.toString();

  user.isOnline     = true;
  user.lastLoginAt  = now;
  user.lastLoginIp  = ipAddress;
  user.lastActiveAt = now;
  user.loginCount   = (user.loginCount ?? 0) + 1;

  await user.save();

  const token = jwt.sign(
    { id: user._id.toString(), sessionId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
  );

  return { token, sessionId };
}