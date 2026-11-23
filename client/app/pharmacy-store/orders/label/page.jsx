'use client';

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Tag, Download, Printer, RefreshCw, X,
  AlertTriangle, ExternalLink, Barcode, QrCode, Package
} from 'lucide-react';
import {
  fetchOrderLabel,
  clearOrderDocuments,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

function DeliveryLabelComponent({ order, onClose }) {
  const dispatch = useDispatch();
  const { currentOrderLabelHtml, loading, errors } = useSelector((s) => s.pharmacyStore);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (order?._id && !currentOrderLabelHtml) {
      dispatch(fetchOrderLabel(order._id));
    }
  }, [order?._id, dispatch, currentOrderLabelHtml]);

  useEffect(() => {
    return () => { dispatch(clearOrderDocuments()); };
  }, [dispatch]);

  const handlePrint = () => {
    if (!iframeRef.current) return;
    iframeRef.current.contentWindow?.print();
  };

  const handleDownload = () => {
    if (!currentOrderLabelHtml) return;
    const blob = new Blob([currentOrderLabelHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Label-${order?.orderId ?? 'order'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenNew = () => {
    if (!currentOrderLabelHtml) return;
    const blob = new Blob([currentOrderLabelHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <div data-theme="pharmacy" className="flex flex-col h-full" style={{ minHeight: 500 }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--base-300)', background: 'var(--base-200)' }}
      >
        <div className="flex items-center gap-2">
          <Tag size={16} style={{ color: 'var(--secondary)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>
            Delivery Label — #{order?.orderId}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => { dispatch(clearOrderDocuments()); dispatch(fetchOrderLabel(order._id)); }}
            className="p-2 rounded-lg"
            style={{ background: 'var(--base-300)', color: 'var(--base-content)' }}
            title="Reload"
          >
            <RefreshCw size={13} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={handleOpenNew}
            disabled={!currentOrderLabelHtml}
            className="p-2 rounded-lg disabled:opacity-40"
            style={{ background: 'var(--base-300)', color: 'var(--base-content)' }}
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={handleDownload}
            disabled={!currentOrderLabelHtml}
            className="p-2 rounded-lg disabled:opacity-40"
            style={{ background: 'color-mix(in srgb, var(--accent), transparent 85%)', color: 'var(--accent)' }}
            title="Download"
          >
            <Download size={13} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={handlePrint}
            disabled={!currentOrderLabelHtml}
            className="p-2 rounded-lg disabled:opacity-40 flex items-center gap-1.5 text-xs font-bold px-3"
            style={{ background: 'var(--secondary)', color: 'var(--secondary-content)' }}
            title="Print Label"
          >
            <Printer size={13} /> Print Label
          </motion.button>
          {onClose && (
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 rounded-lg ml-1"
              style={{ background: 'color-mix(in srgb, var(--error), transparent 85%)', color: 'var(--error)' }}
            >
              <X size={13} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Label specs chip */}
      <div className="px-4 py-2 flex items-center gap-3 border-b" style={{ borderColor: 'var(--base-300)', background: 'var(--base-100)' }}>
        {[
          { icon: Barcode, label: 'CODE128 Barcode' },
          { icon: QrCode, label: 'QR Code' },
          { icon: Package, label: '100×150mm' },
        ].map((chip) => (
          <span key={chip.label} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border"
            style={{ background: 'color-mix(in srgb, var(--secondary), transparent 88%)', color: 'var(--secondary)', borderColor: 'color-mix(in srgb, var(--secondary), transparent 65%)' }}>
            <chip.icon size={10} /> {chip.label}
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 relative" style={{ minHeight: 400 }}>
        {loading.orderLabel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="spinner w-8 h-8" />
            <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>Generating label…</p>
          </div>
        ) : errors.orderLabel ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
            <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
            <p className="text-sm font-semibold text-center" style={{ color: 'var(--base-content)' }}>
              {errors.orderLabel.message}
            </p>
            <button
              onClick={() => dispatch(fetchOrderLabel(order._id))}
              className="btn-secondary px-4 py-2 text-xs"
            >
              Try Again
            </button>
          </div>
        ) : currentOrderLabelHtml ? (
          <div className="flex items-start justify-center p-4" style={{ background: 'var(--base-300)', minHeight: 400 }}>
            <div className="shadow-2xl rounded-lg overflow-hidden" style={{ width: '100%', maxWidth: 420 }}>
              <iframe
                ref={iframeRef}
                srcDoc={currentOrderLabelHtml}
                className="w-full"
                style={{ height: 580, border: 'none', display: 'block' }}
                title={`Label ${order?.orderId}`}
                sandbox="allow-same-origin allow-modals allow-scripts allow-popups"
              />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Tag size={32} className="opacity-30" style={{ color: 'var(--base-content)' }} />
            <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
              No label loaded
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      {currentOrderLabelHtml && (
        <div className="px-4 py-2.5 border-t flex items-center justify-between" style={{ borderColor: 'var(--base-300)', background: 'var(--base-200)' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--success)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--success)' }}>Label Ready</p>
          </div>
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            {order?.delivery?.address?.city}, {order?.delivery?.address?.pincode}
          </p>
          <p className="text-xs font-semibold" style={{ color: order?.payment?.method === 'COD' ? 'var(--warning)' : 'var(--success)' }}>
            {order?.payment?.method === 'COD' ? `COD ₹${order?.billing?.totalPayable?.toFixed(2)}` : 'Prepaid'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function DeliveryLabelPage() {
  return <DeliveryLabelComponent order={null} onClose={() => {}} />;
}