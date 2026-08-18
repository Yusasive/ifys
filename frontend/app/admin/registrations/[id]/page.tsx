"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  cancelRegistration,
  fetchRegistrationDetail,
  markPaid,
  RegistrationDetail,
  resendTicket,
  sendPendingPaymentReminder,
  voidTicket,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatKobo, CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { DetailCardSkeleton } from "../../skeleton";
import { StatusBadge } from "../../status-badge";
import { useToast } from "@/lib/toast-context";
import { ReasonModal } from "../../reason-modal";

export default function RegistrationDetailPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [registration, setRegistration] = useState<RegistrationDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const toast = useToast();

  async function load() {
    if (!session) return;
    const detail = await fetchRegistrationDetail(params.id);
    setRegistration(detail);
  }

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function init() {
      const detail = await fetchRegistrationDetail(params.id);
      if (!cancelled) setRegistration(detail);
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [session, params.id]);

  async function runAction(fn: () => Promise<unknown>, successMessage: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !session) {
    return null;
  }

  if (!registration) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-8">
        <button
          onClick={() => router.push("/admin/registrations")}
          className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
        >
          ← Back to registrations
        </button>
        <DetailCardSkeleton />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <button
        onClick={() => router.push("/admin/registrations")}
        className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
      >
        ← Back to registrations
      </button>

        <div className="border border-emerald/20 rounded-2xl bg-white p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="font-bricolage font-bold text-2xl text-forest">{registration.attendee.fullName}</h1>
              <p className="text-sm text-sage">
                {registration.attendee.email} · {registration.attendee.phone}
              </p>
            </div>
            <StatusBadge status={registration.status} />
          </div>

          <dl className="grid grid-cols-2 gap-y-2 text-sm mb-4">
            <dt className="text-sage">Category</dt>
            <dd className="text-right">
              {CATEGORY_LABELS[registration.ticketProduct.category]}
            </dd>
            <dt className="text-sage">Tier</dt>
            <dd className="text-right">{TIER_LABELS[registration.ticketProduct.tier]}</dd>
            <dt className="text-sage">Price</dt>
            <dd className="text-right font-mono">
              {formatKobo(registration.ticketProduct.priceKobo, registration.ticketProduct.currency)}
            </dd>
            <dt className="text-sage">Registered at</dt>
            <dd className="text-right">{formatDateTime(registration.createdAt)}</dd>
            {registration.order && (
              <>
                <dt className="text-sage">Payment status</dt>
                <dd className="text-right">
                  <StatusBadge status={registration.order.status} />
                </dd>
                {registration.order.paidAt && (
                  <>
                    <dt className="text-sage">Paid at</dt>
                    <dd className="text-right">{formatDateTime(registration.order.paidAt)}</dd>
                  </>
                )}
              </>
            )}
            {registration.cancellationReason && (
              <>
                <dt className="text-sage">Cancellation reason</dt>
                <dd className="text-right">{registration.cancellationReason}</dd>
              </>
            )}
          </dl>

          <div className="border-t border-emerald/20 pt-4 mb-4">
            <h2 className="text-xs uppercase tracking-wide text-sage mb-2">
              Submission
            </h2>
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              {Object.entries(registration.formDataJson).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-sage">{key}</dt>
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
            <div className="border-t border-emerald/20 pt-4">
              <h2 className="text-xs uppercase tracking-wide text-sage mb-2">Ticket</h2>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-sage">Code</dt>
                <dd className="text-right font-mono">{registration.ticket.ticketCode}</dd>
                <dt className="text-sage">Status</dt>
                <dd className="text-right">
                  <StatusBadge status={registration.ticket.status} />
                </dd>
                <dt className="text-sage">Issued at</dt>
                <dd className="text-right">{formatDateTime(registration.ticket.issuedAt)}</dd>
              </dl>

              {registration.ticket.checkIns.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs uppercase tracking-wide text-sage mb-2">
                    Check-in history
                  </h3>
                  <dl className="grid grid-cols-2 gap-y-1 text-sm">
                    {registration.ticket.checkIns.map((c) => (
                      <div key={c.id} className="contents">
                        <dt className="text-sage">{c.stationId}</dt>
                        <dd className="text-right">{formatDateTime(c.checkedInAt)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {registration.status !== "paid" && (
            <button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => markPaid(registration.id),
                  "Marked as paid and ticket issued.",
                )
              }
              className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
            >
              Mark as paid
            </button>
          )}
          {registration.ticket && (
            <button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => resendTicket(registration.id),
                  "Ticket email resent.",
                )
              }
              className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
            >
              Resend ticket
            </button>
          )}
          {registration.ticket && registration.ticket.status !== "void" && (
            <button
              disabled={busy}
              onClick={() => setShowVoidConfirm(true)}
              className="border border-coral-deep text-coral-deep px-4 py-2 rounded-full text-sm hover:bg-coral-deep hover:text-white transition-colors disabled:opacity-50"
            >
              Void ticket
            </button>
          )}
          {registration.status === "pending_payment" && (
            <button
              disabled={busy}
              onClick={() =>
                void runAction(
                  () => sendPendingPaymentReminder(registration.id),
                  "Reminder email sent.",
                )
              }
              className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
            >
              Send reminder
            </button>
          )}
          {registration.status === "pending_payment" && (
            <button
              disabled={busy}
              onClick={() => setShowCancelConfirm(true)}
              className="border border-coral-deep text-coral-deep px-4 py-2 rounded-full text-sm hover:bg-coral-deep hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel registration
            </button>
          )}
        </div>

        {registration.status === "pending_payment" && registration.pendingPaymentReminderSentAt && (
          <p className="text-xs text-sage mt-2">
            Reminder last sent: {formatDateTime(registration.pendingPaymentReminderSentAt)}
          </p>
        )}

        <ReasonModal
          open={showVoidConfirm}
          title="Void ticket"
          description="Voiding a ticket cannot be undone. Re-enter your password to confirm."
          reasonRequired={false}
          requirePassword
          confirmTone="danger"
          confirmLabel="Confirm void"
          busy={busy}
          onCancel={() => setShowVoidConfirm(false)}
          onConfirm={(_reason, password) =>
            runAction(async () => {
              await voidTicket(registration.id, password ?? "");
              setShowVoidConfirm(false);
            }, "Ticket voided.")
          }
        />

        <ReasonModal
          open={showCancelConfirm}
          title="Cancel registration"
          description="This will mark the registration as cancelled. This cannot be undone from the dashboard."
          reasonLabel="Cancellation reason"
          requirePassword
          confirmTone="danger"
          confirmLabel="Cancel registration"
          busy={busy}
          onCancel={() => setShowCancelConfirm(false)}
          onConfirm={(reason, password) =>
            runAction(async () => {
              await cancelRegistration(registration.id, reason, password ?? "");
              setShowCancelConfirm(false);
            }, "Registration cancelled.")
          }
        />
    </main>
  );
}
