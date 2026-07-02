'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  AlertTriangle, Check, RefreshCw, MapPin,
  ChevronDown, ChevronUp, Clock, Shield,
} from 'lucide-react';
import {
  fetchAdminActiveSos,
  resolveAdminSos,
  fetchAdminActiveSosPaginated,
  fetchAdminDestinationAudit,
  triggerBookingSos,
  fetchBookingSosEvents,
  resolveRideOpsSos,
  rideOpsChangeDestination,
  fetchDestinationHistory,
  selectAdminActiveSos,
  selectAdminActiveSosMeta,
  selectAdminSosLoading,
  selectBookingSosEvents,
  selectDestinationAudit,
} from '@/store/slices/operationsSlice';
import {
  statusBadge, fmtDate, Spinner, SectionHeader, FieldNote, CallButton,
} from './shared';

const SOS_TYPES = ['MEDICAL','SAFETY','VEHICLE_BREAKDOWN','ACCIDENT','PATIENT_CONDITION','OTHER'];

// ── Single SOS card ───────────────────────────────────────────────────────────
function SosCard({ event, onResolve, resolving }) {
  const [notes, setNotes]     = useState('');
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-error/40 bg-error/5 p-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <AlertTriangle size={12} className="text-error shrink-0" />
          <span className="text-xs font-bold text-error">{event.sosType?.replace(/_/g,' ')}</span>
          <span className="text-[10px] text-base-content/50">{event.triggeredByRole ?? event.triggeredBy ?? '—'}</span>
        </div>
        <span className="text-[10px] text-base-content/35 shrink-0">{fmtDate(event.createdAt)}</span>
      </div>

      {/* Booking / ride ref */}
      <div className="text-[11px] text-base-content/55 mb-2 flex flex-wrap gap-2">
        {event.booking?.bookingCode && <span>Booking: <span className="font-mono font-bold text-primary">{event.booking.bookingCode}</span></span>}
        {event.booking?.bookingType && <span>Type: {event.booking.bookingType?.replace(/_/g,' ')}</span>}
        {event.booking?.patientInfo?.name && <span>Patient: {event.booking.patientInfo.name}</span>}
        {event.ride?.status && <span>Ride: {event.ride.status?.replace(/_/g,' ')}</span>}
      </div>

      {/* Triggered by */}
      {event.triggeredByUserId && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-base-content/40">By: {event.triggeredByUserId.name ?? '—'}</span>
          <CallButton phone={event.triggeredByUserId.phone} label="" size="xs" />
        </div>
      )}

      {/* Description */}
      {event.description && (
        <p className="text-[11px] text-base-content/60 m-0 mb-2 italic">{event.description}</p>
      )}

      {/* Expand for snapshot */}
      <button onClick={() => setExpanded(s => !s)} className="flex items-center gap-1 text-[10px] text-base-content/40 mb-2">
        {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />} Details
      </button>

      {expanded && event.snapshot && (
        <div className="rounded-lg bg-base-300/40 p-2 mb-2 text-[10px] text-base-content/55 grid grid-cols-2 gap-y-0.5">
          {event.snapshot.rideStatus && <><span>Ride status</span><span>{event.snapshot.rideStatus?.replace(/_/g,' ')}</span></>}
          {event.snapshot.coordinates?.length === 2 && (
            <><span>Coordinates</span><span className="font-mono">{event.snapshot.coordinates[1]?.toFixed(4)}, {event.snapshot.coordinates[0]?.toFixed(4)}</span></>
          )}
        </div>
      )}

      {/* Resolve */}
      {!event.isResolved && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Resolution notes…"
            rows={2}
            className="input-field text-xs resize-none"
          />
          <button
            onClick={() => onResolve(event._id, notes)}
            disabled={resolving === event._id}
            className="btn btn-xs btn-success gap-1 self-start"
          >
            {resolving === event._id ? <Spinner size={10} /> : <Check size={10} />} Resolve SOS
          </button>
        </div>
      )}

      {event.isResolved && (
        <div className="flex items-center gap-1.5 text-[10px] text-success mt-1">
          <Shield size={10} /> Resolved {fmtDate(event.resolvedAt)}
          {event.resolutionNotes && <span className="text-base-content/40 italic ml-1">{event.resolutionNotes}</span>}
        </div>
      )}
    </div>
  );
}

