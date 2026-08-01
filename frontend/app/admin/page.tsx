"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AdminStats,
  fetchRegistrations,
  fetchStats,
  getExportStatus,
  RegistrationListItem,
  requestExport,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { formatKobo, CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { AdminHeader } from "./admin-header";
import { StatusBadge } from "./status-badge";

const PAGE_SIZE = 20;

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-line rounded-sm p-4 bg-white">
      <div className="text-xs uppercase tracking-wide text-muted mb-1">{label}</div>
      <div className="font-mono text-2xl">{value}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function load() {
      if (!session) return;
      setLoading(true);
      try {
        const [statsRes, listRes] = await Promise.all([
          fetchStats(session.token),
          fetchRegistrations(session.token, {
            page,
            pageSize: PAGE_SIZE,
            status: status || undefined,
            category: category || undefined,
            search: search || undefined,
          }),
        ]);
        if (cancelled) return;
        setStats(statsRes);
        setRegistrations(listRes.registrations);
        setTotal(listRes.total);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.status === 403
            ? "Your account does not have access to this dashboard."
            : "Failed to load registrations.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session, page, status, category, search]);

  async function handleExport() {
    if (!session) return;
    setExportState("queued");
    setExportUrl(null);
    const { jobId } = await requestExport(session.token);
    const poll = async () => {
      const result = await getExportStatus(session.token, jobId);
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

  if (loadError) {
    return (
      <div>
        <AdminHeader />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <p className="border border-red-300 bg-red-50 text-red-700 rounded-sm px-4 py-3 text-sm">
            {loadError}
          </p>
        </main>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader />
      <main className="max-w-6xl mx-auto px-6 py-8">
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total registrations" value={stats.total} />
            <StatCard label="Paid" value={stats.byStatus.paid ?? 0} />
            <StatCard label="Pending payment" value={stats.byStatus.pending_payment ?? 0} />
            <StatCard label="Tickets issued" value={stats.ticketsIssued} />
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Search</span>
            <input
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Name or email"
              className="border border-line rounded-sm px-3 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Status</span>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="border border-line rounded-sm px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="pending_payment">Pending payment</option>
              <option value="paid">Paid</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">Category</span>
            <select
              value={category}
              onChange={(e) => {
                setPage(1);
                setCategory(e.target.value);
              }}
              className="border border-line rounded-sm px-3 py-1.5 text-sm"
            >
              <option value="">All</option>
              <option value="student">Student</option>
              <option value="founder">Founder / Entrepreneur</option>
              <option value="professional">Working Professional</option>
            </select>
          </label>

          <div className="ml-auto flex flex-col gap-1 items-end">
            <button
              onClick={() => void handleExport()}
              disabled={exportState === "queued" || exportState === "waiting" || exportState === "active"}
              className="border border-ink px-4 py-1.5 rounded-sm text-sm disabled:opacity-50"
            >
              {exportState && exportState !== "completed" ? "Exporting…" : "Export CSV"}
            </button>
            {exportUrl && (
              <a href={exportUrl} className="text-xs underline text-emerald">
                Download ready
              </a>
            )}
          </div>
        </div>

        <div className="border border-line rounded-sm overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Category / Tier</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Ticket</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper-2">
                  <td className="px-4 py-2">
                    <Link href={`/admin/registrations/${r.id}`} className="underline">
                      {r.attendee.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted">{r.attendee.email}</td>
                  <td className="px-4 py-2">
                    {CATEGORY_LABELS[r.ticketProduct.category]} · {TIER_LABELS[r.ticketProduct.tier]}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {formatKobo(r.ticketProduct.priceKobo, r.ticketProduct.currency)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2 font-mono">
                    {r.ticket ? (
                      <>
                        {r.ticket.ticketCode}{" "}
                        <StatusBadge status={r.ticket.status} />
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {registrations.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    No registrations match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted">
            {total} total · page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="border border-line px-3 py-1 rounded-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="border border-line px-3 py-1 rounded-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
