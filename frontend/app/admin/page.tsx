"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminStats, fetchRegistrations, fetchStats, RegistrationListItem } from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Skeleton, StatCardsSkeleton } from "./skeleton";
import { StatusBadge } from "./status-badge";

const RECENT_PAGE_SIZE = 5;

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-line rounded-sm p-4 bg-white">
      <div className="text-xs uppercase tracking-wide text-muted mb-1">{label}</div>
      <div className="font-mono text-2xl">{value}</div>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recent, setRecent] = useState<RegistrationListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function load() {
      if (!session) return;
      try {
        const [statsRes, recentRes] = await Promise.all([
          fetchStats(),
          fetchRegistrations({ page: 1, pageSize: RECENT_PAGE_SIZE }),
        ]);
        if (cancelled) return;
        setStats(statsRes);
        setRecent(recentRes.registrations);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof ApiError && err.status === 403
            ? "Your account does not have access to this dashboard."
            : "Failed to load stats.",
        );
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (authLoading || !session) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-display text-2xl mb-6">Overview</h1>

      {loadError && (
        <p className="border border-red-300 bg-red-50 text-red-700 rounded-sm px-4 py-3 text-sm mb-6">
          {loadError}
        </p>
      )}

      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total registrations" value={stats.total} />
          <StatCard label="Paid" value={stats.byStatus.paid ?? 0} />
          <StatCard label="Pending payment" value={stats.byStatus.pending_payment ?? 0} />
          <StatCard label="Tickets issued" value={stats.ticketsIssued} />
        </div>
      ) : (
        !loadError && <div className="mb-8"><StatCardsSkeleton /></div>
      )}

      <div className="border border-line rounded-sm bg-white p-4">
        <h2 className="text-xs uppercase tracking-wide text-muted mb-3">Recent registrations</h2>
        {recent ? (
          recent.length > 0 ? (
            <ul className="flex flex-col divide-y divide-line">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/registrations/${r.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-paper-2 -mx-2 px-2 rounded-sm"
                  >
                    <span className="truncate">{r.attendee.fullName}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={r.status} />
                      <span className="text-muted text-xs">{formatDateTime(r.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No registrations yet.</p>
          )
        ) : (
          !loadError && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: RECENT_PAGE_SIZE }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
