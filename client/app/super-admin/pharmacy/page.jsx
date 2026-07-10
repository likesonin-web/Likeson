'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  Package,
  ShoppingCart,
  Plus,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Users,
  Truck,
  FileText,
  HelpCircle,
  X,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  Badge,
  Star,
  Clock,
  ArrowUpRight,
  BarChart3,
  Layers,
  Send,
  Download,
  Info,
  ChevronDown,
  Activity,
} from 'lucide-react';

import {
  fetchAllStores,
  verifyPharmacyStore,
  createPharmacyStore,
  resetPharmacyStatus,
  selectAllStores,
  selectPharmacyPagination,
  selectIsFetchingAll,
  selectIsMutating,
  selectPharmacyError,
  selectPharmacySuccess,
} from '@/store/slices/pharmacySlice';

import {
  fetchSuppliers,
  fetchSupplier,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
  fetchPurchaseOrders,
  fetchPurchaseOrder,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  receivePurchaseOrderStock,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'stores',   label: 'Stores',          Icon: Store },
  { id: 'suppliers',label: 'Suppliers',        Icon: Truck },
  { id: 'pos',      label: 'Purchase Orders',  Icon: ShoppingCart },
  { id: 'help',     label: 'Help & Guide',     Icon: HelpCircle },
];

const STORE_STATUS_MAP = {
  Open:               { cls: 'badge-success', label: 'Open' },
  Closed:             { cls: 'badge-error',   label: 'Closed' },
  'Under-Maintenance':{ cls: 'badge-warning', label: 'Maintenance' },
  Inactive:           { cls: 'badge-error',   label: 'Inactive' },
  Suspended:          { cls: 'badge-error',   label: 'Suspended' },
};

const PO_STATUS_MAP = {
  Draft:              { cls: 'badge-info',    label: 'Draft' },
  Sent:               { cls: 'badge-primary', label: 'Sent' },
  Partially_Received: { cls: 'badge-warning', label: 'Partial' },
  Received:           { cls: 'badge-success', label: 'Received' },
  Cancelled:          { cls: 'badge-error',   label: 'Cancelled' },
  Returned:           { cls: 'badge-error',   label: 'Returned' },
};

const FADE_UP = {
  initial:   { opacity: 0, y: 16 },
  animate:   { opacity: 1, y: 0 },
  exit:      { opacity: 0, y: -8 },
  transition:{ duration: 0.22 },
};

const STAGGER = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const ITEM = {
  initial:   { opacity: 0, y: 12 },
  animate:   { opacity: 1, y: 0 },
  transition:{ duration: 0.2 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n != null ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n) : '—';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtCurrency = (n) =>
  n != null ? `₹${fmt(n)}` : '—';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, accent = false }) {
  return (
    <motion.div variants={ITEM} className="stat-card flex items-center gap-4">
      <div className={`p-3 rounded-xl ${accent ? 'bg-primary/10' : 'bg-base-300/60'}`}>
        <Icon size={20} className={accent ? 'text-primary' : 'text-base-content/60'} />
      </div>
      <div>
        <p className="stat-card-label">{label}</p>
        <p className="stat-card-value text-xl">{value}</p>
      </div>
    </motion.div>
  );
}

