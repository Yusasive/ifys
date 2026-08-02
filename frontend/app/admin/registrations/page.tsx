"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchRegistrations,
  getExportStatus,
  markPaid,
  resendTicket,
  RegistrationListItem,
  requestExport,
} from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatKobo, CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { useToast } from "@/lib/toast-context";
import { TableRowsSkeleton } from "../skeleton";
import { StatusBadge } from "../status-badge";

const PAGE_SIZE = 20;
const COLUMN_COUNT = 8;

type SortField = "createdAt" | "fullName" | "status";

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
  const { session, loading: authLoading } = useRequireAdminAuth();
  const toast = useToast();
  const [registrations, setRegistrations] = useState<RegistrationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<string | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function load() {
      if (!session) return;
      setLoading(true);
      try {
        const listRes = await fetchRegistrations(session.token, {
          page,
          pageSize: PAGE_SIZE,
          status: status || undefined,
          category: category || undefined,
          search: search || undefined,
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
  }, [session, page, status, category, search, sortBy, order, refreshKey]);

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

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const allSelected = registrations.every((r) => prev.has(r.id));
      if (allSelected) return new Set();
      return new Set(registrations.map((r) => r.id));
    });
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(
    fn: (token: string, id: string) => Promise<unknown>,
    verb: string,
  ) {
    if (!session) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map((id) => fn(session.token, id)));
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;
    if (succeeded > 0) toast.success(`${succeeded} ${verb}.`);
    if (failed > 0) toast.error(`${failed} failed to ${verb.replace(/\.$/, "")}.`);
    setSelectedIds(new Set());
    setBulkBusy(false);
    setRefreshKey((k) => k + 1);
  }

  if (authLoading || !session) return null;

  if (loadError) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-8">
        <p className="border border-red-300 bg-red-50 text-red-700 rounded-sm px-4 py-3 text-sm">
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
      <h1 className="font-display text-2xl mb-6">Registrations</h1>

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

      {selectedIds.size > 0 && (
        <div className="bg-paper-2 border border-line rounded-sm px-4 py-2 flex items-center gap-3 mb-3 text-sm">
          <span>{selectedIds.size} selected</span>
          <button
            disabled={bulkBusy}
            onClick={() => void runBulk(markPaid, "marked paid")}
            className="bg-emerald text-paper px-3 py-1 rounded-sm disabled:opacity-50"
          >
            Mark paid
          </button>
          <button
            disabled={bulkBusy}
            onClick={() => void runBulk(resendTicket, "tickets resent")}
            className="border border-ink px-3 py-1 rounded-sm disabled:opacity-50"
          >
            Resend ticket
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-muted underline">
            Clear
          </button>
        </div>
      )}

      <div className="border border-line rounded-sm overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Select all visible rows"
                />
              </th>
              <SortHeader label="Name" field="fullName" activeField={sortBy} order={order} onSort={handleSort} />
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Category / Tier</th>
              <th className="px-4 py-2">Price</th>
              <SortHeader label="Status" field="status" activeField={sortBy} order={order} onSort={handleSort} />
              <SortHeader label="Registered" field="createdAt" activeField={sortBy} order={order} onSort={handleSort} />
              <th className="px-4 py-2">Ticket</th>
            </tr>
          </thead>
          <tbody>
            {loading && !hasLoadedOnce && <TableRowsSkeleton cols={COLUMN_COUNT} />}
            {registrations.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper-2">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.id)}
                    onChange={() => toggleRow(r.id)}
                    aria-label={`Select ${r.attendee.fullName}`}
                  />
                </td>
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
                <td className="px-4 py-2 text-muted">{formatDateTime(r.createdAt)}</td>
                <td className="px-4 py-2 font-mono">
                  {r.ticket ? (
                    <>
                      {r.ticket.ticketCode}{" "}
                      <StatusBadge status={r.ticket.status} />
                    </>
                  ) : (
                    <span className="text-muted">N/A</span>
                  )}
                </td>
              </tr>
            ))}
            {registrations.length === 0 && !loading && (
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-8 text-center text-muted">
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
  );
}
