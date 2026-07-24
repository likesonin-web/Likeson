/**
 * Platformpricingroutes.js — Likeson.in
 * Business logic lives in controllers/platformpricing.controller.js.
 * This file only wires paths + middleware + controller functions.
 */

import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { protect, authorize } from '../middleware/authMiddleware.js';
import * as ctrl from '../controllers/platformpricing.controller.js';

const router = express.Router();

// 1. Define the validate middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// 2. Define the platformFeeValidators helper function
const platformFeeValidators = (prefix) => {
  return [
    body(`${prefix}.type`)
      .optional()
      .isIn(['fixed', 'percent', 'percentage'])
      .withMessage(`${prefix}.type must be 'fixed' or 'percent'`),
    body(`${prefix}.value`)
      .optional()
      .isFloat({ min: 0 })
      .withMessage(`${prefix}.value must be a non-negative number`),
  ];
};

router.get('/config', protect, authorize('admin', 'superadmin'), ctrl.getConfig);
router.get('/public', protect, authorize('customer', 'admin', 'superadmin'), ctrl.getPublic);
router.patch('/config', protect, authorize('superadmin'), [
    body('note').optional().isString(),

    // caps
    body('caps.pharmacyDiscountMax').optional().isFloat({ min: 0, max: 100 }),
    body('caps.diagnosticsDiscountMax').optional().isFloat({ min: 0, max: 100 }),
    body('caps.careAssistantMaxVisitsPerMonth').optional().isInt({ min: 0 }),
    body('caps.consultationsMaxPerMonth').optional().isInt({ min: 0 }),
    body('caps.transportMaxRidesPerMonth').optional().isInt({ min: 0 }),

    // transport scalars
    body('transport.baseFare').optional().isFloat({ min: 0 }),
    body('transport.defaultRatePerKm').optional().isFloat({ min: 0 }),
    body('transport.nightSurchargeMultiplier').optional().isFloat({ min: 1 }),
    body('transport.nightStartHour').optional().isInt({ min: 0, max: 23 }),
    body('transport.nightEndHour').optional().isInt({ min: 0, max: 23 }),
    body('transport.waitingFreeMinutes').optional().isInt({ min: 0 }),
    body('transport.waitingChargePerMinute').optional().isFloat({ min: 0 }),
    body('transport.cancellationFeePercent').optional().isFloat({ min: 0, max: 100 }),
    ...platformFeeValidators('transport.platformFee'),

    // careAssistant
    body('careAssistant.dedicatedMonthlyPayout').optional().isFloat({ min: 0 }),
    body('careAssistant.dedicatedMonthlyCharge').optional().isFloat({ min: 0 }),
    body('careAssistant.punctualityBonusPerVisit').optional().isFloat({ min: 0 }),
    body('careAssistant.noShowPenalty').optional().isFloat({ min: 0 }),
    body('careAssistant.overtimeRatePerHour').optional().isFloat({ min: 0 }),
    ...platformFeeValidators('careAssistant.platformFee'),

    // doctor
    body('doctor.honorariumPerConsultation').optional().isFloat({ min: 0 }),
    body('doctor.chargeToUser').optional().isFloat({ min: 0 }),
    body('doctor.teleConsultationChargeToUser').optional().isFloat({ min: 0 }),
    body('doctor.teleConsultationHonorarium').optional().isFloat({ min: 0 }),
    body('doctor.homeVisitChargeToUser').optional().isFloat({ min: 0 }),
    body('doctor.homeVisitHonorarium').optional().isFloat({ min: 0 }),
    body('doctor.followUpDiscountPercent').optional().isFloat({ min: 0, max: 100 }),
    body('doctor.followUpValidDays').optional().isInt({ min: 1 }),
    ...platformFeeValidators('doctor.platformFee'),

    // hospital
    body('hospital.settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('hospital.platformFee'),

    // diagnostics
    body('diagnostics.homeSampleCollectionCharge').optional().isFloat({ min: 0 }),
    body('diagnostics.physicalReportFee').optional().isFloat({ min: 0 }),
    body('diagnostics.settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('diagnostics.platformFee'),
    ...platformFeeValidators('diagnostics.homeSamplePlatformFee'),

    // pharmacy
    body('pharmacy.ownStoreMarginPercent').optional().isFloat({ min: 0, max: 100 }),
    body('pharmacy.expressDeliveryCharge').optional().isFloat({ min: 0 }),
    body('pharmacy.deliveryAgentPayout').optional().isFloat({ min: 0 }),
    body('pharmacy.freeDeliveryMinOrderValue').optional().isFloat({ min: 0 }),
    body('pharmacy.settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('pharmacy.platformFee'),

    // ads
    body('ads.sponsoredListingMonthly').optional().isFloat({ min: 0 }),
    body('ads.homePageBannerMonthly').optional().isFloat({ min: 0 }),

    // tax
    body('tax.defaultGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('tax.pharmacyGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('tax.transportGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('tax.consultationGstPercent')
      .optional()
      .isFloat({ min: 0, max: 0 })
      .withMessage('Consultations are GST-exempt — must be 0'),
    body('tax.diagnosticsGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('tax.careAssistantGstPercent').optional().isFloat({ min: 0, max: 100 }),

    // refundPolicy
    body('refundPolicy.rideFullRefundHoursThreshold').optional().isInt({ min: 0 }),
    body('refundPolicy.ridePartialRefundPercent').optional().isFloat({ min: 0, max: 100 }),
    body('refundPolicy.refundProcessingDaysMin').optional().isInt({ min: 0 }),
    body('refundPolicy.refundProcessingDaysMax').optional().isInt({ min: 0 }),
  ], validate, ctrl.patchConfig);
router.patch('/caps', protect, authorize('superadmin'), [
    body('note').optional().isString(),
    body('pharmacyDiscountMax').optional().isFloat({ min: 0, max: 100 }),
    body('diagnosticsDiscountMax').optional().isFloat({ min: 0, max: 100 }),
    body('careAssistantMaxVisitsPerMonth').optional().isInt({ min: 0 }),
    body('consultationsMaxPerMonth').optional().isInt({ min: 0 }),
    body('transportMaxRidesPerMonth').optional().isInt({ min: 0 }),
  ], validate, ctrl.patchCaps);
router.patch('/transport', protect, authorize('admin', 'superadmin'), [
    body('note').optional().isString(),
    body('baseFare').optional().isFloat({ min: 0 }),
    body('defaultRatePerKm').optional().isFloat({ min: 0 }),
    body('nightSurchargeMultiplier').optional().isFloat({ min: 1 }),
    body('nightStartHour').optional().isInt({ min: 0, max: 23 }),
    body('nightEndHour').optional().isInt({ min: 0, max: 23 }),
    body('waitingFreeMinutes').optional().isInt({ min: 0 }),
    body('waitingChargePerMinute').optional().isFloat({ min: 0 }),
    body('cancellationFeePercent').optional().isFloat({ min: 0, max: 100 }),
    body('planRateOverrides').optional().isObject(),
    ...platformFeeValidators('platformFee'),
  ], validate, ctrl.patchTransport);
router.patch('/care-assistant', protect, authorize('superadmin'), [
    body('note').optional().isString(),
    body('dedicatedMonthlyPayout').optional().isFloat({ min: 0 }),
    body('dedicatedMonthlyCharge').optional().isFloat({ min: 0 }),
    body('punctualityBonusPerVisit').optional().isFloat({ min: 0 }),
    body('noShowPenalty').optional().isFloat({ min: 0 }),
    body('overtimeRatePerHour').optional().isFloat({ min: 0 }),
    ...platformFeeValidators('platformFee'),
  ], validate, ctrl.patchCareAssistant);
router.patch('/care-assistant/tiers', protect, authorize('superadmin'), [
    body('note').optional().isString(),
    body('pricingTiers').isArray({ min: 1 }).withMessage('pricingTiers must be a non-empty array'),
    body('pricingTiers.*.label').notEmpty().withMessage('Each tier must have a label'),
    body('pricingTiers.*.minHours').isFloat({ min: 0 }).withMessage('minHours must be >= 0'),
    body('pricingTiers.*.maxHours').custom((v) => v === null || (typeof v === 'number' && v > 0)).withMessage('maxHours must be a positive number or null'),
    body('pricingTiers.*.chargeToUser').isFloat({ min: 0 }).withMessage('chargeToUser must be >= 0'),
    body('pricingTiers.*.payoutToAssistant').isFloat({ min: 0 }).withMessage('payoutToAssistant must be >= 0'),
  ], validate, ctrl.patchCareAssistantTiers);
router.patch('/doctor', protect, authorize('admin', 'superadmin'), [
    body('note').optional().isString(),
    body('honorariumPerConsultation').optional().isFloat({ min: 0 }),
    body('chargeToUser').optional().isFloat({ min: 0 }),
    body('teleConsultationChargeToUser').optional().isFloat({ min: 0 }),
    body('teleConsultationHonorarium').optional().isFloat({ min: 0 }),
    body('homeVisitChargeToUser').optional().isFloat({ min: 0 }),
    body('homeVisitHonorarium').optional().isFloat({ min: 0 }),
    body('followUpDiscountPercent').optional().isFloat({ min: 0, max: 100 }),
    body('followUpValidDays').optional().isInt({ min: 1 }),
    ...platformFeeValidators('platformFee'),
  ], validate, ctrl.patchDoctor);
router.patch('/hospital', protect, authorize('superadmin'), [
    body('note').optional().isString(),
    body('settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('platformFee'),
    body('hospitalOverrides').optional().isObject(),
  ], validate, ctrl.patchHospital);
router.delete('/hospital/override/:hospitalId', protect, authorize('superadmin'), [param('hospitalId').notEmpty().withMessage('hospitalId is required')], validate, ctrl.deleteHospitalOverrideByHospitalId);
router.patch('/diagnostics', protect, authorize('admin', 'superadmin'), [
    body('note').optional().isString(),
    body('homeSampleCollectionCharge').optional().isFloat({ min: 0 }),
    body('physicalReportFee').optional().isFloat({ min: 0 }),
    body('settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('platformFee'),
    ...platformFeeValidators('homeSamplePlatformFee'),
  ], validate, ctrl.patchDiagnostics);
router.patch('/pharmacy', protect, authorize('admin', 'superadmin'), [
    body('note').optional().isString(),
    body('ownStoreMarginPercent').optional().isFloat({ min: 0, max: 100 }),
    body('expressDeliveryCharge').optional().isFloat({ min: 0 }),
    body('deliveryAgentPayout').optional().isFloat({ min: 0 }),
    body('freeDeliveryMinOrderValue').optional().isFloat({ min: 0 }),
    body('settlementCycle').optional().isIn(['weekly', 'biweekly', 'monthly']),
    ...platformFeeValidators('platformFee'),
  ], validate, ctrl.patchPharmacy);
router.patch('/custom-plan-options', protect, authorize('superadmin'), [
    body('note').optional().isString(),

    // consultation block
    body('consultation.pricePerConsultation').optional().isFloat({ min: 0 }),
     
    // transport block
    // CHANGE: removed *.km and *.price validators.
    // Now validates pricePerKm (per-km rate) and packagePrice (flat plan price).
    body('transport.kmSlabs').optional().isArray(),
    body('transport.kmSlabs.*.pricePerKm').optional().isFloat({ min: 0 })
      .withMessage('pricePerKm must be >= 0'),
    body('transport.kmSlabs.*.packagePrice').optional().isFloat({ min: 0 })
      .withMessage('packagePrice must be >= 0'),

    // diagnosticsDiscount block
    body('diagnosticsDiscount.slabs').optional().isArray(),
    body('diagnosticsDiscount.slabs.*.percent').optional().isFloat({ min: 0, max: 100 }),
    body('diagnosticsDiscount.slabs.*.price').optional().isFloat({ min: 0 }),

    // pharmacyDiscount block
    body('pharmacyDiscount.slabs').optional().isArray(),
    body('pharmacyDiscount.slabs.*.percent').optional().isFloat({ min: 0, max: 100 }),
    body('pharmacyDiscount.slabs.*.price').optional().isFloat({ min: 0 }),

    // addOns block
    body('addOns.homeSampleCollection').optional().isFloat({ min: 0 }),
    body('addOns.prioritySupport').optional().isFloat({ min: 0 }),
  ], validate, ctrl.patchCustomPlanOptions);
router.patch('/ads', protect, authorize('superadmin'), [
    body('note').optional().isString(),
    body('sponsoredListingMonthly').optional().isFloat({ min: 0 }),
    body('homePageBannerMonthly').optional().isFloat({ min: 0 }),
  ], validate, ctrl.patchAds);
router.patch('/tax', protect, authorize('superadmin'), [
    body('note').optional().isString(),
    body('defaultGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('pharmacyGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('transportGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('consultationGstPercent').optional().isFloat({ min: 0, max: 0 }).withMessage('Consultations are GST-exempt — must be 0'),
    body('diagnosticsGstPercent').optional().isFloat({ min: 0, max: 100 }),
    body('careAssistantGstPercent').optional().isFloat({ min: 0, max: 100 }),
  ], validate, ctrl.patchTax);
router.patch('/refund-policy', protect, authorize('superadmin'), [
    body('note').optional().isString(),
    body('rideFullRefundHoursThreshold').optional().isInt({ min: 0 }),
    body('ridePartialRefundPercent').optional().isFloat({ min: 0, max: 100 }),
    body('refundProcessingDaysMin').optional().isInt({ min: 0 }),
    body('refundProcessingDaysMax').optional().isInt({ min: 0 }),
  ], validate, ctrl.patchRefundPolicy);
router.get('/transport/rate/:planSlug', protect, authorize('customer', 'admin', 'superadmin'), [param('planSlug').notEmpty().withMessage('planSlug is required')], validate, ctrl.getTransportRateByPlanSlug);
router.get('/history', protect, authorize('admin', 'superadmin'), ctrl.getHistory);
router.get('/history/:index', protect, authorize('superadmin'), [param('index').isInt().withMessage('index must be an integer')], validate, ctrl.getHistoryByIndex);
router.post('/restore/:index', protect, authorize('superadmin'), [
    param('index').isInt().withMessage('index must be an integer'),
    body('note').optional().isString(),
  ], validate, ctrl.postRestoreByIndex);

// Centralised error handler — must be last
router.use(ctrl.errorHandler);

export default router;