function Pagination({ pagination, onPage }) {
  const { currentPage = 1, totalPages = 1 } = pagination;
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        className="btn btn-ghost btn-sm btn-circle"
        onClick={() => onPage(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm text-base-content/60">
        {currentPage} / {totalPages}
      </span>
      <button
        className="btn btn-ghost btn-sm btn-circle"
        onClick={() => onPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function EmptyState({ message, onAction, actionLabel }) {
  return (
    <motion.div {...FADE_UP} className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="p-6 rounded-full bg-base-200">
        <Package size={36} className="text-base-content/30" />
      </div>
      <p className="text-base-content/50 text-sm">{message}</p>
      {onAction && (
        <button className="btn btn-primary btn-sm" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}

function Modal({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-neutral/60 backdrop-blur-soft"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          <motion.div
            className={`relative card p-6 z-10 w-full overflow-y-auto max-h-[90vh] ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.22 }}
          >
            <div className="flex items-center justify-between mb-5">
              <h4 className="text-lg font-bold text-base-content">{title}</h4>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FieldGroup({ label, children, required }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
        {label}{required && <span className="text-error ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── STORES TAB ───────────────────────────────────────────────────────────────

function StoresTab() {
  const dispatch = useDispatch();
  const stores     = useSelector(selectAllStores);
  const pagination = useSelector(selectPharmacyPagination);
  const loading    = useSelector(selectIsFetchingAll);
  const mutating   = useSelector(selectIsMutating);
  const success    = useSelector(selectPharmacySuccess);

  const [search, setSearch]       = useState('');
  const [status, setStatus]       = useState('');
  const [storeType, setStoreType] = useState('');
  const [page, setPage]           = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [detailStore, setDetailStore] = useState(null);

  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    storeData: {
      storeName: '', storeType: 'Partnered',
      address: { line1: '', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '' },
      contact: { email: '', phone: '' },
      legal: { dlNumber: '', gstNumber: '' },
    },
  });

  const load = useCallback(() => {
    dispatch(fetchAllStores({ page, limit: 12, search, status, storeType }));
  }, [dispatch, page, search, status, storeType]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (success) {
      dispatch(resetPharmacyStatus());
      setShowCreate(false);
      setPage(1);
      dispatch(fetchAllStores({ page: 1, limit: 12 }));
    }
  }, [success, dispatch]);

  const handleVerify = (id) => dispatch(verifyPharmacyStore(id));

  const handleCreate = () => {
    dispatch(createPharmacyStore(form));
  };

  const setField = (path, val) => {
    setForm(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = val;
      return next;
    });
  };

  const totalItems = pagination?.total || 0;
  const ownedCount = stores.filter(s => s.storeType === 'Owned').length;
  const verifiedCount = stores.filter(s => s.isVerified).length;
  const openCount = stores.filter(s => s.status === 'Open').length;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={STAGGER} initial="initial" animate="animate">
        <StatCard icon={Store}      label="Total Stores"   value={totalItems}     accent />
        <StatCard icon={Building2}  label="Owned"          value={ownedCount} />
        <StatCard icon={CheckCircle}label="Verified"       value={verifiedCount} />
        <StatCard icon={Activity}   label="Open Now"       value={openCount} />
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            className="input-field pl-9"
            placeholder="Search stores…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input-field w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          {Object.keys(STORE_STATUS_MAP).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field w-auto" value={storeType} onChange={e => { setStoreType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="Owned">Owned</option>
          <option value="Partnered">Partnered</option>
        </select>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={load} title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
        <button className="btn btn-primary btn-sm gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New Store
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-md" />
        </div>
      ) : stores.length === 0 ? (
        <EmptyState message="No stores found." onAction={() => setShowCreate(true)} actionLabel="Create first store" />
      ) : (
        <motion.div variants={STAGGER} initial="initial" animate="animate" className="overflow-x-auto rounded-xl border border-base-300">
          <table className="table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Type</th>
                <th>Manager</th>
                <th>Location</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.map(store => (
                <motion.tr key={store._id} variants={ITEM}>
                  <td>
                    <div>
                      <p className="font-semibold text-sm">{store.storeName}</p>
                      <p className="text-xs text-base-content/50">{store.storeCode}</p>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-sm ${store.storeType === 'Owned' ? 'badge-accent' : 'badge-secondary'}`}>
                      {store.storeType}
                    </span>
                  </td>
                  <td>
                    <div>
                      <p className="text-sm">{store.managedBy?.name || '—'}</p>
                      <p className="text-xs text-base-content/50">{store.managedBy?.email || ''}</p>
                    </div>
                  </td>
                  <td className="text-sm text-base-content/70">
                    {store.address?.city}, {store.address?.state}
                  </td>
                  <td>
                    <span className={`badge badge-sm ${STORE_STATUS_MAP[store.status]?.cls || 'badge-info'}`}>
                      {STORE_STATUS_MAP[store.status]?.label || store.status}
                    </span>
                  </td>
                  <td>
                    {store.isVerified
                      ? <CheckCircle size={16} className="text-success" />
                      : <XCircle size={16} className="text-error" />}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        className="btn btn-ghost btn-xs btn-circle"
                        title="View details"
                        onClick={() => setDetailStore(store)}
                      >
                        <Eye size={13} />
                      </button>
                      {!store.isVerified && (
                        <button
                          className="btn btn-ghost btn-xs btn-circle text-success"
                          title="Verify store"
                          onClick={() => handleVerify(store._id)}
                        >
                          <CheckCircle size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      <Pagination pagination={pagination} onPage={setPage} />

      {/* Create Store Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Register New Pharmacy Store" wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-full">
            <p className="text-xs text-base-content/50 mb-4 alert alert-info">
              <Info size={14} />
              Creates store + manager user account atomically. Credentials sent via email.
            </p>
          </div>

          <div className="col-span-full">
            <h5 className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-3">Manager Account</h5>
          </div>
          <FieldGroup label="Manager Name" required>
            <input className="input-field" placeholder="Full name" value={form.name} onChange={e => setField('name', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Manager Email" required>
            <input className="input-field" placeholder="email@example.com" value={form.email} onChange={e => setField('email', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Manager Phone" required>
            <input className="input-field" placeholder="+91 9999999999" value={form.phone} onChange={e => setField('phone', e.target.value)} />
          </FieldGroup>

          <div className="col-span-full mt-2">
            <h5 className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-3">Store Details</h5>
          </div>
          <FieldGroup label="Store Name" required>
            <input className="input-field" placeholder="Store display name" value={form.storeData.storeName} onChange={e => setField('storeData.storeName', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Store Type" required>
            <select className="input-field" value={form.storeData.storeType} onChange={e => setField('storeData.storeType', e.target.value)}>
              <option value="Partnered">Partnered</option>
              <option value="Owned">Owned</option>
            </select>
          </FieldGroup>
          <FieldGroup label="Store Email">
            <input className="input-field" placeholder="store@example.com" value={form.storeData.contact.email} onChange={e => setField('storeData.contact.email', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Store Phone">
            <input className="input-field" placeholder="Phone" value={form.storeData.contact.phone} onChange={e => setField('storeData.contact.phone', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Address Line 1">
            <input className="input-field" placeholder="Street address" value={form.storeData.address.line1} onChange={e => setField('storeData.address.line1', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Pincode">
            <input className="input-field" placeholder="521001" value={form.storeData.address.pincode} onChange={e => setField('storeData.address.pincode', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="City">
            <input className="input-field" value={form.storeData.address.city} onChange={e => setField('storeData.address.city', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="State">
            <input className="input-field" value={form.storeData.address.state} onChange={e => setField('storeData.address.state', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Drug License No." required>
            <input className="input-field" placeholder="DL-XXXXXXXXX" value={form.storeData.legal.dlNumber} onChange={e => setField('storeData.legal.dlNumber', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="GST Number">
            <input className="input-field" placeholder="GST number" value={form.storeData.legal.gstNumber} onChange={e => setField('storeData.legal.gstNumber', e.target.value)} />
          </FieldGroup>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          <button className="btn btn-primary btn-sm gap-2" onClick={handleCreate} disabled={mutating}>
            {mutating ? <span className="loading loading-xs" /> : <Plus size={14} />}
            Create Store
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailStore} onClose={() => setDetailStore(null)} title="Store Details" wide>
        {detailStore && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black">{detailStore.storeName}</h3>
                <p className="text-xs text-base-content/50 mt-1">{detailStore.storeCode}</p>
              </div>
              <div className="flex gap-2">
                <span className={`badge ${detailStore.storeType === 'Owned' ? 'badge-accent' : 'badge-secondary'}`}>{detailStore.storeType}</span>
                <span className={`badge ${STORE_STATUS_MAP[detailStore.status]?.cls || 'badge-info'}`}>{detailStore.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2 text-base-content/70">
                <MapPin size={14} className="text-primary" />
                {detailStore.address?.line1}, {detailStore.address?.city}, {detailStore.address?.pincode}
              </div>
              <div className="flex items-center gap-2 text-base-content/70">
                <Phone size={14} className="text-primary" />
                {detailStore.contact?.phone || '—'}
              </div>
              <div className="flex items-center gap-2 text-base-content/70">
                <Mail size={14} className="text-primary" />
                {detailStore.contact?.email || '—'}
              </div>
              <div className="flex items-center gap-2 text-base-content/70">
                <FileText size={14} className="text-primary" />
                DL: {detailStore.legal?.dlNumber || '—'}
              </div>
              <div className="flex items-center gap-2 text-base-content/70">
                <Users size={14} className="text-primary" />
                Manager: {detailStore.managedBy?.name || '—'}
              </div>
              <div className="flex items-center gap-2 text-base-content/70">
                <Calendar size={14} className="text-primary" />
                Created: {fmtDate(detailStore.createdAt)}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="stat-card text-center">
                <p className="stat-card-value">{detailStore.performanceMetrics?.avgRating?.toFixed(1) || '0.0'}</p>
                <p className="stat-card-label">Avg Rating</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-card-value">{fmt(detailStore.performanceMetrics?.totalOrdersServed)}</p>
                <p className="stat-card-label">Orders Served</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-card-value">{detailStore.performanceMetrics?.acceptanceRate || '100'}%</p>
                <p className="stat-card-label">Acceptance</p>
              </div>
            </div>

            {!detailStore.isVerified && (
              <button
                className="btn btn-success btn-sm gap-2 self-start"
                onClick={() => { handleVerify(detailStore._id); setDetailStore(null); }}
              >
                <CheckCircle size={14} /> Verify Store
              </button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── SUPPLIERS TAB ────────────────────────────────────────────────────────────

function SuppliersTab() {
  const dispatch = useDispatch();
  const { suppliers, suppliersPagination, loading, errors, success, currentSupplier } = useSelector(s => ({
    suppliers:          s.pharmacyStore.suppliers,
    suppliersPagination:s.pharmacyStore.suppliersPagination,
    loading:            s.pharmacyStore.loading,
    errors:             s.pharmacyStore.errors,
    success:            s.pharmacyStore.success,
    currentSupplier:    s.pharmacyStore.currentSupplier,
  }));

  const [search, setSearch]     = useState('');
  const [isActive, setIsActive] = useState('true');
  const [page, setPage]         = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [detailSupplier, setDetailSupplier] = useState(null);

  const [form, setForm] = useState({
    name: '',
    contact: { personName: '', email: '', phone: '' },
    address: { line1: '', city: '', state: '', pincode: '' },
    legal: { gstNumber: '', dlNumber: '', panNumber: '' },
    paymentTerms: { creditPeriodDays: 30, preferredMethod: 'Bank Transfer' },
  });

  const load = useCallback(() => {
    dispatch(fetchSuppliers({ search, isActive, page, limit: 15 }));
  }, [dispatch, search, isActive, page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (success.createSupplier) {
      setShowCreate(false);
      load();
    }
  }, [success.createSupplier, load]);

  const sf = (path, val) => {
    setForm(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let cur = next;
      for (let i = 0; i < keys.length - 1; i++) {
        cur[keys[i]] = { ...cur[keys[i]] };
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = val;
      return next;
    });
  };

  const handleView = (id) => {
    dispatch(fetchSupplier(id)).then(r => {
      if (r.payload) setDetailSupplier(r.payload);
    });
  };

  const handleDeactivate = (id) => {
    if (confirm('Deactivate this supplier?')) dispatch(deactivateSupplier(id)).then(load);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            className="input-field pl-9"
            placeholder="Search suppliers…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="input-field w-auto" value={isActive} onChange={e => setIsActive(e.target.value)}>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
          <option value="all">All</option>
        </select>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={load}>
          <RefreshCw size={15} className={loading.suppliers ? 'animate-spin' : ''} />
        </button>
        <button className="btn btn-primary btn-sm gap-2" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> Add Supplier
        </button>
      </div>

      {/* List */}
      {loading.suppliers ? (
        <div className="flex justify-center py-16"><span className="loading loading-md" /></div>
      ) : suppliers.length === 0 ? (
        <EmptyState message="No suppliers found." onAction={() => setShowCreate(true)} actionLabel="Add first supplier" />
      ) : (
        <motion.div variants={STAGGER} initial="initial" animate="animate" className="overflow-x-auto rounded-xl border border-base-300">
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Contact</th>
                <th>GST</th>
                <th>Drug License</th>
                <th>Credit Days</th>
                <th>Rating</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <motion.tr key={s._id} variants={ITEM}>
                  <td>
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-base-content/50">{s.code}</p>
                  </td>
                  <td>
                    <p className="text-xs">{s.contact?.email}</p>
                    <p className="text-xs text-base-content/60">{s.contact?.phone}</p>
                  </td>
                  <td className="text-sm">{s.legal?.gstNumber || '—'}</td>
                  <td className="text-sm">{s.legal?.dlNumber || '—'}</td>
                  <td className="text-sm">{s.paymentTerms?.creditPeriodDays || 30}d</td>
                  <td>
                    <span className="flex items-center gap-1 text-sm">
                      <Star size={12} className="text-warning" />
                      {s.metrics?.rating?.toFixed(1) || '0.0'}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-sm ${s.isActive ? 'badge-success' : 'badge-error'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs btn-circle" onClick={() => handleView(s._id)} title="View"><Eye size={13} /></button>
                      {s.isActive && (
                        <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => handleDeactivate(s._id)} title="Deactivate">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      <Pagination pagination={suppliersPagination} onPage={setPage} />

      {/* Create Supplier Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Supplier" wide>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldGroup label="Company Name" required>
            <input className="input-field" placeholder="Supplier name" value={form.name} onChange={e => sf('name', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Contact Person">
            <input className="input-field" placeholder="Rep name" value={form.contact.personName} onChange={e => sf('contact.personName', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Email" required>
            <input className="input-field" placeholder="email@supplier.com" value={form.contact.email} onChange={e => sf('contact.email', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Phone" required>
            <input className="input-field" placeholder="+91 9999999999" value={form.contact.phone} onChange={e => sf('contact.phone', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="GST Number" required>
            <input className="input-field" placeholder="GSTIN" value={form.legal.gstNumber} onChange={e => sf('legal.gstNumber', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Drug License No." required>
            <input className="input-field" placeholder="DL-XXXXXXX" value={form.legal.dlNumber} onChange={e => sf('legal.dlNumber', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="PAN">
            <input className="input-field" placeholder="ABCDE1234F" value={form.legal.panNumber} onChange={e => sf('legal.panNumber', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Credit Period (Days)">
            <input className="input-field" type="number" value={form.paymentTerms.creditPeriodDays} onChange={e => sf('paymentTerms.creditPeriodDays', +e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Preferred Payment">
            <select className="input-field" value={form.paymentTerms.preferredMethod} onChange={e => sf('paymentTerms.preferredMethod', e.target.value)}>
              <option>Bank Transfer</option>
              <option>Cheque</option>
              <option>UPI</option>
            </select>
          </FieldGroup>
          <FieldGroup label="City">
            <input className="input-field" value={form.address.city} onChange={e => sf('address.city', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="State">
            <input className="input-field" value={form.address.state} onChange={e => sf('address.state', e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Pincode">
            <input className="input-field" value={form.address.pincode} onChange={e => sf('address.pincode', e.target.value)} />
          </FieldGroup>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          <button
            className="btn btn-primary btn-sm gap-2"
            onClick={() => dispatch(createSupplier(form))}
            disabled={loading.createSupplier}
          >
            {loading.createSupplier ? <span className="loading loading-xs" /> : <Plus size={14} />}
            Create
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailSupplier} onClose={() => setDetailSupplier(null)} title="Supplier Details" wide>
        {detailSupplier && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-black">{detailSupplier.name}</h3>
                <p className="text-xs text-base-content/50">{detailSupplier.code}</p>
              </div>
              <span className={`badge ${detailSupplier.isActive ? 'badge-success' : 'badge-error'}`}>
                {detailSupplier.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <p className="flex gap-2 items-center text-base-content/70"><Mail size={14} className="text-primary" />{detailSupplier.contact?.email}</p>
              <p className="flex gap-2 items-center text-base-content/70"><Phone size={14} className="text-primary" />{detailSupplier.contact?.phone}</p>
              <p className="flex gap-2 items-center text-base-content/70"><FileText size={14} className="text-primary" />GST: {detailSupplier.legal?.gstNumber || '—'}</p>
              <p className="flex gap-2 items-center text-base-content/70"><FileText size={14} className="text-primary" />DL: {detailSupplier.legal?.dlNumber || '—'}</p>
              <p className="flex gap-2 items-center text-base-content/70"><MapPin size={14} className="text-primary" />{detailSupplier.address?.city}, {detailSupplier.address?.state}</p>
              <p className="flex gap-2 items-center text-base-content/70"><Clock size={14} className="text-primary" />{detailSupplier.paymentTerms?.creditPeriodDays}d credit</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="stat-card text-center">
                <p className="stat-card-value">{detailSupplier.metrics?.rating?.toFixed(1) || '—'}</p>
                <p className="stat-card-label">Rating</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-card-value">{detailSupplier.metrics?.averageFulfillmentTimeDays || '—'}d</p>
                <p className="stat-card-label">Avg Fulfillment</p>
              </div>
              <div className="stat-card text-center">
                <p className="stat-card-value">{detailSupplier.metrics?.returnRatePercent || '0'}%</p>
                <p className="stat-card-label">Return Rate</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── PURCHASE ORDERS TAB ──────────────────────────────────────────────────────

function PurchaseOrdersTab() {
  const dispatch = useDispatch();
  const {
    purchaseOrders, purchaseOrdersPagination,
    suppliers,
    loading, success, currentPurchaseOrder, poReceivingResult,
  } = useSelector(s => ({
    purchaseOrders:        s.pharmacyStore.purchaseOrders,
    purchaseOrdersPagination: s.pharmacyStore.purchaseOrdersPagination,
    suppliers:             s.pharmacyStore.suppliers,
    loading:               s.pharmacyStore.loading,
    success:               s.pharmacyStore.success,
    currentPurchaseOrder:  s.pharmacyStore.currentPurchaseOrder,
    poReceivingResult:     s.pharmacyStore.poReceivingResult,
  }));

  const [status, setStatus]       = useState('');
  const [suppId, setSuppId]       = useState('');
  const [dateFilter, setDateFilter] = useState('last30days');
  const [page, setPage]           = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [detailPO, setDetailPO]   = useState(null);
  const [showStatus, setShowStatus] = useState(null); // { po, targetStatus }

  const [form, setForm] = useState({
    supplierId: '',
    expectedDeliveryDate: '',
    notes: '',
    items: [{ medicineId: '', requestedQuantity: 1, unitPrice: 0 }],
  });

  const load = useCallback(() => {
    dispatch(fetchPurchaseOrders({ status, supplierId: suppId, dateFilter, page, limit: 15 }));
  }, [dispatch, status, suppId, dateFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { dispatch(fetchSuppliers({ limit: 100 })); }, [dispatch]);

  useEffect(() => {
    if (success.createPurchaseOrder) {
      setShowCreate(false);
      load();
    }
  }, [success.createPurchaseOrder, load]);

  useEffect(() => {
    if (success.updatePurchaseOrder) {
      setShowStatus(null);
      load();
    }
  }, [success.updatePurchaseOrder, load]);

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { medicineId: '', requestedQuantity: 1, unitPrice: 0 }] }));
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const setItemField = (idx, field, val) => {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [field]: val };
      return { ...p, items };
    });
  };

  const handleView = (id) => {
    dispatch(fetchPurchaseOrder(id)).then(r => {
      if (r.payload) setDetailPO(r.payload);
    });
  };

  const handleStatusChange = (po, targetStatus) => {
    dispatch(updatePurchaseOrderStatus({ poId: po._id, status: targetStatus }));
  };

  const totalOrders = purchaseOrdersPagination?.totalItems || 0;
  const draftCount  = purchaseOrders.filter(p => p.status === 'Draft').length;
  const sentCount   = purchaseOrders.filter(p => p.status === 'Sent').length;
  const rcvdCount   = purchaseOrders.filter(p => p.status === 'Received').length;

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <motion.div className="grid grid-cols-2 lg:grid-cols-4 gap-4" variants={STAGGER} initial="initial" animate="animate">
        <StatCard icon={ShoppingCart} label="Total POs"   value={totalOrders} accent />
        <StatCard icon={FileText}     label="Draft"       value={draftCount} />
        <StatCard icon={Send}         label="Sent"        value={sentCount} />
        <StatCard icon={CheckCircle}  label="Received"    value={rcvdCount} />
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select className="input-field w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          {Object.keys(PO_STATUS_MAP).map(s => <option key={s} value={s}>{PO_STATUS_MAP[s].label}</option>)}
        </select>
        <select className="input-field w-auto" value={suppId} onChange={e => setSuppId(e.target.value)}>
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select className="input-field w-auto" value={dateFilter} onChange={e => setDateFilter(e.target.value)}>
          <option value="today">Today</option>
          <option value="last7days">Last 7 Days</option>
          <option value="last30days">Last 30 Days</option>
        </select>
        <button className="btn btn-ghost btn-sm btn-circle" onClick={load}>
          <RefreshCw size={15} className={loading.purchaseOrders ? 'animate-spin' : ''} />
        </button>
        <button className="btn btn-primary btn-sm gap-2 ml-auto" onClick={() => setShowCreate(true)}>
          <Plus size={15} /> New PO
        </button>
      </div>

      {/* Table */}
      {loading.purchaseOrders ? (
        <div className="flex justify-center py-16"><span className="loading loading-md" /></div>
      ) : purchaseOrders.length === 0 ? (
        <EmptyState message="No purchase orders found." onAction={() => setShowCreate(true)} actionLabel="Create first PO" />
      ) : (
        <motion.div variants={STAGGER} initial="initial" animate="animate" className="overflow-x-auto rounded-xl border border-base-300">
          <table className="table">
            <thead>
              <tr>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Items</th>
                <th>Grand Total</th>
                <th>Expected Delivery</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map(po => (
                <motion.tr key={po._id} variants={ITEM}>
                  <td>
                    <p className="font-semibold text-sm font-mono">{po.poNumber}</p>
                    <p className="text-xs text-base-content/50">{fmtDate(po.createdAt)}</p>
                  </td>
                  <td className="text-sm">{po.supplierId?.name || '—'}</td>
                  <td className="text-sm">{po.items?.length || 0}</td>
                  <td className="text-sm font-semibold">{fmtCurrency(po.financials?.grandTotal)}</td>
                  <td className="text-sm">{fmtDate(po.expectedDeliveryDate)}</td>
                  <td>
                    <span className={`badge badge-sm ${PO_STATUS_MAP[po.status]?.cls || 'badge-info'}`}>
                      {PO_STATUS_MAP[po.status]?.label || po.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost btn-xs btn-circle" onClick={() => handleView(po._id)}><Eye size={13} /></button>
                      {po.status === 'Draft' && (
                        <button
                          className="btn btn-ghost btn-xs btn-circle text-primary"
                          title="Send to supplier"
                          onClick={() => handleStatusChange(po, 'Sent')}
                        >
                          <Send size={13} />
                        </button>
                      )}
                      {(po.status === 'Draft' || po.status === 'Sent') && (
                        <button
                          className="btn btn-ghost btn-xs btn-circle text-error"
                          title="Cancel PO"
                          onClick={() => handleStatusChange(po, 'Cancelled')}
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      <Pagination pagination={purchaseOrdersPagination} onPage={setPage} />

      {/* Create PO Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Purchase Order" wide>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup label="Supplier" required>
              <select className="input-field" value={form.supplierId} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value }))}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Expected Delivery Date">
              <input className="input-field" type="date" value={form.expectedDeliveryDate} onChange={e => setForm(p => ({ ...p, expectedDeliveryDate: e.target.value }))} />
            </FieldGroup>
            <div className="col-span-full">
              <FieldGroup label="Notes">
                <textarea className="input-field min-h-[60px]" placeholder="Optional notes…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </FieldGroup>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-bold uppercase tracking-widest text-base-content/50">Items</h5>
              <button className="btn btn-ghost btn-xs gap-1" onClick={addItem}><Plus size={12} /> Add Item</button>
            </div>
            <div className="flex flex-col gap-3">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2 items-end p-3 rounded-lg bg-base-200">
                  <FieldGroup label="Medicine ID">
                    <input className="input-field text-xs" placeholder="Medicine ObjectId" value={item.medicineId} onChange={e => setItemField(idx, 'medicineId', e.target.value)} />
                  </FieldGroup>
                  <FieldGroup label="Qty">
                    <input className="input-field" type="number" min="1" value={item.requestedQuantity} onChange={e => setItemField(idx, 'requestedQuantity', +e.target.value)} />
                  </FieldGroup>
                  <FieldGroup label="Unit Price (₹)">
                    <div className="flex gap-1">
                      <input className="input-field" type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => setItemField(idx, 'unitPrice', +e.target.value)} />
                      {form.items.length > 1 && (
                        <button className="btn btn-ghost btn-xs btn-circle text-error" onClick={() => removeItem(idx)}><X size={12} /></button>
                      )}
                    </div>
                  </FieldGroup>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-2">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            <button
              className="btn btn-primary btn-sm gap-2"
              onClick={() => dispatch(createPurchaseOrder(form))}
              disabled={loading.createPurchaseOrder}
            >
              {loading.createPurchaseOrder ? <span className="loading loading-xs" /> : <Plus size={14} />}
              Create PO
            </button>
          </div>
        </div>
      </Modal>

      {/* PO Detail Modal */}
      <Modal open={!!detailPO} onClose={() => setDetailPO(null)} title="Purchase Order Details" wide>
        {detailPO && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black font-mono">{detailPO.poNumber}</h3>
                <p className="text-xs text-base-content/50">Created {fmtDate(detailPO.createdAt)}</p>
              </div>
              <span className={`badge ${PO_STATUS_MAP[detailPO.status]?.cls || 'badge-info'}`}>
                {PO_STATUS_MAP[detailPO.status]?.label || detailPO.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <p className="flex gap-2 items-center text-base-content/70"><Truck size={14} className="text-primary" />{detailPO.supplierId?.name || '—'}</p>
              <p className="flex gap-2 items-center text-base-content/70"><Calendar size={14} className="text-primary" />ETA: {fmtDate(detailPO.expectedDeliveryDate)}</p>
              {detailPO.receivedAt && <p className="flex gap-2 items-center text-base-content/70"><CheckCircle size={14} className="text-success" />Received: {fmtDate(detailPO.receivedAt)}</p>}
              {detailPO.notes && <p className="col-span-2 text-base-content/60 italic text-xs">{detailPO.notes}</p>}
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-base-content/50 mb-2">Items</p>
              <div className="overflow-x-auto rounded-lg border border-base-300">
                <table className="table text-xs">
                  <thead>
                    <tr><th>Medicine</th><th>Requested</th><th>Received</th><th>Unit Price</th><th>Total</th></tr>
                  </thead>
                  <tbody>
                    {detailPO.items?.map((it, i) => (
                      <tr key={i}>
                        <td>{it.medicineId?.brandName || it.medicineId?.name || it.medicineId?._id || '—'}</td>
                        <td>{it.requestedQuantity}</td>
                        <td>{it.receivedQuantity}</td>
                        <td>{fmtCurrency(it.unitPrice)}</td>
                        <td>{fmtCurrency(it.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financials */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="stat-card">
                <p className="stat-card-label">Subtotal</p>
                <p className="stat-card-value text-lg">{fmtCurrency(detailPO.financials?.subTotal)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card-label">Tax</p>
                <p className="stat-card-value text-lg">{fmtCurrency(detailPO.financials?.taxTotal)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card-label">Discount</p>
                <p className="stat-card-value text-lg">{fmtCurrency(detailPO.financials?.discountTotal)}</p>
              </div>
              <div className="stat-card">
                <p className="stat-card-label">Grand Total</p>
                <p className="stat-card-value text-lg text-primary">{fmtCurrency(detailPO.financials?.grandTotal)}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              {detailPO.status === 'Draft' && (
                <button className="btn btn-primary btn-sm gap-2" onClick={() => { dispatch(updatePurchaseOrderStatus({ poId: detailPO._id, status: 'Sent' })); setDetailPO(null); }}>
                  <Send size={14} /> Send to Supplier
                </button>
              )}
              {(detailPO.status === 'Draft' || detailPO.status === 'Sent') && (
                <button className="btn btn-error btn-sm gap-2" onClick={() => { dispatch(updatePurchaseOrderStatus({ poId: detailPO._id, status: 'Cancelled' })); setDetailPO(null); }}>
                  <XCircle size={14} /> Cancel PO
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── HELP TAB ─────────────────────────────────────────────────────────────────

const HELP_SECTIONS = [
  {
    icon: Store,
    title: 'Pharmacy Stores',
    color: 'text-primary',
    items: [
      { q: 'What is a store type?', a: '"Owned" = direct Likeson-operated pharmacy. "Partnered" = third-party franchise. Store type controls commission logic — owned stores use platform margin %, partnered use commission %.' },
      { q: 'How to create a store?', a: 'Click "New Store". You must enter manager name, email, phone + store legal info (Drug License is mandatory). Server atomically creates: User account (role=pharmacy) + PharmacyStore + PharmacyProfile. Temp credentials emailed to manager.' },
      { q: 'What does "Verify" do?', a: 'Sets isVerified=true on the store. Only verified stores appear in customer search results and can accept orders. Use after reviewing DL and GST documents.' },
      { q: 'Store statuses', a: '"Open" = actively accepting orders. "Closed" = manually closed by manager. "Under-Maintenance" = temporary shutdown. "Suspended" = admin action, all orders blocked. "Inactive" = soft-disabled.' },
      { q: 'Performance metrics', a: 'acceptanceRate, successRate, avgPreparationTimeMin, avgDeliveryTimeMin, avgRating are auto-computed from order data. These power the store selection algorithm (priorityScore).' },
    ],
  },
  {
    icon: Truck,
    title: 'Suppliers',
    color: 'text-secondary',
    items: [
      { q: 'What is a supplier?', a: 'B2B entity that provides medicine batches to stores. Each supplier has GST + Drug License (mandatory by law), contact person, payment terms, and performance metrics.' },
      { q: 'Who can create suppliers?', a: 'Only admin / superadmin via this panel. Pharmacy staff can view suppliers in their store dashboard but cannot create.' },
      { q: 'Supplier code', a: 'Auto-generated from company name + timestamp. Used as unique identifier in POs and inventory movements.' },
      { q: 'Credit period', a: 'Days before payment is due after delivery. Standard is 30 days. Tracked in paymentTerms.creditPeriodDays.' },
      { q: 'Deactivating a supplier', a: 'Sets isActive=false. Supplier disappears from active lists but all historical POs and movements remain intact. Cannot be hard-deleted.' },
    ],
  },
  {
    icon: ShoppingCart,
    title: 'Purchase Orders',
    color: 'text-accent',
    items: [
      { q: 'PO lifecycle', a: 'Draft → Sent → (Partially_Received) → Received. Can cancel from Draft or Sent. Once Received, PO is locked and cannot be modified.' },
      { q: 'How does receiving stock work?', a: 'Use POST /purchase-orders/:id/receive from the pharmacy store panel (not here). Each received item creates/updates MedicineInventory, creates MedicineBatch (batch number + expiry required), and logs to InventoryMovement.' },
      { q: 'FEFO stock strategy', a: 'First Expire First Out. When receiving batches, fifoPriority = expiryDate.getTime(). Inventory always points batchId to earliest-expiry active batch. Deductions pull from earliest expiry first.' },
      { q: 'financials breakdown', a: 'subTotal = sum(qty × unitPrice). taxTotal = per-item GST from HsnCode. grandTotal = subTotal + taxTotal - discountTotal. All computed server-side at PO creation.' },
      { q: 'Where are items validated?', a: 'Server checks medicineId exists, computes GST from Medicine → hsnCode → gstPercentage. Admin panel only needs to pass medicineId (ObjectId), requestedQuantity, unitPrice per item.' },
      { q: 'Who can create POs from admin?', a: 'Admin + superadmin via this page. Pharmacy staff can create POs from their store dashboard under Purchase Orders section (attached to their store). Here you have cross-store view.' },
    ],
  },
  {
    icon: Activity,
    title: 'Inventory & Movements',
    color: 'text-success',
    items: [
      { q: 'MedicineInventory vs MedicineBatch', a: 'MedicineInventory = one doc per store+medicine. Holds stockQuantity, pricing, isLowStock, isOutOfStock, pointer to active batch. MedicineBatch = one doc per physical batch received. Holds batchNumber, expiryDate, remainingQuantity.' },
      { q: 'What triggers low stock alerts?', a: 'When availableStock ≤ reorderLevel (default 5). System sends notification + email to pharmacy user via dispatchLowStockAlert(). Also triggered on stock deduction.' },
      { q: 'InventoryMovement ledger', a: 'Append-only log of every stock change. movementType ∈ {Purchase, Sale, Reservation, Release, Adjustment_Add, Adjustment_Sub, Damage, Expiry, Return, Transfer_In, Transfer_Out}. Never modified after creation.' },
    ],
  },
  {
    icon: Users,
    title: 'Roles & Access',
    color: 'text-warning',
    items: [
      { q: 'This page access', a: 'Admin + Superadmin only. Protected by authorize("admin","superadmin") middleware on all endpoints. Pharmacy role cannot access store creation, supplier management, or cross-store PO view.' },
      { q: 'Pharmacy staff access', a: 'Pharmacy users access /pharmacy-store/* endpoints which are scoped to their assigned store via attachPharmacyStore middleware. They manage their own orders, inventory, suppliers view, and POs for their store only.' },
      { q: 'Redux slices', a: 'pharmacySlice (src/@/store/slices/pharmacySlice) = stores + admin ops. pharmacyStoreSlice (src/redux/slices/pharmacyStoreSlice) = store-scoped ops like suppliers, POs, inventory. Both used here.' },
    ],
  },
];

function HelpAccordion({ section }) {
  const [open, setOpen] = useState(null);
  return (
    <motion.div variants={ITEM} className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <section.icon size={18} className={section.color} />
        <h4 className="font-bold">{section.title}</h4>
      </div>
      <div className="flex flex-col gap-2">
        {section.items.map((item, i) => (
          <div key={i} className="border border-base-300 rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-left hover:bg-base-200 transition-colors"
              onClick={() => setOpen(open === i ? null : i)}
            >
              {item.q}
              <ChevronDown size={14} className={`transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="px-4 pb-4 text-sm text-base-content/70 leading-relaxed">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function HelpTab() {
  return (
    <div className="flex flex-col gap-6">
      <motion.div variants={FADE_UP} {...FADE_UP} className="alert alert-info">
        <Info size={16} />
        <span className="text-sm">This guide covers all concepts, models, and workflows for the Pharmacy Management section. Expand any question to see details.</span>
      </motion.div>
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        variants={STAGGER}
        initial="initial"
        animate="animate"
      >
        {HELP_SECTIONS.map(sec => (
          <HelpAccordion key={sec.title} section={sec} />
        ))}
      </motion.div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PharmacyStoresManagement() {
  const [activeTab, setActiveTab] = useState('stores');

  return (
    <div className="min-h-screen bg-base-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <motion.div
          {...FADE_UP}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <h2 className="text-3xl font-black text-base-content tracking-tight">
              Pharmacy Management
            </h2>
            <p className="text-sm text-base-content/50 mt-1">
              Stores · Suppliers · Purchase Orders — Admin & Superadmin only
            </p>
          </div>
          <div className="badge badge-primary gap-1.5">
            <Building2 size={12} />
            Admin Console
          </div>
        </motion.div>

        {/* Tab Bar */}
        <div className="flex gap-1 p-1 bg-base-200 rounded-xl w-full sm:w-auto overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-base-100 text-primary shadow-sm'
                  : 'text-base-content/60 hover:text-base-content'
              }`}
            >
              <tab.Icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'stores'    && <StoresTab />}
            {activeTab === 'suppliers' && <SuppliersTab />}
            {activeTab === 'pos'       && <PurchaseOrdersTab />}
            {activeTab === 'help'      && <HelpTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}