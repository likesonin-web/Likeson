import { body, param, validationResult } from "express-validator";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";

import sendEmail from "../utils/sendEmail.js";
import { transactionalTemplate } from "../utils/emailTemplates.js";

// ── Models ────────────────────────────────────────────────────────────────────
import User from "../models/User.js"; // <-- ADD THIS IMPORT
import UserSubscription from "../models/UserSubscription.js";
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import PlatformPricingConfig from "../models/PlatformPricingConfig.js";
import PromotionCoupon from "../models/PromotionCoupon.js";
import Notification from "../models/Notification.js";
import Wallet from "../models/Wallet.js";
import SystemLog from "../models/SystemLog.js";
import Booking from "../models/Booking.js";

// ── Middleware ────────────────────────────────────────────────────────────────
import { protect, authorize } from "../middleware/authMiddleware.js";

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });
  next();
};

const resolveClientIp = (req) =>
  (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .toString()
    .split(",")[0]
    .trim();

const buildActor = (req) => ({
  userId: req.user?._id ?? null,
  name: req.user?.name ?? "system",
  email: req.user?.email ?? null,
  role: req.user?.role ?? "anonymous",
  ip: resolveClientIp(req),
  userAgent: req.headers["user-agent"] ?? null,
  platform: detectPlatform(req),
});

const detectPlatform = (req) => {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("electron")) return "desktop";
  if (req.headers["x-platform"]) return req.headers["x-platform"];
  return "web";
};

const log = (payload) => SystemLog.createLog(payload).catch(() => null);

// ─────────────────────────────────────────────────────────────────────────────
//  PRICING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const resolveCustomOptionUnitPrice = (
  optionPrices,
  optionKey,
  quantity,
  extras = {},
) => {
  let unitPrice = 0;

  switch (optionKey) {
    case "consultations": {
      unitPrice = optionPrices?.consultation?.pricePerConsultation ?? 0;
      break;
    }

    case "transport": {
      const slabs = optionPrices?.transport?.kmSlabs ?? [];
      if (slabs.length > 0) {
        const idx = Math.max(
          0,
          Math.min(Math.floor(Number(extras.slabIndex ?? 0)), slabs.length - 1),
        );
        const slab = slabs[idx];
        if (slab) {
          unitPrice = slab.packagePrice ?? 0;
        }
      }
      break;
    }

    case "diagnostics": {
      const slabs = optionPrices?.diagnosticsDiscount?.slabs ?? [];
      if (slabs.length > 0) {
        const exact = slabs.find((s) => s.percent === quantity);
        if (exact) {
          unitPrice = exact.price;
        } else {
          const floor = [...slabs]
            .sort((a, b) => b.percent - a.percent)
            .find((s) => s.percent <= quantity);
          unitPrice = floor?.price ?? 0;
        }
      }
      break;
    }

    case "pharmacy": {
      const slabs = optionPrices?.pharmacyDiscount?.slabs ?? [];
      if (slabs.length > 0) {
        const exact = slabs.find((s) => s.percent === quantity);
        if (exact) {
          unitPrice = exact.price;
        } else {
          const floor = [...slabs]
            .sort((a, b) => b.percent - a.percent)
            .find((s) => s.percent <= quantity);
          unitPrice = floor?.price ?? 0;
        }
      }
      break;
    }

    case "careAssistant": {
      const caTiers = optionPrices?.careAssistant?.pricingTiers ?? [];
      if (caTiers.length > 0) {
        const tierIdx = Number(extras.careAssistantTierIndex ?? 0);
        const tier = caTiers[tierIdx] ?? caTiers[0];
        unitPrice = tier?.chargeToUser ?? 0;
      }
      break;
    }

    case "homeSampleCollection": {
      unitPrice = optionPrices?.addOns?.homeSampleCollection ?? 199;
      break;
    }

    case "prioritySupport": {
      unitPrice = optionPrices?.addOns?.prioritySupport ?? 99;
      break;
    }

    default:
      unitPrice = 0;
  }

  return unitPrice;
};

