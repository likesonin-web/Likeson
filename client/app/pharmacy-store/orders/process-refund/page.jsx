'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCcw, DollarSign, AlertTriangle, CheckCircle2,
  CreditCard, Wallet, Info, ShieldCheck, Percent
} from 'lucide-react';
import { processRefund, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

function ProcessRefundComponent({ order, onSuccess }) {
  const dispatch = useDispatch();
  const { loading, errors, success } = useSelector((s) => s.pharmacyStore);

  const maxAmount = order?.billing?.totalPayable ?? 0;
  const [amount, setAmount] = useState(maxAmount);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => { setAmount(maxAmount); }, [maxAmount]);

  useEffect(() => {
    if (success.refund) {
      dispatch(clearSuccess('refund'));
      onSuccess?.();
    }
  }, [success.refund, dispatch, onSuccess]);

  useEffect(() => () => { dispatch(clearError('refund')); }, [dispatch]);

  const percentOfTotal = maxAmount > 0 ? ((amount / maxAmount) * 100).toFixed(0) : 0;

  const handleSubmit = () => {
    if (!confirmed || amount <= 0) return;
    dispatch(processRefund({ orderId: order._id, amount: parseFloat(amount), reason: reason.trim() }));
  };

  const isValid = amount > 0 && amount <= maxAmount && confirmed;

  return (
    <div data-theme="pharmacy" className="space-y-5 p-1">
      {/* Payment summary */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-4 border"
        style={{ background: 'var(--base-200)', borderColor: 'var(--base-300)' }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
          Payment Details
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Order Total', value: `₹${maxAmount.toFixed(2)}`, icon: DollarSign },
            { label: 'Payment Method', value: order?.payment?.method ?? '—', icon: CreditCard },
            { label: 'Payment Status', value: order?.payment?.status ?? '—', icon: ShieldCheck },
            { label: 'Razorpay ID', value: order?.payment?.razorpayPaymentId ? `…${order.payment.razorpayPaymentId.slice(-8)}` : 'N/A', icon: ShieldCheck },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-2">
              <item.icon size={13} style={{ color: 'var(--primary)', marginTop: 1, flexShrink: 0 }} />
              <div>
                <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>{item.label}</p>
                <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* No Razorpay payment */}
      {!order?.payment?.razorpayPaymentId && (
        <div className="alert alert-warning text-sm">
          <AlertTriangle size={15} />
          <span>No Razorpay payment found. Refund can only be processed for online payments.</span>
        </div>
      )}

      {/* Amount input */}
      {order?.payment?.razorpayPaymentId && (
        <>
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
              Refund Amount
            </p>

            {/* Slider + Input */}
            <div className="space-y-2">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: 'var(--primary)' }}>₹</span>
                <input
                  type="number"
                  className="input-field w-full pl-8 text-lg font-bold"
                  style={{ color: 'var(--primary)' }}
                  min={0.01}
                  max={maxAmount}
                  step={0.01}
                  value={amount}
                  onChange={(e) => setAmount(Math.min(parseFloat(e.target.value) || 0, maxAmount))}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)', color: 'var(--primary)' }}>
                  {percentOfTotal}%
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={maxAmount}
                step={1}
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value))}
                className="w-full accent-primary"
                style={{ accentColor: 'var(--primary)' }}
              />

              <div className="flex justify-between text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                <span>₹0</span>
                <div className="flex gap-2">
                  {[25, 50, 75, 100].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setAmount(parseFloat(((maxAmount * pct) / 100).toFixed(2)))}
                      className="px-2 py-0.5 rounded text-xs font-bold border transition-all"
                      style={
                        parseFloat(((maxAmount * pct) / 100).toFixed(2)) === amount
                          ? { background: 'var(--primary)', color: 'var(--primary-content)', borderColor: 'var(--primary)' }
                          : { background: 'var(--base-200)', borderColor: 'var(--base-300)', color: 'var(--base-content)' }
                      }
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <span>₹{maxAmount.toFixed(2)}</span>
              </div>
            </div>

            {amount > maxAmount && (
              <p className="text-xs font-semibold" style={{ color: 'var(--error)' }}>Amount cannot exceed ₹{maxAmount.toFixed(2)}</p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--base-content)' }}>
              Refund Reason <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>(optional)</span>
            </label>
            <textarea
              className="input-field w-full text-sm resize-none"
              rows={3}
              placeholder="Reason for processing this refund…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Refund summary */}
          <div className="rounded-xl p-4 border" style={{ background: 'color-mix(in srgb, var(--success), transparent 92%)', borderColor: 'color-mix(in srgb, var(--success), transparent 65%)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>Refund Summary</p>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>Refund Amount</span>
                <span className="font-bold" style={{ color: 'var(--success)' }}>₹{amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>Destination</span>
                <span className="font-bold" style={{ color: 'var(--base-content)' }}>Original Payment Source</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'color-mix(in oklch, var(--base-content) 65%, transparent)' }}>Processing Time</span>
                <span className="font-bold" style={{ color: 'var(--base-content)' }}>5–7 Business Days</span>
              </div>
            </div>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded"
              style={{ accentColor: 'var(--primary)' }}
            />
            <span className="text-xs" style={{ color: 'var(--base-content)' }}>
              I confirm that a refund of <strong>₹{amount.toFixed(2)}</strong> should be processed to the customer's original payment source. This action is <strong>irreversible</strong>.
            </span>
          </label>

          {/* Error */}
          {errors.refund && (
            <div className="alert alert-error text-sm">
              <AlertTriangle size={15} />
              <span>{errors.refund.message}</span>
            </div>
          )}

          {/* Submit */}
          <motion.button
            whileHover={{ scale: isValid ? 1.02 : 1 }} whileTap={{ scale: isValid ? 0.98 : 1 }}
            disabled={!isValid || loading.refund}
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'var(--success)', color: 'var(--success-content)' }}
          >
            {loading.refund ? (
              <><div className="spinner w-4 h-4" style={{ borderTopColor: 'white' }} /> Processing Refund…</>
            ) : (
              <><RefreshCcw size={16} /> Process Refund ₹{amount.toFixed(2)}</>
            )}
          </motion.button>
        </>
      )}
    </div>
  );
}

export default function ProcessRefundPage() {
  return <ProcessRefundComponent order={null} onSuccess={() => {}} />;
}