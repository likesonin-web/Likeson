'use client';

import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
  Heart, Shield, Stethoscope, Car, FlaskConical,
  Pill, UserCheck, Zap, Globe, Award, ArrowRight,
  Users, Star, TrendingUp, CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

// ── Animation helpers ─────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.11 } } };

function InViewSection({ children, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div
      ref={ref}
      variants={stagger}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────
const PILLARS = [
  { icon: Stethoscope, label: 'Doctor Consultations', color: 'var(--primary)', desc: 'In-person, video & home visits with verified specialists.' },
  { icon: Car,         label: 'Medical Transport',    color: 'var(--secondary)', desc: 'GPS-tracked rides, wheelchair vans & mortuary support.' },
  { icon: FlaskConical,label: 'Diagnostics',          color: 'oklch(55% 0.22 275)', desc: 'NABL-accredited labs with home sample collection.' },
  { icon: Pill,        label: 'Pharmacy',             color: 'oklch(50% 0.20 155)', desc: 'Express delivery from verified partner stores.' },
  { icon: UserCheck,   label: 'Care Assistants',      color: 'oklch(58% 0.18 300)', desc: 'Trained in-home aides for post-surgery & elder care.' },
  { icon: Heart,       label: 'Hospital Network',     color: 'oklch(60% 0.22 22)', desc: 'Multi-specialty hospitals & clinics across the city.' },
];

const STATS = [
  { value: '50K+', label: 'Patients Served',   icon: Users },
  { value: '98%',  label: 'Satisfaction Rate', icon: Star },
  { value: '200+', label: 'Partner Doctors',   icon: Stethoscope },
  { value: '24/7', label: 'Always Available',  icon: Zap },
];

const VALUES = [
  { icon: Shield,    title: 'Trust First',      body: 'Every partner undergoes KYC, police verification, and medical council validation before joining the platform.' },
  { icon: Globe,     title: 'Accessible Care',  body: 'Healthcare should reach every corner of the city—affordable, transparent pricing with no hidden fees.' },
  { icon: Award,     title: 'Quality Assured',  body: 'NABL-accredited labs, verified doctors, and GPS-monitored vehicles set the standard for care delivery.' },
  { icon: TrendingUp,title: 'Data-Driven',      body: 'Real-time performance metrics, patient feedback loops, and audit trails drive continuous improvement.' },
];

const TEAM = [
  { name: 'Ravi Kiran M.', role: 'Co-founder & CEO', initials: 'RK', hue: 240 },
  { name: 'Priya Anand',   role: 'Co-founder & COO', initials: 'PA', hue: 300 },
  { name: 'Suresh Babu',   role: 'Head of Medical',  initials: 'SB', hue: 155 },
  { name: 'Meena Devi',    role: 'Head of Tech',     initials: 'MD', hue: 50  },
];

// ── Components ────────────────────────────────────────────────────────────────

function HeroParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full opacity-35"
          style={{ width: Math.random() * 6 + 3, height: Math.random() * 6 + 3, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, background: `oklch(${60 + Math.random() * 20}% 0.18 ${180 + i * 18})` }}
          animate={{ y: [0, -24, 0], opacity: [0.35, 0.7, 0.35] }}
          transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: i * 0.3 }}
        />
      ))}
    </div>
  );
}

function PillarCard({ icon: Icon, label, color, desc, index }) {
  return (
    <motion.div variants={fadeUp} custom={index}>
      <div
        className="group relative glass-card p-6 h-full cursor-default select-none"
        style={{ '--card-color': color }}
      >
        {/* glow blob */}
        <div
          className="absolute -top-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"
          style={{ background: color }}
        />
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
          style={{ background: `color-mix(in srgb, ${color}, transparent 82%)`, border: `1px solid color-mix(in srgb, ${color}, transparent 55%)` }}
        >
          <Icon size={22} style={{ color }} />
        </div>
        <h3 className="font-montserrat font-extrabold text-base text-base-content mb-1">{label}</h3>
        <p className="text-xs leading-relaxed text-[color-mix(in oklch, var(--base-content) 65%, transparent)]">{desc}</p>
        <div
          className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-500 rounded-b-[inherit]"
          style={{ background: color }}
        />
      </div>
    </motion.div>
  );
}

function StatBubble({ value, label, icon: Icon, index }) {
  return (
    <motion.div variants={fadeUp} custom={index} className="text-center">
      <div className="stat-card flex flex-col items-center gap-2 p-6">
        <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1 bg-[color-mix(in srgb, var(--primary), transparent 85%)]"
         >
          <Icon size={18} className="text-primary" />
        </div>
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
      </div>
    </motion.div>
  );
}

