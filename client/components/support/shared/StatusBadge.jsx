import { motion } from 'framer-motion';
import { TICKET_STATUS_LABELS, TICKET_STATUS_COLOR } from '../../../features/support/constants/support.constants';

/**
 * @param {{ status: string, size?: 'xs'|'sm'|'md' }} props
 */
export default function StatusBadge({ status, size = 'sm' }) {
  const color = TICKET_STATUS_COLOR[status] ?? 'primary';
  const label = TICKET_STATUS_LABELS[status] ?? status;
  const sizeClass = size === 'xs' ? 'badge-xs' : size === 'md' ? '' : 'badge-sm';

  return (
    <motion.span
      key={status}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.18 }}
      className={`badge badge-${color} ${sizeClass}`.trim()}
    >
      <span className={`status-dot status-dot-${color === 'primary' ? 'info' : color}`} />
      {label}
    </motion.span>
  );
}
