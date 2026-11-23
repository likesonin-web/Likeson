"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView, animate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Activity, MapPin, ShieldCheck, Star, LucideIcon } from "lucide-react";

export interface StatItem {
  label: string;
  val: number;
  suffix: string;
  sub: string;
  icon: LucideIcon;
}

export interface StatCardProps {
  stat: StatItem;
  index: number;
}

const STATS: StatItem[] = [
  { label: "Verified Doctors", val: 250, suffix: "+", sub: "Available Daily", icon: Activity },
  { label: "Areas Covered", val: 42, suffix: "", sub: "Across Vijayawada", icon: MapPin },
  { label: "Service Uptime", val: 99.9, suffix: "%", sub: "Always Online", icon: ShieldCheck },
  { label: "Trust Score", val: 4.9, suffix: "/5", sub: "Patient Reviews", icon: Star },
];

const MasterStats: React.FC = () => {
  return (
    <footer className="pt-10 border-t border-base-200">
      <div className="relative group">
        {/* Layered Ambient Glow */}
        <div className="absolute -inset-10 bg-primary/5 rounded-[var(--r-box)] blur-[120px] opacity-50" />
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 rounded-[var(--r-box)] blur-xl opacity-0 group-hover:opacity-100 transition duration-1000" />
        
        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 divide-x divide-y lg:divide-y-0 divide-base-200 bg-base-100/40 backdrop-blur-2xl rounded-[var(--r-box)] border border-base-300 overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.15)]">
          {/* Advanced Shimmer Sweep */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div 
              initial={{ x: "-150%" }}
              animate={{ x: "250%" }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", repeatDelay: 2 }}
              className="w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-20"
            />
          </div>

          {STATS.map((stat, i) => (
            <StatCard key={i} stat={stat} index={i} />
          ))}
        </div>
      </div>
    </footer>
  );
};

const StatCard: React.FC<StatCardProps> = ({ stat, index }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [displayVal, setDisplayVal] = useState<string>("0");
  
  // --- 3D Tilt Logic ---
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    if (isInView) {
      const controls = animate(0, stat.val, {
        duration: 3,
        ease: [0.19, 1, 0.22, 1],
        onUpdate: (v: number) => setDisplayVal(v.toFixed(stat.val % 1 === 0 ? 0 : 1)),
      });
      return () => controls.stop();
    }
  }, [isInView, stat.val]);

  const Icon = stat.icon;

  return (
    <motion.div 
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className="relative p-10 lg:p-14 flex flex-col items-center lg:items-start group/item transition-all duration-500 hover:bg-white/[0.03]"
    >
      {/* Perspective Layer 1: The Icon */}
      <motion.div 
        style={{ translateZ: "50px" }}
        className="mb-8 p-3 rounded-xl bg-primary/5 text-primary/40 group-hover/item:text-primary group-hover/item:bg-primary/10 transition-all duration-500"
      >
        <Icon size={24} strokeWidth={1.5} />
      </motion.div>

      {/* Perspective Layer 2: The Numbers */}
      <div style={{ transform: "translateZ(30px)" }} className="flex flex-col gap-1 relative z-10">
        <div className="flex items-baseline gap-1">
          <span className="text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-base-content via-base-content to-primary/50">
            {displayVal}
          </span>
          <span className="text-2xl font-black text-primary group-hover/item:scale-110 transition-transform duration-500">
            {stat.suffix}
          </span>
        </div>
        
        <div className="flex flex-col mt-4">
          <span className="text-sm font-black uppercase tracking-[0.3em] text-base-content/80">
            {stat.label}
          </span>
          <span className="text-xs font-bold text-base-content/30 mt-2 group-hover/item:text-primary/60 transition-colors duration-500">
            {stat.sub}
          </span>
        </div>
      </div>

      {/* Perspective Layer 3: The Footer Bar */}
      <div className="absolute bottom-0 left-0 h-[1px] w-full bg-base-200 overflow-hidden">
        <motion.div 
          initial={{ x: "-100%" }}
          whileInView={{ x: "0%" }}
          transition={{ duration: 1.5, delay: index * 0.2 }}
          className="h-full w-full bg-gradient-to-r from-primary to-secondary"
        />
      </div>

      {/* Spotlight Effect that follows mouse */}
      <motion.div 
        className="pointer-events-none absolute inset-0 opacity-0 group-hover/item:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(600px circle at var(--x) var(--y), rgba(var(--primary-rgb), 0.05), transparent 40%)`
        }}
      />
    </motion.div>
  );
};

export default MasterStats;