function ValueCard({ icon: Icon, title, body, index }) {
  return (
    <motion.div variants={fadeUp} custom={index}>
      <div className="card p-6 h-full">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4 bg-[color-mix(in srgb, var(--primary), transparent 88%)] border border-[color-mix(in srgb, var(--primary), transparent 65%)]"
         >
          <Icon size={18} className="text-primary" />
        </div>
        <h4 className="font-montserrat font-black text-base text-base-content mb-2">{title}</h4>
        <p className="text-sm leading-relaxed text-[color-mix(in oklch, var(--base-content) 68%, transparent)]">{body}</p>
      </div>
    </motion.div>
  );
}

function TeamCard({ name, role, initials, hue, index }) {
  return (
    <motion.div variants={fadeUp} custom={index}>
      <div className="card p-6 text-center group">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 font-montserrat font-black text-lg transition-transform duration-300 group-hover:scale-110 text-[#fff]"
          style={{ background: `oklch(55% 0.18 ${hue})`, boxShadow: `0 6px 20px oklch(55% 0.18 ${hue} / 35%)` }}
        >
          {initials}
        </div>
        <p className="font-montserrat font-extrabold text-sm text-base-content">{name}</p>
        <p className="text-xs mt-0.5 text-[color-mix(in oklch, var(--base-content) 60%, transparent)]">{role}</p>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AboutPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY   = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpa = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <main className="min-h-screen bg-base-100 overflow-x-hidden">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative min-h-[88vh] flex items-center justify-center overflow-hidden bg-[linear-gradient(160deg, var(--primary) 0%, color-mix(in srgb, var(--secondary) 80%, var(--primary)) 100%)]"
       
      >
        <HeroParticles />

        {/* diagonal shape */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-base-100"
          style={{ clipPath: 'polygon(0 60%, 100% 0, 100% 100%, 0 100%)' }} />

        <motion.div
          style={{ y: heroY, opacity: heroOpa }}
          className="relative z-10 text-center px-4 max-w-4xl mx-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-xs font-bold uppercase tracking-widest bg-white/15 border border-[rgba(255,255,255,0.3)] text-[#fff]"
           
          >
            <Heart size={12} fill="currentColor" /> Vijayawada&apos;s Healthcare Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-montserrat font-black text-white leading-[1.05] mb-6 text-[clamp(2.5rem, 7vw, 5rem)]"
           
          >
            Healthcare,
            <br />
            <span className="text-accent">Reimagined</span>
            <br />
            for Everyone.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.25 }}
            className="text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed text-[rgba(255,255,255,0.82)]"
           
          >
            Likeson.in connects patients with verified doctors, labs, pharmacies,
            care assistants, and medical transport — all in one trusted platform
            built for Vijayawada and beyond.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.38 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <Link href="/services">
              <span className="btn-primary-cta bg-[#fff] text-primary">
                Explore Services <ArrowRight size={14} className="inline ml-1" />
              </span>
            </Link>
            <Link href="/contact">
              <span className="btn-secondary text-[#fff]" style={{ borderColor: 'rgba(255,255,255,0.6)' }}>
                Partner with Us
              </span>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────────────── */}
      <section className="container-custom py-16">
        <InViewSection className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s, i) => <StatBubble key={s.label} {...s} index={i} />)}
        </InViewSection>
      </section>

      {/* ── MISSION ────────────────────────────────────────────────────── */}
      <section className="container-custom py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <InViewSection>
            <motion.div variants={fadeUp} custom={0}>
              <span className="badge badge-primary mb-4">Our Mission</span>
              <h2 className="font-montserrat font-black text-base-content leading-tight mb-5 text-[clamp(1.8rem, 4vw, 3rem)]"
               >
                Bringing the Best Care<br />
                <span className="text-gradient-primary">Closer to Home</span>
              </h2>
              <p className="text-base leading-relaxed mb-5 text-[color-mix(in oklch, var(--base-content) 70%, transparent)]"
               >
                Founded in Vijayawada, Likeson.in was built on a simple belief: quality
                healthcare shouldn&apos;t require a waiting room or a long commute. Our platform
                aggregates every layer of care — consultation, transport, diagnostics, pharmacy,
                and in-home assistance — into a single, seamless experience.
              </p>
              <p className="text-base leading-relaxed text-[color-mix(in oklch, var(--base-content) 70%, transparent)]"
               >
                Every partner on our platform is verified, every price is transparent,
                and every interaction is logged for accountability. That&apos;s not just a
                promise — it&apos;s enforced by our technology.
              </p>
            </motion.div>
          </InViewSection>

          {/* decorative grid */}
          <InViewSection className="relative">
            <motion.div variants={fadeUp} custom={0}
              className="grid grid-cols-2 gap-3 relative z-10">
              {[
                { label: 'KYC Verified', sub: 'All partners',           hue: 240 },
                { label: 'NABL Labs',    sub: 'Accredited diagnostics', hue: 155 },
                { label: 'GPS Tracked',  sub: 'Every vehicle',          hue: 50  },
                { label: 'Coin Rewards', sub: 'Loyalty program',        hue: 300 },
              ].map(({ label, sub, hue }, i) => (
                <motion.div
                  key={label}
                  variants={fadeUp}
                  custom={i}
                  className="card p-5 flex flex-col gap-1"
                >
                  <CheckCircle2 size={18} style={{ color: `oklch(55% 0.18 ${hue})` }} />
                  <p className="font-montserrat font-black text-sm text-base-content">{label}</p>
                  <p className="text-xs text-[color-mix(in oklch, var(--base-content) 60%, transparent)]">{sub}</p>
                </motion.div>
              ))}
            </motion.div>
            {/* bg blob */}
            <div className="absolute -top-10 -right-10 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none bg-primary"
              />
          </InViewSection>
        </div>
      </section>

      {/* ── PILLARS ────────────────────────────────────────────────────── */}
      <section className="py-20 bg-base-200">
        <div className="container-custom">
          <InViewSection className="text-center mb-12">
            <motion.div variants={fadeUp} custom={0}>
              <span className="badge badge-primary mb-3">Platform Services</span>
              <h2 className="font-montserrat font-black text-base-content mb-3 text-[clamp(1.6rem, 3.5vw, 2.6rem)]"
               >
                Six Pillars of Care
              </h2>
              <p className="section-subheading max-w-md mx-auto">
                End-to-end healthcare across every dimension that matters.
              </p>
            </motion.div>
          </InViewSection>
          <InViewSection className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PILLARS.map((p, i) => <PillarCard key={p.label} {...p} index={i} />)}
          </InViewSection>
        </div>
      </section>

      {/* ── VALUES ─────────────────────────────────────────────────────── */}
      <section className="container-custom py-20">
        <InViewSection className="text-center mb-12">
          <motion.div variants={fadeUp} custom={0}>
            <span className="badge badge-primary mb-3">Core Values</span>
            <h2 className="font-montserrat font-black text-base-content text-[clamp(1.6rem, 3.5vw, 2.6rem)]"
             >
              What Drives Everything We Do
            </h2>
          </motion.div>
        </InViewSection>
        <InViewSection className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {VALUES.map((v, i) => <ValueCard key={v.title} {...v} index={i} />)}
        </InViewSection>
      </section>

      {/* ── TEAM ───────────────────────────────────────────────────────── */}
      <section className="py-20 bg-base-200">
        <div className="container-custom">
          <InViewSection className="text-center mb-12">
            <motion.div variants={fadeUp} custom={0}>
              <span className="badge badge-primary mb-3">Leadership</span>
              <h2 className="font-montserrat font-black text-base-content text-[clamp(1.6rem, 3.5vw, 2.6rem)]"
               >
                The Team Behind Likeson
              </h2>
            </motion.div>
          </InViewSection>
          <InViewSection className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-2xl mx-auto">
            {TEAM.map((t, i) => <TeamCard key={t.name} {...t} index={i} />)}
          </InViewSection>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="container-custom py-20">
        <InViewSection>
          <motion.div
            variants={fadeUp}
            custom={0}
            className="relative rounded-3xl overflow-hidden p-10 md:p-16 text-center bg-[linear-gradient(135deg, var(--primary), var(--secondary))]"
           
          >
            <HeroParticles />
            <div className="relative z-10">
              <h2 className="font-montserrat font-black text-white mb-4 text-[clamp(1.8rem, 4vw, 3rem)]"
               >
                Ready to Experience Better Healthcare?
              </h2>
              <p className="mb-8 max-w-md mx-auto text-base text-[rgba(255,255,255,0.82)]"
               >
                Join thousands of patients and partners building a healthier Vijayawada together.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/register">
                  <span className="btn-primary-cta bg-[#fff] text-primary">
                    Get Started Free
                  </span>
                </Link>
                <Link href="/legal/terms">
                  <span className="btn-secondary text-[#fff]" style={{ borderColor: 'rgba(255,255,255,0.5)' }}>
                    Read Our Terms
                  </span>
                </Link>
              </div>
            </div>
          </motion.div>
        </InViewSection>
      </section>

    </main>
  );
}