"use client";

import React, { useEffect, useMemo, memo, useState, useRef, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ExternalLink,
  Star,
  ChevronDown,
  Zap,
  TrendingUp,
  Clock,
} from "lucide-react";

import Container from "./Container";
import {
  fetchActiveHero,
  selectActiveHero,
  selectLoadingActiveHero,
} from "@/store/slices/heroPageSlice";

// 👇 Adjust this import path to point to your new SpecialButton file
import SpecialButton from "@/components/SpecialButton"; 

// ─── Animation Variants ────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1];

const variants = {
  fadeUp: {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  },
  fadeLeft: {
    hidden: { opacity: 0, x: 36 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
  },
  stagger: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  },
  float: {
    animate: {
      y: [0, -12, 0],
      transition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
    },
  },
};

const floatDelay = (delay) => ({
  animate: {
    y: [0, -8, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut", delay },
  },
});

// ─── Sub-Components ────────────────────────────────────────────────────────────

const Background = memo(() => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
    {/* Grid Layer */}
    <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_oklch,var(--primary)_8%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--primary)_8%,transparent)_1px,transparent_1px)] bg-[length:48px_48px] [mask-image:radial-gradient(ellipse_70%_65%_at_50%_50%,black_0%,transparent_100%)]" />
    {/* Dot Accent Layer */}
    <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg_xmlns=%22http://www.w3.org/2000/svg%22_width=%2248%22_height=%2248%22%3E%3Ccircle_cx=%220%22_cy=%220%22_r=%221.4%22_fill=%22%230066ff%22_fill-opacity=%220.15%22/%3E%3C/svg%3E')] bg-[length:48px_48px] [mask-image:radial-gradient(ellipse_60%_55%_at_50%_50%,black_0%,transparent_100%)]" />
  </div>
));
Background.displayName = "Background";

const Skeleton = memo(() => (
  <section className="relative w-full min-h-screen flex items-center bg-base-100 overflow-hidden" aria-busy="true" aria-label="Loading hero content">
    <Background />
    <Container>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="skeleton h-7 w-48 rounded-full" />
          <div className="space-y-4">
            <div className="skeleton h-14 w-full rounded-2xl" />
            <div className="skeleton h-14 w-4/5 rounded-2xl" />
            <div className="skeleton h-14 w-3/5 rounded-2xl" />
          </div>
          <div className="space-y-2 mt-4">
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-5/6 rounded" />
          </div>
          <div className="flex gap-4 mt-6">
            <div className="skeleton h-14 w-40 rounded-xl" />
            <div className="skeleton h-14 w-36 rounded-xl" />
          </div>
        </div>
        <div className="lg:col-span-6 hidden md:flex justify-end">
          <div className="skeleton w-[300px] h-[600px] rounded-[48px]" />
        </div>
      </div>
    </Container>
  </section>
));
Skeleton.displayName = "Skeleton";

const Fallback = memo(() => (
  <section className="relative w-full min-h-screen flex items-center justify-center bg-base-100 overflow-hidden" aria-label="Content unavailable">
    <Background />
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      className="relative z-10 text-center px-6 max-w-xl"
    >
      <h1 className="font-montserrat font-black tracking-tight mb-4 text-5xl md:text-6xl lg:text-7xl text-base-content leading-none">
        Something <span className="text-gradient-primary">Great</span> Awaits
      </h1>
      <p className="font-poppins text-lg leading-relaxed text-base-content/60">
        Check back soon for the latest updates and announcements.
      </p>
    </motion.div>
  </section>
));
Fallback.displayName = "Fallback";

