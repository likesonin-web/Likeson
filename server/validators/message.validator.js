// validators/message.validator.js

import Joi from 'joi';
import {
  MESSAGE_TYPES,
  MEDIA_MESSAGE_TYPES,
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '../constants/support.constants.js';

const objectId = Joi.string().hex().length(24);

// ── Send Message ──────────────────────────────────────────────────────────
// Text and media messages share one endpoint; shape branches on messageType.
export const sendMessageSchema = Joi.object({
  messageType: Joi.string().valid(...MESSAGE_TYPES).required(),

  // Required for 'text', forbidden/optional for pure media messages (a media
  // message MAY still carry a caption, so text stays optional there).
  text: Joi.string().trim().max(4000).when('messageType', {
    is: 'text',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),

  attachment: Joi.object({
    url: Joi.string().uri().required(),
    fileId: Joi.string().required(), // ImageKit fileId, needed for delete/scan hook
    fileType: Joi.string().valid(...MEDIA_MESSAGE_TYPES).required(),
    originalName: Joi.string().max(255).required(),
    sizeBytes: Joi.number().integer().min(1).required(),
    mimeType: Joi.string().required(),
    durationSeconds: Joi.number().min(0).optional(), // audio/video
    thumbnailUrl: Joi.string().uri().optional(),
  }).when('messageType', {
    is: Joi.valid(...MEDIA_MESSAGE_TYPES),
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),

  // Reply/quote support
  replyTo: objectId.allow(null).default(null),

  // @mentions — resolved to role tokens client-side (e.g. "finance"),
  // service layer resolves role → actual participant userIds.
  mentions: Joi.array().items(Joi.string().trim().lowercase().max(50)).max(20).default([]),

  clientMessageId: Joi.string().trim().max(100).optional(), // for optimistic-UI dedupe
}).required();

// ── Edit Message (admin/superadmin only — enforced in service) ───────────
export const editMessageSchema = Joi.object({
  text: Joi.string().trim().min(1).max(4000).required(),
}).required();

// ── Delete Message (soft delete only) ─────────────────────────────────────
export const deleteMessageSchema = Joi.object({
  reason: Joi.string().trim().max(500).optional(),
}).required();

// ── Reaction (architecture-ready) ─────────────────────────────────────────
export const reactMessageSchema = Joi.object({
  emoji: Joi.string().trim().max(8).required(), // stores the literal emoji/unicode
}).required();

// ── Read/Delivered/Seen receipts ──────────────────────────────────────────
export const markReceiptSchema = Joi.object({
  messageId: objectId.required(),
}).required();

export const markReceiptBulkSchema = Joi.object({
  upToMessageId: objectId.required(), // marks all messages up to & including this one
}).required();

// ── List Messages (cursor-paginated) ──────────────────────────────────────
export const listMessagesQuerySchema = Joi.object({
  cursor: Joi.string().optional(), // opaque, encodes createdAt+_id of last item
  limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_MESSAGE_PAGE_SIZE),
  direction: Joi.string().valid('before', 'after').default('before'),
}).required();

export const messageIdParamSchema = Joi.object({
  ticketId: objectId.required(),
  messageId: objectId.required(),
}).required();
