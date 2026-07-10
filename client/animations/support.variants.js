// animations/support.variants.js
//
// Centralized Framer Motion variants so animation feel stays consistent
// across the module instead of each component inventing its own timing.

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.22, ease: 'easeOut' },
};

export const listContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export const listItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.2 },
};

export const modalOverlay = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18 },
};

export const modalContent = {
  initial: { opacity: 0, scale: 0.96, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 8 },
  transition: { duration: 0.2, ease: 'easeOut' },
};

export const drawerSlide = {
  initial: { x: '-100%' },
  animate: { x: 0 },
  exit: { x: '-100%' },
  transition: { type: 'spring', damping: 28, stiffness: 300 },
};

export const fadeScale = {
  initial: { opacity: 0, scale: 0.85 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.18 },
};

export const cardHover = {
  whileHover: { y: -2 },
  transition: { duration: 0.15 },
};

export const notificationSlide = {
  initial: { opacity: 0, y: -12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.98 },
  transition: { duration: 0.16 },
};

export const typingDot = (delay) => ({
  animate: { y: [0, -3, 0] },
  transition: { duration: 0.6, repeat: Infinity, delay },
});
