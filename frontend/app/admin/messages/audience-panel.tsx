"use client";

import { useEffect, useState } from "react";
import { fetchRegistrations, RegistrationListItem } from "@/lib/admin-api";
import type { Category, Tier } from "@/lib/api";
import { CATEGORY_LABELS, TIER_LABELS } from "@/lib/format";
import { StatusBadge } from "../status-badge";

export type AudienceMode = "filter" | "pick";

export interface AudienceFilters {
  categories: Category[];
  tiers: Tier[];
  statuses: string[];
}

export interface PickedPerson {
  fullName: string;
  email: string;
}

export const CATEGORY_OPTIONS: Category[] = ["student", "regular", "professional", "founder"];
export const TIER_OPTIONS: Tier[] = ["standard", "premium"];
export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "paid", label: "Paid" },
  { value: "pending_review", label: "Pending review" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

const PICKER_PAGE_SIZE = 25;

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
        checked
          ? "bg-emerald text-white border-emerald"
          : "bg-white text-ink border-emerald/20 hover:border-emerald/50"
      }`}
    >
      {checked ? "✓ " : ""}
      {label}
    </button>
  );
}

function FilterGroup({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-sage mb-1">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
      <p className="text-xs text-sage mt-1">{hint}</p>
    </div>
  );
}

function FilterMode({
  filters,
  onChange,
}: {
  filters: AudienceFilters;
  onChange: (f: AudienceFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <FilterGroup
        title="Category"
        hint={filters.categories.length === 0 ? "None selected — all categories." : "Only the selected categories."}
      >
        {CATEGORY_OPTIONS.map((c) => (
          <Chip
            key={c}
            label={c === "founder" ? "Founder (legacy)" : CATEGORY_LABELS[c]}
            checked={filters.categories.includes(c)}
            onToggle={() => onChange({ ...filters, categories: toggle(filters.categories, c) })}
          />
        ))}
      </FilterGroup>
      <FilterGroup
        title="Tier"
        hint={filters.tiers.length === 0 ? "None selected — both tiers." : "Only the selected tiers."}
      >
        {TIER_OPTIONS.map((t) => (
          <Chip
            key={t}
            label={TIER_LABELS[t]}
            checked={filters.tiers.includes(t)}
            onToggle={() => onChange({ ...filters, tiers: toggle(filters.tiers, t) })}
          />
        ))}
      </FilterGroup>
      <FilterGroup
        title="Registration status"
        hint={
          filters.statuses.length === 0
            ? "None selected — every status, including unpaid and cancelled."
            : "Only registrations with the selected statuses."
        }
      >
        {STATUS_OPTIONS.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            checked={filters.statuses.includes(s.value)}
            onToggle={() => onChange({ ...filters, statuses: toggle(filters.statuses, s.value) })}
          />
        ))}
      </FilterGroup>
    </div>
  );
}

function PickMode({
  picked,
  onChange,
}: {
  picked: Map<string, PickedPerson>;
  onChange: (next: Map<string, PickedPerson>) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("paid");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<RegistrationListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSelected, setShowSelected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      fetchRegistrations({
        page,
        pageSize: PICKER_PAGE_SIZE,
        search: search || undefined,
        category: category || undefined,
        status: status || undefined,
        sortBy: "fullName",
        order: "asc",
      })
        .then((res) => {
          if (cancelled) return;
          setRows(res.registrations);
          setTotal(res.total);
        })
        .catch(() => {
          if (!cancelled) setRows([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, category, status, page]);

  function togglePerson(r: RegistrationListItem) {
    const next = new Map(picked);
    if (next.has(r.id)) next.delete(r.id);
    else next.set(r.id, { fullName: r.attendee.fullName, email: r.attendee.email });
    onChange(next);
  }

  const allOnPagePicked = rows.length > 0 && rows.every((r) => picked.has(r.id));
  function togglePage() {
    const next = new Map(picked);
    if (allOnPagePicked) rows.forEach((r) => next.delete(r.id));
    else rows.forEach((r) => next.set(r.id, { fullName: r.attendee.fullName, email: r.attendee.email }));
    onChange(next);
  }

  const totalPages = Math.max(1, Math.ceil(total / PICKER_PAGE_SIZE));
  const inputClass =
    "border border-emerald/20 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-gold bg-white";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <input
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search name or email"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
            className={inputClass}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c === "founder" ? "Founder (legacy)" : CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
            className={inputClass}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2 text-sage">
          <input type="checkbox" className="accent-emerald" checked={allOnPagePicked} onChange={togglePage} />
          Select all on this page
        </label>
        <span className="text-sage text-xs">{total} found</span>
      </div>

      <ul className="border border-emerald/20 rounded-xl divide-y divide-emerald/10 max-h-80 overflow-y-auto bg-white">
        {rows.map((r) => (
          <li key={r.id}>
            <label className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-emerald/5">
              <input
                type="checkbox"
                className="accent-emerald mt-1"
                checked={picked.has(r.id)}
                onChange={() => togglePerson(r)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-ink truncate">{r.attendee.fullName}</span>
                <span className="block text-xs text-sage truncate">{r.attendee.email}</span>
              </span>
              <span className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-sage">{CATEGORY_LABELS[r.ticketProduct.category].split(" ")[0]}</span>
                <StatusBadge status={r.status} />
              </span>
            </label>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-sage">{loading ? "Loading…" : "No one matches."}</li>
        )}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-emerald underline disabled:opacity-40 disabled:no-underline"
          >
            ← Prev
          </button>
          <span className="text-sage text-xs">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-emerald underline disabled:opacity-40 disabled:no-underline"
          >
            Next →
          </button>
        </div>
      )}

      <div className="bg-gold/10 border border-gold/30 rounded-xl px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-medium text-ink">{picked.size} selected</span>
          {picked.size > 0 && (
            <>
              <button type="button" onClick={() => setShowSelected((s) => !s)} className="text-emerald underline">
                {showSelected ? "Hide" : "Show"}
              </button>
              <button type="button" onClick={() => onChange(new Map())} className="ml-auto text-sage underline">
                Clear
              </button>
            </>
          )}
        </div>
        {showSelected && picked.size > 0 && (
          <ul className="flex flex-wrap gap-1.5 mt-2 max-h-40 overflow-y-auto">
            {[...picked.entries()].map(([id, p]) => (
              <li
                key={id}
                className="flex items-center gap-1 bg-white border border-emerald/20 rounded-full pl-2.5 pr-1 py-0.5 text-xs"
                title={p.email}
              >
                {p.fullName}
                <button
                  type="button"
                  aria-label={`Remove ${p.fullName}`}
                  onClick={() => {
                    const next = new Map(picked);
                    next.delete(id);
                    onChange(next);
                  }}
                  className="text-sage hover:text-coral-deep px-1"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AudiencePanel({
  mode,
  onModeChange,
  filters,
  onFiltersChange,
  picked,
  onPickedChange,
}: {
  mode: AudienceMode;
  onModeChange: (m: AudienceMode) => void;
  filters: AudienceFilters;
  onFiltersChange: (f: AudienceFilters) => void;
  picked: Map<string, PickedPerson>;
  onPickedChange: (p: Map<string, PickedPerson>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 bg-cloud border border-emerald/20 rounded-full p-1 text-sm" role="tablist">
        {(
          [
            ["filter", "By category"],
            ["pick", "Pick people"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => onModeChange(value)}
            className={`rounded-full py-1.5 transition-colors ${
              mode === value ? "bg-emerald text-white" : "text-ink hover:bg-emerald/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "filter" ? (
        <FilterMode filters={filters} onChange={onFiltersChange} />
      ) : (
        <PickMode picked={picked} onChange={onPickedChange} />
      )}
    </div>
  );
}
