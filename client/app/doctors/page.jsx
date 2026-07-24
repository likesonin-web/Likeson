'use client';

import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, Star, X, Video,
  Home, Stethoscope, SlidersHorizontal, RefreshCw,
  Navigation2, Zap, Award, Languages, ChevronRight, Filter, TrendingUp, Clock,
  BadgeCheck, Activity, User,
  CheckCircle2,
} from 'lucide-react';
import {
  fetchNearbyDoctors,
  fetchAllDoctors,
  fetchDoctorsBySpecialization,
  searchDoctors,
  selectDoctors,
  selectNearbyDoctors,
  selectSpecializationDoctors,
  selectDoctorSearchResults,
  selectDoctorTotal,
  selectDoctorPage,
  selectDoctorPages,
  selectIsLoadingDoctors,
} from '@/store/slices/hospitalSlice';
import Container from '@/components/ui/Container';
import BackButton from '../../components/BackButton';
import SpecialButton from '@/components/SpecialButton';

// ─────────────────────────────────────────────────────────────────────────────
// STATIC DATA
// ─────────────────────────────────────────────────────────────────────────────
const SPECIALIZATIONS = [
  { label: 'All',                value: '',                    icon: '🩺' },
  { label: 'General Physician',  value: 'General Physician',   icon: '👨‍⚕️' },
  { label: 'Cardiologist',       value: 'Cardiologist',        icon: '❤️' },
  { label: 'Neurologist',        value: 'Neurologist',         icon: '🧠' },
  { label: 'Pediatrician',       value: 'Pediatrician',        icon: '👶' },
  { label: 'Oncologist',         value: 'Oncologist',          icon: '🔬' },
  { label: 'Orthopedic',         value: 'Orthopedic Surgeon',  icon: '🦴' },
  { label: 'Gastroenterologist', value: 'Gastroenterologist',  icon: '🫁' },
  { label: 'Gynecologist',       value: 'Gynecologist',        icon: '🌸' },
  { label: 'Dermatologist',      value: 'Dermatologist',       icon: '✨' },
  { label: 'Urologist',          value: 'Urologist',           icon: '💊' },
  { label: 'Psychiatry',         value: 'Psychiatry',          icon: '🧘' },
  { label: 'Physiotherapist',    value: 'Physiotherapist',     icon: '💪' },
];

const SORT_OPTIONS = [
  { label: 'Top Rated',   value: 'rating',      icon: Star       },
  { label: 'Experience',  value: 'experience',  icon: Award      },
  { label: 'Name (A-Z)',  value: 'name',        icon: User       },
  { label: 'Newest',      value: 'newest',      icon: Clock      },
  { label: 'Lowest Fee',  value: 'lowestFee',   icon: TrendingUp },
];

const CONSULT_TYPES = [
  { label: 'In-Person', value: 'inPerson',  icon: Stethoscope },
  { label: 'Video',     value: 'video',     icon: Video       },
  { label: 'Home Visit',value: 'homeVisit', icon: Home        },
];

const CONSULT_STYLE = {
  inPerson:  { text: 'text-success', bg: 'bg-success/10', border: 'border-success/30' },
  video:     { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  homeVisit: { text: 'text-warning', bg: 'bg-warning/10', border: 'border-warning/30' },
};

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────
const containerVar = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const cardVar = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  show:   { opacity: 1, y: 0,  scale: 1,    transition: { type: 'spring', damping: 22, stiffness: 280 } },
  exit:   { opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.16 } },
};
const fadeIn = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.28 } } };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmtFee    = (fee) => (fee > 0 ? `₹${fee.toLocaleString('en-IN')}` : 'Free');
const fmtRating = (r)   => (r ?? 0).toFixed(1);
const stripDr   = (name = '') => name.replace(/^dr\.?\s*/i, '').trim();

const getHospitalId = (primaryHospital) =>
  typeof primaryHospital === 'object' ? primaryHospital?._id ?? '' : primaryHospital ?? '';

