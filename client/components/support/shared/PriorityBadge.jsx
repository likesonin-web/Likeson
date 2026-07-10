import { AlertTriangle, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';
import { TICKET_PRIORITY_LABELS, TICKET_PRIORITY_COLOR } from '../../../features/support/constants/support.constants';

const ICONS = {
  low: ArrowDown,
  medium: ArrowRight,
  high: ArrowUp,
  critical: AlertTriangle,
};

/**
 * @param {{ priority: string, size?: 'xs'|'sm'|'md', pulse?: boolean }} props
 */
export default function PriorityBadge({ priority, size = 'sm', pulse = true }) {
  const color = TICKET_PRIORITY_COLOR[priority] ?? 'primary';
  const label = TICKET_PRIORITY_LABELS[priority] ?? priority;
  const Icon = ICONS[priority] ?? ArrowRight;
  const sizeClass = size === 'xs' ? 'badge-xs' : size === 'md' ? '' : 'badge-sm';
  const shouldPulse = pulse && priority === 'critical';

  return (
    <span className={`badge badge-${color} ${sizeClass} ${shouldPulse ? 'animate-pulse' : ''}`.trim()}>
      <Icon className="w-3 h-3" aria-hidden="true" />
      {label}
    </span>
  );
}
