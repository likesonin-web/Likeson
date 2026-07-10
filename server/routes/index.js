// routes/index.js
//
// Mount point: app.use('/api/support', supportRouter) in the main app file.

import { Router } from 'express';
import ticketRoutes from './ticket.routes.js';
import messageRoutes from './message.routes.js';
import participantRoutes from './participant.routes.js';
import { supportErrorHandler } from '../middleware/errorHandler.middleware.js';

const router = Router();

router.use('/tickets', ticketRoutes);
router.use('/tickets/:ticketId/messages', messageRoutes);
router.use('/tickets/:ticketId/participants', participantRoutes);

// Module-scoped error handler — mounted last, only catches errors from
// routes registered above it in this router.
router.use(supportErrorHandler);

export default router;
