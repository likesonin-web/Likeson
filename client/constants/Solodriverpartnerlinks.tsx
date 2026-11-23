'use client'
// constants/Solodriverpartnerlinks.js
import {
  // Profile & Identity
  UserRound,
  BadgeCheck,
  Contact2,
  MapPin,
  Briefcase,
  FileUser,
  ShieldAlert,
  KeyRound,
  Smartphone,
  MonitorSmartphone,
  // KYC & Compliance
  ScanLine,
  FileCheck2,
  HeartPulse,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  // Vehicle
  Car,
  FileText,
  Wrench,
  Navigation,
  // Bank & Earnings
  Landmark,
  ReceiptIndianRupee,
  WalletCards,
  ArrowDownToLine,
  // Availability & Zones
  ToggleRight,
  Map,
  Plus,
  Trash2,
  // Pricing
  CircleDollarSign,
  Tag,
  // Stats & Ratings
  BarChart3,
  Star,
  TrendingUp,
  // Security & Notifications
  Bell,
  History,
  Lock,
  // Settings
  Settings2,
  LayoutDashboard,
  // Booking routes & State Machine
  CheckCircle2,
  XCircle,
  PlayCircle,
  StopCircle,
  RefreshCw,
  Activity,
  Route,
  Key,
  PauseCircle,
  CheckSquare
} from "lucide-react";

// =============================================================================
// SOLO DRIVER PARTNER — role: 'solodriverpartner'
//
// Booking router routes based on updated backend API:
//   GET   /api/ride-requests/:rideId                     — view single ride details
//   PATCH /api/ride-requests/:rideId/status              — Driver state machine mutations
//         Actions: accept, start_route, arrived, verify_otp, start_ride, at_stop, resume, complete, cancel
//   GET   /api/ride-requests/:rideId/live                — lightweight polling/live tracking
//   GET   /api/ride-requests/:rideId/tracking            — full tracking snapshot (ETA, polyline, etc.)
//   POST  /api/ride-requests/:rideId/tracking/milestone  — HTTP fallback for manual milestone logging
//
// Solo driver own routes (SoloDriverRoutes.js):
//   GET/PATCH /api/solo/profile
//   PUT       /api/solo/kyc
//   PATCH     /api/solo/vehicle
//   GET/POST  /api/solo/bank
//   GET/PATCH /api/solo/pricing
//   GET/POST  /api/solo/service-zones
//   PATCH     /api/solo/availability
//   GET       /api/solo/settlement
//   GET       /api/solo/security/sessions
//   DELETE    /api/solo/security/sessions/:id
//   PATCH     /api/solo/settings
// =============================================================================

