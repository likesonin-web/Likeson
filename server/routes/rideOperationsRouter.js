/**
 * rideOperationsRouter.js — Likeson.in
 * Business logic lives in controllers/rideOperations.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize }      from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/rideOperations.controller.js';

const router = express.Router();

router.get('/rides/:rideId/participants', protect, authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'), ctrl.getRidesByRideIdParticipants);
router.post('/rides/:rideId/participants', protect, authorize('admin', 'superadmin'), ctrl.postRidesByRideIdParticipants);
router.patch('/rides/:rideId/participants/:participantId/status', protect, authorize('admin', 'superadmin', 'care_assistant'), ctrl.patchRidesByRideIdParticipantsByParticipantIdStatus);
router.post('/admin/bookings/:bookingId/join-point', protect, authorize('admin', 'superadmin'), ctrl.postAdminBookingsByBookingIdJoinPoint);
router.get('/rides/:rideId/join-points', protect, authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'), ctrl.getRidesByRideIdJoinPoints);
router.patch('/rides/:rideId/join-points/:jpId/status', protect, authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant'), ctrl.patchRidesByRideIdJoinPointsByJpIdStatus);
router.get('/rides/:rideId/stops', protect, authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'), ctrl.getRidesByRideIdStops);
router.patch('/rides/:rideId/stops/:stopId/otp', protect, authorize('driver', 'solodriverpartner', 'admin', 'superadmin'), ctrl.patchRidesByRideIdStopsByStopIdOtp);
router.patch('/rides/:rideId/stops/:stopId/status', protect, authorize('driver', 'solodriverpartner', 'admin', 'superadmin'), ctrl.patchRidesByRideIdStopsByStopIdStatus);
router.get('/rides/:rideId/route-versions', protect, authorize('admin', 'superadmin'), ctrl.getRidesByRideIdRouteVersions);
router.post('/bookings/:bookingId/sos', protect, ctrl.postBookingsByBookingIdSos);
router.get('/bookings/:bookingId/sos', protect, authorize('admin', 'superadmin', 'customer', 'driver', 'solodriverpartner', 'care_assistant'), ctrl.getBookingsByBookingIdSos);
router.patch('/sos/:sosId/resolve', protect, authorize('admin', 'superadmin'), ctrl.patchSosBySosIdResolve);
router.patch('/admin/bookings/:bookingId/destination', protect, authorize('admin', 'superadmin'), ctrl.patchAdminBookingsByBookingIdDestination);
router.get('/admin/bookings/:bookingId/destination-history', protect, authorize('admin', 'superadmin'), ctrl.getAdminBookingsByBookingIdDestinationHistory);
router.patch('/admin/rides/:rideId/replace-vehicle', protect, authorize('admin', 'superadmin'), ctrl.patchAdminRidesByRideIdReplaceVehicle);
router.patch('/admin/rides/:rideId/replace-vehicle', protect, authorize('admin', 'superadmin'), ctrl.patchAdminRidesByRideIdReplaceVehicle2);
router.get('/rides/:rideId/assignment-history', protect, authorize('admin', 'superadmin'), ctrl.getRidesByRideIdAssignmentHistory);
router.get('/bookings/:bookingId/status-history', protect, authorize('admin', 'superadmin'), ctrl.getBookingsByBookingIdStatusHistory);
router.get('/bookings/:bookingId/assignment-history', protect, authorize('admin', 'superadmin'), ctrl.getBookingsByBookingIdAssignmentHistory);
router.get('/admin/sos/active', protect, authorize('admin', 'superadmin'), ctrl.getAdminSosActive);
router.get('/rides/:rideId/stops/:stopId', protect, authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'), ctrl.getRidesByRideIdStopsByStopId);
router.get('/rides/:rideId/participants/:participantId', protect, authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer'), ctrl.getRidesByRideIdParticipantsByParticipantId);
router.delete('/rides/:rideId/participants/:participantId', protect, authorize('admin', 'superadmin'), ctrl.deleteRidesByRideIdParticipantsByParticipantId);
router.get('/rides/:rideId/route-versions/active', protect, authorize('admin', 'superadmin', 'driver', 'solodriverpartner', 'care_assistant', 'customer', 'transportpartner'), ctrl.getRidesByRideIdRouteVersionsActive);
router.post('/admin/bookings/:bookingId/join-point/recalc', protect, authorize('admin', 'superadmin'), ctrl.postAdminBookingsByBookingIdJoinPointRecalc);

export default router;
