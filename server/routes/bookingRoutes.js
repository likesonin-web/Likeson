/**
 * bookingRoutes.js — Likeson.in
 * Business logic lives in controllers/booking.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import cache from '../middleware/cache.js';
import * as ctrl from '../controllers/booking.controller.js';

const router = express.Router();

// 1. Define the missing CACHE_TTL configuration
const CACHE_TTL = {
  consultations: 60,
  ops: 120,
  opRecord: 300,
  adminBookings: 60,
  adminStats: 300,
  nearby: 60
};

router.get('/consultations/:bookingId', protect, cache(CACHE_TTL.consultations, req => `GET:/consultations/${req.params.bookingId}:${req.user._id}`), ctrl.getConsultationsByBookingId);
router.patch('/consultations/:consultationId/confirm', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.patchConsultationsByConsultationIdConfirm);
router.patch('/consultations/:consultationId/accept', protect, authorize('doctor'), ctrl.patchConsultationsByConsultationIdAccept);
router.patch('/consultations/:consultationId/start', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.patchConsultationsByConsultationIdStart);
router.patch('/consultations/:consultationId/end', protect, authorize('doctor', 'admin', 'superadmin'), ctrl.patchConsultationsByConsultationIdEnd);
router.patch('/consultations/:consultationId/consent', protect, ctrl.patchConsultationsByConsultationIdConsent);
router.post('/consultations/:consultationId/chat', protect, ctrl.postConsultationsByConsultationIdChat);
router.get('/consultations/:consultationId/join-token', protect, ctrl.getConsultationsByConsultationIdJoinToken);

router.get('/tp/assigned', protect, authorize('transportpartner'), cache(CACHE_TTL.ops, req => `GET:/tp/assigned:${req.user._id}`), ctrl.getTpAssigned);
router.get('/tp/drivers/available', protect, authorize('transportpartner'), ctrl.getTpDriversAvailable);
router.patch('/:id/tp/assign-driver', protect, authorize('transportpartner'), ctrl.patchByIdTpAssignDriver);
router.patch('/:id/tp/reassign-driver', protect, authorize('transportpartner'), ctrl.patchByIdTpReassignDriver);

router.get('/care/assigned', protect, authorize('care_assistant'), ctrl.getCareAssigned);
router.patch('/:id/care/arrived', protect, authorize('care_assistant'), ctrl.patchByIdCareArrived);
router.patch('/:id/care/start', protect, authorize('care_assistant'), ctrl.patchByIdCareStart);
router.patch('/:id/care/complete', protect, authorize('care_assistant'), ctrl.patchByIdCareComplete);
router.patch('/care/location', protect, authorize('care_assistant'), ctrl.patchCareLocation);
router.post('/:id/care/join-ride', protect, authorize('care_assistant'), ctrl.postByIdCareJoinRide);
router.patch('/:id/care/reached-jp', protect, authorize('care_assistant'), ctrl.patchByIdCareReachedJp);
router.patch('/:id/care/ride-status', protect, authorize('care_assistant'), ctrl.patchByIdCareRideStatus);
router.get('/:id/care/tracking-snapshot', protect, authorize('customer', 'admin', 'superadmin', 'care_assistant'), ctrl.getByIdCareTrackingSnapshot);

router.get('/hospital/upcoming', protect, authorize('hospital'), ctrl.getHospitalUpcoming);
router.patch('/:id/hospital/confirm', protect, authorize('hospital'), ctrl.patchByIdHospitalConfirm);
router.get('/hospital/:hospitalId/ops', protect, authorize('hospital', 'admin', 'superadmin'), cache(CACHE_TTL.ops, req => `GET:/hospital/${req.params.hospitalId}/ops:${req.originalUrl}`), ctrl.getHospitalByHospitalIdOps);
router.get('/hospital/:hospitalId/valid-ops', protect, authorize('hospital', 'doctor', 'admin', 'superadmin'), cache(CACHE_TTL.ops, req => `GET:/hospital/${req.params.hospitalId}/valid-ops:${req.originalUrl}`), ctrl.getHospitalByHospitalIdValidOps);

router.get('/doctor/ops', protect, authorize('doctor'), cache(CACHE_TTL.ops, req => `GET:/doctor/ops:${req.user._id}:${req.originalUrl}`), ctrl.getDoctorOps);
router.get('/doctor/ops/:opNumber', protect, authorize('doctor'), cache(CACHE_TTL.opRecord, req => `GET:/doctor/ops/${req.params.opNumber}`), ctrl.getDoctorOpsByOpNumber);
router.patch('/:id/op/complete', protect, authorize('doctor'), ctrl.patchByIdOpComplete);
router.get('/op/:opNumber', protect, cache(CACHE_TTL.opRecord, req => `GET:/op/${req.params.opNumber}:${req.user._id}`), ctrl.getOpByOpNumber);
router.get('/op/:opNumber/follow-ups', protect, ctrl.getOpByOpNumberFollowUps);
router.get('/op/:opNumber/download', protect, ctrl.getOpByOpNumberDownload);

router.get('/admin/bookings', protect, authorize('admin', 'superadmin'), cache(CACHE_TTL.adminBookings, req => `GET:/admin/bookings:${req.originalUrl}`), ctrl.getAdminBookings);
router.get('/admin/bookings/stats', protect, authorize('admin', 'superadmin'), cache(CACHE_TTL.adminStats, req => `GET:/admin/bookings/stats:${req.originalUrl}`), ctrl.getAdminBookingsStats);
router.get('/admin/bookings/export', protect, authorize('admin', 'superadmin'), ctrl.getAdminBookingsExport);
router.get('/admin/bookings/:id', protect, authorize('admin', 'superadmin'), cache(CACHE_TTL.adminBookings, req => `GET:/admin/bookings/${req.params.id}`), ctrl.getAdminBookingsById);
router.patch('/admin/bookings/:id/status', protect, authorize('admin', 'superadmin'), ctrl.patchAdminBookingsByIdStatus);
router.patch('/admin/bookings/:id/destination', protect, authorize('admin', 'superadmin'), ctrl.patchAdminBookingsByIdDestination);
router.get('/admin/bookings/:id/nearby/care-assistants', protect, authorize('admin', 'superadmin'), cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/care-assistants`), ctrl.getAdminBookingsByIdNearbyCareAssistants);
router.get('/admin/bookings/:id/nearby/solo-drivers', protect, authorize('admin', 'superadmin'), cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/solo-drivers`), ctrl.getAdminBookingsByIdNearbySoloDrivers);
router.get('/admin/bookings/:id/nearby/transport-partners', protect, authorize('admin', 'superadmin'), cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/transport-partners`), ctrl.getAdminBookingsByIdNearbyTransportPartners);
router.get('/admin/bookings/:id/nearby/hospitals', protect, authorize('admin', 'superadmin'), cache(CACHE_TTL.nearby, req => `GET:/admin/bookings/${req.params.id}/nearby/hospitals`), ctrl.getAdminBookingsByIdNearbyHospitals);
router.post('/admin/bookings/:id/assign/solo-driver', protect, authorize('admin', 'superadmin'), ctrl.postAdminBookingsByIdAssignSoloDriver);
router.post('/admin/bookings/:id/assign/transport-partner', protect, authorize('admin', 'superadmin'), ctrl.postAdminBookingsByIdAssignTransportPartner);
router.post('/admin/bookings/:id/assign/care-assistant', protect, authorize('admin', 'superadmin'), ctrl.postAdminBookingsByIdAssignCareAssistant);
router.post('/admin/bookings/:id/assign/hospital', protect, authorize('admin', 'superadmin'), ctrl.postAdminBookingsByIdAssignHospital);
router.patch('/admin/bookings/:id/reassign/care', protect, authorize('admin', 'superadmin'), ctrl.patchAdminBookingsByIdReassignCare);
router.post('/admin/bookings/:id/refund', protect, authorize('admin', 'superadmin'), ctrl.postAdminBookingsByIdRefund);
router.get('/admin/ops', protect, authorize('admin', 'superadmin'), cache(CACHE_TTL.ops, req => `GET:/admin/ops:${req.originalUrl}`), ctrl.getAdminOps);
router.patch('/admin/ops/:id/status', protect, authorize('admin', 'superadmin'), ctrl.patchAdminOpsByIdStatus);
router.get('/admin/sos/active', protect, authorize('admin', 'superadmin'), ctrl.getAdminSosActive);
router.patch('/admin/sos/:sosEventId/resolve', protect, authorize('admin', 'superadmin'), ctrl.patchAdminSosBySosEventIdResolve);
router.get('/admin/destination-audit/:bookingId', protect, authorize('admin', 'superadmin'), ctrl.getAdminDestinationAuditByBookingId);

// Centralised error handler — must be last
if (ctrl.errorHandler) {
  router.use(ctrl.errorHandler);
}

export default router;