export const SOLO_DRIVER_PARTNER_LINKS = [

  // ── 1. Dashboard ─────────────────────────────────────────────────────────
  {
    title: "Dashboard",
    icons: <LayoutDashboard />,
    links: [
      { name: "Overview",         href: "/partner/solo/dashboard",        icon: <LayoutDashboard size={18} /> },
      { name: "Stats",            href: "/partner/solo/stats",            icon: <BarChart3 size={18} />       },
      { name: "My Rating",        href: "/partner/solo/rating",           icon: <Star size={18} />            },
      { name: "Performance",      href: "/partner/solo/performance",      icon: <TrendingUp size={18} />      },
    ],
  },

  // ── 2. Rides (State Machine) ─────────────────────────────────────────────
  // Route: PATCH /api/ride-requests/:rideId/status
  {
    title: "My Rides",
    icons: <ClipboardList />,
    links: [
      {
        name: "Assigned Rides",
        href: "/partner/solo/rides",
        icon: <ClipboardList size={18} />,
      },
      {
        name: "Accept Ride",
        href: "/partner/solo/rides/accept",             // action: 'accept'
        icon: <CheckCircle2 size={18} />,
      },
      {
        name: "Start Route (To Pickup)",
        href: "/partner/solo/rides/start-route",        // action: 'start_route'
        icon: <Route size={18} />,
      },
      {
        name: "Mark Arrived",
        href: "/partner/solo/rides/arrived",            // action: 'arrived'
        icon: <MapPin size={18} />,
      },
      {
        name: "Verify OTP",
        href: "/partner/solo/rides/verify-otp",         // action: 'verify_otp'
        icon: <Key size={18} />,
      },
      {
        name: "Start Ride (To Dropoff)",
        href: "/partner/solo/rides/start-ride",         // action: 'start_ride'
        icon: <PlayCircle size={18} />,
      },
      {
        name: "Mark At Stop",
        href: "/partner/solo/rides/at-stop",            // action: 'at_stop'
        icon: <PauseCircle size={18} />,
      },
      {
        name: "Resume Ride",
        href: "/partner/solo/rides/resume",             // action: 'resume'
        icon: <RefreshCw size={18} />,
      },
      {
        name: "Complete Ride",
        href: "/partner/solo/rides/complete",           // action: 'complete'
        icon: <CheckSquare size={18} />,
      },
      {
        name: "Cancel Ride",
        href: "/partner/solo/rides/cancel",             // action: 'cancel'
        icon: <XCircle size={18} />,
      },
    ],
  },

  // ── 3. Live Tracking & Milestones ────────────────────────────────────────
  // Routes: GET /api/ride-requests/:rideId/live
  //         GET /api/ride-requests/:rideId/tracking
  //         POST /api/ride-requests/:rideId/tracking/milestone
  {
    title: "Live Tracking",
    icons: <Navigation />,
    links: [
      {
        name: "Active Ride Status",
        href: "/partner/solo/rides/active",             // View for /live & /tracking 
        icon: <Activity size={18} />,
      },
      {
        name: "Update Location",
        href: "/partner/solo/location",                 // Triggers location updates to backend/sockets
        icon: <Navigation size={18} />,
      },
      {
        name: "Log Milestone",
        href: "/partner/solo/rides/milestone",          // POST tracking/milestone
        icon: <MapPin size={18} />,
      },
    ],
  },

  // ── 4. My Profile ─────────────────────────────────────────────────────────
  {
    title: "My Profile",
    icons: <UserRound />,
    links: [
      { name: "Personal Details",  href: "/partner/solo/profile",                    icon: <UserRound size={18} />  },
      { name: "Contact Info",      href: "/partner/solo/profile/contact",             icon: <Contact2 size={18} />   },
      { name: "Address",           href: "/partner/solo/profile/address",             icon: <MapPin size={18} />     },
      { name: "Professional Info", href: "/partner/solo/profile/professional",        icon: <Briefcase size={18} />  },
      { name: "Emergency Contact", href: "/partner/solo/profile/emergency",           icon: <ShieldAlert size={18} />},
      { name: "Certificates",      href: "/partner/solo/profile/certificates",        icon: <FileUser size={18} />   },
    ],
  },

  // ── 5. KYC & Verification ─────────────────────────────────────────────────
  {
    title: "KYC & Verification",
    icons: <BadgeCheck />,
    links: [
      { name: "KYC Status",        href: "/partner/solo/kyc",              icon: <ScanLine size={18} />     },
      { name: "Submit Documents",  href: "/partner/solo/kyc/submit",       icon: <FileCheck2 size={18} />   },
      { name: "Medical Fitness",   href: "/partner/solo/kyc/medical",      icon: <HeartPulse size={18} />   },
      { name: "PSV Badge",         href: "/partner/solo/kyc/psv",          icon: <ShieldCheck size={18} />  },
    ],
  },

  // ── 6. Vehicle ────────────────────────────────────────────────────────────
  {
    title: "Vehicle",
    icons: <Car />,
    links: [
      { name: "Vehicle Details",   href: "/partner/solo/vehicle",              icon: <Car size={18} />         },
      { name: "Vehicle Documents", href: "/partner/solo/vehicle/documents",    icon: <FileText size={18} />    },
      { name: "Features & Extras", href: "/partner/solo/vehicle/features",     icon: <Wrench size={18} />      },
      { name: "Update Location",   href: "/partner/solo/vehicle/location",     icon: <Navigation size={18} />  },
    ],
  },

  // ── 7. Bank & Earnings ────────────────────────────────────────────────────
  {
    title: "Bank & Earnings",
    icons: <Landmark />,
    links: [
      { name: "Bank Details",       href: "/partner/solo/bank",             icon: <Landmark size={18} />           },
      { name: "Settlement History", href: "/partner/solo/settlement",       icon: <ReceiptIndianRupee size={18} /> },
      { name: "Wallet",             href: "/partner/solo/wallet",           icon: <WalletCards size={18} />        },
      { name: "Payouts",            href: "/partner/solo/payouts",          icon: <ArrowDownToLine size={18} />    },
    ],
  },

  // ── 8. Availability & Zones ───────────────────────────────────────────────
  {
    title: "Availability & Zones",
    icons: <ToggleRight />,
    links: [
      { name: "Go Online / Offline", href: "/partner/solo/availability",          icon: <ToggleRight size={18} /> },
      { name: "Service Zones",       href: "/partner/solo/service-zones",         icon: <Map size={18} />         },
      { name: "Add Zone",            href: "/partner/solo/service-zones/add",     icon: <Plus size={18} />        },
    ],
  },

  // ── 9. Pricing ────────────────────────────────────────────────────────────
  {
    title: "Pricing",
    icons: <CircleDollarSign />,
    links: [
      { name: "My Pricing Config",  href: "/partner/solo/pricing",          icon: <Tag size={18} />              },
      { name: "Platform Fee Info",  href: "/partner/solo/pricing/platform", icon: <CircleDollarSign size={18} /> },
    ],
  },

  // ── 10. Compliance ─────────────────────────────────────────────────────────
  {
    title: "Compliance",
    icons: <ClipboardList />,
    links: [
      { name: "Document Expiry",   href: "/partner/solo/compliance",         icon: <ClipboardList size={18} /> },
      { name: "Expiry Alerts",     href: "/partner/solo/compliance/alerts",  icon: <AlertTriangle size={18} /> },
    ],
  },

  // ── 11. Security ───────────────────────────────────────────────────────────
  {
    title: "Security",
    icons: <Lock />,
    links: [
      { name: "Active Sessions",    href: "/partner/solo/security/sessions",         icon: <History size={18} />         },
      { name: "Registered Devices", href: "/partner/solo/security/devices",          icon: <MonitorSmartphone size={18} />},
      { name: "Change Password",    href: "/partner/solo/security/change-password",  icon: <KeyRound size={18} />        },
    ],
  },

  // ── 12. Notifications & Settings ─────────────────────────────────────────
  {
    title: "Notifications & Settings",
    icons: <Bell />,
    links: [
      { name: "Notifications",       href: "/partner/solo/notifications",       icon: <Bell size={18} />      },
      { name: "Notification Prefs",  href: "/partner/solo/settings",            icon: <Settings2 size={18} /> },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SOLO DRIVER PARTNER — TOP-RIGHT QUICK ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_DRIVER_PARTNER_TOP_RIGHT_LINKS = [
  { name: "Home", icon: <LayoutDashboard size={18} /> },
  {
    name: "Quick Actions",
    icon: <Briefcase size={18} />,
    links: [
      {
        name: "My Rides",
        href: "/partner/solo/rides",                
        icon: <ClipboardList size={18} />,
      },
      {
        name: "Go Online",
        href: "/partner/solo/availability",         
        icon: <ToggleRight size={18} />,
      },
      {
        name: "Update Location",
        href: "/partner/solo/location",             
        icon: <Navigation size={18} />,
      },
      {
        name: "Active Ride",
        href: "/partner/solo/rides/active",
        icon: <Activity size={18} />,
      },
      {
        name: "Compliance Check",
        href: "/partner/solo/compliance",
        icon: <ClipboardList size={18} />,
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SOLO DRIVER PARTNER — COMMAND PALETTE / SPOTLIGHT SEARCH
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_DRIVER_PARTNER_SEARCH_LINKS = [
  // Frequently visited
  [
    { name: "Dashboard",             href: "/partner/solo/dashboard",               icon: <LayoutDashboard size={18} /> },
    { name: "My Rides",              href: "/partner/solo/rides",                   icon: <ClipboardList size={18} /> },
    { name: "Active Ride",           href: "/partner/solo/rides/active",            icon: <Activity size={18} /> },
    { name: "Update Location",       href: "/partner/solo/location",                icon: <Navigation size={18} /> },      
    { name: "KYC Status",            href: "/partner/solo/kyc",                     icon: <ScanLine size={18} /> },
    { name: "My Vehicle",            href: "/partner/solo/vehicle",                 icon: <Car size={18} /> },
    { name: "Availability",          href: "/partner/solo/availability",            icon: <ToggleRight size={18} /> },
    { name: "Compliance",            href: "/partner/solo/compliance",              icon: <ClipboardList size={18} /> },
    { name: "Settlement",            href: "/partner/solo/settlement",              icon: <ReceiptIndianRupee size={18} />},
    { name: "Notifications",         href: "/partner/solo/notifications",           icon: <Bell size={18} /> },
  ],
  // Quick actions mapped to backend status mutations
  [
    { name: "Accept Ride",           href: "/partner/solo/rides/accept",            icon: <CheckCircle2 size={18} /> },
    { name: "Verify OTP",            href: "/partner/solo/rides/verify-otp",        icon: <Key size={18} /> }, 
    { name: "Start Ride",            href: "/partner/solo/rides/start-ride",        icon: <PlayCircle size={18} /> }, 
    { name: "Complete Ride",         href: "/partner/solo/rides/complete",          icon: <CheckSquare size={18} /> }, 
    { name: "Cancel Ride",           href: "/partner/solo/rides/cancel",            icon: <XCircle size={18} /> }, 
    { name: "Add Service Zone",      href: "/partner/solo/service-zones/add",       icon: <Plus size={18} /> },
    { name: "Change Password",       href: "/partner/solo/security/change-password",icon: <KeyRound size={18} /> },
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DROPDOWN (Solo Driver Partner)
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_DRIVER_PARTNER_PROFILE_LINKS = [
  { name: "My Profile",        href: "/partner/solo/profile",          icon: <UserRound size={18} />  },
  { name: "Account Settings",  href: "/partner/solo/settings",         icon: <Settings2 size={18} />  },
  { name: "Security",          href: "/partner/solo/security/sessions",icon: <Lock size={18} />       },
];

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────────────────────────

export const SOLO_DRIVER_PARTNER_SHORTCUTS = [
  { name: "Command Palette",  keys: "Cmd + K" },
  { name: "Search",           keys: "Cmd + S" },
  { name: "Toggle Online",    keys: "Cmd + O" },
  { name: "My Rides",         keys: "Cmd + R" },
  { name: "Logout",           keys: "Cmd + Q" },
];