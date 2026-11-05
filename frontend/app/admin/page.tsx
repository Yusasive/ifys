"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AdminAnalytics,
  AdminStats,
  BreakdownItem,
  fetchAnalytics,
  fetchRegistrations,
  fetchStats,
  RegistrationListItem,
  remindPendingPayments,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError, describeError } from "@/lib/api";
import { CATEGORY_LABELS, formatDateTime, formatKobo, TIER_LABELS } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { useToast } from "@/lib/toast-context";
import { BarItem, BarList, ColumnChart, LineChart } from "./charts";
import { PaginationFooter } from "./pagination-footer";
import { Skeleton, StatCardsSkeleton } from "./skeleton";
import { StatusBadge } from "./status-badge";

const RECENT_PAGE_SIZE = 5;
const COUPON_PAGE_SIZE = 5;

const STAT_ACCENTS = ["bg-emerald", "bg-coral", "bg-gold", "bg-forest"];

const CHANNEL_LABELS: Record<string, string> = {
  card: "Card",
  bank_transfer: "Bank transfer",
  bank: "Bank account",
  ussd: "USSD",
  qr: "QR",
  mobile_money: "Mobile money",
  free: "Free (100% coupon)",
  manual: "Marked paid by admin",
  unknown: "Not recorded",
};

type BreakdownKey = keyof AdminAnalytics["breakdowns"];

const BREAKDOWN_TABS: { key: BreakdownKey; label: string }[] = [
  { key: "source", label: "How they heard" },
  { key: "campaign", label: "Campaign" },
  { key: "category", label: "Category" },
  { key: "tier", label: "Ticket tier" },
  { key: "industry", label: "Industry" },
  { key: "state", label: "State" },
  { key: "ageRange", label: "Age" },
  { key: "gender", label: "Gender" },
];

