// routes/groupRoutes.js
//
// Authorization note: GroupService internally re-asserts admin/superadmin
// via PermissionService.assertCanManageGroup on every call — the
// `authorize('admin','superadmin')` here is a fast-fail at the edge, not a
// substitute for that server-side check (defense in depth).

import express from 'express';
import { protect, getDeviceInfo, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import GroupService from '../services/GroupService.js';
import {
  validateCreateGroup,
  validateGroupIdParam,
  validateRenameGroup,
  validateMemberIds,
  validateTargetUser,
  validateLockGroup,
  validateMuteMember,
} from '../validations/groupValidation.js';

const router = express.Router();
router.use(protect, getDeviceInfo);

// POST /groups — create (admin/superadmin only)
router.post(
  '/',
  authorize('admin', 'superadmin'),
  validateCreateGroup,
  asyncHandler(async (req, res) => {
    const conversation = await GroupService.createGroup(req.user, req.body);
    return sendSuccess(res, { statusCode: 201, message: 'Group created.', data: conversation });
  })
);

// PATCH /groups/:conversationId/rename
router.patch(
  '/:conversationId/rename',
  authorize('admin', 'superadmin'),
  validateRenameGroup,
  asyncHandler(async (req, res) => {
    const conversation = await GroupService.renameGroup(req.user, req.params.conversationId, req.body.title);
    return sendSuccess(res, { message: 'Group renamed.', data: conversation });
  })
);

// PATCH /groups/:conversationId/archive
router.patch(
  '/:conversationId/archive',
  authorize('admin', 'superadmin'),
  validateGroupIdParam,
  asyncHandler(async (req, res) => {
    const conversation = await GroupService.archiveGroup(req.user, req.params.conversationId, req.body.archived !== false);
    return sendSuccess(res, { message: 'Group archive state updated.', data: conversation });
  })
);

// PATCH /groups/:conversationId/lock
router.patch(
  '/:conversationId/lock',
  authorize('admin', 'superadmin'),
  validateLockGroup,
  asyncHandler(async (req, res) => {
    const conversation = await GroupService.lockGroup(req.user, req.params.conversationId, req.body.locked);
    return sendSuccess(res, { message: 'Group lock state updated.', data: conversation });
  })
);

// DELETE /groups/:conversationId
router.delete(
  '/:conversationId',
  authorize('admin', 'superadmin'),
  validateGroupIdParam,
  asyncHandler(async (req, res) => {
    const conversation = await GroupService.deleteGroup(req.user, req.params.conversationId);
    return sendSuccess(res, { message: 'Group deleted.', data: conversation });
  })
);

// POST /groups/:conversationId/members
router.post(
  '/:conversationId/members',
  authorize('admin', 'superadmin'),
  validateMemberIds,
  asyncHandler(async (req, res) => {
    const conversation = await GroupService.addMembers(req.user, req.params.conversationId, req.body.memberIds);
    return sendSuccess(res, { statusCode: 201, message: 'Members added.', data: conversation });
  })
);

// DELETE /groups/:conversationId/members/:userId
router.delete(
  '/:conversationId/members/:userId',
  authorize('admin', 'superadmin'),
  validateTargetUser,
  asyncHandler(async (req, res) => {
    const member = await GroupService.removeMember(req.user, req.params.conversationId, req.params.userId);
    return sendSuccess(res, { message: 'Member removed.', data: member });
  })
);

// PATCH /groups/:conversationId/members/:userId/moderator
router.patch(
  '/:conversationId/members/:userId/moderator',
  authorize('admin', 'superadmin'),
  validateTargetUser,
  asyncHandler(async (req, res) => {
    const member = await GroupService.assignModerator(req.user, req.params.conversationId, req.params.userId);
    return sendSuccess(res, { message: 'Moderator assigned.', data: member });
  })
);

// PATCH /groups/:conversationId/members/:userId/mute
router.patch(
  '/:conversationId/members/:userId/mute',
  authorize('admin', 'superadmin'),
  validateMuteMember,
  asyncHandler(async (req, res) => {
    const member = await GroupService.muteMember(req.user, req.params.conversationId, req.params.userId, {
      muted: req.body.muted,
      mutedUntil: req.body.mutedUntil || null,
    });
    return sendSuccess(res, { message: 'Member mute state updated.', data: member });
  })
);

export default router;
