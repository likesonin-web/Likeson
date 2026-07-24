'use client';

import React, {
  useState, useEffect, useCallback, useRef,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence }    from 'framer-motion';
import {
  User, Mail, Phone, Lock, ArrowRight, Loader2,
  ShieldCheck, MailCheck, Fingerprint,
  ChevronLeft, Heart, ShieldAlert, FileText, Shield,
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp,
  Gift, BadgeCheck, X, Eye, EyeOff, Sparkles,
} from 'lucide-react';
import Link  from 'next/link';
import toast from 'react-hot-toast';

import {
  signup,
  requestOtp,
  verifyEmail,
  clearError,
  selectLoaders,
  selectError,
} from '@/store/slices/userSlice';

import {
  fetchActiveDocByType,
  recordConsent,
  selectActiveDocByType,
  selectConsentLoading,
} from '@/store/slices/legalSlice';

import API from '@/store/api';

// ═══════════════════════════════════════════════════════════════════════════════
// § 1  REFERRAL VALIDATION HOOK
// ═══════════════════════════════════════════════════════════════════════════════

function useReferralValidation(code) {
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState(null);
  const timerRef = useRef(null);

  const runValidation = useCallback(async (c) => {
    setValidating(true);
    try {
      const { data } = await API.get(
        `/users/referral/validate?code=${encodeURIComponent(c)}`
      );
      setValidation(data?.data ?? null);
    } catch {
      setValidation({ valid: false });
    } finally {
      setValidating(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);

    if (!code || code.length < 6) {
      setValidation(null);
      setValidating(false);
      return;
    }

    setValidating(true);
    timerRef.current = setTimeout(() => runValidation(code), 600);

    return () => clearTimeout(timerRef.current);
  }, [code, runValidation]);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setValidation(null);
    setValidating(false);
  }, []);

  return { validating, validation, reset };
}

// ═══════════════════════════════════════════════════════════════════════════════
// § 2  HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) : '';

const parseBonusDisplay = (validation) => {
  if (!validation) return '₹5.00';
  if (validation.bonusRupees) return validation.bonusRupees;
  if (validation.bonusCoins)  return `₹${(validation.bonusCoins / 100).toFixed(2)}`;
  return '₹5.00';
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 3  REFERRAL BANNER
// ═══════════════════════════════════════════════════════════════════════════════

const ReferralBanner = ({ code, validating, validation, onDismiss }) => {
  if (validating) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 rounded-md border text-xs bg-base-200"
        style={{ borderColor: 'var(--base-300)' }}
      >
        <Loader2 size={14} className="animate-spin flex-shrink-0 text-primary" />
        <span className="text-[color-mix(in oklch, var(--base-content) 55%, transparent)]">
          Checking code{' '}
          <strong className="font-black text-base-content">{code}</strong>…
        </span>
      </motion.div>
    );
  }

  if (validation?.valid === true) {
    const bonus = parseBonusDisplay(validation);
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="flex items-start gap-3 px-4 py-3.5 rounded-md bg-[color-mix(in oklch, var(--success) 10%, var(--base-100))] border-[1.5px] border-[color-mix(in oklch, var(--success) 30%, transparent)]"
       
      >
        <motion.div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 bg-[color-mix(in oklch, var(--success) 20%, var(--base-200))]"
         
          animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <Gift size={15} className="text-success" />
        </motion.div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-success">
            Referral code applied!
          </p>
          <p
            className="text-[11px] mt-0.5 leading-relaxed text-[color-mix(in oklch, var(--base-content) 58%, transparent)]"
           
          >
            Invited by{' '}
            <strong className="font-black text-base-content">
              {validation.referrerName ?? 'a friend'}
            </strong>
            . You&apos;ll get{' '}
            <strong className="font-black text-success">{bonus}</strong>{' '}
            in coins on signup.
          </p>
          <span
            className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-[color-mix(in oklch, var(--success) 15%, var(--base-200))] text-success"
           
          >
            <BadgeCheck size={10} /> {code}
          </span>
        </div>
      </motion.div>
    );
  }

  if (validation?.valid === false) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className="flex items-start gap-3 px-4 py-3.5 rounded-md bg-[color-mix(in oklch, var(--warning) 10%, var(--base-100))] border-[1.5px] border-[color-mix(in oklch, var(--warning) 30%, transparent)]"
       
      >
        <AlertTriangle size={15} className="text-warning flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-black text-warning">Invalid referral code</p>
          <p
            className="text-[11px] mt-0.5 text-[color-mix(in oklch, var(--base-content) 50%, transparent)]"
           
          >
            Code <strong className="font-black">{code}</strong> wasn&apos;t found. You can still sign up without it.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="w-6 h-6 rounded-full flex items-center justify-center transition-colors flex-shrink-0 bg-[color-mix(in oklch, var(--warning) 20%, var(--base-200))]"
         
        >
          <X size={10} className="text-warning" />
        </button>
      </motion.div>
    );
  }

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 4  LEGAL PREVIEW DRAWER
// ═══════════════════════════════════════════════════════════════════════════════

