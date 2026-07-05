'use client';
// path: components/ui/StatCard.jsx
import { motion } from 'framer-motion';

export default function StatCard({ label, value, icon: Icon, trend, trendLabel, delay = 0 }) {
  const trendPositive = typeof trend === 'number' && trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      className="stat-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="stat-card-value">{value}</div>
          <div className="stat-card-label">{label}</div>
        </div>
        {Icon && (
          <div className="bg-primary/10 text-primary rounded-box p-2.5">
            <Icon className="w-5 h-5" strokeWidth={2} />
          </div>
        )}
      </div>
      {typeof trend === 'number' && (
        <div className={`text-xs font-semibold mt-3 ${trendPositive ? 'text-success' : 'text-error'}`}>
          {trendPositive ? '+' : ''}{trend}% {trendLabel || ''}
        </div>
      )}
    </motion.div>
  );
}
