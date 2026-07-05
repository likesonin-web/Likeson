import mongoose from 'mongoose';
import softDeletePlugin from '../utils/softDeletePlugin.js';

const { Schema } = mongoose;

// Internal-staff-only notes on a ticket. Customer routes must NEVER select/return these.
const internalNoteSchema = new Schema(
  {
    ticket: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRole: { type: String, required: true },

    body: { type: String, required: true, trim: true, maxlength: 4000 },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }], // @mentioned staff, trigger notification

    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date, default: null },

    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

internalNoteSchema.plugin(softDeletePlugin);
internalNoteSchema.index({ ticket: 1, isPinned: -1, createdAt: -1 });

export default mongoose.models.InternalNote || mongoose.model('InternalNote', internalNoteSchema);