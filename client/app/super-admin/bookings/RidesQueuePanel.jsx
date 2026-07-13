'use client';
import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  RefreshCw, MapPin, Star, ChevronLeft, ChevronRight,
  Car, Truck, UserCheck, Check, ChevronRight as ArrowIcon,
  AlertTriangle, Route,
} from 'lucide-react';
import {
  fetchAdminAllRides,
  fetchNearbyDrivers,
  adminAssignRide,
  selectAdminRides,
  selectAdminPagination,
  selectNearbyResult,
  selectAdminAllLoading,
  selectNearbyLoading,
  selectAdminAssignLoading,
} from '@/store/slices/rideRequestSlice';
import { Spinner, SectionHeader, CallButton, EmptyState, fmtDate } from './shared';

// ── Ride status filter tabs (this is Ride.status, NOT Booking.status) ───────
const RIDE_STATUS_FILTERS = [
  'searching', 'driver_assigned', 'driver_accepted', 'driver_en_route',
  'driver_arrived', 'otp_verified', 'in_progress', 'at_stop',
  'completed', 'cancelled',
];

const RIDE_STATUS_BADGE = {
  searching:       'badge-warning',
  driver_assigned: 'badge-primary',
  driver_accepted: 'badge-primary',
  driver_en_route: 'badge-secondary',
  driver_arrived:  'badge-accent',
  otp_verified:    'badge-success',
  in_progress:     'badge-success',
  at_stop:         'badge-warning',
  completed:       'badge-success',
  cancelled:       'badge-error',
};

// Statuses the backend still allows admin to assign from (router: ["searching","requested"])
const ASSIGNABLE_STATUSES = ['searching', 'requested'];

function RideStatusBadge({ status }) {
  return (
    <span className={`badge badge-sm ${RIDE_STATUS_BADGE[status] ?? 'badge-secondary'}`}>
      {status?.replace(/_/g, ' ') ?? '—'}
    </span>
  );
}

