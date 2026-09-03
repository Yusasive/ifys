"use client";

import { useEffect, useState } from "react";
import { fetchTicketProducts } from "@/lib/api";

const POLL_INTERVAL_MS = 20000;

export function TicketsRemaining({
  eventSlug,
  initialSoldCount,
  initialCapacity,
  variant = "default",
}: {
  eventSlug: string;
  initialSoldCount: number;
  initialCapacity: number;
  // "hero" is a larger, bolder treatment sized for the salmon countdown
  // section background — see app/countdown-section.tsx.
  variant?: "default" | "hero";
}) {
  const [soldCount, setSoldCount] = useState(initialSoldCount);
  const [capacity, setCapacity] = useState(initialCapacity);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(() => {
      fetchTicketProducts(eventSlug)
        .then(({ event }) => {
          if (!cancelled) {
            setSoldCount(event.ticketsSoldCount);
            setCapacity(event.ticketCapacity);
          }
        })
        // Best-effort — a failed poll just keeps showing the last known
        // count until the next tick succeeds.
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [eventSlug]);

  const remaining = Math.max(0, capacity - soldCount);
  const soldOut = remaining === 0;

  if (variant === "hero") {
    return (
      <div className="flex flex-col items-center gap-1 mb-8" role="status">
        <p
          className={`font-bricolage font-extrabold text-5xl sm:text-6xl lg:text-7xl tabular-nums drop-shadow-sm ${
            soldOut ? "text-gold" : "text-white"
          }`}
        >
          {soldOut ? "0" : remaining}
        </p>
        <p className="font-plex font-bold text-sm sm:text-base tracking-[0.15em] text-white/90 uppercase">
          {soldOut ? "Sold Out" : "Tickets Left"}
        </p>
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
        {soldOut ? "0" : remaining}
      </p>
      <p className="font-plex font-normal text-xs sm:text-sm tracking-[0.15em] text-rust uppercase">
        {soldOut ? "Sold Out" : "Tickets Left"}
      </p>
    </div>
  );
}
