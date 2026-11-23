'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Clock, CheckCircle, Package, Truck,
  CheckCircle2, XCircle, RotateCcw, AlertTriangle,
  ChevronRight, Calendar, FileText
} from 'lucide-react';
import { updateOrderStatus, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

const STATUS_GRAPH = {
  Placed:             { next: ['Confirmed', 'Cancelled'],          label: 'Placed',             icon: Clock,         color: 'var(--info)' },
  Confirmed:          { next: ['Processing', 'Cancelled'],         label: 'Confirmed',           icon: CheckCircle,   color: 'var(--primary)' },
  Processing:         { next: ['Out-for-Delivery', 'Cancelled'],   label: 'Processing',          icon: Package,       color: 'var(--warning)' },
  'Out-for-Delivery': { next: ['Delivered', 'Cancelled'],          label: 'Out for Delivery',    icon: Truck,         color: 'var(--warning)' },
  Delivered:          { next: ['Return_Requested'],                label: 'Delivered',           icon: CheckCircle2,  color: 'var(--success)' },
  Return_Requested:   { next: ['Return_Accepted', 'Return_Rejected'], label: 'Return Requested', icon: RotateCcw,     color: 'var(--warning)' },
  Return_Accepted:    { next: ['Pickup_Assigned'],                 label: 'Return Accepted',     icon: RotateCcw,     color: 'var(--info)' },
  Pickup_Assigned:    { next: ['Pickup_Done'],                     label: 'Pickup Assigned',     icon: Truck,         color: 'var(--info)' },
  Pickup_Done:        { next: ['Returned'],                        label: 'Pickup Done',         icon: Package,       color: 'var(--success)' },
  Cancelled:          { next: [],                                  label: 'Cancelled',           icon: XCircle,       color: 'var(--error)' },
  Returned:           { next: [],                                  label: 'Returned',            icon: CheckCircle2,  color: 'var(--success)' },
};

const TIMELINE_ORDER = [
  'Placed', 'Confirmed', 'Processing', 'Out-for-Delivery', 'Delivered',
];

function UpdateStatusComponent({ order, onSuccess }) {
  const dispatch = useDispatch();
  const { loading, errors, success } = useSelector((s) => s.pharmacyStore);

  const currentStatus = order?.delivery?.status ?? 'Placed';
  const config = STATUS_GRAPH[currentStatus] ?? { next: [], label: currentStatus, icon: Clock, color: 'var(--base-content)' };

  const [selectedStatus, setSelectedStatus] = useState('');
  const [note, setNote] = useState('');
  const [estimatedArrival, setEstimatedArrival] = useState('');

  useEffect(() => {
    if (success.orderStatus) {
      dispatch(clearSuccess('orderStatus'));
      onSuccess?.();
    }
  }, [success.orderStatus, dispatch, onSuccess]);

  useEffect(() => () => { dispatch(clearError('orderStatus')); }, [dispatch]);

  const handleSubmit = () => {
    if (!selectedStatus) return;
    dispatch(updateOrderStatus({
      orderId: order._id,
      status: selectedStatus,
      ...(note.trim() && { note: note.trim() }),
      ...(estimatedArrival && selectedStatus === 'Out-for-Delivery' && { estimatedArrival }),
    }));
  };

  const CurrentIcon = config.icon;

  const timelineIdx = TIMELINE_ORDER.indexOf(currentStatus);

  return (
    <div data-theme="pharmacy" className="space-y-5 p-1">
      {/* Progress timeline */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
          Order Timeline
        </p>
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {TIMELINE_ORDER.map((s, idx) => {
            const sc = STATUS_GRAPH[s];
            const Icon = sc.icon;
            const isDone = idx < timelineIdx || currentStatus === 'Delivered';
            const isActive = s === currentStatus;
            return (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all"
                    style={
                      isDone
                        ? { background: 'var(--success)', borderColor: 'var(--success)' }
                        : isActive
                          ? { background: sc.color, borderColor: sc.color }
                          : { background: 'var(--base-200)', borderColor: 'var(--base-300)' }
                    }
                  >
                    <Icon size={13} style={{ color: isDone || isActive ? 'white' : 'color-mix(in oklch, var(--base-content) 35%, transparent)' }} />
                  </div>
                  <span className="text-xs font-semibold whitespace-nowrap" style={{ color: isActive ? sc.color : 'color-mix(in oklch, var(--base-content) 50%, transparent)', fontSize: '0.6rem' }}>
                    {sc.label.split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
                {idx < TIMELINE_ORDER.length - 1 && (
                  <div
                    className="h-0.5 w-8 mx-1 flex-shrink-0 rounded-full"
                    style={{ background: idx < timelineIdx ? 'var(--success)' : 'var(--base-300)' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Current status */}
      <div className="flex items-center gap-3 p-3.5 rounded-xl border"
        style={{ background: `color-mix(in srgb, ${config.color}, transparent 90%)`, borderColor: `color-mix(in srgb, ${config.color}, transparent 60%)` }}>
        <CurrentIcon size={20} style={{ color: config.color }} />
        <div>
          <p className="text-xs font-bold" style={{ color: 'var(--base-content)' }}>Current: {config.label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
            Order #{order?.orderId}
          </p>
        </div>
      </div>

      {/* Available next statuses */}
      {config.next.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
            Transition To
          </p>
          <div className="grid gap-2">
            {config.next.map((ns) => {
              const nsc = STATUS_GRAPH[ns];
              const NIcon = nsc?.icon ?? ArrowRight;
              const isCancel = ns === 'Cancelled';
              const isReturn = ns.startsWith('Return');
              return (
                <motion.button
                  key={ns}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedStatus(selectedStatus === ns ? '' : ns)}
                  className="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all"
                  style={
                    selectedStatus === ns
                      ? { borderColor: nsc?.color ?? 'var(--primary)', background: `color-mix(in srgb, ${nsc?.color ?? 'var(--primary)'}, transparent 88%)` }
                      : { borderColor: 'var(--base-300)', background: 'var(--base-200)' }
                  }
                >
                  <div className="p-2 rounded-lg" style={{ background: `color-mix(in srgb, ${nsc?.color ?? 'var(--primary)'}, transparent 85%)` }}>
                    <NIcon size={15} style={{ color: nsc?.color ?? 'var(--primary)' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: selectedStatus === ns ? (nsc?.color ?? 'var(--primary)') : 'var(--base-content)' }}>
                      {nsc?.label ?? ns}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                      {isCancel ? 'Cancel this order' : isReturn ? 'Process return flow' : `Move to ${nsc?.label}`}
                    </p>
                  </div>
                  <ChevronRight size={14} style={{ color: selectedStatus === ns ? (nsc?.color ?? 'var(--primary)') : 'color-mix(in oklch, var(--base-content) 30%, transparent)' }} />
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: 'var(--success)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>No further transitions</p>
          <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>This order is in its final state</p>
        </div>
      )}

      {/* Extra fields */}
      <AnimatePresence>
        {selectedStatus && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div>
              <label className="text-xs font-bold mb-1.5 block flex items-center gap-1.5" style={{ color: 'var(--base-content)' }}>
                <FileText size={12} /> Status Note <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>(optional)</span>
              </label>
              <textarea
                className="input-field w-full text-sm resize-none"
                rows={2}
                placeholder="Any notes about this status change…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {selectedStatus === 'Out-for-Delivery' && (
              <div>
                <label className="text-xs font-bold mb-1.5 block flex items-center gap-1.5" style={{ color: 'var(--base-content)' }}>
                  <Calendar size={12} /> Estimated Arrival <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>(optional)</span>
                </label>
                <input
                  type="datetime-local"
                  className="input-field w-full text-sm"
                  value={estimatedArrival}
                  onChange={(e) => setEstimatedArrival(e.target.value)}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {errors.orderStatus && (
        <div className="alert alert-error text-sm">
          <AlertTriangle size={15} />
          <span>{errors.orderStatus.message}</span>
        </div>
      )}

      {/* Submit */}
      {selectedStatus && (
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          disabled={loading.orderStatus}
          onClick={handleSubmit}
          className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          style={{
            background: STATUS_GRAPH[selectedStatus]?.color ?? 'var(--primary)',
            color: selectedStatus === 'Cancelled' ? 'var(--error-content)' : 'white',
          }}
        >
          {loading.orderStatus ? (
            <><div className="spinner w-4 h-4" style={{ borderTopColor: 'white' }} /> Updating…</>
          ) : (
            <><ArrowRight size={16} /> Update to {STATUS_GRAPH[selectedStatus]?.label ?? selectedStatus}</>
          )}
        </motion.button>
      )}
    </div>
  );
}

export default function UpdateStatusPage() {
  return <UpdateStatusComponent order={null} onSuccess={() => {}} />;
}