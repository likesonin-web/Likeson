// models/ConversationLabel.js
// User-defined labels (e.g. "VIP", "Follow up"), referenced by _id from
// ConversationMember.labels[].

import mongoose from 'mongoose';
import { CONVERSATION_LABEL_COLORS } from '../constants/conversationConstants.js';

const { Schema } = mongoose;

const conversationLabelSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, // labels are per-user (or per-admin) scoped
    name:  { type: String, required: true, trim: true, maxlength: 40 },
    color: { type: String, enum: CONVERSATION_LABEL_COLORS, default: 'gray' },
  },
  { timestamps: true }
);

conversationLabelSchema.index({ owner: 1, name: 1 }, { unique: true });

const ConversationLabel = mongoose.model('ConversationLabel', conversationLabelSchema);
export default ConversationLabel;
