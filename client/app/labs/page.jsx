"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Star,
  Truck,
  Building2,
  Clock,
  ShieldCheck,
  SlidersHorizontal,
  X,
  ChevronRight,
  FlaskConical,
  Sparkles,
} from "lucide-react";

import {
  fetchPublicLabs,
  fetchFeaturedLabs,
  searchPublicLabs,
  selectPublicLabs,
  selectFeaturedLabs,
  selectPublicPagination,
  selectPublicSearchResults,
  selectLabLoading,
} from "@/store/slices/labSlice";

// ─────────────────────────────────────────────────────────────────────────
//  MOTION VARIANTS
// ─────────────────────────────────────────────────────────────────────────
const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};
const FADE_UP = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const LAB_TYPES = [
  "Diagnostic Lab",
  "Pathology Lab",
  "Radiology Center",
  "Microbiology Lab",
  "Biochemistry Lab",
  "Genetic Testing Lab",
  "Molecular Lab",
  "Immunology Lab",
  "Multi-Specialty Lab",
];

const COLLECTION_MODES = ["Walk-in", "Home Collection", "Both"];

const SORT_OPTIONS = [
  { value: "averageRating-desc", label: "Top Rated" },
  { value: "totalReviews-desc", label: "Most Reviewed" },
  { value: "homeCollectionFee-asc", label: "Lowest Home Fee" },
];

const PAGE_LIMIT = 12;

// ─────────────────────────────────────────────────────────────────────────
//  SKELETON CARD
// ─────────────────────────────────────────────────────────────────────────
function LabCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-32 w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-3 w-2/3" />
        <div className="flex gap-2 pt-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────
