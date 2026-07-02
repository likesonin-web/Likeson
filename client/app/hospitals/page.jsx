"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Search,
  Navigation,
  Building2,
  Star,
  ShieldCheck,
  Clock,
  HeartPulse,
  Stethoscope,
  BedDouble,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  CalendarPlus,
  Info,
  X,
  Loader2,
  AlertTriangle,
  Phone,
  Award,
  Users,
} from "lucide-react";
import SpecialButton from "../../components/SpecialButton";
import {
  fetchNearbyHospitals,
  fetchAllHospitals,
  selectHospitals,
  selectNearbyHospitals,
  selectHospitalTotal,
  selectHospitalPage,
  selectHospitalPages,
  selectHospitalLoading,
  selectHospitalError,
} from "@/store/slices/hospitalSlice";
import Container from "@/components/ui/Container";
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HOSPITAL_TYPES = [
  "Multi-Specialty",
  "Super-Specialty",
  "Trust",
  "Government",
  "Clinic",
  "Nursing Home",
];

const SORT_OPTIONS = [
  { value: "-rating.averageRating", label: "Highest rated" },
  { value: "name", label: "Name (A–Z)" },
  { value: "-createdAt", label: "Newest" },
];

const RESULTS_PER_PAGE = 12;
const NEARBY_RADIUS_METERS = 100000; // 100 km — matches HomeHospitals

// Location modes — mirrors HomeHospitals so "near me" behaves identically
// user         → resolved from the signed-in user's saved location on mount
// nearby       → resolved from live GPS (button press)
// manual-near  → typed address successfully geocoded to coordinates
// manual       → typed address could not be geocoded, filtered by city text instead
// browse       → no location context, plain directory browse
const MODE = {
  USER: "user",
  NEARBY: "nearby",
  MANUAL_NEAR: "manual-near",
  MANUAL: "manual",
  BROWSE: "browse",
};

const isLocationMode = (m) =>
  m === MODE.USER || m === MODE.NEARBY || m === MODE.MANUAL_NEAR;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function geocodeAddress(address) {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address,
    )}&key=${GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]) {
      const { lat, lng } = data.results[0].geometry.location;
      return { lat, lng };
    }
  } catch {
    // silent fallback — caller treats null as "use city filter instead"
  }
  return null;
}

function distanceLabel(hospital) {
  const meters = hospital?.distance ?? hospital?.dist?.calculated;
  if (typeof meters !== "number") return null;
  const km = meters / 1000;
  return km < 1 ? `${Math.round(meters)} m away` : `${km.toFixed(1)} km away`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational pieces
// ─────────────────────────────────────────────────────────────────────────────

function StarRating({ value = 0, count = 0 }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <div className="flex items-center gap-1">
      <Star className="w-3.5 h-3.5 text-warning fill-warning" />
      <span className="text-sm font-bold text-base-content">
        {value > 0 ? rounded.toFixed(1) : "New"}
      </span>
      {count > 0 && (
        <span className="text-xs text-base-content/50">({count})</span>
      )}
    </div>
  );
}

function FacilityIcons({ hospital }) {
  const items = [
    hospital.hasICU && { icon: BedDouble, label: "ICU" },
    hospital.is24x7 && { icon: Clock, label: "24/7" },
    hospital.isEmergencyReady && { icon: HeartPulse, label: "Emergency" },
    hospital.hasPharmacy && { icon: Stethoscope, label: "Pharmacy" },
  ].filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 text-xs font-semibold text-base-content/60"
          title={label}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </span>
      ))}
    </div>
  );
}

function StatCell({ icon: Icon, value, label }) {
  return (
    <div className="flex flex-col items-center justify-center py-2 border-r border-base-300 last:border-r-0">
      <Icon className="w-3.5 h-3.5 text-primary mb-0.5" />
      <span className="text-sm font-black text-base-content leading-none">
        {value}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wide text-base-content/40 mt-0.5">
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hospital card
// ─────────────────────────────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: Math.min(i, 8) * 0.045,
      duration: 0.35,
      ease: "easeOut",
    },
  }),
};

