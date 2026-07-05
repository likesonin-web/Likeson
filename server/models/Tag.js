import mongoose from 'mongoose';
import softDeletePlugin from '../utils/softDeletePlugin.js';

const { Schema } = mongoose;

const tagSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, lowercase: true, unique: true },
    color: { type: String, default: '#64748b' }, // hex, used by frontend chip
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

tagSchema.plugin(softDeletePlugin);
tagSchema.index({ name: 'text' });

export default mongoose.models.Tag || mongoose.model('Tag', tagSchema);