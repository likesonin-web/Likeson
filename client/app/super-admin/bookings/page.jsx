'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, Filter, Download, RefreshCw, X, ChevronLeft,
  ChevronRight, Bell, BarChart2, HelpCircle, AlertTriangle,
  Layers, CheckCircle, Clock,
} from 'lucide-react';

// ── Slice imports ────────────────────────────────────────────────────────────
import {
  // Admin bookings list
  fetchAdminBookings,
  fetchAdminBookingStats,
  exportAdminBookings,
  fetchAdminBookingById,
  updateAdminBookingStatus,
  adminChangeDestination,
  clearAdminBookingDetail,
  clearAdminBookingDetail as clearDetail,

  // Nearby
  fetchNearbyCareAssistants,
  fetchNearbySoloDrivers,
  fetchNearbyTransportPartners,
  fetchNearbyHospitals,

  // Assignment
  adminAssignSoloDriver,
  adminAssignTransportPartner,
  adminAssignCareAssistant,
  adminAssignHospital,
  adminReassignCareAssistant,

  // Refund
  adminProcessRefund,

  // OPs
  fetchAdminOps,
  updateAdminOpStatus,

  // SOS
  fetchAdminActiveSos,
  resolveAdminSos,
  fetchAdminDestinationAudit,
  fetchAdminActiveSosPaginated,

  // Care ride
  adminRequestCareRide,
  fetchAdminCareRideNearby,

  // Ride ops
  fetchRideParticipants,
  assignRideParticipant,
  fetchRideParticipant,
  updateParticipantStatus,
  removeRideParticipant,
  adminCalculateJoinPoint,
  adminRecalcJoinPoint,
  fetchRideJoinPoints,
  updateJoinPointStatus,
  fetchRideStops,
  fetchRideStop,
  verifyStopOtp,
  updateStopStatus,
  fetchRouteVersions,
  fetchActiveRouteVersion,
  triggerBookingSos,
  fetchBookingSosEvents,
  resolveRideOpsSos,
  rideOpsChangeDestination,
  fetchDestinationHistory,
  fetchRideAssignmentHistory,
  fetchBookingAssignmentHistory,

  // Socket
  joinBookingRoom,
  leaveBookingRoom,

  // Selectors
  selectAdminBookings,
  selectAdminBookingsMeta,
  selectAdminBookingsLoading,
  selectAdminBookingDetail,
  selectAdminBookingDetailLoading,
  selectAdminStats,
  selectAdminStatsLoading,
  selectAdminActiveSos,
  selectAdminActiveSosMeta,
  selectAdminSosLoading,
  selectAdminExportLoading,
} from '@/store/slices/operationsSlice';

// ── Local components ─────────────────────────────────────────────────────────
import {
  BOOKING_TYPES, BOOKING_STATUSES,
  fmt, fmtDate, currency, statusBadge, typeIcon,
  Spinner, EmptyState, StatCard, CallButton,
} from './shared';
import { BookingCard, AnalysisSection } from './Analyticsbookingcard';
import { BookingDetailPanel } from './BookingDetailPanel';
import { HelpSection } from './HelpSection';
import { SosPanelAdmin } from './SosDestinationPanel';

// ── Constants ────────────────────────────────────────────────────────────────
const MAIN_TABS = ['bookings', 'analysis', 'sos', 'help'];
const POLL_MS   = 30_000; // 30s auto-refresh for SOS

// ── Export all thunks as named map for child panels ─────────────────────────
export const ADMIN_THUNKS = {
  fetchAdminBookings,
  fetchAdminBookingStats,
  exportAdminBookings,
  fetchAdminBookingById,
  updateAdminBookingStatus,
  adminChangeDestination,
  fetchNearbyCareAssistants,
  fetchNearbySoloDrivers,
  fetchNearbyTransportPartners,
  fetchNearbyHospitals,
  adminAssignSoloDriver,
  adminAssignTransportPartner,
  adminAssignCareAssistant,
  adminAssignHospital,
  adminReassignCareAssistant,
  adminProcessRefund,
  fetchAdminOps,
  updateAdminOpStatus,
  fetchAdminActiveSos,
  resolveAdminSos,
  fetchAdminDestinationAudit,
  fetchAdminActiveSosPaginated,
  adminRequestCareRide,
  fetchAdminCareRideNearby,
  fetchRideParticipants,
  assignRideParticipant,
  fetchRideParticipant,
  updateParticipantStatus,
  removeRideParticipant,
  adminCalculateJoinPoint,
  adminRecalcJoinPoint,
  fetchRideJoinPoints,
  updateJoinPointStatus,
  fetchRideStops,
  fetchRideStop,
  verifyStopOtp,
  updateStopStatus,
  fetchRouteVersions,
  fetchActiveRouteVersion,
  triggerBookingSos,
  fetchBookingSosEvents,
  resolveRideOpsSos,
  rideOpsChangeDestination,
  fetchDestinationHistory,
  fetchRideAssignmentHistory,
  fetchBookingAssignmentHistory,
  joinBookingRoom,
  leaveBookingRoom,
};

