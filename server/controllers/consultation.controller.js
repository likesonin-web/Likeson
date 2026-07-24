// routes/consultation.routes.js

import Consultation from '../models/Consultation.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import upload from '../middleware/upload.js';
import DoctorProfile from '../models/DoctorProfile.js';
import { emitToConsultation, emitToDoctor } from '../sockets/consultationSocket.js';
import {
  createConsultation,
  getConsultationById,
  listConsultations,
  updateConsultation,
  transitionStatus,
  enterWaitingRoom,
  leaveWaitingRoom,
  getWaitingRoomStatus,
  participantJoin,
  participantLeave,
  provisionTokens,
  getTokensForParticipant,
  forceRefreshTokens,
  addExtraParticipant,
  handleRecordingConsent,
  handleAgoraWebhook,
  startRecording,
  stopRecording,
  getRecordingUrls,
  getParticipants,
  removeExtraParticipant,
  getParticipantEvents,
  updateParticipantNetworkQuality,
  muteParticipant,
  unmuteParticipant,
  kickParticipant,
  getConsultationTimer,
  saveVitals,
  saveNotes,
  getNotes,
  issuePrescription,
  getPrescriptions,
  saveReferral,
  getReferral,
  sendChatMessage,
  getChatHistory,
  deleteChatMessage,
  submitRating,
  getRating,
  editRating,
  saveMetrics,
  getMetrics,
  createFollowUp,
  getFollowUpHistory,
  getDoctorSchedule,
  getDoctorStats,
  getActiveSessions,
  getPlatformStats,
  assignAdmin,
  overrideStatus,
  runAutoMiss,
  runAutoEnd,
  runTimerReminder,
  runTokenRefresh,
  runReminders,
  runExpirePrescriptions,
  getScreenShareToken,
} from '../services/consultationService.js';


// ── Shared role sets ──────────────────────────────────────────────────────────
const ADMIN_ROLES   = ['admin', 'superadmin'];
const DOCTOR_ROLES  = ['doctor'];
const PATIENT_ROLES = ['customer'];
const CRON_KEY      = process.env.CRON_SECRET || 'cron-secret-key';

// ── Cron auth middleware (header-based, not JWT) ──────────────────────────────
const cronAuth = (req, res, next) => {
  const key = req.headers['x-cron-key'];
  if (key !== CRON_KEY) return res.status(401).json({ message: 'Unauthorized cron key' });
  next();
};

// ── Response helpers ──────────────────────────────────────────────────────────
const ok   = (res, data, status = 200) => res.status(status).json({ success: true, ...data });
const fail = (res, message, status = 400) => res.status(status).json({ success: false, message });

// ═══════════════════════════════════════════════════════════════════════════════
// AGORA WEBHOOK (no auth — Agora sends raw POST)
// Must be FIRST before any protect middleware to get rawBody
// ═══════════════════════════════════════════════════════════════════════════════


// POST '/agora/webhook'
export const postAgoraWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['agora-signature'];
    const timestamp = req.headers['agora-timestamp'];
    const rawBody   = req.body;
    const result    = await handleAgoraWebhook(rawBody.toString(), signature, timestamp);
    ok(res, result);
  });

// POST '/cron/auto-miss'
export const postCronAutoMiss = asyncHandler(async (req, res) => {
  const result = await runAutoMiss();
  ok(res, result);
});

// POST '/cron/token-refresh'
export const postCronTokenRefresh = asyncHandler(async (req, res) => {
  const result = await runTokenRefresh();
  ok(res, result);
});

// POST '/cron/reminders'
export const postCronReminders = asyncHandler(async (req, res) => {
  const result = await runReminders();
  ok(res, result);
});

// POST '/cron/expire-prescriptions'
export const postCronExpirePrescriptions = asyncHandler(async (req, res) => {
  const result = await runExpirePrescriptions();
  ok(res, result);
});

// POST '/cron/auto-end'
export const postCronAutoEnd = asyncHandler(async (req, res) => {
  const result = await runAutoEnd();
  ok(res, result);
});

// POST '/cron/timer-reminder'
export const postCronTimerReminder = asyncHandler(async (req, res) => {
  const result = await runTimerReminder();
  ok(res, result);
});

