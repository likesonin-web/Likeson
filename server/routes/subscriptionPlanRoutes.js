import express from 'express';
import mongoose from 'mongoose';

// Models
import SubscriptionPlan from '../models/SubscriptionPlan.js';
import UserSubscription from '../models/UserSubscription.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Utilities & Middleware
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * INTERNAL HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 */

const logger = {
    info: (msg, meta = {}) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, meta),
    error: (msg, meta = {}) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, meta),
    warn: (msg, meta = {}) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`, meta),
};

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/** Fire-and-forget notification — never let notification failure break a request */
const notifyAdmins = async (title, body, type, priority, actionData = {}) => {
    try {
        const admins = await User.find({ role: { $in: ['superadmin', 'admin'] } }).select('_id');
        if (!admins.length) return;
        await Notification.insertMany(
            admins.map((a) => ({ recipient: a._id, title, body, type, priority, actionData }))
        );
    } catch (err) {
        logger.error('Notification dispatch failed (non-fatal)', { title, message: err.message });
    }
};

/** Parses ?startDate & ?endDate query params, defaults to current calendar month */
const resolveDateRange = (req) => {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const start = req.query.startDate ? new Date(req.query.startDate) : defaultStart;
    const end = req.query.endDate ? new Date(req.query.endDate) : defaultEnd;

    return { start, end };
};

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @route   GET /api/v1/plans
 * @desc    Public: active FIXED plans only. Custom plans are private per customer
 *          and must NEVER appear in the public catalog.
 * @access  Public
 */
router.get('/', asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
        isActive: true,
        planType: 'fixed',
        visibleToCustomerOnly: false,
    };

    const [plans, total] = await Promise.all([
        SubscriptionPlan.find(filter)
            .sort('displayOrder -createdAt')
            .skip(skip)
            .limit(limit),
        SubscriptionPlan.countDocuments(filter),
    ]);

    res.status(200).json({
        success: true,
        count: plans.length,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: plans,
    });
}));

/**
 * @route   GET /api/v1/plans/:id
 * @desc    Get single plan. Custom plans only visible to owning customer or admin.
 * @access  Public / Private (custom plans)
 */
router.get('/:id', asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid plan id' });
    }

    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan || !plan.isActive) {
        return res.status(404).json({ success: false, message: 'Plan not found' });
    }

    if (plan.visibleToCustomerOnly) {
        const requester = req.user;
        const isOwner = requester && String(plan.createdByCustomer) === String(requester._id);
        const isStaff = requester && ['admin', 'superadmin'].includes(requester.role);
        if (!isOwner && !isStaff) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this plan' });
        }
    }

    res.status(200).json({ success: true, data: plan });
}));

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * CUSTOMER ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @route   GET /api/v1/plans/me/subscription
 * @desc    Logged-in customer's current subscription + benefit snapshot
 * @access  Private
 */
router.get('/me/subscription', protect, asyncHandler(async (req, res) => {
    const sub = await UserSubscription.findOne({
        user: req.user._id,
        status: { $in: ['Active', 'Trial'] },
    })
        .sort('-createdAt')
        .populate('plan', 'name planType pricing consultations pharmacy diagnostics transport careAssistant support');

    if (!sub) {
        return res.status(404).json({ success: false, message: 'No active subscription found' });
    }

    res.status(200).json({
        success: true,
        data: {
            subscription: sub,
            isCurrentlyActive: sub.isCurrentlyActive,
            daysRemaining: sub.daysRemaining,
            benefitSnapshot: sub.benefitSnapshot,
        },
    });
}));

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ADMIN — PLAN MANAGEMENT
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @route   POST /api/v1/plans
 * @desc    Create a FIXED plan (admin-authored catalog tier).
 *          Custom plans are created by customers via the subscription flow,
 *          never through this admin route.
 * @access  Private/Admin
 */
router.post('/', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
    const payload = { ...req.body, planType: 'fixed', visibleToCustomerOnly: false, createdByCustomer: null };
    payload.createdBy = req.user._id;

    const plan = await SubscriptionPlan.create(payload);

    // Non-blocking — a notification failure must not fail plan creation
    notifyAdmins(
        'New Offering Launched',
        `Healthcare plan "${plan.name}" is now live.`,
        'Promo_Marketing',
        'Medium',
        { screen: 'PLAN_MANAGEMENT', referenceId: plan._id }
    );

    logger.info('New subscription plan created', { planId: plan._id, adminId: req.user._id });
    res.status(201).json({ success: true, data: plan });
}));

/**
 * @route   DELETE /api/v1/plans/:id
 * @desc    Soft delete a plan
 * @access  Private/Admin
 */
router.delete('/:id', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
    if (!isValidId(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid plan id' });
    }

    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    if (!plan.isActive) return res.status(400).json({ success: false, message: 'Plan already disabled' });

    plan.isActive = false;
    plan.updatedBy = req.user._id;
    await plan.save();

    notifyAdmins(
        'Plan Deactivated',
        `Access to ${plan.name} has been restricted.`,
        'Account_Status',
        'High'
    );

    res.status(200).json({ success: true, message: 'Plan disabled', data: plan });
}));

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ADMIN — SUBSCRIBERS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @route   GET /api/v1/plans/admin/subscribers
 * @desc    List everyone who has ever taken a plan — filterable by status/planType/search
 * @access  Private/Admin
 */
router.get('/admin/subscribers', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { status, planType, search } = req.query;

    const match = {};
    if (status) match.status = status;
    if (planType) match.planType = planType;

    const pipeline = [
        { $match: match },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDetails' } },
        { $unwind: '$userDetails' },
    ];

    if (search) {
        pipeline.push({
            $match: {
                $or: [
                    { 'userDetails.name': { $regex: search, $options: 'i' } },
                    { 'userDetails.email': { $regex: search, $options: 'i' } },
                ],
            },
        });
    }

    pipeline.push(
        {
            $project: {
                _id: 1,
                status: 1,
                planName: 1,
                planType: 1,
                expiryDate: 1,
                trialUsed: 1,
                autoRenew: 1,
                createdAt: 1,
                userName: '$userDetails.name',
                userEmail: '$userDetails.email',
                userPhone: '$userDetails.phone',
            },
        },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit }
    );

    const [subscribers, total] = await Promise.all([
        UserSubscription.aggregate(pipeline),
        UserSubscription.countDocuments(match),
    ]);

    res.status(200).json({
        success: true,
        count: subscribers.length,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: subscribers,
    });
}));

/**
 * @route   GET /api/v1/plans/admin/active-subscriptions
 * @desc    Everyone with a CURRENTLY valid subscription (Active or Trial, not expired)
 *          FIX: previous version referenced non-existent `usageThisMonth` field.
 *          Correct source is `usageHistory[]`, filtered to the current month/year.
 * @access  Private/Admin
 */
router.get('/admin/active-subscriptions', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const match = { status: { $in: ['Active', 'Trial'] }, expiryDate: { $gte: now } };

    const pipeline = [
        { $match: match },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'userDetails' } },
        { $unwind: '$userDetails' },
        { $lookup: { from: 'subscriptionplans', localField: 'plan', foreignField: '_id', as: 'planDetails' } },
        { $unwind: '$planDetails' },
        {
            $addFields: {
                currentUsage: {
                    $first: {
                        $filter: {
                            input: '$usageHistory',
                            as: 'u',
                            cond: { $and: [{ $eq: ['$$u.month', currentMonth] }, { $eq: ['$$u.year', currentYear] }] },
                        },
                    },
                },
            },
        },
        {
            $project: {
                _id: 1,
                status: 1,
                expiryDate: 1,
                daysRemaining: {
                    $ceil: { $divide: [{ $subtract: ['$expiryDate', now] }, 1000 * 60 * 60 * 24] },
                },
                userName: '$userDetails.name',
                userEmail: '$userDetails.email',
                planName: '$planDetails.name',
                planType: '$planDetails.planType',
                monthlyValue: '$planDetails.pricing.monthly',
                usage: {
                    consultationsUsed: { $ifNull: ['$currentUsage.consultationsUsed', 0] },
                    transportRidesUsed: { $ifNull: ['$currentUsage.transportRidesUsed', 0] },
                    labTestsUsed: { $ifNull: ['$currentUsage.labTestsUsed', 0] },
                    careAssistantVisitsUsed: { $ifNull: ['$currentUsage.careAssistantVisitsUsed', 0] },
                },
            },
        },
        { $sort: { expiryDate: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
    ];

    const [activeSubs, total] = await Promise.all([
        UserSubscription.aggregate(pipeline),
        UserSubscription.countDocuments(match),
    ]);

    res.status(200).json({
        success: true,
        count: activeSubs.length,
        pagination: { total, page, pages: Math.ceil(total / limit) },
        data: activeSubs,
    });
}));

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ADMIN — REVENUE ANALYTICS
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * @route   GET /api/v1/plans/admin/revenue/summary
 * @desc    MRR (from currently active subs' plan.pricing.monthly) +
 *          actual collected revenue (from paymentHistory) for a date range +
 *          subscriber status breakdown + new subs in period.
 *          Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD (defaults to this month)
 * @access  Private/Admin
 */
router.get('/admin/revenue/summary', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
    const now = new Date();
    const { start, end } = resolveDateRange(req);

    const [mrrResult, revenueResult, statusBreakdown, newSubsInPeriod] = await Promise.all([
        // MRR — sum of plan.pricing.monthly for every currently active/trial subscriber
        UserSubscription.aggregate([
            { $match: { status: { $in: ['Active', 'Trial'] }, expiryDate: { $gte: now } } },
            { $lookup: { from: 'subscriptionplans', localField: 'plan', foreignField: '_id', as: 'planDoc' } },
            { $unwind: '$planDoc' },
            { $group: { _id: null, mrr: { $sum: '$planDoc.pricing.monthly' }, activeCount: { $sum: 1 } } },
        ]),

        // Actual money collected in the period (from paymentHistory, source of truth)
        UserSubscription.aggregate([
            { $unwind: '$paymentHistory' },
            { $match: { 'paymentHistory.paidAt': { $gte: start, $lte: end } } },
            { $group: { _id: null, totalRevenue: { $sum: '$paymentHistory.amount' }, transactionCount: { $sum: 1 } } },
        ]),

        // Subscriber counts grouped by status (all time)
        UserSubscription.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        UserSubscription.countDocuments({ createdAt: { $gte: start, $lte: end } }),
    ]);

    res.status(200).json({
        success: true,
        data: {
            period: { start, end },
            mrr: mrrResult[0]?.mrr ?? 0,
            activeSubscriptionsCount: mrrResult[0]?.activeCount ?? 0,
            revenueThisPeriod: revenueResult[0]?.totalRevenue ?? 0,
            transactionCount: revenueResult[0]?.transactionCount ?? 0,
            newSubscriptionsInPeriod: newSubsInPeriod,
            statusBreakdown: statusBreakdown.reduce((acc, s) => {
                acc[s._id] = s.count;
                return acc;
            }, {}),
        },
    });
}));

/**
 * @route   GET /api/v1/plans/admin/revenue/by-plan
 * @desc    Revenue collected per plan for a date range, sorted highest first.
 * @access  Private/Admin
 */
router.get('/admin/revenue/by-plan', protect, authorize('superadmin', 'admin'), asyncHandler(async (req, res) => {
    const { start, end } = resolveDateRange(req);

    const byPlan = await UserSubscription.aggregate([
        { $unwind: '$paymentHistory' },
        { $match: { 'paymentHistory.paidAt': { $gte: start, $lte: end } } },
        {
            $group: {
                _id: '$plan',
                revenue: { $sum: '$paymentHistory.amount' },
                transactionCount: { $sum: 1 },
                subscriberCount: { $addToSet: '$user' },
            },
        },
        { $lookup: { from: 'subscriptionplans', localField: '_id', foreignField: '_id', as: 'planDoc' } },
        { $unwind: '$planDoc' },
        {
            $project: {
                _id: 0,
                planId: '$planDoc._id',
                planName: '$planDoc.name',
                planType: '$planDoc.planType',
                revenue: 1,
                transactionCount: 1,
                subscriberCount: { $size: '$subscriberCount' },
            },
        },
        { $sort: { revenue: -1 } },
    ]);

    res.status(200).json({
        success: true,
        period: { start, end },
        count: byPlan.length,
        data: byPlan,
    });
}));

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ERROR HANDLING (centralized for this router)
 * ─────────────────────────────────────────────────────────────────────────────
 */
router.use((err, req, res, next) => {
    logger.error('Plan Router Error', {
        path: req.path,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });

    if (err.name === 'CastError') {
        return res.status(400).json({ success: false, message: 'Invalid id format' });
    }
    if (err.name === 'ValidationError') {
        return res.status(400).json({ success: false, message: err.message });
    }
    if (err.code === 11000) {
        return res.status(409).json({ success: false, message: 'Duplicate value (slug already exists)' });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});

export default router;