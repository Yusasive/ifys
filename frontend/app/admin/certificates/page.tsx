"use client";

import { useEffect, useMemo, useState } from "react";
import { CertificateRecipient, fetchCertificateRecipients, sendTestCertificate } from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { describeError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { downloadCertificates } from "./certificate-image";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

const DELIVERY_LABELS: Record<CertificateRecipient["delivery"], string> = {
  not_sent: "Not sent yet",
  queued: "Sending…",
  sent: "Emailed",
  failed: "Failed",
};

export default function AdminCertificatesPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const toast = useToast();

  const [recipients, setRecipients] = useState<CertificateRecipient[]>([]);
  const [sendAt, setSendAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testName, setTestName] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchCertificateRecipients(EVENT_SLUG)
      .then((data) => {
        if (cancelled) return;
        setRecipients(data.recipients);
        setSendAt(data.sendAt);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) toast.error(describeError(err, "Failed to load certificate recipients."));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, reloadKey]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return recipients.filter(
      (r) => !needle || r.name.toLowerCase().includes(needle) || r.email.toLowerCase().includes(needle),
    );
  }, [recipients, search]);
  const selectedVisible = visible.filter((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function download(batch: CertificateRecipient[]) {
    if (batch.length === 0 || downloading) return;
    setDownloading(true);
    try {
      await downloadCertificates(batch.map((r) => r.name));
    } catch (err) {
      toast.error(describeError(err, "Failed to create the certificate."));
    } finally {
      setDownloading(false);
    }
  }

  async function sendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail.trim() || sendingTest) return;
    setSendingTest(true);
    try {
      await sendTestCertificate(EVENT_SLUG, testEmail.trim(), testName.trim());
      toast.success(`Sample certificate sent to ${testEmail.trim()}.`);
    } catch (err) {
      toast.error(describeError(err, "Failed to send the sample certificate."));
    } finally {
      setSendingTest(false);
    }
  }

  if (authLoading || !session) return null;

  const sendAtLabel = sendAt
    ? new Date(sendAt).toLocaleString("en-NG", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Africa/Lagos",
      })
    : null;
  const sentCount = recipients.filter((r) => r.delivery === "sent").length;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest">Certificates</h1>
          <p className="text-sm text-sage mt-1 max-w-3xl">
            Certificates of participation for everyone who registered successfully, whether or not they checked in. Each one carries only the
            attendee&rsquo;s name. They are emailed automatically as a PDF
            {sendAtLabel ? ` on ${sendAtLabel} (Nigeria time)` : ""}, and you can download them here as JPEG.
          </p>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors"
        >
          Refresh
        </button>
      </div>

      <form
        onSubmit={sendTest}
        className="flex flex-wrap items-end gap-3 my-6 p-4 border border-emerald/20 rounded-2xl bg-white"
      >
        <div className="w-full text-sm text-ink font-semibold">Send a sample first</div>
        <input
          type="email"
          required
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Your email address"
          className="border border-emerald/20 rounded-full px-4 py-2 text-sm text-ink bg-white w-72 max-w-full focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <input
          type="text"
          value={testName}
          onChange={(e) => setTestName(e.target.value)}
          placeholder="Name on the sample (optional)"
          maxLength={120}
          className="border border-emerald/20 rounded-full px-4 py-2 text-sm text-ink bg-white w-72 max-w-full focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <button
          type="submit"
          disabled={sendingTest}
          className="bg-forest text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-emerald transition-colors disabled:opacity-40"
        >
          {sendingTest ? "Sending…" : "Email sample certificate"}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="border border-emerald/20 rounded-full px-4 py-2 text-sm text-ink bg-white w-72 max-w-full focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        <span className="text-xs text-sage">
          {loaded ? `${recipients.length} registered · ${sentCount} emailed` : "Loading…"}
        </span>
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {selectedVisible.length > 0 && (
            <>
              <button onClick={() => setSelected(new Set())} className="text-sm text-sage underline">
                Clear selection
              </button>
              <button
                disabled={downloading}
                onClick={() => void download(selectedVisible)}
                className="border border-coral text-coral font-semibold px-5 py-2 rounded-full text-sm hover:bg-coral/10 transition-colors disabled:opacity-40"
              >
                Download selected JPEG ({selectedVisible.length})
              </button>
            </>
          )}
          <button
            disabled={visible.length === 0 || downloading}
            onClick={() => void download(visible)}
            className="bg-forest text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-emerald transition-colors disabled:opacity-40"
          >
            {downloading ? "Preparing…" : `Download ${search ? "shown" : "all"} JPEG (${visible.length})`}
          </button>
        </div>
      </div>

      {loaded && visible.length === 0 && (
        <p className="text-sm text-sage border border-dashed border-emerald/20 rounded-2xl p-8 text-center bg-white">
          {recipients.length === 0 ? "No successful registrations yet." : "No one matches your search."}
        </p>
      )}

      {visible.length > 0 && (
        <div className="border border-emerald/20 rounded-2xl bg-white overflow-hidden">
          <ul className="divide-y divide-emerald/10">
            {visible.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  aria-label={`Select ${r.name}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink truncate">{r.name}</p>
                  <p className="text-xs text-sage truncate">{r.email}</p>
                </div>
                <span
                  title={r.deliveryError ?? undefined}
                  className={`text-xs px-2.5 py-1 rounded-full ${
                    r.delivery === "sent"
                      ? "bg-emerald/10 text-emerald"
                      : r.delivery === "failed"
                        ? "bg-coral/15 text-coral-deep"
                        : "bg-gold/15 text-ink"
                  }`}
                >
                  {DELIVERY_LABELS[r.delivery]}
                </span>
                <button
                  disabled={downloading}
                  onClick={() => void download([r])}
                  className="text-xs text-ink underline disabled:opacity-40"
                >
                  Download JPEG
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
