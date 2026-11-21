"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Receipt, Percent, CreditCard, Coins, ShieldCheck } from "lucide-react";
import { Field, Inp, SCard, FareRow } from "./atoms";
import {
  SubCoverageBanner,
  DiagSubBanner,
  GstReferenceBox,
  WalletSplitBanner,
  CashPaymentBanner,
  OnlineCashNotAvailableBanner,
} from "./banners";
import {
  PP,
  BOOKING_TYPES,
  CONSULT_TYPES,
  GST_RATES,
  getPaymentMethods,
} from "@/lib/constants";
import { fmt } from "@/lib/helpers";
import {
  resolveConsultFee,
  resolveCaFee,
  resolveTransportFee,
  resolveHomeCollectionFree,
} from "@/lib/feeResolvers";

export function StepPayment({
  form,
  set,
  transportEstimate,
  followUpCheck,
  caTiers,
  walletBalance,
  walletData,
  labDetail,
}) {
  const [couponStatus, setCouponStatus] = useState(null);
  const bt = BOOKING_TYPES.find((b) => b.value === form.bookingType);

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
  const hasDiag = bt?.isDiag;

  const diagDiscountPct = form.subCoverage?.diagnosticsDiscountPercent || 0;
  // resolveHomeCollectionFree: true only if plan includes AND not yet used this period
  const homeCollectionFree =
    hasDiag && form.bookingType === "diagnostic_home"
      ? resolveHomeCollectionFree(form.subCoverage)
      : false;

  const diagFee = hasDiag ? form.estimatedDiagFee || 0 : 0;
  const diagGstAmt = hasDiag
    ? +(diagFee * GST_RATES.diagnostics).toFixed(2)
    : 0;

  const rawHomeColFee = labDetail?.homeCollectionFee ?? 0;
  const homeColFeeToCharge =
    form.bookingType === "diagnostic_home"
      ? homeCollectionFree
        ? 0
        : rawHomeColFee
      : 0;
  const homeColGstAmt = +(
    homeColFeeToCharge * GST_RATES.homeCollection
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
    consultFee + transportFee + caFee + diagFee + homeColFeeToCharge;
  const totalGst =
    consultGstAmt + transportGstAmt + caGstAmt + diagGstAmt + homeColGstAmt;
  const estimatedTotal = +(subtotal + totalGst).toFixed(2);

  const hasKnownTotal =
    subtotal > 0 ||
    consultResolved.isFree ||
    caResolved.isFree ||
    (hasDiag &&
      (form.selectedTests?.length > 0 || form.selectedPackages?.length > 0));
  const consultTypeLabel =
    CONSULT_TYPES.find((c) => c.value === form.consultationType)?.label ||
    "In-Person";
  const durHours = form.durationHours || (caTiers[0]?.hours ?? 4);
  const caTier = caTiers.find((t) => t.hours === durHours) || caTiers[0];

  // Available payment methods filtered by booking type (Cash hidden for doctor_online)
  const paymentMethods = getPaymentMethods(form.bookingType);

  // Reset Cash→Razorpay if switched to doctor_online
  useEffect(() => {
    if (form.bookingType === "doctor_online" && form.paymentMethod === "Cash") {
      set("paymentMethod", "Razorpay");
    }
  }, [form.bookingType, form.paymentMethod]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-black tracking-tight mb-0.5" style={PP}>
          Payment & Fare Breakdown
        </h2>
        <p className="text-xs text-base-content/45" style={PP}>
          Review all charges before confirming. GST rates vary by service type.
        </p>
      </div>
      <SubCoverageBanner
        subCoverage={form.subCoverage}
        consultationType={form.consultationType}
      />
      {hasDiag && <DiagSubBanner subCoverage={form.subCoverage} />}

      <SCard title="Fare Breakdown" icon={Receipt} accent="var(--primary)">
        {bt?.needsDoctor && (
          <>
            <FareRow
              label={`Consultation (${consultTypeLabel})`}
              value={fmt(consultFee)}
              isFree={consultResolved.isFree}
              freeReason={consultResolved.reason}
              gstRate={consultResolved.isFree ? null : consultGstRate}
              note={
                form.bookingType === "follow_up"
                  ? "Follow-up fee — independent of subscription quota"
                  : form.consultationType === "homeVisit"
                    ? "Home visit — sub quota not applicable"
                    : undefined
              }
            />
            {!consultResolved.isFree && consultGstAmt > 0 && (
              <FareRow
                label={`GST on Consultation (${(consultGstRate * 100).toFixed(0)}%)`}
                value={fmt(consultGstAmt)}
                sub
              />
            )}
            {!consultResolved.isFree &&
              consultFee > 0 &&
              consultGstRate === 0 && (
                <div className="px-2.5 pb-1">
                  <p
                    className="text-[9px] text-base-content/35 italic"
                    style={PP}
                  >
                    In-person consultation: 0% GST (Section 9 healthcare exempt)
                  </p>
                </div>
              )}
            {!consultResolved.isFree &&
              form.consultationType === "homeVisit" && (
                <div className="px-2.5 pb-1">
                  <p
                    className="text-[9px] text-warning font-bold italic"
                    style={PP}
                  >
                    ⚠ Home visit always charged — sub quota covers
                    in-person/video only · 5% GST
                  </p>
                </div>
              )}
          </>
        )}

        {bt?.needsTransport && (
          <>
            <div className="border-t border-base-300/40 pt-1" />
            <FareRow
              label="Transport Charge"
              value={
                transportFee > 0
                  ? fmt(transportFee)
                  : "Set pickup & destination"
              }
              gstRate={transportFee > 0 ? GST_RATES.transport : null}
              note={
                transportEstimate
                  ? `${transportEstimate.distanceKm} km · ₹${tResolved.ratePerKm || "—"}/km${transportEstimate.kmRateSource === "subscription" ? " (plan rate)" : " (default)"}  · base ₹50`
                  : "Calculated from your location"
              }
            />
            {transportFee > 0 && (
              <FareRow
                label="GST on Transport (5%)"
                value={fmt(transportGstAmt)}
                sub
              />
            )}
          </>
        )}

        {bt?.needsCare && (
          <>
            <div className="border-t border-base-300/40 pt-1" />
            <FareRow
              label="Care Assistant Fee"
              value={
                caResolved.isFree
                  ? "FREE"
                  : caResolved.fee > 0
                    ? fmt(caResolved.fee)
                    : fmt(caTier?.price || 0)
              }
              note={
                caTier
                  ? `${caTier.label} · ${caTier.hours}${caTier.maxHours ? `–${caTier.maxHours}` : "+"} hrs`
                  : `${durHours}-hr session`
              }
              isFree={caResolved.isFree}
              freeReason={caResolved.reason}
              gstRate={caResolved.isFree ? null : GST_RATES.careAssistant}
            />
            {!caResolved.isFree && caGstAmt > 0 && (
              <FareRow
                label="GST on Care Assistant (18%)"
                value={fmt(caGstAmt)}
                sub
              />
            )}
            {!caResolved.isFree && (
              <div className="px-2.5">
                <p
                  className="text-[9px] text-base-content/35 italic"
                  style={PP}
                >
                  Care assistant services attract 18% GST (non-medical support
                  service)
                </p>
              </div>
            )}
          </>
        )}

        {hasDiag && (
          <>
            <div className="border-t border-base-300/40 pt-1" />
            <FareRow
              label="Diagnostic Tests / Packages"
              value={
                diagFee > 0 ? (
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
                ) : form.selectedTests?.length > 0 ||
                  form.selectedPackages?.length > 0 ? (
                  fmt(0)
                ) : (
                  "No tests selected"
                )
              }
              note={`${(form.selectedTests?.length || 0) + (form.selectedPackages?.length || 0)} item(s) selected${(form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 ? ` · ${form.subCoverage?.diagnosticsDiscountPercent || 0}% sub discount applied` : ""}`}
              gstRate={diagFee > 0 ? GST_RATES.diagnostics : null}
            />
            {(form.subCoverage?.diagnosticsDiscountPercent || 0) > 0 &&
              diagFee > 0 && (
                <FareRow
                  label={`Subscription discount (${form.subCoverage?.diagnosticsDiscountPercent || 0}%)`}
                  value={`-${fmt(Math.round(diagFee / (1 - (form.subCoverage?.diagnosticsDiscountPercent || 0) / 100)) - diagFee)}`}
                  sub
                  note="Applied to base price · max cap 25%"
                  accent="var(--success)"
                />
              )}
            {diagFee > 0 && (
              <FareRow
                label="GST on Diagnostics (5%)"
                value={fmt(diagGstAmt)}
                sub
              />
            )}
          </>
        )}

        {form.bookingType === "diagnostic_home" && (
          <FareRow
            label="Home Collection Fee"
            value={
              homeCollectionFree
                ? "WAIVED"
                : labDetail?.homeCollectionFee != null
                  ? fmt(labDetail.homeCollectionFee)
                  : "Lab-dependent"
            }
            note={
              !homeCollectionFree && labDetail?.homeCollectionFee != null
                ? form.subCoverage?.homeCollectionIncluded &&
                  (form.subCoverage?.homeCollectionRemaining ?? 0) <= 0
                  ? "Quota exhausted — lab fee + 5% GST applies"
                  : "Charged by lab for technician visit · 5% GST"
                : undefined
            }
            sub={!homeCollectionFree}
            isFree={homeCollectionFree}
            freeReason={
              homeCollectionFree
                ? form.subCoverage?.homeCollectionUnlimited
                  ? "Unlimited home collection — included in plan"
                  : `${form.subCoverage?.homeCollectionRemaining ?? ""} use(s) remaining this subscription period`
                : undefined
            }
            gstRate={
              homeCollectionFree
                ? null
                : labDetail?.homeCollectionFee
                  ? GST_RATES.homeCollection
                  : null
            }
          />
        )}

        {hasKnownTotal && subtotal > 0 && !caResolved.isCustomPlan && (
          <div className="border-t border-base-300 pt-1 mt-1 space-y-0.5">
            <FareRow label="Subtotal (before GST)" value={fmt(subtotal)} />
            {totalGst > 0 && (
              <FareRow
                label="Total GST (mixed rates)"
                value={fmt(totalGst)}
                sub
                note="Transport 5% + CA 18% + Diag 5% + Consult varies"
              />
            )}
          </div>
        )}
        {hasKnownTotal &&
          subtotal === 0 &&
          (consultResolved.isFree || caResolved.isFree) && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-success/30 bg-success/5">
              <ShieldCheck size={12} className="text-success flex-shrink-0" />
              <p className="text-[11px] font-black text-success" style={PP}>
                All charges covered by your subscription!
              </p>
            </div>
          )}

        <div className="border-t border-base-300 pt-1 mt-1" />
        <FareRow
          label={
            caResolved.isCustomPlan
              ? "Partial Estimated Total"
              : "Estimated Total"
          }
          value={fmt(estimatedTotal)}
          note={
            estimatedTotal === 0
              ? "Fully covered by subscription"
              : "May vary ±5% after subscription & coupon application"
          }
          accent="var(--primary)"
          bold
          highlight
        />
      </SCard>

      {/* GST Reference box */}
      <GstReferenceBox />

      <SCard title="Coupon & Discounts" icon={Percent} accent="var(--success)">
        <Field
          label="Coupon Code (optional)"
          note="Valid coupons will be verified and deducted from your total"
        >
          <div className="flex gap-2">
            <Inp
              placeholder="e.g. CARE20 / FIRST50"
              value={form.couponCode || ""}
              onChange={(e) => {
                set("couponCode", e.target.value.toUpperCase());
                setCouponStatus(null);
              }}
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => {
                if (!form.couponCode?.trim()) {
                  setCouponStatus({ type: "error", text: "Please enter a coupon code." });
                  return;
                }
                setCouponStatus({
                  type: "success",
                  text: `Coupon "${form.couponCode.trim().toUpperCase()}" attached! Will be verified and discounted at booking.`,
                });
              }}
              className="px-4 py-2.5 rounded-xl border-2 border-primary text-primary font-black text-xs hover:bg-primary hover:text-primary-content transition-colors flex-shrink-0"
              style={PP}
            >
              Apply
            </button>
          </div>
          {couponStatus && (
            <p
              className={`text-xs mt-2 font-semibold ${
                couponStatus.type === "success" ? "text-success" : "text-error"
              }`}
            >
              {couponStatus.text}
            </p>
          )}
        </Field>
      </SCard>

      <SCard title="Payment Method" icon={CreditCard} accent="var(--secondary)">
        <div className="space-y-2">
          {paymentMethods.map(({ value, label, icon: Icon, desc }) => {
            const on = form.paymentMethod === value;
            return (
              <motion.button
                key={value}
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={() => set("paymentMethod", value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${on ? "border-primary bg-primary/5" : "border-base-300 bg-base-100"}`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? "bg-primary/12 text-primary" : "bg-base-200 text-base-content opacity-55"}`}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-black text-xs ${on ? "text-primary" : "text-base-content"}`}
                    style={PP}
                  >
                    {label}
                  </p>
                  <p
                    className="text-[10px] text-base-content/40 truncate"
                    style={PP}
                  >
                    {desc}
                  </p>
                  {value === "Wallet" && on && walletBalance != null && (
                    <p
                      className="text-[10px] text-primary font-semibold mt-0.5"
                      style={PP}
                    >
                      Balance: {fmt(walletBalance)}
                    </p>
                  )}
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${on ? "border-primary bg-primary" : "border-base-300 bg-transparent"}`}
                >
                  {on && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </motion.button>
            );
          })}
          {form.bookingType === "doctor_online" && (
            <OnlineCashNotAvailableBanner />
          )}
        </div>

        {form.paymentMethod === "Wallet" && (
          <div className="mt-2">
            <WalletSplitBanner
              walletBalance={walletBalance}
              walletData={walletData}
              totalAmount={estimatedTotal}
              paymentMethod={form.paymentMethod}
            />
          </div>
        )}
        {form.paymentMethod === "Cash" && estimatedTotal > 0 && (
          <div className="mt-2">
            <CashPaymentBanner totalAmount={estimatedTotal} />
          </div>
        )}
        {form.paymentMethod === "Razorpay" && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5 mt-2">
            <CreditCard
              size={12}
              className="text-primary flex-shrink-0 mt-0.5"
            />
            <p className="text-[10px] text-primary font-semibold" style={PP}>
              Razorpay opens after you confirm. Supports UPI, Card, Net Banking.
              Secured by RBI-regulated gateway.
            </p>
          </div>
        )}
      </SCard>

      <div className="flex items-start gap-2 p-3 rounded-xl border border-base-300 bg-base-200/50">
        <ShieldCheck
          size={13}
          className="text-base-content/40 flex-shrink-0 mt-0.5"
        />
        <p
          className="text-[10px] text-base-content/45 leading-relaxed"
          style={PP}
        >
          Cancellations 24+ hrs before: 100% refund. Within 24 hrs: 50% refund.
          Same-day no-show: no refund. Refund processing: 5–12 business days.
        </p>
      </div>
    </div>
  );
}
