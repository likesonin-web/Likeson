'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import Link                                  from 'next/link';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  FileText, ChevronDown, ChevronUp,
  Download, CheckCircle2, Clock, Scale,
  AlertCircle, ArrowLeft, ShieldAlert,
  UserCheck, Gavel, BadgeCheck, BookMarked,
} from 'lucide-react';
import Container                             from '@/components/ui/Container';
import {
  fetchActiveDocByType,
  recordConsent,
  selectActiveDocByType,
  selectConsentLoading,
  selectConsentStatus,
} from '@/store/slices/legalSlice';
import { selectToken, selectUser } from '@/store/slices/userSlice';

// ── Section icon map ───────────────────────────────────────────────────────────
const SECTION_ICONS = {
  eligibility:    UserCheck,
  age:            UserCheck,
  conduct:        ShieldAlert,
  prohibited:     ShieldAlert,
  dispute:        Gavel,
  arbitration:    Gavel,
  liability:      Scale,
  intellectual:   BookMarked,
  termination:    AlertCircle,
  default:        FileText,
};

function getSectionIcon(sectionId = '') {
  const key = Object.keys(SECTION_ICONS).find((k) => sectionId.toLowerCase().includes(k));
  return SECTION_ICONS[key] ?? SECTION_ICONS.default;
}

// ── Progress tracker (clause count) ───────────────────────────────────────────
function ReadProgress({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-xs text-base-content/50">
      <div className="progress-bar w-24">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-black">{pct}% read</span>
    </div>
  );
}

