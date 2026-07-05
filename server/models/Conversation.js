// models/Conversation.js
//
// A Conversation is the single engine behind private chats, groups,
// complaints, and announcements. It never embeds messages — Message is
// always a separate collection referencing conversation._id.

import mongoose from 'mongoose';
import { CONVERSATION_TYPES } from '../constants/conversationConstants.js';
import { COMPLAINT_STATUSES, COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES } from '../constants/complaintConstants.js';

const { Schema } = mongoose;

const conversationSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      enum: CONVERSATION_TYPES,
      index: true,
    },

    // Display name — required for group/announcement, optional/derived for private.
    title: { type: String, trim: true, maxlength: 200 },

    avatar: { type: String, default: null },

    // Denormalized for fast conversation-list rendering without a Message join.
    lastMessage: {
      messageId:   { type: Schema.Types.ObjectId, ref: 'Message', default: null },
      preview:     { type: String, default: '' },
      senderId:    { type: Schema.Types.ObjectId, ref: 'User', default: null },
      messageType: { type: String, default: null },
      sentAt:      { type: Date, default: null },
    },

    // ── Group-specific fields (type = 'group') ─────────────────────────────
    group: {
      isLocked:      { type: Boolean, default: false },   // locked = only admins can post
      isArchived:    { type: Boolean, default: false },
      memberCount:   { type: Number, default: 0 },
      createdBy:     { type: Schema.Types.ObjectId, ref: 'User', default: null },
    },

    // ── Complaint-specific fields (type = 'complaint') ─────────────────────
    complaint: {
      status:     { type: String, enum: COMPLAINT_STATUSES, default: undefined },
      category:   { type: String, enum: COMPLAINT_CATEGORIES, default: undefined },
      priority:   { type: String, enum: COMPLAINT_PRIORITIES, default: undefined },
      raisedBy:   { type: Schema.Types.ObjectId, ref: 'User', default: null },
      assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      resolvedAt: { type: Date, default: null },
      closedAt:   { type: Date, default: null },
      firstResponseAt: { type: Date, default: null },
    },

    // ── Announcement-specific fields (type = 'announcement') ───────────────
    announcement: {
      audienceRoles: { type: [String], default: [] }, // e.g. ['customer'] or [] = everyone
      publishedAt:   { type: Date, default: null },
    },

    isDirect: { type: Boolean, default: false }, // true only for type='private' 1:1

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// ── Validation ──────────────────────────────────────────────────────────────

conversationSchema.pre('validate', function (next) {
  if (['group', 'announcement'].includes(this.type) && !this.title) {
    return next(new Error(`title is required for conversation type "${this.type}"`));
  }
  if (this.type === 'complaint' && (!this.complaint?.status || !this.complaint?.category || !this.complaint?.priority)) {
    return next(new Error('complaint.status, complaint.category and complaint.priority are required for complaint conversations'));
  }
  next();
});

// ── Indexes ───────────────────────────────────────────────────────────────

conversationSchema.index({ type: 1, isDeleted: 1, updatedAt: -1 });               // conversation listing
conversationSchema.index({ 'complaint.status': 1, 'complaint.priority': 1 });      // complaint dashboards
conversationSchema.index({ 'complaint.assignedTo': 1, 'complaint.status': 1 });    // partner dashboard
conversationSchema.index({ createdBy: 1, createdAt: -1 });
conversationSchema.index({ title: 'text' });                                       // conversation search

// ── Statics ───────────────────────────────────────────────────────────────

conversationSchema.statics.findActiveById = function (id) {
  return this.findOne({ _id: id, isDeleted: false });
};

// ── Methods ───────────────────────────────────────────────────────────────

conversationSchema.methods.softDelete = function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

conversationSchema.methods.touchLastMessage = function ({ messageId, preview, senderId, messageType }) {
  this.lastMessage = { messageId, preview, senderId, messageType, sentAt: new Date() };
  return this.save();
};

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
