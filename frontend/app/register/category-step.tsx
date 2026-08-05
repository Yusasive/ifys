"use client";

import type { ReactElement } from "react";
import type { Category, TicketProduct } from "@/lib/api";
import { CATEGORY_LABELS, formatKobo } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setCategory, setStep, setTier } from "@/lib/registration-slice";

const CATEGORIES: { value: Category; description: string; icon: ReactElement }[] = [
  {
    value: "student",
    description: "Currently enrolled at a college or university.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 9.5 12 5l8 4.5-8 4.5-8-4.5Zm0 0v5m4-2.7V19m8-7.2V19M8 19c0-1.5 1.8-2.5 4-2.5s4 1 4 2.5"
      />
    ),
  },
  {
    value: "professional",
    description: "Working in finance, tech, or an adjacent field.",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 9h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Zm3 0V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M4 13h16"
      />
    ),
  },
];

export function CategoryStep({ ticketProducts }: { ticketProducts: TicketProduct[] }) {
  const dispatch = useAppDispatch();
  const selected = useAppSelector((s) => s.registration.category);

  function priceFor(category: Category) {
    return ticketProducts.find((p) => p.category === category && p.tier === "standard");
  }

  return (
    <div className="flex flex-col gap-3">
      {CATEGORIES.map((c) => {
        const product = priceFor(c.value);
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={selected === c.value}
            onClick={() => {
              dispatch(setCategory(c.value));
              dispatch(setTier("standard"));
              dispatch(setStep("details"));
            }}
            className={`flex items-start gap-4 text-left border rounded-sm px-5 py-4 transition-colors ${
              selected === c.value
                ? "border-gold bg-cloud"
                : "border-line hover:border-gold-deep"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className={`w-7 h-7 mt-0.5 shrink-0 ${
                selected === c.value ? "text-gold-deep" : "text-muted"
              }`}
            >
              {c.icon}
            </svg>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <div className="font-display text-2xl text-emerald">
                  {CATEGORY_LABELS[c.value]}
                </div>
                {product && (
                  <div className="font-mono text-base font-semibold text-gold-deep whitespace-nowrap">
                    {formatKobo(product.priceKobo, product.currency)}
                  </div>
                )}
              </div>
              <div className="text-base text-emerald/70 mt-1">{c.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