const buildBookingHref = (doctor, displayName, type = 'doctor_consultation') => {
  const params = new URLSearchParams({
    doctor: doctor._id,
    hospital: getHospitalId(doctor.primaryHospital),
    type,
    name: displayName,
    spec: doctor.specialization || '',
  });
  return `/book-appointment?${params.toString()}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// INTERACTIVE HALF-STAR RATING COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const InteractiveStarRating = memo(({ value, onChange }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-1.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const displayValue = hover || value;
        const isFull = displayValue >= star;
        const isHalf = displayValue + 0.5 === star;

        return (
          <div key={star} className="relative w-6 h-6 cursor-pointer" aria-label={`${star} Star`}>
            <div className="absolute inset-0 flex items-center justify-center text-base-300">
              <Star size={20} className="fill-current" />
            </div>
            <div
              className="absolute inset-0 flex items-center overflow-hidden text-warning"
              style={{ width: isFull ? '100%' : isHalf ? '50%' : '0%' }}
            >
              <Star size={20} className="fill-current" />
            </div>
            {/* Left Half Star - Clicking toggles off if it's already selected */}
            <div
              className="absolute inset-y-0 left-0 w-1/2 z-10"
              onMouseEnter={() => setHover(star - 0.5)}
              onClick={(e) => { 
                e.stopPropagation(); 
                onChange(value === star - 0.5 ? 0 : star - 0.5); 
              }}
            />
            {/* Right Half (Full) Star - Clicking toggles off if it's already selected */}
            <div
              className="absolute inset-y-0 right-0 w-1/2 z-10"
              onMouseEnter={() => setHover(star)}
              onClick={(e) => { 
                e.stopPropagation(); 
                onChange(value === star ? 0 : star); 
              }}
            />
          </div>
        );
      })}
      <span className="text-[11px] font-black ml-2 w-10 text-primary">
        {hover || value > 0 ? (hover || value) + ' ★' : 'Any'}
      </span>
    </div>
  );
});
InteractiveStarRating.displayName = 'InteractiveStarRating';

// ─────────────────────────────────────────────────────────────────────────────
// STAR ROW
// ─────────────────────────────────────────────────────────────────────────────
const StarRow = memo(({ rating, total }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={11}
          className={s <= Math.round(rating ?? 0) ? 'fill-warning text-warning' : 'text-base-300'}
        />
      ))}
    </div>
    <span className="text-[11px] font-black text-primary">{fmtRating(rating)}</span>
    {total > 0 && <span className="text-[10px] opacity-40">({total})</span>}
  </div>
));
StarRow.displayName = 'StarRow';

// ─────────────────────────────────────────────────────────────────────────────
// CONSULT BADGE
// ─────────────────────────────────────────────────────────────────────────────
const ConsultBadge = memo(({ type }) => {
  const map = {
    inPerson:  { Icon: Stethoscope, label: 'In-Person' },
    video:     { Icon: Video,       label: 'Video'     },
    homeVisit: { Icon: Home,        label: 'Home'      },
  };
  const { Icon, label } = map[type];
  const c = CONSULT_STYLE[type];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${c.bg} ${c.text} ${c.border}`}
    >
      <Icon size={9} /> {label}
    </span>
  );
});
ConsultBadge.displayName = 'ConsultBadge';

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR CARD
// ─────────────────────────────────────────────────────────────────────────────
const DoctorCard = memo(function DoctorCard({ doctor }) {
  const {
    _id, profilePhotoUrl, isOnline, isVerified, specialization,
    experienceYears, rating, fees, consultationTypes,
    languagesSpoken, availability, user: doctorUser, primaryHospital,
  } = doctor;

  const cleanName   = stripDr(doctorUser?.name ?? '');
  const displayName = cleanName || 'Unknown Doctor';

  const photo = profilePhotoUrl
    || doctorUser?.avatar
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`;

  const isGeneratedAvatar = photo.includes('ui-avatars.com');

  const consultTypes = useMemo(() => {
    const types = [];
    if (consultationTypes?.inPerson)  types.push('inPerson');
    if (consultationTypes?.video)     types.push('video');
    if (consultationTypes?.homeVisit) types.push('homeVisit');
    return types;
  }, [consultationTypes]);

  const lowestFee = useMemo(() => {
    const vals = [];
    if (consultationTypes?.inPerson  && fees?.inPersonFee  > 0) vals.push(fees.inPersonFee);
    if (consultationTypes?.video     && fees?.videoFee     > 0) vals.push(fees.videoFee);
    if (consultationTypes?.homeVisit && fees?.homeVisitFee > 0) vals.push(fees.homeVisitFee);
    return vals.length > 0 ? Math.min(...vals) : 0;
  }, [fees, consultationTypes]);

  const isAvailableToday = useMemo(() => {
    const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
    return (availability?.find((a) => a.day === day)?.slots?.length ?? 0) > 0;
  }, [availability]);

  const hospitalName = typeof primaryHospital === 'object' ? primaryHospital?.name : null;
  const bookingHref = buildBookingHref(doctor, displayName);

  return (
    <motion.div
      variants={cardVar}
      layout
      className="group relative rounded-2xl overflow-hidden flex flex-col card shadow-sm hover:shadow-md transition-shadow bg-base-100 border border-base-200"
    >
      {isAvailableToday && (
        <div
          className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-success/10 text-success"
          aria-label="Available today"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" aria-hidden="true" />
          Today
        </div>
      )}

      <Link href={`/doctors/${_id}`} className="block p-5 flex-1 cursor-pointer">
        <div className="flex items-start gap-4 mb-4">
          <div className="relative flex-shrink-0">
            <div
              className={`w-[68px] h-[68px] rounded-2xl overflow-hidden border-2 ${
                isOnline ? 'border-success ring-4 ring-success/15' : 'border-base-300'
              }`}
            >
              <Image
                src={photo}
                alt={`Dr. ${displayName}`}
                width={68}
                height={68}
                className="w-full h-full object-cover"
                unoptimized={isGeneratedAvatar}
              />
            </div>
            {isOnline && (
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5" aria-label="Online">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" aria-hidden="true" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-success border-2 border-base-100" aria-hidden="true" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="font-black text-[15px] leading-tight truncate group-hover:text-primary transition-colors">Dr. {displayName}</h3>
              {isVerified && <BadgeCheck size={15} className="text-primary flex-shrink-0" aria-label="Verified" />}
            </div>
            <p className="text-[12px] font-bold mb-1 truncate text-primary">{specialization}</p>
            {hospitalName && (
              <p className="text-[10px] opacity-40 mb-1 truncate flex items-center gap-1">
                <MapPin size={9} className="flex-shrink-0" /> {hospitalName}
              </p>
            )}
            <StarRow rating={rating?.averageRating} total={rating?.totalReviews ?? 0} />
          </div>
        </div>

        <div className="flex items-stretch justify-between mb-4 rounded-xl p-3 bg-primary/5 border border-primary/20">
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Exp</span>
            <span className="text-[13px] font-black leading-none text-primary">{experienceYears}y</span>
          </div>
          <div className="w-px bg-primary/20" aria-hidden="true" />
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Ratings</span>
            <span className="text-[13px] font-black leading-none text-primary">
              {(rating?.totalRatings ?? 0) > 0 ? rating.totalRatings : '–'}
            </span>
          </div>
          <div className="w-px bg-primary/20" aria-hidden="true" />
          <div className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest opacity-40">From</span>
            <span className="text-[13px] font-black leading-none text-primary">{fmtFee(lowestFee)}</span>
          </div>
        </div>

        {consultTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {consultTypes.map((t) => <ConsultBadge key={t} type={t} />)}
          </div>
        )}

        {languagesSpoken?.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Languages size={10} className="opacity-30 flex-shrink-0" aria-hidden="true" />
            <span className="text-[10px] opacity-40 font-medium truncate">
              {languagesSpoken.slice(0, 3).join(' · ')}
            </span>
          </div>
        )}
      </Link>

      <div className="flex items-center justify-between px-5 py-3 border-t border-base-300 bg-base-200">
        <Link
          href={`/doctors/${_id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 text-primary transition-opacity hover:opacity-80 cursor-pointer"
          aria-label={`View profile of Dr. ${displayName}`}
        >
          View Profile <ChevronRight size={11} />
        </Link>

        <SpecialButton
          href={bookingHref}
          role="doctor"
          variant="solid"
          animation="press"
          textAnimation="fade"
          size="sm"
          fullWidth={false}
          onClick={(e) => e.stopPropagation()}
          className="!w-auto px-4 cursor-pointer"
          aria-label={`Book appointment with Dr. ${displayName}`}
        >
          Book Now
        </SpecialButton>
      </div>
    </motion.div>
  );
});
DoctorCard.displayName = 'DoctorCard';

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON CARD
// ─────────────────────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="rounded-2xl p-5 space-y-4 border border-base-300 bg-base-100 shadow-sm">
    <div className="flex gap-4">
      <div className="w-[68px] h-[68px] rounded-2xl skeleton" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 rounded-lg skeleton" />
        <div className="h-3 w-1/2 rounded-lg skeleton" />
        <div className="h-3 w-2/3 rounded-lg skeleton" />
      </div>
    </div>
    <div className="h-12 rounded-xl skeleton" />
    <div className="flex gap-1.5">
      <div className="h-5 w-16 rounded-full skeleton" />
      <div className="h-5 w-14 rounded-full skeleton" />
    </div>
    <div className="h-10 rounded-xl skeleton" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// FILTER PANEL
