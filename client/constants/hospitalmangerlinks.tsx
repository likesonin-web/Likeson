import React from "react";
import {
  LayoutDashboard,
  Hospital,
  UserCog,
  Stethoscope,
  Users,
  Search,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Image as ImageIcon,
  FileText,
  Bell,
  ShieldCheck,
  LogOut,
  UserRound,
  Smartphone,
  CheckCircle2,
  MapPin,
  KeyRound,
  Shield,
  Settings,
  ClipboardList,
  CalendarCheck,
  Headset, // Added for Support
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// HOSPITAL MANAGER — SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const HOSPITAL_MANAGER_DASHBOARD_LINKS = [
  // ── 1. Dashboard (Simplified from Command Centre) ────────────────────────
  {
    title: "Dashboard",
    icons: <LayoutDashboard size={20} />,
    links: [
      { name: "Overview",       href: "/hospital-manager/dashboard",     icon: <LayoutDashboard size={18} /> },
      { name: "Setup Guide",    href: "/hospital-manager/onboarding",    icon: <CheckCircle2 size={18} />    },
      { name: "Notifications",  href: "/hospital-manager/notifications", icon: <Bell size={18} />         },
    ],
  },

  // ── 2. Appointments (Simplified from Patient Operations) ─────────────────
  {
    title: "Appointments",
    icons: <CalendarCheck size={20} />,
    links: [
      { name: "Upcoming",       href: "/hospital-manager/bookings/upcoming", icon: <CalendarCheck size={18} /> },
      { name: "All Records",    href: "/hospital-manager/ops",               icon: <ClipboardList size={18} /> },
    ],
  },

  // ── 3. Hospital Details (Simplified from Facility Management) ────────────
  {
    title: "Hospital Details",
    icons: <Hospital size={20} />,
    links: [
      { name: "Profile",        href: "/hospital-manager/profile",         icon: <Hospital size={18} />  },
      { name: "Location",       href: "/hospital-manager/location",        icon: <MapPin size={18} />    },
      { name: "Timings",        href: "/hospital-manager/operating-hours", icon: <Clock size={18} />     },
      { name: "Photos",         href: "/hospital-manager/gallery",         icon: <ImageIcon size={18} /> },
      { name: "Documents",      href: "/hospital-manager/registration",    icon: <FileText size={18} />  },
    ],
  },

  // ── 4. Doctors (Simplified from Medical Staff) ───────────────────────────
  {
    title: "Doctors",
    icons: <Stethoscope size={20} />,
    links: [
      { name: "Our Doctors",    href: "/hospital-manager/doctors",              icon: <Users size={18} />       },
      { name: "Add Doctor",     href: "/hospital-manager/doctors/search",       icon: <Search size={18} />      },
      { name: "Performance",    href: "/hospital-manager/doctors/stats",        icon: <UserCog size={18} />     },
      { name: "Schedules",      href: "/hospital-manager/doctors/availability", icon: <CalendarDays size={18} /> },
    ],
  },

  // ── 5. Pricing (Simplified from Commercials) ─────────────────────────────
  {
    title: "Pricing",
    icons: <CircleDollarSign size={20} />,
    links: [
      { name: "Doctor Fees",    href: "/hospital-manager/pricing", icon: <CircleDollarSign size={18} /> },
    ],
  },

  // ── 6. Settings (Simplified from Settings & Security) ────────────────────
  {
    title: "Settings",
    icons: <Settings size={20} />,
    links: [
      { name: "My Account",     href: "/hospital-manager/settings/account",  icon: <UserRound size={18} />   },
      { name: "Security",       href: "/hospital-manager/security/password", icon: <KeyRound size={18} />    },
      { name: "Active Devices", href: "/hospital-manager/security/sessions", icon: <Smartphone size={18} />  },
    ],
  },

  // ── 7. Help & Support (NEW) ──────────────────────────────────────────────
  {
    title: "Help & Support",
    icons: <Headset size={20} />,
    links: [
      { name: "Contact Support", href: "/hospital-manager/support", icon: <Headset size={18} /> },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// TOP-RIGHT QUICK ACCESS (Simplified names & Added Support)
// ─────────────────────────────────────────────────────────────────────────────

export const HOSPITAL_MANAGER_TOP_RIGHT_LINKS = [
  { name: "Home",    icon: <LayoutDashboard size={18} />, href: "/hospital-manager/dashboard" },
  { name: "Support", icon: <Headset size={18} />,         href: "/hospital-manager/support" }, // New Quick Access
  {
    name: "Quick Actions",
    icon: <UserCog size={18} />,
    links: [
      { name: "Appointments", href: "/hospital-manager/bookings/upcoming", icon: <CalendarCheck size={18} /> },
      { name: "Add Doctor",   href: "/hospital-manager/doctors/search",    icon: <Users size={18} /> },
      { name: "Update Fees",  href: "/hospital-manager/pricing",           icon: <CircleDollarSign size={18} /> },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DROPDOWN (Removed redundant links & Added Support)
// ─────────────────────────────────────────────────────────────────────────────

export const HOSPITAL_MANAGER_PROFILE_LINKS = [
  { name: "My Profile",  href: "/hospital-manager/settings/account",  icon: <UserRound size={18} />  },
  { name: "Security",    href: "/hospital-manager/security/password", icon: <Shield size={18} />     },
  { name: "Settings",    href: "/settings",                           icon: <Settings size={18}/>    },
  { name: "Support",     href: "/hospital-manager/support",           icon: <Headset size={18} />    }, // New Profile Link
  { name: "Logout",      href: "/logout",                             icon: <LogOut size={18} />     },
];