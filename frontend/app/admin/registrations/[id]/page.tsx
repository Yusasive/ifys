"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  approveStudentRegistration,
  cancelRegistration,
  changeAttendeeEmail,
  fetchRegistrationDetail,
  markPaid,
  reissueTicket,
  RegistrationDetail,
  rejectStudentRegistration,
  resendTicket,
  restoreTicket,
  sendPendingPaymentReminder,
  voidTicket,
  withdrawTicket,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { describeError } from "@/lib/api";
import { formatDateTime, formatKobo, CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { DetailCardSkeleton } from "../../skeleton";
import { StatusBadge } from "../../status-badge";
import { paymentChannelLabel } from "../../payment-channel";
import { useToast } from "@/lib/toast-context";
import { ReasonModal } from "../../reason-modal";
import { ChangeEmailModal } from "./change-email-modal";

const TICKET_ACTION_LABELS: Record<string, string> = {
  reissued: "Reissued",
  voided: "Voided",
  restored: "Restored",
  withdrawn: "Withdrawn",
};

export default function RegistrationDetailPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [registration, setRegistration] = useState<RegistrationDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [showMarkPaidConfirm, setShowMarkPaidConfirm] = useState(false);
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);
  const [showReissueConfirm, setShowReissueConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRejectStudentConfirm, setShowRejectStudentConfirm] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const toast = useToast();
  const permissions = session?.user.permissions;

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
      toast.error(describeError(err, "Action failed"));
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
                {session.user.role === "super_admin" && (
                  <>
                    {" · "}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setShowChangeEmail(true)}
                      className="underline text-emerald hover:text-forest disabled:opacity-50"
                    >
                      Change email
                    </button>
                  </>
                )}
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
                <dt className="text-sage">Paid via</dt>
                <dd className="text-right">{paymentChannelLabel(registration.order.paymentChannel)}</dd>
                {registration.order.paidAt && (
                  <>
                    <dt className="text-sage">Paid at</dt>
                    <dd className="text-right">{formatDateTime(registration.order.paidAt)}</dd>
                  </>
                )}
              </>
            )}
            {registration.coupon && (
              <>
                <dt className="text-sage">Coupon used</dt>
                <dd className="text-right font-mono">{registration.coupon.code}</dd>
                <dt className="text-sage">Discount applied</dt>
                <dd className="text-right">
                  {formatKobo(registration.discountAppliedKobo, registration.ticketProduct.currency)}
                </dd>
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

              {registration.ticket.lastActionType && (
                <p className="text-xs text-sage mt-2">
                  Last action: {TICKET_ACTION_LABELS[registration.ticket.lastActionType]}
                  {registration.ticket.lastActionAt &&
                    ` · ${formatDateTime(registration.ticket.lastActionAt)}`}
                  {registration.ticket.lastActionReason &&
                    ` — "${registration.ticket.lastActionReason}"`}
                </p>
              )}

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
          {registration.status === "pending_review" &&
            hasPermission(permissions, "registrations.approveStudent") && (
              <button
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => approveStudentRegistration(registration.id),
                    "Approved — ticket issued and emailed.",
                  )
                }
                className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
              >
                Approve student registration
              </button>
            )}
          {registration.status === "pending_review" &&
            hasPermission(permissions, "registrations.rejectStudent") && (
              <button
                disabled={busy}
                onClick={() => setShowRejectStudentConfirm(true)}
                className="border border-coral-deep text-coral-deep px-4 py-2 rounded-full text-sm hover:bg-coral-deep hover:text-white transition-colors disabled:opacity-50"
              >
                Reject student registration
              </button>
            )}
          {registration.status !== "paid" &&
            registration.status !== "pending_review" &&
            hasPermission(permissions, "registrations.markPaid") && (
              <button
                disabled={busy}
                onClick={() => setShowMarkPaidConfirm(true)}
                className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
              >
                Mark as paid
              </button>
            )}
          {registration.ticket && hasPermission(permissions, "registrations.resendTicket") && (
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
          {registration.ticket &&
            registration.ticket.status !== "void" &&
            hasPermission(permissions, "registrations.reissueTicket") && (
              <button
                disabled={busy}
                onClick={() => setShowReissueConfirm(true)}
                className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
              >
                Reissue ticket
              </button>
            )}
          {registration.ticket &&
            registration.ticket.status === "void" &&
            hasPermission(permissions, "registrations.restoreTicket") && (
              <button
                disabled={busy}
                onClick={() => setShowRestoreConfirm(true)}
                className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
              >
                Restore ticket
              </button>
            )}
          {registration.ticket &&
            registration.ticket.status !== "void" &&
            registration.ticket.lastActionType !== "reissued" &&
            hasPermission(permissions, "registrations.voidTicket") && (
              <button
                disabled={busy}
                onClick={() => setShowVoidConfirm(true)}
                className="border border-coral-deep text-coral-deep px-4 py-2 rounded-full text-sm hover:bg-coral-deep hover:text-white transition-colors disabled:opacity-50"
              >
                Void ticket
              </button>
            )}
          {registration.ticket &&
            registration.ticket.status !== "void" &&
            registration.ticket.lastActionType === "reissued" &&
            hasPermission(permissions, "registrations.withdrawTicket") && (
              <button
                disabled={busy}
                onClick={() => setShowWithdrawConfirm(true)}
                className="border border-coral-deep text-coral-deep px-4 py-2 rounded-full text-sm hover:bg-coral-deep hover:text-white transition-colors disabled:opacity-50"
              >
                Withdraw ticket
              </button>
            )}
          {registration.status === "pending_payment" &&
            hasPermission(permissions, "registrations.sendReminder") && (
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
          {registration.status === "pending_payment" &&
            hasPermission(permissions, "registrations.cancel") && (
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

        <ChangeEmailModal
          open={showChangeEmail}
          currentEmail={registration.attendee.email}
          busy={busy}
          onCancel={() => setShowChangeEmail(false)}
          onConfirm={(email, reason) =>
            runAction(
              async () => {
                await changeAttendeeEmail(registration.id, email, reason);
                setShowChangeEmail(false);
              },
              registration.ticket
                ? "Email updated — click Resend ticket to send it there."
                : "Email updated.",
            )
          }
        />

        <ReasonModal
          open={showMarkPaidConfirm}
          title="Mark as paid"
          description="This issues a ticket and emails it to the attendee."
          reasonLabel="Reason (e.g. bank transfer confirmed manually)"
          confirmLabel="Confirm"
          busy={busy}
          onCancel={() => setShowMarkPaidConfirm(false)}
          onConfirm={(reason) =>
            runAction(async () => {
              await markPaid(registration.id, reason);
              setShowMarkPaidConfirm(false);
            }, "Marked as paid and ticket issued.")
          }
        />

        <ReasonModal
          open={showVoidConfirm}
          title="Void ticket"
          description="Voiding a ticket cannot be undone. The attendee is emailed. Re-enter your password to confirm."
          requirePassword
          confirmTone="danger"
          confirmLabel="Confirm void"
          busy={busy}
          onCancel={() => setShowVoidConfirm(false)}
          onConfirm={(reason, password) =>
            runAction(async () => {
              await voidTicket(registration.id, reason, password ?? "");
              setShowVoidConfirm(false);
            }, "Ticket voided.")
          }
        />

        <ReasonModal
          open={showReissueConfirm}
          title="Reissue ticket"
          description="Generates a new ticket code/QR — any earlier copy stops working. The attendee is emailed the new ticket."
          reasonLabel="Reason (e.g. lost original, QR compromised)"
          confirmLabel="Confirm reissue"
          busy={busy}
          onCancel={() => setShowReissueConfirm(false)}
          onConfirm={(reason) =>
            runAction(async () => {
              await reissueTicket(registration.id, reason);
              setShowReissueConfirm(false);
            }, "Ticket reissued and emailed.")
          }
        />

        <ReasonModal
          open={showRestoreConfirm}
          title="Restore ticket"
          description="Brings this ticket back to a valid, scannable state using its existing code. The attendee is emailed."
          reasonLabel="Reason (e.g. voided in error)"
          confirmLabel="Confirm restore"
          busy={busy}
          onCancel={() => setShowRestoreConfirm(false)}
          onConfirm={(reason) =>
            runAction(async () => {
              await restoreTicket(registration.id, reason);
              setShowRestoreConfirm(false);
            }, "Ticket restored.")
          }
        />

        <ReasonModal
          open={showWithdrawConfirm}
          title="Withdraw ticket"
          description="Revokes this reissued ticket — cannot be undone. The attendee is emailed. Re-enter your password to confirm."
          requirePassword
          confirmTone="danger"
          confirmLabel="Confirm withdraw"
          busy={busy}
          onCancel={() => setShowWithdrawConfirm(false)}
          onConfirm={(reason, password) =>
            runAction(async () => {
              await withdrawTicket(registration.id, reason, password ?? "");
              setShowWithdrawConfirm(false);
            }, "Ticket withdrawn.")
          }
        />

        <ReasonModal
          open={showRejectStudentConfirm}
          title="Reject student registration"
          description="This cancels the registration — payment has already been collected, so tell the attendee to contact support about a refund. Re-enter your password to confirm."
          reasonLabel="Rejection reason"
          requirePassword
          confirmTone="danger"
          confirmLabel="Reject registration"
          busy={busy}
          onCancel={() => setShowRejectStudentConfirm(false)}
          onConfirm={(reason, password) =>
            runAction(async () => {
              await rejectStudentRegistration(registration.id, reason, password ?? "");
              setShowRejectStudentConfirm(false);
            }, "Registration rejected.")
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
