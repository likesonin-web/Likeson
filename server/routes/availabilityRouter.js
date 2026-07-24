/**
 * availabilityRouter.js — Likeson.in
 * Business logic lives in controllers/availability.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/availability.controller.js';

const router = express.Router();

router.get('/doctor/weekly', protect, authorize('doctor'), ctrl.getDoctorWeekly);
router.put('/doctor/weekly', protect, authorize('doctor'), ctrl.putDoctorWeekly);
router.patch('/doctor/day/:day', protect, authorize('doctor'), ctrl.patchDoctorDayByDay);
router.get('/doctor/schedule', protect, authorize('doctor'), ctrl.getDoctorSchedule);
router.get('/doctor/schedule/date/:date', protect, authorize('doctor'), ctrl.getDoctorScheduleDateByDate);
router.patch('/doctor/online-status', protect, authorize('doctor'), ctrl.patchDoctorOnlineStatus);
router.get('/hospital/hours', protect, authorize('hospital'), ctrl.getHospitalHours);
router.put('/hospital/hours', protect, authorize('hospital'), ctrl.putHospitalHours);
router.get('/hospital/doctors/schedules', protect, authorize('hospital'), ctrl.getHospitalDoctorsSchedules);
router.get('/hospital/schedule/date/:date', protect, authorize('hospital'), ctrl.getHospitalScheduleDateByDate);
router.get('/care-assistant/weekly', protect, authorize('care_assistant'), ctrl.getCareAssistantWeekly);
router.put('/care-assistant/weekly', protect, authorize('care_assistant'), ctrl.putCareAssistantWeekly);
router.patch('/care-assistant/status', protect, authorize('care_assistant'), ctrl.patchCareAssistantStatus);
router.get('/care-assistant/tasks', protect, authorize('care_assistant'), ctrl.getCareAssistantTasks);
router.get('/care-assistant/tasks/date/:date', protect, authorize('care_assistant'), ctrl.getCareAssistantTasksDateByDate);
router.get('/transport/hours', protect, authorize('transportpartner'), ctrl.getTransportHours);
router.patch('/transport/hours', protect, authorize('transportpartner'), ctrl.patchTransportHours);
router.get('/transport/fleet/status', protect, authorize('transportpartner'), ctrl.getTransportFleetStatus);
router.get('/transport/rides/schedule', protect, authorize('transportpartner'), ctrl.getTransportRidesSchedule);
router.get('/transport/rides/date/:date', protect, authorize('transportpartner'), ctrl.getTransportRidesDateByDate);
router.get('/solo/hours', protect, authorize('solodriverpartner'), ctrl.getSoloHours);
router.patch('/solo/hours', protect, authorize('solodriverpartner'), ctrl.patchSoloHours);
router.get('/solo/rides/schedule', protect, authorize('solodriverpartner'), ctrl.getSoloRidesSchedule);
router.get('/solo/rides/date/:date', protect, authorize('solodriverpartner'), ctrl.getSoloRidesDateByDate);
router.patch('/solo/service-zones', protect, authorize('solodriverpartner'), ctrl.patchSoloServiceZones);

export default router;
