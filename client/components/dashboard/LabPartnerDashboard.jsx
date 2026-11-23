"use client";

/**
 * LabPartnerDashboard.jsx
 * ─────────────────────────────────────────────────────────────────
 * Mobile: bottom-tab shell  +  stacked cards feed
 * Desktop: collapsible sidebar  +  2-col/3-col grid layout
 *
 * Stack: Next.js 14 (App Router) · Tailwind CSS · Framer Motion · Lucide
 * Theme: data-theme="lab"  (Electric violet + deep indigo + citrus)
 * ─────────────────────────────────────────────────────────────────
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchPartnerDashboard,
  fetchPartnerNotifications,
  fetchPartnerReviewAnalytics,
  selectPartnerDashboard,
  selectPartnerUnreadCount,
  selectPartnerReviewAnalytics,
  selectLabLoading,
} from "../../store/slices/labSlice";
import {
  LAB_PARTNER_NAV,
  LAB_PARTNER_QUICK_LINKS,
  LAB_DASHBOARD_STAT_KEYS,
} from "../../constants/lablinks";
import {
  LayoutDashboard,
  FlaskConical,
  Package,
  Star,
  Settings,
  Bell,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  TrendingUp,
  TrendingDown,
  Activity,
  BadgeCheck,
  AlertTriangle,
  LogOut,
  Microscope,
  Zap,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import Container from "../ui/Container";
// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const get = (obj, path, fallback = 0) =>
  path.split(".").reduce((acc, k) => (acc != null ? acc[k] : fallback), obj) ??
  fallback;

const STATUS_MAP = {
  approved:    { label: "Approved",    color: "text-[var(--success)]",  bg: "bg-[color-mix(in_srgb,var(--success),transparent_85%)]", Icon: CheckCircle2 },
  pending:     { label: "Pending",     color: "text-[var(--warning)]",  bg: "bg-[color-mix(in_srgb,var(--warning),transparent_85%)]", Icon: Clock        },
  under_review:{ label: "Under Review",color: "text-[var(--info)]",     bg: "bg-[color-mix(in_srgb,var(--info),transparent_85%)]",    Icon: Activity     },
  suspended:   { label: "Suspended",   color: "text-[var(--error)]",    bg: "bg-[color-mix(in_srgb,var(--error),transparent_85%)]",   Icon: XCircle      },
  rejected:    { label: "Rejected",    color: "text-[var(--error)]",    bg: "bg-[color-mix(in_srgb,var(--error),transparent_85%)]",   Icon: XCircle      },
  deactivated: { label: "Deactivated", color: "text-[var(--neutral)]",  bg: "bg-[color-mix(in_srgb,var(--neutral),transparent_85%)]", Icon: XCircle      },
};

// ─────────────────────────────────────────────────────────────────
// MOTION PRESETS
// ─────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

const sidebarVariants = {
  expanded:  { width: 260, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  collapsed: { width: 72,  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

const mobileMenuVariants = {
  hidden:  { x: "-100%", opacity: 0 },
  visible: { x: 0,       opacity: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:    { x: "-100%", opacity: 0, transition: { duration: 0.25 } },
};

// ─────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────

/** Animated stat card */
function StatCard({ label, value, Icon, colorClass, index }) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="stat-card relative overflow-hidden cursor-default"
    >
      {/* decorative orb */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 blur-xl"
        style={{ background: "var(--primary)" }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-card-label">{label}</p>
          <p className={`stat-card-value mt-1 ${colorClass}`}>{value}</p>
        </div>
        <span
          className="p-2 rounded-xl"
          style={{ background: "color-mix(in srgb,var(--primary),transparent 85%)" }}
        >
          <Icon size={20} style={{ color: "var(--primary)" }} />
        </span>
      </div>
    </motion.div>
  );
}

