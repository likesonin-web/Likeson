'use client';
import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Wallet, Heart, MapPin, Users, Truck, Check, RefreshCw, QrCode } from 'lucide-react';
import {
  adminProcessRefund,
  adminRequestCareRide,
  fetchAdminCareRideNearby,
  fetchAdminBookingById,
  selectAdminRefund,
  selectAdminRefundLoading,
  selectCareRideNearby,
} from '@/store/slices/operationsSlice';
import {
  REFUND_REASONS, currency, fmtDate, statusBadge,
  Spinner, SectionHeader, FieldNote, CallButton,
} from './shared';

// ── Refund panel ──────────────────────────────────────────────────────────────
export function RefundPanel({ booking, dispatch }) {
  const loading     = useSelector(selectAdminRefundLoading);
  const refundResult= useSelector(selectAdminRefund);
  const [amount,  setAmount]  = useState('');
  const [reason,  setReason]  = useState('');
  const [done,    setDone]    = useState(false);

  const paid        = booking.fareBreakdown?.amountPaid ?? 0;
  const alreadyRefunded = booking.fareBreakdown?.refundAmount ?? 0;
  const maxRefund   = Math.max(0, paid - alreadyRefunded);

  const handleRefund = async () => {
    if (!reason) return;
    const refundAmount = amount ? parseFloat(amount) : undefined;
    try {
      await dispatch(adminProcessRefund({ bookingId: booking._id, refundAmount, reason })).unwrap();
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      dispatch(fetchAdminBookingById({ bookingId: booking._id }));
    } catch {}
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-base-300 bg-base-200 p-3">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">Total</p>
          <p className="text-sm font-bold text-base-content m-0">{currency(booking.fareBreakdown?.totalAmount)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">Paid</p>
          <p className="text-sm font-bold text-success m-0">{currency(paid)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">Refunded</p>
          <p className="text-sm font-bold text-error m-0">{currency(alreadyRefunded)}</p>
        </div>
      </div>

      {maxRefund <= 0 ? (
        <div className="flex items-center gap-2 text-xs text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
          <Check size={12} /> Full amount already refunded
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <FieldNote text={`Max refundable: ${currency(maxRefund)}`} />

          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Amount (blank = full ${currency(maxRefund)})`}
            max={maxRefund}
            min={1}
            className="input-field text-xs"
          />

          <select value={reason} onChange={e => setReason(e.target.value)} className="input-field text-xs">
            <option value="">Select reason (required)…</option>
            {REFUND_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Or type reason directly…"
            rows={2}
            className="input-field text-xs resize-none"
          />

          <button
            onClick={handleRefund}
            disabled={loading || !reason}
            className={`btn btn-sm gap-1.5 self-start ${done ? 'btn-success' : 'btn-error'}`}
          >
            {loading ? <Spinner size={12} /> : done ? <Check size={12} /> : <Wallet size={11} />}
            {done ? 'Refund Initiated' : 'Process Refund'}
          </button>
          <FieldNote text="Razorpay refund or wallet credit. Status email sent to patient." />
        </div>
      )}

      {/* Payment details */}
      {(booking.payments?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3 mt-2">
          <SectionHeader title="Payment History" />
          {booking.payments.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-base-300/60 last:border-0">
              <div>
                <span className="font-bold text-base-content/70">{p.gateway}</span>
                {p.transactionId && <span className="text-base-content/35 ml-1 font-mono text-[9px]">{p.transactionId.slice(-8)}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-success font-bold">{currency(p.amount)}</span>
                {statusBadge(p.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Care ride panel ───────────────────────────────────────────────────────────
export function CareRidePanel({ booking, dispatch }) {
  const nearby   = useSelector(selectCareRideNearby);
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [requesterType, setRequesterType] = useState('care_assistant');
  const [pickupLat,  setPickupLat]   = useState(booking.patientLocation?.coordinates?.[1] ?? '');
  const [pickupLng,  setPickupLng]   = useState(booking.patientLocation?.coordinates?.[0] ?? '');
  const [pickupAddr, setPickupAddr]  = useState(booking.patientLocation?.address ?? '');
  const [destLat,   setDestLat]     = useState(booking.destinationLocation?.coordinates?.[1] ?? '');
  const [destLng,   setDestLng]     = useState(booking.destinationLocation?.coordinates?.[0] ?? '');
  const [destAddr,  setDestAddr]    = useState(booking.destinationLocation?.address ?? '');

  const loadNearby = () => dispatch(fetchAdminCareRideNearby({ bookingId: booking._id }));

  const handleCreate = async () => {
    if (!pickupLat || !pickupLng || !destLat || !destLng) return;
    setLoading(true);
    try {
      await dispatch(adminRequestCareRide({
        bookingId:     booking._id,
        customerId:    booking.customer?._id ?? booking.customer,
        requesterType,
        careAssistantId: booking.careAssistant?._id ?? booking.careAssistant ?? undefined,
        pickupLocation:      { coordinates: [parseFloat(pickupLng), parseFloat(pickupLat)], address: pickupAddr },
        destinationLocation: { coordinates: [parseFloat(destLng),   parseFloat(destLat)],   address: destAddr   },
      })).unwrap();
      setDone(true);
      setTimeout(() => setDone(false), 3000);
      dispatch(fetchAdminBookingById({ bookingId: booking._id }));
    } catch {}
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <FieldNote text="Creates a Ride record linked to booking. Then assign a driver from Assign tab." />

      {/* Requester type */}
      <div className="flex gap-2">
        {['care_assistant', 'customer'].map(t => (
          <button
            key={t}
            onClick={() => setRequesterType(t)}
            className={`btn btn-xs ${requesterType === t ? 'btn-primary' : 'bg-base-300 text-base-content'}`}
          >
            {t === 'care_assistant' ? 'CA Requested' : 'Patient Requested'}
          </button>
        ))}
      </div>

      {/* Location inputs */}
      <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/45 m-0">Pickup Location</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={pickupLat}  onChange={e => setPickupLat(e.target.value)}  placeholder="Lat" type="number" step="any" className="input-field text-xs" />
          <input value={pickupLng}  onChange={e => setPickupLng(e.target.value)}  placeholder="Lng" type="number" step="any" className="input-field text-xs" />
        </div>
        <input value={pickupAddr} onChange={e => setPickupAddr(e.target.value)} placeholder="Address" className="input-field text-xs" />
      </div>

      <div className="rounded-xl border border-base-300 bg-base-200 p-3 flex flex-col gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/45 m-0">Destination</p>
        <div className="grid grid-cols-2 gap-2">
          <input value={destLat}   onChange={e => setDestLat(e.target.value)}   placeholder="Lat" type="number" step="any" className="input-field text-xs" />
          <input value={destLng}   onChange={e => setDestLng(e.target.value)}   placeholder="Lng" type="number" step="any" className="input-field text-xs" />
        </div>
        <input value={destAddr}  onChange={e => setDestAddr(e.target.value)}  placeholder="Address" className="input-field text-xs" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={handleCreate} disabled={loading || !pickupLat || !pickupLng || !destLat || !destLng} className={`btn btn-sm gap-1.5 ${done ? 'btn-success' : 'btn-primary'}`}>
          {loading ? <Spinner size={12} /> : done ? <Check size={12} /> : <Heart size={11} />}
          {done ? 'Care Ride Created' : 'Create Care Ride'}
        </button>
        <button onClick={loadNearby} className="btn btn-ghost btn-sm gap-1.5">
          <RefreshCw size={11} /> Check Nearby
        </button>
      </div>

      {/* Nearby results summary */}
      {nearby && (
        <div className="rounded-xl border border-base-300 bg-base-200 p-3">
          <SectionHeader title="Nearby for Care Ride" sub={`${(nearby.nearbyDrivers?.length ?? 0)} drivers · ${(nearby.nearbyTPs?.length ?? 0)} TPs`} />
          {nearby.ratePerKm && (
            <p className="text-[11px] text-base-content/50 mb-2">Rate: ₹{nearby.ratePerKm}/km ({nearby.rateSource})</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-bold text-base-content/40 mb-1">Solo Drivers</p>
              {(nearby.soloDrivers ?? nearby.nearbyDrivers ?? []).slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] border-b border-base-300/60 last:border-0 py-1">
                  <span className="text-base-content/60 truncate">{d.name ?? d.legalName}</span>
                  <span className="text-base-content/35 shrink-0 ml-2">{d.distanceKm} km</span>
                </div>
              ))}
              {(nearby.soloDrivers ?? nearby.nearbyDrivers ?? []).length === 0 && (
                <p className="text-[10px] text-base-content/30">None found</p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold text-base-content/40 mb-1">Transport Partners</p>
              {(nearby.transportPartners ?? nearby.nearbyTPs ?? []).slice(0, 4).map((tp, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] border-b border-base-300/60 last:border-0 py-1">
                  <span className="text-base-content/60 truncate">{tp.businessName}</span>
                  <span className="text-base-content/35 shrink-0 ml-2">{tp.totalDrivers}d</span>
                </div>
              ))}
              {(nearby.transportPartners ?? nearby.nearbyTPs ?? []).length === 0 && (
                <p className="text-[10px] text-base-content/30">None found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pay at service panel (QR / cash) ─────────────────────────────────────────
export function PayAtServicePanel({ booking, dispatch }) {
  const [payLink,   setPayLink]   = useState(null);
  const [polling,   setPolling]   = useState(false);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashDone,  setCashDone]  = useState(false);
  const pollRef = useRef(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; setPolling(false); } };

  useEffect(() => () => stopPoll(), []);

  const generateLink = () => {
    // Placeholder — real implementation calls payment gateway API
    setPayLink({ url: `https://rzp.io/i/mock-${booking.bookingCode}`, expiresAt: new Date(Date.now() + 30*60*1000).toISOString() });
    setPolling(true);
    pollRef.current = setInterval(() => {
      dispatch(fetchAdminBookingById({ bookingId: booking._id }));
    }, 8000);
  };

  const markCash = async () => {
    setCashLoading(true);
    try {
      await dispatch(updateAdminBookingStatus({ bookingId: booking._id, status: 'completed', note: 'Cash collected at service point' })).unwrap();
      setCashDone(true);
      dispatch(fetchAdminBookingById({ bookingId: booking._id }));
    } catch {}
    setCashLoading(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionHeader title="Pay at Service" sub="Generate QR link or record cash" />

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-base-300 bg-base-200 p-3">
        <div>
          <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">Total</p>
          <p className="text-base font-bold text-base-content m-0">{currency(booking.fareBreakdown?.totalAmount)}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-widest text-base-content/40 m-0">Status</p>
          {statusBadge(booking.paymentStatus ?? 'unpaid')}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {!payLink ? (
          <button onClick={generateLink} className="btn btn-sm btn-primary gap-1.5">
            <QrCode size={11} /> Generate Payment Link
          </button>
        ) : (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-2 text-xs">
              <a href={payLink.url} target="_blank" rel="noreferrer" className="text-primary underline truncate">{payLink.url}</a>
              {polling && <Spinner size={12} className="text-base-content/40" />}
            </div>
            <p className="text-[10px] text-base-content/40 m-0">Expires: {fmtDate(payLink.expiresAt)}</p>
            <div className="flex gap-2">
              <button onClick={generateLink} className="btn btn-ghost btn-xs gap-1"><RefreshCw size={10} /> Regenerate</button>
              <button onClick={stopPoll} className="btn btn-ghost btn-xs text-error">Stop Polling</button>
            </div>
          </div>
        )}

        <button
          onClick={markCash}
          disabled={cashLoading || cashDone}
          className={`btn btn-sm gap-1.5 ${cashDone ? 'btn-success' : 'btn-outline'}`}
        >
          {cashLoading ? <Spinner size={12} /> : cashDone ? <Check size={12} /> : <Wallet size={11} />}
          {cashDone ? 'Cash Marked' : 'Mark Cash Collected'}
        </button>
      </div>

      <FieldNote text="QR polling auto-refreshes booking status every 8s. Manual mark sets status to completed." />
    </div>
  );
}