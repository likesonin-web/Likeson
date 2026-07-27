'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector }          from 'react-redux';
import Link                                  from 'next/link';
import { motion, AnimatePresence }           from 'framer-motion';
import {
  ShieldCheck, ChevronDown, ChevronUp,
  Download, CheckCircle2, Clock, BookOpen,
  Globe, Database, Share2, UserCheck, AlertCircle,
  ArrowLeft, Fingerprint,
} from 'lucide-react';
import Container from '@/components/ui/Container';
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
  'data-collection':  Database,
  'data-purpose':     BookOpen,
  'data-sharing':     Share2,
  'user-rights':      UserCheck,
  'data-retention':   Clock,
  'cookies':          Fingerprint,
  'jurisdiction':     Globe,
  default:            ShieldCheck,
};

function getSectionIcon(sectionId = '') {
  const key = Object.keys(SECTION_ICONS).find((k) => sectionId.includes(k));
  return SECTION_ICONS[key] ?? SECTION_ICONS.default;
}

// ── Section accordion ──────────────────────────────────────────────────────────
function SectionAccordion({ section, index }) {
  const [open, setOpen] = useState(section.isKey ?? false);
  const Icon = getSectionIcon(section.sectionId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      className={`card mb-3 overflow-hidden ${section.isKey ? 'border-primary/30' : ''}`}
    >
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-primary/5 transition-colors"
      >
        {/* Icon badge */}
        <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Icon size={16} strokeWidth={2.2} />
        </span>

        <span className="flex-1 min-w-0">
          <span className="font-montserrat font-black text-[16px] text-base-content block">
            {section.title}
          </span>
          {section.isKey && (
            <span className="badge badge-primary badge-xs mt-1">Key clause</span>
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
              className="px-6 pb-5 pt-1 text-xs leading-relaxed text-base-content/70 border-t border-base-300"
              dangerouslySetInnerHTML={{ __html: section.body }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Consent banner (bottom sticky) ────────────────────────────────────────────
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
          <p className="text-xs text-base-content/70">
            You haven&apos;t accepted the{' '}
            <span className="font-black text-base-content">Privacy Policy</span>{' '}
            v{doc.currentVersion} yet.
          </p>
        </div>
        <button
          type="button"
          onClick={onAccept}
          disabled={loading}
          className="btn-primary-cta flex-shrink-0 flex items-center gap-2"
        >
          {loading
            ? <span className="loading loading-sm" />
            : <CheckCircle2 size={15} />
          }
          I accept
        </button>
      </div>
    </motion.div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function PrivacyPolicyPage() {
  const dispatch    = useDispatch();
  const token       = useSelector(selectToken);
  const user        = useSelector(selectUser);
  const doc         = useSelector(selectActiveDocByType('privacy_policy'));
  const loading     = useSelector(selectConsentLoading);
  const consentMap  = useSelector(selectConsentStatus);

  // Has user already accepted current version?
  const alreadyAccepted = !!consentMap?.privacy_policy?.accepted;
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    dispatch(fetchActiveDocByType({ type: 'privacy_policy' }));
  }, [dispatch]);

  useEffect(() => {
    setAccepted(alreadyAccepted);
  }, [alreadyAccepted]);

  const handleAccept = useCallback(async () => {
    await dispatch(recordConsent({
      documentTypes: ['privacy_policy'],
      method:        'click',
      platform:      'web',
    }));
    setAccepted(true);
  }, [dispatch]);

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

          {/* Back */}
          <Link href="/" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-base-content/40 hover:text-primary mb-6 transition-colors no-underline">
            <ArrowLeft size={14} />
            Back
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              {/* Eyebrow */}
              <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
                Legal Document
              </p>

              <h1 className="font-montserrat font-black text-base-content mb-3">
                {doc.title}
              </h1>

              {doc.subtitle && (
                <p className="text-base-content/60 text-xs">{doc.subtitle}</p>
              )}

              {/* Meta row */}
              <div className="flex flex-wrap gap-3 mt-4">
                <span className="badge badge-primary">v{doc.currentVersion}</span>
                <span className="badge badge-secondary">
                  <Clock size={10} />
                  Effective {new Date(doc.effectiveDate).toLocaleDateString('en-IN', { year:'numeric', month:'short', day:'numeric' })}
                </span>
                {doc.complianceStandards?.map((s) => (
                  <span key={s} className="badge badge-accent">{s}</span>
                ))}
              </div>
            </div>

            {/* Download PDF */}
            {doc.pdfUrl && (
              <a
                href={doc.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm flex items-center gap-2 self-start md:self-end no-underline"
              >
                <Download size={14} />
                Download PDF
              </a>
            )}
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
              <ShieldCheck size={20} className="text-info flex-shrink-0" />
              <div>
                <p className="font-black text-xs text-base-content mb-1">Plain-language summary</p>
                <p className="text-xs text-base-content/70">{doc.summary}</p>
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
                    <CheckCircle2 size={15} className="text-success flex-shrink-0 mt-0.5" />
                    <span className="text-xs text-base-content/70">{pt}</span>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}

          {/* ── Data collected grid ──────────────────────────────────────────── */}
          {doc.dataCollected && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="mb-10"
            >
              <h2 className="font-montserrat font-black text-base-content text-xl mb-4">
                Data We Collect
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {doc.dataCollected.personalData?.length > 0 && (
                  <div className="card p-4">
                    <p className="badge badge-primary mb-3">Personal</p>
                    <ul className="space-y-1">
                      {doc.dataCollected.personalData.map((d) => (
                        <li key={d} className="text-[10px] text-base-content/60 flex items-center gap-2">
                          <span className="status-dot status-dot-info" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {doc.dataCollected.sensitiveData?.length > 0 && (
                  <div className="card p-4">
                    <p className="badge badge-error mb-3">Sensitive</p>
                    <ul className="space-y-1">
                      {doc.dataCollected.sensitiveData.map((d) => (
                        <li key={d} className="text-[10px] text-base-content/60 flex items-center gap-2">
                          <span className="status-dot status-dot-error" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {doc.dataCollected.financialData?.length > 0 && (
                  <div className="card p-4">
                    <p className="badge badge-warning mb-3">Financial</p>
                    <ul className="space-y-1">
                      {doc.dataCollected.financialData.map((d) => (
                        <li key={d} className="text-[10px] text-base-content/60 flex items-center gap-2">
                          <span className="status-dot status-dot-warning" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Boolean flags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { label: 'Location data',  val: doc.dataCollected.locationData  },
                  { label: 'Device data',    val: doc.dataCollected.deviceData    },
                  { label: 'Biometric data', val: doc.dataCollected.biometricData },
                  { label: 'Cookies',        val: doc.dataCollected.cookies       },
                ].map(({ label, val }) => (
                  <span
                    key={label}
                    className={`badge ${val ? 'badge-success' : 'badge-secondary'}`}
                  >
                    {val ? <CheckCircle2 size={10} /> : null}
                    {label}: {val ? 'Yes' : 'No'}
                  </span>
                ))}
              </div>
            </motion.section>
          )}

          {/* ── User rights ──────────────────────────────────────────────────── */}
          {doc.userRights?.length > 0 && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-10"
            >
              <h2 className="font-montserrat font-black text-base-content text-xl mb-4">
                Your Rights
              </h2>
              <div className="flex flex-wrap gap-2">
                {doc.userRights.map((r) => (
                  <span key={r} className="badge badge-accent capitalize">
                    <UserCheck size={10} />
                    {r}
                  </span>
                ))}
              </div>
            </motion.section>
          )}

          {/* ── Sections accordion ───────────────────────────────────────────── */}
          {doc.sections?.length > 0 && (
            <section className="mb-10">
              <h2 className="font-montserrat font-black text-base-content text-xl mb-4">
                Full Policy
              </h2>
              {doc.sections.map((s, i) => (
                <SectionAccordion key={s.sectionId ?? i} section={s} index={i} />
              ))}
            </section>
          )}

          {/* ── Jurisdiction + DPO ───────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="card p-6 mb-10"
          >
            <h2 className="font-montserrat font-black text-base-content text-lg  mb-4 flex items-center gap-2">
              <Globe size={16} className="text-primary" />
              Jurisdiction &amp; Contact
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="label-text-alt uppercase tracking-widest">Governing Law</dt>
                <dd className="text-base-content font-semibold mt-0.5">{doc.governingLaw}</dd>
              </div>
              <div>
                <dt className="label-text-alt uppercase tracking-widest">Jurisdiction</dt>
                <dd className="text-base-content font-semibold mt-0.5">{doc.jurisdiction}</dd>
              </div>
              {doc.dataRetention && (
                <div>
                  <dt className="label-text-alt uppercase tracking-widest">Data Retention</dt>
                  <dd className="text-base-content font-semibold mt-0.5">{doc.dataRetention}</dd>
                </div>
              )}
              {doc.dataProtectionOfficer?.email && (
                <div>
                  <dt className="label-text-alt uppercase tracking-widest">DPO Contact</dt>
                  <dd className="mt-0.5">
                    <a href={`mailto:${doc.dataProtectionOfficer.email}`} className="text-primary font-semibold">
                      {doc.dataProtectionOfficer.email}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </motion.section>

          {/* ── Already accepted state ──────────────────────────────────────── */}
          {accepted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="alert alert-success rounded-2xl mb-10"
            >
              <CheckCircle2 size={18} className="text-success flex-shrink-0" />
              <div>
                <p className="font-black text-xs text-base-content">Privacy Policy accepted</p>
                <p className="text-[10px] text-base-content/60 mt-0.5">
                  v{doc.currentVersion} ·{' '}
                  {consentMap?.privacy_policy?.effectiveDate
                    ? new Date(consentMap.privacy_policy.effectiveDate).toLocaleDateString('en-IN')
                    : 'Current version'}
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