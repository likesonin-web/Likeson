import React from "react";
import {
  // Orders
  ShoppingCart, ClipboardList, Printer, MapPin,
  CheckCircle, RotateCcw, StickyNote, UserCheck, RefreshCw,
  Undo2, PackagePlus, PackageMinus,
  // Inventory
  Pill, Package, Warehouse, AlertTriangle, CalendarX,
  TrendingDown,
  // HSN
  Hash, Upload, BarChart3, Trash2, PenLine, ScrollText, Plus,
  // Financials
  CircleDollarSign, ReceiptIndianRupee, FileBarChart,
  CalendarDays, History, Send, Landmark, TrendingUp,
  // Payment Accounts & Settlements
  WalletCards, Building2, ArrowLeftRight, IndianRupee,
  // Analytics
  AreaChart,
  // Profile & Store
  UserRound, KeyRound, Store, Clock, ClipboardCheck,
  // Audit
  MonitorSmartphone, ShieldCheck, LogOut, Laptop,
  // Misc
  Bell, Box,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY DASHBOARD — SIDEBAR NAVIGATION
// Mirrors the router sections in pharmacy.routes.js (Sections A → H)
// ─────────────────────────────────────────────────────────────────────────────

export const PHARMACY_DASHBOARD_LINKS = [

  // ── A. Order Management ──────────────────────────────────────────────────
  // Routes 01–13 | Full order lifecycle: list → verify → confirm →
  // dispatch → return → refund → invoice → label.
  {
    title: "Order Management",
    icon: <ShoppingCart size={20} />,
    links: [
      { name: "All Orders",              href: "/pharmacy-store/orders",                         icon: <ClipboardList size={18} />      },
    ],
  },

  // ── B. Inventory Management ──────────────────────────────────────────────
  // Routes 14–21 | Per-store stock, batch tracking, expiry & restock requests.
  {
    title: "Inventory Management",
    icon: <Warehouse size={20} />,
    links: [
      { name: "Stocked Medicines", href: "/pharmacy-store/medicines",               icon: <Pill size={18} />         },
      { name: "Add Stock",         href: "/pharmacy-store/medicines/add-stock",      icon: <PackagePlus size={18} />  },
      { name: "Deduct Stock",      href: "/pharmacy-store/medicines/deduct-stock",   icon: <PackageMinus size={18} /> },
      { name: "Stock Details",     href: "/pharmacy-store/medicines/stock",          icon: <Package size={18} />      },
      { name: "All Batches",       href: "/pharmacy-store/inventory/batches",        icon: <Box size={18} />          },
      { name: "Expiry Alerts",     href: "/pharmacy-store/inventory/expiry-alerts",  icon: <CalendarX size={18} />    },
      { name: "Low Stock",         href: "/pharmacy-store/inventory/low-stock",      icon: <TrendingDown size={18} /> },
      { name: "Request Restock",   href: "/pharmacy-store/medicines/request-stock",  icon: <RefreshCw size={18} />    },
    ],
  },

  // ── C. Medicines Management ──────────────────────────────────────────────
  {
    title: "Medicines Management",
    icon: <Pill size={20} />,
    links: [
      { name: "Management",   href: "/pharmacy-store/medicines-management",      icon: <ClipboardList size={18} /> },
      { name: "New Medicine", href: "/pharmacy-store/medicines-management/new",  icon: <Plus size={18} />          },
    ],
  },

  // ── D. HSN Code Management ───────────────────────────────────────────────
  // Routes H1–H8 | GST-compliant HSN catalogue with bulk upload support.
  {
    title: "HSN Code Management",
    icon: <Hash size={20} />,
    links: [
      { name: "All HSN Codes", href: "/pharmacy-store/hsn",             icon: <ScrollText size={18} /> },
    ],
  },

  // ── E. Financial Reports & Earnings ─────────────────────────────────────
  // Routes 22–27 | Daily, monthly, and lifetime revenue plus store invoicing.
  {
    title: "Financial Reports",
    icon: <CircleDollarSign size={20} />,
    links: [
      { name: "Daily Financials",   href: "/pharmacy-store/financials/daily",              icon: <CalendarDays size={18} />       },
      { name: "Monthly Financials", href: "/pharmacy-store/financials/monthly",            icon: <FileBarChart size={18} />       },
      { name: "Total Earnings",     href: "/pharmacy-store/financials/total",              icon: <TrendingUp size={18} />         },
      { name: "Earnings History",   href: "/pharmacy-store/financials/history",            icon: <History size={18} />            },
      { name: "Store Invoice",      href: "/pharmacy-store/financials/store-invoice",      icon: <ReceiptIndianRupee size={18} /> },
      { name: "Send Invoice",       href: "/pharmacy-store/financials/store-invoice/send", icon: <Send size={18} />               },
    ],
  },

  // ── F. Settlements & Payment Accounts ───────────────────────────────────
  // Routes 28–36 | Bank accounts, UPI handles, and payout requests.
  {
    title: "Settlements & Payments",
    icon: <Landmark size={20} />,
    links: [
      { name: "Payment Account",      href: "/pharmacy-store/financials/payment-account",          icon: <WalletCards size={18} />      },
      { name: "Add Bank Account",     href: "/pharmacy-store/financials/payment-account/bank",     icon: <Building2 size={18} />        },
      { name: "Add UPI Handle",       href: "/pharmacy-store/financials/payment-account/upi",      icon: <IndianRupee size={18} />      },
      { name: "Settlements Overview", href: "/pharmacy-store/financials/settlements",              icon: <CircleDollarSign size={18} /> },
      { name: "Request Settlement",   href: "/pharmacy-store/financials/settlements/request",      icon: <ArrowLeftRight size={18} />   },
      { name: "Settlement History",   href: "/pharmacy-store/financials/settlements/history",      icon: <History size={18} />          },
    ],
  },

  // ── G. Analytics ─────────────────────────────────────────────────────────
  // Routes 37–40 | Store performance: revenue, returns, and top medicines.
  {
    title: "Analytics",
    icon: <AreaChart size={20} />,
    links: [
      { name: "Overview",         href: "/pharmacy-store/analytics/overview",      icon: <AreaChart size={18} />   },
      { name: "Revenue Trends",   href: "/pharmacy-store/analytics/revenue",       icon: <TrendingUp size={18} />  },
      { name: "Returns Analysis", href: "/pharmacy-store/analytics/returns",       icon: <RotateCcw size={18} />   },
      { name: "Top Medicines",    href: "/pharmacy-store/analytics/top-medicines", icon: <Pill size={18} />        },
    ],
  },

  // ── H. Profile & Store ───────────────────────────────────────────────────
  // Routes 41–48 | Personal profile, pharmacy-store credentials, and store config.
  {
    title: "Profile & Store",
    icon: <UserRound size={20} />,
    links: [
      { name: "My Profile",        href: "/pharmacy-store/profile",                 icon: <UserRound size={18} />      },
      { name: "Edit Profile",      href: "/pharmacy-store/profile/edit",            icon: <PenLine size={18} />        },
      { name: "Change Password",   href: "/pharmacy-store/profile/password",        icon: <KeyRound size={18} />       },
      { name: "Pharmacy Profile",  href: "/pharmacy-store/profile/pharmacy",        icon: <ClipboardCheck size={18} /> },
      { name: "Store Settings",    href: "/pharmacy-store/store",                   icon: <Store size={18} />          },
      { name: "Inventory Summary", href: "/pharmacy-store/store/inventory-summary", icon: <Package size={18} />        },
    ],
  },

  // ── I. Sessions & Devices ───────────────────────────────────────────────
  // Routes 49–54 | Active login sessions and registered device management.
  {
    title: "Sessions & Devices",
    icon: <ShieldCheck size={20} />,
    links: [
      { name: "Active Sessions", href: "/pharmacy-store/audit/sessions",        icon: <Clock size={18} />            },
      { name: "Revoke Session",  href: "/pharmacy-store/audit/sessions/revoke", icon: <LogOut size={18} />           },
      { name: "Revoke All",      href: "/pharmacy-store/audit/all-sessions",    icon: <ShieldCheck size={18} />      },
      { name: "All Devices",     href: "/pharmacy-store/audit/devices",         icon: <MonitorSmartphone size={18} />},
      { name: "Remove Device",   href: "/pharmacy-store/audit/devices/remove",  icon: <Laptop size={18} />           },
      { name: "Remove All",      href: "/pharmacy-store/audit/devices/all",     icon: <Trash2 size={18} />           },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY — TOP-RIGHT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const PHARMACY_TOP_RIGHT_LINKS = [
  { name: "Orders",    href: "/pharmacy-store/orders",                  icon: <ShoppingCart size={18} />  },
  { name: "Low Stock", href: "/pharmacy-store/inventory/low-stock",     icon: <AlertTriangle size={18} /> },
  { name: "Expiry",    href: "/pharmacy-store/inventory/expiry-alerts", icon: <Bell size={18} />          },
];

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY — PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const PHARMACY_PROFILE_LINKS = [
  { name: "My Profile",      href: "/pharmacy-store/profile",          icon: <UserRound size={18} />  },
  { name: "Store Settings",  href: "/pharmacy-store/store",            icon: <Store size={18} />      },
  { name: "Change Password", href: "/pharmacy-store/profile/password", icon: <KeyRound size={18} />   },
  { name: "Sessions",        href: "/pharmacy-store/audit/sessions",   icon: <ShieldCheck size={18} />},
];

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACY — KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const PHARMACY_SHORTCUTS = [
  { name: "Command Palette", keys: "Cmd + K" },
  { name: "Search Orders",   keys: "Cmd + S" },
  { name: "Logout",          keys: "Cmd + Q" },
];