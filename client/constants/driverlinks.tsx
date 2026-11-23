import React from "react";
import {
  // Profile
  UserRound, PenLine, KeyRound,
  // KYC
  ShieldCheck, FileText,
  // Shift & Status
  Clock, ToggleRight,
  // Location
  MapPin,
  // Bank
  Landmark, CreditCard,
  // Rewards
  Star,
  // Logs
  ScrollText,
  // Sessions & Devices
  MonitorSmartphone, LogOut, Laptop, Trash2,
  // Bookings
  Truck, ClipboardList, CheckCircle, XCircle,
  Navigation, PlayCircle, StopCircle, LocateFixed,
  BarChart2,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER DASHBOARD — SIDEBAR NAVIGATION
// Mirrors §H driver routes in TransportPartnerRoutes.js
// + §Driver Booking routes in bookingRouter.js
//
// GET    /bookings/driver/assigned     → Active Rides (BookingManagement)
// PATCH  /:id/ride/accept             → Accept Ride
// PATCH  /:id/ride/reject             → Reject Ride
// PATCH  /:id/ride/arrived            → Mark Arrived
// POST   /:id/ride/start              → Start Ride (OTP)
// POST   /:id/ride/end                → End Ride
// PATCH  /bookings/driver/location    → Update Driver Location
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_DASHBOARD_LINKS = [

  // ── Bookings (NEW) ────────────────────────────────────────────────────────
  // Primary section — driver's core workflow lives here
  {
    title: "Bookings",
    icon: <Truck size={18} />,
    links: [
      {
        name: "Booking Control",
        href: "/driver/bookings",
        icon: <Truck size={15} />,
        badge: "live",           // shows live-count badge in sidebar
        description: "Active rides, OTP verify, GPS tracking",
      },
      {
        name: "Assigned Rides",
        href: "/driver/bookings?tab=rides",
        icon: <ClipboardList size={15} />,
        description: "GET /bookings/driver/assigned",
      },
      {
        name: "Ride Analytics",
        href: "/driver/bookings?tab=analytics",
        icon: <BarChart2 size={15} />,
        description: "Weekly earnings & performance charts",
      },
    ],
  },
 
  // ── GPS Location ──────────────────────────────────────────────────────────
  // PATCH /bookings/driver/location  (GPS fallback, called every 5s in BookingManagement)
  // PATCH /driver/location           (§H driver own location update)
  {
    title: "Location",
    icon: <MapPin size={18} />,
    links: [
      {
        name: "Live GPS Tracking",
        href: "/driver/bookings?gps=on",
        icon: <LocateFixed size={15} />,
        description: "PATCH /bookings/driver/location — toggles in Booking Control",
      },
      {
        name: "Update Location",
        href: "/driver/location",
        icon: <MapPin size={15} />,
        description: "PATCH /driver/location — §H manual location set",
      },
    ],
  },

  // ── Profile ───────────────────────────────────────────────────────────────
  {
    title: "My Profile",
    icon: <UserRound size={18} />,
    links: [
      { name: "View Profile",    href: "/driver/profile",          icon: <UserRound size={15} /> },
      { name: "Change Password", href: "/driver/profile/password", icon: <KeyRound size={15} />  },
    ],
  },

  // ── KYC ───────────────────────────────────────────────────────────────────
  {
    title: "KYC & Documents",
    icon: <ShieldCheck size={18} />,
    links: [
      { name: "KYC Status", href: "/driver/kyc",        icon: <ShieldCheck size={15} /> },
      { name: "Submit KYC", href: "/driver/kyc/submit", icon: <FileText size={15} />    },
    ],
  },

  // ── Shift & Status ────────────────────────────────────────────────────────
  {
    title: "Shift & Status",
    icon: <Clock size={18} />,
    links: [
      { name: "Shift Settings", href: "/driver/shift", icon: <Clock size={15} /> },
    ],
  },

  // ── Bank Details ──────────────────────────────────────────────────────────
  {
    title: "Bank Details",
    icon: <Landmark />,
    links: [
      { name: "View Bank Details", href: "/driver/bank",      icon: <Landmark size={15} />   },
      { name: "Update Bank",       href: "/driver/bank/edit", icon: <CreditCard size={15} /> },
    ],
  },

  // ── Rewards ───────────────────────────────────────────────────────────────
  {
    title: "Rewards",
    icon: <Star size={18} />,
    links: [
      { name: "My Rewards",   href: "/driver/rewards",         icon: <Star size={15} /> },
      { name: "Coin Balance", href: "/driver/rewards/balance", icon: <Star size={15} /> },
    ],
  },

  // ── Activity Logs ─────────────────────────────────────────────────────────
  {
    title: "Activity Logs",
    icon: <ScrollText size={18} />,
    links: [
      { name: "My Logs", href: "/driver/logs", icon: <ScrollText size={15} /> },
    ],
  },

  // ── Sessions & Devices ────────────────────────────────────────────────────
  {
    title: "Sessions & Devices",
    icon: <MonitorSmartphone size={18} />,
    links: [
      { name: "Active Sessions", href: "/driver/audit/sessions",        icon: <Clock size={15} />             },
      { name: "Revoke Session",  href: "/driver/audit/sessions/revoke", icon: <LogOut size={15} />            },
      { name: "Revoke All",      href: "/driver/audit/all-sessions",    icon: <ShieldCheck size={15} />       },
      { name: "All Devices",     href: "/driver/audit/devices",         icon: <MonitorSmartphone size={15} /> },
      { name: "Remove Device",   href: "/driver/audit/devices/remove",  icon: <Laptop size={15} />            },
      { name: "Remove All",      href: "/driver/audit/devices/all",     icon: <Trash2 size={15} />            },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — TOP-RIGHT QUICK ACCESS
// Added "Bookings" as first priority item (most-used by driver)
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_TOP_RIGHT_LINKS = [
  { name: "Bookings", href: "/driver/bookings",  icon: <Truck size={15} />       }, // NEW
  { name: "Status",   href: "/driver/shift",     icon: <ToggleRight size={15} /> },
  { name: "Location", href: "/driver/location",  icon: <MapPin size={15} />      },
  { name: "Rewards",  href: "/driver/rewards",   icon: <Star size={15} />        },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — PROFILE DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_PROFILE_LINKS = [
  { name: "My Profile",      href: "/driver/profile",          icon: <UserRound size={15} />        },
  { name: "KYC Status",      href: "/driver/kyc",              icon: <ShieldCheck size={15} />      },
  { name: "Change Password", href: "/driver/profile/password", icon: <KeyRound size={15} />         },
  { name: "Sessions",        href: "/driver/audit/sessions",   icon: <MonitorSmartphone size={15} /> },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_SHORTCUTS = [
  { name: "Command Palette",   keys: "Cmd + K" },
  { name: "Booking Control",   keys: "Cmd + B" }, // NEW — opens /driver/bookings
  { name: "Update Status",     keys: "Cmd + S" },
  { name: "Toggle GPS",        keys: "Cmd + G" }, // NEW — toggles location tracking
  { name: "Logout",            keys: "Cmd + Q" },
];

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER — ROUTE → THUNK MAP
// Reference for what API thunk each page/action calls.
// Import from operationsSlice.
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER_ROUTE_THUNK_MAP = {
  "/driver/bookings":              "fetchDriverAssigned",       // GET  /bookings/driver/assigned
  "accept":                        "acceptRide",                // PATCH /:id/ride/accept
  "reject":                        "rejectRide",               // PATCH /:id/ride/reject
  "arrived":                       "markRideArrived",          // PATCH /:id/ride/arrived
  "start":                         "startRide",                // POST  /:id/ride/start
  "end":                           "endRide",                  // POST  /:id/ride/end
  "gps":                           "updateDriverLocation",     // PATCH /bookings/driver/location
};