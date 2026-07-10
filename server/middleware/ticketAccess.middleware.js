// middlewares/ticketAccess.middleware.js
//
// Loads the ticket once per request and attaches it to req.ticket so
// downstream route handlers/services don't re-fetch it. Enforces the core
// visibility rule at the edge, in addition to (not instead of) the same
// check inside the service layer — defense in depth, since sockets call
// services directly without ever passing through this Express middleware.

import SupportTicket from '../models/SupportTicket.js';
import SupportParticipant from '../models/SupportParticipant.js';
import { NotFoundError } from '../utils/errors.js';
import { assertCanViewTicket } from '../utils/supportPermissions.util.js';
import asyncHandler from '../utils/asyncHandler.js';

export const loadTicketAndCheckAccess = asyncHandler(async (req, res, next) => {
  const { ticketId } = req.params;

  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw new NotFoundError('Ticket');

  const isActiveParticipant = await SupportParticipant.exists({
    ticket: ticketId,
    userId: req.user._id,
    active: true,
  });

  assertCanViewTicket({
    userRole: req.user.role,
    userId: req.user._id,
    ticket,
    isActiveParticipant: !!isActiveParticipant,
  });

  req.ticket = ticket;
  req.isActiveParticipant = !!isActiveParticipant;
  next();
});
