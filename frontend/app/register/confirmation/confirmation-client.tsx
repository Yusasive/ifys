"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRegistration, Registration } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/format";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // ~60s

// Matches the event details hardcoded on the home page and /register —
// there's no per-registration event fetch on this page, so these stay
// in sync with backend/prisma/seed.ts's startsAt (2026-11-07T09:00 WAT).
const EVENT_NAME = "Islamic Finance Youth Summit 2026";
const EVENT_VENUE = "Ilorin Innovation Hub";
const EVENT_DATE_LABEL = "7 Nov 2026";
const EVENT_STARTS_AT_UTC = "20261107T080000Z";
const EVENT_ENDS_AT_UTC = "20261107T160000Z";

type PollState = "polling" | "paid" | "timeout" | "error";

function buildCalendarUrl(ticketCode: string): string {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${EVENT_STARTS_AT_UTC}`,
    `DTEND:${EVENT_ENDS_AT_UTC}`,
    `SUMMARY:${EVENT_NAME}`,
    `LOCATION:${EVENT_VENUE}`,
    `DESCRIPTION:Ticket code ${ticketCode}`,
    `UID:${ticketCode}@ifysummit.ng`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function ConfirmationClient() {
  const searchParams = useSearchParams();
  const registrationId = searchParams.get("registration");
  const [state, setState] = useState<PollState>("polling");
  const [registration, setRegistration] = useState<Registration | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!registrationId) {
      return;
    }

    let cancelled = false;

    async function poll() {
      if (!registrationId) return;
      try {
        const reg = await fetchRegistration(registrationId);
        if (cancelled) return;

        if (reg.status === "paid") {
          setRegistration(reg);
          setState("paid");
          return;
        }

        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setState("timeout");
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
    // Poll survives a page refresh because it's driven entirely by reads
    // (GET /registrations/:id) — nothing here mutates state or reissues
    // a ticket, so refreshing this page can never duplicate anything.
  }, [registrationId]);

  if (state === "error" || !registrationId) {
    return (
      <StatusCard
        heading="We couldn't find that registration."
        body="If you completed payment, check your email for your ticket, or contact support."
      />
    );
  }

  if (state === "polling") {
    return (
      <StatusCard
        heading="Confirming your payment…"
        body="This usually takes a few seconds. Do not close this page."
        spinning
      />
    );
  }

  if (state === "timeout") {
    return (
      <StatusCard
        heading="Still processing."
        body="Your payment may still be confirming on our end. Check your email shortly. If nothing arrives in a few minutes, contact support."
      />
    );
  }

  const ticket = registration?.ticket;

  return (
    <div className="border border-gold-deep rounded-sm px-6 py-8 bg-cloud text-center">
      <p className="font-mono text-sm font-semibold tracking-widest text-gold-deep uppercase mb-3">
        Ticket issued
      </p>
      <h2 className="font-display text-4xl italic text-emerald mb-2">You&apos;re in.</h2>
      {registration && (
        <p className="text-base font-medium text-emerald/70 max-w-sm mx-auto mb-1">
          {CATEGORY_LABELS[registration.ticketProduct.category]}
        </p>
      )}
      <p className="text-sm text-muted max-w-sm mx-auto mb-6">
        {EVENT_VENUE} · {EVENT_DATE_LABEL}
      </p>

      {ticket ? (
        <div className="max-w-xs mx-auto">
          <div className="bg-white border border-line rounded-sm p-4 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticket.qrDataUrl} alt="Ticket QR code" className="w-48 h-48" />
          </div>
          <div className="border-t border-dashed border-line my-4" />
          <p className="text-sm font-semibold text-emerald/60 uppercase tracking-widest mb-1">Short code</p>
          <p className="font-mono text-4xl font-semibold text-gold-deep tracking-widest mb-6">
            {ticket.ticketCode}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm font-medium">
            <a href={ticket.qrDataUrl} download={`ticket-${ticket.ticketCode}.png`} className="underline text-gold-deep">
              Download ticket
            </a>
            <a href={buildCalendarUrl(ticket.ticketCode)} download="ify-summit-2026.ics" className="underline text-gold-deep">
              Add to calendar
            </a>
          </div>
        </div>
      ) : (
        <p className="text-base text-muted max-w-sm mx-auto">
          Your e-ticket with QR code and short code has been emailed to{" "}
          {registration?.attendee.email}.
        </p>
      )}
    </div>
  );
}

function StatusCard({
  heading,
  body,
  spinning,
}: {
  heading: string;
  body: string;
  spinning?: boolean;
}) {
  return (
    <div className="border border-line rounded-sm px-6 py-10 bg-cloud text-center">
      {spinning && (
        <div
          className="w-8 h-8 mx-auto mb-4 rounded-full border-2 border-line border-t-gold-deep animate-spin"
          aria-hidden="true"
        />
      )}
      <h2 className="font-display text-4xl italic text-emerald mb-4">{heading}</h2>
      <p className="text-base text-emerald/70 max-w-sm mx-auto">{body}</p>
    </div>
  );
}
