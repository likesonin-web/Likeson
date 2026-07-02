'use client';

import Container from "@/components/ui/Container";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector }                  from 'react-redux';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Gift, Copy, Check, Coins, TrendingUp, Users,
  Wallet, ChevronRight, RefreshCw, Sparkles,
  ArrowDownToLine, Star, Zap, Clock, BadgeCheck,
  Share2, ExternalLink, Trophy, Crown, ArrowUpRight,
  Flame, MessageCircle,
} from 'lucide-react';

import {
  getReferralCode,
  redeemCoins,
  selectReferral,
  selectLoaders,
  selectWalletBalance,
} from '@/store/slices/userSlice';
import BackButton from "../../components/BackButton";

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL REFERRAL CONSTANTS — single source of truth for this page.
//
// FIX: previously the ShareBanner header hardcoded "You earn ₹100 · Friend
// earns ₹50" while the stat cards and WhatsApp captions said ₹10 / ₹5 for
// the exact same reward. Two numbers for one fact. Everything below now
// derives from these constants (which mirror the backend's
// REFERRAL_INVITER_COINS / REFERRAL_INVITEE_COINS / COINS_PER_RUPEE), so the
// figure can only ever say one thing in one place.
// ─────────────────────────────────────────────────────────────────────────────
const COINS_PER_RUPEE     = 100;
const MIN_REDEEM          = 500;
const REFERRER_COINS      = 1000;                                   // you earn, per completed referral
const REFEREE_COINS       = 500;                                    // friend earns, on signup
const REFERRER_RUPEES     = +(REFERRER_COINS / COINS_PER_RUPEE).toFixed(2); // ₹10
const REFEREE_RUPEES      = +(REFEREE_COINS  / COINS_PER_RUPEE).toFixed(2); // ₹5
const BASE_URL            = process.env.NEXT_PUBLIC_FORNTEND_URL ?? 'https://app.likenson.com';

// ─── WhatsApp caption templates — reward figures now injected, never hardcoded ──
const WA_CAPTIONS = (code, link, refereeRupees, referrerRupees) => [
  {
    id: 'reward',
    label: '🎁 Reward Focus',
    text:
      `🌟 *Join Likenson Healthcare & Get ₹${refereeRupees} FREE!*\n\n` +
      `India's most trusted health platform is rewarding you!\n\n` +
      `✅ Order medicines at doorstep\n` +
      `✅ Book doctor consultations online\n` +
      `✅ Affordable lab tests at home\n\n` +
      `👉 Use my referral code *${code}* while signing up:\n` +
      `${link}\n\n` +
      `💰 *You get ₹${refereeRupees} instantly + I earn ₹${referrerRupees} too!*\n` +
      `No catch. Just sign up and enjoy healthcare made simple. 🏥`,
  },
  {
    id: 'casual',
    label: '💬 Casual & Friendly',
    text:
      `Hey! 👋 I've been using *Likenson Healthcare* for my medicines and doctor consultations — super easy and reliable!\n\n` +
      `They're giving *₹${refereeRupees} free wallet cash* to anyone who signs up with my code.\n\n` +
      `🔑 Code: *${code}*\n` +
      `🔗 ${link}\n\n` +
      `Takes 2 minutes. Give it a try! 😊`,
  },
  {
    id: 'urgent',
    label: '⚡ Urgency / FOMO',
    text:
      `⚠️ *Limited time! Free ₹${refereeRupees} on Likenson Healthcare!*\n\n` +
      `Sign up NOW using my referral code and get ₹${refereeRupees} instantly in your health wallet.\n\n` +
      `💊 Medicines | 🩺 Doctors | 🧪 Lab Tests — all at your fingertips.\n\n` +
      `🔑 Referral Code: *${code}*\n` +
      `➡️ Register here: ${link}\n\n` +
      `Don't miss this — share with family too! 🙏`,
  },
];

// ─── Animated Number ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 0, prefix = '', suffix = '' }) {
  const mv        = useMotionValue(0);
  const formatted = useTransform(mv, (v) => `${prefix}${v.toFixed(decimals)}${suffix}`);
  const [display, setDisplay] = useState(`${prefix}${(0).toFixed(decimals)}${suffix}`);

  useEffect(() => {
    const c = animate(mv, value, { duration: 1.4, ease: [0.16, 1, 0.3, 1] });
    const u = formatted.on('change', setDisplay);
    return () => { c.stop(); u(); };
  }, [value]);

  return <span>{display}</span>;
}

