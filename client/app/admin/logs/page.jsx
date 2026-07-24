"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  FileText, Search, Filter, RefreshCw, Download,
  AlertTriangle, CheckCircle, XCircle, Info, ChevronRight,
  ChevronLeft, Clock, User, Shield, Coins, Bell,
  Lock, Zap, Globe, Key, Database,
  Server, Eye, Trash2, Edit2, Plus, Terminal,
  Activity, BarChart2, AlertCircle, SlidersHorizontal,
  CalendarDays, ArrowUpDown, Layers, MoreVertical,
  CheckSquare, Hash, Cpu, Wifi, Users,
} from "lucide-react";
import Link from "next/link";
import {
  // Thunks
  fetchSystemLogs,
  fetchSystemLogsAnalytics,
  exportSystemLogs,
  fetchSystemLogById,
  fetchSystemLogsByUser,
  createSystemLog,
  updateSystemLog,
  deleteSystemLog,
  bulkDeleteSystemLogs,
  fetchAllUsers,
  // Actions
  setLogFilters,
  setLogPage,
  clearSelectedLog,
  clearLogExport,
  clearUserLogs,
  // Selectors — data
  selectSystemLogs,
  selectSystemLogsPagination,
  selectSystemLogsFilters,
  selectSelectedLog,
  selectSystemLogsAnalytics,
  selectExportedLogs,
  selectUserLogs,
  selectUserLogsUser,
  selectUserLogsPagination,
  selectAllUsers,
  selectUsersPagination,
  // Selectors — loading
  selectLogsListLoading,
  selectLogDetailLoading,
  selectLogCreateLoading,
  selectLogUpdateLoading,
  selectLogDeleteLoading,
  selectLogBulkDeleteLoading,
  selectLogAnalyticsLoading,
  selectLogExportLoading,
  selectLogsByUserLoading,
  selectListLoading,
  // Selectors — errors
  selectLogsListError,
  selectLogDetailError,
  selectLogCreateError,
  selectLogAnalyticsError,
  selectLogExportError,
  selectLogsByUserError,
} from "@/store/slices/adminUserSlice";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const LOG_LEVELS = {
  info:    { color: "var(--info,#3b82f6)",    label: "INFO",    icon: Info,          bg: "rgba(59,130,246,0.12)"  },
  success: { color: "var(--success,#22c55e)", label: "SUCCESS", icon: CheckCircle,   bg: "rgba(34,197,94,0.12)"  },
  warning: { color: "var(--warning,#f59e0b)", label: "WARNING", icon: AlertTriangle, bg: "rgba(245,158,11,0.12)" },
  error:   { color: "var(--error,#ef4444)",   label: "ERROR",   icon: XCircle,       bg: "rgba(239,68,68,0.12)"  },
  debug:   { color: "var(--neutral,#6b7280)", label: "DEBUG",   icon: Eye,           bg: "rgba(107,114,128,0.12)"},
};

const CATEGORIES = {
  auth:         { label: "Auth",         icon: Lock,    color: "var(--chart-1,#6366f1)" },
  user:         { label: "User",         icon: User,    color: "var(--chart-2,#8b5cf6)" },
  security:     { label: "Security",     icon: Shield,  color: "var(--chart-3,#ec4899)" },
  payment:      { label: "Payment",      icon: Coins,   color: "var(--warning,#f59e0b)" },
  notification: { label: "Notification", icon: Bell,    color: "var(--chart-5,#06b6d4)" },
  kyc:          { label: "KYC",          icon: Key,     color: "var(--chart-4,#10b981)" },
  system:       { label: "System",       icon: Server,  color: "var(--neutral,#6b7280)" },
  api:          { label: "API",          icon: Globe,   color: "var(--chart-6,#f97316)" },
};

