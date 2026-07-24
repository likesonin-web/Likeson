"use client";

/**
 * Account Security Page
 * Route: app/care-assistant/security/[[...section]]/page.jsx
 * Handles:
 *   /care-assistant/security/change-password  → Change Password
 *   /care-assistant/security/sessions         → Active Sessions
 *   /care-assistant/security/verify-email     → Email Verification
 *   /care-assistant/security/delete-account   → Delete Account
 * Redux: changePassword, getSessions, revokeSession, revokeAllSessions,
 *        sendEmailOtp, verifyEmailOtp, requestAccountDeletion,
 *        confirmAccountDeletion (careAssistantSlice)
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  KeyRound,
  History,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  X,
  LogOut,
  Smartphone,
  Monitor,
  Globe,
  Clock,
  Trash2,
  Mail,
  Send,
  RefreshCw,
  Lock,
  Shield,
  AlertTriangle,
  ChevronRight,
  Info,
  MapPin,
  CircleDot,
} from "lucide-react";
import {
  changePassword,
  getSessions,
  revokeSession,
  revokeAllSessions,
  sendEmailOtp,
  verifyEmailOtp,
  requestAccountDeletion,
  confirmAccountDeletion,
  selectSessions,
  selectLastLoginAt,
  selectLastLoginIp,
  selectLoginCount,
  selectProfile,
  selectLoading,
  selectErrors,
  clearError,
  getProfile,
  resetCareAssistant,
} from "@/store/slices/careAssistantSlice";
import BackButton from "../../../../components/BackButton";

// ─── nav links ────────────────────────────────────────────────────────────
const links = [
  {
    name: "Change Password",
    href: "/care-assistant/security/change-password",
    segments: ["change-password"],
    icon: <KeyRound size={16} />,
    note: "Update your login password — use a strong, unique password",
  },
  {
    name: "Active Sessions",
    href: "/care-assistant/security/sessions",
    segments: ["sessions"],
    icon: <History size={16} />,
    note: "Review and revoke any suspicious active login sessions",
  },
  {
    name: "Email Verify",
    href: "/care-assistant/security/verify-email",
    segments: ["verify-email"],
    icon: <ShieldCheck size={16} />,
    note: "Verify your email address with a one-time code",
  },
  {
    name: "Delete Account",
    href: "/care-assistant/security/delete-account",
    segments: ["delete-account"],
    icon: <AlertCircle size={16} />,
    note: "Permanently close your care assistant account",
  },
];

const matchSection = (params) => {
  const seg = params?.section ?? [];
  if (!seg || seg.length === 0) return "change-password";
  return seg[0] ?? "change-password";
};

const formatDateTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

// ─── password strength helper ─────────────────────────────────────────────
const getStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score;
};

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
const strengthColor = ["", "var(--error)", "var(--warning)", "var(--accent)", "var(--success)", "var(--success)"];

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────
function ChangePasswordSection({ dispatch, loading, errors }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (fieldErrors[k]) setFieldErrors((p) => ({ ...p, [k]: "" }));
  };
  const toggleShow = (k) => setShow((p) => ({ ...p, [k]: !p[k] }));

  const validate = () => {
    const e = {};
    if (!form.currentPassword) e.currentPassword = "Current password is required";
    if (!form.newPassword) e.newPassword = "New password is required";
    else if (form.newPassword.length < 8) e.newPassword = "Must be at least 8 characters";
    if (!form.confirmNewPassword) e.confirmNewPassword = "Please confirm your new password";
    else if (form.newPassword !== form.confirmNewPassword) e.confirmNewPassword = "Passwords do not match";
    if (form.currentPassword && form.newPassword && form.currentPassword === form.newPassword)
      e.newPassword = "New password must differ from current password";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    const res = await dispatch(changePassword(form));
    if (!res.error) {
      setForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    }
  };

  const strength = getStrength(form.newPassword);

  const pwFields = [
    { key: "currentPassword", label: "Current Password", note: "Your existing login password", showKey: "current" },
    { key: "newPassword", label: "New Password", note: "Min 8 characters. Mix uppercase, numbers & symbols for strength", showKey: "new" },
    { key: "confirmNewPassword", label: "Confirm New Password", note: "Re-enter the new password to confirm", showKey: "confirm" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <AnimatePresence>
        {success && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="alert alert-success">
            <CheckCircle2 size={16} />
            <p className="text-sm font-semibold">Password changed! A confirmation email has been sent.</p>
          </motion.div>
        )}
        {errors.security && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="alert alert-error">
            <AlertCircle size={15} />
            <p className="text-xs flex-1">{errors.security}</p>
            <button onClick={() => dispatch(clearError("security"))}><X size={13} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass-card p-4">
        <div className="flex items-start gap-2">
          <Lock size={14} className="shrink-0 mt-0.5 text-primary" />
          <p className="text-xs text-base-content opacity-65">
            Use a password you don't use anywhere else. Avoid using your name, phone number, or
            common words. Changing your password will sign you out of all other devices.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {pwFields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <label className="text-xs font-semibold flex items-center gap-1.5 text-base-content">
              <KeyRound size={12} className="text-primary" />
              {f.label}
            </label>
            <p className="text-[11px] text-base-content opacity-45">
              {f.note}
            </p>
            <div className="relative">
              <input
                type={show[f.showKey] ? "text" : "password"}
                value={form[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder="••••••••"
                className={`input-field w-full pr-10 tracking-widest ${fieldErrors[f.key] ? "!border-[var(--error)]" : ""}`}
              />
              <button
                type="button"
                onClick={() => toggleShow(f.showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content opacity-40"
               
              >
                {show[f.showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors[f.key] && (
              <p className="text-[11px] flex items-center gap-1 text-error">
                <X size={11} /> {fieldErrors[f.key]}
              </p>
            )}

            {/* strength bar for new password */}
            {f.key === "newPassword" && form.newPassword.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div
                      key={s}
                      className="flex-1 h-1.5 rounded-full transition-all duration-300"
                      style={{ background: s <= strength ? strengthColor[strength] : "var(--base-300)" }}
                    />
                  ))}
                </div>
                <p className="text-[11px] font-semibold" style={{ color: strengthColor[strength] }}>
                  {strengthLabel[strength]}
                </p>
              </div>
            )}
          </div>
        ))}

        <button
          type="submit"
          disabled={loading.security}
          className="btn-primary-cta w-full flex items-center justify-center gap-2"
        >
          {loading.security ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {loading.security ? "Updating Password…" : "Change Password"}
        </button>
      </form>
    </motion.div>
  );
}

