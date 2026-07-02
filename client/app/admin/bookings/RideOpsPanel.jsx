'use client';
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Users, MapPin, Route, History, Check, RefreshCw,
  Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react';
import {
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
  fetchRideAssignmentHistory,
  fetchBookingAssignmentHistory,
  selectRideParticipants,
  selectRideStops,
  selectRideJoinPoints,
  selectRideRouteVersions,
  selectActiveRouteVersion,
  selectRideAssignmentHistory,
  selectBookingAssignmentHistory,
  selectRideOpsLoading,
} from '@/store/slices/operationsSlice';
import {
  statusBadge, fmtDate, Spinner, SectionHeader, FieldNote, CallButton,
} from './shared';

const PARTICIPANT_ROLES = ['CARE_ASSISTANT','NURSE','ESCORT','FAMILY','EQUIPMENT_HANDLER','DOCTOR'];
const PARTICIPANT_STATUS_OPTIONS = ['PENDING','EN_ROUTE','AT_JOIN_POINT','IN_VEHICLE','AT_HOSPITAL','DEPARTED','REPLACED'];
const JOIN_POINT_STATUS_OPTIONS  = ['ARRIVED','COMPLETED','MISSED','SKIPPED'];
const STOP_STATUS_OPTIONS        = ['ARRIVED','COMPLETED','SKIPPED','MISSED'];

// ── sub-tab ids ───────────────────────────────────────────────────────────────
const RIDE_OPS_TABS = [
  { id: 'participants',  label: 'Participants',   icon: Users     },
  { id: 'joinpoints',   label: 'Join Points',     icon: MapPin    },
  { id: 'stops',        label: 'Stops',           icon: Route     },
  { id: 'routes',       label: 'Route Versions',  icon: Route     },
  { id: 'history',      label: 'Assignment Log',  icon: History   },
];

