import { motion } from 'framer-motion';
import { Inbox, AlertCircle, SearchX, WifiOff } from 'lucide-react';

const ICONS = {
  inbox: Inbox,
  search: SearchX,
  offline: WifiOff,
};

/**
 * @param {{ icon?: 'inbox'|'search'|'offline', title: string, description?: string, action?: {label: string, onClick: () => void} }} props
 */
export function EmptyState({ icon = 'inbox', title, description, action }) {
  const Icon = ICONS[icon] ?? Inbox;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center text-center py-16 px-6"
    >
      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {description && <p className="text-sm text-base-content/60 max-w-sm">{description}</p>}
      {action && (
        <button type="button" onClick={action.onClick} className="btn btn-primary mt-5">
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

/**
 * @param {{ title?: string, description?: string, onRetry?: () => void }} props
 */
export function ErrorState({ title = 'Something went wrong', description, onRetry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center justify-center text-center py-16 px-6"
    >
      <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-error" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      {description && <p className="text-sm text-base-content/60 max-w-sm">{description}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-outline mt-5">
          Try again
        </button>
      )}
    </motion.div>
  );
}

export function OfflineBanner() {
  return (
    <div className="alert alert-warning" role="status">
      <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="text-sm font-semibold">You&apos;re offline. Reconnecting automatically…</span>
    </div>
  );
}