// ─── Trust Row ──────────────────────────────────────────────────────────────
const TrustRow = memo(({ priority, centred }) => (
  <motion.div
    variants={variants.fadeUp}
    className={`pt-8 border-t border-base-300/60 flex flex-col sm:flex-row items-center gap-5 ${centred ? "justify-center" : "justify-center lg:justify-start"}`}
  >
    <div className="flex -space-x-3" aria-label="Over 1000 trusted users">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="w-10 h-10 rounded-full overflow-hidden border-2 border-base-100 shadow-sm relative bg-base-300">
          <Image 
            src={`https://i.pravatar.cc/80?u=trust${i}`} 
            alt={`Trusted User ${i}`} 
            width={40} 
            height={40} 
            className="object-cover w-full h-full" 
          />
        </div>
      ))}
      <div className="w-10 h-10 rounded-full border-2 border-base-100 bg-base-content text-base-100 flex items-center justify-center text-[10px] font-black font-montserrat shadow-sm">
        +1k
      </div>
    </div>
    <div className="text-sm text-center sm:text-left font-poppins">
      <div className="flex items-center justify-center sm:justify-start gap-1 mb-0.5 text-warning" aria-label="Rated 4.9 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={13} fill="currentColor" aria-hidden="true" />)}
        <span className="font-bold ml-1.5 text-xs text-base-content">4.9/5</span>
      </div>
      <p className="text-[11px] font-semibold text-base-content/70 uppercase tracking-wider">Trusted by Families & NRIs</p>
    </div>
    {priority > 0 && (
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border badge-success font-poppins uppercase tracking-wider shadow-sm ml-auto lg:ml-0" aria-label={`High Priority Campaign #${priority}`}>
        <TrendingUp size={12} aria-hidden="true" />
        Priority
      </div>
    )}
  </motion.div>
));
TrustRow.displayName = "TrustRow";

// ─── SVG Assets for Phone ───────────────────────────────────────────────────

function format12Hour(date) {
  let h = date.getHours();
  const m = date.getMinutes();
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function SignalBars({ strength = 4 }) {
  const heights = [3.5, 5.5, 7.5, 9.5];
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-label={`Signal ${strength}/4`}>
      {heights.map((h, i) => (
        <rect key={i} x={i * 4.5} y={12 - h} width="3" height={h} rx="1" fill="white" opacity={i < strength ? 1 : 0.25} />
      ))}
    </svg>
  );
}

function BatteryIcon({ level = 1, charging = false }) {
  const fillWidth = Math.max(1, Math.round(18 * level));
  const fillColor = level <= 0.2 ? "var(--error)" : "white";
  return (
    <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
      <rect x="0.5" y="0.5" width="23" height="12" rx="3" stroke="white" strokeWidth="1" opacity="0.4" />
      <rect x="2.5" y="2.5" width={fillWidth} height="8" rx="1.5" fill={fillColor} />
      <rect x="24.5" y="4" width="2" height="5" rx="1" fill="white" opacity="0.4" />
      {charging && <path d="M11 2.5 L8.5 6.5 H12 L10 10.5" stroke="var(--base-100)" strokeWidth="1" fill="white" />}
    </svg>
  );
}

