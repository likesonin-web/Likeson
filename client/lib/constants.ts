import {
  Stethoscope,
  Video,
  Home,
  Ambulance,
  TestTube2,
  UserCheck,
  Calendar,
  CreditCard,
  Wallet,
  Coins,
  Microscope,
  Navigation2,
  HeartPulse,
  RefreshCw,
  Zap,
  Hospital,
  Receipt,
  CheckCircle2,
  User,
} from "lucide-react";

export const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
export const RAZORPAY_KEY = (process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "").trim();
export const VIJAYAWADA = { lat: 16.5062, lng: 80.648 };
export const GMAPS_LIBRARIES = ["places", "geometry"];

// Plans that only cover in-person consultations via subscription quota.
// Video consultations still bookable but charged at full fee + 5% GST.
// Source of truth = plan.consultations.modes.video in DB (via checkConsultationCoverage).
// IN_PERSON_ONLY_PLAN_TIERS used as UI-side fallback for banner display only.
export const IN_PERSON_ONLY_PLAN_TIERS = new Set([
  "Basic Care",
  "Standard Care",
  "Premium Care",
]);

export const ALL_STEP_DEFS = {
  service: { id: "service", label: "Service", icon: Zap },
  provider: { id: "provider", label: "Provider", icon: Hospital },
  patient: { id: "patient", label: "Patient", icon: User },
  schedule: { id: "schedule", label: "Schedule", icon: Calendar },
  payment: { id: "payment", label: "Payment", icon: Receipt },
  confirm: { id: "confirm", label: "Confirm", icon: CheckCircle2 },
};

export const STEPS_MAP = {
  full_care_ride: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  doctor_consultation: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  doctor_online: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  physiotherapist: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  care_assistant: ["service", "patient", "schedule", "payment", "confirm"],
  diagnostic_center: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  diagnostic_home: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
  patient_transport: ["service", "patient", "schedule", "payment", "confirm"],
  follow_up: [
    "service",
    "provider",
    "patient",
    "schedule",
    "payment",
    "confirm",
  ],
};

export const DEFAULT_STEPS = [
  "service",
  "provider",
  "patient",
  "schedule",
  "payment",
  "confirm",
];

export const STEP_LABELS_MAP = {
  full_care_ride: {
    service: "Care Type",
    provider: "Hospital & Doctor",
    patient: "Patient Info",
    schedule: "Pickup & Trip",
    payment: "Fare & Pay",
    confirm: "Confirm Ride",
  },
  doctor_consultation: {
    service: "Service",
    provider: "Hospital & Doctor",
    patient: "Patient Info",
    schedule: "Appointment",
    payment: "Fee & Pay",
    confirm: "Confirm Visit",
  },
  doctor_online: {
    service: "Service",
    provider: "Select Doctor",
    patient: "Patient Info",
    schedule: "Call Time",
    payment: "Video Fee & Pay",
    confirm: "Confirm Call",
  },
  physiotherapist: {
    service: "Service",
    provider: "Select Therapist",
    patient: "Patient Info",
    schedule: "Session & Venue",
    payment: "Session Fee",
    confirm: "Confirm Session",
  },
  care_assistant: {
    service: "Service",
    patient: "Patient Info",
    schedule: "Location & Hours",
    payment: "Assistant Fee",
    confirm: "Confirm Assist",
  },
  diagnostic_center: {
    service: "Service",
    provider: "Select Lab",
    patient: "Patient Info",
    schedule: "Lab Appointment",
    payment: "Test Charges",
    confirm: "Confirm Tests",
  },
  diagnostic_home: {
    service: "Service",
    provider: "Select Lab",
    patient: "Patient Info",
    schedule: "Home Collection",
    payment: "Collection Fee",
    confirm: "Confirm Booking",
  },
  patient_transport: {
    service: "Service",
    patient: "Patient Info",
    schedule: "Route & Timing",
    payment: "Transport Fare",
    confirm: "Confirm Ride",
  },
  follow_up: {
    service: "Service",
    provider: "Same Doctor",
    patient: "Patient Info",
    schedule: "Follow-Up Date",
    payment: "Discounted Fee",
    confirm: "Confirm Follow-Up",
  },
};

