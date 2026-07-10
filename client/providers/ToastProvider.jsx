'use client';

import { Toaster } from 'react-hot-toast';

/**
 * NOTE: per "reuse existing toast system", if the host app already mounts
 * a <Toaster /> at its root layout, DO NOT mount a second one here — every
 * toast.success()/toast.error() call in this module will render through
 * whichever Toaster is already in the tree. This component exists only as
 * a complete fallback for standalone testing of the support module.
 */
export default function ToastProvider({ children }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--base-100)',
            color: 'var(--base-content)',
            border: '1px solid var(--base-300)',
            borderRadius: 'var(--r-field)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-family-poppins)',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--success-content)' } },
          error: { iconTheme: { primary: 'var(--error)', secondary: 'var(--error-content)' } },
        }}
      />
    </>
  );
}
