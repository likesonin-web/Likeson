"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
    <div style={{
      background: "var(--base-100,#fff)",
      border: "1px solid var(--base-300,#e5e7eb)",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
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
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: pad, borderRadius: 6, fontSize: fs,
      fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase",
      background: cfg.bg, color: cfg.color,
    }}>
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
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 8px", borderRadius: 6, fontSize: 10,
      fontWeight: 700, letterSpacing: "0.05em",
      background: `color-mix(in srgb, ${cfg.color}, transparent 88%)`,
      color: cfg.color,
      border: `1px solid color-mix(in srgb, ${cfg.color}, transparent 68%)`,
    }}>
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
      className="group"
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        padding: "13px 20px",
        cursor: selectionMode ? "default" : "pointer",
        borderBottom: "1px solid var(--base-300,#e5e7eb)",
        background: selected ? "color-mix(in srgb, var(--primary,#6366f1), transparent 92%)" : "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--base-200,#f3f4f6)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Checkbox (selection mode) */}
      {selectionMode && (
        <input type="checkbox" checked={selected}
          onChange={() => onSelect(log._id || log.id)}
          style={{ marginTop: 4, cursor: "pointer", accentColor: "var(--primary,#6366f1)" }}
          onClick={e => e.stopPropagation()}
        />
      )}

      {/* Level icon dot */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: LOG_LEVELS[log.level]?.bg || "rgba(107,114,128,0.12)",
      }}>
        {(() => { const I = LOG_LEVELS[log.level]?.icon || Info; return <I size={13} style={{ color: LOG_LEVELS[log.level]?.color }} />; })()}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <LevelBadge level={log.level} />
          <CatBadge category={log.category} />
          <span style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.3 }}>
            {log.logCode || log.id}
          </span>
        </div>

        <p style={{
          fontSize: 13, fontWeight: 600, marginTop: 3,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          color: "var(--base-content,#1f2937)",
        }}>
          {log.message}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 3, flexWrap: "wrap" }}>
          {(log.actor?.name || log.actor) && (
            <span style={{ fontSize: 11, opacity: 0.45, display: "flex", alignItems: "center", gap: 4 }}>
              <User size={10} />
              {typeof log.actor === "string" ? log.actor : log.actor?.name}
              {log.actor?.role && ` · ${log.actor.role}`}
            </span>
          )}
          {(log.actor?.ip || log.ip) && (
            <span style={{ fontSize: 11, opacity: 0.3, fontFamily: "monospace" }}>
              {log.actor?.ip || log.ip}
            </span>
          )}
          {(log.request?.durationMs || log.duration) && (
            <span style={{ fontSize: 11, opacity: 0.3 }}>
              {log.request?.durationMs ? `${log.request.durationMs}ms` : log.duration}
            </span>
          )}
          {log.request?.statusCode && (
            <span style={{
              fontSize: 10, fontFamily: "monospace", fontWeight: 700,
              color: log.request.statusCode >= 500 ? "var(--error,#ef4444)"
                   : log.request.statusCode >= 400 ? "var(--warning,#f59e0b)"
                   : "var(--success,#22c55e)",
            }}>
              {log.request.method} {log.request.statusCode}
            </span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontSize: 11, opacity: 0.4, fontFamily: "monospace" }}>
          {fmtShort(log.createdAt || log.timestamp)}
        </p>
        <p style={{ fontSize: 10, opacity: 0.25 }}>
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
    <motion.div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        onClick={onClose} />

      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        style={{
          position: "relative", zIndex: 10, width: "100%", maxWidth: 440,
          height: "100%", display: "flex", flexDirection: "column",
          background: "var(--base-100,#fff)",
          borderLeft: "1px solid var(--base-300,#e5e7eb)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "18px 20px", borderBottom: "1px solid var(--base-300,#e5e7eb)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Terminal size={16} style={{ color: "var(--primary,#6366f1)" }} />
            <p style={{ fontWeight: 800, fontSize: 15 }}>Log Detail</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isSuperadmin && !editMode && (
              <button onClick={() => setEditMode(true)} title="Edit mutable fields"
                style={{
                  width: 32, height: 32, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", background: "transparent",
                }}>
                <Edit2 size={13} />
              </button>
            )}
            {isSuperadmin && (
              <button onClick={() => setConfirmDelete(true)} title="Delete log"
                style={{
                  width: 32, height: 32, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", background: "transparent", color: "var(--error,#ef4444)",
                }}>
                <Trash2 size={13} />
              </button>
            )}
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", background: "transparent", fontSize: 13,
            }}>✕</button>
          </div>
        </div>

        {/* Confirm delete */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
              style={{
                overflow: "hidden", background: "rgba(239,68,68,0.08)",
                borderBottom: "1px solid rgba(239,68,68,0.3)", padding: "0 20px",
              }}>
              <div style={{ padding: "12px 0" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--error,#ef4444)", marginBottom: 8 }}>
                  Delete this log entry permanently?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { onDelete(log._id || log.logCode); setConfirmDelete(false); }}
                    disabled={deleteLoading}
                    style={{
                      padding: "6px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                      background: "var(--error,#ef4444)", color: "white", border: "none",
                      cursor: "pointer", opacity: deleteLoading ? 0.6 : 1,
                    }}>
                    {deleteLoading ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} style={{
                    padding: "6px 16px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                    background: "var(--base-200,#f3f4f6)", border: "none", cursor: "pointer",
                  }}>Cancel</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* Message */}
          <div style={{
            padding: "14px 16px", borderRadius: 12, marginBottom: 16,
            background: "var(--base-200,#f3f4f6)",
            border: "1px solid var(--base-300,#e5e7eb)",
          }}>
            <p style={{ fontSize: 13, fontWeight: 600 }}>{log.message}</p>
          </div>

          {/* Details (editable) */}
          {editMode ? (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Details
              </label>
              <textarea value={editDetails} onChange={e => setEditDetails(e.target.value)}
                rows={4} placeholder="Verbose description or stack trace…"
                style={{
                  width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 9,
                  border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12,
                  fontFamily: "monospace", resize: "vertical",
                  background: "var(--base-100,#fff)", boxSizing: "border-box",
                }} />
              <label style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginTop: 12 }}>
                Metadata (JSON)
              </label>
              <textarea value={editMeta} onChange={e => setEditMeta(e.target.value)}
                rows={5} placeholder='{"key": "value"}'
                style={{
                  width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 9,
                  border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12,
                  fontFamily: "monospace", resize: "vertical",
                  background: "var(--base-100,#fff)", boxSizing: "border-box",
                }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={handleUpdate} disabled={updateLoading}
                  style={{
                    padding: "7px 18px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: "var(--primary,#6366f1)", color: "white", border: "none",
                    cursor: "pointer", opacity: updateLoading ? 0.6 : 1,
                  }}>
                  {updateLoading ? "Saving…" : "Save Changes"}
                </button>
                <button onClick={() => setEditMode(false)} style={{
                  padding: "7px 18px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                  background: "var(--base-200,#f3f4f6)", border: "none", cursor: "pointer",
                }}>Cancel</button>
              </div>
            </div>
          ) : log.details ? (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Details</p>
              <pre style={{
                fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word",
                padding: "12px 14px", borderRadius: 9, background: "var(--base-200,#f3f4f6)",
                border: "1px solid var(--base-300,#e5e7eb)", lineHeight: 1.6,
              }}>{log.details}</pre>
            </div>
          ) : null}

          {/* Related entity */}
          {log.relatedEntity?.model && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Related Entity</p>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
                borderRadius: 9, background: "var(--base-200,#f3f4f6)",
                border: "1px solid var(--base-300,#e5e7eb)",
              }}>
                <Database size={14} style={{ opacity: 0.5 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>{log.relatedEntity.model}</span>
                {log.relatedEntity.label && <span style={{ fontSize: 12, opacity: 0.6 }}>· {log.relatedEntity.label}</span>}
                <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.35, marginLeft: "auto" }}>
                  {String(log.relatedEntity.entityId).slice(-8)}
                </span>
              </div>
            </div>
          )}

          {/* Metadata */}
          {!editMode && log.metadata && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Metadata</p>
              <pre style={{
                fontSize: 11, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-word",
                padding: "12px 14px", borderRadius: 9, background: "var(--base-200,#f3f4f6)",
                border: "1px solid var(--base-300,#e5e7eb)", lineHeight: 1.6,
              }}>{JSON.stringify(log.metadata, null, 2)}</pre>
            </div>
          )}

          {/* Key-value rows */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map(row => (
              <div key={row.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.38, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0, width: 90 }}>
                  {row.label}
                </span>
                {typeof row.value === "string" || typeof row.value === "number" ? (
                  <span style={{
                    fontSize: 12, textAlign: "right", flex: 1,
                    fontFamily: row.mono ? "monospace" : "inherit",
                    fontWeight: row.mono ? 400 : 600,
                    wordBreak: "break-all",
                  }}>{row.value}</span>
                ) : (
                  <div style={{ textAlign: "right" }}>{row.value}</div>
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
    <motion.div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
        onClick={onClose} />
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        style={{
          position: "relative", zIndex: 10, width: "100%", maxWidth: 520, maxHeight: "90vh",
          overflowY: "auto", background: "var(--base-100,#fff)",
          borderRadius: 16, padding: 28, boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
        }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Plus size={16} style={{ color: "var(--primary,#6366f1)" }} />
            <p style={{ fontWeight: 800, fontSize: 16 }}>Create System Log</p>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, opacity: 0.5 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
            <label style={labelStyle}>Message * <span style={{ opacity: 0.4 }}>(max 500 chars)</span></label>
            <input value={form.message} onChange={e => set("message", e.target.value)}
              maxLength={500} placeholder="Short human-readable summary…" required style={fieldStyle} />
          </div>

          <div>
            <label style={labelStyle}>Details <span style={{ opacity: 0.4 }}>(optional — verbose / stack trace)</span></label>
            <textarea value={form.details} onChange={e => set("details", e.target.value)}
              rows={3} placeholder="Full description, stack trace…"
              style={{ ...fieldStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                placeholder="MongoDB ObjectId" style={{ ...fieldStyle, fontFamily: "monospace", fontSize: 12 }} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Metadata <span style={{ opacity: 0.4 }}>(optional — valid JSON)</span></label>
            <textarea value={form.metadata} onChange={e => set("metadata", e.target.value)}
              rows={3} placeholder='{"key": "value"}'
              style={{ ...fieldStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12 }} />
          </div>

          {error && (
            <p style={{ fontSize: 12, color: "var(--error,#ef4444)", fontWeight: 600 }}>{error}</p>
          )}

          <button type="submit" disabled={loading || !form.message.trim()} style={{
            padding: "11px 0", borderRadius: 10, fontSize: 13, fontWeight: 800,
            background: "var(--primary,#6366f1)", color: "white", border: "none",
            cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1,
          }}>
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
    <motion.div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
        onClick={onClose} />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        style={{
          position: "relative", zIndex: 10, width: "100%", maxWidth: 440,
          background: "var(--base-100,#fff)", borderRadius: 16, padding: 28,
          boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Trash2 size={18} style={{ color: "var(--error,#ef4444)" }} />
          <p style={{ fontWeight: 800, fontSize: 16, color: "var(--error,#ef4444)" }}>Bulk Delete Logs</p>
        </div>
        <p style={{ fontSize: 13, opacity: 0.6, marginBottom: 20 }}>
          Requires at least one filter. At least one of <strong>level</strong>, <strong>category</strong>, or <strong>before date</strong> must be set. This action is permanent.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Level</label>
              <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, boxSizing: "border-box" }}>
                <option value="">Any</option>
                {VALID_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Category</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, boxSizing: "border-box" }}>
                <option value="">Any</option>
                {VALID_CATS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Delete logs before</label>
            <input type="datetime-local" value={form.before} onChange={e => setForm(p => ({ ...p, before: e.target.value }))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, boxSizing: "border-box" }} />
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <input type="checkbox" checked={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.checked }))}
              style={{ accentColor: "var(--error,#ef4444)" }} />
            I confirm this bulk deletion is permanent
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit"
              disabled={loading || !form.confirm || (!form.level && !form.category && !form.before)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 9, fontWeight: 800, fontSize: 13,
                background: "var(--error,#ef4444)", color: "white", border: "none",
                cursor: "pointer", opacity: (loading || !form.confirm || (!form.level && !form.category && !form.before)) ? 0.4 : 1,
              }}>
              {loading ? "Deleting…" : "Delete Logs"}
            </button>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: "10px 0", borderRadius: 9, fontWeight: 700, fontSize: 13,
              background: "var(--base-200,#f3f4f6)", border: "none", cursor: "pointer",
            }}>Cancel</button>
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
    <div style={{ padding: 40, textAlign: "center", opacity: 0.4 }}>
      <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
      <p style={{ fontSize: 13 }}>Loading analytics…</p>
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
    <div style={{
      padding: "16px 18px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)",
      background: "var(--base-100,#fff)", display: "flex", alignItems: "center", gap: 12,
    }}>
      {Icon && <Icon size={18} style={{ color: color || "var(--primary,#6366f1)", flexShrink: 0 }} />}
      <div>
        <p style={{ fontSize: 20, fontWeight: 900, color: color || "var(--base-content,#1f2937)" }}>{value ?? "—"}</p>
        <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        <StatCard label="Total Logs"  value={summary.total}        color="var(--primary,#6366f1)" icon={Database} />
        <StatCard label="Errors"      value={summary.errorCount}   color="var(--error,#ef4444)"   icon={XCircle}  />
        <StatCard label="Warnings"    value={summary.warningCount} color="var(--warning,#f59e0b)" icon={AlertTriangle} />
        <StatCard label="Success"     value={summary.successCount} color="var(--success,#22c55e)" icon={CheckCircle}   />
        <StatCard label="Info"        value={summary.infoCount}    color="var(--info,#3b82f6)"    icon={Info}     />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ padding: "16px 18px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, opacity: 0.55, marginBottom: 12 }}>Hourly Activity (last 24h)</p>
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

        <div style={{ padding: "16px 18px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
          <p style={{ fontSize: 12, fontWeight: 700, opacity: 0.55, marginBottom: 12 }}>Events by Category</p>
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

      <div style={{ padding: "16px 18px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
        <p style={{ fontSize: 12, fontWeight: 700, opacity: 0.55, marginBottom: 12 }}>Daily Activity (last 30d)</p>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Top IPs</p>
          {topIps.length === 0 ? <p style={{ fontSize: 12, opacity: 0.3 }}>No data</p> :
            topIps.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontFamily: "monospace", opacity: 0.7 }}>{r.ip}</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>{r.count}</span>
              </div>
            ))}
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Top API Paths</p>
          {topPaths.length === 0 ? <p style={{ fontSize: 12, opacity: 0.3 }}>No data</p> :
            topPaths.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.65, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>{r.path}</span>
                <span style={{ fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{r.count}</span>
              </div>
            ))}
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Top Errors</p>
          {topErrors.length === 0 ? <p style={{ fontSize: 12, opacity: 0.3 }}>No data</p> :
            topErrors.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, opacity: 0.65, flex: 1, lineHeight: 1.4 }}>{r.message}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--error,#ef4444)", flexShrink: 0 }}>{r.count}</span>
              </div>
            ))}
        </div>
      </div>

      {Object.keys(statusCodeBreakdown).length > 0 && (
        <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Status Code Breakdown</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(statusCodeBreakdown).map(([code, count]) => (
              <div key={code} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: Number(code) >= 500 ? "rgba(239,68,68,0.1)" : Number(code) >= 400 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)",
                color: Number(code) >= 500 ? "var(--error,#ef4444)" : Number(code) >= 400 ? "var(--warning,#f59e0b)" : "var(--success,#22c55e)",
              }}>
                {code} <span style={{ fontWeight: 400 }}>×{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(byActorRole).length > 0 && (
        <div style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)" }}>
          <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>By Actor Role</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(byActorRole).map(([role, count]) => (
              <div key={role} style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: "var(--base-200,#f3f4f6)",
              }}>
                {role} <span style={{ fontWeight: 700 }}>·{count}</span>
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
      <div style={{
        padding: "20px 22px", borderRadius: 14, marginBottom: 18,
        border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)",
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
          Search & select a user to view their logs
        </p>

        <form onSubmit={handleFetchLogs} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* ── User search input + dropdown ─────────────────────────────────── */}
          <div style={{ flex: "1 1 300px", minWidth: 0, position: "relative" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
              Search by name, email or phone
            </label>
            <div
              ref={searchRef}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                border: `1px solid ${selectedUser ? "var(--primary,#6366f1)" : "var(--base-300,#e5e7eb)"}`,
                borderRadius: 9, padding: "8px 12px",
                background: selectedUser ? "color-mix(in srgb, var(--primary,#6366f1), transparent 94%)" : "transparent",
              }}>
              {usersLoading
                ? <RefreshCw size={13} style={{ opacity: 0.4, flexShrink: 0 }} className="animate-spin" />
                : <Search size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
              }
              <input
                value={searchQuery}
                onChange={handleSearchInput}
                onFocus={handleFocus}
                placeholder="Type name, email or phone…"
                autoComplete="off"
                style={{
                  border: "none", outline: "none", fontSize: 13,
                  background: "transparent", flex: 1,
                  color: selectedUser ? "var(--primary,#6366f1)" : "inherit",
                  fontWeight: selectedUser ? 600 : 400,
                }}
              />
              {(searchQuery || selectedUser) && (
                <button type="button" onClick={handleClear}
                  style={{ border: "none", background: "none", cursor: "pointer", opacity: 0.4 }}>
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
                  style={{
                    position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                    background: "var(--base-100,#fff)",
                    border: "1px solid var(--base-300,#e5e7eb)",
                    borderRadius: 12, zIndex: 100, overflow: "hidden",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                    maxHeight: 320, overflowY: "auto",
                  }}>
                  {usersLoading && (
                    <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 10, opacity: 0.5 }}>
                      <RefreshCw size={13} className="animate-spin" />
                      <span style={{ fontSize: 13 }}>Searching users…</span>
                    </div>
                  )}
                  {!usersLoading && allUsers.length === 0 && (
                    <div style={{ padding: "16px 18px", opacity: 0.4, fontSize: 13 }}>
                      No users found
                    </div>
                  )}
                  {!usersLoading && allUsers.map((u) => (
                    <div
                      key={u._id}
                      onClick={() => handleSelectUser(u)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "11px 16px", cursor: "pointer",
                        borderBottom: "1px solid var(--base-200,#f3f4f6)",
                        transition: "background 0.1s",
                        background: selectedUser?._id === u._id ? "color-mix(in srgb, var(--primary,#6366f1), transparent 92%)" : "transparent",
                      }}
                      onMouseEnter={e => { if (selectedUser?._id !== u._id) e.currentTarget.style.background = "var(--base-200,#f3f4f6)"; }}
                      onMouseLeave={e => { if (selectedUser?._id !== u._id) e.currentTarget.style.background = "transparent"; }}
                    >
                      {/* Avatar / initials */}
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: `color-mix(in srgb, ${roleBadgeColor(u.role)}, transparent 82%)`,
                        fontSize: 12, fontWeight: 800,
                        color: roleBadgeColor(u.role),
                      }}>
                        {u.avatar
                          ? <img src={u.avatar} alt="" style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover" }} />
                          : (u.name?.[0] || "?").toUpperCase()
                        }
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {u.name}
                          </p>
                          <span style={{
                            fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                            padding: "2px 6px", borderRadius: 5,
                            background: `color-mix(in srgb, ${roleBadgeColor(u.role)}, transparent 85%)`,
                            color: roleBadgeColor(u.role), flexShrink: 0,
                          }}>
                            {u.role}
                          </span>
                          {u.isBlocked && (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 5, background: "rgba(239,68,68,0.1)", color: "var(--error,#ef4444)", flexShrink: 0 }}>
                              BLOCKED
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: 11, opacity: 0.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                          {u.email}
                          {u.phone && ` · ${u.phone}`}
                        </p>
                      </div>

                      {/* ObjectId tail */}
                      <span style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.3, flexShrink: 0 }}>
                        …{u._id?.slice(-6)}
                      </span>
                    </div>
                  ))}

                  {/* Load more hint */}
                  {!usersLoading && usersPag.total > allUsers.length && (
                    <div style={{ padding: "10px 16px", fontSize: 11, opacity: 0.4, textAlign: "center" }}>
                      {usersPag.total - allUsers.length} more — refine your search
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Role filter for user search ─────────────────────────────────── */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Role</label>
            <select value={roleFilter} onChange={handleRoleFilter}
              style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }}>
              <option value="">All Roles</option>
              {["superadmin","admin","doctor","transportpartner","driver","lab partner","customer","pharmacy","care assistant","finance"].map(r =>
                <option key={r} value={r}>{r}</option>
              )}
            </select>
          </div>

          {/* ── Log filters (only useful once a user is selected) ───────────── */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Log Level</label>
            <select value={localFilters.level} onChange={e => setFlt("level", e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }}>
              <option value="">All</option>
              {VALID_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>Category</label>
            <select value={localFilters.category} onChange={e => setFlt("category", e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }}>
              <option value="">All</option>
              {VALID_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>From</label>
            <input type="date" value={localFilters.from} onChange={e => setFlt("from", e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>To</label>
            <input type="date" value={localFilters.to} onChange={e => setFlt("to", e.target.value)}
              style={{ padding: "8px 10px", borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }} />
          </div>

          {/* Apply filters button (only active once user is selected) */}
          <button type="submit" disabled={!selectedUser || logsLoading}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 18px",
              borderRadius: 10, fontSize: 13, fontWeight: 700, border: "none",
              background: "var(--primary,#6366f1)", color: "white",
              cursor: (!selectedUser || logsLoading) ? "not-allowed" : "pointer",
              opacity: (!selectedUser || logsLoading) ? 0.5 : 1,
            }}>
            {logsLoading
              ? <><RefreshCw size={13} className="animate-spin" />Loading…</>
              : <><Search size={13} />Apply Filters</>}
          </button>

          {submitted && (
            <button type="button" onClick={handleClear}
              style={{
                padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: "rgba(239,68,68,0.08)", color: "var(--error,#ef4444)",
                border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer",
              }}>
              Clear
            </button>
          )}
        </form>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {logsError && (
        <div style={{
          padding: "12px 16px", borderRadius: 10, marginBottom: 14,
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          color: "var(--error,#ef4444)", fontSize: 13, fontWeight: 600,
        }}>
          {logsError}
        </div>
      )}

      {/* ── Selected user info card ─────────────────────────────────────────── */}
      {(userLogsUser || selectedUser) && submitted && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
            borderRadius: 12, marginBottom: 16,
            border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)",
          }}>
          {/* Avatar */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0, overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: `color-mix(in srgb, ${roleBadgeColor((userLogsUser || selectedUser)?.role)}, transparent 82%)`,
            fontSize: 15, fontWeight: 800,
            color: roleBadgeColor((userLogsUser || selectedUser)?.role),
          }}>
            {(userLogsUser || selectedUser)?.avatar
              ? <img src={(userLogsUser || selectedUser).avatar} alt="" style={{ width: 44, height: 44, objectFit: "cover" }} />
              : ((userLogsUser || selectedUser)?.name?.[0] || "?").toUpperCase()
            }
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p style={{ fontSize: 14, fontWeight: 700 }}>{(userLogsUser || selectedUser)?.name || "—"}</p>
              <span style={{
                fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em",
                padding: "3px 8px", borderRadius: 6,
                background: `color-mix(in srgb, ${roleBadgeColor((userLogsUser || selectedUser)?.role)}, transparent 85%)`,
                color: roleBadgeColor((userLogsUser || selectedUser)?.role),
              }}>
                {(userLogsUser || selectedUser)?.role}
              </span>
              {(userLogsUser || selectedUser)?.isBlocked && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: "var(--error,#ef4444)" }}>
                  BLOCKED
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>
              {(userLogsUser || selectedUser)?.email}
              {(userLogsUser || selectedUser)?.phone && ` · ${(userLogsUser || selectedUser).phone}`}
            </p>
          </div>

          {/* Stats */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--primary,#6366f1)" }}>
              {userLogsPag.total?.toLocaleString() ?? 0} logs
            </p>
            <p style={{ fontSize: 10, opacity: 0.35, fontFamily: "monospace" }}>
              {(userLogsUser || selectedUser)?._id?.slice(-8)}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Logs table ─────────────────────────────────────────────────────── */}
      {submitted && (
        <div style={{ borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            padding: "12px 20px", borderBottom: "1px solid var(--base-300,#e5e7eb)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={14} style={{ color: "var(--primary,#6366f1)" }} />
              <p style={{ fontSize: 13, fontWeight: 700 }}>
                {logsLoading ? "Loading…" : userLogs.length === 0 ? "No logs found" : `${userLogsPag.total?.toLocaleString() ?? userLogs.length} log entries`}
              </p>
              {logsLoading && <RefreshCw size={12} className="animate-spin" style={{ opacity: 0.4 }} />}
            </div>
            <p style={{ fontSize: 12, opacity: 0.4 }}>
              Page {userLogsPag.page} of {userLogsPag.totalPages || 1}
            </p>
          </div>

          {/* Log rows */}
          <div style={{ overflowY: "auto", maxHeight: "56vh" }}>
            <AnimatePresence>
              {!logsLoading && userLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px", opacity: 0.3 }}>
                  <FileText size={32} style={{ margin: "0 auto 12px" }} />
                  <p style={{ fontSize: 13, fontWeight: 600 }}>No logs found for this user</p>
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
            <div style={{
              padding: "14px 20px", borderTop: "1px solid var(--base-300,#e5e7eb)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <p style={{ fontSize: 12, opacity: 0.4 }}>
                {userLogsPag.total > 0
                  ? `Showing ${((userLogsPag.page - 1) * userLogsPag.limit) + 1}–${Math.min(userLogsPag.page * userLogsPag.limit, userLogsPag.total)} of ${userLogsPag.total?.toLocaleString()}`
                  : "No results"}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button disabled={userLogsPag.page <= 1} onClick={() => handlePage(userLogsPag.page - 1)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center", cursor: userLogsPag.page <= 1 ? "not-allowed" : "pointer", opacity: userLogsPag.page <= 1 ? 0.3 : 1, background: "transparent" }}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.55, padding: "0 8px" }}>
                  {userLogsPag.page} / {userLogsPag.totalPages}
                </span>
                <button disabled={userLogsPag.page >= userLogsPag.totalPages} onClick={() => handlePage(userLogsPag.page + 1)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center", cursor: userLogsPag.page >= userLogsPag.totalPages ? "not-allowed" : "pointer", opacity: userLogsPag.page >= userLogsPag.totalPages ? 0.3 : 1, background: "transparent" }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state when no user selected yet ──────────────────────────── */}
      {!submitted && !logsLoading && (
        <div style={{
          textAlign: "center", padding: "60px 20px", opacity: 0.3,
          border: "2px dashed var(--base-300,#e5e7eb)", borderRadius: 14,
        }}>
          <Users size={36} style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 700 }}>Search and select a user above</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Their system logs will appear here</p>
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
    <div style={{ minHeight: "100vh", padding: "24px", background: "var(--base-100,#f9fafb)" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 28 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Link href="/super-admin/dashboard" style={{ fontSize: 12, opacity: 0.45, textDecoration: "none" }}>Admin</Link>
            <ChevronRight size={12} style={{ opacity: 0.3 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--primary,#6366f1)" }}>System Logs</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>System Logs</h1>
          <p style={{ fontSize: 13, opacity: 0.45, margin: "4px 0 0", fontWeight: 500 }}>
            {pagination.total?.toLocaleString() ?? "—"} total entries · Real-time audit trail
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => setShowCreate(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
              borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
              background: "var(--primary,#6366f1)", color: "white", border: "none",
            }}>
            <Plus size={14} />Create Log
          </button>

          {isSuperadmin && (
            <button onClick={() => setShowBulk(true)}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
                borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: "rgba(239,68,68,0.1)", color: "var(--error,#ef4444)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}>
              <Trash2 size={14} />Bulk Delete
            </button>
          )}

          <button onClick={handleExport} disabled={exportLoading}
            style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 16px",
              borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: exportLoading ? "not-allowed" : "pointer",
              background: "var(--base-200,#f3f4f6)", border: "1px solid var(--base-300,#e5e7eb)",
              opacity: exportLoading ? 0.6 : 1,
            }}>
            {exportLoading ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {exportLoading ? "Exporting…" : "Export CSV"}
          </button>

          <button onClick={handleRefresh}
            style={{
              width: 38, height: 38, borderRadius: 10, border: "1px solid var(--base-300,#e5e7eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", background: "var(--base-100,#fff)",
            }}>
            <RefreshCw size={15} style={{ opacity: 0.5 }} className={listLoading ? "animate-spin" : ""} />
          </button>
        </div>
      </motion.div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--base-200,#f3f4f6)", borderRadius: 12, padding: 4, width: "fit-content" }}>
        {TABS.map(tab => {
          const TIcon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "8px 18px",
                borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", border: "none",
                background: active ? "var(--base-100,#fff)" : "transparent",
                color: active ? "var(--primary,#6366f1)" : "var(--base-content,#1f2937)",
                boxShadow: active ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>
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
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              {Object.entries(LOG_LEVELS).map(([lvl, cfg]) => {
                const LIcon = cfg.icon;
                const active = localFilters.level === lvl;
                return (
                  <button key={lvl} onClick={() => {
                    const next = active ? "" : lvl;
                    setFlt("level", next);
                    applyFilters({ level: next });
                  }} style={{
                    display: "flex", alignItems: "center", gap: 7, padding: "7px 14px",
                    borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    border: active ? `1.5px solid ${cfg.color}` : "1px solid var(--base-300,#e5e7eb)",
                    background: active ? `color-mix(in srgb, ${cfg.color}, transparent 88%)` : "var(--base-100,#fff)",
                    color: active ? cfg.color : "var(--base-content,#1f2937)",
                    transition: "all 0.12s",
                  }}>
                    <LIcon size={13} style={{ color: cfg.color }} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Filter bar */}
            <div style={{
              padding: "16px 20px", borderRadius: 14, marginBottom: 16,
              border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)",
              display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "1 1 220px", minWidth: 0,
                border: "1px solid var(--base-300,#e5e7eb)", borderRadius: 9, padding: "7px 12px" }}>
                <Search size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
                <input value={localFilters.search}
                  onChange={e => setFlt("search", e.target.value)}
                  onKeyDown={e => e.key === "Enter" && applyFilters()}
                  placeholder="Search message, logCode, details…"
                  style={{ border: "none", outline: "none", fontSize: 13, background: "transparent", flex: 1 }} />
                {localFilters.search && (
                  <button onClick={() => { setFlt("search", ""); applyFilters({ search: "" }); }}
                    style={{ border: "none", background: "none", cursor: "pointer", opacity: 0.4 }}>
                    <XCircle size={13} />
                  </button>
                )}
              </div>

              <select value={localFilters.category}
                onChange={e => { setFlt("category", e.target.value); applyFilters({ category: e.target.value }); }}
                style={{ padding: "7px 10px", borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, cursor: "pointer" }}>
                <option value="">All Categories</option>
                {VALID_CATS.map(c => <option key={c} value={c}>{CATEGORIES[c]?.label || c}</option>)}
              </select>

              <select value={localFilters.sortOrder}
                onChange={e => { setFlt("sortOrder", e.target.value); applyFilters({ sortOrder: e.target.value }); }}
                style={{ padding: "7px 10px", borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, cursor: "pointer" }}>
                <option value="desc">Newest first</option>
                <option value="asc">Oldest first</option>
              </select>

              <button onClick={() => setAdvFilters(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                  borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12,
                  fontWeight: 600, cursor: "pointer", background: advFilters ? "var(--base-200,#f3f4f6)" : "var(--base-100,#fff)",
                }}>
                <SlidersHorizontal size={13} />{advFilters ? "Hide filters" : "More filters"}
              </button>

              {isSuperadmin && (
                <button onClick={() => { setSelectionMode(p => !p); clearSel(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
                    borderRadius: 9, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12,
                    fontWeight: 600, cursor: "pointer",
                    background: selectionMode ? "rgba(239,68,68,0.08)" : "var(--base-100,#fff)",
                    color: selectionMode ? "var(--error,#ef4444)" : "var(--base-content,#1f2937)",
                  }}>
                  <CheckSquare size={13} />{selectionMode ? "Cancel" : "Select"}
                </button>
              )}

              <button onClick={() => applyFilters()}
                style={{ padding: "7px 16px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                  background: "var(--primary,#6366f1)", color: "white", border: "none", cursor: "pointer" }}>
                Apply
              </button>
              {(localFilters.search || localFilters.level || localFilters.category || localFilters.actorRole || localFilters.ip || localFilters.method || localFilters.from || localFilters.to) && (
                <button onClick={() => {
                  const reset = { search: "", level: "", category: "", actorRole: "", ip: "", method: "", statusCode: "", environment: "", from: "", to: "", page: 1 };
                  setLocalFilters(p => ({ ...p, ...reset }));
                  applyFilters(reset);
                }} style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 700,
                  background: "rgba(239,68,68,0.08)", color: "var(--error,#ef4444)",
                  border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
                  <XCircle size={12} style={{ display: "inline", marginRight: 4 }} />Clear
                </button>
              )}
            </div>

            {/* Advanced filters */}
            <AnimatePresence>
              {advFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden", marginBottom: 14 }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10,
                    padding: "16px 20px", borderRadius: 12, border: "1px solid var(--base-300,#e5e7eb)",
                    background: "var(--base-100,#fff)",
                  }}>
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
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                          {f.label}
                        </label>
                        {f.type === "select" ? (
                          <select value={localFilters[f.key]}
                            onChange={e => setFlt(f.key, e.target.value)}
                            style={{ width: "100%", padding: "7px 9px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }}>
                            <option value="">Any</option>
                            {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={f.type} value={localFilters[f.key]} placeholder={f.placeholder}
                            onChange={e => setFlt(f.key, e.target.value)}
                            style={{ width: "100%", padding: "7px 9px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, boxSizing: "border-box" }} />
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
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                    borderRadius: 10, marginBottom: 12,
                    background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
                  }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--error,#ef4444)" }}>
                    {selectedIds.size} selected
                  </span>
                  <button onClick={selectAll} style={{ fontSize: 12, fontWeight: 600, border: "none", background: "none", cursor: "pointer", opacity: 0.65 }}>Select all</button>
                  <button onClick={clearSel}  style={{ fontSize: 12, fontWeight: 600, border: "none", background: "none", cursor: "pointer", opacity: 0.65 }}>Clear</button>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => setShowBulk(true)}
                    style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: "var(--error,#ef4444)", color: "white", border: "none", cursor: "pointer" }}>
                    Bulk Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Logs table */}
            <div style={{ borderRadius: 14, border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)", overflow: "hidden" }}>
              <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--base-300,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Terminal size={14} style={{ color: "var(--primary,#6366f1)" }} />
                  <p style={{ fontSize: 13, fontWeight: 700 }}>
                    {listLoading ? "Loading…" : `${pagination.total?.toLocaleString() ?? 0} logs`}
                  </p>
                  {listLoading && <RefreshCw size={12} className="animate-spin" style={{ opacity: 0.4 }} />}
                </div>
                <p style={{ fontSize: 12, opacity: 0.4 }}>
                  Page {pagination.page} of {pagination.totalPages}
                </p>
              </div>

              {listError && (
                <div style={{ padding: "14px 20px", color: "var(--error,#ef4444)", fontSize: 13, fontWeight: 600 }}>
                  {listError}
                </div>
              )}

              <div style={{ overflowY: "auto", maxHeight: "62vh" }}>
                <AnimatePresence>
                  {!listLoading && logs.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "60px 20px", opacity: 0.3 }}>
                      <FileText size={32} style={{ margin: "0 auto 12px" }} />
                      <p style={{ fontSize: 13, fontWeight: 600 }}>No logs match your filters</p>
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

              <div style={{
                padding: "14px 20px", borderTop: "1px solid var(--base-300,#e5e7eb)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <p style={{ fontSize: 12, opacity: 0.4 }}>
                  {pagination.total > 0
                    ? `Showing ${((pagination.page - 1) * pagination.limit) + 1}–${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total?.toLocaleString()}`
                    : "No results"}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button disabled={pagination.page <= 1} onClick={() => handlePage(pagination.page - 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center", cursor: pagination.page <= 1 ? "not-allowed" : "pointer", opacity: pagination.page <= 1 ? 0.3 : 1, background: "transparent" }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.55, padding: "0 8px" }}>
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button disabled={pagination.page >= pagination.totalPages} onClick={() => handlePage(pagination.page + 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", display: "flex", alignItems: "center", justifyContent: "center", cursor: pagination.page >= pagination.totalPages ? "not-allowed" : "pointer", opacity: pagination.page >= pagination.totalPages ? 0.3 : 1, background: "transparent" }}>
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
            <div style={{
              display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap",
              padding: "12px 16px", borderRadius: 12, marginBottom: 20,
              border: "1px solid var(--base-300,#e5e7eb)", background: "var(--base-100,#fff)",
            }}>
              <CalendarDays size={14} style={{ opacity: 0.45 }} />
              <label style={{ fontSize: 12, fontWeight: 700, opacity: 0.5 }}>From</label>
              <input type="date" onChange={e => dispatch(fetchSystemLogsAnalytics({ from: e.target.value }))}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }} />
              <label style={{ fontSize: 12, fontWeight: 700, opacity: 0.5 }}>To</label>
              <input type="date" onChange={e => dispatch(fetchSystemLogsAnalytics({ to: e.target.value }))}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }} />
              <select onChange={e => dispatch(fetchSystemLogsAnalytics({ environment: e.target.value }))}
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12 }}>
                <option value="">All Environments</option>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
              <button onClick={() => dispatch(fetchSystemLogsAnalytics())}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                  borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                  background: "var(--primary,#6366f1)", color: "white" }}>
                <RefreshCw size={12} className={analyticsLoading ? "animate-spin" : ""} />Refresh
              </button>
            </div>

            {analyticsError && (
              <p style={{ color: "var(--error,#ef4444)", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{analyticsError}</p>
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