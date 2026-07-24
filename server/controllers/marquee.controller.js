/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ENTERPRISE MARQUEE ROUTER  —  Likeson.in Healthcare Platform
 * * Upgraded for Guest Support, High-Scale Analytics, and Targeted Audiences.
 * Base path (mount in app.js):  app.use('/api/marquee', marqueeRouter)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import Marquee  from '../models/Marquee.js';
import User from '../models/User.js'; // Assuming you have a User model
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js'; 
import { invalidatePattern, invalidateKey } from '../utils/cacheInvalidation.js';


// ─────────────────────────────────────────────────────────────────────────────
//  MIDDLEWARE & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Optional Auth Middleware
 * Allows a route to be accessed by BOTH guests and logged-in users.
 * If a valid token exists, req.user is populated. If not, req.user is null.
 */
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (error) {
      // Token failed, but we still allow them to proceed as a guest
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
};

/**
 * Wipes out marquee caches.
 */
const clearMarqueeCaches = async (marqueeId = null) => {
  await invalidatePattern('GET:/api/marquee/admin*');
  await invalidatePattern('user:*:marquees');
  await invalidatePattern('public:marquees'); // Added for guest caches
  if (marqueeId) await invalidateKey(`marquee:${marqueeId}`);
};

/**
 * buildLiveQuery
 * ──────────────
 * Builds a highly optimized Mongoose query based on the new Audience model.
 */
const buildLiveQuery = (user) => {
  const now = new Date();
  
  const baseQuery = {
    status: 'published',
    startsAt: { $lte: now },
    $or: [{ endsAt: null }, { endsAt: { $gt: now } }],
  };

  if (!user) {
    // Guest User logic
    baseQuery.audience = { $in: ['public', 'guests_only'] };
  } else {
    // Authenticated User logic
    const userOid = new mongoose.Types.ObjectId(String(user._id));
    
    // An authenticated user sees: Public, Authenticated, OR Targeted (if they match)
    baseQuery.$or = [
      { audience: { $in: ['public', 'authenticated'] } },
      { 
        audience: 'targeted',
        $or: [
          { targetRoles: user.role },
          { targetUsers: userOid }
        ]
      }
    ];
  }

  return baseQuery;
};

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC / USER ROUTES (CONSUMPTION)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/marquee
 * Dynamically fetches active marquees based on guest or user status.
 */

import asyncHandler from '../utils/asyncHandler.js';

