"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  Package,
  AlertTriangle,
  TrendingDown,
  Clock,
  Plus,
  Minus,
  RefreshCw,
  Search,
  Filter,
  ChevronRight,
  X,
  BarChart2,
  ShoppingCart,
  Truck,
  Trash2,
  PauseCircle,
  PlayCircle,
  Zap,
  Info,
  HelpCircle,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Box,
  DollarSign,
  Activity,
  Calendar,
  ChevronDown,
  Eye,
  Download,
  Upload,
  Bell,
  List,
  BarChart,
  AlertCircle,
  Layers,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  Loader2,
  BookOpen,
  Settings,
  Shield,
  Warehouse,
  FileText,
} from "lucide-react";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Redux thunks & selectors
import {
  fetchStores,
  fetchStoreById,
  fetchStoreInventorySummary,
  fetchInventoryByMedicine,
  fetchLowStock,
  fetchExpiryAlerts,
  addMedicineStock,
  deductMedicineStock,
  updateInventoryEntry,
  deleteInventoryEntry,
  syncAllMedicinesInventory,
  syncOneMedicineInventory,
  suspendStore,
  unsuspendStore,
  deleteStore,
  triggerLowStockAlerts,
  fetchMedicines,
  fetchMedicineStats,
  selectStores,
  selectStoreDetail,
  selectStoreInventorySummary,
  selectInventory,
  selectLowStock,
  selectLowStockTotal,
  selectExpiryAlerts,
  selectExpiryAlertTotal,
  selectMedicines,
  selectMedicineStats,
  selectMedicineLoading,
  selectActionLoading,
  selectStorePagination,
  selectMedicinePagination,
  clearMedicineError,
  clearSuccessMessage,
  clearStoreLifecycleResult,
  selectStoreLifecycleResult,
  fetchStoreInventory,
} from "@/store/slices/medicineSlice";

// ─── Animation variants ────────────────────────────────────────────────────────
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.25 } } };
const slideRight = { hidden: { opacity: 0, x: -20 }, show: { opacity: 1, x: 0, transition: { duration: 0.3 } } };
const slideUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

// ─── Status badge config ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Open:              { label: "Open",         cls: "badge-success" },
  Closed:            { label: "Closed",       cls: "badge-error" },
  "Under-Maintenance":{ label: "Suspended",   cls: "badge-warning" },
  Inactive:          { label: "Inactive",     cls: "badge-error" },
  Suspended:         { label: "Suspended",    cls: "badge-warning" },
};

const MOVEMENT_LABELS = {
  Purchase: "Purchase",
  Sale: "Sale",
  Reservation: "Reserved",
  Release: "Released",
  Adjustment_Add: "Adj +",
  Adjustment_Sub: "Adj −",
  Damage: "Damage",
  Expiry: "Expiry",
  Return: "Return",
  Transfer_In: "Transfer In",
  Transfer_Out: "Transfer Out",
};

const TABS = [
  { id: "overview",  label: "Overview",   icon: BarChart2 },
  { id: "inventory", label: "Inventory",  icon: Package },
  { id: "lowstock",  label: "Low Stock",  icon: TrendingDown },
  { id: "expiry",    label: "Expiry",     icon: Clock },
  { id: "actions",   label: "Actions",    icon: Settings },
  { id: "help",      label: "Help",       icon: HelpCircle },
];

// ─── Tiny helpers ──────────────────────────────────────────────────────────────
const fmt = (n, d = 2) => (n == null ? "—" : Number(n).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }));
const fmtInt = (n) => (n == null ? "—" : Number(n).toLocaleString("en-IN"));
const plural = (n, w) => `${fmtInt(n)} ${w}${n !== 1 ? "s" : ""}`;

