"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import Link from "next/link";

// Icons
import {
  Search, Bell, Menu, ChevronRight, Command,
  ExternalLink, LogOut, UserRound, ChevronDown,
  PanelLeftClose, Sun, Moon, Pill, Store,
  ShieldCheck, KeyRound, Package, TrendingDown,
  AlertTriangle, ShoppingCart, Warehouse, Hash,
  CircleDollarSign, Landmark, AreaChart,
  ClipboardCheck, BarChart3, History,
} from "lucide-react";

// Local Imports
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { logout } from "@/store/slices/userSlice";
import { fetchNotifications, selectUnreadCount } from "@/store/slices/notificationSlice";
import {
  PHARMACY_DASHBOARD_LINKS,
  PHARMACY_TOP_RIGHT_LINKS,
  PHARMACY_PROFILE_LINKS,
  PHARMACY_SHORTCUTS,
} from "@/constants/pharmacy";
import WelcomePage from "./WelcomePage";

// ── Command search flat list (built from PHARMACY_DASHBOARD_LINKS) ──────────
const PHARMACY_SEARCH_LINKS = PHARMACY_DASHBOARD_LINKS.flatMap((section) =>
  section.links.map((link) => ({ ...link, section: section.title }))
);

// ── Profile dropdown links ───────────────────────────────────────────────────
const PROFILE_MENU = [
  { name: "My Profile",       href: "/pharmacy-store/profile",          icon: <UserRound size={15} /> },
  { name: "Pharmacy Profile", href: "/pharmacy-store/profile/pharmacy", icon: <ClipboardCheck size={15} /> },
  { name: "Store Settings",   href: "/pharmacy-store/store",            icon: <Store size={15} /> },
  { name: "Change Password",  href: "/pharmacy-store/profile/password", icon: <KeyRound size={15} /> },
  { name: "Sessions",         href: "/pharmacy-store/audit/sessions",   icon: <ShieldCheck size={15} /> },
];

// ── Bell animation ───────────────────────────────────────────────────────────
const bellVariant = {
  ring: {
    rotate: [0, 18, -18, 12, -12, 6, -6, 0],
    transition: { duration: 1.4, repeat: Infinity, repeatDelay: 3 },
  },
  idle: { rotate: 0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// ThemeToggle — only light / dark, persisted via next-themes
// ─────────────────────────────────────────────────────────────────────────────
const ThemeToggle = memo(function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="w-10 h-10 rounded-xl border border-base-300 skeleton"
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme === "dark";

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    setTheme(next);
  };

  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.9 }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative w-[52px] h-7 rounded-full border transition-all duration-500 overflow-hidden flex items-center px-1",
        isDark
          ? "bg-primary/30 border-primary/50"
          : "bg-base-300 border-base-300"
      )}
    >
      {/* Track icons */}
      <Sun
        size={12}
        className={cn(
          "absolute left-1.5 transition-all duration-300",
          isDark ? "opacity-30 text-base-content/40" : "opacity-100 text-warning"
        )}
      />
      <Moon
        size={12}
        className={cn(
          "absolute right-1.5 transition-all duration-300",
          isDark ? "opacity-100 text-primary" : "opacity-30 text-base-content/40"
        )}
      />
      {/* Thumb */}
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
        className={cn(
          "w-5 h-5 rounded-full shadow-md z-10",
          isDark
            ? "bg-primary ml-auto"
            : "bg-white border border-base-300 mr-auto"
        )}
      />
    </motion.button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NavItem
// ─────────────────────────────────────────────────────────────────────────────
const NavItem = memo(function NavItem({ link, isActive }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide transition-all duration-200 rounded-lg group",
        isActive
          ? "text-primary bg-primary/10 shadow-sm"
          : "text-base-content/40 hover:text-primary hover:bg-primary/5"
      )}
    >
      <span
        className={cn(
          "shrink-0 transition-all duration-200",
          isActive ? "text-primary scale-110" : "group-hover:scale-110 group-hover:text-primary"
        )}
      >
        {link.icon}
      </span>
      <span className="truncate">{link.name}</span>
      {isActive && (
        <motion.span
          layoutId="pharmacy-nav-pill"
          className="ml-auto w-1 h-1 rounded-full bg-primary"
        />
      )}
    </Link>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SidebarSection — collapsible group
