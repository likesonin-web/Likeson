/**
 * userSubscriptionPlan.js — Likeson.in
 * Business logic lives in controllers/userSubscriptionPlan.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { body, param, validationResult } from "express-validator";
import { protect, authorize } from "../middleware/authMiddleware.js";
import * as ctrl from '../controllers/userSubscriptionPlan.controller.js';

const router = express.Router();

// Defined the validate middleware here to resolve the ReferenceError
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

router.get("/plans", ctrl.getPlans);
router.get("/plans/:planId", protect, authorize("customer", "admin", "superadmin"), [param("planId").isMongoId().withMessage("Invalid planId")], validate, ctrl.getPlansByPlanId);
router.get("/custom-plan/pricing", protect, authorize("customer", "admin", "superadmin"), ctrl.getCustomPlanPricing);
router.post("/custom-plan", protect, authorize("customer"), [
    body("name").trim().notEmpty().withMessage("Plan name is required"),

    body("options")
      .isArray({ min: 1 })
      .withMessage("At least one option must be selected"),

    body("options.*.optionKey")
      .isIn([
        "consultations",
        "transport",
        "diagnostics",
        "pharmacy",
        "careAssistant",
        "homeSampleCollection",
        "prioritySupport",
      ])
      .withMessage("Invalid optionKey"),

    body("options.*.quantity")
      .isFloat({ min: 0 })
      .withMessage("Quantity must be ≥ 0"),

    body("options.*.slabIndex")
      .optional()
      .isInt({ min: 0 })
      .withMessage("slabIndex must be a non-negative integer"),

    body("options.*.careAssistantTierIndex")
      .optional()
      .isInt({ min: 0 })
      .withMessage("careAssistantTierIndex must be a non-negative integer"),
  ], validate, ctrl.postCustomPlan);
router.put("/custom-plan/:planId", protect, authorize("customer"), [
    param("planId").isMongoId().withMessage("Invalid planId"),
    body("options")
      .isArray({ min: 1 })
      .withMessage("At least one option must be selected"),
    body("options.*.optionKey")
      .isIn([
        "consultations",
        "transport",
        "diagnostics",
        "pharmacy",
        "careAssistant",
        "homeSampleCollection",
        "prioritySupport",
      ])
      .withMessage("Invalid optionKey"),
    body("options.*.quantity")
      .isFloat({ min: 0 })
      .withMessage("Quantity must be ≥ 0"),
    body("options.*.careAssistantTierIndex")
      .optional()
      .isInt({ min: 0 })
      .withMessage("careAssistantTierIndex must be a non-negative integer"),
    body("options.*.slabIndex")
      .optional()
      .isInt({ min: 0 })
      .withMessage("slabIndex must be a non-negative integer"),
  ], validate, ctrl.putCustomPlanByPlanId);
router.delete("/custom-plan/:planId", protect, authorize("customer"), [param("planId").isMongoId().withMessage("Invalid planId")], validate, ctrl.deleteCustomPlanByPlanId);
router.post("/buy", protect, authorize("customer"), [
    body("planId").isMongoId().withMessage("planId must be a valid Mongo ID"),
    body("amount")
      .isFloat({ min: 0 })
      .withMessage("amount must be a non-negative number"),
  ], validate, ctrl.postBuy);
router.post("/verify", protect, [
    body("razorpay_order_id")
      .notEmpty()
      .withMessage("razorpay_order_id is required"),
    body("razorpay_payment_id")
      .notEmpty()
      .withMessage("razorpay_payment_id is required"),
    body("razorpay_signature")
      .notEmpty()
      .withMessage("razorpay_signature is required"),
    body("planId")
      .optional()
      .isMongoId()
      .withMessage("planId must be a valid Mongo ID"),
    body("amount")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("amount must be a non-negative number"),
  ], validate, ctrl.postVerify);
router.post("/flush-pending-usage", protect, ctrl.postFlushPendingUsage);
router.get("/my", protect, authorize("customer"), ctrl.getMy);
router.get("/my/history", protect, authorize("customer"), ctrl.getMyHistory);
router.put("/upgrade", protect, authorize("customer"), [
    body("newPlanId")
      .isMongoId()
      .withMessage("newPlanId must be a valid Mongo ID"),
    body("amount").optional().isFloat({ min: 0 }),
    body("couponCode").optional().isString(),
  ], validate, ctrl.putUpgrade);
router.put("/cancel", protect, authorize("customer"), ctrl.putCancel);
router.put("/toggle-auto-renew", protect, authorize("customer"), ctrl.putToggleAutoRenew);
router.post("/free-trial/start", protect, authorize("customer"), [
    body("planId").isMongoId().withMessage("planId must be a valid Mongo ID"),
    body("razorpay_payment_method_id").optional().isString(),
  ], validate, ctrl.postFreeTrialStart);
router.get("/free-trial/eligibility", protect, authorize("customer"), ctrl.getFreeTrialEligibility);
router.get("/free-trial/status", protect, authorize("customer"), ctrl.getFreeTrialStatus);
router.post("/free-trial/convert", protect, authorize("customer"), [body("couponCode").optional().isString()], validate, ctrl.postFreeTrialConvert);
router.post("/my/members", protect, authorize("customer"), [
    body("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("A valid email is required"),
    body("relation")
      .trim()
      .notEmpty()
      .withMessage("Relation (e.g., Spouse, Child, Parent) is required"),
  ], validate, ctrl.postMyMembers);
router.delete("/my/members/:email", protect, authorize("customer"), [
    param("email")
      .isEmail()
      .normalizeEmail()
      .withMessage("Valid email parameter required"),
  ], validate, ctrl.deleteMyMembersByEmail);
router.post("/free-trial/verify-convert", protect, authorize("customer"), [
    body("razorpay_order_id")
      .notEmpty()
      .withMessage("razorpay_order_id is required"),
    body("razorpay_payment_id")
      .notEmpty()
      .withMessage("razorpay_payment_id is required"),
    body("razorpay_signature")
      .notEmpty()
      .withMessage("razorpay_signature is required"),
    body("amount").optional().isFloat({ min: 0 }),
  ], validate, ctrl.postFreeTrialVerifyConvert);
router.post("/free-trial/expire-stale", protect, authorize("admin", "superadmin"), ctrl.postFreeTrialExpireStale);
router.get("/admin/trials", protect, authorize("admin", "superadmin"), ctrl.getAdminTrials);
router.post("/send-expiry-alerts", protect, authorize("admin", "superadmin"), ctrl.postSendExpiryAlerts);
router.post("/auto-renew-trigger", protect, authorize("admin", "superadmin"), ctrl.postAutoRenewTrigger);
router.get("/admin/all", protect, authorize("admin", "superadmin"), ctrl.getAdminAll);
router.get("/admin/plans", protect, authorize("admin", "superadmin"), ctrl.getAdminPlans);
router.post("/admin/plans", protect, authorize("admin", "superadmin"), [
    body("name").trim().notEmpty().withMessage("name is required"),
    body("slug").trim().notEmpty().withMessage("slug is required"),
    body("fixedTier")
      .isIn([
        "Basic Care",
        "Standard Care",
        "Premium Care",
        "Family Care",
        "Pregnant Women Care",
        "NRI's Care",
      ])
      .withMessage("Invalid fixedTier"),
    body("pricing.monthly")
      .isNumeric()
      .withMessage("pricing.monthly is required"),
  ], validate, ctrl.postAdminPlans);
router.put("/admin/plans/:planId", protect, authorize("admin", "superadmin"), [param("planId").isMongoId().withMessage("Invalid planId")], validate, ctrl.putAdminPlansByPlanId);
router.delete("/admin/plans/:planId", protect, authorize("superadmin"), [param("planId").isMongoId().withMessage("Invalid planId")], validate, ctrl.deleteAdminPlansByPlanId);
router.put("/admin/subscriptions/:subId", protect, authorize("admin", "superadmin"), [param("subId").isMongoId().withMessage("Invalid subId")], validate, ctrl.putAdminSubscriptionsBySubId);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;