export const BOOKING_TYPES = [
  {
    value: "full_care_ride",
    label: "Full Care Ride",
    icon: Ambulance,
    desc: "Doctor + care assistant + door-to-door transport",
    color: "#4f46e5",
    bg: "rgba(79,70,229,0.08)",
    needsDoctor: true,
    needsCare: true,
    needsTransport: true,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. For life-threatening emergencies call 108 immediately.",
    educationNotes: [
      "We assign a verified care assistant to accompany you from your home.",
      "Doctor consultation happens at the hospital you select.",
      "Transport fare: ₹/km (plan rate or platform default ₹21/km) + 5% GST. Base fare ₹50 applies.",
      "Care assistant fee is duration-based (tiered pricing). Fixed plan subscribers get CA free.",
      "18% GST on care assistant. Consultation fee is GST exempt (0%).",
    ],
    steps: [
      { step: "Care Type", note: "Choose Full Care Ride." },
      { step: "Hospital & Doctor", note: "Pick hospital & doctor." },
      { step: "Patient Info", note: "Enter patient details." },
      {
        step: "Pickup & Trip",
        note: "Set pickup location, care duration & transport route.",
      },
      { step: "Fare & Pay", note: "Review full fare breakdown & pay." },
    ],
  },
  {
    value: "doctor_consultation",
    label: "Doctor Consultation",
    icon: Stethoscope,
    desc: "In-person visit at hospital or clinic",
    color: "#0ea5e9",
    bg: "rgba(14,165,233,0.08)",
    needsDoctor: true,
    needsCare: false,
    needsTransport: false,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Serious conditions — go directly to emergency ward.",
    educationNotes: [
      "Book a slot with your preferred doctor at a hospital or clinic.",
      "Consultation fee set by hospital or doctor. In-person = 0% GST (healthcare exempt).",
      "Subscription holders: consultation counted against monthly free quota.",
      "You travel to the hospital on your own (add transport separately if needed).",
      "Follow-up bookings at discounted rates available after your visit (within policy window).",
    ],
    steps: [
      { step: "Service", note: "Choose Doctor Consultation." },
      { step: "Hospital & Doctor", note: "Pick hospital & doctor." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Appointment", note: "Set appointment date & time." },
      { step: "Fee & Pay", note: "Review fee & pay." },
    ],
  },
  {
    value: "doctor_online",
    label: "Online Consultation",
    icon: Video,
    desc: "Video call with your doctor from anywhere",
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
    needsDoctor: true,
    needsCare: false,
    needsTransport: false,
    isDiag: false,
    isOnline: true,
    tooltip:
      "⚠️ Non-emergency only. Physical symptoms requiring examination — book in-person instead.",
    educationNotes: [
      "Speak to a doctor via video call from your home.",
      "Video consultation attracts 5% GST (unlike in-person which is exempt).",
      "Basic/Standard/Premium plan holders: video not covered by in-person quota. Full fee + 5% GST charged.",
      "Family Care, Pregnant Women Care, NRI Care plans: check your plan's video mode coverage.",
      "Cash payment NOT available for video consultations. Use Wallet or Razorpay.",
    ],
    steps: [
      { step: "Service", note: "Choose Online Consultation." },
      { step: "Select Doctor", note: "Pick your doctor — no hospital needed." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Call Time", note: "Set call date & time." },
      { step: "Video Fee & Pay", note: "Review video fee + 5% GST & pay." },
    ],
  },
  {
    value: "physiotherapist",
    label: "Physiotherapist",
    icon: HeartPulse,
    desc: "Physio session at clinic or home visit",
    color: "#10b981",
    bg: "rgba(16,185,129,0.08)",
    needsDoctor: true,
    needsCare: false,
    needsTransport: false,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Acute injuries with severe pain — visit emergency first.",
    educationNotes: [
      "Book a physiotherapy session at a clinic or get a home visit.",
      "Home visit fee is higher than clinic session — factored into fare.",
      "Physiotherapy consultation = 0% GST (healthcare exempt).",
      "Ideal for post-surgery recovery, sports injuries, chronic pain.",
      "Subscription quota not consumed for physiotherapist bookings.",
    ],
    steps: [
      { step: "Service", note: "Choose Physiotherapist." },
      { step: "Select Therapist", note: "Pick physiotherapist." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Session & Venue", note: "Set session date & location." },
      { step: "Session Fee", note: "Review fee & pay." },
    ],
  },
  {
    value: "care_assistant",
    label: "Care Assistant",
    icon: UserCheck,
    desc: "Dedicated care assistant — auto-assigned nearest",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    needsDoctor: false,
    needsCare: true,
    needsTransport: false,
    isDiag: false,
    isOnline: false,
    tooltip: "⚠️ Non-emergency only. Medical emergencies — call 108 first.",
    educationNotes: [
      "We auto-assign the nearest verified, available care assistant to you.",
      "Pricing is tiered by session duration. 18% GST applies on care assistant fee.",
      "Fixed plan subscribers: CA visit free (quota consumed on assignment by admin).",
      "Custom plan subscribers: only your subscribed tier is free. Other tiers = platform rate.",
      "You cannot manually select an assistant — system picks nearest for fastest dispatch.",
    ],
    steps: [
      { step: "Service", note: "Choose Care Assistant." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Location & Hours", note: "Set date, location & duration." },
      { step: "Assistant Fee", note: "Review fee + 18% GST & pay." },
    ],
  },
  {
    value: "diagnostic_center",
    label: "Diagnostic Center",
    icon: Microscope,
    desc: "Lab tests at a diagnostic center (you travel to lab)",
    color: "#06b6d4",
    bg: "rgba(6,182,212,0.08)",
    needsDoctor: false,
    needsCare: false,
    needsTransport: false,
    isDiag: true,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Urgent diagnostic needs — visit hospital emergency.",
    educationNotes: [
      "Search for labs in your city and book tests or health packages.",
      "5% GST applies on diagnostic tests/packages.",
      "Subscription holders get up to 25% discount on diagnostics (admin-capped).",
      "Reports delivered digitally to your app, email, or WhatsApp.",
      "Fasting requirements for certain tests — lab will notify you.",
    ],
    steps: [
      { step: "Service", note: "Choose Diagnostic Center." },
      { step: "Select Lab", note: "Select lab & tests." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Lab Appointment", note: "Set appointment date." },
      { step: "Test Charges", note: "Review charges + 5% GST & pay." },
    ],
  },
  {
    value: "diagnostic_home",
    label: "Home Diagnostics",
    icon: TestTube2,
    desc: "Lab technician visits your home for sample collection",
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.08)",
    needsDoctor: false,
    needsCare: false,
    needsTransport: true,
    isDiag: true,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Critical samples — visit diagnostic centre directly.",
    educationNotes: [
      "A certified lab technician comes to your home to collect samples.",
      "Home collection fee set by lab + 5% GST. Waived if your plan includes it (one-time per subscription period).",
      "5% GST on diagnostic tests. 5% GST on home collection fee (if charged).",
      "Subscription: home collection once free per active period. After that, lab fee applies.",
      "Reports sent digitally — no need to visit lab at all.",
    ],
    steps: [
      { step: "Service", note: "Choose Home Diagnostics." },
      { step: "Select Lab", note: "Select lab & tests." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Home Collection", note: "Set date & home address." },
      { step: "Collection Fee", note: "Review charges + GST & pay." },
    ],
  },
  {
    value: "patient_transport",
    label: "Patient Transport",
    icon: Navigation2,
    desc: "Standalone transport — pickup to drop-off",
    color: "#64748b",
    bg: "rgba(100,116,139,0.08)",
    needsDoctor: false,
    needsCare: false,
    needsTransport: true,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency transport only. Ambulance emergencies — call 108.",
    educationNotes: [
      "Book a dedicated vehicle to transport a patient from one location to another.",
      "Fare = base fare ₹50 + (distance km × rate/km). 5% GST on total transport.",
      "Subscription plan rate overrides default ₹21/km (lower for higher plans).",
      "Return trip option: vehicle picks up from destination and returns patient home.",
      "Waiting charges: first 5 min free, then ₹2/min.",
    ],
    steps: [
      { step: "Service", note: "Choose Patient Transport." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Route & Timing", note: "Set pickup & drop-off." },
      { step: "Transport Fare", note: "Review fare + 5% GST & pay." },
    ],
  },
  {
    value: "follow_up",
    label: "Follow-Up Visit",
    icon: RefreshCw,
    desc: "Follow-up to a prior consultation (same doctor & hospital)",
    color: "#f97316",
    bg: "rgba(249,115,22,0.08)",
    needsDoctor: true,
    needsCare: false,
    needsTransport: false,
    isDiag: false,
    isOnline: false,
    tooltip:
      "⚠️ Non-emergency only. Must have a prior consultation with same doctor.",
    educationNotes: [
      "Book a follow-up with the same doctor from a previous Likeson booking.",
      "Follow-up fee is set by hospital/doctor policy — typically lower than first consultation.",
      "Follow-up fee is independent of subscription quota (quota NOT consumed).",
      "Eligibility auto-verified — must be within allowed follow-up window (usually 7 days).",
      "Not applicable for new conditions — book Doctor Consultation instead.",
    ],
    steps: [
      { step: "Service", note: "Choose Follow-Up Visit." },
      { step: "Same Doctor", note: "Select same doctor & hospital." },
      { step: "Patient Info", note: "Enter patient details." },
      { step: "Follow-Up Date", note: "Set appointment date." },
      { step: "Discounted Fee", note: "Review discounted fee & pay." },
    ],
  },
];

export const CONSULT_TYPES = [
  {
    value: "inPerson",
    label: "In-Person",
    icon: Stethoscope,
    feeKey: "inPersonFee",
    gstNote: "0% GST (exempt)",
  },
  {
    value: "video",
    label: "Video Call",
    icon: Video,
    feeKey: "videoFee",
    gstNote: "5% GST",
  },
  {
    value: "homeVisit",
    label: "Home Visit",
    icon: Home,
    feeKey: "homeVisitFee",
    gstNote: "5% GST · no sub",
  },
];

// Cash hidden for doctor_online — backend returns 400 for Cash on video
export const ALL_PAYMENT_METHODS = [
  {
    value: "Razorpay",
    label: "Razorpay",
    icon: CreditCard,
    desc: "UPI, Card, Net Banking · secure",
  },
  {
    value: "Wallet",
    label: "Wallet Balance",
    icon: Wallet,
    desc: "Deduct from your Likeson wallet",
  },
  {
    value: "Cash",
    label: "Pay at Service",
    icon: Coins,
    desc: "Pay cash at the time of service",
  },
];

export const getPaymentMethods = (bookingType) =>
  bookingType === "doctor_online"
    ? ALL_PAYMENT_METHODS.filter((m) => m.value !== "Cash")
    : ALL_PAYMENT_METHODS;

export const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer Not to Say"];
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
  "Unknown",
];
export const REPORT_MODES = ["Digital (App)", "Email", "WhatsApp", "Physical Copy"];

// GST rates by consultation type (Indian GST rules 2024)
// In-person: Section 9 healthcare exempt → 0%
// Video/audio tele-consultation → 5%
// Home visit → 5%
export const CONSULT_GST_RATE = {
  inPerson: 0.0,
  video: 0.05,
  homeVisit: 0.05,
};

// Platform GST rates reference
export const GST_RATES = {
  transport: 0.05, // 5% on transport
  careAssistant: 0.18, // 18% on care assistant
  diagnostics: 0.05, // 5% on diagnostics
  homeCollection: 0.05, // 5% on home sample collection
  pharmacy: 0.12, // 12% on pharmacy
  consultation: 0.0, // 0% in-person (exempt), 5% video/home
};

export const PP = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" };

export const slide = {
  enter: (d) => ({ x: d > 0 ? 40 : -40, opacity: 0 }),
  center: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", damping: 26, stiffness: 320 },
  },
  exit: (d) => ({
    x: d > 0 ? -40 : 40,
    opacity: 0,
    transition: { duration: 0.14 },
  }),
};

export const MAP_CONTAINER_STYLE = { width: "100%", height: "200px" };
