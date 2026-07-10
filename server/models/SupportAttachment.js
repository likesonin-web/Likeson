// models/SupportAttachment.js
//
// Standalone collection (not just embedded on message/ticket) so:
// (a) attachment-scan-hook status can be updated independent of the
//     parent message/ticket document, (b) search-by-attachment and
//     storage-cleanup jobs (BullMQ) can query this collection directly
//     without scanning every message.

import mongoose from 'mongoose';

const { Schema } = mongoose;

const supportAttachmentSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'SupportTicket', required: true, index: true },
    message: { type: Schema.Types.ObjectId, ref: 'SupportMessage', default: null, index: true },

    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    fileType: { type: String, enum: ['image', 'video', 'pdf', 'audio'], required: true },
    mimeType: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 255 },
    sizeBytes: { type: Number, required: true },

    // ImageKit
    imagekitFileId: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    filePath: { type: String, required: true }, // ImageKit filePath, needed for delete API

    durationSeconds: { type: Number, default: null }, // audio/video

    // Attachment scanning hook — architecture-ready integration point for an
    // external AV/content-scan service. Message stays visible immediately
    // (spec favors realtime chat); a 'flagged' result triggers a moderation
    // notification and can retroactively soft-delete via message.service.js.
    scanStatus: {
      type: String,
      enum: ['pending', 'clean', 'flagged', 'scan_failed'],
      default: 'pending',
      index: true,
    },
    scannedAt: { type: Date, default: null },
    scanProvider: { type: String, default: null },
    scanResultRaw: { type: Schema.Types.Mixed, default: null },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

supportAttachmentSchema.index({ ticket: 1, fileType: 1 });
supportAttachmentSchema.index({ scanStatus: 1, createdAt: 1 });

const SupportAttachment = mongoose.model('SupportAttachment', supportAttachmentSchema);
export default SupportAttachment;
