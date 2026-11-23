"use client";

/**
 * StoryPage.jsx  ─  app/how-it-works/page.jsx
 *
 * Design: "Premium Editorial × Medical Clarity"
 * ─ Light mode only, global.css CSS variables exclusively
 * ─ Narrative arc: THE PROBLEM → TURNING POINT → EACH SERVICE STEP-BY-STEP → TRANSFORMATION
 * ─ Typography: Montserrat (display) + Poppins (body) — from global.css @theme
 * ─ Aesthetic: Stripe/Linear/Notion-level polish — large chapter numbers,
 *   ink dividers, surgical color accents, scroll-triggered reveals
 * ─ Services embedded IN the story — direct booking CTA per service
 * ─ Route: /how-it-works
 */

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  memo,
} from "react";
import Link from "next/link";
import {
  Ambulance,
  Stethoscope,
  Zap,
  Activity,
  HeartHandshake,
  Microscope,
  Pill,
  ArrowRight,
  Quote,
  ShieldCheck,
  Star,
  ChevronDown,
  Heart,
  Sparkles,
  TrendingUp,
  Users,
  Phone,
  MapPin,
  Clock,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE CONSTANTS — single source of truth, import in Services.jsx too
// ─────────────────────────────────────────────────────────────────────────────
const SERVICE_ROUTES = {
  fullCareRide:       "/services/full-care-ride",
  doctorConsultation: "/services/doctor-consultation",
  doctorOnline:       "/services/doctor-online",
  physiotherapist:    "/services/physiotherapist",
  careAssistant:      "/services/care-assistant",
  diagnostics:        "/services/diagnostics",
  pharmacy:           "/services/pharmacy",
  book:               "/book",
  contact:            "/contact",
};

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE DATA — zero-to-success narrative per service
// accent uses raw oklch values matching global.css variables exactly
// ─────────────────────────────────────────────────────────────────────────────
const SERVICES = [
  {
    id:      "full-care-ride",
    number:  "01",
    route:   SERVICE_ROUTES.fullCareRide,
    Icon:    Ambulance,
    accent:  "oklch(75% 0.15 70)",    // --warning
    label:   "Full Care Ride",
    problem: "You live in Singapore. Your father has a cardiology appointment in Vijayawada tomorrow. You cannot be there. He cannot drive. Nobody knows who to call.",
    turning: "One booking covers the vehicle, a trained care assistant, GPS tracking, medicines, and a confirmation message that he reached home safely.",
    stat:    { n: "13", label: "steps, zero gaps in care" },
    persona: {
      name:  "Priya R.",
      city:  "NRI — Dubai",
      stars: 5,
      quote: "I watched every single step on the app. For the first time in years, I didn't panic on his appointment day.",
    },
    steps: [
      "Choose specialization, hospital, doctor, date & consultation time",
      "Care assistant confirmed based on real doctor availability",
      "Select vehicle — 2-wheeler or 4-wheeler, cost shown upfront before payment",
      "Add balance to wallet → complete via payment gateway",
      "Vehicle arrives → GPS pick-up → care assistant joins at door",
      "Hospital reached → registration handled → diagnosis begins",
      "Doctor consultation completed → care assistant manages billing",
      "Medicines collected from pharmacy en route",
      "Safe return home confirmed → family notified",
      "Next consultation details and reminders sent automatically",
    ],
  },
  {
    id:      "doctor-consultation",
    number:  "02",
    route:   SERVICE_ROUTES.doctorConsultation,
    Icon:    Stethoscope,
    accent:  "oklch(62% 0.16 230)",   // --info
    label:   "Doctor Consultation",
    problem: "The hospital says 'come at 9am'. You arrive at 9. You wait until noon. The doctor sees you for eight minutes. You leave exhausted and no wiser.",
    turning: "Book the slot you actually want. We verify real doctor availability before confirming — no phantom slots, no double-booking.",
    stat:    { n: "₹300", label: "starting, e-prescription included" },
    persona: {
      name:  "Lakshmi D.",
      city:  "Vijayawada",
      stars: 5,
      quote: "I was in and out by 11am. No queue stress, no confusion. Just the specialist I needed.",
    },
    steps: [
      "Choose specialization, hospital, doctor & consultation time slot",
      "Booking confirmed — real availability verified, not estimated",
      "Pay consultation fee via payment gateway",
      "Attend in-person at hospital or home visit option selected",
      "E-prescription issued, digitally linked to Likeson pharmacy module",
      "Follow-up reminder and next appointment set automatically",
    ],
  },
  {
    id:      "doctor-online",
    number:  "03",
    route:   SERVICE_ROUTES.doctorOnline,
    Icon:    Zap,
    accent:  "oklch(55% 0.18 240)",   // --primary
    label:   "Online Doctor Consultation",
    problem: "It's 11pm. Your mother has a fever. The nearest clinic opens at 9am. Nine hours of worry, no answers, and a long night ahead.",
    turning: "A qualified doctor available now — video or audio call, prescription sent digitally to your phone, no travel needed at any hour.",
    stat:    { n: "24/7", label: "doctor access, any device, any time" },
    persona: {
      name:  "Ramaiah K.",
      city:  "Vijayawada",
      stars: 5,
      quote: "Doctor reviewed my reports at 11pm, asked exactly the right questions, and sent the prescription in 20 minutes.",
    },
    steps: [
      "Choose specialization & available doctor from live list",
      "Upload patient history — any document format accepted",
      "Pay consultation fee → booking confirmed instantly",
      "Receive video or audio link via Likeson chatbot on your phone",
      "Doctor reviews history, consults, and shares notes",
      "Digital prescription delivered to your Likeson dashboard",
    ],
  },
  {
    id:      "physiotherapist",
    number:  "04",
    route:   SERVICE_ROUTES.physiotherapist,
    Icon:    Activity,
    accent:  "oklch(62% 0.20 25)",    // --error
    label:   "Physiotherapist",
    problem: "Post-surgery recovery is already painful. Driving or riding to the clinic and back makes every session feel like a setback before it even begins.",
    turning: "A certified physiotherapist comes to the clinic or your home — you decide what your body needs that day.",
    stat:    { n: "Home", label: "or clinic — you choose every time" },
    persona: {
      name:  "Venkat S.",
      city:  "Amaravathi",
      stars: 5,
      quote: "Three home sessions after my knee replacement. I healed without a single stressful commute.",
    },
    steps: [
      "Select clinic visit or home visit based on your recovery stage",
      "Choose certified physiotherapist, date & time",
      "Consultation fee confirmed → payment gateway → booking locked",
      "For clinic visits: add patient transport in the same booking flow",
      "Session completed with written post-session notes shared",
      "Next session scheduled with progress tracking and reminders",
    ],
  },
  {
    id:      "care-assistant",
    number:  "05",
    route:   SERVICE_ROUTES.careAssistant,
    Icon:    HeartHandshake,
    accent:  "oklch(65% 0.16 150)",   // --success
    label:   "Care Assistant",
    problem: "You are 70, at a hospital alone. You do not know which counter to go to. Nobody explains the bill. The doctor used words you did not understand.",
    turning: "A trained, background-verified professional at your side — queue management, billing, registration, medicine pickup, and a safe return home.",
    stat:    { n: "₹500", label: "per visit · 4★ minimum rated professionals" },
    persona: {
      name:  "Suresh M.",
      city:  "Vijayawada",
      stars: 5,
      quote: "My assistant knew every department, handled all the paperwork, and sat beside me until the doctor called my name.",
    },
    steps: [
      "Choose hospital, date & appointment time",
      "Review assigned care assistant profile and service roles",
      "Pay service fee → booking confirmed, assistant notified",
      "Assistant meets you at hospital entrance, on time",
      "Manages queues, billing, registration, and medicine pickup",
      "Escorts you home safely → session rated and reviewed",
    ],
  },
  {
    id:      "diagnostics",
    number:  "06",
    route:   SERVICE_ROUTES.diagnostics,
    Icon:    Microscope,
    accent:  "oklch(65% 0.14 180)",   // --secondary
    label:   "Diagnostic Services",
    problem: "Your doctor says 'get blood work done'. The lab opens at 7am. You need to fast. You need transport. You need to wait for hours among sick people.",
    turning: "A certified technician comes to your home. Samples collected at your door. NABL-certified results on your phone in 6–48 hours.",
    stat:    { n: "6–48hr", label: "report turnaround · NABL certified labs" },
    persona: {
      name:  "Meena P.",
      city:  "Amaravathi",
      stars: 5,
      quote: "Technician was at my door at 7am. Reports arrived before lunch. My doctor had already reviewed them when I called.",
    },
    steps: [
      "Choose center visit or home sample collection",
      "Select date, time & upload doctor's prescription",
      "Invoice generated with transparent pricing → payment confirmed",
      "Certified technician arrives, collects sample with precision",
      "NABL lab processes — digital report ready in 6–48 hours",
      "Report on dashboard — optional doctor review add-on available",
    ],
  },
  {
    id:      "pharmacy",
    number:  "07",
    route:   SERVICE_ROUTES.pharmacy,
    Icon:    Pill,
    accent:  "oklch(70% 0.15 50)",    // --accent
    label:   "Pharmacy Delivery",
    problem: "It is 40°C outside. You need insulin. The pharmacy is 3km away. Your prescription is on paper. You are diabetic and you are alone.",
    turning: "Upload the prescription. We verify, cold-pack, and deliver to your door in 2 hours. Auto-refill means you never miss a dose again.",
    stat:    { n: "2hr", label: "express delivery · cold-chain guaranteed" },
    persona: {
      name:  "Rani T.",
      city:  "Vijayawada",
      stars: 5,
      quote: "My diabetes medicines arrive every month automatically. I have not stepped outside in the heat for medicine in over a year.",
    },
    steps: [
      "Upload prescription — photo or digital, any format accepted",
      "Pharmacist verifies authenticity before dispensing",
      "Invoice generated with full itemised breakdown",
      "Pay via UPI, card, or wallet → dispatch begins immediately",
      "Cold-chain maintained for temperature-sensitive medications",
      "Real-time delivery tracking → optional auto-refill for chronic prescriptions",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// INTERSECTION OBSERVER HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView];
}

// ─────────────────────────────────────────────────────────────────────────────
// REVEAL WRAPPER — pure CSS transitions, zero library weight
// ─────────────────────────────────────────────────────────────────────────────
const Reveal = memo(({ children, delay = 0, className = "" }) => {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity:    inView ? 1 : 0,
        transform:  inView ? "translateY(0)" : "translateY(22px)",
        transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
});
Reveal.displayName = "Reveal";

// ─────────────────────────────────────────────────────────────────────────────
// STAR RATING
// ─────────────────────────────────────────────────────────────────────────────
const Stars = memo(({ count }) => (
  <span className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        size={11}
        className={i < count ? "fill-warning text-warning" : "text-base-300"}
        aria-hidden="true"
      />
    ))}
  </span>
));
Stars.displayName = "Stars";

