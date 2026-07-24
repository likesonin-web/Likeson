/**
 * participant.routes.js — Likeson.in
 * Business logic lives in controllers/participant.controller.js.
 * This file only wires paths + middleware + controller functions.
 *
 * NOTE: mergeParams MUST be true here because this router is mounted
 * as a nested router under a parent path that contains :ticketId, e.g.:
 *   app.use('/api/tickets/:ticketId/participants', participantRoutes);
 * Without mergeParams, req.params.ticketId is undefined inside this
 * router, which is why ticketIdParamSchema validation was failing.
 */

import express from 'express';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { mongoSanitize } from '../middleware/mongoSanitize.middleware.js';
import { loadTicketAndCheckAccess } from '../middleware/ticketAccess.middleware.js';
import {
  addParticipantSchema,
  removeParticipantSchema,
  ticketIdParamSchema,
} from '../validators/ticket.validator.js';
import * as ctrl from '../controllers/participant.controller.js';

const router = express.Router({ mergeParams: true }); // ✅ fix: was express.Router() with no mergeParams

router.use(protect, getDeviceInfo, mongoSanitize);

router.get(
  '/',
  validate(ticketIdParamSchema, 'params'),
  loadTicketAndCheckAccess,
  ctrl.get
);

router.post(
  '/',
  validate(ticketIdParamSchema, 'params'),
  validate(addParticipantSchema),
  loadTicketAndCheckAccess,
  ctrl.post
);

router.delete(
  '/:userId',
  validate(ticketIdParamSchema, 'params'),
  validate(removeParticipantSchema),
  loadTicketAndCheckAccess,
  ctrl.deleteByUserId
);

export default router;