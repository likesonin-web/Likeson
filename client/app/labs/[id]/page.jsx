"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Star,
  Clock,
  ShieldCheck,
  Truck,
  Building2,
  Phone,
  Globe,
  ChevronLeft,
  FlaskConical,
  PackageCheck,
  MessageSquare,
  CheckCircle2,
  BadgeCheck,
  Tag,
  Sparkles,
  Search,
  ChevronRight,
  Home,
} from "lucide-react";

import {
  fetchPublicLabById,
  fetchPublicLabTests,
  fetchPublicLabPackages,
  fetchPublicLabReviews,
  clearSelectedLab,
  selectSelectedLab,
  selectPublicTests,
  selectPublicPackages,
  selectPublicReviews,
  selectReviewsPagination,
  selectLabLoading,
} from "@/store/slices/labSlice";

// ─────────────────────────────────────────────────────────────────────────
//  MOTION VARIANTS
// ─────────────────────────────────────────────────────────────────────────
const STAGGER = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const ITEM = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const TABS = [
  { id: "tests", label: "Tests", icon: FlaskConical },
  { id: "packages", label: "Packages", icon: PackageCheck },
  { id: "about", label: "About", icon: Building2 },
  { id: "reviews", label: "Reviews", icon: MessageSquare },
];

// ─────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────
const formatINR = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

