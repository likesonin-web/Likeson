'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bike, User, Search, CheckCircle2, AlertTriangle,
  MapPin, Phone, Star, Clock, Zap
} from 'lucide-react';
import { assignDeliveryPartner, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

// Mock available partners — replace with real API data in production
const MOCK_PARTNERS = [
  { id: '685a1c2e3d4f5a6b7c8d9e0f', name: 'Ravi Kumar', phone: '+91 9876543210', rating: 4.8, activeOrders: 1, area: 'Vijayawada Central', isOnline: true },
  { id: '685a1c2e3d4f5a6b7c8d9e10', name: 'Suresh Babu', phone: '+91 9876543211', rating: 4.6, activeOrders: 0, area: 'Benz Circle', isOnline: true },
  { id: '685a1c2e3d4f5a6b7c8d9e11', name: 'Kiran Rao', phone: '+91 9876543212', rating: 4.9, activeOrders: 2, area: 'One Town', isOnline: false },
];

function AssignDeliveryPartnerComponent({ order, onSuccess }) {
  const dispatch = useDispatch();
  const { loading, errors, success } = useSelector((s) => s.pharmacyStore);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [manualId, setManualId] = useState('');
  const [useManual, setUseManual] = useState(false);

  useEffect(() => {
    if (success.driverAssign) {
      dispatch(clearSuccess('driverAssign'));
      onSuccess?.();
    }
  }, [success.driverAssign, dispatch, onSuccess]);

  useEffect(() => () => { dispatch(clearError('driverAssign')); }, [dispatch]);

  const filteredPartners = MOCK_PARTNERS.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.area.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    const partnerId = useManual ? manualId.trim() : selected;
    if (!partnerId) return;
    dispatch(assignDeliveryPartner({ orderId: order._id, deliveryPartnerId: partnerId }));
  };

  const canSubmit = useManual ? !!manualId.trim() : !!selected;
  const currentPartner = order?.delivery?.internalPartner;

  return (
    <div data-theme="pharmacy" className="space-y-5 p-1">
      {/* Current partner */}
      {currentPartner && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3.5 rounded-xl border"
          style={{ background: 'color-mix(in srgb, var(--info), transparent 90%)', borderColor: 'color-mix(in srgb, var(--info), transparent 65%)' }}
        >
          <Bike size={18} style={{ color: 'var(--info)', flexShrink: 0 }} />
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--base-content)' }}>Currently Assigned</p>
            <p className="text-xs mt-0.5 font-mono" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              {typeof currentPartner === 'string' ? currentPartner : currentPartner?.name ?? 'Unknown'}
            </p>
          </div>
        </motion.div>
      )}

      {/* Order delivery address */}
      <div className="rounded-xl p-3.5 border" style={{ background: 'var(--base-200)', borderColor: 'var(--base-300)' }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
          Delivery Address
        </p>
        <div className="flex items-start gap-2">
          <MapPin size={13} style={{ color: 'var(--primary)', marginTop: 1, flexShrink: 0 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>{order?.delivery?.address?.fullName}</p>
            <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              {order?.delivery?.address?.line1}
              {order?.delivery?.address?.landmark && `, ${order.delivery.address.landmark}`}
            </p>
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              {order?.delivery?.address?.city}, {order?.delivery?.address?.state} — {order?.delivery?.address?.pincode}
            </p>
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--base-300)' }}>
        <button
          onClick={() => setUseManual(false)}
          className="flex-1 py-2.5 text-xs font-bold transition-all"
          style={!useManual ? { background: 'var(--primary)', color: 'var(--primary-content)' } : { background: 'var(--base-200)', color: 'var(--base-content)' }}
        >
          Select from List
        </button>
        <button
          onClick={() => setUseManual(true)}
          className="flex-1 py-2.5 text-xs font-bold transition-all"
          style={useManual ? { background: 'var(--primary)', color: 'var(--primary-content)' } : { background: 'var(--base-200)', color: 'var(--base-content)' }}
        >
          Enter ID Manually
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!useManual ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
            className="space-y-3"
          >
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
              <input
                className="input-field w-full pl-9 text-sm"
                placeholder="Search partner by name or area…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
              {filteredPartners.map((p) => (
                <motion.button
                  key={p.id}
                  whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => setSelected(selected === p.id ? '' : p.id)}
                  disabled={!p.isOnline}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all disabled:opacity-50"
                  style={
                    selected === p.id
                      ? { borderColor: 'var(--primary)', background: 'color-mix(in srgb, var(--primary), transparent 90%)' }
                      : { borderColor: 'var(--base-300)', background: 'var(--base-200)' }
                  }
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'color-mix(in srgb, var(--primary), transparent 80%)' }}>
                      <User size={16} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                      style={{ background: p.isOnline ? 'var(--success)' : 'var(--base-300)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--base-content)' }}>{p.name}</p>
                      {!p.isOnline && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--base-300)', color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Offline</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs flex items-center gap-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                        <MapPin size={9} /> {p.area}
                      </span>
                      <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--warning)' }}>
                        <Star size={9} fill="currentColor" /> {p.rating}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold" style={{ color: p.activeOrders > 2 ? 'var(--warning)' : 'var(--success)' }}>
                      {p.activeOrders} active
                    </p>
                    {selected === p.id && <CheckCircle2 size={16} style={{ color: 'var(--primary)', marginTop: 4 }} />}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="manual"
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            className="space-y-2"
          >
            <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--base-content)' }}>
              Partner ObjectId <span style={{ color: 'var(--error)' }}>*</span>
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} />
              <input
                className="input-field w-full pl-9 text-sm font-mono"
                placeholder="685a1c2e3d4f5a6b7c8d9e0f"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
              />
            </div>
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              Enter the MongoDB ObjectId of the delivery partner (User with role: driver / solodriverpartner)
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {errors.driverAssign && (
        <div className="alert alert-error text-sm">
          <AlertTriangle size={15} />
          <span>{errors.driverAssign.message}</span>
        </div>
      )}

      {/* Submit */}
      <motion.button
        whileHover={{ scale: canSubmit ? 1.02 : 1 }} whileTap={{ scale: canSubmit ? 0.98 : 1 }}
        disabled={!canSubmit || loading.driverAssign}
        onClick={handleSubmit}
        className="btn-primary-cta w-full py-3.5 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {loading.driverAssign ? (
          <><div className="spinner w-4 h-4" /> Assigning…</>
        ) : (
          <><Bike size={16} /> Assign Delivery Partner</>
        )}
      </motion.button>
    </div>
  );
}

export default function AssignDeliveryPartnerPage() {
  return <AssignDeliveryPartnerComponent order={null} onSuccess={() => {}} />;
}