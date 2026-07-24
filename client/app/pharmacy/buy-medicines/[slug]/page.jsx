'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pill,
  Package,
  Tag,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Beaker,
  Syringe,
  Wind,
  Droplets,
  Layers,
  FlaskConical,
  Share2,
  Printer,
  Maximize2,
  X,
  ChevronRight,
  ShoppingCart,
  UploadCloud,
  CheckCheck,
  Building2,
  BookOpen,
  AlertTriangle,
  Ban,
  Minus,
  Plus,
  Clock,
  Star,
  Thermometer,
  Hash,
  Percent,
  RefreshCw,
  ArrowLeft,
  Info,
  HeartPulse,
  Loader2,
  Receipt,
  TrendingDown,
  IndianRupee,
  Boxes,
  MapPin,
  Truck,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Container from '@/components/ui/Container';
import { selectMySubscription, selectMySubPlanName } from '@/store/slices/subscriptionSlice';

import {
  fetchMedicineBySlug,
  clearMedicineDetail,
  selectMedicineDetail,
  selectMedicineLoading,
  selectMedicineError,
} from '@/store/slices/medicineSlice';
import { fetchWalletDetails } from '@/store/slices/walletSlice';
import {
  fetchSimilarMedicines,
  selectSimilarMedicines,
  selectSimilarMedicinesLoading,
  addToCart,
  clearCurrentOrder,
  clearCoupon,
} from '@/store/slices/pharmacyOrderSlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';
import { selectUser } from '@/store/slices/userSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_ICONS = {
  Tablet: Pill,
  Capsule: FlaskConical,
  Syrup: Beaker,
  Injection: Syringe,
  Ointment: Package,
  Drops: Droplets,
  Inhaler: Wind,
  Powder: Layers,
};

const SCHEDULE_META = {
  H: {
    label: 'Schedule H',
    colorClass: 'badge-error',
    desc: 'Sold only on prescription of Registered Medical Practitioner.',
  },
  H1: {
    label: 'Schedule H1',
    colorClass: 'badge-error',
    desc: 'Dangerous drug — sold on Rx only. Sales must be recorded for 3 years.',
  },
  G: {
    label: 'Schedule G',
    colorClass: 'badge-warning',
    desc: 'Caution: Take only under medical supervision.',
  },
  X: {
    label: 'Schedule X',
    colorClass: 'badge-error',
    desc: 'Narcotic/Psychotropic substance. Requires special Rx and record-keeping.',
  },
  None: {
    label: 'OTC',
    colorClass: 'badge-success',
    desc: 'Over-the-counter. No prescription required.',
  },
};

const TABS = ['Overview', 'Composition', 'Safety', 'Pricing', 'Legal'];

// ─── Utilities ────────────────────────────────────────────────────────────────

const getBestInventory = (storeInventory = []) =>
  storeInventory.find((inv) => (inv.availableStock ?? inv.stockQuantity) > 0) ??
  storeInventory[0] ??
  null;

const extractStoreId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object' && value._id) return value._id.toString();
  if (typeof value === 'object' && value.$oid) return value.$oid.toString();
  return value.toString();
};

const fmt = (n) =>
  typeof n === 'number' ? n.toFixed(2) : parseFloat(n || 0).toFixed(2);

const pct = (base, percent) =>
  parseFloat(((base * percent) / 100).toFixed(2));

// ─── Shared Components ────────────────────────────────────────────────────────

const IconTooltip = memo(function IconTooltip({ label, className, children }) {
  return (
    <div className={`relative group/tip inline-flex ${className || ""}`}>
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className="pointer-events-none capitalize absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-bold shadow-lg opacity-0 scale-90 translate-y-[-2px] transition-all duration-150 z-[130] group-hover/tip:opacity-100 group-hover/tip:scale-100 group-hover/tip:translate-y-0 bg-base-content text-base-100"
      >
        {label}
      </span>
    </div>
  );
});

// ─── ImageGallery ─────────────────────────────────────────────────────────────

