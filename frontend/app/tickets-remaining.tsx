"use client";

import type { Category, CategoryAvailability, EventSummary } from "@/lib/api";
import { useTicketAvailability } from "@/lib/use-ticket-availability";

const SHORT_LABELS: Partial<Record<Category, string>> = {
  student: "Student",
  regular: "Regular",
  professional: "Professional",
};
const ORDER: Partial<Record<Category, number>> = { student: 0, regular: 1, professional: 2 };

function totalRemaining(availability: CategoryAvailability[]): number {
  return availability.reduce((sum, c) => sum + c.remaining, 0);
}

export function TicketsRemaining({
  event,
  category,
  variant = "default",
}: {
  event: EventSummary;
  // When set, shows only that category's count (e.g. on the student
  // registration form); otherwise the total across every category.
  category?: Category | null;
  variant?: "default" | "hero" | "badge";
}) {
  const availability = useTicketAvailability(event);
  const categoryAvailability = category
    ? availability.find((c) => c.category === category)
    : undefined;
  // A category with no configured limit has nothing to sell.
  const remaining = category ? (categoryAvailability?.remaining ?? 0) : totalRemaining(availability);
  const soldOut = remaining === 0;
  const label = soldOut
    ? "Sold Out"
    : category && SHORT_LABELS[category]
      ? `${SHORT_LABELS[category]} Tickets Left`
      : "Tickets Left";

  if (variant === "badge") {
    return (
      <p
        role="status"
        className={`inline-block rounded-full px-3 py-1 font-plex text-xs font-semibold uppercase tracking-[0.1em] ${
          soldOut ? "bg-coral-deep/10 text-coral-deep" : "bg-forest/10 text-forest"
        }`}
      >
        {soldOut ? "Sold Out" : `${remaining} left`}
      </p>
    );
  }

  if (variant === "hero") {
    const breakdown = availability
      .filter((c) => SHORT_LABELS[c.category])
      .sort((a, b) => (ORDER[a.category] ?? 99) - (ORDER[b.category] ?? 99));
    return (
      <div className="flex flex-col items-center gap-1 mb-8" role="status">
        <p
          className={`font-bricolage font-extrabold text-5xl sm:text-6xl lg:text-7xl tabular-nums drop-shadow-sm ${
            soldOut ? "text-gold" : "text-white"
          }`}
        >
          {remaining}
        </p>
        <p className="font-plex font-bold text-sm sm:text-base tracking-[0.15em] text-white/90 uppercase">
          {label}
        </p>
        {!category && breakdown.length > 1 && (
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {breakdown.map((c) => (
              <li
                key={c.category}
                className="rounded-full bg-white/15 px-3 py-1 font-plex text-xs sm:text-sm text-white tabular-nums"
              >
                {SHORT_LABELS[c.category]}: {c.soldOut ? "Sold Out" : `${c.remaining} left`}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 mb-6" role="status">
      <p
        className={`font-bricolage font-bold text-3xl sm:text-4xl tabular-nums ${
          soldOut ? "text-coral-deep" : "text-forest"
        }`}
      >
        {remaining}
      </p>
      <p className="font-plex font-normal text-xs sm:text-sm tracking-[0.15em] text-rust uppercase">
        {label}
      </p>
    </div>
  );
}
