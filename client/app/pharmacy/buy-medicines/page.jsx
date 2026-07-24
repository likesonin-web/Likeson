"use client";

import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Pill,
  Package,
  Tag,
  AlertCircle,
  CheckCircle2,
  Filter,
  Grid3x3,
  List,
  Star,
  ShieldCheck,
  Beaker,
  ArrowUpDown,
  Eye,
  RefreshCw,
  TrendingUp,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Layers,
  FlaskConical,
  Syringe,
  Wind,
  Droplets,
  Info,
  Heart,
  Share2,
  ShoppingCart,
  Zap,
  ShieldAlert,
  Thermometer,
  Activity,
  Scale,
  Clock,
  ArrowRight,
  CreditCard,
  Wallet,
  Minus,
  Plus,
  CheckCheck,
  BadgePercent,
  CircleSlash,
  Loader2,
  Ticket,
  Building2,
  Upload,
  FileImage,
  AlertTriangle,
  MapPin,
  Phone,
  User,
  Hash,
  Home,
  Landmark,
  Truck,
} from "lucide-react";
import toast from "react-hot-toast";
import Container from "../../../components/ui/Container";
import Ads from "../../../components/Ads";
import Link from "next/link";
import SpecialButton from "../../../components/SpecialButton";

// ─── Redux ────────────────────────────────────────────────────────────────────
import {
  fetchMedicines,
  clearMedicineError,
  selectMedicines,
  selectMedicineLoading,
  selectMedicinePagination,
  selectMedicineError,
} from "@/store/slices/medicineSlice";
import { selectMySubscription } from "@/store/slices/subscriptionSlice";
import {
  addToCart,
  uploadCartItemPrescription,
  placeDirectOrder,
  verifyDirectPayment,
  validateCoupon,
  clearCoupon,
  selectPharmacyActionLoading,
  selectCoupon,
  selectCouponLoading,
  selectCouponError,
  fetchDeliveryPricing,
  selectDeliveryPricing,
  selectDeliveryPricingLoading,
} from "@/store/slices/pharmacyOrderSlice";

import { selectWalletBalance } from "@/store/slices/walletSlice";
import { uploadSingleFile } from "@/store/slices/uploadSlice";

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Ointment",
  "Drops",
  "Inhaler",
  "Powder",
];
const SCHEDULES = ["H", "H1", "G", "X", "None"];

// ENHANCED SORTING
const SORT_OPTIONS = [
  { label: "All (Default)", value: "default" },
  { label: "Brand Name (A–Z)", value: "brandName_asc" },
  { label: "Brand Name (Z–A)", value: "brandName_desc" },
  { label: "Generic Name (A–Z)", value: "genericName_asc" },
  { label: "Newest First", value: "createdAt_desc" },
  { label: "Most Popular", value: "popularity_desc" },
];

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

const PAYMENT_METHODS = [
  {
    id: "Razorpay",
    label: "Pay Online",
    icon: CreditCard,
    desc: "UPI, Cards, Net Banking",
  },
  {
    id: "Wallet",
    label: "Wallet",
    icon: Wallet,
    desc: "Use Likeson wallet balance",
  },
  {
    id: "COD",
    label: "Cash on Delivery",
    icon: Package,
    desc: "Pay when delivered",
  },
];

const DEFAULT_FILTERS = {
  categories: [],
  schedules: [],
  prescriptionOnly: false,
  hideDiscontinued: false,
};

const RZP_KEY_PUBLIC =
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SV43jVcrs5wKAM";

// ─── Utilities ────────────────────────────────────────────────────────────────

const extractStoreId = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value._id) return value._id.toString();
  if (typeof value === "object" && value.$oid) return value.$oid.toString();
  return value.toString();
};

const getBestInventory = (inventory = []) =>
  inventory.find((inv) => inv.stockQuantity > 0) ?? inventory[0] ?? null;

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

const openRazorpayModal = ({ rzpKey, rzpOrderId, amount, name, description }) =>
  new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.Razorpay) {
      reject(new Error("Razorpay SDK not loaded. Please refresh."));
      return;
    }
    const key = RZP_KEY_PUBLIC;
    if (!key) {
      reject(new Error("Razorpay key missing."));
      return;
    }
    const rzp = new window.Razorpay({
      key,
      order_id: rzpOrderId,
      amount: Math.round(amount * 100),
      currency: "INR",
      name: name || "Likeson Healthcare",
      description: description || "Medicine Purchase",
      theme: { color: "#2563eb" },
      handler: (r) => resolve(r),
      modal: { ondismiss: () => reject(new Error("Payment cancelled.")) },
    });
    rzp.open();
  });

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

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 22, stiffness: 130 },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
};

// ─── Shared Field Label Component ─────────────────────────────────────────────

const FieldLabel = ({ icon: Icon, label, required, hint }) => (
  <div className="flex items-center justify-between mb-1.5">
    <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-base-content/50">
      {Icon && <Icon className="w-3 h-3 text-primary/60" />}
      {label}
      {required && <span className="text-error ml-0.5">*</span>}
    </label>
    {hint && (
      <span className="text-[9px] text-base-content/30 font-medium italic">
        {hint}
      </span>
    )}
  </div>
);

// ─── ScheduleBadge ────────────────────────────────────────────────────────────

const ScheduleBadge = ({ schedule }) => {
  const configs = {
    H: { color: "bg-error/10 text-error border-error/20", label: "Sch. H" },
    H1: {
      color: "bg-warning/10 text-warning border-warning/20",
      label: "Sch. H1",
    },
    G: { color: "bg-info/10 text-info border-info/20", label: "Sch. G" },
    X: { color: "bg-error/20 text-error border-error/30", label: "Sch. X" },
    None: {
      color: "bg-success/10 text-success border-success/20",
      label: "OTC",
    },
  };
  const config = configs[schedule] ?? configs.None;
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[9px] font-black border uppercase tracking-wider shrink-0 ${config.color}`}
    >
      {config.label}
    </span>
  );
};

// ─── MedicineStatus ───────────────────────────────────────────────────────────

const MedicineStatus = ({ medicine }) => {
  const isDiscontinued = medicine.isDiscontinued;
  const hasInventory =
    Array.isArray(medicine.inventory) && medicine.inventory.length > 0;

  const totalStock = hasInventory
    ? medicine.inventory.reduce((sum, inv) => sum + (inv.stockQuantity || 0), 0)
    : null;

  const outOfStock = !isDiscontinued && totalStock !== null && totalStock <= 0;
  const label = isDiscontinued
    ? "DISCONTINUED"
    : outOfStock
      ? "OUT OF STOCK"
      : "IN STOCK";

  const colorClass =
    isDiscontinued || outOfStock
      ? "bg-error/10 text-error border-error/20"
      : "bg-success/20 text-success border-success/20";
  const dotClass = isDiscontinued || outOfStock ? "bg-error" : "bg-success";

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black border ${colorClass}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotClass}`} />
      {label}
    </div>
  );
};

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

const SkeletonCard = ({ viewMode }) => (
  <div
    className={`glass-card overflow-hidden animate-pulse ${viewMode === "list" ? "flex gap-4 items-center p-4" : ""}`}
  >
    <div
      className={`bg-base-300 shrink-0 ${viewMode === "list" ? "w-40 h-28 rounded-md" : "h-48 w-full"}`}
    />
    <div className="p-4 space-y-3 flex-1">
      <div className="h-3 bg-base-300 rounded-md w-3/4" />
      <div className="h-2 bg-base-300 rounded-md w-1/2" />
      <div className="h-2 bg-base-300 rounded-md w-2/3" />
      <div className="flex gap-2 mt-4">
        <div className="h-8 bg-base-300 rounded-md flex-1" />
        <div className="h-8 bg-base-300 rounded-md flex-1" />
      </div>
    </div>
  </div>
);

// ─── PrescriptionUploadModal ──────────────────────────────────────────────────

