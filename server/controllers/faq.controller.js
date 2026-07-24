import mongoose from 'mongoose';
import { body, query, param, validationResult } from 'express-validator';
import FAQ from '../models/FAQ.js'; // Adjust path based on your structure
import { protect, authorize } from '../middleware/authMiddleware.js';


/**
 * @section HELPERS & MIDDLEWARES
 * Internal utilities to maintain clean code without external controller files.
 */

// Centralized Async Handler to eliminate try-catch boilerplate
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validation Formatter
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array().map(err => ({ field: err.param, message: err.msg })) 
    });
  }
  next();
};

/**
 * @section VALIDATION SCHEMES
 */
const faqValidation = [
  body('question').notEmpty().withMessage('Question is required').trim().escape(),
  body('answer').notEmpty().withMessage('Answer is required').trim(),
  body('category').isIn([
    'Medical Transportation', 'Care Assistant', 'Doctor Consultation', 
    'Diagnostics', 'Pharmacy Services', 'Subscription Plans', 'General'
  ]).withMessage('Invalid category'),
  validate
];

/**
 * @section ROUTES
 */

/**
 * @route   GET /api/faqs
 * @desc    Fetch all FAQs with advanced filtering, search, and pagination
 * @access  Public
 */

// GET '/'
export const get = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, category, search, isActive } = req.query;
    const skip = (page - 1) * limit;

    // Build optimized query object
    const queryObj = {};
    if (category) queryObj.category = category;
    
    // Admin/Staff can see inactive FAQs; Customers/Public only see active ones
    if (req.user && ['admin', 'superadmin'].includes(req.user.role)) {
        if (isActive !== undefined) queryObj.isActive = isActive === 'true';
    } else {
        queryObj.isActive = true;
    }

    // Full-text search simulation (use MongoDB Indexes for production)
    if (search) {
      queryObj.$or = [
        { question: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with lean() for high performance (read-only)
    const [faqs, total] = await Promise.all([
      FAQ.find(queryObj)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FAQ.countDocuments(queryObj)
    ]);

    res.status(200).json({
      success: true,
      count: faqs.length,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      },
      data: faqs
    });
  });

// POST '/'
export const post = asyncHandler(async (req, res) => {
    const { question, answer, category, isActive } = req.body;

    const faq = await FAQ.create({
      question,
      answer,
      category,
      isActive
    });

    // Audit Log Simulation
    console.log(`[AUDIT] FAQ Created: ID ${faq._id} by User ${req.user._id}`);

    res.status(201).json({
      success: true,
      data: faq
    });
  });

// PATCH '/:id/like'
export const patchByIdLike = asyncHandler(async (req, res) => {
    const faq = await FAQ.findById(req.params.id);

    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    const isLiked = faq.likes.includes(req.user._id);

    if (isLiked) {
      // Pull and decrement using atomic operations to prevent race conditions
      await FAQ.findByIdAndUpdate(req.params.id, {
        $pull: { likes: req.user._id },
        $inc: { likeCount: -1 }
      });
    } else {
      // Push and increment
      await FAQ.findByIdAndUpdate(req.params.id, {
        $addToSet: { likes: req.user._id },
        $inc: { likeCount: 1 }
      });
    }

    res.status(200).json({
      success: true,
      message: isLiked ? 'Unliked' : 'Liked'
    });
  });

// PUT '/:id'
export const putById = asyncHandler(async (req, res) => {
    let faq = await FAQ.findById(req.params.id);

    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    faq = await FAQ.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: faq
    });
  });

// DELETE '/:id'
export const deleteById = asyncHandler(async (req, res) => {
    const faq = await FAQ.findByIdAndDelete(req.params.id);

    if (!faq) {
      return res.status(404).json({ success: false, message: 'FAQ not found' });
    }

    console.log(`[AUDIT] FAQ Deleted: ID ${req.params.id} by User ${req.user._id}`);

    res.status(200).json({
      success: true,
      message: 'FAQ removed successfully'
    });
  });

// GET '/stats/by-category'
export const getStatsByCategory = asyncHandler(async (req, res) => {
    const stats = await FAQ.aggregate([
      {
        $group: {
          _id: '$category',
          totalFaqs: { $sum: 1 },
          avgLikes: { $avg: '$likeCount' },
          totalLikes: { $sum: '$likeCount' }
        }
      },
      { $sort: { totalFaqs: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: stats
    });
  });

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err);

  // Mongoose Duplicate Key Error
  if (err.code === 11000) {
    return res.status(400).json({ success: false, message: 'Duplicate value entered' });
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