// ── Admin SOS list (global, paginated from ride-ops) ─────────────────────────
export function SosPanelAdmin({ dispatch }) {
  const events  = useSelector(selectAdminActiveSos);
  const meta    = useSelector(selectAdminActiveSosMeta);
  const loading = useSelector(selectAdminSosLoading);

  const [page,    setPage]    = useState(1);
  const [sosType, setSosType] = useState('');
  const [resolving, setResolving] = useState(null);

  // Use paginated version (ride-ops router)
  const load = (pg = page) => {
    dispatch(fetchAdminActiveSosPaginated({ sosType: sosType || undefined, page: pg, limit: 15 }));
  };

  useEffect(() => { load(1); setPage(1); }, [sosType]);

  const handleResolve = async (sosId, resolutionNotes) => {
    setResolving(sosId);
    try {
      // Try rideOps resolve first, fall back to bookingRouter2
      try {
        await dispatch(resolveRideOpsSos({ sosId, resolutionNotes })).unwrap();
      } catch {
        await dispatch(resolveAdminSos({ sosEventId: sosId, resolutionNotes })).unwrap();
      }
      load(page);
    } catch {}
    setResolving(null);
  };

  return (
    <div className="p-6 flex flex-col gap-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={18} className="text-error" />
            <h3 className="m-0 text-base">Active SOS Alerts</h3>
            {meta?.total > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-error text-white text-[10px] font-bold">
                {meta.total > 9 ? '9+' : meta.total}
              </span>
            )}
          </div>
          <p className="text-xs text-base-content/45 m-0">Unresolved emergency events across all active rides</p>
        </div>

        <div className="flex items-center gap-2">
          <select value={sosType} onChange={e => setSosType(e.target.value)} className="input-field text-xs w-auto">
            <option value="">All types</option>
            {SOS_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
          <button onClick={() => load(page)} disabled={loading} className="btn btn-ghost btn-sm btn-circle">
            {loading ? <Spinner size={13} /> : <RefreshCw size={13} />}
          </button>
        </div>
      </div>

      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center gap-2 text-base-content/40 text-xs py-20">
          <Spinner size={14} /> Loading SOS events…
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-base-content/30">
          <Shield size={40} strokeWidth={1} className="text-success" />
          <p className="text-sm font-semibold m-0">No active SOS alerts</p>
          <p className="text-xs m-0">All clear</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(e => (
            <SosCard key={e._id} event={e} onResolve={handleResolve} resolving={resolving} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {(meta?.pages ?? 0) > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-base-300">
          <span className="text-[10px] text-base-content/40">{meta.total} events · page {page}/{meta.pages}</span>
          <div className="flex gap-1">
            <button disabled={page <= 1}          onClick={() => { const p = page-1; setPage(p); load(p); }} className="btn btn-ghost btn-xs">Prev</button>
            <button disabled={page >= meta.pages} onClick={() => { const p = page+1; setPage(p); load(p); }} className="btn btn-ghost btn-xs">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Booking-level SOS panel (shown inside BookingDetailPanel) ─────────────────
export function BookingSosPanelInline({ booking, dispatch }) {
  const events  = useSelector(selectBookingSosEvents);
  const [loading, setLoading]   = useState(false);
  const [resolving, setResolving] = useState(null);
  const [trigType, setTrigType] = useState('OTHER');
  const [desc,    setDesc]      = useState('');
  const [trigLoading, setTrigLoading] = useState(false);

  const rideId = booking?.primaryRide?._id ?? booking?.primaryRide;

  const load = () => dispatch(fetchBookingSosEvents({ bookingId: booking._id }));
  useEffect(() => { load(); }, [booking._id]);

  const handleResolve = async (sosId, notes) => {
    setResolving(sosId);
    try {
      await dispatch(resolveRideOpsSos({ sosId, resolutionNotes: notes })).unwrap();
      load();
    } catch {}
    setResolving(null);
  };

  const handleTrigger = async () => {
    setTrigLoading(true);
    try {
      await dispatch(triggerBookingSos({
        bookingId: booking._id,
        sosType: trigType,
        description: desc || undefined,
        rideId: rideId || undefined,
      })).unwrap();
      setDesc('');
      load();
    } catch {}
    setTrigLoading(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionHeader title={`SOS Events (${events.length})`} sub="All SOS for this booking" />
        <button onClick={load} className="btn btn-ghost btn-xs btn-circle"><RefreshCw size={10} /></button>
      </div>

      {/* Trigger SOS */}
      <div className="rounded-xl border border-error/30 bg-error/5 p-3 flex flex-col gap-2">
        <p className="text-[10px] font-bold text-error/70 uppercase tracking-widest m-0">Trigger Admin SOS</p>
        <select value={trigType} onChange={e => setTrigType(e.target.value)} className="input-field text-xs">
          {SOS_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)" className="input-field text-xs" />
        <button onClick={handleTrigger} disabled={trigLoading} className="btn btn-error btn-xs gap-1 self-start">
          {trigLoading ? <Spinner size={10} /> : <AlertTriangle size={10} />} Trigger SOS
        </button>
      </div>

      {/* Events list */}
      {events.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-3">No SOS events for this booking</p>
      ) : events.map(e => (
        <SosCard key={e._id} event={e} onResolve={handleResolve} resolving={resolving} />
      ))}
    </div>
  );
}

// ── Destination history panel (rideOps version) ───────────────────────────────
export function DestinationHistoryPanel({ booking, dispatch }) {
  const audit   = useSelector(selectDestinationAudit);
  const [loading, setLoading]  = useState(false);
  const [newLat, setNewLat]    = useState('');
  const [newLng, setNewLng]    = useState('');
  const [newAddr,setNewAddr]   = useState('');
  const [reason, setReason]    = useState('');
  const [working,setWorking]   = useState(false);
  const [done,   setDone]      = useState(false);

  useEffect(() => {
    if (booking._id) dispatch(fetchDestinationHistory({ bookingId: booking._id }));
  }, [booking._id, dispatch]);

  const handleChange = async () => {
    if (!newLat || !newLng || !reason) return;
    setWorking(true);
    try {
      await dispatch(rideOpsChangeDestination({
        bookingId:  booking._id,
        newLat:     parseFloat(newLat),
        newLng:     parseFloat(newLng),
        newAddress: newAddr || undefined,
        reason,
      })).unwrap();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      dispatch(fetchDestinationHistory({ bookingId: booking._id }));
    } catch {}
    setWorking(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="Change Destination (Ride-Ops)" sub="Requires driver accepted. Creates RouteVersion." />
      <FieldNote text="Different from bookingRouter2 adminChangeDestination — this is the rideOps version." />

      <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <input value={newLat}  onChange={e => setNewLat(e.target.value)}  placeholder="New Lat" type="number" step="any" className="input-field text-xs" />
          <input value={newLng}  onChange={e => setNewLng(e.target.value)}  placeholder="New Lng" type="number" step="any" className="input-field text-xs" />
        </div>
        <input value={newAddr} onChange={e => setNewAddr(e.target.value)} placeholder="Address" className="input-field text-xs" />
        <input value={reason}  onChange={e => setReason(e.target.value)}  placeholder="Reason (required)" className="input-field text-xs" />
        <button onClick={handleChange} disabled={working || !newLat || !newLng || !reason} className={`btn btn-sm gap-1.5 self-start ${done ? 'btn-success' : 'btn-warning'}`}>
          {working ? <Spinner size={12} /> : done ? <Check size={12} /> : <MapPin size={11} />}
          {done ? 'Destination Changed' : 'Change Destination'}
        </button>
      </div>

      {/* Audit trail */}
      <SectionHeader title={`Change History (${audit.length})`} />
      {audit.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-3">No destination changes yet</p>
      ) : audit.map((a, i) => (
        <div key={a._id ?? i} className="rounded-xl border border-base-300 bg-base-200 p-3">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <MapPin size={10} className="text-warning" />
              <span className="text-xs font-bold text-base-content/70">
                {a.newDestination?.address || `${a.newDestination?.coordinates?.[1]?.toFixed(4)}, ${a.newDestination?.coordinates?.[0]?.toFixed(4)}`}
              </span>
            </div>
            <span className="text-[10px] text-base-content/35 shrink-0">{fmtDate(a.changedAt ?? a.createdAt)}</span>
          </div>
          <p className="text-[11px] text-base-content/50 m-0 italic">{a.reason}</p>
          {a.changedBy?.name && <p className="text-[10px] text-base-content/35 m-0 mt-0.5">By: {a.changedBy.name} ({a.changedBy.role})</p>}
          {a.oldDestination?.address && (
            <p className="text-[10px] text-base-content/30 m-0 mt-0.5">
              From: {a.oldDestination.address}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}