'use client';

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ShoppingCart, Trash2, Plus, Minus, ArrowRight,
  ShieldCheck, Truck, RefreshCw, Package, AlertCircle,
  CreditCard, Wallet, CheckCircle2,
  MapPin, Star, Zap, ChevronDown, Building2,
  ReceiptText, BadgePercent, HeartPulse, Tag, X,
  FileText, Upload, Eye, Clock, CheckCheck,
  AlertTriangle, ZoomIn, Replace, Loader2,
} from 'lucide-react';
import Banner from '@/components/Banner';
import Container from '@/components/ui/Container';
import { selectMySubscription, selectMySubPlanName } from '@/store/slices/subscriptionSlice';
// ─── Redux ────────────────────────────────────────────────────────────────────
import {
  fetchCart,
  updateCartItem,
  removeCartItem,
  purgeCart,
  checkoutCart,
  verifyPayment,
  payViaWallet,
  validateCoupon,
  clearCoupon,
  clearPharmacyErrors,
  clearPrescriptionUpload,
  uploadPrescriptionFile,
  uploadCartItemPrescription,
  fetchDeliveryPricing,
  // Selectors
  selectCart,
  selectCartItems,
  selectCartBillSummary,
  selectPharmacyGlobalLoading,
  selectPharmacyActionLoading,
  selectCurrentOrder,
  selectOrderError,
  selectPaymentError,
  selectCoupon,
  selectCouponLoading,
  selectCouponError,
  selectPrescriptionUploadLoading,
  selectPrescriptionUploadError,
  selectDeliveryPricing,
  selectDeliveryPricingLoading,
} from '@/store/slices/pharmacyOrderSlice';

import {
  fetchWalletDetails,
  selectWalletBalance,
  selectWalletData,
} from '@/store/slices/walletSlice';
import BackButton from '../../../components/BackButton';

// ═══════════════════════════════════════════════════════════════════════════════
// § CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const RAZORPAY_KEY = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SV43jVcrs5wKAM';

const PAYMENT_METHODS = [
  {
    id: 'Razorpay', label: 'Pay Online', sub: 'UPI, Cards, Net Banking',
    icon: CreditCard, color: 'text-primary', bg: 'bg-primary/10 border-primary/30',
  },
  {
    id: 'Wallet', label: 'Likeson Wallet', sub: 'Instant debit from balance',
    icon: Wallet, color: 'text-secondary', bg: 'bg-secondary/10 border-secondary/30',
  },
  {
    id: 'COD', label: 'Cash on Delivery', sub: 'Pay when your order arrives',
    icon: Truck, color: 'text-success', bg: 'bg-success/10 border-success/30',
  },
];

const ADDRESS_FIELDS = [
  { name: 'fullName', label: 'Full Name',      placeholder: 'Recipient name',        half: true,  note: 'Enter the name of the person receiving the order' },
  { name: 'phone',    label: 'Phone',          placeholder: '+91 XXXXX XXXXX',       half: true,  note: '10-digit mobile number for delivery updates' },
  { name: 'line1',    label: 'Address Line 1', placeholder: 'House / Flat / Street', half: false, note: 'Door number, building name, street name' },
  { name: 'landmark', label: 'Landmark',       placeholder: 'Near... (optional)',    half: true,  note: 'Helps delivery partner locate you faster' },
  { name: 'city',     label: 'City',           placeholder: 'Vijayawada',            half: true,  note: 'Your city name' },
  { name: 'pincode',  label: 'Pincode',        placeholder: '520001',                half: true,  note: '6-digit postal code' },
];

const DEFAULT_ADDRESS = {
  fullName: '', phone: '', line1: '', landmark: '', city: 'Vijayawada', pincode: '',
};

const REQUIRED_FIELDS = ['fullName', 'phone', 'line1', 'pincode'];
const STEP_ORDER      = { cart: 0, prescription: 1, address: 2, payment: 3, success: 4 };

const MAX_FILE_SIZE   = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES  = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// ═══════════════════════════════════════════════════════════════════════════════
// § HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const getPrescriptionStatus = (item) => {
  if (!item.isPrescriptionRequired) return null;
  const rx = item.prescription;
  if (!rx?.imageUrl) {
    return { status: 'missing',  label: 'Upload Required', color: 'text-error',   icon: AlertTriangle, bg: 'bg-error/10 border-error/30'    };
  }
  return   { status: 'uploaded', label: 'Rx Uploaded',     color: 'text-success', icon: CheckCheck,    bg: 'bg-success/10 border-success/30' };
};

const allPrescriptionsUploaded = (items) =>
  items.filter((i) => i.isPrescriptionRequired).every((i) => !!i.prescription?.imageUrl);

const getMissingRxItems = (items) =>
  items.filter((i) => i.isPrescriptionRequired && !i.prescription?.imageUrl);

const hasAnyRxItem = (items) => items.some((i) => i.isPrescriptionRequired);
const isPdfUrl     = (url) => typeof url === 'string' && url.toLowerCase().includes('.pdf');

const validateAddress = (addr) => {
  const errs = {};
  if (!addr.fullName?.trim()) errs.fullName = 'Name is required';
  if (!addr.phone?.trim())    errs.phone    = 'Phone is required';
  else if (!/^\+?[\d\s\-]{8,15}$/.test(addr.phone.trim())) errs.phone = 'Enter a valid phone number';
  if (!addr.line1?.trim())    errs.line1    = 'Address is required';
  if (!addr.pincode?.trim())  errs.pincode  = 'Pincode is required';
  else if (!/^\d{6}$/.test(addr.pincode.trim())) errs.pincode = 'Enter a valid 6-digit pincode';
  return errs;
};

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const openRazorpayModal = ({ rzpKey, rzpOrderId, amount, name, description, prefill }) =>
  new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.Razorpay) {
      reject(new Error('Razorpay SDK not loaded. Please refresh.')); return;
    }
    if (!rzpKey) { reject(new Error('Razorpay key missing.')); return; }

    const rzp = new window.Razorpay({
      key: rzpKey,
      order_id: rzpOrderId,
      amount: Math.round(amount * 100),
      currency: 'INR',
      name: name || 'Likeson Healthcare',
      description: description || 'Medicine Purchase',
      prefill,
      theme: { color: '#0ea5e9' },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment modal closed by user.'))
      },
    });

    rzp.on('payment.failed', (response) => {
      reject(new Error(response.error.description || 'Payment failed.'));
    });

    rzp.open();
  });

// ─── Animation variants ───────────────────────────────────────────────────────
const listVariants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden:  { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', damping: 22, stiffness: 140 } },
  exit:    { opacity: 0, x: 20, transition: { duration: 0.18 } },
};
const slideVariants = {
  enter:  (dir) => ({ opacity: 0, x: dir > 0 ?  40 : -40 }),
  center: {         opacity: 1, x: 0, transition: { type: 'spring', damping: 24, stiffness: 160 } },
  exit:   (dir) => ({ opacity: 0, x: dir > 0 ? -40 :  40, transition: { duration: 0.16 } }),
};

// ═══════════════════════════════════════════════════════════════════════════════
// § SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const RxImagePreview = React.memo(({ imageUrl, onView }) => {
  if (!imageUrl) return null;
  const isPdf = isPdfUrl(imageUrl);
  return (
    <button
      onClick={onView}
      aria-label="View uploaded prescription"
      className="relative w-14 h-14 rounded-md overflow-hidden border-2 border-success/40 bg-base-200 hover:border-success hover:scale-105 transition-all group shrink-0"
    >
      {isPdf ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5 bg-error/10">
          <FileText className="w-5 h-5 text-error" />
          <span className="text-[8px] text-error uppercase tracking-wider">PDF</span>
        </div>
      ) : (
        <img src={imageUrl} alt="Prescription" className="w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <ZoomIn className="w-4 h-4 text-white" />
      </div>
    </button>
  );
});
RxImagePreview.displayName = 'RxImagePreview';

