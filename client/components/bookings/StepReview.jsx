"use client";

import { motion } from "framer-motion";
import {
  Stethoscope,
  AlertCircle,
  CreditCard,
  ShieldCheck,
  Loader2,
  Coins,
} from "lucide-react";
import { FareRow } from "./atoms";
import { PP, BOOKING_TYPES, CONSULT_TYPES, GST_RATES, getPaymentMethods } from "@/lib/constants";
import { fmt, fmtDate } from "@/lib/helpers";
import {
  resolveConsultFee,
  resolveCaFee,
  resolveTransportFee,
  resolveHomeCollectionFree,
} from "@/lib/feeResolvers";

export function StepReview({
  form,
  isLoading,
  error,
  transportEstimate,
  followUpCheck,
  caTiers,
  walletBalance,
  paymentState,
  pendingPaymentBooking,
  handleRetryPayment,
  isRetryingPayment,
  labDetail,
}) {
  const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);
  const Icon = bt?.icon || Stethoscope;
  const durHours = form.durationHours || (caTiers[0]?.hours ?? 4);
  const caTier = caTiers.find((t) => t.hours === durHours) || caTiers[0];

  const consultResolved = bt?.needsDoctor
    ? resolveConsultFee(form, followUpCheck)
    : { fee: 0, isFree: false, gstRate: 0 };
  const caResolved = bt?.needsCare
    ? resolveCaFee(form, caTiers)
    : { fee: 0, isFree: false };
  const tResolved = resolveTransportFee(transportEstimate);

  const consultFee = consultResolved.fee;
  const caFee = caResolved.fee;
  const transportFee = bt?.needsTransport ? tResolved.fee : 0;
  const diagFee = bt?.isDiag ? form.estimatedDiagFee || 0 : 0;
  const diagGstAmt = bt?.isDiag
    ? +(diagFee * GST_RATES.diagnostics).toFixed(2)
    : 0;

  const homeCollectionFree2 =
    bt?.isDiag && form.bookingType === "diagnostic_home"
      ? resolveHomeCollectionFree(form.subCoverage)
      : false;
  const rawHomeColFee2 = labDetail?.homeCollectionFee ?? 0;
  const homeColFeeToCharge2 =
    form.bookingType === "diagnostic_home"
      ? homeCollectionFree2
        ? 0
        : rawHomeColFee2
      : 0;
  const homeColGstAmt2 = +(
    homeColFeeToCharge2 * GST_RATES.homeCollection
  ).toFixed(2);

  const consultGstRate = consultResolved.gstRate ?? 0;
  const consultGstAmt = bt?.needsDoctor
    ? +(consultFee * consultGstRate).toFixed(2)
    : 0;
  const transportGstAmt = bt?.needsTransport
    ? +(transportFee * GST_RATES.transport).toFixed(2)
    : 0;
  const caGstAmt =
    bt?.needsCare && !caResolved.isFree
      ? +(caFee * GST_RATES.careAssistant).toFixed(2)
      : 0;

  const subtotal =
    consultFee + transportFee + caFee + diagFee + homeColFeeToCharge2;
  const totalGst =
    consultGstAmt + transportGstAmt + caGstAmt + diagGstAmt + homeColGstAmt2;
  const total = +(subtotal + totalGst).toFixed(2);

  const consultTypeLabel =
    CONSULT_TYPES.find((c) => c.value === form.consultationType)?.label ||
    "In-Person";
  const walletAvailable = Math.max(0, walletBalance ?? 0);
  const walletPays =
    form.paymentMethod === "Wallet" && total > 0
      ? Math.min(walletAvailable, total)
      : 0;
  const razorpayPortion =
    form.paymentMethod === "Wallet" ? Math.max(0, total - walletPays) : 0;

  const summaryItems = [
    { l: "Service type", v: bt?.label },
    { l: "Patient name", v: form.patientName },
    {
      l: "Age / Gender",
      v: `${form.patientAge || "—"} yrs · ${form.patientGender || "—"}`,
    },
    { l: "Phone", v: form.patientPhone || "—" },
    { l: "Scheduled at", v: fmtDate(form.scheduledAt) },
    !bt?.isOnline && form.hospitalName
      ? { l: "Hospital", v: form.hospitalName }
      : null,
    form.doctorName || form.doctorId
      ? { l: "Doctor", v: form.doctorName || form.doctorId }
      : null,
    form.consultationType && form.bookingType !== "follow_up" && !bt?.isDiag
      ? { l: "Consult type", v: consultTypeLabel }
      : null,
    (form.bookingType === "care_assistant" ||
      form.bookingType === "full_care_ride") &&
    caTier
      ? {
          l: "Care duration",
          v: `${caTier.label} (${caTier.hours}${caTier.maxHours ? `–${caTier.maxHours}` : "+"}  hrs)`,
        }
      : null,
    form.labName ? { l: "Lab", v: form.labName } : null,
    form.patientLocation?.address
      ? { l: "Pickup", v: form.patientLocation.address }
      : null,
    form.destinationLocation?.address
      ? { l: "Drop-off", v: form.destinationLocation.address }
      : null,
    form.includeReturn || form.includeReturnHome
      ? { l: "Return trip", v: "Yes — included" }
      : null,
    {
      l: "Payment",
      v: getPaymentMethods(form.bookingType).find(
        (p) => p.value === form.paymentMethod,
      )?.label,
    },
    form.couponCode ? { l: "Coupon code", v: form.couponCode } : null,
    form.subCoverage?.consultationFree && form.consultationType !== "homeVisit"
      ? { l: "Sub benefit", v: "Consultation FREE · 0% GST" }
      : null,
    form.subCoverage?.careAssistantFree
      ? { l: "Sub benefit", v: "Care Assistant FREE" }
      : null,
    form.paymentMethod === "Wallet" && walletPays > 0
      ? { l: "Wallet pays", v: fmt(walletPays) }
      : null,
    form.paymentMethod === "Wallet" && razorpayPortion > 0
      ? { l: "Razorpay pays", v: fmt(razorpayPortion) }
      : null,
  ]
    .filter(Boolean)
    .filter((i) => i && i.v);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          Review & Confirm
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Double-check everything before confirming.
        </p>
      </div>

      <div
        className="flex items-center gap-2.5 p-3 rounded-2xl"
        style={{ background: bt?.bg || "var(--base-200)" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-base-100"
          style={{ color: bt?.color || "var(--primary)" }}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p
            className="font-black text-sm truncate"
            style={{ color: bt?.color || "var(--primary)", ...PP }}
          >
            {bt?.label}
          </p>
          <p
            className="text-[10px] text-base-content/45 line-clamp-1"
            style={PP}
          >
            {bt?.desc}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-base-300">
        {summaryItems.map((item, i) => (
          <div
            key={(item.l || "") + i}
            className="flex items-start justify-between px-3 py-2 gap-3"
            style={{
              borderBottom:
                i < summaryItems.length - 1
                  ? "1px solid var(--base-300)"
                  : "none",
            }}
          >
            <span
              className="text-[10px] font-black uppercase tracking-widest text-base-content/35 flex-shrink-0 mt-0.5 w-20"
              style={PP}
            >
              {item.l}
            </span>
            <span
              className={`text-xs font-bold text-right break-words min-w-0 flex-1 ${item.l === "Sub benefit" ? "text-success" : item.l === "Wallet pays" ? "text-primary" : item.l === "Razorpay pays" ? "text-secondary" : "text-base-content"}`}
              style={PP}
            >
              {item.v}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5">
        <div className="px-3 py-2 border-b border-primary/15">
          <p
            className="text-[10px] font-black uppercase tracking-widest text-primary"
            style={PP}
          >
            Estimated Charges (incl. GST)
          </p>
        </div>
        <div className="p-3 space-y-1">
          {bt?.needsDoctor && (
            <>
              <FareRow
                label={`Consultation (${consultTypeLabel})`}
                value={consultFee > 0 ? fmt(consultFee) : "FREE"}
                isFree={consultResolved.isFree}
                freeReason={consultResolved.reason}
                gstRate={consultResolved.isFree ? null : consultGstRate}
                note={
                  form.bookingType === "follow_up"
                    ? "Follow-up fee — independent of subscription · 0% GST"
                    : form.consultationType === "homeVisit"
                      ? "Home visit — subscription quota not applicable · 5% GST"
                      : undefined
                }
              />
              {!consultResolved.isFree && consultGstAmt > 0 && (
                <FareRow
                  label={`GST (${(consultGstRate * 100).toFixed(0)}%)`}
                  value={fmt(consultGstAmt)}
                  sub
                />
              )}
            </>
          )}
          {bt?.needsTransport && transportFee > 0 && (
            <>
              <FareRow
                label="Transport"
                value={fmt(transportFee)}
                gstRate={GST_RATES.transport}
                note={
                  transportEstimate
                    ? `${transportEstimate.distanceKm} km · ₹${tResolved.ratePerKm}/km${transportEstimate.kmRateSource === "subscription" ? " (plan)" : " (default)"} · base ₹50`
                    : undefined
                }
              />
              {transportGstAmt > 0 && (
                <FareRow
                  label="GST on Transport (5%)"
                  value={fmt(transportGstAmt)}
                  sub
                />
              )}
            </>
          )}
          {bt?.isDiag && diagFee > 0 && (
            <>
              <FareRow
                label="Diagnostic Tests / Packages"
                value={
                  (form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 ? (
                    <span className="flex items-center gap-1.5 justify-end">
                      <span className="line-through text-[10px] opacity-50 font-medium">
                        {fmt(
                          Math.round(
                            diagFee /
                              (1 -
                                (form.subCoverage?.diagnosticsDiscountPercent ||
                                  0) /
                                  100),
                          ),
                        )}
                      </span>
                      <span>{fmt(diagFee)}</span>
                    </span>
                  ) : (
                    fmt(diagFee)
                  )
                }
                gstRate={GST_RATES.diagnostics}
                note={`${(form.selectedTests?.length || 0) + (form.selectedPackages?.length || 0)} item(s)${(form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 ? ` · ${form.subCoverage?.diagnosticsDiscountPercent || 0}% sub discount applied` : ""}`}
              />
              {diagGstAmt > 0 && (
                <FareRow
                  label="GST on Diagnostics (5%)"
                  value={fmt(diagGstAmt)}
                  sub
                />
              )}
            </>
          )}
          {bt?.isDiag && form.bookingType === "diagnostic_home" && (
            <FareRow
              label="Home Collection Fee"
              value={homeCollectionFree2 ? "WAIVED" : fmt(homeColFeeToCharge2)}
              isFree={homeCollectionFree2}
              freeReason={
                homeCollectionFree2
                  ? form.subCoverage?.homeCollectionUnlimited
                    ? "Unlimited — included in plan"
                    : `${form.subCoverage?.homeCollectionRemaining ?? ""} use(s) remaining`
                  : undefined
              }
              gstRate={
                homeCollectionFree2
                  ? null
                  : homeColFeeToCharge2 > 0
                    ? GST_RATES.homeCollection
                    : null
              }
              note={
                !homeCollectionFree2
                  ? "Lab technician visit charge · 5% GST"
                  : undefined
              }
            />
          )}
          {bt?.needsCare && (
            <>
              <FareRow
                label="Care Assistant"
                value={
                  caResolved.isFree
                    ? "FREE"
                    : caResolved.fee > 0
                      ? fmt(caResolved.fee)
                      : fmt(caTier?.price || 0)
                }
                note={
                  caTier
                    ? `${caTier.label} · ${caTier.hours}${caTier.maxHours ? `–${caTier.maxHours}` : "+"}  hrs`
                    : undefined
                }
                isFree={caResolved.isFree}
                freeReason={caResolved.reason}
                gstRate={caResolved.isFree ? null : GST_RATES.careAssistant}
              />
              {!caResolved.isFree &&
                !caResolved.isCustomPlan &&
                caGstAmt > 0 && (
                  <FareRow label="GST on CA (18%)" value={fmt(caGstAmt)} sub />
                )}
            </>
          )}
          {totalGst > 0 && !caResolved.isCustomPlan && (
            <div className="border-t border-primary/15 pt-1">
              <FareRow
                label="Total GST"
                value={fmt(totalGst)}
                sub
                note="Mixed rates: transport 5%, CA 18%, diagnostics 5%"
              />
            </div>
          )}
          <div className="border-t border-primary/20 pt-1 mt-1">
            <FareRow
              label={
                caResolved.isCustomPlan
                  ? "Partial Estimated Total"
                  : "Total (incl. GST)"
              }
              value={fmt(total)}
              bold
              accent="var(--primary)"
              highlight
              note={
                total === 0
                  ? "Fully covered by subscription"
                  : "* Confirmed at booking — coupons applied then."
              }
            />
          </div>
          {form.paymentMethod === "Wallet" && total > 0 && walletPays > 0 && (
            <div className="border-t border-primary/10 pt-2 mt-1 space-y-1">
              <FareRow
                label="From Wallet"
                value={fmt(walletPays)}
                sub
                accent="var(--primary)"
              />
              {razorpayPortion > 0 && (
                <FareRow
                  label="Via Razorpay"
                  value={fmt(razorpayPortion)}
                  sub
                  accent="var(--secondary)"
                />
              )}
            </div>
          )}
          {form.paymentMethod === "Cash" && total > 0 && (
            <div className="border-t border-warning/20 pt-2 mt-1">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-warning/5 border border-warning/20">
                <div className="flex items-center gap-2">
                  <Coins size={12} className="text-warning flex-shrink-0" />
                  <p className="text-[11px] font-black text-warning" style={PP}>
                    Cash to pay at service
                  </p>
                </div>
                <p className="text-base font-black text-warning" style={PP}>
                  {fmt(total)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {form.paymentMethod === "Razorpay" && total > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <CreditCard size={13} className="text-primary flex-shrink-0 mt-0.5" />
          <p
            className="text-[10px] font-semibold text-primary leading-relaxed"
            style={PP}
          >
            Clicking <strong>Confirm</strong> opens Razorpay. Complete payment
            to finalise booking. Amount includes all GST.
          </p>
        </div>
      )}
      {form.paymentMethod === "Razorpay" &&
        total === 0 &&
        !caResolved.isCustomPlan && (
          <div className="flex items-start gap-2 p-3 rounded-xl border border-success/30 bg-success/5">
            <ShieldCheck
              size={13}
              className="text-success flex-shrink-0 mt-0.5"
            />
            <p
              className="text-[10px] font-semibold text-success leading-relaxed"
              style={PP}
            >
              No payment required — fully covered by your subscription. Clicking{" "}
              <strong>Confirm</strong> completes the booking.
            </p>
          </div>
        )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5 p-3 rounded-xl border border-error/30 bg-error/5 text-error"
        >
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs font-bold" style={PP}>
            {error}
          </p>
        </motion.div>
      )}

      {isLoading && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <Loader2
            size={16}
            className="animate-spin text-primary flex-shrink-0"
          />
          <div>
            <p className="text-xs font-black text-primary" style={PP}>
              Creating your booking…
            </p>
            <p className="text-[10px] text-base-content/40" style={PP}>
              Processing payment and assigning providers
            </p>
          </div>
        </div>
      )}

      {paymentState === "failed" && pendingPaymentBooking && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-2 p-3 rounded-xl border border-warning/30 bg-warning/5"
        >
          <p className="text-[11px] font-black text-warning" style={PP}>
            Booking saved — payment incomplete
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRetryPayment}
              disabled={isRetryingPayment}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-black text-xs text-primary-content min-h-[40px] bg-primary hover:opacity-90 transition-opacity disabled:opacity-50"
              style={PP}
            >
              {isRetryingPayment ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Opening…
                </>
              ) : (
                <>
                  <CreditCard size={12} /> Retry Payment
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      <div className="space-y-1 text-center">
        <p
          className="text-[9px] text-base-content/30 leading-relaxed"
          style={PP}
        >
          By confirming, you agree to Likeson.in{" "}
          <a
            href="/terms"
            className="underline hover:text-primary transition-colors"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/terms"
            className="underline hover:text-primary transition-colors"
          >
            Cancellation Policy
          </a>
          .
        </p>
        <p
          className="text-[9px] text-base-content/25 leading-relaxed"
          style={PP}
        >
          Likeson Healthcare Pvt. Ltd. · Vijayawada, Andhra Pradesh · CIN:
          U85100AP2024PTC001 ·{" "}
          <a
            href="mailto:support@likeson.in"
            className="underline hover:text-primary transition-colors"
          >
            support@likeson.in
          </a>{" "}
          ·{" "}
          <a
            href="tel:+918008000000"
            className="underline hover:text-primary transition-colors"
          >
            +91 80080 00000
          </a>
        </p>
        <p className="text-[9px] text-base-content/20" style={PP}>
          Payments secured by Razorpay · Data protected under IT Act 2000 · GST
          compliant
        </p>
      </div>
    </div>
  );
}