// ── Participants sub-panel ────────────────────────────────────────────────────
function ParticipantsPanel({ rideId, bookingId, dispatch }) {
  const participants = useSelector(selectRideParticipants);
  const loading      = useSelector(selectRideOpsLoading);
  const [adding, setAdding]     = useState(false);
  const [role,   setRole]       = useState('CARE_ASSISTANT');
  const [refId,  setRefId]      = useState('');
  const [refModel, setRefModel] = useState('CareAssistantProfile');
  const [reason, setReason]     = useState('');
  const [working, setWorking]   = useState(null);

  useEffect(() => { if (rideId) dispatch(fetchRideParticipants({ rideId })); }, [rideId, dispatch]);

  const handleAssign = async () => {
    if (!rideId || !role) return;
    setWorking('assign');
    try {
      await dispatch(assignRideParticipant({ rideId, role, refModel, refId: refId || undefined, reason })).unwrap();
      setAdding(false); setRefId(''); setReason('');
      dispatch(fetchRideParticipants({ rideId }));
    } catch {}
    setWorking(null);
  };

  const handleStatusUpdate = async (participantId, status) => {
    setWorking(participantId);
    try {
      await dispatch(updateParticipantStatus({ rideId, participantId, status })).unwrap();
      dispatch(fetchRideParticipants({ rideId }));
    } catch {}
    setWorking(null);
  };

  const handleRemove = async (participantId) => {
    setWorking('rm-' + participantId);
    try {
      await dispatch(removeRideParticipant({ rideId, participantId, reason: 'Admin removed' })).unwrap();
      dispatch(fetchRideParticipants({ rideId }));
    } catch {}
    setWorking(null);
  };

  if (!rideId) return <p className="text-xs text-base-content/40 py-4 text-center">No active ride on booking</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-base-content/60">{participants.length} participants</span>
        <div className="flex gap-1">
          <button onClick={() => dispatch(fetchRideParticipants({ rideId }))} className="btn btn-ghost btn-xs btn-circle" title="Refresh">
            <RefreshCw size={11} />
          </button>
          <button onClick={() => setAdding(s => !s)} className="btn btn-primary btn-xs gap-1">
            <Plus size={10} /> Add
          </button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex flex-col gap-2">
          <select value={role}     onChange={e => setRole(e.target.value)}     className="input-field text-xs">
            {PARTICIPANT_ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
          </select>
          <select value={refModel} onChange={e => setRefModel(e.target.value)} className="input-field text-xs">
            <option value="CareAssistantProfile">CareAssistantProfile</option>
            <option value="DoctorProfile">DoctorProfile</option>
            <option value="User">User</option>
          </select>
          <input value={refId}   onChange={e => setRefId(e.target.value)}   placeholder="Ref ID (MongoDB ID)" className="input-field text-xs font-mono" />
          <input value={reason}  onChange={e => setReason(e.target.value)}  placeholder="Reason" className="input-field text-xs" />
          <div className="flex gap-2">
            <button onClick={handleAssign} disabled={working === 'assign'} className="btn btn-primary btn-xs gap-1">
              {working === 'assign' ? <Spinner size={10} /> : <Check size={10} />} Assign
            </button>
            <button onClick={() => setAdding(false)} className="btn btn-ghost btn-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading && !participants.length ? (
        <div className="flex items-center gap-2 text-xs text-base-content/40 py-4 justify-center"><Spinner size={12} /> Loading…</div>
      ) : participants.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-4">No participants</p>
      ) : participants.map(p => (
        <div key={p._id} className="rounded-xl border border-base-300 bg-base-200 p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <span className="text-xs font-bold text-base-content">{p.role?.replace(/_/g,' ')}</span>
              {p.snapshot?.name && <span className="text-[11px] text-base-content/55 ml-2">{p.snapshot.name}</span>}
            </div>
            <div className="flex items-center gap-1">
              {statusBadge(p.status ?? 'PENDING')}
              <button onClick={() => handleRemove(p._id)} disabled={!!working} className="btn btn-ghost btn-xs btn-circle text-error">
                {working === 'rm-' + p._id ? <Spinner size={10} /> : <Trash2 size={10} />}
              </button>
            </div>
          </div>
          {p.isReplacement && <p className="text-[10px] text-warning m-0 mb-1">Replacement participant</p>}
          <div className="flex gap-1 flex-wrap">
            {PARTICIPANT_STATUS_OPTIONS.filter(s => s !== p.status).slice(0, 3).map(s => (
              <button key={s} onClick={() => handleStatusUpdate(p._id, s)} disabled={!!working} className="btn btn-xs bg-base-300 text-base-content">
                {working === p._id ? <Spinner size={9} /> : s.replace(/_/g,' ')}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Join Points sub-panel ─────────────────────────────────────────────────────
function JoinPointsPanel({ rideId, bookingId, dispatch }) {
  const joinPoints = useSelector(selectRideJoinPoints);
  const [caLat,  setCaLat]  = useState('');
  const [caLng,  setCaLng]  = useState('');
  const [caId,   setCaId]   = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(null);

  useEffect(() => { if (rideId) dispatch(fetchRideJoinPoints({ rideId })); }, [rideId, dispatch]);

  const calcJP = async (isRecalc = false) => {
    if (!bookingId || !caId || !caLat || !caLng) return;
    setWorking(isRecalc ? 'recalc' : 'calc');
    try {
      const thunk = isRecalc ? adminRecalcJoinPoint : adminCalculateJoinPoint;
      await dispatch(thunk({ bookingId, careAssistantId: caId, caCurrentLat: parseFloat(caLat), caCurrentLng: parseFloat(caLng), ...(isRecalc && { reason }) })).unwrap();
      dispatch(fetchRideJoinPoints({ rideId }));
    } catch {}
    setWorking(null);
  };

  const updateStatus = async (rideId, jpId, status) => {
    setWorking(jpId);
    try {
      await dispatch(updateJoinPointStatus({ rideId, jpId, status })).unwrap();
      dispatch(fetchRideJoinPoints({ rideId }));
    } catch {}
    setWorking(null);
  };

  if (!rideId) return <p className="text-xs text-base-content/40 py-4 text-center">No active ride</p>;

  return (
    <div className="flex flex-col gap-3">
      {/* Calc form */}
      <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex flex-col gap-2">
        <SectionHeader title="Calculate / Recalculate Join Point" />
        <input value={caId}   onChange={e => setCaId(e.target.value)}   placeholder="Care Assistant ID (MongoDB)" className="input-field text-xs font-mono" />
        <div className="grid grid-cols-2 gap-2">
          <input value={caLat}  onChange={e => setCaLat(e.target.value)}  placeholder="CA Current Lat" type="number" step="any" className="input-field text-xs" />
          <input value={caLng}  onChange={e => setCaLng(e.target.value)}  placeholder="CA Current Lng" type="number" step="any" className="input-field text-xs" />
        </div>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (for recalc)" className="input-field text-xs" />
        <div className="flex gap-2">
          <button onClick={() => calcJP(false)} disabled={!!working || !caId || !caLat || !caLng} className="btn btn-primary btn-xs gap-1">
            {working === 'calc' ? <Spinner size={10} /> : <MapPin size={10} />} Calculate
          </button>
          <button onClick={() => calcJP(true)} disabled={!!working || !caId || !caLat || !caLng} className="btn btn-warning btn-xs gap-1">
            {working === 'recalc' ? <Spinner size={10} /> : <RefreshCw size={10} />} Recalculate
          </button>
        </div>
        <FieldNote text="Recalculate after MISSED event. Creates new JoinPoint chain." />
      </div>

      {/* History */}
      <SectionHeader title={`Join Points (${joinPoints.length})`} sub="All attempts" />
      {joinPoints.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-3">No join points calculated yet</p>
      ) : joinPoints.map(jp => (
        <div key={jp._id} className="rounded-xl border border-base-300 bg-base-200 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-base-content/50">Attempt #{jp.attemptNumber}</span>
            <div className="flex items-center gap-1">
              {statusBadge(jp.status)}
              {jp.isActive && <span className="text-[9px] text-success font-bold">ACTIVE</span>}
            </div>
          </div>
          <div className="text-[11px] text-base-content/60 grid grid-cols-2 gap-y-0.5">
            <span>Coordinates</span>
            <span className="font-mono">{jp.location?.coordinates?.[1]?.toFixed(4)}, {jp.location?.coordinates?.[0]?.toFixed(4)}</span>
            <span>Dist CA→JP</span>
            <span>{jp.calculationMeta?.distanceFromParticipantKm?.toFixed(2)} km</span>
            <span>Locked</span>
            <span>{fmtDate(jp.lockedAt)}</span>
          </div>
          {jp.isActive && jp.status === 'LOCKED' && (
            <div className="flex gap-1 flex-wrap mt-2">
              {JOIN_POINT_STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => updateStatus(rideId, jp._id, s)} disabled={!!working} className="btn btn-xs bg-base-300 text-base-content">
                  {working === jp._id ? <Spinner size={9} /> : s}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Stops sub-panel ───────────────────────────────────────────────────────────
function StopsPanel({ rideId, dispatch }) {
  const stops   = useSelector(selectRideStops);
  const loading = useSelector(selectRideOpsLoading);
  const [otpInputs, setOtpInputs] = useState({});
  const [working, setWorking]     = useState(null);

  useEffect(() => { if (rideId) dispatch(fetchRideStops({ rideId })); }, [rideId, dispatch]);

  const handleOtpVerify = async (stopId) => {
    const otp = otpInputs[stopId];
    if (!otp) return;
    setWorking(stopId);
    try {
      await dispatch(verifyStopOtp({ rideId, stopId, otp })).unwrap();
      dispatch(fetchRideStops({ rideId }));
    } catch {}
    setWorking(null);
  };

  const handleStatusUpdate = async (stopId, status) => {
    setWorking(stopId + status);
    try {
      await dispatch(updateStopStatus({ rideId, stopId, status })).unwrap();
      dispatch(fetchRideStops({ rideId }));
    } catch {}
    setWorking(null);
  };

  if (!rideId) return <p className="text-xs text-base-content/40 py-4 text-center">No active ride</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-base-content/60">{stops.length} stops</span>
        <button onClick={() => dispatch(fetchRideStops({ rideId }))} className="btn btn-ghost btn-xs btn-circle">
          <RefreshCw size={11} />
        </button>
      </div>

      {loading && !stops.length ? (
        <div className="flex items-center gap-2 text-xs text-base-content/40 justify-center py-4"><Spinner size={12} /> Loading…</div>
      ) : stops.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-4">No stops for this ride</p>
      ) : stops.map(stop => (
        <div key={stop._id} className="rounded-xl border border-base-300 bg-base-200 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-base-content/40">#{stop.sequence}</span>
              <span className="text-xs font-bold text-base-content">{stop.stopType?.replace(/_/g,' ')}</span>
            </div>
            {statusBadge(stop.status)}
          </div>

          {stop.location?.address && (
            <p className="text-[11px] text-base-content/55 m-0 mb-1.5 flex items-start gap-1">
              <MapPin size={9} className="mt-0.5 shrink-0" /> {stop.location.address}
            </p>
          )}

          {stop.arrival?.actualAt && (
            <p className="text-[10px] text-base-content/40 m-0">Arrived: {fmtDate(stop.arrival.actualAt)}</p>
          )}
          {stop.departure?.actualAt && (
            <p className="text-[10px] text-base-content/40 m-0">Departed: {fmtDate(stop.departure.actualAt)}</p>
          )}

          {/* OTP verify for PATIENT_PICKUP */}
          {stop.stopType === 'PATIENT_PICKUP' && stop.status === 'ARRIVED' && (
            <div className="flex gap-2 mt-2">
              <input
                value={otpInputs[stop._id] ?? ''}
                onChange={e => setOtpInputs(p => ({ ...p, [stop._id]: e.target.value }))}
                placeholder="Enter OTP"
                maxLength={6}
                className="input-field text-xs w-28 font-mono"
              />
              <button onClick={() => handleOtpVerify(stop._id)} disabled={!!working} className="btn btn-xs btn-success gap-1">
                {working === stop._id ? <Spinner size={9} /> : <Check size={9} />} Verify OTP
              </button>
            </div>
          )}

          {/* Status update buttons */}
          {!['COMPLETED','SKIPPED'].includes(stop.status) && (
            <div className="flex gap-1 flex-wrap mt-2">
              {STOP_STATUS_OPTIONS.filter(s => s !== stop.status).map(s => (
                <button key={s} onClick={() => handleStatusUpdate(stop._id, s)} disabled={!!working} className="btn btn-xs bg-base-300 text-base-content">
                  {working === stop._id + s ? <Spinner size={9} /> : s}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Route versions sub-panel ──────────────────────────────────────────────────
function RouteVersionsPanel({ rideId, dispatch }) {
  const versions = useSelector(selectRideRouteVersions);
  const active   = useSelector(selectActiveRouteVersion);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (rideId) {
      dispatch(fetchRouteVersions({ rideId }));
      dispatch(fetchActiveRouteVersion({ rideId }));
    }
  }, [rideId, dispatch]);

  if (!rideId) return <p className="text-xs text-base-content/40 py-4 text-center">No active ride</p>;

  return (
    <div className="flex flex-col gap-3">
      {active && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-3">
          <SectionHeader title={`Active Route — v${active.versionNumber}`} />
          <div className="grid grid-cols-2 gap-y-0.5 text-[11px]">
            <span className="text-base-content/45">Distance</span>
            <span>{active.totalDistanceKm} km</span>
            <span className="text-base-content/45">Duration</span>
            <span>{active.totalDurationMin} min</span>
            <span className="text-base-content/45">Reason</span>
            <span>{active.generatedReason?.replace(/_/g,' ')}</span>
            <span className="text-base-content/45">Stops</span>
            <span>{active.stops?.length ?? 0}</span>
          </div>
        </div>
      )}

      <SectionHeader title={`All Versions (${versions.length})`} />
      {versions.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-3">No route versions</p>
      ) : [...versions].reverse().map(rv => (
        <div key={rv._id} className="rounded-xl border border-base-300 bg-base-200 p-3">
          <button onClick={() => setExpanded(expanded === rv._id ? null : rv._id)} className="w-full flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-base-content">v{rv.versionNumber}</span>
              {rv.isActive && <span className="text-[9px] text-success font-bold border border-success/30 px-1.5 rounded-full">ACTIVE</span>}
              <span className="text-[10px] text-base-content/40">{rv.generatedReason?.replace(/_/g,' ')}</span>
            </div>
            {expanded === rv._id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
          {expanded === rv._id && (
            <div className="mt-2 grid grid-cols-2 gap-y-0.5 text-[11px] border-t border-base-300/60 pt-2">
              <span className="text-base-content/45">Distance</span>
              <span>{rv.totalDistanceKm} km</span>
              <span className="text-base-content/45">Duration</span>
              <span>{rv.totalDurationMin} min</span>
              <span className="text-base-content/45">Stops</span>
              <span>{rv.stops?.length ?? 0}</span>
              {rv.supersededAt && (
                <><span className="text-base-content/45">Superseded</span><span>{fmtDate(rv.supersededAt)}</span></>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Assignment history sub-panel ──────────────────────────────────────────────
function AssignmentHistoryPanel({ rideId, bookingId, dispatch }) {
  const rideHistory    = useSelector(selectRideAssignmentHistory);
  const bookingHistory = useSelector(selectBookingAssignmentHistory);
  const [tab, setTab]  = useState('booking');

  useEffect(() => {
    if (rideId)    dispatch(fetchRideAssignmentHistory({ rideId }));
    if (bookingId) dispatch(fetchBookingAssignmentHistory({ bookingId }));
  }, [rideId, bookingId, dispatch]);

  const history = tab === 'ride' ? rideHistory : bookingHistory;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1">
        <button onClick={() => setTab('booking')} className={`btn btn-xs ${tab === 'booking' ? 'btn-primary' : 'bg-base-300 text-base-content'}`}>By Booking</button>
        <button onClick={() => setTab('ride')}    className={`btn btn-xs ${tab === 'ride'    ? 'btn-primary' : 'bg-base-300 text-base-content'}`}>By Ride</button>
      </div>

      <p className="text-[10px] text-base-content/45">{history.length} events</p>

      {history.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-4">No assignment events</p>
      ) : history.map((h, i) => (
        <div key={h._id ?? i} className="flex items-start justify-between gap-2 text-[11px] border-b border-base-300/60 last:border-0 py-1.5">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`font-bold ${h.action === 'ASSIGNED' ? 'text-success' : h.action === 'REPLACED' ? 'text-warning' : h.action === 'REMOVED' ? 'text-error' : 'text-base-content/70'}`}>
                {h.action}
              </span>
              <span className="text-base-content/50">{h.assignmentType?.replace(/_/g,' ')}</span>
            </div>
            {h.entityRefModel && <p className="text-[10px] text-base-content/35 m-0">{h.entityRefModel}</p>}
            {h.reason && <p className="text-[10px] text-base-content/35 m-0 italic">{h.reason}</p>}
            {h.performedBy?.name && <p className="text-[10px] text-base-content/40 m-0">By: {h.performedBy.name}</p>}
          </div>
          <span className="text-base-content/35 shrink-0">{fmtDate(h.effectiveAt ?? h.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main RideOpsPanel ─────────────────────────────────────────────────────────
export function RideOpsPanel({ booking, dispatch }) {
  const rideId    = booking?.primaryRide?._id ?? booking?.primaryRide;
  const bookingId = booking?._id;
  const [tab, setTab] = useState('participants');

  return (
    <div className="flex flex-col gap-3">
      {!rideId && (
        <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-2">
          <AlertTriangle size={11} /> No primary ride. Create a ride first via Care Ride or Assign tab.
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap">
        {RIDE_OPS_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`btn btn-xs gap-1.5 ${tab === t.id ? 'btn-primary' : 'bg-base-300 text-base-content'}`}>
              <Icon size={9} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'participants' && <ParticipantsPanel  rideId={rideId} bookingId={bookingId} dispatch={dispatch} />}
      {tab === 'joinpoints'  && <JoinPointsPanel     rideId={rideId} bookingId={bookingId} dispatch={dispatch} />}
      {tab === 'stops'       && <StopsPanel          rideId={rideId} dispatch={dispatch} />}
      {tab === 'routes'      && <RouteVersionsPanel  rideId={rideId} dispatch={dispatch} />}
      {tab === 'history'     && <AssignmentHistoryPanel rideId={rideId} bookingId={bookingId} dispatch={dispatch} />}
    </div>
  );
}