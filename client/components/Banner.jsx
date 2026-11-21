"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Microscope,
  Pill,
  Hospital,
  UserRound,
  Play,
  Pause
} from 'lucide-react';
import { fetchActiveBanners, trackBannerClick } from '@/store/slices/bannerSlice';

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

const resolveImage = (images, screen) => {
  if (!images) return '';
  const { mobile = '', tablet = '', desktop = '' } = images;

  if (screen === 'desktop') return desktop || tablet || mobile;
  if (screen === 'tablet')  return tablet  || mobile || desktop;
  return mobile || tablet || desktop;
};

const getScreenBucket = () => {
  if (typeof window === 'undefined') return 'mobile';
  const w = window.innerWidth;
  if (w >= 1024) return 'desktop';
  if (w >= 768)  return 'tablet';
  return 'mobile';
};

// ─────────────────────────────────────────────────────────────────────────────
// THEME CONFIG  (Updated with precise aspect ratios)
// ─────────────────────────────────────────────────────────────────────────────

const THEME_CONFIG = {
  Home_Top: {
    dimensions: "w-full aspect-[800/1000] md:aspect-[1200/500] lg:aspect-[1920/600]",
    accentHex: "#4f46e5",
    icon: <UserRound className="w-4 h-4" />,
    label: "Primary Care",
  },
  Home_Middle: {
    dimensions: "w-full aspect-[800/900] md:aspect-[1200/450] lg:aspect-[1920/500]",
    accentHex: "#7c3aed",
    icon: <ShieldCheck className="w-4 h-4" />,
    label: "Security & Trust",
  },
  Medicine_Page: {
    dimensions: "w-full aspect-[800/800] md:aspect-[1200/400] lg:aspect-[1920/450]",
    accentHex: "#0d9488",
    icon: <Pill className="w-4 h-4" />,
    label: "Pharmacy",
  },
  Lab_Page: {
    dimensions: "w-full aspect-[800/800] md:aspect-[1200/400] lg:aspect-[1920/450]",
    accentHex: "#7c3aed",
    icon: <Microscope className="w-4 h-4" />,
    label: "Diagnostics",
  },
  Checkout_Bottom: {
    dimensions: "w-full aspect-[800/650] md:aspect-[1200/320] lg:aspect-[1920/350]",
    accentHex: "#dc2626",
    icon: <Hospital className="w-4 h-4" />,
    label: "Hospital Care",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SLIDE VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const slideVariants = {
  enter:  (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0,   scale: 1.04 }),
  center:            { x: 0,                           opacity: 1,   scale: 1    },
  exit:   (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0,   scale: 0.98 }),
};

const slideTransition = {
  x:       { type: 'spring', stiffness: 200, damping: 28 },
  opacity: { duration: 0.35 },
  scale:   { duration: 0.5  },
};

const AUTO_INTERVAL = 7000;

// ─────────────────────────────────────────────────────────────────────────────
// BANNER ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

