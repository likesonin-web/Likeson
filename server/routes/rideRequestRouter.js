/**
 * rideRequestRouter.js — Likeson.in
 * Business logic lives in controllers/rideRequest.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from "../middleware/authMiddleware.js";
import * as ctrl from '../controllers/rideRequest.controller.js';

const router = express.Router();

router.post("/quote", protect, authorize("customer", "care_assistant"), ctrl.postQuote);
router.post("/confirm", protect, authorize("customer", "care_assistant"), ctrl.postConfirm);
router.get("/:rideId", protect, authorize(
    "customer",
    "care_assistant",
    "driver",
    "solodriverpartner",
    "transportpartner",
    "admin",
    "superadmin",
  ), ctrl.getByRideId);
router.get("/admin/all", protect, authorize("admin", "superadmin"), ctrl.getAdminAll);
router.get("/admin/:rideId/nearby", protect, authorize("admin", "superadmin"), ctrl.getAdminByRideIdNearby);
router.post("/admin/:rideId/assign", protect, authorize("admin", "superadmin"), ctrl.postAdminByRideIdAssign);
router.patch("/tp/:rideId/assign-driver", protect, authorize("transportpartner"), ctrl.patchTpByRideIdAssignDriver);
router.patch("/:rideId/status", protect, authorize("driver", "solodriverpartner", "admin", "superadmin"), ctrl.patchByRideIdStatus);
router.get("/:rideId/tracking", protect, authorize(
    "customer",
    "care_assistant",
    "driver",
    "solodriverpartner",
    "transportpartner",
    "admin",
    "superadmin",
  ), ctrl.getByRideIdTracking);
router.get("/:rideId/live", protect, authorize(
    "customer",
    "care_assistant",
    "driver",
    "solodriverpartner",
    "transportpartner",
    "admin",
    "superadmin",
  ), ctrl.getByRideIdLive);
router.post("/:rideId/tracking/milestone", protect, authorize(
    "driver",
    "solodriverpartner",
    "care_assistant",
    "admin",
    "superadmin",
  ), ctrl.postByRideIdTrackingMilestone);
router.get("/:rideId/care-assistant-live", protect, ctrl.getByRideIdCareAssistantLive);

export default router;
