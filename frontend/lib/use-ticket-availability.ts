"use client";

import { useEffect, useState } from "react";
import { fetchTicketProducts, type CategoryAvailability, type EventSummary } from "./api";

const POLL_INTERVAL_MS = 20000;

// One poll per event slug, shared by every counter mounted on the page (the
// landing page renders several), instead of one interval per component.
type Listener = (availability: CategoryAvailability[]) => void;
const pollers = new Map<string, { listeners: Set<Listener>; interval: ReturnType<typeof setInterval> }>();

function subscribe(eventSlug: string, listener: Listener) {
  let poller = pollers.get(eventSlug);
  if (!poller) {
    const listeners = new Set<Listener>();
    const interval = setInterval(() => {
      fetchTicketProducts(eventSlug)
        .then(({ event }) => listeners.forEach((l) => l(event.categoryAvailability)))
        // Best-effort — a failed poll just keeps showing the last known
        // counts until the next tick succeeds.
        .catch(() => {});
    }, POLL_INTERVAL_MS);
    poller = { listeners, interval };
    pollers.set(eventSlug, poller);
  }
  poller.listeners.add(listener);
  return () => {
    poller.listeners.delete(listener);
    if (poller.listeners.size === 0) {
      clearInterval(poller.interval);
      pollers.delete(eventSlug);
    }
  };
}

export function useTicketAvailability(event: EventSummary): CategoryAvailability[] {
  const [availability, setAvailability] = useState(event.categoryAvailability);
  useEffect(() => subscribe(event.slug, setAvailability), [event.slug]);
  return availability;
}
