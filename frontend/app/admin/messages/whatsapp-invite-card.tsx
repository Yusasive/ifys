"use client";

import { useEffect, useState } from "react";
import { getWhatsAppInvite, updateWhatsAppInvite, WhatsAppInviteSettings } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";

// Turns the automatic "join the WhatsApp group" email on (by saving the
// group link) or off. Who has and hasn't received it is tracked on the
// Tickets page, which also catches up people who registered earlier.
export function WhatsAppInviteCard({
  eventSlug,
  onLoaded,
}: {
  eventSlug: string;
  onLoaded?: (settings: WhatsAppInviteSettings) => void;
}) {
  const toast = useToast();
  const [settings, setSettings] = useState<WhatsAppInviteSettings | null>(null);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    getWhatsAppInvite(eventSlug)
      .then((s) => {
        setLoadError(null);
        setSettings(s);
        setUrl(s.whatsappGroupUrl ?? "");
        onLoaded?.(s);
      })
      .catch((err: unknown) =>
        setLoadError(
          err instanceof ApiError
            ? `${err.body.message} (HTTP ${err.status})`
            : "Could not reach the server.",
        ),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug, attempt]);

  async function save(next: string | null) {
    setSaving(true);
    try {
      const s = await updateWhatsAppInvite(eventSlug, next);
      setSettings(s);
      setUrl(s.whatsappGroupUrl ?? "");
      onLoaded?.(s);
      toast.success(next ? "Automatic WhatsApp invite is on." : "Automatic WhatsApp invite is off.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Could not save the link.");
    } finally {
      setSaving(false);
    }
  }

  // Shown rather than hidden, so a failed load (e.g. the API not yet
  // updated) is visible instead of the card silently missing.
  if (!settings) {
    return (
      <section className="border border-emerald/20 rounded-2xl bg-white shadow-sm p-5 mb-6">
        <h2 className="font-bricolage font-bold text-lg text-forest mb-1">Automatic WhatsApp invite</h2>
        {loadError ? (
          <p className="text-sm text-coral-deep">
            Couldn&rsquo;t load the WhatsApp invite settings: {loadError}{" "}
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              className="text-emerald underline hover:text-forest"
            >
              Try again
            </button>
          </p>
        ) : (
          <p className="text-sm text-sage">Loading…</p>
        )}
      </section>
    );
  }

  const enabled = !!settings.whatsappGroupUrl;
  const trimmed = url.trim();
  const changed = trimmed !== (settings.whatsappGroupUrl ?? "");

  return (
    <section className="border border-emerald/20 rounded-2xl bg-white shadow-sm p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="font-bricolage font-bold text-lg text-forest">Automatic WhatsApp invite</h2>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            enabled ? "text-emerald bg-emerald/10" : "text-sage bg-sage/10"
          }`}
        >
          {enabled ? "On" : "Off"}
        </span>
      </div>
      <p className="text-sm text-sage mb-4">
        While a link is saved, everyone who gets a ticket from now on is automatically emailed the WhatsApp
        group template (&ldquo;{settings.subject}&rdquo;) with this link. See who has and hasn&rsquo;t received
        it, and send it to people who registered earlier, under{" "}
        <a href="/admin/tickets" className="text-emerald underline hover:text-forest">
          Tickets → Ticket email delivery → WhatsApp invite
        </a>
        .
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://chat.whatsapp.com/…"
          className="flex-1 min-w-64 border border-emerald/20 rounded-xl px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-gold"
        />
        <button
          type="button"
          disabled={saving || !trimmed || !changed}
          onClick={() => void save(trimmed)}
          className="bg-emerald text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-forest transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : enabled ? "Update link" : "Save and turn on"}
        </button>
        {enabled && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(null)}
            className="text-sm text-coral-deep underline hover:text-coral disabled:opacity-50"
          >
            Turn off
          </button>
        )}
      </div>
    </section>
  );
}