function StatCard({
  label,
  value,
  hint,
  accent,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent: string;
  href?: string;
}) {
  const body = (
    <>
      <div className={`absolute top-0 left-0 h-1 w-full ${accent}`} />
      <div className="font-mono text-xs uppercase tracking-wide text-sage mb-1">{label}</div>
      <div className="font-bricolage font-bold text-3xl text-forest">{value}</div>
      {hint && <div className="text-xs text-sage mt-1">{hint}</div>}
    </>
  );
  const className = "relative overflow-hidden border border-emerald/20 rounded-2xl p-4 bg-white shadow-sm";
  return href ? (
    <Link href={href} className={`${className} hover:border-emerald/50 hover:shadow transition`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function Panel({
  title,
  children,
  action,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-emerald/20 rounded-2xl bg-white p-4 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-coral-deep">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function breakdownHref(key: BreakdownKey, label: string): string | undefined {
  if (key === "source") {
    return `/admin/registrations?source=${encodeURIComponent(label === "Not provided" ? "none" : label)}`;
  }
  if (key === "category" || key === "tier") {
    return `/admin/registrations?${key}=${encodeURIComponent(label)}`;
  }
  return undefined;
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function AdminOverviewPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const toast = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [analyticsDenied, setAnalyticsDenied] = useState(false);
  const [recent, setRecent] = useState<RegistrationListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [cumulative, setCumulative] = useState(false);
  const [breakdownKey, setBreakdownKey] = useState<BreakdownKey>("source");
  const [reminding, setReminding] = useState(false);
  const [couponPage, setCouponPage] = useState(1);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function load() {
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
      // Analytics needs the registrations permission; the rest of the
      // overview still works without it.
      try {
        const analyticsRes = await fetchAnalytics();
        if (cancelled) return;
        setAnalytics(analyticsRes);
        setAnalyticsDenied(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) setAnalyticsDenied(true);
        else toast.error(describeError(err, "Failed to load analytics."));
      }
      if (!cancelled) setRefreshing(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, reloadKey]);

  function refresh() {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
  }

  const trend = useMemo(() => {
    if (!analytics) return null;
    const days = analytics.daily;
    const running = (pick: (d: (typeof days)[number]) => number) => {
      let sum = 0;
      return days.map((d) => (sum += pick(d)));
    };
    const values = (pick: (d: (typeof days)[number]) => number) =>
      cumulative ? running(pick) : days.map(pick);
    return {
      labels: days.map((d) => shortDate(d.date)),
      series: [
        { name: "All registrations", color: "var(--color-forest)", values: values((d) => d.total) },
        { name: "Paid", color: "var(--color-emerald)", values: values((d) => d.paid) },
        { name: "Pending payment", color: "var(--color-coral)", values: values((d) => d.pending) },
      ],
    };
  }, [analytics, cumulative]);

  async function remind() {
    if (!analytics || reminding) return;
    const n = analytics.pending.remindable;
    if (
      !window.confirm(
        `Email a payment reminder to ${n} ${n === 1 ? "person" : "people"} who registered over 24 hours ago and haven't paid?`,
      )
    ) {
      return;
    }
    setReminding(true);
    try {
      const { queued } = await remindPendingPayments(24);
      toast.success(`${queued} reminder${queued === 1 ? "" : "s"} queued.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(describeError(err, "Failed to queue reminders."));
    } finally {
      setReminding(false);
    }
  }

  if (authLoading || !session) return null;

  const canRemind = hasPermission(session.user.permissions, "registrations.sendReminder");
  const money = (minor: number) => formatKobo(minor, analytics?.revenue.currency ?? "NGN");
  const couponTotalPages = Math.max(1, Math.ceil((analytics?.coupons.length ?? 0) / COUPON_PAGE_SIZE));
  // A refresh can leave fewer coupons than before; never sit past the end.
  const currentCouponPage = Math.min(couponPage, couponTotalPages);
  const visibleCoupons = (analytics?.coupons ?? []).slice(
    (currentCouponPage - 1) * COUPON_PAGE_SIZE,
    currentCouponPage * COUPON_PAGE_SIZE,
  );
  const breakdown: BreakdownItem[] = analytics?.breakdowns[breakdownKey] ?? [];
  const labelFor = (key: BreakdownKey, label: string) =>
    key === "category" ? (CATEGORY_LABELS[label] ?? label) : key === "tier" ? (TIER_LABELS[label] ?? label) : label;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest">Overview</h1>
        <div className="flex items-center gap-3 text-xs text-sage">
          {analytics && <span>As of {formatDateTime(analytics.asOf)}</span>}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {loadError && (
        <p className="border border-coral/30 bg-coral/10 text-coral-deep rounded-xl px-4 py-3 text-sm mb-6">
          {loadError}
        </p>
      )}

      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <StatCard label="Total registrations" value={stats.total} accent={STAT_ACCENTS[0]} href="/admin/registrations" />
          <StatCard
            label="Paid"
            value={stats.byStatus.paid ?? 0}
            accent={STAT_ACCENTS[1]}
            href="/admin/registrations?status=paid"
          />
          <StatCard
            label="Pending payment"
            value={stats.byStatus.pending_payment ?? 0}
            accent={STAT_ACCENTS[2]}
            href="/admin/registrations?status=pending_payment"
          />
          <StatCard label="Tickets issued" value={stats.ticketsIssued} accent={STAT_ACCENTS[3]} />
        </div>
      ) : (
        !loadError && <div className="mb-4"><StatCardsSkeleton /></div>
      )}

      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <StatCard label="Revenue" value={money(analytics.revenue.totalMinor)} accent="bg-emerald" hint={analytics.revenue.discountMinor > 0 ? `${money(analytics.revenue.discountMinor)} in discounts` : undefined} />
          <StatCard
            label="Paid conversion"
            value={`${analytics.funnel.conversionRate}%`}
            accent="bg-coral"
            hint={`${analytics.funnel.paid} of ${analytics.funnel.registered} who registered`}
          />
          <StatCard
            label="Check-in rate"
            value={`${analytics.eventDay.checkInRate}%`}
            accent="bg-gold"
            hint={`${analytics.eventDay.checkedIn} of ${analytics.eventDay.tickets} tickets`}
          />
          <StatCard
            label="Waiting over 24h"
            value={analytics.pending.between1And3Days + analytics.pending.over3Days}
            accent="bg-forest"
            hint="Registered but not paid"
            href="/admin/registrations?status=pending_payment"
          />
        </div>
      )}

      {analyticsDenied && (
        <p className="border border-emerald/20 bg-white text-sage rounded-xl px-4 py-3 text-sm mb-6">
          Charts and analytics need the &ldquo;View registrations&rdquo; permission.
        </p>
      )}

      {analytics && trend && (
        <div className="flex flex-col gap-6 mb-6">
          <Panel
            title="Registrations over time"
            action={
              <div className="inline-flex rounded-full border border-emerald/20 overflow-hidden text-xs">
                {[
                  { label: "Per day", value: false },
                  { label: "Cumulative", value: true },
                ].map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setCumulative(o.value)}
                    className={`px-3 py-1 ${cumulative === o.value ? "bg-emerald text-white" : "text-ink hover:bg-emerald/5"}`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            }
          >
            {analytics.daily.length > 0 ? (
              <LineChart labels={trend.labels} series={trend.series} />
            ) : (
              <p className="text-sm text-sage">No registrations yet.</p>
            )}
            <p className="text-xs text-sage mt-2">Days are Nigeria time.</p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Conversion & pending payments">
              <BarList
                items={[
                  { label: "Registered", value: analytics.funnel.registered },
                  { label: "Paid", value: analytics.funnel.paid, display: `${analytics.funnel.paid} · ${analytics.funnel.conversionRate}%` },
                  { label: "Pending payment", value: analytics.funnel.pendingPayment },
                  { label: "Awaiting student ID review", value: analytics.funnel.pendingReview },
                  { label: "Cancelled, failed or refunded", value: analytics.funnel.failedOrCancelled },
                ]}
              />
              <div className="mt-5 pt-4 border-t border-emerald/15">
                <p className="text-sm text-ink font-semibold mb-2">How long pending payments have waited</p>
                <BarList
                  color="var(--color-coral)"
                  items={[
                    { label: "Under 24 hours", value: analytics.pending.under24h },
                    { label: "1 to 3 days", value: analytics.pending.between1And3Days },
                    { label: "Over 3 days", value: analytics.pending.over3Days },
                  ]}
                />
                {canRemind && (
                  <button
                    onClick={() => void remind()}
                    disabled={reminding || analytics.pending.remindable === 0}
                    className="mt-4 bg-forest text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-emerald transition-colors disabled:opacity-40"
                  >
                    {reminding
                      ? "Queuing…"
                      : analytics.pending.remindable === 0
                        ? "No one to remind right now"
                        : `Send reminder to ${analytics.pending.remindable} ${analytics.pending.remindable === 1 ? "person" : "people"}`}
                  </button>
                )}
                <p className="text-xs text-sage mt-2">
                  Reminds people pending over 24 hours who haven&rsquo;t been reminded in the last day.
                </p>
              </div>
            </Panel>

            <Panel title="Revenue">
              <p className="font-bricolage font-bold text-3xl text-forest">{money(analytics.revenue.totalMinor)}</p>
              <p className="text-xs text-sage mb-4">
                {analytics.revenue.discountMinor > 0
                  ? `after ${money(analytics.revenue.discountMinor)} in discounts and coupons`
                  : "from paid orders"}
              </p>
              <p className="text-sm text-ink font-semibold mb-2">By ticket type</p>
              <BarList
                items={analytics.revenue.byProduct.map((p) => ({
                  label: `${CATEGORY_LABELS[p.category] ?? p.category} · ${TIER_LABELS[p.tier] ?? p.tier}`,
                  value: p.amountMinor,
                  display: `${money(p.amountMinor)} · ${p.count}`,
                }))}
                empty="No paid orders yet."
              />
              <p className="text-sm text-ink font-semibold mt-5 mb-2">How people paid</p>
              <BarList
                color="var(--color-gold)"
                items={analytics.revenue.byChannel.map((c) => ({
                  label: CHANNEL_LABELS[c.channel] ?? c.channel,
                  value: c.count,
                  display: `${c.count} · ${money(c.amountMinor)}`,
                }))}
                empty="No paid orders yet."
              />
            </Panel>
          </div>

          <Panel
            title="Who is registering"
            action={
              <div className="flex flex-wrap gap-1.5">
                {BREAKDOWN_TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setBreakdownKey(t.key)}
                    className={`px-3 py-1 rounded-full text-xs transition-colors ${
                      breakdownKey === t.key ? "bg-emerald text-white font-semibold" : "border border-emerald/20 text-ink hover:bg-emerald/5"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            }
          >
            <BarList
              items={breakdown.map(
                (b): BarItem => ({
                  label: labelFor(breakdownKey, b.label),
                  value: b.count,
                  highlight: b.paid,
                  display: `${b.count} · ${b.paid} paid`,
                  href: breakdownHref(breakdownKey, b.label),
                }),
              )}
              empty="No registrations yet."
            />
            <p className="text-xs text-sage mt-3">
              The darker part of each bar is the number who paid. Registrations made before these questions were added
              show as &ldquo;Not provided&rdquo;.
            </p>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="Coupons">
              {analytics.coupons.length > 0 ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-sage">
                      <th className="font-normal pb-2">Code</th>
                      <th className="font-normal pb-2 text-right">Paid uses</th>
                      <th className="font-normal pb-2 text-right">Discount given</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald/10">
                    {visibleCoupons.map((c) => (
                      <tr key={c.code}>
                        <td className="py-2 font-mono">
                          <Link href={`/admin/registrations?coupon=${encodeURIComponent(c.code)}`} className="underline">
                            {c.code}
                          </Link>
                        </td>
                        <td className="py-2 text-right">{c.count}</td>
                        <td className="py-2 text-right">{money(c.discountMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-sage">No coupons have been used on a paid order yet.</p>
              )}
              {analytics.coupons.length > COUPON_PAGE_SIZE && (
                <PaginationFooter
                  page={currentCouponPage}
                  totalPages={couponTotalPages}
                  total={analytics.coupons.length}
                  onPageChange={setCouponPage}
                />
              )}
            </Panel>

            <Panel title="Worth a look">
              {analytics.flags.sharedEmailDomains.length > 0 ? (
                <>
                  <p className="text-sm text-ink mb-2">
                    Many registrations from the same company or school email domain:
                  </p>
                  <BarList
                    color="var(--color-gold)"
                    items={analytics.flags.sharedEmailDomains.map((d) => ({
                      label: `@${d.domain}`,
                      value: d.count,
                      href: `/admin/registrations?search=${encodeURIComponent(`@${d.domain}`)}`,
                    }))}
                  />
                  <p className="text-xs text-sage mt-3">
                    Often a group sign-up from one organisation, which is useful to know about, though sometimes it is
                    worth a check.
                  </p>
                </>
              ) : (
                <p className="text-sm text-sage">
                  Nothing unusual. No company or school email domain has 5 or more registrations.
                </p>
              )}
            </Panel>
          </div>

          <Panel title="Event day">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-sm text-ink font-semibold mb-2">
                  Arrivals per hour{" "}
                  <span className="font-normal text-sage">
                    · {analytics.eventDay.checkedIn} of {analytics.eventDay.tickets} checked in ({analytics.eventDay.checkInRate}%)
                  </span>
                </p>
                <ColumnChart
                  items={analytics.eventDay.arrivalsByHour.map((a) => ({
                    label: a.hour.slice(-5),
                    value: a.count,
                  }))}
                  empty="No one has been checked in yet."
                />
              </div>
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-sm text-ink font-semibold mb-2">By door</p>
                  <BarList
                    color="var(--color-forest)"
                    items={analytics.eventDay.byStation.map((s) => ({ label: s.station, value: s.count }))}
                    empty="No check-ins yet."
                  />
                </div>
                <div>
                  <p className="text-sm text-ink font-semibold mb-2">Not yet arrived, by category</p>
                  {analytics.eventDay.noShowByCategory.length > 0 ? (
                    <BarList
                      color="var(--color-coral)"
                      items={analytics.eventDay.noShowByCategory.map((c) => ({
                        label: CATEGORY_LABELS[c.category] ?? c.category,
                        value: c.noShow,
                        display: `${c.noShow} of ${c.tickets}`,
                      }))}
                    />
                  ) : (
                    <p className="text-sm text-sage">No tickets issued yet.</p>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}

      {!analytics && !analyticsDenied && !loadError && (
        <div className="flex flex-col gap-4 mb-6">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
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
