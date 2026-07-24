'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts';
import {
  Star, TrendingUp, Clock, Users, ThumbsUp, ThumbsDown,
  AlertCircle, CheckCircle2, IndianRupee, Activity, Award
} from 'lucide-react';
import {
  getPerformance,
  selectPerformance, selectEarnings, selectLoading,
} from '@/store/slices/careAssistantSlice';
import BackButton from '../../../components/BackButton';

const CARD_VARIANTS = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07 } }),
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl text-xs font-semibold shadow-xl bg-base-200 border border-base-300 text-base-content"
     >
      {payload.map((p, i) => (
        <p key={i}>{p.name}: <span className="text-primary">{p.value}</span></p>
      ))}
    </div>
  );
};

export default function PerformancePage() {
  const dispatch    = useDispatch();
  const performance = useSelector(selectPerformance);
  const earnings    = useSelector(selectEarnings);
  const loading     = useSelector(selectLoading);

  useEffect(() => { dispatch(getPerformance()); }, [dispatch]);

  const p = performance || {};
  const e = earnings    || {};

  /* Radar data */
  const radarData = [
    { metric: 'Rating',       value: ((p.averageRating ?? 5) / 5) * 100 },
    { metric: 'On-Time',      value: p.onTimeArrivalRate ?? 100 },
    { metric: 'Repeat Rate',  value: p.repeatClientRate  ?? 0 },
    { metric: 'Completion',   value: p.totalTasksCompleted ? Math.min(p.totalTasksCompleted / 5, 100) : 0 },
    { metric: 'Satisfaction', value: p.totalRatings ? Math.min((p.complimentsCount / p.totalRatings) * 100, 100) : 0 },
  ];

  /* Bar data */
  const barData = [
    { name: 'Completed', value: p.totalTasksCompleted ?? 0, color: 'var(--success)' },
    { name: 'Cancelled',  value: p.totalTasksCancelled ?? 0, color: 'var(--error)'   },
    { name: 'Monthly',    value: p.monthlyTasks        ?? 0, color: 'var(--primary)' },
    { name: 'Compliments',value: p.complimentsCount    ?? 0, color: 'var(--warning)' },
    { name: 'Complaints', value: p.complaintsCount     ?? 0, color: 'var(--accent)'  },
  ];

  const metricCards = [
    { label: 'Avg. Rating',      value: `${(p.averageRating ?? 5).toFixed(1)} ★`,  icon: Star,         color: 'var(--warning)'   },
    { label: 'Total Reviews',    value: p.totalRatings ?? 0,                         icon: Users,        color: 'var(--info)'      },
    { label: 'Tasks Done',       value: p.totalTasksCompleted ?? 0,                 icon: CheckCircle2, color: 'var(--success)'   },
    { label: 'Cancel Rate',      value: `${p.cancellationRate ?? 0}%`,               icon: AlertCircle,  color: 'var(--error)'     },
    { label: 'On-Time Rate',     value: `${p.onTimeArrivalRate ?? 100}%`,           icon: Clock,        color: 'var(--secondary)' },
    { label: 'Repeat Clients',   value: `${p.repeatClientRate ?? 0}%`,              icon: TrendingUp,   color: 'var(--accent)'    },
    { label: 'Compliments',      value: p.complimentsCount ?? 0,                    icon: ThumbsUp,     color: 'var(--success)'   },
    { label: 'Complaints',       value: p.complaintsCount  ?? 0,                    icon: ThumbsDown,   color: 'var(--error)'     },
  ];

  if (loading.performance && !performance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="px-6 pt-8 pb-4">
                     <BackButton className='my-3' />
          
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-[color-mix(in srgb, var(--primary), transparent 85%)]">
            <Activity size={22} className="text-primary" />
          </div>
          <h1 className="text-2xl font-extrabold font-montserrat text-base-content">
            Performance & Earnings
          </h1>
        </div>
        <p className="text-sm ml-12 text-[color-mix(in oklch, var(--base-content) 55%, transparent)]">
          Your career metrics and payout summary
        </p>
      </motion.div>

      <div className="px-6 pb-10 space-y-6">

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metricCards.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div key={m.label} custom={i} variants={CARD_VARIANTS}
                initial="hidden" animate="visible" className="stat-card">
                <div className="p-2 rounded-xl w-fit mb-3"
                  style={{ background: `color-mix(in srgb, ${m.color}, transparent 88%)` }}>
                  <Icon size={16} style={{ color: m.color }} />
                </div>
                <div className="stat-card-value text-[1.5rem]" style={{ color: m.color }}>{m.value}</div>
                <div className="stat-card-label">{m.label}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Radar */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }} className="card p-5">
            <h3 className="text-sm font-extrabold font-montserrat mb-4 text-base-content">
              Performance Radar
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--base-300)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }} />
                <Radar name="Score" dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.25} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bar */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }} className="card p-5">
            <h3 className="text-sm font-extrabold font-montserrat mb-4 text-base-content">
              Task Breakdown
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData} barSize={28}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'color-mix(in srgb, var(--primary), transparent 92%)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Earnings Summary */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }} className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <IndianRupee size={20} className="text-primary" />
            <h3 className="font-extrabold font-montserrat text-base text-base-content">
              Earnings Snapshot
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Paid Out',       value: `₹${(e.totalPaid ?? 0).toLocaleString('en-IN')}`,    color: 'var(--success)' },
              { label: 'Pending Payout',       value: `₹${(e.pendingPayout ?? 0).toLocaleString('en-IN')}`, color: 'var(--warning)' },
              { label: 'Lifetime Bookings',    value: e.lifetimeBookings ?? 0,                              color: 'var(--primary)' },
              { label: 'Last Payout',          value: e.lastPayoutAt ? new Date(e.lastPayoutAt).toLocaleDateString('en-IN') : '—', color: 'var(--secondary)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-3 rounded-xl"
                style={{ background: `color-mix(in srgb, ${color}, transparent 92%)` }}>
                <p className="text-xl font-extrabold font-montserrat" style={{ color }}>{value}</p>
                <p className="text-xs font-semibold mt-1 text-[color-mix(in oklch, var(--base-content) 55%, transparent)]"
                 >{label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Last Task */}
        {p.lastTaskAt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="card p-4 flex items-center gap-4">
            <Award size={20} className="text-accent" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[color-mix(in oklch, var(--base-content) 45%, transparent)]"
               >Last Task Completed</p>
              <p className="text-sm font-semibold text-base-content">
                {new Date(p.lastTaskAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}