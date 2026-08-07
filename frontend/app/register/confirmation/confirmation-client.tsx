"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRegistration, Registration, ticketPdfUrl, verifyRegistrationPayment } from "@/lib/api";
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
  const lookupToken = searchParams.get("token");
  const [state, setState] = useState<PollState>("polling");
  const [registration, setRegistration] = useState<Registration | null>(null);
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!registrationId || !lookupToken) {
      return;
    }

    let cancelled = false;

    // Best-effort nudge: ask the backend to check with Paystack directly
    // right away, instead of just sitting on the poll below waiting for a
    // webhook that may be slow, misconfigured, or never arrive. If this
    // fails or the webhook already settled it, the poll loop below is
    // still the source of truth either way.
    void verifyRegistrationPayment(registrationId, lookupToken).catch(() => {});

    async function poll() {
      if (!registrationId || !lookupToken) return;
      try {
        const reg = await fetchRegistration(registrationId, lookupToken);
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
  }, [registrationId, lookupToken]);

  if (state === "error" || !registrationId || !lookupToken) {
    return (
      <StatusCard
        eyebrow="Registration Not Found"
        subheading="We couldn't find that registration."
        body="If you completed payment, check your email for your ticket, or contact support."
        icon="error"
      />
    );
  }

  if (state === "polling") {
    return (
      <StatusCard
        eyebrow="Confirming Payment"
        subheading="Hang tight, almost there!"
        body="This usually takes a few seconds. Do not close this page."
        icon="spinner"
      />
    );
  }

  if (state === "timeout") {
    return (
      <StatusCard
        eyebrow="Still Processing"
        subheading="This is taking a little longer than usual."
        body="Your payment may still be confirming on our end. Check your email shortly. If nothing arrives in a few minutes, contact support."
        icon="error"
      />
    );
  }

  const ticket = registration?.ticket;

  return (
    <StatusCard
      eyebrow="Registration Successful"
      subheading="You have just secured your spot!"
      icon="check"
    >
      {registration && (
        <p className="text-base font-medium text-white/90 mb-1">
          {CATEGORY_LABELS[registration.ticketProduct.category]}
        </p>
      )}
      <p className="text-sm text-white/70 mb-6">
        {EVENT_VENUE} · {EVENT_DATE_LABEL}
      </p>

      {ticket ? (
        <div className="max-w-xs mx-auto">
          <div className="bg-white rounded-sm p-4 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticket.qrDataUrl} alt="Ticket QR code" className="w-40 h-40 sm:w-48 sm:h-48" />
          </div>
          <div className="border-t border-dashed border-white/30 my-4" />
          <p className="text-sm font-semibold text-white/70 uppercase tracking-widest mb-1">Short code</p>
          <p className="font-mono text-3xl sm:text-4xl font-semibold text-white tracking-widest mb-6">
            {ticket.ticketCode}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm font-medium">
            <a href={ticketPdfUrl(registrationId, lookupToken)} className="underline text-white">
              Download ticket (PDF)
            </a>
            <a href={buildCalendarUrl(ticket.ticketCode)} download="ify-summit-2026.ics" className="underline text-white">
              Add to calendar
            </a>
          </div>
        </div>
      ) : (
        <p className="font-sans text-base sm:text-2xl font-medium leading-snug sm:leading-[48px] tracking-normal text-center text-white max-w-sm mx-auto">
          We look forward to welcoming you at the {EVENT_NAME}. Check your Email for your Ticket
          details.
        </p>
      )}
    </StatusCard>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12.5 10 16l8-8" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5M12 16.5h.01" />
    </svg>
  );
}

function StatusCard({
  eyebrow,
  subheading,
  body,
  icon,
  children,
}: {
  eyebrow: string;
  subheading: string;
  body?: string;
  icon: "check" | "error" | "spinner";
  children?: ReactNode;
}) {
  return (
    <div className="text-center">
      <h1 className="font-plex text-lg sm:text-2xl font-medium leading-tight sm:leading-[48px] tracking-normal uppercase text-forest mb-4 sm:mb-6">
        {eyebrow}
      </h1>
      <p className="font-bricolage text-lg sm:text-2xl font-medium leading-tight sm:leading-[48px] tracking-normal text-black mb-6 sm:mb-8">
        {subheading}
      </p>

      <div className="w-full lg:w-[541px] lg:min-h-[421px] mx-auto bg-rust rounded-[10px] px-6 py-10 sm:px-10 lg:py-12 flex flex-col justify-center">
        <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-6 rounded-full border-2 border-white text-white flex items-center justify-center shrink-0">
          {icon === "check" && <CheckIcon />}
          {icon === "error" && <ErrorIcon />}
          {icon === "spinner" && (
            <div
              className="w-6 h-6 rounded-full border-2 border-white/40 border-t-white animate-spin"
              aria-hidden="true"
            />
          )}
        </div>
        {body && (
          <p className="font-sans text-base sm:text-2xl font-medium leading-snug sm:leading-[48px] tracking-normal text-center text-white max-w-sm mx-auto">
            {body}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
