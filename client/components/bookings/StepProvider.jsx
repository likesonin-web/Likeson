"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Stethoscope,
  Video,
  FlaskConical,
  Loader2,
  Search,
  Check,
  Building2,
  CheckCircle2,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import { Field, Inp, Sel, SCard, AvailPill } from "./atoms";
import { SubCoverageBanner, DiagSubBanner } from "./banners";
import {
  PP,
  BOOKING_TYPES,
  CONSULT_TYPES,
  REPORT_MODES,
} from "@/lib/constants";
import { fmt } from "@/lib/helpers";
import { labSupportsHomeCollection } from "@/lib/feeResolvers";

export function StepProvider({
  form,
  set,
  errors,
  hospitals,
  hospitalsLoading,
  doctorsByHospital,
  doctorsLoading,
  allDoctors,
  allDoctorsLoading,
  hospitalAvail,
  hospitalAvailLoading,
  doctorAvail,
  doctorAvailLoading,
  labs,
  labsLoading,
  labDetail,
  labDetailLoading,
  followUpCheck,
  followUpCheckLoading,
  onLoadHospitals,
  onLoadDoctors,
  onLoadAllDoctors,
  onLoadLabs,
  onLoadLabDetail,
  onCheckHospAvail,
  onCheckDocAvail,
  onCheckFollowUp,
  onResetHospAvail,
  onResetDocAvail,
}) {
  const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
  const isDiag = bt?.isDiag;
  const isOnline = bt?.isOnline || form.bookingType === "doctor_online";
  const providerAccent = isDiag ? "#06b6d4" : isOnline ? "#8b5cf6" : "#0ea5e9";
  const providerIcon = isDiag ? FlaskConical : Stethoscope;

  // ─── Fetch ALL Online Doctors once (no search — dropdown lists everyone) ──
  useEffect(() => {
    if (!isOnline || allDoctors?.length) return;
    onLoadAllDoctors?.({
      consultationType: "video",
      isOnline: "true",
    });
  }, [isOnline]);

  useEffect(() => {
    if (isDiag && !labs?.length) onLoadLabs(form.labCity || "");
  }, [isDiag]);

  useEffect(() => {
    if (!isDiag) return;
    const t = setTimeout(() => {
      onLoadLabs(form.labCity || "");
    }, 450);
    return () => clearTimeout(t);
  }, [form.labCity, isDiag]);

  useEffect(() => {
    if (!isDiag && !isOnline && !hospitals?.length && !hospitalsLoading)
      onLoadHospitals(form.hospSearch || "");
  }, [isDiag, isOnline]);

  useEffect(() => {
    if (isDiag || isOnline) return;
    const t = setTimeout(() => {
      onLoadHospitals(form.hospSearch || "");
    }, 450);
    return () => clearTimeout(t);
  }, [form.hospSearch]);

  useEffect(() => {
    if (form.bookingType === "follow_up" && form.doctorId)
      onCheckFollowUp(form.doctorId, form.hospitalId);
  }, [form.doctorId, form.hospitalId, form.bookingType]);

  useEffect(() => {
    if (isOnline) set("consultationType", "video");
  }, [isOnline]);

  const showConsultTypes =
    bt?.needsDoctor &&
    form.bookingType !== "doctor_online" &&
    form.bookingType !== "follow_up" &&
    form.bookingType !== "physiotherapist" &&
    form.bookingType !== "full_care_ride";

  const buildDoctorOptionText = (d) => {
    const fees = d.effectiveFees || d.fees;
    const name = d.user?.name || d.doctorName || d.name || "Doctor";
    const spec = d.specialization || d.doctorSpec || "";
    const parts = [name];
    if (spec) parts.push(`— ${spec}`);
    // Online: name — specialization only. Fee shown separately in the
    // Fee Schedule card below once selected, no need to clutter the option.
    if (!isOnline && fees?.inPersonFee > 0)
      parts.push(`· ${fmt(fees.inPersonFee)}`);
    return parts.join(" ");
  };

  const doctorList = isOnline ? allDoctors || [] : doctorsByHospital || [];
  const isDoctorListLoading = isOnline ? allDoctorsLoading : doctorsLoading;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          {isDiag
            ? "Select Diagnostic Lab"
            : isOnline
              ? "Select Your Doctor"
              : "Select Doctor & Hospital"}
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          {isDiag
            ? "Find a lab and choose tests or packages. Prices shown include subscription discount if applicable."
            : isOnline
              ? "Search for a doctor available for video consultation. 5% GST applies on video fee."
              : "Search for a hospital, then choose your doctor and consultation type."}
        </p>
      </div>

      <SubCoverageBanner
        form={form}
        subCoverage={form.subCoverage}
        consultationType={form.consultationType}
      />
      {isDiag && <DiagSubBanner subCoverage={form.subCoverage} />}

      {isOnline && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5">
          <Video size={13} className="text-primary flex-shrink-0 mt-0.5" />
          <p
            className="text-[11px] font-semibold text-primary leading-snug"
            style={PP}
          >
            Online consultation is video-only. 5% GST applies. Cash payment not
            available. No hospital selection needed.
          </p>
        </div>
      )}

      {/* ─── Diagnostic Lab ─────────────────────────────────────────────── */}
      {isDiag && (
        <SCard title="Find a Lab" icon={providerIcon} accent={providerAccent}>
          <Field label="Search by City" note="Auto-updates as you type">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none"
              />
              <Inp
                placeholder="e.g. Vijayawada…"
                value={form.labCity || ""}
                onChange={(e) => set("labCity", e.target.value)}
                className="pl-8 pr-8"
              />
              {labsLoading && (
                <Loader2
                  size={12}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin opacity-50"
                />
              )}
            </div>
          </Field>
          {labsLoading && !labs?.length && (
            <div
              className="flex items-center gap-2 text-xs text-base-content/40 py-1"
              style={PP}
            >
              <Loader2 size={11} className="animate-spin" />
              Loading labs…
            </div>
          )}

          {labs?.length > 0 && (
            <Field
              label="Select Lab"
              note="Home ✓ = home collection available"
              error={errors.labId}
            >
              <Sel
                value={form.labId || ""}
                onChange={(e) => {
                  const labId = e.target.value;
                  set("labId", labId);
                  set(
                    "labName",
                    labs.find((l) => l._id === labId)?.labName || "",
                  );
                  set("selectedTests", []);
                  set("selectedPackages", []);
                  if (labId) onLoadLabDetail(labId);
                }}
              >
                <option value="">— Choose a lab —</option>
                {labs.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.labName} — {l.registeredAddress?.city}
                    {labSupportsHomeCollection(l) ? " (Home ✓)" : ""}
                  </option>
                ))}
              </Sel>
            </Field>
          )}

          {labDetailLoading && (
            <div
              className="flex items-center gap-2 text-xs text-base-content/40 py-1"
              style={PP}
            >
              <Loader2 size={11} className="animate-spin" />
              Loading tests…
            </div>
          )}
          {!labDetailLoading && form.labId && !labDetail && (
            <div
              className="flex items-center gap-2 text-xs text-error py-1"
              style={PP}
            >
              <AlertCircle size={11} />
              Failed to load lab tests. Try selecting lab again.
            </div>
          )}

          {labDetail && (
            <>
              <Field
                label="Select Tests"
                note="Tap to select/deselect · prices after sub discount"
                error={errors.selectedTests}
              >
                <div className="w-full bg-base-200/60 border border-base-300 rounded-xl max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                  {labDetail.labTests
                    ?.filter((t) =>
                      form.bookingType === "diagnostic_home"
                        ? t.homeCollectionAvailable === true
                        : true,
                    )
                    .map((t) => {
                      const testSlug = t.slug;
                      if (!testSlug) return null;

                      const discPct =
                        form.subCoverage?.diagnosticsDiscountPercent || 0;
                      const basePrice = t.discountedPrice ?? t.mrpPrice;
                      const displayPrice =
                        discPct > 0
                          ? +(basePrice * (1 - discPct / 100)).toFixed(0)
                          : basePrice;

                      const isSelected = (form.selectedTests || []).includes(
                        testSlug,
                      );

                      return (
                        <button
                          key={testSlug}
                          type="button"
                          onClick={() => {
                            const current = form.selectedTests || [];
                            if (current.includes(testSlug)) {
                              set(
                                "selectedTests",
                                current.filter((v) => v !== testSlug),
                              );
                            } else {
                              set("selectedTests", [...current, testSlug]);
                            }
                          }}
                          style={PP}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                            isSelected
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-base-300/50 text-base-content"
                          }`}
                        >
                          <span className="text-left flex-1 pr-2">
                            {t.testName} — {fmt(displayPrice)}
                            {discPct > 0
                              ? ` (was ${fmt(basePrice)}, ${discPct}% off)`
                              : ""}{" "}
                            · +5% GST
                          </span>
                          {isSelected && (
                            <Check
                              size={14}
                              className="flex-shrink-0"
                              strokeWidth={3}
                            />
                          )}
                        </button>
                      );
                    })}
                </div>
                {form.selectedTests?.length > 0 && (
                  <p
                    className="text-[10px] text-primary font-bold mt-1"
                    style={PP}
                  >
                    {form.selectedTests.length} test
                    {form.selectedTests.length > 1 ? "s" : ""} selected · 5% GST
                    on each
                  </p>
                )}
              </Field>

              {labDetail.labPackages?.length > 0 && (
                <Field
                  label="Packages (optional)"
                  note="Tap to select/deselect · prices after sub discount"
                >
                  <div className="w-full bg-base-200/60 border border-base-300 rounded-xl max-h-48 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                    {labDetail.labPackages?.map((p) => {
                      const pkgSlug = p.slug;
                      if (!pkgSlug) return null;

                      const discPct =
                        form.subCoverage?.diagnosticsDiscountPercent || 0;
                      const basePrice = p.mrpPrice;
                      const displayPrice =
                        discPct > 0
                          ? +(basePrice * (1 - discPct / 100)).toFixed(0)
                          : basePrice;

                      const isSelected = (form.selectedPackages || []).includes(
                        pkgSlug,
                      );

                      return (
                        <button
                          key={pkgSlug}
                          type="button"
                          onClick={() => {
                            const current = form.selectedPackages || [];
                            if (current.includes(pkgSlug)) {
                              set(
                                "selectedPackages",
                                current.filter((v) => v !== pkgSlug),
                              );
                            } else {
                              set("selectedPackages", [...current, pkgSlug]);
                            }
                          }}
                          style={PP}
                          className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                            isSelected
                              ? "bg-primary/15 text-primary"
                              : "hover:bg-base-300/50 text-base-content"
                          }`}
                        >
                          <span className="text-left flex-1 pr-2">
                            {p.packageName} — {fmt(displayPrice)}
                            {discPct > 0
                              ? ` (was ${fmt(basePrice)}, ${discPct}% off)`
                              : ""}{" "}
                            · +5% GST
                          </span>
                          {isSelected && (
                            <Check
                              size={14}
                              className="flex-shrink-0"
                              strokeWidth={3}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              )}

              <Field label="Report Delivery Mode">
                <Sel
                  value={form.reportDeliveryMode || "Digital (App)"}
                  onChange={(e) => set("reportDeliveryMode", e.target.value)}
                >
                  {REPORT_MODES.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </Sel>
              </Field>
            </>
          )}
        </SCard>
      )}

      {/* ─── Doctor / Hospital ────────────────────────────────────────────── */}
      {bt?.needsDoctor && (
        <SCard
          title={isOnline ? "Find Doctor for Video Call" : "Hospital & Doctor"}
          icon={providerIcon}
          accent={providerAccent}
        >
          {!isOnline && (
            <Field
              label="Hospital / Clinic"
              note="Search by city (auto-updates)"
              error={errors.hospitalId}
            >
              <div className="space-y-2">
                <div className="relative">
                  <Search
                    size={12}
                    className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none"
                  />
                  <Inp
                    placeholder="City, e.g. Vijayawada…"
                    value={form.hospSearch || ""}
                    onChange={(e) => set("hospSearch", e.target.value)}
                    className="pl-8 pr-8"
                  />
                  {hospitalsLoading && (
                    <Loader2
                      size={12}
                      className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin opacity-50"
                    />
                  )}
                </div>
                {hospitalsLoading && !hospitals?.length && (
                  <div
                    className="flex items-center gap-2 text-xs text-base-content/40 py-1"
                    style={PP}
                  >
                    <Loader2 size={11} className="animate-spin" />
                    Loading hospitals…
                  </div>
                )}
                {hospitals?.length > 0 && (
                  <Sel
                    value={form.hospitalId || ""}
                    onChange={(e) => {
                      const hId = e.target.value;
                      const h = hospitals.find((h) => h._id === hId);
                      set("hospitalId", hId);
                      set("hospitalName", h?.name || "");
                      set("hospitalAddress", h?.address || null);
                      set("hospitalCoords", h?.location?.coordinates || null);
                      set("doctorId", "");
                      set("doctorName", "");
                      if (hId && h?.location?.coordinates) {
                        const coords = h.location.coordinates;
                        set("destinationLocation", {
                          coordinates: coords,
                          address:
                            [
                              h.address?.line1,
                              h.address?.line2,
                              h.address?.city,
                            ]
                              .filter(Boolean)
                              .join(", ") || h.name,
                          city: h.address?.city || "",
                          pincode: h.address?.pincode || "",
                        });
                      }
                      if (hId) onLoadDoctors(hId);
                      onResetHospAvail?.();
                      onResetDocAvail?.();
                    }}
                  >
                    <option value="">— Select hospital —</option>
                    {hospitals.map((h) => (
                      <option key={h._id} value={h._id}>
                        {h.name} — {h.address?.city}
                        {h.is24x7 ? " · 24×7" : ""}
                      </option>
                    ))}
                  </Sel>
                )}
                {form.hospitalId && form.scheduledAt && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span
                      className="text-[10px] text-base-content/40"
                      style={PP}
                    >
                      Hospital:
                    </span>
                    <AvailPill
                      avail={hospitalAvail}
                      loading={hospitalAvailLoading}
                    />
                    {!hospitalAvail && !hospitalAvailLoading && (
                      <button
                        type="button"
                        onClick={onCheckHospAvail}
                        className="text-[10px] text-primary font-bold hover:underline"
                        style={PP}
                      >
                        Check now
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Field>
          )}

          {isDoctorListLoading && (
            <div
              className="flex items-center gap-2 text-xs text-base-content/40 py-1"
              style={PP}
            >
              <Loader2 size={11} className="animate-spin" />
              Loading doctors…
            </div>
          )}

          {doctorList.length > 0 && (
            <Field
              label={isOnline ? "Select Doctor" : "Doctor"}
              note={
                isOnline
                  ? "Fee shown below once selected"
                  : "Fee shown in option"
              }
              error={errors.doctorId}
            >
              <Sel
                value={form.doctorId || ""}
                onChange={(e) => {
                  const d = doctorList.find((d) => d._id === e.target.value);
                  set("doctorId", e.target.value);
                  set("doctorName", d?.user?.name || d?.name || "");
                  set("doctorSpec", d?.specialization || "");
                  set("doctorFees", d?.effectiveFees || d?.fees || null);
                  if (isOnline && d) {
                    set("hospitalId", d.hospitalId || d.hospital?._id || "");
                    set(
                      "hospitalName",
                      d.hospitalName || d.hospital?.name || "",
                    );
                  }
                  onResetDocAvail?.();
                }}
              >
                <option value="">— Select doctor —</option>
                {doctorList.map((d) => (
                  <option key={d._id} value={d._id}>
                    {buildDoctorOptionText(d)}
                  </option>
                ))}
              </Sel>
            </Field>
          )}

          {isOnline &&
            form.doctorId &&
            (form.hospitalName || form.doctorSpec) && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl border border-primary/20 bg-primary/5"
              >
                <Building2 size={13} className="text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  {form.hospitalName && (
                    <p
                      className="text-xs font-black text-primary truncate"
                      style={PP}
                    >
                      {form.hospitalName}
                    </p>
                  )}
                  {form.doctorSpec && (
                    <p
                      className="text-[10px] text-primary font-semibold opacity-70"
                      style={PP}
                    >
                      {form.doctorSpec}
                    </p>
                  )}
                </div>
                <span
                  className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded-md flex-shrink-0"
                  style={PP}
                >
                  Hospital
                </span>
              </motion.div>
            )}

          {!doctorList.length && !isDoctorListLoading && !isOnline && (
            <Field
              label="Doctor Profile ID"
              note="Enter directly if known"
              error={errors.doctorId}
            >
              <Inp
                placeholder="Doctor profile ObjectId…"
                value={form.doctorId || ""}
                onChange={(e) => {
                  set("doctorId", e.target.value);
                  set("doctorName", "");
                  set("doctorFees", null);
                  onResetDocAvail?.();
                }}
              />
            </Field>
          )}

          {form.doctorId && form.scheduledAt && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-base-content/40" style={PP}>
                Doctor slot:
              </span>
              <AvailPill avail={doctorAvail} loading={doctorAvailLoading} />
              {!doctorAvail && !doctorAvailLoading && (
                <button
                  type="button"
                  onClick={onCheckDocAvail}
                  className="text-[10px] text-primary font-bold hover:underline"
                  style={PP}
                >
                  Check now
                </button>
              )}
            </div>
          )}

          {form.doctorFees && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-info/20 bg-info/5"
            >
              <p
                className="text-[9px] font-black uppercase tracking-widest text-info px-3 pt-2 pb-1"
                style={PP}
              >
                {form.doctorName || "Doctor"} — Fee Schedule
              </p>
              <div className="grid grid-cols-3 gap-0 px-3 pb-2">
                {[
                  { key: "inPersonFee", label: "In-Person", gst: "0% GST" },
                  { key: "videoFee", label: "Video", gst: "+5% GST" },
                  { key: "followUpFee", label: "Follow-Up", gst: "0% GST" },
                ].map((item, idx) => (
                  <div
                    key={item.key}
                    className={`text-center ${idx > 0 ? "border-l border-info/20" : ""}`}
                  >
                    <p
                      className="text-[9px] text-base-content/40 font-bold uppercase tracking-wider"
                      style={PP}
                    >
                      {item.label}
                    </p>
                    <p className="text-xs font-black text-info" style={PP}>
                      {form.doctorFees[item.key] != null &&
                      form.doctorFees[item.key] > 0 ? (
                        fmt(form.doctorFees[item.key])
                      ) : (
                        <span className="text-base-content/30">—</span>
                      )}
                    </p>
                    <p
                      className="text-[8px] text-base-content/35 font-semibold"
                      style={PP}
                    >
                      {item.gst}
                    </p>
                  </div>
                ))}
              </div>
              <p
                className="text-[9px] text-center text-base-content/35 px-3 pb-2"
                style={PP}
              >
                Source:{" "}
                {form.doctorFees?.source === "hospital"
                  ? "Hospital pricing"
                  : "Doctor's own rates"}
              </p>
            </motion.div>
          )}

          {showConsultTypes && (
            <Field label="Consultation Type" note="GST differs by type">
              <div className="grid grid-cols-3 gap-1.5">
                {CONSULT_TYPES.map(
                  ({ value, label, icon: Icon, feeKey, gstNote }) => {
                    const on = form.consultationType === value;
                    const fee = form.doctorFees
                      ? form.doctorFees[feeKey]
                      : null;
                    const notAvailable =
                      form.doctorFees != null && (fee == null || fee === 0);
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          !notAvailable && set("consultationType", value)
                        }
                        disabled={notAvailable}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 transition-all text-center relative ${on ? "border-primary bg-primary/10 text-primary" : notAvailable ? "border-base-300 bg-base-100 opacity-40 cursor-not-allowed" : "border-base-300 bg-base-200 text-base-content"}`}
                        style={PP}
                      >
                        <Icon size={13} />
                        <span
                          className="text-[9px] font-black uppercase tracking-wide leading-tight"
                          style={PP}
                        >
                          {label}
                        </span>
                        {fee != null && fee > 0 ? (
                          <span
                            className={`text-[8px] font-bold ${on ? "text-primary" : "text-base-content/60"}`}
                            style={PP}
                          >
                            {fmt(fee)}
                          </span>
                        ) : notAvailable ? (
                          <span
                            className="text-[8px] font-bold text-error/60"
                            style={PP}
                          >
                            N/A
                          </span>
                        ) : (
                          <span
                            className="text-[8px] text-base-content/30"
                            style={PP}
                          >
                            —
                          </span>
                        )}
                        <span
                          className={`text-[7px] font-black leading-none ${on ? "text-primary/60" : "text-base-content/30"}`}
                          style={PP}
                        >
                          {gstNote}
                        </span>
                      </button>
                    );
                  },
                )}
              </div>
            </Field>
          )}

          {isOnline && form.doctorFees && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Video size={13} className="text-primary" />
                <div>
                  <p className="text-xs font-black text-primary" style={PP}>
                    Video Fee
                  </p>
                  <p
                    className="text-[9px] text-primary/60 font-semibold"
                    style={PP}
                  >
                    +5% GST on video
                  </p>
                </div>
              </div>
              <p className="text-base font-black text-primary" style={PP}>
                {form.doctorFees.videoFee != null &&
                form.doctorFees.videoFee > 0
                  ? fmt(form.doctorFees.videoFee)
                  : "—"}
              </p>
            </div>
          )}
        </SCard>
      )}

      {/* ─── Follow-up eligibility ─────────────────────────────────────────── */}
      {form.bookingType === "follow_up" && form.doctorId && (
        <div className="space-y-2">
          {followUpCheckLoading && (
            <div
              className="flex items-center gap-2 text-xs text-base-content/40 p-3 rounded-xl border border-base-300 bg-base-200"
              style={PP}
            >
              <Loader2 size={11} className="animate-spin" />
              Checking follow-up eligibility…
            </div>
          )}

          {followUpCheck && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-start gap-2 p-3 rounded-xl border text-xs ${followUpCheck.isEligible ? "border-success/25 bg-success/5 text-success" : "border-error/25 bg-error/5 text-error"}`}
            >
              {followUpCheck.isEligible ? (
                <CheckCircle2 size={14} className="flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold text-xs" style={PP}>
                  {followUpCheck.isEligible
                    ? `Eligible — Fee: ${fmt(followUpCheck.followUpFee)}`
                    : followUpCheck.reason}
                </p>
                {followUpCheck.isEligible && (
                  <>
                    <p className="text-[10px] opacity-70 mt-0.5" style={PP}>
                      {followUpCheck.daysRemaining} days remaining · Ref:{" "}
                      {followUpCheck.parentOpNumber}
                    </p>
                    <p
                      className="text-[10px] opacity-60 mt-0.5 italic"
                      style={PP}
                    >
                      Follow-up fee is independent of subscription quota. 0%
                      GST.
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* ── Patient identity requirement notice (eligible only) ─────── */}
          {followUpCheck?.isEligible && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-2.5 rounded-xl border border-warning/30 bg-warning/5"
            >
              <UserCheck
                size={13}
                className="text-warning flex-shrink-0 mt-0.5"
              />
              <div>
                <p
                  className="text-[11px] font-black text-warning leading-tight"
                  style={PP}
                >
                  Patient name & phone must match original consultation
                </p>
                <p
                  className="text-[10px] text-warning/70 font-semibold mt-0.5 leading-snug"
                  style={PP}
                >
                  Enter exact details in the Patient step. Mismatch = booking
                  rejected and follow-up fee charged. Original patient:{" "}
                  <strong>
                    {followUpCheck.originalPatientName ?? "on file"}
                  </strong>
                  .
                </p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
