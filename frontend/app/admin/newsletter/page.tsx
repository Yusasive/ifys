"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import {
  deleteNewsletterSubscriber,
  getNewsletterExportStatus,
  listNewsletterSubscribers,
  NewsletterSubscriber,
  requestNewsletterExport,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { PaginationFooter } from "../pagination-footer";
import { TableRowsSkeleton } from "../skeleton";

const PAGE_SIZE = 20;

export default function AdminNewsletterPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportState, setExportState] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const toast = useToast();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { subscribers: list, total: listTotal } = await listNewsletterSubscribers({
          page,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) {
          setSubscribers(list);
          setTotal(listTotal);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof ApiError ? err.body.message : "Failed to load subscribers.",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, page, reloadKey]);

  async function handleDelete(subscriber: NewsletterSubscriber) {
    if (!session) return;
    setDeleting(true);
    try {
      await deleteNewsletterSubscriber(subscriber.id);
      toast.success(`${subscriber.email} removed.`);
      setDeleteConfirmId(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.body.message : "Failed to remove subscriber.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    if (!session) return;
    setExportState("queued");
    setExportUrl(null);
    const { jobId } = await requestNewsletterExport();
    const poll = async () => {
      if (!session) return;
      const result = await getNewsletterExportStatus(jobId);
      if (result.state === "completed" && result.downloadUrl) {
        setExportState("completed");
        setExportUrl(result.downloadUrl);
        return;
      }
      setExportState(result.state);
      setTimeout(() => void poll(), 1500);
    };
    void poll();
  }

  if (authLoading || !session) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bricolage font-bold text-2xl text-forest">Newsletter subscribers</h1>
        <div className="flex items-center gap-3">
          {exportState === "completed" && exportUrl ? (
            <a
              href={exportUrl}
              className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors"
            >
              Download CSV
            </a>
          ) : (
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exportState !== null && exportState !== "completed"}
              className="border border-emerald text-emerald px-4 py-2 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
            >
              {exportState && exportState !== "completed"
                ? "Preparing export…"
                : "Export CSV"}
            </button>
          )}
        </div>
      </div>

      <div className="border border-emerald/20 rounded-2xl bg-white overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Subscribed</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <TableRowsSkeleton rows={5} cols={3} />}
            {loaded && subscribers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sage">
                  No subscribers yet.
                </td>
              </tr>
            )}
            {subscribers.map((subscriber) => (
              <Fragment key={subscriber.id}>
                <tr className="border-b border-emerald/20 last:border-0">
                  <td className="px-4 py-2">{subscriber.email}</td>
                  <td className="px-4 py-2 text-sage">
                    {new Date(subscriber.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => setDeleteConfirmId(subscriber.id)}
                      className="text-sm text-coral-deep underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
                {deleteConfirmId === subscriber.id && (
                  <tr className="border-b border-emerald/20 last:border-0">
                    <td colSpan={3} className="px-4 py-3 bg-coral/10">
                      <div className="flex items-center gap-3">
                        <p className="text-sm">
                          Remove {subscriber.email}? This cannot be undone.
                        </p>
                        <button
                          disabled={deleting}
                          onClick={() => void handleDelete(subscriber)}
                          className="bg-coral-deep text-white px-3 py-1 rounded-full text-sm hover:bg-gold-deep transition-colors disabled:opacity-50"
                        >
                          Confirm delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-sm text-sage"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationFooter page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </main>
  );
}
