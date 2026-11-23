'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw, User, Calendar, AlertTriangle, CheckCircle2,
  Package, Camera, Play, Image, Info, Clock
} from 'lucide-react';
import { acceptReturn, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

function AcceptReturnComponent({ order, onSuccess }) {
  const dispatch = useDispatch();
  const { loading, errors, success } = useSelector((s) => s.pharmacyStore);

  const [pickupPartner, setPickupPartner] = useState('');
  const [pickupEstimatedAt, setPickupEstimatedAt] = useState('');

  useEffect(() => {
    if (success.returnAccept) {
      dispatch(clearSuccess('returnAccept'));
      onSuccess?.();
    }
  }, [success.returnAccept, dispatch, onSuccess]);

  useEffect(() => () => { dispatch(clearError('returnAccept')); }, [dispatch]);

  const handleSubmit = () => {
    if (!pickupPartner.trim()) return;
    dispatch(acceptReturn({
      orderId: order._id,
      pickupPartner,
      ...(pickupEstimatedAt && { pickupEstimatedAt }),
    }));
  };

  const returnEvidence = order?.cancellation?.returnEvidence ?? [];
  const returnReason = order?.cancellation?.returnReason ?? '';

  return (
    <div data-theme="pharmacy" className="space-y-5 p-1">
      {/* Return info */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-4 border"
        style={{ background: 'color-mix(in srgb, var(--warning), transparent 90%)', borderColor: 'color-mix(in srgb, var(--warning), transparent 65%)' }}
      >
        <div className="flex items-start gap-3">
          <RotateCcw size={20} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>Return Request</p>
            <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
              Order #{order?.orderId} · {order?.items?.length ?? 0} items · ₹{order?.billing?.totalPayable?.toFixed(2)}
            </p>
            {returnReason && (
              <div className="mt-2 flex items-start gap-1.5">
                <Info size={11} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
                <p className="text-xs" style={{ color: 'var(--base-content)' }}>
                  <span className="font-semibold">Reason: </span>{returnReason}
                </p>
              </div>
            )}
            {order?.cancellation?.returnRequestedAt && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                <Clock size={10} />
                Requested: {new Date(order.cancellation.returnRequestedAt).toLocaleString('en-IN')}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Return evidence */}
      {returnEvidence.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
            <Camera size={12} /> Customer Evidence ({returnEvidence.length})
          </p>
          <div className="grid grid-cols-3 gap-2">
            {returnEvidence.map((ev, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden border aspect-square" style={{ borderColor: 'var(--base-300)' }}>
                {ev.mediaType === 'image' ? (
                  <img src={ev.url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: 'var(--base-200)' }}>
                    <Play size={20} style={{ color: 'var(--base-content)' }} />
                    <span className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>Video</span>
                  </div>
                )}
                <div className="absolute top-1 right-1 p-1 rounded" style={{ background: 'rgba(0,0,0,0.6)' }}>
                  {ev.mediaType === 'image' ? <Image size={9} style={{ color: 'white' }} /> : <Play size={9} style={{ color: 'white' }} />}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            Review customer-submitted evidence before accepting the return
          </p>
        </div>
      )}

      {/* Items being returned */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
          Items in Return
        </p>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
          {(order?.items ?? []).map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'var(--base-200)' }}>
              <Package size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--base-content)' }}>{item.name}</p>
                <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Qty: {item.quantity}</p>
              </div>
              <p className="text-xs font-bold" style={{ color: 'var(--base-content)' }}>₹{item.totalPrice?.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pickup assignment */}
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
          Assign Pickup
        </p>
        <div>
          <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--base-content)' }}>
            Pickup Partner ID <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <div className="relative">
            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
            <input
              className="input-field w-full pl-9 text-sm"
              placeholder="Enter pickup partner ID…"
              value={pickupPartner}
              onChange={(e) => setPickupPartner(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5" style={{ color: 'var(--base-content)' }}>
            <Calendar size={12} /> Estimated Pickup Time <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>(optional)</span>
          </label>
          <input
            type="datetime-local"
            className="input-field w-full text-sm"
            value={pickupEstimatedAt}
            onChange={(e) => setPickupEstimatedAt(e.target.value)}
          />
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--info), transparent 90%)', borderLeft: '3px solid var(--info)' }}>
        <Info size={14} style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }} />
        <p className="text-xs" style={{ color: 'var(--base-content)' }}>
          Accepting the return will move the order to <strong>Return_Accepted</strong> status and notify the customer. A pickup partner will be dispatched.
        </p>
      </div>

      {/* Error */}
      {errors.returnAccept && (
        <div className="alert alert-error text-sm">
          <AlertTriangle size={15} />
          <span>{errors.returnAccept.message}</span>
        </div>
      )}

      {/* Submit */}
      <motion.button
        whileHover={{ scale: pickupPartner ? 1.02 : 1 }} whileTap={{ scale: pickupPartner ? 0.98 : 1 }}
        disabled={!pickupPartner.trim() || loading.returnAccept}
        onClick={handleSubmit}
        className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ background: 'var(--success)', color: 'var(--success-content)' }}
      >
        {loading.returnAccept ? (
          <><div className="spinner w-4 h-4" style={{ borderTopColor: 'white' }} /> Processing…</>
        ) : (
          <><CheckCircle2 size={16} /> Accept Return Request</>
        )}
      </motion.button>
    </div>
  );
}

export default function AcceptReturnPage() {
  return <AcceptReturnComponent order={null} onSuccess={() => {}} />;
}