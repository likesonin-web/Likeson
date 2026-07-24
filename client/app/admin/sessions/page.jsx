"use client";

import { useEffect, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor, Smartphone, Tablet, Globe, MapPin, Clock,
  RefreshCw, LogOut, Shield, ChevronRight, Search,
  CheckCircle, XCircle, Key, Activity, Users, Lock,
} from "lucide-react";
import Link from "next/link";
import {
  fetchUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  fetchAllUsers,
  selectUserSessions,
  selectAllUsers,
  selectSessionsLoading,
  selectRevokeSessionLoading,
  selectRevokeAllSessionsLoading,
  selectListLoading,
} from "@/store/slices/adminUserSlice";

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

function getPlatformIcon(ua) {
  if (!ua) return Monitor;
  const u = ua.toLowerCase();
  if (u.includes("android") || u.includes("iphone") || u.includes("mobile")) return Smartphone;
  if (u.includes("ipad") || u.includes("tablet")) return Tablet;
  return Monitor;
}

function isValidObjectId(val) {
  return /^[a-f\d]{24}$/i.test((val || "").trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLE BADGE
// ─────────────────────────────────────────────────────────────────────────────

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

function RoleBadge({ role }) {
  const cfg = ROLE_COLORS[role] || { bg: "rgba(107,114,128,0.1)", color: "#6b7280" };
  return (
    <span className="py-[2px] px-[8px] rounded-[20px] text-[10px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>
      {role}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// USER PICKER ROW — exact fields from real API response
// avatar, name, email, role, isOnline, isBlocked
// ─────────────────────────────────────────────────────────────────────────────

function UserPickerRow({ u, selected, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-[10px] py-[9px] px-[10px] rounded-[9px] border-none cursor-pointer text-left w-full" style={{ background: selected ? "rgba(99,102,241,0.08)" : "transparent" }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = "var(--base-200,#f3f4f6)"; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = selected ? "rgba(99,102,241,0.08)" : "transparent"; }}
    >
      {/* Avatar from real API `avatar` field */}
      <div className="relative shrink-0">
        {u.avatar ? (
          <img src={u.avatar} alt="" className="w-[34px] h-[34px] rounded-[9px] object-cover" />
        ) : (
          <div className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center bg-[rgba(99,102,241,0.1)] text-[13px] font-extrabold text-primary">
            {(u.name || u.email || "?")[0].toUpperCase()}
          </div>
        )}
        {/* isOnline dot — real API field */}
        <span className="absolute bottom-[1px] right-[1px] w-[8px] h-[8px] rounded-[50%] border-[1.5px] border-base-100" style={{ background: u.isOnline ? "#22c55e" : "#d1d5db" }} />
      </div>

      <div className="flex-1 min-w-0">
        {/* name */}
        <p className="text-[12px] font-bold m-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
          {u.name || "—"}
        </p>
        {/* email */}
        <p className="text-[10px] opacity-45 mt-[2px] mx-[0px] mb-[0px] overflow-hidden text-ellipsis whitespace-nowrap">
          {u.email}
        </p>
      </div>

      <div className="shrink-0 flex flex-col items-end gap-[4px]">
        <RoleBadge role={u.role} />
        {selected && <CheckCircle size={11} className="text-primary" />}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION CARD
// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({ session, index, onRevoke, revoking }) {
  const [confirm, setConfirm] = useState(false);
  const PIcon = getPlatformIcon(session.userAgent || "");
  const isStale = session.isRevoked || session.isExpired;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.04, 0.28) }}
      className="py-[14px] px-[18px] rounded-[12px] border border-base-300 bg-base-100 flex items-start gap-[14px]" style={{ opacity: isStale ? 0.55 : 1 }}
    >
      {/* Device icon */}
      <div className="w-[38px] h-[38px] rounded-[9px] shrink-0 flex items-center justify-center" style={{ background: isStale ? "rgba(107,114,128,0.08)" : "rgba(99,102,241,0.1)" }}>
        <PIcon size={17} style={{ color: isStale ? "#6b7280" : "var(--primary,#6366f1)" }} />
      </div>

      <div className="flex-1 min-w-0">
        {/* Title + status badges */}
        <div className="flex items-center gap-[7px] flex-wrap mb-[5px]">
          <p className="text-[13px] font-bold m-[0px]">
            {session.deviceName || session.platform || "Unknown device"}
          </p>
          {session.isCurrent && (
            <span className="py-[2px] px-[8px] rounded-[20px] text-[10px] font-extrabold bg-[rgba(34,197,94,0.12)] text-[#16a34a] tracking-[0.05em]">
              CURRENT
            </span>
          )}
          {session.isRevoked && (
            <span className="py-[2px] px-[8px] rounded-[20px] text-[10px] font-bold bg-[rgba(239,68,68,0.08)] text-[#dc2626]">
              REVOKED
            </span>
          )}
          {session.isExpired && !session.isRevoked && (
            <span className="py-[2px] px-[8px] rounded-[20px] text-[10px] font-bold bg-[rgba(107,114,128,0.1)] text-[#6b7280]">
              EXPIRED
            </span>
          )}
        </div>

        {/* IP, location, userAgent */}
        <div className="flex flex-wrap gap-[10px] text-[11px] opacity-50 mb-[6px]">
          {session.ip && (
            <span className="flex items-center gap-[3px]">
              <Globe size={9} />{session.ip}
            </span>
          )}
          {session.location && (
            <span className="flex items-center gap-[3px]">
              <MapPin size={9} />{session.location}
            </span>
          )}
          {session.userAgent && (
            <span className="font-mono text-[10px] max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
              {session.userAgent}
            </span>
          )}
        </div>

        {/* Timestamps */}
        <div className="flex flex-wrap gap-[14px] text-[11px] opacity-40">
          {session.createdAt && (
            <span className="flex items-center gap-[3px]">
              <Clock size={9} />Signed in {fmt(session.createdAt)}
            </span>
          )}
          {session.lastActiveAt && (
            <span className="flex items-center gap-[3px]">
              <Activity size={9} />Active {timeAgo(session.lastActiveAt)}
            </span>
          )}
          {session.expiresAt && (
            <span className="flex items-center gap-[3px]">
              <Key size={9} />Expires {fmt(session.expiresAt)}
            </span>
          )}
        </div>
      </div>

      {/* Revoke — only for non-current, non-stale */}
      {!session.isCurrent && !isStale && (
        <div className="shrink-0">
          {!confirm ? (
            <button onClick={() => setConfirm(true)}
              className="flex items-center gap-[5px] py-[6px] px-[12px] rounded-[8px] text-[12px] font-bold cursor-pointer bg-[rgba(239,68,68,0.08)] text-[#dc2626] border border-[rgba(239,68,68,0.2)]">
              <LogOut size={12} />Revoke
            </button>
          ) : (
            <div className="flex gap-[6px]">
              <button onClick={() => { onRevoke(session._id); setConfirm(false); }} disabled={revoking}
                className="py-[6px] px-[12px] rounded-[8px] text-[12px] font-bold bg-[#dc2626] text-[white] border-none" style={{ cursor: revoking ? "not-allowed" : "pointer", opacity: revoking ? 0.6 : 1 }}>
                {revoking ? "…" : "Yes"}
              </button>
              <button onClick={() => setConfirm(false)}
                className="py-[6px] px-[12px] rounded-[8px] text-[12px] font-bold bg-base-200 border-none cursor-pointer">
                No
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SessionManagement() {
  const dispatch = useDispatch();

  // Auth — real API response is in s.user.user
  const user         = useSelector((s) => s.user?.user) ?? null;
  const isSuperadmin = user?.role === "superadmin";

  const sessions         = useSelector(selectUserSessions);
  const allUsers         = useSelector(selectAllUsers);          // shape matches real API data[]
  const sessionsLoading  = useSelector(selectSessionsLoading);
  const revokeLoading    = useSelector(selectRevokeSessionLoading);
  const revokeAllLoading = useSelector(selectRevokeAllSessionsLoading);
  const usersLoading     = useSelector(selectListLoading);

  const [selectedUserId, setSelectedUserId]     = useState("");
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);  // holds the full user object from allUsers
  const [userIdInput, setUserIdInput]           = useState("");
  const [idError, setIdError]                   = useState("");
  const [userSearch, setUserSearch]             = useState("");
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  // Initial user list load
  useEffect(() => {
    dispatch(fetchAllUsers({ limit: 20, sortBy: "createdAt", sortOrder: "desc" }));
  }, [dispatch]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      dispatch(fetchAllUsers({ search: userSearch, limit: 20 }));
    }, 350);
    return () => clearTimeout(t);
  }, [userSearch, dispatch]);

  const loadSessions = useCallback((uid) => {
    dispatch(fetchUserSessions(uid));
  }, [dispatch]);

  const handleManualFetch = (e) => {
    e.preventDefault();
    const trimmed = userIdInput.trim();
    if (!trimmed) { setIdError("Enter a User ID."); return; }
    if (!isValidObjectId(trimmed)) { setIdError("Must be a valid 24-character MongoDB ObjectId."); return; }
    setIdError("");
    setSelectedUserId(trimmed);
    setSelectedUserInfo(null);
    loadSessions(trimmed);
  };

  const selectFromPicker = (u) => {
    setSelectedUserId(u._id);
    setSelectedUserInfo(u);         // stores full user obj: name, email, avatar, role, isOnline, etc.
    setUserIdInput(u._id);
    setIdError("");
    loadSessions(u._id);
  };

  const handleRevoke = (sessionId) => {
    dispatch(revokeUserSession({ userId: selectedUserId, sessionId }));
  };

  const handleRevokeAll = async () => {
    await dispatch(revokeAllUserSessions(selectedUserId));
    setConfirmRevokeAll(false);
  };

  const activeSessions  = (sessions || []).filter(s => !s.isRevoked && !s.isExpired);
  const expiredSessions = (sessions || []).filter(s => s.isRevoked  || s.isExpired);

  return (
    <div className="min-h-[100vh] p-[24px] bg-base-100">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="mb-[28px]">
        <div className="flex items-center gap-[6px] mb-[6px]">
          <Link href="/admin" className="text-[12px] opacity-45 no-underline">Admin</Link>
          <ChevronRight size={12} className="opacity-30" />
          <span className="text-[12px] font-bold text-primary">Session Management</span>
        </div>
        <h1 className="text-[24px] font-black m-[0px] tracking-[-0.02em]">Session Management</h1>
        <p className="text-[13px] opacity-45 mt-[4px]">View and revoke active login sessions for any user</p>
      </motion.div>

      <div className="grid grid-cols-[320px_1fr] gap-[20px]" style={{ alignItems: "start" }}>

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-[14px]">

          {/* Manual ID lookup */}
          <div className="py-[18px] px-[20px] rounded-[14px] border border-base-300 bg-base-100">
            <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[12px]">
              Lookup by User ID
            </p>
            <form onSubmit={handleManualFetch} className="flex flex-col gap-[8px]">
              <div className="flex items-center gap-[8px] py-[8px] px-[12px] rounded-[9px]" style={{ border: `1px solid ${idError ? "#ef4444" : "var(--base-300,#e5e7eb)"}` }}>
                <Key size={13} className="opacity-40 shrink-0" />
                <input value={userIdInput}
                  onChange={e => { setUserIdInput(e.target.value); if (idError) setIdError(""); }}
                  placeholder="664abc123def456789012345" maxLength={24}
                  className="border-none outline-none text-[12px] font-mono bg-[transparent] flex-1" />
              </div>
              {idError && <p className="text-[11px] text-[#ef4444] font-semibold m-[0px]">{idError}</p>}
              <button type="submit" disabled={sessionsLoading}
                className="py-[8px] px-[0px] rounded-[9px] text-[13px] font-bold bg-primary text-[white] border-none" style={{ cursor: sessionsLoading ? "not-allowed" : "pointer", opacity: sessionsLoading ? 0.6 : 1 }}>
                {sessionsLoading ? "Loading…" : "Fetch Sessions"}
              </button>
            </form>
          </div>

          {/* User picker — uses real API fields */}
          <div className="py-[18px] px-[20px] rounded-[14px] border border-base-300 bg-base-100">
            <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">
              Or pick a user
            </p>
            <div className="flex items-center gap-[8px] py-[7px] px-[12px] border border-base-300 rounded-[9px] mb-[10px]">
              <Search size={13} className="opacity-40" />
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                placeholder="Search name or email…"
                className="border-none outline-none text-[12px] bg-[transparent] flex-1" />
            </div>
            <div className="max-h-[300px] overflow-y-auto flex flex-col gap-[2px]">
              {usersLoading ? (
                <div className="py-[20px] px-[0px] text-center opacity-40 text-[12px]">
                  <RefreshCw size={16} className="block mt-[0px] mx-[auto] mb-[6px] animate-spin" />Loading…
                </div>
              ) : allUsers.length === 0 ? (
                <p className="text-[12px] opacity-35 text-center py-[20px] px-[0px]">No users found</p>
              ) : allUsers.map(u => (
                <UserPickerRow key={u._id} u={u} selected={selectedUserId === u._id} onClick={() => selectFromPicker(u)} />
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ──────────────────────────────────────────────────── */}
        <div>
          {!selectedUserId ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="py-[60px] px-[40px] rounded-[16px] text-center border border-dashed border-base-300 opacity-40">
              <Shield size={36} className="mt-[0px] mx-[auto] mb-[14px]" />
              <p className="text-[14px] font-bold">Select a user to view their sessions</p>
              <p className="text-[12px] mt-[4px]">Pick from the list or enter a User ID</p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-[16px]">

              {/* Selected user header — uses real API fields from selectedUserInfo */}
              {selectedUserInfo && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-[14px] py-[14px] px-[18px] rounded-[12px] border border-base-300 bg-base-100">
                  {/* avatar — real field */}
                  <div className="relative shrink-0">
                    {selectedUserInfo.avatar ? (
                      <img src={selectedUserInfo.avatar} alt="" className="w-[46px] h-[46px] rounded-[11px] object-cover" />
                    ) : (
                      <div className="w-[46px] h-[46px] rounded-[11px] flex items-center justify-center bg-[rgba(99,102,241,0.1)] text-[18px] font-black text-primary">
                        {(selectedUserInfo.name || selectedUserInfo.email || "?")[0].toUpperCase()}
                      </div>
                    )}
                    {/* isOnline — real field */}
                    <span className="absolute bottom-[1px] right-[1px] w-[10px] h-[10px] rounded-[50%] border-[2px] border-base-100" style={{ background: selectedUserInfo.isOnline ? "#22c55e" : "#d1d5db" }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[8px] flex-wrap mb-[3px]">
                      {/* name — real field */}
                      <p className="text-[14px] font-extrabold m-[0px]">{selectedUserInfo.name || "—"}</p>
                      <RoleBadge role={selectedUserInfo.role} />
                      {selectedUserInfo.isBlocked && (
                        <span className="py-[2px] px-[8px] rounded-[20px] text-[10px] font-bold bg-[rgba(239,68,68,0.1)] text-[#dc2626]">Blocked</span>
                      )}
                    </div>
                    {/* email · phone · lastLoginAt — all real fields */}
                    <p className="text-[11px] opacity-45 m-[0px]">
                      {selectedUserInfo.email} · {selectedUserInfo.phone} · Last login {fmt(selectedUserInfo.lastLoginAt)}
                    </p>
                    {/* lastLoginIp — real field */}
                    {selectedUserInfo.lastLoginIp && (
                      <p className="text-[10px] opacity-30 mt-[2px] mx-[0px] mb-[0px] font-mono">
                        IP {selectedUserInfo.lastLoginIp} · Logins: {selectedUserInfo.loginCount}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-[8px] shrink-0">
                    <button onClick={() => loadSessions(selectedUserId)} disabled={sessionsLoading}
                      className="w-[34px] h-[34px] rounded-[8px] border border-base-300 flex items-center justify-center cursor-pointer bg-[transparent]">
                      <RefreshCw size={14} className={`opacity-50 ${sessionsLoading ? "animate-spin" : ""}`} />
                    </button>

                    {activeSessions.length > 0 && (
                      !confirmRevokeAll ? (
                        <button onClick={() => setConfirmRevokeAll(true)}
                          className="flex items-center gap-[6px] py-[7px] px-[14px] rounded-[8px] text-[12px] font-bold cursor-pointer bg-[rgba(239,68,68,0.08)] text-[#dc2626] border border-[rgba(239,68,68,0.2)]">
                          <LogOut size={13} />Revoke All
                        </button>
                      ) : (
                        <div className="flex gap-[6px] items-center">
                          <span className="text-[12px] font-semibold text-[#dc2626]">Sure?</span>
                          <button onClick={handleRevokeAll} disabled={revokeAllLoading}
                            className="py-[6px] px-[12px] rounded-[7px] text-[12px] font-bold bg-[#dc2626] text-[white] border-none cursor-pointer" style={{ opacity: revokeAllLoading ? 0.6 : 1 }}>
                            {revokeAllLoading ? "…" : "Yes"}
                          </button>
                          <button onClick={() => setConfirmRevokeAll(false)}
                            className="py-[6px] px-[12px] rounded-[7px] text-[12px] font-bold bg-base-200 border-none cursor-pointer">
                            No
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </motion.div>
              )}

              {/* Stats */}
              {sessions && (
                <div className="grid grid-cols-[repeat(3,_1fr)] gap-[12px]">
                  {[
                    { label: "Total",          value: sessions.length,        color: "var(--primary,#6366f1)", icon: Users       },
                    { label: "Active",         value: activeSessions.length,  color: "#16a34a",               icon: CheckCircle },
                    { label: "Expired/Revoked",value: expiredSessions.length, color: "#6b7280",               icon: XCircle     },
                  ].map(s => {
                    const SIcon = s.icon;
                    return (
                      <div key={s.label} className="py-[14px] px-[16px] rounded-[12px] border border-base-300 bg-base-100 flex items-center gap-[10px]">
                        <SIcon size={18} className="shrink-0" style={{ color: s.color }} />
                        <div>
                          <p className="text-[20px] font-black m-[0px]" style={{ color: s.color }}>{s.value}</p>
                          <p className="text-[10px] font-bold opacity-45 uppercase tracking-[0.06em] m-[0px]">{s.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Loading */}
              {sessionsLoading && (
                <div className="py-[40px] px-[0px] text-center opacity-40">
                  <RefreshCw size={24} className="animate-spin block mt-[0px] mx-[auto] mb-[10px]" />
                  <p className="text-[13px]">Loading sessions…</p>
                </div>
              )}

              {!sessionsLoading && sessions !== null && (
                <>
                  {/* Active */}
                  <div>
                    <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">
                      Active Sessions ({activeSessions.length})
                    </p>
                    {activeSessions.length === 0 ? (
                      <div className="p-[24px] rounded-[12px] border border-dashed border-base-300 text-center opacity-35">
                        <p className="text-[13px]">No active sessions</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-[10px]">
                        <AnimatePresence>
                          {activeSessions.map((s, i) => (
                            <SessionCard key={s._id} session={s} index={i} onRevoke={handleRevoke} revoking={revokeLoading} />
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>

                  {/* Expired / revoked */}
                  {expiredSessions.length > 0 && (
                    <div>
                      <p className="text-[11px] font-bold opacity-45 uppercase tracking-[0.07em] mb-[10px]">
                        Expired / Revoked ({expiredSessions.length})
                      </p>
                      <div className="flex flex-col gap-[10px]">
                        {expiredSessions.map((s, i) => (
                          <SessionCard key={s._id} session={s} index={i} onRevoke={() => {}} revoking={false} />
                        ))}
                      </div>
                    </div>
                  )}

                  {sessions.length === 0 && (
                    <div className="p-[40px] rounded-[14px] border border-dashed border-base-300 text-center opacity-35">
                      <Lock size={28} className="mt-[0px] mx-[auto] mb-[10px]" />
                      <p className="text-[13px] font-semibold">No sessions found for this user</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}