// GET '/admin/all'
export const getAdminAll = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, type, doctorId, patientId, from, to } = req.query;
  const filter = {};
  if (status)   filter.status = status;
  if (type)     filter.consultationType = type;
  if (doctorId) filter.doctor = doctorId;
  if (patientId)filter.patient = patientId;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to)   filter.scheduledAt.$lte = new Date(to);
  }
  const result = await listConsultations({
    filter, page: +page, limit: +limit,
    cacheKeyPrefix: 'consultations:admin',
  });
  ok(res, result);
});

// GET '/admin/upcoming'
export const getAdminUpcoming = asyncHandler(async (req, res) => {
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const result = await listConsultations({
    filter: { status: 'scheduled', scheduledAt: { $lte: in24h, $gte: new Date() } },
    sort: { scheduledAt: 1 },
    limit: 100,
  });
  ok(res, result);
});

// GET '/admin/active'
export const getAdminActive = asyncHandler(async (req, res) => {
  const sessions = await getActiveSessions();
  ok(res, { sessions });
});

// GET '/admin/stats'
export const getAdminStats = asyncHandler(async (req, res) => {
  const stats = await getPlatformStats();
  ok(res, { stats });
});

// POST '/admin/:id/assign'
export const postAdminByIdAssign = asyncHandler(async (req, res) => {
  const { adminId } = req.body;
  if (!adminId) return fail(res, 'adminId required');
  const c = await assignAdmin(req.params.id, adminId, req.user._id.toString());
  ok(res, { consultation: c });
});

// PATCH '/admin/:id/override-status'
export const patchAdminByIdOverrideStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  if (!status) return fail(res, 'status required');
  const c = await overrideStatus(req.params.id, status, reason, req.user._id.toString());
  ok(res, { consultation: c });
});

// GET '/doctor/schedule'
export const getDoctorSchedule2 = asyncHandler(async (req, res) => {
  const schedule = await getDoctorSchedule(req.user._id.toString());
  ok(res, { schedule });
});

// GET '/doctor/history'
export const getDoctorHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await listConsultations({
    filter: {
      doctorUser: req.user._id,
      status: { $in: ['completed', 'cancelled', 'missed', 'no_show_patient', 'no_show_doctor'] },
    },
    page: +page, limit: +limit,
    sort: { scheduledAt: -1 },
    cacheKeyPrefix: `consultations:doctor:${req.user._id}:history`,
  });
  ok(res, result);
});

// GET '/doctor/stats'
export const getDoctorStats2 = asyncHandler(async (req, res) => {
  const dp = await DoctorProfile.findOne({ user: req.user._id }).select('_id').lean();
  if (!dp) return fail(res, 'DoctorProfile not found', 404);
  const stats = await getDoctorStats(dp._id.toString());
  ok(res, { stats });
});

// GET '/doctor/active'
export const getDoctorActive = asyncHandler(async (req, res) => {
  const sessions = await getActiveSessions({ doctorUser: req.user._id });
  ok(res, { sessions });
});

// GET '/doctor/my'
export const getDoctorMy = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = { doctorUser: req.user._id };
  if (status) filter.status = status;
  const result = await listConsultations({
    filter, page: +page, limit: +limit,
    cacheKeyPrefix: `consultations:doctor:${req.user._id}`,
  });
  ok(res, result);
});

// GET '/patient/history'
export const getPatientHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await listConsultations({
    filter: {
      patient: req.user._id,
      status: { $in: ['completed', 'cancelled', 'missed', 'no_show_patient', 'no_show_doctor'] },
    },
    page: +page, limit: +limit,
    sort: { scheduledAt: -1 },
    cacheKeyPrefix: `consultations:patient:${req.user._id}:history`,
  });
  ok(res, result);
});

// GET '/patient/upcoming'
export const getPatientUpcoming = asyncHandler(async (req, res) => {
  const result = await listConsultations({
    filter: {
      patient: req.user._id,
      status: { $in: ['scheduled', 'waiting', 'doctor_joined', 'patient_joined'] },
      scheduledAt: { $gte: new Date() },
    },
    sort: { scheduledAt: 1 },
    limit: 20,
    cacheKeyPrefix: `consultations:patient:${req.user._id}:upcoming`,
  });
  ok(res, result);
});

