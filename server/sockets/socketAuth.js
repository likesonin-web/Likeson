// sockets/socketAuth.js
//
// Authenticates every socket connection using the SAME JWT + sessionId
// validation logic as the REST `protect` middleware, so a revoked session
// (remote sign-out) also kills live sockets, not just future REST calls.

import jwt from 'jsonwebtoken';
import User from '../../models/User.js';

export const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('AUTH_REQUIRED'));

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new Error(err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID'));
    }

    const user = await User.findById(decoded.id).select('+auditSessions');
    if (!user) return next(new Error('USER_NOT_FOUND'));

    const sessionId = decoded.sessionId ?? null;
    if (sessionId) {
      const sessionExists = (user.auditSessions ?? []).some((s) => s._id.toString() === sessionId);
      if (!sessionExists) return next(new Error('SESSION_REVOKED'));
    }

    if (user.isCurrentlyBlocked) return next(new Error('ACCOUNT_BLOCKED'));

    socket.user = user;
    socket.sessionId = sessionId;
    next();
  } catch (err) {
    console.error('[socketAuth] unexpected error:', err);
    next(new Error('AUTH_FAILED'));
  }
};
