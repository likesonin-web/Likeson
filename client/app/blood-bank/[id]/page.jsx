"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Droplets, MapPin, Phone, Mail, Globe, Clock, Star, Award, Zap, Truck,
  Heart, CheckCircle2, AlertCircle, ArrowLeft, Shield, ChevronDown,
  ChevronUp, X, Loader2, MessageSquare, Info, CreditCard, Package,
  User, Navigation, Hash, BadgeCheck, FlaskConical, RefreshCcw,
  Thermometer, Calendar, ExternalLink, Upload, FileText, Building2,
} from "lucide-react";
import {
  fetchBankById,
  fetchPublicInventory,
  createBloodRequest,
  verifyPayment,
  uploadPrescription,
  clearRazorpayOrder,
  setPrescriptionUrl,
} from "@/store/slices/bloodbankSlice";
import { selectUser } from "@/store/slices/userSlice";

// ── Constants ────────────────────────────────────────────────────────────────
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const COMPONENTS = [
  "Whole Blood", "PRBC", "FFP", "Platelets",
  "Cryoprecipitate", "Plasma", "Single Donor Platelets",
  "Leukoreduced PRBC", "Irradiated PRBC", "Washed PRBC",
];

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ── Real Razorpay key from env ────────────────────────────────────────────────
const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SV43jVcrs5wKAM";

// ── Helpers ───────────────────────────────────────────────────────────────────
const statusLabel = (s) =>
  ({ active:"Active", pending:"Pending", suspended:"Suspended", revoked:"Revoked", deactivated:"Deactivated" }[s] || s);

const statusStyle = (s) => ({
  active:   "bg-green-50 text-green-700 border-green-200",
  pending:  "bg-amber-50 text-amber-700 border-amber-200",
  suspended:"bg-red-50 text-red-700 border-red-200",
}[s] || "bg-base-200 text-base-content/60 border-base-300");

const isEmergencyUrgency = (u) => u === "emergency" || u === "mass_casualty";

// ── Blood Group Badge ─────────────────────────────────────────────────────────
// FIX: accepts `available` prop to show availability highlight ring
function BloodGroupBadge({ group, large, available }) {
  const isNeg = group.includes("-");

  // Color logic based on availability
  const availStyle =
    available === undefined
      ? isNeg
        ? "border-rose-300 bg-rose-50 text-rose-700"
        : "border-red-300 bg-red-50 text-red-700"
      : available
      ? "border-green-400 bg-green-50 text-green-700 ring-2 ring-green-300 ring-offset-1"
      : "border-base-300 bg-base-200 text-base-content/35 opacity-50";

  return (
    <span
      className={`inline-flex items-center justify-center font-black rounded-full border-2 transition-all ${
        large ? "w-14 h-14 text-base" : "w-11 h-11 text-xs"
      } ${availStyle}`}
      style={{ fontFamily: "var(--font-family-montserrat)" }}
      title={available !== undefined ? (available ? "In stock" : "Out of stock") : undefined}
    >
      {group}
    </span>
  );
}

