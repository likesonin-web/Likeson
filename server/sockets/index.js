// sockets/index.js
//
// Call `attachSupportSockets(io)` once, from your main server bootstrap,
// on the SAME io instance already used elsewhere in the app (reuses
// existing Socket.IO server — does not create a second one).
//
// Horizontal scaling: pass a Redis adapter to `io` BEFORE calling this
// (e.g. `io.adapter(createAdapter(pubClient, subClient))`) so `io.to(room)`
// broadcasts reach sockets connected to other Node processes.

import os from 'os';
import { socketAuthMiddleware } from './socketAuth.js';
import { registerSocketHandlers } from './socketHandlers.js';
import PresenceService from '../services/PresenceService.js';

const SERVER_INSTANCE_ID = `${os.hostname()}-${process.pid}`;

export const attachSupportSockets = (io) => {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    registerSocketHandlers(io, socket, SERVER_INSTANCE_ID);
  });

  // Periodic sweep for sockets that died without a clean 'disconnect'
  // (e.g. client crash, network drop) so presence doesn't get stuck "online".
  const sweepInterval = setInterval(() => {
    PresenceService.sweepStaleConnections().catch((err) =>
      console.error('[sockets] presence sweep failed:', err.message)
    );
  }, 60 * 1000);
  sweepInterval.unref();

  return io;
};
