/**
 * message.routes.js — Likeson.in
 * Business logic lives in controllers/message.controller.js.
 * This file only wires paths + middleware + controller functions.
 *
 * NOTE: mergeParams MUST be true — this router is mounted nested under a
 * parent path containing :ticketId, e.g.:
 *   app.use('/api/tickets/:ticketId/messages', messageRoutes);
 * Without mergeParams, req.params.ticketId is undefined here, which breaks
 * ticketIdParamSchema validation and loadTicketAndCheckAccess.
 */

import express from 'express';
import { protect, getDeviceInfo } from '../middleware/authMiddleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { mongoSanitize } from '../middleware/mongoSanitize.middleware.js';
import { loadTicketAndCheckAccess } from '../middleware/ticketAccess.middleware.js';
import { requireEditMessagePermission } from '../middleware/supportRbac.middleware.js';
import { handleFileUpload } from '../middleware/fileUpload.middleware.js';
import {
  sendMessageSchema,
  editMessageSchema,
  deleteMessageSchema,
  reactMessageSchema,
  markReceiptBulkSchema,
  listMessagesQuerySchema,
  messageIdParamSchema,
} from '../validators/message.validator.js';
import { ticketIdParamSchema } from '../validators/ticket.validator.js';
import * as ctrl from '../controllers/message.controller.js';

const router = express.Router({ mergeParams: true }); // ✅ fix

router.use(protect, getDeviceInfo, mongoSanitize);

router.post(
  '/',
  validate(ticketIdParamSchema, 'params'),
  validate(sendMessageSchema),
  loadTicketAndCheckAccess,
  ctrl.post
);

router.post(
  '/media',
  validate(ticketIdParamSchema, 'params'),
  loadTicketAndCheckAccess,
  handleFileUpload,
  ctrl.postMedia
);

router.get(
  '/',
  validate(ticketIdParamSchema, 'params'),
  validate(listMessagesQuerySchema, 'query'),
  loadTicketAndCheckAccess,
  ctrl.get
);

// ⚠️ These two previously validated ONLY messageIdParamSchema, never
// ticketIdParamSchema — ticketId was reaching the controller/middleware
// unvalidated (and undefined, given the mergeParams bug). Added it back.
router.patch(
  '/:messageId',
  validate(ticketIdParamSchema, 'params'),
  validate(messageIdParamSchema, 'params'),
  validate(editMessageSchema),
  requireEditMessagePermission,
  loadTicketAndCheckAccess,
  ctrl.patchByMessageId
);

router.delete(
  '/:messageId',
  validate(ticketIdParamSchema, 'params'),
  validate(messageIdParamSchema, 'params'),
  validate(deleteMessageSchema),
  loadTicketAndCheckAccess,
  ctrl.deleteByMessageId
);

router.post(
  '/:messageId/react',
  validate(ticketIdParamSchema, 'params'),
  validate(messageIdParamSchema, 'params'),
  validate(reactMessageSchema),
  loadTicketAndCheckAccess,
  ctrl.postByMessageIdReact
);

router.post(
  '/read',
  validate(ticketIdParamSchema, 'params'),
  validate(markReceiptBulkSchema),
  loadTicketAndCheckAccess,
  ctrl.postRead
);

export default router;