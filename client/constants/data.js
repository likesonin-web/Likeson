import React from "react";
import {
  // General & Branding
  Pill, UserRound, Hospital, Activity, ArrowLeftRight, LayoutPanelTop,
  LayoutDashboard, AreaChart, Building2,
  // User & Access
  Users, UserPlus, ShieldCheck, Contact2, MessageSquare, Video,
  // Financial
  CircleDollarSign, ReceiptIndianRupee, FileBarChart, WalletCards,
  CreditCard, Undo2, Landmark,
  // Healthcare Specific
  Network, UserCog, CalendarClock, CalendarCheck, Clock, CalendarDays,
  Stethoscope, HeartPulse, Microscope,
  // Logistics & Pharmacy
  Warehouse, Package, Truck, ShoppingCart, Store, Tablets,
  // Subscription & Admin
  Gem, ListChecks, ScrollText, History, MonitorSmartphone, Bell,
  // Partnership & Growth
  Handshake, HeartHandshake, Users2, Star, Briefcase,
  // Marketing
  Megaphone, Target, TicketPercent, Presentation, Image as ImageIcon,
  Share2, Mail,
  // Systems
  Settings2, ShieldAlert, Globe2, Component, Terminal, Plus,
  FileQuestion, LifeBuoy, MessageCircle, Scale, SquareDashedTopSolid,
  PanelsTopLeft, Car, AlertTriangle, Droplets
} from "lucide-react";
import { FcInvite } from "react-icons/fc";

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { name: "Buy Medicines",  href: "/pharmacy/buy-medicines", icon: Pill       },
  { name: "Find a Doctor",  href: "/doctors",                icon: UserRound  },
  { name: "Find Hospitals", href: "/hospitals",              icon: Hospital   },
  { name: "Membership",     href: "/membership",             icon: Gem        },
  { name: "Lab Tests",      href: "/diagnostics",            icon: Microscope },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_LINKS = [

  // ── 1. Overview & Analytics ───────────────────────────────────────────────
  {
    title: "Overview",
    icons: <LayoutPanelTop size={18} />,
    links: [
      { name: "Dashboard",       href: "/super-admin/dashboard",   icon: <LayoutDashboard size={15} /> },
      { name: "Analytics",       href: "/super-admin/analytics",   icon: <AreaChart size={15} />       },
      { name: "Referrals",       href: "/super-admin/referral",    icon: <FcInvite size={15} />        },
      { name: "Pricing",         href: "/super-admin/pricing",     icon: <CircleDollarSign size={15} />},
      { name: "Wallets",         href: "/super-admin/wallet",      icon: <WalletCards size={15} />     },
      { name: "Home Page Setup", href: "/super-admin/hero-page",   icon: <PanelsTopLeft size={15} />   },
    ],
  },

  // ── 2. User Management ────────────────────────────────────────────────────
  {
    title: "Users & Staff",
    icons: <Users size={18} />,
    links: [
      { name: "All Users",       href: "/super-admin/users",           icon: <Users size={15} />      },
      { name: "User Stats",      href: "/super-admin/users/analytics", icon: <AreaChart size={15} />  },
      { name: "Permissions",     href: "/super-admin/permissions",     icon: <ShieldAlert size={15} />},
      { name: "Employees",       href: "/super-admin/employees",       icon: <Contact2 size={15} />   },
    ],
  },

  // ── 3. Partner Network ────────────────────────────────────────────────────
  {
    title: "Partners",
    icons: <Handshake size={18} />,
    links: [
      { name: "Transport Partners", href: "/super-admin/partners/transport",      icon: <Truck size={15} />      },
      { name: "Solo Drivers",       href: "/super-admin/partners/solor-driver",   icon: <Car size={15} />        },
      { name: "Care Assistants",    href: "/super-admin/partners/care-assistants",icon: <Users2 size={15} />     },
      { name: "Labs",               href: "/super-admin/partners/labs",           icon: <Microscope size={15} /> },
      
    ],
  },

  // ── 4. Pharmacy & Supply Chain ────────────────────────────────────────────
  {
    title: "Pharmacy & Stock",
    icons: <Tablets size={18} />,
    links: [
      { name: "Pharmacies", href: "/super-admin/pharmacy",   icon: <Store size={15} />       },
      { name: "Medicines",  href: "/super-admin/medicines",  icon: <Tablets size={15} />     },
      { name: "Inventory",  href: "/super-admin/inventory",  icon: <Package size={15} />     },
      { name: "Orders",     href: "/super-admin/orders",     icon: <ShoppingCart size={15} />},
    ],
  },

  // ── 5. Clinical Network ───────────────────────────────────────────────────
  {
    title: "Hospitals & Doctors",
    icons: <Hospital size={18} />,
    links: [
      { name: "Hospitals",     href: "/super-admin/hospitals",        icon: <Hospital size={15} />      },
      { name: "Doctors",       href: "/super-admin/doctors",          icon: <UserCog size={15} />       },
      { name: "Appointments",  href: "/super-admin/appointments",     icon: <CalendarClock size={15} /> },
      { name: "Consultations", href: "/super-admin/consultations",    icon: <Activity size={15} />      },
      { name: "Specialties",   href: "/super-admin/specialties",      icon: <Stethoscope size={15} />   },
      { name: "Blood Bank",    href: "/super-admin/blood-bank",       icon: <Droplets size={15} />      },
    ],
  },

  // ── 6. Booking Engine ─────────────────────────────────────────────────────
  {
    title: "Bookings",
    icons: <CalendarCheck size={18} />,
    links: [
      { name: "All Bookings", href: "/super-admin/bookings",      icon: <CalendarCheck size={15} />},
      { name: "Schedules",    href: "/super-admin/schedules",     icon: <CalendarDays size={15} /> },
      { name: "Availability", href: "/super-admin/availability",  icon: <Clock size={15} />        },
    ],
  },

  // ── 7. Financials & Ledger ────────────────────────────────────────────────
  {
    title: "Finances",
    icons: <CircleDollarSign size={18} />,
    links: [
      { name: "Payments",     href: "/super-admin/payments",      icon: <Landmark size={15} />           },
      { name: "Transactions", href: "/super-admin/transactions",  icon: <ArrowLeftRight size={15} />     },
      { name: "Invoices",     href: "/super-admin/invoices",      icon: <ReceiptIndianRupee size={15} /> },
      { name: "Refunds",      href: "/super-admin/refunds",       icon: <Undo2 size={15} />              },
      { name: "Accounting",   href: "/super-admin/accounting",    icon: <FileBarChart size={15} />       }, 
    ],
  },

  // ── 8. Subscriptions ──────────────────────────────────────────────────────
  {
    title: "Subscriptions",
    icons: <Gem size={18} />,
    links: [
      { name: "Plans",       href: "/super-admin/subscription-plans", icon: <ListChecks size={15} />},
      { name: "Subscribers", href: "/super-admin/subscriptions",      icon: <Gem size={15} />      },
      { name: "Billing",     href: "/super-admin/billing",            icon: <CreditCard size={15} />},
    ],
  },

  // ── 9. Growth & Marketing ─────────────────────────────────────────────────
  {
    title: "Marketing",
    icons: <Target size={18} />,
    links: [
      { name: "Ads",       href: "/super-admin/ads",       icon: <Presentation size={15} /> },
      { name: "Banners",   href: "/super-admin/banners",   icon: <ImageIcon size={15} />    },
      { name: "Coupons",   href: "/super-admin/coupons",   icon: <TicketPercent size={15} />},
      { name: "Campaigns", href: "/super-admin/campaigns", icon: <Target size={15} />       },
    ],
  },

  // ── 10. Content & Communications ──────────────────────────────────────────
  {
    title: "Content & Alerts",
    icons: <LifeBuoy size={18} />,
    links: [
      { name: "Announcements", href: "/super-admin/marquee",           icon: <Megaphone size={15} />         },
      { name: "Legal",         href: "/super-admin/legal",             icon: <Scale size={15} />             },
      { name: "FAQs",          href: "/super-admin/faq",               icon: <FileQuestion size={15} />      },
      { name: "Notifications", href: "/super-admin/notifications",     icon: <Bell size={15} />              },
      { name: "Alerts",        href: "/super-admin/compliance/alerts", icon: <AlertTriangle size={15} />     },
      { name: "Activity Logs", href: "/super-admin/logs",              icon: <ScrollText size={15} />        },
    ],
  },

  // ── 11. System Settings ───────────────────────────────────────────────────
  {
    title: "Settings",
    icons: <Settings2 size={18}/>,
    links: [
      { name: "General Settings",  href: "/super-admin/settings/general",      icon: <Globe2 size={15} />      },
      { name: "Customer Support ",     href: "/support",                              icon: <MessageCircle size={15} />},
      { name: "Security Settings", href: "/super-admin/settings/security",     icon: <ShieldCheck size={15} /> },
      { name: "Integrations",      href: "/super-admin/settings/integrations", icon: <Terminal size={15} />    },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — TOP-RIGHT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_TOP_RIGHT_LINKS = [
  { name: "Home", icon: <LayoutDashboard size={15} /> },
  {
    name: "Quick Links",
    icon: <Briefcase size={15} />,
    links: [
      { name: "Hospitals",  href: "/super-admin/hospitals",  icon: <Hospital size={15} /> },
      { name: "Pharmacies", href: "/super-admin/pharmacies", icon: <Store size={15} />    },
      { name: "Users",      href: "/super-admin/users",      icon: <Users size={15} />    },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SUPER ADMIN — COMMAND PALETTE / SPOTLIGHT SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const SUPER_ADMIN_DASHBOARD_SEARCH_LINKS = [
  // Common Destinations
  [
    { name: "Dashboard", href: "/super-admin/dashboard",   icon: <LayoutDashboard size={15} /> },
    { name: "Medicines", href: "/super-admin/medicines",   icon: <Tablets size={15} />         },
    { name: "Bookings",  href: "/super-admin/bookings",    icon: <CalendarCheck size={15} />   },
    { name: "Support",   href: "/super-admin/support",     icon: <LifeBuoy size={15} />        },
    { name: "Ads",       href: "/super-admin/ads",         icon: <Presentation size={15} />    },
    { name: "Banners",   href: "/super-admin/banners",     icon: <ImageIcon size={15} />       },
    { name: "Coupons",   href: "/super-admin/coupons",     icon: <TicketPercent size={15} />   },
  ],
  // Creation Actions
  [
    { name: "Add Medicine",      href: "/super-admin/medicines/create", icon: <Plus size={15} />         },
    { name: "Add Coupon",        href: "/super-admin/coupons/create",   icon: <TicketPercent size={15} />},
    { name: "Add Announcement",  href: "/super-admin/announcements",    icon: <Megaphone size={15} />    },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const PROFILE_LINKS = [
  { name: "Profile",  href: "/super-admin/profile",      icon: <UserRound size={15} />  },
  { name: "Activity", href: "/super-admin/activity-log", icon: <HeartPulse size={15} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const SHORTCUTS = [
  { name: "Command Palette", keys: "Cmd + K" },
  { name: "Search",          keys: "Cmd + S" },
  { name: "Logout",          keys: "Cmd + Q" },
];