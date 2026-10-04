"use client";

import type { ReactElement } from "react";
import type { Category, CategoryAvailability, TicketProduct } from "@/lib/api";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setCategory, setStep, setTier } from "@/lib/registration-slice";

const CATEGORIES: { value: Category; label: string; icon: ReactElement }[] = [
  {
    value: "student",
    label: "Student",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 9.5 12 5l8 4.5-8 4.5-8-4.5Zm0 0v5m4-2.7V19m8-7.2V19M8 19c0-1.5 1.8-2.5 4-2.5s4 1 4 2.5"
      />
    ),
  },
  {
    value: "regular",
    label: "Regular",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path strokeLinecap="round" d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
      </>
    ),
  },
  {
    value: "professional",
    label: "Founder/Working Professional",
    icon: (
      <>
        <circle cx="9" cy="8" r="2.6" />
        <path strokeLinecap="round" d="M4 20c0-2.9 2.2-5.2 5-5.2" />
        <rect x="13" y="11" width="8" height="6.5" rx="1" />
        <path strokeLinecap="round" d="M15.5 11V9.8a1.5 1.5 0 0 1 1.5-1.5h0a1.5 1.5 0 0 1 1.5 1.5V11" />
      </>
    ),
  },
];

export function CategoryStep({
  ticketProducts,
  availability,
}: {
  ticketProducts: TicketProduct[];
  availability: CategoryAvailability[];
}) {
  const dispatch = useAppDispatch();
  const selected = useAppSelector((s) => s.registration.category);

  function priceFor(category: Category) {
    return ticketProducts.find((p) => p.category === category && p.tier === "standard");
  }

  return (
    <div className="w-full lg:w-[541px] lg:h-[421px] mx-auto bg-rust rounded-[10px] p-5 sm:p-9 lg:p-[36px] flex flex-col justify-center gap-4 sm:gap-6 lg:gap-[24px]">
      {CATEGORIES.map((c) => {
        const product = priceFor(c.value);
        // A category with no configured limit has nothing to sell.
        const remaining = availability.find((a) => a.category === c.value)?.remaining ?? 0;
        const soldOut = remaining === 0;
        const status = soldOut ? "Sold Out" : `${remaining} left`;
        return (
          <button
            key={c.value}
            type="button"
            disabled={soldOut}
            aria-pressed={selected === c.value}
            aria-label={`${product ? `${c.label}, ${product.priceKobo / 100} ${product.currency}` : c.label}, ${status}`}
            onClick={() => {
              dispatch(setCategory(c.value));
              dispatch(setTier("standard"));
              dispatch(setStep("details"));
            }}
            className={`flex items-center justify-center gap-2 sm:gap-3 rounded-full border px-3 sm:px-6 py-3 sm:py-5 text-white font-sans font-medium text-sm sm:text-lg lg:text-xl text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              soldOut
                ? "border-white/40"
                : selected === c.value
                  ? "border-white bg-white/10"
                  : "border-white/70 hover:border-white hover:bg-white/5"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 shrink-0"
            >
              {c.icon}
            </svg>
            {c.label}
            <span className="ml-1 shrink-0 rounded-full bg-white/15 px-2 py-0.5 font-plex text-[10px] sm:text-xs uppercase tracking-[0.1em]">
              {status}
            </span>
          </button>
        );
      })}
    </div>
  );
}
