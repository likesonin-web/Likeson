"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Shield, Bell, Smartphone, Coins, Key,
  Mail, Phone, Lock, Unlock, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, XCircle, AlertTriangle, Eye,
  Trash2, RefreshCw, Send, Plus, Minus, Fingerprint,
  Clock, MapPin, Monitor, Wifi, WifiOff, LogOut,
  User, Star, GitBranch, BadgeCheck, RotateCcw,
  Save, Edit2, X, Activity,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  fetchUserById, fetchUserSettings, updateUserSettings,
  fetchUserSecurity, fetchUserSessions,
  revokeUserSession, revokeAllUserSessions,
  clearUserDevices, removeUserDevice,
  adjustUserCoins, sendUserNotification,
  updateUserKyc, fetchUserNotifications, clearUserNotifications,
  clearSelectedUser,
  selectSelectedUser, selectUserSettings, selectUserSecurity,
  selectUserSessions, selectUserNotifications,
  selectUserNotificationsCount, selectUserNotificationsPagination,
  selectDetailLoading, selectSettingsLoading, selectSecurityLoading,
  selectSessionsLoading, selectUpdateSettingsLoading,
  selectRevokeSessionLoading, selectRevokeAllSessionsLoading,
  selectClearDevicesLoading, selectAdjustCoinsLoading,
  selectSendNotificationLoading, selectUpdateKycLoading,
  selectUserNotificationsLoading, selectClearNotificationsLoading,
} from "@/store/slices/adminUserSlice";

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { key: "settings",      label: "Settings",       icon: Settings  },
  { key: "security",      label: "Security Audit", icon: Shield    },
  { key: "sessions",      label: "Sessions",       icon: Monitor   },
  { key: "notifications", label: "Notifications",  icon: Bell      },
];

const PLATFORM_COLOR = {
  android: "var(--success)",
  ios:     "var(--chart-5)",
  web:     "var(--chart-1)",
  desktop: "var(--chart-3)",
};

const KYC_STATUS_META = {
  verified:       { color: "var(--success)", label: "Verified",       icon: BadgeCheck },
  pending:        { color: "var(--warning)", label: "Pending",        icon: Clock      },
  "under-review": { color: "var(--info)",    label: "Under Review",   icon: Eye        },
  rejected:       { color: "var(--error)",   label: "Rejected",       icon: XCircle    },
  "not-submitted":{ color: "var(--neutral)", label: "Not Submitted",  icon: Shield     },
};

// ── Tiny toggle ───────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none"
      style={{ background: checked ? "var(--primary)" : "var(--base-300)" }}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

// ── Stat mini card ────────────────────────────────────────────────────────────
function MiniStat({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: `color-mix(in srgb, ${color}, transparent 88%)` }}>
      <Icon size={16} style={{ color }} />
      <div>
        <p className="text-xs opacity-55 font-semibold uppercase tracking-wide leading-none">{label}</p>
        <p className="font-black text-lg leading-tight" style={{ color }}>{value ?? "—"}</p>
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, action }) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--base-300)" }}>
        <p className="font-display font-black text-base text-base-content">{title}</p>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Settings
