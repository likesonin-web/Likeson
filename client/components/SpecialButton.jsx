"use client";

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// ── Lazy-load framer-motion ──────────────────────────────────────────────────
const MotionButton = dynamic(
  () => import('framer-motion').then((m) => ({ default: m.motion.button })),
  { ssr: false, loading: () => <button /> }
);
const MotionSpan = dynamic(
  () => import('framer-motion').then((m) => ({ default: m.motion.span })),
  { ssr: false, loading: () => <span /> }
);

// ── Default theme ─────────────────────────────────────────────────────────────
export const DEFAULT_BUTTON_THEME = {
  accent:      'var(--primary)',
  bg:          'color-mix(in srgb, var(--primary) 8%, transparent)',
  barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
  pillBg:      'color-mix(in srgb, var(--primary) 12%, transparent)',
  pillText:    'var(--primary)',
  shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
  label:       'Action',
  dataTheme:   undefined,
};

// ── ROLE_THEMES ───────────────────────────────────────────────────────────────
export const ROLE_THEMES = {
  superadmin: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Super Admin', dataTheme: 'superadmin',
  },
  admin: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Admin', dataTheme: 'admin',
  },
  doctor: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Doctor', dataTheme: 'doctor',
  },
  hospital: {
    accent: '#1d4ed8',
    bg: 'rgba(29,78,216,0.07)',
    barGradient: 'linear-gradient(90deg,#1d4ed8,#3b82f6)',
    pillBg: 'rgba(29,78,216,0.12)',
    pillText: '#1d4ed8',
    shadowColor: 'rgba(29,78,216,0.28)',
    label: 'Hospital', dataTheme: 'hospital',
  },
  transportpartner: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Transport Partner', dataTheme: 'transportpartner',
  },
  driver: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Driver', dataTheme: 'driver',
  },
  solodriverpartner: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Solo Driver', dataTheme: 'solodriverpartner',
  },
  customer: {
    ...DEFAULT_BUTTON_THEME,
    label: 'Customer', dataTheme: undefined,
  },
  pharmacy: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Pharmacy', dataTheme: 'pharmacy',
  },
  care_assistant: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Care Assistant', dataTheme: 'care-assistant',
  },
  finance: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Finance', dataTheme: 'finance',
  },
  lab_partner: {
    accent: 'var(--primary)', bg: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    barGradient: 'linear-gradient(90deg, var(--primary), var(--secondary))',
    pillBg: 'color-mix(in srgb, var(--primary) 12%, transparent)', pillText: 'var(--primary)',
    shadowColor: 'color-mix(in srgb, var(--primary) 30%, transparent)',
    label: 'Lab Partner', dataTheme: 'lab',
  },
  blood_bank: {
    accent: '#be123c', bg: 'rgba(190,18,60,0.07)',
    barGradient: 'linear-gradient(90deg,#be123c,#f43f5e)',
    pillBg: 'rgba(190,18,60,0.12)', pillText: '#be123c',
    shadowColor: 'rgba(190,18,60,0.28)',
    label: 'Blood Bank', dataTheme: undefined,
  },
};

// ── NAV_THEMES — mirrors Header.jsx CUSTOMER_NAV_LINKS exactly ───────────────
export const NAV_THEMES = {
  pharmacy: {
    accent: '#059669', bg: 'rgba(5,150,105,0.07)',
    barGradient: 'linear-gradient(90deg,#059669,#10b981)',
    pillBg: 'rgba(5,150,105,0.12)', pillText: '#059669',
    shadowColor: 'rgba(5,150,105,0.30)', label: 'Pharmacy',
  },
  doctors: {
    accent: '#2563eb', bg: 'rgba(37,99,235,0.07)',
    barGradient: 'linear-gradient(90deg,#2563eb,#60a5fa)',
    pillBg: 'rgba(37,99,235,0.12)', pillText: '#2563eb',
    shadowColor: 'rgba(37,99,235,0.28)', label: 'Doctors',
  },
  hospitals: {
    accent: '#1d4ed8', bg: 'rgba(29,78,216,0.07)',
    barGradient: 'linear-gradient(90deg,#1d4ed8,#3b82f6)',
    pillBg: 'rgba(29,78,216,0.12)', pillText: '#1d4ed8',
    shadowColor: 'rgba(29,78,216,0.28)', label: 'Hospitals',
  },
  subscriptions: {
    accent: '#d97706', bg: 'rgba(217,119,6,0.07)',
    barGradient: 'linear-gradient(90deg,#d97706,#f59e0b)',
    pillBg: 'rgba(217,119,6,0.12)', pillText: '#b45309',
    shadowColor: 'rgba(217,119,6,0.28)', label: 'Subscriptions',
  },
  labs: {
    accent: '#7c3aed', bg: 'rgba(124,58,237,0.07)',
    barGradient: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
    pillBg: 'rgba(124,58,237,0.12)', pillText: '#7c3aed',
    shadowColor: 'rgba(124,58,237,0.28)', label: 'Labs',
  },
  blood_bank: {
    accent: '#be123c', bg: 'rgba(190,18,60,0.07)',
    barGradient: 'linear-gradient(90deg,#be123c,#f43f5e)',
    pillBg: 'rgba(190,18,60,0.12)', pillText: '#be123c',
    shadowColor: 'rgba(190,18,60,0.28)', label: 'Blood Bank',
  },
};