// ─────────────────────────────────────────────────────────────────────────────
// STEP ITEM
// ─────────────────────────────────────────────────────────────────────────────
const StepItem = memo(({ text, index, accent, inView }) => (
  <li
    className="flex items-start gap-3"
    style={{
      opacity:    inView ? 1 : 0,
      transform:  inView ? "translateX(0)" : "translateX(-14px)",
      transition: `opacity 0.5s ease ${0.08 + index * 0.065}s, transform 0.5s ease ${0.08 + index * 0.065}s`,
    }}
  >
    <div
      className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[10px] font-black mt-0.5 font-montserrat"
      style={{
        background: `color-mix(in oklch, ${accent} 14%, transparent)`,
        color: accent,
      }}
      aria-hidden="true"
    >
      {index + 1}
    </div>
    <p className="text-sm text-base-content/65 font-poppins leading-relaxed pt-0.5">
      {text}
    </p>
  </li>
));
StepItem.displayName = "StepItem";

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────
const ProgressBar = memo(({ accent, inView }) => (
  <div className="mt-6 pt-5 border-t border-base-300">
    <div className="flex items-center justify-between mb-2">
      <span className="text-[10px] text-base-content/35 font-poppins">Start</span>
      <span
        className="text-[10px] font-bold font-poppins"
        style={{ color: accent }}
      >
        Care Delivered ✓
      </span>
    </div>
    <div
      className="h-1.5 rounded-full overflow-hidden"
      style={{ background: `color-mix(in oklch, ${accent} 10%, var(--base-300))` }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width:           inView ? "100%" : "0%",
          background:      `linear-gradient(to right, color-mix(in oklch, ${accent} 40%, transparent), ${accent})`,
          transition:      "width 1.1s cubic-bezier(0.4,0,0.2,1) 0.6s",
        }}
        aria-hidden="true"
      />
    </div>
  </div>
));
ProgressBar.displayName = "ProgressBar";

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE STORY CARD — the heart of each chapter
// ─────────────────────────────────────────────────────────────────────────────
const ServiceStoryCard = memo(({ service, flip }) => {
  const [cardRef, inView] = useInView(0.06);
  const { Icon, accent } = service;

  return (
    <article
      ref={cardRef}
      id={service.id}
      aria-labelledby={`svc-h-${service.id}`}
      className="relative scroll-mt-24"
    >
      {/* ── Watermark number ── */}
      <div
        className="absolute pointer-events-none select-none font-montserrat font-black leading-none -z-10"
        style={{
          fontSize:               "clamp(7rem, 16vw, 13rem)",
          color:                  `color-mix(in oklch, ${accent} 6%, transparent)`,
          [flip ? "right" : "left"]: "-0.15em",
          top:                    "-0.3em",
        }}
        aria-hidden="true"
      >
        {service.number}
      </div>

      <div
        className={`grid lg:grid-cols-2 gap-10 lg:gap-20 items-start ${
          flip ? "lg:[direction:rtl]" : ""
        }`}
      >

        {/* ══ LEFT: NARRATIVE ══ */}
        <div className={flip ? "lg:[direction:ltr]" : ""}>

          {/* Service label header */}
          <Reveal delay={0}>
            <div className="flex items-center gap-3 mb-7">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"
                style={{
                  background: `color-mix(in oklch, ${accent} 12%, var(--base-200))`,
                  color: accent,
                }}
                aria-hidden="true"
              >
                <Icon size={22} strokeWidth={1.7} />
              </div>
              <div>
                <p
                  className="text-[10px] font-bold tracking-[0.22em] uppercase font-poppins"
                  style={{ color: `color-mix(in oklch, ${accent} 70%, transparent)` }}
                >
                  Service {service.number}
                </p>
                <p className="text-sm font-black text-base-content font-montserrat">
                  {service.label}
                </p>
              </div>
              <div
                className="h-px flex-1 ml-2"
                style={{ background: `color-mix(in oklch, ${accent} 18%, var(--base-300))` }}
                aria-hidden="true"
              />
            </div>
          </Reveal>

          {/* THE PROBLEM */}
          <Reveal delay={0.05}>
            <div
              className="rounded-2xl p-5 mb-5 border-l-[3px]"
              style={{
                borderLeftColor: `color-mix(in oklch, ${accent} 45%, transparent)`,
                background:      "var(--base-200)",
              }}
            >
              <p
                className="text-[9px] font-black uppercase tracking-[0.25em] mb-2 font-poppins"
                style={{ color: `color-mix(in oklch, ${accent} 55%, transparent)` }}
              >
                The Problem
              </p>
              <p className="text-base-content/75 text-sm leading-relaxed font-poppins italic">
                {service.problem}
              </p>
            </div>
          </Reveal>

          {/* TURNING POINT */}
          <Reveal delay={0.1}>
            <h2
              id={`svc-h-${service.id}`}
              className="text-2xl md:text-[1.75rem] font-black text-base-content leading-[1.18] mb-5 font-montserrat"
            >
              {service.turning}
            </h2>
          </Reveal>

          {/* STAT CALLOUT */}
          <Reveal delay={0.14}>
            <div
              className="inline-flex items-baseline gap-2.5 px-5 py-3 rounded-2xl border mb-6"
              style={{
                borderColor: `color-mix(in oklch, ${accent} 18%, transparent)`,
                background:  `color-mix(in oklch, ${accent} 5%, var(--base-100))`,
              }}
            >
              <span
                className="text-[2rem] font-black leading-none font-montserrat"
                style={{ color: accent }}
              >
                {service.stat.n}
              </span>
              <span className="text-base-content/45 text-xs font-poppins">
                {service.stat.label}
              </span>
            </div>
          </Reveal>

          {/* PERSONA TESTIMONIAL */}
          <Reveal delay={0.18}>
            <div
              className="rounded-2xl p-5 border"
              style={{ borderColor: `color-mix(in oklch, ${accent} 14%, var(--base-300))` }}
            >
              <Quote
                size={14}
                className="mb-2.5"
                style={{ color: `color-mix(in oklch, ${accent} 60%, transparent)` }}
                aria-hidden="true"
              />
              <p className="text-base-content/70 text-sm leading-relaxed font-poppins italic mb-4">
                "{service.persona.quote}"
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black font-montserrat"
                    style={{
                      background: `color-mix(in oklch, ${accent} 12%, var(--base-200))`,
                      color: accent,
                    }}
                    aria-hidden="true"
                  >
                    {service.persona.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-black text-base-content font-montserrat leading-none">
                      {service.persona.name}
                    </p>
                    <p className="text-[10px] text-base-content/40 font-poppins mt-0.5">
                      {service.persona.city}
                    </p>
                  </div>
                </div>
                <Stars count={service.persona.stars} />
              </div>
            </div>
          </Reveal>

          {/* BOOK CTA */}
          <Reveal delay={0.22}>
            <div className="mt-7">
              <Link
                href={service.route}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold font-poppins transition-all duration-300 hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                style={{
                  background:        `color-mix(in oklch, ${accent} 10%, var(--base-200))`,
                  color:             accent,
                  border:            `1.5px solid color-mix(in oklch, ${accent} 22%, transparent)`,
                  "--tw-ring-color":  accent,
                }}
                aria-label={`Book ${service.label} on Likeson.in`}
              >
                Book {service.label}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>

        {/* ══ RIGHT: JOURNEY STEPS ══ */}
        <div className={flip ? "lg:[direction:ltr]" : ""}>
          <div
            className="rounded-3xl border p-7 lg:sticky lg:top-24"
            style={{
              borderColor: `color-mix(in oklch, ${accent} 11%, var(--base-300))`,
              background:  "var(--base-100)",
           
              borderColor: `color-mix(in oklch, ${accent} 11%, var(--base-300))`,
              background:  "var(--base-100)",
              opacity:     inView ? 1 : 0,
              transform:   inView ? "translateY(0)" : "translateY(20px)",
              transition:  "opacity 0.65s ease 0.15s, transform 0.65s ease 0.15s",
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <p
                className="text-[9px] font-black tracking-[0.28em] uppercase font-poppins"
                style={{ color: `color-mix(in oklch, ${accent} 60%, transparent)` }}
              >
                Your Journey
              </p>
              <span
                className="text-[10px] font-bold px-2.5 py-1 rounded-full font-poppins"
                style={{
                  background: `color-mix(in oklch, ${accent} 10%, var(--base-200))`,
                  color: accent,
                }}
              >
                {service.steps.length} steps
              </span>
            </div>

            <ol
              className="space-y-4"
              aria-label={`Step-by-step journey for ${service.label}`}
            >
              {service.steps.map((text, i) => (
                <StepItem
                  key={i}
                  text={text}
                  index={i}
                  accent={accent}
                  inView={inView}
                />
              ))}
            </ol>

            <ProgressBar accent={accent} inView={inView} />
          </div>
        </div>

      </div>
    </article>
  );
});
ServiceStoryCard.displayName = "ServiceStoryCard";

// ─────────────────────────────────────────────────────────────────────────────
// SECTION DIVIDER
// ─────────────────────────────────────────────────────────────────────────────
const SectionDivider = memo(({ accent }) => (
  <div className="flex items-center gap-5 py-20" aria-hidden="true">
    <div className="h-px flex-1 bg-base-300" />
    <div
      className="w-1.5 h-1.5 rounded-full"
      style={{ background: `color-mix(in oklch, ${accent} 35%, transparent)` }}
    />
    <div className="h-px flex-1 bg-base-300" />
  </div>
));
SectionDivider.displayName = "SectionDivider";

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────
const Hero = memo(() => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const scrollDown = useCallback(() => {
    document.getElementById(SERVICES[0].id)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const visible = {
    opacity:    mounted ? 1 : 0,
    transform:  mounted ? "translateY(0)" : "translateY(16px)",
  };

  return (
    <section
      className="relative overflow-hidden bg-base-100 pt-20 pb-24"
      aria-label="How Likeson.in works — introduction"
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(var(--base-300) 1px, transparent 1px),
            linear-gradient(90deg, var(--base-300) 1px, transparent 1px)
          `,
          backgroundSize: "52px 52px",
        }}
        aria-hidden="true"
      />
      {/* Fade grid at edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% -10%, var(--base-100) 0%, transparent 100%)",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 container-custom max-w-5xl">
        {/* Eyebrow */}
        <div
          className="flex items-center gap-3 mb-8"
          style={{ ...visible, transition: "opacity 0.7s ease 0.1s, transform 0.7s ease 0.1s" }}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10"
            aria-hidden="true"
          >
            <Heart size={15} className="text-primary" />
          </div>
          <span className="text-[11px] font-bold tracking-[0.24em] uppercase text-primary font-poppins">
            Likeson.in — How It Works
          </span>
          <div className="h-px flex-1 bg-base-300" aria-hidden="true" />
        </div>

        {/* H1 */}
        <h1
          className="font-montserrat font-black text-base-content leading-[1.06] mb-6"
          style={{
            fontSize:   "clamp(2.5rem, 6.5vw, 5rem)",
            ...visible,
            transition: "opacity 0.75s ease 0.2s, transform 0.75s ease 0.2s",
          }}
        >
          From Zero to Cared For.
          <br />
          <span className="text-gradient-primary">
            Seven Services. One Platform.
          </span>
        </h1>

        {/* Subheading */}
        <p
          className="font-poppins text-base-content/55 max-w-2xl leading-relaxed mb-10"
          style={{
            fontSize:   "clamp(1rem, 1.8vw, 1.18rem)",
            opacity:    mounted ? 1 : 0,
            transition: "opacity 0.75s ease 0.35s",
          }}
        >
          Every service on Likeson.in was designed around a real problem. Families
          separated by distance. Patients left alone at hospital counters. Prescriptions
          that ran out. This is the step-by-step story of how we fix each one.
        </p>

        {/* Chapter quick-nav */}
        <nav
          className="flex flex-wrap gap-2 mb-12"
          aria-label="Jump to a service story"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.75s ease 0.45s" }}
        >
          {SERVICES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 hover:scale-105 font-poppins focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
              style={{
                borderColor: `color-mix(in oklch, ${s.accent} 20%, var(--base-300))`,
                color:       s.accent,
                background:  `color-mix(in oklch, ${s.accent} 6%, var(--base-100))`,
              }}
            >
              <span
                className="font-mono text-[8px] font-black opacity-60"
                aria-hidden="true"
              >
                {s.number}
              </span>
              {s.label}
            </a>
          ))}
        </nav>

        {/* Trust row */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-2xl border border-base-300 bg-base-200 p-5"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.75s ease 0.55s" }}
        >
          {[
            { I: ShieldCheck, n: "NABL",  label: "Certified Labs"     },
            { I: Users,       n: "4★+",   label: "Rated Assistants"   },
            { I: TrendingUp,  n: "13",    label: "Step Care Ride"      },
            { I: Sparkles,    n: "2hr",   label: "Pharmacy Delivery"   },
          ].map(({ I, n, label }) => (
            <div key={label} className="flex items-center gap-3">
              <I size={17} className="text-primary shrink-0" aria-hidden="true" />
              <div>
                <p className="text-base font-black text-base-content font-montserrat leading-tight">
                  {n}
                </p>
                <p className="text-[10px] text-base-content/45 font-poppins mt-0.5">
                  {label}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Scroll cue */}
        <button
          onClick={scrollDown}
          className="mt-10 flex items-center gap-2 text-base-content/35 hover:text-primary transition-colors duration-200 font-poppins rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Scroll to read each service story"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.75s ease 0.65s" }}
        >
          <span className="text-[11px] tracking-widest uppercase">Read the stories</span>
          <ChevronDown size={15} className="animate-bounce" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
});
Hero.displayName = "Hero";

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFORMATION SECTION
// ─────────────────────────────────────────────────────────────────────────────
const Transformation = memo(() => {
  const [ref, inView] = useInView(0.08);

  return (
    <section
      ref={ref}
      className="py-28 bg-base-200"
      aria-labelledby="transform-h"
    >
      <div className="container-custom max-w-4xl text-center">
        <div
          style={{
            opacity:    inView ? 1 : 0,
            transform:  inView ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/8 border border-primary/15 mb-6">
            <Sparkles size={13} className="text-primary" aria-hidden="true" />
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-primary font-poppins">
              The Transformation
            </span>
          </div>

          <h2
            id="transform-h"
            className="font-montserrat font-black text-base-content leading-[1.1] mb-5"
            style={{ fontSize: "clamp(1.8rem, 4.5vw, 3rem)" }}
          >
            Before Likeson: Alone, Confused, Delayed.
            <br />
            <span className="text-gradient-primary">
              After Likeson: Assisted, Clear, On Time.
            </span>
          </h2>

          <p className="text-base-content/55 font-poppins max-w-2xl mx-auto leading-relaxed mb-12 text-base">
            Every service above exists because real families told us the same story —
            distance, confusion, and a healthcare system that assumed someone was always there.
            We built Likeson so that someone always is.
          </p>

          {/* Three pillars */}
          <div className="grid sm:grid-cols-3 gap-5 mb-12 text-left">
            {[
              {
                I:     MapPin,
                title: "Vijayawada & Amaravathi",
                body:  "Launching first in cities where demand is highest and trusted hospital infrastructure is in place.",
              },
              {
                I:     Clock,
                title: "Everything Available Now",
                body:  "Transportation, care assistants, consultations, pharmacy, and diagnostics — live and bookable today.",
              },
              {
                I:     Phone,
                title: "One Booking, Complete Care",
                body:  "A single platform replaces five different services. One login, one call, full peace of mind.",
              },
            ].map(({ I, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-base-300 bg-base-100 p-5"
              >
                <div
                  className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3"
                  aria-hidden="true"
                >
                  <I size={16} className="text-primary" />
                </div>
                <h3 className="text-sm font-black text-base-content mb-1.5 font-montserrat">
                  {title}
                </h3>
                <p className="text-xs text-base-content/55 font-poppins leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>

          {/* Final CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={SERVICE_ROUTES.book}
              className="btn-primary-cta inline-flex items-center gap-2 justify-center"
              aria-label="Book your first Likeson.in service"
            >
              <Heart size={15} aria-hidden="true" />
              Book Your First Service
            </Link>
            <Link
              href={SERVICE_ROUTES.contact}
              className="btn-secondary inline-flex items-center gap-2 justify-center"
              aria-label="Talk to the Likeson.in team"
            >
              <Phone size={15} aria-hidden="true" />
              Talk to Our Team
            </Link>
          </div>

          <p className="mt-7 text-[10px] text-base-content/30 font-poppins">
            No subscription required to start · Transparent pricing on every service · Vijayawada & Amaravathi
          </p>
        </div>
      </div>
    </section>
  );
});
Transformation.displayName = "Transformation";

// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD
// ─────────────────────────────────────────────────────────────────────────────
const StructuredData = () => (
  <script
    type="application/ld+json"
    dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type":    "MedicalOrganization",
        name:        "Likeson.in",
        url:         "https://www.likeson.in",
        description: "Non-emergency healthcare platform covering medical transport, care assistants, doctor consultations, diagnostics, and pharmacy delivery in Vijayawada and Amaravathi.",
        areaServed:  ["Vijayawada", "Amaravathi"],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name:    "Likeson.in Services",
          itemListElement: SERVICES.map((s, i) => ({
            "@type":    "Offer",
            position:   i + 1,
            name:       s.label,
            url:        `https://www.likeson.in${s.route}`,
          })),
        },
      }),
    }}
  />
);

 
// ─────────────────────────────────────────────────────────────────────────────
// PAGE ROOT
// ─────────────────────────────────────────────────────────────────────────────
const StoryPage = () => (
  <>
    <StructuredData />

    <a
      href={`#${SERVICES[0].id}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-content focus:rounded-lg focus:text-sm focus:font-bold"
    >
      Skip to service stories
    </a>

    <main className="bg-base-100 min-h-screen">
      <Hero />

      <div className="container-custom max-w-6xl py-10">
        {SERVICES.map((service, i) => (
          <React.Fragment key={service.id}>
            <ServiceStoryCard service={service} flip={i % 2 !== 0} />
            {i < SERVICES.length - 1 && (
              <SectionDivider accent={SERVICES[i + 1].accent} />
            )}
          </React.Fragment>
        ))}
      </div>

      <Transformation />
    </main>
  </>
);

export default StoryPage;