// ─────────────────────────────────────────────────────────────────────────────
//  snapshotLimits
// ─────────────────────────────────────────────────────────────────────────────
const snapshotLimits = (plan) => {
  let consultationsPerMonth = plan.consultations?.freePerMonth ?? 0;
  // CA quota ONLY for custom plans — fixed plans always null (no benefit).
  let careAssistantVisitsPerMonth = null;
  let transportRatePerKm = plan.transport?.ratePerKm ?? null;
  let transportRidesPerMonth = plan.transport?.ridesPerMonth ?? null;
  let pharmacyDiscountPercent =
    plan.pharmacy?.discountMin ?? plan.pharmacy?.discountMax ?? 0;
  let diagnosticsDiscountPercent = plan.diagnostics?.discountPercent ?? 0;
  let homeSampleCollection = plan.diagnostics?.homeSampleCollection ?? false;

  let careAssistantTierIndex = null;
  let careAssistantTierLabel = null;
  let careAssistantChargePerVisit = null;

  if (plan.planType === "custom" && Array.isArray(plan.customOptions)) {
    const consultOpt = plan.customOptions.find(
      (o) => o.optionKey === "consultations",
    );
    if (consultOpt?.quantity > 0) {
      consultationsPerMonth = consultOpt.quantity;
    }

    const caOpt = plan.customOptions.find(
      (o) => o.optionKey === "careAssistant",
    );
    if (caOpt?.quantity > 0) {
      careAssistantVisitsPerMonth = caOpt.quantity;
      const tierIdx = caOpt.careAssistantTierIndex ?? 0;
      careAssistantTierIndex = tierIdx;
      careAssistantTierLabel = caOpt.label ?? `Tier ${tierIdx}`;
      careAssistantChargePerVisit = caOpt.unitPrice ?? null;
    }

    const tOpt = plan.customOptions.find((o) => o.optionKey === "transport");
    if (tOpt?.unitPrice > 0) {
      transportRatePerKm = -1; // sentinel: resolve at booking time
      transportRidesPerMonth = tOpt.quantity ?? null;
    }

    const diagOpt = plan.customOptions.find(
      (o) => o.optionKey === "diagnostics",
    );
    if (diagOpt?.quantity > 0) {
      diagnosticsDiscountPercent = diagOpt.quantity;
    }

    const pharmOpt = plan.customOptions.find((o) => o.optionKey === "pharmacy");
    if (pharmOpt?.quantity > 0) {
      pharmacyDiscountPercent = pharmOpt.quantity;
    }

    const homeOpt = plan.customOptions.find(
      (o) => o.optionKey === "homeSampleCollection",
    );
    if (homeOpt?.quantity > 0) {
      homeSampleCollection = true;
    }
  }

  return {
    consultationsPerMonth,
    transportRidesPerMonth,
    careAssistantVisitsPerMonth,
    careAssistantTierIndex,
    careAssistantTierLabel,
    careAssistantChargePerVisit,
    labTestsPerMonth: 0,
    pharmacyDiscountPercent,
    diagnosticsDiscountPercent,
    transportRatePerKm,
    homeSampleCollection,
    homeCollectionUsedOnce: false, // always reset on new sub / renewal
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — PLAN CATALOGUE
// ─────────────────────────────────────────────────────────────────────────────


// GET "/plans"
export const getPlans = asyncHandler(async (req, res) => {
    const plans = await SubscriptionPlan.find({
      isActive: true,
      visibleToCustomerOnly: false,
    })
      .sort({ displayOrder: 1 })
      .lean();

    res.status(200).json({ success: true, count: plans.length, data: plans });
  });

// GET "/plans/:planId"
export const getPlansByPlanId = asyncHandler(async (req, res) => {
    const plan = await SubscriptionPlan.findOne({
      _id: req.params.planId,
      isActive: true,
    }).lean();

    if (!plan)
      return res
        .status(404)
        .json({ success: false, message: "Plan not found." });

    const isAdmin = ["admin", "superadmin"].includes(req.user.role);
    if (
      !isAdmin &&
      plan.visibleToCustomerOnly &&
      String(plan.createdByCustomer) !== String(req.user._id)
    ) {
      return res
        .status(403)
        .json({
          success: false,
          message: "You do not have access to this plan.",
        });
    }

    res.status(200).json({ success: true, data: plan });
  });

// GET "/custom-plan/pricing"
export const getCustomPlanPricing = asyncHandler(async (req, res) => {
    const config = await PlatformPricingConfig.getGlobal();

    res.status(200).json({
      success: true,
      data: {
        optionPricing: config.customPlanOptions,
        caps: config.caps,
      },
    });
  });

// POST "/custom-plan"
export const postCustomPlan = asyncHandler(async (req, res) => {
    const { name, options } = req.body;

    const config = await PlatformPricingConfig.getGlobal();

    const optionPrices = config.customPlanOptions;

    const caps = config.caps;

    const caTiers = optionPrices?.careAssistant?.pricingTiers ?? [];

    const builtOptions = [];

    for (const opt of options) {
      const { optionKey, label = "" } = opt;

      let qty = Number(opt.quantity || 0);

      // ─────────────────────────────────────────────
      // CAPS VALIDATION
      // ─────────────────────────────────────────────

      if (optionKey === "pharmacy" && qty > caps.pharmacyDiscountMax) {
        return res.status(400).json({
          success: false,
          message: `Pharmacy discount cannot exceed ${caps.pharmacyDiscountMax}%.`,
        });
      }

      if (optionKey === "diagnostics" && qty > caps.diagnosticsDiscountMax) {
        return res.status(400).json({
          success: false,
          message: `Diagnostics discount cannot exceed ${caps.diagnosticsDiscountMax}%.`,
        });
      }

      if (
        optionKey === "consultations" &&
        qty > caps.consultationsMaxPerMonth
      ) {
        return res.status(400).json({
          success: false,
          message: `Consultations cannot exceed ${caps.consultationsMaxPerMonth}/month.`,
        });
      }

      if (
        optionKey === "careAssistant" &&
        qty > caps.careAssistantMaxVisitsPerMonth
      ) {
        return res.status(400).json({
          success: false,
          message: `Care-assistant visits cannot exceed ${caps.careAssistantMaxVisitsPerMonth}/month.`,
        });
      }

      if (optionKey === "transport" && qty > caps.transportMaxRidesPerMonth) {
        return res.status(400).json({
          success: false,
          message: `Transport rides cannot exceed ${caps.transportMaxRidesPerMonth}/month.`,
        });
      }

      // ─────────────────────────────────────────────
      // BOOLEAN OPTIONS
      // ─────────────────────────────────────────────

      if (["homeSampleCollection", "prioritySupport"].includes(optionKey)) {
        qty = qty > 0 ? 1 : 0;
      }

      // ─────────────────────────────────────────────
      // CARE ASSISTANT
      // ─────────────────────────────────────────────

      let careAssistantTierIndex = 0;

      if (optionKey === "careAssistant") {
        const requestedIdx = Number(opt.careAssistantTierIndex ?? 0);

        if (caTiers.length === 0) {
          return res.status(400).json({
            success: false,
            message:
              "Care assistant pricing tiers not configured. Contact admin.",
          });
        }

        if (requestedIdx < 0 || requestedIdx >= caTiers.length) {
          return res.status(400).json({
            success: false,
            message: `careAssistantTierIndex must be between 0 and ${caTiers.length - 1}.`,
          });
        }

        careAssistantTierIndex = requestedIdx;
      }

      // ─────────────────────────────────────────────
      // TRANSPORT
      // quantity = rides per month (never overwrite)
      // slabIndex = pricing slab selection
      // ─────────────────────────────────────────────

      let slabIndex = 0;

      if (optionKey === "transport") {
        const totalSlabs = (optionPrices?.transport?.kmSlabs ?? []).length;

        const requestedSlabIdx = Number(opt.slabIndex ?? 0);

        if (totalSlabs === 0) {
          return res.status(400).json({
            success: false,
            message: "Transport slabs not configured. Contact admin.",
          });
        }

        if (requestedSlabIdx < 0 || requestedSlabIdx >= totalSlabs) {
          return res.status(400).json({
            success: false,
            message: `slabIndex must be between 0 and ${totalSlabs - 1}.`,
          });
        }

        slabIndex = requestedSlabIdx;
        // qty stays as rides/month — do NOT overwrite
      }

      // ─────────────────────────────────────────────
      // RESOLVE UNIT PRICE
      // ─────────────────────────────────────────────

      const extras = {
        careAssistantTierIndex,
        slabIndex,
      };

      const unitPrice = resolveCustomOptionUnitPrice(
        optionPrices,
        optionKey,
        qty,
        extras,
      );

      // ─────────────────────────────────────────────
      // LINE TOTAL
      // ─────────────────────────────────────────────

      const packageBasedOptions = ["transport", "diagnostics", "pharmacy"];

      let lineTotal = 0;

      if (packageBasedOptions.includes(optionKey)) {
        lineTotal = +Number(unitPrice).toFixed(2);
      } else if (
        ["homeSampleCollection", "prioritySupport"].includes(optionKey)
      ) {
        lineTotal = qty > 0 ? +Number(unitPrice).toFixed(2) : 0;
      } else {
        lineTotal = +(Number(qty) * Number(unitPrice)).toFixed(2);
      }

      builtOptions.push({
        optionKey,
        label: label || optionKey,
        quantity: qty,
        unitPrice,
        lineTotal,
        ...(optionKey === "careAssistant" && { careAssistantTierIndex }),
        ...(optionKey === "transport" && { slabIndex }),
      });
    }

    // ─────────────────────────────────────────────
    // TOTAL
    // ─────────────────────────────────────────────

    const totalMonthly = +builtOptions
      .reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
      .toFixed(2);

    const slug = `custom-${req.user._id}-${Date.now()}`;

    // ─────────────────────────────────────────────
    // DEACTIVATE OLD CUSTOM PLANS
    // ─────────────────────────────────────────────

    await SubscriptionPlan.updateMany(
      {
        planType: "custom",
        createdByCustomer: req.user._id,
        isActive: true,
      },
      { $set: { isActive: false } },
    );

    // ─────────────────────────────────────────────
    // CREATE PLAN
    // ─────────────────────────────────────────────

    const plan = await SubscriptionPlan.create({
      name,
      slug,
      planType: "custom",
      fixedTier: null,
      visibleToCustomerOnly: true,
      createdByCustomer: req.user._id,
      isActive: true,
      pricing: {
        monthly: totalMonthly,
        billingCycle: "custom",
        billingLabel: "/month",
        currency: "INR",
      },
      customOptions: builtOptions,
      createdBy: req.user._id,
    });

    await log({
      level: "success",
      category: "user",
      message: `Custom plan created by customer: ${plan.name}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "SubscriptionPlan",
        entityId: plan._id,
        label: plan.name,
      },
      request: { method: "POST", path: req.originalUrl, statusCode: 201 },
      metadata: {
        planId: plan._id,
        totalMonthly,
        optionCount: builtOptions.length,
      },
    });

    return res.status(201).json({ success: true, data: plan });
  });

// PUT "/custom-plan/:planId"
export const putCustomPlanByPlanId = asyncHandler(async (req, res) => {
    const plan = await SubscriptionPlan.findOne({
      _id: req.params.planId,
      planType: "custom",
      createdByCustomer: req.user._id,
      isActive: true,
    });

    if (!plan)
      return res
        .status(404)
        .json({
          success: false,
          message: "Custom plan not found or you do not own it.",
        });

    const linked = await UserSubscription.exists({
      plan: plan._id,
      status: { $in: ["Active", "Trial"] },
    });
    if (linked)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Cannot edit a custom plan linked to an active or trial subscription.",
        });

    const { name, options } = req.body;

    const config = await PlatformPricingConfig.getGlobal();
    const optionPrices = config.customPlanOptions;
    const caps = config.caps;
    const caTiers = optionPrices?.careAssistant?.pricingTiers ?? [];

    const builtOptions = [];

    for (const opt of options) {
      const { optionKey, label = "" } = opt;
      let qty = Number(opt.quantity);

      if (optionKey === "pharmacy" && qty > caps.pharmacyDiscountMax)
        return res
          .status(400)
          .json({
            success: false,
            message: `Pharmacy discount cannot exceed ${caps.pharmacyDiscountMax}%.`,
          });
      if (optionKey === "diagnostics" && qty > caps.diagnosticsDiscountMax)
        return res
          .status(400)
          .json({
            success: false,
            message: `Diagnostics discount cannot exceed ${caps.diagnosticsDiscountMax}%.`,
          });
      if (optionKey === "consultations" && qty > caps.consultationsMaxPerMonth)
        return res
          .status(400)
          .json({
            success: false,
            message: `Consultations cannot exceed ${caps.consultationsMaxPerMonth}/month.`,
          });
      if (
        optionKey === "careAssistant" &&
        qty > caps.careAssistantMaxVisitsPerMonth
      )
        return res
          .status(400)
          .json({
            success: false,
            message: `Care-assistant visits cannot exceed ${caps.careAssistantMaxVisitsPerMonth}/month.`,
          });
      if (optionKey === "transport" && qty > caps.transportMaxRidesPerMonth)
        return res
          .status(400)
          .json({
            success: false,
            message: `Transport rides cannot exceed ${caps.transportMaxRidesPerMonth}/month.`,
          });

      if (["homeSampleCollection", "prioritySupport"].includes(optionKey))
        qty = qty > 0 ? 1 : 0;

      let careAssistantTierIndex = 0;
      if (optionKey === "careAssistant") {
        const requestedIdx = Number(opt.careAssistantTierIndex ?? 0);
        if (caTiers.length === 0)
          return res
            .status(400)
            .json({
              success: false,
              message:
                "Care assistant pricing tiers not configured. Contact admin.",
            });
        if (requestedIdx < 0 || requestedIdx >= caTiers.length)
          return res
            .status(400)
            .json({
              success: false,
              message: `careAssistantTierIndex must be between 0 and ${caTiers.length - 1}.`,
            });
        careAssistantTierIndex = requestedIdx;
      }

      let slabIndex = 0;
      if (optionKey === "transport") {
        const totalSlabs = (optionPrices?.transport?.kmSlabs ?? []).length;
        const requestedSlabIdx = Number(opt.slabIndex ?? 0);
        if (totalSlabs === 0)
          return res
            .status(400)
            .json({
              success: false,
              message: "Transport slabs not configured. Contact admin.",
            });
        if (requestedSlabIdx < 0 || requestedSlabIdx >= totalSlabs)
          return res
            .status(400)
            .json({
              success: false,
              message: `slabIndex must be between 0 and ${totalSlabs - 1}.`,
            });
        slabIndex = requestedSlabIdx;
      }

      const extras = { careAssistantTierIndex, slabIndex };
      const unitPrice = resolveCustomOptionUnitPrice(
        optionPrices,
        optionKey,
        qty,
        extras,
      );

      const packageBasedOptions = ["transport", "diagnostics", "pharmacy"];
      let lineTotal;
      if (packageBasedOptions.includes(optionKey)) {
        lineTotal = +Number(unitPrice).toFixed(2);
      } else if (
        ["homeSampleCollection", "prioritySupport"].includes(optionKey)
      ) {
        lineTotal = qty > 0 ? +Number(unitPrice).toFixed(2) : 0;
      } else {
        lineTotal = +(qty * unitPrice).toFixed(2);
      }

      builtOptions.push({
        optionKey,
        label: label || optionKey,
        quantity: qty,
        unitPrice,
        lineTotal,
        ...(optionKey === "careAssistant" && { careAssistantTierIndex }),
        ...(optionKey === "transport" && { slabIndex }),
      });
    }

    if (name) plan.name = name;
    plan.customOptions = builtOptions;
    plan.updatedBy = req.user._id;
    await plan.save();

    await log({
      level: "info",
      category: "user",
      message: `Custom plan updated by customer`,
      actor: buildActor(req),
      relatedEntity: {
        model: "SubscriptionPlan",
        entityId: plan._id,
        label: plan.name,
      },
      request: { method: "PUT", path: req.originalUrl, statusCode: 200 },
      metadata: { planId: plan._id, newTotal: plan.pricing.monthly },
    });

    res.status(200).json({ success: true, data: plan });
  });

// DELETE "/custom-plan/:planId"
export const deleteCustomPlanByPlanId = asyncHandler(async (req, res) => {
    const plan = await SubscriptionPlan.findOne({
      _id: req.params.planId,
      planType: "custom",
      createdByCustomer: req.user._id,
      isActive: true,
    });

    if (!plan)
      return res
        .status(404)
        .json({
          success: false,
          message: "Custom plan not found or already inactive.",
        });

    const linked = await UserSubscription.exists({
      plan: plan._id,
      status: { $in: ["Active", "Trial"] },
    });
    if (linked)
      return res
        .status(400)
        .json({
          success: false,
          message: "Cannot delete a plan linked to an active subscription.",
        });

    plan.isActive = false;
    plan.updatedBy = req.user._id;
    await plan.save();

    await log({
      level: "warning",
      category: "user",
      message: `Custom plan deactivated by customer`,
      actor: buildActor(req),
      relatedEntity: {
        model: "UserSubscription",
        entityId: plan._id,
        label: plan.name,
      },
      request: { method: "DELETE", path: req.originalUrl, statusCode: 200 },
    });

    res
      .status(200)
      .json({ success: true, message: "Custom plan deactivated." });
  });

// POST "/buy"
export const postBuy = asyncHandler(async (req, res) => {
    const { planId, amount, couponCode } = req.body;

    const existingSub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
      expiryDate: { $gt: new Date() },
    });
    if (existingSub)
      return res
        .status(400)
        .json({
          success: false,
          message: "You already have an active subscription or trial.",
        });

    const plan = await SubscriptionPlan.findOne({
      _id: planId,
      isActive: true,
    });
    if (!plan)
      return res
        .status(404)
        .json({ success: false, message: "Plan not found." });

    if (
      plan.planType === "custom" &&
      String(plan.createdByCustomer) !== String(req.user._id)
    )
      return res
        .status(403)
        .json({
          success: false,
          message: "You do not have access to this custom plan.",
        });

    let discount = 0;
    if (couponCode) {
      const coupon = await PromotionCoupon.findOne({
        code: couponCode,
        isActive: true,
        "validity.to": { $gt: new Date() },
      });
      if (coupon) {
        discount =
          coupon.benefit.type === "Flat_Amount"
            ? coupon.benefit.value
            : (Number(amount) * coupon.benefit.value) / 100;
      }
    }

    const finalAmount = Math.max(Number(amount) - discount, 0);

    // PATH B: ₹0 — activate immediately
    if (finalAmount === 0) {
      const expiry = new Date();
      if (plan.pricing.billingCycle === "till_delivery") {
        expiry.setDate(expiry.getDate() + 280);
      } else {
        expiry.setDate(expiry.getDate() + 30);
      }

      const sub = await UserSubscription.create({
        user: req.user._id,
        plan: planId,
        planName: plan.name,
        planType: plan.planType,
        fixedTier: plan.fixedTier ?? null,
        status: "Active",
        expiryDate: expiry,
        autoRenew: plan.pricing.billingCycle !== "till_delivery",
        limits: snapshotLimits(plan),
        paymentHistory: [],
      });

      await Notification.create({
        recipient: req.user._id,
        title: "Subscription Activated 🎉",
        body: `Your ${plan.name} plan is now active until ${expiry.toLocaleDateString()}.`,
        type: "Account_Status",
        priority: "Normal",
        dedupeKey: `sub_activate_${req.user._id}_${Date.now()}`,
      });

      await log({
        level: "success",
        category: "payment",
        message: `Free subscription activated: ${plan.name}`,
        actor: buildActor(req),
        relatedEntity: {
          model: "UserSubscription",
          entityId: sub._id,
          label: plan.name,
        },
        request: { method: "POST", path: req.originalUrl, statusCode: 201 },
        metadata: { planId, finalAmount: 0, discount },
      });

      return res.status(201).json({
        success: true,
        activated: true,
        message: "Subscription activated for free.",
        data: sub,
      });
    }

    // PATH A: paid — Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        planId: planId.toString(),
        isUpgrade: "false",
      },
    });

    await log({
      level: "info",
      category: "payment",
      message: `Razorpay order created for plan: ${plan.name}`,
      actor: buildActor(req),
      request: { method: "POST", path: req.originalUrl, statusCode: 200 },
      metadata: { planId, finalAmount, discount, orderId: razorpayOrder.id },
    });

    res.status(200).json({
      success: true,
      activated: false,
      orderId: razorpayOrder.id,
      amount: finalAmount,
      discount,
      planName: plan.name,
      planType: plan.planType,
      planId,
    });
  });

// POST "/verify"
export const postVerify = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    let { planId, amount } = req.body;

    // Signature verification
    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    if (hmac.digest("hex") !== razorpay_signature) {
      await log({
        level: "error",
        category: "security",
        message: "Invalid Razorpay payment signature detected",
        actor: buildActor(req),
        request: { method: "POST", path: req.originalUrl, statusCode: 400 },
        metadata: { razorpay_order_id, razorpay_payment_id },
      });
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature." });
    }

    let isUpgradeOrder = false;

    // Resolve planId / amount / isUpgrade from Razorpay order notes
    try {
      const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
      if (!planId) planId = rzpOrder.notes?.planId;
      if (amount === undefined) amount = rzpOrder.amount / 100;
      if (rzpOrder.notes?.isUpgrade === "true") isUpgradeOrder = true;
    } catch {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Could not resolve plan details from Razorpay order. Please supply planId and amount.",
        });
    }

    if (!planId)
      return res
        .status(400)
        .json({ success: false, message: "planId is required." });

    const plan = await SubscriptionPlan.findById(planId);
    if (!plan)
      return res
        .status(404)
        .json({ success: false, message: "Plan not found." });

    if (
      plan.planType === "custom" &&
      String(plan.createdByCustomer) !== String(req.user._id)
    )
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied to this custom plan.",
        });

    const activeSub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
      expiryDate: { $gt: new Date() },
    });

    // Duplicate sub guard (Ignore if this is an upgrade)
    if (activeSub && !isUpgradeOrder) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Subscription already active. Possible duplicate payment — contact support if amount was deducted.",
        });
    }

    const expiry = new Date();
    if (plan.pricing.billingCycle === "till_delivery") {
      expiry.setDate(expiry.getDate() + 280);
    } else {
      expiry.setDate(expiry.getDate() + 30);
    }

    if (isUpgradeOrder && activeSub) {
      // === PROCESS UPGRADE: UPDATE EXISTING SUBSCRIPTION ===
      const previousStatus = activeSub.status;

      activeSub.plan = planId;
      activeSub.planName = plan.name;
      activeSub.planType = plan.planType;
      activeSub.fixedTier = plan.fixedTier ?? null;
      activeSub.status = "Active";
      activeSub.expiryDate = expiry;
      activeSub.autoRenew = plan.pricing.billingCycle !== "till_delivery";
      activeSub.limits = snapshotLimits(plan);

      if (previousStatus === "Trial") activeSub.trialUsed = true;

      activeSub.paymentHistory.push({
        transactionId: razorpay_payment_id,
        amount: Number(amount),
        paidAt: new Date(),
      });

      await activeSub.save();

      await Notification.create({
        recipient: req.user._id,
        title: "Plan Upgraded 🎉",
        body: `Your plan has been upgraded to ${plan.name}. New expiry: ${expiry.toLocaleDateString()}.`,
        type: "Account_Status",
        priority: "Normal",
        dedupeKey: `sub_verify_${razorpay_payment_id}`,
      });

      await log({
        level: "success",
        category: "payment",
        message: `Subscription upgraded via Razorpay: ${plan.name}`,
        actor: buildActor(req),
        relatedEntity: {
          model: "UserSubscription",
          entityId: activeSub._id,
          label: plan.name,
        },
        request: { method: "POST", path: req.originalUrl, statusCode: 200 },
        metadata: {
          planId,
          amount,
          razorpay_payment_id,
          razorpay_order_id,
          isUpgrade: true,
        },
      });

      return res.status(200).json({ success: true, data: activeSub });
    } else {
      // === PROCESS NEW BUY: CREATE NEW SUBSCRIPTION ===
      const sub = await UserSubscription.create({
        user: req.user._id,
        plan: planId,
        planName: plan.name,
        planType: plan.planType,
        fixedTier: plan.fixedTier ?? null,
        status: "Active",
        expiryDate: expiry,
        autoRenew: plan.pricing.billingCycle !== "till_delivery",
        limits: snapshotLimits(plan),
        paymentHistory: [
          {
            transactionId: razorpay_payment_id,
            amount: Number(amount),
            paidAt: new Date(),
          },
        ],
      });

      await Notification.create({
        recipient: req.user._id,
        title: "Subscription Activated 🎉",
        body: `Your ${plan.name} plan is now active until ${expiry.toLocaleDateString()}.`,
        type: "Account_Status",
        priority: "Normal",
        dedupeKey: `sub_verify_${razorpay_payment_id}`,
      });

      await log({
        level: "success",
        category: "payment",
        message: `Subscription activated via Razorpay: ${plan.name}`,
        actor: buildActor(req),
        relatedEntity: {
          model: "UserSubscription",
          entityId: sub._id,
          label: plan.name,
        },
        request: { method: "POST", path: req.originalUrl, statusCode: 201 },
        metadata: {
          planId,
          amount,
          razorpay_payment_id,
          razorpay_order_id,
          isUpgrade: false,
        },
      });

      return res.status(201).json({ success: true, data: sub });
    }
  });

// POST "/flush-pending-usage"
export const postFlushPendingUsage = asyncHandler(async (req, res) => {
    const { bookingId } = req.body;

    if (!bookingId)
      return res
        .status(400)
        .json({ success: false, message: "bookingId required." });

    const booking = await Booking.findById(bookingId)
      .select("subscriptionUsagePending customer")
      .lean();
    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found." });

    const isAdmin = ["admin", "superadmin"].includes(req.user?.role);
    if (!isAdmin && String(booking.customer) !== String(req.user._id))
      return res
        .status(403)
        .json({ success: false, message: "Not authorised." });

    const pending = booking.subscriptionUsagePending || [];

    if (pending.length === 0) {
      return res
        .status(200)
        .json({
          success: true,
          message: "No pending usage to flush.",
          flushed: 0,
        });
    }

    let flushed = 0;
    const now = new Date();

    for (const { subId, field } of pending) {
      if (!subId || !field) continue;

      const updated = await UserSubscription.findOneAndUpdate(
        {
          _id: subId,
          "usageHistory.month": now.getMonth() + 1,
          "usageHistory.year": now.getFullYear(),
        },
        { $inc: { [`usageHistory.$.${field}`]: 1 } },
      );

      if (!updated) {
        await UserSubscription.findByIdAndUpdate(subId, {
          $push: {
            usageHistory: {
              month: now.getMonth() + 1,
              year: now.getFullYear(),
              [field]: 1,
            },
          },
        });
      }

      flushed++;
    }

    await Booking.findByIdAndUpdate(bookingId, {
      $set: { subscriptionUsagePending: [] },
    });

    await log({
      level: "info",
      category: "system",
      message: `Flushed ${flushed} pending subscription usage increments for booking ${bookingId}`,
      actor: buildActor(req),
      request: { method: "POST", path: req.originalUrl, statusCode: 200 },
      metadata: { bookingId, flushed, pending },
    });

    return res.status(200).json({ success: true, flushed, pending });
  });

// GET "/my"
export const getMy = asyncHandler(async (req, res) => {
    // 1. Primary holder — active/trial sub
    const sub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
    })
      .populate("plan")
      .lean();

    if (sub) {
      return res
        .status(200)
        .json({ success: true, isShared: false, data: sub });
    }

    // 2. Family member on someone else's sub
    // Query both raw lowercase AND dot-stripped variant to handle normalizeEmail() mismatch
    const rawEmail = req.user.email.toLowerCase().trim();
    const dotStripped = rawEmail.replace(/\./g, "").replace(/@/, (m, o, s) => {
      // only strip dots before @
      const [local, domain] = rawEmail.split("@");
      return "@";
    });
    const localStripped =
      rawEmail.split("@")[0].replace(/\./g, "") + "@" + rawEmail.split("@")[1];

    const emailVariants = [...new Set([rawEmail, localStripped])];

    const sharedSub = await UserSubscription.findOne({
      "members.memberEmail": { $in: emailVariants },
      status: { $in: ["Active", "Trial"] },
    })
      .populate("plan")
      .populate("user", "name email phone avatar")
      .lean();

    if (sharedSub) {
      return res.status(200).json({
        success: true,
        isShared: true,
        primaryAccountHolder: sharedSub.user,
        data: sharedSub,
      });
    }

    // 3. Fallback — latest any-status sub for this user
    const latest = await UserSubscription.findOne({ user: req.user._id })
      .populate("plan")
      .sort({ createdAt: -1 })
      .lean();

    if (!latest)
      return res
        .status(404)
        .json({ success: false, message: "No subscription found." });

    return res
      .status(200)
      .json({ success: true, isShared: false, data: latest });
  });

// GET "/my/history"
export const getMyHistory = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const [total, subs] = await Promise.all([
      UserSubscription.countDocuments({ user: req.user._id }),
      UserSubscription.find({ user: req.user._id })
        .populate("plan")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      pagination: { total, page, pages: Math.ceil(total / limit) },
      data: subs,
    });
  });

// PUT "/upgrade"
export const putUpgrade = asyncHandler(async (req, res) => {
    const { newPlanId, amount, couponCode } = req.body;

    const sub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
    });
    if (!sub)
      return res
        .status(400)
        .json({
          success: false,
          message: "No active or trial subscription found.",
        });

    const newPlan = await SubscriptionPlan.findOne({
      _id: newPlanId,
      isActive: true,
    });
    if (!newPlan)
      return res
        .status(404)
        .json({ success: false, message: "New plan not found." });

    if (
      newPlan.planType === "custom" &&
      String(newPlan.createdByCustomer) !== String(req.user._id)
    )
      return res
        .status(403)
        .json({
          success: false,
          message: "You do not have access to this custom plan.",
        });

    let discount = 0;
    let baseAmount = amount !== undefined ? amount : newPlan.pricing.monthly;

    if (couponCode) {
      const coupon = await PromotionCoupon.findOne({
        code: couponCode,
        isActive: true,
        "validity.to": { $gt: new Date() },
      });
      if (coupon) {
        discount =
          coupon.benefit.type === "Flat_Amount"
            ? coupon.benefit.value
            : (Number(baseAmount) * coupon.benefit.value) / 100;
      }
    }

    const finalAmount = Math.max(Number(baseAmount) - discount, 0);

    // Path B: ₹0 — activate immediately (Free Upgrade)
    if (finalAmount === 0) {
      const previousPlan = sub.plan;
      const previousStatus = sub.status;

      sub.plan = newPlan._id;
      sub.planName = newPlan.name;
      sub.planType = newPlan.planType;
      sub.fixedTier = newPlan.fixedTier ?? null;
      sub.status = "Active";
      sub.limits = snapshotLimits(newPlan);

      const newExpiry = new Date();
      if (newPlan.pricing.billingCycle === "till_delivery") {
        newExpiry.setDate(newExpiry.getDate() + 280);
      } else {
        newExpiry.setDate(newExpiry.getDate() + 30);
      }
      sub.expiryDate = newExpiry;

      if (previousStatus === "Trial") sub.trialUsed = true;

      await sub.save();

      await Notification.create({
        recipient: req.user._id,
        title: "Plan Upgraded 🎉",
        body: `Your plan has been switched to ${newPlan.name}. New expiry: ${newExpiry.toLocaleDateString()}.`,
        type: "Account_Status",
        priority: "Normal",
        dedupeKey: `sub_upgrade_${req.user._id}_${Date.now()}`,
      });

      await log({
        level: "info",
        category: "user",
        message: `Subscription plan upgraded (Free): ${newPlan.name}`,
        actor: buildActor(req),
        relatedEntity: {
          model: "UserSubscription",
          entityId: sub._id,
          label: newPlan.name,
        },
        request: { method: "PUT", path: req.originalUrl, statusCode: 200 },
        metadata: {
          previousPlan,
          previousStatus,
          newPlanId: newPlan._id,
          finalAmount: 0,
        },
      });

      return res
        .status(200)
        .json({ success: true, activated: true, data: sub });
    }

    // Path A: Paid Upgrade - Generate Razorpay Order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `upg_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        planId: newPlanId.toString(),
        isUpgrade: "true",
      },
    });

    await log({
      level: "info",
      category: "payment",
      message: `Razorpay order created for upgrade: ${newPlan.name}`,
      actor: buildActor(req),
      request: { method: "PUT", path: req.originalUrl, statusCode: 200 },
      metadata: { newPlanId, finalAmount, discount, orderId: razorpayOrder.id },
    });

    res.status(200).json({
      success: true,
      activated: false,
      orderId: razorpayOrder.id,
      amount: finalAmount,
      discount,
      planName: newPlan.name,
      planType: newPlan.planType,
      planId: newPlanId,
    });
  });

// PUT "/cancel"
export const putCancel = asyncHandler(async (req, res) => {
    const sub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
    });
    if (!sub)
      return res
        .status(400)
        .json({
          success: false,
          message: "No active or trial subscription to cancel.",
        });

    sub.status = "Cancelled";
    sub.autoRenew = false;
    sub.cancelledAt = new Date();
    sub.cancellationReason = req.body.reason ?? null;
    await sub.save();

    await Notification.create({
      recipient: req.user._id,
      title: "Subscription Cancelled",
      body: "Your subscription has been cancelled. You retain access until the current period ends.",
      type: "Account_Status",
      priority: "Normal",
      dedupeKey: `sub_cancel_${req.user._id}_${Date.now()}`,
    });

    await log({
      level: "warning",
      category: "user",
      message: `Subscription cancelled by customer`,
      actor: buildActor(req),
      relatedEntity: {
        model: "UserSubscription",
        entityId: sub._id,
        label: sub.planName,
      },
      request: { method: "PUT", path: req.originalUrl, statusCode: 200 },
      metadata: { reason: sub.cancellationReason },
    });

    res
      .status(200)
      .json({ success: true, message: "Subscription cancelled.", data: sub });
  });

