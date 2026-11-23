'use client';

import React from "react";
import {
  LayoutDashboard, BarChart3, TrendingUp,
  Car, CalendarDays, MapPin, CheckCircle2, History, Ban,
  ShieldCheck, Construction, MonitorSmartphone,
  UserPlus, Users,
  Wallet, Banknote, ReceiptText,
  MessageSquare, HelpCircle, Settings, User, Bell,
  PlusCircle, Activity, Search,
  Navigation, Gauge, Route, Truck, Radio,
  HeartHandshake, ArrowUpRight, Clock, FileText,
  Star, Award, CreditCard, Zap, Coffee, Shield,
  Lock, Layers, SlidersHorizontal, Building2, FileBadge,
  LogOut, UserCog, ScrollText, MapPinOff, BadgeCheck,
  AlignJustify, AlertTriangle, RefreshCw, DollarSign,
  ClipboardList, Package,
} from "lucide-react";

// =============================================================================
// TRANSPORT PARTNER (Agency Owner) — role: 'transportpartner'
//
// Booking router routes (bookingRouter.js — non-customer):
//   GET    /api/bookings/tp/assigned              — view assigned bookings
//   GET    /api/bookings/tp/drivers/available     — available drivers in fleet
//   PATCH  /api/bookings/:id/tp/assign-driver     — assign driver to booking
//   PATCH  /api/bookings/:id/tp/reassign-driver   — reassign driver
//
// Transport partner own routes (TransportPartnerRoutes.js):
//   PATCH /api/transport/profile
//   PUT   /api/transport/kyc
//   GET   /api/transport/kyc/status
//   PATCH /api/transport/settings/notifications
//   PATCH /api/transport/settings/availability
//   PATCH /api/transport/settings/settlement-cycle
//   GET   /api/transport/security/sessions
//   DELETE /api/transport/security/sessions/:id
//   DELETE /api/transport/security/device-tokens/:id
//   GET/POST/PATCH/DELETE /api/transport/vehicles
//   PATCH /api/transport/vehicles/:id/assign-driver
//   PATCH /api/transport/vehicles/:id/unassign-driver
//   POST  /api/transport/vehicles/:id/photos
//   GET/POST/PATCH/DELETE /api/transport/drivers
//   PATCH /api/transport/drivers/:id/toggle-active
//   PATCH /api/transport/drivers/:id/pause
//   PATCH /api/transport/drivers/:id/unpause
//   GET   /api/transport/drivers/:id/performance
//   GET   /api/transport/drivers/:id/logs
//   GET/POST /api/transport/bank
//   POST  /api/transport/bank/accounts
//   PATCH /api/transport/bank/accounts/:id/set-primary
//   DELETE /api/transport/bank/accounts/:id
//   POST/DELETE /api/transport/bank/upi
//   PATCH /api/transport/bank/preferred-method
//   GET/POST/PATCH/DELETE /api/transport/zones
//   GET/PATCH /api/transport/pricing
//   GET /api/transport/dashboard
//   GET /api/transport/logs
// =============================================================================

