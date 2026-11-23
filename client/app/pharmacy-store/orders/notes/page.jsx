'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  StickyNote, Plus, Send, AlertTriangle, User,
  Clock, CheckCircle, ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { addOrderNote, clearSuccess, clearError } from '@/store/slices/pharmacy/pharmacyStoreSlice';

function AdminNotesComponent({ order, onSuccess }) {
  const dispatch = useDispatch();
  const { loading, errors, success } = useSelector((s) => s.pharmacyStore);

  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(true);
  const textareaRef = useRef(null);
  const endRef = useRef(null);

  const notes = order?.adminNotes ?? [];

  useEffect(() => {
    if (success.orderNote) {
      dispatch(clearSuccess('orderNote'));
      setNote('');
      onSuccess?.();
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [success.orderNote, dispatch, onSuccess]);

  useEffect(() => () => { dispatch(clearError('orderNote')); }, [dispatch]);

  const handleSubmit = () => {
    const trimmed = note.trim();
    if (!trimmed) return;
    dispatch(addOrderNote({ orderId: order._id, note: trimmed }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatDate = (d) =>
    d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div data-theme="pharmacy" className="space-y-4 p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote size={16} style={{ color: 'var(--primary)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--base-content)' }}>Admin Notes</p>
          {notes.length > 0 && (
            <span className="badge badge-primary text-xs">{notes.length}</span>
          )}
        </div>
        {notes.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg"
            style={{ background: 'var(--base-200)', color: 'var(--base-content)' }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Notes list */}
      <AnimatePresence>
        {(expanded || notes.length === 0) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {notes.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed p-8 text-center" style={{ borderColor: 'var(--base-300)' }}>
                <StickyNote size={28} className="mx-auto mb-2 opacity-25" style={{ color: 'var(--base-content)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>No notes yet</p>
                <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                  Add internal notes about this order
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {notes.map((n, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="rounded-xl p-3.5 border-l-4"
                    style={{
                      background: 'var(--base-200)',
                      borderLeftColor: i % 3 === 0 ? 'var(--primary)' : i % 3 === 1 ? 'var(--accent)' : 'var(--secondary)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'color-mix(in srgb, var(--primary), transparent 80%)' }}>
                          <User size={11} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--base-content)' }}>
                            {n.addedBy?.name ?? `Staff #${String(n.addedBy).slice(-4) || i + 1}`}
                          </p>
                          <p className="text-xs flex items-center gap-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                            <Clock size={9} /> {formatDate(n.addedAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--base-content)' }}>{n.text}</p>
                  </motion.div>
                ))}
                <div ref={endRef} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add note */}
      <div className="space-y-2">
        <div className="relative">
          <textarea
            ref={textareaRef}
            className="input-field w-full text-sm resize-none pb-10"
            rows={3}
            placeholder="Add an internal note… (Ctrl+Enter to send)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={2000}
          />
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <span className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
              {note.length}/2000
            </span>
            <motion.button
              whileHover={{ scale: note.trim() ? 1.1 : 1 }} whileTap={{ scale: note.trim() ? 0.9 : 1 }}
              disabled={!note.trim() || loading.orderNote}
              onClick={handleSubmit}
              className="p-2 rounded-lg flex items-center gap-1.5 text-xs font-bold disabled:opacity-40 transition-all"
              style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
            >
              {loading.orderNote ? (
                <div className="spinner w-3 h-3" style={{ borderTopColor: 'var(--primary-content)' }} />
              ) : (
                <Send size={13} />
              )}
            </motion.button>
          </div>
        </div>

        <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
          Notes are internal only and not visible to customers. Press Ctrl+Enter to submit quickly.
        </p>
      </div>

      {/* Error */}
      {errors.orderNote && (
        <div className="alert alert-error text-sm">
          <AlertTriangle size={15} />
          <span>{errors.orderNote.message}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminNotesPage() {
  return <AdminNotesComponent order={null} onSuccess={() => {}} />;
}