// ─────────────────────────────────────────────────────────────────────────────
const FilterPanel = memo(function FilterPanel({ filters, onChange, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="rounded-2xl p-5 space-y-6 sticky top-24 border border-base-300 bg-base-100 shadow-sm"
    >
      <div className="flex items-center justify-between border-b border-base-200 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10" aria-hidden="true">
            <Filter size={13} className="text-primary" />
          </div>
          <h3 className="font-black text-sm uppercase tracking-wider text-primary">Filters</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close filters"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-base-200 text-base-content opacity-50 cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      {/* Consultation type (Toggle Buttons) */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Consultation Type</p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onChange('consultationType', '')}
            className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${filters.consultationType === '' ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-base-300 text-base-content hover:bg-base-200/50'}`}
          >
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${filters.consultationType === '' ? 'border-primary' : 'border-base-content/30'}`}>
              {filters.consultationType === '' && <div className="w-2 h-2 rounded-full bg-primary" />}
            </div>
            <span className="text-[12px] font-bold">Any Type</span>
          </button>

          {CONSULT_TYPES.map(({ label, value, icon: Icon }) => {
            const active = filters.consultationType === value;
            return (
              <button
                key={value}
                type="button"
                // Clicking an already active button toggles it off
                onClick={() => onChange('consultationType', active ? '' : value)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${active ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-base-300 text-base-content hover:bg-base-200/50'}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${active ? 'border-primary' : 'border-base-content/30'}`}>
                  {active && <div className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${active ? 'bg-primary/15 text-primary' : 'bg-base-200 text-base-content opacity-50'}`} aria-hidden="true">
                  <Icon size={12} />
                </div>
                <span className="text-[12px] font-bold">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Min rating */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Minimum Rating</p>
        <div className="bg-base-200/50 border border-base-300 p-3 rounded-xl">
           <InteractiveStarRating value={filters.rating} onChange={(val) => onChange('rating', val)} />
        </div>
      </div>

      {/* Sort */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Sort By</p>
        <div className="space-y-1.5">
          {SORT_OPTIONS.map(({ label, value, icon: Icon }) => {
            const active = filters.sort === value;
            return (
              <button
                key={value}
                // Clicking an already active sort toggles back to default ('rating')
                onClick={() => onChange('sort', active ? 'rating' : value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-base-200 text-base-content hover:bg-base-300/50'
                }`}
              >
                <Icon size={14} className={active ? 'text-primary' : 'text-base-content opacity-40'} />
                {label}
                {active && <CheckCircle2 size={12} className="ml-auto text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onChange('reset')}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-base-300 text-[11px] font-black text-base-content opacity-60 transition-all hover:opacity-100 hover:bg-base-200 hover:border-base-content/30 cursor-pointer"
      >
        <RefreshCw size={13} aria-hidden="true" /> Reset Filters
      </button>
    </motion.div>
  );
});
FilterPanel.displayName = 'FilterPanel';

// ─────────────────────────────────────────────────────────────────────────────
// NEARBY BANNER
// ─────────────────────────────────────────────────────────────────────────────
const NearbyBanner = memo(function NearbyBanner({ count, onDismiss }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="relative overflow-hidden rounded-2xl p-4 flex items-center justify-between gap-4 mb-6 bg-gradient-to-r from-primary to-primary/70 border border-primary/30 text-white"
    >
      <div className="flex items-center gap-3 z-10">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary shadow-sm" aria-hidden="true">
          <Navigation2 size={18} className="text-white" />
        </div>
        <div>
          <p className="text-white font-black text-sm leading-tight">{count} doctors near you</p>
          <p className="text-white/70 text-[11px]">Based on your current location</p>
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss nearby banner"
        className="z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors bg-black/10 hover:bg-black/20 cursor-pointer"
      >
        <X size={14} className="text-white" />
      </button>
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full pointer-events-none bg-white/10" />
    </motion.div>
  );
});
NearbyBanner.displayName = 'NearbyBanner';

