import Advertisement, { VALID_TRACK_TYPES } from '../models/Advertisement.js';
import Notification from '../models/Notification.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import sendEmail from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';


// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM: Archive Expired Ads (Call this from a cron job)
// ─────────────────────────────────────────────────────────────────────────────
export const archiveExpiredAds = async () => {
    const now = new Date();
    const result = await Advertisement.updateMany(
        { status: 'Active', 'schedule.endDate': { $lt: now, $ne: null } },
        { $set: { status: 'Archived' } }
    );
    return result.modifiedCount;
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Get all ads (with pagination)
// ─────────────────────────────────────────────────────────────────────────────

// GET '/'
export const get = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = req.query.status ? { status: req.query.status } : {};

    const [ads, total] = await Promise.all([
        Advertisement.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('createdBy', 'name email')
            .lean(),
        Advertisement.countDocuments(filter)
    ]);

    res.status(200).json({ 
        success: true, 
        count: ads.length, 
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        data: ads 
    });
});

// GET '/analytics'
export const getAnalytics = asyncHandler(async (req, res) => {
    const [agg] = await Advertisement.aggregate([
        {
            $group: {
                _id: null,
                totalViews:  { $sum: { $ifNull: ['$analytics.views', 0] } },
                totalClicks: { $sum: { $ifNull: ['$analytics.clicks', 0] } },
                activeCount: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
            },
        },
        {
            $project: {
                _id: 0,
                totalViews: 1,
                totalClicks: 1,
                activeCount: 1,
                avgCtr: {
                    $cond: [
                        { $gt: ['$totalViews', 0] },
                        { $multiply: [{ $divide: ['$totalClicks', '$totalViews'] }, 100] },
                        0,
                    ],
                },
            },
        },
    ]);

    res.status(200).json({
        success: true,
        data: agg ?? { totalViews: 0, totalClicks: 0, activeCount: 0, avgCtr: 0 },
    });
});

// POST '/'
export const post = asyncHandler(async (req, res) => {
    const ad = await Advertisement.create({ ...req.body, createdBy: req.user._id });
    
    await Notification.create({
        recipient: req.user._id,
        title: 'Campaign Launched 🚀',
        body: `Ad "${ad.adContent.headline}" is now live.`,
        type: 'Promo_Marketing',
    });

    res.status(201).json({ success: true, data: ad });
});

// GET '/serve'
export const getServe = asyncHandler(async (req, res) => {
    const { page, slot } = req.query;

    if (!page || !slot) {
        return res.status(400).json({ success: false, message: 'page and slot query params required' });
    }

    const now = new Date();
    const currentHour = now.getUTCHours(); // 0–23 UTC

    // Base query targeting active, scheduled, non-depleted ads
    const baseQuery = {
        status: 'Active',
        'placement.page': page,
        'placement.slot': slot,
        'schedule.startDate': { $lte: now },
        $or: [
            { 'schedule.endDate': { $exists: false } },
            { 'schedule.endDate': null },
            { 'schedule.endDate': { $gte: now } },
        ],
        $expr: { $lt: ['$budget.currentSpend', '$budget.totalMax'] },
        $and: [
            {
                $or: [
                    { 'schedule.displayHours': { $size: 0 } },
                    { 'schedule.displayHours': { $exists: false } },
                    { 'schedule.displayHours': currentHour },
                ],
            },
        ],
    };

    // 1. Fetch Global Ads (Coordinates exactly [0,0])
    const globalAdsPromise = Advertisement.find({
        ...baseQuery,
        'targeting.location.coordinates': [0, 0],
    }).lean();

    let geoAdsPromise = Promise.resolve([]);

    // 2. Fetch Geo-Targeted Ads (if user has coordinates)
    const customerCoords = req.user?.location?.coordinates;
    const hasCustomerLocation = Array.isArray(customerCoords) && customerCoords.length === 2;

    if (hasCustomerLocation) {
        const [lng, lat] = customerCoords;
        geoAdsPromise = Advertisement.aggregate([
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [lng, lat] },
                    distanceField: '_distanceMeters',
                    maxDistance: 500 * 1000, // 500 km cap to limit scan
                    spherical: true,
                    query: {
                        ...baseQuery,
                        // Exclude global ads so we don't duplicate them
                        'targeting.location.coordinates': { $ne: [0, 0] }
                    },
                },
            },
            {
                // Strict check: distance must be within ad's specific radius
                $match: {
                    $expr: {
                        $lte: [
                            '$_distanceMeters',
                            { $multiply: ['$targeting.radiusInKm', 1000] },
                        ],
                    },
                },
            },
            { $unset: '_distanceMeters' },
        ]);
    }

    // Execute concurrently for speed
    const [globalAds, geoAds] = await Promise.all([globalAdsPromise, geoAdsPromise]);

    // Merge, prioritize, and slice
    const ads = [...globalAds, ...geoAds]
        .sort((a, b) => {
            if (b.placement.priority !== a.placement.priority) {
                return b.placement.priority - a.placement.priority;
            }
            // Tie-breaker: newest first
            return new Date(b.createdAt) - new Date(a.createdAt);
        })
        .slice(0, 10);

    res.status(200).json({ success: true, count: ads.length, data: ads });
});

