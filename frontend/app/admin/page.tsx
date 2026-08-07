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

const STAT_ACCENTS = ["bg-emerald", "bg-coral", "bg-gold", "bg-forest"];

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden border border-emerald/20 rounded-2xl p-4 bg-white shadow-sm">
      <div className={`absolute top-0 left-0 h-1 w-full ${accent}`} />
      <div className="font-mono text-xs uppercase tracking-wide text-sage mb-1">{label}</div>
      <div className="font-bricolage font-bold text-3xl text-forest">{value}</div>
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
      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-6">Overview</h1>

      {loadError && (
        <p className="border border-coral/30 bg-coral/10 text-coral-deep rounded-xl px-4 py-3 text-sm mb-6">
          {loadError}
        </p>
      )}

      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total registrations" value={stats.total} accent={STAT_ACCENTS[0]} />
          <StatCard label="Paid" value={stats.byStatus.paid ?? 0} accent={STAT_ACCENTS[1]} />
          <StatCard
            label="Pending payment"
            value={stats.byStatus.pending_payment ?? 0}
            accent={STAT_ACCENTS[2]}
          />
          <StatCard label="Tickets issued" value={stats.ticketsIssued} accent={STAT_ACCENTS[3]} />
        </div>
      ) : (
        !loadError && <div className="mb-8"><StatCardsSkeleton /></div>
      )}

      <div className="border border-emerald/20 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-mono text-xs uppercase tracking-wide text-coral-deep mb-3">
          Recent registrations
        </h2>
        {recent ? (
          recent.length > 0 ? (
            <ul className="flex flex-col divide-y divide-emerald/20">
              {recent.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/admin/registrations/${r.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-emerald/5 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <span className="truncate">{r.attendee.fullName}</span>
                    <span className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={r.status} />
                      <span className="text-sage text-xs">{formatDateTime(r.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-sage">No registrations yet.</p>
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
