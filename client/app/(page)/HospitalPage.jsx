"use client";

import React, { useRef, useEffect, useCallback, memo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Star,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Bed,
  Stethoscope,
  Plus,
  MapPin,
  Navigation,
  Search,
  X,
  Loader2,
  Phone,
  Clock,
  FlaskConical,
  Droplets,
  Heart,
  Award,
  Building2,
  Users,
} from "lucide-react";
import {
  fetchAllHospitals,
  fetchNearbyHospitals,
  selectHospitals,
  selectNearbyHospitals,
  selectIsLoadingHospitals,
  selectIsLoadingNearbyHospitals,
} from "@/store/slices/hospitalSlice";

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    // silent fallback
  }
  return null;
}

/** Convert raw metres (from $geoNear) → "1.2 km" or "800 m" */
function formatDistance(metres) {
  if (!metres && metres !== 0) return null;
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Accreditation badge colours */
const ACCRED_COLOR = {
  NABH: "bg-primary/10 text-primary border-primary/20",
  NABL: "bg-secondary/20 text-secondary border-secondary/30",
  JCI: "bg-accent/10 text-accent border-accent/30",
  ISO: "bg-success/10 text-success border-success/40",
  AHPI: "bg-info/10 text-info border-info/30",
  Other: "bg-base-300/60 text-base-content/60 border-base-300",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const HospitalCardSkeleton = memo(() => (
  <div
    className="min-w-[340px] md:min-w-[400px] h-[560px] rounded-[var(--r-box)] bg-base-200 animate-pulse border border-base-300 snap-start shrink-0"
    aria-label="Loading hospital data"
  />
));
HospitalCardSkeleton.displayName = "HospitalCardSkeleton";

// ─── Facility Pill ────────────────────────────────────────────────────────────

const FacilityPill = ({
  icon: Icon,
  label,
  active,
  colorClass = "text-primary",
}) => {
  if (!active) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold uppercase tracking-wider bg-base-100 border-base-300 ${colorClass}`}
    >
      <Icon size={9} />
      {label}
    </span>
  );
};

// ─── Hospital Card ────────────────────────────────────────────────────────────

const HospitalCard = memo(({ hospital, index }) => {
  const isPriority = index < 3;
  const imageSrc =
    hospital?.logo || hospital?.images?.[0] || "/api/placeholder/800/1200";
 // Backend already formats `distance` as a string (e.g. "69.3 km") for
  // nearby results. Only fall back to formatDistance() if we get raw metres.
  const distLabel =
    typeof hospital?.distance === "string"
      ? hospital.distance
      : formatDistance(hospital?.distanceMetres ?? hospital?.distance);

  const accreditations = hospital?.accreditations?.slice(0, 3) ?? [];
  const specialties = hospital?.specialties?.slice(0, 3) ?? [];

  return (
    <article
      className="group relative min-w-[340px] md:min-w-[400px] h-[560px] rounded-[var(--r-box)] overflow-hidden bg-base-100 border border-base-300 transition-all duration-500 hover:border-primary/50 shadow-sm hover:shadow-[var(--shadow-xl)] snap-start shrink-0 flex flex-col"
      aria-label={`Hospital: ${hospital.name}`}
    >
      {/* ── Background Image ── */}
      <div className="absolute inset-0 z-0 overflow-hidden bg-base-200">
        <Image
          src={imageSrc}
          alt={`${hospital.name}`}
          fill
          sizes="(max-width: 768px) 340px, 400px"
          priority={isPriority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 opacity-90"
        />
        {/* Dual gradient: top fade + strong bottom fade */}
        <div
          className="absolute inset-0 pointer-events-none bg-[linear-gradient(to top, var(--base-100) 0%, color-mix(in oklch,var(--base-100) 60%,transparent) 45%, transparent 100%), linear-gradient(to bottom, color-mix(in oklch,var(--base-100) 30%,transparent) 0%, transparent 35%)]"
          aria-hidden="true"
        />
      </div>

      {/* ── Top Bar ── */}
      <div className="absolute top-5 inset-x-5 flex justify-between items-start z-20 pointer-events-none">
        {/* Left: verified + type */}
        <div className="flex flex-col gap-1.5">
          {hospital.isVerified && (
            <div
              className="w-7 h-7 rounded-full bg-success text-success-content flex items-center justify-center shadow-lg"
              title="NABH Verified"
            >
              <ShieldCheck size={14} aria-hidden="true" />
            </div>
          )}
          <span className="px-2.5 py-1 rounded-full bg-primary text-primary-content text-[10px] font-black tracking-[0.12em] uppercase shadow">
            {hospital.hospitalType || "Multi-Specialty"}
          </span>
        </div>

        {/* Right: rating + distance */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5 bg-base-100/90 backdrop-blur-md border border-base-300 px-2.5 py-1.5 rounded-full shadow">
            <Star
              size={11}
              className="text-accent fill-accent"
              aria-hidden="true"
            />
            <span className="text-xs font-black text-base-content font-poppins leading-none">
              {hospital.rating?.averageRating?.toFixed(1) ?? "—"}
            </span>
            {hospital.rating?.totalReviews > 0 && (
              <span className="text-[11px] text-base-content/40 font-poppins">
                ({hospital.rating.totalReviews})
              </span>
            )}
          </div>
          {distLabel && (
            <div className="flex items-center gap-1 bg-base-100/80 backdrop-blur-sm border border-base-300 px-2 py-1 rounded-full shadow text-[11px] font-bold text-base-content/70 font-poppins">
              <MapPin size={8} />
              {distLabel}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Slide-up Panel ── */}
      <div className="absolute inset-x-0 bottom-0 z-10 transform translate-y-[148px] group-hover:translate-y-0 transition-transform duration-500 ease-in-out">
        {/* Accreditation pills — visible above the card fold */}
        {accreditations.length > 0 && (
          <div className="flex gap-1.5 px-5 pb-2 flex-wrap">
            {accreditations.map((a) => (
              <span
                key={a}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${ACCRED_COLOR[a] ?? ACCRED_COLOR.Other}`}
              >
                <Award size={8} />
                {a}
              </span>
            ))}
          </div>
        )}

        <div className="bg-base-100 border-t border-base-300 p-5">
          {/* Status + 24/7 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-black uppercase border border-success/20">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Available Now
            </div>
            {hospital.is24x7 && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-info/10 text-info text-[10px] font-black uppercase border border-info/30">
                <Clock size={8} />
                24 × 7
              </div>
            )}
            {hospital.isEmergencyReady && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-error/10 text-error text-[10px] font-black uppercase border border-error/30">
                <Zap size={8} />
                ER
              </div>
            )}
          </div>

          {/* Hospital Name */}
          <h3 className="text-xl font-black text-base-content leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-1 font-montserrat">
            {hospital.name}
          </h3>

          {/* Address */}
          {(hospital.address?.city || hospital.address?.line1) && (
            <p className="text-[10px] text-base-content/50 font-poppins mb-3 line-clamp-1 flex items-center gap-1">
              <MapPin size={9} />
              {[
                hospital.address.line1,
                hospital.address.city,
                hospital.address.state,
              ]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-0 border border-base-300 mb-3 rounded-[var(--r-field)] overflow-hidden bg-base-200/50">
            <StatCell
              icon={Bed}
              value={hospital.bedCount?.total ?? 0}
              label="Beds"
              color="text-primary"
            />
            <StatCell
              icon={Bed}
              value={hospital.bedCount?.icu ?? 0}
              label="ICU"
              color="text-error"
            />
            <StatCell
              icon={Stethoscope}
              value={hospital.specialties?.length ?? 0}
              label="Depts"
              color="text-secondary"
            />
            <StatCell
              icon={Users}
              value={hospital.linkedDoctors?.length ?? 0}
              label="Doctors"
              color="text-accent"
            />
          </div>

          {/* Facility pills */}
          <div className="flex flex-wrap gap-1 mb-3">
            <FacilityPill
              icon={Droplets}
              label="Blood Bank"
              active={hospital.hasBloodBank}
              colorClass="text-error"
            />
            <FacilityPill
              icon={FlaskConical}
              label="Diagnostics"
              active={hospital.hasDiagnostics}
              colorClass="text-secondary"
            />
            <FacilityPill
              icon={Heart}
              label="ICU"
              active={hospital.hasICU}
              colorClass="text-primary"
            />
            <FacilityPill
              icon={Building2}
              label="Pharmacy"
              active={hospital.hasPharmacy}
              colorClass="text-success"
            />
          </div>

          {/* Specialties */}
          {specialties.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-[var(--r-selector)] bg-base-200 border border-base-300 text-[10px] font-bold text-base-content/60 uppercase tracking-wider"
                >
                  {s}
                </span>
              ))}
              {(hospital.specialties?.length ?? 0) > 3 && (
                <span className="px-2 py-0.5 rounded-[var(--r-selector)] bg-primary/10 border border-primary/20 text-[10px] font-black text-primary uppercase tracking-wider">
                  +{hospital.specialties.length - 3} more
                </span>
              )}
            </div>
          )}

          {/* Contact */}
          {hospital.contact?.phone && (
            <a
              href={`tel:${hospital.contact.emergencyPhone || hospital.contact.phone}`}
              className="flex items-center gap-2 text-[10px] font-bold text-base-content/50 hover:text-primary transition-colors mb-4 font-poppins"
              aria-label={`Call ${hospital.name}`}
            >
              <Phone size={10} />
              {hospital.contact.emergencyPhone || hospital.contact.phone}
              {hospital.contact.emergencyPhone && (
                <span className="text-error text-[10px] font-black uppercase ml-1">
                  Emergency
                </span>
              )}
            </a>
          )}

          {/* CTA Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Link
              href={`/book-appointment?type=doctor_consultation&hospital=${hospital._id}`}
              className="h-11 rounded-[var(--r-field)] bg-primary text-primary-content font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:brightness-110 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary outline-none shadow"
              aria-label={`Book appointment at ${hospital.name}`}
            >
              Book Now <ArrowUpRight size={12} />
            </Link>
            <Link
              href={`/hospitals/${hospital?.slug}`}
              className="h-11 rounded-[var(--r-field)] bg-base-200 border border-base-300 text-base-content font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary outline-none"
              aria-label={`View details for ${hospital.name}`}
            >
              View Details
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
});
HospitalCard.displayName = "HospitalCard";

// ─── Stat Cell ────────────────────────────────────────────────────────────────

const StatCell = memo(
  ({ icon: Icon, value, label, color = "text-primary" }) => (
    <div className="flex flex-col items-center justify-center p-2.5 border-r border-base-300 last:border-r-0">
      <Icon size={13} className={`${color} mb-0.5`} aria-hidden="true" />
      <span className="text-base-content font-black text-sm font-poppins leading-none">
        {value}
      </span>
      <span className="text-base-content/40 text-[7px] uppercase font-bold tracking-tight mt-0.5">
        {label}
      </span>
    </div>
  ),
);
StatCell.displayName = "StatCell";

// ─── Location Bar ─────────────────────────────────────────────────────────────

const LocationBar = memo(
  ({
    mode,
    manualAddress,
    locationLabel,
    onUseGPS,
    onManualSearch,
    onClear,
    gpsLoading,
    gpsError,
  }) => {
    const [inputVal, setInputVal] = useState(manualAddress || "");

    const isGPSActive = mode === "nearby" || mode === "user";

    const modeLabel =
      mode === "user"
        ? `📍 Near ${locationLabel || "your saved location"} • 100 km`
        : mode === "nearby"
          ? "📍 Near your current location • 100 km"
          : mode === "manual-near"
            ? `🔍 Near "${manualAddress}" • 100 km`
            : mode === "manual"
              ? `🔍 Filtered by "${manualAddress}"`
              : "Showing all hospitals";

    return (
      <div className="flex flex-wrap items-center gap-2.5 mb-10 px-4">
        {/* GPS Button */}
        <button
          onClick={onUseGPS}
          disabled={gpsLoading || mode === "user"}
          className={`flex items-center gap-2 h-10 px-4 rounded-[var(--r-field)] border text-[10px] font-black uppercase tracking-widest transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed
          ${
            isGPSActive
              ? "bg-primary text-primary-content border-primary shadow-primary"
              : "bg-base-100 text-base-content border-base-300 hover:border-primary hover:text-primary"
          }`}
        >
          {gpsLoading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Navigation size={13} />
          )}
          {mode === "user"
            ? "Location Active ✓"
            : mode === "nearby"
              ? "Near Me ✓"
              : "Use My Location"}
        </button>

        {/* Manual Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs h-10 px-3 rounded-[var(--r-field)] border border-base-300 bg-base-100 focus-within:border-primary transition-colors">
          <MapPin size={12} className="text-base-content/30 shrink-0" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              inputVal.trim().length > 2 &&
              onManualSearch(inputVal.trim())
            }
            placeholder="City or area…"
            className="flex-1 bg-transparent text-xs text-base-content placeholder:text-base-content/30 outline-none font-poppins"
          />
          {inputVal && (
            <button
              onClick={() => {
                setInputVal("");
                onClear();
              }}
              className="text-base-content/30 hover:text-base-content transition-colors"
              aria-label="Clear search"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Search Button */}
        <button
          onClick={() =>
            inputVal.trim().length > 2 && onManualSearch(inputVal.trim())
          }
          className="flex items-center gap-2 h-10 px-4 rounded-[var(--r-field)] border border-base-300 bg-base-100 text-[10px] font-black uppercase tracking-widest hover:border-primary hover:text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Search size={12} /> Search
        </button>

        {/* Mode label */}
        <span className="text-[10px] text-base-content/40 font-poppins hidden sm:block">
          {modeLabel}
        </span>

        {gpsError && (
          <span className="text-[10px] text-error font-poppins font-bold">
            {gpsError}
          </span>
        )}
      </div>
    );
  },
);
LocationBar.displayName = "LocationBar";

