"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to your monitoring service here if one is wired up (Sentry, etc.)
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-base-100 px-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-error" aria-hidden="true" />
        </div>

        <h1 className="font-montserrat text-2xl md:text-3xl font-black text-base-content mb-3 tracking-tight">
          Something Went Wrong
        </h1>
        <p className="font-poppins text-base-content/60 text-sm mb-2 leading-relaxed">
          An unexpected error occurred while loading this page. Our team has been notified.
        </p>
        {error.digest && (
          <p className="font-mono text-[11px] text-base-content/40 mb-8">
            Error ref: {error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center mt-6">
          <button
            onClick={reset}
            className="btn-primary-cta w-full sm:w-auto h-12 px-6 font-poppins text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
          <Link href="/" className="w-full sm:w-auto">
            <button className="btn btn-outline w-full sm:w-auto h-12 px-6 font-poppins font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
              <Home className="w-4 h-4" aria-hidden="true" />
              Return Home
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
}
