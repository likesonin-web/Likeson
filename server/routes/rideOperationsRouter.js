/**
 * rideOperationsRouter.js — Likeson.in
 *
 * Routes for new standalone collections introduced in architecture redesign:
 *   - RideParticipant  (CA, nurse, escort, family, equipment-handler, doctor)
 *   - JoinPoint        (immutable once locked; chain-creates on recalc)
 *   - RideStop         (versioned stop sequence)
 *   - RouteVersion     (full route history per ride)
 *   - SosEvent         (standalone, never embedded)
 *   - DestinationChangeAudit (append-only admin audit)
 *   - AssignmentHistory (append-only, read-only from API)
 *
 * Mount at: /api/ride-ops
 */

import express from 'express';
import mongoose from 'mongoose';

import Ride                 from '../models/Ride.js';
import Booking              from '../models/Booking.js';
import RideTracking         from '../models/RideTracking.js';
import Driver               from '../models/Driver.js';
import SoloDriverPartner    from '../models/SoloDriverPartner.js';
import CareAssistantProfile from '../models/CareAssistantProfile.js';
import User                 from '../models/User.js';

import JoinPoint              from '../models/JoinPoint.js';
import RideStop               from '../models/RideStop.js';
import RideParticipant        from '../models/RideParticipant.js';
import AssignmentHistory      from '../models/AssignmentHistory.js';
import RouteVersion           from '../models/RouteVersion.js';
import DestinationChangeAudit from '../models/DestinationChangeAudit.js';
import SosEvent               from '../models/SosEvent.js';

import { protect, authorize }      from '../middleware/authMiddleware.js';
import { getBookingSocketService } from '../services/bookingSocketService.js';
import {
  createNotification,
  haversineKm,
  calculateCanonicalRoute,
} from './bookingRouterShared.js';
import {
  resolveCaJoinPoint,
  buildCaJoinWaypoint,
} from '../utils/careJoinPointUtils.js';

const router = express.Router();
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ═════════════════════════════════════════════════════════════════════════════
// RIDE PARTICIPANTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /ride-ops/rides/:rideId/participants
 * List active participants on a ride.
 */
