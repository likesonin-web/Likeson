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
  Terminal, Stethoscope, HeartPulse, Activity,
  PanelLeftClose, Sun, Moon, Monitor,
  Wifi, WifiOff, CalendarCheck, Hospital,
  AreaChart, Clock, ShieldCheck, IndianRupee,
} from "lucide-react";

// Local Imports
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { logout } from "@/store/slices/userSlice";
import { fetchNotifications, selectUnreadCount } from "@/store/slices/notificationSlice";
import {
  DOCTOR_DASHBOARD_LINKS,
  DOCTOR_TOP_RIGHT_LINKS,
  DOCTOR_SEARCH_LINKS,
  DOCTOR_PROFILE_LINKS,
} from "../../constants/doctor";
import WelcomeDoctorPage from "@/app/doctor/WelcomeDoctorPage"; 
import { fetchPartnerWallet } from "@/store/slices/partnerWalletSlice";
// ── Constants ──────────────────────────────────────────────────────────────

const bellRingingVariant = {
  ring: {
    rotate: [0, 15, -15, 10, -10, 5, -5, 0],
    transition: { duration: 1.5, repeat: Infinity, repeatDelay: 2 },
  },
  idle: { rotate: 0 },
};

// ── Pulse dot for online/offline indicator ─────────────────────────────────
const OnlineBadge = memo(function OnlineBadge({ isOnline }) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border transition-all duration-300",
        isOnline
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-base-300/50 border-base-300 text-base-content/30"
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isOnline ? "bg-primary animate-pulse" : "bg-base-content/20"
        )}
      />
      {isOnline ? "Online" : "Offline"}
    </div>
  );
});

// ── ThemeToggle ────────────────────────────────────────────────────────────
const ThemeToggle = memo(function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="w-10 h-10 rounded-md border border-base-300 skeleton"
        aria-hidden="true"
      />
    );
  }

  const cycle = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const Icon =
    theme === "system" ? Monitor : resolvedTheme === "dark" ? Moon : Sun;

  const label =
    theme === "system"
      ? "System theme — click for Light"
      : theme === "light"
      ? "Light theme — click for Dark"
      : "Dark theme — click for System";

  return (
    <button
      onClick={cycle}
      aria-label={label}
      title={label}
      className="p-2.5 rounded-md border border-base-300 text-base-content/50 hover:bg-primary/10 hover:text-primary transition-all duration-200"
    >
      <Icon size={18} />
    </button>
  );
});

// ── NavItem ────────────────────────────────────────────────────────────────
const NavItem = memo(function NavItem({ link, isActive }) {
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-all duration-200 rounded-md whitespace-nowrap overflow-hidden",
        isActive
          ? "text-primary bg-primary/10 shadow-sm border-l-2 border-primary"
          : "text-base-content/40 hover:text-primary hover:bg-primary/10 border-l-2 border-transparent"
      )}
    >
      <span
        className={cn(
          "transition-transform duration-200 shrink-0",
          isActive && "scale-110 text-primary"
        )}
      >
        {link.icon}
      </span>
      {link.name}
    </Link>
  );
});

// ── SidebarSection ─────────────────────────────────────────────────────────
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
    <div className="mb-1.5">
      <button
        onClick={() => onToggle(section.title)}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-md transition-all group",
          isOpen || isParentActive
            ? "bg-primary/10 text-primary"
            : "text-base-content/50 hover:bg-base-300/60 hover:text-base-content"
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <span
            className={cn(
              "shrink-0 transition-transform group-hover:scale-110",
              (isOpen || isParentActive) ? "text-primary" : "text-base-content/30"
            )}
          >
            {section.icons}
          </span>
          {isSidebarOpen && (
            <span className="text-xs font-semibold whitespace-nowrap overflow-hidden">
              {section.title}
            </span>
          )}
        </div>
        {isSidebarOpen && (
          <ChevronDown
            size={13}
            className={cn(
              "transition-transform duration-300 text-base-content/30 shrink-0",
              isOpen && "rotate-180 text-primary"
            )}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && isSidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "circOut" }}
            onAnimationComplete={() => {
              const el = document.getElementById(`section-${section.title}`);
              if (el) el.style.overflow = "visible";
            }}
            id={`section-${section.title}`}
            className="overflow-hidden ml-4 mt-1 pl-2 border-l border-primary/20"
          >
            <div className="flex flex-col gap-0.5 py-1">
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

