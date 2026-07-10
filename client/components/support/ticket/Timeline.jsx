'use client';

import { motion } from 'framer-motion';
import dayjs from 'dayjs';
import {
  PlusCircle,
  UserPlus,
  ArrowRightLeft,
  MessageSquare,
  Pencil,
  RefreshCcw,
  Flag,
  LogIn,
  LogOut,
  CheckCircle2,
  RotateCcw,
  CheckCheck,
  AlertTriangle,
} from 'lucide-react';
import { TIMELINE_EVENT_LABELS } from '../../../features/support/constants/support.constants';

const ICONS = {
  created: PlusCircle,
  assigned: UserPlus,
  transferred: ArrowRightLeft,
  message: MessageSquare,
  edited: Pencil,
  status_changed: RefreshCcw,
  priority_changed: Flag,
  participant_joined: LogIn,
  participant_left: LogOut,
  closed: CheckCircle2,
  reopened: RotateCcw,
  resolved: CheckCheck,
  escalated: AlertTriangle,
};

const COLOR = {
  created: 'primary',
  resolved: 'success',
  closed: 'secondary',
  escalated: 'error',
  reopened: 'warning',
};

function groupByDate(entries) {
  const groups = {};
  entries.forEach((e) => {
    const key = dayjs(e.createdAt).format('MMM D, YYYY');
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });
  return groups;
}

/**
 * @param {{ entries: Array<object> }} props
 */
export default function Timeline({ entries }) {
  if (!entries?.length) {
    return <p className="text-sm text-base-content/50 text-center py-8">No activity yet.</p>;
  }

  const grouped = groupByDate(entries);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, items]) => (
        <div key={date}>
          <p className="text-xs font-bold uppercase tracking-wider text-base-content/40 mb-3">{date}</p>
          <ol className="space-y-4 border-l-2 border-base-300 pl-4 ml-1.5">
            {items.map((entry, i) => {
              const Icon = ICONS[entry.event] ?? MessageSquare;
              const color = COLOR[entry.event] ?? 'primary';
              return (
                <motion.li
                  key={entry._id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                  className="relative"
                >
                  <span
                    className={`absolute -left-[1.65rem] top-0.5 w-6 h-6 rounded-full flex items-center justify-center bg-${color}/10`}
                  >
                    <Icon className={`w-3.5 h-3.5 text-${color}`} aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold">{TIMELINE_EVENT_LABELS[entry.event] ?? entry.event}</p>
                  {entry.summary && <p className="text-sm text-base-content/60 mt-0.5">{entry.summary}</p>}
                  <p className="text-xs text-base-content/40 mt-0.5">
                    {entry.actor?.name && `${entry.actor.name} · `}
                    {dayjs(entry.createdAt).format('h:mm A')}
                  </p>
                </motion.li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