export const TRANSPORT_PARTNER_LINKS = {
  sidebar: [
    // ── Overview ──────────────────────────────────────────────────────────────
    {
      title: "Overview",
      icons: <LayoutDashboard size={20} />,
      links: [
        {
          title: "Fleet Dashboard",
          link:  "/transport-partner/dashboard",       // → GET /api/transport/dashboard
          icons: <LayoutDashboard size={16} />,
        },
        {
          title: "Activity Logs",
          link:  "/transport-partner/logs",            // → GET /api/transport/logs
          icons: <ScrollText size={16} />,
        },
        {
          title: "Work Calendar",
          link:  "/transport-partner/calendar",        // → GET /api/transport/calendar
          icons: <CalendarDays size={16} />,
        },
      ],
    },

    // ── Bookings (booking router) ──────────────────────────────────────────────
    // Routes: GET /api/bookings/tp/assigned
    //         PATCH /api/bookings/:id/tp/assign-driver
    //         PATCH /api/bookings/:id/tp/reassign-driver
    {
      title: "Bookings",
      icons: <ClipboardList size={20} />,
      links: [
        {
          title: "Assigned Bookings",
          link:  "/transport-partner/bookings/assigned",  // → GET /api/bookings/tp/assigned
          icons: <ClipboardList size={16} />,
        },
        {
          title: "Assign Driver",
          link:  "/transport-partner/bookings/assign",    // → PATCH /api/bookings/:id/tp/assign-driver
          icons: <UserPlus size={16} />,
        },
        {
          title: "Reassign Driver",
          link:  "/transport-partner/bookings/reassign",  // → PATCH /api/bookings/:id/tp/reassign-driver
          icons: <RefreshCw size={16} />,
        },
      ],
    },

    // ── Drivers — available list (booking router) ─────────────────────────────
    // Route: GET /api/bookings/tp/drivers/available
    // Also links to full driver mgmt below (TransportPartnerRoutes.js)

    // ── Vehicles (§B) ─────────────────────────────────────────────────────────
    {
      title: "Fleet / Vehicles",
      icons: <Car size={20} />,
      links: [
        {
          title: "All Vehicles",
          link:  "/transport-partner/fleet/vehicles",     // → GET  /api/transport/vehicles
          icons: <Car size={16} />,
        },
        {
          title: "Add Vehicle",
          link:  "/transport-partner/fleet/vehicles/new", // → POST /api/transport/vehicles
          icons: <PlusCircle size={16} />,
        },
      ],
    },

    // ── Drivers (§C) ─────────────────────────────────────────────────────────
    {
      title: "Driver Management",
      icons: <Users size={20} />,
      links: [
        {
          title: "All Drivers",
          link:  "/transport-partner/drivers",            // → GET  /api/transport/drivers
          icons: <Users size={16} />,
        },
        {
          title: "Available Drivers",
          link:  "/transport-partner/drivers/available",  // → GET /api/bookings/tp/drivers/available
          icons: <Activity size={16} />,
        },
        {
          title: "Add Driver",
          link:  "/transport-partner/drivers/new",        // → POST /api/transport/drivers
          icons: <UserPlus size={16} />,
        },
        {
          title: "Driver Performance",
          link:  "/transport-partner/drivers/performance",// → GET /api/transport/drivers/:id/performance
          icons: <BarChart3 size={16} />,
        },
      ],
    },

    // ── Bank & Settlement (§D) ────────────────────────────────────────────────
    {
      title: "Bank & Settlement",
      icons: <Wallet size={20} />,
      links: [
        {
          title: "Bank Accounts",
          link:  "/transport-partner/bank/accounts",      // → GET/POST /api/transport/bank/accounts
          icons: <Banknote size={16} />,
        },
        {
          title: "UPI Handles",
          link:  "/transport-partner/bank/upi",           // → POST/DELETE /api/transport/bank/upi
          icons: <Zap size={16} />,
        },
        {
          title: "Settlement Preference",
          link:  "/transport-partner/bank/settlement",    // → PATCH /api/transport/bank/preferred-method
                                                          //   PATCH /api/transport/settings/settlement-cycle
          icons: <ReceiptText size={16} />,
        },
      ],
    },

    // ── Service Zones & Pricing (§E) ─────────────────────────────────────────
    {
      title: "Zones & Pricing",
      icons: <MapPin size={20} />,
      links: [
        {
          title: "Service Zones",
          link:  "/transport-partner/zones",              // → GET/POST/PATCH/DELETE /api/transport/zones
          icons: <MapPin size={16} />,
        },
        {
          title: "Pricing Config",
          link:  "/transport-partner/pricing",            // → GET/PATCH /api/transport/pricing
          icons: <SlidersHorizontal size={16} />,
        },
      ],
    },

    // ── Settings (§A) ─────────────────────────────────────────────────────────
    {
      title: "Settings",
      icons: <Settings size={20} />,
      links: [
        {
          title: "Agency Profile",
          link:  "/transport-partner/settings/profile",   // → PATCH /api/transport/profile
          icons: <Building2 size={16} />,
        },
        {
          title: "KYC / Documents",
          link:  "/transport-partner/settings/kyc",       // → PUT /api/transport/kyc
                                                          //   GET /api/transport/kyc/status
          icons: <FileBadge size={16} />,
        },
        {
          title: "Notifications",
          link:  "/transport-partner/settings/notifications", // → PATCH /api/transport/settings/notifications
          icons: <Bell size={16} />,
        },
        {
          title: "Availability",
          link:  "/transport-partner/settings/availability",  // → PATCH /api/transport/settings/availability
          icons: <Clock size={16} />,
        },
        {
          title: "Security & Sessions",
          link:  "/transport-partner/settings/security",  // → GET/DELETE /api/transport/security/sessions
                                                          //   DELETE /api/transport/security/device-tokens/:id
          icons: <Lock size={16} />,
        },
      ],
    },
  ],
};

