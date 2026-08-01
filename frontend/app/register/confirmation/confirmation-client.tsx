"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchRegistration, Registration } from "@/lib/api";
import { CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // ~60s

type PollState = "polling" | "paid" | "timeout" | "error";

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
        pulsing
      />
    );
  }

  if (state === "timeout") {
    return (
      <StatusCard
        heading="Still processing."
        body="Your payment may still be confirming on our end. Check your email shortly — if nothing arrives in a few minutes, contact support."
      />
    );
  }

  return (
    <div className="border border-gold-light rounded-sm px-6 py-10 bg-ink-2 text-center">
      <p className="font-mono text-xs tracking-widest text-gold-light uppercase mb-4">
        Ticket issued
      </p>
      <h2 className="font-display text-2xl italic text-paper mb-4">
        You&apos;re in.
      </h2>
      {registration && (
        <p className="text-sm text-muted max-w-sm mx-auto mb-2">
          {CATEGORY_LABELS[registration.ticketProduct.category]} ·{" "}
          {TIER_LABELS[registration.ticketProduct.tier]}
        </p>
      )}
      <p className="text-sm text-muted max-w-sm mx-auto mb-6">
        Your e-ticket with QR code and short code has been emailed to{" "}
        {registration?.attendee.email}.
      </p>
    </div>
  );
}

function StatusCard({
  heading,
  body,
  pulsing,
}: {
  heading: string;
  body: string;
  pulsing?: boolean;
}) {
  return (
    <div className="border border-line rounded-sm px-6 py-10 bg-ink-2 text-center">
      <h2
        className={`font-display text-2xl italic text-paper mb-4 ${pulsing ? "animate-pulse" : ""}`}
      >
        {heading}
      </h2>
      <p className="text-sm text-muted max-w-sm mx-auto">{body}</p>
    </div>
  );
}