const Banner = ({ position = 'Home_Top' }) => {
  const dispatch = useDispatch();
  const { activeBanners, isRefreshing } = useSelector((s) => s.banners);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection]       = useState(1);
  const [paused, setPaused]             = useState(false);
  const [screenBucket, setScreenBucket] = useState('mobile');

  const timerRef = useRef(null);
  const theme = THEME_CONFIG[position] ?? THEME_CONFIG.Home_Top;

  useEffect(() => {
    const update = () => setScreenBucket(getScreenBucket());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    dispatch(fetchActiveBanners(position));
  }, [dispatch, position]);

  const displayBanners = useMemo(() => {
    if (!Array.isArray(activeBanners)) return [];
    return activeBanners
      .filter(b => b.position === position && b.isActive)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }, [activeBanners, position]);

  useEffect(() => {
    setCurrentIndex(0);
    setDirection(1);
  }, [position]);

  useEffect(() => {
    if (displayBanners.length > 0 && currentIndex >= displayBanners.length) {
      setCurrentIndex(displayBanners.length - 1);
    }
  }, [displayBanners.length, currentIndex]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (paused) return;
    timerRef.current = setInterval(() => {
      setDirection(1);
      setCurrentIndex(prev => (prev + 1) % displayBanners.length);
    }, AUTO_INTERVAL);
  }, [displayBanners.length, paused]);

  useEffect(() => {
    if (displayBanners.length <= 1) return;
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [displayBanners.length, startTimer]);

  const paginate = useCallback((newDir) => {
    setDirection(newDir);
    setCurrentIndex(prev =>
      (prev + newDir + displayBanners.length) % displayBanners.length
    );
    startTimer();
  }, [displayBanners.length, startTimer]);

  const goTo = useCallback((idx) => {
    setDirection(idx > currentIndex ? 1 : -1);
    setCurrentIndex(idx);
    startTimer();
  }, [currentIndex, startTimer]);

  if (isRefreshing && displayBanners.length === 0) {
    return (
      <div className={`w-full ${theme.dimensions} rounded-2xl overflow-hidden`}>
        <div className="w-full h-full bg-gradient-to-br from-neutral-900 to-neutral-800 animate-pulse">
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-2 border-white/10 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (displayBanners.length === 0) return null;

  const current = displayBanners[currentIndex];

  return (
    <div
      className="w-full relative rounded-2xl overflow-hidden group/banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => { setPaused(false); startTimer(); }}
    >
      <div className={`relative ${theme.dimensions}`}>
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={`${position}-${currentIndex}`}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="absolute inset-0 w-full h-full"
          >
            <BannerItem
              data={current}
              theme={theme}
              screenBucket={screenBucket}
              onInteraction={() => dispatch(trackBannerClick(current._id))}
            />
          </motion.div>
        </AnimatePresence>

        {displayBanners.length > 1 && (
          <>
            <NavArrow dir="prev" onClick={() => paginate(-1)} accentHex={theme.accentHex} />
            <NavArrow dir="next" onClick={() => paginate(1)}  accentHex={theme.accentHex} />
          </>
        )}

        {displayBanners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 lg:left-auto lg:translate-x-0 lg:right-6 lg:bottom-6 z-40 flex items-center gap-2">
            <button
              onClick={() => setPaused(p => !p)}
              aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-black/40 border border-white/10 text-white/60 hover:text-white hover:bg-black/60 transition-all"
            >
              {paused ? <Play size={9} /> : <Pause size={9} />}
            </button>
            {displayBanners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Banner ${i + 1}`}
                className={`h-[3px] rounded-full transition-all duration-400 ${
                  i === currentIndex
                    ? 'w-8 lg:w-10'
                    : 'w-3 lg:w-4 bg-white/25 hover:bg-white/50'
                }`}
                style={i === currentIndex ? { background: theme.accentHex } : {}}
              />
            ))}
          </div>
        )}

        {!paused && (
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/5 z-50">
            <motion.div
              key={`progress-${position}-${currentIndex}`}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: AUTO_INTERVAL / 1000, ease: 'linear' }}
              style={{ background: theme.accentHex }}
              className="h-full"
            />
          </div>
        )}

        {displayBanners.length > 1 && (
          <div className="absolute top-4 right-4 lg:top-5 lg:right-5 z-40">
            <div className="bg-black/40 border border-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <span className="text-white font-bold text-[10px] tracking-widest tabular-nums">
                {String(currentIndex + 1).padStart(2, '0')} /&nbsp;
                {String(displayBanners.length).padStart(2, '0')}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const NavArrow = ({ dir, onClick, accentHex }) => (
  <div
    className={`absolute top-1/2 -translate-y-1/2 z-50 pointer-events-none
      ${dir === 'prev' ? 'left-3 sm:left-4 lg:left-6' : 'right-3 sm:right-4 lg:right-6'}`}
  >
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      aria-label={dir === 'prev' ? 'Previous banner' : 'Next banner'}
      className={`pointer-events-auto w-9 h-9 lg:w-11 lg:h-11 flex items-center justify-center bg-black/35 border border-white/12 text-white backdrop-blur-md opacity-0 group-hover/banner:opacity-100 transition-all duration-200 hover:border-white/40 rounded-xl`}
      style={{ '--accent': accentHex }}
    >
      {dir === 'prev'
        ? <ChevronLeft  size={18} className="lg:w-5 lg:h-5" />
        : <ChevronRight size={18} className="lg:w-5 lg:h-5" />}
    </motion.button>
  </div>
);

const BannerItem = ({ data, theme, screenBucket, onInteraction }) => {
  const resolvedSrc = resolveImage(data.images, screenBucket);

  if (!resolvedSrc) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: `${theme.accentHex}22` }}
      >
        <span className="text-white/20 font-bold text-xs uppercase tracking-widest">No image</span>
      </div>
    );
  }

  const getHref = () => {
    switch (data.targetType) {
      case 'ExternalLink':  return data.externalUrl || '#';
      case 'InternalRoute': return data.targetId || '/';
      case 'Hospital':      return `/hospitals/${data.targetId}`;
      case 'Product':       return data.targetId ? `/pharmacy/buy-medicines/${data.targetId}` : '/pharmacy/buy-medicines';
      case 'Category':      return '/pharmacy/buy-medicines';
      case 'Promotion':     return '/subscriptions';
      default:              return data.targetId || '#';
    }
  };

  return (
    <div className="relative w-full h-full group/item overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Image
          src={resolvedSrc}
          alt={data.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 100vw, 100vw"
          className="object-cover transition-transform duration-[18000ms] ease-out group-hover/item:scale-[1.06]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent z-10" />
        <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-black/60 via-black/10 to-transparent z-20" />
        <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/30 to-transparent z-20" />
      </div>

      <div className="absolute top-4 left-4 lg:top-5 lg:left-5 z-30">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex items-center gap-1.5 bg-black/35 border border-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full"
        >
          <span style={{ color: theme.accentHex }}>{theme.icon}</span>
          <span className="text-white/70 text-[10px] font-semibold uppercase tracking-widest hidden sm:inline">
            {theme.label}
          </span>
        </motion.div>
      </div>

      <div className="relative z-30 h-full flex items-end md:items-center px-5 sm:px-8 md:px-14 lg:px-20 xl:px-28 pb-12 md:pb-0">
        <div className="w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="mb-3 md:mb-5"
          >
            <div className="flex items-start gap-3 md:gap-4">
              <h2
                className="font-black font-poppins text-white uppercase tracking-tight leading-[1.08]"
                style={{ fontSize: 'clamp(1.15rem, 4vw, 2.4rem)' }}
              >
                {data.title}
              </h2>
            </div>
          </motion.div>

          {data.subTitle && (
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.5 }}
              className="hidden sm:block font-poppins text-white/65 mb-5 md:mb-8 max-w-lg leading-relaxed line-clamp-2 md:line-clamp-none"
              style={{ fontSize: 'clamp(0.72rem, 1.8vw, 1rem)' }}
            >
              {data.subTitle}
            </motion.p>
          )}

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.45 }}
          >
            <Link
              href={getHref()}
              onClick={onInteraction}
              className="inline-flex items-center gap-3 md:gap-4 text-white font-bold uppercase tracking-[0.18em] md:tracking-[0.22em] hover:brightness-110 active:scale-95 transition-all group/cta"
              style={{ fontSize: 'clamp(0.6rem, 1.4vw, 0.8rem)' }}
            >
              <span
                className="px-4 md:px-7 py-2.5 md:py-3.5 rounded-full"
                style={{ background: theme.accentHex, boxShadow: `0 0 28px ${theme.accentHex}55` }}
              >
                Explore Now
              </span>
              <span className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full border border-white/20 group-hover/cta:bg-white group-hover/cta:border-white transition-all">
                <ArrowUpRight size={14} className="md:w-[17px] md:h-[17px] group-hover/cta:text-black transition-colors" />
              </span>
            </Link>
          </motion.div>
        </div>
      </div>

      <div
        className="absolute inset-0 z-25 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)' }}
      />
    </div>
  );
};

export default Banner;