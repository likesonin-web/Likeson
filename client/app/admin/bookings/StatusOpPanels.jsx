'use client';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Edit2, Stethoscope, ChevronDown, Check, MapPin } from 'lucide-react';
import {
  updateAdminBookingStatus,
  updateAdminOpStatus,
  adminChangeDestination,
  fetchAdminDestinationAudit,
  fetchAdminBookingById,
  selectAdminOpRecord,
  selectAdminOpStatusUpdate,
  selectAdminBookingDetail,
} from '@/store/slices/operationsSlice';
import {
  BOOKING_STATUSES, OP_STATUSES,
  STATUS_NOTE_OPTIONS, OP_NOTE_OPTIONS,
  statusBadge, currency, fmtDate, Spinner, SectionHeader, FieldNote,
} from './shared';

// ── Status update panel ──────────────────────────────────────────────────────
export function StatusPanel({ booking, dispatch }) {
  const [status,  setStatus]  = useState(booking.status ?? '');
  const [note,    setNote]    = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const noteOptions = STATUS_NOTE_OPTIONS[status] ?? [];

  const handle = async () => {
    if (!status || status === booking.status) return;
    setLoading(true);
    try {
      await dispatch(updateAdminBookingStatus({ bookingId: booking._id, status, note })).unwrap();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      dispatch(fetchAdminBookingById({ bookingId: booking._id }));
    } catch {}
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {statusBadge(booking.status)}
        <ChevronDown size={11} className="text-base-content/40" />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setNote(''); }}
          className="input-field text-xs flex-1"
        >
          <option value="">Select new status…</option>
          {BOOKING_STATUSES.filter(s => s !== booking.status).map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {status && (
        <>
          {noteOptions.length > 0 && (
            <select
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="input-field text-xs"
            >
              <option value="">Pick reason or type below…</option>
              {noteOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add note (optional but recommended)…"
            rows={2}
            className="input-field text-xs resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handle}
              disabled={loading || status === booking.status}
              className="btn btn-primary btn-sm gap-1"
            >
              {loading ? <Spinner size={12} /> : done ? <Check size={12} /> : <Edit2 size={11} />}
              {done ? 'Updated' : 'Update Status'}
            </button>
            <FieldNote text="Triggers email + socket notification to partners" />
          </div>
        </>
      )}
    </div>
  );
}

// ── Destination change panel ─────────────────────────────────────────────────
export function DestinationChangePanel({ booking, dispatch }) {
  const [lat,     setLat]     = useState('');
  const [lng,     setLng]     = useState('');
  const [address, setAddress] = useState('');
  const [city,    setCity]    = useState('');
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [audit,   setAudit]   = useState(null);
  const [showAudit, setShowAudit] = useState(false);

  const handleChange = async () => {
    if (!lat || !lng || !reason) return;
    setLoading(true);
    try {
      await dispatch(adminChangeDestination({
        bookingId: booking._id,
        newDestination: { coordinates: [parseFloat(lng), parseFloat(lat)], address, city },
        reason,
      })).unwrap();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      dispatch(fetchAdminBookingById({ bookingId: booking._id }));
    } catch {}
    setLoading(false);
  };

  const loadAudit = async () => {
    const res = await dispatch(fetchAdminDestinationAudit({ bookingId: booking._id })).unwrap();
    setAudit(res?.audits ?? []);
    setShowAudit(true);
  };

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-base-300/60 mt-3">
      <SectionHeader title="Change Destination" sub="Recalculates route + creates new RouteVersion" />
      <FieldNote text="Only allowed after driver accepted (destinationLockedAt set)" />

      <div className="grid grid-cols-2 gap-2">
        <input value={lat}     onChange={e => setLat(e.target.value)}     placeholder="Lat" type="number" step="any" className="input-field text-xs" />
        <input value={lng}     onChange={e => setLng(e.target.value)}     placeholder="Lng" type="number" step="any" className="input-field text-xs" />
        <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Address" className="input-field text-xs col-span-2" />
        <input value={city}    onChange={e => setCity(e.target.value)}    placeholder="City" className="input-field text-xs" />
        <input value={reason}  onChange={e => setReason(e.target.value)}  placeholder="Reason (required)" className="input-field text-xs" />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={handleChange} disabled={loading || !lat || !lng || !reason} className="btn btn-warning btn-sm gap-1">
          {loading ? <Spinner size={12} /> : done ? <Check size={12} /> : <MapPin size={11} />}
          {done ? 'Changed' : 'Change Destination'}
        </button>
        <button onClick={loadAudit} className="btn btn-ghost btn-sm text-xs">View Audit Trail</button>
      </div>

      {showAudit && audit && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3 max-h-48 overflow-y-auto scrollbar-thin">
          <SectionHeader title={`Destination Changes (${audit.length})`} />
          {audit.length === 0 ? (
            <p className="text-xs text-base-content/40">No changes yet</p>
          ) : audit.map((a, i) => (
            <div key={a._id ?? i} className="text-[11px] border-b border-base-300/60 last:border-0 py-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-base-content/70">{a.newDestination?.address || JSON.stringify(a.newDestination?.coordinates)}</span>
                <span className="text-base-content/40">{fmtDate(a.changedAt)}</span>
              </div>
              <p className="text-base-content/45 m-0 mt-0.5">{a.reason}</p>
              <p className="text-base-content/30 m-0">By: {a.changedBy?.name ?? 'Admin'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── OP record panel ──────────────────────────────────────────────────────────
export function OpPanel({ booking, dispatch }) {
  const op      = useSelector(selectAdminOpRecord);
  const [status,  setStatus]  = useState('');
  const [notes,   setNotes]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const noteOptions = OP_NOTE_OPTIONS[status] ?? [];

  const handleUpdate = async () => {
    if (!op?._id || !status) return;
    setLoading(true);
    try {
      await dispatch(updateAdminOpStatus({ opId: op._id, status, doctorNotes: notes || undefined })).unwrap();
      setDone(true);
      setTimeout(() => setDone(false), 2500);
      dispatch(fetchAdminBookingById({ bookingId: booking._id }));
    } catch {}
    setLoading(false);
  };

  if (!op) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-base-content/40">
        <Stethoscope size={24} strokeWidth={1} />
        <p className="text-xs m-0">No OP record linked to this booking yet</p>
        <FieldNote text="OP created automatically on booking confirmation when doctor assigned" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-base-300 bg-base-200 p-3">
        <SectionHeader title="OP Record" />
        <div className="grid grid-cols-2 gap-y-1 text-xs">
          <span className="text-base-content/45">OP Number</span>
          <span className="font-mono font-bold text-primary">{op.opNumber ?? '—'}</span>
          <span className="text-base-content/45">Status</span>
          {statusBadge(op.status)}
          <span className="text-base-content/45">Scheduled</span>
          <span>{fmtDate(op.scheduledAt)}</span>
          <span className="text-base-content/45">Consultation</span>
          <span>{op.consultationType ?? '—'}</span>
          <span className="text-base-content/45">Follow-up</span>
          <span>{op.isFollowUp ? 'Yes' : 'No'}</span>
          {op.followUpExpiry && (
            <>
              <span className="text-base-content/45">FU Expiry</span>
              <span>{fmtDate(op.followUpExpiry)}</span>
            </>
          )}
          {op.followUpFee != null && (
            <>
              <span className="text-base-content/45">FU Fee</span>
              <span className="text-success font-bold">{currency(op.followUpFee)}</span>
            </>
          )}
          {op.diagnosisCode && (
            <>
              <span className="text-base-content/45">Diagnosis</span>
              <span className="font-mono text-xs">{op.diagnosisCode}</span>
            </>
          )}
          {op.reasonForVisit && (
            <>
              <span className="text-base-content/45">Reason</span>
              <span className="text-base-content/70">{op.reasonForVisit}</span>
            </>
          )}
        </div>

        {op.doctorNotes && (
          <div className="mt-2 p-2 rounded-lg bg-base-300/40">
            <p className="text-[10px] font-bold text-base-content/45 uppercase tracking-widest mb-1">Doctor Notes</p>
            <p className="text-xs text-base-content/70 m-0">{op.doctorNotes}</p>
          </div>
        )}
      </div>

      {/* Update OP status */}
      <div className="flex flex-col gap-2">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setNotes(''); }} className="input-field text-xs">
          <option value="">Update OP status…</option>
          {OP_STATUSES.filter(s => s !== op.status).map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        {status && (
          <>
            {noteOptions.length > 0 && (
              <select value={notes} onChange={e => setNotes(e.target.value)} className="input-field text-xs">
                <option value="">Pick note or type below…</option>
                {noteOptions.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Doctor notes (optional)…" rows={2} className="input-field text-xs resize-none" />
            <button onClick={handleUpdate} disabled={loading} className="btn btn-primary btn-sm gap-1 self-start">
              {loading ? <Spinner size={12} /> : done ? <Check size={12} /> : <Stethoscope size={11} />}
              {done ? 'Updated' : 'Update OP'}
            </button>
          </>
        )}
      </div>

      <DestinationChangePanel booking={booking} dispatch={dispatch} />
    </div>
  );
}