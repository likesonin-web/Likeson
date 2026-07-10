// validators/ticket.validator.js
//
// Joi schemas for every Support Ticket write/read endpoint. Routes call
// `validate(schema)` (see middlewares/validate.middleware.js) BEFORE the
// request ever reaches a service — services never re-trust req.body/query.

import Joi from 'joi';
import {
  TICKET_TYPES,
  TICKET_STATUSES,
  TICKET_STATUS_TRANSITIONS,
  TICKET_PRIORITIES,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
} from '../constants/support.constants.js';

const objectId = Joi.string().hex().length(24);

// ── Create Ticket ─────────────────────────────────────────────────────────
export const createTicketSchema = Joi.object({
  ticketType: Joi.string().valid(...TICKET_TYPES).required(),

  subject: Joi.string().trim().min(5).max(200).required(),

  description: Joi.string().trim().min(10).max(5000).required(),

  priority: Joi.string().valid(...TICKET_PRIORITIES).default('medium'),

  // Optional booking linkage — spec: "Booking reference optional."
  booking: objectId.allow(null).default(null),

  // Free-form structured metadata (e.g. { orderId, transactionId }) — capped
  // to prevent unbounded document growth via malicious payloads.
  metadata: Joi.object().max(20).default({}),

  // Initial attachments, if the client uploaded to ImageKit before ticket
  // creation (pre-signed flow) and is attaching references now.
  attachments: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        fileId: Joi.string().required(),
        fileType: Joi.string().valid('image', 'video', 'pdf', 'audio').required(),
        originalName: Joi.string().max(255),
        sizeBytes: Joi.number().integer().min(1),
      })
    )
    .max(10)
    .default([]),
}).required();

// ── Update Ticket (subject/description/priority — staff or creator only,
// enforced in service, not here) ─────────────────────────────────────────
export const updateTicketSchema = Joi.object({
  subject: Joi.string().trim().min(5).max(200),
  description: Joi.string().trim().min(10).max(5000),
  priority: Joi.string().valid(...TICKET_PRIORITIES),
  metadata: Joi.object().max(20),
})
  .min(1)
  .required();

// ── Status change — validates the *shape*; legality of the actual
// from→to transition is checked in ticket.service.js against
// TICKET_STATUS_TRANSITIONS (kept there since it needs the current doc). ──
export const changeStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...TICKET_STATUSES)
    .required(),
  reason: Joi.string().trim().max(1000).when('status', {
    is: Joi.valid('closed', 'rejected', 'escalated'),
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
}).required();

export const changePrioritySchema = Joi.object({
  priority: Joi.string().valid(...TICKET_PRIORITIES).required(),
  reason: Joi.string().trim().max(500).optional(),
}).required();

// ── Assignment ────────────────────────────────────────────────────────────
export const assignTicketSchema = Joi.object({
  assignees: Joi.array()
    .items(
      Joi.object({
        userId: objectId.required(),
        role: Joi.string().required(),
        department: Joi.string().trim().max(100).optional(),
      })
    )
    .min(1)
    .max(50)
    .required(),
  note: Joi.string().trim().max(1000).optional(),
}).required();

// ── Participants ──────────────────────────────────────────────────────────
export const addParticipantSchema = Joi.object({
  userId: objectId.required(),
  role: Joi.string().required(),
}).required();

export const removeParticipantSchema = Joi.object({
  userId: objectId.required(),
  reason: Joi.string().trim().max(500).optional(),
}).required();

// ── Internal Note ─────────────────────────────────────────────────────────
export const addInternalNoteSchema = Joi.object({
  note: Joi.string().trim().min(1).max(3000).required(),
}).required();

// ── Rating (customer closes/rates a resolved ticket) ─────────────────────
export const rateTicketSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().trim().max(1000).allow('').optional(),
}).required();

// ── List / Search / Filter (query params) ─────────────────────────────────
export const listTicketsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  cursor: Joi.string().optional(), // opaque cursor (encoded _id + createdAt)

  status: Joi.alternatives()
    .try(Joi.string().valid(...TICKET_STATUSES), Joi.array().items(Joi.string().valid(...TICKET_STATUSES)))
    .optional(),
  priority: Joi.alternatives()
    .try(Joi.string().valid(...TICKET_PRIORITIES), Joi.array().items(Joi.string().valid(...TICKET_PRIORITIES)))
    .optional(),
  ticketType: Joi.string().valid(...TICKET_TYPES).optional(),

  ticketNumber: Joi.string().trim().max(30).optional(),
  booking: objectId.optional(),
  customer: objectId.optional(),
  assignee: objectId.optional(),
  department: Joi.string().trim().max(100).optional(),

  search: Joi.string().trim().max(200).optional(), // free text: subject/desc/phone/email/txn
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),

  sortBy: Joi.string().valid('createdAt', 'updatedAt', 'priority', 'dueAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
}).required();

export const ticketIdParamSchema = Joi.object({
  ticketId: objectId.required(),
}).required();

// Validates that `status` transition target is at least reachable from
// SOME status (defence in depth — real from-state check happens in service
// with the loaded document). Exported for reuse in socket layer too.
export const isValidStatusValue = (status) => TICKET_STATUSES.includes(status);
export const isLegalTransition = (from, to) =>
  Array.isArray(TICKET_STATUS_TRANSITIONS[from]) && TICKET_STATUS_TRANSITIONS[from].includes(to);