// ── Size presets ──────────────────────────────────────────────────────────────
const SIZES = {
  sm: 'h-8  px-3   w-full     text-[10px] gap-1.5 rounded-md',
  md: 'h-10 px-4 md:px-6 w-full text-[12px] gap-2   rounded-md',
  lg: 'h-12 px-6 md:px-8 w-full text-[13px] gap-2.5 rounded-lg',
};

// ── Variants that "fill solid" on hover ───────────────────────────────────────
const FILLS_ON_HOVER = new Set(['pill', 'outline', 'soft']);

// ── Variant → rest-state style resolver ───────────────────────────────────────
function resolveVariantStyle(theme, variant) {
  switch (variant) {
    case 'pill':
      return {
        background: theme.pillBg ?? 'color-mix(in srgb, var(--primary) 12%, transparent)',
        color: theme.pillText ?? theme.accent ?? 'var(--primary)',
        border: `1px solid color-mix(in srgb, ${theme.accent ?? 'var(--primary)'} 30%, transparent)`,
        boxShadow: 'none',
      };
    case 'outline':
      return {
        background: 'transparent',
        color: theme.accent ?? 'var(--primary)',
        border: `1.5px solid color-mix(in srgb, ${theme.accent ?? 'var(--primary)'} 45%, transparent)`,
        boxShadow: 'none',
      };
    case 'soft':
      return {
        background: theme.bg ?? 'color-mix(in srgb, var(--primary) 8%, transparent)',
        color: theme.accent ?? 'var(--primary)',
        border: `1px solid color-mix(in srgb, ${theme.accent ?? 'var(--primary)'} 22%, transparent)`,
        boxShadow: 'none',
      };
    case 'ghost':
      return {
        background: 'transparent',
        color: theme.accent ?? 'var(--primary)',
        border: '1.5px solid transparent',
        boxShadow: 'none',
      };
    case 'solid':
    default:
      return {
        background: theme.barGradient ?? 'var(--primary)',
        boxShadow: theme.shadowColor
          ? `0 4px 18px ${theme.shadowColor}`
          : '0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent)',
        color: '#fff',
        border: 'none',
      };
  }
}

// ── Button-level animation presets ────────────────────────────────────────────
const EASE = [0.4, 0, 0.2, 1];
const ANIMATIONS = {
  none:  { hover: {},                      tap: { scale: 0.98 },       transition: { duration: 0.2, ease: EASE } },
  lift:  { hover: { scale: 1.01, y: -1 },  tap: { scale: 0.95 },       transition: { type: 'spring', stiffness: 340, damping: 22 } },
  float: { hover: { y: -3, scale: 1.02 },  tap: { y: 0, scale: 0.97 }, transition: { type: 'spring', stiffness: 300, damping: 20 } },
  press: { hover: { scale: 1.01 },         tap: { scale: 0.9, y: 1 },  transition: { type: 'spring', stiffness: 400, damping: 24 } },
  glow:  { hover: { scale: 1.01 },         tap: { scale: 0.96 },       transition: { duration: 0.3, ease: EASE } },
  pulse: { hover: { scale: [1, 1.01, 1] }, tap: { scale: 0.95 },       transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } },
};

// ── Button text-level animation presets ───────────────────────────────────────
const TEXT_ANIMATIONS = {
  none:      { rest: {},                       hover: {} },
  fade:      { rest: { opacity: 1 },           hover: { opacity: 0.82 } },
  slideUp:   { rest: { y: 0 },                 hover: { y: -2 } },
  scalePop:  { rest: { scale: 1 },             hover: { scale: 1.01 } },
  bounce:    { rest: { y: 0 },                 hover: { y: [0, -3, 0] } },
  tracking:  { rest: { letterSpacing: '0em' }, hover: { letterSpacing: '0.05em' } },
};

