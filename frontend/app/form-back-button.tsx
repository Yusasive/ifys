"use client";

import { useRouter } from "next/navigation";

export function FormBackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      aria-label="Go back"
      className={`absolute top-4 left-4 lg:top-6 flex items-center justify-center w-10 h-10 lg:w-12 lg:h-12 shrink-0 rounded-full border border-black text-black hover:bg-black hover:text-white transition-colors ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4 sm:w-5 sm:h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
