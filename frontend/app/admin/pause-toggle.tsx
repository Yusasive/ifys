"use client";

import { useEffect, useState } from "react";
import { EventSettings, getEventSettings, updateEventSettings } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";

type PauseField = keyof EventSettings;

export function PauseToggle({
  eventSlug,
  field,
  label,
}: {
  eventSlug: string;
  field: PauseField;
  label: string;
}) {
  const toast = useToast();
  const [paused, setPaused] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEventSettings(eventSlug)
      .then((settings) => {
        if (!cancelled) setPaused(settings[field]);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load pause status.");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug, field]);

  async function handleChange(nextOpen: boolean) {
    setSaving(true);
    try {
      const settings = await updateEventSettings(eventSlug, { [field]: !nextOpen });
      setPaused(settings[field]);
      toast.success(nextOpen ? `${label} reopened.` : `${label} paused.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to update.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 border border-emerald/20 rounded-2xl bg-white px-6 py-4 shadow-sm mb-6">
      <div>
        <p className="font-bricolage font-semibold text-forest">{label}</p>
        <p className="text-sm text-sage">
          {paused === null
            ? "Loading…"
            : paused
              ? "Paused — the public form shows a \"not currently accepting\" message."
              : "Open — the public form is accepting submissions."}
        </p>
      </div>
      <label className="flex items-center gap-2 shrink-0">
        <input
          type="checkbox"
          className="accent-emerald"
          checked={paused === false}
          disabled={paused === null || saving}
          onChange={(e) => void handleChange(e.target.checked)}
        />
        <span className="text-sm text-sage">Accepting submissions</span>
      </label>
    </div>
  );
}
