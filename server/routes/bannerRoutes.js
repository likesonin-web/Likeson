/**
 * bannerRoutes.js — Likeson.in
 * Business logic lives in controllers/banner.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import * as ctrl from '../controllers/banner.controller.js';

const router = express.Router();

router.get('/active', cache(60, (req) => {
        const pos = req.query.position || 'Home_Top';
        const screen = req.query.screen || 'mobile';
        // FIX: screen in cache key — mobile/desktop get different cached responses
        return `GET:/api/banners/active?position=${pos}&screen=${screen}`;
    }), ctrl.getActive);
router.get('/', protect, authorize('admin', 'superadmin'), cache(60), ctrl.get);
router.post('/', protect, authorize('admin', 'superadmin'), ctrl.post);
router.patch('/:id/click', ctrl.patchByIdClick);
router.put('/:id', protect, authorize('admin', 'superadmin'), ctrl.putById);
router.delete('/:id', protect, authorize('admin', 'superadmin'), ctrl.deleteById);

export default router;