// PUT "/toggle-auto-renew"
export const putToggleAutoRenew = asyncHandler(async (req, res) => {
    const sub = await UserSubscription.findOne({
      user: req.user._id,
      status: "Active",
    });
    if (!sub)
      return res
        .status(400)
        .json({ success: false, message: "No active subscription found." });

    sub.autoRenew = !sub.autoRenew;
    await sub.save();

    await log({
      level: "info",
      category: "user",
      message: `Auto-renew toggled: ${sub.autoRenew ? "enabled" : "disabled"}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "UserSubscription",
        entityId: sub._id,
        label: sub.planName,
      },
      request: { method: "PUT", path: req.originalUrl, statusCode: 200 },
    });

    res.status(200).json({
      success: true,
      autoRenew: sub.autoRenew,
      message: `Auto-renew ${sub.autoRenew ? "enabled" : "disabled"}.`,
    });
  });

// POST "/free-trial/start"
export const postFreeTrialStart = asyncHandler(async (req, res) => {
    const { planId, razorpay_payment_method_id } = req.body;

    const plan = await SubscriptionPlan.findOne({
      _id: planId,
      isActive: true,
    });
    if (!plan)
      return res
        .status(404)
        .json({ success: false, message: "Plan not found." });
    if (!plan.freeTrial?.enabled)
      return res
        .status(400)
        .json({
          success: false,
          message: "This plan does not offer a free trial.",
        });
    if (
      plan.planType === "custom" &&
      String(plan.createdByCustomer) !== String(req.user._id)
    )
      return res
        .status(403)
        .json({
          success: false,
          message: "You do not have access to this custom plan.",
        });

    const previousTrial = await UserSubscription.findOne({
      user: req.user._id,
      trialUsed: true,
    });
    if (previousTrial)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "You have already used your free trial. Each account is eligible for one trial only.",
        });

    const activeSub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
      expiryDate: { $gt: new Date() },
    });
    if (activeSub)
      return res
        .status(400)
        .json({
          success: false,
          message: "You already have an active subscription or ongoing trial.",
        });

    if (plan.freeTrial.requiresPaymentMethod && !razorpay_payment_method_id)
      return res
        .status(400)
        .json({
          success: false,
          message:
            "This plan requires a saved payment method to start a free trial.",
        });

    const trialDays = plan.freeTrial.durationDays || 7;
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + trialDays);

    const sub = await UserSubscription.create({
      user: req.user._id,
      plan: plan._id,
      planName: plan.name,
      planType: plan.planType,
      fixedTier: plan.fixedTier ?? null,
      status: "Trial",
      expiryDate: trialExpiry,
      autoRenew: false,
      trialUsed: true,
      limits: snapshotLimits(plan),
      ...(razorpay_payment_method_id && {
        savedPaymentMethodId: razorpay_payment_method_id,
      }),
      paymentHistory: [],
    });

    await Notification.create({
      recipient: req.user._id,
      title: `Your ${trialDays}-Day Free Trial Has Started!`,
      body: `Enjoy full access to ${plan.name} until ${trialExpiry.toLocaleDateString()}. Subscribe before your trial ends to continue uninterrupted.`,
      type: "Account_Status",
      priority: "Normal",
      dedupeKey: `trial_start_${req.user._id}_${Date.now()}`,
    });

    await log({
      level: "success",
      category: "user",
      message: `Free trial started: ${plan.name}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "UserSubscription",
        entityId: sub._id,
        label: plan.name,
      },
      request: { method: "POST", path: req.originalUrl, statusCode: 201 },
      metadata: { trialDays, trialExpiry },
    });

    try {
      const emailHtml = transactionalTemplate({
        header: "FREE TRIAL",
        title: "Your Free Trial is Active",
        body: `Hi ${req.user.name},<br><br>Your <b>${trialDays}-day free trial</b> for the <b>${plan.name}</b> plan is now active.<br><br>Trial ends on: <b>${trialExpiry.toLocaleDateString()}</b>.`,
        buttonText: "Explore Your Plan",
        buttonLink: "https://likeson.in/dashboard/subscription",
      });
      await sendEmail({
        email: req.user.email,
        subject: `Your ${trialDays}-day free trial for ${plan.name} is now active`,
        html: emailHtml,
      });
    } catch (_) {
      /* email failure must not block response */
    }

    res.status(201).json({
      success: true,
      message: `Free trial started. Enjoy ${trialDays} days of ${plan.name}.`,
      trialExpiry,
      data: sub,
    });
  });

