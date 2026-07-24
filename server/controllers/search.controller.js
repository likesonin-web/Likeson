/**
 * search.controller.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified search across Medicine, DoctorProfile, Hospital, LabPartnerProfile.
 * Every hit is logged (fire-and-forget) to SearchLog → powers trending,
 * most-searched, per-user history, and zero-result gap reports.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import mongoose from 'mongoose';
import Medicine from '../models/Medicine.js';
import DoctorProfile from '../models/DoctorProfile.js';
import Hospital from '../models/Hospital.js';
import LabPartnerProfile from '../models/LabPartnerProfile.js';
import SearchLog, { SEARCH_ENTITY_TYPES } from '../models/SearchLog.js';
import { cached, cacheDel } from '../utils/simpleCache.js';

// ── Config ────────────────────────────────────────────────────────────────────

const MIN_QUERY_LEN = 2;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const SUGGESTION_LIMIT = 8;

const TRENDING_TTL_SECONDS = 120;      // trending recomputed at most every 2 min
const MOST_SEARCHED_TTL_SECONDS = 900; // all-time list recomputed every 15 min
const CATEGORY_TTL_SECONDS = 900;

// ── Helpers ───────────────────────────────────────────────────────────────────

const clampLimit = (v) => Math.min(Math.max(parseInt(v, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
const clampPage = (v) => Math.max(parseInt(v, 10) || 1, 1);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Fire-and-forget search logger. Never let logging failure break a search response.
 */
function logSearch({ req, query, type, resultsCount, filters }) {
  SearchLog.create({
    query,
    type,
    filters,
    resultsCount,
    user: req.user?._id ?? null,
    sessionId: req.headers['x-session-id'] || req.sessionID || undefined,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    source: req.headers['x-client'] || 'web',
  }).catch((err) => {
    // Logging must never fail the request. Swap for real logger (pino/winston) in prod.
    console.error('[SearchLog] failed to persist search event:', err.message);
  });
}

// ── Per-entity search functions ──────────────────────────────────────────────
// Each returns { items, total } so the aggregator can paginate/merge consistently.

async function searchMedicines(q, { limit, skip, category, prescriptionOnly } = {}) {
  const filter = { isApproved: true, isDiscontinued: false, isDeleted: false };
  if (category) filter.category = category;
  if (prescriptionOnly !== undefined) filter.isPrescriptionRequired = prescriptionOnly === 'true';

  let query;
  if (q.length >= MIN_QUERY_LEN) {
    filter.$text = { $search: q };
    query = Medicine.find(filter, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } });
  } else {
    query = Medicine.find(filter);
  }

  const [items, total] = await Promise.all([
    query
      .select('name brandName genericName slug category dosage packaging referenceMrp images isPrescriptionRequired schedule manufacturer')
      .skip(skip)
      .limit(limit)
      .lean(),
    Medicine.countDocuments(filter),
  ]);

  return { items: items.map((m) => ({ ...m, resultType: 'medicine' })), total };
}

