"use client";

import { useSyncExternalStore } from "react";
import type { EventSummary } from "@/lib/api";
import { TicketsRemaining } from "./tickets-remaining";

// Matches EVENT_STARTS_AT_UTC in app/register/confirmation/confirmation-client.tsx
// and startsAt in backend/prisma/seed.ts (2026-11-05T09:00 WAT).
const EVENT_STARTS_AT = new Date("2026-11-05T08:00:00Z");

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function computeTimeLeft(): TimeLeft {
  const diff = Math.max(0, EVENT_STARTS_AT.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

let cachedKey = "";
let cachedSnapshot: TimeLeft = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function getSnapshot(): TimeLeft {
  const next = computeTimeLeft();
  const key = `${next.days}:${next.hours}:${next.minutes}:${next.seconds}`;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedSnapshot = next;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): TimeLeft | null {
  return null;
}

function subscribe(callback: () => void) {
  const interval = setInterval(callback, 1000);
  return () => clearInterval(interval);
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2 bg-white rounded-xl sm:rounded-2xl px-2 py-3 sm:px-6 sm:py-6 w-full">
      <p className="font-bricolage font-bold text-2xl sm:text-5xl lg:text-[56px] leading-none tracking-normal text-forest tabular-nums">
        {String(value).padStart(2, "0")}
      </p>
      <p className="font-plex font-normal text-[10px] sm:text-sm tracking-[0.1em] sm:tracking-[0.15em] text-rust uppercase">
        {label}
      </p>
    </div>
  );
}

export function CountdownSection({ event }: { event: EventSummary | null }) {
  const timeLeft = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const hasStarted =
    timeLeft !== null &&
    timeLeft.days === 0 &&
    timeLeft.hours === 0 &&
    timeLeft.minutes === 0 &&
    timeLeft.seconds === 0;
  const t = timeLeft ?? { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return (
    <section className="bg-salmon">
      <div className="mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
        <p className="font-plex font-normal text-sm sm:text-base tracking-[0.15em] text-white/80 uppercase mb-3">
          Countdown to the Summit
        </p>
        <h2 className="font-bricolage font-medium text-lg sm:text-2xl lg:text-[36px] leading-[1.3] tracking-normal text-white mb-8 px-2">
          {hasStarted ? "The Summit is live!" : "Thursday, 5th of November 2026, Ilorin"}
        </h2>

        {event && (
          <TicketsRemaining event={event} variant="hero" />
        )}

        <div
          className="grid grid-cols-4 gap-2 sm:gap-6 max-w-xs sm:max-w-xl lg:max-w-2xl mx-auto"
          role="timer"
          aria-live="off"
          aria-label={`Time remaining until the summit: ${t.days} days, ${t.hours} hours, ${t.minutes} minutes, ${t.seconds} seconds`}
        >
          <Unit value={t.days} label="Days" />
          <Unit value={t.hours} label="Hours" />
          <Unit value={t.minutes} label="Minutes" />
          <Unit value={t.seconds} label="Seconds" />
        </div>
      </div>
    </section>
  );
}