// GET "/free-trial/eligibility"
export const getFreeTrialEligibility = asyncHandler(async (req, res) => {
    const previous = await UserSubscription.findOne({
      user: req.user._id,
      trialUsed: true,
    });
    if (previous) {
      return res.status(200).json({
        success: true,
        eligible: false,
        reason:
          "Free trial already used. Each account is eligible for one trial only.",
        eligiblePlans: [],
      });
    }

    const activeSub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
      expiryDate: { $gt: new Date() },
    }).populate("plan", "name fixedTier");

    if (activeSub) {
      return res.status(200).json({
        success: true,
        eligible: false,
        reason: `You currently have an active ${activeSub.status === "Trial" ? "trial" : "subscription"} (${activeSub.plan?.name || "plan"}).`,
        eligiblePlans: [],
      });
    }

    const eligiblePlans = await SubscriptionPlan.find({
      isActive: true,
      "freeTrial.enabled": true,
      planType: "fixed",
    })
      .select("name slug fixedTier freeTrial pricing badgeLabel")
      .sort({ displayOrder: 1 })
      .lean();

    res
      .status(200)
      .json({ success: true, eligible: true, reason: null, eligiblePlans });
  });

// GET "/free-trial/status"
export const getFreeTrialStatus = asyncHandler(async (req, res) => {
    const trial = await UserSubscription.findOne({
      user: req.user._id,
      status: "Trial",
    }).populate("plan");

    if (!trial)
      return res
        .status(404)
        .json({
          success: false,
          activeTrial: false,
          message: "No active trial found.",
        });

    const now = new Date();
    const daysLeft = Math.max(
      Math.ceil((trial.expiryDate - now) / (1000 * 60 * 60 * 24)),
      0,
    );

    res.status(200).json({
      success: true,
      activeTrial: trial.expiryDate > now,
      daysLeft,
      trialExpiry: trial.expiryDate,
      plan: trial.plan,
      data: trial,
    });
  });

