// services/consultation.service.js
// ALL business logic for consultations.
// No req/res — pure async functions called by router + socket.

import mongoose from 'mongoose';
import Consultation from '../models/Consultation.js';
import Booking from '../models/Booking.js';
import EPrescription from '../models/EPrescription.js';
import OutPatientRecord from '../models/OutPatientRecord.js';
import DoctorProfile from '../models/DoctorProfile.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import sendEmail from '../utils/sendEmail.js';
import { transactionalTemplate } from '../utils/emailTemplates.js';
import {
  provisionConsultationTokens,
  getParticipantTokens,
  refreshConsultationTokens,
  addExtraParticipantToken,
  updateRecordingConsent,
  verifyAgoraWebhook,
} from './agoraToken.js';
import { generateAgoraToken } from '../utils/generateAgoraToken.js';
import { invalidatePattern, invalidateKey } from '../utils/cacheInvalidation.js';
import redisClient from '../config/redis.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const VALID_STATUS_TRANSITIONS = {
  scheduled:        ['waiting', 'doctor_joined', 'patient_joined', 'cancelled', 'missed'],
  waiting:          ['doctor_joined', 'in_progress', 'cancelled', 'no_show_patient'],
  doctor_joined:    ['in_progress', 'patient_joined', 'missed', 'no_show_patient', 'cancelled'],
  patient_joined:   ['in_progress', 'doctor_joined', 'missed', 'no_show_doctor', 'cancelled'],
  in_progress:      ['paused', 'completed', 'technical_failure'],
  paused:           ['in_progress', 'completed', 'technical_failure'],
  completed:        [],
  missed:           [],
  cancelled:        [],
  no_show_patient:  [],
  no_show_doctor:   [],
  technical_failure:['scheduled'],
};

const CONSULTATION_CACHE_TTL = 60;
const LIST_CACHE_TTL         = 120;

// ── Helpers ───────────────────────────────────────────────────────────────────

