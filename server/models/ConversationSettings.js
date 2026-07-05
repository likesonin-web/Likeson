// models/ConversationSettings.js
// Per-conversation configuration, kept off the hot Conversation document
// since these fields are read/written far less frequently.

import mongoose from 'mongoose';
const { Schema } = mongoose;

const conversationSettingsSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, unique: true },

    onlyAdminsCanPost:      { type: Boolean, default: false }, // group lock, mirrors Conversation.group.isLocked
    onlyAdminsCanAddMember: { type: Boolean, default: true },
    allowMemberInvites:     { type: Boolean, default: false },

    disappearingMessagesSeconds: { type: Number, default: 0 }, // 0 = off; future-ready

    slowModeSeconds: { type: Number, default: 0 }, // 0 = off; min gap between a member's messages
  },
  { timestamps: true }
);

const ConversationSettings = mongoose.model('ConversationSettings', conversationSettingsSchema);
export default ConversationSettings;
