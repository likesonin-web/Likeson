/**
 * uploadRoutes.js — Likeson.in
 * Business logic lives in controllers/upload.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import * as ctrl from '../controllers/upload.controller.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.post('/single', upload.single('file'), ctrl.postSingle);
router.post('/multiple', upload.array('files', 10), ctrl.postMultiple);

export default router;
