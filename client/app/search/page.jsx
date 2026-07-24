"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  X,
  TrendingUp,
  Flame,
  Clock,
  MapPin,
  Stethoscope,
  Building2,
  FlaskConical,
  Pill,
  SlidersHorizontal,
  Loader2,
  ArrowRight,
  Star,
  ShieldCheck,
  Video,
  Home as HomeIcon,
  Sparkles,
} from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import {
  searchAll,
  fetchSuggestions,
  fetchTrendingSearches,
  fetchMostSearched,
  fetchPopularCategories,
  fetchSearchHistory,
  clearSearchHistory,
  recordSearchClick,
  setQuery,
  setSearchType,
  clearSuggestions,
  resetSearchResults,
} from "@/store/slices/searchSlice";

// ── Static config ─────────────────────────────────────────────────────────────

const ENTITY_TABS = [
  { key: "all", label: "All", icon: Search },
  { key: "medicine", label: "Medicines", icon: Pill },
  { key: "doctor", label: "Doctors", icon: Stethoscope },
  { key: "hospital", label: "Hospitals", icon: Building2 },
  { key: "lab", label: "Labs", icon: FlaskConical },
];

const ENTITY_META = {
  medicine: { icon: Pill, label: "Medicine", href: (i) => `/pharmacy/buy-medicines/${i.slug}` },
  doctor: { icon: Stethoscope, label: "Doctor", href: (i) => `/doctors/${i._id}` },
  hospital: { icon: Building2, label: "Hospital", href: (i) => `/hospitals/${i.slug}` },
  lab: { icon: FlaskConical, label: "Lab", href: (i) => `/labs/${i.labCode}` },
};

const inr = (n) =>
  typeof n === "number" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n) : null;

// ── Small building blocks ────────────────────────────────────────────────────

