'use client';

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Download, Printer, Mail, X,
  Loader2, AlertTriangle, RefreshCw, ExternalLink
} from 'lucide-react';
import {
  fetchOrderInvoice,
  clearOrderDocuments,
  sendStoreInvoice,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

function OrderInvoiceComponent({ order, onClose }) {
  const dispatch = useDispatch();
  const { currentOrderInvoiceHtml, loading, errors } = useSelector((s) => s.pharmacyStore);
  const iframeRef = useRef(null);

  useEffect(() => {
    if (order?._id && !currentOrderInvoiceHtml) {
      dispatch(fetchOrderInvoice(order._id));
    }
  }, [order?._id, dispatch, currentOrderInvoiceHtml]);

  useEffect(() => {
    return () => { dispatch(clearOrderDocuments()); };
  }, [dispatch]);

  const handlePrint = () => {
    if (!iframeRef.current) return;
    iframeRef.current.contentWindow?.print();
  };

  const handleDownload = () => {
    if (!currentOrderInvoiceHtml) return;
    const blob = new Blob([currentOrderInvoiceHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice-${order?.orderId ?? 'order'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenNew = () => {
    if (!currentOrderInvoiceHtml) return;
    const blob = new Blob([currentOrderInvoiceHtml], { type: 'text/html' });
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
          <FileText size={16} style={{ color: 'var(--primary)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>
            Invoice #{order?.orderId}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Reload */}
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => { dispatch(clearOrderDocuments()); dispatch(fetchOrderInvoice(order._id)); }}
            className="p-2 rounded-lg"
            style={{ background: 'var(--base-300)', color: 'var(--base-content)' }}
            title="Reload"
          >
            <RefreshCw size={13} />
          </motion.button>
          {/* Open in new tab */}
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={handleOpenNew}
            disabled={!currentOrderInvoiceHtml}
            className="p-2 rounded-lg disabled:opacity-40"
            style={{ background: 'var(--base-300)', color: 'var(--base-content)' }}
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </motion.button>
          {/* Download */}
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={handleDownload}
            disabled={!currentOrderInvoiceHtml}
            className="p-2 rounded-lg disabled:opacity-40"
            style={{ background: 'color-mix(in srgb, var(--accent), transparent 85%)', color: 'var(--accent)' }}
            title="Download HTML"
          >
            <Download size={13} />
          </motion.button>
          {/* Print */}
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={handlePrint}
            disabled={!currentOrderInvoiceHtml}
            className="p-2 rounded-lg disabled:opacity-40 flex items-center gap-1.5 text-xs font-bold px-3"
            style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
            title="Print"
          >
            <Printer size={13} /> Print
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

      {/* Content */}
      <div className="flex-1 relative" style={{ minHeight: 400 }}>
        {loading.orderInvoice ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="spinner w-8 h-8" />
            <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>Loading invoice…</p>
          </div>
        ) : errors.orderInvoice ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
            <AlertTriangle size={32} style={{ color: 'var(--error)' }} />
            <p className="text-sm font-semibold text-center" style={{ color: 'var(--base-content)' }}>
              {errors.orderInvoice.message}
            </p>
            <button
              onClick={() => dispatch(fetchOrderInvoice(order._id))}
              className="btn-secondary px-4 py-2 text-xs"
            >
              Try Again
            </button>
          </div>
        ) : currentOrderInvoiceHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={currentOrderInvoiceHtml}
            className="w-full h-full"
            style={{ minHeight: 480, border: 'none' }}
            title={`Invoice ${order?.orderId}`}
            sandbox="allow-same-origin allow-modals allow-scripts allow-popups"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <FileText size={32} className="opacity-30" style={{ color: 'var(--base-content)' }} />
            <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
              No invoice loaded
            </p>
          </div>
        )}
      </div>

      {/* Footer info */}
      {currentOrderInvoiceHtml && (
        <div className="px-4 py-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--base-300)', background: 'var(--base-200)' }}>
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            Generated: {new Date().toLocaleString('en-IN')}
          </p>
          <p className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
            ₹{order?.billing?.totalPayable?.toFixed(2)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function OrderInvoicePage() {
  return <OrderInvoiceComponent order={null} onClose={() => {}} />;
}