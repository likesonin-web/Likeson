"use client";

import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Settings, Globe, Bell, Shield, Coins, Users, Database,
  Server, Toggle, ChevronRight, Loader2, Save, RefreshCw,
  AlertTriangle, CheckCircle, Mail, Phone, Lock, Unlock,
  Zap, TrendingUp, Clock, Eye, FileText, Download, Upload,
  Sliders, Key, Webhook, Package, Activity, Star,
  FingerprintPattern,
  Monitor,
} from "lucide-react";
import Link from "next/link";
import {
  fetchUsersAnalytics,
  selectUsersAnalytics, selectAnalyticsLoading,
} from "@/store/slices/adminUserSlice";

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled, color = "var(--primary)" }) {
  return (
    <button onClick={() => !disabled && onChange(!checked)} disabled={disabled}
      className="relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none flex-shrink-0"
      style={{ background: checked ? color : "var(--base-300)" }}>
      <motion.div
        animate={{ x: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
function SettingSection({ icon: Icon, title, desc, color, children, badge }) {
  const [open, setOpen] = useState(true);
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card overflow-hidden">
      <button onClick={() => setOpen(p => !p)}
        className="w-full px-6 py-4 border-b flex items-center justify-between text-left transition-colors hover:bg-base-200"
        style={{ borderColor: "var(--base-300)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${color}, transparent 82%)` }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-display font-black text-base text-base-content">{title}</p>
              {badge && (
                <span className="badge badge-primary !text-[10px] !py-0.5">{badge}</span>
              )}
            </div>
            <p className="text-xs opacity-45">{desc}</p>
          </div>
        </div>
        <ChevronRight size={16} className="opacity-30 transition-transform" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className="p-6">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────
function SettingRow({ label, desc, children }) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b last:border-0"
      style={{ borderColor: "var(--base-300)" }}>
      <div className="flex-1 mr-6">
        <p className="text-sm font-semibold text-base-content">{label}</p>
        {desc && <p className="text-xs opacity-45 mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ── Stat mini ─────────────────────────────────────────────────────────────────
function StatBlock({ icon: Icon, label, value, color, trend }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest opacity-45">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${color}, transparent 85%)` }}>
          <Icon size={15} style={{ color }} />
        </div>
      </div>
      <p className="font-display font-black text-3xl text-base-content">
        {value ?? "—"}
      </p>
      {trend !== undefined && (
        <p className="text-xs font-semibold" style={{ color: trend >= 0 ? "var(--success)" : "var(--error)" }}>
          {trend >= 0 ? "+" : ""}{trend}% this week
        </p>
      )}
    </motion.div>
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-sm shadow-xl">
      <p className="font-bold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

// ── Global settings state (local — in production would connect to a config API) ──
const DEFAULT_SETTINGS = {
  platform: {
    maintenanceMode:       false,
    registrationEnabled:   true,
    emailVerificationReq:  true,
    phoneVerificationReq:  false,
    guestBookingAllowed:   false,
    autoBlockAfterDays:    90,
  },
  notifications: {
    emailNotifications:    true,
    smsNotifications:      true,
    pushNotifications:     true,
    whatsappNotifications: true,
    weeklyDigest:          true,
    marketingEmails:       false,
  },
  security: {
    twoFactorRequired:     false,
    sessionTimeoutMinutes: 60,
    maxLoginAttempts:      5,
    passwordMinLength:     8,
    jwtExpiryDays:         7,
    rateLimitPerMinute:    100,
  },
  coins: {
    enabled:               true,
    coinsPerRupee:         100,
    referralInviterCoins:  1000,
    referralInviteeCoins:  500,
    coinsExpireDays:       365,
    maxRedemptionPerOrder: 5000,
  },
  kyc: {
    kycMandatory:          false,
    autoApproveKyc:        false,
    aadhaarVerification:   true,
    panVerification:       true,
    dlVerification:        false,
  },
  integrations: {
    razorpayEnabled:       true,
    cashfreeEnabled:       false,
    twilioSmsEnabled:      true,
    sendgridEnabled:       true,
    firebasePushEnabled:   true,
    googleMapsEnabled:     true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function GlobalSettings() {
  const dispatch = useDispatch();
  const analytics = useSelector(selectUsersAnalytics);
  const analyticsLoading = useSelector(selectAnalyticsLoading);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dispatch(fetchUsersAnalytics());
  }, [dispatch]);

  const update = (section, key, val) => {
    setSettings(p => ({ ...p, [section]: { ...p[section], [key]: val } }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 900)); // simulate API
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  // Chart data
  const trendData = (analytics?.registrationTrend || []).slice(-10).map(d => ({
    date: d._id?.slice(5), users: d.count
  }));

  const roleData = analytics?.byRole
    ? Object.entries(analytics.byRole).map(([r, c], i) => ({
        role: r.replace(/partner|assistant/gi, "…"),
        count: c,
        color: `var(--chart-${(i % 6) + 1})`,
      }))
    : [];

  const s = analytics?.summary;

  return (
    <div className="min-h-screen p-6 bg-base-100">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/admin/users" className="text-xs opacity-50 hover:opacity-80 transition-opacity">Admin</Link>
              <ChevronRight size={12} className="opacity-30" />
              <span className="text-xs font-semibold text-primary">Global Settings</span>
            </div>
            <h1 className="section-heading !mb-0">Global Settings</h1>
            <p className="section-subheading !mb-0">Platform-wide configuration, feature flags &amp; analytics</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => dispatch(fetchUsersAnalytics())}
              className="btn-secondary !px-4 !py-2.5 !text-sm flex items-center gap-2">
              <RefreshCw size={14} />Refresh
            </button>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary-cta !px-5 !py-2.5 !text-sm flex items-center gap-2">
              {saving
                ? <Loader2 size={14} className="animate-spin" />
                : saved
                ? <CheckCircle size={14} />
                : <Save size={14} />}
              {saving ? "Saving…" : saved ? "Saved!" : "Save All"}
            </button>
          </div>
        </motion.div>

        {/* Maintenance banner */}
        <AnimatePresence>
          {settings.platform.maintenanceMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="alert alert-warning">
              <AlertTriangle size={16} className="text-warning" />
              <div>
                <p className="font-bold text-sm">Maintenance Mode Active</p>
                <p className="text-xs opacity-70">The platform is currently in maintenance mode. Only admins can access it.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Analytics summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { icon: Users,        label: "Total Users",   value: s?.totalUsers?.toLocaleString(), color: "var(--chart-1)" },
            { icon: Activity,     label: "Online",        value: s?.onlineUsers,                  color: "var(--success)" },
            { icon: TrendingUp,   label: "New This Week", value: s?.newThisWeek,                  color: "var(--chart-2)" },
            { icon: CheckCircle,  label: "Verified",      value: s?.verifiedEmails?.toLocaleString(), color: "var(--chart-3)" },
            { icon: Lock,         label: "Blocked",       value: s?.blockedUsers,                 color: "var(--error)"   },
            { icon: Star,         label: "Verify Rate",   value: s?.verificationRate,             color: "var(--chart-5)" },
          ].map((s, i) => (
            analyticsLoading
              ? <div key={i} className="skeleton h-24 rounded-xl" />
              : <StatBlock key={s.label} {...s} />
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold mb-4 opacity-70">Registration Trend (last 10 days)</h3>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="users" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} name="Users" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-5">
            <h3 className="text-sm font-bold mb-4 opacity-70">Users by Role</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={roleData} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                <XAxis dataKey="role" tick={{ fontSize: 9, fill: "var(--base-content)", opacity: 0.5 }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--base-content)", opacity: 0.5 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]} name="Count">
                  {roleData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Platform Settings ── */}
        <SettingSection icon={Globe} title="Platform" desc="Core platform behavior and access controls" color="var(--chart-1)">
          <SettingRow label="Maintenance Mode" desc="Disables public access — only admins can log in">
            <ToggleSwitch checked={settings.platform.maintenanceMode}
              onChange={v => update("platform", "maintenanceMode", v)}
              color="var(--error)" />
          </SettingRow>
          <SettingRow label="New User Registration" desc="Allow new users to sign up on the platform">
            <ToggleSwitch checked={settings.platform.registrationEnabled}
              onChange={v => update("platform", "registrationEnabled", v)} />
          </SettingRow>
          <SettingRow label="Email Verification Required" desc="Block login until email is verified">
            <ToggleSwitch checked={settings.platform.emailVerificationReq}
              onChange={v => update("platform", "emailVerificationReq", v)} />
          </SettingRow>
          <SettingRow label="Phone Verification Required" desc="Require OTP verification on phone number">
            <ToggleSwitch checked={settings.platform.phoneVerificationReq}
              onChange={v => update("platform", "phoneVerificationReq", v)} />
          </SettingRow>
          <SettingRow label="Guest Booking Allowed" desc="Allow bookings without a registered account">
            <ToggleSwitch checked={settings.platform.guestBookingAllowed}
              onChange={v => update("platform", "guestBookingAllowed", v)} />
          </SettingRow>
          <SettingRow label="Auto-Block After Inactivity (days)" desc="Block accounts idle for this many days (0 = disabled)">
            <input type="number" min="0" max="365"
              value={settings.platform.autoBlockAfterDays}
              onChange={e => update("platform", "autoBlockAfterDays", Number(e.target.value))}
              className="input-field w-24 text-sm text-center" />
          </SettingRow>
        </SettingSection>

        {/* ── Notifications ── */}
        <SettingSection icon={Bell} title="Notification Channels" desc="Enable or disable platform-wide notification delivery" color="var(--chart-2)">
          {[
            { key: "emailNotifications",    label: "Email Notifications",    desc: "Transactional & OTP emails" },
            { key: "smsNotifications",      label: "SMS Notifications",      desc: "OTP and alert SMS via Twilio" },
            { key: "pushNotifications",     label: "Push Notifications",     desc: "Firebase FCM push messages" },
            { key: "whatsappNotifications", label: "WhatsApp Notifications", desc: "WhatsApp business API" },
            { key: "weeklyDigest",          label: "Weekly Digest Emails",   desc: "Summary reports to admins" },
            { key: "marketingEmails",       label: "Marketing Emails",       desc: "Promotional campaigns" },
          ].map(item => (
            <SettingRow key={item.key} label={item.label} desc={item.desc}>
              <ToggleSwitch checked={settings.notifications[item.key]}
                onChange={v => update("notifications", item.key, v)} />
            </SettingRow>
          ))}
        </SettingSection>

        {/* ── Security ── */}
        <SettingSection icon={Shield} title="Security & Auth" desc="Session management, rate limiting, and access control" color="var(--chart-5)">
          <SettingRow label="Two-Factor Authentication Required" desc="Force 2FA for all admin and partner accounts">
            <ToggleSwitch checked={settings.security.twoFactorRequired}
              onChange={v => update("security", "twoFactorRequired", v)}
              color="var(--warning)" />
          </SettingRow>
          <SettingRow label="Session Timeout (minutes)" desc="Auto-logout after inactivity">
            <input type="number" min="5" max="1440"
              value={settings.security.sessionTimeoutMinutes}
              onChange={e => update("security", "sessionTimeoutMinutes", Number(e.target.value))}
              className="input-field w-24 text-sm text-center" />
          </SettingRow>
          <SettingRow label="Max Login Attempts" desc="Block account after N failed attempts">
            <input type="number" min="3" max="20"
              value={settings.security.maxLoginAttempts}
              onChange={e => update("security", "maxLoginAttempts", Number(e.target.value))}
              className="input-field w-24 text-sm text-center" />
          </SettingRow>
          <SettingRow label="JWT Expiry (days)" desc="How long tokens remain valid">
            <input type="number" min="1" max="30"
              value={settings.security.jwtExpiryDays}
              onChange={e => update("security", "jwtExpiryDays", Number(e.target.value))}
              className="input-field w-24 text-sm text-center" />
          </SettingRow>
          <SettingRow label="Rate Limit (req/min)" desc="API requests allowed per user per minute">
            <input type="number" min="10" max="1000"
              value={settings.security.rateLimitPerMinute}
              onChange={e => update("security", "rateLimitPerMinute", Number(e.target.value))}
              className="input-field w-24 text-sm text-center" />
          </SettingRow>
          <SettingRow label="Password Min Length" desc="Minimum characters required for passwords">
            <input type="number" min="6" max="32"
              value={settings.security.passwordMinLength}
              onChange={e => update("security", "passwordMinLength", Number(e.target.value))}
              className="input-field w-24 text-sm text-center" />
          </SettingRow>
        </SettingSection>

        {/* ── Coins ── */}
        <SettingSection icon={Coins} title="Coin & Referral System" desc="Configure the loyalty coin economy (100 coins = ₹1)" color="var(--warning)">
          <SettingRow label="Coin System Enabled" desc="Enable or fully disable the coin wallet feature">
            <ToggleSwitch checked={settings.coins.enabled}
              onChange={v => update("coins", "enabled", v)}
              color="var(--warning)" />
          </SettingRow>
          <SettingRow label="Coins per ₹1" desc="Exchange rate between coins and rupees">
            <input type="number" min="1"
              value={settings.coins.coinsPerRupee}
              onChange={e => update("coins", "coinsPerRupee", Number(e.target.value))}
              className="input-field w-24 text-sm text-center" />
          </SettingRow>
          <SettingRow label="Referral Bonus (Inviter)" desc="Coins awarded to the user who referred">
            <input type="number" min="0"
              value={settings.coins.referralInviterCoins}
              onChange={e => update("coins", "referralInviterCoins", Number(e.target.value))}
              className="input-field w-28 text-sm text-center" />
          </SettingRow>
          <SettingRow label="Referral Bonus (Invitee)" desc="Coins awarded to the newly referred user">
            <input type="number" min="0"
              value={settings.coins.referralInviteeCoins}
              onChange={e => update("coins", "referralInviteeCoins", Number(e.target.value))}
              className="input-field w-28 text-sm text-center" />
          </SettingRow>
          <SettingRow label="Coin Expiry (days)" desc="Days before earned coins expire (0 = no expiry)">
            <input type="number" min="0"
              value={settings.coins.coinsExpireDays}
              onChange={e => update("coins", "coinsExpireDays", Number(e.target.value))}
              className="input-field w-28 text-sm text-center" />
          </SettingRow>
          <SettingRow label="Max Redemption per Order" desc="Max coins redeemable in a single order">
            <input type="number" min="0"
              value={settings.coins.maxRedemptionPerOrder}
              onChange={e => update("coins", "maxRedemptionPerOrder", Number(e.target.value))}
              className="input-field w-28 text-sm text-center" />
          </SettingRow>
        </SettingSection>

        {/* ── KYC ── */}
        <SettingSection icon={FingerprintPattern} title="KYC Configuration" desc="Identity verification rules for partners and drivers" color="var(--chart-4)">
          {[
            { key: "kycMandatory",        label: "KYC Mandatory",          desc: "Block onboarding until KYC is verified" },
            { key: "autoApproveKyc",      label: "Auto-Approve KYC",       desc: "Automatically approve submitted documents" },
            { key: "aadhaarVerification", label: "Aadhaar Verification",   desc: "Require Aadhaar card for identity proof" },
            { key: "panVerification",     label: "PAN Verification",       desc: "Require PAN card for tax identity" },
            { key: "dlVerification",      label: "Driving License Check",  desc: "Require DL for driver/transport partners" },
          ].map(item => (
            <SettingRow key={item.key} label={item.label} desc={item.desc}>
              <ToggleSwitch checked={settings.kyc[item.key]}
                onChange={v => update("kyc", item.key, v)} />
            </SettingRow>
          ))}
        </SettingSection>

        {/* ── Integrations ── */}
        <SettingSection icon={Webhook} title="Integrations" desc="Third-party service connections and API enablement" color="var(--chart-3)">
          {[
            { key: "razorpayEnabled",     label: "Razorpay",        desc: "Primary payment gateway" },
            { key: "cashfreeEnabled",     label: "Cashfree",        desc: "Alternate payment gateway" },
            { key: "twilioSmsEnabled",    label: "Twilio SMS",      desc: "SMS OTP and alerts" },
            { key: "sendgridEnabled",     label: "SendGrid Email",  desc: "Transactional email delivery" },
            { key: "firebasePushEnabled", label: "Firebase Push",   desc: "Mobile and web push notifications" },
            { key: "googleMapsEnabled",   label: "Google Maps",     desc: "Location and routing services" },
          ].map(item => (
            <SettingRow key={item.key} label={item.label} desc={item.desc}>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full"
                  style={{ background: settings.integrations[item.key] ? "var(--success)" : "var(--base-300)" }} />
                <ToggleSwitch checked={settings.integrations[item.key]}
                  onChange={v => update("integrations", item.key, v)} />
              </div>
            </SettingRow>
          ))}
        </SettingSection>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "User Management", href: "/admin/users", icon: Users, color: "var(--chart-1)" },
            { label: "Sessions Audit",  href: "/admin/users/sessions", icon: Monitor, color: "var(--chart-2)" },
            { label: "KYC & Permissions", href: "/admin/users/permissions", icon: Shield, color: "var(--chart-3)" },
            { label: "System Logs",     href: "/admin/system-logs", icon: FileText, color: "var(--chart-4)" },
          ].map((link, i) => (
            <Link key={i} href={link.href}
              className="glass-card p-4 flex items-center gap-3 hover:scale-[1.02] transition-transform">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${link.color}, transparent 85%)` }}>
                <link.icon size={18} style={{ color: link.color }} />
              </div>
              <span className="text-sm font-semibold">{link.label}</span>
              <ChevronRight size={14} className="opacity-30 ml-auto" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}