const assertTransition = (from, to) => {
  const allowed = VALID_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`);
  }
};

const consultationCacheKey = (id) => `consultation:${id}`;

const invalidateConsultationCache = async (id, patientId, doctorId) => {
  await Promise.all([
    invalidateKey(consultationCacheKey(id)),
    invalidatePattern(`consultations:patient:${patientId}:*`),
    invalidatePattern(`consultations:doctor:${doctorId}:*`),
    invalidatePattern(`consultations:admin:*`),
  ]);
};

const pushNotification = async ({ recipientId, title, body, type, relatedEntityId, deepLink }) => {
  try {
    await Notification.create({
      recipient: recipientId,
      title,
      body,
      type,
      relatedEntityType: 'Booking',
      relatedEntityId,
      deepLink,
      triggeredBy: 'system',
      channels: [{ channel: 'InApp', status: 'Queued' }],
    });
  } catch (err) {
    console.error('[pushNotification] failed silently:', err.message);
  }
};

// ── Timer helpers ──────────────────────────────────────────────────────────────

/**
 * Compute net elapsed seconds for a consultation from its timerState segments
 * plus any currently-running segment that hasn't been closed yet.
 */
const computeCurrentElapsedSec = (timerState) => {
  if (!timerState) return 0;
  let total = timerState.totalElapsedSec || 0;
  // If there's an open segment (currentSegmentStartedAt), add live duration
  if (timerState.currentSegmentStartedAt) {
    total += Math.floor((Date.now() - new Date(timerState.currentSegmentStartedAt).getTime()) / 1000);
  }
  return total;
};

const MAX_TIME_MIN = () => parseInt(process.env.CONSULTATION_MAX_TIME_MIN || '30', 10);
const REMINDER_MIN = () => parseInt(process.env.CONSULTATION_REMINDER_MIN_BEFORE || '15', 10);

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CREATE CONSULTATION
// ═══════════════════════════════════════════════════════════════════════════════

export const createConsultation = async (data, createdBy) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      bookingId,
      consultationType,
      scheduledAt,
      doctorId,
      patientId,
      hospitalId,
      slotId,
      slotDurationMin = 15,
      urgency = 'routine',
      isFollowUp = false,
      parentConsultationId = null,
    } = data;

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) throw new Error('Booking not found');
    if (booking.consultationSessionId) {
      throw new Error('Booking already has a consultation session linked');
    }

    const doctor = await DoctorProfile.findById(doctorId)
      .populate('user', 'name phone email')
      .session(session);
    if (!doctor) throw new Error('DoctorProfile not found');

    const patient = await User.findById(patientId).session(session);
    if (!patient) throw new Error('Patient (User) not found');

    const [consultation] = await Consultation.create(
      [
        {
          consultationType,
          booking: bookingId,
          doctor: doctorId,
          doctorUser: doctor.user._id,
          patient: patientId,
          hospital: hospitalId || null,
          scheduledAt: new Date(scheduledAt),
          slotId: slotId || null,
          slotDurationMin,
          urgency,
          isFollowUp,
          parentConsultation: parentConsultationId || null,
          gracePeriodMin: parseInt(process.env.CONSULTATION_GRACE_PERIOD_MIN || '10', 10),
          status: 'scheduled',
          createdBy,
          updatedBy: createdBy,
        },
      ],
      { session }
    );

    booking.consultationSessionId = consultation._id;
    booking.updatedBy = createdBy;
    await booking.save({ session });

    const opDate  = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const opSeq   = await Consultation.countDocuments({ doctor: doctorId }).session(session);
    const opNumber = `OP-${opDate}-${String(opSeq + 1).padStart(4, '0')}`;

    await OutPatientRecord.create(
      [
        {
          opNumber,
          booking: bookingId,
          bookingNumber: booking.bookingCode,
          patient: patientId,
          patientName: booking.patientInfo?.name || patient.name,
          doctor: doctorId,
          hospital: hospitalId || null,
          consultationType: consultationType === 'video' ? 'video'
            : consultationType === 'home_visit' ? 'home_visit'
            : isFollowUp ? 'follow_up' : 'in_person',
          scheduledAt: new Date(scheduledAt),
          status: 'scheduled',
          followUpExpiry: (() => {
            const d = new Date(scheduledAt);
            d.setDate(d.getDate() + (doctor.fees?.followUpValidDays ?? 7));
            return d;
          })(),
          followUpFee: doctor.fees?.followUpFee ?? 0,
          createdBy,
        },
      ],
      { session }
    );

    await session.commitTransaction();

    let agoraTokens = null;
    if (['video', 'audio'].includes(consultationType)) {
      try {
        agoraTokens = await provisionConsultationTokens(
          consultation._id.toString(),
          doctor.user._id.toString(),
          patientId,
          createdBy,
        );
      } catch (agoraErr) {
        console.error('[createConsultation] Agora provision failed:', agoraErr.message);
      }
    }

    await invalidateConsultationCache(consultation._id, patientId, doctorId);

    const timeString = new Date(scheduledAt).toLocaleString('en-IN', {
      dateStyle: 'medium', timeStyle: 'short',
    });

    if (patient.email) {
      sendEmail({
        email: patient.email,
        subject: `Your Consultation is Confirmed - ${consultation.consultationCode}`,
        html: transactionalTemplate({
          header: 'APPOINTMENT CONFIRMED',
          title: `Consultation Confirmed with Dr. ${doctor.user.name}`,
          body: `Your ${consultationType} consultation is successfully scheduled for <strong>${timeString}</strong>. Please ensure you are available 5 minutes before the start time.`,
          buttonText: 'View Details',
          buttonLink: `${process.env.FRONTEND_URL}/consultations/${consultation._id}`,
        }),
      }).catch(err => console.error('Patient email failed:', err.message));
    }

    if (doctor.user.email) {
      sendEmail({
        email: doctor.user.email,
        subject: `New Consultation Scheduled - ${consultation.consultationCode}`,
        html: transactionalTemplate({
          header: 'NEW APPOINTMENT',
          title: `New ${consultationType} Consultation`,
          body: `You have a new consultation scheduled with ${patient.name} for <strong>${timeString}</strong>.`,
          buttonText: 'View Schedule',
          buttonLink: `${process.env.FRONTEND_URL}/doctor/consultations/${consultation._id}`,
        }),
      }).catch(err => console.error('Doctor email failed:', err.message));
    }

    await Promise.allSettled([
      pushNotification({
        recipientId: patientId,
        title: 'Consultation Scheduled',
        body: `Your ${consultationType} consultation is confirmed for ${timeString}`,
        type: 'Appointment_Confirmed',
        relatedEntityId: bookingId,
        deepLink: { screen: 'ConsultationDetail', referenceId: consultation._id },
      }),
      pushNotification({
        recipientId: doctor.user._id,
        title: 'New Consultation',
        body: `You have a ${consultationType} consultation scheduled`,
        type: 'Appointment_Confirmed',
        relatedEntityId: bookingId,
        deepLink: { screen: 'DoctorConsultationDetail', referenceId: consultation._id },
      }),
    ]);

    return { consultation, agoraTokens };
  } catch (err) {
    if (session.inTransaction()) await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GET CONSULTATION
// ═══════════════════════════════════════════════════════════════════════════════

export const getConsultationById = async (id, includeTokens = false) => {
  if (!includeTokens) {
    try {
      const cached = await redisClient.get(consultationCacheKey(id));
      if (cached) return JSON.parse(cached);
    } catch (_) {}
  }

  const query = Consultation.findById(id)
    .populate('doctor', 'user specialization profilePhotoUrl qualifications fees')
    .populate('patient', 'name phone email avatar')
    .populate('hospital', 'name address phone')
    .populate('booking', 'bookingCode bookingType status paymentStatus fareBreakdown')
    .populate('prescriptions', 'rxNumber status issuedAt medicines')
    .populate('parentConsultation', 'consultationCode consultationType scheduledAt status');

  if (includeTokens) {
    query.select('+agora.doctorRtcToken +agora.doctorRtmToken +agora.patientRtcToken +agora.patientRtmToken');
  }

  const consultation = await query.lean({ virtuals: true });
  if (!consultation) throw new Error('Consultation not found');

  if (!includeTokens) {
    try {
      const ttl = consultation.isActive ? CONSULTATION_CACHE_TTL : LIST_CACHE_TTL;
      await redisClient.setEx(consultationCacheKey(id), ttl, JSON.stringify(consultation));
    } catch (_) {}
  }

  return consultation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LIST CONSULTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const listConsultations = async ({ filter = {}, page = 1, limit = 10, sort = { scheduledAt: -1 }, cacheKeyPrefix = null }) => {
  const skip     = (page - 1) * limit;
  const cacheKey = cacheKeyPrefix ? `${cacheKeyPrefix}:${JSON.stringify({ filter, page, limit })}` : null;

  if (cacheKey) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
  }

  const [consultations, total] = await Promise.all([
    Consultation.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('doctor', 'user specialization profilePhotoUrl')
      .populate('patient', 'name phone avatar')
      .populate('hospital', 'name')
      .lean({ virtuals: true }),
    Consultation.countDocuments(filter),
  ]);

  const result = {
    consultations,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };

  if (cacheKey) {
    try {
      await redisClient.setEx(cacheKey, LIST_CACHE_TTL, JSON.stringify(result));
    } catch (_) {}
  }

  return result;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. UPDATE CONSULTATION
// ═══════════════════════════════════════════════════════════════════════════════

export const updateConsultation = async (id, updates, updatedBy) => {
  if (updates.status) {
    throw new Error('Use status transition functions to change consultation status');
  }

  const consultation = await Consultation.findByIdAndUpdate(
    id,
    { ...updates, updatedBy },
    { new: true, runValidators: true }
  );
  if (!consultation) throw new Error('Consultation not found');

  await invalidateConsultationCache(id, consultation.patient, consultation.doctor);
  return consultation;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. STATUS TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const transitionStatus = async (id, toStatus, { actor, reason, metadata = {} } = {}) => {
  const consultation = await Consultation.findById(id)
    .populate('patient', 'name email phone')
    .populate({ path: 'doctor', populate: { path: 'user', select: 'name email phone' } });

  if (!consultation) throw new Error('Consultation not found');

  assertTransition(consultation.status, toStatus);

  consultation.status    = toStatus;
  consultation.updatedBy = actor;
  if (reason) {
    consultation.statusLog.push({ fromStatus: consultation.status, toStatus, changedBy: actor, reason });
  }

  switch (toStatus) {
    case 'in_progress':
      if (!consultation.sessionStartedAt) consultation.sessionStartedAt = new Date();
      consultation.notificationsSent.sessionStarted = true;
      break;

    case 'completed':
      consultation.sessionEndedAt = new Date();
      if (consultation.sessionStartedAt) {
        consultation.actualDurationSec = Math.round(
          (consultation.sessionEndedAt - consultation.sessionStartedAt) / 1000
        );
      }
      if (!consultation.sessionMetrics) consultation.sessionMetrics = {};
      consultation.sessionMetrics.totalDurationSec   = consultation.actualDurationSec;
      consultation.sessionMetrics.prescriptionIssued = (consultation.prescriptions?.length ?? 0) > 0;
      consultation.sessionMetrics.referralIssued     = !!consultation.clinicalNotes?.referralTo;
      break;

    case 'cancelled':
      consultation.cancellation = {
        cancelledBy:   metadata.cancelledBy || 'admin',
        cancelledById: actor,
        reason:        reason || 'No reason provided',
        cancelledAt:   new Date(),
        refundable:    metadata.refundable ?? false,
      };
      if (consultation.patient?.email) {
        sendEmail({
          email: consultation.patient.email,
          subject: `Consultation Cancelled - ${consultation.consultationCode}`,
          html: transactionalTemplate({
            header: 'APPOINTMENT CANCELLED',
            title: 'Your Consultation Has Been Cancelled',
            body: `Your consultation scheduled for ${new Date(consultation.scheduledAt).toLocaleString('en-IN')} has been cancelled.<br><br><strong>Reason:</strong> ${reason || 'Not specified'}`,
            buttonText: 'Book New Appointment',
            buttonLink: `${process.env.FRONTEND_URL}/doctors`,
          }),
        }).catch(err => console.error('Cancellation email failed:', err.message));
      }
      break;

    case 'waiting':
      consultation.waitingRoom.patientEnteredAt  = new Date();
      consultation.waitingRoom.estimatedWaitMin  = metadata.estimatedWaitMin || 5;
      break;

    case 'doctor_joined':
      consultation.waitingRoom.doctorReadyAt = new Date();
      break;

    case 'patient_joined':
      consultation.waitingRoom.patientReadyAt = new Date();
      break;

    case 'technical_failure':
      if (!consultation.sessionMetrics) consultation.sessionMetrics = {};
      consultation.sessionMetrics.reconnectCount = (consultation.sessionMetrics.reconnectCount || 0) + 1;
      break;

    default:
      break;
  }

  await consultation.save();
  await invalidateConsultationCache(id, consultation.patient._id.toString(), consultation.doctor._id.toString());

  return consultation;
};

// ── Waiting Room ──────────────────────────────────────────────────────────────

export const enterWaitingRoom = async (consultationId, patientId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');
  if (c.patient.toString() !== patientId) throw new Error('Forbidden');
  if (!['scheduled', 'waiting'].includes(c.status)) {
    throw new Error(`Cannot enter waiting room in status: ${c.status}`);
  }

  c.waitingRoom.patientEnteredAt = new Date();
  c.waitingRoom.patientLeft      = false;
  c.waitingRoom.patientLeftAt    = undefined;
  c.waitingRoom.estimatedWaitMin = 5;
  c.status    = 'waiting';
  c.updatedBy = patientId;

  await pushNotification({
    recipientId: c.doctorUser,
    title: 'Patient in Waiting Room',
    body: 'Your patient is ready. Join to start the consultation.',
    type: 'Appointment_Reminder',
    relatedEntityId: c.booking,
    deepLink: { screen: 'DoctorConsultationDetail', referenceId: c._id },
  });

  await c.save();
  await invalidateConsultationCache(consultationId, patientId, c.doctor.toString());
  return c;
};

export const leaveWaitingRoom = async (consultationId, patientId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');

  c.waitingRoom.patientLeft    = true;
  c.waitingRoom.patientLeftAt  = new Date();
  c.updatedBy = patientId;
  await c.save();
  return c;
};

export const getWaitingRoomStatus = async (consultationId) => {
  const c = await Consultation.findById(consultationId)
    .select('waitingRoom status scheduledAt gracePeriodMin autoMissedAt')
    .lean();
  if (!c) throw new Error('Consultation not found');
  return {
    status:           c.status,
    waitingRoom:      c.waitingRoom,
    scheduledAt:      c.scheduledAt,
    autoMissedAt:     c.autoMissedAt,
    gracePeriodMin:   c.gracePeriodMin,
    estimatedWaitMin: c.waitingRoom?.estimatedWaitMin ?? 0,
    queuePosition:    c.waitingRoom?.queuePosition ?? 1,
  };
};

// ── Join / Leave ──────────────────────────────────────────────────────────────

export const participantJoin = async (consultationId, userId, role, deviceInfo = {}) => {
  const c = await Consultation.findById(consultationId)
    .select('+agora.doctorRtcToken +agora.doctorRtmToken +agora.patientRtcToken +agora.patientRtmToken');
  if (!c) throw new Error('Consultation not found');

  const existingEvent = c.participantEvents.find(
    (e) => e.userId.toString() === userId && !e.leftAt
  );
  if (existingEvent) {
    existingEvent.rejoinCount += 1;
    existingEvent.joinedAt     = new Date();
  } else {
    c.participantEvents.push({
      userId,
      role,
      joinedAt:    new Date(),
      deviceInfo,
      rejoinCount: 0,
    });
  }

  const isDoctor  = role === 'doctor';
  const isPatient = role === 'patient';

  if (isDoctor && c.status === 'scheduled')      c.status = 'doctor_joined';
  if (isDoctor && c.status === 'patient_joined') c.status = 'in_progress';
  if (isPatient && c.status === 'scheduled')     c.status = 'patient_joined';
  if (isPatient && ['waiting', 'doctor_joined'].includes(c.status)) c.status = 'in_progress';

  c.updatedBy = userId;
  await c.save();

  const participantRole = isDoctor ? 'doctor' : 'patient';
  let tokens = null;
  if (['video', 'audio'].includes(c.consultationType)) {
    tokens = await getParticipantTokens(consultationId, participantRole, userId);
  }

  await invalidateConsultationCache(consultationId, c.patient.toString(), c.doctor.toString());
  return { consultation: c, tokens };
};

export const participantLeave = async (consultationId, userId, role, metrics = {}) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');

  const event = c.participantEvents
    .filter((e) => e.userId.toString() === userId)
    .sort((a, b) => b.joinedAt - a.joinedAt)[0];

  if (event && !event.leftAt) {
    event.leftAt     = new Date();
    event.durationSec = Math.round((event.leftAt - event.joinedAt) / 1000);
    if (metrics.networkQuality) event.networkQuality = metrics.networkQuality;
  }

  c.updatedBy = userId;
  await c.save();
  return c;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. AGORA TOKEN OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const provisionTokens = async (consultationId, actorId) => {
  const c = await Consultation.findById(consultationId).populate('doctor', 'user').lean();
  if (!c) throw new Error('Consultation not found');

  return provisionConsultationTokens(
    consultationId,
    c.doctor.user.toString(),
    c.patient.toString(),
    actorId,
  );
};

export const getTokensForParticipant = async (consultationId, userId, userRole) => {
  const c = await Consultation.findById(consultationId)
    .select('patient doctorUser consultationType status');
  if (!c) throw new Error('Consultation not found');
  if (c.isCancelled) throw new Error('Consultation is cancelled');

  let participantRole;
  if (c.patient.toString() === userId)         participantRole = 'patient';
  else if (c.doctorUser?.toString() === userId) participantRole = 'doctor';
  else throw new Error('You are not a participant of this consultation');

  return getParticipantTokens(consultationId, participantRole, userId);
};

export const forceRefreshTokens = async (consultationId, actorId) => {
  return refreshConsultationTokens(consultationId, actorId);
};

export const addExtraParticipant = async (consultationId, userId, role, addedBy) => {
  return addExtraParticipantToken(consultationId, userId, role, addedBy);
};

export const handleRecordingConsent = async (consultationId, who, consented, actorId) => {
  return updateRecordingConsent(consultationId, who, consented, actorId);
};

export const handleAgoraWebhook = async (rawBody, signature, timestamp) => {
  const isValid = verifyAgoraWebhook(rawBody, signature, timestamp);
  if (!isValid) throw new Error('Invalid Agora webhook signature');

  const event = JSON.parse(rawBody);
  const { eventType, payload } = event;

  if (eventType === 'cloud_recording_started') {
    const c = await Consultation.findOne({ 'agora.channelName': payload?.channelName });
    if (c) {
      c.agora.cloudRecordingResourceId = payload.resourceId;
      c.agora.cloudRecordingSid        = payload.sid;
      c.agora.recordingStartedAt       = new Date();
      await c.save();
    }
  }

  if (eventType === 'cloud_recording_stopped') {
    const c = await Consultation.findOne({ 'agora.cloudRecordingSid': payload?.sid });
    if (c) {
      c.agora.recordingStoppedAt = new Date();
      if (payload.fileList) {
        c.agora.recordingFileUrls = payload.fileList.map((f) => f.fileName);
      }
      await c.save();
    }
  }

  return { handled: true, eventType };
};

export const startRecording = async (consultationId, actorId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');
  if (!c.isActive) throw new Error('Consultation is not active');

  c.agora.isRecordingEnabled       = true;
  c.agora.recordingStartedAt       = new Date();
  c.agora.recordingConsentDoctor   = true;
  c.agora.recordingConsentPatient  = true;
  c.recordingConsent = { doctorConsented: true, patientConsented: true, consentTimestamp: new Date() };
  c.updatedBy = actorId;
  await c.save();
  return { recording: true, startedAt: c.agora.recordingStartedAt };
};

export const stopRecording = async (consultationId, actorId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');

  c.agora.isRecordingEnabled  = false;
  c.agora.recordingStoppedAt  = new Date();
  c.updatedBy = actorId;
  await c.save();
  return { recording: false, stoppedAt: c.agora.recordingStoppedAt };
};

export const getRecordingUrls = async (consultationId) => {
  const c = await Consultation.findById(consultationId)
    .select('agora.recordingFileUrls agora.recordingStartedAt agora.recordingStoppedAt agora.isRecordingEnabled')
    .lean();
  if (!c) throw new Error('Consultation not found');
  return {
    isRecordingEnabled: c.agora?.isRecordingEnabled,
    recordingStartedAt: c.agora?.recordingStartedAt,
    recordingStoppedAt: c.agora?.recordingStoppedAt,
    urls: c.agora?.recordingFileUrls ?? [],
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PARTICIPANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const getParticipants = async (consultationId) => {
  const c = await Consultation.findById(consultationId)
    .populate({
      path: 'doctor',
      select: 'user specialization profilePhotoUrl',
      populate: { path: 'user', select: 'name phone email avatar' },
    })
    .populate('patient', 'name phone email avatar')
    .populate('additionalParticipants.userId', 'name avatar phone email role')
    .populate('participantEvents.userId', 'name avatar role')
    .lean();

  if (!c) throw new Error('Consultation not found');

  return {
    core: { doctor: c.doctor, patient: c.patient },
    additional: c.additionalParticipants ?? [],
    events: c.participantEvents ?? [],
    extraParticipants: c.agora?.extraParticipants ?? [],
  };
};

export const removeExtraParticipant = async (consultationId, userId, actorId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');

  c.additionalParticipants = c.additionalParticipants.filter((p) => p.userId.toString() !== userId);
  c.agora.extraParticipants = (c.agora?.extraParticipants ?? []).filter((p) => String(p.uid) !== userId);
  c.updatedBy = actorId;
  await c.save();
  return { removed: true };
};

export const getParticipantEvents = async (consultationId) => {
  const c = await Consultation.findById(consultationId)
    .populate('participantEvents.userId', 'name avatar role')
    .select('participantEvents')
    .lean();
  if (!c) throw new Error('Consultation not found');
  return c.participantEvents ?? [];
};

export const updateParticipantNetworkQuality = async (consultationId, userId, quality) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');

  const event = c.participantEvents
    .filter((e) => e.userId.toString() === userId && !e.leftAt)
    .sort((a, b) => b.joinedAt - a.joinedAt)[0];

  if (event) {
    event.networkQuality = quality;
    await c.save();
  }
  return { updated: true, quality };
};

// ── NEW: Mute participant (doctor only) ───────────────────────────────────────

/**
 * Doctor mutes a participant's audio.
 * This stores the flag on DB and the socket broadcasts a mute command so the
 * client SDK calls localAudioTrack.setEnabled(false).
 *
 * @param {string} consultationId
 * @param {string} targetUserId     — the participant to mute
 * @param {string} actorId          — must be the doctor of this consultation
 * @returns {{ mutedUserId: string, isMuted: boolean }}
 */
export const muteParticipant = async (consultationId, targetUserId, actorId) => {
  const c = await Consultation.findById(consultationId).select('doctorUser patient participantEvents status');
  if (!c) throw new Error('Consultation not found');
  if (c.doctorUser?.toString() !== actorId) throw new Error('Only the doctor can mute participants');
  if (!['in_progress', 'paused'].includes(c.status)) {
    throw new Error('Can only mute during an active session');
  }

  // Find the most recent active participant event for targetUser
  const event = c.participantEvents
    .filter((e) => e.userId.toString() === targetUserId && !e.leftAt)
    .sort((a, b) => b.joinedAt - a.joinedAt)[0];

  if (!event) throw new Error('Participant not currently in session');

  event.isMutedByDoctor  = true;
  event.mutedByDoctorAt  = new Date();
  await c.save();

  return { mutedUserId: targetUserId, isMuted: true };
};

/**
 * Doctor unmutes a participant's audio.
 */
export const unmuteParticipant = async (consultationId, targetUserId, actorId) => {
  const c = await Consultation.findById(consultationId).select('doctorUser participantEvents status');
  if (!c) throw new Error('Consultation not found');
  if (c.doctorUser?.toString() !== actorId) throw new Error('Only the doctor can unmute participants');

  const event = c.participantEvents
    .filter((e) => e.userId.toString() === targetUserId && !e.leftAt)
    .sort((a, b) => b.joinedAt - a.joinedAt)[0];

  if (!event) throw new Error('Participant not currently in session');

  event.isMutedByDoctor    = false;
  event.unmutedByDoctorAt  = new Date();
  await c.save();

  return { mutedUserId: targetUserId, isMuted: false };
};

/**
 * Doctor kicks a participant from the session.
 * After kick the participant's socket receives a kick event and should
 * disconnect from the Agora channel.
 *
 * @param {string} consultationId
 * @param {string} targetUserId
 * @param {string} actorId        — must be doctor
 * @param {string} [reason]
 */
export const kickParticipant = async (consultationId, targetUserId, actorId, reason = '') => {
  const c = await Consultation.findById(consultationId)
    .select('doctorUser patient participantEvents status');
  if (!c) throw new Error('Consultation not found');
  if (c.doctorUser?.toString() !== actorId) throw new Error('Only the doctor can kick participants');

  // Prevent doctor from kicking the patient of the consultation entirely
  // (admins use overrideStatus / cancel for that)
  const event = c.participantEvents
    .filter((e) => e.userId.toString() === targetUserId && !e.leftAt)
    .sort((a, b) => b.joinedAt - a.joinedAt)[0];

  if (!event) throw new Error('Participant not currently in session');

  event.isKicked   = true;
  event.kickedAt   = new Date();
  event.kickReason = reason || 'Removed by doctor';
  event.leftAt     = new Date(); // treat as left
  event.durationSec = Math.round((event.leftAt - (event.joinedAt || event.leftAt)) / 1000);

  await c.save();
  return { kickedUserId: targetUserId, reason: event.kickReason };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CONSULTATION TIMER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the current timer state for a consultation.
 * Returns elapsed time, remaining time, and deadline.
 */
export const getConsultationTimer = async (consultationId) => {
  const c = await Consultation.findById(consultationId)
    .select('timerState status sessionStartedAt')
    .lean({ virtuals: true });
  if (!c) throw new Error('Consultation not found');

  const maxTimeSec    = MAX_TIME_MIN() * 60;
  const elapsedSec    = computeCurrentElapsedSec(c.timerState);
const hardDeadline = c.timerState?.hardDeadlineAt;
// If active deadline exists, use it (accurate wall clock)
// Else compute from elapsed (session paused or not started)
const remainingSec = hardDeadline
  ? Math.max(0, Math.floor((new Date(hardDeadline).getTime() - Date.now()) / 1000))
  : Math.max(0, maxTimeSec - elapsedSec);

  return {
    status:          c.status,
    maxTimeSec,
    elapsedSec,
    remainingSec,
    hardDeadlineAt:  hardDeadline,
    reminderSent:    c.timerState?.reminderSent ?? false,
    autoEnded:       c.timerState?.autoEnded ?? false,
    segments:        c.timerState?.segments ?? [],
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CLINICAL NOTES
// ═══════════════════════════════════════════════════════════════════════════════

export const saveVitals = async (consultationId, vitals, actorId) => {
  const c = await Consultation.findByIdAndUpdate(
    consultationId,
    { vitals: { ...vitals, recordedAt: new Date(), recordedBy: 'doctor' }, updatedBy: actorId },
    { new: true, runValidators: true }
  );
  if (!c) throw new Error('Consultation not found');
  await invalidateKey(consultationCacheKey(consultationId));
  return c.vitals;
};

export const saveNotes = async (consultationId, notes, actorId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');

  c.clinicalNotes = { ...c.clinicalNotes.toObject?.() ?? c.clinicalNotes, ...notes, lastEditedAt: new Date() };
  c.updatedBy = actorId;
  await c.save();
  await invalidateKey(consultationCacheKey(consultationId));
  return c.clinicalNotes;
};

export const getNotes = async (consultationId) => {
  const c = await Consultation.findById(consultationId).select('+clinicalNotes.privateNotes').lean();
  if (!c) throw new Error('Consultation not found');
  return c.clinicalNotes;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 10. PRESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const issuePrescription = async (consultationId, prescriptionData, actorId) => {
  const consultation = await Consultation.findById(consultationId)
    .populate('doctor', 'user specialization registrationNumber qualifications')
    .populate('patient', 'name phone email');

  if (!consultation) throw new Error('Consultation not found');
  if (!consultation.isActive && consultation.status !== 'completed') {
    throw new Error('Cannot issue prescription for inactive consultation');
  }

  const doctorUser = await User.findById(consultation.doctor.user).select('name email phone');

  const rx = await EPrescription.create({
    booking: consultation.booking,
    patientCareRecord: null,
    doctor: {
      userId:             consultation.doctor.user,
      doctorProfileId:    consultation.doctor._id,
      name:               doctorUser.name,
      registrationNumber: consultation.doctor.registrationNumber,
      specialization:     consultation.doctor.specialization,
      qualifications:     consultation.doctor.qualifications?.map(q => q.degree).join(', '),
      phone:              doctorUser.phone,
      email:              doctorUser.email,
    },
    patient: {
      userId:     consultation.patient._id,
      name:       consultation.patient.name,
      age:        consultation.patientSnapshot?.age,
      gender:     consultation.patientSnapshot?.gender,
      phone:      consultation.patient.phone,
      bloodGroup: consultation.patientSnapshot?.bloodGroup,
      allergies:  consultation.patientSnapshot?.allergies ?? [],
    },
    ...prescriptionData,
    createdBy: actorId,
  });

  consultation.prescriptions.push(rx._id);
  consultation.updatedBy = actorId;
  if (!consultation.sessionMetrics) consultation.sessionMetrics = {};
  consultation.sessionMetrics.prescriptionIssued = true;
  await consultation.save();

  // ─── UPDATE CUSTOMER PROFILE (Timeline & Medicine History) ────────────────
  try {
    if (consultation.patient?._id) {
      const mappedMedicines = (rx.medicines || []).map(med => ({
        medicineName:      med.medicineName,
        dosage:            med.dosage,
        frequency:         med.frequency,
        startDate:         rx.issuedAt || new Date(),
        isOngoing:         true,
        prescribingDoctor: doctorUser.name,
        instructions:      med.instructions,
        prescriptionId:    rx._id
      }));

      const timelineEntry = {
        date:           rx.issuedAt || new Date(),
        eventTitle:     `Prescription Issued (${rx.rxNumber})`,
        hospitalName:   prescriptionData.hospital?.name || '',
        description:    `Diagnosis: ${prescriptionData.diagnosis || 'Not specified'}. Prescribed ${rx.medicines?.length || 0} medicines and ${rx.labTests?.length || 0} lab tests.`,
        doctorName:     doctorUser.name,
        prescriptionId: rx._id
      };

      await mongoose.model('CustomerProfile').findOneAndUpdate(
        { user: consultation.patient._id },
        {
          $inc: { 'stats.totalConsultations': 1, 'stats.totalBookings': 1 },
          $set: { 'stats.lastBookingAt': new Date(), 'stats.lastActiveAt': new Date() },
          $push: { 
            medicineHistory: { $each: mappedMedicines },
            medicalTimeline: timelineEntry
          }
        }
      );
    }
  } catch (err) {
    console.error(`[issuePrescription] Failed to update CustomerProfile for RX ${rx.rxNumber}:`, err.message);
  }

  // ─── ASYNC: PDF + EMAIL NOTIFICATION ──────────────────────────────────────
  if (consultation.patient?.email) {
    setImmediate(async () => {
      try {
        const { default: generateEPrescriptionPdf } = await import('../utils/generateEPrescriptionPdf.js');
        const { buildEPrescriptionEmail }           = await import('../utils/ePrescriptionEmailTemplate.js');
        const { default: securePdf }                = await import('../utils/securePdf.js');

        const rawPdf    = await generateEPrescriptionPdf(rx);
        const pdfBuffer = await securePdf(rawPdf);

        const fmtD = (d) => d
          ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : '—';

        const verifyUrl   = `${process.env.FRONTEND_URL || 'https://likeson.in'}/rx/verify/${rx.rxNumber}`;
        const downloadUrl = `${process.env.BACKEND_URL  || 'https://api.likeson.in'}/api/clinical/prescriptions/${rx._id}/pdf`;

        const emailHtml = buildEPrescriptionEmail({
          patientName:    consultation.patient.name,
          doctorName:     doctorUser.name,
          specialization: consultation.doctor.specialization,
          rxNumber:       rx.rxNumber,
          issuedAt:       fmtD(rx.issuedAt),
          expiresAt:      fmtD(rx.expiresAt),
          medicines:      rx.medicines || [],
          verifyUrl,
          downloadUrl,
        });

        await sendEmail({
          email:   consultation.patient.email,
          subject: `Your Prescription from Dr. ${doctorUser.name} — ${rx.rxNumber}`,
          html:    emailHtml,
          attachments: [{
            filename:    `Prescription-${rx.rxNumber}.pdf`,
            content:     pdfBuffer,
            contentType: 'application/pdf',
          }],
        });

        console.log(`[issuePrescription] Email + PDF sent → ${consultation.patient.email} | RX: ${rx.rxNumber}`);
      } catch (err) {
        console.error(`[issuePrescription] Email failed for RX ${rx.rxNumber}:`, err.message);
      }
    });
  }

  await pushNotification({
    recipientId: consultation.patient._id,
    title: 'Prescription Ready',
    body: `Your prescription ${rx.rxNumber} has been issued`,
    type: 'Prescription_Added',
    relatedEntityId: consultation.booking,
    deepLink: { screen: 'PrescriptionDetail', referenceId: rx._id },
  });

  await invalidateKey(consultationCacheKey(consultationId));
  return rx;
};

export const getPrescriptions = async (consultationId) => {
  const c = await Consultation.findById(consultationId)
    .populate('prescriptions')
    .select('prescriptions')
    .lean();
  if (!c) throw new Error('Consultation not found');
  return c.prescriptions ?? [];
};

// ═══════════════════════════════════════════════════════════════════════════════
// 11. REFERRAL
// ═══════════════════════════════════════════════════════════════════════════════

export const saveReferral = async (consultationId, { referralTo, referralNote }, actorId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');

  c.clinicalNotes.referralTo   = referralTo;
  c.clinicalNotes.referralNote = referralNote;
  c.clinicalNotes.lastEditedAt = new Date();
  c.updatedBy = actorId;
  if (!c.sessionMetrics) c.sessionMetrics = {};
  c.sessionMetrics.referralIssued = true;
  await c.save();
  await invalidateKey(consultationCacheKey(consultationId));
  return { referralTo, referralNote };
};

export const getReferral = async (consultationId) => {
  const c = await Consultation.findById(consultationId)
    .select('clinicalNotes.referralTo clinicalNotes.referralNote')
    .lean();
  if (!c) throw new Error('Consultation not found');
  return {
    referralTo:  c.clinicalNotes?.referralTo,
    referralNote:c.clinicalNotes?.referralNote,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 12. IN-SESSION CHAT
// ═══════════════════════════════════════════════════════════════════════════════

export const sendChatMessage = async (consultationId, senderId, senderRole, messageData) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');
  if (!c.isActive) throw new Error('Cannot send messages — consultation not active');

  const newMessage = {
    senderUserId: senderId,
    senderRole,
    content:        messageData.content || '',
    messageType:    messageData.messageType || 'text',
    attachmentUrl:  messageData.attachmentUrl || null,
    attachmentName: messageData.attachmentName || null,
    sentAt: new Date(),
  };

  c.chatMessages.push(newMessage);
  if (!c.sessionMetrics) c.sessionMetrics = {};
  c.sessionMetrics.chatMessagesCount = c.chatMessages.length;

  await c.save();

  const savedMsg = c.chatMessages[c.chatMessages.length - 1];
  await Consultation.populate(savedMsg, { path: 'senderUserId', select: 'name avatar role' });
  return savedMsg;
};

export const getChatHistory = async (consultationId) => {
  const c = await Consultation.findById(consultationId)
    .populate('chatMessages.senderUserId', 'name avatar role')
    .select('chatMessages')
    .lean();
  if (!c) throw new Error('Consultation not found');
  return c.chatMessages.filter((m) => !m.isDeleted);
};

export const deleteChatMessage = async (consultationId, messageId, actorId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');

  const msg = c.chatMessages.id(messageId);
  if (!msg) throw new Error('Message not found');
  if (msg.senderUserId.toString() !== actorId) throw new Error('Cannot delete another user\'s message');

  msg.isDeleted = true;
  await c.save();
  return { deleted: true, messageId };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 13. RATING
// ═══════════════════════════════════════════════════════════════════════════════

export const submitRating = async (consultationId, patientId, ratingData) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');
  if (c.patient.toString() !== patientId) throw new Error('Forbidden');
  if (c.status !== 'completed') throw new Error('Can only rate completed consultations');
  if (c.isRated) throw new Error('Already rated');

  c.rating  = { ...ratingData, ratedAt: new Date() };
  c.isRated = true;
  c.updatedBy = patientId;
  await c.save();

  const allRatings = await Consultation.find({
    doctor: c.doctor,
    isRated: true,
    'rating.doctorRating': { $exists: true },
  }).select('rating.doctorRating').lean();

  const avg = allRatings.reduce((s, r) => s + (r.rating?.doctorRating ?? 0), 0) / allRatings.length;

  await DoctorProfile.findByIdAndUpdate(c.doctor, {
    'rating.averageRating': +avg.toFixed(2),
    'rating.totalRatings':  allRatings.length,
  });

  await invalidateKey(consultationCacheKey(consultationId));
  return c.rating;
};

export const getRating = async (consultationId) => {
  const c = await Consultation.findById(consultationId).select('rating isRated').lean();
  if (!c) throw new Error('Consultation not found');
  return { rating: c.rating, isRated: c.isRated };
};

export const editRating = async (consultationId, patientId, updates) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');
  if (c.patient.toString() !== patientId) throw new Error('Forbidden');
  if (!c.isRated) throw new Error('No rating to edit');

  const ratedAt = c.rating?.ratedAt;
  if (ratedAt) {
    const diffHours = (Date.now() - new Date(ratedAt).getTime()) / 3600000;
    if (diffHours > 24) throw new Error('Rating can only be edited within 24 hours');
  }

  c.rating    = { ...c.rating.toObject?.() ?? c.rating, ...updates, ratedAt: c.rating.ratedAt };
  c.updatedBy = patientId;
  await c.save();
  return c.rating;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 14. METRICS
// ═══════════════════════════════════════════════════════════════════════════════

export const saveMetrics = async (consultationId, metrics, actorId) => {
  const c = await Consultation.findByIdAndUpdate(
    consultationId,
    { sessionMetrics: metrics, updatedBy: actorId },
    { new: true }
  );
  if (!c) throw new Error('Consultation not found');
  return c.sessionMetrics;
};

export const getMetrics = async (consultationId) => {
  const c = await Consultation.findById(consultationId).select('sessionMetrics').lean();
  if (!c) throw new Error('Consultation not found');
  return c.sessionMetrics;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 15. FOLLOW-UP
// ═══════════════════════════════════════════════════════════════════════════════

export const createFollowUp = async (parentConsultationId, followUpData, createdBy) => {
  const parent = await Consultation.findById(parentConsultationId);
  if (!parent) throw new Error('Parent consultation not found');
  if (parent.status !== 'completed') throw new Error('Can only follow up completed consultations');

  return createConsultation(
    {
      ...followUpData,
      doctorId:             parent.doctor.toString(),
      patientId:            parent.patient.toString(),
      hospitalId:           parent.hospital?.toString(),
      isFollowUp:           true,
      parentConsultationId: parentConsultationId,
      bookingId:            followUpData.bookingId,
    },
    createdBy
  );
};

export const getFollowUpHistory = async (consultationId) => {
  const chain = [];
  let current = await Consultation.findById(consultationId)
    .select('parentConsultation consultationCode status consultationType scheduledAt')
    .lean();

  while (current?.parentConsultation) {
    const parent = await Consultation.findById(current.parentConsultation)
      .select('parentConsultation consultationCode status consultationType scheduledAt')
      .lean();
    if (parent) chain.unshift(parent);
    current = parent;
  }

  const children = await Consultation.find({ parentConsultation: consultationId })
    .select('consultationCode status consultationType scheduledAt')
    .lean();

  return { chain, children };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 16. DASHBOARD QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export const getDoctorSchedule = async (doctorId) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59);

  return Consultation.find({
    doctor: doctorId,
    scheduledAt: { $gte: start, $lte: end },
    status: { $in: ['scheduled', 'waiting', 'doctor_joined', 'patient_joined', 'in_progress'] },
  })
    .sort({ scheduledAt: 1 })
    .populate('patient', 'name phone avatar')
    .lean({ virtuals: true });
};

export const getDoctorStats = async (doctorId) => {
  const [total, completed, rated, avgDuration] = await Promise.all([
    Consultation.countDocuments({ doctor: doctorId }),
    Consultation.countDocuments({ doctor: doctorId, status: 'completed' }),
    Consultation.countDocuments({ doctor: doctorId, isRated: true }),
    Consultation.aggregate([
      { $match: { doctor: new mongoose.Types.ObjectId(doctorId), status: 'completed' } },
      { $group: { _id: null, avg: { $avg: '$actualDurationSec' } } },
    ]),
  ]);

  return {
    total,
    completed,
    pending: total - completed,
    rated,
    avgDurationSec: avgDuration[0]?.avg ?? 0,
  };
};

export const getActiveSessions = async (filter = {}) => {
  return Consultation.find({
    ...filter,
    status: { $in: ['waiting', 'doctor_joined', 'patient_joined', 'in_progress', 'paused'] },
  })
    .populate('doctor', 'user specialization')
    .populate('patient', 'name phone')
    .lean({ virtuals: true });
};

export const getPlatformStats = async () => {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [total, todayCount, active, completed, cancelled, avgRating] = await Promise.all([
    Consultation.countDocuments({}),
    Consultation.countDocuments({ createdAt: { $gte: today } }),
    Consultation.countDocuments({ status: { $in: ['in_progress', 'waiting', 'doctor_joined', 'patient_joined'] } }),
    Consultation.countDocuments({ status: 'completed' }),
    Consultation.countDocuments({ status: { $in: ['cancelled', 'missed', 'no_show_patient', 'no_show_doctor'] } }),
    Consultation.aggregate([
      { $match: { isRated: true } },
      { $group: { _id: null, avg: { $avg: '$rating.overallRating' } } },
    ]),
  ]);

  return { total, todayCount, active, completed, cancelled, avgRating: avgRating[0]?.avg ?? 0 };
};

// ═══════════════════════════════════════════════════════════════════════════════
// 17. ADMIN OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const assignAdmin = async (consultationId, adminId, actorId) => {
  const c = await Consultation.findByIdAndUpdate(
    consultationId,
    { assignedAdminId: adminId, updatedBy: actorId },
    { new: true }
  );
  if (!c) throw new Error('Consultation not found');
  return c;
};

export const overrideStatus = async (consultationId, status, reason, actorId) => {
  const c = await Consultation.findById(consultationId);
  if (!c) throw new Error('Consultation not found');
  c.status    = status;
  c.updatedBy = actorId;
  c.statusLog.push({ fromStatus: c.status, toStatus: status, changedBy: actorId, reason });
  await c.save();
  await invalidateConsultationCache(consultationId, c.patient.toString(), c.doctor.toString());
  return c;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 18. CRON JOBS
// ═══════════════════════════════════════════════════════════════════════════════

export const runAutoMiss = async () => {
  const now    = new Date();
  const missed = await Consultation.find({
    status: 'scheduled',
    autoMissedAt: { $lt: now },
  }).select('_id patient doctor doctorUser booking');

  let count = 0;
  for (const c of missed) {
    try {
      await transitionStatus(c._id.toString(), 'missed', {
        actor: null,
        reason: 'Auto-missed: grace period expired',
      });
      await Promise.allSettled([
        pushNotification({
          recipientId: c.patient,
          title: 'Consultation Missed',
          body: 'Your consultation was marked as missed. Please reschedule.',
          type: 'Booking_No_Show',
          relatedEntityId: c.booking,
        }),
        pushNotification({
          recipientId: c.doctorUser,
          title: 'Consultation Missed',
          body: 'Consultation marked as missed due to no-show.',
          type: 'Booking_No_Show',
          relatedEntityId: c.booking,
        }),
      ]);
      count++;
    } catch (err) {
      console.error(`[runAutoMiss] failed for ${c._id}:`, err.message);
    }
  }
  return { processed: count };
};

/**
 * runAutoEnd
 * Fires every minute via cron.
 * Finds active consultations whose hardDeadlineAt has passed and auto-completes them.
 * Sends email + push notification to both doctor and patient.
 */
export const runAutoEnd = async () => {
  const now = new Date();

 const overdue = await Consultation.find({
  status:                     'in_progress',   // paused = no deadline, skip
  'timerState.hardDeadlineAt':{ $lt: now, $exists: true },
  'timerState.autoEnded':      false,
})
    .select('_id patient doctorUser booking consultationCode timerState')
    .populate('patient', 'name email')
    .populate('doctorUser', 'name email');

  let count = 0;
  for (const c of overdue) {
    try {
      // Mark auto-ended before transition to prevent double-fire
      await Consultation.findByIdAndUpdate(c._id, {
        'timerState.autoEnded': true,
        autoEndedAt:            now,
      });

      await transitionStatus(c._id.toString(), 'completed', {
        actor:  null,
        reason: `Auto-ended: max consultation time of ${MAX_TIME_MIN()} minutes reached`,
      });

      const maxMin = MAX_TIME_MIN();

      // Email — patient
      if (c.patient?.email) {
        sendEmail({
          email: c.patient.email,
          subject: `Your Consultation Has Ended - ${c.consultationCode}`,
          html: transactionalTemplate({
            header: 'CONSULTATION ENDED',
            title: 'Your Consultation Session Has Ended',
            body: `Your consultation <strong>${c.consultationCode}</strong> has been automatically ended after reaching the maximum allowed time of <strong>${maxMin} minutes</strong>.<br><br>Your doctor may have issued a prescription. Please check your prescriptions section.`,
            buttonText: 'View Consultation',
            buttonLink: `${process.env.FRONTEND_URL}/consultations/${c._id}`,
          }),
        }).catch(err => console.error('[runAutoEnd] Patient email failed:', err.message));
      }

      // Email — doctor
      if (c.doctorUser?.email) {
        sendEmail({
          email: c.doctorUser.email,
          subject: `Consultation Auto-Ended - ${c.consultationCode}`,
          html: transactionalTemplate({
            header: 'SESSION ENDED',
            title: 'Consultation Auto-Ended',
            body: `Consultation <strong>${c.consultationCode}</strong> with patient <strong>${c.patient?.name}</strong> was automatically ended after ${maxMin} minutes.`,
            buttonText: 'View Details',
            buttonLink: `${process.env.FRONTEND_URL}/doctor/consultations/${c._id}`,
          }),
        }).catch(err => console.error('[runAutoEnd] Doctor email failed:', err.message));
      }

      // Push notifications
      await Promise.allSettled([
        pushNotification({
          recipientId:    c.patient?._id,
          title:          'Consultation Ended',
          body:           `Your consultation has automatically ended after ${maxMin} minutes.`,
          type:           'Appointment_Reminder',
          relatedEntityId:c.booking,
          deepLink:       { screen: 'ConsultationDetail', referenceId: c._id },
        }),
        pushNotification({
          recipientId:    c.doctorUser?._id,
          title:          'Consultation Auto-Ended',
          body:           `Consultation with ${c.patient?.name} ended after ${maxMin} minutes.`,
          type:           'Appointment_Reminder',
          relatedEntityId:c.booking,
          deepLink:       { screen: 'DoctorConsultationDetail', referenceId: c._id },
        }),
      ]);

      count++;
    } catch (err) {
      console.error(`[runAutoEnd] failed for ${c._id}:`, err.message);
    }
  }
  return { autoEnded: count };
};

/**
 * runTimerReminder
 * Fires every minute.
 * Finds active consultations approaching their hard deadline (≤ reminderMin remaining)
 * and sends a 15-min-remaining email + push notification to both parties.
 */
export const runTimerReminder = async () => {
  const now        = new Date();
  const reminderMs = REMINDER_MIN() * 60 * 1000;
  const cutoff     = new Date(now.getTime() + reminderMs); // deadline within next 15 min

  const approaching = await Consultation.find({
  status:                       'in_progress',  // paused = no deadline
  'timerState.hardDeadlineAt':  { $gt: now, $lte: cutoff, $exists: true },
    'timerState.reminderSent':    false,
    'timerState.autoEnded':       false,
  })
    .select('_id patient doctorUser booking consultationCode timerState')
    .populate('patient', 'name email')
    .populate('doctorUser', 'name email');

  let count = 0;
  for (const c of approaching) {
    try {
      const remainingMin = Math.ceil(
        (new Date(c.timerState.hardDeadlineAt).getTime() - now.getTime()) / 60000
      );

      // Mark sent first to avoid double-send on slow cron
      await Consultation.findByIdAndUpdate(c._id, {
        'timerState.reminderSent':             true,
        'notificationsSent.maxTimeReminder15min': true,
      });

      // Email — patient
      if (c.patient?.email) {
        sendEmail({
          email: c.patient.email,
          subject: `Consultation Ending Soon - ${c.consultationCode}`,
          html: transactionalTemplate({
            header: 'TIME REMINDER',
            title: `Your Consultation Ends in ~${remainingMin} Minutes`,
            body: `Your ongoing consultation <strong>${c.consultationCode}</strong> will automatically end in approximately <strong>${remainingMin} minutes</strong>.<br><br>Please wrap up with your doctor.`,
            buttonText: 'View Consultation',
            buttonLink: `${process.env.FRONTEND_URL}/consultations/${c._id}`,
          }),
        }).catch(err => console.error('[runTimerReminder] Patient email failed:', err.message));
      }

      // Email — doctor
      if (c.doctorUser?.email) {
        sendEmail({
          email: c.doctorUser.email,
          subject: `Consultation Ending Soon - ${c.consultationCode}`,
          html: transactionalTemplate({
            header: 'TIME REMINDER',
            title: `Session Ends in ~${remainingMin} Minutes`,
            body: `Your consultation <strong>${c.consultationCode}</strong> with patient <strong>${c.patient?.name}</strong> will auto-end in approximately <strong>${remainingMin} minutes</strong>. Please issue any prescriptions or referrals before the session ends.`,
            buttonText: 'View Session',
            buttonLink: `${process.env.FRONTEND_URL}/doctor/consultations/${c._id}`,
          }),
        }).catch(err => console.error('[runTimerReminder] Doctor email failed:', err.message));
      }

      // Push notifications
      await Promise.allSettled([
        pushNotification({
          recipientId:    c.patient?._id,
          title:          `Session Ending in ${remainingMin} min`,
          body:           `Your consultation will automatically end in ${remainingMin} minutes.`,
          type:           'Appointment_Reminder',
          relatedEntityId:c.booking,
          deepLink:       { screen: 'ConsultationDetail', referenceId: c._id },
        }),
        pushNotification({
          recipientId:    c.doctorUser?._id,
          title:          `Session Ending in ${remainingMin} min`,
          body:           `Consultation with ${c.patient?.name} ends in ${remainingMin} minutes.`,
          type:           'Appointment_Reminder',
          relatedEntityId:c.booking,
          deepLink:       { screen: 'DoctorConsultationDetail', referenceId: c._id },
        }),
      ]);

      count++;
    } catch (err) {
      console.error(`[runTimerReminder] failed for ${c._id}:`, err.message);
    }
  }
  return { reminded: count };
};

export const runTokenRefresh = async () => {
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000);
  const consultations  = await Consultation.find({
    status: { $in: ['waiting', 'doctor_joined', 'patient_joined', 'in_progress', 'paused'] },
    'agora.tokenExpiresAt': { $lt: fiveMinFromNow },
    consultationType: { $in: ['video', 'audio'] },
  }).select('_id');

  let count = 0;
  for (const c of consultations) {
    try {
      await refreshConsultationTokens(c._id.toString(), null);
      count++;
    } catch (err) {
      console.error(`[runTokenRefresh] failed for ${c._id}:`, err.message);
    }
  }
  return { refreshed: count };
};

export const runReminders = async () => {
  const now    = new Date();
  const in15   = new Date(now.getTime() + 15 * 60 * 1000);
  const in20   = new Date(now.getTime() + 20 * 60 * 1000);

  const upcoming = await Consultation.find({
    status: 'scheduled',
    scheduledAt: { $gte: in15, $lte: in20 },
    'notificationsSent.reminderPatient15min': false,
  }).select('_id patient doctorUser booking notificationsSent');

  let count = 0;
  for (const c of upcoming) {
    try {
      await Promise.allSettled([
        pushNotification({
          recipientId:    c.patient,
          title:          'Consultation in 15 minutes',
          body:           'Your consultation starts soon. Please be ready.',
          type:           'Appointment_Reminder',
          relatedEntityId:c.booking,
          deepLink:       { screen: 'ConsultationDetail', referenceId: c._id },
        }),
        pushNotification({
          recipientId:    c.doctorUser,
          title:          'Consultation in 15 minutes',
          body:           'You have a consultation starting soon.',
          type:           'Appointment_Reminder',
          relatedEntityId:c.booking,
          deepLink:       { screen: 'DoctorConsultationDetail', referenceId: c._id },
        }),
      ]);
      c.notificationsSent.reminderPatient15min = true;
      c.notificationsSent.reminderDoctor15min  = true;
      await c.save();
      count++;
    } catch (err) {
      console.error(`[runReminders] failed for ${c._id}:`, err.message);
    }
  }
  return { sent: count };
};

export const runExpirePrescriptions = async () => {
  const result = await EPrescription.updateMany(
    { status: 'issued', expiresAt: { $lt: new Date() } },
    { $set: { status: 'expired' } }
  );
  return { expired: result.modifiedCount };
};

export const getScreenShareToken = async (consultationId, screenUid, userId, userRole) => {
  const c = await Consultation.findById(consultationId)
    .select('patient doctorUser agora status')
    .lean();

  if (!c) throw new Error('Consultation not found');
  if (!c.agora?.channelName) throw new Error('Agora channel not initialized for this consultation');

  if (userRole === 'patient' && c.patient.toString() !== userId) {
    throw new Error('You are not authorized to share screen in this consultation');
  }
  if (userRole === 'doctor' && c.doctorUser?.toString() !== userId) {
    throw new Error('You are not authorized to share screen in this consultation');
  }

  const token = generateAgoraToken(c.agora.channelName, Number(screenUid), 7200);
  return { token, uid: screenUid, channelName: c.agora.channelName };
};