// sockets/socketAuth.js
//
// Socket.IO connections can't use Express middleware, so JWT verification +
// session validation is re-implemented here at the `io.use()` handshake
// layer — same checks as middleware/authmiddleware.js#protect (session
// revocation, block status), so a revoked/blocked user can't keep an old
// socket connection alive after their token would already be rejected on
// REST calls.

import jwt from 'jsonwebtoken';
import User from '../../models/User.js'; // existing shared model
import { SocketAuthError } from '../utils/errors.js';

export function socketAuthMiddleware() {
  return async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
        null;

      if (!token) return next(new SocketAuthError('No authentication token provided.'));

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return next(new SocketAuthError('Invalid or expired token.'));
      }

      const user = await User.findById(decoded.id).select('+auditSessions');
      if (!user) return next(new SocketAuthError('Account no longer exists.'));

      const sessionId = decoded.sessionId ?? null;
      if (sessionId) {
        const sessionExists = (user.auditSessions ?? []).some((s) => s._id.toString() === sessionId);
        if (!sessionExists) return next(new SocketAuthError('Session has been revoked.'));
      }

      if (user.isCurrentlyBlocked) return next(new SocketAuthError('Account has been suspended.'));

      socket.user = user;
      socket.sessionId = sessionId;
      next();
    } catch (err) {
      next(new SocketAuthError(err.message));
    }
  };
}
