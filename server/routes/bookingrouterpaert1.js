/**
 * bookingrouterpaert1.js — Likeson.in
 * Business logic lives in controllers/bookingrouterpaert1.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { protect, authorize } from "../middleware/authMiddleware.js";
import cache from "../middleware/cache.js";
import * as ctrl from '../controllers/bookingrouterpaert1.controller.js';

const router = express.Router();

router.get("/driver/assigned", protect, authorize("driver", "solodriverpartner"), ctrl.getDriverAssigned);
router.patch("/:id/ride/accept", protect, authorize("driver", "solodriverpartner"), ctrl.patchByIdRideAccept);
router.patch("/:id/ride/reject", protect, authorize("driver", "solodriverpartner"), ctrl.patchByIdRideReject);
router.patch("/:id/ride/arrived", protect, authorize("driver", "solodriverpartner"), ctrl.patchByIdRideArrived);
router.patch("/:id/ride/verify-otp", protect, authorize("driver", "solodriverpartner"), ctrl.patchByIdRideVerifyOtp);
router.patch("/:id/ride/arrived-stop", protect, authorize("driver", "solodriverpartner"), ctrl.patchByIdRideArrivedStop);
router.patch("/:id/ride/depart-stop", protect, authorize("driver", "solodriverpartner"), ctrl.patchByIdRideDepartStop);
router.post("/:id/ride/end", protect, authorize("driver", "solodriverpartner"), ctrl.postByIdRideEnd);
router.patch("/driver/location", protect, authorize("driver", "solodriverpartner"), ctrl.patchDriverLocation);
router.post("/:id/ride/sos", protect, authorize("driver", "solodriverpartner"), ctrl.postByIdRideSos);
router.post("/:id/request-ride", protect, authorize("customer"), ctrl.postByIdRequestRide);
router.post("/:id/care/request-ride", protect, authorize("care_assistant"), ctrl.postByIdCareRequestRide);
router.post("/admin/care-ride/request", protect, authorize("admin", "superadmin"), ctrl.postAdminCareRideRequest);
router.get("/admin/care-ride/:bookingId/nearby", protect, authorize("admin", "superadmin"), cache(30, (req) => `GET:/admin/care-ride/${req.params.bookingId}/nearby`), ctrl.getAdminCareRideByBookingIdNearby);

export default router;