// ─────────────────────────────────────────────────────────────────────────────
const SidebarSection = memo(function SidebarSection({
  section,
  isOpen,
  isSidebarOpen,
  onToggle,
  pathname,
}) {
  const isParentActive = useMemo(
    () => section.links.some((l) => pathname === l.href),
    [section.links, pathname]
  );

  // auto-expand when a child is active
  useEffect(() => {
    if (isParentActive && !isOpen && isSidebarOpen) onToggle(section.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParentActive, isSidebarOpen]);

  return (
    <div className="mb-1">
      <button
        onClick={() => onToggle(section.title)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group",
          isOpen || isParentActive
            ? "bg-primary/12 text-primary"
            : "text-base-content/50 hover:bg-base-300/60 hover:text-base-content"
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "shrink-0 transition-transform duration-200 group-hover:scale-110",
              (isOpen || isParentActive) && "text-primary"
            )}
          >
            {section.icon}
          </span>
          {isSidebarOpen && (
            <span className="text-[10px] font-black uppercase tracking-tight text-left truncate max-w-[130px]">
              {section.title}
            </span>
          )}
        </div>
        {isSidebarOpen && (
          <ChevronDown
            size={13}
            className={cn(
              "shrink-0 transition-transform duration-300",
              isOpen && "rotate-180"
            )}
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isOpen && isSidebarOpen && (
          <motion.div
            key="section-links"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden ml-5 mt-0.5 border-l-2 border-primary/20 pl-1"
          >
            <div className="py-1 space-y-0.5">
              {section.links.map((link, idx) => (
                <NavItem key={idx} link={link} isActive={pathname === link.href} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PharmacyDashboard — main layout
// ─────────────────────────────────────────────────────────────────────────────
const PharmacyDashboard = ({ children }) => {
  const dispatch   = useDispatch();
  const router     = useRouter();
  const pathname   = usePathname();

  const { user }    = useSelector((state) => state.user);
  const unreadCount = useSelector(selectUnreadCount);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus,     setOpenMenus]     = useState({});
  const [searchQuery,   setSearchQuery]   = useState("");
  const [isSearchOpen,  setIsSearchOpen]  = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // init
  useEffect(() => {
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    if (user) dispatch(fetchNotifications());
  }, [user, dispatch]);

  // keyboard ⌘K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((p) => !p);
      }
      if (e.key === "Escape") setIsSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push("/");
  }, [dispatch, router]);

  const toggleMenu = useCallback((title) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  const pharmacyAvatar = useMemo(
    () => user?.avatar || "https://api.dicebear.com/7.x/shapes/svg?seed=pharmacy&backgroundColor=00897b",
    [user]
  );

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return PHARMACY_SEARCH_LINKS.slice(0, 12);
    const q = searchQuery.toLowerCase();
    return PHARMACY_SEARCH_LINKS.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.section.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [searchQuery]);

  // Check if we are on the root dashboard route to render the WelcomePage
  const isWelcomeRoute = useMemo(
    () => ["/pharmacy-store", "/pharmacy-store/", "/pharmacy/dashboard"].includes(pathname),
    [pathname]
  );

  // Guard — only pharmacy role
  if (user && user.role !== "pharmacy") {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-base-100 p-8 text-center">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-error/10 p-10 rounded-3xl border border-error/20 max-w-sm"
        >
          <Pill size={52} className="text-error mx-auto mb-5" />
          <h1 className="text-base font-black uppercase tracking-widest text-error">
            Pharmacy Access Only
          </h1>
          <p className="text-xs text-base-content/50 mt-2">
            This portal is restricted to pharmacy staff.
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="mt-6 border-error/40 text-error hover:bg-error/10"
          >
            Return Home
          </Button>
        </motion.div>
      </div>
    );
  }

  // Current page label
  const pageLabel = isWelcomeRoute
    ? "Welcome"
    : pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Dashboard";

  return (
    // Apply pharmacy theme wrapper — picks up [data-theme="pharmacy"] CSS vars
    <div data-theme="pharmacy" className="min-h-screen bg-base-100 text-base-content selection:bg-primary/25">

      {/* Mobile backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen border-r border-base-300 transition-all duration-500 ease-in-out flex flex-col",
          // pharmacy mint sidebar tint
          "bg-base-200",
          isSidebarOpen
            ? "w-64 translate-x-0"
            : "w-0 -translate-x-full lg:w-[72px] lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-[68px] border-b border-base-300 shrink-0">
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                key="logo"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2.5"
              >
                {/* Pill icon mark */}
                <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md">
                  <Pill size={16} className="text-primary-content" />
                </div>
                <div>
                  <Link href="/pharmacy-store/dashboard">
                    <span className="font-black text-sm tracking-tight text-base-content">
                      LIKESON
                    </span>
                    <span className="text-primary font-black text-sm"> Rx</span>
                  </Link>
                  <p className="text-[9px] font-bold text-base-content/30 uppercase tracking-widest -mt-0.5">
                    Pharmacy Portal
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* When collapsed — just show pill icon */}
          {!isSidebarOpen && (
            <div className="hidden lg:flex w-full justify-center">
              <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-md">
                <Pill size={16} className="text-primary-content" />
              </div>
            </div>
          )}

          <button
            onClick={() => setIsSidebarOpen((p) => !p)}
            aria-label="Toggle sidebar"
            className={cn(
              "p-2 rounded-xl hover:bg-primary/10 hover:text-primary transition-all text-base-content/40",
              !isSidebarOpen && "hidden lg:flex"
            )}
          >
            {isSidebarOpen ? <PanelLeftClose size={17} /> : <Menu size={17} />}
          </button>
        </div>

        {/* Store badge */}
        {isSidebarOpen && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Store size={14} className="text-primary" />
            </div>
            <div className="overflow-hidden">
              <p className="text-[10px] font-black text-base-content truncate">
                {user?.storeName || "Main Store"}
              </p>
              <p className="text-[9px] text-primary font-bold uppercase tracking-wider">
                Active · Open
              </p>
            </div>
            {/* green status dot */}
            <span className="ml-auto w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 custom-scrollbar">
          {PHARMACY_DASHBOARD_LINKS.map((section, idx) => (
            <SidebarSection
              key={idx}
              section={section}
              isOpen={!!openMenus[section.title]}
              isSidebarOpen={isSidebarOpen}
              onToggle={toggleMenu}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* Bottom quick stats strip */}
        {isSidebarOpen && (
          <div className="mx-3 mb-3 p-3 rounded-xl bg-base-300/60 border border-base-300 grid grid-cols-3 gap-2">
            {[
              { label: "Low Stock",  icon: <TrendingDown size={13} />, href: "/pharmacy-store/inventory/low-stock",    color: "text-error"   },
              { label: "Expiring",   icon: <AlertTriangle size={13} />, href: "/pharmacy-store/inventory/expiry-alerts", color: "text-warning" },
              { label: "Orders",     icon: <ShoppingCart size={13} />,  href: "/pharmacy-store/orders",                  color: "text-primary" },
            ].map((s, i) => (
              <Link
                key={i}
                href={s.href}
                className="flex flex-col items-center gap-1 py-2 rounded-lg hover:bg-primary/8 transition-all group"
              >
                <span className={cn("transition-transform group-hover:scale-110", s.color)}>
                  {s.icon}
                </span>
                <span className="text-[8px] font-black uppercase text-base-content/40 text-center leading-none">
                  {s.label}
                </span>
              </Link>
            ))}
          </div>
        )}
      </aside>

      {/* ── Main viewport ───────────────────────────────────────────────── */}
      <main
        className={cn(
          "transition-all duration-500 min-h-screen flex flex-col",
          isSidebarOpen ? "lg:ml-64" : "lg:ml-[72px]"
        )}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 flex h-[68px] w-full items-center justify-between border-b border-base-300 bg-base-100/80 backdrop-blur-xl px-5 lg:px-8 shrink-0">

          {/* Left */}
          <div className="flex items-center gap-4">
            {/* Hamburger when sidebar collapsed */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={cn(
                "p-2 rounded-xl hover:bg-base-200 text-base-content/50 hover:text-primary transition-all",
                isSidebarOpen && "hidden"
              )}
              aria-label="Open sidebar"
            >
              <Menu size={19} />
            </button>

            {/* Top quick links — xl only */}
            <div className="hidden xl:flex items-center gap-5">
              {PHARMACY_TOP_RIGHT_LINKS.map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-base-content/35 hover:text-primary transition-all"
                >
                  {item.icon} {item.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Search trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2.5 px-3.5 py-2 bg-base-200/70 border border-base-300 rounded-xl text-base-content/35 hover:border-primary/40 hover:text-primary transition-all group"
            >
              <Search size={15} className="group-hover:text-primary transition-colors" />
              <span className="hidden md:flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
                Search
                <kbd className="px-1.5 py-0.5 rounded-md bg-base-300 text-[8px] font-black text-base-content/30">
                  ⌘K
                </kbd>
              </span>
            </button>

            {/* Theme toggle (light / dark only) */}
            <ThemeToggle />

            {/* Notifications */}
            <Link href="/pharmacy-store/notifications">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.93 }}
                className="relative p-2.5 rounded-xl border border-base-300 text-base-content/50 hover:bg-primary/8 hover:text-primary hover:border-primary/30 transition-all"
              >
                <motion.span
                  variants={bellVariant}
                  animate={unreadCount > 0 ? "ring" : "idle"}
                  className="block"
                >
                  <Bell size={18} />
                </motion.span>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error border-2 border-base-100 animate-pulse" />
                )}
              </motion.button>
            </Link>

            {/* State-Controlled Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="w-9 h-9 rounded-xl p-[2px] cursor-pointer shadow-md transition-transform hover:scale-105 bg-gradient-to-tr from-primary to-secondary block focus:outline-none"
                aria-label="Toggle profile menu"
              >
                <img
                  src={pharmacyAvatar}
                  alt="Pharmacy user"
                  className="w-full h-full rounded-[10px] object-cover bg-base-300"
                />
              </button>

              {/* Click outside backdrop for mobile closing */}
              {isProfileOpen && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsProfileOpen(false)} 
                />
              )}

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full pt-3 z-50 origin-top-right"
                  >
                    <div className="w-60 bg-base-200 border border-base-300 rounded-2xl shadow-2xl p-2 backdrop-blur-2xl">
                      {/* User info */}
                      <div className="px-4 py-3 mb-1.5 bg-primary/6 rounded-xl border border-primary/10">
                        <p className="text-xs font-black tracking-tight text-base-content truncate">
                          {user?.name || "Pharmacist"}
                        </p>
                        <p className="text-[9px] font-black text-primary uppercase tracking-[0.18em] mt-0.5">
                          Pharmacy Staff
                        </p>
                      </div>
                      {/* Links */}
                      {PROFILE_MENU.map((pl, pi) => (
                        <Link
                          key={pi}
                          href={pl.href}
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-3 px-3.5 py-2.5 text-[10px] font-bold uppercase text-base-content/55 hover:bg-base-100 hover:text-primary rounded-xl transition-all"
                        >
                          <span className="text-base-content/40">{pl.icon}</span>
                          {pl.name}
                        </Link>
                      ))}
                      {/* Logout */}
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 text-[10px] font-black text-error border-t border-base-300 mt-1.5 pt-3 rounded-xl hover:bg-error/8 uppercase tracking-widest transition-all"
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ── Page body ───────────────────────────────────────────────── */}
        <div className="flex-1 w-full max-w-[1700px] mx-auto px-4 py-5">

          {/* Breadcrumb */}
          <nav className="mb-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-base-content/25">
            <Link href="/pharmacy-store/dashboard" className="hover:text-primary transition-colors">
              Pharmacy
            </Link>
            <ChevronRight size={11} />
            {!isWelcomeRoute && pathname.split("/").filter(Boolean).length > 2 && (
              <>
                <Link href={`/${pathname.split("/")[1]}/${pathname.split("/")[2]}`} className="hover:text-primary transition-colors hidden sm:inline">
                  {pathname.split("/").filter(Boolean).slice(-2, -1)[0]?.replace(/-/g, " ") || ""}
                </Link>
                <ChevronRight size={11} className="hidden sm:inline" />
              </>
            )}
            <span className="text-primary capitalize">{pageLabel}</span>
          </nav>

          {/* Content card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="relative rounded-3xl border border-base-300 bg-base-200/35 min-h-[120vh] p-5 shadow-inner overflow-hidden backdrop-blur-sm"
          >
            {/* Decorative pharmacy cross watermark */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-6 right-8 opacity-[0.03] select-none"
              style={{ fontSize: "160px", lineHeight: 1 }}
            >
              ✚
            </div>
            {/* Mint glow */}
            <div
              aria-hidden="true"
              className="absolute top-0 right-0 w-full h-full bg-primary/5 blur-[120px] rounded-full pointer-events-none"
            />
            
            {/* Dynamic Content Rendering */}
            {isWelcomeRoute ? <WelcomePage /> : children}
            
          </motion.div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <footer className="px-4 lg:px-8 pb-6 pt-2 shrink-0">
          <div className="flex flex-col xl:flex-row items-center justify-between gap-4 px-6 py-4 border border-base-300 rounded-2xl bg-base-200/50">
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/12 flex items-center justify-center text-primary">
                <Pill size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-base-content/55">
                  Likeson Rx Portal
                </p>
                <p className="text-[9px] font-bold text-base-content/25 uppercase">
                  &copy; {new Date().getFullYear()} Likeson Pharmaceuticals
                </p>
              </div>
            </div>

            {/* Quick footer links */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full xl:w-auto">
              {[
                { name: "Orders",     icon: <ShoppingCart size={16} />,  href: "/pharmacy-store/orders"                  },
                { name: "Inventory",  icon: <Warehouse size={16} />,     href: "/pharmacy-store/medicines"               },
                { name: "Analytics",  icon: <AreaChart size={16} />,     href: "/pharmacy-store/analytics/overview"      },
                { name: "Financials", icon: <CircleDollarSign size={16} />, href: "/pharmacy-store/financials/daily"  },
              ].map((item, idx) => (
                <Link
                  key={idx}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 bg-base-100/60 border border-base-300 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <span className="text-primary group-hover:scale-110 transition-transform">
                    {item.icon}
                  </span>
                  <span className="text-[9px] font-black text-base-content/40 group-hover:text-base-content uppercase tracking-widest">
                    {item.name}
                  </span>
                </Link>
              ))}
            </div>

            {/* Shortcuts hint */}
            <div className="hidden 2xl:flex flex-col gap-1">
              {PHARMACY_SHORTCUTS.map((sc, i) => (
                <div key={i} className="flex items-center justify-between gap-6">
                  <span className="text-[9px] text-base-content/30 uppercase font-bold tracking-widest">
                    {sc.name}
                  </span>
                  <kbd className="text-[8px] font-black text-base-content/25 bg-base-300 px-2 py-0.5 rounded-md">
                    {sc.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {/* ── Command / Search overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] px-4">
            {/* Backdrop */}
            <motion.div
              key="search-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Panel */}
            <motion.div
              key="search-panel"
              initial={{ opacity: 0, y: -18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-xl bg-base-200 border border-base-300 rounded-3xl shadow-[0_0_60px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center gap-4 px-6 py-5 border-b border-base-300 bg-base-100/60">
                <Search size={20} className="text-primary shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search pharmacy portal..."
                  className="w-full bg-transparent border-none outline-none text-base-content text-sm font-semibold placeholder:text-base-content/25"
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[9px] font-black bg-base-300 px-2.5 py-1 rounded-lg text-base-content/40 hover:text-base-content transition-colors shrink-0"
                >
                  ESC
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[52vh] overflow-y-auto p-4 custom-scrollbar">
                {searchResults.length === 0 ? (
                  <p className="text-center text-[11px] text-base-content/30 uppercase font-bold py-8">
                    No results found
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {/* Group by section */}
                    {Array.from(new Set(searchResults.map((r) => r.section))).map((sectionTitle) => (
                      <div key={sectionTitle} className="mb-3">
                        <p className="text-[9px] font-black text-primary/70 uppercase tracking-[0.25em] px-3 mb-1.5">
                          {sectionTitle}
                        </p>
                        {searchResults
                          .filter((r) => r.section === sectionTitle)
                          .map((item, idx) => (
                            <Link
                              key={idx}
                              href={item.href}
                              onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}
                              className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-primary/8 group transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-base-content/30 group-hover:text-primary transition-colors">
                                  {item.icon}
                                </span>
                                <span className="text-[11px] font-bold text-base-content/65 group-hover:text-base-content uppercase tracking-tight">
                                  {item.name}
                                </span>
                              </div>
                              <ExternalLink
                                size={12}
                                className="opacity-0 group-hover:opacity-100 text-primary transition-all"
                              />
                            </Link>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer hint */}
              <div className="px-6 py-3 border-t border-base-300 bg-base-100/40 flex items-center justify-between">
                <span className="text-[9px] text-base-content/25 font-bold uppercase tracking-widest">
                  {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-base-content/25 font-bold uppercase">
                    Navigate with
                  </span>
                  <kbd className="text-[8px] font-black text-base-content/25 bg-base-300 px-1.5 py-0.5 rounded">↑↓</kbd>
                  <kbd className="text-[8px] font-black text-base-content/25 bg-base-300 px-1.5 py-0.5 rounded">↵</kbd>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(PharmacyDashboard);