function renderLabel(label, textAnimation) {
  if (textAnimation === 'letterStagger' && typeof label === 'string') {
    return (
      <MotionSpan className="inline-flex whitespace-nowrap" variants={{ hover: { transition: { staggerChildren: 0.025 } } }}>
        {label.split('').map((ch, i) => (
          <MotionSpan
            key={i}
            className="inline-block"
            variants={{ rest: { y: 0 }, hover: { y: -3 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
          >
            {ch === ' ' ? '\u00A0' : ch}
          </MotionSpan>
        ))}
      </MotionSpan>
    );
  }

  if (textAnimation === 'shimmer') {
    return (
      <span className="relative inline-block overflow-hidden whitespace-nowrap">
        <span className="relative z-10">{label}</span>
        <MotionSpan
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-[linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.6) 50%, transparent 70%)]"
          style={{ backgroundSize: '200% 100%' }}
          variants={{ rest: { backgroundPosition: '200% 0%' }, hover: { backgroundPosition: '-200% 0%' } }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        />
      </span>
    );
  }

  const preset = TEXT_ANIMATIONS[textAnimation] ?? TEXT_ANIMATIONS.fade;
  return (
    <MotionSpan className="whitespace-nowrap inline-block" variants={preset} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      {label}
    </MotionSpan>
  );
}

// ── href resolver ─────────────────────────────────────────────────────────────
function resolveHref({ href, slug, id }) {
  if (href) return href;
  if (slug) return `/${String(slug).replace(/^\/+/, '')}`;
  if (id) return `#${String(id).replace(/^#/, '')}`;
  return null;
}

/**
 * SpecialButton — role-aware / nav-aware CTA button.
 *
 * `role`          keys ROLE_THEMES  — e.g. 'driver', 'admin', 'superadmin'
 * `nav`           keys NAV_THEMES   — e.g. 'pharmacy', 'doctors', 'labs' (matches Header.jsx CUSTOMER_NAV_LINKS)
 * `mood`          explicit theme object override — takes priority over role/nav
 * `variant`       'solid' | 'pill' | 'outline' | 'soft' | 'ghost'
 * `animation`     'none' | 'lift' | 'float' | 'press' | 'glow' | 'pulse'
 * `textAnimation` 'none' | 'fade' | 'slideUp' | 'scalePop' | 'bounce' | 'tracking' | 'letterStagger' | 'shimmer'
 */
const SpecialButton = ({
  title,
  children,
  icon: Icon,
  iconPosition = 'left',
  role,
  nav,
  mood,
  href,
  slug,
  id,
  target,
  variant = 'solid',
  animation = 'lift',
  textAnimation = 'letterStagger',
  size = 'md',
  fullWidth = false,
  uppercase = true,
  className,
  onClick,
  disabled = false,
  type = 'button',
  as,
  ...rest
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const activeTheme  = mood ?? (nav && NAV_THEMES[nav]) ?? (role && ROLE_THEMES[role]) ?? DEFAULT_BUTTON_THEME;
  const label         = title ?? children ?? activeTheme.label;
  const resolvedHref  = as === 'button' ? null : resolveHref({ href, slug, id });
  const isLink        = as === 'link' || (!!resolvedHref && as !== 'button');

  const restStyle     = resolveVariantStyle(activeTheme, variant);
  const fillsOnHover   = FILLS_ON_HOVER.has(variant);
  const motionPreset  = ANIMATIONS[animation] ?? ANIMATIONS.lift;

  const hoverColorStyle = fillsOnHover
    ? {
        color: '#fff',
        border: 'none',
        boxShadow: activeTheme.shadowColor
          ? `0 4px 18px ${activeTheme.shadowColor}`
          : '0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent)',
      }
    : variant === 'ghost'
    ? {
        background: activeTheme.bg ?? 'color-mix(in srgb, var(--primary) 8%, transparent)',
      }
    : {};

  const buttonStyle = {
    ...restStyle,
    ...(isHovered && !disabled ? hoverColorStyle : {}),
    position: 'relative',
    overflow: 'hidden',
    transition: 'color 0.3s ease, border-color 0.3s ease, box-shadow 0.35s ease, background 0.3s ease',
  };

  const classes = cn(
    'inline-flex items-center justify-center font-black tracking-wide',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    'disabled:opacity-50 disabled:pointer-events-none',
    uppercase && 'uppercase',
    fullWidth && 'w-full',
    SIZES[size] ?? SIZES.md,
    className
  );

  const content = (
    <>
      {Icon && iconPosition === 'left' && (
        <Icon className="w-4 h-4 flex-shrink-0 relative z-10" aria-hidden="true" />
      )}
      {label && renderLabel(label, textAnimation)}
      {Icon && iconPosition === 'right' && (
        <Icon className="w-4 h-4 flex-shrink-0 relative z-10" aria-hidden="true" />
      )}
    </>
  );

  const buttonEl = (
    <MotionButton
      type={isLink ? undefined : type}
      data-theme={activeTheme?.dataTheme}
      initial="rest"
      animate="rest"
      whileHover={disabled ? undefined : 'hover'}
      whileTap={disabled ? undefined : 'tap'}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      variants={{ rest: {}, hover: motionPreset.hover, tap: motionPreset.tap }}
      transition={motionPreset.transition}
      disabled={disabled}
      onClick={onClick}
      className={classes}
      style={buttonStyle}
      aria-disabled={disabled || undefined}
      {...rest}
    >
      {fillsOnHover && (
        <MotionSpan
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ background: activeTheme.barGradient ?? 'var(--primary)' }}
          variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
          transition={{ duration: 0.3, ease: EASE }}
        />
      )}
      <span className="relative z-10 flex w-full items-center justify-center gap-2">
        {content}
      </span>
    </MotionButton>
  );

  if (isLink) {
    return (
      <Link
        href={resolvedHref}
        target={target}
        data-theme={activeTheme?.dataTheme}
        aria-label={typeof label === 'string' ? label : undefined}
        className={cn(fullWidth && 'w-full block', disabled && 'pointer-events-none opacity-50')}
      >
        {buttonEl}
      </Link>
    );
  }

  return buttonEl;
};

export default SpecialButton;