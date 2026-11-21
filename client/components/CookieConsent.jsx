'use client';

import { useEffect, useState, useCallback, memo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useDispatch, useSelector } from 'react-redux';
import {
  Cookie,
  ShieldCheck,
  BarChart2,
  Megaphone,
  Settings2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Info,
  RefreshCw,
  Loader2,
  ExternalLink,
  Clock,
  Globe,
  Lock,
} from 'lucide-react';

import {
  getCookieConsent,
  saveCookieConsent,
  patchCookieConsent,
  withdrawCookieConsent,
  selectCookieConsent,
  selectCookieConsentGiven,
  selectCookiePreferences,
  selectLoaders,
} from '@/store/slices/userSlice';

// ── Lazy framer ───────────────────────────────────────────────────────────────
const MotionDiv    = dynamic(() => import('framer-motion').then(m => ({ default: m.motion.div })),    { ssr: false, loading: () => <div /> });
const MotionButton = dynamic(() => import('framer-motion').then(m => ({ default: m.motion.button })), { ssr: false, loading: () => <button /> });
const AnimatePresence = dynamic(() => import('framer-motion').then(m => ({ default: m.AnimatePresence })), { ssr: false, loading: () => null });

// ── Cookie category definitions ───────────────────────────────────────────────
const CATEGORIES = [
  {
    key:         'necessary',
    label:       'Necessary',
    description: 'Essential for the site to work. Cannot be disabled.',
    detail:      'These handle login sessions, security tokens, cart state, and language preferences. Without them, the site breaks.',
    icon:        Lock,
    locked:      true,
    accent:      'var(--success)',
    bg:          'color-mix(in srgb, var(--success) 8%, transparent)',
    border:      'color-mix(in srgb, var(--success) 25%, transparent)',
    examples:    ['auth_token', 'session_id', 'csrf_token', 'cart_state'],
  },
  {
    key:         'analytics',
    label:       'Analytics',
    description: 'Help us understand how people use the site.',
    detail:      'We track page visits, time on site, and feature usage to improve the experience. All data is anonymised and never sold.',
    icon:        BarChart2,
    locked:      false,
    accent:      'var(--primary)',
    bg:          'color-mix(in srgb, var(--primary) 8%, transparent)',
    border:      'color-mix(in srgb, var(--primary) 25%, transparent)',
    examples:    ['_ga', '_gid', 'amplitude_id', 'mixpanel_id'],
  },
  {
    key:         'marketing',
    label:       'Marketing',
    description: 'Enable relevant ads and campaign tracking.',
    detail:      'Used to show you promotions relevant to your health needs and to measure ad performance. Opt out anytime.',
    icon:        Megaphone,
    locked:      false,
    accent:      'var(--warning)',
    bg:          'color-mix(in srgb, var(--warning) 8%, transparent)',
    border:      'color-mix(in srgb, var(--warning) 25%, transparent)',
    examples:    ['fbp', 'ttclid', 'gclid', '_uetsid'],
  },
  {
    key:         'functional',
    label:       'Functional',
    description: 'Personalise your experience across visits.',
    detail:      'Remember your city, doctor filters, saved searches, and notification preferences so you don\'t have to re-enter them.',
    icon:        Settings2,
    locked:      false,
    accent:      'var(--secondary)',
    bg:          'color-mix(in srgb, var(--secondary) 8%, transparent)',
    border:      'color-mix(in srgb, var(--secondary) 25%, transparent)',
    examples:    ['preferred_city', 'saved_filters', 'ui_theme', 'notif_prefs'],
  },
];

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = memo(function Toggle({ checked, onChange, locked, accent }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={locked}
      onClick={() => !locked && onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2
        transition-all duration-300 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-offset-2 disabled:cursor-not-allowed
      `}
      style={{
        background:  checked ? accent : 'var(--base-300)',
        borderColor: checked ? accent : 'var(--base-300)',
        '--tw-ring-color': accent,
      }}
    >
      <span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0px)' }}
        aria-hidden="true"
      />
    </button>
  );
});

// ── Category card ─────────────────────────────────────────────────────────────
const CategoryCard = memo(function CategoryCard({ cat, value, onChange, expanded, onToggleExpand }) {
  const Icon = cat.icon;

  return (
    <MotionDiv
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 280 }}
      className="rounded-2xl border overflow-hidden transition-shadow duration-200"
      style={{
        borderColor:      expanded ? cat.border : 'var(--base-300)',
        background:       expanded ? cat.bg : 'var(--base-100)',
        boxShadow:        expanded ? `0 4px 24px -4px ${cat.border}` : 'none',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: cat.bg, color: cat.accent }}
          aria-hidden="true"
        >
          <Icon size={18} strokeWidth={2.2} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-black uppercase tracking-tight leading-none">{cat.label}</p>
            {cat.locked && (
              <span
                className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{ background: cat.bg, color: cat.accent, border: `1px solid ${cat.border}` }}
              >
                Always on
              </span>
            )}
          </div>
          <p className="text-[11px] opacity-50 mt-0.5 leading-tight">{cat.description}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <Toggle
            checked={value}
            onChange={onChange}
            locked={cat.locked}
            accent={cat.accent}
          />
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={expanded ? `Collapse ${cat.label} details` : `Expand ${cat.label} details`}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-base-200 text-base-content"
          >
            <ChevronRight
              size={14}
              strokeWidth={2.5}
              style={{
                transform:  expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.25s',
                color:      expanded ? cat.accent : 'inherit',
              }}
            />
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <MotionDiv
            key="detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, transition: { duration: 0.25, ease: 'easeOut' } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-4 pt-0 border-t"
              style={{ borderColor: cat.border }}
            >
              <p className="text-[12px] leading-relaxed opacity-70 mt-3 mb-3">{cat.detail}</p>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-2">Example cookies</p>
                <div className="flex flex-wrap gap-1.5">
                  {cat.examples.map(ex => (
                    <code
                      key={ex}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                      style={{ background: cat.bg, color: cat.accent, border: `1px solid ${cat.border}` }}
                    >
                      {ex}
                    </code>
                  ))}
                </div>
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
});

// ── Status banner ─────────────────────────────────────────────────────────────
const StatusBanner = memo(function StatusBanner({ consent }) {
  if (!consent) return null;

  const given    = consent.consentGiven;
  const savedAt  = consent.consentAt ? new Date(consent.consentAt) : null;
  const updatedAt = consent.updatedAt ? new Date(consent.updatedAt) : null;
  const displayDate = updatedAt ?? savedAt;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 px-4 py-3 rounded-xl border mb-6"
      style={
        given
          ? { background: 'color-mix(in srgb, var(--success) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--success) 25%, transparent)' }
          : { background: 'color-mix(in srgb, var(--warning) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--warning) 25%, transparent)' }
      }
    >
      {given
        ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
        : <Info         size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
      }
      <div className="min-w-0">
        <p className="text-[12px] font-black leading-none mb-0.5" style={{ color: given ? 'var(--success)' : 'var(--warning)' }}>
          {given ? 'Preferences saved' : 'No preferences saved yet'}
        </p>
        {displayDate && (
          <p className="text-[10px] opacity-50 flex items-center gap-1">
            <Clock size={9} aria-hidden="true" />
            {displayDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
        {consent.version && (
          <p className="text-[10px] opacity-40 mt-0.5">Policy version {consent.version}</p>
        )}
      </div>
    </MotionDiv>
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function CookieConsentPage() {
  const dispatch  = useDispatch();
  const consent   = useSelector(selectCookieConsent);
  const given     = useSelector(selectCookieConsentGiven);
  const savedPrefs = useSelector(selectCookiePreferences);
  const loaders   = useSelector(selectLoaders);

  const isSaving      = loaders?.cookieConsent       ?? false;
  const isPatching    = loaders?.updateCookieConsent ?? false;
  const isWithdrawing = loaders?.withdrawCookieConsent ?? false;
  const isFetching    = loaders?.getCookieConsent    ?? false;

  const anyLoading = isSaving || isPatching || isWithdrawing || isFetching;

  // Local prefs state (optimistic)
  const [prefs, setPrefs] = useState({
    necessary:  true,
    analytics:  false,
    marketing:  false,
    functional: false,
  });

  const [expanded, setExpanded] = useState(null);
  const [dirty,    setDirty]    = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  // Fetch on mount
  useEffect(() => {
    dispatch(getCookieConsent());
  }, [dispatch]);

  // Sync saved prefs into local state
  useEffect(() => {
    if (savedPrefs) {
      setPrefs({
        necessary:  true,
        analytics:  savedPrefs.analytics  ?? false,
        marketing:  savedPrefs.marketing  ?? false,
        functional: savedPrefs.functional ?? false,
      });
      setDirty(false);
    }
  }, [savedPrefs]);

  const handleToggle = useCallback((key, val) => {
    if (key === 'necessary') return;
    setPrefs(p => ({ ...p, [key]: val }));
    setDirty(true);
  }, []);

  const handleToggleExpand = useCallback((key) => {
    setExpanded(p => (p === key ? null : key));
  }, []);

  const handleAcceptAll = useCallback(async () => {
    await dispatch(saveCookieConsent({ acceptAll: true }));
    setPrefs({ necessary: true, analytics: true, marketing: true, functional: true });
    setDirty(false);
  }, [dispatch]);

  const handleSaveCustom = useCallback(async () => {
    if (!given) {
      // First save
      await dispatch(saveCookieConsent({ preferences: prefs }));
    } else {
      // Update
      await dispatch(patchCookieConsent({
        analytics:  prefs.analytics,
        marketing:  prefs.marketing,
        functional: prefs.functional,
      }));
    }
    setDirty(false);
  }, [dispatch, given, prefs]);

  const handleRejectAll = useCallback(async () => {
    const rejectPrefs = { analytics: false, marketing: false, functional: false };
    setPrefs({ necessary: true, ...rejectPrefs });
    if (!given) {
      await dispatch(saveCookieConsent({ preferences: { necessary: true, ...rejectPrefs } }));
    } else {
      await dispatch(patchCookieConsent(rejectPrefs));
    }
    setDirty(false);
  }, [dispatch, given]);

  const handleWithdraw = useCallback(async () => {
    await dispatch(withdrawCookieConsent());
    setPrefs({ necessary: true, analytics: false, marketing: false, functional: false });
    setDirty(false);
    setShowWithdrawConfirm(false);
  }, [dispatch]);

  // Count active non-necessary
  const activeCount = [prefs.analytics, prefs.marketing, prefs.functional].filter(Boolean).length;

  return (
    <main id="main-content" className="min-h-screen bg-base-100">

      {/* ── Hero strip ─────────────────────────────────────────────────────── */}
      <div
        className="border-b border-base-300"
        style={{ background: 'color-mix(in srgb, var(--primary) 5%, var(--base-100))' }}
      >
        <div className="container-custom max-w-3xl py-10 md:py-14">
          <div className="flex items-start gap-5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-primary"
              style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}
              aria-hidden="true"
            >
              <Cookie size={26} strokeWidth={2} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] opacity-40 mb-1">Privacy · GDPR</p>
              <h1 className="section-heading !mb-2 !text-2xl md:!text-3xl">Cookie Preferences</h1>
              <p className="text-[13px] opacity-60 leading-relaxed max-w-xl">
                We use cookies to keep the site working, improve the experience, and — only with your permission — for analytics and marketing. You control exactly which categories are active.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <Link
                  href="/privacy"
                  className="text-[11px] font-bold flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink size={11} aria-hidden="true" />
                  Privacy Policy
                </Link>
                <Link
                  href="/terms"
                  className="text-[11px] font-bold flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink size={11} aria-hidden="true" />
                  Terms of Service
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="container-custom max-w-3xl py-8 md:py-12">

        {/* Loading skeleton */}
        {isFetching && !consent && (
          <div className="space-y-3 mb-8" aria-busy="true" aria-label="Loading preferences">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton h-[72px] rounded-2xl w-full" />
            ))}
          </div>
        )}

        {/* Status banner */}
        {!isFetching && <StatusBanner consent={consent} />}

        {/* Quick-action row */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-black"
            style={{
              background:  'color-mix(in srgb, var(--primary) 8%, transparent)',
              borderColor: 'color-mix(in srgb, var(--primary) 25%, transparent)',
              color:       'var(--primary)',
            }}
            aria-label={`${activeCount} of 3 optional categories enabled`}
          >
            <Globe size={12} aria-hidden="true" />
            {activeCount}/3 enabled
          </div>

          <MotionButton
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleAcceptAll}
            disabled={anyLoading}
            aria-label="Accept all cookie categories"
            className="px-4 py-1.5 rounded-full text-[11px] font-black text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : 'Accept all'}
          </MotionButton>

          <MotionButton
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleRejectAll}
            disabled={anyLoading}
            aria-label="Reject all optional cookie categories"
            className="px-4 py-1.5 rounded-full text-[11px] font-black border border-base-300 bg-base-200 transition-all disabled:opacity-50"
          >
            {isPatching ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : 'Reject optional'}
          </MotionButton>
        </div>

        {/* Category cards */}
        <div className="space-y-3 mb-8" role="list" aria-label="Cookie categories">
          {CATEGORIES.map((cat, i) => (
            <div key={cat.key} role="listitem">
              <CategoryCard
                cat={cat}
                value={prefs[cat.key]}
                onChange={(val) => handleToggle(cat.key, val)}
                expanded={expanded === cat.key}
                onToggleExpand={() => handleToggleExpand(cat.key)}
              />
            </div>
          ))}
        </div>

        {/* Save custom button */}
        <AnimatePresence>
          {dirty && (
            <MotionDiv
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mb-6"
            >
              <div
                className="flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border"
                style={{
                  background:  'color-mix(in srgb, var(--primary) 6%, transparent)',
                  borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
                }}
              >
                <p className="text-[12px] font-bold opacity-70">You have unsaved changes.</p>
                <MotionButton
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={handleSaveCustom}
                  disabled={anyLoading}
                  aria-label="Save your custom cookie preferences"
                  className="px-5 py-2 rounded-xl text-[12px] font-black text-white flex items-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
                >
                  {isPatching || isSaving
                    ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Saving…</>
                    : 'Save preferences'
                  }
                </MotionButton>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Saved confirmation feedback */}
        <AnimatePresence>
          {given && !dirty && (
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 text-[11px] font-bold mb-6"
              style={{ color: 'var(--success)' }}
              aria-live="polite"
            >
              <CheckCircle2 size={14} aria-hidden="true" />
              Preferences saved
            </MotionDiv>
          )}
        </AnimatePresence>

        {/* Divider */}
        <div className="divider" aria-hidden="true" />

        {/* Info tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            {
              icon:  ShieldCheck,
              label: 'Your data, your rules',
              desc:  'Change or withdraw consent any time from this page.',
              accent: 'var(--success)',
            },
            {
              icon:  BarChart2,
              label: 'No selling',
              desc:  'We never sell your data to third parties.',
              accent: 'var(--primary)',
            },
            {
              icon:  RefreshCw,
              label: 'Policy updates',
              desc:  'We\'ll notify you when the policy changes and ask for consent again.',
              accent: 'var(--secondary)',
            },
          ].map(item => {
            const TileIcon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-2xl border border-base-300 px-4 py-4 bg-base-200"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                  style={{ background: `color-mix(in srgb, ${item.accent} 12%, transparent)`, color: item.accent }}
                  aria-hidden="true"
                >
                  <TileIcon size={16} strokeWidth={2} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-tight mb-1">{item.label}</p>
                <p className="text-[11px] opacity-50 leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </div>

        {/* GDPR withdraw section */}
        {given && (
          <div
            className="rounded-2xl border px-5 py-5"
            style={{
              borderColor: 'color-mix(in srgb, var(--error) 25%, transparent)',
              background:  'color-mix(in srgb, var(--error) 5%, transparent)',
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-black uppercase tracking-tight mb-1" style={{ color: 'var(--error)' }}>
                  Withdraw all consent
                </p>
                <p className="text-[11px] opacity-60 leading-relaxed max-w-sm">
                  Under GDPR Article 7(3) you can withdraw consent at any time. Only necessary cookies will remain active.
                </p>
              </div>

              {!showWithdrawConfirm ? (
                <MotionButton
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setShowWithdrawConfirm(true)}
                  disabled={anyLoading}
                  aria-label="Withdraw all cookie consent"
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-[11px] font-black border transition-all disabled:opacity-50"
                  style={{
                    borderColor: 'color-mix(in srgb, var(--error) 40%, transparent)',
                    color:       'var(--error)',
                    background:  'color-mix(in srgb, var(--error) 8%, transparent)',
                  }}
                >
                  Withdraw
                </MotionButton>
              ) : (
                <AnimatePresence>
                  <MotionDiv
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 flex-shrink-0"
                  >
                    <MotionButton
                      whileTap={{ scale: 0.93 }}
                      type="button"
                      onClick={handleWithdraw}
                      disabled={anyLoading}
                      aria-label="Confirm withdraw all consent"
                      className="px-3 py-2 rounded-xl text-[11px] font-black text-white flex items-center gap-1.5 disabled:opacity-50"
                      style={{ background: 'var(--error)' }}
                    >
                      {isWithdrawing
                        ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                        : <XCircle size={12} aria-hidden="true" />
                      }
                      Confirm
                    </MotionButton>
                    <button
                      type="button"
                      onClick={() => setShowWithdrawConfirm(false)}
                      className="px-3 py-2 rounded-xl text-[11px] font-bold border border-base-300 bg-base-200 transition-all"
                      aria-label="Cancel withdraw"
                    >
                      Cancel
                    </button>
                  </MotionDiv>
                </AnimatePresence>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}