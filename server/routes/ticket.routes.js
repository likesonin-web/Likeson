// routes/ticket.routes.js

import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js'; // existing shared middleware
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
import * as ticketService from '../services/ticket.service.js';
import * as assignmentService from '../services/assignment.service.js';
import * as timelineService from '../services/timeline.service.js';

const router = Router();

router.use(protect, getDeviceInfo, mongoSanitize);

// ── Create ────────────────────────────────────────────────────────────────
router.post(
  '/',
  requireTicketCreatorRole,
  ticketCreateRateLimiter,
  validate(createTicketSchema),
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.createTicket({ actor: req.user, deviceInfo: req.deviceInfo, payload: req.body });
    res.status(201).json({ success: true, data: ticket });
  })
);

// ── List / Search / Filter ───────────────────────────────────────────────
router.get(
  '/',
  validate(listTicketsQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await ticketService.listTickets({ actor: req.user, query: req.query });
    res.status(200).json({ success: true, ...result });
  })
);

// ── Get single ────────────────────────────────────────────────────────────
router.get(
  '/:ticketId',
  validate(ticketIdParamSchema, 'params'),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    res.status(200).json({ success: true, data: req.ticket });
  })
);

// ── Update (subject/description/priority/metadata) ──────────────────────
router.patch(
  '/:ticketId',
  validate(ticketIdParamSchema, 'params'),
  validate(updateTicketSchema),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.updateTicket({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      updates: req.body,
    });
    res.status(200).json({ success: true, data: ticket });
  })
);

// ── Status change ────────────────────────────────────────────────────────
router.patch(
  '/:ticketId/status',
  validate(ticketIdParamSchema, 'params'),
  validate(changeStatusSchema),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.changeStatus({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      status: req.body.status,
      reason: req.body.reason,
      io: req.app.get('io'),
    });
    res.status(200).json({ success: true, data: ticket });
  })
);

// ── Priority change ───────────────────────────────────────────────────────
router.patch(
  '/:ticketId/priority',
  validate(ticketIdParamSchema, 'params'),
  validate(changePrioritySchema),
  requireStatusChangePermission, // priority change gated the same as status (staff-only)
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const ticket = await ticketService.updateTicket({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      updates: { priority: req.body.priority },
    });
    res.status(200).json({ success: true, data: ticket });
  })
);

// ── Assignment ────────────────────────────────────────────────────────────
router.post(
  '/:ticketId/assign',
  validate(ticketIdParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const ticket = await assignmentService.assignTicket({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      assignees: req.body.assignees,
      note: req.body.note,
      io: req.app.get('io'),
    });
    res.status(200).json({ success: true, data: ticket });
  })
);

router.get(
  '/:ticketId/assignment-history',
  validate(ticketIdParamSchema, 'params'),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const history = await assignmentService.getAssignmentHistory(req.params.ticketId);
    res.status(200).json({ success: true, data: history });
  })
);

// ── Timeline ──────────────────────────────────────────────────────────────
router.get(
  '/:ticketId/timeline',
  validate(ticketIdParamSchema, 'params'),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const timeline = await timelineService.getTicketTimeline(req.params.ticketId, {
      limit: Number(req.query.limit) || 100,
      before: req.query.before ? new Date(req.query.before) : null,
    });
    res.status(200).json({ success: true, data: timeline });
  })
);

// ── Rating ────────────────────────────────────────────────────────────────
router.post(
  '/:ticketId/rate',
  validate(ticketIdParamSchema, 'params'),
  validate(rateTicketSchema),
  asyncHandler(async (req, res) => {
    const rating = await ticketService.rateTicket({
      ticketId: req.params.ticketId,
      actor: req.user,
      rating: req.body.rating,
      comment: req.body.comment,
    });
    res.status(201).json({ success: true, data: rating });
  })
);

export default router;