// ─── Modern Phone Status Bar (Dynamic Island Layout) ────────────────────────
function PhoneStatusBar() {
  const [time, setTime] = useState(() => format12Hour(new Date()));
  const [battery, setBattery] = useState({ level: 1, charging: false, supported: false });
  const [signal, setSignal] = useState(4);

  useEffect(() => {
    const id = setInterval(() => setTime(format12Hour(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  const batRef = useRef(null);
  useEffect(() => {
    if (!navigator.getBattery) return;
    let cancel = false;
    navigator.getBattery().then((b) => {
      if (cancel) return;
      const update = () => setBattery({ level: b.level, charging: b.charging, supported: true });
      update();
      b.addEventListener("levelchange", update);
      b.addEventListener("chargingchange", update);
      batRef.current = () => { b.removeEventListener("levelchange", update); b.removeEventListener("chargingchange", update); };
    }).catch(() => {});
    return () => { cancel = true; batRef.current?.(); };
  }, []);

  const readNetwork = useCallback(() => {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) { setSignal(navigator.onLine ? 4 : 0); return; }
    const type = c.effectiveType || c.type || "";
    const dl = c.downlink ?? 10;
    setSignal(!navigator.onLine ? 0 : (type.includes("2g") || dl < 0.5) ? 1 : dl < 2 ? 2 : dl < 8 ? 3 : 4);
  }, []);

  useEffect(() => {
    readNetwork();
    const c = navigator.connection;
    c?.addEventListener("change", readNetwork);
    window.addEventListener("online", readNetwork);
    window.addEventListener("offline", readNetwork);
    const id = setInterval(readNetwork, 30000);
    return () => { c?.removeEventListener("change", readNetwork); window.removeEventListener("online", readNetwork); window.removeEventListener("offline", readNetwork); clearInterval(id); };
  }, [readNetwork]);

  return (
    <div className="absolute top-0 left-0 right-0 z-40 flex items-start justify-between px-6 pt-3.5 pointer-events-none">
      <div className="w-[70px] flex justify-start pl-1">
        <span className="text-[14px] font-bold tracking-tight text-white/90 drop-shadow-md" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
          {time}
        </span>
      </div>
      <div className="w-[110px] h-[32px] bg-black rounded-[20px] shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset] flex items-center justify-end pr-2.5">
        <div className="w-3.5 h-3.5 rounded-full bg-[#111] border border-white/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] flex items-center justify-center relative overflow-hidden">
          <div className="absolute w-1 h-1 rounded-full bg-blue-800/40" />
          <div className="absolute top-[3px] right-[3px] w-[1px] h-[1px] rounded-full bg-blue-300/80" />
        </div>
      </div>
      <div className="w-[70px] flex justify-end items-center gap-[6px] pr-1 pt-0.5">
        <SignalBars strength={signal} />
        <BatteryIcon level={battery.level} charging={battery.charging} />
      </div>
    </div>
  );
}

// ─── Media Card (The Phone Mockup) ──────────────────────────────────────────
const MediaCard = memo(({ media, badge, analyticsTag, activeTo }) => {
  if (!media?.url) return null;

  const scheduleLabel = activeTo
    ? `Until ${new Date(activeTo).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : "Live Now";

  return (
    <div className="relative w-full max-w-[340px] lg:max-w-none flex justify-center lg:justify-end scale-[0.85] sm:scale-95 lg:scale-100 origin-center lg:origin-right" data-analytics={analyticsTag}>
      
      <motion.div variants={variants.float} animate="animate" className="relative z-10 lg:mr-10 drop-shadow-2xl">
        <div className="relative w-[320px] h-[650px]">
          <div className="absolute inset-0 rounded-[52px] z-10 bg-gradient-to-br from-[#4a4a4e] via-[#2a2a2e] to-[#1a1a1d] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),_0_0_0_1px_rgba(255,255,255,0.1),_0_30px_60px_rgba(0,0,0,0.4)]" />
          <div className="absolute z-10 inset-[4px] rounded-[48px] bg-black" />
          
          <div className="absolute z-20 inset-[10px] rounded-[42px] overflow-hidden bg-base-300 isolate [transform:translateZ(0)]">
            <PhoneStatusBar />

            {media.type === "video" ? (
              <video src={media.url} poster={media.poster} autoPlay muted loop playsInline className="w-full h-full object-cover" />
            ) : media.type === "lottie" ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-base-200 to-base-300">
                <div className="w-20 h-20 mb-4 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                  <Zap size={36} className="text-primary" />
                </div>
                <p className="font-poppins text-sm text-base-content/60 font-bold uppercase tracking-widest">Interactive Media</p>
              </div>
            ) : (
              <Image 
                src={media.url} 
                alt={media.altText || "Hero visual"} 
                fill 
                priority
                sizes="(max-width: 768px) 320px, 320px"
                className="object-cover -z-10" 
              />
            )}

            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 z-20" />
            
            <div className="absolute bottom-0 left-0 right-0 z-30 p-6 pb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-error" />
                </span>
                <span className="font-poppins text-white text-[10px] font-bold uppercase tracking-widest">
                  {scheduleLabel}
                </span>
              </div>
              <h3 className="font-montserrat text-lg font-black leading-tight mt-3 text-white drop-shadow-sm">
                {badge?.text || "Premium Care Access"}
              </h3>
            </div>
          </div>

          <div className="absolute z-30 inset-[10px] rounded-[42px] pointer-events-none bg-gradient-to-br from-white/10 via-white/5 to-transparent opacity-50" />
          
          <div className="absolute z-0 left-[-3px] top-[110px] w-[3px] h-[26px] rounded-l-sm bg-[#2a2a2e]" />
          <div className="absolute z-0 left-[-3px] top-[160px] w-[3px] h-[54px] rounded-l-sm bg-[#2a2a2e]" />
          <div className="absolute z-0 left-[-3px] top-[230px] w-[3px] h-[54px] rounded-l-sm bg-[#2a2a2e]" />
          <div className="absolute z-0 right-[-3px] top-[180px] w-[3px] h-[80px] rounded-r-sm bg-[#2a2a2e]" />
        </div>
      </motion.div>

      {activeTo && (
        <motion.div variants={floatDelay(1.5)} animate="animate" className="absolute right-[-10px] sm:right-[10px] top-[15%] z-40 hidden sm:block">
          <div className="flex flex-col gap-1 px-5 py-4 rounded-[var(--r-box)] border bg-base-100/80 backdrop-blur-xl border-base-300 shadow-xl shadow-base-content/5">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-primary" />
              <p className="font-poppins text-[10px] font-bold uppercase tracking-widest text-base-content/60">Limited Time</p>
            </div>
            <p className="font-montserrat text-sm font-black text-base-content">{scheduleLabel}</p>
          </div>
        </motion.div>
      )}

      <motion.div variants={floatDelay(3)} animate="animate" className="absolute left-[-20px] sm:left-[-10px] bottom-[20%] z-40">
        <div className="flex items-center gap-4 px-5 py-3.5 rounded-[var(--r-box)] border bg-base-100/80 backdrop-blur-xl border-base-300 shadow-xl shadow-base-content/5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-success/15 text-success">
            <Zap size={18} fill="currentColor" />
          </div>
          <div>
            <p className="font-poppins text-[10px] font-bold uppercase tracking-widest text-base-content/60">SLA Response</p>
            <p className="font-montserrat text-base font-black text-success">&lt; 2 Minutes</p>
          </div>
        </div>
      </motion.div>

      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,color-mix(in_oklch,var(--primary)_25%,transparent),transparent_70%)] blur-[40px]" />
    </div>
  );
});
MediaCard.displayName = "MediaCard";

// ─── Utility ──────────────────────────────────────────────────────────────────
const buildHeadline = (headline, highlightedText) => {
  if (!highlightedText || !headline?.includes(highlightedText)) {
    return <span className="text-base-content">{headline}</span>;
  }
  const parts = headline.split(highlightedText);
  return (
    <>
      {parts[0] && <span className="text-base-content">{parts[0]}</span>}
      <span className="text-gradient-primary">{highlightedText}</span>
      {parts[1] && <span className="text-base-content">{parts[1]}</span>}
    </>
  );
};

// ─── Main Hero Component ──────────────────────────────────────────────────────

export default function Hero({ serverHero = null }) {
  const dispatch = useDispatch();
  const reduxHero = useSelector(selectActiveHero);
  const loading = useSelector(selectLoadingActiveHero);
  const reduceMotion = useReducedMotion();

  const hero = serverHero || reduxHero;
  const isLoading = !hero && loading;

  useEffect(() => {
    if (!hero && !serverHero) {
      dispatch(fetchActiveHero());
    }
  }, [dispatch, hero, serverHero]);

  const headlineNode = useMemo(() => buildHeadline(hero?.headline, hero?.highlightedText), [hero?.headline, hero?.highlightedText]);
  const sortedBtns = useMemo(() => Array.isArray(hero?.ctaButtons) ? [...hero.ctaButtons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [], [hero?.ctaButtons]);

  if (isLoading) return <Skeleton />;
  if (!hero) return <Fallback />;

  const hasMedia = Boolean(hero.media?.url);
  const centred = !hasMedia;

  return (
    <Container>
      <AnimatePresence mode="wait">
        <motion.section
          key={hero._id || 'hero'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="relative w-full min-h-screen flex items-center bg-base-100 mb-10 overflow-hidden"
          aria-label="Main Hero Campaign"
        >
          <Background />
          <div className="relative z-10 w-full py-20 lg:py-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
              
              {/* ── Text Content ── */}
              <motion.div variants={variants.stagger} initial="hidden" animate="visible" className={`${hasMedia ? "lg:col-span-6" : "lg:col-span-8 lg:col-start-3 text-center"} flex flex-col justify-center space-y-8`}>
                
                {hero.badge?.text && (
                  <motion.div variants={variants.fadeUp} className={`flex ${centred ? "justify-center" : "justify-center lg:justify-start"}`}>
                    <div className="inline-flex items-center badge-primary bg-primary/10 border-primary/20 gap-2 px-4 py-2 rounded-full border backdrop-blur-sm" role="status">
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                      </span>
                      {hero.badge.icon && <span className="text-sm">{hero.badge.icon}</span>}
                      <span className="font-poppins text-[11px] font-bold uppercase tracking-[0.15em] text-primary">{hero.badge.text}</span>
                    </div>
                  </motion.div>
                )}

                <motion.div variants={variants.fadeUp} className="space-y-6">
                  <h1 className="font-montserrat font-black text-5xl sm:text-6xl lg:text-[4rem] leading-[1.05] tracking-tight">
                    {headlineNode}
                  </h1>
                  {(hero.subheadline || hero.description) && (
                    <div className={`max-w-xl mx-auto ${centred ? "" : "lg:mx-0"} space-y-3`}>
                      {hero.subheadline && <p className="font-poppins text-lg sm:text-lg font-semibold text-base-content/80">{hero.subheadline}</p>}
                      {hero.description && <p className="font-poppins text-sm sm:text-base leading-relaxed font-medium text-base-content/60">{hero.description}</p>}
                    </div>
                  )}
                </motion.div>

                {sortedBtns.length > 0 && (
                  <motion.div variants={variants.fadeUp} className={`flex flex-col sm:flex-row flex-wrap gap-4 pt-2 ${centred ? "justify-center" : "justify-center lg:justify-start"}`}>
                    {sortedBtns.map((btn, i) => {
                      // Map the legacy variant names to SpecialButton variants
                      let mappedVariant = "solid";
                      if (btn.variant === 'secondary') mappedVariant = "soft";
                      if (btn.variant === 'outline') mappedVariant = "outline";
                      if (btn.variant === 'ghost') mappedVariant = "ghost";

                      return (
                        <SpecialButton
                          key={btn._id ?? i}
                          title={btn.label}
                          href={btn.href}
                          target={btn.isExternal ? "_blank" : undefined}
                          as="link" // Renders it correctly as a Next.js Link / a tag
                          variant={mappedVariant}
                          size="lg" // Match the old btn-lg
                          animation="lift" 
                          role={'doctor'}
                          textAnimation="letterStagger" 
                          icon={btn.isExternal ? ExternalLink : ArrowRight}
                          iconPosition="right"
                          className="w-full sm:w-auto" // Keeps mobile scaling the same
                        />
                      );
                    })}
                  </motion.div>
                )}

                <TrustRow priority={hero.priority} centred={centred} />
              </motion.div>

              {/* ── Media Mockup ── */}
              {hasMedia && (
                <motion.div variants={variants.fadeLeft} initial="hidden" animate="visible" className="lg:col-span-6 flex relative w-full items-center justify-center lg:justify-end [perspective:2000px]">
                  <MediaCard media={hero.media} badge={hero.badge} analyticsTag={hero.analyticsTag} activeTo={hero.activeTo} />
                </motion.div>
              )}
            </div>
          </div>

          {/* Scroll Down Indicator */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 0.5 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10" aria-hidden="true">
            <span className="font-poppins text-[10px] uppercase tracking-widest font-bold text-base-content/60">Discover</span>
            <motion.div animate={reduceMotion ? {} : { y: [0, 8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              <ChevronDown size={16} className="text-base-content/60" />
            </motion.div>
          </motion.div>
        </motion.section>
      </AnimatePresence>
    </Container>
  );
}