function HospitalCard({ hospital, index }) {
  const dist = distanceLabel(hospital);
  const identifier = hospital.slug || hospital._id;
  const accreditations = hospital.accreditations?.slice(0, 3) ?? [];

  return (
    <motion.article
      className="card overflow-hidden flex flex-col"
      variants={cardVariants}
      custom={index}
      initial="hidden"
      animate="visible"
    >
      {/* ── Media ── */}
      <div className="relative h-40 bg-base-200 overflow-hidden">
        {hospital.images?.[0] || hospital.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hospital.images?.[0] || hospital.logo}
            alt={hospital.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <Building2 className="w-10 h-10 text-primary/50" />
          </div>
        )}

        <div className="absolute top-3 left-3">
          <span className="badge badge-sm badge-primary">
            {hospital.hospitalType}
          </span>
        </div>

        {hospital.isVerified && (
          <div className="absolute top-3 right-3">
            <span
              className="badge badge-sm badge-success"
              title="Verified by Likeson"
            >
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          </div>
        )}

        {dist && (
          <div className="absolute bottom-3 right-3">
            <span className="badge badge-sm bg-base-100/90 text-secondary border border-base-300 backdrop-blur-sm">
              <Navigation className="w-3 h-3" />
              {dist}
            </span>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-black leading-tight text-base-content line-clamp-1">
            {hospital.name}
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <StarRating
            value={hospital.rating?.averageRating}
            count={hospital.rating?.totalReviews}
          />
          {accreditations.length > 0 && (
            <div className="flex gap-1">
              {accreditations.map((a) => (
                <span
                  key={a}
                  className="badge badge-xs badge-info"
                  title={`${a} accredited`}
                >
                  <Award className="w-2.5 h-2.5" />
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 text-sm text-base-content/60">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="line-clamp-2">
            {hospital.address?.line1}
            {hospital.address?.city ? `, ${hospital.address.city}` : ""}
          </span>
        </div>

        {/* ── Quick stats ── */}
        <div className="grid grid-cols-4 rounded-[var(--r-field)] border border-base-300 bg-base-200/50">
          <StatCell
            icon={BedDouble}
            value={hospital.bedCount?.total ?? 0}
            label="Beds"
          />
          <StatCell
            icon={HeartPulse}
            value={hospital.bedCount?.icu ?? 0}
            label="ICU"
          />
          <StatCell
            icon={Stethoscope}
            value={hospital.specialties?.length ?? 0}
            label="Depts"
          />
          <StatCell
            icon={Users}
            value={hospital.linkedDoctors?.length ?? 0}
            label="Doctors"
          />
        </div>

        <FacilityIcons hospital={hospital} />

        {hospital.specialties?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {hospital.specialties.slice(0, 3).map((s) => (
              <span key={s} className="badge badge-xs badge-secondary">
                {s}
              </span>
            ))}
            {hospital.specialties.length > 3 && (
              <span className="badge badge-xs badge-secondary">
                +{hospital.specialties.length - 3}
              </span>
            )}
          </div>
        )}

        {hospital.contact?.phone && (
          <a
            href={`tel:${hospital.contact.emergencyPhone || hospital.contact.phone}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-base-content/50 hover:text-primary transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            {hospital.contact.emergencyPhone || hospital.contact.phone}
            {hospital.contact.emergencyPhone && (
              <span className="text-error font-black uppercase text-[10px] ml-1">
                Emergency
              </span>
            )}
          </a>
        )}

        {/* ── Actions ── */}
        <div className="mt-auto pt-2 w-full flex items-center gap-2">
          <SpecialButton
            title="Details"
            icon={Info}
            href={`/hospitals/${identifier}`}
            role="hospital"
            variant="outline"
            className="flex-1 w-40"

          />
          <SpecialButton
            title="Book"
            icon={CalendarPlus}
            href={`/book-appointment?hospitalId=${hospital._id}`}
            className="flex-1 w-40"
            variant="solid"
            animation="press"
            textAnimation="letterStagger"
             
            role="hospital"
          />
        </div>
      </div>
    </motion.article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton + empty/error states
// ─────────────────────────────────────────────────────────────────────────────

function HospitalCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="h-40 skeleton rounded-none" />
      <div className="p-5 flex flex-col gap-3">
        <div className="skeleton h-5 w-3/4" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-12 w-full" />
        <div className="skeleton h-9 w-full mt-2" />
      </div>
    </div>
  );
}

function EmptyState({ mode, onReset }) {
  const copy = isLocationMode(mode)
    ? {
        title: "No hospitals found nearby",
        body: "Nothing turned up within 100 km. Try a different area or browse the full directory.",
      }
    : {
        title: "No hospitals match these filters",
        body: "Clear a filter to see more results.",
      };

  return (
    <div className="col-span-full flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Building2 className="w-7 h-7 text-primary" />
      </div>
      <h3 className="text-lg font-bold text-base-content mb-1">{copy.title}</h3>
      <p className="text-sm text-base-content/60 max-w-sm mb-4">{copy.body}</p>
      <button onClick={onReset} className="btn btn-outline btn-sm">
        Show all hospitals
      </button>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="col-span-full">
      <div className="alert alert-error">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-sm">Couldn&rsquo;t load hospitals</p>
          <p className="text-sm text-base-content/70">{message}</p>
        </div>
        <button onClick={onRetry} className="btn btn-sm btn-error shrink-0">
          Retry
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────────────────────

function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-10">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="btn btn-ghost btn-circle"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-sm font-semibold text-base-content/70 px-2">
        Page {page} of {pages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        className="btn btn-ghost btn-circle"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Location bar — same behavior/priority order as HomeHospitals, page-styled
// ─────────────────────────────────────────────────────────────────────────────

function LocationBar({
  mode,
  manualAddress,
  locationLabel,
  onUseGPS,
  onManualSearch,
  onClear,
  gpsLoading,
  geocoding,
}) {
  const [inputVal, setInputVal] = useState(manualAddress || "");

  const modeLabel =
    mode === MODE.USER
      ? `Near ${locationLabel || "your saved location"} · 100 km radius`
      : mode === MODE.NEARBY
        ? "Near your current location · 100 km radius"
        : mode === MODE.MANUAL_NEAR
          ? `Near "${manualAddress}" · 100 km radius`
          : mode === MODE.MANUAL
            ? `Filtered by "${manualAddress}"`
            : "Showing all hospitals";

  const submit = () => {
    const v = inputVal.trim();
    if (v.length > 2) onManualSearch(v);
  };

  return (
    <div className="glass-card p-4 md:p-5 max-w-3xl">
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Search by hospital name, city, or area"
            className="input-field pl-10 pr-8"
          />
          {inputVal && (
            <button
              onClick={() => {
                setInputVal("");
                onClear();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={submit}
            disabled={geocoding}
            className="btn btn-primary-cta"
          >
            {geocoding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Search
          </button>

          <motion.button
            type="button"
            onClick={onUseGPS}
            disabled={gpsLoading || mode === MODE.USER}
            className={`btn shrink-0 ${
              mode === MODE.NEARBY || mode === MODE.USER
                ? "btn-secondary"
                : "btn-outline"
            }`}
            whileTap={{ scale: 0.94 }}
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Navigation className="w-4 h-4" />
            )}
            {mode === MODE.USER
              ? "Location active"
              : mode === MODE.NEARBY
                ? "Near me ✓"
                : "Near me"}
          </motion.button>
        </div>
      </div>

      <p className="text-xs font-semibold text-secondary mt-3 flex items-center gap-1.5">
        <Navigation className="w-3.5 h-3.5" />
        {modeLabel}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export default function HospitalsPage() {
  const dispatch = useDispatch();

  const user = useSelector((s) => s.user?.user) ?? null;
  const allHospitals = useSelector(selectHospitals);
  const nearbyHospitals = useSelector(selectNearbyHospitals);
  const total = useSelector(selectHospitalTotal);
  const page = useSelector(selectHospitalPage);
  const pages = useSelector(selectHospitalPages);
  const loading = useSelector(selectHospitalLoading);
  const error = useSelector(selectHospitalError);

  const [mode, setMode] = useState(MODE.BROWSE);
  const [coords, setCoords] = useState(null);
  const [cityFilter, setCityFilter] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [hospitalType, setHospitalType] = useState("");
  const [sort, setSort] = useState(SORT_OPTIONS[0].value);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [geocoding, setGeocoding] = useState(false);

  const currentPageRef = useRef(1);
  const didInit = useRef(false);

  const nearby = isLocationMode(mode);
  const isLoading = nearby
    ? loading.fetchNearbyHospitals
    : loading.fetchAllHospitals;
  const hospitals = nearby ? nearbyHospitals : allHospitals;

  // ── Fetchers ────────────────────────────────────────────────────────────────

  const runBrowse = useCallback(
    (targetPage = 1, city = cityFilter) => {
      currentPageRef.current = targetPage;
      dispatch(
        fetchAllHospitals({
          page: targetPage,
          limit: RESULTS_PER_PAGE,
          hospitalType: hospitalType || undefined,
          city: city || undefined,
          sort,
        }),
      );
    },
    [dispatch, cityFilter, hospitalType, sort],
  );

  const runNearby = useCallback(
    (targetPage = 1, loc = coords) => {
      if (!loc) return;
      currentPageRef.current = targetPage;
      dispatch(
        fetchNearbyHospitals({
          lat: loc.lat,
          lng: loc.lng,
          maxDistance: NEARBY_RADIUS_METERS,
          page: targetPage,
          limit: RESULTS_PER_PAGE,
          hospitalType: hospitalType || undefined,
        }),
      );
    },
    [dispatch, coords, hospitalType],
  );

  // ── Initial load — saved location first, same priority as HomeHospitals ─────
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const savedCoords = user?.location?.coordinates;
    if (savedCoords && (savedCoords[0] !== 0 || savedCoords[1] !== 0)) {
      const loc = { lat: savedCoords[1], lng: savedCoords[0] };
      setCoords(loc);
      setLocationLabel(user.lastKnownAddress || "your saved location");
      setMode(MODE.USER);
      runNearby(1, loc);
    } else {
      setMode(MODE.BROWSE);
      runBrowse(1, "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // ── Re-fetch current mode when type/sort filters change ─────────────────────
  useEffect(() => {
    if (!didInit.current) return;
    if (nearby) runNearby(1);
    else runBrowse(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitalType, sort]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleUseGPS = () => {
    if (mode === MODE.USER) return;

    // Helper to fallback to Redux user location if GPS fails
    const fallbackToUserLocation = (baseErrorMsg) => {
      // 1. If not logged in
      if (!user) {
        setGpsError(
          `${baseErrorMsg} You are not logged in. Please log in to use a saved location, or search manually.`,
        );
        setGpsLoading(false);
        return;
      }

      // 2. Check for saved coordinates in the user model
      // Note: MongoDB stores as [longitude, latitude]
      const savedCoords = user?.location?.coordinates;
      if (savedCoords && (savedCoords[0] !== 0 || savedCoords[1] !== 0)) {
        const loc = { lat: savedCoords[1], lng: savedCoords[0] };

        setCoords(loc);
        setManualAddress("");
        setCityFilter("");
        setMode(MODE.USER);
        setLocationLabel(user.lastKnownAddress || "your saved location");

        // Let the user know we used their saved location instead
        setGpsError(
          `${baseErrorMsg} Using your saved profile location instead.`,
        );
        runNearby(1, loc);
      } else {
        // 3. Logged in, but no saved location exists
        setGpsError(
          `${baseErrorMsg} No saved location found in your profile. Enter it manually.`,
        );
      }
      setGpsLoading(false);
    };

    // Check if geolocation is supported at all
    if (!("geolocation" in navigator)) {
      fallbackToUserLocation("Geolocation not supported.");
      return;
    }

    setGpsLoading(true);
    setGpsError("");

    // Request GPS location
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Success: Use live GPS
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(loc);
        setManualAddress("");
        setCityFilter("");
        setMode(MODE.NEARBY);
        setGpsLoading(false);
        runNearby(1, loc);
      },
      (err) => {
        // Error: Fallback to profile location
        const baseMsg =
          err.code === 1
            ? "Location permission denied."
            : "Could not get your live location.";

        fallbackToUserLocation(baseMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const handleManualSearch = async (address) => {
    setGpsError("");
    setGeocoding(true);
    const resolved = await geocodeAddress(address);
    setGeocoding(false);
    setManualAddress(address);

    if (resolved) {
      setCoords(resolved);
      setMode(MODE.MANUAL_NEAR);
      runNearby(1, resolved);
    } else {
      setCityFilter(address);
      setMode(MODE.MANUAL);
      runBrowse(1, address);
    }
  };

  const handleTypeToggle = (type) => {
    setHospitalType((prev) => (prev === type ? "" : type));
  };

  const handlePageChange = (nextPage) => {
    if (nearby) runNearby(nextPage);
    else runBrowse(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleClear = useCallback(() => {
    setGpsError("");
    setManualAddress("");
    setCityFilter("");

    const savedCoords = user?.location?.coordinates;
    if (savedCoords && (savedCoords[0] !== 0 || savedCoords[1] !== 0)) {
      const loc = { lat: savedCoords[1], lng: savedCoords[0] };
      setCoords(loc);
      setMode(MODE.USER);
      runNearby(1, loc);
      return;
    }
    setMode(MODE.BROWSE);
    runBrowse(1, "");
  }, [user, runNearby, runBrowse]);

  const handleRetry = () => {
    if (nearby) runNearby(currentPageRef.current);
    else runBrowse(currentPageRef.current);
  };

  return (
    <div data-theme="hospital" className="min-h-screen bg-base-100">
      <Container className="">
        {/* ═══════════════════════════════ HERO / SEARCH (Center Pattern + Corner Glows) ═══════════════════════════ */}
        <section className="relative overflow-hidden border-b border-base-300 bg-base-100">
          {/* ── 1. Corner Edge Glows (Top-Left & Bottom-Right Only) ── */}
          <div
            className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden"
            aria-hidden="true"
          >
            {/* Top-Left Glow (Primary) */}
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] bg-primary/10 dark:bg-primary/15 blur-[100px] md:blur-[140px] rounded-full" />

            {/* Bottom-Right Glow (Secondary) */}
            <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[60%] bg-secondary/10 dark:bg-secondary/15 blur-[100px] md:blur-[140px] rounded-full" />
          </div>

          {/* ── 2. Grid Texture (Restricted to Center Only) ── */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.08] text-base-content"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm39 39V1H1v38h38z' fill='currentColor' fill-rule='evenodd'/%3E%3C/svg%3E")`,
              /* Masks the pattern so it only exists in the middle and completely disappears at the edges */
              WebkitMaskImage:
                "radial-gradient(circle at center, black 10%, transparent 65%)",
              maskImage:
                "radial-gradient(circle at center, black 10%, transparent 65%)",
            }}
            aria-hidden="true"
          />

          <div className="container-custom relative z-10 py-10 md:py-16">
            {/* ── 3. Go Back Button ── */}
            <button
              onClick={() => window.history.back()}
              className="btn btn-sm btn-ghost mb-8 -ml-2 text-base-content/60 hover:text-base-content hover:bg-base-content/5 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Go Back
            </button>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-base-200/50 dark:bg-base-200/20 border border-base-content/5 text-[11px] font-bold uppercase tracking-widest text-base-content/70 mb-6 backdrop-blur-sm shadow-sm">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                Verified Care Network
              </span>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-4 max-w-3xl">
                {/* Text gradient using base-content and base-100 (using base-300 in light mode for readability) */}
                <span className="bg-gradient-to-br from-base-content to-base-300 dark:to-base-100 bg-clip-text text-transparent">
                  Find the right hospital,
                </span>{" "}
                <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent drop-shadow-sm">
                  fast.
                </span>
              </h1>

              <p className="text-lg text-base-content/60 mb-10 max-w-2xl font-medium">
                Search verified hospitals near you, or look up a city and book
                an appointment in minutes.
              </p>
            </motion.div>

            {/* ── 4. Search Component ── */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="w-full"
            >
              <div className="relative group max-w-3xl">
                {/* Search Container */}
                <div className="relative bg-base-100/90 dark:bg-base-100/70 backdrop-blur-xl rounded-2xl ring-1 ring-base-content/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                  <LocationBar
                    mode={mode}
                    manualAddress={manualAddress}
                    locationLabel={locationLabel}
                    onUseGPS={handleUseGPS}
                    onManualSearch={handleManualSearch}
                    onClear={handleClear}
                    gpsLoading={gpsLoading}
                    geocoding={geocoding}
                  />
                </div>
              </div>

              {gpsError && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="text-xs text-error font-semibold mt-4 flex items-center gap-1.5 max-w-3xl px-1"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {gpsError}
                </motion.p>
              )}
            </motion.div>

            {/* ── 5. Quick Stats ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-wrap items-center gap-4 mt-12 md:mt-16 max-w-2xl"
            >
              <div className="flex flex-col flex-1 min-w-[120px] px-5 py-4 rounded-[1.25rem] bg-base-200/30 dark:bg-base-200/10 backdrop-blur-md border border-base-content/5 shadow-sm hover:bg-base-200/50 dark:hover:bg-base-200/20 transition-all duration-300">
                <p className="text-2xl md:text-3xl font-black text-base-content mb-0.5">
                  {total > 0 ? `${total}+` : "—"}
                </p>
                <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                  Facilities
                </p>
              </div>

              <div className="flex flex-col flex-1 min-w-[120px] px-5 py-4 rounded-[1.25rem] bg-base-200/30 dark:bg-base-200/10 backdrop-blur-md border border-base-content/5 shadow-sm hover:bg-base-200/50 dark:hover:bg-base-200/20 transition-all duration-300">
                <p className="text-2xl md:text-3xl font-black text-base-content mb-0.5">
                  100
                  <span className="text-lg text-base-content/40 ml-1">km</span>
                </p>
                <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest">
                  Radius
                </p>
              </div>

              <div className="flex flex-col flex-1 min-w-[120px] px-5 py-4 rounded-[1.25rem] bg-base-200/30 dark:bg-base-200/10 backdrop-blur-md border border-base-content/5 shadow-sm hover:bg-base-200/50 dark:hover:bg-base-200/20 transition-all duration-300 relative overflow-hidden">
                <p className="text-2xl md:text-3xl font-black text-base-content mb-0.5 relative z-10">
                  24/7
                </p>
                <p className="text-xs font-bold text-base-content/50 uppercase tracking-widest relative z-10">
                  ER Access
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════ FILTER BAR ═══════════════════════════════ */}
        <section className="sticky top-0 z-30 bg-base-100/90 backdrop-blur-soft border-b border-base-300">
          <div className="container-custom py-3 flex items-center gap-3 overflow-x-auto scrollbar-thin">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className="btn btn-ghost btn-sm shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
            </button>

            <span
              className="w-px h-6 bg-base-300 shrink-0"
              aria-hidden="true"
            />

            <div className="flex items-center gap-2 shrink-0">
              {HOSPITAL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeToggle(type)}
                  className={`badge shrink-0 cursor-pointer transition-colors ${
                    hospitalType === type ? "badge-primary" : "badge-secondary"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="flex-1" />

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="input-field !w-auto py-1.5 text-sm shrink-0"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  Sort: {opt.label}
                </option>
              ))}
            </select>
          </div>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-base-300"
              >
                <div className="container-custom py-4 flex items-center justify-between">
                  <p className="text-sm text-base-content/60">
                    {hospitalType
                      ? `Filtering by ${hospitalType}`
                      : "No type filter applied — showing all hospital types."}
                  </p>
                  <button
                    onClick={handleClear}
                    className="btn btn-ghost btn-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear all
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ═══════════════════════════════ RESULTS ══════════════════════════════════ */}
        <section className="container-custom py-10">
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm font-semibold text-base-content/60">
              {isLoading
                ? "Loading hospitals…"
                : `${total} hospital${total === 1 ? "" : "s"} found`}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {error && !isLoading ? (
              <ErrorState message={error} onRetry={handleRetry} />
            ) : isLoading ? (
              Array.from({ length: RESULTS_PER_PAGE }).map((_, i) => (
                <HospitalCardSkeleton key={i} />
              ))
            ) : hospitals.length === 0 ? (
              <EmptyState mode={mode} onReset={handleClear} />
            ) : (
              hospitals.map((hospital, i) => (
                <HospitalCard
                  key={hospital._id}
                  hospital={hospital}
                  index={i}
                />
              ))
            )}
          </div>

          {!isLoading && !error && (
            <Pagination page={page} pages={pages} onChange={handlePageChange} />
          )}
        </section>
      </Container>
    </div>
  );
}
