"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGoogleMaps } from "@/context/GoogleMapsProvider";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  HeartPulse,
} from "lucide-react";
import toast from "react-hot-toast";

import {
  fetchHospitals,
  fetchHospitalDoctors,
  checkHospitalAvailability,
  checkDoctorAvailability,
  fetchLabs,
  fetchLabById,
  fetchTransportEstimate,
  checkFollowUpEligibility,
  createFullCareRide,
  createDoctorConsultation,
  createDoctorOnline,
  createPhysiotherapist,
  createCareAssistant,
  createDiagnosticCenter,
  createDiagnosticHome,
  createPatientTransport,
  createFollowUp,
  resetCreateBooking,
  resetHospitals,
  resetDoctorsByHospital,
  resetHospitalAvailability,
  resetDoctorAvailability,
  resetTransportEstimate,
  resetFollowUpCheck,
  selectHospitals,
  selectHospitalsLoading,
  selectDoctorsByHospital,
  selectDoctorsByHospitalLoading,
  selectHospitalAvailability,
  selectHospitalAvailLoading,
  selectDoctorAvailability,
  selectDoctorAvailLoading,
  selectLabs,
  selectLabsLoading,
  selectLabDetail,
  selectLabDetailLoading,
  selectTransportEstimate,
  selectTransportEstimLoading,
  selectFollowUpCheck,
  selectFollowUpCheckLoading,
  selectCreateBookingData,
  selectCreateBookingLoading,
  selectCreateBookingError,
  selectCreateBookingStatus,
  fetchPlatformPricing,
  selectPlatformPricing,
  selectPlatformPricingLoading,
  checkConsultationCoverage,
  selectConsultationCoverage,
  fetchSubscriptionBenefitConsultations,
  fetchSubscriptionBenefitCareAssistant,
  selectSubBenefitConsultations,
  selectSubBenefitCareAssistant,
  fetchAllDoctors,
  selectAllDoctors,
  selectAllDoctorsLoading,
  deleteFailedBooking,
  fetchSubscriptionBenefitLabs,
  selectSubBenefitLabs,
} from "@/store/slices/bookingSlice";

import {
  fetchWalletDetails,
  selectWalletBalance,
  selectWalletData,
} from "@/store/slices/walletSlice";

import { selectIsLoggedIn } from "@/store/slices/userSlice";

import { PP, BOOKING_TYPES } from "@/lib/constants";
import { getSteps, toISOSafe, openRazorpay } from "@/lib/helpers";

import { StepBar } from "@/components/bookings/StepBar";
import { StepType } from "@/components/bookings/StepType";
import { StepProvider } from "@/components/bookings/StepProvider";
import { StepPatient } from "@/components/bookings/StepPatient";
import { StepSchedule } from "@/components/bookings/StepSchedule";
import { StepPayment } from "@/components/bookings/StepPayment";
import { StepReview } from "@/components/bookings/StepReview";
import { BookingSuccess } from "@/components/bookings/BookingSuccess";

const slide = {
  enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", damping: 26, stiffness: 320 },
  },
  exit: (d) => ({
    x: d > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.14 },
  }),
};

const INIT = {
  bookingType: "",
  hospSearch: "",
  doctorSearch: "",
  hospitalId: "",
  hospitalName: "",
  hospitalAddress: null,
  hospitalCoords: null,
  doctorId: "",
  doctorName: "",
  doctorSpec: "",
  doctorFees: null,
  consultationType: "inPerson",
  slotId: "",
  labCity: "",
  labId: "",
  labName: "",
  selectedTests: [],
  selectedPackages: [],
  reportDeliveryMode: "Digital (App)",
  patientIsSelf: true,
  patientName: "",
  patientAge: "",
  patientGender: "",
  patientPhone: "",
  patientBloodGroup: "",
  patientWeight: "",
  emergencyContact: "",
  patientLocation: null,
  destinationLocation: null,
  includeReturn: false,
  includeReturnHome: false,
  waitingMinutes: 0,
  durationHours: null,
  scheduledAt: "",
  customerNotes: "",
  paymentMethod: "Razorpay",
  couponCode: "",
  subCoverage: null,
  estimatedDiagFee: 0,
};

