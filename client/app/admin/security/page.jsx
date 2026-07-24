"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Search, RefreshCw, ChevronRight, Key,
  Bell, CheckCircle, XCircle, Clock, Globe,
  Smartphone, Monitor, Lock, Send,
  TrendingUp, TrendingDown, Award, Activity,
  Cpu, Users, User, Database, AlertTriangle,
  Info,
} from "lucide-react";
import Link from "next/link";
import {
  fetchUserSecurity,
  fetchAllUsers,
  sendUserNotification,
  adjustUserCoins,
  updateUserKyc,
  selectUserSecurity,
  selectAllUsers,
  selectSecurityLoading,
  selectSendNotificationLoading,
  selectAdjustCoinsLoading,
  selectUpdateKycLoading,
  selectListLoading,
} from "@/store/slices/adminUserSlice";

// ─────────────────────────────────────────────────────────────────────────────
// REAL SECURITY API RESPONSE SHAPE (doc index 6):
//
// data._id, data.name, data.email, data.role
// data.account.isEmailVerified, isPhoneVerified, isBlocked, blockReason, unblockAt, createdAt
// data.loginActivity.totalLogins, lastLoginAt, lastLoginIp, passwordChangedAt
// data.sessions.total, sessions.list[].{ userAgent, ipAddress, deviceName, platform, createdAt, lastActiveAt, _id }
// data.devices.total, devices.byPlatform
// data.coins.balance, totalEarned, totalRedeemed, balanceInRupees
// data.referral.code, referral.referredBy.{ _id, name, email }, referral.totalReferrals, referral.totalCoinsAwarded
// data.recentSecurityEvents[].{ _id, title, body, type, priority, isRead, createdAt }
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const KYC_STATUSES = [
  { value: "not-submitted", label: "Not Submitted", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  { value: "pending",       label: "Pending",       color: "#2563eb", bg: "rgba(59,130,246,0.1)"  },
  { value: "under-review",  label: "Under Review",  color: "#d97706", bg: "rgba(245,158,11,0.1)"  },
  { value: "verified",      label: "Verified",      color: "#16a34a", bg: "rgba(34,197,94,0.1)"   },
  { value: "rejected",      label: "Rejected",      color: "#dc2626", bg: "rgba(239,68,68,0.1)"   },
];

const NOTIF_TYPES      = ["general", "alert", "promotion", "account", "order", "payment"];
const NOTIF_PRIORITIES = ["low", "normal", "high", "urgent"];
const NOTIF_CHANNELS   = ["push", "email", "sms", "in-app"];

const ROLE_COLORS = {
  superadmin:       { bg: "rgba(139,92,246,0.12)", color: "#7c3aed" },
  admin:            { bg: "rgba(99,102,241,0.12)",  color: "#4f46e5" },
  doctor:           { bg: "rgba(16,185,129,0.12)",  color: "#059669" },
  pharmacy:         { bg: "rgba(245,158,11,0.12)",  color: "#d97706" },
  customer:         { bg: "rgba(59,130,246,0.12)",  color: "#2563eb" },
  "lab partner":    { bg: "rgba(236,72,153,0.12)",  color: "#db2777" },
  transportpartner: { bg: "rgba(234,88,12,0.12)",   color: "#ea580c" },
  finance:          { bg: "rgba(107,114,128,0.12)", color: "#4b5563" },
};

// Security event type → icon + color
const EVENT_TYPE_CFG = {
  Account_Security: { icon: Shield,        color: "#dc2626", bg: "rgba(239,68,68,0.08)"   },
  Account_Status:   { icon: Info,          color: "#2563eb", bg: "rgba(59,130,246,0.08)"  },
  Payment:          { icon: TrendingUp,    color: "#d97706", bg: "rgba(245,158,11,0.08)"  },
  default:          { icon: Bell,          color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
};

const PRIORITY_COLORS = {
  High:   "#dc2626",
  Normal: "#2563eb",
  Low:    "#6b7280",
  Urgent: "#7c3aed",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function isValidObjectId(val) {
  return /^[a-f\d]{24}$/i.test((val || "").trim());
}

function kycCfg(status) {
  return KYC_STATUSES.find(k => k.value === status) || KYC_STATUSES[0];
}

function getPlatformIcon(platform) {
  if (!platform) return Monitor;
  const p = platform.toLowerCase();
  if (p.includes("mobile") || p.includes("android") || p.includes("ios")) return Smartphone;
  return Monitor;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMALL SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role] || { bg: "rgba(107,114,128,0.1)", color: "#6b7280" };
  return (
    <span className="py-[2px] px-[8px] rounded-[20px] text-[10px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
      {role}
    </span>
  );
}

function KycBadge({ status, size = "sm" }) {
  const cfg = kycCfg(status);
  return (
    <span className="rounded-[20px] font-bold" style={{ padding: size === "lg" ? "6px 14px" : "3px 10px", fontSize: size === "lg" ? 12 : 11, background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function SectionCard({ title, icon: Icon, iconColor = "var(--primary,#6366f1)", children, badge }) {
  return (
    <div className="rounded-[14px] border border-base-300 bg-base-100 overflow-hidden">
      <div className="py-[13px] px-[20px] border-b border-base-300 flex items-center gap-[8px]">
        <Icon size={14} style={{ color: iconColor }} />
        <p className="text-[13px] font-extrabold m-[0px] flex-1">{title}</p>
        {badge}
      </div>
      <div className="py-[16px] px-[20px]">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono, badge, last }) {
  return (
    <div className="flex items-start justify-between gap-[12px]" style={{ paddingBottom: last ? 0 : 10, borderBottom: last ? "none" : "1px solid var(--base-200,#f3f4f6)", marginBottom: last ? 0 : 10 }}>
      <span className="text-[11px] font-bold opacity-40 uppercase tracking-[0.07em] shrink-0 w-[140px]">
        {label}
      </span>
      {badge || (
        <span className="text-[12px] text-right flex-1" style={{ fontFamily: mono ? "monospace" : "inherit", fontWeight: mono ? 400 : 600, wordBreak: "break-all" }}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PICKER ROW
// ─────────────────────────────────────────────────────────────────────────────

function UserPickerRow({ u, selected, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-[9px] py-[8px] px-[9px] rounded-[8px] border-none cursor-pointer text-left w-full" style={{ background: selected ? "rgba(99,102,241,0.08)" : "transparent" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--base-200,#f3f4f6)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = selected ? "rgba(99,102,241,0.08)" : "transparent"; }}
    >
      <div className="relative shrink-0">
        {u.avatar ? (
          <Image src={u.avatar} alt="" width={30} height={30} className="rounded-[8px] object-cover" />
        ) : (
          <div className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center bg-[rgba(99,102,241,0.1)] text-[12px] font-extrabold text-primary">
            {(u.name || u.email || "?")[0].toUpperCase()}
          </div>
        )}
        <span className="absolute bottom-[0px] right-[0px] w-[7px] h-[7px] rounded-[50%] border-[1.5px] border-base-100" style={{ background: u.isOnline ? "#22c55e" : "#d1d5db" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold m-[0px] overflow-hidden text-ellipsis whitespace-nowrap">{u.name || "—"}</p>
        <p className="text-[10px] opacity-40 mt-[1px] mx-[0px] mb-[0px] overflow-hidden text-ellipsis whitespace-nowrap">{u.email}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-[3px]">
        <RoleBadge role={u.role} />
        {selected && <CheckCircle size={11} className="text-primary" />}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION ROW — uses real sessions.list[] shape
// { userAgent, ipAddress, deviceName, platform, createdAt, lastActiveAt, _id }
// ─────────────────────────────────────────────────────────────────────────────

function SessionRow({ session, index }) {
  const PIcon = getPlatformIcon(session.platform);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-[12px] py-[12px] px-[14px] rounded-[10px] border border-base-300 bg-base-100"
    >
      <div className="w-[34px] h-[34px] rounded-[8px] shrink-0 flex items-center justify-center bg-[rgba(99,102,241,0.1)]">
        <PIcon size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        {/* deviceName + platform */}
        <p className="text-[13px] font-bold mt-[0px] mx-[0px] mb-[3px]">
          {session.deviceName || "Unknown device"}
          {session.platform && <span className="text-[10px] font-medium opacity-45 ml-[6px]">({session.platform})</span>}
        </p>
        {/* userAgent */}
        {session.userAgent && (
          <p className="text-[10px] font-mono opacity-35 mt-[0px] mx-[0px] mb-[5px] overflow-hidden text-ellipsis whitespace-nowrap">
            {session.userAgent}
          </p>
        )}
        <div className="flex flex-wrap gap-[12px] text-[11px] opacity-45">
          {/* ipAddress — real field name */}
          {session.ipAddress && (
            <span className="flex items-center gap-[3px]">
              <Globe size={9} />{session.ipAddress}
            </span>
          )}
          {/* createdAt */}
          {session.createdAt && (
            <span className="flex items-center gap-[3px]">
              <Clock size={9} />Signed in {fmt(session.createdAt)}
            </span>
          )}
          {/* lastActiveAt */}
          {session.lastActiveAt && (
            <span className="flex items-center gap-[3px]">
              <Activity size={9} />Active {timeAgo(session.lastActiveAt)}
            </span>
          )}
        </div>
      </div>
      {/* session _id suffix */}
      <span className="text-[9px] font-mono opacity-25 shrink-0 mt-[2px]">
        …{session._id?.slice(-6)}
      </span>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY EVENT ROW — real recentSecurityEvents[] shape
// { _id, title, body, type, priority, isRead, createdAt }
// ─────────────────────────────────────────────────────────────────────────────

function SecurityEventRow({ event, index }) {
  const cfg = EVENT_TYPE_CFG[event.type] || EVENT_TYPE_CFG.default;
  const EIcon = cfg.icon;
  const priorityColor = PRIORITY_COLORS[event.priority] || "#6b7280";

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-start gap-[10px] py-[11px] px-[14px] rounded-[10px]" style={{ background: event.isRead ? "transparent" : cfg.bg, border: `1px solid ${event.isRead ? "var(--base-300,#e5e7eb)" : "color-mix(in srgb, " + cfg.color + ", transparent 70%)"}` }}
    >
      <div className="w-[30px] h-[30px] rounded-[7px] shrink-0 flex items-center justify-center" style={{ background: cfg.bg }}>
        <EIcon size={14} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[7px] flex-wrap mb-[3px]">
          <p className="text-[12px] font-bold m-[0px]">{event.title}</p>
          {/* priority badge */}
          <span className="py-[1px] px-[6px] rounded-[10px] text-[9px] font-extrabold tracking-[0.05em]" style={{ background: `${priorityColor}18`, color: priorityColor }}>
            {event.priority?.toUpperCase()}
          </span>
          {/* unread dot */}
          {!event.isRead && (
            <span className="w-[6px] h-[6px] rounded-[50%] shrink-0" style={{ background: cfg.color }} />
          )}
        </div>
        <p className="text-[11px] opacity-50 mt-[0px] mx-[0px] mb-[4px] leading-[1.4]">{event.body}</p>
        <span className="text-[10px] opacity-30">{fmt(event.createdAt)}</span>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND NOTIFICATION PANEL
// ─────────────────────────────────────────────────────────────────────────────

function SendNotificationPanel({ userId, loading, onSubmit }) {
  const [form, setForm] = useState({ title: "", body: "", type: "general", priority: "normal", channels: ["push"] });

  const toggleChannel = (ch) => setForm(p => ({
    ...p,
    channels: p.channels.includes(ch) ? p.channels.filter(c => c !== ch) : [...p.channels, ch],
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    onSubmit({ userId, ...form });
  };

  const fs = { width: "100%", padding: "8px 12px", borderRadius: 8, boxSizing: "border-box", border: "1px solid var(--base-300,#e5e7eb)", fontSize: 12, outline: "none", background: "var(--base-100,#fff)" };
  const ls = { display: "block", fontSize: 10, fontWeight: 700, opacity: 0.45, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[12px]">
      <div className="grid grid-cols-[1fr_1fr] gap-[10px]">
        <div>
          <label style={ls}>Type</label>
          <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} style={fs}>
            {NOTIF_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label style={ls}>Priority</label>
          <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))} style={fs}>
            {NOTIF_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={ls}>Title *</label>
        <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Notification title" required style={fs} />
      </div>
      <div>
        <label style={ls}>Body *</label>
        <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Notification message" required rows={3} className="resize-y" style={{ ...fs }} />
      </div>
      <div>
        <label style={ls}>Channels</label>
        <div className="flex gap-[8px] flex-wrap">
          {NOTIF_CHANNELS.map(ch => {
            const active = form.channels.includes(ch);
            return (
              <button key={ch} type="button" onClick={() => toggleChannel(ch)}
                className="py-[5px] px-[12px] rounded-[20px] text-[11px] font-bold cursor-pointer" style={{ border: active ? "1.5px solid var(--primary,#6366f1)" : "1px solid var(--base-300,#e5e7eb)", background: active ? "rgba(99,102,241,0.1)" : "transparent", color: active ? "var(--primary,#6366f1)" : "inherit" }}>
                {ch}
              </button>
            );
          })}
        </div>
      </div>
      <button type="submit" disabled={loading || !form.title.trim() || !form.body.trim()}
        className="flex items-center justify-center gap-[7px] py-[10px] px-[0px] rounded-[9px] text-[13px] font-bold bg-primary text-[white] border-none" style={{ cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
        {loading ? <><RefreshCw size={13} className="animate-spin" />Sending…</> : <><Send size={13} />Send Notification</>}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADJUST COINS PANEL — superadmin only
// Uses real: coins.balance
// ─────────────────────────────────────────────────────────────────────────────

function AdjustCoinsPanel({ userId, loading, onSubmit, coinsObj }) {
  const [form, setForm] = useState({ action: "credit", amount: "", reason: "" });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || !form.reason.trim()) return;
    onSubmit({ userId, action: form.action, amount: Number(form.amount), reason: form.reason.trim() });
    setForm(p => ({ ...p, amount: "", reason: "" }));
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[12px]">
      {/* Real fields: coins.balance, coins.balanceInRupees */}
      <div className="grid grid-cols-[1fr_1fr] gap-[10px]">
        <div className="py-[12px] px-[14px] rounded-[9px] bg-[rgba(99,102,241,0.06)] border border-[rgba(99,102,241,0.15)] text-center">
          <p className="text-[18px] font-black text-primary m-[0px]">{(coinsObj?.balance || 0).toLocaleString()}</p>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.06em] m-[0px]">Coins Balance</p>
        </div>
        <div className="py-[12px] px-[14px] rounded-[9px] bg-[rgba(34,197,94,0.06)] border border-[rgba(34,197,94,0.2)] text-center">
          <p className="text-[18px] font-black text-[#16a34a] m-[0px]">₹{(coinsObj?.balanceInRupees || 0).toFixed(2)}</p>
          <p className="text-[10px] font-bold opacity-50 uppercase tracking-[0.06em] m-[0px]">In Rupees</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-[10px]">
        <button type="button" onClick={() => setForm(p => ({ ...p, action: "credit" }))}
          className="py-[9px] px-[0px] rounded-[9px] text-[12px] font-bold cursor-pointer flex items-center justify-center gap-[6px]" style={{ border: form.action === "credit" ? "1.5px solid #16a34a" : "1px solid var(--base-300,#e5e7eb)", background: form.action === "credit" ? "rgba(34,197,94,0.1)" : "transparent", color: form.action === "credit" ? "#16a34a" : "inherit" }}>
          <TrendingUp size={13} />Credit
        </button>
        <button type="button" onClick={() => setForm(p => ({ ...p, action: "debit" }))}
          className="py-[9px] px-[0px] rounded-[9px] text-[12px] font-bold cursor-pointer flex items-center justify-center gap-[6px]" style={{ border: form.action === "debit" ? "1.5px solid #dc2626" : "1px solid var(--base-300,#e5e7eb)", background: form.action === "debit" ? "rgba(239,68,68,0.1)" : "transparent", color: form.action === "debit" ? "#dc2626" : "inherit" }}>
          <TrendingDown size={13} />Debit
        </button>
      </div>

      <div>
        <label className="block text-[10px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[5px]">Amount *</label>
        <input type="number" min="1" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="e.g. 500" required className="w-full py-[8px] px-[12px] rounded-[8px] border border-base-300 text-[12px] box-border outline-none" />
      </div>
      <div>
        <label className="block text-[10px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[5px]">Reason *</label>
        <input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Reason for adjustment" required className="w-full py-[8px] px-[12px] rounded-[8px] border border-base-300 text-[12px] box-border outline-none" />
      </div>
      <button type="submit" disabled={loading || !form.amount || !form.reason.trim()}
        className="flex items-center justify-center gap-[7px] py-[10px] px-[0px] rounded-[9px] text-[13px] font-bold text-[white] border-none" style={{ background: form.action === "credit" ? "#16a34a" : "#dc2626", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.6 : 1 }}>
        {loading
          ? <><RefreshCw size={13} className="animate-spin" />Processing…</>
          : form.action === "credit"
            ? <><TrendingUp size={13} />Credit Coins</>
            : <><TrendingDown size={13} />Debit Coins</>
        }
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KYC PANEL
// ─────────────────────────────────────────────────────────────────────────────

function KycPanel({ userId, currentStatus, loading, onSubmit }) {
  const [newStatus, setNewStatus] = useState(currentStatus || "not-submitted");
  const [rejection, setRejection] = useState("");
  const [confirm, setConfirm]     = useState(false);

  useEffect(() => { setNewStatus(currentStatus || "not-submitted"); }, [currentStatus]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ userId, kycStatus: newStatus, rejectionReason: rejection || undefined });
    setConfirm(false);
    setRejection("");
  };

  const changed = newStatus !== currentStatus;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[14px]">
      <div>
        <p className="text-[10px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[8px]">Current Status</p>
        <KycBadge status={currentStatus} size="lg" />
      </div>
      <div>
        <p className="text-[10px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[8px]">Set New Status</p>
        <div className="flex flex-wrap gap-[8px]">
          {KYC_STATUSES.map(s => (
            <button key={s.value} type="button" onClick={() => setNewStatus(s.value)}
              className="py-[6px] px-[14px] rounded-[20px] text-[11px] font-bold cursor-pointer" style={{ border: newStatus === s.value ? `1.5px solid ${s.color}` : "1px solid var(--base-300,#e5e7eb)", background: newStatus === s.value ? s.bg : "transparent", color: newStatus === s.value ? s.color : "inherit" }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {newStatus === "rejected" && (
        <div>
          <label className="block text-[10px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[5px]">Rejection Reason</label>
          <textarea value={rejection} onChange={e => setRejection(e.target.value)} placeholder="Explain why KYC was rejected…" rows={2} className="w-full py-[8px] px-[12px] rounded-[8px] border border-base-300 text-[12px] resize-y box-border outline-none" />
        </div>
      )}
      {changed && (
        !confirm ? (
          <button type="button" onClick={() => setConfirm(true)}
            className="py-[10px] px-[0px] rounded-[9px] text-[13px] font-bold cursor-pointer" style={{ background: kycCfg(newStatus).bg, color: kycCfg(newStatus).color, border: `1.5px solid ${kycCfg(newStatus).color}` }}>
            Update to → {kycCfg(newStatus).label}
          </button>
        ) : (
          <div className="flex gap-[8px]">
            <button type="submit" disabled={loading} className="flex-1 py-[10px] px-[0px] rounded-[9px] text-[13px] font-bold bg-primary text-[white] border-none cursor-pointer" style={{ opacity: loading ? 0.6 : 1 }}>
              {loading ? "Updating…" : "Confirm Update"}
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="flex-1 py-[10px] px-[0px] rounded-[9px] text-[13px] font-bold bg-base-200 border-none cursor-pointer">
              Cancel
            </button>
          </div>
        )
      )}
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SecurityManagement() {
  const dispatch = useDispatch();

  const user         = useSelector((s) => s.user?.user) ?? null;
  const isSuperadmin = user?.role === "superadmin";

  const security        = useSelector(selectUserSecurity);
  const allUsers        = useSelector(selectAllUsers);
  const securityLoading = useSelector(selectSecurityLoading);
  const notifLoading    = useSelector(selectSendNotificationLoading);
  const coinsLoading    = useSelector(selectAdjustCoinsLoading);
  const kycLoading      = useSelector(selectUpdateKycLoading);
  const usersLoading    = useSelector(selectListLoading);

  const [selectedUserId, setSelectedUserId]     = useState("");
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [userIdInput, setUserIdInput]           = useState("");
  const [idError, setIdError]                   = useState("");
  const [userSearch, setUserSearch]             = useState("");
  const [activeSection, setActiveSection]       = useState("overview");

  useEffect(() => {
    dispatch(fetchAllUsers({ limit: 20, sortBy: "createdAt", sortOrder: "desc" }));
  }, [dispatch]);

  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(fetchAllUsers({ search: userSearch, limit: 20 }));
    }, 350);
    return () => clearTimeout(t);
  }, [userSearch, dispatch]);

  const loadSecurity = useCallback((uid) => {
    dispatch(fetchUserSecurity(uid));
  }, [dispatch]);

  const handleManualFetch = (e) => {
    e.preventDefault();
    const trimmed = userIdInput.trim();
    if (!trimmed) { setIdError("Enter a User ID."); return; }
    if (!isValidObjectId(trimmed)) { setIdError("Must be a valid 24-character MongoDB ObjectId."); return; }
    setIdError("");
    setSelectedUserId(trimmed);
    setSelectedUserInfo(null);
    loadSecurity(trimmed);
  };

  const selectFromPicker = (u) => {
    setSelectedUserId(u._id);
    setSelectedUserInfo(u);
    setUserIdInput(u._id);
    setIdError("");
    loadSecurity(u._id);
  };

  const SECTIONS = [
    { key: "overview",     label: "Overview",     icon: Shield   },
    { key: "sessions",     label: "Sessions",     icon: Activity },
    { key: "kyc",          label: "KYC",          icon: Award    },
    { key: "coins",        label: "Coins",        icon: TrendingUp },
    { key: "notification", label: "Notification", icon: Bell     },
    { key: "events",       label: "Security Events", icon: AlertTriangle },
    { key: "devices",      label: "Devices",      icon: Cpu      },
  ];

  // ── Shorthand accessors for real API nested fields ───────────────────────
  // security = data from /security endpoint (stored in Redux as selectUserSecurity)
  const sec = security;
  // Nested objects — all from real response
  const acct   = sec?.account          ?? {};   // isEmailVerified, isPhoneVerified, isBlocked, blockReason, unblockAt, createdAt
  const login  = sec?.loginActivity    ?? {};   // totalLogins, lastLoginAt, lastLoginIp, passwordChangedAt
  const sess   = sec?.sessions         ?? {};   // total, list[]
  const devs   = sec?.devices          ?? {};   // total, byPlatform
  const coins  = sec?.coins            ?? {};   // balance, totalEarned, totalRedeemed, balanceInRupees
  const ref    = sec?.referral         ?? {};   // code, referredBy{_id,name,email}, totalReferrals, totalCoinsAwarded
  const events = sec?.recentSecurityEvents ?? [];

  return (
    <div className="min-h-[100vh] p-[24px] bg-base-100">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-[28px]">
        <div className="flex items-center gap-[6px] mb-[6px]">
          <Link href="/admin" className="text-[12px] opacity-45 no-underline">Admin</Link>
          <ChevronRight size={12} className="opacity-30" />
          <span className="text-[12px] font-bold text-primary">Security Management</span>
        </div>
        <h1 className="text-[24px] font-black m-[0px] tracking-[-0.02em]">Security Management</h1>
        <p className="text-[13px] opacity-45 mt-[4px]">Sessions, KYC, coins, notifications and security events per user</p>
      </motion.div>

      <div className="grid grid-cols-[300px_1fr] gap-[20px]" style={{ alignItems: "start" }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-[14px]">

          {/* Manual ID lookup */}
          <div className="py-[16px] px-[18px] rounded-[14px] border border-base-300 bg-base-100">
            <p className="text-[10px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">Lookup by User ID</p>
            <form onSubmit={handleManualFetch} className="flex flex-col gap-[8px]">
              <div className="flex items-center gap-[8px] py-[7px] px-[10px] rounded-[8px]" style={{ border: `1px solid ${idError ? "#ef4444" : "var(--base-300,#e5e7eb)"}` }}>
                <Key size={12} className="opacity-40 shrink-0" />
                <input value={userIdInput}
                  onChange={e => { setUserIdInput(e.target.value); if (idError) setIdError(""); }}
                  placeholder="24-char ObjectId" maxLength={24}
                  className="border-none outline-none text-[11px] font-mono bg-[transparent] flex-1" />
              </div>
              {idError && <p className="text-[10px] text-[#ef4444] font-semibold m-[0px]">{idError}</p>}
              <button type="submit" disabled={securityLoading}
                className="py-[7px] px-[0px] rounded-[8px] text-[12px] font-bold bg-primary text-[white] border-none" style={{ cursor: securityLoading ? "not-allowed" : "pointer", opacity: securityLoading ? 0.6 : 1 }}>
                {securityLoading ? "Loading…" : "Load Security"}
              </button>
            </form>
          </div>

          {/* User picker */}
          <div className="py-[16px] px-[18px] rounded-[14px] border border-base-300 bg-base-100">
            <p className="text-[10px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">Or pick a user</p>
            <div className="flex items-center gap-[8px] py-[6px] px-[10px] border border-base-300 rounded-[8px] mb-[8px]">
              <Search size={12} className="opacity-40" />
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search name / email…"
                className="border-none outline-none text-[11px] bg-[transparent] flex-1" />
            </div>
            <div className="max-h-[260px] overflow-y-auto flex flex-col gap-[2px]">
              {usersLoading
                ? <p className="text-[11px] opacity-35 text-center py-[16px] px-[0px]">Loading…</p>
                : allUsers.map(u => (
                    <UserPickerRow key={u._id} u={u} selected={selectedUserId === u._id} onClick={() => selectFromPicker(u)} />
                  ))
              }
            </div>
          </div>

          {/* Section nav — only shown once data loads */}
          {selectedUserId && sec && (
            <div className="p-[8px] rounded-[14px] border border-base-300 bg-base-100 flex flex-col gap-[2px]">
              {SECTIONS.map(s => {
                const SIcon = s.icon;
                const active = activeSection === s.key;
                return (
                  <button key={s.key} onClick={() => setActiveSection(s.key)}
                    className="flex items-center gap-[8px] py-[9px] px-[12px] rounded-[9px] border-none cursor-pointer text-left text-[13px]" style={{ background: active ? "rgba(99,102,241,0.08)" : "transparent", color: active ? "var(--primary,#6366f1)" : "inherit", fontWeight: active ? 700 : 500 }}>
                    <SIcon size={14} style={{ color: active ? "var(--primary,#6366f1)" : undefined, opacity: active ? 1 : 0.45 }} />
                    {s.label}
                    {s.key === "events" && events.length > 0 && (
                      <span className="ml-[auto] py-[1px] px-[6px] rounded-[10px] text-[9px] font-extrabold bg-[rgba(239,68,68,0.1)] text-[#dc2626]">
                        {events.filter(e => !e.isRead).length || events.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT CONTENT ─────────────────────────────────────────────────── */}
        <div>
          {!selectedUserId ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="py-[60px] px-[40px] rounded-[16px] text-center border border-dashed border-base-300 opacity-40">
              <Shield size={36} className="mt-[0px] mx-[auto] mb-[14px]" />
              <p className="text-[14px] font-bold">Select a user to view security details</p>
            </motion.div>
          ) : securityLoading ? (
            <div className="py-[60px] px-[0px] text-center opacity-40">
              <RefreshCw size={24} className="animate-spin block mt-[0px] mx-[auto] mb-[10px]" />
              <p className="text-[13px]">Loading security data…</p>
            </div>
          ) : !sec ? (
            <div className="py-[60px] px-[0px] text-center opacity-35">
              <XCircle size={28} className="mt-[0px] mx-[auto] mb-[10px]" />
              <p className="text-[13px]">No data found for this user</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">

              {/* ════════════════════════════════════════════════════════════ */}
              {/* OVERVIEW                                                      */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "overview" && (
                <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-[16px]">

                  {/* Identity card — uses sec._id, sec.name, sec.email, sec.role + selectedUserInfo for avatar/isOnline */}
                  <div className="flex items-center gap-[16px] py-[16px] px-[20px] rounded-[14px] border border-base-300 bg-base-100">
                    <div className="relative shrink-0">
                      {selectedUserInfo?.avatar ? (
                        <Image src={selectedUserInfo.avatar} alt="" width={56} height={56} className="rounded-[14px] object-cover" />
                      ) : (
                        <div className="w-[56px] h-[56px] rounded-[14px] flex items-center justify-center bg-[rgba(99,102,241,0.1)] text-[22px] font-black text-primary">
                          {(sec.name || sec.email || "?")[0]?.toUpperCase()}
                        </div>
                      )}
                      {selectedUserInfo && (
                        <span className="absolute bottom-[2px] right-[2px] w-[12px] h-[12px] rounded-[50%] border-[2px] border-base-100" style={{ background: selectedUserInfo.isOnline ? "#22c55e" : "#d1d5db" }} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-[8px] flex-wrap mb-[4px]">
                        <p className="text-[16px] font-extrabold m-[0px]">{sec.name || "—"}</p>
                        <RoleBadge role={sec.role} />
                        {/* account.isBlocked — real field */}
                        {acct.isBlocked && <span className="py-[2px] px-[8px] rounded-[20px] text-[10px] font-bold bg-[rgba(239,68,68,0.1)] text-[#dc2626]">Blocked</span>}
                        {/* account.isEmailVerified — real field */}
                        {acct.isEmailVerified && <span className="py-[2px] px-[8px] rounded-[20px] text-[10px] font-bold bg-[rgba(34,197,94,0.1)] text-[#16a34a]">Email Verified</span>}
                      </div>
                      <p className="text-[12px] opacity-50 mt-[0px] mx-[0px] mb-[2px]">{sec.email}</p>
                      {/* loginActivity.lastLoginAt, lastLoginIp, totalLogins — real fields */}
                      <p className="text-[11px] opacity-35 m-[0px] font-mono">
                        Last login {fmt(login.lastLoginAt)} · {login.lastLoginIp} · {login.totalLogins} total logins
                      </p>
                    </div>
                    <button onClick={() => loadSecurity(selectedUserId)}
                      className="w-[34px] h-[34px] rounded-[8px] border border-base-300 flex items-center justify-center cursor-pointer bg-[transparent] shrink-0">
                      <RefreshCw size={14} className="opacity-50" />
                    </button>
                  </div>

                  {/* Stats — real fields from nested objects */}
                  <div className="grid grid-cols-[repeat(auto-fill,_minmax(150px,_1fr))] gap-[12px]">
                    {[
                      { label: "Coins Balance",  value: (coins.balance || 0).toLocaleString(),      color: "#d97706", icon: TrendingUp  },
                      { label: "Total Earned",   value: (coins.totalEarned || 0).toLocaleString(),   color: "#16a34a", icon: TrendingUp  },
                      { label: "Total Redeemed", value: (coins.totalRedeemed || 0).toLocaleString(), color: "#dc2626", icon: TrendingDown },
                      { label: "Active Sessions",value: sess.total ?? 0,                              color: "var(--primary,#6366f1)", icon: Activity },
                      { label: "Total Logins",   value: login.totalLogins ?? "—",                    color: "#6b7280", icon: User        },
                    ].map(s => {
                      const SIcon = s.icon;
                      return (
                        <div key={s.label} className="py-[14px] px-[16px] rounded-[12px] border border-base-300 bg-base-100 flex items-center gap-[10px]">
                          <SIcon size={16} className="shrink-0" style={{ color: s.color }} />
                          <div>
                            <p className="text-[17px] font-black m-[0px]" style={{ color: s.color }}>{s.value}</p>
                            <p className="text-[10px] font-bold opacity-40 uppercase tracking-[0.06em] m-[0px]">{s.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Account details — sec.account.* */}
                  <SectionCard title="Account" icon={Shield}>
                    <InfoRow label="User ID"         value={sec._id}              mono />
                    <InfoRow label="Name"            value={sec.name}                  />
                    <InfoRow label="Email"           value={sec.email}            mono />
                    <InfoRow label="Role"            badge={<RoleBadge role={sec.role} />} />
                    <InfoRow label="Email Verified"  badge={
                      <span className="text-[12px] font-bold" style={{ color: acct.isEmailVerified ? "#16a34a" : "#dc2626" }}>
                        {acct.isEmailVerified ? "✓ Yes" : "✗ No"}
                      </span>
                    } />
                    <InfoRow label="Phone Verified"  badge={
                      <span className="text-[12px] font-bold" style={{ color: acct.isPhoneVerified ? "#16a34a" : "#dc2626" }}>
                        {acct.isPhoneVerified ? "✓ Yes" : "✗ No"}
                      </span>
                    } />
                    <InfoRow label="Blocked"         badge={
                      <span className="text-[12px] font-bold" style={{ color: acct.isBlocked ? "#dc2626" : "#16a34a" }}>
                        {acct.isBlocked ? "✗ Yes" : "✓ No"}
                      </span>
                    } />
                    {acct.blockReason && <InfoRow label="Block Reason"   value={acct.blockReason}       />}
                    {acct.unblockAt   && <InfoRow label="Unblock At"     value={fmt(acct.unblockAt)}    />}
                    <InfoRow label="Account Created" value={fmt(acct.createdAt)} last />
                  </SectionCard>

                  {/* Login activity — sec.loginActivity.* */}
                  <SectionCard title="Login Activity" icon={Activity}>
                    <InfoRow label="Total Logins"      value={login.totalLogins}                              />
                    <InfoRow label="Last Login"        value={fmt(login.lastLoginAt)}                         />
                    <InfoRow label="Last Login IP"     value={login.lastLoginIp}         mono                 />
                    <InfoRow label="Password Changed"  value={fmt(login.passwordChangedAt)} last              />
                  </SectionCard>

                  {/* Referral — sec.referral.* */}
                  <SectionCard title="Referral" icon={Users}>
                    <InfoRow label="Referral Code"    value={ref.code}                     mono />
                    <InfoRow label="Total Referrals"  value={ref.totalReferrals}                />
                    <InfoRow label="Coins Awarded"    value={(ref.totalCoinsAwarded || 0).toLocaleString()}  />
                    {ref.referredBy && (
                      <InfoRow label="Referred By" badge={
                        <div className="text-right">
                          <p className="text-[12px] font-semibold m-[0px]">{ref.referredBy.name}</p>
                          <p className="text-[10px] opacity-45 m-[0px]">{ref.referredBy.email}</p>
                        </div>
                      } last />
                    )}
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* SESSIONS — sec.sessions.{ total, list[] }                   */}
              {/* Each session: userAgent, ipAddress, deviceName, platform,   */}
              {/*               createdAt, lastActiveAt, _id                   */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "sessions" && (
                <motion.div key="sessions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-[16px]">
                  <SectionCard title={`Active Sessions (${sess.total ?? 0})`} icon={Activity}
                    badge={
                      <span className="py-[2px] px-[8px] rounded-[10px] text-[11px] font-bold bg-[rgba(99,102,241,0.1)] text-primary">
                        {sess.total ?? 0} total
                      </span>
                    }>
                    {!sess.list || sess.list.length === 0 ? (
                      <div className="py-[24px] px-[0px] text-center opacity-35">
                        <Lock size={24} className="mt-[0px] mx-[auto] mb-[8px]" />
                        <p className="text-[12px]">No active sessions found</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-[10px]">
                        {sess.list.map((s, i) => (
                          <SessionRow key={s._id} session={s} index={i} />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* KYC                                                          */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "kyc" && (
                <motion.div key="kyc" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-[16px]">
                  <SectionCard title="Update KYC Status" icon={Award} iconColor="#d97706">
                    <KycPanel
                      userId={selectedUserId}
                      currentStatus={undefined}   // security endpoint does not return kyc status — pass undefined = "not-submitted"
                      loading={kycLoading}
                      onSubmit={(payload) => dispatch(updateUserKyc(payload))}
                    />
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* COINS — sec.coins.{ balance, totalEarned, totalRedeemed, balanceInRupees } */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "coins" && (
                <motion.div key="coins" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-[16px]">

                  <SectionCard title="Coin Summary" icon={TrendingUp} iconColor="#d97706">
                    <div className="grid grid-cols-[repeat(4,_1fr)] gap-[10px] mb-[16px]">
                      {[
                        { label: "Balance",       value: coins.balance      || 0, color: "var(--primary,#6366f1)" },
                        { label: "In Rupees",     value: `₹${(coins.balanceInRupees || 0).toFixed(2)}`, color: "#16a34a", raw: true },
                        { label: "Total Earned",  value: coins.totalEarned  || 0, color: "#16a34a" },
                        { label: "Total Redeemed",value: coins.totalRedeemed|| 0, color: "#dc2626" },
                      ].map(c => (
                        <div key={c.label} className="py-[12px] px-[10px] rounded-[10px] bg-base-200 text-center">
                          <p className="text-[18px] font-black m-[0px]" style={{ color: c.color }}>
                            {c.raw ? c.value : Number(c.value).toLocaleString()}
                          </p>
                          <p className="text-[9px] font-bold opacity-45 uppercase tracking-[0.06em] m-[0px]">{c.label}</p>
                        </div>
                      ))}
                    </div>
                    <InfoRow label="Referral Code" value={ref.code} mono last />
                  </SectionCard>

                  {isSuperadmin ? (
                    <SectionCard title="Adjust Coins" icon={TrendingUp} iconColor="#16a34a">
                      <AdjustCoinsPanel
                        userId={selectedUserId}
                        loading={coinsLoading}
                        coinsObj={coins}
                        onSubmit={(payload) => dispatch(adjustUserCoins(payload))}
                      />
                    </SectionCard>
                  ) : (
                    <div className="p-[24px] rounded-[14px] border border-dashed border-base-300 text-center opacity-35">
                      <Lock size={24} className="mt-[0px] mx-[auto] mb-[8px]" />
                      <p className="text-[13px]">Coin adjustment requires superadmin access</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* NOTIFICATION                                                  */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "notification" && (
                <motion.div key="notification" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-[16px]">
                  <SectionCard title="Send Manual Notification" icon={Bell} iconColor="var(--primary,#6366f1)">
                    <SendNotificationPanel
                      userId={selectedUserId}
                      loading={notifLoading}
                      onSubmit={(payload) => dispatch(sendUserNotification(payload))}
                    />
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* SECURITY EVENTS — sec.recentSecurityEvents[]                 */}
              {/* Each event: _id, title, body, type, priority, isRead, createdAt */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "events" && (
                <motion.div key="events" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-[16px]">
                  <SectionCard title={`Recent Security Events (${events.length})`} icon={AlertTriangle} iconColor="#dc2626"
                    badge={
                      events.filter(e => !e.isRead).length > 0 && (
                        <span className="py-[2px] px-[8px] rounded-[10px] text-[10px] font-extrabold bg-[rgba(239,68,68,0.1)] text-[#dc2626]">
                          {events.filter(e => !e.isRead).length} unread
                        </span>
                      )
                    }>
                    {events.length === 0 ? (
                      <div className="py-[24px] px-[0px] text-center opacity-35">
                        <Bell size={24} className="mt-[0px] mx-[auto] mb-[8px]" />
                        <p className="text-[12px]">No security events</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-[8px]">
                        {events.map((ev, i) => (
                          <SecurityEventRow key={ev._id} event={ev} index={i} />
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </motion.div>
              )}

              {/* ════════════════════════════════════════════════════════════ */}
              {/* DEVICES — sec.devices.{ total, byPlatform }                  */}
              {/* ════════════════════════════════════════════════════════════ */}
              {activeSection === "devices" && (
                <motion.div key="devices" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="flex flex-col gap-[16px]">
                  <SectionCard title="Registered Devices" icon={Cpu} iconColor="var(--info,#3b82f6)">
                    <InfoRow label="Total Devices" value={devs.total ?? 0} />

                    {/* byPlatform — real field: devices.byPlatform{} */}
                    {Object.keys(devs.byPlatform || {}).length > 0 ? (
                      <>
                        <p className="text-[10px] font-bold opacity-40 uppercase tracking-[0.07em] mb-[8px] mt-[4px]">By Platform</p>
                        <div className="flex gap-[8px] flex-wrap">
                          {Object.entries(devs.byPlatform).map(([platform, count]) => (
                            <div key={platform} className="py-[8px] px-[14px] rounded-[9px] bg-base-200 text-center">
                              <p className="text-[16px] font-black m-[0px]">{count}</p>
                              <p className="text-[10px] font-bold opacity-45 uppercase tracking-[0.06em] m-[0px]">{platform}</p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="py-[20px] px-[0px] text-center opacity-30 mt-[8px]">
                        <Cpu size={22} className="mt-[0px] mx-[auto] mb-[8px]" />
                        {/* devices.total = 0 from real response */}
                        <p className="text-[12px]">No device tokens registered (total: {devs.total ?? 0})</p>
                      </div>
                    )}
                  </SectionCard>
                </motion.div>
              )}

            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}