// GET '/patient/active'
export const getPatientActive = asyncHandler(async (req, res) => {
  const sessions = await getActiveSessions({ patient: req.user._id });
  ok(res, { sessions });
});

// GET '/my'
export const getMy = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;
  const filter = { patient: req.user._id };
  if (status) filter.status = status;
  const result = await listConsultations({
    filter, page: +page, limit: +limit,
    cacheKeyPrefix: `consultations:patient:${req.user._id}`,
  });
  ok(res, result);
});

// POST '/create'
export const postCreate = asyncHandler(async (req, res) => {
  const { consultation, agoraTokens } = await createConsultation(req.body, req.user._id.toString());
  ok(res, { consultation, agoraTokens }, 201);
});

// GET '/booking/:bookingId'
export const getBookingByBookingId = asyncHandler(async (req, res) => {
  const c = await Consultation.findOne({ booking: req.params.bookingId })
    .populate('doctor', 'user specialization profilePhotoUrl')
    .populate('patient', 'name phone avatar')
    .populate('prescriptions', 'rxNumber status')
    .lean({ virtuals: true });
  if (!c) return fail(res, 'Consultation not found for this booking', 404);
  ok(res, { consultation: c });
});

// GET '/:id'
export const getById = asyncHandler(async (req, res) => {
  const c = await getConsultationById(req.params.id);
  ok(res, { consultation: c });
});

// PATCH '/:id'
export const patchById = asyncHandler(async (req, res) => {
  const c = await updateConsultation(req.params.id, req.body, req.user._id.toString());
  ok(res, { consultation: c });
});

// DELETE '/:id'
export const deleteById = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const c = await transitionStatus(req.params.id, 'cancelled', {
    actor: req.user._id.toString(),
    reason: reason || 'Deleted by admin',
    metadata: { cancelledBy: 'admin' },
  });
  ok(res, { cancelled: true, consultation: c });
});

// POST '/:id/agora/provision'
export const postByIdAgoraProvision = asyncHandler(async (req, res) => {
  const tokens = await provisionTokens(req.params.id, req.user._id.toString());
  ok(res, tokens);
});

// GET '/:id/agora/tokens'
export const getByIdAgoraTokens = asyncHandler(async (req, res) => {
  const tokens = await getTokensForParticipant(
    req.params.id,
    req.user._id.toString(),
    req.user.role,
  );
  ok(res, { tokens });
});

// POST '/:id/agora/screen-token'
export const postByIdAgoraScreenToken = asyncHandler(async (req, res) => {
  const { uid } = req.body;
  if (!uid) return fail(res, 'Screen UID is required', 400);
  const role      = req.user.role === 'doctor' ? 'doctor' : 'patient';
  const tokenData = await getScreenShareToken(
    req.params.id,
    uid,
    req.user._id.toString(),
    role,
  );
  ok(res, tokenData);
});

// POST '/:id/agora/refresh'
export const postByIdAgoraRefresh = asyncHandler(async (req, res) => {
  const result = await forceRefreshTokens(req.params.id, req.user._id.toString());
  ok(res, result);
});

// POST '/:id/agora/recording-consent'
export const postByIdAgoraRecordingConsent = asyncHandler(async (req, res) => {
  const { consented } = req.body;
  const who    = req.user.role === 'doctor' ? 'doctor' : 'patient';
  const result = await handleRecordingConsent(
    req.params.id, who, consented, req.user._id.toString(),
  );
  ok(res, result);
});

// POST '/:id/agora/recording/start'
export const postByIdAgoraRecordingStart = asyncHandler(async (req, res) => {
  const result = await startRecording(req.params.id, req.user._id.toString());
  ok(res, result);
});

// POST '/:id/agora/recording/stop'
export const postByIdAgoraRecordingStop = asyncHandler(async (req, res) => {
  const result = await stopRecording(req.params.id, req.user._id.toString());
  ok(res, result);
});

// GET '/:id/agora/recording'
export const getByIdAgoraRecording = asyncHandler(async (req, res) => {
  const result = await getRecordingUrls(req.params.id);
  ok(res, result);
});