export const TRANSPORT_PARTNER_TOP_RIGHT = [
  {
    title: "Quick Actions",
    icons: <PlusCircle size={16} />,
    links: [
      {
        title: "Assigned Bookings",
        link:  "/transport-partner/bookings/assigned",   // → GET /api/bookings/tp/assigned
        icons: <ClipboardList size={14} />,
      },
      {
        title: "Add Vehicle",
        link:  "/transport-partner/fleet/vehicles/new",  // → POST /api/transport/vehicles
        icons: <PlusCircle size={14} />,
      },
      {
        title: "Add Driver",
        link:  "/transport-partner/drivers/new",         // → POST /api/transport/drivers
        icons: <UserPlus size={14} />,
      },
      {
        title: "Available Drivers",
        link:  "/transport-partner/drivers/available",   // → GET /api/bookings/tp/drivers/available
        icons: <Activity size={14} />,
      },
    ],
  },
  {
    title: "Account",
    icons: <User size={16} />,
    links: [
      {
        title: "Agency Profile",
        link:  "/transport-partner/settings/profile",    // → PATCH /api/transport/profile
        icons: <User size={14} />,
      },
      {
        title: "KYC Status",
        link:  "/transport-partner/settings/kyc",        // → GET /api/transport/kyc/status
        icons: <BadgeCheck size={14} />,
      },
      {
        title: "Security",
        link:  "/transport-partner/settings/security",   // → GET /api/transport/security/sessions
        icons: <Lock size={14} />,
      },
    ],
  },
];

export const TRANSPORT_PARTNER_SEARCH = {
  quickLinks: [
    {
      title:    "Fleet Dashboard",
      link:     "/transport-partner/dashboard",            // → GET /api/transport/dashboard
      icons:    <LayoutDashboard size={18} />,
      shortcut: "T+D",
    },
    {
      title:    "Assigned Bookings",
      link:     "/transport-partner/bookings/assigned",    // → GET /api/bookings/tp/assigned
      icons:    <ClipboardList size={18} />,
      shortcut: "T+A",
    },
    {
      title:    "Vehicles",
      link:     "/transport-partner/fleet/vehicles",       // → GET /api/transport/vehicles
      icons:    <Car size={18} />,
      shortcut: "T+V",
    },
    {
      title:    "Drivers",
      link:     "/transport-partner/drivers",              // → GET /api/transport/drivers
      icons:    <Users size={18} />,
      shortcut: "T+R",
    },
    {
      title:    "Bank",
      link:     "/transport-partner/bank/accounts",        // → GET /api/transport/bank
      icons:    <Wallet size={18} />,
      shortcut: "T+B",
    },
  ],
  pageLinks: [
    // Overview
    { title: "Fleet Dashboard",          link: "/transport-partner/dashboard",                icons: <LayoutDashboard size={16} /> }, // GET /api/transport/dashboard
    { title: "Activity Logs",            link: "/transport-partner/logs",                     icons: <ScrollText size={16} /> },      // GET /api/transport/logs

    // Bookings (booking router)
    { title: "Assigned Bookings",        link: "/transport-partner/bookings/assigned",        icons: <ClipboardList size={16} /> },   // GET /api/bookings/tp/assigned
    { title: "Assign Driver to Booking", link: "/transport-partner/bookings/assign",          icons: <UserPlus size={16} /> },        // PATCH /api/bookings/:id/tp/assign-driver
    { title: "Reassign Driver",          link: "/transport-partner/bookings/reassign",        icons: <RefreshCw size={16} /> },       // PATCH /api/bookings/:id/tp/reassign-driver
    { title: "Available Drivers",        link: "/transport-partner/drivers/available",        icons: <Activity size={16} /> },        // GET /api/bookings/tp/drivers/available

    // Vehicles
    { title: "All Vehicles",             link: "/transport-partner/fleet/vehicles",           icons: <Car size={16} /> },             // GET /api/transport/vehicles
    { title: "Add Vehicle",              link: "/transport-partner/fleet/vehicles/new",       icons: <PlusCircle size={16} /> },      // POST /api/transport/vehicles

    // Drivers
    { title: "All Drivers",              link: "/transport-partner/drivers",                  icons: <Users size={16} /> },           // GET /api/transport/drivers
    { title: "Add Driver",               link: "/transport-partner/drivers/new",              icons: <UserPlus size={16} /> },        // POST /api/transport/drivers
    { title: "Driver Performance",       link: "/transport-partner/drivers/performance",      icons: <BarChart3 size={16} /> },       // GET /api/transport/drivers/:id/performance
    { title: "Driver Logs",              link: "/transport-partner/drivers/logs",             icons: <ScrollText size={16} /> },      // GET /api/transport/drivers/:id/logs

    // Bank & Settlement
    { title: "Bank Accounts",            link: "/transport-partner/bank/accounts",            icons: <Banknote size={16} /> },        // GET/POST /api/transport/bank/accounts
    { title: "UPI Handles",              link: "/transport-partner/bank/upi",                 icons: <Zap size={16} /> },             // POST/DELETE /api/transport/bank/upi
    { title: "Settlement Preference",    link: "/transport-partner/bank/settlement",          icons: <ReceiptText size={16} /> },     // PATCH /api/transport/bank/preferred-method

    // Zones & Pricing
    { title: "Service Zones",            link: "/transport-partner/zones",                    icons: <MapPin size={16} /> },          // GET/POST /api/transport/zones
    { title: "Pricing Config",           link: "/transport-partner/pricing",                  icons: <SlidersHorizontal size={16} /> },// GET/PATCH /api/transport/pricing

    // Settings
    { title: "Agency Profile",           link: "/transport-partner/settings/profile",         icons: <Building2 size={16} /> },       // PATCH /api/transport/profile
    { title: "KYC / Documents",          link: "/transport-partner/settings/kyc",             icons: <FileBadge size={16} /> },       // PUT /api/transport/kyc
    { title: "Notifications",            link: "/transport-partner/settings/notifications",   icons: <Bell size={16} /> },            // PATCH /api/transport/settings/notifications
    { title: "Availability",             link: "/transport-partner/settings/availability",    icons: <Clock size={16} /> },           // PATCH /api/transport/settings/availability
    { title: "Security & Sessions",      link: "/transport-partner/settings/security",        icons: <Lock size={16} /> },            // GET/DELETE /api/transport/security/sessions
  ],
};

