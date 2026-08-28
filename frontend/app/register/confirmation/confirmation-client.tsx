"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createCheckout,
  fetchRegistration,
  Registration,
  ticketPdfUrl,
  verifyRegistrationPayment,
} from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/format";
import { StatusCard } from "@/app/status-card";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // ~60s

// Matches the event details hardcoded on the home page and /register —
// there's no per-registration event fetch on this page, so these stay
// in sync with backend/prisma/seed.ts's startsAt (2026-11-05T09:00 WAT).
const EVENT_NAME = "Islamic Finance Youth Summit 2026";
const EVENT_VENUE = "Ilorin Innovation Hub";
const EVENT_DATE_LABEL = "5 Nov 2026";
const EVENT_STARTS_AT_UTC = "20261105T080000Z";
const EVENT_ENDS_AT_UTC = "20261105T160000Z";

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
  const [resuming, setResuming] = useState(false);
  const attemptsRef = useRef(0);

  async function resumePayment() {
    if (!registrationId || !lookupToken || resuming) return;
    setResuming(true);
    try {
      const { authorizationUrl } = await createCheckout(registrationId, lookupToken);
      window.location.href = authorizationUrl;
    } catch {
      setResuming(false);
    }
  }

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
        setRegistration(reg);

        if (reg.status === "paid") {
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
    const canResume = registration?.status === "pending_payment";
    return (
      <StatusCard
        eyebrow="Still Processing"
        subheading="This is taking a little longer than usual."
        body={
          canResume
            ? "Your payment hasn't gone through yet. You can pick up where you left off below."
            : "Your payment may still be confirming on our end. Check your email shortly. If nothing arrives in a few minutes, contact support."
        }
        icon="error"
      >
        {canResume && (
          <button
            onClick={() => void resumePayment()}
            disabled={resuming}
            className="inline-block bg-white text-forest px-6 py-2.5 rounded-full text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50 mt-2"
          >
            {resuming ? "Redirecting…" : "Complete your payment"}
          </button>
        )}
      </StatusCard>
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