function EmptyState({ onClear }) {
  return (
    <motion.div
      variants={FADE_UP}
      initial="hidden"
      animate="show"
      className="col-span-full flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <FlaskConical size={28} className="text-primary" />
      </div>
      <h3 className="font-black text-lg mb-1">No labs found</h3>
      <p className="text-sm text-base-content/50 max-w-xs mb-4">
        Try adjusting your filters or search a different city.
      </p>
      <button onClick={onClear} className="btn btn-outline btn-sm">
        Clear filters
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  LAB CARD
// ─────────────────────────────────────────────────────────────────────────
function LabCard({ lab, onClick, onBook }) {
  const city = lab.registeredAddress?.city;
  const homeAvailable =
    lab.sampleCollectionMode === "Home Collection" ||
    lab.sampleCollectionMode === "Both";

  return (
    <motion.div variants={ITEM} className="card overflow-hidden group cursor-pointer" onClick={onClick}>
      <div
        className="relative h-32 w-full overflow-hidden bg-primary/10"
        style={{
          backgroundImage: lab.coverImageUrl ? `url(${lab.coverImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!lab.coverImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <FlaskConical size={32} className="text-primary/40" />
          </div>
        )}
        {lab.isFeatured && (
          <span className="absolute top-2 left-2 badge badge-accent badge-sm gap-1">
            <Sparkles size={10} /> Featured
          </span>
        )}
        {lab.isVerified && (
          <span className="absolute top-2 right-2 badge badge-success badge-sm gap-1">
            <ShieldCheck size={10} /> Verified
          </span>
        )}
        <div className="absolute -bottom-6 left-4 w-12 h-12 rounded-xl bg-base-100 border-2 border-base-100 shadow-sm overflow-hidden flex items-center justify-center">
          {lab.logoUrl ? (
            <img src={lab.logoUrl} alt={lab.labName} className="w-full h-full object-cover" />
          ) : (
            <Building2 size={18} className="text-primary" />
          )}
        </div>
      </div>

      <div className="p-4 pt-8">
        <h3 className="font-black text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">
          {lab.labName}
        </h3>
        <p className="text-xs text-base-content/50 mt-0.5 line-clamp-1">{lab.labType}</p>

        <div className="flex items-center gap-3 mt-2 text-xs text-base-content/60">
          {city && (
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {city}
            </span>
          )}
          {lab.avgTurnaroundHours && (
            <span className="flex items-center gap-1">
              <Clock size={11} /> {lab.avgTurnaroundHours}h TAT
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1">
            <Star size={14} className="text-warning fill-warning" />
            <span className="font-bold text-sm">{(lab.averageRating ?? 0).toFixed(1)}</span>
            <span className="text-xs text-base-content/40">({lab.totalReviews ?? 0})</span>
          </div>
          {homeAvailable && (
            <span className="badge badge-info badge-sm gap-1">
              <Truck size={10} /> Home Collection
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onBook(lab);
          }}
          className="btn btn-primary btn-sm w-full mt-3"
        >
          Book Test <ChevronRight size={14} />
        </button>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────
export default function LabsPage() {
  const dispatch = useDispatch();
  const router = useRouter();

  const publicLabs = useSelector(selectPublicLabs);
  const featuredLabs = useSelector(selectFeaturedLabs);
  const pagination = useSelector(selectPublicPagination);
  const searchResults = useSelector(selectPublicSearchResults);
  const loading = useSelector(selectLabLoading);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [city, setCity] = useState("");
  const [labType, setLabType] = useState("");
  const [collectionMode, setCollectionMode] = useState("");
  const [sort, setSort] = useState("averageRating-desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const debounceRef = useRef(null);

  useEffect(() => {
    dispatch(fetchFeaturedLabs());
  }, [dispatch]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const isSearchMode = debouncedSearch.length > 0;

  useEffect(() => {
    if (isSearchMode) {
      dispatch(searchPublicLabs({ q: debouncedSearch, city: city || undefined, page: 1, limit: PAGE_LIMIT }));
      return;
    }
    const [sortBy, sortOrder] = sort.split("-");
    dispatch(
      fetchPublicLabs({
        page,
        limit: PAGE_LIMIT,
        city: city || undefined,
        labType: labType || undefined,
        sampleCollectionMode: collectionMode || undefined,
        sortBy,
        sortOrder,
      })
    );
  }, [dispatch, isSearchMode, debouncedSearch, city, labType, collectionMode, sort, page]);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setCity("");
    setLabType("");
    setCollectionMode("");
    setSort("averageRating-desc");
    setPage(1);
  }, []);

  const goToDetail = useCallback(
    (lab) => router.push(`/labs/${lab._id}`),
    [router]
  );

  const goToBooking = useCallback(
    (lab) => {
      const homeAvailable =
        lab.sampleCollectionMode === "Home Collection" || lab.sampleCollectionMode === "Both";
      const type = homeAvailable ? "diagnostic_home" : "diagnostic_center";
      router.push(`/book-appointment?type=${type}&lab=${lab._id}&name=${encodeURIComponent(lab.labName)}`);
    },
    [router]
  );

  const labs = isSearchMode ? searchResults : publicLabs;
  const totalPages = pagination?.totalPages ?? 1;
  const activeFilterCount = [city, labType, collectionMode].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Hero / Search ───────────────────────────────────────────── */}
      <div className="relative bg-gradient-primary overflow-hidden" style={{ background: "var(--bg-gradient-primary)" }}>
        <div className="container-custom py-10 sm:py-14 relative z-10">
          <motion.div variants={FADE_UP} initial="hidden" animate="show">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary-content/15 text-primary-content mb-3">
              <FlaskConical size={11} /> Diagnostic Labs
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-primary-content tracking-tight mb-2">
              Find Trusted Labs Near You
            </h1>
            <p className="text-primary-content/80 text-sm sm:text-base max-w-xl mb-6">
              Compare NABL/ISO accredited diagnostic labs, book tests &amp; packages, and choose home
              collection or walk-in — all in one place.
            </p>
          </motion.div>

          <motion.div
            variants={FADE_UP}
            initial="hidden"
            animate="show"
            className="flex flex-col sm:flex-row gap-2 max-w-2xl"
          >
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search labs, tests or packages…"
                className="input-field pl-10 bg-base-100 shadow-depth"
              />
            </div>
            <div className="relative sm:w-48">
              <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setPage(1);
                }}
                placeholder="City"
                className="input-field pl-10 bg-base-100 shadow-depth"
              />
            </div>
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="btn bg-base-100 text-base-content shadow-depth relative"
            >
              <SlidersHorizontal size={15} />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-accent text-accent-content text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </motion.div>
        </div>
        <div className="absolute -bottom-12 -right-12 w-64 h-64 rounded-full bg-primary-content/10 blur-3xl" />
        <div className="absolute top-0 -left-12 w-48 h-48 rounded-full bg-accent/15 blur-3xl" />
      </div>

      {/* ── Filter Drawer ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-b border-base-300 bg-base-200 overflow-hidden"
          >
            <div className="container-custom py-4 flex flex-wrap items-center gap-3">
              <select
                value={labType}
                onChange={(e) => {
                  setLabType(e.target.value);
                  setPage(1);
                }}
                className="input-field w-auto"
              >
                <option value="">All Lab Types</option>
                {LAB_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <select
                value={collectionMode}
                onChange={(e) => {
                  setCollectionMode(e.target.value);
                  setPage(1);
                }}
                className="input-field w-auto"
              >
                <option value="">Any Collection Mode</option>
                {COLLECTION_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="input-field w-auto"
                disabled={isSearchMode}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {activeFilterCount > 0 && (
                <button onClick={handleClearFilters} className="btn btn-ghost btn-sm gap-1">
                  <X size={13} /> Clear
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container-custom py-8">
        {/* ── Featured Labs Row ─────────────────────────────────────── */}
        {!isSearchMode && featuredLabs?.length > 0 && (
          <motion.div variants={FADE_UP} initial="hidden" animate="show" className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={18} className="text-accent" />
              <h2 className="section-heading !mb-0 !text-xl sm:!text-2xl">Featured Labs</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin -mx-1 px-1">
              {featuredLabs.map((lab) => (
                <div key={lab._id} className="min-w-[260px] max-w-[260px]">
                  <LabCard lab={lab} onClick={() => goToDetail(lab)} onBook={goToBooking} />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Results Grid ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-lg">
            {isSearchMode ? `Results for "${debouncedSearch}"` : "All Labs"}
            {!loading && (
              <span className="text-base-content/40 font-semibold text-sm ml-2">
                ({isSearchMode ? labs?.length ?? 0 : pagination?.total ?? 0})
              </span>
            )}
          </h2>
        </div>

        <motion.div
          variants={STAGGER}
          initial="hidden"
          animate="show"
          className="grid-responsive"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => <LabCardSkeleton key={i} />)
            : labs?.length > 0
            ? labs.map((lab) => (
                <LabCard key={lab._id} lab={lab} onClick={() => goToDetail(lab)} onBook={goToBooking} />
              ))
            : <EmptyState onClear={handleClearFilters} />}
        </motion.div>

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {!isSearchMode && !loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-10">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="btn btn-outline btn-sm"
            >
              Prev
            </button>
            <span className="text-sm font-bold text-base-content/60 px-2">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => p + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="btn btn-outline btn-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}