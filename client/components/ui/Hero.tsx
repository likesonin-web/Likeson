"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  MotionConfig,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Ambulance,
  ArrowUpRight,
  Award,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pill,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

// ── Sky Background Image ────────────────────────────────────────────────────────
const SKY_SRC = "/images/hero/pexels-meomupmofilm-2153775418-34224463.jpg";

// ── Real Pexels Avatars for Social Proof (Small & Compact) ──────────────────────
const SOCIAL_AVATARS = [
  {
    src: "https://images.pexels.com/photos/5215024/pexels-photo-5215024.jpeg?auto=compress&cs=tinysrgb&w=150",
    alt: "Dr. Priya Nair, Pediatrician",
  },
  {
    src: "https://images.pexels.com/photos/4173251/pexels-photo-4173251.jpeg?auto=compress&cs=tinysrgb&w=150",
    alt: "Dr. Ramesh Sharma, Cardiologist",
  },
  {
    src: "https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=150",
    alt: "Sunita Rao, Verified Patient",
  },
  {
    src: "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150",
    alt: "Arjun Mehta, Verified Patient",
  },
  {
    src: "https://images.pexels.com/photos/7578803/pexels-photo-7578803.jpeg?auto=compress&cs=tinysrgb&w=150",
    alt: "Anita Desai, Care Assistant",
  },
];

// ── 8 3D Cards using /public/images/cards ───────────────────────────────────────
export interface SlideCardItem {
  id: string;
  src: string;
  alt: string;
  label: string;
  title: string;
  tag: string;
  ctaText: string;
  href: string;
}

const CARDS: SlideCardItem[] = [
  {
    id: "telemedicine",
    src: "/images/cards/Warm_Telemedicine_Consultation.png",
    alt: "Doctor on a warm video consultation with a patient",
    label: "Video visit",
    title: "Instant Doctor Consultation",
    tag: "Connect in < 3 Mins",
    ctaText: "Consult Doctor",
    href: "/doctors",
  },
  {
    id: "blood-draw",
    src: "/images/cards/Friendly_Blood_Draw_in_a_Modern_Lab.png",
    alt: "Friendly lab technician drawing blood in a modern clinic",
    label: "Lab tests",
    title: "Full Body Diagnostic Panel",
    tag: "62+ Tests • NABL Accredited",
    ctaText: "Book Lab Test",
    href: "/labs",
  },
  {
    id: "pharmacist",
    src: "/images/cards/Friendly_Pharmacist_Handing_Medicine_Bag.png",
    alt: "Friendly pharmacist handing medicine bag to a customer",
    label: "Pharmacy",
    title: "Doorstep Medicine Delivery",
    tag: "Flat 20% OFF • 2h Delivery",
    ctaText: "Order Medicines",
    href: "/pharmacy",
  },
  {
    id: "ambulance-ride",
    src: "/images/cards/Friendly_Ride_to_the_Future.png",
    alt: "Ambulance driver opening car door for patient outside hospital",
    label: "Hospital ride",
    title: "Emergency ALS Ambulance",
    tag: "ICU Onboard • < 8m Dispatch",
    ctaText: "Request Ride",
    href: "/request-ride",
  },
  {
    id: "courier-gps",
    src: "/images/cards/Hospital_Courier_Showing_GPS_Route.png",
    alt: "Hospital courier showing live GPS route on smartphone",
    label: "Live tracking",
    title: "Real-Time Ambulance Tracking",
    tag: "Live Route & ETA Updates",
    ctaText: "Track Ride",
    href: "/request-ride",
  },
  {
    id: "doorstep-delivery",
    src: "/images/cards/Smart_Healthcare_Delivery_at_Home.png",
    alt: "Smart healthcare delivery box handed at home doorstep",
    label: "Doorstep delivery",
    title: "Temperature-Controlled Delivery",
    tag: "Prescriptions & Essentials",
    ctaText: "Order Delivery",
    href: "/pharmacy",
  },
  {
    id: "clinic-walk",
    src: "/images/cards/Caring_Walk_to_the_Clinic.png",
    alt: "Care assistant walking elderly patient to healthcare clinic",
    label: "Care assistant",
    title: "Bedside Nursing & Elderly Care",
    tag: "100% Background Verified",
    ctaText: "Book Assistant",
    href: "/services",
  },
  {
    id: "telehealth-home",
    src: "/images/cards/Telehealth_Comfort_at_Home.png",
    alt: "Patient comfortably booking healthcare services on mobile at home",
    label: "Book from home",
    title: "Integrated Family Healthcare",
    tag: "Unified Health Membership",
    ctaText: "Explore Plans",
    href: "/subscriptions",
  },
];

const N = CARDS.length;
const AUTOPLAY_MS = 3400;

const springPhysics = {
  type: "spring",
  stiffness: 160,
  damping: 22,
  mass: 0.75,
} as const;

