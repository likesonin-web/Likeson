'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, MapPin, ChevronRight, Search, X, Car, User, 
  Stethoscope, FlaskConical, HeartPulse, Video, Dumbbell, 
  RefreshCw, Package, Star, ArrowUpRight, SlidersHorizontal, 
  ChevronLeft, ChevronRight as ChevronRightIcon, Home, 
  Ambulance, RotateCcw,
} from 'lucide-react';

import {
  fetchMyBookings,
  selectMyBookings,
  selectMyBookingsMeta,
  selectLoading,
} from '@/store/slices/bookingSlice';
import BackButton from '../../components/BackButton';

// ─── Constants ────────────────────────────────────────────────────────────────

const BOOKING_TYPE_META = {
  full_care_ride:      { label: 'Full Care Ride',       icon: Ambulance,    color: 'text-primary',   bg: 'bg-primary/10',   border: 'border-primary/20'  },
  doctor_consultation: { label: 'Doctor Consultation',  icon: Stethoscope,  color: 'text-info',      bg: 'bg-info/10',      border: 'border-info/30'     },
  doctor_online:       { label: 'Online Consultation',  icon: Video,        color: 'text-accent',    bg: 'bg-accent/5',     border: 'border-accent/30'   },
  physiotherapist:     { label: 'Physiotherapy',        icon: Dumbbell,     color: 'text-success',   bg: 'bg-success/10',   border: 'border-success/40'  },
  care_assistant:      { label: 'Care Assistant',       icon: HeartPulse,   color: 'text-secondary', bg: 'bg-secondary/20', border: 'border-primary/20'  },
  diagnostic_center:   { label: 'Diagnostic Center',    icon: FlaskConical, color: 'text-warning',   bg: 'bg-warning/10',   border: 'border-warning/30'  },
  diagnostic_home:     { label: 'Home Diagnostics',     icon: Home,         color: 'text-warning',   bg: 'bg-warning/5',    border: 'border-warning/40'  },
  patient_transport:   { label: 'Patient Transport',    icon: Car,          color: 'text-accent',    bg: 'bg-accent/5',     border: 'border-accent/30'   },
  follow_up:           { label: 'Follow-Up',            icon: RotateCcw,    color: 'text-info',      bg: 'bg-info/10',      border: 'border-info/30'     },
};

const STATUS_META = {
  draft:              { label: 'Draft',            color: 'text-base-content/50', bg: 'bg-base-300/60',   dot: 'bg-base-content/40' },
  pending:            { label: 'Pending',          color: 'text-warning',          bg: 'bg-warning/10',    dot: 'bg-warning'          },
  confirmed:          { label: 'Confirmed',        color: 'text-success',          bg: 'bg-success/10',    dot: 'bg-success'          },
  in_progress:        { label: 'In Progress',      color: 'text-info',             bg: 'bg-info/10',       dot: 'bg-info'             },
  completed:          { label: 'Completed',        color: 'text-success',          bg: 'bg-success/10',    dot: 'bg-success'          },
  cancelled:          { label: 'Cancelled',        color: 'text-error',            bg: 'bg-error/5',       dot: 'bg-error'            },
  no_show:            { label: 'No Show',          color: 'text-error',            bg: 'bg-error/5',       dot: 'bg-error'            },
  refund_pending:     { label: 'Refund Pending',   color: 'text-warning',          bg: 'bg-warning/10',    dot: 'bg-warning'          },
  refunded:           { label: 'Refunded',         color: 'text-base-content/60',  bg: 'bg-base-300/60',   dot: 'bg-base-content/40'  },
};

const ALL_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const ALL_TYPES    = Object.keys(BOOKING_TYPE_META);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
};

const formatTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const formatCurrency = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n ?? 0);

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${m.color} ${m.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot} shrink-0`} />
      {m.label}
    </span>
  );
}

function BookingCard({ booking, index }) {
  const router = useRouter();
  const meta   = BOOKING_TYPE_META[booking.bookingType] || BOOKING_TYPE_META.patient_transport;
  const Icon   = meta.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      onClick={() => router.push(`/my-bookings/${booking._id}`)}
      className="card group cursor-pointer hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 border border-base-300 bg-base-100"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.bg} border ${meta.border}`}>
              <Icon size={18} className={meta.color} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm text-base-content truncate">{meta.label}</p>
              <p className="text-xs text-base-content/50 font-mono mt-0.5">{booking.bookingCode}</p>
            </div>
          </div>
          <StatusBadge status={booking.status} />
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <User size={13} className="text-base-content/40 shrink-0" />
            <span className="text-sm text-base-content/70 truncate">
              {booking.patientInfo?.name || '—'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={13} className="text-base-content/40 shrink-0" />
            <span className="text-sm text-base-content/70">
              {formatDate(booking.scheduledAt)} at {formatTime(booking.scheduledAt)}
            </span>
          </div>

          {(booking.hospital || booking.doctor) && (
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-base-content/40 shrink-0" />
              <span className="text-sm text-base-content/60 truncate">
                {booking.hospital?.name || booking.doctor?.user?.name || '—'}
              </span>
            </div>
          )}
        </div>

        <div className="divider my-4 opacity-50" />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-base-content/40 text-[10px] uppercase tracking-wider font-bold mb-0.5">Total Amount</p>
            <p className="font-black text-lg text-base-content">
              {formatCurrency(booking.fareBreakdown?.totalAmount)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {booking.isRated && (
              <span className="inline-flex items-center gap-1 text-xs text-warning font-semibold">
                <Star size={11} fill="currentColor" />
                Rated
              </span>
            )}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${meta.bg} group-hover:bg-primary group-hover:text-primary-content transition-all duration-300`}>
              <ChevronRight size={18} className={`${meta.color} group-hover:text-primary-content`} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div className="card p-5 space-y-4 border border-base-300 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-base-300" />
        <div className="space-y-2 flex-1">
          <div className="h-4 w-32 bg-base-300 rounded" />
          <div className="h-3 w-20 bg-base-300 rounded" />
        </div>
        <div className="h-6 w-20 bg-base-300 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-48 bg-base-200 rounded" />
        <div className="h-3 w-40 bg-base-200 rounded" />
      </div>
      <div className="divider my-0" />
      <div className="flex justify-between items-center pt-2">
        <div className="h-6 w-24 bg-base-300 rounded" />
        <div className="w-9 h-9 bg-base-300 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const dispatch  = useDispatch();
  const bookings  = useSelector(selectMyBookings);
  const meta      = useSelector(selectMyBookingsMeta);
  
  // Using the generic loading selector from your slice
  const loading   = useSelector(selectLoading('fetchMyBookings'));

  const [search,      setSearch]      = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [showFilters,  setShowFilters]  = useState(false);
  const [page,         setPage]         = useState(1);

  const LIMIT = 9;

  const load = useCallback(() => {
    dispatch(fetchMyBookings({
      page,
      limit: LIMIT,
      ...(statusFilter ? { status: statusFilter }      : {}),
      ...(typeFilter   ? { bookingType: typeFilter }   : {}),
    }));
  }, [dispatch, page, statusFilter, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? bookings.filter((b) =>
        b.bookingCode?.toLowerCase().includes(search.toLowerCase()) ||
        b.patientInfo?.name?.toLowerCase().includes(search.toLowerCase()) ||
        b.hospital?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : bookings;

  const hasFilters = !!(search || statusFilter || typeFilter);
  const totalPages = Math.ceil((meta?.total || 0) / LIMIT);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-base-100">
      {/* ── Page Header ── */}
      <div className="border-b border-base-300 bg-base-100/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <BackButton className="mb-2" />
              <h1 className="text-2xl md:text-3xl font-black text-base-content tracking-tight">My Bookings</h1>
              <p className="text-base-content/50 text-xs font-medium mt-0.5">
                {meta?.total != null ? `${meta.total} records found` : 'Loading your history...'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn btn-sm gap-2 ${showFilters ? 'btn-primary' : 'btn-outline border-base-300'}`}
              >
                <SlidersHorizontal size={14} />
                <span className="hidden sm:inline">Filters</span>
                {hasFilters && <span className="badge badge-error badge-xs p-1" />}
              </button>
              <Link href="/book-appointment" className="btn btn-primary btn-sm gap-2">
                <ArrowUpRight size={14} />
                <span className="hidden sm:inline">New Booking</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ── Filters Panel ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-8"
            >
              <div className="card p-6 bg-base-200/50 border border-base-300 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-base-content/40 ml-1">Search</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                      <input
                        type="text"
                        placeholder="ID, Patient, or Hospital..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input input-bordered w-full pl-10 bg-base-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-base-content/40 ml-1">Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                      className="select select-bordered w-full bg-base-100"
                    >
                      <option value="">All Statuses</option>
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-base-content/40 ml-1">Category</label>
                    <select
                      value={typeFilter}
                      onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                      className="select select-bordered w-full bg-base-100"
                    >
                      <option value="">All Categories</option>
                      {ALL_TYPES.map((t) => (
                        <option key={t} value={t}>{BOOKING_TYPE_META[t]?.label || t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {hasFilters && (
                  <div className="flex justify-end">
                    <button onClick={clearFilters} className="btn btn-ghost btn-xs gap-2 text-error">
                      <X size={14} /> Reset All Filters
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)
          ) : filtered.length > 0 ? (
            filtered.map((b, i) => <BookingCard key={b._id} booking={b} index={i} />)
          ) : (
            <div className="col-span-full py-20 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-base-200 flex items-center justify-center mb-4">
                <Package size={40} className="text-base-content/20" />
              </div>
              <h3 className="text-xl font-bold">No bookings found</h3>
              <p className="text-base-content/50 max-w-sm mt-2">
                Try adjusting your filters or search terms to find specific appointments.
              </p>
              {hasFilters && (
                <button onClick={clearFilters} className="btn btn-outline btn-sm mt-6">Clear Filters</button>
              )}
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-square btn-ghost btn-sm"
            >
              <ChevronLeft size={20} />
            </button>
            
            <div className="flex items-center bg-base-200 rounded-xl p-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`btn btn-square btn-sm border-none ${page === i + 1 ? 'btn-primary shadow-lg shadow-primary/20' : 'btn-ghost'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-square btn-ghost btn-sm"
            >
              <ChevronRightIcon size={20} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}