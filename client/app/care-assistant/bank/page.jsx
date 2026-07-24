"use client";

/**
 * Bank Account Page — corrected with [data-theme="care-assistant"]
 * Route: app/care-assistant/bank/page.jsx
 */

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, CreditCard, Edit3, Eye, EyeOff, Save, Loader2,
  CheckCircle2, AlertCircle, Building2, Hash, User, Smartphone,
  ShieldCheck, Info, X, IndianRupee,
} from "lucide-react";
import {
  getBankDetails, updateBankDetails,
  selectBankDetails, selectLoading, selectErrors, clearError,
} from "@/store/slices/careAssistantSlice";
import BackButton from "../../../components/BackButton";

const POPULAR_BANKS = [
  "State Bank of India","HDFC Bank","ICICI Bank","Axis Bank",
  "Kotak Mahindra Bank","Punjab National Bank","Bank of Baroda",
  "Canara Bank","Union Bank of India","IndusInd Bank",
];

const FIELDS = [
  { key:"accountHolderName", label:"Account Holder Name", note:"Must exactly match the name in your bank records", placeholder:"e.g. Raju Kumar", type:"text", icon:<User size={15}/>, sensitive:false },
  { key:"bankName", label:"Bank Name", note:"Select from the list or type your bank name", placeholder:"e.g. State Bank of India", type:"text", icon:<Building2 size={15}/>, sensitive:false, hasSuggestions:true },
  { key:"accountNumber", label:"Account Number", note:"9–18 digit account number (hidden for security)", placeholder:"Enter account number", type:"password", icon:<Hash size={15}/>, sensitive:true },
  { key:"ifscCode", label:"IFSC Code", note:"11-character code on your cheque book (format: SBIN0001234)", placeholder:"e.g. SBIN0001234", type:"text", icon:<CreditCard size={15}/>, sensitive:false, transform:(v)=>v.toUpperCase() },
  { key:"upiId", label:"UPI ID (Optional)", note:"Your UPI handle for instant payouts (e.g. raju@upi)", placeholder:"yourname@upi", type:"text", icon:<Smartphone size={15}/>, sensitive:false },
];

const validate = (form) => {
  const e = {};
  if (form.accountNumber && (form.accountNumber.length < 9 || form.accountNumber.length > 18))
    e.accountNumber = "Account number must be 9–18 digits";
  if (form.ifscCode && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode))
    e.ifscCode = "Invalid IFSC. Format: SBIN0001234";
  return e;
};

const InfoRow = ({ label, value, masked, note }) => (
  <div
    className="flex items-start justify-between gap-4 py-3 border-b last:border-0"
    style={{ borderColor: "var(--base-300)" }}
  >
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content opacity-45"
       >
        {label}
      </p>
      {note && (
        <p className="text-[10px] mt-0.5 text-base-content opacity-35">
          {note}
        </p>
      )}
    </div>
    <p
      className="text-sm font-semibold text-right tracking-wider text-base-content"
      style={{ fontFamily: masked ? "monospace" : undefined, opacity: value ? 1 : 0.3 }}
    >
      {value || "—"}
    </p>
  </div>
);