// ── Partner Accreditations Strip ────────────────────────────────────────────────
const ACCREDITATIONS = [
  { icon: Award, label: "NABL Accredited Labs" },
  { icon: Building2, label: "NABH Partner Hospitals" },
  { icon: Pill, label: "CDSCO Approved Drugs" },
  { icon: ShieldCheck, label: "ISO 9001:2015 Quality" },
  { icon: Ambulance, label: "24/7 Emergency Dispatch" },
  { icon: CheckCircle2, label: "100% Verified Caregivers" },
];

export default function Hero() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [windowWidth, setWindowWidth] = useState(1200);

  // Responsive screen measurement
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  // Auto-advancing continuous loop (moves left)
  const nextSlide = useCallback(() => {
    setActive((prev) => (prev + 1) % N);
  }, []);

  const prevSlide = useCallback(() => {
    setActive((prev) => (prev - 1 + N) % N);
  }, []);

  useEffect(() => {
    if (reduce || paused) return;
    const interval = setInterval(nextSlide, AUTOPLAY_MS);
    return () => clearInterval(interval);
  }, [reduce, paused, nextSlide]);

  // Signed distance from current active card, wrapped to [-N/2, N/2)
  const getOffset = (idx: number) => {
    const diff = (idx - active + N) % N;
    return diff > N / 2 ? diff - N : diff;
  };

  return (
    <MotionConfig reducedMotion="user">
      <section className="w-full flex flex-col items-center">
        {/* ── 1. MAIN HERO CONTAINER: 94% Mobile, 90% MD, Max-W-7xl, Rounded Box ── */}
        <div className="w-[94%] md:w-[90%] max-w-7xl mx-auto">
          <div className="relative isolate flex min-h-[700px] sm:min-h-[760px] md:min-h-[800px] w-full flex-col items-center justify-between overflow-hidden rounded-[calc(var(--r-box)*2)] md:rounded-[calc(var(--r-box)*2.5)] text-primary-content shadow-depth-lg">
            {/* Background: Sky Photo */}
            <Image
              src={SKY_SRC}
              alt="Likeson Healthcare Sky"
              fill
              priority
              sizes="(min-width: 1280px) 1280px, 94vw"
              className="-z-30 object-cover object-center"
            />

            {/* Bright & Luminous Sky Gradient Overlay (Light Theme, No Multiply) */}
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-20 bg-gradient-to-b from-primary/35 via-secondary/15 to-transparent pointer-events-none"
            />

            {/* ── Fading Bottom Edge & Rounded Corner Clouds ─────────────────── */}
            {/* Bottom edge gradient fading into page base */}
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 -z-10 h-40 sm:h-52 bg-gradient-to-t from-base-100 via-base-100/50 to-transparent pointer-events-none"
            />

            {/* Bottom-left fading corner cloud */}
            <div
              aria-hidden="true"
              className="absolute -bottom-10 -left-10 -z-10 size-48 sm:size-64 rounded-full bg-base-100/80 blur-2xl pointer-events-none"
            />

            {/* Bottom-right fading corner cloud */}
            <div
              aria-hidden="true"
              className="absolute -bottom-10 -right-10 -z-10 size-48 sm:size-64 rounded-full bg-base-100/80 blur-2xl pointer-events-none"
            />

            {/* ── Top Header Text & Real CTAs (Humanized, Clean, Punchy) ───────── */}
            <div className="relative z-20 flex w-full max-w-3xl flex-col items-center px-4 pt-8 text-center sm:px-6 md:pt-12">
              {/* Warm, Simple Pill Tag */}
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/20 px-3.5 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md shadow-sm"
              >
                <Sparkles className="size-3.5 text-white" />
                <span>Care that comes to your home</span>
              </motion.div>

              {/* Humanized Headline: Simple, Punchy, Focused */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.08 }}
                className="font-montserrat text-2xl xs:text-3xl sm:text-5xl md:text-6xl font-bold leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,30,80,0.3)]"
              >
                Healthcare that shows up
                <span className="block font-medium text-white/95 drop-shadow-[0_2px_8px_rgba(0,30,80,0.25)]">
                  when you need it most.
                </span>
              </motion.h1>

              {/* Humanized Subtitle: Clear, Reassuring, No AI Jargon */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.16 }}
                className="mt-3.5 max-w-xl font-poppins text-xs sm:text-sm md:text-base font-medium leading-relaxed text-white drop-shadow-[0_1px_4px_rgba(0,30,80,0.25)]"
              >
                See a doctor in minutes, get lab tests at home, order medicines, or call an emergency ride. Fast, reliable care for your whole family.
              </motion.p>

              {/* Real CTA Buttons: Using bg-primary ONLY (no accent) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.24 }}
                className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
              >
                <Link
                  href="/services"
                  className="inline-flex items-center justify-center rounded-full border border-white/50 bg-white/25 px-6 sm:px-7 py-2.5 sm:py-3 font-poppins text-xs sm:text-sm font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm transition-all hover:bg-white/35 hover:scale-105 active:scale-95"
                >
                  Explore Services
                </Link>

                <Link
                  href="/book-appointment"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary text-primary-content border border-white/30 px-6 sm:px-7 py-2.5 sm:py-3 font-poppins text-xs sm:text-sm font-bold uppercase tracking-wider shadow-xl transition-all hover:bg-primary/90 hover:scale-105 hover:shadow-2xl active:scale-95"
                >
                  <span>Book Appointment</span>
                  <span className="grid size-5 sm:size-6 place-items-center rounded-full bg-primary-content text-primary transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="size-3 sm:size-3.5" aria-hidden="true" />
                  </span>
                </Link>
              </motion.div>
            </div>

            {/* ── 3D Card Slider Animation (Loops continuously; stops ONLY on card hover) ──── */}
            <div
              role="region"
              aria-roledescription="carousel"
              aria-label="Likeson 3D Services Slider"
              className="relative z-20 w-full overflow-hidden px-2 pt-6 pb-2"
            >
              {/* 3D Perspective Stage */}
              <div
                className="relative mx-auto flex w-full items-center justify-center py-2"
                style={{
                  perspective: isMobile ? "900px" : "1400px",
                  perspectiveOrigin: "50% 50%",
                }}
              >
                {/* Card Container Frame */}
                <div
                  className="relative flex items-center justify-center"
                  style={{
                    width: isMobile ? "200px" : isTablet ? "235px" : "265px",
                    height: isMobile ? "275px" : isTablet ? "320px" : "360px",
                    transformStyle: "preserve-3d",
                  }}
                >
                  {CARDS.map((card, idx) => {
                    const offset = getOffset(idx);
                    const abs = Math.abs(offset);
                    const isHidden = isMobile ? abs > 2 : abs > 3;

                    // 3D positioning calculations for natural curved arc
                    const xPercent = offset * (isMobile ? 74 : isTablet ? 82 : 88);
                    const zTranslate = -abs * (isMobile ? 85 : isTablet ? 115 : 140);
                    const rotateYDeg = offset * (isMobile ? -14 : -18);
                    const scaleVal = Math.max(0.68, 1 - abs * 0.075);
                    const opacityVal = isHidden ? 0 : [1, 0.94, 0.76, 0.5][abs] ?? 0;

                    return (
                      <motion.div
                        key={card.id}
                        initial={false}
                        animate={{
                          x: `${xPercent}%`,
                          z: zTranslate,
                          rotateY: rotateYDeg,
                          scale: scaleVal,
                          opacity: opacityVal,
                        }}
                        transition={springPhysics}
                        style={{
                          zIndex: 30 - abs,
                          pointerEvents: isHidden ? "none" : "auto",
                        }}
                        className="absolute inset-0 select-none"
                      >
                        {/* Only pause when cursor hovers on this specific card */}
                        <div
                          onClick={() => {
                            if (offset !== 0) {
                              setActive(idx);
                            }
                          }}
                          onMouseEnter={() => setPaused(true)}
                          onMouseLeave={() => setPaused(false)}
                          className={`group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[var(--r-box)] border border-primary-content/30 bg-neutral/90 text-neutral-content shadow-2xl backdrop-blur-lg transition-all duration-300 ${
                            offset === 0
                              ? "ring-2 ring-primary-content/90 hover:scale-[1.03]"
                              : "hover:scale-[1.02] hover:border-primary-content/50"
                          }`}
                        >
                          {/* High Quality Card Image from /public/images/cards */}
                          <div className="relative h-full w-full overflow-hidden">
                            <Image
                              src={card.src}
                              alt={card.alt}
                              fill
                              sizes="(min-width: 1024px) 270px, (min-width: 640px) 240px, 200px"
                              priority={abs <= 1}
                              className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                            />

                            {/* Gradient Vignette overlay for text legibility */}
                            <div className="absolute inset-0 bg-gradient-to-t from-neutral/95 via-neutral/35 to-black/20" />
                          </div>

                          {/* Top Category Badge */}
                          <div className="absolute top-2.5 inset-x-2.5 z-10 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-content/30 bg-neutral/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-content backdrop-blur-md">
                              {offset === 0 && (
                                <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                              )}
                              {card.label}
                            </span>
                          </div>

                          {/* Bottom Info Card Surface */}
                          <div className="absolute inset-x-0 bottom-0 z-10 border-t border-primary-content/15 bg-neutral/90 p-3 backdrop-blur-md">
                            <h3 className="font-montserrat text-xs sm:text-sm font-bold text-neutral-content line-clamp-1 transition-colors">
                              {card.title}
                            </h3>
                            <p className="mt-0.5 font-poppins text-[10px] sm:text-[11px] font-medium text-neutral-content/80 line-clamp-1">
                              {card.tag}
                            </p>

                            {/* Action Button Link: Using bg-primary ONLY (no accent) */}
                            <div className="mt-2 flex items-center justify-between">
                              <Link
                                href={card.href}
                                onClick={(e) => e.stopPropagation()}
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-poppins text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all ${
                                  offset === 0
                                    ? "bg-primary text-primary-content shadow-md hover:bg-primary/85 border border-primary-content/20"
                                    : "bg-primary-content/20 text-primary-content hover:bg-primary-content/30"
                                }`}
                              >
                                <span>{card.ctaText}</span>
                                <ArrowUpRight className="size-3" />
                              </Link>

                              <span className="text-[10px] font-bold text-neutral-content/60">
                                {idx + 1}/{N}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Tactile Navigation Arrows */}
                <button
                  type="button"
                  onClick={prevSlide}
                  aria-label="Previous service card"
                  className="absolute left-1 sm:left-3 z-30 grid size-8 sm:size-9 place-items-center rounded-full border border-primary-content/30 bg-primary-content/20 text-primary-content backdrop-blur-md shadow-lg transition-all hover:bg-primary-content/35 hover:scale-105 active:scale-95"
                >
                  <ChevronLeft className="size-4 sm:size-5" />
                </button>

                <button
                  type="button"
                  onClick={nextSlide}
                  aria-label="Next service card"
                  className="absolute right-1 sm:right-3 z-30 grid size-8 sm:size-9 place-items-center rounded-full border border-primary-content/30 bg-primary-content/20 text-primary-content backdrop-blur-md shadow-lg transition-all hover:bg-primary-content/35 hover:scale-105 active:scale-95"
                >
                  <ChevronRight className="size-4 sm:size-5" />
                </button>
              </div>

              {/* Dot Indicators */}
              <div className="mt-2 flex items-center justify-center gap-1.5">
                {CARDS.map((card, i) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Jump to ${card.title}`}
                    className="grid h-6 w-4 place-items-center"
                  >
                    <span
                      className={`block h-1 rounded-full transition-all duration-300 ${
                        i === active
                          ? "w-5 bg-primary-content opacity-100 shadow-sm"
                          : "w-1.5 bg-primary-content/40 hover:bg-primary-content/70"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* ── Bottom Rating & Social Proof (Over Cloud Fade) ─────────────── */}
            <div className="relative z-20 flex w-full flex-col items-center justify-center px-4 pb-6 pt-1 text-center sm:pb-8">
              <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 rounded-full border border-base-300/80 bg-base-100/90 px-3.5 py-1.5 sm:px-4 sm:py-2 backdrop-blur-md shadow-md text-base-content">
                {/* Overlapping Small Pexels User Avatars */}
                <div className="flex -space-x-1.5 overflow-hidden">
                  {SOCIAL_AVATARS.map((person, idx) => (
                    <div
                      key={idx}
                      className="relative size-6 sm:size-7 overflow-hidden rounded-full ring-1.5 ring-base-100 shadow-sm"
                    >
                      <Image
                        src={person.src}
                        alt={person.alt}
                        fill
                        sizes="28px"
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>

                {/* 5 Small Golden Stars */}
                <div
                  className="flex items-center gap-0.5 text-warning"
                  aria-label="5 star rating"
                >
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="size-3 sm:size-3.5 fill-warning text-warning"
                    />
                  ))}
                </div>

                {/* Compact Rating Text */}
                <div className="font-poppins text-[11px] sm:text-xs font-semibold tracking-wide text-base-content">
                  <span className="font-bold text-primary">Rated 4.9/5</span> by{" "}
                  <span className="font-bold underline decoration-base-content/30">
                    14,800+ patients & families
                  </span>
                </div>
              </div>

              <p className="mt-1.5 font-poppins text-[10px] sm:text-[11px] font-medium text-base-content/75">
                Trusted across Delhi NCR, Mumbai, Bengaluru & 40+ Indian cities • 120,000+ care journeys fulfilled
              </p>
            </div>
          </div>
        </div>

        {/* ── 2. PARTNER ACCREDITATIONS TICKER ─────────────────────────────── */}
        <div className="w-[94%] md:w-[90%] max-w-7xl mx-auto py-6 sm:py-8 border-b border-base-200">
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 md:gap-12">
            {ACCREDITATIONS.map((partner, idx) => {
              const Icon = partner.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-base-content/70 hover:text-base-content transition-colors"
                >
                  <Icon className="size-4 text-primary" />
                  <span className="font-montserrat text-xs font-semibold tracking-wider uppercase">
                    {partner.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </MotionConfig>
  );
}
