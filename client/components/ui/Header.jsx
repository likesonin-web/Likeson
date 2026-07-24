"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  memo,
  Suspense,
} from "react";
import {
  Search,
  Calendar,
  Menu,
  X,
  ChevronRight,
  LogOut,
  Bell,
  ShoppingCart,
  ShieldCheck,
  Pill,
  UserRound,
  Hospital,
  Gem,
  Microscope,
  WalletIcon,
  MapPin,
  Locate,
  Loader2,
  Navigation,
  Pencil,
  User,
  Moon,
  Sun,
  LayoutDashboard,
  Truck,
  FlaskConical,
  Building2,
  HeartPulse,
  BadgeDollarSign,
  UserCog,
  Package,
  Activity,
  Car,
  ClipboardList,
  IndianRupee,
  Droplets,
} from "lucide-react";
import { useSelector, useDispatch } from "react-redux";
import CookieConsent from "@/components/CookieConsent";
import Container from "./Container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import RoleNavLinks from "../RoleNavLinks";
import Marquee from "../Marquee";
// ── Redux slices ─────────────────────────────────────────────────────────────
import {
  fetchNotifications,
  selectUnreadCount,
} from "@/store/slices/notificationSlice";
import { selectCartItems, fetchCart } from "@/store/slices/pharmacyOrderSlice";
import {
  logout,
  getProfile,
  getWallet,
  updateLocationByAddress,
  updateLocationByCoords,
  selectUser,
  selectToken,
  selectWalletBalance,
  selectLoaders,
} from "@/store/slices/userSlice";
import {
  fetchMyWallet as fetchPartnerWallet,
  selectMyWallet as selectPartnerWalletObj,
} from "@/store/slices/accountingSlice";
import { useTheme } from "next-themes";

// ── Lazy-load framer-motion ──────────────────────────────────────────────────
const MotionDiv = dynamic(
  () => import("framer-motion").then((m) => ({ default: m.motion.div })),
  { ssr: false, loading: () => <div /> },
);
const MotionButton = dynamic(
  () => import("framer-motion").then((m) => ({ default: m.motion.button })),
  { ssr: false, loading: () => <button /> },
);
const MotionSpan = dynamic(
  () => import("framer-motion").then((m) => ({ default: m.motion.span })),
  { ssr: false, loading: () => <span /> },
);
const MotionUl = dynamic(
  () => import("framer-motion").then((m) => ({ default: m.motion.ul })),
  { ssr: false, loading: () => <ul /> },
);
const MotionLi = dynamic(
  () => import("framer-motion").then((m) => ({ default: m.motion.li })),
  { ssr: false, loading: () => <li /> },
);
const AnimatePresence = dynamic(
  () => import("framer-motion").then((m) => ({ default: m.AnimatePresence })),
  { ssr: false, loading: () => null },
);

// ── Constants ────────────────────────────────────────────────────────────────
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
const HEADER_HEIGHT_VAR = "--header-height";

// ── Customer nav links ───────────────────────────────────────────────────────
const CUSTOMER_NAV_LINKS = [
  {
    name: "Buy Medicines",
    href: "/pharmacy/buy-medicines",
    icon: Pill,
    accent: "#059669",
    bg: "rgba(5,150,105,0.07)",
    barGradient: "linear-gradient(90deg,#059669,#10b981)",
    pillBg: "rgba(5,150,105,0.12)",
    pillText: "#059669",
    shadowColor: "rgba(5,150,105,0.30)",
    label: "Pharmacy",
  },
  {
    name: "Find Doctors",
    href: "/doctors",
    icon: UserRound,
    accent: "#2563eb",
    bg: "rgba(37,99,235,0.07)",
    barGradient: "linear-gradient(90deg,#2563eb,#60a5fa)",
    pillBg: "rgba(37,99,235,0.12)",
    pillText: "#2563eb",
    shadowColor: "rgba(37,99,235,0.28)",
    label: "Doctors",
  },
  {
    name: "Find Hospitals",
    href: "/hospitals",
    icon: Hospital,
    accent: "#1d4ed8",
    bg: "rgba(29,78,216,0.07)",
    barGradient: "linear-gradient(90deg,#1d4ed8,#3b82f6)",
    pillBg: "rgba(29,78,216,0.12)",
    pillText: "#1d4ed8",
    shadowColor: "rgba(29,78,216,0.28)",
    label: "Hospitals",
  },
  {
    name: "Buy Subscription",
    href: "/subscriptions",
    icon: Gem,
    accent: "#d97706",
    bg: "rgba(217,119,6,0.07)",
    barGradient: "linear-gradient(90deg,#d97706,#f59e0b)",
    pillBg: "rgba(217,119,6,0.12)",
    pillText: "#b45309",
    shadowColor: "rgba(217,119,6,0.28)",
    label: "Subscriptions",
  },
  {
    name: "Top Laboratories",
    href: "/labs",
    icon: Microscope,
    accent: "#7c3aed",
    bg: "rgba(124,58,237,0.07)",
    barGradient: "linear-gradient(90deg,#7c3aed,#a78bfa)",
    pillBg: "rgba(124,58,237,0.12)",
    pillText: "#7c3aed",
    shadowColor: "rgba(124,58,237,0.28)",
    label: "Labs",
  },
  {
    name: "Blood Bank",
    href: "/blood-bank",
    icon: Droplets,
    accent: "#be123c",
    bg: "rgba(190,18,60,0.07)",
    barGradient: "linear-gradient(90deg,#be123c,#f43f5e)",
    pillBg: "rgba(190,18,60,0.12)",
    pillText: "#be123c",
    shadowColor: "rgba(190,18,60,0.28)",
    label: "Blood Bank",
  },
];

const ROLE_PALETTES = {
  superadmin: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Super Admin",
    icon: ShieldCheck,
    dataTheme: "superadmin",
  },
  admin: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Admin",
    icon: UserCog,
    dataTheme: "admin",
  },
  doctor: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Doctor",
    icon: HeartPulse,
    dataTheme: "doctor",
  },
  transportpartner: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Transport Partner",
    icon: Truck,
    dataTheme: "transportpartner",
  },
  driver: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Driver",
    icon: Truck,
    dataTheme: "driver",
  },
  solodriverpartner: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Solo Driver",
    icon: Navigation,
    dataTheme: "solodriverpartner",
  },
  customer: null,
  pharmacy: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Pharmacy",
    icon: Pill,
    dataTheme: "pharmacy",
  },
  care_assistant: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Care Assistant",
    icon: HeartPulse,
    dataTheme: "care-assistant",
  },
  finance: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Finance",
    icon: BadgeDollarSign,
    dataTheme: "finance",
  },
  lab_partner: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Lab Partner",
    icon: FlaskConical,
    dataTheme: "lab",
  },
  hospital: {
    accent: "var(--primary)",
    bg: "color-mix(in srgb, var(--primary) 8%, transparent)",
    barGradient: "linear-gradient(90deg, var(--primary), var(--secondary))",
    pillBg: "color-mix(in srgb, var(--primary) 12%, transparent)",
    pillText: "var(--primary)",
    shadowColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
    label: "Hospital",
    icon: Building2,
    dataTheme: "hospital",
  },
};

const ROLE_BOTTOM_NAV = {
  superadmin: [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Users", href: "/admin/users", icon: UserCog },
    { name: "Reports", href: "/admin/reports", icon: Activity },
    { name: "Finances", href: "/admin/finance", icon: BadgeDollarSign },
  ],
  admin: [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Orders", href: "/admin/orders", icon: Package },
    { name: "Reports", href: "/admin/reports", icon: Activity },
  ],
  doctor: [
    { name: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard },
    { name: "Appointments", href: "/doctor/appointments", icon: Calendar },
    { name: "Patients", href: "/doctor/patients", icon: UserRound },
  ],
  transportpartner: [
    { name: "Dashboard", href: "/transport/dashboard", icon: LayoutDashboard },
    { name: "Fleet", href: "/transport/fleet", icon: Truck },
    { name: "Earnings", href: "/transport/earnings", icon: BadgeDollarSign },
  ],
  driver: [
    { name: "Dashboard", href: "/driver/dashboard", icon: LayoutDashboard },
    { name: "Trips", href: "/driver/trips", icon: Navigation },
    { name: "Earnings", href: "/driver/earnings", icon: BadgeDollarSign },
  ],
  solodriverpartner: [
    { name: "Home", href: "/partner/solo/dashboard", icon: LayoutDashboard },
    { name: "Rides", href: "/partner/solo/stats", icon: Car },
    {
      name: "Compliance",
      href: "/partner/solo/compliance",
      icon: ClipboardList,
    },
    { name: "Earnings", href: "/partner/solo/settlement", icon: IndianRupee },
    { name: "Profile", href: "/partner/solo/profile", icon: UserRound },
  ],
  pharmacy: [
    { name: "Dashboard", href: "/pharmacy/dashboard", icon: LayoutDashboard },
    { name: "Inventory", href: "/pharmacy/inventory", icon: Package },
    { name: "Orders", href: "/pharmacy/orders", icon: ShoppingCart },
  ],
  "care assistant": [
    {
      name: "Dashboard",
      href: "/care-assistant/dashboard",
      icon: LayoutDashboard,
    },
    { name: "Patients", href: "/care-assistant/patients", icon: UserRound },
    { name: "Schedule", href: "/care-assistant/schedule", icon: Calendar },
  ],
  finance: [
    { name: "Dashboard", href: "/finance/dashboard", icon: LayoutDashboard },
    {
      name: "Transactions",
      href: "/finance/transactions",
      icon: BadgeDollarSign,
    },
    { name: "Reports", href: "/finance/reports", icon: Activity },
  ],
  "lab partner": [
    {
      name: "Dashboard",
      href: "/lab-partner/dashboard",
      icon: LayoutDashboard,
    },
    { name: "Tests", href: "/lab-partner/tests", icon: FlaskConical },
    { name: "Reports", href: "/lab-partner/reports", icon: Activity },
  ],
  hospital: [
    { name: "Dashboard", href: "/hospital/dashboard", icon: LayoutDashboard },
    { name: "Doctors", href: "/hospital/doctors", icon: UserRound },
    { name: "Patients", href: "/hospital/patients", icon: HeartPulse },
  ],
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const getActivePalette = (pathname) => {
  let best = null,
    bestLen = 0;
  for (const link of CUSTOMER_NAV_LINKS) {
    if (pathname === link.href || pathname.startsWith(link.href + "/")) {
      if (link.href.length > bestLen) {
        best = link;
        bestLen = link.href.length;
      }
    }
  }
  return best;
};

const getRolePalette = (role) => (!role ? null : (ROLE_PALETTES[role] ?? null));

const buildAvatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=2563eb&color=fff`;

function preconnectOrigins() {
  if (typeof document === "undefined") return;
  [
    "https://ui-avatars.com",
    "https://maps.googleapis.com",
    "https://maps.gstatic.com",
  ].forEach((href) => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`))
      return;
    const link = Object.assign(document.createElement("link"), {
      rel: "preconnect",
      href,
      crossOrigin: "anonymous",
    });
    document.head.appendChild(link);
  });
}

