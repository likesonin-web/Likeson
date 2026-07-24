// controllers/message.controller.js

import asyncHandler from '../utils/asyncHandler.js';
import { ALLOWED_MIME_TYPES } from '../constants/support.constants.js';
import * as messageService from '../services/message.service.js';
import * as attachmentService from '../services/attachment.service.js';

function classifyMimeType(mimeType) {
  // A recorded voice note arrives as e.g. "audio/webm;codecs=opus", not the
  // bare "audio/webm" ALLOWED_MIME_TYPES lists — strip codec suffix first.
  const base = mimeType?.split(';')[0]?.trim();
  return Object.entries(ALLOWED_MIME_TYPES).find(([, mimes]) => mimes.includes(base))?.[0] ?? null;
}

// POST '/'
export const post = asyncHandler(async (req, res) => {
  const message = await messageService.sendMessage({
    ticketId: req.params.ticketId,
    actor: req.user,
    deviceInfo: req.deviceInfo,
    payload: req.body,
    io: req.app.get('io'),
  });
  res.status(201).json({ success: true, data: message });
});

// POST '/media'
export const postMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file provided.', code: 'NO_FILE' });
  }

  const fileType = classifyMimeType(req.file.mimetype);
  if (!fileType) {
    return res.status(400).json({
      success: false,
      message: `File type '${req.file.mimetype}' is not permitted.`,
      code: 'UNSUPPORTED_FILE_TYPE',
    });
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
});

// GET '/'
export const get = asyncHandler(async (req, res) => {
  const result = await messageService.listMessages({
    ticketId: req.params.ticketId,
    actor: req.user,
    query: req.query,
  });
  res.status(200).json({ success: true, ...result });
});

// PATCH '/:messageId'
export const patchByMessageId = asyncHandler(async (req, res) => {
  const message = await messageService.editMessage({
    ticketId: req.params.ticketId,
    messageId: req.params.messageId,
    actor: req.user,
    deviceInfo: req.deviceInfo,
    text: req.body.text,
    io: req.app.get('io'),
  });
  res.status(200).json({ success: true, data: message });
});

// DELETE '/:messageId'
export const deleteByMessageId = asyncHandler(async (req, res) => {
  const message = await messageService.deleteMessage({
    ticketId: req.params.ticketId,
    messageId: req.params.messageId,
    actor: req.user,
    deviceInfo: req.deviceInfo,
    reason: req.body.reason,
    io: req.app.get('io'),
  });
  res.status(200).json({ success: true, data: message });
});

// POST '/:messageId/react'
export const postByMessageIdReact = asyncHandler(async (req, res) => {
  const message = await messageService.reactToMessage({
    ticketId: req.params.ticketId,
    messageId: req.params.messageId,
    actor: req.user,
    emoji: req.body.emoji,
    io: req.app.get('io'),
  });
  res.status(200).json({ success: true, data: message });
});

// POST '/read'
export const postRead = asyncHandler(async (req, res) => {
  await messageService.markRead({
    ticketId: req.params.ticketId,
    userId: req.user._id,
    upToMessageId: req.body.upToMessageId,
  });
  res.status(200).json({ success: true });
});