// ── Filter bar ───────────────────────────────────────────────────────────────
function FilterBar({ filters, setFilters, onSearch, loading, onExport, exportLoading }) {
  const [showAdv, setShowAdv] = useState(false);

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-base-300 bg-base-100 shrink-0">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Booking code or patient name…"
            className="input-field w-full pl-8 text-xs"
          />
        </div>
        <button onClick={onSearch} className="btn btn-primary btn-sm gap-1" disabled={loading}>
          {loading ? <Spinner size={12} /> : <Search size={11} />} Search
        </button>
        <button onClick={() => setShowAdv(s => !s)} className="btn btn-ghost btn-sm btn-circle" title="Advanced filters">
          <Filter size={13} className={showAdv ? 'text-primary' : ''} />
        </button>
        <button onClick={onExport} className="btn btn-ghost btn-sm gap-1" disabled={exportLoading} title="Export CSV">
          {exportLoading ? <Spinner size={12} /> : <Download size={12} />}
        </button>
      </div>

      {showAdv && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-2">
          <select value={filters.status} onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))} className="input-field text-xs">
            <option value="">All statuses</option>
            {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          <select value={filters.bookingType} onChange={(e) => setFilters(f => ({ ...f, bookingType: e.target.value }))} className="input-field text-xs">
            <option value="">All types</option>
            {BOOKING_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
          <input type="date" value={filters.from} onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))} className="input-field text-xs" placeholder="From" />
          <input type="date" value={filters.to}   onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}   className="input-field text-xs" placeholder="To" />
          <input value={filters.city} onChange={(e) => setFilters(f => ({ ...f, city: e.target.value }))} placeholder="City" className="input-field text-xs" />
          <button onClick={() => setFilters({ search:'', status:'', bookingType:'', from:'', to:'', city:'' })} className="btn btn-ghost btn-sm gap-1 text-error">
            <X size={11} /> Clear filters
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ── Bookings list panel ──────────────────────────────────────────────────────
function BookingListPanel({ selectedId, onSelect, dispatch }) {
  const bookings     = useSelector(selectAdminBookings);
  const meta         = useSelector(selectAdminBookingsMeta);
  const loading      = useSelector(selectAdminBookingsLoading);
  const exportLoading= useSelector(selectAdminExportLoading);

  const [filters, setFilters] = useState({ search:'', status:'', bookingType:'', from:'', to:'', city:'' });
  const [page, setPage]       = useState(1);

  const doFetch = useCallback((pg = page) => {
    dispatch(fetchAdminBookings({
      page: pg, limit: 20,
      ...(filters.search      && { search:      filters.search }),
      ...(filters.status      && { status:      filters.status }),
      ...(filters.bookingType && { bookingType: filters.bookingType }),
      ...(filters.from        && { from:        filters.from }),
      ...(filters.to          && { to:          filters.to }),
      ...(filters.city        && { city:        filters.city }),
    }));
  }, [dispatch, filters, page]);

  useEffect(() => { doFetch(1); setPage(1); }, []); // initial load

  const handleSearch = () => { setPage(1); doFetch(1); };

  const handleExport = () => {
    dispatch(exportAdminBookings({
      from: filters.from || undefined,
      to:   filters.to   || undefined,
      status:      filters.status      || undefined,
      bookingType: filters.bookingType || undefined,
    }));
  };

  const changePage = (np) => { setPage(np); doFetch(np); };

  return (
    <div className="flex flex-col h-full">
      <FilterBar
        filters={filters} setFilters={setFilters}
        onSearch={handleSearch} loading={loading}
        onExport={handleExport} exportLoading={exportLoading}
      />

      {/* Stats row */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-base-300 bg-base-200/40 shrink-0">
        <span className="text-[10px] text-base-content/45 flex items-center gap-1">
          <Layers size={9} /> {meta?.total ?? 0} total
        </span>
        <span className="text-[10px] text-base-content/45 flex items-center gap-1">
          Page {meta?.page ?? 1}/{meta?.pages ?? 1}
        </span>
        <button onClick={() => doFetch(page)} className="btn btn-ghost btn-xs btn-circle ml-auto" title="Refresh">
          <RefreshCw size={10} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {loading && !bookings.length ? (
          <div className="flex items-center justify-center gap-2 text-xs text-base-content/40 py-20">
            <Spinner size={14} /> Loading bookings…
          </div>
        ) : bookings.length === 0 ? (
          <EmptyState text="No bookings found" sub="Try adjusting filters" />
        ) : (
          <AnimatePresence>
            {bookings.map(b => (
              <BookingCard
                key={b._id}
                booking={b}
                selected={selectedId === b._id}
                onClick={() => onSelect(b._id)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Pagination */}
      {(meta?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-base-300 shrink-0">
          <span className="text-[10px] text-base-content/45">
            {meta.total} bookings · page {page}/{meta.pages}
          </span>
          <div className="flex gap-1">
            <button disabled={page <= 1}             onClick={() => changePage(page - 1)} className="btn btn-ghost btn-xs btn-circle"><ChevronLeft  size={12} /></button>
            <button disabled={page >= meta.pages}    onClick={() => changePage(page + 1)} className="btn btn-ghost btn-xs btn-circle"><ChevronRight size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SOS badge ────────────────────────────────────────────────────────────────
function SosBadge({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-error text-white text-[9px] font-bold ml-1">
      {count > 9 ? '9+' : count}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BookingsManagement() {
  const dispatch     = useDispatch();
  const [mainTab, setMainTab]         = useState('bookings');
  const [selectedId, setSelectedId]   = useState(null);
  const [detailNavTab, setDetailNavTab] = useState(null);

  const activeSos    = useSelector(selectAdminActiveSos);
  const sosLoading   = useSelector(selectAdminSosLoading);

  // Initial SOS poll
  useEffect(() => {
    dispatch(fetchAdminActiveSos());
    const iv = setInterval(() => dispatch(fetchAdminActiveSos()), POLL_MS);
    return () => clearInterval(iv);
  }, [dispatch]);

  // Join booking room when selected
  const prevIdRef = useRef(null);
  useEffect(() => {
    if (prevIdRef.current && prevIdRef.current !== selectedId) {
      dispatch(leaveBookingRoom({ bookingId: prevIdRef.current }));
    }
    if (selectedId) {
      dispatch(joinBookingRoom({ bookingId: selectedId }));
    }
    prevIdRef.current = selectedId;
    return () => {
      if (selectedId) dispatch(leaveBookingRoom({ bookingId: selectedId }));
    };
  }, [selectedId, dispatch]);

  const handleSelect = (id) => {
    setSelectedId(id);
    setDetailNavTab(null);
    if (mainTab !== 'bookings') setMainTab('bookings');
  };

  // Help section can navigate to a detail tab
  const handleHelpNavigate = (section) => {
    if (['status','assign','refund','op','care_ride','tracking','consultation','payment'].includes(section)) {
      setDetailNavTab(section);
    } else if (section === 'analysis') {
      setMainTab('analysis');
    } else if (section === 'bookings') {
      setMainTab('bookings');
    }
  };

  const TAB_LABELS = {
    bookings: 'Bookings',
    analysis: 'Analysis',
    sos:      'SOS Alerts',
    help:     'Help',
  };

  return (
    <div className="flex flex-col h-screen bg-base-100 overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-base-300 bg-base-100 z-10">
        <div>
          <h2 className="m-0 text-base font-bold">Bookings Management</h2>
          <p className="text-[10px] text-base-content/45 m-0">Admin operations dashboard</p>
        </div>

        <div className="flex items-center gap-1">
          {MAIN_TABS.map(t => (
            <button
              key={t}
              onClick={() => setMainTab(t)}
              className={`btn btn-sm gap-1.5 ${mainTab === t ? 'btn-primary' : 'btn-ghost text-base-content/60'}`}
            >
              {t === 'analysis' && <BarChart2 size={11} />}
              {t === 'sos'      && <><AlertTriangle size={11} />{activeSos.length > 0 && <SosBadge count={activeSos.length} />}</>}
              {t === 'help'     && <HelpCircle size={11} />}
              {t === 'bookings' && <Layers size={11} />}
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {mainTab === 'bookings' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left — list */}
          <div className="w-[340px] shrink-0 border-r border-base-300 flex flex-col overflow-hidden">
            <BookingListPanel
              selectedId={selectedId}
              onSelect={handleSelect}
              dispatch={dispatch}
            />
          </div>

          {/* Right — detail */}
          <div className="flex-1 overflow-y-auto">
            <BookingDetailPanel
              bookingId={selectedId}
              dispatch={dispatch}
              onTabNavigate={detailNavTab}
            />
          </div>
        </div>
      )}

      {mainTab === 'analysis' && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <AnalysisSection dispatch={dispatch} />
        </div>
      )}

      {mainTab === 'sos' && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <SosPanelAdmin dispatch={dispatch} />
        </div>
      )}

      {mainTab === 'help' && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <HelpSection onNavigate={handleHelpNavigate} />
        </div>
      )}
    </div>
  );
}