let _mapsLoadPromise = null;
function loadGoogleMaps() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.google?.maps?.places) return Promise.resolve(true);
  if (_mapsLoadPromise) return _mapsLoadPromise;
  _mapsLoadPromise = new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places&v=beta`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      _mapsLoadPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });
  return _mapsLoadPromise;
}

// ── Framer variants ──────────────────────────────────────────────────────────
const DROPDOWN_VARIANTS = {
  hidden: { opacity: 0, y: -8, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", damping: 25, stiffness: 300 },
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.96,
    transition: { duration: 0.15, ease: "easeInOut" },
  },
};
const LOCATION_DROPDOWN_VARIANTS = {
  hidden: { opacity: 0, y: -6, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", damping: 28, stiffness: 320 },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.97,
    transition: { duration: 0.15, ease: "easeInOut" },
  },
};
const MOBILE_MENU_VARIANTS = {
  hidden: { opacity: 0, x: "100%" },
  show: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      damping: 30,
      stiffness: 200,
      when: "beforeChildren",
    },
  },
  exit: {
    opacity: 0,
    x: "100%",
    transition: { duration: 0.3, ease: "easeInOut" },
  },
};
const BOTTOM_NAV_VARIANTS = {
  hidden: { opacity: 0, y: 80 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", damping: 26, stiffness: 260, delay: 0.1 },
  },
};
const STAGGER = { show: { transition: { staggerChildren: 0.08 } } };
const FADE_UP = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};
const BELL_RING = {
  ring: {
    rotate: [0, 15, -15, 10, -10, 5, -5, 0],
    transition: { duration: 1.5, repeat: Infinity, repeatDelay: 2 },
  },
  idle: { rotate: 0 },
};
const CART_FLOAT = {
  float: {
    y: [0, -3, 0],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
  idle: { y: 0 },
};

// ── Google Maps Autocomplete hook ────────────────────────────────────────────
function useGoogleMapsAutocomplete() {
  const ensureLoaded = useCallback(async () => loadGoogleMaps(), []);

  const fetchSuggestions = useCallback(
    async (value, onResult) => {
      if (!value?.trim()) {
        onResult([]);
        return;
      }
      const loaded = await ensureLoaded();
      if (!loaded) {
        onResult([]);
        return;
      }
      try {
        const { AutocompleteSuggestion } =
          await google.maps.importLibrary("places");
        const { suggestions } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: value,
            includedRegionCodes: ["in"],
            includedPrimaryTypes: ["geocode", "establishment"],
          });
        const normalized = (suggestions ?? []).map((s) => {
          const place = s.placePrediction;
          return {
            place_id: place.placeId,
            description:
              place.text?.toString() ?? place.mainText?.toString() ?? "",
            structured_formatting: {
              main_text: place.mainText?.toString() ?? "",
              secondary_text: place.secondaryText?.toString() ?? "",
            },
            _placePrediction: place,
          };
        });
        onResult(normalized);
      } catch {
        try {
          if (window.google?.maps?.places?.AutocompleteService) {
            const svc = new window.google.maps.places.AutocompleteService();
            svc.getPlacePredictions(
              {
                input: value,
                componentRestrictions: { country: "in" },
                types: ["geocode", "establishment"],
              },
              (predictions, status) => {
                onResult(
                  status === window.google.maps.places.PlacesServiceStatus.OK
                    ? (predictions ?? [])
                    : [],
                );
              },
            );
          } else {
            onResult([]);
          }
        } catch {
          onResult([]);
        }
      }
    },
    [ensureLoaded],
  );

  return { fetchSuggestions, ensureService: ensureLoaded };
}

// ── Header data hook ─────────────────────────────────────────────────────────
function useHeaderData() {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const unreadCount = useSelector(selectUnreadCount) ?? 0;
  const cartItems = useSelector(selectCartItems) ?? [];

  const isCustomer = !user?.role || user.role === "customer";

  // Customer Wallet State
  const customerWalletBalance = useSelector(selectWalletBalance) ?? 0;
  // Partner Wallet State (from accountingSlice)
  const partnerWalletObj = useSelector(selectPartnerWalletObj);
  const partnerWalletBalance = partnerWalletObj?.wallet?.availableBalance ?? 0;

  const walletBalance = isCustomer
    ? customerWalletBalance
    : partnerWalletBalance;

  const cartCount = useMemo(
    () =>
      Array.isArray(cartItems)
        ? cartItems.reduce((a, i) => a + (i.quantity ?? 0), 0)
        : 0,
    [cartItems],
  );

  useEffect(() => {
    if (!token) return;
    dispatch(getProfile());
    dispatch(fetchNotifications());
    dispatch(fetchCart());

    // Fetch appropriate wallet based on role
    if (isCustomer) {
      dispatch(getWallet());
    } else {
      dispatch(fetchPartnerWallet());
    }
  }, [token, dispatch, isCustomer]);

  return { user, token, unreadCount, cartCount, walletBalance };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── NEW: IconTooltip — wraps an icon button, shows label below on hover ──────
// Hover-only (desktop). On touch devices hover doesn't fire, so it's inert
// there — harmless, no extra JS/state needed, pure CSS group-hover.
const IconTooltip = memo(function IconTooltip({ label, className, children }) {
  return (
    <div className={cn("relative group/tip inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        aria-hidden="true"
        className="pointer-events-none capitalize absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap px-2 py-1 rounded-md text-[10px] font-bold shadow-lg opacity-0 scale-90 translate-y-[-2px] transition-all duration-150 z-[130] group-hover/tip:opacity-100 group-hover/tip:scale-100 group-hover/tip:translate-y-0 bg-base-content text-base-100"
      >
        {label}
      </span>
    </div>
  );
});

// ── ThemeToggle ───────────────────────────────────────────────────────────────
const ThemeToggle = memo(function ThemeToggle({ compact = false }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted)
    return (
      <div
        className={cn(
          "rounded-xl border border-base-300 skeleton",
          compact ? "w-8 h-8" : "w-10 h-10",
        )}
        aria-hidden="true"
      />
    );
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const Icon = theme === "dark" ? Moon : Sun;
  const label = `Switch to ${theme === "dark" ? "light" : "dark"} mode`;
  return (
    <IconTooltip label={label}>
      <button
        onClick={toggleTheme}
        aria-label={label}
        className={cn(
          "rounded-xl border border-base-300 text-base-content/50 hover:bg-primary/5 hover:text-primary transition-all duration-200 flex items-center justify-center",
          compact ? "w-8 h-8" : "p-2.5",
        )}
      >
        <Icon size={compact ? 15 : 18} />
      </button>
    </IconTooltip>
  );
});

// ── WalletWidget ──────────────────────────────────────────────────────────────
const WalletWidget = memo(function WalletWidget({
  walletBalance,
  isMobile = false,
  accent,
  isCustomer = true,
}) {
  const href = isCustomer ? "/wallet" : "/partner/wallet";
  const accentColor = isCustomer ? (accent ?? "var(--warning)") : "#10b981"; // Emerald Green for partners
  const Icon = isCustomer ? WalletIcon : IndianRupee; // Different icon for partners

  return (
    <Link
      href={href}
      aria-label={`Wallet balance ₹${walletBalance}. Go to wallet.`}
      className={cn(
        "flex items-center gap-2 rounded-full border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
        isMobile ? "w-full px-4 py-3" : "px-3 py-1.5",
      )}
      style={{
        borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)`,
        background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
      }}
    >
      <div
        className="p-1 rounded-full"
        style={{
          background: `color-mix(in srgb, ${accentColor} 25%, transparent)`,
          color: accentColor,
        }}
        aria-hidden="true"
      >
        <Icon size={isMobile ? 16 : 13} strokeWidth={2.5} />
      </div>
      <div className="flex flex-col items-start leading-none">
        <span className="text-[8px] font-black uppercase tracking-tighter opacity-50">
          Balance
        </span>
        <span
          aria-live="polite"
          className={cn(
            "font-black tracking-tight",
            isMobile ? "text-xs" : "text-[11px]",
          )}
          style={{ color: accentColor }}
        >
          ₹{(walletBalance ?? 0).toLocaleString("en-IN")}
        </span>
      </div>
    </Link>
  );
});

