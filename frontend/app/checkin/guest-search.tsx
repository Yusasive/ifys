"use client";

import { useEffect, useState } from "react";
import { describeError } from "@/lib/api";
import { searchTickets, type TicketSearchHit } from "@/lib/checkin-api";
import { CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 300;

// Fallback for guests without their ticket: find them by name or email and
// check them in from the result. Needs a connection — the offline list only
// holds hashes of the codes, not searchable details.
export function GuestSearch({
  online,
  disabled,
  onCheckIn,
}: {
  online: boolean;
  disabled: boolean;
  onCheckIn: (ticketId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TicketSearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (!online || q.length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchTickets(q)
        .then((found) => {
          if (cancelled) return;
          setHits(found);
          setSearched(true);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(describeError(err, "Search failed."));
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, online]);

  const active = online && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <section className="mt-6 max-w-md mx-auto w-full" aria-label="Find a guest">
      <label htmlFor="guest-search" className="sr-only">
        Find a guest by name or email
      </label>
      <input
        id="guest-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={online ? "Find guest by name or email" : "Guest search needs a connection"}
        disabled={!online}
        className="w-full bg-white border border-rust/70 rounded-full px-5 py-3 text-base text-emerald placeholder:text-emerald/50 focus:outline-none focus:border-rust disabled:opacity-60"
      />
      {error && active && (
        <p role="alert" className="mt-2 text-center text-sm text-red-600">
          {error}
        </p>
      )}
      {active && searched && !error && hits.length === 0 && (
        <p className="mt-2 text-center text-sm text-emerald/60">No ticket matches that.</p>
      )}
      {active && hits.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {hits.map((hit) => (
            <li
              key={hit.ticketId}
              className="flex items-center justify-between gap-3 rounded-2xl border border-rust/20 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-emerald break-words">{hit.attendee.fullName}</p>
                <p className="text-xs text-emerald/60 truncate">
                  {hit.maskedEmail} · {CATEGORY_LABELS[hit.attendee.category] ?? hit.attendee.category}{" "}
                  · {TIER_LABELS[hit.attendee.tier] ?? hit.attendee.tier}
                </p>
                {(hit.attendee.title || hit.attendee.organization) && (
                  <p className="text-xs text-emerald/60 truncate">
                    {[hit.attendee.title, hit.attendee.organization].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              {hit.status === "unused" ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onCheckIn(hit.ticketId)}
                  className="shrink-0 rounded-full bg-rust px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Check in
                </button>
              ) : (
                <span className="shrink-0 text-xs font-semibold uppercase text-red-700">
                  {hit.status === "void" ? "Voided" : "Used"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
