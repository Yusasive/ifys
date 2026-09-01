"use client";

import { useEffect, useState } from "react";
import { fetchTicketProducts } from "@/lib/api";

const POLL_INTERVAL_MS = 20000;

export function TicketsRemaining({
  eventSlug,
  initialSoldCount,
  initialCapacity,
}: {
  eventSlug: string;
  initialSoldCount: number;
  initialCapacity: number;
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