// ── Inventory Table ───────────────────────────────────────────────────────────
function InventoryTable({ inventory, onRequest }) {
  const user = useSelector(selectUser);

  if (!inventory?.length) {
    return (
      <div className="text-center py-10">
        <Package size={28} className="text-base-content/25 mx-auto mb-2" />
        <p className="text-sm text-base-content/50">No inventory data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-base-300">
      <table className="table w-full">
        <thead>
          <tr>
            <th>Blood Group</th>
            <th>Component</th>
            <th>Available</th>
            <th>Reserved</th>
            <th>Fee / Unit</th>
            <th>Expires Soon</th>
            {user?.role === "customer" && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {inventory.map((inv) => (
            <tr key={inv._id} className={inv.availableUnits === 0 ? "opacity-50" : ""}>
              <td>
                {/* FIX: pass available to show highlight ring */}
                <BloodGroupBadge
                  group={inv.bloodGroup}
                  available={inv.availableUnits > 0}
                />
              </td>
              <td>
                <div>
                  <p className="font-semibold text-sm text-base-content">{inv.component}</p>
                  {inv.isCriticalStock && (
                    <span className="badge badge-xs badge-error gap-1 mt-0.5">
                      <AlertCircle size={8} /> Critical
                    </span>
                  )}
                  {!inv.isCriticalStock && inv.isLowStock && (
                    <span className="badge badge-xs badge-warning gap-1 mt-0.5">
                      <AlertCircle size={8} /> Low
                    </span>
                  )}
                </div>
              </td>
              <td>
                <span
                  className={`font-black text-lg ${
                    inv.availableUnits === 0
                      ? "text-base-content/30"
                      : inv.availableUnits < 5
                      ? "text-amber-600"
                      : "text-green-600"
                  }`}
                  style={{ fontFamily: "var(--font-family-montserrat)" }}
                >
                  {inv.availableUnits}
                </span>
              </td>
              <td>
                <span className="text-sm text-base-content/60">{inv.reservedUnits}</span>
              </td>
              <td>
                <span className="text-sm font-semibold text-base-content">
                  {inv.processingFeePerUnit > 0 ? `₹${inv.processingFeePerUnit}` : "Free"}
                </span>
              </td>
              <td>
                {inv.expiringIn3Days > 0 ? (
                  <span className="badge badge-xs badge-error">{inv.expiringIn3Days} in 3d</span>
                ) : inv.expiringIn7Days > 0 ? (
                  <span className="badge badge-xs badge-warning">{inv.expiringIn7Days} in 7d</span>
                ) : (
                  <span className="text-xs text-base-content/30">—</span>
                )}
              </td>
              {user?.role === "customer" && (
                <td>
                  <button
                    disabled={inv.availableUnits === 0}
                    onClick={() => onRequest({ bloodGroup: inv.bloodGroup, component: inv.component })}
                    className="btn btn-sm text-white text-xs disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#dc2626,#f87171)" }}
                  >
                    Request
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Prescription Upload Step ─────────────────────────────────────────────────
// FIX: added as step 1.5 between form and payment for non-emergency
function PrescriptionUpload({ onUploaded, onSkip, isEmergency }) {
  const dispatch = useDispatch();
  const { loading } = useSelector((s) => s.bloodBank);
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [localError, setLocalError] = useState("");

  const handleUpload = async () => {
    if (!file) { setLocalError("Please select a file."); return; }
    const fd = new FormData();
    fd.append("prescription", file);
    const res = await dispatch(uploadPrescription(fd));
    if (res.meta.requestStatus === "fulfilled") {
      onUploaded(res.payload.prescriptionUrl);
    } else {
      setLocalError(res.payload || "Upload failed.");
    }
  };

  // Emergency — skip automatically
  if (isEmergency) {
    onSkip();
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
        <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          A valid prescription is required for non-emergency blood requests.
        </p>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-red-200 rounded-xl p-6 text-center cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition-all"
      >
        <Upload size={24} className="text-red-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-base-content/70">
          {file ? file.name : "Click to upload prescription"}
        </p>
        <p className="text-xs text-base-content/40 mt-1">PDF, JPEG, PNG, WebP · max 10 MB</p>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => { setFile(e.target.files[0]); setLocalError(""); }}
        />
      </div>

      {localError && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={12} /> {localError}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!file || loading}
          onClick={handleUpload}
          className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#dc2626,#f87171)" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
          Upload & Continue
        </button>
      </div>
    </div>
  );
}

// ── Blood Request Modal ───────────────────────────────────────────────────────
function RequestModal({ bank, prefill, onClose }) {
  const dispatch  = useDispatch();
  const user      = useSelector(selectUser);
  const { razorpayOrder, loading, prescriptionUrl } = useSelector((s) => s.bloodBank);

  // Steps: 1=form, 2=prescription, 3=payment, 4=success
  const [step,   setStep]   = useState(1);
  const [error,  setError]  = useState("");
  const [form,   setForm]   = useState({
    bloodGroup:  prefill?.bloodGroup || "",
    component:   prefill?.component  || "",
    unitsNeeded: 1,
    patientName: user?.name || "",
    urgency:     "routine",
    notes:       "",
  });

  // FIX: clear stale razorpay order on mount
  useEffect(() => {
    dispatch(clearRazorpayOrder());
  }, [dispatch]);

  const update = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const isEmergency = isEmergencyUrgency(form.urgency);

  // ── Step 1 submit ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.bloodGroup || !form.component) {
      setError("Blood group and component are required."); return;
    }
    if (!form.patientName.trim()) {
      setError("Patient name is required."); return;
    }

    // FIX: go to prescription step for non-emergency
    if (!isEmergency) {
      setStep(2);
      return;
    }

    // Emergency — skip prescription, go straight to create order
    await handleCreateOrder(null);
  };

  // ── Create Razorpay order ────────────────────────────────────────────────
  // FIX: pass prescriptionUrl; backend POST /:id/request creates Razorpay order
  const handleCreateOrder = useCallback(async (rxUrl) => {
    setError("");
    const payload = {
      bloodGroup:     form.bloodGroup,
      component:      form.component,
      unitsNeeded:    form.unitsNeeded,
      patientName:    form.patientName,
      urgency:        form.urgency,
      notes:          form.notes,
      prescriptionUrl: rxUrl || null,
    };

    const res = await dispatch(createBloodRequest({ id: bank._id, requestData: payload }));
    if (res.meta.requestStatus === "fulfilled") {
      setStep(3);
    } else {
      setError(res.payload || "Failed to create request.");
    }
  }, [dispatch, bank._id, form]);

  // ── Prescription uploaded callback ───────────────────────────────────────
  const handlePrescriptionUploaded = useCallback(async (rxUrl) => {
    dispatch(setPrescriptionUrl(rxUrl));
    await handleCreateOrder(rxUrl);
  }, [dispatch, handleCreateOrder]);

  // ── Launch Razorpay ──────────────────────────────────────────────────────
 const handleRazorpay = async () => {
  if (!razorpayOrder) return;

  // Dynamically load Razorpay SDK if not already loaded
  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const loaded = await loadRazorpay();
  if (!loaded) {
    setError("Razorpay SDK failed to load. Check your internet connection.");
    return;
  }

  const options = {
    key:         razorpayOrder.razorpayKeyId || RAZORPAY_KEY,
    amount:      Math.round((razorpayOrder.amount || 0) * 100),
    currency:    "INR",
    name:        bank.name,
    description: `${razorpayOrder.bloodGroup} ${razorpayOrder.component} — ${razorpayOrder.unitsNeeded} unit(s)`,
    order_id:    razorpayOrder.razorpayOrderId,
    handler: async (response) => {
      setError("");
      const verifyRes = await dispatch(
        verifyPayment({
          razorpayOrderId:   response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
          bloodBankId:       bank._id,
          hospitalId:        bank.hospital?._id || bank.hospital || null,
          bloodGroup:        form.bloodGroup,
          component:         form.component,
          unitsNeeded:       form.unitsNeeded,
          patientName:       form.patientName,
          patientGender:     form.patientGender || undefined,
          urgency:           form.urgency,
          notes:             form.notes,
          prescriptionUrl:   prescriptionUrl || null,
        })
      );
      if (verifyRes.meta.requestStatus === "fulfilled") {
        setStep(4);
      } else {
        setError(verifyRes.payload || "Payment verification failed.");
      }
    },
    prefill: { name: user?.name || "", email: user?.email || "" },
    theme:   { color: "#dc2626" },
    modal: {
      ondismiss: () => {
        // User closed Razorpay modal — stay on step 3
      },
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.on("payment.failed", (resp) => {
    setError(`Payment failed: ${resp.error?.description || "Unknown error"}`);
  });
  rzp.open();
};

  // Step labels
  const stepLabels = ["Details", "Prescription", "Payment", "Done"];
  const totalSteps = isEmergency ? 3 : 4; // emergency skips prescription

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.94, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.94, y: 20 }}
          className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg,#7f1d1d,#dc2626)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Droplets size={16} className="text-white" />
              </div>
              <div>
                <p className="font-extrabold text-white text-sm" style={{ fontFamily: "var(--font-family-montserrat)" }}>
                  {step === 4 ? "Request Confirmed!" : "Request Blood Units"}
                </p>
                <p className="text-white/65 text-xs">{bank.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* Step indicators — skip prescription step in emergency */}
          <div className="px-6 pt-4 pb-0 flex items-center gap-1">
            {(isEmergency ? ["Details","Payment","Done"] : stepLabels).map((label, i) => {
              const s = i + 1;
              // Map visual step to actual step
              const actualStep = isEmergency
                ? s === 1 ? 1 : s === 2 ? 3 : 4
                : s;
              const active = step >= actualStep;
              const done   = step > actualStep;
              return (
                <div key={label} className="flex items-center gap-1 flex-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all shrink-0 ${
                      active ? "bg-red-600 border-red-600 text-white" : "border-base-300 text-base-content/40"
                    }`}
                  >
                    {done ? <CheckCircle2 size={12} /> : s}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${active ? "text-red-600" : "text-base-content/40"}`}>
                    {label}
                  </span>
                  {i < (isEmergency ? 2 : 3) && (
                    <div className={`flex-1 h-0.5 rounded-full ${step > actualStep ? "bg-red-500" : "bg-base-200"}`} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-6">
            {error && (
              <div className="alert alert-error mb-4 text-xs py-2">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* ── Step 1: Form ── */}
            {step === 1 && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text text-xs mb-1 block">Blood Group *</label>
                    <select
                      value={form.bloodGroup}
                      onChange={(e) => update("bloodGroup", e.target.value)}
                      className="input-field text-sm"
                      required
                    >
                      <option value="">Select</option>
                      {BLOOD_GROUPS.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1 block">Component *</label>
                    <select
                      value={form.component}
                      onChange={(e) => update("component", e.target.value)}
                      className="input-field text-sm"
                      required
                    >
                      <option value="">Select</option>
                      {COMPONENTS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text text-xs mb-1 block">Units Needed *</label>
                    <input
                      type="number" min="1" max="10"
                      value={form.unitsNeeded}
                      onChange={(e) => update("unitsNeeded", parseInt(e.target.value) || 1)}
                      className="input-field text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-text text-xs mb-1 block">Urgency</label>
                    <select
                      value={form.urgency}
                      onChange={(e) => update("urgency", e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="routine">Routine</option>
                      <option value="urgent">Urgent</option>
                      <option value="emergency">Emergency</option>
                      <option value="mass_casualty">Mass Casualty</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label-text text-xs mb-1 block">Patient Name *</label>
                  <input
                    type="text"
                    value={form.patientName}
                    onChange={(e) => update("patientName", e.target.value)}
                    placeholder="Full name of patient"
                    className="input-field text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="label-text text-xs mb-1 block">Notes (optional)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => update("notes", e.target.value)}
                    placeholder="Clinical indication, ward, bed no…"
                    rows={2}
                    className="input-field text-sm resize-none"
                  />
                </div>

                {isEmergency && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex gap-2">
                    <Zap size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">
                      Emergency request — prescription waived. Request processed immediately.
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60 hover:brightness-110 transition-all"
                  style={{ background: "linear-gradient(135deg,#dc2626,#f87171)", boxShadow: "0 4px 14px rgba(220,38,38,0.3)" }}
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  {isEmergency ? "Proceed to Payment" : "Next: Upload Prescription"}
                </button>
              </form>
            )}

            {/* ── Step 2: Prescription Upload (non-emergency) ── */}
            {step === 2 && !isEmergency && (
              <PrescriptionUpload
                isEmergency={isEmergency}
                onUploaded={handlePrescriptionUploaded}
                onSkip={() => handleCreateOrder(null)}
              />
            )}

            {/* ── Step 3: Payment Summary ── */}
            {step === 3 && razorpayOrder && (
              <div className="space-y-5">
                <div className="rounded-xl border border-base-300 overflow-hidden">
                  <div className="bg-base-200 px-4 py-2.5">
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">Order Summary</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {[
                      ["Blood Group",     razorpayOrder.bloodGroup],
                      ["Component",       razorpayOrder.component],
                      ["Units",           razorpayOrder.unitsNeeded],
                      ["Processing Fee",  `₹${razorpayOrder.feeBreakdown?.processingFee ?? 0}`],
                      ["Cross-Match Fee", `₹${razorpayOrder.feeBreakdown?.crossMatchFee ?? 0}`],
                    ].map(([label, val]) => (
                      <div key={label} className="flex items-center justify-between text-sm">
                        <span className="text-base-content/60">{label}</span>
                        <span className="font-semibold text-base-content">{val}</span>
                      </div>
                    ))}
                    <div className="border-t border-base-300 pt-3 flex items-center justify-between">
                      <span className="font-bold text-base-content">Total</span>
                      <span
                        className="font-black text-xl text-red-600"
                        style={{ fontFamily: "var(--font-family-montserrat)" }}
                      >
                        ₹{razorpayOrder.amount ?? 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
                  <Info size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Blood cannot be sold. This covers processing &amp; handling fees only.
                  </p>
                </div>

                <button
                  onClick={handleRazorpay}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                  style={{ background: "linear-gradient(135deg,#dc2626,#f87171)", boxShadow: "0 4px 14px rgba(220,38,38,0.3)" }}
                >
                  <CreditCard size={15} /> Pay ₹{razorpayOrder.amount ?? 0}
                </button>
              </div>
            )}

            {/* ── Step 3 loading (order being created) ── */}
            {step === 3 && !razorpayOrder && loading && (
              <div className="flex flex-col items-center py-8 gap-3">
                <Loader2 size={28} className="animate-spin text-red-500" />
                <p className="text-sm text-base-content/50">Creating payment order…</p>
              </div>
            )}

            {/* ── Step 4: Success ── */}
            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "linear-gradient(135deg,#dcfce7,#bbf7d0)" }}
                >
                  <CheckCircle2 size={28} className="text-green-600" />
                </div>
                <h3
                  className="font-extrabold text-lg text-base-content mb-2"
                  style={{ fontFamily: "var(--font-family-montserrat)" }}
                >
                  Request Confirmed!
                </h3>
                <p className="text-sm text-base-content/60 mb-6">
                  Your blood request has been sent. The blood bank will notify you shortly.
                  Check your email for confirmation.
                </p>
                <button onClick={onClose} className="btn btn-sm btn-outline border-red-300 text-red-600">
                  Close
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-base-300 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-base-200/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#fee2e2,#fecaca)" }}
            >
              <Icon size={15} className="text-red-600" />
            </div>
          )}
          <h2
            className="font-extrabold text-sm text-base-content"
            style={{ fontFamily: "var(--font-family-montserrat)" }}
          >
            {title}
          </h2>
        </div>
        {open
          ? <ChevronUp   size={15} className="text-base-content/40" />
          : <ChevronDown size={15} className="text-base-content/40" />
        }
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 border-t border-base-300">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Blood Group Availability Grid ─────────────────────────────────────────────
// FIX: new component — shows all 8 blood groups with availability highlight
function BloodGroupAvailabilityGrid({ inventory, onRequest, isCustomer }) {
  // Build availability map: bloodGroup → total availableUnits across all components
  const availMap = {};
  BLOOD_GROUPS.forEach((g) => { availMap[g] = 0; });
  (inventory || []).forEach((inv) => {
    if (availMap[inv.bloodGroup] !== undefined) {
      availMap[inv.bloodGroup] += inv.availableUnits;
    }
  });

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3">
        {BLOOD_GROUPS.map((g) => (
          <div key={g} className="flex flex-col items-center gap-1">
            <BloodGroupBadge
              group={g}
              large
              available={availMap[g] > 0}
            />
            <span
              className={`text-xs font-bold ${
                availMap[g] > 0 ? "text-green-600" : "text-base-content/30"
              }`}
              style={{ fontFamily: "var(--font-family-montserrat)" }}
            >
              {availMap[g] > 0 ? `${availMap[g]} u` : "0"}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-1 text-xs text-base-content/50">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full ring-2 ring-green-400 bg-green-50 inline-block" />
          In Stock
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border-2 border-base-300 bg-base-200 inline-block opacity-50" />
          Out of Stock
        </span>
      </div>
    </div>
  );
}

// ── Main Details Page ─────────────────────────────────────────────────────────
export default function BloodBankDetails() {
  const { id }    = useParams();
  const dispatch  = useDispatch();
  const router    = useRouter();
  const user      = useSelector(selectUser);
  const {
    selectedBank:   bank,
    publicInventory: inventory,
    loading,
  } = useSelector((s) => s.bloodBank);

  const [showModal,    setShowModal]    = useState(false);
  const [modalPrefill, setModalPrefill] = useState(null);
  const [activeTab,    setActiveTab]    = useState("overview");

  useEffect(() => {
    if (id) {
      dispatch(fetchBankById(id));
      dispatch(fetchPublicInventory(id));
    }
  }, [id, dispatch]);

  const openRequest = (prefill = null) => {
    if (!user) { router.push("/login"); return; }
    if (user.role !== "customer") return;
    setModalPrefill(prefill);
    setShowModal(true);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading && !bank) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-red-500 mx-auto mb-3" />
          <p className="text-sm text-base-content/50">Loading blood bank details…</p>
        </div>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!bank && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <h2
            className="font-bold text-base-content mb-1"
            style={{ fontFamily: "var(--font-family-montserrat)" }}
          >
            Blood bank not found
          </h2>
          <button
            onClick={() => router.push("/blood-bank")}
            className="btn btn-sm mt-4 border-red-300 text-red-600"
          >
            Back to listing
          </button>
        </div>
      </div>
    );
  }

  const TABS = [
    { key: "overview",   label: "Overview"    },
    { key: "inventory",  label: "Blood Stock" },
    { key: "services",   label: "Services"    },
    { key: "contact",    label: "Contact"     },
    ...(bank?.licenses?.length || bank?.accreditations?.length
      ? [{ key: "compliance", label: "Compliance" }]
      : []),
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--base-100)" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#7f1d1d 0%,#dc2626 60%,#b91c1c 100%)" }}
      >
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-10 -right-10 w-64 h-64 rounded-full"
            style={{ background: "rgba(255,255,255,0.05)" }}
          />
          <div
            className="absolute bottom-0 left-1/4 w-40 h-40 rounded-full"
            style={{ background: "rgba(255,255,255,0.04)" }}
          />
          <span
            className="absolute -bottom-8 right-6 text-8xl font-black select-none opacity-5 text-white hidden md:block"
            style={{ fontFamily: "var(--font-family-montserrat)" }}
          >
            {bank?.bloodGroupsAvailable?.[0] || "O+"}
          </span>
        </div>

        <div className="container-custom max-w-5xl py-8 relative z-10">
          {/* Back */}
          <button
            onClick={() => router.push("/blood-bank")}
            className="flex items-center gap-2 text-white/70 text-xs hover:text-white mb-5 transition-colors"
          >
            <ArrowLeft size={13} /> Back to Blood Banks
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Logo */}
            <div
              className="w-20 h-20 rounded-2xl border-2 border-white/30 flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}
            >
              {bank?.logoUrl
                ? <img src={bank.logoUrl} alt={bank.name} className="w-full h-full object-cover" />
                : <Droplets size={30} className="text-white" />
              }
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase border ${statusStyle(bank?.status)}`}>
                  {statusLabel(bank?.status)}
                </span>
                {bank?.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <BadgeCheck size={10} /> Verified
                  </span>
                )}
                {bank?.isFeatured && (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold"
                    style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}
                  >
                    <Award size={10} /> Featured
                  </span>
                )}
                {bank?.isEmergency24x7 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                    <Zap size={10} /> 24/7 Emergency
                  </span>
                )}
              </div>

              <h1
                className="text-2xl md:text-3xl font-black text-white leading-tight mb-1"
                style={{ fontFamily: "var(--font-family-montserrat)" }}
              >
                {bank?.name}
              </h1>

              <div className="flex flex-wrap items-center gap-3 text-white/65 text-xs">
                <span className="flex items-center gap-1">
                  <Hash size={11} /> {bank?.bankCode}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={11} />
                  {[bank?.address?.city, bank?.address?.state].filter(Boolean).join(", ")}
                </span>
                {bank?.rating?.totalRatings > 0 && (
                  <span className="flex items-center gap-1">
                    <Star size={11} className="text-amber-300" />
                    {bank.rating.averageRating?.toFixed(1)} ({bank.rating.totalRatings} reviews)
                  </span>
                )}
              </div>
            </div>

            {/* Hero CTA */}
            {user?.role === "customer" && bank?.status === "active" && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => openRequest()}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-white text-red-600 hover:bg-red-50 transition-all shadow-lg flex-shrink-0"
              >
                <Droplets size={16} /> Request Blood
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="border-b border-base-300 bg-white sticky top-0 z-30">
        <div className="container-custom max-w-5xl">
          <div className="flex gap-0 overflow-x-auto scrollbar-thin">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.key
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-base-content/50 hover:text-base-content/80 hover:border-base-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="container-custom max-w-5xl py-7">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Main content ────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* ──── OVERVIEW TAB ─────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <>
                {/* Description */}
                {bank?.description && (
                  <Section title="About" icon={Info} defaultOpen>
                    <div className="pt-4">
                      <p className="text-sm text-base-content/70 leading-relaxed">{bank.description}</p>
                    </div>
                  </Section>
                )}

                {/* FIX: Blood Group Availability highlighted grid */}
                <Section title="Blood Group Availability" icon={Droplets} defaultOpen>
                  <div className="pt-4">
                    <BloodGroupAvailabilityGrid
                      inventory={inventory}
                      onRequest={openRequest}
                      isCustomer={user?.role === "customer"}
                    />
                  </div>
                </Section>

                {/* Operating Hours */}
                {bank?.operatingHours?.length > 0 && (
                  <Section title="Operating Hours" icon={Clock} defaultOpen={false}>
                    <div className="pt-4 space-y-2">
                      {DAYS.map((day) => {
                        const h = bank.operatingHours.find((o) => o.day === day);
                        return (
                          <div key={day} className="flex items-center justify-between text-sm py-1.5 border-b border-base-200 last:border-0">
                            <span className="font-medium text-base-content/70 w-28">{day.slice(0, 3)}</span>
                            {!h || h.isClosed ? (
                              <span className="text-base-content/35 text-xs">Closed</span>
                            ) : h.is24Hours ? (
                              <span className="badge badge-xs badge-success">24 Hours</span>
                            ) : (
                              <span className="text-base-content font-semibold">
                                {h.openTime} — {h.closeTime}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {/* Location */}
                <Section title="Location" icon={MapPin} defaultOpen={false}>
                  <div className="pt-4">
                    <p className="text-sm text-base-content/70 mb-3">
                      {[
                        bank?.address?.line1,
                        bank?.address?.line2,
                        bank?.address?.landmark,
                        bank?.address?.city,
                        bank?.address?.state,
                        bank?.address?.pincode,
                      ].filter(Boolean).join(", ")}
                    </p>
                    {bank?.googleMapsUrl && (
                      <a
                        href={bank.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        <Navigation size={12} /> Open in Maps <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </Section>
              </>
            )}

            {/* ──── INVENTORY TAB ────────────────────────────────────────── */}
            {activeTab === "inventory" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2
                    className="font-extrabold text-base text-base-content"
                    style={{ fontFamily: "var(--font-family-montserrat)" }}
                  >
                    Live Blood Stock
                  </h2>
                  <span className="flex items-center gap-1.5 text-xs text-base-content/50">
                    <RefreshCcw size={11} /> Real-time data
                  </span>
                </div>

                {/* FIX: availability grid at top of inventory tab too */}
                <div className="bg-white border border-base-300 rounded-2xl p-5">
                  <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-4">
                    Blood Group Availability
                  </p>
                  <BloodGroupAvailabilityGrid
                    inventory={inventory}
                    onRequest={openRequest}
                    isCustomer={user?.role === "customer"}
                  />
                </div>

                <InventoryTable inventory={inventory} onRequest={openRequest} />
              </div>
            )}

            {/* ──── SERVICES TAB ─────────────────────────────────────────── */}
            {activeTab === "services" && (
              <Section title="Services Offered" icon={Package} defaultOpen>
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Blood Donations",       active: bank?.acceptsDonations,          icon: Heart },
                    { label: "Home Delivery",          active: bank?.offersDelivery,             icon: Truck },
                    { label: "Cross-Matching",         active: bank?.offersCrossMatch,           icon: FlaskConical },
                    { label: "Component Separation",   active: bank?.offersComponentSeparation,  icon: Thermometer },
                    { label: "Emergency Supply",       active: bank?.offersEmergencySupply,      icon: Zap },
                    { label: "24/7 Emergency",         active: bank?.isEmergency24x7,            icon: AlertCircle },
                    { label: "Apheresis Facility",     active: bank?.hasApheresisFacility,       icon: Package },
                    { label: "Mobile Blood Unit",      active: bank?.hasMobileUnit,              icon: Truck },
                  ].map(({ label, active, icon: Icon }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        active ? "bg-green-50 border-green-200" : "bg-base-200 border-base-300 opacity-50"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? "bg-green-100" : "bg-base-300"}`}>
                        <Icon size={13} className={active ? "text-green-600" : "text-base-content/40"} />
                      </div>
                      <span className="text-sm font-medium text-base-content">{label}</span>
                      {active && <CheckCircle2 size={13} className="text-green-600 ml-auto" />}
                    </div>
                  ))}
                </div>

                {/* Delivery info */}
                {bank?.offersDelivery && (
                  <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
                      <Truck size={12} /> Delivery Details
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label: "Radius",   val: `${bank.deliveryRadiusKm || 0} km` },
                        { label: "Fee/km",   val: `₹${bank.deliveryFeePerKm || 0}` },
                        { label: "Free upto",val: `${bank.freeDeliveryKm || 0} km` },
                      ].map(({ label, val }) => (
                        <div key={label}>
                          <p
                            className="text-lg font-black text-blue-700"
                            style={{ fontFamily: "var(--font-family-montserrat)" }}
                          >
                            {val}
                          </p>
                          <p className="text-xs text-blue-500">{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pricing table */}
                {bank?.pricing?.length > 0 && (
                  <div className="mt-5">
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">
                      Processing Fees
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-base-300">
                      <table className="table w-full">
                        <thead>
                          <tr>
                            <th>Component</th>
                            <th>Processing</th>
                            <th>Cross-Match</th>
                            <th>Storage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bank.pricing.map((p) => (
                            <tr key={p.component}>
                              <td className="font-medium text-sm">{p.component}</td>
                              <td className="text-sm">₹{p.processingFee || 0}</td>
                              <td className="text-sm">₹{p.crossMatchFee || 0}</td>
                              <td className="text-sm">₹{p.storageFee || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-base-content/40 mt-2 flex items-center gap-1">
                      <Info size={10} /> Blood is provided free. Fees cover processing &amp; handling only.
                    </p>
                  </div>
                )}
              </Section>
            )}

            {/* ──── CONTACT TAB ──────────────────────────────────────────── */}
            {activeTab === "contact" && (
              <Section title="Contact Information" icon={Phone} defaultOpen>
                <div className="pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: Phone,        label: "Primary Phone",  val: bank?.contact?.phone },
                      { icon: Phone,        label: "Emergency",      val: bank?.contact?.emergencyPhone },
                      { icon: Phone,        label: "Alternate",      val: bank?.contact?.alternatePhone },
                      { icon: Mail,         label: "Email",          val: bank?.contact?.email },
                      { icon: MessageSquare,label: "WhatsApp",       val: bank?.contact?.whatsapp },
                      { icon: Globe,        label: "Website",        val: bank?.contact?.website, link: true },
                    ]
                      .filter((c) => c.val)
                      .map(({ icon: Icon, label, val, link }) => (
                        <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-base-200 border border-base-300">
                          <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                            <Icon size={13} className="text-red-500" />
                          </div>
                          <div>
                            <p className="text-xs text-base-content/45 mb-0.5">{label}</p>
                            {link ? (
                              <a
                                href={val}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-red-600 hover:underline"
                              >
                                {val}
                              </a>
                            ) : (
                              <p className="text-sm font-semibold text-base-content">{val}</p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Contact persons */}
                  {bank?.contactPersons?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider mb-3">Key Contacts</p>
                      <div className="space-y-2">
                        {bank.contactPersons.map((cp) => (
                          <div key={cp._id} className="flex items-center gap-3 p-3 rounded-xl border border-base-300">
                            <div className="w-9 h-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                              <User size={14} className="text-red-500" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-base-content">{cp.name}</p>
                                {cp.isPrimary      && <span className="badge badge-xs badge-primary">Primary</span>}
                                {cp.isAvailable24x7 && <span className="badge badge-xs badge-success">24/7</span>}
                              </div>
                              {cp.designation && (
                                <p className="text-xs text-base-content/50">{cp.designation}</p>
                              )}
                            </div>
                            {cp.phone && (
                              <a
                                href={`tel:${cp.phone}`}
                                className="text-xs text-red-500 font-semibold hover:text-red-700"
                              >
                                {cp.phone}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* ──── COMPLIANCE TAB ───────────────────────────────────────── */}
            {activeTab === "compliance" && (
              <div className="space-y-5">
                {bank?.licenses?.length > 0 && (
                  <Section title="Licenses" icon={Shield} defaultOpen>
                    <div className="pt-4 space-y-3">
                      {bank.licenses.map((lic) => (
                        <div key={lic._id} className="p-4 rounded-xl border border-base-300">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div>
                              <p className="text-sm font-bold text-base-content">
                                {lic.licenseType?.replace(/_/g, " ")}
                              </p>
                              <p className="text-xs text-base-content/50 font-mono">{lic.licenseNumber}</p>
                            </div>
                            <span className={`badge badge-xs ${lic.isVerified ? "badge-success" : "badge-warning"}`}>
                              {lic.isVerified ? "Verified" : "Pending"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-base-content/50">
                            {lic.issuedBy && <span>Issued by: {lic.issuedBy}</span>}
                            {lic.validUntil && (
                              <span className="flex items-center gap-1">
                                <Calendar size={10} />
                                Valid until: {new Date(lic.validUntil).toLocaleDateString("en-IN")}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {bank?.accreditations?.length > 0 && (
                  <Section title="Accreditations" icon={Award} defaultOpen>
                    <div className="pt-4 space-y-3">
                      {bank.accreditations.map((acc) => (
                        <div key={acc._id} className="p-4 rounded-xl border border-base-300 flex items-center gap-4">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#ede9fe,#ddd6fe)" }}
                          >
                            <Award size={16} className="text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-base-content">{acc.body}</p>
                            {acc.certificateNo && (
                              <p className="text-xs text-base-content/50 font-mono">{acc.certificateNo}</p>
                            )}
                            {acc.validUntil && (
                              <p className="text-xs text-base-content/40 mt-0.5">
                                Valid until {new Date(acc.validUntil).toLocaleDateString("en-IN")}
                              </p>
                            )}
                          </div>
                          {acc.isVerified && <BadgeCheck size={16} className="text-green-500 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </div>
            )}
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <div className="w-full lg:w-72 flex-shrink-0 space-y-4">

            {/* Blood Group Availability summary card */}
            <div
              className="bg-white border border-base-300 rounded-2xl p-5"
              style={{ boxShadow: "0 2px 12px rgba(220,38,38,0.04)" }}
            >
              <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-4">
                Blood Availability
              </p>
              <BloodGroupAvailabilityGrid
                inventory={inventory}
                onRequest={openRequest}
                isCustomer={user?.role === "customer"}
              />
            </div>

            {/* Quick stats */}
            <div
              className="bg-white border border-base-300 rounded-2xl p-5"
              style={{ boxShadow: "0 2px 12px rgba(220,38,38,0.04)" }}
            >
              <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-4">Quick Stats</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Units Issued", val: bank?.stats?.totalUnitsIssued         ?? "—" },
                  { label: "Donations",    val: bank?.stats?.totalDonations           ?? "—" },
                  { label: "Fulfilled",    val: bank?.stats?.totalRequestsFulfilled   ?? "—" },
                  { label: "Reviews",      val: bank?.rating?.totalReviews            ?? "—" },
                ].map(({ label, val }) => (
                  <div key={label} className="stat-card p-3 rounded-xl text-center">
                    <p
                      className="text-xl font-black text-red-600"
                      style={{ fontFamily: "var(--font-family-montserrat)" }}
                    >
                      {val}
                    </p>
                    <p className="text-xs text-base-content/40 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Inventory quick list */}
            {inventory?.length > 0 && (
              <div className="bg-white border border-base-300 rounded-2xl p-5">
                <p className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-3">Stock Summary</p>
                <div className="space-y-2">
                  {inventory.slice(0, 5).map((inv) => (
                    <div key={inv._id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border ${
                            inv.availableUnits > 0
                              ? "border-green-300 bg-green-50 text-green-700 ring-1 ring-green-300"
                              : "border-base-300 bg-base-200 text-base-content/30 opacity-50"
                          }`}
                          style={{ fontFamily: "var(--font-family-montserrat)" }}
                        >
                          {inv.bloodGroup}
                        </span>
                        <span className="text-xs text-base-content/60 max-w-[80px] truncate">
                          {inv.component}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-black ${
                          inv.availableUnits === 0
                            ? "text-base-content/25"
                            : inv.availableUnits < 5
                            ? "text-amber-500"
                            : "text-green-600"
                        }`}
                        style={{ fontFamily: "var(--font-family-montserrat)" }}
                      >
                        {inv.availableUnits}
                      </span>
                    </div>
                  ))}
                  {inventory.length > 5 && (
                    <button
                      onClick={() => setActiveTab("inventory")}
                      className="text-xs text-red-500 font-semibold hover:text-red-700 mt-1"
                    >
                      View all {inventory.length} entries →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Emergency CTA */}
            {bank?.isEmergency24x7 && (
              <div
                className="rounded-2xl p-5"
                style={{ background: "linear-gradient(135deg,#7f1d1d,#dc2626)" }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={16} className="text-red-200" />
                  <p
                    className="font-extrabold text-white text-sm"
                    style={{ fontFamily: "var(--font-family-montserrat)" }}
                  >
                    24/7 Emergency
                  </p>
                </div>
                <p className="text-white/70 text-xs mb-4">
                  This blood bank operates round the clock for emergency cases.
                </p>
                {bank.contact?.emergencyPhone && (
                  <a
                    href={`tel:${bank.contact.emergencyPhone}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white text-red-600 text-xs font-bold hover:bg-red-50 transition-colors"
                  >
                    <Phone size={13} /> Call Emergency Line
                  </a>
                )}
              </div>
            )}

            {/* Customer request CTA */}
            {user?.role === "customer" && bank?.status === "active" && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => openRequest()}
                className="w-full py-3.5 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 hover:brightness-110 transition-all"
                style={{ background: "linear-gradient(135deg,#dc2626,#f87171)", boxShadow: "0 4px 20px rgba(220,38,38,0.3)" }}
              >
                <Droplets size={16} />
                Request Blood Units
              </motion.button>
            )}

            {/* Not logged in prompt */}
            {!user && (
              <div className="border border-red-200 rounded-2xl p-5 bg-red-50 text-center">
                <Droplets size={22} className="text-red-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-base-content mb-3">
                  Login to request blood units
                </p>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#dc2626,#f87171)" }}
                >
                  Login / Sign up
                </Link>
              </div>
            )}

            {/* Tags */}
            {bank?.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {bank.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full text-xs font-medium bg-base-200 text-base-content/60 border border-base-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Request Modal */}
      {showModal && (
        <RequestModal
          bank={bank}
          prefill={modalPrefill}
          onClose={() => { setShowModal(false); setModalPrefill(null); }}
        />
      )}
    </div>
  );
}