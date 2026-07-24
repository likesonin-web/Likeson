/**
 * ticket.routes.js — Likeson.in
 * Business logic lives in controllers/ticket.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { mongoSanitize } from '../middleware/mongoSanitize.middleware.js';
import { loadTicketAndCheckAccess } from '../middleware/ticketAccess.middleware.js';
import { requireTicketCreatorRole, requireStatusChangePermission } from '../middleware/supportRbac.middleware.js';
import { ticketCreateRateLimiter } from '../middleware/rateLimiter.middleware.js';
import {
  createTicketSchema,
  updateTicketSchema,
  changeStatusSchema,
  changePrioritySchema,
  rateTicketSchema,
  listTicketsQuerySchema,
  ticketIdParamSchema,
} from '../validators/ticket.validator.js';
import * as ctrl from '../controllers/ticket.controller.js';

const router = express.Router();

router.use(protect, getDeviceInfo, mongoSanitize)
router.post('/', requireTicketCreatorRole, ticketCreateRateLimiter, validate(createTicketSchema), ctrl.post);
router.get('/', validate(listTicketsQuerySchema, 'query'), ctrl.get);
router.get('/:ticketId', validate(ticketIdParamSchema, 'params'), loadTicketAndCheckAccess, ctrl.getByTicketId);
router.patch('/:ticketId', validate(ticketIdParamSchema, 'params'), validate(updateTicketSchema), loadTicketAndCheckAccess, ctrl.patchByTicketId);
router.patch('/:ticketId/status', validate(ticketIdParamSchema, 'params'), validate(changeStatusSchema), loadTicketAndCheckAccess, ctrl.patchByTicketIdStatus);
router.patch('/:ticketId/priority', validate(ticketIdParamSchema, 'params'), validate(changePrioritySchema), requireStatusChangePermission, // priority change gated the same as status (staff-only)
  loadTicketAndCheckAccess, ctrl.patchByTicketIdPriority);
router.post('/:ticketId/assign', validate(ticketIdParamSchema, 'params'), ctrl.postByTicketIdAssign);
router.get('/:ticketId/assignment-history', validate(ticketIdParamSchema, 'params'), loadTicketAndCheckAccess, ctrl.getByTicketIdAssignmentHistory);
router.get('/:ticketId/timeline', validate(ticketIdParamSchema, 'params'), loadTicketAndCheckAccess, ctrl.getByTicketIdTimeline);
router.post('/:ticketId/rate', validate(ticketIdParamSchema, 'params'), validate(rateTicketSchema), ctrl.postByTicketIdRate);

export default router;