/** Sidebar nav item */
function NavItem({ link, collapsed, active }) {
  const Icon = link.icon;
  return (
    <Link href={link.href} title={link.name}>
      <motion.div
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.97 }}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-200 group ${
          active
            ? "bg-[var(--primary)] text-[var(--primary-content)] shadow-md"
            : "text-[var(--base-content)] hover:bg-[color-mix(in_srgb,var(--primary),transparent_88%)]"
        }`}
      >
        <Icon size={18} className="shrink-0" />
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="text-sm font-semibold whitespace-nowrap overflow-hidden"
            >
              {link.name}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </Link>
  );
}

/** Rating star row */
function StarRow({ rating = 0 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          fill={s <= Math.round(rating) ? "var(--warning)" : "none"}
          stroke="var(--warning)"
        />
      ))}
    </div>
  );
}

/** Rating distribution bar */
function RatingBar({ star, count, total }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 text-right font-bold" style={{ color: "var(--base-content)" }}>{star}</span>
      <Star size={10} fill="var(--warning)" stroke="var(--warning)" />
      <div className="progress-bar flex-1">
        <motion.div
          className="progress-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
        />
      </div>
      <span style={{ color: "color-mix(in oklch,var(--base-content) 60%,transparent)" }}>{count}</span>
    </div>
  );
}

/** Recent review card */
function ReviewCard({ review, index }) {
  return (
    <motion.div
      custom={index}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="card p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: "var(--primary)", color: "var(--primary-content)" }}
          >
            {(review.user?.name ?? "U")[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--base-content)" }}>
              {review.user?.name ?? "Anonymous"}
            </p>
            <StarRow rating={review.rating} />
          </div>
        </div>
        <span className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
          {review.createdAt ? new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
        </span>
      </div>
      {review.comment && (
        <p className="mt-2 text-xs leading-relaxed line-clamp-2" style={{ color: "color-mix(in oklch,var(--base-content) 75%,transparent)" }}>
          {review.comment}
        </p>
      )}
    </motion.div>
  );
}

/** Quick action pill */
function QuickAction({ label, href, Icon, index }) {
  return (
    <motion.div custom={index} variants={fadeUp} initial="hidden" animate="visible">
      <Link href={href}>
        <motion.div
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl cursor-pointer font-semibold text-sm transition-shadow"
          style={{
            background: "color-mix(in srgb,var(--primary),transparent 88%)",
            color: "var(--primary)",
            border: "1px solid color-mix(in srgb,var(--primary),transparent 70%)",
          }}
        >
          <Icon size={16} />
          {label}
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DESKTOP SIDEBAR
// ─────────────────────────────────────────────────────────────────

function DesktopSidebar({ collapsed, setCollapsed }) {
  const pathname = usePathname();
  const unread = useSelector(selectPartnerUnreadCount);

  return (
    <motion.aside
      variants={sidebarVariants}
      animate={collapsed ? "collapsed" : "expanded"}
      className="hidden lg:flex flex-col shrink-0 h-screen sticky top-0 z-30 overflow-hidden border-r"
      style={{
        background: "var(--base-200)",
        borderColor: "var(--base-300)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b" style={{ borderColor: "var(--base-300)" }}>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md"
          style={{ background: "var(--primary)" }}
        >
          <Microscope size={18} style={{ color: "var(--primary-content)" }} />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden"
            >
              <p className="font-extrabold text-sm tracking-tight font-montserrat" style={{ color: "var(--base-content)" }}>
                LIKESON
              </p>
              <p className="text-xs font-semibold" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>
                Lab Partner
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 scrollbar-thin">
        {LAB_PARTNER_NAV.map((group) => (
          <div key={group.group} className="mb-1">
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                  style={{ color: "color-mix(in oklch,var(--base-content) 40%,transparent)" }}
                >
                  {group.group}
                </motion.p>
              )}
            </AnimatePresence>
            {group.links.map((link) => (
              <div key={link.href} className="relative">
                <NavItem
                  link={link}
                  collapsed={collapsed}
                  active={pathname?.startsWith(link.href)}
                />
                {/* notification badge on Bell icon */}
                {link.name === "Notifications" && unread > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: "var(--error)", color: "var(--error-content)" }}
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      {/* Collapse toggle + logout */}
      <div className="p-3 border-t space-y-1" style={{ borderColor: "var(--base-300)" }}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--primary),transparent_88%)]"
          style={{ color: "var(--base-content)" }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors hover:bg-[color-mix(in_srgb,var(--error),transparent_88%)]"
          style={{ color: "var(--error)" }}
        >
          <LogOut size={16} />
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}

// ─────────────────────────────────────────────────────────────────
// MOBILE SIDEBAR (drawer)
// ─────────────────────────────────────────────────────────────────

function MobileDrawer({ open, onClose }) {
  const pathname = usePathname();
  const unread = useSelector(selectPartnerUnreadCount);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
          <motion.aside
            variants={mobileMenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-y-0 left-0 w-72 z-50 lg:hidden flex flex-col overflow-hidden"
            style={{ background: "var(--base-100)", borderRight: "1px solid var(--base-300)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--base-300)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
                  <Microscope size={18} style={{ color: "var(--primary-content)" }} />
                </div>
                <div>
                  <p className="font-extrabold text-sm font-montserrat" style={{ color: "var(--base-content)" }}>LIKESON</p>
                  <p className="text-xs" style={{ color: "color-mix(in oklch,var(--base-content) 50%,transparent)" }}>Lab Partner</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-200 transition-colors">
                <X size={18} style={{ color: "var(--base-content)" }} />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {LAB_PARTNER_NAV.map((group) => (
                <div key={group.group} className="mb-2">
                  <p className="px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color: "color-mix(in oklch,var(--base-content) 40%,transparent)" }}>
                    {group.group}
                  </p>
                  {group.links.map((link) => {
                    const Icon = link.icon;
                    const active = pathname?.startsWith(link.href);
                    return (
                      <Link key={link.href} href={link.href} onClick={onClose}>
                        <motion.div
                          whileTap={{ scale: 0.97 }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-colors ${
                            active
                              ? "bg-[var(--primary)] text-[var(--primary-content)]"
                              : "hover:bg-[color-mix(in_srgb,var(--primary),transparent_90%)]"
                          }`}
                          style={{ color: active ? "var(--primary-content)" : "var(--base-content)" }}
                        >
                          <Icon size={17} className="shrink-0" />
                          <span className="text-sm font-semibold">{link.name}</span>
                          {link.name === "Notifications" && unread > 0 && (
                            <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "var(--error)", color: "var(--error-content)" }}>
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </motion.div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="p-4 border-t" style={{ borderColor: "var(--base-300)" }}>
              <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors" style={{ color: "var(--error)", background: "color-mix(in srgb,var(--error),transparent 90%)" }}>
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────
// TOPBAR
// ─────────────────────────────────────────────────────────────────

