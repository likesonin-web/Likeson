import { IN_PERSON_ONLY_PLAN_TIERS } from "./constants.js";

/**
 * resolveConsultFee
 *
 * Returns { fee, isFree, gstRate, reason, videoBlocked? }
 *
 * GST rules (India):
 *   in-person  → 0%  (Section 9 healthcare exempt)
 *   video      → 5%  (tele-consultation taxable)
 *   home visit → 5%  (taxable)
 *
 * Subscription coverage logic:
 *   home visit  → NEVER free via quota (always charged at full fee + 5% GST)
 *   video + plan that blocks video → NOT free, booking still allowed, full fee + 5% GST
 *   follow_up   → independent of subscription quota
 */
export const resolveConsultFee = (form, followUpCheck) => {
  if (form.bookingType === "follow_up") {
    const fee = followUpCheck?.isEligible ? followUpCheck.followUpFee || 0 : 0;
    return {
      fee,
      isFree: fee === 0 && followUpCheck?.isEligible,
      gstRate: 0.0,
      reason: "Follow-up fee",
    };
  }

  const sub = form.subCoverage;
  const isVideo =
    form.bookingType === "doctor_online" || form.consultationType === "video";
  const isHome = form.consultationType === "homeVisit";

  const gstRate = isHome || isVideo ? 0.05 : 0.0;

  // Home visit: never free via subscription quota
  if (isHome) {
    const fee = form.doctorFees?.homeVisitFee ?? 600;
    return {
      fee,
      isFree: false,
      gstRate: 0.05,
      reason:
        "Home visit always charged — subscription quota covers in-person/video only",
    };
  }

  // Video: check if plan blocks video from quota
  const fixedTier = sub?.fixedTier ?? null;
  const videoBlocked =
    isVideo && !!fixedTier && IN_PERSON_ONLY_PLAN_TIERS.has(fixedTier);

  if (videoBlocked) {
    const fee = form.doctorFees?.videoFee ?? 600;
    return {
      fee,
      isFree: false,
      gstRate: 0.05,
      reason: `Your ${fixedTier} plan covers in-person only. Video fee + 5% GST charged.`,
      videoBlocked: true,
    };
  }

  // Check if subscription covers this consultation
  const isCovered = !!(
    sub?.isFree === true ||
    sub?.consultationFree === true ||
    (sub?.allowed === true && (sub?.remaining == null || sub?.remaining > 0))
  );

  if (isCovered) {
    return {
      fee: 0,
      isFree: true,
      gstRate: 0,
      reason:
        sub?.reason || sub?.consultationQuota || "Covered by subscription",
    };
  }

  // Not covered — resolve fee from doctor/hospital data
  let fee = 0;
  if (form.doctorFees) {
    fee = isVideo
      ? form.doctorFees.videoFee || 0
      : form.doctorFees.inPersonFee || 0;
  } else {
    fee = 600; // platform default
  }

  return {
    fee,
    isFree: false,
    gstRate,
    reason: sub?.consultationQuota || sub?.reason || null,
  };
};

/**
 * resolveCaFee
 * Returns { fee, isFree, isCustomPlan, reason }
 *
 * Fixed plan: CA free (quota consumed on admin assignment)
 * Custom plan: Only subscribed tier free. Different tier = platform rate (no quota).
 * No sub / exhausted: platform tier rate applies. 18% GST on all non-free CA.
 */
