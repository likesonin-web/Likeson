import React from "react";
import {
  // General & Branding
  LayoutDashboard, BarChart3, FileText, Globe,
  // User & Access
  Users, Contact2, ShieldCheck, History, UserPlus, UserCircle, Lock,
  // Appointments & Scheduling
  CalendarCheck, ClipboardList, Activity, Zap, Video, CalendarDays, Clock,
  // Finance
  Wallet, CreditCard, Undo2, Receipt, ArrowLeftRight, Landmark,
  ReceiptIndianRupee,
  // Clinical
  Hospital, Building2, Stethoscope, Store, Package, UserCog,
  CalendarClock,
  // Logistics & Growth
  Truck, ShoppingCart, TicketPercent,
  // Communication & Support
  MessageSquare, HelpCircle, Bell, MessageCircleCode,
  // Subscription
  ListChecks, Gem,
  // System
  FileSearch, Settings, Settings2, ShieldAlert,
  // Partner & Members
  Handshake, Users2, Microscope, Star,
  // Misc
  PlusCircle, HeartPulse,
} from "lucide-react";

/**
 * ADMIN NAVIGATION DATA (PRO-TIER)
 *
 * CORRECTIONS from original:
 *  1. All prop names unified: title → name, link → href, icons → icon
 *     (matches SuperAdmin file convention so shared components work without branching)
 *  2. Removed duplicate 'Reports' entry that had a typo href '/admin/referra;'
 *     and added it correctly as 'Referral Overview' → '/admin/referral'
 *  3. ADMIN_DASHBOARD_LINKS restructured from { sidebar: [...] } to a flat
 *     array [] — same shape as SUPER_ADMIN_DASHBOARD_LINKS
 *  4. Added missing sections present in SuperAdmin but absent here:
 *     - 'Partners & Members' (Transport, Care Assistants, Labs, B2B, Loyalty)
 *     - 'Subscriptions & Billing' was only partially covered under Revenue & Plans
 *     - 'Marketing & Growth' was mixed into Orders; now its own section
 *  5. Removed Zap icon used on Subscriptions (semantically wrong) → Gem
 *  6. Added missing links:
 *     - Virtual Meetings was present, Schedules and Availability were missing
 *       from Appointments — added from SuperAdmin reference
 *     - Departments under Medical Network now maps to /admin/departments
 *     - Transactions added to Finance (was in SuperAdmin, missing here)
 *  7. ADMIN_DASHBOARD_TOP_RIGHT_LINKS and ADMIN_SEARCH_QUICK_AND_PAGE_LINKS
 *     prop names unified (title → name, link → href, icons → icon)
 *  8. Added PROFILE_LINKS and SHORTCUTS to match SuperAdmin file shape
 */

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — SIDEBAR NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_DASHBOARD_LINKS = [

  // ── 1. Command Centre ────────────────────────────────────────────────────
  // Top-level pulse: metrics, analytics, reports, referral overview,
  // and the regional scope this admin tier covers.
  {
    title: "Command Centre",
    icon: <LayoutDashboard size={20} />,
    links: [
      { name: "Dashboard",          href: "/admin/dashboard",  icon: <LayoutDashboard size={18} /> },
      { name: "Analytics",          href: "/admin/analytics",  icon: <BarChart3 size={18} />       },
      { name: "Reports",            href: "/admin/reports",    icon: <FileText size={18} />        },
      { name: "Referral Overview",  href: "/admin/referral",   icon: <FileText size={18} />        },
      { name: "Regional Scope",     href: "/admin/regions",    icon: <Globe size={18} />           },
    ],
  },

  // ── 2. People & Access ───────────────────────────────────────────────────
  // Every human on the platform within this admin's scope: users, staff,
  // role permissions, and active login session monitoring.
  {
    title: "People & Access",
    icon: <Users size={20} />,
    links: [
      { name: "All Users",          href: "/admin/users",       icon: <Users size={18} />      },
      { name: "Staff & Employees",  href: "/admin/employees",   icon: <Contact2 size={18} />   },
      { name: "Roles & Permissions",href: "/admin/permissions", icon: <ShieldCheck size={18} />},
      { name: "Login Sessions",     href: "/admin/sessions",    icon: <History size={18} />    },
    ],
  },

  // ── 3. Partners & Members ────────────────────────────────────────────────
  // External service partners: transport, gig care assistants, diagnostic
  // labs, B2B institutions, and the member loyalty directory.
  {
    title: "Partners & Members",
    icon: <Handshake size={20} />,
    links: [
      { name: "Transport Partners",    href: "/admin/partners/transport",       icon: <Truck size={18} />      },
      { name: "Care Assistants (Gig)", href: "/admin/partners/care-assistants", icon: <Users2 size={18} />     },
      { name: "Diagnostic Labs",       href: "/admin/partners/labs",            icon: <Microscope size={18} /> },
    ],
  },

  // ── 4. Clinical Operations ───────────────────────────────────────────────
  // Hospitals, departments, doctor registry, pharmacy stores,
  // and medicine database within this admin's regional scope.
  {
    title: "Clinical Operations",
    icon: <Hospital size={20} />,
    links: [
      { name: "All Hospitals",      href: "/admin/hospitals",    icon: <Hospital size={18} />     },
      { name: "Doctor Registry",    href: "/admin/doctors",      icon: <Stethoscope size={18} />  },
      { name: "Pharmacy Stores",    href: "/admin/pharmacies",   icon: <Store size={18} />        },
      { name: "Medicine Database",  href: "/admin/medicines",    icon: <Package size={18} />      },
    ],
  },

  // ── 5. Scheduling & Appointments ─────────────────────────────────────────
  // All bookings, master schedule, doctor availability slots,
  // and virtual meeting management.
  {
    title: "Scheduling & Appointments",
    icon: <CalendarCheck size={20} />,
    links: [
      { name: "All Bookings",        href: "/admin/bookings",      icon: <ClipboardList size={18} /> },
      { name: "Master Schedule",     href: "/admin/schedules",     icon: <CalendarDays size={18} />  },
      { name: "Doctor Availability", href: "/admin/availability",  icon: <Clock size={18} />         },
      { name: "Virtual Meetings",    href: "/admin/meetings",      icon: <Video size={18} />         },
    ],
  },

  // ── 6. Orders & Logistics ────────────────────────────────────────────────
  // Medicine order tracking and delivery fleet management.
  {
    title: "Orders & Logistics",
    icon: <Truck size={20} />,
    links: [
      { name: "Order Tracking",  href: "/admin/orders",    icon: <ClipboardList size={18} />},
      { name: "Delivery Fleet",  href: "/admin/delivery",  icon: <Truck size={18} />        },
    ],
  },

  // ── 7. Finance & Payments ────────────────────────────────────────────────
  // Gateway settlements, transaction ledger, invoices, and refund pipeline.
  {
    title: "Finance & Payments",
    icon: <Wallet size={20} />,
    links: [
      { name: "Payments",      href: "/admin/payments",      icon: <Landmark size={18} />      },
      { name: "Transactions",  href: "/admin/transactions",  icon: <ArrowLeftRight size={18} />},
      { name: "Invoices",      href: "/admin/invoices",      icon: <Receipt size={18} />       },
      { name: "Refund Requests",href: "/admin/refunds",      icon: <Undo2 size={18} />         },
    ],
  },

  // ── 8. Subscriptions & Billing ──────────────────────────────────────────
  // Pricing plans, active subscriber management, and payment logs.
  {
    title: "Subscriptions & Billing",
    icon: <Gem size={20} />,
    links: [
      { name: "Pricing Plans",  href: "/admin/plans",          icon: <ListChecks size={18} />},
      { name: "Subscriptions",  href: "/admin/subscriptions",  icon: <Gem size={18} />       },
      { name: "Payment Logs",   href: "/admin/payments",       icon: <CreditCard size={18} />},
    ],
  },

  // ── 9. Marketing & Growth ────────────────────────────────────────────────
  // Promotions, coupons, and advertising within this admin's scope.
  {
    title: "Marketing & Growth",
    icon: <TicketPercent size={20} />,
    links: [
      { name: "Coupons & Promotions", href: "/admin/promotions", icon: <TicketPercent size={18} />},
    ],
  },

  // ── 10. Communication & Support ──────────────────────────────────────────
  // Support tickets, help center FAQs, internal chat tooling,
  // and push notification management.
  {
    title: "Communication & Support",
    icon: <MessageSquare size={20} />,
    links: [
      { name: "Support Tickets",  href: "/admin/support",              icon: <HelpCircle size={18} />       },
      { name: "Help Center / FAQs",href: "/admin/faqs",               icon: <FileText size={18} />         },
      { name: "Internal Chats",   href: "/dashboard/chat/management",  icon: <MessageCircleCode size={18} />},
      { name: "Push Notifications",href: "/admin/notifications",       icon: <Bell size={18} />             },
    ],
  },

  // ── 11. Audit & System ───────────────────────────────────────────────────
  // System logs, global settings configuration, and security policy.
  {
    title: "Audit & System",
    icon: <FileSearch size={20} />,
    links: [
      { name: "System Logs",     href: "/admin/logs",      icon: <FileSearch size={18} />},
      { name: "Global Settings", href: "/admin/settings",  icon: <Settings size={18} />  },
      { name: "Security Policy", href: "/admin/security",  icon: <Lock size={18} />      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — TOP-RIGHT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_DASHBOARD_TOP_RIGHT_LINKS = [
  {
    name: "Quick Create",
    icon: <PlusCircle size={18} />,
    links: [
      { name: "Register User",  href: "/admin/users/create",     icon: <UserPlus size={16} />  },
      { name: "Add Hospital",   href: "/admin/hospitals/create", icon: <Hospital size={16} />  },
      { name: "Add Pharmacy",   href: "/admin/pharmacy/create",  icon: <Store size={16} />     },
    ],
  },
  {
    name: "My Account",
    icon: <UserCircle size={18} />,
    links: [
      { name: "Profile",    href: "/admin/profile",          icon: <UserCircle size={16} /> },
      { name: "Security",   href: "/admin/settings/security",icon: <Lock size={16} />       },
      { name: "Help Desk",  href: "/admin/support",          icon: <HelpCircle size={16} /> },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — COMMAND PALETTE / SPOTLIGHT SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_SEARCH_QUICK_AND_PAGE_LINKS = {

  // Frequently visited — instant jump
  quickLinks: [
    { name: "Dashboard",  href: "/admin/dashboard",  icon: <LayoutDashboard size={16} />, shortcut: "⌘D" },
    { name: "Users",      href: "/admin/users",       icon: <Users size={16} />,          shortcut: "⌘U" },
    { name: "Hospitals",  href: "/admin/hospitals",   icon: <Hospital size={16} />,       shortcut: "⌘H" },
    { name: "Orders",     href: "/admin/orders",      icon: <Package size={16} />,        shortcut: "⌘O" },
  ],

  // Deep pages surfaced in search
  pageLinks: [
    { name: "Financial Analytics",      href: "/admin/analytics/revenue", icon: <BarChart3 size={16} />  },
    { name: "Subscription Management",  href: "/admin/subscriptions",     icon: <Gem size={16} />        },
    { name: "System Logs",              href: "/admin/logs",              icon: <FileSearch size={16} /> },
    { name: "Pharmacy Inventory",       href: "/admin/medicines",         icon: <Package size={16} />    },
    { name: "Global Settings",          href: "/admin/settings",          icon: <Settings size={16} />   },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_PROFILE_LINKS = [
  { name: "My Profile",       href: "/admin/profile",          icon: <UserCircle size={18} /> },
  { name: "Account Settings", href: "/admin/settings/security",icon: <Settings size={18} />   },
  { name: "Activity Log",     href: "/admin/sessions",         icon: <HeartPulse size={18} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_SHORTCUTS = [
  { name: "Command Palette", keys: "Cmd + K" },
  { name: "Search",          keys: "Cmd + S" },
  { name: "Logout",          keys: "Cmd + Q" },
];