"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchHospitalBySlug,
  clearSelectedHospital,
  selectSelectedHospital,
  selectIsLoadingSelectedHospital,
  selectHospitalError,
} from "@/store/slices/hospitalSlice";
import {
  MapPin,
  Phone,
  Globe,
  ShieldCheck,
  Bed,
  Stethoscope,
  Zap,
  ArrowLeft,
  Share2,
  Mail,
  Star,
  Activity,
  Award,
  Navigation,
  HeartPulse,
  LayoutGrid,
  Clock,
  AlertCircle,
  Building2,
  CheckCircle2,
  Ambulance,
  FlaskConical,
  Pill,
  Microscope,
  Users,
  FileText,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Droplets,
  MessageSquare,
  PhoneCall,
  ExternalLink,
  Video,
  Home,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { MdOutlineWheelchairPickup } from "react-icons/md";
import SpecialButton from "@/components/SpecialButton";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
};

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const StarRating = ({ value = 0, size = 14 }) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <span className="flex items-center gap-0.5">
      {stars.map((s) => (
        <Star
          key={s}
          size={size}
          className={
            s <= Math.round(value)
              ? "fill-amber-400 text-amber-400"
              : "fill-base-300 text-base-300"
          }
        />
      ))}
    </span>
  );
};

const FlagChip = ({ active, icon: Icon, label }) => (
  <div
    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-semibold transition-colors ${
      active
        ? "bg-success/10 border-success/30 text-success"
        : "bg-base-200 border-base-300 text-base-content/40 line-through"
    }`}
  >
    <Icon size={14} />
    {label}
  </div>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-base-content/50 mb-5">
    <Icon size={14} />
    {children}
  </h3>
);

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const BOOKING_ROUTE = "/book-appointment";

const CONSULTATION_TYPE_CONFIG = {
  inPerson: {
    key: "inPerson",
    label: "In-Person",
    icon: Stethoscope,
    bookingType: "doctor_consultation",
    consultationType: "inPerson",
    feeKey: "inPersonFee",
    needsHospital: true,
  },
  video: {
    key: "video",
    label: "Video Call",
    icon: Video,
    bookingType: "doctor_online",
    consultationType: "video",
    feeKey: "videoFee",
    needsHospital: false,
  },
  homeVisit: {
    key: "homeVisit",
    label: "Home Visit",
    icon: Home,
    bookingType: "doctor_consultation",
    consultationType: "homeVisit",
    feeKey: "homeVisitFee",
    needsHospital: true,
  },
};

// HELPER: Get correct pricing (handles both doctor-level and hospital-level pricing)
const getPricing = (doctor, hospital) => {
  if (doctor.fees && Object.keys(doctor.fees).length > 0) return doctor.fees;
  return (
    hospital?.consultationPricing ||
    hospital?.pricingInfo?.consultationPricing ||
    {}
  );
};

const resolveDoctorFee = (doctor, hospital, config) => {
  const pricing = getPricing(doctor, hospital);
  const specific = pricing[config.feeKey];
  const hasSpecific = specific !== null && specific !== undefined;
  return {
    amount: hasSpecific ? specific : pricing.inPersonFee || pricing.consultationFee || 0,
    isFallback: !hasSpecific,
  };
};

const buildDoctorBookHref = (hospital, doctor, config) => {
  const params = new URLSearchParams();
  if (config.needsHospital && hospital?._id) {
    params.set("hospital", hospital._id);
  }
  if (doctor?._id) params.set("doctor", doctor._id);
  if (doctor?.user?.name) params.set("name", doctor.user.name);
  if (doctor?.specialization) params.set("spec", doctor.specialization);
  params.set("type", config.bookingType);
  params.set("consultationType", config.consultationType);
  return `${BOOKING_ROUTE}?${params.toString()}`;
};

const buildHospitalBookHref = (hospital) => {
  const params = new URLSearchParams();
  if (hospital?._id) params.set("hospital", hospital._id);
  if (hospital?.name) params.set("name", hospital.name);
  return `${BOOKING_ROUTE}?${params.toString()}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonLoader = () => (
  <div className="min-h-screen bg-base-100 pb-24 animate-pulse">
    <div className="container-custom py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="w-40 h-5 bg-base-300 rounded-full mb-10" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 space-y-6">
          <div className="aspect-video w-full bg-base-300 rounded-2xl" />
          <div className="space-y-3">
            <div className="w-1/4 h-5 bg-base-300 rounded-full" />
            <div className="w-3/4 h-12 bg-base-300 rounded-xl" />
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-20 h-7 bg-base-300 rounded-lg" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-full h-4 bg-base-300 rounded-full" />
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-base-300 rounded-2xl" />
            ))}
          </div>
          <div className="h-72 bg-base-300 rounded-2xl" />
        </div>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR CARD
