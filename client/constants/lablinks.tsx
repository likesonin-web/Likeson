/**
 * LAB PARTNER NAVIGATION LINKS
 * Extracted from the Lab Partner Router — Likeson.in
 *
 * Used by: LabPartnerDashboard, Sidebar, MobileNav
 */

import {
  LayoutDashboard,
  User,
  FlaskConical,
  Package,
  ShieldCheck,
  FileText,
  ClipboardList,
  Star,
  Settings,
  Sliders,
  Monitor,
  Bell,
  Users,
  Clock,
  Image,
  Lock,
  Mail,
  Smartphone,
  History,
  Activity,
  AreaChart,
  CreditCard,
  Microscope,
  ScrollText,
  BadgeCheck,
  CalendarCheck, // <-- Added for Bookings
  Archive,       // <-- Added for Reports Archive
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TOP-LEVEL SIDEBAR GROUPS  (Lab Partner only)
// Maps 1-to-1 with the router sections
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_PARTNER_NAV = [
  // ── 1. Dashboard & Analytics ──────────────────────────────────────────────
  // GET /api/labs/partner/me/dashboard
  // GET /api/labs/partner/me/analytics/reviews
  {
    group: "Overview",
    links: [
      {
        name: "Dashboard",
        href: "/lab-partner/dashboard",
        icon: LayoutDashboard,
        description: "High-level stats and recent activity",
     
      },
      {
        name: "Review Analytics",
        href: "/lab-partner/analytics/reviews",
        icon: AreaChart,
        description: "Rating breakdown and 6-month trend",
       
      },
    ],
  },

  // ── 2. Bookings & Reports (NEW) ───────────────────────────────────────────
  // GET /api/lab-partner/bookings
  // GET /api/lab-partner/bookings/reports/all
  {
    group: "Bookings",
    links: [
      {
        name:"All Bookings",
        href:"/lab-partner/bookings",
        icon: Microscope,
        description: "View all bookings with filters and search",
    
      },
      {
        name: "Manage Bookings",
        href: "/lab-partner/bookings/manage",
        icon: CalendarCheck,
        description: "View pending, accept requests, and collect samples",
         
      },
      {
        name: "Reports Archive",
        href: "/lab-partner/bookings/reports",
        icon: Archive,
        description: "Completed tests and dispatched PDF reports",
       
      },
    ],
  },

  // ── 3. Profile ────────────────────────────────────────────────────────────
  // GET  /api/labs/partner/me
  // PATCH /api/labs/partner/me
  // PATCH /api/labs/partner/me/bank-details
  {
    group: "Profile",
    links: [
      {
        name: "My Profile",
        href: "/lab-partner/profile",
        icon: User,
        description: "View and update your lab profile",
     
      },
      {
        name: "Bank Details",
        href: "/lab-partner/profile/bank-details",
        icon: CreditCard,
        description: "Payout bank account information",
     
      },
    ],
  },

  // ── 4. Tests & Packages ───────────────────────────────────────────────────
  // GET | POST          /api/labs/partner/me/tests
  // PATCH | DELETE      /api/labs/partner/me/tests/:testId
  // GET | POST          /api/labs/partner/me/packages
  // PATCH | DELETE      /api/labs/partner/me/packages/:pkgId
  {
    group: "Catalogue",
    links: [
      {
        name: "Lab Tests",
        href: "/lab-partner/tests",
        icon: FlaskConical,
        description: "Manage your diagnostic test catalogue",
 
      },
      {
        name: "Packages",
        href: "/lab-partner/packages",
        icon: Package,
        description: "Health check-up bundles and offers",
     
      },
    ],
  },

  // ── 5. Documents & Compliance ─────────────────────────────────────────────
  // GET  /api/labs/partner/me/accreditations
  // POST /api/labs/partner/me/accreditations
  // POST /api/labs/partner/me/compliance-docs
  {
    group: "Documents",
    links: [
      {
        name: "Accreditations",
        href: "/lab-partner/accreditations",
        icon: BadgeCheck,
        description: "NABL, ISO and other certifications",
      
      },
      {
        name: "Compliance Docs",
        href: "/lab-partner/compliance-docs",
        icon: FileText,
        description: "Regulatory documents and licences",
        
      },
    ],
  },

  // ── 6. Reviews & Status ───────────────────────────────────────────────────
  // GET /api/labs/partner/me/reviews
  // GET /api/labs/partner/me/status-log
  {
    group: "Reputation",
    links: [
      {
        name: "Reviews",
        href: "/lab-partner/reviews",
        icon: Star,
        description: "Customer feedback and ratings",
        
      },
      {
        name: "Status Log",
        href: "/lab-partner/status-log",
        icon: ScrollText,
        description: "Account approval and suspension history",
        
      },
    ],
  },

  // ── 7. Notifications ─────────────────────────────────────────────────────
  // GET    /api/labs/partner/me/notifications
  // PATCH  /api/labs/partner/me/notifications/:id/read
  // PATCH  /api/labs/partner/me/notifications/read-all
  // DELETE /api/labs/partner/me/notifications/:id
  // DELETE /api/labs/partner/me/notifications
  {
    group: "Notifications",
    links: [
      {
        name: "Notifications",
        href: "/lab-partner/notifications",
        icon: Bell,
        description: "In-app alerts and announcements",
       
      },
    ],
  },

  // ── 8. Settings ───────────────────────────────────────────────────────────
  // GET   /api/labs/partner/me/settings
  // PATCH /api/labs/partner/me/settings/operational
  // PATCH /api/labs/partner/me/settings/display
  // PATCH /api/labs/partner/me/settings/notifications
  // PATCH /api/labs/partner/me/settings/contact-persons
  // PATCH /api/labs/partner/me/settings/timing
  // PATCH /api/labs/partner/me/settings/images
  {
    group: "Settings",
    links: [
      {
        name: "General Settings",
        href: "/lab-partner/settings",
        icon: Settings,
        description: "All configurable preferences",
        
      },
      {
        name: "Operational",
        href: "/lab-partner/settings/operational",
        icon: Sliders,
        description: "Collection mode, radius, TAT, payout",
   
      },
      {
        name: "Display",
        href: "/lab-partner/settings/display",
        icon: Monitor,
        description: "Description, website URL, tags",
        
      },
      {
        name: "Notification Prefs",
        href: "/lab-partner/settings/notifications",
        icon: Bell,
        description: "Email and SMS preference toggles",
      
      },
      {
        name: "Contact Persons",
        href: "/lab-partner/settings/contact-persons",
        icon: Users,
        description: "Lab director, ops head contacts",
 
      },
      {
        name: "Operating Hours",
        href: "/lab-partner/settings/timing",
        icon: Clock,
        description: "Daily open/close schedule",
        
      },
      {
        name: "Lab Images",
        href: "/lab-partner/settings/images",
        icon: Image,
        description: "Logo and cover photo",
       
      },
    ],
  },

  // ── 9. Security ───────────────────────────────────────────────────────────
  // PATCH  /api/labs/partner/me/change-password
  // POST   /api/labs/partner/me/security/request-email-change
  // PATCH  /api/labs/partner/me/security/confirm-email-change
  // GET    /api/labs/partner/me/security/sessions
  // DELETE /api/labs/partner/me/security/sessions/:sessionId
  // DELETE /api/labs/partner/me/security/sessions
  // GET    /api/labs/partner/me/security/login-history
  // POST   /api/labs/partner/me/security/send-verification-otp
  // POST   /api/labs/partner/me/security/verify-email
  {
    group: "Security",
    links: [
      {
        name: "Change Password",
        href: "/lab-partner/security/change-password",
        icon: Lock,
        description: "Update your account password",
       
      },
      {
        name: "Email & Verification",
        href: "/lab-partner/security/email",
        icon: Mail,
        description: "Change or verify your email address",
       
      },
      {
        name: "Active Sessions",
        href: "/lab-partner/security/sessions",
        icon: Smartphone,
        description: "View and revoke logged-in devices",
        
      },
      {
        name: "Login History",
        href: "/lab-partner/security/login-history",
        icon: History,
        description: "Recent login attempts and audit log",
         
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// FLAT LIST — for command palette / spotlight search
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_PARTNER_ALL_LINKS = LAB_PARTNER_NAV.flatMap((group) =>
  group.links.map((link) => ({ ...link, group: group.group }))
);

// ─────────────────────────────────────────────────────────────────────────────
// QUICK-ACCESS  — pinned to mobile bottom bar and desktop topbar
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_PARTNER_QUICK_LINKS = [
  { name: "Dashboard",   href: "/lab-partner/dashboard",   icon: LayoutDashboard },
  { name: "Bookings",    href: "/lab-partner/bookings",    icon: CalendarCheck   }, // <-- Added Bookings to Quick Links
  { name: "Tests",       href: "/lab-partner/tests",       icon: FlaskConical    },
  { name: "Packages",    href: "/lab-partner/packages",    icon: Package         },
  { name: "Settings",    href: "/lab-partner/settings",    icon: Settings        },
];

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD STAT CARDS  — maps to /partner/me/dashboard API response fields
// ─────────────────────────────────────────────────────────────────────────────

export const LAB_DASHBOARD_STAT_KEYS = [
  { key: "tests.active",       label: "Active Tests",    icon: FlaskConical,    color: "primary"  },
  { key: "packages.active",    label: "Active Packages", icon: Package,         color: "secondary" },
  { key: "rating.average",     label: "Avg Rating",      icon: Star,            color: "warning"  },
  { key: "rating.total",       label: "Total Reviews",   icon: Activity,        color: "info"     },
  { key: "documents.pending",  label: "Docs Pending",    icon: ClipboardList,   color: "error"    },
];