// ─────────────────────────────────────────────────────────────────────────────
// TRUST STATS BAR
// ─────────────────────────────────────────────────────────────────────────────
const TrustBar = memo(function TrustBar() {
  const stats = [
    { label: 'Verified Doctors',    value: '500+', icon: BadgeCheck  },
    { label: 'Specializations',     value: '12',   icon: Stethoscope },
    { label: 'Appointments Booked', value: '10K+', icon: Activity    },
    { label: 'Average Rating',      value: '4.8★', icon: Star        },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-y border-base-300 bg-base-100 relative z-10">
      {stats.map(({ label, value, icon: Icon }, i) => (
        <div
          key={label}
          className={`flex flex-col items-center justify-center py-6 gap-1 text-center ${
            i < stats.length - 1 ? 'border-r border-base-300' : ''
          }`}
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-1 bg-primary/10" aria-hidden="true">
            <Icon size={16} className="text-primary" />
          </div>
          <span className="text-[19px] font-black leading-none text-primary">{value}</span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">{label}</span>
        </div>
      ))}
    </div>
  );
});
TrustBar.displayName = 'TrustBar';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function DoctorsPage() {
  const dispatch = useDispatch();
  const user     = useSelector((s) => s.user?.user) ?? null;

  const doctors               = useSelector(selectDoctors);
  const nearbyDoctors         = useSelector(selectNearbyDoctors);
  const specializationDoctors = useSelector(selectSpecializationDoctors);
  const searchResults         = useSelector(selectDoctorSearchResults);
  const total                 = useSelector(selectDoctorTotal);
  const page                  = useSelector(selectDoctorPage);
  const pages                 = useSelector(selectDoctorPages);
  const isLoadingAll          = useSelector(selectIsLoadingDoctors);

  const [inputValue,       setInputValue]       = useState('');
  const [searchQuery,      setSearchQuery]      = useState('');
  const [selectedSpec,     setSelectedSpec]     = useState('');
  const [showFilters,      setShowFilters]      = useState(false);
  const [showNearbyBanner, setShowNearbyBanner] = useState(false);
  const [isSearchFocused,  setIsSearchFocused]  = useState(false);
  const [isDropdownExpanded, setIsDropdownExpanded] = useState(false); 
  const [currentPage,      setCurrentPage]      = useState(1);
  const [activeTab,        setActiveTab]        = useState('all');
  const [filters,          setFilters]          = useState({
    consultationType: '',
    rating: 0,
    sort:   'rating',
  });

  const searchTimer        = useRef(null);
  const topRef             = useRef(null);
  const specScrollRef      = useRef(null);
  const searchContainerRef = useRef(null);
  const searchInputRef     = useRef(null);
  const filterAnchorRef    = useRef(null);

  useEffect(() => {
    const coords = user?.location?.coordinates;
    if (coords && (coords[0] !== 0 || coords[1] !== 0)) {
      const [lng, lat] = coords;
      dispatch(fetchNearbyDoctors({ lat, lng, distance: 10000, limit: 6 }));
      setShowNearbyBanner(true);
    }
  }, [dispatch, user?.location?.coordinates]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchDoctors = useCallback(() => {
    const isSearch = searchQuery.trim().length >= 2;
    const params = {
      page: currentPage,
      limit: isSearch ? 100 : 12, // Increased limit for search so results aren't capped at 12
      rating: filters.rating > 0 ? filters.rating : undefined,
      consultationType: filters.consultationType || undefined,
      sort: filters.sort || undefined,
    };

    if (isSearch) {
      dispatch(searchDoctors({ q: searchQuery, specialization: selectedSpec || undefined, ...params }));
      setActiveTab('search');
    } else if (selectedSpec) {
      dispatch(fetchDoctorsBySpecialization({ spec: selectedSpec, ...params }));
      setActiveTab('spec');
    } else {
      dispatch(fetchAllDoctors(params));
      setActiveTab('all');
    }
  }, [dispatch, searchQuery, selectedSpec, filters, currentPage]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const handleSearch = useCallback((val) => {
    setInputValue(val);
    setIsDropdownExpanded(false); 
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchQuery(val);
      setCurrentPage(1);
    }, 350);
  }, []);

  const handleClearSearch = useCallback(() => {
    clearTimeout(searchTimer.current);
    setInputValue('');
    setSearchQuery('');
    setIsDropdownExpanded(false);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((key, value) => {
    if (key === 'reset') {
      setFilters({ consultationType: '', rating: 0, sort: 'rating' });
      setCurrentPage(1);
      return;
    }
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleSpecChange = useCallback((spec) => {
    setSelectedSpec(spec);
    setCurrentPage(1);
    setInputValue('');
    setSearchQuery('');
  }, []);

  const handleToggleFilters = useCallback(() => {
    setShowFilters((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => {
          filterAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
      return next;
    });
  }, []);

  const scrollSpecs = useCallback((dir) => {
    specScrollRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  }, []);

  const displayedDoctors = useMemo(() => {
    let list;
    if (activeTab === 'search' && searchQuery.trim().length >= 2) list = searchResults;
    else if (activeTab === 'spec' && selectedSpec)                list = specializationDoctors;
    else                                                          list = doctors;

    return list.filter((doc) => {
      if (filters.rating > 0 && (doc.rating?.averageRating ?? 0) < filters.rating) return false;
      if (filters.consultationType && !doc.consultationTypes?.[filters.consultationType]) return false;
      return true;
    });
  }, [
    activeTab, searchQuery, searchResults, specializationDoctors, doctors,
    selectedSpec, filters.rating, filters.consultationType,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.consultationType) count++;
    if (filters.rating > 0) count++;
    if (filters.sort !== 'rating') count++;
    return count;
  }, [filters]);

  return (
    <div id="main-content" data-theme="doctor" className="bg-base-100 min-h-screen">
      {/* HERO SECTION */}
      <section
        className="relative pt-12 pb-10"
        style={{ background: 'linear-gradient(180deg, var(--base-200) 0%, var(--base-100) 100%)' }}
      >
        <div className="absolute top-5 left-5 z-20">
          <BackButton label="Back To Home" />
        </div>

        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-secondary/[0.07] blur-[40px]" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-primary/5 blur-[32px]" />
        </div>

        <Container className="relative z-30">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl mx-auto text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-5 border bg-primary/10 text-primary border-primary/25 shadow-sm" aria-hidden="true">
              <Stethoscope size={11} />
              Find Your Doctor
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-4 leading-tight text-base-content">
              Expert Care <span className="text-gradient-primary">Right Here</span>
            </h1>
            <p className="text-sm leading-relaxed max-w-md mx-auto text-base-content/60">
              Connect with verified, top-rated doctors near you. Book consultations in minutes—in-person, video, or home visit.
            </p>
          </motion.div>

          {/* SEARCH BAR W/ AUTOCOMPLETE */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="relative max-w-2xl mx-auto"
            ref={searchContainerRef}
          >
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-base-100 border-2 border-primary/25 shadow-primary relative z-40">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10" aria-hidden="true">
                <Search size={16} className="text-primary" />
              </div>

              <input
                ref={searchInputRef}
                type="search"
                value={inputValue}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search doctors by name or specialization…"
                aria-label="Search doctors"
                className="flex-1 bg-transparent text-sm font-medium outline-none text-base-content font-poppins h-full w-full [&::-webkit-search-cancel-button]:hidden"
              />

              {inputValue && (
                <button
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-base-200 cursor-pointer"
                >
                  <X size={14} className="text-base-content opacity-50" />
                </button>
              )}

              <button
                onClick={handleToggleFilters}
                aria-label={`Toggle filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
                aria-expanded={showFilters}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[12px] border transition-all cursor-pointer ${
                  showFilters ? 'bg-primary/10 text-primary border-primary' : 'bg-base-200 text-base-content border-base-300 hover:bg-base-300/50'
                }`}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full text-[9px] font-black flex items-center justify-center bg-primary text-primary-content shadow-sm" aria-hidden="true">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* AUTOCOMPLETE DROPDOWN */}
            <AnimatePresence>
              {isSearchFocused && inputValue.length >= 2 && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-full left-0 right-0 mt-3 bg-base-100 shadow-2xl border border-base-200 rounded-2xl overflow-hidden z-[100]"
                >
                  {isLoadingAll ? (
                    <div className="p-6 flex items-center justify-center gap-2 text-primary text-sm font-bold">
                      <RefreshCw size={16} className="animate-spin" /> Fetching doctors...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="p-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 px-3 pt-2 pb-1.5">
                        {isDropdownExpanded ? 'All Results' : 'Top Results'}
                      </p>
                      
                      {/* Scrollable Container */}
                      <div className="max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
                        {searchResults.slice(0, isDropdownExpanded ? searchResults.length : 5).map(doc => {
                           const cleanName = stripDr(doc.user?.name ?? '');
                           const displayName = cleanName || 'Unknown Doctor';
                           const photo = doc.profilePhotoUrl || doc.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff`;

                           return (
                             <Link
                               key={doc._id}
                               href={`/doctors/${doc._id}`}
                               onClick={() => setIsSearchFocused(false)}
                               className="flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-colors cursor-pointer group"
                             >
                               <Image
                                  src={photo}
                                  alt={`Dr. ${displayName}`}
                                  width={40}
                                  height={40}
                                  className="rounded-full object-cover border border-base-300"
                                  unoptimized={photo.includes('ui-avatars.com')}
                               />
                               <div className="flex-1 min-w-0">
                                 <h4 className="font-bold text-sm text-base-content truncate group-hover:text-primary transition-colors">Dr. {displayName}</h4>
                                 <p className="text-[11px] font-medium text-base-content/60 truncate">{doc.specialization}</p>
                               </div>
                               <div className="w-8 h-8 rounded-full bg-base-100 flex items-center justify-center border border-base-300 group-hover:bg-primary group-hover:border-primary group-hover:text-primary-content transition-all shadow-sm">
                                  <ChevronRight size={14} />
                               </div>
                             </Link>
                           )
                        })}
                      </div>

                      {/* View All Button */}
                      {!isDropdownExpanded && searchResults.length > 5 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation(); // <-- CRITICAL FIX: Stops the click from bubbling up and hiding the dropdown
                            setIsDropdownExpanded(true);
                          }}
                          className="w-full mt-2 py-2.5 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl transition-colors cursor-pointer"
                        >
                          View all {searchResults.length} results
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-sm font-medium text-base-content/60">
                      No doctors matched "{inputValue}".
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </Container>
      </section>

      <TrustBar />

      {/* SPECIALIZATION TABS */}
      <div
        className="sticky z-10 border-b border-base-300 bg-base-100/95 backdrop-blur-strong"
        style={{ top: 'var(--header-height, 72px)' }}
      >
        <Container>
          <div className="flex items-center gap-1 py-3 -mx-1 px-1">
            <button
              type="button"
              onClick={() => scrollSpecs(-1)}
              aria-label="Scroll specializations left"
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-base-200 hover:bg-base-300/60 border border-base-300 cursor-pointer"
            >
              <ChevronRight size={14} className="rotate-180" />
            </button>

            <div
              ref={specScrollRef}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin scroll-smooth"
              aria-label="Filter by specialization"
              role="tablist"
            >
              {SPECIALIZATIONS.map(({ label, value, icon }) => {
                const isActive = selectedSpec === value;
                return (
                  <motion.button
                    key={value}
                    onClick={() => handleSpecChange(value)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.96 }}
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Filter by ${label}`}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[image:var(--bg-gradient-primary)] text-primary-content border-transparent shadow-primary opacity-100'
                        : 'bg-base-200 text-base-content border-base-300 opacity-65 hover:bg-base-300/50 hover:opacity-100'
                    }`}
                  >
                    <span aria-hidden="true">{icon}</span>
                    {label}
                  </motion.button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollSpecs(1)}
              aria-label="Scroll specializations right"
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-base-200 hover:bg-base-300/60 border border-base-300 cursor-pointer"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </Container>
      </div>

      {/* MAIN CONTENT */}
      <Container className="py-6 md:py-8" ref={topRef}>

        <AnimatePresence>
          {showNearbyBanner && nearbyDoctors.length > 0 && (
            <NearbyBanner count={nearbyDoctors.length} onDismiss={() => setShowNearbyBanner(false)} />
          )}
        </AnimatePresence>

        <div ref={filterAnchorRef} />

        <div className="flex gap-6">

          {/* Filter sidebar — desktop */}
          <AnimatePresence>
            {showFilters && (
              <motion.aside
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 260 }}
                exit={{ opacity: 0, width: 0 }}
                className="hidden lg:block flex-shrink-0 overflow-hidden"
                aria-label="Filter panel"
              >
                <FilterPanel filters={filters} onChange={handleFilterChange} onClose={() => setShowFilters(false)} />
              </motion.aside>
            )}
          </AnimatePresence>

          <div className="flex-1 min-w-0">

            {/* Filter panel — mobile */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="lg:hidden mb-5 overflow-hidden"
                >
                  <FilterPanel filters={filters} onChange={handleFilterChange} onClose={() => setShowFilters(false)} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* RESULTS HEADER */}
            <div className="flex items-center justify-between mb-5">
              <motion.div variants={fadeIn} initial="hidden" animate="show">
                {isLoadingAll ? (
                  <div className="h-5 w-40 rounded-lg skeleton" aria-hidden="true" />
                ) : (
                  <p className="text-sm font-bold text-base-content">
                    <span className="font-black text-primary">
                      {(filters.rating > 0 || filters.consultationType) ? displayedDoctors.length : total}
                    </span>{' '}
                    doctor{(((filters.rating > 0 || filters.consultationType) ? displayedDoctors.length : total)) !== 1 ? 's' : ''} found
                    {selectedSpec && <span className="opacity-40"> in {selectedSpec} </span>}
                  </p>
                )}
              </motion.div>

              <select
                value={filters.sort}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
                aria-label="Sort doctors"
                className="text-[11px] font-bold rounded-xl px-3 py-2.5 outline-none cursor-pointer border bg-base-200 border-base-300 text-primary font-poppins hover:border-primary/40 transition-colors shadow-sm"
              >
                {SORT_OPTIONS.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Nearby sub-section */}
            {!showNearbyBanner && nearbyDoctors.length > 0 && activeTab === 'all' && !selectedSpec && !searchQuery && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10" aria-hidden="true">
                    <MapPin size={14} className="text-primary" />
                  </div>
                  <h2 className="font-black text-sm uppercase tracking-wider text-primary">Near You</h2>
                  <div className="flex-1 h-px bg-base-300 ml-2" aria-hidden="true" />
                </div>
                <motion.div variants={containerVar} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {nearbyDoctors.slice(0, 3).map((doc) => <DoctorCard key={`nearby-${doc._id}`} doctor={doc} />)}
                </motion.div>
                <div className="my-8 h-px w-full bg-base-300" aria-hidden="true" />
              </div>
            )}

            {/* GRID */}
            {isLoadingAll ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)}
              </div>
            ) : displayedDoctors.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 mx-auto bg-primary/10 border-2 border-primary/20" aria-hidden="true">
                  <Stethoscope size={32} className="text-primary opacity-60" />
                </div>
                <h3 className="font-black text-lg mb-2 text-base-content">No doctors found</h3>
                <p className="text-sm mb-6 max-w-xs text-base-content/50">
                  Try adjusting your search or filters to find available doctors.
                </p>
                <SpecialButton
                  role="doctor"
                  variant="solid"
                  as="button"
                  onClick={() => { handleClearSearch(); handleSpecChange(''); handleFilterChange('reset'); }}
                  className="!w-auto px-6 cursor-pointer"
                >
                  Clear All Filters
                </SpecialButton>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={`${activeTab}-${selectedSpec}-${currentPage}-${filters.sort}-${filters.rating}-${filters.consultationType}`}
                  variants={containerVar}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                >
                  {displayedDoctors.map((doc) => <DoctorCard key={doc._id} doctor={doc} />)}
                </motion.div>
              </AnimatePresence>
            )}

            {/* PAGINATION */}
            {pages > 1 && !isLoadingAll && (
              <motion.nav
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center gap-2 mt-10"
                aria-label="Pagination"
              >
                {pages > 5 && (
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 5))}
                    disabled={page <= 1}
                    aria-label="Back 5 pages"
                    className="px-2.5 py-2.5 rounded-xl text-[12px] font-black border disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:border-base-content/40 hover:bg-base-200 border-base-300 text-base-content bg-base-100 cursor-pointer"
                  >
                    «
                  </button>
                )}

                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="px-4 py-2.5 rounded-xl text-[12px] font-black border disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:border-base-content/40 hover:bg-base-200 border-base-300 text-base-content bg-base-100 cursor-pointer"
                >
                  Prev
                </button>

                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                  if (p > pages) return null; // Safety check
                  const isCurrentPage = p === page;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={isCurrentPage ? 'page' : undefined}
                      className={`w-10 h-10 rounded-xl text-[12px] font-black border transition-all cursor-pointer ${
                        isCurrentPage
                          ? 'bg-[image:var(--bg-gradient-primary)] text-primary-content border-transparent shadow-primary'
                          : 'bg-transparent text-base-content border-base-300 hover:bg-base-200'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  aria-label="Next page"
                  className="px-4 py-2.5 rounded-xl text-[12px] font-black border disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:border-base-content/40 hover:bg-base-200 border-base-300 text-base-content bg-base-100 cursor-pointer"
                >
                  Next
                </button>

                {pages > 5 && (
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pages, p + 5))}
                    disabled={page >= pages}
                    aria-label="Forward 5 pages"
                    className="px-2.5 py-2.5 rounded-xl text-[12px] font-black border disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:border-base-content/40 hover:bg-base-200 border-base-300 text-base-content bg-base-100 cursor-pointer"
                  >
                    »
                  </button>
                )}
              </motion.nav>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}