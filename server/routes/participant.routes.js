// routes/participant.routes.js

import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { mongoSanitize } from '../middleware/mongoSanitize.middleware.js';
import { loadTicketAndCheckAccess } from '../middleware/ticketAccess.middleware.js';
import { addParticipantSchema, removeParticipantSchema } from '../validators/ticket.validator.js';
import { ticketIdParamSchema } from '../validators/ticket.validator.js';
import * as participantService from '../services/participant.service.js';

const router = Router({ mergeParams: true });

router.use(protect, getDeviceInfo, mongoSanitize);

router.get(
  '/',
  validate(ticketIdParamSchema, 'params'),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const participants = await participantService.listParticipants(req.params.ticketId);
    res.status(200).json({ success: true, data: participants });
  })
);

router.post(
  '/',
  validate(ticketIdParamSchema, 'params'),
  validate(addParticipantSchema),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const participant = await participantService.addParticipant({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      userId: req.body.userId,
      role: req.body.role,
      io: req.app.get('io'),
    });
    res.status(201).json({ success: true, data: participant });
  })
);

router.delete(
  '/:userId',
  validate(ticketIdParamSchema, 'params'),
  validate(removeParticipantSchema),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const participant = await participantService.removeParticipant({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      userId: req.params.userId,
      reason: req.body.reason,
      io: req.app.get('io'),
    });
    res.status(200).json({ success: true, data: participant });
  })
);

export default router;