// POST "/free-trial/convert"
export const postFreeTrialConvert = asyncHandler(async (req, res) => {
    const { couponCode } = req.body;

    const trial = await UserSubscription.findOne({
      user: req.user._id,
      status: "Trial",
    }).populate("plan");

    if (!trial)
      return res
        .status(400)
        .json({ success: false, message: "No active trial found to convert." });

    const plan = trial.plan;
    let amount = plan.pricing.monthly;

    let discount = 0;
    if (couponCode) {
      const coupon = await PromotionCoupon.findOne({
        code: couponCode,
        isActive: true,
        "validity.to": { $gt: new Date() },
      });
      if (coupon) {
        discount =
          coupon.benefit.type === "Flat_Amount"
            ? coupon.benefit.value
            : (amount * coupon.benefit.value) / 100;
      }
    }

    const finalAmount = Math.max(amount - discount, 0);

    // PATH B: ₹0
    if (finalAmount === 0) {
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 30);

      trial.status = "Active";
      trial.expiryDate = newExpiry;
      trial.autoRenew = true;
      await trial.save();

      await Notification.create({
        recipient: req.user._id,
        title: "Trial Converted — Welcome Aboard! 🎉",
        body: `Your ${plan.name} subscription is now fully active until ${newExpiry.toLocaleDateString()}.`,
        type: "Account_Status",
        priority: "Normal",
        dedupeKey: `trial_convert_free_${req.user._id}_${Date.now()}`,
      });

      await log({
        level: "success",
        category: "payment",
        message: `Trial converted to free paid subscription: ${plan.name}`,
        actor: buildActor(req),
        relatedEntity: {
          model: "UserSubscription",
          entityId: trial._id,
          label: plan.name,
        },
        request: { method: "POST", path: req.originalUrl, statusCode: 200 },
      });

      return res
        .status(200)
        .json({
          success: true,
          activated: true,
          message: "Trial converted to a free paid subscription.",
          data: trial,
        });
    }

    // PATH A: paid — Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: `trial_conv_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        planId: plan._id.toString(),
        isTrialConvert: "true",
        isUpgrade: "false",
      },
    });

    res.status(200).json({
      success: true,
      activated: false,
      message: "Complete payment to convert your trial to a paid subscription.",
      orderId: razorpayOrder.id,
      amount: finalAmount,
      discount,
      planName: plan.name,
      trialSubId: trial._id,
    });
  });