export default function BookingSystem() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const subBenefitLabs = useSelector(selectSubBenefitLabs);
  const { isLoaded } = useGoogleMaps();

  const hospitals = useSelector(selectHospitals);
  const hospitalsLoading = useSelector(selectHospitalsLoading);
  const doctorsByHospital = useSelector(selectDoctorsByHospital);
  const doctorsLoading = useSelector(selectDoctorsByHospitalLoading);
  const hospitalAvail = useSelector(selectHospitalAvailability);
  const hospitalAvailLoading = useSelector(selectHospitalAvailLoading);
  const doctorAvail = useSelector(selectDoctorAvailability);
  const doctorAvailLoading = useSelector(selectDoctorAvailLoading);
  const labs = useSelector(selectLabs);
  const labsLoading = useSelector(selectLabsLoading);
  const labDetail = useSelector(selectLabDetail);
  const labDetailLoading = useSelector(selectLabDetailLoading);
  const transportEstimate = useSelector(selectTransportEstimate);
  const transportLoading = useSelector(selectTransportEstimLoading);
  const followUpCheck = useSelector(selectFollowUpCheck);
  const followUpCheckLoading = useSelector(selectFollowUpCheckLoading);
  const createData = useSelector(selectCreateBookingData);
  const createLoading = useSelector(selectCreateBookingLoading);
  const createError = useSelector(selectCreateBookingError);
  const createStatus = useSelector(selectCreateBookingStatus);
  const platformPricing = useSelector(selectPlatformPricing);
  const platformPricingLoading = useSelector(selectPlatformPricingLoading);
  const consultationCoverage = useSelector(selectConsultationCoverage);
  const subBenefitConsultations = useSelector(selectSubBenefitConsultations);
  const subBenefitCareAssistant = useSelector(selectSubBenefitCareAssistant);
  const allDoctors = useSelector(selectAllDoctors);
  const allDoctorsLoading = useSelector(selectAllDoctorsLoading);
  const walletData = useSelector(selectWalletData);
  const walletBalance = useSelector(selectWalletBalance);

  const isLoggedIn = useSelector(selectIsLoggedIn);

  const stepContentRef = useRef(null);
  const [currentStepId, setCurrentStepId] = useState("service");
  const [direction, setDirection] = useState(1);
  const [visitedIds, setVisitedIds] = useState(["service"]);
  const [form, setForm] = useState(INIT);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [paymentState, setPaymentState] = useState("idle");
  const [paymentError, setPaymentError] = useState(null);
  const [caTiers, setCaTiers] = useState([]);
  const [caTiersLoading, setCaTiersLoading] = useState(true);
  const [pendingPaymentBooking, setPendingPaymentBooking] = useState(null);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);

  const prevDiagFeeRef = useRef(0);
  // guards so each benefit-family fetch fires once per relevant gate transition
  const benefitFetchedRef = useRef({
    consultations: false,
    careAssistant: false,
    labs: false,
  });

  useEffect(() => {
    dispatch(fetchWalletDetails());
  }, [dispatch]);

  const set = useCallback((key, val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }, []);

  const steps = getSteps(form.bookingType);
  const stepIds = steps.map((s) => s.id);
  const curIdx = stepIds.indexOf(currentStepId);
  const isLast = currentStepId === stepIds[stepIds.length - 1];

  // ── GATE: benefit/coverage fetches only allowed from "patient" step onward ──
  // "onward" = patient step has been visited at least once (visitedIds tracks
  // every step reached; service/provider alone should never trigger these).
  const hasReachedPatientStep = visitedIds.includes("patient");

  const scrollToTop = useCallback(() => {
    if (stepContentRef.current)
      stepContentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    dispatch(fetchPlatformPricing());
  }, [dispatch]);

  // ── UPDATED: subscription-benefit + coverage fetches, gated by:
  //    1) bookingType chosen
  //    2) patient step reached (not on service/provider)
  //    3) relevant benefit family for the chosen bookingType
  useEffect(() => {
    if (!form.bookingType || !hasReachedPatientStep) return;

    const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
    const needsCoverage = bt?.needsDoctor || form.bookingType === "follow_up";
    const needsCareAssistant = form.bookingType === "care_assistant";
    const needsLabs = !!bt?.isDiag;

    if (needsCoverage && !benefitFetchedRef.current.consultations) {
      dispatch(fetchSubscriptionBenefitConsultations());
      dispatch(
        checkConsultationCoverage({
          consultationType: form.consultationType || "inPerson",
        }),
      );
      benefitFetchedRef.current.consultations = true;
    }

    if (needsCareAssistant && !benefitFetchedRef.current.careAssistant) {
      dispatch(fetchSubscriptionBenefitCareAssistant());
      benefitFetchedRef.current.careAssistant = true;
    }

    if (needsLabs && !benefitFetchedRef.current.labs) {
      dispatch(fetchSubscriptionBenefitLabs());
      benefitFetchedRef.current.labs = true;
    }
  }, [dispatch, form.bookingType, form.consultationType, hasReachedPatientStep]);

  // reset guards whenever bookingType changes so switching type re-fetches
  // fresh benefits for the new type once patient step is reached again
  useEffect(() => {
    benefitFetchedRef.current = {
      consultations: false,
      careAssistant: false,
      labs: false,
    };
  }, [form.bookingType]);

  // ── UPDATED: consultationType-driven coverage re-check, same gate ──────────
  useEffect(() => {
    if (!form.consultationType || !hasReachedPatientStep) return;
    const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
    if (!(bt?.needsDoctor || form.bookingType === "follow_up")) return;
    dispatch(
      checkConsultationCoverage({ consultationType: form.consultationType }),
    );
  }, [dispatch, form.consultationType, form.bookingType, hasReachedPatientStep]);

  const onSelectBookingType = useCallback(
    (btValue) => {
      if (form.bookingType === btValue) return;
      setForm((p) => ({
        ...INIT,
        patientIsSelf: p.patientIsSelf,
        patientName: p.patientName,
        patientAge: p.patientAge,
        patientGender: p.patientGender,
        patientPhone: p.patientPhone,
        patientBloodGroup: p.patientBloodGroup,
        patientWeight: p.patientWeight,
        emergencyContact: p.emergencyContact,
        subCoverage: p.subCoverage,
        paymentMethod:
          btValue === "doctor_online"
            ? "Razorpay"
            : p.paymentMethod || "Razorpay",
        bookingType: btValue,
        durationHours: null,
        estimatedDiagFee: 0,
      }));
      setErrors({});
      prevDiagFeeRef.current = 0;
      dispatch(resetHospitals());
      dispatch(resetDoctorsByHospital());
      dispatch(resetHospitalAvailability());
      dispatch(resetDoctorAvailability());
      dispatch(resetTransportEstimate());
      dispatch(resetFollowUpCheck());
    },
    [form.bookingType, dispatch],
  );

  useEffect(() => {
    if (
      !consultationCoverage &&
      !subBenefitConsultations &&
      !subBenefitCareAssistant &&
      !subBenefitLabs
    )
      return;

    setForm((p) => {
      const consult = subBenefitConsultations?.consultations ?? null;
      const care = subBenefitCareAssistant?.careAssistant ?? null;
      const coverage = consultationCoverage ?? {};

      const consultationsRemaining = consult?.unlimited
        ? null
        : (consult?.remaining ?? coverage.remaining ?? 0);
      const consultationFree = !!(
        coverage.isFree === true || coverage.consultationFree === true
      );

      const caRemaining = care?.unlimited
        ? null
        : (care?.remaining ?? coverage.careAssistantRemaining ?? 0);
      const caIncluded = subBenefitCareAssistant?.included ?? false;
      const isCustomPlan =
        subBenefitConsultations?.planType === "custom" ||
        subBenefitCareAssistant?.planType === "custom" ||
        coverage.isCustomPlan ||
        false;
      const activeTier = care?.activeTier ?? null;
      const isDedicatedCa = care?.isDedicated === true;
      const caStandardTierUsedOnce = care?.caStandardTierUsedOnce ?? false;

      const careAssistantFree =
        caIncluded &&
        !isCustomPlan &&
        (isDedicatedCa || !caStandardTierUsedOnce);

      const labsBenefit = subBenefitLabs ?? null;
      const diagDiscount =
        labsBenefit?.labs?.discountPercent ??
        coverage.diagnosticsDiscountPercent ??
        0;
      const homeColIncluded =
        labsBenefit?.homeCollection?.included ??
        coverage.homeSampleCollectionFree ??
        false;
      const homeColUsed = labsBenefit?.homeCollection?.homeVisitsUsed ?? 0;
      const homeColRemaining =
        labsBenefit?.homeCollection?.homeVisitsRemaining ?? null;
      const homeColUnlimited =
        labsBenefit?.homeCollection?.homeVisitUnlimited ?? false;
      const homeColLimit = labsBenefit?.homeCollection?.homeVisitLimit ?? null;

      const homeCollectionAvailable =
        labsBenefit?.homeCollection?.homeCollectionAvailable ?? null;
      const homeCollectionUsedOnce =
        labsBenefit?.homeCollection?.homeCollectionUsedOnce ?? false;
      const homeSampleCollectionFree =
        homeCollectionAvailable != null
          ? homeCollectionAvailable === true
          : homeColIncluded && !homeCollectionUsedOnce;

      return {
        ...p,
        subCoverage: {
          ...(p.subCoverage || {}),
          isFree: consultationFree,
          allowed: coverage.allowed ?? false,
          remaining: consultationsRemaining,
          reason: coverage.reason ?? null,
          consultationFree,
          consultationQuota: coverage.reason ?? null,
          careAssistantFree,
          careAssistantIsDedicated: isDedicatedCa,
          careAssistantStandardUsedOnce: caStandardTierUsedOnce,
          careAssistantAllowed:
            caIncluded &&
            (care?.unlimited || (caRemaining !== null && caRemaining > 0)),
          careAssistantRemaining: caRemaining,
          careAssistantQuota: coverage.careAssistantQuota ?? null,
          careAssistantCustomFee: isCustomPlan
            ? (activeTier?.chargeToUser ??
              coverage.careAssistantCustomFee ??
              null)
            : null,
          careAssistantTierIndex: activeTier?.tierIndex ?? null,
          careAssistantActiveTier: activeTier,
          careAssistantAllTiers:
            subBenefitCareAssistant?.careAssistant?.allTiers ?? null,
          isCustomPlan,
          diagnosticsDiscountPercent: diagDiscount,
          homeSampleCollectionFree,
          homeCollectionAvailable:
            homeCollectionAvailable ?? homeSampleCollectionFree,
          homeCollectionUsedOnce,
          homeCollectionUsed: homeColUsed,
          homeCollectionRemaining: homeColRemaining,
          homeCollectionUnlimited: false,
          homeCollectionLimit: homeColLimit,
          homeCollectionIncluded: homeColIncluded,
          labsMessage: labsBenefit?.labs?.message ?? null,
          homeCollectionMessage: labsBenefit?.homeCollection?.message ?? null,
          fixedTier:
            subBenefitConsultations?.fixedTier ??
            subBenefitCareAssistant?.fixedTier ??
            null,
          planType:
            subBenefitConsultations?.planType ??
            subBenefitCareAssistant?.planType ??
            "fixed",
          kmRateSource: p.subCoverage?.kmRateSource ?? null,
          ratePerKm: p.subCoverage?.ratePerKm ?? null,
        },
      };
    });
  }, [
    consultationCoverage,
    subBenefitConsultations,
    subBenefitCareAssistant,
    subBenefitLabs,
  ]);

  useEffect(() => {
    setCaTiersLoading(platformPricingLoading);
    if (!platformPricing) return;
    const tiers = Array.isArray(platformPricing) ? platformPricing : null;
    if (tiers?.length) {
      const mapped = tiers
        .filter((t) => t.isActive !== false)
        .sort(
          (a, b) => (a.minHours ?? a.hours ?? 0) - (b.minHours ?? b.hours ?? 0),
        )
        .map((t) => ({
          hours: t.minHours ?? t.hours,
          maxHours: t.maxHours ?? null,
          label: t.label || `${t.minHours ?? t.hours} hrs`,
          price: t.chargeToUser ?? t.price ?? 0,
        }))
        .filter((t) => t.hours != null && t.price != null);
      if (mapped.length) {
        setCaTiers(mapped);
        setForm((p) => ({
          ...p,
          durationHours: p.durationHours || mapped[0].hours,
        }));
      }
    }
    if (!platformPricingLoading) setCaTiersLoading(false);
  }, [platformPricing, platformPricingLoading]);

  useEffect(() => {
    if (!transportEstimate) return;
    setForm((p) => ({
      ...p,
      subCoverage: {
        ...(p.subCoverage || {}),
        kmRateSource: transportEstimate.kmRateSource,
        ratePerKm: transportEstimate.ratePerKm,
      },
    }));
  }, [transportEstimate]);

  useEffect(() => {
    const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
    if (!bt?.isDiag || !labDetail) {
      if (prevDiagFeeRef.current !== 0) {
        prevDiagFeeRef.current = 0;
        setForm((p) => ({ ...p, estimatedDiagFee: 0 }));
      }
      return;
    }
    const hasSelections =
      (form.selectedTests?.length ?? 0) > 0 ||
      (form.selectedPackages?.length ?? 0) > 0;

    if (!hasSelections) {
      if (prevDiagFeeRef.current !== 0) {
        prevDiagFeeRef.current = 0;
        setForm((p) => ({ ...p, estimatedDiagFee: 0 }));
      }
      return;
    }

    let rawTotal = 0;
    for (const testSlug of form.selectedTests || []) {
      if (!testSlug) continue;
      const t = labDetail.labTests?.find((lt) => lt.slug === testSlug);
      if (t) rawTotal += t.discountedPrice ?? t.mrpPrice ?? 0;
    }
    for (const pkgSlug of form.selectedPackages || []) {
      if (!pkgSlug) continue;
      const pkg = labDetail.labPackages?.find((lp) => lp.slug === pkgSlug);
      if (pkg) rawTotal += pkg.mrpPrice ?? 0;
    }

    const discPct = form.subCoverage?.diagnosticsDiscountPercent || 0;
    const computed =
      discPct > 0 ? +(rawTotal * (1 - discPct / 100)).toFixed(2) : rawTotal;

    if (computed !== prevDiagFeeRef.current) {
      prevDiagFeeRef.current = computed;
      setForm((p) => ({ ...p, estimatedDiagFee: computed }));
    }
  }, [
    form.bookingType,
    form.selectedTests,
    form.selectedPackages,
    form.subCoverage?.diagnosticsDiscountPercent,
    labDetail,
  ]);

  useEffect(() => {
    if (!form.bookingType) return;
    const newStepIds = getSteps(form.bookingType).map((s) => s.id);
    if (!newStepIds.includes(currentStepId)) {
      setCurrentStepId("service");
      setVisitedIds(["service"]);
    }
  }, [form.bookingType]);

  useEffect(() => {
    if (form.bookingType === "doctor_online")
      setForm((p) => ({ ...p, consultationType: "video" }));
    else if (
      form.bookingType === "physiotherapist" &&
      form.consultationType === "video"
    )
      setForm((p) => ({ ...p, consultationType: "inPerson" }));
  }, [form.bookingType, form.consultationType]);

  // ── deep-link entry gates ANY jump past step0 (idx>=1) ────────────
  useEffect(() => {
    const doctorId = searchParams.get("doctor"),
      hospitalId = searchParams.get("hospital"),
      labId = searchParams.get("lab"),
      type = searchParams.get("type"),
      name = searchParams.get("name"),
      spec = searchParams.get("spec");
    if (doctorId || hospitalId || labId || type) {
      setForm((p) => ({
        ...p,
        ...(doctorId && {
          doctorId,
          doctorName: name || "",
          doctorSpec: spec || "",
        }),
        ...(hospitalId && { hospitalId }),
        ...(labId && { labId }),
        ...(type && { bookingType: type }),
      }));
      if (type && doctorId) {
        if (!isLoggedIn) {
          router.push(`/login`);
          return;
        }
        setCurrentStepId("patient");
        setVisitedIds(["service", "provider", "patient"]);
      } else if (type || doctorId || hospitalId || labId) {
        if (!isLoggedIn) {
          router.push(`/login`);
          return;
        }
        setCurrentStepId("provider");
        setVisitedIds(["service", "provider"]);
      }
    }
  }, [searchParams, isLoggedIn, router]);

  useEffect(() => {
    const hospitalId = searchParams.get("hospital");
    if (!hospitalId) return;
    dispatch(fetchHospitals({ city: "" }));
    dispatch(fetchHospitalDoctors({ hospitalId }));
  }, [searchParams, dispatch]);

  useEffect(() => {
    const labId = searchParams.get("lab");
    if (!labId) return;
    dispatch(fetchLabById({ labId })).then((res) => {
      const lab = res?.payload?.data || res?.payload;
      if (lab?.labName) setForm((p) => ({ ...p, labName: lab.labName }));
    });
  }, [searchParams, dispatch]);

  useEffect(
    () => () => {
      dispatch(resetCreateBooking());
    },
    [dispatch],
  );

  // Post-booking-success refresh: always allowed (benefits genuinely changed
  // after a real booking was created), independent of the step gate above.
  useEffect(() => {
    if (createStatus === "succeeded" && createData) {
      if (createData.subscriptionCoverage) {
        const sc = createData.subscriptionCoverage;
        setForm((p) => ({
          ...p,
          subCoverage: {
            ...(p.subCoverage || {}),
            consultationFree: sc.consultationFree ?? false,
            careAssistantAllTiers: sc.careAssistantAllTiers ?? null,
            consultationQuota: sc.consultationQuota || sc.quotaInfo || null,
            careAssistantFree: sc.careAssistantFree ?? false,
            careAssistantQuota:
              sc.careAssistantQuota ||
              (sc.visitsRemaining != null
                ? `${sc.visitsRemaining} visits remaining`
                : null),
          },
        }));
      }
      dispatch(
        checkConsultationCoverage({
          consultationType: form.consultationType || "inPerson",
        }),
      );
      dispatch(fetchSubscriptionBenefitConsultations());
      dispatch(fetchSubscriptionBenefitCareAssistant());
      dispatch(fetchSubscriptionBenefitLabs());
      setSuccess(true);
    }
  }, [createStatus, createData, dispatch, form.consultationType]);

  const onLoadHospitals = useCallback(
    (city) => dispatch(fetchHospitals({ city })),
    [dispatch],
  );
  const onLoadDoctors = useCallback(
    (hospitalId) => dispatch(fetchHospitalDoctors({ hospitalId })),
    [dispatch],
  );
  const onLoadAllDoctors = useCallback(
    (params) => dispatch(fetchAllDoctors(params || {})),
    [dispatch],
  );
  const onLoadLabs = useCallback(
    (city) =>
      dispatch(
        fetchLabs({
          city: city || "",
          homeCollection: form.bookingType === "diagnostic_home",
        }),
      ),
    [dispatch, form.bookingType],
  );

  const onLoadLabDetail = useCallback(
    async (labId) => {
      const result = await dispatch(fetchLabById({ labId }));
      const lab = result?.payload?.data || result?.payload;
      if (lab?.labName) set("labName", lab.labName);
    },
    [dispatch, set],
  );

  const onCheckHospAvail = useCallback(() => {
    if (form.hospitalId && form.scheduledAt)
      dispatch(
        checkHospitalAvailability({
          hospitalId: form.hospitalId,
          scheduledAt: toISOSafe(form.scheduledAt),
        }),
      );
  }, [dispatch, form.hospitalId, form.scheduledAt]);

  const onCheckDocAvail = useCallback(() => {
    if (form.doctorId && form.scheduledAt)
      dispatch(
        checkDoctorAvailability({
          doctorId: form.doctorId,
          scheduledAt: toISOSafe(form.scheduledAt),
          hospitalId: form.hospitalId,
        }),
      );
  }, [dispatch, form.doctorId, form.scheduledAt, form.hospitalId]);

  const onCheckFollowUp = useCallback(
    (doctorId, hospitalId) => {
      if (doctorId)
        dispatch(checkFollowUpEligibility({ doctorId, hospitalId }));
    },
    [dispatch],
  );

  const onResetHospAvail = useCallback(
    () => dispatch(resetHospitalAvailability()),
    [dispatch],
  );
  const onResetDocAvail = useCallback(
    () => dispatch(resetDoctorAvailability()),
    [dispatch],
  );

  const onEstimateTransport = useCallback(() => {
    const pickup = form.patientLocation?.coordinates;
    const dropoff = form.destinationLocation?.coordinates;
    if (!pickup) return;
    const requiresDropoff = ["patient_transport", "full_care_ride"].includes(
      form.bookingType,
    );
    if (requiresDropoff && !dropoff) return;
    const params = {
      pickupLng: pickup[0],
      pickupLat: pickup[1],
      bookingType: form.bookingType || "patient_transport",
    };
    if (dropoff) {
      params.dropoffLng = dropoff[0];
      params.dropoffLat = dropoff[1];
    }
    if (form.includeReturn || form.includeReturnHome)
      params.includeReturn = true;
    if (form.waitingMinutes) params.waitingMinutes = form.waitingMinutes;
    dispatch(fetchTransportEstimate(params));
  }, [
    dispatch,
    form.patientLocation?.coordinates?.[0],
    form.patientLocation?.coordinates?.[1],
    form.destinationLocation?.coordinates?.[0],
    form.destinationLocation?.coordinates?.[1],
    form.includeReturn,
    form.includeReturnHome,
    form.waitingMinutes,
    form.bookingType,
  ]);

  const mkLoc = (loc) =>
    loc
      ? {
          coordinates: loc.coordinates,
          address: loc.address,
          city: loc.city,
          pincode: loc.pincode,
        }
      : undefined;
  const mkPatient = () => ({
    name: form.patientName,
    age: form.patientAge || undefined,
    gender: form.patientGender || undefined,
    phone: form.patientPhone || undefined,
    bloodGroup: form.patientBloodGroup || undefined,
    weight: form.patientWeight || undefined,
    isSelf: form.patientIsSelf,
  });

  const mkCommon = () => ({
    patientInfo: mkPatient(),
    scheduledAt: toISOSafe(form.scheduledAt),
    paymentMethod: form.paymentMethod,
    couponCode: form.couponCode || undefined,
    coinsToRedeem: 0,
    slotId: form.slotId || undefined,
    documents: [],
  });

  const validate = useCallback(
    (sid) => {
      const e = {};
      if (sid === "service" && !form.bookingType)
        e.bookingType = "Select a service type to continue";
      if (sid === "provider") {
        const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
        if (bt?.isDiag && !form.labId) e.labId = "Select a lab";
        if (
          bt?.isDiag &&
          !form.selectedTests?.length &&
          !form.selectedPackages?.length
        )
          e.selectedTests = "Select at least one test or package";
        if (bt?.needsDoctor && !form.doctorId)
          e.doctorId = "Select a doctor to continue";
        if (
          form.bookingType === "follow_up" &&
          followUpCheck &&
          !followUpCheck.isEligible
        )
          e.doctorId = followUpCheck.reason || "Not eligible for follow-up";
      }
      if (sid === "patient") {
        if (!form.patientName?.trim())
          e.patientName = "Patient full name is required";
        if (!form.patientPhone?.trim())
          e.patientPhone = "Mobile number required for confirmation SMS";
      }
      if (sid === "schedule") {
        const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
        if (!form.scheduledAt)
          e.scheduledAt = "Select appointment date and time";
        if (
          (bt?.needsTransport || form.bookingType === "full_care_ride") &&
          !form.patientLocation?.coordinates
        )
          e.patientLocation = "Set your pickup address on the map";
        if (
          form.bookingType === "patient_transport" &&
          !form.destinationLocation?.coordinates
        )
          e.destinationLocation = "Set the drop-off destination on the map";
        if (
          form.bookingType === "full_care_ride" &&
          !form.destinationLocation?.coordinates
        )
          e.destinationLocation =
            "Set the hospital/drop-off address on the map";
      }
      setErrors(e);
      return Object.keys(e).length === 0;
    },
    [form, followUpCheck],
  );

  const handleSubmit = useCallback(async () => {
    const common = mkCommon();
    const map = {
      full_care_ride: () =>
        dispatch(
          createFullCareRide({
            ...common,
            hospitalId: form.hospitalId,
            doctorId: form.doctorId,
            consultationType: form.consultationType,
            patientLocation: mkLoc(form.patientLocation),
            destinationLocation: mkLoc(form.destinationLocation),
            includeReturnHome: form.includeReturnHome,
            durationHours: form.durationHours,
          }),
        ),
      doctor_consultation: () =>
        dispatch(
          createDoctorConsultation({
            ...common,
            hospitalId: form.hospitalId || undefined,
            doctorId: form.doctorId,
            consultationType: form.consultationType,
          }),
        ),
      doctor_online: () =>
        dispatch(createDoctorOnline({ ...common, doctorId: form.doctorId })),
      physiotherapist: () =>
        dispatch(
          createPhysiotherapist({
            ...common,
            doctorId: form.doctorId,
            visitType: form.consultationType,
          }),
        ),
      care_assistant: () =>
        dispatch(
          createCareAssistant({
            ...common,
            patientLocation: mkLoc(form.patientLocation),
            durationHours: form.durationHours,
          }),
        ),
      diagnostic_center: () =>
        dispatch(
          createDiagnosticCenter({
            ...common,
            labId: form.labId,
            tests: (form.selectedTests || []).filter(Boolean),
            packages: (form.selectedPackages || []).filter(Boolean),
            reportDeliveryMode: form.reportDeliveryMode,
          }),
        ),
      diagnostic_home: () =>
        dispatch(
          createDiagnosticHome({
            ...common,
            labId: form.labId,
            tests: (form.selectedTests || []).filter(Boolean),
            packages: (form.selectedPackages || []).filter(Boolean),
            patientLocation: mkLoc(form.patientLocation),
            reportDeliveryMode: form.reportDeliveryMode,
          }),
        ),
      patient_transport: () =>
        dispatch(
          createPatientTransport({
            ...common,
            patientLocation: mkLoc(form.patientLocation),
            destinationLocation: mkLoc(form.destinationLocation),
            includeReturn: form.includeReturn,
            waitingMinutes: form.waitingMinutes,
            vehicleClass: "four_wheeler",
            addConsultation: false,
          }),
        ),
      follow_up: () =>
        dispatch(
          createFollowUp({
            ...common,
            doctorId: form.doctorId,
            hospitalId: form.hospitalId || undefined,
          }),
        ),
    };

    const action = map[form.bookingType];
    if (!action) return;

    const actionResult = await action();
    const bookingData = actionResult?.payload;
    if (!bookingData || actionResult?.error) return;

    const targetBookingId = bookingData.bookingId || bookingData._id;
    const razorpayOrder = bookingData.razorpayOrder;
    const walletSplit = bookingData.walletSplit;
    const fareBreakdown = bookingData.fareBreakdown;
    const totalAmount = fareBreakdown?.totalAmount ?? 0;

    const refreshAfterSuccess = () => {
      dispatch(
        checkConsultationCoverage({
          consultationType: form.consultationType || "inPerson",
        }),
      );
      dispatch(fetchSubscriptionBenefitConsultations());
      dispatch(fetchSubscriptionBenefitCareAssistant());
      dispatch(fetchSubscriptionBenefitLabs());
    };

    if (form.paymentMethod === "Razorpay") {
      if (!razorpayOrder && totalAmount > 0) {
        setPaymentState("idle");
        setPaymentError(
          "Payment gateway unavailable. Booking was not created. Please try again or choose Wallet / Cash.",
        );
        if (targetBookingId) {
          try {
            await dispatch(
              deleteFailedBooking({
                bookingId: targetBookingId,
                walletApplied: 0,
              }),
            );
          } catch {}
        }
        return;
      }
      if (razorpayOrder && totalAmount > 0) {
        setPaymentState("opening");
        setPaymentError(null);
        setPendingPaymentBooking({
          bookingData,
          razorpayOrder,
          targetBookingId,
        });
        await openRazorpay({
          order: razorpayOrder,
          bookingId: targetBookingId,
          dispatch,
          description: `${form.bookingType?.replace(/_/g, " ")} booking`,
          prefill: {
            name: form.patientName || "",
            contact: form.patientPhone
              ? `+91${form.patientPhone.replace(/\D/g, "").slice(-10)}`
              : "",
          },
          onSuccess: () => {
            setPaymentState("done");
            setPendingPaymentBooking(null);
            toast.success("Payment verified! Booking confirmed.");
            refreshAfterSuccess();
            setSuccess(true);
          },
          onFailure: async (msg) => {
            setPaymentState("failed");
            setIsRetryingPayment(false);
            setPendingPaymentBooking(null);
            if (targetBookingId) {
              try {
                await dispatch(
                  deleteFailedBooking({
                    bookingId: targetBookingId,
                    walletApplied: 0,
                  }),
                );
              } catch (e) {
                console.error(e);
              }
            }
            setPaymentError(
              `Payment ${msg || "cancelled"}. Booking deleted — no charge made. Please book again.`,
            );
          },
        });
        return;
      }
      setPendingPaymentBooking(null);
      refreshAfterSuccess();
      setSuccess(true);
      return;
    }

    if (form.paymentMethod === "Wallet") {
      if (walletSplit?.needsRazorpay && razorpayOrder) {
        const walletApplied = walletSplit.walletApplied || 0;
        const razorpayPortion = walletSplit.razorpayPortion || 0;
        setPaymentState("opening");
        setPaymentError(null);
        setPendingPaymentBooking({
          bookingData,
          razorpayOrder,
          targetBookingId,
          isWalletSplit: true,
          walletSplit,
        });
        await openRazorpay({
          order: razorpayOrder,
          bookingId: targetBookingId,
          dispatch,
          description: `${form.bookingType?.replace(/_/g, " ")} booking (₹${razorpayPortion} remaining after wallet)`,
          prefill: {
            name: form.patientName || "",
            contact: form.patientPhone
              ? `+91${form.patientPhone.replace(/\D/g, "").slice(-10)}`
              : "",
          },
          onSuccess: () => {
            setPaymentState("done");
            setPendingPaymentBooking(null);
            refreshAfterSuccess();
            dispatch(fetchWalletDetails());
            setSuccess(true);
          },
          onFailure: async (msg) => {
            setPaymentState("failed");
            setIsRetryingPayment(false);
            setPendingPaymentBooking(null);
            if (targetBookingId) {
              try {
                await dispatch(
                  deleteFailedBooking({
                    bookingId: targetBookingId,
                    walletApplied,
                  }),
                );
              } catch (e) {
                console.error(e);
              }
            }
            dispatch(fetchWalletDetails());
            setPaymentError(
              walletApplied > 0
                ? `Payment ${msg || "failed"}. ₹${walletApplied.toLocaleString("en-IN")} wallet amount automatically refunded. Booking deleted. Please book again.`
                : `Payment ${msg || "failed"}. Booking deleted — no charge made. Please book again.`,
            );
          },
        });
        return;
      }
      setPendingPaymentBooking(null);
      refreshAfterSuccess();
      dispatch(fetchWalletDetails());
      setSuccess(true);
      return;
    }

    if (form.paymentMethod === "Cash") {
      setPendingPaymentBooking(null);
      refreshAfterSuccess();
      setSuccess(true);
      return;
    }
    setSuccess(true);
  }, [dispatch, form]);

  const handleRetryPayment = useCallback(async () => {
    if (!pendingPaymentBooking) return;
    const { razorpayOrder, targetBookingId, walletSplit } =
      pendingPaymentBooking;
    setIsRetryingPayment(true);
    setPaymentError(null);
    setPaymentState("opening");
    await openRazorpay({
      order: razorpayOrder,
      bookingId: targetBookingId,
      dispatch,
      description: `${form.bookingType?.replace(/_/g, " ")} booking`,
      prefill: {
        name: form.patientName || "",
        contact: form.patientPhone || "",
      },
      onSuccess: () => {
        setPaymentState("done");
        setPendingPaymentBooking(null);
        setIsRetryingPayment(false);
        dispatch(
          checkConsultationCoverage({
            consultationType: form.consultationType || "inPerson",
          }),
        );
        setSuccess(true);
      },
      onFailure: async (msg) => {
        setPaymentState("failed");
        setIsRetryingPayment(false);
        setPendingPaymentBooking(null);
        const walletApplied = walletSplit?.walletApplied || 0;
        if (targetBookingId) {
          try {
            await dispatch(
              deleteFailedBooking({
                bookingId: targetBookingId,
                walletApplied,
              }),
            );
          } catch (e) {
            console.error(e);
          }
        }
        setPaymentError(
          walletApplied > 0
            ? `Payment ${msg || "failed"}. ₹${walletApplied} wallet refunded. Booking deleted. Please book again.`
            : `Payment ${msg || "failed"}. Booking deleted — no charge. Please book again.`,
        );
      },
    });
  }, [pendingPaymentBooking, dispatch, form]);

  // ── gate Continue — idx>=1 (anything past step0) needs login ─────
  const goNext = useCallback(() => {
    if (!validate(currentStepId)) {
      setTimeout(() => {
        const firstError =
          document.querySelector("[data-error]") || stepContentRef.current;
        firstError?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
      return;
    }
    if (!isLoggedIn && curIdx >= 1) {
      router.push(`/login`);
      return;
    }
    if (isLast) {
      handleSubmit();
      return;
    }
    const next = stepIds[curIdx + 1];
    setDirection(1);
    setCurrentStepId(next);
    setVisitedIds((v) => (v.includes(next) ? v : [...v, next]));
    setTimeout(scrollToTop, 50);
  }, [
    currentStepId,
    isLast,
    stepIds,
    curIdx,
    validate,
    handleSubmit,
    scrollToTop,
    isLoggedIn,
    router,
  ]);

  const goPrev = useCallback(() => {
    if (curIdx === 0) return;
    const prev = stepIds[curIdx - 1];
    setDirection(-1);
    setCurrentStepId(prev);
    setTimeout(scrollToTop, 50);
  }, [curIdx, stepIds, scrollToTop]);

  // ── gate direct StepBar jumps — idx>=1 needs login (matches goNext) ─
  const handleStepClick = useCallback(
    (stepId) => {
      if (!visitedIds.includes(stepId) || stepId === currentStepId) return;
      const targetIdx = stepIds.indexOf(stepId);
      if (!isLoggedIn && targetIdx >= 1) {
        router.push(`/login`);
        return;
      }
      const currentIdx = stepIds.indexOf(currentStepId);
      setDirection(targetIdx < currentIdx ? -1 : 1);
      setCurrentStepId(stepId);
      setTimeout(scrollToTop, 50);
    },
    [visitedIds, currentStepId, stepIds, scrollToTop, isLoggedIn, router],
  );

  const handleReset = useCallback(() => {
    setForm(INIT);
    setCurrentStepId("service");
    setVisitedIds(["service"]);
    setDirection(1);
    setErrors({});
    setSuccess(false);
    setPaymentState("idle");
    setPaymentError(null);
    setPendingPaymentBooking(null);
    prevDiagFeeRef.current = 0;
    benefitFetchedRef.current = {
      consultations: false,
      careAssistant: false,
      labs: false,
    };
    dispatch(resetHospitals());
    dispatch(resetDoctorsByHospital());
    dispatch(resetHospitalAvailability());
    dispatch(resetDoctorAvailability());
    dispatch(resetTransportEstimate());
    dispatch(resetFollowUpCheck());
    dispatch(resetCreateBooking());
  }, [dispatch]);

  const isSubmitting = createLoading || paymentState === "opening";
  const combinedError =
    paymentError || (createStatus === "failed" ? createError : null);

  const stepContent = {
    service: (
      <StepType
        form={form}
        set={set}
        onSelectBookingType={onSelectBookingType}
      />
    ),
    provider: (
      <StepProvider
        form={form}
        set={set}
        errors={errors}
        hospitals={hospitals}
        hospitalsLoading={hospitalsLoading}
        doctorsByHospital={doctorsByHospital}
        doctorsLoading={doctorsLoading}
        allDoctors={allDoctors}
        allDoctorsLoading={allDoctorsLoading}
        hospitalAvail={hospitalAvail}
        hospitalAvailLoading={hospitalAvailLoading}
        doctorAvail={doctorAvail}
        doctorAvailLoading={doctorAvailLoading}
        labs={labs}
        labsLoading={labsLoading}
        labDetail={labDetail}
        labDetailLoading={labDetailLoading}
        followUpCheck={followUpCheck}
        followUpCheckLoading={followUpCheckLoading}
        onLoadHospitals={onLoadHospitals}
        onLoadDoctors={onLoadDoctors}
        onLoadAllDoctors={onLoadAllDoctors}
        onLoadLabs={onLoadLabs}
        onLoadLabDetail={onLoadLabDetail}
        onCheckHospAvail={onCheckHospAvail}
        onCheckDocAvail={onCheckDocAvail}
        onCheckFollowUp={onCheckFollowUp}
        onResetHospAvail={onResetHospAvail}
        onResetDocAvail={onResetDocAvail}
      />
    ),
    patient: <StepPatient form={form} set={set} errors={errors} />,
    schedule: (
      <StepSchedule
        form={form}
        set={set}
        errors={errors}
        hospitalAvail={hospitalAvail}
        hospitalAvailLoading={hospitalAvailLoading}
        doctorAvail={doctorAvail}
        doctorAvailLoading={doctorAvailLoading}
        transportEstimate={transportEstimate}
        transportLoading={transportLoading}
        onCheckHospAvail={onCheckHospAvail}
        onCheckDocAvail={onCheckDocAvail}
        onEstimateTransport={onEstimateTransport}
        onResetHospAvail={onResetHospAvail}
        onResetDocAvail={onResetDocAvail}
        caTiers={caTiers}
        caTiersLoading={caTiersLoading}
        isLoaded={isLoaded}
      />
    ),
    payment: (
      <StepPayment
        form={form}
        set={set}
        transportEstimate={transportEstimate}
        followUpCheck={followUpCheck}
        caTiers={caTiers}
        walletBalance={walletBalance}
        walletData={walletData}
        labDetail={labDetail}
      />
    ),
    confirm: (
      <StepReview
        form={form}
        isLoading={isSubmitting}
        error={combinedError}
        transportEstimate={transportEstimate}
        followUpCheck={followUpCheck}
        caTiers={caTiers}
        walletBalance={walletBalance}
        paymentState={paymentState}
        pendingPaymentBooking={pendingPaymentBooking}
        handleRetryPayment={handleRetryPayment}
        isRetryingPayment={isRetryingPayment}
        labDetail={labDetail}
      />
    ),
  };

  return (
    <div
      className="min-h-screen py-4 px-3 sm:py-6 sm:px-4 bg-base-100"
      style={PP}
    >
      <div className="max-w-xl mx-auto w-full">
        <div className="text-center mb-4">
          <div className="flex flex-col items-center gap-2 mb-2">
            <img
              src="https://ik.imagekit.io/4wja0s7p9/%20favicon.ico"
              alt="Likeson.in"
              className="w-8 h-8 rounded-lg object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-primary/5 text-primary border-primary/20"
              style={PP}
            >
              <HeartPulse size={9} />
              Likeson.in — Healthcare Platform, Vijayawada
            </div>
            <p
              className="text-[9px] text-base-content/35 font-semibold"
              style={PP}
            >
              ABDM-compliant · Verified Doctors · Secure Payments · GST
              Compliant
            </p>
          </div>
          {!success && (
            <h1 className="text-xl font-black tracking-tight" style={PP}>
              Book Your{" "}
              <span className="text-gradient-primary">Healthcare</span>
            </h1>
          )}
        </div>

        <div
          ref={stepContentRef}
          className="rounded-2xl border-2 border-base-300 shadow-sm bg-base-100 overflow-visible"
        >
          {success ? (
            <BookingSuccess
              data={createData}
              onReset={handleReset}
              router={router}
            />
          ) : (
            <>
              <div className="bg-base-200 border-b border-base-300 overflow-visible relative z-[20]">
                <StepBar
                  steps={steps}
                  currentId={currentStepId}
                  visitedIds={visitedIds}
                  onStepClick={handleStepClick}
                />
              </div>
              <div className="relative min-h-[420px]">
                <AnimatePresence custom={direction} mode="wait">
                  <motion.div
                    key={currentStepId + "_" + form.bookingType}
                    custom={direction}
                    variants={slide}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="p-3 sm:p-5"
                  >
                    {stepContent[currentStepId]}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 py-3 sm:px-4 sm:py-4 border-t border-base-300 bg-base-200">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={goPrev}
                  disabled={curIdx === 0}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl font-black text-xs border-2 border-base-300 transition-all disabled:opacity-25 disabled:cursor-not-allowed flex-shrink-0 min-h-[44px] min-w-[72px] justify-center text-base-content bg-base-100 hover:border-primary hover:text-primary"
                  style={PP}
                >
                  <ChevronLeft size={14} />
                  Back
                </motion.button>
                <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                  <p
                    className="text-[9px] font-black uppercase tracking-widest text-base-content/35"
                    style={PP}
                  >
                    {curIdx + 1}/{steps.length}
                  </p>
                  <div className="flex gap-1">
                    {steps.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-full transition-all duration-300 h-[4px]"
                        style={{
                          width: s.id === currentStepId ? 10 : 4,
                          background: visitedIds.includes(s.id)
                            ? "var(--primary)"
                            : "var(--base-300)",
                        }}
                      />
                    ))}
                  </div>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={goNext}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs text-primary-content disabled:opacity-50 transition-all flex-shrink-0 min-h-[44px] min-w-[96px] justify-center bg-primary hover:opacity-90 shadow-[0_4px_12px_rgba(var(--color-primary),0.25)]"
                  style={{ ...PP }}
                >
                  {isSubmitting ? (
                    <>
                      {<Loader2 size={13} className="animate-spin" />}
                      {paymentState === "opening" ? "Payment…" : "Booking…"}
                    </>
                  ) : isLast ? (
                    <>
                      <CheckCircle2 size={13} />
                      Confirm
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight size={13} />
                    </>
                  )}
                </motion.button>
              </div>
            </>
          )}
        </div>

        {!success && (
          <div className="flex justify-center mt-3">
            <button
              type="button"
              onClick={() => router.push("/doctors")}
              className="flex items-center gap-1 text-xs font-bold text-base-content/35 hover:text-base-content/60 transition-colors min-h-[40px] px-3"
              style={PP}
            >
              <ChevronLeft size={11} />
              Back to Doctors
            </button>
          </div>
        )}
      </div>
    </div>
  );
}