// ── SuggestionsList ───────────────────────────────────────────────────────────
const SuggestionsList = memo(function SuggestionsList({
  suggestions,
  onSelect,
  disabled,
  accent,
}) {
  if (!suggestions.length) return null;
  return (
    <MotionUl
      role="listbox"
      aria-label="Location suggestions"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-xl border border-base-300 bg-base-100"
    >
      {suggestions.map((s, idx) => (
        <MotionLi
          key={s.place_id ?? idx}
          role="option"
          aria-selected="false"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: idx * 0.035 }}
        >
          <button
            type="button"
            onClick={() => onSelect(s)}
            disabled={disabled}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-base-200/80 transition-colors border-b border-base-300/50 last:border-0 focus-visible:outline-none focus-visible:bg-base-200/80"
          >
            <div
              className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
              style={{
                background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                color: accent,
              }}
              aria-hidden="true"
            >
              <MapPin size={12} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold truncate leading-tight">
                {s.structured_formatting?.main_text ?? s.description}
              </p>
              <p className="text-[10px] opacity-40 truncate leading-tight">
                {s.structured_formatting?.secondary_text}
              </p>
            </div>
          </button>
        </MotionLi>
      ))}
    </MotionUl>
  );
});

// ── LocationWidget ────────────────────────────────────────────────────────────
const LocationWidget = memo(function LocationWidget({
  mood,
  isMobile = false,
  compact = false,
}) {
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { fetchSuggestions, ensureService } = useGoogleMapsAutocomplete();
  const loaders = useSelector(selectLoaders);
  const savingAddress = loaders?.locationByAddress ?? false;
  const fetchingGPS = loaders?.locationByCoords ?? false;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [localGPSLoading, setLocalGPSLoading] = useState(false);

  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);
  const latestLocationRef = useRef(null); // { address, lat, lng } — last thing user actually picked

  const savedAddress = user?.lastKnownAddress ?? null;
  const cityLabel = useMemo(() => {
    if (!savedAddress) return "Set Location";
    const first = savedAddress.split(",")[0]?.trim() ?? savedAddress;
    return first.length > (compact ? 12 : 18)
      ? first.slice(0, compact ? 10 : 16) + "…"
      : first;
  }, [savedAddress, compact]);

  const regionLabel = useMemo(() => {
    if (!savedAddress) return null;
    return savedAddress.split(",")[1]?.trim() ?? null;
  }, [savedAddress]);

  const nameInitial = useMemo(
    () => user?.name?.charAt(0).toUpperCase() ?? "?",
    [user?.name],
  );
  const firstName = useMemo(
    () => user?.name?.split(" ")[0] ?? "You",
    [user?.name],
  );
  const accent = mood?.accent ?? "var(--primary)";
  const triggerBg =
    mood?.pillBg ?? "color-mix(in srgb, var(--primary) 8%, transparent)";
  const triggerGrad =
    mood?.barGradient ??
    "linear-gradient(135deg, var(--primary), var(--secondary))";

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setSuggestions([]);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler, { passive: true });
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (inputRef.current) setTimeout(() => inputRef.current?.focus(), 90);
    ensureService();
  }, [open, ensureService]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSuggestions([]);
        setQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleQueryChange = useCallback(
    (e) => {
      const val = e.target.value;
      setQuery(val);
      clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(
        () => fetchSuggestions(val, setSuggestions),
        280,
      );
    },
    [fetchSuggestions],
  );

  const geocodeAndDispatch = useCallback(
    async (address, lat, lng) => {
      const target = { address, lat, lng };
      latestLocationRef.current = target;
      try {
        if (lat && lng) {
          await dispatch(updateLocationByCoords({ lat, lng, address }));
        } else {
          await dispatch(updateLocationByAddress(address));
        }
        // Self-heal: if a newer pick happened while this request was
        // in flight, THIS (older) response may have just overwritten
        // Redux with a stale address. Re-fire the newest pick so the
        // UI never regresses to something the user already moved past.
        if (latestLocationRef.current !== target) {
          const latest = latestLocationRef.current;
          if (latest.lat && latest.lng) {
            dispatch(
              updateLocationByCoords({
                lat: latest.lat,
                lng: latest.lng,
                address: latest.address,
              }),
            );
          } else {
            dispatch(updateLocationByAddress(latest.address));
          }
        }
      } catch {}
    },
    [dispatch],
  );

  const handleSelectSuggestion = useCallback(
    async (suggestion) => {
      const address = suggestion.description;
      setQuery(suggestion.structured_formatting?.main_text ?? address);
      setSuggestions([]);
      try {
        if (suggestion._placePrediction && window.google?.maps) {
          try {
            const place = suggestion._placePrediction.toPlace();
            await place.fetchFields({ fields: ["location"] });
            if (place.location) {
              await geocodeAndDispatch(
                address,
                place.location.lat(),
                place.location.lng(),
              );
              setOpen(false);
              setQuery("");
              return;
            }
          } catch {}
        }
        if (window.google?.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address }, async (results, status) => {
            if (status === "OK" && results?.[0]) {
              const loc = results[0].geometry.location;
              await geocodeAndDispatch(address, loc.lat(), loc.lng());
            } else {
              await geocodeAndDispatch(address);
            }
            setOpen(false);
            setQuery("");
          });
        } else {
          await geocodeAndDispatch(address);
          setOpen(false);
          setQuery("");
        }
      } catch {}
    },
    [geocodeAndDispatch],
  );

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocalGPSLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        try {
          if (window.google?.maps) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode(
              { location: { lat, lng } },
              async (results, status) => {
                const address =
                  status === "OK" && results?.[0]
                    ? results[0].formatted_address
                    : undefined;
                const target = { address, lat, lng };
                latestLocationRef.current = target;
                await dispatch(updateLocationByCoords({ lat, lng, address }));
                if (latestLocationRef.current !== target) {
                  const latest = latestLocationRef.current;
                  if (latest.lat && latest.lng) {
                    dispatch(
                      updateLocationByCoords({
                        lat: latest.lat,
                        lng: latest.lng,
                        address: latest.address,
                      }),
                    );
                  } else {
                    dispatch(updateLocationByAddress(latest.address));
                  }
                }
                setLocalGPSLoading(false);
                setOpen(false);
              },
            );
          } else {
            await dispatch(updateLocationByCoords({ lat, lng }));
            setLocalGPSLoading(false);
            setOpen(false);
          }
        } catch {
          setLocalGPSLoading(false);
        }
      },
      () => setLocalGPSLoading(false),
      { timeout: 10000 },
    );
  }, [dispatch]);

  const gpsLoading = localGPSLoading || fetchingGPS;

  const searchInput = (
    <div className="relative">
      <label
        htmlFor={isMobile ? "loc-search-mobile" : "loc-search"}
        className="sr-only"
      >
        Search location
      </label>
      <Search
        size={13}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-35 pointer-events-none"
        aria-hidden="true"
      />
      <input
        id={isMobile ? "loc-search-mobile" : "loc-search"}
        ref={inputRef}
        value={query}
        onChange={handleQueryChange}
        placeholder="Area, city or pincode…"
        aria-label="Search location"
        autoComplete="off"
        className="w-full pl-9 pr-9 py-2.5 rounded-xl text-[12px] font-medium bg-base-200/60 border border-transparent focus:bg-base-100 focus:border-base-300 transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
      />
      {savingAddress && (
        <Loader2
          size={13}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin opacity-40 pointer-events-none"
          aria-hidden="true"
        />
      )}
    </div>
  );

  // MOBILE version — no edit button
  if (isMobile) {
    return (
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
        }}
        aria-label="Location settings"
      >
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ background: triggerBg }}
        >
          <div
            className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-black text-white shadow-sm"
            style={{ background: triggerGrad }}
            aria-hidden="true"
          >
            {nameInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 leading-none mb-0.5">
              {firstName}'s Location
            </p>
            <p
              className="text-[12px] font-black truncate leading-tight"
              style={{ color: accent }}
            >
              {cityLabel}
            </p>
            {regionLabel && (
              <p className="text-[10px] opacity-40 truncate leading-tight">
                {regionLabel}
              </p>
            )}
            {savedAddress && savedAddress.includes(",") && (
              <p className="text-[9px] opacity-30 truncate leading-tight mt-0.5">
                {savedAddress}
              </p>
            )}
          </div>
          {/* Edit button REMOVED — no Pencil button here */}
        </div>
        <div className="p-3 flex flex-col gap-2 bg-base-100">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={gpsLoading}
            aria-label="Use current GPS location"
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border font-bold text-[12px] transition-all active:scale-[0.98] disabled:opacity-60"
            style={{
              borderColor: `color-mix(in srgb, ${accent} 25%, transparent)`,
              color: accent,
              background: triggerBg,
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: `color-mix(in srgb, ${accent} 20%, transparent)`,
              }}
              aria-hidden="true"
            >
              {gpsLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Locate size={13} />
              )}
            </div>
            <div className="text-left">
              <p className="font-black text-[12px] leading-none">
                {gpsLoading ? "Detecting…" : "Use Current Location"}
              </p>
              <p className="text-[10px] opacity-50 font-normal mt-0.5">
                GPS auto-detect
              </p>
            </div>
          </button>
          {searchInput}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <SuggestionsList
                suggestions={suggestions}
                onSelect={handleSelectSuggestion}
                disabled={savingAddress}
                accent={accent}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // COMPACT mobile trigger (inline in header top bar) — desktop/tablet only via lg:hidden
  if (compact) {
    return (
      <div className="relative" ref={wrapperRef}>
        <button
          onClick={() => setOpen((p) => !p)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`Location: ${cityLabel}. Tap to change.`}
          className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full border transition-all duration-200 max-w-[130px]"
          style={{
            background: open ? triggerBg : "var(--base-200)",
            borderColor: open
              ? `color-mix(in srgb, ${accent} 50%, transparent)`
              : "var(--base-300)",
          }}
        >
          <div
            className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-black text-white"
            style={{ background: triggerGrad }}
            aria-hidden="true"
          >
            {nameInitial}
          </div>
          <div className="flex flex-col items-start leading-none min-w-0">
            <span className="text-[7px] font-black uppercase tracking-[0.15em] opacity-40 leading-none">
              Location
            </span>
            <span
              className="text-[10px] font-black tracking-tight leading-tight truncate max-w-[80px]"
              style={{ color: open ? accent : "var(--base-content)" }}
            >
              {cityLabel}
            </span>
          </div>
          {gpsLoading ? (
            <Loader2
              size={10}
              className="animate-spin opacity-50 flex-shrink-0"
            />
          ) : (
            <MapPin
              size={10}
              strokeWidth={2.5}
              style={{ color: accent, opacity: 0.7, flexShrink: 0 }}
            />
          )}
        </button>

        <AnimatePresence>
          {open && (
            <MotionDiv
              variants={LOCATION_DROPDOWN_VARIANTS}
              initial="hidden"
              animate="show"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-label="Change location"
              className="absolute left-0 top-full mt-2 w-[300px] z-[200] rounded-2xl shadow-2xl border border-base-300 bg-base-100 overflow-hidden origin-top-left"
            >
              <div
                className="px-3 py-3 flex items-center gap-3 border-b border-base-300"
                style={{ background: triggerBg }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-black text-white shadow"
                  style={{ background: triggerGrad }}
                  aria-hidden="true"
                >
                  {nameInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 leading-none mb-0.5">
                    {firstName}'s Location
                  </p>
                  <p
                    className="text-[12px] font-black truncate leading-tight"
                    style={{ color: accent }}
                  >
                    {cityLabel}
                  </p>
                  {regionLabel && (
                    <p className="text-[10px] opacity-40 truncate">
                      {regionLabel}
                    </p>
                  )}
                </div>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={gpsLoading}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all disabled:opacity-60"
                  style={{
                    borderColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
                    background: triggerBg,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                      color: accent,
                    }}
                    aria-hidden="true"
                  >
                    {gpsLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Navigation size={14} />
                    )}
                  </div>
                  <div>
                    <p
                      className="text-[12px] font-black leading-tight"
                      style={{ color: accent }}
                    >
                      {gpsLoading ? "Detecting…" : "Use Current Location"}
                    </p>
                    <p className="text-[10px] opacity-50 font-normal">
                      GPS via browser
                    </p>
                  </div>
                </button>
                <div
                  className="flex items-center gap-2"
                  role="separator"
                  aria-hidden="true"
                >
                  <div className="flex-1 h-px bg-base-300" />
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-25">
                    or search
                  </span>
                  <div className="flex-1 h-px bg-base-300" />
                </div>
                {searchInput}
                <AnimatePresence>
                  {suggestions.length > 0 && (
                    <SuggestionsList
                      suggestions={suggestions}
                      onSelect={handleSelectSuggestion}
                      disabled={savingAddress}
                      accent={accent}
                    />
                  )}
                </AnimatePresence>
              </div>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // DESKTOP full version
  return (
    <div className="relative flex-shrink-0" ref={wrapperRef}>
      <MotionButton
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Current location: ${cityLabel}. Click to change.`}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full border transition-all duration-200"
        style={{
          background: open ? triggerBg : "var(--base-200)",
          borderColor: open
            ? `color-mix(in srgb, ${accent} 50%, transparent)`
            : "var(--base-300)",
        }}
      >
        <div
          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black text-white"
          style={{ background: triggerGrad }}
          aria-hidden="true"
        >
          {nameInitial}
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[8px] font-black uppercase tracking-[0.15em] opacity-40">
            {firstName}
          </span>
          <span
            className="text-[11px] font-black tracking-tight leading-tight max-w-[90px] truncate"
            style={{ color: open ? accent : "var(--base-content)" }}
          >
            {cityLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-0.5" aria-hidden="true">
          {gpsLoading ? (
            <Loader2 size={11} className="animate-spin opacity-50" />
          ) : (
            <MapPin
              size={11}
              strokeWidth={2.5}
              style={{ color: accent, opacity: 0.7 }}
            />
          )}
          <MotionDiv
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: open ? 1 : 0, width: open ? "auto" : 0 }}
            className="overflow-hidden"
          >
            <Pencil size={10} strokeWidth={2.5} style={{ color: accent }} />
          </MotionDiv>
        </div>
      </MotionButton>

      <AnimatePresence>
        {open && (
          <MotionDiv
            variants={LOCATION_DROPDOWN_VARIANTS}
            initial="hidden"
            animate="show"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Change location"
            className="absolute left-0 top-full mt-2 w-[320px] z-[200] rounded-2xl shadow-2xl border border-base-300 bg-base-100 overflow-hidden origin-top-left"
          >
            <div
              className="px-4 py-3 flex items-center gap-3 border-b border-base-300"
              style={{ background: triggerBg }}
            >
              <div
                className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center   font-black text-white shadow"
                style={{ background: triggerGrad }}
                aria-hidden="true"
              >
                {nameInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 leading-none mb-0.5">
                  {firstName}'s Location
                </p>
                <p
                  className="text-[13px] font-black truncate leading-tight"
                  style={{ color: accent }}
                >
                  {cityLabel}
                </p>
                {regionLabel && (
                  <p className="text-[10px] opacity-40 truncate">
                    {regionLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="p-3 flex flex-col gap-2.5">
              <MotionButton
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={gpsLoading}
                aria-label="Detect my current location via GPS"
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all disabled:opacity-60"
                style={{
                  borderColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
                  background: triggerBg,
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `color-mix(in srgb, ${accent} 20%, transparent)`,
                    color: accent,
                  }}
                  aria-hidden="true"
                >
                  {gpsLoading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Navigation size={15} />
                  )}
                </div>
                <div>
                  <p
                    className="text-[12px] font-black leading-tight"
                    style={{ color: accent }}
                  >
                    {gpsLoading
                      ? "Detecting your location…"
                      : "Use Current Location"}
                  </p>
                  <p className="text-[10px] opacity-50 font-normal">
                    GPS auto-detect via browser
                  </p>
                </div>
              </MotionButton>
              <div
                className="flex items-center gap-2"
                role="separator"
                aria-hidden="true"
              >
                <div className="flex-1 h-px bg-base-300" />
                <span className="text-[9px] font-black uppercase tracking-widest opacity-25">
                  or search
                </span>
                <div className="flex-1 h-px bg-base-300" />
              </div>
              {searchInput}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <SuggestionsList
                    suggestions={suggestions}
                    onSelect={handleSelectSuggestion}
                    disabled={savingAddress}
                    accent={accent}
                  />
                )}
              </AnimatePresence>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── AvatarDropdown ────────────────────────────────────────────────────────────
const AvatarDropdown = memo(function AvatarDropdown({
  user,
  userAvatar,
  activePalette,
  mood,
  pathname,
  onLogout,
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const firstFocusableRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler, { passive: true });
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    setTimeout(() => firstFocusableRef.current?.focus(), 60);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const accentColor = mood?.accent ?? "var(--primary)";

  return (
    <div className="relative hidden md:block" ref={dropdownRef}>
      <IconTooltip label={user?.name ?? "Account"}>
        <MotionButton
          ref={triggerRef}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen((p) => !p)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`Account menu for ${user.name}`}
          className="relative h-10 w-10 rounded-full p-0 overflow-visible focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            border: `2px solid ${accentColor}`,
            transition: "border-color 0.3s",
          }}
        >
          <Image
            src={userAvatar}
            alt={`${user.name} profile picture`}
            fill
            className="rounded-full object-cover"
            sizes="40px"
            priority
            unoptimized={userAvatar.includes("ui-avatars.com")}
          />
          <span
            className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5"
            aria-label="Online"
          >
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 bg-green-500"
              aria-hidden="true"
            />
            <span
              className="relative inline-flex rounded-full h-3.5 w-3.5 bg-green-500 border-2 border-base-100"
              aria-hidden="true"
            />
          </span>
        </MotionButton>
      </IconTooltip>

      <AnimatePresence>
        {open && (
          <MotionDiv
            variants={DROPDOWN_VARIANTS}
            initial="hidden"
            animate="show"
            exit="exit"
            role="menu"
            aria-label="Account options"
            aria-orientation="vertical"
            className="absolute right-0 mt-3 w-72 z-[110] md:w-80 rounded-xl shadow-2xl border border-base-300 bg-base-100 p-2.5 origin-top-right"
          >
            <div
              className="py-3 px-4 rounded-lg mb-2"
              style={{ background: activePalette?.pillBg ?? "var(--base-200)" }}
            >
              <div className="flex items-center gap-3">
                <Image
                  src={userAvatar}
                  alt=""
                  width={40}
                  height={40}
                  className="rounded-lg object-cover flex-shrink-0"
                  aria-hidden="true"
                  unoptimized={userAvatar.includes("ui-avatars.com")}
                />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-tight truncate">
                    {user.name}
                  </p>
                  <p className="text-[10px] opacity-50 truncate">
                    {user.email}
                  </p>
                  <span
                    className="mt-1 inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest"
                    style={{
                      background: activePalette?.pillBg ?? "var(--primary)",
                      color:
                        activePalette?.pillText ?? "var(--primary-content)",
                    }}
                  >
                    {user.role}
                  </span>
                </div>
              </div>
            </div>
            <div className="py-1" role="none">
              <RoleNavLinks
                ref={firstFocusableRef}
                user={user}
                currentPathname={pathname}
                onLinkClick={() => setOpen(false)}
              />
            </div>
            <div
              className="my-2 h-px bg-base-300"
              role="separator"
              aria-hidden="true"
            />
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="w-full flex items-center gap-3 cursor-pointer p-3 text-[13px] font-bold rounded-lg text-error hover:bg-error/10 transition-all focus-visible:outline-none focus-visible:bg-error/10"
            >
              <div
                className="w-8 h-8 rounded-lg bg-error/20 flex items-center justify-center"
                aria-hidden="true"
              >
                <LogOut className="w-4 h-4" />
              </div>
              Sign Out
            </button>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
});

// ── NavLink (desktop — customer) ──────────────────────────────────────────────
const NavLink = memo(function NavLink({
  link,
  pathname,
  onHover,
  onLeave,
  isHovered,
}) {
  const isActive =
    pathname === link.href || pathname.startsWith(link.href + "/");
  return (
    <Link
      href={link.href}
      onMouseEnter={() => onHover(link.name)}
      onMouseLeave={onLeave}
      aria-current={isActive ? "page" : undefined}
      className="relative px-5 py-3.5 flex items-center gap-2.5 text-[10px] uppercase tracking-[0.18em] font-black transition-all duration-200 rounded-md overflow-hidden focus-visible:outline-none focus-visible:ring-2"
      style={{
        color: isActive || isHovered ? link.accent : "var(--base-content)",
        opacity: isActive || isHovered ? 1 : 0.45,
        "--tw-ring-color": link.accent,
      }}
    >
      <MotionDiv
        className="absolute inset-0 rounded-md"
        animate={{ opacity: isActive || isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ background: link.pillBg }}
        aria-hidden="true"
      />
      <MotionDiv
        animate={isHovered ? { y: -2, scale: 1.15 } : { y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 340, damping: 20 }}
        className="relative z-10 flex-shrink-0"
        style={{
          color: isActive || isHovered ? link.accent : "var(--base-content)",
          opacity: isActive || isHovered ? 1 : 0.4,
        }}
        aria-hidden="true"
      >
        <link.icon size={15} strokeWidth={2.2} />
      </MotionDiv>
      <span className="relative z-10">{link.name}</span>
      <AnimatePresence>
        {isActive && (
          <MotionDiv
            key="active-bar"
            layoutId="active-bar"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            className="absolute bottom-0 left-3 right-3 h-[3px] rounded-t-full"
            style={{ background: link.barGradient }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isHovered && !isActive && (
          <MotionDiv
            key="hover-bar"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 0.5, scaleX: 1 }}
            exit={{ opacity: 0, scaleX: 0 }}
            className="absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full"
            style={{ background: link.barGradient }}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
      {isActive && (
        <MotionDiv
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="relative z-10 w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{
            background: link.accent,
            boxShadow: `0 0 6px ${link.accent}`,
          }}
          aria-hidden="true"
        />
      )}
    </Link>
  );
});

// ── BottomNav ─────────────────────────────────────────────────────────────────
const BottomNav = memo(function BottomNav({
  links,
  palette,
  pathname,
  dataTheme,
}) {
  const accent = palette?.accent ?? "var(--primary)";
  const barGradient =
    palette?.barGradient ??
    "linear-gradient(90deg, var(--primary), var(--secondary))";
  const pillBg =
    palette?.pillBg ?? "color-mix(in srgb, var(--primary) 12%, transparent)";
  if (!links || links.length === 0) return null;
  return (
    <MotionDiv
      variants={BOTTOM_NAV_VARIANTS}
      initial="hidden"
      animate="show"
      data-theme={dataTheme}
      className="fixed bottom-0 left-0 right-0 z-[99] safe-bottom"
      role="navigation"
      aria-label="Role navigation"
    >
      <div
        className="flex md:hidden items-stretch justify-center overflow-x-auto scrollbar-none gap-1 backdrop-blur-md border-t"
        style={{
          background: "color-mix(in srgb, var(--base-100) 92%, transparent)",
          borderColor: `color-mix(in srgb, ${accent} 20%, transparent)`,
        }}
      >
        {links.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.name}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              aria-label={link.name}
              className="relative flex flex-col items-center justify-center flex-shrink-0 min-w-[72px] min-h-[60px] py-2 px-1 gap-1 transition-all duration-200 focus-visible:outline-none group"
            >
              {isActive && (
                <MotionDiv
                  layoutId="bottom-nav-active-pill"
                  className="absolute inset-x-2 inset-y-1.5 rounded-md"
                  style={{ background: pillBg }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  aria-hidden="true"
                />
              )}
              {isActive && (
                <MotionDiv
                  layoutId="bottom-nav-indicator"
                  className="absolute top-0 left-4 right-4 h-[3px] rounded-b-full"
                  style={{ background: barGradient }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  aria-hidden="true"
                />
              )}
              <MotionDiv
                animate={isActive ? { scale: 1.15, y: -1 } : { scale: 1, y: 0 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="relative z-10 flex items-center justify-center"
                aria-hidden="true"
              >
                {isActive && (
                  <span
                    className="absolute inset-0 rounded-full blur-md opacity-40 scale-150"
                    style={{ background: accent }}
                    aria-hidden="true"
                  />
                )}
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2.5 : 1.8}
                  style={{
                    color: isActive ? accent : "var(--base-content)",
                    opacity: isActive ? 1 : 0.45,
                    transition: "color 0.25s, opacity 0.25s",
                  }}
                />
              </MotionDiv>
              <span
                className="relative z-10 text-[9px] font-black uppercase tracking-[0.1em] leading-none transition-all duration-200"
                style={{
                  color: isActive ? accent : "var(--base-content)",
                  opacity: isActive ? 1 : 0.4,
                }}
              >
                {link.name}
              </span>
            </Link>
          );
        })}
      </div>
    </MotionDiv>
  );
});

// ── MobileSubBar — standalone component so it can use useState ───────────────
function MobileSubBarContent({
  isCustomer,
  rolePalette,
  RoleIcon,
  user,
  accentColor,
  mood,
  walletBalance,
}) {
  if (!isCustomer && rolePalette) {
    // Role user sub-bar
    return (
      <div
        className="flex md:hidden items-center mr-2 justify-between px-4 py-2 border-t"
        style={{
          borderColor: `color-mix(in srgb, ${rolePalette.accent} 20%, transparent)`,
          background: rolePalette.bg,
        }}
      >
        <div
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest"
          style={{ color: rolePalette.pillText }}
        >
          {RoleIcon && <RoleIcon size={13} aria-hidden="true" />}
          <span>{rolePalette.label} Portal</span>
        </div>
        <Link
          href="/partner/wallet"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black"
          style={{
            borderColor: `color-mix(in srgb, #10b981 30%, transparent)`,
            background: "color-mix(in srgb, #10b981 8%, transparent)",
            color: "#10b981",
          }}
        >
          <IndianRupee size={11} strokeWidth={2.5} aria-hidden="true" />₹
          {(walletBalance ?? 0).toLocaleString("en-IN")}
        </Link>
      </div>
    );
  }

  if (isCustomer && user) {
    // Customer sub-bar — location (compact) + wallet, mobile only
    return (
      <div
        className="flex md:hidden items-center justify-between px-4 py-2 border-t"
        style={{
          borderColor: "var(--base-300)",
          background: "color-mix(in srgb, var(--base-100) 92%, transparent)",
        }}
      >
        <LocationWidget mood={mood} isMobile={false} compact />
        <WalletWidget
          walletBalance={walletBalance}
          accent={mood?.accent}
          isCustomer
        />
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN HEADER
// ═══════════════════════════════════════════════════════════════════════════════
const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredLink, setHoveredLink] = useState(null);
  const headerRef = useRef(null);

  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();

  const { user, unreadCount, cartCount, walletBalance } = useHeaderData();

  const userRole = user?.role ?? null;
  const isCustomer = !userRole || userRole === "customer";

  const rolePalette = useMemo(() => getRolePalette(userRole), [userRole]);
  const activePalette = useMemo(() => getActivePalette(pathname), [pathname]);

  const hoverPalette = useMemo(
    () =>
      hoveredLink && isCustomer
        ? (CUSTOMER_NAV_LINKS.find((l) => l.name === hoveredLink) ?? null)
        : null,
    [hoveredLink, isCustomer],
  );

  const mood = useMemo(() => {
    if (!isCustomer && rolePalette) return rolePalette;
    return hoverPalette ?? activePalette;
  }, [isCustomer, rolePalette, hoverPalette, activePalette]);

  const roleBottomNavLinks = useMemo(() => {
    if (isCustomer) return null;
    return ROLE_BOTTOM_NAV[userRole] ?? null;
  }, [isCustomer, userRole]);

  const headerDataTheme = useMemo(() => {
    if (isCustomer || !rolePalette) return undefined;
    return rolePalette.dataTheme ?? undefined;
  }, [isCustomer, rolePalette]);

  // Measure header height → CSS var
  useEffect(() => {
    if (!headerRef.current) return;
    const update = () => {
      const h = headerRef.current?.getBoundingClientRect().height ?? 80;
      document.documentElement.style.setProperty(
        HEADER_HEIGHT_VAR,
        `${Math.ceil(h)}px`,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(headerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const warmup = () => preconnectOrigins();
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(warmup, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(warmup, 2000);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    document.body.style.touchAction = mobileOpen ? "none" : "";
    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Focus trap for mobile menu
  useEffect(() => {
    if (!mobileOpen) return;
    const menu = document.getElementById("mobile-menu");
    if (!menu) return;
    const focusables = menu.querySelectorAll(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const trap = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    const escHandler = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", trap);
    document.addEventListener("keydown", escHandler);
    first?.focus();
    return () => {
      document.removeEventListener("keydown", trap);
      document.removeEventListener("keydown", escHandler);
    };
  }, [mobileOpen]);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    setMobileOpen(false);
    router.push("/");
  }, [dispatch, router]);

  const handleHover = useCallback((name) => setHoveredLink(name), []);
  const handleLeave = useCallback(() => setHoveredLink(null), []);
  const toggleMobile = useCallback(() => setMobileOpen((p) => !p), []);

  const userAvatar = useMemo(
    () => user?.avatar || buildAvatarUrl(user?.name),
    [user?.avatar, user?.name],
  );

  const accentStripeStyle = useMemo(
    () => ({
      background:
        mood?.barGradient ??
        "linear-gradient(90deg, var(--primary), var(--secondary))",
      transition: "background 0.4s ease",
    }),
    [mood],
  );

  const navBarStyle = useMemo(
    () => ({
      background: mood?.bg ?? "transparent",
      transition: "background 0.4s ease",
      borderTop: "1px solid",
      borderColor: mood
        ? `color-mix(in srgb, ${mood.accent} 22%, transparent)`
        : "var(--base-300)",
    }),
    [mood],
  );

  const bookNowStyle = useMemo(
    () => ({
      background: mood?.barGradient ?? "var(--primary)",
      boxShadow: mood
        ? `0 4px 18px ${mood.shadowColor}`
        : "0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent)",
    }),
    [mood],
  );

  const mobileMenuAccentBorder = useMemo(
    () => ({
      background: mood?.pillBg ?? "var(--base-200)",
      borderColor: mood
        ? `color-mix(in srgb, ${mood.accent} 25%, transparent)`
        : "var(--base-300)",
    }),
    [mood],
  );

  const RoleIcon = mood?.icon ?? null;
  const accentColor = mood?.accent ?? "var(--primary)";

  // 🆕 ADDED: Support Page hidden logic combined with tracking logic
  const isTrackingPage =
    pathname === "/search" ||
    (pathname.startsWith("/rides/") && pathname.endsWith("/tracking")) ||
    pathname.startsWith("/driver/tracking") ||
    pathname.includes("/tracking");

  const isSupportPage = pathname?.includes("/support");
  const isHiddenPage = isTrackingPage || isSupportPage;

  return (
    <>
      {/* Skip to content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-base-100 focus:text-base-content focus:font-bold focus:shadow-xl"
      >
        Skip to main content
      </a>

      {/* 🔄 UPDATED: Use isHiddenPage instead of isTrackingPage */}
      <header
        ref={headerRef}
        data-theme={headerDataTheme}
        className={cn(
          isHiddenPage
            ? "hidden"
            : "sticky top-0 z-[100] w-full backdrop-blur-md border-b border-base-300 transition-all duration-300",
          !isCustomer && roleBottomNavLinks && "mb-0",
        )}
        style={{
          background: "color-mix(in srgb, var(--base-100) 88%, transparent)",
        }}
        role="banner"
      >
        <Marquee />

        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <div className="py-2 md:py-3 relative z-[101]">
          <Container className="flex items-center justify-between gap-3">
            {/* ── LEFT: Logo + Location (desktop/tablet only) ── */}
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0 min-w-0">
              <Link
                href="/"
                className="flex-shrink-0 group transition-transform active:scale-95"
                aria-label="Likeson — go to homepage"
              >
                <span
                  className="text-xl md:text-2xl font-black tracking-tighter transition-colors duration-300 block"
                  style={{ color: mood?.accent ?? "var(--primary)" }}
                >
                  Likeson<span style={{ color: "var(--warning)" }}>.in</span>
                </span>
              </Link>

              {/* Desktop: full location widget — lg and above only */}
              <div className="hidden lg:flex items-center">
                <LocationWidget mood={mood} isMobile={false} />
              </div>

              {/* md only (tablet): compact location widget — hidden on mobile, location goes to sub-bar */}
              <div className="hidden md:flex lg:hidden items-center">
                <LocationWidget mood={mood} isMobile={false} compact />
              </div>

              {/* Mobile: NO location widget here — it lives in the sub-bar MapPin button */}
            </div>

            {/* ── CENTER: Desktop search (customer/guest) or role title ── */}
            {isCustomer && (
              <Link
                href="/search"
                aria-label="Open search"
                className="hidden lg:flex flex-1 max-w-sm relative items-center"
              >
                <Search
                  className="absolute left-4 w-4 h-4 pointer-events-none"
                  style={{
                    color: mood?.accent ?? "var(--base-content)",
                    opacity: 0.5,
                  }}
                  aria-hidden="true"
                />
                <div className="input-field w-full pl-10 text-[13px] text-base-content/40 rounded-xl bg-base-200/50 border-transparent cursor-pointer select-none py-3">
                  Search services or doctors…
                </div>
              </Link>
            )}

            {!isCustomer && rolePalette && (
              <div className="hidden lg:flex flex-1 items-center justify-center">
                <div
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full border text-[11px] font-black uppercase tracking-widest"
                  style={{
                    background: rolePalette.pillBg,
                    borderColor: `color-mix(in srgb, ${rolePalette.accent} 30%, transparent)`,
                    color: rolePalette.pillText,
                  }}
                  aria-label={`Logged in as ${rolePalette.label}`}
                >
                  {RoleIcon && <RoleIcon size={14} aria-hidden="true" />}
                  {rolePalette.label} Portal
                </div>
              </div>
            )}

            {/* ── RIGHT: Actions ── */}
            <div
              className="flex items-center gap-1.5 md:gap-2 lg:gap-3 flex-shrink-0"
              role="navigation"
              aria-label="Account actions"
            >
              {/* ── NEW: mobile-only Book icon — renders for ANY customer   */}
              {/* (guest or logged-in), so guests get the icon too. Sits    */}
              {/* outside the user/guest split on purpose.                 */}
              {isCustomer && (
                <IconTooltip label="Book Appointment" className="md:hidden">
                  <Link href="/book-appointment" aria-label="Book appointment">
                    <MotionDiv
                      whileTap={{ scale: 0.92 }}
                      // Changed w-9 to px-4 to allow it to expand, and added gap-2
                      className="h-9 px-4 rounded-full flex items-center justify-center gap-2 text-white flex-shrink-0"
                      style={{
                        background: mood?.barGradient ?? "var(--primary)",
                      }}
                    >
                      <Calendar size={16} aria-hidden="true" />
                      {/* Added the text label */}
                      <span className="text-sm font-semibold tracking-wide font-poppins">
                        Book
                      </span>
                    </MotionDiv>
                  </Link>
                </IconTooltip>
              )}

              {/* ───── LOGGED IN ───── */}
              {user ? (
                <>
                  {/* Desktop-only: superadmin badge */}
                  {userRole === "superadmin" && (
                    <Link
                      href="/admin/dashboard"
                      aria-label="Admin dashboard"
                      className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border animate-pulse"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary) 8%, transparent)",
                        color: "var(--primary)",
                        borderColor:
                          "color-mix(in srgb, var(--primary) 20%, transparent)",
                      }}
                    >
                      <ShieldCheck size={13} aria-hidden="true" /> Admin
                    </Link>
                  )}

                  {/* Desktop-only: active section pill */}
                  {isCustomer && (
                    <AnimatePresence mode="wait">
                      {activePalette && (
                        <MotionDiv
                          key={activePalette.href}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          aria-label={`Current section: ${activePalette.label}`}
                          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border"
                          style={{
                            background: activePalette.pillBg,
                            color: activePalette.pillText,
                            borderColor: `${activePalette.accent}30`,
                            boxShadow: `0 0 12px ${activePalette.shadowColor}`,
                          }}
                        >
                          <activePalette.icon size={11} aria-hidden="true" />
                          {activePalette.label}
                        </MotionDiv>
                      )}
                    </AnimatePresence>
                  )}

                  {/* Desktop-only: Wallet */}
                  <div className="hidden md:flex">
                    <WalletWidget
                      walletBalance={walletBalance}
                      accent={mood?.accent}
                      isCustomer={isCustomer}
                    />
                  </div>

                  {/* Cart — customer/pharmacy — visible on MOBILE too */}
                  {(isCustomer || userRole === "pharmacy") && (
                    <IconTooltip label={`Cart (${cartCount})`}>
                      <Link
                        href="/pharmacy/cart"
                        aria-label={`Shopping cart with ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
                      >
                        <MotionDiv
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="relative"
                        >
                          <button
                            className="relative h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center text-base-content/60 hover:bg-base-200 transition-colors"
                            tabIndex={-1}
                            aria-hidden="true"
                          >
                            <MotionDiv
                              variants={CART_FLOAT}
                              animate={cartCount > 0 ? "float" : "idle"}
                              aria-hidden="true"
                            >
                              <ShoppingCart size={18} aria-hidden="true" />
                            </MotionDiv>
                          </button>
                          {cartCount > 0 && (
                            <MotionSpan
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              aria-hidden="true"
                              className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] md:min-w-[18px] md:h-[18px] px-1 rounded-full text-[9px] md:text-[10px] font-black text-white shadow-lg"
                              style={{
                                background: mood?.accent ?? "var(--primary)",
                                boxShadow: mood
                                  ? `0 2px 8px ${mood.shadowColor}`
                                  : "none",
                              }}
                            >
                              {cartCount > 99 ? "99+" : cartCount}
                              <span
                                className="absolute inset-0 rounded-full animate-ping opacity-40"
                                style={{
                                  background: mood?.accent ?? "var(--primary)",
                                }}
                                aria-hidden="true"
                              />
                            </MotionSpan>
                          )}
                        </MotionDiv>
                      </Link>
                    </IconTooltip>
                  )}

                  {/* Notifications — visible on MOBILE too */}
                  <IconTooltip
                    label={
                      unreadCount > 0
                        ? `Notifications (${unreadCount})`
                        : "Notifications"
                    }
                  >
                    <Link
                      href="/notifications"
                      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ", none unread"}`}
                    >
                      <MotionDiv
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        className="relative"
                      >
                        <button
                          className="relative h-9 w-9 md:h-10 md:w-10 rounded-full flex items-center justify-center text-base-content/60 hover:bg-base-200 transition-colors"
                          tabIndex={-1}
                          aria-hidden="true"
                        >
                          <MotionDiv
                            variants={BELL_RING}
                            animate={unreadCount > 0 ? "ring" : "idle"}
                            aria-hidden="true"
                          >
                            <Bell size={18} aria-hidden="true" />
                          </MotionDiv>
                          {unreadCount > 0 && (
                            <>
                              <span
                                aria-hidden="true"
                                className="absolute top-2 right-2.5 w-2 h-2 rounded-full border-2 border-base-100 z-10"
                                style={{
                                  background: mood?.accent ?? "var(--accent)",
                                }}
                              />
                              <span
                                aria-hidden="true"
                                className="absolute top-2 right-2.5 w-2 h-2 rounded-full animate-ping"
                                style={{
                                  background: mood?.accent ?? "var(--accent)",
                                  opacity: 0.6,
                                }}
                              />
                            </>
                          )}
                        </button>
                      </MotionDiv>
                    </Link>
                  </IconTooltip>

                  {/* Theme toggle */}
                  <ThemeToggle compact />

                  {/* Book Now — desktop, customer only (mobile icon now lives
                      above, outside this branch, so it shows for guests too) */}
                  {isCustomer && (
                    <Link
                      href="/book-appointment"
                      className="hidden md:block"
                      aria-label="Book a medical appointment"
                    >
                      <MotionButton
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center h-10 px-4 md:px-6 gap-2 rounded-md text-[12px] font-black uppercase tracking-wide text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={bookNowStyle}
                      >
                        <Calendar
                          className="w-4 h-4 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span className="hidden md:block">Book Now</span>
                      </MotionButton>
                    </Link>
                  )}

                  {/* Desktop: Avatar dropdown */}
                  <AvatarDropdown
                    user={user}
                    userAvatar={userAvatar}
                    activePalette={isCustomer ? activePalette : rolePalette}
                    mood={mood}
                    pathname={pathname}
                    onLogout={handleLogout}
                  />

                  {/* Mobile: Hamburger menu */}
                  <IconTooltip
                    label={mobileOpen ? "Close menu" : "Menu"}
                    className="md:hidden"
                  >
                    <MotionButton
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleMobile}
                      aria-label={mobileOpen ? "Close menu" : "Open menu"}
                      aria-expanded={mobileOpen}
                      aria-controls="mobile-menu"
                      className="h-9 w-9 rounded-full flex items-center justify-center bg-base-200 text-base-content z-[110] relative focus-visible:outline-none focus-visible:ring-2 flex-shrink-0"
                      style={{
                        border: `1.5px solid ${mood ? `color-mix(in srgb, ${mood.accent} 40%, transparent)` : "var(--base-300)"}`,
                      }}
                    >
                      <AnimatePresence mode="wait">
                        {mobileOpen ? (
                          <MotionSpan
                            key="x"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            aria-hidden="true"
                          >
                            <X size={18} />
                          </MotionSpan>
                        ) : (
                          <MotionSpan
                            key="menu"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            aria-hidden="true"
                          >
                            <Menu size={18} />
                          </MotionSpan>
                        )}
                      </AnimatePresence>
                    </MotionButton>
                  </IconTooltip>
                </>
              ) : (
                /* ───── GUEST ───── */
                <>
                  {/* Desktop: Login */}
                  <Link
                    href="/login"
                    className="hidden sm:block"
                    aria-label="Sign in"
                  >
                    <MotionButton
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.96 }}
                      className="rounded-full text-[13px] font-extrabold h-10 px-6 text-base-content hover:bg-base-200 transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      Login
                    </MotionButton>
                  </Link>

                  {/* Desktop: Book Now */}
                  {isCustomer && (
                    <Link href="/book-appointment" className="hidden md:block">
                      <MotionButton
                        whileHover={{ scale: 1.04, y: -1 }}
                        whileTap={{ scale: 0.95 }}
                        aria-label="Book a medical appointment"
                        className="flex items-center h-10 px-4 md:px-6 gap-2 rounded-md text-[12px] font-black uppercase tracking-wide text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={bookNowStyle}
                      >
                        <Calendar
                          className="w-4 h-4 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <span className="hidden md:block">Book Now</span>
                      </MotionButton>
                    </Link>
                  )}

                  {/* Mobile: direct Login button — visible without opening hamburger */}
                  <Link
                    href="/login"
                    className="sm:hidden"
                    aria-label="Sign in"
                  >
                    <MotionButton
                      whileTap={{ scale: 0.94 }}
                      className="h-9 px-3.5 rounded-full text-[11px] font-black uppercase tracking-wide text-white flex items-center justify-center flex-shrink-0"
                      style={{
                        background: mood?.barGradient ?? "var(--primary)",
                      }}
                    >
                      Login
                    </MotionButton>
                  </Link>

                  {/* Mobile: Theme toggle + Menu */}
                  <ThemeToggle compact />
                  <IconTooltip
                    label={mobileOpen ? "Close menu" : "Menu"}
                    className="md:hidden"
                  >
                    <MotionButton
                      whileTap={{ scale: 0.9 }}
                      onClick={toggleMobile}
                      aria-label={mobileOpen ? "Close menu" : "Open menu"}
                      aria-expanded={mobileOpen}
                      aria-controls="mobile-menu"
                      className="h-9 w-9 rounded-full flex items-center justify-center bg-base-200 text-base-content z-[110] relative focus-visible:outline-none focus-visible:ring-2"
                      style={{ border: "1.5px solid var(--base-300)" }}
                    >
                      <AnimatePresence mode="wait">
                        {mobileOpen ? (
                          <MotionSpan
                            key="x"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            aria-hidden="true"
                          >
                            <X size={18} />
                          </MotionSpan>
                        ) : (
                          <MotionSpan
                            key="menu"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            aria-hidden="true"
                          >
                            <Menu size={18} />
                          </MotionSpan>
                        )}
                      </AnimatePresence>
                    </MotionButton>
                  </IconTooltip>
                </>
              )}
            </div>
          </Container>
        </div>

        {/* ── MOBILE SUB-BAR ───────────────────────────────────────────── */}
        <MobileSubBarContent
          isCustomer={isCustomer}
          rolePalette={rolePalette}
          RoleIcon={RoleIcon}
          user={user}
          accentColor={accentColor}
          mood={mood}
          walletBalance={walletBalance}
        />

        {/* ── DESKTOP NAV — Customer only ─────────────────────────────── */}
        {isCustomer && (
          <nav
            className="hidden md:block py-0.5 transition-all duration-400 relative"
            style={navBarStyle}
            aria-label="Main navigation"
          >
            <Container className="flex items-center justify-center gap-0.5">
              {CUSTOMER_NAV_LINKS.map((link) => (
                <NavLink
                  key={link.name}
                  link={link}
                  pathname={pathname}
                  onHover={handleHover}
                  onLeave={handleLeave}
                  isHovered={hoveredLink === link.name}
                />
              ))}
            </Container>
          </nav>
        )}
      </header>

      {/* ── ROLE BOTTOM NAV ─────────────────────────────────────────────── */}
      {/* 🔄 UPDATED: Use isHiddenPage instead of isTrackingPage */}
      {!isCustomer && user && roleBottomNavLinks && !isHiddenPage && (
        <BottomNav
          links={roleBottomNavLinks}
          palette={rolePalette}
          pathname={pathname}
          dataTheme={headerDataTheme}
        />
      )}

      {/* ── CUSTOMER MOBILE BOTTOM NAV ───────────────────────────────── */}
      {/* 🔄 UPDATED: Use isHiddenPage instead of isTrackingPage */}
      {isCustomer && !isHiddenPage && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[99] flex md:hidden items-center justify-around border-t safe-bottom"
          style={{
            background: "color-mix(in srgb, var(--base-100) 93%, transparent)",
            borderColor: "var(--base-300)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Customer bottom nav items go here */}
        </div>
      )}

      {/* ── MOBILE FULLSCREEN MENU ───────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <MotionDiv
            id="mobile-menu"
            data-theme={headerDataTheme}
            variants={MOBILE_MENU_VARIANTS}
            initial="hidden"
            animate="show"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
            className={cn(
              "fixed inset-0 w-full h-full bg-base-100 z-[90] md:hidden",
              !isCustomer && roleBottomNavLinks ? "pb-[80px]" : "",
            )}
            style={{ paddingTop: `var(${HEADER_HEIGHT_VAR}, 80px)` }}
          >
            <div className="h-full overflow-y-auto px-5 pb-8 pt-4 flex flex-col gap-5">
              {/* Location widget in menu */}
              <LocationWidget mood={mood} isMobile />

              {/* User profile card */}
              {user ? (
                <div
                  className="p-5 rounded-3xl border relative"
                  style={mobileMenuAccentBorder}
                >
                  <div className="flex items-center gap-4 mb-5">
                    <div className="relative flex-shrink-0">
                      <Image
                        src={userAvatar}
                        alt={`${user.name} profile picture`}
                        width={64}
                        height={64}
                        className="rounded-2xl object-cover shadow-lg"
                        style={{
                          border: `3px solid ${mood?.accent ?? "var(--primary)"}`,
                        }}
                        unoptimized={userAvatar.includes("ui-avatars.com")}
                      />
                      <span
                        className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-base-100 rounded-full"
                        aria-label="Online"
                      />
                    </div>
                    <div>
                      <p className="font-black text-xl tracking-tight leading-tight">
                        {user.name}
                      </p>
                      <p className="text-xs opacity-50 mb-2">{user.email}</p>
                      <span
                        className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-white shadow-md"
                        style={{ background: mood?.accent ?? "var(--primary)" }}
                      >
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1">
                    <RoleNavLinks
                      user={user}
                      currentPathname={pathname}
                      onLinkClick={() => setMobileOpen(false)}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-3xl border border-dashed border-base-300 flex flex-col items-center text-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full bg-base-200 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <User className="opacity-20" />
                  </div>
                  <p className="text-xs font-bold opacity-60">
                    Sign in to manage your appointments and orders
                  </p>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="w-full"
                  >
                    <Button className="w-full rounded-xl py-6 text-white font-black uppercase tracking-widest">
                      Sign In
                    </Button>
                  </Link>
                </div>
              )}

              {/* Navigation links */}
              <nav aria-label="Mobile service navigation">
                <p
                  className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 px-3 mb-2"
                  aria-hidden="true"
                >
                  {isCustomer ? "Main Services" : "Navigation"}
                </p>
                <MotionUl
                  variants={STAGGER}
                  className="flex flex-col gap-2"
                  role="list"
                >
                  {(isCustomer
                    ? CUSTOMER_NAV_LINKS
                    : (roleBottomNavLinks ?? [])
                  ).map((link) => {
                    const isActive =
                      pathname === link.href ||
                      pathname.startsWith(link.href + "/");
                    const lAccent = isCustomer
                      ? link.accent
                      : (mood?.accent ?? "var(--primary)");
                    const shadowColor = isCustomer
                      ? link.shadowColor
                      : (mood?.shadowColor ??
                        "color-mix(in srgb, var(--primary) 35%, transparent)");
                    return (
                      <MotionLi key={link.name} variants={FADE_UP}>
                        <Link
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className="flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2"
                          style={
                            isActive
                              ? {
                                  background: "var(--base-100)",
                                  borderColor: lAccent,
                                  boxShadow: `0 10px 25px -5px ${shadowColor}`,
                                }
                              : {
                                  background: "transparent",
                                  borderColor: "var(--base-300)",
                                }
                          }
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                              style={{
                                background: isActive
                                  ? lAccent
                                  : "var(--base-100)",
                                color: isActive
                                  ? "var(--primary-content)"
                                  : lAccent,
                                border: isActive
                                  ? "none"
                                  : `1px solid color-mix(in srgb, ${lAccent} 20%, transparent)`,
                              }}
                              aria-hidden="true"
                            >
                              <link.icon size={22} strokeWidth={2.5} />
                            </div>
                            <div className="flex flex-col">
                              <span
                                className="font-black text-xs uppercase tracking-tight"
                                style={{
                                  color: isActive
                                    ? lAccent
                                    : "var(--base-content)",
                                }}
                              >
                                {link.name}
                              </span>
                              {isActive && (
                                <span
                                  className="text-[8px] font-bold uppercase tracking-widest text-green-500 animate-pulse"
                                  aria-live="polite"
                                >
                                  Current Section
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight
                            size={18}
                            className={cn(
                              "transition-transform",
                              isActive
                                ? "translate-x-1 opacity-100"
                                : "opacity-20",
                            )}
                            style={{ color: isActive ? lAccent : "inherit" }}
                            aria-hidden="true"
                          />
                        </Link>
                      </MotionLi>
                    );
                  })}
                </MotionUl>
              </nav>

              {/* Action buttons */}
              <div className="flex flex-col gap-3 mt-2">
                {user && (
                  <WalletWidget
                    walletBalance={walletBalance}
                    isMobile
                    accent={mood?.accent}
                    isCustomer={isCustomer}
                  />
                )}

                {(isCustomer || userRole === "pharmacy") && (
                  <Link
                    href="/pharmacy/cart"
                    onClick={() => setMobileOpen(false)}
                  >
                    <MotionButton
                      whileTap={{ scale: 0.97 }}
                      aria-label={`View cart with ${cartCount} items`}
                      className="w-full h-14 rounded-2xl font-black text-xs uppercase tracking-widest bg-base-200 border border-base-300 flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2"
                    >
                      <ShoppingCart size={18} aria-hidden="true" /> My Cart (
                      {cartCount})
                    </MotionButton>
                  </Link>
                )}

                {isCustomer && (
                  <Link
                    href="/book-appointment"
                    onClick={() => setMobileOpen(false)}
                  >
                    <MotionButton
                      whileTap={{ scale: 0.97 }}
                      aria-label="Book a medical appointment"
                      className="w-full h-14 rounded-2xl mb-20 font-black text-xs uppercase tracking-widest text-white flex items-center justify-center gap-3 transition-all shadow-xl focus-visible:outline-none focus-visible:ring-2"
                      style={{
                        background: mood?.barGradient ?? "var(--primary)",
                        boxShadow: mood
                          ? `0 8px 30px ${mood.shadowColor}`
                          : "0 8px 20px color-mix(in srgb, var(--primary) 20%, transparent)",
                      }}
                    >
                      <Calendar size={20} aria-hidden="true" /> Book Appointment
                    </MotionButton>
                  </Link>
                )}

                {user && (
                  <button
                    onClick={handleLogout}
                    aria-label="Sign out of your account"
                    className="w-full h-14 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all border border-red-500/20 text-red-500 bg-error/10 focus-visible:outline-none focus-visible:ring-2"
                  >
                    <LogOut size={16} aria-hidden="true" /> Sign Out
                  </button>
                )}
              </div>
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </>
  );
};

export default memo(Header);