// PATCH '/:id/track'
export const patchByIdTrack = asyncHandler(async (req, res) => {
    const { type } = req.body;

    if (!VALID_TRACK_TYPES.includes(type)) {
        return res.status(400).json({
            success: false,
            message: `Invalid type "${type}". Must be one of: ${VALID_TRACK_TYPES.join(', ')}`,
        });
    }

    // Deduplication check
    const cooldownKey = `${req.user._id}:${req.params.id}:${type}`;
    const now = Date.now();
    if (trackCooldown.has(cooldownKey) && (now - trackCooldown.get(cooldownKey) < COOLDOWN_MS)) {
        return res.status(200).json({ success: true, deduplicated: true });
    }
    trackCooldown.set(cooldownKey, now);

    const cost = type === 'click' ? 1.0 : 0.05; // Standardized pricing

    // Atomically increment stats and apply cost
    const updatedAd = await Advertisement.findOneAndUpdate(
        { _id: req.params.id, status: 'Active' },
        {
            $inc: { 
                [`analytics.${type}s`]: 1, 
                'budget.currentSpend': cost 
            },
            $set: { 'analytics.lastEventAt': new Date() },
        },
        { new: true }
    ).populate('createdBy', 'email name');

    if (!updatedAd) {
        // If not found or not active, silently return success to avoid frontend errors
        return res.status(200).json({ success: true, message: 'Ad ignored or inactive' });
    }

    // Check for depletion AFTER increment
    if (updatedAd.budget.currentSpend >= updatedAd.budget.totalMax) {
        updatedAd.status = 'Depleted';
        await updatedAd.save(); // Triggers mongoose hooks for the change

        const ownerEmail = updatedAd.createdBy?.email;
        if (ownerEmail) {
            await sendEmail({
                email: ownerEmail,
                subject: '⚠️ Ad Budget Depleted',
                html: transactionalTemplate({
                    header: 'PAUSED',
                    title: updatedAd.adContent.headline,
                    body: 'Your advertisement budget has reached 100%. The campaign is now paused.',
                    buttonText: 'Manage Ads',
                    buttonLink: 'https://likeson.in/admin/ads',
                }),
            }).catch(err => console.error('Email failed:', err)); // Prevent failing request if email service is down
        }
    }

    res.status(200).json({ success: true, spend: updatedAd.budget.currentSpend });
});

// PUT '/:id'
export const putById = asyncHandler(async (req, res) => {
    const updatedAd = await Advertisement.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.user._id },
        { new: true, runValidators: true }
    );
    if (!updatedAd) return res.status(404).json({ success: false, message: 'Ad not found' });
    
    res.status(200).json({ success: true, data: updatedAd });
});

// DELETE '/:id'
export const deleteById = asyncHandler(async (req, res) => {
    const ad = await Advertisement.findByIdAndUpdate(
        req.params.id,
        { status: 'Archived', updatedBy: req.user._id },
        { new: true }
    );
    if (!ad) return res.status(404).json({ success: false, message: 'Ad not found' });
    
    res.status(200).json({ success: true, message: 'Ad successfully archived' });
});
