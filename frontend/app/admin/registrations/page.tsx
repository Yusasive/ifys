"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  fetchRegistrations,
  getExportStatus,
  markPaid,
  resendTicket,
  RegistrationListItem,
  requestExport,
  sendPendingPaymentReminder,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatKobo, CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { HEARD_FROM_OPTIONS } from "@/lib/registration-options";
import { useToast } from "@/lib/toast-context";
import { PRESELECTED_STORAGE_KEY } from "../messages/preselected";
import { PaginationFooter } from "../pagination-footer";
import { ReasonModal } from "../reason-modal";
import { TableRowsSkeleton } from "../skeleton";
import { paymentChannelLabel } from "../payment-channel";
import { StatusBadge } from "../status-badge";

const PAGE_SIZE = 20;
const COLUMN_COUNT = 10;

type SortField = "createdAt" | "fullName" | "status" | "amount";

const CHANNEL_FILTERS = ["card", "bank_transfer", "bank", "ussd", "qr", "mobile_money", "free", "manual"];

// A date picked in the admin means that day in Nigeria (UTC+1, no DST).
const startOfDay = (date: string) => (date ? `${date}T00:00:00+01:00` : undefined);
const endOfDay = (date: string) => (date ? `${date}T23:59:59.999+01:00` : undefined);