function Topbar({ onMenuClick, dashboard }) {
  const unread = useSelector(selectPartnerUnreadCount);
  const status = dashboard?.status ?? "pending";
  const info = STATUS_MAP[status] ?? STATUS_MAP.pending;
  const StatusIcon = info.Icon;

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-4 lg:px-6 py-3 border-b backdrop-blur-strong"
      style={{ background: "color-mix(in srgb,var(--base-100) 80%,transparent)", borderColor: "var(--base-300)" }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-xl hover:bg-base-200 transition-colors"
          style={{ color: "var(--base-content)" }}
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-base font-extrabold font-montserrat leading-tight" style={{ color: "var(--base-content)" }}>
            {dashboard?.labName ?? "Lab Dashboard"}
          </h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusIcon size={12} className={info.color} />
            <span className={`text-xs font-bold ${info.color}`}>{info.label}</span>
          </div>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <Link href="/lab-partner/notifications">
          <motion.div
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            className="relative p-2 rounded-xl cursor-pointer transition-colors hover:bg-base-200"
            style={{ color: "var(--base-content)" }}
          >
            <Bell size={20} />
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold"
                style={{ background: "var(--error)", color: "var(--error-content)" }}
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </motion.div>
        </Link>

        <Link href="/lab-partner/profile">
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold cursor-pointer shadow-sm"
            style={{ background: "var(--primary)", color: "var(--primary-content)" }}
          >
            {(dashboard?.labName ?? "L")[0].toUpperCase()}
          </motion.div>
        </Link>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────
// MOBILE BOTTOM TAB BAR
// ─────────────────────────────────────────────────────────────────

function MobileBottomBar() {
  const pathname = usePathname();
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-center justify-around px-2 py-2 border-t safe-bottom"
      style={{ background: "var(--base-100)", borderColor: "var(--base-300)" }}
    >
      {LAB_PARTNER_QUICK_LINKS.map((link) => {
        const Icon = link.icon;
        const active = pathname?.startsWith(link.href);
        return (
          <Link key={link.href} href={link.href}>
            <motion.div
              whileTap={{ scale: 0.88 }}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl"
              style={{ color: active ? "var(--primary)" : "color-mix(in oklch,var(--base-content) 55%,transparent)" }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-bold">{link.name}</span>
              {active && (
                <motion.div
                  layoutId="bottomTab"
                  className="absolute -bottom-0 w-5 h-0.5 rounded-full"
                  style={{ background: "var(--primary)" }}
                />
              )}
            </motion.div>
          </Link>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────
// DASHBOARD CONTENT
// ─────────────────────────────────────────────────────────────────

function DashboardContent({ dashboard, analytics, loading }) {
  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  const distribution = analytics?.distribution ?? {};
  const trend        = analytics?.trend        ?? [];

  return (
    <div className="space-y-6 pb-24 lg:pb-8">

      {/* ── Banner / Hero ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl overflow-hidden p-6 lg:p-8"
        style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)" }}
      >
        {/* decorative blobs */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 blur-3xl" style={{ background: "#fff" }} />
        <div className="absolute -bottom-8 left-8 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: "var(--accent)" }} />

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} style={{ color: "var(--accent)" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.7)" }}>
                Lab Partner Portal
              </span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold font-montserrat leading-tight text-white">
              Welcome back,<br className="lg:hidden" /> {dashboard?.labName ?? "Lab"}!
            </h2>
            <p className="mt-1 text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
              Member since {dashboard?.memberSince ? new Date(dashboard.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {dashboard?.isVerified && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                <BadgeCheck size={14} /> Verified
              </span>
            )}
            {dashboard?.isFeatured && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold" style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                <Star size={14} fill="#fff" /> Featured
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Stat cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
        {LAB_DASHBOARD_STAT_KEYS.map((cfg, i) => {
          const Icon = cfg.icon;
          const raw  = get(dashboard, cfg.key, "—");
          const display = cfg.key === "rating.average"
            ? typeof raw === "number" ? raw.toFixed(1) : raw
            : raw;
          return (
            <StatCard
              key={cfg.key}
              label={cfg.label}
              value={display}
              Icon={Icon}
              colorClass={`text-[var(--${cfg.color})]`}
              index={i}
            />
          );
        })}
      </div>

      {/* ── Main grid: 2 cols on desktop ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ── LEFT — Quick Actions + Pending Docs ──────────── */}
        <div className="space-y-5 lg:col-span-1">

          {/* Quick actions */}
          <div className="card p-5">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4" style={{ color: "var(--base-content)" }}>
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Add Test",     href: "/lab-partner/tests",     Icon: FlaskConical },
                { label: "Add Package",  href: "/lab-partner/packages",  Icon: Package      },
                { label: "Reports",      href: "/lab-partner/bookings/reports", Icon: Star },
                { label: "Settings",     href: "/lab-partner/settings",  Icon: Settings     },
                { label: "Bookings",     href: "/lab-partner/bookings",  Icon: BarChart3 },
              ].map((a, i) => (
                <QuickAction key={a.href} {...a} index={i} />
              ))}
            </div>
          </div>

          {/* Pending documents alert */}
          {(dashboard?.documents?.pending ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card p-4 flex items-start gap-3"
              style={{ borderLeft: "4px solid var(--warning)" }}
            >
              <AlertTriangle size={18} style={{ color: "var(--warning)", flexShrink: 0 }} className="mt-0.5" />
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--base-content)" }}>
                  {dashboard.documents.pending} document{dashboard.documents.pending > 1 ? "s" : ""} awaiting verification
                </p>
                <p className="text-xs mt-0.5" style={{ color: "color-mix(in oklch,var(--base-content) 60%,transparent)" }}>
                  Upload your accreditations and compliance docs to get verified faster.
                </p>
                <Link href="/lab-partner/accreditations">
                  <span className="text-xs font-bold mt-1.5 inline-flex items-center gap-1" style={{ color: "var(--primary)" }}>
                    Review docs <ChevronRight size={12} />
                  </span>
                </Link>
              </div>
            </motion.div>
          )}

          {/* Tests & packages summary */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-black uppercase tracking-widest mb-1" style={{ color: "var(--base-content)" }}>
              Catalogue Summary
            </h3>
            {[
              { label: "Total Tests",    value: dashboard?.tests?.total    ?? 0 },
              { label: "Active Tests",   value: dashboard?.tests?.active   ?? 0 },
              { label: "Inactive Tests", value: dashboard?.tests?.inactive ?? 0 },
              { label: "Total Packages", value: dashboard?.packages?.total ?? 0 },
              { label: "Active Packages",value: dashboard?.packages?.active?? 0 },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span style={{ color: "color-mix(in oklch,var(--base-content) 65%,transparent)" }}>{row.label}</span>
                <span className="font-bold" style={{ color: "var(--base-content)" }}>{row.value}</span>
              </div>
            ))}
            <div className="divider !my-2" />
            <Link href="/lab-partner/tests">
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--primary)" }}>
                Manage Tests <ChevronRight size={12} />
              </span>
            </Link>
          </div>
        </div>

        {/* ── RIGHT — Reviews panel ─────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Rating overview */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--base-content)" }}>
                Rating Overview
              </h3>
              <Link href="/lab-partner/bookings/reports">
                <span className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--primary)" }}>
                  Full Analytics <ChevronRight size={12} />
                </span>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-6">
              {/* Big score */}
              <div className="flex flex-col items-center justify-center sm:w-32 shrink-0">
                <span className="text-5xl font-extrabold font-montserrat" style={{ color: "var(--primary)" }}>
                  {typeof analytics?.averageRating === "number"
                    ? analytics.averageRating.toFixed(1)
                    : "—"}
                </span>
                <StarRow rating={analytics?.averageRating ?? 0} />
                <span className="text-xs mt-1" style={{ color: "color-mix(in oklch,var(--base-content) 55%,transparent)" }}>
                  {analytics?.totalReviews ?? 0} reviews
                </span>
              </div>

              {/* Distribution bars */}
              <div className="flex-1 space-y-2">
                {[5, 4, 3, 2, 1].map((s) => (
                  <RatingBar
                    key={s}
                    star={s}
                    count={distribution[s] ?? 0}
                    total={analytics?.totalReviews ?? 0}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Monthly trend mini-chart */}
          {trend.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-black uppercase tracking-widest mb-4" style={{ color: "var(--base-content)" }}>
                6-Month Review Trend
              </h3>
              <div className="flex items-end gap-2 h-24">
                {trend.slice(-6).map((t, i) => {
                  const pct = Math.max(8, Math.round((t.averageRating / 5) * 100));
                  return (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${pct}%` }}
                        transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
                        className="w-full rounded-t-md"
                        style={{ background: "var(--primary)", opacity: 0.5 + (i / trend.length) * 0.5 }}
                        title={`${t.month}: ${t.averageRating} (${t.count} reviews)`}
                      />
                      <span className="text-[9px] font-bold" style={{ color: "color-mix(in oklch,var(--base-content) 45%,transparent)" }}>
                        {t.month}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent reviews */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-black uppercase tracking-widest" style={{ color: "var(--base-content)" }}>
                Recent Reviews
              </h3>
              <Link href="/lab-partner/bookings">
                <span className="text-xs font-bold flex items-center gap-1" style={{ color: "var(--primary)" }}>
                  See All <ChevronRight size={12} />
                </span>
              </Link>
            </div>
            {(dashboard?.recentReviews ?? []).length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: "color-mix(in oklch,var(--base-content) 45%,transparent)" }}>
                No reviews yet. Great things are coming!
              </p>
            ) : (
              <div className="space-y-3">
                {(dashboard?.recentReviews ?? []).map((r, i) => (
                  <ReviewCard key={r._id ?? i} review={r} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROOT LAYOUT + WIRING
// ─────────────────────────────────────────────────────────────────

/**
 * LabPartnerDashboard
 *
 * @param {{ children?: React.ReactNode }} props
 *   When provided, `children` renders as the main page content on
 *   the right side instead of the default DashboardContent.
 *   Use this in nested route layouts — e.g. wrap sub-pages with
 *   this component and pass their content as children.
 *
 *   Example (app/lab-partner/tests/page.jsx):
 *   ─────────────────────────────────────────
 *   import LabPartnerDashboard from "@/components/LabPartnerDashboard";
 *
 *   export default function TestsPage() {
 *     return (
 *       <LabPartnerDashboard>
 *         <MyTestsContent />
 *       </LabPartnerDashboard>
 *     );
 *   }
 */
export default function LabPartnerDashboard({ children }) {
  const dispatch  = useDispatch();
  const dashboard = useSelector(selectPartnerDashboard);
  const analytics = useSelector(selectPartnerReviewAnalytics);
  const loading   = useSelector(selectLabLoading);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchPartnerDashboard());
    dispatch(fetchPartnerReviewAnalytics());
    dispatch(fetchPartnerNotifications({ limit: 5 }));
  }, [dispatch]);

  return (
    // Apply the "lab" theme at root — Electric violet + deep indigo + citrus
    <div data-theme="lab" className="flex h-screen overflow-hidden" style={{ background: "var(--base-100)" }}>

      {/* Desktop sidebar */}
      <DesktopSidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      {/* Mobile drawer */}
      <MobileDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <Topbar onMenuClick={() => setMobileDrawerOpen(true)} dashboard={dashboard} />

        {/* Scrollable content:
            - If children are passed, render them as the page body.
            - Otherwise fall back to the default dashboard overview. */}
      <Container className="">
          <main className="flex-1 overflow-y-auto ">
          {children ? (
            <motion.div
              key="children-view"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="pb-24 lg:pb-8"
            >
              {children}
            </motion.div>
          ) : (
            <DashboardContent dashboard={dashboard} analytics={analytics} loading={loading} />
          )}
        </main>
      </Container>
      </div>

      {/* Mobile bottom bar */}
      <MobileBottomBar />
    </div>
  );
}