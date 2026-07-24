/**
 * marqueeRoutes.js — Likeson.in
 * Business logic lives in controllers/marquee.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import * as ctrl from '../controllers/marquee.controller.js';

const router = express.Router();

// Define optionalAuth middleware (Resolves the ReferenceError)
// If a user has a token, it should ideally set req.user here. 
// This basic version just lets the request through if you handle token parsing elsewhere.
const optionalAuth = (req, res, next) => {
  // Pass to next middleware. If you have a specific optionalAuth in your 
  // authMiddleware.js, you can import it instead of defining it here.
  next();
};

router.get('/', optionalAuth, cache(60, (req) => req.user ? `user:${req.user._id}:marquees` : 'public:marquees'), ctrl.get);
router.post('/:id/dismiss', optionalAuth, ctrl.postByIdDismiss);
router.post('/:id/click', optionalAuth, ctrl.postByIdClick);

router.get('/admin/analytics/summary', protect, authorize('superadmin', 'admin'), cache(60), ctrl.getAdminAnalyticsSummary);
router.get('/admin', protect, authorize('superadmin', 'admin'), cache(60), ctrl.getAdmin);
router.get('/admin/:id', protect, authorize('superadmin', 'admin'), cache(60, (req) => `marquee:${req.params.id}`), ctrl.getAdminById);
router.post('/admin', protect, authorize('superadmin', 'admin'), ctrl.postAdmin);
router.patch('/admin/:id', protect, authorize('superadmin', 'admin'), ctrl.patchAdminById);
router.patch('/admin/:id/status', protect, authorize('superadmin', 'admin'), ctrl.patchAdminByIdStatus);
router.delete('/admin/:id', protect, authorize('superadmin'), ctrl.deleteAdminById);
router.delete('/admin/:id/analytics', protect, authorize('superadmin', 'admin'), ctrl.deleteAdminByIdAnalytics);

// Added your standard error handler to prevent further crashes
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;