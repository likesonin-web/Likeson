/**
 * super-admin/userManagementRoutes.js — Likeson.in
 * Business logic lives in controllers/super-admin/userManagement.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../../middleware/authMiddleware.js';
import * as ctrl from '../../controllers/super-admin/userManagement.controller.js';

const router = express.Router();

router.get('/meta-data', protect, ctrl.getMetaData);
router.post('/add-user', protect, authorize('admin', 'superadmin'), ctrl.postAddUser);
router.get('/employees', protect, authorize('admin', 'superadmin'), ctrl.getEmployees);

export default router;