// POST '/:id/waiting-room/enter'
export const postByIdWaitingRoomEnter = asyncHandler(async (req, res) => {
  const c = await enterWaitingRoom(req.params.id, req.user._id.toString());
  emitToDoctor(c.doctorUser?.toString(), 'consultation:patient-waiting', {
    consultationId: req.params.id,
    patientId:      req.user._id,
    patientName:    req.user.name,
  });
  ok(res, { status: c.status, waitingRoom: c.waitingRoom });
});

// POST '/:id/waiting-room/leave'
export const postByIdWaitingRoomLeave = asyncHandler(async (req, res) => {
  const c = await leaveWaitingRoom(req.params.id, req.user._id.toString());
  ok(res, { waitingRoom: c.waitingRoom });
});

// POST '/:id/waiting-room/status'
export const postByIdWaitingRoomStatus = asyncHandler(async (req, res) => {
  const status = await getWaitingRoomStatus(req.params.id);
  ok(res, status);
});

// POST '/:id/join'
export const postByIdJoin = asyncHandler(async (req, res) => {
  const { deviceInfo } = req.body;
  const role           = ['doctor', 'admin'].includes(req.user.role) ? 'doctor' : 'patient';
  const { consultation, tokens } = await participantJoin(
    req.params.id,
    req.user._id.toString(),
    role,
    deviceInfo || {},
  );
  emitToConsultation(req.params.id, 'consultation:participant-joined', {
    userId: req.user._id,
    role,
    status: consultation.status,
  });
  ok(res, { status: consultation.status, tokens });
});

// POST '/:id/leave'
export const postByIdLeave = asyncHandler(async (req, res) => {
  const role = req.user.role === 'doctor' ? 'doctor' : 'patient';
  const c    = await participantLeave(
    req.params.id,
    req.user._id.toString(),
    role,
    req.body?.metrics || {},
  );
  ok(res, { status: c.status });
});

// POST '/:id/start'
export const postByIdStart = asyncHandler(async (req, res) => {
  const c = await transitionStatus(req.params.id, 'in_progress', {
    actor: req.user._id.toString(),
  });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status });
  ok(res, { status: c.status });
});

// POST '/:id/end'
export const postByIdEnd = asyncHandler(async (req, res) => {
  const c = await transitionStatus(req.params.id, 'completed', {
    actor: req.user._id.toString(),
  });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status });
  ok(res, { status: c.status, actualDurationSec: c.actualDurationSec });
});

// POST '/:id/pause'
export const postByIdPause = asyncHandler(async (req, res) => {
  const c = await transitionStatus(req.params.id, 'paused', {
    actor: req.user._id.toString(),
  });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status });
  ok(res, { status: c.status });
});

// POST '/:id/resume'
export const postByIdResume = asyncHandler(async (req, res) => {
  const c = await transitionStatus(req.params.id, 'in_progress', {
    actor: req.user._id.toString(),
  });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status });
  ok(res, { status: c.status });
});

// POST '/:id/cancel'
export const postByIdCancel = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const cancelledBy = req.user.role === 'customer' ? 'patient' : req.user.role;
  const c = await transitionStatus(req.params.id, 'cancelled', {
    actor:    req.user._id.toString(),
    reason,
    metadata: { cancelledBy, refundable: req.body.refundable ?? false },
  });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status, reason });
  ok(res, { status: c.status });
});

// POST '/:id/no-show'
export const postByIdNoShow = asyncHandler(async (req, res) => {
  const { who = 'patient' } = req.body;
  const toStatus = who === 'doctor' ? 'no_show_doctor' : 'no_show_patient';
  const c = await transitionStatus(req.params.id, toStatus, {
    actor:  req.user._id.toString(),
    reason: req.body.reason,
  });
  ok(res, { status: c.status });
});

// POST '/:id/technical-failure'
export const postByIdTechnicalFailure = asyncHandler(async (req, res) => {
  const { errorDetails } = req.body;
  const c = await transitionStatus(req.params.id, 'technical_failure', {
    actor:  req.user._id.toString(),
    reason: errorDetails || 'Technical failure reported',
  });
  emitToConsultation(req.params.id, 'consultation:status', { status: c.status, errorDetails });
  ok(res, { status: c.status });
});

