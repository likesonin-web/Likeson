// models/Attachment.js
// Metadata only — binary bytes live in ImageKit, never in MongoDB.

import mongoose from 'mongoose';
import { SUPPORTED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES } from '../constants/messageConstants.js';

const { Schema } = mongoose;

const attachmentSchema = new Schema(
  {
    fileName:     { type: String, required: true },        // ImageKit-stored name
    originalName: { type: String, required: true },        // as uploaded by user
    url:          { type: String, required: true },
    thumbnail:    { type: String, default: null },
    mimeType:     { type: String, required: true, enum: SUPPORTED_ATTACHMENT_MIME_TYPES },

    width:    { type: Number, default: null },
    height:   { type: Number, default: null },
    duration: { type: Number, default: null }, // seconds, for audio/video

    fileSize: { type: Number, required: true, max: MAX_ATTACHMENT_SIZE_BYTES },

    imageKitFileId: { type: String, required: true, index: true }, // needed to delete from ImageKit later

    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    uploadedAt: { type: Date, default: Date.now },

    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true, default: null },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

attachmentSchema.index({ uploadedBy: 1, createdAt: -1 });
attachmentSchema.index({ conversation: 1, mimeType: 1 });   // attachment search

attachmentSchema.pre('validate', function (next) {
  if (this.fileSize > MAX_ATTACHMENT_SIZE_BYTES) {
    return next(new Error(`File exceeds max allowed size of ${MAX_ATTACHMENT_SIZE_BYTES} bytes`));
  }
  next();
});

const Attachment = mongoose.model('Attachment', attachmentSchema);
export default Attachment;
