// models/SupportTicket.js
//
// Root document of the Support module. Mirrors Booking.js conventions:
// nanoid human-readable code, sub-schemas for bounded embedded data,
// pre-validate/pre-save guards, capped inline arrays with an uncapped
// companion collection (SupportTimeline) for full history, compound indexes
// tuned for the exact query patterns in ticket.service.js.

import mongoose from 'mongoose';
import { customAlphabet } from 'nanoid';
import {
  TICKET_TYPES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  MAX_INLINE_TIMELINE_ENTRIES,
} from '../constants/support.constants.js';

const { Schema } = mongoose;

const generateTicketNumber = customAlphabet('0123456789', 10);

// ── Sub-schemas ───────────────────────────────────────────────────────────

// Bounded "recent activity" cache — identical pattern to Booking.statusLog.
// The permanent, uncapped record lives in the SupportTimeline collection.
const inlineTimelineEntrySchema = new Schema(
  {
    event: { type: String, required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    summary: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const slaSnapshotSchema = new Schema(
  {
    firstResponseDueAt: { type: Date },
    resolutionDueAt: { type: Date },
    firstRespondedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    firstResponseBreached: { type: Boolean, default: false },
    resolutionBreached: { type: Boolean, default: false },
  },
  { _id: false }
);

const attachmentRefSchema = new Schema(
  {
    attachment: { type: Schema.Types.ObjectId, ref: 'SupportAttachment', required: true },
    url: { type: String, required: true },
    fileType: { type: String, enum: ['image', 'video', 'pdf', 'audio'], required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main Schema ───────────────────────────────────────────────────────────

const supportTicketSchema = new Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      index: true,
    },

    ticketType: {
      type: String,
      enum: TICKET_TYPES,
      required: true,
      index: true,
    },

    subject: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },

    // ── Creator ───────────────────────────────────────────────────────────
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdByRole: { type: String, required: true, index: true },

    // ── Optional booking linkage ──────────────────────────────────────────
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },

    // ── Status / Priority ──────────────────────────────────────────────────
    status: {
      type: String,
      enum: TICKET_STATUSES,
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: TICKET_PRIORITIES,
      default: 'medium',
      index: true,
    },

    // ── Department / current assignment cache ─────────────────────────────
    // Denormalized cache of the CURRENT assignment for fast list/filter
    // queries. Source of truth is SupportAssignmentHistory — this array is
    // rebuilt (never hand-mutated) by assignment.service.js on every
    // assignment change, same pattern as Booking's active-leg caches.
    currentAssignees: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        role: { type: String },
        department: { type: String },
        assignedAt: { type: Date, default: Date.now },
      },
    ],

    // ── Visibility ──────────────────────────────────────────────────────────
    // Explicit allow-list of userIds who may currently see this ticket.
    // Populated with creator + STAFF_ROLES holders at creation; partners are
    // added only when assigned (see visibility.service.js). Kept as a plain
    // ObjectId array (not participants) so a Mongo index can answer
    // "tickets visible to user X" directly without joining participants.
    visibleTo: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      index: true,
    },

    // ── Attachments (initial + all message attachments rolled up for search) ──
    attachments: { type: [attachmentRefSchema], default: [] },

    // ── Metadata (structured, e.g. { orderId, transactionId, phone, email }) ──
    metadata: { type: Schema.Types.Mixed, default: {} },

    // Denormalized searchable contact fields, copied from createdBy at
    // creation time so search-by-phone/email doesn't require a $lookup.
    contactSnapshot: {
      phone: { type: String, index: true },
      email: { type: String, index: true },
      name: { type: String },
    },

    // ── SLA ──────────────────────────────────────────────────────────────
    sla: { type: slaSnapshotSchema, default: () => ({}) },

    // ── Timeline (bounded inline cache) ───────────────────────────────────
    timelineCache: { type: [inlineTimelineEntrySchema], default: [] },

    // ── Rating ────────────────────────────────────────────────────────────
    rating: { type: Schema.Types.ObjectId, ref: 'SupportRating', default: null },

    // ── Lifecycle timestamps ──────────────────────────────────────────────
    firstAssignedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    reopenedCount: { type: Number, default: 0 },

    // ── Escalation ────────────────────────────────────────────────────────
    isEscalated: { type: Boolean, default: false, index: true },
    escalatedAt: { type: Date, default: null },
    escalationReason: { type: String, trim: true },

    lastMessageAt: { type: Date, default: null, index: true },
    lastMessagePreview: { type: String, maxlength: 200 },

    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────