// =============================================================================
// DRIVER — role: 'driver'
// (unchanged — booking routes handled via driver app, not nav links)
// =============================================================================

export const DRIVER_LINKS = {
  sidebar: [
    {
      title: "My Dashboard",
      icons: <LayoutDashboard size={20} />,
      links: [
        {
          title: "Home",
          link:  "/driver/dashboard",
          icons: <LayoutDashboard size={16} />,
        },
      ],
    },
    {
      title: "Status & Location",
      icons: <Activity size={20} />,
      links: [
        {
          title: "My Status",
          link:  "/driver/status",             // → PATCH /api/transport/driver/status
          icons: <Radio size={16} />,
        },
        {
          title: "Live Location",
          link:  "/driver/location",           // → PATCH /api/transport/driver/location
                                               //   Also: PATCH /api/bookings/driver/location (GPS fallback)
          icons: <Navigation size={16} />,
        },
        {
          title: "Shift & Hours",
          link:  "/driver/shift",              // → PATCH /api/transport/driver/shift
          icons: <Clock size={16} />,
        },
      ],
    },
    {
      title: "Rewards",
      icons: <Award size={20} />,
      links: [
        {
          title: "Coins & Badges",
          link:  "/driver/rewards",            // → GET /api/transport/driver/rewards
          icons: <Zap size={16} />,
        },
      ],
    },
    {
      title: "My Profile",
      icons: <User size={20} />,
      links: [
        {
          title: "Profile",
          link:  "/driver/profile",            // → GET/PATCH /api/transport/driver/me
          icons: <User size={16} />,
        },
        {
          title: "KYC / Documents",
          link:  "/driver/profile/kyc",        // → PUT /api/transport/driver/kyc
          icons: <FileBadge size={16} />,
        },
        {
          title: "Bank Details",
          link:  "/driver/profile/bank",       // → PUT /api/transport/driver/bank
          icons: <CreditCard size={16} />,
        },
      ],
    },
    {
      title: "Activity",
      icons: <ScrollText size={20} />,
      links: [
        {
          title: "My Activity Logs",
          link:  "/driver/logs",               // → GET /api/transport/driver/logs
          icons: <AlignJustify size={16} />,
        },
      ],
    },
    {
      title: "Support",
      icons: <MessageSquare size={20} />,
      links: [
        {
          title: "Agency Contact",
          link:  "/driver/support/agency",
          icons: <HeartHandshake size={16} />,
        },
        {
          title: "Help Center",
          link:  "/driver/support/help",
          icons: <HelpCircle size={16} />,
        },
        {
          title: "Report Issue",
          link:  "/driver/support/report",
          icons: <AlertTriangle size={16} />,
        },
      ],
    },
    {
      title: "Settings",
      icons: <Settings size={20} />,
      links: [
        {
          title: "Notifications",
          link:  "/driver/settings/notifications",
          icons: <Bell size={16} />,
        },
        {
          title: "Security",
          link:  "/driver/settings/security",
          icons: <ShieldCheck size={16} />,
        },
      ],
    },
  ],
};