// GET '/'
export const get = asyncHandler(async (req, res) => {
    try {
      const query = buildLiveQuery(req.user);

      // We explicitly select clientKey so the frontend can track dismissals locally
      const marquees = await Marquee.find(query)
        .select('message subText icon type speed priority clientKey isDismissible cta audience')         
        .sort({ priority: -1, createdAt: -1 })
        .lean();

      // Fire-and-forget impression counter
      if (marquees.length > 0) {
        const ids = marquees.map((m) => m._id);
        Marquee.updateMany(
          { _id: { $in: ids } },
          { $inc: { 'analytics.impressions': 1 } },
        ).catch((err) => console.error('Failed to update impressions', err));
      }

      res.json({ success: true, marquees });
    } catch (err) {
      console.error('[Marquee GET /]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

// POST '/:id/dismiss'
export const postByIdDismiss = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid marquee id' });
    }

    const marquee = await Marquee.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.dismissals': 1 },
    });

    if (!marquee) return res.status(404).json({ success: false, message: 'Marquee not found' });

    res.json({ 
      success: true, 
      message: 'Dismissal recorded.',
      clientKey: marquee.clientKey 
    });
  } catch (err) {
    console.error('[Marquee POST /dismiss]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST '/:id/click'
export const postByIdClick = asyncHandler(async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid marquee id' });
    }

    await Marquee.findByIdAndUpdate(req.params.id, {
      $inc: { 'analytics.clicks': 1 },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[Marquee POST /click]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET '/admin/analytics/summary'
export const getAdminAnalyticsSummary = asyncHandler(async (req, res) => {
    try {
      const [totals, byType, topClicked] = await Promise.all([
        Marquee.aggregate([
          {
            $group: {
              _id:           null,
              totalMarquees: { $sum: 1 },
              publishedCount:{ $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
              impressions:   { $sum: '$analytics.impressions' },
              clicks:        { $sum: '$analytics.clicks' },
              dismissals:    { $sum: '$analytics.dismissals' },
            },
          },
        ]),
        Marquee.aggregate([
          {
            $group: {
              _id:         '$type',
              count:       { $sum: 1 },
              impressions: { $sum: '$analytics.impressions' },
            },
          },
          { $sort: { count: -1 } },
        ]),
        Marquee.find()
          .select('message type analytics priority status audience')
          .sort({ 'analytics.clicks': -1 })
          .limit(5)
          .lean(),
      ]);

      res.json({
        success: true,
        summary: totals[0] || { totalMarquees: 0, publishedCount: 0, impressions: 0, clicks: 0, dismissals: 0 },
        byType,
        topClicked,
      });
    } catch (err) {
      console.error('[Marquee GET /admin/analytics/summary]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

// GET '/admin'
export const getAdmin = asyncHandler(async (req, res) => {
    try {
      const { page = 1, limit = 20, type, status, audience, search } = req.query;

      const filter = {};
      if (type)     filter.type     = type;
      if (status)   filter.status   = status;
      if (audience) filter.audience = audience;
      if (search)   filter.message  = { $regex: search, $options: 'i' };

      const skip  = (Number(page) - 1) * Number(limit);
      const [total, marquees] = await Promise.all([
        Marquee.countDocuments(filter),
        Marquee.find(filter)
          .populate('createdBy', 'name role avatar')
          .populate('updatedBy', 'name role')
          .sort({ priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
      ]);

      res.json({
        success: true,
        marquees,
        pagination: { total, pages: Math.ceil(total / Number(limit)), page: Number(page), limit: Number(limit) },
      });
    } catch (err) {
      console.error('[Marquee GET /admin]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

// GET '/admin/:id'
export const getAdminById = asyncHandler(async (req, res) => {
    try {
      const marquee = await Marquee.findById(req.params.id)
        .populate('createdBy',   'name role avatar')
        .populate('updatedBy',   'name role')
        .populate('targetUsers', 'name role avatar email');   

      if (!marquee) return res.status(404).json({ success: false, message: 'Marquee not found' });
      res.json({ success: true, marquee });
    } catch (err) {
      console.error('[Marquee GET /admin/:id]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

// POST '/admin'
export const postAdmin = asyncHandler(async (req, res) => {
    try {
      const {
        message, subText, icon, type, speed, priority, isDismissible, cta, 
        audience, targetRoles, targetUsers, targetPages, startsAt, endsAt, status
      } = req.body;

      const safeTargetUsers = Array.isArray(targetUsers)
        ? targetUsers.filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
        : [];

      const marquee = await Marquee.create({
        message:       message?.trim(),
        subText:       subText?.trim()  || '',
        icon:          icon?.trim()     || '',
        type:          type             || 'info',
        speed:         speed            || 'normal',
        priority:      Number(priority) || 0,
        isDismissible: isDismissible !== false,
        audience:      audience         || 'public',
        status:        status           || 'draft',
        cta: {
          label:  cta?.label?.trim() || '',
          url:    cta?.url?.trim()   || '',
          target: cta?.target        || '_self',
        },
        targetRoles:  Array.isArray(targetRoles) ? targetRoles : [],
        targetUsers:  safeTargetUsers,
        targetPages:  Array.isArray(targetPages) ? targetPages : [],
        startsAt:     startsAt ? new Date(startsAt) : new Date(),
        endsAt:       endsAt   ? new Date(endsAt)   : null,
        createdBy:    req.user._id,
      });

      const populated = await marquee.populate([
        { path: 'createdBy', select: 'name role avatar' },
        { path: 'targetUsers', select: 'name role avatar email' },
      ]);

      await clearMarqueeCaches();
      res.status(201).json({ success: true, marquee: populated });
    } catch (err) {
      console.error('[Marquee POST /admin]', err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

// PATCH '/admin/:id'
export const patchAdminById = asyncHandler(async (req, res) => {
    try {
      const marquee = await Marquee.findById(req.params.id);
      if (!marquee) return res.status(404).json({ success: false, message: 'Marquee not found' });

      const SCALAR_FIELDS = [
        'message', 'subText', 'icon', 'type', 'speed', 'priority',
        'isDismissible', 'targetPages', 'audience', 'status'
      ];

      SCALAR_FIELDS.forEach((key) => {
        if (req.body[key] !== undefined) marquee[key] = req.body[key];
      });

      if (req.body.startsAt !== undefined) marquee.startsAt = req.body.startsAt ? new Date(req.body.startsAt) : new Date();
      if (req.body.endsAt !== undefined)   marquee.endsAt   = req.body.endsAt   ? new Date(req.body.endsAt)   : null;
      if (Array.isArray(req.body.targetRoles)) marquee.targetRoles = req.body.targetRoles;
      if (Array.isArray(req.body.targetUsers)) marquee.targetUsers = req.body.targetUsers.filter(id => mongoose.Types.ObjectId.isValid(String(id)));
      if (req.body.cta) marquee.cta = { ...marquee.cta.toObject(), ...req.body.cta };

      marquee.updatedBy = req.user._id;
      await marquee.save();

      const populated = await marquee.populate([
        { path: 'createdBy',   select: 'name role avatar' },
        { path: 'updatedBy',   select: 'name role' },
        { path: 'targetUsers', select: 'name role avatar email' },
      ]);

      await clearMarqueeCaches(marquee._id);
      res.json({ success: true, marquee: populated });
    } catch (err) {
      console.error('[Marquee PATCH /admin/:id]', err);
      res.status(400).json({ success: false, message: err.message });
    }
  });

// PATCH '/admin/:id/status'
export const patchAdminByIdStatus = asyncHandler(async (req, res) => {
    try {
      const { status } = req.body;
      if (!['draft', 'published', 'archived'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      const marquee = await Marquee.findByIdAndUpdate(
        req.params.id,
        { status, updatedBy: req.user._id },
        { new: true }
      );

      if (!marquee) return res.status(404).json({ success: false, message: 'Marquee not found' });

      await clearMarqueeCaches(marquee._id);
      res.json({ success: true, status: marquee.status, message: `Marquee marked as ${status}` });
    } catch (err) {
      console.error('[Marquee PATCH /admin/:id/status]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

// DELETE '/admin/:id'
export const deleteAdminById = asyncHandler(async (req, res) => {
    try {
      const marquee = await Marquee.findByIdAndDelete(req.params.id);
      if (!marquee) return res.status(404).json({ success: false, message: 'Marquee not found' });

      await clearMarqueeCaches(req.params.id);
      res.json({ success: true, message: 'Marquee permanently deleted' });
    } catch (err) {
      console.error('[Marquee DELETE /admin/:id]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

// DELETE '/admin/:id/analytics'
export const deleteAdminByIdAnalytics = asyncHandler(async (req, res) => {
    try {
      await Marquee.findByIdAndUpdate(req.params.id, {
        $set: { 'analytics.impressions': 0, 'analytics.clicks': 0, 'analytics.dismissals': 0 },
      });

      await clearMarqueeCaches(req.params.id);
      res.json({ success: true, message: 'Marquee analytics reset to zero' });
    } catch (err) {
      console.error('[Marquee DELETE /admin/:id/analytics]', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });
