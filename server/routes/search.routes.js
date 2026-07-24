/**
 * search.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Mount at: app.use('/api/search', searchRouter)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';

import {
  unifiedSearch,
  autocomplete,
  getTrendingSearches,
  getMostSearched,
  getPopularCategories,
  getSearchHistory,
  clearSearchHistory,
  recordSearchClick,
  getZeroResultQueries,
} from '../controllers/search.controller.js';

// Updated imports to match your authMiddleware.js exports
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = Router();

// ── Custom Middleware ─────────────────────────────────────────────────────────

/**
 * optionalAuth
 * Attempts to extract and verify the JWT. If valid, attaches a lightweight
 * user object to req.user. If missing or invalid, it simply proceeds anonymously.
 */
const optionalAuth = (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.jwt) {
      token = req.cookies.jwt;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Attaching just the ID so the search controller can log search history.
      // (Avoids a heavy database lookup for public/anonymous routes).
      req.user = { _id: decoded.id };
    }
  } catch (err) {
    // Silently ignore token errors (expired, invalid) for optional routes
  }
  next();
};


// ── Rate limits ───────────────────────────────────────────────────────────────

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // 60 full searches / min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many search requests, slow down.' },
});

const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180, // autocomplete tolerates more traffic
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many suggestion requests, slow down.' },
});

// ── Public search ─────────────────────────────────────────────────────────────

router.get('/', searchLimiter, optionalAuth, unifiedSearch);
router.get('/suggestions', suggestLimiter, optionalAuth, autocomplete);

// ── Discovery widgets ─────────────────────────────────────────────────────────

router.get('/trending', getTrendingSearches);
router.get('/most-searched', getMostSearched);
router.get('/popular-categories', getPopularCategories);

// ── Personal history (auth required) ─────────────────────────────────────────

// Replaced `authenticate` with `protect`
router.get('/history', protect, getSearchHistory);
router.delete('/history', protect, clearSearchHistory);

// ── Analytics ─────────────────────────────────────────────────────────────────

router.post('/click', optionalAuth, recordSearchClick);

// Replaced `authenticate` with `protect` and `requireAdmin` with `authorize('admin')`
router.get('/zero-results', protect, authorize('admin'), getZeroResultQueries);

export default router;