// ─── Section Header Stat ──────────────────────────────────────────────────────

const HeaderStat = memo(({ value, label }) => (
  <div className="flex flex-col items-center px-6 py-3 border border-base-300 rounded-[var(--r-box)] bg-base-100">
    <span className="text-2xl font-black text-primary font-montserrat leading-none">
      {value}
    </span>
    <span className="text-[11px] font-bold text-base-content/40 uppercase tracking-widest mt-1 font-poppins">
      {label}
    </span>
  </div>
));
HeaderStat.displayName = "HeaderStat";

// ─── Main Component ───────────────────────────────────────────────────────────

const HomeHospitals = () => {
  const scrollRef = useRef(null);
  const dispatch = useDispatch();

  const user = useSelector((s) => s.user?.user) ?? null;
  const allHospitals = useSelector(selectHospitals);
  const nearbyHospitals = useSelector(selectNearbyHospitals);
  const loadingAll = useSelector(selectIsLoadingHospitals);
  const loadingNearby = useSelector(selectIsLoadingNearbyHospitals);

  const [mode, setMode] = useState("all");
  const [manualAddress, setManualAddress] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState("");

  const isNearbyMode =
    mode === "user" || mode === "nearby" || mode === "manual-near";
  const hospitals = isNearbyMode ? nearbyHospitals : allHospitals;
  const loading = isNearbyMode ? loadingNearby : loadingAll;

  // ── Initial fetch + react to header location changes ───────────────────────
  const savedLng = user?.location?.coordinates?.[0];
  const savedLat = user?.location?.coordinates?.[1];

  useEffect(() => {
    // Don't override an active GPS / manual search the user picked on this page.
    if (mode === "nearby" || mode === "manual" || mode === "manual-near")
      return;

    if (
      savedLat != null &&
      savedLng != null &&
      (savedLng !== 0 || savedLat !== 0)
    ) {
      dispatch(
        fetchNearbyHospitals({ lat: savedLat, lng: savedLng, limit: 12 }),
      );
      setMode("user");
      setLocationLabel(user.lastKnownAddress || "your saved location");
      return;
    }
    if (!allHospitals?.length) dispatch(fetchAllHospitals({ limit: 12 }));
    setMode("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id, savedLat, savedLng]);

  // ── GPS ───────────────────────────────────────────────────────────────────
  const handleUseGPS = useCallback(() => {
    if (mode === "user") return;
    if (!navigator.geolocation) {
      setGpsError("Geolocation not supported. Enter your area manually.");
      return;
    }
    setGpsLoading(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        dispatch(
          fetchNearbyHospitals({
            lat: coords.latitude,
            lng: coords.longitude,
            limit: 12,
          }),
        );
        setMode("nearby");
        setManualAddress("");
        setGpsLoading(false);
      },
      (err) => {
        setGpsError(
          err.code === 1
            ? "Permission denied. Enter your area manually."
            : "Could not get location. Enter manually.",
        );
        setGpsLoading(false);
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  }, [dispatch, mode]);

  // ── Manual search ─────────────────────────────────────────────────────────
  const handleManualSearch = useCallback(
    async (address) => {
      setGpsError("");
      const coords = await geocodeAddress(address);
      if (coords) {
        dispatch(
          fetchNearbyHospitals({ lat: coords.lat, lng: coords.lng, limit: 12 }),
        );
        setMode("manual-near");
      } else {
        dispatch(fetchAllHospitals({ city: address, limit: 12 }));
        setMode("manual");
      }
      setManualAddress(address);
    },
    [dispatch],
  );

  // ── Clear ─────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setGpsError("");
    setManualAddress("");
    if (user?.location?.coordinates) {
      const [lng, lat] = user.location.coordinates;
      if (lng !== 0 || lat !== 0) {
        dispatch(fetchNearbyHospitals({ lat, lng, limit: 12 }));
        setMode("user");
        return;
      }
    }
    if (!allHospitals?.length) dispatch(fetchAllHospitals({ limit: 12 }));
    setMode("all");
  }, [dispatch, user, allHospitals]);

  const scroll = useCallback((dir) => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -420 : 420,
      behavior: "smooth",
    });
  }, []);

  const hospitalCount = hospitals?.length ?? 0;

  return (
    <section
      className="py-24 bg-base-100 relative overflow-hidden"
      aria-label="Top Hospitals and Medical Centers"
    >
      {/* Background grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,var(--base-content)_1px,transparent_1px),linear-gradient(to_bottom,var(--base-content)_1px,transparent_1px)] bg-[length:48px_48px]"
        aria-hidden="true"
      />
      {/* Subtle radial accent */}
      <div
        className="absolute top-0 right-0 w-[600px] h-[600px] pointer-events-none opacity-5 bg-[radial-gradient(circle at top right, var(--primary), transparent 70%)]"
        aria-hidden="true"
      />

      <div className="  relative z-10">
        {/* ── Header ── */}
        <header className="flex flex-col xl:flex-row xl:items-end justify-between mb-12 px-4 gap-10">
          <div className="max-w-2xl">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-black uppercase tracking-[0.14em] mb-5">
              <ShieldCheck size={10} />
              Verified Medical Network
            </div>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-base-content tracking-tighter leading-[1.02] mb-5 font-montserrat">
              Find <span className="text-gradient-primary">Top-Rated</span>
              <br className="hidden md:block" />
              Hospitals &amp; Clinics
            </h2>

            <div
              className="h-1 w-20 mb-6 rounded-full bg-bg-gradient-primary"
              aria-hidden="true"
            />

            <p className="text-base-content/60 text-sm md:text-base font-medium max-w-lg leading-relaxed font-poppins">
              Real-time{" "}
              <strong className="text-base-content">bed availability</strong>,{" "}
              <span className="text-primary font-semibold">
                specialist departments
              </span>
              , accreditation status, and{" "}
              <span className="text-error font-semibold">
                emergency contacts
              </span>{" "}
              — all in one place.
            </p>
          </div>

          {/* Right side — stats + scroll controls */}
          <div className="flex flex-col items-start xl:items-end gap-5">
            {/* Quick stats */}
            <div className="flex items-center gap-3">
              <HeaderStat
                value={hospitalCount > 0 ? `${hospitalCount}+` : "—"}
                label="Facilities"
              />
              <HeaderStat value="100 km" label="Search Radius" />
              <HeaderStat value="24/7" label="ER Access" />
            </div>

            {/* Scroll arrows */}
            <div className="flex border border-base-300 rounded-[var(--r-field)] overflow-hidden bg-base-100 shadow-sm">
              <button
                onClick={() => scroll("left")}
                aria-label="Scroll left"
                className="w-12 h-12 text-base-content hover:bg-primary hover:text-primary-content transition-colors flex items-center justify-center border-r border-base-300 outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => scroll("right")}
                aria-label="Scroll right"
                className="w-12 h-12 text-base-content hover:bg-primary hover:text-primary-content transition-colors flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </header>

        {/* ── Divider ── */}
        <div className="h-px bg-base-300 mx-4 mb-8" aria-hidden="true" />

        {/* ── Location Bar ── */}
        <LocationBar
          mode={mode}
          manualAddress={manualAddress}
          locationLabel={locationLabel}
          onUseGPS={handleUseGPS}
          onManualSearch={handleManualSearch}
          onClear={handleClear}
          gpsLoading={gpsLoading}
          gpsError={gpsError}
        />

        {/* ── Cards Carousel ── */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto pb-10 px-4 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          role="region"
          aria-label="List of hospitals"
        >
          {loading ? (
            [...Array(4)].map((_, i) => <HospitalCardSkeleton key={i} />)
          ) : hospitals?.length > 0 ? (
            <>
              {hospitals.map((hospital, index) => (
                <HospitalCard
                  key={hospital._id}
                  hospital={hospital}
                  index={index}
                />
              ))}

              {/* View All card */}
              <Link
                href="/hospitals"
                className="min-w-[280px] h-[560px] rounded-[var(--r-box)] border-2 border-dashed border-base-300 bg-base-100/50 flex flex-col items-center justify-center hover:bg-primary/5 hover:border-primary/40 transition-all duration-300 group snap-start shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="View all healthcare facilities"
              >
                <div className="w-14 h-14 rounded-[var(--r-field)] border border-base-300 flex items-center justify-center text-base-content/30 group-hover:bg-primary group-hover:text-primary-content group-hover:border-primary transition-all duration-300">
                  <Plus size={28} />
                </div>
                <span className="mt-4 text-[10px] font-black text-base-content/40 uppercase tracking-widest group-hover:text-primary transition-colors">
                  View All Facilities
                </span>
                <span className="mt-1 text-[11px] text-base-content/30 font-poppins">
                  Browse full directory
                </span>
              </Link>
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center min-w-full py-24 text-base-content/40 gap-4">
              <div className="w-16 h-16 rounded-[var(--r-box)] border border-base-300 bg-base-200 flex items-center justify-center">
                <MapPin size={28} className="opacity-30" />
              </div>
              <p className="text-sm font-poppins font-medium">
                {isNearbyMode
                  ? "No hospitals found within 100 km. Try a different area."
                  : "No hospitals available right now."}
              </p>
              {isNearbyMode && (
                <button
                  onClick={handleClear}
                  className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline"
                >
                  Show all hospitals instead
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="flex justify-center mt-2 px-4">
          <Link
            href="/hospitals"
            className="inline-flex items-center gap-2 h-11 px-8 rounded-[var(--r-field)] border border-base-300 bg-base-100 text-[10px] font-black uppercase tracking-widest text-base-content hover:bg-primary hover:text-primary-content hover:border-primary transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary outline-none"
          >
            Explore All Hospitals <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HomeHospitals;