// POST "/my/members"
export const postMyMembers = asyncHandler(async (req, res) => {
    const { email, relation } = req.body;

    // 1. Find the user's active subscription
    const sub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
    }).populate("plan");

    if (!sub) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You do not have an active subscription to add members to.",
        });
    }

    // 2. Enforce Plan Constraints
    const maxMembers = sub.plan?.membership?.maxMembers || 1;
    if (maxMembers <= 1) {
      return res
        .status(403)
        .json({
          success: false,
          message: `Your current plan (${sub.planName}) does not support adding family members. Please upgrade to a Family or NRI plan.`,
        });
    }

    const allowedSlots = maxMembers - 1; // Primary user counts as 1
    if (sub.members.length >= allowedSlots) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Member limit reached. Your plan allows a maximum of ${maxMembers} members (including you).`,
        });
    }

    // 3. Validate the invitee
    if (email === req.user.email) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You cannot add yourself as a family member.",
        });
    }

    const alreadyExists = sub.members.some((m) => m.memberEmail === email);
    if (alreadyExists) {
      return res
        .status(400)
        .json({
          success: false,
          message: "This email is already added to your plan.",
        });
    }

    // 4. Resolve Invitee Account Status
    const inviteeAccount = await User.findOne({ email });

    if (inviteeAccount) {
      // Guard: Prevent adding someone who already has their own active plan
      const inviteeHasOwnPlan = await UserSubscription.exists({
        user: inviteeAccount._id,
        status: { $in: ["Active", "Trial"] },
      });
      if (inviteeHasOwnPlan) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "This user already has their own active subscription on the platform.",
          });
      }

      // Guard: Prevent adding someone who is already part of another family plan
      const inviteeInAnotherPlan = await UserSubscription.exists({
        "members.memberEmail": email,
        status: { $in: ["Active", "Trial"] },
      });
      if (inviteeInAnotherPlan) {
        return res
          .status(400)
          .json({
            success: false,
            message: "This user is already covered under another family plan.",
          });
      }
    }

    // 5. Add Member
    sub.members.push({
      memberId: inviteeAccount ? inviteeAccount._id : null,
      memberEmail: email,
      relation: relation,
      addedAt: new Date(),
    });

    await sub.save();

    // 6. Notifications & Logs
    if (inviteeAccount) {
      await Notification.create({
        recipient: inviteeAccount._id,
        title: "You have been added to a Family Plan! 🎉",
        body: `${req.user.name} has added you to their ${sub.planName}. You can now access plan benefits from your dashboard.`,
        type: "Account_Status",
        priority: "Normal",
        dedupeKey: `member_add_${sub._id}_${inviteeAccount._id}_${Date.now()}`,
      });
    }

    await log({
      level: "info",
      category: "user",
      message: `Family member added to subscription: ${email}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "UserSubscription",
        entityId: sub._id,
        label: sub.planName,
      },
      request: { method: "POST", path: req.originalUrl, statusCode: 200 },
      metadata: {
        addedEmail: email,
        relation,
        totalMembers: sub.members.length + 1,
      },
    });

    res.status(200).json({
      success: true,
      message: inviteeAccount
        ? "Member added successfully. They can now access your plan."
        : "Member added successfully. They will gain access once they create an account with this email.",
      data: sub.members,
    });
  });

