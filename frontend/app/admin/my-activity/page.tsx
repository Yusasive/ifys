"use client";

import { useEffect, useState } from "react";
import { fetchMyActivity, AuditLogEntry } from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { AUDIT_ACTIONS } from "@/lib/audit-actions";
import { ApiError } from "@/lib/api";
import { AuditLogTable } from "../audit-log-table";
import { PaginationFooter } from "../pagination-footer";

const PAGE_SIZE = 20;

export default function MyActivityPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetchMyActivity({
          page,
          pageSize: PAGE_SIZE,
          action: action || undefined,
          from: from || undefined,
          to: to || undefined,
        });
        if (cancelled) return;
        setEntries(res.entries);
        setTotal(res.total);
        setLoadError(null);
        setHasLoadedOnce(true);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.status === 403
            ? "Your account does not have access to this page."
            : "Failed to load your activity.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session, page, action, from, to]);

  if (authLoading || !session) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-6">My activity</h1>

      {loadError && (
        <p className="border border-coral/30 bg-coral/10 text-coral-deep rounded-xl px-4 py-3 text-sm mb-4">
          {loadError}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">Action</span>
          <select
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          >
            <option value="">All</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          />
        </label>
      </div>

      <AuditLogTable entries={entries} loading={loading} hasLoadedOnce={hasLoadedOnce} showActor={false} />

      <PaginationFooter page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
    </main>
  );
}
