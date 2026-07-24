"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Car,
  UserCheck,
  Stethoscope,
  FlaskConical,
  Pill,
  ArrowRight,
  CheckCircle2,
  Star,
  Heart,
  Sparkles,
  ChevronDown,
  Phone,
  Clock,
  Shield,
  MapPin,
  MessageCircleQuestion,
} from "lucide-react";
import Subscription from "@/app/(page)/Subscription";

/* ─────────────────────────────────────────
   DATA
   bookingType values must match STEPS_MAP keys in BookingSystem. JSX:
   full_care_ride | doctor_consultation | doctor_online | physiotherapist |
   care_assistant | diagnostic_center   | diagnostic_home | patient_transport | follow_up
───────────────────────────────────────── */
const SERVICES = [
  {
    id: "transport",
    theme: "transport",
    icon: Car,
    badge: "Safe Rides",
    title: "Patient Transportation",
    tagline: "We take you there. Safely. Always.",
    description:
      "Pre-scheduled, wheelchair-accessible rides with real-time GPS tracking—built specifically for elderly and mobility-challenged patients.",
    color: "oklch(54% 0.20 192)",
    accent: "oklch(74% 0.18 68)",
    gradient: "linear-gradient(135deg, oklch(54% 0.20 192) 0%, oklch(44% 0.08 215) 100%)",
    softBg: "oklch(54% 0.20 192 / 0.07)",
    features: [
      "Pre-scheduled hospital rides",
      "Wheelchair-accessible vehicles",
      "Real-time GPS tracking",
      "Care assistant integration",
      "₹500–₹1,000 per trip",
    ],
    stats: { value: "250+", label: "Rides / Year" },
    emoji: "🚗",
    bookingType: "patient_transport",
    bookingPath: "/book-appointment?type=patient_transport",
  },
  {
    id: "care",
    theme: "care-assistant",
    icon: UserCheck,
    badge: "Human Touch",
    title: "Care Assistant",
    tagline: "Never face the hospital alone.",
    description:
      "Background-verified care companions escort you through every step—registration, waiting lines, lab collections, and the ride home.",
    color: "oklch(58% 0.20 12)",
    accent: "oklch(76% 0.15 82)",
    gradient: "linear-gradient(135deg, oklch(58% 0.20 12) 0%, oklch(62% 0.16 345) 100%)",
    softBg: "oklch(58% 0.20 12 / 0.07)",
    features: [
      "Hospital registration support",
      "Escort through tests & labs",
      "Medicine collection",
      "Gig-based, pay per visit",
      "₹500–₹800 per session",
    ],
    stats: { value: "200+", label: "Assistants Ready" },
    emoji: "🤝",
    bookingType: "care_assistant",
    bookingPath: "/book-appointment?type=care_assistant",
  },
  {
    id: "doctor",
    theme: "doctor",
    icon: Stethoscope,
    badge: "Expert Care",
    title: "Doctor Consultations",
    tagline: "Your doctor. Your schedule.",
    description:
      "Book in-person visits, video calls, or home visits with certified physicians. Smart follow-up reminders keep your care continuous.",
    color: "oklch(50% 0.22 250)",
    accent: "oklch(66% 0.18 162)",
    gradient: "linear-gradient(135deg, oklch(50% 0.22 250) 0%, oklch(62% 0.14 225) 100%)",
    softBg: "oklch(50% 0.22 250 / 0.07)",
    features: [
      "In-person & virtual consults",
      "Home doctor visits",
      "E-prescriptions auto-linked",
      "Smart follow-up reminders",
      "₹300–₹700 per consult",
    ],
    stats: { value: "10+", label: "Consults / Month" },
    emoji: "👨‍⚕️",
    bookingType: "doctor_consultation",
    bookingPath: "/book-appointment?type=doctor_consultation",
    quickLinks: [
      { label: "Video Call", path: "/book-appointment?type=doctor_online" },
      { label: "Follow-Up", path: "/book-appointment?type=follow_up" },
    ],
  },
  {
    id: "diagnostics",
    theme: "lab",
    icon: FlaskConical,
    badge: "Home Testing",
    title: "Diagnostic Services",
    tagline: "Lab-grade tests at your doorstep.",
    description:
      "NABL-accredited sample collection at home—CBC, sugar, thyroid, lipid panel, and more. Digital reports delivered in 6–48 hours.",
    color: "oklch(55% 0.24 285)",
    accent: "oklch(74% 0.20 102)",
    gradient: "linear-gradient(135deg, oklch(55% 0.24 285) 0%, oklch(48% 0.20 265) 100%)",
    softBg: "oklch(55% 0.24 285 / 0.07)",
    features: [
      "Home sample collection",
      "NABL/NABH accredited labs",
      "CBC, Sugar, Thyroid & more",
      "Digital reports in 6–48 hrs",
      "₹700–₹1,500 per test",
    ],
    stats: { value: "99%", label: "Accuracy Rate" },
    emoji: "🔬",
    bookingType: "diagnostic_home",
    bookingPath: "/book-appointment?type=diagnostic_home",
    quickLinks: [
      { label: "Visit Lab Instead", path: "/book-appointment?type=diagnostic_center" },
    ],
  },
  {
    id: "pharmacy",
    theme: "pharmacy",
    icon: Pill,
    badge: "Fast Delivery",
    title: "Pharmacy Services",
    tagline: "Medicines. At your door in hours.",
    description:
      "E-prescription-linked delivery within 2–24 hours. Auto-refill plans for chronic conditions so you never miss a dose.",
    color: "oklch(50% 0.22 158)",
    accent: "oklch(72% 0.18 88)",
    gradient: "linear-gradient(135deg, oklch(50% 0.22 158) 0%, oklch(62% 0.15 172) 100%)",
    softBg: "oklch(50% 0.22 158 / 0.07)",
    features: [
      "E-prescription auto-fill",
      "Delivery in 2–24 hours",
      "Auto-refill for chronic care",
      "Competitive pricing",
      "₹100–₹500+ per order",
    ],
    stats: { value: "24hr", label: "Max Delivery" },
    emoji: "💊",
    bookingType: "full_care_ride",
    bookingPath: "/book-appointment?type=full_care_ride",
  },
];