const ImageGallery = React.memo(({ images, activeIdx, onIdxChange, onOpenFull }) => {
  const containerRef = useRef(null);
  const thumbsRef = useRef(null);
  const [lensPos, setLensPos] = useState({ x: 0, y: 0 });
  const [zoomPos, setZoomPos] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const LENS = 130;
  const ZOOM = 2.8;

  useEffect(() => {
    if (!thumbsRef.current) return;
    const el = thumbsRef.current.children[activeIdx];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeIdx]);

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const safeWidth = Math.max(1, rect.width - LENS);
    const safeHeight = Math.max(1, rect.height - LENS);
    const lx = Math.max(LENS / 2, Math.min(rect.width - LENS / 2, x));
    const ly = Math.max(LENS / 2, Math.min(rect.height - LENS / 2, y));
    setLensPos({ x: lx, y: ly });
    setZoomPos({
      x: ((lx - LENS / 2) / safeWidth) * 100,
      y: ((ly - LENS / 2) / safeHeight) * 100,
    });
  }, []);

  const currentSrc = images?.[activeIdx]?.url ?? null;

  if (!images?.length) {
    return (
      <div className="aspect-square rounded-2xl bg-base-200 flex items-center justify-center border border-base-300">
        <Pill className="w-20 h-20 text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          className="relative aspect-square rounded-2xl overflow-hidden bg-base-100 border border-base-300 cursor-crosshair select-none shadow-sm"
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={activeIdx}
              src={currentSrc}
              alt="Medicine product"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full object-contain p-6"
            />
          </AnimatePresence>

          {hovering && (
            <div
              aria-hidden="true"
              className="absolute hidden lg:block border rounded-field border-primary/40 bg-primary/10 pointer-events-none z-20"
              style={{
                width: LENS,
                height: LENS,
                left: lensPos.x - LENS / 2,
                top: lensPos.y - LENS / 2,
              }}
            />
          )}

          <IconTooltip label="Fullscreen" className="absolute top-4 right-4 z-30">
            <button
              onClick={onOpenFull}
              aria-label="Open fullscreen image"
              className="btn btn-ghost p-2 cursor-pointer"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </IconTooltip>
        </div>

        <AnimatePresence>
          {hovering && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute top-0 w-full h-full rounded-2xl overflow-hidden border border-base-300 bg-base-100 bg-no-repeat hidden lg:block shadow-depth-lg z-[100] left-[105%]"
              style={{
                backgroundImage: `url(${currentSrc})`,
                backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                backgroundSize: `${ZOOM * 100}%`,
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <div
          ref={thumbsRef}
          className="flex gap-2 overflow-x-auto p-1 pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => onIdxChange(i)}
              aria-label={`View image ${i + 1}`}
              className={`shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${i === activeIdx ? 'border-primary opacity-100 scale-105' : 'border-base-300 opacity-60 scale-100'}`}
            >
              <img
                src={img.url}
                className="w-full h-full object-cover bg-base-100"
                alt={`thumbnail ${i + 1}`}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
});
ImageGallery.displayName = 'ImageGallery';

// ─── InfoBox ──────────────────────────────────────────────────────────────────

const InfoBox = React.memo(({ icon: Icon, label, value, accent = false }) => (
  <div
    className={`flex items-center gap-3 p-4 rounded-xl border ${accent ? 'bg-primary/10 border-primary/30' : 'bg-base-200 border-base-300'}`}
  >
    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-black uppercase tracking-widest text-base-content/50">
        {label}
      </p>
      <p className="text-sm font-bold text-base-content truncate">{value || '—'}</p>
    </div>
  </div>
));
InfoBox.displayName = 'InfoBox';

// ─── SafetyCard ───────────────────────────────────────────────────────────────

const SafetyCard = React.memo(({ title, list = [], icon: Icon, variant }) => {
  const isError = variant === 'error';
  return (
    <div
      className={`p-5 rounded-xl border-2 ${isError ? 'text-error border-error/30 bg-error/10' : 'text-warning border-warning/30 bg-warning/10'}`}
    >
      <h5 className="flex items-center gap-2 font-black text-xs uppercase tracking-widest mb-3">
        <Icon className="w-4 h-4" />
        {title}
      </h5>
      {list.length === 0 ? (
        <p className="text-xs italic text-base-content/60">
          None listed.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((item, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-lg text-xs font-bold border bg-base-100/70 border-current opacity-90"
            >
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
});
SafetyCard.displayName = 'SafetyCard';

// ─── StockBadge ───────────────────────────────────────────────────────────────

const StockBadge = React.memo(({ storeInventory }) => {
  const best = getBestInventory(storeInventory);
  const totalStock = (storeInventory ?? []).reduce(
    (s, i) => s + (i.availableStock ?? i.stockQuantity ?? 0),
    0
  );
  const isLow = best?.isLowStock || (totalStock > 0 && totalStock < 10);
  const isOut = totalStock === 0;

  if (isOut)
    return (
      <span className="badge badge-error text-error">
        Out of Stock
      </span>
    );
  if (isLow)
    return (
      <span className="badge badge-warning flex items-center gap-1 text-warning">
        <AlertTriangle className="w-3 h-3" />
        Low Stock ({totalStock} left)
      </span>
    );
  return (
    <span className="badge badge-success flex items-center gap-1 text-success">
      <CheckCircle2 className="w-3 h-3" />
      In Stock ({totalStock} units)
    </span>
  );
});
StockBadge.displayName = 'StockBadge';

// ─── PricingRow ───────────────────────────────────────────────────────────────

const PricingRow = React.memo(({ label, value, sub, highlight, strike, green, muted, large }) => (
  <div
    className={`flex items-center justify-between py-2 ${highlight ? 'border-b-0' : 'border-b border-base-300/60'}`}
  >
    <span className={`text-sm font-medium ${large ? 'text-base font-black' : ''} ${muted ? 'text-base-content/50' : 'text-base-content'}`}>
      {label}
      {sub && (
        <span className="ml-1 text-xs text-base-content/50">
          {sub}
        </span>
      )}
    </span>
    <span
      className={`text-sm font-bold ${large ? 'text-lg font-black' : ''} ${green ? 'text-success' : highlight ? 'text-primary' : 'text-base-content'} ${strike ? 'line-through opacity-45' : 'no-underline opacity-100'}`}
    >
      {value}
    </span>
  </div>
));
PricingRow.displayName = 'PricingRow';

// ─── StoreInventoryCard ───────────────────────────────────────────────────────

const StoreInventoryCard = React.memo(({ inv }) => {
  const store = inv.storeId;
  const storeName = typeof store === 'object' ? store?.storeName : 'Store';
  const storeType = typeof store === 'object' ? store?.storeType : '';
  const city = typeof store === 'object' ? store?.address?.city ?? '' : '';
  const canDeliver = typeof store === 'object' ? store?.deliverySettings?.canDeliver : false;
  const express = typeof store === 'object' ? store?.deliverySettings?.expressDelivery : false;
  const stock = inv.availableStock ?? inv.stockQuantity ?? 0;
  const pb = inv.pricingBreakdown;
  const batch = inv.batchId;
  const batchNo = typeof batch === 'object' ? batch?.batchNumber : batch;
  const expiry =
    typeof batch === 'object' && batch?.expiryDate
      ? new Date(batch.expiryDate).toLocaleDateString('en-IN', {
          month: 'short',
          year: 'numeric',
        })
      : null;

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 bg-base-200">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-base-content truncate">{storeName}</p>
            <p className="text-xs font-medium text-base-content/50">
              {city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{city}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {storeType && (
            <span className={`badge badge-xs border-none ${storeType === 'Owned' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
              {storeType}
            </span>
          )}
          {canDeliver && (
            <span className="badge badge-xs badge-success ">
              <Truck className="w-2.5 h-2.5 mr-0.5" />
              Delivers
            </span>
          )}
          {express && (
            <span className="badge badge-xs badge-warning ">
              <Zap className="w-2.5 h-2.5 mr-0.5" />
              Express
            </span>
          )}
          <span className={`badge badge-xs border-none ${stock === 0 ? 'bg-error/10 text-error' : stock < 20 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}`}>
            {stock} units
          </span>
        </div>
      </div>

      {/* Pricing Breakdown */}
      {pb && (
        <div className="px-5 py-4 space-y-1">
          <p className="text-xs font-black uppercase tracking-widest mb-3 text-base-content/40">
            Pricing at this store
          </p>
          <PricingRow label="MRP" value={`₹${fmt(pb.mrp)}`} muted />
          <PricingRow
            label="Store Selling Price"
            value={`₹${fmt(pb.sellingPrice)}`}
          />
          {pb.discountPercent > 0 && (
            <PricingRow
              label="Store Discount"
              sub={`(${pb.discountPercent}%)`}
              value={`-₹${fmt((pb.sellingPrice * pb.discountPercent) / 100)}`}
              green
            />
          )}
<PricingRow
            label="Final Price"
            value={`₹${fmt(pb.finalPrice)}`}
            highlight
            large
          />
          {pb.note && (
            <p className="text-xs mt-2 italic text-base-content/50">
              {pb.note}
            </p>
          )}
        </div>
      )}

      {/* Batch Info */}
      {(batchNo || expiry) && (
        <div className="flex flex-wrap gap-4 px-5 py-3 border-t border-base-300 bg-base-200/50">
          {batchNo && (
            <span className="text-xs font-medium flex items-center gap-1 text-base-content/60">
              <Hash className="w-3 h-3" />
              Batch: <strong className="text-base-content ml-1">{batchNo}</strong>
            </span>
          )}
          {expiry && (
            <span className="text-xs font-medium flex items-center gap-1 text-base-content/60">
              <Clock className="w-3 h-3" />
              Expiry: <strong className="text-base-content ml-1">{expiry}</strong>
            </span>
          )}
          {inv.rackLocation && (
            <span className="text-xs font-medium flex items-center gap-1 text-base-content/60">
              <Boxes className="w-3 h-3" />
              <strong className="text-base-content">{inv.rackLocation}</strong>
            </span>
          )}
        </div>
      )}
    </div>
  );
});
StoreInventoryCard.displayName = 'StoreInventoryCard';

// ─── PurchasePricingPanel ─────────────────────────────────────────────────────

const PurchasePricingPanel = React.memo(({
  med,
  bestInv,
  quantity,
  subscriptionDiscount,
  subscriptionPlanName,
}) => {
  const mrpUnit = bestInv?.mrp ?? med?.referenceMrp ?? 0;
  const storeUnit = bestInv?.finalPrice ?? bestInv?.sellingPrice ?? mrpUnit;
  const storeDscPct = bestInv?.discountPercent ?? 0;
  const gstPct = med?.gstPercentage ?? 5;

  const mrpTotal = mrpUnit * quantity;
  const storeTotal = storeUnit * quantity;
  const storeSaving = mrpTotal - storeTotal;

  const subDiscount = subscriptionDiscount > 0 ? pct(storeTotal, subscriptionDiscount) : 0;
  const baseTotal = storeTotal - subDiscount;

  // GST is inclusive in finalPrice — extract it
  const gstIncluded = parseFloat(((baseTotal * gstPct) / (100 + gstPct)).toFixed(2));
  const baseExGst = baseTotal - gstIncluded;

  const totalSaving = storeSaving + subDiscount;
  const savingPct = mrpTotal > 0 ? ((totalSaving / mrpTotal) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      {/* Main price display */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-widest mb-1 text-base-content/50">
            You Pay
          </p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-black tracking-tight text-primary text-5xl leading-none">
              ₹{fmt(baseTotal)}
            </span>
            {mrpTotal > baseTotal && (
              <div className="flex flex-col">
                <span className="text-base font-bold line-through text-base-content/40">
                  ₹{fmt(mrpTotal)}
                </span>
                <span className="text-xs font-black text-success">
                  {savingPct}% off
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Savings pill */}
        {totalSaving > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl border shrink-0 bg-success/10 border-success/30">
            <TrendingDown className="w-4 h-4 text-success" />
            <div>
              <p className="text-xs font-black text-success">You Save</p>
              <p className="text-sm font-black text-success">₹{fmt(totalSaving)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Breakdown table */}
      <div className="rounded-2xl border p-5 space-y-0 bg-base-200/40 border-base-300">
        <PricingRow
          label="MRP"
          sub={`× ${quantity} unit${quantity > 1 ? 's' : ''}`}
          value={`₹${fmt(mrpTotal)}`}
          muted
          strike={mrpTotal > storeTotal}
        />
        {storeDscPct > 0 && (
          <PricingRow
            label="Store Discount"
            sub={`(${storeDscPct}%)`}
            value={`-₹${fmt(storeSaving)}`}
            green
          />
        )}
        {subscriptionDiscount > 0 && (
          <PricingRow
            label={`${subscriptionPlanName || 'Plan'} Discount`}
            sub={`(${subscriptionDiscount}%)`}
            value={`-₹${fmt(subDiscount)}`}
            green
          />
        )}
        <PricingRow label="Delivery" value="FREE" green />
        <div className="pt-3 mt-1 border-t-2 border-base-300">
          <PricingRow
            label="Total Payable"
            value={`₹${fmt(baseTotal)}`}
            highlight
            large
          />
        </div>
        <div className="pt-2 mt-1 border-t border-dashed border-base-300/60">
          <PricingRow
            label="Incl. GST"
            sub={`(${gstPct}% inclusive)`}
            value={`₹${fmt(gstIncluded)}`}
            muted
          />
        </div>
      </div>

      {/* Per unit info */}
      <p className="text-xs font-medium flex items-center gap-1.5 text-base-content/50">
        <Tag className="w-3.5 h-3.5 text-primary opacity-60" />
        Unit price: ₹{fmt(storeUnit)} / {med?.packUnit || 'unit'} · MRP: ₹{fmt(mrpUnit)}
      </p>
    </div>
  );
});
PurchasePricingPanel.displayName = 'PurchasePricingPanel';

// ─── SubscriptionBanner ───────────────────────────────────────────────────────

const SubscriptionBanner = React.memo(({ discount, planName }) => {
  if (!discount || discount === 0) return null;
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border mb-4 bg-success/10 border-success/30">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-success/20">
        <Star className="w-5 h-5 text-success fill-success" />
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-success">
          {planName} Benefit Applied
        </p>
        <p className="text-sm text-base-content font-medium mt-0.5">
          You save <strong className="text-success">{discount}%</strong> with your active plan.
        </p>
      </div>
    </div>
  );
});
SubscriptionBanner.displayName = 'SubscriptionBanner';

// ─── PrescriptionUploader ─────────────────────────────────────────────────────

const PrescriptionUploader = React.memo(({
  prescriptionUrl,
  isUploading,
  onUpload,
  showRequiredError = false,
}) => (
  <div
    className={`p-5 rounded-xl border-2 border-dashed transition-all ${prescriptionUrl ? 'border-success bg-success/10' : showRequiredError ? 'border-error bg-error/10 animate-pulse' : 'border-warning/50 bg-warning/10'}`}
  >
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-4 w-full">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm shrink-0 ${prescriptionUrl ? 'bg-success text-success-content' : 'bg-warning text-warning-content'}`}>
          {isUploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : prescriptionUrl ? (
            <CheckCheck className="w-6 h-6" />
          ) : (
            <UploadCloud className="w-6 h-6" />
          )}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-black text-base-content flex items-center gap-2">
            Prescription Required
            {!prescriptionUrl && (
              <span className="text-xs font-black px-2 py-0.5 rounded-md uppercase tracking-wider bg-warning/20 text-warning">
                Required
              </span>
            )}
          </h4>
          <p className="text-xs mt-0.5 font-medium text-base-content/60">
            {prescriptionUrl
              ? 'Prescription uploaded. You can replace it if needed.'
              : showRequiredError
              ? 'Upload a valid Rx before adding to cart.'
              : 'Upload a valid Rx from a licensed doctor to proceed.'}
          </p>
          {prescriptionUrl && (
            <a
              href={prescriptionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold mt-1.5 inline-block text-primary cursor-pointer hover:underline"
            >
              View uploaded prescription ↗
            </a>
          )}
        </div>
      </div>

      <label
        className={`btn btn-sm shrink-0 w-full sm:w-auto ${isUploading ? 'bg-base-200 text-base-content cursor-not-allowed' : prescriptionUrl ? 'bg-base-300 text-base-content cursor-pointer' : 'btn-primary cursor-pointer'}`}
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
          </span>
        ) : prescriptionUrl ? (
          'Replace Rx'
        ) : (
          <span className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4" /> Upload Rx
          </span>
        )}
        <input
          type="file"
          className="hidden peer"
          onChange={onUpload}
          accept="image/*,application/pdf"
          disabled={isUploading}
        />
      </label>
    </div>
  </div>
));
PrescriptionUploader.displayName = 'PrescriptionUploader';

// ─── QuantitySelector ─────────────────────────────────────────────────────────

const QuantitySelector = React.memo(({ quantity, onDecrement, onIncrement, max }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={onDecrement}
      disabled={quantity <= 1}
      aria-label="Decrease quantity"
      className="btn btn-sm btn-circle bg-base-200 border border-base-300 cursor-pointer disabled:cursor-not-allowed"
    >
      <Minus className="w-4 h-4" />
    </button>
    <span className="w-12 text-center text-lg font-black text-base-content">{quantity}</span>
    <button
      onClick={onIncrement}
      disabled={max !== undefined && quantity >= max}
      aria-label="Increase quantity"
      className="btn btn-sm btn-circle bg-base-200 border border-base-300 cursor-pointer disabled:cursor-not-allowed"
    >
      <Plus className="w-4 h-4" />
    </button>
  </div>
));
QuantitySelector.displayName = 'QuantitySelector';

// ─── FullscreenZoomModal ──────────────────────────────────────────────────────

const FullscreenZoomModal = React.memo(({ images, activeIdx, onIdxChange, onClose, brandName }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIdxChange((i) => Math.min(i + 1, images.length - 1));
      if (e.key === 'ArrowLeft') onIdxChange((i) => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onIdxChange, images.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex flex-col no-print bg-base-100 z-[9999]"
      role="dialog"
      aria-modal="true"
      aria-label={`${brandName} image viewer`}
    >
      <div className="flex items-center justify-between px-6 py-4 shadow-sm border-b border-base-300 bg-base-100">
        <span className="text-base font-black text-base-content">{brandName} — HD View</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScale((s) => Math.max(s - 0.5, 1))}
            className="btn btn-sm cursor-pointer"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold w-12 text-center text-base-content/50">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(s + 0.5, 5))}
            className="btn btn-sm cursor-pointer"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => { onClose(); setScale(1); }}
            className="btn btn-sm btn-error ml-2 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-base-100">
        <motion.img
          src={images[activeIdx]?.url}
          animate={{ scale }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="max-w-full max-h-full object-contain cursor-zoom-in"
          onDoubleClick={() => setScale((s) => (s === 1 ? 2.5 : 1))}
          alt={`${brandName} zoom`}
          draggable={false}
        />
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-3 p-4 overflow-x-auto border-t border-base-300 bg-base-100">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { onIdxChange(i); setScale(1); }}
              className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${i === activeIdx ? 'border-primary opacity-100' : 'border-transparent opacity-50'}`}
            >
              <img src={img.url} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-xs font-bold uppercase tracking-widest py-3 text-base-content/40">
        Double-click to zoom · Arrow keys to navigate
      </p>
    </motion.div>
  );
});
FullscreenZoomModal.displayName = 'FullscreenZoomModal';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MedicineDetails() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { slug } = useParams();

  const user = useSelector(selectUser);

  const [cartState, setCartState] = useState('idle'); // 'idle' | 'adding' | 'success'

  const med = useSelector(selectMedicineDetail);
  const medLoading = useSelector(selectMedicineLoading);
  const medError = useSelector(selectMedicineError);
  const similarMedicines = useSelector(selectSimilarMedicines);
  const similarMedicinesLoading = useSelector(selectSimilarMedicinesLoading);

  const mySub = useSelector(selectMySubscription);
  const subscriptionDiscount = mySub?.limits?.pharmacyDiscountPercent ?? 0;
  const subscriptionPlanName = useSelector(selectMySubPlanName) ?? '';

  const [activeTab, setActiveTab] = useState('overview');
  const [imgIdx, setImgIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [prescriptionUrl, setPrescriptionUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [rxHighlight, setRxHighlight] = useState(false);

  const isPageLoading = medLoading || (!med && !medError);

  useEffect(() => {
    if (slug) {
      dispatch(fetchMedicineBySlug(slug));
      dispatch(fetchWalletDetails());
    }
    return () => {
      dispatch(clearMedicineDetail());
      dispatch(clearCurrentOrder());
      dispatch(clearCoupon());
    };
  }, [slug, dispatch]);

  useEffect(() => {
    if (med?._id) dispatch(fetchSimilarMedicines({ id: med._id }));
  }, [med?._id, dispatch]);

  useEffect(() => {
    if (prescriptionUrl) setRxHighlight(false);
  }, [prescriptionUrl]);

  const bestInv = useMemo(() => getBestInventory(med?.storeInventory), [med?.storeInventory]);
  const maxStock = useMemo(
    () =>
      (med?.storeInventory ?? []).reduce(
        (s, i) => s + (i.availableStock ?? i.stockQuantity ?? 0),
        0
      ),
    [med?.storeInventory]
  );

  const bestStoreId = useMemo(() => extractStoreId(bestInv?.storeId), [bestInv]);

  const handleFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large. Max 5MB allowed.');
        return;
      }
      setIsUploading(true);
      try {
        const result = await dispatch(uploadSingleFile({ file, folder: 'prescriptions' }));
        if (uploadSingleFile.fulfilled.match(result)) {
          setPrescriptionUrl(result.payload.url);
          toast.success('Prescription uploaded successfully.');
        } else {
          toast.error('Upload failed. Please try again.');
        }
      } finally {
        setIsUploading(false);
      }
    },
    [dispatch]
  );

  const guardPreFlight = useCallback(() => {
    if (!med) return false;
    if (maxStock === 0) {
      toast.error('This medicine is currently out of stock.');
      return false;
    }
    if (!bestStoreId) {
      toast.error('No store available. Please try again later.');
      return false;
    }
    if (med.isPrescriptionRequired && !prescriptionUrl) {
      setRxHighlight(true);
      toast.error('Please upload a valid prescription before proceeding.');
      document
        .getElementById('rx-uploader')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  }, [med, prescriptionUrl, maxStock, bestStoreId]);

  const handleAddToCart = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to add items to your cart.');
      router.push('/login');
      return;
    }

    if (!guardPreFlight()) return;
    setCartState('adding');
    try {
      await dispatch(
        addToCart({
          medicineId: med._id,
          quantity,
          storeId: bestStoreId,
          ...(prescriptionUrl && { prescription: { imageUrl: prescriptionUrl } }),
        })
      ).unwrap();
      setCartState('success');
      setTimeout(() => setCartState('idle'), 2000);
    } catch (err) {
      setCartState('idle');
      toast.error(err?.message || 'Failed to add to cart. Please try again.');
    }
  }, [dispatch, med, quantity, bestStoreId, prescriptionUrl, guardPreFlight, user, router]);

  const decrement = useCallback(() => setQuantity((q) => Math.max(1, q - 1)), []);
  const increment = useCallback(
    () => setQuantity((q) => Math.min(q + 1, maxStock || 999)),
    [maxStock]
  );

  const handleShare = useCallback(async () => {
    if (!med) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: med.brandName, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard.');
      }
    } catch { /* share cancelled */ }
  }, [med]);

  const activeTabKey = activeTab.toLowerCase();

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isPageLoading) {
    return (
      <div className="container-custom py-12 space-y-6">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <div className="skeleton aspect-square w-full rounded-2xl" />
            <div className="flex gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton w-20 h-20 rounded-xl shrink-0" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            <div className="skeleton h-10 w-3/4 rounded-xl" />
            <div className="skeleton h-5 w-1/2 rounded-lg" />
            <div className="skeleton h-40 w-full rounded-2xl" />
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-4">
              <div className="skeleton h-14 rounded-xl" />
              <div className="skeleton h-14 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (medError || !med) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-base-100">
        <div className="w-24 h-24 rounded-2xl flex items-center justify-center mb-6 bg-error/10">
          <AlertCircle className="w-12 h-12 text-error" />
        </div>
        <h1 className="text-3xl font-black text-base-content mb-3">Product Unavailable</h1>
        <p className="text-sm mb-8 max-w-md font-medium leading-relaxed text-base-content/60">
          {medError ||
            'This medicine could not be found. It may have been removed or the link is invalid.'}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => router.back()}
            className="btn btn-secondary flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
          <button
            onClick={() => dispatch(fetchMedicineBySlug(slug))}
            className="btn btn-primary flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const Sched = SCHEDULE_META[med.schedule] ?? SCHEDULE_META.None;
  const CatIcon = CATEGORY_ICONS[med.category] ?? Pill;
  const isOutOfStock = maxStock === 0;

  return (
    <Container>
      <div className="min-h-screen pb-20 bg-base-100">
        {/* ── Breadcrumb + Header ───────────────────────────────────── */}
        <div className="bg-base-200/30 border-b border-base-300">
          <div className="container-custom py-6">
            <nav
              aria-label="breadcrumb"
              className="flex items-center gap-1.5 mb-5 overflow-x-auto text-[0.625rem] font-bold uppercase tracking-widest text-base-content/40 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] whitespace-nowrap"
            >
              <button
                onClick={() => router.push('/pharmacy')}
                className="hover:text-primary transition-colors text-inherit cursor-pointer"
              >
                Pharmacy
              </button>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <button
                onClick={() => router.push(`/pharmacy?category=${med.category}`)}
                className="hover:text-primary transition-colors text-inherit cursor-pointer"
              >
                {med.category}
              </button>
              <ChevronRight className="w-3 h-3 shrink-0" />
              <span className="text-primary truncate max-w-[180px]">
                {med.brandName}
              </span>
            </nav>

            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`badge ${Sched.colorClass}`}>{Sched.label}</span>
                  {med.isPrescriptionRequired && (
                    <span className="badge badge-error text-error flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Rx Required
                    </span>
                  )}
                  {med.isDiscontinued && (
                    <span className="badge badge-warning text-warning">
                      Discontinued
                    </span>
                  )}
                  <StockBadge storeInventory={med.storeInventory} />
                </div>

                <h1 className="font-black tracking-tight text-3xl md:text-4xl lg:text-5xl leading-[1.1]">
                  {med.brandName}
                </h1>
                <p className="text-base font-medium italic mt-2 text-base-content/60">
                  {med.genericName} · {med.dosage}
                </p>
                <p className="text-xs font-bold mt-2 uppercase tracking-wider flex items-center gap-1.5 text-base-content/50">
                  <Building2 className="w-4 h-4" /> by {med.manufacturer}
                </p>
              </div>

              <div className="flex gap-2 no-print shrink-0 mt-2 md:mt-0 w-full md:w-auto">
                <IconTooltip label="Share">
                  <button
                    onClick={handleShare}
                    aria-label="Share"
                    className="btn btn-ghost flex-1 md:flex-none flex items-center justify-center border-2 border-base-300 cursor-pointer"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </IconTooltip>
                <IconTooltip label="Print">
                  <button
                    onClick={() => window.print()}
                    aria-label="Print"
                    className="btn btn-ghost flex-1 md:flex-none flex items-center justify-center border-2 border-base-300 cursor-pointer"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                </IconTooltip>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Grid ────────────────────────────────────────────── */}
        <div className="container-custom py-8 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* LEFT: Gallery */}
            <div className="lg:col-span-5 relative z-10">
              <ImageGallery
                images={med.images ?? []}
                activeIdx={imgIdx}
                onIdxChange={setImgIdx}
                onOpenFull={() => setZoomOpen(true)}
              />

              {/* Quality assurance block */}
              <div className="mt-6 p-5 rounded-2xl border bg-primary/5 border-primary/20">
                <div className="flex gap-4">
                  <ShieldCheck className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-primary mb-1.5">
                      Quality Assured
                    </p>
                    <p className="text-sm leading-relaxed font-medium text-base-content/70">
                      Sourced directly from <strong className="text-base-content">{med.manufacturer}</strong>.
                      Verified by licensed pharmacists before dispatch.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fulfillment info */}
              {bestInv && (
                <div className="mt-4 p-5 rounded-2xl border space-y-3 bg-base-200 border-base-300">
                  <p className="text-xs font-black uppercase tracking-widest text-base-content/40">
                    Fulfillment
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(typeof bestInv.batchId === 'object'
                      ? bestInv.batchId?.batchNumber
                      : bestInv.batchNumber) && (
                      <div className="flex items-center gap-2 text-xs font-medium text-base-content/60">
                        <Hash className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">
                          Batch:{' '}
                          <strong className="text-base-content">
                            {typeof bestInv.batchId === 'object'
                              ? bestInv.batchId?.batchNumber
                              : bestInv.batchNumber}
                          </strong>
                        </span>
                      </div>
                    )}
                    {(typeof bestInv.batchId === 'object'
                      ? bestInv.batchId?.expiryDate
                      : bestInv.expiryDate) && (
                      <div className="flex items-center gap-2 text-xs font-medium text-base-content/60">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span className="truncate">
                          Exp:{' '}
                          <strong className="text-base-content">
                            {new Date(
                              typeof bestInv.batchId === 'object'
                                ? bestInv.batchId?.expiryDate
                                : bestInv.expiryDate
                            ).toLocaleDateString('en-IN', {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Delivery info */}
                  {typeof bestInv.storeId === 'object' && (
                    <div className="flex flex-wrap gap-3 pt-2 border-t border-base-300">
                      {bestInv.storeId?.deliverySettings?.canDeliver && (
                        <span className="text-xs font-medium flex items-center gap-1 text-success">
                          <Truck className="w-3.5 h-3.5" />
                          Home Delivery Available
                        </span>
                      )}
                      {bestInv.storeId?.deliverySettings?.expressDelivery && (
                        <span className="text-xs font-medium flex items-center gap-1 text-warning">
                          <Zap className="w-3.5 h-3.5" />
                          Express in {bestInv.storeId.deliverySettings.expressEtaMinutes} min
                        </span>
                      )}
                      {bestInv.storeId?.deliverySettings?.codAvailable && (
                        <span className="text-xs font-medium flex items-center gap-1 text-base-content/60">
                          <IndianRupee className="w-3.5 h-3.5" />
                          COD Available
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: Purchase + Tabs */}
            <div className="lg:col-span-7 space-y-6 relative z-0">
              <SubscriptionBanner discount={subscriptionDiscount} planName={subscriptionPlanName} />

              {/* ── Purchase Card ── */}
              <div className="glass-card p-6 md:p-8 rounded-3xl border-2 border-base-300/30">
                <div className="pb-6 mb-6 border-b border-base-300">
                  <div className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="flex-1 min-w-0">
                      <PurchasePricingPanel
                        med={med}
                        bestInv={bestInv}
                        quantity={quantity}
                        subscriptionDiscount={subscriptionDiscount}
                        subscriptionPlanName={subscriptionPlanName}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="flex flex-col items-center gap-3 p-5 rounded-2xl border self-start sm:self-auto shrink-0 bg-base-200/40 border-base-200 min-w-[160px]">
                      <p className="text-xs font-black uppercase tracking-widest text-center text-base-content/40">
                        Quantity
                      </p>
                      <QuantitySelector
                        quantity={quantity}
                        onDecrement={decrement}
                        onIncrement={increment}
                        max={maxStock || undefined}
                      />
                      <p className="text-xs font-black uppercase tracking-wider text-center px-3 py-1.5 rounded-lg w-full bg-primary/10 text-primary border border-primary/20">
                        {med.packaging}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Cart Button ── */}
                <div className="w-full relative z-10">
                  <AnimatePresence>
                    {cartState === 'success' && (
                      <>
                        <motion.div
                          initial={{ opacity: 0, y: 0, scale: 0.5 }}
                          animate={{ opacity: [0, 1, 0], y: -70, scale: [0.5, 1.2, 1] }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="absolute top-0 left-1/2 flex items-center gap-1.5 px-4 py-1.5 rounded-full font-black text-sm shadow-xl pointer-events-none z-50 -translate-x-1/2 bg-primary text-primary-content"
                        >
                          <Package className="w-4 h-4" /> +{quantity}
                        </motion.div>
                        <motion.div
                          initial={{ opacity: 0.6, scale: 0.95 }}
                          animate={{ opacity: 0, scale: 1.4 }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          className="absolute inset-0 rounded-xl pointer-events-none border-2 border-primary z-0"
                        />
                      </>
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileHover={cartState === 'idle' && !isOutOfStock ? { scale: 1.015 } : {}}
                    whileTap={cartState === 'idle' && !isOutOfStock ? { scale: 0.98 } : {}}
                    onClick={handleAddToCart}
                    disabled={cartState !== 'idle' || isOutOfStock}
                    className={`w-full relative group overflow-hidden flex items-center justify-center py-4 text-sm font-bold shadow-md rounded-xl border-none transition-colors duration-300 ${
                      cartState === 'idle' && !isOutOfStock ? 'btn-primary-cta' : cartState === 'success' ? 'bg-success text-success-content' : 'bg-base-200 text-base-content'
                    } ${isOutOfStock ? 'opacity-50 grayscale cursor-not-allowed' : cartState !== 'idle' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {/* Shine Effect */}
                    {cartState === 'idle' && !isOutOfStock && (
                      <span className="absolute inset-0 w-full h-full pointer-events-none bg-[linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.2)_50%,transparent_70%)] -translate-x-full skew-x-[-12deg] transition-transform duration-700 z-0 group-hover:translate-x-[200%]" />
                    )}

                    <span className="relative flex items-center justify-center gap-2.5 z-[1]">
                      <AnimatePresence mode="wait">
                        {cartState === 'idle' && (
                          <motion.span
                            key="idle"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-2.5"
                          >
                            <ShoppingCart className="w-5 h-5" />
                            {isOutOfStock ? 'Out of Stock' : 'Add to Shopping Cart'}
                          </motion.span>
                        )}
                        {cartState === 'adding' && (
                          <motion.span
                            key="adding"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="flex items-center gap-2.5 text-primary"
                          >
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                          </motion.span>
                        )}
                        {cartState === 'success' && (
                          <motion.span
                            key="success"
                            initial={{ opacity: 0, scale: 0.5, rotate: -45 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="flex items-center gap-2.5 text-success-content"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            Added to Cart!
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </motion.button>
                </div>

                {/* Out of stock notice */}
                {isOutOfStock && (
                  <div className="mt-4 p-4 rounded-xl flex items-center justify-center gap-2.5 bg-error/10 border border-error/30">
                    <AlertCircle className="w-5 h-5 text-error" />
                    <p className="text-xs font-bold uppercase tracking-wider text-error">
                      Currently out of stock across all stores
                    </p>
                  </div>
                )}

                {/* Inline Rx warning */}
                <AnimatePresence>
                  {med.isPrescriptionRequired && rxHighlight && !prescriptionUrl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 p-4 rounded-xl flex items-center gap-2.5 bg-error/10 border border-error/30">
                        <ShieldCheck className="w-5 h-5 shrink-0 text-error" />
                        <p className="text-xs font-bold text-error">
                          Upload a valid prescription below before adding to cart.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Prescription Uploader */}
              {med.isPrescriptionRequired && (
                <div id="rx-uploader" className="scroll-mt-32">
                  <PrescriptionUploader
                    prescriptionUrl={prescriptionUrl}
                    isUploading={isUploading}
                    onUpload={handleFileUpload}
                    showRequiredError={rxHighlight && !prescriptionUrl}
                  />
                </div>
              )}

              {/* Regulatory Notice */}
              {med.schedule !== 'None' && (
                <div className="alert alert-warning rounded-2xl p-5">
                  <Info className="w-6 h-6 shrink-0 text-warning" />
                  <p className="text-xs font-medium leading-relaxed">
                    <strong className="font-black uppercase tracking-wider">{Sched.label}:</strong>{' '}
                    {Sched.desc}
                  </p>
                </div>
              )}

              {/* ── Tabs ── */}
              <div className="pt-2">
                <div
                  className="flex gap-0 overflow-x-auto border-b-2 border-base-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  role="tablist"
                >
                  {TABS.map((tab) => {
                    const key = tab.toLowerCase();
                    const isActive = activeTabKey === key;
                    return (
                      <button
                        key={tab}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTab(key)}
                        className={`relative pb-4 px-4 sm:px-6 font-black uppercase tracking-widest whitespace-nowrap transition-all text-[0.65rem] cursor-pointer ${isActive ? 'text-primary' : 'text-base-content/50 hover:text-base-content/80'}`}
                      >
                        {tab}
                        {isActive && (
                          <motion.div
                            layoutId="tabIndicator"
                            className="absolute bottom-0 left-0 right-0 rounded-t-md h-0.5 bg-primary"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTabKey}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    role="tabpanel"
                    className="pt-8 min-h-[280px]"
                  >
                    {/* ── OVERVIEW ── */}
                    {activeTabKey === 'overview' && (
                      <div className="space-y-6">
                        {med.description && (
                          <div className="p-6 rounded-2xl border bg-base-200/40 border-base-300">
                            <p className="text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-3 text-base-content/40">
                              <BookOpen className="w-4 h-4 text-primary" /> Description
                            </p>
                            <p className="text-sm leading-relaxed font-medium text-base-content/75">
                              {med.description}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <InfoBox icon={Building2} label="Manufacturer" value={med.manufacturer} />
                          <InfoBox icon={CatIcon} label="Category" value={med.category} />
                          <InfoBox icon={Package} label="Packaging" value={med.packaging} />
                          <InfoBox icon={Thermometer} label="Dosage" value={med.dosage} />
                          {med.routeOfAdministration && (
                            <InfoBox
                              icon={Syringe}
                              label="Route"
                              value={med.routeOfAdministration}
                            />
                          )}
                          {med.therapeuticClass && (
                            <InfoBox
                              icon={FlaskConical}
                              label="Therapeutic Class"
                              value={med.therapeuticClass}
                            />
                          )}
                        </div>

                        {med.indications?.length > 0 && (
                          <div className="pt-2">
                            <p className="text-xs font-black uppercase tracking-widest mb-3 text-base-content/40">
                              Common Indications
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {med.indications.map((ind, i) => (
                                <span key={i} className="badge badge-primary">
                                  {ind}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {med.warnings?.length > 0 && (
                          <div className="p-4 rounded-xl border bg-warning/10 border-warning/30">
                            <p className="text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-3 text-warning">
                              <AlertTriangle className="w-4 h-4" /> Warnings
                            </p>
                            <ul className="space-y-1.5">
                              {med.warnings.map((w, i) => (
                                <li
                                  key={i}
                                  className="text-xs font-medium flex items-start gap-2 text-base-content/70"
                                >
                                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-warning" />
                                  {w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {med.interactions?.length > 0 && (
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest mb-3 text-base-content/40">
                              Drug Interactions
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {med.interactions.map((int, i) => (
                                <span key={i} className="badge badge-warning">
                                  {int}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {med.searchKeywords?.length > 0 && (
                          <div className="pt-4 border-t border-base-300">
                            <p className="text-xs font-black uppercase tracking-widest mb-3 text-base-content/40">
                              Also Known As
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {med.searchKeywords.map((kw, i) => (
                                <span
                                  key={i}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold border bg-base-200 text-base-content/50 border-base-300"
                                >
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── COMPOSITION ── */}
                    {activeTabKey === 'composition' && (
                      <div>
                        {!med.saltComposition?.length ? (
                          <div className="p-8 text-center rounded-2xl border-2 border-dashed border-base-300">
                            <p className="text-sm font-bold uppercase tracking-wider text-base-content/40">
                              No composition data available.
                            </p>
                          </div>
                        ) : (
                          <div className="rounded-2xl border-2 overflow-hidden shadow-sm border-base-300">
                            <table className="table" aria-label="Salt Composition">
                              <thead>
                                <tr>
                                  <th>Ingredient</th>
                                  <th className="text-right">Strength</th>
                                  <th className="text-right">Unit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {med.saltComposition.map((salt, i) => (
                                  <tr key={i}>
                                    <td className="text-sm font-bold text-base-content">
                                      {salt.ingredient}
                                    </td>
                                    <td className="text-sm font-black italic text-right text-primary">
                                      {salt.strength}
                                    </td>
                                    <td className="text-xs font-bold text-right text-base-content/50">
                                      {salt.unit ?? '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {med.pharmacologicalClass && (
                          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <InfoBox
                              icon={FlaskConical}
                              label="Pharmacological Class"
                              value={med.pharmacologicalClass}
                            />
                            {med.atcCode && (
                              <InfoBox icon={Hash} label="ATC Code" value={med.atcCode} />
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── SAFETY ── */}
                    {activeTabKey === 'safety' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <SafetyCard
                            title="Side Effects"
                            list={med.sideEffects}
                            icon={AlertTriangle}
                            variant="warning"
                          />
                          <SafetyCard
                            title="Contraindications"
                            list={med.contraindications}
                            icon={Ban}
                            variant="error"
                          />
                        </div>

                        {med.storageConditions && (
                          <div className="p-5 rounded-xl border bg-info/10 border-info/30">
                            <p className="text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-3 text-info">
                              <Thermometer className="w-4 h-4" /> Storage Conditions
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                              {med.storageConditions.temperature?.label && (
                                <div>
                                  <p className="text-xs font-bold text-base-content/50">
                                    Temperature
                                  </p>
                                  <p className="font-black text-base-content">
                                    {med.storageConditions.temperature.label}
                                  </p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-bold text-base-content/50">
                                  Light Sensitive
                                </p>
                                <p className="font-black text-base-content">
                                  {med.storageConditions.lightSensitive ? 'Yes — protect from light' : 'No'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-bold text-base-content/50">
                                  Cold Chain
                                </p>
                                <p className="font-black text-base-content">
                                  {med.storageConditions.requiresColdChain ? 'Required' : 'Not required'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── PRICING ── */}
                    {activeTabKey === 'pricing' && (
                      <div className="space-y-5">
                        <div className="p-5 rounded-2xl border bg-primary/5 border-primary/20">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/20">
                              <Receipt className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-black text-base-content">Reference Pricing</p>
                              <p className="text-xs text-base-content/50">
                                Government issued MRP
                              </p>
                            </div>
                          </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-base-content/50">
                                MRP
                              </p>
                              <p className="text-xl font-black text-primary">₹{fmt(med.referenceMrp)}</p>
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-base-content/50">
                                GST
                              </p>
                              <p className="text-xl font-black text-base-content">{med.gstPercentage ?? 12}%</p>
                            </div>
                          </div>
                        </div>

                        {/* GST breakdown */}
                        <div className="rounded-2xl border overflow-hidden border-base-300">
                          <div className="px-5 py-3 bg-base-200">
                            <p className="text-xs font-black uppercase tracking-widest text-base-content/50">
                              GST Split
                            </p>
                          </div>
                          <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {[
                              { label: 'IGST', val: med.igstPercentage ?? med.gstPercentage },
                              { label: 'CGST', val: med.cgstPercentage },
                              { label: 'SGST', val: med.sgstPercentage },
                              { label: 'Total', val: med.gstPercentage },
                            ].map(({ label, val }) => (
                              <div key={label}>
                                <p className="text-xs font-bold uppercase tracking-wider text-base-content/50">
                                  {label}
                                </p>
                                <p className="text-lg font-black text-base-content">
                                  {val != null ? `${val}%` : '—'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Per-store inventory pricing */}
                        {med.storeInventory?.length > 0 && (
                          <div className="space-y-4">
                            <p className="text-xs font-black uppercase tracking-widest text-base-content/40">
                              Pricing by Store ({med.storeInventory.length} store{med.storeInventory.length > 1 ? 's' : ''})
                            </p>
                            {med.storeInventory.map((inv, i) => (
                              <StoreInventoryCard key={inv._id ?? i} inv={inv} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── LEGAL ── */}
                    {activeTabKey === 'legal' && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <InfoBox
                            icon={Tag}
                            label="Schedule"
                            value={med.schedule === 'None' ? 'OTC (No Schedule)' : med.schedule}
                          />
                          <InfoBox
                            icon={Percent}
                            label="GST Rate"
                            value={`${med.gstPercentage ?? 5}%`}
                          />
                          <InfoBox
                            icon={Hash}
                            label="HSN Code"
                            value={
                              med.hsnCode && typeof med.hsnCode === 'object'
                                ? med.hsnCode.hsnCode
                                : med.hsnCode || '—'
                            }
                          />
                          <InfoBox
                            icon={HeartPulse}
                            label="Rx Required"
                            value={med.isPrescriptionRequired ? 'Yes' : 'No'}
                            accent={med.isPrescriptionRequired}
                          />
                          {med.atcCode && (
                            <InfoBox icon={Hash} label="ATC Code" value={med.atcCode} />
                          )}
                          <InfoBox
                            icon={Package}
                            label="Pack Size"
                            value={`${med.packSize ?? '—'} ${med.packUnit ?? ''}`}
                          />
                        </div>

                        {/* Regulatory info */}
                        {med.regulatoryInfo?.cdscoDrugLicenceNo && (
                          <div className="p-5 rounded-xl border bg-base-200/40 border-base-300">
                            <p className="text-xs font-black uppercase tracking-widest mb-1 text-base-content/40">
                              CDSCO Drug Licence
                            </p>
                            <p className="font-mono text-sm font-bold text-base-content">
                              {med.regulatoryInfo.cdscoDrugLicenceNo}
                            </p>
                          </div>
                        )}

                        <div className="p-6 rounded-2xl border space-y-4 bg-base-200/50 border-base-300">
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest mb-1 text-base-content/40">
                              Database ID
                            </p>
                            <p className="font-mono text-xs font-bold text-base-content break-all">
                              {med._id}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest mb-1 text-base-content/40">
                              Country of Origin
                            </p>
                            <p className="text-sm font-bold text-base-content">
                              {med.countryOfOrigin ?? '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest mb-1 text-base-content/40">
                              Last Updated
                            </p>
                            <p className="text-xs font-bold text-base-content">
                              {med.updatedAt
                                ? new Date(med.updatedAt).toLocaleString('en-IN', {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })
                                : '—'}
                            </p>
                          </div>

                          {med.isDiscontinued && (
                            <div className="alert alert-error rounded-xl py-3 px-5 flex items-center gap-2">
                              <AlertCircle className="w-5 h-5 shrink-0 text-error" />
                              <p className="text-xs font-bold text-error">
                                This product has been marked as discontinued.
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="p-6 rounded-2xl border bg-warning/10 border-warning/30">
                          <p className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 mb-2 text-warning">
                            <ShieldCheck className="w-4 h-4" /> Regulatory Notice
                          </p>
                          <p className="text-xs font-medium leading-relaxed text-base-content/70">
                            {Sched.desc}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* ── Similar Medicines ─────────────────────────────────────── */}
        {(similarMedicinesLoading || similarMedicines.length > 0) && (
          <div className="container-custom pb-16 pt-12 border-t border-base-300">
            <h2 className="text-xl font-black text-base-content uppercase tracking-widest mb-2 flex items-center gap-2">
              <RefreshCw className="w-6 h-6 text-primary" /> Similar Medicines
            </h2>

            {!similarMedicinesLoading && similarMedicines.length > 0 && (
              <p className="text-xs font-medium mb-8 max-w-3xl text-base-content/50">
                Medicines with similar composition to{' '}
                <span className="font-black text-primary">{med.brandName}</span>
                {med.genericName ? (
                  <>
                    {' '}— alternatives containing{' '}
                    <span className="font-black text-base-content">{med.genericName}</span>
                  </>
                ) : null}
              </p>
            )}

            {similarMedicinesLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="skeleton h-72 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {similarMedicines.map((item) => {
                  const inv = getBestInventory(item.storeInventory);
                  const price = inv?.finalPrice ?? inv?.sellingPrice ?? item.referenceMrp;
                  const stock = (item.storeInventory ?? []).reduce(
                    (s, i) => s + (i.availableStock ?? i.stockQuantity ?? 0),
                    0
                  );
                  const isLow = inv?.isLowStock || (stock > 0 && stock < 10);
                  const isOut = stock === 0;
                  const expiry =
                    (typeof inv?.batchId === 'object' ? inv?.batchId?.expiryDate : inv?.expiryDate)
                      ? new Date(
                          typeof inv?.batchId === 'object'
                            ? inv?.batchId?.expiryDate
                            : inv?.expiryDate
                        ).toLocaleDateString('en-IN', {
                          month: 'short',
                          year: 'numeric',
                        })
                      : null;

                  return (
                    <motion.button
                      key={item._id}
                      whileHover={{ y: -6 }}
                      onClick={() => router.push(`/pharmacy/buy-medicines/${item?.slug}`)}
                      className="glass-card p-3 text-left flex flex-col gap-3 transition-all rounded-3xl border-2 border-base-300 cursor-pointer"
                    >
                      <div className="aspect-square rounded-2xl border overflow-hidden flex items-center justify-center relative bg-base-100 border-base-200">
                        {item.images?.[0]?.url ? (
                          <img
                            src={item.images[0].url}
                            alt={item.brandName}
                            className="w-full h-full object-contain p-4"
                            loading="lazy"
                          />
                        ) : (
                          <Pill className="w-12 h-12 text-primary opacity-20" />
                        )}
                        <span
                          className={`absolute top-2 right-2 text-[0.6rem] font-black uppercase tracking-wider px-2 py-1 rounded-md shadow-sm ${isOut ? 'bg-error text-error-content' : isLow ? 'bg-warning text-warning-content' : 'bg-success text-success-content'}`}
                        >
                          {isOut ? 'Out' : isLow ? 'Low' : 'In'}
                        </span>
                      </div>

                      <div className="px-1 pb-1 flex flex-col gap-1.5 flex-1">
                        <div>
                          <p className="text-sm font-black text-base-content truncate">
                            {item.brandName}
                          </p>
                          <p className="text-xs font-bold uppercase tracking-wider truncate mt-0.5 text-base-content/50">
                            {item.genericName}
                          </p>
                        </div>

                        <div className="space-y-1">
                          {item.dosage && (
                            <p className="text-xs font-medium flex items-center gap-1.5 text-base-content/60">
                              <Pill className="w-3 h-3 text-primary shrink-0 opacity-50" />
                              {item.dosage}
                            </p>
                          )}
                          {expiry && (
                            <p className="text-xs font-medium flex items-center gap-1.5 text-base-content/60">
                              <Clock className="w-3 h-3 text-primary shrink-0 opacity-50" />
                              Exp: <strong className="text-base-content ml-0.5">{expiry}</strong>
                            </p>
                          )}
                        </div>

                        <div className="flex items-end justify-between mt-auto pt-3 border-t border-base-300">
                          <div>
                            <p className="text-sm font-black text-primary">₹{fmt(price)}</p>
                            {item.referenceMrp && item.referenceMrp !== price && (
                              <p className="text-xs font-bold line-through text-base-content/30">
                                ₹{fmt(item.referenceMrp)}
                              </p>
                            )}
                          </div>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all bg-base-200 group-hover:bg-primary group-hover:text-primary-content">
                            <ChevronRight className="w-4 h-4 text-inherit" />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Fullscreen Modal ──────────────────────────────────────── */}
        <AnimatePresence>
          {zoomOpen && med.images?.length > 0 && (
            <FullscreenZoomModal
              images={med.images}
              activeIdx={imgIdx}
              onIdxChange={setImgIdx}
              onClose={() => setZoomOpen(false)}
              brandName={med.brandName}
            />
          )}
        </AnimatePresence>
      </div>
    </Container>
  );
}