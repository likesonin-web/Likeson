'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileCheck, FileX, AlertTriangle, ZoomIn, CheckCircle2,
  XCircle, Clock, Shield, Eye, RotateCcw, Info
} from 'lucide-react';
import {
  verifyPrescription,
  clearSuccess,
  clearError,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

function VerifyPrescriptionComponent({ order, onSuccess }) {
  const dispatch = useDispatch();
  const { loading, errors, success } = useSelector((s) => s.pharmacyStore);

  const [isVerified, setIsVerified] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [imgZoomed, setImgZoomed] = useState(false);

  useEffect(() => {
    if (success.prescription) {
      dispatch(clearSuccess('prescription'));
      onSuccess?.();
    }
  }, [success.prescription, dispatch, onSuccess]);

  useEffect(() => {
    return () => { dispatch(clearError('prescription')); };
  }, [dispatch]);

  const handleSubmit = () => {
    if (isVerified === null) return;
    dispatch(verifyPrescription({
      orderId: order._id,
      isVerified,
      verificationNotes: verificationNotes.trim(),
      rejectionReason: rejectionReason.trim(),
    }));
  };

  const rx = order?.prescription;
  const statusMap = {
    Not_Uploaded: { label: 'Not Uploaded', color: 'badge-warning', icon: Clock },
    Pending:      { label: 'Pending Review', color: 'badge-info', icon: Clock },
    Approved:     { label: 'Approved', color: 'badge-success', icon: CheckCircle2 },
    Rejected:     { label: 'Rejected', color: 'badge-error', icon: XCircle },
  };
  const current = statusMap[rx?.verificationStatus] ?? statusMap.Pending;
  const StatusIcon = current.icon;

  return (
    <div data-theme="pharmacy" className="space-y-5 p-1">
      {/* Current status banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-3.5 rounded-xl border"
        style={{
          background: rx?.verificationStatus === 'Approved'
            ? 'color-mix(in srgb, var(--success), transparent 88%)'
            : rx?.verificationStatus === 'Rejected'
              ? 'color-mix(in srgb, var(--error), transparent 88%)'
              : 'color-mix(in srgb, var(--info), transparent 88%)',
          borderColor: rx?.verificationStatus === 'Approved'
            ? 'color-mix(in srgb, var(--success), transparent 60%)'
            : rx?.verificationStatus === 'Rejected'
              ? 'color-mix(in srgb, var(--error), transparent 60%)'
              : 'color-mix(in srgb, var(--info), transparent 60%)',
        }}
      >
        <StatusIcon size={18} style={{
          color: rx?.verificationStatus === 'Approved' ? 'var(--success)' : rx?.verificationStatus === 'Rejected' ? 'var(--error)' : 'var(--info)'
        }} />
        <div>
          <p className="text-xs font-bold" style={{ color: 'var(--base-content)' }}>Prescription Status: {current.label}</p>
          {rx?.verifiedAt && (
            <p className="text-xs mt-0.5" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
              Last updated: {new Date(rx.verifiedAt).toLocaleString('en-IN')}
            </p>
          )}
        </div>
      </motion.div>

      {/* Prescription image */}
      {rx?.imageUrl ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
            Prescription Image
          </p>
          <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--base-300)' }}>
            <img
              src={rx.imageUrl}
              alt="Prescription"
              className="w-full max-h-72 object-contain cursor-zoom-in"
              style={{ background: 'var(--base-200)' }}
              onClick={() => setImgZoomed(true)}
            />
            <button
              onClick={() => setImgZoomed(true)}
              className="absolute top-2 right-2 p-1.5 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
            >
              <ZoomIn size={13} />
            </button>
          </div>
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            Uploaded: {rx.uploadedAt ? new Date(rx.uploadedAt).toLocaleString('en-IN') : 'N/A'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: 'var(--base-300)' }}>
          <FileX size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--base-content)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>No prescription uploaded</p>
          <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            Customer hasn't uploaded a prescription yet
          </p>
        </div>
      )}

      {/* Decision buttons */}
      {rx?.imageUrl && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
            Verification Decision
          </p>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setIsVerified(true)}
              className="p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all"
              style={
                isVerified === true
                  ? { background: 'color-mix(in srgb, var(--success), transparent 80%)', borderColor: 'var(--success)' }
                  : { background: 'var(--base-200)', borderColor: 'var(--base-300)' }
              }
            >
              <CheckCircle2 size={22} style={{ color: isVerified === true ? 'var(--success)' : 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
              <span className="text-sm font-bold" style={{ color: isVerified === true ? 'var(--success)' : 'var(--base-content)' }}>Approve</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setIsVerified(false)}
              className="p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all"
              style={
                isVerified === false
                  ? { background: 'color-mix(in srgb, var(--error), transparent 80%)', borderColor: 'var(--error)' }
                  : { background: 'var(--base-200)', borderColor: 'var(--base-300)' }
              }
            >
              <XCircle size={22} style={{ color: isVerified === false ? 'var(--error)' : 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
              <span className="text-sm font-bold" style={{ color: isVerified === false ? 'var(--error)' : 'var(--base-content)' }}>Reject</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Notes */}
      <AnimatePresence>
        {isVerified !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="space-y-3 overflow-hidden"
          >
            <div>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--base-content)' }}>
                Verification Notes <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>(optional)</span>
              </label>
              <textarea
                className="input-field w-full text-sm resize-none"
                rows={3}
                placeholder="Add any notes about the prescription…"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
              />
            </div>

            {isVerified === false && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--error)' }}>
                  Rejection Reason <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <textarea
                  className="input-field w-full text-sm resize-none"
                  rows={3}
                  placeholder="Explain why the prescription is being rejected…"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ borderColor: !rejectionReason.trim() ? 'color-mix(in srgb, var(--error), transparent 60%)' : undefined }}
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      {errors.prescription && (
        <div className="alert alert-error text-sm">
          <AlertTriangle size={15} />
          <span>{errors.prescription.message}</span>
        </div>
      )}

      {/* Submit */}
      {isVerified !== null && (
        <motion.button
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          disabled={loading.prescription || (isVerified === false && !rejectionReason.trim())}
          onClick={handleSubmit}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
          style={
            isVerified
              ? { background: 'var(--success)', color: 'var(--success-content)' }
              : { background: 'var(--error)', color: 'var(--error-content)' }
          }
        >
          {loading.prescription ? (
            <><div className="spinner w-4 h-4" /> Processing…</>
          ) : isVerified ? (
            <><FileCheck size={16} /> Approve Prescription</>
          ) : (
            <><FileX size={16} /> Reject Prescription</>
          )}
        </motion.button>
      )}

      {/* Zoom modal */}
      <AnimatePresence>
        {imgZoomed && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.85)' }}
            onClick={() => setImgZoomed(false)}
          >
            <motion.img
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              src={rx?.imageUrl}
              alt="Prescription Full"
              className="max-h-[90vh] max-w-full rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VerifyPrescriptionPage() {
  return <VerifyPrescriptionComponent order={null} onSuccess={() => {}} />;
}