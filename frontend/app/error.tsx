"use client";

import Link from "next/link";
import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error);
  }, [error]);

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-20 text-center">
      <div className="max-w-md">
        <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-black">
          Something went wrong
        </h1>
        <p className="mt-3 text-base text-muted">
          An unexpected error occurred. You can try again, or head back to the home page.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted">Reference: {error.digest}</p>
        )}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-coral text-white font-semibold px-6 py-2.5 rounded-full text-sm hover:bg-coral-deep transition-colors"
          >
            Try again
          </button>
          <Link href="/" className="text-sm font-semibold text-coral underline">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
