// sockets/supportSocket.auth.js
//
// Socket handshake auth. Mirrors middleware/authmiddleware.js#protect's JWT
// + sessionId + block-status checks, since sockets never pass through
// Express middleware — this IS the socket equivalent of `protect`.

import jwt from 'jsonwebtoken';
import User from '../models/User.js'; // existing shared model
import { SocketAuthError } from '../utils/errors.js';

export function supportSocketAuthMiddleware() {
  return async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

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

      if (user.isCurrentlyBlocked) return next(new SocketAuthError('Account is suspended.'));

      socket.user = user;
      socket.sessionId = sessionId;
      next();
    } catch (err) {
      next(new SocketAuthError(err.message));
    }
  };
}