export const DRIVER_TOP_RIGHT = [
  {
    title: "Quick Actions",
    icons: <Zap size={16} />,
    links: [
      {
        title: "Update Status",
        link:  "/driver/status",             // → PATCH /api/transport/driver/status
        icons: <Activity size={14} />,
      },
      {
        title: "My Rewards",
        link:  "/driver/rewards",            // → GET /api/transport/driver/rewards
        icons: <Award size={14} />,
      },
      {
        title: "My Shift",
        link:  "/driver/shift",              // → PATCH /api/transport/driver/shift
        icons: <Clock size={14} />,
      },
    ],
  },
  {
    title: "Profile",
    icons: <User size={16} />,
    links: [
      {
        title: "My Profile",
        link:  "/driver/profile",            // → GET/PATCH /api/transport/driver/me
        icons: <User size={14} />,
      },
      {
        title: "KYC Status",
        link:  "/driver/profile/kyc",        // → PUT /api/transport/driver/kyc
        icons: <BadgeCheck size={14} />,
      },
      {
        title: "Bank Details",
        link:  "/driver/profile/bank",       // → PUT /api/transport/driver/bank
        icons: <CreditCard size={14} />,
      },
    ],
  },
];

export const DRIVER_SEARCH = {
  quickLinks: [
    {
      title:    "My Status",
      link:     "/driver/status",
      icons:    <Activity size={18} />,
      shortcut: "D+S",
    },
    {
      title:    "Shift",
      link:     "/driver/shift",
      icons:    <Clock size={18} />,
      shortcut: "D+H",
    },
    {
      title:    "Rewards",
      link:     "/driver/rewards",
      icons:    <Award size={18} />,
      shortcut: "D+W",
    },
    {
      title:    "Profile",
      link:     "/driver/profile",
      icons:    <User size={18} />,
      shortcut: "D+P",
    },
  ],
  pageLinks: [
    { title: "Dashboard",           link: "/driver/dashboard",               icons: <LayoutDashboard size={16} /> },
    { title: "My Status",           link: "/driver/status",                  icons: <Radio size={16} /> },        // PATCH /api/transport/driver/status
    { title: "Live Location",       link: "/driver/location",                icons: <Navigation size={16} /> },   // PATCH /api/bookings/driver/location
    { title: "Shift & Hours",       link: "/driver/shift",                   icons: <Clock size={16} /> },        // PATCH /api/transport/driver/shift
    { title: "Coins & Badges",      link: "/driver/rewards",                 icons: <Zap size={16} /> },          // GET /api/transport/driver/rewards
    { title: "My Profile",          link: "/driver/profile",                 icons: <User size={16} /> },         // GET/PATCH /api/transport/driver/me
    { title: "KYC / Documents",     link: "/driver/profile/kyc",             icons: <FileBadge size={16} /> },    // PUT /api/transport/driver/kyc
    { title: "Bank Details",        link: "/driver/profile/bank",            icons: <CreditCard size={16} /> },   // PUT /api/transport/driver/bank
    { title: "Activity Logs",       link: "/driver/logs",                    icons: <ScrollText size={16} /> },   // GET /api/transport/driver/logs
    { title: "Agency Contact",      link: "/driver/support/agency",          icons: <HeartHandshake size={16} /> },
    { title: "Help Center",         link: "/driver/support/help",            icons: <HelpCircle size={16} /> },
    { title: "Report Issue",        link: "/driver/support/report",          icons: <AlertTriangle size={16} /> },
    { title: "Notifications",       link: "/driver/settings/notifications",  icons: <Bell size={16} /> },
    { title: "Security",            link: "/driver/settings/security",       icons: <ShieldCheck size={16} /> },
  ],
};

// =============================================================================
// Legacy backward-compat aliases
// =============================================================================
export const TRANSPORT_DASHBOARD_LINKS = { sidebar: TRANSPORT_PARTNER_LINKS.sidebar };
export const TRANSPORT_TOP_RIGHT_LINKS = TRANSPORT_PARTNER_TOP_RIGHT;
export const TRANSPORT_SEARCH_LINKS    = TRANSPORT_PARTNER_SEARCH;