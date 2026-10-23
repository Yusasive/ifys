"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { unsubscribeFromBroadcasts } from "@/lib/api";
import { StatusCard } from "@/app/status-card";

type State = "confirm" | "submitting" | "done" | "error";

// Asks before unsubscribing rather than doing it on page load: link
// scanners in some mail systems open every link in an email, and would
// otherwise unsubscribe people who never clicked.
export function UnsubscribeClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get("e");
  const token = searchParams.get("t");
  const [state, setState] = useState<State>("confirm");

  async function confirm() {
    if (!email || !token) return;
    setState("submitting");
    try {
      await unsubscribeFromBroadcasts(email, token);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (!email || !token || state === "error") {
    return (
      <StatusCard
        eyebrow="Unsubscribe"
        subheading="This link didn't work"
        body="Please email us at contact@ifysummit.com and we'll take you off the list."
        icon="error"
      />
    );
  }

  if (state === "done") {
    return (
      <StatusCard
        eyebrow="Unsubscribe"
        subheading="You're unsubscribed"
        body="You won't get any more updates by email. Your ticket and its emails are not affected."
        icon="check"
      />
    );
  }

  return (
    <StatusCard
      eyebrow="Unsubscribe"
      subheading={email}
      body="Stop receiving update emails about the summit? Your ticket stays valid either way."
      icon="paused"
    >
      <div className="text-center mt-6">
        <button
          onClick={() => void confirm()}
          disabled={state === "submitting"}
          className="inline-block bg-white text-forest px-6 py-2.5 rounded-full text-sm font-medium hover:bg-white/90 transition-colors disabled:opacity-50"
        >
          {state === "submitting" ? "Unsubscribing…" : "Unsubscribe"}
        </button>
      </div>
    </StatusCard>
  );
}
