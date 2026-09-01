"use client";

import { FormEvent, useEffect, useState } from "react";
import { getEventSettings, updateEventSettings } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";

export function TicketCapacityCard({ eventSlug }: { eventSlug: string }) {
  const toast = useToast();
  const [capacity, setCapacity] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEventSettings(eventSlug)
      .then((settings) => {
        if (!cancelled) {
          setCapacity(settings.ticketCapacity);
          setInput(String(settings.ticketCapacity));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load ticket capacity.");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const settings = await updateEventSettings(eventSlug, {
        ticketCapacity: Number(input),
      });
      setCapacity(settings.ticketCapacity);
      toast.success(`Ticket capacity set to ${settings.ticketCapacity}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="flex items-center justify-between gap-4 border border-emerald/20 rounded-2xl bg-white px-6 py-4 shadow-sm mb-6"
    >
      <div>
        <p className="font-bricolage font-semibold text-forest">Total ticket capacity</p>
        <p className="text-sm text-sage">
          The public form auto-closes once this many tickets have been sold across all categories.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <input
          type="number"
          min={0}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={capacity === null || saving}
          className="w-24 border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
        />
        <button
          type="submit"
          disabled={capacity === null || saving || Number(input) === capacity}
          className="bg-coral text-white font-semibold px-4 py-1.5 rounded-full text-sm hover:bg-coral-deep transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
