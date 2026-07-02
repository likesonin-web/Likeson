'use client';
import { useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  UserCheck, Car, Truck, Hospital, RefreshCw, Check,
  MapPin, Star, Phone, ChevronRight, AlertTriangle,
} from 'lucide-react';
import {
  fetchNearbyCareAssistants,
  fetchNearbySoloDrivers,
  fetchNearbyTransportPartners,
  fetchNearbyHospitals,
  adminAssignSoloDriver,
  adminAssignTransportPartner,
  adminAssignCareAssistant,
  adminAssignHospital,
  adminReassignCareAssistant,
  fetchAdminBookingById,
  selectNearbyDrivers,
  selectNearbyCareAssistants,
  selectNearbyTPs,
  selectNearbyHospitals,
  selectNearbyLoading,
  selectAdminAssignLoading,
} from '@/store/slices/operationsSlice';
import {
  TYPE_ASSIGN_TABS, statusBadge, currency, Spinner,
  SectionHeader, CallButton, FieldNote, getDriverAssignmentState,
} from './shared';

// ── Assign tab layout ─────────────────────────────────────────────────────────
const ASSIGN_TAB_META = {
  driver:   { label: 'Solo Driver', icon: Car      },
  tp:       { label: 'Transport Partner', icon: Truck  },
  care:     { label: 'Care Asst.', icon: UserCheck  },
  hospital: { label: 'Hospital',   icon: Hospital   },
};

