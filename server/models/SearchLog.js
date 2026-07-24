/**
 * SearchLog.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Append-only event log. One doc per search request.
 * Powers: trending, most-searched, per-user history, click-through analytics.
 * Never updated after insert (except clickedResultId/Type on a result click).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

export const SEARCH_ENTITY_TYPES = ['all', 'medicine', 'doctor', 'hospital', 'lab'];

const searchLogSchema = new Schema(
  {
    query:           { type: String, required: true, trim: true },
    // Lowercased, whitespace-collapsed — the aggregation key for trending/most-searched.
    normalizedQuery: { type: String, required: true, trim: true, lowercase: true, index: true },

    type: { type: String, enum: SEARCH_ENTITY_TYPES, default: 'all', index: true },

    filters: { type: Schema.Types.Mixed }, // city, specialization, category, priceRange, etc.

    user:      { type: Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    sessionId: { type: String, index: true }, // for anonymous users (cookie/device id)

    resultsCount: { type: Number, default: 0, min: 0 },
    isZeroResult: { type: Boolean, default: false, index: true }, // useful for catalogue-gap reports

    // Optional: set later via /search/click when a user taps a result.
    clickedResultId:   { type: Schema.Types.ObjectId, default: null },
    clickedResultType: { type: String, enum: ['medicine', 'doctor', 'hospital', 'lab', null], default: null },
    clickedAt:          { type: Date, default: null },
    clickPosition:      { type: Number, default: null }, // rank in results list, for relevance tuning

    ip:        { type: String },
    userAgent: { type: String },
    source:    { type: String, enum: ['web', 'mobile', 'api'], default: 'web' },
  },
  { timestamps: true }
);

// ── Pre-validate: derive normalizedQuery + isZeroResult ─────────────────────
searchLogSchema.pre('validate', function () {
  if (this.query && !this.normalizedQuery) {
    this.normalizedQuery = this.query.toLowerCase().trim().replace(/\s+/g, ' ');
  }
  if (this.isModified('resultsCount')) {
    this.isZeroResult = this.resultsCount === 0;
  }
});

// ── Indexes ───────────────────────────────────────────────────────────────────

// Trending / most-searched aggregation — filter by type+time, group by normalizedQuery.
searchLogSchema.index({ normalizedQuery: 1, type: 1, createdAt: -1 });
// Per-user history, most recent first.
searchLogSchema.index({ user: 1, createdAt: -1 });
// TTL-style cleanup candidate (kept manual here — see purgeOlderThan static).
searchLogSchema.index({ createdAt: -1 });

// ── Statics ───────────────────────────────────────────────────────────────────

/**
 * Aggregate top searched terms within an optional time window.
 * windowHours = null → all-time ("most searched").
 * windowHours = 24/168 → trending (last day / last week).
 */
searchLogSchema.statics.getTopQueries = function ({ type = 'all', windowHours = null, limit = 10 } = {}) {
  const match = { normalizedQuery: { $ne: '' } };
  if (type !== 'all') match.type = type;
  if (windowHours) match.createdAt = { $gte: new Date(Date.now() - windowHours * 3600 * 1000) };

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$normalizedQuery',
        count: { $sum: 1 },
        lastSearchedAt: { $max: '$createdAt' },
        avgResultsCount: { $avg: '$resultsCount' },
      },
    },
    { $sort: { count: -1, lastSearchedAt: -1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        query: '$_id',
        count: 1,
        lastSearchedAt: 1,
        avgResultsCount: { $round: ['$avgResultsCount', 1] },
      },
    },
  ]);
};

/** Queries returning 0 results — surfaces catalogue gaps / SEO keyword targets. */
searchLogSchema.statics.getZeroResultQueries = function ({ windowHours = 168, limit = 20 } = {}) {
  const match = { isZeroResult: true, normalizedQuery: { $ne: '' } };
  if (windowHours) match.createdAt = { $gte: new Date(Date.now() - windowHours * 3600 * 1000) };
  return this.aggregate([
    { $match: match },
    { $group: { _id: '$normalizedQuery', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit },
    { $project: { _id: 0, query: '$_id', count: 1 } },
  ]);
};

const SearchLog = mongoose.model('SearchLog', searchLogSchema);
export default SearchLog;