const PrescriptionUploadModal = ({
  medicine,
  onUpload,
  onSkip,
  onClose,
  isUploading,
}) => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    const allowed = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowed.includes(selected.type)) {
      toast.error("Please upload an image (JPG, PNG, WebP) or PDF.");
      return;
    }
    if (selected.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5 MB.");
      return;
    }
    setFile(selected);
    if (selected.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(selected));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast.error("Please select a prescription file first.");
      return;
    }
    onUpload(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 30 }}
        className="w-full max-w-md bg-base-100 rounded-2xl shadow-2xl overflow-hidden border border-base-200 cursor-auto"
      >
        <div className="px-6 py-5 border-b border-base-200 bg-gradient-to-r from-warning/8 to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/15 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="font-black text-sm text-base-content tracking-tight">
                  Prescription Required
                </h3>
                <p className="text-[10px] text-base-content/40 font-semibold mt-0.5 uppercase tracking-widest">
                  {medicine?.brandName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-base-200 transition-colors text-base-content/40 hover:text-base-content cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex gap-3 p-4 rounded-xl bg-info/5 border border-info/20">
            <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
            <p className="text-[11px] text-base-content/70 leading-relaxed font-medium">
              This medicine is a{" "}
              <strong className="text-base-content">
                Schedule {medicine?.schedule}
              </strong>{" "}
              drug and requires a valid doctor's prescription. Please upload a
              clear photo or scan.
            </p>
          </div>

          <div className="space-y-1.5">
            <FieldLabel
              icon={FileImage}
              label="Prescription Document"
              hint="Max 5 MB"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative cursor-pointer border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
                file
                  ? "border-success/50 bg-success/5"
                  : "border-base-300 hover:border-primary/40 hover:bg-primary/3"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              {previewUrl ? (
                <div className="space-y-2 cursor-pointer">
                  <img
                    src={previewUrl}
                    alt="Prescription preview"
                    className="mx-auto max-h-32 rounded-lg object-contain border border-base-200 shadow-sm"
                  />
                  <p className="text-[10px] font-bold text-success flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {file.name}
                  </p>
                  <p className="text-[9px] text-base-content/30">
                    Click to change file
                  </p>
                </div>
              ) : file ? (
                <div className="space-y-2 cursor-pointer">
                  <FileImage className="w-10 h-10 text-success mx-auto" />
                  <p className="text-[10px] font-bold text-success">
                    {file.name}
                  </p>
                  <p className="text-[9px] text-base-content/30">
                    Click to change file
                  </p>
                </div>
              ) : (
                <div className="space-y-2 cursor-pointer">
                  <Upload className="w-10 h-10 text-base-content/15 mx-auto" />
                  <p className="text-xs font-bold text-base-content/50">
                    Click to upload prescription
                  </p>
                  <p className="text-[10px] text-base-content/25">
                    JPG, PNG, WebP or PDF · Max 5 MB
                  </p>
                </div>
              )}
            </div>
          </div>

          <p className="text-[10px] text-base-content/35 text-center">
            You may add the item to cart now and upload prescription later from
            your cart.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-base-200 flex gap-3">
          <SpecialButton
            as="button"
            role="pharmacy"
            variant="soft"
            size="md"
            animation="press"
            textAnimation="none"
            fullWidth
            title="Add Without Rx"
            onClick={onSkip}
            disabled={isUploading}
            className="rounded-[22px] cursor-pointer disabled:cursor-not-allowed"
          />
          <SpecialButton
            as="button"
            role="pharmacy"
            variant="solid"
            size="md"
            animation="press"
            textAnimation="none"
            fullWidth
            icon={
              isUploading
                ? (p) => (
                    <Loader2 {...p} className={`${p.className} animate-spin`} />
                  )
                : Upload
            }
            title={isUploading ? "Uploading…" : "Upload & Add"}
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="rounded-[22px] cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── CouponInput ──────────────────────────────────────────────────────────────

const CouponInput = ({
  orderTotal,
  coupon,
  couponLoading,
  couponError,
  onApply,
  onRemove,
}) => {
  const [inputCode, setInputCode] = useState("");
  const isApplied = Boolean(coupon?.code);

  const handleApply = () => {
    const t = inputCode.trim();
    if (!t) {
      toast.error("Enter a coupon code first.");
      return;
    }
    onApply(t, orderTotal);
  };

  return (
    <div className="space-y-2">
      <FieldLabel icon={Ticket} label="Promo / Coupon Code" hint="Optional" />

      {isApplied ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/25"
        >
          <BadgePercent className="w-4 h-4 text-success shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-success uppercase tracking-wider truncate">
              {coupon.code}
            </p>
            <p className="text-[10px] text-success/70 font-semibold">
              Saves ₹{coupon.discountAmount?.toFixed(2)}
              {coupon.benefitType === "Percentage" && coupon.maxCap
                ? ` (max ₹${coupon.maxCap})`
                : ""}
            </p>
          </div>
          <button
            onClick={() => {
              setInputCode("");
              onRemove();
            }}
            className="p-1 rounded-lg hover:bg-error/10 text-base-content/30 hover:text-error transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      ) : (
        <div className="flex gap-2">
          <input
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleApply()}
            placeholder="ENTER CODE"
            maxLength={20}
            disabled={couponLoading}
            className="input-field flex-1 text-xs uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-base-content/30"
          />
          <SpecialButton
            as="button"
            role="pharmacy"
            variant="solid"
            size="md"
            animation="press"
            textAnimation="none"
            uppercase
            icon={
              couponLoading
                ? (p) => (
                    <Loader2 {...p} className={`${p.className} animate-spin`} />
                  )
                : Ticket
            }
            title="Apply"
            onClick={handleApply}
            disabled={couponLoading || !inputCode.trim()}
            className="shrink-0 w-auto px-4 rounded-xl cursor-pointer disabled:cursor-not-allowed"
          />
        </div>
      )}

      <AnimatePresence>
        {couponError && !isApplied && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1.5 text-[10px] text-error font-bold"
          >
            <CircleSlash className="w-3 h-3 shrink-0" /> {couponError}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── BuyNowModal ──────────────────────────────────────────────────────────────

const BuyNowModal = ({
  med,
  quantity,
  baseTotal,
  storeId,
  walletBalance,
  coupon,
  couponLoading,
  couponError,
  onApplyCoupon,
  onRemoveCoupon,
  onClose,
  onSuccess,
  prescriptionImageUrl,
}) => {
  const dispatch = useDispatch();
  const isActing = useSelector(selectPharmacyActionLoading);

  // Local Delivery Pricing Fetch
  const deliveryPricing = useSelector(selectDeliveryPricing);
  const deliveryPricingLoading = useSelector(selectDeliveryPricingLoading);

  const [paymentMethod, setPaymentMethod] = useState("Razorpay");
  const [deliveryType, setDeliveryType] = useState("Standard");
  const [step, setStep] = useState("address");
  const [address, setAddress] = useState({
    fullName: "",
    line1: "",
    landmark: "",
    city: "Vijayawada",
    pincode: "",
    phone: "",
  });

  const subAndCouponTotal = coupon?.code
    ? (coupon.finalTotal ?? baseTotal)
    : baseTotal;

  // Fetch pricing whenever the sub/coupon total changes
  useEffect(() => {
    dispatch(
      fetchDeliveryPricing({
        orderTotal: subAndCouponTotal,
        deliveryType: "Standard",
      }),
    );
  }, [dispatch, subAndCouponTotal]);

  const platformFee = deliveryPricing?.platformFee ?? 5;
  const deliveryCharge =
    deliveryType === "Express"
      ? (deliveryPricing?.delivery?.express?.charge ?? 0)
      : (deliveryPricing?.delivery?.standard?.charge ?? 0);

  const grandTotal = subAndCouponTotal + deliveryCharge + platformFee;
  const isWalletInsufficient =
    paymentMethod === "Wallet" && (walletBalance ?? 0) < grandTotal;
  const isAddressValid =
    address.line1.trim() && address.pincode.trim() && address.fullName.trim();

  const handleFieldChange = useCallback((e) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!isAddressValid) {
      toast.error("Please fill in name, address and pincode.");
      return;
    }
    if (isWalletInsufficient) {
      toast.error(
        `Insufficient wallet balance. Available: ₹${walletBalance?.toFixed(2)}`,
      );
      return;
    }

    const payload = {
      medicineId: med._id,
      quantity,
      storeId,
      address,
      paymentMethod,
      deliveryType,
      ...(coupon?.code && { couponCode: coupon.code }),
      ...(prescriptionImageUrl && {
        prescription: { imageUrl: prescriptionImageUrl },
      }),
    };

    try {
      if (paymentMethod === "COD" || paymentMethod === "Wallet") {
        const r = await dispatch(placeDirectOrder(payload)).unwrap();
        onSuccess(r.order ?? r);
        return;
      }

      if (paymentMethod === "Razorpay") {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          toast.error("Razorpay SDK failed to load.");
          return;
        }

        const r = await dispatch(placeDirectOrder(payload)).unwrap();
        let payResp;
        try {
          payResp = await openRazorpayModal({
            rzpKey: RZP_KEY_PUBLIC,
            rzpOrderId: r.order.payment.razorpayOrderId,
            amount: r.order.billing.totalPayable,
            description: `${med.brandName} × ${quantity}`,
          });
        } catch (err) {
          toast.error(err.message || "Payment was not completed.");
          onClose();
          return;
        }

        const verified = await dispatch(
          verifyDirectPayment({
            razorpay_order_id: payResp.razorpay_order_id,
            razorpay_payment_id: payResp.razorpay_payment_id,
            razorpay_signature: payResp.razorpay_signature,
          }),
        ).unwrap();

        onSuccess(verified.order ?? verified);
      }
    } catch {
      // handled by thunk
    }
  }, [
    dispatch,
    med,
    quantity,
    storeId,
    address,
    paymentMethod,
    deliveryType,
    coupon,
    isAddressValid,
    isWalletInsufficient,
    walletBalance,
    prescriptionImageUrl,
    onSuccess,
    onClose,
  ]);

  const addressFields = [
    {
      name: "fullName",
      label: "Full Name",
      icon: User,
      placeholder: "Patient's full name",
      required: true,
      colSpan: 2,
      hint: "As on ID",
    },
    {
      name: "line1",
      label: "Address Line 1",
      icon: Home,
      placeholder: "Flat / Building / Street",
      required: true,
      colSpan: 2,
    },
    {
      name: "landmark",
      label: "Landmark",
      icon: Landmark,
      placeholder: "Near school, temple…",
      required: false,
      colSpan: 1,
      hint: "Optional",
    },
    {
      name: "city",
      label: "City",
      icon: MapPin,
      placeholder: "City",
      required: false,
      colSpan: 1,
    },
    {
      name: "pincode",
      label: "PIN Code",
      icon: Hash,
      placeholder: "520001",
      required: true,
      colSpan: 1,
      maxLength: 6,
      hint: "6 digits",
    },
    {
      name: "phone",
      label: "Mobile Number",
      icon: Phone,
      placeholder: "10-digit number",
      required: false,
      colSpan: 1,
      maxLength: 10,
      hint: "For delivery",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9000] bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 cursor-pointer"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="w-full max-w-lg bg-base-100 rounded-2xl shadow-2xl overflow-hidden border border-base-200 cursor-auto"
      >
        <div className="px-6 py-5 border-b border-base-200 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-black text-base text-base-content tracking-tight flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Buy Now
              </h3>
              <p className="text-[10px] text-base-content/40 font-semibold mt-0.5 uppercase tracking-wider">
                {med.brandName} · Qty {quantity}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {coupon?.code ? (
                  <>
                    <span className="line-through text-[11px] text-base-content/30 font-semibold">
                      ₹{baseTotal?.toFixed(2)}
                    </span>
                    <span className="text-sm font-black text-success">
                      ₹{subAndCouponTotal?.toFixed(2)}
                    </span>
                    <span className="text-[9px] bg-success/15 text-success font-bold px-1.5 py-0.5 rounded-md">
                      SAVED ₹{coupon.discountAmount?.toFixed(2)}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-black text-primary">
                    ₹{baseTotal?.toFixed(2)}
                  </span>
                )}
              </div>
              {med.isPrescriptionRequired && (
                <div
                  className={`flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-wider ${
                    prescriptionImageUrl ? "text-success" : "text-warning"
                  }`}
                >
                  {prescriptionImageUrl ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" /> Prescription attached
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" /> Prescription pending
                    </>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-base-200 transition-colors text-base-content/40 hover:text-base-content cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex border-b border-base-200 bg-base-200/40">
          {["address", "payment"].map((s, i) => (
            <button
              key={s}
              onClick={() =>
                step === "payment" && s === "address" && setStep("address")
              }
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative cursor-pointer ${
                step === s
                  ? "text-primary bg-base-100"
                  : "text-base-content/30 hover:text-base-content/60"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black mr-1.5 ${
                  step === s
                    ? "bg-primary text-primary-content"
                    : "bg-base-300 text-base-content/40"
                }`}
              >
                {i + 1}
              </span>
              {s}
              {step === s && (
                <motion.div
                  layoutId="buyNowTabLine"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-4 max-h-[58vh] overflow-y-auto">
          {/* ── Step 1: Address & Delivery Mode ── */}
          {step === "address" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                <p className="text-[10px] font-semibold text-primary/80">
                  Enter your delivery address. Fields marked{" "}
                  <span className="text-error">*</span> are required.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {addressFields.map((field) => (
                  <div
                    key={field.name}
                    className={
                      field.colSpan === 2 ? "col-span-2" : "col-span-1"
                    }
                  >
                    <FieldLabel
                      icon={field.icon}
                      label={field.label}
                      required={field.required}
                      hint={field.hint}
                    />
                    <input
                      name={field.name}
                      value={address[field.name]}
                      onChange={handleFieldChange}
                      placeholder={field.placeholder}
                      maxLength={field.maxLength}
                      className="input-field w-full text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Delivery Speed Selection */}
              <div className="pt-2 border-t border-base-200">
                <FieldLabel icon={Truck} label="Delivery Speed" />
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <label
                    className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      deliveryType === "Standard"
                        ? "border-primary bg-primary/5"
                        : "border-base-200 hover:border-primary/30 hover:bg-base-200/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliverySpeed"
                      value="Standard"
                      checked={deliveryType === "Standard"}
                      onChange={() => setDeliveryType("Standard")}
                      className="hidden"
                    />
                    <span className="text-[11px] font-black text-base-content">
                      Standard
                    </span>
                    <span className="text-[9px] font-semibold text-base-content/50 mt-1">
                      2-4 Hours
                    </span>
                    <span className="text-[10px] font-black text-primary mt-1">
                      {deliveryPricing?.delivery?.standard?.isFree
                        ? "FREE"
                        : `₹${deliveryPricing?.delivery?.standard?.charge ?? 0}`}
                    </span>
                    {deliveryType === "Standard" && (
                      <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </label>

                  <label
                    className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      deliveryType === "Express"
                        ? "border-primary bg-primary/5"
                        : "border-base-200 hover:border-primary/30 hover:bg-base-200/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliverySpeed"
                      value="Express"
                      checked={deliveryType === "Express"}
                      onChange={() => setDeliveryType("Express")}
                      className="hidden"
                    />
                    <span className="text-[11px] font-black text-base-content flex items-center gap-1">
                      <Zap className="w-3 h-3 text-warning fill-warning" />{" "}
                      Express
                    </span>
                    <span className="text-[9px] font-semibold text-base-content/50 mt-1">
                      30-60 Mins
                    </span>
                    <span className="text-[10px] font-black text-primary mt-1">
                      {deliveryPricing?.delivery?.express?.isFree
                        ? "FREE"
                        : `₹${deliveryPricing?.delivery?.express?.charge ?? 49}`}
                    </span>
                    {deliveryType === "Express" && (
                      <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Payment ── */}
          {step === "payment" && (
            <div className="space-y-4">
              <CouponInput
                orderTotal={subAndCouponTotal}
                coupon={coupon}
                couponLoading={couponLoading}
                couponError={couponError}
                onApply={onApplyCoupon}
                onRemove={onRemoveCoupon}
              />

              <div className="border-t border-base-200" />

              <div className="space-y-2">
                <FieldLabel icon={CreditCard} label="Payment Method" />
                {PAYMENT_METHODS.map(({ id, label, icon: Icon, desc }) => {
                  const insufficient =
                    id === "Wallet" && (walletBalance ?? 0) < grandTotal;
                  return (
                    <button
                      key={id}
                      onClick={() => !insufficient && setPaymentMethod(id)}
                      disabled={insufficient}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                        paymentMethod === id
                          ? "border-primary bg-primary/5 shadow-sm cursor-pointer"
                          : insufficient
                            ? "border-base-200 opacity-40 cursor-not-allowed"
                            : "border-base-200 hover:border-primary/40 hover:bg-base-200/50 cursor-pointer"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                          paymentMethod === id
                            ? "bg-primary text-primary-content"
                            : "bg-base-200 text-base-content/50"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-base-content">
                          {label}
                        </p>
                        <p className="text-[10px] text-base-content/40 font-medium">
                          {id === "Wallet"
                            ? `Balance: ₹${(walletBalance ?? 0).toFixed(2)}${insufficient ? " — Insufficient" : ""}`
                            : desc}
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          paymentMethod === id
                            ? "border-primary bg-primary"
                            : "border-base-300"
                        }`}
                      >
                        {paymentMethod === id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary-content" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Order Summary */}
              <div className="space-y-1.5">
                <FieldLabel icon={Package} label="Order Summary" />
                <div className="p-4 rounded-xl bg-base-200/60 border border-base-300 space-y-2">
                  <div className="flex justify-between text-xs text-base-content/60 font-medium">
                    <span>
                      {med.brandName} × {quantity}
                    </span>
                    <span className="font-bold">₹{baseTotal?.toFixed(2)}</span>
                  </div>

                  <AnimatePresence>
                    {coupon?.code && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        <div className="flex justify-between text-xs text-success font-bold mt-1">
                          <span className="flex items-center gap-1">
                            <BadgePercent className="w-3 h-3" /> {coupon.code}
                          </span>
                          <span>- ₹{coupon.discountAmount?.toFixed(2)}</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex justify-between text-xs text-base-content/60 font-medium mt-1">
                    <span>Delivery ({deliveryType})</span>
                    <span>
                      {deliveryCharge > 0
                        ? `₹${deliveryCharge.toFixed(2)}`
                        : "FREE"}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-base-content/60 font-medium mt-1">
                    <span>Platform Fee</span>
                    <span>₹{platformFee.toFixed(2)}</span>
                  </div>

                  {med.isPrescriptionRequired && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-base-content/50">Prescription</span>
                      <span
                        className={`font-bold ${prescriptionImageUrl ? "text-success" : "text-warning"}`}
                      >
                        {prescriptionImageUrl ? "✓ Uploaded" : "⚠ Pending"}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-xs font-black text-base-content border-t border-base-300/60 pt-2 mt-2">
                    <span>Grand Total</span>
                    <span className="text-primary text-sm">
                      ₹{grandTotal?.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-base-200 flex gap-3 bg-base-200/30">
          {step === "address" ? (
            <>
              <SpecialButton
                as="button"
                role="pharmacy"
                variant="soft"
                size="md"
                animation="press"
                textAnimation="none"
                fullWidth
                title="Cancel"
                onClick={onClose}
                className="rounded-[22px] cursor-pointer"
              />
              <SpecialButton
                as="button"
                role="pharmacy"
                variant="solid"
                size="md"
                animation="press"
                textAnimation="none"
                fullWidth
                icon={ChevronRightIcon}
                iconPosition="right"
                title="Continue"
                onClick={() => {
                  if (!isAddressValid) {
                    toast.error("Please fill all required fields.");
                    return;
                  }
                  setStep("payment");
                }}
                className="rounded-[22px] cursor-pointer"
              />
            </>
          ) : (
            <>
              <SpecialButton
                as="button"
                role="pharmacy"
                variant="soft"
                size="md"
                animation="press"
                textAnimation="none"
                fullWidth
                icon={ChevronLeft}
                iconPosition="left"
                title="Back"
                onClick={() => setStep("address")}
                className="rounded-[22px] cursor-pointer"
              />
              <SpecialButton
                as="button"
                role="pharmacy"
                variant="solid"
                size="md"
                animation="press"
                textAnimation="none"
                fullWidth
                icon={
                  isActing
                    ? (p) => (
                        <RefreshCw
                          {...p}
                          className={`${p.className} animate-spin`}
                        />
                      )
                    : paymentMethod === "COD"
                      ? Package
                      : paymentMethod === "Wallet"
                        ? Wallet
                        : CreditCard
                }
                title={
                  isActing
                    ? "Processing…"
                    : paymentMethod === "COD"
                      ? "Place Order"
                      : `Pay ₹${grandTotal?.toFixed(2)}`
                }
                onClick={handleConfirm}
                disabled={
                  isActing || isWalletInsufficient || deliveryPricingLoading
                }
                className="rounded-[22px] cursor-pointer disabled:cursor-not-allowed"
              />
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─── OrderSuccessModal ────────────────────────────────────────────────────────

const OrderSuccessModal = ({ order, onClose, onViewOrders }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[9100] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
  >
    <motion.div
      initial={{ scale: 0.88, opacity: 0, y: 16 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.88, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="w-full max-w-sm bg-base-100 rounded-2xl shadow-2xl overflow-hidden border border-base-200 cursor-auto"
    >
      <div className="bg-gradient-to-br from-success/10 to-success/5 px-6 pt-8 pb-6 text-center border-b border-base-200">
        <div className="w-16 h-16 rounded-2xl bg-success/15 flex items-center justify-center mx-auto mb-4 shadow-sm">
          <CheckCircle2 className="w-9 h-9 text-success" />
        </div>
        <h3 className="text-lg font-black text-base-content mb-1 tracking-tight">
          Order Placed!
        </h3>
        <p className="text-[10px] text-base-content/40 font-semibold uppercase tracking-widest">
          #{order?.orderId}
        </p>
      </div>

      <div className="p-5 space-y-2">
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-base-200/60">
            <span className="text-base-content/50 font-medium flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5" /> Payment
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${order?.payment?.status === "Paid" ? "bg-success" : "bg-warning"}`}
              />
              <span className="font-bold text-base-content capitalize">
                {order?.payment?.status}
              </span>
              <span className="text-base-content/40">·</span>
              <span className="font-bold text-base-content/70">
                {order?.payment?.method}
              </span>
            </div>
          </div>

          {order?.billing?.promoCode && (
            <div className="flex items-center justify-between py-2 border-b border-base-200/60">
              <span className="text-base-content/50 font-medium flex items-center gap-1.5">
                <BadgePercent className="w-3.5 h-3.5" /> Coupon
              </span>
              <span className="font-bold text-success">
                {order.billing.promoCode} saved ₹
                {order.billing.discountAmount?.toFixed(2)}
              </span>
            </div>
          )}

          {order?.prescription?.isRequired && (
            <div className="flex items-center justify-between py-2 border-b border-base-200/60">
              <span className="text-base-content/50 font-medium flex items-center gap-1.5">
                <FileImage className="w-3.5 h-3.5" /> Prescription
              </span>
              <span
                className={`font-bold ${order.prescription.imageUrl ? "text-success" : "text-warning"}`}
              >
                {order.prescription.imageUrl ? "✓ Submitted" : "⚠ Pending"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <span className="text-base-content/50 font-medium">
              Grand Total
            </span>
            <span className="font-black text-primary text-base">
              ₹{order?.billing?.totalPayable?.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 flex gap-3">
        <SpecialButton
          as="button"
          role="pharmacy"
          variant="soft"
          size="md"
          animation="press"
          textAnimation="none"
          fullWidth
          title="Continue Shopping"
          onClick={onClose}
          className="rounded-[22px] cursor-pointer"
        />
        <SpecialButton
          as="button"
          role="pharmacy"
          variant="solid"
          size="md"
          animation="press"
          textAnimation="none"
          fullWidth
          title="View Orders"
          onClick={onViewOrders}
          className="rounded-[22px] cursor-pointer"
        />
      </div>
    </motion.div>
  </motion.div>
);

// ─── Medicine Card ────────────────────────────────────────────────────────────

const MedicineCard = ({
  medicine,
  viewMode,
  onViewDetail,
  onAddToCart,
  onBuyNow,
  isActingId,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const primaryImage =
    medicine.images?.find((img) => img.isPrimary)?.url ??
    medicine.images?.[0]?.url ??
    null;

  const CategoryIcon = CATEGORY_ICONS[medicine.category] ?? Pill;
  const isListView = viewMode === "list";

  // Make sure we only show outOfStock if inventory exists but is fully depleted
  const hasInventory =
    Array.isArray(medicine.inventory) && medicine.inventory.length > 0;
  const totalStock = useMemo(
    () =>
      hasInventory
        ? medicine.inventory.reduce(
            (sum, inv) => sum + (inv.stockQuantity || 0),
            0,
          )
        : null,
    [medicine.inventory, hasInventory],
  );

  const isOutOfStock =
    medicine.isDiscontinued || (totalStock !== null && totalStock <= 0);
  const isThisActing = isActingId === medicine._id;
  const needsRx = medicine.isPrescriptionRequired;

  const bestInv = getBestInventory(medicine.inventory);
  const storeName =
    bestInv?.storeId && typeof bestInv.storeId === "object"
      ? (bestInv.storeId.storeName ?? null)
      : null;

  return (
    <motion.div
      variants={cardVariants}
      layout
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`glass-card group relative flex flex-col h-full overflow-hidden transition-all duration-300 ${
        isListView ? "md:flex-row md:items-stretch" : ""
      }`}
    >
      <div
        className={`relative bg-gradient-to-br from-base-200 to-base-300 shrink-0 overflow-hidden ${
          isListView ? "w-full md:w-52 min-h-[11rem]" : "h-48"
        }`}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={medicine.brandName}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CategoryIcon size={52} className="text-primary/15" />
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          <span className="bg-base-100/80 backdrop-blur-md text-base-content/70 text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm border border-base-200/60 uppercase tracking-wider">
            {medicine.category}
          </span>
          <MedicineStatus medicine={medicine} />
          {needsRx && (
            <span className="bg-warning/90 backdrop-blur-md text-warning-content text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm flex items-center gap-1">
              <AlertTriangle size={9} /> Rx Only
            </span>
          )}
        </div>

        <AnimatePresence>
          {isHovered && !isListView && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex justify-center"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onViewDetail(medicine.slug);
                }}
                className="bg-primary text-primary-content text-[10px] font-black py-1.5 px-4 rounded-lg shadow-lg flex items-center gap-2 hover:brightness-110 transition-all cursor-pointer"
              >
                <Eye size={12} /> QUICK VIEW
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 p-4 flex flex-col">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="space-y-0.5 min-w-0 flex-1">
            <h3 className="text-sm font-black text-base-content leading-tight group-hover:text-primary transition-colors truncate tracking-tight">
              {medicine.brandName}
            </h3>
            <p className="text-[10px] font-semibold text-base-content/45 uppercase tracking-wider truncate">
              {medicine.genericName}
            </p>
          </div>
          <ScheduleBadge schedule={medicine.schedule} />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {medicine.dosage && (
            <span className="flex items-center gap-1 text-[9px] text-base-content/55 font-bold bg-base-200 px-2 py-0.5 rounded-lg">
              <Thermometer size={9} className="text-secondary" />
              {medicine.dosage}
            </span>
          )}
          {medicine.packaging && (
            <span className="flex items-center gap-1 text-[9px] text-base-content/55 font-bold bg-base-200 px-2 py-0.5 rounded-lg">
              <Scale size={9} className="text-secondary" />
              {medicine.packaging}
            </span>
          )}
          {medicine.manufacturer && (
            <span className="text-[9px] text-base-content/35 font-medium truncate">
              by {medicine.manufacturer}
            </span>
          )}
        </div>

        {storeName && (
          <div className="flex items-center gap-1 text-[9px] text-base-content/35 font-bold mb-2 truncate">
            <Building2 size={9} className="shrink-0" /> {storeName}
          </div>
        )}

        {needsRx && (
          <div className="flex items-center gap-1.5 mb-2.5 px-2.5 py-1.5 rounded-lg bg-warning/5 border border-warning/20">
            <AlertTriangle size={10} className="text-warning shrink-0" />
            <p className="text-[9px] font-bold text-warning/80 leading-tight">
              Prescription required — upload before purchase
            </p>
          </div>
        )}

        {medicine.indications?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {medicine.indications.slice(0, 2).map((ind, idx) => (
              <span
                key={idx}
                className="bg-base-300/60 text-base-content/55 text-[9px] px-1.5 py-0.5 rounded-md font-semibold lowercase"
              >
                #{ind}
              </span>
            ))}
          </div>
        )}

        {medicine.saltComposition?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {medicine.saltComposition.slice(0, 2).map((salt, idx) => (
              <span
                key={idx}
                className="bg-primary/5 text-primary text-[9px] px-2 py-0.5 rounded-md font-bold border border-primary/10"
              >
                {salt.ingredient} {salt.strength}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t border-base-200/70">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                {(() => {
                  const base =
                    bestInv?.pricePerUnit ?? medicine.referenceMrp ?? 0;
                  const gstPct = medicine.gstPercentage ?? 0;
                  const final = parseFloat(
                    (base * (1 + gstPct / 100)).toFixed(2),
                  );
                  return (
                    <>
                      <span className="text-lg font-black text-primary tracking-tight">
                        ₹{final}
                      </span>
                      {gstPct > 0 && (
                        <span className="text-[9px] text-base-content/30 font-bold">
                          incl. {gstPct}% GST
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <p className="text-[9px] font-bold text-success flex items-center gap-1">
                <ShieldCheck size={9} /> Verified Authentic
              </p>
            </div>

            <button
              onClick={() => onViewDetail(medicine.slug)}
              aria-label={`View details for ${medicine.brandName}`}
              className="w-9 h-9 flex items-center justify-center bg-primary/8 text-primary rounded-xl hover:bg-primary hover:text-primary-content transition-all duration-200 shadow-sm shrink-0 cursor-pointer"
            >
              <ArrowRight size={16} />
            </button>
          </div>

          {!isOutOfStock ? (
            <div className="grid grid-cols-2 gap-2">
              <SpecialButton
                as="button"
                role="pharmacy"
                variant="outline"
                size="sm"
                animation="press"
                textAnimation="none"
                icon={
                  isThisActing
                    ? (p) => (
                        <RefreshCw
                          {...p}
                          className={`${p.className} animate-spin`}
                        />
                      )
                    : needsRx
                      ? FileImage
                      : ShoppingCart
                }
                title={isThisActing ? "" : needsRx ? "Add + Rx" : "Cart"}
                onClick={() => onAddToCart(medicine)}
                disabled={isThisActing}
                aria-label={`Add ${medicine.brandName} to cart`}
                className="rounded-[22px] cursor-pointer disabled:cursor-not-allowed"
              />

              <SpecialButton
                as="button"
                role="pharmacy"
                variant="solid"
                size="sm"
                animation="press"
                textAnimation="none"
                icon={
                  isThisActing
                    ? (p) => (
                        <RefreshCw
                          {...p}
                          className={`${p.className} animate-spin`}
                        />
                      )
                    : Zap
                }
                title={isThisActing ? "" : "Buy Now"}
                onClick={() => onBuyNow(medicine)}
                disabled={isThisActing}
                aria-label={`Buy ${medicine.brandName} now`}
                className="rounded-[22px] cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-base-200/60 border border-base-300">
              <CircleSlash size={12} className="text-base-content/30" />
              <p className="text-[10px] font-bold text-base-content/40 uppercase tracking-wider">
                {medicine.isDiscontinued ? "Discontinued" : "Out of stock"}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const MemoMedicineCard = MemoizedMedicineCard(MedicineCard);

function MemoizedMedicineCard(Component) {
  return function Wrapped(props) {
    return useMemo(
      () => <Component {...props} />,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [props.medicine, props.viewMode, props.isActingId],
    );
  };
}

// ─── FilterContent ────────────────────────────────────────────────────────────

const FilterContent = ({
  filters,
  updateFilters,
  resetFilters,
  activeFiltersCount,
}) => (
  <div className="space-y-7">
    <div className="flex items-center justify-between pb-3 border-b border-base-200">
      <h2 className="text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2 text-base-content/50">
        <SlidersHorizontal size={12} /> Refine Results
      </h2>
      {activeFiltersCount > 0 && (
        <button
          onClick={resetFilters}
          className="text-[10px] font-black text-error uppercase hover:underline flex items-center gap-1 cursor-pointer"
        >
          <X size={10} /> Reset ({activeFiltersCount})
        </button>
      )}
    </div>

    <div>
      <FieldLabel icon={Tag} label="Medicine Category" />
      <div className="grid grid-cols-1 gap-1.5 mt-2">
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat] ?? Pill;
          const active = filters.categories.includes(cat);
          return (
            <label
              key={cat}
              className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
                active
                  ? "bg-primary/8 border-primary/25 text-primary"
                  : "border-transparent hover:bg-base-200 text-base-content/60 hover:text-base-content"
              }`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => {
                  const updated = active
                    ? filters.categories.filter((c) => c !== cat)
                    : [...filters.categories, cat];
                  updateFilters({ ...filters, categories: updated });
                }}
                className="w-3.5 h-3.5 accent-primary cursor-pointer rounded"
              />
              <Icon
                size={13}
                className={active ? "text-primary" : "text-base-content/35"}
              />
              <span
                className={`text-xs font-bold ${active ? "text-primary" : ""}`}
              >
                {cat}
              </span>
            </label>
          );
        })}
      </div>
    </div>

    <div>
      <FieldLabel
        icon={ShieldAlert}
        label="Drug Schedule"
        hint="Regulatory class"
      />
      <div className="grid grid-cols-2 gap-2 mt-2">
        {SCHEDULES.map((sch) => {
          const active = filters.schedules.includes(sch);
          return (
            <button
              key={sch}
              onClick={() => {
                const updated = active
                  ? filters.schedules.filter((s) => s !== sch)
                  : [...filters.schedules, sch];
                updateFilters({ ...filters, schedules: updated });
              }}
              className={`py-2 px-3 rounded-xl text-[10px] font-black border-2 transition-all cursor-pointer ${
                active
                  ? "bg-secondary border-secondary text-secondary-content shadow-sm"
                  : "bg-transparent border-base-200 text-base-content/45 hover:border-secondary/50 hover:text-base-content"
              }`}
            >
              {sch === "None" ? "OTC" : `Sch. ${sch}`}
            </button>
          );
        })}
      </div>
    </div>

    <div className="space-y-2.5">
      <FieldLabel icon={Filter} label="Quick Filters" />
      {[
        {
          key: "prescriptionOnly",
          label: "Prescription Required",
          icon: FileImage,
          tooltip: "Show only prescription medicines",
        },
        {
          key: "hideDiscontinued",
          label: "In Stock Only",
          icon: CheckCircle2,
          tooltip: "Hide out of stock items",
        },
      ].map(({ key, label, icon: Icon, tooltip }) => (
        <label
          key={key}
          title={tooltip}
          className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
            filters[key]
              ? "bg-primary/8 border-primary/25"
              : "bg-base-200/60 border-base-200 hover:border-primary/20"
          }`}
        >
          <span
            className={`flex items-center gap-2 text-[11px] font-bold ${filters[key] ? "text-primary" : "text-base-content/60"}`}
          >
            <Icon size={12} />
            {label}
          </span>
          <div
            onClick={() => updateFilters({ ...filters, [key]: !filters[key] })}
            className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${filters[key] ? "bg-primary" : "bg-base-300"}`}
            style={{ height: "1.1rem" }}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${filters[key] ? "translate-x-4" : "translate-x-0.5"}`}
            />
          </div>
        </label>
      ))}
    </div>

    <div className="p-3.5 bg-primary/4 rounded-xl border border-primary/10">
      <div className="flex gap-2.5">
        <ShieldAlert size={14} className="text-primary shrink-0 mt-0.5" />
        <p className="text-[10px] leading-relaxed text-base-content/60 font-medium">
          <strong className="text-base-content/80">Safety First:</strong> Never
          self-medicate. Prescription medicines require a valid doctor's note.
        </p>
      </div>
    </div>
  </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MedicinePage({ router }) {
  const dispatch = useDispatch();

  // ── Selectors ──
  const medicines = useSelector(selectMedicines);
  const loading = useSelector(selectMedicineLoading);
  const pagination = useSelector(selectMedicinePagination);
  const error = useSelector(selectMedicineError);
  const isActing = useSelector(selectPharmacyActionLoading);
  const coupon = useSelector(selectCoupon);
  const couponLoading = useSelector(selectCouponLoading);
  const couponError = useSelector(selectCouponError);
  const walletBalance = useSelector(selectWalletBalance);
  const isUploading = useSelector((s) => s.upload.isUploading);

  const mySub = useSelector(selectMySubscription);
  const subscriptionDiscountPct = mySub?.limits?.pharmacyDiscountPercent ?? 0;

// ── UI State ──
  const [search, setSearch] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false); // Added state
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("default");
  const [viewMode, setViewMode] = useState("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  // ── Cart / Buy Now ──
  const [actingMedId, setActingMedId] = useState(null);
  const [buyNowMed, setBuyNowMed] = useState(null);
  const [buyNowQty] = useState(1);
  const [showBuyNowModal, setShowBuyNowModal] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // ── Prescription Upload ──
  const [rxMedicine, setRxMedicine] = useState(null);
  const [showRxModal, setShowRxModal] = useState(false);
  const [pendingRxAction, setPendingRxAction] = useState(null);
  const [rxUploadedUrl, setRxUploadedUrl] = useState(null);

  const searchRef = useRef(null);
  const sortRef = useRef(null);

useEffect(() => {
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) {
        setIsSortOpen(false);
      }
      // Click outside logic for search dropdown
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    dispatch(clearMedicineError());
  }, [dispatch]);

  // Reduced debounce to 250ms for faster backend sync
  // Enforce strict limit of 10 items per page
  const fetchContent = useCallback(
    (q, f, s, p) => {
      dispatch(
        fetchMedicines({
          page: p,
          limit: 10, // 👈 Changed from 50 to 10
          search: q || undefined,
          category: f.categories.length ? f.categories.join(",") : undefined,
          schedule: f.schedules.length ? f.schedules.join(",") : undefined,
          isPrescriptionRequired: f.prescriptionOnly ? true : undefined,
          isDiscontinued: f.hideDiscontinued ? false : undefined,
          sort: s,
        }),
      );
    },
    [dispatch],
  );

  // Reduced debounce to 250ms for lightning-fast backend response
  useEffect(() => {
    const t = setTimeout(
      () => fetchContent(search, filters, sort, currentPage),
      250,
    );
    return () => clearTimeout(t);
  }, [search, filters, sort, currentPage, fetchContent]);

  const updateFilters = useCallback((v) => {
    setFilters(v);
    setCurrentPage(1);
  }, []);
  const resetFilters = useCallback(() => {
    setSearch("");
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  }, []);

  // INSTANT CLIENT-SIDE FILTERING: Filters loaded data instantly on keystroke
  const displayedMedicines = useMemo(() => {
    if (!search.trim()) return medicines;
    const term = search.toLowerCase().trim();

    return medicines.filter((med) => {
      if (med.brandName?.toLowerCase().includes(term)) return true;
      if (med.genericName?.toLowerCase().includes(term)) return true;
      if (med.category?.toLowerCase().includes(term)) return true;
      if (med.drugForm?.toLowerCase().includes(term)) return true;
      if (med.indications?.some((ind) => ind.toLowerCase().includes(term)))
        return true;
      if (med.searchKeywords?.some((kw) => kw.toLowerCase().includes(term)))
        return true;
      if (
        med.saltComposition?.some((salt) =>
          salt.ingredient?.toLowerCase().includes(term),
        )
      )
        return true;
      return false;
    });
  }, [medicines, search]);

  const handleViewDetail = useCallback(
    (slug) => {
      const path = `/pharmacy/buy-medicines/${slug}`;
      if (router) router.push(path);
      else window.location.href = path;
    },
    [router],
  );

  const executeAddToCart = useCallback(
    async (medicine, prescriptionImageUrl = null) => {
      const bestInv = getBestInventory(medicine.inventory);
      const storeId = extractStoreId(bestInv?.storeId);
      if (
        !storeId &&
        Array.isArray(medicine.inventory) &&
        medicine.inventory.length > 0
      ) {
        toast.error("No store available for this medicine.");
        return;
      }

      setActingMedId(medicine._id);
      try {
        await dispatch(
          addToCart({
            medicineId: medicine._id,
            quantity: 1,
            storeId,
            ...(prescriptionImageUrl && {
              prescription: { imageUrl: prescriptionImageUrl },
            }),
          }),
        ).unwrap();
        if (medicine.isPrescriptionRequired && !prescriptionImageUrl) {
          toast("Prescription needed — upload it from your cart.", {
            icon: "📋",
            duration: 4000,
          });
        }
      } catch {
        // handled by thunk
      } finally {
        setActingMedId(null);
      }
    },
    [dispatch],
  );

  const handleAddToCart = useCallback(
    (medicine) => {
      if (medicine.isPrescriptionRequired) {
        setRxMedicine(medicine);
        setPendingRxAction("cart");
        setShowRxModal(true);
        return;
      }
      executeAddToCart(medicine);
    },
    [executeAddToCart],
  );

  const handleBuyNow = useCallback(
    (medicine) => {
      const bestInv = getBestInventory(medicine.inventory);
      if (
        !extractStoreId(bestInv?.storeId) &&
        Array.isArray(medicine.inventory) &&
        medicine.inventory.length > 0
      ) {
        toast.error("No store available for this medicine.");
        return;
      }

      dispatch(clearCoupon());
      setRxUploadedUrl(null);
      if (medicine.isPrescriptionRequired) {
        setRxMedicine(medicine);
        setPendingRxAction("buyNow");
        setShowRxModal(true);
        return;
      }
      setBuyNowMed(medicine);
      setShowBuyNowModal(true);
    },
    [dispatch],
  );

  const handleRxUploadAndProceed = useCallback(
    async (file) => {
      try {
        const result = await dispatch(
          uploadSingleFile({ file, folder: "prescriptions" }),
        ).unwrap();
        const uploadedUrl = result?.url;
        if (!uploadedUrl) {
          toast.error("Upload failed — no URL returned.");
          return;
        }
        setShowRxModal(false);
        if (pendingRxAction === "cart") {
          await executeAddToCart(rxMedicine, uploadedUrl);
        } else if (pendingRxAction === "buyNow") {
          setRxUploadedUrl(uploadedUrl);
          setBuyNowMed(rxMedicine);
          setShowBuyNowModal(true);
        }
        setRxMedicine(null);
        setPendingRxAction(null);
      } catch {
        // handled
      }
    },
    [dispatch, pendingRxAction, rxMedicine, executeAddToCart],
  );

  const handleRxSkip = useCallback(() => {
    setShowRxModal(false);
    if (pendingRxAction === "cart") {
      executeAddToCart(rxMedicine);
    } else if (pendingRxAction === "buyNow") {
      setRxUploadedUrl(null);
      setBuyNowMed(rxMedicine);
      setShowBuyNowModal(true);
    }
    setRxMedicine(null);
    setPendingRxAction(null);
  }, [pendingRxAction, rxMedicine, executeAddToCart]);

  const handleRxClose = useCallback(() => {
    setShowRxModal(false);
    setRxMedicine(null);
    setPendingRxAction(null);
  }, []);

  const handleApplyCoupon = useCallback(
    (code, total) => {
      dispatch(validateCoupon({ couponCode: code, orderTotal: total }));
    },
    [dispatch],
  );
  const handleRemoveCoupon = useCallback(() => {
    dispatch(clearCoupon());
  }, [dispatch]);

  const handleOrderSuccess = useCallback(
    (order) => {
      setCompletedOrder(order);
      setShowBuyNowModal(false);
      setShowSuccessModal(true);
      setRxUploadedUrl(null);
      dispatch(clearCoupon());
    },
    [dispatch],
  );

  const buyNowBestInv = useMemo(
    () => getBestInventory(buyNowMed?.inventory),
    [buyNowMed],
  );
  const buyNowStoreId = useMemo(
    () => extractStoreId(buyNowBestInv?.storeId),
    [buyNowBestInv],
  );

  const buyNowBaseTotal = useMemo(() => {
    if (!buyNowMed) return 0;
    const price = buyNowBestInv?.pricePerUnit ?? buyNowMed.referenceMrp ?? 0;
    const gstPct = buyNowMed.gstPercentage ?? 0;
    const priceWithGst = parseFloat((price * (1 + gstPct / 100)).toFixed(2));
    const raw = priceWithGst * buyNowQty;
    const disc = raw * (subscriptionDiscountPct / 100);
    return parseFloat((raw - disc).toFixed(2));
  }, [buyNowMed, buyNowBestInv, buyNowQty, subscriptionDiscountPct]);

  const activeFiltersCount = useMemo(() => {
    let count = filters.categories.length + filters.schedules.length;
    if (filters.prescriptionOnly) count++;
    if (filters.hideDiscontinued) count++;
    return count;
  }, [filters]);

  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages ?? 1;
    return [...Array(total)]
      .map((_, i) => i + 1)
      .filter(
        (p) =>
          p === 1 ||
          p === total ||
          (p >= currentPage - 1 && p <= currentPage + 1),
      );
  }, [pagination.totalPages, currentPage]);

  return (
    <Container>
      <div
        data-theme="customer"
        className="min-h-screen bg-base-100 mt-4 text-base-content"
      >
        {/* ── Hero Ad Slot ── */}
        <Ads page="Medicine_Store" slot="Hero_Banner" />

        {/* ── Breadcrumb ── */}
        <div className="flex items-center gap-2 mt-4 mb-5">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-[11px] font-bold text-base-content/40 hover:text-primary transition-colors uppercase tracking-widest cursor-pointer"
          >
            <ChevronLeft size={14} /> Home
          </Link>
          <span className="text-base-content/20 text-xs">/</span>
          <span className="text-[11px] font-black text-base-content/70 uppercase tracking-widest">
            Medicine Store
          </span>
        </div>

        {/* ── Page Header ── */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-base-content tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Pill className="w-4.5 h-4.5 text-primary" />
              </div>
              Medicine Store
            </h1>
            <p className="text-[11px] text-base-content/40 font-semibold mt-1 uppercase tracking-widest">
              Verified authentic · Fast delivery · Schedule-compliant
            </p>
          </div>
          <div className="hidden md:flex items-center gap-4">
            {[
              { label: "Products", value: pagination.total ?? "—" },
              { label: "Categories", value: CATEGORIES.length },
              { label: "Stores", value: "3+" },
            ].map((stat) => (
              <div key={stat.label} className="text-right">
                <p className="text-base font-black text-primary leading-tight">
                  {stat.value}
                </p>
                <p className="text-[9px] font-bold text-base-content/35 uppercase tracking-widest">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="w-full relative z-[10] mb-6">
          <div className="bg-base-100 p-2.5 rounded-2xl border border-base-200 shadow-sm flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center">
{/* Search */}
            <div className="relative flex-1 group" ref={searchRef}>
              <Search
                className="absolute left-4 top-[22px] -translate-y-1/2 text-primary/30 group-focus-within:text-primary transition-colors z-[12]"
                size={17}
              />
              <input
                type="search"
                value={search}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                  setIsSearchFocused(true);
                }}
                placeholder="Search by brand, generic, salt, indication, category…"
                aria-label="Search medicines"
                className="w-full h-11 pl-11 pr-4 bg-base-200/70 border border-base-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all placeholder:text-base-content/25 relative z-[11] [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setIsSearchFocused(false);
                  }}
                  title="Clear search"
                  className="absolute right-3 top-[22px] -translate-y-1/2 p-1 rounded-md hover:bg-base-300 text-base-content/30 transition-colors cursor-pointer z-[12]"
                >
                  <X size={13} />
                </button>
              )}

              {/* AUTOCOMPLETE DROPDOWN */}
              <AnimatePresence>
                {isSearchFocused && search.trim().length >= 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-base-100 shadow-2xl border border-base-200 rounded-2xl overflow-hidden z-[100]"
                  >
                    {loading ? (
                      <div className="p-6 flex items-center justify-center gap-2 text-primary text-sm font-bold">
                        <RefreshCw size={16} className="animate-spin" /> Fetching medicines...
                      </div>
                    ) : displayedMedicines.length > 0 ? (
                      <div className="p-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-base-content/40 px-3 pt-2 pb-1.5">
                          Top Results
                        </p>
                        
                        {/* Scrollable Container */}
                        <div className="max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
                          {displayedMedicines.map((med) => {
                            const primaryImage = med.images?.find((img) => img.isPrimary)?.url ?? med.images?.[0]?.url;
                            const CategoryIcon = CATEGORY_ICONS[med.category] ?? Pill;

                            return (
                              <button
                                key={med._id}
                                type="button"
                                onClick={() => {
                                  setIsSearchFocused(false);
                                  handleViewDetail(med.slug);
                                }}
                                className="w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-base-200 transition-colors cursor-pointer group"
                              >
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-base-300 shrink-0 bg-base-100 flex items-center justify-center">
                                  {primaryImage ? (
                                    <img src={primaryImage} alt={med.brandName} className="w-full h-full object-cover" />
                                  ) : (
                                    <CategoryIcon size={20} className="text-base-content/20" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-sm text-base-content truncate group-hover:text-primary transition-colors">
                                    {med.brandName}
                                  </h4>
                                  <p className="text-[11px] font-medium text-base-content/60 truncate">
                                    {med.genericName}
                                  </p>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-base-100 flex items-center justify-center border border-base-300 group-hover:bg-primary group-hover:border-primary group-hover:text-primary-content transition-all shadow-sm">
                                  <ChevronRightIcon size={14} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-sm font-medium text-base-content/60">
                        No medicines matched "{search}".
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-2">
              {/* View Toggle */}
              <div className="hidden md:flex bg-base-200 p-1 rounded-xl border border-base-200 gap-0.5">
                {[
                  { mode: "grid", Icon: Grid3x3, tooltip: "Grid View" },
                  { mode: "list", Icon: List, tooltip: "List View" },
                ].map(({ mode, Icon, tooltip }) => (
                  <IconTooltip key={mode} label={tooltip}>
                    <button
                      onClick={() => setViewMode(mode)}
                      aria-label={`${mode} view`}
                      className={`p-2 rounded-lg transition-all cursor-pointer ${
                        viewMode === mode
                          ? "bg-base-100 text-primary shadow-sm"
                          : "text-base-content/35 hover:text-base-content"
                      }`}
                    >
                      <Icon size={15} />
                    </button>
                  </IconTooltip>
                ))}
              </div>

              {/* Sort Dropdown */}
              <div className="relative min-w-[160px]" ref={sortRef}>
                <button
                  onClick={() => setIsSortOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={isSortOpen}
                  className="w-full h-11 px-3.5 flex items-center justify-between gap-2 bg-base-200/70 border border-base-200 rounded-xl hover:border-primary/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <ArrowUpDown
                      size={13}
                      className="text-primary/60 shrink-0"
                    />
                    <span className="text-[11px] font-bold uppercase tracking-wider truncate text-base-content/70">
                      {
                        SORT_OPTIONS.find((o) => o.value === sort)?.label.split(
                          "(",
                        )[0]
                      }
                    </span>
                  </div>
                  <ChevronDown
                    size={12}
                    className={`shrink-0 text-base-content/40 transition-transform duration-200 ${isSortOpen ? "rotate-180" : ""}`}
                  />
                </button>

                <AnimatePresence>
                  {isSortOpen && (
                    <motion.ul
                      role="listbox"
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      className="absolute top-[calc(100%+6px)] left-0 right-0 bg-base-100 rounded-xl shadow-2xl border border-base-200 p-1.5 z-[110]"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <li key={opt.value}>
                          <button
                            role="option"
                            aria-selected={sort === opt.value}
                            onClick={() => {
                              setSort(opt.value);
                              setIsSortOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              sort === opt.value
                                ? "bg-primary text-primary-content"
                                : "hover:bg-base-200 text-base-content/70 hover:text-base-content"
                            }`}
                          >
                            {opt.label}
                          </button>
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Filter Trigger */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                title="Open filters"
                className="lg:hidden h-11 px-4 bg-primary text-primary-content rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <SlidersHorizontal size={15} />
                Filter
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-primary-content text-primary text-[9px] font-black flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Main Layout ── */}
        <div className="py-2">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-64 shrink-0 sticky top-28 self-start">
              <div className="bg-base-100 border border-base-200 rounded-2xl p-5 shadow-sm">
                <FilterContent
                  filters={filters}
                  updateFilters={updateFilters}
                  resetFilters={resetFilters}
                  activeFiltersCount={activeFiltersCount}
                />
              </div>
            </aside>

            {/* Product Grid */}
            <main className="flex-1 min-w-0">
              {/* Active Filter Chips */}
              <AnimatePresence>
                {activeFiltersCount > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap gap-2 mb-5 pb-4 border-b border-base-200"
                  >
                    {filters.categories.map((c) => (
                      <span
                        key={c}
                        className="flex items-center gap-1.5 bg-primary/8 text-primary text-[10px] font-black px-2.5 py-1 rounded-xl border border-primary/15"
                      >
                        {c}
                        <X
                          size={10}
                          className="cursor-pointer hover:text-error transition-colors"
                          onClick={() =>
                            updateFilters({
                              ...filters,
                              categories: filters.categories.filter(
                                (x) => x !== c,
                              ),
                            })
                          }
                        />
                      </span>
                    ))}
                    {filters.schedules.map((s) => (
                      <span
                        key={s}
                        className="flex items-center gap-1.5 bg-secondary/8 text-secondary text-[10px] font-black px-2.5 py-1 rounded-xl border border-secondary/15"
                      >
                        {s === "None" ? "OTC" : `Sch. ${s}`}
                        <X
                          size={10}
                          className="cursor-pointer hover:text-error transition-colors"
                          onClick={() =>
                            updateFilters({
                              ...filters,
                              schedules: filters.schedules.filter(
                                (x) => x !== s,
                              ),
                            })
                          }
                        />
                      </span>
                    ))}
                    {filters.prescriptionOnly && (
                      <span className="flex items-center gap-1.5 bg-info/8 text-info text-[10px] font-black px-2.5 py-1 rounded-xl border border-info/15">
                        Rx Only{" "}
                        <X
                          size={10}
                          className="cursor-pointer hover:text-error"
                          onClick={() =>
                            updateFilters({
                              ...filters,
                              prescriptionOnly: false,
                            })
                          }
                        />
                      </span>
                    )}
                    {filters.hideDiscontinued && (
                      <span className="flex items-center gap-1.5 bg-success/8 text-success text-[10px] font-black px-2.5 py-1 rounded-xl border border-success/15">
                        In Stock Only{" "}
                        <X
                          size={10}
                          className="cursor-pointer hover:text-error"
                          onClick={() =>
                            updateFilters({
                              ...filters,
                              hideDiscontinued: false,
                            })
                          }
                        />
                      </span>
                    )}
                    <button
                      onClick={resetFilters}
                      className="text-[10px] font-black text-error/70 hover:text-error uppercase tracking-wider ml-1 cursor-pointer"
                    >
                      Clear all
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Results count */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-base-content/40">
                  {loading ? (
                    <span className="inline-block w-32 h-3 bg-base-300 animate-pulse rounded-md" />
                  ) : (
                    <>
                      Showing{" "}
                      <span className="text-base-content font-black">
                        {displayedMedicines.length}
                      </span>
                      {pagination.total > displayedMedicines.length && (
                        <>
                          {" "}
                          of{" "}
                          <span className="text-base-content font-black">
                            {pagination.total}
                          </span>
                        </>
                      )}{" "}
                      products
                    </>
                  )}
                </p>
              </div>

              {/* Error */}
              {error && !loading && (
                <div className="alert alert-error mb-5 rounded-xl">
                  <AlertCircle size={15} />
                  <span className="text-sm font-bold">{error}</span>
                  <button
                    onClick={() =>
                      fetchContent(search, filters, sort, currentPage)
                    }
                    className="ml-auto text-xs font-bold underline cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Skeletons */}
              {loading ? (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                      : "space-y-3"
                  }
                >
                  {[...Array(6)].map((_, i) => (
                    <SkeletonCard key={i} viewMode={viewMode} />
                  ))}
                </div>
              ) : displayedMedicines.length === 0 ? (
                <div className="py-24 text-center bg-base-200/40 rounded-2xl border border-dashed border-base-300">
                  <div className="w-20 h-20 bg-base-300 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <Package size={34} className="text-base-content/15" />
                  </div>
                  <h3 className="text-lg font-black mb-2 tracking-tight">
                    No Medications Found
                  </h3>
                  <p className="text-sm text-base-content/40 max-w-xs mx-auto mb-7 font-medium">
                    We couldn&apos;t find anything matching those filters. Try a
                    broader search.
                  </p>
                  <SpecialButton
                    as="button"
                    role="pharmacy"
                    variant="solid"
                    size="md"
                    animation="lift"
                    textAnimation="none"
                    fullWidth={false}
                    title="Clear All Filters"
                    onClick={resetFilters}
                    className="rounded-xl w-auto px-6 mx-auto cursor-pointer"
                  />
                </div>
              ) : (
                <motion.div
                  key={viewMode}
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                      : "space-y-3"
                  }
                >
                  {displayedMedicines.map((med) => (
                    <MemoMedicineCard
                      key={med._id}
                      medicine={med}
                      viewMode={viewMode}
                      onViewDetail={handleViewDetail}
                      onAddToCart={handleAddToCart}
                      onBuyNow={handleBuyNow}
                      isActingId={actingMedId}
                    />
                  ))}
                </motion.div>
              )}

              {/* Pagination */}
              {!loading && (pagination.totalPages ?? 1) > 1 && (
                <div className="mt-10 flex flex-col md:flex-row items-center justify-between p-5 bg-base-100 rounded-2xl border border-base-200 shadow-sm gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-base-content/35">
                      Page
                    </p>
                    <p className="text-sm font-black mt-0.5">
                      {currentPage}
                      <span className="text-base-content/30 font-medium">
                        {" "}
                        / {pagination.totalPages}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => p - 1)}
                      aria-label="Previous page"
                      className="w-9 h-9 flex items-center justify-center bg-base-200 rounded-xl hover:bg-primary hover:text-primary-content disabled:opacity-25 disabled:cursor-not-allowed transition-all text-base-content/60 cursor-pointer"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {pageNumbers.reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) {
                        acc.push(
                          <span
                            key={`e-${p}`}
                            className="px-1 text-base-content/25 text-xs select-none"
                          >
                            …
                          </span>,
                        );
                      }
                      acc.push(
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p)}
                          aria-current={currentPage === p ? "page" : undefined}
                          className={`w-9 h-9 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            currentPage === p
                              ? "bg-primary text-primary-content shadow-sm"
                              : "bg-base-200 hover:bg-base-300 text-base-content/60 hover:text-base-content"
                          }`}
                        >
                          {p}
                        </button>,
                      );
                      return acc;
                    }, [])}

                    <button
                      disabled={currentPage === pagination.totalPages}
                      onClick={() => setCurrentPage((p) => p + 1)}
                      aria-label="Next page"
                      className="w-9 h-9 flex items-center justify-center bg-base-200 rounded-xl hover:bg-primary hover:text-primary-content disabled:opacity-25 disabled:cursor-not-allowed transition-all text-base-content/60 cursor-pointer"
                    >
                      <ChevronRightIcon size={16} />
                    </button>
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>

        {/* ── Mobile Filter Drawer ── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] cursor-pointer"
                aria-hidden="true"
              />

              <motion.aside
                role="dialog"
                aria-modal="true"
                aria-label="Filter medicines"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280 }}
                className="fixed top-0 right-0 h-full w-[88%] max-w-sm bg-base-100 z-[1001] flex flex-col shadow-2xl cursor-auto"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-base-200">
                  <div>
                    <h2 className="text-sm font-black tracking-tight">
                      Filter Medicines
                    </h2>
                    {activeFiltersCount > 0 && (
                      <p className="text-[10px] text-primary font-bold mt-0.5">
                        {activeFiltersCount} active filter
                        {activeFiltersCount > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-2 bg-base-200 rounded-xl hover:bg-error/10 hover:text-error transition-all cursor-pointer"
                    aria-label="Close filter panel"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <FilterContent
                    filters={filters}
                    updateFilters={updateFilters}
                    resetFilters={resetFilters}
                    activeFiltersCount={activeFiltersCount}
                  />
                </div>

                <div className="px-5 py-4 border-t border-base-200 flex flex-col gap-2.5">
                  <SpecialButton
                    as="button"
                    role="pharmacy"
                    variant="solid"
                    size="lg"
                    animation="press"
                    textAnimation="none"
                    fullWidth
                    title={`View ${pagination.total ?? ""} Results`}
                    onClick={() => setIsSidebarOpen(false)}
                    className="rounded-[22px] cursor-pointer"
                  />
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={() => {
                        resetFilters();
                        setIsSidebarOpen(false);
                      }}
                      className="text-xs font-bold uppercase text-error/70 hover:text-error tracking-wider text-center hover:underline cursor-pointer"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* ── Prescription Upload Modal ── */}
        <AnimatePresence>
          {showRxModal && rxMedicine && (
            <PrescriptionUploadModal
              medicine={rxMedicine}
              isUploading={isUploading}
              onUpload={handleRxUploadAndProceed}
              onSkip={handleRxSkip}
              onClose={handleRxClose}
            />
          )}
        </AnimatePresence>

        {/* ── BuyNow Modal ── */}
        <AnimatePresence>
          {showBuyNowModal && buyNowMed && (
            <BuyNowModal
              med={buyNowMed}
              quantity={buyNowQty}
              baseTotal={buyNowBaseTotal}
              storeId={buyNowStoreId}
              walletBalance={walletBalance}
              coupon={coupon}
              couponLoading={couponLoading}
              couponError={couponError}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              onClose={() => {
                setShowBuyNowModal(false);
                setRxUploadedUrl(null);
                dispatch(clearCoupon());
              }}
              onSuccess={handleOrderSuccess}
              prescriptionImageUrl={rxUploadedUrl}
            />
          )}
        </AnimatePresence>

        {/* ── Order Success Modal ── */}
        <AnimatePresence>
          {showSuccessModal && completedOrder && (
            <OrderSuccessModal
              order={completedOrder}
              onClose={() => {
                setShowSuccessModal(false);
                setCompletedOrder(null);
              }}
              onViewOrders={() => {
                setShowSuccessModal(false);
                const path = "/pharmacy/orders";
                if (router) router.push(path);
                else window.location.href = path;
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </Container>
  );
}