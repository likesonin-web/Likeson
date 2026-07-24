/**
 * heroPageRouter.js — Likeson.in
 * Business logic lives in controllers/heroPage.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import multer from 'multer'; // <-- Added multer for file uploads
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache          from '../middleware/cache.js';
import * as ctrl from '../controllers/heroPage.controller.js';

const router = express.Router();

// 1. Define Multer upload middleware (Adjust 'uploads/' to your actual storage config)
const upload = multer({ dest: 'uploads/' });

// 2. Define the missing ADMIN_ROLES array
const ADMIN_ROLES = ['admin', 'superadmin'];

// 3. Define a fallback logger to prevent ReferenceError (or import your own logger)
const log = {
  info: (msg, data) => console.info(`[INFO] ${msg}`, data)
};

router.use((req, _res, next) => {
  log.info('Hero route hit', {
    method: req.method,
    path:   req.originalUrl,
    ip:     req.ip,
    userId: req.user?._id ?? 'unauthenticated',
  });
  next();
})

router.get('/active', cache(300), ctrl.getActive);
router.get('/', protect, authorize(...ADMIN_ROLES), cache(60), ctrl.get);
router.get('/:id', protect, authorize(...ADMIN_ROLES), cache(60, (req) => `hero:${req.params.id}`), ctrl.getById);

// Now upload is defined and won't crash
router.post('/', protect, authorize(...ADMIN_ROLES), upload.single('mediaFile'), ctrl.post);
router.put('/:id', protect, authorize(...ADMIN_ROLES), upload.single('mediaFile'), ctrl.putById);

router.patch('/:id/toggle', protect, authorize(...ADMIN_ROLES), ctrl.patchByIdToggle);
router.patch('/:id/priority', protect, authorize(...ADMIN_ROLES), ctrl.patchByIdPriority);

router.post('/:id/media', protect, authorize(...ADMIN_ROLES), upload.single('mediaFile'), ctrl.postByIdMedia);
router.delete('/:id', protect, authorize('superadmin'), ctrl.deleteById);
router.get('/imagekit/auth', protect, authorize(...ADMIN_ROLES), ctrl.getImagekitAuth);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;