router.get('/rides/:rideId/participants',
  protect,
  authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const ride = await Ride.findById(rideId).select('booking').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

      const participants = await RideParticipant.find({
        ride: rideId,
        isActive: true,
      }).lean();

      return res.json({ success: true, data: { participants } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * POST /ride-ops/rides/:rideId/participants
 * Admin assigns a participant (CA, nurse, escort, family, etc.) to a ride.
 * Creates RideParticipant + AssignmentHistory + attaches to RideTracking.
 *
 * Body: { role, refModel, refId, joinMode?, snapshot? }
 */
router.post('/rides/:rideId/participants',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const { role, refModel, refId, joinMode, snapshot } = req.body;

      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });
      if (!role)
        return res.status(400).json({ success: false, message: 'role required' });

      const ride = await Ride.findById(rideId).select('booking status trackingId').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

      // Deactivate existing active participant of same role (replacement flow)
      const existing = await RideParticipant.findOneAndUpdate(
        { ride: rideId, role, isActive: true },
        { $set: { isActive: false } },
        { new: true }
      ).lean();

      const participant = await RideParticipant.create({
        ride:                rideId,
        booking:             ride.booking,
        role,
        refModel:            refModel || null,
        refId:               refId || null,
        joinMode:            joinMode || 'NOT_JOINED',
        status:              'PENDING',
        isReplacement:       !!existing,
        replacesParticipant: existing?._id || null,
        snapshot:            snapshot || {},
        assignedBy:          req.user._id,
      });

      // AssignmentHistory record
      await AssignmentHistory.create({
        ride:           rideId,
        booking:        ride.booking,
        assignmentType: 'PARTICIPANT',
        entityRefModel: refModel || 'RideParticipant',
        entityRefId:    refId || participant._id,
        action:         existing ? 'REPLACED' : 'ASSIGNED',
        previousAssignmentId: existing?._id || null,
        performedBy:    req.user._id,
        reason:         req.body.reason || null,
        effectiveAt:    new Date(),
      });

      // Attach to RideTracking participants array
      if (ride.trackingId) {
        await RideTracking.attachParticipant(rideId, {
          participantId: participant._id,
          role,
        }).catch(e => console.error('[assignParticipant] tracking attach:', e.message));

        if (existing?._id) {
          await RideTracking.deactivateParticipant(rideId, existing._id)
            .catch(e => console.error('[assignParticipant] deactivate old:', e.message));
        }
      }

      // Notify participant's user if refId resolves to a User
      if (refId && refModel === 'CareAssistantProfile') {
        const ca = await CareAssistantProfile.findById(refId).select('user').lean();
        if (ca?.user) {
          await createNotification({
            recipient: ca.user,
            title:     'Assigned to Ride',
            body:      `You have been assigned as ${role} on ride.`,
            type:      'Care_Assistant_Assigned',
            bookingId: ride.booking,
          });
          getBookingSocketService()?.emitJoinRoom(String(ca.user), `booking:${ride.booking}`);
        }
      }

      getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'participant_assigned', {
        rideId,
        bookingId:     String(ride.booking),
        participantId: participant._id,
        role,
        isReplacement: participant.isReplacement,
        timestamp:     new Date().toISOString(),
      });

      return res.status(201).json({ success: true, message: 'Participant assigned', data: { participant } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /ride-ops/rides/:rideId/participants/:participantId/status
 * Participant updates their own status (EN_ROUTE → AT_JOIN_POINT → IN_VEHICLE, etc.)
 * Admins can update any participant.
 *
 * Body: { status, lat?, lng? }
 */
router.patch('/rides/:rideId/participants/:participantId/status',
  protect,
  authorize('admin', 'superadmin', 'care_assistant'),
  async (req, res) => {
    try {
      const { rideId, participantId } = req.params;
      const { status, lat, lng } = req.body;

      if (!isValidId(rideId) || !isValidId(participantId))
        return res.status(400).json({ success: false, message: 'Invalid id' });
      if (!status)
        return res.status(400).json({ success: false, message: 'status required' });

      const participant = await RideParticipant.findOne({ _id: participantId, ride: rideId, isActive: true });
      if (!participant) return res.status(404).json({ success: false, message: 'Participant not found' });

      // CA can only update their own participant record
      if (req.user.role === 'care_assistant') {
        const ca = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
        if (!ca || String(participant.refId) !== String(ca._id))
          return res.status(403).json({ success: false, message: 'Not your participant record' });
      }

      participant.status = status;
      if (status === 'IN_VEHICLE' && !participant.joinedAt)  participant.joinedAt  = new Date();
      if (status === 'DEPARTED'   && !participant.departedAt) participant.departedAt = new Date();
      await participant.save();

      // Update RideTracking participant status
      const ride = await Ride.findById(rideId).select('booking trackingId').lean();
      if (ride?.trackingId) {
        await RideTracking.updateParticipantStatus(rideId, participantId, status)
          .catch(e => console.error('[participantStatus] tracking update:', e.message));

        if (lat && lng) {
          await RideTracking.updateParticipantLocation(rideId, participantId, {
            coordinates: [lng, lat], source: 'gps',
          }).catch(() => {});
        }
      }

      getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'participant_status_change', {
        rideId, participantId, role: participant.role, status,
        location: (lat && lng) ? { lat, lng } : null,
        timestamp: new Date().toISOString(),
      });

      return res.json({ success: true, message: `Status updated to ${status}`, data: { participant } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// JOIN POINTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /ride-ops/admin/bookings/:bookingId/join-point
 * Admin calculates + locks CA join point on active ride.
 * Creates JoinPoint doc (immutable once locked).
 * Also creates/updates currentStopId on Ride for CARE_ASSISTANT_JOIN stop.
 *
 * Body: { careAssistantId, caCurrentLat, caCurrentLng }
 */
router.post('/admin/bookings/:bookingId/join-point',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { careAssistantId, caCurrentLat, caCurrentLng } = req.body;

      if (!isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });
      if (!careAssistantId || !caCurrentLat || !caCurrentLng)
        return res.status(400).json({ success: false, message: 'careAssistantId, caCurrentLat, caCurrentLng required' });

      const booking = await Booking.findById(bookingId).select('_id bookingType primaryRide careAssistant').lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (booking.bookingType !== 'full_care_ride')
        return res.status(400).json({ success: false, message: 'Join point only for full_care_ride' });
      if (!booking.primaryRide)
        return res.status(400).json({ success: false, message: 'No primary ride on booking' });

      const ride = await Ride.findById(booking.primaryRide)
        .select('pickup dropoff liveLocation status trackingId activeRouteVersionId').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

      const tracking = ride.trackingId
        ? await RideTracking.findById(ride.trackingId).select('expectedRoutePolyline').lean()
        : null;

      const caCoords     = [caCurrentLng, caCurrentLat];
      const driverCoords = ride.liveLocation?.coordinates || ride.pickup?.coordinates || [80.648, 16.506];
      const pickupCoords  = ride.pickup?.coordinates;
      const dropoffCoords = ride.dropoff?.coordinates;

      const joinResult = resolveCaJoinPoint({
        caCoords,
        driverCoords,
        pickupCoords,
        dropoffCoords,
        encodedPolyline: tracking?.expectedRoutePolyline || null,
      });

      // Find active RideParticipant for this CA
      const ca = await CareAssistantProfile.findById(careAssistantId).select('_id user').lean();
      if (!ca) return res.status(404).json({ success: false, message: 'CareAssistant not found' });

      let participant = await RideParticipant.findOne({
        ride: booking.primaryRide, role: 'CARE_ASSISTANT', isActive: true,
      }).lean();

      if (!participant) {
        // Create participant if not yet created (backwards compat)
        participant = await RideParticipant.create({
          ride:     booking.primaryRide,
          booking:  bookingId,
          role:     'CARE_ASSISTANT',
          refModel: 'CareAssistantProfile',
          refId:    careAssistantId,
          snapshot: { name: ca.user?.name || '' },
          assignedBy: req.user._id,
        });
      }

      // Deactivate previous active join point for this participant on this ride
      await JoinPoint.updateMany(
        { ride: booking.primaryRide, participant: participant._id, isActive: true },
        { $set: { isActive: false, supersededBy: null } }
      );

      // Get current attempt number
      const lastJp = await JoinPoint.findOne(
        { ride: booking.primaryRide, participant: participant._id },
        {},
        { sort: { attemptNumber: -1 } }
      ).lean();
      const attemptNumber = (lastJp?.attemptNumber || 0) + 1;

      const jp = await JoinPoint.create({
        ride:        booking.primaryRide,
        booking:     bookingId,
        participant: participant._id,
        location: {
          type:        'Point',
          coordinates: joinResult.joinPoint,
        },
        calculatedBy: 'routing_engine',
        calculationMeta: {
          distanceFromParticipantKm: joinResult.distCaToJoinKm,
          distanceFromDriverKm:      haversineKm(driverCoords, joinResult.joinPoint),
          routingEngineVersion:      '1.0',
        },
        status:        'LOCKED',
        attemptNumber,
        lockedAt:      new Date(),
        createdBy:     req.user._id,
      });

      // Create/update CARE_ASSISTANT_JOIN RideStop for current route version
      const activeVersion = ride.activeRouteVersionId
        ? await RouteVersion.findById(ride.activeRouteVersionId).select('versionNumber stops').lean()
        : null;

      if (activeVersion) {
        // Find existing CA join stop for this version
        const existingStop = await RideStop.findOne({
          ride:         booking.primaryRide,
          routeVersion: activeVersion.versionNumber,
          stopType:     'CARE_ASSISTANT_JOIN',
          isActive:     true,
        });

        if (existingStop) {
          // Deactivate old, create new
          existingStop.isActive = false;
          await existingStop.save();
        }

        // Insert CA join stop before PATIENT_PICKUP (sequence 1) or after (sequence 2) based on zone
        const caStopSequence = joinResult.zone === 'before_pickup' ? 1 : 2;

        // Shift existing stops to make room
        await RideStop.updateMany(
          {
            ride:         booking.primaryRide,
            routeVersion: activeVersion.versionNumber,
            sequence:     { $gte: caStopSequence },
            isActive:     true,
          },
          { $inc: { sequence: 1 } }
        );

        const caStop = await RideStop.create({
          ride:         booking.primaryRide,
          booking:      bookingId,
          routeVersion: activeVersion.versionNumber,
          sequence:     caStopSequence,
          stopType:     'CARE_ASSISTANT_JOIN',
          location: {
            type:        'Point',
            coordinates: joinResult.joinPoint,
            address:     joinResult.joinPointAddress || 'Care Assistant Join Point',
            label:       `CA Join — ${joinResult.zone}`,
          },
          participant: participant._id,
          status:      'PENDING',
          meta: {
            zone:          joinResult.zone,
            distCaToJoinKm: joinResult.distCaToJoinKm,
            caFrom:        caCoords,
          },
        });

        // Update Ride.currentStopId to point at CA join stop
        await Ride.findByIdAndUpdate(booking.primaryRide, {
          $set: { currentStopId: caStop._id },
        });

        // Sync RideTracking currentStopId
        if (ride.trackingId) {
          await RideTracking.findByIdAndUpdate(ride.trackingId, {
            $set: { currentStopId: caStop._id },
          });
        }
      }

      getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'join_point_calculated', {
        bookingId,
        rideId:        String(booking.primaryRide),
        joinPointId:   jp._id,
        participantId: participant._id,
        location:      { coordinates: joinResult.joinPoint },
        zone:          joinResult.zone,
        distCaToJoinKm: joinResult.distCaToJoinKm,
        attemptNumber,
        timestamp:     new Date().toISOString(),
      });

      return res.status(201).json({
        success: true,
        message: 'Join point calculated and locked',
        data: {
          joinPoint: jp,
          zone:          joinResult.zone,
          distCaToJoinKm: joinResult.distCaToJoinKm,
          caRoute:       joinResult.caRoute,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /ride-ops/rides/:rideId/join-points
 * List join points for a ride (all attempts, for audit).
 */
router.get('/rides/:rideId/join-points',
  protect,
  authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const jps = await JoinPoint.find({ ride: rideId })
        .sort({ attemptNumber: 1 })
        .lean();

      return res.json({ success: true, data: { joinPoints: jps } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /ride-ops/rides/:rideId/join-points/:jpId/status
 * CA marks arrived at join point. Driver marks completed (picked up CA).
 * Missed → triggers new join point calculation attempt.
 *
 * Body: { status: 'ARRIVED' | 'COMPLETED' | 'MISSED' | 'SKIPPED', lat?, lng? }
 */
router.patch('/rides/:rideId/join-points/:jpId/status',
  protect,
  authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant'),
  async (req, res) => {
    try {
      const { rideId, jpId } = req.params;
      const { status, lat, lng } = req.body;

      if (!isValidId(rideId) || !isValidId(jpId))
        return res.status(400).json({ success: false, message: 'Invalid id' });

      const validStatuses = ['ARRIVED', 'COMPLETED', 'MISSED', 'SKIPPED'];
      if (!validStatuses.includes(status))
        return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });

      const jp = await JoinPoint.findOne({ _id: jpId, ride: rideId, isActive: true });
      if (!jp) return res.status(404).json({ success: false, message: 'JoinPoint not found or already superseded' });
      if (jp.status === 'COMPLETED')
        return res.status(400).json({ success: false, message: 'JoinPoint already completed' });

      jp.status = status;
      if (status === 'ARRIVED')   jp.arrivedAt   = new Date();
      if (status === 'COMPLETED') jp.completedAt = new Date();
      if (status === 'MISSED')    jp.missedAt    = new Date();
      if (status === 'SKIPPED')   jp.skippedAt   = new Date();
      await jp.save();

      const ride = await Ride.findById(rideId).select('booking currentStopId trackingId').lean();

      // Update corresponding RideStop
      const rideStop = await RideStop.findOne({
        ride: rideId, stopType: 'CARE_ASSISTANT_JOIN', isActive: true, status: 'PENDING',
      });
      if (rideStop) {
        const stopStatusMap = { ARRIVED: 'ARRIVED', COMPLETED: 'COMPLETED', MISSED: 'MISSED', SKIPPED: 'SKIPPED' };
        rideStop.status = stopStatusMap[status];
        if (status === 'ARRIVED')   rideStop.arrival.actualAt   = new Date();
        if (status === 'COMPLETED') rideStop.departure.actualAt = new Date();
        await rideStop.save();
      }

      // Update participant status in RideTracking
      if (ride?.trackingId) {
        const ptStatusMap = { ARRIVED: 'AT_JOIN_POINT', COMPLETED: 'IN_VEHICLE', MISSED: 'not_joined', SKIPPED: 'not_joined' };
        await RideTracking.updateParticipantStatus(rideId, jp.participant, ptStatusMap[status])
          .catch(() => {});

        if (lat && lng) {
          await RideTracking.updateParticipantLocation(rideId, jp.participant, {
            coordinates: [lng, lat], source: 'gps',
          }).catch(() => {});
        }
      }

      // Emit
      getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'join_point_status_changed', {
        rideId, jpId, status,
        location: (lat && lng) ? { lat, lng } : null,
        timestamp: new Date().toISOString(),
      });

      // MISSED: notify admin to recalculate
      if (status === 'MISSED') {
        getBookingSocketService()?.emitToAdminOps('join_point_missed', {
          bookingId: String(ride.booking), rideId, jpId,
          participantId: jp.participant, attemptNumber: jp.attemptNumber,
          note: 'Recalculate join point or direct CA to hospital',
          timestamp: new Date().toISOString(),
        });
      }

      return res.json({ success: true, message: `JoinPoint ${status}`, data: { joinPoint: jp } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// RIDE STOPS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /ride-ops/rides/:rideId/stops
 * List stops for active route version.
 */
router.get('/rides/:rideId/stops',
  protect,
  authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const ride = await Ride.findById(rideId).select('activeRouteVersionId').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });

      let query = { ride: rideId, isActive: true };

      // If active route version known, filter to it
      if (ride.activeRouteVersionId) {
        const rv = await RouteVersion.findById(ride.activeRouteVersionId).select('versionNumber').lean();
        if (rv) query.routeVersion = rv.versionNumber;
      }

      const stops = await RideStop.find(query).sort({ sequence: 1 }).lean();

      return res.json({ success: true, data: { stops } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /ride-ops/rides/:rideId/stops/:stopId/otp
 * Verify OTP at a stop.
 * Body: { otp }
 */
router.patch('/rides/:rideId/stops/:stopId/otp',
  protect,
  authorize('driver', 'solodriverpartner', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId, stopId } = req.params;
      const { otp } = req.body;

      if (!isValidId(rideId) || !isValidId(stopId))
        return res.status(400).json({ success: false, message: 'Invalid id' });
      if (!otp)
        return res.status(400).json({ success: false, message: 'otp required' });

      const stop = await RideStop.findOne({ _id: stopId, ride: rideId, isActive: true })
        .select('+otp.code').lean();
      if (!stop) return res.status(404).json({ success: false, message: 'Stop not found' });
      if (!stop.otp?.code)
        return res.status(400).json({ success: false, message: 'No OTP set for this stop' });

      const { hashOtp } = await import('./bookingRouterShared.js');
      if (hashOtp(String(otp).trim()) !== String(stop.otp.code).trim())
        return res.status(400).json({ success: false, message: 'Invalid OTP' });

      await RideStop.findByIdAndUpdate(stopId, {
        $set: { 'otp.verifiedAt': new Date() },
      });

      const ride = await Ride.findById(rideId).select('booking').lean();
      getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'stop_otp_verified', {
        rideId, stopId, stopType: stop.stopType, timestamp: new Date().toISOString(),
      });

      return res.json({ success: true, message: 'OTP verified', data: { stopType: stop.stopType } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /ride-ops/rides/:rideId/stops/:stopId/status
 * Driver marks stop arrived/completed/skipped.
 * Body: { status: 'ARRIVED' | 'COMPLETED' | 'SKIPPED', lat?, lng? }
 */
router.patch('/rides/:rideId/stops/:stopId/status',
  protect,
  authorize('driver', 'solodriverpartner', 'admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId, stopId } = req.params;
      const { status, lat, lng } = req.body;

      const validStatuses = ['ARRIVED', 'COMPLETED', 'SKIPPED', 'MISSED'];
      if (!validStatuses.includes(status))
        return res.status(400).json({ success: false, message: `status must be one of: ${validStatuses.join(', ')}` });

      const stop = await RideStop.findOne({ _id: stopId, ride: rideId, isActive: true });
      if (!stop) return res.status(404).json({ success: false, message: 'Stop not found' });

      stop.status = status;
      if (status === 'ARRIVED')   stop.arrival.actualAt   = new Date();
      if (status === 'COMPLETED') stop.departure.actualAt = new Date();
      await stop.save();

      const ride = await Ride.findById(rideId).select('booking currentStopId').lean();

      // Advance currentStopId to next pending stop
      if (status === 'COMPLETED') {
        const nextStop = await RideStop.findOne({
          ride: rideId, isActive: true, status: 'PENDING', sequence: { $gt: stop.sequence },
        }).sort({ sequence: 1 }).lean();

        if (nextStop) {
          await Ride.findByIdAndUpdate(rideId, { $set: { currentStopId: nextStop._id } });
          const tracking = await RideTracking.findOne({ ride: rideId }).select('_id').lean();
          if (tracking) {
            await RideTracking.findByIdAndUpdate(tracking._id, { $set: { currentStopId: nextStop._id } });
          }
        }
      }

      getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'stop_status_changed', {
        rideId, stopId, stopType: stop.stopType, status,
        location: (lat && lng) ? { lat, lng } : null,
        timestamp: new Date().toISOString(),
      });

      return res.json({ success: true, message: `Stop ${status}`, data: { stop } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ROUTE VERSIONS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET /ride-ops/rides/:rideId/route-versions
 * Full route history for a ride.
 */
router.get('/rides/:rideId/route-versions',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const versions = await RouteVersion.find({ ride: rideId })
        .sort({ versionNumber: 1 })
        .lean();

      return res.json({ success: true, data: { versions } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// SOS EVENTS
// ═════════════════════════════════════════════════════════════════════════════

/**
 * POST /ride-ops/bookings/:bookingId/sos
 * Trigger SOS. Any participant can initiate.
 * Body: { sosType, description?, lat?, lng?, rideId? }
 */
router.post('/bookings/:bookingId/sos',
  protect,
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { sosType, description, lat, lng, rideId } = req.body;

      if (!isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });
      if (!sosType)
        return res.status(400).json({ success: false, message: 'sosType required' });

      const booking = await Booking.findById(bookingId)
        .select('customer careAssistant primaryRide bookingCode')
        .lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

      // Determine triggeredByRole
      const role = req.user.role;
      const roleTriggerMap = {
        customer:         'PATIENT',
        driver:           'DRIVER',
        solodriverpartner:'DRIVER',
        care_assistant:   'CARE_ASSISTANT',
        admin:            'ADMIN',
        superadmin:       'ADMIN',
      };
      const triggeredByRole = roleTriggerMap[role] || 'PATIENT';

      // Snapshot current ride state
      const activeRideId = rideId || booking.primaryRide;
      const activeRide = activeRideId
        ? await Ride.findById(activeRideId).select('status liveLocation driver').lean()
        : null;

      const sos = await SosEvent.create({
        ride:              activeRideId || null,
        booking:           bookingId,
        triggeredByRole,
        triggeredByUserId: req.user._id,
        sosType,
        description:       description || null,
        snapshot: {
          coordinates:  (lat && lng) ? [lng, lat] : (activeRide?.liveLocation?.coordinates || []),
          driver:        activeRide?.driver || null,
          careAssistant: booking.careAssistant || null,
          rideStatus:    activeRide?.status || null,
          capturedAt:    new Date(),
        },
        notifiedParties: [],
        isResolved: false,
      });

      // Sync hasActiveSos flag on RideTracking
      if (activeRideId) {
        await RideTracking.syncSosFlag(activeRideId, true).catch(() => {});
      }

      // Build notified parties list
      const notifiedParties = [];

      // Always notify admins
      getBookingSocketService()?.emitToAdmins('sos_triggered', {
        bookingId,
        bookingCode: booking.bookingCode,
        sosId:       sos._id,
        sosType,
        triggeredByRole,
        rideId:      activeRideId,
        location:    (lat && lng) ? { lat, lng } : null,
        description: description || null,
        timestamp:   new Date().toISOString(),
      });
      notifiedParties.push({ party: 'ADMIN', notifiedAt: new Date(), channel: 'socket' });

      // Notify booking room participants
      getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'sos_alert', {
        bookingId,
        sosId:       sos._id,
        sosType,
        triggeredByRole,
        location:    (lat && lng) ? { lat, lng } : null,
        timestamp:   new Date().toISOString(),
      });

      // Notify customer (if not the one who triggered)
      if (triggeredByRole !== 'PATIENT' && booking.customer) {
        await createNotification({
          recipient: booking.customer,
          title:     'SOS Alert',
          body:      `Emergency alert triggered: ${sosType}`,
          type:      'SOS',
          bookingId: booking._id,
          priority:  'High',
        });
        notifiedParties.push({ party: 'CUSTOMER', notifiedAt: new Date(), channel: 'push' });
      }

      // Update notifiedParties on SosEvent
      await SosEvent.findByIdAndUpdate(sos._id, {
        $push: { notifiedParties: { $each: notifiedParties } },
      });

      return res.status(201).json({
        success: true,
        message: 'SOS triggered. Admins notified.',
        data: { sosId: sos._id, sosType, triggeredByRole },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /ride-ops/bookings/:bookingId/sos
 * List SOS events for a booking.
 */
router.get('/bookings/:bookingId/sos',
  protect,
  authorize('admin', 'superadmin', 'customer', 'driver', 'solodriverpartner', 'care_assistant'),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      if (!isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });

      const events = await SosEvent.find({ booking: bookingId })
        .sort({ createdAt: -1 })
        .lean();

      // Redact sensitive fields from non-admin
      const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
      const safeEvents = isAdmin ? events : events.map(e => ({
        _id:              e._id,
        sosType:          e.sosType,
        triggeredByRole:  e.triggeredByRole,
        isResolved:       e.isResolved,
        resolvedAt:       e.resolvedAt,
        createdAt:        e.createdAt,
      }));

      return res.json({ success: true, data: { events: safeEvents } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * PATCH /ride-ops/sos/:sosId/resolve
 * Admin resolves SOS event.
 * Body: { resolutionNotes }
 */
router.patch('/sos/:sosId/resolve',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { sosId } = req.params;
      const { resolutionNotes } = req.body;

      if (!isValidId(sosId))
        return res.status(400).json({ success: false, message: 'Invalid sosId' });

      const sos = await SosEvent.findById(sosId);
      if (!sos) return res.status(404).json({ success: false, message: 'SosEvent not found' });
      if (sos.isResolved)
        return res.status(400).json({ success: false, message: 'SOS already resolved' });

      sos.isResolved       = true;
      sos.resolvedAt       = new Date();
      sos.resolvedBy       = req.user._id;
      sos.resolutionNotes  = resolutionNotes || null;
      await sos.save();

      // Check if any other active SOS on same ride; if none, clear flag
      if (sos.ride) {
        const activeSos = await SosEvent.exists({ ride: sos.ride, isResolved: false });
        if (!activeSos) {
          await RideTracking.syncSosFlag(sos.ride, false).catch(() => {});
        }
      }

      getBookingSocketService()?.emitToRoom(`booking:${sos.booking}`, 'sos_resolved', {
        bookingId:       String(sos.booking),
        sosId,
        resolvedAt:      sos.resolvedAt,
        resolutionNotes: resolutionNotes || null,
        timestamp:       new Date().toISOString(),
      });

      return res.json({ success: true, message: 'SOS resolved', data: { sos } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// DESTINATION CHANGE AUDIT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * PATCH /ride-ops/admin/bookings/:bookingId/destination
 * Admin changes destination after driver acceptance.
 * Writes DestinationChangeAudit, creates new RouteVersion, updates Booking.
 *
 * Body: { newLng, newLat, newAddress, reason }
 */
router.patch('/admin/bookings/:bookingId/destination',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { newLng, newLat, newAddress, reason } = req.body;

      if (!isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });
      if (!newLng || !newLat || !reason)
        return res.status(400).json({ success: false, message: 'newLng, newLat, reason required' });

      const booking = await Booking.findById(bookingId).select('+destinationLocation primaryRide destinationLockedAt');
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (!booking.destinationLockedAt)
        return res.status(400).json({ success: false, message: 'Destination not yet locked (driver not accepted)' });

      const oldDestination = {
        type:        'Point',
        coordinates: booking.destinationLocation?.coordinates || [0, 0],
        address:     booking.destinationLocation?.address || '',
      };
      const newDestination = {
        type:        'Point',
        coordinates: [newLng, newLat],
        address:     newAddress || '',
      };

      // Create audit record FIRST (before mutation)
      const audit = await DestinationChangeAudit.create({
        booking:        bookingId,
        ride:           booking.primaryRide || null,
        oldDestination,
        newDestination,
        changedBy:      req.user._id,
        reason,
        routeVersion:   null, // will update after new route version created
      });

      // Use admin-override flag to bypass Booking schema immutability guard
      booking._isAdminOverride = true;
      booking.destinationLocation = newDestination;
      booking.updatedBy = req.user._id;
      await booking.save();

      let newRouteVersion = null;

      // Recalculate route and create new RouteVersion if ride exists
      if (booking.primaryRide) {
        const ride = await Ride.findById(booking.primaryRide)
          .select('pickup activeRouteVersionId trackingId status').lean();

        if (ride && ride.status !== 'completed' && ride.status !== 'cancelled') {
          const { distanceKm, durationMin, polyline } = await calculateCanonicalRoute(
            ride.pickup?.coordinates,
            [newLng, newLat],
          );

          // Deactivate current active version
          await RouteVersion.updateMany(
            { ride: booking.primaryRide, isActive: true },
            { $set: { isActive: false, supersededAt: new Date() } }
          );

          const lastVersion = await RouteVersion.findOne(
            { ride: booking.primaryRide },
            {},
            { sort: { versionNumber: -1 } }
          ).lean();

          newRouteVersion = await RouteVersion.create({
            ride:             booking.primaryRide,
            versionNumber:    (lastVersion?.versionNumber || 0) + 1,
            polyline,
            totalDistanceKm:  distanceKm,
            totalDurationMin: durationMin,
            generatedReason:  'DESTINATION_CHANGE',
            generatedBy:      req.user._id,
            isActive:         true,
          });

          // Update ride dropoff
          await Ride.findByIdAndUpdate(booking.primaryRide, {
            $set: {
              'dropoff.coordinates': [newLng, newLat],
              'dropoff.address':     newAddress || '',
              activeRouteVersionId:  newRouteVersion._id,
              estimatedDistanceKm:   distanceKm,
              estimatedDurationMin:  durationMin,
            },
          });

          // Update RideTracking polyline
          if (ride.trackingId) {
            await RideTracking.findByIdAndUpdate(ride.trackingId, {
              $set: { expectedRoutePolyline: polyline },
            });
          }

          // Deactivate old HOSPITAL stop, create new one
          await RideStop.updateMany(
            { ride: booking.primaryRide, stopType: 'HOSPITAL', isActive: true },
            { $set: { isActive: false } }
          );

          const hospitalStop = await RideStop.findOne(
            { ride: booking.primaryRide, isActive: true },
            {},
            { sort: { sequence: -1 } }
          ).lean();
          const newHospSeq = (hospitalStop?.sequence || 0) + 1;

          await RideStop.create({
            ride:         booking.primaryRide,
            booking:      bookingId,
            routeVersion: newRouteVersion.versionNumber,
            sequence:     newHospSeq,
            stopType:     'HOSPITAL',
            location: {
              type:        'Point',
              coordinates: [newLng, newLat],
              address:     newAddress || '',
              label:       'Destination',
            },
            status: 'PENDING',
          });

          // Link audit → new route version
          await DestinationChangeAudit.findByIdAndUpdate(audit._id, {
            $set: { routeVersion: newRouteVersion._id },
          });
        }
      }

      getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'destination_changed', {
        bookingId,
        oldDestination,
        newDestination,
        reason,
        changedBy:     req.user._id,
        routeVersion:  newRouteVersion ? { id: newRouteVersion._id, number: newRouteVersion.versionNumber } : null,
        timestamp:     new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: 'Destination changed and route recalculated',
        data: { audit, newRouteVersion },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /ride-ops/admin/bookings/:bookingId/destination-history
 * Full destination change audit trail.
 */
router.get('/admin/bookings/:bookingId/destination-history',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      if (!isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });

      const history = await DestinationChangeAudit.find({ booking: bookingId })
        .populate('changedBy', 'name role')
        .sort({ changedAt: -1 })
        .lean();

      return res.json({ success: true, data: { history } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT HISTORY
// ═════════════════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════════════════
// VEHICLE REPLACEMENT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * PATCH /ride-ops/admin/rides/:rideId/replace-vehicle
 * Spec: "Administrator may: ... Replace Vehicle." — previously the only
 * admin authority item with zero implementing route anywhere in the codebase.
 * Body: { newVehicleId, reason }
 */
router.patch('/admin/rides/:rideId/replace-vehicle',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const { newVehicleId, reason } = req.body;

      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });
      if (!newVehicleId || !isValidId(newVehicleId))
        return res.status(400).json({ success: false, message: 'newVehicleId required' });
      if (!reason)
        return res.status(400).json({ success: false, message: 'reason required for vehicle replacement' });

      const ride = await Ride.findById(rideId);
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (['completed', 'cancelled'].includes(ride.status))
        return res.status(400).json({ success: false, message: `Cannot replace vehicle on ${ride.status} ride` });

      const Vehicle = mongoose.model('Vehicle');
      const vehicle = await Vehicle.findById(newVehicleId).lean();
      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      if (vehicle.status !== 'active' || vehicle.verificationStatus !== 'verified')
        return res.status(400).json({ success: false, message: 'Vehicle not active/verified' });

      const oldVehicleSnapshot = ride.vehicleSnapshot;

      ride.assignedVehicleId = vehicle._id;
      ride.vehicleSnapshot = {
        vehicleCode:            vehicle.vehicleCode,
        registrationNumber:     vehicle.registrationNumber,
        make:                   vehicle.make,
        model:                  vehicle.model,
        color:                  vehicle.color,
        vehicleType:            vehicle.vehicleType,
        vehicleClass:           ride.vehicleSnapshot?.vehicleClass,
        seatingCapacity:        vehicle.seatingCapacity,
        isWheelchairAccessible: vehicle.isWheelchairAccessible,
        hasStretcherSupport:    vehicle.hasStretcherSupport,
        hasOxygenSupport:       vehicle.hasOxygenSupport,
        hasAC:                  vehicle.hasAC,
      };
      ride.updatedBy = req.user._id;
      await ride.save();

      await AssignmentHistory.create({
        ride: rideId,
        booking: ride.booking,
        assignmentType: 'VEHICLE',
        entityRefModel: 'Vehicle',
        entityRefId: newVehicleId,
        action: 'REPLACED',
        performedBy: req.user._id,
        reason,
        effectiveAt: new Date(),
      });

      getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'vehicle_replaced', {
        rideId, bookingId: String(ride.booking),
        oldVehicle: oldVehicleSnapshot, newVehicle: ride.vehicleSnapshot,
        reason, timestamp: new Date().toISOString(),
      });

      return res.json({ success: true, message: 'Vehicle replaced', data: { ride } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
// ═════════════════════════════════════════════════════════════════════════════
// VEHICLE REPLACEMENT
// ═════════════════════════════════════════════════════════════════════════════

/**
 * PATCH /ride-ops/admin/rides/:rideId/replace-vehicle
 * Spec: "Administrator may: ... Replace Vehicle." — previously the only
 * admin authority item with zero implementing route anywhere in the codebase.
 * Body: { newVehicleId, reason }
 */
router.patch('/admin/rides/:rideId/replace-vehicle',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      const { newVehicleId, reason } = req.body;

      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });
      if (!newVehicleId || !isValidId(newVehicleId))
        return res.status(400).json({ success: false, message: 'newVehicleId required' });
      if (!reason)
        return res.status(400).json({ success: false, message: 'reason required for vehicle replacement' });

      const ride = await Ride.findById(rideId);
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (['completed', 'cancelled'].includes(ride.status))
        return res.status(400).json({ success: false, message: `Cannot replace vehicle on ${ride.status} ride` });

      const Vehicle = mongoose.model('Vehicle');
      const vehicle = await Vehicle.findById(newVehicleId).lean();
      if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
      if (vehicle.status !== 'active' || vehicle.verificationStatus !== 'verified')
        return res.status(400).json({ success: false, message: 'Vehicle not active/verified' });

      const oldVehicleSnapshot = ride.vehicleSnapshot;

      ride.assignedVehicleId = vehicle._id;
      ride.vehicleSnapshot = {
        vehicleCode:            vehicle.vehicleCode,
        registrationNumber:     vehicle.registrationNumber,
        make:                   vehicle.make,
        model:                  vehicle.model,
        color:                  vehicle.color,
        vehicleType:            vehicle.vehicleType,
        vehicleClass:           ride.vehicleSnapshot?.vehicleClass,
        seatingCapacity:        vehicle.seatingCapacity,
        isWheelchairAccessible: vehicle.isWheelchairAccessible,
        hasStretcherSupport:    vehicle.hasStretcherSupport,
        hasOxygenSupport:       vehicle.hasOxygenSupport,
        hasAC:                  vehicle.hasAC,
      };
      ride.updatedBy = req.user._id;
      await ride.save();

      await AssignmentHistory.create({
        ride: rideId,
        booking: ride.booking,
        assignmentType: 'VEHICLE',
        entityRefModel: 'Vehicle',
        entityRefId: newVehicleId,
        action: 'REPLACED',
        performedBy: req.user._id,
        reason,
        effectiveAt: new Date(),
      });

      getBookingSocketService()?.emitToRoom(`booking:${ride.booking}`, 'vehicle_replaced', {
        rideId, bookingId: String(ride.booking),
        oldVehicle: oldVehicleSnapshot, newVehicle: ride.vehicleSnapshot,
        reason, timestamp: new Date().toISOString(),
      });

      return res.json({ success: true, message: 'Vehicle replaced', data: { ride } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// ASSIGNMENT HISTORY
// ═════════════════════════════════════════════════════════════════════════════
/**
 * GET /ride-ops/rides/:rideId/assignment-history
 * Full assignment audit trail for a ride.
 */
router.get('/rides/:rideId/assignment-history',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });

      const history = await AssignmentHistory.find({ ride: rideId })
        .populate('performedBy', 'name role')
        .sort({ createdAt: 1 })
        .lean();

      return res.json({ success: true, data: { history } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /ride-ops/bookings/:bookingId/status-history
 * Permanent, uncapped status transition log — the source of truth behind
 * Booking.statusLog's bounded 20-entry UI cache. Closes the read-side gap
 * for "every important business event must be traceable."
 */
router.get('/bookings/:bookingId/status-history',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      if (!isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });

      const BookingStatusEvent = mongoose.model('BookingStatusEvent');
      const history = await BookingStatusEvent.find({ booking: bookingId })
        .populate('changedBy', 'name role')
        .sort({ changedAt: 1 })
        .lean();

      return res.json({ success: true, data: { history, total: history.length } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

/**
 * GET /ride-ops/bookings/:bookingId/assignment-history
 * Assignment history keyed by booking (covers multi-ride bookings).
 */
router.get('/bookings/:bookingId/assignment-history',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      if (!isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });

      const history = await AssignmentHistory.find({ booking: bookingId })
        .populate('performedBy', 'name role')
        .sort({ createdAt: 1 })
        .lean();

      return res.json({ success: true, data: { history } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);



router.get('/admin/sos/active',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { sosType, page = 1, limit = 20 } = req.query;
      const filter = { isResolved: false };
      if (sosType) filter.sosType = sosType;
 
      const skip = (parseInt(page) - 1) * parseInt(limit);
 
      const [events, total] = await Promise.all([
        SosEvent.find(filter)
          .populate('ride', 'status rideCode driverSnapshot vehicleSnapshot liveLocation currentStopId')
          .populate('booking', 'bookingCode bookingType patientInfo')
          .populate('triggeredByUserId', 'name phone role')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        SosEvent.countDocuments(filter),
      ]);
 
      return res.json({
        success: true,
        data: { events, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// GET /ride-ops/rides/:rideId/stops/:stopId
// Single stop — driver polls current stop details.
// ═════════════════════════════════════════════════════════════════════════════
 
router.get('/rides/:rideId/stops/:stopId',
  protect,
  authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'),
  async (req, res) => {
    try {
      const { rideId, stopId } = req.params;
      if (!isValidId(rideId) || !isValidId(stopId))
        return res.status(400).json({ success: false, message: 'Invalid rideId or stopId' });
 
      const ride = await Ride.findById(rideId).select('booking').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
 
      // Basic access: if can see ride, can see its stops
      const booking = ride.booking
        ? await Booking.findById(ride.booking).select('customer careAssistant transportPartner').lean()
        : null;
 
      const isAdmin = ['admin', 'superadmin'].includes(req.user.role);
      if (!isAdmin) {
        const uid = String(req.user._id);
        let allowed = false;
        if (req.user.role === 'customer' && booking?.customer?.toString() === uid) allowed = true;
        if (['driver', 'solodriverpartner'].includes(req.user.role)) {
          const dr = await Driver.findOne({ user: req.user._id }).select('_id').lean();
          if (dr) {
            const activeRide = await Ride.findOne({ _id: rideId, driver: dr._id }).select('_id').lean();
            if (activeRide) allowed = true;
          }
          if (!allowed) {
            const sp = await SoloDriverPartner.findOne({ user: req.user._id }).select('_id').lean();
            if (sp) {
              const soloRide = await Ride.findOne({ _id: rideId, soloPartner: sp._id }).select('_id').lean();
              if (soloRide) allowed = true;
            }
          }
        }
        if (req.user.role === 'care_assistant') {
          const ca = await CareAssistantProfile.findOne({ user: req.user._id }).select('_id').lean();
          if (ca && booking?.careAssistant?.toString() === ca._id.toString()) allowed = true;
          if (ca && !allowed) {
            const part = await RideParticipant.findOne({ ride: rideId, refId: ca._id, isActive: true }).select('_id').lean();
            if (part) allowed = true;
          }
        }
        if (!allowed)
          return res.status(403).json({ success: false, message: 'Access denied' });
      }
 
      const stop = await RideStop.findOne({ _id: stopId, ride: rideId, isActive: true }).lean();
      if (!stop) return res.status(404).json({ success: false, message: 'Stop not found' });
 
      return res.json({ success: true, data: { stop } });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// GET /ride-ops/rides/:rideId/participants/:participantId
// Single participant + live location from RideTracking.
// ═════════════════════════════════════════════════════════════════════════════
 
router.get('/rides/:rideId/participants/:participantId',
  protect,
  authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'),
  async (req, res) => {
    try {
      const { rideId, participantId } = req.params;
      if (!isValidId(rideId) || !isValidId(participantId))
        return res.status(400).json({ success: false, message: 'Invalid id' });
 
      const ride = await Ride.findById(rideId).select('booking').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
 
      const participant = await RideParticipant.findOne({ _id: participantId, ride: rideId }).lean();
      if (!participant) return res.status(404).json({ success: false, message: 'Participant not found' });
 
      // Get live location from RideTracking.participants[]
      const tracking = await RideTracking.findOne({ ride: rideId })
        .select('participants')
        .lean();
 
      const trackingEntry = tracking?.participants?.find(
        p => p.participantId?.toString() === participantId
      );
 
      const liveLocation = trackingEntry?.liveLocation?.coordinates?.length === 2
        ? {
            lat:      trackingEntry.liveLocation.coordinates[1],
            lng:      trackingEntry.liveLocation.coordinates[0],
            heading:  trackingEntry.liveLocation.heading  ?? 0,
            speedKmh: trackingEntry.liveLocation.speedKmh ?? 0,
            updatedAt: trackingEntry.liveLocation.updatedAt,
          }
        : null;
 
      return res.json({
        success: true,
        data: {
          participant,
          liveLocation,
          isTracked: !!trackingEntry,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// DELETE /ride-ops/rides/:rideId/participants/:participantId
// Admin soft-deletes (deactivates) participant — not a real DELETE, isActive=false.
// ═════════════════════════════════════════════════════════════════════════════
 
router.delete('/rides/:rideId/participants/:participantId',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { rideId, participantId } = req.params;
      const { reason } = req.body;
 
      if (!isValidId(rideId) || !isValidId(participantId))
        return res.status(400).json({ success: false, message: 'Invalid id' });
 
      const participant = await RideParticipant.findOne({ _id: participantId, ride: rideId, isActive: true });
      if (!participant) return res.status(404).json({ success: false, message: 'Participant not found or already inactive' });
 
      participant.isActive   = false;
      participant.departedAt = new Date();
      participant.status     = 'DEPARTED';
      if (reason) participant.replacementReason = reason;
      await participant.save();
 
      // Deactivate in RideTracking participants array
      await RideTracking.deactivateParticipant(rideId, participantId).catch(() => {});
 
      // AssignmentHistory — REMOVED action
      const ride = await Ride.findById(rideId).select('booking').lean();
      await AssignmentHistory.create({
        ride:           rideId,
        booking:        ride?.booking || null,
        assignmentType: 'PARTICIPANT',
        entityRefModel: participant.refModel || 'RideParticipant',
        entityRefId:    participant.refId || participant._id,
        action:         'REMOVED',
        performedBy:    req.user._id,
        reason:         reason || 'Admin removed participant',
        effectiveAt:    new Date(),
      });
 
      getBookingSocketService()?.emitToRoom(`booking:${ride?.booking}`, 'participant_removed', {
        rideId,
        participantId,
        role:      participant.role,
        timestamp: new Date().toISOString(),
      });
 
      return res.json({ success: true, message: 'Participant deactivated' });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// GET /ride-ops/rides/:rideId/route-versions/active
// Fast endpoint — returns ONLY current active RouteVersion + its stops.
// Drivers call this after route recalc events to get new polyline.
// ═════════════════════════════════════════════════════════════════════════════
 
router.get('/rides/:rideId/route-versions/active',
  protect,
  authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer', 'transportpartner'),
  async (req, res) => {
    try {
      const { rideId } = req.params;
      if (!isValidId(rideId))
        return res.status(400).json({ success: false, message: 'Invalid rideId' });
 
      const ride = await Ride.findById(rideId).select('booking activeRouteVersionId currentStopId').lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
 
      if (!ride.activeRouteVersionId)
        return res.status(404).json({ success: false, message: 'No active route version yet' });
 
      const [version, stops] = await Promise.all([
        RouteVersion.findById(ride.activeRouteVersionId).lean(),
        RideStop.find({ ride: rideId, isActive: true }).sort({ sequence: 1 }).lean(),
      ]);
 
      if (!version)
        return res.status(404).json({ success: false, message: 'Active route version not found' });
 
      return res.json({
        success: true,
        data: {
          version,
          stops: stops.map(s => ({
            stopId:    s._id,
            stopType:  s.stopType,
            sequence:  s.sequence,
            location:  s.location,
            status:    s.status,
            arrival:   s.arrival,
            departure: s.departure,
            meta:      s.meta,
          })),
          currentStopId: ride.currentStopId,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);
 
// ═════════════════════════════════════════════════════════════════════════════
// POST /ride-ops/admin/bookings/:bookingId/join-point/recalc
// Admin triggers join-point recalculation after MISSED event.
// Creates NEW JoinPoint (chain pointer set on old one), new CARE_ASSISTANT_JOIN
// RideStop in current RouteVersion. Old join stop deactivated.
//
// Body: { careAssistantId, caCurrentLat, caCurrentLng, reason? }
// ═════════════════════════════════════════════════════════════════════════════
 
router.post('/admin/bookings/:bookingId/join-point/recalc',
  protect,
  authorize('admin', 'superadmin'),
  async (req, res) => {
    try {
      const { bookingId } = req.params;
      const { careAssistantId, caCurrentLat, caCurrentLng, reason } = req.body;
 
      if (!isValidId(bookingId))
        return res.status(400).json({ success: false, message: 'Invalid bookingId' });
      if (!careAssistantId || !caCurrentLat || !caCurrentLng)
        return res.status(400).json({ success: false, message: 'careAssistantId, caCurrentLat, caCurrentLng required' });
 
      const booking = await Booking.findById(bookingId)
        .select('_id bookingType primaryRide careAssistant')
        .lean();
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
      if (booking.bookingType !== 'full_care_ride')
        return res.status(400).json({ success: false, message: 'Recalc only for full_care_ride' });
      if (!booking.primaryRide)
        return res.status(400).json({ success: false, message: 'No primary ride on booking' });
 
      const ride = await Ride.findById(booking.primaryRide)
        .select('pickup dropoff liveLocation status trackingId activeRouteVersionId currentStopId')
        .lean();
      if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
      if (['completed', 'cancelled'].includes(ride.status))
        return res.status(400).json({ success: false, message: `Cannot recalc JP on ${ride.status} ride` });
 
      const tracking = ride.trackingId
        ? await RideTracking.findById(ride.trackingId).select('expectedRoutePolyline').lean()
        : null;
 
      const caCoords      = [parseFloat(caCurrentLng), parseFloat(caCurrentLat)];
      const driverCoords  = ride.liveLocation?.coordinates || ride.pickup?.coordinates || [80.648, 16.506];
 
      const joinResult = resolveCaJoinPoint({
        caCoords,
        driverCoords,
        pickupCoords:    ride.pickup?.coordinates,
        dropoffCoords:   ride.dropoff?.coordinates,
        encodedPolyline: tracking?.expectedRoutePolyline || null,
      });
 
      // Find existing active participant
      const participant = await RideParticipant.findOne({
        ride: booking.primaryRide, role: 'CARE_ASSISTANT', isActive: true,
      }).lean();
      if (!participant)
        return res.status(404).json({ success: false, message: 'No active CA participant on this ride' });
 
      // Get old active JP to chain-link
      const oldJp = await JoinPoint.findOne({
        ride: booking.primaryRide,
        participant: participant._id,
        isActive: true,
      }).lean();
 
      // Deactivate old JP
      if (oldJp) {
        await JoinPoint.findByIdAndUpdate(oldJp._id, {
          $set: { isActive: false },
        });
      }
 
      const lastJp = await JoinPoint.findOne(
        { ride: booking.primaryRide, participant: participant._id },
        {},
        { sort: { attemptNumber: -1 } }
      ).lean();
      const attemptNumber = (lastJp?.attemptNumber || 0) + 1;
 
      // Create new JoinPoint with chain pointer
      const newJp = await JoinPoint.create({
        ride:        booking.primaryRide,
        booking:     bookingId,
        participant: participant._id,
        location:    { type: 'Point', coordinates: joinResult.joinPoint },
        calculatedBy: 'routing_engine',
        calculationMeta: {
          distanceFromParticipantKm: joinResult.distCaToJoinKm,
          distanceFromDriverKm:      haversineKm(driverCoords, joinResult.joinPoint),
          routingEngineVersion:      '1.0',
        },
        status:        'LOCKED',
        attemptNumber,
        lockedAt:      new Date(),
        createdBy:     req.user._id,
      });
 
      // Set supersededBy on old JP
      if (oldJp) {
        await JoinPoint.findByIdAndUpdate(oldJp._id, {
          $set: { supersededBy: newJp._id },
        });
      }
 
      // Update RideStop — deactivate old CA join stop, create new one
      const activeVersion = ride.activeRouteVersionId
        ? await RouteVersion.findById(ride.activeRouteVersionId).select('versionNumber stops').lean()
        : null;
 
      let newCaStop = null;
      if (activeVersion) {
        // Deactivate old CA join stop
        await RideStop.updateMany(
          { ride: booking.primaryRide, stopType: 'CARE_ASSISTANT_JOIN', isActive: true },
          { $set: { isActive: false } }
        );
 
        // Shift existing stops to make room
        const caStopSequence = joinResult.zone === 'before_pickup' ? 1 : 2;
        await RideStop.updateMany(
          {
            ride:         booking.primaryRide,
            routeVersion: activeVersion.versionNumber,
            sequence:     { $gte: caStopSequence },
            isActive:     true,
          },
          { $inc: { sequence: 1 } }
        );
 
        newCaStop = await RideStop.create({
          ride:         booking.primaryRide,
          booking:      bookingId,
          routeVersion: activeVersion.versionNumber,
          sequence:     caStopSequence,
          stopType:     'CARE_ASSISTANT_JOIN',
          location: {
            type:        'Point',
            coordinates: joinResult.joinPoint,
            address:     joinResult.joinPointAddress || 'Recalculated CA Join Point',
            label:       `CA Join (attempt ${attemptNumber}) — ${joinResult.zone}`,
          },
          participant: participant._id,
          status:      'PENDING',
          meta: {
            zone:           joinResult.zone,
            distCaToJoinKm: joinResult.distCaToJoinKm,
            caFrom:         caCoords,
            attemptNumber,
            reason:         reason || 'Recalculated after missed join point',
          },
        });
 
        // Update Ride.currentStopId to new CA stop
        await Ride.findByIdAndUpdate(booking.primaryRide, {
          $set: { currentStopId: newCaStop._id },
        });
 
        if (ride.trackingId) {
          await RideTracking.findByIdAndUpdate(ride.trackingId, {
            $set: { currentStopId: newCaStop._id },
          });
        }
      }
 
      // Reset participant status → EN_ROUTE
      await RideParticipant.findByIdAndUpdate(participant._id, {
        $set: { status: 'EN_ROUTE' },
      });
      await RideTracking.updateParticipantStatus(booking.primaryRide, participant._id, 'en_route_to_pickup')
        .catch(() => {});
 
      getBookingSocketService()?.emitToRoom(`booking:${bookingId}`, 'join_point_recalculated', {
        bookingId,
        rideId:         String(booking.primaryRide),
        newJoinPointId: newJp._id,
        participantId:  participant._id,
        attemptNumber,
        location:       { coordinates: joinResult.joinPoint },
        zone:           joinResult.zone,
        distCaToJoinKm: joinResult.distCaToJoinKm,
        reason:         reason || 'Recalculated after MISSED',
        newStopId:      newCaStop?._id || null,
        timestamp:      new Date().toISOString(),
      });
 
      getBookingSocketService()?.emitToAdminOps('join_point_recalculated', {
        bookingId,
        rideId:       String(booking.primaryRide),
        attemptNumber,
        zone:         joinResult.zone,
        distCaToJoinKm: joinResult.distCaToJoinKm,
      });
 
      return res.status(201).json({
        success: true,
        message: `Join point recalculated (attempt ${attemptNumber})`,
        data: {
          joinPoint:      newJp,
          zone:           joinResult.zone,
          distCaToJoinKm: joinResult.distCaToJoinKm,
          caRoute:        joinResult.caRoute,
          attemptNumber,
          newStopId:      newCaStop?._id || null,
        },
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);



export default router;