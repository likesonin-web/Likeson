// models/SupportParticipant.js
//
// One document per (ticket, userId). Kept as its own collection rather than
// an embedded array on SupportTicket because: (a) unlimited participants
// requirement makes an embedded array unbounded-growth risk on a hot
// document, (b) per-participant fields (lastReadMessage/lastSeen) update on
// every read-receipt event — isolating that write traffic away from the
// ticket document avoids contending on ticket-level writes (status changes,
// assignment) under load.

import mongoose from 'mongoose';
import { PARTICIPANT_ROLES } from '../constants/support.constants.js';

const { Schema } = mongoose;

const supportParticipantSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    role: { type: String, enum: PARTICIPANT_ROLES, required: true },

    joinedAt: { type: Date, default: Date.now },
    joinedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },

    leftAt: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },

    lastReadMessage: { type: Schema.Types.ObjectId, ref: 'SupportMessage', default: null },
    lastReadAt: { type: Date, default: null },
    lastSeen: { type: Date, default: null },

    // Socket presence (denormalized here so participant list queries can
    // show online/offline without a separate Redis round trip per row;
    // Redis remains the source of truth, this is refreshed on
    // connect/disconnect/heartbeat via presence.service.js).
    isOnline: { type: Boolean, default: false },

    isTyping: { type: Boolean, default: false },
    typingUpdatedAt: { type: Date, default: null },

    // Muted participants still receive messages but skip push notifications.
    isMuted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One active membership per (ticket, user) — re-joins after leftAt update
// the same doc rather than creating duplicates.
supportParticipantSchema.index({ ticket: 1, userId: 1 }, { unique: true });
supportParticipantSchema.index({ ticket: 1, active: 1 });
supportParticipantSchema.index({ userId: 1, active: 1 });
supportParticipantSchema.index({ ticket: 1, role: 1 });

const SupportParticipant = mongoose.model('SupportParticipant', supportParticipantSchema);
export default SupportParticipant;