async function searchDoctors(q, { limit, skip, specialization, city } = {}) {
  const filter = { isActive: true, isVerified: true };
  if (specialization) filter.specialization = specialization;

  const or = [];
  if (q.length >= MIN_QUERY_LEN) {
    const rx = new RegExp(escapeRegex(q), 'i');
    or.push({ specialization: rx }, { registrationCouncil: rx }, { biography: rx });
  }
  if (or.length) filter.$or = or;

  let pipeline = DoctorProfile.find(filter)
    .populate({ path: 'user', select: 'name email phone' })
    .populate({ path: 'primaryHospital', select: 'name address.city hospitalType' });

  if (city) pipeline = pipeline.where('primaryHospital').exists(true);

  const [items, total] = await Promise.all([
    pipeline
      .select('specialization experienceYears qualifications fees rating profilePhotoUrl primaryHospital isOnline consultationTypes')
      .sort({ 'rating.averageRating': -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DoctorProfile.countDocuments(filter),
  ]);

  // Post-filter by hospital city if requested (city lives on the populated Hospital doc).
  const filtered = city
    ? items.filter((d) => d.primaryHospital?.address?.city?.toLowerCase() === city.toLowerCase())
    : items;

  return { items: filtered.map((d) => ({ ...d, resultType: 'doctor' })), total };
}

async function searchHospitals(q, { limit, skip, city, hospitalType } = {}) {
  const filter = { isActive: true, isVerified: true };
  if (hospitalType) filter.hospitalType = hospitalType;
  if (city) filter['address.city'] = new RegExp(escapeRegex(city), 'i');

  const or = [];
  if (q.length >= MIN_QUERY_LEN) {
    const rx = new RegExp(escapeRegex(q), 'i');
    or.push({ name: rx }, { specialties: rx }, { facilities: rx });
  }
  if (or.length) filter.$or = or;

  const [items, total] = await Promise.all([
    Hospital.find(filter)
      .select('name slug hospitalType address logo rating specialties isEmergencyReady hasICU is24x7')
      .sort({ 'rating.averageRating': -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Hospital.countDocuments(filter),
  ]);

  return { items: items.map((h) => ({ ...h, resultType: 'hospital' })), total };
}

async function searchLabs(q, { limit, skip, city, labType } = {}) {
  const filter = { status: 'approved', isActive: true };
  if (labType) filter.labType = labType;
  if (city) filter['registeredAddress.city'] = new RegExp(escapeRegex(city), 'i');

  if (q.length >= MIN_QUERY_LEN) {
    filter.$text = { $search: q };
  }

  const cursor = filter.$text
    ? LabPartnerProfile.find(filter, { score: { $meta: 'textScore' } }).sort({ score: { $meta: 'textScore' } })
    : LabPartnerProfile.find(filter).sort({ averageRating: -1 });

  const [items, total] = await Promise.all([
    cursor
      .select('labName labCode labType logoUrl registeredAddress averageRating totalReviews sampleCollectionMode homeCollectionFee')
      .skip(skip)
      .limit(limit)
      .lean(),
    LabPartnerProfile.countDocuments(filter),
  ]);

  return { items: items.map((l) => ({ ...l, resultType: 'lab' })), total };
}

const SEARCHERS = {
  medicine: searchMedicines,
  doctor: searchDoctors,
  hospital: searchHospitals,
  lab: searchLabs,
};

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/search?q=&type=all|medicine|doctor|hospital|lab&page=&limit=
 *   &city=&specialization=&category=&hospitalType=&labType=&prescriptionOnly=
 *
 * type=all → runs all four searchers in parallel, each capped at `limit`,
 *            response grouped by entity so the frontend can render sections.
 * type=X   → single entity, real pagination (skip/limit honored against total).
 */
export async function unifiedSearch(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const type = SEARCH_ENTITY_TYPES.includes(req.query.type) ? req.query.type : 'all';
    const limit = clampLimit(req.query.limit);
    const page = clampPage(req.query.page);
    const skip = (page - 1) * limit;

    if (q && q.length < MIN_QUERY_LEN) {
      return res.status(400).json({ success: false, message: `Query must be at least ${MIN_QUERY_LEN} characters` });
    }

    const opts = {
      limit,
      skip,
      city: req.query.city,
      specialization: req.query.specialization,
      category: req.query.category,
      hospitalType: req.query.hospitalType,
      labType: req.query.labType,
      prescriptionOnly: req.query.prescriptionOnly,
    };

    let payload;
    let totalResultsCount = 0;

    if (type === 'all') {
      const [medicines, doctors, hospitals, labs] = await Promise.all([
        searchMedicines(q, opts),
        searchDoctors(q, opts),
        searchHospitals(q, opts),
        searchLabs(q, opts),
      ]);
      totalResultsCount = medicines.total + doctors.total + hospitals.total + labs.total;
      payload = {
        medicines: { items: medicines.items, total: medicines.total },
        doctors: { items: doctors.items, total: doctors.total },
        hospitals: { items: hospitals.items, total: hospitals.total },
        labs: { items: labs.items, total: labs.total },
      };
    } else {
      const searcher = SEARCHERS[type];
      const { items, total } = await searcher(q, opts);
      totalResultsCount = total;
      payload = { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    if (q) {
      logSearch({ req, query: q, type, resultsCount: totalResultsCount, filters: opts });
    }

    return res.json({ success: true, query: q, type, data: payload });
  } catch (err) {
    console.error('[unifiedSearch] error:', err);
    return res.status(500).json({ success: false, message: 'Search failed', error: err.message });
  }
}

/**
 * GET /api/search/suggestions?q=&type=
 * Lightweight autocomplete — prefix-friendly regex on name-ish fields,
 * small limit, no text-index scoring (text index doesn't do prefix well).
 */
export async function autocomplete(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: [] });

    const rx = new RegExp('^' + escapeRegex(q), 'i');
    const type = SEARCH_ENTITY_TYPES.includes(req.query.type) ? req.query.type : 'all';

    const tasks = [];

    if (type === 'all' || type === 'medicine') {
      tasks.push(
        Medicine.find({ isDeleted: false, isApproved: true, $or: [{ name: rx }, { brandName: rx }, { genericName: rx }] })
          .select('name brandName slug category')
          .limit(SUGGESTION_LIMIT)
          .lean()
          .then((rows) => rows.map((r) => ({ label: r.brandName || r.name, subtitle: r.category, type: 'medicine', slug: r.slug })))
      );
    }
    if (type === 'all' || type === 'hospital') {
      tasks.push(
        Hospital.find({ isActive: true, name: rx })
          .select('name slug address.city')
          .limit(SUGGESTION_LIMIT)
          .lean()
          .then((rows) => rows.map((r) => ({ label: r.name, subtitle: r.address?.city, type: 'hospital', slug: r.slug })))
      );
    }
    if (type === 'all' || type === 'lab') {
      tasks.push(
        LabPartnerProfile.find({ isActive: true, labName: rx })
          .select('labName labCode registeredAddress.city')
          .limit(SUGGESTION_LIMIT)
          .lean()
          .then((rows) => rows.map((r) => ({ label: r.labName, subtitle: r.registeredAddress?.city, type: 'lab', code: r.labCode })))
      );
    }
    if (type === 'all' || type === 'doctor') {
      tasks.push(
        DoctorProfile.find({ isActive: true, specialization: rx })
          .select('specialization')
          .limit(SUGGESTION_LIMIT)
          .lean()
          .then((rows) => rows.map((r) => ({ label: r.specialization, subtitle: 'Specialization', type: 'doctor' })))
      );
    }

    const results = (await Promise.all(tasks)).flat().slice(0, SUGGESTION_LIMIT * 2);
    return res.json({ success: true, data: results });
  } catch (err) {
    console.error('[autocomplete] error:', err);
    return res.status(500).json({ success: false, message: 'Suggestion lookup failed' });
  }
}

/**
 * GET /api/search/trending?type=&window=day|week
 * Top queries by frequency in a recent time window. Cached — this aggregation
 * scans SearchLog, don't run it per-request under load.
 */
export async function getTrendingSearches(req, res) {
  try {
    const type = SEARCH_ENTITY_TYPES.includes(req.query.type) ? req.query.type : 'all';
    const windowHours = req.query.window === 'week' ? 168 : 24;
    const limit = clampLimit(req.query.limit || 10);

    const cacheKey = `trending:${type}:${windowHours}:${limit}`;
    const data = await cached(cacheKey, TRENDING_TTL_SECONDS, () =>
      SearchLog.getTopQueries({ type, windowHours, limit })
    );

    return res.json({ success: true, window: windowHours === 168 ? 'week' : 'day', data });
  } catch (err) {
    console.error('[getTrendingSearches] error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load trending searches' });
  }
}

/**
 * GET /api/search/most-searched?type=&limit=
 * All-time top queries — long TTL cache since this changes slowly.
 */
export async function getMostSearched(req, res) {
  try {
    const type = SEARCH_ENTITY_TYPES.includes(req.query.type) ? req.query.type : 'all';
    const limit = clampLimit(req.query.limit || 10);

    const cacheKey = `most-searched:${type}:${limit}`;
    const data = await cached(cacheKey, MOST_SEARCHED_TTL_SECONDS, () =>
      SearchLog.getTopQueries({ type, windowHours: null, limit })
    );

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[getMostSearched] error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load most-searched terms' });
  }
}

/**
 * GET /api/search/popular-categories
 * Aggregates approved/active docs by category across entities — for homepage
 * "browse by category" widgets. Cached.
 */
export async function getPopularCategories(req, res) {
  try {
    const data = await cached('popular-categories', CATEGORY_TTL_SECONDS, async () => {
      const [medicineCategories, specializations, hospitalTypes, labTypes] = await Promise.all([
        Medicine.aggregate([
          { $match: { isApproved: true, isDeleted: false, isDiscontinued: false } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 12 },
          { $project: { _id: 0, label: '$_id', count: 1 } },
        ]),
        DoctorProfile.aggregate([
          { $match: { isActive: true, isVerified: true } },
          { $group: { _id: '$specialization', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 12 },
          { $project: { _id: 0, label: '$_id', count: 1 } },
        ]),
        Hospital.aggregate([
          { $match: { isActive: true, isVerified: true } },
          { $group: { _id: '$hospitalType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, label: '$_id', count: 1 } },
        ]),
        LabPartnerProfile.aggregate([
          { $match: { isActive: true, status: 'approved' } },
          { $group: { _id: '$labType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, label: '$_id', count: 1 } },
        ]),
      ]);
      return { medicineCategories, specializations, hospitalTypes, labTypes };
    });

    return res.json({ success: true, data });
  } catch (err) {
    console.error('[getPopularCategories] error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load popular categories' });
  }
}

/**
 * GET /api/search/history  (auth required)
 * Recent distinct searches for the logged-in user, most recent first.
 */
export async function getSearchHistory(req, res) {
  try {
    if (!req.user?._id) return res.status(401).json({ success: false, message: 'Login required' });
    const limit = clampLimit(req.query.limit || 15);

    const rows = await SearchLog.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.user._id), normalizedQuery: { $ne: '' } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$normalizedQuery',
          query: { $first: '$query' },
          type: { $first: '$type' },
          searchedAt: { $first: '$createdAt' },
        },
      },
      { $sort: { searchedAt: -1 } },
      { $limit: limit },
      { $project: { _id: 0, query: 1, type: 1, searchedAt: 1 } },
    ]);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[getSearchHistory] error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load search history' });
  }
}

