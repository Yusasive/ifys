import { Suspense } from "react";
import { ConfirmationClient } from "./confirmation-client";

export const dynamic = "force-dynamic";

export default function ConfirmationPage() {
  return (
    <main className="bg-islamic-pattern text-emerald flex-1 flex flex-col items-center px-4 py-12 sm:py-20">
      <div className="w-full max-w-2xl">
        <p className="font-mono text-sm sm:text-base font-semibold tracking-widest text-gold-deep uppercase mb-3">
          Islamic Finance Youth Summit 2026
        </p>
        <h1 className="font-display text-5xl sm:text-6xl italic text-emerald mb-10">
          Almost there.
        </h1>
        <Suspense fallback={null}>
          <ConfirmationClient />
        </Suspense>
      </div>
    </main>
  );
}
