import { motion } from 'framer-motion';

/**
 * @param {{ names: string[] }} props
 */
export default function TypingIndicator({ names }) {
  if (!names?.length) return null;

  const label = names.length === 1 ? `${names[0]} is typing` : names.length === 2 ? `${names[0]} and ${names[1]} are typing` : `${names.length} people are typing`;

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-base-content/50 italic">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-primary/60"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
      {label}
    </div>
  );
}
