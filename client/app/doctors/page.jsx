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
  BadgeCheck, Activity,
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
  { label: 'Top Rated',   value: '-rating.averageRating', icon: Star       },
  { label: 'Experience',  value: '-experienceYears',      icon: Award      },
  { label: 'Newest',      value: '-createdAt',            icon: Clock      },
  { label: 'Lowest Fee',  value: 'fees.inPersonFee',      icon: TrendingUp },
];

const CONSULT_TYPES = [
  { label: 'In-Person', value: 'inPerson',  icon: Stethoscope },
  { label: 'Video',     value: 'video',     icon: Video       },
  { label: 'Home Visit',value: 'homeVisit', icon: Home        },
];

// Semantic tri-color mapping for consult types — pulled straight from global.css
// utility tokens (text-*, bg-*/N, border-*/N) instead of inline color-mix() styles.
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

// Doctors can belong to a hospital either as a populated object or a raw id.
// The booking flow needs the hospital id too — not just the doctor id —
// otherwise /book-appointment has no idea which hospital owns the slot.
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
      className="group relative rounded-2xl overflow-hidden flex flex-col card"
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

      <Link href={`/doctors/${_id}`} className="block p-5 flex-1">

        {/* HEADER */}
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
              <h3 className="font-black text-[15px] leading-tight truncate">Dr. {displayName}</h3>
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

        {/* STAT ROW */}
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

      {/* CTA FOOTER */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-base-300 bg-base-200">
        <Link
          href={`/doctors/${_id}`}
          className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 text-primary transition-opacity hover:opacity-80"
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
          className="!w-auto px-4"
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
  <div className="rounded-2xl p-5 space-y-4 border border-base-300 bg-base-100">
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
      className="rounded-2xl p-5 space-y-5 sticky top-24 border border-base-300 bg-base-100"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10" aria-hidden="true">
            <Filter size={13} className="text-primary" />
          </div>
          <h3 className="font-black text-sm uppercase tracking-wider text-primary">Filters</h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close filters"
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-base-200 text-base-content opacity-50"
        >
          <X size={13} />
        </button>
      </div>

      {/* Consultation type */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2.5">Consultation</p>
        <div className="space-y-2">
          {CONSULT_TYPES.map(({ label, value, icon: Icon }) => {
            const active = filters.consultationType === value;
            return (
              <button
                key={value}
                onClick={() => onChange('consultationType', active ? '' : value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
                  active ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-base-300 text-base-content'
                }`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-primary/15' : 'bg-base-200'}`} aria-hidden="true">
                  <Icon size={12} className={active ? 'text-primary' : 'text-base-content opacity-40'} />
                </div>
                <span className="text-[12px] font-bold">{label}</span>
                {active && (
                  <div className="ml-auto w-4 h-4 rounded-full flex items-center justify-center bg-primary" aria-hidden="true">
                    <X size={8} className="text-primary-content" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Min rating */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2.5">Min Rating</p>
        <div className="grid grid-cols-4 gap-1.5">
          {[0, 3, 4, 4.5].map((r) => {
            const active = filters.rating === r;
            return (
              <button
                key={r}
                onClick={() => onChange('rating', active ? 0 : r)}
                className={`py-2 rounded-xl text-[10px] font-black border transition-all ${
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-base-300 bg-transparent text-base-content'
                }`}
              >
                {r === 0 ? 'Any' : `${r}★`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sort */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2.5">Sort By</p>
        <div className="space-y-1.5">
          {SORT_OPTIONS.map(({ label, value, icon: Icon }) => {
            const active = filters.sort === value;
            return (
              <button
                key={value}
                onClick={() => onChange('sort', value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] font-bold border transition-all ${
                  active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-base-200 text-base-content'
                }`}
              >
                <Icon size={12} className={active ? 'text-primary' : 'text-base-content opacity-40'} />
                {label}
                {active && <Zap size={10} className="ml-auto text-primary" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onChange('reset')}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-base-300 text-[11px] font-black text-base-content opacity-45 transition-opacity hover:opacity-80"
      >
        <RefreshCw size={12} aria-hidden="true" /> Reset Filters
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0  bg-primary " aria-hidden="true">
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
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors  bg-primary/20 hover:bg-primary/30"
      >
        <X size={13} className="text-white" />
      </button>
      <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full pointer-events-none bg-white/5" />
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-y border-base-300">
      {stats.map(({ label, value, icon: Icon }, i) => (
        <div
          key={label}
          className={`flex flex-col items-center justify-center py-5 gap-1 text-center ${
            i < stats.length - 1 ? 'border-r border-base-300' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-1 bg-primary/10" aria-hidden="true">
            <Icon size={14} className="text-primary" />
          </div>
          <span className="text-[17px] font-black leading-none text-primary">{value}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest opacity-40">{label}</span>
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

  const [searchQuery,      setSearchQuery]      = useState('');
  const [selectedSpec,     setSelectedSpec]     = useState('');
  const [showFilters,      setShowFilters]      = useState(false);
  const [showNearbyBanner, setShowNearbyBanner] = useState(false);
  const [currentPage,      setCurrentPage]      = useState(1);
  const [activeTab,        setActiveTab]        = useState('all');
  const [filters,          setFilters]          = useState({
    consultationType: '',
    rating: 0,
    sort:   '-rating.averageRating',
  });

  const searchTimer   = useRef(null);
  const topRef        = useRef(null);
  const specScrollRef = useRef(null);

  useEffect(() => {
    const coords = user?.location?.coordinates;
    if (coords && (coords[0] !== 0 || coords[1] !== 0)) {
      const [lng, lat] = coords;
      dispatch(fetchNearbyDoctors({ lat, lng, distance: 10000, limit: 6 }));
      setShowNearbyBanner(true);
    }
  }, [dispatch, user?.location?.coordinates]);

  const fetchDoctors = useCallback(() => {
    if (searchQuery.trim().length >= 2) {
      dispatch(searchDoctors({ q: searchQuery, specialization: selectedSpec || undefined, page: currentPage, limit: 12 }));
      setActiveTab('search');
    } else if (selectedSpec) {
      dispatch(fetchDoctorsBySpecialization({
        spec: selectedSpec, rating: filters.rating || undefined,
        consultationType: filters.consultationType || undefined, page: currentPage, limit: 12,
      }));
      setActiveTab('spec');
    } else {
      dispatch(fetchAllDoctors({
        rating: filters.rating || undefined, consultationType: filters.consultationType || undefined,
        sort: filters.sort || undefined, page: currentPage, limit: 12,
      }));
      setActiveTab('all');
    }
  }, [dispatch, searchQuery, selectedSpec, filters, currentPage]);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  const handleSearch = useCallback((val) => {
    setSearchQuery(val);
    setCurrentPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (val.trim().length >= 2) {
        dispatch(searchDoctors({ q: val, page: 1, limit: 12 }));
        setActiveTab('search');
      } else if (val.trim() === '') {
        fetchDoctors();
      }
    }, 350);
  }, [dispatch, fetchDoctors]);

  const handleFilterChange = useCallback((key, value) => {
    if (key === 'reset') {
      setFilters({ consultationType: '', rating: 0, sort: '-rating.averageRating' });
      setCurrentPage(1);
      return;
    }
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleSpecChange = useCallback((spec) => {
    setSelectedSpec(spec);
    setCurrentPage(1);
    setSearchQuery('');
  }, []);

  const displayedDoctors = useMemo(() => {
    if (activeTab === 'search' && searchQuery.trim().length >= 2) return searchResults;
    if (activeTab === 'spec'   && selectedSpec)                   return specializationDoctors;
    return doctors;
  }, [activeTab, searchQuery, searchResults, specializationDoctors, doctors, selectedSpec]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.consultationType) count++;
    if (filters.rating > 0) count++;
    if (filters.sort !== '-rating.averageRating') count++;
    return count;
  }, [filters]);

  return (
    <div id="main-content" data-theme="doctor" className="bg-base-100 min-h-screen">

      {/* HERO */}
      <section
        className="relative overflow-hidden pt-12 pb-10"
        style={{ background: 'linear-gradient(180deg, var(--base-200) 0%, var(--base-100) 100%)' }}
      >
        <div className="absolute top-5 left-5">
          <BackButton label=" back to home" />
        </div>

        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full pointer-events-none bg-secondary/[0.07] blur-[40px]" aria-hidden="true" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full pointer-events-none bg-primary/5 blur-[32px]" aria-hidden="true" />

        <Container className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="max-w-2xl mx-auto text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-5 border bg-primary/10 text-primary border-primary/25" aria-hidden="true">
              <Stethoscope size={11} />
              Find Your Doctor
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight mb-4 leading-tight text-base-content">
              Expert Care,{' '}
              <span className="text-gradient-primary">Right Here</span>
            </h1>
            <p className="text-sm leading-relaxed max-w-md mx-auto text-base-content/60">
              Connect with verified, top-rated doctors near you. Book consultations in minutes — in-person, video, or home visit.
            </p>
          </motion.div>

          {/* SEARCH BAR */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="max-w-2xl mx-auto"
          >
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-base-100 border-2 border-primary/25 shadow-primary">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10" aria-hidden="true">
                <Search size={16} className="text-primary" />
              </div>

              <input
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search doctors by name or specialization…"
                aria-label="Search doctors"
                className="flex-1 bg-transparent text-sm font-medium outline-none text-base-content font-poppins"
              />

              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  aria-label="Clear search"
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-base-200"
                >
                  <X size={13} className="text-base-content opacity-50" />
                </button>
              )}

              <button
                onClick={() => setShowFilters((p) => !p)}
                aria-label={`Toggle filters${activeFilterCount > 0 ? `, ${activeFilterCount} active` : ''}`}
                aria-expanded={showFilters}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-[12px] border transition-all ${
                  showFilters ? 'bg-primary/10 text-primary border-primary' : 'bg-base-200 text-base-content border-base-300'
                }`}
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center bg-primary text-primary-content" aria-hidden="true">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        </Container>
      </section>

      <TrustBar />

      {/* SPECIALIZATION TABS */}
      <div
        className="sticky z-30 border-b border-base-300 bg-base-100/95 backdrop-blur-strong"
        style={{ top: 'var(--header-height, 72px)' }}
      >
        <Container>
          <div
            ref={specScrollRef}
            className="flex items-center gap-1.5 overflow-x-auto py-3 -mx-1 px-1 scrollbar-thin"
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
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide border transition-all ${
                    isActive
                      ? 'bg-[image:var(--bg-gradient-primary)] text-primary-content border-transparent shadow-primary opacity-100'
                      : 'bg-base-200 text-base-content border-base-300 opacity-65'
                  }`}
                >
                  <span aria-hidden="true">{icon}</span>
                  {label}
                </motion.button>
              );
            })}
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
                    <span className="font-black text-primary">{total}</span>{' '}
                    doctor{total !== 1 ? 's' : ''} found
                    {selectedSpec && <span className="opacity-40"> in {selectedSpec}</span>}
                  </p>
                )}
              </motion.div>

              <select
                value={filters.sort}
                onChange={(e) => handleFilterChange('sort', e.target.value)}
                aria-label="Sort doctors"
                className="text-[11px] font-bold rounded-xl px-3 py-2 outline-none cursor-pointer border bg-base-200 border-base-300 text-primary font-poppins"
              >
                {SORT_OPTIONS.map(({ label, value }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Nearby sub-section */}
            {!showNearbyBanner && nearbyDoctors.length > 0
              && activeTab === 'all' && !selectedSpec && !searchQuery && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center bg-primary/10" aria-hidden="true">
                    <MapPin size={12} className="text-primary" />
                  </div>
                  <h2 className="font-black text-sm uppercase tracking-wider text-primary">Near You</h2>
                  <div className="flex-1 h-px bg-base-300" aria-hidden="true" />
                </div>
                <motion.div variants={containerVar} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {nearbyDoctors.slice(0, 2).map((doc) => <DoctorCard key={doc._id} doctor={doc} />)}
                </motion.div>
              </div>
            )}

            {/* GRID */}
            {isLoadingAll ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : displayedDoctors.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5 mx-auto bg-primary/10" aria-hidden="true">
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
                  onClick={() => { handleSearch(''); handleSpecChange(''); handleFilterChange('reset'); }}
                  className="!w-auto px-6"
                >
                  Clear all filters
                </SpecialButton>
              </motion.div>
            ) : (
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={`${activeTab}-${selectedSpec}-${currentPage}`}
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
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="px-4 py-2 rounded-xl text-[12px] font-black border disabled:opacity-30 transition-all hover:border-base-content/40 border-base-300 text-base-content bg-base-100"
                >
                  Prev
                </button>

                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                  const isCurrentPage = p === page;
                  return (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      aria-label={`Page ${p}`}
                      aria-current={isCurrentPage ? 'page' : undefined}
                      className={`w-9 h-9 rounded-xl text-[12px] font-black border transition-all ${
                        isCurrentPage
                          ? 'bg-[image:var(--bg-gradient-primary)] text-primary-content border-transparent shadow-primary'
                          : 'bg-transparent text-base-content border-base-300'
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
                  className="px-4 py-2 rounded-xl text-[12px] font-black border disabled:opacity-30 transition-all hover:border-base-content/40 border-base-300 text-base-content bg-base-100"
                >
                  Next
                </button>
              </motion.nav>
            )}
          </div>
        </div>
      </Container>
    </div>
  );
}