const RxLightbox = React.memo(({ imageUrl, medicineName, onClose }) => {
  const isPdf = isPdfUrl(imageUrl);
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-strong flex flex-col"
      role="dialog" aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-success" />
          <div>
            <p className="text-xs text-white">Prescription</p>
            {medicineName && <p className="text-[10px] text-white/50">{medicineName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a href={imageUrl} target="_blank" rel="noopener noreferrer"
             className="text-[10px] font-bold text-white/60 hover:text-white underline transition-colors">
            {isPdf ? 'Open PDF ↗' : 'Open original ↗'}
          </a>
          <button onClick={onClose} aria-label="Close preview"
                  className="btn btn-ghost btn-sm btn-circle text-white/60 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        {isPdf ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-md bg-error/20 border border-error/30 flex items-center justify-center">
              <FileText className="w-12 h-12 text-error" />
            </div>
            <p className="text-white/60 text-xs font-bold">PDF prescription uploaded</p>
            <a href={imageUrl} target="_blank" rel="noopener noreferrer"
               className="btn btn-primary btn-sm">
              Open PDF in new tab ↗
            </a>
          </div>
        ) : (
          <motion.img
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            src={imageUrl} alt="Prescription"
            className="max-w-full max-h-full object-contain rounded-md shadow-2xl"
          />
        )}
      </div>
      <p className="text-center text-[9px] font-bold text-white/20 uppercase tracking-widest py-2 shrink-0">
        Press ESC or click outside to close
      </p>
    </motion.div>
  );
});
RxLightbox.displayName = 'RxLightbox';