/* ─────────────────────────────────────────
   ANIMATION VARIANTS
───────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: (i = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

/* ─────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <motion.span
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border"
      style={{
        background: "color-mix(in oklch, var(--primary) 10%, transparent)",
        borderColor: "color-mix(in oklch, var(--primary) 30%, transparent)",
        color: "var(--primary)",
      }}
    >
      <Sparkles size={12} />
      {children}
    </motion.span>
  );
}

function ServiceCard({ service, index }) {
  const [open, setOpen] = useState(false);
  const Icon = service.icon;
  const router = useRouter();

  const handleBookNow = () => {
    router.push(service.bookingPath);
  };

  const handleQuickLink = (path) => {
    router.push(path);
  };

  return (
    <motion.div
      variants={scaleIn}
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className="relative group rounded-3xl border overflow-hidden transition-shadow hover:shadow-xl"
      style={{
        background: "var(--base-100)",
        borderColor: "var(--base-300)",
      }}
      whileHover={{ y: -6, transition: { duration: 0.3 } }}
    >
      {/* Top gradient strip */}
      <div
        className="h-1.5 w-full"
        style={{ background: service.gradient }}
      />

      <div className="p-7">
        {/* Header row */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <motion.div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm"
              style={{ background: service.softBg }}
              whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.4 } }}
            >
              <Icon size={26} style={{ color: service.color }} />
            </motion.div>

            <div>
              <span
                className="badge badge-xs font-bold uppercase tracking-wider mb-1"
                style={{
                  background: service.softBg,
                  color: service.color,
                  border: `1px solid ${service.color}40`,
                }}
              >
                {service.badge}
              </span>
              <h3
                className="font-extrabold text-[20px] font-montserrat leading-tight"
                style={{ color: "var(--base-content)" }}
              >
                {service.title}
              </h3>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="font-display font-black text-2xl" style={{ color: service.color }}>
              {service.stats.value}
            </div>
            <div
              className="text-[8px] font-semibold"
              style={{ color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}
            >
              {service.stats.label}
            </div>
          </div>
        </div>

        <p className="font-display font-bold text-sm mb-2" style={{ color: service.color }}>
          {service.tagline}
        </p>

        <p
          className="text-xs leading-relaxed mb-5"
          style={{ color: "color-mix(in oklch, var(--base-content) 70%, transparent)" }}
        >
          {service.description}
        </p>

        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider mb-3 transition-colors cursor-pointer hover:opacity-80"
          style={{ color: service.color }}
        >
          <span>{open ? "Hide details" : "See what's included"}</span>
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown size={14} />
          </motion.span>
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden space-y-2 mb-5"
            >
              {service.features.map((f, i) => (
                <motion.li
                  key={i}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-2.5 text-xs"
                  style={{ color: "var(--base-content)" }}
                >
                  <CheckCircle2 size={15} style={{ color: service.color, flexShrink: 0 }} />
                  {f}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleBookNow}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer"
          style={{
            background: service.gradient,
            color: "#fff",
            boxShadow: `0 6px 20px ${service.color}55`,
          }}
        >
          Book Now <ArrowRight size={15} />
        </motion.button>

        {service.quickLinks?.length > 0 && (
          <div className="flex gap-2 mt-3">
            {service.quickLinks.map((ql) => (
              <button
                key={ql.path}
                onClick={() => handleQuickLink(ql.path)}
                className="flex-1 py-2 rounded-xl text-[10px] font-bold border-2 transition-all hover:opacity-80 cursor-pointer"
                style={{
                  borderColor: `${service.color}50`,
                  color: service.color,
                  background: service.softBg,
                }}
              >
                {ql.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TrustBadge({ icon: Icon, title, desc }) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="flex items-start gap-4 p-5 rounded-2xl border transition-colors hover:border-primary/40 cursor-default"
      style={{ background: "var(--base-200)", borderColor: "var(--base-300)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "color-mix(in oklch, var(--primary) 12%, transparent)" }}
      >
        <Icon size={20} style={{ color: "var(--primary)" }} />
      </div>
      <div>
        <p className="font-bold text-xs mb-0.5" style={{ color: "var(--base-content)" }}>
          {title}
        </p>
        <p
          className="text-[10px]"
          style={{ color: "color-mix(in oklch, var(--base-content) 55%, transparent)" }}
        >
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────
   HERO SECTION
───────────────────────────────────────── */
function ServicesHero() {
  const router = useRouter();

  return (
    <section className="relative overflow-hidden pt-24 pb-20 px-4">
      {/* Ambient blobs */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ background: "var(--primary)" }}
      />
      <div
        className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full blur-3xl opacity-15 pointer-events-none"
        style={{ background: "var(--secondary)" }}
      />

      <div className="max-w-5xl mx-auto text-center relative z-10">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="flex items-center justify-center gap-2 mb-6"
        >
          <Heart size={16} style={{ color: "var(--error)" }} fill="currentColor" />
          <span
            className="text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border"
            style={{
              background: "color-mix(in oklch, var(--primary) 10%, transparent)",
              borderColor: "color-mix(in oklch, var(--primary) 30%, transparent)",
              color: "var(--primary)",
            }}
          >
            Complete Healthcare, One Platform
          </span>
          <Heart size={16} style={{ color: "var(--error)" }} fill="currentColor" />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate="visible"
          className="font-display font-black text-5xl md:text-7xl leading-none mb-6"
          style={{ color: "var(--base-content)" }}
        >
          Care that{" "}
          <span
            className="block"
            style={{
              background: "var(--bg-gradient-primary)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            comes to you.
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate="visible"
          className="text-lg md:text-md max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ color: "color-mix(in oklch, var(--base-content) 65%, transparent)" }}
        >
          From your home to the hospital and back, Likeson.in bundles transport, doctors, diagnostics, care assistants, and medicines into one seamless journey.
        </motion.p>

        <motion.div
          variants={fadeUp}
          custom={3}
          initial="hidden"
          animate="visible"
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push("/book-appointment?type=full_care_ride")}
            className="flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer"
            style={{
              background: "var(--bg-gradient-primary)",
              boxShadow: "0 8px 25px color-mix(in oklch, var(--primary) 40%, transparent)",
            }}
          >
            <Phone size={16} /> Book a Service
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              document.getElementById("plans-section")?.scrollIntoView({ behavior: "smooth" })
            }
            className="px-8 py-3.5 rounded-2xl text-sm font-bold border-2 transition-all cursor-pointer hover:bg-primary/5"
            style={{
              borderColor: "color-mix(in oklch, var(--primary) 40%, transparent)",
              color: "var(--primary)",
              background: "transparent",
            }}
          >
            Explore Subscription Plans
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   JOURNEY STRIP
───────────────────────────────────────── */
function JourneyStrip() {
  const router = useRouter();

  const steps = [
    { icon: "📱", label: "Book on App", path: "/book" },
    { icon: "🚗", label: "Ride Arrives", path: "/book-appointment?type=patient_transport" },
    { icon: "🤝", label: "Care Assistant", path: "/book-appointment?type=care_assistant" },
    { icon: "👨‍⚕️", label: "Doctor Visit", path: "/book-appointment?type=doctor_consultation" },
    { icon: "🔬", label: "Lab Tests", path: "/book-appointment?type=diagnostic_home" },
    { icon: "💊", label: "Medicines Delivered", path: "/book-appointment?type=full_care_ride" },
  ];

  return (
    <section className="py-10 px-4 overflow-x-auto">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-0 min-w-max mx-auto justify-center">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex flex-col items-center gap-2"
              >
                <motion.button
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push(s.path)}
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl border transition-all hover:shadow-md cursor-pointer"
                  style={{
                    background: "var(--base-200)",
                    borderColor: "var(--base-300)",
                  }}
                  title={`Book: ${s.label}`}
                >
                  {s.icon}
                </motion.button>
                <span
                  className="text-[10px] font-bold text-center w-20 leading-tight"
                  style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}
                >
                  {s.label}
                </span>
              </motion.div>
              {i < steps.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 + 0.2, duration: 0.3 }}
                  className="w-8 h-0.5 mx-1 mb-5"
                  style={{ background: "var(--base-300)", transformOrigin: "left" }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────
   FLOATING CUSTOMER HELP BUTTON
───────────────────────────────────────── */
function CustomerHoverButton() {
  const router = useRouter();

  return (
    <motion.button
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.8 }}
      onClick={() => router.push("/contact")}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-content p-3.5 rounded-full shadow-2xl transition-all hover:pr-5 group cursor-pointer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <MessageCircleQuestion size={22} />
      <span className="w-0 overflow-hidden opacity-0 group-hover:w-auto group-hover:opacity-100 whitespace-nowrap text-sm font-bold transition-all duration-300 ease-in-out">
        Need Help?
      </span>
    </motion.button>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
export default function Services() {
  const router = useRouter();

  return (
    <main style={{ background: "var(--base-100)", color: "var(--base-content)" }} className="md:mx-20 relative">

      {/* Floating Action Button */}
      <CustomerHoverButton />

      {/* ── HERO ── */}
      <ServicesHero />

      {/* ── JOURNEY ── */}
      <JourneyStrip />

      {/* ── TRUST BADGES ── */}
      <section className="py-10 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Shield, title: "Verified Partners", desc: "NABL/NABH accredited labs & licensed pharmacies" },
            { icon: Clock, title: "On-Demand", desc: "Book in minutes, served within hours" },
            { icon: MapPin, title: "Real-Time Tracking", desc: "Know exactly where your ride is" },
            { icon: Heart, title: "Human Care", desc: "Trained assistants at every step" },
          ].map((b, i) => (
            <TrustBadge key={i} {...b} />
          ))}
        </div>
      </section>

      {/* ── SERVICES GRID ── */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <SectionLabel>Our Services</SectionLabel>
            <motion.h2
              variants={fadeUp}
              custom={1}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="font-display font-black text-4xl md:text-5xl mt-4 mb-3"
              style={{ color: "var(--base-content)" }}
            >
              Everything you need.{" "}
              <span
                className="block"
                style={{
                  background: "var(--bg-gradient-primary)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Under one roof.
              </span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="text-base max-w-xl mx-auto"
              style={{ color: "color-mix(in oklch, var(--base-content) 60%, transparent)" }}
            >
              Five essential healthcare services — each designed for dignity, ease, and the people who need it most.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s, i) => (
              <ServiceCard key={s.id} service={s} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── SUBSCRIPTION PLANS ── */}
      <div id="plans-section">
        <Subscription />
      </div>

      {/* ── EMOTIONAL CTA ── */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            variants={scaleIn}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="relative rounded-3xl overflow-hidden p-12"
            style={{
              background: "var(--bg-gradient-primary)",
              boxShadow: "var(--shadow-depth-lg)",
            }}
          >
            {/* decorative circles */}
            <div
              className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-20"
              style={{ background: "#fff" }}
            />
            <div
              className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full opacity-10"
              style={{ background: "#fff" }}
            />

            <div className="relative z-10">
              <div className="text-5xl mb-4">❤️</div>
              <h2 className="font-display font-black text-3xl md:text-4xl text-white mb-4 leading-tight">
                Because your parents deserve the best care — even when you're far away.
              </h2>
              <p className="text-white/75 mb-8 text-base max-w-lg mx-auto">
                Likeson.in was built for families separated by distance. One app, one call — and your loved one is cared for.
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => router.push("/book-appointment?type=full_care_ride")}
                className="inline-flex items-center gap-2 bg-white font-bold text-sm px-8 py-4 rounded-2xl transition-all shadow-lg cursor-pointer hover:bg-gray-50"
                style={{ color: "var(--primary)" }}
              >
                <Phone size={18} /> Get Started Today
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}