'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/**
 * @param {{ label: string, value: number, suffix?: string, icon?: React.ComponentType, trend?: number }} props
 */
export default function StatCard({ label, value, suffix = '', icon: Icon, trend }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 600;
    const start = performance.now();
    const from = display;
    let raf;
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(from + (value - from) * progress));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <p className="stat-card-value">
            {display}
            {suffix}
          </p>
          <p className="stat-card-label">{label}</p>
        </div>
        {Icon && (
          <div className="w-9 h-9 rounded-field bg-primary/10 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-primary" />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <p className={`text-xs font-semibold mt-2 ${trend >= 0 ? 'text-success' : 'text-error'}`}>
          {trend >= 0 ? '+' : ''}
          {trend}% vs last period
        </p>
      )}
    </motion.div>
  );
}
