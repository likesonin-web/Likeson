"use client";

import React, { useCallback, memo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Stethoscope, Ambulance, HeartHandshake, Pill,
  Microscope, Zap, Activity, CheckCircle2,
  ArrowUpRight, ChevronRight, Sparkles,
} from "lucide-react";

// --- CONSTANTS & CONFIGURATIONS ---
const BOOK = (type) => `/book-appointment?type=${type}`;
const HOW_IT_WORKS = "/how-it-works";

// Extracted magic numbers for animations to ensure global consistency
const ANIMATION = {
  transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  viewport: { once: true, margin: "-60px" }
};

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (index) => ({
    opacity: 1,
    y: 0,
    transition: { ...ANIMATION.transition, delay: index * 0.08 }
  })
};

// Abstracted colors to CSS-friendly strings (easier to map to Tailwind or global CSS variables later)
const SERVICES_DATA = [
  {
    id: "full_care_ride", title: "Full Care Ride",
    tagline: "Door-to-door with a dedicated care assistant",
    description: "13-step care journey — verified assistant, GPS-tracked vehicle, medicines collected en route, safe return confirmed.",
    icon: Ambulance, href: BOOK("full_care_ride"), storyHref: `${HOW_IT_WORKS}#full-care-ride`,
    theme: { rgb: "249, 115, 22", hex: "#f97316" }, // Orange
    badge: "Most Popular",
    features: ["13-Step Care Journey", "Live GPS Tracking", "En-Route Pharmacy", "Safe Return Confirmed"],
  },
  {
    id: "doctor_consultation", title: "Doctor Consultation",
    tagline: "In-person visit at hospital or clinic",
    description: "Book board-certified specialists for in-person visits, home visits, or scheduled clinic appointments.",
    icon: Stethoscope, href: BOOK("doctor_consultation"), storyHref: `${HOW_IT_WORKS}#doctor-consultation`,
    theme: { rgb: "14, 165, 233", hex: "#0ea5e9" }, // Sky
    features: ["Choose Hospital & Doctor", "In-Person & Home Visits", "Digital Prescriptions", "Follow-Up Tracking"],
  },
  {
    id: "doctor_online", title: "Online Consultation",
    tagline: "Video call with your doctor from anywhere",
    description: "Video or audio appointments — ideal for NRIs managing parents remotely, follow-ups, and chronic care.",
    icon: Zap, href: BOOK("doctor_online"), storyHref: `${HOW_IT_WORKS}#doctor-online`,
    theme: { rgb: "139, 92, 246", hex: "#8b5cf6" }, // Violet
    badge: "NRI Friendly",
    features: ["24/7 Video & Audio", "Upload Patient History", "Instant Confirmation", "NRI-Friendly Scheduling"],
  },
  {
    id: "physiotherapist", title: "Physiotherapy",
    tagline: "Clinic or home session by a certified therapist",
    description: "Post-surgical recovery, mobility support, chronic pain — certified physio sessions at clinic or your home.",
    icon: Activity, href: BOOK("physiotherapist"), storyHref: `${HOW_IT_WORKS}#physiotherapist`,
    theme: { rgb: "239, 68, 68", hex: "#ef4444" }, // Red
    features: ["Certified Physiotherapists", "Clinic or Home Visit", "Post-Surgery Recovery", "Auto Follow-Up Reminders"],
  },
  {
    id: "care_assistant", title: "Care Assistant",
    tagline: "Background-verified professional at your side",
    description: "Verified care assistants who escort patients, manage queues, handle billing — so no one faces a hospital alone.",
    icon: HeartHandshake, href: BOOK("care_assistant"), storyHref: `${HOW_IT_WORKS}#care-assistant`,
    theme: { rgb: "16, 185, 129", hex: "#10b981" }, // Emerald
    features: ["Queue Management", "Billing Assistance", "Elderly Companionship", "Medication Reminders"],
  },
  {
    id: "diagnostic_home", title: "Home Diagnostics",
    tagline: "Lab technician at your doorstep",
    description: "NABL-accredited lab tests with home sample collection. Digital reports delivered to your dashboard in 6-48 hrs.",
    icon: Microscope, href: BOOK("diagnostic_home"), storyHref: `${HOW_IT_WORKS}#diagnostics`,
    theme: { rgb: "6, 182, 212", hex: "#06b6d4" }, // Cyan
    badge: "Home Visit",
    features: ["NABL Accredited Labs", "Home Sample Collection", "Reports in 6-48 hrs", "Full Body Packages"],
  },
  {
    id: "pharmacy", title: "Pharmacy Delivery",
    tagline: "Verified medicines, delivered fast",
    description: "Express delivery with cold-chain maintenance — including auto-refill plans for chronic patients.",
    icon: Pill, href: BOOK("pharmacy"), storyHref: `${HOW_IT_WORKS}#pharmacy`,
    theme: { rgb: "245, 158, 11", hex: "#f59e0b" }, // Amber
    features: ["2-Hour Express Delivery", "Cold-Chain Maintained", "Auto-Refill Chronic", "Prescription Digitization"],
  },
];

