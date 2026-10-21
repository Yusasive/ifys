"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTicketEmailDeliveries,
  resendTicketEmails,
  TicketEmailDeliveries,
  TicketEmailDeliveryStatus,
  TicketEmailKind,
} from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/lib/toast-context";

const STATUS_META: Record<
  TicketEmailDeliveryStatus,
  { label: string; className: string; hint: string }
> = {
  failed: {
    label: "Failed",
    className: "text-coral-deep bg-coral/10",
    hint: "Could not be sent after several attempts.",
  },
  queued: {
    label: "Sending",
    className: "text-gold bg-gold/10",
    hint: "Waiting to send or retrying.",
  },
  sent: {
    label: "Sent",
    className: "text-emerald bg-emerald/10",
    hint: "Accepted by the mail server.",
  },
  not_sent: {
    label: "Not sent",
    className: "text-sage bg-sage/10",
    hint: "Never sent to this person.",
  },
  untracked: {
    label: "Unknown",
    className: "text-sage bg-sage/10",
    hint: "Sent before delivery tracking existed; the outcome wasn't recorded.",
  },
};

const STATUS_ORDER: TicketEmailDeliveryStatus[] = [
  "failed",
  "queued",
  "sent",
  "not_sent",
  "untracked",
];

const KIND_TABS: { kind: TicketEmailKind; label: string }[] = [
  { kind: "ticket", label: "Ticket emails" },
  { kind: "date_update", label: "New-date emails" },
];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.body.message : fallback;
}

// Who got their ticket email and who didn't, per kind of email, with
// resend for the failures (all at once or one person at a time). "Sent"
// means the mail server accepted it — a later bounce from a mistyped
// address doesn't show up here.
export function EmailDeliveryPanel({
  eventSlug,
  canResend,
  isSuperAdmin,
}: {
  eventSlug: string;
  canResend: boolean;
  isSuperAdmin: boolean;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<TicketEmailKind>("ticket");
  const [data, setData] = useState<TicketEmailDeliveries | null>(null);
  const [filter, setFilter] = useState<TicketEmailDeliveryStatus | "all">(
    "failed",
  );
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // The new-date email is a super-admin action, so only they can resend it.
  const resendAllowed = canResend && (kind === "ticket" || isSuperAdmin);

  const load = useCallback(async () => {
    try {
      setData(await getTicketEmailDeliveries(eventSlug, kind));
    } catch (err) {
      toast.error(errorMessage(err, "Failed to load email delivery status."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug, kind]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // While anything is still going out, keep the statuses fresh.
  const sending = (data?.summary.queued ?? 0) > 0;
  useEffect(() => {
    if (!sending) return;
    const id = setInterval(() => void load(), 5000);
    return () => clearInterval(id);
  }, [sending, load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.rows.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!q ||
          r.fullName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.ticketCode.toLowerCase().includes(q)),
    );
  }, [data, filter, search]);

  async function resend(ticketIds?: string[]) {
    setBusy(ticketIds ? ticketIds[0] : "all");
    try {
      const { queued } = await resendTicketEmails(eventSlug, kind, ticketIds);
      toast.success(
        `Resending to ${queued} ${queued === 1 ? "person" : "people"}.`,
      );
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not resend."));
    } finally {
      setBusy(null);
    }
  }

  const failedCount = data?.summary.failed ?? 0;

  return (
    <div className="border border-emerald/20 rounded-2xl bg-white px-6 py-4 shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <p className="font-bricolage font-semibold text-forest">
          Ticket email delivery
        </p>
        {isSuperAdmin && (
          <div className="flex rounded-full border border-emerald/20 p-0.5 text-xs">
            {KIND_TABS.map((tab) => (
              <button
                key={tab.kind}
                type="button"
                onClick={() => {
                  setKind(tab.kind);
                  setData(null);
                }}
                className={`px-3 py-1 rounded-full transition-colors ${
                  kind === tab.kind
                    ? "bg-emerald text-white"
                    : "text-sage hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-sm text-sage mb-4">
        {kind === "ticket"
          ? "Whether each ticket holder's ticket email went out. Resending sends the same ticket (same QR code and ticket code)."
          : "Whether each ticket holder got the email with the new event date. Resending sends the same ticket with the date-change note."}
      </p>

      {!data && <p className="text-sm text-sage">Loading…</p>}

      {data && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                filter === "all"
                  ? "border-forest text-forest"
                  : "border-emerald/20 text-sage"
              }`}
            >
              All · {data.total}
            </button>
            {STATUS_ORDER.filter(
              (s) => data.summary[s] > 0 || s === "failed",
            ).map((s) => (
              <button
                key={s}
                type="button"
                title={STATUS_META[s].hint}
                onClick={() => setFilter(s)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  filter === s ? "border-forest" : "border-transparent"
                } ${STATUS_META[s].className}`}
              >
                {STATUS_META[s].label} · {data.summary[s]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email or ticket code"
              className="flex-1 min-w-48 border border-emerald/20 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gold"
            />
            {resendAllowed && failedCount > 0 && (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void resend()}
                className="bg-coral text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-coral-deep transition-colors disabled:opacity-50"
              >
                {busy === "all"
                  ? "Resending…"
                  : `Resend to ${failedCount} failed`}
              </button>
            )}
          </div>

          <div className="border border-emerald/20 rounded-xl overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Status</th>
                  {resendAllowed && <th className="px-3 py-2" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.ticketId}
                    className="border-b border-emerald/20 last:border-0 align-top"
                  >
                    <td className="px-3 py-2">
                      <a
                        href={`/admin/registrations/${r.registrationId}`}
                        className="text-ink hover:underline"
                      >
                        {r.fullName}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-ink break-all">{r.email}</td>
                    <td className="px-3 py-2">
                      <span
                        title={STATUS_META[r.status].hint}
                        className={`inline-block text-xs px-2 py-0.5 rounded-full ${STATUS_META[r.status].className}`}
                      >
                        {STATUS_META[r.status].label}
                      </span>
                      {r.status === "sent" && r.sentAt && (
                        <span className="block text-xs text-sage mt-0.5">
                          {formatDateTime(r.sentAt)}
                        </span>
                      )}
                      {r.error && r.status !== "sent" && (
                        <span className="block text-xs text-sage mt-0.5 break-words">
                          {r.error}
                        </span>
                      )}
                    </td>
                    {resendAllowed && (
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {r.status !== "queued" && (
                          <button
                            type="button"
                            disabled={busy !== null}
                            onClick={() => void resend([r.ticketId])}
                            className="text-xs text-emerald underline hover:text-forest disabled:opacity-50"
                          >
                            {busy === r.ticketId
                              ? "Resending…"
                              : r.status === "not_sent"
                                ? "Send"
                                : "Resend"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      colSpan={resendAllowed ? 4 : 3}
                      className="px-3 py-6 text-center text-sage"
                    >
                      {filter === "failed" && !search
                        ? "No failed emails."
                        : "Nobody matches."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
