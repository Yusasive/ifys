"use client";

import { FormEvent, useEffect, useState } from "react";
import { getEventSettings, updateEventSettings } from "@/lib/admin-api";
import { ApiError, type Category, type CategoryAvailability } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/format";
import { useToast } from "@/lib/toast-context";

// The categories that are currently sold — `founder` is retired.
const CATEGORIES: Category[] = ["student", "regular", "professional"];

export function TicketCapacityCard({ eventSlug }: { eventSlug: string }) {
  const toast = useToast();
  const [saved, setSaved] = useState<CategoryAvailability[] | null>(null);
  const [inputs, setInputs] = useState<Partial<Record<Category, string>>>({});
  const [saving, setSaving] = useState(false);

  function load(capacities: CategoryAvailability[]) {
    setSaved(capacities);
    setInputs(
      Object.fromEntries(
        CATEGORIES.map((category) => [
          category,
          String(capacities.find((c) => c.category === category)?.capacity ?? 0),
        ]),
      ),
    );
  }

  useEffect(() => {
    let cancelled = false;
    getEventSettings(eventSlug)
      .then((settings) => {
        if (!cancelled) load(settings.categoryCapacities);
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

  const savedCapacity = (category: Category) =>
    saved?.find((c) => c.category === category)?.capacity ?? 0;
  const dirty = CATEGORIES.some((category) => Number(inputs[category]) !== savedCapacity(category));

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const settings = await updateEventSettings(eventSlug, {
        categoryCapacities: CATEGORIES.map((category) => ({
          category,
          capacity: Number(inputs[category]),
        })),
      });
      load(settings.categoryCapacities);
      toast.success("Ticket capacities updated.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="border border-emerald/20 rounded-2xl bg-white px-6 py-4 shadow-sm mb-6"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-bricolage font-semibold text-forest">Ticket capacity per category</p>
          <p className="text-sm text-sage">
            Each category closes on its own once this many of its tickets have been sold.
          </p>
        </div>
        <button
          type="submit"
          disabled={saved === null || saving || !dirty}
          className="shrink-0 bg-coral text-white font-semibold px-4 py-1.5 rounded-full text-sm hover:bg-coral-deep transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {CATEGORIES.map((category) => {
          const sold = saved?.find((c) => c.category === category)?.soldCount ?? 0;
          return (
            <label key={category} className="flex flex-col gap-1 text-sm text-forest">
              <span className="font-medium">{CATEGORY_LABELS[category]}</span>
              <input
                type="number"
                min={0}
                value={inputs[category] ?? ""}
                onChange={(e) => setInputs((prev) => ({ ...prev, [category]: e.target.value }))}
                disabled={saved === null || saving}
                className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              />
              <span className="text-xs text-sage">{sold} sold</span>
            </label>
          );
        })}
      </div>
    </form>
  );
}
