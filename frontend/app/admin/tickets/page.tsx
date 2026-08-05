"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { listAdminTicketProducts, updateTicketProduct } from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError, TicketProduct } from "@/lib/api";
import { CATEGORY_LABELS } from "@/lib/format";
import { useToast } from "@/lib/toast-context";

const EVENT_SLUG = process.env.NEXT_PUBLIC_EVENT_SLUG ?? "ify-summit-2026";

// Datetime-local inputs want "YYYY-MM-DDTHH:mm" in local time, not a raw
// ISO string with a trailing "Z" and seconds.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TicketProductCard({
  product,
  onSaved,
}: {
  product: TicketProduct;
  onSaved: (updated: TicketProduct) => void;
}) {
  const toast = useToast();
  const [priceNaira, setPriceNaira] = useState(String(product.priceKobo / 100));
  const [discountPercent, setDiscountPercent] = useState(
    product.discountPercent !== null ? String(product.discountPercent) : "",
  );
  const [discountExpiresAt, setDiscountExpiresAt] = useState(
    toDatetimeLocal(product.discountExpiresAt),
  );
  const [cardPriceLabel, setCardPriceLabel] = useState(product.cardPriceLabel ?? "");
  const [cardNote, setCardNote] = useState(product.cardNote ?? "");
  const [isActive, setIsActive] = useState(product.isActive);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateTicketProduct(product.id, {
        priceKobo: Math.round(Number(priceNaira) * 100),
        discountPercent: discountPercent === "" ? null : Number(discountPercent),
        discountExpiresAt: discountExpiresAt === "" ? null : new Date(discountExpiresAt).toISOString(),
        cardPriceLabel: cardPriceLabel.trim() === "" ? null : cardPriceLabel.trim(),
        cardNote: cardNote.trim() === "" ? null : cardNote.trim(),
        isActive,
      });
      onSaved(updated);
      toast.success(`${CATEGORY_LABELS[product.category]} ticket updated.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="border border-line rounded-sm bg-white p-6 flex flex-col gap-4"
    >
      <h2 className="font-display text-xl">{CATEGORY_LABELS[product.category]}</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Price (NGN)</span>
          <input
            type="number"
            min={0}
            value={priceNaira}
            onChange={(e) => setPriceNaira(e.target.value)}
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Early-bird discount (%)</span>
          <input
            type="number"
            min={1}
            max={100}
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            placeholder="e.g. 30"
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Discount expires</span>
          <input
            type="datetime-local"
            value={discountExpiresAt}
            onChange={(e) => setDiscountExpiresAt(e.target.value)}
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-muted">Card price label</span>
          <input
            value={cardPriceLabel}
            onChange={(e) => setCardPriceLabel(e.target.value)}
            placeholder='e.g. "5K"'
            className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-muted">Card note</span>
        <input
          value={cardNote}
          onChange={(e) => setCardNote(e.target.value)}
          placeholder="e.g. *30% discount for early birds"
          className="border border-line rounded-sm px-3 py-2 focus:outline-none focus:border-gold"
        />
      </label>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <span className="text-sm text-muted">Available for purchase</span>
      </label>

      <button
        type="submit"
        disabled={saving}
        className="self-start bg-ink text-paper font-medium px-6 py-2 rounded-sm disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

export default function AdminTicketsPage() {
  const { session, loading: authLoading } = useRequireAdminAuth();
  const [products, setProducts] = useState<TicketProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    async function load() {
      if (!session) return;
      try {
        const { ticketProducts } = await listAdminTicketProducts(EVENT_SLUG);
        if (!cancelled) {
          setProducts(
            ticketProducts.filter(
              (p) =>
                (p.category === "student" || p.category === "professional") && p.tier === "standard",
            ),
          );
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof ApiError ? err.body.message : "Failed to load tickets.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (authLoading || !session) return null;

  return (
    <main className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/admin/registrations"
        className="inline-flex items-center gap-1 border border-line rounded-sm px-3 py-1.5 text-sm text-ink hover:bg-paper-2 mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-display text-2xl mb-2">Tickets</h1>
      <p className="text-sm text-muted mb-6">
        Manage pricing, early-bird discounts, and the copy shown on each ticket card on the public site.
      </p>

      {!loaded && <p className="text-sm text-muted">Loading…</p>}

      <div className="flex flex-col gap-6">
        {products.map((product) => (
          <TicketProductCard
            key={product.id}
            product={product}
            onSaved={(updated) =>
              setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            }
          />
        ))}
      </div>
    </main>
  );
}
