// support-module/middleware/supportAuth.js
import Ticket from '../models/Ticket.js';
import ChatRoom from '../models/ChatRoom.js';
import ChatParticipant from '../models/ChatParticipant.js';
import SupportAgent from '../models/SupportAgent.js';
import { INTERNAL_STAFF_ROLES } from '../utils/supportConstants.js';

export const isInternalStaff = (role) => INTERNAL_STAFF_ROLES.includes(role);

/** Blocks non-staff. Use on internal-note / assignment / escalation / analytics routes. */
export const requireInternalStaff = (req, res, next) => {
  if (!isInternalStaff(req.user?.role)) {
    return res.status(403).json({ message: 'Support staff access required.', code: 'FORBIDDEN' });
  }
  next();
};

/**
 * requireTicketAccess — loads ticket into req.ticket, verifies caller is
 * either the creator, the assigned agent, a watcher, or internal staff.
 * Attach AFTER protect. Param name defaults to :ticketId / :id.
 */
export const requireTicketAccess = (paramName = 'id') => async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params[paramName]);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found.', code: 'NOT_FOUND' });

    const uid = req.user._id.toString();
    const isOwner = ticket.creator.toString() === uid;
    const isAssignee = ticket.assignedAgent?.toString() === uid;
    const isWatcher = ticket.watchers.some((w) => w.toString() === uid);
    const staff = isInternalStaff(req.user.role);

    if (!isOwner && !isAssignee && !isWatcher && !staff) {
      return res.status(403).json({ message: 'You do not have access to this ticket.', code: 'FORBIDDEN' });
    }

    req.ticket = ticket;
    req.isTicketOwner = isOwner;
    req.isStaffOnTicket = staff;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Error loading ticket.', error: err.message });
  }
};

/** Only the customer/creator who owns the ticket — for close/reopen/rate actions. */
export const requireTicketOwner = async (req, res, next) => {
  const ticket = req.ticket || (await Ticket.findById(req.params.id));
  if (!ticket) return res.status(404).json({ message: 'Ticket not found.', code: 'NOT_FOUND' });
  if (ticket.creator.toString() !== req.user._id.toString() && !isInternalStaff(req.user.role)) {
    return res.status(403).json({ message: 'Only the ticket creator can perform this action.', code: 'FORBIDDEN' });
  }
  req.ticket = ticket;
  next();
};

/**
 * requireChatRoomAccess — verifies caller is an active participant in the
 * room. Also enforces the hard business rule: customer_support rooms may
 * only ever contain customer + support/admin/superadmin — never a partner —
 * by construction (see chatRoutes.js room-creation logic), so this guard
 * only needs to check participancy, not role composition.
 */
export const requireChatRoomAccess = async (req, res, next) => {
  try {
    const room = await ChatRoom.findById(req.params.roomId || req.params.id);
    if (!room) return res.status(404).json({ message: 'Chat room not found.', code: 'NOT_FOUND' });

    const participant = await ChatParticipant.findOne({ room: room._id, user: req.user._id, leftAt: null });
    if (!participant && !isInternalStaff(req.user.role)) {
      return res.status(403).json({ message: 'Not a participant in this chat room.', code: 'FORBIDDEN' });
    }

    req.chatRoom = room;
    req.chatParticipant = participant;
    next();
  } catch (err) {
    res.status(500).json({ message: 'Error loading chat room.', error: err.message });
  }
};

/** Ensures req.user has a SupportAgent profile (for /support/agents/me style routes). */
export const requireSupportAgentProfile = async (req, res, next) => {
  const agent = await SupportAgent.findOne({ user: req.user._id });
  if (!agent) return res.status(404).json({ message: 'Support agent profile not found.', code: 'NOT_FOUND' });
  req.agentProfile = agent;
  next();
};