// ─────────────────────────────────────────────────────────────────────────────

const DoctorCard = ({ doctor, hospital }) => {
  const initials = doctor.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const bookOptions = Object.values(CONSULTATION_TYPE_CONFIG).filter(
    (c) => doctor.consultationTypes?.[c.key]
  );

  const pricing = getPricing(doctor, hospital);
  const baseFee = pricing.inPersonFee || pricing.consultationFee || 0;
  const followUpFee = pricing.followUpFee || 0;
  const followUpDiscountPercent = pricing.followUpDiscountPercent || 0;
  const followUpValidDays = pricing.followUpValidDays || 0;

  return (
    <div className="card p-5 border border-base-200 hover:border-primary/30 transition-all bg-base-100 shadow-sm hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="avatar placeholder shrink-0">
          <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary font-bold text-base flex items-center justify-center overflow-hidden">
            {doctor.user?.avatar ? (
              <img src={doctor.user.avatar} alt={doctor.user.name} className="w-full h-full object-cover" />
            ) : (
              initials || "DR"
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-base-content truncate">
              {doctor.user?.name || "Unknown"}
            </p>
            {doctor.isVerified && (
              <BadgeCheck size={15} className="text-success shrink-0" />
            )}
          </div>
          <p className="text-[11px] text-primary font-semibold mt-0.5">
            {doctor.specialization}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <StarRating value={doctor.rating?.averageRating || 0} size={12} />
            <span className="text-[11px] text-base-content/50">
              {doctor.rating?.averageRating?.toFixed(1) || "—"} (
              {doctor.rating?.totalRatings || 0})
            </span>
          </div>
        </div>
        <span
          className={`badge badge-xs shrink-0 ${
            doctor.isOnline ? "badge-success" : "badge-secondary"
          }`}
        >
          {doctor.isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-base-200 grid grid-cols-3 gap-2 text-center bg-base-50 rounded-xl">
        <div>
          <p className="text-xs font-black text-base-content">
            {doctor.experienceYears}
            <span className="text-[11px] font-semibold text-base-content/50 ml-1">
              yr
            </span>
          </p>
          <p className="text-[11px] text-base-content/50">Experience</p>
        </div>
        <div>
          <p className="text-xs font-black text-primary">
            ₹{baseFee}
          </p>
          <p className="text-[11px] text-base-content/50">Consult</p>
        </div>
        <div>
          <p className="text-xs font-black text-base-content">
            ₹{followUpFee}
          </p>
          <p className="text-[11px] text-base-content/50">Follow-up</p>
        </div>
      </div>

      {bookOptions.length > 0 ? (
        <div className="mt-4 pt-4 border-t border-base-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {bookOptions.map((config) => {
            const { amount, isFallback } = resolveDoctorFee(doctor, hospital, config);
            const Icon = config.icon;
            return (
              <SpecialButton
                key={config.key}
                href={buildDoctorBookHref(hospital, doctor, config)}
                nav="doctors"
                variant={config.key === "inPerson" ? "solid" : "soft"}
                size="sm"
                animation="lift"
                textAnimation="fade"
                uppercase={false}
                icon={Icon}
                className="w-full h-10 justify-start"
              >
                <span className="flex flex-col items-start  leading-tight text-left">
                  <span className="text-[11px] font-bold">
                    {config.label}
                  </span>
                  <span className="text-[10px] font-semibold opacity-70">
                    ₹{amount}
                    {isFallback && " · standard fee"}
                  </span>
                </span>
              </SpecialButton>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-base-200">
          <SpecialButton
            href={buildDoctorBookHref(
              hospital,
              doctor,
              CONSULTATION_TYPE_CONFIG.inPerson
            )}
            nav="doctor"
            variant="soft"
            role="doctor"
            size="sm"
            animation="lift"
            textAnimation="fade"
            uppercase={false}
            icon={CalendarCheck}
            fullWidth
          >
            <span className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-bold">Book Consultation</span>
              <span className="text-[10px] font-semibold opacity-70">
                ₹{baseFee} · standard fee
              </span>
            </span>
          </SpecialButton>
        </div>
      )}

      {/* Qualifications */}
      {doctor.qualifications?.length > 0 && (
        <div className="mt-4 space-y-1">
          {doctor.qualifications.map((q, i) => (
            <p key={i} className="text-[11px] text-base-content/60">
              <span className="font-semibold text-base-content/80">
                {q.degree}
              </span>{" "}
              — {q.college}, {q.year}
            </p>
          ))}
        </div>
      )}

      {/* Follow-up discount badge */}
      {followUpDiscountPercent > 0 && (
        <div className="mt-3">
          <span className="badge badge-xs badge-success gap-1 border border-success/30">
            {followUpDiscountPercent}% follow-up discount · {followUpValidDays} days
          </span>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERATING HOURS TABLE
// ─────────────────────────────────────────────────────────────────────────────

const OperatingHoursTable = ({ hours }) => {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="divide-y divide-base-300">
      {hours.map((h) => {
        const isToday = h.day === today;
        return (
          <div
            key={h._id || h.day}
            className={`flex items-center justify-between py-2.5 px-1 text-xs ${
              isToday ? "text-primary font-bold" : "text-base-content"
            }`}
          >
            <span className="w-28 font-semibold">
              {h.day}
              {isToday && (
                <span className="ml-2 badge badge-xs badge-primary">Today</span>
              )}
            </span>
            {h.isClosed ? (
              <span className="text-error font-semibold text-[11px] uppercase tracking-wider">
                Closed
              </span>
            ) : h.is24Hours ? (
              <span className="text-success font-semibold text-[11px] uppercase tracking-wider">
                24 Hours
              </span>
            ) : (
              <span className="text-base-content/70 font-medium">
                {formatTime(h.openTime)} – {formatTime(h.closeTime)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const HospitalDetails = () => {
  const { slug } = useParams();
  const router = useRouter();
  const dispatch = useDispatch();

  const hospital = useSelector(selectSelectedHospital);
  const isLoading = useSelector(selectIsLoadingSelectedHospital);
  const error = useSelector(selectHospitalError);

  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (slug) dispatch(fetchHospitalBySlug(slug));
    return () => dispatch(clearSelectedHospital());
  }, [dispatch, slug]);

  useEffect(() => {
    if (hospital?.images?.length > 0) setActiveImage(0);
  }, [hospital]);

  const handleShare = async () => {
    try {
      await navigator.share({
        title: hospital?.name,
        text: `Check out ${hospital?.name}`,
        url: window.location.href,
      });
    } catch {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    }
  };

  // ── Loading ──
  if (isLoading || (!hospital && !error)) return <SkeletonLoader />;

  // ── Error ──
  if (error || !hospital)
    return (
      <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-3 md:p-4 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full card p-10 bg-base-100 shadow-xl border border-base-200"
        >
          <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={40} strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-black tracking-tight mb-3">
            Facility Not Found
          </h2>
          <p className="text-base-content/60 mb-8 font-medium">
            {error ||
              "This facility does not exist or has been removed from the registry."}
          </p>
          <button
            onClick={() => router.push("/hospitals")}
            className="btn btn-error w-full text-error-content rounded-xl"
          >
            Return to Directory
          </button>
        </motion.div>
      </div>
    );

  // ── Derived values ──
  const lng = hospital.location?.coordinates?.[0];
  const lat = hospital.location?.coordinates?.[1];
  const mapsUrl =
    lat && lng
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : hospital.googleMapsUrl || null;

  const displayImages =
    hospital.images?.length > 0
      ? hospital.images
      : [
          hospital.logo ||
            "https://placehold.co/800x500/f3f4f6/a1a1aa?text=No+Image",
        ];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "doctors", label: `Doctors (${hospital.linkedDoctors?.length || 0})` },
    { id: "hours", label: "Hours" },
    { id: "legal", label: "Legal" },
  ];

  const hospitalBookHref = buildHospitalBookHref(hospital);

  return (
    <main className="min-h-screen bg-base-100 pb-24">
      <div className="container-custom py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Top Nav ── */}
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <Link
            href="/hospitals"
            className="group flex items-center gap-2 text-xs font-semibold text-base-content/60 hover:text-base-content transition-colors"
          >
            <div className="p-2 rounded-xl bg-base-200 border border-base-300 group-hover:bg-primary group-hover:text-primary-content group-hover:border-primary transition-all">
              <ArrowLeft size={15} />
            </div>
            Hospital Directory
          </Link>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="btn btn-ghost border border-base-300 rounded-xl"
              title="Share"
            >
              <Share2 size={16} />
            </button>
            <button className="btn btn-ghost border border-base-300 rounded-xl group">
              <HeartPulse
                size={16}
                className="text-base-content/40 group-hover:text-error transition-colors"
              />
            </button>
          </div>
        </div>

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14">

          {/* ══════════════════════════════════════════════
              LEFT COLUMN
          ══════════════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-8">

            {/* ── Gallery ── */}
            <section>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative mb-3"
              >
                <div className="aspect-video w-full rounded-2xl overflow-hidden border border-base-300 bg-base-200 shadow-sm">
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={activeImage}
                      initial={{ opacity: 0, scale: 1.04 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      src={displayImages[activeImage]}
                      alt={hospital.name}
                      className="w-full h-full object-cover"
                    />
                  </AnimatePresence>
                </div>

                {/* Verified badge */}
                {hospital.isVerified && (
                  <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md text-success px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide shadow-md border border-success/20">
                    <ShieldCheck size={14} /> Verified
                  </div>
                )}

                {/* Active badge */}
                {!hospital.isActive && (
                  <div className="absolute top-4 right-4 bg-error/90 text-error-content px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wide">
                    Inactive
                  </div>
                )}

                {/* Prev/next arrows for multi-image */}
                {displayImages.length > 1 && (
                  <>
                    <button
                      onClick={() =>
                        setActiveImage((p) =>
                          p === 0 ? displayImages.length - 1 : p - 1
                        )
                      }
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-base-100/80 backdrop-blur-sm rounded-xl border border-base-300 hover:bg-base-100 transition-all cursor-pointer"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      onClick={() =>
                        setActiveImage((p) =>
                          p === displayImages.length - 1 ? 0 : p + 1
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-base-100/80 backdrop-blur-sm rounded-xl border border-base-300 hover:bg-base-100 transition-all cursor-pointer"
                    >
                      <ChevronRight size={18} />
                    </button>
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {displayImages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImage(i)}
                          className={`h-1.5 rounded-full transition-all cursor-pointer ${
                            i === activeImage
                              ? "w-6 bg-primary"
                              : "w-1.5 bg-white/60"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </motion.div>

              {/* Thumbnails */}
              {displayImages.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                  {displayImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        activeImage === idx
                          ? "border-primary shadow-sm"
                          : "border-transparent opacity-55 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={img}
                        className="w-full h-full object-cover"
                        alt={`Thumb ${idx + 1}`}
                      />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* ── Identity ── */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary badge-sm py-2.5 font-bold">{hospital.hospitalType}</span>
                <span className="badge badge-secondary badge-sm py-2.5 text-[11px] font-bold">
                  {hospital.managementModel === "hospital-manager"
                    ? "Managed Hospital"
                    : "Doctor-Owned"}
                </span>
                {hospital.is24x7 && (
                  <span className="badge badge-success badge-sm py-2.5 font-bold">24×7</span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-base-content leading-tight">
                {hospital.name}
              </h1>

              {/* Rating row */}
              {hospital.rating?.totalRatings > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/60 px-3 py-1.5 rounded-xl">
                    <StarRating value={hospital.rating.averageRating} />
                    <span className="font-black text-amber-700 text-xs">
                      {hospital.rating.averageRating.toFixed(1)}
                    </span>
                    <span className="text-amber-600/70 text-[11px] font-medium">
                      ({hospital.rating.totalRatings} ratings ·{" "}
                      {hospital.rating.totalReviews} reviews)
                    </span>
                  </div>
                </div>
              )}

              {/* Address */}
              <div className="flex items-start gap-2 text-base-content/70 text-xs font-medium">
                <MapPin size={15} className="text-primary shrink-0 mt-0.5" />
                <span>
                  {hospital.address?.line1}
                  {hospital.address?.line2 && `, ${hospital.address.line2}`}
                  {hospital.address?.landmark &&
                    ` (Near ${hospital.address.landmark})`}
                  , {hospital.address?.city}, {hospital.address?.state} –{" "}
                  {hospital.address?.pincode}
                </span>
              </div>

              {/* Description */}
              {hospital.description && (
                <p className="text-base text-base-content/70 leading-relaxed font-medium">
                  {hospital.description}
                </p>
              )}

              {/* Book at hospital CTA */}
              <div className="pt-4">
                <SpecialButton
                  href={hospitalBookHref}
                  nav="hospitals"
                  variant="solid"
                  size="lg"
                  animation="lift"
                  textAnimation="fade"
                  icon={CalendarCheck}
                  fullWidth
                >
                  Book Appointment at {hospital.name}
                </SpecialButton>
              </div>
            </section>

            {/* ── Tabs ── */}
            <div className="pt-4">
              <div className="flex gap-1 bg-base-200 p-1.5 rounded-xl border border-base-300 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-base-100 text-primary shadow-sm border border-base-200"
                        : "text-base-content/60 hover:text-base-content hover:bg-base-300/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="mt-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >

                    {/* ══ TAB: OVERVIEW ══ */}
                    {activeTab === "overview" && (
                      <div className="space-y-10">

                        {/* Specialties */}
                        {hospital.specialties?.length > 0 && (
                          <div>
                            <SectionTitle icon={Stethoscope}>
                              Specialties
                            </SectionTitle>
                            <div className="flex flex-wrap gap-2">
                              {hospital.specialties.map((s, i) => (
                                <span
                                  key={i}
                                  className="px-3.5 py-1.5 bg-primary/8 border border-primary/20 text-primary text-[11px] font-bold rounded-lg"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Facilities */}
                        {hospital.facilities?.length > 0 && (
                          <div>
                            <SectionTitle icon={LayoutGrid}>
                              Facilities
                            </SectionTitle>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {hospital.facilities.map((f, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-3 p-3.5 bg-base-100 shadow-sm border border-base-200 rounded-xl text-xs font-bold text-base-content"
                                >
                                  <CheckCircle2
                                    size={18}
                                    className="text-success shrink-0"
                                  />
                                  {f}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Facility flags */}
                        <div>
                          <SectionTitle icon={Activity}>
                            Facility Features
                          </SectionTitle>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <FlagChip
                              active={hospital.isEmergencyReady}
                              icon={Zap}
                              label="Emergency"
                            />
                            <FlagChip
                              active={hospital.hasICU}
                              icon={HeartPulse}
                              label="ICU"
                            />
                            <FlagChip
                              active={hospital.hasBloodBank}
                              icon={Droplets}
                              label="Blood Bank"
                            />
                            <FlagChip
                              active={hospital.hasPharmacy}
                              icon={Pill}
                              label="Pharmacy"
                            />
                            <FlagChip
                              active={hospital.hasDiagnostics}
                              icon={Microscope}
                              label="Diagnostics"
                            />
                            <FlagChip
                              active={hospital.hasAmbulance}
                              icon={Ambulance}
                              label="Ambulance"
                            />
                            <FlagChip
                              active={hospital.hasWheelchairAccess}
                              icon={MdOutlineWheelchairPickup}
                              label="Wheelchair"
                            />
                            <FlagChip
                              active={hospital.nabledLabAvailable}
                              icon={FlaskConical}
                              label="NABL Lab"
                            />
                            <FlagChip
                              active={hospital.acceptsBloodRequests}
                              icon={Droplets}
                              label="Blood Req."
                            />
                          </div>
                        </div>

                        {/* Accreditations */}
                        {hospital.accreditations?.length > 0 && (
                          <div>
                            <SectionTitle icon={Award}>
                              Accreditations
                            </SectionTitle>
                            <div className="flex flex-wrap gap-2">
                              {hospital.accreditations.map((a, i) => (
                                <span
                                  key={i}
                                  className="badge badge-accent badge-lg font-bold px-4"
                                >
                                  {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Accepted schemes */}
                        {hospital.acceptedSchemes?.length > 0 && (
                          <div>
                            <SectionTitle icon={ShieldCheck}>
                              Accepted Schemes / Insurance
                            </SectionTitle>
                            <div className="flex flex-wrap gap-2">
                              {hospital.acceptedSchemes.map((s, i) => (
                                <span
                                  key={i}
                                  className="badge badge-secondary badge-lg font-bold px-4"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Bed count */}
                        <div>
                          <SectionTitle icon={Bed}>Bed Count</SectionTitle>
                          <div className="flex gap-4">
                            <div className="flex-1 p-5 bg-base-100 border border-base-200 shadow-sm rounded-2xl text-center">
                              <p className="text-3xl font-black text-base-content">
                                {hospital.bedCount?.total || 0}
                              </p>
                              <p className="text-[11px] font-bold text-base-content/50 uppercase tracking-widest mt-2">
                                Total Beds
                              </p>
                            </div>
                            <div className="flex-1 p-5 bg-base-100 border border-base-200 shadow-sm rounded-2xl text-center">
                              <p className="text-3xl font-black text-base-content">
                                {hospital.bedCount?.icu || 0}
                              </p>
                              <p className="text-[11px] font-bold text-base-content/50 uppercase tracking-widest mt-2">
                                ICU Beds
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ══ TAB: DOCTORS ══ */}
                    {activeTab === "doctors" && (
                      <div className="space-y-4">
                        {hospital.linkedDoctors?.length > 0 ? (
                          hospital.linkedDoctors.map((doc) => (
                            <DoctorCard
                              key={doc._id}
                              doctor={doc}
                              hospital={hospital}
                            />
                          ))
                        ) : (
                          <div className="text-center py-16 text-base-content/40 bg-base-100 border border-base-200 rounded-2xl">
                            <Users size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="font-bold">No doctors linked yet</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ══ TAB: HOURS ══ */}
                    {activeTab === "hours" && (
                      <div>
                        <SectionTitle icon={Clock}>
                          Operating Hours
                        </SectionTitle>
                        {hospital.operatingHours?.length > 0 ? (
                          <div className="card p-5 bg-base-100 border border-base-200 shadow-sm">
                            <OperatingHoursTable
                              hours={hospital.operatingHours}
                            />
                          </div>
                        ) : (
                          <p className="text-base-content/50 text-xs font-medium bg-base-200 p-4 rounded-xl">
                            No specific operating hours listed.
                          </p>
                        )}
                        {hospital.is24x7 && (
                          <div className="alert alert-success mt-4 text-xs font-bold border-success/20 bg-success/10 rounded-xl">
                            <CheckCircle2 size={18} className="text-success" />
                            This facility operates 24×7
                          </div>
                        )}
                      </div>
                    )}

                    {/* ══ TAB: LEGAL ══ */}
                    {activeTab === "legal" && (
                      <div className="space-y-6">
                        <SectionTitle icon={FileText}>
                          Registration Details
                        </SectionTitle>
                        <div className="card overflow-hidden border border-base-200 shadow-sm bg-base-100">
                          <table className="table table-zebra w-full">
                            <tbody>
                              {[
                                {
                                  label: "License Number",
                                  value:
                                    hospital.registrationDetails?.licenseNumber,
                                },
                                {
                                  label: "GST Number",
                                  value:
                                    hospital.registrationDetails?.gstNumber,
                                },
                                {
                                  label: "PAN Number",
                                  value:
                                    hospital.registrationDetails?.panNumber,
                                },
                                {
                                  label: "License Expiry",
                                  value: formatDate(
                                    hospital.registrationDetails?.licenseExpiry
                                  ),
                                },
                                {
                                  label: "Settlement Cycle",
                                  value:
                                    hospital.settlementCycle
                                      ? hospital.settlementCycle
                                          .charAt(0)
                                          .toUpperCase() +
                                        hospital.settlementCycle.slice(1)
                                      : "—",
                                },
                                {
                                  label: "Verified At",
                                  value: formatDate(hospital.verifiedAt),
                                },
                                {
                                  label: "Onboarding",
                                  value: hospital.onboarding?.isComplete
                                    ? `Complete (Step ${hospital.onboarding.step})`
                                    : `Incomplete (Step ${hospital.onboarding?.step || 1})`,
                                },
                                {
                                  label: "Profile Created",
                                  value: formatDate(hospital.createdAt),
                                },
                                {
                                  label: "Last Updated",
                                  value: formatDate(hospital.updatedAt),
                                },
                              ]
                                .filter((r) => r.value && r.value !== "—" || r.value === "—")
                                .map(({ label, value }) => (
                                  <tr key={label} className="border-b-base-200">
                                    <td className="text-[11px] font-black uppercase tracking-wider text-base-content/60 w-44 py-4 px-4">
                                      {label}
                                    </td>
                                    <td className="font-semibold text-xs text-base-content py-4 px-4">
                                      {value || "—"}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>

                        {hospital.registrationDetails?.documentUrl && (
                          <a
                            href={hospital.registrationDetails.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-outline btn-sm gap-2 rounded-lg"
                          >
                            <ExternalLink size={14} /> View License Document
                          </a>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              RIGHT COLUMN — sticky panel
          ══════════════════════════════════════════════ */}
          <div className="lg:col-span-5">
            <div className="sticky top-24 space-y-5">

              {/* ── Logo + Quick Stats ── */}
              <div className="card p-4 md:p-5 bg-base-100 border border-base-200 shadow-sm">
                <div className="flex items-center gap-4 mb-5">
                  {hospital.logo ? (
                    <img
                      src={hospital.logo}
                      alt={`${hospital.name} logo`}
                      className="w-16 h-16 rounded-xl object-contain border border-base-300 bg-base-50 p-1 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Building2 size={28} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-black text-lg text-base-content leading-tight truncate">
                      {hospital.name}
                    </p>
                    <p className="text-[11px] font-semibold text-base-content/50 mt-1 uppercase tracking-wider">
                      {hospital.address?.city}, {hospital.address?.state}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {hospital.isVerified ? (
                        <span className="badge badge-xs badge-success gap-1 py-2 font-bold border-success/30">
                          <BadgeCheck size={11} /> Verified
                        </span>
                      ) : (
                        <span className="badge badge-xs badge-warning py-2 font-bold">
                          Unverified
                        </span>
                      )}
                      {hospital.isActive ? (
                        <span className="badge badge-xs badge-success py-2 font-bold bg-success/10 text-success border-success/30">
                          Active
                        </span>
                      ) : (
                        <span className="badge badge-xs badge-error py-2 font-bold">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stat chips */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="stat-card text-center p-3 rounded-xl bg-base-200/50 border border-base-200">
                    <div className="stat-card-value text-xl font-black text-base-content">
                      {hospital.bedCount?.total || 0}
                    </div>
                    <div className="stat-card-label text-[10px] font-bold uppercase text-base-content/50 mt-1 tracking-wider">Beds</div>
                  </div>
                  <div className="stat-card text-center p-3 rounded-xl bg-base-200/50 border border-base-200">
                    <div className="stat-card-value text-xl font-black text-base-content">
                      {hospital.linkedDoctors?.length || 0}
                    </div>
                    <div className="stat-card-label text-[10px] font-bold uppercase text-base-content/50 mt-1 tracking-wider">Doctors</div>
                  </div>
                  <div className="stat-card text-center p-3 rounded-xl bg-base-200/50 border border-base-200">
                    <div className="stat-card-value text-xl font-black text-base-content">
                      {hospital.specialties?.length || 0}
                    </div>
                    <div className="stat-card-label text-[10px] font-bold uppercase text-base-content/50 mt-1 tracking-wider">Specialties</div>
                  </div>
                </div>
              </div>

              {/* ── Contact Card ── */}
              <div className="rounded-2xl p-4 md:p-6 text-neutral-content shadow-lg relative overflow-hidden  ">
                <div className="absolute top-0 right-0 w-48 h-48 bg-primary/30 rounded-full -mr-24 -mt-24 blur-3xl pointer-events-none" />

                <SectionTitle icon={PhoneCall}>
                  <span className="font-bold">Contact & Location</span>
                </SectionTitle>

                <div className="space-y-6 relative z-10 mt-6">
                  {/* Address */}
                  <div className="flex items-start gap-3">
                    <div className="px-2.5   rounded-xl shrink-0 backdrop-blur-sm">
                      <MapPin className="text-primary" size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-snug  ">
                        {hospital.address?.line1}
                        {hospital.address?.line2 &&
                          `, ${hospital.address.line2}`}
                      </p>
                      <p className="text-[11px] font-medium opacity-70 mt-1  ">
                        {hospital.address?.city}, {hospital.address?.state}{" "}
                        {hospital.address?.pincode}
                      </p>
                    </div>
                  </div>

                  {/* Phone */}
                  {hospital.contact?.phone && (
                    <div className="flex items-start gap-3">
                      <div className="px-2.5   rounded-xl shrink-0 backdrop-blur-sm">
                        <Phone className="text-primary mt-3" size={18} />
                      </div>
                      <div>
                        <a
                          href={`tel:${hospital.contact.phone}`}
                          className="text-sm font-black tracking-tight mr-2  hover:text-primary-content transition-colors"
                        >
                          {hospital.contact.phone}
                        </a>
                        {hospital.contact?.alternatePhone && (
                          <p className="text-[11px] font-medium  opacity-70 mt-0.5  ">
                            Alt: {hospital.contact.alternatePhone}
                          </p>
                        )}
                        {hospital.contact?.emergencyPhone && (
                          <a
                            href={`tel:${hospital.contact.emergencyPhone}`}
                            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-error text-error-content rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-sm"
                          >
                            <Zap size={12} fill="currentColor" /> Emergency:{" "}
                            {hospital.contact.emergencyPhone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* WhatsApp */}
                  {hospital.contact?.whatsapp && (
                    <div className="flex items-center gap-3">
                      <div className="px-2.5   rounded-xl shrink-0 backdrop-blur-sm">
                        <MessageSquare className="text-success" size={18} />
                      </div>
                      <a
                        href={`https://wa.me/${hospital.contact.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold   hover:text-success transition-colors"
                      >
                        {hospital.contact.whatsapp}
                      </a>
                    </div>
                  )}

                  {/* Email */}
                  {hospital.contact?.email && (
                    <div className="flex items-center gap-3">
                      <div className="px-2.5   rounded-xl shrink-0 backdrop-blur-sm">
                        <Mail className="text-primary" size={18} />
                      </div>
                      <a
                        href={`mailto:${hospital.contact.email}`}
                        className="text-xs font-bold   hover:text-primary-content transition-colors break-all"
                      >
                        {hospital.contact.email}
                      </a>
                    </div>
                  )}
                </div>

                

                {/* Book CTA */}
                <div className="mt-3 relative z-10">
                  <SpecialButton
                    href={hospitalBookHref}
                    nav="hospitals"
                    variant="solid"
                    size="md"
                    animation="lift"
                    textAnimation="fade"
                    icon={CalendarCheck}
                    fullWidth
                    className="bg-white text-neutral hover:bg-base-200 border-none"
                  >
                    Book Appointment
                  </SpecialButton>
                </div>
              </div>

              {/* ── Blood Bank info ── */}
              {(hospital.hasBloodBank || hospital.bloodBanks?.length > 0) && (
                <div className="card p-5 bg-base-100 border border-base-200 shadow-sm">
                  <SectionTitle icon={Droplets}>Blood Bank</SectionTitle>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-base-200 last:border-0 last:pb-0">
                      <span className="text-base-content/60 font-bold">
                        Accepts blood requests
                      </span>
                      {hospital.acceptsBloodRequests ? (
                        <span className="badge badge-xs badge-success py-2 font-bold bg-success/10 text-success border-success/30">Yes</span>
                      ) : (
                        <span className="badge badge-xs badge-error py-2 font-bold">No</span>
                      )}
                    </div>
                    {hospital.bloodBanks?.length > 0 && (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-base-content/60 font-bold">
                          Linked blood banks
                        </span>
                        <span className="font-black text-base-content bg-base-200 px-2 py-0.5 rounded-md">
                          {hospital.bloodBanks.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Onboarding status ── */}
              <div className="card p-5 bg-base-100 border border-base-200 shadow-sm">
                <SectionTitle icon={CalendarCheck}>
                  Onboarding & Verification
                </SectionTitle>
                <div className="space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-base-content/60 font-bold">
                      Onboarding step
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-base-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              (hospital.onboarding?.step || 1) * 20,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="font-black text-base-content text-[11px]">
                        {hospital.onboarding?.step || 1}/5
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-base-content/60 font-bold">
                      Status
                    </span>
                    {hospital.onboarding?.isComplete ? (
                      <span className="badge badge-xs badge-success gap-1 py-2 font-bold bg-success/10 text-success border-success/30">
                        <CheckCircle2 size={11} /> Complete
                      </span>
                    ) : (
                      <span className="badge badge-xs badge-warning py-2 font-bold">
                        In Progress
                      </span>
                    )}
                  </div>
                  {hospital.onboarding?.completedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-base-content/60 font-bold">
                        Completed
                      </span>
                      <span className="font-black text-base-content">
                        {formatDate(hospital.onboarding.completedAt)}
                      </span>
                    </div>
                  )}
                  {hospital.verifiedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-base-content/60 font-bold">
                        Verified on
                      </span>
                      <span className="font-black text-base-content">
                        {formatDate(hospital.verifiedAt)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default HospitalDetails;