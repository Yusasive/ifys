"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  fetchRegistrationDetail,
  markPaid,
  RegistrationDetail,
  resendTicket,
  voidTicket,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { formatKobo, CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { AdminHeader } from "../../admin-header";
import { StatusBadge } from "../../status-badge";

export default function RegistrationDetailPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [registration, setRegistration] = useState<RegistrationDetail | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [voidPassword, setVoidPassword] = useState("");
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  async function load() {
    if (!session) return;
    const detail = await fetchRegistrationDetail(session.token, params.id);
    setRegistration(detail);
  }

  useEffect(() => {
    if (!session) return;
    const token = session.token;
    let cancelled = false;

    async function init() {
      const detail = await fetchRegistrationDetail(token, params.id);
      if (!cancelled) setRegistration(detail);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [session, params.id]);

  async function runAction(fn: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await fn();
      setActionMessage(successMessage);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.body.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !session || !registration) {
    return (
      <div>
        <AdminHeader />
      </div>
    );
  }

  return (
    <div>
      <AdminHeader />
      <main className="max-w-3xl mx-auto px-6 py-8">
        <button onClick={() => router.push("/admin")} className="text-sm text-muted underline mb-6">
          ← Back to registrations
        </button>

        <div className="border border-line rounded-sm bg-white p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="font-display text-2xl">{registration.attendee.fullName}</h1>
              <p className="text-sm text-muted">
                {registration.attendee.email} · {registration.attendee.phone}
              </p>
            </div>
            <StatusBadge status={registration.status} />
          </div>

          <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
            <dt className="text-muted">Category</dt>
            <dd className="text-right">
              {CATEGORY_LABELS[registration.ticketProduct.category]}
            </dd>
            <dt className="text-muted">Tier</dt>
            <dd className="text-right">{TIER_LABELS[registration.ticketProduct.tier]}</dd>
            <dt className="text-muted">Price</dt>
            <dd className="text-right font-mono">
              {formatKobo(registration.ticketProduct.priceKobo, registration.ticketProduct.currency)}
            </dd>
            {registration.order && (
              <>
                <dt className="text-muted">Payment status</dt>
                <dd className="text-right">
                  <StatusBadge status={registration.order.status} />
                </dd>
              </>
            )}
          </dl>

          <div className="border-t border-line pt-4 mb-4">
            <h2 className="text-xs uppercase tracking-wide text-muted mb-2">
              Submission
            </h2>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              {Object.entries(registration.formDataJson).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted">{key}</dt>
                  <dd className="text-right break-all">{String(value)}</dd>
                </div>
              ))}
            </dl>
            {registration.studentIdSignedUrl && (
              <a
                href={registration.studentIdSignedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block mt-3 text-sm underline text-emerald"
              >
                View uploaded student ID
              </a>
            )}
          </div>

          {registration.ticket && (
            <div className="border-t border-line pt-4">
              <h2 className="text-xs uppercase tracking-wide text-muted mb-2">Ticket</h2>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted">Code</dt>
                <dd className="text-right font-mono">{registration.ticket.ticketCode}</dd>
                <dt className="text-muted">Status</dt>
                <dd className="text-right">
                  <StatusBadge status={registration.ticket.status} />
                </dd>
              </dl>
            </div>
          )}
        </div>

        {actionError && (
          <p className="text-sm text-red-700 border border-red-300 rounded-sm px-3 py-2 mb-4">
            {actionError}
          </p>
        )}
        {actionMessage && (
          <p className="text-sm text-emerald border border-emerald/30 rounded-sm px-3 py-2 mb-4">
            {actionMessage}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {registration.status !== "paid" && (
            <button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => markPaid(session.token, registration.id),
                  "Marked as paid and ticket issued.",
                )
              }
              className="border border-ink px-4 py-2 rounded-sm text-sm disabled:opacity-50"
            >
              Mark as paid
            </button>
          )}
          {registration.ticket && (
            <button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => resendTicket(session.token, registration.id),
                  "Ticket email resent.",
                )
              }
              className="border border-ink px-4 py-2 rounded-sm text-sm disabled:opacity-50"
            >
              Resend ticket
            </button>
          )}
          {registration.ticket && registration.ticket.status !== "void" && (
            <button
              disabled={busy}
              onClick={() => setShowVoidConfirm(true)}
              className="border border-red-700 text-red-700 px-4 py-2 rounded-sm text-sm disabled:opacity-50"
            >
              Void ticket
            </button>
          )}
        </div>

        {showVoidConfirm && (
          <div className="mt-4 border border-red-300 rounded-sm p-4 bg-red-50">
            <p className="text-sm mb-3">
              Voiding a ticket cannot be undone. Re-enter your password to confirm.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={voidPassword}
                onChange={(e) => setVoidPassword(e.target.value)}
                placeholder="Your password"
                className="border border-line rounded-sm px-3 py-1.5 text-sm flex-1"
              />
              <button
                disabled={busy || !voidPassword}
                onClick={() =>
                  void runAction(async () => {
                    await voidTicket(session.token, registration.id, voidPassword);
                    setShowVoidConfirm(false);
                    setVoidPassword("");
                  }, "Ticket voided.")
                }
                className="bg-red-700 text-white px-4 py-1.5 rounded-sm text-sm disabled:opacity-50"
              >
                Confirm void
              </button>
              <button
                onClick={() => {
                  setShowVoidConfirm(false);
                  setVoidPassword("");
                }}
                className="text-sm text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
