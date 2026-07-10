// models/SupportSLA.js
//
// SupportTicket.sla (embedded) is the fast-path read used on every ticket
// fetch. This collection is the standalone tracking record BullMQ's
// sla-sweep job scans on a schedule to flag breaches and fire escalation
// notifications — kept separate so the sweep query (`resolutionDueAt <
// now AND resolutionBreached: false`) runs a light collection scan instead
// of touching the full, heavier SupportTicket documents.

import mongoose from 'mongoose';
import { TICKET_PRIORITIES } from '../constants/support.constants.js';

const { Schema } = mongoose;

const supportSLASchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, unique: true, index: true },

    priority: { type: String, enum: TICKET_PRIORITIES, required: true },

    firstResponseDueAt: { type: Date, required: true },
    resolutionDueAt: { type: Date, required: true },

    firstRespondedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },

    firstResponseBreached: { type: Boolean, default: false, index: true },
    resolutionBreached: { type: Boolean, default: false, index: true },

    firstResponseBreachNotifiedAt: { type: Date, default: null },
    resolutionBreachNotifiedAt: { type: Date, default: null },

    // Re-baselined when priority changes mid-flight (sla.service.js
    // recomputes both due dates and appends here rather than losing the
    // original targets).
    priorityChangeLog: {
      type: [
        {
          fromPriority: String,
          toPriority: String,
          changedAt: { type: Date, default: Date.now },
          newResolutionDueAt: Date,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Primary sweep query used by jobs/slaSweep.job.js
supportSLASchema.index({ resolutionDueAt: 1, resolutionBreached: 1 });
supportSLASchema.index({ firstResponseDueAt: 1, firstResponseBreached: 1 });

const SupportSLA = mongoose.model('SupportSLA', supportSLASchema);
export default SupportSLA;