/**
 * DELETE /api/search/history  (auth required)
 * Clears all of the current user's search log entries (privacy control).
 */
export async function clearSearchHistory(req, res) {
  try {
    if (!req.user?._id) return res.status(401).json({ success: false, message: 'Login required' });
    await SearchLog.deleteMany({ user: req.user._id });
    return res.json({ success: true, message: 'Search history cleared' });
  } catch (err) {
    console.error('[clearSearchHistory] error:', err);
    return res.status(500).json({ success: false, message: 'Failed to clear search history' });
  }
}

/**
 * POST /api/search/click
 * body: { searchLogId, resultId, resultType, position }
 * Records which result a user clicked from a given search — feeds relevance
 * tuning later. Best-effort, never throws hard.
 */
export async function recordSearchClick(req, res) {
  try {
    const { searchLogId, resultId, resultType, position } = req.body;
    if (!searchLogId || !resultId || !resultType) {
      return res.status(400).json({ success: false, message: 'searchLogId, resultId, resultType are required' });
    }
    await SearchLog.findByIdAndUpdate(searchLogId, {
      clickedResultId: resultId,
      clickedResultType: resultType,
      clickedAt: new Date(),
      clickPosition: position ?? null,
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('[recordSearchClick] error:', err);
    return res.status(500).json({ success: false, message: 'Failed to record click' });
  }
}

/**
 * GET /api/search/zero-results  (admin)
 * Queries that returned nothing — catalogue gap report.
 */
export async function getZeroResultQueries(req, res) {
  try {
    const windowHours = parseInt(req.query.window, 10) || 168;
    const limit = clampLimit(req.query.limit || 20);
    const data = await SearchLog.getZeroResultQueries({ windowHours, limit });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[getZeroResultQueries] error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load zero-result queries' });
  }
}

// Exposed for admin/cron use: bust cached trending/category data after bulk imports.
export function invalidateSearchCaches() {
  cacheDel('trending:');
  cacheDel('most-searched:');
  cacheDel('popular-categories');
}