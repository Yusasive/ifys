"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { listAdminTicketProducts, updateTicketProduct } from "@/lib/admin-api";
import { useRequireAdminAuth } from "@/lib/admin-auth-context";
import { ApiError, TicketProduct } from "@/lib/api";
import { CATEGORY_LABELS, formatKobo } from "@/lib/format";
import { useToast } from "@/lib/toast-context";
import { FormModal } from "../form-modal";
import { PauseToggle } from "../pause-toggle";
import { DateUpdateResendPanel } from "./date-update-resend-panel";
import { StudentReviewNotifyPanel } from "./student-review-notify-panel";
import { TicketCapacityCard } from "./ticket-capacity-card";

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
  const [editOpen, setEditOpen] = useState(false);
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

  function openEdit() {
    setPriceNaira(String(product.priceKobo / 100));
    setDiscountPercent(product.discountPercent !== null ? String(product.discountPercent) : "");
    setDiscountExpiresAt(toDatetimeLocal(product.discountExpiresAt));
    setCardPriceLabel(product.cardPriceLabel ?? "");
    setCardNote(product.cardNote ?? "");
    setIsActive(product.isActive);
    setEditOpen(true);
  }

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
      setEditOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.body.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-emerald/20 rounded-2xl bg-white p-6 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl">{CATEGORY_LABELS[product.category]}</h2>
          <p className="text-sm text-sage mt-1">
            {formatKobo(product.priceKobo, product.currency)}
            {product.discountPercent !== null && ` · ${product.discountPercent}% early-bird discount`}
          </p>
        </div>
        <span
          className={`text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap ${
            product.isActive ? "bg-emerald/10 text-emerald" : "bg-emerald/5 text-sage"
          }`}
        >
          {product.isActive ? "Available" : "Unavailable"}
        </span>
      </div>
      <button
        onClick={openEdit}
        className="self-start text-sm text-ink underline"
      >
        Edit
      </button>

      <FormModal
        open={editOpen}
        title={`Edit ${CATEGORY_LABELS[product.category]} ticket`}
        onClose={() => setEditOpen(false)}
      >
        <form onSubmit={(e) => void handleSave(e)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Price (NGN)</span>
              <input
                type="number"
                min={0}
                value={priceNaira}
                onChange={(e) => setPriceNaira(e.target.value)}
                className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Early-bird discount (%)</span>
              <input
                type="number"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="e.g. 30"
                className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Discount expires</span>
              <input
                type="datetime-local"
                value={discountExpiresAt}
                onChange={(e) => setDiscountExpiresAt(e.target.value)}
                className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-sage">Card price label</span>
              <input
                value={cardPriceLabel}
                onChange={(e) => setCardPriceLabel(e.target.value)}
                placeholder='e.g. "5K"'
                className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-sage">Card note</span>
            <input
              value={cardNote}
              onChange={(e) => setCardNote(e.target.value)}
              placeholder="e.g. *30% discount for early birds"
              className="border border-emerald/20 rounded-xl px-3 py-2 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 transition-colors"
            />
          </label>

          <label className="flex items-center gap-2">
            <input type="checkbox" className="accent-emerald" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span className="text-sm text-sage">Available for purchase</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="self-start bg-coral text-white font-semibold px-6 py-2.5 rounded-full hover:bg-coral-deep transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditOpen(false)} className="text-sm text-sage">
              Cancel
            </button>
          </div>
        </form>
      </FormModal>
    </div>
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
                (p.category === "student" || p.category === "regular" || p.category === "professional") &&
                p.tier === "standard",
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
        className="inline-flex items-center gap-1 border border-emerald/20 rounded-full px-4 py-1.5 text-sm text-ink hover:bg-emerald/5 transition-colors mb-6"
      >
        ← Back to registrations
      </Link>

      <h1 className="font-bricolage font-bold text-2xl text-forest mb-2">Tickets</h1>
      <p className="text-sm text-sage mb-6">
        Manage pricing, early-bird discounts, and the copy shown on each ticket card on the public site.
      </p>

      <PauseToggle eventSlug={EVENT_SLUG} field="ticketPurchasingPaused" label="Ticket purchasing" />

      <TicketCapacityCard eventSlug={EVENT_SLUG} />

      {session.user.role === "super_admin" && <DateUpdateResendPanel eventSlug={EVENT_SLUG} />}

      {session.user.role === "super_admin" && <StudentReviewNotifyPanel />}

      {!loaded && <p className="text-sm text-sage">Loading…</p>}

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