// GET '/:id/participants'
export const getByIdParticipants = asyncHandler(async (req, res) => {
  const participants = await getParticipants(req.params.id);
  ok(res, participants);
});

// POST '/:id/participants'
export const postByIdParticipants = asyncHandler(async (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role) return fail(res, 'userId and role required');
  const tokens = await addExtraParticipant(
    req.params.id, userId, role, req.user._id.toString(),
  );
  emitToConsultation(req.params.id, 'consultation:participant-added', { userId, role });
  ok(res, { tokens }, 201);
});

// DELETE '/:id/participants/:userId'
export const deleteByIdParticipantsByUserId = asyncHandler(async (req, res) => {
  const result = await removeExtraParticipant(
    req.params.id, req.params.userId, req.user._id.toString(),
  );
  emitToConsultation(req.params.id, 'consultation:participant-removed', {
    userId: req.params.userId,
  });
  ok(res, result);
});

// GET '/:id/participants/events'
export const getByIdParticipantsEvents = asyncHandler(async (req, res) => {
  const events = await getParticipantEvents(req.params.id);
  ok(res, { events });
});

// PATCH '/:id/participants/:userId/network-quality'
export const patchByIdParticipantsByUserIdNetworkQuality = asyncHandler(async (req, res) => {
  const { quality } = req.body;
  if (quality === undefined) return fail(res, 'quality required');
  const result = await updateParticipantNetworkQuality(
    req.params.id, req.params.userId, quality,
  );
  ok(res, result);
});

// POST '/:id/participants/:userId/mute'
export const postByIdParticipantsByUserIdMute = asyncHandler(async (req, res) => {
    const result = await muteParticipant(
      req.params.id,
      req.params.userId,
      req.user._id.toString(),
    );
    emitToConsultation(req.params.id, 'consultation:muted', {
      targetUserId: result.mutedUserId,
      mutedBy:      { userId: req.user._id, name: req.user.name, role: 'doctor' },
      isMuted:      true,
      at:           new Date(),
    });
    ok(res, result);
  });

// POST '/:id/participants/:userId/unmute'
export const postByIdParticipantsByUserIdUnmute = asyncHandler(async (req, res) => {
    const result = await unmuteParticipant(
      req.params.id,
      req.params.userId,
      req.user._id.toString(),
    );
    emitToConsultation(req.params.id, 'consultation:muted', {
      targetUserId: result.mutedUserId,
      mutedBy:      { userId: req.user._id, name: req.user.name, role: 'doctor' },
      isMuted:      false,
      at:           new Date(),
    });
    ok(res, result);
  });

// POST '/:id/participants/:userId/kick'
export const postByIdParticipantsByUserIdKick = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const result = await kickParticipant(
      req.params.id,
      req.params.userId,
      req.user._id.toString(),
      reason || '',
    );
    emitToConsultation(req.params.id, 'consultation:kicked', {
      targetUserId: result.kickedUserId,
      kickedBy:     { userId: req.user._id, name: req.user.name, role: 'doctor' },
      reason:       result.reason,
      at:           new Date(),
    });
    ok(res, result);
  });

// GET '/:id/timer'
export const getByIdTimer = asyncHandler(async (req, res) => {
    const timer = await getConsultationTimer(req.params.id);
    ok(res, { timer });
  });

// PUT '/:id/vitals'
export const putByIdVitals = asyncHandler(async (req, res) => {
    const vitals = await saveVitals(req.params.id, req.body, req.user._id.toString());
    emitToConsultation(req.params.id, 'consultation:vitals:update', { vitals });
    ok(res, { vitals });
  });

// PUT '/:id/notes'
export const putByIdNotes = asyncHandler(async (req, res) => {
  const notes = await saveNotes(req.params.id, req.body, req.user._id.toString());
  ok(res, { notes });
});

// GET '/:id/notes'
export const getByIdNotes = asyncHandler(async (req, res) => {
  const notes = await getNotes(req.params.id);
  ok(res, { notes });
});

