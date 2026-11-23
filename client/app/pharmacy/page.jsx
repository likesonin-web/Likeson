'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, X, ChevronDown,
  Pill, Package, AlertCircle, ShieldCheck, Beaker,
  ArrowUpDown, Eye, ChevronLeft, ChevronRight as ChevronRightIcon, Layers,
  FlaskConical, Syringe, Wind, Droplets, Heart, ArrowRight, ShieldAlert,
  Thermometer, Scale, Grid3x3, List, Filter
} from 'lucide-react';
import Container from '../../components/ui/Container';
import Ads from '../../components/Ads';
import {
  fetchMedicines,
  clearMedicineError,
  selectMedicines,
  selectMedicineLoading,
  selectMedicinePagination,
  selectMedicineError,
} from '@/store/slices/medicineSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Powder'];
const SCHEDULES = ['H', 'H1', 'G', 'X', 'None'];

const SORT_OPTIONS = [
  { label: 'Name (A–Z)',       value: 'brandName_asc'   },
  { label: 'Name (Z–A)',       value: 'brandName_desc'  },
  { label: 'Price: Low–High',  value: 'mrp_asc'         },
  { label: 'Price: High–Low',  value: 'mrp_desc'        },
  { label: 'Newest First',     value: 'createdAt_desc'  },
  { label: 'Most Popular',     value: 'popularity_desc' },
];

const CATEGORY_ICONS = {
  Tablet:    Pill,
  Capsule:   FlaskConical,
  Syrup:     Beaker,
  Injection: Syringe,
  Ointment:  Package,
  Drops:     Droplets,
  Inhaler:   Wind,
  Powder:    Layers,
};

const DEFAULT_FILTERS = {
  categories:        [],
  schedules:         [],
  prescriptionOnly:  false,
  hideDiscontinued:  false,
};

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 25, stiffness: 120 },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

// ─── Helper: Schedule Badge ───────────────────────────────────────────────────

