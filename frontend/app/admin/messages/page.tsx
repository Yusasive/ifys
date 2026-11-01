"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BroadcastAudience,
  BroadcastContent,
  BroadcastFailure,
  EmailBroadcast,
  listBroadcastFailures,
  listBroadcasts,
  previewBroadcastAudience,
  renderBroadcastPreview,
  resendFailedBroadcast,
  sendBroadcast,
  sendTestBroadcast,
  WhatsAppInviteSettings,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError, describeError } from "@/lib/api";
import { CATEGORY_LABELS, formatDateTime, TIER_LABELS } from "@/lib/format";
import { useToast } from "@/lib/toast-context";
import { FormModal } from "../form-modal";
import { TableRowsSkeleton } from "../skeleton";
import {
  AudienceFilters,
  AudienceMode,
  AudiencePanel,
  PickedPerson,
  STATUS_OPTIONS,
} from "./audience-panel";
import { PRESELECTED_STORAGE_KEY } from "./preselected";
import { RichTextEditor } from "./rich-text-editor";
import { WhatsAppInviteCard } from "./whatsapp-invite-card";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

function describeAudience(a: BroadcastAudience): string {
  if (a.registrationIds?.length) {
    return `${a.registrationIds.length} hand-picked`;
  }
  const parts: string[] = [];
  if (a.categories?.length) parts.push(a.categories.map((c) => CATEGORY_LABELS[c].split(" ")[0]).join(", "));
  if (a.tiers?.length) parts.push(a.tiers.map((t) => TIER_LABELS[t]).join(", "));
  if (a.statuses?.length)
    parts.push(a.statuses.map((s) => STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s).join(", "));
  return parts.length ? parts.join(" · ") : "Everyone";
}