const LegalPreviewDrawer = ({ doc, type }) => {
  const [open, setOpen] = useState(false);
  if (!doc) return null;

  const isTerms = type === 'terms';
  const accent  = isTerms ? 'var(--primary)' : 'var(--secondary)';

  // Normalise: real slice stores currentVersion, old code expected version
  const version       = doc.currentVersion ?? doc.version ?? '1.0';
  const effectiveDate = doc.effectiveDate;

  return (
    <div className="rounded-md overflow-hidden border-[1.5px] border-base-300">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 transition-all"
        style={{ background: open ? 'var(--base-200)' : 'transparent' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-1.5 rounded-lg"
            style={{ background: `color-mix(in oklch, ${accent} 12%, var(--base-200))` }}
          >
            {isTerms
              ? <FileText size={14} style={{ color: accent }} />
              : <Shield   size={14} style={{ color: accent }} />
            }
          </div>
          <div className="text-left">
            <p className="text-xs font-black text-base-content">{doc.title}</p>
            <p className="text-[10px] text-[color-mix(in oklch, var(--base-content) 40%, transparent)]">
              v{version} · Effective {formatDate(effectiveDate)}
            </p>
          </div>
        </div>
        {open
          ? <ChevronUp   size={14} className="text-[color-mix(in oklch, var(--base-content) 35%, transparent)]" />
          : <ChevronDown size={14} className="text-[color-mix(in oklch, var(--base-content) 35%, transparent)]" />
        }
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-4 pb-4 pt-3 border-t border-base-300 bg-[color-mix(in oklch, var(--base-200) 50%, transparent)]"
             
            >
              {doc.summary
                ? <p className="text-xs leading-relaxed text-[color-mix(in oklch, var(--base-content) 62%, transparent)]">{doc.summary}</p>
                : <p className="text-xs italic text-[color-mix(in oklch, var(--base-content) 38%, transparent)]">No summary available.</p>
              }
              {doc.requiresReAcceptance && (
                <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-warning">
                  <AlertTriangle size={11} /> Re-acceptance required on future updates
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 5  ANIMATED CHECKBOX
// ═══════════════════════════════════════════════════════════════════════════════

const AnimatedCheckbox = ({ checked, onChange, accentVar, children }) => (
  <label className="flex items-start gap-3 cursor-pointer group">
    <div className="relative mt-0.5 flex-shrink-0">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      <motion.div
        animate={{ scale: checked ? [1, 1.18, 1] : 1 }}
        transition={{ duration: 0.22 }}
        className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200"
        style={{
          background:  checked ? `var(${accentVar})` : 'transparent',
          borderColor: checked
            ? `var(${accentVar})`
            : 'color-mix(in oklch, var(--base-content) 25%, var(--base-300))',
        }}
      >
        {checked && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            <CheckCircle2
              size={12}
              strokeWidth={3}
              style={{ color: `var(${accentVar}-content, var(--base-100))` }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
    <span className="text-xs leading-relaxed select-none text-[color-mix(in oklch, var(--base-content) 68%, transparent)]">
      {children}
    </span>
  </label>
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 6  CONSENT STEP
// ═══════════════════════════════════════════════════════════════════════════════

// Memoised selectors — created outside component to avoid re-creation per render
const selectTerms   = selectActiveDocByType('terms_and_conditions');
const selectPrivacy = selectActiveDocByType('privacy_policy');

const ConsentStep = ({ onBack, onComplete }) => {
  const dispatch      = useDispatch();

  // ── Real slice selectors ────────────────────────────────────────────────────
  const activeTerms   = useSelector(selectTerms);
  const activePrivacy = useSelector(selectPrivacy);
  const submitting    = useSelector(selectConsentLoading);

  const [termsChecked,   setTermsChecked]   = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  // Fetch both docs on mount using the real thunk
  useEffect(() => {
    dispatch(fetchActiveDocByType({ type: 'terms_and_conditions' }));
    dispatch(fetchActiveDocByType({ type: 'privacy_policy' }));
  }, [dispatch]);

  const canProceed  = termsChecked && privacyChecked;
  const bothMissing = !activeTerms && !activePrivacy;

  // Normalise version fields (real doc uses `currentVersion`)
  const termsVersion   = activeTerms?.currentVersion   ?? activeTerms?.version   ?? '1.0';
  const privacyVersion = activePrivacy?.currentVersion ?? activePrivacy?.version ?? '1.0';

  const handleConsent = async () => {
    if (!canProceed) return;

    // Detect platform for the consent record
    const platform =
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios'
      : /Android/i.test(navigator.userAgent)         ? 'android'
      : 'web';

    // Real slice `recordConsent` payload:
    // { documentTypes, method, platform, state, city }
    const result = await dispatch(
      recordConsent({
        documentTypes: ['terms_and_conditions', 'privacy_policy'],
        method:        'checkbox',
        platform,
      })
    );

    if (result.meta.requestStatus === 'fulfilled') onComplete();
  };

  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors text-[color-mix(in oklch, var(--base-content) 40%, transparent)]"
       
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'color-mix(in oklch, var(--base-content) 40%, transparent)'; }}
      >
        <ChevronLeft size={14} /> Go Back
      </button>

      <div className="flex flex-col items-center text-center gap-3">
        <motion.div
          className="w-20 h-12 rounded-3xl flex items-center justify-center bg-[color-mix(in oklch, var(--primary) 10%, var(--base-200))] border-[1.5px] border-[color-mix(in oklch, var(--primary) 22%, var(--base-300))]"
         
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ShieldCheck size={38} className="text-primary" />
        </motion.div>
        <div>
          <p className="font-black text-lg tracking-tight text-base-content">One Last Step</p>
          <p className="text-xs mt-0.5 text-[color-mix(in oklch, var(--base-content) 50%, transparent)]">
            Review and accept our legal documents to continue
          </p>
        </div>
      </div>

      {bothMissing ? (
        <div
          className="p-4 rounded-md text-xs font-bold flex items-center gap-2 bg-[color-mix(in oklch, var(--warning) 10%, var(--base-100))] border-[1.5px] border-[color-mix(in oklch, var(--warning) 25%, transparent)] text-warning"
         
        >
          <AlertTriangle size={15} /> No active legal documents found. Please contact support.
        </div>
      ) : (
        <div className="space-y-3">
          <LegalPreviewDrawer doc={activeTerms}   type="terms" />
          <LegalPreviewDrawer doc={activePrivacy} type="privacy" />

          <div className="space-y-4 pt-2">
            {activeTerms && (
              <AnimatedCheckbox
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                accentVar="--primary"
              >
                I have read and agree to the{' '}
                <strong className="font-black text-primary">Terms &amp; Conditions</strong>
                <span className="text-[color-mix(in oklch, var(--base-content) 38%, transparent)]">
                  {' '}(v{termsVersion})
                </span>
              </AnimatedCheckbox>
            )}
            {activePrivacy && (
              <AnimatedCheckbox
                checked={privacyChecked}
                onChange={(e) => setPrivacyChecked(e.target.checked)}
                accentVar="--secondary"
              >
                I have read and agree to the{' '}
                <strong className="font-black text-secondary">Privacy Policy</strong>
                <span className="text-[color-mix(in oklch, var(--base-content) 38%, transparent)]">
                  {' '}(v{privacyVersion})
                </span>
              </AnimatedCheckbox>
            )}
          </div>
        </div>
      )}

      <motion.button
        type="button"
        onClick={handleConsent}
        disabled={!canProceed || submitting || bothMissing}
        whileTap={{ scale: 0.97 }}
        className="btn-primary-cta w-full h-16 rounded-md text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {submitting
          ? <Loader2 className="animate-spin" size={20} />
          : <><ShieldCheck size={18} /> Accept &amp; Complete Registration</>
        }
      </motion.button>

      <p
        className="text-center text-[10px] leading-relaxed text-[color-mix(in oklch, var(--base-content) 30%, transparent)]"
       
      >
        Your consent is recorded as required by the DPDP Act 2023. You may withdraw it at any time
        from your account settings.
      </p>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// § 7  FORM FIELD
// ═══════════════════════════════════════════════════════════════════════════════

const FormField = ({
  label, name, type = 'text', value, onChange,
  placeholder, icon: Icon, required = false, maxLength, rightSlot,
}) => (
  <div className="space-y-1.5">
    <label
      className="text-[10px] font-black uppercase tracking-widest ml-1 text-[color-mix(in oklch, var(--base-content) 42%, transparent)]"
     
    >
      {label}
    </label>
    <div className="relative group">
      {Icon && (
        <Icon
          size={17}
          className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors duration-200 text-[color-mix(in oklch, var(--base-content) 22%, transparent)]"
         
        />
      )}
      <input
        name={name} type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required} maxLength={maxLength}
        autoComplete={name}
        className="input-field w-full h-12 font-bold border-2 focus:border-primary"
        style={{ paddingLeft: Icon ? '3rem' : '1rem', paddingRight: rightSlot ? '3.5rem' : '1rem' }}
      />
      {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 8  STEP DOTS
// ═══════════════════════════════════════════════════════════════════════════════

const StepDots = ({ step, total = 3 }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: total }).map((_, i) => {
      const n = i + 1;
      return (
        <motion.div
          key={n}
          animate={{
            width: step === n ? 28 : 8,
            backgroundColor:
              step > n  ? 'var(--success)'
              : step === n ? 'var(--primary)'
              : 'var(--base-300)',
          }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="h-1.5 rounded-full"
        />
      );
    })}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 9  HERO LEFT PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const HeroPanel = ({ referralValidated, validation }) => (
  <div className="hidden lg:block relative overflow-hidden group">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=2070&auto=format&fit=crop"
      alt="Doctor helping patient"
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
    />
    <div
      className="absolute inset-0 bg-[linear-gradient(135deg, color-mix(in oklch, var(--primary) 96%, transparent) 0%, color-mix(in oklch, var(--primary) 55%, transparent) 55%, transparent 100%)]"
     
    />
    <div
      className="absolute inset-0 opacity-[0.07] pointer-events-none"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '160px',
      }}
    />

    <div className="absolute inset-0 p-14 flex flex-col justify-between z-10">
      <div>
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex p-4 rounded-md mb-8 bg-white/18 backdrop-blur-[16px] border-[1.5px] border-[rgba(255,255,255,0.28)]"
         
        >
          <Heart size={36} className="text-[white]" style={{ fill: 'white' }} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="font-montserrat font-black text-6xl text-white leading-[0.9] tracking-tighter mb-6"
        >
          Get Better <br /> Care Today.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-lg leading-relaxed max-w-sm font-medium text-[rgba(255,255,255,0.78)]"
         
        >
          Join Likeson for fast medical help, expert doctors, and your health records safe in one place.
        </motion.p>
      </div>

      <AnimatePresence>
        {referralValidated && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mb-4 flex items-center gap-4 p-5 rounded-md bg-white/14 backdrop-blur-[16px] border-[1.5px] border-[rgba(255,255,255,0.22)]"
           
          >
            <div
              className="w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 bg-[rgba(253,230,138,0.2)]"
             
            >
              <Gift size={22} className="text-[#fde68a]" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-wider text-white">Referral Bonus Active!</p>
              <p className="text-xs mt-0.5 leading-snug text-[rgba(255,255,255,0.62)]">
                You&apos;ll receive{' '}
                <strong className="text-[#fde68a]">{parseBonusDisplay(validation)}</strong>{' '}
                in coins on signup.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-3">
            {[11, 12, 13, 14].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full border-2 overflow-hidden"
                style={{ borderColor: 'var(--primary)' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.pravatar.cc/100?img=${i}`} alt="user" />
              </div>
            ))}
          </div>
          <p
            className="text-xs font-bold uppercase tracking-wide text-[rgba(255,255,255,0.65)]"
           
          >
            Used by 10,000+ people
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-4 p-5 rounded-[1.75rem] bg-white/10 backdrop-blur-[12px] border border-[rgba(255,255,255,0.12)]"
         
        >
          <div
            className="p-3 rounded-xl bg-[color-mix(in oklch, var(--success) 20%, transparent)]"
           
          >
            <ShieldCheck size={22} className="text-success" />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-white">Safe &amp; Secure</p>
            <p className="text-xs text-[rgba(255,255,255,0.55)]">
              Your private data is always protected
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// § 10  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const SignUp = () => {
  const dispatch     = useDispatch();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const loaders = useSelector(selectLoaders);
  const error   = useSelector(selectError);

  const [step,    setStep]    = useState(1);
  const [showPwd, setShowPwd] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', password: '', role: 'customer', otp: '',
  });
  const [referralCode, setReferralCode] = useState('');
  const [showRefInput, setShowRefInput] = useState(false);

  const { validating, validation, reset: resetValidation } = useReferralValidation(referralCode);

  // Pre-fill ?ref= query param
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref.toUpperCase().trim());
      setShowRefInput(true);
    }
  }, [searchParams]);

  // Clear Redux error on step change
  useEffect(() => { dispatch(clearError()); }, [step, dispatch]);

  const handleChange = useCallback(
    (e) => setFormData((p) => ({ ...p, [e.target.name]: e.target.value })),
    []
  );

  const handleDismissReferral = useCallback(() => {
    setReferralCode('');
    resetValidation();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('ref');
    router.replace(`/signup${params.size ? `?${params}` : ''}`, { scroll: false });
  }, [resetValidation, router, searchParams]);

  const isReferralValid = validation?.valid === true;
  const hasCode         = referralCode.length >= 6;

  // ── Step 1 — Signup ─────────────────────────────────────────────────────────
  const handleCreateAccount = async (e) => {
    e.preventDefault();

    const result = await dispatch(signup({
      name:     formData.name.trim(),
      email:    formData.email.trim().toLowerCase(),
      phone:    formData.phone.trim() || undefined,
      password: formData.password,
      role:     formData.role,
      ...(isReferralValid ? { referralCode } : {}),
    }));

    if (result.meta.requestStatus === 'fulfilled') {
      if (result.payload?.referral)
        toast.success(result.payload.referral.message ?? 'Referral bonus applied!');
      await dispatch(requestOtp(formData.email.trim().toLowerCase()));
      toast.success('Verification code sent to your email!');
      setStep(2);
    }
  };

  // ── Step 2 — OTP verify ─────────────────────────────────────────────────────
  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    const result = await dispatch(verifyEmail({
      email: formData.email.trim().toLowerCase(),
      otp:   formData.otp.trim(),
    }));
    if (result.meta.requestStatus === 'fulfilled') {
      toast.success('Email verified! Please review our legal documents.');
      setStep(3);
    }
  };

  // ── Step 3 — Consent complete ───────────────────────────────────────────────
  const handleConsentComplete = () => {
    toast.success('Welcome to Likeson! 🎉');
    router.push('/login');
  };

  const headings = {
    1: { title: 'Create Account',   sub: 'Enter your details to get started' },
    2: { title: 'Check Your Email', sub: `We sent a code to ${formData.email}` },
    3: { title: 'Legal Consent',    sub: 'Review and accept our Terms & Privacy Policy' },
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 font-poppins bg-base-200"
     
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 min-h-[750px] overflow-hidden rounded-md bg-base-100 border-[1.5px] border-base-300"
       
      >
        <HeroPanel referralValidated={isReferralValid} validation={validation} />

        {/* RIGHT PANEL */}
        <div
          className="relative flex flex-col justify-center p-8 sm:p-14 bg-base-100"
         
        >
          <div className="absolute top-10 right-10"><StepDots step={step} /></div>

          {/* Heading */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`h-${step}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-primary" />
                <span
                  className="text-[10px] font-black uppercase tracking-widest text-primary"
                 
                >
                  Step {step} of 3
                </span>
              </div>
              <h2
                className="font-montserrat font-black text-4xl tracking-tighter text-base-content"
               
              >
                {headings[step].title}
              </h2>
              <p
                className="mt-1.5 font-medium text-sm text-[color-mix(in oklch, var(--base-content) 50%, transparent)]"
               
              >
                {headings[step].sub}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Error banner */}
          <AnimatePresence>
            {error && step < 3 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-5 overflow-hidden"
              >
                <div
                  className="p-4 rounded-md flex items-center gap-3 text-[11px] font-bold bg-[color-mix(in oklch, var(--error) 10%, var(--base-100))] border-[1.5px] border-[color-mix(in oklch, var(--error) 25%, transparent)] text-error"
                 
                >
                  <ShieldAlert size={17} /> {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Forms ─────────────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">

            {/* STEP 1 */}
            {step === 1 && (
              <motion.form
                key="step1"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                onSubmit={handleCreateAccount}
                className="space-y-4"
              >
                {/* Referral banner (URL code) */}
                <AnimatePresence>
                  {(hasCode || validating) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <ReferralBanner
                        code={referralCode}
                        validating={validating}
                        validation={validation}
                        onDismiss={handleDismissReferral}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Full Name" name="name" value={formData.name}
                    onChange={handleChange} placeholder="Your name" icon={User} required
                  />
                  <FormField
                    label="Phone (optional)" name="phone" value={formData.phone}
                    onChange={handleChange} placeholder="+91 XXXXX XXXXX" icon={Phone}
                  />
                </div>

                <FormField
                  label="Email Address" name="email" type="email" value={formData.email}
                  onChange={handleChange} placeholder="name@example.com" icon={Mail} required
                />
                <FormField
                  label="Password" name="password"
                  type={showPwd ? 'text' : 'password'}
                  value={formData.password} onChange={handleChange}
                  placeholder="Create a password (min 8 chars)" icon={Lock} required
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      className="text-[color-mix(in oklch, var(--base-content) 35%, transparent)]"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                {/* Manual referral code toggle */}
                {!searchParams.get('ref') && (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRefInput((v) => !v);
                        if (showRefInput) { setReferralCode(''); resetValidation(); }
                      }}
                      className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors text-[color-mix(in oklch, var(--primary) 65%, transparent)]"
                     
                    >
                      <Gift size={12} />
                      {showRefInput ? 'Remove referral code' : 'Have a referral code?'}
                    </button>

                    <AnimatePresence>
                      {showRefInput && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, marginTop: 0 }}
                          animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                          exit={{ opacity: 0, height: 0, marginTop: 0 }}
                          className="overflow-hidden space-y-2"
                        >
                          <div className="relative">
                            <Gift
                              size={16}
                              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[color-mix(in oklch, var(--base-content) 22%, transparent)]"
                             
                            />
                            <input
                              type="text"
                              maxLength={12}
                              value={referralCode}
                              onChange={(e) =>
                                setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                              }
                              placeholder="e.g. A3KX9WQZ"
                              className="input-field w-full h-12 font-black tracking-widest border-2 uppercase text-sm pl-[3rem]"
                             
                            />
                            {validating && referralCode.length >= 6 && (
                              <Loader2
                                size={14}
                                className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary"
                               
                              />
                            )}
                          </div>
                          {referralCode.length >= 6 && !validating && (
                            <ReferralBanner
                              code={referralCode}
                              validating={false}
                              validation={validation}
                              onDismiss={handleDismissReferral}
                            />
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <motion.button
                  type="submit"
                  disabled={loaders.signup}
                  whileTap={{ scale: 0.97 }}
                  className="btn-primary-cta btn w-full h-13 rounded-md text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {loaders.signup ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      Sign Up Now <ArrowRight size={17} />
                      {isReferralValid && (
                        <span
                          className="ml-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-white/25 text-primary-content"
                         
                        >
                          +{parseBonusDisplay(validation)}
                        </span>
                      )}
                    </>
                  )}
                </motion.button>
              </motion.form>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <motion.form
                key="step2"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.32 }}
                onSubmit={handleVerifyEmail}
                className="space-y-8"
              >
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors text-[color-mix(in oklch, var(--base-content) 40%, transparent)]"
                 
                >
                  <ChevronLeft size={14} /> Go Back
                </button>

                <div className="flex flex-col items-center text-center gap-4">
                  <motion.div
                    className="w-20 h-12 rounded-3xl flex items-center justify-center bg-[color-mix(in oklch, var(--success) 12%, var(--base-200))] border-[1.5px] border-[color-mix(in oklch, var(--success) 28%, var(--base-300))]"
                   
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <MailCheck size={38} className="text-success" />
                  </motion.div>
                  <p className="text-sm font-medium text-[color-mix(in oklch, var(--base-content) 58%, transparent)]">
                    Code sent to{' '}
                    <strong className="font-black text-base-content">
                      {formData.email}
                    </strong>
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    className="text-[10px] font-black uppercase tracking-widest flex justify-center text-[color-mix(in oklch, var(--base-content) 42%, transparent)]"
                   
                  >
                    Enter 6-Digit Code
                  </label>
                  <div className="relative max-w-xs mx-auto">
                    <Fingerprint
                      size={24}
                      className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-[color-mix(in oklch, var(--base-content) 20%, transparent)]"
                     
                    />
                    <input
                      name="otp" type="text" maxLength="6"
                      inputMode="numeric" pattern="[0-9]*" required
                      onChange={handleChange} value={formData.otp}
                      placeholder="· · · · · ·" autoComplete="one-time-code"
                      className="input-field w-full h-12 text-center font-black tracking-[0.4em] border-2 focus:border-primary text-[2rem] pl-[3.5rem]"
                     
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <motion.button
                    type="submit"
                    disabled={loaders.verifyEmail || formData.otp.length < 6}
                    whileTap={{ scale: 0.97 }}
                    className="btn-primary-cta w-full h-16 rounded-md text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {loaders.verifyEmail
                      ? <Loader2 className="animate-spin" size={20} />
                      : <><MailCheck size={18} /> Verify &amp; Continue <ArrowRight size={16} /></>
                    }
                  </motion.button>

                  <button
                    type="button"
                    disabled={loaders.otpRequest}
                    onClick={() => dispatch(requestOtp(formData.email.trim().toLowerCase()))}
                    className="w-full text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 text-primary"
                   
                  >
                    {loaders.otpRequest
                      ? <><Loader2 className="animate-spin" size={12} /> Sending…</>
                      : 'Resend Code'
                    }
                  </button>
                </div>
              </motion.form>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <ConsentStep onBack={() => setStep(2)} onComplete={handleConsentComplete} />
            )}

          </AnimatePresence>

          {/* Footer — only on step 1 */}
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-8 pt-6 flex items-center justify-between border-t border-base-300"
             
            >
              <p
                className="text-xs font-medium text-[color-mix(in oklch, var(--base-content) 42%, transparent)]"
               
              >
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="font-black transition-colors text-primary"
                 
                >
                  Log In
                </Link>
              </p>
              <div
                className="flex items-center gap-1.5 text-[10px] font-black uppercase text-[color-mix(in oklch, var(--base-content) 22%, transparent)]"
               
              >
                <ShieldCheck size={11} /> Secure
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default SignUp;