const ScheduleBadge = ({ schedule }) => {
  const configs = {
    H:    { color: 'bg-error/10 text-error border-error/20',       label: 'Sch. H'  },
    H1:   { color: 'bg-warning/10 text-warning border-warning/20', label: 'Sch. H1' },
    G:    { color: 'bg-info/10 text-info border-info/20',          label: 'Sch. G'  },
    X:    { color: 'bg-error/20 text-error border-error/30',       label: 'Sch. X'  },
    None: { color: 'bg-success/10 text-success border-success/20', label: 'OTC'     },
  };
  const config = configs[schedule] ?? configs.None;
  return (
    <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-tighter ${config.color}`}>
      {config.label}
    </span>
  );
};

// ─── Helper: Stock Status ─────────────────────────────────────────────────────

const MedicineStatus = ({ medicine }) => {
  const isDiscontinued = medicine.isDiscontinued;
  const totalStock = (medicine.inventory || []).reduce(
    (sum, inv) => sum + (inv.stockQuantity || 0),
    0
  );
  const outOfStock = !isDiscontinued && totalStock === 0;

  const label = isDiscontinued ? 'DISCONTINUED' : outOfStock ? 'OUT OF STOCK' : 'IN STOCK';
  const colorClass = isDiscontinued || outOfStock
    ? 'bg-error/10 text-error border-error/20'
    : 'bg-success/30 text-success border-success/20';
  const dotClass = isDiscontinued || outOfStock ? 'bg-error' : 'bg-success';

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border ${colorClass}`}>
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotClass}`} />
      {label}
    </div>
  );
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────

const SkeletonCard = ({ viewMode }) => (
  <div className={`glass-card overflow-hidden animate-pulse ${viewMode === 'list' ? 'flex gap-4 items-center p-4' : ''}`}>
    <div className={`bg-base-300 shrink-0 ${viewMode === 'list' ? 'w-40 h-28 rounded-md' : 'h-52 w-full'}`} />
    <div className="p-4 space-y-3 flex-1">
      <div className="h-3 bg-base-300 rounded-md w-3/4" />
      <div className="h-2 bg-base-300 rounded-md w-1/2" />
      <div className="h-2 bg-base-300 rounded-md w-2/3" />
      <div className="h-8 bg-base-300 rounded-md w-full mt-4" />
    </div>
  </div>
);

// ─── Medicine Card ────────────────────────────────────────────────────────────

const MedicineCard = ({ medicine, viewMode, onViewDetail }) => {
  const [isHovered, setIsHovered] = useState(false);

  const primaryImage = medicine.images?.find(img => img.isPrimary)?.url
    ?? medicine.images?.[0]?.url
    ?? null;

  const CategoryIcon = CATEGORY_ICONS[medicine.category] ?? Pill;
  const isListView   = viewMode === 'list';

  return (
    <motion.div
      variants={cardVariants}
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`glass-card group relative flex flex-col h-full overflow-hidden transition-all duration-500 ${
        isListView ? 'md:flex-row md:items-center' : ''
      }`}
    >
      {/* ── Visual Header ── */}
      <div className={`relative bg-base-200 shrink-0 overflow-hidden ${
        isListView ? 'w-full md:w-56 h-48 md:h-full' : 'h-52'
      }`}>
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={medicine.brandName}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-base-200 to-base-300">
            <CategoryIcon size={56} className="text-primary/20" />
          </div>
        )}

        {/* Floating Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          <span className="bg-secondary/90 backdrop-blur-md w-fit text-secondary-content text-[9px] font-bold px-2 py-0.5 rounded-md shadow-sm border border-primary/10 uppercase">
            {medicine.category}
          </span>
          <MedicineStatus medicine={medicine} />
        </div>

        <button
          aria-label="Add to wishlist"
          className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-base-100/30 backdrop-blur-md text-base-content/40 hover:text-error transition-colors shadow-sm"
        >
          <Heart size={15} />
        </button>

        {/* Quick View Overlay — grid mode only */}
        <AnimatePresence>
          {isHovered && !isListView && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent flex justify-center"
            >
              <button
                onClick={(e) => { e.stopPropagation(); onViewDetail(medicine.slug); }}
                className="bg-primary text-primary-content text-[10px] font-bold py-1.5 px-4 rounded-md shadow-lg flex items-center gap-2 hover:brightness-110 transition-all"
              >
                <Eye size={13} /> QUICK VIEW
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 p-4 flex flex-col">
        {/* Title Row */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="space-y-0.5 min-w-0">
            <h3 className="text-sm font-bold text-base-content leading-tight group-hover:text-primary transition-colors truncate">
              {medicine.brandName}
            </h3>
            <p className="text-[10px] font-medium text-base-content/50 uppercase tracking-wider truncate">
              {medicine.genericName}
            </p>
          </div>
          <ScheduleBadge schedule={medicine.schedule} />
        </div>

        {/* Meta Row */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          {medicine.dosage && (
            <div className="flex items-center gap-1 text-[10px] text-base-content/60 font-semibold">
              <Thermometer size={11} className="text-secondary shrink-0" />
              {medicine.dosage}
            </div>
          )}
          {medicine.packaging && (
            <div className="flex items-center gap-1 text-[10px] text-base-content/60 font-semibold">
              <Scale size={11} className="text-secondary shrink-0" />
              {medicine.packaging}
            </div>
          )}
        </div>

        {/* Manufacturer */}
        {medicine.manufacturer && (
          <p className="text-[10px] text-base-content/40 font-medium mb-2 truncate">
            by {medicine.manufacturer}
          </p>
        )}

        {/* Indication Chips */}
        {medicine.indications?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {medicine.indications.slice(0, 2).map((ind, idx) => (
              <span key={idx} className="bg-base-300/50 text-base-content/60 text-[9px] px-2 py-0.5 rounded-md font-bold lowercase">
                #{ind}
              </span>
            ))}
          </div>
        )}

        {/* Salt Composition preview */}
        {medicine.saltComposition?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {medicine.saltComposition.slice(0, 2).map((salt, idx) => (
              <span key={idx} className="bg-primary/5 text-primary text-[9px] px-2 py-0.5 rounded-md font-bold border border-primary/10">
                {salt.ingredient} {salt.strength}
              </span>
            ))}
          </div>
        )}

        {/* Footer: Price + CTA */}
        <div className="mt-auto pt-3 border-t border-base-300/50 flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-primary">₹{medicine.mrp}</span>
              {medicine.gstPercentage > 0 && (
                <span className="text-[9px] text-base-content/30 font-bold uppercase">
                  +{medicine.gstPercentage}% GST
                </span>
              )}
            </div>
            <p className="text-[10px] font-bold text-success flex items-center gap-1 mt-0.5">
              <ShieldCheck size={10} /> Verified Authentic
            </p>
          </div>

          <button
            onClick={() => onViewDetail(medicine.slug)}
            aria-label={`View details for ${medicine.brandName}`}
            className="flex items-center justify-center bg-primary/10 text-primary w-9 h-9 rounded-md hover:bg-primary hover:text-primary-content transition-all duration-300 shadow-sm"
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const MemoMedicineCard = MemoizedMedicineCard(MedicineCard);

function MemoizedMedicineCard(Component) {
  return function Wrapped(props) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMemo(() => <Component {...props} />, [props.medicine, props.viewMode]);
  };
}

// ─── Filter Sidebar Content ───────────────────────────────────────────────────

const FilterContent = ({ filters, updateFilters, resetFilters, activeFiltersCount }) => (
  <div className="space-y-8">
    {/* Header */}
    <div className="flex items-center justify-between pb-3 border-b border-base-300">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] flex items-center gap-2 text-base-content/40">
        <SlidersHorizontal size={13} /> Filter Results
      </h2>
      {activeFiltersCount > 0 && (
        <button
          onClick={resetFilters}
          className="text-[10px] font-bold text-error uppercase hover:underline"
        >
          Reset All
        </button>
      )}
    </div>

    {/* Category */}
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-widest mb-4 text-base-content/70">
        By Category
      </h4>
      <div className="grid grid-cols-1 gap-2">
        {CATEGORIES.map(cat => (
          <label key={cat} className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={filters.categories.includes(cat)}
              onChange={() => {
                const updated = filters.categories.includes(cat)
                  ? filters.categories.filter(c => c !== cat)
                  : [...filters.categories, cat];
                updateFilters({ ...filters, categories: updated });
              }}
              className="w-4 h-4 accent-primary cursor-pointer rounded"
            />
            <span className="text-sm font-medium text-base-content/60 group-hover:text-primary transition-colors">
              {cat}
            </span>
          </label>
        ))}
      </div>
    </div>

    {/* Drug Schedule */}
    <div>
      <h4 className="text-[11px] font-bold uppercase tracking-widest mb-4 text-base-content/70">
        Drug Schedule
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {SCHEDULES.map(sch => (
          <button
            key={sch}
            onClick={() => {
              const updated = filters.schedules.includes(sch)
                ? filters.schedules.filter(s => s !== sch)
                : [...filters.schedules, sch];
              updateFilters({ ...filters, schedules: updated });
            }}
            className={`py-2 rounded-md text-[10px] font-bold border transition-all ${
              filters.schedules.includes(sch)
                ? 'bg-secondary border-secondary text-secondary-content shadow-sm'
                : 'bg-secondary/10 border-base-300 text-base-content/50 hover:border-primary'
            }`}
          >
            {sch === 'None' ? 'OTC' : `SCH ${sch}`}
          </button>
        ))}
      </div>
    </div>

    {/* Toggle Options */}
    <div className="pt-4 border-t border-base-300 space-y-3">
      <label className="flex items-center justify-between cursor-pointer p-3 bg-base-200 rounded-md">
        <span className="text-[10px] font-bold uppercase text-base-content/60">
          Prescription Required
        </span>
        <input
          type="checkbox"
          checked={filters.prescriptionOnly}
          onChange={() => updateFilters({ ...filters, prescriptionOnly: !filters.prescriptionOnly })}
          className="w-4 h-4 accent-primary cursor-pointer"
        />
      </label>
      <label className="flex items-center justify-between cursor-pointer p-3 bg-base-200 rounded-md">
        <span className="text-[10px] font-bold uppercase text-base-content/60">
          Hide Out of Stock
        </span>
        <input
          type="checkbox"
          checked={filters.hideDiscontinued}
          onChange={() => updateFilters({ ...filters, hideDiscontinued: !filters.hideDiscontinued })}
          className="w-4 h-4 accent-primary cursor-pointer"
        />
      </label>
    </div>

    {/* Health Disclaimer */}
    <div className="p-4 bg-primary/5 rounded-md border border-primary/10">
      <div className="flex gap-3">
        <ShieldAlert size={16} className="text-primary shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed text-primary/70 font-medium">
          <strong>Safety First:</strong> Never self-medicate. Prescription medicines
          require a valid doctor&apos;s note. Always consult a healthcare professional.
        </p>
      </div>
    </div>
  </div>
);

// ─── Main Page Component ───────────────────────────────────────────────────────

export default function MedicinePage() {
  const router = useRouter();
  const dispatch = useDispatch();

  const medicines  = useSelector(selectMedicines);
  const loading    = useSelector(selectMedicineLoading);
  const pagination = useSelector(selectMedicinePagination);
  const error      = useSelector(selectMedicineError);

  const [search,         setSearch]         = useState('');
  const [filters,        setFilters]        = useState(DEFAULT_FILTERS);
  const [sort,           setSort]           = useState('brandName_asc');
  const [viewMode,       setViewMode]       = useState('grid');
  const [currentPage,    setCurrentPage]    = useState(1);
  const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);
  const [isSortOpen,     setIsSortOpen]     = useState(false);

  const searchRef  = useRef(null);
  const sortRef    = useRef(null);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Clear any redux-level errors on mount
  useEffect(() => {
    dispatch(clearMedicineError());
  }, [dispatch]);

  // ── Centralised fetch ──
  const fetchContent = useCallback(
    (q, f, s, p) => {
      const params = {
        page:    p,
        limit:   12,
        search:  q || undefined,
        category:            f.categories.length  ? f.categories.join(',')  : undefined,
        schedule:            f.schedules.length   ? f.schedules.join(',')   : undefined,
        isPrescriptionRequired: f.prescriptionOnly  ? true  : undefined,
        isDiscontinued:      f.hideDiscontinued   ? false  : undefined,
        sort: s,
      };
      dispatch(fetchMedicines(params));
    },
    [dispatch]
  );

  // Debounce
  useEffect(() => {
    const timer = setTimeout(
      () => fetchContent(search, filters, sort, currentPage),
      400
    );
    return () => clearTimeout(timer);
  }, [search, filters, sort, currentPage, fetchContent]);

  // ── Filter helpers ──
  const updateFilters = useCallback((newVal) => {
    setFilters(newVal);
    setCurrentPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearch('');
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }, []);

  // ── Navigation ──
  const handleViewDetail = useCallback((slug) => {
    const path = `/pharmacy/buy-medicines/${slug}`;
    if (router) router.push(path);
    else window.location.href = path;
  }, [router]);

  // ── Active filter count ──
  const activeFiltersCount = useMemo(() => {
    let count = filters.categories.length + filters.schedules.length;
    if (filters.prescriptionOnly)  count++;
    if (filters.hideDiscontinued)  count++;
    return count;
  }, [filters]);

  // ── Pagination window ──
  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages ?? 1;
    return [...Array(total)].map((_, i) => i + 1).filter(p =>
      p === 1 || p === total || (p >= currentPage - 1 && p <= currentPage + 1)
    );
  }, [pagination.totalPages, currentPage]);

  return (
    <Container>
      <div className="min-h-screen bg-base-100 mt-4 text-base-content">

        {/* ── Hero Ad Slot ── */}
        <Ads page="Medicine_Store" slot="Hero_Banner" />

        {/* ── Toolbar ── */}
        <div className="w-full mt-8 relative z-[10]">
          <div className="bg-base-100 p-2 md:p-3 rounded-md border border-base-300 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">

            {/* Search */}
            <div className="relative flex-1 group" ref={searchRef}>
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 group-focus-within:text-primary transition-colors"
                size={18}
              />
              <input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search brand name, molecule or symptom (e.g. Fever)…"
                aria-label="Search medicines"
                className="w-full h-12 pl-12 pr-4 bg-base-200 border-none rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-base-content/30"
              />
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-2">

              {/* View Toggle */}
              <div className="hidden md:flex bg-base-200 p-1 rounded-md border border-base-300">
                <button
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-secondary text-secondary-content shadow-sm' : 'text-base-content/40'}`}
                >
                  <Grid3x3 size={16} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-secondary text-secondary-content shadow-sm' : 'text-base-content/40'}`}
                >
                  <List size={16} />
                </button>
              </div>

              {/* Sort Dropdown */}
              <div className="relative min-w-[170px]" ref={sortRef}>
                <button
                  onClick={() => setIsSortOpen(prev => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isSortOpen}
                  className="w-full h-12 px-4 flex items-center justify-between gap-2 bg-base-200 border border-base-300 rounded-md hover:bg-base-300 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <ArrowUpDown size={14} className="text-primary shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-widest truncate">
                      {SORT_OPTIONS.find(o => o.value === sort)?.label.split(':')[0]}
                    </span>
                  </div>
                  <ChevronDown
                    size={13}
                    className={`shrink-0 transition-transform duration-300 ${isSortOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {isSortOpen && (
                    <motion.ul
                      role="listbox"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute top-[calc(100%+6px)] left-0 right-0 bg-base-100 rounded-md shadow-2xl border border-base-300 p-1.5 z-[110]"
                    >
                      {SORT_OPTIONS.map(opt => (
                        <li key={opt.value}>
                          <button
                            role="option"
                            aria-selected={sort === opt.value}
                            onClick={() => { setSort(opt.value); setIsSortOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-md text-xs font-bold transition-all ${
                              sort === opt.value
                                ? 'bg-primary text-primary-content'
                                : 'hover:bg-base-200 text-base-content'
                            }`}
                          >
                            {opt.label}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Filter Trigger */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden h-12 px-5 bg-primary text-primary-content rounded-md font-bold text-xs uppercase flex items-center gap-2 shadow-sm shadow-primary/20"
              >
                <Filter size={16} />
                Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Layout ── */}
        <div className="mt-4 py-6">
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Desktop Sidebar ── */}
            <aside className="hidden lg:block w-64 shrink-0 sticky top-28 self-start">
              <div className="bg-secondary/5 border border-base-300 rounded-md p-5">
                <FilterContent
                  filters={filters}
                  updateFilters={updateFilters}
                  resetFilters={resetFilters}
                  activeFiltersCount={activeFiltersCount}
                />
              </div>
            </aside>

            {/* ── Product Grid ── */}
            <main className="flex-1 min-w-0">

              {/* Active Filter Chips */}
              <AnimatePresence>
                {activeFiltersCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-2 mb-6 pb-5 border-b border-base-300"
                  >
                    {filters.categories.map(c => (
                      <span key={c} className="flex items-center gap-1.5 bg-primary/10 text-primary text-[10px] font-bold px-3 py-1 rounded-md border border-primary/20">
                        {c}
                        <X
                          size={11}
                          className="cursor-pointer hover:text-error transition-colors"
                          onClick={() => updateFilters({ ...filters, categories: filters.categories.filter(x => x !== c) })}
                        />
                      </span>
                    ))}
                    {filters.schedules.map(s => (
                      <span key={s} className="flex items-center gap-1.5 bg-warning/10 text-warning text-[10px] font-bold px-3 py-1 rounded-md border border-warning/20">
                        {s === 'None' ? 'OTC' : `Sch. ${s}`}
                        <X
                          size={11}
                          className="cursor-pointer hover:text-error transition-colors"
                          onClick={() => updateFilters({ ...filters, schedules: filters.schedules.filter(x => x !== s) })}
                        />
                      </span>
                    ))}
                    {filters.prescriptionOnly && (
                      <span className="flex items-center gap-1.5 bg-info/10 text-info text-[10px] font-bold px-3 py-1 rounded-md border border-info/20">
                        Rx Only
                        <X
                          size={11}
                          className="cursor-pointer hover:text-error transition-colors"
                          onClick={() => updateFilters({ ...filters, prescriptionOnly: false })}
                        />
                      </span>
                    )}
                    {filters.hideDiscontinued && (
                      <span className="flex items-center gap-1.5 bg-success/10 text-success text-[10px] font-bold px-3 py-1 rounded-md border border-success/20">
                        In Stock Only
                        <X
                          size={11}
                          className="cursor-pointer hover:text-error transition-colors"
                          onClick={() => updateFilters({ ...filters, hideDiscontinued: false })}
                        />
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Results Count */}
              <div className="flex items-center justify-between mb-5">
                <p className="text-xs font-medium text-base-content/50 uppercase tracking-widest">
                  {loading ? (
                    <span className="inline-block w-32 h-3 bg-base-300 animate-pulse rounded" />
                  ) : (
                    <span>Found <span className="text-base-content font-bold">{pagination.total ?? medicines.length}</span> products</span>
                  )}
                </p>
              </div>

              {/* Error State */}
              {error && !loading && (
                <div className="alert alert-error mb-6 rounded-md">
                  <AlertCircle size={16} />
                  <span className="text-sm font-bold">{error}</span>
                  <button
                    onClick={() => fetchContent(search, filters, sort, currentPage)}
                    className="ml-auto text-xs font-bold underline"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Loading Skeletons */}
              {loading ? (
                <div className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5'
                    : 'space-y-4'
                }>
                  {[...Array(6)].map((_, i) => (
                    <SkeletonCard key={i} viewMode={viewMode} />
                  ))}
                </div>

              ) : medicines.length === 0 ? (
                /* Empty State */
                <div className="py-24 text-center bg-base-200/50 rounded-md border border-dashed border-base-300">
                  <div className="w-20 h-20 bg-base-300 rounded-md flex items-center justify-center mx-auto mb-6">
                    <Package size={36} className="text-base-content/20" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">No Medications Found</h3>
                  <p className="text-sm text-base-content/40 max-w-xs mx-auto mb-8">
                    We couldn&apos;t find anything matching those filters. Try a broader search.
                  </p>
                  <button
                    onClick={resetFilters}
                    className="px-6 py-2.5 bg-primary text-primary-content rounded-md font-bold text-xs uppercase tracking-widest hover:brightness-110 transition-all"
                  >
                    Clear All Filters
                  </button>
                </div>

              ) : (
                /* Medicine Grid / List */
                <motion.div
                  key={viewMode}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5'
                      : 'space-y-4'
                  }
                >
                  {medicines.map(med => (
                    <MemoMedicineCard
                      key={med._id}
                      medicine={med}
                      viewMode={viewMode}
                      onViewDetail={handleViewDetail}
                    />
                  ))}
                </motion.div>
              )}

              {/* Pagination */}
              {!loading && (pagination.totalPages ?? 1) > 1 && (
                <div className="mt-12 flex flex-col md:flex-row items-center justify-between p-6 bg-secondary/5 rounded-md border border-base-300 gap-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40">Navigation</p>
                    <p className="text-sm font-medium mt-0.5">
                      Page {currentPage}{' '}
                      <span className="text-base-content/30">of {pagination.totalPages}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Prev */}
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                      aria-label="Previous page"
                      className="w-10 h-10 flex items-center justify-center bg-base-100 border border-base-300 rounded-md hover:border-primary disabled:opacity-25 transition-all"
                    >
                      <ChevronLeft size={18} />
                    </button>

                    {/* Page buttons with ellipsis */}
                    {pageNumbers.reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) {
                        acc.push(
                          <span key={`ellipsis-${p}`} className="px-1 text-base-content/30 text-xs font-bold select-none">
                            …
                          </span>
                        );
                      }
                      acc.push(
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          aria-current={currentPage === p ? 'page' : undefined}
                          className={`w-10 h-10 rounded-md text-xs font-bold transition-all ${
                            currentPage === p
                              ? 'bg-primary text-primary-content shadow-sm shadow-primary/30'
                              : 'bg-base-100 border border-base-300 hover:bg-base-200'
                          }`}
                        >
                          {p}
                        </button>
                      );
                      return acc;
                    }, [])}

                    {/* Next */}
                    <button
                      disabled={currentPage === pagination.totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                      aria-label="Next page"
                      className="w-10 h-10 flex items-center justify-center bg-base-100 border border-base-300 rounded-md hover:border-primary disabled:opacity-25 transition-all"
                    >
                      <ChevronRightIcon size={18} />
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>

        {/* ── Mobile Filter Drawer ── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1000]"
                aria-hidden="true"
              />

              {/* Drawer */}
              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Filter medicines"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="fixed top-0 right-0 h-full w-[88%] max-w-sm bg-base-100 z-[1001] flex flex-col shadow-2xl"
              >
                {/* Drawer Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
                  <h2 className="text-sm font-black">Filter Store</h2>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 bg-base-200 rounded-md hover:bg-error/10 hover:text-error transition-all"
                    aria-label="Close filter panel"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Scrollable Filter Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <FilterContent
                    filters={filters}
                    updateFilters={updateFilters}
                    resetFilters={resetFilters}
                    activeFiltersCount={activeFiltersCount}
                  />
                </div>

                {/* Drawer Footer CTAs */}
                <div className="px-5 py-4 border-t border-base-300 flex flex-col gap-3">
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="w-full h-12 bg-primary text-primary-content rounded-md font-bold text-xs uppercase tracking-widest shadow-sm shadow-primary/20 hover:brightness-110 transition-all"
                  >
                    View {pagination.total ?? ''} Results
                  </button>
                  <button
                    onClick={() => { resetFilters(); setIsSidebarOpen(false); }}
                    className="text-xs font-bold uppercase text-error tracking-widest text-center hover:underline"
                  >
                    Clear All Filters
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

      </div>
    </Container>
  );
}