// DELETE "/my/members/:email"
export const deleteMyMembersByEmail = asyncHandler(async (req, res) => {
    const targetEmail = req.params.email;

    const sub = await UserSubscription.findOne({
      user: req.user._id,
      status: { $in: ["Active", "Trial"] },
    });

    if (!sub) {
      return res
        .status(400)
        .json({ success: false, message: "No active subscription found." });
    }

    const initialLength = sub.members.length;
    sub.members = sub.members.filter((m) => m.memberEmail !== targetEmail);

    if (sub.members.length === initialLength) {
      return res
        .status(404)
        .json({ success: false, message: "Member not found in your plan." });
    }

    await sub.save();

    const removedUser = await User.findOne({ email: targetEmail });
    if (removedUser) {
      await Notification.create({
        recipient: removedUser._id,
        title: "Removed from Family Plan",
        body: `You have been removed from ${req.user.name}'s ${sub.planName}.`,
        type: "Account_Status",
        priority: "Normal",
        dedupeKey: `member_remove_${sub._id}_${removedUser._id}_${Date.now()}`,
      });
    }

    await log({
      level: "info",
      category: "user",
      message: `Family member removed from subscription: ${targetEmail}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "UserSubscription",
        entityId: sub._id,
        label: sub.planName,
      },
      request: { method: "DELETE", path: req.originalUrl, statusCode: 200 },
      metadata: { removedEmail: targetEmail },
    });

    res
      .status(200)
      .json({
        success: true,
        message: "Member removed successfully.",
        data: sub.members,
      });
  });

// POST "/free-trial/verify-convert"
export const postFreeTrialVerifyConvert = asyncHandler(async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    let { amount } = req.body;

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    if (hmac.digest("hex") !== razorpay_signature) {
      await log({
        level: "error",
        category: "security",
        message: "Invalid Razorpay signature on trial-convert",
        actor: buildActor(req),
        request: { method: "POST", path: req.originalUrl, statusCode: 400 },
        metadata: { razorpay_order_id },
      });
      return res
        .status(400)
        .json({ success: false, message: "Invalid payment signature." });
    }

    if (amount === undefined) {
      try {
        const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
        amount = rzpOrder.amount / 100;
      } catch (_) {
        amount = 0;
      }
    }

    const trial = await UserSubscription.findOne({
      user: req.user._id,
      status: "Trial",
    }).populate("plan");
    if (!trial)
      return res
        .status(400)
        .json({
          success: false,
          message: "No active trial found for this account.",
        });

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);

    trial.status = "Active";
    trial.expiryDate = newExpiry;
    trial.autoRenew = true;
    trial.paymentHistory.push({
      transactionId: razorpay_payment_id,
      amount: Number(amount),
      paidAt: new Date(),
    });
    await trial.save();

    await Notification.create({
      recipient: req.user._id,
      title: "Trial Converted — Welcome Aboard! 🎉",
      body: `Your ${trial.plan?.name} subscription is now fully active until ${newExpiry.toLocaleDateString()}.`,
      type: "Account_Status",
      priority: "Normal",
      dedupeKey: `trial_convert_paid_${razorpay_payment_id}`,
    });

    await log({
      level: "success",
      category: "payment",
      message: `Trial converted via Razorpay: ${trial.plan?.name}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "UserSubscription",
        entityId: trial._id,
        label: trial.plan?.name,
      },
      request: { method: "POST", path: req.originalUrl, statusCode: 200 },
      metadata: { amount, razorpay_payment_id },
    });

    try {
      const emailHtml = transactionalTemplate({
        header: "SUBSCRIPTION ACTIVE",
        title: "Your Trial Has Been Converted",
        body: `Hi ${req.user.name},<br><br>Your <b>${trial.plan?.name}</b> subscription is now active.<br><br>Next renewal: <b>${newExpiry.toLocaleDateString()}</b>.`,
        buttonText: "Go to Dashboard",
        buttonLink: "https://likeson.in/dashboard/subscription",
      });
      await sendEmail({
        email: req.user.email,
        subject: `Subscription Confirmed — ${trial.plan?.name}`,
        html: emailHtml,
      });
    } catch (_) {
      /* email failure must not block response */
    }

    res
      .status(200)
      .json({
        success: true,
        message: "Trial successfully converted to a paid subscription.",
        data: trial,
      });
  });

// POST "/free-trial/expire-stale"
export const postFreeTrialExpireStale = asyncHandler(async (req, res) => {
    const now = new Date();

    const staleTrials = await UserSubscription.find({
      status: "Trial",
      expiryDate: { $lt: now },
    })
      .populate("user", "name email")
      .populate("plan", "name pricing");

    let expiredCount = 0;
    const logs = [];

    for (const trial of staleTrials) {
      trial.status = "Expired";
      trial.autoRenew = false;
      await trial.save();
      expiredCount++;

      await Notification.create({
        recipient: trial.user._id,
        title: "Your Free Trial Has Ended",
        body: `Your free trial for ${trial.plan?.name || "your plan"} has expired. Subscribe now to continue enjoying all benefits.`,
        type: "Account_Status",
        priority: "High",
        dedupeKey: `trial_expired_${trial.user._id}_${Date.now()}`,
      });

      try {
        const emailHtml = transactionalTemplate({
          header: "TRIAL ENDED",
          title: "Your Free Trial Has Expired",
          body: `Hi ${trial.user.name},<br><br>Your free trial for <b>${trial.plan?.name}</b> has ended.<br><br>Subscribe now for just <b>₹${trial.plan?.pricing?.monthly}/month</b> to continue accessing all benefits.`,
          buttonText: "Subscribe Now",
          buttonLink: "https://likeson.in/dashboard/subscription",
        });
        await sendEmail({
          email: trial.user.email,
          subject: `Your free trial for ${trial.plan?.name} has expired`,
          html: emailHtml,
        });
        logs.push({
          userId: trial.user._id,
          email: trial.user.email,
          status: "Success",
        });
      } catch (err) {
        logs.push({
          userId: trial.user._id,
          email: trial.user.email,
          status: "Failed",
          error: err.message,
        });
      }
    }

    await log({
      level: "info",
      category: "system",
      message: `Cron: expired ${expiredCount} stale trial(s)`,
      actor: buildActor(req),
      request: { method: "POST", path: req.originalUrl, statusCode: 200 },
      metadata: { expiredCount },
    });

    res.status(200).json({ success: true, expiredCount, details: logs });
  });

// GET "/admin/trials"
export const getAdminTrials = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const filter = { trialUsed: true };

    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.user = req.query.userId;

    const [total, trials] = await Promise.all([
      UserSubscription.countDocuments(filter),
      UserSubscription.find(filter)
        .populate("user", "name email phone")
        .populate("plan", "name fixedTier pricing freeTrial")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      pagination: { total, page, pages: Math.ceil(total / limit) },
      data: trials,
    });
  });

// POST "/send-expiry-alerts"
export const postSendExpiryAlerts = asyncHandler(async (req, res) => {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const expiringSoon = await UserSubscription.find({
      status: "Active",
      expiryDate: { $gte: today, $lte: sevenDaysFromNow },
    })
      .populate("user")
      .populate("plan");

    let sentCount = 0;
    const results = [];

    for (const sub of expiringSoon) {
      const daysLeft = Math.ceil(
        (sub.expiryDate - today) / (1000 * 60 * 60 * 24),
      );

      await Notification.create({
        recipient: sub.user._id,
        title: "Subscription Expiring Soon!",
        body: `Your ${sub.plan?.name || "Membership"} expires in ${daysLeft} day(s). Renew now to avoid interruption.`,
        type: "Account_Status",
        priority: "High",
        dedupeKey: `sub_expiring_${sub.user._id}_${daysLeft}_${Date.now()}`,
      });

      try {
        const emailHtml = transactionalTemplate({
          header: "REMINDER",
          title: "Your Membership is Expiring",
          body: `Hello ${sub.user.name},<br><br>Your <b>${sub.plan?.name}</b> subscription expires on <b>${sub.expiryDate.toLocaleDateString()}</b> (${daysLeft} day(s) left).<br><br>Renew today to continue enjoying all benefits.`,
          buttonText: "Renew Now",
          buttonLink: "https://likeson.in/dashboard/subscription",
        });
        await sendEmail({
          email: sub.user.email,
          subject: `Reminder: Your subscription expires in ${daysLeft} day(s)`,
          html: emailHtml,
        });
        sentCount++;
        results.push({
          userId: sub.user._id,
          email: sub.user.email,
          status: "Success",
        });
      } catch (err) {
        results.push({
          userId: sub.user._id,
          email: sub.user.email,
          status: "Failed",
          error: err.message,
        });
      }
    }

    await log({
      level: "info",
      category: "system",
      message: `Cron: expiry alerts sent to ${sentCount} users`,
      actor: buildActor(req),
      request: { method: "POST", path: req.originalUrl, statusCode: 200 },
      metadata: { totalProcessed: expiringSoon.length, sentCount },
    });

    res
      .status(200)
      .json({
        success: true,
        totalProcessed: expiringSoon.length,
        totalEmailsSent: sentCount,
        details: results,
      });
  });

