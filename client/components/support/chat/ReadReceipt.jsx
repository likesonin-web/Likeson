import { Clock, Check, CheckCheck, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * @param {{ status: string }} props
 */
export default function ReadReceipt({ status }) {
  const map = {
    sending: { Icon: Clock, className: 'text-base-content/30' },
    sent: { Icon: Check, className: 'text-base-content/40' },
    delivered: { Icon: CheckCheck, className: 'text-base-content/40' },
    read: { Icon: CheckCheck, className: 'text-primary' },
    failed: { Icon: AlertCircle, className: 'text-error' },
  };
  const { Icon, className } = map[status] ?? map.sent;

  return (
    <motion.span
      key={status}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={`inline-flex ${className}`}
      aria-label={status}
    >
      <Icon className="w-3.5 h-3.5" />
    </motion.span>
  );
}