const VALID_LEVELS    = ["info", "success", "warning", "error", "debug"];
const VALID_CATS      = ["auth", "user", "security", "payment", "notification", "kyc", "system", "api"];
const VALID_METHODS   = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const VALID_ACTOR_ROLES = [
  "superadmin", "admin", "doctor", "transportpartner", "driver",
  "lab partner", "customer", "pharmacy", "care assistant", "finance",
  "system", "anonymous",
];

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function fmtShort(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ─────────────────────────────────────────────────────────────────────────────
// CHART TOOLTIP
// ─────────────────────────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-base-100 border border-base-300 rounded-[10px] py-[10px] px-[14px] text-[12px]">
      <p className="font-bold mb-[4px]">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL BADGE
// ─────────────────────────────────────────────────────────────────────────────

function LevelBadge({ level, size = "sm" }) {
  const cfg = LOG_LEVELS[level] || LOG_LEVELS.info;
  const LIcon = cfg.icon;
  const pad = size === "lg" ? "6px 14px" : "3px 8px";
  const fs  = size === "lg" ? 12 : 10;
  return (
    <span className="inline-flex items-center gap-[4px] rounded-[6px] font-extrabold tracking-[0.07em] uppercase" style={{ padding: pad, fontSize: fs, background: cfg.bg, color: cfg.color }}>
      <LIcon size={size === "lg" ? 12 : 10} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY BADGE
// ─────────────────────────────────────────────────────────────────────────────

function CatBadge({ category }) {
  const cfg = CATEGORIES[category] || CATEGORIES.system;
  const CIcon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-[4px] py-[3px] px-[8px] rounded-[6px] text-[10px] font-bold tracking-[0.05em]" style={{ background: `color-mix(in srgb, ${cfg.color}, transparent 88%)`, color: cfg.color, border: `1px solid color-mix(in srgb, ${cfg.color}, transparent 68%)` }}>
      <CIcon size={9} />{cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOG ROW
// ─────────────────────────────────────────────────────────────────────────────

function LogRow({ log, index, onClick, selected, onSelect, selectionMode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(index * 0.018, 0.36) }}
      onClick={() => !selectionMode && onClick(log)}
      className="group flex items-start gap-[12px] py-[13px] px-[20px] border-b border-base-300"
      style={{ cursor: selectionMode ? "default" : "pointer", background: selected ? "color-mix(in srgb, var(--primary,#6366f1), transparent 92%)" : "transparent", transition: "background 0.15s" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--base-200,#f3f4f6)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Checkbox (selection mode) */}
      {selectionMode && (
        <input type="checkbox" checked={selected}
          onChange={() => onSelect(log._id || log.id)}
          className="mt-[4px] cursor-pointer" style={{ accentColor: "var(--primary,#6366f1)" }}
          onClick={e => e.stopPropagation()}
        />
      )}

      {/* Level icon dot */}
      <div className="w-[28px] h-[28px] rounded-[8px] shrink-0 mt-[2px] flex items-center justify-center" style={{ background: LOG_LEVELS[log.level]?.bg || "rgba(107,114,128,0.12)" }}>
        {(() => { const I = LOG_LEVELS[log.level]?.icon || Info; return <I size={13} style={{ color: LOG_LEVELS[log.level]?.color }} />; })()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[6px] flex-wrap">
          <LevelBadge level={log.level} />
          <CatBadge category={log.category} />
          <span className="text-[10px] font-mono opacity-30">
            {log.logCode || log.id}
          </span>
        </div>

        <p className="text-[13px] font-semibold mt-[3px] overflow-hidden text-ellipsis whitespace-nowrap text-base-content">
          {log.message}
        </p>

        <div className="flex items-center gap-[12px] mt-[3px] flex-wrap">
          {(log.actor?.name || log.actor) && (
            <span className="text-[11px] opacity-45 flex items-center gap-[4px]">
              <User size={10} />
              {typeof log.actor === "string" ? log.actor : log.actor?.name}
              {log.actor?.role && ` · ${log.actor.role}`}
            </span>
          )}
          {(log.actor?.ip || log.ip) && (
            <span className="text-[11px] opacity-30 font-mono">
              {log.actor?.ip || log.ip}
            </span>
          )}
          {(log.request?.durationMs || log.duration) && (
            <span className="text-[11px] opacity-30">
              {log.request?.durationMs ? `${log.request.durationMs}ms` : log.duration}
            </span>
          )}
          {log.request?.statusCode && (
            <span className="text-[10px] font-mono font-bold" style={{ color: log.request.statusCode >= 500 ? "var(--error,#ef4444)"
                   : log.request.statusCode >= 400 ? "var(--warning,#f59e0b)"
                   : "var(--success,#22c55e)" }}>
              {log.request.method} {log.request.statusCode}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-right shrink-0">
        <p className="text-[11px] opacity-40 font-mono">
          {fmtShort(log.createdAt || log.timestamp)}
        </p>
        <p className="text-[10px] opacity-25">
          {fmtDate(log.createdAt || log.timestamp)}
        </p>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOG DETAIL DRAWER
// ─────────────────────────────────────────────────────────────────────────────

function LogDetailDrawer({ log, onClose, onDelete, onUpdate, deleteLoading, updateLoading, isSuperadmin }) {
  const [editMode, setEditMode] = useState(false);
  const [editDetails, setEditDetails] = useState("");
  const [editMeta, setEditMeta]       = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (log) {
      setEditDetails(log.details || "");
      setEditMeta(log.metadata ? JSON.stringify(log.metadata, null, 2) : "");
      setEditMode(false);
      setConfirmDelete(false);
    }
  }, [log]);

  if (!log) return null;

  const handleUpdate = () => {
    let metadata = null;
    if (editMeta.trim()) {
      try { metadata = JSON.parse(editMeta); }
      catch { alert("metadata must be valid JSON"); return; }
    }
    onUpdate({ logId: log._id || log.logCode, updates: { details: editDetails || null, metadata } });
    setEditMode(false);
  };

  const rows = [
    { label: "Log Code",    value: log.logCode,            mono: true  },
    { label: "Level",       value: <LevelBadge level={log.level} size="lg" />                   },
    { label: "Category",    value: <CatBadge category={log.category} />                         },
    { label: "Actor",       value: log.actor?.name ? `${log.actor.name} (${log.actor.role})` : "system" },
    { label: "IP",          value: log.actor?.ip || "—",   mono: true  },
    { label: "Platform",    value: log.actor?.platform || "—"          },
    { label: "Method",      value: log.request?.method || "—",  mono: true },
    { label: "Path",        value: log.request?.path || "—",    mono: true },
    { label: "Status",      value: log.request?.statusCode || "—", mono: true },
    { label: "Duration",    value: log.request?.durationMs ? `${log.request.durationMs}ms` : "—", mono: true },
    { label: "Environment", value: log.environment || "—"              },
    { label: "Server ID",   value: log.serverId || "—",    mono: true  },
    { label: "Age",         value: log.ageHuman || "—"                 },
    { label: "Created",     value: fmt(log.createdAt)                  },
    { label: "Expires",     value: fmt(log.expiresAt)                  },
  ].filter(r => r.value && r.value !== "—" || typeof r.value !== "string");

  return (
    <motion.div className="fixed inset-0 z-[50] flex justify-end"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
        onClick={onClose} />

      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        className="relative z-[10] w-full max-w-[440px] h-full flex flex-col bg-base-100 border-l border-base-300"
      >
        {/* Header */}
        <div className="py-[18px] px-[20px] border-b border-base-300 flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <Terminal size={16} className="text-primary" />
            <p className="font-extrabold text-[15px]">Log Detail</p>
          </div>
          <div className="flex gap-[8px]">
            {isSuperadmin && !editMode && (
              <button onClick={() => setEditMode(true)} title="Edit mutable fields"
                className="w-[32px] h-[32px] rounded-[8px] border border-base-300 flex items-center justify-center cursor-pointer bg-[transparent]">
                <Edit2 size={13} />
              </button>
            )}
            {isSuperadmin && (
              <button onClick={() => setConfirmDelete(true)} title="Delete log"
                className="w-[32px] h-[32px] rounded-[8px] border border-base-300 flex items-center justify-center cursor-pointer bg-[transparent] text-error">
                <Trash2 size={13} />
              </button>
            )}
            <button onClick={onClose} className="w-[32px] h-[32px] rounded-[8px] border border-base-300 flex items-center justify-center cursor-pointer bg-[transparent] text-[13px]">✕</button>
          </div>
        </div>

        {/* Confirm delete */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
              className="overflow-hidden bg-[rgba(239,68,68,0.08)] border-b border-[rgba(239,68,68,0.3)] py-[0px] px-[20px]">
              <div className="py-[12px] px-[0px]">
                <p className="text-[13px] font-semibold text-error mb-[8px]">
                  Delete this log entry permanently?
                </p>
                <div className="flex gap-[8px]">
                  <button onClick={() => { onDelete(log._id || log.logCode); setConfirmDelete(false); }}
                    disabled={deleteLoading}
                    className="py-[6px] px-[16px] rounded-[7px] text-[12px] font-bold bg-error text-[white] border-none cursor-pointer" style={{ opacity: deleteLoading ? 0.6 : 1 }}>
                    {deleteLoading ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="py-[6px] px-[16px] rounded-[7px] text-[12px] font-bold bg-base-200 border-none cursor-pointer">Cancel</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-[20px]">
          {/* Message */}
          <div className="py-[14px] px-[16px] rounded-[12px] mb-[16px] bg-base-200 border border-base-300">
            <p className="text-[13px] font-semibold">{log.message}</p>
          </div>

          {/* Details (editable) */}
          {editMode ? (
            <div className="mb-[16px]">
              <label className="text-[11px] font-bold opacity-50 uppercase tracking-[0.07em]">
                Details
              </label>
              <textarea value={editDetails} onChange={e => setEditDetails(e.target.value)}
                rows={4} placeholder="Verbose description or stack trace…"
                className="w-full mt-[6px] py-[10px] px-[12px] rounded-[9px] border border-base-300 text-[12px] font-mono resize-y bg-base-100 box-border" />
              <label className="text-[11px] font-bold opacity-50 uppercase tracking-[0.07em] block mt-[12px]">
                Metadata (JSON)
              </label>
              <textarea value={editMeta} onChange={e => setEditMeta(e.target.value)}
                rows={5} placeholder='{"key": "value"}'
                className="w-full mt-[6px] py-[10px] px-[12px] rounded-[9px] border border-base-300 text-[12px] font-mono resize-y bg-base-100 box-border" />
              <div className="flex gap-[8px] mt-[10px]">
                <button onClick={handleUpdate} disabled={updateLoading}
                  className="py-[7px] px-[18px] rounded-[8px] text-[12px] font-bold bg-primary text-[white] border-none cursor-pointer" style={{ opacity: updateLoading ? 0.6 : 1 }}>
                  {updateLoading ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => setEditMode(false)} className="py-[7px] px-[18px] rounded-[8px] text-[12px] font-bold bg-base-200 border-none cursor-pointer">Cancel</button>
              </div>
            </div>
          ) : log.details ? (
            <div className="mb-[16px]">
              <p className="text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[6px]">Details</p>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-words py-[12px] px-[14px] rounded-[9px] bg-base-200 border border-base-300 leading-[1.6]">{log.details}</pre>
            </div>
          ) : null}

          {/* Related entity */}
          {log.relatedEntity?.model && (
            <div className="mb-[16px]">
              <p className="text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[6px]">Related Entity</p>
              <div className="flex items-center gap-[8px] py-[10px] px-[14px] rounded-[9px] bg-base-200 border border-base-300">
                <Database size={14} className="opacity-50" />
                <span className="text-[12px] font-semibold">{log.relatedEntity.model}</span>
                {log.relatedEntity.label && <span className="text-[12px] opacity-60">· {log.relatedEntity.label}</span>}
                <span className="text-[11px] font-mono opacity-35 ml-[auto]">
                  {String(log.relatedEntity.entityId).slice(-8)}
                </span>
              </div>
            </div>
          )}

          {/* Metadata */}
          {!editMode && log.metadata && (
            <div className="mb-[16px]">
              <p className="text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[6px]">Metadata</p>
              <pre className="text-[11px] font-mono whitespace-pre-wrap break-words py-[12px] px-[14px] rounded-[9px] bg-base-200 border border-base-300 leading-[1.6]">{JSON.stringify(log.metadata, null, 2)}</pre>
            </div>
          )}

          {/* Key-value rows */}
          <div className="flex flex-col gap-[10px]">
            {rows.map(row => (
              <div key={row.label} className="flex items-start gap-[10px] justify-between">
                <span className="text-[11px] font-bold opacity-38 uppercase tracking-[0.07em] shrink-0 w-[90px]">
                  {row.label}
                </span>
                {typeof row.value === "string" || typeof row.value === "number" ? (
                  <span className="text-[12px] text-right flex-1" style={{ fontFamily: row.mono ? "monospace" : "inherit", fontWeight: row.mono ? 400 : 600, wordBreak: "break-all" }}>{row.value}</span>
                ) : (
                  <div className="text-right">{row.value}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE LOG MODAL
// ─────────────────────────────────────────────────────────────────────────────

function CreateLogModal({ onClose, onSubmit, loading, error }) {
  const [form, setForm] = useState({
    level: "info", category: "system", message: "",
    details: "", relatedEntity: { model: "", entityId: "" }, metadata: "",
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.message.trim()) return;
    let metadata = null;
    if (form.metadata.trim()) {
      try { metadata = JSON.parse(form.metadata); }
      catch { alert("metadata must be valid JSON"); return; }
    }
    const payload = {
      level: form.level, category: form.category,
      message: form.message.trim(),
      ...(form.details.trim() && { details: form.details.trim() }),
      ...(form.relatedEntity.model && form.relatedEntity.entityId && { relatedEntity: form.relatedEntity }),
      ...(metadata && { metadata }),
    };
    onSubmit(payload);
  };

  const fieldStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 9, boxSizing: "border-box",
    border: "1px solid var(--base-300,#e5e7eb)", fontSize: 13,
    background: "var(--base-100,#fff)", outline: "none",
  };
  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: 700,
    opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5,
  };

  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[4px]"
        onClick={onClose} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative z-[10] w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-base-100 rounded-[16px] p-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between mb-[20px]">
          <div className="flex items-center gap-[10px]">
            <Plus size={16} className="text-primary" />
            <p className="font-extrabold text-[16px]">Create System Log</p>
          </div>
          <button onClick={onClose} className="border-none bg-transparent cursor-pointer text-[18px] opacity-50">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
          <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
            <div>
              <label style={labelStyle}>Level *</label>
              <select value={form.level} onChange={e => set("level", e.target.value)} style={fieldStyle}>
                {VALID_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category *</label>
              <select value={form.category} onChange={e => set("category", e.target.value)} style={fieldStyle}>
                {VALID_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Message * <span className="opacity-40">(max 500 chars)</span></label>
            <input value={form.message} onChange={e => set("message", e.target.value)}
              maxLength={500} placeholder="Short human-readable summary…" required style={fieldStyle} />
          </div>

          <div>
            <label style={labelStyle}>Details <span className="opacity-40">(optional — verbose / stack trace)</span></label>
            <textarea value={form.details} onChange={e => set("details", e.target.value)}
              rows={3} placeholder="Full description, stack trace…"
              className="resize-y font-mono text-[12px]" style={{ ...fieldStyle }} />
          </div>

          <div className="grid grid-cols-[1fr_1fr] gap-[12px]">
            <div>
              <label style={labelStyle}>Related Model</label>
              <select value={form.relatedEntity.model}
                onChange={e => setForm(p => ({ ...p, relatedEntity: { ...p.relatedEntity, model: e.target.value } }))}
                style={fieldStyle}>
                <option value="">None</option>
                {["User","Hospital","PharmacyStore","PharmacyOrder","TransportPartner",
                  "DoctorProfile","PharmacyProfile","CareAssistantProfile","Notification"].map(m =>
                  <option key={m} value={m}>{m}</option>
                )}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Entity ID</label>
              <input value={form.relatedEntity.entityId}
                onChange={e => setForm(p => ({ ...p, relatedEntity: { ...p.relatedEntity, entityId: e.target.value } }))}
                placeholder="MongoDB ObjectId" className="font-mono text-[12px]" style={{ ...fieldStyle }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Metadata <span className="opacity-40">(optional — valid JSON)</span></label>
            <textarea value={form.metadata} onChange={e => set("metadata", e.target.value)}
              rows={3} placeholder='{"key": "value"}'
              className="resize-y font-mono text-[12px]" style={{ ...fieldStyle }} />
          </div>

          {error && (
            <p className="text-[12px] text-error font-semibold">{error}</p>
          )}

          <button type="submit" disabled={loading || !form.message.trim()} className="py-[11px] px-[0px] rounded-[10px] text-[13px] font-extrabold bg-primary text-[white] border-none" style={{ cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Creating…" : "Create Log Entry"}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BULK DELETE MODAL
// ─────────────────────────────────────────────────────────────────────────────

function BulkDeleteModal({ selectedIds, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({ level: "", category: "", before: "", confirm: false });

  const handleSubmit = e => {
    e.preventDefault();
    if (!form.confirm) return;
    const payload = { confirm: true };
    if (form.level)    payload.level    = form.level;
    if (form.category) payload.category = form.category;
    if (form.before)   payload.before   = form.before;
    onSubmit(payload);
  };

  return (
    <motion.div className="fixed inset-0 z-[70] flex items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[4px]"
        onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative z-[10] w-full max-w-[440px] bg-base-100 rounded-[16px] p-[28px] shadow-[0_24px_60px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-[10px] mb-[8px]">
          <Trash2 size={18} className="text-error" />
          <p className="font-extrabold text-[16px] text-error">Bulk Delete Logs</p>
        </div>
        <p className="text-[13px] opacity-60 mb-[20px]">
          Requires at least one filter. At least one of <strong>level</strong>, <strong>category</strong>, or <strong>before date</strong> must be set. This action is permanent.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-[12px]">
          <div className="grid grid-cols-[1fr_1fr] gap-[10px]">
            <div>
              <label className="block text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[5px]">Level</label>
              <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
                className="w-full py-[8px] px-[10px] rounded-[8px] border border-base-300 text-[12px] box-border">
                <option value="">Any</option>
                {VALID_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[5px]">Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full py-[8px] px-[10px] rounded-[8px] border border-base-300 text-[12px] box-border">
                <option value="">Any</option>
                {VALID_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[5px]">Delete logs before</label>
            <input type="datetime-local" value={form.before} onChange={e => setForm(p => ({ ...p, before: e.target.value }))}
              className="w-full py-[8px] px-[10px] rounded-[8px] border border-base-300 text-[12px] box-border" />
          </div>

          <label className="flex items-center gap-[8px] text-[13px] font-semibold cursor-pointer">
            <input type="checkbox" checked={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.checked }))}
              style={{ accentColor: "var(--error,#ef4444)" }} />
            I confirm this bulk deletion is permanent
          </label>

          <div className="flex gap-[10px]">
            <button type="submit"
              disabled={loading || !form.confirm || (!form.level && !form.category && !form.before)}
              className="flex-1 py-[10px] px-[0px] rounded-[9px] font-extrabold text-[13px] bg-error text-[white] border-none cursor-pointer" style={{ opacity: (loading || !form.confirm || (!form.level && !form.category && !form.before)) ? 0.4 : 1 }}>
              {loading ? "Deleting…" : "Delete Logs"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-[10px] px-[0px] rounded-[9px] font-bold text-[13px] bg-base-200 border-none cursor-pointer">Cancel</button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS PANEL
// ─────────────────────────────────────────────────────────────────────────────

function AnalyticsPanel({ data, loading }) {
  if (loading) return (
    <div className="p-[40px] text-center opacity-40">
      <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
      <p className="text-[13px]">Loading analytics…</p>
    </div>
  );
  if (!data) return null;

  const { summary = {}, byLevel = {}, byCategory = {}, byActorRole = {},
          hourlyTrend = [], dailyTrend = [], topIps = [], topPaths = [],
          topErrors = [], statusCodeBreakdown = {} } = data;

  const catChartData = Object.entries(byCategory).map(([key, count]) => ({
    name: CATEGORIES[key]?.label || key, count,
    color: CATEGORIES[key]?.color || "var(--neutral,#6b7280)",
  }));

  const StatCard = ({ label, value, color, icon: Icon }) => (
    <div className="py-[16px] px-[18px] rounded-[12px] border border-base-300 bg-base-100 flex items-center gap-[12px]">
      {Icon && <Icon size={18} className="shrink-0" style={{ color: color || "var(--primary,#6366f1)" }} />}
      <div>
        <p className="text-[20px] font-black" style={{ color: color || "var(--base-content,#1f2937)" }}>{value ?? "—"}</p>
        <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em]">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="grid grid-cols-[repeat(auto-fill,_minmax(150px,_1fr))] gap-[12px]">
        <StatCard label="Total Logs"  value={summary.total}        color="var(--primary,#6366f1)" icon={Database} />
        <StatCard label="Errors"      value={summary.errorCount}   color="var(--error,#ef4444)"   icon={XCircle}  />
        <StatCard label="Warnings"    value={summary.warningCount} color="var(--warning,#f59e0b)" icon={AlertTriangle} />
        <StatCard label="Success"     value={summary.successCount} color="var(--success,#22c55e)" icon={CheckCircle}   />
        <StatCard label="Info"        value={summary.infoCount}    color="var(--info,#3b82f6)"    icon={Info}     />
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-[16px]">
        <div className="py-[16px] px-[18px] rounded-[12px] border border-base-300 bg-base-100">
          <p className="text-[12px] font-bold opacity-55 mb-[12px]">Hourly Activity (last 24h)</p>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={hourlyTrend}>
              <defs>
                <linearGradient id="lgH" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--chart-1,#6366f1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1,#6366f1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300,#e5e7eb)" />
              <XAxis dataKey="_id" tick={{ fontSize: 8, fill: "var(--base-content,#1f2937)", opacity: 0.45 }} tickFormatter={v => v?.slice(11, 16) || v} />
              <YAxis tick={{ fontSize: 9, fill: "var(--base-content,#1f2937)", opacity: 0.45 }} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="count"  stroke="var(--chart-1,#6366f1)" strokeWidth={2} fill="url(#lgH)" name="Events" />
              <Area type="monotone" dataKey="errors" stroke="var(--error,#ef4444)"   strokeWidth={1.5} fill="none" strokeDasharray="4 3" name="Errors" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="py-[16px] px-[18px] rounded-[12px] border border-base-300 bg-base-100">
          <p className="text-[12px] font-bold opacity-55 mb-[12px]">Events by Category</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={catChartData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300,#e5e7eb)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: "var(--base-content,#1f2937)", opacity: 0.45 }} />
              <YAxis tick={{ fontSize: 9, fill: "var(--base-content,#1f2937)", opacity: 0.45 }} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} name="Events">
                {catChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="py-[16px] px-[18px] rounded-[12px] border border-base-300 bg-base-100">
        <p className="text-[12px] font-bold opacity-55 mb-[12px]">Daily Activity (last 30d)</p>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={dailyTrend}>
            <defs>
              <linearGradient id="lgD" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="var(--chart-2,#8b5cf6)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--chart-2,#8b5cf6)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300,#e5e7eb)" />
            <XAxis dataKey="_id" tick={{ fontSize: 8, fill: "var(--base-content,#1f2937)", opacity: 0.45 }} />
            <YAxis tick={{ fontSize: 9, fill: "var(--base-content,#1f2937)", opacity: 0.45 }} />
            <Tooltip content={<ChartTip />} />
            <Area type="monotone" dataKey="count"  stroke="var(--chart-2,#8b5cf6)" strokeWidth={2} fill="url(#lgD)" name="Events" />
            <Area type="monotone" dataKey="errors" stroke="var(--error,#ef4444)"   strokeWidth={1.5} fill="none" strokeDasharray="4 3" name="Errors" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-[14px]">
        <div className="py-[14px] px-[16px] rounded-[12px] border border-base-300 bg-base-100">
          <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">Top IPs</p>
          {topIps.length === 0 ? <p className="text-[12px] opacity-30">No data</p> :
            topIps.map((r, i) => (
              <div key={i} className="flex justify-between items-center mb-[6px]">
                <span className="text-[11px] font-mono opacity-70">{r.ip}</span>
                <span className="text-[11px] font-bold">{r.count}</span>
              </div>
            ))}
        </div>
        <div className="py-[14px] px-[16px] rounded-[12px] border border-base-300 bg-base-100">
          <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">Top API Paths</p>
          {topPaths.length === 0 ? <p className="text-[12px] opacity-30">No data</p> :
            topPaths.map((r, i) => (
              <div key={i} className="flex justify-between items-center mb-[6px]">
                <span className="text-[10px] font-mono opacity-65 overflow-hidden text-ellipsis whitespace-nowrap flex-1 mr-[8px]">{r.path}</span>
                <span className="text-[11px] font-bold shrink-0">{r.count}</span>
              </div>
            ))}
        </div>
        <div className="py-[14px] px-[16px] rounded-[12px] border border-base-300 bg-base-100">
          <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">Top Errors</p>
          {topErrors.length === 0 ? <p className="text-[12px] opacity-30">No data</p> :
            topErrors.map((r, i) => (
              <div key={i} className="flex justify-between items-start gap-[8px] mb-[6px]">
                <span className="text-[11px] opacity-65 flex-1 leading-[1.4]">{r.message}</span>
                <span className="text-[11px] font-bold text-error shrink-0">{r.count}</span>
              </div>
            ))}
        </div>
      </div>

      {Object.keys(statusCodeBreakdown).length > 0 && (
        <div className="py-[14px] px-[16px] rounded-[12px] border border-base-300 bg-base-100">
          <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">Status Code Breakdown</p>
          <div className="flex gap-[8px] flex-wrap">
            {Object.entries(statusCodeBreakdown).map(([code, count]) => (
              <div key={code} className="py-[6px] px-[12px] rounded-[8px] text-[12px] font-bold" style={{ background: Number(code) >= 500 ? "rgba(239,68,68,0.1)" : Number(code) >= 400 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)", color: Number(code) >= 500 ? "var(--error,#ef4444)" : Number(code) >= 400 ? "var(--warning,#f59e0b)" : "var(--success,#22c55e)" }}>
                {code} <span className="font-normal">×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(byActorRole).length > 0 && (
        <div className="py-[14px] px-[16px] rounded-[12px] border border-base-300 bg-base-100">
          <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">By Actor Role</p>
          <div className="flex gap-[8px] flex-wrap">
            {Object.entries(byActorRole).map(([role, count]) => (
              <div key={role} className="py-[6px] px-[12px] rounded-[8px] text-[12px] font-semibold bg-base-200">
                {role} <span className="font-bold">·{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER LOGS TAB — uses fetchAllUsers to search & select a user, then fetches
// logs for that user via fetchSystemLogsByUser
// ─────────────────────────────────────────────────────────────────────────────

function UserLogsTab({ dispatch, isSuperadmin }) {
  // ── Redux state ────────────────────────────────────────────────────────────
  const userLogs     = useSelector(selectUserLogs);
  const userLogsUser = useSelector(selectUserLogsUser);
  const userLogsPag  = useSelector(selectUserLogsPagination);
  const logsLoading  = useSelector(selectLogsByUserLoading);
  const logsError    = useSelector(selectLogsByUserError);

  // users list from fetchAllUsers
  const allUsers      = useSelector(selectAllUsers);
  const usersPag      = useSelector(selectUsersPagination);
  const usersLoading  = useSelector(selectListLoading);

  // ── Local state ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery]   = useState("");
  const [roleFilter, setRoleFilter]     = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // the user chosen from the list
  const [submitted, setSubmitted]       = useState(false);
  const [localFilters, setLocalFilters] = useState({
    level: "", category: "", from: "", to: "", page: 1, limit: 20,
  });
  const [drawerLog, setDrawerLog] = useState(null);

  const searchRef   = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);

  // ── Close dropdown on outside click ────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        searchRef.current && !searchRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Debounced user search via fetchAllUsers ─────────────────────────────────
  const doUserSearch = useCallback((query, role) => {
    dispatch(fetchAllUsers({
      search: query,
      role:   role,
      page:   1,
      limit:  10,
      sortBy: "createdAt",
      sortOrder: "desc",
    }));
  }, [dispatch]);

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setShowDropdown(true);
    // clear previously selected user when typing a new query
    if (selectedUser) {
      setSelectedUser(null);
      setSubmitted(false);
      dispatch(clearUserLogs());
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doUserSearch(val, roleFilter);
    }, 350);
  };

  const handleRoleFilter = (e) => {
    const role = e.target.value;
    setRoleFilter(role);
    if (searchQuery || role) {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doUserSearch(searchQuery, role);
      }, 200);
      setShowDropdown(true);
    }
  };

  // ── Trigger initial search when input is focused ────────────────────────────
  const handleFocus = () => {
    if (!showDropdown) {
      doUserSearch(searchQuery, roleFilter);
      setShowDropdown(true);
    }
  };

  // ── Select a user from the dropdown ────────────────────────────────────────
  const handleSelectUser = (u) => {
    setSelectedUser(u);
    setSearchQuery(u.name + (u.email ? ` — ${u.email}` : ""));
    setShowDropdown(false);
    // Auto-fetch logs for this user immediately
    setSubmitted(true);
    dispatch(clearUserLogs());
    dispatch(fetchSystemLogsByUser({
      userId:  u._id,
      filters: { ...localFilters, page: 1 },
    }));
    setLocalFilters(p => ({ ...p, page: 1 }));
  };

  // ── Re-fetch logs (after filter change) ────────────────────────────────────
  const handleFetchLogs = (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    dispatch(clearUserLogs());
    dispatch(fetchSystemLogsByUser({
      userId:  selectedUser._id,
      filters: { ...localFilters, page: 1 },
    }));
    setLocalFilters(p => ({ ...p, page: 1 }));
  };

  // ── Pagination ──────────────────────────────────────────────────────────────
  const handlePage = (p) => {
    if (!selectedUser) return;
    const updated = { ...localFilters, page: p };
    setLocalFilters(updated);
    dispatch(fetchSystemLogsByUser({ userId: selectedUser._id, filters: updated }));
  };

  const setFlt = (k, v) => setLocalFilters(p => ({ ...p, [k]: v }));

  // ── Clear everything ────────────────────────────────────────────────────────
  const handleClear = () => {
    setSearchQuery("");
    setRoleFilter("");
    setSelectedUser(null);
    setSubmitted(false);
    setShowDropdown(false);
    setLocalFilters({ level: "", category: "", from: "", to: "", page: 1, limit: 20 });
    dispatch(clearUserLogs());
  };

  // ── Role badge colour ───────────────────────────────────────────────────────
  const roleBadgeColor = (role) => {
    const map = {
      superadmin: "#6366f1", admin: "#8b5cf6", doctor: "#10b981",
      customer: "#3b82f6", pharmacy: "#f97316", driver: "#f59e0b",
      transportpartner: "#ec4899", "lab partner": "#06b6d4",
      "care assistant": "#14b8a6", finance: "#64748b",
    };
    return map[role] || "#6b7280";
  };

  return (
    <div>
      {/* ── User Search + Filter panel ──────────────────────────────────────── */}
      <div className="py-[20px] px-[22px] rounded-[14px] mb-[18px] border border-base-300 bg-base-100">
        <p className="text-[12px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[12px]">
          Search & select a user to view their logs
        </p>

        <form onSubmit={handleFetchLogs} className="flex gap-[10px] flex-wrap items-end">

          {/* ── User search input + dropdown ─────────────────────────────────── */}
          <div className="min-w-0 relative" style={{ flex: "1 1 300px" }}>
            <label className="block text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[5px]">
              Search by name, email or phone
            </label>
            <div
              ref={searchRef}
              className="flex items-center gap-[8px] rounded-[9px] py-[8px] px-[12px]" style={{ border: `1px solid ${selectedUser ? "var(--primary,#6366f1)" : "var(--base-300,#e5e7eb)"}`, background: selectedUser ? "color-mix(in srgb, var(--primary,#6366f1), transparent 94%)" : "transparent" }}>
              {usersLoading
                ? <RefreshCw size={13} className="opacity-40 shrink-0 animate-spin" />
                : <Search size={13} className="opacity-40 shrink-0" />
              }
              <input
                value={searchQuery}
                onChange={handleSearchInput}
                onFocus={handleFocus}
                placeholder="Type name, email or phone…"
                autoComplete="off"
                className="border-none outline-none text-[13px] bg-[transparent] flex-1" style={{ color: selectedUser ? "var(--primary,#6366f1)" : "inherit", fontWeight: selectedUser ? 600 : 400 }}
              />
              {(searchQuery || selectedUser) && (
                <button type="button" onClick={handleClear}
                  className="border-none bg-transparent cursor-pointer opacity-40">
                  <XCircle size={13} />
                </button>
              )}
            </div>

            {/* ── Dropdown list ──────────────────────────────────────────────── */}
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-[calc(100% + 6px)] left-[0px] right-[0px] bg-base-100 border border-base-300 rounded-[12px] z-[100] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)] max-h-[320px] overflow-y-auto">
                  {usersLoading && (
                    <div className="py-[16px] px-[18px] flex items-center gap-[10px] opacity-50">
                      <RefreshCw size={13} className="animate-spin" />
                      <span className="text-[13px]">Searching users…</span>
                    </div>
                  )}
                  {!usersLoading && allUsers.length === 0 && (
                    <div className="py-[16px] px-[18px] opacity-40 text-[13px]">
                      No users found
                    </div>
                  )}
                  {!usersLoading && allUsers.map((u) => (
                    <div
                      key={u._id}
                      onClick={() => handleSelectUser(u)}
                      className="flex items-center gap-[12px] py-[11px] px-[16px] cursor-pointer border-b border-base-200" style={{ transition: "background 0.1s", background: selectedUser?._id === u._id ? "color-mix(in srgb, var(--primary,#6366f1), transparent 92%)" : "transparent" }}
                      onMouseEnter={e => { if (selectedUser?._id !== u._id) e.currentTarget.style.background = "var(--base-200,#f3f4f6)"; }}
                      onMouseLeave={e => { if (selectedUser?._id !== u._id) e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Avatar / initials */}
                      <div className="w-[34px] h-[34px] rounded-[10px] shrink-0 flex items-center justify-center text-[12px] font-extrabold" style={{ background: `color-mix(in srgb, ${roleBadgeColor(u.role)}, transparent 82%)`, color: roleBadgeColor(u.role) }}>
                        {u.avatar
                          ? <Image src={u.avatar} alt="" width={34} height={34} className="rounded-[10px] object-cover" />
                          : (u.name?.[0] || "?").toUpperCase()
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-[6px]">
                          <p className="text-[13px] font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                            {u.name}
                          </p>
                          <span className="text-[9px] font-extrabold uppercase tracking-[0.06em] py-[2px] px-[6px] rounded-[5px] shrink-0" style={{ background: `color-mix(in srgb, ${roleBadgeColor(u.role)}, transparent 85%)`, color: roleBadgeColor(u.role) }}>
                            {u.role}
                          </span>
                          {u.isBlocked && (
                            <span className="text-[9px] font-bold py-[2px] px-[6px] rounded-[5px] bg-[rgba(239,68,68,0.1)] text-error shrink-0">
                              BLOCKED
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] opacity-45 overflow-hidden text-ellipsis whitespace-nowrap mt-[1px]">
                          {u.email}
                          {u.phone && ` · ${u.phone}`}
                        </p>
                      </div>

                      {/* ObjectId tail */}
                      <span className="text-[10px] font-mono opacity-30 shrink-0">
                        …{u._id?.slice(-6)}
                      </span>
                    </div>
                  ))}

                  {/* Load more hint */}
                  {!usersLoading && usersPag.total > allUsers.length && (
                    <div className="py-[10px] px-[16px] text-[11px] opacity-40 text-center">
                      {usersPag.total - allUsers.length} more — refine your search
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Role filter for user search ─────────────────────────────────── */}
          <div>
            <label className="block text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[5px]">Role</label>
            <select value={roleFilter} onChange={handleRoleFilter}
              className="py-[8px] px-[10px] rounded-[9px] border border-base-300 text-[12px]">
              <option value="">All Roles</option>
              {["superadmin","admin","doctor","transportpartner","driver","lab partner","customer","pharmacy","care assistant","finance"].map(r =>
                <option key={r} value={r}>{r}</option>
              )}
            </select>
          </div>

          {/* ── Log filters (only useful once a user is selected) ───────────── */}
          <div>
            <label className="block text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[5px]">Log Level</label>
            <select value={localFilters.level} onChange={e => setFlt("level", e.target.value)}
              className="py-[8px] px-[10px] rounded-[9px] border border-base-300 text-[12px]">
              <option value="">All</option>
              {VALID_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[5px]">Category</label>
            <select value={localFilters.category} onChange={e => setFlt("category", e.target.value)}
              className="py-[8px] px-[10px] rounded-[9px] border border-base-300 text-[12px]">
              <option value="">All</option>
              {VALID_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[5px]">From</label>
            <input type="date" value={localFilters.from} onChange={e => setFlt("from", e.target.value)}
              className="py-[8px] px-[10px] rounded-[9px] border border-base-300 text-[12px]" />
          </div>
          <div>
            <label className="block text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[5px]">To</label>
            <input type="date" value={localFilters.to} onChange={e => setFlt("to", e.target.value)}
              className="py-[8px] px-[10px] rounded-[9px] border border-base-300 text-[12px]" />
          </div>

          {/* Apply filters button (only active once user is selected) */}
          <button type="submit" disabled={!selectedUser || logsLoading}
            className="flex items-center gap-[7px] py-[9px] px-[18px] rounded-[10px] text-[13px] font-bold border-none bg-primary text-[white]" style={{ cursor: (!selectedUser || logsLoading) ? "not-allowed" : "pointer", opacity: (!selectedUser || logsLoading) ? 0.5 : 1 }}>
            {logsLoading
              ? <><RefreshCw size={13} className="animate-spin" />Loading…</>
              : <><Search size={13} />Apply Filters</>}
          </button>

          {submitted && (
            <button type="button" onClick={handleClear}
              className="py-[9px] px-[14px] rounded-[10px] text-[13px] font-bold bg-[rgba(239,68,68,0.08)] text-error border border-[rgba(239,68,68,0.2)] cursor-pointer">
              Clear
            </button>
          )}
        </form>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {logsError && (
        <div className="py-[12px] px-[16px] rounded-[10px] mb-[14px] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)] text-error text-[13px] font-semibold">
          {logsError}
        </div>
      )}

      {/* ── Selected user info card ─────────────────────────────────────────── */}
      {(userLogsUser || selectedUser) && submitted && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-[14px] py-[14px] px-[18px] rounded-[12px] mb-[16px] border border-base-300 bg-base-100">
          {/* Avatar */}
          <div className="w-[44px] h-[44px] rounded-[12px] shrink-0 overflow-hidden flex items-center justify-center text-[15px] font-extrabold" style={{ background: `color-mix(in srgb, ${roleBadgeColor((userLogsUser || selectedUser)?.role)}, transparent 82%)`, color: roleBadgeColor((userLogsUser || selectedUser)?.role) }}>
            {(userLogsUser || selectedUser)?.avatar
              ? <Image src={(userLogsUser || selectedUser).avatar} alt="" width={44} height={44} className="object-cover" />
              : ((userLogsUser || selectedUser)?.name?.[0] || "?").toUpperCase()
            }
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[8px] flex-wrap">
              <p className="text-[14px] font-bold">{(userLogsUser || selectedUser)?.name || "—"}</p>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] py-[3px] px-[8px] rounded-[6px]" style={{ background: `color-mix(in srgb, ${roleBadgeColor((userLogsUser || selectedUser)?.role)}, transparent 85%)`, color: roleBadgeColor((userLogsUser || selectedUser)?.role) }}>
                {(userLogsUser || selectedUser)?.role}
              </span>
              {(userLogsUser || selectedUser)?.isBlocked && (
                <span className="text-[10px] font-bold py-[3px] px-[8px] rounded-[6px] bg-[rgba(239,68,68,0.1)] text-error">
                  BLOCKED
                </span>
              )}
            </div>
            <p className="text-[12px] opacity-50 mt-[2px]">
              {(userLogsUser || selectedUser)?.email}
              {(userLogsUser || selectedUser)?.phone && ` · ${(userLogsUser || selectedUser).phone}`}
            </p>
          </div>

          {/* Stats */}
          <div className="text-right shrink-0">
            <p className="text-[13px] font-bold text-primary">
              {userLogsPag.total?.toLocaleString() ?? 0} logs
            </p>
            <p className="text-[10px] opacity-35 font-mono">
              {(userLogsUser || selectedUser)?._id?.slice(-8)}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Logs table ─────────────────────────────────────────────────────── */}
      {submitted && (
        <div className="rounded-[14px] border border-base-300 bg-base-100 overflow-hidden">
          {/* Header */}
          <div className="py-[12px] px-[20px] border-b border-base-300 flex items-center justify-between">
            <div className="flex items-center gap-[8px]">
              <Users size={14} className="text-primary" />
              <p className="text-[13px] font-bold">
                {logsLoading ? "Loading…" : userLogs.length === 0 ? "No logs found" : `${userLogsPag.total?.toLocaleString() ?? userLogs.length} log entries`}
              </p>
              {logsLoading && <RefreshCw size={12} className="animate-spin opacity-40" />}
            </div>
            <p className="text-[12px] opacity-40">
              Page {userLogsPag.page} of {userLogsPag.totalPages || 1}
            </p>
          </div>

          {/* Log rows */}
          <div className="overflow-y-auto max-h-[56vh]">
            <AnimatePresence>
              {!logsLoading && userLogs.length === 0 ? (
                <div className="text-center py-[60px] px-[20px] opacity-30">
                  <FileText size={32} className="mt-[0px] mx-[auto] mb-[12px]" />
                  <p className="text-[13px] font-semibold">No logs found for this user</p>
                </div>
              ) : userLogs.map((log, i) => (
                <LogRow
                  key={log._id || log.logCode || i}
                  log={log}
                  index={i}
                  onClick={setDrawerLog}
                  selected={false}
                  onSelect={() => {}}
                  selectionMode={false}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          {userLogsPag.totalPages > 1 && (
            <div className="py-[14px] px-[20px] border-t border-base-300 flex items-center justify-between">
              <p className="text-[12px] opacity-40">
                {userLogsPag.total > 0
                  ? `Showing ${((userLogsPag.page - 1) * userLogsPag.limit) + 1}–${Math.min(userLogsPag.page * userLogsPag.limit, userLogsPag.total)} of ${userLogsPag.total?.toLocaleString()}`
                  : "No results"}
              </p>
              <div className="flex items-center gap-[8px]">
                <button disabled={userLogsPag.page <= 1} onClick={() => handlePage(userLogsPag.page - 1)}
                  className="w-[32px] h-[32px] rounded-[8px] border border-base-300 flex items-center justify-center bg-[transparent]" style={{ cursor: userLogsPag.page <= 1 ? "not-allowed" : "pointer", opacity: userLogsPag.page <= 1 ? 0.3 : 1 }}>
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[13px] font-semibold opacity-55 py-[0px] px-[8px]">
                  {userLogsPag.page} / {userLogsPag.totalPages}
                </span>
                <button disabled={userLogsPag.page >= userLogsPag.totalPages} onClick={() => handlePage(userLogsPag.page + 1)}
                  className="w-[32px] h-[32px] rounded-[8px] border border-base-300 flex items-center justify-center bg-[transparent]" style={{ cursor: userLogsPag.page >= userLogsPag.totalPages ? "not-allowed" : "pointer", opacity: userLogsPag.page >= userLogsPag.totalPages ? 0.3 : 1 }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state when no user selected yet ──────────────────────────── */}
      {!submitted && !logsLoading && (
        <div className="text-center py-[60px] px-[20px] opacity-30 border-[2px] border-dashed border-base-300 rounded-[14px]">
          <Users size={36} className="mt-[0px] mx-[auto] mb-[12px]" />
          <p className="text-[14px] font-bold">Search and select a user above</p>
          <p className="text-[12px] mt-[4px]">Their system logs will appear here</p>
        </div>
      )}

      {/* ── Detail drawer for user logs ─────────────────────────────────────── */}
      <AnimatePresence>
        {drawerLog && (
          <LogDetailDrawer
            log={drawerLog}
            onClose={() => setDrawerLog(null)}
            onDelete={() => {}}
            onUpdate={() => {}}
            deleteLoading={false}
            updateLoading={false}
            isSuperadmin={isSuperadmin}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SystemLogManagement() {
  const dispatch = useDispatch();

  // Current logged-in admin from Redux
  const user         = useSelector((s) => s.user?.user) ?? null;
  const isSuperadmin = user?.role === "superadmin";

  // Redux state
  const logs             = useSelector(selectSystemLogs);
  const pagination       = useSelector(selectSystemLogsPagination);
  const reduxFilters     = useSelector(selectSystemLogsFilters);
  const selectedLog      = useSelector(selectSelectedLog);
  const analyticsData    = useSelector(selectSystemLogsAnalytics);
  const exportedData     = useSelector(selectExportedLogs);

  const listLoading      = useSelector(selectLogsListLoading);
  const detailLoading    = useSelector(selectLogDetailLoading);
  const createLoading    = useSelector(selectLogCreateLoading);
  const updateLoading    = useSelector(selectLogUpdateLoading);
  const deleteLoading    = useSelector(selectLogDeleteLoading);
  const bulkDelLoading   = useSelector(selectLogBulkDeleteLoading);
  const analyticsLoading = useSelector(selectLogAnalyticsLoading);
  const exportLoading    = useSelector(selectLogExportLoading);

  const listError        = useSelector(selectLogsListError);
  const createError      = useSelector(selectLogCreateError);
  const analyticsError   = useSelector(selectLogAnalyticsError);

  // Local UI state
  const [activeTab, setActiveTab]         = useState("logs");   // "logs" | "user-logs" | "analytics"
  const [showCreateModal, setShowCreate]  = useState(false);
  const [showBulkModal, setShowBulk]      = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [drawerLogId, setDrawerLogId]     = useState(null);
  const [advFilters, setAdvFilters]       = useState(false);

  const [localFilters, setLocalFilters] = useState({
    search: "", level: "", category: "", actorRole: "", ip: "",
    method: "", statusCode: "", environment: "", from: "", to: "",
    sortBy: "createdAt", sortOrder: "desc",
    page: 1, limit: 30,
  });

  useEffect(() => {
    dispatch(fetchSystemLogs({ ...localFilters }));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (activeTab === "analytics") {
      dispatch(fetchSystemLogsAnalytics());
    }
  }, [activeTab, dispatch]);

  const applyFilters = useCallback((overrides = {}) => {
    const merged = { ...localFilters, ...overrides, page: 1 };
    setLocalFilters(merged);
    dispatch(setLogFilters(merged));
    dispatch(fetchSystemLogs(merged));
  }, [localFilters, dispatch]);

  const handlePage = (p) => {
    const merged = { ...localFilters, page: p };
    setLocalFilters(merged);
    dispatch(setLogPage(p));
    dispatch(fetchSystemLogs(merged));
  };

  const handleRefresh = () => {
    dispatch(fetchSystemLogs({ ...localFilters }));
    if (activeTab === "analytics") dispatch(fetchSystemLogsAnalytics());
  };

  const openDrawer = (log) => {
    setDrawerLogId(log._id || log.logCode);
    dispatch(fetchSystemLogById(log._id || log.logCode));
  };

  const closeDrawer = () => {
    setDrawerLogId(null);
    dispatch(clearSelectedLog());
  };

  const handleCreate = async (payload) => {
    const res = await dispatch(createSystemLog(payload));
    if (!res.error) { setShowCreate(false); dispatch(fetchSystemLogs({ ...localFilters })); }
  };

  const handleUpdate = async ({ logId, updates }) => {
    const res = await dispatch(updateSystemLog({ logId, updates }));
    if (!res.error) { dispatch(fetchSystemLogById(logId)); }
  };

  const handleDelete = async (logId) => {
    const res = await dispatch(deleteSystemLog(logId));
    if (!res.error) { closeDrawer(); dispatch(fetchSystemLogs({ ...localFilters })); }
  };

  const handleBulkDelete = async (payload) => {
    const res = await dispatch(bulkDeleteSystemLogs(payload));
    if (!res.error) { setShowBulk(false); setSelectionMode(false); setSelectedIds(new Set()); dispatch(fetchSystemLogs({ ...localFilters })); }
  };

  const handleExport = async () => {
    const { search, level, category, actorRole, ip, method, statusCode, environment, from, to } = localFilters;
    const res = await dispatch(exportSystemLogs({ search, level, category, actorRole, ip, method, statusCode, environment, from, to }));
    if (res.payload) {
      const flat = res.payload;
      const keys = flat[0] ? Object.keys(flat[0]) : [];
      const csv  = [keys.join(","), ...flat.map(row => keys.map(k => JSON.stringify(row[k] ?? "")).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url;
      a.download = `system-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
      dispatch(clearLogExport());
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAll  = () => setSelectedIds(new Set(logs.map(l => l._id || l.logCode)));
  const clearSel   = () => setSelectedIds(new Set());
  const setFlt     = (k, v) => setLocalFilters(p => ({ ...p, [k]: v }));

  // ── Tabs config ──────────────────────────────────────────────────────────
  const TABS = [
    { key: "logs",      label: "All Logs",   icon: FileText  },
    { key: "user-logs", label: "User Logs",  icon: Users     },
    { key: "analytics", label: "Analytics",  icon: BarChart2 },
  ];

  return (
    <div className="min-h-[100vh] p-[24px] bg-base-100">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-[14px] mb-[28px]">
        <div>
          <div className="flex items-center gap-[6px] mb-[4px]">
            <Link href="/admin" className="text-[12px] opacity-45 no-underline">Admin</Link>
            <ChevronRight size={12} className="opacity-30" />
            <span className="text-[12px] font-bold text-primary">System Logs</span>
          </div>
          <h1 className="text-[24px] font-black m-[0px] tracking-[-0.02em]">System Logs</h1>
          <p className="text-[13px] opacity-45 mt-[4px] mx-[0px] mb-[0px] font-medium">
            {pagination.total?.toLocaleString() ?? "—"} total entries · Real-time audit trail
          </p>
        </div>

        <div className="flex gap-[10px] flex-wrap">
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-[7px] py-[9px] px-[16px] rounded-[10px] text-[13px] font-bold cursor-pointer bg-primary text-[white] border-none">
            <Plus size={14} />Create Log
          </button>

          {isSuperadmin && (
            <button onClick={() => setShowBulk(true)}
              className="flex items-center gap-[7px] py-[9px] px-[16px] rounded-[10px] text-[13px] font-bold cursor-pointer bg-[rgba(239,68,68,0.1)] text-error border border-[rgba(239,68,68,0.25)]">
              <Trash2 size={14} />Bulk Delete
            </button>
          )}

          <button onClick={handleExport} disabled={exportLoading}
            className="flex items-center gap-[7px] py-[9px] px-[16px] rounded-[10px] text-[13px] font-bold bg-base-200 border border-base-300" style={{ cursor: exportLoading ? "not-allowed" : "pointer", opacity: exportLoading ? 0.6 : 1 }}>
            {exportLoading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {exportLoading ? "Exporting…" : "Export CSV"}
          </button>

          <button onClick={handleRefresh}
            className="w-[38px] h-[38px] rounded-[10px] border border-base-300 flex items-center justify-center cursor-pointer bg-base-100">
            <RefreshCw size={15} className={`opacity-50 ${listLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </motion.div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className="flex gap-[4px] mb-[24px] bg-base-200 rounded-[12px] p-[4px] w-[fit-content]">
        {TABS.map(tab => {
          const TIcon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-[7px] py-[8px] px-[18px] rounded-[9px] text-[13px] font-bold cursor-pointer border-none" style={{ background: active ? "var(--base-100,#fff)" : "transparent", color: active ? "var(--primary,#6366f1)" : "var(--base-content,#1f2937)", boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              <TIcon size={14} />{tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ALL LOGS TAB                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "logs" && (
          <motion.div key="logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

            {/* Level pills */}
            <div className="flex gap-[10px] flex-wrap mb-[18px]">
              {Object.entries(LOG_LEVELS).map(([lvl, cfg]) => {
                const LIcon = cfg.icon;
                const active = localFilters.level === lvl;
                return (
                  <button key={lvl} onClick={() => {
                    const next = active ? "" : lvl;
                    setFlt("level", next);
                    applyFilters({ level: next });
                  }} className="flex items-center gap-[7px] py-[7px] px-[14px] rounded-[9px] text-[12px] font-bold cursor-pointer" style={{ border: active ? `1.5px solid ${cfg.color}` : "1px solid var(--base-300,#e5e7eb)", background: active ? `color-mix(in srgb, ${cfg.color}, transparent 88%)` : "var(--base-100,#fff)", color: active ? cfg.color : "var(--base-content,#1f2937)", transition: "all 0.12s" }}>
                    <LIcon size={13} style={{ color: cfg.color }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Filter bar */}
            <div className="py-[16px] px-[20px] rounded-[14px] mb-[16px] border border-base-300 bg-base-100 flex flex-wrap gap-[10px] items-center">
              <div className="flex items-center gap-[8px] min-w-0 border border-base-300 rounded-[9px] py-[7px] px-[12px]" style={{ flex: "1 1 220px" }}>
                <Search size={13} className="opacity-40 shrink-0" />
                <input value={localFilters.search}
                  onChange={e => setFlt("search", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applyFilters()}
                  placeholder="Search message, logCode, details…"
                  className="border-none outline-none text-[13px] bg-[transparent] flex-1" />
                {localFilters.search && (
                  <button onClick={() => { setFlt("search", ""); applyFilters({ search: "" }); }}
                    className="border-none bg-transparent cursor-pointer opacity-40">
                    <XCircle size={13} />
                  </button>
                )}
              </div>

              <select value={localFilters.category}
                onChange={e => { setFlt("category", e.target.value); applyFilters({ category: e.target.value }); }}
                className="py-[7px] px-[10px] rounded-[9px] border border-base-300 text-[12px] cursor-pointer">
                <option value="">All Categories</option>
                {VALID_CATS.map(c => <option key={c} value={c}>{CATEGORIES[c]?.label || c}</option>)}
              </select>

              <select value={localFilters.sortOrder}
                onChange={e => { setFlt("sortOrder", e.target.value); applyFilters({ sortOrder: e.target.value }); }}
                className="py-[7px] px-[10px] rounded-[9px] border border-base-300 text-[12px] cursor-pointer">
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>

              <button onClick={() => setAdvFilters(p => !p)}
                className="flex items-center gap-[6px] py-[7px] px-[12px] rounded-[9px] border border-base-300 text-[12px] font-semibold cursor-pointer" style={{ background: advFilters ? "var(--base-200,#f3f4f6)" : "var(--base-100,#fff)" }}>
                <SlidersHorizontal size={13} />{advFilters ? "Hide filters" : "More filters"}
              </button>

              {isSuperadmin && (
                <button onClick={() => { setSelectionMode(p => !p); clearSel(); }}
                  className="flex items-center gap-[6px] py-[7px] px-[12px] rounded-[9px] border border-base-300 text-[12px] font-semibold cursor-pointer" style={{ background: selectionMode ? "rgba(239,68,68,0.08)" : "var(--base-100,#fff)", color: selectionMode ? "var(--error,#ef4444)" : "var(--base-content,#1f2937)" }}>
                  <CheckSquare size={13} />{selectionMode ? "Cancel" : "Select"}
                </button>
              )}

              <button onClick={() => applyFilters()}
                className="py-[7px] px-[16px] rounded-[9px] text-[12px] font-bold bg-primary text-[white] border-none cursor-pointer">
                Apply
              </button>
              {(localFilters.search || localFilters.level || localFilters.category || localFilters.actorRole || localFilters.ip || localFilters.method || localFilters.from || localFilters.to) && (
                <button onClick={() => {
                  const reset = { search: "", level: "", category: "", actorRole: "", ip: "", method: "", statusCode: "", environment: "", from: "", to: "", page: 1 };
                  setLocalFilters(p => ({ ...p, ...reset }));
                  applyFilters(reset);
                }} className="py-[7px] px-[12px] rounded-[9px] text-[12px] font-bold bg-[rgba(239,68,68,0.08)] text-error border border-[rgba(239,68,68,0.2)] cursor-pointer">
                  <XCircle size={12} className="inline mr-[4px]" />Clear
                </button>
              )}
            </div>

            {/* Advanced filters */}
            <AnimatePresence>
              {advFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-[14px]">
                  <div className="grid grid-cols-[repeat(auto-fill,_minmax(170px,_1fr))] gap-[10px] py-[16px] px-[20px] rounded-[12px] border border-base-300 bg-base-100">
                    {[
                      { label: "Actor Role", key: "actorRole", type: "select", opts: VALID_ACTOR_ROLES },
                      { label: "HTTP Method", key: "method",   type: "select", opts: VALID_METHODS     },
                      { label: "IP Address",  key: "ip",       type: "text",   placeholder: "103.21.x.x" },
                      { label: "Status Code", key: "statusCode", type: "number", placeholder: "200"    },
                      { label: "Environment", key: "environment", type: "select", opts: ["development","staging","production"] },
                      { label: "From",        key: "from",     type: "datetime-local" },
                      { label: "To",          key: "to",       type: "datetime-local" },
                      { label: "Limit",       key: "limit",    type: "select",  opts: ["20","30","50","100"] },
                    ].map(f => (
                      <div key={f.key}>
                        <label className="block text-[10px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[5px]">
                          {f.label}
                        </label>
                        {f.type === "select" ? (
                          <select value={localFilters[f.key]}
                            onChange={e => setFlt(f.key, e.target.value)}
                            className="w-full py-[7px] px-[9px] rounded-[8px] border border-base-300 text-[12px]">
                            <option value="">Any</option>
                            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={f.type} value={localFilters[f.key]} placeholder={f.placeholder}
                            onChange={e => setFlt(f.key, e.target.value)}
                            className="w-full py-[7px] px-[9px] rounded-[8px] border border-base-300 text-[12px] box-border" />
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Selection toolbar */}
            <AnimatePresence>
              {selectionMode && selectedIds.size > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-[10px] py-[10px] px-[16px] rounded-[10px] mb-[12px] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.2)]">
                  <span className="text-[13px] font-bold text-error">
                    {selectedIds.size} selected
                  </span>
                  <button onClick={selectAll} className="text-[12px] font-semibold border-none bg-transparent cursor-pointer opacity-65">Select all</button>
                  <button onClick={clearSel}  className="text-[12px] font-semibold border-none bg-transparent cursor-pointer opacity-65">Clear</button>
                  <div className="flex-1" />
                  <button onClick={() => setShowBulk(true)}
                    className="py-[6px] px-[14px] rounded-[8px] text-[12px] font-bold bg-error text-[white] border-none cursor-pointer">
                    Bulk Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Logs table */}
            <div className="rounded-[14px] border border-base-300 bg-base-100 overflow-hidden">
              <div className="py-[12px] px-[20px] border-b border-base-300 flex items-center justify-between">
                <div className="flex items-center gap-[8px]">
                  <Terminal size={14} className="text-primary" />
                  <p className="text-[13px] font-bold">
                    {listLoading ? "Loading…" : `${pagination.total?.toLocaleString() ?? 0} logs`}
                  </p>
                  {listLoading && <RefreshCw size={12} className="animate-spin opacity-40" />}
                </div>
                <p className="text-[12px] opacity-40">
                  Page {pagination.page} of {pagination.totalPages}
                </p>
              </div>

              {listError && (
                <div className="py-[14px] px-[20px] text-error text-[13px] font-semibold">
                  {listError}
                </div>
              )}

              <div className="overflow-y-auto max-h-[62vh]">
                <AnimatePresence>
                  {!listLoading && logs.length === 0 ? (
                    <div className="text-center py-[60px] px-[20px] opacity-30">
                      <FileText size={32} className="mt-[0px] mx-[auto] mb-[12px]" />
                      <p className="text-[13px] font-semibold">No logs match your filters</p>
                    </div>
                  ) : logs.map((log, i) => (
                    <LogRow key={log._id || log.logCode || i}
                      log={log} index={i}
                      onClick={openDrawer}
                      selected={selectedIds.has(log._id || log.logCode)}
                      onSelect={toggleSelect}
                      selectionMode={selectionMode}
                    />
                  ))}
                </AnimatePresence>
              </div>

              <div className="py-[14px] px-[20px] border-t border-base-300 flex items-center justify-between">
                <p className="text-[12px] opacity-40">
                  {pagination.total > 0
                    ? `Showing ${((pagination.page - 1) * pagination.limit) + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total?.toLocaleString()}`
                    : "No results"}
                </p>
                <div className="flex items-center gap-[8px]">
                  <button disabled={pagination.page <= 1} onClick={() => handlePage(pagination.page - 1)}
                    className="w-[32px] h-[32px] rounded-[8px] border border-base-300 flex items-center justify-center bg-[transparent]" style={{ cursor: pagination.page <= 1 ? "not-allowed" : "pointer", opacity: pagination.page <= 1 ? 0.3 : 1 }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[13px] font-semibold opacity-55 py-[0px] px-[8px]">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button disabled={pagination.page >= pagination.totalPages} onClick={() => handlePage(pagination.page + 1)}
                    className="w-[32px] h-[32px] rounded-[8px] border border-base-300 flex items-center justify-center bg-[transparent]" style={{ cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer", opacity: pagination.page >= pagination.totalPages ? 0.3 : 1 }}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* USER LOGS TAB                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "user-logs" && (
          <motion.div key="user-logs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <UserLogsTab dispatch={dispatch} isSuperadmin={isSuperadmin} />
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ANALYTICS TAB                                                      */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {activeTab === "analytics" && (
          <motion.div key="analytics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex gap-[10px] items-center flex-wrap py-[12px] px-[16px] rounded-[12px] mb-[20px] border border-base-300 bg-base-100">
              <CalendarDays size={14} className="opacity-45" />
              <label className="text-[12px] font-bold opacity-50">From</label>
              <input type="date" onChange={e => dispatch(fetchSystemLogsAnalytics({ from: e.target.value }))}
                className="py-[6px] px-[10px] rounded-[8px] border border-base-300 text-[12px]" />
              <label className="text-[12px] font-bold opacity-50">To</label>
              <input type="date" onChange={e => dispatch(fetchSystemLogsAnalytics({ to: e.target.value }))}
                className="py-[6px] px-[10px] rounded-[8px] border border-base-300 text-[12px]" />
              <select onChange={e => dispatch(fetchSystemLogsAnalytics({ environment: e.target.value }))}
                className="py-[6px] px-[10px] rounded-[8px] border border-base-300 text-[12px]">
                <option value="">All Environments</option>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <button onClick={() => dispatch(fetchSystemLogsAnalytics())}
                className="flex items-center gap-[6px] py-[6px] px-[14px] rounded-[8px] border-none text-[12px] font-bold cursor-pointer bg-primary text-[white]">
                <RefreshCw size={12} className={analyticsLoading ? "animate-spin" : ""} />Refresh
              </button>
            </div>

            {analyticsError && (
              <p className="text-error text-[13px] font-semibold mb-[16px]">{analyticsError}</p>
            )}
            <AnalyticsPanel data={analyticsData} loading={analyticsLoading} />
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Log Detail Drawer ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerLogId && (
          <LogDetailDrawer
            log={selectedLog}
            onClose={closeDrawer}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            deleteLoading={deleteLoading}
            updateLoading={updateLoading}
            isSuperadmin={isSuperadmin}
          />
        )}
      </AnimatePresence>

      {/* ── Create Log Modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateLogModal
            onClose={() => setShowCreate(false)}
            onSubmit={handleCreate}
            loading={createLoading}
            error={createError}
          />
        )}
      </AnimatePresence>

      {/* ── Bulk Delete Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBulkModal && (
          <BulkDeleteModal
            selectedIds={selectedIds}
            onClose={() => setShowBulk(false)}
            onSubmit={handleBulkDelete}
            loading={bulkDelLoading}
          />
        )}
      </AnimatePresence>
    </div>
  );
}