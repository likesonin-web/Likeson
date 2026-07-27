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
  Loader2,
} from "lucide-react";
import Container from "@/components/ui/Container";
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
//  THEME CONSTANTS (From CUSTOMER_NAV_LINKS -> Labs)
// ─────────────────────────────────────────────────────────────────────────
const LAB_THEME = {
  accent: "#7c3aed",
  bg: "rgba(124,58,237,0.07)",
  barGradient: "linear-gradient(90deg, #7c3aed, #a78bfa)",
  pillBg: "rgba(124,58,237,0.12)",
  pillText: "#7c3aed",
  shadowColor: "rgba(124,58,237,0.28)",
};

// ─────────────────────────────────────────────────────────────────────────
//  MOTION VARIANTS
// ─────────────────────────────────────────────────────────────────────────
const STAGGER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", damping: 25, stiffness: 300 } },
};
const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
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
    <div className="rounded-xl border border-base-200 bg-base-100 overflow-hidden shadow-sm animate-pulse">
      <div className="h-28 w-full bg-base-200/60" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-base-200 rounded-md w-3/4" />
        <div className="h-2.5 bg-base-200 rounded-md w-1/2" />
        <div className="h-2.5 bg-base-200 rounded-md w-2/3" />
        <div className="flex gap-2 pt-2">
          <div className="h-6 w-16 bg-base-200 rounded-full" />
          <div className="h-6 w-20 bg-base-200 rounded-full" />
        </div>
        <div className="h-9 w-full bg-base-200 rounded-lg mt-3" />
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
      className="col-span-full flex flex-col items-center justify-center py-12 text-center bg-base-100 rounded-2xl border border-dashed border-base-300"
    >
      <div 
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: LAB_THEME.pillBg, color: LAB_THEME.accent }}
      >
        <FlaskConical size={28} strokeWidth={1.5} />
      </div>
      <h3 className="font-black text-lg mb-1 text-base-content">No laboratories found</h3>
      <p className="text-xs text-base-content/50 max-w-sm mb-5 font-medium">
        We couldn't find any labs matching your current search or filter criteria. Try adjusting them.
      </p>
      <button 
        onClick={onClear} 
        className="px-5 py-2 rounded-lg font-bold text-xs transition-all active:scale-95 cursor-pointer"
        style={{ background: LAB_THEME.bg, color: LAB_THEME.accent }}
      >
        Clear All Filters
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
    <motion.div 
      variants={ITEM} 
      className="group relative flex flex-col h-full bg-base-100 rounded-xl border border-base-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer" 
      onClick={onClick}
    >
      <div
        className="relative h-28 w-full overflow-hidden shrink-0"
        style={{
          background: LAB_THEME.bg,
          backgroundImage: lab.coverImageUrl ? `url(${lab.coverImageUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {!lab.coverImageUrl && (
          <div className="absolute inset-0 flex items-center justify-center">
            <FlaskConical size={32} opacity={0.2} color={LAB_THEME.accent} />
          </div>
        )}
        
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          {lab.isFeatured && (
            <span 
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white shadow-sm backdrop-blur-md"
              style={{ background: LAB_THEME.accent }}
            >
              <Sparkles size={8} /> Featured
            </span>
          )}
          {lab.isVerified && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-emerald-500/90 text-white shadow-sm backdrop-blur-md">
              <ShieldCheck size={8} /> Verified
            </span>
          )}
        </div>

        <div className="absolute -bottom-5 left-4 w-11 h-11 rounded-xl bg-base-100 border-2 border-base-100 shadow-sm overflow-hidden flex items-center justify-center z-10">
          {lab.logoUrl ? (
            <img src={lab.logoUrl} alt={lab.labName} className="w-full h-full object-cover" />
          ) : (
            <Building2 size={16} color={LAB_THEME.accent} opacity={0.5} />
          )}
        </div>
      </div>

      <div className="p-4 pt-6 flex flex-col flex-1">
        <h3 className="font-black text-[15px] leading-tight line-clamp-1 group-hover:text-primary transition-colors tracking-tight" style={{ "--tw-text-opacity": 1 }}>
          {lab.labName}
        </h3>
        <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: LAB_THEME.accent }}>
          {lab.labType}
        </p>

        <div className="flex items-center gap-3 mt-2 mb-3 text-[10px] font-semibold text-base-content/60">
          {city && (
            <span className="flex items-center gap-1">
              <MapPin size={11} opacity={0.6} /> {city}
            </span>
          )}
          {lab.avgTurnaroundHours && (
            <span className="flex items-center gap-1">
              <Clock size={11} opacity={0.6} /> {lab.avgTurnaroundHours}h TAT
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center justify-between pt-2.5 border-t border-base-200 border-dashed">
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Star size={10} className="text-amber-500 fill-amber-500" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-[11px]">{(lab.averageRating ?? 0).toFixed(1)}</span>
              <span className="text-[8px] font-bold text-base-content/40 uppercase tracking-widest">{lab.totalReviews ?? 0} Revs</span>
            </div>
          </div>
          
          {homeAvailable && (
            <span 
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest"
              style={{ background: "rgba(14, 165, 233, 0.1)", color: "rgb(14, 165, 233)" }}
            >
              <Truck size={9} /> Home Col.
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onBook(lab);
          }}
          className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-2 rounded-lg text-white font-black text-[10px] uppercase tracking-[0.1em] transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          style={{ 
            background: LAB_THEME.barGradient, 
            boxShadow: `0 4px 10px -4px ${LAB_THEME.shadowColor}` 
          }}
        >
          Book Test <ChevronRight size={12} />
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

  // Search autocomplete states
  const [inputValue, setInputValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false);
  const searchContainerRef = useRef(null);

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

  // Click outside to close the dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update debounced value
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(inputValue.trim()), 350);
    return () => clearTimeout(debounceRef.current);
  }, [inputValue]);

  const isSearchMode = debouncedSearch.length >= 2;

  // Single source of truth for fetching
  useEffect(() => {
    const params = { page, limit: PAGE_LIMIT, sortOrder: sort.split("-")[1], sortBy: sort.split("-")[0] };
    
    if (isSearchMode) {
      dispatch(searchPublicLabs({ q: debouncedSearch, city: city || undefined, ...params, limit: 100 }));
    } else {
      dispatch(fetchPublicLabs({
        ...params,
        city: city || undefined,
        labType: labType || undefined,
        sampleCollectionMode: collectionMode || undefined,
      }));
    }
  }, [dispatch, isSearchMode, debouncedSearch, city, labType, collectionMode, sort, page]);

  const handleClearFilters = useCallback(() => {
    setInputValue("");
    setDebouncedSearch("");
    setIsSearchFocused(false);
    setIsDropdownExpanded(false);
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
    <div className="min-h-screen bg-base-100 font-poppins">
      <Container className="pt-6 md:pt-8 lg:pt-10">
      {/* ── Hero / Search ───────────────────────────────────────────── */}
      <div 
        className="relative overflow-visible pt-8 pb-10 md:pt-10 md:pb-14 border-b border-base-200" 
        style={{ background: LAB_THEME.bg }}
      >
        <div className="container-custom relative z-[50]">
          <motion.div variants={FADE_UP} initial="hidden" animate="show" className="text-center max-w-2xl mx-auto">
            <div 
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm mb-3"
              style={{ background: LAB_THEME.pillBg, color: LAB_THEME.pillText }}
            >
              <FlaskConical size={10} strokeWidth={2.5} /> Diagnostic Labs
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-base-content tracking-tight mb-2.5">
              Find Trusted Labs <br className="hidden md:block"/> 
              <span style={{ color: LAB_THEME.accent }}>Near You.</span>
            </h1>
            <p className="text-base-content/60 text-xs md:text-sm font-medium max-w-lg mx-auto mb-6">
              Compare accredited labs, book tests, and choose home collection or walk-in.
            </p>
          </motion.div>

          {/* Search Bar Wrapper */}
          <motion.div
            variants={FADE_UP}
            initial="hidden"
            animate="show"
            className="flex flex-col md:flex-row gap-2 max-w-3xl mx-auto bg-base-100 p-1.5 md:p-2 rounded-2xl shadow-lg border border-base-200 relative"
          >
            {/* Search Input */}
            <div className="relative flex-1" ref={searchContainerRef}>
              <Search size={15} className="absolute left-3.5 top-[18px] md:top-[24px] -translate-y-1/2 opacity-40 z-[12]" style={{ color: LAB_THEME.accent }} />
              <input
                type="search"
                value={inputValue}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setIsSearchFocused(true);
                  setIsDropdownExpanded(false);
                  setPage(1);
                }}
                placeholder="Search labs, tests or packages…"
                className="w-full pl-10 pr-8 py-2.5 md:py-3 rounded-xl bg-base-200/50 text-[13px]  border border-transparent outline-none transition-all placeholder:text-base-content/30 focus:bg-base-100 focus:border-[#7c3aed]/30 focus:shadow-sm relative z-[11] [&::-webkit-search-cancel-button]:hidden"
              />
              {inputValue && (
                <button
                  onClick={() => {
                    setInputValue("");
                    setDebouncedSearch("");
                    setIsSearchFocused(false);
                  }}
                  className="absolute right-2 top-[18px] md:top-[24px] -translate-y-1/2 p-1 rounded-md hover:bg-base-300 text-base-content/40 transition-colors z-[12] cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}

              {/* AUTOCOMPLETE DROPDOWN */}
              <AnimatePresence>
                {isSearchFocused && inputValue.trim().length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-base-100 shadow-xl border border-base-200 rounded-xl overflow-hidden z-[100]"
                  >
                    {loading ? (
                      <div className="p-4 flex items-center justify-center gap-2 text-xs font-bold" style={{ color: LAB_THEME.accent }}>
                        <Loader2 size={14} className="animate-spin" /> Fetching labs...
                      </div>
                    ) : searchResults?.length > 0 ? (
                      <div className="p-1.5">
                        <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 px-2.5 pt-1.5 pb-1">
                          {isDropdownExpanded ? 'All Results' : 'Top Results'}
                        </p>
                        
                        <div className="max-h-[240px] overflow-y-auto scrollbar-thin pr-1">
                          {searchResults.slice(0, isDropdownExpanded ? searchResults.length : 5).map(lab => (
                            <button
                              key={lab._id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsSearchFocused(false);
                                goToDetail(lab);
                              }}
                              className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-base-200 transition-colors cursor-pointer group"
                            >
                              <div className="w-8 h-8 rounded-md overflow-hidden border border-base-300 shrink-0 bg-base-100 flex items-center justify-center">
                                {lab.logoUrl ? (
                                  <img src={lab.logoUrl} alt={lab.labName} className="w-full h-full object-cover" />
                                ) : (
                                  <Building2 size={16} className="text-base-content/20" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-[13px] text-base-content truncate group-hover:text-[#7c3aed] transition-colors leading-tight">
                                  {lab.labName}
                                </h4>
                                <p className="text-[10px] font-medium text-base-content/50 truncate flex items-center gap-1 mt-0.5">
                                  <MapPin size={9} /> {lab.registeredAddress?.city || 'Unknown City'}
                                </p>
                              </div>
                              <div className="w-6 h-6 rounded-full bg-base-100 flex items-center justify-center border border-base-300 group-hover:bg-[#7c3aed] group-hover:border-[#7c3aed] group-hover:text-white transition-all shadow-sm">
                                <ChevronRight size={12} />
                              </div>
                            </button>
                          ))}
                        </div>

                        {!isDropdownExpanded && searchResults.length > 5 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDropdownExpanded(true);
                            }}
                            className="w-full mt-1 py-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer hover:opacity-80"
                            style={{ color: LAB_THEME.accent, backgroundColor: LAB_THEME.pillBg }}
                          >
                            View all {searchResults.length} results
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-xs font-medium text-base-content/50">
                        No labs matched "{inputValue}".
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* City Input */}
            <div className="relative md:w-48">
              <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40" style={{ color: LAB_THEME.accent }} />
              <input
                type="text"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setPage(1);
                }}
                placeholder="City"
                className="w-full pl-9 pr-3 py-2.5 md:py-3 rounded-xl bg-base-200/50 text-[13px] font-bold border border-transparent outline-none transition-all placeholder:text-base-content/30 focus:bg-base-100 focus:border-[#7c3aed]/30 focus:shadow-sm"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters((s) => !s)}
              className="px-5 py-2.5 md:py-3 rounded-xl font-black text-[11px] uppercase tracking-widest text-white transition-all active:scale-95 flex items-center justify-center gap-2 relative shadow-sm cursor-pointer"
              style={{ background: LAB_THEME.barGradient }}
            >
              <SlidersHorizontal size={14} />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-base-100 text-base-content border border-base-200 text-[9px] font-black flex items-center justify-center shadow-sm">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </motion.div>
        </div>

        {/* Decorative Blurs */}
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-40 z-0 pointer-events-none" style={{ background: LAB_THEME.pillBg }} />
        <div className="absolute top-0 -left-16 w-56 h-56 rounded-full blur-3xl opacity-30 z-0 pointer-events-none" style={{ background: LAB_THEME.pillBg }} />
      </div>

      {/* ── Filter Drawer ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-b border-base-200 bg-base-100 overflow-hidden shadow-inner relative z-40"
          >
            <div className="container-custom py-4 flex flex-wrap items-center gap-3">
              
              <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">Lab Type</label>
                <select
                  value={labType}
                  onChange={(e) => {
                    setLabType(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-base-200/60 text-xs font-bold border border-transparent outline-none focus:border-[#7c3aed]/30 transition-all cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {LAB_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">Collection</label>
                <select
                  value={collectionMode}
                  onChange={(e) => {
                    setCollectionMode(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-base-200/60 text-xs font-bold border border-transparent outline-none focus:border-[#7c3aed]/30 transition-all cursor-pointer"
                >
                  <option value="">Any Mode</option>
                  {COLLECTION_MODES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-40 ml-1">Sort By</label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  disabled={isSearchMode}
                  className="w-full px-3 py-2 rounded-lg bg-base-200/60 text-xs font-bold border border-transparent outline-none focus:border-[#7c3aed]/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 justify-end">
                <label className="text-[9px] font-black uppercase tracking-widest opacity-0 hidden sm:block">&nbsp;</label>
                {activeFilterCount > 0 ? (
                  <button 
                    onClick={handleClearFilters} 
                    className="h-[36px] px-4 rounded-lg font-bold text-[10px] uppercase tracking-widest text-error bg-error/10 hover:bg-error hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <X size={12} /> Clear
                  </button>
                ) : (
                  <div className="h-[36px]" /> // Spacer
                )}
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container-custom py-8 md:py-10 relative z-30">
        
        {/* ── Featured Labs Row ─────────────────────────────────────── */}
        {!isSearchMode && featuredLabs?.length > 0 && (
          <motion.div variants={FADE_UP} initial="hidden" animate="show" className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm" style={{ background: LAB_THEME.pillBg, color: LAB_THEME.accent }}>
                <Sparkles size={16} />
              </div>
              <h2 className="text-xl font-black tracking-tight">Featured Labs</h2>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin -mx-1 px-1 snap-x">
              {featuredLabs.map((lab) => (
                <div key={lab._id} className="min-w-[240px] max-w-[240px] snap-start">
                  <LabCard lab={lab} onClick={() => goToDetail(lab)} onBook={goToBooking} />
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Results Header ──────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 className="text-lg md:text-xl font-black flex items-center gap-2.5 tracking-tight">
            {isSearchMode ? `Results for "${debouncedSearch}"` : "All Laboratories"}
            {!loading && (
              <span 
                className="px-2.5 py-0.5 rounded-full text-[10px] font-black"
                style={{ background: LAB_THEME.bg, color: LAB_THEME.accent }}
              >
                {isSearchMode ? labs?.length ?? 0 : pagination?.total ?? 0} found
              </span>
            )}
          </h2>
        </div>

        {/* ── Results Grid ──────────────────────────────────────────── */}
        <motion.div
          variants={STAGGER}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5"
        >
          {loading ? (
            Array.from({ length: PAGE_LIMIT }).map((_, i) => <LabCardSkeleton key={i} />)
          ) : labs?.length > 0 ? (
            labs.map((lab) => (
              <LabCard key={lab._id} lab={lab} onClick={() => goToDetail(lab)} onBook={goToBooking} />
            ))
          ) : (
            <EmptyState onClear={handleClearFilters} />
          )}
        </motion.div>

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {!isSearchMode && !loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-base-200 bg-base-100 hover:border-[#7c3aed]/50 hover:bg-[#7c3aed]/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={16} className="rotate-180" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPage(p);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-8 h-8 rounded-lg text-xs font-black transition-all cursor-pointer"
                  style={
                    page === p 
                    ? { background: LAB_THEME.accent, color: "#fff", boxShadow: `0 2px 8px ${LAB_THEME.shadowColor}` } 
                    : { background: "transparent", color: "var(--base-content)" }
                  }
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              disabled={page >= totalPages}
              onClick={() => {
                setPage((p) => p + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-base-200 bg-base-100 hover:border-[#7c3aed]/50 hover:bg-[#7c3aed]/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

      </div>
      </Container>
    </div>
  );
}