// ── Main Component ─────────────────────────────────────────────────────────
const DoctorDashboard = ({ children }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();

const { user } = useSelector((state) => state.user);
  const unreadCount = useSelector(selectUnreadCount);
  const { wallet } = useSelector((state) => state.partnerWallet);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Mock online status — replace with real selector
  const isOnline = user?.isOnline ?? true;

  const isWelcomeRoute = useMemo(
    () => ["/", "/doctor", "/doctor/"].includes(pathname),
    [pathname]
  );

  const breadcrumbLabel = isWelcomeRoute
    ? "Welcome"
    : pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Dashboard";

useEffect(() => {
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    if (user) {
      dispatch(fetchNotifications());
      dispatch(fetchPartnerWallet());
    }
  }, [user, dispatch]);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") setIsSearchOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push("/");
  }, [dispatch, router]);

  const toggleMenu = useCallback((title) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  const doctorAvatar = useMemo(
    () =>
      user?.avatar ||
      "https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_48%20AM.png?updatedAt=1770615250119",
    [user]
  );

  // Auth guard — only 'doctor' role
  if (user?.role !== "doctor") {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-base-100 p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-error/10 p-8 rounded-mdl border border-error/20"
        >
          <Terminal size={48} className="text-error mx-auto mb-4" />
          <h1 className=" font-bold uppercase tracking-widest text-error">
            Access Denied
          </h1>
          <p className="text-[11px] text-base-content/60 mt-2">
            This portal is restricted to verified doctors only.
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="mt-6 border-error/50 text-error hover:bg-error/10"
          >
            Return Home
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div data-theme="doctor" className="min-h-screen bg-base-100 text-base-content selection:bg-primary/20">
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-bold/60 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-[100dvh] bg-base-200 border-r border-base-300 transition-all duration-300 ease-in-out flex flex-col",
          isSidebarOpen
            ? "translate-x-0 w-64"
            : "-translate-x-full w-64 lg:translate-x-0 lg:w-20"
        )}
      >
        {/* 1. Sidebar Header: Logo + Collapse Button */}
        <div className="p-5 flex items-center justify-between h-20 border-b border-base-300 shrink-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2.5 whitespace-nowrap"
              >
                <div className="w-8 h-8 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                  <Stethoscope size={16} className="text-primary" />
                </div>
                <div>
                  <Link
                    href="/doctor/dashboard"
                    className="font-bold text-sm tracking-tight hover:text-primary transition-colors block leading-none"
                  >
                    LIKESON
                    <span className="text-primary">.in</span>
                  </Link>
                  <span className="text-[9px] font-bold text-primary/60 uppercase tracking-widest">
                    Doctor Portal
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md bg-base-300/50 hover:text-primary hover:bg-primary/10 transition-all shrink-0"
            aria-label="Toggle Sidebar"
          >
            {isSidebarOpen ? <PanelLeftClose size={17} /> : <Menu size={17} />}
          </button>
        </div>

        {/* 2. Scrollable Content Wrapper */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Doctor Mini Profile Card */}
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-3 mt-4 shrink-0 overflow-hidden"
              >
                <div className="p-3.5 rounded-md bg-primary/5 border border-primary/15">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <img
                        src={doctorAvatar}
                        alt="Doctor"
                        className="w-10 h-10 rounded-md object-cover bg-base-300 border-2 border-primary/30"
                      />
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-base-200",
                          isOnline ? "bg-primary" : "bg-base-300"
                        )}
                      />
                    </div>
                    <div className="min-w-0 overflow-hidden whitespace-nowrap">
                      <p className="text-[11px] font-bold truncate text-base-content">
                        Dr. {user?.name || "Doctor"}
                      </p>
                      <p className="text-[9px] font-bold text-primary/70 uppercase tracking-widest truncate">
                        {user?.specialization || "Specialist"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 w-fit px-2">
                    <OnlineBadge isOnline={isOnline} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Links - Scrollable area */}
          <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 custom-scrollbar mt-2">
            {DOCTOR_DASHBOARD_LINKS.map((section, idx) => (
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
        </div>

        {/* 3. Sidebar Footer: Sign Out Button */}
        {isSidebarOpen && (
          <div className="p-3 border-t border-base-300 bg-base-200 shrink-0 pb-[env(safe-area-inset-bottom)] overflow-hidden">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold text-error/70 hover:text-error hover:bg-error/5 rounded-md uppercase tracking-widest transition-all whitespace-nowrap"
            >
              <LogOut size={15} className="shrink-0" />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* ── Main viewport ───────────────────────────────────────────────── */}
      <main
        className={cn(
          "transition-all duration-300 ease-in-out flex flex-col min-h-screen",
          isSidebarOpen ? "lg:ml-64" : "lg:ml-20"
        )}
      >
        {/* ── Global header ──────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 flex h-18 w-full items-center justify-between border-b border-base-300 bg-base-100/80 backdrop-blur-xl px-5 lg:px-8">
          {/* Left */}
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-base-200 lg:hidden rounded-md transition-colors"
                aria-label="Open Sidebar"
              >
                <Menu size={20} />
              </button>
            )}

            {/* Top-right quick links (shown in header left on desktop) */}
            <div className="hidden xl:flex items-center gap-5">
              {DOCTOR_TOP_RIGHT_LINKS.map((item, i) => (
                <div key={i} className="group relative">
                  <button className="flex items-center gap-2 text-[10px] font-bold text-base-content/40 hover:text-primary transition-all uppercase tracking-widest">
                    <span className="text-primary/60">{item.icon}</span>
                    {item.name}
                  </button>
                  {item.links && (
                    <div className="absolute left-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                      <div className="w-52 bg-base-200 border border-base-300 p-2 rounded-md shadow-2xl">
                        {item.links.map((sub, si) => (
                          <Link
                            key={si}
                            href={sub.href}
                            className="flex items-center gap-3 p-3 text-[10px] font-bold uppercase text-base-content/50 hover:bg-primary/10 hover:text-primary rounded-md transition-all"
                          >
                            <span className="text-primary/60">{sub.icon}</span>
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
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Command search trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center h-10 gap-3 px-3 py-2 bg-base-200/60 border border-base-300 rounded-md text-base-content/40 hover:border-primary/40 hover:bg-primary/10 transition-all group"
            >
              <Search
                size={15}
                className="group-hover:text-primary transition-colors"
              />
              <span className="text-[9px] font-bold uppercase tracking-widest hidden md:inline">
                Search <span className="ml-1.5 opacity-30">⌘K</span>
              </span>
            </button>

            <ThemeToggle />

{/* Partner Wallet */}
            <Link href="/partner/wallet">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-1.5 px-3 py-2 h-10 rounded-md border text-[10px] font-bold uppercase tracking-widest transition-all bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
              >
                <IndianRupee size={15} strokeWidth={2.5} />
                <span>
                  {wallet
                    ? `₹${wallet.availableBalance?.toLocaleString("en-IN") ?? 0}`
                    : "Wallet"}
                </span>
              </motion.button>
            </Link>

            {/* Online/Offline quick toggle */}
            <button
              className={cn(
                "hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-md border text-[9px] font-bold uppercase tracking-widest transition-all",
                isOnline
                  ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                  : "bg-base-300/50 border-base-300 text-base-content/30 hover:bg-base-300"
              )}
            >
              {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              {isOnline ? "Online" : "Offline"}
            </button>

            {/* Notifications */}
            <Link href="/doctor/notifications">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="relative"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-md text-base-content/60 hover:bg-base-200 hover:text-primary"
                >
                  <motion.div
                    variants={bellRingingVariant}
                    animate={unreadCount > 0 ? "ring" : "idle"}
                  >
                    <Bell size={19} />
                  </motion.div>
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-base-100 animate-pulse" />
                  )}
                </Button>
              </motion.div>
            </Link>

            {/* Profile dropdown */}
            <div className="group relative">
              <div className="w-10 h-10 rounded-md bg-gradient-to-tr from-primary to-secondary p-[2px] cursor-pointer shadow-lg transition-transform hover:scale-105">
                <img
                  src={doctorAvatar}
                  alt="Profile"
                  className="w-full h-full rounded-md object-cover bg-base-300"
                />
              </div>

              <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                <div className="w-64 bg-base-200 border border-base-300 rounded-md shadow-2xl p-2 backdrop-blur-2xl">
                  {/* Header */}
                  <div className="px-4 py-4 border-b border-base-300 mb-2 bg-primary/5 rounded-md">
                    <div className="flex items-center gap-2.5 mb-2">
                      <img
                        src={doctorAvatar}
                        alt=""
                        className="w-9 h-9 rounded-md object-cover bg-base-300"
                      />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-tight truncate">
                          Dr. {user?.name || "Doctor"}
                        </p>
                        <p className="text-[9px] text-primary font-bold uppercase mt-0.5 tracking-widest">
                          Doctor Portal
                        </p>
                      </div>
                    </div>
                    <OnlineBadge isOnline={isOnline} />
                  </div>

                  {DOCTOR_PROFILE_LINKS.map((pl, pi) => (
                    <Link
                      key={pi}
                      href={pl.href}
                      className="flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold uppercase text-base-content/60 hover:bg-base-100 hover:text-primary rounded-md transition-all"
                    >
                      <span className="text-primary/50">{pl.icon}</span>
                      {pl.name}
                    </Link>
                  ))}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[11px] font-bold text-error border-t border-base-300 mt-2 rounded-md hover:bg-error/10 uppercase tracking-widest"
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Page Content ────────────────────────────────────────────────── */}
        <section className="flex-1 w-full max-w-[1600px] mx-auto p-2">
          {/* Breadcrumbs */}
          <div className="mb-5 flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-widest text-base-content/20">
            <Link
              href="/doctor/dashboard"
              className="hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <Stethoscope size={11} />
              Doctor Portal
            </Link>
            <ChevronRight size={10} />
            <span className="text-primary">
              {breadcrumbLabel}
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="md:rounded-md rounded-md border border-base-300 bg-base-200/40 min-h-[75vh] shadow-inner relative overflow-hidden backdrop-blur-sm"
          >
            {/* Decorative medical-teal glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[130px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/5 blur-[100px] rounded-full pointer-events-none" />

            {/* ECG decorative line — top right */}
            <svg
              className="absolute top-6 right-6 opacity-[0.08] pointer-events-none text-primary"
              width="200"
              height="40"
              viewBox="0 0 200 40"
              fill="none"
            >
              <polyline
                points="0,20 30,20 40,5 50,35 60,5 70,35 80,20 120,20 130,8 140,32 150,20 200,20"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Render Welcome Page for root paths, otherwise render children */}
            {isWelcomeRoute ? <WelcomeDoctorPage /> : children}
            
          </motion.div>
        </section>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer className="p-4 lg:p-6 mt-auto">
          <div className="flex flex-col xl:flex-row items-center justify-between gap-4 p-5 border border-base-300 rounded-md bg-base-200/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <Stethoscope size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-base-content/60">
                  Likeson Doctor Portal
                </p>
                <p className="text-[9px] font-bold text-base-content/20 uppercase">
                  v3.4.0 — Clinical Hub
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full xl:w-auto">
              {[
                {
                  name: "Analytics",
                  icon: <AreaChart size={17} />,
                  href: "/doctor/analytics",
                },
                {
                  name: "My Hospitals",
                  icon: <Hospital size={17} />,
                  href: "/doctor/hospitals",
                },
                {
                  name: "Availability",
                  icon: <Clock size={17} />,
                  href: "/doctor/availability",
                },
                {
                  name: "KYC Status",
                  icon: <ShieldCheck size={17} />,
                  href: "/doctor/kyc",
                },
              ].map((sc, idx) => (
                <Link
                  key={idx}
                  href={sc.href}
                  className="flex items-center gap-3 px-4 py-3.5 bg-base-100/50 border border-base-300 rounded-md hover:border-primary/40 hover:bg-primary/10 transition-all group"
                >
                  <span className="text-primary/60 group-hover:text-primary group-hover:scale-110 transition-all">
                    {sc.icon}
                  </span>
                  <span className="text-[10px] font-bold text-base-content/40 group-hover:text-base-content uppercase tracking-widest">
                    {sc.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {/* ── Command / Search Overlay ───────────────────────────────────── */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-bold/80 backdrop-blur-lg"
            />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="relative w-full max-w-2xl bg-base-200 border border-base-300 rounded-md shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              {/* Search input */}
              <div className="p-6 lg:p-8 border-b border-base-300 flex items-center gap-5 bg-base-100/60">
                <Search className="text-primary shrink-0" size={22} />
                <input
                  autoFocus
                  placeholder="Search doctor portal..."
                  className="w-full bg-transparent border-none outline-none text-base-content text-base font-bold tracking-tight placeholder:text-base-content/20 uppercase"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[10px] font-bold bg-base-300 px-3 py-1 rounded-md uppercase shrink-0 hover:bg-base-content/10 transition-colors"
                >
                  Esc
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[50vh] overflow-y-auto p-5 lg:p-6 space-y-7 custom-scrollbar">
                {Object.entries(DOCTOR_SEARCH_LINKS).map(
                  ([key, sectionItems]) => {
                    const filtered = sectionItems?.filter((item) =>
                      item.name
                        .toLowerCase()
                        .includes(searchQuery.toLowerCase())
                    );
                    if (!filtered || filtered.length === 0) return null;

                    return (
                      <div key={key}>
                        <h3 className="text-[10px] font-bold text-primary tracking-[0.3em] mb-3 uppercase px-2">
                          {key === "0" ? "Recently Visited" : "Quick Actions"}
                        </h3>
                        <div className="space-y-1">
                          {filtered.map((item, iIdx) => (
                            <Link
                              key={iIdx}
                              href={item.href}
                              onClick={() => setIsSearchOpen(false)}
                              className="flex items-center justify-between p-3.5 rounded-md hover:bg-primary/10 group transition-all"
                            >
                              <div className="flex items-center gap-3.5">
                                <span className="text-base-content/30 group-hover:text-primary transition-colors">
                                  {item.icon}
                                </span>
                                <span className="text-[11px] font-bold text-base-content/70 group-hover:text-base-content uppercase tracking-tight">
                                  {item.name}
                                </span>
                              </div>
                              <ExternalLink
                                size={13}
                                className="opacity-0 group-hover:opacity-100 text-primary transition-all"
                              />
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {/* Footer hint */}
              <div className="px-6 py-3 border-t border-base-300 flex items-center gap-4 bg-base-100/30">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-base-content/25 uppercase tracking-widest">
                  <kbd className="px-1.5 py-0.5 bg-base-300 rounded-md">
                    ↵
                  </kbd>
                  to navigate
                </div>
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-base-content/25 uppercase tracking-widest">
                  <kbd className="px-1.5 py-0.5 bg-base-300 rounded-md">
                    Esc
                  </kbd>
                  to close
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-[9px] font-bold text-primary/50 uppercase tracking-widest">
                  <Stethoscope size={10} />
                  Doctor Portal
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(DoctorDashboard);