// ─────────────────────────────────────────────────────────────────────────────
function SettingsTab({ userId }) {
  const dispatch      = useDispatch();
  const settings      = useSelector(selectUserSettings);
  const loading       = useSelector(selectSettingsLoading);
  const saving        = useSelector(selectUpdateSettingsLoading);
  const clearingDev   = useSelector(selectClearDevicesLoading);

  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    dispatch(fetchUserSettings(userId));
  }, [dispatch, userId]);

  useEffect(() => {
    if (settings) {
      setForm({
        isEmailVerified: settings.account?.isEmailVerified,
        isPhoneVerified: settings.account?.isPhoneVerified,
        workStatus:      settings.account?.workStatus || "",
        lastKnownAddress:settings.account?.lastKnownAddress || "",
        referralCode:    settings.referral?.referralCode || "",
      });
      setDirty(false);
    }
  }, [settings]);

  const update = (key, val) => {
    setForm(p => ({ ...p, [key]: val }));
    setDirty(true);
  };

  const handleSave = () => {
    const payload = {};
    if (form.isEmailVerified !== settings.account?.isEmailVerified) payload.isEmailVerified = form.isEmailVerified;
    if (form.isPhoneVerified !== settings.account?.isPhoneVerified) payload.isPhoneVerified = form.isPhoneVerified;
    if (form.workStatus !== (settings.account?.workStatus || "")) payload.workStatus = form.workStatus;
    if (form.lastKnownAddress !== (settings.account?.lastKnownAddress || "")) payload.lastKnownAddress = form.lastKnownAddress;
    if (form.referralCode !== settings.referral?.referralCode) payload.referralCode = form.referralCode;
    dispatch(updateUserSettings({ id: userId, updates: payload }));
    setDirty(false);
  };

  if (loading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Account info */}
      <Section title="Account Information"
        action={dirty && (
          <button onClick={handleSave} disabled={saving}
            className="btn-primary-cta !px-4 !py-2 !text-xs flex items-center gap-1.5">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Changes
          </button>
        )}>
        <div className="space-y-4">
          {/* Toggles */}
          {[
            { key: "isEmailVerified", label: "Email Verified", icon: Mail, hint: "Mark email as manually verified" },
            { key: "isPhoneVerified", label: "Phone Verified", icon: Phone, hint: "Mark phone as manually verified" },
          ].map(t => (
            <div key={t.key} className="flex items-center justify-between p-4 rounded-xl bg-base-200 border border-base-300"
             >
              <div className="flex items-center gap-3">
                <t.icon size={16} style={{ color: form[t.key] ? "var(--success)" : "color-mix(in oklch, var(--base-content) 40%, transparent)" }} />
                <div>
                  <p className="text-sm font-semibold">{t.label}</p>
                  <p className="text-xs opacity-45">{t.hint}</p>
                </div>
              </div>
              <Toggle checked={!!form[t.key]} onChange={val => update(t.key, val)} disabled={saving} />
            </div>
          ))}

          {/* Work status */}
          <div className="p-4 rounded-xl space-y-2 bg-base-200 border border-base-300"
           >
            <label className="text-sm font-semibold">Work Status</label>
            <select value={form.workStatus} onChange={e => update("workStatus", e.target.value)}
              className="input-field w-full text-sm cursor-pointer">
              <option value="">Not set</option>
              {["Available", "Busy", "On Leave", "Inactive"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Last known address */}
          <div className="p-4 rounded-xl space-y-2 bg-base-200 border border-base-300"
           >
            <label className="text-sm font-semibold flex items-center gap-2">
              <MapPin size={13} />Last Known Address
            </label>
            <input type="text" value={form.lastKnownAddress}
              onChange={e => update("lastKnownAddress", e.target.value)}
              placeholder="Full address…" className="input-field w-full text-sm" />
          </div>
        </div>
      </Section>

      {/* Referral */}
      <Section title="Referral & Coins">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniStat icon={Coins} label="Balance" value={settings?.referral?.coins} color="var(--warning)" />
          <MiniStat icon={Star} label="Referral Code" value={settings?.referral?.referralCode} color="var(--chart-1)" />
          <MiniStat icon={CheckCircle} label="Consent Terms" value={settings?.consent?.termsAcceptedAt ? "Yes" : "No"} color="var(--chart-2)" />
          <MiniStat icon={Smartphone} label="Devices" value={settings?.devices?.registeredCount} color="var(--chart-3)" />
        </div>
        <div className="p-4 rounded-xl space-y-2 bg-base-200 border border-base-300"
         >
          <label className="text-sm font-semibold">Referral Code Override</label>
          <p className="text-xs opacity-45">Only changeable if user has no referral history</p>
          <div className="flex gap-2">
            <input type="text" value={form.referralCode || ""}
              onChange={e => update("referralCode", e.target.value.toUpperCase())}
              placeholder="8-char code" maxLength={8}
              className="input-field flex-1 text-sm font-mono uppercase" />
          </div>
        </div>
      </Section>

      {/* Devices */}
      <Section title="Registered Devices"
        action={
          <button onClick={() => dispatch(clearUserDevices(userId))} disabled={clearingDev}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-error border border-[color-mix(in srgb, var(--error), transparent 70%)]"
           >
            {clearingDev ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Clear All
          </button>
        }>
        {settings?.devices?.registeredCount === 0 ? (
          <div className="text-center py-8 opacity-30">
            <Smartphone size={28} className="mx-auto mb-2" />
            <p className="text-sm">No devices registered</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {Object.entries(settings?.devices?.byPlatform || {}).map(([platform, count]) => (
              <span key={platform} className="badge flex items-center gap-1.5" style={{
                background: `color-mix(in srgb, ${PLATFORM_COLOR[platform] || "var(--neutral)"}, transparent 85%)`,
                color: PLATFORM_COLOR[platform] || "var(--neutral)",
                border: `1px solid color-mix(in srgb, ${PLATFORM_COLOR[platform] || "var(--neutral)"}, transparent 65%)`,
              }}>
                <Monitor size={11} />{platform} ({count})
              </span>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Security
// ─────────────────────────────────────────────────────────────────────────────
function SecurityTab({ userId, userRole }) {
  const dispatch   = useDispatch();
  const security   = useSelector(selectUserSecurity);
  const loading    = useSelector(selectSecurityLoading);
  const adjusting  = useSelector(selectAdjustCoinsLoading);
  const sending    = useSelector(selectSendNotificationLoading);
  const kycUpdating = useSelector(selectUpdateKycLoading);

  const [showCoin, setShowCoin]   = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showKyc, setShowKyc]     = useState(false);
  const [coinForm, setCoinForm]   = useState({ action: "credit", amount: "", reason: "" });
  const [notifForm, setNotifForm] = useState({ title: "", body: "", type: "Admin_Announcement", priority: "Medium" });
  const [kycForm, setKycForm]     = useState({ kycStatus: "", rejectionReason: "" });

  useEffect(() => {
    dispatch(fetchUserSecurity(userId));
  }, [dispatch, userId]);

  const handleCoinSubmit = async () => {
    if (!coinForm.amount || !coinForm.reason) return;
    const r = await dispatch(adjustUserCoins({ userId, ...coinForm, amount: Number(coinForm.amount) }));
    if (!r.error) { setShowCoin(false); setCoinForm({ action: "credit", amount: "", reason: "" }); }
  };

  const handleNotifSubmit = async () => {
    if (!notifForm.title || !notifForm.body) return;
    const r = await dispatch(sendUserNotification({ userId, ...notifForm }));
    if (!r.error) { setShowNotif(false); setNotifForm({ title: "", body: "", type: "Admin_Announcement", priority: "Medium" }); }
  };

  const handleKycSubmit = async () => {
    if (!kycForm.kycStatus) return;
    const r = await dispatch(updateUserKyc({ userId, ...kycForm }));
    if (!r.error) { setShowKyc(false); setKycForm({ kycStatus: "", rejectionReason: "" }); }
  };

  if (loading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>;

  const s = security;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={Activity} label="Total Logins" value={s?.loginActivity?.totalLogins} color="var(--chart-1)" />
        <MiniStat icon={Monitor} label="Sessions" value={s?.sessions?.total} color="var(--chart-2)" />
        <MiniStat icon={Smartphone} label="Devices" value={s?.devices?.total} color="var(--chart-3)" />
        <MiniStat icon={Coins} label="Coins" value={s?.coins?.balance} color="var(--warning)" />
      </div>

      {/* Login activity */}
      <Section title="Login Activity">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: Clock, label: "Last Login", value: s?.loginActivity?.lastLoginAt ? new Date(s.loginActivity.lastLoginAt).toLocaleString("en-IN") : "Never" },
            { icon: MapPin, label: "Last Login IP", value: s?.loginActivity?.lastLoginIp || "Unknown" },
            { icon: Lock, label: "Password Changed", value: s?.loginActivity?.passwordChangedAt ? new Date(s.loginActivity.passwordChangedAt).toLocaleDateString("en-IN") : "Never" },
            { icon: CheckCircle, label: "Email Verified", value: s?.account?.isEmailVerified ? "Yes" : "No" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-base-200 border border-base-300"
             >
              <item.icon size={14} className="opacity-40 flex-shrink-0" />
              <div>
                <p className="text-xs opacity-45 font-semibold uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-semibold">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Coins panel */}
      <Section title="Coin Wallet"
        action={
          <button onClick={() => setShowCoin(p => !p)}
            className="btn-primary-cta !px-3 !py-1.5 !text-xs flex items-center gap-1.5">
            <Coins size={11} />Adjust Coins
          </button>
        }>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Balance", value: `${s?.coins?.balance ?? 0} coins`, sub: `₹${s?.coins?.balanceInRupees ?? "0.00"}`, color: "var(--warning)" },
            { label: "Total Earned", value: s?.coins?.totalEarned?.toLocaleString(), color: "var(--success)" },
            { label: "Total Redeemed", value: s?.coins?.totalRedeemed?.toLocaleString(), color: "var(--chart-1)" },
          ].map(c => (
            <div key={c.label} className="p-3 rounded-xl text-center"
              style={{ background: `color-mix(in srgb, ${c.color}, transparent 88%)` }}>
              <p className="font-black text-xl" style={{ color: c.color }}>{c.value ?? "—"}</p>
              {c.sub && <p className="text-xs opacity-55">{c.sub}</p>}
              <p className="text-[10px] opacity-40 uppercase tracking-wider">{c.label}</p>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {showCoin && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 rounded-xl space-y-3 bg-base-200 border border-base-300"
             >
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--base-300)" }}>
                {["credit", "debit"].map(a => (
                  <button key={a} onClick={() => setCoinForm(p => ({ ...p, action: a }))}
                    className="flex-1 py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    style={coinForm.action === a ? {
                      background: a === "credit" ? "var(--success)" : "var(--error)", color: "white"
                    } : { background: "transparent", opacity: 0.5, color: "var(--base-content)" }}>
                    {a === "credit" ? <Plus size={12} /> : <Minus size={12} />}{a}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="1" placeholder="Amount (coins)"
                  value={coinForm.amount} onChange={e => setCoinForm(p => ({ ...p, amount: e.target.value }))}
                  className="input-field text-sm" />
                <input type="text" placeholder="Reason"
                  value={coinForm.reason} onChange={e => setCoinForm(p => ({ ...p, reason: e.target.value }))}
                  className="input-field text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCoin(false)} className="btn-secondary flex-1 !py-2 !text-xs">Cancel</button>
                <button onClick={handleCoinSubmit} disabled={adjusting || !coinForm.amount || !coinForm.reason}
                  className="flex-1 !py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all text-[white]"
                  style={{ background: coinForm.action === "credit" ? "var(--success)" : "var(--error)", opacity: (adjusting || !coinForm.amount || !coinForm.reason) ? 0.5 : 1 }}>
                  {adjusting ? <Loader2 size={12} className="animate-spin" /> : <Coins size={12} />}
                  Confirm
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      {/* KYC (transport-partner only) */}
      {userRole === "transportpartner" && (
        <Section title="KYC Verification"
          action={
            <button onClick={() => setShowKyc(p => !p)}
              className="btn-secondary !px-3 !py-1.5 !text-xs flex items-center gap-1.5">
              <Fingerprint size={11} />Update KYC
            </button>
          }>
          <AnimatePresence>
            {showKyc && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="p-4 rounded-xl space-y-3 bg-base-200 border border-base-300"
               >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(KYC_STATUS_META).map(([val, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={val} onClick={() => setKycForm(p => ({ ...p, kycStatus: val }))}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all border"
                        style={kycForm.kycStatus === val ? {
                          background: cfg.color, color: "white", borderColor: cfg.color
                        } : {
                          background: `color-mix(in srgb, ${cfg.color}, transparent 90%)`,
                          color: cfg.color, borderColor: `color-mix(in srgb, ${cfg.color}, transparent 70%)`
                        }}>
                        <Icon size={11} />{cfg.label}
                      </button>
                    );
                  })}
                </div>
                {kycForm.kycStatus === "rejected" && (
                  <input type="text" placeholder="Rejection reason"
                    value={kycForm.rejectionReason}
                    onChange={e => setKycForm(p => ({ ...p, rejectionReason: e.target.value }))}
                    className="input-field w-full text-sm" />
                )}
                <div className="flex gap-2">
                  <button onClick={() => setShowKyc(false)} className="btn-secondary flex-1 !py-2 !text-xs">Cancel</button>
                  <button onClick={handleKycSubmit} disabled={!kycForm.kycStatus || kycUpdating}
                    className="btn-primary-cta flex-1 !py-2 !text-xs flex items-center justify-center gap-1.5">
                    {kycUpdating ? <Loader2 size={12} className="animate-spin" /> : <BadgeCheck size={12} />}Update
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Section>
      )}

      {/* Send notification */}
      <Section title="Send Notification"
        action={
          <button onClick={() => setShowNotif(p => !p)}
            className="btn-primary-cta !px-3 !py-1.5 !text-xs flex items-center gap-1.5">
            <Send size={11} />Send
          </button>
        }>
        <AnimatePresence>
          {showNotif ? (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-3">
              <input type="text" placeholder="Notification title *"
                value={notifForm.title} onChange={e => setNotifForm(p => ({ ...p, title: e.target.value }))}
                className="input-field w-full text-sm" />
              <textarea rows={3} placeholder="Message body *"
                value={notifForm.body} onChange={e => setNotifForm(p => ({ ...p, body: e.target.value }))}
                className="input-field w-full text-sm resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <select value={notifForm.type} onChange={e => setNotifForm(p => ({ ...p, type: e.target.value }))}
                  className="input-field text-sm cursor-pointer">
                  {["Admin_Announcement", "Account_Security", "Account_Status", "Promo_Marketing", "Coins_Credited"].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
                <select value={notifForm.priority} onChange={e => setNotifForm(p => ({ ...p, priority: e.target.value }))}
                  className="input-field text-sm cursor-pointer">
                  {["Low", "Medium", "High", "Critical"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowNotif(false)} className="btn-secondary flex-1 !py-2 !text-xs">Cancel</button>
                <button onClick={handleNotifSubmit} disabled={!notifForm.title || !notifForm.body || sending}
                  className="btn-primary-cta flex-1 !py-2 !text-xs flex items-center justify-center gap-1.5">
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}Send
                </button>
              </div>
            </motion.div>
          ) : (
            <p className="text-sm opacity-40">Click "Send" to compose a manual notification for this user.</p>
          )}
        </AnimatePresence>
      </Section>

      {/* Recent security events */}
      {s?.recentSecurityEvents?.length > 0 && (
        <Section title="Recent Security Events">
          <div className="space-y-2">
            {s.recentSecurityEvents.map((evt, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-base-200 border border-base-300"
               >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: evt.priority === "High" ? "color-mix(in srgb, var(--error), transparent 85%)" : "color-mix(in srgb, var(--info), transparent 85%)" }}>
                  {evt.priority === "High"
                    ? <AlertTriangle size={12} className="text-error" />
                    : <Shield size={12} className="text-info" />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold">{evt.title}</p>
                  <p className="text-xs opacity-45 mt-0.5">{evt.body?.slice(0, 80)}{evt.body?.length > 80 ? "…" : ""}</p>
                  <p className="text-[10px] opacity-30 mt-1">{new Date(evt.createdAt).toLocaleString("en-IN")}</p>
                </div>
                <span className={`badge ${evt.isRead ? "" : "badge-primary"} !text-[10px]`}>
                  {evt.isRead ? "Read" : "Unread"}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Sessions
// ─────────────────────────────────────────────────────────────────────────────
function SessionsTab({ userId }) {
  const dispatch    = useDispatch();
  const sessions    = useSelector(selectUserSessions);
  const loading     = useSelector(selectSessionsLoading);
  const revoking    = useSelector(selectRevokeSessionLoading);
  const revokingAll = useSelector(selectRevokeAllSessionsLoading);

  useEffect(() => {
    dispatch(fetchUserSessions(userId));
  }, [dispatch, userId]);

  const handleRevokeOne = (sessionId) => dispatch(revokeUserSession({ userId, sessionId }));
  const handleRevokeAll = () => {
    if (confirm("Log this user out of all devices?")) dispatch(revokeAllUserSessions(userId));
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold opacity-60">{sessions?.length || 0} active session(s)</p>
        {sessions?.length > 0 && (
          <button onClick={handleRevokeAll} disabled={revokingAll}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-error border border-[color-mix(in srgb, var(--error), transparent 65%)]"
           >
            {revokingAll ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
            Revoke All
          </button>
        )}
      </div>

      {sessions?.length === 0 ? (
        <div className="text-center py-16 opacity-30">
          <WifiOff size={32} className="mx-auto mb-3" />
          <p className="text-sm font-semibold">No active sessions</p>
        </div>
      ) : (
        <AnimatePresence>
          {sessions?.map((s, i) => {
            const isRecent = s.lastActiveAt && (Date.now() - new Date(s.lastActiveAt).getTime()) < 15 * 60 * 1000;
            const color = PLATFORM_COLOR[s.platform] || "var(--neutral)";
            return (
              <motion.div key={s._id}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-4 rounded-xl border"
                style={{
                  background: isRecent ? `color-mix(in srgb, ${color}, transparent 93%)` : "var(--base-200)",
                  borderColor: isRecent ? `color-mix(in srgb, ${color}, transparent 65%)` : "var(--base-300)",
                }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${color}, transparent 80%)` }}>
                    <Monitor size={18} style={{ color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold">{s.deviceName || "Unknown Device"}</p>
                      {isRecent && <span className="badge badge-success !text-[10px] gap-0.5"><Wifi size={8} />Active</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs opacity-40 capitalize">{s.platform}</span>
                      <span className="text-xs opacity-40 font-mono">{s.ipAddress}</span>
                      <span className="text-xs opacity-40">
                        {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => handleRevokeOne(s._id)} disabled={revoking}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex-shrink-0 text-error border border-[color-mix(in srgb, var(--error), transparent 70%)]"
                 >
                  {revoking ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}Revoke
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB: Notifications
// ─────────────────────────────────────────────────────────────────────────────
function NotificationsTab({ userId }) {
  const dispatch   = useDispatch();
  const notifs     = useSelector(selectUserNotifications);
  const unread     = useSelector(selectUserNotificationsCount);
  const pagination = useSelector(selectUserNotificationsPagination);
  const loading    = useSelector(selectUserNotificationsLoading);
  const clearing   = useSelector(selectClearNotificationsLoading);

  const [filters, setFilters] = useState({ page: 1, limit: 15 });

  useEffect(() => {
    dispatch(fetchUserNotifications({ userId, filters }));
  }, [dispatch, userId, filters]);

  const PRIORITY_COLOR = {
    Critical: "var(--error)", High: "var(--warning)",
    Medium: "var(--info)", Normal: "var(--chart-2)", Low: "var(--neutral)"
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold opacity-60">{pagination.total} total</p>
          {unread > 0 && (
            <span className="badge badge-primary">{unread} unread</span>
          )}
        </div>
        <button onClick={() => { if (confirm("Delete ALL notifications for this user?")) dispatch(clearUserNotifications(userId)); }}
          disabled={clearing || notifs.length === 0}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all disabled:opacity-40 text-error border border-[color-mix(in srgb, var(--error), transparent 65%)]"
         >
          {clearing ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}Clear All
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        {["", "true", "false"].map(v => (
          <button key={v} onClick={() => setFilters(p => ({ ...p, isRead: v, page: 1 }))}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={filters.isRead === v ? {
              background: "var(--primary)", color: "var(--primary-content)"
            } : { background: "var(--base-200)", opacity: 0.65, color: "var(--base-content)" }}>
            {v === "" ? "All" : v === "true" ? "Read" : "Unread"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16 opacity-30">
          <Bell size={32} className="mx-auto mb-3" />
          <p className="text-sm font-semibold">No notifications found</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {notifs.map((n, i) => (
              <motion.div key={n._id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }} transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{
                  background: n.isRead ? "var(--base-200)" : `color-mix(in srgb, var(--primary), transparent 93%)`,
                  border: `1px solid ${n.isRead ? "var(--base-300)" : "color-mix(in srgb, var(--primary), transparent 70%)"}`,
                }}>
                <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0"
                  style={{ background: n.isRead ? "var(--base-300)" : "var(--primary)" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-bold">{n.title}</p>
                    <span className="badge !text-[10px] !py-0.5" style={{
                      background: `color-mix(in srgb, ${PRIORITY_COLOR[n.priority] || "var(--neutral)"}, transparent 85%)`,
                      color: PRIORITY_COLOR[n.priority] || "var(--neutral)",
                      border: `1px solid color-mix(in srgb, ${PRIORITY_COLOR[n.priority] || "var(--neutral)"}, transparent 65%)`,
                    }}>{n.priority}</span>
                    <span className="badge !text-[10px] !py-0.5 bg-base-300 text-base-content">
                      {n.type?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs opacity-50 mt-0.5 truncate">{n.body}</p>
                  <p className="text-[10px] opacity-30 mt-1">{new Date(n.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={filters.page <= 1} onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-200 disabled:opacity-30 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold opacity-60">
            {filters.page} / {pagination.totalPages}
          </span>
          <button disabled={filters.page >= pagination.totalPages} onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-200 disabled:opacity-30 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function UserSettingsSecurity() {
  const dispatch   = useDispatch();
  const params     = useParams();
  const userId     = params?.id;
  const user       = useSelector(selectSelectedUser);
  const loading    = useSelector(selectDetailLoading);
  const [activeTab, setActiveTab] = useState("settings");

  useEffect(() => {
    if (userId) dispatch(fetchUserById(userId));
    return () => dispatch(clearSelectedUser());
  }, [dispatch, userId]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-sm opacity-40">Loading user…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-base-100">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/users" className="text-xs opacity-50 hover:opacity-80 transition-opacity">Users</Link>
              <ChevronRight size={12} className="opacity-30" />
              <Link href={`/admin/users/${userId}`} className="text-xs opacity-50 hover:opacity-80 transition-opacity">{user.name}</Link>
              <ChevronRight size={12} className="opacity-30" />
              <span className="text-xs font-semibold text-primary">Settings & Security</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-base-300"
               >
                {user.avatar
                  ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center font-black text-lg text-primary"
                     >{user.name?.[0]?.toUpperCase()}</div>
                }
              </div>
              <div>
                <h1 className="font-display font-black text-2xl leading-tight text-base-content">
                  {user.name}
                </h1>
                <p className="text-xs opacity-45">{user.email} · {user.role}</p>
              </div>
            </div>
          </div>
          <Link href={`/admin/users/${userId}`} className="btn-secondary !px-4 !py-2.5 !text-sm self-start sm:self-auto">
            <Eye size={14} className="mr-1.5" />View Profile
          </Link>
        </motion.div>

        {/* Tab nav */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="glass-card p-1.5 flex gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex-shrink-0"
                style={activeTab === tab.key ? {
                  background: "var(--primary)", color: "var(--primary-content)"
                } : {
                  color: "var(--base-content)", opacity: 0.55
                }}>
                <Icon size={14} />{tab.label}
              </button>
            );
          })}
        </motion.div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.2 }}>
            {activeTab === "settings"      && <SettingsTab userId={userId} />}
            {activeTab === "security"      && <SecurityTab userId={userId} userRole={user.role} />}
            {activeTab === "sessions"      && <SessionsTab userId={userId} />}
            {activeTab === "notifications" && <NotificationsTab userId={userId} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}