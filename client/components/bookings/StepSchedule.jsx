"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Info,
  Building2,
  MapPin,
  Timer,
  Navigation2,
  Loader2,
  Home,
  HeartPulse,
  FileText,
  Check,
} from "lucide-react";
import { Field, Inp, Txta, SCard, AvailPill, FareRow } from "./atoms";
import { SubCoverageBanner } from "./banners";
import { LocationPicker } from "./LocationPicker";
import { PP } from "@/lib/constants";
import { fmt } from "@/lib/helpers";
import { resolveTransportFee, resolveCaFee } from "@/lib/feeResolvers";

// FIX: debounce delay for auto-recheck. Fires AFTER the user stops
// typing/picking a new date-time, not on every keystroke.
const AVAIL_RECHECK_DEBOUNCE_MS = 500;

export function StepSchedule({
  form,
  set,
  errors,
  setErrors,
  caTiersLoading,
  hospitalAvail,
  hospitalAvailLoading,
  doctorAvail,
  doctorAvailLoading,
  transportEstimate,
  transportLoading,
  onCheckHospAvail,
  onCheckDocAvail,
  onEstimateTransport,
  onResetHospAvail,
  onResetDocAvail,
  caTiers,
  isLoaded,
}) {
  const isFullCare = form.bookingType === "full_care_ride";
  const isTransport = form.bookingType === "patient_transport";
  const isDiagHome = form.bookingType === "diagnostic_home";
  const isCareOnly = form.bookingType === "care_assistant";
  const isPhysio = form.bookingType === "physiotherapist";

 
  const effectiveConsultationType = form.consultationType || "inPerson";

  useEffect(() => {
    if (
      (isTransport || isFullCare) &&
      form.patientLocation?.coordinates &&
      (form.destinationLocation?.coordinates || isFullCare)
    ) {
      onEstimateTransport();
    }
  }, [
    form.patientLocation?.coordinates?.[0],
    form.patientLocation?.coordinates?.[1],
    form.destinationLocation?.coordinates?.[0],
    form.destinationLocation?.coordinates?.[1],
    form.includeReturn,
    form.includeReturnHome,
    form.waitingMinutes,
    form.bookingType,
    isFullCare,
    isTransport,
  ]);

  // ─────────────────────────────────────────────────────────────────────────
  // FIX: AUTO-RECHECK AVAILABILITY — no more manual "Recheck" button.
  //
  // Whenever scheduledAt, hospitalId, doctorId, or consultationType changes,
  // this debounces briefly then calls onCheckHospAvail / onCheckDocAvail
  // itself. The pill (AvailPill) re-renders under the field automatically —
  // "auto shows below" per your instruction, no click required.
  //
  // Resets happen up front (avail=null) so a stale "Available" pill can
  // never sit there while the underlying query params have changed.
  // ─────────────────────────────────────────────────────────────────────────
const debounceRef = useRef(null);

  useEffect(() => {
    // Clear any pending check from a previous keystroke/change
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const hasHospital = !!form.hospitalId;
    const hasDoctor = !!form.doctorId;
    const hasSchedule = !!form.scheduledAt;

    if (!hasSchedule || (!hasHospital && !hasDoctor)) {
      onResetHospAvail?.();
      onResetDocAvail?.();
      return;
    }

    // FIX: consultationType is REQUIRED by checkHospitalOrDoctorAvailability
    // (controller 400s "consultationType required" without it). Rather than
    // firing the check with an empty value and eating that error, auto-pick
    // "inPerson" as a sane default the instant a doctor/hospital + schedule
    // exist but no type has been chosen yet. Setting it here changes
    // effectiveConsultationType, which re-runs this effect on the next
    // render with a non-empty value — so we bail out of THIS run and let
    // the re-run do the actual check.
    if (!effectiveConsultationType) {
      set("consultationType", "inPerson");
      return;
    }

    // Immediately mark stale while the debounce timer runs, so the UI
    // never shows a pill that no longer matches the current inputs.
    if (hasHospital) onResetHospAvail?.();
    if (hasDoctor) onResetDocAvail?.();

    debounceRef.current = setTimeout(() => {
      if (hasHospital) onCheckHospAvail?.();
      if (hasDoctor) onCheckDocAvail?.();
    }, AVAIL_RECHECK_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.scheduledAt,
    form.hospitalId,
    form.doctorId,
    effectiveConsultationType,
  ]);

  const getIstMinDate = () => {
    const d = new Date(Date.now() + 15 * 60000);
    const istTime = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return istTime.toISOString().slice(0, 16);
  };
  const minDate = getIstMinDate();
  const durHours = form.durationHours || (caTiers[0]?.hours ?? 4);
  const caTier = caTiers.find((t) => t.hours === durHours) || caTiers[0];
  const tFee = resolveTransportFee(transportEstimate);
  const caResolved = resolveCaFee(form, caTiers);

  // FIX: handleDateTimeChange no longer needs to manually call
  // onResetHospAvail/onResetDocAvail — the useEffect above owns that reset
  // + auto-recheck entirely, triggered by form.scheduledAt changing.
  const handleDateTimeChange = (val) => {
    set("scheduledAt", val);
    clearFieldError("scheduledAt");
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FIX: FIELD VALIDATION — mirrors the required fields enforced by the
  // corrected bookingController.js routes:
  //   - scheduledAt: required always
  //   - consultationType: required for full_care_ride / physiotherapist
  //     (controller now hard-requires it for the availability check)
  //   - patientLocation: required for full_care_ride, patient_transport,
  //     diagnostic_home, care_assistant, physio-homeVisit
  //   - destinationLocation: required for full_care_ride, patient_transport
  // ─────────────────────────────────────────────────────────────────────────
  const clearFieldError = (field) => {
    if (!setErrors) return;
    setErrors((prev) => {
      if (!prev?.[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validateScheduleStep = () => {
    const next = {};

    if (!form.scheduledAt) {
      next.scheduledAt = "Scheduled date & time required";
    }

    if (isFullCare) {
      if (!form.consultationType) next.consultationType = "Consultation type required";
      if (!form.patientLocation?.coordinates?.length)
        next.patientLocation = "Pickup location required";
      if (!form.destinationLocation?.coordinates?.length)
        next.destinationLocation = "Destination (hospital) location required";
    }

    if (isTransport) {
      if (!form.patientLocation?.coordinates?.length)
        next.patientLocation = "Pickup location required";
      if (!form.destinationLocation?.coordinates?.length)
        next.destinationLocation = "Drop-off location required";
      if (form.addConsultation && !form.consultationType)
        next.consultationType = "Consultation type required";
    }

    if (isDiagHome) {
      if (!form.patientLocation?.coordinates?.length)
        next.patientLocation = "Home address required";
    }

    if (isCareOnly) {
      if (!form.patientLocation?.coordinates?.length)
        next.patientLocation = "Service location required";
      if (!form.durationHours)
        next.durationHours = "Select a care duration";
    }

    if (isPhysio) {
      if (!form.consultationType)
        next.consultationType = "Select visit type (At Clinic / Home Visit)";
      if (
        form.consultationType === "homeVisit" &&
        !form.patientLocation?.coordinates?.length
      ) {
        next.patientLocation = "Home address required for home visit";
      }
    }

    // Availability must have resolved to true before proceeding — matches
    // the controller's hard 400 rejection when checkHospitalOrDoctorAvailability
    // returns available:false (wrong consultationType for the slot, slot
    // full at current maxPatients, etc).
    if (form.hospitalId && hospitalAvail && hospitalAvail.available === false) {
      next.scheduledAt = hospitalAvail.reason || "Hospital not available at this time";
    }
    if (form.doctorId && doctorAvail && doctorAvail.available === false) {
      next.scheduledAt = doctorAvail.reason || "Doctor not available at this time";
    }
    if (form.hospitalId && hospitalAvailLoading) {
      next.scheduledAt = "Still checking hospital availability — wait a moment";
    }
    if (form.doctorId && doctorAvailLoading) {
      next.scheduledAt = "Still checking doctor availability — wait a moment";
    }

    setErrors?.((prev) => ({ ...prev, ...next }));
    return Object.keys(next).length === 0;
  };

  // Exposed so a parent "Next" button can call form validation before
  // advancing — wire this up wherever step navigation lives, e.g.:
  //   const ok = stepScheduleRef.current?.validate();
  // (kept as a plain function here since this component has no ref/imperative
  // handle wired up in the file you sent — attach via useImperativeHandle
  // if the parent needs to call it directly.)
  StepSchedule.validate = validateScheduleStep;

  const CaTierGrid = ({ tiers, selectedHours, onSelect }) => (
    <div className="grid grid-cols-3 gap-1.5">
      {tiers.map(({ hours: h, maxHours, label, price }, tierIdx) => {
        const on = selectedHours === h;
        const rangeLabel = maxHours ? `${h}–${maxHours}h` : `${h}+h`;
        const caFreeViaSub =
          !!form.subCoverage?.careAssistantFree &&
          !form.subCoverage?.isCustomPlan;
        const planTierIdx = form.subCoverage?.careAssistantTierIndex ?? 0;
        const hasQuota = !!(
          form.subCoverage?.isCustomPlan &&
          form.subCoverage?.careAssistantAllowed &&
          (form.subCoverage?.careAssistantRemaining ?? 0) > 0
        );
        const isQuotaTier = hasQuota && tierIdx === planTierIdx;
        return (
          <button
            key={h}
            type="button"
            onClick={() => {
              set("durationHours", h);
              clearFieldError("durationHours");
            }}
            className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl border-2 transition-all ${on ? (isQuotaTier || caFreeViaSub ? "border-success bg-success/10 text-success" : "border-warning bg-warning/10 text-warning") : "border-base-300 bg-base-200 text-base-content"}`}
          >
            <span
              className="text-[10px] font-black text-center leading-tight"
              style={PP}
            >
              {label}
            </span>
            <span
              className="text-[9px] font-semibold opacity-60 text-center"
              style={PP}
            >
              {rangeLabel}
            </span>
            {caFreeViaSub && tierIdx === 0 ? (
              <span className="text-[9px] font-black text-success" style={PP}>
                FREE
              </span>
            ) : caFreeViaSub && tierIdx > 0 ? (
              <span className="text-[9px] font-black text-warning" style={PP}>
                {fmt(price)} · extra
              </span>
            ) : isQuotaTier ? (
              <span className="text-[9px] font-black text-success" style={PP}>
                FREE · plan
              </span>
            ) : hasQuota ? (
              <span className="text-[9px] font-black text-warning" style={PP}>
                {fmt(price)} · extra
              </span>
            ) : (
              <span
                className={`text-[11px] font-black ${on ? "text-warning" : "text-primary"}`}
                style={PP}
              >
                {fmt(price)}
              </span>
            )}
            {!caFreeViaSub && !isQuotaTier && (
              <span
                className="text-[7px] text-base-content/30 font-semibold"
                style={PP}
              >
                +18% GST
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          Schedule & Location
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Set your preferred date, time, and locations.
        </p>
      </div>
      <SubCoverageBanner
        subCoverage={form.subCoverage}
        consultationType={form.consultationType}
      />

      <SCard
        title="Appointment Date & Time"
        icon={Calendar}
        accent="var(--primary)"
      >
        <Field
          label="Scheduled Date & Time"
          required
          note="Min 15 min from now"
          error={errors.scheduledAt}
        >
          <Inp
            type="datetime-local"
            value={form.scheduledAt || ""}
            min={minDate}
            step="60"
            onChange={(e) => handleDateTimeChange(e.target.value)}
          />
        </Field>

        {/*
          FIX: pills are now purely reactive — no "Recheck" button.
          - loading  → spinner pill (auto-fires on every relevant change)
          - available → green pill only, no button at all
          - unavailable → red pill + reason, no button (fix the date/time
            or consultationType instead — that's what re-triggers the check)
        */}
        {form.scheduledAt && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {form.hospitalId && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-base-content/40" style={PP}>
                  Hospital:
                </span>
                <AvailPill
                  avail={hospitalAvail}
                  loading={hospitalAvailLoading}
                />
              </div>
            )}
            {form.doctorId && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-base-content/40" style={PP}>
                  Doctor:
                </span>
                <AvailPill avail={doctorAvail} loading={doctorAvailLoading} />
              </div>
            )}
          </div>
        )}

        {/* Surfaces the exact rejection reason from checkHospitalOrDoctorAvailability
            (e.g. "This slot only supports video consultations", "fully booked 3/3") */}
        {(hospitalAvail?.available === false || doctorAvail?.available === false) && (
          <p className="text-[10px] font-bold text-error pt-1" style={PP}>
            {hospitalAvail?.available === false && hospitalAvail?.reason}
            {hospitalAvail?.available === false && doctorAvail?.available === false && " · "}
            {doctorAvail?.available === false && doctorAvail?.reason}
          </p>
        )}

        <Field label="Slot ID (optional)" note="If doctor shared a slot ref">
          <Inp
            placeholder="e.g. SLOT-202506-0042"
            value={form.slotId || ""}
            onChange={(e) => set("slotId", e.target.value)}
          />
        </Field>
      </SCard>

      {isFullCare && (
        <>
          <div className="flex items-center gap-2 p-2.5 rounded-xl border border-info/20 bg-info/5">
            <Info size={11} className="text-info flex-shrink-0" />
            <p className="text-[10px] font-semibold text-info" style={PP}>
              Drop-off auto-set to selected hospital. Set your pickup below.
              Transport = ₹/km × distance + 5% GST.
            </p>
          </div>
          <SCard
            title="Drop-off Destination (Hospital)"
            icon={Building2}
            accent="#ef4444"
          >
            <LocationPicker
              label="Hospital / Destination Address"
              required
              note="Auto-set from hospital selection"
              value={form.destinationLocation}
              onChange={(loc) => {
                set("destinationLocation", loc);
                clearFieldError("destinationLocation");
              }}
              error={errors.destinationLocation}
              readOnly={!!form.hospitalId && !!form.destinationLocation}
              readOnlyNote={`Hospital: ${form.hospitalName || "Selected hospital"}`}
              isLoaded={isLoaded}
            />
          </SCard>
          <SCard
            title="Pickup Location (Your Home)"
            icon={MapPin}
            accent="#f59e0b"
          >
            <LocationPicker
              label="Your Home / Pickup Address"
              required
              note="Transport fare: pickup → hospital"
              value={form.patientLocation}
              onChange={(loc) => {
                set("patientLocation", loc);
                clearFieldError("patientLocation");
              }}
              error={errors.patientLocation}
              isLoaded={isLoaded}
            />
            <Field
              label="Include Return Trip Home?"
              note="Return ride from hospital"
            >
              <div className="flex gap-2">
                {[
                  { v: false, l: "No" },
                  { v: true, l: "Yes — return home" },
                ].map(({ v, l }) => {
                  const on = form.includeReturnHome === v;
                  return (
                    <button
                      key={String(v)}
                      type="button"
                      onClick={() => set("includeReturnHome", v)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-[11px] font-bold transition-all ${on ? "border-primary bg-primary/5 text-primary" : "border-base-300 bg-base-200 text-base-content"}`}
                      style={PP}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </Field>
          </SCard>

          {/* FIX: consultation type is required by the corrected controller
              (checkHospitalOrDoctorAvailability now 400s without it).
              full_care_ride previously had no explicit type selector in
              this component — adding one so the availability check + the
              booking payload actually carry a real value instead of the
              silent "inPerson" default masking a type mismatch. */}
          <SCard title="Consultation Type" icon={HeartPulse} accent="#10b981">
            <Field
              label="How should the doctor see you?"
              required
              error={errors.consultationType}
            >
              <div className="grid grid-cols-3 gap-2">
                {[
                  { v: "inPerson", l: "In Person" },
                  { v: "video", l: "Video" },
                  { v: "homeVisit", l: "Home Visit" },
                ].map(({ v, l }) => {
                  const on = form.consultationType === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        set("consultationType", v);
                        clearFieldError("consultationType");
                      }}
                      className={`py-2.5 rounded-xl border-2 text-[11px] font-bold transition-all ${on ? "border-success bg-success/10 text-success" : "border-base-300 bg-base-200 text-base-content"}`}
                      style={PP}
                    >
                      {l}
                    </button>
                  );
                })}
              </div>
            </Field>
          </SCard>

          <SCard title="Care Assistant Duration" icon={Timer} accent="#f59e0b">
            <div className="flex items-start gap-1.5 mb-2 p-2 rounded-lg bg-warning/5 border border-warning/15">
              <Info
                size={10}
                className="text-warning/70 flex-shrink-0 mt-0.5"
              />
              <p
                className="text-[9px] text-warning/80 font-semibold leading-snug"
                style={PP}
              >
                Fixed plan: CA free (quota consumed on admin assignment). Custom
                plan: only your subscribed tier is free. Other tiers charge
                platform rate + 18% GST.
              </p>
            </div>
            {caTiersLoading ? (
              <div
                className="flex items-center gap-2 text-xs text-base-content/40 py-2"
                style={PP}
              >
                <Loader2 size={11} className="animate-spin" />
                Loading pricing…
              </div>
            ) : caTiers.length === 0 ? (
              <p className="text-xs text-error font-bold" style={PP}>
                Pricing unavailable. Please retry.
              </p>
            ) : (
              <CaTierGrid
                tiers={caTiers}
                selectedHours={form.durationHours}
                onSelect={(h) => {
                  set("durationHours", h);
                  clearFieldError("durationHours");
                }}
              />
            )}
          </SCard>
          {form.patientLocation?.coordinates &&
            form.destinationLocation?.coordinates && (
              <SCard
                title="Live Transport Estimate"
                icon={Navigation2}
                accent="#4f46e5"
              >
                {transportLoading ? (
                  <div
                    className="flex items-center gap-2 text-xs text-base-content/40"
                    style={PP}
                  >
                    <Loader2 size={11} className="animate-spin" />
                    Calculating…
                  </div>
                ) : transportEstimate ? (
                  <div className="space-y-1">
                    <FareRow
                      label="Distance"
                      value={`${transportEstimate.distanceKm} km`}
                      sub
                    />
                    <FareRow
                      label={`Rate/km${tFee.ratePerKm ? ` (₹${tFee.ratePerKm})` : ""}`}
                      value={tFee.ratePerKm ? `₹${tFee.ratePerKm}/km` : "—"}
                      sub
                      note={
                        transportEstimate.kmRateSource === "subscription"
                          ? "Subscription plan rate (lower than ₹21/km default)"
                          : "Standard rate ₹21/km"
                      }
                    />
                    <FareRow
                      label="Transport (outbound)"
                      value={fmt(transportEstimate.outbound?.totalFare)}
                      gstRate={0}
                      gstLabel="excl. GST"
                    />
                    {form.includeReturnHome && transportEstimate.returnLeg && (
                      <FareRow
                        label="Return trip"
                        value={fmt(transportEstimate.returnLeg?.totalFare)}
                        sub
                      />
                    )}
                    <FareRow
                      label="Care Assistant"
                      value={
                        caResolved.isFree
                          ? "FREE"
                          : caResolved.fee > 0
                            ? fmt(caResolved.fee)
                            : fmt(caTier?.price || 0)
                      }
                      note={`${form.durationHours || caTiers[0]?.hours || 4} hrs`}
                      isFree={caResolved.isFree}
                      freeReason={caResolved.reason}
                      gstRate={caResolved.isFree ? null : 0.18}
                    />
                    <div className="border-t border-base-300 pt-1">
                      <FareRow
                        label="Transport Total (excl. GST)"
                        value={fmt(transportEstimate.totalTransportFee)}
                        bold
                        accent="var(--primary)"
                      />
                    </div>
                    <p
                      className="text-[9px] text-base-content/35 px-2"
                      style={PP}
                    >
                      + 5% GST on transport · 18% GST on care assistant (if not
                      free)
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-base-content/40" style={PP}>
                    Set pickup & destination to estimate.
                  </p>
                )}
              </SCard>
            )}
        </>
      )}

      {isTransport && (
        <>
          <SCard
            title="Drop-off Destination"
            icon={Navigation2}
            accent="#ef4444"
          >
            <LocationPicker
              label="Drop-off Address"
              required
              note="Fare is distance-based + 5% GST"
              value={form.destinationLocation}
              onChange={(loc) => {
                set("destinationLocation", loc);
                clearFieldError("destinationLocation");
              }}
              error={errors.destinationLocation}
              isLoaded={isLoaded}
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Field label="Return Trip?" note="Ride back">
                <div className="flex gap-1.5">
                  {[
                    { v: false, l: "No" },
                    { v: true, l: "Yes" },
                  ].map(({ v, l }) => {
                    const on = form.includeReturn === v;
                    return (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => set("includeReturn", v)}
                        className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${on ? "border-primary bg-primary/5 text-primary" : "border-base-300 bg-base-200 text-base-content"}`}
                        style={PP}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Wait (min)" note="5 min free · ₹2/min after">
                <Inp
                  type="number"
                  min="0"
                  max="180"
                  placeholder="0"
                  value={form.waitingMinutes || ""}
                  onChange={(e) =>
                    set("waitingMinutes", Number(e.target.value))
                  }
                />
              </Field>
            </div>
          </SCard>
          <SCard title="Pickup Location" icon={MapPin} accent="#f59e0b">
            <LocationPicker
              label="Patient Pickup Address"
              required
              note="Drag pin for exact location"
              value={form.patientLocation}
              onChange={(loc) => {
                set("patientLocation", loc);
                clearFieldError("patientLocation");
              }}
              error={errors.patientLocation}
              isLoaded={isLoaded}
            />
          </SCard>

          {/* FIX: when addConsultation is on, the controller now requires
              consultationType for the availability check too. */}
          {form.addConsultation && (
            <SCard title="Consultation Type" icon={HeartPulse} accent="#10b981">
              <Field
                label="How should the doctor see you?"
                required
                error={errors.consultationType}
              >
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "inPerson", l: "In Person" },
                    { v: "video", l: "Video" },
                    { v: "homeVisit", l: "Home Visit" },
                  ].map(({ v, l }) => {
                    const on = form.consultationType === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          set("consultationType", v);
                          clearFieldError("consultationType");
                        }}
                        className={`py-2.5 rounded-xl border-2 text-[11px] font-bold transition-all ${on ? "border-success bg-success/10 text-success" : "border-base-300 bg-base-200 text-base-content"}`}
                        style={PP}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </SCard>
          )}

          {form.patientLocation?.coordinates &&
            form.destinationLocation?.coordinates && (
              <div className="pt-1">
                {transportLoading && (
                  <div
                    className="flex items-center gap-2 text-xs text-base-content/40"
                    style={PP}
                  >
                    <Loader2 size={11} className="animate-spin" />
                    Calculating fare…
                  </div>
                )}
                {transportEstimate && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1"
                  >
                    <p
                      className="text-[10px] font-black uppercase tracking-widest text-primary mb-2"
                      style={PP}
                    >
                      Live Transport Estimate
                    </p>
                    <FareRow
                      label="Distance"
                      value={`${transportEstimate.distanceKm} km`}
                      sub
                    />
                    <FareRow
                      label="Rate/km"
                      value={tFee.ratePerKm ? `₹${tFee.ratePerKm}/km` : "—"}
                      note={
                        transportEstimate.kmRateSource === "subscription"
                          ? "Subscription plan rate · base ₹50 applies"
                          : "Standard rate · base ₹50 applies"
                      }
                      sub
                    />
                    <FareRow
                      label="Outbound fare"
                      value={fmt(transportEstimate.outbound?.totalFare)}
                    />
                    {form.includeReturn && transportEstimate.returnLeg && (
                      <FareRow
                        label="Return fare"
                        value={fmt(transportEstimate.returnLeg?.totalFare)}
                      />
                    )}
                    {form.waitingMinutes > 5 && (
                      <FareRow
                        label={`Waiting (${form.waitingMinutes - 5} billable min × ₹2)`}
                        value={fmt(transportEstimate.outbound?.waitingCharge)}
                        sub
                      />
                    )}
                    <div className="border-t border-primary/20 pt-1 mt-1">
                      <FareRow
                        label="Estimated Total (excl. GST)"
                        value={fmt(transportEstimate.totalTransportFee)}
                        bold
                        accent="var(--primary)"
                      />
                    </div>
                    <p
                      className="text-[9px] text-base-content/35 px-2"
                      style={PP}
                    >
                      + 5% GST applied at payment step
                      {transportEstimate.kmRateSource === "subscription" && (
                        <span className="text-success font-bold">
                          {" "}
                          · Subscription rate applied
                        </span>
                      )}
                    </p>
                  </motion.div>
                )}
              </div>
            )}
        </>
      )}

      {isDiagHome && (
        <SCard title="Sample Collection Address" icon={Home} accent="#14b8a6">
          <LocationPicker
            label="Your Home Address"
            required
            note="Lab technician comes here"
            value={form.patientLocation}
            onChange={(loc) => {
              set("patientLocation", loc);
              clearFieldError("patientLocation");
            }}
            error={errors.patientLocation}
            isLoaded={isLoaded}
          />
        </SCard>
      )}

      {isCareOnly && (
        <SCard
          title="Service Location & Duration"
          icon={Timer}
          accent="#f59e0b"
        >
          <LocationPicker
            label="Your Location"
            required
            note="Nearest care assistant dispatched here"
            value={form.patientLocation}
            onChange={(loc) => {
              set("patientLocation", loc);
              clearFieldError("patientLocation");
            }}
            error={errors.patientLocation}
            isLoaded={isLoaded}
          />
          <Field
            label="Care Duration"
            note="Tiered pricing · 18% GST on CA fee"
            error={errors.durationHours}
          >
            {caTiersLoading ? (
              <div
                className="flex items-center gap-2 text-xs text-base-content/40 py-2"
                style={PP}
              >
                <Loader2 size={11} className="animate-spin" />
                Loading pricing…
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {caTiers.map(
                  ({ hours: h, maxHours, label, price }, tierIdx) => {
                    const on = form.durationHours === h;
                    const rangeLabel = maxHours
                      ? `${h}–${maxHours}h`
                      : `${h}+h`;
                    const caFreeViaSub =
                      !!form.subCoverage?.careAssistantFree &&
                      !form.subCoverage?.isCustomPlan;
                    const planTierIdx =
                      form.subCoverage?.careAssistantTierIndex ?? 0;
                    const hasQuota = !!(
                      form.subCoverage?.isCustomPlan &&
                      form.subCoverage?.careAssistantAllowed &&
                      (form.subCoverage?.careAssistantRemaining ?? 0) > 0
                    );
                    const isQuotaTier = hasQuota && tierIdx === planTierIdx;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => {
                          set("durationHours", h);
                          clearFieldError("durationHours");
                        }}
                        className={`flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl border-2 transition-all ${on ? "border-warning bg-warning/10 text-warning" : "border-base-300 bg-base-200 text-base-content"}`}
                      >
                        <span
                          className="text-[10px] font-black text-center leading-tight"
                          style={PP}
                        >
                          {label}
                        </span>
                        <span
                          className="text-[9px] font-semibold opacity-60"
                          style={PP}
                        >
                          {rangeLabel}
                        </span>
                        {caFreeViaSub && tierIdx === 0 ? (
                          <span
                            className="text-[9px] font-black text-success"
                            style={PP}
                          >
                            FREE
                          </span>
                        ) : caFreeViaSub && tierIdx > 0 ? (
                          <span
                            className="text-[9px] font-black text-warning"
                            style={PP}
                          >
                            {fmt(price)}
                          </span>
                        ) : isQuotaTier ? (
                          <span
                            className="text-[9px] font-black text-success"
                            style={PP}
                          >
                            FREE · plan
                          </span>
                        ) : hasQuota ? (
                          <span
                            className="text-[9px] font-black text-warning"
                            style={PP}
                          >
                            {fmt(price)} · extra
                          </span>
                        ) : (
                          <span
                            className={`text-[11px] font-black ${on ? "text-warning" : "text-primary"}`}
                            style={PP}
                          >
                            {fmt(price)}
                          </span>
                        )}
                        {!caFreeViaSub && !isQuotaTier && (
                          <span
                            className="text-[7px] text-base-content/30 font-semibold"
                            style={PP}
                          >
                            +18% GST
                          </span>
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </Field>
        </SCard>
      )}

      {isPhysio && (
        <SCard title="Visit Type" icon={HeartPulse} accent="#10b981">
          <Field
            label="How would you like the session?"
            note="0% GST on consultation"
            error={errors.consultationType}
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  v: "inPerson",
                  l: "At Clinic",
                  icon: Building2,
                  note: "0% GST",
                },
                { v: "homeVisit", l: "Home Visit", icon: Home, note: "5% GST" },
              ].map(({ v, l, icon: Icon, note }) => {
                const on = form.consultationType === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => {
                      set("consultationType", v);
                      clearFieldError("consultationType");
                    }}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${on ? "border-success bg-success/10 text-success" : "border-base-300 bg-base-200 text-base-content"}`}
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-xs" style={PP}>
                        {l}
                      </span>
                      <p
                        className="text-[8px] opacity-50 font-semibold"
                        style={PP}
                      >
                        {note}
                      </p>
                    </div>
                    {on && (
                      <Check
                        size={11}
                        className="ml-auto flex-shrink-0"
                        strokeWidth={3}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Field>
          {form.consultationType === "homeVisit" && (
            <LocationPicker
              label="Your Home Address for Physio"
              required
              note="Physiotherapist will visit here"
              value={form.patientLocation}
              onChange={(loc) => {
                set("patientLocation", loc);
                clearFieldError("patientLocation");
              }}
              error={errors.patientLocation}
              isLoaded={isLoaded}
            />
          )}
        </SCard>
      )}

      <SCard
        title="Special Instructions (optional)"
        icon={FileText}
        accent="var(--info)"
      >
        <Field label="Notes for Provider" note="Symptoms, accessibility needs">
          <Txta
            rows={3}
            placeholder="e.g. Patient uses wheelchair. Allergic to penicillin…"
            value={form.customerNotes || ""}
            onChange={(e) => set("customerNotes", e.target.value)}
          />
        </Field>
      </SCard>
    </div>
  );
}

 
export { };