function SortHeader({
  label,
  field,
  activeField,
  order,
  onSort,
}: {
  label: string;
  field: SortField;
  activeField: SortField;
  order: "asc" | "desc";
  onSort: (field: SortField) => void;
}) {
  const active = field === activeField;
  return (
    <th className="px-4 py-2">
      <button
        onClick={() => onSort(field)}
        className="flex items-center gap-1 uppercase tracking-wide text-xs hover:text-ink"
      >
        {label}
        {active && <span>{order === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

export default function AdminRegistrationsPage() {
  // useSearchParams needs a Suspense boundary to prerender.
  return (
    <Suspense fallback={null}>
      <AdminRegistrations />
    </Suspense>
  );
}

function AdminRegistrations() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const toast = useToast();
  const router = useRouter();
  const [registrations, setRegistrations] = useState<RegistrationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  // Filters can arrive in the link (e.g. from a card on the overview).
  const initial = useSearchParams();
  const [status, setStatus] = useState(initial.get("status") ?? "");
  const [category, setCategory] = useState(initial.get("category") ?? "");
  const [tier, setTier] = useState(initial.get("tier") ?? "");
  const [search, setSearch] = useState(initial.get("search") ?? "");
  const [fromDate, setFromDate] = useState(initial.get("from") ?? "");
  const [toDate, setToDate] = useState(initial.get("to") ?? "");
  const [source, setSource] = useState(initial.get("source") ?? "");
  const [coupon, setCoupon] = useState(initial.get("coupon") ?? "");
  const [channel, setChannel] = useState(initial.get("channel") ?? "");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Name/email for every selected row (across pages), for "Email selected".
  const [selectedPeople, setSelectedPeople] = useState<
    Map<string, { fullName: string; email: string }>
  >(new Map());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showBulkMarkPaidConfirm, setShowBulkMarkPaidConfirm] = useState(false);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function load() {
      if (!session) return;
      setLoading(true);
      try {
        const listRes = await fetchRegistrations({
          page,
          pageSize: PAGE_SIZE,
          status: status || undefined,
          category: category || undefined,
          tier: tier || undefined,
          search: search || undefined,
          from: startOfDay(fromDate),
          to: endOfDay(toDate),
          source: source || undefined,
          coupon: coupon.trim() || undefined,
          channel: channel || undefined,
          sortBy,
          order,
        });
        if (cancelled) return;
        setRegistrations(listRes.registrations);
        setTotal(listRes.total);
        setLoadError(null);
        setHasLoadedOnce(true);
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
  }, [session, page, status, category, tier, search, fromDate, toDate, source, coupon, channel, sortBy, order, refreshKey]);

  const filtersActive = !!(status || category || tier || search || fromDate || toDate || source || coupon || channel);

  function clearFilters() {
    setPage(1);
    setStatus("");
    setCategory("");
    setTier("");
    setSearch("");
    setFromDate("");
    setToDate("");
    setSource("");
    setCoupon("");
    setChannel("");
    // Drop any filters carried in the link too.
    router.replace("/admin/registrations");
  }

  function handleSort(field: SortField) {
    setPage(1);
    if (field === sortBy) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setOrder("desc");
    }
  }

  async function handleExport() {
    if (!session) return;
    setExportState("queued");
    setExportUrl(null);
    const { jobId } = await requestExport();
    const poll = async () => {
      const result = await getExportStatus(jobId);
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

  function toggleAllVisible() {
    const allSelected = registrations.every((r) => selectedIds.has(r.id));
    if (allSelected) {
      clearSelection();
      return;
    }
    setSelectedIds(new Set(registrations.map((r) => r.id)));
    setSelectedPeople(
      new Map(
        registrations.map((r) => [
          r.id,
          { fullName: r.attendee.fullName, email: r.attendee.email },
        ]),
      ),
    );
  }

  function toggleRow(r: RegistrationListItem) {
    const nextIds = new Set(selectedIds);
    const nextPeople = new Map(selectedPeople);
    if (nextIds.has(r.id)) {
      nextIds.delete(r.id);
      nextPeople.delete(r.id);
    } else {
      nextIds.add(r.id);
      nextPeople.set(r.id, { fullName: r.attendee.fullName, email: r.attendee.email });
    }
    setSelectedIds(nextIds);
    setSelectedPeople(nextPeople);
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectedPeople(new Map());
  }

  function emailSelected() {
    try {
      sessionStorage.setItem(
        PRESELECTED_STORAGE_KEY,
        JSON.stringify([...selectedPeople.entries()]),
      );
    } catch {
      toast.error("Could not hand the selection over — pick people on the Email participants page instead.");
    }
    router.push("/admin/messages");
  }

  async function runBulk(
    fn: (id: string) => Promise<unknown>,
    verb: string,
  ) {
    if (!session) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => fn(id)));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;
    if (succeeded > 0) toast.success(`${succeeded} ${verb}.`);
    if (failed > 0) toast.error(`${failed} failed to ${verb.replace(/\.$/, "")}.`);
    clearSelection();
    setBulkBusy(false);
    setRefreshKey((k) => k + 1);
  }

  if (authLoading || !session) return null;

  if (loadError) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="border border-coral/30 bg-coral/10 text-coral-deep rounded-xl px-4 py-3 text-sm">
          {loadError}
        </p>
      </main>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allVisibleSelected =
    registrations.length > 0 && registrations.every((r) => selectedIds.has(r.id));

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest mb-6">Registrations</h1>

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">Search</span>
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Name or email"
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">Status</span>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          >
            <option value="">All</option>
            <option value="pending_payment">Pending payment</option>
            <option value="pending_review">Pending review</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">Category</span>
          <select
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          >
            <option value="">All</option>
            <option value="student">Student</option>
            <option value="regular">Regular</option>
            <option value="professional">Professional / Founders / Entrepreneurs</option>
            <option value="founder">Founder / Entrepreneur (legacy)</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">Registered from</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setPage(1);
              setFromDate(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">to</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setPage(1);
              setToDate(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">How they heard</span>
          <select
            value={source}
            onChange={(e) => {
              setPage(1);
              setSource(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          >
            <option value="">All</option>
            {HEARD_FROM_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
            {source && !HEARD_FROM_OPTIONS.includes(source) && source !== "none" && (
              <option value={source}>{source}</option>
            )}
            <option value="none">No answer</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">Payment</span>
          <select
            value={channel}
            onChange={(e) => {
              setPage(1);
              setChannel(e.target.value);
            }}
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold"
          >
            <option value="">All</option>
            {CHANNEL_FILTERS.map((c) => (
              <option key={c} value={c}>
                {paymentChannelLabel(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-sage">Coupon</span>
          <input
            value={coupon}
            onChange={(e) => {
              setPage(1);
              setCoupon(e.target.value);
            }}
            placeholder="Code, any or none"
            className="border border-emerald/20 rounded-xl px-3 py-1.5 text-sm w-36 focus:outline-none focus:border-gold"
          />
        </label>
        {filtersActive && (
          <button onClick={clearFilters} className="text-sm text-sage underline pb-2">
            Clear filters
          </button>
        )}

        <div className="ml-auto flex flex-col gap-1 items-end">
          <button
            onClick={() => void handleExport()}
            disabled={exportState === "queued" || exportState === "waiting" || exportState === "active"}
            className="border border-emerald text-emerald px-4 py-1.5 rounded-full text-sm hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
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

      {selectedIds.size > 0 && (
        <div className="bg-gold/10 border border-gold/30 rounded-2xl px-4 py-2 flex items-center gap-3 mb-3 text-sm">
          <span>{selectedIds.size} selected</span>
          <button
            disabled={bulkBusy}
            onClick={() => setShowBulkMarkPaidConfirm(true)}
            className="bg-emerald text-white px-4 py-1.5 rounded-full hover:bg-forest transition-colors disabled:opacity-50"
          >
            Mark paid
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => void runBulk(resendTicket, "tickets resent")}
            className="border border-emerald text-emerald px-4 py-1.5 rounded-full hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
          >
            Resend ticket
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => void runBulk(sendPendingPaymentReminder, "reminders sent")}
            className="border border-emerald text-emerald px-4 py-1.5 rounded-full hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
          >
            Send reminder
          </button>
          {hasPermission(session.user.permissions, "messaging.send") && (
            <button
              disabled={bulkBusy}
              onClick={emailSelected}
              className="border border-emerald text-emerald px-4 py-1.5 rounded-full hover:bg-emerald hover:text-white transition-colors disabled:opacity-50"
            >
              Email selected
            </button>
          )}
          <button onClick={clearSelection} className="ml-auto text-sage underline">
            Clear
          </button>
        </div>
      )}

      <div className="border border-emerald/20 rounded-2xl overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald/20 text-left text-xs uppercase tracking-wide text-sage">
              <th className="px-4 py-2 w-8">
                <input
                  type="checkbox"
                  className="accent-emerald"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible rows"
                />
              </th>
              <SortHeader label="Name" field="fullName" activeField={sortBy} order={order} onSort={handleSort} />
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Category / Tier</th>
              <SortHeader label="Amount" field="amount" activeField={sortBy} order={order} onSort={handleSort} />
              <th className="px-4 py-2">Heard via</th>
              <th className="px-4 py-2">Payment</th>
              <SortHeader label="Status" field="status" activeField={sortBy} order={order} onSort={handleSort} />
              <SortHeader label="Registered" field="createdAt" activeField={sortBy} order={order} onSort={handleSort} />
              <th className="px-4 py-2">Ticket</th>
            </tr>
          </thead>
          <tbody>
            {loading && !hasLoadedOnce && <TableRowsSkeleton cols={COLUMN_COUNT} />}
            {registrations.map((r) => (
              <tr key={r.id} className="border-b border-emerald/20 last:border-0 hover:bg-emerald/5">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    className="accent-emerald"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleRow(r)}
                    aria-label={`Select ${r.attendee.fullName}`}
                  />
                </td>
                <td className="px-4 py-2">
                  <Link href={`/admin/registrations/${r.id}`} className="underline">
                    {r.attendee.fullName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-sage">{r.attendee.email}</td>
                <td className="px-4 py-2">
                  {CATEGORY_LABELS[r.ticketProduct.category]} · {TIER_LABELS[r.ticketProduct.tier]}
                </td>
                <td className="px-4 py-2 font-mono">
                  {formatKobo(r.order?.amountMinor ?? r.ticketProduct.priceKobo, r.ticketProduct.currency)}
                </td>
                <td className="px-4 py-2 text-sage">
                  {r.heardFrom ?? "—"}
                  {r.utmCampaign && <span className="block font-mono text-xs">{r.utmCampaign}</span>}
                </td>
                <td className="px-4 py-2 text-sage">
                  {paymentChannelLabel(r.order?.paymentChannel)}
                  {r.coupon && <span className="block font-mono text-xs">{r.coupon.code}</span>}
                </td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-2 text-sage">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2 font-mono">
                  {r.ticket ? (
                    <>
                      {r.ticket.ticketCode}{" "}
                      <StatusBadge status={r.ticket.status} />
                    </>
                  ) : (
                    <span className="text-sage">N/A</span>
                  )}
                </td>
              </tr>
            ))}
            {registrations.length === 0 && !loading && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-8 text-center text-sage">
                  No registrations match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationFooter page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      <ReasonModal
        open={showBulkMarkPaidConfirm}
        title={`Mark ${selectedIds.size} registration${selectedIds.size === 1 ? "" : "s"} as paid`}
        description="This issues a ticket and emails it to each attendee. The same reason applies to all selected registrations."
        reasonLabel="Reason (e.g. bank transfer confirmed manually)"
        confirmLabel="Confirm"
        busy={bulkBusy}
        onCancel={() => setShowBulkMarkPaidConfirm(false)}
        onConfirm={(reason) =>
          runBulk((id) => markPaid(id, reason), "marked paid").then(() =>
            setShowBulkMarkPaidConfirm(false),
          )
        }
      />
    </main>
  );
}