// ── Ride list (left) ──────────────────────────────────────────────────────────
function RidesList({ selectedId, onSelect, dispatch }) {
  const rides   = useSelector(selectAdminRides);
  const meta    = useSelector(selectAdminPagination);
  const loading = useSelector(selectAdminAllLoading);

  const [status, setStatus] = useState('searching');
  const [page,   setPage]   = useState(1);

  const load = useCallback((st = status, pg = page) => {
    dispatch(fetchAdminAllRides({ status: st, page: pg, limit: 20 }));
  }, [dispatch, status, page]);

  useEffect(() => { load(status, 1); setPage(1); }, [status]); // eslint-disable-line

  return (
    <div className="flex flex-col h-full">
      {/* Status tabs */}
      <div className="shrink-0 flex gap-1 flex-wrap px-3 py-3 border-b border-base-300 bg-base-200/60">
        {RIDE_STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`btn btn-xs ${status === s ? 'btn-primary' : 'bg-base-300 text-base-content'}`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Meta + refresh */}
      <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-base-300 bg-base-200/30">
        <span className="text-[10px] text-base-content/45">{meta?.total ?? 0} total</span>
        <span className="text-[10px] text-base-content/45">Page {meta?.page ?? 1}/{meta?.pages ?? 1}</span>
        <button onClick={() => load(status, page)} className="btn btn-ghost btn-xs btn-circle ml-auto" title="Refresh">
          <RefreshCw size={10} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {loading && !rides.length ? (
          <div className="flex items-center justify-center gap-2 text-xs text-base-content/40 py-16">
            <Spinner size={14} /> Loading rides…
          </div>
        ) : rides.length === 0 ? (
          <EmptyState text="No rides in this status" sub="Try another status tab" />
        ) : rides.map(r => (
          <button
            key={r._id}
            onClick={() => onSelect(r._id)}
            className={`w-full text-left rounded-xl border p-3 mb-2 transition-colors
              ${selectedId === r._id ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-200 hover:bg-base-300/40'}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold font-mono text-base-content/70">{r.rideCode ?? r._id.slice(-8)}</span>
              <RideStatusBadge status={r.status} />
            </div>
            <p className="text-[11px] text-base-content/55 m-0 truncate">
              {r.pickup?.address ?? '—'} → {r.dropoff?.address ?? '—'}
            </p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-base-content/40">
              {r.booking?.bookingCode && <span>{r.booking.bookingCode}</span>}
              {r.scheduledPickupAt && <span>{fmtDate(r.scheduledPickupAt)}</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Pagination */}
      {(meta?.pages ?? 0) > 1 && (
        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-base-300">
          <span className="text-[10px] text-base-content/45">page {page}/{meta.pages}</span>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => { const p = page - 1; setPage(p); load(status, p); }}
              className="btn btn-ghost btn-xs btn-circle"
            ><ChevronLeft size={12} /></button>
            <button
              disabled={page >= meta.pages}
              onClick={() => { const p = page + 1; setPage(p); load(status, p); }}
              className="btn btn-ghost btn-xs btn-circle"
            ><ChevronRight size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nearby + assign (right) ───────────────────────────────────────────────────
function AssignPanel({ rideId, dispatch }) {
  const rides         = useSelector(selectAdminRides);
  const nearby        = useSelector(selectNearbyResult);
  const nearbyLoading = useSelector(selectNearbyLoading);
  const assignLoading = useSelector(selectAdminAssignLoading);
  const [working, setWorking] = useState(null);
  const [done,    setDone]    = useState(null);

  const ride = rides.find(r => r._id === rideId);
  const canAssign = ride ? ASSIGNABLE_STATUSES.includes(ride.status) : false;

  const searchNearby = () => rideId && dispatch(fetchNearbyDrivers(rideId));

  const assign = async (assignType, assignId) => {
    setWorking(assignId);
    try {
      await dispatch(adminAssignRide({ rideId, assignType, assignId })).unwrap();
      setDone(assignId);
      setTimeout(() => setDone(null), 2500);
      dispatch(fetchNearbyDrivers(rideId));
    } catch {}
    setWorking(null);
  };

  if (!rideId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-base-content/30">
        <Route size={32} strokeWidth={1} />
        <p className="text-sm font-semibold m-0">Select a ride to assign a partner</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto scrollbar-thin h-full">
      <SectionHeader
        title={`Ride ${ride?.rideCode ?? rideId.slice(-8)}`}
        sub={ride ? `${ride.status?.replace(/_/g,' ')} · ${ride.pickup?.address ?? '—'} → ${ride.dropoff?.address ?? '—'}` : ''}
        action={
          <button onClick={searchNearby} disabled={nearbyLoading} className="btn btn-sm btn-outline gap-1.5">
            {nearbyLoading ? <Spinner size={12} /> : <RefreshCw size={11} />} Search Nearby
          </button>
        }
      />

      {!canAssign && ride && (
        <div className="flex items-center gap-2 text-[11px] text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
          <AlertTriangle size={11} /> Ride status "{ride.status}" is not assignable (only searching/requested).
        </div>
      )}

      {!nearby ? (
        <p className="text-xs text-base-content/40 text-center py-8">Click "Search Nearby" to find solo drivers, agency drivers, and transport partners.</p>
      ) : (
        <>
          {nearby.ratePerKm != null && (
            <p className="text-[11px] text-base-content/50 m-0">
              Rate: ₹{nearby.ratePerKm}/km ({nearby.rateSource}) · Est. fare ₹{nearby.estimatedFare} · {nearby.distKm} km
            </p>
          )}

          {/* Solo drivers */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/45 mb-2 flex items-center gap-1.5">
              <Car size={10} /> Solo Drivers ({nearby.soloDrivers?.length ?? 0})
            </p>
            <div className="flex flex-col gap-2">
              {(nearby.soloDrivers ?? []).length === 0 ? (
                <p className="text-[11px] text-base-content/35">None found</p>
              ) : nearby.soloDrivers.map(d => (
                <div key={d.soloPartnerId} className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold m-0 truncate">{d.name}</p>
                      {d.rating > 0 && <span className="flex items-center gap-0.5 text-[10px] text-warning"><Star size={8} fill="currentColor" />{d.rating?.toFixed(1)}</span>}
                    </div>
                    <p className="text-[10px] text-base-content/45 m-0 mt-0.5">{d.partnerCode} · {d.vehicle?.vehicleType ?? d.vehicle} · {d.dispatchStatus}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {d.phone && <CallButton phone={d.phone} size="xs" label="" />}
                    <button
                      onClick={() => assign('solo', d.soloPartnerId)}
                      disabled={!!working || assignLoading || !canAssign}
                      className={`btn btn-xs gap-1 ${done === d.soloPartnerId ? 'btn-success' : 'btn-primary'}`}
                    >
                      {working === d.soloPartnerId ? <Spinner size={10} /> : done === d.soloPartnerId ? <Check size={10} /> : <ArrowIcon size={10} />}
                      {done === d.soloPartnerId ? 'Assigned' : 'Assign'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Agency drivers (direct assign, bypasses TP) */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/45 mb-2 flex items-center gap-1.5">
              <UserCheck size={10} /> Agency Drivers — direct ({nearby.agencyDrivers?.length ?? 0})
            </p>
            <div className="flex flex-col gap-2">
              {(nearby.agencyDrivers ?? []).length === 0 ? (
                <p className="text-[11px] text-base-content/35">None found</p>
              ) : nearby.agencyDrivers.map(d => (
                <div key={d.driverId} className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold m-0 truncate">{d.name}</p>
                    <p className="text-[10px] text-base-content/45 m-0 mt-0.5">{d.agencyName} · {d.distanceKm} km · {d.vehicle?.registrationNumber}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {d.phone && <CallButton phone={d.phone} size="xs" label="" />}
                    <button
                      onClick={() => assign('agency_driver', d.driverId)}
                      disabled={!!working || assignLoading || !canAssign}
                      className={`btn btn-xs gap-1 ${done === d.driverId ? 'btn-success' : 'btn-primary'}`}
                    >
                      {working === d.driverId ? <Spinner size={10} /> : done === d.driverId ? <Check size={10} /> : <ArrowIcon size={10} />}
                      {done === d.driverId ? 'Assigned' : 'Assign'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transport partners (fleet-level, TP then picks their own driver) */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/45 mb-2 flex items-center gap-1.5">
              <Truck size={10} /> Transport Partners ({nearby.transportPartners?.length ?? 0})
            </p>
            <div className="flex flex-col gap-2">
              {(nearby.transportPartners ?? []).length === 0 ? (
                <p className="text-[11px] text-base-content/35">None found</p>
              ) : nearby.transportPartners.map(tp => (
                <div key={tp.tpId} className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold m-0 truncate">{tp.businessName}</p>
                    <p className="text-[10px] text-base-content/45 m-0 mt-0.5">{tp.activeDrivers}/{tp.totalDrivers} active drivers</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {tp.ownerPhone && <CallButton phone={tp.ownerPhone} size="xs" label="" />}
                    <button
                      onClick={() => assign('tp', tp.tpId)}
                      disabled={!!working || assignLoading || !canAssign}
                      className={`btn btn-xs gap-1 ${done === tp.tpId ? 'btn-success' : 'btn-primary'}`}
                    >
                      {working === tp.tpId ? <Spinner size={10} /> : done === tp.tpId ? <Check size={10} /> : <ArrowIcon size={10} />}
                      {done === tp.tpId ? 'Assigned' : 'Assign TP'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-base-content/35 mt-1 m-0">TP still needs to pick their own driver after this (PATCH /tp/:rideId/assign-driver — done from the TP side, not here).</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────
export function RidesQueuePanel() {
  const dispatch = useDispatch();
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <div className="w-[360px] shrink-0 border-r border-base-300 flex flex-col overflow-hidden">
        <RidesList selectedId={selectedId} onSelect={setSelectedId} dispatch={dispatch} />
      </div>
      <div className="flex-1 overflow-hidden">
        <AssignPanel rideId={selectedId} dispatch={dispatch} />
      </div>
    </div>
  );
}