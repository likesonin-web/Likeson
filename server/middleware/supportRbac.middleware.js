// middlewares/supportRbac.middleware.js
//
// Route-level convenience wrappers over the existing `authorize(...roles)`
// middleware (middleware/authmiddleware.js) plus support-specific
// permission checks that need more than a static role list.

import { ForbiddenError } from '../utils/errors.js';
import { TICKET_CREATOR_ROLES } from '../constants/support.constants.js';
import {
  canAssignTicket,
  canEditMessage,
  canChangeStatus,
  canCreateInternalNote,
} from '../utils/supportPermissions.util.js';

export const requireTicketCreatorRole = (req, res, next) => {
  if (!TICKET_CREATOR_ROLES.includes(req.user.role)) {
    return next(new ForbiddenError('Your role is not permitted to create support tickets.'));
  }
  next();
};

export const requireAssignPermission = (req, res, next) => {
  if (!canAssignTicket(req.user.role)) {
    return next(new ForbiddenError('Only Admin or Superadmin can assign tickets.'));
  }
  next();
};

export const requireEditMessagePermission = (req, res, next) => {
  if (!canEditMessage(req.user.role)) {
    return next(new ForbiddenError('Only Admin or Superadmin can edit messages.'));
  }
  next();
};

export const requireStatusChangePermission = (req, res, next) => {
  if (!canChangeStatus(req.user.role)) {
    return next(new ForbiddenError('Only staff can change ticket status.'));
  }
  next();
};

export const requireInternalNotePermission = (req, res, next) => {
  if (!canCreateInternalNote(req.user.role)) {
    return next(new ForbiddenError('Only staff can add internal notes.'));
  }
  next();
};
