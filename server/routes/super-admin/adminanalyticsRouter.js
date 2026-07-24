/**
 * super-admin/adminanalyticsRouter.js — Likeson.in
 * Business logic lives in controllers/super-admin/adminanalytics.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize }  from '../../middleware/authMiddleware.js';
import * as ctrl from '../../controllers/super-admin/adminanalytics.controller.js';

const router = express.Router();

router.use(protect, authorize('admin', 'superadmin'))
router.get('/overview', ctrl.getOverview);
router.get('/bookings', ctrl.getBookings);
router.get('/appointments', ctrl.getAppointments);
router.get('/appointments/:id', ctrl.getAppointmentsById);
router.get('/specialties', ctrl.getSpecialties);
router.get('/doctors', ctrl.getDoctors);
router.get('/doctors/:id', ctrl.getDoctorsById);
router.get('/schedules', ctrl.getSchedules);
router.get('/availability', ctrl.getAvailability);
router.get('/reports/bookings', ctrl.getReportsBookings);
router.get('/reports/revenue', ctrl.getReportsRevenue);
router.get('/reports/users', ctrl.getReportsUsers);
router.get('/reports/doctors', ctrl.getReportsDoctors);
router.get('/referrals', ctrl.getReferrals);
router.get('/regional', ctrl.getRegional);
router.get('/finance', ctrl.getFinance);
router.get('/users', ctrl.getUsers);
router.get('/subscriptions', ctrl.getSubscriptions);
router.get('/transport', ctrl.getTransport);
router.get('/pharmacy', ctrl.getPharmacy);
router.get('/labs', ctrl.getLabs);
router.get('/ads', ctrl.getAds);
router.get('/bloodbank', ctrl.getBloodbank);
router.get('/wallet', ctrl.getWallet);
router.get('/top-earners', ctrl.getTopEarners);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;
