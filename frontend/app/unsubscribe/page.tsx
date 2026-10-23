import { Suspense } from "react";
import { Metadata } from "next";
import { UnsubscribeClient } from "./unsubscribe-client";

export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

export default function UnsubscribePage() {
  return (
    <main className="relative bg-white text-emerald flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-2xl">
        <Suspense fallback={null}>
          <UnsubscribeClient />
        </Suspense>
      </div>
    </main>
  );
}