// POST "/auto-renew-trigger"
export const postAutoRenewTrigger = asyncHandler(async (req, res) => {
    const cutoff = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const expiring = await UserSubscription.find({
      status: "Active",
      autoRenew: true,
      expiryDate: { $lte: cutoff },
    }).populate("plan");

    const summary = { renewed: [], expired: [], skipped: [] };

    for (const sub of expiring) {
      if (sub.plan?.pricing?.billingCycle === "till_delivery") {
        summary.skipped.push(sub._id);
        continue;
      }

      const wallet = await Wallet.findOne({ user: sub.user });
      const renewalAmount = sub.plan?.pricing?.monthly ?? 500;

      if (wallet && wallet.balance >= renewalAmount) {
        wallet.balance -= renewalAmount;
        sub.expiryDate = new Date(
          sub.expiryDate.getTime() + 30 * 24 * 60 * 60 * 1000,
        );
        sub.limits.homeCollectionUsedOnce = false; // reset one-time benefit for new cycle

        await wallet.save();
        await sub.save();
        await Notification.create({
          recipient: sub.user,
          title: "Subscription Auto-Renewed",
          body: `₹${renewalAmount} deducted from your wallet. Your plan is active until ${sub.expiryDate.toLocaleDateString()}.`,
          type: "Account_Status",
          priority: "Normal",
          dedupeKey: `auto_renew_success_${sub.user}_${Date.now()}`,
        });

        summary.renewed.push(sub._id);
      } else {
        sub.status = "Expired";
        sub.autoRenew = false;
        await sub.save();

        await Notification.create({
          recipient: sub.user,
          title: "Subscription Expired",
          body: "Insufficient wallet balance for auto-renewal. Your subscription has expired.",
          type: "Account_Status",
          priority: "High",
          dedupeKey: `auto_renew_failed_${sub.user}_${Date.now()}`,
        });

        summary.expired.push(sub._id);
      }
    }

    await log({
      level: "info",
      category: "system",
      message: `Cron: auto-renew complete — renewed: ${summary.renewed.length}, expired: ${summary.expired.length}`,
      actor: buildActor(req),
      request: { method: "POST", path: req.originalUrl, statusCode: 200 },
      metadata: {
        renewed: summary.renewed.length,
        expired: summary.expired.length,
        skipped: summary.skipped.length,
      },
    });

    res.status(200).json({
      success: true,
      message: "Auto-renewal process complete.",
      summary: {
        renewed: summary.renewed.length,
        expired: summary.expired.length,
        skipped: summary.skipped.length,
      },
      details: summary,
    });
  });

// GET "/admin/all"
export const getAdminAll = asyncHandler(async (req, res) => {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.user = req.query.userId;
    if (req.query.planType) filter.planType = req.query.planType;

    const [total, subs] = await Promise.all([
      UserSubscription.countDocuments(filter),
      UserSubscription.find(filter)
        .populate("user", "name email phone role")
        .populate("plan")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.status(200).json({
      success: true,
      pagination: { total, page, pages: Math.ceil(total / limit) },
      data: subs,
    });
  });

// GET "/admin/plans"
export const getAdminPlans = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.planType !== undefined) filter.planType = req.query.planType;
    if (req.query.isActive !== undefined)
      filter.isActive = req.query.isActive === "true";

    const plans = await SubscriptionPlan.find(filter)
      .populate("createdByCustomer", "name email")
      .sort({ displayOrder: 1, createdAt: -1 });

    res.status(200).json({ success: true, count: plans.length, data: plans });
  });

// POST "/admin/plans"
export const postAdminPlans = asyncHandler(async (req, res) => {
    const existing = await SubscriptionPlan.findOne({ slug: req.body.slug });
    if (existing)
      return res
        .status(409)
        .json({
          success: false,
          message: "A plan with this slug already exists.",
        });

    const plan = await SubscriptionPlan.create({
      ...req.body,
      planType: "fixed",
      visibleToCustomerOnly: false,
      createdByCustomer: null,
      createdBy: req.user._id,
    });

    await log({
      level: "success",
      category: "system",
      message: `Fixed plan created by admin: ${plan.name}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "SubscriptionPlan",
        entityId: plan._id,
        label: plan.name,
      },
      request: { method: "POST", path: req.originalUrl, statusCode: 201 },
      metadata: { fixedTier: plan.fixedTier, monthly: plan.pricing.monthly },
    });

    res.status(201).json({ success: true, data: plan });
  });

// PUT "/admin/plans/:planId"
export const putAdminPlansByPlanId = asyncHandler(async (req, res) => {
    const forbidden = [
      "planType",
      "createdByCustomer",
      "customOptions",
      "slug",
    ];
    forbidden.forEach((f) => delete req.body[f]);

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.planId,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true },
    );

    if (!plan)
      return res
        .status(404)
        .json({ success: false, message: "Plan not found." });

    await log({
      level: "info",
      category: "system",
      message: `Plan updated by admin: ${plan.name}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "SubscriptionPlan",
        entityId: plan._id,
        label: plan.name,
      },
      request: { method: "PUT", path: req.originalUrl, statusCode: 200 },
      metadata: req.body,
    });

    res.status(200).json({ success: true, data: plan });
  });

// DELETE "/admin/plans/:planId"
export const deleteAdminPlansByPlanId = asyncHandler(async (req, res) => {
    const plan = await SubscriptionPlan.findByIdAndUpdate(
      req.params.planId,
      { isActive: false, updatedBy: req.user._id },
      { new: true },
    );

    if (!plan)
      return res
        .status(404)
        .json({ success: false, message: "Plan not found." });

    await log({
      level: "warning",
      category: "system",
      message: `Plan deactivated by superadmin: ${plan.name}`,
      actor: buildActor(req),
      relatedEntity: {
        model: "SubscriptionPlan",
        entityId: plan._id,
        label: plan.name,
      },
      request: { method: "DELETE", path: req.originalUrl, statusCode: 200 },
    });

    res
      .status(200)
      .json({ success: true, message: "Plan deactivated.", data: plan });
  });

// PUT "/admin/subscriptions/:subId"
export const putAdminSubscriptionsBySubId = asyncHandler(async (req, res) => {
    const allowed = ["status", "expiryDate", "autoRenew", "plan"];
    const patch = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) patch[k] = req.body[k];
    });

    const sub = await UserSubscription.findByIdAndUpdate(
      req.params.subId,
      patch,
      { new: true, runValidators: true },
    ).populate("user plan");

    if (!sub)
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found." });

    await log({
      level: "warning",
      category: "system",
      message: `Subscription manually overridden by admin`,
      actor: buildActor(req),
      relatedEntity: {
        model: "UserSubscription",
        entityId: sub._id,
        label: sub.planName,
      },
      request: { method: "PUT", path: req.originalUrl, statusCode: 200 },
      metadata: patch,
    });

    res.status(200).json({ success: true, data: sub });
  });

// Centralised error handler (register last on the router)
export const errorHandler = (err, req, res, _next) => {
  console.error("[SubscriptionRouter Error]", err);

  SystemLog.createLog({
    level: "error",
    category: "api",
    message: err.message || "Internal server error",
    details: err.stack || null,
    actor: buildActor(req),
    request: {
      method: req.method,
      path: req.originalUrl,
      statusCode: err.status || 500,
    },
  }).catch(() => null);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error.",
  });
};
