"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchNameTags, NameTag, TagSection } from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { CommitteePanel } from "./committee-panel";
import {
  AGENDA_URL,
  NameTagPreview,
  NameTagPrintSheet,
  printNameTags,
  SECTION_COLORS,
  useAgendaQr,
} from "./name-tag";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

const SECTIONS: { key: TagSection; label: string; hint: string }[] = [
  {
    key: "committee",
    label: "Organising Committee",
    hint: "Entered by hand below — one tag per member, printed with their position.",
  },
  {
    key: "registrants",
    label: "Registrations",
    hint: "Everyone with a paid, valid ticket. Students appear once their ID is approved; voided tickets are left out.",
  },
  {
    key: "speakers",
    label: "Speakers",
    hint: "Speakers marked visible on the Speakers page, using their tag and role.",
  },
  {
    key: "sponsors",
    label: "Sponsors, Partners & Exhibitors",
    hint: "Active sponsors, partners and exhibitors from the Partners & Sponsors directory.",
  },
];

const EMPTY_TAGS: Record<TagSection, NameTag[]> = {
  committee: [],
  registrants: [],
  speakers: [],
  sponsors: [],
};

export default function AdminNameTagsPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const toast = useToast();
  const qrSrc = useAgendaQr();

  const [tags, setTags] = useState(EMPTY_TAGS);
  const [loaded, setLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [section, setSection] = useState<TagSection>("committee");
  const [search, setSearch] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [printing, setPrinting] = useState<NameTag[] | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchNameTags(EVENT_SLUG)
      .then((data) => {
        if (cancelled) return;
        setTags(data);
        setLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load name tags.");
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, reloadKey]);

  // Print once the sheet for this batch has rendered, then clear it.
  useEffect(() => {
    if (!printing) return;
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      void printNameTags().then(() => {
        if (!cancelled) setPrinting(null);
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [printing]);

  function switchSection(next: TagSection) {
    setSection(next);
    setSearch("");
    setLabelFilter("");
    setSelected(new Set());
  }

  const sectionTags = tags[section];
  const labels = useMemo(
    () => Array.from(new Set(sectionTags.map((tag) => tag.label))).sort(),
    [sectionTags],
  );
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return sectionTags.filter(
      (tag) =>
        (!labelFilter || tag.label === labelFilter) &&
        (!needle ||
          [tag.name, tag.title, tag.organization].some((v) => v?.toLowerCase().includes(needle))),
    );
  }, [sectionTags, search, labelFilter]);

  const selectedVisible = visible.filter((tag) => selected.has(tag.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function print(batch: NameTag[]) {
    if (batch.length === 0) return;
    setPrinting(batch);
  }

  if (authLoading || !session) return null;

  const meta = SECTIONS.find((s) => s.key === section)!;

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="font-bricolage font-bold text-2xl sm:text-3xl text-forest">Name tags</h1>
          <p className="text-sm text-sage mt-1">
            90 × 40 mm stickers for the pre-printed badge cards, one per label. The QR code downloads the{" "}
            <a href={AGENDA_URL} className="underline" target="_blank" rel="noreferrer">
              agenda PDF
            </a>
            . In the print dialog choose the label printer, 90 × 40 mm paper, scale 100% and no margins.
          </p>
        </div>
        <button
          onClick={() => setReloadKey((k) => k + 1)}
          className="border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 my-6" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={section === s.key}
            onClick={() => switchSection(s.key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors ${
              section === s.key
                ? "bg-emerald text-white font-semibold shadow-sm"
                : "border border-emerald/20 text-ink hover:bg-gold/15"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: SECTION_COLORS[s.key] }} />
            {s.label}
            <span className={`text-xs ${section === s.key ? "text-white/80" : "text-sage"}`}>
              {loaded ? tags[s.key].length : "…"}
            </span>
          </button>
        ))}
      </div>

      <p className="text-sm text-sage mb-4">{meta.hint}</p>

      {section === "committee" && (
        <CommitteePanel eventSlug={EVENT_SLUG} onChange={() => setReloadKey((k) => k + 1)} />
      )}

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, role or organisation"
          className="border border-emerald/20 rounded-full px-4 py-2 text-sm text-ink bg-white w-72 max-w-full focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
        {labels.length > 1 && (
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="border border-emerald/20 rounded-full px-4 py-2 text-sm text-ink bg-white"
          >
            <option value="">All roles</option>
            {labels.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        )}
        <div className="flex flex-wrap items-center gap-3 ml-auto">
          {selectedVisible.length > 0 ? (
            <>
              <button onClick={() => setSelected(new Set())} className="text-sm text-sage underline">
                Clear selection
              </button>
              <button
                onClick={() => print(selectedVisible)}
                className="bg-coral text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-coral-deep transition-colors"
              >
                Print selected ({selectedVisible.length})
              </button>
            </>
          ) : (
            <span className="text-xs text-sage">Click stickers to select some, or print them all.</span>
          )}
          <button
            disabled={visible.length === 0}
            onClick={() => print(visible)}
            className="bg-forest text-white font-semibold px-5 py-2 rounded-full text-sm hover:bg-emerald transition-colors disabled:opacity-40"
          >
            Print {search || labelFilter ? "shown" : "all"} ({visible.length})
          </button>
        </div>
      </div>

      {loaded && visible.length === 0 && (
        <p className="text-sm text-sage border border-dashed border-emerald/20 rounded-2xl p-8 text-center bg-white">
          {sectionTags.length === 0 ? "No stickers in this section yet." : "No stickers match your search."}
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        {visible.map((tag) => {
          const isSelected = selected.has(tag.id);
          return (
            <div key={tag.id} className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                aria-pressed={isSelected}
                aria-label={`${isSelected ? "Deselect" : "Select"} ${tag.name}`}
                className={`relative rounded-lg transition-shadow ${
                  isSelected ? "ring-4 ring-coral ring-offset-2" : "hover:ring-2 hover:ring-gold/60"
                }`}
              >
                <NameTagPreview tag={tag} qrSrc={qrSrc} />
                {isSelected && (
                  <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-coral text-white text-sm flex items-center justify-center">
                    ✓
                  </span>
                )}
              </button>
              <button onClick={() => print([tag])} className="text-xs text-ink underline">
                Print this sticker
              </button>
            </div>
          );
        })}
      </div>

      {printing && <NameTagPrintSheet tags={printing} qrSrc={qrSrc} />}
    </main>
  );
}