const PrescriptionBadge = React.memo(({ item, onUpload, onView, isUploading }) => {
  const rxStatus = getPrescriptionStatus(item);
  if (!rxStatus) return null;
  const Icon = rxStatus.icon;

  if (rxStatus.status === 'uploaded') {
    return (
      <div className={`flex items-center gap-2 mt-2 px-2 py-1.5 rounded-md border ${rxStatus.bg}`}>
        <RxImagePreview imageUrl={item.prescription?.imageUrl} onView={() => onView(item)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <CheckCheck className="w-3 h-3 text-success shrink-0" />
            <span className="text-[10px] text-success uppercase tracking-wide">Rx Uploaded</span>
          </div>
          {item.prescription?.uploadedAt && (
            <p className="text-[9px] text-base-content/40 flex items-center gap-1 mt-0.5">
              <Clock className="w-2.5 h-2.5" />
              {new Date(item.prescription.uploadedAt).toLocaleDateString('en-IN')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onView(item)}
                  className="flex items-center gap-1 text-[9px] font-bold text-primary hover:text-primary/80 underline underline-offset-2 transition-colors">
            <Eye className="w-3 h-3" /> View
          </button>
          <span className="text-base-content/20">|</span>
          <button onClick={() => onUpload(item)} disabled={isUploading}
                  className="flex items-center gap-1 text-[9px] font-bold text-base-content/50 hover:text-warning underline underline-offset-2 transition-colors disabled:opacity-40">
            {isUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Replace className="w-3 h-3" />}
            Replace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 mt-2 px-2 py-1.5 rounded-md border ${rxStatus.bg}`}>
      <Icon className={`w-3 h-3 shrink-0 ${rxStatus.color}`} />
      <span className={`text-[10px] ${rxStatus.color} uppercase tracking-wide flex-1`}>
        {rxStatus.label}
      </span>
      <button onClick={() => onUpload(item)} disabled={isUploading}
              className="ml-auto flex items-center gap-1 text-error hover:text-error/80 underline underline-offset-2 text-[10px] disabled:opacity-40 transition-colors">
        {isUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
        Upload
      </button>
    </div>
  );
});
PrescriptionBadge.displayName = 'PrescriptionBadge';

const PrescriptionUploadModal = React.memo(({ item, onConfirm, onClose, isUploading }) => {
  const dispatch   = useDispatch();
  const medicine   = item?.medicine;
  const fileRef    = useRef(null);

  const [selectedFile,       setSelectedFile]    = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null);
  const [uploadError,        setUploadError]     = useState(null);

  useEffect(() => {
    return () => { if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl); };
  }, [localPreviewUrl]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError('Only JPG, PNG, WEBP, or PDF files are accepted.'); return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File is too large. Maximum allowed size is 5 MB.'); return;
    }
    setUploadError(null);
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setSelectedFile(file);
    setLocalPreviewUrl(URL.createObjectURL(file));
  }, [localPreviewUrl]);

  const handleConfirm = useCallback(async () => {
    if (!selectedFile) { setUploadError('Please select a file first.'); return; }
    try {
      setUploadError(null);
      const result = await dispatch(uploadPrescriptionFile({ file: selectedFile })).unwrap();
      const cdnUrl = result?.imageUrl;
      if (!cdnUrl) throw new Error('No URL returned from upload service.');
      await onConfirm(item, cdnUrl);
    } catch (err) {
      setUploadError(err?.message ?? 'Failed to upload prescription. Please try again.');
    }
  }, [dispatch, selectedFile, item, onConfirm]);

  const isPdf = selectedFile?.type === 'application/pdf';

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-soft p-4"
      role="dialog" aria-modal="true" aria-label="Upload prescription"
      onClick={(e) => { if (e.target === e.currentTarget && !isUploading) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }}
        className="card w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-error/10 border border-error/20 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-error" />
            </div>
            <div>
              <h3 className="text-xs text-base-content font-bold">
                {item?.prescription?.imageUrl ? 'Replace Prescription' : 'Upload Prescription'}
              </h3>
              <p className="text-[10px] text-base-content/50 mt-0.5">
                {medicine?.brandName ?? 'Medicine'} requires a valid Rx
              </p>
            </div>
          </div>
          <button onClick={onClose} disabled={isUploading} aria-label="Close"
                  className="btn btn-ghost btn-sm btn-circle text-base-content/40 hover:text-error hover:bg-error/10 disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        {medicine?.brandName && (
          <div className="flex items-center gap-3 p-3 rounded-md bg-base-200 border border-base-300">
            <Package className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-base-content font-semibold truncate">{medicine.brandName}</p>
              {medicine.genericName && (
                <p className="text-[10px] text-base-content/50 truncate">{medicine.genericName}</p>
              )}
            </div>
          </div>
        )}

        {item?.prescription?.imageUrl && !selectedFile && (
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-widest text-base-content/40 font-bold">
              Currently Uploaded
            </p>
            <div className="relative w-full h-32 rounded-md overflow-hidden border border-success/40 bg-base-200">
              {isPdfUrl(item.prescription.imageUrl) ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                  <FileText className="w-8 h-8 text-error" />
                  <span className="text-[10px] font-bold text-error">PDF uploaded</span>
                  <a href={item.prescription.imageUrl} target="_blank" rel="noopener noreferrer"
                     className="text-[10px] text-primary underline">Open PDF ↗</a>
                </div>
              ) : (
                <img src={item.prescription.imageUrl} alt="Current prescription"
                     className="w-full h-full object-contain p-2" />
              )}
              <div className="absolute top-1.5 right-1.5 bg-success text-white text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold">
                Current
              </div>
            </div>
          </div>
        )}

        {selectedFile && (
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase tracking-widest text-base-content/40 font-bold">
              {item?.prescription?.imageUrl ? 'New Prescription (Preview)' : 'Selected File (Preview)'}
            </p>
            <div className="relative w-full h-40 rounded-md overflow-hidden border-2 border-primary/40 bg-base-200">
              {isPdf ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <FileText className="w-10 h-10 text-error" />
                  <p className="text-xs font-bold text-base-content">{selectedFile.name}</p>
                  <p className="text-[10px] text-base-content/40">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <img src={localPreviewUrl} alt="Preview" className="w-full h-full object-contain p-2" />
              )}
              <button onClick={() => { setSelectedFile(null); if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl); setLocalPreviewUrl(null); setUploadError(null); }}
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-error/80 text-white hover:bg-error transition-colors">
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-1.5 left-1.5 bg-primary text-primary-content text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-wider font-bold">
                New
              </div>
            </div>
            <p className="text-[9px] text-base-content/40 font-medium">{selectedFile.name} · {(selectedFile.size / 1024).toFixed(0)} KB</p>
          </div>
        )}

        {!selectedFile && (
          <div
            className="border-2 border-dashed border-base-300 rounded-md p-6 flex flex-col items-center justify-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group"
            onClick={() => fileRef.current?.click()}
            role="button" aria-label="Select prescription file"
          >
            <div className="w-12 h-12 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-xs text-base-content font-bold">
                {item?.prescription?.imageUrl ? 'Select new prescription file' : 'Click to select file'}
              </p>
              <p className="text-[10px] text-base-content/40 mt-0.5">JPG, PNG, WEBP, or PDF · Max 5 MB</p>
            </div>
            <input ref={fileRef} type="file" className="hidden"
                   accept="image/jpeg,image/png,image/webp,application/pdf"
                   onChange={handleFileChange} disabled={isUploading} />
          </div>
        )}

        {selectedFile && (
          <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-base-300 rounded-md text-[10px] font-bold text-base-content/50 hover:text-primary hover:border-primary/40 transition-all">
            <Replace className="w-3 h-3" /> Choose a different file
            <input ref={fileRef} type="file" className="hidden"
                   accept="image/jpeg,image/png,image/webp,application/pdf"
                   onChange={handleFileChange} disabled={isUploading} />
          </button>
        )}

        <div className="alert alert-warning text-[10px] py-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="leading-relaxed">
            Upload a clear photo or scan of the prescription issued by a registered medical practitioner.
            Orders without valid prescriptions may be held by our pharmacist.
          </p>
        </div>

        <AnimatePresence>
          {uploadError && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="alert alert-error text-[10px] py-2 mt-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="font-bold">{uploadError}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} disabled={isUploading}
                  className="btn btn-ghost flex-1 border border-base-300">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={isUploading || !selectedFile}
                  className="btn btn-primary flex-1">
            {isUploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
              : <><CheckCheck className="w-4 h-4" />{item?.prescription?.imageUrl ? 'Replace' : 'Confirm Upload'}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
PrescriptionUploadModal.displayName = 'PrescriptionUploadModal';

const PrescriptionStep = React.memo(({ items, onUpload, onView, uploadingItemId }) => {
  const rxItems    = items.filter((i) => i.isPrescriptionRequired);
  const missingRx  = rxItems.filter((i) => !i.prescription?.imageUrl);
  const uploadedRx = rxItems.filter((i) => !!i.prescription?.imageUrl);
  const allDone    = missingRx.length === 0;

  return (
    <motion.div
      key="prescription-step"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
      className="space-y-4"
    >
      <div className="alert alert-warning py-3">
        <FileText className="w-5 h-5 shrink-0" />
        <div>
          <p className="text-xs font-bold">Prescription Required</p>
          <p className="text-[10px] opacity-80 mt-1 leading-relaxed">
            {missingRx.length > 0
              ? `${missingRx.length} item${missingRx.length > 1 ? 's' : ''} in your cart require a valid doctor's prescription.`
              : 'All prescriptions uploaded! You can proceed to delivery address.'}
          </p>
        </div>
      </div>

      <div>
        <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-base-content/40 mb-1.5">
          <span>Upload Progress</span>
          <span className={allDone ? 'text-success' : 'text-warning'}>
            {uploadedRx.length}/{rxItems.length} Uploaded
          </span>
        </div>
        <div className="progress-bar">
          <motion.div
            className={`h-full rounded-full ${allDone ? 'bg-success' : 'bg-warning'}`}
            initial={{ width: 0 }}
            animate={{ width: `${(uploadedRx.length / rxItems.length) * 100}%` }}
            transition={{ type: 'spring', damping: 22, stiffness: 120 }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {rxItems.map((item) => {
          const medicine   = item.medicine;
          const medicineId = medicine?._id ?? item.medicine;
          const hasUploaded = !!item.prescription?.imageUrl;
          const isUploading = uploadingItemId === medicineId?.toString();
          const primaryImg  = medicine?.images?.find((i) => i.isPrimary)?.url ?? medicine?.images?.[0]?.url ?? null;

          return (
            <div key={medicineId}
                 className={`card p-4 flex items-start gap-4 border-l-4 transition-colors ${hasUploaded ? 'border-l-success' : 'border-l-error'}`}
            >
              <div className="w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-base-200 border border-base-300">
                {primaryImg
                  ? <img src={primaryImg} alt={medicine?.brandName ?? 'Medicine'} className="w-full h-full object-contain p-1" />
                  : <div className="w-full h-full flex items-center justify-center"><Package className="w-6 h-6 text-primary/20" /></div>}
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <h4 className="text-xs text-base-content font-bold truncate">{medicine?.brandName ?? 'Medicine'}</h4>
                  {medicine?.genericName && <p className="text-[10px] text-base-content/50">{medicine.genericName}</p>}
                  <p className="text-[9px] text-base-content/30 mt-0.5 font-medium">Qty: {item.quantity} · ₹{item.pricePerUnit}/unit</p>
                </div>
                {hasUploaded ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="badge badge-success badge-sm gap-1">
                        <CheckCheck className="w-3 h-3" /> Uploaded
                      </div>
                      {item.prescription?.uploadedAt && (
                        <span className="text-[9px] text-base-content/30 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(item.prescription.uploadedAt).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <RxImagePreview imageUrl={item.prescription.imageUrl} onView={() => onView(item)} />
                      <div className="flex flex-col gap-1">
                        <button onClick={() => onView(item)}
                                className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 underline underline-offset-2 transition-colors">
                          <Eye className="w-3 h-3" /> View prescription
                        </button>
                        <button onClick={() => onUpload(item)} disabled={isUploading}
                                className="flex items-center gap-1 text-[9px] font-bold text-base-content/50 hover:text-warning underline underline-offset-2 transition-colors disabled:opacity-40">
                          {isUploading ? <><RefreshCw className="w-3 h-3 animate-spin" /> Uploading…</> : <><Replace className="w-3 h-3" /> Replace</>}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => onUpload(item)} disabled={isUploading}
                          className="btn btn-outline btn-error btn-xs">
                    {isUploading ? <><Loader2 className="w-3 h-3 animate-spin" /> Uploading…</> : <><Upload className="w-3 h-3" /> Upload Prescription</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!allDone && (
        <div className="alert bg-base-200 border-base-300 py-2 mt-4 text-[10px]">
          <AlertCircle className="w-4 h-4 text-base-content/40 shrink-0" />
          <p className="text-base-content/60 leading-relaxed">
            You may proceed without uploading now, but our pharmacist may contact you
            or put your order on hold until a valid prescription is verified.
          </p>
        </div>
      )}
    </motion.div>
  );
});
PrescriptionStep.displayName = 'PrescriptionStep';

const CartItem = React.memo(({ item, onQuantityChange, onRemove, onUploadPrescription, onViewPrescription, isUpdating }) => {
  const medicine   = item.medicine;
  const primaryImg = medicine?.images?.find((i) => i.isPrimary)?.url ?? medicine?.images?.[0]?.url ?? null;
  const lineTotal  = (item.pricePerUnit * item.quantity).toFixed(2);
  const medicineId = medicine?._id ?? item.medicine;

  return (
    <motion.div variants={itemVariants} layout
                className="card flex flex-col sm:flex-row gap-4 p-4 group"
                role="listitem"
    >
      <div className="relative w-full sm:w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-base-200 border border-base-300">
        {primaryImg
          ? <img src={primaryImg} alt={medicine?.brandName ?? 'Medicine'} loading="lazy" className="w-full h-full object-contain p-2" />
          : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-primary/20" /></div>}
        {item.isPrescriptionRequired && (
          <div className="absolute bottom-0 inset-x-0 bg-error/80 text-white text-[8px] text-center py-0.5 uppercase tracking-wider font-bold">
            Rx
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <h3 className="text-xs text-base-content font-bold truncate">{medicine?.brandName ?? 'Medicine'}</h3>
        <p className="text-[10px] text-base-content/50 font-medium uppercase tracking-wider truncate">
          {medicine?.genericName} {medicine?.dosage ? `• ${medicine.dosage}` : ''}
        </p>
        <p className="text-[10px] text-base-content/40 truncate">{medicine?.packaging}</p>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-primary font-bold">₹{item.pricePerUnit}</span>
          <span className="text-[9px] text-base-content/30 font-bold">/unit</span>
          {medicine?.gstPercentage > 0 && (
            <span className="text-[9px] text-base-content/30">+{medicine.gstPercentage}% GST</span>
          )}
        </div>
        <PrescriptionBadge item={item} onUpload={onUploadPrescription} onView={onViewPrescription} isUploading={isUpdating} />
      </div>

      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1 bg-base-200 rounded-lg border border-base-300 p-0.5"
             role="group" aria-label={`Quantity for ${medicine?.brandName}`}>
          <button onClick={() => onQuantityChange(item, item.quantity - 1)} disabled={item.quantity <= 1 || isUpdating}
                  aria-label="Decrease quantity"
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-primary hover:text-primary-content disabled:opacity-30 transition-all">
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-7 text-center text-xs font-semibold" aria-live="polite">
            {isUpdating ? <RefreshCw className="w-3 h-3 animate-spin mx-auto text-primary" /> : item.quantity}
          </span>
          <button onClick={() => onQuantityChange(item, item.quantity + 1)} disabled={isUpdating}
                  aria-label="Increase quantity"
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-primary hover:text-primary-content disabled:opacity-30 transition-all">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <span className="text-base text-base-content font-bold">₹{lineTotal}</span>

        <button onClick={() => onRemove(item)} disabled={isUpdating} aria-label={`Remove ${medicine?.brandName ?? 'item'}`}
                className="btn btn-ghost btn-sm text-base-content/30 hover:text-error hover:bg-error/10">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
});
CartItem.displayName = 'CartItem';

const AddressForm = React.memo(({ address, onChange, errors }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    {ADDRESS_FIELDS.map((field) => (
      <div key={field.name} className={field.half ? '' : 'sm:col-span-2'}>
        <label htmlFor={`addr-${field.name}`}
               className="label pb-1 pt-0">
          <span className="label-text text-[10px] uppercase tracking-widest text-base-content/50">
            {field.label}
            {REQUIRED_FIELDS.includes(field.name) && <span className="text-error ml-0.5" aria-hidden="true">*</span>}
          </span>
        </label>
        <input
          id={`addr-${field.name}`}
          type={field.name === 'phone' ? 'tel' : field.name === 'pincode' ? 'number' : 'text'}
          value={address[field.name] ?? ''}
          onChange={(e) => onChange(field.name, e.target.value)}
          placeholder={field.placeholder}
          aria-invalid={!!errors?.[field.name]}
          className={`input-field ${errors?.[field.name] ? 'border-error focus:border-error focus:ring-error' : ''}`}
        />
        <p className="text-[9px] text-base-content/30 mt-1 pl-1">{field.note}</p>
        {errors?.[field.name] && (
          <p className="text-[10px] text-error font-bold mt-0.5 pl-1" role="alert">{errors[field.name]}</p>
        )}
      </div>
    ))}
  </div>
));
AddressForm.displayName = 'AddressForm';

const CouponInput = React.memo(({ orderTotal, coupon, couponLoading, couponError, onApply, onRemove }) => {
  const [code, setCode] = useState('');

  const handleApply = () => {
    const t = code.trim().toUpperCase();
    if (!t) { toast.error('Enter a coupon code first.'); return; }
    onApply(t, orderTotal);
  };

  if (coupon.code) {
    return (
      <div className="alert alert-success py-2 text-xs" role="status">
        <BadgePercent className="w-4 h-4 shrink-0" />
        <div className="flex-1">
          <p className="font-bold">{coupon.code}</p>
          <p className="text-[10px] opacity-80">You save ₹{coupon.discountAmount?.toFixed(2)}</p>
        </div>
        <button onClick={onRemove} aria-label="Remove coupon" className="btn btn-ghost btn-xs btn-circle hover:bg-error/20 hover:text-error">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/30" />
          <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
                 onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                 placeholder="ENTER COUPON" aria-label="Coupon code"
                 className="input-field pl-9 uppercase tracking-widest" />
        </div>
        <button onClick={handleApply} disabled={couponLoading || !code.trim()}
                className="btn btn-primary shrink-0">
          {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
        </button>
      </div>
      {couponError && (
        <p className="text-[10px] text-error font-bold flex items-center gap-1 pl-1" role="alert">
          <AlertCircle className="w-3 h-3 shrink-0" /> {couponError}
        </p>
      )}
    </div>
  );
});
CouponInput.displayName = 'CouponInput';

const BillSummary = React.memo(({ items, subscriptionDiscount, coupon, deliveryCharge, platformFee, deliveryType }) => {
  // 1. Exact match to backend buildBilling math
  const subTotal = parseFloat(items.reduce((sum, item) => sum + (item.pricePerUnit * item.quantity), 0).toFixed(2));
  const subSavings = parseFloat((subTotal * (subscriptionDiscount / 100)).toFixed(2));
  const couponSaving = coupon?.discountAmount ?? 0;
  
  const totalDiscount = parseFloat((subSavings + couponSaving).toFixed(2));
  const afterAllDiscounts = parseFloat(Math.max(0, subTotal - totalDiscount).toFixed(2));
  const finalTotal = parseFloat((afterAllDiscounts + deliveryCharge + platformFee).toFixed(2));

  // 2. Calculate included GST purely for display (matches backend logic)
  const discountFactor = subTotal > 0 ? afterAllDiscounts / subTotal : 0;
  let estimatedGst = 0;
  items.forEach((item) => {
    const itemTotal = item.pricePerUnit * item.quantity;
    const itemPaidShare = itemTotal * discountFactor;
    const gstPct = item.medicine?.gstPercentage ?? item.gstPercentage ?? 5;
    estimatedGst += (itemPaidShare * gstPct) / (100 + gstPct);
  });

  const rows = [
    { label: 'Items Total',      value: `₹${subTotal.toFixed(2)}`,  highlight: false },
    { label: 'Estimated GST (Included)', value: `₹${estimatedGst.toFixed(2)}`,  highlight: false },
    { label: `Delivery (${deliveryType})`, value: deliveryCharge > 0 ? `₹${deliveryCharge.toFixed(2)}` : 'FREE', highlight: deliveryCharge === 0 },
    { label: 'Platform Fee',     value: `₹${platformFee.toFixed(2)}`, highlight: false },
    ...(subSavings > 0 ? [{ label: `Plan Discount (${subscriptionDiscount}%)`, value: `-₹${subSavings.toFixed(2)}`, highlight: true, isDiscount: true }] : []),
    ...(couponSaving > 0 ? [{ label: `Coupon (${coupon.code})`, value: `-₹${couponSaving.toFixed(2)}`, highlight: true, isDiscount: true }] : []),
  ];

  return (
    <div className="space-y-2" aria-label="Bill summary">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between items-center text-sm">
          <span className="text-base-content/60 font-medium">{row.label}</span>
          <span className={`font-semibold ${row.isDiscount ? 'text-success' : row.highlight ? 'text-success' : 'text-base-content'}`}>{row.value}</span>
        </div>
      ))}
      <div className="border-t border-base-300 pt-3 mt-3 flex justify-between items-center">
        <span className="text-xs font-bold uppercase tracking-wider text-base-content">Total Payable</span>
        <span className="text-xl font-bold text-primary">₹{finalTotal.toFixed(2)}</span>
      </div>
      {(subSavings > 0 || couponSaving > 0) && (
        <p className="text-[10px] font-bold text-success flex items-center gap-1 pt-1">
          <BadgePercent className="w-3 h-3" /> You save ₹{(subSavings + couponSaving).toFixed(2)} on items
        </p>
      )}
    </div>
  );
});
BillSummary.displayName = 'BillSummary';

const bounceVariant = {
  animate: { 
    y: [0, -12, 0], 
    scaleY: [1, 1.02, 0.96, 1],
    transition: { duration: 3, ease: "easeInOut", repeat: Infinity } 
  },
};

const shadowVariant = {
  animate: { 
    scale: [1, 0.8, 1], 
    opacity: [0.3, 0.1, 0.3], 
    transition: { duration: 3, ease: "easeInOut", repeat: Infinity } 
  },
};

const blinkVariant = {
  animate: { 
    scaleY: [1, 1, 0.1, 1, 1], 
    transition: { duration: 4.5, times: [0, 0.45, 0.5, 0.55, 1], repeat: Infinity } 
  },
};

const floatItemVariant = (delay, yOffset, rotate) => ({
  animate: { 
    y: [0, yOffset, 0], 
    rotate: [0, rotate, 0], 
    transition: { duration: 4, ease: "easeInOut", repeat: Infinity, delay: delay } 
  },
});

const EmptyCart = React.memo(({ onShop }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center py-16 sm:py-24 text-center relative overflow-hidden"
    role="status"
  >
    <div className="relative w-64 h-64 mb-6 flex flex-col items-center justify-center">
      <svg width="250" height="250" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="overflow-visible">
        <defs>
          <linearGradient id="bagGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--base-100)" />
            <stop offset="100%" stopColor="var(--base-200)" />
          </linearGradient>
          <linearGradient id="capsuleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        </defs>

        <motion.ellipse
          variants={shadowVariant}
          animate="animate"
          cx="100" cy="180" rx="55" ry="8" fill="currentColor" className="text-base-content/20 origin-[100px_180px]"
        />

        <motion.path 
          variants={floatItemVariant(0.5, -15, 45)} animate="animate" 
          d="M35 60 Q40 60 40 55 Q40 60 45 60 Q40 60 40 65 Q40 60 35 60 Z" 
          fill="var(--warning)" opacity="0.8" className="origin-[40px_60px]"
        />
        
        <motion.path 
          variants={floatItemVariant(1.2, -20, -10)} animate="animate" 
          d="M165 55 C165 45, 150 45, 150 55 C150 70, 165 80, 165 80 C165 80, 180 70, 180 55 C180 45, 165 45, 165 55 Z" 
          fill="var(--error)" opacity="0.8" className="origin-[165px_60px]"
        />

        <motion.g variants={floatItemVariant(0.8, 15, 20)} animate="animate" className="origin-[45px_145px]">
          <rect x="35" y="135" width="20" height="10" rx="5" fill="url(#capsuleGrad)" opacity="0.9" />
          <path d="M45 135 H50 V145 H45 Z" fill="var(--primary)" opacity="0.2" />
        </motion.g>

        <motion.g variants={bounceVariant} animate="animate" className="origin-[100px_170px]">
          
          <path d="M 70 75 C 70 40, 130 40, 130 75" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" className="text-base-300" />
          <rect x="45" y="70" width="110" height="100" rx="28" fill="url(#bagGrad)" stroke="currentColor" strokeWidth="4" className="text-base-300" />
          <path d="M 70 75 C 70 50, 130 50, 130 75" fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" />

          <rect x="80" y="130" width="40" height="28" rx="8" fill="currentColor" className="text-base-100" stroke="var(--primary)" strokeWidth="2" opacity="0.8" />
          <path d="M96 138 h8 v-4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-8 z" fill="var(--success)" opacity="0.7" />

          <ellipse cx="68" cy="115" rx="9" ry="4" fill="var(--error)" opacity="0.25" />
          <ellipse cx="132" cy="115" rx="9" ry="4" fill="var(--error)" opacity="0.25" />

          <motion.g variants={blinkVariant} animate="animate" className="origin-[70px_105px]">
            <circle cx="70" cy="105" r="7" fill="#2d3748" />
            <circle cx="72" cy="103" r="2.5" fill="#ffffff" />
            <circle cx="67" cy="107" r="1" fill="#ffffff" />
          </motion.g>

          <motion.g variants={blinkVariant} animate="animate" className="origin-[130px_105px]">
            <circle cx="130" cy="105" r="7" fill="#2d3748" />
            <circle cx="128" cy="103" r="2.5" fill="#ffffff" />
            <circle cx="133" cy="107" r="1" fill="#ffffff" />
          </motion.g>

          <path d="M 94 115 Q 100 110 106 115" fill="none" stroke="#2d3748" strokeWidth="3" strokeLinecap="round" />
          
          <motion.path 
            animate={{ y: [0, 4, 0], opacity: [0.4, 0.8, 0.4] }} 
            transition={{ duration: 2, repeat: Infinity }}
            d="M 145 85 C 145 80, 148 75, 148 75 C 148 75, 151 80, 151 85 C 151 88, 145 88, 145 85 Z" 
            fill="var(--info)" 
          />

        </motion.g>
      </svg>
    </div>

    <h2 className="section-heading mb-2">Your cart is feeling a bit lonely</h2>
    <p className="section-subheading max-w-sm mb-8">
      Our little pharmacy bag is completely empty! Add some medicines or healthcare products to cheer it up.
    </p>
    
    <button onClick={onShop} className="btn-primary-cta group flex items-center gap-2">
      <ShoppingCart className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" /> Browse Medicines
    </button>
  </motion.div>
));
EmptyCart.displayName = 'EmptyCart';

const CartSkeleton = () => (
  <div className="space-y-3" aria-busy="true">
    {[...Array(3)].map((_, i) => (
      <div key={i} className="card flex gap-4 p-4 skeleton">
        <div className="w-24 h-24 rounded-xl bg-base-200 shrink-0" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-4 bg-base-200 rounded w-2/3" />
          <div className="h-3 bg-base-200 rounded w-1/2" />
          <div className="h-3 bg-base-200 rounded w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

const StepIndicator = React.memo(({ step, onBack, hasRxItems }) => {
  const STEPS = [
    { key: 'cart',         label: 'Cart'     },
    ...(hasRxItems ? [{ key: 'prescription', label: 'Rx Docs' }] : []),
    { key: 'address', label: 'Address' },
    { key: 'payment', label: 'Payment' },
  ];
  const current = STEPS.findIndex((s) => s.key === step);

  return (
    <nav aria-label="Checkout progress" className="flex items-center gap-0 mb-8">
      {STEPS.map((s, idx) => (
        <React.Fragment key={s.key}>
          <button onClick={() => idx < current && onBack(s.key)} disabled={idx >= current}
                  aria-current={idx === current ? 'step' : undefined}
                  className={`flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest transition-all disabled:cursor-default ${
                    idx === current ? 'text-primary' : idx < current ? 'text-success cursor-pointer hover:underline' : 'text-base-content/30'
                  }`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] border ${
              idx < current ? 'bg-success border-success text-white' : idx === current ? 'bg-primary border-primary text-primary-content' : 'bg-transparent border-base-300 text-base-content/30'
            }`}>
              {idx < current ? <CheckCircle2 className="w-3 h-3" /> : idx === current && s.key === 'prescription' ? <FileText className="w-2.5 h-2.5" /> : idx + 1}
            </div>
            {s.label}
          </button>
          {idx < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-3 transition-colors ${idx < current ? 'bg-success' : 'bg-base-300'}`} aria-hidden="true" />
          )}
        </React.Fragment>
      ))}
    </nav>
  );
});
StepIndicator.displayName = 'StepIndicator';

// ═══════════════════════════════════════════════════════════════════════════════
// § MAIN CartPage
// ═══════════════════════════════════════════════════════════════════════════════

export default function CartPage() {
  const dispatch = useDispatch();
  const router   = useRouter();

  // ── Selectors ────────────────────────────────────────────────────────────────
  const cart         = useSelector(selectCart);
  const items        = useSelector(selectCartItems);
  const billSummary  = useSelector(selectCartBillSummary);
  const isLoading    = useSelector(selectPharmacyGlobalLoading);
  const isActing     = useSelector(selectPharmacyActionLoading);
  const currentOrder = useSelector(selectCurrentOrder);
  const orderError   = useSelector(selectOrderError);
  const paymentError = useSelector(selectPaymentError);

  const coupon        = useSelector(selectCoupon);
  const couponLoading = useSelector(selectCouponLoading);
  const couponError   = useSelector(selectCouponError);

  const walletBalance = useSelector(selectWalletBalance);
  const walletData    = useSelector(selectWalletData);

  const rxUploadLoading = useSelector(selectPrescriptionUploadLoading);
  const rxUploadError   = useSelector(selectPrescriptionUploadError);

  const mySub            = useSelector(selectMySubscription);
  const pharmacyDiscount = mySub?.limits?.pharmacyDiscountPercent ?? 0;
  const subscriptionName = useSelector(selectMySubPlanName) ?? '';

  const deliveryPricing        = useSelector(selectDeliveryPricing);
  const deliveryPricingLoading = useSelector(selectDeliveryPricingLoading);

  // ── Local state ───────────────────────────────────────────────────────────────
  const [address,         setAddress]        = useState(DEFAULT_ADDRESS);
  const [addressErrors,   setAddressErrors]  = useState({});
  const [paymentMethod,   setPaymentMethod]  = useState('Razorpay');
  const [deliveryType,    setDeliveryType]   = useState('Standard');
  const [updatingItemId,  setUpdatingItemId] = useState(null);
  const [step,            setStep]           = useState('cart');
  const [showStoreInfo,   setShowStoreInfo]  = useState(false);
  const [slideDir,        setSlideDir]       = useState(1);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [rxModalItem,   setRxModalItem]   = useState(null);
  const [uploadingRxId, setUploadingRxId] = useState(null);
  const [lightboxItem,  setLightboxItem]  = useState(null);

  const addressRef = useRef(null);

  // ── Derived ───────────────────────────────────────────────────────────────────
 
  const rxPresent      = useMemo(() => hasAnyRxItem(items), [items]);
  const missingRxItems = useMemo(() => getMissingRxItems(items), [items]);
  const allRxDone      = useMemo(() => allPrescriptionsUploaded(items), [items]);
  const totalItems     = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);

  // ✅ Compute exact subTotal natively from items (fixes cart bugs)
  const subTotal = useMemo(() => {
    return parseFloat(items.reduce((sum, item) => sum + (item.pricePerUnit * item.quantity), 0).toFixed(2));
  }, [items]);

  // ✅ Pre-coupon total
  const orderTotalForCoupon = useMemo(() => {
    const subSaved = parseFloat((subTotal * (pharmacyDiscount / 100)).toFixed(2));
    return parseFloat(Math.max(0, subTotal - subSaved).toFixed(2));
  }, [subTotal, pharmacyDiscount]);

  // Fetch Delivery Pricing whenever the base cart total changes
  useEffect(() => {
    if (items.length > 0) {
      dispatch(fetchDeliveryPricing({ orderTotal: orderTotalForCoupon, deliveryType: 'Standard' }));
    }
  }, [dispatch, orderTotalForCoupon, items.length]);

  const platformFee = deliveryPricing?.platformFee ?? 5;
  const deliveryCharge = deliveryType === 'Express' 
    ? (deliveryPricing?.delivery?.express?.charge ?? 0)
    : (deliveryPricing?.delivery?.standard?.charge ?? 0);

  // ✅ Exact replica of backend final total
  const finalPayable = useMemo(() => {
    const subSaved = parseFloat((subTotal * (pharmacyDiscount / 100)).toFixed(2));
    const couponSaving = coupon?.discountAmount ?? 0;
    const totalDiscount = parseFloat((subSaved + couponSaving).toFixed(2));
    const afterAllDiscounts = parseFloat(Math.max(0, subTotal - totalDiscount).toFixed(2));

    return parseFloat((afterAllDiscounts + deliveryCharge + platformFee).toFixed(2));
  }, [subTotal, pharmacyDiscount, coupon, deliveryCharge, platformFee]);

  const goToStep = useCallback((next) => {
    setSlideDir(STEP_ORDER[next] > STEP_ORDER[step] ? 1 : -1);
    setStep(next);
  }, [step]);

  // ── Effects ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchCart());
    dispatch(fetchWalletDetails());
    dispatch(clearPharmacyErrors());
  }, [dispatch]);

  useEffect(() => {
    if (currentOrder?.payment?.status === 'Paid' && step !== 'success') {
       goToStep('success');
    }
  }, [currentOrder?.payment?.status, step, goToStep]); 

  useEffect(() => {
    if (items.length === 0 && coupon.code) dispatch(clearCoupon());
  }, [items.length, coupon.code, dispatch]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleAddressChange = useCallback((field, value) => {
    setAddress((p) => ({ ...p, [field]: value }));
    setAddressErrors((p) => ({ ...p, [field]: undefined }));
  }, []);

  const handleQuantityChange = useCallback(async (item, newQty) => {
    if (newQty < 1) return;
    const medicineId = item.medicine?._id ?? item.medicine;
    setUpdatingItemId(medicineId?.toString());
    try { await dispatch(updateCartItem({ medicineId, quantity: newQty })).unwrap(); }
    catch { /* thunk fires toast */ }
    finally { setUpdatingItemId(null); }
  }, [dispatch]);

  const handleRemoveItem = useCallback(async (item) => {
    const medicineId   = item.medicine?._id ?? item.medicine;
    const medicineName = item.medicine?.brandName ?? 'Item';
    setUpdatingItemId(medicineId?.toString());
    try { await dispatch(removeCartItem({ medicineId, medicineName })).unwrap(); }
    catch { /* thunk fires toast */ }
    finally { setUpdatingItemId(null); }
  }, [dispatch]);

  const handleOpenRxModal = useCallback((item) => { setRxModalItem(item); }, []);
  const handleViewRx      = useCallback((item)  => { if (item?.prescription?.imageUrl) setLightboxItem(item); }, []);

  const handleConfirmRxUpload = useCallback(async (item, cdnUrl) => {
    const medicineId = item.medicine?._id ?? item.medicine;
    setUploadingRxId(medicineId?.toString());
    try {
      await dispatch(uploadCartItemPrescription({ medicineId, imageUrl: cdnUrl })).unwrap();
      setRxModalItem(null);
      dispatch(clearPrescriptionUpload());
      toast.success('Prescription saved successfully.');
    } catch (err) {
      throw err; 
    } finally {
      setUploadingRxId(null);
    }
  }, [dispatch]);

  const handleApplyCoupon  = useCallback((code, total) => { dispatch(validateCoupon({ couponCode: code, orderTotal: total })); }, [dispatch]);
  const handleRemoveCoupon = useCallback(() => { dispatch(clearCoupon()); toast.success('Coupon removed.'); }, [dispatch]);

  // ── Step navigation ───────────────────────────────────────────────────────────
  const handleProceedFromCart = useCallback(() => {
    if (!items.length) { toast.error('Your cart is empty.'); return; }
    rxPresent ? goToStep('prescription') : goToStep('address');
  }, [items.length, rxPresent, goToStep]);

  const handleProceedFromPrescription = useCallback(() => {
    if (!allRxDone) toast(`${missingRxItems.length} prescription${missingRxItems.length > 1 ? 's' : ''} missing. Order may be held for verification.`, { icon: '⚠️', duration: 4000 });
    goToStep('address');
  }, [allRxDone, missingRxItems.length, goToStep]);

  const handleProceedToPayment = useCallback(() => {
    const errs = validateAddress(address);
    if (Object.keys(errs).length > 0) { setAddressErrors(errs); toast.error('Please fill all required address fields.'); return; }
    setAddressErrors({});
    goToStep('payment');
  }, [address, goToStep]);

  // ── Place order ───────────────────────────────────────────────────────────────
  const handlePlaceOrder = useCallback(async () => {
    if (paymentMethod === 'Wallet') {
      if (!walletData?.isActive)          { toast.error('Your wallet is inactive.'); return; }
      if (walletBalance < finalPayable)   { toast.error(`Insufficient balance. Available: ₹${walletBalance.toFixed(2)}`); return; }
    }

    setIsProcessingPayment(true);
    
    try {
      const result = await dispatch(checkoutCart({ 
        address, 
        paymentMethod, 
        couponCode: coupon.code ?? undefined,
        deliveryType 
      })).unwrap();
      
      if (paymentMethod === 'COD') { 
        goToStep('success'); 
        setIsProcessingPayment(false);
        return; 
      }
      
      if (paymentMethod === 'Wallet') {
        await dispatch(payViaWallet({ orderId: result.order?._id })).unwrap();
        dispatch(fetchWalletDetails());
        setIsProcessingPayment(false);
        return;
      }

     if (paymentMethod === 'Razorpay') {
        const payableAmt = result.order?.billing?.totalPayable ?? finalPayable;
        if (payableAmt <= 0 || result.isFree) {
          setIsProcessingPayment(false);
          toast.success('Order placed successfully!');
          goToStep('success');
          return;
        }

        let payResp;
        try {
          const loaded = await loadRazorpayScript();
          if (!loaded) {
            throw new Error('Failed to load Razorpay SDK. Please check your connection.');
          }

          payResp = await openRazorpayModal({
            rzpKey: result.razorpayKey || RAZORPAY_KEY,
            rzpOrderId: result.order?.payment?.razorpayOrderId,
            amount: payableAmt,
            prefill: { 
              name: address.fullName || 'Customer', 
              contact: address.phone || '9999999999' 
            }
          });
        } catch (err) {
          setIsProcessingPayment(false);
          if (err.message === 'Payment modal closed by user.') {
            toast('Payment cancelled. Order remains pending.', { icon: 'ℹ️' });
          } else {
            toast.error(err.message || 'Payment failed.');
          }
          return;
        }

        const verificationToast = toast.loading('Verifying your payment...');
        try {
          await dispatch(verifyPayment({
            razorpay_order_id: payResp.razorpay_order_id,
            razorpay_payment_id: payResp.razorpay_payment_id,
            razorpay_signature: payResp.razorpay_signature,
          })).unwrap();
          toast.success('Payment successful!', { id: verificationToast });
          setIsProcessingPayment(false);
          goToStep('success');
        } catch { 
          toast.error('Verification failed. Contact support if amount was deducted.', { id: verificationToast }); 
          setIsProcessingPayment(false);
        }
      }
    } catch { 
      setIsProcessingPayment(false);
    }
  }, [dispatch, address, paymentMethod, deliveryType, coupon.code, walletBalance, walletData, finalPayable, goToStep]);

  // ── Success screen ────────────────────────────────────────────────────────────
  if (step === 'success') {
    const rxStatus   = currentOrder?.prescription?.verificationStatus;
    const rxRequired = currentOrder?.prescription?.isRequired;
    return (
      <main className="min-h-screen bg-base-100 py-20 px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto text-center">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 12, delay: 0.1 }}
            className="w-24 h-24 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-success" />
          </motion.div>
          <h1 className="section-heading mb-2">Order Confirmed!</h1>
          <p className="text-sm font-medium mb-2">Order <strong>#{currentOrder?.orderId}</strong> has been placed.</p>
          <p className="text-xs text-base-content/50 mb-8">A confirmation has been sent to your registered email.</p>
          
          {rxRequired && (
            <div className={`alert mb-4 text-left ${rxStatus === 'Approved' ? 'alert-success' : rxStatus === 'Pending' ? 'alert-warning' : 'alert-error'}`}>
              <FileText className="w-5 h-5 shrink-0" />
              <div>
                <p className="text-xs font-bold">Prescription Status</p>
                <p className="text-[10px] mt-0.5 opacity-80">
                  {rxStatus === 'Approved' ? 'Your prescription has been verified. Order is being processed.'
                    : rxStatus === 'Pending' ? 'Your prescription is pending pharmacist verification.'
                    : 'No prescription uploaded. Our pharmacist may contact you before processing.'}
                </p>
              </div>
            </div>
          )}
          
          <div className="card p-5 text-left mb-8 space-y-3">
            <p className="text-[10px] uppercase font-bold tracking-widest text-base-content/40 mb-2">Order Summary</p>
            {[
              { label: 'Payment Method', value: currentOrder?.payment?.method },
              { label: 'Delivery Type',  value: currentOrder?.delivery?.type || deliveryType },
              { label: 'Amount Paid',    value: `₹${currentOrder?.billing?.totalPayable?.toFixed(2)}`, accent: 'text-primary font-bold' },
              { label: 'Delivery To',    value: `${currentOrder?.delivery?.address?.line1}, ${currentOrder?.delivery?.address?.city}`, truncate: true },
            ].map(({ label, value, accent, truncate }) => (
              <div key={label} className="flex justify-between text-sm">
                <span className="text-base-content/60 font-medium">{label}</span>
                <span className={` ${accent ?? ''} ${truncate ? 'truncate max-w-[180px]' : ''}`}>{value}</span>
              </div>
            ))}
          </div>
          
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => router.push('/pharmacy/orders')}
                    className="btn btn-primary-cta flex items-center gap-2">
              <ReceiptText className="w-4 h-4" /> Track Order
            </button>
            <button onClick={() => router.push('/pharmacy')}
                    className="btn btn-outline flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" /> Continue Shopping
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <Container className="">
      <div className="bg-base-100 min-h-screen pb-24">

        {/* Page header */}
        <header className="bg-base-200/50 border-b border-base-300">
          <div className="container-custom py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black font-montserrat flex items-center gap-2">
                  <BackButton />
                  <ShoppingCart className="w-6 h-6 text-primary" />
                  My Cart
                  {totalItems > 0 && (
                    <span className="badge badge-primary badge-sm" aria-label={`${totalItems} items`}>{totalItems} items</span>
                  )}
                </h1>
                {rxPresent && items.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <FileText className={`w-3.5 h-3.5 ${allRxDone ? 'text-success' : 'text-warning'}`} />
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${allRxDone ? 'text-success' : 'text-warning'}`}>
                      {allRxDone ? 'All prescriptions uploaded' : `${missingRxItems.length} prescription${missingRxItems.length > 1 ? 's' : ''} pending upload`}
                    </span>
                  </div>
                )}
                {cart.store && (
                  <button onClick={() => setShowStoreInfo((v) => !v)}
                          className="flex items-center gap-1 text-[10px] text-base-content/40 font-bold uppercase tracking-wider mt-2 hover:text-primary transition-colors">
                    <Building2 className="w-3.5 h-3.5" />
                    Store: {cart.store?.storeName ?? 'Selected Store'}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showStoreInfo ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
              {items.length > 0 && (
                <button onClick={() => { dispatch(purgeCart()); dispatch(clearCoupon()); }}
                        className="btn btn-ghost btn-sm text-[10px] font-bold uppercase text-error hover:bg-error/10 hover:text-error tracking-wider flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Clear Cart
                </button>
              )}
            </div>

            <AnimatePresence>
              {showStoreInfo && cart.store && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="mt-4 p-4 rounded-xl bg-base-100 border border-base-300 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {cart.store.contact?.phone && <div className="text-xs"><p className="text-base-content/40 font-bold uppercase mb-1">Phone</p><p className="font-semibold">{cart.store.contact.phone}</p></div>}
                    {cart.store.address?.city  && <div className="text-xs"><p className="text-base-content/40 font-bold uppercase mb-1">Location</p><p className="font-semibold">{cart.store.address.city}</p></div>}
                    {cart.store.deliverySettings?.estimatedDeliveryTime && <div className="text-xs"><p className="text-base-content/40 font-bold uppercase mb-1">Est. Delivery</p><p className="font-bold text-success">{cart.store.deliverySettings.estimatedDeliveryTime}</p></div>}
                    {cart.store.status && <div className="text-xs"><p className="text-base-content/40 font-bold uppercase mb-1">Store Status</p><p className={`font-bold ${cart.store.status === 'Open' ? 'text-success' : 'text-error'}`}>{cart.store.status}</p></div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main className="container-custom mt-6">
          {items.length > 0 && step !== 'success' && (
            <StepIndicator step={step} onBack={goToStep} hasRxItems={rxPresent} />
          )}

          {isLoading ? <CartSkeleton /> : items.length === 0 ? <EmptyCart onShop={() => router.push('/pharmacy')} /> : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

              {/* LEFT: step content */}
              <div className="lg:col-span-7 space-y-4">
                <AnimatePresence mode="wait" custom={slideDir}>

                  {/* Step 1 — Cart Items */}
                  {step === 'cart' && (
                    <motion.div key="cart-items" custom={slideDir} variants={slideVariants} initial="enter" animate="center" exit="exit">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[10px] font-bold uppercase tracking-widest text-base-content/40">
                          {items.length} Item{items.length !== 1 ? 's' : ''} in Cart
                        </h2>
                        <button onClick={() => dispatch(fetchCart())}
                                className="btn btn-ghost btn-xs text-primary font-bold flex items-center gap-1 hover:bg-primary/10">
                          <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                      </div>
                      <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-4" role="list">
                        <AnimatePresence>
                          {items.map((item) => {
                            const medicineId = item.medicine?._id ?? item.medicine;
                            return (
                              <CartItem key={medicineId} item={item}
                                onQuantityChange={handleQuantityChange}
                                onRemove={handleRemoveItem}
                                onUploadPrescription={handleOpenRxModal}
                                onViewPrescription={handleViewRx}
                                isUpdating={updatingItemId === medicineId?.toString()}
                              />
                            );
                          })}
                        </AnimatePresence>
                      </motion.div>
                      {/* Coupon section */}
                      <div className="card p-5 mt-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-4 flex items-center gap-1.5">
                          <Tag className="w-4 h-4" /> Have a Coupon?
                        </p>
                        <CouponInput orderTotal={orderTotalForCoupon} coupon={coupon} couponLoading={couponLoading}
                          couponError={couponError} onApply={handleApplyCoupon} onRemove={handleRemoveCoupon} />
                      </div>
                    </motion.div>
                  )}

                  {/* Step 2 — Prescription Upload */}
                  {step === 'prescription' && (
                    <motion.div key="prescription-step" custom={slideDir} variants={slideVariants} initial="enter" animate="center" exit="exit">
                      <PrescriptionStep items={items} onUpload={handleOpenRxModal} onView={handleViewRx} uploadingItemId={uploadingRxId} />
                    </motion.div>
                  )}

                  {/* Step 3 — Address & Delivery */}
                  {step === 'address' && (
                    <motion.div key="address-form" ref={addressRef} custom={slideDir} variants={slideVariants} initial="enter" animate="center" exit="exit"
                                className="card p-6">
                      <div className="flex items-center gap-2 mb-6 border-b border-base-300 pb-4">
                        <MapPin className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold font-montserrat">Delivery Details</h2>
                      </div>
                      
                      <AddressForm address={address} onChange={handleAddressChange} errors={addressErrors} />

                      {/* Delivery Speed Selection */}
                      <div className="pt-6 mt-6 border-t border-base-200">
                        <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-base-content/50 mb-3">
                          <Truck className="w-3 h-3 text-primary/60" /> Delivery Speed
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            deliveryType === 'Standard' ? 'border-primary bg-primary/5' : 'border-base-200 hover:border-primary/30 hover:bg-base-200/50'
                          }`}>
                            <input type="radio" name="deliverySpeed" value="Standard" checked={deliveryType === 'Standard'} onChange={() => setDeliveryType('Standard')} className="hidden" />
                            <span className="text-xs font-black text-base-content">Standard</span>
                            <span className="text-[10px] font-semibold text-base-content/50 uppercase mt-1">2-4 Days</span>
                            <span className="text-[11px] font-black text-primary mt-1">
                              {deliveryPricing?.delivery?.standard?.isFree ? 'FREE' : `₹${deliveryPricing?.delivery?.standard?.charge ?? 0}`}
                            </span>
                            {deliveryType === 'Standard' && <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-primary" />}
                          </label>

                          <label className={`relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            deliveryType === 'Express' ? 'border-primary bg-primary/5' : 'border-base-200 hover:border-primary/30 hover:bg-base-200/50'
                          }`}>
                            <input type="radio" name="deliverySpeed" value="Express" checked={deliveryType === 'Express'} onChange={() => setDeliveryType('Express')} className="hidden" />
                            <span className="text-xs font-black text-base-content flex items-center gap-1"><Zap className="w-3 h-3 text-warning fill-warning" /> Express</span>
                            <span className="text-[10px] font-semibold text-base-content/50 uppercase mt-1">same day / next day</span>
                            <span className="text-[11px] font-black text-primary mt-1">
                              {deliveryPricing?.delivery?.express?.isFree ? 'FREE' : `₹${deliveryPricing?.delivery?.express?.charge ?? 49}`}
                            </span>
                            {deliveryType === 'Express' && <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-primary" />}
                          </label>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Step 4 — Payment Method */}
                  {step === 'payment' && (
                    <motion.div key="payment-method" custom={slideDir} variants={slideVariants} initial="enter" animate="center" exit="exit" className="space-y-4">
                      <h2 className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-2">Select Payment Method</h2>
                      <div role="radiogroup" aria-label="Payment method options" className="space-y-4">
                        {PAYMENT_METHODS.map((pm) => {
                          const Icon = pm.icon;
                          const isDisabled = pm.id === 'Wallet' && !walletData?.isActive;
                          const isSelected = paymentMethod === pm.id;
                          return (
                            <button key={pm.id} role="radio" aria-checked={isSelected}
                                    onClick={() => !isDisabled && setPaymentMethod(pm.id)}
                                    disabled={isDisabled}
                                    className={`w-full flex items-center gap-4 p-5 rounded-xl border-2 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed ${isSelected ? pm.bg : 'bg-base-100 border-base-300 hover:border-base-content/20'}`}>
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-white/50' : 'bg-base-200'}`}>
                                <Icon className={`w-6 h-6 ${isSelected ? pm.color : 'text-base-content/40'}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-base-content">{pm.label}</p>
                                <p className="text-[11px] text-base-content/50 mt-0.5">
                                  {pm.id === 'Wallet' && !walletData?.isActive ? 'Wallet is currently inactive' : pm.sub}
                                </p>
                              </div>
                              {pm.id === 'Wallet' && walletData?.isActive && (
                                <div className="text-right shrink-0">
                                  <p className="text-[9px] text-base-content/40 font-bold uppercase">Balance</p>
                                  <p className={`text-sm font-bold mt-0.5 ${walletBalance >= finalPayable ? 'text-success' : 'text-error'}`}>₹{walletBalance.toFixed(2)}</p>
                                </div>
                              )}
                              {isSelected && <CheckCircle2 className={`w-5 h-5 shrink-0 ${pm.color}`} />}
                            </button>
                          );
                        })}
                      </div>
                      {paymentMethod === 'Wallet' && walletData?.isActive && walletBalance < finalPayable && (
                        <div className="alert alert-warning text-xs py-2 mt-4" role="alert">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span className="font-bold">Insufficient balance. Top up ₹{(finalPayable - walletBalance).toFixed(2)} more.</span>
                        </div>
                      )}
                      {(orderError || paymentError) && (
                        <div className="alert alert-error text-xs py-2 mt-4" role="alert">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span className="font-bold">{orderError ?? paymentError}</span>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* RIGHT: Summary sidebar */}
              <div className="lg:col-span-5">
                <div className="sticky top-28 space-y-5">

               <section className="glass-card p-6" aria-label="Bill summary">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-base-content/40 mb-5 flex items-center gap-1.5">
                      <ReceiptText className="w-4 h-4" /> Bill Summary
                    </h2>
                    <BillSummary 
                      items={items} // ✅ Changed this line
                      subscriptionDiscount={pharmacyDiscount} 
                      coupon={coupon} 
                      paymentMethod={paymentMethod} 
                      deliveryCharge={deliveryCharge}
                      platformFee={platformFee}
                      deliveryType={deliveryType}
                      deliveryPricing={deliveryPricing}
                    />
                  </section>

                  {rxPresent && (
                    <div className={`alert ${allRxDone ? 'alert-success' : 'alert-warning'}`} role="note">
                      <FileText className="w-5 h-5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider">
                          Prescription {allRxDone ? 'Ready' : 'Required'}
                        </p>
                        <p className="text-xs opacity-80 mt-1">
                          {allRxDone ? 'All required prescriptions have been uploaded.' : `${missingRxItems.length} item${missingRxItems.length > 1 ? 's' : ''} still need a prescription.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {coupon.code && (
                    <div className="alert alert-success" role="note">
                      <BadgePercent className="w-5 h-5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider">Coupon Applied</p>
                        <p className="text-xs opacity-80 mt-1 truncate"><strong>{coupon.code}</strong> — saving ₹{coupon.discountAmount?.toFixed(2)}</p>
                      </div>
                      <button onClick={handleRemoveCoupon} aria-label="Remove coupon" className="btn btn-ghost btn-sm btn-circle hover:bg-error/20 hover:text-error shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {pharmacyDiscount > 0 && (
                    <div className="alert alert-success" role="note">
                      <Star className="w-5 h-5 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider">{subscriptionName} Benefit</p>
                        <p className="text-xs opacity-80 mt-1">{pharmacyDiscount}% discount applied automatically.</p>
                      </div>
                    </div>
                  )}

                  {/* Trust badges */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: ShieldCheck, text: 'Authentic Medicines' },
                      { icon: Truck,       text: 'Fast Delivery'       },
                      { icon: HeartPulse,  text: 'Pharmacist Verified' },
                      { icon: Zap,         text: 'Secure Payments'     },
                    ].map(({ icon: Icon, text }) => (
                      <div key={text} className="flex items-center gap-2 p-3 rounded-lg bg-base-200/60 border border-base-300">
                        <Icon className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-[10px] font-bold text-base-content/60">{text}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA buttons */}
                  <div className="space-y-3 pt-2">
                    {step === 'cart' && (
                      <button onClick={handleProceedFromCart}
                              className="btn btn-primary-cta w-full">
                        {rxPresent ? 'Add Prescriptions' : 'Proceed to Address'}
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </button>
                    )}
                    {step === 'prescription' && (
                      <div className="flex gap-3">
                        <button onClick={() => goToStep('cart')} className="btn btn-outline border-base-300 text-base-content">Back</button>
                        <button onClick={handleProceedFromPrescription}
                                className="btn btn-primary-cta flex-1">
                          {allRxDone ? 'Proceed to Address' : 'Skip & Continue'} <ArrowRight className="w-4 h-4 ml-1" />
                        </button>
                      </div>
                    )}
                    {step === 'address' && (
                      <div className="flex gap-3">
                        <button onClick={() => goToStep(rxPresent ? 'prescription' : 'cart')} className="btn btn-outline border-base-300 text-base-content">Back</button>
                        <button onClick={handleProceedToPayment}
                                className="btn btn-primary-cta flex-1">
                          Select Payment <ArrowRight className="w-4 h-4 ml-1" />
                        </button>
                      </div>
                    )}
                    {step === 'payment' && (
                      <div className="flex gap-3">
                        <button onClick={() => goToStep('address')} className="btn btn-outline border-base-300 text-base-content" disabled={isProcessingPayment}>Back</button>
                        <button onClick={handlePlaceOrder}
                                disabled={isActing || isProcessingPayment || deliveryPricingLoading || (paymentMethod === 'Wallet' && (!walletData?.isActive || walletBalance < finalPayable))}
                                className="btn btn-primary-cta flex-1">
                          {(isActing || isProcessingPayment)
                            ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Processing…</>
                            : <><CreditCard className="w-4 h-4 mr-1" />{paymentMethod === 'COD' ? 'Place Order' : paymentMethod === 'Wallet' ? 'Pay via Wallet' : `Pay ₹${finalPayable.toFixed(2)}`}</>}
                        </button>
                      </div>
                    )}
                    <button onClick={() => router.push('/pharmacy')}
                            className="btn btn-ghost w-full text-[10px] font-bold text-base-content/40 hover:text-primary transition-colors py-2 uppercase tracking-wider">
                      ← Continue Shopping
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}
        </main>

        <section className="mt-16">
          <Banner position="Checkout_Bottom" />
        </section>
      </div>

      {/* Prescription Upload Modal */}
      <AnimatePresence>
        {rxModalItem && (
          <PrescriptionUploadModal
            item={rxModalItem}
            onConfirm={handleConfirmRxUpload}
            onClose={() => { if (!rxUploadLoading && !uploadingRxId) setRxModalItem(null); }}
            isUploading={rxUploadLoading || uploadingRxId === (rxModalItem?.medicine?._id ?? rxModalItem?.medicine)?.toString()}
          />
        )}
      </AnimatePresence>

      {/* Prescription Lightbox (View) */}
      <AnimatePresence>
        {lightboxItem?.prescription?.imageUrl && (
          <RxLightbox
            imageUrl={lightboxItem.prescription.imageUrl}
            medicineName={lightboxItem.medicine?.brandName}
            onClose={() => setLightboxItem(null)}
          />
        )}
      </AnimatePresence>
    </Container>
  );
}