// POST '/:id/prescriptions'
export const postByIdPrescriptions = asyncHandler(async (req, res) => {
  const rx = await issuePrescription(req.params.id, req.body, req.user._id.toString());
  emitToConsultation(req.params.id, 'consultation:prescription:ready', {
    rxNumber: rx.rxNumber,
    rxId:     rx._id,
  });
  ok(res, { prescription: rx }, 201);
});

// GET '/:id/prescriptions'
export const getByIdPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await getPrescriptions(req.params.id);
  ok(res, { prescriptions });
});

// POST '/:id/referral'
export const postByIdReferral = asyncHandler(async (req, res) => {
  const referral = await saveReferral(req.params.id, req.body, req.user._id.toString());
  ok(res, { referral }, 201);
});

// GET '/:id/referral'
export const getByIdReferral = asyncHandler(async (req, res) => {
  const referral = await getReferral(req.params.id);
  ok(res, { referral });
});

// POST '/:id/chat'
export const postByIdChat = asyncHandler(async (req, res) => {
    const role = req.user.role === 'doctor' ? 'doctor' : 'patient';

    let messageType    = req.body.messageType || 'text';
    let attachmentUrl  = null;
    let attachmentName = null;

    if (req.file) {
      attachmentUrl  = req.file.path || req.file.location;
      attachmentName = req.file.originalname;
      messageType    = req.file.mimetype.startsWith('image/') ? 'image' : 'file';
    }

    const msg = await sendChatMessage(
      req.params.id,
      req.user._id.toString(),
      role,
      { content: req.body.content, messageType, attachmentUrl, attachmentName },
    );
    emitToConsultation(req.params.id, 'consultation:chat:message', msg);
    ok(res, { message: msg }, 201);
  });

// GET '/:id/chat'
export const getByIdChat = asyncHandler(async (req, res) => {
  const messages = await getChatHistory(req.params.id);
  ok(res, { messages });
});

// DELETE '/:id/chat/:messageId'
export const deleteByIdChatByMessageId = asyncHandler(async (req, res) => {
  const result = await deleteChatMessage(
    req.params.id, req.params.messageId, req.user._id.toString(),
  );
  ok(res, result);
});

// POST '/:id/documents'
export const postByIdDocuments = asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) {
      return fail(res, 'No files uploaded', 400);
    }
    const uploadedDocs = req.files.map((file) => ({
      url:          file.path || file.location,
      originalName: file.originalname,
      docType:      req.body.docType || 'other',
    }));
    await Consultation.findByIdAndUpdate(req.params.id, {
      $push: { 'clinicalNotes.attachments': { $each: uploadedDocs } },
    });
    ok(res, { documents: uploadedDocs });
  });

// POST '/:id/rating'
export const postByIdRating = asyncHandler(async (req, res) => {
  const rating = await submitRating(req.params.id, req.user._id.toString(), req.body);
  ok(res, { rating }, 201);
});

// GET '/:id/rating'
export const getByIdRating = asyncHandler(async (req, res) => {
  const result = await getRating(req.params.id);
  ok(res, result);
});

// PATCH '/:id/rating'
export const patchByIdRating = asyncHandler(async (req, res) => {
  const rating = await editRating(req.params.id, req.user._id.toString(), req.body);
  ok(res, { rating });
});

// PUT '/:id/metrics'
export const putByIdMetrics = asyncHandler(async (req, res) => {
  const metrics = await saveMetrics(req.params.id, req.body, req.user._id.toString());
  ok(res, { metrics });
});

// GET '/:id/metrics'
export const getByIdMetrics = asyncHandler(async (req, res) => {
  const metrics = await getMetrics(req.params.id);
  ok(res, { metrics });
});

// POST '/:id/follow-up'
export const postByIdFollowUp = asyncHandler(async (req, res) => {
    const { consultation, agoraTokens } = await createFollowUp(
      req.params.id, req.body, req.user._id.toString(),
    );
    ok(res, { consultation, agoraTokens }, 201);
  });

// GET '/:id/follow-up/history'
export const getByIdFollowUpHistory = asyncHandler(async (req, res) => {
  const history = await getFollowUpHistory(req.params.id);
  ok(res, history);
});