// --- COMPONENTS ---

const SpotlightCard = memo(({ service, index }) => {
  const Icon = service.icon;
  const cardRef = useRef(null);
  const requestRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  // 1. Performance: Throttled mouse move via requestAnimationFrame
  const handleMouseMove = useCallback((e) => {
    const el = cardRef.current;
    if (!el) return;

    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    requestRef.current = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el.style.setProperty("--spot-x", `${x}px`);
      el.style.setProperty("--spot-y", `${y}px`);
    });
  }, []);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const { theme } = service;
  // Dynamic palette generation to avoid hardcoded boilerplate
  const palette = {
    glow: `rgba(${theme.rgb}, 0.32)`,
    border: `rgba(${theme.rgb}, 0.5)`,
    light: `rgba(${theme.rgb}, 0.10)`,
    text: theme.hex
  };

  return (
    <motion.li
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      initial={false}
      custom={index}
      variants={cardVariants}
      whileInView="visible"
      viewport={ANIMATION.viewport}
      animate={{ scale: hovered ? 1.015 : 1 }}
      style={{ listStyle: "none", "--spot-x": "50%", "--spot-y": "50%" }}
      className="relative rounded-2xl will-change-transform group"
      aria-labelledby={`svc-title-${service.id}`}
    >
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={{
          boxShadow: hovered
            ? `0 0 0 1.5px ${palette.border}, 0 20px 56px -10px ${palette.glow}, 0 6px 18px -4px ${palette.glow}`
            : "0 0 0 1px var(--base-300), 0 4px 12px -4px rgba(0,0,0,0.06)",
        }}
        transition={{ duration: 0.3 }}
      />

      <div className="relative h-full rounded-2xl overflow-hidden flex flex-col bg-base-100">
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300 hidden sm:block"
          style={{
            opacity: hovered ? 1 : 0,
            background: `radial-gradient(180px circle at var(--spot-x) var(--spot-y), ${palette.glow}, transparent 80%)`,
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col flex-1 p-7">
          <div className="flex items-start justify-between mb-7">
            <motion.div
              animate={{ scale: hovered ? 1.1 : 1, rotate: hovered ? 5 : 0 }}
              transition={{ duration: 0.3 }}
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-colors duration-300"
              style={{
                backgroundColor: hovered ? palette.light : "var(--base-200)",
                boxShadow: hovered ? `0 0 16px ${palette.glow}` : "none",
              }}
            >
              <Icon size={26} style={{ color: palette.text }} strokeWidth={1.6} aria-hidden="true" />
            </motion.div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {service.badge && (
                <span
                  className="font-poppins text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: palette.light, color: palette.text, border: `1px solid ${palette.border}` }}
                >
                  {service.badge}
                </span>
              )}
              {/* 3. UX: Higher z-index to ensure this button isn't blocked by the main card's invisible link */}
              <Link
                href={service.storyHref}
                className="relative z-20 w-9 h-9 rounded-full border border-base-300 text-base-content/50 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:text-base-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`See how ${service.title} works`}
              >
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          <div className="mb-6">
            <p className="font-poppins text-xs font-black uppercase tracking-[0.16em] mb-1.5" style={{ color: palette.text }}>
              {service.tagline}
            </p>
            <h2 id={`svc-title-${service.id}`} className="font-montserrat text-[1.3rem] text-base-content font-black leading-tight tracking-tight mb-3">
              {service.title}
            </h2>
            <p className="font-poppins text-xs md:text-sm leading-relaxed text-base-content/70">
              {service.description}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-7 mt-auto">
            {service.features.map((f) => (
              <span
                key={f}
                className="font-poppins inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: hovered ? palette.light : "var(--base-200)",
                  color: hovered ? palette.text : "var(--base-content)",
                  borderColor: hovered ? palette.border : "var(--base-300)",
                  borderWidth: "1px",
                  borderStyle: "solid"
                }}
              >
                <CheckCircle2 size={12} className="shrink-0" aria-hidden="true" />
                {f}
              </span>
            ))}
          </div>

          {/* 4. UX: `after:absolute after:inset-0` stretches the click area across the entire card */}
          <Link href={service.href} aria-label={`Book ${service.title}`} className="relative z-10 after:absolute after:inset-0 after:z-10">
            <motion.div
              className="font-poppins relative w-full flex items-center justify-between px-5 py-3.5 rounded-xl overflow-hidden font-black text-sm"
              animate={{ 
                backgroundColor: hovered ? palette.text : "var(--base-200)", 
                color: hovered ? "#ffffff" : palette.text 
              }}
              transition={{ duration: 0.28 }}
            >
              <span>Book Now</span>
              <motion.span animate={{ x: hovered ? 3 : 0 }} transition={{ duration: 0.22 }}>
                <ArrowUpRight size={16} aria-hidden="true" />
              </motion.span>
            </motion.div>
          </Link>
        </div>
      </div>
    </motion.li>
  );
});
SpotlightCard.displayName = "SpotlightCard";

