"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/monitoring";

// Last resort: replaces the root layout, so it must render its own <html>.
export default function GlobalError({
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
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. Please try again.</p>
        <button type="button" onClick={reset} style={{ padding: "0.6rem 1.5rem", borderRadius: 999 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