supportTicketSchema.virtual('isTerminal').get(function () {
  return ['resolved', 'closed', 'rejected'].includes(this.status);
});

supportTicketSchema.virtual('isOverdue').get(function () {
  if (!this.sla?.resolutionDueAt || this.isTerminal) return false;
  return this.sla.resolutionDueAt < new Date();
});

supportTicketSchema.virtual('messages', {
  ref: 'SupportMessage',
  localField: '_id',
  foreignField: 'ticket',
});

supportTicketSchema.virtual('participants', {
  ref: 'SupportParticipant',
  localField: '_id',
  foreignField: 'ticket',
});

// ── Pre-validate ──────────────────────────────────────────────────────────

supportTicketSchema.pre('validate', function () {
  if (this.isNew && this.visibleTo.length === 0) {
    throw new Error('SupportTicket requires at least one visibleTo entry (creator) at creation');
  }
});

// ── Pre-save ──────────────────────────────────────────────────────────────

supportTicketSchema.pre('save', async function () {
  // 1. Ticket number generation — collision-safe, human-readable (TKT-##########)
  if (this.isNew && !this.ticketNumber) {
    let candidate, exists;
    let attempts = 0;
    do {
      if (attempts++ > 10) throw new Error('ticketNumber generation failed after 10 attempts');
      candidate = `TKT-${generateTicketNumber()}`;
      exists = await mongoose.model('SupportTicket').exists({ ticketNumber: candidate });
    } while (exists);
    this.ticketNumber = candidate;
  }

  // 2. Cap inline timeline cache — full history lives in SupportTimeline
  if (this.timelineCache?.length > MAX_INLINE_TIMELINE_ENTRIES) {
    this.timelineCache = this.timelineCache.slice(-MAX_INLINE_TIMELINE_ENTRIES);
  }

  // 3. Lifecycle timestamps on status transitions
  if (this.isModified('status')) {
    if (this.status === 'resolved' && !this.resolvedAt) {
      this.resolvedAt = new Date();
      if (this.sla) this.sla.resolvedAt = this.sla.resolvedAt ?? new Date();
    }
    if (this.status === 'closed' && !this.closedAt) {
      this.closedAt = new Date();
    }
    if (this.status === 'escalated') {
      this.isEscalated = true;
      this.escalatedAt = this.escalatedAt ?? new Date();
    }
    // Reopen: previously terminal -> non-terminal
    if (!this.isNew && !['resolved', 'closed', 'rejected'].includes(this.status)) {
      const wasTerminal = ['resolved', 'closed', 'rejected'].includes(this._previousStatus);
      if (wasTerminal) {
        this.reopenedCount += 1;
        this.resolvedAt = null;
        this.closedAt = null;
      }
    }
  }
});

// Capture previous status before save (used by the reopen check above —
// Mongoose doesn't expose the pre-modification value directly for enums).
supportTicketSchema.pre('save', function () {
  if (this.isModified('status') && !this.isNew) {
    this._previousStatus = this._original_status ?? null;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────

supportTicketSchema.index({ status: 1, priority: 1, createdAt: -1 });
supportTicketSchema.index({ createdBy: 1, status: 1 });
supportTicketSchema.index({ visibleTo: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ 'currentAssignees.userId': 1, status: 1 });
supportTicketSchema.index({ ticketType: 1, status: 1 });
supportTicketSchema.index({ booking: 1 });
supportTicketSchema.index({ 'sla.resolutionDueAt': 1, status: 1 });
supportTicketSchema.index({ isEscalated: 1, status: 1 });
supportTicketSchema.index({ lastMessageAt: -1 });
supportTicketSchema.index(
  { subject: 'text', description: 'text', 'contactSnapshot.name': 'text' },
  { name: 'support_ticket_text_search', weights: { subject: 5, 'contactSnapshot.name': 3, description: 1 } }
);

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
export default SupportTicket;
