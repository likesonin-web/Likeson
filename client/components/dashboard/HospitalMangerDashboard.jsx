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
import {
  Search,
  Bell,
  Menu,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  LogOut,
  UserRound,
  PanelLeftClose,
  Sun,
  Moon,
  Hospital,
  Shield,
  Activity,
  Settings2,
  KeyRound,
  History,
  LayoutDashboard,
  Stethoscope,
  Users,
  CalendarDays,
  CircleDollarSign,
  MapPin,
  Clock,
  ImageIcon,
  FileText,
  UserCog,
  CheckCircle2,
  Smartphone,
  Search as SearchIcon,
  Building2,
  Siren,
  IndianRupee,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { logout } from "@/store/slices/userSlice";
import { fetchNotifications, selectUnreadCount } from "@/store/slices/notificationSlice";
import {
  HOSPITAL_MANAGER_DASHBOARD_LINKS,
  HOSPITAL_MANAGER_TOP_RIGHT_LINKS,
  HOSPITAL_MANAGER_PROFILE_LINKS,
} from "../../constants/hospitalmangerlinks";
import WelcomeHospitalPage from "@/app/hospital-manager/WelcomeHospitalPage"; 
import { fetchPartnerWallet } from "@/store/slices/partnerWalletSlice";

// ─────────────────────────────────────────────────────────────────────────────
// COMMAND SEARCH INDEX
// Flat map of all navigable links for the command palette
// ─────────────────────────────────────────────────────────────────────────────
const HOSPITAL_SEARCH_INDEX = {
  "Command Centre": [
    { name: "Overview",      href: "/hospital-manager/dashboard",      icon: <LayoutDashboard size={16} /> },
    { name: "Onboarding",    href: "/hospital-manager/onboarding",     icon: <CheckCircle2 size={16} /> },
    { name: "Notifications", href: "/hospital-manager/notifications",  icon: <Bell size={16} /> },
  ],
  "Facility Management": [
    { name: "Hospital Profile",  href: "/hospital-manager/profile",          icon: <Hospital size={16} /> },
    { name: "Location & GPS",    href: "/hospital-manager/location",         icon: <MapPin size={16} /> },
    { name: "Operating Hours",   href: "/hospital-manager/operating-hours",  icon: <Clock size={16} /> },
    { name: "Gallery & Logo",    href: "/hospital-manager/gallery",          icon: <ImageIcon size={16} /> },
    { name: "Legal & Licenses",  href: "/hospital-manager/registration",     icon: <FileText size={16} /> },
  ],
  "Medical Staff": [
    { name: "Linked Doctors",  href: "/hospital-manager/doctors",            icon: <Users size={16} /> },
    { name: "Find & Link",     href: "/hospital-manager/doctors/search",     icon: <SearchIcon size={16} /> },
    { name: "Staff Statistics", href: "/hospital-manager/doctors/stats",     icon: <UserCog size={16} /> },
    { name: "Availability",    href: "/hospital-manager/doctors/availability", icon: <CalendarDays size={16} /> },
  ],
  "Commercials": [
    { name: "Consultation Pricing", href: "/hospital-manager/pricing", icon: <CircleDollarSign size={16} /> },
  ],
  "Settings & Security": [
    { name: "Account Details",     href: "/hospital-manager/settings/account",  icon: <UserRound size={16} /> },
    { name: "Active Sessions",     href: "/hospital-manager/security/sessions", icon: <Smartphone size={16} /> },
    { name: "Security & Password", href: "/hospital-manager/security/password", icon: <KeyRound size={16} /> },
    { name: "System Logs",         href: "/hospital-manager/logs",              icon: <History size={16} /> },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// BELL ANIMATION
// ─────────────────────────────────────────────────────────────────────────────
const bellRingVariant = {
  ring: {
    rotate: [0, 14, -12, 10, -8, 5, -4, 0],
    transition: { duration: 1.4, repeat: Infinity, repeatDelay: 3 },
  },
  idle: { rotate: 0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME TOGGLE  — light / dark only (no system)
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

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92 }}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="p-2.5 rounded-xl border border-base-300 text-base-content/50 hover:bg-primary/8 hover:text-primary hover:border-primary/40 transition-all duration-200"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -30, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 30, scale: 0.7 }}
          transition={{ duration: 0.2 }}
          className="flex"
        >
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// NAV ITEM
// ─────────────────────────────────────────────────────────────────────────────
const NavItem = memo(function NavItem({ link, isActive }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 rounded-lg",
        isActive
          ? "text-primary bg-primary/8 shadow-sm border-l-2 border-primary"
          : "text-base-content/40 hover:text-primary hover:bg-base-200/80 border-l-2 border-transparent"
      )}
    >
      <span className={cn("shrink-0 transition-transform duration-200", isActive && "scale-110 text-primary")}>
        {link.icon}
      </span>
      <span className="truncate">{link.name}</span>
    </Link>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR SECTION
// ─────────────────────────────────────────────────────────────────────────────
const SidebarSection = memo(function SidebarSection({
  section,
  isOpen,
  isSidebarOpen,
  onToggle,
  pathname,
}) {
  const isParentActive = useMemo(
    () => section.links.some((link) => pathname === link.href),
    [section.links, pathname]
  );

  useEffect(() => {
    if (isParentActive && !isOpen && isSidebarOpen) {
      onToggle(section.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParentActive, isSidebarOpen]);

  return (
    <div className="mb-1">
      <button
        onClick={() => onToggle(section.title)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group",
          isOpen || isParentActive
            ? "bg-primary/10 text-primary"
            : "text-base-content/45 hover:bg-base-300/60 hover:text-base-content"
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "shrink-0 transition-transform duration-200 group-hover:scale-110",
              (isOpen || isParentActive) && "text-primary"
            )}
          >
            {section.icons}
          </span>
          {isSidebarOpen && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-left">
              {section.title}
            </span>
          )}
        </div>
        {isSidebarOpen && (
          <ChevronDown
            size={13}
            className={cn("opacity-60 transition-transform duration-300", isOpen && "rotate-180")}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && isSidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden ml-5 mt-0.5  "
          >
            {section.links.map((link, idx) => (
              <NavItem key={idx} link={link} isActive={pathname === link.href} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const HospitalManagerDashboard = ({ children }) => {
  const dispatch  = useDispatch();
  const router    = useRouter();
  const pathname  = usePathname();

  const { user }       = useSelector((state) => state.user);
  const unreadCount    = useSelector(selectUnreadCount);
  const { wallet }     = useSelector((state) => state.partnerWallet);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus,     setOpenMenus]     = useState({});
  const [searchQuery,   setSearchQuery]   = useState("");
  const [isSearchOpen,  setIsSearchOpen]  = useState(false);

  // ── Route checks ───────────────────────────────────────────────────────────
  const isWelcomeRoute = useMemo(
    () => ["/", "/hospital-manager", "/hospital-manager/"].includes(pathname),
    [pathname]
  );

  // NEW: Check if the current route is the support page
  const isSupportRoute = useMemo(
    () => pathname === "/hospital-manager/support",
    [pathname]
  );

  // Collapse sidebar on mobile; fetch notifications on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    if (user) {
      dispatch(fetchNotifications());
      dispatch(fetchPartnerWallet());
    }
  }, [user, dispatch]);

  // ⌘K / Ctrl+K command palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
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

  // Derive page label from pathname
  const pageLabel = useMemo(
    () =>
      isWelcomeRoute
        ? "Welcome"
        : pathname
            .split("/")
            .filter(Boolean)
            .pop()
            ?.replace(/-/g, " ") || "Dashboard",
    [pathname, isWelcomeRoute]
  );

  // Auth guard
  if (user?.role !== "hospital") {
    return (
      <div
        data-theme="hospital"
        className="h-screen w-full flex flex-col items-center justify-center bg-base-100 p-6 text-center"
      >
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="bg-error/10 p-10 rounded-3xl border border-error/20 max-w-sm w-full"
        >
          <Siren size={48} className="text-error mx-auto mb-4" />
          <h1 className="text-base font-black uppercase tracking-widest text-error mb-1">
            Access Restricted
          </h1>
          <p className="text-xs text-base-content/50 mt-2">
            This portal is reserved for authorised hospital managers only.
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="mt-6 border-error/40 text-error hover:bg-error/10"
          >
            Return to Login
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      data-theme="hospital"
      className="min-h-screen bg-base-100 text-base-content selection:bg-primary/20"
    >
      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-base-200 border-r border-base-300 flex flex-col transition-all duration-300 ease-in-out overflow-hidden",
          isSidebarOpen
            ? "w-64 translate-x-0"
            : "w-0 -translate-x-full lg:w-[72px] lg:translate-x-0"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-[68px] px-4 border-b border-base-300 shrink-0">
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                key="logo"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-2.5 overflow-hidden"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-primary" />
                </div>
                <div className="leading-tight">
                  <Link
                    href="/hospital-manager/dashboard"
                    className="text-[13px] font-black tracking-tight hover:text-primary transition-colors block truncate"
                  >
                    MedCore<span className="text-secondary">.io</span>
                  </Link>
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-base-content/30">
                    Hospital Portal
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg hover:bg-base-300/70 hover:text-primary transition-all shrink-0"
            aria-label="Toggle sidebar"
          >
            {isSidebarOpen ? <PanelLeftClose size={17} /> : <Menu size={17} />}
          </button>
        </div>

        {/* Facility badge (collapsed: icon only) */}
        {isSidebarOpen && (
          <div className="mx-3 mt-3 mb-1 px-3 py-2.5 rounded-xl bg-primary/6 border border-primary/15 flex items-center gap-2.5">
            <Hospital size={15} className="text-primary shrink-0" />
            <div className="overflow-hidden">
              <p className="text-[10px] font-black uppercase tracking-wide text-primary truncate">
                {user?.facilityName || "General Hospital"}
              </p>
              <p className="text-[9px] text-base-content/30 font-semibold uppercase truncate">
                {user?.facilityId || "HMGR-0001"}
              </p>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 custom-scrollbar">
          {HOSPITAL_MANAGER_DASHBOARD_LINKS.map((section, idx) => (
            <SidebarSection
              key={idx}
              section={section}
              isOpen={openMenus[section.title]}
              isSidebarOpen={isSidebarOpen}
              onToggle={toggleMenu}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t border-base-300 shrink-0">
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider",
              "text-error/70 hover:bg-error/8 hover:text-error transition-all duration-200"
            )}
          >
            <LogOut size={16} className="shrink-0" />
            {isSidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main viewport ─────────────────────────────────────────────────── */}
      <main
        className={cn(
          "flex flex-col min-h-screen transition-all duration-300",
          isSidebarOpen ? "lg:ml-64" : "lg:ml-[72px]"
        )}
      >
        {/* ── Global header conditionally hidden on support page ───────── */}
        {!isSupportRoute && (
          <header className="sticky top-0 z-40 flex h-[68px] w-full items-center justify-between border-b border-base-300 bg-base-100/80 backdrop-blur-xl shrink-0">

            {/* Left */}
            <div className="flex items-center gap-4">
              {!isSidebarOpen && (
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-2 hover:bg-base-200 rounded-lg transition-colors"
                  aria-label="Open sidebar"
                >
                  <Menu size={19} />
                </button>
              )}

              {/* Quick links (desktop only) */}
              <div className="hidden xl:flex items-center gap-1">
                {HOSPITAL_MANAGER_TOP_RIGHT_LINKS.map((item, i) => (
                  <div key={i} className="group relative">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-base-content/40 hover:text-primary hover:bg-primary/6 transition-all">
                      {item.icon}
                      {item.name}
                      {item.links && <ChevronDown size={11} className="opacity-50" />}
                    </button>
                    {item.links && (
                      <div className="absolute left-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                        <div className="w-52 bg-base-200 border border-base-300 p-1.5 rounded-2xl shadow-xl">
                          {item.links.map((sub, si) => (
                            <Link
                              key={si}
                              href={sub.href}
                              className="flex items-center gap-2.5 px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-base-content/50 hover:bg-primary/8 hover:text-primary rounded-xl transition-all"
                            >
                              {sub.icon}
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 sm:gap-3">

              {/* Command palette trigger */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-base-200/60 border border-base-300 rounded-xl text-base-content/35 hover:border-primary/40 hover:text-primary/60 transition-all group"
              >
                <Search size={14} />
                <span className="text-[9px] font-black uppercase tracking-widest hidden md:inline">
                  Quick Search
                </span>
                <span className="hidden md:inline text-[9px] opacity-30 ml-1">⌘K</span>
              </button>

              {/* Mobile search icon */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="sm:hidden p-2.5 rounded-xl border border-base-300 text-base-content/50 hover:text-primary hover:border-primary/40 transition-all"
                aria-label="Open search"
              >
                <Search size={17} />
              </button>

              {/* Partner Wallet */}
              <Link href="/partner/wallet">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                >
                  <IndianRupee size={15} strokeWidth={2.5} />
                  <span>
                    {wallet
                      ? `₹${wallet.availableBalance?.toLocaleString("en-IN") ?? 0}`
                      : "Wallet"}
                  </span>
                </motion.button>
              </Link>

              {/* Theme toggle */}
              <ThemeToggle />

              {/* Notifications */}
              <Link href="/hospital-manager/notifications">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.94 }}
                  className="relative p-2.5 rounded-xl border border-base-300 text-base-content/50 hover:bg-primary/6 hover:text-primary hover:border-primary/40 transition-all"
                  aria-label="Notifications"
                >
                  <motion.span
                    variants={bellRingVariant}
                    animate={unreadCount > 0 ? "ring" : "idle"}
                    className="flex"
                  >
                    <Bell size={17} />
                  </motion.span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full border-2 border-base-100 animate-pulse" />
                  )}
                </motion.button>
              </Link>

              {/* Profile dropdown */}
              <div className="group relative">
                <motion.div
                  whileHover={{ scale: 1.04 }}
                  className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user?.name || "Manager"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-black text-primary uppercase">
                      {user?.name?.charAt(0) || "H"}
                    </span>
                  )}
                </motion.div>

                {/* Dropdown */}
                <div className="absolute right-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <div className="w-60 bg-base-200 border border-base-300 rounded-2xl shadow-2xl p-2 backdrop-blur-xl">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-base-300 mb-1.5 bg-primary/5 rounded-xl">
                      <p className="text-[11px] font-black uppercase tracking-tight truncate text-base-content">
                        {user?.name || "Hospital Manager"}
                      </p>
                      <p className="text-[9px] text-primary font-black uppercase mt-0.5 tracking-[0.18em]">
                        Facility Administrator
                      </p>
                      {user?.email && (
                        <p className="text-[9px] text-base-content/35 mt-0.5 truncate font-semibold">
                          {user.email}
                        </p>
                      )}
                    </div>

                    {HOSPITAL_MANAGER_PROFILE_LINKS.map((pl, pi) => (
                      <Link
                        key={pi}
                        href={pl.href}
                        className="flex items-center gap-2.5 px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-base-content/55 hover:bg-base-100 hover:text-primary rounded-xl transition-all"
                      >
                        {pl.icon}
                        {pl.name}
                      </Link>
                    ))}

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[10px] font-black uppercase tracking-wider text-error/80 border-t border-base-300 mt-1.5 rounded-xl hover:bg-error/8 hover:text-error transition-all"
                    >
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* ── Page body ────────────────────────────────────────────────── */}
        <section className="flex-1 w-full max-w-[1680px] mx-auto p-4 ">

          {/* Breadcrumbs - Conditionally rendering based on header visibility as well just in case, but left default here */}
          {!isSupportRoute && (
            <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-base-content/25">
              <Link
                href="/hospital-manager/dashboard"
                className="hover:text-primary transition-colors"
              >
                Hospital Portal
              </Link>
              <ChevronRight size={11} />
              <span className="text-primary capitalize">{pageLabel}</span>
            </div>
          )}

          {/* Content wrapper */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="rounded-xl border border-base-300 bg-base-200/35 min-h-[75vh] p-2 shadow-inner relative overflow-hidden"
          >
            {/* Decorative tint */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/4 blur-[130px] rounded-full pointer-events-none" />
            
            <div className="relative z-10">
              {/* Render Welcome Page for root paths, otherwise render children */}
              {isWelcomeRoute ? <WelcomeHospitalPage /> : children}
            </div>
          </motion.div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="px-4 sm:px-6 pb-6 pt-2 shrink-0">
          <div className="flex flex-col xl:flex-row items-center justify-between gap-4 px-5 py-4 border border-base-300 rounded-2xl bg-base-200/40">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Activity size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-base-content/55">
                  MedCore Hospital Management
                </p>
                <p className="text-[9px] font-bold text-base-content/20 uppercase tracking-wider">
                  v2.1.0 · Clinical Operations Suite
                </p>
              </div>
            </div>

            {/* Quick shortcuts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full xl:w-auto">
              {[
                { name: "Doctors",    icon: <Stethoscope size={16} />, href: "/hospital-manager/doctors" },
                { name: "Pricing",    icon: <CircleDollarSign size={16} />, href: "/hospital-manager/pricing" },
                { name: "Security",   icon: <Shield size={16} />,      href: "/hospital-manager/security/password" },
                { name: "System Logs",icon: <History size={16} />,     href: "/hospital-manager/logs" },
              ].map((sc, idx) => (
                <Link
                  key={idx}
                  href={sc.href}
                  className="flex items-center gap-3 px-4 py-3 bg-base-100/50 border border-base-300 rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <span className="text-primary/70 group-hover:text-primary group-hover:scale-110 transition-all">
                    {sc.icon}
                  </span>
                  <span className="text-[9px] font-black text-base-content/35 group-hover:text-base-content uppercase tracking-widest">
                    {sc.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {/* ── Command Palette ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-xl bg-base-200 border border-base-300 rounded-3xl shadow-2xl overflow-hidden"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-base-300 bg-base-100/60">
                <Search size={18} className="text-primary shrink-0" />
                <input
                  autoFocus
                  placeholder="Search facility, doctors, settings..."
                  className="flex-1 bg-transparent border-none outline-none text-sm font-semibold text-base-content placeholder:text-base-content/25"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[9px] font-black bg-base-300/70 px-2.5 py-1 rounded-lg uppercase tracking-wider text-base-content/50"
                >
                  Esc
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[55vh] overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
                {Object.entries(HOSPITAL_SEARCH_INDEX).map(([sectionKey, items]) => {
                  const filtered = items.filter((item) =>
                    item.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (!filtered.length) return null;

                  return (
                    <div key={sectionKey}>
                      <h3 className="text-[9px] font-black text-primary/70 tracking-[0.3em] mb-2 uppercase px-3">
                        {sectionKey}
                      </h3>
                      <div className="space-y-0.5">
                        {filtered.map((item, iIdx) => (
                          <Link
                            key={iIdx}
                            href={item.href}
                            onClick={() => setIsSearchOpen(false)}
                            className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-primary/8 group transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-base-content/30 group-hover:text-primary transition-colors">
                                {item.icon}
                              </span>
                              <span className="text-xs font-semibold text-base-content/65 group-hover:text-base-content capitalize">
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
                    </div>
                  );
                })}

                {/* Empty state */}
                {Object.entries(HOSPITAL_SEARCH_INDEX).every(
                  ([, items]) =>
                    !items.some((i) =>
                      i.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                ) && (
                  <div className="text-center py-10 text-base-content/25">
                    <Search size={28} className="mx-auto mb-3 opacity-30" />
                    <p className="text-xs font-bold uppercase tracking-wider">No results found</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(HospitalManagerDashboard);