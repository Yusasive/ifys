"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  DateUpdateResendStatus,
  getDateUpdateResendStatus,
  sendDateUpdateResend,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { FormModal } from "../form-modal";

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });
}

// Super-admin only. One-time action after the summit moved from Nov 7 to
// Nov 5: re-emails every valid ticket holder their existing ticket (same QR
// code, same ticket code) with the corrected date and a short note. People
// who already got it are skipped, so it's safe to press again later for
// tickets bought in between.
export function DateUpdateResendPanel({ eventSlug }: { eventSlug: string }) {
  const toast = useToast();
  const [status, setStatus] = useState<DateUpdateResendStatus | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDateUpdateResendStatus(eventSlug)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load resend status.");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug, reloadKey]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const { queued } = await sendDateUpdateResend(eventSlug, password);
      toast.success(
        queued === 0
          ? "Everyone already has the updated ticket."
          : `Sending updated tickets to ${queued} ${queued === 1 ? "person" : "people"}.`,
      );
      setConfirmOpen(false);
      setPassword("");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border border-emerald/20 rounded-2xl bg-white px-6 py-4 shadow-sm mb-6">
      <p className="font-bricolage font-semibold text-forest mb-1">Resend tickets with the new date</p>
      <p className="text-sm text-sage mb-4">
        Emails every ticket holder their same ticket (same QR code and ticket code) showing the
        current event date, with a short note that the date has changed. People who already got it
        are skipped.
      </p>

      {!status && <p className="text-sm text-sage">Loading…</p>}

      {status && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-4">
            <dt className="text-sage">Event date on tickets</dt>
            <dd className="text-ink">{formatEventDate(status.eventStartsAt)}</dd>
            <dt className="text-sage">Valid tickets</dt>
            <dd className="text-ink">{status.totalTickets}</dd>
            <dt className="text-sage">Already sent</dt>
            <dd className="text-ink">{status.alreadySent}</dd>
            <dt className="text-sage">Still to send</dt>
            <dd className="text-ink font-semibold">{status.pending}</dd>
            {status.lastSentAt && (
              <>
                <dt className="text-sage">Last sent</dt>
                <dd className="text-ink">{new Date(status.lastSentAt).toLocaleString("en-NG")}</dd>
              </>
            )}
          </dl>

          <button
            type="button"
            disabled={status.pending === 0}
            onClick={() => setConfirmOpen(true)}
            className="bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
          >
            {status.pending === 0 ? "All sent" : `Send to ${status.pending}`}
          </button>
        </>
      )}

      <FormModal
        open={confirmOpen}
        title="Resend tickets with the new date?"
        description={
          status
            ? `${status.pending} ticket ${status.pending === 1 ? "holder" : "holders"} will get an email showing ${formatEventDate(status.eventStartsAt)}. Their QR codes and ticket codes stay the same.`
            : undefined
        }
        onClose={() => {
          if (!sending) setConfirmOpen(false);
        }}
      >
        <form onSubmit={(e) => void handleSend(e)} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-sage mb-1">Your password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-emerald/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
              placeholder="Re-enter your password"
              autoFocus
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={sending || password.length === 0}
              className="bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send emails"}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={() => setConfirmOpen(false)}
              className="text-sm text-sage"
            >
              Cancel
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
