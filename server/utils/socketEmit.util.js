// utils/socketEmit.util.js
//
// Every service that pushes a live update (message send/edit/delete/react,
// participant joined/left, assignment, status change) was calling
// `io.to(room).emit(...)` directly on whatever `io` reference the route
// handed it — which, per this module's integration point, is the BASE
// Socket.IO server instance (`app.set('io', io)` in the host app), not a
// namespace.
//
// The frontend, however, connects to the `/support` namespace specifically:
//   io(`${SOCKET_URL}/support`, ...)   — see frontend/services/support/supportSocket.js
//
// `io.to(room).emit(...)` on the base server broadcasts on the default `/`
// namespace, which no client is ever connected to. Every one of those calls
// was silently reaching zero sockets — the only way any participant ever
// saw another participant's message/edit/reaction/assignment/status-change
// was a full page refresh (which re-fetches over REST instead of relying on
// the push). This helper normalizes every call site onto `/support`,
// regardless of whether the `io` reference passed in is the base server
// (has `.of()`) or already a namespace/room-scoped emitter.
const SUPPORT_NAMESPACE = '/support';

export function emitToTicket(io, ticketId, event, payload) {
  if (!io) return; // io is optional in some call sites (e.g. background jobs without a live request)
  const nsp = typeof io.of === 'function' ? io.of(SUPPORT_NAMESPACE) : io;
  nsp.to(`ticket:${ticketId}`).emit(event, payload);
}

export function emitToUser(io, userId, event, payload) {
  if (!io) return;
  const nsp = typeof io.of === 'function' ? io.of(SUPPORT_NAMESPACE) : io;
  nsp.to(`user:${userId}`).emit(event, payload);
}