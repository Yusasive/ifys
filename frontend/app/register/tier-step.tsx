"use client";

import type { TicketProduct } from "@/lib/api";
import { formatKobo, TIER_LABELS } from "@/lib/format";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import { setStep, setTier } from "@/lib/registration-slice";

export function TierStep({ ticketProducts }: { ticketProducts: TicketProduct[] }) {
  const dispatch = useAppDispatch();
  const category = useAppSelector((s) => s.registration.category);
  const selectedTier = useAppSelector((s) => s.registration.tier);

  const options = ticketProducts.filter((p) => p.category === category);

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      {options.map((product) => {
        const isPremium = product.tier === "premium";
        const isSelected = selectedTier === product.tier;
        return (
          <button
            key={product.id}
            type="button"
            onClick={() => {
              dispatch(setTier(product.tier));
              dispatch(setStep("details"));
            }}
            className={`relative flex-1 text-left rounded-sm px-5 py-5 border transition-colors ${
              isPremium
                ? "border-gold-light bg-gradient-to-br from-ink-2 to-ink"
                : "border-line bg-ink-2"
            } ${isSelected ? "ring-1 ring-gold" : ""}`}
          >
            {isPremium && (
              <span className="absolute top-3 right-3 font-mono text-gold-light text-xs">
                ✦
              </span>
            )}
            <div className="font-display text-xl text-paper mb-1">
              {TIER_LABELS[product.tier]}
            </div>
            <div className="font-mono text-2xl text-gold-light mb-2">
              {formatKobo(product.priceKobo, product.currency)}
            </div>
            <p className="text-sm text-muted">
              {isPremium
                ? "Elevated experience — perks to be confirmed by the organizers."
                : "Full access to the summit programme."}
            </p>
          </button>
        );
      })}
    </div>
  );
}
