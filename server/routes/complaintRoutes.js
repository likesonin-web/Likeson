// routes/complaintRoutes.js
import express from 'express';
import { protect, getDeviceInfo, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import ComplaintService from '../services/ComplaintService.js';
import AssignmentService from '../services/AssignmentService.js';
import {
  validateCreateComplaint,
  validateUpdateComplaintStatus,
  validateAssignComplaint,
  validateComplaintDashboardQuery,
  validateConversationIdParam,
} from '../validations/complaintValidation.js';

const router = express.Router();
router.use(protect, getDeviceInfo);

// POST /complaints — any authenticated user can raise a complaint
router.post(
  '/',
  validateCreateComplaint,
  asyncHandler(async (req, res) => {
    const conversation = await ComplaintService.create(req.user, req.body);
    return sendSuccess(res, { statusCode: 201, message: 'Complaint created.', data: conversation });
  })
);

// GET /complaints/dashboard — admin/finance only (enforced again in service)
router.get(
  '/dashboard',
  authorize('admin', 'superadmin', 'finance'),
  validateComplaintDashboardQuery,
  asyncHandler(async (req, res) => {
    const result = await ComplaintService.listForDashboard(req.user, req.query);
    return sendSuccess(res, { message: 'Complaints fetched.', data: result.items, pagination: result.pagination });
  })
);

// GET /complaints/metrics — response/resolution time analytics
router.get(
  '/metrics',
  authorize('admin', 'superadmin', 'finance'),
  asyncHandler(async (req, res) => {
    const metrics = await ComplaintService.getResponseMetrics(req.query);
    return sendSuccess(res, { message: 'Metrics fetched.', data: metrics });
  })
);

// PATCH /complaints/:conversationId/status
router.patch(
  '/:conversationId/status',
  authorize('admin', 'superadmin', 'finance'),
  validateUpdateComplaintStatus,
  asyncHandler(async (req, res) => {
    const conversation = await ComplaintService.updateStatus(req.user, req.params.conversationId, req.body.status, req.body.note);
    return sendSuccess(res, { message: 'Complaint status updated.', data: conversation });
  })
);

// PATCH /complaints/:conversationId/assign
router.patch(
  '/:conversationId/assign',
  authorize('admin', 'superadmin', 'finance'),
  validateAssignComplaint,
  asyncHandler(async (req, res) => {
    const conversation = await AssignmentService.assign(req.user, req.params.conversationId, req.body.assigneeId);
    return sendSuccess(res, { message: 'Complaint assigned.', data: conversation });
  })
);

// GET /complaints/:conversationId/timeline
router.get(
  '/:conversationId/timeline',
  validateConversationIdParam,
  asyncHandler(async (req, res) => {
    const timeline = await ComplaintService.getTimeline(req.params.conversationId, req.user._id);
    return sendSuccess(res, { message: 'Timeline fetched.', data: timeline });
  })
);

export default router;