function readPreselected(): Map<string, PickedPerson> {
  if (typeof window === "undefined") return new Map();
  try {
    const entries = JSON.parse(sessionStorage.getItem(PRESELECTED_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(entries) ? new Map(entries as [string, PickedPerson][]) : new Map();
  } catch {
    return new Map();
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return describeError(err, fallback);
}

export default function AdminMessagesPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const toast = useToast();

  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  // Bumped to remount the editor when its content is replaced from outside
  // (template / reset) — Tiptap only reads `content` on creation.
  const [editorKey, setEditorKey] = useState(0);
  // Same wording as the automatic WhatsApp invite, loaded from the server.
  const [whatsAppInvite, setWhatsAppInvite] = useState<WhatsAppInviteSettings | null>(null);

  // A selection handed over from the Registrations page, if any.
  const [preselected] = useState(readPreselected);
  const [mode, setMode] = useState<AudienceMode>(preselected.size > 0 ? "pick" : "filter");
  const [filters, setFilters] = useState<AudienceFilters>({
    categories: [],
    tiers: [],
    statuses: ["paid"],
  });
  const [picked, setPicked] = useState<Map<string, PickedPerson>>(preselected);

  // Server-resolved recipient count, tagged with the audience it was
  // resolved for — it's stale (still loading) while that key differs from
  // the current audience's.
  const [resolvedAudience, setResolvedAudience] = useState<{
    key: string;
    count: number | null;
    sample: PickedPerson[];
  } | null>(null);

  const [history, setHistory] = useState<EmailBroadcast[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<"preview" | "test" | "send" | "resend" | null>(null);
  const [failuresFor, setFailuresFor] = useState<EmailBroadcast | null>(null);
  const [failures, setFailures] = useState<BroadcastFailure[] | null>(null);

  useEffect(() => {
    try {
      sessionStorage.removeItem(PRESELECTED_STORAGE_KEY);
    } catch {
      // Storage unavailable — nothing to clear.
    }
  }, []);

  const audience: BroadcastAudience = useMemo(
    () =>
      mode === "pick"
        ? { registrationIds: [...picked.keys()] }
        : {
            categories: filters.categories,
            tiers: filters.tiers,
            statuses: filters.statuses,
          },
    [mode, picked, filters],
  );
  const audienceKey = JSON.stringify(audience);
  const nobodyPicked = mode === "pick" && picked.size === 0;

  const content: BroadcastContent = {
    subject: subject.trim(),
    bodyHtml,
    ...(ctaLabel.trim() && { ctaLabel: ctaLabel.trim() }),
    ...(ctaUrl.trim() && { ctaUrl: ctaUrl.trim() }),
  };

  // Live recipient count (de-duplicated by email server-side).
  useEffect(() => {
    if (!session || nobodyPicked) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      previewBroadcastAudience(EVENT_SLUG, audience)
        .then((res) => {
          if (!cancelled) setResolvedAudience({ key: audienceKey, count: res.count, sample: res.sample });
        })
        .catch(() => {
          if (!cancelled) setResolvedAudience({ key: audienceKey, count: null, sample: [] });
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, audience, audienceKey, nobodyPicked]);

  const audienceLoading = !nobodyPicked && resolvedAudience?.key !== audienceKey;
  const audienceCount = nobodyPicked ? 0 : (resolvedAudience?.count ?? null);
  const audienceSample = nobodyPicked ? [] : (resolvedAudience?.sample ?? []);

  const loadHistory = useCallback(async () => {
    try {
      const broadcasts = await listBroadcasts(EVENT_SLUG);
      setHistory(broadcasts);
      setHistoryLoaded(true);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof ApiError && err.status === 403
          ? "Your account does not have access to email participants."
          : "Failed to load sent messages.",
      );
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => void loadHistory(), 0);
    return () => clearTimeout(timer);
  }, [session, loadHistory]);

  // While any broadcast is still going out, refresh its progress.
  const inProgress = history.some((b) => b.sentCount + b.failedCount < b.recipientCount);
  useEffect(() => {
    if (!inProgress) return;
    const id = setInterval(() => void loadHistory(), 5000);
    return () => clearInterval(id);
  }, [inProgress, loadHistory]);

  const ctaIncomplete = !!ctaLabel.trim() !== !!ctaUrl.trim();
  const contentReady = !!content.subject && !!bodyHtml && !ctaIncomplete;
  const canSend = contentReady && !!audienceCount && !audienceLoading;

  async function handlePreview() {
    setBusy("preview");
    try {
      const { html } = await renderBroadcastPreview(EVENT_SLUG, content);
      setPreviewHtml(html);
    } catch (err) {
      toast.error(errorMessage(err, "Could not render the preview."));
    } finally {
      setBusy(null);
    }
  }

  async function handleTest() {
    setBusy("test");
    try {
      const { sentTo } = await sendTestBroadcast(EVENT_SLUG, content);
      toast.success(`Test email sent to ${sentTo}.`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not send the test email."));
    } finally {
      setBusy(null);
    }
  }

  async function handleSend() {
    setBusy("send");
    try {
      const { recipientCount } = await sendBroadcast(EVENT_SLUG, content, audience);
      toast.success(
        `Sending to ${recipientCount} ${recipientCount === 1 ? "person" : "people"}. Progress is shown below.`,
      );
      setConfirmOpen(false);
      setSubject("");
      setBodyHtml("");
      setCtaLabel("");
      setCtaUrl("");
      setPicked(new Map());
      setEditorKey((k) => k + 1);
      void loadHistory();
    } catch (err) {
      toast.error(errorMessage(err, "Could not send the message."));
    } finally {
      setBusy(null);
    }
  }

  async function openFailures(broadcast: EmailBroadcast) {
    setFailuresFor(broadcast);
    setFailures(null);
    try {
      setFailures(await listBroadcastFailures(broadcast.id));
    } catch (err) {
      toast.error(errorMessage(err, "Could not load the failed recipients."));
      setFailuresFor(null);
    }
  }

  async function handleResendFailed() {
    if (!failuresFor) return;
    setBusy("resend");
    try {
      const { recipientCount } = await resendFailedBroadcast(failuresFor.id);
      toast.success(
        `Resending to ${recipientCount} ${recipientCount === 1 ? "person" : "people"}. Progress is shown below.`,
      );
      setFailuresFor(null);
      void loadHistory();
    } catch (err) {
      toast.error(errorMessage(err, "Could not resend the message."));
    } finally {
      setBusy(null);
    }
  }

  function applyWhatsAppTemplate() {
    if (!whatsAppInvite) return;
    setSubject(whatsAppInvite.subject);
    setBodyHtml(whatsAppInvite.bodyHtml);
    setCtaLabel(whatsAppInvite.ctaLabel);
    if (whatsAppInvite.whatsappGroupUrl) setCtaUrl(whatsAppInvite.whatsappGroupUrl);
    setEditorKey((k) => k + 1);
  }

  if (authLoading || !session) return null;

  if (loadError && !historyLoaded) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="border border-coral/30 bg-coral/10 text-coral-deep rounded-xl px-4 py-3 text-sm">
          {loadError}
        </p>
      </main>
    );
  }

  const inputClass =
    "w-full border border-emerald/20 rounded-xl px-3 py-2 text-sm text-ink bg-white focus:outline-none focus:border-gold";
  const recipientsLabel =
    audienceCount === null ? "—" : `${audienceCount} ${audienceCount === 1 ? "person" : "people"}`;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-1">Email participants</h1>
      <p className="text-sm text-sage mb-6">
        Send a message, such as the WhatsApp group link, to registered participants.
      </p>

      <WhatsAppInviteCard eventSlug={EVENT_SLUG} onLoaded={setWhatsAppInvite} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        {/* Compose */}
        <section className="border border-emerald/20 rounded-2xl bg-white shadow-sm p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bricolage font-bold text-lg text-forest">Message</h2>
            <button
              type="button"
              onClick={applyWhatsAppTemplate}
              disabled={!whatsAppInvite}
              className="text-sm text-emerald underline hover:text-forest disabled:opacity-50"
            >
              Use WhatsApp group template
            </button>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-sage">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="e.g. Join the IFY Summit WhatsApp group"
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-sage">Body</span>
            <RichTextEditor key={editorKey} value={bodyHtml} onChange={setBodyHtml} />
            <span className="text-xs text-sage">
              Tip: <span className="font-mono">{"{{name}}"}</span> is replaced with each person&apos;s first name.
            </span>
          </div>

          <fieldset className="border border-emerald/20 rounded-xl p-4 flex flex-col gap-3">
            <legend className="px-1 text-xs text-sage">Button (optional)</legend>
            <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-sage">Button text</span>
                <input
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  maxLength={60}
                  placeholder="Join the WhatsApp group"
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-sage">Button link</span>
                <input
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  type="url"
                  placeholder="https://chat.whatsapp.com/…"
                  className={inputClass}
                />
              </label>
            </div>
            {ctaIncomplete && (
              <p className="text-xs text-coral-deep">Fill in both the button text and link, or leave both empty.</p>
            )}
          </fieldset>
        </section>

        {/* Recipients */}
        <aside className="border border-emerald/20 rounded-2xl bg-white shadow-sm p-5 flex flex-col gap-4 lg:sticky lg:top-6">
          <h2 className="font-bricolage font-bold text-lg text-forest">Recipients</h2>
          <AudiencePanel
            mode={mode}
            onModeChange={setMode}
            filters={filters}
            onFiltersChange={setFilters}
            picked={picked}
            onPickedChange={setPicked}
          />

          <div className="border-t border-emerald/20 pt-4">
            <p className="text-sm text-ink">
              Will be sent to{" "}
              <strong className={audienceLoading ? "opacity-50" : ""}>{recipientsLabel}</strong>
            </p>
            {audienceSample.length > 0 && !!audienceCount && (
              <p className="text-xs text-sage mt-1">
                {audienceSample
                  .slice(0, 4)
                  .map((p) => p.fullName)
                  .join(", ")}
                {audienceCount > 4 ? ` and ${audienceCount - 4} more` : ""}
              </p>
            )}
            <p className="text-xs text-sage mt-1">Each email address only receives the message once.</p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!contentReady || busy !== null}
                onClick={() => void handlePreview()}
                className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
              >
                {busy === "preview" ? "Loading…" : "Preview"}
              </button>
              <button
                type="button"
                disabled={!contentReady || busy !== null}
                onClick={() => void handleTest()}
                className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
              >
                {busy === "test" ? "Sending…" : "Send test to me"}
              </button>
            </div>
            <button
              type="button"
              disabled={!canSend || busy !== null}
              onClick={() => setConfirmOpen(true)}
              className="bg-emerald text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-forest transition-colors disabled:opacity-50"
            >
              Send to {recipientsLabel}
            </button>
            {!contentReady && <p className="text-xs text-sage text-center">Add a subject and message to send.</p>}
          </div>
        </aside>
      </div>

      {/* History */}
      <section className="mt-10">
        <h2 className="font-bricolage font-bold text-lg text-forest mb-3">Sent messages</h2>
        <div className="border border-emerald/20 rounded-2xl overflow-x-auto bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
                <th className="px-4 py-2">Sent</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Audience</th>
                <th className="px-4 py-2">By</th>
                <th className="px-4 py-2">Delivery</th>
              </tr>
            </thead>
            <tbody>
              {!historyLoaded && <TableRowsSkeleton rows={3} cols={5} />}
              {history.map((b) => {
                const done = b.sentCount + b.failedCount;
                const pending = done < b.recipientCount;
                return (
                  <tr key={b.id} className="border-b border-emerald/20 last:border-0">
                    <td className="px-4 py-2 text-sage whitespace-nowrap">{formatDateTime(b.createdAt)}</td>
                    <td className="px-4 py-2 text-ink">{b.subject}</td>
                    <td className="px-4 py-2 text-sage">{describeAudience(b.audienceJson)}</td>
                    <td className="px-4 py-2 text-sage">{b.createdByName ?? "—"}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-mono text-ink">
                        {b.sentCount}/{b.recipientCount}
                      </span>{" "}
                      {pending ? (
                        <span className="text-gold text-xs">sending…</span>
                      ) : (
                        <span className="text-emerald text-xs">done</span>
                      )}
                      {b.failedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void openFailures(b)}
                          className="text-coral-deep text-xs ml-1 underline hover:text-coral"
                        >
                          · {b.failedCount} failed
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {historyLoaded && history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sage">
                    No messages sent yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <FormModal
        open={previewHtml !== null}
        title="Email preview"
        description={`Subject: ${content.subject} · shown with a sample name`}
        onClose={() => setPreviewHtml(null)}
        size="lg"
      >
        {previewHtml && (
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            sandbox=""
            className="w-full h-[60vh] rounded-xl border border-emerald/20"
          />
        )}
      </FormModal>

      <FormModal
        open={failuresFor !== null}
        title="Failed recipients"
        description={
          failuresFor
            ? `"${failuresFor.subject}" could not be delivered to these people after several attempts.`
            : undefined
        }
        onClose={() => busy !== "resend" && setFailuresFor(null)}
        size="lg"
      >
        {failures === null ? (
          <p className="text-sm text-sage">Loading…</p>
        ) : failures.length === 0 ? (
          <p className="text-sm text-sage">
            There are no failed recipients on record for this message. Sends that failed before failures were tracked
            can&apos;t be listed.
          </p>
        ) : (
          <div className="border border-emerald/20 rounded-xl overflow-x-auto max-h-[50vh] overflow-y-auto mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.email} className="border-b border-emerald/20 last:border-0 align-top">
                    <td className="px-3 py-2 text-ink">{f.fullName}</td>
                    <td className="px-3 py-2 text-ink break-all">{f.email}</td>
                    <td className="px-3 py-2 text-sage text-xs break-words">{f.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={busy === "resend"}
            onClick={() => setFailuresFor(null)}
            className="text-sage underline text-sm"
          >
            Close
          </button>
          {!!failures?.length && (
            <button
              type="button"
              disabled={busy === "resend"}
              onClick={() => void handleResendFailed()}
              className="bg-emerald text-white px-5 py-2 rounded-full text-sm hover:bg-forest transition-colors disabled:opacity-50"
            >
              {busy === "resend"
                ? "Resending…"
                : `Resend to ${failures.length} ${failures.length === 1 ? "person" : "people"}`}
            </button>
          )}
        </div>
      </FormModal>

      <FormModal
        open={confirmOpen}
        title={`Send to ${recipientsLabel}?`}
        description="The emails go out right away and this can't be undone."
        onClose={() => busy !== "send" && setConfirmOpen(false)}
      >
        <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 mb-5">
          <dt className="text-sage">Subject</dt>
          <dd className="text-ink">{content.subject}</dd>
          <dt className="text-sage">Audience</dt>
          <dd className="text-ink">{describeAudience(audience)}</dd>
          {content.ctaUrl && (
            <>
              <dt className="text-sage">Button</dt>
              <dd className="text-ink break-all">
                {content.ctaLabel} → {content.ctaUrl}
              </dd>
            </>
          )}
        </dl>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            disabled={busy === "send"}
            onClick={() => setConfirmOpen(false)}
            className="text-sage underline text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy === "send"}
            onClick={() => void handleSend()}
            className="bg-emerald text-white px-5 py-2 rounded-full text-sm hover:bg-forest transition-colors disabled:opacity-50"
          >
            {busy === "send" ? "Sending…" : "Send now"}
          </button>
        </div>
      </FormModal>
    </main>
  );
}
