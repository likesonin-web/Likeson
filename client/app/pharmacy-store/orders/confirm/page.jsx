'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Truck, Users, CheckCircle2, AlertTriangle,
  Building2, MapPin, Phone, User, ChevronDown, Package
} from 'lucide-react';
import { confirmOrder, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

const DELIVERY_TYPES = [
  {
    value: 'Internal',
    label: 'Internal Delivery',
    desc: 'Assign an in-house delivery partner',
    icon: Users,
    color: 'var(--primary)',
  },
  {
    value: 'Third-Party',
    label: 'Third-Party Courier',
    desc: 'Use an external courier agency',
    icon: Building2,
    color: 'var(--accent)',
  },
];

function ConfirmOrderComponent({ order, onSuccess }) {
  const dispatch = useDispatch();
  const { loading, errors, success } = useSelector((s) => s.pharmacyStore);

  const [deliveryType, setDeliveryType] = useState('Internal');
  const [internalPartner, setInternalPartner] = useState('');
  const [externalPartner, setExternalPartner] = useState({
    name: '', phone: '', agencyName: '', trackingUrl: '',
  });

  useEffect(() => {
    if (success.orderConfirm) {
      dispatch(clearSuccess('orderConfirm'));
      onSuccess?.();
    }
  }, [success.orderConfirm, dispatch, onSuccess]);

  useEffect(() => () => { dispatch(clearError('orderConfirm')); }, [dispatch]);

  const handleSubmit = () => {
    dispatch(confirmOrder({
      orderId: order._id,
      deliveryType,
      ...(deliveryType === 'Internal' && { internalPartner }),
      ...(deliveryType === 'Third-Party' && { externalPartner }),
    }));
  };

  const canSubmit =
    deliveryType === 'Internal'
      ? !!internalPartner.trim()
      : !!externalPartner.name.trim() && !!externalPartner.agencyName.trim();

  return (
    <div data-theme="pharmacy" className="space-y-5 p-1">
      {/* Order summary */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-4 border"
        style={{ background: 'var(--base-200)', borderColor: 'var(--base-300)' }}
      >
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: 'color-mix(in srgb, var(--primary), transparent 88%)' }}>
            <Package size={18} style={{ color: 'var(--primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm" style={{ color: 'var(--base-content)' }}>Order #{order?.orderId}</p>
            <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              {order?.items?.length ?? 0} items · ₹{order?.billing?.totalPayable?.toFixed(2)}
            </p>
            <p className="text-xs mt-1 font-medium" style={{ color: 'var(--base-content)' }}>
              <MapPin size={10} className="inline mr-1" />
              {order?.delivery?.address?.line1}, {order?.delivery?.address?.city}
            </p>
          </div>
          <div className="text-right">
            <span className="badge badge-warning text-xs">{order?.delivery?.status}</span>
          </div>
        </div>
      </motion.div>

      {/* Delivery type selector */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
          Delivery Method
        </p>
        <div className="grid grid-cols-2 gap-3">
          {DELIVERY_TYPES.map((dt) => (
            <motion.button
              key={dt.value}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setDeliveryType(dt.value)}
              className="p-4 rounded-xl border-2 text-left transition-all"
              style={
                deliveryType === dt.value
                  ? { borderColor: dt.color, background: `color-mix(in srgb, ${dt.color}, transparent 88%)` }
                  : { borderColor: 'var(--base-300)', background: 'var(--base-200)' }
              }
            >
              <dt.icon size={20} style={{ color: deliveryType === dt.value ? dt.color : 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
              <p className="mt-2 text-sm font-bold" style={{ color: deliveryType === dt.value ? dt.color : 'var(--base-content)' }}>{dt.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>{dt.desc}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Partner details */}
      <AnimatePresence mode="wait">
        {deliveryType === 'Internal' ? (
          <motion.div
            key="internal"
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
            className="space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
              Assign Delivery Partner
            </p>
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--base-content)' }}>
                Partner ID / Name <span style={{ color: 'var(--error)' }}>*</span>
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
                <input
                  className="input-field w-full pl-9 text-sm"
                  placeholder="Enter partner ID or search by name…"
                  value={internalPartner}
                  onChange={(e) => setInternalPartner(e.target.value)}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                Enter the ObjectId or name of the delivery partner
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="external"
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
            className="space-y-3"
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
              Third-Party Courier Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--base-content)' }}>
                  Contact Name <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  className="input-field w-full text-sm"
                  placeholder="e.g. Raju Kumar"
                  value={externalPartner.name}
                  onChange={(e) => setExternalPartner((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--base-content)' }}>Phone</label>
                <div className="relative">
                  <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
                  <input
                    className="input-field w-full pl-9 text-sm"
                    placeholder="+91…"
                    value={externalPartner.phone}
                    onChange={(e) => setExternalPartner((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--base-content)' }}>
                  Agency Name <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  className="input-field w-full text-sm"
                  placeholder="e.g. Delhivery, BlueDart…"
                  value={externalPartner.agencyName}
                  onChange={(e) => setExternalPartner((p) => ({ ...p, agencyName: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--base-content)' }}>Tracking URL</label>
                <input
                  className="input-field w-full text-sm"
                  placeholder="https://track.example.com/…"
                  value={externalPartner.trackingUrl}
                  onChange={(e) => setExternalPartner((p) => ({ ...p, trackingUrl: e.target.value }))}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {errors.orderConfirm && (
        <div className="alert alert-error text-sm">
          <AlertTriangle size={15} />
          <span>{errors.orderConfirm.message}</span>
        </div>
      )}

      {/* Submit */}
      <motion.button
        whileHover={{ scale: canSubmit ? 1.02 : 1 }} whileTap={{ scale: canSubmit ? 0.98 : 1 }}
        disabled={!canSubmit || loading.orderConfirm}
        onClick={handleSubmit}
        className="btn-primary-cta w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading.orderConfirm ? (
          <><div className="spinner w-4 h-4" /> Confirming Order…</>
        ) : (
          <><CheckCircle2 size={16} /> Confirm Order</>
        )}
      </motion.button>
    </div>
  );
}

export default function ConfirmOrderPage() {
  return <ConfirmOrderComponent order={null} onSuccess={() => {}} />;
}