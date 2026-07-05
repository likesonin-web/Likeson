// models/ComplaintTimeline.js
// Append-only status/event history for a complaint conversation — powers
// the "timeline" UI and First-Response/Resolution-Time analytics.

import mongoose from 'mongoose';
import { COMPLAINT_STATUSES } from '../constants/complaintConstants.js';

const { Schema } = mongoose;

const complaintTimelineSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },

    event: {
      type: String,
      enum: ['created', 'assigned', 'transferred', 'status_changed', 'note_added', 'reopened', 'closed'],
      required: true,
    },

    fromStatus: { type: String, enum: [...COMPLAINT_STATUSES, null], default: null },
    toStatus:   { type: String, enum: [...COMPLAINT_STATUSES, null], default: null },

    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note:  { type: String, default: null },
  },
  { timestamps: true }
);

complaintTimelineSchema.index({ conversation: 1, createdAt: 1 });

const ComplaintTimeline = mongoose.model('ComplaintTimeline', complaintTimelineSchema);
export default ComplaintTimeline;