export default function BankPage() {
  const dispatch    = useDispatch();
  const bankDetails = useSelector(selectBankDetails);
  const loading     = useSelector(selectLoading);
  const errors      = useSelector(selectErrors);

  const [editMode, setEditMode]             = useState(false);
  const [form, setForm]                     = useState({});
  const [fieldErrors, setFieldErrors]       = useState({});
  const [showAccount, setShowAccount]       = useState(false);
  const [bankSuggestions, setBankSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saved, setSaved]                   = useState(false);

  useEffect(() => { dispatch(getBankDetails()); }, [dispatch]);

  useEffect(() => {
    if (bankDetails && !editMode) {
      setForm({
        accountHolderName: bankDetails.accountHolderName ?? "",
        bankName:          bankDetails.bankName          ?? "",
        accountNumber:     "",
        ifscCode:          bankDetails.ifscCode          ?? "",
        upiId:             bankDetails.upiId             ?? "",
      });
    }
  }, [bankDetails, editMode]);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (fieldErrors[k]) setFieldErrors((p) => ({ ...p, [k]: "" }));
    if (k === "bankName") {
      const matches = POPULAR_BANKS.filter(
        (b) => b.toLowerCase().includes(v.toLowerCase()) && v.length > 1
      );
      setBankSuggestions(matches);
      setShowSuggestions(matches.length > 0 && v.length > 1);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    const payload = {};
    if (form.accountHolderName) payload.accountHolderName = form.accountHolderName.trim();
    if (form.bankName)          payload.bankName           = form.bankName.trim();
    if (form.accountNumber)     payload.accountNumber      = form.accountNumber;
    if (form.ifscCode)          payload.ifscCode           = form.ifscCode;
    if (form.upiId !== undefined) payload.upiId            = form.upiId.trim();
    const res = await dispatch(updateBankDetails(payload));
    if (!res.error) {
      setEditMode(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      dispatch(getBankDetails());
    }
  };

  const isLoading = loading.bank;

  return (
    <div data-theme="care-assistant" className="min-h-screen bg-base-100">

      {/* ── sticky header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-5 pb-4 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[14px] border-b border-base-300"
       
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                     <BackButton className='my-3' />
          
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5 text-accent"
               >
                Payout Setup
              </p>
              <h1 className="!text-xl !font-black !leading-tight text-base-content"
               >
                Bank Account
              </h1>
              <p className="text-xs mt-0.5 text-base-content opacity-50">
                Earnings are transferred to this account every week
              </p>
            </div>
            <div className="shrink-0 mt-1">
              {bankDetails?.isBankVerified ? (
                <span className="badge badge-success flex items-center gap-1">
                  <ShieldCheck size={12} /> Verified
                </span>
              ) : (
                <span className="badge badge-warning flex items-center gap-1">
                  <AlertCircle size={12} /> Unverified
                </span>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <div className="px-4 py-5 pb-28 space-y-4">

        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="alert alert-success"
            >
              <CheckCircle2 size={16} />
              <p className="text-sm font-semibold">Bank details updated successfully!</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {errors.bank && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="alert alert-error"
            >
              <AlertCircle size={16} />
              <p className="text-sm flex-1">{errors.bank}</p>
              <button onClick={() => dispatch(clearError("bank"))}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="glass-card p-4">
          <div className="flex items-start gap-2.5">
            <IndianRupee size={15} className="shrink-0 mt-0.5 text-success" />
            <p className="text-xs text-base-content opacity-70">
              Payouts are processed every Friday. Admin verifies your bank details before the first
              transfer. Keep your account number and IFSC code accurate.
            </p>
          </div>
        </div>

        {isLoading && !bankDetails ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-12 w-full rounded-2xl" />
            ))}
          </div>
        ) : !editMode ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-2xl flex items-center justify-center bg-[color-mix(in srgb, var(--primary), transparent 85%)]"
                 
                >
                  <Banknote size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-base-content">
                    {bankDetails?.bankName || "Bank Details"}
                  </p>
                  <p className="text-[11px] text-base-content opacity-45">
                    {bankDetails?.isBankVerified ? "Admin verified account" : "Pending admin verification"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all bg-[color-mix(in srgb, var(--primary), transparent 88%)] text-primary"
               
              >
                <Edit3 size={13} /> Edit
              </button>
            </div>

            <InfoRow label="Account Holder" note="Name as in bank records"    value={bankDetails?.accountHolderName} />
            <InfoRow label="Account Number" note="Last 4 digits shown"        value={bankDetails?.accountLast4 ? `•••• •••• ${bankDetails.accountLast4}` : null} masked />
            <InfoRow label="IFSC Code"      note="Bank branch identifier"     value={bankDetails?.ifscCode} />
            <InfoRow label="UPI ID"         note="Optional — for instant payouts" value={bankDetails?.upiId} />

            {!bankDetails?.accountHolderName && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 rounded-2xl p-4 flex flex-col items-center gap-3 bg-base-200"
               
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[color-mix(in srgb, var(--primary), transparent 85%)]"
                 
                >
                  <Banknote size={22} className="text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-base-content">
                    No bank account added
                  </p>
                  <p className="text-xs mt-0.5 text-base-content opacity-50">
                    Add your bank details to receive weekly payouts
                  </p>
                </div>
                <button onClick={() => setEditMode(true)} className="btn-primary-cta !text-xs !py-2.5">
                  + Add Bank Account
                </button>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.form
            key="edit-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSave}
            className="space-y-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-base-content">
                {bankDetails?.accountHolderName ? "Update Bank Details" : "Add Bank Account"}
              </p>
              <button
                type="button"
                onClick={() => { setEditMode(false); setFieldErrors({}); }}
                className="flex items-center gap-1 text-xs font-semibold text-base-content opacity-50"
               
              >
                <X size={13} /> Cancel
              </button>
            </div>

            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label
                  className="text-xs font-semibold flex items-center gap-1.5 text-base-content"
                 
                >
                  <span className="text-primary opacity-70">{f.icon}</span>
                  {f.label}
                </label>
                <p className="text-[11px] text-base-content opacity-48">
                  {f.note}
                </p>

                {f.hasSuggestions ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={form[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      className={`input-field w-full ${fieldErrors[f.key] ? "!border-[var(--error)]" : ""}`}
                    />
                    <AnimatePresence>
                      {showSuggestions && f.key === "bankName" && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="absolute z-30 left-0 right-0 mt-1 rounded-2xl overflow-hidden shadow-lg bg-base-200 border border-base-300"
                         
                        >
                          {bankSuggestions.map((b) => (
                            <button
                              key={b}
                              type="button"
                              onMouseDown={() => { set("bankName", b); setShowSuggestions(false); }}
                              className="w-full text-left px-4 py-2.5 text-xs font-medium transition-colors hover:bg-[var(--base-300)] text-base-content"
                             
                            >
                              {b}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : f.sensitive ? (
                  <div className="relative">
                    <input
                      type={showAccount ? "text" : "password"}
                      value={form[f.key] ?? ""}
                      onChange={(e) => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      className={`input-field w-full pr-10 tracking-widest ${fieldErrors[f.key] ? "!border-[var(--error)]" : ""}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccount((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content opacity-40"
                     
                    >
                      {showAccount ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                ) : (
                  <input
                    type={f.type}
                    value={f.transform ? f.transform(form[f.key] ?? "") : (form[f.key] ?? "")}
                    onChange={(e) =>
                      set(f.key, f.transform ? f.transform(e.target.value) : e.target.value)
                    }
                    placeholder={f.placeholder}
                    className={`input-field w-full ${fieldErrors[f.key] ? "!border-[var(--error)]" : ""}`}
                  />
                )}

                {fieldErrors[f.key] && (
                  <p className="text-[11px] flex items-center gap-1 text-error">
                    <X size={11} /> {fieldErrors[f.key]}
                  </p>
                )}
              </div>
            ))}

            {bankDetails?.isBankVerified && (
              <div className="alert alert-warning">
                <AlertCircle size={14} />
                <p className="text-xs">
                  Updating account number will reset bank verification status. Admin will re-verify
                  before the next payout.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setEditMode(false); setFieldErrors({}); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary-cta flex-1 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {isLoading ? "Saving…" : "Save Details"}
              </button>
            </div>
          </motion.form>
        )}

        <div
          className="rounded-2xl p-4 flex items-start gap-3 bg-[color-mix(in srgb, var(--success), transparent 92%)] border border-[color-mix(in srgb, var(--success), transparent 75%)]"
         
        >
          <ShieldCheck size={16} className="shrink-0 mt-0.5 text-success" />
          <div>
            <p className="text-xs font-bold text-success">Bank-grade security</p>
            <p className="text-[11px] mt-0.5 text-base-content opacity-60">
              Account numbers are encrypted at rest. Only the last 4 digits are visible to you and
              our team. Payouts require admin-verified details.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}