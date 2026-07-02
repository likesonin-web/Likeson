"use client";

import { useEffect, useState, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Star, MapPin, Clock, Home, Shield, Phone,
  Mail, ExternalLink, Share2, MessageSquare, Users, Activity,
  TestTube, Calendar, Navigation, Sparkles, Package, Award,
  CheckCircle, Search, FileText, AlertCircle, Loader2, Microscope
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  fetchPublicLabById,
  fetchPublicLabTests,
  fetchPublicLabPackages,
  fetchPublicLabReviews,
  selectSelectedLab,
  selectPublicTests,
  selectPublicPackages,
  selectPublicReviews,
  selectReviewsPagination,
  selectLabLoading,
} from "@/store/slices/labSlice";
import Container from "@/components/ui/Container";

// ─── Animated Creature: MicroBot (The Cellular Analyst) ──────────────────────

const MicroBot = () => (
  <div className="relative w-40 h-40 z-10 pointer-events-none select-none mx-auto" aria-hidden="true">
    {/* Ambient Glow */}
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      className="absolute inset-0 m-auto w-24 h-24 rounded-full bg-primary/30 blur-2xl"
    />

    <motion.div
      animate={{ y: [-5, 5, -5] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="w-full h-full relative"
    >
      <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
        {/* Floating Cellular Samples */}
        <motion.circle cx="140" cy="60" r="4" fill="var(--accent)" animate={{ y: [0, -10, 0], opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
        <motion.circle cx="160" cy="90" r="3" fill="var(--secondary)" animate={{ y: [0, -15, 0], opacity: [0, 1, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5, ease: "easeInOut" }} />
        <motion.circle cx="150" cy="120" r="5" fill="var(--primary)" animate={{ y: [0, -8, 0], opacity: [0, 1, 0] }} transition={{ duration: 3, repeat: Infinity, delay: 1, ease: "easeInOut" }} />

        {/* Scan Beam */}
        <motion.path
          d="M95 110 L130 180 L170 180 Z" fill="url(#micro-beam)"
          animate={{ opacity: [0, 0.7, 0], scaleX: [0.9, 1.1, 0.9] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: '95px 110px' }}
        />

        {/* Robot Arm / Stand */}
        <path d="M50 160 Q 50 80, 100 80" stroke="var(--base-300)" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="50" cy="160" r="10" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="4" />
        <path d="M30 170 h40" stroke="var(--base-300)" strokeWidth="6" strokeLinecap="round" />

        {/* Main Lens Housing */}
        <motion.g
          animate={{ rotate: [-2, 2, -2] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: '100px 80px' }}
        >
          <rect x="70" y="60" width="50" height="60" rx="15" fill="var(--base-100)" stroke="var(--base-300)" strokeWidth="4" />
          {/* Microscope Eyepiece */}
          <path d="M85 60 L80 40 L95 40 L95 60 Z" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="3" strokeLinejoin="round" />
          <path d="M75 40 h25" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" />
          
          {/* Main Objective Lens */}
          <path d="M85 120 L90 135 L100 135 L105 120 Z" fill="var(--neutral)" stroke="var(--base-300)" strokeWidth="3" strokeLinejoin="round" />
          <circle cx="95" cy="135" r="4" fill="var(--primary)" />

          {/* Electronic Eye / Display */}
          <rect x="80" y="75" width="30" height="20" rx="6" fill="var(--neutral)" />
          <motion.g animate={{ x: [-2, 2, -2] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
            <circle cx="95" cy="85" r="4" fill="var(--primary)" />
            <circle cx="95" cy="85" r="1.5" fill="white" />
          </motion.g>
        </motion.g>

        <defs>
          <linearGradient id="micro-beam" x1="95" y1="110" x2="150" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  </div>
);

// ─── Utility ──────────────────────────────────────────────────────────────────

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const StarRow = memo(({ rating = 0, total = 0, size = 13 }) => (
  <div className="flex items-center gap-1.5" aria-label={`Rating: ${rating.toFixed(1)} out of 5 stars`}>
    <div className="flex" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size}
          className={i <= Math.round(rating)
            ? "fill-[var(--warning)] text-[var(--warning)] drop-shadow-sm"
            : "fill-[var(--base-300)] text-[var(--base-300)]"}
        />
      ))}
    </div>
    <span className="font-poppins text-[10px] font-bold text-[var(--base-content)]">{rating?.toFixed(1)}</span>
    {total > 0 && <span className="font-poppins text-[10px] font-medium text-[var(--base-content)]/50">({total} reviews)</span>}
  </div>
));
StarRow.displayName = "StarRow";

const InfoChip = memo(({ icon: Icon, label, value, accent }) => (
  <div className={`flex items-start gap-3 p-3.5 rounded-[var(--r-field)] border transition-all duration-300 hover:shadow-sm ${
    accent
      ? "bg-gradient-to-br from-[var(--primary)]/10 to-[var(--primary)]/5 border-[var(--primary)]/20 hover:border-[var(--primary)]/40"
      : "bg-[var(--base-200)] border-[var(--base-300)] hover:border-[var(--base-content)]/20"
  }`}>
    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${accent ? "bg-[var(--primary)]/15 text-[var(--primary)]" : "bg-[var(--base-100)] text-[var(--base-content)]/60 shadow-sm"}`}>
      <Icon size={14} aria-hidden="true" />
    </div>
    <div>
      <p className="font-poppins text-[9px] text-[var(--base-content)]/50 uppercase tracking-widest font-black mb-0.5">{label}</p>
      <p className="font-poppins text-[10px] font-bold text-[var(--base-content)] leading-tight">{value || "—"}</p>
    </div>
  </div>
));
InfoChip.displayName = "InfoChip";

const SectionTitle = memo(({ icon: Icon, title, count }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-9 h-9 rounded-[var(--r-field)] bg-[var(--primary)]/10 flex items-center justify-center border border-[var(--primary)]/20">
      <Icon size={16} className="text-[var(--primary)]" aria-hidden="true" />
    </div>
    <h2 className="font-montserrat text-sm md:text-lg text-[var(--base-content)]">{title}</h2>
    {count != null && (
      <span className="ml-auto bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
        {count}
      </span>
    )}
  </div>
));
SectionTitle.displayName = "SectionTitle";

// ─── Test Card ────────────────────────────────────────────────────────────────

const TestCard = memo(({ test }) => {
  const isDiscounted = test.discountedPrice && test.discountedPrice < test.mrpPrice;
  const discountPct = isDiscounted ? Math.round(((test.mrpPrice - test.discountedPrice) / test.mrpPrice) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="group p-5 rounded-[var(--r-box)] border border-[var(--base-300)] bg-[var(--base-100)] hover:border-[var(--primary)]/40 hover:shadow-[0_8px_24px_-6px_color-mix(in_srgb,var(--primary),transparent_85%)] transition-all duration-300 flex flex-col h-full justify-between"
    >
      <div>
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="font-montserrat font-black text-xs text-[var(--base-content)] group-hover:text-[var(--primary)] transition-colors line-clamp-2">
            {test.testName}
          </h3>
          <div className="text-right shrink-0">
            {isDiscounted && <p className="font-poppins text-[10px] line-through text-[var(--base-content)]/40 mb-0.5">{formatCurrency(test.mrpPrice)}</p>}
            <p className="font-montserrat font-black text-base text-[var(--primary)]">
              {formatCurrency(test.discountedPrice ?? test.mrpPrice)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {test.category && <span className="font-poppins text-[9px] font-bold uppercase tracking-wider text-[var(--base-content)]/60 bg-[var(--base-200)] px-2.5 py-1 rounded-full">{test.category}</span>}
          {test.sampleType && <span className="font-poppins text-[9px] font-bold uppercase tracking-wider text-[var(--base-content)]/60 bg-[var(--base-200)] px-2.5 py-1 rounded-full flex items-center gap-1.5"><TestTube size={10} aria-hidden="true"/> {test.sampleType}</span>}
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--base-200)] flex items-center justify-between mt-auto">
        <div className="flex flex-col gap-1">
          {test.homeCollectionAvailable && (
            <span className="font-poppins text-[10px] font-bold text-[var(--success)] flex items-center gap-1.5 uppercase tracking-wider">
              <Home size={10} aria-hidden="true"/> Home Collection
            </span>
          )}
          {test.turnaroundHours && (
            <span className="font-poppins text-[10px] font-bold text-[var(--warning)] flex items-center gap-1.5 uppercase tracking-wider">
              <Clock size={10} aria-hidden="true"/> {test.turnaroundHours}h TAT
            </span>
          )}
        </div>
        {isDiscounted && <span className="font-poppins text-[10px] font-black bg-[var(--success)]/15 text-[var(--success)] px-2 py-1 rounded-[var(--r-selector)]">{discountPct}% OFF</span>}
      </div>
    </motion.div>
  );
});
TestCard.displayName = "TestCard";

// ─── Package Card ─────────────────────────────────────────────────────────────

const PackageCard = memo(({ pkg }) => {
  const isDiscounted = pkg.discountedPrice && pkg.discountedPrice < pkg.mrpPrice;
  const discountPct = isDiscounted ? Math.round(((pkg.mrpPrice - pkg.discountedPrice) / pkg.mrpPrice) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="group p-5 rounded-[var(--r-box)] border border-[var(--primary)]/20 bg-gradient-to-br from-[var(--primary)]/5 via-[var(--base-100)] to-[var(--secondary)]/5 hover:border-[var(--primary)]/50 hover:shadow-[0_12px_32px_-6px_color-mix(in_srgb,var(--primary),transparent_80%)] transition-all duration-300 flex flex-col h-full"
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-6 h-6 rounded-full bg-[var(--accent)]/15 flex items-center justify-center text-[var(--accent)]">
              <Package size={12} aria-hidden="true"/>
            </div>
            <p className="font-poppins text-[9px] font-black text-[var(--accent)] uppercase tracking-widest">Health Package</p>
          </div>
          <h3 className="font-montserrat font-black text-xs text-[var(--base-content)] group-hover:text-[var(--primary)] transition-colors line-clamp-2">
            {pkg.packageName}
          </h3>
        </div>
        <div className="text-right shrink-0">
          {isDiscounted && <p className="font-poppins text-[10px] line-through text-[var(--base-content)]/40 mb-0.5">{formatCurrency(pkg.mrpPrice)}</p>}
          <p className="font-montserrat font-black text-lg text-[var(--primary)]">
            {formatCurrency(pkg.discountedPrice ?? pkg.mrpPrice)}
          </p>
        </div>
      </div>

      {pkg.description && <p className="font-poppins text-[10px] text-[var(--base-content)]/60 leading-relaxed line-clamp-2 mb-4">{pkg.description}</p>}

      <div className="mt-auto pt-4 border-t border-[var(--primary)]/10 flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          {pkg.tests?.length > 0 && (
            <span className="font-poppins text-[10px] font-bold text-[var(--base-content)]/70 flex items-center gap-1.5 uppercase tracking-wider">
              <TestTube size={12} className="text-[var(--primary)]" aria-hidden="true"/> {pkg.tests.length} tests included
            </span>
          )}
          {pkg.validUntil && (
            <span className="font-poppins text-[10px] font-bold text-[var(--warning)] flex items-center gap-1.5 uppercase tracking-wider">
              <Calendar size={12} aria-hidden="true"/> Valid till {new Date(pkg.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        {isDiscounted && <span className="font-poppins text-[10px] font-black bg-[var(--success)]/15 text-[var(--success)] px-2 py-1 rounded-[var(--r-selector)]">SAVE {discountPct}%</span>}
      </div>
    </motion.div>
  );
});
PackageCard.displayName = "PackageCard";

// ─── Review Card ──────────────────────────────────────────────────────────────

const ReviewCard = memo(({ review, index }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}
    className="p-5 rounded-[var(--r-box)] border border-[var(--base-300)] bg-[var(--base-100)] hover:shadow-sm transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center text-white text-xs font-black shadow-inner">
          {review.user?.name?.[0]?.toUpperCase() ?? "U"}
        </div>
        <div>
          <p className="font-montserrat text-xs font-black text-[var(--base-content)]">{review.user?.name ?? "Anonymous"}</p>
          <p className="font-poppins text-[10px] font-medium text-[var(--base-content)]/50 mt-0.5">{new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
      </div>
      <StarRow rating={review.rating} size={13} />
    </div>
    {review.comment && <p className="font-poppins text-[10px] text-[var(--base-content)]/70 leading-relaxed mt-2 p-3 bg-[var(--base-200)]/50 rounded-[var(--r-field)] italic">"{review.comment}"</p>}
  </motion.div>
));
ReviewCard.displayName = "ReviewCard";

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = ["overview", "tests", "packages", "reviews"];
const TAB_LABELS = { overview: "Overview", tests: "Tests", packages: "Packages", reviews: "Reviews" };
const TAB_ICONS  = { overview: Activity, tests: TestTube, packages: Package, reviews: MessageSquare };

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LabDetailPage() {
  const { id }  = useParams();
  const router  = useRouter();
  const dispatch = useDispatch();

  const lab        = useSelector(selectSelectedLab);
  const tests      = useSelector(selectPublicTests);
  const packages   = useSelector(selectPublicPackages);
  const reviews    = useSelector(selectPublicReviews);
  const reviewPag  = useSelector(selectReviewsPagination);
  const loading    = useSelector(selectLabLoading);
  const user       = useSelector((s) => s.user?.user) ?? null;
  const isCustomer = user?.role === "customer";

  const [activeTab, setActiveTab] = useState("overview");
  const [testSearch, setTestSearch] = useState("");
  const [reviewPage, setReviewPage] = useState(1);

  useEffect(() => {
    if (!id) return;
    dispatch(fetchPublicLabById(id));
    dispatch(fetchPublicLabTests({ id, params: {} }));
    dispatch(fetchPublicLabPackages({ id, params: {} }));
    dispatch(fetchPublicLabReviews({ id, params: { page: 1, limit: 10 } }));
  }, [dispatch, id]);

  useEffect(() => {
    if (id && activeTab === "reviews") {
      dispatch(fetchPublicLabReviews({ id, params: { page: reviewPage, limit: 10 } }));
    }
  }, [dispatch, id, reviewPage, activeTab]);

  const filteredTests  = tests.filter((t) => t.isActive && (!testSearch || t.testName.toLowerCase().includes(testSearch.toLowerCase())));
  const activePackages = packages.filter((p) => p.isActive);

  // Loading State
  if (loading && !lab) return (
    <div data-theme="lab" className="min-h-screen flex flex-col items-center justify-center bg-[var(--base-100)]">
      <MicroBot />
      <div className="flex items-center gap-3 mt-4">
        <Loader2 size={18} className="animate-spin text-[var(--primary)]" aria-hidden="true" />
        <p className="font-poppins text-xs font-bold text-[var(--base-content)]/60 uppercase tracking-widest">Analyzing Lab Data…</p>
      </div>
    </div>
  );

  // Error/Not Found State
  if (!lab) return (
    <div data-theme="lab" className="min-h-screen flex flex-col items-center justify-center bg-[var(--base-100)] p-4">
      <div className="w-20 h-20 rounded-[var(--r-box)] bg-[var(--error)]/10 flex items-center justify-center mb-6">
        <AlertCircle size={40} className="text-[var(--error)]" aria-hidden="true" />
      </div>
      <h1 className="font-montserrat font-black text-2xl text-[var(--base-content)] mb-2">Facility Not Found</h1>
      <p className="font-poppins text-xs text-[var(--base-content)]/60 text-center max-w-sm mb-8">
        The laboratory you are looking for might have been removed or the link is invalid.
      </p>
      <button onClick={() => router.back()} className="btn-secondary text-[10px] px-8 py-3 uppercase tracking-wider font-bold">
        Return to Directory
      </button>
    </div>
  );

  return (
   <Container className=''>

     <div data-theme="lab" className="min-h-screen bg-[var(--base-100)] pb-20 selection:bg-[var(--primary)]/20 selection:text-[var(--primary)]">
      
      {/* ─── Cover Section ─── */}
      <div className="relative h-64 md:h-80 lg:h-96 w-full overflow-hidden">
        {lab.coverImageUrl ? (
          <img src={lab.coverImageUrl} alt={`${lab.labName} facility`} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[var(--primary)]/10 via-[var(--base-100)] to-[var(--secondary)]/10 relative overflow-hidden flex items-center justify-center">
            {/* Abstract Background pattern */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 2L56 17v26L30 58 4 43V17z' fill='none' stroke='%23000' stroke-width='1'/%3E%3C/svg%3E")`, backgroundSize: "60px 60px" }} aria-hidden="true" />
            <FlaskConical size={80} className="text-[var(--primary)]/20 relative z-10" aria-hidden="true" />
          </div>
        )}
        {/* Soft Bottom Fade */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[var(--base-100)] via-[var(--base-100)]/60 to-transparent" />
        
        {/* Top Controls */}
        <Container className="absolute top-4 left-0 right-0 z-20 flex justify-between items-center">
          <button onClick={() => router.back()} aria-label="Go back"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--base-100)]/80 backdrop-blur-md font-poppins text-[10px] font-black text-[var(--base-content)] hover:bg-[var(--base-100)] transition-colors border border-[var(--base-300)] shadow-sm">
            <ArrowLeft size={14} aria-hidden="true"/> Back
          </button>
          <button aria-label="Share laboratory"
            className="w-10 h-10 rounded-full bg-[var(--base-100)]/80 backdrop-blur-md flex items-center justify-center border border-[var(--base-300)] hover:bg-[var(--base-100)] transition-colors shadow-sm">
            <Share2 size={14} className="text-[var(--base-content)]/70" aria-hidden="true"/>
          </button>
        </Container>
      </div>
 
        {/* ─── Header Profile Card ─── */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}}
          className="bg-[var(--base-100)] border border-[var(--base-300)] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.08)] rounded-[var(--r-box)] p-3 md:p-8 -mt-20 md:-mt-28 relative">
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-3 text-center md:text-left">
            {/* Logo Avatar overlapping cover */}
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl md:rounded-[var(--r-box)] overflow-hidden border-4 border-[var(--base-100)] bg-[var(--base-200)] flex items-center justify-center flex-shrink-0 shadow-lg -mt-16 md:-mt-20 relative z-30">
              {lab.logoUrl ? (
                <img src={lab.logoUrl} alt={`${lab.labName} logo`} className="w-full h-full object-cover"/>
              ) : (
                <Microscope size={40} className="text-[var(--primary)]" aria-hidden="true"/>
              )}
            </div>

            <div className="flex-1 w-full">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex flex-col md:flex-row items-center md:items-center gap-3 mb-2">
                    <h1 className="font-montserrat font-black text-2xl md:text-3xl lg:text-4xl text-[var(--base-content)] leading-tight tracking-tight">
                      {lab.labName}
                    </h1>
                    <div className="flex items-center gap-2">
                      {lab.isVerified && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--r-selector)] bg-[var(--success)]/15 text-[var(--success)] text-[10px] font-black border border-[var(--success)]/30 uppercase tracking-widest shadow-sm">
                          <Shield size={10} aria-hidden="true"/> NABL Verified
                        </span>
                      )}
                      {lab.isFeatured && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--r-selector)] bg-[var(--accent)]/15 text-[var(--accent)] text-[10px] font-black border border-[var(--accent)]/30 uppercase tracking-widest shadow-sm">
                          <Sparkles size={10} aria-hidden="true"/> Featured
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="font-poppins text-[10px] font-bold text-[var(--base-content)]/50 uppercase tracking-widest">
                    {lab.labType} <span className="opacity-40 px-1">•</span> {lab.ownershipType}
                    {lab.labCode && <span className="opacity-40 px-1">•</span>}
                    {lab.labCode && <span className="font-mono">{lab.labCode}</span>}
                  </p>
                </div>

                {/* Status Indicator */}
                <div className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-[10px] font-black border ${
                  lab.isActive
                    ? "bg-[color-mix(in_srgb,var(--success),transparent_90%)] text-[var(--success)] border-[color-mix(in_srgb,var(--success),transparent_70%)]"
                    : "bg-[color-mix(in_srgb,var(--error),transparent_90%)] text-[var(--error)] border-[color-mix(in_srgb,var(--error),transparent_70%)]"
                }`}>
                  <div className={`w-2 h-2 rounded-full ${lab.isActive ? "bg-[var(--success)] animate-pulse" : "bg-[var(--error)]"}`} aria-hidden="true"/>
                  {lab.isActive ? "Accepting Patients" : "Temporarily Closed"}
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-4 md:gap-3 mt-5 md:mt-3 justify-center md:justify-start">
                <StarRow rating={lab.averageRating} total={lab.totalReviews} size={16} />
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--base-300)] hidden md:block" aria-hidden="true" />
                <div className="flex items-center gap-1.5 text-[10px] font-medium font-poppins text-[var(--base-content)]/60">
                  <MapPin size={14} className="text-[var(--error)]" aria-hidden="true"/>
                  {lab.registeredAddress?.city}, {lab.registeredAddress?.state}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-8 border-t border-[var(--base-200)]">
            <InfoChip icon={Activity} label="Sample Collection" value={lab.sampleCollectionMode} accent />
            {(lab.homeCollectionRadius ?? 0) > 0 && <InfoChip icon={Home} label="Service Area" value={`Up to ${lab.homeCollectionRadius} km radius`} accent />}
            {lab.avgTurnaroundHours && <InfoChip icon={Clock} label="Average TAT" value={`${lab.avgTurnaroundHours} Hours`} />}
            {(lab.homeCollectionFee ?? 0) > 0 && <InfoChip icon={Navigation} label="Home Visit Fee" value={formatCurrency(lab.homeCollectionFee)} />}
          </div>

          {/* Customer Action Bar */}
          {isCustomer && (
            <div className="flex flex-col sm:flex-row gap-4 mt-6 pt-6 border-t border-[var(--base-200)]">
              <button onClick={() => setActiveTab("tests")} className="btn-primary-cta w-full sm:flex-1 py-4 text-[10px] flex items-center justify-center gap-2">
                <TestTube size={14} aria-hidden="true"/> Book a Test
              </button>
              <button onClick={() => setActiveTab("packages")} className="btn-secondary w-full sm:flex-1 py-4 text-[10px] flex items-center justify-center gap-2">
                <Package size={14} aria-hidden="true"/> View Health Packages
              </button>
            </div>
          )}
        </motion.div>

        {/* ─── Sticky Tab Navigation ─── */}
        <div className="sticky top-0 sm:top-4 z-40 mt-8 mb-6">
          <div className="bg-[var(--base-100)]/80 backdrop-blur-xl border border-[var(--base-300)] rounded-full p-1.5 shadow-sm overflow-x-auto scrollbar-none flex items-center">
            {TABS.map((tab) => {
              const Icon = TAB_ICONS[tab];
              const active = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white rounded-full ${
                    active ? "text-[var(--primary-content)]" : "text-[var(--base-content)]/60 hover:text-[var(--base-content)]"
                  }`}>
                  {active && <motion.div layoutId="activeTabPill" className="absolute inset-0 bg-[var(--primary)] rounded-full z-0" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={14} aria-hidden="true"/>
                    {TAB_LABELS[tab]}
                    {tab === "tests"    && filteredTests.length > 0    && <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${active ? "bg-white/20" : "bg-[var(--primary)]/10 text-[var(--primary)]"}`}>{filteredTests.length}</span>}
                    {tab === "packages" && activePackages.length > 0   && <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${active ? "bg-white/20" : "bg-[var(--primary)]/10 text-[var(--primary)]"}`}>{activePackages.length}</span>}
                    {tab === "reviews"  && lab.totalReviews > 0        && <span className={`ml-1 px-2 py-0.5 rounded-full text-[9px] ${active ? "bg-white/20" : "bg-[var(--primary)]/10 text-[var(--primary)]"}`}>{lab.totalReviews}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Dynamic Tab Content ─── */}
        <AnimatePresence mode="wait">

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <motion.div key="ov" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.3}} className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              
              <div className="lg:col-span-2 space-y-6">
                {lab.description && (
                  <section className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-3 shadow-sm">
                    <SectionTitle icon={FileText} title="About the Laboratory"/>
                    <p className="font-poppins text-xs text-[var(--base-content)]/70 leading-relaxed">{lab.description}</p>
                  </section>
                )}

                {lab.accreditations?.length > 0 && (
                  <section className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-3 shadow-sm">
                    <SectionTitle icon={Award} title="Accreditations & Certifications" count={lab.accreditations.length}/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {lab.accreditations.map((acc) => (
                        <div key={acc._id} className="flex items-center gap-3 p-2 rounded-[var(--r-field)] border-2 border-[var(--success)]/20 bg-[var(--success)]/5">
                          <div className="w-10 h-10 rounded-full bg-[var(--success)]/15 flex items-center justify-center text-[var(--success)] shrink-0">
                            <Award size={18} aria-hidden="true"/>
                          </div>
                          <div>
                            <p className="font-montserrat font-black text-xs text-[var(--success)]">{acc.body}</p>
                            {acc.isVerified && <p className="font-poppins text-[10px] font-bold text-[var(--success)]/70 flex items-center gap-1 mt-0.5 uppercase tracking-wider"><CheckCircle size={10} aria-hidden="true"/> Verified Record</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {lab.timing?.length > 0 && (
                  <section className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-3 shadow-sm">
                    <SectionTitle icon={Clock} title="Operating Hours"/>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {lab.timing.map((t) => (
                        <div key={t.day} className={`flex items-center justify-between p-3.5 rounded-[var(--r-field)] text-[10px] font-poppins border ${
                          t.isClosed
                            ? "bg-[var(--error)]/5 border-[var(--error)]/20 text-[var(--error)]"
                            : "bg-[var(--base-200)] border-[var(--base-300)] text-[var(--base-content)]"
                        }`}>
                          <span className="font-black uppercase tracking-widest">{t.day.slice(0,3)}</span>
                          <span className={t.isClosed ? "font-bold uppercase tracking-widest text-[10px]" : "font-medium text-[var(--base-content)]/60"}>
                            {t.isClosed ? "Closed" : `${t.openTime} – ${t.closeTime}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                {/* Location */}
                <aside className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-3 shadow-sm">
                  <SectionTitle icon={MapPin} title="Location Details"/>
                  <address className="not-italic space-y-1.5 font-poppins text-[10px] font-medium text-[var(--base-content)]/70">
                    <p className="text-xs  text-[var(--base-content)] mb-2">{lab.registeredAddress?.line1}</p>
                    {lab.registeredAddress?.line2 && <p className="text-xs">{lab.registeredAddress.line2}</p>}
                    <p className="text-xs">{lab.registeredAddress?.city}, {lab.registeredAddress?.district}</p>
                    <p className="text-xs">{lab.registeredAddress?.state} – <span className="font-mono font-bold text-[var(--base-content)]">{lab.registeredAddress?.pincode}</span></p>
                  </address>
                  {lab.registeredAddress?.location?.coordinates?.[0] !== 0 && (
                    <a href={`https://maps.google.com/?q=$${lab.registeredAddress.location.coordinates[1]},${lab.registeredAddress.location.coordinates[0]}`}
                      target="_blank" rel="noopener noreferrer"
                      className="mt-5 flex items-center justify-center gap-2 w-full py-3 rounded-[var(--r-field)] bg-[var(--base-200)] text-[10px] font-black uppercase tracking-wider text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors">
                      <ExternalLink size={14} aria-hidden="true"/> Open in Google Maps
                    </a>
                  )}
                </aside>

                {/* Contact */}
                {lab.contactPersons?.length > 0 && (
                  <aside className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-3 shadow-sm">
                    <SectionTitle icon={Users} title="Contact Information"/>
                    <div className="space-y-5">
                      {lab.contactPersons.map((cp) => (
                        <div key={cp._id} className="font-poppins text-xs border-b border-[var(--base-200)] last:border-0 pb-4 last:pb-0">
                          <p className="font-bold text-[var(--base-content)]">{cp.name}</p>
                          {cp.designation && <p className="text-[10px] text-[var(--base-content)]/50 mt-0.5 font-medium">{cp.designation}</p>}
                          <div className="flex flex-col gap-2 mt-3">
                            {cp.phone && (
                              <a href={`tel:${cp.phone}`} className="flex items-center gap-2 text-[10px] font-bold text-[var(--primary)] hover:underline hover:text-[var(--secondary)]">
                                <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0"><Phone size={10}/></div>
                                {cp.phone}
                              </a>
                            )}
                            {cp.email && (
                              <a href={`mailto:${cp.email}`} className="flex items-center gap-2 text-[10px] font-bold text-[var(--primary)] hover:underline hover:text-[var(--secondary)]">
                                <div className="w-6 h-6 rounded-full bg-[var(--primary)]/10 flex items-center justify-center shrink-0"><Mail size={10}/></div>
                                {cp.email}
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </aside>
                )}

                {/* Tags */}
                {lab.tags?.length > 0 && (
                  <aside className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-3 shadow-sm">
                    <p className="font-poppins text-[10px] uppercase tracking-widest text-[var(--base-content)]/50 font-black mb-4">Facility Tags</p>
                    <div className="flex flex-wrap gap-2">
                      {lab.tags.map((tag) => <span key={tag} className="px-3 py-1.5 bg-[var(--primary)]/5 border border-[var(--primary)]/20 text-[var(--primary)] font-poppins text-[10px] font-bold rounded-full uppercase tracking-wider">{tag}</span>)}
                    </div>
                  </aside>
                )}
              </div>
            </motion.div>
          )}

          {/* TESTS TAB */}
          {activeTab === "tests" && (
            <motion.div key="tests" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.3}}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <SectionTitle icon={TestTube} title="Available Diagnostic Tests" count={filteredTests.length}/>
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--base-content)]/40" aria-hidden="true"/>
                  <label htmlFor="search-tests" className="sr-only">Search specific tests</label>
                  <input id="search-tests" value={testSearch} onChange={(e) => setTestSearch(e.target.value)} placeholder="Search specific tests…"
                    className="w-full bg-[var(--base-100)] border-2 border-[var(--base-300)] rounded-[var(--r-field)] font-poppins text-xs py-2.5 pl-10 pr-4 outline-none focus:border-[var(--primary)] transition-colors"/>
                </div>
              </div>

              {filteredTests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-[var(--base-300)] rounded-[var(--r-box)] bg-[var(--base-200)]/30">
                  <TestTube size={40} className="text-[var(--base-content)]/20 mb-4" aria-hidden="true"/>
                  <h3 className="font-montserrat font-black  text-[var(--base-content)] mb-2">No Tests Found</h3>
                  <p className="font-poppins text-xs text-[var(--base-content)]/50">{testSearch ? "Try a different search term" : "This laboratory hasn't listed any tests yet"}</p>
                  {testSearch && <button onClick={() => setTestSearch("")} className="btn-secondary mt-5 text-[10px] px-6 py-2.5 uppercase tracking-wider">Clear Search</button>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredTests.map((t) => <TestCard key={t._id} test={t}/>)}
                </div>
              )}
            </motion.div>
          )}

          {/* PACKAGES TAB */}
          {activeTab === "packages" && (
            <motion.div key="pkgs" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.3}}>
              <div className="mb-6"><SectionTitle icon={Package} title="Comprehensive Health Packages" count={activePackages.length}/></div>
              
              {activePackages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-4 border-2 border-dashed border-[var(--base-300)] rounded-[var(--r-box)] bg-[var(--base-200)]/30">
                  <Package size={40} className="text-[var(--base-content)]/20 mb-4" aria-hidden="true"/>
                  <h3 className="font-montserrat font-black  text-[var(--base-content)] mb-2">No Packages Listed</h3>
                  <p className="font-poppins text-xs text-[var(--base-content)]/50">This laboratory hasn't curated any health packages yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {activePackages.map((p) => <PackageCard key={p._id} pkg={p}/>)}
                </div>
              )}
            </motion.div>
          )}

          {/* REVIEWS TAB */}
          {activeTab === "reviews" && (
            <motion.div key="revs" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.3}}>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Left Col: Summary & Write */}
                <div className="space-y-6">
                  {/* Summary Card */}
                  <div className="bg-[var(--base-100)] border border-[var(--base-300)] rounded-[var(--r-box)] p-3 shadow-sm flex flex-col items-center text-center">
                    <p className="font-poppins text-[10px] font-black uppercase tracking-widest text-[var(--base-content)]/50 mb-2">Overall Rating</p>
                    <div className="font-montserrat font-black text-6xl text-[var(--primary)] mb-3">{lab.averageRating?.toFixed(1) || "0.0"}</div>
                    <StarRow rating={lab.averageRating} size={20}/>
                    <p className="font-poppins text-[10px] font-medium text-[var(--base-content)]/50 mt-3 bg-[var(--base-200)] px-4 py-1.5 rounded-full">Based on {lab.totalReviews || 0} reviews</p>

                    {/* Distribution Bars */}
                    <div className="w-full mt-6 space-y-2.5">
                      {[5, 4, 3, 2, 1].map((r) => {
                        const cnt = reviews.filter((rv) => Math.round(rv.rating) === r).length;
                        const pct = reviews.length > 0 ? (cnt / reviews.length) * 100 : 0;
                        return (
                          <div key={r} className="flex items-center gap-3">
                            <span className="font-poppins text-[10px] font-black text-[var(--base-content)]/60 w-3">{r}</span>
                            <Star size={12} className="fill-[var(--warning)] text-[var(--warning)] shrink-0" aria-hidden="true"/>
                            <div className="flex-1 h-2 rounded-full bg-[var(--base-200)] overflow-hidden">
                              <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:0.3, duration:0.6, ease:"easeOut"}}
                                className="h-full rounded-full bg-gradient-to-r from-[var(--warning)] to-yellow-400"/>
                            </div>
                            <span className="font-poppins text-[10px] font-bold text-[var(--base-content)]/40 w-6 text-right">{cnt}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Col: Review List */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <SectionTitle icon={MessageSquare} title="Patient Feedback"/>
                  </div>

                  {reviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 border border-[var(--base-300)] rounded-[var(--r-box)] bg-[var(--base-100)] shadow-sm text-center">
                      <MessageSquare size={40} className="text-[var(--base-content)]/15 mb-4" aria-hidden="true"/>
                      <h3 className="font-montserrat font-black  text-[var(--base-content)] mb-2">No reviews yet</h3>
                      <p className="font-poppins text-xs text-[var(--base-content)]/50">Be the first to share your experience with {lab.labName}.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {reviews.map((rv, i) => <ReviewCard key={rv._id} review={rv} index={i}/>)}
                    </div>
                  )}

                  {reviewPag && reviewPag.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-8">
                      <button disabled={reviewPage <= 1} onClick={() => setReviewPage((p) => p - 1)}
                        className="px-4 py-2 rounded-[var(--r-field)] border-2 border-[var(--base-300)] text-[10px] font-black font-poppins uppercase tracking-wider disabled:opacity-30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all outline-none focus-visible:border-[var(--primary)]">
                        ← Prev
                      </button>
                      <span className="font-poppins text-[11px] font-black text-[var(--base-content)]/50 bg-[var(--base-200)] px-4 py-2 rounded-[var(--r-field)]">
                        {reviewPage} / {reviewPag.totalPages}
                      </span>
                      <button disabled={reviewPage >= reviewPag.totalPages} onClick={() => setReviewPage((p) => p + 1)}
                        className="px-4 py-2 rounded-[var(--r-field)] border-2 border-[var(--base-300)] text-[10px] font-black font-poppins uppercase tracking-wider disabled:opacity-30 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all outline-none focus-visible:border-[var(--primary)]">
                        Next →
                      </button>
                    </div>
                  )}
                </div>
                
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
   </Container>
  );
}