export const resolveCaFee = (form, caTiers) => {
  const sub = form.subCoverage;

  // Fixed plan — DEDICATED: any tier, unlimited, always free for whole period
  if (sub?.careAssistantIsDedicated) {
    return {
      fee: 0,
      isFree: true,
      isCustomPlan: false,
      reason:
        "Dedicated assistant — unlimited, free for your subscription period",
    };
  }

  // Fixed plan — STANDARD: tier index 0 free ONCE this billing cycle
  if (sub?.careAssistantFree && !sub?.isCustomPlan) {
    const durHours = form.durationHours ?? caTiers[0]?.hours ?? 1;
    const isFirstTier = durHours === (caTiers[0]?.hours ?? durHours);
    const usedOnce = sub?.careAssistantStandardUsedOnce ?? false;

    if (isFirstTier && !usedOnce) {
      return {
        fee: 0,
        isFree: true,
        isCustomPlan: false,
        reason: "Standard tier free this cycle — one-time benefit",
      };
    }

    const selectedTier =
      caTiers.find((t) => t.hours === durHours) ?? caTiers[caTiers.length - 1];
    return {
      fee: selectedTier?.price ?? 0,
      isFree: false,
      isCustomPlan: false,
      reason: isFirstTier
        ? "Standard tier free-use already used this cycle — platform rate + 18% GST"
        : `Only Standard tier (${caTiers[0]?.hours ?? 1}h) free once per cycle — other tiers charge platform rate + 18% GST`,
    };
  }

  // Custom plan with quota remaining
  const caRemaining = sub?.careAssistantRemaining;
  const hasQuota =
    sub?.isCustomPlan &&
    sub?.careAssistantAllowed &&
    (caRemaining === null ||
      caRemaining === Infinity ||
      (caRemaining ?? 0) > 0);

  if (hasQuota) {
    const durHours = form.durationHours ?? caTiers[0]?.hours ?? 1;
    const selectedTierIdx = caTiers.findIndex((t) => t.hours === durHours);
    const effectiveIdx = selectedTierIdx >= 0 ? selectedTierIdx : 0;
    const selectedTier = caTiers[effectiveIdx];

    // Match plan's free tier by snapshotted chargeToUser value — index-safe
    const snapshotCharge =
      sub?.careAssistantActiveTier?.chargeToUser ??
      sub?.careAssistantCustomFee ??
      null;
    const planTierIdx = sub?.careAssistantTierIndex ?? 0;

    const isPlanTier =
      snapshotCharge != null
        ? Number(selectedTier?.price) === Number(snapshotCharge)
        : effectiveIdx === planTierIdx;

    if (isPlanTier) {
      return {
        fee: 0,
        isFree: true,
        isCustomPlan: true,
        reason: `Plan tier included · ${caRemaining === null || caRemaining === Infinity ? "unlimited" : caRemaining} visit(s) remaining this month`,
      };
    }

    // Different tier — charge that tier's platform rate, no quota consumed
    const allTiers = sub?.careAssistantAllTiers;
    const chargeTier = allTiers ? allTiers[effectiveIdx] : selectedTier;
    const extraFee = chargeTier?.chargeToUser ?? chargeTier?.price ?? 0;
    const planTierLabel =
      sub?.careAssistantActiveTier?.label ??
      (allTiers ? allTiers[planTierIdx]?.label : null) ??
      `Tier ${planTierIdx}`;
    return {
      fee: extraFee,
      isFree: false,
      isCustomPlan: true,
      reason: `Plan covers ${planTierLabel} only — this tier charges platform rate + 18% GST`,
    };
  }

  // No sub or quota exhausted — platform tier rate
  const durHours = form.durationHours || (caTiers[0]?.hours ?? 4);
  const caTier = caTiers.find((t) => t.hours === durHours) || caTiers[0];
  return {
    fee: caTier?.price || 0,
    isFree: false,
    isCustomPlan: false,
    reason: sub?.isCustomPlan
      ? "Quota exhausted — platform rate applies"
      : null,
  };
};

export const resolveTransportFee = (transportEstimate) => {
  if (!transportEstimate) return { fee: 0, ratePerKm: null };
  return {
    fee: transportEstimate.totalTransportFee || 0,
    ratePerKm: transportEstimate.ratePerKm || null,
  };
};

export const resolveHomeCollectionFree = (subCoverage) => {
  if (!subCoverage?.homeCollectionIncluded) return false;
  // homeCollectionAvailable = included AND homeCollectionUsedOnce === false
  // Prefer explicit backend flag; fall back to homeSampleCollectionFree
  if (subCoverage.homeCollectionAvailable != null)
    return subCoverage.homeCollectionAvailable === true;
  return subCoverage.homeSampleCollectionFree === true;
};

export const labSupportsHomeCollection = (lab) => {
  if (!lab) return false;
  const mode = lab.sampleCollectionMode || "";
  return mode === "Both" || mode === "Home Collection" || mode === "Home";
};