// ── Solo driver results ───────────────────────────────────────────────────────
function SoloDriverResults({ results, bookingId, dispatch, alreadyAssigned }) {
  const [assigning, setAssigning] = useState(null);
  const [done,      setDone]      = useState(null);
  const [reason,    setReason]    = useState('');

  const assign = async (soloDriverPartnerId) => {
    setAssigning(soloDriverPartnerId);
    try {
      // adminReassignDriver does not exist in the slice, 
      // fallback to the standard assignment thunk which handles the backend logic
      await dispatch(adminAssignSoloDriver({ bookingId, soloDriverPartnerId })).unwrap();
      
      setDone(soloDriverPartnerId);
      setTimeout(() => setDone(null), 2500);
      dispatch(fetchAdminBookingById({ bookingId }));
    } catch {}
    setAssigning(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {alreadyAssigned && (
        <input
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for reassignment…"
          className="input-field text-xs"
        />
      )}
      {results.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-4">No solo drivers nearby</p>
      ) : results.map(d => (
        <div key={d.soloPartnerId} className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-bold text-base-content m-0 truncate">{d.name}</p>
              {d.rating > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-warning">
                  <Star size={8} fill="currentColor" /> {d.rating?.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-base-content/50">
              <span><MapPin size={8} className="inline mr-0.5" />{d.distanceKm} km</span>
              {d.vehicle && <span>{d.vehicle.registrationNumber} · {d.vehicle.vehicleType}</span>}
              {d.isDispatchReady && <span className="text-success font-bold">Ready</span>}
            </div>
            {d.matchedZone && (
              <p className="text-[10px] text-base-content/35 m-0 mt-0.5">Zone: {d.matchedZone.city}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {d.phone && <CallButton phone={d.phone} label="" size="xs" />}
            <button
              onClick={() => assign(d.soloPartnerId)}
              disabled={!!assigning}
              className={`btn btn-xs gap-1 ${done === d.soloPartnerId ? 'btn-success' : 'btn-primary'}`}
            >
              {assigning === d.soloPartnerId ? <Spinner size={10} /> : done === d.soloPartnerId ? <Check size={10} /> : <ChevronRight size={10} />}
              {done === d.soloPartnerId ? 'Assigned' : alreadyAssigned ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── TP results ────────────────────────────────────────────────────────────────
function TpResults({ results, bookingId, dispatch }) {
  const [assigning, setAssigning] = useState(null);
  const [done,      setDone]      = useState(null);

  const assign = async (transportPartnerId) => {
    setAssigning(transportPartnerId);
    try {
      await dispatch(adminAssignTransportPartner({ bookingId, transportPartnerId })).unwrap();
      setDone(transportPartnerId);
      setTimeout(() => setDone(null), 2500);
      dispatch(fetchAdminBookingById({ bookingId }));
    } catch {}
    setAssigning(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <FieldNote text="TP then assigns their own driver from their fleet" />
      {results.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-4">No transport partners nearby</p>
      ) : results.map(tp => (
        <div key={tp.tpId} className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-base-content m-0 truncate">{tp.businessName}</p>
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-base-content/50 mt-0.5">
              <span>{tp.availableDriversNearby} drivers near</span>
              <span>{tp.activeVehicles} vehicles</span>
              {tp.isDispatchReady && <span className="text-success font-bold">Dispatch ready</span>}
            </div>
            {tp.distanceKm != null && (
              <p className="text-[10px] text-base-content/35 m-0 mt-0.5"><MapPin size={8} className="inline mr-0.5" />{tp.distanceKm} km</p>
            )}
            {tp.matchedZone && (
              <p className="text-[10px] text-base-content/30 m-0">Zone: {tp.matchedZone.city}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {tp.ownerPhone && <CallButton phone={tp.ownerPhone} label="" size="xs" />}
            <button
              onClick={() => assign(tp.tpId)}
              disabled={!!assigning}
              className={`btn btn-xs gap-1 ${done === tp.tpId ? 'btn-success' : 'btn-primary'}`}
            >
              {assigning === tp.tpId ? <Spinner size={10} /> : done === tp.tpId ? <Check size={10} /> : <ChevronRight size={10} />}
              {done === tp.tpId ? 'Assigned' : 'Assign TP'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Care assistant results ────────────────────────────────────────────────────
function CareResults({ results, bookingId, dispatch, alreadyAssigned }) {
  const [assigning, setAssigning] = useState(null);
  const [done,      setDone]      = useState(null);

  const assign = async (careAssistantId) => {
    setAssigning(careAssistantId);
    try {
      if (alreadyAssigned) {
        await dispatch(adminReassignCareAssistant({ bookingId, newCareAssistantId: careAssistantId })).unwrap();
      } else {
        await dispatch(adminAssignCareAssistant({ bookingId, careAssistantId })).unwrap();
      }
      setDone(careAssistantId);
      setTimeout(() => setDone(null), 2500);
      dispatch(fetchAdminBookingById({ bookingId }));
    } catch {}
    setAssigning(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {results.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-4">No care assistants nearby</p>
      ) : results.map(ca => (
        <div key={ca.careAssistantId} className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs font-bold text-base-content m-0 truncate">{ca.name}</p>
              {ca.rating > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-warning">
                  <Star size={8} fill="currentColor" /> {ca.rating?.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-base-content/50">
              <span><MapPin size={8} className="inline mr-0.5" />{ca.distanceKm} km</span>
              {ca.specializations?.length > 0 && <span>{ca.specializations.slice(0,2).join(', ')}</span>}
            </div>
            {ca.currentCity && (
              <p className="text-[10px] text-base-content/35 m-0 mt-0.5">City: {ca.currentCity}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {ca.phone && <CallButton phone={ca.phone} label="" size="xs" />}
            <button
              onClick={() => assign(ca.careAssistantId)}
              disabled={!!assigning}
              className={`btn btn-xs gap-1 ${done === ca.careAssistantId ? 'btn-success' : 'btn-primary'}`}
            >
              {assigning === ca.careAssistantId ? <Spinner size={10} /> : done === ca.careAssistantId ? <Check size={10} /> : <ChevronRight size={10} />}
              {done === ca.careAssistantId ? 'Assigned' : alreadyAssigned ? 'Reassign' : 'Assign'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hospital results ──────────────────────────────────────────────────────────
function HospitalResults({ results, bookingId, dispatch }) {
  const [assigning, setAssigning] = useState(null);
  const [done,      setDone]      = useState(null);

  const assign = async (hospitalId) => {
    setAssigning(hospitalId);
    try {
      await dispatch(adminAssignHospital({ bookingId, hospitalId })).unwrap();
      setDone(hospitalId);
      setTimeout(() => setDone(null), 2500);
      dispatch(fetchAdminBookingById({ bookingId }));
    } catch {}
    setAssigning(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {results.length === 0 ? (
        <p className="text-xs text-base-content/40 text-center py-4">No hospitals nearby</p>
      ) : results.map(h => (
        <div key={h.hospitalId} className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-base-content m-0 truncate">{h.name}</p>
            <div className="flex items-center gap-2 flex-wrap text-[10px] text-base-content/50 mt-0.5">
              <span><MapPin size={8} className="inline mr-0.5" />{h.distanceKm} km</span>
              {h.hospitalType && <span>{h.hospitalType}</span>}
              {h.is24x7 && <span className="text-success font-bold">24x7</span>}
              {h.isEmergencyReady && <span className="text-warning font-bold">Emergency</span>}
            </div>
            {h.specialties?.length > 0 && (
              <p className="text-[10px] text-base-content/35 m-0 mt-0.5">{h.specialties.slice(0,3).join(', ')}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {h.phone && <CallButton phone={h.phone} label="" size="xs" />}
            <button
              onClick={() => assign(h.hospitalId)}
              disabled={!!assigning}
              className={`btn btn-xs gap-1 ${done === h.hospitalId ? 'btn-success' : 'btn-primary'}`}
            >
              {assigning === h.hospitalId ? <Spinner size={10} /> : done === h.hospitalId ? <Check size={10} /> : <ChevronRight size={10} />}
              {done === h.hospitalId ? 'Linked' : 'Link Hospital'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main NearbyAssignPanel ────────────────────────────────────────────────────
export function NearbyAssignPanel({ booking, dispatch }) {
  const nearbyDrivers = useSelector(selectNearbyDrivers);
  const nearbyCA      = useSelector(selectNearbyCareAssistants);
  const nearbyTPs     = useSelector(selectNearbyTPs);
  const nearbyHosps   = useSelector(selectNearbyHospitals);
  const nearbyLoading = useSelector(selectNearbyLoading);
  const assignLoading = useSelector(selectAdminAssignLoading);

  const allowedTabs  = TYPE_ASSIGN_TABS[booking.bookingType] ?? [];
  const [tab, setTab] = useState(allowedTabs[0] ?? 'driver');

  const driverState   = getDriverAssignmentState(booking);
  const hasDriver     = driverState.state === 'assigned';
  const hasCa         = !!booking.careAssistant;
  const hasHosp       = !!booking.hospital;

  const fetchNearby = useCallback(() => {
    const id = booking._id;
    if (tab === 'driver')   dispatch(fetchNearbySoloDrivers({ bookingId: id }));
    if (tab === 'tp')       dispatch(fetchNearbyTransportPartners({ bookingId: id }));
    if (tab === 'care')     dispatch(fetchNearbyCareAssistants({ bookingId: id }));
    if (tab === 'hospital') dispatch(fetchNearbyHospitals({ bookingId: id }));
  }, [tab, booking._id, dispatch]);

  if (allowedTabs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-base-content/40">
        <UserCheck size={24} strokeWidth={1} />
        <p className="text-xs m-0">No partner assignment for this booking type</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sub-tabs */}
      <div className="flex gap-1 flex-wrap">
        {allowedTabs.map(t => {
          const meta = ASSIGN_TAB_META[t];
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`btn btn-xs gap-1.5 ${tab === t ? 'btn-primary' : 'bg-base-300 text-base-content'}`}
            >
              <Icon size={9} /> {meta.label}
            </button>
          );
        })}
      </div>

      {/* Already assigned badge */}
      {tab === 'driver'   && hasDriver && (
        <div className="flex items-center gap-1.5 text-[11px] text-warning bg-warning/10 border border-warning/30 rounded-lg px-3 py-1.5">
          <AlertTriangle size={10} /> Driver already assigned. Search to reassign.
        </div>
      )}
      {tab === 'care'     && hasCa && (
        <div className="flex items-center gap-1.5 text-[11px] text-info bg-info/10 border border-info/30 rounded-lg px-3 py-1.5">
          <AlertTriangle size={10} /> Care assistant assigned. Reassign below.
        </div>
      )}
      {tab === 'hospital' && hasHosp && (
        <div className="flex items-center gap-1.5 text-[11px] text-success bg-success/10 border border-success/30 rounded-lg px-3 py-1.5">
          Hospital already linked. Reassign below.
        </div>
      )}

      {/* Search button */}
      <button
        onClick={fetchNearby}
        disabled={nearbyLoading}
        className="btn btn-sm btn-outline gap-1.5 self-start"
      >
        {nearbyLoading ? <Spinner size={12} /> : <RefreshCw size={11} />}
        Search Nearby
      </button>

      {/* Results */}
      {tab === 'driver' && (
        <SoloDriverResults
          results={nearbyDrivers}
          bookingId={booking._id}
          dispatch={dispatch}
          alreadyAssigned={hasDriver}
        />
      )}
      {tab === 'tp' && (
        <TpResults
          results={nearbyTPs}
          bookingId={booking._id}
          dispatch={dispatch}
        />
      )}
      {tab === 'care' && (
        <CareResults
          results={nearbyCA}
          bookingId={booking._id}
          dispatch={dispatch}
          alreadyAssigned={hasCa}
        />
      )}
      {tab === 'hospital' && (
        <HospitalResults
          results={nearbyHosps}
          bookingId={booking._id}
          dispatch={dispatch}
        />
      )}

      {assignLoading && (
        <div className="flex items-center gap-2 text-xs text-base-content/50 py-2">
          <Spinner size={12} /> Assigning…
        </div>
      )}
    </div>
  );
}