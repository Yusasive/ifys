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
    <p
      className="font-bricolage font-medium text-sm sm:text-base text-center mb-6"
      role="status"
    >
      {soldOut ? (
        <span className="text-coral-deep">All {capacity} tickets are sold out</span>
      ) : (
        <span className="text-forest">
          Only <span className="font-bold tabular-nums">{remaining}</span> of {capacity} tickets left
        </span>
      )}
    </p>
  );
}
