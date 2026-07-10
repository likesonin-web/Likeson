// models/SupportMessage.js

import mongoose from 'mongoose';
import { MESSAGE_TYPES, MESSAGE_STATUSES } from '../constants/support.constants.js';

const { Schema } = mongoose;

// Per-recipient delivery/read tracking — one entry per participant at
// send-time. Sized bound = MAX_PARTICIPANTS_PER_TICKET (enforced upstream
// in ticket.service.js when adding participants), so this array can never
// grow unbounded independent of that cap.
const receiptEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { _id: false }
);

const reactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    emoji: { type: String, required: true, maxlength: 8 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const attachmentSchema = new Schema(
  {
    attachment: { type: Schema.Types.ObjectId, ref: 'SupportAttachment', default: null },
    url: { type: String, required: true },
    fileId: { type: String, required: true }, // ImageKit fileId
    fileType: { type: String, enum: ['image', 'video', 'pdf', 'audio'], required: true },
    originalName: { type: String, maxlength: 255 },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    durationSeconds: { type: Number, default: null },
    thumbnailUrl: { type: String, default: null },
  },
  { _id: false }
);

const supportMessageSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },

    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderRole: { type: String, required: true },

    messageType: { type: String, enum: MESSAGE_TYPES, required: true, index: true },

    text: { type: String, trim: true, maxlength: 4000, default: '' },
    attachment: { type: attachmentSchema, default: null },

    // Quoted / threaded reply
    replyTo: { type: Schema.Types.ObjectId, ref: 'SupportMessage', default: null },

    // Resolved @mention target userIds (role tokens resolved server-side —
    // see message.service.js#resolveMentions)
    mentions: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    mentionRoles: { type: [String], default: [] },

    // Visible only to STAFF_ROLES — never returned to a customer-scoped query.
    // Enforced at the query-projection layer in message.service.js, NOT just
    // in the client — internal notes are their own message subtype so a
    // single accidental broad `find` still can't leak them (see
    // isInternalNote below, always checked server-side before serialization).
    isInternalNote: { type: Boolean, default: false, index: true },

    status: { type: String, enum: MESSAGE_STATUSES, default: 'sent', index: true },

    receipts: { type: [receiptEntrySchema], default: [] },
    reactions: { type: [reactionSchema], default: [] },

    // Client-supplied idempotency key for optimistic-UI dedupe on reconnect.
    clientMessageId: { type: String, default: null, index: true },

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    editHistory: {
      type: [
        {
          previousText: String,
          editedAt: { type: Date, default: Date.now },
          editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        },
      ],
      default: [],
    },

    // Soft delete only — never physically removed (spec requirement).
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    // System-generated messages (assignment/status/timeline) carry a
    // structured payload instead of free text for client rendering.
    systemPayload: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────

supportMessageSchema.index({ ticket: 1, createdAt: -1 }); // primary pagination path
supportMessageSchema.index({ ticket: 1, isInternalNote: 1, createdAt: -1 });
supportMessageSchema.index({ ticket: 1, isDeleted: 1 });
supportMessageSchema.index({ mentions: 1, createdAt: -1 });
supportMessageSchema.index({ sender: 1, createdAt: -1 });
supportMessageSchema.index({ 'receipts.userId': 1, 'receipts.readAt': 1 });

// Rate-limit / flood-detection support: cheap recent-count-by-sender query.
supportMessageSchema.index({ ticket: 1, sender: 1, createdAt: -1 });

const SupportMessage = mongoose.model('SupportMessage', supportMessageSchema);
export default SupportMessage;
