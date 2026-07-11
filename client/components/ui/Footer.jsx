'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import { Mail, Phone, MapPin, ShieldCheck } from 'lucide-react';
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from 'react-icons/fa6';

// ── Role → data-theme mapping ─────────────────────────────────────────────────
const ROLE_THEME_MAP = {
  doctor:            'doctor',
  hospital:          'hospital',
  'care_assistant':  'care-assistant',
  transportpartner:  'transport',
  solodriverpartner: 'transport',
  driver:            'transport',
  pharmacy:          'pharmacy',
  'lab_partner':     'lab',
  customer:          null,
  superadmin:        null,
  admin:             null,
  finance:           null,
};

// ── Role-specific footer link sets (Kept Intact) ──────────────────────────────
const ROLE_FOOTER_CONFIG = {
  doctor: {
    label: 'Doctor Portal',
    services: [
      { name: 'My Consultations',   href: '/doctor/consultations' },
      { name: 'Patient Records',    href: '/doctor/patients' },
      { name: 'Schedule',           href: '/doctor/schedule' },
      { name: 'Earnings',           href: '/doctor/earnings' },
    ],
    company: [
      { name: 'About Likeson',      href: '/about' },
      { name: 'Medical Guidelines', href: '/guidelines' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Centre',        href: '/help' },
      { name: 'Raise a Ticket',     href: '/support/ticket' },
      { name: 'Partner With Us',    href: '/partner' },
      { name: 'Contact Support',    href: '/contact' },
    ],
  },
  default: {
    label: 'Healthcare Platform',
    services: [
      { name: 'Consultations',      href: '/consultations' },
      { name: 'Diagnostics',        href: '/diagnostics' },
      { name: 'Pharmacy',           href: '/pharmacy' },
      { name: 'Transportation',     href: '/transport' },
    ],
    company: [
      { name: 'About Us',           href: '/about' },
      { name: 'Contact Support',    href: '/support' },
      { name: 'Privacy Policy',     href: '/privacy' },
      { name: 'Terms of Service',   href: '/terms' },
    ],
    support: [
      { name: 'Help Center',        href: '/help' },
      { name: 'Partner with Us',    href: '/partner' },
      { name: 'Health Blog',        href: '/blog' },
      { name: 'Emergency Care',     href: '/emergency' },
    ],
  },
};

const SOCIAL_LINKS = [
  { icon: FaFacebook,  href: '#', label: 'Follow us on Facebook' },
  { icon: FaTwitter,   href: '#', label: 'Follow us on Twitter' },
  { icon: FaInstagram, href: '#', label: 'Follow us on Instagram' },
  { icon: FaLinkedin,  href: '#', label: 'Follow us on LinkedIn' },
];

// ── Footer Component ───────────────────────────────────────────────────────────
const Footer = () => {
  const currentYear = new Date().getFullYear();
  const pathname = usePathname() || '';

  const user = useSelector((s) => s.user?.user) ?? null;

  const isHidden = useMemo(() => {
    return (
      (pathname.startsWith('/rides/') && pathname.endsWith('/tracking')) ||
      pathname.startsWith('/driver/tracking') ||
      pathname.includes('/tracking') || pathname.includes('/chat')
    );
  }, [pathname]);

  const role = user?.role ?? null;
  const themeAttr = role ? (ROLE_THEME_MAP[role] ?? null) : null;
  const config = (role && ROLE_FOOTER_CONFIG[role]) ? ROLE_FOOTER_CONFIG[role] : ROLE_FOOTER_CONFIG.default;

  if (isHidden) return null;

  return (
    <footer
      {...(themeAttr ? { 'data-theme': themeAttr } : {})}
      className="bg-base-200 text-base-content border-t border-base-300 transition-colors duration-300"
    >
      {/* ── Main Footer Content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          
          {/* Brand & Mission */}
          <div className="space-y-6 lg:col-span-1">
            <Link href="/" className="inline-block" aria-label="Likeson Homepage">
              <h2 className="text-3xl font-bold tracking-tight text-base-content">
                Likeson<span className="text-primary">.in</span>
              </h2>
            </Link>
            <p className="text-sm text-base-content/70 leading-relaxed">
              Bridging the healthcare gap by delivering essential non-emergency services through modern technology and compassionate on-demand support.
            </p>
            <div className="flex items-center gap-4 pt-2">
              {SOCIAL_LINKS.map(({ icon: Icon, href, label }, i) => (
                <Link
                  key={i}
                  href={href}
                  aria-label={label}
                  className="text-base-content/50 hover:text-primary transition-colors duration-200"
                >
                  <Icon size={20} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          {/* Services Links */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-base-content uppercase mb-5">
              Services
            </h3>
            <ul className="space-y-3">
              {config.services.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-base-content/70 hover:text-primary transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-base-content uppercase mb-5">
              Company
            </h3>
            <ul className="space-y-3">
              {config.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-sm text-base-content/70 hover:text-primary transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-base-content uppercase mb-5">
              Direct Contact
            </h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm text-base-content/80 leading-relaxed">
                  Vijayawada & Amaravathi,<br />
                  Andhra Pradesh, India
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="text-primary shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-base-content/90">+91 73822 08249</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-primary shrink-0" aria-hidden="true" />
                <a
                  href="mailto:Info@likeson.in"
                  className="text-sm text-primary hover:underline underline-offset-4 transition-colors"
                >
                  Info@likeson.in
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Bottom Legal & Status Bar ── */}
      <div className="border-t border-base-300 bg-base-100/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-success/10 rounded-full border border-success/20">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" aria-hidden="true" />
              <span className="text-xs font-semibold text-success uppercase tracking-wide">System Operational</span>
            </div>
            <p className="text-sm text-base-content/60" suppressHydrationWarning>
              © {currentYear} Likeson Healthcare.
            </p>
          </div>

          <div className="flex flex-wrap justify-center items-center gap-6">
            <Link href="/privacy" className="text-sm text-base-content/60 hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-base-content/60 hover:text-primary transition-colors">
              Terms of Service
            </Link>
            <div className="flex items-center gap-1.5 opacity-70">
              <ShieldCheck size={16} className="text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-base-content">ISO 27001</span>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;