function EmptyTab({ icon: Icon, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
        <Icon size={24} className="text-primary" />
      </div>
      <p className="text-sm font-bold text-base-content/50">No {label} available yet.</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  SKELETON
// ─────────────────────────────────────────────────────────────────────────
function DetailSkeleton() {
  return (
    <div className="container-custom py-8 space-y-6">
      <div className="skeleton h-48 w-full rounded-2xl" />
      <div className="skeleton h-8 w-1/2 rounded-lg" />
      <div className="skeleton h-4 w-1/3 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
        <div className="skeleton h-24 rounded-xl" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  TEST ROW
// ─────────────────────────────────────────────────────────────────────────
function TestRow({ test }) {
  const price = test.discountedPrice ?? test.mrpPrice;
  const hasDiscount = test.discountedPrice && test.discountedPrice < test.mrpPrice;

  return (
    <motion.div
      variants={ITEM}
      className="flex items-center justify-between gap-3 p-4 rounded-xl border border-base-300 bg-base-100 hover:border-primary/30 transition-colors"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-sm">{test.testName}</p>
          {test.shortName && <span className="badge badge-primary badge-xs">{test.shortName}</span>}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-base-content/50">
          {test.category && <span>{test.category}</span>}
          {test.specimenRequirements?.specimenType && (
            <span className="flex items-center gap-1">
              <Tag size={10} /> {test.specimenRequirements.specimenType}
            </span>
          )}
          {test.turnaroundHours && (
            <span className="flex items-center gap-1">
              <Clock size={10} /> {test.turnaroundHours}h
            </span>
          )}
          {test.homeCollectionAvailable && (
            <span className="flex items-center gap-1 text-info">
              <Truck size={10} /> Home OK
            </span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        {hasDiscount && (
          <p className="text-xs text-base-content/40 line-through">{formatINR(test.mrpPrice)}</p>
        )}
        <p className="font-black text-sm text-primary">{formatINR(price)}</p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  PACKAGE CARD
// ─────────────────────────────────────────────────────────────────────────
function PackageCard({ pkg }) {
  return (
    <motion.div variants={ITEM} className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="badge badge-secondary badge-xs mb-1.5">{pkg.panelType}</span>
          <h4 className="font-black text-sm leading-tight">{pkg.packageName}</h4>
        </div>
        <p className="font-black text-primary text-base shrink-0">{formatINR(pkg.mrpPrice)}</p>
      </div>
      {pkg.description && (
        <p className="text-xs text-base-content/55 mt-2 line-clamp-2">{pkg.description}</p>
      )}
      {pkg.highlights?.length > 0 && (
        <ul className="mt-3 space-y-1">
          {pkg.highlights.slice(0, 4).map((h, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-base-content/65">
              <CheckCircle2 size={12} className="text-success shrink-0" /> {h}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-base-300">
        <span className="text-xs font-semibold text-base-content/40">
          {pkg.totalParameters ? `${pkg.totalParameters} parameters` : pkg.forGender}
        </span>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  REVIEW CARD
// ─────────────────────────────────────────────────────────────────────────
function ReviewCard({ review }) {
  return (
    <motion.div variants={ITEM} className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="avatar placeholder">
            <div className="w-8 h-8">
              <span>{review.user?.name?.[0]?.toUpperCase() ?? "U"}</span>
            </div>
          </div>
          <p className="font-bold text-sm">{review.user?.name ?? "Verified Patient"}</p>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={12}
              className={i < review.rating ? "text-warning fill-warning" : "text-base-300"}
            />
          ))}
        </div>
      </div>
      {review.comment && <p className="text-sm text-base-content/70">{review.comment}</p>}
      <p className="text-[10px] text-base-content/35 mt-2">
        {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────
export default function LabDetailsPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useParams();
  const labId = params?.id;

  const lab = useSelector(selectSelectedLab);
  const tests = useSelector(selectPublicTests);
  const packages = useSelector(selectPublicPackages);
  const reviews = useSelector(selectPublicReviews);
  const reviewsPagination = useSelector(selectReviewsPagination);
  const loading = useSelector(selectLabLoading);

  const [activeTab, setActiveTab] = useState("tests");
  const [testSearch, setTestSearch] = useState("");
  const [testCategory, setTestCategory] = useState("");

  useEffect(() => {
    if (!labId) return;
    dispatch(fetchPublicLabById(labId));
    dispatch(fetchPublicLabTests({ id: labId }));
    dispatch(fetchPublicLabPackages({ id: labId }));
    dispatch(fetchPublicLabReviews({ id: labId, params: { page: 1, limit: 10 } }));
    return () => dispatch(clearSelectedLab());
  }, [dispatch, labId]);

  const goToBooking = useCallback(
    (mode) => {
      if (!lab) return;
      const type = mode === "home" ? "diagnostic_home" : "diagnostic_center";
      router.push(`/book-appointment?type=${type}&lab=${lab._id}&name=${encodeURIComponent(lab.labName)}`);
    },
    [lab, router]
  );

  if (loading && !lab) return <DetailSkeleton />;

  if (!lab) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <FlaskConical size={40} className="text-base-content/20 mb-3" />
        <h2 className="font-black text-lg mb-1">Lab not found</h2>
        <p className="text-sm text-base-content/50 mb-4">This lab may be unavailable or no longer active.</p>
        <button onClick={() => router.push("/labs")} className="btn btn-primary btn-sm">
          Browse Labs
        </button>
      </div>
    );
  }

  const homeAvailable = lab.sampleCollectionMode === "Home Collection" || lab.sampleCollectionMode === "Both";
  const walkinAvailable = lab.sampleCollectionMode === "Walk-in" || lab.sampleCollectionMode === "Both";

  const testCategories = Array.from(new Set((tests || []).map((t) => t.category).filter(Boolean)));
  const filteredTests = (tests || []).filter((t) => {
    const matchesSearch = !testSearch || t.testName?.toLowerCase().includes(testSearch.toLowerCase());
    const matchesCategory = !testCategory || t.category === testCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-base-100 pb-24 sm:pb-8">
      {/* ── Back ─────────────────────────────────────────────────────── */}
      <div className="container-custom pt-4">
        <button
          onClick={() => router.push("/labs")}
          className="flex items-center gap-1 text-xs font-bold text-base-content/45 hover:text-primary transition-colors"
        >
          <ChevronLeft size={14} /> Back to Labs
        </button>
      </div>

      {/* ── Cover / Hero ─────────────────────────────────────────────── */}
      <motion.div variants={FADE_UP} initial="hidden" animate="show" className="container-custom mt-3">
        <div
          className="relative h-40 sm:h-56 w-full rounded-2xl overflow-hidden bg-primary/10"
          style={{
            backgroundImage: lab.coverImageUrl ? `url(${lab.coverImageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {!lab.coverImageUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              <FlaskConical size={48} className="text-primary/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-base-100 shadow-depth shrink-0 overflow-hidden flex items-center justify-center">
                {lab.logoUrl ? (
                  <img src={lab.logoUrl} alt={lab.labName} className="w-full h-full object-cover" />
                ) : (
                  <Building2 size={22} className="text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-white font-black text-lg sm:text-2xl leading-tight truncate">{lab.labName}</h1>
                <p className="text-white/75 text-xs sm:text-sm">{lab.labType}</p>
              </div>
            </div>
          </div>
          <div className="absolute top-3 right-3 flex gap-1.5">
            {lab.isFeatured && (
              <span className="badge badge-accent badge-sm gap-1">
                <Sparkles size={10} /> Featured
              </span>
            )}
            {lab.isVerified && (
              <span className="badge badge-success badge-sm gap-1">
                <BadgeCheck size={10} /> Verified
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Quick Stats ──────────────────────────────────────────────── */}
      <motion.div
        variants={STAGGER}
        initial="hidden"
        animate="show"
        className="container-custom mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <motion.div variants={ITEM} className="stat-card">
          <div className="flex items-center gap-1.5">
            <Star size={16} className="text-warning fill-warning" />
            <span className="stat-card-value !text-xl">{(lab.averageRating ?? 0).toFixed(1)}</span>
          </div>
          <p className="stat-card-label">{lab.totalReviews ?? 0} Reviews</p>
        </motion.div>
        <motion.div variants={ITEM} className="stat-card">
          <div className="flex items-center gap-1.5">
            <Clock size={16} className="text-primary" />
            <span className="stat-card-value !text-xl">{lab.avgTurnaroundHours ?? "—"}h</span>
          </div>
          <p className="stat-card-label">Avg. Turnaround</p>
        </motion.div>
        <motion.div variants={ITEM} className="stat-card">
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-primary" />
            <span className="font-black text-sm truncate">{lab.registeredAddress?.city ?? "—"}</span>
          </div>
          <p className="stat-card-label">Location</p>
        </motion.div>
        <motion.div variants={ITEM} className="stat-card">
          <div className="flex items-center gap-1.5">
            <Truck size={16} className="text-primary" />
            <span className="font-black text-sm">{lab.sampleCollectionMode}</span>
          </div>
          <p className="stat-card-label">Collection Mode</p>
        </motion.div>
      </motion.div>

      {/* ── Accreditations ───────────────────────────────────────────── */}
      {lab.accreditations?.length > 0 && (
        <div className="container-custom mt-4 flex flex-wrap gap-2">
          {lab.accreditations.map((a) => (
            <span key={a._id} className="badge badge-primary gap-1.5">
              <ShieldCheck size={12} /> {a.body} {a.isVerified && <CheckCircle2 size={11} className="text-success" />}
            </span>
          ))}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="container-custom mt-6 sticky top-0 z-30 bg-base-100/95 backdrop-blur-soft border-b border-base-300">
        <div className="flex gap-1 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative flex items-center gap-1.5 px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors"
                style={{ color: isActive ? "var(--primary)" : "color-mix(in oklch, var(--base-content) 55%, transparent)" }}
              >
                <Icon size={15} />
                {tab.label}
                {tab.id === "tests" && tests?.length > 0 && (
                  <span className="text-[10px] font-black opacity-60">({tests.length})</span>
                )}
                {tab.id === "packages" && packages?.length > 0 && (
                  <span className="text-[10px] font-black opacity-60">({packages.length})</span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="lab-detail-tab-underline"
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────── */}
      <div className="container-custom py-6">
        <AnimatePresence mode="wait">
          {activeTab === "tests" && (
            <motion.div key="tests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/35" />
                  <input
                    type="text"
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    placeholder="Search tests…"
                    className="input-field pl-9"
                  />
                </div>
                {testCategories.length > 0 && (
                  <select
                    value={testCategory}
                    onChange={(e) => setTestCategory(e.target.value)}
                    className="input-field sm:w-48"
                  >
                    <option value="">All Categories</option>
                    {testCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {filteredTests.length > 0 ? (
                <motion.div variants={STAGGER} initial="hidden" animate="show" className="space-y-2.5">
                  {filteredTests.map((t) => (
                    <TestRow key={t._id} test={t} />
                  ))}
                </motion.div>
              ) : (
                <EmptyTab icon={FlaskConical} label="tests" />
              )}
            </motion.div>
          )}

          {activeTab === "packages" && (
            <motion.div key="packages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {packages?.length > 0 ? (
                <motion.div
                  variants={STAGGER}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                >
                  {packages.map((p) => (
                    <PackageCard key={p._id} pkg={p} />
                  ))}
                </motion.div>
              ) : (
                <EmptyTab icon={PackageCheck} label="packages" />
              )}
            </motion.div>
          )}

          {activeTab === "about" && (
            <motion.div key="about" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6 max-w-2xl">
              {lab.description && (
                <div>
                  <h3 className="font-black text-sm mb-1.5">About {lab.labName}</h3>
                  <p className="text-sm text-base-content/65 leading-relaxed">{lab.description}</p>
                </div>
              )}

              <div>
                <h3 className="font-black text-sm mb-2">Address</h3>
                <div className="flex items-start gap-2 text-sm text-base-content/65">
                  <MapPin size={15} className="text-primary mt-0.5 shrink-0" />
                  <span>
                    {[
                      lab.registeredAddress?.line1,
                      lab.registeredAddress?.line2,
                      lab.registeredAddress?.city,
                      lab.registeredAddress?.state,
                      lab.registeredAddress?.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
              </div>

              {lab.websiteUrl && (
                <div>
                  <h3 className="font-black text-sm mb-2">Website</h3>
                  <a
                    href={lab.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary font-semibold"
                  >
                    <Globe size={15} /> {lab.websiteUrl}
                  </a>
                </div>
              )}

              {lab.contactPersons?.length > 0 && (
                <div>
                  <h3 className="font-black text-sm mb-2">Contact</h3>
                  <div className="space-y-2">
                    {lab.contactPersons.map((c) => (
                      <div key={c._id} className="flex items-center gap-2 text-sm text-base-content/65">
                        <Phone size={14} className="text-primary shrink-0" />
                        <span className="font-semibold">{c.name}</span>
                        {c.designation && <span className="text-xs text-base-content/40">({c.designation})</span>}
                        {c.phone && <span className="ml-auto font-bold">{c.phone}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lab.timing?.length > 0 && (
                <div>
                  <h3 className="font-black text-sm mb-2">Timing</h3>
                  <div className="space-y-1">
                    {lab.timing.map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-base-300 last:border-0">
                        <span className="text-base-content/60">{t.day}</span>
                        <span className="font-semibold">
                          {t.isClosed ? "Closed" : `${t.openTime} – ${t.closeTime}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {lab.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {lab.tags.map((tag) => (
                    <span key={tag} className="badge badge-secondary badge-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "reviews" && (
            <motion.div key="reviews" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {reviews?.length > 0 ? (
                <motion.div variants={STAGGER} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reviews.map((r) => (
                    <ReviewCard key={r._id} review={r} />
                  ))}
                </motion.div>
              ) : (
                <EmptyTab icon={MessageSquare} label="reviews" />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Sticky Booking Bar (mobile) / Inline (desktop) ──────────── */}
      <div className="fixed bottom-0 left-0 right-0 sm:static sm:container-custom sm:mt-2 z-40">
        <div className="bg-base-100 border-t sm:border sm:rounded-2xl border-base-300 shadow-depth-lg sm:shadow-depth p-3 sm:p-4 flex items-center gap-2 safe-bottom">
          <div className="hidden sm:block flex-1">
            <p className="font-black text-sm">Ready to book a test?</p>
            <p className="text-xs text-base-content/50">Choose walk-in or home sample collection.</p>
          </div>
          {walkinAvailable && (
            <button onClick={() => goToBooking("center")} className="btn btn-outline flex-1 sm:flex-none">
              <Building2 size={15} /> Visit Lab
            </button>
          )}
          {homeAvailable && (
            <button onClick={() => goToBooking("home")} className="btn btn-primary flex-1 sm:flex-none">
              <Home size={15} /> Home Collection <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}