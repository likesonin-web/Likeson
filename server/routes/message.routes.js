// routes/message.routes.js

import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { protect, getDeviceInfo } from '../middleware/authmiddleware.js';
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
import { ALLOWED_MIME_TYPES } from '../constants/support.constants.js';
import * as messageService from '../services/message.service.js';
import * as attachmentService from '../services/attachment.service.js';
 
function classifyMimeType(mimeType) {
  // Same codec-suffix issue as the frontend's classifyFile — a recorded
  // voice note arrives as e.g. "audio/webm;codecs=opus", not the bare
  // "audio/webm" ALLOWED_MIME_TYPES lists.
  const base = mimeType?.split(';')[0]?.trim();
  return Object.entries(ALLOWED_MIME_TYPES).find(([, mimes]) => mimes.includes(base))?.[0] ?? null;
}
 
const router = Router({ mergeParams: true });
 
router.use(protect, getDeviceInfo, mongoSanitize);
 
// ── Send message (text or already-uploaded attachment reference) ─────────
router.post(
  '/',
  validate(ticketIdParamSchema, 'params'),
  validate(sendMessageSchema),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const message = await messageService.sendMessage({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      payload: req.body,
      io: req.app.get('io'),
    });
    res.status(201).json({ success: true, data: message });
  })
);
 
// ── Upload + send media message in one call ───────────────────────────────
router.post(
  '/media',
  validate(ticketIdParamSchema, 'params'),
  loadTicketAndCheckAccess,
  handleFileUpload,
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided.', code: 'NO_FILE' });
 
    const fileType = classifyMimeType(req.file.mimetype);
    if (!fileType) {
      return res.status(400).json({ success: false, message: `File type '${req.file.mimetype}' is not permitted.`, code: 'UNSUPPORTED_FILE_TYPE' });
    }
 
    const attachment = await attachmentService.uploadAttachment({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      fileBuffer: req.file.buffer,
      meta: {
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        fileType,
      },
    });
 
    const message = await messageService.sendMessage({
      ticketId: req.params.ticketId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      payload: {
        messageType: fileType,
        clientMessageId: req.body.clientMessageId,
        attachment: {
          url: attachment.url,
          fileId: attachment.imagekitFileId,
          fileType,
          originalName: attachment.originalName,
          sizeBytes: attachment.sizeBytes,
          mimeType: attachment.mimeType,
          thumbnailUrl: attachment.thumbnailUrl,
        },
      },
      io: req.app.get('io'),
    });
 
    res.status(201).json({ success: true, data: message });
  })
);
 
// ── List (cursor-paginated) ────────────────────────────────────────────────
router.get(
  '/',
  validate(ticketIdParamSchema, 'params'),
  validate(listMessagesQuerySchema, 'query'),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const result = await messageService.listMessages({ ticketId: req.params.ticketId, actor: req.user, query: req.query });
    res.status(200).json({ success: true, ...result });
  })
);
 
// ── Edit (admin/superadmin only) ───────────────────────────────────────────
router.patch(
  '/:messageId',
  validate(messageIdParamSchema, 'params'),
  validate(editMessageSchema),
  requireEditMessagePermission,
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const message = await messageService.editMessage({
      ticketId: req.params.ticketId,
      messageId: req.params.messageId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      text: req.body.text,
      io: req.app.get('io'),
    });
    res.status(200).json({ success: true, data: message });
  })
);
 
// ── Soft delete ─────────────────────────────────────────────────────────
router.delete(
  '/:messageId',
  validate(messageIdParamSchema, 'params'),
  validate(deleteMessageSchema),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const message = await messageService.deleteMessage({
      ticketId: req.params.ticketId,
      messageId: req.params.messageId,
      actor: req.user,
      deviceInfo: req.deviceInfo,
      reason: req.body.reason,
      io: req.app.get('io'),
    });
    res.status(200).json({ success: true, data: message });
  })
);
 
// ── React ──────────────────────────────────────────────────────────────────
router.post(
  '/:messageId/react',
  validate(messageIdParamSchema, 'params'),
  validate(reactMessageSchema),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    const message = await messageService.reactToMessage({
      ticketId: req.params.ticketId,
      messageId: req.params.messageId,
      actor: req.user,
      emoji: req.body.emoji,
      io: req.app.get('io'),
    });
    res.status(200).json({ success: true, data: message });
  })
);
 
// ── Mark read (bulk, up to a message) ──────────────────────────────────────
router.post(
  '/read',
  validate(ticketIdParamSchema, 'params'),
  validate(markReceiptBulkSchema),
  loadTicketAndCheckAccess,
  asyncHandler(async (req, res) => {
    await messageService.markRead({
      ticketId: req.params.ticketId,
      userId: req.user._id,
      upToMessageId: req.body.upToMessageId,
    });
    res.status(200).json({ success: true });
  })
);
 
export default router;