// ── Section accordion ──────────────────────────────────────────────────────────
function SectionAccordion({ section, index, onOpen }) {
  const [open, setOpen] = useState(section.isKey ?? false);
  const Icon = getSectionIcon(section.sectionId);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.055, duration: 0.32 }}
      className={`card mb-3 overflow-hidden ${section.isKey ? 'border-accent/40' : ''}`}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-accent/5 transition-colors"
      >
        {/* numbered + icon */}
        <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
          <Icon size={16} strokeWidth={2.2} />
        </span>

        <span className="flex-1 min-w-0">
          <span className="font-montserrat font-black text-sm text-base-content block leading-snug">
            {section.title}
          </span>
          {section.isKey && (
            <span className="badge badge-accent badge-xs mt-1">Important clause</span>
          )}
        </span>

        <span className="flex-shrink-0 text-base-content/40">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div
              className="px-6 pb-5 pt-1 text-sm leading-relaxed text-base-content/70 border-t border-base-300"
              dangerouslySetInnerHTML={{ __html: section.body }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Consent sticky banner ──────────────────────────────────────────────────────
function ConsentBanner({ doc, loading, onAccept }) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0,  opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-base-300 bg-base-100 shadow-depth-lg"
    >
      <div className="container-custom py-4 flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div className="flex items-start gap-3">
          <AlertCircle size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-base-content">
              Terms &amp; Conditions v{doc.currentVersion}
            </p>
            <p className="text-xs text-base-content/50 mt-0.5">
              By using Likeson, you agree to these terms. Please review before accepting.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAccept}
          disabled={loading}
          className="btn-primary-cta flex-shrink-0 flex items-center gap-2"
        >
          {loading
            ? <span className="loading loading-sm" />
            : <BadgeCheck size={15} />
          }
          I agree
        </button>
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function TermsAndConditionsPage() {
  const dispatch    = useDispatch();
  const token       = useSelector(selectToken);
  const user        = useSelector(selectUser);
  const doc         = useSelector(selectActiveDocByType('terms_and_conditions'));
  const loading     = useSelector(selectConsentLoading);
  const consentMap  = useSelector(selectConsentStatus);

  const alreadyAccepted = !!consentMap?.terms_and_conditions?.accepted;
  const [accepted,    setAccepted]    = useState(false);
  const [openedCount, setOpenedCount] = useState(0);

  const totalSections = doc?.sections?.length ?? 0;

  useEffect(() => {
    dispatch(fetchActiveDocByType({ type: 'terms_and_conditions' }));
  }, [dispatch]);

  useEffect(() => {
    setAccepted(alreadyAccepted);
  }, [alreadyAccepted]);

  const handleAccept = useCallback(async () => {
    await dispatch(recordConsent({
      documentTypes: ['terms_and_conditions'],
      method:        'click',
      platform:      'web',
    }));
    setAccepted(true);
  }, [dispatch]);

  const handleSectionOpen = useCallback(() => {
    setOpenedCount((n) => Math.min(n + 1, totalSections));
  }, [totalSections]);

  const showBanner = token && user && !accepted && !!doc;

  if (!doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <span className="loading loading-lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <Container className="py-10">
      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-base-300 bg-base-200">
        <div className="container-custom py-10">

          <Link href="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-base-content/40 hover:text-primary mb-6 transition-colors no-underline">
            <ArrowLeft size={14} />
            Back
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-accent mb-2">
                Legal Document
              </p>

              <h1 className="font-montserrat font-black text-base-content mb-3">
                {doc.title}
              </h1>

              {doc.subtitle && (
                <p className="text-base-content/60 text-sm">{doc.subtitle}</p>
              )}

              <div className="flex flex-wrap gap-3 mt-4">
                <span className="badge badge-accent">v{doc.currentVersion}</span>
                <span className="badge badge-secondary">
                  <Clock size={10} />
                  Effective {new Date(doc.effectiveDate).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })}
                </span>
                {doc.minAge && (
                  <span className="badge badge-warning">
                    <UserCheck size={10} />
                    Age {doc.minAge}+
                  </span>
                )}
                {doc.complianceStandards?.map((s) => (
                  <span key={s} className="badge badge-primary">{s}</span>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              {totalSections > 0 && (
                <ReadProgress current={openedCount} total={totalSections} />
              )}
              {doc.pdfUrl && (
                <a
                  href={doc.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm flex items-center gap-2 no-underline"
                >
                  <Download size={14} />
                  Download PDF
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className={`container-custom py-10 ${showBanner ? 'pb-32' : ''}`}>
        <div className="max-w-4xl mx-auto">

          {/* ── Summary ─────────────────────────────────────────────────────── */}
          {doc.summary && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="alert alert-info mb-8 rounded-2xl"
            >
              <FileText size={20} className="text-info flex-shrink-0" />
              <div>
                <p className="font-black text-sm text-base-content mb-1">Plain-language summary</p>
                <p className="text-sm text-base-content/70">{doc.summary}</p>
              </div>
            </motion.div>
          )}

          {/* ── Key points ──────────────────────────────────────────────────── */}
          {doc.keyPoints?.length > 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="mb-10"
            >
              <h2 className="font-montserrat font-black text-base-content text-xl mb-4">
                Key Points
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {doc.keyPoints.map((pt, i) => (
                  <li key={i} className="stat-card flex items-start gap-3">
                    <CheckCircle2 size={15} className="text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-base-content/70">{pt}</span>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}

          {/* ── T&C specifics: age + dispute ─────────────────────────────────── */}
          {(doc.minAge || doc.disputeResolution) && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mb-10"
            >
              <h2 className="font-montserrat font-black text-base-content text-xl mb-4">
                Key Conditions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {doc.minAge && (
                  <div className="card p-5 flex items-start gap-4">
                    <span className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning flex-shrink-0">
                      <UserCheck size={18} />
                    </span>
                    <div>
                      <p className="font-black text-sm text-base-content">Minimum Age</p>
                      <p className="text-xs text-base-content/60 mt-1">
                        You must be at least <strong>{doc.minAge}</strong> years old to use this platform.
                        {doc.requiresParentalConsent && ' Parental consent required for minors.'}
                      </p>
                    </div>
                  </div>
                )}
                {doc.disputeResolution && (
                  <div className="card p-5 flex items-start gap-4">
                    <span className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                      <Gavel size={18} />
                    </span>
                    <div>
                      <p className="font-black text-sm text-base-content">Dispute Resolution</p>
                      <p className="text-xs text-base-content/60 mt-1">{doc.disputeResolution}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* ── Jurisdiction ─────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="mb-10"
          >
            <div className="card p-5">
              <div className="flex items-center gap-3 mb-4">
                <Scale size={16} className="text-primary" />
                <h2 className="font-montserrat font-black text-base-content text-lg">
                  Governing Law
                </h2>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="label-text-alt uppercase tracking-widest">Governing Law</dt>
                  <dd className="text-base-content font-semibold mt-0.5">{doc.governingLaw}</dd>
                </div>
                <div>
                  <dt className="label-text-alt uppercase tracking-widest">Jurisdiction</dt>
                  <dd className="text-base-content font-semibold mt-0.5">{doc.jurisdiction}</dd>
                </div>
                {doc.legalReviewedBy && (
                  <div>
                    <dt className="label-text-alt uppercase tracking-widest">Legal Review</dt>
                    <dd className="text-base-content font-semibold mt-0.5">{doc.legalReviewedBy}</dd>
                  </div>
                )}
              </dl>
            </div>
          </motion.section>

          {/* ── Sections accordion ───────────────────────────────────────────── */}
          {doc.sections?.length > 0 && (
            <section className="mb-10">
              <h2 className="font-montserrat font-black text-base-content text-xl mb-4">
                Full Terms
              </h2>
              {doc.sections.map((s, i) => (
                <SectionAccordion
                  key={s.sectionId ?? i}
                  section={s}
                  index={i}
                  onOpen={handleSectionOpen}
                />
              ))}
            </section>
          )}

          {/* ── Accepted state ───────────────────────────────────────────────── */}
          {accepted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="alert alert-success rounded-2xl mb-10"
            >
              <BadgeCheck size={18} className="text-success flex-shrink-0" />
              <div>
                <p className="font-black text-sm text-base-content">Terms &amp; Conditions accepted</p>
                <p className="text-xs text-base-content/60 mt-0.5">
                  v{doc.currentVersion} ·{' '}
                  {consentMap?.terms_and_conditions?.effectiveDate
                    ? new Date(consentMap.terms_and_conditions.effectiveDate).toLocaleDateString('en-IN')
                    : 'Current version'}
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Not logged in notice ─────────────────────────────────────────── */}
          {!token && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="alert alert-warning rounded-2xl mb-10"
            >
              <AlertCircle size={18} className="text-warning flex-shrink-0" />
              <div>
                <p className="font-black text-sm text-base-content">Not signed in</p>
                <p className="text-xs text-base-content/60 mt-0.5">
                  <Link href="/login" className="text-primary font-semibold">Sign in</Link>
                  {' '}to record your acceptance of these terms.
                </p>
              </div>
            </motion.div>
          )}

        </div>
      </main>

      {/* ── Consent sticky banner ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showBanner && (
          <ConsentBanner doc={doc} loading={loading} onAccept={handleAccept} />
        )}
      </AnimatePresence>
      </Container>
    </div>
  );
}