// ─── Particle Field ───────────────────────────────────────────────────────────
function ParticleField() {
  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: `${3 + (i * 3.2) % 94}%`,
    y: `${5 + (i * 6.3) % 88}%`,
    size: 1.5 + (i % 5) * 0.8,
    delay: (i * 0.22) % 4,
    dur: 3 + (i % 4) * 0.9,
    opacity: 0.1 + (i % 4) * 0.08,
    tone: i % 3, // 0 amber / 1 white / 2 sky — finite set, mapped to static classes below
  }));

  const toneClass = ['bg-amber-200/60', 'bg-white/35', 'bg-sky-300/40'];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute rounded-full ${toneClass[p.tone]}`}
          style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
          animate={{
            opacity: [p.opacity, p.opacity * 5, p.opacity],
            scale: [0.7, 1.6, 0.7],
            y: [0, -(8 + (p.id % 3) * 6), 0],
          }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {/* Large glow orbs */}
      <div className="absolute -top-[20%] -right-[5%] w-[400px] h-[400px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--secondary)_12%,transparent)_0%,transparent_70%)]" />
      <div className="absolute -bottom-[15%] left-[10%] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--warning)_12%,transparent)_0%,transparent_70%)]" />
    </div>
  );
}

// ─── Real 3D Coin ─────────────────────────────────────────────────────────────
// NOTE: this is the one deliberate exception to "no inline style". The coin's
// face offset, edge-ring count, and per-face rotation are all trigonometry
// derived from the `size` prop at render time (translateZ(thickness/2),
// rotateZ(i * angle) translateY(-radius), conic-gradient stops). None of that
// can be expressed as a static Tailwind class — it's runtime geometry, not
// design tokens. Every color/border here is still a real design decision
// (brand gold), just necessarily delivered via style since it's computed.
function RealCoin3D({ size = 120 }) {
  const thickness = size * 0.12;
  const radius    = size / 2;
  const edgeFaces = 60;
  const angle     = 360 / edgeFaces;
  const edgeWidth = 2 * radius * Math.tan(Math.PI / edgeFaces) + 0.5;

  const frontPathId = "coin-front-path";
  const backPathId  = "coin-back-path";

  const goldFinish = `
    radial-gradient(circle at 50% 50%, transparent 65%, rgba(120,53,15,0.8) 95%, #78350f 100%),
    conic-gradient(from 25deg, #b45309 0deg, #fef08a 45deg, #b45309 90deg, #78350f 135deg, #b45309 180deg, #fef08a 225deg, #b45309 270deg, #78350f 315deg, #b45309 360deg)
  `;

  const CircularText = ({ pathId }) => (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full z-[2]">
      <defs>
        <path id={pathId} d="M 50, 50 m -34, 0 a 34,34 0 1,1 68,0 a 34,34 0 1,1 -68,0" />
      </defs>
      <text
        fill="#b45309"
        fontSize="7.5"
        fontWeight="900"
        letterSpacing="1"
        className="[text-shadow:0_1px_1px_rgba(255,255,255,0.4),0_-1px_1px_rgba(0,0,0,0.5)]"
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          • LIKESON HEALTH CARE • LIKESON HEALTH CARE
        </textPath>
      </text>
    </svg>
  );

  return (
    <div style={{ width: size, height: size, perspective: 1000 }}>
      <motion.div
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
        style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}
      >
        {/* ── FRONT FACE ── */}
        <div
          className="absolute inset-0 rounded-full flex flex-col items-center justify-center shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]"
          style={{
            background: goldFinish,
            transform: `translateZ(${thickness / 2}px)`,
            backfaceVisibility: 'hidden',
            border: `${size * 0.03}px solid #d97706`,
          }}
        >
          <div
            className="absolute rounded-full border-dashed"
            style={{ inset: size * 0.06, borderWidth: size * 0.015, borderColor: 'rgba(180,83,9,0.5)' }}
          />
          <CircularText pathId={frontPathId} />
          <span
            className="font-serif leading-none z-[1]"
            style={{
              color: '#fcd34d',
              fontWeight: 900,
              fontSize: size * 0.40,
              textShadow: '-1px -1px 0 #78350f, 1px 1px 0 #fef08a, 0 2px 4px rgba(120,53,15,0.8), 0 4px 8px rgba(0,0,0,0.4)',
            }}
          >
            ₹
          </span>
        </div>

        {/* ── BACK FACE ── */}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center shadow-[inset_0_0_10px_rgba(0,0,0,0.3)]"
          style={{
            background: goldFinish,
            transform: `rotateY(180deg) translateZ(${thickness / 2}px)`,
            backfaceVisibility: 'hidden',
            border: `${size * 0.03}px solid #d97706`,
          }}
        >
          <div
            className="absolute rounded-full border-dashed"
            style={{ inset: size * 0.06, borderWidth: size * 0.015, borderColor: 'rgba(180,83,9,0.5)' }}
          />
          <CircularText pathId={backPathId} />
          <div
            className="rounded-full flex items-center justify-center z-[1] bg-[rgba(180,83,9,0.1)] shadow-[inset_0_2px_6px_rgba(120,53,15,0.6),0_2px_4px_rgba(255,255,255,0.3)]"
            style={{ width: '45%', height: '45%' }}
          >
            <span
              className="font-black"
              style={{ color: '#fcd34d', fontSize: size * 0.25, textShadow: '-1px -1px 0 #78350f, 1px 1px 0 #fef08a' }}
            >
              L
            </span>
          </div>
        </div>

        {/* ── EDGE (milling ridges) ── */}
        {Array.from({ length: edgeFaces }).map((_, i) => (
          <div
            key={i}
            className="absolute bg-[linear-gradient(to_right,#92400e_0%,#fcd34d_50%,#78350f_100%)]"
            style={{
              width: edgeWidth,
              height: thickness,
              left: '50%',
              top: '50%',
              marginLeft: -edgeWidth / 2,
              marginTop: -thickness / 2,
              transform: `rotateZ(${i * angle}deg) translateY(${-radius}px) rotateX(90deg)`,
              backfaceVisibility: 'hidden',
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}

// ─── Orbiting Coin Ring ────────────────────────────────────────────────────────
function CoinOrbitSystem() {
  return (
    <div className="relative w-60 h-60 aspect-square shrink-0">
      <div className="absolute -inset-5 rounded-full blur-2xl bg-[radial-gradient(circle,color-mix(in_oklch,var(--warning)_15%,transparent)_0%,transparent_70%)]" />

      {/* Orbit ring 1 — mini gold coins */}
      <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} className="absolute inset-4">
        <div className="absolute inset-0 rounded-full border border-dashed border-amber-500/25" />
        {[0, 120, 240].map((deg, i) => (
          <div key={i} className="absolute inset-0" style={{ transform: `rotate(${deg}deg)` }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <motion.div
                initial={{ rotate: -deg }}
                animate={{ rotate: [-deg, -360 - deg] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                className="w-6 h-6 rounded-full flex items-center justify-center border border-amber-600 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_4px_6px_rgba(0,0,0,0.3),0_0_10px_rgba(245,158,11,0.5)] bg-[radial-gradient(circle_at_35%_30%,#fef08a_0%,#f59e0b_45%,#b45309_80%,#78350f_100%)]"
              >
                <span className="text-[10px] font-black text-amber-200 [text-shadow:-1px_-1px_0_#78350f,1px_1px_0_#fef08a]">₹</span>
              </motion.div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Orbit ring 2 — blue gems */}
      <motion.div animate={{ rotate: [360, 0] }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} className="absolute inset-12">
        <div className="absolute inset-0 rounded-full border border-dashed border-sky-400/20" />
        {[60, 210].map((deg, i) => (
          <div key={i} className="absolute inset-0" style={{ transform: `rotate(${deg}deg)` }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <motion.div
                initial={{ rotate: -deg }}
                animate={{ rotate: [-deg, 360 - deg] }}
                transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                className="w-3.5 h-3.5 rounded-full shadow-[inset_0_2px_3px_rgba(255,255,255,0.7),0_2px_4px_rgba(0,0,0,0.3),0_0_8px_rgba(59,130,246,0.5)] bg-[radial-gradient(circle_at_35%_30%,#bfdbfe_0%,#3b82f6_50%,#1e40af_100%)]"
              />
            </div>
          </div>
        ))}
      </motion.div>

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <RealCoin3D size={110} />
      </div>
    </div>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ value, label = 'Copy', size = 'md' }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch {}
  }, [value]);
  const pad = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <motion.button
      onClick={handle}
      whileTap={{ scale: 0.93 }}
      whileHover={{ scale: 1.04 }}
      className={`flex items-center gap-1.5 rounded-xl font-bold transition-all duration-200 border-[1.5px] ${pad} ${
        copied
          ? 'bg-success/18 text-success border-success/38'
          : 'bg-primary/12 text-primary border-primary/32'
      }`}
    >
      <AnimatePresence mode="wait">
        {copied
          ? <motion.span key="chk" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}><Check size={13} /></motion.span>
          : <motion.span key="cpy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={13} /></motion.span>
        }
      </AnimatePresence>
      {copied ? 'Copied!' : label}
    </motion.button>
  );
}

// ─── Rank Badge ───────────────────────────────────────────────────────────────
// Fixed tiers → fixed Tailwind classes (finite set, no runtime color interpolation)
const RANK_TIERS = [
  { min: 20, label: 'Diamond', icon: Crown,   classes: 'bg-sky-400/14 text-sky-400 border-sky-400/30' },
  { min: 10, label: 'Gold',    icon: Trophy,  classes: 'bg-amber-500/14 text-amber-500 border-amber-500/30' },
  { min: 5,  label: 'Silver',  icon: Star,    classes: 'bg-slate-400/14 text-slate-400 border-slate-400/30' },
  { min: 0,  label: 'Bronze',  icon: Flame,   classes: 'bg-orange-700/14 text-orange-600 border-orange-600/30' },
];

function RankBadge({ referrals }) {
  const tier = RANK_TIERS.find((t) => referrals >= t.min);
  const Icon = tier.icon;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-xs border ${tier.classes}`}>
      <Icon size={12} />{tier.label}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
// Fixed tones → fixed Tailwind classes (StatCard is always called with one of
// these four semantic tones, never an arbitrary runtime color)
const TONE_CLASSES = {
  primary:   { border: 'border-primary/22',   glow: 'bg-primary/12',   iconBg: 'bg-primary/15',   iconText: 'text-primary',   bar: 'from-primary to-transparent',     shadow: 'shadow-primary/10' },
  warning:   { border: 'border-warning/22',   glow: 'bg-warning/12',   iconBg: 'bg-warning/15',   iconText: 'text-warning',   bar: 'from-warning to-transparent',     shadow: 'shadow-warning/10' },
  success:   { border: 'border-success/22',   glow: 'bg-success/12',   iconBg: 'bg-success/15',   iconText: 'text-success',   bar: 'from-success to-transparent',     shadow: 'shadow-success/10' },
  secondary: { border: 'border-secondary/22', glow: 'bg-secondary/12', iconBg: 'bg-secondary/15', iconText: 'text-secondary', bar: 'from-secondary to-transparent',   shadow: 'shadow-secondary/10' },
};

function StatCard({ icon: Icon, label, value, sub, tone = 'primary', subToneText, delay = 0, prefix = '', suffix = '', decimals = 0 }) {
  const t = TONE_CLASSES[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative overflow-hidden rounded-3xl p-5 bg-base-100 border-[1.5px] shadow-[0_4px_24px_-4px] ${t.border} ${t.shadow}`}
    >
      <div className={`absolute -top-8 -right-8 w-28 h-28 rounded-full blur-xl pointer-events-none ${t.glow}`} />
      <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-3xl bg-gradient-to-r opacity-50 ${t.bar}`} />
      <div className="relative z-10">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-3 ${t.iconBg}`}>
          <Icon size={20} className={t.iconText} />
        </div>
        <div className="text-2xl font-black font-montserrat text-base-content">
          <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
        </div>
        <div className="text-xs font-semibold mt-0.5 text-base-content/50">{label}</div>
        {sub && <div className={`text-xs mt-0.5 font-medium ${subToneText ?? t.iconText}`}>{sub}</div>}
      </div>
    </motion.div>
  );
}

// ─── Chart Tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl px-4 py-3 shadow-xl text-sm bg-base-100 border-[1.5px] border-primary/28 text-base-content">
      <div className="font-bold mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-base-content/60">{p.name}:</span>
          <span className="font-bold">{p.name === 'Rupees' ? `₹${p.value}` : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Redeem Modal ─────────────────────────────────────────────────────────────
function RedeemModal({ coins, onClose, onConfirm, loading }) {
  const [amount, setAmount] = useState(Math.min(MIN_REDEEM, coins));
  const rupees  = +(amount / COINS_PER_RUPEE).toFixed(2);
  const invalid = amount < MIN_REDEEM || amount > coins;
  const presets = [500, 1000, 2000, 5000].filter((p) => p <= coins);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-base-100 border-[1.5px] border-warning/35"
        initial={{ scale: 0.88, y: 60, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.88, y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      >
        <div className="h-1 bg-gradient-to-r from-warning via-accent to-primary" />
        <div className="p-7">
          <div className="flex items-center gap-3 mb-6">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-2xl flex items-center justify-center bg-warning/18"
            >
              <Coins size={24} className="text-warning" />
            </motion.div>
            <div>
              <h3 className="font-montserrat font-black text-xl text-base-content">Redeem Coins</h3>
              <p className="text-xs mt-0.5 text-base-content/50">
                Min {MIN_REDEEM} coins · {COINS_PER_RUPEE} coins = ₹1
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-5 text-center mb-5 bg-gradient-to-br from-warning/10 to-accent/8">
            <div className="text-4xl font-black font-montserrat text-base-content">{amount.toLocaleString()}</div>
            <div className="text-sm font-semibold mt-0.5 text-base-content/50">coins</div>
            <div className="text-xl font-bold mt-2 text-success">→ ₹{rupees} to wallet</div>
          </div>

          {presets.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-4">
              {presets.map((p) => (
                <motion.button
                  key={p} whileTap={{ scale: 0.93 }} onClick={() => setAmount(p)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    amount === p ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/65'
                  }`}
                >
                  {p}
                </motion.button>
              ))}
              <motion.button
                whileTap={{ scale: 0.93 }} onClick={() => setAmount(coins)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  amount === coins ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/65'
                }`}
              >
                Max
              </motion.button>
            </div>
          )}

          <div className="mb-6">
            <div className="flex justify-between text-xs font-semibold mb-2 text-base-content/50">
              <span>{MIN_REDEEM}</span><span>{coins}</span>
            </div>
            <input
              type="range" min={MIN_REDEEM} max={coins} step={100} value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-warning"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-2xl font-bold text-sm bg-base-200 text-base-content/65">
              Cancel
            </button>
            <motion.button
              onClick={() => onConfirm(amount)} disabled={invalid || loading} whileTap={{ scale: 0.97 }}
              className={`flex-1 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${
                invalid
                  ? 'bg-base-300 text-base-content/40 cursor-not-allowed'
                  : 'bg-gradient-to-br from-warning to-accent text-[#78350f] cursor-pointer shadow-[0_4px_16px_rgba(245,158,11,0.35)]'
              }`}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <><ArrowDownToLine size={16} />Redeem</>}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Share Banner ─────────────────────────────────────────────────────────────
function ShareBanner({ referralCode }) {
  const bannerRef  = useRef(null);
  const signupLink = `${BASE_URL}/signup?ref=${referralCode}`;

  const [captionIdx, setCaptionIdx]       = useState(0);
  const [captionCopied, setCaptionCopied] = useState(false);

  const captions       = WA_CAPTIONS(referralCode, signupLink, REFEREE_RUPEES, REFERRER_RUPEES);
  const currentCaption = captions[captionIdx].text;

  const handleCopyCaption = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentCaption);
      setCaptionCopied(true);
      setTimeout(() => setCaptionCopied(false), 2200);
    } catch {}
  }, [currentCaption]);

  const handleWhatsApp = useCallback(() => {
    // FIX: wa.me is a redirector — it 302s to api.whatsapp.com before the
    // WhatsApp app/web picks it up. On several mobile browsers and in-app
    // webviews that redirect hop drops the `text` query param, so only the
    // bare link (whatever URL happens to be inside the caption) arrives in
    // the chat — exactly the "only shows the code link" symptom. Hitting
    // api.whatsapp.com/send directly skips that hop entirely.
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(currentCaption)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [currentCaption]);

  return (
    <motion.div
      ref={bannerRef}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.72 }}
      className="rounded-3xl overflow-hidden bg-base-100 border-[1.5px] border-base-300"
    >
      <div className="px-6 py-4 flex items-center gap-3 border-b border-base-300 bg-gradient-to-br from-primary/8 to-secondary/6">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/15">
          <Share2 size={17} className="text-primary" />
        </div>
        <div>
          <div className="font-montserrat font-black text-base text-base-content">Share &amp; Earn</div>
          {/* FIX: was hardcoded "₹100 / ₹50" — now matches the real reward everywhere else on the page */}
          <div className="text-xs text-base-content/50">
            You earn ₹{REFERRER_RUPEES} · Friend earns ₹{REFEREE_RUPEES} · No limit
          </div>
        </div>
        <div className="ml-auto">
          <span className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-warning/15 text-warning">
            <Star size={11} fill="currentColor" /> Unlimited
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Referral Code pill */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2 text-base-content/45">Your Referral Code</div>
          <div className="flex items-center gap-3 rounded-2xl px-5 py-3 bg-base-200 border-[1.5px] border-dashed border-primary/35">
            <span className="font-montserrat font-black text-2xl tracking-[0.25em] text-primary">{referralCode}</span>
            <div className="ml-auto flex gap-2">
              <CopyButton value={referralCode} label="Copy Code" />
            </div>
          </div>
        </div>

        {/* Signup link */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2 text-base-content/45">Direct Signup Link</div>
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3 bg-base-200 border border-base-300">
            <ExternalLink size={14} className="text-base-content/40 shrink-0" />
            <span className="text-xs font-mono truncate flex-1 text-base-content/60">{signupLink}</span>
            <CopyButton value={signupLink} label="Copy Link" size="sm" />
          </div>
        </div>

        {/* Caption Selector */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3 text-base-content/45">WhatsApp Caption Templates</div>
          <div className="flex gap-2 flex-wrap mb-3">
            {captions.map((c, i) => (
              <button
                key={c.id} onClick={() => setCaptionIdx(i)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  captionIdx === i ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/65'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="rounded-2xl p-4 mb-3 text-xs leading-relaxed whitespace-pre-wrap max-h-40 overflow-auto bg-base-200 border border-base-300 text-base-content/75">
            {currentCaption}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <motion.button
              onClick={handleWhatsApp} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm text-white bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-[0_4px_16px_rgba(37,211,102,0.28)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.528 5.845L.057 23.938l6.304-1.652C8.012 23.406 9.972 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.882 0-3.63-.502-5.143-1.38l-.369-.219-3.78.99 1.009-3.684-.24-.378C2.55 15.762 2 13.943 2 12 2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
              Share Text
            </motion.button>
            <motion.button
              onClick={handleCopyCaption} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              className={`flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm transition-all border-[1.5px] ${
                captionCopied ? 'bg-success/15 text-success border-success/30' : 'bg-base-200 text-base-content border-base-300'
              }`}
            >
              <AnimatePresence mode="wait">
                {captionCopied
                  ? <motion.span key="chk" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={16} /></motion.span>
                  : <motion.span key="cpy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><MessageCircle size={16} /></motion.span>
                }
              </AnimatePresence>
              {captionCopied ? 'Caption Copied!' : 'Copy Caption'}
            </motion.button>
            <motion.a
              href={signupLink} target="_blank" rel="noopener noreferrer"
              whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm text-primary-content bg-gradient-to-br from-primary to-secondary shadow-[0_4px_16px_color-mix(in_oklch,var(--primary)_28%,transparent)]"
            >
              <ArrowUpRight size={17} /> Open Link
            </motion.a>
          </div>
        </div>

        {/* Brand panel */}
        <div className="rounded-2xl p-5 flex gap-4 items-center bg-gradient-to-br from-primary/6 to-secondary/5 border-[1.5px] border-primary/18">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-montserrat font-black text-xl text-primary-content bg-gradient-to-br from-primary to-secondary shadow-[0_4px_12px_color-mix(in_oklch,var(--primary)_28%,transparent)]">
            L
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-montserrat font-black text-base mb-0.5 text-base-content">Likenson Healthcare</div>
            <div className="text-xs leading-relaxed text-base-content/60">
              India's trusted platform for medicine delivery, doctor consultations &amp; health packages.
            </div>
            <div className="flex gap-2 mt-2 flex-wrap">
              {['Medicine Delivery', 'Consultations', 'Lab Tests'].map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function MyReferral() {
  const dispatch      = useDispatch();
  const referral      = useSelector(selectReferral);
  const loaders       = useSelector(selectLoaders);
  const walletBalance = useSelector(selectWalletBalance);

  const [showRedeem, setShowRedeem] = useState(false);
  const [activeTab,  setActiveTab]  = useState('overview');

  const isLoadingReferral = loaders.referralCode;
  const isRedeeming       = loaders.redeemCoins;

  useEffect(() => { dispatch(getReferralCode()); }, [dispatch]);

  const handleRedeem = useCallback(async (coins) => {
    await dispatch(redeemCoins(coins));
    setShowRedeem(false);
    dispatch(getReferralCode());
  }, [dispatch]);

  const chartData = (() => {
    if (!referral.referralHistory?.length) return [
      { month: 'Jan', Coins: 0, Rupees: 0 },
      { month: 'Feb', Coins: 0, Rupees: 0 },
      { month: 'Mar', Coins: 0, Rupees: 0 },
    ];
    const map = {};
    referral.referralHistory.forEach((e) => {
      const k = new Date(e.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
      if (!map[k]) map[k] = { month: k, Coins: 0, Rupees: 0 };
      map[k].Coins  += e.coinsAwarded ?? 0;
      map[k].Rupees  = +((map[k].Coins) / COINS_PER_RUPEE).toFixed(2);
    });
    return Object.values(map);
  })();

  const totalCoinsInRupees = +((referral.coins ?? 0) / COINS_PER_RUPEE).toFixed(2);
  const canRedeem          = (referral.coins ?? 0) >= MIN_REDEEM;

  return (
    <Container>
      <div className="min-h-screen font-poppins">

        {/* ══════════════════════════════════════════════════════════
            HERO
            ══════════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden h-fit bg-gradient-to-br from-primary to-primary/80 ">
 
          

          <BackButton className="m-3" />

          <div className="relative z-10 px-4 md:px-10 pt-10 pb-10">
            {/* Programme label */}
            <motion.div
              initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="flex items-center gap-2 mb-5"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold text-white/95 bg-white/[0.18] backdrop-blur-sm border border-white/25">
                <Sparkles size={12} /> Likenson Rewards Programme
              </div>
            </motion.div>

            <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-12">

              {/* ── LEFT: Title + Code ── */}
              <div className="flex-1 min-w-0">
                <motion.h1
                  className="font-montserrat font-black text-white leading-tight mb-2 text-2xl md:text-4xl"
                  initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.6 }}
                >
                  My Referrals
                </motion.h1>
                <motion.p
                  className="mb-6 text-base text-white/72"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  Invite friends · Earn coins · Redeem instantly
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 280, damping: 22 }}
                  className="inline-flex flex-wrap items-center gap-4 rounded-2xl px-5 py-4 max-w-full bg-white/15 backdrop-blur-xl border-[1.5px] border-white/30"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-widest mb-1 text-white/60">Your Referral Code</div>
                    {isLoadingReferral
                      ? <div className="skeleton h-8 w-36 rounded-lg" />
                      : <div className="font-montserrat font-black tracking-[0.2em] text-white text-2xl">
                          {referral.referralCode ?? '—'}
                        </div>
                    }
                  </div>
                  {referral.referralCode && (
                    <div className="flex flex-col gap-2 items-start sm:items-end shrink-0">
                      <CopyButton value={referral.referralCode} label="Copy Code" />
                      <RankBadge referrals={referral.totalReferrals ?? 0} />
                    </div>
                  )}
                </motion.div>
              </div>

              {/* ── RIGHT: Two stat chips ── */}
              <motion.div
                initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="flex flex-row lg:flex-col gap-3 shrink-0"
              >
                <div className="rounded-2xl px-5 py-4 text-center min-w-40 bg-white/12 backdrop-blur-lg border border-white/22">
                  <div className="text-xs font-bold uppercase tracking-widest mb-1 text-white/60">Coin Balance</div>
                  <div className="font-montserrat font-black text-3xl text-white">
                    <AnimatedNumber value={referral.coins ?? 0} />
                  </div>
                  <div className="text-sm font-semibold mt-0.5 text-white/75">
                    = ₹<AnimatedNumber value={totalCoinsInRupees} decimals={2} />
                  </div>
                </div>

                <div className="rounded-2xl px-5 py-4 text-center min-w-40 bg-white/10 border border-white/16">
                  <div className="text-xs font-semibold mb-1 text-white/60">Total Referrals</div>
                  <div className="font-montserrat font-black text-2xl text-white">
                    <AnimatedNumber value={referral.totalReferrals ?? 0} />
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <Users size={11} className="text-white/50" />
                    <span className="text-xs text-white/50">friends joined</span>
                  </div>
                </div>
              </motion.div>

            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            MAIN CONTENT
            ══════════════════════════════════════════════════════════ */}
        <div className="mt-10 pb-20 space-y-6">

          {/* ── Coin Wallet Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl overflow-hidden shadow-sm bg-base-100 border-[1.5px] border-warning/22"
          >
            <div className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row items-center gap-8">

                <div className="shrink-0 flex items-center justify-center">
                  <CoinOrbitSystem />
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="text-xs font-bold uppercase tracking-widest mb-1 text-base-content/45">Available Balance</div>
                  <div className="font-montserrat font-black leading-[1.05] text-base-content text-[clamp(2.5rem,6vw,4rem)]">
                    <AnimatedNumber value={referral.coins ?? 0} />
                    <span className="text-2xl ml-2 font-bold text-base-content/38">coins</span>
                  </div>
                  <div className="text-xl font-semibold mt-1 text-success">
                    ≈ ₹<AnimatedNumber value={totalCoinsInRupees} decimals={2} />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3 justify-center md:justify-start">
                    <span className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1 bg-success/10 text-success">
                      <TrendingUp size={11} /> Earned: <AnimatedNumber value={referral.coinsEarned ?? 0} /> coins
                    </span>
                    <span className="text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1 bg-info/10 text-info">
                      <ArrowDownToLine size={11} /> Redeemed: <AnimatedNumber value={referral.coinsRedeemed ?? 0} /> coins
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center gap-3">
                  <motion.button
                    onClick={() => canRedeem && setShowRedeem(true)}
                    whileHover={canRedeem ? { scale: 1.05, y: -2 } : {}}
                    whileTap={canRedeem ? { scale: 0.97 } : {}}
                    disabled={!canRedeem}
                    className={`relative overflow-hidden flex items-center gap-3 px-7 py-4 rounded-2xl font-bold text-base ${
                      canRedeem
                        ? 'bg-gradient-to-br from-warning to-accent text-[#78350f] cursor-pointer shadow-[0_2px_8px_rgba(245,158,11,0.4)]'
                        : 'bg-base-300 text-base-content/35 cursor-not-allowed'
                    }`}
                  >
                    {canRedeem && (
                      <motion.div
                        className="absolute inset-0 w-[60%] bg-gradient-to-r from-transparent via-white/35 to-transparent"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
                      />
                    )}
                    <Wallet size={20} />
                    {canRedeem ? 'Redeem to Wallet' : `Need ${MIN_REDEEM} coins`}
                    {canRedeem && <ChevronRight size={16} />}
                  </motion.button>
                  {canRedeem && (
                    <div className="text-xs text-center text-base-content/42">
                      Wallet: ₹{walletBalance?.toFixed(2) ?? '0.00'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Total Referrals"  value={referral.totalReferrals ?? 0} tone="primary"   delay={0.42} />
            <StatCard icon={Coins} label="Coins / Referral" value={REFERRER_COINS} sub={`You earn ₹${REFERRER_RUPEES}`} tone="warning" delay={0.5} />
            <StatCard icon={Gift}  label="Friend's Reward"  value={REFEREE_COINS}  sub={`They earn ₹${REFEREE_RUPEES}`}  tone="success" delay={0.58} />
            <StatCard icon={Zap}   label="Wallet Balance"   value={walletBalance ?? 0} prefix="₹" decimals={2} tone="secondary" delay={0.66} />
          </div>

          {/* ── How It Works ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.56 }}
            className="rounded-3xl p-6 md:p-8 bg-base-100 border-[1.5px] border-base-300"
          >
            <h2 className="font-montserrat font-black text-xl mb-6 text-base-content">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { step: '01', icon: Copy,  title: 'Copy Your Code',    desc: 'Share your unique referral code or direct signup link.',                                                        tone: 'primary' },
                { step: '02', icon: Users, title: 'Friend Signs Up',   desc: 'They register on Likenson using your code or direct link.',                                                     tone: 'secondary' },
                { step: '03', icon: Coins, title: 'Both Get Rewarded', desc: `You earn ${REFERRER_COINS} coins (₹${REFERRER_RUPEES}), friend earns ${REFEREE_COINS} coins (₹${REFEREE_RUPEES}). Instant.`, tone: 'warning' },
              ].map((item, i) => {
                const t = TONE_CLASSES[item.tone];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.62 + i * 0.1 }}
                    className="relative rounded-2xl p-5 bg-base-200"
                  >
                    {i < 2 && (
                      <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex w-4 h-4 rounded-full items-center justify-center bg-base-300">
                        <ChevronRight size={10} className="text-base-content/40" />
                      </div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.iconBg}`}>
                        <item.icon size={18} className={t.iconText} />
                      </div>
                      <div>
                        <div className={`text-xs font-black uppercase tracking-widest mb-1 ${t.iconText}`}>Step {item.step}</div>
                        <div className="font-bold text-sm mb-1 text-base-content">{item.title}</div>
                        <div className="text-xs leading-relaxed text-base-content/55">{item.desc}</div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* ── Share Banner ── */}
          {referral.referralCode && <ShareBanner referralCode={referral.referralCode} />}

          {/* ── Earnings Chart + History ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.68 }}
            className="rounded-3xl overflow-hidden bg-base-100 border-[1.5px] border-base-300"
          >
            <div className="flex border-b border-base-300">
              {[
                { key: 'overview', label: 'Earnings Chart',   icon: TrendingUp },
                { key: 'history',  label: 'Referral History', icon: Clock },
              ].map((tab) => (
                <button
                  key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-6 py-4 text-sm font-bold transition-colors duration-200 ${
                    activeTab === tab.key ? 'text-primary' : 'text-base-content/50'
                  }`}
                >
                  <tab.icon size={15} />
                  {tab.label}
                  {activeTab === tab.key && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'overview' ? (
                <motion.div
                  key="chart"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}
                  className="p-6 md:p-8"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-montserrat font-black text-lg text-base-content">Coins Earned Over Time</h3>
                      <p className="text-xs mt-0.5 text-base-content/48">Monthly breakdown</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" />Coins</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" />Rupees</span>
                    </div>
                  </div>
                  {isLoadingReferral
                    ? <div className="skeleton h-52 rounded-2xl" />
                    : (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="coinsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="var(--primary)" stopOpacity={0.28} />
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.02} />
                            </linearGradient>
                            <linearGradient id="rupeesGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="var(--success)" stopOpacity={0.28} />
                              <stop offset="95%" stopColor="var(--success)" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)', opacity: 0.45 }} axisLine={false} tickLine={false} />
                          <Tooltip content={<ChartTooltip />} />
                          <Area type="monotone" dataKey="Coins"  name="Coins"  stroke="var(--primary)" strokeWidth={2.5} fill="url(#coinsGrad)"  dot={{ r: 4, fill: 'var(--primary)',  strokeWidth: 0 }} />
                          <Area type="monotone" dataKey="Rupees" name="Rupees" stroke="var(--success)" strokeWidth={2.5} fill="url(#rupeesGrad)" dot={{ r: 4, fill: 'var(--success)', strokeWidth: 0 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )
                  }
                </motion.div>
              ) : (
                <motion.div
                  key="history"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.28 }}
                  className="p-6 md:p-8"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-montserrat font-black text-lg text-base-content">Referral History</h3>
                    <span className="text-xs px-3 py-1.5 rounded-full font-bold bg-primary/10 text-primary">
                      {referral.referralHistory?.length ?? 0} referrals
                    </span>
                  </div>
                  {isLoadingReferral ? (
                    <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
                  ) : !referral.referralHistory?.length ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-primary/8">
                        <Users size={28} className="text-primary/45" />
                      </div>
                      <p className="font-bold text-base text-base-content">No referrals yet</p>
                      <p className="text-sm mt-1 text-base-content/48">Share your code to start earning</p>
                    </motion.div>
                  ) : (
                    <div className="space-y-2">
                      {referral.referralHistory.map((entry, i) => (
                        <motion.div
                          key={entry._id ?? i}
                          initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.055 }}
                          className="flex items-center gap-4 rounded-2xl px-5 py-4 transition-all duration-200 cursor-default bg-base-200 border border-transparent hover:border-primary/20"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 bg-primary/20 text-primary">
                            {(entry.referredUser?.name ?? 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate text-base-content">{entry.referredUser?.name ?? 'Anonymous'}</div>
                            <div className="text-xs truncate text-base-content/48">{entry.referredUser?.email ?? '—'}</div>
                          </div>
                          <div className="text-xs hidden sm:block text-base-content/42">
                            {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shrink-0 bg-success/12 text-success">
                            <BadgeCheck size={12} />+{entry.coinsAwarded ?? REFERRER_COINS}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        </div>

        {/* Redeem Modal */}
        <AnimatePresence>
          {showRedeem && (
            <RedeemModal
              coins={referral.coins}
              loading={isRedeeming}
              onClose={() => setShowRedeem(false)}
              onConfirm={handleRedeem}
            />
          )}
        </AnimatePresence>
      </div>
    </Container>
  );
}