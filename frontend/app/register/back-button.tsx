"use client";

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2 text-base text-muted hover:text-emerald transition-colors"
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-full border border-line group-hover:border-gold-deep group-hover:bg-cloud transition-colors">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </span>
      Back
    </button>
  );
}