function Chip({ children, onClick, icon: Icon, tone = "default" }) {
  const toneClass =
    tone === "primary"
      ? "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
      : "bg-base-200 text-base-content/70 border-base-300 hover:border-primary/40 hover:text-primary";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${toneClass}`}
    >
      {Icon && <Icon size={14} />}
      {children}
    </button>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2 mb-3 text-base-content/60">
      <Icon size={16} />
      <span className="text-xs font-bold uppercase tracking-wider">{children}</span>
    </div>
  );
}

function ResultCard({ item, index, onSelect }) {
  const meta = ENTITY_META[item.resultType];
  const Icon = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.25 }}
    >
      <Link
        href={meta.href(item)}
        onClick={() => onSelect(item)}
        className="card flex gap-4 p-4 hover:bg-primary/5 group"
      >
        <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Icon size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-base-content truncate">
              {item.brandName || item.name || item.specialization && `${item.specialization}`}
              {item.resultType === "hospital" && item.name}
              {item.resultType === "lab" && item.labName}
              {item.resultType === "doctor" && (item.user?.name || item.specialization)}
            </h3>
            {item.resultType === "medicine" && item.referenceMrp != null && (
              <span className="text-sm font-bold text-primary shrink-0">{inr(item.referenceMrp)}</span>
            )}
          </div>

          <p className="text-sm text-base-content/60 truncate mt-0.5">
            {item.resultType === "medicine" && `${item.genericName ?? ""} · ${item.dosage ?? ""}`}
            {item.resultType === "doctor" && `${item.specialization} · ${item.experienceYears ?? 0} yrs exp`}
            {item.resultType === "hospital" && `${item.hospitalType} · ${item.address?.city ?? ""}`}
            {item.resultType === "lab" && `${item.labType} · ${item.registeredAddress?.city ?? ""}`}
          </p>

          <div className="flex items-center gap-3 mt-2 text-xs text-base-content/50">
            {item.rating?.averageRating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star size={12} className="fill-warning text-warning" /> {item.rating.averageRating.toFixed(1)}
              </span>
            )}
            {item.resultType === "doctor" && item.isOnline && (
              <span className="inline-flex items-center gap-1 text-success">
                <span className="status-dot status-dot-success" /> Online now
              </span>
            )}
            {item.resultType === "hospital" && item.isEmergencyReady && (
              <span className="inline-flex items-center gap-1 text-error">
                <ShieldCheck size={12} /> Emergency ready
              </span>
            )}
            {item.resultType === "doctor" && item.consultationTypes?.video && (
              <span className="inline-flex items-center gap-1">
                <Video size={12} /> Video consult
              </span>
            )}
            {item.resultType === "lab" && item.sampleCollectionMode !== "Walk-in" && (
              <span className="inline-flex items-center gap-1">
                <HomeIcon size={12} /> Home collection
              </span>
            )}
          </div>
        </div>

        <ArrowRight size={18} className="self-center text-base-content/20 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>
    </motion.div>
  );
}

function ResultSkeleton() {
  return (
    <div className="card flex gap-4 p-4">
      <div className="skeleton w-12 h-12 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-3 w-1/2" />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    query,
    type,
    results,
    searchStatus,
    suggestions,
    suggestStatus,
    trending,
    mostSearched,
    popularCategories,
    history,
  } = useSelector((s) => s.search);

  // Assumes an auth slice exists elsewhere; guarded so this page still works without one.
  const currentUser = useSelector((s) => s.auth?.user ?? null);

  const [inputValue, setInputValue] = useState(searchParams.get("q") || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ city: "", specialization: "", category: "", hospitalType: "", labType: "" });
  const [trendWindow, setTrendWindow] = useState("day");

  const debouncedInput = useDebounce(inputValue, 300);
  const hasSearched = searchStatus !== "idle" && query.length > 0;

  // ── Initial discovery data ─────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchTrendingSearches({ window: trendWindow, limit: 8 }));
  }, [dispatch, trendWindow]);

  useEffect(() => {
    dispatch(fetchMostSearched({ limit: 8 }));
    dispatch(fetchPopularCategories());
  }, [dispatch]);

  useEffect(() => {
    if (currentUser) dispatch(fetchSearchHistory({ limit: 10 }));
  }, [dispatch, currentUser]);

  // ── Autocomplete ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (debouncedInput.trim().length >= 1) {
      dispatch(fetchSuggestions({ q: debouncedInput.trim(), type }));
    } else {
      dispatch(clearSuggestions());
    }
  }, [debouncedInput, type, dispatch]);

  // ── Run search ────────────────────────────────────────────────────────────
  const runSearch = useCallback(
    (q, opts = {}) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      setShowSuggestions(false);
      const nextPage = opts.page ?? 1;
      setPage(nextPage);
      dispatch(
        searchAll({
          q: trimmed,
          type: opts.type ?? type,
          page: nextPage,
          city: filters.city || undefined,
          specialization: filters.specialization || undefined,
          category: filters.category || undefined,
          hospitalType: filters.hospitalType || undefined,
          labType: filters.labType || undefined,
        })
      );
    },
    [dispatch, type, filters]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    runSearch(inputValue);
  };

  const handleTabChange = (key) => {
    dispatch(setSearchType(key));
    if (inputValue.trim().length >= 2) runSearch(inputValue, { type: key });
  };

  const handleChipClick = (q) => {
    setInputValue(q);
    runSearch(q);
  };

  const handleSuggestionClick = (s) => {
    setInputValue(s.label);
    runSearch(s.label, { type: s.type });
  };

  const handleResultClick = (item) => {
    dispatch(
      recordSearchClick({
        searchLogId: results.searchLogId, // present only if your API echoes it back — omit if not applicable
        resultId: item._id,
        resultType: item.resultType,
      })
    );
  };

  const clearAll = () => {
    setInputValue("");
    dispatch(resetSearchResults());
    dispatch(clearSuggestions());
  };

  // ── Derived: flattened result groups for type=all rendering ────────────────
  const groupedResults = useMemo(() => {
    if (type !== "all") return null;
    return [
      { key: "doctors", label: "Doctors", icon: Stethoscope, ...results.doctors },
      { key: "hospitals", label: "Hospitals", icon: Building2, ...results.hospitals },
      { key: "labs", label: "Labs & Diagnostics", icon: FlaskConical, ...results.labs },
      { key: "medicines", label: "Medicines", icon: Pill, ...results.medicines },
    ].filter((g) => g.items?.length);
  }, [type, results]);

  const flatItems = type !== "all" ? results.items ?? [] : null;
  const totalResults =
    type === "all"
      ? (results.medicines.total ?? 0) + (results.doctors.total ?? 0) + (results.hospitals.total ?? 0) + (results.labs.total ?? 0)
      : results.total ?? 0;

  const showDiscovery = !hasSearched || inputValue.trim().length === 0;

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Search header ───────────────────────────────────────────────── */}
      <div className="bg-primary/5 border-b border-base-300">
        <div className="container-custom py-8 md:py-12">
          <motion.h1
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-black tracking-tight text-center mb-6"
          >
            Find <span className="text-gradient-primary">doctors, medicines & care</span> near you
          </motion.h1>

          <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto">
            <div className="glass-card flex items-center gap-2 px-4 py-1">
              <Search size={20} className="text-base-content/40 shrink-0" />
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search medicines, doctors, hospitals, labs..."
                className="flex-1 bg-transparent outline-none py-3 text-base placeholder:text-base-content/40"
              />
              {inputValue && (
                <button type="button" onClick={clearAll} className="btn btn-ghost btn-circle btn-sm">
                  <X size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`btn btn-circle btn-sm ${showFilters ? "btn-primary" : "btn-ghost"}`}
              >
                <SlidersHorizontal size={16} />
              </button>
              <button type="submit" className="btn btn-primary btn-sm hidden sm:inline-flex">
                Search
              </button>
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && inputValue.trim().length >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                  className="glass-card absolute top-full mt-2 left-0 right-0 z-20 overflow-hidden py-2"
                >
                  {suggestStatus === "loading" && (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm text-base-content/50">
                      <Loader2 size={14} className="animate-spin" /> Searching...
                    </div>
                  )}
                  {suggestStatus !== "loading" && suggestions.length === 0 && (
                    <div className="px-4 py-3 text-sm text-base-content/50">No matches yet — press enter to search anyway.</div>
                  )}
                  {suggestions.map((s, i) => {
                    const Icon = ENTITY_META[s.type]?.icon ?? Search;
                    return (
                      <button
                        key={`${s.type}-${s.label}-${i}`}
                        onMouseDown={() => handleSuggestionClick(s)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 text-left transition-colors"
                      >
                        <Icon size={16} className="text-primary shrink-0" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium truncate">{s.label}</span>
                          {s.subtitle && <span className="block text-xs text-base-content/50 truncate">{s.subtitle}</span>}
                        </span>
                        <span className="badge badge-sm badge-primary">{ENTITY_META[s.type]?.label ?? s.type}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </form>

          {/* Entity tabs */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {ENTITY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = type === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    active ? "bg-primary text-primary-content" : "bg-base-100 text-base-content/60 hover:text-primary border border-base-300"
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="max-w-2xl mx-auto overflow-hidden"
              >
                <div className="flex flex-wrap gap-3 pt-4">
                  <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                    <MapPin size={16} className="text-base-content/40" />
                    <input
                      value={filters.city}
                      onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))}
                      placeholder="City"
                      className="input-field"
                    />
                  </div>
                  {(type === "doctor" || type === "all") && (
                    <input
                      value={filters.specialization}
                      onChange={(e) => setFilters((f) => ({ ...f, specialization: e.target.value }))}
                      placeholder="Specialization"
                      className="input-field flex-1 min-w-[160px]"
                    />
                  )}
                  {(type === "medicine" || type === "all") && (
                    <input
                      value={filters.category}
                      onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                      placeholder="Medicine category"
                      className="input-field flex-1 min-w-[160px]"
                    />
                  )}
                  <button onClick={() => runSearch(inputValue)} className="btn btn-primary btn-sm">
                    Apply filters
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="container-custom py-8 md:py-10">
        {showDiscovery ? (
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-10">
              {/* Trending */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel icon={Flame}>Trending searches</SectionLabel>
                  <div className="flex gap-1 text-xs">
                    {["day", "week"].map((w) => (
                      <button
                        key={w}
                        onClick={() => setTrendWindow(w)}
                        className={`px-2.5 py-1 rounded-full font-semibold ${
                          trendWindow === w ? "bg-primary/10 text-primary" : "text-base-content/40 hover:text-base-content/70"
                        }`}
                      >
                        {w === "day" ? "Today" : "This week"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {trending.items.length === 0 && <p className="text-sm text-base-content/40">Nothing trending yet.</p>}
                  {trending.items.map((t) => (
                    <Chip key={t.query} icon={TrendingUp} tone="primary" onClick={() => handleChipClick(t.query)}>
                      {t.query}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Most searched */}
              <div>
                <SectionLabel icon={Search}>Most searched, all-time</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {mostSearched.map((t) => (
                    <Chip key={t.query} onClick={() => handleChipClick(t.query)}>
                      {t.query}
                    </Chip>
                  ))}
                </div>
              </div>

              {/* Popular categories */}
              <div>
                <SectionLabel icon={Sparkles}>Browse by category</SectionLabel>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { title: "Specializations", icon: Stethoscope, items: popularCategories.specializations, onPick: (v) => { setFilters((f) => ({ ...f, specialization: v })); handleTabChange("doctor"); } },
                    { title: "Medicine categories", icon: Pill, items: popularCategories.medicineCategories, onPick: (v) => { setFilters((f) => ({ ...f, category: v })); handleTabChange("medicine"); } },
                    { title: "Hospital types", icon: Building2, items: popularCategories.hospitalTypes, onPick: () => handleTabChange("hospital") },
                    { title: "Lab types", icon: FlaskConical, items: popularCategories.labTypes, onPick: () => handleTabChange("lab") },
                  ].map((group) => (
                    <div key={group.title} className="stat-card">
                      <div className="flex items-center gap-2 mb-3 text-primary">
                        <group.icon size={16} />
                        <span className="text-sm font-bold">{group.title}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {(group.items ?? []).slice(0, 6).map((c) => (
                          <button
                            key={c.label}
                            onClick={() => group.onPick(c.label)}
                            className="badge badge-sm badge-primary hover:bg-primary hover:text-primary-content transition-colors"
                          >
                            {c.label} · {c.count}
                          </button>
                        ))}
                        {(!group.items || group.items.length === 0) && (
                          <span className="text-xs text-base-content/40">No data yet</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar: personal history */}
            <div>
              {currentUser && (
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-3">
                    <SectionLabel icon={Clock}>Recent searches</SectionLabel>
                    {history.length > 0 && (
                      <button onClick={() => dispatch(clearSearchHistory())} className="text-xs font-semibold text-error hover:underline">
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {history.length === 0 && <p className="text-sm text-base-content/40">No searches yet.</p>}
                    {history.map((h) => (
                      <button
                        key={h.query + h.searchedAt}
                        onClick={() => handleChipClick(h.query)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-primary/5 text-left text-sm"
                      >
                        <Clock size={14} className="text-base-content/30 shrink-0" />
                        <span className="truncate">{h.query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Results header */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-base-content/60">
                {searchStatus === "loading" ? "Searching..." : `${totalResults} result${totalResults === 1 ? "" : "s"} for "${query}"`}
              </p>
            </div>

            {searchStatus === "loading" && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ResultSkeleton key={i} />
                ))}
              </div>
            )}

            {searchStatus === "succeeded" && totalResults === 0 && (
              <div className="text-center py-16">
                <Search size={40} className="mx-auto text-base-content/20 mb-3" />
                <h3 className="font-bold text-lg mb-1">No results for "{query}"</h3>
                <p className="text-sm text-base-content/50">Try a shorter term, or check the spelling.</p>
              </div>
            )}

            {searchStatus === "succeeded" && type === "all" && groupedResults?.length > 0 && (
              <div className="space-y-10">
                {groupedResults.map((group) => (
                  <div key={group.key}>
                    <div className="flex items-center justify-between mb-3">
                      <SectionLabel icon={group.icon}>
                        {group.label} ({group.total})
                      </SectionLabel>
                      {group.total > group.items.length && (
                        <button onClick={() => handleTabChange(group.key.slice(0, -1))} className="text-xs font-semibold text-primary hover:underline">
                          View all
                        </button>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {group.items.map((item, i) => (
                        <ResultCard key={item._id} item={item} index={i} onSelect={handleResultClick} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchStatus === "succeeded" && type !== "all" && flatItems?.length > 0 && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  {flatItems.map((item, i) => (
                    <ResultCard key={item._id} item={item} index={i} onSelect={handleResultClick} />
                  ))}
                </div>

                {results.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <button
                      disabled={page <= 1}
                      onClick={() => runSearch(inputValue, { page: page - 1 })}
                      className="btn btn-ghost btn-sm"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-base-content/50 px-2">
                      Page {page} of {results.totalPages}
                    </span>
                    <button
                      disabled={page >= results.totalPages}
                      onClick={() => runSearch(inputValue, { page: page + 1 })}
                      className="btn btn-ghost btn-sm"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}