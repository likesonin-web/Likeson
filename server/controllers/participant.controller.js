// controllers/participant.controller.js

import asyncHandler from '../utils/asyncHandler.js';
import * as participantService from '../services/participant.service.js';

// GET '/'
export const get = asyncHandler(async (req, res) => {
  const participants = await participantService.listParticipants(req.params.ticketId);
  res.status(200).json({ success: true, data: participants });
});

// POST '/'
export const post = asyncHandler(async (req, res) => {
  const participant = await participantService.addParticipant({
    ticketId: req.params.ticketId,
    actor: req.user,
    deviceInfo: req.deviceInfo,
    userId: req.body.userId,
    role: req.body.role,
    io: req.app.get('io'),
  });
  res.status(201).json({ success: true, data: participant });
});

// DELETE '/:userId'
export const deleteByUserId = asyncHandler(async (req, res) => {
  const participant = await participantService.removeParticipant({
    ticketId: req.params.ticketId,
    actor: req.user,
    deviceInfo: req.deviceInfo,
    userId: req.params.userId,
    reason: req.body.reason,
    io: req.app.get('io'),
  });
  res.status(200).json({ success: true, data: participant });
});