const AmbientBG = memo(() => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
    <div className="absolute top-[-15%] right-[-8%] w-[700px] h-[700px] rounded-full blur-[140px] bg-[#0ea5e9]/5" />
    <div className="absolute bottom-[-10%] left-[-8%] w-[600px] h-[600px] rounded-full blur-[120px] bg-[#10b981]/5" />
    <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] rounded-full blur-[100px] bg-[#8b5cf6]/5" />
  </div>
));
AmbientBG.displayName = "AmbientBG";

const SectionHeader = memo(() => (
  <motion.header
    className="max-w-3xl mb-20"
    initial={false}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={ANIMATION.viewport}
    transition={ANIMATION.transition}
  >
    <div className="flex items-center gap-3 mb-6">
      <div className="font-poppins flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.15em] bg-[#0ea5e9]/10 border border-[#0ea5e9]/25 text-[#0ea5e9]">
        <Sparkles size={12} aria-hidden="true" />
        Our Services
      </div>
    </div>
    
    <h2 className="font-montserrat text-base-content text-4xl md:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.08] mb-6">
      Modern Healthcare,{" "}
      <br className="hidden sm:block" />
      <span className="text-gradient-primary">Right at Your Door.</span>
    </h2>
    
    <p className="font-poppins text-base-content/70 text-base md:text-md leading-relaxed mb-8 max-w-xl">
      <strong className="text-base-content font-bold">Likeson.in</strong> brings{" "}
      <span className="text-primary font-bold">expert doctors</span> and{" "}
      <span className="text-primary font-bold">essential medical services</span>{" "}
      directly to your home. Skip the waiting rooms — book below.
    </p>
    
    <Link 
      href={HOW_IT_WORKS}
      className="font-poppins text-primary inline-flex items-center gap-2 text-sm font-bold transition-all duration-300 hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
    >
      See how each service works
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  </motion.header>
));
SectionHeader.displayName = "SectionHeader";

const BottomCTA = memo(() => (
  <motion.div
    className="mt-20 relative rounded-3xl overflow-hidden"
    initial={false}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={ANIMATION.viewport}
    transition={ANIMATION.transition}
    style={{ backgroundImage: "var(--bg-gradient-primary)" }}
  >
    <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6 px-8 py-10">
      <div>
        <p className="font-poppins text-white/90 text-sm font-semibold mb-1">
          Not sure which service you need?
        </p>
        <p className="font-montserrat text-white text-xl md:text-2xl font-black tracking-tight">
          Talk to our care team — we&apos;ll guide you.
        </p>
      </div>
      <Link href="/contact" aria-label="Contact the Likeson.in team">
        <motion.div
          whileHover={{ scale: 1.04, backgroundColor: "rgba(255,255,255,0.25)" }}
          whileTap={{ scale: 0.97 }}
          className="font-poppins flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-black text-sm whitespace-nowrap cursor-pointer bg-white/20 text-white border-[1.5px] border-white/30 backdrop-blur-md transition-colors"
        >
          Talk to Our Team
          <ChevronRight size={18} aria-hidden="true" />
        </motion.div>
      </Link>
    </div>
  </motion.div>
));
BottomCTA.displayName = "BottomCTA";

const Services = memo(() => (
  <section id="services" className="relative min-h-screen bg-base-100 text-base-content overflow-hidden" aria-labelledby="services-heading">
    <AmbientBG />
    <div className="relative z-10 container-custom py-24 lg:py-32">
      <SectionHeader />
      <ul className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" aria-label="Likeson.in healthcare services">
        {SERVICES_DATA.map((service, i) => (
          <SpotlightCard key={service.id} service={service} index={i} />
        ))}
      </ul>
      <BottomCTA />
    </div>
  </section>
));
Services.displayName = "Services";

export default Services;