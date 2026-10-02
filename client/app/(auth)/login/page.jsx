'use client';

 
 
import React, {
  useState,
  useCallback,
  useEffect,
  memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter }                from 'next/navigation';
import { motion, AnimatePresence }  from 'framer-motion';
import Link                         from 'next/link';
import toast                        from 'react-hot-toast';
import {
  Mail,
  Lock,
  Phone,
  User,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  Heart,
  Fingerprint,
  KeyRound,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';

import {
  login,
  otpLogin,
  requestOtpLogin,   // ← FIX: was requestOtp (which is email-verification-only)
  loginWithGoogle,
  forgotPassword,
  resetPassword,
  clearError,        // ← FIX: was clearErrors (singular in v2 slice)
  patchUser,         // ← NEW: patch isOnline locally after login
} from '@/store/slices/userSlice';
 



// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════════

const PANEL_VARIANTS = {
  enter:  { opacity: 0, x: 24 },
  center: { opacity: 1, x: 0  },
  exit:   { opacity: 0, x: -24 },
};

const FADE_SCALE = {
  enter:  { opacity: 0, scale: 0.97 },
  center: { opacity: 1, scale: 1    },
  exit:   { opacity: 0, scale: 0.97 },
};

const ERROR_VARIANTS = {
  enter:  { opacity: 0, height: 0      },
  center: { opacity: 1, height: 'auto' },
  exit:   { opacity: 0, height: 0      },
};

// ═══════════════════════════════════════════════════════════════════════════════
// IDENTIFIER HINT
// ═══════════════════════════════════════════════════════════════════════════════

const getIdentifierMeta = (value = '') => {
  const t = value.trim();
  if (/^\+?\d{7,}/.test(t))  return { icon: Phone, placeholder: 'Phone number'            };
  if (t.includes('@'))        return { icon: Mail,  placeholder: 'Email address'           };
  if (t.length > 0)           return { icon: User,  placeholder: 'Full name'               };
  return                             { icon: Mail,  placeholder: 'Email, phone, or name'   };
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const ErrorBanner = memo(function ErrorBanner({ message }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="error-banner"
          variants={ERROR_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="mb-6 overflow-hidden"
          role="alert"
          aria-live="assertive"
        >
          <div className="p-4 bg-error/10 border border-error/20 rounded-2xl flex items-center gap-3 text-error text-[11px] font-poppins font-bold">
            <ShieldAlert size={18} aria-hidden="true" />
            <span>{message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

const AuthTabBar = memo(function AuthTabBar({ authMode, onSelect }) {
  return (
    <div
      role="tablist"
      aria-label="Authentication method"
      className="flex bg-base-200 rounded-2xl p-1 mb-8 border border-base-300"
    >
      {[
        { id: 'password', label: 'Password'  },
        { id: 'otp',      label: 'Quick OTP' },
      ].map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={authMode === tab.id}
          onClick={() => onSelect(tab.id)}
          className={`flex-1 py-3 text-xs font-poppins font-black uppercase tracking-widest rounded-xl transition-all duration-200 ${
            authMode === tab.id
              ? 'bg-base-100 text-primary shadow-lg'
              : 'text-base-content/40 hover:text-base-content/70'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
});

const GoogleLoginButton = memo(function GoogleLoginButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Sign in with Google"
      className="w-full  btn btn-ghost py-3  border-2 border-base-300 rounded-md flex items-center justify-center gap-4 text-xs font-poppins font-black uppercase tracking-widest  transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://img.icons8.com/color/1200/google-logo.jpg"
        className="w-5 h-5"
        alt=""
        aria-hidden="true"
        width={20}
        height={20}
      />
      Continue with Google
    </button>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// PASSWORD FORM
// ═══════════════════════════════════════════════════════════════════════════════

const PasswordForm = memo(function PasswordForm({
  formData,
  onChange,
  onSubmit,
  onForgot,
  loading,
}) {
  const [showPassword, setShowPassword] = useState(false);
  const { icon: IdentIcon, placeholder } = getIdentifierMeta(formData.identifier);

  return (
    <motion.form
      key="password-form"
      variants={PANEL_VARIANTS}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onSubmit={onSubmit}
      className="space-y-5"
      noValidate
    >
      {/* Identifier — email | phone | name */}
      <div className="space-y-1">
        <label
          htmlFor="identifier-pw"
          className="block text-[10px] font-poppins font-black uppercase tracking-widest text-base-content/40 ml-1"
        >
          Email, Phone, or Name
        </label>
        <div className="relative group">
          <IdentIcon
            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 group-focus-within:text-primary transition-colors"
            size={18}
            aria-hidden="true"
          />
          <input
            id="identifier-pw"
            name="identifier"
            type="text"
            required
            autoComplete="username"
            value={formData.identifier}
            onChange={onChange}
            placeholder={placeholder}
            aria-label="Email, phone number, or full name"
            className="input-field input w-full pl-12 h-12 font-poppins font-bold border-2"
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-1">
        <div className="flex justify-between items-center ml-1">
          <label
            htmlFor="password-pw"
            className="text-[10px] font-poppins font-black uppercase tracking-widest text-base-content/40"
          >
            Password
          </label>
          <button
            type="button"
            onClick={onForgot}
            className="text-[10px] font-poppins font-black text-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative group">
          <KeyRound
            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 group-focus-within:text-primary transition-colors"
            size={18}
            aria-hidden="true"
          />
          <input
            id="password-pw"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            value={formData.password}
            onChange={onChange}
            placeholder="••••••••"
            aria-label="Password"
            className="input-field w-full pl-12 pr-12 h-12 font-poppins font-bold border-2"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content transition-colors"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="btn-primary-cta btn w-full   rounded-md text-xs font-poppins font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
      >
        {loading
          ? <Loader2 className="animate-spin" size={20} aria-label="Signing in…" />
          : <> Sign In <ChevronRight size={18} aria-hidden="true" /> </>}
      </button>
    </motion.form>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// OTP FORM
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FIX: onSendOtp dispatches requestOtpLogin(identifier) — NOT requestOtp(email).
 *      requestOtp is for email-verification only (used in SignUp step 2).
 *      requestOtpLogin is the correct passwordless-login OTP trigger.
 */
const OtpForm = memo(function OtpForm({
  formData,
  onChange,
  onSubmit,
  onSendOtp,
  loadingSend,
  loadingVerify,
}) {
  const { icon: IdentIcon, placeholder } = getIdentifierMeta(formData.identifier);

  return (
    <motion.form
      key="otp-form"
      variants={PANEL_VARIANTS}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.22, ease: 'easeOut' }}
      onSubmit={onSubmit}
      className="space-y-5"
      noValidate
    >
      {/* Identifier + Send Code */}
      <div className="space-y-1">
        <label
          htmlFor="identifier-otp"
          className="block text-[10px] font-poppins font-black uppercase tracking-widest text-base-content/40 ml-1"
        >
          Email, Phone, or Name
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <IdentIcon
              className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
              size={18}
              aria-hidden="true"
            />
            <input
              id="identifier-otp"
              name="identifier"
              type="text"
              required
              autoComplete="username"
              value={formData.identifier}
              onChange={onChange}
              placeholder={placeholder}
              aria-label="Email, phone number, or full name"
              className="input-field w-full pl-12 h-12 font-poppins font-bold"
            />
          </div>
          <button
            type="button"
            onClick={onSendOtp}
            disabled={loadingSend}
            aria-busy={loadingSend}
            className="px-5 rounded-2xl border-2 border-primary text-[10px] font-poppins font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-white transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingSend ? <Loader2 className="animate-spin" size={14} /> : 'Send Code'}
          </button>
        </div>
      </div>

      {/* OTP Input */}
      <div className="space-y-1">
        <label
          htmlFor="otp-code"
          className="block text-[10px] font-poppins font-black uppercase tracking-widest text-base-content/40 ml-1"
        >
          6-Digit Code
        </label>
        <div className="relative group">
          <Fingerprint
            className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20"
            size={18}
            aria-hidden="true"
          />
          <input
            id="otp-code"
            name="otp"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            autoComplete="one-time-code"
            value={formData.otp}
            onChange={onChange}
            placeholder="0 0 0 0 0 0"
            aria-label="One-time passcode"
            className="input-field w-full pl-12 h-12 text-center text-2xl font-poppins font-black tracking-[0.5em]"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loadingVerify}
        aria-busy={loadingVerify}
        className="btn-primary-cta w-full h-16 rounded-2xl text-xs font-poppins font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loadingVerify
          ? <Loader2 className="animate-spin" size={20} aria-label="Verifying…" />
          : 'Verify & Sign In'}
      </button>
    </motion.form>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// FORGOT / RESET PASSWORD FLOW
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * FIX:
 *   Step 1 → dispatch(forgotPassword(formData.identifier))
 *            forgotPassword thunk accepts a string identifier  (email|phone|name)
 *            and internally wraps it as { identifier } before the API call.
 *
 *   Step 2 → dispatch(resetPassword({ identifier, otp, newPassword }))
 *            All three fields are required by userRoutes.js /reset-password.
 *            identifier keeps the same value the user typed in step 1.
 */
const ForgotPasswordFlow = memo(function ForgotPasswordFlow({
  formData,
  onChange,
  onBack,
  loadingForgot,
  loadingReset,
  dispatch,
}) {
  const [step, setStep]   = useState(1);
  const [showNew, setShowNew] = useState(false);

  const { icon: IdentIcon, placeholder } = getIdentifierMeta(formData.identifier);

  const handleRequestReset = useCallback(
    async (e) => {
      e.preventDefault();
      if (!formData.identifier?.trim()) {
        toast.error('Please enter your email, phone, or name.');
        return;
      }
      // FIX: pass the raw string — forgotPassword thunk handles wrapping
      const res = await dispatch(forgotPassword(formData.identifier));
      if (res.meta.requestStatus === 'fulfilled') setStep(2);
    },
    [dispatch, formData.identifier]
  );

  const handleConfirmReset = useCallback(
    async (e) => {
      e.preventDefault();
      if (!formData.otp || formData.otp.length !== 6) {
        toast.error('Enter the 6-digit code from your email / SMS / WhatsApp.');
        return;
      }
      if (!formData.newPassword || formData.newPassword.length < 8) {
        toast.error('New password must be at least 8 characters.');
        return;
      }
      // FIX: resetPassword expects { identifier, otp, newPassword }
      const res = await dispatch(
        resetPassword({
          identifier:  formData.identifier,
          otp:         formData.otp,
          newPassword: formData.newPassword,
        })
      );
      if (res.meta.requestStatus === 'fulfilled') onBack();
    },
    [dispatch, formData, onBack]
  );

  return (
    <motion.div
      key="forgot"
      variants={FADE_SCALE}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.22 }}
      className="space-y-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[10px] font-poppins font-black uppercase tracking-widest text-base-content/40 hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
        aria-label="Return to sign in"
      >
        <ArrowLeft size={14} aria-hidden="true" /> Back to Sign In
      </button>

      <div>
        <h3 className="text-xl font-poppins font-black tracking-tight text-base-content">
          {step === 1 ? 'Reset Your Password' : 'Create New Password'}
        </h3>
        <p className="text-xs text-base-content/50 mt-1 font-poppins font-medium">
          {step === 1
            ? "Enter your email, phone, or name. We'll send a reset code via email, SMS & WhatsApp."
            : 'Enter the code you received and your new password.'}
        </p>
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <form onSubmit={handleRequestReset} className="space-y-5" noValidate>
          <div className="relative group">
            <IdentIcon
              className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 group-focus-within:text-primary transition-colors"
              size={18}
              aria-hidden="true"
            />
            <input
              name="identifier"
              type="text"
              required
              autoComplete="username"
              value={formData.identifier}
              onChange={onChange}
              placeholder={placeholder || 'Email, phone, or name'}
              aria-label="Email, phone number, or full name"
              className="input-field w-full pl-12 h-12 font-poppins font-bold"
            />
          </div>
          <button
            type="submit"
            disabled={loadingForgot}
            aria-busy={loadingForgot}
            className="w-full h-16 rounded-2xl bg-accent text-white font-poppins font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {loadingForgot
              ? <Loader2 className="animate-spin" size={20} />
              : 'Send Reset Code'}
          </button>
        </form>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <form onSubmit={handleConfirmReset} className="space-y-5" noValidate>
          <div className="p-4 bg-success/10 border border-success/20 rounded-2xl flex items-center gap-3 text-[11px] font-poppins font-bold text-success">
            <CheckCircle2 size={18} aria-hidden="true" />
            Reset code sent via email, SMS &amp; WhatsApp
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reset-otp"
              className="block text-[10px] font-poppins font-black uppercase tracking-widest text-base-content/40 ml-1"
            >
              Reset Code (6 digits)
            </label>
            <input
              id="reset-otp"
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoComplete="one-time-code"
              value={formData.otp}
              onChange={onChange}
              placeholder="0 0 0 0 0 0"
              aria-label="Password reset code"
              className="input-field w-full h-12 text-center tracking-[0.5em] font-poppins font-black text-xl"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="new-password"
              className="block text-[10px] font-poppins font-black uppercase tracking-widest text-base-content/40 ml-1"
            >
              New Password
            </label>
            <div className="relative group">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-base-content/20 group-focus-within:text-primary transition-colors"
                size={18}
                aria-hidden="true"
              />
              <input
                id="new-password"
                name="newPassword"
                type={showNew ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={formData.newPassword}
                onChange={onChange}
                placeholder="Minimum 8 characters"
                aria-label="New password"
                className="input-field w-full pl-12 pr-12 h-12 font-poppins font-bold"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content transition-colors"
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loadingReset}
            aria-busy={loadingReset}
            className="btn-primary-cta w-full h-16 rounded-2xl font-poppins font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-60"
          >
            {loadingReset
              ? <Loader2 className="animate-spin" size={20} />
              : 'Update Password'}
          </button>
        </form>
      )}
    </motion.div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN LOGIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Login = () => {
  const dispatch = useDispatch();
  const router   = useRouter();

 
const { error, loaders, user } = useSelector((state) => state.user);

  const [authMode, setAuthMode] = useState('password');

  /**
   * Unified formData covering all modes.
   * `identifier` replaces old email-only field — matches buildLoginFilter() on backend.
   */
  const [formData, setFormData] = useState({
    identifier:  '',
    password:    '',
    otp:         '',
    newPassword: '',
  });

  // Redirect guard — runs after Redux state is hydrated from localStorage
  useEffect(() => {
    if (user?._id) router.replace('/');
  }, [user, router]);

  // Clear Redux error on every mode switch so stale errors don't bleed through
  useEffect(() => {
    dispatch(clearError());
  }, [authMode, dispatch]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleModeSelect = useCallback((mode) => {
    setAuthMode(mode);
    dispatch(clearError());
  }, [dispatch]);

  // ── AUTH HANDLERS ──────────────────────────────────────────────────────────

  /**
   * Password login
   * Sends { identifier, password } → POST /api/users/login
   * FIX: patchUser({ isOnline: true }) after success so local state is immediately correct
   */
// FIX 1 & 2 — handlePasswordLogin: add socket connect after success
const handlePasswordLogin = useCallback(async (e) => {
  e.preventDefault();
  if (!formData.identifier?.trim()) {
    toast.error('Please enter your email, phone, or name.');
    return;
  }
  const result = await dispatch(
    login({ identifier: formData.identifier, password: formData.password })
  );
  if (result.meta.requestStatus === 'fulfilled') {
    dispatch(patchUser({ isOnline: true }));
     
    router.push('/');
  }
}, [dispatch, formData.identifier, formData.password, router]);
  /**
   * OTP login verify
   * Sends { identifier, otp } → POST /api/users/otp-login
   */
  const handleOtpLogin = useCallback(async (e) => {
    e.preventDefault();
    if (!formData.otp || formData.otp.length !== 6) {
      toast.error('Please enter the 6-digit code first.');
      return;
    }
    const result = await dispatch(
      otpLogin({ identifier: formData.identifier, otp: formData.otp })
    );
    if (result.meta.requestStatus === 'fulfilled') {
      dispatch(patchUser({ isOnline: true }));
      
      router.push('/');
    }
  }, [dispatch, formData.identifier, formData.otp, router]);

  /**
   * Request OTP for passwordless login
   * FIX: dispatches requestOtpLogin(identifier) — a plain string.
   *      requestOtp(email) is for email-verification during SignUp only.
   *      POST /api/users/request-otp-login expects { identifier }.
   */
// FIX 1 — handleSendLoginOtp: remove premature socket connect
const handleSendLoginOtp = useCallback(async () => {
  if (!formData.identifier?.trim()) {
    toast.error('Please enter your email, phone, or name first.');
    return;
  }
  await dispatch(requestOtpLogin(formData.identifier));
  // NO socket here — token not available yet
}, [dispatch, formData.identifier]);

// FIX 3 — handleGoogleLogin: remove socket call (browser redirect, no token yet)
const handleGoogleLogin = useCallback(() => {
  loginWithGoogle(); // browser redirect — socket handled after redirect lands
}, []);

  const goToForgot   = useCallback(() => setAuthMode('forgot'),   []);
  const goToPassword = useCallback(() => setAuthMode('password'), []);

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <main
      className="min-h-screen bg-base-200 flex items-center font-poppins  justify-center p-4   selection:bg-primary selection:text-white"
      aria-label="Sign in page"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 bg-base-100 rounded-md overflow-hidden shadow border border-base-300 min-h-[700px]"
      >
        {/* ── LEFT: BRAND PANEL ─────────────────────────────────────────── */}
       <aside className="hidden lg:flex relative overflow-hidden bg-primary/40 flex-col justify-between p-12 text-white" aria-hidden="true">
  {/* ── BACKGROUND ── */}
  {/* Using a clean hospital/architectural image for a more clinical, professional vibe */}
  {/* eslint-disable-next-line @next/next/no-img-element */}
  <img
    src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2053&auto=format&fit=crop"
    alt="Medical facility corridor"
    className="absolute inset-0 w-full h-full object-cover opacity-40   mix-blend-overlay"
    loading="lazy"
    decoding="async"
  />
  {/* Subtle gradient to ensure text readability at the top and bottom */}
  <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-transparent to-primary/40" />

  {/* ── TOP: BRANDING & HERO COPY ── */}
  <div className="relative z-10">
    <div className="flex items-center gap-3 mb-12">
      <img src="/Logo.ico" alt="Likeson Logo" className="w-10 h-10 rounded-full" />
      <span className="text-2xl font-poppins font-black tracking-tight">Likeson.</span>
    </div>

    <h1 className="text-4xl lg:text-5xl font-poppins font-black tracking-tighter leading-[1.1] mb-6">
      Advanced <br /> Healthcare <br /> <span className="text-white/70">Delivered.</span>
    </h1>
    <p className="text-white/80 font-poppins text-sm md:text-base max-w-sm leading-relaxed">
      Your trusted partner for immediate medical transport, dedicated home care, and comprehensive clinical support systems.
    </p>
  </div>

  {/* ── BOTTOM: TRUST SIGNALS & STATS ── */}
  <div className="relative z-10 mt-12 grid grid-cols-2 gap-8">
    {/* Stat 1 */}
    <div className="space-y-1 border-l-2 border-white/20 pl-4">
      <h4 className="text-3xl font-poppins font-black">24/7</h4>
      <p className="text-[10px] font-poppins font-bold uppercase tracking-widest text-white/60">
        Rapid Response
      </p>
    </div>
    
    {/* Stat 2 */}
    <div className="space-y-1 border-l-2 border-white/20 pl-4">
      <h4 className="text-3xl font-poppins font-black">10k+</h4>
      <p className="text-[10px] font-poppins font-bold uppercase tracking-widest text-white/60">
        Patients Served
      </p>
    </div>

    {/* Security Badge */}
    <div className="col-span-2 pt-4">
      <div className="inline-flex items-center gap-2 text-xs font-poppins font-bold text-white/90 bg-white/10 px-4 py-2.5 rounded-lg backdrop-blur-md border border-white/10">
        <ShieldAlert size={16} className="text-green-400" />
        Secure & Fully Compliant System
      </div>
    </div>
  </div>
</aside>

        {/* ── RIGHT: AUTH PANEL ─────────────────────────────────────────── */}
        <section className="p-8 sm:p-16 flex flex-col justify-center bg-base-100">
          <header className="mb-10">
            
            <h2 className="text-4xl font-poppins font-black font-poppins font-poppins text-base-content tracking-tighter">Sign In</h2>
            <p className="text-base-content/50 font-poppins font-poppins   text-sm font-medium mt-2">
              Use email, phone number, or your full name
            </p>
          </header>

          {/* Tab bar — hidden in forgot mode */}
          {authMode !== 'forgot' && (
            <AuthTabBar authMode={authMode} onSelect={handleModeSelect} />
          )}

          {/* FIX: ErrorBanner reads state.user.error via the `error` prop */}
          <ErrorBanner message={error} />

          <AnimatePresence mode="wait">
            {authMode === 'password' && (
              <PasswordForm
                key="password"
                formData={formData}
                onChange={handleChange}
                onSubmit={handlePasswordLogin}
                onForgot={goToForgot}
                loading={loaders.login}                 // FIX: was `loading` (global)
              />
            )}

            {authMode === 'otp' && (
              <OtpForm
                key="otp"
                formData={formData}
                onChange={handleChange}
                onSubmit={handleOtpLogin}
                onSendOtp={handleSendLoginOtp}
                loadingSend={loaders.requestOtpLogin}   // FIX: was loaders.otpRequest
                loadingVerify={loaders.otpLogin}
              />
            )}

            {authMode === 'forgot' && (
              <ForgotPasswordFlow
                key="forgot"
                formData={formData}
                onChange={handleChange}
                onBack={goToPassword}
                loadingForgot={loaders.forgotPassword}
                loadingReset={loaders.resetPassword}
                dispatch={dispatch}
              />
            )}
          </AnimatePresence>

          {/* Social + register footer — hidden in forgot mode */}
          {authMode !== 'forgot' && (
            <div className="mt-8 space-y-6">
              <div className="relative flex items-center" aria-hidden="true">
                <div className="flex-grow border-t border-base-300" />
                <span className="flex-shrink mx-4 text-[8px] font-poppins font-black uppercase tracking-[0.4em] text-base-content/20">
                  or continue with
                </span>
                <div className="flex-grow border-t border-base-300" />
              </div>

              <GoogleLoginButton onClick={handleGoogleLogin} />

              <p className="text-center text-xs font-poppins font-medium text-base-content/40 pt-2">
                Don&apos;t have an account?{' '}
                <Link
                  href="/signup"
                  className="text-primary font-poppins font-black hover:underline ml-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded"
                >
                  Create Account
                </Link>
              </p>
            </div>
          )}
        </section>
      </motion.div>
    </main>
  );
};

export default Login;