// ─── Toast mini ───────────────────────────────────────────────────────────────
function Toast({ message, type = "success", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-box shadow-depth-lg border ${type === "success" ? "bg-success/10 border-success/30 text-success" : "bg-error/10 border-error/30 text-error"}`}
    >
      {type === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      <span className="text-sm font-semibold">{message}</span>
      <button onClick={onClose} className="ml-2 btn btn-ghost btn-xs btn-circle"><X size={14} /></button>
    </motion.div>
  );
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel = "Confirm", variant = "error", onConfirm, onCancel, extraInput }) {
  const [inputVal, setInputVal] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-6 w-full max-w-md">
        <div className={`flex items-center gap-3 mb-4 ${variant === "error" ? "text-error" : "text-warning"}`}>
          <AlertTriangle size={22} />
          <h3 className="font-display font-bold text-lg text-base-content">{title}</h3>
        </div>
        <p className="text-sm text-base-content/70 mb-4">{message}</p>
        {extraInput && (
          <div className="mb-4">
            <label className="label label-text mb-1">{extraInput.label}</label>
            <input className="input-field" placeholder={extraInput.placeholder} value={inputVal} onChange={e => setInputVal(e.target.value)} />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button className={`btn btn-sm ${variant === "error" ? "btn-error" : "btn-warning"}`} onClick={() => onConfirm(inputVal)}>{confirmLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatBlock({ label, value, icon: Icon, color = "primary", sub }) {
  return (
    <motion.div variants={slideUp} className="stat-card flex items-start gap-4">
      <div className={`p-2.5 rounded-field bg-${color}/10`}>
        <Icon size={20} className={`text-${color}`} />
      </div>
      <div className="min-w-0">
        <div className="stat-card-value text-base-content text-2xl">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="text-xs text-base-content/50 mt-0.5">{sub}</div>}
      </div>
    </motion.div>
  );
}

// ─── Stock badge ──────────────────────────────────────────────────────────────
function StockBadge({ available, low, out }) {
  if (out) return <span className="badge badge-error badge-xs">Out of Stock</span>;
  if (low) return <span className="badge badge-warning badge-xs">Low Stock</span>;
  return <span className="badge badge-success badge-xs">{fmtInt(available)} units</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Add Stock Modal
// ══════════════════════════════════════════════════════════════════════════════
function AddStockModal({ medicineId, storeId, medicineName, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const loading = useSelector(selectActionLoading);
  const [form, setForm] = useState({
    stockQuantity: "", batchNumber: "", expiryDate: "",
    mrp: "", sellingPrice: "", discountPercent: "0",
    purchasePrice: "", purchaseInvoiceNo: "", supplierId: "",
    rackLocation: "", manufacturingDate: "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    const payload = {
      medicineId, storeId,
      stockQuantity: Number(form.stockQuantity),
      batchNumber: form.batchNumber,
      expiryDate: form.expiryDate,
      mrp: Number(form.mrp),
      sellingPrice: Number(form.sellingPrice),
      discountPercent: Number(form.discountPercent || 0),
    };
    if (form.purchasePrice) payload.purchasePrice = Number(form.purchasePrice);
    if (form.purchaseInvoiceNo) payload.purchaseInvoiceNo = form.purchaseInvoiceNo;
    if (form.supplierId) payload.supplierId = form.supplierId;
    if (form.rackLocation) payload.rackLocation = form.rackLocation;
    if (form.manufacturingDate) payload.manufacturingDate = form.manufacturingDate;
    const res = await dispatch(addMedicineStock(payload));
    if (!res.error) { onSuccess("Stock added successfully."); onClose(); }
  };

  const Field = ({ label, k, type = "text", required, placeholder, note }) => (
    <div>
      <label className="label label-text mb-1">{label}{required && <span className="text-error ml-1">*</span>}</label>
      <input className="input-field" type={type} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
      {note && <div className="text-[11px] text-base-content/50 mt-1 leading-tight">{note}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg text-base-content">Add Stock — {medicineName}</h3>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <Field label="Quantity" k="stockQuantity" type="number" required placeholder="e.g., 50" note="Number of physical units received." />
          <Field label="Batch Number" k="batchNumber" required placeholder="e.g., BATCH123" note="Manufacturer's unique batch identifier." />
          <Field label="Expiry Date" k="expiryDate" type="date" required note="Must be a future date." />
          <Field label="Manufacturing Date" k="manufacturingDate" type="date" note="Optional manufacturing date." />
          <Field label="MRP (₹)" k="mrp" type="number" required placeholder="e.g., 150" note="Maximum Retail Price printed on packaging." />
          <Field label="Selling Price (₹)" k="sellingPrice" type="number" required placeholder="e.g., 120" note="Actual selling price at this store." />
          <Field label="Discount %" k="discountPercent" type="number" placeholder="e.g., 10" note="Calculates final price automatically." />
          <Field label="Purchase Price (₹)" k="purchasePrice" type="number" placeholder="e.g., 90" note="Internal cost price (hidden from customers)." />
          <Field label="Invoice No." k="purchaseInvoiceNo" placeholder="e.g., INV-001" note="Reference invoice for this stock." />
          <Field label="Rack Location" k="rackLocation" placeholder="e.g., Aisle 3, Rack B" note="Physical storage location." />
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Add Stock
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Deduct Stock Modal
// ══════════════════════════════════════════════════════════════════════════════
function DeductStockModal({ medicineId, storeId, medicineName, availableStock, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const loading = useSelector(selectActionLoading);
  const [form, setForm] = useState({ quantity: "", batchNumber: "", reason: "", movementType: "Adjustment_Sub" });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    const res = await dispatch(deductMedicineStock({
      medicineId, storeId,
      quantity: Number(form.quantity),
      batchNumber: form.batchNumber || undefined,
      reason: form.reason,
      movementType: form.movementType,
    }));
    if (!res.error) { onSuccess("Stock deducted."); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg text-base-content flex items-center gap-2">
            <Minus size={18} className="text-error" /> Deduct Stock — {medicineName}
          </h3>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="alert alert-warning mb-4 text-sm"><AlertTriangle size={15} /> Available: {fmtInt(availableStock)} units</div>
        <div className="space-y-5">
          <div>
            <label className="label label-text mb-1">Quantity <span className="text-error">*</span></label>
            <input className="input-field" type="number" value={form.quantity} onChange={e => set("quantity", e.target.value)} placeholder="e.g., 5" />
            <div className="text-[11px] text-base-content/50 mt-1 leading-tight">Exact number of units to deduct from stock.</div>
          </div>
          <div>
            <label className="label label-text mb-1">Movement Type</label>
            <select className="input-field" value={form.movementType} onChange={e => set("movementType", e.target.value)}>
              {["Adjustment_Sub","Damage","Expiry","Transfer_Out"].map(t => <option key={t} value={t}>{MOVEMENT_LABELS[t]}</option>)}
            </select>
            <div className="text-[11px] text-base-content/50 mt-1 leading-tight">Reason for the stock deduction for accounting purposes.</div>
          </div>
          <div>
            <label className="label label-text mb-1">Batch Number (optional)</label>
            <input className="input-field" value={form.batchNumber} onChange={e => set("batchNumber", e.target.value)} placeholder="e.g., BATCH123" />
            <div className="text-[11px] text-base-content/50 mt-1 leading-tight">Leave blank to use FEFO auto-selection (deducts closest expiring batch first).</div>
          </div>
          <div>
            <label className="label label-text mb-1">Reason (optional)</label>
            <input className="input-field" value={form.reason} onChange={e => set("reason", e.target.value)} placeholder="e.g., Damaged during transit" />
            <div className="text-[11px] text-base-content/50 mt-1 leading-tight">Short descriptive note for the audit logs.</div>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-error btn-sm" onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Minus size={15} />} Deduct
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Update Inventory Pricing Modal
// ══════════════════════════════════════════════════════════════════════════════
function UpdateInventoryModal({ entry, onClose, onSuccess }) {
  const dispatch = useDispatch();
  const loading = useSelector(selectActionLoading);
  const [form, setForm] = useState({
    mrp: entry?.mrp ?? "",
    sellingPrice: entry?.sellingPrice ?? "",
    discountPercent: entry?.discountPercent ?? 0,
    reorderLevel: entry?.reorderLevel ?? 10,
    rackLocation: entry?.rackLocation ?? "",
  });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const medicineId = entry?.medicineId?._id || entry?.medicineId;
  const storeId = entry?.storeId?._id || entry?.storeId;

  const submit = async () => {
    const res = await dispatch(updateInventoryEntry({ medicineId, storeId, updates: {
      mrp: Number(form.mrp),
      sellingPrice: Number(form.sellingPrice),
      discountPercent: Number(form.discountPercent),
      reorderLevel: Number(form.reorderLevel),
      rackLocation: form.rackLocation,
    }}));
    if (!res.error) { onSuccess("Inventory updated."); onClose(); }
  };

  const formFields = [
    ["MRP (₹)", "mrp", "number", "e.g., 150", "The maximum retail price."],
    ["Selling Price (₹)", "sellingPrice", "number", "e.g., 130", "Actual selling price before discounts."],
    ["Discount %", "discountPercent", "number", "e.g., 10", "Percentage discount applied at checkout."],
    ["Reorder Level", "reorderLevel", "number", "e.g., 15", "Low stock alerts will trigger below this quantity."],
    ["Rack Location", "rackLocation", "text", "e.g., Shelf A2", "Internal reference for physical placement."]
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/60 backdrop-blur-sm p-4">
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-lg text-base-content">Update Pricing & Config</h3>
          <button className="btn btn-ghost btn-circle btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="space-y-5">
          {formFields.map(([lbl, k, type, placeholder, note]) => (
            <div key={k}>
              <label className="label label-text mb-1">{lbl}</label>
              <input className="input-field" type={type} value={form[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} />
              <div className="text-[11px] text-base-content/50 mt-1 leading-tight">{note}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={loading}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Update
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Help Section
// ══════════════════════════════════════════════════════════════════════════════
function HelpSection() {
  const [open, setOpen] = useState(null);
  const toggle = id => setOpen(p => p === id ? null : id);

  const sections = [
    {
      id: "overview",
      icon: BookOpen,
      title: "Page Overview",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Stores &amp; Inventory Management is the central hub for <strong>superadmin</strong> and <strong>admin</strong> roles to manage every pharmacy store's stock, pricing, expiry, and lifecycle.</p>
          <p>The page uses a <strong>split-panel layout</strong>: left panel lists all stores, right panel shows the selected store's full inventory detail.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Select any store → right panel loads immediately</li>
            <li>Tabs switch between Overview, Inventory, Low Stock, Expiry, Actions, and Help</li>
            <li>All data synced live from MongoDB via Redux thunks</li>
          </ul>
        </div>
      ),
    },
    {
      id: "stores",
      icon: Store,
      title: "Store List (Left Panel)",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Shows all pharmacy stores — both <strong>Owned</strong> and <strong>Partnered</strong> types.</p>
          <div className="grid grid-cols-2 gap-2">
            {[["Open","Green badge — store accepting orders"],["Closed","Red — not accepting orders"],["Under-Maintenance","Yellow — suspended by admin"],["Inactive","Red — permanently deactivated"]].map(([s,d]) => (
              <div key={s} className="bg-base-200 rounded-field p-2">
                <div className="font-semibold text-xs text-base-content">{s}</div>
                <div className="text-xs text-base-content/60">{d}</div>
              </div>
            ))}
          </div>
          <p><strong>Search</strong> filters by store name in real time. <strong>Filter</strong> button toggles status/type filter panel.</p>
        </div>
      ),
    },
    {
      id: "overview-tab",
      icon: BarChart2,
      title: "Overview Tab",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Summary of the selected store's inventory health:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Total SKUs</strong> — unique medicines registered for this store</li>
            <li><strong>Total Units</strong> — all physical stock across all batches</li>
            <li><strong>MRP Value</strong> — theoretical max revenue at MRP × stock</li>
            <li><strong>Sell Value</strong> — actual revenue potential at final price × available stock</li>
            <li><strong>Low Stock</strong> — items at or below reorder level (default 10 units)</li>
            <li><strong>Out of Stock</strong> — items with zero available units</li>
            <li><strong>Expiring Soon</strong> — batches expiring within 30 days</li>
          </ul>
          <p>Charts show stock health breakdown and value distribution. Refresh button reloads data from server.</p>
        </div>
      ),
    },
    {
      id: "inventory-tab",
      icon: Package,
      title: "Inventory Tab",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Full medicine inventory list for the selected store. Each row shows:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Medicine name, brand, category</li>
            <li>Stock status badge (Out of Stock / Low Stock / available units)</li>
            <li>MRP, Selling Price, Final Price (after discount)</li>
            <li>Active batch expiry date</li>
            <li>Rack location</li>
            <li>Action buttons: <strong>Add Stock</strong>, <strong>Deduct</strong>, <strong>Edit Pricing</strong>, <strong>Delete Entry</strong></li>
          </ul>
          <p>Search filters medicines by name in real time. Sync Inventory button creates placeholder records for any store-medicine pairs missing an inventory doc.</p>
        </div>
      ),
    },
    {
      id: "addstock",
      icon: Plus,
      title: "Adding Stock (Purchase / Top-up)",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Click <strong>+ Stock</strong> on any inventory row. Fill the form:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Quantity</strong> — units being received (required)</li>
            <li><strong>Batch Number</strong> — manufacturer batch ID (required)</li>
            <li><strong>Expiry Date</strong> — as printed on pack (required)</li>
            <li><strong>MRP &amp; Selling Price</strong> — required; sets store pricing for this batch</li>
            <li><strong>Discount %</strong> — auto-computes Final Price</li>
            <li><strong>Purchase Price</strong> — cost price, hidden from customers</li>
            <li><strong>Invoice No.</strong> — purchase invoice reference</li>
            <li><strong>Rack Location</strong> — physical shelf (e.g. Aisle-3/Rack-B)</li>
          </ul>
          <p>System creates a <strong>MedicineBatch</strong> document and updates <strong>MedicineInventory</strong> atomically in a MongoDB session. An <strong>InventoryMovement</strong> ledger entry is appended (type: Purchase).</p>
          <div className="alert alert-info text-xs"><Info size={13}/> If batch number already exists, quantities are added to that batch (top-up).</div>
        </div>
      ),
    },
    {
      id: "deductstock",
      icon: Minus,
      title: "Deducting Stock",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Click <strong>Deduct</strong> on any inventory row. Select movement type:</p>
          <div className="space-y-1">
            {[["Adjustment_Sub","Manual correction — stock count mismatch"],["Damage","Physical damage, shrinkage"],["Expiry","Expired stock removal"],["Transfer_Out","Moving stock to another store"]].map(([t,d]) => (
              <div key={t} className="flex gap-2 text-xs">
                <span className="badge badge-secondary badge-sm shrink-0">{t}</span>
                <span className="text-base-content/70">{d}</span>
              </div>
            ))}
          </div>
          <p>Leave batch number blank to use <strong>FEFO</strong> (First Expire First Out) auto-selection. Specify batch number to deduct from a specific batch.</p>
          <p>System validates available stock &gt; requested quantity before deducting. Logs to InventoryMovement ledger.</p>
        </div>
      ),
    },
    {
      id: "lowstock-tab",
      icon: TrendingDown,
      title: "Low Stock Tab",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Lists all medicines in this store with <code className="bg-base-200 px-1 rounded text-xs">availableStock ≤ reorderLevel</code> (default: 10 units).</p>
          <p><strong>Trigger Alerts</strong> button sends email + in-app notifications to admins and pharmacy staff for all low-stock items in this store.</p>
          <p>Each row shows current stock, reorder level, and a direct <strong>Restock</strong> shortcut that opens the Add Stock modal.</p>
          <div className="alert alert-warning text-xs"><AlertTriangle size={13}/> Out-of-stock items also appear here (0 units available).</div>
        </div>
      ),
    },
    {
      id: "expiry-tab",
      icon: Clock,
      title: "Expiry Alerts Tab",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Shows batches expiring within <strong>30 days</strong> (configurable). Sorted by earliest expiry first (FEFO order).</p>
          <p>Each row shows: batch number, medicine, expiry date, days remaining, remaining quantity.</p>
          <p>Action: use <strong>Deduct → Expiry</strong> to formally write off expired batches from stock. This updates MedicineInventory and logs to InventoryMovement.</p>
          <div className="alert alert-error text-xs"><XCircle size={13}/> Do not sell or dispense near-expiry stock without pharmacy review.</div>
        </div>
      ),
    },
    {
      id: "actions-tab",
      icon: Settings,
      title: "Store Actions Tab",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Critical lifecycle operations for the selected store:</p>
          <div className="space-y-2">
            {[
              ["Sync Inventory","Creates zero-stock MedicineInventory placeholder records for any medicine not yet linked to this store. Safe to run anytime.","success"],
              ["Trigger Low Stock Alerts","Fires email + notification alerts for all medicines below reorder level in this store.","warning"],
              ["Suspend Store","Sets store status to Under-Maintenance. All inventory records set isActive=false. Orders not accepted. Stock data preserved.","warning"],
              ["Unsuspend Store","Re-opens store. All inventory restored to active. Low-stock alerts auto-fire on resume.","success"],
              ["Delete Store","Permanently removes store. All MedicineInventory and MedicineBatch records soft-deleted. Medicine catalogue untouched. Irreversible.","error"],
            ].map(([action, desc, type]) => (
              <div key={action} className={`border-l-4 pl-3 py-1 border-${type}`}>
                <div className="font-semibold text-xs text-base-content">{action}</div>
                <div className="text-xs text-base-content/60">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "sync",
      icon: RefreshCw,
      title: "Inventory Sync (Global)",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p><strong>Sync All Stores</strong> (top-right toolbar) runs a global sync: for every active medicine × every active store, ensures a MedicineInventory doc exists.</p>
          <p>This is safe to run after adding new medicines or new stores. It only creates missing records — never overwrites existing stock data.</p>
          <p>Result shows: total medicines scanned, stores synced, entries added.</p>
        </div>
      ),
    },
    {
      id: "roles",
      icon: Shield,
      title: "Role Permissions",
      content: (
        <div className="space-y-2 text-sm text-base-content/80">
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              ["Action","Admin","Superadmin"],
              ["View Stores","✓","✓"],
              ["Add Stock","✓","✓"],
              ["Deduct Stock","✓","✓"],
              ["Edit Pricing","✓","✓"],
              ["Delete Entry","✓","✓"],
              ["Suspend Store","✓","✓"],
              ["Unsuspend Store","✓","✓"],
              ["Delete Store","✗","✓"],
              ["Sync All","✗","✓"],
              ["Trigger Alerts","✓","✓"],
            ].map(([a,ad,sa], i) => (
              <div key={i} className={`contents ${i === 0 ? "font-bold" : ""}`}>
                <span className={`${i === 0 ? "font-semibold text-base-content" : "text-base-content/70"} py-1`}>{a}</span>
                <span className={`text-center py-1 ${ad === "✓" ? "text-success" : "text-error"}`}>{ad}</span>
                <span className={`text-center py-1 ${sa === "✓" ? "text-success" : "text-error"}`}>{sa}</span>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "models",
      icon: Layers,
      title: "Data Model Reference",
      content: (
        <div className="space-y-3 text-sm text-base-content/80">
          <p>Key MongoDB collections used by this page:</p>
          <div className="space-y-2">
            {[
              ["Medicine","Global product catalogue. No stock data. One doc per product."],
              ["MedicineInventory","Stock + pricing per store per medicine. One doc = one store + one medicine."],
              ["MedicineBatch","Physical batch. One doc per batch per store. FEFO via fifoPriority field."],
              ["InventoryMovement","Append-only ledger. Every stock change creates one entry. Cannot be updated."],
              ["PharmacyStore","Store profile, location, status, financials, delivery config."],
            ].map(([m,d]) => (
              <div key={m} className="bg-base-200 rounded-field p-2">
                <div className="font-mono text-xs font-bold text-primary">{m}</div>
                <div className="text-xs text-base-content/60">{d}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="show" className="space-y-3">
      <div className="flex items-center gap-3 mb-2">
        <HelpCircle size={20} className="text-primary" />
        <h3 className="font-display font-bold text-lg text-base-content">Help &amp; Reference</h3>
      </div>
      <p className="text-sm text-base-content/60 mb-4">Everything you need to understand and operate this page.</p>
      <div className="space-y-2">
        {sections.map(s => (
          <div key={s.id} className="border border-base-300 rounded-box overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-base-200 transition-colors"
              onClick={() => toggle(s.id)}
            >
              <div className="flex items-center gap-3">
                <s.icon size={16} className="text-primary shrink-0" />
                <span className="font-semibold text-sm text-base-content">{s.title}</span>
              </div>
              <ChevronDown size={15} className={`text-base-content/50 transition-transform ${open === s.id ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {open === s.id && (
                <motion.div
                  initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 border-t border-base-300 bg-base-100">{s.content}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Overview Chart panel
// ══════════════════════════════════════════════════════════════════════════════
function OverviewCharts({ summary, storeName }) {
  if (!summary) return null;
  const pieData = [
    { name: "In Stock", value: Math.max(0, summary.totalSKUs - summary.lowStockCount - summary.outOfStockCount), fill: "var(--success)" },
    { name: "Low Stock", value: summary.lowStockCount, fill: "var(--warning)" },
    { name: "Out of Stock", value: summary.outOfStockCount, fill: "var(--error)" },
  ].filter(d => d.value > 0);

  const barData = [
    { label: "Total SKUs", value: summary.totalSKUs },
    { label: "Low Stock", value: summary.lowStockCount },
    { label: "Out of Stock", value: summary.outOfStockCount },
    { label: "Expiring Soon", value: summary.expiringSoonCount },
    { label: "Active Batches", value: summary.activeBatchCount },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mt-5">
      <div className="card p-4">
        <div className="text-sm font-semibold text-base-content mb-3 flex items-center gap-2"><BarChart size={15} /> Stock Health</div>
        <ResponsiveContainer width="100%" height={200}>
          <ReBarChart data={barData} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--base-content)" }} />
            <YAxis tick={{ fontSize: 10, fill: "var(--base-content)" }} />
            <Tooltip contentStyle={{ background: "var(--base-200)", border: "1px solid var(--base-300)", borderRadius: "8px", fontSize: 12 }} />
            <Bar dataKey="value" fill="var(--primary)" radius={[4,4,0,0]} />
          </ReBarChart>
        </ResponsiveContainer>
      </div>
      <div className="card p-4">
        <div className="text-sm font-semibold text-base-content mb-3 flex items-center gap-2"><Activity size={15} /> SKU Distribution</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "var(--base-200)", border: "1px solid var(--base-300)", borderRadius: "8px", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Right Panel — Store Detail
// ══════════════════════════════════════════════════════════════════════════════
function StoreDetailPanel({ store, onLifecycle }) {
  const dispatch = useDispatch();
  const summary = useSelector(selectStoreInventorySummary);
  const inventory = useSelector(selectInventory);
  const lowStock = useSelector(selectLowStock);
  const lowStockTotal = useSelector(selectLowStockTotal);
  const expiryAlerts = useSelector(selectExpiryAlerts);
  const expiryAlertTotal = useSelector(selectExpiryAlertTotal);
  const loading = useSelector(selectMedicineLoading);
  const actionLoading = useSelector(selectActionLoading);

  const [tab, setTab] = useState("overview");
  const [invSearch, setInvSearch] = useState("");
  const [modal, setModal] = useState(null); // { type, data }
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const storeId = store?._id;

  const showToast = useCallback((msg, type = "success") => setToast({ msg, type }), []);

  const loadData = useCallback(() => {
    if (!storeId) return;
    dispatch(fetchStoreInventorySummary(storeId));
    dispatch(fetchStoreInventory(storeId)); 
    dispatch(fetchLowStock({ storeId }));
    dispatch(fetchExpiryAlerts({ storeId }));
  }, [dispatch, storeId]);

  // ──────────────────────────────────────────────────────────────────────────
  // THE FIX: Automatically load data when the storeId changes or mounts
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, [loadData]);
  // ──────────────────────────────────────────────────────────────────────────

  const filteredInv = useMemo(() => {
    if (!invSearch) return inventory;
    const q = invSearch.toLowerCase();
    return inventory.filter(i => {
      const med = i.medicineId;
      return (med?.brandName?.toLowerCase().includes(q) || med?.genericName?.toLowerCase().includes(q) || med?.name?.toLowerCase().includes(q));
    });
  }, [inventory, invSearch]);

  const handleSuspend = () => setConfirm({
    title: "Suspend Store",
    message: `Suspend "${store.storeName}"? All inventory paused. Stock preserved.`,
    confirmLabel: "Suspend",
    variant: "warning",
    extraInput: { label: "Reason (optional)", placeholder: "e.g. Licence renewal" },
    onConfirm: async (reason) => {
      setConfirm(null);
      const res = await dispatch(suspendStore({ storeId, reason }));
      if (!res.error) { showToast("Store suspended."); loadData(); onLifecycle(); }
    },
  });

  const handleUnsuspend = () => setConfirm({
    title: "Reopen Store",
    message: `Reopen "${store.storeName}"? All inventory restored and low-stock alerts fire.`,
    confirmLabel: "Reopen",
    variant: "warning",
    onConfirm: async () => {
      setConfirm(null);
      const res = await dispatch(unsuspendStore(storeId));
      if (!res.error) { showToast("Store reopened."); loadData(); onLifecycle(); }
    },
  });

  const handleDelete = () => setConfirm({
    title: "Delete Store",
    message: `Permanently delete "${store.storeName}"? All inventory soft-deleted. Cannot be undone.`,
    confirmLabel: "Delete Forever",
    variant: "error",
    onConfirm: async () => {
      setConfirm(null);
      const res = await dispatch(deleteStore(storeId));
      if (!res.error) { showToast("Store deleted."); onLifecycle(); }
    },
  });

  const handleTriggerAlerts = async () => {
    const res = await dispatch(triggerLowStockAlerts({ storeId }));
    if (!res.error) showToast("Low-stock alerts triggered.");
  };

  const handleSyncOne = async () => {
    const res = await dispatch(syncOneMedicineInventory(storeId));
    if (!res.error) { showToast("Inventory synced."); loadData(); }
  };

  const handleDeleteEntry = (entry) => setConfirm({
    title: "Remove Inventory Entry",
    message: `Remove inventory record for "${entry.medicineId?.brandName}"? Stock data lost.`,
    confirmLabel: "Remove",
    variant: "error",
    onConfirm: async () => {
      setConfirm(null);
      const mId = entry.medicineId?._id || entry.medicineId;
      const sId = entry.storeId?._id || entry.storeId || storeId;
      const res = await dispatch(deleteInventoryEntry({ medicineId: mId, storeId: sId }));
      if (!res.error) { showToast("Entry removed."); loadData(); }
    },
  });

  const statusCfg = STATUS_CONFIG[store?.status] || STATUS_CONFIG.Closed;
  const isSuspended = store?.status === "Under-Maintenance" || store?.status === "Suspended";

  return (
    <div className="flex flex-col h-full">
      {/* Store header */}
      <div className="p-5 border-b border-base-300 bg-base-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display font-bold text-xl text-base-content truncate">{store.storeName}</h2>
              <span className={`badge ${statusCfg.cls}`}>{statusCfg.label}</span>
              <span className="badge badge-secondary badge-xs">{store.storeType}</span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-xs text-base-content/60 flex-wrap">
              {store.address?.city && <span className="flex items-center gap-1"><MapPin size={11} />{store.address.city}, {store.address.state}</span>}
              {store.contact?.phone && <span className="flex items-center gap-1"><Phone size={11} />{store.contact.phone}</span>}
              {store.contact?.email && <span className="flex items-center gap-1"><Mail size={11} />{store.contact.email}</span>}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm btn-circle shrink-0" onClick={loadData}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 border-b border-base-300 overflow-x-auto scrollbar-thin">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-field border-b-2 transition-colors ${tab === t.id ? "border-primary text-primary" : "border-transparent text-base-content/60 hover:text-base-content"}`}
          >
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">

          {/* ── OVERVIEW ── */}
          {tab === "overview" && (
            <motion.div key="overview" variants={fadeIn} initial="hidden" animate="show">
              {loading && !summary ? (
                <div className="flex items-center justify-center h-40"><Loader2 size={28} className="animate-spin text-primary" /></div>
              ) : summary ? (
                <>
                  <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                    <StatBlock label="Total SKUs" value={fmtInt(summary.totalSKUs)} icon={Layers} />
                    <StatBlock label="Total Units" value={fmtInt(summary.totalUnits)} icon={Box} />
                    <StatBlock label="MRP Value" value={`₹${fmt(summary.totalMRPValue, 0)}`} icon={DollarSign} color="secondary" />
                    <StatBlock label="Sell Value" value={`₹${fmt(summary.totalSellValue, 0)}`} icon={TrendingDown} color="accent" />
                    <StatBlock label="Low Stock" value={fmtInt(summary.lowStockCount)} icon={AlertTriangle} color="warning" sub={`threshold: ${summary.lowStockThreshold} units`} />
                    <StatBlock label="Out of Stock" value={fmtInt(summary.outOfStockCount)} icon={XCircle} color="error" />
                    <StatBlock label="Expiring Soon" value={fmtInt(summary.expiringSoonCount)} icon={Clock} color="warning" sub={`within ${summary.expiryAlertDays} days`} />
                    <StatBlock label="Active Batches" value={fmtInt(summary.activeBatchCount)} icon={Warehouse} color="info" />
                  </motion.div>
                  <OverviewCharts summary={summary} storeName={store.storeName} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-base-content/40 gap-2">
                  <Package size={32} /><span className="text-sm">No data available</span>
                </div>
              )}
            </motion.div>
          )}

          {/* ── INVENTORY ── */}
          {tab === "inventory" && (
            <motion.div key="inventory" variants={fadeIn} initial="hidden" animate="show">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-48">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                  <input className="input-field pl-9" placeholder="Search medicines…" value={invSearch} onChange={e => setInvSearch(e.target.value)} />
                </div>
                <button className="btn btn-outline btn-sm gap-1.5" onClick={handleSyncOne} disabled={actionLoading}>
                  <RefreshCw size={13} />Sync Inventory
                </button>
              </div>
              {loading && inventory.length === 0 ? (
                <div className="flex items-center justify-center h-40"><Loader2 size={28} className="animate-spin text-primary" /></div>
              ) : filteredInv.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-base-content/40 gap-2">
                  <Package size={32} /><span className="text-sm">No inventory records</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredInv.map((entry, i) => {
                    const med = entry.medicineId;
                    const batch = entry.batchId;
                    const daysLeft = batch?.expiryDate ? Math.ceil((new Date(batch.expiryDate) - new Date()) / 86400000) : null;
                    return (
                      <motion.div key={entry._id || i} variants={slideUp} initial="hidden" animate="show" className="card p-4 hover:border-primary/30">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-base-content">{med?.brandName || "—"}</span>
                              <span className="text-xs text-base-content/50">{med?.genericName}</span>
                              {med?.category && <span className="badge badge-secondary badge-xs">{med.category}</span>}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-base-content/60">
                              <StockBadge available={entry.availableStock} low={entry.isLowStock} out={entry.isOutOfStock} />
                              <span>MRP ₹{fmt(entry.mrp)}</span>
                              <span>Sell ₹{fmt(entry.sellingPrice)}</span>
                              {entry.discountPercent > 0 && <span className="text-success">{entry.discountPercent}% off → ₹{fmt(entry.finalPrice)}</span>}
                              {batch?.expiryDate && (
                                <span className={`flex items-center gap-1 ${daysLeft < 30 ? "text-error" : daysLeft < 90 ? "text-warning" : ""}`}>
                                  <Calendar size={10} />Exp: {new Date(batch.expiryDate).toLocaleDateString("en-IN")}
                                  {daysLeft !== null && <span>({daysLeft}d)</span>}
                                </span>
                              )}
                              {entry.rackLocation && <span className="flex items-center gap-1"><MapPin size={10}/>{entry.rackLocation}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            <button
                              className="btn btn-success btn-xs gap-1"
                              onClick={() => setModal({ type: "addStock", data: { medicineId: med?._id || entry.medicineId, medicineName: med?.brandName, storeId } })}
                            >
                              <Plus size={12} /> Stock
                            </button>
                            <button
                              className="btn btn-error btn-xs gap-1"
                              onClick={() => setModal({ type: "deductStock", data: { medicineId: med?._id || entry.medicineId, medicineName: med?.brandName, storeId, availableStock: entry.availableStock } })}
                            >
                              <Minus size={12} /> Deduct
                            </button>
                            <button
                              className="btn btn-outline btn-xs gap-1"
                              onClick={() => setModal({ type: "updateInv", data: entry })}
                            >
                              <Settings size={12} /> Edit
                            </button>
                            <button
                              className="btn btn-ghost btn-xs btn-circle text-error"
                              onClick={() => handleDeleteEntry(entry)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── LOW STOCK ── */}
          {tab === "lowstock" && (
            <motion.div key="lowstock" variants={fadeIn} initial="hidden" animate="show">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2 text-warning">
                  <TrendingDown size={18} />
                  <span className="font-semibold text-sm">{plural(lowStockTotal, "item")} below reorder level</span>
                </div>
                <button className="btn btn-warning btn-sm gap-1.5" onClick={handleTriggerAlerts} disabled={actionLoading}>
                  <Bell size={13} /> Trigger Alerts
                </button>
              </div>
              {loading && lowStock.length === 0 ? (
                <div className="flex items-center justify-center h-40"><Loader2 size={28} className="animate-spin text-primary" /></div>
              ) : lowStock.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-success gap-2">
                  <CheckCircle2 size={32} /><span className="text-sm font-semibold">All stock levels healthy</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {lowStock.map((entry, i) => {
                    const med = entry.medicineId;
                    return (
                      <motion.div key={entry._id || i} variants={slideUp} initial="hidden" animate="show" className={`card p-4 border-l-4 ${entry.isOutOfStock ? "border-l-error" : "border-l-warning"}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-base-content">{med?.brandName || "—"}</div>
                            <div className="text-xs text-base-content/60 mt-0.5">{med?.genericName} · {med?.category}</div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                              <span className={`font-bold ${entry.isOutOfStock ? "text-error" : "text-warning"}`}>
                                {fmtInt(entry.availableStock)} units available
                              </span>
                              <span className="text-base-content/50">Reorder: {entry.reorderLevel} units</span>
                              <span className="text-base-content/50">MRP ₹{fmt(entry.mrp)}</span>
                            </div>
                          </div>
                          <button
                            className="btn btn-primary btn-xs gap-1 shrink-0"
                            onClick={() => setModal({ type: "addStock", data: { medicineId: med?._id || entry.medicineId, medicineName: med?.brandName, storeId } })}
                          >
                            <Plus size={12} /> Restock
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── EXPIRY ── */}
          {tab === "expiry" && (
            <motion.div key="expiry" variants={fadeIn} initial="hidden" animate="show">
              <div className="flex items-center gap-2 mb-4 text-warning">
                <Clock size={18} />
                <span className="font-semibold text-sm">{plural(expiryAlertTotal, "batch")} expiring within 30 days</span>
              </div>
              {loading && expiryAlerts.length === 0 ? (
                <div className="flex items-center justify-center h-40"><Loader2 size={28} className="animate-spin text-primary" /></div>
              ) : expiryAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-success gap-2">
                  <CheckCircle2 size={32} /><span className="text-sm font-semibold">No batches expiring soon</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {expiryAlerts.map((entry, i) => {
                    const med = entry.medicineId;
                    const daysLeft = entry.expiryDate ? Math.ceil((new Date(entry.expiryDate) - new Date()) / 86400000) : 0;
                    return (
                      <motion.div key={entry._id || i} variants={slideUp} initial="hidden" animate="show" className={`card p-4 border-l-4 ${daysLeft <= 7 ? "border-l-error" : "border-l-warning"}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-base-content">{med?.brandName || "—"}</div>
                            <div className="text-xs text-base-content/60 mt-0.5">Batch: {entry.batchNumber}</div>
                            <div className="flex items-center gap-3 mt-1.5 text-xs flex-wrap">
                              <span className={`font-bold ${daysLeft <= 7 ? "text-error" : "text-warning"}`}>{daysLeft} days left</span>
                              <span className="text-base-content/50">Expiry: {new Date(entry.expiryDate).toLocaleDateString("en-IN")}</span>
                              <span className="text-base-content/50">{fmtInt(entry.remainingQuantity)} units remaining</span>
                            </div>
                          </div>
                          <button
                            className="btn btn-error btn-xs gap-1 shrink-0"
                            onClick={() => setModal({ type: "deductStock", data: { medicineId: med?._id || entry.medicineId, medicineName: med?.brandName, storeId, availableStock: entry.remainingQuantity } })}
                          >
                            <Minus size={12} /> Write Off
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── ACTIONS ── */}
          {tab === "actions" && (
            <motion.div key="actions" variants={fadeIn} initial="hidden" animate="show" className="space-y-4 max-w-xl">
              <h3 className="font-display font-bold text-base text-base-content mb-2">Store Lifecycle &amp; Bulk Actions</h3>

              {/* Sync */}
              <div className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-sm text-base-content"><RefreshCw size={14} className="text-info" /> Sync Inventory</div>
                    <div className="text-xs text-base-content/60 mt-1">Create missing MedicineInventory placeholders for this store. Safe to run anytime.</div>
                  </div>
                  <button className="btn btn-outline btn-sm shrink-0" onClick={handleSyncOne} disabled={actionLoading}>Sync</button>
                </div>
              </div>

              {/* Trigger alerts */}
              <div className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-sm text-base-content"><Bell size={14} className="text-warning" /> Trigger Low-Stock Alerts</div>
                    <div className="text-xs text-base-content/60 mt-1">Fire email + in-app notifications to admins and pharmacy staff for all items below reorder level.</div>
                  </div>
                  <button className="btn btn-warning btn-sm shrink-0" onClick={handleTriggerAlerts} disabled={actionLoading}>Trigger</button>
                </div>
              </div>

              {/* Suspend / Unsuspend */}
              {!isSuspended ? (
                <div className="card p-4 border-warning/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-sm text-base-content"><PauseCircle size={14} className="text-warning" /> Suspend Store</div>
                      <div className="text-xs text-base-content/60 mt-1">Pause operations. All inventory set inactive. Stock data preserved. Orders blocked.</div>
                    </div>
                    <button className="btn btn-warning btn-sm shrink-0" onClick={handleSuspend} disabled={actionLoading}>Suspend</button>
                  </div>
                </div>
              ) : (
                <div className="card p-4 border-success/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 font-semibold text-sm text-base-content"><PlayCircle size={14} className="text-success" /> Reopen Store</div>
                      <div className="text-xs text-base-content/60 mt-1">Restore store to Open status. All inventory re-activated. Low-stock alerts auto-fire.</div>
                    </div>
                    <button className="btn btn-success btn-sm shrink-0" onClick={handleUnsuspend} disabled={actionLoading}>Reopen</button>
                  </div>
                </div>
              )}

              {/* Delete */}
              <div className="card p-4 border-error/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-semibold text-sm text-base-content"><Trash2 size={14} className="text-error" /> Delete Store</div>
                    <div className="text-xs text-base-content/60 mt-1">Permanently remove store. All inventory soft-deleted. Medicine catalogue untouched. Irreversible.</div>
                  </div>
                  <button className="btn btn-error btn-sm shrink-0" onClick={handleDelete} disabled={actionLoading}>Delete</button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── HELP ── */}
          {tab === "help" && <HelpSection />}

        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal?.type === "addStock" && (
          <AddStockModal key="addStock" {...modal.data} onClose={() => setModal(null)} onSuccess={(m) => { showToast(m); loadData(); }} />
        )}
        {modal?.type === "deductStock" && (
          <DeductStockModal key="deductStock" {...modal.data} onClose={() => setModal(null)} onSuccess={(m) => { showToast(m); loadData(); }} />
        )}
        {modal?.type === "updateInv" && (
          <UpdateInventoryModal key="updateInv" entry={modal.data} onClose={() => setModal(null)} onSuccess={(m) => { showToast(m); loadData(); }} />
        )}
        {confirm && (
          <ConfirmDialog key="confirm" {...confirm} onCancel={() => setConfirm(null)} />
        )}
        {toast && (
          <Toast key="toast" message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Left Panel — Store List
// ══════════════════════════════════════════════════════════════════════════════
function StoreList({ selectedId, onSelect, onReload }) {
  const dispatch = useDispatch();
  const stores = useSelector(selectStores);
  const pagination = useSelector(selectStorePagination);
  const loading = useSelector(selectMedicineLoading);

  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ status: "", storeType: "" });

  const load = useCallback((page = 1) => {
    dispatch(fetchStores({ page, limit: 20, search: search || undefined, status: filters.status || undefined, storeType: filters.storeType || undefined }));
  }, [dispatch, search, filters]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return stores;
    const q = search.toLowerCase();
    return stores.filter(s => s.storeName?.toLowerCase().includes(q) || s.address?.city?.toLowerCase().includes(q));
  }, [stores, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-base-300">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-base text-base-content flex items-center gap-2">
            <Store size={16} className="text-primary" /> Pharmacy Stores
          </h2>
          <span className="badge badge-primary badge-sm">{pagination.total || stores.length}</span>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input className="input-field pl-8 text-xs" placeholder="Search stores…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-2">
          <button className="btn btn-ghost btn-xs gap-1 flex-1" onClick={() => setFilterOpen(p => !p)}>
            <Filter size={11} /> Filter
          </button>
          <button className="btn btn-ghost btn-xs gap-1" onClick={() => { load(); onReload?.(); }}>
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <AnimatePresence>
          {filterOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-2 space-y-2">
                <select className="input-field text-xs" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                  <option value="">All Statuses</option>
                  {["Open","Closed","Under-Maintenance","Inactive"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select className="input-field text-xs" value={filters.storeType} onChange={e => setFilters(p => ({ ...p, storeType: e.target.value }))}>
                  <option value="">All Types</option>
                  <option value="Owned">Owned</option>
                  <option value="Partnered">Partnered</option>
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading && filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40"><Loader2 size={22} className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-base-content/40 gap-2">
            <Store size={28} /><span className="text-xs">No stores found</span>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="p-2 space-y-1">
            {filtered.map(store => {
              const cfg = STATUS_CONFIG[store.status] || STATUS_CONFIG.Closed;
              const isSelected = store._id === selectedId;
              return (
                <motion.button
                  key={store._id}
                  variants={slideRight}
                  onClick={() => onSelect(store)}
                  className={`w-full text-left rounded-box p-3 transition-all border ${isSelected ? "border-primary/50 bg-primary/5" : "border-transparent hover:bg-base-200"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-xs text-base-content truncate">{store.storeName}</span>
                        {isSelected && <ChevronRight size={12} className="text-primary shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`badge ${cfg.cls} badge-xs`}>{cfg.label}</span>
                        <span className="text-xs text-base-content/50">{store.storeType}</span>
                      </div>
                      {store.address?.city && <div className="text-xs text-base-content/40 mt-0.5 flex items-center gap-1"><MapPin size={9}/>{store.address.city}</div>}
                    </div>
                    <div className="flex-col items-end gap-1 hidden sm:flex">
                      <div className={`status-dot status-dot-${store.status === "Open" ? "success" : store.status === "Under-Maintenance" ? "warning" : "error"}`} />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="p-2 border-t border-base-300 flex items-center justify-between">
          <button className="btn btn-ghost btn-xs" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Prev</button>
          <span className="text-xs text-base-content/60">{pagination.page} / {pagination.pages}</span>
          <button className="btn btn-ghost btn-xs" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════
export default function StoresInventoryManagement() {
  const dispatch = useDispatch();
  const actionLoading = useSelector(selectActionLoading);
  const lifecycleResult = useSelector(selectStoreLifecycleResult);

  const [selectedStore, setSelectedStore] = useState(null);
  const [globalToast, setGlobalToast] = useState(null);
  const [syncAllLoading, setSyncAllLoading] = useState(false);

  // Show lifecycle results as toast
  useEffect(() => {
    if (lifecycleResult?.message) {
      setGlobalToast({ msg: lifecycleResult.message, type: lifecycleResult.type === "deleted" ? "error" : "success" });
      if (lifecycleResult.type === "deleted") setSelectedStore(null);
      dispatch(clearStoreLifecycleResult());
    }
  }, [lifecycleResult, dispatch]);

  const handleSyncAll = async () => {
    setSyncAllLoading(true);
    const res = await dispatch(syncAllMedicinesInventory());
    setSyncAllLoading(false);
    if (!res.error) setGlobalToast({ msg: `Sync complete. ${res.payload?.totalEntriesAdded ?? 0} entries added.`, type: "success" });
  };

  const handleStoreSelect = (store) => {
    setSelectedStore(store);
  };

  const handleLifecycle = () => {
    // Refresh store list after lifecycle action
    dispatch(fetchStores({ page: 1, limit: 20 }));
  };

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-base-300 bg-base-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-field bg-primary/10">
            <Warehouse size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-base text-base-content">Stores &amp; Inventory</h1>
            <p className="text-xs text-base-content/50">Manage stock, pricing, batches, and store lifecycle</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-outline btn-sm gap-1.5"
            onClick={handleSyncAll}
            disabled={syncAllLoading}
            title="Sync all medicines across all stores"
          >
            {syncAllLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Sync All
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        <div className="w-64 xl:w-72 shrink-0 border-r border-base-300 flex flex-col overflow-hidden">
          <StoreList
            selectedId={selectedStore?._id}
            onSelect={handleStoreSelect}
            onReload={handleLifecycle}
          />
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {selectedStore ? (
              <motion.div key={selectedStore._id} variants={fadeIn} initial="hidden" animate="show" className="flex-1 overflow-hidden flex flex-col">
                <StoreDetailPanel store={selectedStore} onLifecycle={handleLifecycle} />
              </motion.div>
            ) : (
              <motion.div key="empty" variants={fadeIn} initial="hidden" animate="show" className="flex-1 flex flex-col items-center justify-center gap-4 text-base-content/40">
                <div className="p-6 rounded-full bg-base-200">
                  <Store size={40} className="text-base-content/20" />
                </div>
                <div className="text-center">
                  <div className="font-semibold text-sm text-base-content/60">Select a store</div>
                  <div className="text-xs mt-1">Choose a pharmacy store from the left panel to view and manage its inventory</div>
                </div>
                <div className="flex flex-col items-center gap-2 text-xs text-base-content/30 mt-4">
                  <ArrowRight size={14} />
                  <span>Stock · Pricing · Batches · Expiry · Actions</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Global toast */}
      <AnimatePresence>
        {globalToast && (
          <Toast key="gtost" message={globalToast.msg} type={globalToast.type} onClose={() => setGlobalToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}