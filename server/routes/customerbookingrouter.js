/**
 * customerbookingrouter.js — Likeson.in
 * Business logic lives in controllers/customerbooking.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import {
  Booking,
  Ride,
  RideTracking,
  OutPatientRecord,
  UserSubscription,
  DoctorProfile,
  Hospital,
  protect,
  authorize,
  getHospitals,
  getDoctorsByHospital,
  checkHospitalOrDoctorAvailability,
  getLabs,
  getLabWithTests,
  resolveKmRate,
  resolveTransportFare,
  autoAssignCareAssistant,
  checkFollowUpEligibility,
  checkSubscriptionConsultation,
  resolveConsultationFee,
  checkConsultationModeAllowed,
  incrementSubscriptionUsage,
  queueSubscriptionUsage,
  flushAndRecord,
  recoverSubscriptionUsageOnCancel,
  markHomeCollectionUsed,
  checkSubscriptionCareAssistant,
  resolveCareAssistantFee,
  checkSubscriptionDiagnostics,
  buildFareBreakdown,
  buildRidePayload,
  generateOpNumber,
  createRazorpayOrder,
  processWalletPayment,
  computeRefundAmount,
  resolveServiceComponents,
  hashOtp,
  genOtp,
  haversineKm,
  createNotification,
  CUSTOMER_BOOKING_TYPES,
  verifyRazorpaySignature,
  calculateCanonicalRoute,
  SubscriptionPlan,
  sendBookingConfirmationEmail,
  parseFrontendDateTime,
} from "./bookingRouterShared.js";
import * as ctrl from '../controllers/customerbooking.controller.js';

const router = express.Router();

// ── Public browse — no login needed, matches frontend "browse then login at booking" flow ──
router.get("/hospitals", ctrl.getHospitals2);
router.get("/doctors", ctrl.getDoctors);
router.get("/hospitals/:hospitalId/doctors", ctrl.getHospitalsByHospitalIdDoctors);
router.get("/labs", ctrl.getLabs2);
router.get("/labs/:labId", ctrl.getLabsByLabId);
router.get("/booking-options/:type", ctrl.getBookingOptionsByType);

// ── Needs user (personal/account-scoped/write) ──
router.get("/hospitals/:hospitalId/availability", protect, ctrl.getHospitalsByHospitalIdAvailability);
router.get("/doctors/:doctorId/availability", protect, ctrl.getDoctorsByDoctorIdAvailability);
router.get("/transport/estimate", protect, ctrl.getTransportEstimate);
router.get("/consultation-check", protect, authorize("customer"), ctrl.getConsultationCheck);
router.get("/follow-up/check", protect, ctrl.getFollowUpCheck);
router.post("/full-care-ride", protect, authorize("customer"), ctrl.postFullCareRide);
router.post("/doctor-consultation", protect, authorize("customer"), ctrl.postDoctorConsultation);
router.post("/doctor-online", protect, authorize("customer"), ctrl.postDoctorOnline);
router.post("/patient-transport", protect, authorize("customer"), ctrl.postPatientTransport);
router.post("/physiotherapist", protect, authorize("customer"), ctrl.postPhysiotherapist);
router.post("/follow-up", protect, authorize("customer"), ctrl.postFollowUp);
router.post("/diagnostic-center", protect, authorize("customer"), ctrl.postDiagnosticCenter);
router.post("/diagnostic-home", protect, authorize("customer"), ctrl.postDiagnosticHome);
router.post("/care-assistant", protect, authorize("customer"), ctrl.postCareAssistant);
router.post("/verify-payment", protect, ctrl.postVerifyPayment);
router.post("/delete-failed-booking", protect, ctrl.postDeleteFailedBooking);
router.post("/confirm-cash-payment", protect, authorize("admin", "superadmin"), ctrl.postConfirmCashPayment);
router.get("/my-bookings", protect, authorize("customer"), ctrl.getMyBookings);
router.get("/my-bookings/:bookingId", protect, authorize("customer"), ctrl.getMyBookingsByBookingId);
router.post("/my-bookings/:bookingId/cancel", protect, authorize("customer"), ctrl.postMyBookingsByBookingIdCancel);
router.patch("/:bookingId/doctor-cancel", protect, authorize("doctor", "admin", "superadmin"), ctrl.patchByBookingIdDoctorCancel);
router.post("/my-bookings/:bookingId/rate", protect, authorize("customer"), ctrl.postMyBookingsByBookingIdRate);
router.get("/my-bookings/:bookingId/op-download", protect, authorize("customer"), ctrl.getMyBookingsByBookingIdOpDownload);
router.get("/platform-pricing", ctrl.getPlatformPricing);
router.get("/subscription-benefits/consultations", protect, authorize("customer"), ctrl.getSubscriptionBenefitsConsultations);
router.get("/subscription-benefits/care-assistant", protect, authorize("customer"), ctrl.getSubscriptionBenefitsCareAssistant);
router.get("/subscription-benefits/labs", protect, authorize("customer"), ctrl.getSubscriptionBenefitsLabs);
router.get("/previous-patient-info", protect, authorize("customer"), ctrl.getPreviousPatientInfo);

export default router;