// ─── ACTIVE SESSIONS ──────────────────────────────────────────────────────
const platformIcon = (p) => {
  if (p === "ios" || p === "android") return <Smartphone size={16} />;
  if (p === "desktop") return <Monitor size={16} />;
  return <Globe size={16} />;
};

function SessionsSection({ sessions, lastLoginAt, lastLoginIp, loginCount, dispatch, loading }) {
  const [revokeAllConfirm, setRevokeAllConfirm] = useState(false);

  useEffect(() => {
    dispatch(getSessions());
  }, [dispatch]);

  const handleRevokeAll = async () => {
    const res = await dispatch(revokeAllSessions());
    if (!res.error) { setRevokeAllConfirm(false); dispatch(getSessions()); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* login stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Logins", value: loginCount ?? 0, icon: <History size={16} />, color: "var(--primary)" },
          { label: "Last Login", value: lastLoginAt ? new Date(lastLoginAt).toLocaleDateString("en-IN") : "—", icon: <Clock size={16} />, color: "var(--info)" },
        ].map((stat) => (
          <div key={stat.label} className="card p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${stat.color}, transparent 85%)`, color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <p className="text-xs font-bold text-base-content">{stat.value}</p>
              <p className="text-[10px] text-base-content opacity-45">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {lastLoginIp && (
        <div className="flex items-center gap-2 px-1">
          <MapPin size={12} className="text-base-content opacity-40" />
          <p className="text-[11px] text-base-content opacity-45">
            Last login IP: <span className="font-mono font-semibold">{lastLoginIp}</span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-base-content">
          {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => dispatch(getSessions())}
            className="flex items-center gap-1 text-xs font-semibold text-primary"
           
          >
            <RefreshCw size={12} /> Refresh
          </button>
          {sessions.length > 1 && (
            <button
              onClick={() => setRevokeAllConfirm(true)}
              className="flex items-center gap-1 text-xs font-semibold text-error"
             
            >
              <LogOut size={12} /> Revoke All
            </button>
          )}
        </div>
      </div>

      {/* sessions list */}
      {loading.security && sessions.length === 0 ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <div className="card p-6 flex flex-col items-center gap-3">
          <History size={28} className="text-base-content opacity-20" />
          <p className="text-xs text-center text-base-content opacity-50">No active sessions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((s, i) => (
            <motion.div
              key={s._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="card p-4 flex items-start gap-3"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: i === 0 ? "color-mix(in srgb, var(--success), transparent 85%)" : "color-mix(in srgb, var(--info), transparent 85%)", color: i === 0 ? "var(--success)" : "var(--info)" }}
              >
                {platformIcon(s.platform)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold truncate text-base-content">
                    {s.deviceName || "Unknown Device"}
                  </p>
                  {i === 0 && (
                    <span className="badge badge-success !py-0 !px-1.5 !text-[10px] shrink-0">Current</span>
                  )}
                </div>
                <p className="text-[11px] mt-0.5 capitalize text-base-content opacity-50">
                  {s.platform} · {s.ipAddress}
                </p>
                <p className="text-[10px] mt-1 text-base-content opacity-35">
                  Active: {formatDateTime(s.lastActiveAt)}
                </p>
                <p className="text-[10px] text-base-content opacity-30">
                  Signed in: {formatDateTime(s.createdAt)}
                </p>
              </div>
              {i !== 0 && (
                <button
                  onClick={() => dispatch(revokeSession(s._id))}
                  disabled={loading.security}
                  className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center bg-[color-mix(in srgb, var(--error), transparent 88%)] text-error"
                 
                >
                  {loading.security ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* revoke all confirmation */}
      <AnimatePresence>
        {revokeAllConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-[4px]"
           
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              className="card w-full max-w-sm p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[color-mix(in srgb, var(--warning), transparent 85%)] text-warning">
                  <LogOut size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-base-content">Revoke All Sessions?</p>
                  <p className="text-xs mt-0.5 text-base-content opacity-55">
                    All other devices will be signed out immediately
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRevokeAllConfirm(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleRevokeAll} disabled={loading.security} className="btn-primary-cta flex-1 flex items-center justify-center gap-2 !bg-[var(--error)]">
                  {loading.security ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
                  Sign Out All
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── EMAIL VERIFICATION ───────────────────────────────────────────────────
function EmailVerifySection({ profile, dispatch, loading, errors }) {
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const isEmailVerified = profile?.user?.isEmailVerified ?? false;

  const handleSendOtp = async () => {
    const res = await dispatch(sendEmailOtp());
    if (!res.error) {
      setOtpSent(true);
      setCountdown(60);
      const timer = setInterval(() => setCountdown((p) => { if (p <= 1) { clearInterval(timer); return 0; } return p - 1; }), 1000);
    }
  };

  const handleOtpChange = (i, v) => {
    if (!/^[0-9]?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      document.getElementById(`otp-${i - 1}`)?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otp.join("");
    if (code.length !== 6) return;
    const res = await dispatch(verifyEmailOtp({ otp: code }));
    if (!res.error) {
      setVerified(true);
      dispatch(getProfile());
    }
  };

  const otpComplete = otp.join("").length === 6;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {isEmailVerified || verified ? (
        <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="card p-6 flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-[color-mix(in srgb, var(--success), transparent 82%)]">
            <CheckCircle2 size={32} className="text-success" />
          </div>
          <div className="text-center">
            <p className="text-base font-black text-base-content">Email Verified</p>
            <p className="text-xs mt-1 text-base-content opacity-55">
              Your email address is verified and secure
            </p>
          </div>
          <span className="badge badge-success">
            <ShieldCheck size={12} /> Verified
          </span>
        </motion.div>
      ) : (
        <>
          <div className="card p-5 flex items-start gap-3">
            <Mail size={20} className="shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-base-content">
                {profile?.email ?? "your email"}
              </p>
              <p className="text-xs mt-0.5 text-warning">Not yet verified</p>
              <p className="text-[11px] mt-1 text-base-content opacity-50">
                Verify your email to receive booking confirmations, KYC updates and security alerts
              </p>
            </div>
          </div>

          <AnimatePresence>
            {errors.security && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="alert alert-error">
                <AlertCircle size={14} />
                <p className="text-xs flex-1">{errors.security}</p>
                <button onClick={() => dispatch(clearError("security"))}><X size={12} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          {!otpSent ? (
            <div className="space-y-3">
              <div className="glass-card p-4">
                <div className="flex items-start gap-2">
                  <Info size={13} className="shrink-0 mt-0.5 text-info" />
                  <p className="text-xs text-base-content opacity-65">
                    A 6-digit verification code will be sent to your registered email. The code
                    expires in 10 minutes.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSendOtp}
                disabled={loading.security}
                className="btn-primary-cta w-full flex items-center justify-center gap-2"
              >
                {loading.security ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {loading.security ? "Sending…" : "Send Verification Code"}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold mb-1 text-base-content">
                  Enter 6-digit code
                </p>
                <p className="text-[11px] mb-4 text-base-content opacity-50">
                  Check your email inbox. The code expires in 10 minutes.
                </p>
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="w-11 h-13 text-center text-lg font-black rounded-xl border-2 outline-none transition-all bg-base-200 text-base-content h-[52px]"
                      style={{ borderColor: digit ? "var(--primary)" : "var(--base-300)" }}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleVerify}
                disabled={!otpComplete || loading.security}
                className="btn-primary-cta w-full flex items-center justify-center gap-2"
                style={{ opacity: otpComplete ? 1 : 0.5 }}
              >
                {loading.security ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {loading.security ? "Verifying…" : "Verify Code"}
              </button>

              <div className="flex items-center justify-between">
                <p className="text-xs text-base-content opacity-50">
                  Didn't receive it?
                </p>
                <button
                  onClick={countdown === 0 ? handleSendOtp : undefined}
                  disabled={countdown > 0 || loading.security}
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: countdown > 0 ? "var(--base-content)" : "var(--primary)", opacity: countdown > 0 ? 0.4 : 1 }}
                >
                  <RefreshCw size={11} />
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

// ─── DELETE ACCOUNT ───────────────────────────────────────────────────────
function DeleteAccountSection({ dispatch, loading, errors }) {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: warning, 2: otp sent, 3: confirm otp
  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");

  const REASONS = [
    "I no longer need this account",
    "I found a better platform",
    "Privacy concerns",
    "Too many issues with the platform",
    "I'm taking a break from caregiving",
    "Other",
  ];

  const handleRequestDeletion = async () => {
    const res = await dispatch(requestAccountDeletion());
    if (!res.error) setStep(2);
  };

  const handleOtpChange = (i, v) => {
    if (!/^[0-9]?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) document.getElementById(`del-otp-${i + 1}`)?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === "Backspace" && !otp[i] && i > 0)
      document.getElementById(`del-otp-${i - 1}`)?.focus();
  };

  const handleConfirmDelete = async () => {
    const code = otp.join("");
    if (code.length !== 6) { setOtpError("Enter the full 6-digit code"); return; }
    const res = await dispatch(confirmAccountDeletion({ otp: code, reason }));
    if (!res.error) {
      dispatch(resetCareAssistant());
      router.push("/");
    }
  };

  const otpComplete = otp.join("").length === 6;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* STEP 1 — warning */}
      {step === 1 && (
        <>
          {/* danger header */}
          <div
            className="rounded-2xl p-5 flex flex-col items-center gap-3 text-center bg-[color-mix(in srgb, var(--error), transparent 90%)] border border-[color-mix(in srgb, var(--error), transparent 70%)]"
           
          >
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[color-mix(in srgb, var(--error), transparent 80%)]">
              <AlertTriangle size={28} className="text-error" />
            </div>
            <div>
              <p className="text-sm font-black text-error">Permanent Action</p>
              <p className="text-xs mt-1 text-base-content opacity-65">
                Deleting your account is irreversible. Your profile, KYC data and payout history
                will be deactivated. Existing booking records are retained for legal compliance.
              </p>
            </div>
          </div>

          {/* consequences */}
          <div className="card p-4 space-y-2">
            <p className="text-xs font-bold mb-2 text-base-content">What happens when you delete:</p>
            {[
              "Your profile is immediately deactivated",
              "You cannot log in or accept new bookings",
              "Active tasks must be completed first",
              "Pending payouts will be processed normally",
              "KYC documents are retained for 90 days (legal requirement)",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <X size={12} className="shrink-0 mt-0.5 text-error" />
                <p className="text-xs text-base-content opacity-65">{item}</p>
              </div>
            ))}
          </div>

          {/* reason */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-base-content">
              Reason for leaving (optional)
            </label>
            <p className="text-[11px] text-base-content opacity-45">
              Your feedback helps us improve. This is entirely optional.
            </p>
            <div className="grid gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r === reason ? "" : r)}
                  className="text-left px-3 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center gap-2"
                  style={{
                    background: reason === r ? "color-mix(in srgb, var(--error), transparent 88%)" : "var(--base-200)",
                    color: reason === r ? "var(--error)" : "var(--base-content)",
                    border: `1px solid ${reason === r ? "var(--error)" : "transparent"}`,
                  }}
                >
                  <CircleDot size={12} style={{ opacity: reason === r ? 1 : 0.3 }} />
                  {r}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {errors.security && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="alert alert-error">
                <AlertCircle size={14} />
                <p className="text-xs flex-1">{errors.security}</p>
                <button onClick={() => dispatch(clearError("security"))}><X size={12} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleRequestDeletion}
            disabled={loading.security}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all bg-error text-error-content"
           
          >
            {loading.security ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {loading.security ? "Sending code…" : "Send Deletion Confirmation Code"}
          </button>
        </>
      )}

      {/* STEP 2 — OTP sent confirmation */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
          <div className="card p-5 flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[color-mix(in srgb, var(--warning), transparent 85%)]">
              <Mail size={26} className="text-warning" />
            </div>
            <div>
              <p className="text-sm font-black text-base-content">Check Your Email</p>
              <p className="text-xs mt-1 text-base-content opacity-55">
                A 6-digit confirmation code was sent to your registered email. It expires in 15 minutes.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-center text-base-content">
              Enter confirmation code
            </p>
            <div className="flex gap-2 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`del-otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-11 text-center text-lg font-black rounded-xl border-2 outline-none transition-all bg-base-200 text-base-content h-[52px]"
                  style={{ borderColor: digit ? "var(--error)" : "var(--base-300)" }}
                />
              ))}
            </div>
            {otpError && (
              <p className="text-[11px] text-center flex items-center justify-center gap-1 text-error">
                <X size={11} /> {otpError}
              </p>
            )}
          </div>

          <AnimatePresence>
            {errors.security && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="alert alert-error">
                <AlertCircle size={14} />
                <p className="text-xs flex-1">{errors.security}</p>
                <button onClick={() => dispatch(clearError("security"))}><X size={12} /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <button onClick={() => { setStep(1); setOtp(["", "", "", "", "", ""]); }} className="btn-secondary flex-1">
              Go Back
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={!otpComplete || loading.security}
              className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              style={{ background: otpComplete ? "var(--error)" : "var(--base-300)", color: otpComplete ? "var(--error-content)" : "var(--base-content)", opacity: otpComplete ? 1 : 0.5 }}
            >
              {loading.security ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {loading.security ? "Deleting…" : "Confirm Delete"}
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────
export default function SecurityPage() {
  const params = useParams();
  const dispatch = useDispatch();
  const sessions = useSelector(selectSessions);
  const lastLoginAt = useSelector(selectLastLoginAt);
  const lastLoginIp = useSelector(selectLastLoginIp);
  const loginCount = useSelector(selectLoginCount);
  const profile = useSelector(selectProfile);
  const loading = useSelector(selectLoading);
  const errors = useSelector(selectErrors);

  const section = matchSection(params);

  useEffect(() => {
    if (!profile) dispatch(getProfile());
  }, [dispatch, profile]);

  const sectionTitle = {
    "change-password": "Change Password",
    sessions: "Active Sessions",
    "verify-email": "Email Verification",
    "delete-account": "Delete Account",
  }[section] ?? "Security";

  const sectionSubtitle = {
    "change-password": "Keep your account secure with a strong, unique password",
    sessions: "See everywhere you're currently signed in",
    "verify-email": "Verify your email address to receive important notifications",
    "delete-account": "Permanently deactivate your care assistant account",
  }[section] ?? "";

  const sectionColor = {
    "change-password": "var(--primary)",
    sessions: "var(--info)",
    "verify-email": "var(--success)",
    "delete-account": "var(--error)",
  }[section] ?? "var(--primary)";

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── sticky header ── */}
      <div
        className="sticky top-0 z-20 px-4 pt-5 pb-3 bg-[color-mix(in srgb, var(--base-100) 92%, transparent)] backdrop-blur-[14px] border-b border-base-300"
       
      >
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                     <BackButton className='my-3' />
          
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5" style={{ color: sectionColor }}>
            Account Security
          </p>
          <h1 className="!text-xl !font-black !leading-tight text-base-content">
            {sectionTitle}
          </h1>
          <p className="text-xs mt-0.5 text-base-content opacity-50">
            {sectionSubtitle}
          </p>
        </motion.div>
      </div>

      {/* ── nav pills ── */}
      <div className="px-4 pt-4 pb-1 flex gap-2 overflow-x-auto no-scrollbar">
        {links.map((l) => {
          const isActive = section === l.segments[0];
          const isDanger = l.segments[0] === "delete-account";
          const activeColor = isDanger ? "var(--error)" : sectionColor;
          return (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all"
              style={{
                background: isActive ? activeColor : `color-mix(in srgb, ${activeColor}, transparent 88%)`,
                color: isActive ? "white" : activeColor,
              }}
            >
              {l.icon}
              {l.name}
            </Link>
          );
        })}
      </div>

      {/* ── active note ── */}
      <div className="px-4 mt-3">
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
          style={{ background: `color-mix(in srgb, ${sectionColor}, transparent 90%)` }}
        >
          <Shield size={12} style={{ color: sectionColor }} />
          <p className="text-[11px]" style={{ color: sectionColor }}>
            {links.find((l) => l.segments[0] === section)?.note}
          </p>
        </div>
      </div>

      {/* ── content ── */}
      <div className="px-4 py-5 pb-24">
        <AnimatePresence mode="wait">
          {section === "change-password" && (
            <ChangePasswordSection key="pw" dispatch={dispatch} loading={loading} errors={errors} />
          )}
          {section === "sessions" && (
            <SessionsSection
              key="sessions"
              sessions={sessions}
              lastLoginAt={lastLoginAt}
              lastLoginIp={lastLoginIp}
              loginCount={loginCount}
              dispatch={dispatch}
              loading={loading}
            />
          )}
          {section === "verify-email" && (
            <EmailVerifySection key="email" profile={profile} dispatch={dispatch} loading={loading} errors={errors} />
          )}
          {section === "delete-account" && (
            <DeleteAccountSection key="delete" dispatch={dispatch} loading={loading} errors={errors} />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}