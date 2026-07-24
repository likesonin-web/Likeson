/**
 * consultationrouter.js — Likeson.in
 * Business logic lives in controllers/consultation.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import upload from '../middleware/upload.js';
import * as ctrl from '../controllers/consultation.controller.js';
import cronAuth from '../middleware/cronAuth.js';

const router = express.Router();
export const ADMIN_ROLES = ['admin', 'super_admin'];
export const DOCTOR_ROLES = ['doctor'];
export const PATIENT_ROLES = ['patient'];

router.post('/agora/webhook', express.raw({ type: 'application/json' }), ctrl.postAgoraWebhook);
router.use(protect)
router.post('/cron/auto-miss', cronAuth, ctrl.postCronAutoMiss);
router.post('/cron/token-refresh', cronAuth, ctrl.postCronTokenRefresh);
router.post('/cron/reminders', cronAuth, ctrl.postCronReminders);
router.post('/cron/expire-prescriptions', cronAuth, ctrl.postCronExpirePrescriptions);
router.post('/cron/auto-end', cronAuth, ctrl.postCronAutoEnd);
router.post('/cron/timer-reminder', cronAuth, ctrl.postCronTimerReminder);
router.get('/admin/all', authorize(...ADMIN_ROLES), ctrl.getAdminAll);
router.get('/admin/upcoming', authorize(...ADMIN_ROLES), ctrl.getAdminUpcoming);
router.get('/admin/active', authorize(...ADMIN_ROLES), ctrl.getAdminActive);
router.get('/admin/stats', authorize(...ADMIN_ROLES), ctrl.getAdminStats);
router.post('/admin/:id/assign', authorize(...ADMIN_ROLES), ctrl.postAdminByIdAssign);
router.patch('/admin/:id/override-status', authorize(...ADMIN_ROLES), ctrl.patchAdminByIdOverrideStatus);
router.get('/doctor/schedule', authorize(...DOCTOR_ROLES), ctrl.getDoctorSchedule2);
router.get('/doctor/history', authorize(...DOCTOR_ROLES), ctrl.getDoctorHistory);
router.get('/doctor/stats', authorize(...DOCTOR_ROLES), ctrl.getDoctorStats2);
router.get('/doctor/active', authorize(...DOCTOR_ROLES), ctrl.getDoctorActive);
router.get('/doctor/my', authorize(...DOCTOR_ROLES), ctrl.getDoctorMy);
router.get('/patient/history', authorize(...PATIENT_ROLES), ctrl.getPatientHistory);
router.get('/patient/upcoming', authorize(...PATIENT_ROLES), ctrl.getPatientUpcoming);
router.get('/patient/active', authorize(...PATIENT_ROLES), ctrl.getPatientActive);
router.get('/my', authorize(...PATIENT_ROLES), ctrl.getMy);
router.post('/create', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), ctrl.postCreate);
router.get('/booking/:bookingId', ctrl.getBookingByBookingId);
router.get('/:id', ctrl.getById);
router.patch('/:id', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), ctrl.patchById);
router.delete('/:id', authorize(...ADMIN_ROLES), ctrl.deleteById);
router.post('/:id/agora/provision', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), ctrl.postByIdAgoraProvision);
router.get('/:id/agora/tokens', ctrl.getByIdAgoraTokens);
router.post('/:id/agora/screen-token', ctrl.postByIdAgoraScreenToken);
router.post('/:id/agora/refresh', ctrl.postByIdAgoraRefresh);
router.post('/:id/agora/recording-consent', ctrl.postByIdAgoraRecordingConsent);
router.post('/:id/agora/recording/start', authorize(...ADMIN_ROLES), ctrl.postByIdAgoraRecordingStart);
router.post('/:id/agora/recording/stop', authorize(...ADMIN_ROLES), ctrl.postByIdAgoraRecordingStop);
router.get('/:id/agora/recording', ctrl.getByIdAgoraRecording);
router.post('/:id/waiting-room/enter', authorize(...PATIENT_ROLES), ctrl.postByIdWaitingRoomEnter);
router.post('/:id/waiting-room/leave', authorize(...PATIENT_ROLES), ctrl.postByIdWaitingRoomLeave);
router.post('/:id/waiting-room/status', ctrl.postByIdWaitingRoomStatus);
router.post('/:id/join', ctrl.postByIdJoin);
router.post('/:id/leave', ctrl.postByIdLeave);
router.post('/:id/start', authorize(...DOCTOR_ROLES, ...ADMIN_ROLES), ctrl.postByIdStart);
router.post('/:id/end', authorize(...DOCTOR_ROLES, ...ADMIN_ROLES), ctrl.postByIdEnd);
router.post('/:id/pause', ctrl.postByIdPause);
router.post('/:id/resume', ctrl.postByIdResume);
router.post('/:id/cancel', ctrl.postByIdCancel);
router.post('/:id/no-show', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), ctrl.postByIdNoShow);
router.post('/:id/technical-failure', ctrl.postByIdTechnicalFailure);
router.get('/:id/participants', ctrl.getByIdParticipants);
router.post('/:id/participants', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), ctrl.postByIdParticipants);
router.delete('/:id/participants/:userId', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), ctrl.deleteByIdParticipantsByUserId);
router.get('/:id/participants/events', ctrl.getByIdParticipantsEvents);
router.patch('/:id/participants/:userId/network-quality', ctrl.patchByIdParticipantsByUserIdNetworkQuality);
router.post('/:id/participants/:userId/mute', authorize(...DOCTOR_ROLES), ctrl.postByIdParticipantsByUserIdMute);
router.post('/:id/participants/:userId/unmute', authorize(...DOCTOR_ROLES), ctrl.postByIdParticipantsByUserIdUnmute);
router.post('/:id/participants/:userId/kick', authorize(...DOCTOR_ROLES), ctrl.postByIdParticipantsByUserIdKick);
router.get('/:id/timer', ctrl.getByIdTimer);
router.put('/:id/vitals', authorize(...DOCTOR_ROLES, ...ADMIN_ROLES, 'care_assistant'), ctrl.putByIdVitals);
router.put('/:id/notes', authorize(...DOCTOR_ROLES), ctrl.putByIdNotes);
router.get('/:id/notes', authorize(...DOCTOR_ROLES, ...ADMIN_ROLES), ctrl.getByIdNotes);
router.post('/:id/prescriptions', authorize(...DOCTOR_ROLES), ctrl.postByIdPrescriptions);
router.get('/:id/prescriptions', ctrl.getByIdPrescriptions);
router.post('/:id/referral', authorize(...DOCTOR_ROLES), ctrl.postByIdReferral);
router.get('/:id/referral', ctrl.getByIdReferral);
router.post('/:id/chat', upload.single('attachment'), ctrl.postByIdChat);
router.get('/:id/chat', ctrl.getByIdChat);
router.delete('/:id/chat/:messageId', ctrl.deleteByIdChatByMessageId);
router.post('/:id/documents', authorize(...DOCTOR_ROLES, ...PATIENT_ROLES), upload.array('documents', 5), ctrl.postByIdDocuments);
router.post('/:id/rating', authorize(...PATIENT_ROLES), ctrl.postByIdRating);
router.get('/:id/rating', ctrl.getByIdRating);
router.patch('/:id/rating', authorize(...PATIENT_ROLES), ctrl.patchByIdRating);
router.put('/:id/metrics', ctrl.putByIdMetrics);
router.get('/:id/metrics', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES), ctrl.getByIdMetrics);
router.post('/:id/follow-up', authorize(...ADMIN_ROLES, ...DOCTOR_ROLES, ...PATIENT_ROLES), ctrl.postByIdFollowUp);
router.get('/:id/follow-up/history', ctrl.getByIdFollowUpHistory);

export default router;
