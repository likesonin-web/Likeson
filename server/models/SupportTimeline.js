// models/SupportTimeline.js
//
// Uncapped, permanent counterpart to SupportTicket.timelineCache (which is
// capped at MAX_INLINE_TIMELINE_ENTRIES for hot-document performance). Every
// entry written here is also mirrored into timelineCache (bounded) by
// timeline.service.js#recordEvent — single write path, two destinations.

import mongoose from 'mongoose';
import { TIMELINE_EVENTS } from '../constants/support.constants.js';

const { Schema } = mongoose;

const supportTimelineSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },

    event: { type: String, enum: TIMELINE_EVENTS, required: true, index: true },

    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, default: null },

    summary: { type: String, trim: true, maxlength: 500 },

    // Structured before/after for status/priority changes, participant
    // add/remove, assignment diffs, etc. — same shape convention as
    // AuditLog.metadata.
    metadata: { type: Schema.Types.Mixed, default: {} },

    relatedMessage: { type: Schema.Types.ObjectId, ref: 'SupportMessage', default: null },
  },
  { timestamps: true }
);

supportTimelineSchema.index({ ticket: 1, createdAt: 1 }); // chronological render order
supportTimelineSchema.index({ ticket: 1, event: 1 });

const SupportTimeline = mongoose.model('SupportTimeline', supportTimelineSchema);
export default SupportTimeline;
